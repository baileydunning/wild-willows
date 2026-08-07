// The i18n engine. Deliberately dependency-free and environment-free (no DOM,
// no localStorage, no Node APIs) so the SAME module works in the React UI, in
// Phaser scenes, inside server/resources.ts (both the esbuild server bundle and
// the solo in-renderer import), and under Vitest.
//
// Design notes:
// - Catalogs are plain JSON, registered per locale with `registerCatalog`.
//   Nested objects are flattened to dot-keys ("app.title"), and arrays are kept
//   whole (narrative line pools). Registration merges, so catalogs can be split
//   across files (app.json / panels.json / narrative.json / server.json).
// - `t(key, params)` interpolates `{name}` placeholders. Plurals are the
//   simple English-model pair {"one": …, "other": …} selected by
//   `params.count`; locales with richer plural rules can be handled here later
//   without touching call sites.
// - Missing keys fall back: active locale → en → the key itself (never throws,
//   never renders undefined).
// - `content(kind, id, field, fallback)` resolves translated *data content*
//   (animal names/facts, recipe names… — see data/*.json) from overlay keys
//   like "content.animal.red-fox-meadow.name". English ships no overlay: the
//   fallback IS the English text already inside data/*.json, so we don't
//   duplicate 380KB of definitions. `scripts/i18n-extract.mjs` generates the
//   full overlay template for translators.

export type CatalogValue = string | string[] | { one: string; other: string };
export type Catalog = Record<string, CatalogValue>;
export type Params = Record<string, string | number>;

const FALLBACK_LOCALE = 'en';

const catalogs = new Map<string, Catalog>();
let activeLocale = FALLBACK_LOCALE;
const listeners = new Set<() => void>();

/** Flatten nested JSON into dot-keys; arrays and {one,other} stay whole. */
function flatten(src: Record<string, unknown>, prefix: string, out: Catalog): Catalog {
	for (const [k, v] of Object.entries(src)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (typeof v === 'string' || Array.isArray(v)) {
			out[key] = v as CatalogValue;
		} else if (v && typeof v === 'object') {
			const o = v as Record<string, unknown>;
			if (typeof o.one === 'string' && typeof o.other === 'string') {
				out[key] = { one: o.one, other: o.other };
			} else {
				flatten(o, key, out);
			}
		}
	}
	return out;
}

/** Merge a (possibly nested) catalog into a locale. Later registrations win. */
export function registerCatalog(locale: string, dict: Record<string, unknown>): void {
	const existing = catalogs.get(locale) ?? {};
	catalogs.set(locale, Object.assign(existing, flatten(dict, '', {})));
}

export function getLocale(): string {
	return activeLocale;
}

/** Locales that have at least one registered catalog. */
export function availableLocales(): string[] {
	return [...catalogs.keys()];
}

export function setLocale(locale: string): void {
	if (locale === activeLocale) return;
	activeLocale = locale;
	for (const fn of [...listeners]) fn();
}

/** Subscribe to locale changes (used by the React hook). Returns unsubscribe. */
export function onLocaleChange(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

// ------------------------------------------------------- plain-language mode
//
// An accessibility option that swaps the game's wording for plainer phrasing at
// roughly a 5th-grade reading level — shorter sentences, everyday words, the
// jargon either dropped or explained in place.
//
// It's an OVERLAY, not a separate locale. Simplified strings live in
// `<locale>/simple.json` and register under the pseudo-locale "<locale>:simple";
// `lookup` consults them first and falls back per key. Three things fall out of
// that which matter:
//
//   • Coverage can grow string by string. A key with no plain version simply
//     shows its normal text — never a missing-key placeholder, never English
//     leaking into a Spanish session.
//   • It works for data content too (animal diets, habitats, ecology notes),
//     because `content()` goes through the same lookup.
//   • Turning it off is free: the normal catalogs are untouched.
const SIMPLE_SUFFIX = ':simple';
let simpleText = false;

/** The pseudo-locale a plain-language catalog registers under. */
export const simpleLocale = (locale: string): string => locale + SIMPLE_SUFFIX;

export function setSimpleText(on: boolean): void {
	if (on === simpleText) return;
	simpleText = on;
	for (const fn of [...listeners]) fn(); // same notify path as a locale switch
}

export function isSimpleText(): boolean {
	return simpleText;
}

/**
 * Resolution order. Plain-language entries win when the option is on, in the
 * active language first so a Spanish player gets Spanish plain text rather than
 * English; then the ordinary catalogs, which is what makes partial coverage
 * safe.
 */
function lookup(key: string): CatalogValue | undefined {
	if (simpleText) {
		const simple =
			catalogs.get(simpleLocale(activeLocale))?.[key] ?? catalogs.get(simpleLocale(FALLBACK_LOCALE))?.[key];
		if (simple !== undefined) return simple;
	}
	return catalogs.get(activeLocale)?.[key] ?? catalogs.get(FALLBACK_LOCALE)?.[key];
}

function interpolate(template: string, params?: Params): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/**
 * Translate a key. `params` fill `{name}` placeholders; if the catalog value
 * is a plural pair, `params.count` picks the form (and fills `{count}`).
 * Unknown keys return the key itself so a missed string is visible, not fatal.
 */
export function t(key: string, params?: Params): string {
	const v = lookup(key);
	if (v === undefined) return interpolate(key, params);
	if (typeof v === 'string') return interpolate(v, params);
	if (Array.isArray(v)) return interpolate(v[0] ?? key, params);
	const form = params?.count === 1 || params?.count === -1 ? v.one : v.other;
	return interpolate(form, params);
}

/**
 * A pool of lines (narrative/lore randomized pools). Always returns an array;
 * a single string becomes a one-item pool, a missing key an empty one.
 */
export function tList(key: string, params?: Params): string[] {
	const v = lookup(key);
	if (v === undefined) return [];
	if (typeof v === 'string') return [interpolate(v, params)];
	if (Array.isArray(v)) return v.map((s) => interpolate(s, params));
	return [t(key, params)];
}

/** True if the key exists in the active-or-fallback catalogs. */
export function hasKey(key: string): boolean {
	return lookup(key) !== undefined;
}

/**
 * Localized *data content* (definitions from data/*.json). English needs no
 * overlay — the `fallback` is the English text straight off the definition —
 * so this only diverges once a locale overlay registers "content.*" keys.
 *
 *   content('animal', a.id, 'name', a.name)
 *   content('recipe', r.id, 'description', r.description)
 */
export function content(kind: string, id: string, field: string, fallback: string): string {
	const v = lookup(`content.${kind}.${id}.${field}`);
	return typeof v === 'string' ? v : fallback;
}

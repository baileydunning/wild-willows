#!/usr/bin/env node
// scripts/i18n-extract.mjs — generate the translator template for DATA CONTENT.
//
// The game's definitions (data/*.json) carry their English text inline; the
// i18n engine (src/i18n/core.ts) resolves translations from overlay keys like
// "content.animal.red-fox-meadow.name" and falls back to the data files for
// English. This script extracts every human-readable English field from
// data/*.json and writes a nested template to:
//
//     src/i18n/templates/content.en.json
//
// shaped { "content": { "<kind>": { "<id>": { "<field>": "English…" } } } }
// with kinds: animal, biome, recipe, habitatObject, resource, tool,
// achievement, weather.
//
// Translator workflow:
//   1. Copy src/i18n/templates/content.en.json to src/i18n/<locale>/content.json
//   2. Translate every string value (never the keys/ids; keep {placeholders}).
//      Arrays are randomized line pools — translate each line; the pool may
//      grow or shrink.
//   3. Register the locale's catalogs in src/i18n/index.ts (content.json is
//      registered as-is — it already carries the top-level "content" wrapper).
//
// Output is deterministic (keys sorted at every level) so diffs stay stable.
// Zero dependencies; run from anywhere: `node scripts/i18n-extract.mjs`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'src', 'i18n', 'templates', 'content.en.json');

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

/** Non-empty string or undefined. */
const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

/** Array of non-empty strings (a line pool) or undefined. */
const pool = (v) =>
	Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.trim() !== '')
		? v
		: undefined;

/** Copy the given fields off a record, keeping only non-empty strings. */
function pick(rec, fields) {
	const out = {};
	for (const f of fields) {
		const v = str(rec[f]);
		if (v !== undefined) out[f] = v;
	}
	return out;
}

/** String-valued entries of a map, minus `_comment` doc keys. */
function proseMap(obj) {
	if (!obj || typeof obj !== 'object') return undefined;
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		if (k === '_comment') continue;
		const s = str(v);
		if (s !== undefined) out[k] = s;
	}
	return Object.keys(out).length ? out : undefined;
}

/** Drop empty objects; keep everything with at least one field. */
function put(bucket, id, entry) {
	if (entry && Object.keys(entry).length) bucket[id] = entry;
}

// ---------------------------------------------------------------------------
// Per-kind extractors. Translatable prose only: names, descriptions, facts,
// hints, flavor/guide text, labels. Ids, numbers, colors, id-arrays,
// requirement structures, source citations and scientific (Latin) names are
// deliberately skipped.
// ---------------------------------------------------------------------------

function extractRecords(files, fields, extra) {
	const bucket = {};
	for (const file of files) {
		for (const rec of readJson(file).records) {
			const entry = pick(rec, fields);
			if (extra) extra(rec, entry);
			put(bucket, rec.id, entry);
		}
	}
	return bucket;
}

const kinds = {
	animal: () =>
		extractRecords(
			['data/animals-1.json', 'data/animals-2.json'],
			['name', 'diet', 'shelter', 'preferredHabitat', 'fact', 'role'],
			(rec, entry) => {
				const hint = str(rec.requirements?.hint);
				if (hint) entry.hint = hint;
			},
		),

	biome: () =>
		extractRecords(['data/biomes.json'], ['name', 'description', 'restorationGoal'], (rec, entry) => {
			const label = str(rec.unlock?.label);
			if (label) entry.unlock = { label };
		}),

	recipe: () => extractRecords(['data/recipes.json'], ['name']),

	habitatObject: () => extractRecords(['data/habitat-objects.json'], ['name', 'description']),

	resource: () => extractRecords(['data/resources.json'], ['name']),

	tool: () =>
		extractRecords(['data/tools.json'], ['name', 'description'], (rec, entry) => {
			if (!Array.isArray(rec.tiers)) return;
			const tiers = {};
			for (const t of rec.tiers) put(tiers, String(t.tier), pick(t, ['name', 'effect']));
			if (Object.keys(tiers).length) entry.tiers = tiers;
		}),

	achievement: () => extractRecords(['data/achievements.json'], ['name', 'flavor', 'hint']),

	// weather.json is static config, not a records table: weather types carry a
	// display name + flavor line, per-biome educational "effects" prose, and
	// activity-feed line pools; seasons and day phases carry display labels
	// (+ per-biome season prose).
	weather: () => {
		const w = readJson('data/weather.json');
		const bucket = {};
		for (const [id, ty] of Object.entries(w.types ?? {})) {
			const entry = pick(ty, ['name', 'flavor']);
			const effect = proseMap(w.effects?.[id]);
			if (effect) entry.effect = effect;
			const feed = w.feed?.[id];
			if (feed) {
				const lines = {};
				const onArrive = pool(feed.onArrive);
				const overnight = pool(feed.overnight);
				if (onArrive) lines.onArrive = onArrive;
				if (overnight) lines.overnight = overnight;
				if (Object.keys(lines).length) entry.feed = lines;
			}
			put(bucket, id, entry);
		}
		const season = {};
		for (const [id, st] of Object.entries(w.seasonStyle ?? {})) {
			if (id === '_comment') continue;
			const entry = pick(st, ['label']);
			const effect = proseMap(w.seasonEffects?.[id]);
			if (effect) entry.effect = effect;
			put(season, id, entry);
		}
		if (Object.keys(season).length) bucket.season = season;
		const dayPhase = {};
		for (const [id, st] of Object.entries(w.dayPhaseStyle ?? {})) {
			if (id === '_comment') continue;
			put(dayPhase, id, pick(st, ['label']));
		}
		if (Object.keys(dayPhase).length) bucket.dayPhase = dayPhase;
		return bucket;
	},
};

// ---------------------------------------------------------------------------
// Build, sort, write, summarize.
// ---------------------------------------------------------------------------

/** Recursively sort object keys (arrays keep their order — they're pools). */
function sortDeep(v) {
	if (Array.isArray(v)) return v.map(sortDeep);
	if (v && typeof v === 'object') {
		const out = {};
		for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
		return out;
	}
	return v;
}

/** Count translatable leaves: each string is 1 field, each pool is 1 field. */
function countLeaves(v) {
	if (typeof v === 'string' || Array.isArray(v)) return 1;
	let n = 0;
	for (const child of Object.values(v)) n += countLeaves(child);
	return n;
}

const content = {};
for (const [kind, extract] of Object.entries(kinds)) content[kind] = extract();

const template = sortDeep({
	_readme:
		'GENERATED by `node scripts/i18n-extract.mjs` — do not edit by hand; the English source of truth is data/*.json. ' +
		'To translate: copy this file to src/i18n/<locale>/content.json, translate every string value (keys/ids stay as-is, keep {placeholders}, arrays are line pools), ' +
		'then register the locale in src/i18n/index.ts. Keys resolve as content.<kind>.<id>.<field> via content()/t() in src/i18n/core.ts; ' +
		'untranslated entries simply fall back to the English text in data/*.json, so partial files are safe.',
	content,
});

mkdirSync(dirname(OUT_PATH), { recursive: true });
const json = JSON.stringify(template, null, '\t') + '\n';
writeFileSync(OUT_PATH, json);

let totalRecords = 0;
let totalFields = 0;
console.log('i18n-extract: data/*.json -> src/i18n/templates/content.en.json');
for (const kind of Object.keys(template.content)) {
	const bucket = template.content[kind];
	const records = Object.keys(bucket).length;
	const fields = countLeaves(bucket);
	totalRecords += records;
	totalFields += fields;
	console.log(`  ${kind.padEnd(14)} ${String(records).padStart(4)} records  ${String(fields).padStart(5)} fields`);
}
console.log(
	`  ${'TOTAL'.padEnd(14)} ${String(totalRecords).padStart(4)} records  ${String(totalFields).padStart(5)} fields  (${(json.length / 1024).toFixed(1)} KB)`,
);

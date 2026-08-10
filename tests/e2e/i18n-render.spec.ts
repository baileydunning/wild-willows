import { test, expect, type Page } from '@playwright/test';

// Does every string actually RENDER — in English, in Spanish, and with "simpler
// wording" turned on?
//
// The static checks answer a different question. scripts/check-i18n.mjs proves
// every key a literal t() asks for exists, and tests/unit/i18n-es.test.ts proves
// es mirrors en key-for-key with the same {placeholder} tokens. Both are true of
// a build whose Spanish panels are half English, because core.ts falls back
// locale → en → key and never throws. The failure is only ever visible on screen:
// a raw key where a sentence should be, an unfilled {name}, a translated line
// that no longer fits the card it sits in.
//
// So this boots the real client in each mode and reads what's actually painted.
// Both switches are plain localStorage — `ww:locale` (src/i18n/index.ts) and the
// `simpleText` field of `ww:a11y` (src/prefs.ts) — read at boot, so no test hook
// is needed in the app.
//
// Deliberately NOT asserted here:
//
//   • Which title each panel shows — that is tests/e2e/solo.spec.ts's job, in one
//     language. This suite only cares that whatever renders is real, finished text.
//
//   • Layout. A first cut of this file measured every element against its panel
//     to catch a translated line pushing out of its card. It cannot work
//     generically: `.panel-body` is `overflow-y: auto`, which the browser coerces
//     `overflow-x` to `auto` as well, and `.tabs-scroll` scrolls horizontally on
//     purpose — so either the check flags legitimately-scrolled content (the
//     journal's locked biome tabs did exactly this, in English) or, once those
//     are exempted, it matches nothing at all and passes forever. A no-op that
//     looks like a safety net is worse than no check. Layout per locale belongs
//     in a targeted geometry test that knows which box should hold what, the way
//     tests/e2e/journal-overflow.spec.ts does for the field guide's cards.

interface Mode {
	id: string;
	locale: 'en' | 'es';
	simple: boolean;
	/** Title-screen labels, from src/i18n/<locale>/app.json. None of the three is
	 *  overridden in simple.json, so one set covers both wordings of a language. */
	newGame: string;
	begin: string;
	namePlaceholder: string;
}

const EN = { newGame: 'New Game', begin: 'Begin restoring', namePlaceholder: 'Caretaker name' };
const ES = { newGame: 'Nueva partida', begin: 'Comenzar a restaurar', namePlaceholder: 'Nombre de cuidador' };

const MODES: Mode[] = [
	{ id: 'English', locale: 'en', simple: false, ...EN },
	{ id: 'Spanish', locale: 'es', simple: false, ...ES },
	{ id: 'English + simpler wording', locale: 'en', simple: true, ...EN },
	{ id: 'Spanish + simpler wording', locale: 'es', simple: true, ...ES },
];

/** The panels reachable by key (src/keybindings.ts). */
const PANEL_KEYS = ['c', 'b', 'j', 'k', 't', 'm', 'g'];

/**
 * A catalog key that reached the screen. core.ts returns the KEY ITSELF when a
 * lookup misses in the active locale AND in en, so this is what a missing
 * translation looks like to a player. Anchored on the real catalog namespaces
 * (the src/i18n/<locale>/*.json filenames) and requiring two further dotted
 * segments, so ordinary prose that happens to end a sentence on "game." can't
 * trip it.
 */
const RAW_KEY = /\b(?:app|panels|server|game|narrative|simple|content)(?:\.[a-zA-Z0-9_-]+){2,}\b/;

/** t() leaves unknown placeholders visible on purpose (tests/unit/i18n.test.ts),
 *  so a `{name}` on screen means a caller forgot to pass one. */
const PLACEHOLDER = /\{[a-zA-Z][a-zA-Z0-9_]*\}/;

/** The other two ways a broken string reaches the screen intact. */
const EMPTY_VALUE = /\b(?:undefined|NaN)\b/;

/** Boot the app offline, in one language and wording. */
async function bootIn(page: Page, mode: Mode) {
	await page.addInitScript(
		({ locale, simple }) => {
			(window as any).wildWillowsDesktop = { isDesktop: true };
			localStorage.setItem('ww:locale', locale);
			// prefs.ts validates field by field against its defaults, so a partial
			// object is enough to flip one switch and leave the rest alone.
			localStorage.setItem('ww:a11y', JSON.stringify({ simpleText: simple }));
		},
		{ locale: mode.locale, simple: mode.simple },
	);
	await page.goto('/');
}

/** Boot, then start a save and stand in the meadow. */
async function newSaveIn(page: Page, mode: Mode, name: string) {
	await bootIn(page, mode);
	await page.getByRole('button', { name: mode.newGame }).click();
	await page.getByPlaceholder(mode.namePlaceholder).fill(name);
	await page.getByRole('button', { name: mode.begin }).click();
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
}

/** Escape closes the topmost layer, and a coach banner over a panel takes the
 *  first press — see the same helper in solo.spec.ts. */
async function closePanel(page: Page) {
	await page.keyboard.press('Escape');
	const closed = await page
		.locator('.panel')
		.waitFor({ state: 'detached', timeout: 1_500 })
		.then(
			() => true,
			() => false,
		);
	if (!closed) await page.keyboard.press('Escape');
}

/** Every unfinished string visible right now, with a little context each. */
async function unfinishedStrings(page: Page): Promise<string[]> {
	const text = await page.evaluate(() => document.body.innerText || '');
	const bad: string[] = [];
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		for (const [label, re] of [
			['untranslated key', RAW_KEY],
			['unfilled placeholder', PLACEHOLDER],
			['empty value', EMPTY_VALUE],
		] as const) {
			const m = trimmed.match(re);
			if (m) bad.push(`${label} "${m[0]}" in: ${trimmed.slice(0, 120)}`);
		}
	}
	return bad;
}

for (const mode of MODES) {
	test(`the title screen is fully translated — ${mode.id}`, async ({ page }) => {
		await bootIn(page, mode);

		// The localized label is the proof the locale took effect at all. Without
		// it, an English build would sail through every other assertion below.
		await expect(page.getByRole('button', { name: mode.newGame })).toBeEnabled();
		expect(await unfinishedStrings(page)).toEqual([]);
	});

	test(`every panel is fully translated — ${mode.id}`, async ({ page }) => {
		await newSaveIn(page, mode, 'i18n');

		// The HUD, meters and toolbelt, before any panel is opened.
		expect(await unfinishedStrings(page)).toEqual([]);

		for (const key of PANEL_KEYS) {
			await page.keyboard.press(key);
			await expect(page.locator('.panel')).toHaveCount(1);

			const problems = await unfinishedStrings(page);
			expect(problems, `panel "${key}" in ${mode.id}`).toEqual([]);

			await closePanel(page);
		}
	});
}

test('plain-language mode actually replaces the wording', async ({ page }) => {
	// A guard against the whole "simpler wording" half of this suite passing for
	// the wrong reason: if the overlay silently stopped being applied, every
	// simple-mode test above would still be green, because plain English is
	// perfectly valid English. So: same locale, same screen, both wordings, and
	// the words must differ somewhere.
	//
	// The title screen itself carries nothing to compare — it is four buttons and
	// a credit line, none of them overridden. "How to Play" is the nearest screen
	// that is: it opens without starting a save, and twelve of its strings are
	// rewritten in simple.json, `panels.help.intro` among them.
	const readHelp = async () => {
		await page.getByRole('button', { name: 'How to Play' }).click();
		const help = page.locator('.help-backdrop .panel');
		await expect(help).toBeVisible();
		return help.innerText(); // the reload below is what closes it again
	};

	await page.addInitScript(() => {
		(window as any).wildWillowsDesktop = { isDesktop: true };
		localStorage.setItem('ww:locale', 'en');
		localStorage.setItem('ww:a11y', JSON.stringify({ simpleText: false }));
	});
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
	const normal = await readHelp();

	// Prefs are read from localStorage at boot, so a reload is all it takes.
	await page.evaluate(() => localStorage.setItem('ww:a11y', JSON.stringify({ simpleText: true })));
	await page.reload();
	await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
	const simple = await readHelp();

	expect(simple, 'the plain-language overlay changed nothing in How to Play').not.toBe(normal);
	// The one hard-coded sentence in this suite, and the point of the whole
	// option: the opening line, rewritten short. If it gets reworded, this is the
	// line to update — that it is checked at all is what stops the overlay from
	// quietly detaching.
	expect(normal).toContain('A gentle loop');
	expect(simple).toContain('A calm loop');
});

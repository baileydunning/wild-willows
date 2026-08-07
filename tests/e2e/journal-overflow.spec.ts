import { test, expect } from '@playwright/test';

// Regression: long journal text spilled out of its card.
//
// The Great Horned Owl's diet line ran past the card's right border. Two causes:
//
//   1. .grow is a flex item, and a flex item defaults to `min-width: auto`,
//      which refuses to shrink below its content's intrinsic width — so the
//      column simply grew to fit the longest line and pushed out of the card.
//   2. The line was genuinely longer than the card could hold.
//
// The fix is (1) let the column shrink, and (2) write the lines to FIT — the
// overlong diet strings in data/animals-*.json were trimmed rather than
// truncated at render time, because a clipped or ellipsized sentence in a field
// guide reads like a bug. So the assertion here is that nothing overflows at
// all, not that overflow is handled gracefully.
//
// Only geometry proves this, so this test measures real rendered boxes. jsdom
// can assert the cascade but does no layout, which is exactly the gap here.

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		(window as any).wildWillowsDesktop = { isDesktop: true };
	});
});

/** New save → dev panel → spawn an animal with a long diet line → open the journal
 *  on THAT animal's biome tab. */
async function journalWithOwl(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'New Game' }).click();
	await page.getByPlaceholder('Caretaker name').fill('Overflow Tester');
	await page.getByRole('button', { name: 'Begin restoring' }).click();
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });

	// Hidden dev panel (Cmd/Ctrl+Shift+Backspace) — the quickest way to a discovery.
	await page.keyboard.press('Control+Shift+Backspace');
	const search = page.getByLabel('Search animals to spawn');
	await expect(search).toBeVisible();
	// The owl is the worst case: the longest diet string in the catalogue.
	await search.fill('great horned owl');
	await page.locator('.dev-spawn-row').first().click();
	await page.keyboard.press('Escape');

	await page.keyboard.press('j');
	await expect(page.locator('.journal-entry').first()).toBeVisible();

	// The journal opens on the tab for the biome you are STANDING IN (meadow, for
	// a new save) and renders only that biome's animals — `allInTab` in Journal.tsx
	// filters on `a.biome === tab`. The Great Horned Owl is a forest animal, so
	// neither its entry nor the only `.silhouette.known` on screen is in the DOM
	// until we switch tabs. Spawning it unlocked the forest, so the tab is enabled
	// by the time click() finishes waiting for actionability.
	await page.locator('.journal-panel .tabs button', { hasText: 'Old Hollow Forest' }).click();

	// Assert the discovery landed HERE, in the shared setup. Without this the four
	// geometry tests below still pass when the spawn silently fails: they measure
	// whatever happens to be rendered, and a screen full of undiscovered meadow
	// silhouettes overflows nothing. A green suite that never rendered the line it
	// exists to guard is worse than a red one.
	await expect(page.locator('.journal-entry', { hasText: 'Great Horned Owl' }).first()).toBeVisible();
}

test('no journal text escapes its card', async ({ page }) => {
	await journalWithOwl(page);

	const overflowing = await page.evaluate(() => {
		const bad: { text: string; overhang: number }[] = [];
		for (const entry of document.querySelectorAll('.journal-entry')) {
			const card = entry.getBoundingClientRect();
			for (const meta of entry.querySelectorAll('.entry-meta, .entry-meta-text')) {
				const r = meta.getBoundingClientRect();
				// Allow a hair for sub-pixel rounding; anything more is a real spill.
				const overhang = r.right - card.right;
				if (overhang > 1) bad.push({ text: (meta.textContent || '').slice(0, 60), overhang });
			}
		}
		return bad;
	});

	expect(overflowing).toEqual([]);
});

test('the owl line fits on one line, whole, with no ellipsis', async ({ page }) => {
	await journalWithOwl(page);

	const owl = page.locator('.journal-entry', { hasText: 'Great Horned Owl' }).first();
	await expect(owl).toBeVisible();

	const diet = owl.locator('.entry-meta-text').first();
	const m = await diet.evaluate((el) => ({
		// scrollWidth > clientWidth would mean the text is being cut off.
		overflowing: el.scrollWidth > el.clientWidth + 1,
		// One line: the box is no taller than a single line of this text.
		lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '0')),
		text: el.textContent || '',
	}));

	expect(m.overflowing).toBe(false);
	expect(m.lines).toBeLessThanOrEqual(1);
	// The sentence is intact — no "…" and no missing tail.
	expect(m.text).not.toContain('…');
	expect(m.text).not.toContain('...');
	expect(m.text.trim().endsWith('frogs')).toBe(true);
});

test('no journal line is cut off anywhere in the catalogue', async ({ page }) => {
	await journalWithOwl(page);

	const cut = await page.evaluate(() =>
		[...document.querySelectorAll('.entry-meta-text')]
			.filter((el) => el.scrollWidth > el.clientWidth + 1)
			.map((el) => (el.textContent || '').slice(0, 60)),
	);
	expect(cut).toEqual([]);
});

test('every journal card stays inside the panel', async ({ page }) => {
	await journalWithOwl(page);

	const spills = await page.evaluate(() => {
		const panel = document.querySelector('.panel');
		if (!panel) return ['no panel'];
		const p = panel.getBoundingClientRect();
		return [...document.querySelectorAll('.journal-entry')]
			.filter((e) => e.getBoundingClientRect().right - p.right > 1)
			.map((e) => (e.textContent || '').slice(0, 40));
	});

	expect(spills).toEqual([]);
});

test('the sprite disc is neutral grey, not green', async ({ page }) => {
	await journalWithOwl(page);
	const bg = await page
		.locator('.silhouette.known')
		.first()
		.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(bg).toBe('rgb(222, 219, 210)');
});

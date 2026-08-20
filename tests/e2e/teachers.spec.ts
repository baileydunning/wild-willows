import { test, expect, type Page } from '@playwright/test';

// /teachers, /teachers/science and /teachers/coding in a real browser.
//
// The hub's two kit cards are the reason this file exists. They are a grid of
// two cards whose text is not the same length, and the card pins its call to
// action to the bottom with `margin-top: auto` so the two buttons line up
// regardless. That worked in the stylesheet and not on the page: the button is
// a <p>, `.kit p` sets the margin SHORTHAND, and a single class does not outrank
// a class plus an element — so margin-top went back to 0 and the buttons sat
// forty pixels apart. Nothing but geometry catches that.

const cardGeometry = (page: Page, sel: string) =>
	page.evaluate(
		(s) =>
			[...document.querySelectorAll(s)].map((c) => {
				const card = c.getBoundingClientRect();
				const btn = c.querySelector('.btn')!.getBoundingClientRect();
				return { cardH: card.height, cardBottom: card.bottom, btnTop: btn.top, btnW: btn.width };
			}),
		sel,
	);

test.describe('the teachers hub', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/teachers');
	});

	test('leads to both kits, with the same call to action', async ({ page }) => {
		const links = page.locator('.kit .btn');
		await expect(links).toHaveCount(2);
		await expect(links.nth(0)).toHaveAttribute('href', '/teachers/science');
		await expect(links.nth(1)).toHaveAttribute('href', '/teachers/coding');
		for (const cls of await links.evaluateAll((els) => els.map((e) => e.className))) expect(cls).toContain('btn-go');
	});

	test('draws the two cards as one shape, whatever the text does', async ({ page }) => {
		for (const width of [1100, 1280, 1600]) {
			await page.setViewportSize({ width, height: 1000 });
			const [a, b] = await cardGeometry(page, '.kit');
			expect(Math.abs(a.cardH - b.cardH), `card heights at ${width}`).toBeLessThan(1);
			expect(Math.abs(a.cardBottom - b.cardBottom), `card bottoms at ${width}`).toBeLessThan(1);
			expect(Math.abs(a.btnTop - b.btnTop), `button tops at ${width}`).toBeLessThan(1);
			expect(Math.abs(a.btnW - b.btnW), `button widths at ${width}`).toBeLessThan(1);
		}
	});

	test('opens with every question closed', async ({ page }) => {
		const qs = page.locator('details.tfaq');
		await expect(qs).toHaveCount(6);
		expect(await qs.evaluateAll((els) => els.filter((e) => (e as HTMLDetailsElement).open).length)).toBe(0);
	});
});

test.describe('the /learn hub', () => {
	test('draws its two doors as one shape too', async ({ page }) => {
		// Same grid, same trap available; asserted for the same reason.
		await page.goto('/learn');
		const [a, b] = await cardGeometry(page, '.door');
		expect(Math.abs(a.cardH - b.cardH)).toBeLessThan(1);
		expect(Math.abs(a.btnTop - b.btnTop)).toBeLessThan(1);
		expect(Math.abs(a.btnW - b.btnW)).toBeLessThan(1);
	});
});

test.describe('the two kit pages', () => {
	test('the science page is the same shape as the coding one', async ({ page }) => {
		// It used to be a marketing page with its own 400-line copy of the landing
		// stylesheet. Asserting the shell rather than the words: same body classes,
		// same wrapper, same section component, and none of the old furniture.
		await page.goto('/teachers/science');
		await expect(page.locator('body')).toHaveClass('edu-hub guide');
		await expect(page.locator('.twrap')).toHaveCount(1);
		await expect(page.locator('.thero h1')).toContainText('Restore a damaged meadow');
		await expect(page.locator('.reassure')).toHaveCount(1);
		await expect(page.locator('.band, .hero-scene, .arc, .dl, #lb')).toHaveCount(0);
		await expect(page.locator('a[href="/teachers"]').first()).toBeVisible();
		await expect(page.locator('a[href="/teachers/coding"]').first()).toBeVisible();
	});

	test('and carries what a teacher actually needs', async ({ page }) => {
		await page.goto('/teachers/science');
		const ids = await page.locator('section.tsec[id]').evaluateAll((els) => els.map((e) => e.id));
		for (const id of [
			'objectives',
			'vocab',
			'prep',
			'flow',
			'ladder',
			'cut',
			'opener',
			'assessment',
			'trouble',
			'answers',
			'practical',
			'privacy',
		])
			expect(ids, id).toContain(id);
		// Nothing opens pre-expanded, including the answer key.
		expect(
			await page.locator('details.tfaq').evaluateAll((els) => els.filter((e) => (e as HTMLDetailsElement).open).length),
		).toBe(0);
	});

	test('the arrival ladder is the whole meadow, in order', async ({ page }) => {
		// Generated from data/animals-*.json, so it cannot drift from the game. The
		// ordering is the claim the section makes in prose, so it gets asserted.
		await page.goto('/teachers/science');
		const rows = page.locator('#ladder table tbody tr');
		await expect(rows).toHaveCount(25);
		const health = await rows.evaluateAll((els) => els.map((r) => parseInt(r.cells[2].textContent, 10)));
		expect(health).toEqual([...health].sort((a, b) => a - b));
		expect(health[0]).toBe(8);
		expect(health[health.length - 1]).toBe(80);
		// The row the troubleshooting table sends teachers to.
		const fox = rows.filter({ hasText: 'Red Fox' }).first();
		await expect(fox).toContainText('Cottontail Rabbit');
		await expect(fox).toContainText('Prairie Vole');
	});

	test('the coding guide opens on the reassurance and reaches the lesson', async ({ page }) => {
		await page.goto('/teachers/coding');
		await expect(page.locator('h1')).toContainText('Build a webpage with real game data');
		await expect(page.locator('.reassure')).toContainText('do not need to know JavaScript');
		await expect(page.locator('a[href="/learn/web-development"]').first()).toBeVisible();
		for (const id of [
			'objectives',
			'vocab',
			'prep',
			'flow',
			'cut',
			'opener',
			'assessment',
			'trouble',
			'answers',
			'privacy',
		])
			await expect(page.locator(`#${id}`), id).toHaveCount(1);
	});
});

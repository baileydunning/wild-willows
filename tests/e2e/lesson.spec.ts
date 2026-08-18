import { test, expect, type Page } from '@playwright/test';

// /learn/web-development in a real browser.
//
// The lesson page is mostly prose, and prose does not need a browser to check.
// What is here is the part that only exists once the page is laid out and the
// component has booted, which is where its bugs have actually been:
//
//   • the editors grew with the file instead of scrolling, because nothing on
//     this page bounds their height the way the builder's column does;
//   • the chapter rail highlighted nothing at the top of the page;
//   • the Going Deeper panel's runners must not boot until it is opened.
//
// None of those are visible in the bytes. All three are one assertion here.

const LESSON = '/learn/web-development';

const runnerHeights = (page: Page) =>
	page.$$eval('.ch ww-runner .wwr-body', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => window.localStorage.clear());
	await page.goto(LESSON);
	await expect(page.locator('#chapter-1 ww-runner.wwr')).toBeVisible();
});

test.describe('the editors are boxes, not pages', () => {
	test('a long file scrolls instead of growing the card', async ({ page }) => {
		// THE BUG. On the builder a full-height flex column bounds the card; the
		// lesson has no such column, so the grid row sized to its content and a
		// 120-line file produced a 2483px editor inside a 761px window, with the
		// preview stranded somewhere off screen beside it. The textarea never
		// scrolled because it never had to.
		const host = page.locator('#chapter-10 > ww-runner');
		const body = host.locator('.wwr-body');
		const before = (await body.boundingBox())!.height;

		// Chapter 10 is a three-file runner, so there are three textareas and only
		// one of them is on screen.
		const area = host.locator('textarea.wwr-code:visible');
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill(Array.from({ length: 120 }, (_, i) => `const line${i} = ${i};`).join('\n'));
		await page.waitForTimeout(1200);

		// The EDITOR BOX, not the whole card: the card also carries a toolbar and a
		// console pane, which are fixed chrome and not what the cap is about.
		const after = (await body.boundingBox())!.height;
		expect(after).toBeCloseTo(before, 0);
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight)).toBe(true);
	});

	test('a long line scrolls sideways rather than rewrapping', async ({ page }) => {
		// `white-space: pre` on purpose: a student cannot see that their line is
		// 200 characters long if the editor quietly wraps it.
		const area = page.locator('#chapter-10 > ww-runner textarea.wwr-code:visible');
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill(`const long = "${'x'.repeat(300)}";`);
		await page.waitForTimeout(800);
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.scrollWidth > el.clientWidth)).toBe(true);
	});

	test('the line numbers follow the code', async ({ page }) => {
		const host = page.locator('#chapter-10 > ww-runner');
		const area = host.locator('textarea.wwr-code:visible');
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill(Array.from({ length: 120 }, (_, i) => `// line ${i}`).join('\n'));
		await page.waitForTimeout(1000);
		await area.evaluate((el: HTMLTextAreaElement) => {
			el.scrollTop = 900;
			el.dispatchEvent(new Event('scroll'));
		});
		const gutter = host.locator('.wwr-gutter');
		expect(await gutter.evaluate((el) => Math.round(el.scrollTop))).toBe(900);
	});

	test('every runner on the page starts inside the same box', async ({ page }) => {
		const heights = await runnerHeights(page);
		expect(heights.length).toBeGreaterThan(20);
		for (const h of heights) expect(h).toBeLessThanOrEqual(420);
	});
});

test.describe('the chapter rail', () => {
	test('marks a chapter before you have scrolled anywhere', async ({ page }) => {
		// Ranking sections by intersection ratio has a hole at the top of the
		// page: standing at the hero, nothing intersects and every ratio is zero,
		// so the rail highlighted nothing at all.
		await expect(page.locator('.lrail a.is-current')).toHaveCount(1);
		await expect(page.locator('.lrail a.is-current')).toHaveAttribute('data-ch', '1');
	});

	test('follows the reader down the page', async ({ page }) => {
		// The rule, asserted rather than a chapter number at a scroll offset: the
		// runners change the page height as their previews load, so an offset is
		// not a stable thing to assert against.
		for (const id of ['#chapter-6', '#chapter-10']) {
			await page.locator(id).scrollIntoViewIfNeeded();
			await page.waitForTimeout(400);
			await page.locator(id).scrollIntoViewIfNeeded();
			await page.waitForTimeout(400);
			const { expected, actual } = await page.evaluate(() => {
				let expected = 0;
				document.querySelectorAll('.ch[id^=chapter-]').forEach((s) => {
					if (s.getBoundingClientRect().top - 96 <= 0) expected = Number(s.id.replace('chapter-', ''));
				});
				const el = document.querySelector('.lrail a.is-current');
				return { expected: expected || 1, actual: Number(el?.getAttribute('data-ch')) };
			});
			expect(actual, `at ${id}`).toBe(expected);
		}
	});
});

test.describe('the rail shows progress without hiding the order', () => {
	test('a finished chapter keeps its number and gains a tick', async ({ page }) => {
		// The tick used to REPLACE the number, so a finished chapter lost the one
		// thing saying where it sits in the order and the rail became a column of
		// ticks and gaps. Both, now, in their own columns.
		await page.locator('#chapter-4').scrollIntoViewIfNeeded();
		await page.waitForTimeout(500);
		await page.locator('#chapter-4').scrollIntoViewIfNeeded();
		await page.waitForTimeout(500);

		const rows = await page.$$eval('.lrail a', (els) =>
			els.map((a) => ({
				n: a.getAttribute('data-ch'),
				numText: a.querySelector('.rnum')!.textContent!.trim(),
				numVisible: getComputedStyle(a.querySelector('.rnum')!).color !== 'rgba(0, 0, 0, 0)',
				tick: getComputedStyle(a, '::after').opacity,
				done: a.classList.contains('is-done'),
			})),
		);

		expect(rows).toHaveLength(10);
		for (const r of rows) {
			expect(r.numText, `chapter ${r.n} should show its number`).toBe(r.n);
			expect(r.numVisible, `chapter ${r.n} number should not be transparent`).toBe(true);
			expect(r.tick, `chapter ${r.n} tick`).toBe(r.done ? '1' : '0');
		}
		// …and something is actually finished by now, or this proves nothing.
		expect(rows.filter((r) => r.done).length).toBeGreaterThan(0);
	});

	test('the tick column is reserved, so rows do not shift when completed', async ({ page }) => {
		const before = await page.$eval('.lrail a[data-ch="9"] .rnum', (e) => e.getBoundingClientRect().left);
		await page.locator('#chapter-10').scrollIntoViewIfNeeded();
		await page.waitForTimeout(600);
		const after = await page.$eval('.lrail a[data-ch="9"] .rnum', (e) => e.getBoundingClientRect().left);
		expect(after).toBeCloseTo(before, 0);
	});
});

test.describe('Going Deeper, one panel per chapter', () => {
	test('every chapter has one, closed, with nothing booted', async ({ page }) => {
		await expect(page.locator('details.deeper')).toHaveCount(10);
		await expect(page.locator('details.deeper[open]')).toHaveCount(0);
		await expect(page.locator('ww-runner[defer]')).toHaveCount(10);
		await expect(page.locator('details.deeper iframe')).toHaveCount(0);
		// The material is in the DOM regardless, so find-in-page still reaches it.
		await expect(page.locator('[data-deeper="chapter-6"]')).toContainText('Recursion');
	});

	test('each panel belongs to the chapter it sits in', async ({ page }) => {
		const pairs = await page.$$eval('details.deeper', (els) =>
			els.map((e) => [e.getAttribute('data-deeper'), e.closest('.ch')!.id]),
		);
		for (const [attr, id] of pairs) expect(attr).toBe(id);
	});

	test('opening one mounts its own runners and nobody else’s', async ({ page }) => {
		await page.locator('[data-deeper="chapter-8"] > summary').click();
		await expect(page.locator('[data-deeper="chapter-8"] ww-runner.wwr')).toHaveCount(4);
		await expect(page.locator('details.deeper ww-runner.wwr--failed')).toHaveCount(0);
		// The other panels are untouched, which is the whole reason for `defer`.
		await expect(page.locator('ww-runner[defer]')).toHaveCount(6);
	});

	test('closing and reopening does not build a second copy', async ({ page }) => {
		const summary = page.locator('[data-deeper="chapter-2"] > summary');
		await summary.click();
		await expect(page.locator('[data-deeper="chapter-2"] ww-runner.wwr')).toHaveCount(3);
		await summary.click();
		await summary.click();
		await expect(page.locator('[data-deeper="chapter-2"] ww-runner.wwr')).toHaveCount(3);
	});
});

test.describe('the file picker', () => {
	test('the chapters that ask you to edit three files offer three files', async ({ page }) => {
		// Chapter 10's challenges say "it is in index.html" and "that one is in
		// styles.css". Those files were context-only, so the runner exposed main.js
		// and nothing else, and two of the five challenges could not be done at all.
		const tabs = await page.$$eval('#chapter-10 > ww-runner .wwr-tab', (els) => els.map((e) => e.textContent!.trim()));
		expect(tabs).toEqual(['index.html', 'styles.css', 'main.js']);
	});

	test('clicking a tab shows that file', async ({ page }) => {
		await page.locator('#chapter-10 > ww-runner').getByRole('tab', { name: 'styles.css', exact: true }).click();
		const area = page.locator('#chapter-10 > ww-runner textarea.wwr-code:visible');
		await expect(area).toHaveCount(1);
		await expect(area).toHaveValue(/font-family|body/);
	});
});

test.describe('the data the lesson is written around', () => {
	test('chapter 10 renders real animals from the API', async ({ page }) => {
		// The end of the whole chain: fetch, filter, map, join, innerHTML. If the
		// CORS header on /GameData/ is ever dropped, this is what says so.
		const frame = page.frameLocator('#chapter-10 iframe.wwr-preview.is-live');
		await expect(frame.locator('#animal-list li')).toHaveCount(25);
	});
});

test.describe('the file tabs', () => {
	test('show an icon and keep the filename for anyone who cannot see it', async ({ page }) => {
		// Three filenames took about a third of the toolbar on a three-file runner
		// and pushed Run onto a second row, which moves the one control a student
		// needs most to somewhere they are not looking. The name is still the tab's
		// accessible name and its tooltip; only the on-screen label is a shape.
		const tabs = page.locator('#chapter-10 > ww-runner .wwr-tab');
		await expect(tabs).toHaveCount(3);
		for (const name of ['index.html', 'styles.css', 'main.js'])
			await expect(page.getByRole('tab', { name, exact: true }).first()).toBeVisible();

		const shown = await page.$$eval('#chapter-10 > ww-runner .wwr-tab', (els) =>
			els.map((t) => ({
				icon: getComputedStyle(t.querySelector('.wwr-tab-ico')!).display,
				nameWidth: Math.round(t.querySelector('.wwr-tab-name')!.getBoundingClientRect().width),
				title: (t as HTMLElement).title,
			})),
		);
		for (const t of shown) {
			expect(t.icon).toBe('block');
			expect(t.nameWidth).toBeLessThanOrEqual(1);
			expect(t.title).toMatch(/\.(html|css|js)$/);
		}
	});

	test('the toolbar stays on one row', async ({ page }) => {
		const bar = page.locator('#chapter-10 > ww-runner .wwr-bar');
		expect((await bar.boundingBox())!.height).toBeLessThan(56);
	});
});

test.describe('a phone', () => {
	// The lesson works here, and that is the deliberate half of the split: its
	// examples are a dozen lines, most chapters are read rather than typed, and a
	// student getting through chapter 4 on a bus is a win.
	test.use({ viewport: { width: 390, height: 844 } });

	test('still gives every chapter a working editor', async ({ page }) => {
		await page.goto(LESSON);
		const area = page.locator('#chapter-1 ww-runner textarea.wwr-code').first();
		await expect(area).toBeVisible();
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.readOnly)).toBe(false);
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill('<h1>typed on a phone</h1>');
		await page.waitForTimeout(1200);
		const frame = page.frameLocator('#chapter-1 iframe.wwr-preview.is-live').first();
		await expect(frame.locator('h1')).toHaveText('typed on a phone');
	});

	test('stacks the panes and gives the preview real height', async ({ page }) => {
		// The preview used to be 0px tall here: one column but still one explicit
		// grid row, so it landed in an implicit row sized to nothing.
		await page.goto(LESSON);
		const code = await page.locator('#chapter-1 ww-runner .wwr-panes').first().boundingBox();
		const preview = await page.locator('#chapter-1 ww-runner .wwr-out').first().boundingBox();
		expect(preview!.height).toBeGreaterThan(120);
		expect(code!.height).toBeGreaterThan(120);
		expect(preview!.y).toBeGreaterThan(code!.y); // stacked, not side by side
	});

	test('does not scroll sideways', async ({ page }) => {
		await page.goto(LESSON);
		const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(over).toBeLessThanOrEqual(2);
	});
});

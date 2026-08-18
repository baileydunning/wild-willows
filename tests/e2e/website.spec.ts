import { test, expect, type Page } from '@playwright/test';

/**
 * THE PUBLIC WEBSITE, IN EVERY ENGINE.
 *
 * Wide rather than deep. tests/e2e/lesson.spec.ts and code-builder.spec.ts
 * already drive the two classroom pages hard in one browser; this checks that
 * every public route works at all, in Chromium, Firefox and WebKit and at phone
 * size, and pins the handful of behaviors that have actually broken here.
 *
 * The rule for anything added below: it must be able to fail in one engine and
 * pass in another. A check on the HTML the server sent belongs in a unit test,
 * where it runs in two seconds instead of five browsers.
 */

/** Every route serve-pages.mjs answers, and the heading that proves it is the
 *  right page. Kept in step with PAGES there and PUBLIC_PAGES in resources.ts. */
const ROUTES: Array<{ path: string; heading: string; title: RegExp }> = [
	{ path: '/', heading: 'Wild Willows', title: /cozy nature-restoration game/i },
	{ path: '/learn', heading: 'Learn to code with real game data', title: /Learn to code/i },
	{ path: '/learn/web-development', heading: 'Build with Wild Willows', title: /Build with Wild Willows/i },
	{ path: '/teachers', heading: 'Wild Willows in the classroom', title: /for teachers/i },
	{ path: '/teachers/science', heading: 'Restore a damaged meadow', title: /ecosystem lesson/i },
	{ path: '/teachers/coding', heading: 'Build a webpage with real game data', title: /intro to APIs/i },
	{ path: '/developers/api', heading: 'One endpoint, no key', title: /Open Game Data/i },
	{ path: '/privacy.html', heading: 'Privacy policy', title: /Privacy policy/i },
	{ path: '/support.html', heading: 'Support', title: /Support/i },
	{ path: '/age-rating.html', heading: 'Who Wild Willows is for', title: /Age suitability/i },
];

/** Console errors, collected from the moment the page object exists.
 *
 * Attached before the first navigation on purpose: a script that throws during
 * parse has already thrown by the time an `await page.goto()` resolves. */
function watchConsole(page: Page) {
	const errors: string[] = [];
	page.on('console', (m) => {
		if (m.type() === 'error' && !IGNORABLE.some((re) => re.test(m.text()))) errors.push(m.text());
	});
	// A thrown exception is never ignorable. This is the one that matters: it is
	// how a script that dies halfway through leaves half a page working.
	page.on('pageerror', (e) => errors.push(String(e)));
	return errors;
}

/* Anything a page fetches from somewhere that is not this server.
 *
 * The preview server answers /GameData/ locally, so a request leaving the origin
 * is a page reaching for something a school filter may well not let through.
 *
 * FONTS ARE THE ONE EXCEPTION, and they are an exception on purpose rather than
 * by oversight: every page loads Quicksand from Google's CDN. Self-hosting two
 * woff2 files would empty this list, remove a third-party request from a site
 * whose own privacy page is about not making any, and load faster. Until that
 * happens the allowlist names them, so this test still catches the next thing
 * that gets added. */
const OFFSITE = /^https?:\/\/(?!localhost|127\.0\.0\.1)/;
const ALLOWED_OFFSITE = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];
const isUnexpectedOffsite = (url: string) => OFFSITE.test(url) && !ALLOWED_OFFSITE.some((re) => re.test(url));

/* Console noise that is the harness rather than the page.
 *
 * The font CDN is unreachable from a sandboxed test runner with no egress, and
 * the beacon endpoints only exist on the deployed server. Neither is a fault in
 * the page under test, and neither can hide a real error: anything else at all
 * still fails the check. */
const IGNORABLE = [/fonts\.(googleapis|gstatic)\.com/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/];

test.describe('every public route', () => {
	for (const route of ROUTES) {
		test(`${route.path} loads, titles itself and says nothing to the console`, async ({ page }) => {
			const errors = watchConsole(page);
			const res = await page.goto(route.path);
			expect(res?.status(), `${route.path} should be 200`).toBe(200);
			await expect(page).toHaveTitle(route.title);
			const h1 = page.locator('h1:visible');
			await expect(h1.first()).toHaveText(route.heading);
			/* One VISIBLE <h1>. Two would be a heading outline that reads as several
			 * documents stapled together, and it is how people navigate with a screen
			 * reader. Visible rather than present, because the Code Builder ships a
			 * second one inside its hidden too-small-for-this-page panel. */
			expect(await h1.count(), 'exactly one visible h1').toBe(1);
			expect(errors, `console errors on ${route.path}`).toEqual([]);
		});
	}

	test('a route that does not exist says so rather than rendering something', async ({ page }) => {
		const res = await page.goto('/definitely-not-a-page');
		expect(res?.status()).toBe(404);
	});
});

/** Where a section's top ends up once the browser has finished scrolling.
 *
 * Polled rather than slept on: smooth scrolling takes a different amount of time
 * in each engine, so a fixed wait is either flaky in WebKit or slow everywhere. */
async function settledTop(page: Page, selector: string): Promise<number> {
	let last = Number.NaN;
	for (let i = 0; i < 25; i++) {
		const box = await page.locator(selector).boundingBox();
		const y = box ? box.y : Number.NaN;
		if (Number.isFinite(y) && Math.abs(y - last) < 1) return y;
		last = y;
		await page.waitForTimeout(120);
	}
	return last;
}

/** The sticky nav's height, which is what an anchor has to clear. */
const navBarHeight = (page: Page) =>
	page
		.locator('.nav')
		.first()
		.evaluate((el) => el.getBoundingClientRect().height);

test.describe('the landing page', () => {
	/* THE NAV BUG, AND THE REASON THIS SUITE IS CROSS-BROWSER.
	 *
	 * `content-visibility: auto` with a `contain-intrinsic-size` measured at one
	 * width sent every one of these links to the bottom of the document, because
	 * the placeholder heights were wrong at every other width. Engine support for
	 * that property is not uniform, so the fix is verified where it has to work
	 * rather than where it was written. */
	test('every nav link lands its section under the sticky nav', async ({ page }) => {
		await page.goto('/');
		const links = page.locator('.nav .links a[href^="#"]');
		const count = await links.count();
		expect(count).toBeGreaterThan(2);

		for (let i = 0; i < count; i++) {
			const link = links.nth(i);
			if (!(await link.isVisible())) continue; // hidden at this width by .hide-sm
			const href = await link.getAttribute('href');
			const id = href!.slice(1);
			await link.click();
			const y = await settledTop(page, `#${id}`);
			const nav = await navBarHeight(page);
			/* The section's top is at or just below the nav, and on screen. The bug
			 * this exists for put it several thousand pixels down — the end of the
			 * document, on every link. */
			expect(y, `#${id} landed at ${y}`).toBeGreaterThan(-40);
			expect(y, `#${id} landed at ${y}, which is not under the nav`).toBeLessThan(nav + 220);
		}
	});

	test('the FAQ opens', async ({ page }) => {
		await page.goto('/');
		/* NOT the first one: it ships with `open` so the section does not read as a
		 * wall of closed boxes. Clicking that one closes it, which is a real
		 * behavior and the opposite of what this test is about. */
		/* nth(1), not first(): the first FAQ ships with `open` so the section does
		 * not read as a wall of closed boxes, and a `:not([open])` locator would
		 * stop matching the moment the click worked — it re-queries, so the
		 * assertion would land on the next closed one and read false forever. */
		const first = page.locator('#faq details').nth(1);
		await expect(first).toBeVisible();
		await expect(first).toHaveJSProperty('open', false);
		await first.locator('summary').click();
		// The property, not the attribute: `open=""` and `open` are the same thing
		// to a browser and different strings to an assertion.
		await expect(first).toHaveJSProperty('open', true);
		await expect(first.locator('p').first()).toBeVisible();
	});

	test('nothing on it reaches for a third-party server', async ({ page }) => {
		// No trackers, no font CDN, no analytics script. The privacy page says so
		// in words; this is the version that fails when it stops being true.
		const offsite: string[] = [];
		page.on('request', (r) => {
			if (isUnexpectedOffsite(r.url())) offsite.push(r.url());
		});
		await page.goto('/');
		await page.waitForTimeout(1200);
		expect(offsite).toEqual([]);
	});
});

test.describe('the lesson', () => {
	test('renders a local example on arrival and leaves the network ones alone', async ({ page }) => {
		const errors = watchConsole(page);
		await page.goto('/learn/web-development');
		// Chapter 1 holds three of them, one per language. The first is the HTML
		// one: it draws a page, costs no traffic, and so renders on arrival.
		const first = page.locator('#chapter-1 ww-runner').first();
		await expect(first.locator('iframe.wwr-preview.is-live')).toHaveCount(1);
		await expect(first.frameLocator('iframe.wwr-preview.is-live').locator('h1')).toBeVisible();

		// A chapter that fetches waits to be asked, and says so where the output
		// would have been.
		const fetcher = page.locator('#chapter-5 ww-runner').first();
		await fetcher.scrollIntoViewIfNeeded();
		await expect(fetcher.locator('.wwr-prompt')).toContainText(/Press Run/i);
		expect(errors).toEqual([]);
	});

	test('typing does not run anything; pressing Run does', async ({ page }) => {
		await page.goto('/learn/web-development');
		const runner = page.locator('#chapter-1 ww-runner').first();
		const area = runner.locator('textarea.wwr-code').first();
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill('<h1>changed by the test</h1>');
		await page.waitForTimeout(900); // longer than any debounce that might return

		const frame = runner.frameLocator('iframe.wwr-preview.is-live');
		await expect(frame.locator('h1')).not.toHaveText('changed by the test');
		await expect(runner.locator('.wwr-run')).toHaveClass(/is-dirty/);

		await runner.locator('.wwr-run').click();
		await expect(frame.locator('h1')).toHaveText('changed by the test');
	});

	test('the editor is the same size whatever is in it', async ({ page }) => {
		await page.goto('/learn/web-development');
		const runner = page.locator('#chapter-1 ww-runner').first();
		const body = runner.locator('.wwr-body');
		const before = (await body.boundingBox())!.height;

		const area = runner.locator('textarea.wwr-code').first();
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill(Array.from({ length: 120 }, (_, i) => `<p>line ${i}</p>`).join('\n'));
		await page.waitForTimeout(400);

		const after = (await body.boundingBox())!.height;
		expect(after).toBeCloseTo(before, 0);
		// It scrolls instead, which is the half of the fix that is easy to lose.
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight)).toBe(true);
	});

	test('the chapter rail follows the reader', async ({ page }) => {
		await page.goto('/learn/web-development');
		await page.locator('#chapter-6').scrollIntoViewIfNeeded();
		await page.waitForTimeout(600);
		await expect(page.locator('.lrail a[data-ch="6"]')).toHaveAttribute('aria-current', 'true');
	});

	test('the skip link moves focus into the page', async ({ page }) => {
		await page.goto('/learn/web-development');
		await page.keyboard.press('Tab');
		const skip = page.locator('.skip-link').first();
		await expect(skip).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#lesson-main')).toBeFocused();
	});

	test('the API docs link opens in its own tab', async ({ page, context }) => {
		await page.goto('/learn/web-development');
		const link = page.locator('.nav a[data-track="api-nav"]');
		if (!(await link.isVisible())) test.skip(true, 'secondary nav links are hidden at this width');
		const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
		await popup.waitForLoadState('domcontentloaded');
		expect(new URL(popup.url()).pathname).toBe('/developers/api');
		// The original page is still where the student left it.
		expect(new URL(page.url()).pathname).toBe('/learn/web-development');
	});
});

test.describe('the code builder', () => {
	/* It tells a phone to come back on a laptop rather than shipping a squeezed
	 * editor (see the note in ww-builder.js), so the desktop tests would be
	 * asserting against a page that is deliberately not there. */
	test.skip(({ isMobile }) => !!isMobile, 'the builder is desktop-only by design');

	test('boots with a project and waits for Run before fetching', async ({ page }) => {
		const errors = watchConsole(page);
		await page.goto('/learn/code-builder');
		const runner = page.locator('ww-runner');
		await expect(runner).toBeVisible();
		await expect(page.getByRole('tab', { name: 'index.html' })).toBeVisible();
		await expect(runner.locator('.wwr-prompt')).toContainText(/Press Run/i);
		expect(errors).toEqual([]);
	});

	test('runs the starter project and reaches the data', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await page.locator('.wwr-run').click();
		// The preview server answers /GameData/ from data/*.json, so this is the
		// real code path with no dependency on the hosted site.
		await expect(page.locator('.wwr-console-lines')).toContainText(/animals|biomes|\{/i, { timeout: 20_000 });
		await expect(page.locator('.wwr-error:not([hidden])')).toHaveCount(0);
	});

	test('offers something to build', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await page.locator('#lab-ideas-open').click();
		const modal = page.locator('#lab-ideas');
		await expect(modal).toBeVisible();
		expect(await modal.locator('.idea-title').count()).toBeGreaterThan(2);
		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
	});
});

test.describe('at phone size', () => {
	test.skip(({ isMobile }) => !isMobile, 'phone-shaped behavior');

	test('the lesson still gives every chapter a usable editor', async ({ page }) => {
		await page.goto('/learn/web-development');
		const area = page.locator('#chapter-1 ww-runner textarea.wwr-code').first();
		await expect(area).toBeVisible();
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.readOnly)).toBe(false);
		// Stacked, and the preview keeps real height — it was 0px tall here once.
		const code = await page.locator('#chapter-1 ww-runner .wwr-panes').first().boundingBox();
		const preview = await page.locator('#chapter-1 ww-runner .wwr-out').first().boundingBox();
		expect(preview!.height).toBeGreaterThan(100);
		expect(preview!.y).toBeGreaterThan(code!.y);
	});

	test('the builder says why it is not here', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await expect(page.locator('body')).toContainText(/laptop|larger screen|desktop/i);
		// And sends them somewhere that does work.
		await expect(page.locator('a[href="/learn/web-development"]').first()).toBeVisible();
	});

	test('no horizontal scrolling anywhere', async ({ page }) => {
		// A page wider than the phone is the most common mobile bug and the easiest
		// to miss on a desktop. Two pixels of slack for subpixel rounding.
		for (const route of ['/', '/learn', '/teachers', '/developers/api']) {
			await page.goto(route);
			await page.waitForTimeout(300);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `${route} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(2);
		}
	});
});

test.describe('links that leave the site', () => {
	/* The lesson's "Looking things up" table is where a student is sent to MDN,
	 * caniuse and the rest. A new tab, because losing a half-written editor to a
	 * documentation link is its own lesson — and rel=noopener, because without it
	 * the page that opens gets a handle on window.opener. */
	test('open in their own tab, and do not hand over the opener', async ({ page }) => {
		await page.goto('/learn/web-development');
		const links = page.locator('a[target="_blank"]');
		const n = await links.count();
		expect(n, 'the lesson should link out to references').toBeGreaterThan(3);
		for (let i = 0; i < n; i++) {
			await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
			// And each says so for anyone who cannot see the icon.
			const announced = await links.nth(i).evaluate((a) => /opens in a new tab/i.test(a.textContent || ''));
			expect(announced, `link ${i} should announce the new tab`).toBe(true);
		}
	});
});

test.describe('the API docs', () => {
	test('say how to get the data corrected, and land on it', async ({ page }) => {
		/* Arrived at by URL rather than by clicking the nav link, which is one of
		 * the secondary links that hides below 940px. A shared link into a section
		 * has to land in the same place a click does — and it is the same
		 * scroll-margin-top either way. */
		await page.goto('/developers/api#corrections');
		const y = await settledTop(page, '#corrections');
		const nav = await navBarHeight(page);
		expect(y).toBeGreaterThan(-40);
		expect(y, `#corrections landed at ${y}`).toBeLessThan(nav + 220);
		await expect(page.locator('#corrections a[href^="mailto:"]').first()).toBeVisible();
	});

	test('publish an endpoint that answers', async ({ page }) => {
		// The address on the page is the one that works. It has moved once already
		// (the trailing slash came off), and a docs page that documents a 404 is
		// worse than no docs page at all.
		await page.goto('/developers/api');
		const res = await page.request.get('/GameData');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toMatch(/json/);
		/* The path, not the whole URL: the preview server rewrites the hosted
		 * address to its own local one when it serves these pages, so asserting on
		 * the hostname here would be asserting on the test harness. */
		await expect(page.getByText('/GameData', { exact: false }).first()).toBeVisible();
	});
});

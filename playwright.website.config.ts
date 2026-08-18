import { defineConfig, devices } from '@playwright/test';

/**
 * The public website, in every engine that renders it.
 *
 * WHY THIS IS SEPARATE FROM THE OTHER TWO CONFIGS. playwright.config.ts drives
 * the built game through `vite preview` — a three-minute build these pages have
 * nothing to do with. playwright.classroom.config.ts drives the two classroom
 * pages in one browser, deeply. This one is wide rather than deep: every public
 * route, the handful of things on each that can actually break, run against
 * Chromium, Firefox and WebKit plus two phone-sized viewports.
 *
 * WHY IT EXISTS. Everything shipped here is hand-written HTML and CSS with no
 * framework and no build step, which is a deliberate choice and it moves the
 * risk somewhere specific: nothing normalizes the differences between engines,
 * so a rule that works in Chrome and not in Safari ships silently. The bugs
 * this suite is shaped around are all real ones from this codebase:
 *
 *   • `content-visibility: auto` with a measured `contain-intrinsic-size` sent
 *     every landing-page nav link to the bottom of the document. Engine support
 *     for that property differs, so "the anchor lands its heading" is checked in
 *     each of them rather than argued about.
 *   • A sticky nav plus an anchor needs `scroll-margin-top`, and it was missing
 *     on three of the four guide pages.
 *   • The theme toggle writes localStorage and re-reads it before paint. A
 *     cream flash on reload is a Safari-shaped bug.
 *   • The runner's preview is a sandboxed iframe with no same-origin access,
 *     which behaves differently enough between engines to be worth pinning.
 *
 * Served by scripts/serve-pages.mjs, which is the same file `npm run landing`
 * uses: real pages, expanded includes, and a local /GameData/ built from
 * data/*.json so nothing here depends on the hosted site being up.
 *
 *   npm run test:e2e:website
 *   npx playwright test --config playwright.website.config.ts --project=firefox
 */
const URL = process.env.WEBSITE_URL || 'http://localhost:4322';

/* One list, used by every project. Phones get a subset: the Code Builder tells
 * a phone to come back on a laptop (by design — see the note in ww-builder.js),
 * so its tests are tagged and skipped there rather than asserted against a page
 * that is not supposed to work. */
export default defineConfig({
	testDir: './tests/e2e',
	testMatch: /website\.spec\.ts/,
	timeout: 45_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	/* One retry in CI. WebKit on a shared runner is genuinely slower than the
	 * others and a first-run timeout there is not a finding. */
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

	use: {
		baseURL: URL,
		/* Kept on for failures only: a screenshot of the wrong layout in a browser
		 * you may not have installed is most of the debugging. */
		screenshot: 'only-on-failure',
		trace: process.env.CI ? 'on-first-retry' : 'off',
	},

	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
		/* Real device profiles rather than a resized desktop: the touch flag and
		 * the user agent both change behavior on these pages. */
		{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
		{ name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
	],

	webServer: process.env.SKIP_PREVIEW
		? undefined
		: {
				command: 'node scripts/serve-pages.mjs 4322 --no-open',
				url: URL,
				timeout: 30_000,
				reuseExistingServer: !process.env.CI,
			},
});

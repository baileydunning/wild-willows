import { defineConfig, devices } from '@playwright/test';

// The classroom pages, driven in a real browser.
//
// Its own config rather than a third project in playwright.config.ts, because
// the two suites need completely different servers. The game's e2e runs against
// `vite preview` of the built app — a ~3 minute build these pages have nothing
// to do with. The classroom pages are plain HTML served by `npm run landing`,
// which starts in about a second.
//
// WHY THIS SUITE EXISTS AT ALL. Everything the Code Builder does that matters
// happens in a browser: whether the preview document parses, whether an error
// reaches the panel, whether the view toggle actually hides a column. Three
// separate real bugs shipped past unit tests that were checking bytes rather
// than behaviour — a harness that failed to parse, a syntax error that reported
// only to devtools, and a line number pointing a hundred lines past the end of
// the student's file. None of them are visible without rendering the page.
//
//   npx playwright test --config playwright.classroom.config.ts
//   npm run test:e2e:classroom
const URL = process.env.CLASSROOM_URL || 'http://localhost:4321';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: /(code-builder|lesson|teachers)\.spec\.ts/,
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: { ...devices['Desktop Chrome'], baseURL: URL },

	// `npm run landing` also serves a local /GameData/ from data/*.json and
	// rewrites the absolute API URL to it, so these tests never depend on the
	// hosted site being up — or on the CORS header having been deployed yet.
	webServer: process.env.SKIP_PREVIEW
		? undefined
		: {
				command: 'node scripts/serve-pages.mjs 4321 --no-open',
				url: URL,
				timeout: 30_000,
				reuseExistingServer: !process.env.CI,
			},
});

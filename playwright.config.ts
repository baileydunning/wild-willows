import { defineConfig, devices } from '@playwright/test';

// E2E suites, BOTH driving the production web build served by `vite preview`
// (Harper is endpoints-only — it serves no static files):
//
//  • solo  — the app nudged into offline solo mode (no backend). Fast +
//            hermetic, so it runs on every PR.
//  • i18n  — the same build with the interface language switched.
//
// Run one suite:  npx playwright test --project=solo
const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:4173';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

	projects: [
		{
			name: 'solo',
			// solo.spec.ts plus the offline UI regressions (button-hover.spec.ts) —
			// both run against the same hermetic, backend-free preview.
			testMatch: /(solo|button-hover|journal-overflow)\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: PREVIEW_URL },
		},
		{
			// The language sweep: the same offline preview, booted in English,
			// Spanish, and plain-language mode, checking that every string in the
			// interface actually resolved and fits. Its own project so it can be run
			// (and re-run) alone from .github/workflows/i18n.yml without dragging the
			// rest of the solo suite along — `npx playwright test --project=i18n`.
			name: 'i18n',
			testMatch: /i18n-render\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: PREVIEW_URL },
		},
	],

	// Both suites are served by `vite preview`. SKIP_PREVIEW=1 opts out if you're
	// already running a preview server yourself.
	webServer: process.env.SKIP_PREVIEW
		? undefined
		: {
				command: 'npm run build:web && npx vite preview --port 4173 --strictPort',
				url: PREVIEW_URL,
				timeout: 180_000,
				reuseExistingServer: !process.env.CI,
			},
});

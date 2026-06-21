import { defineConfig, devices } from '@playwright/test';

// Two E2E suites:
//
//  • solo  — drives the production web build served by `vite preview`, with the
//            app nudged into offline solo mode (no backend). Fast + hermetic, so
//            it runs on every PR.
//  • coop  — drives the SAME build served by a real Harper instance on
//            https://localhost:9926, exercising the live co-op API. The Harper
//            server is started by CI (or `npm run dev`) before these run; set
//            COOP_BASE_URL to point elsewhere.
//
// Run one suite:  npx playwright test --project=solo
const COOP_BASE_URL = process.env.COOP_BASE_URL || 'https://localhost:9926';
const SOLO_BASE_URL = process.env.SOLO_BASE_URL || 'http://localhost:4173';
const RUN_COOP = !!process.env.COOP_E2E; // opt-in: needs a live Harper

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
			testMatch: /solo\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: SOLO_BASE_URL },
		},
		...(RUN_COOP
			? [
					{
						name: 'coop',
						testMatch: /coop\.spec\.ts/,
						use: {
							...devices['Desktop Chrome'],
							baseURL: COOP_BASE_URL,
							ignoreHTTPSErrors: true, // Harper local dev uses a self-signed cert
						},
					},
				]
			: []),
	],

	// The solo suite needs the built web app served statically. The co-op suite
	// is served by Harper instead, so its CI job sets SKIP_PREVIEW=1 to opt out.
	webServer: process.env.SKIP_PREVIEW
		? undefined
		: {
				command: 'npm run build:web && npx vite preview --port 4173 --strictPort',
				url: SOLO_BASE_URL,
				timeout: 180_000,
				reuseExistingServer: !process.env.CI,
			},
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test config is intentionally SEPARATE from vite.config.ts. The app build
// aliases `node:crypto` to a browser shim (src/solo/cryptoShim); tests run on
// Node and must use the real `node:crypto` (passcode hashing, salts, etc.), so
// we deliberately do NOT carry that alias over here.
export default defineConfig({
	plugins: [react()],
	test: {
		// Two suites with different needs, run by one `vitest`:
		//  • unit        — pure logic + browser-ish helpers (jsdom for localStorage)
		//  • integration — the REAL built server bundle (resources.js) driven against
		//                   an in-memory Harper mock, on plain Node.
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					environment: 'jsdom',
					include: ['tests/unit/**/*.test.{ts,tsx}'],
				},
			},
			{
				extends: true,
				test: {
					name: 'integration',
					environment: 'node',
					include: ['tests/integration/**/*.test.ts'],
					// resources.js is a singleton module; the harness swaps the
					// underlying tables per-test, so files can share one process.
					hookTimeout: 20_000,
					testTimeout: 20_000,
				},
			},
		],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/game/**', 'src/ui/**'],
		},
	},
});

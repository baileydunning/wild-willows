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
			// The Phaser-bound game modules can't be instantiated without a WebGL
			// context, so they stay out. The two that hold the game's RULES are pure
			// and testable, and are deliberately counted.
			exclude: [
				'src/**/*.d.ts',
				'src/main.tsx',
				'src/game/WorldScene.ts',
				'src/game/sprites/**',
				'src/game/PhaserGame.tsx',
				'src/game/bridge.ts',
				'src/ui/**',
			],
			// Write the report even when the run is red. Otherwise the one moment
			// you most want to see what was and was not covered is the one moment
			// vitest throws it away.
			reportOnFailure: true,
			// A FLOOR, NOT A TARGET.
			//
			// Pinned a couple of points under where the suite actually sat when this
			// was added (lines 37.7, statements 35.7, functions 34.8, branches 27.9,
			// measured over the same include/exclude set above). The gap absorbs the
			// normal jitter of adding a module before its tests land; it is not
			// headroom to spend.
			//
			// The point is to catch EROSION — a refactor that quietly drops a tested
			// module, a subsystem that arrives with no tests at all — not to chase a
			// number. Chasing the number produces tests written to touch lines, which
			// cost real time to maintain and catch nothing.
			//
			// The ratchet: when coverage rises and holds, raise these to just under
			// the new level. Never lower them to turn a red build green — that is the
			// single move this exists to prevent. If a change legitimately reduces
			// measured coverage (deleting well-tested code, say), lower them
			// deliberately, in their own commit, with the reason in the message.
			//
			// Only evaluated when vitest runs with --coverage; CI does (.github/workflows/ci.yml).
			thresholds: {
				lines: 35,
				statements: 33,
				functions: 32,
				branches: 25,
			},
		},
	},
});

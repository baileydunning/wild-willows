import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// The game's version, straight from package.json — baked into the bundle so
// telemetry/feedback can report exactly which release a player is running.
const APP_VERSION: string =
	JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')).version || '0.0.0';

// API endpoints exposed by Harper custom resources — proxied to the Harper
// instance during `npm run dev:web` development AND by `vite preview` (the E2E
// suites drive the built app through preview, with the API proxied to a live
// Harper). Harper is ENDPOINTS ONLY — it serves no static files —
// so this proxy is the only way the web UI reaches it. Keep this list in sync
// with the calls the client actually makes (src/api.ts) — the admin and
// dashboard endpoints are deliberately absent.
const HARPER_TARGET = process.env.HARPER_BASE_URL || 'https://localhost:9926';
const harperEndpoints = [
	// game data + saves
	'GameData',
	'GameState',
	'Version',
	'CreatePlayer',
	'LoginPlayer',
	'DeletePlayer',
	'DeleteDemoSave',
	'ExportDemoSave',
	'ChangePasscode',
	'UpdateAppearance',
	// core loop
	'CollectResource',
	'HarvestPlacement',
	'ChestTransfer',
	'CraftItem',
	'DiscardItem',
	'PlaceObject',
	'RemoveObject',
	'MoveObject',
	'UpgradeTool',
	'ObserveAnimal',
	'RecalcBiome',
	'SyncPlayer',
	'Terraform',
	'Plant',
	'Rest',
	'ClaimTask',
	'SetGoals',
	'Heartbeat',
	'AppendFeed',
	// home
	'UpgradeHome',
	'SetHomeStyle',
	'SetHomeColors',
	'SetPlacementColor',
	// legacy — no current client calls this, but builds older than 0.3.0 do.
	// See the COMPAT note on MyWorlds in server/resources.ts.
	'MyWorlds',
	// telemetry, feedback, dev
	'Metrics',
	'SubmitFeedback',
	'SyncMetrics',
	'AppOpen',
	'ReportClientError',
	'ReportSaveIncident',
	'DevTools',
];

// Harper serves REST over HTTPS (self-signed in local dev), hence secure: false.
const harperProxy = Object.fromEntries(
	harperEndpoints.map((name) => [`/${name}`, { target: HARPER_TARGET, changeOrigin: true, secure: false }]),
);

/** UI modules that App.tsx loads on demand rather than importing statically.
 *  Keep in step with the lazyPanel declarations at the top of src/App.tsx. */
const LAZY_UI_MODULES = /\/src\/ui\/(Panels|Journal|Achievements|GoalsPanel|DevPanel)\.[jt]sx?$/;

export default defineConfig({
	plugins: [react()],
	// Relative asset paths so the same build works BOTH served at Harper's root
	// and loaded straight from disk (file://) in the desktop app.
	base: './',
	// The solo backend reuses the server logic, which imports `node:crypto` and
	// `node:zlib`. In the browser bundle we swap in tiny local stand-ins (see
	// src/solo/cryptoShim, src/solo/zlibShim). The server's own esbuild build keeps
	// the real node modules external, so the deployed Harper backend is unaffected.
	resolve: {
		alias: {
			'node:crypto': fileURLToPath(new URL('./src/solo/cryptoShim.ts', import.meta.url)),
			'node:zlib': fileURLToPath(new URL('./src/solo/zlibShim.ts', import.meta.url)),
		},
	},
	// build stamp shown in the UI so you can always tell which build you're running
	define: {
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
		__APP_VERSION__: JSON.stringify(APP_VERSION),
		// Browser-playable itch DEMO build. Build with DEMO=true npm run build:web:
		// the client talks to the hosted Harper (falling back to the in-app solo
		// backend if it's unreachable) and hard-stops 15 minutes after the forest
		// unlocks. See src/demo.ts and src/demoBudget.ts.
		__DEMO__: JSON.stringify(process.env.DEMO === 'true'),
		// Where this artifact is DISTRIBUTED (itch | mas | direct). Deliberately
		// separate from `platform` (web/desktop): itch ships both a browser demo
		// and a download, and those are one storefront on two platforms —
		// collapsing them loses the question worth asking.
		//
		// Only needed for builds whose channel can't be worked out at runtime.
		// detectChannel() (src/platform.ts) prefers real runtime evidence — the
		// page's own hostname, process.mas, Steam's env vars — and falls back to
		// this. Unset means "dev", which is the honest answer for a local build.
		__CHANNEL__: JSON.stringify(process.env.WW_CHANNEL || ''),
	},
	build: {
		outDir: 'web',
		emptyOutDir: true,
		// The solo backend bundles server/resources.ts, whose policy-page
		// endpoints use an ES2022 string export name (`export { … as
		// 'age-rating' }` — Harper maps export names to URL paths, and the
		// hyphen needs the string form). Vite's default target (es2020/chrome87)
		// rejects that syntax, and there's no hosted web UI to support old
		// browsers for: the build runs in Electron (Chromium 126) and local dev.
		target: 'es2022',
		rollupOptions: {
			output: {
				/* Split the two big, rarely-changing vendors out of the entry chunk.
				 *
				 * Without this, everything shipped in ONE entry chunk — 2.8 MB of
				 * Phaser (~1.1 MB), React, and all 15 UI panels — and that chunk's
				 * content hash moves whenever any app file does. A one-line tweak to a
				 * panel therefore re-downloaded Phaser and React for every returning
				 * player. Pulled out, those two keep their hashes across releases and
				 * stay in the browser cache until the dependency itself is upgraded.
				 *
				 * This buys cacheability, NOT size: Phaser comes in as a default/
				 * namespace import (`import Phaser from 'phaser'`), so none of it can
				 * be tree-shaken and it ships whole either way.
				 *
				 * Matched on the resolved module path rather than the `{ phaser:
				 * ['phaser'] }` object form, because the object form only claims the
				 * named modules and what they themselves import — which strands
				 * `react/jsx-runtime` (pulled in by every component the JSX transform
				 * touches) and `scheduler` (react-dom's own dependency) back in the
				 * entry chunk, i.e. exactly the pieces we were trying to move. */
				manualChunks(id) {
					const path = id.replace(/\\/g, '/');
					if (path.includes('/node_modules/phaser/')) return 'phaser';
					if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'react';
					/* The same cacheability argument, applied to our own code.
					 *
					 * `src/game/` is ~14k lines dominated by textures.ts (8.6k lines of
					 * procedural texture generation) and WorldScene.ts, and it changes on a
					 * completely different schedule from `src/ui/`. Left together in the
					 * entry chunk, editing a panel's copy re-downloaded every texture
					 * routine, and vice versa. `src/i18n/` is the strongest case of all: it
					 * is several hundred KB of JSON that changes only when strings change.
					 *
					 * Same caveat as above — this buys cacheability, not size. Cutting the
					 * bytes needs lazy loading (React.lazy for the panels, a dynamic import
					 * for PhaserGame), which is a behaviour change and wants its own pass. */
					if (path.includes('/src/i18n/')) return 'i18n';
					if (path.includes('/src/game/')) return 'game';
					// The panels App.tsx code-splits (see lazyPanel there) must be left
					// UNASSIGNED so Rollup can give each its own chunk. A manualChunks
					// rule wins over dynamic-import splitting, so folding these into 'ui'
					// silently undid the split: they left the entry chunk, landed in
					// 'ui' — and 'ui' is a static dependency of the entry anyway, because
					// HUD, Toolbelt, Welcome and Settings live beside them and are
					// imported eagerly. Net effect was one 760 KB chunk still downloaded
					// up front. Returning undefined here is what actually defers them.
					if (LAZY_UI_MODULES.test(path)) return undefined;
					if (path.includes('/src/ui/')) return 'ui';
					return undefined;
				},
			},
		},
	},
	server: {
		port: 5173,
		proxy: harperProxy,
	},
	// `vite preview` (the E2E suites, and quick local checks of the built app)
	// gets the same proxy explicitly — don't rely on it inheriting server.proxy.
	preview: {
		port: 4173,
		proxy: harperProxy,
	},
});

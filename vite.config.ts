import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// The game's version, straight from package.json — baked into the bundle so
// telemetry/feedback can report exactly which release a player is running.
const APP_VERSION: string = JSON.parse(
	readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
).version || '0.0.0';

// API endpoints exposed by Harper custom resources — proxied to the Harper
// instance during `npm run dev:web` development AND by `vite preview` (the
// co-op E2E suite drives the built app through preview, with the API proxied
// to a live Harper). Harper is ENDPOINTS ONLY — it serves no static files —
// so this proxy is the only way the web UI reaches it. Keep this list in sync
// with the exported classes in server/resources.ts.
const HARPER_TARGET = process.env.COOP_BASE_URL || 'https://localhost:9926';
const harperEndpoints = [
	// game data + saves
	'GameData',
	'GameState',
	'CreatePlayer',
	'LoginPlayer',
	'DeletePlayer',
	'ChangePasscode',
	'UpdateAppearance',
	// core loop
	'CollectResource',
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
	'Heartbeat',
	'AppendFeed',
	// home
	'UpgradeHome',
	'SetHomeStyle',
	'SetHomeColors',
	'SetPlacementColor',
	// co-op
	'MyWorlds',
	'CreateWorld',
	'JoinWorld',
	'SwitchWorld',
	'LeaveWorld',
	'WorldRoster',
	'CheckWorldCode',
	'RequestJoin',
	'JoinRequestStatus',
	'PendingJoinRequests',
	'ResolveJoin',
	'Presence',
	// telemetry, feedback, dashboards, dev
	'Metrics',
	'BiomeSnapshot',
	'SubmitFeedback',
	'SyncMetrics',
	'DevTools',
];

// Harper serves REST over HTTPS (self-signed in local dev), hence secure: false.
const harperProxy = Object.fromEntries(
	harperEndpoints.map((name) => [
		`/${name}`,
		{ target: HARPER_TARGET, changeOrigin: true, secure: false },
	])
);

export default defineConfig({
	plugins: [react()],
	// Relative asset paths so the same build works BOTH served at Harper's root
	// (web/co-op) and loaded straight from disk (file://) in the desktop app.
	base: './',
	// The solo backend reuses the server logic, which imports `node:crypto`. In
	// the browser bundle we swap in a tiny local stand-in (see src/solo/cryptoShim).
	// The server's own esbuild build keeps the real node:crypto, so Harper is
	// unaffected.
	resolve: {
		alias: {
			'node:crypto': fileURLToPath(new URL('./src/solo/cryptoShim.ts', import.meta.url)),
		},
	},
	// build stamp shown in the UI so you can always tell which build you're running
	define: {
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
		__APP_VERSION__: JSON.stringify(APP_VERSION),
		// Co-op (hosted-Harper multiplayer) is OFF by default for the solo-only
		// v1. Build with COOP_ENABLED=true to bake it back in (e.g. the co-op
		// E2E job does this). See src/features.ts.
		__COOP_ENABLED__: JSON.stringify(process.env.COOP_ENABLED === 'true'),
	},
	build: {
		outDir: 'web',
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		proxy: harperProxy,
	},
	// `vite preview` (solo + co-op E2E, and quick local checks of the built app)
	// gets the same proxy explicitly — don't rely on it inheriting server.proxy.
	preview: {
		port: 4173,
		proxy: harperProxy,
	},
});

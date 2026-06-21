import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// API endpoints exposed by Harper custom resources — proxied to the local
// Harper instance during `npm run dev:web` development.
const harperEndpoints = [
	'GameData',
	'GameState',
	'CreatePlayer',
	'LoginPlayer',
	'DeletePlayer',
	'UpdateAppearance',
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
];

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
		// Harper serves REST over HTTPS (self-signed in local dev), hence secure: false.
		proxy: Object.fromEntries(
			harperEndpoints.map((name) => [
				`/${name}`,
				{ target: 'https://localhost:9926', changeOrigin: true, secure: false },
			])
		),
	},
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
	// build stamp shown in the UI so you can always tell which build you're running
	define: {
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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

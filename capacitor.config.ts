import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the SAME `web/` build that Electron loads — Wild Willows solo
 * runs the real game logic in-app (src/solo) against local save files, so the
 * Android app needs no server and no network, exactly like the desktop build.
 *
 * `webDir` is Vite's outDir (see vite.config.ts). Run `npm run build:web` before
 * `npx cap sync android` or you'll package a stale bundle.
 *
 * NOTE on `androidScheme`: Capacitor serves the bundled app from an https origin
 * (https://localhost by default). That matters here because data/audio.json uses
 * ROOT-ABSOLUTE asset paths (`/audio/music/...`) — those resolve correctly off a
 * real origin like this one, but would NOT under a file:// load. Electron gets
 * away with `base: './'` for the same reason in reverse. Don't switch this to a
 * custom scheme without re-checking audio loading on device.
 */
const config: CapacitorConfig = {
	appId: 'io.harper.wildwillows',
	appName: 'Wild Willows',
	webDir: 'web',
	android: {
		// Release builds only. Debug builds keep the default (mixed content off).
		allowMixedContent: false,
		// The game canvas handles its own sizing; a bounce/overscroll effect on the
		// WebView just fights the Phaser scene during window resizes on ChromeOS.
		webContentsDebuggingEnabled: false,
	},
	server: {
		androidScheme: 'https',
	},
};

export default config;

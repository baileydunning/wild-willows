'use strict';

/**
 * Minimal, context-isolated bridge. The game talks to its backends over the
 * normal API surface (in-app for solo, hosted Harper otherwise), so it needs
 * little from here — just desktop niceties and the local save-file store that
 * solo play persists to (userData/saves, handled in the main process).
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Which storefront handed the player this copy — answered from the Electron
 * process, which is the only place that can actually see it.
 *
 * The renderer can't: `process.mas` isn't exposed to it, and Steam's launch
 * environment isn't either. So the verdict is made here and handed across;
 * detectChannel() (src/platform.ts) prefers it over the build-time stamp.
 *
 * Returns null when there's no runtime evidence — a plain download, where the
 * storefront genuinely is a build-time fact (WW_CHANNEL) rather than something
 * the running app can observe.
 */
function detectDesktopChannel() {
	// An explicit override always wins — useful for smoke-testing a channel
	// without rebuilding, and for packagers who know better than we do.
	const forced = String(process.env.WW_CHANNEL || '')
		.trim()
		.toLowerCase();
	if (forced) return forced;
	// Electron sets this only for a Mac App Store (`mas` target) build. It is the
	// one storefront that identifies itself with certainty at runtime.
	if (process.mas === true) return 'mas';
	// When Steam ships, detect it HERE, from `process.env.SteamAppId` /
	// `SteamClientLaunch` — the env Steam sets when IT launches the game. Not
	// steamworks init and not steam_appid.txt: both are true in local development
	// (steam_appid.txt holds Valve's 480 placeholder), which would file every dev
	// launch under Steam.
	return null;
}

contextBridge.exposeInMainWorld('wildWillowsDesktop', {
	isDesktop: true,
	platform: process.platform,
	version: process.versions.electron,
	// Storefront this copy came from (mas | steam | itch | direct | …), or null
	// when only the build stamp knows. See detectChannel() in src/platform.ts.
	channel: detectDesktopChannel(),
	// Solo save slots — JSON files in userData/saves (offline + Steam-Cloud-able).
	saves: {
		list: () => ipcRenderer.invoke('saves:list'),
		read: (slotId) => ipcRenderer.invoke('saves:read', slotId),
		write: (slotId, contents) => ipcRenderer.invoke('saves:write', slotId, contents),
		remove: (slotId) => ipcRenderer.invoke('saves:remove', slotId),
	},
	// Steam Stats/Achievements: the renderer owns the live game metrics now, so it
	// pushes the active player's metrics view to the main process, which maps them
	// onto Steam (electron/metrics-sync.js). No-op outside Steam.
	steam: {
		reportMetrics: (player) => ipcRenderer.send('steam:metrics', player),
	},
});

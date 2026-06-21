'use strict';

/**
 * Minimal, context-isolated bridge. The game talks to its backends over the
 * normal API surface (in-app for solo, hosted Harper for co-op), so it needs
 * little from here — just desktop niceties and the local save-file store that
 * solo play persists to (userData/saves, handled in the main process).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wildWillowsDesktop', {
	isDesktop: true,
	platform: process.platform,
	version: process.versions.electron,
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

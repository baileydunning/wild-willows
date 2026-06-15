'use strict';

/**
 * Minimal, context-isolated bridge. The game itself talks to Harper over HTTP
 * exactly as it does on the web, so it needs nothing from here. We only expose
 * a tiny read-only surface for desktop niceties (e.g. showing the app version).
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wildWillowsDesktop', {
	isDesktop: true,
	platform: process.platform,
	version: process.versions.electron,
});

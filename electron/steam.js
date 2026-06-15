'use strict';

/**
 * Thin, defensive wrapper around steamworks.js (the Steam SDK binding).
 *
 * Everything here is a no-op when Steam isn't available — running outside Steam
 * (e.g. `npm run desktop` during development, or a non-Steam build) must still
 * work. Only when the game is launched through Steam (or a `steam_appid.txt`
 * is present in the working dir) does `init` succeed and stats/achievements get
 * reported.
 *
 * All steamworks.js calls are isolated here and wrapped in try/catch so that
 * adjusting to a specific library version is a one-file change. Tested API
 * surface (steamworks.js ~0.4): client.achievement.activate(name),
 * client.stats.setInt(name, value) / client.stats.store().
 */

const fs = require('node:fs');
const path = require('node:path');

let client = null;     // steamworks.js client, or null when unavailable
let enabled = false;

function logger() { return console; }

/** Resolve the Steam App ID: env override, else steam_appid.txt, else dev fallback. */
function resolveAppId(app) {
	if (process.env.WW_STEAM_APPID) return Number(process.env.WW_STEAM_APPID);
	// steam_appid.txt next to the app (dev) or in resources (packaged).
	const candidates = [
		path.join(process.cwd(), 'steam_appid.txt'),
		app ? path.join(path.dirname(app.getAppPath()), 'steam_appid.txt') : null,
	].filter(Boolean);
	for (const f of candidates) {
		try {
			const id = Number(fs.readFileSync(f, 'utf8').trim());
			if (id) return id;
		} catch { /* keep looking */ }
	}
	return 480; // Spacewar — Valve's public test app, for development only
}

/** Initialize Steam. Safe to call once after app is ready. */
function init(app) {
	let steamworks;
	try {
		steamworks = require('steamworks.js');
	} catch (err) {
		logger().log('[steam] steamworks.js not installed — Steam features disabled');
		return false;
	}

	try {
		// Lets the Steam overlay attach to Electron. Harmless if unsupported.
		steamworks.electronEnableSteamOverlay?.();
	} catch { /* ignore */ }

	const appId = resolveAppId(app);
	try {
		client = steamworks.init(appId);
		enabled = true;
		const name = safe(() => client.localplayer.getName()) || 'unknown';
		logger().log(`[steam] initialized (appId ${appId}, player ${name})`);
		return true;
	} catch (err) {
		client = null;
		enabled = false;
		logger().log(`[steam] not running / init failed — Steam features disabled (${err && err.message})`);
		return false;
	}
}

function safe(fn, label) {
	try { return fn(); }
	catch (err) { logger().log(`[steam] ${label || 'call'} failed: ${err && err.message}`); return undefined; }
}

const isEnabled = () => enabled && !!client;

/** Set an integer stat (no-op if unchanged value isn't tracked here). */
function setStat(name, value) {
	if (!isEnabled() || !Number.isFinite(value)) return;
	safe(() => client.stats.setInt(name, Math.floor(value)), `setInt ${name}`);
}

/** Unlock an achievement (idempotent — Steam ignores re-activation). */
function unlockAchievement(apiName) {
	if (!isEnabled()) return;
	const already = safe(() => client.achievement.isActivated(apiName), `isActivated ${apiName}`);
	if (already) return;
	safe(() => client.achievement.activate(apiName), `activate ${apiName}`);
	logger().log(`[steam] achievement unlocked: ${apiName}`);
}

/** Flush stats/achievements to Steam. Call after a batch of updates. */
function store() {
	if (!isEnabled()) return;
	safe(() => client.stats.store(), 'store');
}

/** Pump Steam callbacks (overlay, etc.). Optional but cheap. */
function runCallbacks() {
	if (!isEnabled()) return;
	safe(() => client.runCallbacks?.(), 'runCallbacks');
}

function shutdown() {
	if (!isEnabled()) return;
	store();
	client = null;
	enabled = false;
}

module.exports = { init, isEnabled, setStat, unlockAchievement, store, runCallbacks, shutdown };

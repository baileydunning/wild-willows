'use strict';

/**
 * Maps the game's metrics onto Steam Stats + Achievements.
 *
 * Solo runs the game logic in-app (no local Harper), so the renderer owns the
 * live metrics. It pushes the active player's metrics view to us over IPC
 * ('steam:metrics', see preload.js / src/solo/steamSync.ts) and we translate it
 * to Steam via electron/steam.js. Everything is a no-op unless launched through
 * Steam, so `npm run desktop` still works.
 *
 * ACHIEVEMENTS: every in-game achievement (data/achievements.json, awarded
 * server-side) is mirrored to Steam 1:1. The player's metrics view carries the
 * full list of earned achievement ids (achievements.earnedIds, from the server's
 * achievementMetrics), and each id maps to its Steamworks API name by
 * `gameAchievementToSteam` below. There is no separate hand-picked milestone
 * list any more — if it's earned in-game, it unlocks on Steam.
 *
 * Stat and achievement API names below must match what you define in the
 * Steamworks dashboard (App Admin → Stats / Achievements). See the
 * "Desktop / Steam build" section of README.md for the full derived list.
 */

const { ipcMain } = require('electron');
const steam = require('./steam');

const POLL_MS = 60 * 1000;
let timer = null;
let loggedShape = false;
let latest = null; // most recent metrics view from the renderer

/** Integer Steam stats ← fields on the active player's metrics view. */
const STATS = {
	play_minutes: (p) => p.playMinutes,
	sessions: (p) => p.sessions,
	resources_collected: (p) => p.counts?.resourcesCollected,
	items_crafted: (p) => p.counts?.itemsCrafted,
	objects_placed: (p) => p.counts?.objectsPlaced,
	plants_planted: (p) => p.counts?.plantsPlanted,
	animals_observed: (p) => p.counts?.animalsObserved,
	// Fallback key must match the server's biome summary field (summarizeBiomes →
	// totalAnimalsReturned); the primary path is the per-player counter.
	animals_returned: (p) => p.counts?.animalsReturned ?? p.biomeSummary?.totalAnimalsReturned,
	biomes_unlocked: (p) => p.unlockedBiomes,
};

/**
 * Map an in-game achievement id to its Steamworks API name. Steam API names
 * allow only [A-Za-z0-9_], so uppercase the id and turn every run of other
 * characters (the hyphens in our ids) into a single underscore.
 *   'welcome-grasshopper'    → 'WELCOME_GRASSHOPPER'
 *   'caretaker-of-the-whole' → 'CARETAKER_OF_THE_WHOLE'
 * These MUST match the API names configured in the Steamworks dashboard.
 */
function gameAchievementToSteam(id) {
	return String(id)
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/** Push one player's metrics view to Steam. Safe to call repeatedly. */
function syncFromPlayer(p) {
	if (!steam.isEnabled() || !p) return;

	// One-time: log the actual field names so the mapping can be verified.
	if (!loggedShape) {
		loggedShape = true;
		console.log('[metrics] player keys:', Object.keys(p));
		console.log('[metrics] counts keys:', p.counts ? Object.keys(p.counts) : '(none)');
		console.log('[metrics] earned achievements:', p.achievements?.earnedIds?.length ?? '(none)');
	}

	for (const [name, get] of Object.entries(STATS)) {
		const v = Number(get(p));
		if (Number.isFinite(v)) steam.setStat(name, v);
	}
	// Mirror the real earned set 1:1. unlockAchievement is idempotent (it checks
	// isActivated first), so re-sending the full list every push is cheap.
	const earnedIds = (p.achievements && p.achievements.earnedIds) || [];
	for (const id of earnedIds) {
		try {
			const apiName = gameAchievementToSteam(id);
			if (apiName) steam.unlockAchievement(apiName);
		} catch {
			/* ignore mapping gaps — never let one bad id break the batch */
		}
	}
	steam.store();
}

function start() {
	// Receive live metrics from the renderer and forward to Steam.
	ipcMain.removeAllListeners('steam:metrics');
	ipcMain.on('steam:metrics', (_e, player) => {
		latest = player || latest;
		syncFromPlayer(player);
	});
	// Pump Steam callbacks (overlay etc.) on a light cadence.
	if (!timer) {
		timer = setInterval(() => steam.runCallbacks(), POLL_MS);
		if (timer.unref) timer.unref();
	}
}

function stop() {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	syncFromPlayer(latest); // final flush on quit
}

module.exports = { start, stop };

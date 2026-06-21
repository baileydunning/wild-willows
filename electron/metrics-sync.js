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
 * Stat and achievement API names below must match what you define in the
 * Steamworks dashboard (App Admin → Stats / Achievements). See DESKTOP.md.
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
	animals_returned: (p) => p.counts?.animalsReturned ?? p.biomeSummary?.totalReturned,
	biomes_unlocked: (p) => p.unlockedBiomes,
};

/** Milestone achievements ← a predicate over the player metrics. */
const ACHIEVEMENTS = [
	{ id: 'ACH_FIRST_ANIMAL', when: (p) => (p.counts?.animalsReturned || p.biomeSummary?.totalReturned || 0) >= 1 },
	{ id: 'ACH_FIRST_CRAFT', when: (p) => (p.counts?.itemsCrafted || 0) >= 1 },
	{ id: 'ACH_SECOND_BIOME', when: (p) => (p.unlockedBiomes || 0) >= 2 || !!p.activation?.unlockedSecondBiome },
	{ id: 'ACH_NATURALIST', when: (p) => (p.counts?.animalsObserved || 0) >= 25 },
	{ id: 'ACH_GREEN_THUMB', when: (p) => (p.counts?.plantsPlanted || 0) >= 10 },
	{ id: 'ACH_DEDICATED', when: (p) => (p.playMinutes || 0) >= 60 },
];

/** Push one player's metrics view to Steam. Safe to call repeatedly. */
function syncFromPlayer(p) {
	if (!steam.isEnabled() || !p) return;

	// One-time: log the actual field names so the mapping can be verified.
	if (!loggedShape) {
		loggedShape = true;
		console.log('[metrics] player keys:', Object.keys(p));
		console.log('[metrics] counts keys:', p.counts ? Object.keys(p.counts) : '(none)');
	}

	for (const [name, get] of Object.entries(STATS)) {
		const v = Number(get(p));
		if (Number.isFinite(v)) steam.setStat(name, v);
	}
	for (const a of ACHIEVEMENTS) {
		try { if (a.when(p)) steam.unlockAchievement(a.id); } catch { /* ignore mapping gaps */ }
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
	if (timer) { clearInterval(timer); timer = null; }
	syncFromPlayer(latest); // final flush on quit
}

module.exports = { start, stop };

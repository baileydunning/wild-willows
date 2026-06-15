'use strict';

/**
 * Pushes the local game's metrics to Steam Stats + Achievements.
 *
 * Each desktop install runs its own local Harper with a single player, so the
 * global `/Metrics/` endpoint's most-recent player IS this player. We poll it
 * and map the numbers onto Steam — no changes to the game code required.
 *
 * Stat and achievement API names below must match what you define in the
 * Steamworks dashboard (App Admin → Stats / Achievements). See DESKTOP.md.
 */

const https = require('node:https');
const steam = require('./steam');
const { BASE_URL } = require('./harper');

const POLL_MS = 60 * 1000;
let timer = null;
let loggedShape = false;

/** Integer Steam stats ← fields on the single player's metrics view. */
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
	{ id: 'ACH_FIRST_ANIMAL', when: (p) => (p.counts?.animalsReturned || 0) >= 1 },
	{ id: 'ACH_FIRST_CRAFT', when: (p) => (p.counts?.itemsCrafted || 0) >= 1 },
	{ id: 'ACH_SECOND_BIOME', when: (p) => (p.unlockedBiomes || 0) >= 2 || !!p.activation?.unlockedSecondBiome },
	{ id: 'ACH_NATURALIST', when: (p) => (p.counts?.animalsObserved || 0) >= 25 },
	{ id: 'ACH_GREEN_THUMB', when: (p) => (p.counts?.plantsPlanted || 0) >= 10 },
	{ id: 'ACH_DEDICATED', when: (p) => (p.playMinutes || 0) >= 60 },
];

function fetchMetrics() {
	return new Promise((resolve, reject) => {
		const req = https.get(`${BASE_URL}Metrics/`, { rejectUnauthorized: false, timeout: 5000 }, (res) => {
			let body = '';
			res.on('data', (c) => (body += c));
			res.on('end', () => {
				try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
			});
		});
		req.on('error', reject);
		req.on('timeout', () => { req.destroy(); reject(new Error('metrics request timed out')); });
	});
}

async function syncOnce() {
	if (!steam.isEnabled()) return;
	let data;
	try { data = await fetchMetrics(); } catch { return; }

	// Global view sorts players by recency, so [0] is the active local player.
	const p = data && Array.isArray(data.players) ? data.players[0] : null;
	if (!p) return;

	// One-time: log the actual field names so the mapping can be verified against
	// a real instance (handy since these are easy to drift from).
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
	if (timer) return;
	syncOnce(); // initial push shortly after launch
	timer = setInterval(() => { steam.runCallbacks(); syncOnce(); }, POLL_MS);
	if (timer.unref) timer.unref();
}

function stop() {
	if (timer) { clearInterval(timer); timer = null; }
	syncOnce(); // final flush on quit
}

module.exports = { start, stop };

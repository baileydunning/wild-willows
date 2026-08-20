// Wild Willows — server: metrics
//
// The stored metrics blob and its daily counterpart: shape, encode/decode,
// counter bumping, the dashboard-facing view, and the play-time clock that the
// weather and day/night calendar are derived from.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import biomesData from '../data/biomes.json';

import { clamp } from './core';
import { getPlayer, patchPlayer } from './player';
import { starterChainMetrics } from './tasks';

// Biome ids for the weather block (weather is per-biome; climate differs by
// biome). Derived once from the static seed data so the weather snapshot stays
// a pure function and needs no async defs() lookup.
export const WEATHER_BIOME_IDS: string[] = biomesData.records.map((b: any) => b.id);

/** Weather/day time is measured from accrued PLAY TIME (player.metrics.playSeconds,
 *  accumulated from heartbeats — see Heartbeat), NOT wall-clock time. So the
 *  calendar only advances while the game is actually being played: every world
 *  starts at Day 1 and reaches Day 2 after ~one day's worth of real play. Pure
 *  function of stored data. */
export function weatherTimeFromPlay(player: any): number {
	// `clockOffsetMs` lets in-game actions nudge the calendar forward (e.g. sleeping
	// skips to the start of the next day) on top of accrued play time.
	return Math.max(0, Math.round((readMetrics(player)?.playSeconds || 0) * 1000) + (player?.clockOffsetMs || 0));
}

// `databases.wildwillows` is undefined right after the database is dropped (until
// Harper restarts and the component recreates the tables). Fail cleanly with a 503
// instead of throwing raw TypeErrors on every request.
// --------------------------------------------------------------- metrics
// Lightweight per-player analytics, stored as a `metrics` blob on the Player
// record. Action counters are bumped from the relevant endpoints; play time
// and session counts are accrued from client heartbeats (see Heartbeat).
// Surfaced for dashboards via the read-only Metrics endpoint.

export function freshMetrics(now: number) {
	return {
		firstSeenAt: now,
		lastSeenAt: now,
		lastHeartbeatAt: 0,
		playSeconds: 0,
		sessions: 0,
		counts: {} as Record<string, number>,
		// Dwell time per area (seconds), accrued from the heartbeat gap and
		// attributed to whichever area the player is standing in.
		areaSeconds: {} as Record<string, number>,
		// Dwell time per MENU (seconds) and how often each was opened, reported by
		// the client on the heartbeat (which panel is open is client state — the
		// server cannot see it). Menu time OVERLAPS areaSeconds rather than being
		// carved out of it, so areaSeconds keeps exactly the meaning it had before
		// this existed and old rows stay comparable with new ones.
		menuSeconds: {} as Record<string, number>,
		menuOpens: {} as Record<string, number>,
		// Length of the in-progress session (seconds); rolled into sessionLengths
		// when a new session begins, so we keep a distribution of session lengths.
		curSessionSeconds: 0,
		sessionLengths: {} as Record<string, number>,
		// When the player first performed a real gameplay action (time-to-first-action).
		firstActionAt: 0,
		// How long character creation took, in ms (reported by the client at create).
		creationMs: 0,
	};
}

// Metrics & daily are persisted as JSON STRINGS on the Player row, never as
// nested maps. Harper encodes nested, open-ended maps (counts / areaSeconds /
// sessionLengths / daily.counts) with msgpackr record structures that drift as
// new keys appear and eventually become undecodable ("Data read, but end of
// buffer not reached"). Stringifying keeps the stored value a single stable
// scalar — the same rule SoloMetrics.snapshot already follows. Internal reads go
// through readMetrics/readDaily (which also tolerate legacy object rows written
// before this change, and a corrupt string by falling back to null → fresh);
// writes go through encodeMetrics/encodeDaily; sanitizePlayer decodes on the way
// out so the client and offline backend keep seeing objects.
export function readMetrics(player: any): any | null {
	const m = player?.metrics;
	if (m == null) return null;
	if (typeof m === 'string') {
		try {
			return JSON.parse(m);
		} catch {
			return null; // unreadable — caller falls back to freshMetrics()
		}
	}
	return m; // legacy row: metrics still stored as an object
}
export function encodeMetrics(metrics: any): string {
	return JSON.stringify(metrics ?? {});
}
export function readDaily(player: any): any | null {
	const dld = player?.daily;
	if (dld == null) return null;
	if (typeof dld === 'string') {
		try {
			return JSON.parse(dld);
		} catch {
			return null;
		}
	}
	return dld; // legacy row: daily still stored as an object
}
function encodeDaily(daily: any): string {
	return JSON.stringify(daily ?? {});
}

// Cosmetic / UI-fiddling counters — recorded in `counts` for engagement insight
// but kept OUT of totalActions (and actionsPerMinute) so those stay a
// gameplay-intensity signal. (Declared here so bumpMetrics can tell a real
// gameplay action from cosmetic fiddling when stamping firstActionAt.)
// Counters that are NOT actions of their own: cosmetic fiddling, and tallies
// kept alongside an action that already counts (bedsWatered rides on a terraform
// action, gathered:<id> rides on resourcesCollected). Excluded from totalActions
// so the dashboard's per-player action count keeps meaning the same thing it did
// before each one was added.
const META_COUNTERS = new Set(['recolors', 'appearanceChanges', 'bedsWatered', 'goalsCreated']);
/** Per-resource lifetime gather tallies — one key per resource, all meta. */
export const META_COUNTER_PREFIX = 'gathered:';
const isMetaCounter = (key: string) => META_COUNTERS.has(key) || key.startsWith(META_COUNTER_PREFIX);

/** Session-length histogram bucket for a finished session. */
export function sessionBucket(seconds: number): string {
	const m = seconds / 60;
	if (m < 2) return '<2m';
	if (m < 10) return '2-10m';
	if (m < 30) return '10-30m';
	return '30m+';
}

/**
 * Merge action-count deltas into player.metrics and persist. `player` is the
 * record we already loaded (counters live in their own key, so this never
 * clobbers a concurrent inventory/crafted patch). No-ops if nothing to add.
 *
 * `dailyDeltas` additionally bumps the player's per-day counters (player.daily
 * = { dayKey, counts }), which power the daily task board. The day bucket
 * rolls over automatically the first time it's bumped on a new UTC day — no
 * background job needed, and reads just ignore a stale bucket.
 */
/* HOW MANY ARRIVALS ARE KEPT, and why it is a cap rather than everything.
 *
 * One entry per species that has ever come home, so a completionist tops out at
 * the number of animals in the game. The cap is above that with room for the
 * game to grow, and it exists so that a bug which re-reports the same arrival
 * cannot grow a save's record without bound. Oldest go first. */
const MAX_ARRIVALS = 300;

export async function bumpMetrics(
	player: any,
	deltas: Record<string, number> = {},
	dailyDeltas: Record<string, number> = {},
	/** Species that came home on this call, in the order they arrived. */
	arrivals: Array<{ id: string; name?: string }> = [],
): Promise<any> {
	if (!player?.id) return null;
	const entries = Object.entries(deltas).filter(([, v]) => v);
	const dailyEntries = Object.entries(dailyDeltas).filter(([, v]) => v);
	if (!entries.length && !dailyEntries.length && !arrivals.length) return readMetrics(player);
	const now = Date.now();
	// merge onto the freshest row — a single request can bump twice (e.g. a
	// placement bump plus recalcBiome's health/animal bump) from stale copies.
	// safeGet so an undecodable row heals here instead of silently falling back
	// to the stale in-memory copy and writing its older counters back over the top.
	const live = (await getPlayer(player.id)) || player;
	const prev = readMetrics(live) || freshMetrics(live.createdAt || now);
	const counts = { ...(prev.counts || {}) };
	for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
	const metrics: any = { ...prev, counts, lastSeenAt: now };

	/* WHEN EACH ANIMAL CAME HOME, measured in play time rather than in dates.
	 *
	 * "Three days after they started" says more about their week than about the
	 * game. "Forty minutes in" is the thing a designer can act on: it is where the
	 * first arrival lands in a session, whether the second one comes soon enough
	 * to feel like progress, and how long the last species in a biome takes.
	 *
	 * `at` is the play seconds ALREADY accrued, so the first arrival of a brand
	 * new save reads 0 rather than a heartbeat's worth of noise. One row per
	 * species: recalcBiome only reports an animal the first time it returns, and
	 * the guard below keeps a repeat from making it look like it came twice. */
	if (arrivals.length) {
		const seen = new Set((prev.arrivals || []).map((a: any) => a && a.id));
		const at = Math.round(prev.playSeconds || 0);
		/* The NAME is written beside the id, not derived from it later. An id is a
		 * slug — "red-tailed-hawk" un-slugs to "Red Tailed Hawk", which is not the
		 * bird's name — and the dashboard has no copy of the species list to look
		 * the real one up in. Recording it here also makes the log a history: a
		 * species renamed next year still reads the way it read the day it came
		 * home. Older rows carry no name and the dashboard un-slugs those. */
		const fresh = arrivals
			.filter((a) => a && a.id && !seen.has(a.id))
			.map((a) => (a.name ? { id: a.id, name: a.name, at } : { id: a.id, at }));
		if (fresh.length) metrics.arrivals = [...(prev.arrivals || []), ...fresh].slice(-MAX_ARRIVALS);
	}
	// Stamp the first real gameplay action (cosmetic fiddling doesn't count), so
	// the dashboard can measure onboarding friction (create → first action).
	if (!prev.firstActionAt && entries.some(([k, v]) => v && !isMetaCounter(k))) {
		metrics.firstActionAt = now;
	}
	const patch: any = { metrics: encodeMetrics(metrics) };
	if (dailyEntries.length) {
		const dayKey = playerDayKey(live, now);
		const prevDaily = readDaily(live);
		const base = prevDaily?.dayKey === dayKey ? prevDaily : { dayKey, counts: {} };
		const dcounts = { ...(base.counts || {}) };
		for (const [k, v] of dailyEntries) dcounts[k] = (dcounts[k] || 0) + v;
		patch.daily = encodeDaily({ dayKey, counts: dcounts });
	}
	await patchPlayer(player.id, patch);
	return metrics;
}

/** Shape the stored metrics into a tidy, derived view for the Metrics endpoint. */
export const DAY_MS = 86_400_000;

// Daily tasks (and the per-day counters that feed them) roll over each real-life
// MORNING: TASK_RESET_HOUR o'clock in the player's local timezone. The timezone
// offset is captured from the client at create/login; saves without one fall
// back to UTC.
export const TASK_RESET_HOUR = 4;
export const tzMs = (player: any) => (Number.isFinite(player?.tzOffsetMinutes) ? player.tzOffsetMinutes : 0) * 60_000;
/** Timezone offset from the client, clamped to the real-world range (UTC-14..+14). */
export const sanitizeTzOffset = (v: any): number => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? clamp(n, -840, 840) : 0;
};
/** The player-local "task day" index of a timestamp — a new day starts at TASK_RESET_HOUR. */
export function playerDayKey(player: any, at: number): number {
	return Math.floor((at + tzMs(player) - TASK_RESET_HOUR * 3_600_000) / DAY_MS);
}
export const round1 = (n: number) => Math.round(n * 10) / 10;

export function metricsView(player: any) {
	const now = Date.now();
	const m = readMetrics(player) || freshMetrics(player.createdAt || now);
	const playSeconds = m.playSeconds || 0;
	const sessions = m.sessions || 0;
	const counts: Record<string, number> = m.counts || {};
	const totalActions = Object.entries(counts).reduce((a, [k, b]) => a + (isMetaCounter(k) ? 0 : b || 0), 0);
	const createdAt = player.createdAt || m.firstSeenAt || now;
	const lastSeenAt = m.lastSeenAt || null;

	// Dwell time per area, plus the area they've spent the most time in.
	const areaSeconds: Record<string, number> = m.areaSeconds || {};
	const areaMinutes: Record<string, number> = {};
	for (const [a, s] of Object.entries(areaSeconds)) areaMinutes[a] = Math.round((s || 0) / 60);
	const mostTimeArea = Object.entries(areaSeconds).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
	// Time in menus, and how often each was opened. Reported by the client on the
	// heartbeat; overlaps areaSeconds rather than being subtracted from it, so
	// `menuShareOfPlay` is a share of play time and NOT one minus time-in-world.
	// Saves recorded before this shipped simply have empty maps — read a 0% share
	// on an old row as "not measured", which is what `menuMeasured` is for.
	const menuSeconds: Record<string, number> = m.menuSeconds || {};
	const menuOpens: Record<string, number> = m.menuOpens || {};
	const menuMinutes: Record<string, number> = {};
	for (const [k, sec] of Object.entries(menuSeconds)) menuMinutes[k] = Math.round((sec || 0) / 60);
	const menuTotalSeconds = Object.values(menuSeconds).reduce((a, b) => a + (b || 0), 0);
	const menuTotalOpens = Object.values(menuOpens).reduce((a, b) => a + (b || 0), 0);
	const mostUsedMenu = Object.entries(menuSeconds).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
	// Onboarding friction: how long from creating the save to the first action.
	const firstActionAt = m.firstActionAt || 0;
	const timeToFirstActionSeconds = firstActionAt ? round1((firstActionAt - createdAt) / 1000) : null;
	const creationMs = m.creationMs || 0;

	// Recency drives the engagement picture: how long ago did they last play,
	// and how should we bucket them (active / recent / dormant).
	const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
	const daysSinceJoined = Math.floor((now - createdAt) / DAY_MS);
	let status: 'active' | 'recent' | 'dormant' = 'dormant';
	if (hoursSinceActive != null) {
		if (hoursSinceActive <= 24) status = 'active';
		else if (hoursSinceActive <= 24 * 7) status = 'recent';
	}

	return {
		playerId: player.id,
		name: player.name,
		createdAt,
		firstSeenAt: m.firstSeenAt || createdAt,
		lastSeenAt,
		daysSinceJoined,
		hoursSinceActive,
		status,
		isNewToday: now - createdAt <= DAY_MS,
		language: m.language || null, // interface language from the heartbeat
		// time + sessions
		sessions,
		playSeconds,
		playMinutes: Math.round(playSeconds / 60),
		avgSessionMinutes: sessions ? Math.round(playSeconds / 60 / sessions) : 0,
		// engagement intensity
		totalActions,
		actionsPerSession: sessions ? round1(totalActions / sessions) : 0,
		actionsPerMinute: playSeconds > 0 ? round1(totalActions / (playSeconds / 60)) : 0,
		// where they are in the game
		tutorialStep: player.tutorialStep || 0,
		currentArea: player.area || null,
		unlockedBiomes: (player.unlockedBiomes || []).length,
		// time-per-area
		areaSeconds,
		areaMinutes,
		mostTimeArea,
		/* Which species came home, and how far into the playthrough each one did.
		 * Exposed here rather than only on the hosted row because the solo uplink
		 * sends THIS object as its snapshot (minus `biomes`), so a desktop save
		 * reports its arrivals without the client having to know they exist. */
		arrivals: Array.isArray(m.arrivals) ? m.arrivals : [],
		// time-per-menu (overlaps the above — see the note where these are read)
		menuSeconds,
		menuMinutes,
		menuOpens,
		menuTotalSeconds: Math.round(menuTotalSeconds),
		menuTotalMinutes: Math.round(menuTotalSeconds / 60),
		menuTotalOpens,
		mostUsedMenu,
		menuShareOfPlay: playSeconds > 0 ? round1((menuTotalSeconds / playSeconds) * 100) : null,
		// False on a save that has never reported menu time — either it predates
		// this metric or it has only ever beaten from an old client. Without it a
		// dashboard cannot tell "never opened a menu" from "never measured".
		menuMeasured: menuTotalSeconds > 0 || menuTotalOpens > 0,
		// session-length distribution (finished sessions bucketed)
		sessionLengths: m.sessionLengths || {},
		// The in-progress session's accrued seconds. Surfaced because "in progress"
		// is only true until the player closes the game — after that this IS the
		// length of a finished session, and the heartbeat will never bucket it
		// (bucketing happens when the NEXT session starts, which for someone who
		// doesn't come back is never). The roll-up reads it together with lastSeenAt
		// to count abandoned sessions instead of losing them.
		curSessionSeconds: Math.round(m.curSessionSeconds || 0),
		// onboarding
		timeToFirstActionSeconds,
		// character creation: how long it took + the customization they chose
		creationMs,
		creationSeconds: creationMs ? round1(creationMs / 1000) : null,
		appearance: player.appearance || null,
		counts,
		// Onboarding: how far into the ten-goal starter chain this save got, and
		// whether it went on to author goals of its own. Rides on the snapshot, so
		// the solo/demo uplink reports it exactly like the hosted game does.
		...starterChainMetrics(player),
		// Demo → full carry-over. Stamped by ExportDemoSave onto the copy the player
		// downloads, so a save that was bought and imported can say so about itself
		// for the rest of its life. Null on saves that started in the full game (and
		// on demo saves that have not been exported yet).
		convertedFromDemoAt: m.convertedFromDemoAt || null,
		// What they had done in the demo at the moment they carried it over — the
		// interesting half of the milestone. Frozen at export; the live counters keep
		// climbing past these.
		demoPlaySeconds: m.demoPlaySeconds ?? null,
		demoSessions: m.demoSessions ?? null,
		demoActions: m.demoActions ?? null,
	};
}

/**
 * Activation funnel flags for one player. Uses durable state where available
 * (craftedEver, unlocked biomes, animals returned) so players who progressed
 * before action-counting existed still register on the funnel.
 */
export function activationFlags(view: any, biomeSummary: any, player: any) {
	const c = view.counts || {};
	return {
		collected: (c.resourcesCollected || 0) > 0,
		terraformed: (c.terraformActions || 0) > 0,
		planted: (c.plantsPlanted || 0) > 0,
		crafted: (c.itemsCrafted || 0) > 0 || Object.keys(player.craftedEver || {}).length > 0,
		placed: (c.objectsPlaced || 0) > 0,
		attractedAnimal: (biomeSummary?.totalAnimalsReturned || 0) > 0,
		upgradedTool: (c.toolsUpgraded || 0) > 0,
		builtHome: (c.homesBuilt || 0) > 0,
		upgradedHome: (c.homeUpgrades || 0) > 0,
		unlockedSecondBiome: (view.unlockedBiomes || 0) >= 2,
	};
}

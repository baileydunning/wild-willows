// Wild Willows — weather model.
//
// Weather is NOT simulated. The server has no background tick: every state
// change is action-driven and stamped with Date.now(), and the client polls a
// snapshot that already carries serverTime. So weather is a PURE DETERMINISTIC
// FUNCTION of (worldId, time). Same inputs -> same weather, forever.
//
// Why this shape:
//  • Co-op is free — everyone in a world derives identical weather from the
//    shared worldId + serverTime; no syncing, no shared mutable weather row.
//  • Solo offline works identically — the same function runs in-app.
//  • No new tables, no RNG state to persist, trivially testable (pass any t).
//
// This module is intentionally free of any Harper / server globals so it can be
// unit-tested directly. resources.ts imports `weatherSnapshot` into every state
// payload.

import weatherData from '../data/weather.json';

const MINUTE = 60_000;

const CFG = weatherData.config;
/** Real-time length of one in-game "day" (the weather-block + day-phase unit). */
export const DAY_MS: number = Number(CFG?.dayMs) || 24 * MINUTE;
/** In-game days per season, cycling through `SEASONS` in order. */
export const DAYS_PER_SEASON: number = Number(CFG?.daysPerSeason) || 3;
export const SEASONS: string[] = (weatherData.seasons as string[]) || ['spring', 'summer', 'autumn', 'winter'];
const DAY_PHASES: { id: string; until: number }[] = CFG?.dayPhases || [
	{ id: 'dawn', until: 0.15 },
	{ id: 'day', until: 0.6 },
	{ id: 'dusk', until: 0.72 },
	{ id: 'night', until: 1 },
];

type Climate = Record<string, Record<string, Record<string, number>>>;
const CLIMATE: Climate = weatherData.climate as Climate;

// Weather-gated gather: biome -> weather type -> resource id. A node for that
// resource appears in the biome only while the weather is active. Same weather
// can map to different resources in different biomes.
// Strip the `_comment` doc key (and any non-object entries) so consumers can
// safely iterate this as biome → {weather: resource} without hitting the string.
const GATHER: Record<string, Record<string, string>> = Object.fromEntries(
	Object.entries(((weatherData as any).gather as Record<string, unknown>) || {}).filter(
		([k, v]) => k !== '_comment' && v !== null && typeof v === 'object',
	),
) as Record<string, Record<string, string>>;

/** The resource id gatherable in `biome` while `type` weather is active, if any. */
export function gatherResourceIdFor(biome: string, type: string): string | undefined {
	return GATHER[biome]?.[type];
}

/** The full biome→weather→resource map (read-only), for menus/legends. */
export function weatherGatherMap(): Record<string, Record<string, string>> {
	return GATHER;
}

/** Whether a resource id is ever obtained as a weather-gated gather (any biome). */
export function isWeatherGatheredResource(id: string): boolean {
	for (const biome of Object.keys(GATHER)) {
		for (const t of Object.keys(GATHER[biome])) if (GATHER[biome][t] === id) return true;
	}
	return false;
}

// --- seeded PRNG (deterministic) -------------------------------------------
// FNV-1a string hash -> 32-bit seed, then mulberry32 for a uniform [0,1). Both
// are tiny, dependency-free, and stable across platforms (server + browser).

function fnv1a(str: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pickWeighted(weights: Record<string, number>, rng: () => number): string {
	const keys = Object.keys(weights);
	if (keys.length === 0) return 'clear';
	let total = 0;
	for (const k of keys) total += Math.max(0, weights[k]);
	if (total <= 0) return keys[0];
	let r = rng() * total;
	for (const k of keys) {
		r -= Math.max(0, weights[k]);
		if (r < 0) return k;
	}
	return keys[keys.length - 1];
}

// --- time-derived cycles ----------------------------------------------------

/** Index of the in-game day containing `t` (also the weather-block index). */
export function dayIndexAt(t: number): number {
	return Math.floor(t / DAY_MS);
}

/** 0..1 progress through the current in-game day. */
export function dayProgressAt(t: number): number {
	const m = t % DAY_MS;
	return (m < 0 ? m + DAY_MS : m) / DAY_MS;
}

/** Wall-clock time at which the current in-game day began. */
export function dayStartAt(t: number): number {
	return dayIndexAt(t) * DAY_MS;
}

export function dayPhaseAt(t: number): string {
	const p = dayProgressAt(t);
	for (const ph of DAY_PHASES) if (p < ph.until) return ph.id;
	return DAY_PHASES[DAY_PHASES.length - 1].id;
}

/** Play-time (ms) at which the given phase next begins at or after t. */
export function nextPhaseAt(t: number, phaseId: string): number {
	let start = 0; // day-progress where the phase begins (the band boundary before it)
	for (let i = 0; i < DAY_PHASES.length; i++) {
		if (DAY_PHASES[i].id === phaseId) {
			start = i === 0 ? 0 : DAY_PHASES[i - 1].until;
			break;
		}
	}
	const target = dayStartAt(t) + start * DAY_MS;
	return target > t ? target : target + DAY_MS;
}

/** Next dawn ("sunrise"). Sleeping advances to this so you wake at first light,
 *  not at midnight — matters now that the day starts (progress 0) mid-night. */
export function nextDawnAt(t: number): number {
	return nextPhaseAt(t, 'dawn');
}

export function seasonAt(t: number): string {
	const day = dayIndexAt(t);
	const idx = Math.floor(day / DAYS_PER_SEASON) % SEASONS.length;
	return SEASONS[(idx + SEASONS.length) % SEASONS.length];
}

/** The active weather type for one biome on the in-game day containing `t`. */
export function weatherTypeAt(worldId: string, biomeId: string, t: number): string {
	const day = dayIndexAt(t);
	const season = seasonAt(t);
	const perBiome = CLIMATE[biomeId] || CLIMATE.default;
	const weights = (perBiome && perBiome[season]) || (CLIMATE.default && CLIMATE.default[season]) || { clear: 1 };
	const rng = mulberry32(fnv1a(`${worldId}:${biomeId}:${day}`));
	return pickWeighted(weights, rng);
}

/** Every weather type id defined in the data (clear, cloudy, rain, …). */
export const WEATHER_TYPES: string[] = Object.keys((weatherData as any).types || {});

/** A dev-tools override that forces weather and/or season for filming. */
export interface WeatherOverride {
	type?: string | null;
	season?: string | null;
}

export interface WeatherSnapshot {
	season: string;
	dayPhase: string;
	dayProgress: number;
	dayIndex: number;
	dayMs: number;
	byBiome: Record<string, { type: string; since: number }>;
	/** present only when a dev override is active; the client honors it verbatim */
	override?: WeatherOverride;
}

/**
 * The complete weather block embedded in every state snapshot. `biomeIds` is
 * passed in (from the biome defs) so this module stays free of Harper deps.
 * `override` (dev tools) pins the season and/or every biome's weather type.
 */
export function weatherSnapshot(
	worldId: string,
	t: number,
	biomeIds: string[],
	override?: WeatherOverride | null,
): WeatherSnapshot {
	const since = dayStartAt(t);
	const forcedType = override?.type || null;
	const forcedSeason = override?.season || null;
	const byBiome: Record<string, { type: string; since: number }> = {};
	for (const id of biomeIds) byBiome[id] = { type: forcedType || weatherTypeAt(worldId, id, t), since };
	const snap: WeatherSnapshot = {
		season: forcedSeason || seasonAt(t),
		dayPhase: dayPhaseAt(t),
		dayProgress: dayProgressAt(t),
		dayIndex: dayIndexAt(t),
		dayMs: DAY_MS,
		byBiome,
	};
	if (forcedType || forcedSeason) snap.override = { type: forcedType, season: forcedSeason };
	return snap;
}

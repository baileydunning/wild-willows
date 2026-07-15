// Client-side weather helpers — visuals + feed flavor.
//
// Single source of truth: this reads the SAME data/weather.json the server uses,
// so weather type names, icons, flavor lines, season tints and day-phase
// lighting never drift between the simulation and what the player sees. The
// client never decides what the weather IS (that's the server's deterministic
// snapshot) — it only decides how to draw and describe it.

import weatherConfig from '../data/weather.json';
// The deterministic core is intentionally dependency-free and portable (see the
// header in server/weather.ts), so the client reuses the SAME functions the
// server stamped the snapshot with. This keeps the live day/night clock and the
// forecast perfectly in step with the server — no second implementation to drift.
import {
	dayPhaseAt,
	dayProgressAt,
	seasonAt,
	weatherTypeAt,
	dayStartAt,
	DAY_MS,
	DAYS_PER_SEASON,
	SEASONS,
	WEATHER_TYPES,
	gatherResourceIdFor,
	weatherGatherMap,
} from '../server/weather';
import type { GameState, ResourceDef, WeatherSnapshot } from './types';

export type { WeatherSnapshot };

interface WeatherTypeStyle {
	name: string;
	icon: string;
	flavor: string;
	tags: string[];
	particle: 'rain' | 'snow' | null;
	overlay: { color: string; alpha: number } | null;
}
interface SeasonStyle {
	label: string;
	tint: string;
	tintAmount: number;
	accent: string;
}
interface DayPhaseStyle {
	label: string;
	color: string;
	alpha: number;
	/** Optional top-weighted "sky glow" gradient (warm dawn/dusk): concentrates the
	 *  colour toward the top of the view and fades down, so a strong sunset doesn't
	 *  wash the whole ground brown. Rendered as a separate gradient overlay. */
	sky?: { color: string; alpha: number };
}

const TYPES = weatherConfig.types as Record<string, WeatherTypeStyle>;
// seasonStyle/dayPhaseStyle carry a leading `_comment` doc key in the JSON, so
// cast through `unknown` — lookups are by id with a fallback below regardless.
const SEASON_STYLE = weatherConfig.seasonStyle as unknown as Record<string, SeasonStyle>;
const DAY_PHASE_STYLE = weatherConfig.dayPhaseStyle as unknown as Record<string, DayPhaseStyle>;
const FEED = weatherConfig.feed as Record<string, any>;
const EFFECTS = ((weatherConfig as any).effects || {}) as Record<string, Record<string, string>>;
const SEASON_EFFECTS = ((weatherConfig as any).seasonEffects || {}) as Record<string, Record<string, string>>;

/** Educational note on how a weather type shapes life in a given biome (biome-
 *  specific line if present, otherwise the type's default). Empty if unknown. */
export function weatherEffect(biome: string, type: string): string {
	const block = EFFECTS[type];
	if (!block) return '';
	return block[biome] || block._default || '';
}

/** Educational note on how a season shapes life in a given biome (biome-specific
 *  line if present, otherwise the season's default). Empty if unknown. */
export function seasonEffect(biome: string, season: string): string {
	const block = SEASON_EFFECTS[season];
	if (!block) return '';
	return block[biome] || block._default || '';
}

const FALLBACK_TYPE: WeatherTypeStyle = {
	name: 'Clear',
	icon: 'sun',
	flavor: '',
	tags: [],
	particle: null,
	overlay: null,
};
const FALLBACK_SEASON: SeasonStyle = { label: 'Spring', tint: '#a9d77a', tintAmount: 0.1, accent: '#8fc46a' };
const FALLBACK_PHASE: DayPhaseStyle = { label: 'Day', color: '#ffffff', alpha: 0 };

export function weatherType(id: string): WeatherTypeStyle {
	return TYPES[id] || FALLBACK_TYPE;
}
export function seasonStyle(season: string): SeasonStyle {
	return SEASON_STYLE[season] || FALLBACK_SEASON;
}
export function dayPhaseStyle(phase: string): DayPhaseStyle {
	return DAY_PHASE_STYLE[phase] || FALLBACK_PHASE;
}

/** The active weather type id for one biome, from a snapshot (defaults to clear). */
export function weatherForArea(state: GameState | null | undefined, area: string): string {
	return state?.weather?.byBiome?.[area]?.type || 'clear';
}

function pickFrom(lines: string[] | undefined, seed: number): string | null {
	if (!lines || lines.length === 0) return null;
	return lines[Math.abs(seed) % lines.length];
}

/**
 * A feed line for a weather change. `kind` is 'onArrive' (live, player present)
 * or 'overnight' (login summary). `seed` rotates the variant so repeat events
 * stay fresh. Returns null if no line is configured.
 */
export function weatherFeedLine(
	type: string,
	kind: 'onArrive' | 'overnight',
	seed = Date.now(),
): { icon: string; text: string } | null {
	const block = FEED[type];
	if (!block) return null;
	const text = pickFrom(block[kind], seed);
	if (!text) return null;
	return { icon: block.icon || weatherType(type).icon, text };
}

/** A feed line announcing a season change. */
export function seasonFeedLine(season: string): { icon: string; text: string } | null {
	const block = FEED.season;
	const text = pickFrom(block?.[season], 0);
	if (!text) return null;
	return { icon: block.icon || 'sparkle', text };
}

// --- live weather clock -----------------------------------------------------
// The snapshot encodes the world's accrued PLAY TIME as (dayIndex + dayProgress)
// * dayMs (the server builds it from player.metrics.playSeconds). To keep the
// day/night cycle rotating smoothly between state refreshes we let that value
// advance by real elapsed time DURING an active session (play time ≈ wall time
// while you're playing).
//
// Crucially we do NOT re-anchor on every refreshed snapshot: play time only
// ticks up in ~30s heartbeat steps, so re-anchoring each refresh would snap the
// clock back to the last heartbeat. Instead we re-anchor only when the snapshot
// shows play time has run AHEAD of our estimate (heartbeat caught up) or jumped
// well BEHIND it (a different world, a reset, or over-counting while the tab was
// hidden) — otherwise we just keep ticking.

let _haveAnchor = false;
let _anchorServerT = 0;
let _anchorWallT = 0;
let _anchorBase = NaN;

/** Continuously-advancing play-time estimate (ms) derived from a snapshot.
 *  Re-syncs ONLY when the snapshot's play-time actually moves (a heartbeat, an
 *  action, or a world reset); the rest of the time it free-runs on wall time so
 *  the day/night cycle, weather, and season keep advancing while the player is
 *  idle instead of stalling between snapshot refreshes. (Same approach the HUD
 *  DayTimer uses for its clock, so all of them stay in sync.) */
export function liveTime(snap: WeatherSnapshot | null | undefined): number {
	if (!snap) return _haveAnchor ? _anchorServerT + (Date.now() - _anchorWallT) : Date.now();
	const base = (snap.dayIndex + snap.dayProgress) * snap.dayMs;
	if (!_haveAnchor || base !== _anchorBase) {
		_haveAnchor = true;
		_anchorBase = base;
		_anchorServerT = base;
		_anchorWallT = Date.now();
	}
	return _anchorServerT + (Date.now() - _anchorWallT);
}

export function liveDayPhase(snap: WeatherSnapshot | null | undefined): string {
	return snap ? dayPhaseAt(liveTime(snap)) : 'day';
}
export function liveSeason(snap: WeatherSnapshot | null | undefined): string {
	if (snap?.override?.season) return snap.override.season; // dev override wins
	return snap ? seasonAt(liveTime(snap)) : 'spring';
}

export interface Calendar {
	year: number; // 1-based: you start in Year 1
	season: string; // current season id
	dayOfSeason: number; // 1-based day within the season
	daysPerSeason: number;
	dayIndex: number; // absolute play-day index (0-based)
}

/** The in-game calendar derived from play time: Year N · Season · Day d.
 *  A year is one full cycle of the seasons (SEASONS.length × DAYS_PER_SEASON days). */
export function liveCalendar(snap: WeatherSnapshot | null | undefined): Calendar {
	const t = liveTime(snap);
	const dayMs = snap?.dayMs || DAY_MS;
	const dayIndex = Math.floor(t / dayMs);
	const yearLen = DAYS_PER_SEASON * SEASONS.length;
	return {
		year: Math.floor(dayIndex / yearLen) + 1,
		season: seasonAt(t),
		dayOfSeason: (dayIndex % DAYS_PER_SEASON) + 1,
		daysPerSeason: DAYS_PER_SEASON,
		dayIndex,
	};
}

/** Live weather type id for a biome — recomputed from the clock so it turns over
 *  on time even without a state refresh. Falls back to the snapshot if we have
 *  no worldId to seed the deterministic roll. */
export function liveWeatherType(
	worldId: string | null | undefined,
	biome: string,
	snap: WeatherSnapshot | null | undefined,
): string {
	if (snap?.override?.type) return snap.override.type; // dev override wins
	if (worldId) return weatherTypeAt(worldId, biome, liveTime(snap));
	return snap?.byBiome?.[biome]?.type || 'clear';
}

/** Forecast: the weather type for `biome` `daysAhead` in-game days from now. */
export function forecastType(
	worldId: string,
	biome: string,
	snap: WeatherSnapshot | null | undefined,
	daysAhead: number,
): string {
	if (snap?.override?.type) return snap.override.type; // dev override pins the sky
	const t = dayStartAt(liveTime(snap)) + daysAhead * DAY_MS;
	return weatherTypeAt(worldId, biome, t);
}

/** Real-time milliseconds remaining until the current in-game day rolls over
 *  (i.e. until the next weather change). */
export function msUntilNextDay(snap: WeatherSnapshot | null | undefined): number {
	const t = liveTime(snap);
	return Math.max(0, dayStartAt(t) + DAY_MS - t);
}

/** The weather-gated resource gatherable in `biome` while `type` weather is
 *  active, if any. Pairings live in weather.json's `gather` map (biome-specific). */
export function gatherResourceFor(
	resources: ResourceDef[] | undefined,
	biome: string,
	type: string,
): ResourceDef | undefined {
	const id = gatherResourceIdFor(biome, type);
	return id ? (resources || []).find((r) => r.id === id) : undefined;
}

export { gatherResourceIdFor, weatherGatherMap, SEASONS, WEATHER_TYPES };

// --- continuous day/night lighting -----------------------------------------
const DAY_PHASE_BANDS: { id: string; until: number }[] = (weatherConfig.config?.dayPhases as any[]) || [
	{ id: 'dawn', until: 0.15 },
	{ id: 'day', until: 0.6 },
	{ id: 'dusk', until: 0.72 },
	{ id: 'night', until: 1 },
];

/** Map a 0..1 day progress to its phase id (dawn/day/dusk/night), using the same
 *  bands as the server clock — lets callers derive the phase from their own
 *  free-running progress instead of the shared (idle-stalling) liveTime. */
export function phaseAtProgress(progress: number): string {
	const p = ((progress % 1) + 1) % 1;
	for (const b of DAY_PHASE_BANDS) if (p < b.until) return b.id;
	return DAY_PHASE_BANDS[DAY_PHASE_BANDS.length - 1].id;
}

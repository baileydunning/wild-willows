// Client-side weather helpers — visuals + feed flavor.
//
// Single source of truth: this reads the SAME data/weather.json the server uses,
// so weather type names, icons, flavor lines, season tints and day-phase
// lighting never drift between the simulation and what the player sees. The
// client never decides what the weather IS (that's the server's deterministic
// snapshot) — it only decides how to draw and describe it.

import weatherConfig from '../data/weather.json';
import type { GameState, WeatherSnapshot } from './types';

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
}

const TYPES = weatherConfig.types as Record<string, WeatherTypeStyle>;
const SEASON_STYLE = weatherConfig.seasonStyle as Record<string, SeasonStyle>;
const DAY_PHASE_STYLE = weatherConfig.dayPhaseStyle as Record<string, DayPhaseStyle>;
const FEED = weatherConfig.feed as Record<string, any>;

const FALLBACK_TYPE: WeatherTypeStyle = {
	name: 'Clear', icon: 'sun', flavor: '', tags: [], particle: null, overlay: null,
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
export function weatherFeedLine(type: string, kind: 'onArrive' | 'overnight', seed = Date.now()): { icon: string; text: string } | null {
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

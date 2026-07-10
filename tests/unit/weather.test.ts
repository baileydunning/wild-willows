import { describe, it, expect } from 'vitest';
import {
	DAY_MS,
	DAYS_PER_SEASON,
	SEASONS,
	dayIndexAt,
	dayProgressAt,
	dayPhaseAt,
	seasonAt,
	weatherTypeAt,
	weatherSnapshot,
} from '../../server/weather';

const BIOMES = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];

describe('weather: determinism', () => {
	it('returns the same weather for the same (worldId, biome, day)', () => {
		const base = 5 * DAY_MS + 123; // somewhere inside day 5
		for (const b of BIOMES) {
			const a = weatherTypeAt('world-A', b, base);
			const c = weatherTypeAt('world-A', b, base + 1000); // same day
			expect(a).toBe(c);
		}
	});

	it('is stable across repeated calls', () => {
		const t = 42 * DAY_MS + 999;
		const first = weatherSnapshot('seed-xyz', t, BIOMES);
		const second = weatherSnapshot('seed-xyz', t, BIOMES);
		expect(second).toEqual(first);
	});

	it('different worlds can get different weather (not all identical)', () => {
		// Across many days, two distinct worlds should diverge at least once.
		let diverged = false;
		for (let day = 0; day < 60; day++) {
			const t = day * DAY_MS + 10;
			if (weatherTypeAt('world-A', 'meadow', t) !== weatherTypeAt('world-B', 'meadow', t)) {
				diverged = true;
				break;
			}
		}
		expect(diverged).toBe(true);
	});
});

describe('weather: cycles', () => {
	it('day index and progress track real time', () => {
		expect(dayIndexAt(0)).toBe(0);
		expect(dayIndexAt(DAY_MS - 1)).toBe(0);
		expect(dayIndexAt(DAY_MS)).toBe(1);
		expect(dayProgressAt(0)).toBeCloseTo(0, 5);
		expect(dayProgressAt(DAY_MS / 2)).toBeCloseTo(0.5, 5);
	});

	it('day phases cover the whole day; midnight is night (dawn comes later)', () => {
		expect(dayPhaseAt(0)).toBe('night'); // the day starts at midnight, mid-night
		const phases = new Set<string>();
		for (let i = 0; i < 200; i++) phases.add(dayPhaseAt((i / 200) * DAY_MS));
		expect(phases.has('dawn')).toBe(true);
		expect(phases.has('day')).toBe(true);
		expect(phases.has('dusk')).toBe(true);
		expect(phases.has('night')).toBe(true);
	});

	it('seasons cycle in order, one every DAYS_PER_SEASON days', () => {
		expect(seasonAt(0)).toBe(SEASONS[0]);
		expect(seasonAt(DAYS_PER_SEASON * DAY_MS)).toBe(SEASONS[1]);
		// full year wraps back to the first season
		const yearMs = SEASONS.length * DAYS_PER_SEASON * DAY_MS;
		expect(seasonAt(yearMs)).toBe(SEASONS[0]);
	});
});

describe('weather: climate distribution', () => {
	// Sample many days and biomes/worlds; assert climate leanings hold.
	function distribution(biome: string, season: string) {
		const counts: Record<string, number> = {};
		// pick a t in the requested season, then step a full year at a time so we
		// stay in the same season slot while varying the day hash.
		const seasonOffset = SEASONS.indexOf(season) * DAYS_PER_SEASON * DAY_MS;
		const yearMs = SEASONS.length * DAYS_PER_SEASON * DAY_MS;
		let n = 0;
		for (let w = 0; w < 40; w++) {
			for (let y = 0; y < 30; y++) {
				for (let d = 0; d < DAYS_PER_SEASON; d++) {
					const t = seasonOffset + y * yearMs + d * DAY_MS + 5;
					const type = weatherTypeAt(`w${w}`, biome, t);
					counts[type] = (counts[type] || 0) + 1;
					n++;
				}
			}
		}
		return { counts, n };
	}

	it('desert summer is dominated by clear/heat and almost never snows', () => {
		const { counts, n } = distribution('desert', 'summer');
		const dry = (counts.clear || 0) + (counts.heat || 0);
		expect(dry / n).toBeGreaterThan(0.8);
		expect(counts.snow || 0).toBe(0);
	});

	it('wetland sees rain far more often than desert', () => {
		const wet = distribution('wetland', 'summer');
		const dez = distribution('desert', 'summer');
		const wetRain = (wet.counts.rain || 0) / wet.n;
		const dezRain = (dez.counts.rain || 0) / dez.n;
		expect(wetRain).toBeGreaterThan(dezRain);
	});

	it('alpine winter produces snow as the most common weather', () => {
		const { counts } = distribution('alpine', 'winter');
		const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
		expect(top).toBe('snow');
	});
});

describe('weather: snapshot shape', () => {
	it('includes season, dayPhase, progress, and per-biome weather', () => {
		const snap = weatherSnapshot('world-1', 3 * DAY_MS + 500, BIOMES);
		expect(SEASONS).toContain(snap.season);
		expect(typeof snap.dayPhase).toBe('string');
		expect(snap.dayProgress).toBeGreaterThanOrEqual(0);
		expect(snap.dayProgress).toBeLessThan(1);
		for (const b of BIOMES) {
			expect(snap.byBiome[b]).toBeTruthy();
			expect(typeof snap.byBiome[b].type).toBe('string');
			expect(snap.byBiome[b].since).toBe(snap.dayIndex * DAY_MS);
		}
	});
});

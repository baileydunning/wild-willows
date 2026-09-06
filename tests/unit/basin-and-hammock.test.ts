import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { harvestReadyAt, harvestWeatherOk, type HabitatObjectDef } from '../../src/types';
import { SLEEPABLE_OBJECTS, isSleepable } from '../../src/game/interactions';

// The client's half of two things the server decides: a crafted structure that
// yields (the rain basin, which fills with rain rather than growing), and the
// hammock as somewhere you LIE — a seat, not a bed.
//
// Both matter to the UI, not just the endpoint. If harvestReadyAt still refused
// anything unplanted, the basin would never glint and the placement menu would
// never offer the harvest — the server would happily give the water to a button
// nobody could press.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;
const OBJECTS = load('data/habitat-objects.json');
const objectOf = (id: string) => OBJECTS.find((o) => o.id === id) as HabitatObjectDef;

const HOUR = 3_600_000;

describe('the rain basin', () => {
	const basin = () => objectOf('rain-basin');

	it('yields 2 water, and refills on a timer', () => {
		const y = basin().yield!;
		expect(y.resourceId).toBe('water');
		expect(y.qty).toBe(2);
		expect(y.regrowSeconds).toBeGreaterThan(0);
	});

	it('is ready the moment it is placed — there is nothing to grow', () => {
		const placedAt = Date.now() - 1000;
		expect(harvestReadyAt(basin(), { placedAt })).toBe(placedAt);
	});

	it('is not ready again until regrowSeconds after the last harvest', () => {
		const lastHarvestAt = Date.now();
		const readyAt = harvestReadyAt(basin(), { placedAt: lastHarvestAt - HOUR, lastHarvestAt })!;
		expect(readyAt).toBe(lastHarvestAt + basin().yield!.regrowSeconds * 1000);
		expect(readyAt).toBeGreaterThan(Date.now());
	});

	it('gives up its water only in wet weather', () => {
		expect(harvestWeatherOk(basin(), 'rain')).toBe(true);
		expect(harvestWeatherOk(basin(), 'storm')).toBe(true);
		expect(harvestWeatherOk(basin(), 'clear')).toBe(false);
		expect(harvestWeatherOk(basin(), 'heat')).toBe(false);
	});

	it('leaves every other yielding thing alone — no weather gate, still planted', () => {
		// The gate is opt-in per object: an oak drops acorns whatever the sky is
		// doing, and an unplanted seedling is still not a harvest.
		const oak = objectOf('oak-tree');
		// One clock reading for both sides. Calling Date.now() twice across the
		// assertion straddles a millisecond tick every so often, which failed CI
		// with an off-by-one that had nothing to do with the code under test.
		const now = Date.now();
		expect(harvestWeatherOk(oak, 'clear')).toBe(true);
		expect(harvestReadyAt(oak, { placedAt: now - HOUR })).toBeNull();
		expect(harvestReadyAt(oak, { plantedAt: now })).toBe(now + (oak.growSeconds || 0) * 1000);
	});

	it('is the only thing that fills with weather, so nothing else changed', () => {
		const gated = OBJECTS.filter((o) => o.harvestWeather?.length).map((o) => o.id);
		expect(gated).toEqual(['rain-basin']);
	});
});

describe('the hammock', () => {
	it('is something you LIE IN, not something you sleep on', () => {
		// The distinction is the whole point of the piece. Sleeping is the action
		// that skips the clock to the next dawn; lying in a hammock leaves the day
		// exactly where it was and just puts you in it for a while.
		expect(isSleepable('hammock')).toBe(false);
		expect(SLEEPABLE_OBJECTS.has('hammock')).toBe(false);
		expect(SLEEPABLE_OBJECTS.has('home-bed')).toBe(true);
		expect(SLEEPABLE_OBJECTS.has('home-sleeping-bag')).toBe(true);
	});

	it('can be strung up in any biome, indoors or out', () => {
		const hammock = objectOf('hammock');
		expect(hammock.placement).toBe('both');
		expect(hammock.biomes).toEqual(['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal']);
	});

	it('matches the server, which is the copy that counts', () => {
		// The client set mirrors SLEEPABLE_OBJECTS in server/home.ts and SLEEP_OBJECTS
		// in the Rest endpoint. Three lists, one rule — so read the server's and
		// compare rather than trusting three hand-written copies to stay level.
		const homeTs = readFileSync(join(root, 'server/home.ts'), 'utf8');
		const restTs = readFileSync(join(root, 'server/endpoints-game.ts'), 'utf8');
		const ids = (src: string, decl: RegExp) => {
			const line = src.match(decl)?.[1] ?? '';
			return [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
		};
		const expected = [...SLEEPABLE_OBJECTS].sort();
		expect(ids(homeTs, /SLEEPABLE_OBJECTS = new Set\(\[([^\]]*)\]/)).toEqual(expected);
		expect(ids(restTs, /SLEEP_OBJECTS = \[([^\]]*)\]/)).toEqual(expected);
	});

	it('does not accidentally make other furniture a bed', () => {
		expect(isSleepable('wooden-bench')).toBe(false);
		expect(isSleepable('picnic-blanket')).toBe(false);
		expect(isSleepable('home-armchair')).toBe(false);
	});
});

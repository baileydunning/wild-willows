import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { guideBiomeFor, guideToolId, guideLevel, hasGuide, hasExpandedGuide } from '../../src/types';

// Each AREA of the preserve has a guide, rather than the whole preserve sharing
// one ladder, and each guide is written up in two steps:
//
//   1  pocket notes    names, sketches, and a caretaker's hint
//   2  field guide     opens each animal's full page
//   3  expanded guide  spells out exactly what each animal is waiting for
//
// These pin the two halves that are easy to get subtly wrong: which area's guide
// the tools menu is looking at when the caretaker is indoors, and the shape of
// the data behind the six records.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

const TOOLS = load('data/tools.json');
const BIOMES = load('data/biomes.json').sort((a, b) => (a.order || 1) - (b.order || 1));
const RESOURCES = new Set(load('data/resources.json').map((r) => r.id));
const byId = new Map(TOOLS.map((t) => [t.id, t]));

/** Everything an area can actually yield: what grows there, what the shovel turns
 *  up, and what only appears in certain weather (data/weather.json `gather` —
 *  sunstone in a desert heat wave, dewdrops in fog). */
const WEATHER_GATHER: Record<string, Record<string, string>> = JSON.parse(
	readFileSync(join(root, 'data/weather.json'), 'utf8'),
).gather;
const yields = (biome: any) =>
	new Set<string>([
		...(biome.resources || []),
		...(biome.digResources || []),
		...Object.values(WEATHER_GATHER[biome.id] || {}),
	]);

describe('which area the guides are for', () => {
	it('is the area you are standing in', () => {
		for (const b of BIOMES) expect(guideBiomeFor(b.id)).toBe(b.id);
	});

	it('follows your camp out of the house', () => {
		// The home interior is its own area id, and it has no animals of its own —
		// but the camp it belongs to is pitched in the meadow, so the bench there
		// sells meadow guides rather than showing an empty shelf.
		expect(guideBiomeFor('home')).toBe('meadow');
	});

	it('follows a trail tent to the biome it was pitched in', () => {
		expect(guideBiomeFor('tent-wetland')).toBe('wetland');
		expect(guideBiomeFor('tent-coastal')).toBe('coastal');
	});

	it('falls back to the meadow rather than nothing', () => {
		// A save mid-load has no area yet, and a client one release ahead could send
		// an area this build has never heard of. Neither should empty the shelf.
		expect(guideBiomeFor(undefined)).toBe('meadow');
		expect(guideBiomeFor('')).toBe('meadow');
		expect(guideBiomeFor('somewhere-else')).toBe('somewhere-else');
	});
});

describe('how far a guide is written up', () => {
	it('starts at pocket notes, written or not', () => {
		expect(guideLevel(undefined, 'meadow')).toBe(1);
		expect(guideLevel({}, 'meadow')).toBe(1);
		expect(hasGuide({}, 'meadow')).toBe(false);
		expect(hasExpandedGuide({}, 'meadow')).toBe(false);
	});

	it('opens the animal pages at the field guide, and nothing more', () => {
		// The middle rung is the one that has to hold: the full page is open, and
		// the exact requirements are still the next thing to work toward.
		const tools = { 'journal-forest': 2 };
		expect(hasGuide(tools, 'forest')).toBe(true);
		expect(hasExpandedGuide(tools, 'forest')).toBe(false);
	});

	it('opens the requirements at the expanded edition', () => {
		const tools = { 'journal-forest': 3 };
		expect(hasGuide(tools, 'forest')).toBe(true);
		expect(hasExpandedGuide(tools, 'forest')).toBe(true);
	});

	it('keeps areas independent of each other', () => {
		const tools = { 'journal-meadow': 3 };
		expect(hasExpandedGuide(tools, 'meadow')).toBe(true);
		expect(hasGuide(tools, 'forest')).toBe(false);
	});
});

describe('the six guides in data/tools.json', () => {
	it('ships one for every area, and no preserve-wide journal', () => {
		for (const b of BIOMES) expect(byId.get(guideToolId(b.id))?.journalBiome).toBe(b.id);
		expect(byId.has('field-journal')).toBe(false);
		expect(TOOLS.filter((t) => t.journalBiome)).toHaveLength(BIOMES.length);
	});

	it('gives every guide exactly three rungs, the first one free', () => {
		// The tools menu offers "the next level" of an entry, one at a time — so
		// these three rungs ARE the interface: pocket notes to start with, the field
		// guide offered first, and the expanded edition offered once that's done.
		for (const tool of TOOLS.filter((t) => t.journalBiome)) {
			expect([tool.id, tool.tiers.map((t: any) => t.tier)]).toEqual([tool.id, [1, 2, 3]]);
			expect(tool.tiers[0].materials).toBeUndefined(); // you start holding it
		}
	});

	it('asks only for materials that exist', () => {
		for (const tool of TOOLS.filter((t) => t.journalBiome)) {
			for (const tier of tool.tiers) {
				for (const id of Object.keys(tier.materials || {})) {
					expect([tool.id, id, RESOURCES.has(id)]).toEqual([tool.id, id, true]);
				}
			}
		}
	});

	it('costs meaningfully more for the expanded edition', () => {
		for (const b of BIOMES) {
			const tiers = byId.get(guideToolId(b.id)).tiers;
			const sum = (m: Record<string, number>) => Object.values(m).reduce((a, x) => a + x, 0);
			expect([b.id, sum(tiers[2].materials) > sum(tiers[1].materials) * 1.5]).toEqual([b.id, true]);
		}
	});

	it('is written entirely from what its own area provides', () => {
		// A guide to a place is made out of that place. Nothing in either rung may
		// send the caretaker somewhere else to finish a book about where they are —
		// which also means no guide can be gated behind an area that is still shut.
		for (const biome of BIOMES) {
			const here = yields(biome);
			for (const tier of byId.get(guideToolId(biome.id)).tiers) {
				const foreign = Object.keys(tier.materials || {}).filter((m) => !here.has(m));
				expect([biome.id, tier.tier, foreign]).toEqual([biome.id, tier.tier, []]);
			}
		}
	});

	it('asks the expanded edition for one more material than the field guide', () => {
		// The shape of the step up: everything the field guide wanted, doubled, plus
		// one thing it didn't ask for. That last material is what makes the expanded
		// edition read as a real undertaking rather than a second receipt.
		for (const biome of BIOMES) {
			const [, guide, expanded] = byId.get(guideToolId(biome.id)).tiers;
			const before = Object.keys(guide.materials);
			const after = Object.keys(expanded.materials);
			expect([biome.id, before.filter((m) => !after.includes(m))]).toEqual([biome.id, []]);
			expect([biome.id, after.length]).toEqual([biome.id, before.length + 1]);
			for (const m of before) {
				expect([biome.id, m, expanded.materials[m]]).toEqual([biome.id, m, guide.materials[m] * 2]);
			}
		}
	});
});

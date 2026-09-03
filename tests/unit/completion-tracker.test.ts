import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { completionGroups, overallCompletion } from '../../src/ui/Completion';
import type { GameData, GameState } from '../../src/types';

// The Completion tab of the Achievements menu answers "what is left?", and it
// answers it from the snapshot the client already holds — no server tally. That
// makes the arithmetic the whole feature, so it is pinned here against the real
// data files rather than a hand-written fixture: a new recipe or a seventh area
// must move these totals, not quietly leave a track measuring the wrong whole.
//
// The two ends are what matter. A brand-new save must read 0% with nothing
// finished, and a save that has done everything must read exactly 100% — a
// tracker that tops out at 97% because one track can't be completed is worse
// than no tracker at all.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

const BIOMES = load('data/biomes.json');
const ANIMALS = [...load('data/animals-1.json'), ...load('data/animals-2.json')];
const RECIPES = load('data/recipes.json');
const OBJECTS = load('data/habitat-objects.json');
const TOOLS = load('data/tools.json');
const ACHIEVEMENTS = load('data/achievements.json');

// Home tracks live in the server's defs rather than a data file; the tab only
// reads how many levels each has, so a minimal stand-in is enough.
const homeTracks: any = {
	space: { levels: [{}, {}, {}] },
	comfort: { levels: [{}, {}, {}] },
	decor: { levels: [{}, {}, {}] },
	light: { levels: [{}, {}, {}] },
};

const data = {
	biomes: BIOMES,
	animals: ANIMALS,
	recipes: RECIPES,
	habitatObjects: OBJECTS,
	tools: TOOLS,
	achievements: ACHIEVEMENTS,
	homeStyles: {},
	homeTracks,
} as unknown as GameData;

/** t() stands in as the identity on keys — labels aren't what's under test. */
const tr = (key: string) => key;

const emptyState = {
	player: {
		id: 'p',
		name: 'New',
		area: 'meadow',
		x: 0,
		y: 0,
		inventory: {},
		craftedItems: {},
		craftedEver: {},
		tools: {},
		unlockedBiomes: ['meadow'],
	},
	biomeStates: [{ id: 'b', biomeId: 'meadow', health: 0, balance: 0, returnedCount: 0, unlocked: true }],
	placements: [],
	chests: [],
	discoveries: [],
	nodeStates: [],
	terrain: [],
	achievements: [],
	feed: [],
	serverTime: 0,
	nodeRegenSeconds: 60,
	inventoryCapacity: 100,
} as unknown as GameState;

/** A save with every countable thing done. */
const explorable = BIOMES.filter((b) => b.explorable);
const placeable = OBJECTS.filter((o) => o.placement !== 'none');
const fullState = {
	...emptyState,
	player: {
		...emptyState.player,
		craftedEver: Object.fromEntries(RECIPES.map((r) => [r.output.itemId, 1])),
		tools: Object.fromEntries(TOOLS.map((t) => [t.id, t.tiers.length])),
		unlockedBiomes: explorable.map((b) => b.id),
		home: { style: 'cabin', styleLocked: true, space: 3, comfort: 3, decor: 3, light: 3 },
	},
	biomeStates: explorable.map((b) => ({ id: b.id, biomeId: b.id, health: 100, balance: 100, returnedCount: 0 })),
	placements: placeable.map((o, i) => ({ id: `pl-${i}`, objectId: o.id, area: 'meadow', x: i, y: 0 })),
	discoveries: ANIMALS.map((a, i) => ({
		id: `d-${i}`,
		animalId: a.id,
		biomeId: a.biome,
		comfort: 1,
		timesObserved: 1,
		firstObservedAt: 0,
		whyReturned: '',
	})),
	achievements: ACHIEVEMENTS.map((a) => a.id),
} as unknown as GameState;

const rows = (state: GameState) => {
	const out = new Map<string, { cur: number; target: number }>();
	for (const g of completionGroups(data, state, tr)) for (const r of g.rows) out.set(r.id, r);
	return out;
};

describe('completion tracker', () => {
	it('reads 0% on a brand-new save, with one area open', () => {
		const r = rows(emptyState);
		expect(r.get('recipes')).toMatchObject({ cur: 0, target: RECIPES.length });
		expect(r.get('animals')).toMatchObject({ cur: 0, target: ANIMALS.length });
		expect(r.get('areas')).toMatchObject({ cur: 1, target: explorable.length });
		expect(r.get('restored')!.cur).toBe(0);
		expect(r.get('home')!.cur).toBe(0); // a canvas tent is not a house yet
		expect(overallCompletion(completionGroups(data, emptyState, tr))).toBeLessThan(0.1);
	});

	it('reads exactly 100% when every track is finished', () => {
		const r = rows(fullState);
		for (const [id, row] of r) expect(`${id}: ${row.cur}/${row.target}`).toBe(`${id}: ${row.target}/${row.target}`);
		expect(overallCompletion(completionGroups(data, fullState, tr))).toBe(1);
	});

	it('measures every track against a non-empty whole', () => {
		// A target of 0 would read as 0% forever and drag the headline down.
		for (const [id, row] of rows(emptyState)) expect(`${id}: ${row.target}`).not.toBe(`${id}: 0`);
	});

	it('weights each track equally, so no single count dominates', () => {
		// Every recipe crafted and nothing else: one of the tracks, not most of
		// the preserve, even though recipes are the biggest count in the game.
		const onlyRecipes = {
			...emptyState,
			player: { ...emptyState.player, craftedEver: Object.fromEntries(RECIPES.map((r) => [r.output.itemId, 1])) },
		} as unknown as GameState;
		const groups = completionGroups(data, onlyRecipes, tr);
		const trackCount = groups.reduce((n, g) => n + g.rows.length, 0);
		expect(overallCompletion(groups)).toBeCloseTo(
			// recipes finished, plus the one area a new save has open
			1 / trackCount + 1 / explorable.length / trackCount,
			5,
		);
	});
});

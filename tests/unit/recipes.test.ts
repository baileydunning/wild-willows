import { describe, it, expect } from 'vitest';
import {
	recipeUnlocked,
	unlockedRecipeIds,
	recipeMatchesSearch,
	recipeSearchScore,
	waterShape,
	upcomingRecipes,
	unlockDistance,
} from '../../src/recipes';
import type { GameData, GameState, RecipeDef, HabitatObjectDef, AnimalDef } from '../../src/types';

// --- tiny fixture builders -------------------------------------------------
// recipeUnlocked only reads a handful of fields, so we build the smallest
// objects that exercise each branch rather than dragging in real game data.

function obj(partial: Partial<HabitatObjectDef> & { id: string }): HabitatObjectDef {
	return {
		name: partial.id,
		placement: 'outdoor',
		biomes: ['meadow'],
		healthValue: 1,
		needs: [],
		shape: 'x',
		color: '#000',
		description: '',
		...partial,
	};
}

function animal(id: string, biome: string): AnimalDef {
	return { id, biome } as AnimalDef;
}

function recipe(partial: Partial<RecipeDef> & { id: string; output: { itemId: string; qty: number } }): RecipeDef {
	return {
		name: partial.id,
		category: 'habitat',
		unlockBiome: 'meadow',
		materials: {},
		...partial,
	};
}

function makeData(over: Partial<GameData> = {}): GameData {
	return {
		biomes: [],
		animals: [],
		resources: [],
		recipes: [],
		habitatObjects: [],
		tools: [],
		achievements: [],
		homeStyles: {},
		homeTracks: {},
		nodeRegenSeconds: 75,
		appearanceOptions: { skins: [], hair: [], outfits: [], hats: [], hairstyles: [], bodies: [] },
		...over,
	};
}

function makeState(over: Partial<GameState> = {}, player: Partial<GameState['player']> = {}): GameState {
	return {
		player: {
			id: 'p1',
			name: 'Tester',
			area: 'meadow',
			x: 0,
			y: 0,
			inventory: {},
			craftedItems: {},
			craftedEver: {},
			tools: {},
			unlockedBiomes: ['meadow'],
			...player,
		},
		biomeStates: [],
		placements: [],
		chests: [],
		discoveries: [],
		nodeStates: [],
		terrain: [],
		achievements: [],
		feed: [],
		serverTime: Date.now(),
		nodeRegenSeconds: 75,
		inventoryCapacity: 200,
		...over,
	};
}

describe('recipeUnlocked', () => {
	it('a starter recipe (no unlock gate) in an open biome is craftable', () => {
		const r = recipe({ id: 'grass-patch', output: { itemId: 'grass-patch', qty: 1 } });
		const data = makeData({ habitatObjects: [obj({ id: 'grass-patch' })] });
		expect(recipeUnlocked(r, data, makeState())).toBe(true);
	});

	it('never offers plantable outputs in the crafting menu', () => {
		const r = recipe({ id: 'wildflower', output: { itemId: 'wildflower', qty: 1 } });
		const data = makeData({ habitatObjects: [obj({ id: 'wildflower', plantable: true })] });
		expect(recipeUnlocked(r, data, makeState())).toBe(false);
	});

	it('devUnlockAll forces craftable — except plantables', () => {
		const data = makeData({
			habitatObjects: [obj({ id: 'fancy' }), obj({ id: 'rose', plantable: true })],
		});
		const gated = recipe({
			id: 'fancy',
			output: { itemId: 'fancy', qty: 1 },
			unlock: { minHealth: 999, label: 'x' },
		});
		const plant = recipe({ id: 'rose', output: { itemId: 'rose', qty: 1 } });
		const st = makeState({}, { devUnlockAll: true });
		expect(recipeUnlocked(gated, data, st)).toBe(true);
		expect(recipeUnlocked(plant, data, st)).toBe(false);
	});

	it('indoor furniture needs the home Space track to be high enough', () => {
		const r = recipe({ id: 'fireplace', output: { itemId: 'fireplace', qty: 1 } });
		const data = makeData({ habitatObjects: [obj({ id: 'fireplace', placement: 'indoor', homeMin: 3 })] });
		expect(
			recipeUnlocked(r, data, makeState({}, { home: { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1 } })),
		).toBe(false);
		expect(
			recipeUnlocked(r, data, makeState({}, { home: { style: 'cabin', space: 3, comfort: 1, decor: 1, light: 1 } })),
		).toBe(true);
	});

	it('a recipe whose biome is still locked is not craftable', () => {
		const r = recipe({ id: 'reed-mat', unlockBiome: 'wetland', output: { itemId: 'reed-mat', qty: 1 } });
		const data = makeData({ habitatObjects: [obj({ id: 'reed-mat', biomes: ['wetland'] })] });
		expect(recipeUnlocked(r, data, makeState())).toBe(false); // only meadow unlocked
		expect(recipeUnlocked(r, data, makeState({}, { unlockedBiomes: ['meadow', 'wetland'] }))).toBe(true);
	});

	it('enforces a minHealth gate against the biome state', () => {
		const r = recipe({ id: 'pond', output: { itemId: 'pond', qty: 1 }, unlock: { minHealth: 25, label: 'x' } });
		const data = makeData({ habitatObjects: [obj({ id: 'pond' })] });
		const low = makeState({
			biomeStates: [{ id: 'b', biomeId: 'meadow', health: 10, balance: 0, returnedCount: 0, unlocked: true }],
		});
		const high = makeState({
			biomeStates: [{ id: 'b', biomeId: 'meadow', health: 30, balance: 0, returnedCount: 0, unlocked: true }],
		});
		expect(recipeUnlocked(r, data, low)).toBe(false);
		expect(recipeUnlocked(r, data, high)).toBe(true);
	});

	it('enforces animalsReturned and requiresAnimal gates from discoveries', () => {
		const data = makeData({
			habitatObjects: [obj({ id: 'feeder' })],
			animals: [animal('grasshopper', 'meadow'), animal('rabbit', 'meadow')],
		});
		const countGate = recipe({
			id: 'feeder',
			output: { itemId: 'feeder', qty: 1 },
			unlock: { animalsReturned: 2, label: 'x' },
		});
		const oneAnimal = makeState({
			discoveries: [
				{
					id: 'd1',
					animalId: 'grasshopper',
					biomeId: 'meadow',
					comfort: 1,
					timesObserved: 1,
					firstObservedAt: 0,
					whyReturned: '',
				},
			],
		});
		expect(recipeUnlocked(countGate, data, oneAnimal)).toBe(false);
		const twoAnimals = makeState({
			discoveries: [
				{
					id: 'd1',
					animalId: 'grasshopper',
					biomeId: 'meadow',
					comfort: 1,
					timesObserved: 1,
					firstObservedAt: 0,
					whyReturned: '',
				},
				{
					id: 'd2',
					animalId: 'rabbit',
					biomeId: 'meadow',
					comfort: 1,
					timesObserved: 1,
					firstObservedAt: 0,
					whyReturned: '',
				},
			],
		});
		expect(recipeUnlocked(countGate, data, twoAnimals)).toBe(true);

		const needRabbit = recipe({
			id: 'feeder',
			output: { itemId: 'feeder', qty: 1 },
			unlock: { requiresAnimal: 'rabbit', label: 'x' },
		});
		expect(recipeUnlocked(needRabbit, data, oneAnimal)).toBe(false);
		expect(recipeUnlocked(needRabbit, data, twoAnimals)).toBe(true);
	});

	it('enforces a requiresCrafted prerequisite', () => {
		const r = recipe({
			id: 'deluxe',
			output: { itemId: 'deluxe', qty: 1 },
			unlock: { requiresCrafted: 'basic', label: 'x' },
		});
		const data = makeData({ habitatObjects: [obj({ id: 'deluxe' })] });
		expect(recipeUnlocked(r, data, makeState())).toBe(false);
		expect(recipeUnlocked(r, data, makeState({}, { craftedEver: { basic: 1 } }))).toBe(true);
	});
});

// Every recipe now waits on its own condition, drawn from a different corner of
// the game. Each branch below is one of those corners.
describe('recipeUnlocked — the wider unlock vocabulary', () => {
	const data = makeData({
		habitatObjects: [obj({ id: 'thing' }), obj({ id: 'grass-patch' })],
		animals: [
			animal('grasshopper', 'meadow'),
			{ ...animal('sparrow', 'meadow'), kind: 'bird' } as AnimalDef,
			{ ...animal('wren', 'meadow'), kind: 'bird' } as AnimalDef,
			{ ...animal('otter', 'wetland'), kind: 'mammal' } as AnimalDef,
		],
	});
	const gated = (unlock: any) => recipe({ id: 'thing', output: { itemId: 'thing', qty: 1 }, unlock });
	const disc = (animalId: string, biomeId = 'meadow') => ({
		id: `d-${animalId}`,
		animalId,
		biomeId,
		comfort: 1,
		timesObserved: 1,
		firstObservedAt: 0,
		whyReturned: '',
	});
	const bstate = (biomeId: string, health: number, balance = 0) => ({
		id: `bs-${biomeId}`,
		biomeId,
		health,
		balance,
		returnedCount: 0,
		unlocked: true,
	});

	it('gates on ecological balance, not just health', () => {
		const r = gated({ minBalance: 40, label: 'x' });
		expect(recipeUnlocked(r, data, makeState({ biomeStates: [bstate('meadow', 90, 20)] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ biomeStates: [bstate('meadow', 10, 45)] }))).toBe(true);
	});

	it('gates on how many animals of one kind are back', () => {
		const r = gated({ requiresKind: { kind: 'bird', count: 2 }, label: 'x' });
		expect(recipeUnlocked(r, data, makeState({ discoveries: [disc('sparrow'), disc('grasshopper')] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ discoveries: [disc('sparrow'), disc('wren')] }))).toBe(true);
	});

	it('gates on animals returned across the whole preserve', () => {
		const r = gated({ totalAnimals: 2, label: 'x' });
		expect(recipeUnlocked(r, data, makeState({ discoveries: [disc('sparrow')] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ discoveries: [disc('sparrow'), disc('otter', 'wetland')] }))).toBe(true);
	});

	it('gates on how widely you have crafted', () => {
		const r = gated({ craftedDistinct: 3, label: 'x' });
		expect(recipeUnlocked(r, data, makeState({}, { craftedEver: { a: 1, b: 1 } }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({}, { craftedEver: { a: 1, b: 1, c: 2 } }))).toBe(true);
	});

	it('gates on copies of something standing in THIS area', () => {
		const r = gated({ requiresPlaced: { objectId: 'grass-patch', count: 2 }, label: 'x' });
		const pl = (area: string, i: number) => ({ id: `p${i}`, objectId: 'grass-patch', area, x: i, y: 0 });
		expect(recipeUnlocked(r, data, makeState({ placements: [pl('meadow', 1)] }))).toBe(false);
		// two, but one of them is in another area — the gate is area-scoped
		expect(recipeUnlocked(r, data, makeState({ placements: [pl('meadow', 1), pl('forest', 2)] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ placements: [pl('meadow', 1), pl('meadow', 2)] }))).toBe(true);
	});

	it('answers for a biome the player is not standing in', () => {
		// The snapshot carries the area on screen (plus the home interior), so a
		// recipe gated on the WETLAND cannot be answered by counting rows once the
		// player walks back to the meadow. Both gates read the numbers the server
		// stores per biome — `objectCounts` and `playerWater` — which is what keeps
		// a recipe that was unlocked in the wetland reading unlocked from anywhere.
		const wetland = (unlock: any) =>
			recipe({ id: 'reed-mat', output: { itemId: 'reed-mat', qty: 1 }, unlockBiome: 'wetland', unlock });
		const away = (over: any) =>
			makeState(
				{
					biomeStates: [{ ...bstate('wetland', 100), ...over }],
					// standing in the meadow: the wetland's rows are not in the payload
					placements: [],
					terrain: [],
				},
				{ area: 'meadow', unlockedBiomes: ['meadow', 'wetland'] },
			);

		const placeGate = wetland({ requiresPlaced: { objectId: 'grass-patch', count: 2 }, label: 'x' });
		expect(recipeUnlocked(placeGate, data, away({ objectCounts: { 'grass-patch': 1 } }))).toBe(false);
		expect(recipeUnlocked(placeGate, data, away({ objectCounts: { 'grass-patch': 2 } }))).toBe(true);

		const waterGate = wetland({ requiresWater: { lake: 6 }, label: 'x' });
		expect(recipeUnlocked(waterGate, data, away({ playerWater: { tiles: 9, lake: 5, river: 3 } }))).toBe(false);
		const unlocked = away({ playerWater: { tiles: 9, lake: 9, river: 3 } });
		expect(recipeUnlocked(waterGate, data, unlocked)).toBe(true);
		// …and it is still unlocked on the next snapshot, which is the walk away.
		expect(recipeUnlocked(waterGate, data, unlocked)).toBe(true);
		// The distance readout has to agree with the gate, or "coming up next" tells
		// the player to go and do something they have already done.
		expect(unlockDistance(waterGate, data, unlocked)).toBe(0);
	});

	it('gates on water you have shaped, by pond size as well as tile count', () => {
		const tile = (x: number, y: number, type: any = 'water', area = 'meadow') => ({
			id: `t${x}-${y}-${area}`,
			area,
			x,
			y,
			type,
		});
		// an L of 3 connected tiles plus one stray, and a watered bed that isn't water
		const terrain = [tile(1, 1), tile(2, 1), tile(2, 2), tile(9, 9), tile(4, 4, 'watered')];
		const st = makeState({ terrain });
		expect(waterShape(st, 'meadow')).toEqual({ tiles: 4, lake: 3, river: 2 });
		expect(recipeUnlocked(gated({ requiresWater: { tiles: 4 }, label: 'x' }), data, st)).toBe(true);
		expect(recipeUnlocked(gated({ requiresWater: { lake: 4 }, label: 'x' }), data, st)).toBe(false);
		expect(recipeUnlocked(gated({ requiresWater: { lake: 3 }, label: 'x' }), data, st)).toBe(true);
	});

	// Rushwater Wetland opens with 18 tiles of channel and pond already shaped
	// (STARTING_TERRAIN in server/resources.ts). That is scenery the player was
	// handed, not work they did, so a "Shape 6 water tiles" gate has to stay shut
	// until they dig their own. The server counts the same way — recipeUnlockContext
	// passes analyzeWater(terrain, true) — and this mirror used to disagree with it,
	// showing the recipe as unlocked while the craft itself was refused.
	it("does not count the area's pre-seeded starting water", () => {
		const wet = (x: number, y: number, seeded = false) => ({
			id: `t${x}-${y}`,
			area: 'meadow',
			x,
			y,
			type: 'water' as const,
			...(seeded ? { seeded: true } : {}),
		});
		const r = gated({ requiresWater: { tiles: 6 }, label: 'x' });

		// six seeded tiles in a row: enough to satisfy the gate on a raw count
		const seeded = makeState({ terrain: [0, 1, 2, 3, 4, 5].map((x) => wet(x, 4, true)) });
		expect(waterShape(seeded, 'meadow')).toEqual({ tiles: 0, lake: 0, river: 0 });
		expect(recipeUnlocked(r, data, seeded)).toBe(false);
		expect(unlockDistance(r, data, seeded)).toBe(6); // still six tiles of digging away

		// dig six of your own alongside them and it opens
		const dug = makeState({
			terrain: [...seeded.terrain, ...[0, 1, 2, 3, 4, 5].map((x) => wet(x, 9))],
		});
		expect(waterShape(dug, 'meadow')).toEqual({ tiles: 6, lake: 6, river: 6 });
		expect(recipeUnlocked(r, data, dug)).toBe(true);
	});

	it('gates on an upgraded tool', () => {
		const r = gated({ requiresTool: { id: 'shovel', tier: 3 }, label: 'x' });
		expect(recipeUnlocked(r, data, makeState({}, { tools: { shovel: 2 } }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({}, { tools: { shovel: 3 } }))).toBe(true);
	});

	it('gates on a home upgrade track', () => {
		const r = gated({ requiresHome: { track: 'comfort', level: 3 }, label: 'x' });
		const home = (comfort: number) => ({ style: 'cabin', space: 1, comfort, decor: 1, light: 1 });
		expect(recipeUnlocked(r, data, makeState({}, { home: home(2) }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({}, { home: home(3) }))).toBe(true);
	});

	it('gates on having built a home — the tent does not count', () => {
		const r = gated({ homeBuilt: true, label: 'x' });
		const tent = { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1 };
		expect(recipeUnlocked(r, data, makeState({}, { home: tent }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({}, { home: { ...tent, space: 2, styleLocked: true } }))).toBe(true);
	});

	it('gates on your first nightfall — and stays unlocked once night has passed', () => {
		const r = gated({ phaseSeen: ['night'], label: 'x' });
		const sky = (dayPhase: string, seenPhases: string[]) =>
			makeState({
				weather: { season: 'summer', dayPhase, dayProgress: 0.5, dayIndex: 0, dayMs: 1440000, seenPhases, byBiome: {} },
			});
		// first day, sun still up: night hasn't happened yet
		expect(recipeUnlocked(r, data, sky('day', ['dawn', 'day']))).toBe(false);
		expect(recipeUnlocked(r, data, sky('dusk', ['dawn', 'day', 'dusk']))).toBe(false);
		// night falls
		expect(recipeUnlocked(r, data, sky('night', ['dawn', 'day', 'dusk', 'night']))).toBe(true);
		// …and the next morning it is STILL there. This is the whole point.
		expect(recipeUnlocked(r, data, sky('day', ['dawn', 'day', 'dusk', 'night']))).toBe(true);
		expect(recipeUnlocked(r, data, makeState())).toBe(false); // no clock yet
		// it's never far off, so it sorts to the front of "coming up next"
		const soon = unlockDistance(r, data, sky('day', ['dawn', 'day']));
		expect(soon).toBeLessThan(unlockDistance(gated({ minHealth: 40, label: 'x' }), data, sky('day', ['day'])));
	});

	it('gates on progress in a different area', () => {
		const r = gated({ requiresBiome: { biome: 'forest', minHealth: 80 }, label: 'x' });
		const st = (h: number) =>
			makeState(
				{ biomeStates: [bstate('meadow', 100), bstate('forest', h)] },
				{ unlockedBiomes: ['meadow', 'forest'] },
			);
		expect(recipeUnlocked(r, data, st(70))).toBe(false);
		expect(recipeUnlocked(r, data, st(85))).toBe(true);
	});

	it('gates on an achievement, and on how much of the preserve is open', () => {
		expect(recipeUnlocked(gated({ requiresAchievement: 'meadow-mender', label: 'x' }), data, makeState())).toBe(false);
		expect(
			recipeUnlocked(
				gated({ requiresAchievement: 'meadow-mender', label: 'x' }),
				data,
				makeState({ achievements: ['meadow-mender'] }),
			),
		).toBe(true);
		const open = gated({ biomesOpen: 3, label: 'x' });
		expect(recipeUnlocked(open, data, makeState({}, { unlockedBiomes: ['meadow', 'forest'] }))).toBe(false);
		expect(recipeUnlocked(open, data, makeState({}, { unlockedBiomes: ['meadow', 'forest', 'wetland'] }))).toBe(true);
	});

	it('requires EVERY listed condition, not just one', () => {
		const r = gated({ minHealth: 20, requiresAnimal: 'grasshopper', label: 'x' });
		const withAnimal = { discoveries: [disc('grasshopper')] };
		expect(recipeUnlocked(r, data, makeState({ ...withAnimal, biomeStates: [bstate('meadow', 10)] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ biomeStates: [bstate('meadow', 30)] }))).toBe(false);
		expect(recipeUnlocked(r, data, makeState({ ...withAnimal, biomeStates: [bstate('meadow', 30)] }))).toBe(true);
	});
});

describe('upcomingRecipes', () => {
	const data = makeData({
		habitatObjects: [
			obj({ id: 'near' }),
			obj({ id: 'far' }),
			obj({ id: 'open' }),
			obj({ id: 'seed', plantable: true }),
		],
		recipes: [
			recipe({ id: 'open', output: { itemId: 'open', qty: 1 } }),
			recipe({ id: 'near', output: { itemId: 'near', qty: 1 }, unlock: { minHealth: 20, label: 'soon' } }),
			recipe({ id: 'far', output: { itemId: 'far', qty: 1 }, unlock: { minHealth: 90, label: 'later' } }),
			recipe({ id: 'seed', output: { itemId: 'seed', qty: 1 }, unlock: { minHealth: 30, label: 'plant' } }),
		],
	});
	const state = makeState({
		biomeStates: [{ id: 'b', biomeId: 'meadow', health: 10, balance: 0, returnedCount: 0, unlocked: true }],
	});

	it('lists what is still locked, closest first, and never plantables', () => {
		const up = upcomingRecipes(data, state, { limit: 5 });
		expect(up.map((u) => u.recipe.id)).toEqual(['near', 'far']);
		expect(up[0].distance).toBe(10);
	});

	it('honours the limit, the area filter, and skipped items', () => {
		expect(upcomingRecipes(data, state, { limit: 1 }).map((u) => u.recipe.id)).toEqual(['near']);
		expect(upcomingRecipes(data, state, { area: 'forest' })).toEqual([]);
		expect(upcomingRecipes(data, state, { skipItemIds: new Set(['near']) }).map((u) => u.recipe.id)).toEqual(['far']);
	});

	it('reports zero distance for a recipe that is already unlocked', () => {
		expect(unlockDistance(data.recipes[0], data, state)).toBe(0);
	});

	// `area` can only narrow by the biome a recipe UNLOCKS in, which cannot express
	// the crafting panel's "Home" filter — Home means indoor-placeable, and indoor
	// recipes unlock in ordinary outdoor biomes. Home therefore used to fall back to
	// area: 'all' and recommend outdoor recipes from every open biome. `match` lets
	// the panel hand over the very same Place predicate it filters the list with.
	it('accepts an arbitrary predicate, so Home can scope to indoor things', () => {
		const indoorData = makeData({
			habitatObjects: [obj({ id: 'shelf', placement: 'indoor' }), obj({ id: 'bench', placement: 'outdoor' })],
			recipes: [
				recipe({ id: 'shelf', output: { itemId: 'shelf', qty: 1 }, unlock: { minHealth: 20, label: 'soon' } }),
				recipe({ id: 'bench', output: { itemId: 'bench', qty: 1 }, unlock: { minHealth: 30, label: 'later' } }),
			],
		});
		const objOf = (r: RecipeDef) => indoorData.habitatObjects.find((o) => o.id === r.output.itemId);
		const indoorOnly = (r: RecipeDef) => {
			const o = objOf(r);
			return o?.placement === 'indoor' || o?.placement === 'both';
		};

		// without a predicate both are recommended, outdoor bench included
		expect(upcomingRecipes(indoorData, state, {}).map((u) => u.recipe.id)).toEqual(['shelf', 'bench']);
		expect(upcomingRecipes(indoorData, state, { match: indoorOnly }).map((u) => u.recipe.id)).toEqual(['shelf']);
	});
});

describe('unlockedRecipeIds', () => {
	it('returns the set of currently-craftable recipe ids', () => {
		const data = makeData({
			habitatObjects: [obj({ id: 'a' }), obj({ id: 'b' }), obj({ id: 'c', plantable: true })],
			recipes: [
				recipe({ id: 'a', output: { itemId: 'a', qty: 1 } }),
				recipe({ id: 'b', output: { itemId: 'b', qty: 1 }, unlock: { minHealth: 50, label: 'x' } }),
				recipe({ id: 'c', output: { itemId: 'c', qty: 1 } }),
			],
		});
		const ids = unlockedRecipeIds(data, makeState());
		expect(ids.has('a')).toBe(true); // starter
		expect(ids.has('b')).toBe(false); // health gate not met
		expect(ids.has('c')).toBe(false); // plantable, never crafted
	});

	it('returns an empty set when data or state is missing', () => {
		expect(unlockedRecipeIds(null, null).size).toBe(0);
		expect(unlockedRecipeIds(makeData(), null).size).toBe(0);
	});
});

describe('recipeMatchesSearch', () => {
	const r = recipe({
		id: 'bird-perch',
		name: 'Bird Perch',
		category: 'habitat',
		output: { itemId: 'bird-perch', qty: 1 },
	});
	const o = obj({ id: 'bird-perch', name: 'Bird Perch', description: 'A cozy spot where songbirds love to rest.' });

	it('matches everything when the query is empty or whitespace', () => {
		expect(recipeMatchesSearch(r, o, 'Habitat objects', '')).toBe(true);
		expect(recipeMatchesSearch(r, o, 'Habitat objects', '   ')).toBe(true);
	});

	it('matches the recipe name, case-insensitively', () => {
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'bird')).toBe(true);
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'PERCH')).toBe(true);
	});

	it('matches the produced object name and description', () => {
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'songbirds')).toBe(true);
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'cozy')).toBe(true);
	});

	it('matches the type label', () => {
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'habitat')).toBe(true);
	});

	it('does not match unrelated queries', () => {
		expect(recipeMatchesSearch(r, o, 'Habitat objects', 'pond')).toBe(false);
	});

	it('tolerates a missing object (searches name + type only)', () => {
		expect(recipeMatchesSearch(r, undefined, 'Habitat objects', 'bird')).toBe(true);
		expect(recipeMatchesSearch(r, undefined, 'Habitat objects', 'songbirds')).toBe(false);
	});
});

describe('recipeSearchScore', () => {
	const grass = recipe({
		id: 'grass-patch',
		name: 'Grass Patch',
		category: 'plant',
		output: { itemId: 'grass-patch', qty: 1 },
	});
	const grassObj = obj({ id: 'grass-patch', name: 'Grass Patch', description: 'A soft patch of native grasses.' });
	const oak = recipe({ id: 'oak-tree', name: 'Oak Tree', category: 'plant', output: { itemId: 'oak-tree', qty: 1 } });
	const oakObj = obj({ id: 'oak-tree', name: 'Oak Tree', description: 'Grows tall; grasshoppers shelter beneath it.' });

	it('ranks a name (word-prefix) hit above a description-only hit', () => {
		// playtest: searching "gr" put trees above Grass Patch
		const g = recipeSearchScore(grass, grassObj, 'Plants', 'gr');
		const o = recipeSearchScore(oak, oakObj, 'Plants', 'gr');
		expect(g).toBe(0);
		expect(o).toBeGreaterThan(g);
	});

	it('ranks name substring above type, materials, and description', () => {
		const sub = recipeSearchScore(grass, grassObj, 'Plants', 'rass'); // name substring
		const typ = recipeSearchScore(oak, oakObj, 'Plants', 'plant'); // type label
		const mat = recipeSearchScore(oak, oakObj, 'Plants', 'clay', ['Clay']); // ingredient
		const desc = recipeSearchScore(oak, oakObj, 'Plants', 'shelter'); // description only
		expect(sub).toBeLessThan(typ);
		expect(typ).toBeLessThan(mat);
		expect(mat).toBeLessThan(desc);
	});

	it('scores 0 for empty queries and -1 for no match', () => {
		expect(recipeSearchScore(grass, grassObj, 'Plants', '  ')).toBe(0);
		expect(recipeSearchScore(grass, grassObj, 'Plants', 'pond')).toBe(-1);
	});
});

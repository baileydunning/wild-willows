import { describe, it, expect } from 'vitest';
import { recipeUnlocked, unlockedRecipeIds, recipeMatchesSearch, recipeSearchScore } from '../../src/recipes';
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

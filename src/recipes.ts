// Recipe unlock logic, mirrored from the server (server/resources.ts).
// Harper is the source of truth and re-validates every craft; this is purely so
// the UI can hide locked recipes and announce newly unlocked ones.

import type { GameData, GameState, RecipeDef, HabitatObjectDef } from './types';

/**
 * How many of an object are standing in an area.
 *
 * The same arrangement as `waterShape` below, for the same reason: this is asked
 * about a RECIPE's biome, not the one on screen, and the snapshot carries only
 * the current area's placements. `objectCounts` is written per biome by
 * recalcBiome from that area's own rows, so it answers for a biome the player is
 * nowhere near — which is what keeps a wetland recipe reading unlocked while you
 * stand in the meadow.
 *
 * The local count stays as the fallback, for a biome whose row predates the
 * field, and it is exact whenever that area's placements are present — which is
 * always true for the area on screen.
 */
export function placedCount(state: GameState, biomeId: string, objectId: string): number {
	const stored = state.biomeStates?.find((b) => b.biomeId === biomeId)?.objectCounts;
	if (stored) return stored[objectId] || 0;
	return (state.placements || []).filter((p) => p.area === biomeId && p.objectId === objectId).length;
}

/** Animal ids that have returned in a given biome. */
function returnedInBiome(data: GameData, state: GameState, biomeId: string): Set<string> {
	const animalBiome = new Map(data.animals.map((a) => [a.id, a.biome]));
	return new Set(
		(state.discoveries || []).filter((d) => animalBiome.get(d.animalId) === biomeId).map((d) => d.animalId),
	);
}

/**
 * Open water the player has shaped in an area: total tiles, the largest connected
 * body ("lake") and the longest connected span ("river"). 4-neighbour flood fill,
 * mirrored from analyzeWater(terrain, true) in server/resources.ts.
 *
 * `seeded` tiles are excluded, exactly as the server excludes them: Rushwater
 * opens with 18 tiles of channel and pond already shaped, and counting those
 * showed a "Shape 6 water tiles" recipe as unlocked the moment the wetland
 * opened — while the server, which is the real gate, still refused the craft.
 */
export function waterShape(state: GameState, biomeId: string): { tiles: number; lake: number; river: number } {
	// The server stores this per biome (BiomeState.playerWater), computed by
	// recalcBiome from that biome's whole terrain list. Prefer it: this function is
	// asked about a RECIPE's biome, not the one on screen, and since the snapshot
	// stopped sending every area's tiles the local computation below can only see
	// the area the player is standing in. Reading the stored value is what keeps a
	// wetland recipe showing as unlocked while you stand in the meadow.
	//
	// The computation stays as the fallback, for a biome whose row predates the
	// field — and it is still exact whenever the tiles for that biome are present,
	// which is always true for the area on screen.
	const stored = state.biomeStates?.find((b) => b.biomeId === biomeId)?.playerWater;
	if (stored) return { tiles: stored.tiles || 0, lake: stored.lake || 0, river: stored.river || 0 };
	const cells = new Set(
		(state.terrain || [])
			.filter((t) => t.area === biomeId && t.type === 'water' && !t.seeded)
			.map((t) => `${t.x},${t.y}`),
	);
	const seen = new Set<string>();
	let lake = 0;
	let river = 0;
	for (const key of cells) {
		if (seen.has(key)) continue;
		const stack = [key];
		seen.add(key);
		let size = 0;
		let minx = Infinity;
		let maxx = -Infinity;
		let miny = Infinity;
		let maxy = -Infinity;
		while (stack.length) {
			const [x, y] = stack.pop()!.split(',').map(Number);
			size++;
			minx = Math.min(minx, x);
			maxx = Math.max(maxx, x);
			miny = Math.min(miny, y);
			maxy = Math.max(maxy, y);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nk = `${x + dx},${y + dy}`;
				if (cells.has(nk) && !seen.has(nk)) {
					seen.add(nk);
					stack.push(nk);
				}
			}
		}
		lake = Math.max(lake, size);
		river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
	}
	return { tiles: cells.size, lake, river };
}

/**
 * Is this recipe unlocked for the player right now?
 *
 * Every recipe past the handful of starters waits on its own condition, and those
 * conditions reach across the whole game — how far the area has recovered, which
 * animals are back, what you've already built and planted, the water you've
 * shaped, your tools, your home, even the other areas of the preserve. Harper
 * re-checks all of this on the way in (server/resources.ts recipeUnlockMet);
 * this mirror is what lets the menu hide what isn't earned yet.
 */
export function recipeUnlocked(recipe: RecipeDef, data: GameData, state: GameState): boolean {
	const player = state.player;
	// Plantable things (flowers, grasses, bushes, trees) are never crafted — you
	// plant them in a watered bed. Keep them out of the crafting menu entirely.
	const obj = data.habitatObjects.find((o) => o.id === recipe.output.itemId);
	if (obj?.plantable) return false;
	// dev override: every recipe is craftable (still never the plantables above)
	if (player.devUnlockAll) return true;
	// indoor furniture that needs a proper house can't be crafted until your home's
	// Space is upgraded that far (a tent only fits the basics)
	if (obj?.homeMin && (player.home?.space || 1) < obj.homeMin) return false;
	// the recipe's biome must be open at all
	if (recipe.unlockBiome && !player.unlockedBiomes.includes(recipe.unlockBiome)) return false;
	const u = recipe.unlock;
	if (!u) return true; // starter recipe

	const bs = state.biomeStates.find((b) => b.biomeId === recipe.unlockBiome);
	const health = bs?.health || 0;
	const returned = returnedInBiome(data, state, recipe.unlockBiome);

	// ---- this area's recovery
	if (typeof u.minHealth === 'number' && health < u.minHealth) return false;
	if (typeof u.minBalance === 'number' && (bs?.balance || 0) < u.minBalance) return false;

	// ---- the life that has come back
	if (typeof u.animalsReturned === 'number' && returned.size < u.animalsReturned) return false;
	if (u.requiresAnimal && !returned.has(u.requiresAnimal)) return false;
	if (u.requiresKind) {
		const kindOf = new Map(data.animals.map((a) => [a.id, a.kind]));
		const n = [...returned].filter((id) => kindOf.get(id) === u.requiresKind!.kind).length;
		if (n < u.requiresKind.count) return false;
	}
	if (typeof u.totalAnimals === 'number' && (state.discoveries || []).length < u.totalAnimals) return false;

	// ---- what your hands have made and put in the ground
	if (u.requiresCrafted && (player.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
	if (typeof u.craftedDistinct === 'number' && Object.keys(player.craftedEver || {}).length < u.craftedDistinct)
		return false;
	if (u.requiresPlaced) {
		const n = placedCount(state, recipe.unlockBiome, u.requiresPlaced.objectId);
		if (n < u.requiresPlaced.count) return false;
	}
	if (u.requiresWater) {
		const w = waterShape(state, recipe.unlockBiome);
		if (w.tiles < (u.requiresWater.tiles || 0)) return false;
		if (w.lake < (u.requiresWater.lake || 0)) return false;
		if (w.river < (u.requiresWater.river || 0)) return false;
	}

	// ---- your own kit: tools and the home you've built
	if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) return false;
	if (u.requiresHome && ((player.home as any)?.[u.requiresHome.track] || 1) < u.requiresHome.level) return false;
	// a house, not the starting tent — building one is what locks in a style
	if (u.homeBuilt && !player.home?.styleLocked) return false;
	// a time of day you have to have lived through once — and only once: the
	// headlamp turns up at your first nightfall and stays on the list after dawn
	if (u.phaseSeen?.length && !u.phaseSeen.some((p) => state.weather?.seenPhases?.includes(p))) return false;

	// ---- the wider preserve
	if (u.requiresBiome) {
		const other = state.biomeStates.find((b) => b.biomeId === u.requiresBiome!.biome);
		if ((other?.health || 0) < u.requiresBiome.minHealth) return false;
	}
	if (u.requiresAchievement && !(state.achievements || []).includes(u.requiresAchievement)) return false;
	if (typeof u.biomesOpen === 'number' && (player.unlockedBiomes || []).length < u.biomesOpen) return false;
	return true;
}

/**
 * How well does a recipe match the crafting-menu search box? Lower is better:
 *   0 — the recipe/output NAME starts with the query (or a word of it does)
 *   1 — the name contains the query somewhere
 *   2 — the type label matches
 *   3 — an ingredient name matches (search by what you have, e.g. "clay")
 *   4 — only the flavour description matches
 *  -1 — no match at all
 * The menu sorts by this so typing "gr" surfaces Grass Patch itself, not every
 * recipe whose description happens to mention "grows" (playtest: Grass Patch
 * was buried under trees when searching "grass").
 * An empty/whitespace query scores 0 for everything.
 */
export function recipeSearchScore(
	recipe: RecipeDef,
	obj: HabitatObjectDef | undefined,
	typeLabel: string,
	query: string,
	materialNames: string[] = [],
): number {
	const q = query.trim().toLowerCase();
	if (!q) return 0;
	const name = recipe.name.toLowerCase();
	const objName = (obj?.name || '').toLowerCase();
	const wordStarts = (s: string) => !!s && s.split(/\s+/).some((w) => w.startsWith(q));
	if (wordStarts(name) || wordStarts(objName)) return 0;
	if (name.includes(q) || objName.includes(q)) return 1;
	if ((typeLabel || '').toLowerCase().includes(q)) return 2;
	if (materialNames.some((m) => m.toLowerCase().includes(q))) return 3;
	if ((obj?.description || '').toLowerCase().includes(q)) return 4;
	return -1;
}

/**
 * Does a recipe match the crafting-menu search box at all? Case-insensitive
 * match against the recipe name, what it produces (object name + description),
 * its type label, and its ingredient names. An empty query matches everything.
 */
export function recipeMatchesSearch(
	recipe: RecipeDef,
	obj: HabitatObjectDef | undefined,
	typeLabel: string,
	query: string,
	materialNames: string[] = [],
): boolean {
	return recipeSearchScore(recipe, obj, typeLabel, query, materialNames) >= 0;
}

/** The set of recipe ids the player can currently craft. */
export function unlockedRecipeIds(data: GameData | null, state: GameState | null): Set<string> {
	if (!data || !state) return new Set();
	return new Set(data.recipes.filter((r) => recipeUnlocked(r, data, state)).map((r) => r.id));
}

/**
 * Roughly how far off a locked recipe is, for ordering the "coming up" list.
 * Health/balance gaps count in points; every other unmet condition counts as a
 * flat 12 (they're rarely a matter of degree — you either have the animal back
 * or you don't). Lower is closer. 0 means it's already unlocked.
 */
export function unlockDistance(recipe: RecipeDef, data: GameData, state: GameState): number {
	const u = recipe.unlock;
	if (!u || recipeUnlocked(recipe, data, state)) return 0;
	const bs = state.biomeStates.find((b) => b.biomeId === recipe.unlockBiome);
	const returned = returnedInBiome(data, state, recipe.unlockBiome);
	const player = state.player;
	let d = 0;
	if (typeof u.minHealth === 'number') d += Math.max(0, u.minHealth - (bs?.health || 0));
	if (typeof u.minBalance === 'number') d += Math.max(0, u.minBalance - (bs?.balance || 0));
	if (typeof u.animalsReturned === 'number') d += 6 * Math.max(0, u.animalsReturned - returned.size);
	if (u.requiresAnimal && !returned.has(u.requiresAnimal)) d += 12;
	if (u.requiresKind) {
		const kindOf = new Map(data.animals.map((a) => [a.id, a.kind]));
		const n = [...returned].filter((id) => kindOf.get(id) === u.requiresKind!.kind).length;
		d += 6 * Math.max(0, u.requiresKind.count - n);
	}
	if (typeof u.totalAnimals === 'number') d += 2 * Math.max(0, u.totalAnimals - (state.discoveries || []).length);
	if (u.requiresCrafted && !(player.craftedEver?.[u.requiresCrafted] || 0)) d += 12;
	if (typeof u.craftedDistinct === 'number')
		d += 2 * Math.max(0, u.craftedDistinct - Object.keys(player.craftedEver || {}).length);
	if (u.requiresPlaced) {
		const n = placedCount(state, recipe.unlockBiome, u.requiresPlaced.objectId);
		d += 6 * Math.max(0, u.requiresPlaced.count - n);
	}
	if (u.requiresWater) {
		const w = waterShape(state, recipe.unlockBiome);
		d += Math.max(0, (u.requiresWater.tiles || 0) - w.tiles);
		d += Math.max(0, (u.requiresWater.lake || 0) - w.lake);
		d += Math.max(0, (u.requiresWater.river || 0) - w.river);
	}
	if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) d += 12;
	if (u.requiresHome && ((player.home as any)?.[u.requiresHome.track] || 1) < u.requiresHome.level) d += 12;
	if (u.homeBuilt && !player.home?.styleLocked) d += 12;
	// near by definition — the sky comes round on its own, you just have to be there
	if (u.phaseSeen?.length && !u.phaseSeen.some((p) => state.weather?.seenPhases?.includes(p))) d += 4;
	if (u.requiresBiome) {
		const other = state.biomeStates.find((b) => b.biomeId === u.requiresBiome!.biome);
		d += Math.max(0, u.requiresBiome.minHealth - (other?.health || 0));
	}
	if (u.requiresAchievement && !(state.achievements || []).includes(u.requiresAchievement)) d += 12;
	if (typeof u.biomesOpen === 'number') d += 20 * Math.max(0, u.biomesOpen - (player.unlockedBiomes || []).length);
	return d;
}

/**
 * The next few things that will open up, nearest first — so a hidden recipe
 * reads as something to work toward instead of something that isn't there.
 * Only looks at areas that are already open, and skips plantables (never
 * crafted) and once-only kits (the "open the next area" goal already tracks
 * those).
 *
 * `area` narrows by the biome a recipe UNLOCKS in. `match` is the general form —
 * pass an arbitrary predicate when the caller scopes by something else, e.g. the
 * crafting panel's Place filter, which asks where a thing GOES ("Home" means
 * indoor-placeable, which no unlockBiome can express).
 */
export function upcomingRecipes(
	data: GameData | null,
	state: GameState | null,
	opts: { area?: string; limit?: number; skipItemIds?: Set<string>; match?: (recipe: RecipeDef) => boolean } = {},
): { recipe: RecipeDef; distance: number }[] {
	if (!data || !state) return [];
	const limit = opts.limit ?? 4;
	const plantable = new Set(data.habitatObjects.filter((o) => o.plantable).map((o) => o.id));
	return data.recipes
		.filter((r) => r.unlock && !plantable.has(r.output.itemId) && !opts.skipItemIds?.has(r.output.itemId))
		.filter((r) => (state.player.unlockedBiomes || []).includes(r.unlockBiome))
		.filter((r) => !opts.area || opts.area === 'all' || r.unlockBiome === opts.area)
		.filter((r) => !opts.match || opts.match(r))
		.filter((r) => !recipeUnlocked(r, data, state))
		.map((r) => ({ recipe: r, distance: unlockDistance(r, data, state) }))
		.sort((a, b) => a.distance - b.distance || a.recipe.name.localeCompare(b.recipe.name))
		.slice(0, limit);
}

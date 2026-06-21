// Recipe unlock logic, mirrored from the server (server/resources.ts).
// Harper is the source of truth and re-validates every craft; this is purely so
// the UI can hide locked recipes and announce newly unlocked ones.

import type { GameData, GameState, RecipeDef, HabitatObjectDef } from './types';

/** Animal ids that have returned in a given biome. */
function returnedInBiome(data: GameData, state: GameState, biomeId: string): Set<string> {
	const animalBiome = new Map(data.animals.map((a) => [a.id, a.biome]));
	return new Set(
		(state.discoveries || [])
			.filter((d) => animalBiome.get(d.animalId) === biomeId)
			.map((d) => d.animalId),
	);
}

/** Is this recipe unlocked for the player right now? */
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

	if (typeof u.minHealth === 'number' && health < u.minHealth) return false;
	if (typeof u.animalsReturned === 'number' && returned.size < u.animalsReturned) return false;
	if (u.requiresAnimal && !returned.has(u.requiresAnimal)) return false;
	if (u.requiresCrafted && (player.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
	return true;
}

/**
 * Does a recipe match the crafting-menu search box? Case-insensitive match
 * against the recipe name, what it produces (object name + description), and its
 * type label. An empty/whitespace query matches everything.
 */
export function recipeMatchesSearch(
	recipe: RecipeDef,
	obj: HabitatObjectDef | undefined,
	typeLabel: string,
	query: string,
): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return (
		recipe.name.toLowerCase().includes(q) ||
		(obj?.name || '').toLowerCase().includes(q) ||
		(obj?.description || '').toLowerCase().includes(q) ||
		(typeLabel || '').toLowerCase().includes(q)
	);
}

/** The set of recipe ids the player can currently craft. */
export function unlockedRecipeIds(data: GameData | null, state: GameState | null): Set<string> {
	if (!data || !state) return new Set();
	return new Set(data.recipes.filter((r) => recipeUnlocked(r, data, state)).map((r) => r.id));
}

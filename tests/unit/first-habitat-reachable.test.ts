import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The first thing you can build in a newly-opened area has to be buildable.
//
// Old Hollow Forest opens and the chipmunk is waiting on ONE object — a brush
// pile, four branches and a fibre. But the brush pile is a MEADOW recipe, and its
// gate used to read "…and have 2 Grass Patches standing in Willow Meadow": a
// count of what is standing right now, not of what you have ever done. Pick those
// patches up to re-use the ground — which is exactly what a player does once the
// meadow is restored and they are moving on — and the recipe silently re-locks,
// taking the new area's easiest arrival with it. Four more forest animals want
// brush piles too.
//
// So this pins the rule that was broken rather than the one line that broke it.
// `requiresPlaced` is the one unlock condition in the vocabulary that can fall as
// well as rise (see RecipeUnlock in src/types.ts) — every other one is a
// high-water mark. Asking a player to keep three hemlock stands up in the forest
// to unlock a forest recipe is fine: they are standing in it, tending it. Asking
// them to keep two grass patches up in the MEADOW to unlock habitat a FOREST
// animal needs is not, because by then the meadow is somewhere they left.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

const RECIPES = load('data/recipes.json');
const BIOMES = load('data/biomes.json');
const ANIMALS = [...load('data/animals-1.json'), ...load('data/animals-2.json')];

const recipeFor = (objectId: string) => RECIPES.find((r) => r.output?.itemId === objectId);

describe('habitat an animal is waiting on', () => {
	it('is never held hostage by what is standing in a DIFFERENT area', () => {
		const leased: string[] = [];
		for (const animal of ANIMALS) {
			for (const objectId of Object.keys((animal.requirements || {}).objects || {})) {
				const r = recipeFor(objectId);
				const placed = r?.unlock?.requiresPlaced;
				if (!placed || r!.unlockBiome === animal.biome) continue;
				leased.push(
					`${animal.biome}'s ${animal.id} needs ${objectId}, gated on ${placed.count}× ${placed.objectId} standing in ${r!.unlockBiome}`,
				);
			}
		}
		expect(leased).toEqual([]);
	});

	it('lets the chipmunk into Old Hollow Forest the day it opens', () => {
		// The chipmunk asks for one brush pile and nothing else — it is the forest's
		// grasshopper, the arrival that proves the new area works. Whatever gates the
		// brush pile has to be satisfied by any save that could open the forest at
		// all, which means: no harder than the forest's own gate on the meadow.
		const forest = BIOMES.find((b) => b.id === 'forest')!;
		const chipmunk = ANIMALS.find((a) => a.id === 'chipmunk')!;
		expect(Object.keys(chipmunk.requirements.objects)).toEqual(['brush-pile']);

		const brush = recipeFor('brush-pile')!;
		expect(brush.unlockBiome).toBe(forest.unlock.biome); // gated on the meadow
		expect(brush.unlock?.requiresPlaced).toBeUndefined();
		// The forest wants the meadow at 60%; the brush pile must want no more.
		expect(brush.unlock?.minHealth || 0).toBeLessThanOrEqual(forest.unlock.minHealth);
		// …and nothing else that a save meeting the forest gate might not have.
		for (const key of Object.keys(brush.unlock || {})) {
			expect([key, ['minHealth', 'label'].includes(key)]).toEqual([key, true]);
		}
	});
});

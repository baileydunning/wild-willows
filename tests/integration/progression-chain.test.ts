import { describe, it, expect, beforeAll } from 'vitest';
import { freshWorld, appearance, type World } from './harness';
import { readFileSync } from 'node:fs';

// The unlock chain, walked end to end against the real server bundle.
//
// Every area past the meadow sits behind a gate in data/biomes.json: the area
// before it restored to a health bar, that many of ITS animals home, that many
// animals home across the WHOLE preserve, and a one-off restoration kit crafted.
//
// `scripts/gating/validate.py` proves the DATA is satisfiable — no deadlocks, no
// gate behind something that can never happen. Nothing proved the SERVER agrees:
// that checkUnlocks() reads the same four numbers the design intends, in the same
// order, and that each one is load-bearing. That gap is why a chain nobody has
// walked since 0.1.8 could quietly stop opening after the ecology overhaul
// rewrote every animal, habitat object and recipe gate underneath it.
//
// So: one save, five gates, in order — because the later gates count animals
// across the whole preserve and can only be reached by actually getting there.
// Each gate is then checked from the other side too, in `a gate holds when only
// part of it is met` — the kit alone must not open an area, and neither must the
// health alone.

const load = (p: string): any[] => JSON.parse(readFileSync(p, 'utf8')).records;

const BIOMES = load('data/biomes.json');
const RECIPES = load('data/recipes.json');
const ANIMALS = [...load('data/animals-1.json'), ...load('data/animals-2.json')];

/** Willow Meadow — the one area with no `unlock` block, where every save starts. */
const ROOT = BIOMES.find((b) => !b.unlock)!;
/** Everything gated behind something else, in play order. */
const CHAIN = BIOMES.filter((b) => b.unlock).sort((a, b) => a.order - b.order);

const animalsIn = (biomeId: string) => ANIMALS.filter((a) => a.biome === biomeId).length;
const kitFor = (biome: any) => RECIPES.find((r) => r.output?.itemId === biome.unlock.requiresItem)!;
/** An ungated meadow recipe — the cheapest way to make the server re-check the
 *  gates without disturbing anything, since every craft runs checkUnlocks(). */
const NUDGE = 'grass-patch';

const dev = (w: World, pid: string, action: string, args: Record<string, any> = {}) =>
	w.post('DevTools', { playerId: pid, action, ...args });

async function openAreas(w: World, pid: string): Promise<string[]> {
	const s = await w.get('GameState', pid);
	return s.biomeStates.filter((b: any) => b.unlocked).map((b: any) => b.biomeId);
}

/** A brand-new save with a full basket, so no test ever fails for want of materials. */
async function newSave(name: string): Promise<{ w: World; pid: string }> {
	const w = await freshWorld();
	const pid = (await w.post('CreatePlayer', { name, passcode: '1234', appearance })).playerId;
	await dev(w, pid, 'grant-resources', { amount: 500 });
	return { w, pid };
}

describe('the shape of the chain', () => {
	// Cheap data assertions that mirror what validate.py proves, so a bad edit to
	// biomes.json fails here in milliseconds rather than at the end of a walk.

	it('is one unbroken line from the meadow to the shore', () => {
		expect(CHAIN).toHaveLength(BIOMES.length - 1);
		let prev = ROOT.id;
		for (const biome of CHAIN) {
			expect(biome.unlock.biome).toBe(prev); // each gate hangs off the area before it
			prev = biome.id;
		}
		// no orphans: every area is either the root or somewhere on the line
		expect(new Set([ROOT.id, ...CHAIN.map((b) => b.id)]).size).toBe(BIOMES.length);
	});

	it('never asks for more animals than the preserve can have returned by then', () => {
		// minTotalAnimals is counted across every area open at that point. If a gate
		// asks for more than all the earlier areas can supply, the run dead-ends with
		// no way forward and no message saying why.
		let available = 0;
		let prev = ROOT.id;
		for (const biome of CHAIN) {
			available += animalsIn(prev);
			expect(biome.unlock.minTotalAnimals || 0).toBeLessThanOrEqual(available);
			expect(biome.unlock.minAnimals || 0).toBeLessThanOrEqual(animalsIn(prev));
			prev = biome.id;
		}
	});

	it('gates each area behind a kit craftable in the area before it', () => {
		for (const biome of CHAIN) {
			const kit = kitFor(biome);
			expect(kit, `no recipe outputs ${biome.unlock.requiresItem}`).toBeTruthy();
			// The kit must be craftable where you already are — a kit whose own recipe
			// unlocks in the area it opens can never be made.
			expect(kit.unlockBiome).toBe(biome.unlock.biome);
			// ...and its recipe must come due no later than the gate it feeds, or the
			// gate's health bar is reachable while the kit is still hidden.
			expect(kit.unlock?.minHealth || 0).toBeLessThanOrEqual(biome.unlock.minHealth || 0);
		}
	});
});

describe('walking the unlock chain end to end', () => {
	let w: World;
	let pid: string;

	// One save, walked forwards. These tests are deliberately sequential: the
	// gates are cumulative, so gate N can only be reached through gate N-1.
	beforeAll(async () => {
		({ w, pid } = await newSave('Chain Walker'));
	});

	it(`starts in the ${ROOT.id} with everything else shut`, async () => {
		expect(await openAreas(w, pid)).toEqual([ROOT.id]);
	});

	for (const biome of CHAIN) {
		const prev = biome.unlock.biome;
		const kit = kitFor(biome);

		it(`opens ${biome.id} once ${prev} is restored and the ${kit.name || kit.id} is crafted`, async () => {
			// The area we are about to restore must already be open. If it isn't, the
			// walk has skipped a gate and every assertion after this proves nothing.
			const before = await openAreas(w, pid);
			expect(before).toContain(prev);
			expect(before).not.toContain(biome.id);

			// Restore it for real: populate-biome lays down habitat, terrain and every
			// animal, then pins health and balance full — the state a player reaches by
			// hand, minus the hours. It force-opens only the area it builds (already
			// open, asserted above), so the gate ahead is untouched.
			await dev(w, pid, 'populate-biome', { area: prev });

			// Health and both animal counts are satisfied now. The kit is the one
			// requirement still outstanding, so the gate must STILL be shut — this is
			// what proves `requiresItem` is load-bearing rather than decorative.
			expect(await openAreas(w, pid)).not.toContain(biome.id);

			const res = await w.post('CraftItem', { playerId: pid, recipeId: kit.id });
			expect(res.ok).toBe(true);
			// The craft response tells the client what just opened — that is what puts
			// the "a new area is open" card on screen.
			expect((res.unlockedBiomes || []).map((b: any) => b.id)).toContain(biome.id);

			// ...and it stuck. The world's BiomeState is authoritative for co-op; the
			// player's own list is what opens their action gates immediately.
			const after = await w.get('GameState', pid);
			expect(after.biomeStates.find((b: any) => b.biomeId === biome.id)?.unlocked).toBe(true);
			expect(after.player.unlockedBiomes).toContain(biome.id);

			// Finally, confirm the gate opened because its terms were met and not in
			// spite of them — the numbers the server actually weighed.
			const prevState = after.biomeStates.find((b: any) => b.biomeId === prev);
			expect(prevState.health).toBeGreaterThanOrEqual(biome.unlock.minHealth || 0);
			expect(prevState.returnedCount).toBeGreaterThanOrEqual(biome.unlock.minAnimals || 0);
			if (biome.unlock.minTotalAnimals) {
				expect(after.discoveries.length).toBeGreaterThanOrEqual(biome.unlock.minTotalAnimals);
			}
		});
	}

	it('ends with all six areas open and the whole preserve reachable', async () => {
		expect((await openAreas(w, pid)).sort()).toEqual(BIOMES.map((b) => b.id).sort());
	});

	it('crowns the run with Caretaker of the Whole once every animal is home', async () => {
		for (const biome of BIOMES) await dev(w, pid, 'populate-biome', { area: biome.id });

		// Dev tools rebuild the world but never hand out achievements; a real action
		// does. Any craft runs awardAchievements(), so one cheap one stands in for
		// the last thing a finishing player would do.
		await dev(w, pid, 'grant-resources', { amount: 500 });
		await w.post('CraftItem', { playerId: pid, recipeId: NUDGE });

		const s = await w.get('GameState', pid);
		expect(s.discoveries.length).toBe(ANIMALS.length); // all 150, every area
		for (const biome of BIOMES) {
			expect(s.biomeStates.find((b: any) => b.biomeId === biome.id).returnedCount).toBe(animalsIn(biome.id));
		}
		expect(s.achievements).toContain('caretaker-of-the-whole');
		// the per-area finales fire too, so the last screen isn't one lonely badge
		for (const biome of BIOMES) expect(s.achievements).toContain(`${biome.id}-reborn`);
	});
});

describe('a gate holds when only part of it is met', () => {
	// Same gate (the meadow → forest one) approached two ways, each leaving exactly
	// one requirement short. Both use set-health, which writes the bar directly —
	// so these are about the gate arithmetic, not about how health is earned.
	const FOREST = CHAIN[0];
	const KIT = kitFor(FOREST);

	it('does not open the forest for a kit alone', async () => {
		const { w, pid } = await newSave('Kit Only');
		await dev(w, pid, 'welcome-animals', { area: ROOT.id }); // recalcs, so it goes first
		await dev(w, pid, 'set-health', { area: ROOT.id, value: KIT.unlock.minHealth });

		// Craftable at the recipe's bar, which is deliberately lower than the gate's.
		await w.post('CraftItem', { playerId: pid, recipeId: KIT.id });
		expect(await openAreas(w, pid)).not.toContain(FOREST.id);

		// Raise only the health and nudge the server into re-checking: now it opens,
		// which proves the health bar was the one thing holding it.
		await dev(w, pid, 'set-health', { area: ROOT.id, value: FOREST.unlock.minHealth });
		await w.post('CraftItem', { playerId: pid, recipeId: NUDGE });
		expect(await openAreas(w, pid)).toContain(FOREST.id);
	});

	it('does not open the forest for a restored meadow alone', async () => {
		const { w, pid } = await newSave('No Kit');
		await dev(w, pid, 'welcome-animals', { area: ROOT.id });
		await dev(w, pid, 'set-health', { area: ROOT.id, value: 100 });

		// Everything but the kit, and the server asked to look several times.
		await w.post('CraftItem', { playerId: pid, recipeId: NUDGE });
		await w.post('CraftItem', { playerId: pid, recipeId: NUDGE });
		expect(await openAreas(w, pid)).not.toContain(FOREST.id);

		await w.post('CraftItem', { playerId: pid, recipeId: KIT.id });
		expect(await openAreas(w, pid)).toContain(FOREST.id);
	});

	it('does not open the forest for a kit crafted before the animals came back', async () => {
		// Health high, kit in hand, but nothing living there yet: minAnimals is the
		// requirement most easily skipped by a player who terraforms and never plants.
		const { w, pid } = await newSave('Empty Meadow');
		await dev(w, pid, 'set-health', { area: ROOT.id, value: 100 });
		await w.post('CraftItem', { playerId: pid, recipeId: KIT.id });

		const s = await w.get('GameState', pid);
		expect(s.biomeStates.find((b: any) => b.biomeId === ROOT.id).returnedCount || 0).toBeLessThan(
			FOREST.unlock.minAnimals,
		);
		expect(await openAreas(w, pid)).not.toContain(FOREST.id);

		// Bring the meadow to life and the gate opens on the next check.
		await dev(w, pid, 'welcome-animals', { area: ROOT.id });
		await dev(w, pid, 'set-health', { area: ROOT.id, value: 100 });
		await w.post('CraftItem', { playerId: pid, recipeId: NUDGE });
		expect(await openAreas(w, pid)).toContain(FOREST.id);
	});
});

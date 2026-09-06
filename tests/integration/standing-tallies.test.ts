// What is standing in the world, counted rather than scanned for.
//
// The goal board used to answer "how many of these are placed / planted, and has
// anything been harvested" by reading every placement in the world on every
// state read. They are running totals on the player row now (`standing`, see
// bumpStanding in server/metrics.ts), kept by the four endpoints that can move
// them, and filled in from the rows for a save that has none.
//
// A total that drifts from the rows is not a slow game, it is a goal the player
// cannot finish — so these tests are about the tallies AGREEING with the world,
// and about the two ways a save can end up without them.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

let w: World;
let pid: string;

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Wren', passcode: 'pw1234', appearance })).playerId;
});

const standing = async () => (await w.db.Player.get(pid)).standing;
/** The tallies the rows themselves describe. */
const fromRows = async () => {
	const placed: Record<string, number> = {};
	const planted: Record<string, number> = {};
	let harvested = 0;
	for await (const p of w.db.Placement.search()) {
		if ((p.worldId ?? p.playerId) !== pid) continue;
		placed[p.objectId] = (placed[p.objectId] || 0) + 1;
		if (typeof p.plantedAt === 'number') planted[p.objectId] = (planted[p.objectId] || 0) + 1;
		if (typeof p.lastHarvestAt === 'number') harvested++;
	}
	return { placed, planted, harvested };
};
const stock = async (extra: Record<string, number>) => {
	const p = await w.db.Player.get(pid);
	await w.db.Player.patch(pid, {
		inventory: { ...p.inventory, ...extra },
		craftedItems: { ...p.craftedItems, 'grass-patch': 3 },
		tools: { ...p.tools, shovel: 1, 'watering-can': 1 },
	});
};

describe('the standing tallies follow the world', () => {
	it('starts equal to what a new save has standing', async () => {
		// One placement: the camp chest. Stamped at creation rather than left for a
		// later scan to discover.
		expect(await standing()).toMatchObject({ placed: { 'small-chest': 1 }, planted: {}, harvested: 0 });
		expect((await standing()).placed).toEqual((await fromRows()).placed);
	});

	it('counts a placement up and a removal back down', async () => {
		await stock({});
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 6, y: 6 });
		expect((await standing()).placed['grass-patch']).toBe(1);
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 7, y: 6 });
		expect((await standing()).placed['grass-patch']).toBe(2);

		const one = [...(await w.db.Placement._rows.values())].find((p: any) => p.x === 6 && p.y === 6);
		await w.post('RemoveObject', { playerId: pid, placementId: one.id });
		expect((await standing()).placed['grass-patch']).toBe(1);
		expect(await standing()).toMatchObject(await fromRows());
	});

	it('counts a planting as both standing and planted, and a harvest once', async () => {
		await stock({ seeds: 10, water: 10 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 8, y: 8, action: 'dig' });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 8, y: 8, action: 'water' });
		await w.post('Plant', { playerId: pid, area: 'meadow', x: 8, y: 8, plantId: 'wildflower-patch' });

		let s = await standing();
		expect(s.placed['wildflower-patch']).toBe(1);
		expect(s.planted['wildflower-patch']).toBe(1);
		expect(s.harvested).toBe(0);

		const plant = [...(await w.db.Placement._rows.values())].find((p: any) => p.objectId === 'wildflower-patch');
		// grown enough to pick (45s), and picked twice — one harvested plant either way
		await w.db.Placement.patch(plant.id, { plantedAt: Date.now() - 600_000 });
		await w.post('HarvestPlacement', { playerId: pid, placementId: plant.id });
		expect((await standing()).harvested).toBe(1);
		await w.db.Placement.patch(plant.id, { lastHarvestAt: Date.now() - 600_000 });
		await w.post('HarvestPlacement', { playerId: pid, placementId: plant.id });
		expect((await standing()).harvested).toBe(1);

		// digging it up takes all three back down — this is a live count, which is
		// what the goals reading it have always been
		await w.post('RemoveObject', { playerId: pid, placementId: plant.id });
		s = await standing();
		expect(s.placed['wildflower-patch']).toBeUndefined();
		expect(s.planted['wildflower-patch']).toBeUndefined();
		expect(s.harvested).toBe(0);
		expect(s).toMatchObject(await fromRows());
	});

	it('fills in a save that has none, from its own rows, on the next beat', async () => {
		// Every save from before the tallies existed, and any that arrives without
		// them later — an older export imported, a dev tool that rewrote the rows.
		for (let i = 0; i < 4; i++) {
			const id = `${pid}:meadow:pl_seed_${i}`;
			await w.db.Placement.put({
				id,
				worldId: pid,
				playerId: pid,
				objectId: 'clover-patch',
				area: 'meadow',
				x: 10 + i,
				y: 10,
				placedAt: Date.now() - 86_400_000,
				...(i < 2 ? { plantedAt: Date.now() - 86_400_000 } : {}),
				...(i === 0 ? { lastHarvestAt: Date.now() - 3_600_000 } : {}),
			});
		}
		const { standing: _gone, ...noTallies } = await w.db.Player.get(pid);
		await w.db.Player.put(noTallies);
		expect(await standing()).toBeUndefined();

		await w.post('Heartbeat', { playerId: pid });

		expect(await standing()).toMatchObject(await fromRows());
		expect((await standing()).placed['clover-patch']).toBe(4);
		expect((await standing()).planted['clover-patch']).toBe(2);
		expect((await standing()).harvested).toBe(1);
	});

	it('reads the goal board from the tallies, not from a count of rows', async () => {
		await stock({});
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'build', itemId: 'grass-patch', target: 1 }] });
		const build = async () => {
			const dt = (await w.get<any>('GameState', pid)).dailyTasks;
			return dt.tasks.find((t: any) => t.kind === 'build');
		};
		const before = (await build()).progress;
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 9, y: 9 });
		const after = (await build()).progress;
		expect(after, 'placing the thing the goal is about must move it').toBe(before + 1);

		// The board is computed from the tallies, so a tally that stops tracking is
		// a goal that stops moving — which is the whole reason they are checked
		// against the rows above.
		const placement = [...(await w.db.Placement._rows.values())].find((p: any) => p.x === 9 && p.y === 9);
		await w.post('RemoveObject', { playerId: pid, placementId: placement.id });
		expect((await build()).progress).toBe(before);
	});
});

describe('the goal board still reads right from another area', () => {
	// The failure phase 4 could have shipped: nothing errors, the goals just
	// quietly read low once the snapshot stops carrying the world's placements.
	it('a build goal keeps its progress after the player walks away', async () => {
		await stock({});
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'build', itemId: 'grass-patch', target: 1 }] });
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 9, y: 9 });
		const build = async () => {
			const dt = (await w.get<any>('GameState', pid)).dailyTasks;
			return dt.tasks.find((t: any) => t.kind === 'build').progress;
		};
		const here = await build();

		// …into the forest, where the meadow's placements are not in the payload
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { unlockedBiomes: [...(p.unlockedBiomes || []), 'forest'] });
		await w.post('SyncPlayer', { playerId: pid, x: 5, y: 5, area: 'forest' });
		const state = await w.get<any>('GameState', pid);
		expect(
			state.placements.some((x: any) => x.area === 'meadow'),
			'the meadow should not be in the payload',
		).toBe(false);
		expect(await build(), 'the goal counted the area on screen instead of the preserve').toBe(here);
	});
});

describe('what an area has standing lives on its biome row', () => {
	it('the habitat steps of an animal goal read the biome’s own counts', async () => {
		await stock({});
		// The exact "what it is waiting for" steps need the expanded meadow guide;
		// without it the goal carries the caretaker's hint instead.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { tools: { ...p.tools, 'journal-meadow': 3 } });
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'attract', animalId: 'grasshopper' }] });
		const step = async () => {
			const dt = (await w.get<any>('GameState', pid)).dailyTasks;
			const t = dt.tasks.find((x: any) => x.kind === 'attract');
			return (t?.steps || []).find((s: any) => /Grass Patch/.test(s.text));
		};
		expect((await step())?.text).toMatch(/0\/1 Grass Patch/);
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 11, y: 11 });

		// recalcBiome writes the count from the placements it is already holding, so
		// the row is current the moment the placement lands.
		const meadow = await w.db.BiomeState.get(`${pid}:meadow`);
		expect(meadow.objectCounts['grass-patch']).toBe(1);
		expect((await step())?.text).toMatch(/1\/1 Grass Patch/);
		expect((await step())?.done).toBe(true);
	});
});

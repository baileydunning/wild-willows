import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Regression guard for the legacy-id class of bug.
//
// World-owned rows (TerrainTile, BiomeState, Discovery) are keyed by a composite
// id built from the *current* worldId (`${wid}:${…}`). But a save whose world was
// given a distinct id after the fact (co-op-era migration) can carry rows that
// still encode the old playerId (`${playerId}:${…}`) while their worldId column
// points at the new world. Those rows are found by `byWorld` (so they render and
// count) but a reconstructed-id lookup misses them — the server then acts as if
// the bed / biome / discovery isn't there. The fix matches on the natural key
// (coords / biomeId / animalId) and acts on the row's real id.
//
// Each test below reproduces that pathology and asserts the endpoint recognizes
// the legacy row. They fail against the pre-fix reconstructed-id lookups.

let w: World;
const NEWW = 'world-co-op-xyz'; // a world id deliberately different from the playerId

/** Point the player (and its world-owned rows) at a new world id, WITHOUT
 *  re-keying the rows — i.e. their ids stay in the legacy `${playerId}:…` form. */
function divergeWorld(db: any, pid: string) {
	const p = db.Player._rows.get(pid);
	db.Player._rows.set(pid, { ...p, worldId: NEWW });
	for (const table of ['BiomeState', 'Chest', 'Placement', 'Discovery', 'TerrainTile', 'NodeState', 'FeedEntry']) {
		for (const [id, row] of [...db[table]._rows] as [string, any][]) {
			if (row.playerId === pid || row.worldId === pid) {
				db[table]._rows.set(id, { ...row, worldId: NEWW }); // keep the legacy id
			}
		}
	}
}

beforeEach(async () => {
	w = await freshWorld();
});

describe('legacy playerId-keyed world rows are still recognized', () => {
	it('Terraform recognizes a watered bed whose id predates the worldId', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
		divergeWorld(w.db, pid);

		// A legacy watered bed: worldId points at the new world, but the id is the
		// old `${playerId}:meadow:x:y` form the reconstructed lookup would miss.
		w.db.TerrainTile._rows.set(`${pid}:meadow:6:6`, {
			id: `${pid}:meadow:6:6`,
			worldId: NEWW,
			playerId: pid,
			area: 'meadow',
			x: 6,
			y: 6,
			type: 'watered',
			updatedAt: Date.now(),
		});

		// Clearing needs the bed to be *found* — pre-fix this threw "Nothing to clear".
		await expect(
			w.post('Terraform', { playerId: pid, area: 'meadow', x: 6, y: 6, action: 'clear' }),
		).resolves.toBeTruthy();

		const state = await w.get('GameState', pid);
		expect(state.terrain.some((t: any) => t.x === 6 && t.y === 6)).toBe(false); // actually removed

		// control: clearing bare ground still fails
		await expect(w.post('Terraform', { playerId: pid, area: 'meadow', x: 7, y: 7, action: 'clear' })).rejects.toThrow();
	});

	it('recalc reuses a legacy BiomeState row instead of resetting/duplicating it', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
		divergeWorld(w.db, pid);

		// The meadow's own state row is now legacy-keyed (`${pid}:meadow`, worldId NEWW).
		const legacyId = `${pid}:meadow`;
		const row = w.db.BiomeState._rows.get(legacyId);
		expect(row).toBeTruthy();
		w.db.BiomeState._rows.set(legacyId, { ...row, unlocked: true, returnedCount: 3 });

		await w.post('RecalcBiome', { playerId: pid, biomeId: 'meadow' });

		// Exactly one meadow row — pre-fix a second `${NEWW}:meadow` row was created.
		const meadowRows = [...w.db.BiomeState._rows.values()].filter((b: any) => b.biomeId === 'meadow');
		expect(meadowRows).toHaveLength(1);
		expect(meadowRows[0].id).toBe(legacyId); // the legacy row was updated in place
		expect(meadowRows[0].unlocked).toBe(true); // and its unlocked flag survived
	});

	it('ObserveAnimal finds a discovery whose id predates the worldId', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
		divergeWorld(w.db, pid);

		w.db.Discovery._rows.set(`${pid}:grasshopper`, {
			id: `${pid}:grasshopper`,
			worldId: NEWW,
			playerId: pid,
			animalId: 'grasshopper',
			biomeId: 'meadow',
			comfort: 60,
			timesObserved: 0,
			firstObservedAt: Date.now(),
		});

		const res = await w.post('ObserveAnimal', { playerId: pid, animalId: 'grasshopper' });
		expect(res.ok).toBe(true);
		expect(res.discovery.timesObserved).toBe(1);
	});
});

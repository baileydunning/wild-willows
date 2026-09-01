import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// The question this file answers: does a save made by the SHIPPED build still
// load, unchanged, after the player updates to this one?
//
// Everything here builds a save in the old shape and then drives the new code
// over it. Old-shape means:
//   • the player id is the bare name slug (ids only started carrying a random
//     suffix in this change)
//   • the World row either predates `meadowShift` entirely or carries the stamp
//     the shipped build wrote
//   • there is no PlayerNameIndex row, because nothing wrote one
//
// A regression here is the update-wrecks-my-save scenario, so these assert on
// coordinates and contents rather than just "it didn't throw".

let w: World;

/** Rewrite a freshly created save into the shape the shipped build produces. */
async function asShippedSave(name: string, passcode: string, meadowShift: number | undefined) {
	const created = await w.post('CreatePlayer', { name, passcode, appearance });
	const newId: string = created.playerId;
	const slug = name.toLowerCase();

	// Re-key every row from the suffixed id onto the bare slug.
	for (const table of ['Player', 'World', 'WorldMember', 'BiomeState', 'Chest', 'Placement', 'Discovery']) {
		const rows = [...w.db[table]._rows.values()];
		for (const row of rows) {
			const moved = JSON.parse(JSON.stringify(row).split(newId).join(slug));
			w.db[table]._rows.delete(row.id);
			w.db[table]._rows.set(moved.id, moved);
		}
	}
	// The shipped build never wrote a name index.
	w.db.PlayerNameIndex._rows.clear();
	// Match the World row the shipped build would have left behind.
	const world = w.db.World._rows.get(slug);
	if (world) {
		if (meadowShift === undefined) {
			delete world.meadowShift;
			delete world.meadowShiftY;
		} else {
			world.meadowShift = meadowShift;
			world.meadowShiftY = 0;
		}
	}
	return { slug, before: JSON.parse(JSON.stringify(w.db.Player._rows.get(slug))) };
}

beforeEach(async () => {
	w = await freshWorld();
});

describe('a save from the shipped build survives the update', () => {
	it('still logs in by name, even with no name index to look it up', async () => {
		const { slug } = await asShippedSave('Kayla', 'hunter2', 14);
		const login = await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });
		expect(login.ok).toBe(true);
		expect(login.playerId).toBe(slug); // kept its original id — not re-minted
	});

	it('keeps the player exactly where they were — nothing is migrated', async () => {
		const { slug, before } = await asShippedSave('Kayla', 'hunter2', 14);
		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });
		const after = w.db.Player._rows.get(slug);
		expect(after.x).toBe(before.x);
		expect(after.y).toBe(before.y);
		expect(after.area).toBe(before.area);
		expect(after.home).toEqual(before.home);
		expect(after.inventory).toEqual(before.inventory);
		expect(after.tools).toEqual(before.tools);
		expect(after.unlockedBiomes).toEqual(before.unlockedBiomes);
	});

	// The shipped build shifted the meadow 14 tiles east on a world that predated
	// the stamp. That migration is gone, so a save that never got shifted must not
	// get shifted now — and one that did must not get shifted twice or dragged back.
	it('leaves the meadow alone whether or not the old build had stamped it', async () => {
		for (const stamp of [undefined, 0, 14]) {
			w = await freshWorld();
			const { slug } = await asShippedSave('Kayla', 'hunter2', stamp);
			const chestBefore = [...w.db.Chest._rows.values()].map((c: any) => ({ id: c.id, x: c.x, y: c.y }));
			const placeBefore = [...w.db.Placement._rows.values()].map((p: any) => ({ id: p.id, x: p.x, y: p.y }));
			const playerBefore = { ...w.db.Player._rows.get(slug) };

			await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

			expect([...w.db.Chest._rows.values()].map((c: any) => ({ id: c.id, x: c.x, y: c.y }))).toEqual(chestBefore);
			expect([...w.db.Placement._rows.values()].map((p: any) => ({ id: p.id, x: p.x, y: p.y }))).toEqual(placeBefore);
			expect(w.db.Player._rows.get(slug).x).toBe(playerBefore.x);
			expect(w.db.Player._rows.get(slug).y).toBe(playerBefore.y);
		}
	});

	it('the starter chest stays beside the player, not 14 tiles away', async () => {
		const { slug } = await asShippedSave('Kayla', 'hunter2', undefined);
		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });
		const chest: any = [...w.db.Chest._rows.values()][0];
		const player: any = w.db.Player._rows.get(slug);
		expect(Math.abs(chest.x - player.x)).toBeLessThan(6);
		expect(Math.abs(chest.y - player.y)).toBeLessThan(6);
	});

	it('can still be deleted by name', async () => {
		await asShippedSave('Kayla', 'hunter2', 14);
		const del = await w.post('DeletePlayer', { name: 'Kayla', passcode: 'hunter2' });
		expect(del.ok).toBe(true);
	});
});

/**
 * A biome row written before BiomeState.playerWater existed.
 *
 * The field is the authoritative count of open water the PLAYER shaped in a
 * biome, and the client prefers it for a reason: since the snapshot stopped
 * sending every area's tiles, waterShape()'s fallback can only see the area on
 * screen. So an old wetland row and a player standing in the meadow read as a
 * wetland with no water at all, and a water-gated recipe the server would craft
 * on request shows up locked in the book.
 *
 * Only recalcBiome ever writes the field, so an old row cannot heal on its own —
 * it heals the next time something recalculates that biome, which for a biome
 * the player is not visiting may be a long while. Hence the backfill, and hence
 * REPAIR_REV 4: a save already stamped at the previous rev has to be looked at
 * once more, or the pass it needs is exactly the one it skips.
 */
describe('a biome row from before playerWater', () => {
	it('has one backfilled on the next beat, counting only what the player shaped', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Wade', passcode: 'hunter2', appearance })).playerId;
		// Six connected tiles of open water the player made, plus one seeded tile
		// touching them — the count is of shaped water, so the seeded one is not
		// part of it and does not join the lake either.
		for (let x = 3; x <= 8; x++)
			await w.db.TerrainTile.put({
				id: `${pid}:meadow:${x}:9`,
				worldId: pid,
				playerId: pid,
				area: 'meadow',
				x,
				y: 9,
				type: 'water',
				updatedAt: Date.now(),
			});
		await w.db.TerrainTile.put({
			id: `${pid}:meadow:9:9`,
			worldId: pid,
			playerId: pid,
			area: 'meadow',
			x: 9,
			y: 9,
			type: 'water',
			seeded: true,
			updatedAt: Date.now(),
		});

		// The shipped build's shape: a biome row that has never carried the field,
		// on a save already stamped with the repair rev of its day.
		const bs: any = w.db.BiomeState._rows.get(`${pid}:meadow`);
		delete bs.playerWater;
		await w.db.Player.patch(pid, { repairRev: 3 });
		expect(w.db.BiomeState._rows.get(`${pid}:meadow`).playerWater).toBeUndefined();

		await w.post('Heartbeat', { playerId: pid });

		const healed: any = w.db.BiomeState._rows.get(`${pid}:meadow`);
		expect(healed.playerWater).toBeTruthy();
		expect(healed.playerWater.tiles).toBe(6);
		expect(healed.playerWater.lake).toBe(6);
	});

	it('is a one-time pass, not a recalculation on every beat', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Dry', passcode: 'hunter2', appearance })).playerId;
		const bs: any = w.db.BiomeState._rows.get(`${pid}:meadow`);
		delete bs.playerWater;
		await w.db.Player.patch(pid, { repairRev: 3 });

		await w.post('Heartbeat', { playerId: pid });
		expect(w.db.BiomeState._rows.get(`${pid}:meadow`).playerWater).toBeTruthy(); // a dry biome still gets its zeros

		// The save is stamped at the new rev now, so the next beat does not reach
		// the repair at all: nothing recalculates, nothing is written, and the only
		// biome read left is the growth pass's own — a second scan here would be the
		// backfill running again on a timer.
		w.db.BiomeState._resetWriteStats();
		w.db.BiomeState._resetScanStats();
		await w.post('Heartbeat', { playerId: pid });
		expect(w.db.BiomeState._writeStats().total).toBe(0);
		expect(w.db.BiomeState._scanStats().scans).toBe(1);
	});
});

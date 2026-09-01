import { describe, it, expect } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// A rain basin is a carved stone bowl that catches rain, and until now it caught
// nothing: it had no `yield` at all, and the harvest path only ever fired for
// PLANTED things (`def.plantable && placement.plantedAt`), so a crafted structure
// could not have been harvested even with one.
//
// Both halves are pinned here. A crafted structure is ready the moment it is
// standing — there is nothing to grow — and the sky, not the clock, is what
// decides whether the bowl has anything in it. Those are kept apart on purpose:
// readiness is a timer, `harvestWeather` is a gate on top of it, so a shower that
// ends mid-refill leaves the basin refilling rather than resetting it.

/** A basin standing in the meadow since `placedAt`, and the player's id. */
async function worldWithBasin(placedAt = Date.now() - 60_000) {
	const w: World = await freshWorld();
	const pid = (await w.post('CreatePlayer', { name: 'Basin', passcode: '1234', appearance })).playerId;
	const placementId = `${pid}:pl_basin`;
	await w.db.Placement.put({
		id: placementId,
		worldId: pid,
		playerId: pid,
		objectId: 'rain-basin',
		area: 'meadow',
		x: 6,
		y: 6,
		placedAt,
	});
	return { w, pid, placementId };
}

/** Pin the sky. The dev override is what the client paints from, so it is also
 *  what the harvest gate honors — see the note in HarvestPlacement. */
const setWeather = async (w: World, pid: string, type: string) => w.db.Player.patch(pid, { devWeather: { type } });

describe('a rain basin', () => {
	it('gives 2 water while it is raining', async () => {
		const { w, pid, placementId } = await worldWithBasin();
		await setWeather(w, pid, 'rain');
		const before = (await w.db.Player.get(pid)).inventory?.water || 0;
		const r = await w.post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.water).toBe(2);
		expect(r.inventory.water).toBe(before + 2); // a new caretaker already carries some
	});

	it('fills in a storm too — a downpour is still a downpour', async () => {
		const { w, pid, placementId } = await worldWithBasin();
		await setWeather(w, pid, 'storm');
		const r = await w.post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.water).toBe(2);
	});

	it('is empty under a clear sky', async () => {
		const { w, pid, placementId } = await worldWithBasin();
		await setWeather(w, pid, 'clear');
		await expect(w.post('HarvestPlacement', { playerId: pid, placementId })).rejects.toThrow(/empty|rain/i);
	});

	it('needs no planting — it is ready as soon as it is set down', async () => {
		// The bug this half fixes: harvestReadyAt used to return null for anything
		// without a `plantedAt`, so a crafted basin was permanently "not ready".
		const { w, pid, placementId } = await worldWithBasin(Date.now());
		await setWeather(w, pid, 'rain');
		const r = await w.post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.water).toBe(2);
	});

	it('has to refill before it can be emptied again', async () => {
		const { w, pid, placementId } = await worldWithBasin();
		await setWeather(w, pid, 'rain');
		await w.post('HarvestPlacement', { playerId: pid, placementId });
		await expect(w.post('HarvestPlacement', { playerId: pid, placementId })).rejects.toThrow();
		// …and the wait is the regrow timer, measured from the harvest, not from
		// when the rain started.
		const after = await w.db.Placement.get(placementId);
		expect(after.lastHarvestAt).toBeGreaterThan(0);
	});

	it('refills on the clock, so a passing shower does not reset it', async () => {
		// Harvested 91s ago (regrowSeconds is 90) — full again, whatever the sky did
		// in between, and takeable because it is raining now.
		const { w, pid, placementId } = await worldWithBasin();
		await w.db.Placement.patch(placementId, { lastHarvestAt: Date.now() - 91_000 });
		await setWeather(w, pid, 'rain');
		const r = await w.post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.water).toBe(2);
	});
});

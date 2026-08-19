import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, metricsOf, type World } from './harness';

// The arrivals log: WHICH animals came home, and how far into the playthrough.
//
// The dashboard's player highlight shows a returning caretaker's animals as a
// timeline, so the number it draws each row from has to be the play time at the
// moment the animal arrived — not the time the dashboard was opened, and not a
// wall clock, which would be a raw duration the privacy contract does not allow
// off-device anyway. `playSeconds` is already stored and already coarse, so the
// log borrows it.
//
// Two things are easy to get wrong here and both have a test:
//  • the ID. `recalcBiome` builds each arrival as a Discovery ROW, whose `id` is
//    `${worldId}:${animalId}` — logging that verbatim would fill the dashboard
//    with "abc123 Grasshopper" rows. The animal's own id is the one to keep.
//  • duplicates. An animal comes home once; a re-entrant recalc must not append
//    a second row for it.

let w: World;
let pid: string;

/** The grasshopper's whole requirement: meadow health 8 and one grass patch.
 *  It is the first animal home in every save — everything else is gated on it —
 *  which makes it the cheapest genuine arrival a test can produce. */
async function bringTheGrasshopperHome() {
	const p = await w.db.Player.get(pid);
	await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), seeds: 20, fiber: 20 } });
	await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
	return w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 6, y: 6 });
}

const arrivals = async () => metricsOf(await w.db.Player.get(pid)).arrivals || [];

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Ada', passcode: '1234', appearance })).playerId;
});

describe('the arrivals log', () => {
	it('records the animal id, not the discovery row key', async () => {
		await bringTheGrasshopperHome();
		const log = await arrivals();
		expect(log.length).toBe(1);
		expect(log[0].id).toBe('grasshopper');
	});

	it('records the display name beside the id', async () => {
		// The dashboard has no copy of the species list, and an id is a slug:
		// 'red-tailed-hawk' un-slugs to 'Red Tailed Hawk', which is not the bird's
		// name. Writing the name at arrival time is also what makes the log a
		// history — a species renamed later still reads as it did that day.
		await bringTheGrasshopperHome();
		expect((await arrivals())[0].name).toBe('Grasshopper');
	});

	it('stamps the play time the animal arrived at', async () => {
		// 20 minutes in. Seeded rather than accrued because playSeconds only moves
		// on a heartbeat, and this test is about what the log copies, not about the
		// clock that fills it.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { metrics: { ...metricsOf(p), playSeconds: 1200 } });

		await bringTheGrasshopperHome();
		const log = await arrivals();
		expect(log.length).toBe(1);
		expect(log[0].at).toBe(1200);
	});

	it('logs an animal once, however many times the biome is recalculated', async () => {
		await bringTheGrasshopperHome();
		// Any further change re-runs recalcBiome over a meadow the grasshopper is
		// already home in. The log must not grow.
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 9, y: 9 }).catch(() => {});
		const log = await arrivals();
		expect(log.filter((a: any) => a.id === 'grasshopper').length).toBe(1);
	});

	it('carries the log through to the dashboard view and the solo uplink', async () => {
		await bringTheGrasshopperHome();
		const one = await w.get('Metrics', pid);
		expect(one.player.arrivals[0].id).toBe('grasshopper');
		expect(typeof one.player.arrivals[0].at).toBe('number');
	});

	it('is an empty list, not a missing field, on a save that never welcomed anyone', async () => {
		const one = await w.get('Metrics', pid);
		expect(one.player.arrivals).toEqual([]);
	});
});

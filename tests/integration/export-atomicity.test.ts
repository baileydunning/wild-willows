import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// A save carried out of the demo has to be consistent WITH ITSELF.
//
// ExportDemoSave reads nine tables one after another. Nothing serializes the
// client's fetches, so a gameplay request can land in the middle of that read —
// and withPlayerLock BUFFERS Player patches, writing them out only as the lock
// releases. That combination shows a half-finished action in exactly the wrong
// order: PlaceObject decrements `craftedItems` inside the lock but writes the
// Placement row immediately, so an export threading between the two captures a
// player who still owns the item AND the item already standing in the world.
// Import that save into the full game and it has been duplicated.
//
// The fix is to take the same lock around the whole snapshot. These tests drive
// the real server bundle and would both fail without it.

let w: World;
let pid: string;

/** Crafted-but-not-yet-placed count for an object, as the save records it. */
const held = async (objectId: string) => ((await w.db.Player.get(pid)).craftedItems || {})[objectId] || 0;

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Demo Wren', passcode: 'demopass', appearance, edition: 'demo' }))
		.playerId;
});

describe('exporting a demo save', () => {
	it('never captures an item both held and already placed', async () => {
		// Craft one grass patch, so the save owns exactly one of them.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), seeds: 20, fiber: 20, branches: 20 } });
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		expect(await held('grass-patch')).toBe(1);

		// Place it and export at the same moment, without awaiting the placement
		// first — this is the overlap the lock exists to prevent.
		const [, out] = await Promise.all([
			w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 6, y: 12 }),
			w.post('ExportDemoSave', { playerId: pid }),
		]);

		const carriedHeld = (out.data.Player[0].craftedItems || {})['grass-patch'] || 0;
		const carriedPlaced = out.data.Placement.filter((pl: any) => pl.objectId === 'grass-patch').length;

		// Either the export got there first (still held, not yet placed) or the
		// placement did (placed, no longer held). Both is the bug: one grass patch
		// crafted must never arrive as two.
		expect([carriedHeld, carriedPlaced]).not.toEqual([1, 1]);
		expect(carriedHeld + carriedPlaced).toBe(1);
	});

	it('agrees with the live save about what was spent', async () => {
		// The same invariant from the other side: whatever the export captured, the
		// server's own row has to tell the same story once everything has settled.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), seeds: 40, fiber: 40, branches: 40 } });
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });

		const [, , out] = await Promise.all([
			w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 6, y: 12 }),
			w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 7, y: 12 }),
			w.post('ExportDemoSave', { playerId: pid }),
		]);

		const carriedHeld = (out.data.Player[0].craftedItems || {})['grass-patch'] || 0;
		const carriedPlaced = out.data.Placement.filter((pl: any) => pl.objectId === 'grass-patch').length;
		expect(carriedHeld + carriedPlaced).toBe(2); // two crafted, two accounted for
	});

	it('carries feed lines written before the export was asked for', async () => {
		// The client flushes its buffered feed and THEN exports, because the exporter
		// reads FeedEntry rows out of the database. Awaiting that flush is what makes
		// this ordering real (see flushFeed in src/state.tsx) — this pins the server
		// half: a line already appended is in the save.
		await w.post('AppendFeed', {
			playerId: pid,
			entries: [{ icon: 'leaf', text: 'A grasshopper returned to the meadow', at: Date.now() }],
		});
		const out = await w.post('ExportDemoSave', { playerId: pid });
		// The whole feed travels as ONE row carrying an `entries` array, not a row
		// per line — see writeFeed on the server.
		const lines = (out.data.FeedEntry || []).flatMap((row: any) => row.entries || []);
		expect(lines.some((f: any) => /grasshopper returned/.test(f.text))).toBe(true);
	});
});

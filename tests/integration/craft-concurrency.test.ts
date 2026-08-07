import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// "It doesn't always craft the thing."
//
// CraftItem reads the player, consumes the materials, then writes craftedItems
// back from the copy it read at the start. Two crafts that overlap therefore both
// start from the same baseline and the second write lands on top of the first:
// materials for two, one item. The player watches their basket empty and gets
// nothing for it, which reads as the craft button "not working".
//
// Nothing stops two from overlapping. The Craft button is only disabled by
// affordability (`disabled={!ok}` in Panels.tsx), not by a request being in
// flight, so an impatient double-click is enough — and every craft is a round
// trip, so the window is as wide as the player's connection is slow.
//
// Imports the TS source rather than the built bundle so this covers the fix
// before `npm run build:server` regenerates resources.js.

const holder: { db: Db } = { db: makeWorld() };
let endpoints: Record<string, any> | null = null;

async function loadTsServer(): Promise<Record<string, any>> {
	if (endpoints) return endpoints;
	const g = globalThis as any;
	g.Resource = class {
		_id: any;
		constructor(id?: any) {
			this._id = id;
		}
		getId() {
			return this._id;
		}
	};
	g.databases = {
		get wildwillows() {
			return holder.db;
		},
	};
	endpoints = (await import('../../server/resources')) as Record<string, any>;
	return endpoints;
}

let mod: Record<string, any>;
const post = (cls: string, body: any) => new (mod as any)[cls]().post(body);

let pid: string;

// simple-path: 2 stones in, 2 paths out, craftable from the start (data/recipes.json).
const RECIPE = 'simple-path';
const OUTPUT = 'simple-path';
const COST = 2;
const YIELD = 2;

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Crafty', passcode: '1234', appearance })).playerId;
});

const stock = (stones: number) => holder.db.Player.patch(pid, { inventory: { stones }, devUnlockAll: true });
const player = () => holder.db.Player.get(pid);

describe('crafting the same recipe twice', () => {
	it('one after the other charges twice and makes twice', async () => {
		// The baseline everyone agrees on: sequential crafting is correct.
		await stock(COST * 2);
		await post('CraftItem', { playerId: pid, recipeId: RECIPE });
		await post('CraftItem', { playerId: pid, recipeId: RECIPE });
		const p = await player();
		expect(p.craftedItems[OUTPUT]).toBe(YIELD * 2);
		expect(p.inventory.stones ?? 0).toBe(0);
	});

	it('at the same time charges twice and makes twice', async () => {
		// The double-click. Both requests are in flight before either finishes, so
		// both read the same player and the second write lands on top of the first.
		await stock(COST * 2);
		await Promise.all([
			post('CraftItem', { playerId: pid, recipeId: RECIPE }),
			post('CraftItem', { playerId: pid, recipeId: RECIPE }),
		]);
		const p = await player();
		expect(p.craftedItems[OUTPUT], 'paid for two crafts, only got one').toBe(YIELD * 2);
		expect(p.inventory.stones ?? 0, 'two crafts, only one charged for').toBe(0);
		expect(p.craftedEver[OUTPUT], 'craftedEver drives achievements and goals').toBe(YIELD * 2);
	});

	it('makes exactly as many as the materials paid for', async () => {
		// The invariant that matters, whatever the interleaving: you get what you
		// paid for, and you pay for what you got. With materials for one craft only,
		// two overlapping requests must not both succeed.
		await stock(COST);
		const results = await Promise.allSettled([
			post('CraftItem', { playerId: pid, recipeId: RECIPE }),
			post('CraftItem', { playerId: pid, recipeId: RECIPE }),
		]);
		const made = results.filter((r) => r.status === 'fulfilled').length;
		const p = await player();
		expect(made, 'materials for one craft should buy exactly one').toBe(1);
		expect(p.craftedItems[OUTPUT] ?? 0).toBe(YIELD);
		expect(p.inventory.stones ?? 0).toBe(0);
	});
});

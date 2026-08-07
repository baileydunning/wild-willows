import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// Campfires belong outdoors — not in the house, and not in a trail tent either.
//
// The campfire was `placement: 'both'`, which let it be placed in any interior.
// It's now plain `'outdoor'`, which the server already refuses for BOTH interior
// kinds, so no special-case flag is needed.
//
// Enforced server-side, because the frontend is never trusted — the crafting list
// and the placement ghost mirror it, but this is the copy that counts.

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

// Home interior for space level 2, centred in the 30×20 grid (see homeRoom).
const HOME = { x0: 11, y0: 7, x1: 18, y1: 12 };
// Trail tent interiors are a fixed 6×5, centred the same way (TENT_INNER).
const TENT = { x0: 12, y0: 7, x1: 17, y1: 11 };

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Camper', passcode: '1234', appearance })).playerId;
	await holder.db.Player.patch(pid, {
		home: { style: 'cabin', space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true },
		craftedItems: { campfire: 5, 'small-chest': 5 },
		unlockedBiomes: ['meadow'],
		devUnlockAll: true,
	});
});

const place = (objectId: string, area: string, x: number, y: number) =>
	post('PlaceObject', { playerId: pid, objectId, area, x, y });

describe('interiors refuse a campfire', () => {
	it('rejects it on the floor of the home', async () => {
		await expect(place('campfire', 'home', HOME.x0 + 2, HOME.y0 + 2)).rejects.toThrow();
	});

	it('rejects it inside a trail tent', async () => {
		await expect(place('campfire', 'tent-meadow', TENT.x0 + 1, TENT.y0 + 1)).rejects.toThrow();
	});

	it('rejects it anywhere in the home, not just one tile', async () => {
		for (const [x, y] of [
			[HOME.x0, HOME.y0],
			[HOME.x1, HOME.y1 - 1],
			[HOME.x0 + 3, HOME.y0 + 1],
		]) {
			await expect(place('campfire', 'home', x, y)).rejects.toThrow();
		}
	});

	it('places nothing when it refuses', async () => {
		await place('campfire', 'home', HOME.x0 + 2, HOME.y0 + 2).catch(() => {});
		const placed = [...holder.db.Placement._rows.values()].filter((p: any) => p.objectId === 'campfire');
		expect(placed).toHaveLength(0);
	});

	it('does not spend the crafted campfire on the failed attempt', async () => {
		await place('campfire', 'home', HOME.x0 + 2, HOME.y0 + 2).catch(() => {});
		const p: any = holder.db.Player._rows.get(pid);
		expect(p.craftedItems.campfire).toBe(5);
	});
});

describe('outdoors still takes one', () => {
	it('allows a campfire in the open', async () => {
		const res = await place('campfire', 'meadow', 6, 6);
		expect(res.ok).toBe(true);
	});
});

describe('the rule is scoped to campfires', () => {
	it('other indoor-capable items still go in the house', async () => {
		const res = await place('small-chest', 'home', HOME.x0 + 1, HOME.y0 + 1);
		expect(res.ok).toBe(true);
	});

	it('the campfire is outdoor-only in the catalogue', async () => {
		const objects = (await import('../../data/habitat-objects.json')).default.records as any[];
		expect(objects.find((o) => o.id === 'campfire').placement).toBe('outdoor');
	});

	it('no object relies on the removed noHome flag any more', async () => {
		const objects = (await import('../../data/habitat-objects.json')).default.records as any[];
		expect(objects.filter((o) => (o as any).noHome)).toEqual([]);
	});
});

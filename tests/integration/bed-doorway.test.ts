import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// Beds and sleeping bags must stay clear of the doorway.
//
// Sleeping skips the clock forward to the next dawn, so a bed parked in the exit
// is a trap: you have to walk over it every time you try to leave. The rule is
// enforced server-side (the frontend is never trusted) for both placing and
// moving, in the house and in a trail tent.
//
// Imports the TS SOURCE directly — like home-perks.test.ts — so this is covered
// without waiting on `npm run build:server`.

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

// The home interior is centred in the 30×20 grid; the door is the bottom wall,
// horizontally centred. Mirrors homeRoom()/doorTileOf() in server/resources.ts.
const GRID_W = 30;
const GRID_H = 20;
function room(inner: { w: number; h: number }) {
	const x0 = Math.floor((GRID_W - inner.w) / 2);
	const y0 = Math.floor((GRID_H - inner.h) / 2);
	const x1 = x0 + inner.w - 1;
	const y1 = y0 + inner.h - 1;
	return { x0, y0, x1, y1, doorX: Math.round((x0 + x1) / 2), doorY: y1 };
}
/** Inner floor size for home space level 2 — HOME_TRACKS.space.levels[1] in
 *  server/resources.ts. Tent interiors are always 6×5 (TENT_INNER). */
const HOME_INNER_SPACE_2 = { w: 8, h: 6 };
let HOME: ReturnType<typeof room>;

/** Give the player a built house plus one of each sleepable, ready to place. */
async function givenBeds(space = 2) {
	await holder.db.Player.patch(pid, {
		home: { style: 'cabin', space, comfort: 1, decor: 1, light: 1, styleLocked: true },
		craftedItems: { 'home-bed': 5, 'home-sleeping-bag': 5, 'garden-gnome': 5 },
		devUnlockAll: true,
	});
}

const place = (objectId: string, x: number, y: number, area = 'home') =>
	post('PlaceObject', { playerId: pid, objectId, area, x, y });

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Sleeper', passcode: '1234', appearance })).playerId;
	await givenBeds();
	HOME = room(HOME_INNER_SPACE_2);
});

describe('placing a bed near the door', () => {
	it('refuses the doorway tile itself', async () => {
		await expect(place('home-bed', HOME.doorX, HOME.doorY)).rejects.toThrow(/doorway/i);
	});

	it('refuses every tile touching the door, including diagonals', async () => {
		const around: [number, number][] = [];
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				const x = HOME.doorX + dx;
				const y = HOME.doorY + dy;
				// only tiles that are actually on the floor are reachable to begin with
				if (x < HOME.x0 || x > HOME.x1 || y < HOME.y0 || y > HOME.y1) continue;
				around.push([x, y]);
			}
		}
		expect(around.length).toBeGreaterThan(3); // sanity: we're testing a real ring
		for (const [x, y] of around) {
			await expect(place('home-bed', x, y)).rejects.toThrow(/doorway/i);
		}
	});

	it('applies to the sleeping bag too, not just the bed', async () => {
		await expect(place('home-sleeping-bag', HOME.doorX, HOME.doorY)).rejects.toThrow(/doorway/i);
	});

	it('allows a bed two tiles away from the door', async () => {
		const res = await place('home-bed', HOME.doorX, HOME.doorY - 2);
		expect(res.ok).toBe(true);
	});

	it('allows a bed in the far corner', async () => {
		const res = await place('home-bed', HOME.x0, HOME.y0);
		expect(res.ok).toBe(true);
	});

	it('does not restrict non-sleepable furniture at the door', async () => {
		// Only beds are a trap — an ornament by the door is fine.
		const res = await place('garden-gnome', HOME.doorX, HOME.doorY);
		expect(res.ok).toBe(true);
	});
});

describe('moving a bed near the door', () => {
	it('refuses to move an existing bed into the doorway', async () => {
		const placed = await place('home-bed', HOME.x0, HOME.y0);
		const id = placed.placement?.id ?? placed.placementId;
		expect(id).toBeTruthy();
		await expect(post('MoveObject', { playerId: pid, placementId: id, x: HOME.doorX, y: HOME.doorY })).rejects.toThrow(
			/doorway/i,
		);
	});

	it('still allows moving a bed somewhere legal', async () => {
		const placed = await place('home-bed', HOME.x0, HOME.y0);
		const id = placed.placement?.id ?? placed.placementId;
		const moved = await post('MoveObject', { playerId: pid, placementId: id, x: HOME.x1, y: HOME.y0 });
		expect(moved.ok).toBe(true);
	});

	it('leaves the bed where it was when the move is refused', async () => {
		const placed = await place('home-bed', HOME.x0, HOME.y0);
		const id = placed.placement?.id ?? placed.placementId;
		await post('MoveObject', { playerId: pid, placementId: id, x: HOME.doorX, y: HOME.doorY }).catch(() => {});
		const row = holder.db.Placement._rows.get(id);
		expect({ x: row.x, y: row.y }).toEqual({ x: HOME.x0, y: HOME.y0 });
	});
});

describe('trail tents get the same rule', () => {
	const TENT = room({ w: 6, h: 5 });

	beforeEach(async () => {
		await holder.db.Player.patch(pid, { unlockedBiomes: ['meadow'] });
	});

	it('refuses a sleeping bag in the tent doorway', async () => {
		await expect(place('home-sleeping-bag', TENT.doorX, TENT.doorY, 'tent-meadow')).rejects.toThrow(/doorway/i);
	});

	it('allows a sleeping bag at the back of the tent', async () => {
		const res = await place('home-sleeping-bag', TENT.doorX, TENT.y0, 'tent-meadow');
		expect(res.ok).toBe(true);
	});
});

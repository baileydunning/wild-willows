import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeWorld, appearance, type Db } from './harness';
import objectsData from '../../data/habitat-objects.json';
import recipesData from '../../data/recipes.json';

// Wall decor: things that hang, and can go nowhere else.
//
// A framed landscape used to be placed on the floorboards like a chair, because
// the floor was the only surface an interior had. `mount: 'wall'` gives those
// pieces the wall ring instead — the back run and the two side walls — and the
// rule is enforced server-side in both directions: a picture may not stand on
// the floor, and an armchair may not hang. Placing AND moving, house and tent.
//
// Also here: the Cozy Bed. It waited on the barn owl, so a player could build a
// house and have nothing to sleep in for most of a meadow's recovery. Building
// the house is the gate now, and this pins that.
//
// Imports the TS SOURCE directly — like bed-doorway.test.ts — so this is covered
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

// Mirrors homeRoom() in server/home.ts: the interior is centred in the 30×20 grid.
const GRID_W = 30;
const GRID_H = 20;
function room(inner: { w: number; h: number }) {
	const x0 = Math.floor((GRID_W - inner.w) / 2);
	const y0 = Math.floor((GRID_H - inner.h) / 2);
	const x1 = x0 + inner.w - 1;
	const y1 = y0 + inner.h - 1;
	return { x0, y0, x1, y1, doorX: Math.round((x0 + x1) / 2), doorY: y1 };
}
const HOME = room({ w: 8, h: 6 }); // space level 2 — what a freshly built house gets
const TENT = room({ w: 6, h: 5 });

const place = (objectId: string, x: number, y: number, area = 'home') =>
	post('PlaceObject', { playerId: pid, objectId, area, x, y });
const move = (placementId: string, x: number, y: number) => post('MoveObject', { playerId: pid, placementId, x, y });
const idOf = (res: any) => res.placement?.id ?? res.placementId;

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Decorator', passcode: '1234', appearance })).playerId;
	await holder.db.Player.patch(pid, {
		home: { style: 'cabin', space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true },
		craftedItems: { 'home-painting': 5, 'home-strawwreath': 5, 'home-armchair': 5, 'home-sleeping-bag': 5 },
		unlockedBiomes: ['meadow'],
		devUnlockAll: true,
	});
});

describe('the data says which pieces hang', () => {
	const objs = objectsData.records as any[];

	it('marks only indoor items as wall-mounted', () => {
		const wall = objs.filter((o) => o.mount === 'wall');
		expect(wall.length).toBeGreaterThan(0);
		for (const o of wall) expect(o.placement, o.id).toBe('indoor');
	});

	it('gives every wall item a recipe, so a wall can actually be filled', () => {
		const made = new Set((recipesData.records as any[]).map((r) => r.output.itemId));
		for (const o of objs.filter((x) => x.mount === 'wall')) expect(made.has(o.id), o.id).toBe(true);
	});
});

describe('hanging things on a wall', () => {
	it('takes the back wall', async () => {
		expect((await place('home-painting', HOME.x0 + 2, HOME.y0 - 1)).ok).toBe(true);
	});

	it('takes either side wall', async () => {
		expect((await place('home-painting', HOME.x0 - 1, HOME.y0 + 1)).ok).toBe(true);
		expect((await place('home-strawwreath', HOME.x1 + 1, HOME.y1)).ok).toBe(true);
	});

	it('refuses the floor', async () => {
		await expect(place('home-painting', HOME.x0 + 2, HOME.y0 + 2)).rejects.toThrow(/wall/i);
	});

	it('refuses the corners and the door wall', async () => {
		await expect(place('home-painting', HOME.x0 - 1, HOME.y0 - 1)).rejects.toThrow(/wall/i);
		await expect(place('home-painting', HOME.doorX, HOME.y1 + 1)).rejects.toThrow(/wall/i);
	});

	it('will not hang two things on one tile', async () => {
		await place('home-painting', HOME.x0, HOME.y0 - 1);
		await expect(place('home-strawwreath', HOME.x0, HOME.y0 - 1)).rejects.toThrow(/taken|occupied/i);
	});
});

describe('floor furniture stays on the floor', () => {
	it('refuses to stand an armchair on the wall', async () => {
		await expect(place('home-armchair', HOME.x0 + 2, HOME.y0 - 1)).rejects.toThrow(/floor/i);
	});

	it('still places it happily on the floor', async () => {
		expect((await place('home-armchair', HOME.x0 + 2, HOME.y0 + 2)).ok).toBe(true);
	});
});

describe('moving is held to the same rule as placing', () => {
	it('refuses to move a hung picture down onto the floor', async () => {
		const id = idOf(await place('home-painting', HOME.x0, HOME.y0 - 1));
		await expect(move(id, HOME.x0 + 2, HOME.y0 + 2)).rejects.toThrow(/wall/i);
	});

	it('leaves it hanging where it was when the move is refused', async () => {
		const id = idOf(await place('home-painting', HOME.x0, HOME.y0 - 1));
		await move(id, HOME.x0 + 2, HOME.y0 + 2).catch(() => {});
		const row = holder.db.Placement._rows.get(id);
		expect({ x: row.x, y: row.y }).toEqual({ x: HOME.x0, y: HOME.y0 - 1 });
	});

	it('allows moving it along the wall', async () => {
		const id = idOf(await place('home-painting', HOME.x0, HOME.y0 - 1));
		expect((await move(id, HOME.x1 + 1, HOME.y0 + 2)).ok).toBe(true);
	});

	it('refuses to move an armchair up onto the wall', async () => {
		const id = idOf(await place('home-armchair', HOME.x0 + 2, HOME.y0 + 2));
		await expect(move(id, HOME.x0, HOME.y0 - 1)).rejects.toThrow(/floor/i);
	});
});

describe('a trail tent has walls too', () => {
	it('hangs a wreath on the back of the tent', async () => {
		expect((await place('home-strawwreath', TENT.x0 + 1, TENT.y0 - 1, 'tent-meadow')).ok).toBe(true);
	});

	it('refuses the tent floor', async () => {
		await expect(place('home-strawwreath', TENT.x0 + 1, TENT.y0 + 1, 'tent-meadow')).rejects.toThrow(/wall/i);
	});
});

describe('the Cozy Bed comes with the house', () => {
	const bed = (recipesData.records as any[]).find((r) => r.id === 'home-bed');

	it('is gated on building a home and nothing else', () => {
		expect(bed.unlock).toMatchObject({ homeBuilt: true });
		expect(Object.keys(bed.unlock).filter((k) => k !== 'label')).toEqual(['homeBuilt']);
	});

	it('fits the house a fresh build gives you', () => {
		// A freshly built house is space 2 (SetHomeStyle), so a homeMin above that
		// would gate the bed a second time behind an upgrade nobody was told about.
		const def = (objectsData.records as any[]).find((o) => o.id === 'home-bed');
		expect(def.homeMin || 1).toBeLessThanOrEqual(2);
	});

	it('is craftable the moment the style is chosen', async () => {
		await holder.db.Player.patch(pid, {
			devUnlockAll: false,
			home: { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false },
			inventory: { branches: 40, fiber: 40, stones: 40, clay: 40 },
		});
		// a meadow recovered far enough to build in — the house's own gate, which
		// is the only thing that should stand between a caretaker and a bed
		for (const [key, row] of holder.db.BiomeState._rows) {
			if (row.biomeId === 'meadow') holder.db.BiomeState._rows.set(key, { ...row, health: 35 });
		}
		// still living in the tent: no house, no bed
		await expect(post('CraftItem', { playerId: pid, recipeId: 'home-bed' })).rejects.toThrow();
		await post('SetHomeStyle', { playerId: pid, style: 'cabin' });
		const made = await post('CraftItem', { playerId: pid, recipeId: 'home-bed' });
		expect(made.ok).toBe(true);
	});
});

describe('putting small things on tables', () => {
	// One thing per tile, with exactly one exception: a small ornament may stand
	// on a surface. Two is a tabletop; three would be a stack, and a stack raises
	// questions ("which one am I clicking?") that nothing here could answer.
	const objs = objectsData.records as any[];
	const surfaces = objs.filter((o) => o.surface);
	const smalls = objs.filter((o) => o.small);

	beforeEach(async () => {
		await holder.db.Player.patch(pid, {
			craftedItems: {
				'home-table': 3,
				'home-potplant': 3,
				'home-snowglobe': 3,
				'home-armchair': 3,
				'home-bookshelf': 2,
			},
		});
	});

	it('has surfaces and small things to put on them', () => {
		expect(surfaces.length).toBeGreaterThan(0);
		expect(smalls.length).toBeGreaterThan(0);
		// nothing is both — a table you could stand on a table is the stack this
		// rule exists to avoid
		expect(objs.filter((o) => o.surface && o.small)).toEqual([]);
	});

	it('stands a house plant on a table', async () => {
		await place('home-table', HOME.x0 + 2, HOME.y0 + 2);
		const res = await place('home-potplant', HOME.x0 + 2, HOME.y0 + 2);
		expect(res.ok).toBe(true);
	});

	it('will not put a second ornament on the same table', async () => {
		await place('home-table', HOME.x0 + 2, HOME.y0 + 2);
		await place('home-potplant', HOME.x0 + 2, HOME.y0 + 2);
		await expect(place('home-snowglobe', HOME.x0 + 2, HOME.y0 + 2)).rejects.toThrow(/taken|occupied/i);
	});

	it('will not stand an armchair on a table', async () => {
		await place('home-table', HOME.x0 + 2, HOME.y0 + 2);
		await expect(place('home-armchair', HOME.x0 + 2, HOME.y0 + 2)).rejects.toThrow(/taken|occupied/i);
	});

	it('will not slide a table under a plant already on the floor', async () => {
		// the reverse direction is refused on purpose: the tile it would share is
		// the floor, not a tabletop
		await place('home-potplant', HOME.x0 + 3, HOME.y0 + 2);
		await expect(place('home-table', HOME.x0 + 3, HOME.y0 + 2)).rejects.toThrow(/taken|occupied/i);
	});

	it('moves a plant up onto a table, and back off it', async () => {
		await place('home-table', HOME.x0 + 2, HOME.y0 + 2);
		const id = idOf(await place('home-potplant', HOME.x0 + 4, HOME.y0 + 2));
		expect((await move(id, HOME.x0 + 2, HOME.y0 + 2)).ok).toBe(true);
		expect((await move(id, HOME.x0 + 4, HOME.y0 + 2)).ok).toBe(true);
	});

	it('will not move the table out from under what is standing on it', async () => {
		const tableId = idOf(await place('home-table', HOME.x0 + 2, HOME.y0 + 2));
		await place('home-potplant', HOME.x0 + 2, HOME.y0 + 2);
		await expect(move(tableId, HOME.x0 + 5, HOME.y0 + 3)).rejects.toThrow(/take the/i);
	});

	it('will not pick the table up out from under it either', async () => {
		const tableId = idOf(await place('home-table', HOME.x0 + 2, HOME.y0 + 2));
		await place('home-potplant', HOME.x0 + 2, HOME.y0 + 2);
		await expect(post('RemoveObject', { playerId: pid, placementId: tableId })).rejects.toThrow(/take the/i);
	});

	it('lets the table go once the top is clear', async () => {
		const tableId = idOf(await place('home-table', HOME.x0 + 2, HOME.y0 + 2));
		const plantId = idOf(await place('home-potplant', HOME.x0 + 2, HOME.y0 + 2));
		await post('RemoveObject', { playerId: pid, placementId: plantId });
		expect((await post('RemoveObject', { playerId: pid, placementId: tableId })).ok).toBe(true);
	});
});

describe('every seat can actually be sat on', () => {
	// The seat table lives in WorldScene (it is a question of sprite geometry, not
	// of data), so this reads the source: a chair the player cannot sit in is the
	// bug, and it is invisible from anywhere else.
	const scene = readFileSync(resolve(process.cwd(), 'src/game/WorldScene.ts'), 'utf8');
	const seatShapes = new Set(
		[
			...scene
				.slice(scene.indexOf('SEATS: Record<'))
				.slice(0, 1400)
				.matchAll(/^\t\t(\w+): \{ dy:/gm),
		].map((m) => m[1]),
	);
	const SEATY = /\bchair\b|\bstool\b|\bbench\b|cushion|pouf|blanket/i;

	it('found the seat table at all', () => {
		expect(seatShapes.size).toBeGreaterThan(4);
	});

	it('covers everything that reads as somewhere to sit', () => {
		const unsittable = (objectsData.records as any[])
			.filter((o) => SEATY.test(o.name) && !seatShapes.has(o.shape))
			.map((o) => `${o.name} (${o.shape})`);
		expect(unsittable, `seats with nowhere to sit: ${unsittable.join(', ')}`).toEqual([]);
	});

	it('every seat shape belongs to something real', () => {
		const shapes = new Set((objectsData.records as any[]).map((o) => o.shape));
		for (const s of seatShapes) expect(shapes.has(s), `${s} is not any object's shape`).toBe(true);
	});
});

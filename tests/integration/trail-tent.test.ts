import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// Trail tents: craftable home bases you pitch (one per wild biome, never the
// meadow) and step inside to decorate — each opens a `tent-<biome>` interior
// that follows the home's indoor rules at the starter-tent size.
//
// Like home-perks.test.ts, these import the TS SOURCE directly (the same way
// src/solo/backend.ts does) rather than the built resources.js bundle, so the
// new server logic is covered before `npm run build:server` regenerates it.

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

// tentRoom(): TENT_INNER 6×5 centred in the 30×20 base grid → floor 12–17 × 7–11
const FLOOR = { x: 13, y: 8 };

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Scout', passcode: '1234', appearance })).playerId;
	await holder.db.Player.patch(pid, {
		unlockedBiomes: ['meadow', 'forest'],
		craftedItems: { 'trail-tent': 2, 'home-rug': 1, 'home-bed': 1, 'grass-patch': 1 },
	});
});

describe('pitching a trail tent', () => {
	it('cannot be pitched in the meadow (home turf)', async () => {
		await expect(
			post('PlaceObject', { playerId: pid, objectId: 'trail-tent', area: 'meadow', x: 10, y: 10 }),
		).rejects.toThrow(/suit/i);
	});

	it('pitches in a wild biome, but only one per biome', async () => {
		const r = await post('PlaceObject', { playerId: pid, objectId: 'trail-tent', area: 'forest', x: 10, y: 10 });
		expect(r.ok).toBe(true);
		await expect(
			post('PlaceObject', { playerId: pid, objectId: 'trail-tent', area: 'forest', x: 12, y: 12 }),
		).rejects.toThrow(/already/i);
	});
});

describe('the tent interior', () => {
	beforeEach(async () => {
		await post('PlaceObject', { playerId: pid, objectId: 'trail-tent', area: 'forest', x: 10, y: 10 });
	});

	it('can be entered once pitched — and only where pitched', async () => {
		const r = await post('SyncPlayer', { playerId: pid, area: 'tent-forest' });
		expect(r.ok ?? true).toBeTruthy();
		expect((await holder.db.Player.get(pid)).area).toBe('tent-forest');
		await expect(post('SyncPlayer', { playerId: pid, area: 'tent-meadow' })).rejects.toThrow(/no tent/i);
	});

	it('accepts starter indoor furniture on the floor, following home rules', async () => {
		// off the floor → rejected (before the rug is consumed by a real placement)
		await expect(
			post('PlaceObject', { playerId: pid, objectId: 'home-rug', area: 'tent-forest', x: 2, y: 2 }),
		).rejects.toThrow(/floor/i);
		const r = await post('PlaceObject', {
			playerId: pid,
			objectId: 'home-rug',
			area: 'tent-forest',
			x: FLOOR.x,
			y: FLOOR.y,
		});
		expect(r.ok).toBe(true);
		expect(r.placement.area).toBe('tent-forest');
	});

	it('rejects outdoor items and house-sized furniture', async () => {
		await expect(
			post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'tent-forest', x: FLOOR.x, y: FLOOR.y }),
		).rejects.toThrow(/preserve/i); // outdoor-only
		await expect(
			post('PlaceObject', { playerId: pid, objectId: 'home-bed', area: 'tent-forest', x: FLOOR.x, y: FLOOR.y }),
		).rejects.toThrow(/house/i); // homeMin 2 won't fit a tent
	});

	it('keeps the tent pinned while furnished, and frees it once packed up', async () => {
		const placed = await post('PlaceObject', {
			playerId: pid,
			objectId: 'home-rug',
			area: 'tent-forest',
			x: FLOOR.x,
			y: FLOOR.y,
		});
		const tent = (await holder.db.Placement.search({})) as any;
		const rows: any[] = [];
		for await (const row of tent) rows.push(row);
		const tentRow = rows.find((p) => p.objectId === 'trail-tent');
		await expect(post('RemoveObject', { playerId: pid, placementId: tentRow.id })).rejects.toThrow(/inside/i);
		await post('RemoveObject', { playerId: pid, placementId: placed.placement.id });
		const gone = await post('RemoveObject', { playerId: pid, placementId: tentRow.id });
		expect(gone.ok).toBe(true);
	});
});

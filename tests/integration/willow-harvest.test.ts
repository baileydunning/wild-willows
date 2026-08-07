import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeWorld, appearance, type Db } from './harness';

// Fallen branches come off the willow itself — the preserve's namesake — the same
// way acorns come off an oak. A planted willow is the renewable source, so the
// tree you put in is the thing you come back to, and nothing extra is scattered
// on the ground to make that happen.
//
// The willow already cost branches to plant. Yielding them is what turns that
// from a one-way spend into a loop.

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

const GROW_MS = 90_000;

/** Drop a grown willow into the world and hand back its placement id. */
async function plantedWillow(plantedAt: number): Promise<string> {
	const id = 'willow-1';
	await holder.db.Placement.put({
		id,
		worldId: pid,
		playerId: pid,
		area: 'meadow',
		objectId: 'willow-tree',
		x: 5,
		y: 5,
		plantedAt,
	});
	return id;
}

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Willow', passcode: '1234', appearance })).playerId;
});

describe('harvesting a willow', () => {
	it('gives fallen branches once it has grown', async () => {
		const placementId = await plantedWillow(Date.now() - GROW_MS - 1000);
		const r = await post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.branches).toBe(2);
		expect(r.inventory.branches).toBe(2);
	});

	it('leaves the tree standing so it can be harvested again', async () => {
		// The whole point of harvesting over uprooting: the willow stays.
		const placementId = await plantedWillow(Date.now() - GROW_MS - 1000);
		await post('HarvestPlacement', { playerId: pid, placementId });
		const still = await holder.db.Placement.get(placementId);
		expect(still.objectId).toBe('willow-tree');
		expect(still.lastHarvestAt).toBeGreaterThan(0);
	});

	it('makes you wait for the branches to fall again', async () => {
		const placementId = await plantedWillow(Date.now() - GROW_MS - 1000);
		await post('HarvestPlacement', { playerId: pid, placementId });
		// Immediately after, there is nothing to take.
		await expect(post('HarvestPlacement', { playerId: pid, placementId })).rejects.toThrow();
	});

	it('gives nothing before the sapling has grown', async () => {
		const placementId = await plantedWillow(Date.now());
		await expect(post('HarvestPlacement', { playerId: pid, placementId })).rejects.toThrow();
	});

	it('pays back what it cost to plant, so a willow is a loop and not a sink', async () => {
		// Read the real catalog rather than hardcoding: planting a willow costs
		// branches, so a yield below that cost would make the preserve's namesake a
		// net drain on the very thing it is meant to provide.
		const objects = JSON.parse(readFileSync(resolve(__dirname, '../../data/habitat-objects.json'), 'utf8')).records;
		const willow = objects.find((o: any) => o.id === 'willow-tree');
		expect(willow.yield.resourceId).toBe('branches');
		expect(willow.yield.qty).toBeGreaterThanOrEqual(willow.plantCost.branches);

		const placementId = await plantedWillow(Date.now() - GROW_MS - 1000);
		const r = await post('HarvestPlacement', { playerId: pid, placementId });
		expect(r.gained.branches).toBe(willow.yield.qty);
	});
});

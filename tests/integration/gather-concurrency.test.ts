import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, meadowResource, type Db } from './harness';

// The craft race was never craft-specific — every endpoint that reads the player,
// computes, and patches back had it. Gathering is the one players do most, so it
// is the one that cost the most: two nodes collected close together read the same
// basket and the second write dropped the first haul on the floor.
//
// Both are fixed by the same per-player queue (withPlayerLock in resources.ts).
// This is here so gathering keeps its own guard rather than relying on the craft
// test to notice.

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
const RES = meadowResource();
let pid: string;

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Gatherer', passcode: '1234', appearance })).playerId;
});

describe('gathering two nodes at once', () => {
	it('keeps both hauls', async () => {
		await Promise.all([
			post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES }),
			post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n1', resourceId: RES }),
		]);
		const p = await holder.db.Player.get(pid);
		expect(p.inventory[RES], 'two nodes gathered, only one landed in the basket').toBe(2);
	});
});

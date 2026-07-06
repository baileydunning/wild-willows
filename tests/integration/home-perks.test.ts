import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeWorld, appearance, meadowResource, type Db } from './harness';

// House-style signature perks: each built style grants a gameplay buff whose
// strength scales with total upgrade levels (see HOME_STYLES / homePerk in
// server/resources.ts). These tests import the TS SOURCE directly (the same
// way src/solo/backend.ts does) rather than the built bundle, so the perk
// logic is covered even before `npm run build:server` regenerates resources.js.
// Perk rolls are made deterministic by stubbing Math.random.

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

/** Build the player's house in `style` with the given track levels, and stock the basket. */
async function givenHouse(style: string, levels: Partial<Record<'space' | 'comfort' | 'decor' | 'light', number>> = {}, inventory: Record<string, number> = {}) {
	await holder.db.Player.patch(pid, {
		home: { style, space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true, ...levels },
		inventory,
		devUnlockAll: true,
	});
}

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Perky', passcode: '1234', appearance })).playerId;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Log Cabin — forager’s instinct (bonus gather)', () => {
	it('grants +1 material when the roll lands under the perk chance', async () => {
		await givenHouse('cabin'); // fresh build → base 10% chance
		vi.spyOn(Math, 'random').mockReturnValue(0.05);
		const g = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
		expect(g.perkBonus).toBe(1);
		expect(g.gained[RES]).toBe(2); // tier-1 tool gathers 1, +1 bonus
	});

	it('does not proc above the chance, and upgrades raise that chance', async () => {
		await givenHouse('cabin');
		const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.55);
		const miss = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n1', resourceId: RES });
		expect(miss.perkBonus).toBeUndefined();
		expect(miss.gained[RES]).toBe(1);

		// maxed house (16 levels) → chance capped at 60%, so the same 0.55 roll now procs
		await givenHouse('cabin', { space: 4, comfort: 4, decor: 4, light: 4 });
		rnd.mockReturnValue(0.55);
		const hit = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n2', resourceId: RES });
		expect(hit.perkBonus).toBe(1);
	});

	it('grants nothing while the home is still a tent', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.0);
		const g = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n3', resourceId: RES });
		expect(g.perkBonus).toBeUndefined();
		expect(g.gained[RES]).toBe(1);
	});
});

describe('Meadow Cottage — green thumb (growth head start)', () => {
	it('backdates a new planting by the perk strength', async () => {
		await givenHouse('cottage', {}, { seeds: 4 }); // base 10% head start
		await holder.db.TerrainTile.put({ id: 'tt-test', worldId: pid, area: 'meadow', x: 3, y: 3, type: 'watered' });
		const before = Date.now();
		const r = await post('Plant', { playerId: pid, area: 'meadow', x: 3, y: 3, plantId: 'wildflower-patch' });
		expect(r.perkGrowth).toBeCloseTo(0.1, 5);
		// wildflower-patch: growSeconds 45 → plantedAt backdated by ~4.5s
		const backdatedBy = before - r.placement.plantedAt;
		expect(backdatedBy).toBeGreaterThanOrEqual(4400);
		expect(backdatedBy).toBeLessThanOrEqual(4700);
		// matureHours 2 → placedAt backdated by ~12min
		expect(before - r.placement.placedAt).toBeGreaterThanOrEqual(0.099 * 2 * 3_600_000);
	});

	it('plants with no head start from other styles', async () => {
		await givenHouse('cabin', {}, { seeds: 4 });
		await holder.db.TerrainTile.put({ id: 'tt-test2', worldId: pid, area: 'meadow', x: 4, y: 4, type: 'watered' });
		const before = Date.now();
		const r = await post('Plant', { playerId: pid, area: 'meadow', x: 4, y: 4, plantId: 'wildflower-patch' });
		expect(r.perkGrowth).toBeUndefined();
		expect(r.placement.plantedAt).toBeGreaterThanOrEqual(before);
	});
});

describe('Stone Hearth — hearthkeeper’s thrift (craft refund)', () => {
	it('refunds half of each material when the roll lands', async () => {
		await givenHouse('stone', {}, { stones: 2 });
		vi.spyOn(Math, 'random').mockReturnValue(0.05);
		const r = await post('CraftItem', { playerId: pid, recipeId: 'simple-path' }); // costs 2 stones
		expect(r.refund).toEqual({ stones: 1 });
		expect(r.inventory.stones).toBe(1); // 2 spent, 1 back
	});

	it('keeps crafting deterministic when the roll misses', async () => {
		await givenHouse('stone', {}, { stones: 2 });
		vi.spyOn(Math, 'random').mockReturnValue(0.95);
		const r = await post('CraftItem', { playerId: pid, recipeId: 'simple-path' });
		expect(r.refund).toBeUndefined();
		expect(r.inventory.stones).toBeUndefined(); // all consumed
	});
});

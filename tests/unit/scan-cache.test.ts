// The request-scoped read cache, at the level where its safety argument lives.
//
// Two properties matter, and only one of them is about speed:
//
//  • A read repeated inside one request loads once. That is the win.
//  • A read AFTER a write in the same request never answers from before it. That
//    is the whole risk. recalcBiome's `addPlacements` fold-in exists because a
//    search inside a transaction can return the pre-write version of a record,
//    and a cache that served a stale row would be that same bug wearing a
//    friendlier name — wrong game state, not a slow one, with nothing to see in
//    a profile.
//
// Tested here rather than through an endpoint because every call site that
// writes-then-reads today also passes the written rows down by hand, so the
// endpoints cannot distinguish a correct cache from a stale one. The contract
// still has to hold for the next call site that doesn't.

import { describe, it, expect, beforeEach } from 'vitest';
import { cached, closeScope, invalidateTable, openScope, resetScopes } from '../../server/scan-cache';

const SCOPE = 'ada';

/** A loader that counts how many times it actually ran. */
function counted<T>(value: () => T) {
	const state = { calls: 0 };
	return [
		async () => {
			state.calls++;
			return value();
		},
		state,
	] as const;
}

beforeEach(() => resetScopes());

describe('with no scope open', () => {
	it('reads through every time', async () => {
		const [load, state] = counted(() => [1, 2, 3]);
		await cached(SCOPE, 'BiomeState|world', load);
		await cached(SCOPE, 'BiomeState|world', load);
		expect(state.calls).toBe(2);
	});

	it('does not answer from another id’s scope', async () => {
		openScope('someone-else');
		const [load, state] = counted(() => ['mine']);
		await cached(SCOPE, 'BiomeState|world', load);
		await cached(SCOPE, 'BiomeState|world', load);
		// The scope key IS the safety argument: a world id that matches no locked
		// player id (a legacy shared world) must read through, uncached.
		expect(state.calls).toBe(2);
		closeScope('someone-else');
	});
});

describe('inside a scope', () => {
	beforeEach(() => openScope(SCOPE));

	it('loads once and serves the rest', async () => {
		const [load, state] = counted(() => [{ id: 'a' }, { id: 'b' }]);
		const first = await cached(SCOPE, 'BiomeState|world', load);
		const second = await cached(SCOPE, 'BiomeState|world', load);
		expect(state.calls).toBe(1);
		expect(second).toEqual(first);
	});

	it('hands back a detached array, so one reader’s fold-in cannot leak', async () => {
		// awardAchievements pushes onto the discoveries it was given; recalcBiome
		// filters and pushes onto its terrain. byWorld has always returned a fresh
		// array per call, and callers depend on that.
		const [load] = counted(() => [{ id: 'a' }]);
		const first = await cached(SCOPE, 'Discovery|world', load);
		first.push({ id: 'folded-in' });
		const second = await cached(SCOPE, 'Discovery|world', load);
		expect(second).toHaveLength(1);
		expect(first).toHaveLength(2);
	});

	it('keys entries apart, so one table’s read is not another’s', async () => {
		const [placements, pState] = counted(() => ['p']);
		const [terrain, tState] = counted(() => ['t']);
		expect(await cached(SCOPE, 'Placement|world', placements)).toEqual(['p']);
		expect(await cached(SCOPE, 'TerrainTile|area:meadow', terrain)).toEqual(['t']);
		expect(pState.calls).toBe(1);
		expect(tState.calls).toBe(1);
	});

	it('joins concurrent reads of the same rows into one load', async () => {
		let calls = 0;
		const load = async () => {
			calls++;
			await new Promise((r) => setTimeout(r, 5));
			return ['row'];
		};
		const [a, b] = await Promise.all([
			cached(SCOPE, 'BiomeState|world', load),
			cached(SCOPE, 'BiomeState|world', load),
		]);
		expect(calls).toBe(1);
		expect(a).toEqual(b);
		// …and still detached from each other.
		expect(a).not.toBe(b);
	});

	it('does not remember a load that failed', async () => {
		let calls = 0;
		const load = async () => {
			calls++;
			if (calls === 1) throw new Error('cold instance');
			return ['recovered'];
		};
		await expect(cached(SCOPE, 'Chest|world', load)).rejects.toThrow('cold instance');
		expect(await cached(SCOPE, 'Chest|world', load)).toEqual(['recovered']);
	});
});

describe('a write drops what it invalidates', () => {
	beforeEach(() => openScope(SCOPE));

	it('re-reads the table that was written, in the same request', async () => {
		const rows = [{ id: 'a' }];
		const [load, state] = counted(() => rows.slice());
		expect(await cached(SCOPE, 'Placement|world', load)).toHaveLength(1);

		rows.push({ id: 'b' }); // the write
		invalidateTable('Placement');

		expect(await cached(SCOPE, 'Placement|world', load)).toHaveLength(2);
		expect(state.calls).toBe(2);
	});

	it('drops every read of that table, not just the one key', async () => {
		// A new placement belongs in a scan that ran before it existed, whatever
		// prefix that scan was bounded to — so there is no per-key survivor.
		const [world, wState] = counted(() => ['world']);
		const [area, aState] = counted(() => ['area']);
		await cached(SCOPE, 'TerrainTile|world', world);
		await cached(SCOPE, 'TerrainTile|area:meadow', area);
		invalidateTable('TerrainTile');
		await cached(SCOPE, 'TerrainTile|world', world);
		await cached(SCOPE, 'TerrainTile|area:meadow', area);
		expect(wState.calls).toBe(2);
		expect(aState.calls).toBe(2);
	});

	it('leaves other tables alone', async () => {
		const [load, state] = counted(() => ['d']);
		await cached(SCOPE, 'Discovery|world', load);
		invalidateTable('Placement');
		await cached(SCOPE, 'Discovery|world', load);
		expect(state.calls).toBe(1);
	});
});

describe('the scope does not outlive the request', () => {
	it('forgets everything on close, so the next request re-reads', async () => {
		openScope(SCOPE);
		const [load, state] = counted(() => ['row']);
		await cached(SCOPE, 'BiomeState|world', load);
		closeScope(SCOPE);

		openScope(SCOPE);
		await cached(SCOPE, 'BiomeState|world', load);
		closeScope(SCOPE);
		expect(state.calls).toBe(2);
	});

	it('survives a nested open/close rather than being dropped by the inner one', async () => {
		openScope(SCOPE);
		const [load, state] = counted(() => ['row']);
		await cached(SCOPE, 'BiomeState|world', load);
		openScope(SCOPE);
		closeScope(SCOPE); // inner release — the outer request is still running
		await cached(SCOPE, 'BiomeState|world', load);
		expect(state.calls).toBe(1);
		closeScope(SCOPE);
	});
});

// The bug this file did not catch, and why.
//
// Entry keys are `${tableName(table)}|…`, and tableName() used to read the name
// off the table alone. Harper tables are classes, so `.name` is their class name;
// every fake table in this repo's harnesses is an object literal with a `name`
// property. The in-app solo backend is the only one that is neither — LocalDb
// builds `db[name] = new LocalTable()`, so the name lives on the db object and an
// instance has none.
//
// The result was not a missing optimization. Every key collapsed to `|world` and
// `|area:…`, so one table's rows were served for another's; '' matched neither
// WORLD_KEYED nor AREA_KEYED, so every read became an unbounded scan; and
// invalidateTable('') returned before doing anything. In the shipped desktop game
// biome health froze, and no animal but the grasshopper ever came home.
//
// Two guards, tested here because a nameless table is exactly what no other
// harness models: db() resolves the name from the db key (server/core.ts), and
// cached() refuses to cache a key it cannot attribute to a table.
describe('a table that does not know its own name', () => {
	it('never shares one cache entry between tables', async () => {
		openScope(SCOPE);
		try {
			const [placements, pState] = counted(() => [{ id: 'p1' }]);
			const [discoveries, dState] = counted(() => [{ id: 'd1' }]);
			// What worlds.ts builds when tableName() answers '' for both tables.
			const a = await cached(SCOPE, '|world', placements);
			const b = await cached(SCOPE, '|world', discoveries);
			expect(pState.calls).toBe(1);
			// The failure: one load, and Discovery handed back Placement's rows.
			expect(dState.calls, 'an unattributable key must not be cached').toBe(1);
			expect(a).toEqual([{ id: 'p1' }]);
			expect(b).toEqual([{ id: 'd1' }]);
		} finally {
			closeScope(SCOPE);
		}
	});

	it('still caches normally once the name resolves', async () => {
		openScope(SCOPE);
		try {
			const [load, state] = counted(() => [{ id: 'p1' }]);
			await cached(SCOPE, 'Placement|world', load);
			await cached(SCOPE, 'Placement|world', load);
			expect(state.calls).toBe(1);
			invalidateTable('Placement');
			await cached(SCOPE, 'Placement|world', load);
			expect(state.calls).toBe(2);
		} finally {
			closeScope(SCOPE);
		}
	});
});

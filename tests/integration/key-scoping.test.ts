// The key contract (KEY_REV 4) — see the block above `byPlayer` in
// server/resources.ts and the note in schema.graphql.
//
// Every mutable row is keyed so one world's rows form a contiguous run in the
// primary key index, which lets a per-world read be a bounded range scan rather
// than a scan of every save in the database. These tests hold that property in
// place from three directions:
//
//   1. ISOLATION  — one world never sees another's rows.
//   2. BOUNDEDNESS — a state read's cost does not grow when unrelated saves are
//                    added. This is the whole reason the contract exists, and it
//                    is the part that silently regresses the moment someone
//                    writes a row with an unprefixed id.
//   3. MIGRATION  — a save written under the OLD id scheme is re-keyed on login
//                   and loses nothing on the way.
//
// The harness models Harper's primary-key `starts_with` bound faithfully (only
// keys inside the range are visited), so a row written outside its world's run
// genuinely disappears from these reads — which is what makes (2) able to fail.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

async function make(name: string, passcode = 'pw1234'): Promise<string> {
	const created = await w.post<any>('CreatePlayer', { name, passcode, appearance });
	return created.playerId;
}

/** Play a little: dig a bed, so the save owns rows in the hot tables. */
async function settle(playerId: string) {
	await w.post('Heartbeat', { playerId });
	await w.post('AppendFeed', { playerId, entries: [{ at: Date.now(), icon: 'leaf', text: 'hello' }] });
}

const WORLD_TABLES = ['BiomeState', 'Placement', 'Chest', 'Discovery', 'NodeState', 'TerrainTile', 'FeedEntry'];

describe('key contract: isolation', () => {
	it('every mutable row a save owns is written inside that save key run', async () => {
		const a = await make('Ada');
		await settle(a);
		for (const name of WORLD_TABLES) {
			for (const row of w.db[name]._rows.values()) {
				const owner = row.worldId ?? row.playerId;
				if (owner !== a) continue;
				expect(
					String(row.id).startsWith(`${a}:`),
					`${name} row "${row.id}" is outside world "${a}" key run — a bounded read will not see it`,
				).toBe(true);
			}
		}
	});

	it('one world never reads another world rows', async () => {
		const a = await make('Ada');
		const b = await make('Bea');
		await settle(a);
		await settle(b);

		const stateA = await w.get<any>('GameState', a);
		// Feed entries are array members inside the single feed row, not rows, so
		// their ids are not primary keys and carry no world prefix. The ROW is
		// covered by the "inside that save key run" test above.
		const idsA = [...stateA.placements, ...stateA.terrain].map((r: any) => String(r.id));
		expect(idsA.length).toBeGreaterThan(0);
		expect(idsA.every((id) => id.startsWith(`${a}:`))).toBe(true);
		expect(idsA.some((id) => id.startsWith(`${b}:`))).toBe(false);
	});
});

describe('key contract: boundedness', () => {
	it('a state read does not get more expensive as unrelated saves pile up', async () => {
		const a = await make('Ada');
		await settle(a);

		const cost = async () => {
			for (const name of WORLD_TABLES) w.db[name]._resetScanStats();
			await w.get('GameState', a);
			return WORLD_TABLES.reduce((n, name) => n + w.db[name]._scanStats().rowsScanned, 0);
		};

		const alone = await cost();
		expect(alone).toBeGreaterThan(0);

		// Twenty other people create saves and play. None of it is Ada's.
		for (let i = 0; i < 20; i++) {
			const other = await make(`Neighbour${i}`);
			await settle(other);
		}

		const crowded = await cost();
		// The pre-KEY_REV-2 full scan grew linearly here — 21x the rows for the
		// same request. Bounded, Ada's read is unchanged.
		expect(crowded).toBe(alone);
	});

	it('a state read performs no unbounded scan of a world-owned table', async () => {
		const a = await make('Ada');
		await settle(a);
		for (const name of WORLD_TABLES) w.db[name]._resetScanStats();
		await w.get('GameState', a);
		for (const name of WORLD_TABLES) {
			expect(w.db[name]._scanStats().unboundedScans, `${name} was scanned unbounded during a state read`).toBe(0);
		}
	});
});

describe('key contract: migration', () => {
	// NOTE: worlds this process has already confirmed are keyed live in a module
	// level memo inside the bundle, and the bundle is imported once for the whole
	// run. So a save built through CreatePlayer is memoized as keyed the moment it
	// exists and can never be walked back to the legacy state from a test. These
	// tests therefore assemble the legacy save directly, under a world id this
	// process has never seen — which is also a truer reproduction of the real
	// case: rows on disk written by an older build, met by a cold worker.
	const LEGACY = 'legacy-caretaker';

	/** A save in the pre-KEY_REV-2 shape: bare ids, World row on keyRev 0. */
	async function seedLegacySave() {
		const donor = await make('Donor');
		const player = { ...w.db.Player._rows.get(donor), id: LEGACY, worldId: LEGACY };
		delete player.keyRev; // an older build never wrote one — that is the whole point
		w.db.Player._rows.set(LEGACY, player);
		w.db.World._rows.set(LEGACY, {
			id: LEGACY,
			name: 'Legacy world',
			solo: true,
			ownerId: LEGACY,
			createdAt: Date.now(),
			maxMembers: 1,
			// no keyRev — exactly how an older build wrote it
		});
		w.db.WorldMember._rows.set(`${LEGACY}:${LEGACY}`, {
			id: `${LEGACY}:${LEGACY}`,
			worldId: LEGACY,
			playerId: LEGACY,
			role: 'owner',
			joinedAt: Date.now(),
		});
		const legacyRows: Record<string, any[]> = {
			Placement: [
				{ id: 'pl_1700000000000_abc123', objectId: 'wildflower', area: 'meadow', x: 5, y: 5, placedAt: Date.now() },
			],
			Chest: [
				{ id: 'pl_1700000000000_abc123', area: 'meadow', x: 5, y: 5, size: 'basket', capacity: 60, contents: {} },
			],
			TerrainTile: [{ id: `${LEGACY}:meadow:7:7`, area: 'meadow', x: 7, y: 7, type: 'tilled', updatedAt: Date.now() }],
			// A pre-KEY_REV-3 feed: one row per line, which the migration collapses.
			FeedEntry: [{ id: `f_${LEGACY}_1700000000000_xyz789`, at: Date.now(), icon: 'leaf', text: 'an older season' }],
		};
		for (const [name, rows] of Object.entries(legacyRows)) {
			for (const row of rows) w.db[name]._rows.set(row.id, { ...row, worldId: LEGACY, playerId: LEGACY });
		}
		return legacyRows;
	}

	it('reads a legacy save correctly BEFORE it migrates', async () => {
		const legacy = await seedLegacySave();
		// This is the failure mode the original full scans existed to prevent: a
		// bounded read alone would miss the unprefixed rows and the world would
		// render empty. An unmigrated world must fall back to the merged read.
		const state = await w.get<any>('GameState', LEGACY);
		expect(state.feed.length).toBe(legacy.FeedEntry.length);
		expect(state.placements.length).toBe(legacy.Placement.length);
		expect(state.terrain.length).toBe(legacy.TerrainTile.length);
	});

	it('re-keys the save on the next write, losing nothing', async () => {
		const legacy = await seedLegacySave();
		const expected = Object.fromEntries(Object.entries(legacy).map(([name, rows]) => [name, rows.length]));

		// The heartbeat is a write path, so it migrates.
		await w.post('Heartbeat', { playerId: LEGACY });

		// A solo world's marker lives on the PLAYER row (see keyMarker) — the point
		// being that it survives the World table going away.
		// Hardcoded rather than imported from the server: bumping the contract
		// should be a deliberate edit here too, so a revision can never land
		// without someone looking at what the migration is expected to produce.
		expect(w.db.Player._rows.get(LEGACY).keyRev).toBe(4);
		// The feed collapses from one row per line into a single row holding an
		// array, so its ROW count is 1 whatever the line count was — the lines
		// themselves are checked below.
		expect([...w.db.FeedEntry._rows.values()].filter((r) => (r.worldId ?? r.playerId) === LEGACY)).toHaveLength(1);
		expect(w.db.FeedEntry._rows.get(`${LEGACY}:feed`).entries).toHaveLength(expected.FeedEntry);
		delete expected.FeedEntry;
		for (const name of Object.keys(expected)) {
			const mine = [...w.db[name]._rows.values()].filter((r) => (r.worldId ?? r.playerId) === LEGACY);
			expect(mine.length, `${name} lost or duplicated rows during migration`).toBe(expected[name]);
			for (const row of mine) {
				expect(String(row.id).startsWith(`${LEGACY}:`), `${name} row "${row.id}" was not re-keyed`).toBe(true);
				// KEY_REV 4: placements and their chests carry the area as the second
				// segment, which is what lets byArea bound a per-biome read to one
				// area's run. A row that migrated to the world prefix but not the area
				// one would read as "this biome has no placements".
				if (name === 'Placement' || name === 'Chest') {
					expect(String(row.id), `${name} row "${row.id}" has no area segment`).toBe(
						`${LEGACY}:${row.area}:pl_1700000000000_abc123`,
					);
				}
			}
		}

		// Chest id must still equal its placement id — they are looked up by the
		// same key everywhere, so a migration that broke the pairing would orphan
		// every chest's contents.
		expect([...w.db.Chest._rows.keys()].filter((id) => String(id).startsWith(`${LEGACY}:`))).toEqual(
			[...w.db.Placement._rows.keys()].filter((id) => String(id).startsWith(`${LEGACY}:`)),
		);

		// And the migrated save still reads the same, now on the bounded path.
		const after = await w.get<any>('GameState', LEGACY);
		expect(after.feed.length).toBe(1); // the one legacy line, carried across
		expect(after.placements.length).toBe(expected.Placement);
		expect(after.terrain.length).toBe(expected.TerrainTile);
	});

	it('a migrated save is read with no unbounded scan', async () => {
		await seedLegacySave();
		await w.post('Heartbeat', { playerId: LEGACY });
		for (const name of WORLD_TABLES) w.db[name]._resetScanStats();
		await w.get('GameState', LEGACY);
		for (const name of WORLD_TABLES) {
			expect(w.db[name]._scanStats().unboundedScans, `${name} still scanned unbounded after migration`).toBe(0);
		}
	});
});

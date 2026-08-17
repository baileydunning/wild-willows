// Read amplification: what ONE action costs, and how that grows with the world.
//
// The key contract (see key-scoping.test.ts) got a per-world read down from "every
// save in the database" to "this world". These tests hold the next step in place:
// a read that only wants one biome should not pay for six, and two passes over the
// same request should not read the same rows twice.
//
// Both of those regress silently. Nothing breaks, no test fails, the game just
// gets more expensive the more of it a player has built — which is exactly the
// shape that does not show up on a fresh save and does show up on a launch day.
// So these assertions are on ROW COUNTS, measured through the harness's scan
// stats, on a world big enough for the difference to be visible.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

let w: World;
let playerId: string;

const AREAS = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];
const TABLES = ['Placement', 'TerrainTile', 'Discovery', 'BiomeState', 'Chest', 'NodeState'];

/** Rows scanned since the last reset, across the world-keyed tables. */
const scanned = (table?: string) =>
	table ? w.db[table]._scanStats().rowsScanned : TABLES.reduce((n, name) => n + w.db[name]._scanStats().rowsScanned, 0);
const resetScans = () => TABLES.forEach((name) => w.db[name]._resetScanStats());

/**
 * Give the world terrain in every area, written straight to the store under the
 * current key shape. Going through Terraform would be slower and would also
 * exercise the very code under test, so the rows are placed directly — the same
 * technique the capacity report uses.
 */
function seedTerrain(perArea: number) {
	for (const area of AREAS) {
		for (let i = 0; i < perArea; i++) {
			const x = 100 + (i % 40);
			const y = 300 + Math.floor(i / 40);
			const id = `${playerId}:${area}:${x}:${y}`;
			w.db.TerrainTile._rows.set(id, {
				id,
				worldId: playerId,
				playerId,
				area,
				x,
				y,
				type: i % 3 === 0 ? 'water' : 'soil',
				updatedAt: 1780000000000,
			});
		}
	}
}

/**
 * Mark wetland-lakemaker already earned.
 *
 * It is the only trigger that asks about terrain, and until it is earned every
 * action pays one wetland read to evaluate it (which is itself the point of the
 * two-pass evaluation, and is covered by its own tests below). Earning it here
 * isolates the reads the ACTION does from the reads the achievement pass does.
 */
function earnLakemaker() {
	const id = `${playerId}:wetland-lakemaker`;
	w.db.PlayerAchievement._rows.set(id, {
		id,
		playerId,
		achievementId: 'wetland-lakemaker',
		biome: 'wetland',
		earnedAt: 1780000000000,
	});
}

beforeEach(async () => {
	w = await freshWorld();
	const created = await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance });
	playerId = created.playerId;
});

describe('per-area reads stay per-area', () => {
	it('a terraform reads its own biome’s tiles, not all six biomes’', async () => {
		seedTerrain(100); // 600 tiles, 100 of them in the meadow
		earnLakemaker();

		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const tiles = scanned('TerrainTile');

		// The action touches the meadow, and reads it twice — once to find the tile
		// under the cursor, once to recalculate the biome. Reading all 600 would mean
		// the cost of a dig in the meadow grows every time the player shapes the coast.
		expect(tiles).toBeGreaterThan(0);
		expect(tiles, `terraform scanned ${tiles} tiles; the meadow only has ~100`).toBeLessThan(300);
	});

	it('the cost of an action in one biome does not grow when ANOTHER biome does', async () => {
		seedTerrain(20);
		earnLakemaker();
		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const small = scanned('TerrainTile');

		// Same world, same meadow, but five other biomes are now heavily shaped.
		w = await freshWorld();
		const again = await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance });
		playerId = again.playerId;
		for (const area of AREAS) {
			const n = area === 'meadow' ? 20 : 400;
			for (let i = 0; i < n; i++) {
				const x = 100 + (i % 40);
				const y = 300 + Math.floor(i / 40);
				const id = `${playerId}:${area}:${x}:${y}`;
				w.db.TerrainTile._rows.set(id, {
					id,
					worldId: playerId,
					playerId,
					area,
					x,
					y,
					type: 'soil',
					updatedAt: 1780000000000,
				});
			}
		}
		earnLakemaker();
		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const large = scanned('TerrainTile');

		// 2,000 extra tiles elsewhere; the meadow dig should not notice at all.
		expect(large, `${small} tiles before, ${large} after adding 2,000 tiles elsewhere`).toBeLessThan(small + 100);
	});
});

describe('one request reads a row once', () => {
	it('a placement does not scan the world’s discoveries twice', async () => {
		// recalcBiome and the achievement pass both want the same world-wide
		// Discovery set. They used to read it independently, microseconds apart.
		for (let i = 0; i < 40; i++) {
			const id = `${playerId}:animal-${i}`;
			w.db.Discovery._rows.set(id, {
				id,
				worldId: playerId,
				playerId,
				animalId: `animal-${i}`,
				biomeId: 'meadow',
				comfort: 'comfortable',
				timesObserved: 1,
				firstObservedAt: 1780000000000,
				whyReturned: 'x',
			});
		}
		const total = w.db.Discovery._rows.size;

		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 6, y: 6, action: 'dig' });
		const rows = scanned('Discovery');

		expect(rows).toBeGreaterThan(0);
		expect(rows, `read ${rows} discovery rows for a world that has ${total}`).toBeLessThanOrEqual(total);
	});

	it('a heartbeat with nothing to recalculate reads no discoveries at all', async () => {
		// The heartbeat fires every 30s for every player. The sweep's Discovery read
		// belongs inside the `toRecalc` branch, not above it.
		await w.post('Heartbeat', { playerId });
		resetScans();
		await w.post('Heartbeat', { playerId });
		expect(scanned('Discovery')).toBe(0);
	});
});

describe('the water achievement still works, through the two-pass evaluation', () => {
	// wetland-lakemaker is the only trigger that asks about terrain, so terrain is
	// now read lazily and only for the biomes a trigger actually asks about. The
	// risk that buys is a false negative — the achievement quietly never firing.
	const lake = (n: number) => {
		for (let i = 0; i < n; i++) {
			const id = `${playerId}:wetland:${10 + i}:10`;
			w.db.TerrainTile._rows.set(id, {
				id,
				worldId: playerId,
				playerId,
				area: 'wetland',
				x: 10 + i,
				y: 10,
				type: 'water',
				updatedAt: 1780000000000,
			});
		}
	};

	it('does not award Lakemaker for a wetland with no player-shaped water', async () => {
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const state = await w.get<any>('GameState', playerId);
		expect(state.achievements).not.toContain('wetland-lakemaker');
	});

	it('awards Lakemaker once the wetland has a lake', async () => {
		lake(9); // a connected body, comfortably over the threshold
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const state = await w.get<any>('GameState', playerId);
		expect(state.achievements).toContain('wetland-lakemaker');
	});

	it('reads terrain only for the biome the trigger asked about', async () => {
		seedTerrain(100); // 600 tiles across six biomes
		lake(9);
		resetScans();
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: 'seeds' });
		const tiles = scanned('TerrainTile');
		// Gathering touches no terrain of its own; every tile read here is the
		// achievement pass answering one question about the wetland.
		expect(tiles, `read ${tiles} tiles to evaluate a wetland-only trigger`).toBeLessThan(300);
	});

	it('stops reading terrain entirely once the achievement is earned', async () => {
		seedTerrain(100);
		lake(9);
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: 'seeds' });
		const earned = await w.get<any>('GameState', playerId);
		expect(earned.achievements).toContain('wetland-lakemaker');

		resetScans();
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n2', resourceId: 'seeds' });
		expect(scanned('TerrainTile'), 'terrain is still being read for an achievement already earned').toBe(0);
	});
});

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
 * Give the world placements in every area, under the current key shape.
 *
 * `wildflower` has no growSeconds and no matureHours, so every row counts the
 * same however long the test takes — the assertions here are about how many rows
 * were READ, and a placement whose contribution drifts with wall-clock time would
 * make them about something else.
 */
function seedPlacements(perArea: number) {
	for (const area of AREAS) {
		for (let i = 0; i < perArea; i++) {
			const id = `${playerId}:${area}:pl_seed_${i}`;
			w.db.Placement._rows.set(id, {
				id,
				worldId: playerId,
				playerId,
				objectId: 'wildflower',
				area,
				x: 100 + (i % 40),
				y: 300 + Math.floor(i / 40),
				placedAt: 1780000000000,
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

	it('a terraform reads its own biome’s placements, not all six biomes’', async () => {
		// KEY_REV 4 put the area in a placement's key for exactly this. Every
		// per-biome reader of Placement — this collision check, recalcBiome,
		// recipeUnlockContext — was reading the world and discarding five sixths.
		seedPlacements(60); // 360 objects, 60 of them in the meadow
		earnLakemaker();
		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const rows = scanned('Placement');

		expect(rows).toBeGreaterThan(0);
		expect(rows, `terraform scanned ${rows} placements; the meadow only has ~60`).toBeLessThan(180);
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

describe('one request reads the world’s biome states once', () => {
	// BiomeState is six rows per world and never grows — and it was half of every
	// row read in a heavy minute of play, because one Terraform asked for the same
	// six rows three times over: recalcBiome's prior state, checkUnlocks' unlock
	// set, and the achievement sweep's health/returned set. Nothing between those
	// reads changed the data.
	//
	// This is the constant-factor half of read amplification. It does not get worse
	// as a save grows, which is exactly why it survived so long: it never showed up
	// as a save that got slower the more of it you built.
	it('a terraform scans BiomeState once, not once per pass', async () => {
		earnLakemaker();
		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		const { rowsScanned, scans } = w.db.BiomeState._scanStats();

		expect(scans, `scanned BiomeState ${scans} times for one action`).toBeLessThanOrEqual(1);
		// Six biomes; a second pass over them would read twelve.
		expect(rowsScanned).toBeLessThanOrEqual(6);
	});

	it('a gather reads the player row once, not once per pass', async () => {
		// requirePlayer on the way in, the achievement sweep, and bumpMetrics
		// merging onto the freshest copy were three reads of a row that cannot
		// change between them: inside the lock patchPlayer BUFFERS, so the stored
		// row is fixed for the whole action.
		w.db.Player._resetScanStats();
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: 'seeds' });

		const reads = w.db.Player._pointReads();
		expect(reads).toBeGreaterThan(0);
		expect(reads, `read the player row ${reads} times for one gather`).toBeLessThanOrEqual(1);
		expect(w.db.Player._scanStats().scans, 'the player row should never be found by scanning').toBe(0);
	});
});

describe('the snapshot reads the area the player is standing in', () => {
	/**
	 * Node states across every area, under the current key shape
	 * (`${wid}:${biomeId}:${nodeId}`). These rows are never deleted, so this table
	 * gains one for every gathering spot a save has ever touched — which is what
	 * made a state refresh cost more the longer someone had played.
	 */
	function seedNodes(perArea: number) {
		for (const area of AREAS) {
			for (let i = 0; i < perArea; i++) {
				const id = `${playerId}:${area}:seed${i}`;
				w.db.NodeState._rows.set(id, { id, worldId: playerId, playerId, harvestedAt: 1780000000000 });
			}
		}
	}

	it('reads one area’s nodes, not all six', async () => {
		seedNodes(50); // 300 rows, 50 of them in the meadow
		resetScans();
		await w.get<any>('GameState', playerId);
		const rows = scanned('NodeState');

		expect(rows).toBeGreaterThan(0);
		expect(rows, `snapshot scanned ${rows} node states; the meadow only has ~50`).toBeLessThan(150);
	});

	it('still tells the client which spots are regrowing where it is standing', async () => {
		// The cost saving is worthless if the client stops knowing a node is on
		// cooldown — it would draw the spot as ready and the server would refuse the
		// gather. So: gather one, then read it back out of the snapshot.
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: 'seeds' });
		const state = await w.get<any>('GameState', playerId);
		expect(state.nodeStates.map((n: any) => n.id)).toContain(`${playerId}:meadow:n1`);
	});

	it('follows the player to another area', async () => {
		seedNodes(3);
		const p = await w.db.Player.get(playerId);
		await w.db.Player.patch(playerId, { unlockedBiomes: [...(p.unlockedBiomes || []), 'forest'] });
		await w.post('SyncPlayer', { playerId, x: 5, y: 5, area: 'forest' });
		const state = await w.get<any>('GameState', playerId);

		// changeArea in src/state.tsx syncs the area and then adopts a fresh
		// snapshot, so this is the sequence the real client makes on every crossing.
		expect(state.nodeStates.length).toBeGreaterThan(0);
		expect(
			state.nodeStates.every((n: any) => String(n.id).startsWith(`${playerId}:forest:`)),
			'the snapshot carried another area’s nodes',
		).toBe(true);
	});
});

describe('a cached read never outlives the write that invalidates it', () => {
	// The whole risk of reading once per request rather than once per caller. A
	// stale row here is not a slow game, it is a wrong one — the same failure
	// recalcBiome's `addPlacements` fold-in exists to prevent, with nothing to see
	// in a profile. scan-cache.test.ts pins the mechanism; these two hold the
	// wiring, which is the part that can silently come loose.

	it('re-reads a table this request has written', async () => {
		// Placing an object reads the area's placements (is this spot taken? is this
		// a one-per-area structure?), writes the new placement, and then
		// recalculates the biome from that area's placements. The second read is not
		// waste — it is the one that must not answer from before the write. If
		// invalidation ever stopped being wired through db(), this number would
		// quietly drop to one and nothing else would look wrong: recalcBiome folds
		// the new row in by hand, so the game would stay correct right up until the
		// first caller that doesn't.
		seedPlacements(5);
		earnLakemaker();
		const p = await w.db.Player.get(playerId);
		await w.db.Player.patch(playerId, { inventory: { ...(p.inventory || {}), seeds: 20, fiber: 20 } });
		await w.post('CraftItem', { playerId, recipeId: 'grass-patch' });

		resetScans();
		await w.post('PlaceObject', { playerId, objectId: 'grass-patch', area: 'meadow', x: 6, y: 6 });
		expect(w.db.Placement._scanStats().scans).toBeGreaterThanOrEqual(2);
	});

	it('does not carry one action’s rows into the next', async () => {
		earnLakemaker();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 5, y: 5, action: 'dig' });

		// A scope that leaked past its request would serve the previous action's
		// rows here and read nothing at all.
		//
		// The probe is the area's PLACEMENTS — the collision check that asks whether
		// anything already stands on the square. Terrain used to serve here and no
		// longer can: a dig that neither widens a brush nor shapes open water reads
		// the tile under the cursor by id and takes the rest of its terrain numbers
		// off the biome row, so a correctly scoped second dig reads no tiles at all.
		// That is the change, not a leak — and the tiles both digs left behind are
		// still checked below.
		expect(w.db.Placement._scanStats().scans).toBeGreaterThan(0);
		const state = await w.get<any>('GameState', playerId);
		expect(state.terrain.filter((t: any) => t.area === 'meadow')).toHaveLength(2);
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

describe('an area’s terrain numbers live on its biome row', () => {
	// What the recalc wants from an area's tiles is four numbers — watered beds,
	// player-shaped open water, and the two water shapes — and it used to re-derive
	// them by reading every tile in the area, on every place, plant, dig and beat.
	// They are kept on the biome row now. The saving is real and so is the risk:
	// a stale count is not a slow game, it is a wrong one, so both halves are held
	// here — the reads that stopped happening, and the numbers still being right.

	/** Recount an area's tiles straight from the store. */
	const recount = (area: string) => {
		const tiles = [...w.db.TerrainTile._rows.values()].filter((t: any) => t.area === area);
		return {
			watered: tiles.filter((t: any) => t.type === 'watered').length,
			openWater: tiles.filter((t: any) => t.type === 'water' && !t.seeded).length,
		};
	};
	const counts = async (area: string) => (await w.db.BiomeState.get(`${playerId}:${area}`))?.terrainCounts;

	it('a second dig reads no tiles at all', async () => {
		seedTerrain(100);
		earnLakemaker();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });

		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 5, y: 5, action: 'dig' });

		expect(
			scanned('TerrainTile'),
			`a dig scanned ${scanned('TerrainTile')} tiles to shape one square of bare ground`,
		).toBe(0);
	});

	it('still reads the area when the change shapes open water', async () => {
		// lake and river are connectivity across the whole area, not tallies — one
		// tile can join two ponds — so flooding a bed has to look at the rows.
		seedTerrain(100);
		earnLakemaker();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'water' });

		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'water' }); // watered -> water
		expect(scanned('TerrainTile')).toBeGreaterThan(0);
		// the new tile joins the water the seeding scattered here
		expect((await counts('meadow'))?.openWater).toBe(recount('meadow').openWater);
	});

	it('the stored numbers still match the rows after a run of actions', async () => {
		// The check a fingerprint cannot make: a count that has gone stale is still
		// a number, and everything downstream of it stays self-consistent while
		// being wrong about the land.
		earnLakemaker();
		const p = await w.db.Player.get(playerId);
		await w.db.Player.patch(playerId, {
			inventory: { ...p.inventory, water: 50, seeds: 50 },
			tools: { ...p.tools, shovel: 1, 'watering-can': 1 },
		});
		for (let x = 4; x <= 9; x++) await w.post('Terraform', { playerId, area: 'meadow', x, y: 4, action: 'dig' });
		for (let x = 4; x <= 8; x++) await w.post('Terraform', { playerId, area: 'meadow', x, y: 4, action: 'water' });
		// two of the beds flood into open water, one is planted into, one is cleared
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'water' });
		await w.post('Terraform', { playerId, area: 'meadow', x: 5, y: 4, action: 'water' });
		await w.post('Plant', { playerId, area: 'meadow', x: 6, y: 4, plantId: 'wildflower-patch' });
		await w.post('Terraform', { playerId, area: 'meadow', x: 7, y: 4, action: 'clear' });

		const stored = await counts('meadow');
		expect({ watered: stored?.watered, openWater: stored?.openWater }).toEqual(recount('meadow'));
		// …and the water shape the row carries is the one the tiles describe: two
		// connected open tiles.
		expect(stored?.water).toEqual({ tiles: 2, lake: 2, river: 2 });
	});

	it('a row with nothing stored is recounted rather than read as an empty biome', async () => {
		// Every save from before the field, and every row an admin tool or a repair
		// pass reset. Absent and zero are different answers.
		seedTerrain(100);
		earnLakemaker();
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'water' });
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'water' }); // open water
		const row = await w.db.BiomeState.get(`${playerId}:meadow`);
		await w.db.BiomeState.put({ ...row, terrainCounts: undefined, playerWater: undefined });

		resetScans();
		await w.post('Terraform', { playerId, area: 'meadow', x: 6, y: 6, action: 'dig' });

		expect(scanned('TerrainTile'), 'a biome row with no stored counts must be recounted').toBeGreaterThan(0);
		expect((await counts('meadow'))?.openWater).toBe(recount('meadow').openWater);
	});
});

describe('a snapshot carries the area on screen, not the world', () => {
	// The last of the per-area reads, and the one that had to go last: the goal
	// board, the recipe gates, the tutorial's flags and the completion tracker all
	// read this list across areas until they were moved onto stored counts. Doing
	// this before that would not have errored — they would have quietly counted
	// the meadow and called it the preserve.

	it('sends one area’s placements, plus the home interior', async () => {
		seedPlacements(60); // 360 objects, 60 of them in the meadow
		await w.post('Heartbeat', { playerId }); // fills in the standing tallies
		w.db.Placement._rows.set(`${playerId}:home:pl_chair`, {
			id: `${playerId}:home:pl_chair`,
			worldId: playerId,
			playerId,
			objectId: 'wildflower',
			area: 'home',
			x: 3,
			y: 3,
			placedAt: 1780000000000,
		});

		const state = await w.get<any>('GameState', playerId);
		const areas = new Set(state.placements.map((p: any) => p.area));
		expect([...areas].sort(), 'the payload should be this area and the house').toEqual(['home', 'meadow']);
		// The house rides along because the Your Home card counts what is in it from
		// anywhere; every other area's is left where it is.
		expect(state.placements.some((p: any) => p.area === 'home')).toBe(true);
	});

	it('costs one area’s rows to build', async () => {
		seedPlacements(60);
		await w.post('Heartbeat', { playerId });
		resetScans();
		await w.get<any>('GameState', playerId);
		const rows = scanned('Placement');
		expect(rows).toBeGreaterThan(0);
		expect(rows, `snapshot scanned ${rows} placements; the meadow only has ~60`).toBeLessThan(180);
	});

	it('sends the whole world to a save whose tallies have not been written', async () => {
		// Absent is not zero. Until `standing` exists, the goal board is still
		// counting rows, so narrowing the list would make it count low — which reads
		// as goals lagging rather than as a bug in a read path.
		seedPlacements(20);
		const { standing: _gone, ...noTallies } = await w.db.Player.get(playerId);
		await w.db.Player.put(noTallies);

		const state = await w.get<any>('GameState', playerId);
		const areas = new Set(state.placements.map((p: any) => p.area));
		expect(areas.size, 'a save without tallies must still see every area').toBeGreaterThan(1);
	});
});

describe('a save born knowing nothing is growing yet', () => {
	// The heartbeat skips its world-wide placement scan while the soonest maturity
	// moment is still ahead of it, and `nextMaturityAt` on the player row is that
	// moment. A save with no marker has to scan to learn there is nothing to find —
	// which used to be every new save's first beat, on a timer, forever after.

	it('reads no placements on its first beat', async () => {
		seedPlacements(60); // nothing here grows: `wildflower` has no matureHours
		resetScans();
		await w.post('Heartbeat', { playerId });
		expect(scanned('Placement'), 'a fresh save scanned the world to find out nothing was growing').toBe(0);
	});

	it('still scans for a save that has no marker, and leaves one behind', async () => {
		// Absent is not zero, here as everywhere: absent means nobody has looked.
		seedPlacements(20);
		const { nextMaturityAt: _unknown, ...older } = await w.db.Player.get(playerId);
		await w.db.Player.put(older);

		resetScans();
		await w.post('Heartbeat', { playerId });
		expect(scanned('Placement')).toBeGreaterThan(0);
		expect((await w.db.Player.get(playerId)).nextMaturityAt, 'the beat that looked should record what it saw').toBe(0);

		// …and the next beat is free.
		resetScans();
		await w.post('Heartbeat', { playerId });
		expect(scanned('Placement')).toBe(0);
	});
});

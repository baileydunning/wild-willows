// Equivalence + cost harness for the read paths.
//
//   node scripts/read-bench.mjs            (needs: npm run build:server)
//
// Prints a FINGERPRINT of the final game state, the rows read per endpoint, and
// wall-clock per action. Run it before and after a read change:
//
//   • fingerprint identical  -> the change cannot have altered what a player sees
//   • rows read lower        -> it did what it claimed
//
// Only that pairing lets a read optimization ship. A profile alone cannot tell a
// correct cache from a stale one, and the tests cannot either — every call site
// that writes-then-reads also hands the written rows down by hand.
//
// WHY THE FAKE TABLES CARRY NO `name`
//
// Because the shipping one doesn't. LocalTable in src/solo/localDb.ts is built as
// `db[name] = new LocalTable(name)`, and before that constructor argument existed
// an instance had no name at all — which made tableName() answer '', collapsed
// every scan-cache key onto `|world`, served one table's rows for another's, and
// turned every per-world read into an unbounded scan. It shipped, because Harper
// tables are classes with a real `.name` and every fake table in tests/ and in
// write-profile.mjs is an object literal with a `name` property. The one runtime
// that was neither was the one players run. This harness models THAT one.
//
// Deterministic on purpose: Date.now and Math.random are pinned, so two runs
// differ only by the code under test. Volatile timestamps are dropped from the
// fingerprint for the same reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.WW_ROOT || join(here, '..');
const defsRoot = process.env.WW_DATA || join(here, '..');
const out = process.env.WW_OUT;
const load = (p) => JSON.parse(readFileSync(join(defsRoot, p), 'utf8')).records;

const stats = { rows: 0, byTable: {}, byEp: {} };
globalThis.__EP = 'setup';
const bump = (t, n) => {
	stats.rows += n;
	stats.byTable[t] = (stats.byTable[t] || 0) + n;
	const e = (stats.byEp[globalThis.__EP] ||= { total: 0 });
	e.total += n;
	e[t] = (e[t] || 0) + n;
};

function makeTable(tname) {
	const rows = new Map();
	return {
		// NO `name` property on purpose — mirrors LocalTable in src/solo/localDb.ts,
		// the backend that ships and the one no harness in the repo models.
		async get(id) {
			const r = rows.get(String(id));
			if (r) bump(tname, 1);
			return r ? structuredClone(r) : undefined;
		},
		async put(row) {
			rows.set(String(row.id), structuredClone(row));
		},
		async patch(id, partial) {
			rows.set(String(id), { ...(rows.get(String(id)) || { id }), ...structuredClone(partial) });
		},
		async delete(id) {
			rows.delete(String(id));
		},
		search(query) {
			const c = query?.conditions?.find?.((x) => x.attribute === 'id' && x.comparator === 'starts_with');
			const prefix = c ? String(c.value) : null;
			const keys = prefix === null ? [...rows.keys()] : [...rows.keys()].filter((k) => k.startsWith(prefix));
			const snap = keys.map((k) => rows.get(k));
			bump(tname, snap.length);
			return (async function* () {
				for (const r of snap) yield structuredClone(r);
			})();
		},
		primaryStore: { getSync: (id) => rows.get(String(id)) },
		_rows: rows,
	};
}

const STATIC = ['Biome', 'Animal', 'ResourceType', 'Recipe', 'HabitatObject', 'ToolDef', 'Achievement'];
const DYNAMIC = [
	'Player',
	'PlayerAchievement',
	'BiomeState',
	'Chest',
	'Placement',
	'Discovery',
	'NodeState',
	'TerrainTile',
	'FeedEntry',
	'SoloMetrics',
];
const TABLE_NAMES = [
	...STATIC,
	...DYNAMIC,
	'Feedback',
	'AppOpen',
	'LandingStat',
	'PlayerNameIndex',
	'SaveIncident',
	'Refusal',
	'ClientError',
];

function freshDb() {
	const db = {};
	for (const n of TABLE_NAMES) db[n] = makeTable(n);
	const seed = (t, recs) => recs.forEach((r) => db[t]._rows.set(String(r.id), structuredClone(r)));
	seed('Biome', load('data/biomes.json'));
	seed('Animal', [...load('data/animals-1.json'), ...load('data/animals-2.json')]);
	seed('ResourceType', load('data/resources.json'));
	seed('Recipe', load('data/recipes.json'));
	seed('HabitatObject', load('data/habitat-objects.json'));
	seed('ToolDef', load('data/tools.json'));
	seed('Achievement', load('data/achievements.json'));
	return db;
}

const holder = { db: freshDb() };
globalThis.Resource = class {
	constructor(id) {
		this._id = id;
	}
	getId() {
		return this._id;
	}
	getContext() {
		return null;
	}
};
globalThis.databases = {
	get wildwillows() {
		return holder.db;
	},
};
const mod = await import(join(root, 'resources.js'));
const post = (cls, body) => new mod[cls]().post(body);
const appearance = { skin: 'light', hair: 'brown', hairStyle: 'short', build: 'average', outfit: 'green', hat: 'none' };

const T0 = 1750000000000;
let clock = T0;
Date.now = () => clock;
let seed = 42;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const PID = 'bench-save';
const AREAS = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];
const OBJ = [
	'grass-patch',
	'clover-patch',
	'vole-runway-network',
	'milkweed-rhizome-bed',
	'pollinator-garden',
	'berry-bush',
];

const p0 = (await post('CreatePlayer', { name: 'Bench', passcode: 'pw1234', appearance })).playerId;
const swap = (v) => (typeof v === 'string' ? v.split(p0).join(PID) : v);
for (const tbl of DYNAMIC.concat(['PlayerNameIndex'])) {
	const rows = [...holder.db[tbl]._rows.values()];
	holder.db[tbl]._rows.clear();
	for (const r of rows) {
		const o = {};
		for (const kk of Object.keys(r)) o[kk] = swap(r[kk]);
		holder.db[tbl]._rows.set(o.id, o);
	}
}
{
	const pr = holder.db.Player._rows.get(PID);
	holder.db.Player._rows.set(PID, {
		...pr,
		area: 'meadow',
		unlockedBiomes: AREAS.slice(),
		tools: { ...(pr.tools || {}), shovel: 3, 'watering-can': 3, basket: 3 },
		inventory: { ...(pr.inventory || {}), water: 4000, 'clean-water': 4000 },
		craftedItems: Object.fromEntries(OBJ.map((o) => [o, 200])),
	});
}

const AGED = T0 - 9e8;
let kk2 = 0;
for (const area of AREAS) {
	for (let i = 0; i < 120; i++) {
		const id = `${PID}:${area}:pl_seed_${kk2}`;
		holder.db.Placement._rows.set(id, {
			id,
			worldId: PID,
			playerId: PID,
			objectId: OBJ[i % OBJ.length],
			area,
			x: 3 + (i % 24),
			y: 14 + Math.floor(i / 24),
			placedAt: AGED,
		});
		kk2++;
	}
	for (let i = 0; i < 200; i++) {
		const x = 3 + (i % 24),
			y = 22 + Math.floor(i / 24);
		const id = `${PID}:${area}:${x}:${y}`;
		holder.db.TerrainTile._rows.set(id, {
			id,
			worldId: PID,
			playerId: PID,
			area,
			x,
			y,
			type: 'tilled',
			updatedAt: AGED,
		});
	}
}

stats.rows = 0;
stats.byTable = {};
const timings = [];
async function act(label, fn) {
	clock += 1500;
	globalThis.__EP = label;
	const t = process.hrtime.bigint();
	await fn().catch((e) => ({ err: e.message }));
	timings.push([label, Number(process.hrtime.bigint() - t) / 1e6]);
}

let placed = 0,
	dug = 0;
for (let round = 0; round < 6; round++) {
	const area = AREAS[round % AREAS.length];
	await act('Heartbeat', () => post('Heartbeat', { playerId: PID }));
	await act('GameState', () => new mod.GameState(PID).get());
	for (let i = 0; i < 3; i++)
		await act('Terraform', () => post('Terraform', { playerId: PID, area, x: 4 + (dug++ % 20), y: 2, action: 'dig' }));
	for (let i = 0; i < 2; i++)
		await act('PlaceObject', () =>
			post('PlaceObject', { playerId: PID, area, objectId: OBJ[placed % OBJ.length], x: 4 + (placed++ % 20), y: 6 }),
		);
	for (let i = 0; i < 4; i++)
		await act('CollectResource', () =>
			post('CollectResource', { playerId: PID, biomeId: area, nodeId: `${area}-node-1`, resourceId: 'wildflowers' }),
		);
}

// Shape a pond in the wetland, because one achievement reads terrain geometry.
//
// `wetland-lakemaker` fires on a connected body of six or more PLAYER-shaped
// water tiles, and it is the only trigger that makes the achievement sweep look
// at terrain at all. Without water in the session that trigger is never decided,
// the second pass never runs, and any change to how water is read would look free
// and correct while quietly breaking the one thing it touches. Nine tiles, dug
// then watered twice each, so the threshold is crossed rather than grazed.
{
	const POND = [];
	for (let x = 10; x <= 12; x++) for (let y = 11; y <= 13; y++) POND.push([x, y]);
	for (const [x, y] of POND)
		await act('Terraform', () => post('Terraform', { playerId: PID, area: 'wetland', x, y, action: 'dig' }));
	// tilled -> watered -> open water
	for (const pass of [0, 1])
		for (const [x, y] of POND)
			await act('Terraform', () => post('Terraform', { playerId: PID, area: 'wetland', x, y, action: 'water' }));
}

// Dropped from the fingerprint because they move with something other than the
// code under test. The timestamps track the wall clock; the passcode salt is
// crypto-random by design (node:crypto, correctly NOT Math.random), so it is the
// one field that would make an otherwise byte-identical run look like a
// regression. Everything else — every placement, tile, discovery, biome health,
// achievement row, inventory and goal counter — is compared exactly.
// A phase that exercises the thing the reads are FOR.
//
// The loop above measures cost well and proves almost nothing about correctness:
// its world is already built, so the same animals come home whether or not the
// reads underneath were right. The scan-cache key collision that shipped in 0.3.11
// left this section's fingerprint untouched while the game was visibly broken.
//
// So: build one animal's habitat from nothing and let the recalcs run. Whether a
// creature comes home is downstream of every read in recalcBiome — the area's
// placements, its terrain, the world's discoveries, the biome row — so a wrong
// answer anywhere lands here as a missing animal rather than as a silent number.
{
	const NEEDS = ['bumblebee-nest-tussock', 'native-thistle-stand'];
	const pr = holder.db.Player._rows.get(PID);
	const ci = { ...(pr.craftedItems || {}) };
	for (const o of NEEDS) ci[o] = (ci[o] || 0) + 5;
	holder.db.Player._rows.set(PID, { ...pr, craftedItems: ci });
	let hx = 2;
	for (const objectId of NEEDS)
		await act('PlaceObject', () => post('PlaceObject', { playerId: PID, area: 'meadow', objectId, x: hx++, y: 9 }));
	for (let i = 0; i < 8; i++)
		await act('Terraform', () =>
			post('Terraform', { playerId: PID, area: 'meadow', x: 4 + (dug++ % 20), y: 3, action: 'dig' }),
		);
}

const VOLATILE = new Set([
	'updatedAt',
	'lastSeen',
	'lastSeenAt',
	'firstObservedAt',
	'placedAt',
	'plantedAt',
	'at',
	'createdAt',
	'lastPlayedAt',
	'weatherTime',
	'playMs',
	'lastTickAt',
	'seenAt',
	'earnedAt',
	'passcodeHash',
	'passcodeSalt',
	// Derived state, not player-visible: BiomeState.playerWater is a cached copy of
	// analyzeWater(terrain, true). Comparing it across a change that INTRODUCES it
	// would just report "new field". Its correctness is observed where it actually
	// matters — wetland-lakemaker in PlayerAchievement, which the pond phase above
	// exists to earn, and which IS compared.
	'playerWater',
	// Same: new derived bookkeeping, checked explicitly below rather than diffed.
	'nextMaturityAt',
	// And the same again: BiomeState.terrainCounts is a cached copy of what the
	// recalc used to re-derive from the area's tiles on every action. Comparing it
	// across the change that introduces it would only report "new field"; what it
	// is FOR is compared — biome health carries the watered beds and the open
	// water, the animals carry the water shapes, and the check below re-derives it
	// from the raw rows and refuses any row where the two disagree.
	'terrainCounts',
]);
const canon = (v) => {
	if (Array.isArray(v)) return v.map(canon);
	if (v && typeof v === 'object') {
		const o = {};
		for (const key of Object.keys(v).sort()) {
			if (VOLATILE.has(key)) continue;
			o[key] = canon(v[key]);
		}
		return o;
	}
	return v;
};
// Growth gating: the heartbeat may skip its world-wide placement scan only while
// nothing is due to mature. Nothing else in this session grows — every seeded
// placement is back-dated past every threshold — so without this the gate would
// measure as a pure win and never be asked the one question it can get wrong:
// does a plant finishing still wake the sweep?
const growth = { armed: 0, quiet: 0, woke: 0 };
{
	const rows = () => stats.byTable.Placement || 0;
	// A grass-patch matures in 2h. Planting one is what arms the gate.
	await act('PlaceObject', () =>
		post('PlaceObject', { playerId: PID, area: 'meadow', objectId: 'grass-patch', x: 19, y: 9 }),
	);
	growth.armed = holder.db.Player._rows.get(PID)?.nextMaturityAt ?? -1;
	// Bring the threshold to just ahead of now, keeping the gate's own bookkeeping
	// honest. A grass-patch takes two hours, and jumping the clock that far makes
	// the beat "long away" — which recalculates every biome unconditionally and so
	// would pass this test without ever consulting `crossed`. That is the path the
	// gate CANNOT break. The one it can is a plant finishing mid-session, so move
	// the plant instead of the clock.
	{
		const pl = [...holder.db.Placement._rows.values()].find((x) => x.x === 19 && x.y === 9 && x.area === 'meadow');
		const matureAt = clock + 60_000;
		holder.db.Placement._rows.set(pl.id, { ...pl, placedAt: matureAt - 2 * 60 * 60 * 1000 });
		const pr = holder.db.Player._rows.get(PID);
		holder.db.Player._rows.set(PID, { ...pr, nextMaturityAt: matureAt });
		growth.armed = matureAt;
	}
	// Nothing is due yet: this beat should not read a single placement.
	let before = rows();
	await act('Heartbeat', () => post('Heartbeat', { playerId: PID }));
	growth.quiet = rows() - before;
	// Two minutes on — past the plant, well inside the ten-minute away threshold,
	// so this is the mid-session path. It MUST look, or the plant never counts.
	clock += 120_000;
	before = rows();
	await act('Heartbeat', () => post('Heartbeat', { playerId: PID }));
	growth.woke = rows() - before;
}

// A plant that is still growing in is not habitat yet — and a count kept on a
// row has to know that on its own.
//
// placementCounts() refuses a seedling until its `growSeconds` have passed, so
// the number an animal's requirements are tested against moves with nothing but
// the passage of time. Nothing else in this session exercises that: every seeded
// placement is back-dated past every threshold, so a count frozen at the moment
// it was computed would look right all the way through the run above.
//
// The garden spider is that question in a form the fingerprint can see. It needs
// web anchor stems AND a wildflower patch, plus the grasshopper and the ladybug,
// which are both already home by now. So: set the stems down, plant the flowers,
// and act once while the seedling is still a sprout — the spider must NOT be
// home. Then cross the 45-second threshold and act again — it must be. Counted
// too eagerly it arrives early; counted once and cached it never arrives at all.
const sprout = { early: '', grown: '' };
{
	const pr = holder.db.Player._rows.get(PID);
	holder.db.Player._rows.set(PID, {
		...pr,
		craftedItems: { ...(pr.craftedItems || {}), 'orb-web-anchor-stems': 2 },
		inventory: { ...(pr.inventory || {}), seeds: (pr.inventory?.seeds || 0) + 20 },
	});
	const home = () => [...holder.db.Discovery._rows.values()].some((x) => x.animalId === 'garden-spider');
	await act('PlaceObject', () =>
		post('PlaceObject', { playerId: PID, area: 'meadow', objectId: 'orb-web-anchor-stems', x: 6, y: 9 }),
	);
	await act('Terraform', () => post('Terraform', { playerId: PID, area: 'meadow', x: 7, y: 9, action: 'dig' }));
	await act('Terraform', () => post('Terraform', { playerId: PID, area: 'meadow', x: 7, y: 9, action: 'water' }));
	await act('Plant', () => post('Plant', { playerId: PID, area: 'meadow', x: 7, y: 9, plantId: 'wildflower-patch' }));
	// an action that recalculates the meadow while the seedling is still a sprout
	await act('Terraform', () => post('Terraform', { playerId: PID, area: 'meadow', x: 8, y: 9, action: 'dig' }));
	sprout.early = home() ? 'HOME ALREADY' : 'not yet';
	clock += 60_000; // past wildflower-patch's 45s grow threshold
	await act('Terraform', () => post('Terraform', { playerId: PID, area: 'meadow', x: 9, y: 9, action: 'dig' }));
	sprout.grown = home() ? 'home' : 'MISSING';
}

// The stored terrain numbers, re-derived here from the rows they summarize.
//
// This is the check the fingerprint cannot make. A number kept on the biome row
// is still a number once it has gone stale, and everything downstream of it —
// health, an animal's water requirement, the Lakemaker trigger — stays perfectly
// self-consistent while being wrong about the land. So take each area's tiles as
// they finally stand, count them again here, and refuse any row that disagrees.
const drift = [];
{
	// analyzeWater, rewritten rather than imported: a summary that agrees with the
	// code that produced it has proved nothing.
	const shape = (rows) => {
		const cells = new Set(rows.map((tt) => `${tt.x},${tt.y}`));
		const seen = new Set();
		let lake = 0,
			river = 0;
		for (const key of cells) {
			if (seen.has(key)) continue;
			const stack = [key];
			seen.add(key);
			let size = 0,
				minx = Infinity,
				maxx = -Infinity,
				miny = Infinity,
				maxy = -Infinity;
			while (stack.length) {
				const [x, y] = stack.pop().split(',').map(Number);
				size++;
				minx = Math.min(minx, x);
				maxx = Math.max(maxx, x);
				miny = Math.min(miny, y);
				maxy = Math.max(maxy, y);
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1],
				]) {
					const nk = `${x + dx},${y + dy}`;
					if (cells.has(nk) && !seen.has(nk)) {
						seen.add(nk);
						stack.push(nk);
					}
				}
			}
			lake = Math.max(lake, size);
			river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
		}
		return { tiles: cells.size, lake, river };
	};
	for (const b of holder.db.BiomeState._rows.values()) {
		const tiles = [...holder.db.TerrainTile._rows.values()].filter((tt) => tt.area === b.biomeId);
		const c = b.terrainCounts;
		if (!c) {
			drift.push(`${b.biomeId}: nothing stored for ${tiles.length} tile(s)`);
			continue;
		}
		const want = {
			watered: tiles.filter((tt) => tt.type === 'watered').length,
			openWater: tiles.filter((tt) => tt.type === 'water' && !tt.seeded).length,
			water: shape(tiles.filter((tt) => tt.type === 'water')),
			playerWater: shape(tiles.filter((tt) => tt.type === 'water' && !tt.seeded)),
		};
		const got = { watered: c.watered, openWater: c.openWater, water: c.water, playerWater: b.playerWater };
		if (JSON.stringify(want) !== JSON.stringify(got))
			drift.push(`${b.biomeId}: row ${JSON.stringify(got)} vs tiles ${JSON.stringify(want)}`);
	}
}

// The goal board is COMPUTED per snapshot, not stored, so no table row carries
// it and the fingerprint above would miss a change that only moved a goal's
// progress. That is exactly the failure mode of scoping a read the goal board
// depends on, so fold the final board into the comparison: every task's id,
// target and progress, for the board the player would actually be looking at.
const finalBoard = await new mod.GameState(PID).get();
const goals = (finalBoard?.dailyTasks?.tasks || []).map((x) => ({
	id: x.id,
	target: x.target,
	progress: x.progress,
	claimed: !!x.claimed,
}));

const state = {};
for (const tbl of DYNAMIC)
	state[tbl] = [...holder.db[tbl]._rows.values()].map(canon).sort((a, b) => String(a.id).localeCompare(String(b.id)));
const json = JSON.stringify({ tables: state, goals }, null, 1);
const fp = createHash('sha256').update(json).digest('hex').slice(0, 16);

const byLabel = {};
for (const [l, ms] of timings) (byLabel[l] ||= []).push(ms);
const worst = (a) => Math.max(...a).toFixed(1);
const mean = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);

console.log(`fingerprint   ${fp}`);
console.log(`rows read     ${stats.rows.toLocaleString()}   over ${timings.length} actions`);
for (const [t, n] of Object.entries(stats.byTable).sort((a, b) => b[1] - a[1]))
	if (n) console.log(`   ${t.padEnd(18)} ${String(n).padStart(7)}`);
console.log('rows by endpoint (total, then top tables)');
for (const [ep, v] of Object.entries(stats.byEp).sort((a, b) => b[1].total - a[1].total)) {
	if (ep === 'setup') continue;
	const n = Object.entries(v)
		.filter(([kx]) => kx !== 'total')
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3);
	console.log(`   ${ep.padEnd(16)} ${String(v.total).padStart(7)}   ${n.map(([kx, c]) => kx + ' ' + c).join(' · ')}`);
}
console.log('latency ms    mean / worst');
for (const [l, xs] of Object.entries(byLabel))
	console.log(`   ${l.padEnd(18)} ${mean(xs).padStart(6)} / ${worst(xs).padStart(6)}`);
// The pond phase digs exactly nine connected tiles in the wetland and nothing
// anywhere else, so the stored per-biome water has one known right answer. This
// is what the stream goal and the Lakemaker trigger both read now, and neither
// surfaces on the board in this session — the goal board shows one starter at a
// time and `start-stream` sits later in the chain — so check the value itself.
{
	const w = holder.db.BiomeState._rows;
	const shaped = [...w.values()]
		.filter((b) => b.playerWater && (b.playerWater.tiles || b.playerWater.lake))
		.map((b) => `${b.biomeId} lake=${b.playerWater.lake} tiles=${b.playerWater.tiles}`);
	const wetland = [...w.values()].find((b) => b.biomeId === 'wetland')?.playerWater;
	console.log(
		`growth gate   armed=${growth.armed > 0 ? 'yes' : 'NO'}  quiet beat read ${growth.quiet} placements  ` +
			`beat after maturity read ${growth.woke}  ->  ${growth.armed > 0 && growth.quiet === 0 && growth.woke > 0 ? 'OK' : 'MISMATCH'}`,
	);
	console.log(`playerWater   ${shaped.join(' · ') || '(none stored)'}`);
	console.log(
		`  expect      wetland lake=9 tiles=9  ->  ${wetland?.lake === 9 && wetland?.tiles === 9 ? 'OK' : 'MISMATCH'}`,
	);
}
console.log(
	`sprout gate   spider while the patch grows: ${sprout.early}  ·  past the threshold: ${sprout.grown}  ->  ` +
		`${sprout.early === 'not yet' && sprout.grown === 'home' ? 'OK' : 'MISMATCH'}`,
);
console.log(
	`terrain rows  ${drift.length ? 'DRIFTED — ' + drift.join(' · ') : 'stored counts match the tiles in every biome'}`,
);
console.log(`goals         ${goals.map((g) => `${g.id} ${g.progress}/${g.target}`).join(' · ') || '(none)'}`);
console.log(`animals home  ${state.Discovery.length}  (${state.Discovery.map((x) => x.animalId).join(', ')})`);
console.log(`biome health  ${state.BiomeState.map((b) => `${b.biomeId}:${b.health}`).join(' ')}`);
console.log(
	`achievements  ${state.PlayerAchievement.length}  (${state.PlayerAchievement.map((a) => a.achievementId).join(', ')})`,
);
if (out) {
	writeFileSync(out, json);
}

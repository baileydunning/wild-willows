// How many concurrent saves each build can support, measured against the REAL
// server bundle (resources.js) driven by an in-memory stand-in for Harper.
//
// Two profiles, because they cost wildly different amounts:
//
//   DESKTOP — the game runs in-process against LocalDb (src/api.ts isLocalCall),
//             so gameplay never touches the network. Only the app-open ping and
//             the metrics uplink do.
//   BROWSER — server-authoritative: every action is a request and the client
//             re-syncs state around it.
//
// …and the BROWSER profile is run against two saves, which is the part that took
// a while to learn the hard way.
//
//   FRESH       — a save that has just been created. This is what this script
//                 measured for its whole life, and it is a misleading instrument
//                 on its own: every table that GROWS with play is near-empty in
//                 it, so the only thing it can really see is the constant factor.
//   COMPLETIONIST — a save with the preserve built out. Same minute of play, same
//                 forty actions, on a world with objects, shaped terrain, every
//                 animal home and every achievement earned.
//
// The gap between them is the whole point. Read amplification is invisible on a
// fresh save and is what decides whether capacity holds up as people play, so a
// change that improves one number and not the other is a change whose value you
// have not measured yet. Print both, always, and compare per table — the growth
// column at the bottom is where a scan that tracks world size shows itself.
//
// Capacity is min(limit / per-player-cost) across every Harper limit, so the
// report names whichever one binds. The DATA caps bind long before the
// operation counts on the free tier — 100 KB of writes per minute is about two
// save files a minute for the whole deployment.
//
// Run:  node scripts/write-profile.mjs
// Needs: npm run build:server   (this reads the built bundle, like CI ships it)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const load = (p) => JSON.parse(readFileSync(join(root, p), 'utf8')).records;
const src = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------- cadences
// Pulled from source, not hardcoded, so changing a client timer changes this
// report. A miss throws rather than silently reporting against a stale default.
function constFromSource(file, name, re) {
	const m = src(file).match(re);
	if (!m) throw new Error(`write-profile: could not read ${name} from ${file}`);
	return Number(m[1].replace(/_/g, '')); // source uses 30_000 style separators
}
const UPLINK_MIN =
	constFromSource('src/solo/metricsUplink.ts', 'REPORT_MS', /const REPORT_MS = (\d+) \* 60 \* 1000/) || 3;
const FEED_FLUSH_MS = constFromSource('src/state.tsx', 'FEED_FLUSH_MS', /const FEED_FLUSH_MS = (\d[\d_]*);/);
const HEARTBEAT_MS = constFromSource('src/state.tsx', 'heartbeat interval', /window\.setInterval\(beat, (\d[\d_]*)\)/);
const perMin = (ms) => 60_000 / ms;

// ------------------------------------------------------- instrumented Harper
const deepFreeze = (v) => {
	if (v && typeof v === 'object' && !Object.isFrozen(v)) {
		Object.freeze(v);
		for (const x of Object.values(v)) deepFreeze(x);
	}
	return v;
};
const sizeOf = (v) => Buffer.byteLength(JSON.stringify(v ?? null), 'utf8');

const stats = { writes: 0, writeBytes: 0, rows: 0, readBytes: 0 };
const byW = new Map(); // "endpoint|table" -> writes
const byR = new Map(); // "endpoint|table" -> rows read
let CURRENT = '(setup)';
const bump = (m, key, n = 1) => m.set(key, (m.get(key) || 0) + n);
const resetStats = () => {
	Object.keys(stats).forEach((k) => (stats[k] = 0));
	byW.clear();
	byR.clear();
};

/** The primary-key prefix a query is bounded to, mirroring Harper's
 *  `starts_with` → primaryStore.getRange. Without this every scan reads the
 *  whole table and the read numbers would be meaningless. */
function idPrefixOf(query) {
	const cs = query?.conditions;
	if (!Array.isArray(cs)) return null;
	for (const c of cs) {
		const attr = c?.attribute ?? c?.[0] ?? null;
		if (attr !== null && attr !== 'id') continue;
		if (c?.comparator !== 'starts_with' && c?.comparator !== 'sw') continue;
		const v = c.value ?? c?.[1];
		if (v != null) return String(v);
	}
	return null;
}

function makeTable(name) {
	const rows = new Map();
	return {
		name,
		async get(id) {
			const r = rows.get(String(id));
			if (r) {
				stats.rows++;
				bump(byR, `${CURRENT}|${name}`);
				stats.readBytes += sizeOf(r);
			}
			return r ? deepFreeze(structuredClone(r)) : undefined;
		},
		async put(row) {
			stats.writes++;
			bump(byW, `${CURRENT}|${name}`);
			stats.writeBytes += sizeOf(row);
			rows.set(String(row.id), structuredClone(row));
		},
		async patch(id, partial) {
			stats.writes++;
			bump(byW, `${CURRENT}|${name}`);
			stats.writeBytes += sizeOf(partial);
			rows.set(String(id), { ...(rows.get(String(id)) || { id }), ...structuredClone(partial) });
		},
		async delete(id) {
			stats.writes++;
			bump(byW, `${CURRENT}|${name}`);
			rows.delete(String(id));
		},
		search(query) {
			const prefix = idPrefixOf(query);
			const keys = prefix === null ? [...rows.keys()] : [...rows.keys()].filter((k) => k.startsWith(prefix));
			const snap = keys.map((k) => rows.get(k));
			stats.rows += snap.length;
			bump(byR, `${CURRENT}|${name}`, snap.length);
			for (const r of snap) stats.readBytes += sizeOf(r);
			return (async function* () {
				for (const r of snap) yield deepFreeze(structuredClone(r));
			})();
		},
		primaryStore: { getSync: (id) => rows.get(String(id)) },
		_rows: rows,
	};
}

const TABLE_NAMES = [
	'Biome',
	'Animal',
	'ResourceType',
	'Recipe',
	'HabitatObject',
	'ToolDef',
	'Achievement',
	'Player',
	'PlayerAchievement',
	'BiomeState',
	'Chest',
	'Placement',
	'Discovery',
	'NodeState',
	'TerrainTile',
	'FeedEntry',
	'Feedback',
	'SoloMetrics',
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
const post = (cls, body) => ((CURRENT = cls), new mod[cls]().post(body));
const get = (cls, id) => ((CURRENT = cls + ' GET'), new mod[cls](id).get());
const appearance = { skin: 'light', hair: 'brown', hairStyle: 'short', build: 'average', outfit: 'green', hat: 'none' };

// ------------------------------------------------------------------ profiles
async function desktopProfile() {
	holder.db = freshDb();
	// Play a little first, so the uplinked snapshot is a REAL save's metrics blob
	// rather than a toy object. The client sends the whole player row minus
	// `biomes` (src/solo/metricsUplink.ts), and its size is what the write-data
	// cap actually meters — a synthetic stub understates it several-fold.
	const dpid = (await post('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
	for (let i = 0; i < 10; i++) {
		await post('Heartbeat', { playerId: dpid }).catch(() => {});
		await post('CollectResource', { playerId: dpid, biomeId: 'meadow', nodeId: `d${i}`, resourceId: 'seeds' }).catch(
			() => {},
		);
	}
	const { biomes: _b, ...snapshot } = holder.db.Player._rows.get(dpid);

	resetStats();
	await post('AppOpen', { deviceId: 'dev-1', phase: 'open', platform: 'desktop', version: 'ci' });
	const launch = { writes: stats.writes, kb: stats.writeBytes / 1024 };
	resetStats();
	await post('SyncMetrics', {
		clientId: 'c1',
		name: 'Ada',
		platform: 'desktop',
		os: 'linux',
		version: 'ci',
		language: 'en',
		snapshot,
	});
	const uplink = {
		writes: stats.writes,
		kb: stats.writeBytes / 1024,
		rows: stats.rows,
		readKb: stats.readBytes / 1024,
	};
	return {
		label: 'Desktop app',
		note: `gameplay runs in-process; only /AppOpen/ (per launch) and /SyncMetrics/ (every ${UPLINK_MIN} min) leave the machine`,
		writesMin: uplink.writes / UPLINK_MIN,
		writeKbMin: uplink.kb / UPLINK_MIN,
		rowsMin: uplink.rows / UPLINK_MIN,
		readKbMin: uplink.readKb / UPLINK_MIN,
		detail: `${launch.writes} write/launch · ${uplink.writes} write per uplink of real save metrics (${uplink.kb.toFixed(2)} KB)`,
	};
}

// ------------------------------------------------------- the built-out save
//
// Sized against the real boards (data/biomes.json: 30x26, meadow 44x26), so this
// is a preserve someone has genuinely worked on rather than a synthetic worst
// case — roughly a sixth of each board built on and a quarter of it shaped.
// Every animal is home and every achievement earned, which is what a save looks
// like at the point the per-action achievement sweep has the most rows to read.
const BUILT = { objectsPerArea: 120, tilesPerArea: 200 };
const AREAS = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];

/**
 * Fill a world in, under the CURRENT key shapes.
 *
 * Written straight to the store rather than through the endpoints: going through
 * PlaceObject and Terraform would take far longer and would also exercise the
 * very code this is meant to measure. The ids must match the key contract
 * exactly (`${wid}:${area}:…` — see server/keys.ts), or the reads under test take
 * their legacy fallback path and the profile measures something nobody runs.
 *
 * Everything sits clear of the rows the simulated minute acts on (it digs along
 * y=2), because a seeded object on a tile the profile tries to dig makes every
 * terraform fail — and a run where the actions never landed still prints a
 * confident-looking table. The `landed` assertion below is the backstop for that.
 */
function seedBuiltOutSave(pid) {
	const now = Date.now();
	const AGED = now - 9e8; // long past every growSeconds / matureHours threshold
	for (const area of AREAS) {
		for (let i = 0; i < BUILT.objectsPerArea; i++) {
			const id = `${pid}:${area}:pl_built_${i}`;
			holder.db.Placement._rows.set(id, {
				id,
				worldId: pid,
				playerId: pid,
				objectId: 'wildflower',
				area,
				x: 3 + (i % 24),
				y: 5 + Math.floor(i / 24),
				placedAt: AGED,
			});
		}
		for (let i = 0; i < BUILT.tilesPerArea; i++) {
			const x = 3 + (i % 24);
			const y = 11 + Math.floor(i / 24);
			const id = `${pid}:${area}:${x}:${y}`;
			// All one type on purpose. The mix changes biome health, which changes
			// which animals come home, which changes the WRITES — and this is a read
			// measurement that has to be the same number every run.
			holder.db.TerrainTile._rows.set(id, {
				id,
				worldId: pid,
				playerId: pid,
				area,
				x,
				y,
				type: 'soil',
				updatedAt: AGED,
			});
		}
	}
	for (const a of [...load('data/animals-1.json'), ...load('data/animals-2.json')]) {
		const id = `${pid}:${a.id}`;
		holder.db.Discovery._rows.set(id, {
			id,
			worldId: pid,
			playerId: pid,
			animalId: a.id,
			biomeId: a.biome,
			comfort: 'comfortable',
			timesObserved: 1,
			firstObservedAt: AGED,
			whyReturned: 'x',
		});
	}
	for (const ach of load('data/achievements.json')) {
		const id = `${pid}:${ach.id}`;
		holder.db.PlayerAchievement._rows.set(id, {
			id,
			playerId: pid,
			achievementId: ach.id,
			biome: ach.biome,
			earnedAt: AGED,
		});
	}
	// A save this far along has the whole preserve open, and several reads under
	// test behave differently for a locked biome (checkUnlocks skips it, the
	// action gates refuse it), so leaving them shut would measure a world nobody
	// has.
	const player = holder.db.Player._rows.get(pid);
	holder.db.Player._rows.set(pid, { ...player, unlockedBiomes: [...AREAS] });
	for (const area of AREAS) {
		const id = `${pid}:${area}`;
		const bs = holder.db.BiomeState._rows.get(id);
		if (bs) holder.db.BiomeState._rows.set(id, { ...bs, unlocked: true });
	}
}

async function browserProfile({ built = false } = {}) {
	holder.db = freshDb();
	const pid = (await post('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
	await post('Heartbeat', { playerId: pid });
	const p = holder.db.Player._rows.get(pid);
	holder.db.Player._rows.set(pid, {
		...p,
		tools: { ...(p.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
		inventory: Object.fromEntries(['seeds', 'stones', 'branches', 'fiber', 'water'].map((r) => [r, 20])),
	});

	if (built) {
		seedBuiltOutSave(pid);
		// Settle the seeded world through the game's OWN code before measuring.
		// Rows written by hand disagree with what the server would have computed
		// for them — animal comfort most of all — so the first real action spends a
		// burst of writes reconciling the fixture rather than doing anything a
		// player did. Recalculating each area here moves that burst outside the
		// measured minute, where it belongs.
		for (const area of AREAS) await post('RecalcBiome', { playerId: pid, biomeId: area }).catch(() => {});
	}

	resetStats();
	let landed = 0;
	const beats = Math.max(1, Math.round(perMin(HEARTBEAT_MS)));
	const flushes = Math.max(1, Math.round(perMin(FEED_FLUSH_MS)));
	for (let b = 0; b < beats; b++) await post('Heartbeat', { playerId: pid }).catch(() => {});
	for (let f = 0; f < flushes; f++) {
		await post('AppendFeed', {
			playerId: pid,
			entries: Array.from({ length: 8 }, (_, i) => ({ at: Date.now() + i, icon: 'leaf', text: `line ${f}-${i}` })),
		}).catch(() => {});
	}
	// 40 gameplay actions a minute — 27 gathers + 13 terraform, plus a state
	// re-sync every 4 actions. That rate is the p99 of observed play (median is
	// ~13/min, heaviest sustained save 47/min), so this profile is a heavy real
	// player rather than a worst case nobody reaches.
	for (let i = 0; i < 27; i++) {
		landed += await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${i}`, resourceId: 'seeds' })
			.then(() => 1)
			.catch(() => 0);
		if (i % 4 === 0) await get('GameState', pid).catch(() => {});
	}
	for (let i = 0; i < 13; i++) {
		landed += await post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 2 + (i % 40),
			y: 2 + Math.floor(i / 40),
			action: 'dig',
		})
			.then(() => 1)
			.catch(() => 0);
	}
	// A refused action still reads rows and still lands in the table, so a run
	// where most of them threw prints a plausible-looking profile of a minute of
	// play that never happened. Cheap to check, and it has already caught a seeded
	// object sitting on a tile the profile was about to dig.
	if (landed < 36) {
		throw new Error(
			`write-profile: only ${landed} of 40 actions landed on the ${built ? 'built-out' : 'fresh'} save — ` +
				`the numbers below would describe a minute of refusals, not of play`,
		);
	}

	return {
		label: built ? 'Browser demo, built-out save' : 'Browser demo, fresh save',
		note: 'server-authoritative: every action is a request and the client re-syncs state around it',
		writesMin: stats.writes,
		writeKbMin: stats.writeBytes / 1024,
		rowsMin: stats.rows,
		readKbMin: stats.readBytes / 1024,
		detail: `${landed} actions landed in the simulated minute`,
	};
}

// ------------------------------------------------------------- write profile

/** Run one browser profile twice and keep the WARM numbers.
 *
 *  The first pass through a cold process pays for one-time work — module init,
 *  the key migration, the memo sets filling — that no real request after the
 *  first one pays. Reporting it as the cost of a minute of play would overstate
 *  every figure here, so the cold run is made and discarded. */
async function measure(opts) {
	const cold = await browserProfile(opts);
	const warm = await browserProfile(opts);
	return { cold, warm, writes: new Map(byW), reads: new Map(byR) };
}

await desktopProfile();
const fresh = await measure({ built: false });
const built = await measure({ built: true });

const roll = (m) => {
	const byKey = new Map();
	for (const [k, n] of m) {
		const [ep, tbl] = k.split('|');
		bumpInto(byKey, ep, tbl, n);
	}
	return byKey;
};
function bumpInto(map, ep, tbl, n) {
	if (!map.has(ep)) map.set(ep, new Map());
	const t = map.get(ep);
	t.set(tbl, (t.get(tbl) || 0) + n);
}
const total = (m) => [...m.values()].reduce((a, x) => a + x, 0);
const num = (n) => Number(n).toLocaleString('en-US');

function table(m, label) {
	const rolled = roll(m);
	const rows = [...rolled.entries()]
		.map(([ep, tbls]) => [ep, total(tbls), [...tbls.entries()].sort((a, b) => b[1] - a[1])])
		.sort((a, b) => b[1] - a[1]);
	const grand = rows.reduce((a, r) => a + r[1], 0);
	console.log(`\n=== ${label} — ${num(grand)} total ===`);
	for (const [ep, n, tbls] of rows) {
		const pct = ((n / grand) * 100).toFixed(1).padStart(5);
		console.log(`${pct}%  ${num(n).padStart(7)}  ${ep}`);
		for (const [t, tn] of tbls) if (tn) console.log(`                       ${num(tn).padStart(7)}  ${t}`);
	}
}

/** Row reads per table, across every endpoint. */
function perTable(m) {
	const out = new Map();
	for (const [k, n] of m) {
		const tbl = k.split('|')[1];
		out.set(tbl, (out.get(tbl) || 0) + n);
	}
	return out;
}

console.log('Browser demo, one save, one simulated minute at 40 actions/min\n');
for (const [name, r] of [
	['fresh save', fresh],
	['built-out save', built],
]) {
	console.log(
		`${name.padEnd(16)} ${num(r.warm.writesMin).padStart(7)} writes   ` +
			`${num(Math.round(r.warm.rowsMin)).padStart(7)} rows read   ` +
			`${r.warm.writeKbMin.toFixed(1).padStart(6)} KB written`,
	);
}

table(built.writes, 'WRITES by endpoint / table — built-out save');
table(built.reads, 'ROW READS by endpoint / table — built-out save');
table(fresh.reads, 'ROW READS by endpoint / table — fresh save');

// --------------------------------------------------------- the growth column
//
// The reason both profiles are run. A table whose growth factor is ~1x costs the
// same however much of the game someone has played; anything well above that is
// a read that tracks world size, and it is what decides whether a launch-day
// capacity number still holds three months in. Sorted by the built-out cost,
// because that is the one that has to be paid.
const freshT = perTable(fresh.reads);
const builtT = perTable(built.reads);
const tables = [...new Set([...freshT.keys(), ...builtT.keys()])]
	.map((t) => [t, freshT.get(t) || 0, builtT.get(t) || 0])
	.filter(([, f, b]) => f || b)
	.sort((a, b) => b[2] - a[2]);

console.log('\n=== ROW READS per table — how the cost grows with the save ===');
console.log(`${'table'.padEnd(20)}${'fresh'.padStart(9)}${'built-out'.padStart(12)}${'growth'.padStart(9)}`);
for (const [t, f, b] of tables) {
	const growth = f ? `${(b / f).toFixed(1)}x` : b ? 'n/a' : '—';
	console.log(`${t.padEnd(20)}${num(f).padStart(9)}${num(b).padStart(12)}${growth.padStart(9)}`);
}
const fTotal = [...freshT.values()].reduce((a, x) => a + x, 0);
const bTotal = [...builtT.values()].reduce((a, x) => a + x, 0);
console.log(
	`${'TOTAL'.padEnd(20)}${num(fTotal).padStart(9)}${num(bTotal).padStart(12)}` +
		`${`${(bTotal / fTotal).toFixed(1)}x`.padStart(9)}`,
);

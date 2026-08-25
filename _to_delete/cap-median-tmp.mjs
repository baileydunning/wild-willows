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
// Capacity is min(limit / per-player-cost) across every Harper limit, so the
// report names whichever one binds. The DATA caps bind long before the
// operation counts on the free tier — 100 KB of writes per minute is about two
// save files a minute for the whole deployment.
//
// Run:  node scripts/capacity-report.mjs [--out report.md]
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
	if (!m) throw new Error(`capacity-report: could not read ${name} from ${file}`);
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
const resetStats = () => Object.keys(stats).forEach((k) => (stats[k] = 0));

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
				stats.readBytes += sizeOf(r);
			}
			return r ? deepFreeze(structuredClone(r)) : undefined;
		},
		async put(row) {
			stats.writes++;
			stats.writeBytes += sizeOf(row);
			rows.set(String(row.id), structuredClone(row));
		},
		async patch(id, partial) {
			stats.writes++;
			stats.writeBytes += sizeOf(partial);
			rows.set(String(id), { ...(rows.get(String(id)) || { id }), ...structuredClone(partial) });
		},
		async delete(id) {
			stats.writes++;
			rows.delete(String(id));
		},
		search(query) {
			const prefix = idPrefixOf(query);
			const keys = prefix === null ? [...rows.keys()] : [...rows.keys()].filter((k) => k.startsWith(prefix));
			const snap = keys.map((k) => rows.get(k));
			stats.rows += snap.length;
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
const post = (cls, body) => new mod[cls]().post(body);
const get = (cls, id) => new mod[cls](id).get();
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

async function browserProfile() {
	holder.db = freshDb();
	const pid = (await post('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
	await post('Heartbeat', { playerId: pid });
	// Warm the PROCESS before measuring. reconcileDefinitions() (server/worlds.ts)
	// rewrites every seed record — Biome, Recipe, HabitatObject, ToolDef,
	// ResourceType, Animal, Achievement — on its first call in a worker, and
	// memoizes the promise. That is ~630 writes ONCE PER WORKER at boot, amortized
	// over the life of the process. Measuring the first minute of play charged all
	// of it to a single player-minute and overstated browser writes about 7x
	// (729/min vs the true 97/min), which in turn understated PRO capacity by the
	// same factor. Burn a throwaway action first so the pass has already run.
	await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'warm', resourceId: 'seeds' }).catch(
		() => {},
	);
	await get('GameState', pid).catch(() => {});
	// It is dispatched as `void reconcileDefinitions()` (worlds.ts) — fire and
	// forget — so triggering it is not enough: its writes drain asynchronously
	// into whatever window is open next. Wait for the write counter to go quiet.
	for (let i = 0; i < 200; i++) {
		const before = stats.writes;
		await new Promise((r) => setTimeout(r, 10));
		if (stats.writes === before) break;
	}
	const p = holder.db.Player._rows.get(pid);
	holder.db.Player._rows.set(pid, {
		...p,
		tools: { ...(p.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
		inventory: Object.fromEntries(['seeds', 'stones', 'branches', 'fiber', 'water'].map((r) => [r, 20])),
	});

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
	for (let i = 0; i < 9; i++) {
		landed += await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${i}`, resourceId: 'seeds' })
			.then(() => 1)
			.catch(() => 0);
		if (i % 4 === 0) await get('GameState', pid).catch(() => {});
	}
	for (let i = 0; i < 4; i++) {
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
	return {
		label: 'Browser demo',
		note: 'server-authoritative: every action is a request and the client re-syncs state around it',
		writesMin: stats.writes,
		writeKbMin: stats.writeBytes / 1024,
		rowsMin: stats.rows,
		readKbMin: stats.readBytes / 1024,
		detail: `${landed} actions landed in the simulated minute`,
	};
}

// -------------------------------------------------------------------- report
const TIERS = {
	'Free (START)': { writes: 1_000, reads: 1_000, writeKb: 100, readKb: 1024 },
	PRO: { writes: 120_000, reads: 1_000_000, writeKb: 400 * 1024, readKb: 1024 * 1024 },
};
const cap = (cost, limit) => (cost <= 0 ? Infinity : Math.floor(limit / cost));
const fmt = (n) => (n === Infinity ? 'no limit' : n.toLocaleString());

function capacity(p, tier) {
	const c = {
		writes: cap(p.writesMin, tier.writes),
		reads: cap(p.rowsMin, tier.reads),
		'write data': cap(p.writeKbMin, tier.writeKb),
		'read data': cap(p.readKbMin, tier.readKb),
	};
	const [binds, value] = Object.entries(c).sort((a, b) => a[1] - b[1])[0];
	return { value, binds };
}

const profiles = [await desktopProfile(), await browserProfile()];
let md = `<!-- capacity-report -->\n### Concurrent saves this build can support\n\n`;
md += `| Build | Free (START) | PRO | Binds on | Cost per save/min |\n|---|--:|--:|---|---|\n`;
for (const p of profiles) {
	const free = capacity(p, TIERS['Free (START)']);
	const pro = capacity(p, TIERS.PRO);
	md += `| **${p.label}** | ${fmt(free.value)} | ${fmt(pro.value)} | ${free.binds} (free) / ${pro.binds} (PRO) | ${p.writesMin.toFixed(1)} writes, ${p.writeKbMin.toFixed(1)} KB out, ${Math.round(p.rowsMin)} rows in |\n`;
}
md += `\n<details><summary>What was measured</summary>\n\n`;
for (const p of profiles) md += `- **${p.label}** — ${p.note}. ${p.detail}.\n`;
md += `\nClient cadences read from source: heartbeat every ${HEARTBEAT_MS / 1000}s, feed flush every ${FEED_FLUSH_MS / 1000}s, metrics uplink every ${UPLINK_MIN} min.\n`;
md += `\nSimulated against the built \`resources.js\` with an in-memory Harper. A number moving in a PR means the write or read path changed — worth a look. The game's own \`Math.random()\` makes landed-action counts vary a little run to run, so treat ±10% as noise.\n</details>\n`;

process.stdout.write(md);
const outIdx = process.argv.indexOf('--out');
if (outIdx > -1 && process.argv[outIdx + 1]) {
	writeFileSync(process.argv[outIdx + 1], md);
	console.error(`\nwrote ${process.argv[outIdx + 1]}`);
}

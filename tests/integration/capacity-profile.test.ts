// Capacity inputs: what each KIND of player costs the server, and how much CPU a
// request takes. Read together with write-budget*.test.ts these are the numbers
// a plan decision is made from.
//
// IMPORTANT about the CPU figures: this harness is an in-memory mock. It measures
// the application work — validation, snapshot building, achievement evaluation —
// and NOT msgpack encode/decode of real records, storage writes, HTTP or TLS. So
// per-request time here is a LOWER bound, and any concurrency derived from it is
// an UPPER bound. Treat them as "no better than", never as a forecast.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const TABLES = [
	'Player',
	'BiomeState',
	'Placement',
	'Chest',
	'Discovery',
	'NodeState',
	'TerrainTile',
	'FeedEntry',
	'PlayerAchievement',
	'World',
	'WorldMember',
	'SoloMetrics',
	'AppOpen',
];
const totalWrites = () => TABLES.reduce((n, t) => n + w.db[t]._writeStats().total, 0);

async function timeIt(label: string, runs: number, fn: (i: number) => Promise<any>) {
	await fn(-1).catch(() => undefined); // warm the path
	const t0 = performance.now();
	for (let i = 0; i < runs; i++) await fn(i).catch(() => undefined);
	const ms = (performance.now() - t0) / runs;
	return { label, ms };
}

describe('capacity profile', () => {
	it('desktop (solo) player: what actually reaches Harper', async () => {
		// The desktop build runs the whole game in-process against LocalDb; only the
		// metrics uplink and the app-open ping cross the network (src/api.ts
		// isLocalCall, src/solo/metricsUplink.ts). So a desktop player's cost is
		// those two endpoints and nothing else, no matter how hard they play.
		TABLES.forEach((t) => w.db[t]._resetWriteStats());
		await w.post('AppOpen', { deviceId: 'dev-1', phase: 'open', platform: 'desktop', version: '0.2.10' });
		const perLaunch = totalWrites();

		TABLES.forEach((t) => w.db[t]._resetWriteStats());
		await w.post('SyncMetrics', {
			clientId: 'c1',
			name: 'Ada',
			platform: 'desktop',
			os: 'mac',
			version: '0.2.10',
			language: 'en',
			snapshot: { playSeconds: 600, name: 'Ada' }, // must be an object; the server stringifies it
		});
		const perUplink = totalWrites();

		// The uplink runs every 3 minutes (REPORT_MS in src/solo/metricsUplink.ts).
		const perMinute = perUplink / 3;
		console.log(
			`\n  DESKTOP player: ${perLaunch} write(s) per app launch, ${perUplink} per metrics uplink (every 3 min)` +
				`\n  => ${perMinute.toFixed(2)} writes/min sustained` +
				`\n  => free tier (1,000/min)  supports ~${Math.floor(1000 / perMinute).toLocaleString()} concurrent` +
				`\n  => PRO     (120,000/min)  supports ~${Math.floor(120000 / perMinute).toLocaleString()} concurrent\n`,
		);
		expect(perUplink).toBeGreaterThan(0);
	}, 60_000);

	it('browser player: every PRO limit, not just writes', async () => {
		// A browser player is the expensive kind: the game is server-authoritative,
		// so each action is a request AND the client re-syncs state around it
		// (src/state.tsx act() → refresh, coalesced by scheduleReconcile). Writes are
		// what cap the free tier, but PRO raises the ceilings unevenly — so the
		// question is which limit binds FIRST, not how many writes fit.
		const pid = (await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
		await w.post('Heartbeat', { playerId: pid });
		const start = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			tools: { ...(start.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
			inventory: Object.fromEntries(['seeds', 'stones', 'branches', 'fiber', 'water'].map((r) => [r, 20])),
		});

		TABLES.forEach((t) => {
			w.db[t]._resetWriteStats();
			w.db[t]._resetScanStats();
		});
		let bytesRead = 0;
		const meter = async (fn: () => Promise<any>) => {
			const before = TABLES.reduce((n, t) => n + w.db[t]._scanStats().rowsScanned, 0);
			const out = await fn().catch(() => null);
			const after = TABLES.reduce((n, t) => n + w.db[t]._scanStats().rowsScanned, 0);
			// Approximate the wire/storage size of what was read. JSON overstates a
			// packed encoding somewhat, so this is a conservative (high) estimate.
			if (out) bytesRead += JSON.stringify(out).length;
			return after - before;
		};

		// One minute: 2 beats, 2 feed flushes, 40 gathers, 20 terraform, and 10
		// state refreshes (the client coalesces a burst of actions into one refetch).
		for (let beat = 0; beat < 2; beat++) {
			await meter(() => w.post('Heartbeat', { playerId: pid }));
			await meter(() =>
				w.post('AppendFeed', {
					playerId: pid,
					entries: Array.from({ length: 8 }, (_, i) => ({ at: Date.now() + i, icon: 'leaf', text: `l${beat}-${i}` })),
				}),
			);
			for (let i = 0; i < 20; i++) {
				await meter(() =>
					w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `b${beat}-${i}`, resourceId: 'seeds' }),
				);
				if (i % 4 === 0) await meter(() => w.get('GameState', pid)); // coalesced re-sync
			}
			for (let i = 0; i < 10; i++) {
				await meter(() => w.post('Terraform', { playerId: pid, area: 'meadow', x: 5 + i, y: 6 + beat, action: 'dig' }));
			}
		}

		const writes = totalWrites();
		const rows = TABLES.reduce((n, t) => n + w.db[t]._scanStats().rowsScanned, 0);
		const kb = bytesRead / 1024;

		// PRO, per the pricing page.
		const PRO = { writesMin: 120_000, readsMin: 1_000_000, readKbMin: 1024 * 1024, writeKbMin: 400 * 1024 };
		const cap = {
			writes: Math.floor(PRO.writesMin / writes),
			reads: Math.floor(PRO.readsMin / Math.max(rows, 1)),
			readData: Math.floor(PRO.readKbMin / Math.max(kb, 0.001)),
		};
		console.log(
			`\n  BROWSER player, one minute of very active play:` +
				`\n    writes      ${writes}` +
				`\n    rows read   ${rows}` +
				`\n    data read   ${kb.toFixed(1)} KB (JSON — a high estimate)` +
				`\n  PRO concurrent capacity by limit:` +
				`\n    writes    120,000/min  => ${cap.writes.toLocaleString()}` +
				`\n    reads   1,000,000/min  => ${cap.reads.toLocaleString()}` +
				`\n    read data     1 GB/min => ${cap.readData.toLocaleString()}` +
				`\n  => BINDING LIMIT: ${Object.entries(cap).sort((a, b) => a[1] - b[1])[0][0]} at ~${Math.min(...Object.values(cap)).toLocaleString()} concurrent\n`,
		);
		expect(writes).toBeGreaterThan(0);
	}, 120_000);

	it('per-request application CPU (lower bound)', async () => {
		const pid = (await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
		await w.post('Heartbeat', { playerId: pid });
		const start = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			tools: { ...(start.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
			inventory: Object.fromEntries(['seeds', 'stones', 'branches', 'fiber', 'water'].map((r) => [r, 20])),
		});

		const results = [
			await timeIt('GameState (full snapshot)', 40, () => w.get('GameState', pid)),
			await timeIt('CollectResource', 40, (i) =>
				w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `cpu-${i}`, resourceId: 'seeds' }),
			),
			await timeIt('Heartbeat', 20, () => w.post('Heartbeat', { playerId: pid })),
			await timeIt('AppendFeed (8 lines)', 20, (i) =>
				w.post('AppendFeed', {
					playerId: pid,
					entries: Array.from({ length: 8 }, (_, j) => ({ at: Date.now() + j, icon: 'leaf', text: `l${i}-${j}` })),
				}),
			),
		];
		const action = results.find((r) => r.label === 'CollectResource')!.ms;
		// A "very active" player is ~48 actions/min = 0.8 actions/sec.
		const perCpu = 1000 / action;
		console.log(
			'\n  application CPU per request (in-memory, NO storage/HTTP/TLS — a LOWER bound):\n' +
				results.map((r) => `    ${r.label.padEnd(26)} ${r.ms.toFixed(2)} ms`).join('\n') +
				`\n  => one core sustains no more than ~${perCpu.toFixed(0)} actions/sec` +
				`\n  => at 48 actions/min/player that is no more than ~${Math.floor(perCpu / 0.8).toLocaleString()} very active players per core` +
				`\n  => START is 1 core; PRO shared is up to 12\n`,
		);
		expect(action).toBeGreaterThan(0);
	}, 120_000);
});

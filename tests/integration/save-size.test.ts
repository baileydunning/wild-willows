// How big a save actually gets, as JSON and gzipped.
//
// This is the number that governs capacity once the browser build owns its own
// save (see the plan): the save is written to localStorage on the client and
// synced to Harper as a blob, so its size sets both the client storage footprint
// and the server write-data cost — and write data, not write count, is what binds
// on every Harper tier.
//
// It is measured the same way the real thing is stored: the DYNAMIC_TABLES from
// src/solo/localDb.ts, dumped and JSON.stringify'd exactly as serializeSave does.

import { describe, it, expect, beforeEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { freshWorld, appearance, type World } from './harness';

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

// Mirrors DYNAMIC_TABLES in src/solo/localDb.ts — the tables a save is made of.
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
	'World',
	'WorldMember',
];

function measure() {
	const save: Record<string, any[]> = {};
	for (const t of DYNAMIC) save[t] = [...(w.db[t]?._rows.values() ?? [])];
	const json = JSON.stringify(save);
	const rows = Object.values(save).reduce((n, r) => n + r.length, 0);
	return { rows, kb: json.length / 1024, gzKb: gzipSync(Buffer.from(json)).length / 1024 };
}

describe('save size', () => {
	it('grows how, with how much play', async () => {
		const pid = (await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
		await w.post('Heartbeat', { playerId: pid });
		const start = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			tools: { ...(start.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
			inventory: Object.fromEntries(['seeds', 'stones', 'branches', 'fiber', 'water'].map((r) => [r, 20])),
		});

		const out: string[] = [];
		const fresh = measure();
		out.push(
			`   0 min | ${String(fresh.rows).padStart(5)} rows | ${fresh.kb.toFixed(1).padStart(7)} KB | ${fresh.gzKb.toFixed(1).padStart(6)} KB gzipped`,
		);

		// Each "minute" ~= 20 gathers, 10 terraform actions, 8 feed lines, 1 beat.
		for (let min = 1; min <= 60; min++) {
			await w.post('Heartbeat', { playerId: pid }).catch(() => undefined);
			await w
				.post('AppendFeed', {
					playerId: pid,
					entries: Array.from({ length: 8 }, (_, i) => ({
						at: Date.now() + i,
						icon: 'leaf',
						text: `a line of activity ${min}-${i}`,
					})),
				})
				.catch(() => undefined);
			for (let i = 0; i < 20; i++) {
				await w
					.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${min}-${i}`, resourceId: 'seeds' })
					.catch(() => undefined);
			}
			for (let i = 0; i < 10; i++) {
				await w
					.post('Terraform', {
						playerId: pid,
						area: 'meadow',
						x: 2 + ((min * 10 + i) % 40),
						y: 2 + Math.floor((min * 10 + i) / 40),
						action: 'dig',
					})
					.catch(() => undefined);
			}
			if ([5, 15, 30, 60].includes(min)) {
				const m = measure();
				out.push(
					`  ${String(min).padStart(2)} min | ${String(m.rows).padStart(5)} rows | ${m.kb.toFixed(1).padStart(7)} KB | ${m.gzKb.toFixed(1).padStart(6)} KB gzipped`,
				);
			}
		}
		const final = measure();
		const byTable = DYNAMIC.map((t) => {
			const rows = [...(w.db[t]?._rows.values() ?? [])];
			return [t, rows.length, JSON.stringify(rows).length / 1024] as const;
		})
			.filter(([, n]) => n > 0)
			.sort((a, b) => b[2] - a[2]);
		console.log(
			'\n  after 60 min, by table:\n' +
				byTable
					.map(([t, n, kb]) => `    ${t.padEnd(18)} ${String(n).padStart(4)} rows  ${kb.toFixed(1).padStart(6)} KB`)
					.join('\n'),
		);
		console.log(
			'\n  SAVE SIZE vs PLAY TIME\n' +
				out.join('\n') +
				`\n\n  localStorage quota is ~5 MB/origin => ~${Math.floor(5120 / final.kb)} saves of this size` +
				`\n  START write data 100 KB/min, 5-min flush => ~${Math.floor(100 / (final.gzKb / 5))} concurrent browser players` +
				`\n  PRO   write data 400 MB/min, 5-min flush => ~${Math.floor((400 * 1024) / (final.gzKb / 5)).toLocaleString()} concurrent\n`,
		);
		expect(final.rows).toBeGreaterThan(0);
	}, 180_000);
});

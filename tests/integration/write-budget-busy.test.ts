// The same measurement as write-budget.test.ts, but for a player who is really
// going at it — the profile a classroom actually produces. Kept separate because
// this one is a planning number, not a ratchet: it answers "how many of THESE
// fit on the plan we are on", and the answer moves with every change to the
// write path.

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

describe('free-tier write budget — very active player', () => {
	it('reports what one minute of hard play costs', async () => {
		const pid = (await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
		await w.post('Heartbeat', { playerId: pid });
		// Give her the tools and materials so the busy actions actually land.
		const start = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			// Top up the starting tools rather than replacing them — a replaced tool
			// map drops whatever gathering needs and every gather is then refused.
			tools: { ...(start.tools || {}), shovel: 4, axe: 4, watering: 4, net: 4 },
			inventory: Object.fromEntries(
				['seeds', 'berries', 'stones', 'branches', 'wildflowers', 'fiber', 'water'].map((r) => [r, 20]), // modest: a full pack makes every gather refuse
			),
		});

		TABLES.forEach((t) => w.db[t]._resetWriteStats());
		const landed = { gather: 0, terraform: 0 };

		// One minute of hard play: 2 beats, 2 feed flushes, 40 gathers, 20 terraform
		// actions (dig/water) — a child who has found the loop and is running it.
		for (let beat = 0; beat < 2; beat++) {
			await w.post('Heartbeat', { playerId: pid });
			await w.post('AppendFeed', {
				playerId: pid,
				entries: Array.from({ length: 8 }, (_, i) => ({ at: Date.now() + i, icon: 'leaf', text: `line ${beat}-${i}` })),
			});
			for (let i = 0; i < 20; i++) {
				landed.gather += await w
					.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${beat}-${i}`, resourceId: 'seeds' })
					.then(() => 1)
					.catch(() => 0);
			}
			for (let i = 0; i < 10; i++) {
				landed.terraform += await w
					.post('Terraform', { playerId: pid, area: 'meadow', x: 5 + i, y: 6 + beat, action: 'dig' })
					.then(() => 1)
					.catch(() => 0);
			}
		}

		const per = TABLES.map((t) => [t, w.db[t]._writeStats().total] as const)
			.filter(([, n]) => n > 0)
			.sort((a, b) => b[1] - a[1]);
		const total = TABLES.reduce((n, t) => n + w.db[t]._writeStats().total, 0);
		console.log(
			`\n  landed: ${landed.gather} gathers, ${landed.terraform} terraform` +
				`\n  writes per VERY ACTIVE player per minute: ${total}` +
				`\n  ${per.map(([t, n]) => `${t}=${n}`).join('  ')}` +
				`\n  => free tier (1,000/min) supports about ${Math.floor(1000 / total)} of these at once` +
				`\n  => 100 of these would need about ${total * 100} writes/min\n`,
		);
		// A planning number, not a ratchet — it exists to be read, not to gate CI.
		// The only assertion is that the simulated play actually happened, because
		// a refused action writes nothing and would silently report a rosy figure.
		expect(landed.gather + landed.terraform).toBeGreaterThan(40);
	}, 120_000);
});

// What ONE active player costs Harper in writes per minute.
//
// This is the number that sets how many people can play at once. Harper's free
// tier allows 1,000 writes/minute across the WHOLE deployment, so the ceiling on
// simultaneous players is roughly 1000 / (writes per player per minute). Reads
// were the other half of the problem and are handled by the key contract (see
// key-scoping.test.ts); writes are what remains.
//
// The simulated minute below is deliberately modest — a player gathering at a
// steady pace with the feed and heartbeat doing what they always do. Real
// engaged play is busier, so treat the result as a floor, not an average.

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

const resetWrites = () => TABLES.forEach((t) => w.db[t]._resetWriteStats());
const writesByTable = () =>
	TABLES.map((t) => [t, w.db[t]._writeStats().total] as const)
		.filter(([, n]) => n > 0)
		.sort((a, b) => b[1] - a[1]);
const totalWrites = () => TABLES.reduce((n, t) => n + w.db[t]._writeStats().total, 0);

describe('free-tier write budget', () => {
	it('reports what one minute of ordinary play costs', async () => {
		const pid = (await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance })).playerId;
		await w.post('Heartbeat', { playerId: pid });

		resetWrites();
		let gathered = 0;

		// One minute of ordinary play:
		//   • 2 heartbeats            (client beats every 30s while active)
		//   • 2 feed flushes          (the feed rides the heartbeat — FEED_FLUSH_MS)
		//   • 20 gathers              (a steady, unhurried gathering pace)
		for (let beat = 0; beat < 2; beat++) {
			await w.post('Heartbeat', { playerId: pid });
			// One flush per beat, carrying everything buffered since the last one —
			// the batch size does not change the cost, because it is one row.
			await w.post('AppendFeed', {
				playerId: pid,
				entries: Array.from({ length: 5 }, (_, i) => ({
					at: Date.now() + i,
					icon: 'leaf',
					text: `gathered something ${beat}-${i}`,
				})),
			});
			for (let flush = 0; flush < 5; flush++) {
				for (let g = 0; g < 2; g++) {
					// A fresh node each time: gathering the same node twice inside the
					// regen window is refused, and a refused action writes nothing.
					gathered += await w
						.post('CollectResource', {
							playerId: pid,
							biomeId: 'meadow',
							nodeId: `n${beat}-${flush}-${g}`,
							resourceId: 'seeds',
						})
						.then(() => 1)
						.catch(() => 0);
				}
			}
		}

		expect(gathered, 'the simulated gathers must actually land, or this measures nothing').toBeGreaterThanOrEqual(18);
		const total = totalWrites();
		const perTable = writesByTable();
		const ceiling = Math.floor(1000 / total);
		console.log(
			'\n  writes per player per minute of ordinary play: ' +
				total +
				'\n  ' +
				perTable.map(([t, n]) => `${t}=${n}`).join('  ') +
				`\n  => free tier (1,000 writes/min) supports about ${ceiling} simultaneous players\n`,
		);

		// A ratchet, not a target. Today's cost is 72, which is ~13 simultaneous
		// players on the free tier. The known reducible parts of that number:
		//
		//   Player=42  two patches of the SAME row per action — the state change and
		//              bumpMetrics' analytics patch — plus achievements. Coalescing
		//              them to one write per action removes ~20/min.
		//   FeedEntry  the client flushes every 6s; folding the flush into the 30s
		//              heartbeat removes ~8/min.
		//   NodeState  one row per gather, purely for the regen cooldown. Folding it
		//              into a map on a row we already write removes ~20/min.
		//
		// Lower this number as those land. Never raise it without knowing that
		// simultaneous players drop in direct proportion.
		expect(total).toBeLessThanOrEqual(44);
	}, 60_000);
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';
import { completionTracks, meanCompletion } from '../../src/completion';

// The completion ("perfection") tally, end to end.
//
// GET /Metrics/<id> now reports where a save sits on each of the ten completion
// tracks, so the dashboard can see where preserves stall. The number it reports
// has to be the number the caretaker is looking at in their own Achievements
// menu — and the only way to prove that is to compute the panel's answer from
// the panel's actual inputs (GameData + GameState, exactly what the client
// holds) and check the server agrees.
//
// That is what the first test does, and it is the one that matters: everything
// else here could pass while the dashboard quietly reported a different game.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const RES = meadowResource();

/** What the Completion tab would draw for this save, from the client's inputs. */
async function asThePanelSeesIt(playerId: string) {
	const data = await w.get<any>('GameData');
	const state = await w.get<any>('GameState', playerId);
	const tracks = completionTracks(data, state);
	return {
		overallPct: Math.round(meanCompletion(tracks) * 100),
		byId: Object.fromEntries(tracks.map((t) => [t.id, { cur: t.cur, target: t.target }])),
	};
}

describe('completion metrics', () => {
	it('reports the same figures the caretaker sees in their own menu', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Ada', passcode: '1234', appearance });
		// Do a little of everything the tracker counts, so the comparison is made
		// against a save that is part-way down several tracks rather than at 0.
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });

		const panel = await asThePanelSeesIt(playerId);
		const { player } = await w.get<any>('Metrics', playerId);

		expect(player.completion).toBeTruthy();
		expect(player.completion.overallPct).toBe(panel.overallPct);
		for (const [id, expected] of Object.entries(panel.byId)) {
			const got = player.completion.tracks[id];
			expect(`${id}: ${got.cur}/${got.target}`).toBe(`${id}: ${expected.cur}/${expected.target}`);
		}
	});

	it('measures every track against a non-empty whole, and rounds each to a percent', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Bea', passcode: '1234', appearance });
		const { player } = await w.get<any>('Metrics', playerId);
		const tracks = player.completion.tracks;
		expect(Object.keys(tracks).length).toBe(player.completion.tracksTotal);
		for (const [id, t] of Object.entries<any>(tracks)) {
			// A track measured against 0 would read 0% forever and drag the headline
			// down for everyone.
			expect(`${id}: ${t.target}`).not.toBe(`${id}: 0`);
			expect(t.pct).toBe(Math.round(Math.min(1, t.cur / t.target) * 100));
		}
	});

	it('starts a fresh save with one area open and nothing finished', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Cy', passcode: '1234', appearance });
		const { player } = await w.get<any>('Metrics', playerId);
		expect(player.completion.tracks.areas.cur).toBe(1); // the meadow, and only the meadow
		expect(player.completion.tracks.animals.cur).toBe(0);
		expect(player.completion.tracks.home.cur).toBe(0); // a canvas tent is not a house yet
		expect(player.completion.tracksDone).toBe(0);
		expect(player.completion.overallPct).toBeLessThan(20);
	});

	it('moves the recipe track when something is crafted for the first time', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Dee', passcode: '1234', appearance });
		const before = (await w.get<any>('Metrics', playerId)).player.completion.tracks.recipes.cur;
		// craftedEver is what the track counts, so a direct patch is the same
		// evidence a real craft would leave — and it keeps this test about the
		// tally rather than about the crafting rules.
		const p = await w.db.Player.get(playerId);
		await w.db.Player.patch(playerId, { craftedEver: { ...(p.craftedEver || {}), 'grass-patch': 1 } });
		const after = (await w.get<any>('Metrics', playerId)).player.completion.tracks.recipes.cur;
		expect(after).toBe(before + 1);
	});
});

/* The dashboard half: how ten saves' worth of tallies roll up.
 *
 * The per-track table is the part with real logic in it, and it is the part
 * worth pinning — a mean over a map, a finish count, and a sort. It is also the
 * part that has to survive a mixed population: saves from a build that predates
 * the tracker carry no block at all, and counting those as 0% would drag the
 * average down every time an old copy checked in. */
describe('the completion roll-up', () => {
	const withCompletion = (overallPct: number, tracks: Record<string, [number, number]>) => ({
		name: 'Solo',
		playSeconds: 600,
		sessions: 1,
		totalActions: 20,
		lastSeenAt: Date.now(),
		completion: {
			overallPct,
			tracksDone: Object.values(tracks).filter(([cur, target]) => cur >= target).length,
			tracksTotal: Object.keys(tracks).length,
			tracks: Object.fromEntries(
				Object.entries(tracks).map(([id, [cur, target]]) => [
					id,
					{ cur, target, pct: Math.round((cur / target) * 100) },
				]),
			),
		},
	});

	async function uplink(clientId: string, snapshot: any) {
		await w.post('SyncMetrics', {
			clientId,
			name: clientId,
			platform: 'desktop',
			os: 'mac',
			version: '0.3.0',
			snapshot,
		});
	}

	it('averages the headlines, counts the finishers, and leads with the coldest track', async () => {
		// Two saves that have done well on `areas` and badly on `recipes`, plus one
		// old save with no block at all.
		await uplink('a', withCompletion(50, { areas: [6, 6], recipes: [10, 100] }));
		await uplink('b', withCompletion(30, { areas: [3, 6], recipes: [0, 100] }));
		await uplink('legacy', { name: 'legacy', playSeconds: 600, sessions: 1, lastSeenAt: Date.now() });

		const c = (await w.get<any>('MetricsSummary')).summary.completion;
		expect(c.players).toBe(2);
		// The save without a tally is named, not counted as a zero.
		expect(c.notMeasured).toBe(1);
		expect(c.avgOverallPct).toBe(40);
		expect(c.medianOverallPct).toBe(40);

		// Coldest first: recipes (5% average) leads, areas (75%) follows.
		expect(c.tracks.map((t: any) => t.id)).toEqual(['recipes', 'areas']);
		expect(c.tracks[0]).toMatchObject({ id: 'recipes', avgPct: 5, finished: 0, finishedPct: 0 });
		// One of the two finished `areas`, which is the figure that separates
		// "everyone makes progress here" from "anyone actually completes it".
		expect(c.tracks[1]).toMatchObject({ id: 'areas', avgPct: 75, finished: 1, finishedPct: 50 });
	});

	it('gives a finished preserve its own histogram column', async () => {
		await uplink('done', withCompletion(100, { areas: [6, 6], recipes: [100, 100] }));
		await uplink('nearly', withCompletion(99, { areas: [6, 6], recipes: [98, 100] }));

		const c = (await w.get<any>('MetricsSummary')).summary.completion;
		expect(c.fullyComplete).toBe(1);
		expect(c.histogram['100']).toBe(1);
		expect(c.histogram['90-99']).toBe(1);
		expect(c.bestOverallPct).toBe(100);
	});
});

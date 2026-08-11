import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, loadServer, appearance, type World } from './harness';

// The metrics endpoint used to answer GET /Metrics/ with the global aggregates
// AND a full record for every reporting player — names, exact first/last activity,
// OS, accessibility preferences, appearance, behaviour — publicly, in one ~1 MB
// response of which 98.6% was the player array.
//
// It is three endpoints now:
//   GET /Metrics/<playerId>         public, unchanged — a client's own view
//   GET /MetricsSummary/            admin — aggregates only
//   GET /MetricsPlayers/            admin — rows, paginated
//
// These tests pin the split itself: the old URL no longer serves anybody's data,
// the two halves agree, paging is complete and doesn't repeat, and — the part
// that matters most — a row is still exactly the row the dashboard already knows
// how to render.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const snap = (over: any = {}) => ({
	name: 'Solo',
	playSeconds: 1200,
	sessions: 2,
	totalActions: 40,
	counts: { resourcesCollected: 40 },
	lastSeenAt: Date.now(),
	appearance,
	...over,
});

/** n saves, distinguishable by name and ordered by recency. */
async function seed(n: number) {
	const now = Date.now();
	for (let i = 0; i < n; i++) {
		await w.post('SyncMetrics', {
			clientId: `slot-${i}`,
			name: `Caretaker ${i}`,
			platform: 'desktop',
			os: 'mac',
			version: '0.3.0',
			// staggered so buildDashboardRows' sort (last seen desc) is deterministic
			snapshot: snap({ name: `Caretaker ${i}`, lastSeenAt: now - i * 1000 }),
		});
	}
}

describe('the public roll-up is gone', () => {
	it('answers GET /Metrics/ with a 404 signpost instead of every player record', async () => {
		await seed(3);
		const out = await w.get('Metrics');
		expect(out.status).toBe(404);
		// The whole point: no data comes back on this path any more.
		expect(out.players).toBeUndefined();
		expect(out.summary).toBeUndefined();
		const body = JSON.parse(out.body);
		expect(body.detail).toContain('/MetricsSummary/');
		expect(body.detail).toContain('/MetricsPlayers/');
	});

	it('still serves one player their own view at GET /Metrics/<id>', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Ada', passcode: '1234', appearance });
		const one = await w.get('Metrics', playerId);
		expect(one.player).toBeTruthy();
		expect(one.player.biomeSummary).toBeTruthy();
	});
});

describe('MetricsSummary', () => {
	it('returns the aggregates and NOT the player rows', async () => {
		await seed(5);
		const out = await w.get('MetricsSummary');
		expect(out.summary.players).toBe(5);
		// `players` here is a paging hint, not an array of people.
		expect(Array.isArray(out.players)).toBe(false);
		expect(out.players.total).toBe(5);
		expect(out.players.endpoint).toBe('/MetricsPlayers/');
		// Nothing in the summary should carry a display name.
		expect(JSON.stringify(out.summary)).not.toContain('Caretaker 0');
	});
});

describe('MetricsPlayers', () => {
	it('pages through every row exactly once, in order, then stops', async () => {
		await seed(7);
		const seen: string[] = [];
		let cursor: string | undefined;
		let pages = 0;
		for (;;) {
			const page: any = await w.get('MetricsPlayers', undefined, {
				limit: '3',
				...(cursor ? { cursor } : {}),
			});
			pages++;
			expect(page.total).toBe(7);
			seen.push(...page.players.map((p: any) => p.name));
			if (!page.nextCursor) break;
			cursor = page.nextCursor;
			expect(pages).toBeLessThan(10); // paging must terminate
		}
		expect(pages).toBe(3); // 3 + 3 + 1
		expect(seen).toHaveLength(7);
		expect(new Set(seen).size).toBe(7); // no row served twice
		// Recency order is preserved across the page boundary.
		expect(seen[0]).toBe('Caretaker 0');
		expect(seen[6]).toBe('Caretaker 6');
	});

	it('clamps an absurd ?limit rather than serving the whole table', async () => {
		await seed(2);
		const page = await w.get('MetricsPlayers', undefined, { limit: '99999' });
		expect(page.limit).toBeLessThanOrEqual(500);
		expect(page.returned).toBe(2);
	});

	it('restarts rather than skipping rows when a cursor goes stale', async () => {
		await seed(2);
		// base64url of 'solo:nobody' — a row that is not in this world. Written as a
		// literal because this project ships no @types/node, so `Buffer` is untyped here.
		const bogus = 'c29sbzpub2JvZHk';
		const page = await w.get('MetricsPlayers', undefined, { cursor: bogus });
		expect(page.cursorStale).toBe(true);
		expect(page.players).toHaveLength(2); // nothing silently dropped
	});

	it('keeps the row shape the dashboard already renders', async () => {
		await seed(1);
		const p = (await w.get('MetricsPlayers')).players[0];
		// Everything public/dashboard.html reads off a player, still present.
		for (const key of [
			'playerId',
			'name',
			'playSeconds',
			'playMinutes',
			'avgSessionMinutes',
			'sessions',
			'totalActions',
			'unlockedBiomes',
			'tutorialStep',
			'activation',
			'achievements',
			'biomeSummary',
			'areaSeconds',
			'creationSeconds',
			'timeToFirstActionSeconds',
			'appearance',
			'daysSinceJoined',
			'hoursSinceActive',
			'minutesSinceActive',
			'status',
			'idle',
			'counts',
			'platform',
			'os',
			'version',
			'language',
		]) {
			expect(p).toHaveProperty(key);
		}
	});

	it('serves one full row by id', async () => {
		await seed(2);
		const one = await w.get('MetricsPlayers', 'solo:slot-1');
		expect(one.player.name).toBe('Caretaker 1');
	});

	it('offers a lean list shape for callers that only draw a table', async () => {
		await seed(1);
		const lean = (await w.get('MetricsPlayers', undefined, { fields: 'list' })).players[0];
		expect(lean.name).toBe('Caretaker 0');
		expect(lean.playSeconds).toBe(1200);
		// the bulky per-player blocks are the ones left out
		expect(lean.counts).toBeUndefined();
		expect(lean.areaSeconds).toBeUndefined();
		expect(lean.prefs).toBeUndefined();
	});
});

describe('keeping your own machine out of the acquisition funnel', () => {
	// ?exclude=<name> drops SAVES. The acquisition funnel reads AppOpen — one row
	// per install, with no save name on it — so a developer's own launches kept
	// counting as app opens and nothing could filter them. ?excludeDevice= is the
	// device-side twin.
	beforeEach(async () => {
		for (let i = 0; i < 40; i++)
			await w.post('AppOpen', { deviceId: 'mine', phase: 'open', platform: 'desktop', os: 'mac' });
		await w.post('AppOpen', { deviceId: 'mine', phase: 'created', creationMs: 3000 });
		await w.post('AppOpen', { deviceId: 'mine', phase: 'created', creationMs: 3000 });
		await w.post('AppOpen', { deviceId: 'player-a', phase: 'open', platform: 'desktop', os: 'windows' });
		await w.post('AppOpen', { deviceId: 'player-a', phase: 'created', creationMs: 9000 });
		await w.post('AppOpen', { deviceId: 'player-b', phase: 'open', platform: 'web', os: 'linux' });
	});

	it('shows how badly one machine can distort raw opens', async () => {
		const a = (await w.get('MetricsSummary')).summary.acquisition;
		expect(a.devices).toBe(3);
		// 40 of 42 opens are one person — and `devices` only moved by one, which is
		// why this went unnoticed.
		expect(a.totalOpens).toBe(42);
		expect(a.totalCharactersCreated).toBe(3);
	});

	it('drops a device and everything it contributed', async () => {
		const a = (await w.get('MetricsSummary', undefined, { excludeDevice: 'mine' })).summary.acquisition;
		expect(a.devices).toBe(2);
		expect(a.totalOpens).toBe(2);
		expect(a.totalCharactersCreated).toBe(1);
		expect(a.conversionPct).toBe(50); // recomputed over what's left
		// and it says what it took, rather than just being quietly smaller
		expect(a.excludedDevices).toMatchObject({ matched: 1, opens: 40, charactersCreated: 2 });
	});

	it('still lists a hidden device so it can be un-hidden', async () => {
		const a = (await w.get('MetricsSummary', undefined, { excludeDevice: 'mine' })).summary.acquisition;
		expect(a.deviceRoster).toHaveLength(3);
		// busiest first, so your own machine is the easy one to spot
		expect(a.deviceRoster[0].deviceId).toBe('mine');
		expect(a.deviceRoster[0].excluded).toBe(true);
		expect(a.deviceRoster[1].excluded).toBe(false);
	});

	it('accepts the filter comma-separated or repeated, like ?exclude=', async () => {
		const csv = await w.get('MetricsSummary', undefined, { excludeDevice: 'mine,player-b' });
		expect(csv.summary.acquisition.devices).toBe(1);
		const rep = await w.get('MetricsSummary', undefined, { excludeDevice: ['mine', 'player-b'] });
		expect(rep.summary.acquisition.devices).toBe(1);
	});

	it('leaves the save-side population alone', async () => {
		await w.post('SyncMetrics', { clientId: 'slot-1', name: 'Real', snapshot: snap({ name: 'Real' }) });
		const s = (await w.get('MetricsSummary', undefined, { excludeDevice: 'mine' })).summary;
		expect(s.excludedDevices).toEqual(['mine']);
		expect(s.players).toBe(1); // device exclusion is not save exclusion
	});
});

describe('who is public and who is not', () => {
	// PublicEndpoint overrides allowRead() to return true. An admin endpoint defines
	// no allowRead at all, so Harper's default — authenticated super user — applies.
	// That presence-or-absence IS the access control, which makes it worth asserting
	// directly: this is the test that fails if someone later "tidies" one of these
	// classes back onto PublicEndpoint and quietly republishes it.
	const isPublic = (cls: any) =>
		typeof cls?.prototype?.allowRead === 'function' && cls.prototype.allowRead() === true;

	it('leaves the endpoints clients actually call public', async () => {
		const mod = await loadServer();
		for (const name of ['Metrics', 'SyncMetrics', 'SubmitFeedback', 'GameData', 'LandingEvent']) {
			expect(isPublic(mod[name]), name).toBe(true);
		}
		// the marketing + policy pages App Store Connect links to
		expect(isPublic(mod['']), 'landing page').toBe(true);
		expect(isPublic(mod['privacy']), 'privacy page').toBe(true);
	});

	it('puts every dashboard feed behind admin auth', async () => {
		const mod = await loadServer();
		for (const name of [
			'MetricsSummary',
			'MetricsPlayers',
			'SaveHealth', // recent[].recordId is a real save UUID — the capability other endpoints trust
			'GameplayHealth',
			'LandingStats',
			'ListFeedback', // the pre-existing precedent this all copies
		]) {
			expect(isPublic(mod[name]), name).toBe(false);
		}
		expect(isPublic(mod['dashboard']), 'dashboard page').toBe(false);
	});
});

describe('aggregates that used to mislead', () => {
	it('says how much of the session population its length buckets cover', async () => {
		// Two saves reporting 6 sessions between them, but only 3 bucketed lengths.
		await w.post('SyncMetrics', {
			clientId: 'slot-a',
			name: 'A',
			snapshot: snap({ name: 'A', sessions: 3, sessionLengths: { '2-10m': 2 } }),
		});
		await w.post('SyncMetrics', {
			clientId: 'slot-b',
			name: 'B',
			snapshot: snap({ name: 'B', sessions: 3 }), // older client: no lengths at all
		});

		const s = (await w.get('MetricsSummary')).summary;
		// The old field is untouched, so nothing reading it breaks...
		expect(s.sessionLengthDistribution['2-10m']).toBe(2);
		// ...and the coverage it was always missing sits next to it.
		expect(s.sessionLengths.sessionsCovered).toBe(2);
		expect(s.sessionLengths.totalSessions).toBe(6);
		expect(s.sessionLengths.savesReporting).toBe(1);
		expect(s.sessionLengths.coveragePct).toBe(33);
	});

	it('reports a median time-to-first-action the walked-away saves cannot move', async () => {
		// Four real first actions in seconds, one save left open for three hours.
		const times = [6, 14, 20, 26, 10800];
		for (let i = 0; i < times.length; i++) {
			await w.post('SyncMetrics', {
				clientId: `slot-${i}`,
				name: `T${i}`,
				snapshot: snap({ name: `T${i}`, timeToFirstActionSeconds: times[i] }),
			});
		}

		const ttfa = (await w.get('MetricsSummary')).summary.timeToFirstAction;
		expect(ttfa.playersMeasured).toBe(5);
		// The mean keeps its old meaning — and shows exactly why it was unusable.
		expect(ttfa.avgSeconds).toBe(2173.2);
		// The median is what onboarding actually looks like.
		expect(ttfa.medianSeconds).toBe(20);
		expect(ttfa.trimmedAvgSeconds).toBe(16.5);
		// And the exclusion is stated, not silent.
		expect(ttfa.outliersExcluded).toBe(1);
	});
});

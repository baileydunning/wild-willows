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

describe('the per-day series', () => {
	const DAY = 86_400_000;
	// Mid-day UTC on purpose: a timestamp near midnight would hide a timezone slip
	// in the day bucketing.
	const base = Date.UTC(2026, 6, 1, 12);

	beforeEach(async () => {
		for (const [i, offset] of [0, 0, 3].entries()) {
			await w.post('SyncMetrics', {
				clientId: `slot-${i}`,
				name: `C${i}`,
				snapshot: snap({ name: `C${i}`, createdAt: base + offset * DAY, lastSeenAt: base + 3 * DAY }),
			});
		}
	});

	it('returns a DENSE range — a day with nobody is a zero, not a gap', async () => {
		const d = (await w.get('MetricsSummary')).summary.daily;
		// Skipping empty days would draw a busier game than exists.
		expect(d.days.map((x: any) => x.day)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
		expect(d.days.map((x: any) => x.created)).toEqual([2, 0, 0, 1]);
		expect(d.firstDay).toBe('2026-07-01');
		expect(d.lastDay).toBe('2026-07-04');
	});

	it('does not pretend lastSeen is daily actives', async () => {
		const d = (await w.get('MetricsSummary')).summary.daily;
		// All three saves were active on day 3 and only day 3 is credited — a save
		// carries ONE lastSeenAt, so the days they played before are unrecoverable.
		// The field is named and annotated for that, rather than charted as DAU.
		expect(d.days.map((x: any) => x.lastSeen)).toEqual([0, 0, 0, 3]);
		expect(d.note).toContain('not daily active players');
	});
});

describe('demo → full carry-over', () => {
	// ExportDemoSave used to do exactly one thing: flip edition to 'full'. That
	// erased the most interesting event in the save's life — after import it looked
	// identical to one that started in the full game, so "played the demo, bought
	// the game, brought their meadow across" left no trace at all.
	//
	// Two mechanisms now, because one of them has to work backwards: the export
	// stamps the save, AND the roll-up pairs an imported save with its original
	// demo row (importing mints a new slot id, so both rows exist and share the
	// save's own id). The pairing is what makes conversions that already happened
	// visible without a client update.
	const SAVE_ID = 'willow-a1b2c3';

	it('spots a carry-over that predates the stamp, by pairing the two rows', async () => {
		await w.post('SyncMetrics', {
			clientId: 'demo-slot',
			name: 'Willow',
			snapshot: snap({
				playerId: SAVE_ID,
				name: 'Willow',
				edition: 'demo',
				playSeconds: 6360, // 1h 46m in the demo
				sessions: 1,
				lastSeenAt: Date.now() - 86_400_000,
			}),
		});
		await w.post('SyncMetrics', {
			clientId: 'full-slot',
			name: 'Willow',
			snapshot: snap({ playerId: SAVE_ID, name: 'Willow', edition: 'full', playSeconds: 8100, sessions: 2 }),
		});
		await w.post('SyncMetrics', {
			clientId: 'other',
			name: 'Fern',
			snapshot: snap({ playerId: 'fern-z9y8x7', name: 'Fern', edition: 'full' }),
		});

		const rows = (await w.get('MetricsPlayers')).players;
		const full = rows.find((r: any) => r.savePlayerId === SAVE_ID && r.edition === 'full');
		const demo = rows.find((r: any) => r.savePlayerId === SAVE_ID && r.edition === 'demo');

		expect(full.convertedFromDemo).toBe(true);
		expect(full.conversion.source).toBe('paired-demo-save');
		// An inferred date is labelled inferred rather than presented as a timestamp.
		expect(full.conversion.exact).toBe(false);
		expect(full.conversion.demoPlaySeconds).toBe(6360);
		// The demo original is marked, not deleted — both rows are real uplinks.
		expect(demo.supersededByFull).toBe(true);
		expect(demo.convertedFromDemo).toBe(false);
		expect(rows.find((r: any) => r.savePlayerId === 'fern-z9y8x7').convertedFromDemo).toBe(false);

		const c = (await w.get('MetricsSummary')).summary.conversions;
		expect(c).toMatchObject({
			demoToFull: 1,
			inferred: 1,
			stamped: 0,
			demoSavesSeen: 1, // the pair counts once, not twice
			ratePct: 100,
			avgDemoMinutesBeforeBuying: 106,
			supersededDemoSaves: 1,
		});
	});

	it('stamps the export so the save knows its own history from then on', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Sage', passcode: '1234', appearance });
		expect((await w.get('Metrics', playerId)).player.convertedFromDemoAt).toBeNull();

		const t = w.db.Player;
		const row: any = await t.get(playerId);
		const m = JSON.parse(row.metrics);
		await t.patch(playerId, { metrics: JSON.stringify({ ...m, edition: 'demo', playSeconds: 900, sessions: 3 }) });

		const out = await w.post('ExportDemoSave', { playerId });
		const exported = JSON.parse(out.data.Player[0].metrics);
		expect(exported.edition).toBe('full');
		expect(exported.convertedFromDemoAt).toBeGreaterThan(0);
		expect(exported.demoPlaySeconds).toBe(900);
		expect(exported.demoSessions).toBe(3);

		// and it rides through metricsView into what the client uplinks
		await t.patch(playerId, { metrics: JSON.stringify(exported) });
		const view = await w.get('Metrics', playerId);
		expect(view.player.convertedFromDemoAt).toBeGreaterThan(0);
		expect(view.player.demoPlaySeconds).toBe(900);
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

	it('no longer ships a device roster, and reports what it excluded instead', async () => {
		// There used to be a `deviceRoster` here: every device, busiest first, each
		// flagged excluded or not, so the dashboard could offer a picker for hiding
		// your own machine. The picker is gone — raw app opens came off the page
		// entirely, which removes the distortion rather than filtering around it —
		// and the roster went with it rather than being built into every response
		// for nobody. What stands in its place is the report stating what the
		// filter took, so a hidden device is still accounted for without
		// enumerating every device that ever opened the game to do it.
		const a = (await w.get('MetricsSummary', undefined, { excludeDevice: 'mine' })).summary.acquisition;
		expect(a.deviceRoster).toBeUndefined();
		expect(a.excludedDevices).toMatchObject({ ids: ['mine'], matched: 1, opens: 40 });
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
	const isPublic = (cls: any) => typeof cls?.prototype?.allowRead === 'function' && cls.prototype.allowRead() === true;

	it('leaves the endpoints clients actually call public', async () => {
		const mod = await loadServer();
		for (const name of ['Metrics', 'SyncMetrics', 'SubmitFeedback', 'GameData', 'LandingEvent']) {
			expect(isPublic(mod[name]), name).toBe(true);
		}
		// the marketing + policy pages App Store Connect links to
		expect(isPublic(mod['']), 'landing page').toBe(true);
		expect(isPublic(mod['privacy']), 'privacy page').toBe(true);
		// And the dashboard SHELL, deliberately: a login form cannot live behind the
		// thing it logs you into. It ships no data; the endpoints are the boundary.
		expect(isPublic(mod['dashboard']), 'dashboard page').toBe(true);
	});

	it('puts every dashboard feed behind auth', async () => {
		const mod = await loadServer();
		for (const name of [
			'DashboardAuth',
			'MetricsSummary',
			'MetricsPlayers',
			'SaveHealth', // recent[].recordId is a real save UUID — the capability other endpoints trust
			'GameplayHealth',
			'LandingStats',
			'ListFeedback', // the pre-existing precedent this all copies
			'SystemProbe', // reconnaissance on Harper's own telemetry — never public
		]) {
			expect(isPublic(mod[name]), name).toBe(false);
		}
	});

	describe('the role gate', () => {
		const FEEDS = ['DashboardAuth', 'MetricsSummary', 'MetricsPlayers', 'SaveHealth', 'GameplayHealth', 'LandingStats'];
		const asUser = (role: string, sup = false) => ({
			username: 'u',
			role: sup ? { role, permission: { super_user: true } } : { role },
		});

		// The case that matters most. Auth code written against a guessed user shape
		// fails by denying everyone (visible immediately) or admitting everyone
		// (visible never) — so pin the second one down.
		it('refuses anyone it cannot identify', async () => {
			const mod = await loadServer();
			for (const name of FEEDS) {
				for (const [label, user] of [
					['no user at all', undefined],
					['null', null],
					['empty object', {}],
					['a role object with no role name', { username: 'u', role: {} }],
					['some unrelated role', asUser('cluster_user')],
				] as const) {
					expect(mod[name].prototype.allowRead(user), `${name} · ${label}`).toBe(false);
				}
			}
		});

		it('admits super-user and the read-only dashboard role', async () => {
			const mod = await loadServer();
			for (const name of FEEDS) {
				expect(mod[name].prototype.allowRead(asUser('super_user', true)), `${name} · super_user flag`).toBe(true);
				expect(mod[name].prototype.allowRead(asUser('super_user')), `${name} · super_user name`).toBe(true);
				expect(mod[name].prototype.allowRead(asUser('metrics_reader')), `${name} · metrics_reader`).toBe(true);
				// Harper's user object is not documented; tolerate a bare string role.
				expect(mod[name].prototype.allowRead({ username: 'u', role: 'metrics_reader' }), `${name} · string role`).toBe(
					true,
				);
			}
		});

		it('grants no writes to anybody', async () => {
			const mod = await loadServer();
			for (const name of FEEDS) {
				expect(mod[name].prototype.allowCreate(), name).toBe(false);
				expect(mod[name].prototype.allowUpdate(), name).toBe(false);
				expect(mod[name].prototype.allowDelete(), name).toBe(false);
			}
		});

		it('keeps emails and server internals on the real super-user key', async () => {
			const mod = await loadServer();
			// No allowRead override at all — these defer entirely to Harper, so the
			// read-only dashboard role cannot reach them.
			for (const name of ['ListFeedback', 'SystemProbe']) {
				expect(typeof mod[name].prototype.allowRead, name).toBe('undefined');
			}
		});
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

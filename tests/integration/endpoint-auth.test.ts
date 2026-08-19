import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, loadServer, type World } from './harness';

// Who can reach what — asserted through DISPATCH, and asserted for EVERY
// endpoint rather than a hand-picked few.
//
// tests/integration/metrics-split.test.ts already checks the access rules on the
// dashboard feeds, but it does it by calling `allowRead(user)` on the prototype
// and reading the return value. That is a test of the predicate, not of the
// protection, and the two are not the same thing: an endpoint whose hook
// correctly returns false is still wide open if nothing consults the hook, and
// that assertion passes either way. It also only covers the names somebody
// remembered to list, so a new endpoint is unguarded by default — which is the
// wrong default for the thing standing between anonymous traffic and every
// player's telemetry.
//
// This file adds the two halves that were missing:
//
//   1. Dispatch. `w.as(user)` consults the hook before the handler runs and
//      throws when it says no, so what is asserted is "the request is refused",
//      not "a function returned false". If the app ever moves off allowRead —
//      Harper 5.2 deprecates all four hooks in favour of operation overrides —
//      these tests keep describing the requirement instead of the mechanism.
//
//   2. Completeness. Every exported endpoint is classified against an explicit
//      list below. Add an endpoint and this file fails until you have said, in
//      writing, which side of the boundary it is on.
//
// What none of this can prove is that HARPER still calls the hooks. That is a
// property of the server, not of this code, and it is exactly what the 5.2
// deprecation puts at risk — those hooks fail OPEN, so the day they stop being
// consulted the dashboard feeds become readable and every test here stays
// green. That check has to run against a live instance.

/** The endpoints that must NEVER answer an anonymous request. */
const ADMIN = [
	'ClearProblem',
	'DashboardAuth',
	'DeleteSoloMetrics',
	'GameplayHealth',
	'LandingStats',
	// Counts only, and it stayed harmless when it was public — but how the
	// classroom kit is doing is a business metric, not something to hand to
	// anyone who asks. Same call as LandingStats.
	'LessonStats',
	'ListFeedback', // no hook at all — Harper's super-user default IS its protection
	'MetricsPlayers',
	'MetricsSummary',
	'SaveHealth', // recent[].recordId is a real save id — a capability, not a statistic
	'ServerHealth',
	'SystemProbe', // same "no hook" protection as ListFeedback
];

/** Everything deliberately reachable without credentials. Grouped so the list
 *  can be reviewed as a security decision rather than skimmed as a wall. */
const PUBLIC = [
	// --- session + save management. Guarded by passcode INSIDE the handler, not
	// by the endpoint being closed — the game has no login before you log in.
	'CreatePlayer',
	'LoginPlayer',
	'ChangePasscode',
	'DeletePlayer',
	'MyWorlds',
	'GameState',
	'ExportDemoSave',
	'DeleteDemoSave',

	// --- gameplay. Every one of these mutates a world, and every one is reachable
	// with nothing but a player id. That is the game's actual security model: ids
	// are the capability. Worth re-reading whenever a new one is added here.
	'AppendFeed',
	'ChestTransfer',
	'ClaimTask',
	'CollectResource',
	'CraftItem',
	'DiscardItem',
	'HarvestPlacement',
	'MoveObject',
	'ObserveAnimal',
	'PlaceObject',
	'Plant',
	'RecalcBiome',
	'RemoveObject',
	'Rest',
	'SetGoals',
	'SetHomeColors',
	'SetHomeStyle',
	'SetPlacementColor',
	'SyncPlayer',
	'Terraform',
	'UpdateAppearance',
	'UpgradeHome',
	'UpgradeTool',
	'Heartbeat',

	// --- DevTools is reachable without credentials, but it is no longer OPEN: it
	// refuses any save whose name is not `bailey_test` (DEV_PLAYER_SLUG in
	// server/resources.ts). It sits in this list because this suite classifies
	// endpoints by which side of the AUTH boundary they are on, and DevTools is
	// still on the public side — the gate is a check inside the handler, not a
	// Harper permission. The gate itself is covered in dev-populate.test.ts.
	//
	// It used to be genuinely open: a constant said dev tools were restricted to
	// one save and nothing referenced it, so anyone holding a player id could
	// grant resources, unlock biomes, or wipe a world — and CreatePlayer hands out
	// player ids to anyone who asks.
	'DevTools',

	// --- telemetry the client writes. Anonymous by design, aggregate on read.
	'AppOpen',
	'Metrics',
	'SyncMetrics',
	'SubmitFeedback',
	'LandingEvent',
	// The classroom pages' anonymous counter beacon. Public for the same reason
	// LandingEvent is: the pages have to be able to write to it, and it accepts
	// nothing but allowlisted counter names. See LESSON_EXACT in resources.ts.
	'LessonEvent',
	'ReportClientError',
	'ReportSaveIncident',

	// --- content + static pages the stores and search engines fetch.
	'GameData',
	'Version',
	'home',
	'privacy',
	'age-rating',
	'support',
	'teachers',
	'learn', // /learn/<slug> — the classroom student pages
	'developers', // /developers and /developers/api — the public-API documentation
	'dashboard', // the SHELL only: a login form cannot live behind the login
	'og-image',
	'favicon',
	'img',
	'theme',
	'robots',
	'robots.txt',
	'sitemap',
	'sitemap.xml',
	'educator-guide',
	'educator-guide.pdf',
	'student-worksheets',
	'student-worksheets.pdf',
];

const anonymous = [
	['no user at all', undefined],
	['null', null],
	['an empty object', {}],
	['a user with no role', { username: 'u' }],
	['a role object with no role name', { username: 'u', role: {} }],
	['an unrelated role', { username: 'u', role: { role: 'cluster_user' } }],
] as const;

const superUser = { username: 'admin', role: { role: 'super_user', permission: { super_user: true } } };
const readOnly = { username: 'viewer', role: { role: 'metrics_reader' } };

/** Every exported class that answers a request. */
async function endpointNames(): Promise<string[]> {
	const mod = await loadServer();
	return Object.keys(mod)
		.filter((n) => {
			const v = (mod as any)[n];
			return (
				typeof v === 'function' &&
				v.prototype &&
				(typeof v.prototype.get === 'function' || typeof v.prototype.post === 'function')
			);
		})
		.sort();
}

describe('every endpoint is classified', () => {
	// The check that makes the two lists above load-bearing instead of
	// decorative. Without it they are a snapshot of the day they were written.
	it('accounts for every exported endpoint, with nothing left over', async () => {
		const declared = new Set([...ADMIN, ...PUBLIC]);
		const actual = await endpointNames();

		const unclassified = actual.filter((n) => !declared.has(n));
		expect(
			unclassified,
			'New endpoint(s) with no entry in ADMIN or PUBLIC. Decide which side of the auth boundary each one is on and add it — do not delete this assertion.',
		).toEqual([]);

		const stale = [...declared].filter((n) => !actual.includes(n));
		expect(stale, 'Listed here but no longer exported — remove from the list.').toEqual([]);
	});

	it('has not quietly republished an admin endpoint', async () => {
		const mod = await loadServer();
		for (const name of ADMIN) {
			const hook = (mod as any)[name]?.prototype?.allowRead;
			const openedUp = typeof hook === 'function' && hook.call((mod as any)[name].prototype) === true;
			expect(openedUp, `${name} is answering anonymous reads — it is in the ADMIN list`).toBe(false);
		}
	});
});

describe('dispatching as a user', () => {
	let w: World;
	beforeEach(async () => {
		w = await freshWorld();
	});

	it('refuses every admin endpoint to anyone it cannot identify', async () => {
		for (const name of ADMIN) {
			for (const [label, user] of anonymous) {
				await expect(
					Promise.resolve().then(() => w.as(user).get(name)),
					`${name} · ${label}`,
				).rejects.toThrow(/Not authorized/);
			}
		}
	});

	it('lets a super user through the same door', async () => {
		// The negative test above passes just as well against an endpoint that is
		// broken for everyone, so pin the positive case too.
		const out = await w.as(superUser).get('MetricsSummary');
		expect(out.summary).toBeTruthy();
	});

	it('lets the read-only dashboard role read but not destroy', async () => {
		const out = await w.as(readOnly).get('MetricsSummary');
		expect(out.summary).toBeTruthy();
		// metrics_reader exists so the dashboard can be handed out without handing
		// out deletion — "the worst case is a credential rotating and nothing worse".
		await expect(
			Promise.resolve().then(() => w.as(readOnly).post('DeleteSoloMetrics', { ids: ['anything'] })),
		).rejects.toThrow(/Not authorized/);
	});

	it('still serves the public endpoints to nobody in particular', async () => {
		const data = await w.as(undefined).get('GameData');
		expect(data.animals.length).toBeGreaterThan(0);
		const version = await w.as(null).get('Version');
		expect(version).toBeTruthy();
	});

	it('keeps the dashboard shell reachable while its data is not', async () => {
		// A login form behind the thing it logs you into is a locked room with the
		// key inside. The page ships no data; the endpoints are the boundary.
		await expect(Promise.resolve().then(() => w.as(undefined).get('dashboard'))).resolves.toBeTruthy();
		await expect(Promise.resolve().then(() => w.as(undefined).get('MetricsSummary'))).rejects.toThrow(/Not authorized/);
	});
});

// Wild Willows — server: endpoints-telemetry
//
// Anonymous telemetry and its dashboards: feedback, the solo metrics uplink, the
// app-open funnel, landing-page analytics, client error and save incident
// reports, and the classroom lesson counters.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';

import { GameError, bumpDay, clamp, db, flushRefusals, hash32, sumValues } from './core';
import { RollupCache, allOf, findCounterRow, safeGet } from './store';
import { bodyOf } from './rate-limit';
import { DashboardEndpoint, PublicEndpoint, isSuperUser } from './endpoints-game';
import { appOpenCache, dashboardCache, queryOne } from './endpoints-metrics';

// ---------------------------------------------------------------- feedback
// Player feedback flows: client → POST /SubmitFeedback/ (always over the
// network to the hosted Harper, even from solo desktop builds — the client
// keeps an offline queue in localStorage and retries at session start until
// this returns ok) → stored in the Feedback table. The developer reads it
// back with GET /ListFeedback/, which requires Harper admin auth:
//   curl -u HDB_ADMIN https://wild.willows.harperfabric.com/ListFeedback/

const FEEDBACK_MAX_CHARS = 4000;

/**
 * POST /SubmitFeedback/ {message, replyTo?, metrics?, queuedAt?} — store the
 * feedback. Returns ok:true once the row is durably stored, which is the
 * client's cue to drop its local offline-queue copy.
 */
/** Caps on the diagnostic blob attached to a piece of feedback. */
const FEEDBACK_METRICS_MAX_KEYS = 40;
const FEEDBACK_METRICS_MAX_VALUE_CHARS = 500;

/**
 * Flatten the client's diagnostic context into a bounded, all-scalar map.
 *
 * This was the one place in the file where a client-supplied OBJECT was stored
 * verbatim. `message` was capped at 4,000 characters and `replyTo` at 200, but
 * `metrics` had no byte cap, key cap or depth cap — so an anonymous POST could
 * write an arbitrarily large structure into the Feedback table permanently, and
 * ListFeedback later reads that table whole. Every sibling endpoint already does
 * something like this (SyncMetrics measures its snapshot, LandingEvent rebuilds
 * counters through an allowlist); feedback was simply missed.
 *
 * Scalars only, and stringified: gatherFeedbackMetrics in src/feedback.ts sends a
 * flat map of strings and numbers, so nothing real is lost, and a nested object
 * can no longer smuggle depth past the key cap. Anything dropped is dropped
 * silently on purpose — a player reporting a bug must not have the report
 * refused because their client sent one field too many.
 */
function sanitizeFeedbackMetrics(raw: any): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
	let kept = 0;
	for (const [k, v] of Object.entries(raw)) {
		if (kept >= FEEDBACK_METRICS_MAX_KEYS) break;
		if (v === null || v === undefined) continue;
		const t = typeof v;
		if (t !== 'string' && t !== 'number' && t !== 'boolean') continue;
		const key = String(k).slice(0, 60);
		if (!key) continue;
		// Numbers and booleans keep their type. Only strings need truncating, and
		// they are the only ones that can be large — stringifying everything was
		// tidier to write and quietly turned `playMinutes: 42` into `'42'` for
		// anything reading a feedback row back.
		out[key] = t === 'string' ? (v as string).slice(0, FEEDBACK_METRICS_MAX_VALUE_CHARS) : (v as number | boolean);
		kept++;
	}
	return out;
}

export class SubmitFeedback extends PublicEndpoint {
	static rateTier = 'report'; // writes a permanent row for an anonymous caller
	async post(data: any) {
		const body = await bodyOf(data, this);
		const message = String(body.message || '').trim();
		if (!message) throw new GameError(tr('server.err.feedbackEmpty'), 400, 'server.err.feedbackEmpty');
		if (message.length > FEEDBACK_MAX_CHARS)
			throw new GameError(
				tr('server.err.feedbackTooLong', { max: FEEDBACK_MAX_CHARS }),
				400,
				'server.err.feedbackTooLong',
			);
		const replyTo =
			String(body.replyTo || '')
				.trim()
				.slice(0, 200) || null;
		if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo))
			throw new GameError(tr('server.err.feedbackBadEmail'), 400, 'server.err.feedbackBadEmail');
		const metrics = sanitizeFeedbackMetrics(body.metrics);
		const queuedAt = Number(body.queuedAt) || null;

		const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
		await db().Feedback.put({ id, message, replyTo, metrics, queuedAt, createdAt: Date.now() });
		return { ok: true, id };
	}
}

/**
 * GET /ListFeedback/ — every piece of player feedback, newest first.
 *
 * Deliberately extends the raw Resource (NOT PublicEndpoint), so Harper's
 * default permissions apply: only an authenticated super user can read it.
 * Feedback rows carry players' reply emails, which must never be public.
 */
export class ListFeedback extends Resource {
	async get() {
		const rows = await allOf(db().Feedback);
		rows.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
		return { count: rows.length, feedback: rows };
	}
}

// ---------------------------------------------------------------- solo metrics uplink
// Solo runs entirely in-app against local save files, so its players never
// appear in the hosted Player table. The client periodically POSTs the local
// save's derived metrics view here (see src/solo/metricsUplink.ts) — best
// effort, whenever a connection exists — and the row is upserted per save
// slot. The global roll-up (/MetricsSummary/ + /MetricsPlayers/) then reports
// solo players alongside the hosted web ones.

const METRICS_SNAPSHOT_MAX_BYTES = 24_000;

/**
 * POST /SyncMetrics/ {clientId, name?, platform?, build?, snapshot} — upsert
 * one solo save's metrics view. `clientId` is the save slot's UUID, so the
 * same preserve updates the same row forever and renamed saves don't fork.
 */
export class SyncMetrics extends PublicEndpoint {
	static rateTier = 'telemetry'; // anonymous client telemetry
	async post(data: any) {
		const body = await bodyOf(data, this);
		const clientId = String(body.clientId || '')
			.trim()
			.slice(0, 64);
		if (!clientId) throw new GameError(tr('server.err.clientIdRequired'), 400, 'server.err.clientIdRequired');
		const snapshot =
			body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot) ? body.snapshot : null;
		if (!snapshot) throw new GameError(tr('server.err.snapshotRequired'), 400, 'server.err.snapshotRequired');
		// Store the metrics view as a JSON STRING, not a nested map: this table is
		// typed (positional structon encoding), which cannot safely hold a nested
		// object — a scalar string round-trips cleanly. Read back with JSON.parse
		// in the /MetricsSummary/ roll-up.
		const snapshotJson = JSON.stringify(snapshot);
		if (snapshotJson.length > METRICS_SNAPSHOT_MAX_BYTES)
			throw new GameError(tr('server.err.snapshotTooLarge'), 400, 'server.err.snapshotTooLarge');

		const t = db();
		const id = `solo:${clientId}`;
		const existing = await safeGet(t.SoloMetrics, id);
		await t.SoloMetrics.put({
			id,
			clientId,
			name: String(body.name || snapshot.name || '').slice(0, 40),
			platform: String(body.platform || '').slice(0, 20) || null, // desktop | web
			os: String(body.os || '').slice(0, 20) || null, // mac | windows | linux | …
			version: String(body.version || '').slice(0, 24) || null, // wild-willows release
			build: String(body.build || '').slice(0, 40) || null, // build timestamp
			language:
				String(body.language || snapshot.language || '')
					.trim()
					.toLowerCase()
					.slice(0, 12) || null, // interface language
			snapshot: snapshotJson,
			createdAt: existing?.createdAt || Date.now(),
			updatedAt: Date.now(),
		});
		dashboardCache.invalidate(); // new data landed — the next dashboard read refreshes
		return { ok: true };
	}
}

// ---------------------------------------------------------------- app-open funnel
// Acquisition tracking that does NOT need a save to exist: the client pings this
// the moment the app opens (phase "open") and again once a character is created
// (phase "created"). Rows are keyed per install/device, so /MetricsSummary/ can report
// how many people opened the app, how many created a character (vs bounced), the
// average time spent in the creator, and how many characters each person makes.

/**
 * POST /AppOpen/ {deviceId, phase?, platform?, os?, version?, language?, creationMs?}
 *   phase "open"    — app launched (counted toward opens)
 *   phase "created" — a character was just created (marks the device converted,
 *                     bumps savesCreated, and records the creator time)
 *   phase "kb_gate" — the keyboard gate turned this device away, with
 *                     keyboardGatePassed:true on a later ping if a keyboard
 *                     turned up and it got in after all. NOT counted toward
 *                     opens: it describes a launch that already pinged, and
 *                     double-counting it would inflate the denominator of every
 *                     rate on the acquisition panel.
 *   phase "demo_nudge" — the demo's "are you done playing?" prompt, with
 *                     nudgeStep 'shown' | 'exported' | 'store'. Same rule as the
 *                     gate: describes a launch that already pinged, so it is NOT
 *                     counted toward opens.
 *   phase "demo_end" — the end-of-demo popup, with endStep 'exported' | 'store'.
 *                     Kept apart from demo_nudge because the two screens answer
 *                     different questions and used to be conflated; the popup's
 *                     denominator is reachedDemoGoal, so it needs no 'shown'.
 *                     Not counted toward opens either.
 * Upserts one row per device. Best-effort; safe to point analytics at.
 */
export class AppOpen extends PublicEndpoint {
	static rateTier = 'telemetry'; // anonymous client telemetry
	async post(data: any) {
		const body = await bodyOf(data, this);
		const deviceId = String(body.deviceId || '')
			.trim()
			.slice(0, 64);
		if (!deviceId) throw new GameError(tr('server.err.deviceIdRequired'), 400, 'server.err.deviceIdRequired');
		const phase =
			body.phase === 'created'
				? 'created'
				: body.phase === 'resumed'
					? 'resumed'
					: body.phase === 'demo_done'
						? 'demo_done'
						: body.phase === 'demo_nudge'
							? 'demo_nudge'
							: body.phase === 'demo_end'
								? 'demo_end'
								: body.phase === 'kb_gate'
									? 'kb_gate'
									: 'open';
		const now = Date.now();
		const t = db();
		const id = `dev:${deviceId}`;
		// Same cold-start hazard as LandingStat: a spurious null here would reset
		// this device's open count and its converted/firstConvertedAt funnel flags.
		const existing = await findCounterRow(t.AppOpen, id);
		const cms = clamp(Math.round(Number(body.creationMs) || 0), 0, 60 * 60_000);
		await t.AppOpen.put({
			id,
			deviceId,
			platform: String(body.platform || '').slice(0, 20) || existing?.platform || null,
			// Which channel handed this device its copy (itch | mas | direct |
			// dev). Orthogonal to `platform`, because itch ships both a download and
			// the browser demo.
			//
			// FIRST-WINS, unlike platform/os/version. Those describe the device as it
			// is right now and should follow it; a channel describes where the copy
			// was ACQUIRED, and that never changes for a given install. Last-wins
			// would let one player who later opens the browser demo silently re-file
			// their original itch download, which is how an acquisition number quietly
			// stops meaning acquisition. Safe to add here at all only because AppOpen
			// is a dynamic table — see the schema note before adding fields to a typed
			// one like SoloMetrics.
			channel:
				existing?.channel ||
				String(body.channel || '')
					.trim()
					.toLowerCase()
					.slice(0, 16) ||
				null,
			os: String(body.os || '').slice(0, 20) || existing?.os || null,
			version: String(body.version || '').slice(0, 24) || existing?.version || null,
			// demo | full — which product this install opened; 'demo' is sticky.
			edition:
				body.edition === 'demo' || existing?.edition === 'demo'
					? 'demo'
					: body.edition === 'full'
						? 'full'
						: existing?.edition || null,
			language:
				String(body.language || '')
					.trim()
					.toLowerCase()
					.slice(0, 12) ||
				existing?.language ||
				null,
			firstOpenAt: existing?.firstOpenAt || now,
			lastOpenAt: now,
			// Count real app launches; a "created" ping shouldn't inflate opens.
			opens: (existing?.opens || 0) + (phase === 'open' ? 1 : 0),
			converted: existing?.converted || phase === 'created',
			firstConvertedAt: existing?.firstConvertedAt || (phase === 'created' ? now : 0),
			/* Picked up an existing save — Continue, Load Game, or a passcode login.
			 *
			 * Kept as its OWN flag rather than folded into `converted`, for two
			 * reasons. `converted` means "made a character" and has months of history
			 * behind it; quietly widening it would rewrite what every past number
			 * meant. And the two facts answer different questions — creation measures
			 * whether the game gets people started, resumption measures whether it
			 * gets them back. The funnel below combines them into "played"; the raw
			 * flags stay separable forever.
			 *
			 * Sticky: someone who returned once has returned, whatever they do next. */
			/* One of our own machines rather than a player's (see isDevDevice() in
			 * src/platform.ts). Deliberately NOT sticky-true like the others: this one
			 * has to be undoable, or a mis-marked device is excluded from the numbers
			 * forever with no way back. An absent flag leaves whatever was there. */
			isDev: body.dev === true ? true : body.dev === false ? false : existing?.isDev || false,
			resumed: existing?.resumed || phase === 'resumed',
			firstResumedAt: existing?.firstResumedAt || (phase === 'resumed' ? now : 0),
			// How many characters this person has created.
			savesCreated: (existing?.savesCreated || 0) + (phase === 'created' ? 1 : 0),
			// Keep the most recent creator time we've seen for this device.
			creationMs: phase === 'created' && cms > 0 ? cms : existing?.creationMs || 0,
			// Demo completion: reached the hard-stop (goal animals returned). Sticky,
			// so it survives the save being reset when the thank-you popup is dismissed.
			reachedDemoGoal: existing?.reachedDemoGoal || phase === 'demo_done',
			demoGoalAt: existing?.demoGoalAt || (phase === 'demo_done' ? now : 0),
			/* The "are you done playing?" prompt (src/ui/DemoNudge.tsx), as three
			 * sticky flags rather than a count: raised, exported a save from it,
			 * clicked through to a store. Sticky because the question is how many
			 * PEOPLE it moved, not how many times it fired — and it only ever fires
			 * once per page load anyway.
			 *
			 * `shown` is its own flag instead of being inferred from the other two.
			 * Without it, a prompt that everyone dismisses is indistinguishable from
			 * a prompt that never appeared, and those call for opposite fixes. */
			demoNudgeShown: existing?.demoNudgeShown || phase === 'demo_nudge',
			demoNudgeExported: existing?.demoNudgeExported || (phase === 'demo_nudge' && body.nudgeStep === 'exported'),
			demoNudgeStore: existing?.demoNudgeStore || (phase === 'demo_nudge' && body.nudgeStep === 'store'),
			demoNudgeAt: existing?.demoNudgeAt || (phase === 'demo_nudge' ? now : 0),
			/* The end-of-demo popup (DemoCompleteModal in src/App.tsx), same idea,
			 * two flags. No `shown` twin: reachedDemoGoal above already IS the
			 * screen's denominator — every device that reaches the budget reports
			 * demo_done and then sees this popup — so a third flag would be a second
			 * copy of that number, free to drift from it.
			 *
			 * Separate from the nudge's flags on purpose. They were one funnel while
			 * the end screen had no store link at all, which meant the nudge's
			 * store-click rate was silently carrying every click in the demo and
			 * looked healthy for it. */
			demoEndExported: existing?.demoEndExported || (phase === 'demo_end' && body.endStep === 'exported'),
			demoEndStore: existing?.demoEndStore || (phase === 'demo_end' && body.endStep === 'store'),
			demoEndAt: existing?.demoEndAt || (phase === 'demo_end' ? now : 0),
			/* The keyboard gate. Both sticky, and deliberately so: this is the one
			 * question a device answers ONCE and then keeps answering differently.
			 * A phone that was turned away in March is still a phone that was turned
			 * away, even though today's ping is a launch like any other — so
			 * `keyboardGated` must not be re-derived from the current request.
			 *
			 * keyboardGatePassed is separate rather than an unset of keyboardGated,
			 * because "shown the screen" and "stopped by it" are different numbers
			 * and only the second one is a lost player. A tablet with a Bluetooth
			 * keyboard trips the gate for the half-second before a key is pressed;
			 * folding that into the blocked count would repeat, in a new number, the
			 * bounce-rate mistake this field exists to correct. */
			keyboardGated: existing?.keyboardGated || phase === 'kb_gate',
			keyboardGatePassed: existing?.keyboardGatePassed || (phase === 'kb_gate' && body.keyboardGatePassed === true),
			keyboardGatedAt: existing?.keyboardGatedAt || (phase === 'kb_gate' ? now : 0),
			updatedAt: now,
		});
		// Both caches, because the acquisition rows now have their own. Invalidation
		// is deliberately cheap (a flag and a counter — no scan, no await), and this
		// is what keeps read-your-own-write true for the funnel: a ping followed by a
		// dashboard read must show the ping, which is exactly what the keyboard-gate
		// and menu-metrics integration tests assert.
		dashboardCache.invalidate(); // acquisition numbers changed — refresh on the next read
		appOpenCache.invalidate();
		return { ok: true };
	}
}

// ---------------------------------------------------------------- landing page: analytics
// The marketing landing page (GET /) sends anonymous, aggregate-only usage
// pings. Nothing here is personal data, and nothing here ever was after the
// mailing list was removed: the form, the MailingListSignup table and the
// admin-only ListMailingList reader all went with it, so the landing page now
// collects no email address by any route. The subreddit is the follow-along
// channel in its place.
//  • LandingStat keeps ONE row per UTC day (`day:YYYY-MM-DD`) of plain
//    counters. Increments are read-modify-write like AppOpen — fine at
//    landing-page traffic, and analytics losing the odd count to a rare race
//    is acceptable by design.

// Click targets the landing page reports (data-track attributes). Anything
// else collapses into "other" so junk can't mint unbounded counter keys.
const LANDING_CLICK_TARGETS = new Set([
	'appstore',
	'itch',
	// 'play' is the landing page's primary CTA — it opens the browser demo at
	// /play on this domain. 'demo' is what that same button reported back when it
	// pointed at the itch storefront instead; kept so the historical counts stay
	// readable rather than quietly changing meaning mid-series.
	'play',
	'demo',
	'theme',
	'privacy',
	'support',
	'get-nav',
	'gallery',
	'edu-nav',
	// The landing page's Developers section, which is the door to /learn. One
	// target rather than three: from here the question is only whether the page
	// sends anyone into the lesson material at all. Which of the two they took is
	// already counted on /learn itself, by the classroom beacon.
	'learn-nav',
	// The API docs at /developers/api. Its own target rather than folded into
	// learn-nav: "went to read the reference" and "went to take the lesson" are
	// two different visitors, and the whole reason the Developers section exists
	// is to find out whether the first kind shows up at all.
	'api-docs',
	// /teachers reports itself here, once per browser session, as a click rather
	// than a visit. Visits are ONE undifferentiated series shared by every page
	// that sends them, so a teachers-page visit would silently inflate the landing
	// page's number with no way to unmix them later. Its own target keeps both
	// numbers honest. See the comment in public/teachers.html's script.
	'edu-page',
	// The three policy pages, each reporting itself once per browser session on
	// the same trade /teachers made. They reported NOTHING before, which left the
	// privacy policy — the page a district reads before approving anything — with
	// no usage data at all.
	'privacy-page',
	'support-page',
	'rating-page',
	'pdf-guide',
	'pdf-worksheets',
	'school-copy',
	// The subreddit card in the landing page's Updates section, and the matching
	// footer link. Its own target rather than "other" so the dashboard can say how
	// many people the page actually sends to the community.
	'reddit',
]);

/**
 * Where a visitor arrived from, as ONE WORD from a fixed list.
 *
 * The beacon used to send `ref` — 200 characters of raw document.referrer, which
 * can carry a search query — on every single event, and this endpoint read none
 * of it. Both halves of that were wrong: it was more data than the question
 * needs, and it answered nothing. The referrer is now bucketed in the browser
 * (see sourceBucket() in public/landing.html) and only the bucket is sent, so
 * the URL never leaves the visitor's machine.
 *
 * Nine buckets is the whole vocabulary. It is enough to answer "are teachers
 * finding this through search or through Reddit"; it is not enough to describe
 * one person. Anything unrecognized becomes 'other' rather than being stored.
 */
const LANDING_SOURCES = new Set([
	'google',
	'bing',
	'duckduckgo',
	'reddit',
	'itch',
	'apple',
	'bluesky',
	'direct', // no referrer at all: typed, bookmarked, or a stripped referrer
	'other',
]);
const landingDay = (t: number) => new Date(t).toISOString().slice(0, 10); // UTC day

const LANDING_STATS_CACHE_MS = 15_000;

/**
 * The landing-page counter rollup: scan every LandingStat day-row, sum the
 * totals, and count the mailing list. Behind a stale-while-revalidate cache
 * (see RollupCache) because bumpLandingStat fires on every single landing visit
 * and used to drop this on the floor each time.
 */
async function buildLandingStats(): Promise<any> {
	const now = Date.now();
	const t = db() as any;
	let rows: any[] = [];
	try {
		rows = t.LandingStat ? await allOf(t.LandingStat) : [];
	} catch {
		rows = [];
	}
	rows = rows.filter((r: any) => r && r.day).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));
	const totals = {
		visits: 0,
		uniques: 0,
		clicks: {} as Record<string, number>,
		downloads: {} as Record<string, number>,
		sources: {} as Record<string, number>,
	};
	for (const r of rows) {
		totals.visits += r.visits || 0;
		totals.uniques += r.uniques || 0;
		for (const [k, v] of Object.entries(r.clicks || {})) totals.clicks[k] = (totals.clicks[k] || 0) + (Number(v) || 0);
		for (const [k, v] of Object.entries(r.downloads || {}))
			totals.downloads[k] = (totals.downloads[k] || 0) + (Number(v) || 0);
		for (const [k, v] of Object.entries(r.sources || {}))
			totals.sources[k] = (totals.sources[k] || 0) + (Number(v) || 0);
	}
	/* How many day-rows ride along with the totals.
	 *
	 * Was 60, chosen when the dashboard drew a fixed last-14-days histogram off
	 * the tail of this list. That chart now has the same preset row as New
	 * caretakers per day — 7d / 30d / 90d / All — and a 90d preset reading a
	 * 60-day payload silently shows 60 days under a "90d" pill, which is the
	 * kind of wrong that never announces itself. Sized to cover the widest
	 * preset with room to spare; these are eight small numbers per day, so the
	 * payload cost of the extra two months is trivial. */
	const LANDING_DAYS_RETURNED = 180;
	const days = rows.slice(-LANDING_DAYS_RETURNED).map((r: any) => ({
		day: r.day,
		visits: r.visits || 0,
		uniques: r.uniques || 0,
		clicks: r.clicks || {},
		totalClicks: sumValues(r.clicks),
		downloads: r.downloads || {},
		totalDownloads: sumValues(r.downloads),
		sources: r.sources || {},
	}));
	return {
		generatedAt: now,
		today: landingDay(now),
		totals: {
			...totals,
			totalClicks: sumValues(totals.clicks),
			totalDownloads: sumValues(totals.downloads),
			totalSources: sumValues(totals.sources),
		},
		days,
	};
}

const landingStatsCache = new RollupCache<any>(LANDING_STATS_CACHE_MS, buildLandingStats, undefined, () => db());

/** Copy a stored `{ key: count }` map into a fresh, plain, sane object. Anything
 *  that isn't a finite positive number is dropped rather than carried forward. */
function countMap(stored: any): Record<string, number> {
	const out: Record<string, number> = {};
	if (stored && typeof stored === 'object' && !Array.isArray(stored))
		for (const [k, v] of Object.entries(stored)) {
			const n = Number(v);
			if (Number.isFinite(n) && n > 0) out[k] = n;
		}
	return out;
}

/** Apply one mutation to today's LandingStat row. Never throws — a metrics
 *  hiccup (table not deployed yet, decode error, …) must not break the caller.
 *
 *  The mutation is applied to a PLAIN object rebuilt from the stored row, never to
 *  the record Harper handed back. Harper FREEZES every record it decodes (its row
 *  cache depends on that), and this bundle is ESM — strict mode — so `row.visits =
 *  …` on a fetched record throws "Cannot assign to read only property". That throw
 *  landed in the catch below and was quietly logged, so every increment after the
 *  day's row existed was thrown away: each day stayed at whatever the FIRST event
 *  of the day wrote, i.e. visits: 1. That is the "one visit a day" the dashboard
 *  was reporting — not the traffic, the write.
 *
 *  Every other counter in this file (AppOpen, flushRefusals, noteSaveIncident)
 *  already rebuilds a literal before put; this was the one that mutated in place.
 *  The integration harness handed back structuredClones, which are writable, so
 *  the tests passed while production flatlined — tests/integration/harness.ts now
 *  freezes reads the way Harper does, so this can't come back unnoticed. */
async function bumpLandingStat(mutate: (row: any) => void): Promise<void> {
	try {
		const table = (db() as any).LandingStat;
		if (!table) return; // schema table not created yet — drop the count, not the request
		const now = Date.now();
		const day = landingDay(now);
		const id = `day:${day}`;
		// findCounterRow, NOT safeGet: a cold-start null from a primary-key .get()
		// would look like "first event of the day" and reset the row to zero.
		const stored = await findCounterRow(table, id);
		const row: any = {
			id,
			day,
			visits: Number(stored?.visits) || 0,
			uniques: Number(stored?.uniques) || 0,
			clicks: countMap(stored?.clicks),
			downloads: countMap(stored?.downloads),
			sources: countMap(stored?.sources),
		};
		mutate(row);
		row.updatedAt = now;
		await table.put(row);
		landingStatsCache.invalidate(); // new numbers — the next LandingStats read refreshes
	} catch (e: any) {
		console.error('landing stat bump failed —', e?.message || e);
	}
}

/** One classroom-PDF download, counted server-side by the pdf endpoints below.
 *  This is the honest number: it also catches the direct links teachers forward to
 *  each other, which never touch the landing page's click beacon. */
export async function bumpPdfDownload(which: 'guide' | 'worksheets'): Promise<void> {
	await bumpLandingStat((r) => {
		r.downloads[which] = (r.downloads[which] || 0) + 1;
	});
}

/**
 * POST /LandingEvent/ {type: "visit"|"click", target?, first?, from?} — anonymous
 * landing-page beacon, aggregated straight into today's LandingStat row.
 *   visit — one per browser session (sessionStorage-guarded client-side);
 *           first:true additionally counts a first-ever visitor (localStorage).
 *   click — an outbound link tap; `target` must be a known data-track name or
 *           it lands in "other".
 *   from  — an arrival bucket, present ONLY on a page's once-per-session ping
 *           (a 'visit' on the landing page, the 'edu-page' click on /teachers).
 *           Counted independently of type so both pages feed the same series.
 *
 * Every field is a name from a fixed list or a number. The endpoint reads
 * nothing else off the body — if a future page starts sending a field, it is
 * dropped here rather than stored, which is the property that made removing
 * `ref` and `lang` a client-side change with no migration.
 *
 * Always answers ok:true — analytics never gets to break the page.
 */
export class LandingEvent extends PublicEndpoint {
	static rateTier = 'telemetry'; // anonymous client telemetry
	async post(data: any) {
		const body = await bodyOf(data, this);
		const type = body.type === 'click' ? 'click' : body.type === 'visit' ? 'visit' : null;
		if (!type) return { ok: true }; // unknown ping — accept and drop
		// A bucket the client did not send, or sent something unrecognized for, is
		// not stored at all. 'other' is a real bucket a client can send on purpose;
		// it is not the fallback for a malformed one, because a rising 'other' should
		// mean "arrived from somewhere off the list" and nothing else.
		const rawFrom = String(body.from || '')
			.toLowerCase()
			.replace(/[^a-z]/g, '')
			.slice(0, 16);
		const from = LANDING_SOURCES.has(rawFrom) ? rawFrom : null;
		if (type === 'visit') {
			await bumpLandingStat((r) => {
				r.visits = (r.visits || 0) + 1;
				if (body.first === true) r.uniques = (r.uniques || 0) + 1;
				if (from) r.sources[from] = (r.sources[from] || 0) + 1;
			});
		} else {
			const raw = String(body.target || '')
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '')
				.slice(0, 24);
			const target = LANDING_CLICK_TARGETS.has(raw) ? raw : 'other';
			await bumpLandingStat((r) => {
				r.clicks[target] = (r.clicks[target] || 0) + 1;
				if (from) r.sources[from] = (r.sources[from] || 0) + 1;
			});
		}
		return { ok: true };
	}
}

/**
 * POST /ReportSaveIncident/ {table, recordId, kind?, platform?, version?, build?}
 *
 * Desktop solo runs the whole backend in-app, so noteSaveIncident writes to the
 * PLAYER'S local database and never reaches this instance — the saves we most
 * need to hear about are the ones we cannot see. This is the uplink: the client
 * posts here when a save will not open, so an unreadable desktop save shows up on
 * /dashboard alongside the hosted ones. Same shape as the metrics uplink.
 *
 * Aggregate bookkeeping only — ids and counts, never save contents. Always
 * answers ok:true; a telemetry hiccup must never add a second failure on top of
 * the one the player already hit.
 */
export class ReportSaveIncident extends PublicEndpoint {
	static rateTier = 'report'; // writes a permanent row for an anonymous caller
	async post(data: any) {
		const body = await bodyOf(data, this);
		const table = String(body.table || 'Player').slice(0, 40);
		const recordId = String(body.recordId || '').slice(0, 120);
		if (!recordId) return { ok: true };
		const kind = body.kind === 'refused' ? 'refused' : 'unreadable';
		try {
			const t = (db() as any).SaveIncident;
			if (!t) return { ok: true };
			const id = `${table}:${recordId}`;
			const now = Date.now();
			const row = (await safeGet(t, id)) || { id, table, recordId, kind, firstSeenAt: now, count: 0 };
			await t.put({
				...row,
				kind,
				lastSeenAt: now,
				count: (row.count || 0) + 1,
				reportedByClient: true,
				platform: String(body.platform || '').slice(0, 16) || row.platform || null,
				version: String(body.version || '').slice(0, 32) || row.version || null,
				build: String(body.build || '').slice(0, 64) || row.build || null,
			});
		} catch (e: any) {
			console.error('save incident report failed —', e?.message || e);
		}
		return { ok: true };
	}
}

/**
 * POST /ReportClientError/ {message, where?, stack?, platform?, version?, build?}
 *
 * A crash in the interface is completely invisible from the server: the player
 * gets a blank screen and closes the tab, and nothing was ever written down. The
 * only previous signal was somebody writing in to say the game "broke".
 *
 * Aggregated by a fingerprint of message + location, not stored per occurrence,
 * so one bad render loop firing every frame becomes one row with a count rather
 * than thousands of rows. Deliberately narrow about what it keeps: a truncated
 * message and the top of the stack. No save contents, no player id, no free text
 * the player typed — a crash report must never become a way to exfiltrate a save.
 */
export class ReportClientError extends PublicEndpoint {
	static rateTier = 'report'; // writes a permanent row for an anonymous caller
	async post(data: any) {
		const body = await bodyOf(data, this);
		const message = String(body.message || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 300);
		if (!message) return { ok: true };
		const where = String(body.where || '')
			.trim()
			.slice(0, 200);
		// Only the top frame: enough to locate the fault, short enough that a stack
		// full of user data can't ride along.
		const stack = String(body.stack || '')
			.split('\n')
			.slice(0, 3)
			.join(' | ')
			.slice(0, 400);
		try {
			const t = (db() as any).ClientError;
			if (!t) return { ok: true };
			const id = `e${hash32(`${message}|${where}`).toString(36)}`;
			const now = Date.now();
			const row = (await safeGet(t, id)) || { id, message, where, firstSeenAt: now, count: 0 };
			await t.put({
				...row,
				message,
				where,
				stack: stack || row.stack || null,
				lastSeenAt: now,
				count: (row.count || 0) + 1,
				byDay: bumpDay(row.byDay, now, 1),
				platform: String(body.platform || '').slice(0, 16) || row.platform || null,
				version: String(body.version || '').slice(0, 32) || row.version || null,
				build: String(body.build || '').slice(0, 64) || row.build || null,
			});
		} catch (e: any) {
			console.error('client error report failed —', e?.message || e);
		}
		return { ok: true };
	}
}

/**
 * POST /ClearProblem/ {kind:"refusal"|"crash", ids:[...]} — delete telemetry rows.
 *
 * The only WRITE the dashboard sign-in can perform, and it is deliberately not a
 * general one. `kind` selects between exactly two hard-coded table names and
 * anything else is refused, so the id is never used to reach a table the caller
 * named: the credential that can clear a stale crash counter still cannot touch
 * a Player row, which is the one thing on this server that is irreplaceable.
 *
 * Scoped this way ON PURPOSE because the dashboard role can reach it. A
 * read-only role that can also delete is not read-only, so the blast radius is
 * moved into the endpoint instead: two tables of regenerable counters, nothing
 * else. If a delete is ever wanted for saves, it belongs behind super-user and a
 * separate endpoint, not behind another value of `kind`.
 *
 * Idempotent. Deleting an id that is already gone is reported in `missing`
 * rather than failed — two clicks on the same row is a normal thing to do, and
 * an error there would just teach you to ignore errors.
 */
/* A Map, not an object literal, and an explicit string check at the call site.
 * An object literal answers to inherited keys — CLEARABLE['constructor'] returns
 * a function rather than undefined — and String(['crash']) is 'crash', so an
 * array argument coerced straight through the lookup. Neither could reach a
 * table outside this pair, but "fails safe by accident" is not the property to
 * rely on for the one endpoint that deletes. */
const CLEARABLE = new Map<string, string>([
	['refusal', 'Refusal'],
	['crash', 'ClientError'],
]);

export class ClearProblem extends DashboardEndpoint {
	// POST maps to create in Harper's permission model; the read gate is the gate.
	allowCreate(user?: any) {
		return (this as any).allowRead(user);
	}

	async post(data: any) {
		const body = await bodyOf(data, this);
		const kind = body?.kind;
		const table = typeof kind === 'string' ? CLEARABLE.get(kind) : undefined;
		if (!table) return { ok: false, error: 'kind must be "refusal" or "crash"', deleted: 0 };

		// Cap the batch: a "clear all" from a page showing thousands of rows should
		// not turn into one unbounded delete loop inside a request.
		const ids = (Array.isArray(body.ids) ? body.ids : [body.id])
			.filter((x: any) => x != null && x !== '')
			.map((x: any) => String(x))
			.slice(0, 500);
		if (!ids.length) return { ok: false, error: 'no ids given', deleted: 0 };

		const t = (db() as any)[table];
		if (!t) return { ok: false, error: `${table} table is not available`, deleted: 0 };

		// Refusal counts sit in an in-memory buffer between flushes. Flushing BEFORE
		// the delete means the row being removed includes everything counted so far,
		// and anything that arrives after this point legitimately recreates it —
		// which is the honest outcome. Dropping the buffer instead would silently
		// discard refusals that happened while you were reading the page.
		if (table === 'Refusal') await flushRefusals();

		let deleted = 0;
		const missing: string[] = [];
		const failed: { id: string; error: string }[] = [];
		for (const id of ids) {
			try {
				// Point-read first so "already gone" and "delete failed" stay distinct.
				const row = await safeGet(t, id);
				if (!row) {
					missing.push(id);
					continue;
				}
				await t.delete(id);
				deleted++;
			} catch (e: any) {
				failed.push({ id, error: String(e?.message || e) });
			}
		}
		return { ok: failed.length === 0, table, deleted, missing, failed };
	}
}

/**
 * POST /DeleteSoloMetrics/ {id} or {ids:[…]} — remove a caretaker's telemetry
 * row from SoloMetrics. Driven by the Remove button in the dashboard's player
 * modal.
 *
 * WHAT THIS DELETES, precisely, because the button says "remove caretaker" and
 * that reads like more than it is:
 *
 *   • The SoloMetrics row — the uplinked snapshot this dashboard is built from.
 *     Nothing else stores it, so this is destructive and there is no undo.
 *   • NOT their save. Saves live on the player's own device as local files (it
 *     is the first promise the privacy policy makes) and this server has never
 *     held one. Nobody loses a preserve because of this endpoint.
 *
 * AND IT MAY COME BACK. SyncMetrics upserts `solo:${clientId}` on every sync, so
 * a save that is still being played uplinks a fresh row the next time it is
 * online. That is not a bug to paper over: this is "forget what we know right
 * now", not a ban, and the modal says so in as many words. For a dead test save
 * it stays gone; for a live one it comes back thinner, having lost its history.
 *
 * SUPER-USER ONLY — deliberately narrower than allowRead. metrics_reader exists
 * precisely so the password sitting in a browser tab is one whose leak is "worth
 * rotating and nothing worse" (see DASHBOARD_ROLES). A read-only credential that
 * can destroy records would make that claim false.
 */
export class DeleteSoloMetrics extends DashboardEndpoint {
	// POST maps to create in Harper's permission model. Note this does NOT defer
	// to allowRead the way ClearProblem does — see the super-user note above.
	allowCreate(user?: any) {
		return isSuperUser(user);
	}

	async post(data: any) {
		const body = await bodyOf(data, this);
		// Batch-capable so the UI can grow a multi-select later without a second
		// endpoint, capped so it can never become an unbounded delete loop inside
		// one request. Lower than ClearProblem's 500: that clears counters, this
		// destroys histories, and a runaway here is not recoverable.
		const ids = (Array.isArray(body?.ids) ? body.ids : [body?.id])
			.filter((x: any) => x != null && x !== '')
			.map((x: any) => String(x))
			.slice(0, 100);
		if (!ids.length) return { ok: false, error: 'no ids given', deleted: 0 };

		const table = (db() as any).SoloMetrics;
		if (!table) return { ok: false, error: 'SoloMetrics table is not available', deleted: 0 };

		// No `solo:` prefix check on the ids. Every row SyncMetrics writes carries
		// it, but buildDashboardRows also back-fills legacy rows, and a guard that
		// rejected their shape would leave exactly the oldest junk undeletable —
		// which is most of what anyone would want this button for. The table
		// binding is the scope; a stray id simply misses.
		let deleted = 0;
		const missing: string[] = [];
		const failed: { id: string; error: string }[] = [];
		for (const id of ids) {
			try {
				// Point-read first so "already gone" and "delete failed" stay distinct
				// in the response — the UI treats one as success and one as an error.
				const row = await safeGet(table, id);
				if (!row) {
					missing.push(id);
					continue;
				}
				await table.delete(id);
				deleted++;
			} catch (e: any) {
				failed.push({ id, error: String(e?.message || e) });
			}
		}

		// The roll-up is cached for DASHBOARD_CACHE_MS and every number on the page
		// derives from it. Skip this and the row is gone from the database but still
		// on screen until the TTL lapses, which reads as the delete having failed.
		if (deleted) dashboardCache.invalidate();

		return { ok: failed.length === 0, deleted, missing, failed };
	}
}

/**
 * GET /GameplayHealth/ — what is going WRONG, as opposed to what players did.
 *
 * The rest of the metrics count successes: resources gathered, items crafted,
 * tasks finished. That makes a whole class of problem invisible — a recipe gated
 * on the wrong biome refuses every player who finds it, and every counter still
 * looks healthy because the refusal isn't an activity. Same for a crash in the
 * interface, which produces no events at all by definition.
 *
 * Two tables, side by side, both counts-only:
 *   refusals — every "no" the server gave, by message key
 *   clientErrors — crashes the interface reported
 *
 * ADMIN ONLY, like the rest of the dashboard's feeds. Its only reader is
 * /dashboard, and crash reports carry whatever text the client threw — which is
 * not something to publish just because nothing sensitive happens to be in it
 * today.
 */
export class GameplayHealth extends DashboardEndpoint {
	async get(target?: any) {
		// Fold anything still buffered in memory in first, so a quiet server does
		// not look healthier than it is just because the flush timer hasn't fired.
		await flushRefusals();
		const t = db() as any;
		const read = async (name: string): Promise<any[]> => {
			try {
				return t[name] ? await allOf(t[name]) : [];
			} catch {
				return [];
			}
		};
		const [refusalRows, errorRows] = await Promise.all([read('Refusal'), read('ClientError')]);

		// Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive, over the per-day
		// buckets. Every row keeps its all-time `count` untouched alongside a
		// `windowCount`, because those answer different questions and conflating
		// them is how a filtered view starts quietly lying: "380 refusals" filtered
		// to one day still means 380 all-time, and the reader has no way to know
		// which they are looking at unless both are on the page.
		//
		// `covered` is the honest part. `byDay` only exists from the day it shipped,
		// so a window that reaches back further covers less than it appears to. A
		// row with no buckets at all reports windowCount: null — not zero, which
		// would read as "this never happened in your range".
		const from = queryOne(target, 'from');
		const to = queryOne(target, 'to');
		const windowed = !!(from || to);
		const inWindow = (day: string) => (!from || day >= from) && (!to || day <= to);
		const windowCountOf = (byDay: any): number | null => {
			if (!byDay || typeof byDay !== 'object') return null;
			const days = Object.entries(byDay);
			if (!days.length) return null;
			let n = 0;
			for (const [day, c] of days) if (inWindow(day)) n += Number(c) || 0;
			return n;
		};
		const daysCovered = new Set<string>();
		for (const r of [...refusalRows, ...errorRows])
			for (const day of Object.keys(r?.byDay || {})) if (inWindow(day)) daysCovered.add(day);

		const shape = (r: any) => ({
			count: Number(r.count) || 0,
			windowCount: windowCountOf(r.byDay),
			byDay: r.byDay && typeof r.byDay === 'object' ? r.byDay : null,
			firstSeenAt: r.firstSeenAt || 0,
			lastSeenAt: r.lastSeenAt || 0,
		});

		// `id` rides along so a row can be addressed for deletion. The code/message
		// is what you READ, but it is not the key — two rows can share a message
		// from different places, and deleting by message would take both.
		const refusals = refusalRows
			.map((r: any) => ({
				id: String(r.id ?? r.code ?? ''),
				code: String(r.code || r.id || '?'),
				status: Number(r.status) || 0,
				...shape(r),
			}))
			.sort((a, b) => b.count - a.count);

		const clientErrors = errorRows
			.map((r: any) => ({
				id: String(r.id ?? ''),
				message: String(r.message || '?'),
				where: String(r.where || ''),
				stack: r.stack || null,
				platform: r.platform || null,
				version: r.version || null,
				...shape(r),
			}))
			.sort((a, b) => b.count - a.count);

		// Rows with nothing in the window are dropped from `top` when a window is
		// active — but only rows that HAVE buckets. A row that predates the per-day
		// counters has no evidence either way, and hiding it would be asserting
		// something the data cannot support.
		const inRange = (r: any) => !windowed || r.windowCount === null || r.windowCount > 0;
		const sumWindow = (rows: any[]) => rows.reduce((n, r) => n + (r.windowCount === null ? 0 : r.windowCount), 0);
		const shownRefusals = refusals.filter(inRange);
		const shownErrors = clientErrors.filter(inRange);

		return {
			generatedAt: Date.now(),
			// What the ?from/?to window actually managed to cover, so the page can
			// say "these counters only start on the 12th" instead of implying the
			// game was quiet before then.
			window: windowed
				? {
						from: from || null,
						to: to || null,
						daysWithData: daysCovered.size,
						earliestBucket: [...daysCovered].sort()[0] || null,
						note: 'per-day counters begin when this feature shipped; anything older has an all-time count only',
					}
				: null,
			refusals: {
				distinct: shownRefusals.length,
				total: refusals.reduce((n, r) => n + r.count, 0),
				windowTotal: windowed ? sumWindow(shownRefusals) : null,
				// 4xx is the game saying no on purpose; 5xx is the game falling over.
				serverFaults: refusals.filter((r) => r.status >= 500).reduce((n, r) => n + r.count, 0),
				top: shownRefusals.slice(0, 25),
			},
			clientErrors: {
				distinct: shownErrors.length,
				total: clientErrors.reduce((n, e) => n + e.count, 0),
				windowTotal: windowed ? sumWindow(shownErrors) : null,
				top: shownErrors.slice(0, 25),
			},
		};
	}
}

/**
 * GET /SaveHealth/ — how many stored records could not be read, from the
 * SaveIncident table. Salvage failures used to live only in server logs, so a
 * save that would not open was invisible until the player wrote in; this is the
 * same information on /dashboard. Ids and counts only — never save contents.
 *
 * ADMIN ONLY, and this one is not merely tidiness. `recent[].recordId` is a real
 * primary key, and for the Player table that is a save's UUID — the exact secret
 * that GET /Metrics/<playerId>, /GameState/<playerId> and every other capability
 * endpoint treats as proof you own the save. Published anonymously, this endpoint
 * handed out working ids for those, which is the one thing the MVP auth model
 * depends on not happening. Its only reader is /dashboard, which is now
 * authenticated too.
 */
export class SaveHealth extends DashboardEndpoint {
	async get() {
		const t = db() as any;
		let rows: any[] = [];
		try {
			rows = t.SaveIncident ? await allOf(t.SaveIncident) : [];
		} catch {
			rows = [];
		}
		const byTable: Record<string, number> = {};
		const byKind: Record<string, number> = {};
		let events = 0;
		for (const r of rows) {
			const tbl = String(r?.table || '?');
			byTable[tbl] = (byTable[tbl] || 0) + 1;
			const k = String(r?.kind || 'unreadable');
			byKind[k] = (byKind[k] || 0) + 1;
			events += Number(r?.count) || 0;
		}
		const recent = rows
			.slice()
			.sort((a: any, b: any) => (b?.lastSeenAt || 0) - (a?.lastSeenAt || 0))
			.slice(0, 25)
			.map((r: any) => ({
				table: r.table,
				recordId: r.recordId,
				kind: r.kind,
				count: Number(r.count) || 0,
				firstSeenAt: r.firstSeenAt || 0,
				lastSeenAt: r.lastSeenAt || 0,
			}));
		return {
			generatedAt: Date.now(),
			affected: rows.length,
			events,
			savesAffected: byTable.Player || 0,
			byTable,
			byKind,
			recent,
		};
	}
}

/**
 * GET /LandingStats/ — aggregate-only rollup of the landing page's daily
 * counters, consumed by the /dashboard "Landing page" section. Returns per-day
 * rows (see LANDING_DAYS_RETURNED) plus lifetime totals: visits, first-time
 * visitors, outbound link clicks and classroom-PDF downloads. Counts only —
 * there is no personal data anywhere behind this endpoint to leak.
 *
 * ADMIN ONLY. Nothing here is sensitive — it is counts, and it stayed harmless
 * when it was public. It moves behind auth because its only reader is /dashboard
 * and a business metric (visits, clicks, conversion) is not something to hand
 * to anyone who asks. POST /LandingEvent/ stays public: the landing page has to
 * be able to write to it.
 */
export class LandingStats extends DashboardEndpoint {
	async get() {
		return landingStatsCache.get(Date.now());
	}
}

// ---------------------------------------------------------------- classroom
//
// Usage counters for /teachers, /learn/web-development and /learn/code-builder.
//
// Built on the LandingStat pattern deliberately — same one-row-per-UTC-day
// shape, same read-modify-write, same "analytics losing the odd count to a rare
// race is acceptable" trade. What is NOT shared is the table: landing's `visits`
// is a single undifferentiated series that every page reporting one inflates,
// which is why /teachers already has to disguise itself as a click. Three more
// pages with real funnels, per-chapter progress and per-error counts would make
// that unworkable.
//
// THE CONTRACT, which is written into PRIVACY.md and printed on the pages:
// aggregate counters only. No identifiers, no class codes, no free text, no
// timings, and nothing a student typed. The moment one of those appears here
// this stops being an anonymous counter and becomes an education record, with
// FERPA, district review and data-subject requests attached — for a free lesson
// page. LESSON_KEYS below is what enforces it: a key that is not allowlisted is
// not stored, so the way to add a metric is to name it here, in the open.

/** Buckets a key may carry, for the families where the suffix is open-ended. */
const LESSON_ERROR_KEYS = new Set([
	// The runner's plain-English error catalog, plus its two silent-render hints.
	'fetch-failed',
	'json-parse',
	'null-property',
	'undefined-property',
	'not-defined',
	'not-a-function',
	'await-async',
	'const-assign',
	'not-iterable',
	'unexpected-eof',
	'syntax',
	'masked',
	'object-object',
	'undefined-text',
	'other',
]);

/**
 * Every counter the classroom pages may report.
 *
 * Exact names where the set is small and fixed; a bounded pattern where the tail
 * is genuinely open (a checkpoint id, an idea slug, a chapter number). NEVER a
 * blanket pattern: this endpoint is public and unauthenticated, so an unbounded
 * key space is an unbounded write amplification with someone else's hand on the
 * dial. Same reasoning as LANDING_CLICK_TARGETS, one size up.
 */
const LESSON_EXACT = new Set([
	// reach
	'view_hub',
	// /learn, the classroom hub. Its own key rather than view_hub, which is the
	// TEACHERS hub: two different audiences arriving at two different pages, and
	// folding them together would make both numbers unreadable.
	'view_learn',
	'view_science',
	'view_coding',
	// /developers/api. Not in the teaching funnel — a developer arriving at the
	// docs is a different journey from a teacher picking a kit — so it is counted
	// and shown as a total rather than as a funnel step.
	'view_developers',
	'view_lesson',
	'view_builder',
	'unique_hub',
	'unique_science',
	'unique_coding',
	'unique_lesson',
	'unique_builder',
	'unique_learn',
	'unique_developers',
	'ref_internal',
	'ref_search',
	'ref_social',
	'ref_direct',
	'ref_other',
	// Where a student went NEXT from a classroom page. Three destinations, so
	// three keys — the marketing side's data-track names post to /LandingEvent/
	// and would be counted in the wrong system entirely.
	'nav_lesson',
	'nav_builder',
	'nav_learn',
	'nav_hub',
	'nav_game',
	/* The API docs, opened from the lesson and the builder headers: a student or
	   a teacher going looking for the endpoint itself. */
	'nav_api',
	// The subreddit, from the API docs' sign-off. The landing page counts its own
	// reddit clicks through LANDING_CLICK_TARGETS; this is the classroom-side one.
	'nav_reddit',
	// Which kit a teacher took from the hub. The one number worth having about a
	// hub: if everybody leaves through the same side it is a redirect with extra
	// steps rather than a choice.
	'nav_science',
	'nav_coding',
	// funnel
	'lesson_start',
	'builder_open',
	/* Two strands, because both pages count into one set of totals. The bare
	   names are the LESSON's; the builder files the same two runner events under
	   its own, so each strand nests inside its own entry point instead of a
	   merged `first_run` outrunning a `view_lesson` that only counts one page. */
	'first_run',
	'first_fetch_ok',
	'builder_first_run',
	'builder_first_fetch_ok',
	'challenge_chosen',
	'download',
	// lesson interactions
	'types_legend-opened',
	'types_tree-expanded',
	// The optional "Going Deeper" panel at the end of the lesson. Worth its own
	// counter because it answers a question the funnel cannot: how many students
	// who finished still wanted more. If almost nobody opens it, it is the wrong
	// material or the wrong place for it; if most do, the lesson ends too early.
	'deeper_opened',
	// builder health
	'runs_manual',
	'runs_debounced',
	'fetch_ok',
	'fetch_failed',
	'fetch_blocked',
	'open_tab',
	'reset',
	'reset_project',
	'undo',
	'import',
	'import_failed',
	'restored',
	// Arrived at the builder from the lesson's "open this in the Code Builder"
	// link, carrying their code across in the URL fragment. It was being sent and
	// silently folded into `other`, which is exactly the failure the coverage test
	// now exists to catch: the counter moved and the number said nothing. It is
	// the one measure of whether the lesson-to-builder handoff is used at all.
	'carried_in',
	'save_unreadable',
	'storage_unavailable',
	'help_copy',
	'brief_cleared',
	'idea_started',
	'ideas_opened',
	'ideas_shuffled',
	'ideas_surprise',
	'ideas_auto_offered',
	'ideas_dismissed',
	// chrome
	'tab_html',
	'tab_css',
	'tab_js',
	'view_split',
	'view_code',
	'view_preview',
	'console_collapsed',
	'console_expanded',
	'console_resized',
	'theme_light',
	'theme_dark',
	'panel_checkpoints_open',
	'panel_checkpoints_closed',
	'panel_help_open',
	'panel_help_closed',
	// The whole side panel, collapsed out of the way so the editor gets the
	// window. Worth its own pair: if most students hide it and never bring it
	// back, the checkpoints are in the wrong place rather than merely optional.
	'panel_side_hidden',
	'panel_side_shown',
	// environment
	'env_viewport-sm',
	'env_viewport-md',
	'env_viewport-lg',
	// How often the Code Builder was opened on a screen too small to use it. If
	// that number is large the answer is not to squeeze the editor onto a phone,
	// it is that whatever is linking there should say so first.
	'env_too-small',
	// session shape
	'session_total',
	'duration_lt5m',
	'duration_5to15m',
	'duration_15to30m',
	'duration_30to60m',
	'duration_gt60m',
	'returning_day2',
	'returning_day3',
]);

/** Bounded families: a fixed prefix plus a constrained tail. */
const LESSON_PATTERNS: RegExp[] = [
	// TEN chapters, not nine. A CSS chapter was added at position 2 and every
	// chapter after it moved up one, which pushed the last one to 10 — outside
	// [1-9], where it would have been silently rejected and counted as `other`.
	// A bounded family has to be widened deliberately when the thing it bounds
	// grows; that is the cost of the bound and it is worth paying.
	/^chapter_([1-9]|10)_reached$/,
	/^chapters_([1-9]|10)$/,
	/^challenges_[1-5]$/,
	/^hints_chapter-([1-9]|10)$/,
	/^dwell_chapter-([1-9]|10)_(lt1m|1to3m|3to10m|gt10m)$/,
	// The whole visit rather than one chapter of it, on its own set of bands: the
	// question is whether the lesson fits in a period, and the per-chapter bands
	// cannot be summed into an answer (they only run while a chapter is current).
	/^dwell_lesson_(lt2m|2to10m|10to30m|30to60m|gt60m)$/,
	/^cond_(if|else|else-if|comparison|and-or|empty-guard|ternary)$/,
	/^iter_(for-of|forEach|map|filter|find|reduce|sort|chained)$/,
	// Topics inside "Going Deeper". Same shape and same reasoning as iter_ and
	// cond_: which OPTIONAL material students actually run is the only way to
	// tell a section that earns its place from one that is only ever scrolled
	// past. Bounded by the pattern, not by a list, because this panel is where
	// new topics get added.
	/^deeper_[a-z][a-z0-9-]{0,23}$/,
	/^edits_(html|css|js)_(1to5|6to20|21to50|50plus)$/,
	// Checkpoint and hint ids, and idea slugs. Kebab-case and short by
	// construction — see CHECKPOINTS and IDEAS in public/partials/ww-builder.js.
	/^checkpoint_[a-z][a-z0-9-]{0,23}$/,
	/^hint_[a-z][a-z0-9-]{0,23}$/,
	// hint_ is "revealed the worked version"; copy_ is "took it". The gap between
	// the two is the number worth having: a checkpoint everybody reveals and
	// nobody copies is one where the hint above it was almost enough.
	/^copy_[a-z][a-z0-9-]{0,23}$/,
	/^idea_[a-z][a-z0-9-]{0,31}$/,
	/^challenge_[a-z][a-z0-9-]{0,31}$/,
];

/**
 * How many distinct counters one day-row may hold before the rest collapse into
 * `other`.
 *
 * The patterns above are already bounded, so this should never be reached in
 * normal use — roughly 150 keys is the realistic ceiling. It is the backstop for
 * the case the patterns cannot cover: someone posting thousands of valid-looking
 * idea slugs to grow a single record without limit. A row that stops taking new
 * keys still counts everything it already knows, which is the right failure.
 */
const LESSON_MAX_KEYS = 400;

function lessonKeyAllowed(key: string): boolean {
	if (LESSON_EXACT.has(key)) return true;
	// `errors_<name>` is checked against the runner's own catalog rather than a
	// pattern: the whole point of ranking these is to decide which explanation to
	// write next, and a ranking that can be seeded with invented names is not a
	// work queue, it is a suggestion box for strangers.
	if (key.indexOf('errors_') === 0) return LESSON_ERROR_KEYS.has(key.slice('errors_'.length));
	for (const re of LESSON_PATTERNS) if (re.test(key)) return true;
	return false;
}

const lessonDay = (t: number) => new Date(t).toISOString().slice(0, 10); // UTC day
const LESSON_STATS_CACHE_MS = 15_000;

/**
 * Apply one batch of counters to today's LessonStat row.
 *
 * READ THE NOTE ON bumpLandingStat BEFORE CHANGING THIS. The mutation is applied
 * to a plain object rebuilt from the stored row, never to the record the
 * database handed back: those come back FROZEN, this bundle is ESM (so strict
 * mode), and `row.counts[k] = n` on a fetched record throws — into a catch, and
 * silently. That is exactly how the landing counters flatlined at 1/day for
 * weeks while every test passed. The harness freezes reads now so it cannot
 * happen unnoticed a second time; this function is written the safe way from the
 * start rather than discovering it again.
 */
async function bumpLessonStat(counts: Record<string, number>, sessions: number): Promise<void> {
	try {
		const table = (db() as any).LessonStat;
		if (!table) return; // schema table not created yet — drop the count, not the request
		const now = Date.now();
		const day = lessonDay(now);
		const id = `day:${day}`;
		// findCounterRow, NOT safeGet: a cold-start null from a primary-key .get()
		// would look like "first event of the day" and reset the row to zero.
		const stored = await findCounterRow(table, id);
		const row: any = {
			id,
			day,
			sessions: Number(stored?.sessions) || 0,
			counts: countMap(stored?.counts),
		};

		row.sessions += sessions;
		for (const [key, value] of Object.entries(counts)) {
			const n = Math.floor(Number(value));
			if (!Number.isFinite(n) || n <= 0) continue;
			const target =
				Object.prototype.hasOwnProperty.call(row.counts, key) || Object.keys(row.counts).length < LESSON_MAX_KEYS
					? key
					: 'other';
			// Clamp per event batch. One page-session cannot legitimately produce
			// thousands of anything, and a clamp keeps a broken (or hostile) client
			// from skewing a day's numbers past the point of being readable.
			row.counts[target] = (row.counts[target] || 0) + Math.min(n, 5000);
		}

		row.updatedAt = now;
		await table.put(row);
		lessonStatsCache.invalidate(); // new numbers — the next LessonStats read refreshes
	} catch (e: any) {
		console.error('lesson stat bump failed —', e?.message || e);
	}
}

/**
 * POST /LessonEvent/ {page, counts: {key: n}} — the classroom pages' beacon.
 *
 * ONE request per page-session, not one per event. The preview re-renders on
 * every debounce and a whole classroom shares one NAT'd school IP, so per-event
 * posting would exhaust the telemetry tier for everyone in the room by mid-
 * lesson. The client accumulates in memory and flushes on pagehide with
 * sendBeacon — which survives the tab closing, unlike fetch, and therefore keeps
 * exactly the sessions that ran to completion.
 *
 * Always answers ok:true. A telemetry hiccup must never surface in a lesson.
 */
export class LessonEvent extends PublicEndpoint {
	static rateTier = 'telemetry'; // anonymous client beacon

	async post(data: any) {
		const body = await bodyOf(data, this);
		const raw = body && typeof body.counts === 'object' && !Array.isArray(body.counts) ? body.counts : null;
		if (!raw) return { ok: true }; // unknown shape — accept and drop

		const page = String(body.page || '')
			.toLowerCase()
			.replace(/[^a-z-]/g, '')
			.slice(0, 16);

		const clean: Record<string, number> = {};
		let dropped = 0;
		for (const [key, value] of Object.entries(raw)) {
			const name = String(key)
				.toLowerCase()
				.replace(/[^a-z0-9_-]/g, '')
				.slice(0, 48);
			if (!lessonKeyAllowed(name)) {
				// Counted, not stored. A rising `other` is the signal that a page is
				// reporting something this list has not been taught about yet — which
				// is a prompt to add it here, deliberately, rather than a reason to
				// accept anything.
				dropped++;
				continue;
			}
			clean[name] = (clean[name] || 0) + (Number(value) || 0);
		}
		if (dropped) clean.other = (clean.other || 0) + dropped;

		/* `page` is read, validated and then deliberately NOT stored. Every counter
		 * a page reports already names itself (view_builder, runs_manual), so a
		 * second per-page dimension would only add a way for the two to disagree.
		 * It is parsed at all so that a malformed one is rejected here rather than
		 * discovered later. */
		if (!page) return { ok: true };
		if (!Object.keys(clean).length) return { ok: true };
		await bumpLessonStat(clean, 1);
		return { ok: true };
	}
}

/**
 * The classroom rollup: scan every LessonStat day-row, sum the totals, and hand
 * the /dashboard classroom section per-day rows plus lifetime figures.
 *
 * Behind a stale-while-revalidate cache for the same reason the landing rollup
 * is: bumpLessonStat fires on every session and would otherwise drop this on the
 * floor each time.
 */
async function buildLessonStats(): Promise<any> {
	const now = Date.now();
	const t = db() as any;
	let rows: any[] = [];
	try {
		rows = t.LessonStat ? await allOf(t.LessonStat) : [];
	} catch {
		rows = [];
	}
	rows = rows.filter((r: any) => r && r.day).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));

	const totals: Record<string, number> = {};
	let sessions = 0;
	for (const r of rows) {
		sessions += Number(r.sessions) || 0;
		for (const [k, v] of Object.entries(r.counts || {})) totals[k] = (totals[k] || 0) + (Number(v) || 0);
	}

	/* Sized to cover the widest dashboard preset with room to spare — the landing
	 * rollup shipped 60 rows behind a 90-day pill for a while, and a chart that
	 * quietly renders less than its label claims is the kind of wrong that never
	 * announces itself. These are small integers; the extra months cost nothing. */
	const LESSON_DAYS_RETURNED = 180;
	const days = rows.slice(-LESSON_DAYS_RETURNED).map((r: any) => ({
		day: r.day,
		sessions: Number(r.sessions) || 0,
		counts: r.counts || {},
		total: sumValues(r.counts),
	}));

	/* The funnel, in order, precomputed here so the dashboard renders a shape
	 * rather than deriving one. It is the number worth acting on: read as a
	 * drop-off curve it says where the lesson loses people, and every other
	 * counter here is context for it. */
	const step = (k: string) => totals[k] || 0;
	/* THE STUDENT'S PATH, as two strands rather than one list.
	 *
	 * It used to start at the teachers hub and the coding kit page. Those are a
	 * TEACHER deciding which kit to run, days earlier and on a different device,
	 * and putting them at the top made every percentage below them a comparison
	 * between two unrelated populations — a lesson opened by thirty students read
	 * as "217% of the previous step" because six teachers had looked at the kit
	 * page. Both are still reported: the hub split under the landing page, the kit
	 * pages in reach. They are just not steps anybody drops out of.
	 *
	 * The same mistake survived one level down. The lesson and the builder are two
	 * ENTRY POINTS, not two steps: the nav offers the builder from every page, so
	 * a visit can start there, and the run and fetch counters were the sum of both
	 * pages sitting underneath a `view_lesson` that counted only one of them. That
	 * is how a step reached 400% of the one above it. Each strand now starts at its
	 * own page and every step below is a strict subset of the one above.
	 *
	 * `download` belongs to the builder strand because Download only exists there. */
	const funnel = [
		{ id: 'lesson', label: 'Opened the lesson', n: step('view_lesson') },
		{ id: 'run', label: 'Ran their code', n: step('first_run') },
		{ id: 'fetch', label: 'Fetched the data', n: step('first_fetch_ok') },
	];
	const builderFunnel = [
		{ id: 'builder', label: 'Opened the builder', n: step('builder_open') },
		{ id: 'builder_run', label: 'Ran their code', n: step('builder_first_run') },
		{ id: 'builder_fetch', label: 'Fetched the data', n: step('builder_first_fetch_ok') },
		{ id: 'download', label: 'Downloaded a page', n: step('download') },
	];

	/* REACH, which the funnel above deliberately is not.
	 *
	 * The funnel is one path — a teacher finds the hub, takes the coding kit, and
	 * a student ends up downloading a page. Most of the site is not on that path:
	 * the science kit is a different classroom entirely, the API docs are for
	 * somebody who is not in a classroom at all, and neither belongs as a "step"
	 * anybody drops out of. Forcing them in was making the drop-off percentages
	 * mean nothing.
	 *
	 * So: every page that reports itself, side by side, with views and the number
	 * of distinct browsers that have ever opened it. `unique` is null rather than
	 * 0 for a page that does not report it yet, because "none" and "not measured"
	 * are different answers and a zero would read as the first one. */
	const reach = [
		{
			id: 'hub',
			label: 'Teachers hub',
			path: '/teachers',
			views: step('view_hub'),
			unique: step('unique_hub') || null,
		},
		{
			id: 'science',
			label: 'Science kit',
			path: '/teachers/science',
			views: step('view_science'),
			unique: step('unique_science') || null,
		},
		{
			id: 'coding',
			label: 'Coding kit',
			path: '/teachers/coding',
			views: step('view_coding'),
			unique: step('unique_coding') || null,
		},
		{
			id: 'learn',
			label: 'Learn hub',
			path: '/learn',
			views: step('view_learn'),
			unique: step('unique_learn') || null,
		},
		{
			id: 'lesson',
			label: 'The Lesson',
			path: '/learn/web-development',
			views: step('view_lesson'),
			unique: step('unique_lesson') || null,
		},
		{
			id: 'builder',
			label: 'Code Builder',
			path: '/learn/code-builder',
			views: step('view_builder'),
			unique: step('unique_builder') || null,
		},
		{
			id: 'developers',
			label: 'API docs',
			path: '/developers/api',
			views: step('view_developers'),
			unique: step('unique_developers') || null,
		},
	];

	/* How people arrived, across every classroom page that reports it. Five
	 * buckets, resolved in the browser and never sent as a URL. */
	const arrivals = ['direct', 'search', 'social', 'internal', 'other']
		.map((k) => ({ key: k, n: step('ref_' + k) }))
		.filter((a) => a.n > 0);

	/* HOW LONG A VISIT LASTS, and where that time goes.
	 *
	 * Two different questions, and they need two different shapes. `session` is
	 * the distribution of whole visits, which is what you plan a period against.
	 * `chapters` is where the time inside a visit went, which is what tells you a
	 * chapter is too long — the thing per-chapter dwell was collected for since it
	 * was written, and never once displayed.
	 *
	 * Both are bands, never durations: the pages only ever send a bucket name (see
	 * PRIVACY.md), so this can report a distribution and could not reconstruct one
	 * reader's session if it tried.
	 *
	 * `midpoint` exists so the dashboard can rank and compare without inventing a
	 * number of its own: it is the middle of each band in minutes, and the open
	 * top band is quoted at its floor rather than at a guess. Anything derived
	 * from it is an estimate and the labels say so.
	 */
	const SESSION_BANDS: Array<[string, string, number]> = [
		['lt2m', 'Under 2 min', 1],
		['2to10m', '2 to 10 min', 6],
		['10to30m', '10 to 30 min', 20],
		['30to60m', '30 to 60 min', 45],
		['gt60m', 'Over an hour', 60],
	];
	const CHAPTER_BANDS: Array<[string, string, number]> = [
		['lt1m', 'Under a minute', 0.5],
		['1to3m', '1 to 3 min', 2],
		['3to10m', '3 to 10 min', 6.5],
		['gt10m', 'Over 10 min', 10],
	];

	const banded = (bands: typeof SESSION_BANDS, key: (b: string) => string) => {
		const buckets = bands.map(([id, label, midpoint]) => ({ id, label, midpoint, n: step(key(id)) }));
		const n = buckets.reduce((a, b) => a + b.n, 0);
		return {
			buckets,
			n,
			// Minutes, weighted by the midpoints above. An estimate from bands, and
			// the only honest one available — which is the point of shipping it here
			// rather than letting each caller invent its own arithmetic.
			meanMinutes: n ? Math.round((buckets.reduce((a, b) => a + b.n * b.midpoint, 0) / n) * 10) / 10 : null,
		};
	};

	const time = {
		session: banded(SESSION_BANDS, (b) => 'dwell_lesson_' + b),
		chapters: Array.from({ length: 10 }, (_, i) => {
			const ch = i + 1;
			const row = banded(CHAPTER_BANDS, (b) => 'dwell_chapter-' + ch + '_' + b);
			return { chapter: ch, reached: step('chapter_' + ch + '_reached'), ...row };
		}).filter((c) => c.n > 0 || c.reached > 0),
	};

	/** Errors, ranked. This is the work queue for explanation copy. */
	const errors = Object.entries(totals)
		.filter(([k]) => k.indexOf('errors_') === 0)
		.map(([k, n]) => ({ key: k.slice('errors_'.length), n }))
		.sort((a, b) => b.n - a.n);

	/** Which ideas students pick, and which they pick and abandon. */
	const ideas = Object.entries(totals)
		.filter(([k]) => k.indexOf('idea_') === 0 && k !== 'idea_started')
		.map(([k, n]) => ({ id: k.slice('idea_'.length), n }))
		.sort((a, b) => b.n - a.n);

	return {
		generatedAt: now,
		today: lessonDay(now),
		sessions,
		totals,
		funnel,
		builderFunnel,
		reach,
		arrivals,
		time,
		errors,
		ideas,
		/* The health strip. A school filter that blocks the API breaks the lesson
		 * completely and silently: the teacher assumes it is broken, we never hear
		 * about it, and they do not come back. This turns that into a number. */
		health: {
			fetchOk: step('fetch_ok'),
			fetchFailed: step('fetch_failed'),
			storageUnavailable: step('storage_unavailable'),
			saveUnreadable: step('save_unreadable'),
		},
		days,
	};
}

const lessonStatsCache = new RollupCache<any>(LESSON_STATS_CACHE_MS, buildLessonStats, undefined, () => db());

/**
 * GET /LessonStats/ — the classroom rollup, for the /dashboard section.
 *
 * ADMIN ONLY, on the same argument as LandingStats: nothing here is sensitive —
 * it is counts, and it would stay harmless if it were public — but how a product
 * is doing is not something to hand to anyone who asks. POST /LessonEvent/ stays
 * public, because the pages have to be able to write to it.
 */
export class LessonStats extends DashboardEndpoint {
	async get() {
		return lessonStatsCache.get(Date.now());
	}
}

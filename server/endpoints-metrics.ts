// Wild Willows — server: endpoints-metrics
//
// Heartbeat and the metrics pipeline: the idle-window anomaly check, the
// Heartbeat endpoint, the raw Metrics write, and the dashboard roll-up that
// aggregates them.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';

import { GameError, db } from './core';
import { RollupCache, allOf, safeGet } from './store';
import { migrateWorldKeys } from './keys';
import { byWorld, defs, repairSave, worldOf } from './worlds';
import { patchPlayer, requirePlayer, withPlayerLock } from './player';
import {
	DAY_MS,
	activationFlags,
	encodeMetrics,
	freshMetrics,
	metricsView,
	readMetrics,
	round1,
	sessionBucket,
} from './metrics';
import { biomeMetrics, maturedBetween, recalcBiome } from './biome';
import { starterTaskIds } from './tasks';
import { bodyOf, rateLimit } from './rate-limit';
import { achievementMetrics, awardAchievements, awardWorldAchievements } from './achievements';
import { DashboardEndpoint, MAX_BEAT_MS, PublicEndpoint, SESSION_GAP_MS } from './endpoints-game';
import { decodeMetricsCursor, encodeMetricsCursor, metricsListRow } from './endpoints-admin';

// --------------------------------------------------------- idle-window anomaly
// A window left open on screen still beats. Heartbeat is paused while the tab is
// hidden (see the beat() guard in src/state.tsx), but a VISIBLE tab nobody is
// sitting at looked exactly like play, and the 90s cap above only bounds each
// beat — not how many of them an abandoned window sends. One such save logged
// 798 minutes against 152 actions, which was 17% of every hour this dashboard
// had ever recorded: enough on its own to move every average on the page.
//
// The tell is the rate, not the length. A long session is normal; a long session
// with almost nothing happening in it is someone who walked away. Real players
// bottom out around 1.2 actions/min even when playing slowly, and abandoned
// windows sit at 0.0-0.3, so the floor goes between them. It only applies once a
// session is long enough for the distinction to mean anything — a two-minute
// look-and-leave is a bounce, which the acquisition funnel already counts, and
// not the same thing at all.
//
// This classifies; it never deletes. The rows keep their real numbers and the
// dashboard decides whether to count them (`?idle=exclude`).
const IDLE_MIN_MINUTES = 10;
const IDLE_MAX_ACTIONS_PER_MIN = 0.5;

// How this save's play time was recorded. 1 = every visible window beat, for as
// long as it stayed open. 2 = the client also requires input within its idle
// window (reported as `idleGateMs`) before it beats, so an abandoned window stops
// the clock on its own. Stamped on the metrics blob, surfaced per row and counted
// in the dashboard's anomalies block, so a window spanning the change reads as
// two populations rather than as a fall in engagement.
const METRICS_REV = 2;

// The menus a heartbeat may report time against — PanelId in src/types.ts, plus
// 'help' for the help overlay, which is a menu to a player even though it isn't
// a panel in the code. A fixed set on purpose: the key space of a stored map
// should never be whatever a client decides to send, and an unknown panel is
// dropped rather than allowed to open a new column in every dashboard.
const MENU_PANELS = new Set([
	'inventory',
	'crafting',
	'chest',
	'journal',
	'tools',
	'biomes',
	'achievements',
	'feed',
	'home',
	'animal',
	'settings',
	'weather',
	'materials',
	'goals',
	'help',
]);
/** At most this many opens of one menu per beat — a beat covers ~90s, so a
 *  larger number is a broken or hostile client, not a busy player. */
const MAX_MENU_OPENS_PER_BEAT = 200;

/** Did this save spend its time as an unattended window rather than as play? */
function isIdleAnomaly(row: { playSeconds?: number; totalActions?: number }): boolean {
	const minutes = (row.playSeconds || 0) / 60;
	if (minutes < IDLE_MIN_MINUTES) return false;
	return (row.totalActions || 0) / minutes < IDLE_MAX_ACTIONS_PER_MIN;
}

/**
 * POST /Heartbeat/ {playerId} — the client pings this on a timer while the game
 * is open and focused. We accrue play time from the gap since the last beat
 * (capped, so a backgrounded tab or a closed laptop never inflates the number)
 * and count a new session whenever the gap is large or it's the first beat.
 */
export class Heartbeat extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		// The heartbeat is a read-modify-write of the metrics blob, and it fires
		// every 30 s for every player whether or not they touched anything — so it
		// was both the most frequent unlocked writer in the file and the one most
		// likely to interleave with a real action. Two things follow from taking the
		// lock, and the second is the reason it matters at this scale:
		//
		//  • Correctness. `prev` is read at the top and written back at the bottom;
		//    a bumpMetrics from a concurrent gather landing in between was silently
		//    discarded, because this beat's `...prev` spread reinstates the older
		//    counts wholesale.
		//  • Write volume. Inside the lock, patchPlayer BUFFERS (see the note on
		//    pendingPlayerPatch) and flushes once at release. The beat used to write
		//    the metrics blob here, again from repairSave, and a THIRD time from
		//    recalcBiome's bumpMetrics — three separate writes of the same row, per
		//    player, per 30 s. Against the write allowance this endpoint's cost is
		//    what caps how many people can play at once, so collapsing three into
		//    one raises that ceiling directly.
		return withPlayerLock(String(playerId || ''), () => this.beat(data));
	}

	private async beat(data: any) {
		const { playerId, language, edition, idleGateMs, panel, panelOpens } = await bodyOf(data, this);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const now = Date.now();
		const prev = readMetrics(player) || freshMetrics(player.createdAt || now);
		// Interface language, reported by the client on every beat (BCP-47-ish
		// short code, e.g. "en"/"es"). Kept on the metrics blob for dashboards.
		const lang = typeof language === 'string' && language.trim() ? language.trim().toLowerCase().slice(0, 12) : null;
		// Which product this session belongs to (demo | full), so dashboards can
		// split demo players from paid. Sticky once set to 'demo'.
		const ed: 'demo' | 'full' | null = edition === 'demo' ? 'demo' : edition === 'full' ? 'full' : null;
		// How long the client lets an untouched window keep beating (see
		// HEARTBEAT_IDLE_MS in src/state.tsx). A 0.2.x client doesn't send it and
		// stays on rev 1, which is exactly the point: playSeconds means something
		// slightly different either side of that line, and a dashboard averaging the
		// two together would report a drop in play time that never happened.
		const gateMs = typeof idleGateMs === 'number' && idleGateMs > 0 ? Math.round(idleGateMs) : null;
		const last = prev.lastHeartbeatAt || 0;
		const gap = now - last;

		let playSeconds = prev.playSeconds || 0;
		let sessions = prev.sessions || 0;
		let curSessionSeconds = prev.curSessionSeconds || 0;
		const areaSeconds: Record<string, number> = { ...(prev.areaSeconds || {}) };
		const menuSeconds: Record<string, number> = { ...(prev.menuSeconds || {}) };
		const menuOpens: Record<string, number> = { ...(prev.menuOpens || {}) };
		const sessionLengths: Record<string, number> = { ...(prev.sessionLengths || {}) };
		// Which menu was open at the moment of the beat, if any and if we know it.
		const openMenu = typeof panel === 'string' && MENU_PANELS.has(panel) ? panel : null;
		// Menu opens counted by the client since its last successful beat. Merged
		// here rather than sent as their own request; anything unrecognized, not a
		// positive number, or implausibly large for one beat is dropped.
		if (panelOpens && typeof panelOpens === 'object' && !Array.isArray(panelOpens)) {
			for (const [menu, raw] of Object.entries(panelOpens as Record<string, unknown>)) {
				if (!MENU_PANELS.has(menu)) continue;
				const n = Math.floor(Number(raw));
				if (!Number.isFinite(n) || n <= 0) continue;
				menuOpens[menu] = (menuOpens[menu] || 0) + Math.min(n, MAX_MENU_OPENS_PER_BEAT);
			}
		}
		const newSession = last === 0 || gap > SESSION_GAP_MS;
		if (newSession) {
			// The previous session just ended — bucket its length into the histogram
			// before starting the new one (nothing to bucket on the very first beat).
			if (curSessionSeconds > 0) {
				const b = sessionBucket(curSessionSeconds);
				sessionLengths[b] = (sessionLengths[b] || 0) + 1;
			}
			curSessionSeconds = 0;
			sessions += 1; // first beat of a new play session
		} else {
			const credit = Math.min(gap, MAX_BEAT_MS) / 1000;
			playSeconds += credit;
			curSessionSeconds += credit;
			// Attribute the elapsed time to the area the player is currently in.
			const area = player.area || 'unknown';
			areaSeconds[area] = round1((areaSeconds[area] || 0) + credit);
			// …and, if a menu was open, to that menu as well. Same approximation the
			// line above already makes: the whole gap goes to whatever was open when
			// the beat fired, which over many beats averages out and over one does
			// not. Overlapping, not carved out — see freshMetrics.
			if (openMenu) menuSeconds[openMenu] = round1((menuSeconds[openMenu] || 0) + credit);
		}

		const metrics = {
			...prev,
			firstSeenAt: prev.firstSeenAt || player.createdAt || now,
			lastSeenAt: now,
			lastHeartbeatAt: now,
			playSeconds: Math.round(playSeconds),
			sessions,
			curSessionSeconds: Math.round(curSessionSeconds),
			areaSeconds,
			menuSeconds,
			menuOpens,
			sessionLengths,
			...(lang ? { language: lang } : {}),
			...(gateMs ? { metricsRev: METRICS_REV, idleGateMs: gateMs } : {}),
			// Keep 'demo' sticky: a demo player is never re-tagged 'full'.
			...(ed ? { edition: prev.edition === 'demo' ? 'demo' : ed } : {}),
		};
		await patchPlayer(playerId, { metrics: encodeMetrics(metrics) });

		// ---- habitat growth: the preserve keeps living while the game is closed ----
		// Placements mature on wall-clock time (see matureMs), but biome health is
		// only ever recomputed on actions. The heartbeat is the "time passed" action:
		//  • every beat: if any placement crossed maturity since the last beat,
		//    recalc just those biomes (a tree finishing growth mid-session counts);
		//  • first beat of a session after a real absence: recalc every unlocked
		//    biome and shape a small welcome-back summary for the client.
		const wid = worldOf(player);
		// Backstop for the one-shot save work: ensureSoloWorld covers the login
		// screen, but "Continue" resumes through GameState — a GET, which must not
		// write — so a player who never logs in again would otherwise never migrate
		// or be repaired at all. Both are marked and memoized, so every later beat
		// is a no-op.
		await migrateWorldKeys(wid, playerId);
		await repairSave(wid, playerId, d, { player });
		let welcomeBack: any = null;
		let awarded = false;
		const newAnimals: any[] = [];
		const freshBiomeStates: any[] = [];
		try {
			const awaySince = prev.lastSeenAt || 0;
			const longAway = newSession && awaySince > 0 && now - awaySince > 10 * 60_000;
			const placements = await byWorld(t.Placement, wid);
			const sinceBeat = last > 0 ? last : now;

			// biomes with a growth threshold crossed since we last looked
			const crossed = new Set<string>();
			for (const p of placements) {
				const def = d.object.get(p.objectId);
				if (maturedBetween(def, p, longAway ? awaySince : sinceBeat, now)) crossed.add(p.area);
			}

			const biomeStates = await byWorld(t.BiomeState, wid);
			const unlockedIds = new Set(biomeStates.filter((b: any) => b.unlocked).map((b: any) => b.biomeId));
			const toRecalc = longAway ? [...unlockedIds] : [...crossed].filter((b) => unlockedIds.has(b));

			let healthGain = 0;
			// One read for the whole sweep — see recalcRepairedBiomes. Skipped entirely
			// when there is nothing to recalculate, which is what MOST heartbeats are:
			// reading it unconditionally would put a world-wide Discovery scan on a
			// timer that fires every 30 seconds for every player.
			const discoveries = toRecalc.length ? await byWorld(t.Discovery, wid) : undefined;
			for (const biomeId of toRecalc) {
				const before = biomeStates.find((b: any) => b.biomeId === biomeId)?.health || 0;
				const r = await recalcBiome(wid, playerId, biomeId, { player, discoveries });
				healthGain += Math.max(0, (r.biomeState?.health || 0) - before);
				newAnimals.push(...(r.newAnimals || []));
				freshBiomeStates.push(r.biomeState);
			}
			if (newAnimals.length || freshBiomeStates.length) {
				// Hand over the rows this pass already read. Without this the
				// achievement pass re-read BiomeState for the same world microseconds
				// after the loop above finished with it.
				await awardWorldAchievements(wid, playerId, {
					addDiscoveries: newAnimals,
					freshBiomeStates,
					player,
					biomeStates,
					discoveries,
				});
				awarded = true;
			}
			if (longAway) {
				const matured = placements.filter((p) => {
					const def = d.object.get(p.objectId);
					return unlockedIds.has(p.area) && maturedBetween(def, p, awaySince, now);
				}).length;
				if (matured > 0 || newAnimals.length > 0 || healthGain > 0) {
					welcomeBack = {
						awayHours: Math.round(((now - awaySince) / 3_600_000) * 10) / 10,
						matured,
						healthGain,
						arrivals: newAnimals.map((n: any) => n.animal?.name).filter(Boolean),
					};
				}
			}
		} catch (e) {
			console.error('heartbeat growth pass skipped:', e); // growth must never break the heartbeat
		}

		// Session-count achievements (e.g. A Familiar Face). This ran on EVERY beat,
		// and each run costs three world scans plus an achievement read — for a
		// player who is standing still, which is most beats. Two guards, and neither
		// can lose an award:
		//
		//  • Only the first beat of a session can change a session count, so a beat
		//    that isn't one has nothing new to evaluate. Anything else an achievement
		//    keys on is driven by an ACTION, and every action already awards on its
		//    own way through.
		//  • If the growth pass above already awarded, it evaluated the same context
		//    a moment ago and there is nothing left for a second pass to find.
		if (newSession && !awarded) await awardAchievements(playerId, { player });
		return {
			ok: true,
			metrics: metricsView({ ...player, metrics }),
			...(newAnimals.length ? { newAnimals } : {}),
			...(freshBiomeStates.length ? { biomeStates: freshBiomeStates } : {}),
			...(welcomeBack ? { welcomeBack } : {}),
		};
	}
}

// Small in-memory cache for the global dashboard rollup. The dashboard branch
// full-scans SoloMetrics and JSON.parses every row's snapshot; that's the only
// expensive part, so we cache the scanned+parsed rows for a short TTL and let
// each request apply its ?exclude filter + aggregation cheaply on top. Marked
// stale on every new uplink (SyncMetrics / AppOpen) so a player's own report
// shows up on the next read — see RollupCache for why it's marked rather than
// dropped.
const DASHBOARD_CACHE_MS = 30_000;

/**
 * Scan SoloMetrics and flatten every stored snapshot into the row shape the
 * dashboard aggregates over. The expensive half of GET /Metrics/ — everything
 * downstream of this is cheap filtering and summing over the result.
 */
async function buildDashboardRows(): Promise<any[]> {
	const now = Date.now();
	const t = db();
	let soloRows: any[] = [];
	try {
		soloRows = await allOf(t.SoloMetrics);
	} catch {
		/* SoloMetrics table not created yet — empty dashboard */
	}

	const rows = soloRows
		.map((r: any) => {
			// snapshot is stored as a JSON string (see SyncMetrics); tolerate any
			// legacy object rows too.
			let s: any = {};
			if (r.snapshot) {
				try {
					s = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
				} catch {
					s = {};
				}
			}
			const lastSeenAt = s.lastSeenAt || r.updatedAt || null;
			const createdAt = s.createdAt || r.createdAt || now;
			const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
			let status: 'active' | 'recent' | 'dormant' = 'dormant';
			if (hoursSinceActive != null) {
				if (hoursSinceActive <= 24) status = 'active';
				else if (hoursSinceActive <= 24 * 7) status = 'recent';
			}
			// Count character-creation time as part of the session. The raw
			// `playSeconds` metric only starts accruing AFTER the creator, so a
			// player who spent 30–80s (sometimes minutes) customizing and then left
			// logged 0 play time and a 0-length session — noise that swamped the
			// report. Fold the creator time in here (report-only: the gameplay clock
			// still reads raw playSeconds elsewhere) and credit one session to anyone
			// who got as far as creating a character.
			const rawPlaySeconds = s.playSeconds || 0;
			const sessionSeconds = Math.round(rawPlaySeconds + (s.creationMs || 0) / 1000);
			const sessionCount = Math.max(s.sessions || 0, (s.creationMs || 0) > 0 ? 1 : 0);
			return {
				...s,
				playerId: r.id, // slot-scoped id — solo name slugs can collide across machines
				// The SAVE's own id (`<name-slug>-<random6>`, minted once by
				// CreatePlayer and carried through an export/import unchanged), kept
				// under its own name because `playerId` above deliberately overwrites
				// it with the slot-scoped one. This is the only thing that survives a
				// demo save being carried into the full game, so it is what links the
				// two rows together below.
				savePlayerId: s.playerId || null,
				name: r.name || s.name || null,
				solo: true,
				platform: r.platform || null,
				os: r.os || null,
				language: r.language || s.language || null,
				version: r.version || null,
				build: r.build || null,
				lastSyncedAt: r.updatedAt || null,
				counts: s.counts || {},
				playSeconds: sessionSeconds,
				playMinutes: Math.round(sessionSeconds / 60),
				avgSessionMinutes: sessionCount ? Math.round(sessionSeconds / 60 / sessionCount) : 0,
				sessions: sessionCount,
				totalActions: s.totalActions || 0,
				currentArea: s.currentArea || null,
				unlockedBiomes: s.unlockedBiomes || 0,
				tutorialStep: s.tutorialStep || 0,
				activation: s.activation || {},
				achievements: s.achievements || null,
				biomeSummary: s.biomeSummary || {
					biomesUnlocked: 0,
					avgHealth: 0,
					biomesFullyRestored: 0,
					totalAnimalsReturned: 0,
				},
				// new metric fields (defaulted so aggregation is safe on legacy rows)
				areaSeconds: s.areaSeconds || {},
				// Empty for every save that predates the log, which the dashboard says
				// out loud rather than drawing as "no animals have come home".
				arrivals: Array.isArray(s.arrivals) ? s.arrivals : [],
				// Menu dwell. Solo and demo saves reach the roll-up through THIS
				// projection, not through metricsView, so anything the summary reads
				// has to be lifted out of the snapshot here or it aggregates as empty
				// for the desktop audience — which is most of it.
				menuSeconds: s.menuSeconds || {},
				menuOpens: s.menuOpens || {},
				menuMeasured: !!s.menuMeasured,
				// The highlights wall sorts on this one, so it has to survive the
				// projection too — recomputed rather than defaulted to 0, because a
				// snapshot from a client that predates the field still carries the map.
				menuTotalSeconds:
					s.menuTotalSeconds ??
					Math.round(Object.values((s.menuSeconds || {}) as Record<string, number>).reduce((a, b) => a + (b || 0), 0)),
				menuTotalOpens:
					s.menuTotalOpens ??
					Object.values((s.menuOpens || {}) as Record<string, number>).reduce((a, b) => a + (b || 0), 0),
				menuMinutes: s.menuMinutes || {},
				menuShareOfPlay: s.menuShareOfPlay ?? null,
				mostUsedMenu: s.mostUsedMenu || null,
				sessionLengths: s.sessionLengths || {},
				creationMs: s.creationMs || 0,
				creationSeconds: s.creationSeconds ?? (s.creationMs ? round1(s.creationMs / 1000) : null),
				timeToFirstActionSeconds: s.timeToFirstActionSeconds ?? null,
				appearance: s.appearance || null,
				createdAt,
				lastSeenAt,
				hoursSinceActive,
				minutesSinceActive: lastSeenAt ? round1((now - lastSeenAt) / 60_000) : null,
				status,
				daysSinceJoined: Math.floor((now - createdAt) / DAY_MS),
				isNewToday: now - createdAt <= DAY_MS,
				// Reported on every row so the dashboard can badge one player, not just
				// drop them from a total.
				idle: isIdleAnomaly({ playSeconds: sessionSeconds, totalActions: s.totalActions || 0 }),
				// Which definition of play time this row was recorded under, so time
				// series can be split at the change instead of straddling it.
				metricsRev: s.metricsRev || 1,
				idleGateMs: s.idleGateMs ?? null,
				// Starter chain (defaulted, so snapshots uplinked before it existed
				// aggregate as "step 0" rather than NaN — they're excluded from the
				// funnel's denominator below by `starterTotal`, which only rows that
				// know about the chain carry).
				starterStep: s.starterStep || 0,
				starterTotal: s.starterTotal || 0,
				starterDone: s.starterDone === true,
				starterLegacy: s.starterLegacy === true,
				goalsCreated: s.goalsCreated || (s.counts?.goalsCreated as number) || 0,
			};
		})
		.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);

	return markDemoConversions(rows);
}

/**
 * Flag the saves that came over from the demo — the "played the demo, bought the
 * game, brought their meadow with them" milestone.
 *
 * Two ways a row can prove it, because one of them only works going forward:
 *
 *  1. `convertedFromDemoAt` — stamped by ExportDemoSave onto the copy the player
 *     downloads. Authoritative, and it survives everything: the demo row could be
 *     deleted tomorrow and the save would still know its own history.
 *
 *  2. A DEMO row sharing this row's `savePlayerId`. Importing a save mints a new
 *     slot id, so the carried-over save uplinks as a NEW SoloMetrics row while the
 *     demo's original row stays put — two rows, same save id, different editions.
 *     That pairing is what makes conversions that already happened visible, before
 *     the stamp existed. Save ids are `<name-slug>-<random6>` and minted once per
 *     save, so this is a real identity match, not a name collision.
 *
 * The demo half of a pair is marked `supersededByFull` rather than dropped. Both
 * rows are real uplinks and quietly deleting one would make the player count move
 * for reasons nothing in the response explained; the aggregate below counts the
 * pair once and says how many rows are doubled up.
 */
function markDemoConversions(rows: any[]): any[] {
	const editionOf = (r: any) => (r.edition === 'demo' ? 'demo' : 'full');
	// Newest demo row per save id — a save could have uplinked from more than one
	// demo session before it was carried over.
	const demoBySave = new Map<string, any>();
	for (const r of rows) {
		if (editionOf(r) !== 'demo' || !r.savePlayerId) continue;
		const prev = demoBySave.get(r.savePlayerId);
		if (!prev || (r.lastSeenAt || 0) > (prev.lastSeenAt || 0)) demoBySave.set(r.savePlayerId, r);
	}
	const convertedSaveIds = new Set<string>();
	for (const r of rows) {
		if (editionOf(r) !== 'full' || !r.savePlayerId) continue;
		if (r.convertedFromDemoAt || demoBySave.has(r.savePlayerId)) convertedSaveIds.add(r.savePlayerId);
	}

	return rows.map((r) => {
		if (editionOf(r) === 'demo') {
			const superseded = !!(r.savePlayerId && convertedSaveIds.has(r.savePlayerId));
			return { ...r, convertedFromDemo: false, supersededByFull: superseded };
		}
		const twin = r.savePlayerId ? demoBySave.get(r.savePlayerId) : null;
		if (!r.convertedFromDemoAt && !twin) return { ...r, convertedFromDemo: false, supersededByFull: false };
		return {
			...r,
			convertedFromDemo: true,
			supersededByFull: false,
			conversion: {
				// The stamp is exact. Without it, the demo row's last sighting is the
				// closest honest answer, so it is labeled as an estimate rather than
				// dressed up as a timestamp.
				at: r.convertedFromDemoAt || twin?.lastSeenAt || null,
				exact: !!r.convertedFromDemoAt,
				source: r.convertedFromDemoAt ? 'stamped-at-export' : 'paired-demo-save',
				// How far they got in the demo before buying. Prefers the frozen stamp;
				// falls back to whatever the demo row last reported.
				demoPlaySeconds: r.demoPlaySeconds ?? twin?.playSeconds ?? null,
				demoSessions: r.demoSessions ?? twin?.sessions ?? null,
				demoActions: r.demoActions ?? twin?.totalActions ?? null,
			},
		};
	});
}

export const dashboardCache = new RollupCache<any[]>(DASHBOARD_CACHE_MS, buildDashboardRows, undefined, () => db());

/**
 * The acquisition funnel's source rows, cached on the same terms as the
 * dashboard rollup they are read alongside.
 *
 * AppOpen holds one row per install for the lifetime of the game, so the scan
 * cost tracks total installs — the largest and fastest-growing table on the
 * analytics path, and the only one that was being re-scanned per request. Sharing
 * DASHBOARD_CACHE_MS keeps the two halves of a single dashboard render coherent:
 * player rows and acquisition rows go stale together rather than one refreshing
 * under the other.
 */
export const appOpenCache = new RollupCache<any[]>(
	DASHBOARD_CACHE_MS,
	async () => {
		const t = db();
		return t.AppOpen ? await allOf(t.AppOpen) : [];
	},
	undefined,
	() => db(),
);

/** Numeric segments of a version string, e.g. "0.2.10+build" → [0, 2, 10]. */
function versionSegments(s: string): number[] {
	return String(s)
		.split(/[^0-9]+/)
		.filter(Boolean)
		.map((n) => parseInt(n, 10));
}
/**
 * Semver-ish comparison: -1 if a<b, 0 if equal, 1 if a>b. Versions are compared
 * segment-by-segment numerically ("0.2.10" > "0.2.9"); a version with no numeric
 * segments ('unknown', '') sorts BELOW any real release, so it never counts as
 * "newer than" a selected version in the dashboard's min-mode filter.
 */
function compareVersions(a: string, b: string): number {
	const A = versionSegments(a);
	const B = versionSegments(b);
	if (!A.length && !B.length) return a < b ? -1 : a > b ? 1 : 0;
	if (!A.length) return -1;
	if (!B.length) return 1;
	const len = Math.max(A.length, B.length);
	for (let i = 0; i < len; i++) {
		const x = A[i] ?? 0;
		const y = B[i] ?? 0;
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

/**
 * GET /Metrics/<id> — ONE player's own metrics, computed live from that player's
 * game state. Stays public because the game client reads its own view through it
 * (src/api.ts `metrics()` → metricsUplink.ts / steamSync.ts): knowing the save's
 * UUID is the capability, exactly as it is for /GameState/<id> and every other
 * game endpoint under the MVP auth model.
 *
 * GET /Metrics/ (no id) used to return the whole analytics roll-up — the global
 * aggregates AND a row per player carrying names, first/last activity timestamps,
 * OS, accessibility preferences and behavior — to anyone who asked for it. That
 * was the leak. The roll-up now lives behind Harper admin auth, split in two:
 *
 *   GET /MetricsSummary/            — the aggregates (~6 KB): what a dashboard or cron wants
 *   GET /MetricsPlayers/            — per-player rows, paginated
 *   GET /MetricsPlayers/<playerId>  — one player's full row
 *
 * The no-id branch is kept as an explicit 404 rather than deleted, so an old
 * bookmark, script or cron is told where the data went.
 */
export class Metrics extends PublicEndpoint {
	async get(target?: any) {
		rateLimit(this, 'read');
		const t = db();
		// `target` is Harper's RequestTarget (a URLSearchParams subclass): it carries
		// the path id and any ?query parameters.
		const id = String((this as any).getId?.() || target?.id || '').trim();

		if (!id) return metricsRollupMoved();

		const player = await safeGet(t.Player, id);
		if (!player) throw new GameError(tr('server.err.noSaveWithId'), 404, 'server.err.noSaveWithId');
		// Per-player lookup includes full biome health numbers (no rendered
		// area snapshots — those were removed).
		const bm = await biomeMetrics(id, { player });
		const view = metricsView(player);
		return {
			player: {
				...view,
				biomeSummary: bm.summary,
				activation: activationFlags(view, bm.summary, player),
				achievements: await achievementMetrics(id),
				biomes: bm.biomes,
			},
		};
	}
}

/**
 * The signpost left at the old public roll-up URL. Deliberately NOT a GameError:
 * a crawler following a stale link is not a gameplay refusal and has no business
 * showing up in the dashboard's refusal counters.
 */
function metricsRollupMoved() {
	return {
		status: 404,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
		body: JSON.stringify({
			title: 'The /Metrics/ roll-up moved',
			detail:
				'Aggregates: GET /MetricsSummary/ · per-player rows: GET /MetricsPlayers/ · one row: GET /MetricsPlayers/<playerId>. All three require Harper admin auth. GET /Metrics/<playerId> is unchanged.',
		}),
	};
}

/**
 * Build the analytics roll-up: apply the ?query filters, aggregate, and hand back
 * BOTH halves — `summary` (the aggregates) and `rows` (one record per reporting
 * save). The two admin endpoints below each return one half, which is the whole
 * point of the split: reading the dashboard summary no longer serializes every
 * player record on the way out.
 *
 * Sourced ENTIRELY from the SoloMetrics table, which is now
 * the single client-metrics stream: desktop solo play, the browser demo (both
 * Harper mode and its offline fallback), and any offline solo all uplink a
 * full snapshot here (see SyncMetrics + src/solo/metricsUplink.ts). So this
 * rolls up every reporting player — split by `edition` (demo/full)
 * and `platform` (web/desktop) below — without touching the live
 * Player/BiomeState tables. (Hosted web players report
 * server-side and would stay out of this rollup.)
 */
async function metricsRollup(target?: any): Promise<{
	generatedAt: number;
	filters: any;
	summary: any;
	rows: any[];
}> {
	// The body below is verbatim from the old Metrics.get() roll-up branch, kept in
	// its original block so the move reads as a move in review rather than a rewrite.
	// Nothing about how a row is derived changed, so every snapshot already in
	// SoloMetrics — including the legacy ones buildDashboardRows back-fills — rolls
	// up exactly as it did before.
	{
		const t = db();
		const now = Date.now();
		// `all` is the SHARED cached rollup — the ?filter branches below rebind it to
		// new arrays via .filter() and never mutate the rows, so the cache stays intact.
		let all = await dashboardCache.get(now);

		// Full list of versions seen (before any filtering), so the dashboard's
		// version dropdown always has every option regardless of the active filter.
		const versionCounts: Record<string, number> = {};
		for (const v of all) {
			const ver = v.version || 'unknown';
			versionCounts[ver] = (versionCounts[ver] || 0) + 1;
		}
		const availableVersions = Object.keys(versionCounts).sort((a, b) =>
			b.localeCompare(a, undefined, { numeric: true }),
		);
		// Same idea for edition (demo/full) and platform (web/desktop): full option
		// lists computed before filtering, so the dropdowns are always complete.
		const availableEditions = [...new Set(all.map((v) => (v.edition === 'demo' ? 'demo' : 'full')))].sort();
		const availablePlatforms = [...new Set(all.map((v) => v.platform || 'unknown'))].sort();
		const availableChannels = [...new Set(all.map((v) => v.channel || 'unknown'))].sort();

		// Optional `?exclude=<name>` filter (repeatable and/or comma-separated) so you
		// can drop your own test saves and not skew the numbers. Case-insensitive match
		// on the save's display name.
		const excludedNames = new Set<string>();
		try {
			const raw: string[] =
				typeof target?.getAll === 'function' ? [...target.getAll('exclude'), ...target.getAll('excludeName')] : [];
			for (const part of raw.flatMap((s: string) => String(s).split(','))) {
				const n = part.trim().toLowerCase();
				if (n) excludedNames.add(n);
			}
		} catch {
			/* no query params on this target */
		}
		if (excludedNames.size)
			all = all.filter(
				(v) =>
					!excludedNames.has(
						String(v.name || '')
							.trim()
							.toLowerCase(),
					),
			);

		// Optional `?excludeDevice=<deviceId>` filter (repeatable and/or comma-
		// separated), the acquisition-side twin of `?exclude=<name>`.
		//
		// `?exclude=` drops SAVES by display name, which is enough for the player
		// numbers — but the acquisition funnel doesn't read saves, it reads AppOpen,
		// one row per install. So a developer's own machine kept counting: every
		// launch during development is a real `open`, and after a few weeks of that
		// the "App opens" figure is mostly one person. (Devices and the conversion
		// rate barely move — a dev machine is one device — so the distortion is
		// concentrated in the raw open and character-creation totals, which is
		// exactly where it is least obvious.)
		//
		// Excluding by device id rather than guessing: an unusually busy device could
		// equally be somebody who loves the game, and there is no honest way to tell
		// those apart from the row. The dashboard's Devices panel lists the roster so
		// you can identify your own machine and name it explicitly.
		const excludedDevices = new Set<string>();
		try {
			const raw: string[] =
				typeof target?.getAll === 'function'
					? [...target.getAll('excludeDevice'), ...target.getAll('excludeDeviceId')]
					: [];
			for (const part of raw.flatMap((s: string) => String(s).split(','))) {
				const d = part.trim();
				if (d) excludedDevices.add(d);
			}
		} catch {
			/* no query params on this target */
		}

		// Optional `?version=<build>` filter — scopes the whole report (including the
		// acquisition funnel below) to a game version. `?versionMode=min` widens it to
		// "this version AND anything newer" (semver-ish compare); anything else (the
		// default) isolates the single selected version. 'all'/empty = no filter.
		let versionFilter = '';
		try {
			const raw = typeof target?.getAll === 'function' ? target.getAll('version') : [];
			versionFilter = String((raw && raw[0]) || '').trim();
		} catch {
			/* no query params on this target */
		}
		let versionMode: 'exact' | 'min' = 'exact';
		try {
			const raw = typeof target?.getAll === 'function' ? target.getAll('versionMode') : [];
			if (
				String((raw && raw[0]) || '')
					.trim()
					.toLowerCase() === 'min'
			)
				versionMode = 'min';
		} catch {
			/* no query params on this target */
		}
		const versionActive = !!versionFilter && versionFilter.toLowerCase() !== 'all';
		// Match a save's version against the active filter. In 'min' mode an
		// unparseable/'unknown' version sorts lowest, so it's only ever included when
		// no filter is active — never as "newer than" a real release.
		const matchesVersion = (ver: string): boolean => {
			if (!versionActive) return true;
			const vv = ver || 'unknown';
			return versionMode === 'min' ? compareVersions(vv, versionFilter) >= 0 : vv === versionFilter;
		};
		if (versionActive) all = all.filter((v) => matchesVersion(v.version || 'unknown'));

		// Optional `?edition=demo|full` and `?platform=web|desktop` filters.
		const oneParam = (key: string): string => {
			try {
				const raw = typeof target?.getAll === 'function' ? target.getAll(key) : [];
				return String((raw && raw[0]) || '').trim();
			} catch {
				return '';
			}
		};
		const editionFilter = oneParam('edition');
		const platformFilter = oneParam('platform');
		const channelFilter = oneParam('channel');
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.platform || 'unknown') === platformFilter);
		if (channelFilter && channelFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.channel || 'unknown') === channelFilter);

		// `?idle=exclude` drops windows that were left open rather than played
		// (see isIdleAnomaly). Counted BEFORE the filter runs, so the dashboard can
		// say what it is leaving out instead of silently shrinking. Default is to
		// include them: the raw endpoint keeps reporting everything it recorded,
		// and the dashboard opts out on the reader's behalf.
		const idleRows = all.filter((v) => v.idle);
		const idleExcluded = oneParam('idle').toLowerCase() === 'exclude';
		// Note what is NOT filtered here. An idle window is still a real person who
		// really opened the game, so they stay in the head count, the audience
		// buckets, the funnel, retention and their own (real) action totals. What
		// cannot be trusted is their CLOCK — the play time, the sessions the gaps
		// invented, and the hours parked in one area. Those aggregates read from
		// `timed` instead, and everything else keeps reading `all`.
		const timed = idleExcluded ? all.filter((v) => !v.idle) : all;
		const anomalies = {
			idlePlayers: idleRows.length,
			idleHours: round1(idleRows.reduce((acc, v) => acc + (v.playSeconds || 0), 0) / 3600),
			idleActions: idleRows.reduce((acc, v) => acc + (v.totalActions || 0), 0),
			excluded: idleExcluded,
			rule: `over ${IDLE_MIN_MINUTES} min of play at under ${IDLE_MAX_ACTIONS_PER_MIN} actions/min`,
			// Spelled out because "excluded" is easy to over-read: these saves keep
			// their place in the player count, the funnel and retention. It is only
			// their play time, sessions and area dwell that stop counting.
			affects: 'play time, sessions and area dwell only',
			// Play time is not one measurement across this population. Rows on rev 1
			// were recorded before the client stopped beating for an untouched window,
			// so they include time nobody was there for; rev 2 rows do not. Reported
			// rather than reconciled — there is no honest way to back out idle time a
			// rev 1 row never recorded separately, so the split is shown and any trend
			// that crosses it is read as two series.
			clock: {
				rev: METRICS_REV,
				byRev: all.reduce((acc: Record<string, number>, v) => {
					const k = `rev${v.metricsRev || 1}`;
					acc[k] = (acc[k] || 0) + 1;
					return acc;
				}, {}),
				idleGateMinutes: round1((all.find((v) => v.idleGateMs)?.idleGateMs || 0) / 60_000) || null,
				note: 'rev 1 play time includes untouched windows; rev 2 does not',
			},
		};

		const N = all.length || 1;
		const pct = (n: number) => Math.round((n / N) * 100);

		// Per-counter action totals across everyone (includes cosmetic counters).
		const actionTotals: Record<string, number> = {};
		for (const v of all) {
			for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + (n as number);
		}

		// Sessions count as clock, not population: an abandoned tab crossing the
		// 30-minute gap threshold mints a fresh "session" every time it does it
		// (one such save logged 16 of them without a single action).
		const totalPlaySeconds = timed.reduce((acc, v) => acc + v.playSeconds, 0);
		const totalSessions = timed.reduce((acc, v) => acc + v.sessions, 0);
		// Actions are real even when the clock around them is not, so this one keeps
		// reading everybody.
		const totalActions = all.reduce((acc, v) => acc + v.totalActions, 0);
		/** Denominator for the per-player time averages — the saves whose clock counts. */
		const NT = timed.length || 1;

		// Audience buckets by recency. `activeNow` counts saves seen in the last 5
		// minutes — note solo saves uplink every ~3 min, so that's the practical
		// freshness floor for "playing right now".
		const audience = {
			activeNow: all.filter((v) => v.minutesSinceActive != null && v.minutesSinceActive <= 5).length,
			activeLast24h: all.filter((v) => v.status === 'active').length,
			activeLast7d: all.filter((v) => v.status === 'active' || v.status === 'recent').length,
			// `status` only knows the 24h and 7d cutoffs, so this one is measured
			// straight off the clock. It is a superset of activeLast7d.
			activeLast14d: all.filter((v) => v.hoursSinceActive != null && v.hoursSinceActive <= 24 * 14).length,
			dormant: all.filter((v) => v.status === 'dormant').length,
			newLast24h: all.filter((v) => now - v.createdAt <= DAY_MS).length,
			newLast7d: all.filter((v) => now - v.createdAt <= 7 * DAY_MS).length,
		};

		// Daily series, built from the two timestamps every row already carries.
		//
		// Read `created` as the real one: a save is created once, on a known day, so
		// summing them per day is exact and complete.
		//
		// `lastSeen` needs its label read carefully — it is "saves whose MOST RECENT
		// activity was this day", NOT daily active players. Each row holds a single
		// lastSeenAt, so somebody who played every day for a week appears once, on the
		// last of those days, and every earlier day they played is unrecoverable.
		// Charting it as "active per day" would understate every day but the newest.
		// True DAU would need a per-day record the uplink does not keep; this is the
		// honest thing derivable from what is stored, and it is named for what it is.
		//
		// The range is DENSE — every day from the first to the last, zeros included.
		// A bar chart that silently omits empty days shows a busier game than exists.
		const dayKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
		const createdByDay: Record<string, number> = {};
		const lastSeenByDay: Record<string, number> = {};
		let firstMs = 0;
		let lastMs = 0;
		for (const v of all) {
			if (v.createdAt) {
				const k = dayKeyOf(v.createdAt);
				createdByDay[k] = (createdByDay[k] || 0) + 1;
				if (!firstMs || v.createdAt < firstMs) firstMs = v.createdAt;
				if (v.createdAt > lastMs) lastMs = v.createdAt;
			}
			if (v.lastSeenAt) {
				const k = dayKeyOf(v.lastSeenAt);
				lastSeenByDay[k] = (lastSeenByDay[k] || 0) + 1;
				if (v.lastSeenAt > lastMs) lastMs = v.lastSeenAt;
			}
		}
		const days: Array<{ day: string; created: number; lastSeen: number }> = [];
		if (firstMs) {
			// Walk by UTC day index rather than adding 86_400_000 to a timestamp, so a
			// leap second or a DST-adjacent value can't skip or repeat a day.
			const startDay = Math.floor(firstMs / DAY_MS);
			const endDay = Math.floor((lastMs || firstMs) / DAY_MS);
			for (let d = startDay; d <= endDay && days.length < 1200; d++) {
				const key = dayKeyOf(d * DAY_MS);
				days.push({ day: key, created: createdByDay[key] || 0, lastSeen: lastSeenByDay[key] || 0 });
			}
		}
		const daily = {
			days,
			firstDay: days.length ? days[0].day : null,
			lastDay: days.length ? days[days.length - 1].day : null,
			note: 'created is exact; lastSeen is the day of each save’s most recent activity, not daily active players',
		};

		// Composition breakdowns straight off the uplink envelope.
		const tally = (pick: (v: any) => string | null) => {
			const out: Record<string, number> = {};
			for (const v of all) {
				const k = pick(v) || 'unknown';
				out[k] = (out[k] || 0) + 1;
			}
			return out;
		};
		const languages = tally((v) => v.language || 'en');
		const platforms = tally((v) => v.platform);
		const operatingSystems = tally((v) => v.os);
		const versions = tally((v) => v.version);
		// demo vs paid split (rides inside each solo snapshot; defaults to full).
		const editions = tally((v) => v.edition || 'full');
		// Which channel each save came from. Also rides inside the snapshot (see
		// metricsUplink), so it needs no column and lands on the row via the spread
		// above. Saves written before this shipped have none — they read 'unknown'
		// rather than being folded into a real channel, so the backfill gap stays
		// visible instead of quietly padding whichever store you look at first.
		const channels = tally((v) => v.channel);

		// Retention: did they come back for more than one session?
		const returningPlayers = all.filter((v) => v.sessions >= 2).length;

		// Demo → full carry-overs (see markDemoConversions). The strongest signal the
		// demo is earning its keep: not "they finished it", but "they bought the game
		// and brought their meadow with them".
		const convertedSaves = all.filter((v) => v.convertedFromDemo);
		const supersededDemoSaves = all.filter((v) => v.supersededByFull).length;
		// Denominator: demo saves that ever reported, counting a converted pair once.
		const demoSavesSeen = all.filter((v) => (v.edition === 'demo' ? 'demo' : 'full') === 'demo').length;
		const demoPopulation = demoSavesSeen - supersededDemoSaves + convertedSaves.length;
		const carriedSeconds = convertedSaves.reduce((a, v) => a + (v.conversion?.demoPlaySeconds || 0), 0);
		const conversions = {
			demoToFull: convertedSaves.length,
			// How many of those we know exactly (stamped at export) vs inferred from a
			// paired demo save. Conversions that predate the stamp are the inferred ones.
			stamped: convertedSaves.filter((v) => v.conversion?.exact).length,
			inferred: convertedSaves.filter((v) => v.conversion && !v.conversion.exact).length,
			demoSavesSeen: demoPopulation,
			ratePct: demoPopulation ? Math.round((convertedSaves.length / demoPopulation) * 100) : 0,
			avgDemoMinutesBeforeBuying: convertedSaves.length ? Math.round(carriedSeconds / 60 / convertedSaves.length) : 0,
			// A converted player has TWO rows (the demo original and the imported
			// save), so `players` above counts them twice. Said out loud rather than
			// silently reconciled — both rows are real uplinks.
			supersededDemoSaves,
		};

		// Activation funnel — how far players get from first launch. Each flag is
		// read from the snapshot's activation block when present, falling back to the
		// raw counts / durable biome state so legacy snapshots (uplinked before a flag
		// existed) still register. NOTE: these are independent booleans, not ordered
		// prerequisites — `attractedAnimal` comes from durable animal-return state,
		// while `crafted`/`placed` come from action counters that only tally actions
		// taken after counting shipped. So a player can show "attracted" without
		// "crafted": it's a data-source difference, not an impossible sequence. The
		// dashboard sorts the steps by count, so it always reads as a clean funnel.
		const did = (v: any, key: string) => v.counts && (v.counts[key] || 0) > 0;
		const funnel = {
			created: all.length,
			collected: all.filter((v) => v.activation?.collected || did(v, 'resourcesCollected')).length,
			terraformed: all.filter((v) => v.activation?.terraformed || did(v, 'terraformActions')).length,
			planted: all.filter((v) => v.activation?.planted || did(v, 'plantsPlanted')).length,
			crafted: all.filter((v) => v.activation?.crafted || did(v, 'itemsCrafted')).length,
			placed: all.filter((v) => v.activation?.placed || did(v, 'objectsPlaced')).length,
			attractedAnimal: all.filter(
				(v) => v.activation?.attractedAnimal || (v.biomeSummary?.totalAnimalsReturned || 0) > 0,
			).length,
			upgradedTool: all.filter((v) => v.activation?.upgradedTool || did(v, 'toolsUpgraded')).length,
			builtHome: all.filter((v) => v.activation?.builtHome || did(v, 'homesBuilt')).length,
			upgradedHome: all.filter((v) => v.activation?.upgradedHome || did(v, 'homeUpgrades')).length,
			unlockedSecondBiome: all.filter((v) => v.activation?.unlockedSecondBiome || (v.unlockedBiomes || 0) >= 2).length,
		};
		const funnelPct = {
			collected: pct(funnel.collected),
			terraformed: pct(funnel.terraformed),
			planted: pct(funnel.planted),
			crafted: pct(funnel.crafted),
			placed: pct(funnel.placed),
			attractedAnimal: pct(funnel.attractedAnimal),
			upgradedTool: pct(funnel.upgradedTool),
			builtHome: pct(funnel.builtHome),
			upgradedHome: pct(funnel.upgradedHome),
			unlockedSecondBiome: pct(funnel.unlockedSecondBiome),
		};

		// The starter chain, and the conversion it exists to produce.
		//
		// Denominator is saves that actually KNOW about the chain (`starterTotal`
		// set) — snapshots uplinked before it shipped carry no step and would
		// otherwise pile up at 0 and read as a catastrophic first-goal drop-off.
		// Legacy saves that finished the old three-goal opening are reported
		// separately for the same reason: they're counted as done because they are,
		// but their step was inferred, not watched, so folding them into the
		// per-step numbers would put ten fictional claims in the funnel.
		//
		// `authoredAfter` is the number this whole feature is judged on: of the
		// players who finished the chain, how many then wrote a goal of their own.
		// Finishing ten goals is not the win — picking up the board is.
		const chainRows = all.filter((v) => (v.starterTotal || 0) > 0 && !v.starterLegacy);
		const chainIds = starterTaskIds();
		const chainBase = chainRows.length;
		const chainPct = (n: number) => (chainBase ? Math.round((n / chainBase) * 100) : 0);
		const finishedChain = chainRows.filter((v) => v.starterDone);
		const starterChain = {
			saves: chainBase,
			legacySaves: all.filter((v) => v.starterLegacy).length,
			// One entry per goal, in chain order: how many saves have claimed it.
			// Reading top to bottom gives the drop-off, goal by goal.
			steps: chainIds.map((id, i) => {
				const reached = chainRows.filter((v) => (v.starterStep || 0) >= i + 1).length;
				return { id, step: i + 1, reached, pct: chainPct(reached) };
			}),
			completed: finishedChain.length,
			completedPct: chainPct(finishedChain.length),
			// Where the unfinished ones are sitting right now.
			stalledAt: chainIds.reduce<Record<string, number>>((acc, id, i) => {
				const n = chainRows.filter((v) => !v.starterDone && (v.starterStep || 0) === i).length;
				if (n) acc[id] = n;
				return acc;
			}, {}),
			authoredOwnGoal: chainRows.filter((v) => (v.goalsCreated || 0) > 0).length,
			authoredAfterFinishing: finishedChain.filter((v) => (v.goalsCreated || 0) > 0).length,
			authoredAfterFinishingPct: finishedChain.length
				? Math.round((finishedChain.filter((v) => (v.goalsCreated || 0) > 0).length / finishedChain.length) * 100)
				: 0,
			avgGoalsAuthored: chainBase ? round1(chainRows.reduce((a, v) => a + (v.goalsCreated || 0), 0) / chainBase) : 0,
		};

		// Where players are in the world.
		const areaTally: Record<string, number> = {};
		for (const v of all) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
		const mostPopularArea = Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

		// Tutorial progress — where first-run players stall.
		const tutorialTally: Record<string, number> = {};
		for (const v of all) {
			const k = String(v.tutorialStep || 0);
			tutorialTally[k] = (tutorialTally[k] || 0) + 1;
		}

		// Biome restoration, rolled up from each snapshot's biomeSummary.
		const withBiomes = all.filter((v) => (v.biomeSummary?.biomesUnlocked || 0) > 0);
		const avgBiomeHealth = withBiomes.length
			? Math.round(withBiomes.reduce((acc, v) => acc + (v.biomeSummary.avgHealth || 0), 0) / withBiomes.length)
			: 0;

		// Achievements, rolled up from each snapshot's achievements block. Hosted
		// PlayerAchievement rows are out of scope — this dashboard is solo-only.
		const withAch = all.filter((v) => v.achievements);
		const totalEarned = withAch.reduce((acc, v) => acc + (v.achievements.earned || 0), 0);
		const recentDistribution: Record<string, number> = {};
		const byCategory: Record<string, number> = {};
		const completionHistogram: Record<string, number> = {};
		for (const v of withAch) {
			for (const rec of v.achievements.recent || [])
				if (rec?.id) recentDistribution[rec.id] = (recentDistribution[rec.id] || 0) + 1;
			for (const [cat, n] of Object.entries(v.achievements.byCategory || {}))
				byCategory[cat] = (byCategory[cat] || 0) + (n as number);
			const e = v.achievements.earned || 0;
			const bucket = e === 0 ? '0' : `${Math.floor((e - 1) / 10) * 10 + 1}-${(Math.floor((e - 1) / 10) + 1) * 10}`;
			completionHistogram[bucket] = (completionHistogram[bucket] || 0) + 1;
		}
		/* The five achievements the most people have, and how long each took.
		 *
		 * Popularity is counted from `earnedAt`, which lists every achievement a
		 * save holds — NOT from `recentDistribution`, which only sees each player's
		 * last five and therefore systematically under-counts the early
		 * achievements that are the popular ones.
		 *
		 * "Time to earn" is measured from the save's creation, and is reported as a
		 * MEDIAN alongside the mean: one player who left the game open for a week
		 * before finishing the tutorial drags a mean badly, and with a handful of
		 * saves it is a mean of almost nothing. `players` and `timed` are both
		 * reported because they differ — a save whose snapshot predates this field
		 * counts for neither, and one with no usable creation time counts for
		 * popularity but not for pacing. */
		/* Idle windows are counted for POPULARITY but never for PACING.
		 *
		 * "Time to earn" is wall-clock from the save's creation, so a window left
		 * open over a lunch break stamps a first-session achievement hours after
		 * the save began — nobody played for those hours. One such save was enough
		 * to turn a range that should have read "34s – 6m" into "34s – 11h 12m",
		 * and it dragged the mean with it. Two things make it safe to drop them
		 * here specifically: the row already carries the same `idle` flag the rest
		 * of this endpoint filters on (so the definition of idle does not fork),
		 * and the popularity count is untouched — an abandoned window still earned
		 * the achievement, it just cannot say how long it took.
		 *
		 * The rows dropped are counted, not silently discarded: `timingIdleSkipped`
		 * rides along in the coverage block so the card can say what the numbers
		 * are drawn from. */
		const achEarnedBy = new Map<string, { players: number; times: number[] }>();
		let timingIdleSkipped = 0;
		for (const v of withAch) {
			const map = v.achievements.earnedAt;
			if (!map || typeof map !== 'object') continue;
			if (v.idle) timingIdleSkipped++;
			for (const [id, at] of Object.entries(map)) {
				let e = achEarnedBy.get(id);
				if (!e) achEarnedBy.set(id, (e = { players: 0, times: [] }));
				e.players++;
				if (v.idle) continue; // popularity yes, duration no — see above
				const ms = Number(at) - Number(v.createdAt || 0);
				// Guard both ends: a missing createdAt yields an absurd age, and clock
				// skew on a client-stamped timestamp can put an achievement before the
				// save existed. Neither is a real duration.
				if (v.createdAt && Number.isFinite(ms) && ms >= 0 && ms <= 365 * DAY_MS) e.times.push(ms / 1000);
			}
		}
		const achDefs = await defs().catch(() => null);
		const topAchievements = [...achEarnedBy.entries()]
			.sort((a, b) => b[1].players - a[1].players || a[0].localeCompare(b[0]))
			.slice(0, 5)
			.map(([id, e]) => {
				const sorted = [...e.times].sort((a, b) => a - b);
				const mid = sorted.length
					? sorted.length % 2
						? sorted[(sorted.length - 1) / 2]
						: (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
					: null;
				return {
					id,
					name: (achDefs as any)?.achievement?.get?.(id)?.name || id,
					players: e.players,
					// How many of those players had a usable duration behind them.
					timed: sorted.length,
					medianSecondsToEarn: mid == null ? null : round1(mid),
					avgSecondsToEarn: sorted.length ? round1(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
					fastestSeconds: sorted.length ? round1(sorted[0]) : null,
					slowestSeconds: sorted.length ? round1(sorted[sorted.length - 1]) : null,
				};
			});
		// Saves whose snapshot predates the per-achievement timestamps contribute
		// nothing here, and a top-five drawn from four saves is not a top five.
		const achTimingCoverage = {
			savesWithAchievements: withAch.length,
			savesWithTimestamps: withAch.filter((v) => v.achievements.earnedAt && Object.keys(v.achievements.earnedAt).length)
				.length,
			// Counted in `players`, excluded from every duration — see above.
			idleSkipped: timingIdleSkipped,
		};

		const achievementsSummary = {
			totalDefined: withAch.reduce((m, v) => Math.max(m, v.achievements.total || 0), 0),
			totalEarned,
			avgPerPlayer: round1(totalEarned / (withAch.length || 1)),
			avgCompletionPct: withAch.length
				? Math.round((withAch.reduce((a, v) => a + (v.achievements.completion || 0), 0) / withAch.length) * 100)
				: 0,
			avgPoints: round1(withAch.reduce((a, v) => a + (v.achievements.points || 0), 0) / (withAch.length || 1)),
			byCategory,
			recentDistribution,
			completionHistogram,
			topAchievements,
			timingCoverage: achTimingCoverage,
		};

		// Time-per-area: sum every save's dwell time, so you can see where players
		// actually spend their sessions (and the single most-lived-in area).
		const areaSecondsTotals: Record<string, number> = {};
		for (const v of timed) {
			for (const [a, sec] of Object.entries(v.areaSeconds || {}))
				areaSecondsTotals[a] = (areaSecondsTotals[a] || 0) + (sec as number);
		}
		const totalAreaSeconds = Object.values(areaSecondsTotals).reduce((a, b) => a + b, 0);
		const areaMinutesTotals: Record<string, number> = {};
		for (const [a, sec] of Object.entries(areaSecondsTotals)) areaMinutesTotals[a] = Math.round(sec / 60);
		const areaDwell = {
			totalSeconds: Math.round(totalAreaSeconds),
			byAreaSeconds: areaSecondsTotals,
			byAreaMinutes: areaMinutesTotals,
			mostTimeArea: Object.entries(areaSecondsTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
		};

		// Time-in-menus: the same sum across saves, plus how often each menu was
		// opened. `measuredSaves` is the denominator that matters — saves recorded
		// before this metric existed contribute nothing, and averaging over every
		// save would report a drop in menu use that never happened.
		const menuSecondsTotals: Record<string, number> = {};
		const menuOpensTotals: Record<string, number> = {};
		let menuMeasuredSaves = 0;
		let menuPlaySecondsOfMeasured = 0;
		for (const v of timed) {
			const ms = (v.menuSeconds || {}) as Record<string, number>;
			const mo = (v.menuOpens || {}) as Record<string, number>;
			if (v.menuMeasured) {
				menuMeasuredSaves++;
				menuPlaySecondsOfMeasured += v.playSeconds || 0;
			}
			for (const [k, sec] of Object.entries(ms)) menuSecondsTotals[k] = (menuSecondsTotals[k] || 0) + (sec || 0);
			for (const [k, n] of Object.entries(mo)) menuOpensTotals[k] = (menuOpensTotals[k] || 0) + (n || 0);
		}
		const totalMenuSeconds = Object.values(menuSecondsTotals).reduce((a, b) => a + b, 0);
		const menuMinutesTotals: Record<string, number> = {};
		for (const [k, sec] of Object.entries(menuSecondsTotals)) menuMinutesTotals[k] = Math.round(sec / 60);
		const menuDwell = {
			measuredSaves: menuMeasuredSaves,
			totalSeconds: Math.round(totalMenuSeconds),
			totalMinutes: Math.round(totalMenuSeconds / 60),
			totalOpens: Object.values(menuOpensTotals).reduce((a, b) => a + b, 0),
			byMenuSeconds: menuSecondsTotals,
			byMenuMinutes: menuMinutesTotals,
			byMenuOpens: menuOpensTotals,
			mostUsedMenu: Object.entries(menuSecondsTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
			// Share of play time spent in a menu, over the saves that measured it.
			shareOfPlayPct:
				menuPlaySecondsOfMeasured > 0 ? round1((totalMenuSeconds / menuPlaySecondsOfMeasured) * 100) : null,
			// Mean seconds per open, per menu: separates "a menu people live in"
			// from "a menu people check constantly and leave".
			secondsPerOpen: Object.fromEntries(
				Object.entries(menuSecondsTotals).map(([k, sec]) => [
					k,
					menuOpensTotals[k] ? round1(sec / menuOpensTotals[k]) : null,
				]),
			),
		};

		// Session-length distribution: sum each save's finished-session histogram.
		//
		// This is a SUBSET and the name hides it. A save only contributes buckets for
		// sessions that ended cleanly enough to be measured, and only clients new
		// enough to record `sessionLengths` contribute at all — so the histogram has
		// been totalling a couple of dozen sessions while `engagement.totalSessions`
		// reported hundreds, with nothing in the response admitting the gap. Reading
		// it as "the shape of all sessions" is then just wrong, and there is no way to
		// tell from the payload.
		//
		// Fixed by reporting the coverage next to the buckets instead of renaming the
		// field (which would break every existing consumer, this dashboard included):
		// `sessionsCovered` is what the buckets actually add up to, `totalSessions` is
		// the population it is drawn from, and `coveragePct` is the ratio to caveat
		// the chart with.
		const sessionLengthDistribution: Record<string, number> = { '<2m': 0, '2-10m': 0, '10-30m': 0, '30m+': 0 };
		let sessionLengthSaves = 0;
		for (const v of timed) {
			const buckets = Object.entries(v.sessionLengths || {});
			if (buckets.length) sessionLengthSaves++;
			for (const [b, n] of buckets) sessionLengthDistribution[b] = (sessionLengthDistribution[b] || 0) + (n as number);
		}
		// Count the ABANDONED sessions the heartbeat can never bucket.
		//
		// A session's length is only written when the NEXT one begins. For a player
		// who closes the game and doesn't come back, that moment never arrives — so
		// their session sits marked "in progress" forever and never reaches the
		// histogram. Since most players do exactly that, the histogram was covering
		// about 4% of sessions and looked broken.
		//
		// But nothing about that session is unknown. `curSessionSeconds` holds its
		// accrued length, and once `lastSeenAt` is older than the session gap the
		// player has demonstrably gone. That is a FINISHED session with a known
		// duration, so bucket it here rather than pretending it is still running.
		//
		// No double counting: when a player does return, the heartbeat buckets that
		// session itself and resets `curSessionSeconds`, so the same session can never
		// be counted from both sides.
		const abandonedBuckets: Record<string, number> = {};
		let abandonedCount = 0;
		let stillLive = 0;
		for (const v of timed) {
			const open = Math.round(v.curSessionSeconds || 0);
			if (open <= 0) continue;
			const quietFor = v.lastSeenAt ? now - v.lastSeenAt : Infinity;
			if (quietFor > SESSION_GAP_MS) {
				const b = sessionBucket(open);
				abandonedBuckets[b] = (abandonedBuckets[b] || 0) + 1;
				sessionLengthDistribution[b] = (sessionLengthDistribution[b] || 0) + 1;
				abandonedCount++;
			} else {
				stillLive++; // genuinely mid-session right now
			}
		}
		const sessionsCovered = Object.values(sessionLengthDistribution).reduce((a, b) => a + b, 0);
		// Only sessions happening RIGHT NOW are unmeasurable. Everything else either
		// ended cleanly or was abandoned, and both are counted above.
		const sessionsMeasurable = Math.max(0, totalSessions - stillLive);
		const sessionLengths = {
			buckets: sessionLengthDistribution,
			sessionsCovered,
			// Where the coverage came from, kept apart so the inference is auditable.
			fromClient: sessionsCovered - abandonedCount,
			fromAbandoned: abandonedCount,
			sessionsMeasurable,
			sessionsLiveNow: stillLive,
			totalSessions,
			savesReporting: sessionLengthSaves,
			savesMeasured: timed.length,
			// Saves too old to report curSessionSeconds still can't contribute their
			// abandoned session — said plainly so a gap has a name.
			savesMissingOpenSession: timed.filter((v) => v.curSessionSeconds == null).length,
			abandonedBuckets,
			coveragePct: sessionsMeasurable ? Math.round((sessionsCovered / sessionsMeasurable) * 100) : 0,
			note: 'a session the client never closed is bucketed here once the player has been quiet longer than the session gap — only sessions live right now are unmeasurable',
		};

		// Character creation: how long people spend in the creator (across saves).
		const withCreation = all.filter((v) => (v.creationMs || 0) > 0);
		const creation = {
			savesWithTiming: withCreation.length,
			avgCreationSeconds: withCreation.length
				? round1(withCreation.reduce((a, v) => a + v.creationMs, 0) / withCreation.length / 1000)
				: 0,
			medianCreationSeconds: withCreation.length
				? round1(
						[...withCreation].map((v) => v.creationMs).sort((a, b) => a - b)[Math.floor(withCreation.length / 2)] /
							1000,
					)
				: 0,
		};

		// Customization popularity: which appearance options players actually pick.
		const appTally: Record<string, Record<string, number>> = {};
		const bump = (field: string, val: any) => {
			if (val == null || val === '') return;
			const key = String(val);
			(appTally[field] ||= {})[key] = (appTally[field][key] || 0) + 1;
		};
		for (const v of all) {
			const a = v.appearance;
			if (!a) continue;
			bump('skin', a.skin);
			bump('hair', a.hair);
			bump('outfit', a.outfit);
			bump('hat', a.hat);
			bump('hatColor', a.hatColor);
			bump('hairstyle', a.hairstyle);
			bump('beard', a.beard);
			bump('body', a.body);
		}
		const appearancePopularity = { savesWithAppearance: all.filter((v) => v.appearance).length, choices: appTally };

		// Onboarding friction: how long from creating a save to the first action.
		//
		// The plain mean is unusable here and was being read as if it weren't. Real
		// first actions land in the seconds — 5.9s, 14.1s, 19.7s — but a save that was
		// created and then left open overnight before anyone touched it contributes a
		// five-figure number, and a handful of those dragged the reported average past
		// 80 minutes. Nobody's onboarding takes 80 minutes; the statistic was measuring
		// abandonment, not friction.
		//
		// So: report the MEDIAN (which the outliers cannot move), keep the raw mean for
		// continuity, and add a trimmed mean over the plausible window. `avgSeconds`
		// deliberately keeps its old meaning rather than being quietly redefined — an
		// existing consumer reading it gets the same number it got yesterday, and the
		// honest numbers sit next to it under new names.
		const TTFA_OUTLIER_SECONDS = 30 * 60; // half an hour to press one button = walked away
		const ttfaAll = all.filter((v) => v.timeToFirstActionSeconds != null).map((v) => v.timeToFirstActionSeconds);
		const ttfaSorted = [...ttfaAll].sort((a, b) => a - b);
		const ttfaKept = ttfaSorted.filter((s) => s <= TTFA_OUTLIER_SECONDS);
		const median = (xs: number[]): number => {
			if (!xs.length) return 0;
			const mid = xs.length >> 1;
			return round1(xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2);
		};
		const mean = (xs: number[]): number => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
		const timeToFirstAction = {
			playersMeasured: ttfaAll.length,
			// Unchanged meaning, kept for continuity. Skewed by design — see below.
			avgSeconds: mean(ttfaAll),
			// The number to actually quote. Immune to the walked-away tail.
			medianSeconds: median(ttfaSorted),
			// Mean over everyone who acted within the plausible window.
			trimmedAvgSeconds: mean(ttfaKept),
			trimmedMedianSeconds: median(ttfaKept),
			p90Seconds: ttfaKept.length
				? round1(ttfaKept[Math.min(ttfaKept.length - 1, Math.floor(ttfaKept.length * 0.9))])
				: 0,
			// Said out loud rather than silently dropped, so the exclusion is auditable.
			outliersExcluded: ttfaAll.length - ttfaKept.length,
			outlierThresholdSeconds: TTFA_OUTLIER_SECONDS,
			note: 'avgSeconds includes saves left open before the first action; medianSeconds and trimmedAvgSeconds do not',
		};

		// Settings & accessibility usage — audio mute rate plus which accessibility
		// options players actually turn on. Sourced from the `prefs` block each solo
		// snapshot uplinks (see metricsUplink.ts); only saves that report it count.
		const withPrefs = all.filter((v) => v.prefs && typeof v.prefs === 'object');
		const prefN = withPrefs.length || 1;
		const countPref = (test: (p: any) => boolean) => withPrefs.filter((v) => test(v.prefs)).length;
		const tallyPref = (pick: (p: any) => string) => {
			const out: Record<string, number> = {};
			for (const v of withPrefs) {
				const k = pick(v.prefs) || 'unknown';
				out[k] = (out[k] || 0) + 1;
			}
			return out;
		};
		const musicOff = countPref((p) => p.musicEnabled === false);
		const sfxOff = countPref((p) => p.sfxEnabled === false);
		const settings = {
			savesReporting: withPrefs.length,
			audio: {
				musicOff,
				sfxOff,
				fullyMuted: countPref((p) => p.musicEnabled === false && p.sfxEnabled === false),
				musicOffPct: Math.round((musicOff / prefN) * 100),
				sfxOffPct: Math.round((sfxOff / prefN) * 100),
			},
			accessibility: {
				reduceMotion: countPref((p) => p.reduceMotion === true),
				highContrast: countPref((p) => p.highContrast === true),
				colorblindOn: countPref((p) => p.colorblindMode && p.colorblindMode !== 'off'),
				// The font picker replaced a dyslexia-font toggle. It's a taste setting
				// now, not an assistive one, so it no longer counts toward anyEnabled —
				// otherwise every player who just liked the serif would inflate the
				// accessibility-adoption number. Dark mode is kept out for the same
				// reason, and turning the interact hint OFF is the opposite of enabling
				// an aid. Both are still reported below, just not counted here.
				anyEnabled: countPref(
					(p) =>
						p.reduceMotion === true ||
						p.highContrast === true ||
						(p.colorblindMode && p.colorblindMode !== 'off') ||
						(p.textScale && p.textScale !== 'md') ||
						p.simpleText === true,
				),
				colorblindModes: tallyPref((p) => p.colorblindMode || 'off'),
				textScales: tallyPref((p) => p.textScale || 'md'),
				simpleText: countPref((p) => p.simpleText === true),
				// interactHint ships ON, so the number worth watching is who turns it OFF.
				interactHintOff: countPref((p) => p.interactHint === false),
				// Saves that predate the picker still carry `dyslexiaFont: true`; the
				// client migrates those to 'plain' on load, so mirror that here rather
				// than tallying them as an absent field.
				fonts: tallyPref((p) => p.fontChoice || (p.dyslexiaFont === true ? 'plain' : 'storybook')),
				// Theme, both ways round. `themes` is what players picked, which is the
				// actionable number; `themesResolved` is what they were actually looking
				// at, which is the only way to see through 'system'. Snapshots that
				// predate dark mode carry neither and count as light — that build had no
				// other option, so it's what those players saw.
				themes: tallyPref((p) => p.theme || 'light'),
				themesResolved: tallyPref((p) => p.themeResolved || p.theme || 'light'),
			},
		};

		// Acquisition funnel — from the per-device AppOpen table, so it counts
		// people who opened the app but never made a character (bounced), and how
		// many characters each person creates. `?exclude=<name>` does not reach here
		// (that filters saves, and these rows are devices); `?excludeDevice=` does.
		let openRows: any[] = [];
		try {
			// Cached, NOT a bare `allOf`. AppOpen is keyed `dev:<deviceId>` — one row
			// per install, forever, never one per day — so this scan grows with every
			// person who has ever launched the game and never shrinks. It sat inside
			// metricsRollup but OUTSIDE dashboardCache, so unlike every other read on
			// this path it was paid in full on every /MetricsSummary/ hit and on every
			// page of /MetricsPlayers/, including the auto-refresh. It uses the same
			// RollupCache the rest of the dashboard already relies on, invalidated by
			// the same AppOpen writes that already call dashboardCache.invalidate().
			openRows = await appOpenCache.get(now);
		} catch {
			/* AppOpen table not created yet */
		}
		// Keep acquisition consistent with the active filters.
		if (versionActive) openRows = openRows.filter((o) => matchesVersion(o.version || 'unknown'));
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.platform || 'unknown') === platformFilter);
		if (channelFilter && channelFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.channel || 'unknown') === channelFilter);

		const deviceIdOf = (o: any) => String(o?.deviceId || String(o?.id || '').replace(/^dev:/, ''));

		/* OUR OWN devices come out by default — the ones that marked themselves via
		 * ?dev=1, plus anything running on localhost (channel 'dev'). On a young
		 * game these are most of the funnel: every title-screen reload while
		 * checking a change counts as an install that never converted, so the
		 * numbers say more about the week's development than about players.
		 *
		 * `?includeDev=1` puts them back for anyone who wants the raw totals. What
		 * was removed is reported below rather than left to be inferred from a
		 * number that quietly got smaller. */
		const includeDev = ['1', 'true'].includes(String(oneParam('includeDev') || '').toLowerCase());
		const isOurs = (o: any) => !!o?.isDev || (o?.channel || '') === 'dev';
		const devRows = includeDev ? [] : openRows.filter(isOurs);
		if (devRows.length) openRows = openRows.filter((o) => !isOurs(o));

		const excludedRows = excludedDevices.size ? openRows.filter((o) => excludedDevices.has(deviceIdOf(o))) : [];
		if (excludedDevices.size) openRows = openRows.filter((o) => !excludedDevices.has(deviceIdOf(o)));
		// What the exclusion actually removed, stated rather than left to be inferred
		// from a number that quietly got smaller.
		const excludedDeviceStats = {
			ids: [...excludedDevices],
			matched: excludedRows.length,
			opens: excludedRows.reduce((a, o) => a + (o.opens || 0), 0),
			charactersCreated: excludedRows.reduce((a, o) => a + (o.savesCreated || 0), 0),
		};

		const devices = openRows.length;
		const convertedDevices = openRows.filter((o) => o.converted).length;
		// Demo completion: of the demo installs that made a character, how many
		// reached the hard-stop (goal animals returned). Device-scoped + sticky.
		const demoDevices = openRows.filter((o) => o.edition === 'demo');
		const demoConverted = demoDevices.filter((o) => o.converted).length;
		const demoFinished = demoDevices.filter((o) => o.reachedDemoGoal).length;
		// The "are you done playing?" prompt, as a funnel: raised → save exported →
		// store link clicked. Device-scoped and sticky like everything else on this
		// row, so it survives the demo save being wiped at the hard-stop.
		//
		// Exports are counted here rather than at ExportDemoSave because the server
		// endpoint cannot tell WHERE an export came from, and that is the entire
		// question: the prompt is only worth its interruption if it produces exports
		// that the Settings button and the end-of-demo popup would not have. Compare
		// `exported` against demoCompletion.reachedGoal to see it.
		const nudgeShown = demoDevices.filter((o) => o.demoNudgeShown).length;
		const nudgeExported = demoDevices.filter((o) => o.demoNudgeExported).length;
		const nudgeStore = demoDevices.filter((o) => o.demoNudgeStore).length;
		const demoNudge = {
			shown: nudgeShown,
			exported: nudgeExported,
			storeClicked: nudgeStore,
			exportPct: nudgeShown ? Math.round((nudgeExported / nudgeShown) * 100) : 0,
			storePct: nudgeShown ? Math.round((nudgeStore / nudgeShown) * 100) : 0,
		};
		/* The end-of-demo popup, as its own funnel off the SAME denominator the
		 * completion rate uses: every device that reaches the hard-stop sees this
		 * screen, so `reachedGoal` is how many were shown it and needs no separate
		 * flag. Read `storePct` next to demoNudge.storePct — the two screens are
		 * asking the same question of the same people at different moments, and
		 * until the popup had a store link at all, the nudge's number was the only
		 * one moving. */
		const endExported = demoDevices.filter((o) => o.demoEndExported).length;
		const endStore = demoDevices.filter((o) => o.demoEndStore).length;
		const demoEnd = {
			shown: demoFinished,
			exported: endExported,
			storeClicked: endStore,
			exportPct: demoFinished ? Math.round((endExported / demoFinished) * 100) : 0,
			storePct: demoFinished ? Math.round((endStore / demoFinished) * 100) : 0,
		};
		/* STARTED PLAYING, not "made a character".
		 *
		 * Creation alone counts a returning demo player as a bounce, so the step got
		 * worse as retention improved — the same bug the acquisition funnel already
		 * had and fixed. `resumed` is a device that opened a save it already had;
		 * either route means somebody played. Creation is still reported beside it
		 * for anyone who wants the narrower number. */
		const demoPlayed = demoDevices.filter((o) => o.converted || o.resumed).length;
		const demoCompletion = {
			demoInstalls: demoDevices.length,
			startedPlaying: demoPlayed,
			createdCharacter: demoConverted,
			reachedGoal: demoFinished,
			// Completion among demo players who actually started, which is the
			// population the finish line is available to.
			completionPct: demoPlayed ? Math.round((demoFinished / demoPlayed) * 100) : 0,
			nudge: demoNudge,
			endScreen: demoEnd,
		};
		// demo vs paid split of installs (edition is stamped on each AppOpen row).
		const editionSplit: Record<string, number> = {};
		for (const o of openRows) {
			const k = o.edition === 'demo' ? 'demo' : 'full';
			editionSplit[k] = (editionSplit[k] || 0) + 1;
		}
		/* Per-CHANNEL funnel: how many devices each channel brought, and how
		 * many of them went on to start playing.
		 *
		 * Deliberately not a bare count. Raw device counts across channels are not
		 * comparable — inside itch's game iframe the device id lives in THIRD-PARTY
		 * storage, which browsers partition or clear on their own, so one itch
		 * player can show up as several devices while a wildwillows.app player
		 * (first-party) shows up as one. Conversion RATE survives that; totals do
		 * not. Both are returned, but the rate is the one to compare on.
		 *
		 * 'unknown' is its own bucket: every device that opened the game before
		 * this shipped has no channel, and folding those into a real one
		 * would silently inflate whichever one you happened to look at.
		 *
		 * `played` is the headline step, not `converted`: a device that came back to
		 * a save it already had is a player, and counting creation alone made a
		 * channel look worse the better it retained people. Creation is still
		 * returned as `converted` for anyone who wants the narrower number.
		 */
		const channelSplit: Record<string, any> = {};
		for (const o of openRows) {
			const k = String(o.channel || 'unknown');
			const c = (channelSplit[k] ||= {
				devices: 0,
				opens: 0,
				played: 0,
				converted: 0,
				charactersCreated: 0,
				playedPct: 0,
				conversionPct: 0,
			});
			c.devices++;
			c.opens += o.opens || 0;
			c.charactersCreated += o.savesCreated || 0;
			if (o.converted) c.converted++;
			if (o.converted || o.resumed) c.played++;
		}
		for (const c of Object.values<any>(channelSplit)) {
			c.conversionPct = c.devices ? Math.round((c.converted / c.devices) * 100) : 0;
			c.playedPct = c.devices ? Math.round((c.played / c.devices) * 100) : 0;
		}

		/* The keyboard gate: devices shown "Wild Willows needs a keyboard".
		 *
		 * These are not bounces. A bounce opened the game and chose to leave; these
		 * people never got the chance, and until the gate started reporting they were
		 * silently mixed into the same number — which is the sort of thing that makes
		 * a bounce rate look like a design problem when it is a hardware one.
		 *
		 * `turnedAway` is the count that matters: shown the screen and never got in.
		 * `gotIn` is the tablet-with-a-keyboard case, kept out of it.
		 *
		 * COVERAGE: only devices that have opened the game since the gate started
		 * reporting can appear here, so early numbers understate — and a device that
		 * was never gated is indistinguishable from one that predates the field, both
		 * being simply absent. There is no honest way to compute that gap, so none is
		 * offered; `since` carries the first gate report instead, and the dashboard
		 * dates the number rather than implying it covers all time.
		 */
		const gatedRows = openRows.filter((o) => o.keyboardGated);
		const gotInRows = gatedRows.filter((o) => o.keyboardGatePassed);
		const turnedAwayRows = gatedRows.filter((o) => !o.keyboardGatePassed);
		// Which devices they are. The gate is about hardware, so the answer people
		// actually want from this number is "are these phones?" — os carries that
		// (ios | android | windows | mac | linux), platform only says web vs desktop.
		const turnedAwayByOs: Record<string, number> = {};
		for (const o of turnedAwayRows) {
			const k = String(o.os || 'unknown');
			turnedAwayByOs[k] = (turnedAwayByOs[k] || 0) + 1;
		}
		const bouncedDevices = devices - convertedDevices;
		const gateTimes = gatedRows.map((o) => Number(o.keyboardGatedAt) || 0).filter((v) => v > 0);
		const keyboardGate = {
			shown: gatedRows.length,
			turnedAway: turnedAwayRows.length,
			gotIn: gotInRows.length,
			// Share of ALL devices, not of the ones that reported — the honest
			// denominator, and the one that makes the bounce comparison meaningful.
			pctOfDevices: devices ? Math.round((turnedAwayRows.length / devices) * 100) : 0,
			// How much of the bounce rate is actually this.
			pctOfBounced: bouncedDevices ? Math.round((turnedAwayRows.length / bouncedDevices) * 100) : 0,
			byOs: turnedAwayByOs,
			// When the first device reported being gated — i.e. how far back this
			// number goes. 0 until one does.
			since: gateTimes.length ? Math.min(...gateTimes) : 0,
		};

		const withCreatorTime = openRows.filter((o) => (o.creationMs || 0) > 0);
		const totalCharacters = openRows.reduce((a, o) => a + (o.savesCreated || 0), 0);
		const savesPerPersonHistogram: Record<string, number> = {};
		for (const o of openRows) {
			const k = String(o.savesCreated || 0);
			savesPerPersonHistogram[k] = (savesPerPersonHistogram[k] || 0) + 1;
		}
		/* PLAYED = created a character OR came back to an existing save.
		 *
		 * Bounce used to mean "never made a character", which counted every
		 * returning player as a bounce — the rate got WORSE as the game started
		 * retaining people, which is precisely backwards. Someone who pressed
		 * Continue did not bounce; they are the best outcome on this screen.
		 *
		 * `converted` is left alone and still means character creation, so the
		 * existing series keeps its meaning. Bounce is recomputed on `played`.
		 *
		 * Note for reading old numbers: devices that last opened the game before
		 * this shipped have no `resumed` flag, so historical bounce stays overstated.
		 * It corrects going forward rather than retroactively. */
		const resumedDevices = openRows.filter((o) => o.resumed).length;
		const playedDevices = openRows.filter((o) => o.converted || o.resumed).length;
		const acquisition = {
			devices,
			totalOpens: openRows.reduce((a, o) => a + (o.opens || 0), 0),
			converted: convertedDevices,
			// Came back to a save they already had.
			resumed: resumedDevices,
			// Did either — the honest denominator for "did this device play?"
			played: playedDevices,
			playedPct: devices ? Math.round((playedDevices / devices) * 100) : 0,
			bounced: devices - playedDevices,
			conversionPct: devices ? Math.round((convertedDevices / devices) * 100) : 0,
			bounceRatePct: devices ? Math.round(((devices - playedDevices) / devices) * 100) : 0,
			avgCreatorSeconds: withCreatorTime.length
				? round1(withCreatorTime.reduce((a, o) => a + o.creationMs, 0) / withCreatorTime.length / 1000)
				: 0,
			totalCharactersCreated: totalCharacters,
			avgCharactersPerPerson: devices ? round1(totalCharacters / devices) : 0,
			avgCharactersPerConverted: convertedDevices ? round1(totalCharacters / convertedDevices) : 0,
			charactersPerPersonHistogram: savesPerPersonHistogram,
			editions: editionSplit,
			// Per-channel funnel (itch | mas | direct | dev) — see channelSplit.
			channels: channelSplit,
			// Devices the keyboard gate turned away — see keyboardGate above. Sits in
			// acquisition because that is where they were being miscounted.
			keyboardGate,
			// What the ?excludeDevice= filter took out. The dashboard no longer offers
			// a device picker — raw app opens came off the page entirely, which removes
			// the distortion rather than filtering around it — but the query parameter
			// stays for anyone reading this endpoint directly.
			excludedDevices: excludedDeviceStats,
			// Our own machines, dropped by default. `?includeDev=1` keeps them in.
			ownDevices: {
				matched: devRows.length,
				opens: devRows.reduce((a, o) => a + (o.opens || 0), 0),
				charactersCreated: devRows.reduce((a, o) => a + (o.savesCreated || 0), 0),
				included: includeDev,
			},
		};

		return {
			generatedAt: now,
			filters: {
				availableVersions,
				availableEditions,
				availablePlatforms,
				availableChannels,
				version: versionActive ? versionFilter : null,
				versionMode: versionActive ? versionMode : null,
				edition: editionFilter && editionFilter.toLowerCase() !== 'all' ? editionFilter : null,
				platform: platformFilter && platformFilter.toLowerCase() !== 'all' ? platformFilter : null,
				channel: channelFilter && channelFilter.toLowerCase() !== 'all' ? channelFilter : null,
				idle: idleExcluded ? 'exclude' : null,
				excludedDevices: [...excludedDevices],
			},
			summary: {
				players: all.length,
				soloPlayers: all.length,
				excludedNames: [...excludedNames],
				excludedDevices: [...excludedDevices],
				anomalies,
				audience,
				daily,
				languages,
				platforms,
				operatingSystems,
				versions,
				editions,
				channels,
				engagement: {
					totalPlayHours: round1(totalPlaySeconds / 3600),
					totalPlaySeconds,
					avgPlayMinutesPerPlayer: Math.round(totalPlaySeconds / 60 / NT),
					totalSessions,
					// totalSessions comes from `timed`, so this divides by the same population.
					avgSessionsPerPlayer: round1(totalSessions / NT),
					avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
					totalActions,
					avgActionsPerPlayer: round1(totalActions / N),
				},
				retention: {
					returningPlayers,
					returningRatePct: pct(returningPlayers),
				},
				conversions,
				progression: {
					avgBiomeHealth,
					biomesFullyRestored: all.reduce((acc, v) => acc + (v.biomeSummary?.biomesFullyRestored || 0), 0),
					avgUnlockedBiomes: round1(all.reduce((acc, v) => acc + (v.unlockedBiomes || 0), 0) / N),
					mostPopularArea,
					tutorialStepHistogram: tutorialTally,
				},
				areaDwell,
				menuDwell,
				// Kept verbatim so existing readers (this repo's dashboard included)
				// don't break; `sessionLengths` is the same buckets plus the coverage
				// they were always missing.
				sessionLengthDistribution,
				sessionLengths,
				creation,
				appearancePopularity,
				timeToFirstAction,
				acquisition,
				demoCompletion,
				settings,
				funnel,
				funnelPct,
				starterChain,
				actionTotals,
				achievements: achievementsSummary,
			},
			rows: all,
		};
	}
}

/** Largest page /MetricsPlayers/ will hand out in one response. */
const METRICS_PAGE_MAX = 500;
/** Page size when the caller doesn't ask for one. */
const METRICS_PAGE_DEFAULT = 100;

/** Read a single ?key=value off Harper's RequestTarget, '' when absent. */
export function queryOne(target: any, key: string): string {
	try {
		const raw = typeof target?.getAll === 'function' ? target.getAll(key) : [];
		return String((raw && raw[0]) || '').trim();
	} catch {
		return '';
	}
}

/**
 * GET /MetricsSummary/ — the analytics aggregates, and ONLY the aggregates.
 *
 * Extends the raw Resource (NOT PublicEndpoint), so Harper's default permissions
 * apply and only an authenticated super user can read it — the same treatment
 * ListFeedback gets, and for the same reason:
 *   curl -u HDB_ADMIN 'https://wild.willows.harperfabric.com/MetricsSummary/'
 *
 * This is the response a dashboard, a cron job or a capacity report actually
 * wants. It used to arrive with ~500 KB of per-player records stapled to it;
 * those now live on /MetricsPlayers/ and are fetched only when something needs
 * them. Every ?filter the old endpoint took still works here unchanged.
 */
export class MetricsSummary extends DashboardEndpoint {
	async get(target?: any) {
		const { generatedAt, filters, summary, rows } = await metricsRollup(target);
		return {
			generatedAt,
			source: 'solo-metrics',
			filters,
			summary,
			// So a caller can size its paging without a second request.
			players: { total: rows.length, endpoint: '/MetricsPlayers/', maxLimit: METRICS_PAGE_MAX },
		};
	}
}

/**
 * GET /MetricsPlayers/                — per-player rows, newest-active first, paginated.
 * GET /MetricsPlayers/<playerId>      — one player's full row.
 *
 * Admin-only for the same reason as MetricsSummary — these rows are the sensitive
 * half: display names, exact first/last activity, OS, accessibility preferences,
 * appearance and behavior.
 *
 * Paging: `?limit=` (default 100, max 500) and `?cursor=`, where the cursor is the
 * opaque token handed back as `nextCursor`. Rows are sorted deterministically
 * (last seen desc, then play time desc) by buildDashboardRows, so the cursor names
 * the last row of the previous page and paging resumes just after it. If that row
 * has vanished between pages — a re-uplink can reorder it — paging restarts from
 * the top rather than silently skipping records, and `cursorStale: true` says so.
 *
 * BACKWARDS COMPATIBILITY: a row here is byte-for-byte the row that used to appear
 * in the old `players` array, derived fields and all. Nothing was renamed, nothing
 * dropped. `?fields=list` is opt-in, for callers that only want to draw a table.
 */
export class MetricsPlayers extends DashboardEndpoint {
	async get(target?: any) {
		const id = String((this as any).getId?.() || target?.id || '').trim();
		const { generatedAt, filters, rows } = await metricsRollup(target);

		if (id) {
			const row = rows.find((r: any) => r.playerId === id);
			if (!row) throw new GameError(tr('server.err.noSaveWithId'), 404, 'server.err.noSaveWithId');
			return { generatedAt, player: row };
		}

		const asked = parseInt(queryOne(target, 'limit'), 10) || METRICS_PAGE_DEFAULT;
		const limit = Math.min(Math.max(asked, 1), METRICS_PAGE_MAX);
		const cursor = queryOne(target, 'cursor');
		let start = 0;
		let cursorStale = false;
		if (cursor) {
			const after = decodeMetricsCursor(cursor);
			const at = after ? rows.findIndex((r: any) => r.playerId === after) : -1;
			if (at >= 0) start = at + 1;
			else cursorStale = true;
		}

		const page = rows.slice(start, start + limit);
		const last = page[page.length - 1];
		const more = start + page.length < rows.length;
		const lean = queryOne(target, 'fields').toLowerCase() === 'list';

		return {
			generatedAt,
			filters,
			total: rows.length,
			offset: start,
			limit,
			returned: page.length,
			nextCursor: more && last ? encodeMetricsCursor(last.playerId) : null,
			...(cursorStale ? { cursorStale: true } : {}),
			players: lean ? page.map(metricsListRow) : page,
		};
	}
}

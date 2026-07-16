// Solo only: push the local save's metrics view to the hosted Harper (POST
// /SyncMetrics/ → SoloMetrics table) so solo players show up on the same
// /Metrics/ dashboards as web/co-op players. The mirror image of steamSync.ts,
// but over the network.
//
// Strictly best-effort: solo works fully offline, so a failed send is dropped —
// each report is a full snapshot keyed by the save slot's UUID, so a missed
// report loses nothing once a connection returns.
//
// Reliability (esp. first sessions): reports fire (1) immediately once a session
// has a save slot — retried until the slot is ready, since it's registered a
// beat after the session id appears; (2) on a short interval; (3) a fresh async
// flush when the page is hidden; and (4) a synchronous `sendBeacon` on
// pagehide/unload of the last snapshot, which lands even if the desktop window
// is torn down before a normal fetch can finish. So a short first session that
// closes quickly still reports.

import { api, getPlayerId, getSoloSlot, getTransport, COOP_BASE_URL, IS_DESKTOP } from '../api';
import { getLocale } from '../i18n';
import { DEMO, EDITION } from '../demo';
import { APP_VERSION, BUILD_TIME, detectOS } from '../platform';

const REPORT_MS = 3 * 60 * 1000; // network-friendly cadence
const STARTUP_RETRY_MS = 700; // re-try the first report until the save slot exists
const STARTUP_MAX_TRIES = 30; // ~21s of retries, then give up (the interval covers it)

let timer: number | null = null;
let inFlight = false;
let startupTimer: number | null = null;
let startupTries = 0;
// The most recent report body, kept so the pagehide/unload beacon can send the
// latest known snapshot synchronously (a fetch can't reliably finish on close).
let lastPayload: string | null = null;

function endpoint(): string {
	// Desktop and the browser demo's offline fallback both uplink cross-origin to
	// the hosted Harper; the deployed web build would post to its own origin.
	return `${IS_DESKTOP || DEMO ? COOP_BASE_URL : ''}/SyncMetrics/`;
}

/** Build + send the current metrics snapshot. Returns true once a send has been
 *  attempted for a real solo session (pid + slot present), false if there's
 *  nothing to send yet (so the startup poke knows to retry). */
async function reportOnce(): Promise<boolean> {
	if (getTransport() !== 'solo') return false; // web/co-op already report on the server
	const pid = getPlayerId();
	const slot = getSoloSlot();
	if (!pid || !slot) return false; // session/slot not ready yet — caller retries
	if (inFlight) return true; // a report is already in flight; that counts
	inFlight = true;
	try {
		// The in-app backend derives the same metrics view the server would
		// (playtime, sessions, action counts, activation, achievements).
		const res = await api.metrics(pid);
		const player = res?.player;
		if (!player) return true;
		// Drop the bulky per-biome block — biome health is already in biomeSummary.
		const { biomes: _biomes, ...snapshot } = player as any;
		const body = JSON.stringify({
			clientId: slot.slotId,
			name: slot.name,
			platform: IS_DESKTOP ? 'desktop' : 'web',
			os: detectOS(),
			version: APP_VERSION,
			build: BUILD_TIME,
			language: getLocale(),
			// edition rides inside the snapshot JSON (SoloMetrics is a fixed-column
			// table), so the dashboard can split demo vs paid solo players.
			snapshot: { ...snapshot, edition: EDITION },
		});
		lastPayload = body; // cache for the closing beacon
		await fetch(endpoint(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			keepalive: true,
			signal: AbortSignal.timeout(10_000),
			body,
		});
	} catch {
		/* offline or server unreachable — fine for solo; the next report re-sends */
	} finally {
		inFlight = false;
	}
	return true;
}

/** Fire-and-forget synchronous flush for page close — uses the last cached
 *  snapshot (the hidden-flush above refreshes it just before this runs), which
 *  survives the window being torn down where a normal fetch would not. */
function beaconFlush(): void {
	if (getTransport() !== 'solo' || !lastPayload) return;
	try {
		navigator.sendBeacon?.(endpoint(), new Blob([lastPayload], { type: 'application/json' }));
	} catch {
		/* ignore — nothing else we can do at unload */
	}
}

/** Keep trying the first report until the save slot is registered (it lands a
 *  beat after the session id), so a fresh save always reports promptly. */
function scheduleStartupReport(): void {
	if (startupTimer != null) return; // a retry loop is already running
	startupTries = 0;
	const attempt = () => {
		startupTimer = null;
		void reportOnce().then((sent) => {
			if (sent) return; // reported (or not solo) — done
			if (startupTries++ >= STARTUP_MAX_TRIES) return;
			startupTimer = window.setTimeout(attempt, STARTUP_RETRY_MS);
		});
	};
	attempt();
}

/** Send a report soon (used right after a solo session starts). */
export function pokeMetricsUplink(): void {
	scheduleStartupReport();
}

/** Start periodic metric uplink (idempotent; no-ops outside solo sessions). */
export function startMetricsUplink(): void {
	if (timer != null) return;
	timer = window.setInterval(() => void reportOnce(), REPORT_MS);
	// A fresh async report the moment the page is hidden (tab switch, minimize,
	// or closing) — this is the reliable "session ending" hook and refreshes the
	// cached snapshot the beacon will send.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void reportOnce();
	});
	// Synchronous last-ditch flush on the way out.
	window.addEventListener('pagehide', beaconFlush);
	window.addEventListener('beforeunload', beaconFlush);
	// Try to report right away (retried until the slot is ready), so metrics land
	// even if the session-start poke in state.tsx raced the slot registration.
	scheduleStartupReport();
}

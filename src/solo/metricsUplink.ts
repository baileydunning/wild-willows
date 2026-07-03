// Solo only: periodically push the local save's metrics view to the hosted
// Harper (POST /SyncMetrics/ → SoloMetrics table), so solo players show up on
// the same /Metrics/ dashboards as web/co-op players. The mirror image of
// steamSync.ts, but over the network instead of IPC.
//
// Strictly best-effort: solo is designed to work fully offline, so a failed
// send is silently dropped — the next interval (or next session) re-sends the
// current totals, and because each report is a full snapshot keyed by the
// save slot's UUID, missed reports lose nothing once a connection returns.

import { api, getPlayerId, getSoloSlot, getTransport, COOP_BASE_URL, IS_DESKTOP } from '../api';
import { APP_VERSION, BUILD_TIME, detectOS } from '../platform';

const REPORT_MS = 5 * 60 * 1000; // network-friendly cadence; Steam's local sync stays at 60s

let timer: number | null = null;
let inFlight = false;

async function reportOnce(): Promise<void> {
	if (inFlight) return;
	if (getTransport() !== 'solo') return; // web/co-op metrics already live on the hosted Harper
	const pid = getPlayerId();
	const slot = getSoloSlot();
	if (!pid || !slot) return; // no active solo session
	inFlight = true;
	try {
		// The in-app backend derives the same metrics view the server would
		// (playtime, sessions, action counts, activation, achievements).
		const res = await api.metrics(pid);
		const player = res?.player;
		if (!player) return;
		// Drop the per-biome block — it's the bulky part and biome health is
		// already summarized in biomeSummary.
		const { biomes: _biomes, ...snapshot } = player as any;

		const base = IS_DESKTOP ? COOP_BASE_URL : '';
		await fetch(`${base}/SyncMetrics/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			keepalive: true, // lets the tab-hidden / closing flush complete
			signal: AbortSignal.timeout(10_000), // a hung Harper just skips this report
			body: JSON.stringify({
				clientId: slot.slotId,
				name: slot.name,
				platform: IS_DESKTOP ? 'desktop' : 'web',
				os: detectOS(), // mac / windows / linux / …
				version: APP_VERSION,
				build: BUILD_TIME,
				snapshot,
			}),
		});
	} catch {
		/* offline or server unreachable — totally fine for solo */
	} finally {
		inFlight = false;
	}
}

/** Send a report soon (used right after a solo session starts). */
export function pokeMetricsUplink(): void {
	void reportOnce();
}

/** Start periodic metric uplink (idempotent; no-ops outside solo sessions). */
export function startMetricsUplink(): void {
	if (timer != null) return;
	timer = window.setInterval(() => void reportOnce(), REPORT_MS);
	// Flush when the window hides/closes so the final session numbers land.
	window.addEventListener('beforeunload', () => void reportOnce());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void reportOnce();
	});
}

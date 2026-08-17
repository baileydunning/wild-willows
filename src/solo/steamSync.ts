// Desktop only: periodically push the active player's metrics to the main
// process, which maps them onto Steam Stats/Achievements (electron/metrics-sync).
//
// The renderer owns the live game state now (solo runs in-app; hosted play talks to
// the hosted Harper), so this is where the numbers come from. Everything no-ops
// when there's no desktop bridge or no Steam.

import { api, getPlayerId } from '../api';

const REPORT_MS = 60 * 1000;
let timer: number | null = null;

interface SteamBridge {
	isDesktop?: boolean;
	steam?: { reportMetrics(player: any): void };
}
const bridge = (): SteamBridge | null => (globalThis as any).wildWillowsDesktop || null;

async function reportOnce() {
	const b = bridge();
	if (!b?.isDesktop || !b.steam?.reportMetrics) return;
	const pid = getPlayerId();
	if (!pid) return; // no active game
	try {
		const res = await api.metrics(pid);
		if (res?.player) b.steam.reportMetrics(res.player);
	} catch {
		/* metrics are best-effort; never disrupt play */
	}
}

/** Start periodic Steam metric reporting (idempotent, desktop-only). */
export function startSteamReporting() {
	const b = bridge();
	if (!b?.isDesktop || !b.steam?.reportMetrics || timer != null) return;
	timer = window.setInterval(reportOnce, REPORT_MS);
	void reportOnce();
	// Flush once more when the window is hidden/closing so the final session
	// numbers reach Steam.
	window.addEventListener('beforeunload', () => void reportOnce());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void reportOnce();
	});
}

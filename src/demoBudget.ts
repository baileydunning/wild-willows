// DEMO only: the play budget that ends the demo, and where it is kept.
//
// The demo's shape is unchanged — restore the starter meadow, unlock the forest,
// get a taste of what's past it — but what gets measured is not. The old rule
// counted wall-clock spent standing IN the forest, in a `useRef`, and it leaked
// the whole game through three holes at once:
//
//   1. A ref starts at zero on every page load. Reloading the tab — or just
//      coming back tomorrow — handed out a fresh budget, no cheating
//      required.
//   2. The save is deleted when the thank-you popup is DISMISSED, not when the
//      demo completes (the export button needs something to read). Reload
//      instead of clicking the button and the save survived with the popup gone.
//   3. The clock only ran in the forest. A player who unlocked the wetland —
//      which the demo never blocked, because biome unlocks are ordinary game
//      rules — could play there, and in the meadow, forever, with the demo's
//      only stopwatch frozen.
//
// One player did all three: 45 minutes of forest across four sessions, the
// completion flag already set server-side, and three biomes open.
//
// So the budget now measures TIME SINCE THE FOREST UNLOCKED, wherever they
// spend it, and it lives in localStorage keyed to the save. Reloading resumes
// the same clock rather than restarting it, and a save whose budget is already
// spent puts the popup straight back up on load (see the demo gate in
// src/state.tsx).
//
// This is a demo, not a licence check: someone who clears site data gets to play
// the demo again, the same as someone who opens it in a private window. Making
// that impossible would mean holding the budget server-side, which the offline
// solo fallback (see DEMO_WEB_BACKEND in src/demo.ts) has no server for. The
// hole worth closing is the one an ordinary player falls through by accident,
// and reloading a tab is that hole.

/** Minutes of play after the forest unlocks before the demo hard-stops. */
export const DEMO_BUDGET_MINUTES = 10;

/** Same limit in milliseconds. */
export const DEMO_BUDGET_MS = DEMO_BUDGET_MINUTES * 60 * 1000;

/** How often the budget clock ticks. Nothing here needs second-precision. */
const TICK_MS = 1000;

/**
 * How often accrued time is written to storage. Every tick would be a
 * localStorage write per second for the length of the demo; five seconds is the
 * most a reload can rewind the clock, and the budget is also flushed whenever
 * the page goes away (see the hide/pagehide handlers below), so a normal close
 * loses nothing at all.
 */
const PERSIST_EVERY_MS = 5000;

const BUDGET_KEY = 'wild-willows:demo-budget';

/**
 * Stored against the save id, not on its own.
 *
 * The demo hands out a fresh player id per save, and a spent budget left lying
 * around under a bare key would end the NEXT demo save the moment it opened —
 * including the one a player starts after dismissing the popup, who has the
 * whole meadow to restore before the forest is theirs again. Keying by id makes
 * a stale entry inert rather than punishing.
 */
interface StoredBudget {
	id: string;
	ms: number;
}

/** Accrued post-unlock milliseconds for this save; 0 for a save we've not seen. */
export function readDemoBudgetMs(playerId: string | null | undefined): number {
	if (!playerId) return 0;
	try {
		const raw = localStorage.getItem(BUDGET_KEY);
		if (!raw) return 0;
		const parsed = JSON.parse(raw) as StoredBudget | null;
		if (!parsed || parsed.id !== playerId) return 0;
		const ms = Number(parsed.ms);
		// Junk (hand-edited, half-written, NaN) reads as a fresh budget rather than
		// as an instant hard-stop: a player wrongly cut off mid-demo is a worse
		// failure than one who gets a few extra minutes.
		return Number.isFinite(ms) && ms > 0 ? ms : 0;
	} catch {
		return 0;
	}
}

/** Record accrued post-unlock milliseconds for this save. */
export function saveDemoBudgetMs(playerId: string | null | undefined, ms: number): void {
	if (!playerId) return;
	try {
		localStorage.setItem(BUDGET_KEY, JSON.stringify({ id: playerId, ms: Math.max(0, Math.round(ms)) }));
	} catch {
		/* private mode — the budget degrades to per-session, as it was before */
	}
}

/** Forget the budget. Called when the demo save is deleted, so the next save starts clean. */
export function clearDemoBudget(): void {
	try {
		localStorage.removeItem(BUDGET_KEY);
	} catch {
		/* ignore */
	}
}

export interface DemoBudgetOptions {
	/** The save this budget belongs to. */
	playerId: string;
	/**
	 * True while the clock should run: the forest is unlocked and the player is
	 * actually here. The caller owns that judgement — it reads live game state and
	 * the same input-idle gate the heartbeat uses, so that "10 minutes of play"
	 * means the same thing the dashboard's play time means.
	 */
	running: () => boolean;
	/** Called once, when the budget is spent. The watcher stops itself first. */
	onSpent: () => void;
	budgetMs?: number;
	tickMs?: number;
	persistEveryMs?: number;
	/** Injectable clock, so tests don't have to move real time. */
	now?: () => number;
}

/**
 * Accrue the post-unlock budget and call `onSpent` when it runs out.
 *
 * Returns an unsubscribe that flushes the accrued total before it stops, so a
 * teardown — React re-running the effect, the save changing hands, the player
 * logging out — never drops the seconds since the last write.
 */
export function watchDemoBudget({
	playerId,
	running,
	onSpent,
	budgetMs = DEMO_BUDGET_MS,
	tickMs = TICK_MS,
	persistEveryMs = PERSIST_EVERY_MS,
	now = () => Date.now(),
}: DemoBudgetOptions): () => void {
	let spentMs = readDemoBudgetMs(playerId);
	let last = now();
	let unsaved = 0;
	let done = false;

	const persist = () => {
		if (unsaved <= 0) return;
		unsaved = 0;
		saveDemoBudgetMs(playerId, spentMs);
	};

	const tick = () => {
		const at = now();
		const dt = at - last;
		last = at;
		if (done || !running()) return;
		// A machine that slept, or a tab the browser throttled to one wake a minute,
		// reports a single enormous delta for time nobody was playing. Credit at most
		// one tick's worth per tick: the clock measures play, and a laptop lid is not
		// play. (`running()` already excludes a hidden tab, so this only catches the
		// cases where the page was visible but the timer was not.)
		spentMs += Math.min(Math.max(dt, 0), tickMs * 2);
		unsaved += Math.min(Math.max(dt, 0), tickMs * 2);
		if (unsaved >= persistEveryMs) persist();
		if (spentMs >= budgetMs) {
			done = true;
			persist();
			stop();
			onSpent();
		}
	};

	const timer = setInterval(tick, tickMs);

	// Closing the tab, switching apps, or a phone locking are all the same event as
	// far as the budget is concerned: the page may not come back, so write what we
	// have. `pagehide` is the one that fires reliably on mobile Safari, where
	// `beforeunload` does not.
	const flush = () => persist();
	const onHide = () => {
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') persist();
	};

	function stop() {
		clearInterval(timer);
		if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
		if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
	}

	if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
	if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);

	return () => {
		persist();
		stop();
	};
}

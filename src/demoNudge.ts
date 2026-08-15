// DEMO only: when to raise the "Are you done playing?" prompt.
//
// The demo's own hard-stop (10 minutes in the forest — see src/demo.ts) is the
// ONLY moment the game currently asks anyone to carry their save across. Most
// demo players never reach it: they wander off mid-meadow, or tab away to
// something else and drift back, and the session ends with a save they never
// knew they could keep. That's the conversion the demo is losing — not people
// who played to the end and said no, but people who stopped playing without
// ever being offered the door.
//
// So watch for the two shapes "I'm done" actually takes in a browser game:
//
//   idle     — the window is open, in front of them, and nothing has been
//              touched for DEMO_NUDGE_IDLE_MS. They walked away.
//   returned — the tab was hidden (or the window unfocused) for at least
//              DEMO_NUDGE_AWAY_MS and has just come back. They left and
//              something brought them back — the best moment there is to ask
//              whether they want to keep what they built.
//
// Both are soft signals, so this fires AT MOST ONCE per watcher and the prompt
// it raises is dismissible (see src/ui/DemoNudge.tsx). A nagging demo is worse
// than a quiet one: someone who says "keep playing" has answered the question,
// and asking again is how a nudge turns into an ad.
//
// Deliberately NOT a heartbeat concern, even though src/state.tsx already tracks
// input idleness for play-time accounting. That gate is 30 minutes and exists to
// stop an abandoned tab inflating play time; this one is 5 minutes and exists to
// catch a player before they close it. Same raw events, opposite questions —
// tying them together would mean one window serving both, badly.

/** Untouched-but-open this long (ms) and we assume they've stopped playing. */
export const DEMO_NUDGE_IDLE_MS = 5 * 60 * 1000;

/**
 * Away this long (ms) before a return counts as "they left and came back".
 *
 * Deliberately short: switching to another tab and coming back IS the signal, so
 * anything long enough to feel like a threshold defeats the point. All this
 * filters out is sub-second noise — a spurious blur, a browser dialog, focus
 * bouncing off a download prompt — none of which is a player leaving.
 */
export const DEMO_NUDGE_AWAY_MS = 5 * 1000;

/** How often the idle check runs. Nothing here needs second-precision. */
const TICK_MS = 5000;

/**
 * The events that count as "someone is playing". Same four the heartbeat's idle
 * gate uses, and deliberately NOT pointermove: a cursor crossing the window on
 * its way somewhere else is not someone playing.
 */
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export type DemoNudgeReason = 'idle' | 'returned';

export interface DemoNudgeOptions {
	idleMs?: number;
	awayMs?: number;
	/** Injectable clock, so tests don't have to move real time. */
	now?: () => number;
}

/**
 * Watch for either "done playing" signal and call `fire` the first time one
 * lands. Returns an unsubscribe that also stops the timer; safe to call after
 * firing (the watcher has already torn itself down by then).
 */
export function watchDemoNudge(
	fire: (reason: DemoNudgeReason) => void,
	{ idleMs = DEMO_NUDGE_IDLE_MS, awayMs = DEMO_NUDGE_AWAY_MS, now = () => Date.now() }: DemoNudgeOptions = {},
): () => void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

	let lastInputAt = now();
	let awaySince: number | null = null;
	let spent = false;

	const seen = () => {
		lastInputAt = now();
	};

	// Hidden and unfocused are tracked as ONE "away" span. A tab switch fires both
	// (blur, then visibilitychange) and coming back fires both again, so only the
	// first of each pair may move the clock — otherwise the second one measures a
	// zero-length absence and swallows the trip.
	const away = () => {
		if (spent || awaySince !== null) return;
		awaySince = now();
	};

	const back = () => {
		if (spent || awaySince === null) return;
		// A `focus` while the tab is still hidden isn't a return. Wait for the one
		// that comes with the page actually being on screen.
		if (document.visibilityState === 'hidden') return;
		const goneMs = now() - awaySince;
		awaySince = null;
		// Coming back IS engagement, so the idle clock starts over from here. Without
		// this, an absence longer than the away threshold but shorter than the idle
		// one would leave them a few seconds from a popup the moment they returned.
		lastInputAt = now();
		if (goneMs >= awayMs) trigger('returned');
	};

	const onVisibility = () => (document.visibilityState === 'hidden' ? away() : back());

	const tick = () => {
		if (spent) return;
		// While the page is hidden the away path owns this; counting idle time on top
		// would fire the moment they came back, which is the one time we know they
		// haven't walked off.
		if (document.visibilityState === 'hidden') return;
		if (now() - lastInputAt >= idleMs) trigger('idle');
	};

	const timer = setInterval(tick, TICK_MS);

	function trigger(reason: DemoNudgeReason) {
		if (spent) return;
		spent = true;
		stop();
		fire(reason);
	}

	function stop() {
		clearInterval(timer);
		for (const e of INPUT_EVENTS) window.removeEventListener(e, seen);
		window.removeEventListener('blur', away);
		window.removeEventListener('focus', back);
		document.removeEventListener('visibilitychange', onVisibility);
	}

	for (const e of INPUT_EVENTS) window.addEventListener(e, seen, { passive: true });
	window.addEventListener('blur', away);
	window.addEventListener('focus', back);
	document.addEventListener('visibilitychange', onVisibility);

	return stop;
}

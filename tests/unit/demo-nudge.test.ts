import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { watchDemoNudge, DEMO_NUDGE_IDLE_MS, DEMO_NUDGE_AWAY_MS } from '../../src/demoNudge';

// The demo's "are you done playing?" prompt is raised by a watcher that has to be
// right about two things at once: it must catch a player who has genuinely
// stopped, and it must never interrupt one who hasn't. A popup over a game
// someone is still playing is worse than no popup at all — so the wrong-way
// failures (a two-second tab-out, a second prompt after the first was answered)
// are pinned here just as hard as the firing cases.

/** Pretend the page went hidden / came back, the way a real tab switch does. */
function setVisibility(v: 'visible' | 'hidden') {
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(v);
	document.dispatchEvent(new Event('visibilitychange'));
	window.dispatchEvent(new Event(v === 'hidden' ? 'blur' : 'focus'));
}

describe('the demo nudge watcher', () => {
	let stop: () => void = () => undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
	});

	afterEach(() => {
		stop();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('fires once the window has sat untouched for the idle window', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		vi.advanceTimersByTime(DEMO_NUDGE_IDLE_MS - 10_000);
		expect(fire).not.toHaveBeenCalled();

		vi.advanceTimersByTime(20_000);
		expect(fire).toHaveBeenCalledWith('idle');
	});

	it('starts the idle clock over on any real input', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		// Four minutes in, they click something: the clock restarts, so the original
		// five-minute mark must pass without a prompt.
		vi.advanceTimersByTime(4 * 60_000);
		window.dispatchEvent(new Event('pointerdown'));
		vi.advanceTimersByTime(2 * 60_000);
		expect(fire).not.toHaveBeenCalled();

		vi.advanceTimersByTime(4 * 60_000);
		expect(fire).toHaveBeenCalledWith('idle');
	});

	it('fires when they come back from being away a while', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		setVisibility('hidden');
		vi.advanceTimersByTime(DEMO_NUDGE_AWAY_MS + 5_000);
		expect(fire).not.toHaveBeenCalled(); // not while they're gone

		setVisibility('visible');
		expect(fire).toHaveBeenCalledWith('returned');
	});

	it('ignores a quick flick to another window', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		setVisibility('hidden');
		vi.advanceTimersByTime(3_000);
		setVisibility('visible');
		expect(fire).not.toHaveBeenCalled();
	});

	it('does not count time away as time idle', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		// Away for longer than the IDLE window: the return is what gets judged, and
		// the idle clock starts fresh from it — otherwise someone who left for ten
		// minutes would be told they'd stopped playing the instant they came back,
		// which is the one moment we know they hadn't.
		setVisibility('hidden');
		vi.advanceTimersByTime(DEMO_NUDGE_IDLE_MS * 2);
		expect(fire).not.toHaveBeenCalled();
	});

	it('asks at most once, however many signals land', () => {
		const fire = vi.fn();
		stop = watchDemoNudge(fire);

		vi.advanceTimersByTime(DEMO_NUDGE_IDLE_MS + 10_000);
		vi.advanceTimersByTime(DEMO_NUDGE_IDLE_MS * 3);
		setVisibility('hidden');
		vi.advanceTimersByTime(DEMO_NUDGE_AWAY_MS * 2);
		setVisibility('visible');
		expect(fire).toHaveBeenCalledTimes(1);
	});

	it('goes quiet after it is stopped', () => {
		const fire = vi.fn();
		watchDemoNudge(fire)();

		vi.advanceTimersByTime(DEMO_NUDGE_IDLE_MS * 2);
		setVisibility('hidden');
		vi.advanceTimersByTime(DEMO_NUDGE_AWAY_MS * 2);
		setVisibility('visible');
		expect(fire).not.toHaveBeenCalled();
	});
});

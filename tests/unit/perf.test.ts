import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleFlush, cancelFlush, flushNow, adaptiveInterval, ewma, perfSnapshot, resetPerf } from '../../src/perf';

// The flush scheduler is what keeps a burst of world/settings events from doing
// the same expensive rebuild many times in one frame, and what backs that work
// off when it turns out to be slow. These tests drive requestAnimationFrame
// manually so frames are deterministic.

let frameQueue: FrameRequestCallback[] = [];
let rafSpy: any;

/** Advance exactly one animation frame. */
function tick(steps = 1) {
	for (let i = 0; i < steps; i++) {
		const due = frameQueue;
		frameQueue = [];
		for (const cb of due) cb(performance.now());
	}
}

beforeEach(() => {
	resetPerf();
	frameQueue = [];
	rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
		frameQueue.push(cb);
		return frameQueue.length;
	});
});

afterEach(() => {
	// Restore ALL spies — several tests stub performance.now, and a leaked stub
	// would silently corrupt the timings the next test measures.
	vi.restoreAllMocks();
	resetPerf();
});

describe('coalescing', () => {
	it('collapses a burst of requests into a single run', () => {
		const fn = vi.fn();
		// Stand-in for dragging a slider: 100 change events inside one frame.
		for (let i = 0; i < 100; i++) scheduleFlush('world', fn);
		expect(fn).not.toHaveBeenCalled(); // nothing runs inline
		tick();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('runs the newest callback, which closes over the freshest state', () => {
		const seen: number[] = [];
		for (const v of [1, 2, 3]) scheduleFlush('world', () => seen.push(v));
		tick();
		expect(seen).toEqual([3]);
	});

	it('keeps separate keys independent', () => {
		const world = vi.fn();
		const prefs = vi.fn();
		scheduleFlush('world', world);
		scheduleFlush('prefs', prefs);
		tick();
		expect(world).toHaveBeenCalledTimes(1);
		expect(prefs).toHaveBeenCalledTimes(1);
	});

	it('runs again on a later frame when requested again', () => {
		const fn = vi.fn();
		scheduleFlush('world', fn);
		tick();
		scheduleFlush('world', fn);
		tick();
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('does not run at all if nothing was requested', () => {
		const fn = vi.fn();
		scheduleFlush('world', fn);
		tick();
		tick(5); // idle frames
		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe('self-correction', () => {
	it('keeps a cheap task running every frame', () => {
		const fn = vi.fn(); // ~0ms
		for (let i = 0; i < 5; i++) {
			scheduleFlush('cheap', fn);
			tick();
		}
		expect(fn).toHaveBeenCalledTimes(5);
		expect(perfSnapshot().cheap.skip).toBe(1);
	});

	it('backs a slow task off to fewer frames, and still runs it', () => {
		let clock = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => clock);
		// A rebuild that takes 40ms — far over the ~8ms budget.
		const slow = vi.fn(() => {
			clock += 40;
		});

		scheduleFlush('slow', slow);
		tick();
		expect(slow).toHaveBeenCalledTimes(1); // first run always happens

		const skip = perfSnapshot().slow.skip;
		expect(skip).toBeGreaterThan(1); // learned that it is expensive

		// Requested every frame from here on; it must run less often than that…
		const before = slow.mock.calls.length;
		for (let i = 0; i < 12; i++) {
			scheduleFlush('slow', slow);
			tick();
		}
		const runs = slow.mock.calls.length - before;
		expect(runs).toBeLessThan(12);
		expect(runs).toBeGreaterThan(0); // …but never starve
	});

	it('recovers on its own once the work gets cheap again', () => {
		let clock = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => clock);
		let cost = 40;
		const task = vi.fn(() => {
			clock += cost;
		});

		for (let i = 0; i < 6; i++) {
			scheduleFlush('t', task);
			tick(20);
		}
		expect(perfSnapshot().t.skip).toBeGreaterThan(1);

		cost = 0; // world shrank / player moved to a light area
		for (let i = 0; i < 40; i++) {
			scheduleFlush('t', task);
			tick(20);
		}
		expect(perfSnapshot().t.skip).toBe(1); // back to every frame, no manual reset
	});

	it('never defers a task indefinitely, however slow it is', () => {
		let clock = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => clock);
		const awful = vi.fn(() => {
			clock += 5000;
		});
		scheduleFlush('awful', awful);
		tick();
		expect(perfSnapshot().awful.skip).toBeLessThanOrEqual(16);

		scheduleFlush('awful', awful);
		tick(16);
		expect(awful).toHaveBeenCalledTimes(2); // ran within the cap
	});
});

describe('cancel and force', () => {
	it('cancelFlush drops pending work so a torn-down scene is not repainted', () => {
		const fn = vi.fn();
		scheduleFlush('scene:1:world', fn);
		cancelFlush('scene:1:world');
		tick(3);
		expect(fn).not.toHaveBeenCalled();
	});

	it('flushNow runs pending work immediately, ignoring backoff', () => {
		const fn = vi.fn();
		scheduleFlush('world', fn);
		flushNow('world');
		expect(fn).toHaveBeenCalledTimes(1);
		tick(); // already consumed — no double run
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('flushNow on a key with nothing pending is a no-op', () => {
		const fn = vi.fn();
		scheduleFlush('world', fn);
		tick();
		flushNow('world'); // already ran
		expect(fn).toHaveBeenCalledTimes(1);
		flushNow('never-scheduled');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('a throwing task does not stop the others or wedge the scheduler', () => {
		const boom = vi.fn(() => {
			throw new Error('nope');
		});
		const ok = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		scheduleFlush('boom', boom);
		scheduleFlush('ok', ok);
		tick();
		expect(ok).toHaveBeenCalledTimes(1);
		scheduleFlush('ok', ok);
		tick();
		expect(ok).toHaveBeenCalledTimes(2);
	});
});

describe('adaptiveInterval (autosave window)', () => {
	it('holds the floor while saving is cheap', () => {
		expect(adaptiveInterval(6, 1500, 12000, 0.03)).toBe(1500);
		expect(adaptiveInterval(0, 1500, 12000, 0.03)).toBe(1500);
	});

	it('stretches as saving gets expensive, so it stays a small duty cycle', () => {
		// 90ms per save at a 3% duty cycle -> 3s between saves.
		expect(adaptiveInterval(90, 1500, 12000, 0.03)).toBe(3000);
		expect(adaptiveInterval(200, 1500, 12000, 0.03)).toBeGreaterThan(3000);
	});

	it('caps the backoff, bounding how much progress a crash can cost', () => {
		expect(adaptiveInterval(100_000, 1500, 12000, 0.03)).toBe(12000);
	});

	it('is monotonic in cost', () => {
		let prev = 0;
		for (const cost of [1, 10, 50, 100, 250, 500, 1000]) {
			const v = adaptiveInterval(cost, 1500, 12000, 0.03);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});

describe('ewma', () => {
	it('seeds from the first sample instead of easing up from zero', () => {
		expect(ewma(0, 40)).toBe(40);
	});

	it('moves toward new samples without letting one spike dominate', () => {
		const after = ewma(10, 100, 0.25);
		expect(after).toBeGreaterThan(10);
		expect(after).toBeLessThan(100);
	});
});

// Frame-coalesced, self-correcting scheduler for the world "flush" — the redraw
// and persist work the game does in response to player actions and settings
// changes.
//
// Why this exists. Every action emitted `world-dirty`, and every preference
// change notified the world scene, and each of those ran its rebuild
// SYNCHRONOUSLY, inline with the event. Two consequences, both reported as the
// game becoming unplayable:
//
//   • A burst of events did the same expensive work many times in a single
//     frame. Dragging a volume slider fires a change per pixel of travel, so the
//     animal layer and weather particles were torn down and rebuilt ~60×/second
//     for a preference the world doesn't even draw from.
//   • The cost of each rebuild grows with the save (terrain, placements,
//     discoveries), so a long session degrades until the frame budget is gone.
//
// Two rules fix that:
//
//   1. COALESCE. Work is keyed and runs at most once per animation frame, no
//      matter how many times it was requested in between. The last request for a
//      key wins, since it closes over the freshest state.
//   2. SELF-CORRECT. Every run is timed. A task that consistently overruns its
//      slice of the frame is automatically run less often — every Nth frame —
//      and recovers on its own once it is cheap again. A heavy save degrades to
//      a lower redraw rate instead of locking the game up, with no player-facing
//      setting to find and no permanent state to get stuck in.
//
// Deliberately dependency-free and DOM-optional so it can be imported from the
// Phaser scene, React, and plain modules alike.

const FRAME_MS = 1000 / 60;

/** How much of one frame a single task may take before it gets backed off.
 *  Half a frame leaves room for Phaser's own render plus React. */
const BUDGET_MS = FRAME_MS / 2;

/** Never defer a task more than this many frames (~270ms at 60fps). Past this
 *  the world would feel unresponsive, which is worse than the hitch. */
const MAX_SKIP = 16;

/** Weight for the newest sample in the cost/frame moving averages. Low enough
 *  that one unlucky frame (a GC pause, a background tab waking) can't pin a task
 *  into heavy backoff, high enough to react within a few frames. */
const ALPHA = 0.25;

/** Above this average frame time the device is struggling for reasons beyond any
 *  one task, so everything backs off a step. ~2 frames at 60fps. */
const FRAME_STRESS_MS = 33;

interface Task {
	fn: () => void;
	/** EWMA of how long this task takes to run, ms. */
	cost: number;
	/** Frames waited since this task was requested. */
	waited: number;
	pending: boolean;
	/** Total runs — exposed for diagnostics/tests. */
	runs: number;
}

const tasks = new Map<string, Task>();

/** Pending `coalesceAfter` timers, keyed the same way `tasks` is. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let scheduled = false;
let lastFrameAt = 0;
/** EWMA of observed frame interval, used as a whole-device health signal. */
let frameMs = FRAME_MS;

const now = (): number =>
	typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/** Next-frame callback, falling back to a timer where rAF doesn't exist (Node,
 *  tests, a hidden tab where rAF stops firing entirely). */
function nextFrame(cb: () => void): void {
	if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => cb());
	else setTimeout(cb, FRAME_MS);
}

/** How many frames this task should wait between runs, given what it costs.
 *  1 = every frame. Grows linearly once a task overruns its budget. */
function skipFor(task: Task): number {
	let skip = Math.ceil(task.cost / BUDGET_MS);
	// The whole device is behind, not just this task — give the frame room.
	if (frameMs > FRAME_STRESS_MS) skip *= 2;
	return Math.min(MAX_SKIP, Math.max(1, skip || 1));
}

function runFrame(): void {
	scheduled = false;

	const t = now();
	if (lastFrameAt) {
		const delta = t - lastFrameAt;
		// runFrame only runs when work is PENDING, so consecutive samples are not
		// consecutive frames — the gap between two flush bursts is idle time, not
		// render time. The old 1000ms guard let a normal half-second pause between
		// two gathers land in the average as a "137ms frame", which tripped
		// FRAME_STRESS_MS and made every registered task back off (up to MAX_SKIP
		// frames) on a machine that was rendering a flawless 60fps.
		//
		// A genuine stress frame is tens of milliseconds, so anything past 100ms is
		// an idle gap and tells us nothing about how fast this device renders.
		if (delta < 100) frameMs += (delta - frameMs) * ALPHA;
	}
	lastFrameAt = t;

	let stillPending = false;
	for (const task of tasks.values()) {
		if (!task.pending) continue;
		task.waited++;
		if (task.waited < skipFor(task)) {
			stillPending = true;
			continue;
		}
		task.pending = false;
		task.waited = 0;
		task.runs++;
		const started = now();
		try {
			task.fn();
		} catch (e) {
			console.error('flush task failed', e);
		}
		const elapsed = now() - started;
		// Seed on the first sample instead of easing up from zero, so a genuinely
		// expensive task backs off immediately rather than hitching a few times.
		task.cost = task.runs === 1 ? elapsed : task.cost + (elapsed - task.cost) * ALPHA;
	}

	if (stillPending) schedule();
}

function schedule(): void {
	if (scheduled) return;
	scheduled = true;
	nextFrame(runFrame);
}

/**
 * Request `fn` for `key`, to run on a coming frame. Repeat requests before it
 * runs collapse into one; the newest `fn` is the one that runs.
 */
export function scheduleFlush(key: string, fn: () => void): void {
	const task = tasks.get(key);
	if (task) {
		task.fn = fn;
		if (!task.pending) {
			task.pending = true;
			task.waited = 0;
		}
	} else {
		tasks.set(key, { fn, cost: 0, waited: 0, pending: true, runs: 0 });
	}
	schedule();
}

/** Drop a pending request (scene teardown, unmount). Keeps the learned cost so a
 *  remounted scene doesn't have to rediscover that it is slow. */
export function cancelFlush(key: string): void {
	const task = tasks.get(key);
	if (task) {
		task.pending = false;
		task.waited = 0;
	}
}

/** Run a pending task right now, skipping both the frame wait and the backoff.
 *  For moments correctness beats smoothness — quitting, saving, screenshotting. */
export function flushNow(key: string): void {
	const task = tasks.get(key);
	if (!task?.pending) return;
	task.pending = false;
	task.waited = 0;
	task.runs++;
	const started = now();
	try {
		task.fn();
	} catch (e) {
		console.error('flush task failed', e);
	}
	const elapsed = now() - started;
	task.cost = task.runs === 1 ? elapsed : task.cost + (elapsed - task.cost) * ALPHA;
}

/**
 * Adaptive interval for periodic work that isn't frame-bound — the solo autosave.
 * Given what one run costs, return how long to wait between runs so the work
 * occupies no more than `duty` of wall-clock time, clamped to [min, max].
 *
 * A cheap save keeps its normal cadence; a save that has grown to 200ms stretches
 * out instead of stealing a fifth of every second. `max` bounds how much progress
 * an unexpected quit can cost, so backing off never becomes unbounded data loss.
 */
export function adaptiveInterval(costMs: number, min: number, max: number, duty = 0.03): number {
	if (!(costMs > 0)) return min;
	return Math.min(max, Math.max(min, Math.round(costMs / duty)));
}

/** Fold a new sample into an exponential moving average (seeded by the first). */
export function ewma(prev: number, sample: number, alpha = ALPHA): number {
	return prev > 0 ? prev + (sample - prev) * alpha : sample;
}

/** Diagnostics: what the scheduler currently believes about each task. */
export function perfSnapshot(): Record<string, { costMs: number; skip: number; runs: number; pending: boolean }> {
	const out: Record<string, { costMs: number; skip: number; runs: number; pending: boolean }> = {};
	for (const [key, task] of tasks) {
		out[key] = {
			costMs: Math.round(task.cost * 100) / 100,
			skip: skipFor(task),
			runs: task.runs,
			pending: task.pending,
		};
	}
	return out;
}

/**
 * Time-coalesced sibling of `scheduleFlush`, for work that must be deferred by a
 * real interval rather than to the next frame.
 *
 * FIRST CALL WINS, and it arms the timer; every call for the same key inside the
 * window is dropped, because the run already queued will cover it. That is the
 * opposite of `scheduleFlush`'s last-writer-wins rule, and deliberately so: this
 * exists for events whose *fn is identical every time* (recalculate biome X) and
 * whose cost is a network round trip. Resetting the timer on each call — a plain
 * debounce — would let a steady drip of events postpone the work forever.
 *
 * Latency is therefore bounded at `ms`, no matter how many calls arrive.
 *
 * Why it exists: a row of plants sown in one sitting finishes growing at close to
 * the same moment, and every finish fired its own RecalcBiome POST plus a full
 * GameState refetch. Players reported the game dropping to 1 fps and needing a
 * page refresh. One round trip per burst is indistinguishable to them.
 */
export function coalesceAfter(key: string, ms: number, fn: () => void): void {
	if (timers.has(key)) return;
	timers.set(
		key,
		setTimeout(() => {
			timers.delete(key);
			try {
				fn();
			} catch (e) {
				console.error('coalesced task failed', e);
			}
		}, ms),
	);
}

/** Drop a queued coalesced run (teardown, or the work became irrelevant). */
export function cancelCoalesced(key: string): void {
	const t = timers.get(key);
	if (t === undefined) return;
	clearTimeout(t);
	timers.delete(key);
}

/** Observed average frame interval, ms. */
export const frameTimeMs = (): number => frameMs;

/** Test hook: forget all learned costs and pending work. Clears `scheduled` too —
 *  leaving it latched would make every later scheduleFlush a silent no-op, since
 *  it would keep believing a frame was already booked. */
export function resetPerf(): void {
	tasks.clear();
	frameMs = FRAME_MS;
	lastFrameAt = 0;
	scheduled = false;
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
}

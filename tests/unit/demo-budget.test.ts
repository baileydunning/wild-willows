import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	DEMO_BUDGET_MS,
	clearDemoBudget,
	readDemoBudgetMs,
	saveDemoBudgetMs,
	watchDemoBudget,
} from '../../src/demoBudget';

// Regression: a demo player finished the demo and then played for another hour and
// a half, into a third biome the demo was never meant to show.
//
// Nothing was hacked. The old hard-stop counted wall-clock spent standing in the
// forest, in a `useRef`, and every one of those three words was a hole: a ref
// resets on reload, "in the forest" stops counting the moment a player moves on,
// and the save outlives completion on purpose (the popup's export button needs
// something to read), so closing the tab at the thank-you screen kept everything.
//
// The budget now measures play since the forest unlocked, wherever it happens,
// and persists against the save. These tests pin all three holes shut — the
// reload case first, because it's the one an ordinary player falls through
// without ever meaning to.

const SAVE = 'player-1';

beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Run the watcher for `ms` with the clock running the whole time. */
function play(ms: number, opts: { playerId?: string; running?: () => boolean; onSpent?: () => void } = {}) {
	const stop = watchDemoBudget({
		playerId: opts.playerId ?? SAVE,
		running: opts.running ?? (() => true),
		onSpent: opts.onSpent ?? (() => undefined),
	});
	vi.advanceTimersByTime(ms);
	return stop;
}

describe('the demo budget survives the ways a player leaves', () => {
	it('THE BUG: a reload resumes the clock instead of restarting it', () => {
		const stop = play(DEMO_BUDGET_MS / 2);
		stop(); // the tab goes away

		// ...and comes back. Before the fix this session had the whole budget again.
		const spent = vi.fn();
		play(DEMO_BUDGET_MS / 2 + 2000, { onSpent: spent });
		expect(spent).toHaveBeenCalledTimes(1);
	});

	it('writes as it goes, so a tab closed without warning loses seconds, not minutes', () => {
		play(30_000);
		// No teardown, no unload — just gone.
		expect(readDemoBudgetMs(SAVE)).toBeGreaterThanOrEqual(25_000);
	});

	it('flushes the last unwritten seconds when the watcher is torn down', () => {
		const stop = play(7_000);
		stop();
		expect(readDemoBudgetMs(SAVE)).toBeGreaterThanOrEqual(6_000);
	});

	it('flushes when the page is hidden, which is all a phone gives you', () => {
		play(3_000);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		expect(readDemoBudgetMs(SAVE)).toBeGreaterThanOrEqual(2_000);
	});
});

describe('the budget measures play, not elapsed time', () => {
	it('does not run before the caller says it should (forest still locked, tab hidden, player idle)', () => {
		const spent = vi.fn();
		play(DEMO_BUDGET_MS * 2, { running: () => false, onSpent: spent });
		expect(spent).not.toHaveBeenCalled();
		expect(readDemoBudgetMs(SAVE)).toBe(0);
	});

	it('picks up again when play resumes, without crediting the gap', () => {
		let live = false;
		const stop = watchDemoBudget({ playerId: SAVE, running: () => live, onSpent: () => undefined });
		vi.advanceTimersByTime(10 * 60_000); // ten minutes away
		live = true;
		vi.advanceTimersByTime(60_000); // one minute of play
		stop();
		const ms = readDemoBudgetMs(SAVE);
		expect(ms).toBeGreaterThanOrEqual(55_000);
		expect(ms).toBeLessThan(90_000);
	});

	it('does not credit a slept machine or a throttled tab for the time it was gone', () => {
		// One tick, one enormous delta: a laptop lid, or a background tab woken once a
		// minute. Crediting it would end the demo while nobody was playing.
		let now = 0;
		const stop = watchDemoBudget({
			playerId: SAVE,
			running: () => true,
			onSpent: () => undefined,
			now: () => now,
		});
		now = 60 * 60_000; // an hour passes between two ticks
		vi.advanceTimersByTime(1000);
		stop();
		expect(readDemoBudgetMs(SAVE)).toBeLessThanOrEqual(2000);
	});
});

describe('the budget belongs to one save', () => {
	it('does not follow a spent budget onto the next demo save', () => {
		saveDemoBudgetMs(SAVE, DEMO_BUDGET_MS);
		// A player who dismissed the popup and started again has the whole meadow to
		// restore before the forest is theirs; ending their demo on load would be a
		// bug with the same shape as the one this file exists for, pointed the other way.
		expect(readDemoBudgetMs('player-2')).toBe(0);
	});

	it('is forgotten when the demo save is deleted', () => {
		saveDemoBudgetMs(SAVE, 60_000);
		clearDemoBudget();
		expect(readDemoBudgetMs(SAVE)).toBe(0);
	});

	it('reads as unspent with no save id at all', () => {
		saveDemoBudgetMs(SAVE, DEMO_BUDGET_MS);
		expect(readDemoBudgetMs(null)).toBe(0);
	});

	it('treats junk in storage as a fresh budget rather than an instant hard-stop', () => {
		localStorage.setItem('wild-willows:demo-budget', 'not json');
		expect(readDemoBudgetMs(SAVE)).toBe(0);
		localStorage.setItem('wild-willows:demo-budget', JSON.stringify({ id: SAVE, ms: 'soon' }));
		expect(readDemoBudgetMs(SAVE)).toBe(0);
	});

	it('round-trips through storage rather than module state', () => {
		saveDemoBudgetMs(SAVE, 90_000);
		expect(JSON.parse(localStorage.getItem('wild-willows:demo-budget') as string)).toEqual({
			id: SAVE,
			ms: 90_000,
		});
		expect(readDemoBudgetMs(SAVE)).toBe(90_000);
	});
});

describe('the hard-stop fires once', () => {
	it('calls onSpent exactly once and stops ticking', () => {
		const spent = vi.fn();
		play(DEMO_BUDGET_MS * 3, { onSpent: spent });
		expect(spent).toHaveBeenCalledTimes(1);
	});

	it('leaves the spent budget in storage, so the popup comes back on the next load', () => {
		// The save is NOT deleted at completion — that waits for the popup's export
		// button — so this is the only thing standing between a reload and the rest of
		// the game.
		play(DEMO_BUDGET_MS + 5_000, { onSpent: () => undefined });
		expect(readDemoBudgetMs(SAVE)).toBeGreaterThanOrEqual(DEMO_BUDGET_MS);
	});

	it('starts a session already over the limit without waiting out another tick', () => {
		saveDemoBudgetMs(SAVE, DEMO_BUDGET_MS);
		const spent = vi.fn();
		play(1500, { onSpent: spent });
		expect(spent).toHaveBeenCalledTimes(1);
	});
});

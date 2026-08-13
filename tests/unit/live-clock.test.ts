import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { liveTime, liveDayProgress, resetLiveClock } from '../../src/weather';

// The world's day runs on PLAY time, which reaches the client in ~30s heartbeat
// steps, while the on-screen clock ticks every frame. So a freshly fetched
// snapshot routinely reads BEHIND what the client is already showing.
//
// Following it there rewinds the sky. A player reported exactly that: "it went
// from dusk, then it got all light again, then it got dark." These pin the two
// rules that prevent it — never anchor backwards on a routine correction, and
// don't let the estimate run away while the tab is hidden in the first place.

const snap = (playMs: number, dayMs = 720_000) =>
	({ dayIndex: Math.floor(playMs / dayMs), dayProgress: (playMs % dayMs) / dayMs, dayMs }) as any;

beforeEach(() => {
	resetLiveClock();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-08-13T12:00:00Z'));
});

afterEach(() => {
	vi.useRealTimers();
	resetLiveClock();
});

describe('the day never runs backwards', () => {
	it('ignores a snapshot that lags the estimate, and keeps ticking', () => {
		liveTime(snap(600_000)); // anchor at 10 minutes of play time
		vi.advanceTimersByTime(20_000); // 20s of play later, we show 10:20
		expect(liveTime(snap(600_000))).toBe(620_000);

		// The heartbeat lands carrying play time from 15s ago. Older than what we
		// are showing — but it is not new information about the future.
		expect(liveTime(snap(605_000))).toBe(620_000);
	});

	it('takes a snapshot that has moved ahead, which is real news', () => {
		liveTime(snap(600_000));
		vi.advanceTimersByTime(5_000);
		// The preserve lived on without us (time passed server-side): jump forward.
		expect(liveTime(snap(900_000))).toBe(900_000);
	});

	it('never reports a smaller time than it did a moment ago', () => {
		liveTime(snap(600_000));
		let prev = 0;
		// A run of heartbeats, each lagging the live clock by a different amount.
		for (const lag of [4_000, 11_000, 2_000, 25_000, 9_000, 30_000]) {
			vi.advanceTimersByTime(3_000);
			const now = liveTime(snap(600_000 + 3_000 - lag));
			expect(now).toBeGreaterThanOrEqual(prev);
			prev = now;
		}
	});

	it('does not rewind the day phase across a lagging snapshot', () => {
		// Late in the day — the stretch where a rewind reads as dusk turning back
		// into afternoon.
		liveTime(snap(700_000));
		const before = liveDayProgress(snap(700_000))!;
		vi.advanceTimersByTime(10_000);
		const after = liveDayProgress(snap(690_000))!;
		expect(after).toBeGreaterThan(before);
	});

	it('still adopts a wildly different world, which is a new save and not lag', () => {
		liveTime(snap(50_000_000)); // a long-played save
		vi.advanceTimersByTime(1_000);
		expect(liveTime(snap(1_000))).toBe(1_000); // a fresh one, loaded
	});
});

describe('the estimate tracks play time, not wall time', () => {
	const hide = (hidden: boolean) => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => (hidden ? 'hidden' : 'visible'),
		});
		document.dispatchEvent(new Event('visibilitychange'));
	};

	it('freezes while the tab is hidden and resumes where it stopped', () => {
		liveTime(snap(600_000));
		vi.advanceTimersByTime(5_000);
		expect(liveTime(snap(600_000))).toBe(605_000);

		hide(true);
		vi.advanceTimersByTime(30 * 60_000); // half an hour away
		expect(liveTime(snap(600_000))).toBe(605_000); // no time passed in-world

		hide(false);
		vi.advanceTimersByTime(2_000);
		expect(liveTime(snap(600_000))).toBe(607_000);
	});

	it('so a snapshot after a long absence is not a huge correction', () => {
		// This is what keeps the RESET_GAP escape hatch from ever firing in normal
		// play: without the freeze, half an hour away would put the estimate half an
		// hour ahead of play time and the next snapshot would drag the sky back.
		liveTime(snap(600_000));
		hide(true);
		vi.advanceTimersByTime(30 * 60_000);
		hide(false);
		const drift = liveTime(snap(600_000)) - 600_000;
		expect(drift).toBeLessThan(1_000);
	});
});

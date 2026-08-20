// "First five milestones" — how long each took, and which durations count.
//
// The card used to report a mean and a min–max range beside the median. Both
// described the single most extreme save in the set rather than the milestone:
// one save resumed weeks after it was created put the mean of a five-minute
// milestone at fifteen hours, and — because that save holds every early
// achievement — pinned the top of EVERY row's range to the same number. A column
// that reads the same on every line says nothing about the lines.
//
// So the payload reports the median and the middle half (p25–p75), and the
// server drops any single duration longer than a day. These tests pin both, with
// arithmetic worked out by hand below so a change to the percentile method has
// to be deliberate.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/**
 * One solo save that created itself `createdAgo` ms ago and earned `earned`
 * (achievement id → ms after creation).
 *
 * playSeconds is kept under ten minutes so `isIdleAnomaly` can never fire —
 * these tests are about the duration guard, and an idle save would be dropped by
 * a different rule and prove nothing.
 */
const save = (clientId: string, createdAgo: number, earned: Record<string, number>) => {
	const createdAt = Date.now() - createdAgo;
	return {
		clientId,
		name: clientId,
		snapshot: {
			playerId: clientId,
			name: clientId,
			createdAt,
			lastSeenAt: Date.now(),
			playSeconds: 300,
			totalActions: 200,
			sessions: 2,
			achievements: {
				earned: Object.keys(earned).length,
				total: 40,
				earnedAt: Object.fromEntries(Object.entries(earned).map(([id, after]) => [id, createdAt + after])),
			},
		},
	};
};

const topOf = async (id: string) => {
	const s = (await w.get('MetricsSummary')).summary.achievements;
	return { row: s.topAchievements.find((t: any) => t.id === id), coverage: s.timingCoverage };
};

describe('time to earn a milestone', () => {
	it('reports the median and the middle half, interpolated between order statistics', async () => {
		// Eight saves, earning it 1…8 minutes in. Sorted seconds:
		//   [60, 120, 180, 240, 300, 360, 420, 480]
		// With n = 8 the interpolated position is (n - 1) * q:
		//   p25 -> 1.75 -> 120 + (180 - 120) * 0.75 = 165
		//   p50 -> 3.5  -> 240 + (300 - 240) * 0.5  = 270
		//   p75 -> 5.25 -> 360 + (420 - 360) * 0.25 = 375
		for (let i = 1; i <= 8; i++) {
			await w.post('SyncMetrics', save(`slot-${i}`, 60 * MIN, { 'welcome-grasshopper': i * MIN }));
		}

		const { row } = await topOf('welcome-grasshopper');
		expect(row.players).toBe(8);
		expect(row.timed).toBe(8);
		expect(row.p25SecondsToEarn).toBe(165);
		expect(row.medianSecondsToEarn).toBe(270);
		expect(row.p75SecondsToEarn).toBe(375);
	});

	it('drops a duration longer than a day without touching the quartiles', async () => {
		for (let i = 1; i <= 8; i++) {
			await w.post('SyncMetrics', save(`slot-${i}`, 60 * MIN, { 'welcome-grasshopper': i * MIN }));
		}
		// The save that broke the card: created 39 days ago, earned the tutorial
		// milestone 39 days "later" because it was quit and reopened.
		await w.post('SyncMetrics', save('resumed', 40 * DAY, { 'welcome-grasshopper': 39 * DAY }));

		const { row, coverage } = await topOf('welcome-grasshopper');
		// Popularity still counts it — the milestone was earned.
		expect(row.players).toBe(9);
		// Pacing does not.
		expect(row.timed).toBe(8);
		expect(row.p25SecondsToEarn).toBe(165);
		expect(row.medianSecondsToEarn).toBe(270);
		expect(row.p75SecondsToEarn).toBe(375);
		// And the card is told, so it can say what was left out.
		expect(coverage.overLongSkipped).toBe(1);
	});

	it('keeps a duration just inside the cap', async () => {
		await w.post('SyncMetrics', save('slot-1', 2 * DAY, { 'welcome-grasshopper': DAY - MIN }));
		const { row, coverage } = await topOf('welcome-grasshopper');
		expect(row.timed).toBe(1);
		expect(coverage.overLongSkipped).toBe(0);
	});

	it('no longer reports a mean or a min-max range', async () => {
		for (let i = 1; i <= 8; i++) {
			await w.post('SyncMetrics', save(`slot-${i}`, 60 * MIN, { 'welcome-grasshopper': i * MIN }));
		}
		const { row } = await topOf('welcome-grasshopper');
		// Named explicitly: the point of the change was that these two described
		// the outlier rather than the milestone, so putting either back should
		// fail here rather than quietly reappear on the dashboard.
		expect(row.avgSecondsToEarn).toBeUndefined();
		expect(row.fastestSeconds).toBeUndefined();
		expect(row.slowestSeconds).toBeUndefined();
	});

	it('collapses to the single value when only one save has a duration', async () => {
		await w.post('SyncMetrics', save('only', 60 * MIN, { 'welcome-grasshopper': 5 * MIN }));
		const { row } = await topOf('welcome-grasshopper');
		expect(row.p25SecondsToEarn).toBe(300);
		expect(row.medianSecondsToEarn).toBe(300);
		expect(row.p75SecondsToEarn).toBe(300);
	});

	it('resolves the achievement name from the definitions, not the id', async () => {
		await w.post('SyncMetrics', save('slot-1', 60 * MIN, { 'welcome-grasshopper': MIN }));
		const { row } = await topOf('welcome-grasshopper');
		expect(row.name).toBe('First Friend');
	});
});

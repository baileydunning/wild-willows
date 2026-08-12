import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';

// New analytics: time-per-area + session lengths (heartbeat), character-creation
// timing + chosen customization, time-to-first-action, "active right now", and
// the per-device acquisition funnel (opens → characters created / bounced).

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const RES = meadowResource();

describe('per-player metrics', () => {
	it('records character-creation time and the chosen appearance', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Ada', passcode: '1234', appearance, creationMs: 4500 });
		const one = await w.get('Metrics', playerId);
		expect(one.player.creationMs).toBe(4500);
		expect(one.player.creationSeconds).toBe(4.5);
		// the customization they chose is surfaced for the dashboard
		expect(one.player.appearance.hat).toBe('straw');
		expect(one.player.appearance.body).toBe('slim');
	});

	it('clamps a nonsense creation time to zero', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Bea', passcode: '1234', appearance, creationMs: -99 });
		const one = await w.get('Metrics', playerId);
		expect(one.player.creationMs).toBe(0);
		expect(one.player.creationSeconds).toBe(null);
	});

	it('stamps time-to-first-action only on a real gameplay action', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Cy', passcode: '1234', appearance });
		let one = await w.get('Metrics', playerId);
		expect(one.player.timeToFirstActionSeconds).toBe(null); // nothing done yet

		// cosmetic fiddling must NOT count as the first action
		await w.post('UpdateAppearance', { playerId, appearance });
		one = await w.get('Metrics', playerId);
		expect(one.player.timeToFirstActionSeconds).toBe(null);

		// a real action stamps it
		await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
		one = await w.get('Metrics', playerId);
		expect(one.player.timeToFirstActionSeconds).not.toBe(null);
		expect(one.player.timeToFirstActionSeconds).toBeGreaterThanOrEqual(0);
	});

	it('accrues dwell time in the area the player is standing in', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Dee', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId }); // opens the session (no time credited yet)
		await new Promise((r) => setTimeout(r, 120));
		await w.post('Heartbeat', { playerId }); // credits the ~120ms gap to the meadow
		const one = await w.get('Metrics', playerId);
		expect(one.player.areaSeconds.meadow).toBeGreaterThan(0);
		expect(one.player.mostTimeArea).toBe('meadow');
	});

	it('leaves legacy saves (no new metric fields) working', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Eve', passcode: '1234', appearance });
		// simulate an old save whose metrics blob predates the new fields
		const p = await w.db.Player.get(playerId);
		await w.db.Player.patch(playerId, {
			metrics: {
				firstSeenAt: Date.now(),
				lastSeenAt: Date.now(),
				playSeconds: 60,
				sessions: 1,
				counts: { resourcesCollected: 3 },
			},
		});
		const one = await w.get('Metrics', playerId);
		expect(one.player.areaSeconds).toEqual({});
		expect(one.player.sessionLengths).toEqual({});
		expect(one.player.timeToFirstActionSeconds).toBe(null);
		expect(one.player.creationSeconds).toBe(null);
		expect(one.player.totalActions).toBe(3); // existing counters still roll up
	});
});

describe('dashboard rollups from solo snapshots', () => {
	const snap = (over: Record<string, any> = {}) => ({
		playerId: 'x',
		name: 'X',
		playSeconds: 600,
		sessions: 3,
		lastSeenAt: Date.now(),
		areaSeconds: { meadow: 600, wetland: 300 },
		sessionLengths: { '<2m': 1, '2-10m': 2 },
		creationMs: 8000,
		creationSeconds: 8,
		timeToFirstActionSeconds: 42,
		appearance: {
			skin: '#111',
			hair: '#222',
			outfit: '#333',
			hat: 'straw',
			hatColor: null,
			hairstyle: 'short',
			beard: 'none',
			body: 'slim',
		},
		...over,
	});

	it('aggregates area dwell, session lengths, creation, appearance, TTFA, and active-now', async () => {
		await w.post('SyncMetrics', { clientId: 'slot-1', name: 'Solo One', snapshot: snap({ name: 'Solo One' }) });
		await w.post('SyncMetrics', { clientId: 'slot-2', name: 'Solo Two', snapshot: snap({ name: 'Solo Two' }) });

		const out = await w.get('MetricsSummary');
		const s = out.summary;
		// active right now (both seen just now)
		expect(s.audience.activeNow).toBe(2);
		// time per area (summed across both saves)
		expect(s.areaDwell.byAreaSeconds.meadow).toBe(1200);
		expect(s.areaDwell.byAreaSeconds.wetland).toBe(600);
		expect(s.areaDwell.mostTimeArea).toBe('meadow');
		// session-length distribution
		expect(s.sessionLengthDistribution['2-10m']).toBe(4);
		expect(s.sessionLengthDistribution['<2m']).toBe(2);
		// character creation timing
		expect(s.creation.savesWithTiming).toBe(2);
		expect(s.creation.avgCreationSeconds).toBe(8);
		// customization popularity
		expect(s.appearancePopularity.savesWithAppearance).toBe(2);
		expect(s.appearancePopularity.choices.hat.straw).toBe(2);
		expect(s.appearancePopularity.choices.body.slim).toBe(2);
		// onboarding friction
		expect(s.timeToFirstAction.playersMeasured).toBe(2);
		expect(s.timeToFirstAction.avgSeconds).toBe(42);
	});
});

describe('acquisition funnel (AppOpen)', () => {
	it('counts opens, bounces, conversions, and characters per person', async () => {
		// device A opens but never makes a character (bounce)
		await w.post('AppOpen', { deviceId: 'dev-a', phase: 'open', platform: 'desktop', os: 'mac' });
		// device B opens, then creates two characters
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'open', platform: 'web' });
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'created', creationMs: 5000 });
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'created', creationMs: 7000 });

		const a = (await w.get('MetricsSummary')).summary.acquisition;
		expect(a.devices).toBe(2);
		expect(a.totalOpens).toBe(2); // 'created' pings don't inflate opens
		expect(a.converted).toBe(1);
		expect(a.bounced).toBe(1);
		expect(a.bounceRatePct).toBe(50);
		expect(a.conversionPct).toBe(50);
		expect(a.totalCharactersCreated).toBe(2);
		expect(a.avgCharactersPerPerson).toBe(1); // 2 chars / 2 devices
		expect(a.avgCharactersPerConverted).toBe(2); // 2 chars / 1 converted
		expect(a.charactersPerPersonHistogram).toEqual({ '0': 1, '2': 1 });
	});

	it('rejects an AppOpen ping with no deviceId', async () => {
		await expect(w.post('AppOpen', { phase: 'open' })).rejects.toThrow();
	});
});

import { describe, it, expect } from 'vitest';
import { freshWorld, appearance, metricsOf, type World } from './harness';

describe('rest / sleep', () => {
	it('sleeping wakes you at dawn, not midnight', async () => {
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Sleeper', passcode: '1234', appearance })).playerId;
		// a bed to sleep in, and set the clock to late night (0.9 of a 12-min day)
		await w.db.Placement.put({
			id: `${pid}:pl_bed`,
			worldId: pid,
			playerId: pid,
			objectId: 'home-bed',
			area: 'home',
			x: 3,
			y: 3,
			placedAt: Date.now(),
		});
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { metrics: { ...metricsOf(p), playSeconds: 648 } }); // 648/720 = 0.9 → night
		const before = (await w.get('GameState', pid)).weather.dayPhase;
		expect(before).toBe('night');

		await w.post('Rest', { playerId: pid });

		const after = (await w.get('GameState', pid)).weather.dayPhase;
		expect(after).toBe('dawn'); // woke at first light, not 00:00
	});

	it('does NOT count a hammock — you lie in one, you do not sleep the day away', async () => {
		// The hammock used to rest you and deliberately does not any more. Rest is
		// the action that skips the clock to the next dawn, and a hammock strung up
		// in the meadow is the one piece of furniture you get into to let an
		// afternoon pass at its own speed. Lying in it is a client-side pose that
		// draws the animals over (SEATS in WorldScene); the day carries on.
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Lazy', passcode: '1234', appearance })).playerId;
		await w.db.Placement.put({
			id: `${pid}:pl_hammock`,
			worldId: pid,
			playerId: pid,
			objectId: 'hammock',
			area: 'meadow',
			x: 8,
			y: 4,
			placedAt: Date.now(),
		});
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { metrics: { ...metricsOf(p), playSeconds: 648 } }); // night

		const before = (await w.get('GameState', pid)).weather.dayPhase;
		await expect(w.post('Rest', { playerId: pid })).rejects.toThrow();
		// …and the clock is exactly where it was.
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe(before);
	});

	it('still refuses when there is nothing to sleep on', async () => {
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Awake', passcode: '1234', appearance })).playerId;
		await expect(w.post('Rest', { playerId: pid })).rejects.toThrow();
	});
});

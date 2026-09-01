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

	it('counts a hammock, strung up out in a biome', async () => {
		// The hammock is `placement: 'both'` and was decor everywhere. It rests you
		// now, and it does not have to be indoors to do it — an afternoon in the
		// meadow is the whole idea of the thing.
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

		const r = await w.post('Rest', { playerId: pid });
		expect(r.rested).toBe(true);
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe('dawn');
	});

	it('still refuses when there is nothing to sleep on', async () => {
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Awake', passcode: '1234', appearance })).playerId;
		await expect(w.post('Rest', { playerId: pid })).rejects.toThrow();
	});
});

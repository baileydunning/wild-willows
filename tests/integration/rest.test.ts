import { describe, it, expect } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

describe('rest / sleep', () => {
	it('sleeping wakes you at dawn, not midnight', async () => {
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Sleeper', passcode: '1234', appearance })).playerId;
		// a bed to sleep in, and set the clock to late night (0.9 of a 12-min day)
		await w.db.Placement.put({ id: 'pl_bed', worldId: pid, playerId: pid, objectId: 'home-bed', area: 'home', x: 3, y: 3, placedAt: Date.now() });
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { metrics: { ...(p.metrics || {}), playSeconds: 648 } }); // 648/720 = 0.9 → night
		const before = (await w.get('GameState', pid)).weather.dayPhase;
		expect(before).toBe('night');

		await w.post('Rest', { playerId: pid });

		const after = (await w.get('GameState', pid)).weather.dayPhase;
		expect(after).toBe('dawn'); // woke at first light, not 00:00
	});
});

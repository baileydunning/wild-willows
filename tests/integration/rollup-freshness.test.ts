import { describe, it, expect } from 'vitest';
import { freshWorld } from './harness';

// The analytics rollups are cached in module scope, and this module outlives any
// one world: the harness swaps a brand-new database in before each test while
// the server stays loaded. `invalidate()` cannot cover that — it is called by the
// endpoints that WRITE, so it never fires when the database is REPLACED.
//
// This is not hypothetical. It shipped, and the keyboard-gate suite caught it:
// a test asserting "nothing has happened yet" read back the previous test's
// devices. The cache now compares the source it was built from.

const summary = async (w: any) => (await w.as({ role: { super_user: true } }).get('MetricsSummary')).summary;

describe('a rollup never outlives the world it was built from', () => {
	it('reports zero devices in a fresh world after a busy one', async () => {
		const a = await freshWorld();
		for (const id of ['p1', 'p2', 'p3']) {
			await a.post('AppOpen', { deviceId: id, phase: 'open', platform: 'web', os: 'ios' });
		}
		expect((await summary(a)).acquisition.devices).toBe(3);

		const b = await freshWorld();
		expect((await summary(b)).acquisition.devices).toBe(0);
	});

	it('reports zero players in a fresh world after uplinked metrics', async () => {
		const a = await freshWorld();
		await a.post('SyncMetrics', {
			clientId: 'slot-1',
			name: 'Willow',
			platform: 'desktop',
			os: 'mac',
			version: '0.3.8',
			// An object, not a string — the server stringifies it on the way in.
			snapshot: { playerId: 'w1', name: 'Willow', playSeconds: 600, playMinutes: 10, sessions: 2 },
		});
		expect((await summary(a)).players).toBeGreaterThan(0);

		const b = await freshWorld();
		expect((await summary(b)).players).toBe(0);
	});

	it('still shows a write made in the same world (read-your-own-write)', async () => {
		// The fix must not have been "always rebuild" — the cache still has to
		// serve, and still has to notice a write in the world it belongs to.
		const w = await freshWorld();
		expect((await summary(w)).acquisition.devices).toBe(0);
		await w.post('AppOpen', { deviceId: 'fresh-1', phase: 'open', platform: 'web', os: 'android' });
		expect((await summary(w)).acquisition.devices).toBe(1);
	});
});

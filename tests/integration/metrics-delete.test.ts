import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, loadServer, type World } from './harness';

// DeleteSoloMetrics: the Remove button in the dashboard's player modal.
//
// The endpoint itself is four lines of delete loop; what these tests pin is the
// part around it that is easy to get wrong and impossible to notice —
// the roll-up cache, the already-gone case, the permission gate that is
// deliberately NARROWER than the one every other dashboard endpoint uses, and
// the fact that a live save uplinks itself straight back.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const snap = (over: any = {}) => ({
	name: 'Solo',
	playSeconds: 1200,
	sessions: 2,
	totalActions: 40,
	counts: { resourcesCollected: 40 },
	lastSeenAt: Date.now(),
	...over,
});

/** n uplinked solo saves, named and slotted predictably. */
async function seed(n: number) {
	const now = Date.now();
	for (let i = 0; i < n; i++) {
		await w.post('SyncMetrics', {
			clientId: `slot-${i}`,
			name: `Caretaker ${i}`,
			platform: 'desktop',
			os: 'mac',
			version: '0.3.0',
			snapshot: snap({ name: `Caretaker ${i}`, lastSeenAt: now - i * 1000 }),
		});
	}
}

describe('DeleteSoloMetrics', () => {
	it('removes one caretaker and leaves the others untouched', async () => {
		await seed(3);

		const out = await w.post('DeleteSoloMetrics', { ids: ['solo:slot-1'] });
		expect(out.ok).toBe(true);
		expect(out.deleted).toBe(1);
		expect(out.missing).toEqual([]);
		expect(out.failed).toEqual([]);

		expect(await w.db.SoloMetrics.get('solo:slot-1')).toBeFalsy();
		expect(await w.db.SoloMetrics.get('solo:slot-0')).toBeTruthy();
		expect(await w.db.SoloMetrics.get('solo:slot-2')).toBeTruthy();
	});

	// The one that would actually break in production. metricsRollup caches its
	// scan for DASHBOARD_CACHE_MS, so without the invalidate() call the row is
	// gone from the database and still on the page for another 30 seconds —
	// which looks exactly like the delete having silently failed. Reading BEFORE
	// the delete is the point: it warms the cache the invalidate has to clear.
	it('drops the caretaker out of the roll-up immediately, not after the cache expires', async () => {
		await seed(3);

		const before = await w.get('MetricsPlayers');
		expect(before.total).toBe(3);

		await w.post('DeleteSoloMetrics', { ids: ['solo:slot-1'] });

		const after = await w.get('MetricsPlayers');
		expect(after.total).toBe(2);
		expect(after.players.map((p: any) => p.playerId)).not.toContain('solo:slot-1');
	});

	it('reports an id that was already gone as missing, not as a failure', async () => {
		await seed(1);

		const out = await w.post('DeleteSoloMetrics', { ids: ['solo:never-existed'] });
		// ok stays true: the caller asked for that row to be absent and it is.
		// The dashboard treats this as success and refreshes.
		expect(out.ok).toBe(true);
		expect(out.deleted).toBe(0);
		expect(out.missing).toEqual(['solo:never-existed']);
		expect(out.failed).toEqual([]);
	});

	it('accepts a single id as well as a batch, and refuses an empty request', async () => {
		await seed(2);

		const one = await w.post('DeleteSoloMetrics', { id: 'solo:slot-0' });
		expect(one.deleted).toBe(1);

		const none = await w.post('DeleteSoloMetrics', {});
		expect(none.ok).toBe(false);
		expect(none.deleted).toBe(0);

		// The refusal must not have taken anything with it.
		expect(await w.db.SoloMetrics.get('solo:slot-1')).toBeTruthy();
	});

	// Documented as behaviour, not treated as a bug: SyncMetrics upserts on
	// `solo:${clientId}`, so removing a caretaker whose save is still played is
	// "forget what we know now", not a ban. The modal says so in as many words;
	// this pins that the copy stays true.
	it('lets a still-playing save uplink itself back, without its history', async () => {
		await seed(1);
		const original = await w.db.SoloMetrics.get('solo:slot-0');
		expect(JSON.parse(original.snapshot).playSeconds).toBe(1200);

		await w.post('DeleteSoloMetrics', { ids: ['solo:slot-0'] });
		expect(await w.db.SoloMetrics.get('solo:slot-0')).toBeFalsy();

		await w.post('SyncMetrics', {
			clientId: 'slot-0',
			name: 'Caretaker 0',
			platform: 'desktop',
			snapshot: snap({ name: 'Caretaker 0', playSeconds: 30, sessions: 1 }),
		});

		const reborn = await w.db.SoloMetrics.get('solo:slot-0');
		expect(reborn).toBeTruthy();
		// A NEW row, not the old one restored — createdAt restarts and the history
		// that was deleted is genuinely gone.
		expect(JSON.parse(reborn.snapshot).playSeconds).toBe(30);
		expect(reborn.createdAt).toBeGreaterThanOrEqual(original.createdAt);
	});
});

describe('who is allowed to remove a caretaker', () => {
	const reader = { role: { role: 'metrics_reader' } };
	const superUser = { role: { role: 'super_user' } };

	it('is super-user only — narrower than every other dashboard endpoint', async () => {
		const mod = await loadServer();
		const del = new mod.DeleteSoloMetrics();

		// Reading is the normal dashboard gate...
		expect(del.allowRead(reader)).toBe(true);
		expect(del.allowRead(superUser)).toBe(true);
		expect(del.allowRead(undefined)).toBe(false);

		// ...but destroying is not. This is the whole reason metrics_reader can be
		// kept in a browser tab: a leak of it is worth rotating and nothing worse.
		expect(del.allowCreate(reader)).toBe(false);
		expect(del.allowCreate(superUser)).toBe(true);
		expect(del.allowCreate(undefined)).toBe(false);
	});

	it('is stricter than ClearProblem, which any dashboard reader may use', async () => {
		const mod = await loadServer();
		// The contrast is deliberate and worth pinning: clearing a refusal counter
		// is regenerable, removing a caretaker is not.
		expect(new mod.ClearProblem().allowCreate(reader)).toBe(true);
		expect(new mod.DeleteSoloMetrics().allowCreate(reader)).toBe(false);
	});
});

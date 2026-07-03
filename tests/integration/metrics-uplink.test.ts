import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// SyncMetrics: solo saves periodically upsert their local metrics view into
// the hosted SoloMetrics table (keyed by save-slot UUID), and the global
// /Metrics/ view surfaces them alongside hosted players.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

const snapshot = (over: Record<string, any> = {}) => ({
	playerId: 'sam', name: 'Sam', playSeconds: 1200, playMinutes: 20, sessions: 3,
	counts: { resourcesCollected: 40 }, tutorialStep: 9, unlockedBiomes: 2,
	...over,
});

describe('SyncMetrics', () => {
	it('upserts one row per save slot, preserving createdAt across updates', async () => {
		const slot = 'a3f0c1d2-0000-4000-8000-123456789abc';
		let r = await w.post('SyncMetrics', { clientId: slot, name: 'Sam', platform: 'desktop', os: 'mac', version: '0.1.0', snapshot: snapshot() });
		expect(r.ok).toBe(true);

		const first = await w.db.SoloMetrics.get(`solo:${slot}`);
		expect(first.snapshot.playMinutes).toBe(20);
		expect(first.os).toBe('mac');
		expect(first.version).toBe('0.1.0');

		await new Promise((res) => setTimeout(res, 5));
		r = await w.post('SyncMetrics', { clientId: slot, name: 'Sam', platform: 'desktop', snapshot: snapshot({ playMinutes: 25, sessions: 4 }) });
		expect(r.ok).toBe(true);

		const rows = [];
		for await (const row of w.db.SoloMetrics.search()) rows.push(row);
		expect(rows).toHaveLength(1); // same slot → same row, not a new one
		expect(rows[0].snapshot.playMinutes).toBe(25);
		expect(rows[0].createdAt).toBe(first.createdAt);
		expect(rows[0].updatedAt).toBeGreaterThan(first.updatedAt);
	});

	it('rejects a missing clientId or snapshot, and oversized snapshots', async () => {
		await expect(w.post('SyncMetrics', { snapshot: snapshot() })).rejects.toThrow();
		await expect(w.post('SyncMetrics', { clientId: 'slot-1' })).rejects.toThrow();
		await expect(w.post('SyncMetrics', { clientId: 'slot-1', snapshot: { blob: 'x'.repeat(30_000) } })).rejects.toThrow();
	});

	it('feeds solo players into the regular Metrics view and its aggregates', async () => {
		// one hosted player + one uplinked solo save
		await w.post('CreatePlayer', { name: 'Hosted Holly', passcode: '1234', appearance });
		await w.post('SyncMetrics', {
			clientId: 'slot-9', name: 'Solo Sam', platform: 'desktop', os: 'linux', version: '0.1.0',
			snapshot: snapshot({ name: 'Solo Sam', lastSeenAt: Date.now(), activation: { collected: true } }),
		});

		const out = await w.get('Metrics');
		// one combined player list, solo entries flagged
		expect(out.summary.players).toBe(2);
		expect(out.summary.hostedPlayers).toBe(1);
		expect(out.summary.soloPlayers).toBe(1);
		const sam = out.players.find((p: any) => p.solo);
		expect(sam.name).toBe('Solo Sam');
		expect(sam.playMinutes).toBe(20);
		expect(sam.platform).toBe('desktop');
		expect(sam.os).toBe('linux');
		expect(sam.version).toBe('0.1.0');
		// aggregates count the solo player like anyone else
		expect(out.summary.engagement.totalPlaySeconds).toBeGreaterThanOrEqual(1200);
		expect(out.summary.funnel.created).toBe(2);
		expect(out.summary.funnel.collected).toBe(1); // from the solo snapshot's activation
		expect(out.summary.audience.activeLast24h).toBeGreaterThanOrEqual(1);
	});
});

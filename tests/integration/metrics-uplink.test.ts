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
	playerId: 'sam',
	name: 'Sam',
	playSeconds: 1200,
	playMinutes: 20,
	sessions: 3,
	counts: { resourcesCollected: 40 },
	tutorialStep: 9,
	unlockedBiomes: 2,
	...over,
});

describe('SyncMetrics', () => {
	it('upserts one row per save slot, preserving createdAt across updates', async () => {
		const slot = 'a3f0c1d2-0000-4000-8000-123456789abc';
		let r = await w.post('SyncMetrics', {
			clientId: slot,
			name: 'Sam',
			platform: 'desktop',
			os: 'mac',
			version: '0.1.0',
			snapshot: snapshot(),
		});
		expect(r.ok).toBe(true);

		const first = await w.db.SoloMetrics.get(`solo:${slot}`);
		// snapshot is stored as a JSON string (all-scalar row → structon-safe); parse to read it.
		expect(JSON.parse(first.snapshot).playMinutes).toBe(20);
		expect(first.os).toBe('mac');
		expect(first.version).toBe('0.1.0');

		await new Promise((res) => setTimeout(res, 5));
		r = await w.post('SyncMetrics', {
			clientId: slot,
			name: 'Sam',
			platform: 'desktop',
			snapshot: snapshot({ playMinutes: 25, sessions: 4 }),
		});
		expect(r.ok).toBe(true);

		const rows = [];
		for await (const row of w.db.SoloMetrics.search()) rows.push(row);
		expect(rows).toHaveLength(1); // same slot → same row, not a new one
		expect(JSON.parse(rows[0].snapshot).playMinutes).toBe(25);
		expect(rows[0].createdAt).toBe(first.createdAt);
		expect(rows[0].updatedAt).toBeGreaterThan(first.updatedAt);
	});

	it('rejects a missing clientId or snapshot, and oversized snapshots', async () => {
		await expect(w.post('SyncMetrics', { snapshot: snapshot() })).rejects.toThrow();
		await expect(w.post('SyncMetrics', { clientId: 'slot-1' })).rejects.toThrow();
		await expect(
			w.post('SyncMetrics', { clientId: 'slot-1', snapshot: { blob: 'x'.repeat(30_000) } }),
		).rejects.toThrow();
	});

	it('builds the dashboard purely from SoloMetrics, excluding hosted players', async () => {
		// A hosted player exists but must NOT appear — the dashboard is solo-only.
		await w.post('CreatePlayer', { name: 'Hosted Holly', passcode: '1234', appearance });
		await w.post('SyncMetrics', {
			clientId: 'slot-9',
			name: 'Solo Sam',
			platform: 'desktop',
			os: 'linux',
			version: '0.1.0',
			snapshot: snapshot({ name: 'Solo Sam', lastSeenAt: Date.now(), activation: { collected: true } }),
		});

		// The roll-up is two admin endpoints now: aggregates and rows. Same filters,
		// same population — asserted on both halves here.
		const out = await w.get('MetricsSummary');
		expect(out.source).toBe('solo-metrics');
		// only the uplinked solo save is counted; Hosted Holly is ignored
		expect(out.summary.players).toBe(1);
		expect(out.summary.soloPlayers).toBe(1);
		expect(out.players.total).toBe(1); // paging hint, not the rows
		const rows = await w.get('MetricsPlayers');
		expect(rows.players).toHaveLength(1);
		const sam = rows.players[0];
		expect(sam.solo).toBe(true);
		expect(sam.name).toBe('Solo Sam');
		expect(sam.playMinutes).toBe(20);
		expect(sam.platform).toBe('desktop');
		expect(sam.os).toBe('linux');
		expect(sam.version).toBe('0.1.0');
		// aggregates derive entirely from the snapshot
		expect(out.summary.engagement.totalPlaySeconds).toBeGreaterThanOrEqual(1200);
		expect(out.summary.funnel.created).toBe(1);
		expect(out.summary.funnel.collected).toBe(1); // from the solo snapshot's activation
		expect(out.summary.audience.activeLast24h).toBe(1);
		expect(out.summary.platforms).toEqual({ desktop: 1 });
		expect(out.summary.operatingSystems).toEqual({ linux: 1 });
	});

	it('tracks interface language from the heartbeat and the solo uplink', async () => {
		// hosted player reports language on the heartbeat (normalized to lowercase)
		const a = await w.post('CreatePlayer', { name: 'Lang Lucy', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId: a.playerId, language: 'ES' });
		const one = await w.get('Metrics', a.playerId);
		expect(one.player.language).toBe('es');

		// solo uplink carries it too
		await w.post('SyncMetrics', {
			clientId: 'slot-lang',
			name: 'Solo Sam',
			language: 'en',
			snapshot: snapshot({ name: 'Solo Sam', lastSeenAt: Date.now() }),
		});

		const out = await w.get('MetricsSummary');
		const solo = (await w.get('MetricsPlayers')).players.find((p: any) => p.solo);
		expect(solo.language).toBe('en');
		// solo-only dashboard: the hosted player's 'es' is not counted here, only
		// the uplinked solo save. (Per-player /Metrics/<id> above still sees 'es'.)
		expect(out.summary.languages).toEqual({ en: 1 });
	});

	it('omits saves by name via ?exclude= so you can drop your own test data', async () => {
		await w.post('SyncMetrics', {
			clientId: 'slot-me',
			name: 'Bailey',
			os: 'mac',
			snapshot: snapshot({ name: 'Bailey', lastSeenAt: Date.now(), playSeconds: 9999 }),
		});
		await w.post('SyncMetrics', {
			clientId: 'slot-real',
			name: 'Real Player',
			os: 'windows',
			snapshot: snapshot({ name: 'Real Player', lastSeenAt: Date.now(), playSeconds: 600 }),
		});

		// unfiltered: both saves present
		const all = await w.get('MetricsSummary');
		expect(all.summary.players).toBe(2);

		// exclude my own save by name (case-insensitive)
		const filtered = await w.get('MetricsSummary', undefined, { exclude: 'bailey' });
		expect(filtered.summary.players).toBe(1);
		expect(filtered.summary.excludedNames).toEqual(['bailey']);
		// aggregates reflect only the remaining save
		expect(filtered.summary.engagement.totalPlaySeconds).toBe(600);

		// the rows endpoint honours the SAME filter, or the dashboard's two halves
		// would describe different populations
		const filteredRows = await w.get('MetricsPlayers', undefined, { exclude: 'bailey' });
		expect(filteredRows.players.map((p: any) => p.name)).toEqual(['Real Player']);
		expect(filteredRows.total).toBe(1);

		// comma-separated and repeatable both work
		const multi = await w.get('MetricsSummary', undefined, { exclude: ['Bailey,Real Player'] });
		expect(multi.summary.players).toBe(0);
	});

	it('records cosmetic actions in counts but keeps them out of totalActions', async () => {
		const p = await w.post('CreatePlayer', { name: 'Cosmo', passcode: '1234', appearance });
		await w.post('UpdateAppearance', { playerId: p.playerId, appearance });
		await w.post('UpdateAppearance', { playerId: p.playerId, appearance });

		const one = await w.get('Metrics', p.playerId);
		// tracked for engagement insight...
		expect(one.player.counts.appearanceChanges).toBe(2);
		// ...but cosmetic fiddling must not inflate the gameplay-intensity signal
		expect(one.player.totalActions).toBe(0);
		expect(one.player.actionsPerMinute).toBe(0);
	});

	it('keeps the last reported language when a heartbeat omits it', async () => {
		const a = await w.post('CreatePlayer', { name: 'Quiet Quinn', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId: a.playerId, language: 'es' });
		await w.post('Heartbeat', { playerId: a.playerId }); // e.g. an older client
		const one = await w.get('Metrics', a.playerId);
		expect(one.player.language).toBe('es');
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';

// Does a demo save carried into the full game keep its history WITHOUT staying
// tagged as a demo save?
//
// It matters in both directions. The player should arrive with everything they
// built; and the metrics dashboard should stop counting them as a demo player,
// because Heartbeat deliberately makes `edition: 'demo'` STICKY — once a save
// reports demo it can never be re-tagged full. If the exported copy carried the
// demo tag, that player would be miscounted for the rest of their life.
//
// The handoff is: ExportDemoSave (server) → encrypted envelope (client) →
// importSave → loadSoloGame hydrates the same table dump. This drives the server
// halves against the real bundle.

let w: World;
const RES = meadowResource();

beforeEach(async () => {
	w = await freshWorld();
});

/** A demo player with some history behind them. */
async function playedDemo(name = 'Demo Kayla') {
	const created = await w.post('CreatePlayer', { name, passcode: 'demopass', appearance, edition: 'demo' });
	const playerId = created.playerId;
	// Build up a bit of everything the export is supposed to carry.
	await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
	await w.post('CollectResource', { playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: RES });
	await w.post('SyncPlayer', { playerId, x: 12, y: 9, area: 'meadow', tutorialStep: 5 });
	return playerId;
}

const metricsOf = (row: any) => (typeof row?.metrics === 'string' ? JSON.parse(row.metrics) : row?.metrics || {});

describe('the exported demo save is not marked as a demo', () => {
	it('rewrites edition to full on the exported player', async () => {
		const playerId = await playedDemo();
		expect(metricsOf(w.db.Player._rows.get(playerId)).edition).toBe('demo'); // still demo on the server

		const out = await w.post('ExportDemoSave', { playerId });

		expect(out.ok).toBe(true);
		expect(metricsOf(out.data.Player[0]).edition).toBe('full');
	});

	it('leaves the ORIGINAL server-side save tagged demo', async () => {
		// The export is a copy for the player to carry away; the demo save itself is
		// still a demo save and must keep counting as one.
		const playerId = await playedDemo();
		await w.post('ExportDemoSave', { playerId });
		expect(metricsOf(w.db.Player._rows.get(playerId)).edition).toBe('demo');
	});

	it('refuses to export a save that was never a demo', async () => {
		const full = await w.post('CreatePlayer', { name: 'Paid Sam', passcode: 'fullpass', appearance });
		await expect(w.post('ExportDemoSave', { playerId: full.playerId })).rejects.toThrow();
	});
});

describe('the carried save keeps its history', () => {
	it('brings the player, their name, look and progress', async () => {
		const playerId = await playedDemo('Kayla');
		const out = await w.post('ExportDemoSave', { playerId });

		expect(out.meta.playerId).toBe(playerId);
		expect(out.meta.name).toBe('Kayla');
		const p = out.data.Player[0];
		expect(p.id).toBe(playerId);
		expect(p.tutorialStep).toBe(5);
		expect(p.appearance).toMatchObject({ hat: 'straw' });
	});

	it('brings gathered inventory and accrued play metrics', async () => {
		const playerId = await playedDemo();
		const out = await w.post('ExportDemoSave', { playerId });
		const p = out.data.Player[0];
		expect(p.inventory?.[RES]).toBeGreaterThan(0);
		const m = metricsOf(p);
		expect(m.counts).toBeDefined(); // the counters survive the edition rewrite
		expect(m.firstSeenAt ?? m.createdAt ?? 0).not.toBeNaN();
	});

	it('brings every world table the local backend hydrates', async () => {
		const playerId = await playedDemo();
		const out = await w.post('ExportDemoSave', { playerId });
		// Mirrors DYNAMIC_TABLES in src/solo/localDb.ts — a missing key would
		// silently hydrate as empty and quietly drop that slice of their preserve.
		for (const table of [
			'Player',
			'PlayerAchievement',
			'BiomeState',
			'Chest',
			'Placement',
			'Discovery',
			'NodeState',
			'TerrainTile',
			'FeedEntry',
		]) {
			expect(Array.isArray(out.data[table]), `${table} missing from the export`).toBe(true);
		}
		expect(out.data.BiomeState.length).toBeGreaterThan(0); // real world state, not just empty arrays
	});
});

describe('after the import, the full game keeps it full', () => {
	it('a heartbeat does not re-tag the carried save as demo', async () => {
		const playerId = await playedDemo();
		const out = await w.post('ExportDemoSave', { playerId });

		// Simulate the import landing in a fresh full-game world: same rows, new world.
		const fresh = await freshWorld();
		for (const [table, rows] of Object.entries(out.data as Record<string, any[]>)) {
			for (const row of rows) fresh.db[table]._rows.set(row.id, row);
		}
		expect(metricsOf(fresh.db.Player._rows.get(playerId)).edition).toBe('full');

		// Heartbeat keeps 'demo' sticky — so this is the moment a leaked demo tag
		// would become permanent. It must stay full.
		await fresh.post('Heartbeat', { playerId, edition: 'full' });
		expect(metricsOf(fresh.db.Player._rows.get(playerId)).edition).toBe('full');
	});

	it('history is readable through a normal GameState after the import', async () => {
		const playerId = await playedDemo('Kayla');
		const out = await w.post('ExportDemoSave', { playerId });

		const fresh = await freshWorld();
		for (const [table, rows] of Object.entries(out.data as Record<string, any[]>)) {
			for (const row of rows) fresh.db[table]._rows.set(row.id, row);
		}

		const state = await fresh.get('GameState', playerId);
		expect(state.player.name).toBe('Kayla');
		expect(state.player.tutorialStep).toBe(5);
		expect(state.player.inventory?.[RES]).toBeGreaterThan(0);
	});
});

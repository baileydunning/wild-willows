import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Time in menus. The heartbeat already credits its elapsed gap to the area the
// player is standing in; the open panel now rides along on the same beat and is
// credited the same way, because which menu is open is client state the server
// cannot otherwise see.
//
// The property that matters most here is that menu time OVERLAPS area time
// rather than being carved out of it. areaSeconds therefore still means exactly
// what it meant before this shipped, and rows from either side of the change
// can be averaged together — the thing metricsRev exists to protect.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const beat = async (playerId: string, body: Record<string, unknown> = {}) => {
	await new Promise((r) => setTimeout(r, 120));
	await w.post('Heartbeat', { playerId, ...body });
};

describe('menu dwell', () => {
	it('credits the beat to the open menu as well as the area', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Ada', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId }); // first beat only opens the session
		await beat(playerId, { panel: 'journal' });
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuSeconds.journal).toBeGreaterThan(0);
		expect(player.mostUsedMenu).toBe('journal');
		// …and the same seconds still count toward the area they were standing in
		expect(player.areaSeconds.meadow).toBeGreaterThan(0);
		expect(player.menuSeconds.journal).toBeLessThanOrEqual(player.areaSeconds.meadow);
	});

	it('credits nothing to a menu when the player is out in the world', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Bea', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId });
		await beat(playerId, { panel: null });
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuSeconds).toEqual({});
		expect(player.areaSeconds.meadow).toBeGreaterThan(0);
		expect(player.menuMeasured).toBe(false);
	});

	it('counts opens reported by the client, per menu', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Cy', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId, panelOpens: { journal: 3, crafting: 1 } });
		await w.post('Heartbeat', { playerId, panelOpens: { journal: 2 } });
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuOpens).toEqual({ journal: 5, crafting: 1 });
		expect(player.menuTotalOpens).toBe(6);
		expect(player.menuMeasured).toBe(true);
	});

	it('refuses menus it does not recognise, so a client cannot invent columns', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Di', passcode: '1234', appearance });
		await w.post('Heartbeat', { playerId });
		await beat(playerId, { panel: 'wallet', panelOpens: { wallet: 4, journal: 1 } });
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuSeconds.wallet).toBeUndefined();
		expect(player.menuOpens.wallet).toBeUndefined();
		expect(player.menuOpens.journal).toBe(1);
	});

	it('drops open counts that are not sane positive numbers', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Eve', passcode: '1234', appearance });
		await w.post('Heartbeat', {
			playerId,
			panelOpens: { journal: -3, goals: 'lots', settings: 1e9, tools: 2 },
		});
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuOpens.journal).toBeUndefined();
		expect(player.menuOpens.goals).toBeUndefined();
		expect(player.menuOpens.settings).toBe(200); // clamped, not trusted
		expect(player.menuOpens.tools).toBe(2);
	});

	it('reports the share of play time spent in menus', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Fay', passcode: '1234', appearance });
		// Seeded rather than accrued: playSeconds is stored rounded to the second,
		// so a real beat measured in milliseconds lands on 0 and the share comes
		// back null — a true statement about a test that measured nothing, and a
		// useless one about the arithmetic this is here to check.
		await w.db.Player.patch(playerId, {
			metrics: JSON.stringify({
				firstSeenAt: Date.now(),
				lastSeenAt: Date.now(),
				playSeconds: 1000,
				sessions: 3,
				counts: {},
				areaSeconds: { meadow: 1000 },
				menuSeconds: { journal: 200, goals: 50 },
				menuOpens: { journal: 8, goals: 2 },
			}),
		});
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuTotalSeconds).toBe(250);
		expect(player.menuTotalMinutes).toBe(4);
		expect(player.menuShareOfPlay).toBe(25);
		expect(player.mostUsedMenu).toBe('journal');
		expect(player.menuMinutes.journal).toBe(3);
		// The share is of play time, not of time-in-world: the same 250 seconds are
		// still counted against the meadow, so these two deliberately do not sum.
		expect(player.areaSeconds.meadow).toBe(1000);
	});

	it('leaves a save that predates the metric readable, and marked unmeasured', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Gus', passcode: '1234', appearance });
		await w.db.Player.patch(playerId, {
			metrics: JSON.stringify({
				firstSeenAt: Date.now(),
				lastSeenAt: Date.now(),
				playSeconds: 600,
				sessions: 2,
				counts: { resourcesCollected: 3 },
				areaSeconds: { meadow: 600 },
			}),
		});
		const { player } = await w.get('Metrics', playerId);
		expect(player.menuSeconds).toEqual({});
		expect(player.menuOpens).toEqual({});
		expect(player.menuTotalSeconds).toBe(0);
		// 0% would read as "this player never opens a menu"; the flag is how a
		// dashboard tells that apart from "nobody was measuring yet".
		expect(player.menuMeasured).toBe(false);
		expect(player.areaSeconds.meadow).toBe(600); // untouched by the new field
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// The browser itch demo tags its saves edition:'demo' (via CreatePlayer) and, on
// the 5-animal hard-stop, wipes them with the passcode-free DeleteDemoSave. That
// endpoint MUST refuse anything not tagged 'demo', so it can never nuke a real
// (paid) save even if the id is known.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

describe('CreatePlayer edition tag', () => {
	it("defaults to 'full' and honors 'demo'", async () => {
		const paid = await w.post('CreatePlayer', { name: 'Paid', passcode: '1234', appearance });
		const demo = await w.post('CreatePlayer', { name: 'Demo', passcode: '1234', appearance, edition: 'demo' });
		const p = await w.db.Player.get(paid.playerId);
		const d = await w.db.Player.get(demo.playerId);
		expect(p.metrics.edition).toBe('full');
		expect(d.metrics.edition).toBe('demo');
	});
});

describe('DeleteDemoSave (guarded, passcode-free)', () => {
	it('deletes a demo save without a passcode and clears its records', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Demo', passcode: '1234', appearance, edition: 'demo' });
		const r = await w.post('DeleteDemoSave', { playerId });
		expect(r.ok).toBe(true);
		expect(r.deleted).toBe(playerId);
		expect(await w.db.Player.get(playerId)).toBeFalsy();
		// the player's solo world row is gone too
		expect(await w.db.World.get(playerId)).toBeFalsy();
	});

	it('refuses to delete a full (paid) save and leaves it intact', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Paid', passcode: '1234', appearance });
		await expect(w.post('DeleteDemoSave', { playerId })).rejects.toThrow();
		expect(await w.db.Player.get(playerId)).toBeTruthy();
	});

	it('is idempotent for a save that is already gone', async () => {
		const r = await w.post('DeleteDemoSave', { playerId: 'nobody-here' });
		expect(r.ok).toBe(true);
		expect(r.deleted).toBeNull();
	});
});

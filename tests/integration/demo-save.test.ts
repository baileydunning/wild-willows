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

describe('CreatePlayer demo ids are unique (no name collisions)', () => {
	it('mints distinct ids for two demo players with the same name', async () => {
		const a = await w.post('CreatePlayer', { name: 'Ranger', passcode: 'aaaa', appearance, edition: 'demo' });
		const b = await w.post('CreatePlayer', { name: 'Ranger', passcode: 'bbbb', appearance, edition: 'demo' });
		expect(a.playerId).not.toBe(b.playerId);
		// display name is preserved; the id just carries a suffix
		expect((await w.db.Player.get(a.playerId)).name).toBe('Ranger');
		expect(a.playerId.startsWith('ranger-')).toBe(true);
		// both saves really exist independently
		expect(await w.db.Player.get(a.playerId)).toBeTruthy();
		expect(await w.db.Player.get(b.playerId)).toBeTruthy();
	});

	it('still rejects a duplicate name for a full (paid) save', async () => {
		await w.post('CreatePlayer', { name: 'Solo', passcode: '1234', appearance });
		await expect(w.post('CreatePlayer', { name: 'Solo', passcode: '1234', appearance })).rejects.toThrow();
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

describe('ExportDemoSave (carry a demo save into the full game)', () => {
	it('dumps the world in solo-save shape with edition reset to full', async () => {
		const { playerId } = await w.post('CreatePlayer', {
			name: 'Willow',
			passcode: 'aaaa',
			appearance,
			edition: 'demo',
		});
		const out = await w.post('ExportDemoSave', { playerId });
		expect(out.ok).toBe(true);
		expect(out.meta.playerId).toBe(playerId);
		expect(out.meta.name).toBe('Willow');
		// dynamic tables present, in the shape src/solo/localDb.ts hydrates
		expect(Array.isArray(out.data.Player)).toBe(true);
		expect(out.data.Player).toHaveLength(1);
		expect(out.data.BiomeState.some((b: any) => b.biomeId === 'meadow')).toBe(true);
		expect(Array.isArray(out.data.Placement)).toBe(true);
		// carried into the paid game → must NOT stay tagged demo
		expect(out.data.Player[0].metrics.edition).toBe('full');
	});

	it('refuses to export a full (paid) save', async () => {
		const { playerId } = await w.post('CreatePlayer', { name: 'Paidy', passcode: '1234', appearance });
		await expect(w.post('ExportDemoSave', { playerId })).rejects.toThrow();
	});
});

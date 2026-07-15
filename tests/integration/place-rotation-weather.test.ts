import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Server-side coverage for the placement/dev features:
//  • rotation persists through place + move, but ONLY for rotatable objects
//    (paths/fences/bridges/furniture); trees, flowers, etc. stay at 0°
//  • the dev weather/season override is honored in the state snapshot

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

async function stocked(): Promise<string> {
	const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
	await w.post('DevTools', { playerId: pid, action: 'grant-resources', amount: 200 });
	await w.post('DevTools', { playerId: pid, action: 'unlock-recipes', value: true });
	return pid;
}

describe('object rotation is gated to sensible objects', () => {
	it('a path rotates and snaps odd angles to a quarter-turn', async () => {
		const pid = await stocked();
		await w.post('CraftItem', { playerId: pid, recipeId: 'simple-path' });
		const r = await w.post('PlaceObject', {
			playerId: pid,
			objectId: 'simple-path',
			area: 'meadow',
			x: 10,
			y: 10,
			rotation: 100,
		});
		expect(r.ok).toBe(true);
		const pl = (await w.get('GameState', pid)).placements.find((p: any) => p.objectId === 'simple-path');
		expect(pl.rotation).toBe(90);
	});

	it('a tree ignores rotation and stays upright', async () => {
		const pid = await stocked();
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 12, y: 12, rotation: 90 });
		const pl = (await w.get('GameState', pid)).placements.find((p: any) => p.objectId === 'grass-patch');
		expect(pl.rotation).toBe(0);
	});

	it('MoveObject rotates a rotatable object in place', async () => {
		const pid = await stocked();
		await w.post('CraftItem', { playerId: pid, recipeId: 'plank-path' });
		const placed = await w.post('PlaceObject', {
			playerId: pid,
			objectId: 'plank-path',
			area: 'meadow',
			x: 14,
			y: 14,
			rotation: 0,
		});
		const id = placed.placement.id;
		await w.post('MoveObject', { playerId: pid, placementId: id, x: 14, y: 14, rotation: 270 });
		expect((await w.get('GameState', pid)).placements.find((p: any) => p.id === id).rotation).toBe(270);
	});

	it('GameData marks which objects are rotatable', async () => {
		const d = await w.get('GameData');
		const byId = Object.fromEntries(d.habitatObjects.map((o: any) => [o.id, o.rotatable]));
		expect(byId['simple-path']).toBe(true);
		expect(byId['wooden-bridge']).toBe(true);
		expect(byId['willow-tree']).toBeFalsy();
		expect(byId['wildflower-patch']).toBeFalsy();
	});
});

describe('dev weather/season override', () => {
	it('forces weather + season in the snapshot, then clears back to live', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Ivy', passcode: '1234', appearance })).playerId;
		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { type: 'storm' } });
		let s = await w.get('GameState', pid);
		expect(s.weather.override.type).toBe('storm');
		expect(s.weather.byBiome.meadow.type).toBe('storm');
		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { season: 'winter' } });
		s = await w.get('GameState', pid);
		expect(s.weather.season).toBe('winter');
		expect(s.weather.override.type).toBe('storm');
		await expect(
			w.post('DevTools', { playerId: pid, action: 'set-weather', value: { type: 'bananas' } }),
		).rejects.toThrow();
		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { clear: true } });
		s = await w.get('GameState', pid);
		expect(s.weather.override).toBeUndefined();
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Covers the new dev/placement features that live server-side:
//  • object rotation persists through place + move (snapped to 90°)
//  • the dev weather/season override is honored in the state snapshot

let w: World;
beforeEach(async () => { w = await freshWorld(); });

async function withGrassPatch(): Promise<string> {
	const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
	await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'fiber-node', resourceId: 'fiber' });
	await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
	return pid;
}

describe('object rotation', () => {
	it('places with a rotation and snaps odd angles to a quarter-turn', async () => {
		const pid = await withGrassPatch();
		const r = await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 10, y: 10, rotation: 100 });
		expect(r.ok).toBe(true);
		const s = await w.get('GameState', pid);
		const pl = s.placements.find((p: any) => p.objectId === 'grass-patch');
		expect(pl.rotation).toBe(90); // 100° snapped to nearest quarter-turn
	});

	it('MoveObject can rotate in place', async () => {
		const pid = await withGrassPatch();
		const placed = await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 10, y: 10, rotation: 0 });
		const id = placed.placement.id;
		await w.post('MoveObject', { playerId: pid, placementId: id, x: 10, y: 10, rotation: 270 });
		const s = await w.get('GameState', pid);
		expect(s.placements.find((p: any) => p.id === id).rotation).toBe(270);
	});
});

describe('dev weather/season override', () => {
	it('forces weather + season in the snapshot, then clears back to live', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Ivy', passcode: '1234', appearance })).playerId;

		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { type: 'storm' } });
		let s = await w.get('GameState', pid);
		expect(s.weather.override.type).toBe('storm');
		expect(s.weather.byBiome.meadow.type).toBe('storm'); // every biome forced

		// season merges without dropping the weather override
		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { season: 'winter' } });
		s = await w.get('GameState', pid);
		expect(s.weather.season).toBe('winter');
		expect(s.weather.override.type).toBe('storm');

		// rejects nonsense, then clears
		await expect(w.post('DevTools', { playerId: pid, action: 'set-weather', value: { type: 'bananas' } })).rejects.toThrow();
		await w.post('DevTools', { playerId: pid, action: 'set-weather', value: { clear: true } });
		s = await w.get('GameState', pid);
		expect(s.weather.override).toBeUndefined();
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';

// Drives the real server bundle for the core single-world gameplay loop:
// create → gather → craft → place → persist. Mirrors scripts/smoke-test.sh but
// without needing a live Harper.

let w: World;
const RES = meadowResource();

beforeEach(async () => {
	w = await freshWorld();
});

describe('player lifecycle', () => {
	it('creates a player whose solo world is themselves, with a starter loadout', async () => {
		const a = await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance });
		expect(a.ok).toBe(true);
		expect(a.worldId).toBe(a.playerId);
		expect(a.state.chests.length).toBeGreaterThan(0); // starter chest
		// passcode must never leak back to the client
		expect(JSON.stringify(a.state)).not.toContain('1234');
	});

	it('rejects a duplicate name', async () => {
		await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance });
		await expect(w.post('CreatePlayer', { name: 'Sam', passcode: '9999', appearance })).rejects.toThrow();
	});

	it('logs in with the right passcode and rejects the wrong one', async () => {
		await w.post('CreatePlayer', { name: 'Sam', passcode: 'hunter2', appearance });
		await expect(w.post('LoginPlayer', { name: 'Sam', passcode: 'wrong' })).rejects.toThrow();
		const ok = await w.post('LoginPlayer', { name: 'Sam', passcode: 'hunter2' });
		expect(ok.ok).toBe(true);
		expect(ok.state.player.appearance).toMatchObject({ hat: 'straw' });
	});

	it('GameState for an unknown player fails', async () => {
		await expect(w.get('GameState', 'ghost')).rejects.toThrow();
	});
});

describe('gathering', () => {
	let pid: string;
	beforeEach(async () => {
		pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
	});

	it('collects a resource into the inventory', async () => {
		const g = await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
		expect(g.ok).toBe(true);
		expect(g.gained[RES]).toBeGreaterThanOrEqual(1);
		const state = await w.get('GameState', pid);
		expect(state.player.inventory[RES]).toBeGreaterThanOrEqual(1);
	});

	it('blocks re-harvesting the same node before it regrows', async () => {
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
		await expect(
			w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES }),
		).rejects.toThrow(/regrow/i);
	});

	it('blocks gathering from a locked biome', async () => {
		await expect(
			w.post('CollectResource', { playerId: pid, biomeId: 'wetland', nodeId: 'n1', resourceId: 'reeds' }),
		).rejects.toThrow();
	});

	it('persists gathered materials across re-login', async () => {
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: RES });
		const back = await w.post('LoginPlayer', { name: 'Sam', passcode: '1234' });
		expect(back.state.player.inventory[RES]).toBeGreaterThanOrEqual(1);
	});
});

describe('crafting + placing', () => {
	let pid: string;
	beforeEach(async () => {
		pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
		// grass-patch needs seeds (in the starter loadout) + fiber (gathered).
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'fiber-node', resourceId: 'fiber' });
	});

	it('crafts a recipe from gathered + starter materials', async () => {
		const c = await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		expect(c.ok).toBe(true);
		const state = await w.get('GameState', pid);
		// Crafted habitat objects go into the placeable `craftedItems` bag.
		expect(state.player.craftedItems['grass-patch']).toBeGreaterThanOrEqual(1);
	});

	it('refuses to craft when materials are missing', async () => {
		await expect(w.post('CraftItem', { playerId: pid, recipeId: 'small-pond' })).rejects.toThrow();
	});

	it('places a crafted object and improves biome health', async () => {
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		const before = (await w.get('GameState', pid)).biomeStates.find((b: any) => b.biomeId === 'meadow').health;
		const p = await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 10, y: 10 });
		expect(p.ok).toBe(true);
		expect(p.biomeState.health).toBeGreaterThanOrEqual(before);
	});

	it('persists placements across reload', async () => {
		await w.post('CraftItem', { playerId: pid, recipeId: 'grass-patch' });
		await w.post('PlaceObject', { playerId: pid, objectId: 'grass-patch', area: 'meadow', x: 10, y: 10 });
		const reload = await w.get('GameState', pid);
		expect(reload.placements.some((p: any) => p.objectId === 'grass-patch' && p.area === 'meadow')).toBe(true);
	});
});

describe('static game data', () => {
	it('GameData exposes the full content catalog', async () => {
		const d = await w.get('GameData');
		expect(d.biomes.length).toBeGreaterThan(0);
		expect(d.animals.length).toBeGreaterThan(0);
		expect(d.recipes.length).toBeGreaterThan(0);
		expect(d.habitatObjects.length).toBeGreaterThan(0);
		expect(d.appearanceOptions).toBeTruthy();
	});
});

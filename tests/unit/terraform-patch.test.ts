import { describe, it, expect } from 'vitest';
import { applyTerraformResult } from '../../src/terraformPatch';
import type { GameState } from '../../src/types';

// Digging and watering apply the server's response locally instead of blocking on
// a second, full-state refetch. That refetch was the safety net: whatever the
// reducer gets wrong now stays wrong until the trailing reconcile lands. These
// pin the pieces it has to get right.

const base = (terrain: any[] = []): GameState =>
	({
		player: { id: 'p1', inventory: { water: 5 } },
		biomeStates: [
			{ biomeId: 'meadow', health: 12 },
			{ biomeId: 'forest', health: 5 },
		],
		terrain,
	}) as unknown as GameState;

const tile = (x: number, y: number, type: string) => ({
	id: `p1:meadow:${x}:${y}`,
	area: 'meadow',
	x,
	y,
	type,
});

describe('applyTerraformResult', () => {
	it('adds a freshly dug bed', () => {
		const next = applyTerraformResult({ ok: true, tile: tile(3, 4, 'tilled') }, base(), 'meadow', 3, 4);
		expect(next?.terrain).toEqual([tile(3, 4, 'tilled')]);
	});

	it('replaces the tile in place when its type changes, rather than duplicating it', () => {
		const prev = base([tile(3, 4, 'tilled')]);
		const next = applyTerraformResult({ ok: true, tile: tile(3, 4, 'watered') }, prev, 'meadow', 3, 4);
		expect(next?.terrain).toHaveLength(1);
		expect(next?.terrain?.[0]).toMatchObject({ x: 3, y: 4, type: 'watered' });
	});

	it('drops a cleared tile, including a legacy row whose id predates the current scheme', () => {
		const legacy = { ...tile(3, 4, 'watered'), id: 'old-style-id' };
		const prev = base([legacy, tile(9, 9, 'tilled')]);
		const next = applyTerraformResult({ ok: true, removedId: 'old-style-id' }, prev, 'meadow', 3, 4);
		expect(next?.terrain).toEqual([tile(9, 9, 'tilled')]);
	});

	it('leaves other areas and other tiles untouched', () => {
		const elsewhere = { id: 'p1:forest:3:4', area: 'forest', x: 3, y: 4, type: 'tilled' };
		const prev = base([elsewhere]);
		const next = applyTerraformResult({ ok: true, tile: tile(3, 4, 'tilled') }, prev, 'meadow', 3, 4);
		expect(next?.terrain).toContainEqual(elsewhere);
		expect(next?.terrain).toHaveLength(2);
	});

	it('folds in the spent inventory and the recalculated biome health', () => {
		const next = applyTerraformResult(
			{
				ok: true,
				tile: tile(3, 4, 'watered'),
				inventory: { water: 4 },
				biomeState: { biomeId: 'meadow', health: 14 },
			},
			base([tile(3, 4, 'tilled')]),
			'meadow',
			3,
			4,
		);
		expect(next?.player.inventory).toEqual({ water: 4 });
		expect(next?.biomeStates.find((b) => b.biomeId === 'meadow')?.health).toBe(14);
		expect(next?.biomeStates.find((b) => b.biomeId === 'forest')?.health).toBe(5);
	});

	it('does not mutate the previous state', () => {
		const prev = base([tile(3, 4, 'tilled')]);
		const snapshot = JSON.stringify(prev);
		applyTerraformResult({ ok: true, tile: tile(3, 4, 'watered'), inventory: { water: 4 } }, prev, 'meadow', 3, 4);
		expect(JSON.stringify(prev)).toBe(snapshot);
	});

	it('bails to the full refetch when the response says more than a tile changed', () => {
		const prev = base();
		const arrival = { ok: true, tile: tile(3, 4, 'watered'), newAnimals: [{ animal: { id: 'grasshopper' } }] };
		const unlock = { ok: true, tile: tile(3, 4, 'watered'), unlockedBiomes: [{ id: 'forest' }] };
		expect(applyTerraformResult(arrival, prev, 'meadow', 3, 4)).toBeNull();
		expect(applyTerraformResult(unlock, prev, 'meadow', 3, 4)).toBeNull();
		expect(applyTerraformResult({ ok: false }, prev, 'meadow', 3, 4)).toBeNull();
		expect(applyTerraformResult(undefined, prev, 'meadow', 3, 4)).toBeNull();
	});
});

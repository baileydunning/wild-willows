import { describe, it, expect } from 'vitest';
import {
	applyCollectResult,
	applyCraftResult,
	applyHarvestResult,
	applyMoveResult,
	applyPlaceResult,
	applyPlantResult,
} from '../../src/actionPatch';
import type { GameState } from '../../src/types';

// Six verbs used to cost two serial round trips: the POST, then a full GameState
// refetch before anything could be drawn. That refetch was the safety net —
// whatever these reducers get wrong now stays wrong until the trailing reconcile
// lands ~1.5s later. These pin the pieces they have to get right, and, just as
// importantly, the cases where they must REFUSE and let the refetch happen.

const base = (over: Partial<GameState> = {}): GameState =>
	({
		worldId: 'w1',
		player: { id: 'p1', inventory: { wood: 2 }, craftedItems: { bench: 1 } },
		biomeStates: [
			{ biomeId: 'meadow', health: 12 },
			{ biomeId: 'forest', health: 5 },
		],
		placements: [],
		chests: [],
		nodeStates: [],
		terrain: [],
		...over,
	}) as unknown as GameState;

const placement = (over: any = {}) => ({
	id: 'pl1',
	objectId: 'willow',
	area: 'meadow',
	x: 3,
	y: 4,
	...over,
});

describe('applyCollectResult', () => {
	it('records the node cooldown under the id the reader looks it up by', () => {
		// WorldScene.nodeAvailable reads `${worldId}:${area}:${nodeId}`. If these two
		// ever disagree the node renders as full and the player gathers a bare patch.
		const next = applyCollectResult(
			{ ok: true, inventory: { wood: 5 }, nodeId: 'n7', harvestedAt: 1000 },
			base(),
			'meadow',
		);
		expect(next?.nodeStates).toEqual([{ id: 'w1:meadow:n7', harvestedAt: 1000 }]);
		expect(next?.player.inventory).toEqual({ wood: 5 });
	});

	it('falls back to the player id when there is no worldId, as solo saves do', () => {
		const prev = base();
		delete (prev as any).worldId;
		const next = applyCollectResult({ ok: true, inventory: {}, nodeId: 'n7', harvestedAt: 1 }, prev, 'meadow');
		expect(next?.nodeStates[0].id).toBe('p1:meadow:n7');
	});

	it('replaces an existing cooldown rather than stacking a second row', () => {
		const prev = base({ nodeStates: [{ id: 'w1:meadow:n7', harvestedAt: 100 }] } as any);
		const next = applyCollectResult({ ok: true, inventory: {}, nodeId: 'n7', harvestedAt: 900 }, prev, 'meadow');
		expect(next?.nodeStates).toHaveLength(1);
		expect(next?.nodeStates[0].harvestedAt).toBe(900);
	});

	it('refuses when the response is missing the cooldown stamp', () => {
		expect(applyCollectResult({ ok: true, inventory: {}, nodeId: 'n7' }, base(), 'meadow')).toBeNull();
	});
});

describe('applyPlantResult', () => {
	it('adds the plant and consumes the bed it was sown into', () => {
		const bed = { id: 't1', area: 'meadow', x: 3, y: 4, type: 'watered' };
		const other = { id: 't2', area: 'meadow', x: 9, y: 9, type: 'watered' };
		const prev = base({ terrain: [bed, other] } as any);
		const next = applyPlantResult({ ok: true, placement: placement(), inventory: { seed: 0 } }, prev);
		expect(next?.placements).toHaveLength(1);
		expect(next?.terrain).toEqual([other]); // only the sown bed goes
	});

	it('leaves a same-position bed in another biome alone', () => {
		const elsewhere = { id: 't3', area: 'forest', x: 3, y: 4, type: 'watered' };
		const prev = base({ terrain: [elsewhere] } as any);
		const next = applyPlantResult({ ok: true, placement: placement(), inventory: {} }, prev);
		expect(next?.terrain).toEqual([elsewhere]);
	});

	it('folds in the recalculated biome without disturbing the others', () => {
		const next = applyPlantResult(
			{ ok: true, placement: placement(), inventory: {}, biomeState: { biomeId: 'meadow', health: 14 } },
			base(),
		);
		expect(next?.biomeStates).toEqual([
			{ biomeId: 'meadow', health: 14 },
			{ biomeId: 'forest', health: 5 },
		]);
	});
});

describe('applyPlaceResult', () => {
	it('adds the placement and takes the item out of the crafted pile', () => {
		const next = applyPlaceResult({ ok: true, placement: placement(), craftedItems: { bench: 0 } }, base());
		expect(next?.placements).toHaveLength(1);
		expect(next?.player.craftedItems).toEqual({ bench: 0 });
	});
});

describe('applyHarvestResult', () => {
	it('replaces the plant in place, carrying the new regrow clock', () => {
		const prev = base({ placements: [placement({ plantedAt: 1 })] } as any);
		const next = applyHarvestResult(
			{ ok: true, placement: placement({ plantedAt: 1, lastHarvestAt: 500 }), inventory: { berry: 3 } },
			prev,
		);
		expect(next?.placements).toHaveLength(1); // replaced, never duplicated
		expect(next?.placements[0].lastHarvestAt).toBe(500);
	});
});

describe('applyCraftResult', () => {
	it('adopts inventory, crafted items and chests together', () => {
		const next = applyCraftResult(
			{ ok: true, craftedItems: { bench: 2 }, inventory: { wood: 0 }, chests: [{ id: 'c1', contents: {} }] },
			base(),
		);
		expect(next?.player.craftedItems).toEqual({ bench: 2 });
		expect(next?.player.inventory).toEqual({ wood: 0 });
		expect(next?.chests).toHaveLength(1);
	});

	it('leaves chests alone when the craft did not touch one', () => {
		const prev = base({ chests: [{ id: 'c1', contents: { wood: 9 } }] } as any);
		const next = applyCraftResult({ ok: true, craftedItems: {}, inventory: {} }, prev);
		expect(next?.chests).toEqual(prev.chests);
	});
});

describe('applyMoveResult', () => {
	it('moves the row without duplicating it', () => {
		const prev = base({ placements: [placement()] } as any);
		const next = applyMoveResult({ ok: true, placement: placement({ x: 8, y: 9, rotation: 90 }) }, prev);
		expect(next?.placements).toHaveLength(1);
		expect(next?.placements[0]).toMatchObject({ x: 8, y: 9, rotation: 90 });
	});
});

// The bail-outs are the reason this is safe to ship. A patcher that guesses is
// worse than the second round trip it replaces.
describe('refusing to patch', () => {
	const reducers: [string, (r: any, prev: GameState) => GameState | null][] = [
		['collect', (r, prev) => applyCollectResult(r, prev, 'meadow')],
		['plant', applyPlantResult],
		['place', applyPlaceResult],
		['harvest', applyHarvestResult],
		['craft', applyCraftResult],
		['move', applyMoveResult],
	];

	const full = {
		ok: true,
		inventory: {},
		craftedItems: {},
		nodeId: 'n1',
		harvestedAt: 1,
		placement: placement(),
	};

	it.each(reducers)('%s bails when an animal came home', (_name, fn) => {
		expect(fn({ ...full, newAnimals: [{ animal: { id: 'fox' } }] }, base())).toBeNull();
	});

	it.each(reducers)('%s bails when a biome unlocked', (_name, fn) => {
		expect(fn({ ...full, unlockedBiomes: [{ id: 'forest' }] }, base())).toBeNull();
	});

	it.each(reducers)('%s bails when the server did not say ok', (_name, fn) => {
		expect(fn({ ...full, ok: false }, base())).toBeNull();
	});

	it.each(reducers)('%s bails on an empty response', (_name, fn) => {
		expect(fn(undefined, base())).toBeNull();
	});
});

describe('purity', () => {
	it('never mutates the snapshot it was handed', () => {
		const prev = base({
			placements: [placement()],
			terrain: [{ id: 't1', area: 'meadow', x: 3, y: 4, type: 'watered' }],
			nodeStates: [{ id: 'w1:meadow:n7', harvestedAt: 1 }],
		} as any);
		const frozen = JSON.stringify(prev);
		applyCollectResult({ ok: true, inventory: { wood: 9 }, nodeId: 'n7', harvestedAt: 2 }, prev, 'meadow');
		applyPlantResult({ ok: true, placement: placement({ id: 'pl2' }), inventory: {} }, prev);
		applyPlaceResult({ ok: true, placement: placement({ id: 'pl3' }), craftedItems: {} }, prev);
		applyHarvestResult({ ok: true, placement: placement({ lastHarvestAt: 7 }), inventory: {} }, prev);
		applyCraftResult({ ok: true, craftedItems: {}, inventory: {}, chests: [] }, prev);
		applyMoveResult({ ok: true, placement: placement({ x: 99 }) }, prev);
		expect(JSON.stringify(prev)).toBe(frozen);
	});
});

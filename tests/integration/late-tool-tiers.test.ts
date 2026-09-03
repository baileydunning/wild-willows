import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Tiers 5-7 of the basket, shovel and watering can.
//
// Tiers 1-4 were pure scalars — amount gathered or dug per action — so every
// upgrade above the first felt like the same work, slightly faster. The late
// tiers each add ONE ability instead: the basket stops turning you away and
// stops counting a slab of clay the same as a wildflower, the shovel prepares a
// patch and gives ground back when you clear it, and the can finally reads its
// own tier when you water with it.

let w: World;
let pid: string;

const tilesOf = async (area = 'meadow') => {
	const rows: any[] = [];
	for await (const r of w.db.TerrainTile.search()) rows.push(r);
	return rows.filter((r) => r.area === area);
};

const setTools = async (tools: Record<string, number>, inventory?: Record<string, number>) => {
	const p = await w.db.Player.get(pid);
	await w.db.Player.patch(pid, {
		tools: { ...p.tools, ...tools },
		...(inventory ? { inventory } : {}),
	});
};

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Wren', passcode: '1234', appearance })).playerId;
});

describe('carrying weight', () => {
	// A tier-1 basket holds 200. Stones weigh 2, so 150 of them are 300 units of
	// basket and do not fit — the same 150 wildflowers would.
	it('counts bulk stone against the basket twice', async () => {
		await w.db.Chest.put({
			id: 'chest-1',
			worldId: pid,
			playerId: pid,
			area: 'meadow',
			x: 10,
			y: 10,
			capacity: 400,
			contents: { stones: 200, wildflowers: 200 },
		});
		await setTools({ basket: 1 }, {});
		await expect(
			w.post('ChestTransfer', {
				playerId: pid,
				chestId: 'chest-1',
				resourceId: 'stones',
				qty: 150,
				direction: 'withdraw',
			}),
		).rejects.toThrow();
		const ok = await w.post('ChestTransfer', {
			playerId: pid,
			chestId: 'chest-1',
			resourceId: 'wildflowers',
			qty: 150,
			direction: 'withdraw',
		});
		expect(ok.ok).toBe(true);
	});

	// The one thing the tier-6 frame buys: the heavy things stop costing double.
	it('carries stone as if it were light once the frame is on', async () => {
		await w.db.Chest.put({
			id: 'chest-1',
			worldId: pid,
			playerId: pid,
			area: 'meadow',
			x: 10,
			y: 10,
			capacity: 400,
			contents: { stones: 200 },
		});
		await setTools({ basket: 6 }, {});
		const r = await w.post('ChestTransfer', {
			playerId: pid,
			chestId: 'chest-1',
			resourceId: 'stones',
			qty: 150,
			direction: 'withdraw',
		});
		expect(r.ok).toBe(true);
		expect(r.inventory.stones).toBe(150);
	});

	// The bug this guards: CAPACITY_BY_BASKET used to stop at 4 behind a `|| 200`
	// fallback, so a tier-5 basket silently held LESS than a tier-1 one.
	it('never shrinks the basket as the tier climbs', async () => {
		await w.db.Chest.put({
			id: 'chest-1',
			worldId: pid,
			playerId: pid,
			area: 'meadow',
			x: 10,
			y: 10,
			capacity: 2000,
			contents: { wildflowers: 1200 },
		});
		await setTools({ basket: 5 }, {});
		const r = await w.post('ChestTransfer', {
			playerId: pid,
			chestId: 'chest-1',
			resourceId: 'wildflowers',
			qty: 1000,
			direction: 'withdraw',
		});
		expect(r.ok).toBe(true);
	});
});

describe('a basket that will not turn you away', () => {
	it('sends what does not fit on to the nearest chest', async () => {
		// Basket full to the brim, and a tier-5 relay pack on. Every caretaker starts
		// with a chest standing in the meadow, which is where the spare should land.
		await setTools({ basket: 5 }, { wildflowers: 1100 });
		const r = await w.post('CollectResource', {
			playerId: pid,
			biomeId: 'meadow',
			nodeId: 'n1',
			resourceId: 'seeds',
		});
		expect(r.ok).toBe(true);
		expect(r.storedTo).toBeTruthy();

		const [chestId, qty] = Object.entries(r.storedTo as Record<string, number>)[0];
		expect(qty).toBeGreaterThan(0);
		expect((await w.db.Chest.get(chestId)).contents.seeds).toBe(qty);
		// and none of it was quietly dropped: the basket had no room, so the whole
		// pick went to the chest
		expect(r.inventory.seeds || 0).toBe(0);
	});

	it('still refuses a full basket below the relay tier', async () => {
		await setTools({ basket: 4 }, { wildflowers: 800 });
		await expect(
			w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n1', resourceId: 'seeds' }),
		).rejects.toThrow();
	});
});

describe('the brush is a choice, never a consequence of the tier', () => {
	// The whole point: upgrading must not start shaping ground nobody asked for.
	it('shapes exactly one square by default at every tier', async () => {
		for (const tier of [1, 4, 5, 7]) {
			await setTools({ shovel: tier }, {});
			const r = await w.post('Terraform', {
				playerId: pid,
				area: 'meadow',
				x: 5 + tier * 3,
				y: 8,
				action: 'dig',
				expect: null,
			});
			expect(r.tiles).toHaveLength(1);
		}
	});

	it('offers no wider brush until the tool has earned it', async () => {
		await setTools({ shovel: 4 }, {});
		await expect(
			w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null, size: 3 }),
		).rejects.toThrow();
	});

	it('shapes the square the caretaker actually chose', async () => {
		await setTools({ shovel: 5 }, {});
		const three = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 6,
			y: 8,
			action: 'dig',
			expect: null,
			size: 3,
		});
		expect(three.tiles).toHaveLength(9);

		await setTools({ shovel: 7 }, {});
		const nine = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 16,
			y: 12,
			action: 'dig',
			expect: null,
			size: 9,
		});
		expect(nine.tiles).toHaveLength(81);
		expect(nine.tiles.every((t: any) => t.type === 'tilled')).toBe(true);
	});

	// A brush may only ever ADD ground. Anything already shaped stays as it was.
	it('never paints over ground that is already shaped', async () => {
		await setTools({ shovel: 1, 'watering-can': 1 }, { water: 20 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 7, action: 'dig', expect: null });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 7, action: 'water', expect: 'tilled' });

		await setTools({ shovel: 5 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null, size: 3 });
		const kept = (await tilesOf()).find((t) => t.x === 5 && t.y === 7);
		expect(kept.type).toBe('watered');
	});

	// Taking nine squares back at once is not something to do by accident.
	it('never brushes a clear', async () => {
		await setTools({ shovel: 7 }, {});
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 6, y: 8, action: 'dig', expect: null, size: 3 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 6, y: 8, action: 'clear', expect: 'tilled' });
		const left = (await tilesOf()).filter((t) => Math.abs(t.x - 6) <= 1 && Math.abs(t.y - 8) <= 1);
		expect(left).toHaveLength(8); // the 3x3 less the one square that was cleared
	});
});

describe('a shovel that gives ground back', () => {
	it('returns what the ground soaked up when a salvage spade clears it', async () => {
		await setTools({ shovel: 1, 'watering-can': 1 }, { water: 20 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' });
		const before = (await w.db.Player.get(pid)).inventory.water;

		await setTools({ shovel: 7 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'clear', expect: 'watered' });
		expect((await w.db.Player.get(pid)).inventory.water).toBe(before + 1);
	});

	it('leaves a lower tier as a plain clear', async () => {
		await setTools({ shovel: 4, 'watering-can': 1 }, { water: 20 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' });
		const before = (await w.db.Player.get(pid)).inventory.water;
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'clear', expect: 'watered' });
		expect((await w.db.Player.get(pid)).inventory.water).toBe(before);
	});
});

describe('a can that reads its own tier', () => {
	it('waters one bed unless a wider brush was chosen', async () => {
		await setTools({ shovel: 5, 'watering-can': 5 }, { water: 40 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 8, y: 8, action: 'dig', expect: null, size: 3 });
		const one = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 8,
			y: 8,
			action: 'water',
			expect: 'tilled',
		});
		expect(one.tiles).toHaveLength(1);

		const many = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 9,
			y: 8,
			action: 'water',
			expect: 'tilled',
			size: 3,
		});
		expect(many.tiles.length).toBeGreaterThan(1);
		expect(many.tiles.every((t: any) => t.type === 'watered')).toBe(true);
	});

	it('stops the pour when the water runs out rather than failing it', async () => {
		await setTools({ shovel: 5, 'watering-can': 5 }, { water: 2 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 8, y: 8, action: 'dig', expect: null, size: 3 });
		const r = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 8,
			y: 8,
			action: 'water',
			expect: 'tilled',
			size: 3,
		});
		expect(r.ok).toBe(true);
		// two water held: the clicked bed plus one more, and no error for the rest
		expect(r.tiles).toHaveLength(2);
		expect(r.inventory.water || 0).toBe(0);
	});
});

describe('a dipping pail', () => {
	const pond = async () => {
		await setTools({ shovel: 1, 'watering-can': 1 }, { water: 20 });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 7, y: 9, action: 'dig', expect: null });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 7, y: 9, action: 'water', expect: 'tilled' });
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 7, y: 9, action: 'water', expect: 'watered' });
	};

	it('fills straight from open water the caretaker shaped', async () => {
		await pond();
		await setTools({ 'watering-can': 6 }, {});
		const r = await w.post('CollectResource', {
			playerId: pid,
			biomeId: 'meadow',
			nodeId: 'dip-7-9',
			resourceId: 'water',
		});
		expect(r.ok).toBe(true);
		expect(r.inventory.water).toBeGreaterThan(0);

		// Your own pond does not run dry: no cooldown, and nothing stored for it.
		const again = await w.post('CollectResource', {
			playerId: pid,
			biomeId: 'meadow',
			nodeId: 'dip-7-9',
			resourceId: 'water',
		});
		expect(again.ok).toBe(true);
	});

	it('needs the pail, and needs water actually to be there', async () => {
		await pond();
		await setTools({ 'watering-can': 5 }, {});
		await expect(
			w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'dip-7-9', resourceId: 'water' }),
		).rejects.toThrow();

		await setTools({ 'watering-can': 6 }, {});
		await expect(
			w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'dip-20-20', resourceId: 'water' }),
		).rejects.toThrow();
	});
});

describe('a survey spade', () => {
	it('marks buried ground only for the caretaker carrying one', async () => {
		await setTools({ shovel: 5 }, {});
		expect((await w.get('GameState', pid)).buriedCaches).toEqual([]);

		await setTools({ shovel: 6 }, {});
		const marked = (await w.get('GameState', pid)).buriedCaches;
		expect(marked.length).toBeGreaterThan(0);

		// Derived, not stored: the same world answers the same way every time.
		expect((await w.get('GameState', pid)).buriedCaches).toEqual(marked);
	});
});

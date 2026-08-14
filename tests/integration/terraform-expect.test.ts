import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// A playtester's soil beds kept turning into ponds.
//
// Watering ESCALATES: bare ground digs into a bed, a bed waters, and a watered
// bed floods into open water. Which of those a click means is decided on the
// CLIENT, from its own copy of the tile — and that copy doesn't change until the
// round trip lands. So on a slow connection: water a bed, see nothing happen,
// click again. The second click was decided against a tilled bed but arrives at
// a tile the first click already watered, and the server floods it. The player
// wanted a watering; they got a pond, and no confirmation stood between the two.
//
// The fix is a compare-and-swap. The client says what it believed the tile was
// (`expect`); a command aimed at ground that has since become something else is
// refused rather than applied to whatever happens to be there now.

let w: World;
let pid: string;

const tileAt = async (x: number, y: number) => {
	const rows: any[] = [];
	for await (const r of w.db.TerrainTile.search()) rows.push(r);
	return rows.find((r) => r.playerId === pid && r.area === 'meadow' && r.x === x && r.y === y);
};

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Wren', passcode: '1234', appearance })).playerId;
	const p = await w.db.Player.get(pid);
	await w.db.Player.patch(pid, {
		tools: { ...(p.tools || {}), shovel: 1, 'watering-can': 1 },
		inventory: { ...(p.inventory || {}), water: 40 },
	});
	await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null });
});

describe('Terraform expect (compare-and-swap)', () => {
	it('waters a bed the caretaker is actually looking at', async () => {
		const r = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 5,
			y: 8,
			action: 'water',
			expect: 'tilled',
		});
		expect(r.ok).toBe(true);
		expect((await tileAt(5, 8)).type).toBe('watered');
	});

	it('refuses the impatient second click instead of flooding the bed', async () => {
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' });

		// The double-click: sent while the first request was still in flight, so it
		// still believes the bed is tilled. This is the exact request that used to
		// turn a soil bed into open water.
		// …and it says so in terms the player can act on, rather than a bare refusal:
		// the bed is watered, and clicking again is how you'd flood it on purpose.
		await expect(
			w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' }),
		).rejects.toThrow(/flood it into open water/i);

		// …and the bed is untouched — still a watered bed, ready to plant.
		expect((await tileAt(5, 8)).type).toBe('watered');
	});

	it('refunds nothing and spends nothing on a refused command', async () => {
		const before = (await w.db.Player.get(pid)).inventory.water;
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' });
		const after = (await w.db.Player.get(pid)).inventory.water;
		expect(after).toBe(before - 1);

		await expect(
			w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' }),
		).rejects.toThrow();
		// A bounced command must not quietly cost a water on its way out.
		expect((await w.db.Player.get(pid)).inventory.water).toBe(after);
	});

	it('still lets a caretaker deliberately flood a bed into open water', async () => {
		// The pond-maker's second click is aimed at the bed they can SEE is watered,
		// so it says so — and shaping ponds, rivers and lakes goes on working.
		await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water', expect: 'tilled' });
		const flood = await w.post('Terraform', {
			playerId: pid,
			area: 'meadow',
			x: 5,
			y: 8,
			action: 'water',
			expect: 'watered',
		});
		expect(flood.ok).toBe(true);
		expect((await tileAt(5, 8)).type).toBe('water');
	});

	it('refuses a shovel aimed at ground that has already been dug', async () => {
		// Same accident, other tool: a dig click that lands after the ground it was
		// aimed at became a bed would otherwise fall through to "clear" rules.
		await expect(
			w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'dig', expect: null }),
		).rejects.toThrow(/changed while you were working/i);
		expect((await tileAt(5, 8)).type).toBe('tilled');
	});

	it('skips the check entirely when the client does not send one', async () => {
		// Back-compat: a client from before this change (an itch.io tab left open, a
		// cached bundle) sends no `expect` and must keep working exactly as it did.
		const r = await w.post('Terraform', { playerId: pid, area: 'meadow', x: 5, y: 8, action: 'water' });
		expect(r.ok).toBe(true);
		expect((await tileAt(5, 8)).type).toBe('watered');
	});
});

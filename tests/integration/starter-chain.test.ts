import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// The ten-goal starter chain, driven through the real server bundle.
//
// Three things have to hold, and each of them has already been a bug in some
// game somewhere:
//
//  • A SHORT horizon: three links at a time, in chain order. The board is what's
//    next, not a backlog — if all ten ever show up together the feature has
//    silently reverted to a chore list.
//  • Claiming one pulls the following link up into the empty slot. The chain is
//    only a chain if the board moves.
//  • Saves that finished the OLD three-goal opening never see it. Dropping seven
//    tutorial goals onto a months-old save is the regression that would make
//    this change unshippable, and it is invisible in a fresh-save test.

let w: World;
let pid: string;

const starters = (dt: any) => (dt.tasks || []).filter((t: any) => String(t.id).startsWith('start-'));
const board = async (id = pid) => (await w.get('GameState', id)).dailyTasks;

/** Actually gather, one node at a time — the opening goal counts pickups now, so
 *  handing the player a full basket no longer finishes it. */
const gatherSeeds = async (n: number) => {
	for (let i = 0; i < n; i++) {
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${i}`, resourceId: 'seeds' });
	}
};

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
});

describe('the starter chain', () => {
	it('shows the first three links, in chain order', async () => {
		const shown = starters(await board());
		expect(shown.map((t: any) => t.id)).toEqual(['start-seeds', 'start-grasshopper', 'start-plant']);
		expect(shown[0].target).toBe(10);
		expect(shown[0].progress).toBe(0); // new caretakers hold no seeds
	});

	it('starts every visible goal at zero on a fresh save', async () => {
		// A goal that greets a new player half-full reads as a broken counter, which
		// is what a two-step craft-then-place bar did: crafting is a prerequisite of
		// placing, so it counted one act twice and arrived at 1/2 for any save that
		// had ever crafted anything.
		for (const t of starters(await board())) {
			expect([t.id, t.progress]).toEqual([t.id, 0]);
		}
	});

	it('lets a caretaker actually finish the rest goal', async () => {
		await skipTo('start-rest');
		// The sleeping bag used to be locked behind welcoming the ground squirrel,
		// which put this goal — second in the chain — behind an animal that arrives
		// much later, with the whole chain queued up behind it. A new save has to be
		// able to craft one on day one, or the opening deadlocks.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), fiber: 4 } });
		const crafted = await w.post('CraftItem', { playerId: pid, recipeId: 'home-sleeping-bag' });
		expect(crafted.ok).toBe(true);

		expect(starters(await board()).find((t: any) => t.id === 'start-rest').progress).toBe(0);
		// The camp tent's interior is a 6×5 room centred in the 30×20 grid (x 12-17,
		// y 7-11) with the door at the bottom middle — this corner is on the floor
		// and well clear of it, which the server insists on for anything sleepable.
		await w.post('PlaceObject', { playerId: pid, objectId: 'home-sleeping-bag', area: 'home', x: 12, y: 7 });
		await w.post('Rest', { playerId: pid });
		expect(starters(await board()).find((t: any) => t.id === 'start-rest').progress).toBe(1);
	});

	it('tags the gather goal with the resource it counts, so the client can keep it live', async () => {
		// The bar has to move as seeds land in the basket, not on the next full
		// sync — the client credits the pickup from these fields.
		const seeds = starters(await board())[0];
		expect(seeds.resourceId).toBe('seeds');
		expect(seeds.base).toBe(0);
		expect(seeds.monotonic).toBe(true);
	});

	it('counts seeds GATHERED, so spending them cannot undo the goal', async () => {
		await gatherSeeds(2);
		const after = starters(await board())[0];
		expect(after.progress).toBeGreaterThan(0);

		// Now spend every seed. The goal measures gathering, not holding, so the bar
		// must stay exactly where it was.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), seeds: 0 } });
		expect(starters(await board())[0].progress).toBe(after.progress);
	});

	it('reveals the next goal when the current one is claimed', async () => {
		await gatherSeeds(10);

		const first = starters(await board())[0];
		expect(first.progress).toBe(first.target);

		await w.post('ClaimTask', { playerId: pid, taskId: first.id });

		// The claimed link leaves, the next one moves up, and the horizon stays three.
		const next = starters(await board());
		expect(next.map((t: any) => t.id)).toEqual(['start-grasshopper', 'start-plant', 'start-harvest']);
	});

	it('walks the whole chain in order and ends on Build a home', async () => {
		const seen: string[] = [];
		// Claim each link by satisfying it the cheap way — the point here is the
		// ORDER and the hand-off, not the individual progress rules (those are
		// asserted per-goal below and by the gameplay suites).
		for (let i = 0; i < 12; i++) {
			const shown = starters(await board());
			if (!shown.length) break;
			// Never more than three, at any point in the chain — including the tail,
			// where fewer than three remain and the board simply gets shorter.
			expect(shown.length).toBeLessThanOrEqual(3);
			expect(shown.length).toBe(Math.min(3, 10 - seen.length));
			const task = shown[0];
			seen.push(task.id);
			// Force this goal complete, then claim it.
			await w.db.Player.patch(pid, {
				goalClaims: { ...((await w.db.Player.get(pid)).goalClaims || {}), [task.id]: true },
			});
		}
		expect(seen).toEqual([
			'start-seeds',
			'start-grasshopper',
			'start-plant',
			'start-harvest',
			'start-bugs',
			'start-journal-upgrade',
			'start-build-ten',
			'start-rest',
			'start-stream',
			'start-home',
		]);
		// Chain done: the board hands over to the player's own goals.
		expect(starters(await board())).toHaveLength(0);
	});

	const CHAIN = [
		'start-seeds',
		'start-grasshopper',
		'start-plant',
		'start-harvest',
		'start-bugs',
		'start-journal-upgrade',
		'start-build-ten',
		'start-rest',
		'start-stream',
		'start-home',
	];

	/** Claim-skip everything before `id`, so the goal under test is the one on the board. */
	const skipTo = async (id: string) => {
		const claims: Record<string, boolean> = {};
		for (const s of CHAIN) {
			if (s === id) break;
			claims[s] = true;
		}
		await w.db.Player.patch(pid, { goalClaims: claims });
	};

	it('measures the stream from water the player actually shaped', async () => {
		await skipTo('start-stream');
		const stream = starters(await board())[0];
		expect(stream.id).toBe('start-stream');
		expect(stream.target).toBe(3);
		expect(stream.progress).toBe(0);

		// Dig three beds in a row and flood each one: tilled -> watered -> open water.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), water: 20 } });
		for (const x of [6, 7, 8]) {
			await w.post('Terraform', { playerId: pid, area: 'meadow', x, y: 6, action: 'dig' });
			await w.post('Terraform', { playerId: pid, area: 'meadow', x, y: 6, action: 'water' });
			await w.post('Terraform', { playerId: pid, area: 'meadow', x, y: 6, action: 'water' });
		}
		expect(starters(await board())[0].progress).toBe(3);
		// …and the claim path measures it too, which needs terrain loaded there as
		// well — this is the assertion that catches a board that shows a finished
		// goal the server then refuses to pay out.
		const claim = await w.post('ClaimTask', { playerId: pid, taskId: 'start-stream' });
		expect(claim.ok).toBe(true);
		expect(starters(await board())[0].id).toBe('start-home');
	});

	it('counts both bug kinds, and nothing with a backbone', async () => {
		await skipTo('start-bugs');
		const home = async (animalId: string) =>
			w.db.Discovery.put({
				id: `${pid}:${animalId}`,
				worldId: pid,
				playerId: pid,
				animalId,
				biomeId: 'meadow',
				comfort: 50,
				timesObserved: 0,
				firstObservedAt: Date.now(),
			});
		expect(starters(await board())[0].progress).toBe(0);

		// A vole is a mammal: it has a backbone and does not count, however many
		// come home.
		await home('prairie-vole');
		await home('cottontail-rabbit');
		expect(starters(await board())[0].progress).toBe(0);

		// The definitions file files a grasshopper under kind 'insect' and a snail
		// under 'invertebrate'. Both are bugs — this is the assertion that stops the
		// goal quietly disagreeing with the player about what a ladybug is.
		await home('grasshopper');
		expect(starters(await board())[0].progress).toBe(1);
		await home('snail');
		expect(starters(await board())[0].progress).toBe(2);
		await home('ladybug');
		expect(starters(await board())[0].progress).toBe(3);
	});

	it('counts a harvest from the plant it was taken from', async () => {
		await skipTo('start-harvest');
		expect(starters(await board())[0].progress).toBe(0);
		// Harvested through the endpoint, not by writing the stamp on a row: the
		// goal reads the player's standing tallies now (see bumpStanding), and those
		// are kept by the action. A row put straight into the store is a world no
		// action ever happened in — which is a fine way to set up a fixture and no
		// way at all to test the thing that counts the action.
		const plant = {
			id: `${pid}:meadow:pl_flower`,
			worldId: pid,
			playerId: pid,
			objectId: 'wildflower-patch',
			area: 'meadow',
			x: 5,
			y: 5,
			placedAt: Date.now() - 600_000,
			plantedAt: Date.now() - 600_000,
		};
		await w.db.Placement.put(plant);
		await w.post('HarvestPlacement', { playerId: pid, placementId: plant.id });
		expect(starters(await board())[0].progress).toBe(1);
		// Picking it again is the same one harvested plant, and the goal does not
		// run past its own target.
		await w.db.Placement.patch(plant.id, { lastHarvestAt: Date.now() - 120_000 });
		await w.post('HarvestPlacement', { playerId: pid, placementId: plant.id });
		expect(starters(await board())[0].progress).toBe(1);
	});

	it('never shows the chain to a save that finished the old three starters', async () => {
		await w.db.Player.patch(pid, {
			goalClaims: { 'start-gather': true, 'start-craft': true, 'start-welcome': true },
		});
		expect(starters(await board())).toHaveLength(0);
	});

	it('still shows the chain to a save that only got partway through the old one', async () => {
		// Mid-chain legacy saves are NOT retired — they were still being taught.
		await w.db.Player.patch(pid, { goalClaims: { 'start-gather': true, 'start-craft': true } });
		const shown = starters(await board());
		expect(shown).toHaveLength(3);
		expect(shown[0].id).toBe('start-seeds');
	});
});

describe('starter-chain metrics', () => {
	it('reports the step reached, and counts goals the player wrote', async () => {
		let m = (await w.get('Metrics', pid)).player;
		expect(m.starterStep).toBe(0);
		expect(m.starterTotal).toBe(10);
		expect(m.starterDone).toBe(false);
		expect(m.goalsCreated).toBe(0);

		await gatherSeeds(10);
		await w.post('ClaimTask', { playerId: pid, taskId: 'start-seeds' });

		m = (await w.get('Metrics', pid)).player;
		expect(m.starterStep).toBe(1);
		expect(m.starterDone).toBe(false);
	});

	it('counts an authored goal even after it is finished and cleared', async () => {
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'tool', toolId: 'shovel', target: 2 }] });
		let m = (await w.get('Metrics', pid)).player;
		expect(m.goalsCreated).toBe(1);

		// Clearing the list must NOT rewind the tally — "did they ever use the
		// board" is the conversion this feature is measured on.
		await w.post('SetGoals', { playerId: pid, goals: [] });
		m = (await w.get('Metrics', pid)).player;
		expect(m.goalsCreated).toBe(1);
		expect((await w.db.Player.get(pid)).customGoals).toEqual([]);
	});

	it('counts a legacy save as finished rather than stalled at zero', async () => {
		await w.db.Player.patch(pid, {
			goalClaims: { 'start-gather': true, 'start-craft': true, 'start-welcome': true },
		});
		const m = (await w.get('Metrics', pid)).player;
		expect(m.starterDone).toBe(true);
		expect(m.starterLegacy).toBe(true);
		expect(m.starterStep).toBe(10);
	});
});

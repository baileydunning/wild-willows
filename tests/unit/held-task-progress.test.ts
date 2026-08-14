import { describe, it, expect } from 'vitest';
import { withEventTaskProgress, withHeldTaskProgress } from '../../src/actionPatch';

// "Gather 10 seeds" is the first number a new player watches, and it used to sit
// at 0/10 while seeds visibly stacked up in the basket — every optimistic action
// patch rewrote the inventory and left the board exactly as the last sync had
// sent it, so the counter only caught up when the trailing reconcile landed a
// second or so later. A counter that lags the thing it counts reads as broken.
//
// These pin the recompute: it follows the basket AND the chests, it respects a
// goal's baseline, it clamps, and it refuses to touch anything the server didn't
// explicitly mark as a held-materials goal.

const state = (over: any = {}): any => ({
	player: { id: 'p1', inventory: { seeds: 0 } },
	chests: [],
	dailyTasks: {
		dayKey: 1,
		endsAt: 0,
		tasks: [
			{
				id: 'start-seeds',
				kind: 'gather',
				icon: 'basket',
				text: 'Gather 10 seeds',
				target: 10,
				counter: '',
				reward: {},
				progress: 0,
				claimed: false,
				resourceId: 'seeds',
				base: 0,
			},
		],
	},
	...over,
});

const seedTask = (s: any) => s.dailyTasks.tasks.find((t: any) => t.id === 'start-seeds');

describe('held-material goal progress', () => {
	it('tracks what is in the basket right now', () => {
		const next = withHeldTaskProgress(state({ player: { id: 'p1', inventory: { seeds: 4 } } }));
		expect(seedTask(next).progress).toBe(4);
	});

	it('counts chests too, the same way the server does', () => {
		const next = withHeldTaskProgress(
			state({
				player: { id: 'p1', inventory: { seeds: 2 } },
				chests: [
					{ id: 'c1', contents: { seeds: 3 } },
					{ id: 'c2', contents: { seeds: 1, fiber: 9 } },
				],
			}),
		);
		expect(seedTask(next).progress).toBe(6);
	});

	it('never exceeds the target or falls below zero', () => {
		const over = withHeldTaskProgress(state({ player: { id: 'p1', inventory: { seeds: 99 } } }));
		expect(seedTask(over).progress).toBe(10);

		// Spending materials below the goal's baseline must not produce a negative bar.
		const s = state({ player: { id: 'p1', inventory: { seeds: 1 } } });
		s.dailyTasks.tasks[0].base = 5;
		expect(seedTask(withHeldTaskProgress(s)).progress).toBe(0);
	});

	it('counts only what was gathered since a goal was set', () => {
		// A player-set "collect 10 seeds" goal made while holding 4 is at 0, not 4.
		const s = state({ player: { id: 'p1', inventory: { seeds: 6 } } });
		s.dailyTasks.tasks[0].base = 4;
		expect(seedTask(withHeldTaskProgress(s)).progress).toBe(2);
	});

	it('leaves every other goal exactly as the server sent it', () => {
		// No resourceId means the client does not own this goal's rules. Guessing at
		// them is how the two drift, so an untagged task is passed through untouched
		// — object identity included, which is what keeps this from re-rendering the
		// whole board on every pickup.
		const s = state();
		s.dailyTasks.tasks.push({
			id: 'start-plant',
			kind: 'plant',
			icon: 'leaf',
			text: 'Plant 3 seedlings',
			target: 3,
			counter: '',
			reward: {},
			progress: 1,
			claimed: false,
		});
		const next = withHeldTaskProgress(s);
		const plant = next.dailyTasks.tasks.find((t: any) => t.id === 'start-plant');
		expect(plant.progress).toBe(1);
		expect(plant).toBe(s.dailyTasks.tasks[1]);
	});

	it('returns the same object when nothing moved', () => {
		const s = state();
		expect(withHeldTaskProgress(s)).toBe(s);
	});

	it('is a no-op on a state with no board yet', () => {
		const s = state({ dailyTasks: undefined });
		expect(withHeldTaskProgress(s)).toBe(s);
	});
});

describe('action-counting goal progress', () => {
	const gatherState = () => {
		const s = state();
		s.dailyTasks.tasks[0].monotonic = true;
		s.dailyTasks.tasks[0].event = 'gather';
		return s;
	};

	it('credits a pickup as it lands', () => {
		const next = withEventTaskProgress(gatherState(), 'gather', 3, 'seeds');
		expect(seedTask(next).progress).toBe(3);
	});

	it('never falls back when the player spends what they gathered', () => {
		// The whole point: seeds gathered for the first goal are spent on the ones
		// right after it, and a bar that drops to 4/10 because you planted something
		// is telling the player their work was undone.
		let s = withEventTaskProgress(gatherState(), 'gather', 10, 'seeds');
		expect(seedTask(s).progress).toBe(10);
		s.player.inventory.seeds = 0; // spent on planting
		s = withHeldTaskProgress(s);
		expect(seedTask(s).progress).toBe(10);
	});

	it('stops at the target and ignores other resources', () => {
		expect(seedTask(withEventTaskProgress(gatherState(), 'gather', 99, 'seeds')).progress).toBe(10);
		expect(seedTask(withEventTaskProgress(gatherState(), 'gather', 5, 'fiber')).progress).toBe(0);
	});

	it('credits a placement to a build goal the moment it lands in the world', () => {
		const s = state();
		s.dailyTasks.tasks[0].monotonic = true;
		s.dailyTasks.tasks[0].event = 'place';
		delete s.dailyTasks.tasks[0].resourceId; // a place goal names no material
		expect(seedTask(withEventTaskProgress(s, 'place', 1)).progress).toBe(1);
		// …and a gather doesn't touch it
		expect(withEventTaskProgress(s, 'gather', 3, 'seeds')).toBe(s);
	});

	it('leaves held-counting goals to the other pass', () => {
		const s = state(); // no event flag
		expect(withEventTaskProgress(s, 'gather', 4, 'seeds')).toBe(s);
	});
});

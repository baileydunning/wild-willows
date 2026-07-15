import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Tool-upgrade goals: the player can set "upgrade a tool" as a goal, it shows on
// the board with a materials checklist, and it completes when the tool reaches
// the target tier — driven through the real server bundle.

let w: World;
let pid: string;

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
});

const toolTask = (dt: any) => dt.tasks.find((t: any) => t.kind === 'tool');

describe('tool-upgrade goals', () => {
	it('shows a tool goal with a materials checklist and completes on upgrade', async () => {
		// Basket tier 2 needs meadow at 40% health + fiber/branches/stones.
		let meadow: any;
		for await (const b of w.db.BiomeState.search()) if (b.biomeId === 'meadow') meadow = b;
		await w.db.BiomeState.patch(meadow.id, { health: 40 });

		// Set the goal (no materials yet): reach basket tier 2.
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'tool', toolId: 'basket', target: 2 }] });

		let dt = (await w.get('GameState', pid)).dailyTasks;
		const task = toolTask(dt);
		expect(task).toBeTruthy();
		expect(task.target).toBe(2);
		expect(task.progress).toBe(1); // current tier is 1
		expect(task.text).toMatch(/Reinforced Gathering Basket/);
		// materials checklist present and not yet satisfied (nothing gathered)
		expect(task.steps).toHaveLength(3);
		expect(task.steps.every((s: any) => s.done === false)).toBe(true);

		// Gather the materials and actually upgrade the tool.
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), fiber: 8, branches: 4, stones: 2 } });
		const up = await w.post('UpgradeTool', { playerId: pid, toolId: 'basket' });
		expect(up.upgraded.tier).toBe(2);

		// The goal is now complete (progress meets target).
		dt = (await w.get('GameState', pid)).dailyTasks;
		const done = toolTask(dt);
		expect(done.progress).toBe(2);
		expect(done.progress).toBeGreaterThanOrEqual(done.target);
	});

	it('rejects a tool goal for an unknown tool but keeps valid ones', async () => {
		await w.post('SetGoals', {
			playerId: pid,
			goals: [
				{ kind: 'tool', toolId: 'not-a-tool', target: 2 },
				{ kind: 'tool', toolId: 'shovel', target: 2 },
			],
		});
		const p = await w.db.Player.get(pid);
		const tools = (p.customGoals || []).filter((g: any) => g.kind === 'tool');
		expect(tools).toHaveLength(1);
		expect(tools[0].toolId).toBe('shovel');
	});
});

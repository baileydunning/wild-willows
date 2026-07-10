import { describe, it } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

describe('probe2', () => {
	it('claim mechanics', async () => {
		const w: World = await freshWorld();
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;

		let dt = (await w.get('GameState', pid)).dailyTasks;
		console.log('FULL_TASK0:', JSON.stringify(dt.tasks[0]));
		console.log('FULL_TASK1:', JSON.stringify(dt.tasks[1]));

		// claiming the pinned next-biome should throw
		try { await w.post('ClaimTask', { playerId: pid, taskId: 'next-biome' }); console.log('CLAIM_NEXTBIOME: no throw'); }
		catch (e: any) { console.log('CLAIM_NEXTBIOME_ERR:', e.message); }

		// drive start-gather via inventory (progress from held seeds?)
		await w.db.Player.patch(pid, { inventory: { water: 6, wildflowers: 1, seeds: 12 } });
		dt = (await w.get('GameState', pid)).dailyTasks;
		const g = dt.tasks.find((t: any) => t.id === 'start-gather');
		console.log('START_GATHER_AFTER_12SEEDS:', JSON.stringify(g));

		// try claim start-gather
		try {
			const c = await w.post('ClaimTask', { playerId: pid, taskId: 'start-gather' });
			console.log('CLAIM_GATHER_OK gained:', JSON.stringify(c.gained), 'task claimed:', JSON.stringify(c.dailyTasks.tasks.find((t: any) => t.id === 'start-gather')?.claimed));
		} catch (e: any) { console.log('CLAIM_GATHER_ERR:', e.message); }

		// which tasks are claimable/pinned?
		dt = (await w.get('GameState', pid)).dailyTasks;
		console.log('BOARD_FLAGS:', JSON.stringify(dt.tasks.map((t: any) => ({ id: t.id, pinned: !!t.pinned, counter: t.counter || '', progress: t.progress, target: t.target, claimed: !!t.claimed }))));
	});
});

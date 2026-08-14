import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';
import { readFileSync } from 'node:fs';

// Daily-task rewards & gather targets must be drawn only from the biomes the
// player has PERSONALLY unlocked — never the wider co-op roam set — and the
// reward shown on the board must equal the reward granted on claim.
//
// The trap: a save whose worldId differs from its playerId (co-op, or a legacy
// world-id divergence) hits the snapshot's roam-expansion, which widens
// unlockedBiomes to every world-unlocked biome. Before the fix the board was
// generated from that widened set while ClaimTask used the personal set, so the
// pool — and the seeded reward — disagreed.

const biomes = JSON.parse(readFileSync('data/biomes.json', 'utf8')).records;
const resByBiome: Record<string, Set<string>> = Object.fromEntries(
	biomes.map((b: any) => [b.id, new Set(b.resources)]),
);

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

describe('daily tasks stay scoped to personally-unlocked biomes', () => {
	it('a diverged-world save with extra world-unlocked biomes still only rewards personal biomes', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;

		// Simulate the pathology: worldId != playerId, and the WORLD has forest +
		// wetland unlocked, but the PLAYER personally unlocked only the meadow.
		const NEWW = 'shared-world';
		const p = w.db.Player._rows.get(pid);
		w.db.Player._rows.set(pid, {
			...p,
			worldId: NEWW,
			unlockedBiomes: ['meadow'],
			createdAt: Date.now() - 5 * 86400000,
		});
		for (const b of ['meadow', 'forest', 'wetland']) {
			w.db.BiomeState._rows.set(`${NEWW}:${b}`, {
				id: `${NEWW}:${b}`,
				worldId: NEWW,
				playerId: pid,
				biomeId: b,
				unlocked: true,
				health: 40,
				balance: 10,
				returnedCount: 3,
			});
		}

		const s = await w.get('GameState', pid);
		const allowed = resByBiome['meadow']; // personal unlock only
		for (const t of s.dailyTasks.tasks) {
			for (const rid of Object.keys(t.reward || {})) {
				expect(allowed.has(rid), `reward "${rid}" in "${t.text}" must be a meadow resource`).toBe(true);
			}
			if (t.counter?.startsWith('res:')) {
				expect(allowed.has(t.counter.slice(4)), `gather target in "${t.text}"`).toBe(true);
			}
		}
	});

	it('the reward shown on the board equals the reward granted on claim', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Ivy', passcode: '1234', appearance })).playerId;
		const NEWW = 'shared-world';
		const p = w.db.Player._rows.get(pid);
		w.db.Player._rows.set(pid, { ...p, worldId: NEWW, unlockedBiomes: ['meadow'] });
		for (const b of ['meadow', 'forest', 'wetland']) {
			w.db.BiomeState._rows.set(`${NEWW}:${b}`, {
				id: `${NEWW}:${b}`,
				worldId: NEWW,
				playerId: pid,
				biomeId: b,
				unlocked: true,
				health: 40,
				balance: 10,
				returnedCount: 3,
			});
		}

		// Complete the gather starter (progress = seeds GATHERED, a lifetime tally)
		// and claim it.
		const s = await w.get('GameState', pid);
		const task = s.dailyTasks.tasks.find((t: any) => t.id === 'start-seeds');
		expect(task).toBeTruthy();
		for (let i = 0; i < task.target; i++) {
			await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${i}`, resourceId: 'seeds' });
		}

		const claimed = await w.post('ClaimTask', { playerId: pid, taskId: task.id });
		expect(claimed.ok).toBe(true);
		// Every granted resource is a meadow resource, and it matches the shown reward.
		for (const rid of Object.keys(claimed.gained)) {
			expect(resByBiome['meadow'].has(rid), `granted "${rid}"`).toBe(true);
		}
		expect(claimed.gained).toEqual(task.reward);
	});
});

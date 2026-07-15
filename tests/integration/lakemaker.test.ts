import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Regression: the wetland opens with pre-seeded natural channels (a river + a
// pond, all marked `seeded`). Those must NOT auto-grant the Lakemaker
// achievement — it should reward a lake the PLAYER actually shapes. Seeded water
// still counts toward animal water needs, just not toward this achievement.

describe('Lakemaker achievement', () => {
	let w: World;
	let pid: string;

	beforeEach(async () => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Digger', passcode: '1234', appearance })).playerId;
		const p = await w.db.Player.get(pid);
		// open the wetland and give the player the tools + water to shape ground
		await w.db.Player.patch(pid, {
			unlockedBiomes: ['meadow', 'forest', 'wetland'],
			tools: { ...(p.tools || {}), shovel: 1, 'watering-can': 1 },
			inventory: { ...(p.inventory || {}), water: 80 },
		});
	});

	const earned = async (): Promise<string[]> => {
		const rows: any[] = [];
		for await (const r of w.db.PlayerAchievement.search()) rows.push(r);
		return rows.filter((r) => r.playerId === pid).map((r) => r.achievementId);
	};

	it('is NOT granted just for unlocking the wetland (its seeded channels do not count)', async () => {
		// a big connected block of the wetland's natural, pre-seeded water
		for (let x = 6; x <= 14; x++) {
			await w.db.TerrainTile.put({
				id: `${pid}:wetland:${x}:4`,
				worldId: pid,
				playerId: pid,
				area: 'wetland',
				x,
				y: 4,
				type: 'water',
				seeded: true,
				updatedAt: Date.now(),
			});
		}
		// any terraform action triggers achievement evaluation
		await w.post('Terraform', { playerId: pid, area: 'wetland', x: 3, y: 10, action: 'dig' });
		expect(await earned()).not.toContain('wetland-lakemaker');
	});

	it('IS granted once the player shapes a lake of their own', async () => {
		// dig + flood 6 connected tiles into open water (player-shaped, not seeded)
		for (let x = 3; x <= 8; x++) {
			await w.post('Terraform', { playerId: pid, area: 'wetland', x, y: 10, action: 'dig' }); // tilled
			await w.post('Terraform', { playerId: pid, area: 'wetland', x, y: 10, action: 'water' }); // watered
			await w.post('Terraform', { playerId: pid, area: 'wetland', x, y: 10, action: 'water' }); // open water
		}
		expect(await earned()).toContain('wetland-lakemaker');
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';
import { readFileSync } from 'node:fs';

const animals = [
	...JSON.parse(readFileSync('data/animals-1.json', 'utf8')).records,
	...JSON.parse(readFileSync('data/animals-2.json', 'utf8')).records,
];
const objects = JSON.parse(readFileSync('data/habitat-objects.json', 'utf8')).records;
const meadowAnimals = animals.filter((a: any) => a.biome === 'meadow');

let w: World;
beforeEach(async () => { w = await freshWorld(); });

describe('DevTools populate-biome (showcase)', () => {
	it('builds a fully-restored, well-formed meadow', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
		const r = await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow' });
		expect(r.ok).toBe(true);

		const s = await w.get('GameState', pid);
		const meadow = s.biomeStates.find((b: any) => b.biomeId === 'meadow');
		expect(meadow.health).toBe(100);
		expect(meadow.balance).toBe(100);

		// every meadow animal is home and drawn (comfort high)
		const home = s.discoveries.filter((d: any) => d.biomeId === 'meadow');
		expect(home.length).toBe(meadowAnimals.length);
		expect(home.every((d: any) => d.comfort >= 80)).toBe(true);
		expect(meadow.returnedCount).toBe(meadowAnimals.length);

		// a lush spread of objects, and a pond (meadow can hold water)
		const pls = s.placements.filter((p: any) => p.area === 'meadow');
		expect(pls.length).toBeGreaterThanOrEqual(20);

		// scattered, not lined up at the top: objects spread across a wide band both ways
		const xs = pls.map((p: any) => p.x), ys = pls.map((p: any) => p.y);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(14);
		expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(10);

		// a real lake (a chunky connected blob) and a river (a long span) were carved
		const wc = s.terrain.filter((t: any) => t.area === 'meadow' && t.type === 'water');
		expect(wc.length).toBeGreaterThan(0);
		const cells = new Set(wc.map((t: any) => `${t.x},${t.y}`));
		const wSeen = new Set<string>();
		let lake = 0, river = 0;
		for (const t of wc) {
			const key = `${t.x},${t.y}`;
			if (wSeen.has(key)) continue;
			const stack = [[t.x, t.y]]; let size = 0, minx = t.x, maxx = t.x, miny = t.y, maxy = t.y;
			while (stack.length) {
				const [x, y] = stack.pop()!; const k = `${x},${y}`;
				if (wSeen.has(k) || !cells.has(k)) continue;
				wSeen.add(k); size++;
				minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
				stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
			}
			lake = Math.max(lake, size);
			river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
		}
		expect(lake).toBeGreaterThanOrEqual(6);   // lake blob
		expect(river).toBeGreaterThanOrEqual(8);  // river span

		// well-formed: no two objects share a cell, none sit on water, none in camp.
		// Chests are pre-existing camp fixtures the showcase keeps — exclude them.
		const objById = Object.fromEntries(objects.map((o: any) => [o.id, o]));
		const water = new Set(s.terrain.filter((t: any) => t.area === 'meadow').map((t: any) => `${t.x},${t.y}`));
		const seen = new Set<string>();
		for (const p of pls.filter((p: any) => !objById[p.objectId]?.isChest)) {
			const key = `${p.x},${p.y}`;
			expect(seen.has(key), `duplicate cell ${key}`).toBe(false);
			seen.add(key);
			expect(water.has(key), `object on water ${key}`).toBe(false);
			const inCamp = p.x >= 19 && p.x <= 24 && p.y >= 3 && p.y <= 6;
			expect(inCamp, `object in camp ${key}`).toBe(false);
			if (objById[p.objectId]?.plantable) {
				expect(p.plantedAt, `plant ${p.objectId} should read mature`).toBeLessThan(Date.now() - 86400000);
			}
		}
	});

	it('is idempotent — re-running keeps the biome clean (no duplicate stacks)', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Ivy', passcode: '1234', appearance })).playerId;
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow' });
		const first = (await w.get('GameState', pid)).placements.filter((p: any) => p.area === 'meadow').length;
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow' });
		const second = (await w.get('GameState', pid)).placements.filter((p: any) => p.area === 'meadow').length;
		expect(second).toBe(first);
	});

	it('dry biomes get no pond (desert cannot flood)', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Dez', passcode: '1234', appearance })).playerId;
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'desert' });
		const s = await w.get('GameState', pid);
		expect(s.terrain.filter((t: any) => t.area === 'desert' && t.type === 'water').length).toBe(0);
		expect(s.placements.filter((p: any) => p.area === 'desert').length).toBeGreaterThanOrEqual(20);
	});
});

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
beforeEach(async () => {
	w = await freshWorld();
});

describe('DevTools is gated to test saves', () => {
	// The previous gate was a constant nothing referenced, next to a comment
	// claiming it restricted access. These pin the real one.
	it('refuses a save that is not a test save', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Willow', passcode: '1234', appearance })).playerId;
		await expect(w.post('DevTools', { playerId: pid, action: 'grant-resources', amount: 200 })).rejects.toThrow();
		// and it refused BEFORE doing anything
		const s = await w.get('GameState', pid);
		expect(Object.values(s.player.inventory || {}).some((n: any) => n >= 200)).toBe(false);
	});

	it('accepts the name however it was typed', async () => {
		for (const name of ['bailey_test', 'Bailey_Test', 'bailey test', 'bailey-test']) {
			const w2 = await freshWorld();
			const pid = (await w2.post('CreatePlayer', { name, passcode: '1234', appearance })).playerId;
			const r = await w2.post('DevTools', { playerId: pid, action: 'grant-resources', amount: 200 });
			expect(r.ok, `${name} should be allowed`).toBe(true);
		}
	});

	it('does not treat a longer name as a match', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_testing', passcode: '1234', appearance })).playerId;
		await expect(w.post('DevTools', { playerId: pid, action: 'grant-resources', amount: 200 })).rejects.toThrow();
	});

	it('still 404s an unknown save rather than reporting the gate', async () => {
		// Order matters: requirePlayer runs first, so the gate never tells a caller
		// which player ids exist.
		await expect(w.post('DevTools', { playerId: 'nobody-abc123', action: 'grant-resources' })).rejects.toThrow();
	});
});

describe('DevTools populate-biome (showcase)', () => {
	it('builds a fully-restored, well-formed meadow', async () => {
		// DevTools is gated to bailey_test saves (DEV_PLAYER_SLUG in
		// server/resources.ts). These fixtures drive DevTools to set up state, so
		// they are exactly the saves that gate is for — named accordingly rather
		// than given a bypass, so the tests exercise the shipped rule.
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
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

		// the whole catalogue is standing: the showcase doubles as a look at every
		// buildable thing in the biome, so nothing may be missing from the shot
		const buildable = objects.filter(
			(o: any) =>
				(o.biomes || []).includes('meadow') &&
				o.placement !== 'indoor' &&
				o.placement !== 'none' &&
				!o.isChest &&
				!o.bridge,
		);
		const standing = new Set(pls.map((p: any) => p.objectId));
		const absent = buildable.filter((o: any) => !standing.has(o.id)).map((o: any) => o.id);
		expect(absent, `missing from the showcase: ${absent.join(', ')}`).toHaveLength(0);
		// one-per-area things appear exactly once, however lush the scatter got
		for (const o of buildable.filter((x: any) => x.onePerArea)) {
			expect(pls.filter((p: any) => p.objectId === o.id)).toHaveLength(1);
		}

		// scattered, not lined up at the top: objects spread across a wide band both ways
		const xs = pls.map((p: any) => p.x),
			ys = pls.map((p: any) => p.y);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(14);
		expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(10);

		// a real lake (a chunky connected blob) and a river (a long span) were carved
		const wc = s.terrain.filter((t: any) => t.area === 'meadow' && t.type === 'water');
		expect(wc.length).toBeGreaterThan(0);
		const cells = new Set(wc.map((t: any) => `${t.x},${t.y}`));
		const wSeen = new Set<string>();
		const pieces: number[] = [];
		let lake = 0,
			river = 0;
		for (const t of wc) {
			const key = `${t.x},${t.y}`;
			if (wSeen.has(key)) continue;
			const stack = [[t.x, t.y]];
			let size = 0,
				minx = t.x,
				maxx = t.x,
				miny = t.y,
				maxy = t.y;
			while (stack.length) {
				const [x, y] = stack.pop()!;
				const k = `${x},${y}`;
				if (wSeen.has(k) || !cells.has(k)) continue;
				wSeen.add(k);
				size++;
				minx = Math.min(minx, x);
				maxx = Math.max(maxx, x);
				miny = Math.min(miny, y);
				maxy = Math.max(maxy, y);
				stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
			}
			pieces.push(size);
			lake = Math.max(lake, size);
			river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
		}
		expect(lake).toBeGreaterThanOrEqual(6); // lake blob
		expect(river).toBeGreaterThanOrEqual(8); // river span
		// Shape, not just size: exactly two bodies of water, the lake and the river.
		// The carver refuses cells it may not take (camp, lake, board edge), and a
		// refused step used to be skipped in place — which SEVERED the channel into
		// extra stubby fragments rather than shortening it. The span check above only
		// noticed when the surviving piece happened to land under 8 tiles, so it
		// failed on roughly one run in twelve and passed on the rest; counting the
		// pieces catches the same break every time.
		expect(pieces.filter((n) => n >= 3)).toHaveLength(2);

		// well-formed: no two objects share a cell, none sit on water, none in camp.
		// Chests are pre-existing camp fixtures the showcase keeps — exclude them.
		const objById = Object.fromEntries(objects.map((o: any) => [o.id, o]));
		const water = new Set(s.terrain.filter((t: any) => t.area === 'meadow').map((t: any) => `${t.x},${t.y}`));
		const seen = new Set<string>();
		for (const p of pls.filter((p: any) => !objById[p.objectId]?.isChest)) {
			const key = `${p.x},${p.y}`;
			expect(seen.has(key), `duplicate cell ${key}`).toBe(false);
			seen.add(key);
			// bridges are the one thing that belongs ON the water — everything else
			// must be on dry land
			if (objById[p.objectId]?.bridge) {
				expect(water.has(key), `bridge off the water ${key}`).toBe(true);
				continue;
			}
			expect(water.has(key), `object on water ${key}`).toBe(false);
			const inCamp = p.x >= 19 && p.x <= 24 && p.y >= 3 && p.y <= 6;
			expect(inCamp, `object in camp ${key}`).toBe(false);
			if (objById[p.objectId]?.plantable) {
				expect(p.plantedAt, `plant ${p.objectId} should read mature`).toBeLessThan(Date.now() - 86400000);
			}
		}
	});

	it('re-running rebuilds the scene rather than stacking on it — and lays out a different one', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		const layout = async () => {
			const pls = (await w.get('GameState', pid)).placements.filter((p: any) => p.area === 'meadow');
			return pls.map((p: any) => `${p.objectId}@${p.x},${p.y}`).sort();
		};
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow' });
		const first = await layout();
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow' });
		const second = await layout();

		// the old scene was cleared, not built on top of: no cell is used twice
		expect(new Set(second.map((k: string) => k.split('@')[1])).size).toBe(second.length);
		// a fresh arrangement every run, so you can keep pressing until one frames well
		expect(second).not.toEqual(first);
		// ...and it's still a full showcase, not a thinner one
		expect(second.length).toBeGreaterThanOrEqual(20);
	});

	it('rebuilds an exact scene when handed a seed back', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		const layout = async () => {
			const pls = (await w.get('GameState', pid)).placements.filter((p: any) => p.area === 'meadow');
			return pls.map((p: any) => `${p.objectId}@${p.x},${p.y}`).sort();
		};
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow', seed: 'shot-42' });
		const first = await layout();
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'meadow', seed: 'shot-42' });
		expect(await layout()).toEqual(first);
	});

	it('reset-clock returns the game clock to the first morning', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		// jump to night, confirm it took, then reset and confirm it's daytime again
		await w.post('DevTools', { playerId: pid, action: 'set-time', value: 'night' });
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe('night');
		const r = await w.post('DevTools', { playerId: pid, action: 'reset-clock' });
		expect(r.ok).toBe(true);
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe('day');
	});

	it('restart from scratch also resets the clock to the first morning', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		await w.post('DevTools', { playerId: pid, action: 'set-time', value: 'night' });
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe('night');
		await w.post('DevTools', { playerId: pid, action: 'restart-game' });
		expect((await w.get('GameState', pid)).weather.dayPhase).toBe('day');
	});

	it('furnishes the home too — maxed house, one of every piece that fits, clear doorway', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		const r = await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'home' });
		expect(r.ok).toBe(true);

		const d = await w.get('GameData');
		const s = await w.get('GameState', pid);
		const home = s.player.home;
		// maxed on every track, so the biggest floor and the fussiest furniture are legal
		for (const track of ['space', 'comfort', 'decor', 'light']) {
			expect(home[track], track).toBe(d.homeTracks[track].levels.length);
		}

		// one of everything the house can hold is standing
		const pls = s.placements.filter((p: any) => p.area === 'home');
		const objById = Object.fromEntries(objects.map((o: any) => [o.id, o]));
		const fits = objects.filter(
			(o: any) =>
				o.placement !== 'outdoor' &&
				o.placement !== 'none' &&
				!o.isChest &&
				!o.bridge &&
				(o.homeMin || 0) <= home.space,
		);
		const standing = new Set(pls.map((p: any) => p.objectId));
		const absent = fits.filter((o: any) => !standing.has(o.id)).map((o: any) => o.id);
		expect(absent, `missing from the room: ${absent.join(', ')}`).toHaveLength(0);

		// well-formed: inside the floor rect, one piece per tile, nothing outdoor-only,
		// and the doorway plus the ring around it left clear so the exit is walkable
		const inner = d.homeTracks.space.levels[home.space - 1].inner;
		const x0 = Math.floor((30 - inner.w) / 2),
			y0 = Math.floor((20 - inner.h) / 2);
		const x1 = x0 + inner.w - 1,
			y1 = y0 + inner.h - 1;
		const door = { x: Math.round((x0 + x1) / 2), y: y1 };
		const seen = new Set<string>();
		for (const p of pls.filter((p: any) => !objById[p.objectId]?.isChest)) {
			const key = `${p.x},${p.y}`;
			expect(seen.has(key), `two pieces on ${key}`).toBe(false);
			seen.add(key);
			expect(p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1, `${p.objectId} off the floor`).toBe(true);
			expect(objById[p.objectId]?.placement, `${p.objectId} is outdoor-only`).not.toBe('outdoor');
			expect(Math.abs(p.x - door.x) <= 1 && Math.abs(p.y - door.y) <= 1, `${p.objectId} in the doorway`).toBe(false);
		}
	});

	it('dry biomes get no pond (desert cannot flood)', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'bailey_test', passcode: '1234', appearance })).playerId;
		await w.post('DevTools', { playerId: pid, action: 'populate-biome', area: 'desert' });
		// Read the ROWS, not the snapshot: this populates the desert while the
		// player is standing in the meadow, and a snapshot carries the area on
		// screen (plus the home interior). The terrain half of this assertion had
		// already gone quietly vacuous when terrain was scoped the same way — it was
		// filtering another area out of a payload that no longer had it.
		const desertTiles = [...w.db.TerrainTile._rows.values()].filter(
			(t: any) => t.area === 'desert' && t.type === 'water',
		);
		expect(desertTiles).toHaveLength(0);
		const desertPlacements = [...w.db.Placement._rows.values()].filter((p: any) => p.area === 'desert');
		expect(desertPlacements.length).toBeGreaterThanOrEqual(20);
	});
});

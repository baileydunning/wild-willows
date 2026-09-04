import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { freshWorld, appearance, meadowResource, metricsOf, dailyOf, type World } from './harness';

const forestResources = new Set<string>(
	JSON.parse(readFileSync('data/biomes.json', 'utf8')).records.find((b: any) => b.id === 'forest').resources,
);

// Retention systems, driven through the real server bundle:
//  • the daily task board (fresh each player-local morning; the opening is the
//    ten-goal starter chain, ONE link at a time, and the next real milestone
//    stays pinned as task #1)
//  • habitat growth over real wall-clock time (mature plants add health)
//  • the heartbeat welcome-back pass ("while you were away…")
//  • condition-gated rare sightings (weather / season / day-phase)

const H = 3_600_000;
let w: World;
let pid: string;

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;
});

describe('daily task board', () => {
	it('serves the onboarding board: a pinned next-biome goal plus three starter tasks', async () => {
		const s = await w.get('GameState', pid);
		const dt = s.dailyTasks;
		// The pin plus the first three links. The chain is deliberately not a backlog:
		// the other seven arrive as these are claimed (tests/integration/starter-chain).
		expect(dt.tasks).toHaveLength(4);
		// task #1 is the always-pinned next-biome guidance goal: tracked, not claimed, no reward
		expect(dt.tasks[0].id).toBe('next-biome');
		expect(dt.tasks[0].pinned).toBe(true);
		expect(Object.keys(dt.tasks[0].reward || {})).toHaveLength(0);
		// each starter task has a target, starts at zero, and pays a reward
		for (const t of dt.tasks.filter((x: any) => !x.pinned)) {
			expect(t.target).toBeGreaterThan(0);
			expect(t.progress).toBe(0);
			expect(t.claimed).toBe(false);
			expect(Object.keys(t.reward).length).toBeGreaterThan(0);
		}
		// same day + same world -> the identical board
		const s2 = await w.get('GameState', pid);
		expect(s2.dailyTasks.tasks).toEqual(dt.tasks);
	});

	it('starts a fresh save in daytime, not the night that play-time 0 falls in', async () => {
		const s = await w.get('GameState', pid);
		expect(s.weather.dayPhase).toBe('day');
	});

	it('leads with the next-biome pin, then the current starter tasks', async () => {
		const dt = (await w.get('GameState', pid)).dailyTasks;
		expect(dt.tasks.map((t: any) => t.text)).toEqual([
			'Unlock Old Hollow Forest',
			'Gather 10 seeds',
			'Welcome the grasshopper home',
			'Plant 3 seedlings',
		]);
		expect(dt.tasks[0].kind).toBe('unlock');
		expect(dt.tasks[0].pinned).toBe(true);
		// every starter carries a "how do I do this?" hover hint — the opening goal
		// is the first thing a new player reads, so it has to say which key to press
		expect(dt.tasks[1].hint).toContain('basket');
	});

	it('pins the next-biome guidance goal with a live checklist that cannot be claimed', async () => {
		const pin = (await w.get('GameState', pid)).dailyTasks.tasks[0];
		expect(pin.id).toBe('next-biome');
		expect(pin.pinned).toBe(true);
		expect(pin.kind).toBe('unlock');
		// it shows a sub-requirement checklist, not a single claimable counter
		expect(Array.isArray(pin.steps)).toBe(true);
		expect(pin.steps.length).toBeGreaterThan(0);
		expect(Object.keys(pin.reward || {})).toHaveLength(0);
		// a pinned guidance goal tracks progress but is never claimed
		await expect(w.post('ClaimTask', { playerId: pid, taskId: 'next-biome' })).rejects.toThrow();
	});

	it('advances progress from normal play (gathering bumps daily counters)', async () => {
		const res = meadowResource();
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: res });
		const p = await w.db.Player.get(pid);
		expect(dailyOf(p).counts[`res:${res}`]).toBeGreaterThanOrEqual(1);
	});

	it('pays out a finished starter task exactly once and rejects early claims', async () => {
		// start-seeds completes from seeds GATHERED (a lifetime tally), so the basket
		// has to be filled the honest way — handing the player ten seeds no longer
		// finishes it, which is the point: spending them can't undo it either.
		const task = (await w.get('GameState', pid)).dailyTasks.tasks.find((t: any) => t.id === 'start-seeds');
		expect(task.progress).toBe(0);
		// an unfinished task cannot be claimed
		await expect(w.post('ClaimTask', { playerId: pid, taskId: task.id })).rejects.toThrow();
		// finish it (gather enough seeds), then claim
		for (let i = 0; i < task.target; i++) {
			await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: `n${i}`, resourceId: 'seeds' });
		}
		const before = await w.db.Player.get(pid);
		const claim = await w.post('ClaimTask', { playerId: pid, taskId: task.id });
		expect(claim.ok).toBe(true);
		expect(Object.keys(claim.gained).length).toBeGreaterThan(0);
		const sum = (inv: Record<string, number>) => Object.values(inv || {}).reduce((a, b) => a + b, 0);
		const after = await w.db.Player.get(pid);
		expect(sum(after.inventory)).toBeGreaterThan(sum(before.inventory));
		// the response carries the board as it stands AFTER the claim, so the client
		// can paint the next goal without waiting for a follow-up fetch…
		expect(claim.dailyTasks.tasks.some((t: any) => t.id === task.id)).toBe(false);
		expect(claim.dailyTasks.tasks.some((t: any) => t.id === 'start-grasshopper')).toBe(true);
		// …and drops off the board on the next fetch, pulling a new link up behind it
		const next = (await w.get('GameState', pid)).dailyTasks;
		expect(next.tasks.some((t: any) => t.id === task.id)).toBe(false);
		expect(next.tasks.some((t: any) => t.id === 'start-harvest')).toBe(true);
		// double-claim is refused
		await expect(w.post('ClaimTask', { playerId: pid, taskId: task.id })).rejects.toThrow();
	});
});

describe('habitat growth over real time', () => {
	const withTree = async (ageMs: number) => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Grow', passcode: '1234', appearance })).playerId;
		await w.db.Placement.put({
			id: `${pid}:meadow:pl_tree`,
			worldId: pid,
			playerId: pid,
			objectId: 'willow-tree',
			area: 'meadow',
			x: 5,
			y: 5,
			placedAt: Date.now() - ageMs,
		});
		const r = await w.post('RecalcBiome', { playerId: pid, biomeId: 'meadow' });
		return r.biomeState.health as number;
	};

	it('a mature tree contributes bonus restoration points', async () => {
		const young = await withTree(0);
		const grown = await withTree(9 * H); // willow-tree: matureHours 8, matureBonus 2
		expect(grown).toBeGreaterThan(young);
	});

	const withForest = async (ageMs: number) => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Cap', passcode: '1234', appearance })).playerId;
		for (let i = 0; i < 20; i++) {
			await w.db.Placement.put({
				id: `${pid}:meadow:pl_${i}`,
				worldId: pid,
				playerId: pid,
				objectId: 'willow-tree',
				area: 'meadow',
				x: 2 + (i % 26),
				y: 3 + Math.floor(i / 26),
				placedAt: Date.now() - ageMs,
			});
		}
		// Bring the meadow's animals home so its health isn't pinned by the
		// animals-returned cap (60% until 5 are back, etc.). Without this a forest of
		// 20 trees clamps to the cap in both the young and grown cases, hiding the
		// maturity bonus this test is here to measure. With 15+ back the cap lifts to
		// 100, so the (capped) growth points can actually move the health bar.
		const animals: any[] = [];
		for await (const a of w.db.Animal.search()) animals.push(a);
		for (const a of animals.filter((x) => x.biome === 'meadow').slice(0, 15)) {
			await w.db.Discovery.put({
				id: `${pid}:${a.id}`,
				worldId: pid,
				playerId: pid,
				animalId: a.id,
				biomeId: 'meadow',
				comfort: 80,
				timesObserved: 1,
				firstObservedAt: Date.now(),
				whyReturned: 'test',
			});
		}
		const r = await w.post('RecalcBiome', { playerId: pid, biomeId: 'meadow' });
		return r.biomeState.health as number;
	};

	it('growth bonus is capped — time away never does the real restoration work', async () => {
		const young = await withForest(0);
		const grown = await withForest(9 * H); // 20 mature trees, but the bonus caps at 8 points
		expect(grown).toBeGreaterThan(young);
		expect(grown - young).toBeLessThanOrEqual(3);
	});
});

describe('welcome back (heartbeat time-passed pass)', () => {
	it('summarizes growth after a long absence, silent on ordinary beats', async () => {
		const now = Date.now();
		// a willow placed 9h ago crossed its 8h maturity during a 12h absence
		await w.db.Placement.put({
			id: `${pid}:meadow:pl_tree`,
			worldId: pid,
			playerId: pid,
			objectId: 'willow-tree',
			area: 'meadow',
			x: 5,
			y: 5,
			placedAt: now - 9 * H,
		});
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			// The willow went into the store directly, so the marker the heartbeat
			// trusts has to be told about it — this is what PlaceObject and Plant do
			// through withPendingMaturity. It matured an hour ago (placed 9h back, 8h
			// to grow), and a marker in the past is what buys the beat its scan.
			nextMaturityAt: now - H,
			metrics: {
				...metricsOf(p),
				firstSeenAt: now - 20 * H,
				lastSeenAt: now - 12 * H,
				lastHeartbeatAt: now - 12 * H,
				playSeconds: 100,
				sessions: 1,
			},
		});
		const hb = await w.post('Heartbeat', { playerId: pid });
		expect(hb.welcomeBack).toBeTruthy();
		expect(hb.welcomeBack.matured).toBeGreaterThanOrEqual(1);
		expect(hb.welcomeBack.healthGain).toBeGreaterThan(0);
		// the next beat is an ordinary one — no summary
		const hb2 = await w.post('Heartbeat', { playerId: pid });
		expect(hb2.welcomeBack).toBeUndefined();
	});
});

describe('condition-gated rare sightings', () => {
	// The barn owl ships gated to dusk/night. Build a meadow that satisfies every
	// OTHER requirement, then recalc at two points of the (play-time) day: day ->
	// it waits; night -> it returns. dayMs is 720000, so playSeconds 360 ≈ midday
	// (0.5, day phase) and 648 ≈ late night (0.9).
	const owlMeadow = async (playSeconds: number) => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Owl', passcode: '1234', appearance })).playerId;
		const now = Date.now();
		let i = 0;
		const put = (objectId: string) =>
			w.db.Placement.put({
				id: `${pid}:meadow:pl_${i}`,
				worldId: pid,
				playerId: pid,
				objectId,
				area: 'meadow',
				x: 2 + (i % 26),
				y: 3 + Math.floor(i++ / 26),
				placedAt: now - 10 * H,
			});
		for (let k = 0; k < 20; k++) await put('willow-tree'); // health well past 60
		// Exactly what the barn owl asks for now: a dark cavity up off the ground,
		// two stands of native grass to quarter over, and somewhere to hunt from.
		await put('barn-loft-nest-box');
		await put('native-grass-patch');
		await put('native-grass-patch');
		await put('bird-perch');
		// every other meadow animal is already home (balance + the vole prerequisite)
		const animals: any[] = [];
		for await (const a of w.db.Animal.search()) animals.push(a);
		for (const a of animals.filter((x) => x.biome === 'meadow' && x.id !== 'barn-owl')) {
			await w.db.Discovery.put({
				id: `${pid}:${a.id}`,
				worldId: pid,
				playerId: pid,
				animalId: a.id,
				biomeId: 'meadow',
				comfort: 80,
				timesObserved: 0,
				firstObservedAt: now,
				whyReturned: 'test',
			});
		}
		const p = await w.db.Player.get(pid);
		// Drive the clock purely from playSeconds here (new saves start with a
		// day-phase clock offset; zero it so these phase values are exact).
		await w.db.Player.patch(pid, { metrics: { ...metricsOf(p), playSeconds }, clockOffsetMs: 0 });
		const r = await w.post('RecalcBiome', { playerId: pid, biomeId: 'meadow' });
		return (r.newAnimals || []).some((n: any) => n.animalId === 'barn-owl');
	};

	it('waits through the wrong day-phase and returns in the right one', async () => {
		expect(await owlMeadow(360)).toBe(false); // midday — owls are asleep
		expect(await owlMeadow(648)).toBe(true); // night — the owl hunts
	});
});

describe('biome unlock reward', () => {
	it('a freshly unlocked biome drops a claimable welcome bundle of that area’s resources', async () => {
		const w2 = await freshWorld();
		const pid = (await w2.post('CreatePlayer', { name: 'Unlocker', passcode: '1234', appearance })).playerId;
		// Meet the forest's unlock bar on the meadow (60% health, 10 animals back),
		// then craft the kit that opens it — that's what triggers checkUnlocks.
		let meadow: any;
		for await (const b of w2.db.BiomeState.search()) if (b.biomeId === 'meadow') meadow = b;
		await w2.db.BiomeState.patch(meadow.id, { health: 60, returnedCount: 10 });
		const p = await w2.db.Player.get(pid);
		await w2.db.Player.patch(pid, {
			inventory: { ...(p.inventory || {}), fiber: 8, branches: 8, stones: 6, water: 4 },
		});
		expect((await w2.post('CraftItem', { playerId: pid, recipeId: 'forest-restoration-kit' })).ok).toBe(true);

		// Forest is now open, and a pending welcome bundle is recorded.
		const player = await w2.db.Player.get(pid);
		expect(player.unlockedBiomes).toContain('forest');
		expect(player.pendingUnlockRewards).toContain('forest');

		// The board shows it as a claimable (not pinned) task with a reward drawn
		// from the NEW area's resources.
		const dt = (await w2.get('GameState', pid)).dailyTasks;
		const reward = dt.tasks.find((t: any) => t.id === 'unlock-reward:forest');
		expect(reward).toBeTruthy();
		expect(reward.pinned).toBeFalsy();
		expect(reward.progress).toBe(reward.target); // complete → claimable
		expect(Object.keys(reward.reward).length).toBeGreaterThan(0);
		for (const rid of Object.keys(reward.reward)) expect(forestResources.has(rid)).toBe(true);
		// Nothing about the NEXT biome shows until this bundle is claimed.
		expect(dt.tasks.some((t: any) => t.id === 'next-biome')).toBe(false);

		// Claiming grants the shown bundle exactly once, then it clears.
		const claim = await w2.post('ClaimTask', { playerId: pid, taskId: 'unlock-reward:forest' });
		expect(claim.ok).toBe(true);
		expect(claim.gained).toEqual(reward.reward);
		expect((await w2.db.Player.get(pid)).pendingUnlockRewards).not.toContain('forest');
		const dt2 = (await w2.get('GameState', pid)).dailyTasks;
		expect(dt2.tasks.some((t: any) => t.id === 'unlock-reward:forest')).toBe(false);
		// The next-area guidance stays hidden until you've walked through the gate
		// into the new biome — claiming the bundle alone isn't enough.
		expect(dt2.tasks.some((t: any) => t.id === 'next-biome')).toBe(false);
		await w2.db.Player.patch(pid, { visitedBiomes: ['meadow', 'forest'] });
		const dt3 = (await w2.get('GameState', pid)).dailyTasks;
		expect(dt3.tasks.some((t: any) => t.id === 'next-biome')).toBe(true);
		await expect(w2.post('ClaimTask', { playerId: pid, taskId: 'unlock-reward:forest' })).rejects.toThrow();
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';

// Retention systems, driven through the real server bundle:
//  • the daily task board (derived per UTC day, progress from play, claimable rewards)
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
	it('serves three deterministic tasks with rewards in every snapshot', async () => {
		const s = await w.get('GameState', pid);
		const dt = s.dailyTasks;
		expect(dt.tasks).toHaveLength(3);
		for (const t of dt.tasks) {
			expect(t.target).toBeGreaterThan(0);
			expect(t.progress).toBe(0);
			expect(t.claimed).toBe(false);
			expect(Object.keys(t.reward).length).toBeGreaterThan(0);
		}
		expect(dt.endsAt).toBeGreaterThan(Date.now());
		// same day + same world -> the identical board
		const s2 = await w.get('GameState', pid);
		expect(s2.dailyTasks.tasks).toEqual(dt.tasks);
	});

	it('advances progress from normal play (gathering bumps daily counters)', async () => {
		const res = meadowResource();
		await w.post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n0', resourceId: res });
		const p = await w.db.Player.get(pid);
		expect(p.daily.counts[`res:${res}`]).toBeGreaterThanOrEqual(1);
	});

	it('pays out a finished task exactly once and rejects early claims', async () => {
		const dt = (await w.get('GameState', pid)).dailyTasks;
		const task = dt.tasks[0];
		// an unfinished task cannot be claimed
		await expect(w.post('ClaimTask', { playerId: pid, taskId: task.id })).rejects.toThrow();
		// finish it (simulate the day's play), then claim
		await w.db.Player.patch(pid, { daily: { dayKey: dt.dayKey, counts: { [task.counter]: task.target } } });
		const before = await w.db.Player.get(pid);
		const claim = await w.post('ClaimTask', { playerId: pid, taskId: task.id });
		expect(claim.ok).toBe(true);
		expect(Object.keys(claim.gained).length).toBeGreaterThan(0);
		const sum = (inv: Record<string, number>) => Object.values(inv || {}).reduce((a, b) => a + b, 0);
		const after = await w.db.Player.get(pid);
		expect(sum(after.inventory)).toBeGreaterThan(sum(before.inventory));
		expect(claim.dailyTasks.tasks.find((t: any) => t.id === task.id).claimed).toBe(true);
		// double-claim is refused
		await expect(w.post('ClaimTask', { playerId: pid, taskId: task.id })).rejects.toThrow();
	});
});

describe('habitat growth over real time', () => {
	const withTree = async (ageMs: number) => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Grow', passcode: '1234', appearance })).playerId;
		await w.db.Placement.put({
			id: 'pl_tree', worldId: pid, playerId: pid, objectId: 'willow-tree',
			area: 'meadow', x: 5, y: 5, placedAt: Date.now() - ageMs,
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
				id: `pl_${i}`, worldId: pid, playerId: pid, objectId: 'willow-tree',
				area: 'meadow', x: 2 + (i % 26), y: 3 + Math.floor(i / 26), placedAt: Date.now() - ageMs,
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
			id: 'pl_tree', worldId: pid, playerId: pid, objectId: 'willow-tree',
			area: 'meadow', x: 5, y: 5, placedAt: now - 9 * H,
		});
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, {
			metrics: { ...(p.metrics || {}), firstSeenAt: now - 20 * H, lastSeenAt: now - 12 * H, lastHeartbeatAt: now - 12 * H, playSeconds: 100, sessions: 1 },
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
	// OTHER requirement, then recalc at two different points of the (play-time)
	// day: dawn -> it waits; night -> it returns. dayMs is 600000, so
	// playSeconds 60 ≈ dawn (0.1) and 480 ≈ night (0.8).
	const owlMeadow = async (playSeconds: number) => {
		w = await freshWorld();
		pid = (await w.post('CreatePlayer', { name: 'Owl', passcode: '1234', appearance })).playerId;
		const now = Date.now();
		let i = 0;
		const put = (objectId: string) => w.db.Placement.put({
			id: `pl_${i}`, worldId: pid, playerId: pid, objectId,
			area: 'meadow', x: 2 + (i % 26), y: 3 + Math.floor(i++ / 26), placedAt: now - 10 * H,
		});
		for (let k = 0; k < 20; k++) await put('willow-tree'); // health well past 75
		await put('log-shelter'); await put('shrub'); await put('grass-patch'); await put('native-grass-patch');
		// every other meadow animal is already home (balance + the vole prerequisite)
		const animals: any[] = [];
		for await (const a of w.db.Animal.search()) animals.push(a);
		for (const a of animals.filter((x) => x.biome === 'meadow' && x.id !== 'barn-owl')) {
			await w.db.Discovery.put({
				id: `${pid}:${a.id}`, worldId: pid, playerId: pid, animalId: a.id, biomeId: 'meadow',
				comfort: 80, timesObserved: 0, firstObservedAt: now, whyReturned: 'test',
			});
		}
		const p = await w.db.Player.get(pid);
		await w.db.Player.patch(pid, { metrics: { ...(p.metrics || {}), playSeconds } });
		const r = await w.post('RecalcBiome', { playerId: pid, biomeId: 'meadow' });
		return (r.newAnimals || []).some((n: any) => n.animalId === 'barn-owl');
	};

	it('waits through the wrong day-phase and returns in the right one', async () => {
		expect(await owlMeadow(60)).toBe(false); // dawn — owls are asleep
		expect(await owlMeadow(480)).toBe(true); // night — the owl hunts
	});
});

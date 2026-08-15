import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { freshWorld, appearance, type World } from './harness';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;
const ANIMALS: any[] = [...load('data/animals-1.json'), ...load('data/animals-2.json')];

// One field guide per area, written up in two steps, driven through the real
// server bundle:
//
//   1  pocket notes    names, sketches, and a caretaker's hint
//   2  field guide     opens each animal's full page
//   3  expanded guide  spells out exactly what each animal there is waiting for,
//                      in the journal AND on the goals the player sets
//
// It sits on the bench as an ordinary tool, so the ladder itself does the
// ordering — there's no reaching the expanded edition without writing up the
// field guide first. Both rungs are paid for entirely out of the area they
// describe: a guide to a place is made out of that place, and no book about
// where you are standing should send you somewhere else to finish it.

let w: World;
let pid: string;

const MEADOW_GUIDE = { seeds: 4, fiber: 3, wildflowers: 2 };
const MEADOW_EXPANDED = { seeds: 8, fiber: 6, wildflowers: 4, branches: 4 };

const give = async (mats: Record<string, number>) => {
	const p = await w.db.Player.get(pid);
	await w.db.Player.patch(pid, { inventory: { ...(p.inventory || {}), ...mats } });
};
const tools = async () => (await w.db.Player.get(pid)).tools || {};
const board = async () => (await w.get('GameState', pid)).dailyTasks;
const starter = async (id: string) => (await board()).tasks.find((t: any) => t.id === id);

beforeEach(async () => {
	w = await freshWorld();
	pid = (await w.post('CreatePlayer', { name: 'Wren', passcode: '1234', appearance })).playerId;
});

describe('writing up a guide', () => {
	it('starts a caretaker on pocket notes', async () => {
		const t = await tools();
		expect(t['journal-meadow']).toBeUndefined(); // absent reads as level 1
		// …and the pre-split journal is gone from the starting kit entirely.
		expect(t['field-journal']).toBeUndefined();
	});

	it("sells the field guide for this area's own materials", async () => {
		await give(MEADOW_GUIDE);
		const up = await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		expect(up.ok).toBe(true);
		expect(up.upgraded.tier).toBe(2);
		expect((await tools())['journal-meadow']).toBe(2);
		// Paid for out of the basket, not conjured.
		expect((await w.db.Player.get(pid)).inventory.seeds || 0).toBe(0);
	});

	it('offers the expanded edition only after the field guide, one rung at a time', async () => {
		// Carrying the expanded edition's materials from the start must not skip the
		// middle rung: the bench offers ONE upgrade, and the first one it offers is
		// the field guide. The ladder is what enforces the order — there's no way to
		// name the expanded edition and jump to it.
		await give({ ...MEADOW_GUIDE, ...MEADOW_EXPANDED });
		await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		expect((await tools())['journal-meadow']).toBe(2);

		await give(MEADOW_EXPANDED);
		await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		expect((await tools())['journal-meadow']).toBe(3);
	});

	it('stops at the expanded edition — there is no fourth rung', async () => {
		await w.db.Player.patch(pid, { tools: { 'journal-meadow': 3 } });
		await give({ seeds: 99, fiber: 99, wildflowers: 99, branches: 99 });
		await expect(w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' })).rejects.toThrow(/fully upgraded/i);
	});

	it('asks the last rung for a material the field guide never wanted', async () => {
		await give(MEADOW_GUIDE);
		await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		// A basketful of everything the FIELD GUIDE asked for is not enough for the
		// expanded edition — that is what makes it a second undertaking rather than
		// the same purchase twice.
		await give({ seeds: 99, fiber: 99, wildflowers: 99, branches: 0 });
		await expect(w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' })).rejects.toThrow(/branches/i);
	});

	it("keeps each area's guides to itself", async () => {
		await give({ ...MEADOW_GUIDE, moss: 4, mushrooms: 2, pinecones: 2 });
		await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		const t = await tools();
		expect(t['journal-meadow']).toBe(2);
		expect(t['journal-forest']).toBeUndefined();
	});
});

describe('the starter chain', () => {
	it('asks for the meadow field guide — the cheap one, from meadow materials', async () => {
		// The opening chain is a tour of the meadow, so the book it asks for has to
		// be buyable without leaving it. Pointing this goal at the expanded edition
		// would park the whole chain behind a walk to the forest.
		await w.db.Player.patch(pid, {
			goalClaims: {
				'start-seeds': true,
				'start-grasshopper': true,
				'start-plant': true,
				'start-harvest': true,
				'start-bugs': true,
			},
		});
		expect((await starter('start-journal-upgrade')).progress).toBe(0);

		await give(MEADOW_GUIDE);
		await w.post('UpgradeTool', { playerId: pid, toolId: 'journal-meadow' });
		expect((await starter('start-journal-upgrade')).progress).toBe(1);
	});
});

describe('an attract goal', () => {
	const setAttractGoal = async () => {
		await w.db.Player.patch(pid, { goalClaims: Object.fromEntries([]) });
		await w.post('SetGoals', { playerId: pid, goals: [{ kind: 'attract', animalId: 'grasshopper', target: 1 }] });
		const dt = await board();
		return dt.tasks.find((t: any) => t.kind === 'attract');
	};

	it('still tells you something useful without the expanded guide', async () => {
		// The gate must not turn a goal the player set themselves into a locked
		// door. The caretaker's hint — the plain-language line every animal carries
		// — comes through, and then the goal says where the exact list lives.
		const task = await setAttractGoal();
		expect(task).toBeTruthy();
		const texts = task.steps.map((s: any) => s.text);
		expect(texts.length).toBeGreaterThanOrEqual(2);
		expect(texts[texts.length - 1]).toMatch(/Expanded Guide/i);
		// The first line is the animal's own hint, straight from the definitions.
		expect(texts[0]).toBe(ANIMALS.find((a) => a.id === 'grasshopper').requirements.hint);
		// …and it is NOT the exact checklist: no "0/1 <object>" counters yet.
		expect(texts.some((x: string) => /\d+\s*\/\s*\d+/.test(x))).toBe(false);
	});

	it('spells out the exact checklist once the expanded guide is written up', async () => {
		await w.db.Player.patch(pid, { tools: { 'journal-meadow': 3 } });
		const task = await setAttractGoal();
		const texts = task.steps.map((s: any) => s.text);
		expect(texts.some((x: string) => /Expanded Guide/i.test(x))).toBe(false);
		// A real habitat checklist: at least one "have/need" line for an object.
		expect(texts.some((x: string) => /\d+\s*\/\s*\d+/.test(x))).toBe(true);
	});

	it("reads the guide for the ANIMAL's area, not the one you are standing in", async () => {
		// Owning every meadow book must not unlock the forest's secrets. The gate
		// follows the animal home.
		await w.db.Player.patch(pid, {
			tools: { 'journal-meadow': 3 },
			unlockedBiomes: ['meadow', 'forest'],
		});
		const forestAnimal = ANIMALS.find((a) => a.biome === 'forest' && a.requirements?.objects);
		await w.post('SetGoals', {
			playerId: pid,
			goals: [{ kind: 'attract', animalId: forestAnimal.id, target: 1 }],
		});
		const task = (await board()).tasks.find((t: any) => t.kind === 'attract');
		expect(task.steps.some((s: any) => /Expanded Guide/i.test(s.text))).toBe(true);
	});
});

describe('a save from before the split', () => {
	/** Run the repair pass the way a returning player does — by logging in. */
	const reenter = async () => {
		await w.post('LoginPlayer', { name: 'Wren', passcode: '1234' });
		return (await w.db.Player.get(pid)).tools || {};
	};

	it('is handed every book its old journal tier had already paid for', async () => {
		// The pre-split journal was ONE ladder for the whole preserve: tier N meant
		// "I own the guide to every area of order below N", and owning it gave the
		// full page AND the exact requirements. Tier 4 is therefore three areas,
		// each written all the way up — taking any of that back would be charging
		// twice for work already done.
		await w.db.Player.patch(pid, { tools: { basket: 1, 'field-journal': 4 }, repairRev: 0 });
		const t = await reenter();
		for (const b of ['meadow', 'forest', 'wetland']) expect([b, t[`journal-${b}`]]).toEqual([b, 3]);
		// …and not one area further than it had reached.
		expect(t['journal-desert']).toBeUndefined();
	});

	it('leaves a save that never upgraded its journal alone', async () => {
		await w.db.Player.patch(pid, { tools: { basket: 1, 'field-journal': 1 }, repairRev: 0 });
		const t = await reenter();
		expect(t['journal-meadow']).toBeUndefined();
	});

	it('never winds a guide back that is already further along', async () => {
		await w.db.Player.patch(pid, { tools: { 'field-journal': 2, 'journal-coastal': 3 }, repairRev: 0 });
		const t = await reenter();
		expect(t['journal-coastal']).toBe(3);
		expect(t['journal-meadow']).toBe(3); // and the legacy tier still pays out
	});

	it('is idempotent — a second entry changes nothing', async () => {
		await w.db.Player.patch(pid, { tools: { 'field-journal': 3 }, repairRev: 0 });
		const first = await reenter();
		await w.db.Player.patch(pid, { repairRev: 0 });
		expect(await reenter()).toEqual(first);
	});
});

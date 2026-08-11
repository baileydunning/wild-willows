import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { freshWorld, appearance, type World } from './harness';

// What happens to a save made before the 0.3 ecology pass renamed half the roster?
//
// data/animal-aliases.json records old id -> new id. reconcileDefinitions() uses
// the definition JSON to prune the retired rows from the Animal table, and that
// part was never in doubt. The question here is the SAVE: a Discovery row still
// filed under `coyote-meadow` is invisible to everything that resolves it through
// the definitions (returnedHere, computeBalance, returnedKinds) but still visible
// to everything that just counts rows (totalAnimals) — and the replacement
// `coyote` can later return and claim the same ecological slot a second time.
// Custom welcome/attract goals hold the same dead ids and can never complete.
//
// So the invariant these tests pin is: after a save has been entered once, no
// stored animal id anywhere in it is one the definitions no longer know about,
// and nothing was double-counted or silently lost on the way there.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

const ALIASES: { from: string; to: string }[] = load('data/animal-aliases.json');
const ANIMALS = new Map<string, any>(
	[...load('data/animals-1.json'), ...load('data/animals-2.json')].map((a) => [a.id, a]),
);

let w: World;

/** File a Discovery row the way a pre-0.3 save would have: legacy `${playerId}:` key. */
function seedDiscovery(pid: string, animalId: string, biomeId: string, over: Record<string, any> = {}) {
	const id = `${pid}:${animalId}`;
	w.db.Discovery._rows.set(id, {
		id,
		worldId: pid,
		playerId: pid,
		animalId,
		biomeId,
		comfort: 62,
		timesObserved: 0,
		firstObservedAt: 1_000,
		whyReturned: 'because the old text said so',
		...over,
	});
}

const discoveries = () => [...w.db.Discovery._rows.values()];
const login = () => w.post('LoginPlayer', { name: 'Sam', passcode: '1234' });
const newSave = async () => (await w.post('CreatePlayer', { name: 'Sam', passcode: '1234', appearance })).playerId;

beforeEach(async () => {
	w = await freshWorld();
});

describe('the alias table itself', () => {
	it('renames away from ids the definitions dropped, and onto ids they kept', () => {
		expect(ALIASES.length).toBeGreaterThan(0);
		for (const { from, to } of ALIASES) {
			expect(ANIMALS.has(from), `${from} is still a live animal — it needs no alias`).toBe(false);
			expect(ANIMALS.has(to), `${from} -> ${to}, but ${to} is not an animal`).toBe(true);
		}
		// A chain (a -> b, b -> c) would need repeated passes to settle; a many-to-one
		// would silently merge two slots into one. Neither is handled, so neither may exist.
		const froms = new Set(ALIASES.map((a) => a.from));
		expect(ALIASES.filter((a) => froms.has(a.to))).toEqual([]);
		expect(new Set(ALIASES.map((a) => a.to)).size).toBe(ALIASES.length);
	});
});

describe('a save carrying retired animal ids', () => {
	it('moves the discovery onto the new id, keeping the count and the history', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'coyote-meadow', 'meadow', { timesObserved: 4, firstObservedAt: 500 });
		const before = discoveries().length;

		await login();

		const rows = discoveries();
		expect(rows).toHaveLength(before); // renamed, not duplicated and not dropped
		expect(rows.some((r: any) => r.animalId === 'coyote-meadow')).toBe(false);
		const moved = rows.find((r: any) => r.animalId === 'coyote');
		expect(moved).toBeTruthy();
		expect(moved.timesObserved).toBe(4); // the player's observations survive
		expect(moved.firstObservedAt).toBe(500);
		expect(moved.whyReturned).not.toBe('because the old text said so'); // re-read from the new animal
	});

	it('files the moved row under the biome the DEFINITIONS give the new animal', async () => {
		const pid = await newSave();
		// Several aliases re-cast the animal entirely, so the biome on the old row is
		// not necessarily where the replacement lives.
		seedDiscovery(pid, 'mule-deer-alpine', 'meadow');

		await login();

		const moved = discoveries().find((r: any) => r.animalId === 'grizzly-bear');
		expect(moved.biomeId).toBe(ANIMALS.get('grizzly-bear').biome);
		expect(moved.biomeId).not.toBe('meadow');
	});

	it('merges rather than double-counting when both the old and new animal are home', async () => {
		const pid = await newSave();
		// The pathology: the old row was never cleaned up, and the replacement came
		// back on its own, so one ecological slot occupies two rows.
		seedDiscovery(pid, 'coyote-meadow', 'meadow', { timesObserved: 3, firstObservedAt: 100 });
		seedDiscovery(pid, 'coyote', 'meadow', { timesObserved: 5, firstObservedAt: 900 });
		const before = discoveries().length;

		await login();

		const coyotes = discoveries().filter((r: any) => r.animalId === 'coyote');
		expect(coyotes).toHaveLength(1);
		expect(discoveries()).toHaveLength(before - 1); // the preserve-wide total comes back down
		expect(coyotes[0].timesObserved).toBe(8); // both halves of the history kept
		expect(coyotes[0].firstObservedAt).toBe(100); // dated from the first time it was seen
	});

	it('leaves no unresolvable animal id anywhere in the save', async () => {
		const pid = await newSave();
		for (const { from } of ALIASES.slice(0, 12)) seedDiscovery(pid, from, 'meadow');

		await login();

		// This is the invariant the whole bug reduces to: `totalAnimals` counts rows
		// and `returnedHere` resolves them through the definitions, so the two agree
		// only while every stored id is one the definitions still know.
		for (const row of discoveries()) {
			expect(ANIMALS.has(row.animalId), `${row.animalId} is not a live animal`).toBe(true);
		}
	});

	it('is idempotent — entering the world again changes nothing', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'coyote-meadow', 'meadow', { timesObserved: 2 });

		await login();
		const after = JSON.stringify(discoveries().sort((a: any, b: any) => a.id.localeCompare(b.id)));
		await login();
		expect(JSON.stringify(discoveries().sort((a: any, b: any) => a.id.localeCompare(b.id)))).toBe(after);
	});
});

describe('custom goals naming a retired animal', () => {
	/** Attach goals straight to the stored row, the way an older build left them. */
	function seedGoals(pid: string, goals: any[]) {
		const p = w.db.Player._rows.get(pid);
		w.db.Player._rows.set(pid, { ...p, customGoals: goals });
	}

	it('translates the animal id so the goal can complete again', async () => {
		const pid = await newSave();
		seedGoals(pid, [
			{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote-meadow' },
			{ id: 'g2', kind: 'attract', target: 1, animalId: 'red-fox-meadow' },
			{ id: 'g3', kind: 'collect', target: 5, resourceId: 'seeds', base: 0 },
		]);

		await login();

		const goals = w.db.Player._rows.get(pid).customGoals;
		expect(goals.map((g: any) => g.animalId)).toEqual(['coyote', 'red-fox', undefined]);
		expect(goals.map((g: any) => g.id)).toEqual(['g1', 'g2', 'g3']); // order and non-animal goals untouched
	});

	it('shows the animal by name on the task board instead of a dead slug', async () => {
		const pid = await newSave();
		seedGoals(pid, [{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote-meadow' }]);

		await login();

		const task = (await w.get('GameState', pid)).dailyTasks.tasks.find((t: any) => t.id === 'g1');
		expect(task.text).toContain(ANIMALS.get('coyote').name);
		expect(task.text).not.toContain('coyote-meadow');
	});

	it('drops a goal naming an animal that no longer exists at all', async () => {
		const pid = await newSave();
		seedGoals(pid, [
			{ id: 'ghost', kind: 'welcome', target: 1, animalId: 'never-existed' },
			{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote-meadow' },
		]);

		await login();

		// sanitizeGoals() would refuse this id on the way in, but it only runs on
		// SetGoals — a goal nobody edits again is never looked at. Parked, it renders
		// as a raw slug, reports 0% forever, and holds one of only three slots. 35 of
		// the animals 0.3 retired have no successor, so this is reachable from real
		// 0.2 saves and not just from a synthetic id.
		const goals = w.db.Player._rows.get(pid).customGoals;
		expect(goals.map((g: any) => g.animalId)).toEqual(['coyote']);
	});

	it('leaves goals that name no animal at all untouched', async () => {
		const pid = await newSave();
		seedGoals(pid, [
			{ id: 'r1', kind: 'gather', target: 5, resourceId: 'wood' },
			{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote-meadow' },
		]);

		await login();

		const goals = w.db.Player._rows.get(pid).customGoals;
		expect(goals.map((g: any) => g.id)).toEqual(['r1', 'g1']);
	});

	it('does not leave two goals pointing at the same animal', async () => {
		const pid = await newSave();
		seedGoals(pid, [
			{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote' },
			{ id: 'g2', kind: 'welcome', target: 1, animalId: 'coyote-meadow' },
		]);

		await login();

		// Both slots described the same animal; the aliased one folds into the live one.
		expect(w.db.Player._rows.get(pid).customGoals.map((g: any) => g.id)).toEqual(['g1']);
	});
});

describe('a species that was retired with nothing to take its place', () => {
	// 0.3 renamed 37 animals and simply removed the rest. The alias table only
	// answers for the renames, so the removals used to sit in a save forever:
	// invisible to returnedHere / computeBalance / returnedKinds, which all resolve
	// through the definitions, but perfectly visible to `totalAnimals`, which is a
	// row count. The preserve total read one high per retired species and "150 of
	// 150" could never be reached again.
	const RETIRED_NO_ALIAS = 'american-bittern';

	it('is a real case and not a straw man', () => {
		expect(ANIMALS.has(RETIRED_NO_ALIAS)).toBe(false);
		expect(ALIASES.some((a) => a.from === RETIRED_NO_ALIAS)).toBe(false);
	});

	it('drops the row rather than leaving it to be counted', async () => {
		const pid = await newSave();
		seedDiscovery(pid, RETIRED_NO_ALIAS, 'wetland');
		seedDiscovery(pid, 'grasshopper', 'meadow');

		await login();

		const ids = discoveries().map((r: any) => r.animalId);
		expect(ids).not.toContain(RETIRED_NO_ALIAS);
		// and nothing the definitions still know about was taken with it
		expect(ids).toContain('grasshopper');
		for (const id of ids) expect(ANIMALS.has(id), `${id} is not an animal any more`).toBe(true);
	});

	it('keeps the history when there IS a replacement, instead of dropping it', async () => {
		// The prune runs after the aliases, so an alias always wins over a delete.
		const pid = await newSave();
		seedDiscovery(pid, 'barred-owl', 'forest', { timesObserved: 3 });

		await login();

		const owl = discoveries().find((r: any) => r.animalId === 'goshawk');
		expect(owl, 'barred-owl should have become the goshawk, not vanished').toBeTruthy();
		expect(owl.timesObserved).toBe(3);
	});
});

describe('a save that never uses the login screen again', () => {
	// "Continue" resumes through GameState, which is a GET and must not write, so
	// the repair pass cannot run there. If login were its only trigger, a player
	// who always hits Continue would keep an inflated animal total and a gate
	// walled off by their own water for as long as they kept playing. The
	// heartbeat is the write path every session has, so it carries the backstop.
	it('is repaired on its next heartbeat', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'coyote-meadow', 'meadow', { timesObserved: 2 });

		await w.post('Heartbeat', { playerId: pid });

		const ids = discoveries().map((r: any) => r.animalId);
		expect(ids).toContain('coyote');
		expect(ids).not.toContain('coyote-meadow');
	});

	it('does not re-run the pass on every later beat', async () => {
		const pid = await newSave();
		await w.post('Heartbeat', { playerId: pid });
		expect(w.db.Player._rows.get(pid).repairRev).toBeGreaterThan(0);

		// A row seeded AFTER the save was marked is deliberately left alone: the
		// marker is what keeps a Discovery scan off the 30-second beat. Only a
		// REPAIR_REV bump (or the next login) looks again.
		seedDiscovery(pid, 'coyote-meadow', 'meadow');
		await w.post('Heartbeat', { playerId: pid });
		expect(discoveries().map((r: any) => r.animalId)).toContain('coyote-meadow');

		// ...and login, which always runs the pass, still cleans it up.
		await login();
		expect(discoveries().map((r: any) => r.animalId)).not.toContain('coyote-meadow');
	});
});

describe('a species that moved biome without being renamed', () => {
	// Discovery.biomeId is a stored copy of where the animal was when it came
	// back. An alias re-files it (migrateAnimalAliases reads the biome off the
	// definitions), but a KEPT id gets no alias — and 0.3 moves `coyote` from
	// Sunstone Flats to Willow Meadow, handing the desert a mountain lion instead.
	it('is a real case and not a straw man', () => {
		expect(ANIMALS.has('coyote')).toBe(true);
		expect(ANIMALS.get('coyote').biome).toBe('meadow');
		expect(ALIASES.some((a) => a.to === 'coyote' && a.from === 'coyote')).toBe(false);
	});

	it('re-files the row onto the biome the definitions now give it', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'coyote', 'desert', { timesObserved: 2 });

		await login();

		const row = discoveries().find((r: any) => r.animalId === 'coyote');
		// Left stale, returnedHere() counts it in the meadow while the comfort pass
		// and the client's animal spawn both read this field and put it in the
		// desert — where it is scored against meadow requirements and pinned at the
		// comfort floor for good.
		expect(row.biomeId).toBe('meadow');
		expect(row.timesObserved).toBe(2);
	});

	it('leaves a row alone when the stored biome already agrees', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'grasshopper', ANIMALS.get('grasshopper').biome);
		const before = discoveries().find((r: any) => r.animalId === 'grasshopper');

		await login();

		expect(discoveries().find((r: any) => r.animalId === 'grasshopper').biomeId).toBe(before.biomeId);
	});
});

describe('the counts the repair pass leaves behind', () => {
	// BiomeState.returnedCount is a stored number that only recalcBiome writes.
	// The prune deletes Discovery rows straight out from under it, so without a
	// recalc the HUD keeps reading the pre-repair total — and that same number
	// feeds the biome unlock gates and the `*-reborn` achievement triggers.
	it('recomputes returnedCount after rows are dropped', async () => {
		const pid = await newSave();
		seedDiscovery(pid, 'american-bittern', 'wetland'); // retired, no successor
		const meadow = `${pid}:meadow`;
		w.db.BiomeState._rows.set(meadow, {
			...w.db.BiomeState._rows.get(meadow),
			unlocked: true,
			returnedCount: 99,
		});

		await login();

		const live = discoveries().filter((r: any) => ANIMALS.get(r.animalId)?.biome === 'meadow').length;
		expect(w.db.BiomeState._rows.get(meadow).returnedCount).toBe(live);
	});

	it('does not pay for a recalc when the save was already clean', async () => {
		const pid = await newSave();
		const meadow = `${pid}:meadow`;
		// A deliberately wrong count on a save with nothing to repair: the pass has
		// no reason to look, so it stays wrong until the next real recalc. This is
		// the cheap path every save takes from the second login on.
		w.db.BiomeState._rows.set(meadow, { ...w.db.BiomeState._rows.get(meadow), returnedCount: 42 });

		await login();

		expect(w.db.BiomeState._rows.get(meadow).returnedCount).toBe(42);
	});
});

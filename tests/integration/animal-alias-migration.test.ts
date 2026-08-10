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

	it('leaves an id the alias table says nothing about alone', async () => {
		const pid = await newSave();
		seedGoals(pid, [
			{ id: 'ghost', kind: 'welcome', target: 1, animalId: 'never-existed' },
			{ id: 'g1', kind: 'welcome', target: 1, animalId: 'coyote-meadow' },
		]);

		await login();

		// No alias claims 'never-existed', so it is sanitizeGoals()' business (it
		// refuses one on the way in, and the next goal edit clears it) — the migration
		// must not quietly delete goals it was not asked about.
		const goals = w.db.Player._rows.get(pid).customGoals;
		expect(goals.map((g: any) => g.animalId)).toEqual(['never-existed', 'coyote']);
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

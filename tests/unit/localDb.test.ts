import { describe, it, expect } from 'vitest';
import { makeLocalDatabase, serializeSave, hydrateSave, DYNAMIC_TABLES } from '../../src/solo/localDb';

describe('makeLocalDatabase', () => {
	it('seeds the static definition tables from data/*.json', () => {
		const db = makeLocalDatabase();
		// Definition tables come pre-populated (what Harper's data loader does).
		expect(db.Biome.size).toBeGreaterThan(0);
		expect(db.Recipe.size).toBeGreaterThan(0);
		expect(db.HabitatObject.size).toBeGreaterThan(0);
		// Animal is merged from animals-1.json + animals-2.json.
		expect(db.Animal.size).toBeGreaterThan(0);
	});

	it('starts every dynamic (per-save) table empty', () => {
		const db = makeLocalDatabase();
		for (const name of DYNAMIC_TABLES) {
			expect(db[name].size).toBe(0);
		}
	});
});

describe('LocalTable CRUD (mirrors the slice of Harper the server uses)', () => {
	it('put / get round-trips by id, get of a missing row is null', async () => {
		const db = makeLocalDatabase();
		await db.Player.put({ id: 'p1', name: 'Sam', inventory: { seeds: 2 } });
		expect(await db.Player.get('p1')).toMatchObject({ id: 'p1', name: 'Sam' });
		expect(await db.Player.get('nope')).toBeNull();
	});

	it('patch shallow-merges and preserves the id', async () => {
		const db = makeLocalDatabase();
		await db.Player.put({ id: 'p1', name: 'Sam', x: 1 });
		await db.Player.patch('p1', { x: 9, area: 'meadow' });
		expect(await db.Player.get('p1')).toMatchObject({ id: 'p1', name: 'Sam', x: 9, area: 'meadow' });
	});

	it('patch on a missing id creates the row with that id', async () => {
		const db = makeLocalDatabase();
		await db.Chest.patch('c1', { capacity: 120 });
		expect(await db.Chest.get('c1')).toMatchObject({ id: 'c1', capacity: 120 });
	});

	it('delete removes the row', async () => {
		const db = makeLocalDatabase();
		await db.Placement.put({ id: 'x', objectId: 'grass-patch' });
		await db.Placement.delete('x');
		expect(await db.Placement.get('x')).toBeNull();
	});

	it('search returns a snapshot array of all rows', async () => {
		const db = makeLocalDatabase();
		await db.Placement.put({ id: 'a', objectId: 'o1' });
		await db.Placement.put({ id: 'b', objectId: 'o2' });
		const rows = db.Placement.search();
		expect(rows.map((r: any) => String(r.id)).sort((a: string, b: string) => a.localeCompare(b))).toEqual(['a', 'b']);
	});

	it('reads are copies — mutating a returned row does not corrupt the store', async () => {
		const db = makeLocalDatabase();
		await db.Player.put({ id: 'p1', name: 'Sam' });
		const read = await db.Player.get('p1');
		read.name = 'TAMPERED';
		expect((await db.Player.get('p1')).name).toBe('Sam');
	});

	it('put rejects records without an id', async () => {
		const db = makeLocalDatabase();
		await expect(db.Player.put({ name: 'no id' } as any)).rejects.toThrow();
	});
});

describe('serializeSave / hydrateSave', () => {
	it('serializes only the dynamic tables', async () => {
		const db = makeLocalDatabase();
		await db.Player.put({ id: 'p1', name: 'Sam' });
		const dump = serializeSave(db);
		expect(Object.keys(dump).sort()).toEqual([...DYNAMIC_TABLES].sort());
		expect(dump).not.toHaveProperty('Biome'); // static defs are never saved
		expect(dump.Player).toHaveLength(1);
	});

	it('round-trips a save into a fresh database', async () => {
		const a = makeLocalDatabase();
		await a.Player.put({ id: 'p1', name: 'Sam', inventory: { seeds: 5 } });
		await a.Placement.put({ id: 'pl1', objectId: 'grass-patch', area: 'meadow', x: 1, y: 2 });
		const saved = serializeSave(a);

		const b = makeLocalDatabase();
		hydrateSave(b, saved);
		expect(await b.Player.get('p1')).toMatchObject({ name: 'Sam', inventory: { seeds: 5 } });
		expect(b.Placement.size).toBe(1);
		// Static defs in the fresh db are intact (hydrate only touches dynamic tables).
		expect(b.Biome.size).toBe(a.Biome.size);
	});

	it('hydrate clears any previous dynamic rows and tolerates missing keys', async () => {
		const db = makeLocalDatabase();
		await db.Player.put({ id: 'stale', name: 'Old' });
		hydrateSave(db, {}); // empty save
		expect(db.Player.size).toBe(0);
	});
});

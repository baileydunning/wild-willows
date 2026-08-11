// Where the definitions the client sees actually come from.
//
// 0.3 retired 73 animal ids. Harper's data loader only upserts, so the hosted
// Animal table ended up holding the union of the old and new rosters — 223 rows
// — and defs() read the roster back out of that table. reconcileDefinitions()
// was supposed to prune the orphans first, but it flipped a synchronous "already
// running" flag before its first await, so the requests that arrive alongside a
// rolling restart skipped straight past it and cached the un-pruned read. That
// cache is per-worker and never invalidated, so the browser demo served 223
// animals — "0/37 animals returned" in a 25-animal meadow, retired species and
// their sprites walking around — until the process was restarted.
//
// The fix is that defs() no longer asks the database what the game contains. The
// records are compiled into the bundle; that is the source of truth, and a stale
// row in a table is now cosmetic. These tests hold that property, because it is
// invisible in every other test — the harness seeds the tables from the same
// JSON, so the two sources agree unless something deliberately breaks them apart.

import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';
import animals1 from '../../data/animals-1.json';
import animals2 from '../../data/animals-2.json';

const ROSTER = [...animals1.records, ...animals2.records];
const TOTAL = ROSTER.length;
const PER_BIOME = (biome: string) => ROSTER.filter((a: any) => a.biome === biome).length;

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

/** A row for an animal that no longer exists, exactly as the loader left one. */
const RETIRED = {
	id: 'lady-beetle',
	name: 'Lady Beetle',
	biome: 'meadow',
	kind: 'insect',
	trophic: 'insectivore',
	rarity: 'common',
	requirements: { minHealth: 20, objects: { 'wildflower-patch': 1 }, hint: 'stale' },
	eats: [],
	eatenBy: [],
};

describe('definitions come from the bundle, not the table', () => {
	it('serves the JSON roster even when the Animal table holds retired rows', async () => {
		w.db.Animal._rows.set(RETIRED.id, structuredClone(RETIRED));
		// A whole retired biome's worth, so a miss can't look like an off-by-one.
		for (let i = 0; i < 11; i++) {
			w.db.Animal._rows.set(`retired-${i}`, { ...structuredClone(RETIRED), id: `retired-${i}` });
		}
		expect(w.db.Animal._rows.size).toBe(TOTAL + 12);

		const d = await w.get<any>('GameData');
		expect(d.animals).toHaveLength(TOTAL);
		expect(d.animals.filter((a: any) => a.biome === 'meadow')).toHaveLength(PER_BIOME('meadow'));
		expect(d.animals.map((a: any) => a.id)).not.toContain('lady-beetle');
	});

	it('every biome gets its own roster count, not the union', async () => {
		for (const b of ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal']) {
			w.db.Animal._rows.set(`retired-${b}`, { ...structuredClone(RETIRED), id: `retired-${b}`, biome: b });
		}
		const d = await w.get<any>('GameData');
		for (const b of ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal']) {
			expect(d.animals.filter((a: any) => a.biome === b)).toHaveLength(PER_BIOME(b));
		}
	});

	it('an emptied Animal table does not empty the game', async () => {
		// The other direction of the same independence: a table that lost its rows
		// (a loader that didn't run, a dropped database) must not be able to tell
		// clients the preserve has no animals in it.
		w.db.Animal._rows.clear();
		const d = await w.get<any>('GameData');
		expect(d.animals).toHaveLength(TOTAL);
	});

	it('concurrent cold reads all see the same complete roster', async () => {
		// The original failure needed two requests in flight at once, which is the
		// normal shape of a rolling restart: every open client refetches at the same
		// moment. None of them may see a partial view.
		w.db.Animal._rows.set(RETIRED.id, structuredClone(RETIRED));
		const all = await Promise.all(Array.from({ length: 12 }, () => w.get<any>('GameData')));
		for (const d of all) {
			expect(d.animals).toHaveLength(TOTAL);
			expect(d.animals.map((a: any) => a.id)).not.toContain('lady-beetle');
		}
	});

	it('a table write that fails does not take the definitions down with it', async () => {
		// reconcileDefinitions is fire-and-forget now. If Harper refuses a delete,
		// the pass logs and gives up — and the game carries on regardless, because
		// nothing it serves depends on that pass having succeeded.
		const table = w.db.Animal as any;
		const realDelete = table.delete.bind(table);
		table.delete = async () => {
			throw new Error('refused');
		};
		w.db.Animal._rows.set(RETIRED.id, structuredClone(RETIRED));
		const d = await w.get<any>('GameData');
		expect(d.animals).toHaveLength(TOTAL);
		table.delete = realDelete;
	});
});

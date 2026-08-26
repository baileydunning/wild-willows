// Wild Willows — server: keys
//
// The key contract. Records are keyed by world (and sometimes area) so a scan can
// be a prefix read instead of a whole-table walk; this module owns the current
// key revision, the memo of which worlds have been migrated, and the migration
// itself.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { db, feedRowId, writeFeed } from './core';
import { safeGet, tableName, toArray } from './store';
import { getPlayer, patchPlayer } from './player';

// --------------------------------------------------------------- key contract
//
// Every mutable row is keyed so that the rows of ONE world (or one player) form
// a CONTIGUOUS RUN in the primary key index. That is what turns a per-world read
// into a bounded range scan instead of a scan of every save in the database.
//
// Why the primary key and not a secondary index. Two independent reasons:
//
//  1. The mutable tables declare only `id` (see schema.graphql — everything else
//     is dynamic on purpose, because declared columns use the positional
//     structon encoding and adding one leaves existing rows undecodable). Harper
//     REJECTS a condition on an undeclared attribute, so `worldId` is not
//     something we can filter on server-side even if we wanted to.
//  2. A primary-key `starts_with` is not an index lookup at all. Harper compiles
//     it to `primaryStore.getRange({ start, end })` — the same call, on the same
//     store, that a bare `search({})` already makes with no bounds
//     (harper/resources/search.ts: `starts_with` sets `start`, then
//     `index.getRange(rangeOptions)` where `index === table.primaryStore`).
//     Narrowing the bounds cannot be less reliable than not narrowing them, so
//     this preserves the exact property the full scans were there to protect:
//     it never depends on a secondary index being warm.
//
// The key shapes (KEY_REV 4):
//
//   BiomeState        `${wid}:${biomeId}`
//   NodeState         `${wid}:${biomeId}:${nodeId}`
//   TerrainTile       `${wid}:${area}:${x}:${y}`
//   Discovery         `${wid}:${animalId}`
//   Placement         `${wid}:${area}:pl_${ts}_${rand}`  (KEY_REV 3: `${wid}:pl_…`)
//   Chest             the same id as its Placement — an invariant, not a coincidence
//   FeedEntry         `${wid}:feed`               one row holding the whole feed
//                                                 (was one row per line, `f_${wid}_${at}_${rand}`)
//   PlayerAchievement `${playerId}:${achievementId}`
//
// `:` is a safe delimiter: a player id is `slugId(name)` (lowercase a-z0-9 and
// `-`) optionally plus `-${rand}`, and a world id is `w_${ts36}_${rand}`.
// Neither can contain a colon, so no world's key prefix can be a prefix of
// another world's key. (This is why the prefix is `${wid}:` and never `${wid}`.)
//
// KEY_REV 4 — WHY PLACEMENTS GREW AN AREA SEGMENT.
//
// Every per-biome reader of Placement was reading all six areas and throwing
// five sixths away in JS: recalcBiome (on every place, plant, terraform and
// remove), recipeUnlockContext (on every craft), the collision checks in
// PlaceObject and Terraform. TerrainTile solved this a revision ago by putting
// the area in the key, which is what lets `byArea` bound the scan to one area's
// run; placements had the identical access pattern and none of the key shape.
//
// The segment is safe to bake into the id because a placement's area is FIXED
// for its lifetime — MoveObject changes x/y within an area and never the area
// itself, and nothing else rewrites it. If that ever stops being true, moving a
// placement across areas becomes a delete-and-recreate (its Chest with it), not
// a patch.
export const KEY_REV = 4;

/**
 * The id of a placement (and, by the invariant above, of its chest).
 *
 * One function rather than a template repeated at six call sites, because the
 * shape is now load-bearing in two directions at once: `byArea` reads the
 * segment back out as a scan bound, and a Chest that disagreed with its
 * Placement by one character would be a chest the game can no longer open.
 */
export function placementKey(worldId: string, area: string, tail: string): string {
	return `${worldId}:${area}:${tail}`;
}

/** Tables whose ids carry a `${worldId}:` prefix. */
export const WORLD_KEYED = new Set([
	'BiomeState',
	'NodeState',
	'TerrainTile',
	'Discovery',
	'Placement',
	'Chest',
	'FeedEntry',
]);

/** Tables re-keyed by the migration (see migrateWorldKeys). Placement leads so
 *  the area map it builds is ready for Chest, which follows it. */
const REKEYED_TABLES = ['Placement', 'Chest', 'FeedEntry', 'BiomeState', 'NodeState', 'TerrainTile', 'Discovery'];

/** Tables whose current key carries an area segment after the world id. */
const AREA_SEGMENTED = new Set(['Placement', 'Chest']);

/**
 * The id `row` should have under the CURRENT key contract.
 *
 * Idempotent by construction: it strips the world prefix and the area segment if
 * they are already there before putting them back, so a row that is already
 * correct maps to itself and the migration skips it. That property is what lets
 * this run on every world at every revision without a per-revision branch —
 * `migrateWorldKeys` simply moves every row that is not already at its target.
 */
function targetId(name: string, worldId: string, row: any, area?: string): string {
	const seg = AREA_SEGMENTED.has(name) ? area || row?.area || '' : '';
	const tail = idTail(worldId, String(row?.id ?? ''), seg);
	return seg ? `${worldId}:${seg}:${tail}` : `${worldId}:${tail}`;
}

/** A row id with the world prefix, and any area segment already on it, removed. */
function idTail(worldId: string, id: string, area: string): string {
	let tail = id;
	if (tail.startsWith(`${worldId}:`)) tail = tail.slice(worldId.length + 1);
	if (area && tail.startsWith(`${area}:`)) tail = tail.slice(area.length + 1);
	return tail;
}

/**
 * Bounded scan of one contiguous primary-key run.
 *
 * Same decode tolerance as a full scan (toArray) — an undecodable row inside the
 * range is counted and skipped, never allowed to abort the read.
 */
export async function scanPrefix(table: any, prefix: string): Promise<any[]> {
	if (!table || typeof table.search !== 'function' || !prefix) return [];
	return toArray(
		table.search({ conditions: [{ attribute: 'id', comparator: 'starts_with', value: prefix }] }),
		`${tableName(table)}[${prefix}*]`,
	);
}

/**
 * Worlds this worker has confirmed are on KEY_REV 3. Migration is one-way and
 * permanent, so a positive answer can be memoized forever; a negative one is
 * never cached, because the very next write may migrate it.
 */
export const keyedWorlds = new Set<string>();

/**
 * How many "already migrated" answers one of these memo sets will hold.
 *
 * The answers are permanently true, so forgetting one is only ever a cost, never
 * a correctness problem: the next read re-derives it from the player row. What
 * forgetting buys is a ceiling. These sets gain an entry per world (or per save)
 * this worker has ever touched and previously dropped none, which made them grow
 * with the size of the player base for the lifetime of the process — small per
 * entry, but unbounded, which is the property that matters.
 */
const KEYED_MEMO_MAX = 20_000;

/**
 * Remember a permanently-true migration answer, bounded. At the cap the oldest
 * insertion is dropped (JS Sets iterate in insertion order, so `.next()` is the
 * oldest key) — a plain FIFO rather than a true LRU, which is the right trade
 * here because every entry is equally cheap to re-derive.
 */
export function rememberKeyed(set: Set<string>, key: string): void {
	if (set.has(key)) return;
	if (set.size >= KEYED_MEMO_MAX) {
		const oldest = set.values().next();
		if (!oldest.done) set.delete(oldest.value);
	}
	set.add(key);
}

/**
 * The KEY_REV a world has reached, read off the acting player's row.
 *
 * A solo world's id IS the player's id, so the marker is simply `keyRev`. A save
 * that last played in a pre-0.3 shared world still carries a `w_…` worldId, and
 * there is no Player row under that id — patching one would create a junk row and
 * the lookup would answer 0 forever, so byWorld would pay for the legacy full
 * scan on every read for the rest of that save's life. Those worlds record their
 * marker per-world in `keyRevs` on the player instead.
 */
async function keyRevOf(worldId: string, playerId?: string): Promise<number> {
	const owner = await getPlayer(playerId || worldId);
	if (!owner) return 0;
	return owner.id === worldId ? owner.keyRev || 0 : (owner.keyRevs || {})[worldId] || 0;
}

/** Record that `worldId` is fully migrated, on whichever field fits it. */
async function markWorldKeyed(worldId: string, playerId: string): Promise<void> {
	if (worldId === playerId) {
		await patchPlayer(playerId, { keyRev: KEY_REV });
		return;
	}
	const owner = await getPlayer(playerId);
	await patchPlayer(playerId, { keyRevs: { ...(owner?.keyRevs || {}), [worldId]: KEY_REV } });
}

/**
 * Seed the in-memory set from a player row. byWorld() only knows a world id, so
 * a legacy `w_…` world would look unmigrated to it until the next heartbeat ran
 * the migration again. Called wherever we hold a player, which is every endpoint.
 */
export function noteKeyedWorlds(player: any): void {
	if ((player?.keyRev || 0) >= KEY_REV && player?.id) rememberKeyed(keyedWorlds, player.id);
	for (const [wid, rev] of Object.entries(player?.keyRevs || {}))
		if ((rev as number) >= KEY_REV) rememberKeyed(keyedWorlds, wid);
}

export async function worldIsKeyed(worldId: string, playerId?: string): Promise<boolean> {
	if (!worldId) return false;
	if (keyedWorlds.has(worldId)) return true;
	if ((await keyRevOf(worldId, playerId)) >= KEY_REV) {
		rememberKeyed(keyedWorlds, worldId);
		return true;
	}
	return false;
}

/**
 * The area segment a row should key under: its placement's for a Chest (the
 * id-equality invariant is the placement's to define), its own otherwise.
 */
function areaFor(worldId: string, name: string, row: any, areaByTail: Map<string, string>): string {
	const own = String(row?.area || '');
	if (name !== 'Chest') return own;
	// Try the chest's own area segment first, then a bare tail — the chest may be
	// on either side of the migration when we ask.
	const id = String(row?.id ?? '');
	return areaByTail.get(idTail(worldId, id, own)) || areaByTail.get(idTail(worldId, id, '')) || own;
}

/**
 * Re-key one world's rows into the current KEY_REV contract, once, then mark the
 * save so it never happens again.
 *
 * The new id is `targetId` above: the row's own globally-unique tail under the
 * world prefix, plus an area segment for the tables that carry one. Old ids were
 * already unique, so the mapping is deterministic and collision-free.
 *
 * The Chest-id-equals-Placement-id invariant is preserved DELIBERATELY now
 * rather than for free. Under KEY_REV 3 both rows shared an old id and so got
 * the same new one; now the id depends on the row's area, and a Chest whose
 * `area` was ever lost or healed differently from its Placement's would key
 * itself somewhere its placement is not — a chest the game can see and cannot
 * open. So chests take their area from their placement, and fall back to their
 * own only when there is no placement left to ask.
 *
 * This is the ONLY full scan left on the per-world path, it runs at most once
 * per world per revision, and it runs from write paths only (login and
 * heartbeat) — never from a GET handler, which must not write.
 */
export async function migrateWorldKeys(worldId: string, playerId?: string): Promise<void> {
	if (!worldId || keyedWorlds.has(worldId)) return;
	const t = db();
	const owner = playerId || worldId;
	if ((await keyRevOf(worldId, owner)) >= KEY_REV) {
		rememberKeyed(keyedWorlds, worldId);
		return;
	}
	try {
		// Which area each of this world's placements lives in, by the tail its id
		// reduces to. Built from EVERY placement (not just the ones being moved), so
		// a chest that needs re-keying can still find its placement's area even when
		// that placement was already correct.
		const areaByTail = new Map<string, string>();
		for (const name of REKEYED_TABLES) {
			const table = t[name];
			if (!table || typeof table.search !== 'function') continue;
			const mine = (await toArray(table.search({}), name)).filter((r: any) => (r?.worldId ?? r?.playerId) === worldId);
			if (name === 'Placement')
				for (const r of mine)
					if (r?.area) areaByTail.set(idTail(worldId, String(r.id ?? ''), String(r.area)), String(r.area));
			const want = (r: any) => targetId(name, worldId, r, areaFor(worldId, name, r, areaByTail));
			const stale = mine.filter((r: any) => String(r?.id ?? '') !== want(r));
			for (const row of stale) {
				const oldId = String(row.id);
				// Write the new row before removing the old one: a crash between the
				// two leaves a duplicate (which byWorld dedupes by id) rather than a
				// hole. Losing a placement is unrecoverable; seeing one twice is not.
				await table.put({ ...row, id: want(row), worldId });
				await table.delete(oldId);
			}
			if (stale.length) console.error(`key migration: re-keyed ${stale.length} ${name} row(s) for world ${worldId}`);
		}
		// KEY_REV 3: collapse a per-line feed into the single feed row. Done after
		// the re-key loop so any legacy line already carries this world's prefix.
		const feedTable = t.FeedEntry;
		if (feedTable && typeof feedTable.search === 'function') {
			const lines = (await toArray(feedTable.search({}), 'FeedEntry')).filter(
				(r: any) =>
					(r?.worldId ?? r?.playerId) === worldId && r?.id !== feedRowId(worldId) && !Array.isArray(r?.entries),
			);
			if (lines.length) {
				const merged = [
					...(Array.isArray((await safeGet(feedTable, feedRowId(worldId)))?.entries)
						? (await safeGet(feedTable, feedRowId(worldId))).entries
						: []),
					...lines.map((r: any) => ({ id: r.id, at: r.at, icon: r.icon, text: r.text })),
				].sort((a: any, b: any) => (a.at || 0) - (b.at || 0));
				await writeFeed(worldId, merged);
				for (const r of lines) await feedTable.delete(r.id);
				console.error(`key migration: collapsed ${lines.length} feed line(s) for world ${worldId}`);
			}
		}

		await markWorldKeyed(worldId, owner);
		rememberKeyed(keyedWorlds, worldId);
	} catch (e: any) {
		// A failed migration must never break the action that triggered it — the
		// world stays unmigrated and byWorld keeps using the legacy merge path,
		// which is slower but correct. We simply try again on the next write.
		console.error(`key migration for world ${worldId} skipped —`, e?.message || e);
	}
}

/**
 * Every per-player query goes through here. PlayerAchievement is keyed
 * `${playerId}:${achievementId}`, so it reads as a bounded range scan; the
 * explicit filter still runs, and guarantees strict save isolation even if the
 * range ever yields an extra row — nothing from another save can leak into (or
 * be deleted from) this player's world.
 *
 * The remaining callers ask world-owned tables for "rows this player owns"
 * (export, delete-my-save, dev reset). Those rows live under the WORLD's prefix,
 * not the player's, so they still need the unbounded scan — but every one of
 * them is a cold path, and none is reached from snapshot() or a gameplay action.
 */
export async function byPlayer(table: any, playerId: string, opts: { player?: any } = {}): Promise<any[]> {
	// Defensive: if a table isn't available yet (e.g. a newly added schema table on
	// an instance that hasn't been restarted), treat it as empty rather than throwing
	// — a missing optional table must never break a full state read / refresh.
	if (!table || typeof table.search !== 'function' || !playerId) return [];
	const own = (r: any) => r?.playerId === playerId;
	if (tableName(table) === 'PlayerAchievement') {
		const rows = (await scanPrefix(table, `${playerId}:`)).filter(own);
		if (rows.length) return rows;
		// An empty bounded read is ambiguous: it means EITHER this save has earned
		// nothing yet (overwhelmingly the common case) OR it predates player-prefixed
		// achievement ids. The legacy rescue below can only tell them apart with an
		// unbounded scan of every achievement row of every save in the database.
		//
		// That scan used to run unconditionally on the empty case, and the comment
		// justifying it — "the cost is paid by saves with no achievements yet, a
		// scan of a table that is, for them, tiny" — had it backwards: the table is
		// small for THEM, not small. awardAchievements reaches this on essentially
		// every gameplay action, so a brand-new save made every one of its actions
		// cost a scan proportional to the whole player base. That is precisely the
		// coupling the KEY_REV 3 work existed to remove, left in place on the one
		// path most likely to be someone's first ten minutes with the game.
		//
		// So gate it on the same kind of marker the world re-keying uses. Any save
		// created at or after KEY_REV 3 provably has no legacy rows and skips the
		// scan outright; only a genuinely old save with nothing under its prefix
		// pays, and it pays once, because the rescue marks it on the way through.
		if (await achievementsAreKeyed(playerId, opts.player)) return rows;
		const legacy = (await toArray(table.search({}), tableName(table))).filter(own);
		// Memoize WITHOUT writing. byPlayer is reached from snapshot() and from
		// Metrics, both GET handlers, and a GET in this file must not write — so the
		// marker here is process-local only. That is enough to kill the pathology:
		// the scan drops from once per ACTION to at most once per save per worker,
		// and a save created from here on never reaches it at all, because
		// createPlayerRecords stamps `achKeyRev` at birth.
		rememberKeyed(achKeyedPlayers, playerId);
		return legacy;
	}
	return (await toArray(table.search({}), tableName(table))).filter(own);
}

/**
 * Saves this worker has confirmed carry no pre-KEY_REV_3 achievement rows.
 * One-way and permanent, like `keyedWorlds`, so a positive answer is memoizable;
 * bounded by `rememberKeyed` so it can't grow with the player base.
 */
const achKeyedPlayers = new Set<string>();

/**
 * True when `playerId` is known to have no legacy (un-prefixed) achievement rows,
 * so the empty-result rescue scan in byPlayer can be skipped.
 *
 * Two ways to know: this worker has already checked, or the save carries the
 * marker `createPlayerRecords` stamps at birth. Both are permanently true once
 * true, so neither answer ever has to be re-derived.
 */
async function achievementsAreKeyed(playerId: string, known?: any): Promise<boolean> {
	if (achKeyedPlayers.has(playerId)) return true;
	const player = known && known.id === playerId ? known : await getPlayer(playerId);
	if (!player) return false;
	if ((player.achKeyRev || 0) >= KEY_REV) {
		rememberKeyed(achKeyedPlayers, playerId);
		return true;
	}
	return false;
}

/**
 * Reliable per-player lookup of a single record by id. safeGet first (it also
 * salvages an undecodable row, which a scan cannot — a dropped row carries no
 * id), and only fall back to the scan when that comes up null, which is the one
 * answer a cold Harper instance is allowed to get wrong.
 */
async function findOwned(table: any, playerId: string, id: string): Promise<any | null> {
	const direct = await safeGet(table, id);
	if (direct && direct.playerId === playerId) return direct;
	const rows = await byPlayer(table, playerId);
	return rows.find((r: any) => r.id === id) || null;
}

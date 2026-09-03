// Wild Willows — server: worlds
//
// World lookup and save repair: resolving a player's world, the by-world / by-area
// reads, seeding a solo world, reconciling the seed tables against data/*.json,
// and the save migrations (animal aliases, gate trails, field journal, corrupt
// record purge).
//
// Split out of the single server/resources.ts; see that file for the whole map.

import achievementsData from '../data/achievements.json';
import animalAliasData from '../data/animal-aliases.json';
import animals1Data from '../data/animals-1.json';
import animals2Data from '../data/animals-2.json';
import biomesData from '../data/biomes.json';
import objectsData from '../data/habitat-objects.json';
import recipesData from '../data/recipes.json';
import resourcesData from '../data/resources.json';
import toolsData from '../data/tools.json';

import { db, isDecodeError } from './core';
import { forceRemove, safeGet, tableName, toArray } from './store';
import { KEY_REV, WORLD_KEYED, keyedWorlds, migrateWorldKeys, rememberKeyed, scanPrefix, worldIsKeyed } from './keys';
import { cached } from './scan-cache';
import { GUIDE_MAX, LEGACY_JOURNAL_TOOL, getPlayer, guideTool, patchPlayer } from './player';
import { blocksGateTrail, gateGeomOf, recalcBiome, whyReturnedText } from './biome';
import { awardWorldAchievements } from './achievements';
import type { CustomGoal } from './tasks';

// ----------------------------------------------------------------- worlds
// Shared, restorable world state (biomes, terrain, placements, animals,
// chests, feed) is owned by a World, not a player. Single-player is just a
// private "world of one" whose id equals the player's id, so legacy rows keyed
// by playerId already belong to it. `byWorld` matches a row's `worldId`, but
// falls back to `playerId` for rows written before this column existed — for a
// solo world those values are identical, so old saves keep working untouched.

/** The world a player is currently acting in. Defaults to their solo world (= their id). */
export function worldOf(player: any): string {
	return player?.worldId || player?.id;
}

/**
 * All rows belonging to one world (worldId, falling back to legacy playerId).
 *
 * The hot read. Under KEY_REV 3 this is a bounded range scan over one world's
 * contiguous key run, so its cost tracks the size of THAT world rather than the
 * size of the database — which is the whole point: before this, every state
 * refresh read every row of every save that had ever been created.
 *
 * The explicit `worldId` filter is kept even though the range is already
 * narrow. It costs nothing on a small result set and it is the backstop that
 * makes cross-save leakage impossible if a key ever escapes the contract.
 */
export async function byWorld(table: any, worldId: string): Promise<any[]> {
	if (!table || typeof table.search !== 'function' || !worldId) return [];
	const name = tableName(table);
	// Once per request, not once per caller. Three separate passes over one
	// Terraform ask this exact question about BiomeState; the scope is keyed by the
	// world id it was already handed, and is only ever open when a single request
	// can write to what it holds (see scan-cache.ts).
	return cached(worldId, `${name}|world`, () => readWorld(table, name, worldId));
}

async function readWorld(table: any, name: string, worldId: string): Promise<any[]> {
	const own = (r: any) => (r?.worldId ?? r?.playerId) === worldId;
	if (!WORLD_KEYED.has(name)) return (await toArray(table.search({}), name)).filter(own);

	const rows = (await scanPrefix(table, `${worldId}:`)).filter(own);
	// Until this world has been migrated its rows may still be under the old id
	// scheme, and a bounded scan would silently return fewer than exist — which
	// the game reads as "this world has no placements/terrain", the exact failure
	// mode the original full scans were written to avoid. So an unmigrated world
	// pays for both reads. Migration runs on login and on every heartbeat, so a
	// save spends at most one session here, and a brand-new world never does.
	if (!(await worldIsKeyed(worldId))) {
		const seen = new Set(rows.map((r: any) => r.id));
		for (const r of (await toArray(table.search({}), name)).filter(own)) if (!seen.has(r.id)) rows.push(r);
	}
	return rows;
}

/**
 * Tables whose ids carry the area as the SECOND key segment, `${wid}:${area}:…`.
 *
 * `Placement` joined under KEY_REV 4. Every per-biome reader of it — recalcBiome
 * on each place/plant/terraform/remove, recipeUnlockContext on each craft, the
 * collision checks in PlaceObject and Terraform — was reading all six areas and
 * discarding five sixths in JS, which is the same waste this set was created to
 * remove for terrain.
 *
 * `Chest` is deliberately NOT here even though its id now carries an area
 * segment too (it must: its id IS its placement's). Nothing reads chests per
 * area — the snapshot wants every one of them — so adding it would buy nothing
 * and would claim a fast path no caller uses.
 *
 * `NodeState` joined when the snapshot stopped wanting every area. Its rows carry
 * no `area` FIELD — which is what the note here used to say disqualified it — but
 * its id has carried the area as its second segment all along, so `matches` below
 * reads the segment for a row that has no field to read. See that predicate.
 */
const AREA_KEYED = new Set(['TerrainTile', 'Placement', 'NodeState']);

/**
 * Bounded scan of ONE area's run inside one world.
 *
 * `byWorld` already narrows a scan from "every save in the database" to "this
 * world"; this narrows it again to "this area of this world", which is what the
 * per-biome callers actually wanted — every one of them was reading all six
 * biomes' rows and then throwing five sixths away in JS. Same mechanism, one
 * more segment of prefix: `${wid}:${area}:` is still a `starts_with` over the
 * primary key, so it inherits every property the key contract above argues for.
 *
 * Falls back to the world scan plus a JS filter when the world has not been
 * migrated (its rows may still be under the old id scheme, where a narrower
 * prefix would silently return fewer rows than exist — the exact failure the
 * legacy merge in byWorld exists to prevent).
 *
 * The `area` field is checked even on the fast path. It is nearly free, and it
 * means a row whose id segment ever disagrees with its own `area` — a legacy row
 * healed in place, a hand-edited record — cannot leak into another area's view.
 */
export async function byArea(table: any, worldId: string, area: string): Promise<any[]> {
	if (!table || !worldId) return [];
	const name = tableName(table);
	return cached(worldId, `${name}|area:${area}`, () => readArea(table, name, worldId, area));
}

async function readArea(table: any, name: string, worldId: string, area: string): Promise<any[]> {
	// Prefer the row's own `area`, exactly as before. Fall back to the id's area
	// segment only for a row that has no such field — NodeState, whose ids are
	// `${wid}:${biomeId}:${nodeId}`. Field first, not segment first: the note on
	// byArea explains why a row whose segment disagrees with its own area must
	// never leak into another area's view, and that argument is unchanged for
	// every table that has the field.
	const matches = (r: any) =>
		r?.area !== undefined ? r.area === area : String(r?.id ?? '').startsWith(`${worldId}:${area}:`);
	if (!area || !AREA_KEYED.has(name) || !(await worldIsKeyed(worldId)))
		return (await byWorld(table, worldId)).filter(matches);
	const own = (r: any) => (r?.worldId ?? r?.playerId) === worldId;
	return (await scanPrefix(table, `${worldId}:${area}:`)).filter((r: any) => own(r) && matches(r));
}

/** Single record by id, scoped to one world. */
export async function findInWorld(table: any, worldId: string, id: string): Promise<any | null> {
	// Point read first — under KEY_REV 3 the id already carries the world prefix,
	// so ownership is verifiable without reading the world. safeGet salvages an
	// undecodable row on the way through; only a null needs the scan.
	const direct = await safeGet(table, id);
	if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.id === id) || null;
}

/**
 * Find a terrain tile by its board position (area + x + y), scoped to the world
 * — independent of the row's id string. Older saves keyed terrain ids off the
 * playerId (`${playerId}:${area}:${x}:${y}`) while current code keys them off
 * the worldId, so an exact-id lookup misses legacy beds even though they still
 * render (the world snapshot matches them by worldId). Matching on coordinates
 * recognizes them regardless of the id scheme; callers act on the tile's real
 * `.id`, so legacy rows are patched/deleted correctly and heal over time.
 */
export async function findTerrainAt(
	table: any,
	worldId: string,
	area: string,
	x: number,
	y: number,
): Promise<any | null> {
	// The current id IS the position, so try it directly before scanning. A hit
	// here turns the most frequent lookup in the game (every dig, plant, place and
	// terraform does at least one) into a single point read.
	const direct = await safeGet(table, `${worldId}:${area}:${x}:${y}`);
	if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
	// A MISS is the common case — most of these ask about bare ground — and in a
	// re-keyed world it is already the whole answer, so the scan below was a few
	// hundred rows spent re-confirming an absent row on every dig into fresh
	// ground and every object set down on it.
	//
	// What makes that safe is the same fact `byArea` bounds its own scan with: in
	// a keyed world a tile of this area lives under the `${worldId}:${area}:` run,
	// and the only id any write path puts there is the position itself. So the
	// scan can return nothing the point read did not already find. (Nor does it
	// rescue an undecodable row — a scan drops those; safeGet above is what
	// salvages one.)
	//
	// An unmigrated world still pays for it: its tiles may be under the older
	// playerId-keyed ids, where the coordinates are all that recognizes them.
	if (await worldIsKeyed(worldId)) return null;
	const rows = await byArea(table, worldId, area);
	return rows.find((r: any) => r.x === x && r.y === y) || null;
}

/**
 * Find a world's BiomeState / Discovery row by its natural key (biomeId /
 * animalId) rather than a reconstructed `${worldId}:${key}` id — same legacy-id
 * safeguard as findTerrainAt. Callers patch the row's real `.id`.
 */
export async function findBiomeState(table: any, worldId: string, biomeId: string): Promise<any | null> {
	return cached(worldId, `${tableName(table)}|biome:${biomeId}`, async () => {
		const direct = await safeGet(table, `${worldId}:${biomeId}`);
		if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
		const rows = await byWorld(table, worldId);
		return rows.find((r: any) => r.biomeId === biomeId) || null;
	});
}
export async function findDiscovery(table: any, worldId: string, animalId: string): Promise<any | null> {
	return cached(worldId, `${tableName(table)}|animal:${animalId}`, async () => {
		const direct = await safeGet(table, `${worldId}:${animalId}`);
		if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
		const rows = await byWorld(table, worldId);
		return rows.find((r: any) => r.animalId === animalId) || null;
	});
}

/**
 * Per-save setup on login and character creation. Idempotent.
 *
 * Named for an earlier design, when it built a "world of one" and a membership row.
 * Both are gone; what remains is the `worldId` compat field and the key-contract
 * migration. Kept under the old name because every login path calls it — renaming
 * it belongs with the Phase 4 cleanup, not here.
 */
export async function ensureSoloWorld(player: any, opts: { freshGrid?: boolean } = {}): Promise<void> {
	const soloId = player.id;
	// COMPAT: `worldId` is still written, and snapshot() still emits it, because a
	// released 0.2.x browser client reads it. A solo world's id IS the player's id,
	// so this is now pure ceremony. Remove in Phase 4, once /Metrics/ shows no
	// clients below 0.3.0 for 30 days.
	if (!player.worldId) await patchPlayer(player.id, { worldId: soloId });

	// A brand-new save is born on the current key contract, so there is nothing to
	// migrate — mark it and skip the scan. Every other save goes through the
	// migration, which is a no-op after the first time.
	if (opts.freshGrid && !player.keyRev) {
		await patchPlayer(player.id, { keyRev: KEY_REV });
		rememberKeyed(keyedWorlds, soloId);
		return;
	}
	await migrateWorldKeys(soloId, player.id);
}

/**
 * Reconcile seed tables against the definition JSON, deleting any DB records
 * whose id is no longer in the JSON (renamed or removed). Runs once per worker.
 * Without this, a renamed recipe/object leaves a stale duplicate in the table
 * (e.g. an old "Water Restoration Kit" alongside the new "Wetland Restoration
 * Kit"), because Harper's data loader only upserts and never deletes.
 */
let reconcilePass: Promise<void> | null = null;
function reconcileDefinitions(): Promise<void> {
	// Memoise the PROMISE, not a boolean. The old version flipped a flag
	// synchronously and then ran hundreds of awaits — so a second request landing
	// mid-pass got an instant "already done" and read the half-pruned table. That
	// is a guarantee at boot, not a rare race: a rolling restart is followed
	// immediately by every open client asking for /GameData/ at once.
	//
	// On failure the memo is cleared so the next caller retries. The old code set
	// its flag before the first await, so a single throw (a delete Harper won't
	// take, an undecodable row aborting the scan) disabled the prune for the whole
	// life of that worker, permanently.
	if (!reconcilePass) {
		reconcilePass = runReconcile().catch((e: any) => {
			console.error('reconcileDefinitions failed —', e?.message || e);
			reconcilePass = null;
		});
	}
	return reconcilePass;
}

async function runReconcile(): Promise<void> {
	const t = db();
	const sources: [any, any[]][] = [
		[t.Biome, biomesData.records],
		[t.Recipe, recipesData.records],
		[t.HabitatObject, objectsData.records],
		[t.ToolDef, toolsData.records],
		[t.ResourceType, resourcesData.records],
		[t.Animal, [...animals1Data.records, ...animals2Data.records]],
		[t.Achievement, achievementsData.records],
	];
	for (const [table, records] of sources) {
		const valid = new Set(records.map((r: any) => r.id));
		for (const row of await toArray(table.search({}), tableName(table))) {
			if (!valid.has(row.id)) await table.delete(row.id);
		}
		// Force each stored record to exactly match the JSON. Harper's data loader
		// only upserts (merges) fields, so a field REMOVED from the JSON — e.g. a
		// recipe's old `unlock` health gate, or changed materials/capacities — can
		// linger on the stored record and keep producing stale behavior. A full
		// put() replaces the whole record, clearing anything no longer in the JSON.
		for (const rec of records) await table.put(rec);
	}
	// NOTE: we intentionally do NOT scan-and-purge corrupt records on boot. Harper
	// decodes a record on get/put/delete alike, so a row left undecodable by an
	// earlier schema layout can't be removed through the Resource API — and merely
	// reading it (to find it) re-triggers Harper's own "Error decoding record" log.
	// `safeGet` still drops a corrupt row if it's ever fetched by id, but the clean
	// fix for accumulated dev-time schema drift is to drop the database (see README).
}

/**
 * Old animal id -> the id that replaced it (data/animal-aliases.json). The 0.3
 * ecology pass renamed and re-cast a lot of the roster: `coyote-meadow` became
 * plain `coyote`, `mule-deer-alpine` became `grizzly-bear`, and so on.
 *
 * reconcileDefinitions() above already drops the retired rows from the Animal
 * table — but that only fixes the DEFINITIONS. The SAVES still point at the old
 * ids, which is what migrateAnimalAliases() is for.
 */
const ANIMAL_ALIASES = new Map<string, string>(
	animalAliasData.records.map((r: { from: string; to: string }) => [r.from, r.to] as [string, string]),
);

/**
 * Rewrite one save's references to retired animal ids.
 *
 * A pre-0.3 save keeps a Discovery row for, say, `coyote-meadow`. Everything
 * that resolves the row through the animal definitions now skips it —
 * `returnedHere`, `computeBalance`, `returnedKinds` all look up
 * `d.animal.get('coyote-meadow')` and get undefined — but the row is still
 * there, so `totalAnimals` (a raw row count) keeps counting it. Worse, the
 * replacement `coyote` can then satisfy its own requirements and add a SECOND
 * row for the same ecological slot, so the preserve-wide total drifts upward by
 * one per renamed animal. Custom `welcome`/`attract` goals hold the same dead
 * ids: they read their animal straight off `goal.animalId`, so they render as a
 * raw slug and can never complete.
 *
 * So every stale row is either moved onto the new id or folded into the row
 * that is already there — never left in place. Idempotent, because a migrated
 * save has no aliased ids left to match, and cheap enough (one per-world scan)
 * to run on every world entry rather than as a one-shot boot sweep: saves that
 * do not log in during any given deploy still get migrated the next time they
 * do, and no worker has to scan every Discovery row in the database to find
 * them.
 */
async function migrateAnimalAliases(worldId: string, playerId: string): Promise<number> {
	const t = db();
	const d = await defs();
	let touched = 0;

	// ---- Discovery rows. World-owned, so this covers every save in the world.
	const rows = await byWorld(t.Discovery, worldId);
	const stale = rows.filter((r: any) => ANIMAL_ALIASES.has(r?.animalId));
	if (stale.length) {
		// Keyed by animalId rather than row id: a legacy save keys Discovery off the
		// playerId (see findDiscovery), so the id tells us nothing about the animal.
		const live = new Map<string, any>(
			rows.filter((r: any) => !ANIMAL_ALIASES.has(r?.animalId)).map((r: any) => [r.animalId, r]),
		);
		for (const old of stale) {
			const newId = ANIMAL_ALIASES.get(old.animalId)!;
			const animal = d.animal.get(newId);
			// The replacement is gone too (retired in a later pass). Nothing to move the
			// row onto, so drop it rather than leave an id no lookup can resolve.
			if (!animal) {
				await t.Discovery.delete(old.id);
				touched++;
				continue;
			}
			const existing = live.get(newId);
			if (existing) {
				// Both the old and the new animal have a row: this is the double-count.
				// Keep ONE row and fold the retired one's history into it, so the player
				// does not lose observations they actually made.
				const firsts = [existing.firstObservedAt, old.firstObservedAt].filter((n: any) => typeof n === 'number');
				await t.Discovery.patch(existing.id, {
					timesObserved: (existing.timesObserved || 0) + (old.timesObserved || 0),
					...(firsts.length ? { firstObservedAt: Math.min(...firsts) } : {}),
				});
				await t.Discovery.delete(old.id);
				touched++;
				continue;
			}
			// The slot is free: re-key the row onto the new animal. `biomeId` comes from
			// the definitions and not from the old row, because several aliases move the
			// animal to a different biome (mule-deer-alpine -> grizzly-bear) and a stale
			// biomeId would mis-file it in every per-biome count.
			const moved = {
				...old,
				id: `${worldId}:${newId}`,
				worldId,
				animalId: newId,
				biomeId: animal.biome,
				whyReturned: whyReturnedText(animal, d),
			};
			await t.Discovery.put(moved);
			if (moved.id !== old.id) await t.Discovery.delete(old.id); // legacy playerId-keyed row
			live.set(newId, moved);
			touched++;
		}
	}

	// ---- Custom goals. Per-player, so each member migrates their own on their own entry.
	const player = await safeGet(t.Player, playerId);
	const goals = (player?.customGoals || []) as CustomGoal[];
	// A goal is stale if its animal was renamed OR retired outright. Both cases
	// have to be handled here: sanitizeGoals() would catch them, but it only runs
	// on SetGoals, so a goal nobody edits is never looked at again. Left alone it
	// renders as a raw slug ("Welcome the acorn-woodpecker"), reports 0% forever,
	// and holds one of only three goal slots for the life of the save.
	const isStale = (g: CustomGoal) => !!g?.animalId && (ANIMAL_ALIASES.has(g.animalId) || !d.animal.get(g.animalId));
	if (!goals.some(isStale)) return touched;
	// Goals that already name a live animal stay exactly as they are.
	const seen = new Set<string>(goals.filter((g) => g?.animalId && !isStale(g)).map((g) => `${g.kind}:${g.animalId}`));
	const migrated: CustomGoal[] = [];
	for (const g of goals) {
		if (!isStale(g)) {
			migrated.push(g);
			continue;
		}
		const alias = ANIMAL_ALIASES.get(g.animalId || '');
		// Retired with no successor, or the successor is gone too: translating would
		// just move the goal onto a second dead id. Drop it — an empty slot the
		// player can refill beats one they cannot.
		if (!alias || !d.animal.get(alias)) continue;
		// Two goals can alias onto the same animal — or onto one the player already
		// has a goal for. Keep the first and drop the twin.
		const key = `${g.kind}:${alias}`;
		if (seen.has(key)) continue;
		seen.add(key);
		migrated.push({ ...g, animalId: alias });
	}
	await patchPlayer(playerId, { customGoals: migrated });
	return touched;
}

/**
 * Drop Discovery rows for animals that no longer exist and have no replacement.
 *
 * The alias table only covers retirements that had a successor. 0.3 also removed
 * species outright, and those rows are worse than useless: every lookup that
 * resolves them through the definitions skips them, but `totalAnimals` is a raw
 * row count, so the preserve-wide total reads high forever and "150 of 150" can
 * never be reached. Runs after migrateAnimalAliases, so anything still unknown
 * here genuinely has nowhere to go.
 */
async function pruneUnknownDiscoveries(worldId: string, d: any): Promise<number> {
	const t = db();
	const rows = await byWorld(t.Discovery, worldId);
	let dropped = 0;
	for (const r of rows) {
		if (!r?.animalId || d.animal.get(r.animalId)) continue;
		await t.Discovery.delete(r.id);
		dropped++;
	}
	if (dropped) console.error(`save repair: dropped ${dropped} retired discovery row(s) for world ${worldId}`);
	return dropped;
}

/**
 * Re-file Discovery rows whose stored biome disagrees with the definitions.
 *
 * `Discovery.biomeId` is a copy of where the animal lived when it came back, and
 * an ecology pass can move a species without renaming it — 0.3 moves `coyote`
 * from Sunstone Flats to Willow Meadow and gives the desert a mountain lion
 * instead. An alias would have re-filed the row (migrateAnimalAliases reads the
 * biome off the definitions for exactly this reason), but a KEPT id gets no
 * alias, so the stale copy survives and the two halves of the game disagree
 * about where the animal is:
 *
 *   • returnedHere() and computeBalance() resolve through the definitions, so
 *     they count it in its new area;
 *   • recalcBiome's comfort pass (`if (disc.biomeId !== biomeId) continue`) and
 *     the client's animal spawn (WorldScene, `disc.biomeId === this.area`) read
 *     the stored copy, so it appears in the old one — and is scored against its
 *     new habitat requirements using the old area's placements, which pins its
 *     comfort at the floor and makes it "rarely seen" forever.
 *
 * Reconciling every row against the definitions fixes that case and any future
 * one, without needing a hand-written entry per moved species.
 */
async function reconcileDiscoveryBiomes(worldId: string, d: any): Promise<number> {
	const t = db();
	let refiled = 0;
	for (const r of await byWorld(t.Discovery, worldId)) {
		const biome = d.animal.get(r?.animalId)?.biome;
		if (!biome || biome === r.biomeId) continue;
		await t.Discovery.patch(r.id, { biomeId: biome });
		refiled++;
	}
	if (refiled) console.error(`save repair: re-filed ${refiled} discovery row(s) for world ${worldId}`);
	return refiled;
}

/**
 * Un-flood any water that walls off a trail gate.
 *
 * Terraform refuses these tiles now (blocksGateTrail), but a save made before
 * that check could already have a channel across a gate mouth — and open water
 * blocks walking, so the way into the next biome is shut with no in-game way to
 * reopen it. Prevention doesn't help someone already stuck, so the repair pass
 * clears those tiles once. Only `water` is touched; tilled and watered beds are
 * walkable and stay exactly as they are.
 */
async function repairGateTrails(worldId: string, d: any): Promise<number> {
	const t = db();
	const rows = await byWorld(t.TerrainTile, worldId);
	const geoms = new Map<string, ReturnType<typeof gateGeomOf>>();
	let cleared = 0;
	for (const tile of rows) {
		if (tile?.type !== 'water' || !tile.area || !d.biome.get(tile.area)) continue;
		if (!geoms.has(tile.area)) geoms.set(tile.area, gateGeomOf(d, tile.area));
		if (!blocksGateTrail(tile.x, tile.y, geoms.get(tile.area)!)) continue;
		await t.TerrainTile.delete(tile.id);
		cleared++;
	}
	if (cleared) console.error(`save repair: cleared ${cleared} gate-blocking water tile(s) for world ${worldId}`);
	return cleared;
}

/**
 * One-shot repairs a save needs after upgrading, run from a write path.
 *
 * Bump REPAIR_REV when a new repair is added here; every save then runs the pass
 * once more. The marker lives on the player row, and the caller passes the row it
 * already holds, so a repaired save costs a field read per beat and nothing more.
 *
 * This runs from Heartbeat as well as LoginPlayer on purpose. "Continue" resumes
 * through GameState, which is a GET and must not write — so a player who never
 * uses the login screen would otherwise never be repaired at all, and would keep
 * an inflated animal total and a soft-locked gate indefinitely.
 *
 * Login passes `force`, because login is once per session and already pays for
 * these reads: the marker is an optimization for the heartbeat path, not a
 * promise that a save is only ever looked at once.
 */
// REV 2: every save that logged in against the broken definition set (223
// animals) was repaired with retired species still counting as real, and then
// stamped repairRev 1 — so pruneUnknownDiscoveries and reconcileDiscoveryBiomes
// would never look at it again. Bumping forces one more pass now that defs()
// reports the true roster.
// REV 3: the field journal split into a pair of guides per area, so every save
// carrying the old preserve-wide tier needs one pass to be handed the books it
// already paid for (migrateFieldJournal).
// REV 4: BiomeState.playerWater arrived, and a row written before it exists is
// not merely missing an optimization — the client's fallback reads open water
// out of `state.terrain`, which now carries only the area the player is standing
// in, so a wetland lake is invisible from the meadow and a recipe the server
// would happily craft shows up locked. Backfilled below.
export const REPAIR_REV = 4;

export async function repairSave(
	worldId: string,
	playerId: string,
	d: any,
	opts: { force?: boolean; player?: any } = {},
): Promise<void> {
	if (!worldId || !playerId) return;
	if (!opts.force) {
		const row = opts.player ?? (await getPlayer(playerId));
		if ((row?.repairRev || 0) >= REPAIR_REV) return;
	}
	try {
		const renamed = await migrateAnimalAliases(worldId, playerId);
		const dropped = await pruneUnknownDiscoveries(worldId, d);
		const refiled = await reconcileDiscoveryBiomes(worldId, d);
		const unblocked = await repairGateTrails(worldId, d);
		await migrateFieldJournal(playerId, d, opts.player);
		// Any of those three changes which animals count as home, and
		// BiomeState.returnedCount is a stored number that only recalcBiome
		// recomputes. Left alone the HUD reads "24 of 25 animals returned" for a
		// preserve with nine, and that same count feeds the biome unlock gates and
		// the `*-reborn` achievement triggers. Only pay for it when something
		// actually moved: an already-clean save (which is every save after the
		// first pass, and every save created from 0.3 on) does no extra work.
		// `unblocked` joins them for the same reason: clearing a gate-blocking tile
		// deletes PLAYER-shaped open water, and BiomeState.playerWater is a stored
		// number only recalcBiome recomputes. Left alone, the Lakemaker trigger would
		// keep reading a lake that the repair had just drained.
		//
		// The water backfill joins them from the other direction: nothing MOVED,
		// but a biome row from before `playerWater` existed has never had one
		// written, and only recalcBiome writes it. One scan of this world's biome
		// rows buys the answer, and the rows are handed to the sweep below so the
		// scan is not paid for twice. A save that has one on every open biome —
		// which is every save recalculated even once since 0.3.12 — does no work.
		const states = await byWorld(db().BiomeState, worldId);
		const missingWater = states.some((b: any) => b.unlocked && d.biome.get(b.biomeId) && !b.playerWater);
		if (renamed || dropped || refiled || unblocked || missingWater)
			await recalcRepairedBiomes(worldId, playerId, d, states);
		await patchPlayer(playerId, { repairRev: REPAIR_REV });
	} catch (e: any) {
		// Same contract as the key migration: a failed repair must never break the
		// action that triggered it. The save stays unrepaired and we try again on
		// the next write.
		console.error(`save repair for ${playerId} skipped —`, e?.message || e);
	}
}

/**
 * Turn a save's single `field-journal` tier into the per-area guides.
 *
 * Before the split there was ONE journal on a preserve-wide ladder: tier N read
 * as "I own the guide to every area of order below N", and owning it gave both
 * the full animal page AND the exact requirements. Now each area has a guide of
 * its own, so a save that had already climbed that ladder would otherwise open
 * the tools menu to find every guide unwritten and its journal shut — work it
 * paid for, taken back.
 *
 * So every area the old tier covered gets its guide written all the way up,
 * because that is exactly what the old tier gave. Nothing is ever removed: a
 * guide already further along stays where it is, and the legacy tier is left on
 * the record rather than deleted, so a rolled-back client keeps reading what it
 * expects.
 *
 * Idempotent, and free for the saves that will be the overwhelming majority
 * within a week — no legacy tier means nothing to do.
 */
async function migrateFieldJournal(playerId: string, d: any, cached?: any): Promise<void> {
	const player = cached ?? (await getPlayer(playerId));
	const legacy = (player?.tools?.[LEGACY_JOURNAL_TOOL] as number) || 0;
	if (legacy < 2) return; // never upgraded (or never had one): nothing was paid for

	const tools = { ...(player.tools || {}) };
	let granted = 0;
	for (const b of d.biomes) {
		// The old rule, verbatim: an area's guide sat at tier (order + 1).
		if (legacy < (b.order || 1) + 1) continue;
		const id = guideTool(b.id);
		if ((tools[id] || 1) >= GUIDE_MAX) continue;
		tools[id] = GUIDE_MAX;
		granted++;
	}
	if (granted) await patchPlayer(playerId, { tools });
}

/**
 * Recompute every open area after a repair changed the discovery set.
 *
 * recalcBiome is the only thing that writes BiomeState.returnedCount / health /
 * balance, and it can surface an animal whose requirements were already met, so
 * the achievements it earns are awarded here too rather than waiting for the
 * player's next placement.
 */
async function recalcRepairedBiomes(worldId: string, playerId: string, d: any, known?: any[]): Promise<void> {
	const t = db();
	const states = known ?? (await byWorld(t.BiomeState, worldId));
	const open = states.filter((b: any) => b.unlocked && d.biome.get(b.biomeId)).map((b: any) => b.biomeId);
	// One Discovery read for the whole sweep, lent to every recalc and to the
	// achievement pass — this loop used to re-read the world's discoveries once
	// per unlocked biome, and then once more on the way out.
	const discoveries = await byWorld(t.Discovery, worldId);
	const newAnimals: any[] = [];
	const freshBiomeStates: any[] = [];
	for (const biomeId of open) {
		// `fresh`: this pass runs BECAUSE something changed underneath the stored
		// numbers — repairGateTrails deletes player-shaped water, and the water
		// backfill is here precisely for a row that has never had these written.
		// Re-derive from the rows rather than fold anything.
		const r = await recalcBiome(worldId, playerId, biomeId, { discoveries, fresh: true });
		newAnimals.push(...(r.newAnimals || []));
		if (r.biomeState) freshBiomeStates.push(r.biomeState);
	}
	if (newAnimals.length || freshBiomeStates.length)
		await awardWorldAchievements(worldId, playerId, {
			addDiscoveries: newAnimals,
			freshBiomeStates,
			biomeStates: states,
			discoveries,
		});
}

/**
 * Proactively delete records left undecodable by an earlier schema layout (rapid
 * dev schema drift), so Harper stops logging "Error decoding record" on boot and
 * during scans. Runs once per worker. Enumerates primary keys only (which don't
 * require decoding the record body), then force-reads each and drops any that fail.
 */
let corruptPurged = false;
async function purgeCorruptRecords() {
	if (corruptPurged) return;
	corruptPurged = true;
	const t = db();
	const names = [
		'Player',
		'BiomeState',
		'Chest',
		'Placement',
		'Discovery',
		'NodeState',
		'TerrainTile',
		'FeedEntry',
		'PlayerAchievement',
	];
	for (const name of names) {
		const table = t[name];
		if (!table || typeof table.search !== 'function') continue;
		// enumerate ids only — selecting just the primary key avoids decoding bodies
		const ids: string[] = [];
		try {
			for await (const r of table.search({ select: ['id'] })) if (r?.id != null) ids.push(r.id);
		} catch {
			continue;
		} // can't list ids cheaply; per-access safeGet still self-heals
		let purged = 0;
		for (const id of ids) {
			try {
				const rec = await table.get(id);
				if (rec) JSON.stringify({ ...rec }); // force the lazy decode
			} catch (e) {
				if (isDecodeError(e)) {
					if (await forceRemove(table, id)) purged++;
				}
			}
		}
		if (purged) console.error(`purgeCorruptRecords: removed ${purged} undecodable ${name} record(s)`);
	}
}

// Definition cache — definitions only change on deploy, so cache per worker.
//
// SOURCE OF TRUTH IS THE BUNDLE, NOT THE DATABASE. This used to read the seven
// seed tables back out of Harper, which made every definition read depend on the
// data loader and reconcileDefinitions() having left the tables in exactly the
// state the JSON describes. They didn't: 0.3 retired 73 animal ids, the loader
// only upserts, and the prune lost a race with the very first requests after the
// rolling restart (see reconcileDefinitions) — so a worker cached the UNION of
// the old and new rosters, 223 animals, and served it to every client for the
// life of the process. That is what shipped: "0/37 animals returned" in Willow
// Meadow, "0/223 across the preserve", and retired species walking around in the
// browser demo.
//
// The records are compiled into this bundle already (esbuild inlines the JSON
// imports above), so reading them from the DB was a round-trip to get back a
// copy of something we are holding. Building straight from the imports makes the
// definitions exactly the deployed build's, always, and makes a stale row in the
// table a cosmetic problem instead of a gameplay one. It also drops seven full
// table scans off worker warm-up.
let defsCache: any = null;
export async function defs() {
	// Cleaning the tables is still worth doing (Harper's own REST surface reads
	// them, and orphans are confusing to look at), but nothing below depends on
	// it any more — so it must not delay or fail this call.
	void reconcileDefinitions();
	if (!defsCache) {
		const biomes = biomesData.records.slice();
		const animals = [...animals1Data.records, ...animals2Data.records];
		const resources = resourcesData.records.slice();
		const recipes = recipesData.records.slice();
		const objects = objectsData.records.slice();
		const tools = toolsData.records.slice();
		const achievements = achievementsData.records.slice();
		const index = (arr: any[]) => new Map(arr.map((r) => [r.id, r]));
		achievements.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
		defsCache = {
			biomes,
			animals,
			resources,
			recipes,
			objects,
			tools,
			achievements,
			biome: index(biomes),
			animal: index(animals),
			resource: index(resources),
			recipe: index(recipes),
			object: index(objects),
			tool: index(tools),
			achievement: index(achievements),
		};
	}
	return defsCache;
}

/**
 * Wild Willows — Harper backend resources.
 *
 * All game-state mutations flow through these endpoints. The frontend is
 * never trusted: inventory math, crafting costs, placement rules, biome
 * health, ecological balance, animal-return conditions and biome unlocks
 * are all validated and computed here, inside Harper.
 *
 * Built with `npm run build:server` (esbuild) into resources.js, which the
 * `jsResource` plugin loads.
 */

// Harper globals (provided by the Harper JavaScript environment)
declare const databases: any;
declare const Resource: any;

// Definition JSON is the source of truth for the seed tables. Harper's data
// loader only upserts records — it never deletes ones removed/renamed in the
// JSON — so we reconcile against these on boot to prune orphans.
import biomesData from '../data/biomes.json';
import recipesData from '../data/recipes.json';
import objectsData from '../data/habitat-objects.json';
import toolsData from '../data/tools.json';
import resourcesData from '../data/resources.json';
import animals1Data from '../data/animals-1.json';
import animals2Data from '../data/animals-2.json';
import achievementsData from '../data/achievements.json';
import { weatherSnapshot, weatherTypeAt, gatherResourceIdFor, isWeatherGatheredResource, seasonAt, dayPhaseAt } from './weather';
// Policy pages (privacy / age suitability), inlined from public/*.html by
// scripts/build-pages.mjs — served as endpoints, see the bottom of this file.
import { privacyHtml, ageRatingHtml, supportHtml } from './pages';

// Biome ids for the weather block (weather is per-biome; climate differs by
// biome). Derived once from the static seed data so the weather snapshot stays
// a pure function and needs no async defs() lookup.
const WEATHER_BIOME_IDS: string[] = biomesData.records.map((b: any) => b.id);

/** Weather/day time is measured from accrued PLAY TIME (player.metrics.playSeconds,
 *  accumulated from heartbeats — see Heartbeat), NOT wall-clock time. So the
 *  calendar only advances while the game is actually being played: every world
 *  starts at Day 1 and reaches Day 2 after ~one day's worth of real play. Pure
 *  function of stored data. */
function weatherTimeFromPlay(player: any): number {
	return Math.max(0, Math.round((player?.metrics?.playSeconds || 0) * 1000));
}

// `databases.wildwillows` is undefined right after the database is dropped (until
// Harper restarts and the component recreates the tables). Fail cleanly with a 503
// instead of throwing raw TypeErrors on every request.
const db = () => {
	const d = (typeof databases !== 'undefined' && databases) ? databases.wildwillows : null;
	if (!d || !d.Player) throw new GameError('The preserve database is starting up — restart Harper if this persists.', 503);
	return d;
};

// ---------------------------------------------------------------- helpers

class GameError extends Error {
	statusCode: number;
	constructor(message: string, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Deterministic PRNG (FNV-1a → mulberry32) — the same tiny pair the client and
// weather module use. Daily tasks are a pure function of (worldId, UTC day), so
// every device/member derives the identical task list with no stored state.
function hash32(str: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function seededRng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function posInt(n: any, label: string): number {
	const v = Number(n);
	if (!Number.isInteger(v) || v <= 0) throw new GameError(`${label} must be a positive whole number`);
	return v;
}

function sumValues(obj: Record<string, number> | undefined): number {
	if (!obj) return 0;
	return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}

/** True for the Harper structured-encoder error raised on a record written under an
 *  incompatible (older) schema layout. */
function isDecodeError(e: any): boolean {
	return /end of buffer|buffer not reached|decod/i.test(String(e?.message || e));
}

/**
 * Remove a record whose stored bytes can't be decoded. A plain delete() also fails
 * because Harper decodes the record (for index cleanup) on the way out, so we first
 * OVERWRITE the slot with a valid minimal record (a full put writes fresh bytes and
 * doesn't read the old corrupt value), then delete that now-decodable record.
 */
async function forceRemove(table: any, id: string): Promise<boolean> {
	try { await table.delete(id); return true; } catch (e) { if (!isDecodeError(e)) throw e; }
	try {
		await table.put({ id });   // overwrite the corrupt bytes with a valid stub
		await table.delete(id);    // now it decodes → deletes cleanly
		return true;
	} catch { return false; }
}

/**
 * Read one record by id; if it can't be decoded (a leftover from an earlier schema
 * layout during rapid dev), DELETE the corrupt record and return null instead of
 * throwing forever. Self-healing — the bad row is removed the moment it's touched.
 */
async function safeGet(table: any, id: string): Promise<any | null> {
	try {
		const rec = await table.get(id);
		// Harper decodes lazily (on property access), so force a full read NOW to surface
		// a corrupt record here where we can delete it — not later in some merge/patch.
		if (rec) { try { JSON.stringify({ ...rec }); } catch (e) { if (isDecodeError(e)) throw e; } }
		return rec;
	} catch (e) {
		if (isDecodeError(e)) {
			await forceRemove(table, id);
			console.error(`purged undecodable record: ${id}`);
			return null;
		}
		throw e;
	}
}

async function toArray(iterable: any): Promise<any[]> {
	const out: any[] = [];
	try {
		for await (const item of iterable) out.push(item);
	} catch (e: any) {
		// A record left undecodable by a prior schema version (rapid-dev schema drift)
		// must not break a whole scan. Keep what we read; skip the rest.
		console.error('scan: skipping undecodable record(s) —', e?.message || e);
	}
	return out;
}

async function allOf(table: any): Promise<any[]> {
	if (!table || typeof table.search !== 'function') return [];
	return toArray(table.search({}));
}

/**
 * Every per-player query goes through here. The search condition narrows by
 * playerId, and the explicit filter guarantees strict save isolation even if
 * the underlying index ever returns extra rows — nothing from another save
 * can leak into (or be deleted from) this player's world.
 */
async function byPlayer(table: any, playerId: string): Promise<any[]> {
	// Defensive: if a table isn't available yet (e.g. a newly added schema table on
	// an instance that hasn't been restarted), treat it as empty rather than throwing
	// — a missing optional table must never break a full state read / refresh.
	if (!table || typeof table.search !== 'function') return [];
	// Full scan + filter instead of a secondary-index conditional search. The
	// indexed `playerId` search proved unreliable across Harper versions/cold
	// starts — it could return zero rows for a perfectly good save, which made
	// the world (placements, chests, terrain) load empty until the first action
	// "warmed" things up. A plain scan never depends on the index being ready,
	// and these per-player tables are tiny, so this is both correct and cheap.
	const rows = await toArray(table.search({}));
	return rows.filter((r: any) => r?.playerId === playerId);
}

/**
 * Reliable per-player lookup of a single record by id. Uses the same full scan
 * as byPlayer rather than a primary-key `.get()`, which proved unreliable on
 * cold Harper instances — a `.get()` could return null for a record that
 * genuinely exists, surfacing as "Placement not found" / unseen soil beds.
 */
async function findOwned(table: any, playerId: string, id: string): Promise<any | null> {
	const rows = await byPlayer(table, playerId);
	return rows.find((r: any) => r.id === id) || null;
}

// ----------------------------------------------------------------- worlds
// Shared, restorable world state (biomes, terrain, placements, animals,
// chests, feed) is owned by a World, not a player. Single-player is just a
// private "world of one" whose id equals the player's id, so legacy rows keyed
// by playerId already belong to it. `byWorld` matches a row's `worldId`, but
// falls back to `playerId` for rows written before this column existed — for a
// solo world those values are identical, so old saves keep working untouched.

/** The world a player is currently acting in. Defaults to their solo world (= their id). */
function worldOf(player: any): string {
	return player?.worldId || player?.id;
}

/** All rows belonging to one world (worldId, falling back to legacy playerId). */
async function byWorld(table: any, worldId: string): Promise<any[]> {
	if (!table || typeof table.search !== 'function') return [];
	const rows = await toArray(table.search({}));
	return rows.filter((r: any) => (r?.worldId ?? r?.playerId) === worldId);
}

/** Single record by id, scoped to one world. */
async function findInWorld(table: any, worldId: string, id: string): Promise<any | null> {
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.id === id) || null;
}

/** Short, unambiguous invite code (no 0/O/1/I to avoid confusion). */
function genJoinCode(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
	return out;
}

const DEFAULT_MAX_MEMBERS = 6;

/**
 * Ensure a player has a solo "world of one" and is a member of it. Idempotent:
 * safe to call on every login, which back-fills the World/WorldMember rows for
 * saves created before multiplayer existed. The solo world's id equals the
 * playerId, so all of that player's existing world-state rows already belong to
 * it without any re-keying.
 */
async function ensureSoloWorld(player: any, opts: { freshGrid?: boolean } = {}): Promise<void> {
	const t = db();
	const soloId = player.id;
	if (!(await t.World.get(soloId))) {
		await t.World.put({
			id: soloId,
			name: `${player.name || 'My'} preserve`,
			solo: true,
			ownerId: player.id,
			joinCode: null,
			createdAt: player.createdAt || Date.now(),
			maxMembers: 1,
			// brand-new saves are seeded at the shifted meadow coordinates already,
			// so the world starts aligned to the current camp offset; older worlds
			// omit these and get realigned by migrateMeadowWest below.
			meadowShift: opts.freshGrid ? MEADOW_SHIFT : 0,
			meadowShiftY: opts.freshGrid ? MEADOW_SHIFT_Y : 0,
		});
	}
	const memberId = `${soloId}:${player.id}`;
	if (!(await t.WorldMember.get(memberId))) {
		await t.WorldMember.put({
			id: memberId, worldId: soloId, playerId: player.id,
			role: 'owner', joinedAt: player.createdAt || Date.now(), lastSeenAt: Date.now(),
		});
	}
	if (!player.worldId) await t.Player.patch(player.id, { worldId: soloId });
	// realign an existing solo world's meadow to the current camp offset (no-op
	// for a just-created, already-aligned world)
	if (!opts.freshGrid) await migrateMeadowWest(soloId);
}

/** Every world a player belongs to, shaped for the client's world picker. */
async function listMemberships(playerId: string): Promise<any[]> {
	const t = db();
	const members = (await byPlayer(t.WorldMember, playerId));
	const out: any[] = [];
	for (const m of members) {
		const world = await t.World.get(m.worldId);
		if (!world) continue;
		const memberCount = (await byWorld(t.WorldMember, world.id)).length;
		out.push({
			worldId: world.id,
			name: world.name,
			solo: !!world.solo,
			role: m.role,
			joinCode: world.solo ? null : world.joinCode,
			memberCount,
			maxMembers: world.maxMembers || DEFAULT_MAX_MEMBERS,
			isOwner: world.ownerId === playerId,
		});
	}
	// solo first, then most-recently-joined co-op worlds
	return out.sort((a, b) => (a.solo === b.solo ? 0 : a.solo ? -1 : 1));
}

/**
 * A co-op member's set of unlocked biomes is the union of their own and every
 * biome the shared world has opened. Persisted on the player so the per-action
 * unlock gates (which read player.unlockedBiomes) admit areas a world-mate
 * restored. No-op for solo worlds. Call on login / world switch / join.
 */
async function syncMemberUnlocks(playerId: string, worldId: string): Promise<string[]> {
	const t = db();
	const player = await t.Player.get(playerId);
	if (!player) return [];
	const current: string[] = player.unlockedBiomes || ['meadow'];
	if (worldId === player.id) return current; // solo world — already authoritative
	const worldStates = await byWorld(t.BiomeState, worldId);
	const unlocked = new Set(current);
	for (const bs of worldStates) if (bs.unlocked) unlocked.add(bs.biomeId);
	const merged = [...unlocked];
	if (merged.length !== current.length) await t.Player.patch(playerId, { unlockedBiomes: merged });
	return merged;
}

/**
 * Reconcile seed tables against the definition JSON, deleting any DB records
 * whose id is no longer in the JSON (renamed or removed). Runs once per worker.
 * Without this, a renamed recipe/object leaves a stale duplicate in the table
 * (e.g. an old "Water Restoration Kit" alongside the new "Wetland Restoration
 * Kit"), because Harper's data loader only upserts and never deletes.
 */
let defsReconciled = false;
async function reconcileDefinitions() {
	if (defsReconciled) return;
	defsReconciled = true;
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
		for (const row of await toArray(table.search({}))) {
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
	const names = ['Player', 'BiomeState', 'Chest', 'Placement', 'Discovery', 'NodeState',
		'TerrainTile', 'FeedEntry', 'PlayerAchievement', 'WorldMember', 'World', 'WorldPresence', 'JoinRequest'];
	for (const name of names) {
		const table = t[name];
		if (!table || typeof table.search !== 'function') continue;
		// enumerate ids only — selecting just the primary key avoids decoding bodies
		const ids: string[] = [];
		try {
			for await (const r of table.search({ select: ['id'] })) if (r?.id != null) ids.push(r.id);
		} catch { continue; } // can't list ids cheaply; per-access safeGet still self-heals
		let purged = 0;
		for (const id of ids) {
			try {
				const rec = await table.get(id);
				if (rec) JSON.stringify({ ...rec }); // force the lazy decode
			} catch (e) {
				if (isDecodeError(e)) { if (await forceRemove(table, id)) purged++; }
			}
		}
		if (purged) console.error(`purgeCorruptRecords: removed ${purged} undecodable ${name} record(s)`);
	}
}

// Definition cache — definitions only change on deploy, so cache per worker.
let defsCache: any = null;
async function defs() {
	await reconcileDefinitions();
	if (!defsCache) {
		const t = db();
		const [biomes, animals, resources, recipes, objects, tools, achievements] = await Promise.all([
			allOf(t.Biome),
			allOf(t.Animal),
			allOf(t.ResourceType),
			allOf(t.Recipe),
			allOf(t.HabitatObject),
			allOf(t.ToolDef),
			allOf(t.Achievement),
		]);
		const index = (arr: any[]) => new Map(arr.map((r) => [r.id, r]));
		achievements.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
		defsCache = {
			biomes, animals, resources, recipes, objects, tools, achievements,
			biome: index(biomes), animal: index(animals), resource: index(resources),
			recipe: index(recipes), object: index(objects), tool: index(tools),
			achievement: index(achievements),
		};
	}
	return defsCache;
}

// ------------------------------------------------------------- constants

const NODE_REGEN_SECONDS = 75;
const BASE_HEALTH = 5;
// The grasshopper is always the first animal to return anywhere — the meadow's
// first sign of life — and every other animal is gated behind it (see recalcBiome).
const FIRST_ANIMAL_ID = 'grasshopper';
// How many activity-feed messages we keep per player (the feed is pruned to this
// on every append so the table never grows unbounded as people play).
const FEED_CAP = 100;

// ----------------------------------------------------------- the home
// A personal interior (area id 'home') you step into from your camp tent, decorate
// with indoor "camp comfort" items, and upgrade. The home upgrades along FOUR
// independent tracks (Space, Comfort, Furnishings, Warmth) — you can pour
// materials into whichever you like — and you can take it in one of TWO style
// directions (a warm Woodland Cabin or a bright Meadow Cottage) that restyle the
// floor and walls. Space sets the room size; Comfort is the functional perk (a
// flat carry-capacity bonus); Furnishings and Warmth add cosmetic flourishes.
// Each style is built from materials that suit it: a log cabin from wood, a cottage
// from fiber and flowers, a stone hearth from stone. All buildable from the meadow.
const HOME_BUILD_GATE = { biome: 'meadow', minHealth: 30 };
const HOME_STYLES: Record<string, { name: string; floor: string; wall: string; accent: string; materials: Record<string, number>; requires: { biome: string; minHealth: number } }> = {
	cabin: { name: 'Log Cabin', floor: '#c8a064', wall: '#5e3f29', accent: '#b5707a', materials: { branches: 16, fiber: 6 }, requires: HOME_BUILD_GATE }, // warm golden pine + dark logs
	cottage: { name: 'Meadow Cottage', floor: '#e6d3a6', wall: '#aab9c6', accent: '#7fae6a', materials: { wildflowers: 6, fiber: 10, clay: 4 }, requires: HOME_BUILD_GATE }, // pale wood + airy blue-grey + green
	stone: { name: 'Stone Hearth', floor: '#a9a499', wall: '#6f6a62', accent: '#d98a4f', materials: { stones: 14, clay: 6 }, requires: HOME_BUILD_GATE }, // slate floor + grey stone + hearth orange
};
const DEFAULT_HOME = { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };

// Each track is a list of levels (index 0 = level 1, free starter). Higher levels
// cost materials and a little biome progress.
const HOME_TRACKS: Record<string, { name: string; blurb: string; levels: any[] }> = {
	space: {
		name: 'Space', blurb: 'A bigger room with more floor to decorate.',
		levels: [
			{ inner: { w: 6, h: 5 } }, // tent
			{ inner: { w: 8, h: 6 }, materials: { branches: 12, fiber: 8 }, requires: { biome: 'meadow', minHealth: 30 } },
			{ inner: { w: 10, h: 7 }, materials: { branches: 18, stones: 6, clay: 6 }, requires: { biome: 'forest', minHealth: 45 } },
			{ inner: { w: 12, h: 9 }, materials: { branches: 24, clay: 10, 'clean-water': 6 }, requires: { biome: 'wetland', minHealth: 55 } },
		],
	},
	comfort: {
		name: 'Comfort', blurb: 'Carry more on every gathering trip (+capacity).',
		levels: [
			{ carry: 0 },
			{ carry: 45, materials: { fiber: 10, branches: 4 }, requires: { biome: 'meadow', minHealth: 35 } },
			{ carry: 95, materials: { fiber: 14, moss: 6 }, requires: { biome: 'forest', minHealth: 50 } },
			{ carry: 160, materials: { reeds: 10, fiber: 12 }, requires: { biome: 'wetland', minHealth: 60 } },
		],
	},
	decor: {
		name: 'Furnishings', blurb: 'A finer rug and wall trim in your style.',
		levels: [
			{},
			{ materials: { fiber: 8, wildflowers: 4 } },
			{ materials: { fiber: 12, berries: 6 }, requires: { biome: 'meadow', minHealth: 50 } },
			{ materials: { fiber: 16, clay: 6 }, requires: { biome: 'forest', minHealth: 55 } },
		],
	},
	light: {
		name: 'Warmth', blurb: 'Windows and a warm hearth glow.',
		levels: [
			{},
			{ materials: { branches: 6, stones: 4 } },
			{ materials: { stones: 8, clay: 4 }, requires: { biome: 'forest', minHealth: 45 } },
			{ materials: { clay: 6, 'clean-water': 4 }, requires: { biome: 'wetland', minHealth: 55 } },
		],
	},
};

/** Normalize a player's home config, migrating old linear `homeTier` saves. */
function homeOf(player: any) {
	if (player?.home) return { ...DEFAULT_HOME, ...player.home };
	const t = player?.homeTier || 1; // legacy: map the old single tier onto space + comfort
	return { ...DEFAULT_HOME, space: t, comfort: t, styleLocked: t > 1 };
}
const homeCarryBonus = (player: any) => HOME_TRACKS.comfort.levels[(homeOf(player).comfort || 1) - 1]?.carry || 0;

/** Interior floor rectangle (tile coords) for a player's home, centred in the grid. */
function homeRoom(player: any) {
	const inner = HOME_TRACKS.space.levels[(homeOf(player).space || 1) - 1]?.inner || { w: 8, h: 6 };
	const x0 = Math.floor((GRID_W - inner.w) / 2);
	const y0 = Math.floor((GRID_H - inner.h) / 2);
	return { x0, y0, x1: x0 + inner.w - 1, y1: y0 + inner.h - 1 };
}
// Chance that digging a fresh soil bed turns up a buried material (not every dig).
const DIG_FIND_CHANCE = 0.75;
const CAPACITY_BY_BASKET: Record<number, number> = { 1: 200, 2: 350, 3: 550, 4: 800 };

// New caretakers start empty-handed — the first task is to gather seeds and
// fiber for a Grass Patch, so the tutorial's opening loop has real stakes.
const START_INVENTORY: Record<string, number> = { water: 6, seeds: 2, wildflowers: 1 };
const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1, 'field-journal': 1 };

// Character appearance options (validated server-side; the frontend renders these)
// Preset swatches the creator offers as quick-picks. Colors are no longer
// restricted to this list — players can pick any color — so these are just
// suggestions surfaced in the UI.
const SKIN_TONES = ['#f6d7b8', '#eec39a', '#d9a06b', '#b97f50', '#8d5a3a', '#6b4226'];
const HAIR_COLORS = ['#3b2e25', '#6e4a33', '#a3692f', '#c9913f', '#d9b380', '#8c8c8c'];
const OUTFIT_COLORS = ['#4a7c59', '#7a9ac0', '#b5707a', '#c9913f', '#7d6b9e', '#5d8a8a'];
const HAT_STYLES = ['straw', 'leaf', 'beanie', 'cap', 'bucket', 'flower', 'party', 'ranger', 'mushroom', 'wizard', 'crown', 'bandana', 'none'];
// Suggested hat tints (any hex is accepted); null/absent hatColor = the hat's classic colors.
const HAT_COLORS = ['#c9a35c', '#b5707a', '#5f86b0', '#5d8a4a', '#7d6b9e', '#b05555'];
const HAIRSTYLES = ['short', 'bald', 'long', 'bob', 'curly', 'curly-long', 'bun', 'braid', 'ponytail', 'pigtails', 'afro', 'mohawk'];
const BEARD_STYLES = ['none', 'beard'];
const BODY_TYPES = ['slim', 'round'];

// Accept any standard #rgb or #rrggbb hex color; falls back to a default if the
// value isn't a valid color string.
function cleanHex(c: any, fallback: string): string {
	return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())
		? c.trim().toLowerCase()
		: fallback;
}

function sanitizeAppearance(a: any) {
	a = a || {};
	return {
		skin: cleanHex(a.skin, SKIN_TONES[1]),
		hair: cleanHex(a.hair, HAIR_COLORS[1]),
		outfit: cleanHex(a.outfit, OUTFIT_COLORS[0]),
		hat: HAT_STYLES.includes(a.hat) ? a.hat : 'straw',
		// null means "the hat's classic colors" — only a valid hex overrides it
		hatColor: typeof a.hatColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a.hatColor.trim()) ? a.hatColor.trim().toLowerCase() : null,
		hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : 'short',
		beard: BEARD_STYLES.includes(a.beard) ? a.beard : 'none',
		body: BODY_TYPES.includes(a.body) ? a.body : 'slim',
	};
}

/** Never send secrets back to the client. */
function sanitizePlayer(player: any) {
	if (!player) return player;
	const { passcode, passcodeHash, passcodeSalt, ...rest } = player;
	return rest;
}

// ----------------------------------------------------------- passcode hashing
// Passcodes are never stored in plaintext: each save keeps a random salt and a
// scrypt hash. Verification is constant-time. Legacy saves created before this
// (plaintext `passcode`) are transparently re-hashed on their next successful
// login and the plaintext field is dropped.
// @ts-ignore — node:crypto is provided by the Harper Node runtime (no @types/node here)
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function hashPasscode(passcode: string, salt?: string): { salt: string; hash: string } {
	const s = salt || randomBytes(16).toString('hex');
	const hash = scryptSync(String(passcode), s, 32).toString('hex');
	return { salt: s, hash };
}

/** Constant-time check of a passcode against a stored salt+hash. */
function checkHash(passcode: string, salt: string, hash: string): boolean {
	try {
		const B = (globalThis as any).Buffer;
		const got = scryptSync(String(passcode), salt, 32);
		const want = B.from(hash, 'hex');
		return got.length === want.length && timingSafeEqual(got, want);
	} catch {
		return false;
	}
}

/**
 * Verify a save's passcode. Returns true/false. If the save is still on a
 * legacy plaintext passcode and it matches, it is upgraded to a salted hash in
 * place (and the plaintext removed) so secrets stop living in the database.
 */
async function verifyPasscode(player: any, passcode: string): Promise<boolean> {
	const code = String(passcode || '');
	if (player.passcodeHash && player.passcodeSalt) {
		return checkHash(code, player.passcodeSalt, player.passcodeHash);
	}
	// legacy plaintext save — verify then migrate to a hash
	if (typeof player.passcode === 'string' && code.length > 0 && code === player.passcode) {
		const { salt, hash } = hashPasscode(code);
		await db().Player.patch(player.id, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return true;
	}
	return false;
}

function slugId(name: string): string {
	return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Starter base camp: tent + campfire scenery with a storage chest. Crafting
// needs no station — it works anywhere, from the basket plus any chests.
const STARTER_CHEST = { x: 23, y: 5, size: 'small-chest', capacity: 120 };

// The camp keeps its exact main-branch arrangement, shifted MEADOW_SHIFT tiles
// east so a wide strip of wild land opens to its WEST — enough that the house
// sits roughly centered on screen and you can walk out west of it. Nothing from
// main moved relative to the rest of the meadow (the run east to the forest gate
// is unchanged); the new land is purely added on the west. No vertical shift.
const MEADOW_SHIFT = 14;
const MEADOW_SHIFT_Y = 0;

/**
 * Save migration that keeps a world's meadow aligned with the current camp
 * offset (MEADOW_SHIFT east, MEADOW_SHIFT_Y south). It stores how far a world's
 * meadow has already been shifted (`world.meadowShift` / `world.meadowShiftY`)
 * and moves every meadow row (placements, terrain, chests) and every member
 * standing in the meadow by the DIFFERENCE to reach the current offset — so it's
 * self-correcting if the offset is ever retuned, and a no-op once a world is
 * already aligned. Worlds without the numeric fields are treated as main-branch
 * baseline (0). Brand-new worlds are created already aligned (their camp is
 * seeded at the shifted coordinates).
 */
async function migrateMeadowWest(wid: string): Promise<boolean> {
	const t = db();
	const world = await safeGet(t.World, wid);
	const applied = typeof world?.meadowShift === 'number' ? world.meadowShift : 0;
	const appliedY = typeof world?.meadowShiftY === 'number' ? world.meadowShiftY : 0;
	const delta = MEADOW_SHIFT - applied;
	const deltaY = MEADOW_SHIFT_Y - appliedY;
	if (delta !== 0 || deltaY !== 0) {
		for (const table of [t.Placement, t.TerrainTile, t.Chest]) {
			for (const row of await byWorld(table, wid)) {
				if (row.area !== 'meadow') continue;
				await table.patch(row.id, { x: (Number(row.x) || 0) + delta, y: (Number(row.y) || 0) + deltaY });
			}
		}
		// every member standing in the meadow moves with their camp (read fresh
		// from the DB so we never shift a stale in-memory position)
		for (const m of await byWorld(t.WorldMember, wid)) {
			const p = await safeGet(t.Player, m.playerId);
			if (p?.area === 'meadow' && worldOf(p) === wid) {
				await t.Player.patch(p.id, { x: (Number(p.x) || 0) + delta, y: (Number(p.y) || 0) + deltaY });
			}
		}
	}
	if (world && (applied !== MEADOW_SHIFT || appliedY !== MEADOW_SHIFT_Y)) await t.World.patch(wid, { meadowShift: MEADOW_SHIFT, meadowShiftY: MEADOW_SHIFT_Y });
	return delta !== 0 || deltaY !== 0;
}

// ------------------------------------------------------------ player setup

/** Load an existing player or fail — creation only happens via /CreatePlayer/. */
async function requirePlayer(playerId: string): Promise<any> {
	if (!playerId || typeof playerId !== 'string') throw new GameError('playerId required');
	const player = await safeGet(db().Player, playerId);
	if (!player) throw new GameError('No save found — please log in again', 404);
	return { player };
}

// --------------------------------------------------------------- metrics
// Lightweight per-player analytics, stored as a `metrics` blob on the Player
// record. Action counters are bumped from the relevant endpoints; play time
// and session counts are accrued from client heartbeats (see Heartbeat).
// Surfaced for dashboards via the read-only Metrics endpoint.

function freshMetrics(now: number) {
	return {
		firstSeenAt: now,
		lastSeenAt: now,
		lastHeartbeatAt: 0,
		playSeconds: 0,
		sessions: 0,
		counts: {} as Record<string, number>,
	};
}

/**
 * Merge action-count deltas into player.metrics and persist. `player` is the
 * record we already loaded (counters live in their own key, so this never
 * clobbers a concurrent inventory/crafted patch). No-ops if nothing to add.
 *
 * `dailyDeltas` additionally bumps the player's per-day counters (player.daily
 * = { dayKey, counts }), which power the daily task board. The day bucket
 * rolls over automatically the first time it's bumped on a new UTC day — no
 * background job needed, and reads just ignore a stale bucket.
 */
async function bumpMetrics(player: any, deltas: Record<string, number> = {}, dailyDeltas: Record<string, number> = {}): Promise<any> {
	if (!player?.id) return null;
	const entries = Object.entries(deltas).filter(([, v]) => v);
	const dailyEntries = Object.entries(dailyDeltas).filter(([, v]) => v);
	if (!entries.length && !dailyEntries.length) return player.metrics || null;
	const now = Date.now();
	const prev = player.metrics || freshMetrics(player.createdAt || now);
	const counts = { ...(prev.counts || {}) };
	for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
	const metrics = { ...prev, counts, lastSeenAt: now };
	const patch: any = { metrics };
	if (dailyEntries.length) {
		const dayKey = Math.floor(now / DAY_MS);
		const prevDaily = player.daily?.dayKey === dayKey ? player.daily : { dayKey, counts: {} };
		const dcounts = { ...(prevDaily.counts || {}) };
		for (const [k, v] of dailyEntries) dcounts[k] = (dcounts[k] || 0) + v;
		patch.daily = { dayKey, counts: dcounts };
	}
	await db().Player.patch(player.id, patch);
	return metrics;
}

/** Shape the stored metrics into a tidy, derived view for the Metrics endpoint. */
const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function metricsView(player: any) {
	const now = Date.now();
	const m = player.metrics || freshMetrics(player.createdAt || now);
	const playSeconds = m.playSeconds || 0;
	const sessions = m.sessions || 0;
	const counts: Record<string, number> = m.counts || {};
	const totalActions = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
	const createdAt = player.createdAt || m.firstSeenAt || now;
	const lastSeenAt = m.lastSeenAt || null;

	// Recency drives the engagement picture: how long ago did they last play,
	// and how should we bucket them (active / recent / dormant).
	const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
	const daysSinceJoined = Math.floor((now - createdAt) / DAY_MS);
	let status: 'active' | 'recent' | 'dormant' = 'dormant';
	if (hoursSinceActive != null) {
		if (hoursSinceActive <= 24) status = 'active';
		else if (hoursSinceActive <= 24 * 7) status = 'recent';
	}

	return {
		playerId: player.id,
		name: player.name,
		createdAt,
		firstSeenAt: m.firstSeenAt || createdAt,
		lastSeenAt,
		daysSinceJoined,
		hoursSinceActive,
		status,
		isNewToday: now - createdAt <= DAY_MS,
		// time + sessions
		sessions,
		playSeconds,
		playMinutes: Math.round(playSeconds / 60),
		avgSessionMinutes: sessions ? Math.round(playSeconds / 60 / sessions) : 0,
		// engagement intensity
		totalActions,
		actionsPerSession: sessions ? round1(totalActions / sessions) : 0,
		actionsPerMinute: playSeconds > 0 ? round1(totalActions / (playSeconds / 60)) : 0,
		// where they are in the game
		tutorialStep: player.tutorialStep || 0,
		currentArea: player.area || null,
		unlockedBiomes: (player.unlockedBiomes || []).length,
		counts,
	};
}

/**
 * Activation funnel flags for one player. Uses durable state where available
 * (craftedEver, unlocked biomes, animals returned) so players who progressed
 * before action-counting existed still register on the funnel.
 */
function activationFlags(view: any, biomeSummary: any, player: any) {
	const c = view.counts || {};
	return {
		collected: (c.resourcesCollected || 0) > 0,
		crafted: (c.itemsCrafted || 0) > 0 || Object.keys(player.craftedEver || {}).length > 0,
		placed: (c.objectsPlaced || 0) > 0,
		attractedAnimal: (biomeSummary?.totalAnimalsReturned || 0) > 0,
		unlockedSecondBiome: (view.unlockedBiomes || 0) >= 2,
	};
}

// --------------------------------------------------- biome health + snapshots
// Per-biome restoration metrics, plus an on-the-fly SVG "postcard" of what each
// area currently looks like (ground tinted by health, terrain beds, and every
// placed object as a colored marker), returned as a base64 data URI so it drops
// straight into an <img src> or a dashboard.

const GRID_W = 30; // base grid (home interior / fallback) — matches OUT_W in the client
const GRID_H = 20; // matches OUT_H
const ALPINE_MTN_ROWS = 4; // impassable band the client adds above the alpine's playable grid

/**
 * Placement bounds for an area. Biomes carry their own playable grid in
 * data/biomes.json (`grid`) — the meadow is the biggest — and the alpine adds
 * its mountain band on top, growing the world downward. The home interior
 * stays on the base grid (its floor rect is validated separately anyway).
 */
function areaGrid(d: any, area: string): { cols: number; rows: number } {
	const g = area === 'home' ? null : d.biome.get(area)?.grid;
	const cols = g?.cols || GRID_W;
	const rows = (g?.rows || GRID_H) + (area === 'alpine' ? ALPINE_MTN_ROWS : 0);
	return { cols, rows };
}

const TERRAIN_COLORS: Record<string, string> = {
	tilled: '#8a6a48',
	watered: '#6b4f33',
	water: '#5d96c8',
};

/** Linear blend between two #rrggbb colors (t = 0 → a, 1 → b). */
function lerpHex(a: string, b: string, t: number): string {
	const pa = parseInt(a.slice(1), 16);
	const pb = parseInt(b.slice(1), 16);
	const mix = (sh: number) => {
		const ca = (pa >> sh) & 255;
		const cb = (pb >> sh) & 255;
		return Math.round(ca + (cb - ca) * clamp(t, 0, 1));
	};
	return '#' + [mix(16), mix(8), mix(0)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

const svgEscape = (s: string) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render a top-down schematic of one area as an SVG string. */
function renderBiomeSVG(d: any, biome: any, health: number, placements: any[], terrain: any[]): string {
	const cell = 16;
	const pad = 8;
	const labelH = 22;
	const grid = areaGrid(d, biome?.id || '');
	const W = grid.cols * cell + pad * 2;
	const H = grid.rows * cell + pad * 2 + labelH;
	const damaged = biome?.palette?.damaged || '#b9a37c';
	const healthy = biome?.palette?.healthy || '#8fbf6f';
	const ground = lerpHex(damaged, healthy, health / 100);
	const groundDark = lerpHex(damaged, healthy, (health / 100) * 0.8);
	const px = (x: number) => pad + x * cell;
	const py = (y: number) => pad + y * cell;

	const parts: string[] = [];
	parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${ground}"/>`);
	// faint checkerboard for a bit of ground texture
	for (let gy = 0; gy < grid.rows; gy++) {
		for (let gx = 0; gx < grid.cols; gx++) {
			if ((gx + gy) % 2 === 0) {
				parts.push(`<rect x="${px(gx)}" y="${py(gy)}" width="${cell}" height="${cell}" fill="${groundDark}" opacity="0.22"/>`);
			}
		}
	}
	for (const tt of terrain) {
		const c = TERRAIN_COLORS[tt.type];
		if (!c) continue;
		parts.push(`<rect x="${px(tt.x)}" y="${py(tt.y)}" width="${cell}" height="${cell}" rx="3" fill="${c}"/>`);
	}
	for (const p of placements) {
		const def = d.object.get(p.objectId);
		const c = def?.color || '#6b5a3a';
		parts.push(
			`<circle cx="${px(p.x) + cell / 2}" cy="${py(p.y) + cell / 2}" r="${cell * 0.42}" fill="${c}" stroke="#2b3321" stroke-opacity="0.35"/>`,
		);
	}
	parts.push(`<rect x="0" y="${H - labelH}" width="${W}" height="${labelH}" fill="#2b3321" opacity="0.55"/>`);
	parts.push(
		`<text x="${pad}" y="${H - 7}" font-family="sans-serif" font-size="12" fill="#fdfaf0">${svgEscape(biome?.name || 'Area')} — ${health}% health · ${placements.length} placed</text>`,
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function svgDataUri(svg: string): string {
	// Buffer is a Node global in the Harper runtime; reach it via globalThis so
	// we don't need @types/node just for this.
	const B = (globalThis as any).Buffer;
	return 'data:image/svg+xml;base64,' + B.from(svg, 'utf8').toString('base64');
}

/**
 * Gather per-biome restoration metrics for a player. With `images: true` each
 * unlocked biome also gets a `snapshot` data URI rendered from its current
 * placements and terrain.
 */
async function biomeMetrics(playerId: string, opts: { images?: boolean } = {}) {
	const t = db();
	const d = await defs();
	const states = await byPlayer(t.BiomeState, playerId);
	const byId = new Map(states.map((s) => [s.biomeId, s]));
	const placements = opts.images ? await byPlayer(t.Placement, playerId) : [];
	const terrain = opts.images ? await byPlayer(t.TerrainTile, playerId) : [];

	const biomes = d.biomes.map((b: any) => {
		const s: any = byId.get(b.id) || {};
		const entry: any = {
			biomeId: b.id,
			name: b.name,
			health: s.health || 0,
			balance: s.balance || 0,
			returnedCount: s.returnedCount || 0,
			unlocked: !!s.unlocked,
			explorable: !!b.explorable,
		};
		if (opts.images && s.unlocked) {
			const pls = placements.filter((p) => p.area === b.id);
			const ter = terrain.filter((tt) => tt.area === b.id);
			entry.placements = pls.length;
			entry.snapshot = svgDataUri(renderBiomeSVG(d, b, entry.health, pls, ter));
		}
		return entry;
	});

	return { biomes, summary: summarizeBiomes(biomes) };
}

/** Roll up a set of biome rows into headline restoration numbers. */
function summarizeBiomes(rows: any[]) {
	const unlocked = rows.filter((r) => r.unlocked);
	return {
		biomesUnlocked: unlocked.length,
		biomesFullyRestored: unlocked.filter((r) => (r.health || 0) >= 100).length,
		avgHealth: unlocked.length ? Math.round(unlocked.reduce((a, r) => a + (r.health || 0), 0) / unlocked.length) : 0,
		totalAnimalsReturned: rows.reduce((a, r) => a + (r.returnedCount || 0), 0),
	};
}

/**
 * Create a brand-new player with starter home, chest, and biome states.
 * Returns the records just written, because conditional searches within the
 * same transaction will not see them yet.
 */
async function createPlayerRecords(playerId: string, name: string, passcode: string, appearance: any): Promise<any> {
	const t = db();
	const d = await defs();
	const now = Date.now();
	const { salt, hash } = hashPasscode(passcode);
	const player = {
		id: playerId,
		name,
		passcodeSalt: salt,
		passcodeHash: hash,
		appearance,
		createdAt: now,
		worldId: playerId, // start in your own private solo world (world of one)
		area: 'meadow',
		x: 24.5, // spawn right beside the camp workbench
		y: 6.5,
		inventory: { ...START_INVENTORY },
		craftedItems: {},
		tools: { ...START_TOOLS },
		unlockedBiomes: ['meadow'],
		visitedBiomes: ['meadow'], // areas walked into at least once (enables fast-travel)
		tutorialStep: 0,
		home: { ...DEFAULT_HOME }, // your camp tent — upgrade it along four tracks, in two styles
		metrics: freshMetrics(now),
	};
	await t.Player.put(player);

	// A new player begins in their own private solo world (id === playerId), so
	// every seeded row is stamped with that worldId from the start.
	const wid = playerId;
	const biomeStates = d.biomes.map((b: any) => ({
		id: `${wid}:${b.id}`,
		worldId: wid,
		playerId,
		biomeId: b.id,
		health: BASE_HEALTH,
		balance: 0,
		returnedCount: 0,
		unlocked: b.id === 'meadow',
	}));
	for (const bs of biomeStates) await t.BiomeState.put(bs);

	const chestPlacementId = `pl_${playerId}_starter-chest`;
	const placements = [
		{
			id: chestPlacementId, worldId: wid, playerId, objectId: 'small-chest',
			area: 'meadow', x: STARTER_CHEST.x, y: STARTER_CHEST.y, placedAt: now,
		},
	];
	for (const p of placements) await t.Placement.put(p);

	const chest = {
		id: chestPlacementId, worldId: wid, playerId, area: 'meadow',
		x: STARTER_CHEST.x, y: STARTER_CHEST.y,
		size: 'small-chest', capacity: STARTER_CHEST.capacity, contents: {},
	};
	await t.Chest.put(chest);

	return { player, seeded: { biomeStates, placements, chests: [chest] } };
}

/** Full state snapshot built from freshly created records (first login). */
async function freshSnapshot(created: any) {
	const now = Date.now();
	const d = await defs();
	const worldId = created.player?.worldId || created.player?.id;
	const wxTime = weatherTimeFromPlay(created.player);
	return {
		player: sanitizePlayer(created.player),
		biomeStates: created.seeded.biomeStates,
		placements: created.seeded.placements,
		chests: created.seeded.chests,
		discoveries: [],
		nodeStates: [],
		terrain: [],
		achievements: [],
		feed: [],
		serverTime: now,
		weather: weatherSnapshot(worldId, wxTime, WEATHER_BIOME_IDS),
		dailyTasks: dailyTasksBlock(worldId, created.player, d, 0, now),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(created.player),
	};
}

function inventoryCapacity(player: any): number {
	const tier = player.tools?.basket || 1;
	// home upgrades add a flat carry bonus on top of the basket tier (functional perk)
	return (CAPACITY_BY_BASKET[tier] || 200) + homeCarryBonus(player);
}

// ----------------------------------------------- biome health & animal logic

/**
 * Count placed objects for animal-return requirements. A plant that is still
 * growing in (planted less than its growSeconds ago) does NOT count yet — an
 * animal only returns once the habitat it needs has actually matured. Pass `d`
 * to enable this gating; without it, every placement counts.
 */
function placementCounts(placements: any[], d?: any): Record<string, number> {
	const now = Date.now();
	const counts: Record<string, number> = {};
	for (const p of placements) {
		if (d && p.plantedAt) {
			const def = d.object.get(p.objectId);
			const growMs = (def?.growSeconds || 0) * 1000;
			if (growMs > 0 && now - p.plantedAt < growMs) continue; // still a sprout — not mature habitat yet
		}
		counts[p.objectId] = (counts[p.objectId] || 0) + 1;
	}
	return counts;
}

// Diminishing-returns curve for biome health. Restoration points come from
// placed objects, open water, and watered beds, but each additional percentage
// point of health is harder to earn than the last — a damaged preserve heals
// quickly at first and then slowly, so the final stretch to a thriving habitat
// takes real, sustained work. Tune HEALTH_SCALE up to make recovery even slower.
const HEALTH_SCALE = 90;

function healthFromPoints(points: number): number {
	const recovered = (100 - BASE_HEALTH) * (1 - Math.exp(-Math.max(0, points) / HEALTH_SCALE));
	return clamp(Math.round(BASE_HEALTH + recovered), 0, 100);
}

// ---- habitat growth over real time -----------------------------------------
// Living habitat (trees, shrubs, flower patches…) keeps growing after it's
// placed — in real wall-clock hours, whether or not the game is open. A mature
// plant contributes bonus restoration points, so a preserve is literally
// healthier when you come back to it. Defs opt in via `matureHours` (+
// `matureBonus` points once grown). Everything derives from the placement's
// own placedAt timestamp: no background tick, no stored growth state.

/** ms until this placement is fully grown (0 = grows instantly / not a grower). */
function matureMs(def: any): number {
	return (def?.matureHours || 0) * 3_600_000;
}

/** True once a placement has been in the ground long enough to mature. */
function isMature(def: any, p: any, now: number): boolean {
	const ms = matureMs(def);
	return ms > 0 && now - (p.placedAt || 0) >= ms;
}

/** True if the placement crossed its maturity threshold inside (a, b]. */
function maturedBetween(def: any, p: any, a: number, b: number): boolean {
	const ms = matureMs(def);
	if (ms <= 0) return false;
	const at = (p.placedAt || 0) + ms;
	return at > a && at <= b;
}

// Growth is a gentle bonus, not a shortcut: the total restoration points a
// biome can earn from matured habitat is capped, so leaving the game closed
// never does the real work of restoring the land — it just rewards patience.
const MATURE_POINTS_CAP = 8;

/** Raw restoration points from everything placed/shaped in a biome. */
function computeHealthPoints(d: any, placements: any[], openWaterTiles = 0, now = Date.now()): number {
	let points = 0;
	let maturePoints = 0;
	for (const p of placements) {
		const def = d.object.get(p.objectId);
		if (!def) continue;
		points += def.healthValue || 0;
		// fully grown living habitat is worth a little more than the day it went in
		if (isMature(def, p, now)) maturePoints += def.matureBonus || 0;
	}
	points += Math.min(maturePoints, MATURE_POINTS_CAP);
	// shovel-shaped ponds/lakes/rivers: each open-water tile is real water habitat
	if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
	return points;
}

/**
 * Ecological balance measures how COMPLETE the food web is — not just how many
 * animals are back, but whether the recovered community is a working, balanced
 * ecosystem. Three signals, all 0..1:
 *   - return    : fraction of the biome's animals that have returned (life is back)
 *   - web       : fraction of the biome's predators / top-of-chain species back
 *                 (these depend on prey, so they only return once the chain below
 *                 them is in place — a biome of herbivores with no predators reads
 *                 as unbalanced, exactly as it should)
 *   - breadth   : fraction of animal *kinds* represented (insects, birds, mammals,
 *                 reptiles, amphibians, fish… — a varied web, not one trophic level)
 * By design balance CANNOT reach 100% until every animal in the biome is back.
 */
const BALANCE_RETURN_WEIGHT = 0.45;
const BALANCE_WEB_WEIGHT = 0.35;
const BALANCE_BREADTH_WEIGHT = 0.20;

function computeBalance(d: any, biomeId: string, returnedIds: Set<string>): number {
	const animals = d.animals.filter((a: any) => a.biome === biomeId);
	const total = animals.length;
	if (total === 0) return 0;
	const back = animals.filter((a: any) => returnedIds.has(a.id));
	if (back.length >= total) return 100; // every animal back = a perfectly balanced ecosystem

	const returnFrac = back.length / total;

	// predators / keystone species depend on other animals (a real food chain)
	const predators = animals.filter((a: any) => (a.requirements?.animals || []).length > 0);
	const predatorsBack = predators.filter((a: any) => returnedIds.has(a.id)).length;
	const webFrac = predators.length ? predatorsBack / predators.length : 1;

	// trophic breadth — how many different kinds of animal are represented
	const kindsAll = new Set(animals.map((a: any) => a.kind));
	const kindsBack = new Set(back.map((a: any) => a.kind));
	const breadthFrac = kindsAll.size ? kindsBack.size / kindsAll.size : 0;

	const raw = BALANCE_RETURN_WEIGHT * returnFrac + BALANCE_WEB_WEIGHT * webFrac + BALANCE_BREADTH_WEIGHT * breadthFrac;
	return clamp(Math.round(raw * 100), 0, 99); // never 100 until the last animal returns
}

/**
 * Analyze the player's open-water tiles (terraformed type 'water') in a biome.
 * Returns total tile count, the largest connected body ("lake"), and the
 * longest connected span ("river") — long, thin channels score high on river,
 * big blobs score high on lake. 4-neighbour connectivity.
 */
function analyzeWater(terrain: any[]) {
	const cells = new Set(terrain.filter((t) => t.type === 'water').map((t) => `${t.x},${t.y}`));
	const seen = new Set<string>();
	let lake = 0;
	let river = 0;
	for (const key of cells) {
		if (seen.has(key)) continue;
		const stack = [key];
		seen.add(key);
		let size = 0;
		let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
		while (stack.length) {
			const [x, y] = stack.pop()!.split(',').map(Number);
			size++;
			minx = Math.min(minx, x); maxx = Math.max(maxx, x);
			miny = Math.min(miny, y); maxy = Math.max(maxy, y);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nk = `${x + dx},${y + dy}`;
				if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
			}
		}
		lake = Math.max(lake, size);
		river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
	}
	return { tiles: cells.size, lake, river };
}

/** The live weather/season/day-phase context an animal's `conditions` are tested against. */
interface WxContext {
	type: string;
	season: string;
	dayPhase: string;
}

/**
 * Some rare animals only venture out under the right sky: `conditions` on an
 * animal's requirements gates its RETURN on the live weather/season/day-phase
 * (any listed value matches). The habitat can be perfect, but a storm-loving
 * heron still waits for the storm — so there's always a reason to come back
 * in different weather, seasons, and times of day.
 */
function meetsConditions(animal: any, wx: WxContext | null): boolean {
	const cond = animal.requirements?.conditions;
	if (!cond) return true;
	if (!wx) return false; // can't verify the sky → the rare visitor waits
	if (Array.isArray(cond.weather) && cond.weather.length && !cond.weather.includes(wx.type)) return false;
	if (Array.isArray(cond.season) && cond.season.length && !cond.season.includes(wx.season)) return false;
	if (Array.isArray(cond.dayPhase) && cond.dayPhase.length && !cond.dayPhase.includes(wx.dayPhase)) return false;
	return true;
}

function meetsRequirements(
	animal: any,
	health: number,
	balance: number,
	counts: Record<string, number>,
	returnedIds: Set<string>,
	water: { tiles: number; lake: number; river: number },
	wx: WxContext | null = null,
) {
	const req = animal.requirements || {};
	if (health < (req.minHealth || 0)) return false;
	if (balance < (req.minBalance || 0)) return false;
	if (!meetsConditions(animal, wx)) return false;
	for (const [objectId, qty] of Object.entries(req.objects || {})) {
		if ((counts[objectId] || 0) < (qty as number)) return false;
	}
	for (const other of req.animals || []) {
		if (!returnedIds.has(other)) return false;
	}
	// open-water needs are met by terraforming channels and ponds
	const w = req.water;
	if (w) {
		if ((water.tiles || 0) < (w.tiles || 0)) return false;
		if ((water.lake || 0) < (w.lake || 0)) return false;
		if ((water.river || 0) < (w.river || 0)) return false;
	}
	return true;
}

/**
 * Comfort is earned through play: an animal settles in as you place MORE of
 * the habitat it likes. Meeting its bare needs makes it merely Settled (~60);
 * every extra copy of a liked object beyond that adds comfort with gentle
 * diminishing returns, so a lovingly over-built habitat is what gets an animal
 * to Thriving (90+). Losing a required piece hurts badly — the animal becomes
 * rarely seen (but is never gone). Recomputed on every biome recalc, so it
 * always reflects what's actually standing in the world.
 */
function computeComfort(animal: any, counts: Record<string, number>): number {
	const req = animal.requirements?.objects || {};
	const liked = Object.keys(req);
	if (!liked.length) return 70; // nothing in particular it needs — content by default
	let comfort = 30;
	let missing = 0;
	let extras = 0;
	for (const [objectId, qty] of Object.entries(req)) {
		const have = counts[objectId] || 0;
		if (have >= (qty as number)) {
			comfort += Math.round(30 / liked.length); // all needs met → Settled (~60)
			extras += have - (qty as number);
		} else {
			missing++;
		}
	}
	// every extra liked thing helps, with diminishing returns (up to +40)
	comfort += Math.round(40 * (1 - Math.exp(-extras / 6)));
	comfort -= missing * 25;
	return clamp(comfort, 5, 100);
}

function whyReturnedText(animal: any, d: any): string {
	const req = animal.requirements || {};
	const parts: string[] = [];
	const objs = Object.entries(req.objects || {}).map(([id, q]) => `${q}× ${d.object.get(id)?.name || id}`);
	if (objs.length) parts.push(`habitat in place (${objs.join(', ')})`);
	if (req.water) {
		const w = req.water;
		if (w.lake) parts.push(`a lake of ${w.lake}+ open-water tiles`);
		else if (w.river) parts.push(`a river ${w.river}+ tiles long`);
		else if (w.tiles) parts.push(`${w.tiles}+ open-water tiles`);
	}
	if (req.minHealth) parts.push(`biome health reached ${req.minHealth}%`);
	if (req.minBalance) parts.push(`ecological balance reached ${req.minBalance}%`);
	if (req.animals?.length) parts.push(`${req.animals.map((a: string) => d.animal.get(a)?.name || a).join(' and ')} had already returned`);
	const cond = req.conditions;
	if (cond) {
		const bits: string[] = [];
		if (cond.weather?.length) bits.push(cond.weather.join(' or '));
		if (cond.season?.length) bits.push(`in ${cond.season.join(' or ')}`);
		if (cond.dayPhase?.length) bits.push(`at ${cond.dayPhase.join(' or ')}`);
		if (bits.length) parts.push(`the moment was right (${bits.join(', ')})`);
	}
	return `Felt safe enough to return once ${parts.join(', ')}.`;
}

/**
 * Recalculate biome health, ecological balance, animal returns, comfort
 * levels, and biome unlocks for one player+biome. Returns what changed.
 *
 * `opts.addPlacements` / `opts.removeIds` let callers include writes made
 * earlier in the same request, since conditional searches inside one
 * transaction do not see that transaction's own writes yet.
 */
async function recalcBiome(
	wid: string,
	playerId: string,
	biomeId: string,
	opts: { addPlacements?: any[]; removeIds?: string[]; player?: any; addTerrain?: any[]; removeTerrainIds?: string[] } = {}
) {
	const t = db();
	const d = await defs();
	if (!d.biome.get(biomeId)) throw new GameError(`Unknown biome: ${biomeId}`);

	let placements = (await byWorld(t.Placement, wid)).filter((p) => p.area === biomeId);
	if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds!.includes(p.id));
	for (const ap of opts.addPlacements || []) {
		if (ap.area !== biomeId) continue;
		// replace (not skip) any same-id row: in-transaction searches can return the
		// pre-write version of a record this request just changed
		placements = placements.filter((p) => p.id !== ap.id);
		placements.push(ap);
	}
	const counts = placementCounts(placements, d);

	// terraformed ground: each watered bed adds +1 health (capped) — tending the
	// soil itself matters, not just the objects on it
	let terrain = (await byWorld(t.TerrainTile, wid)).filter((tt) => tt.area === biomeId);
	if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds!.includes(tt.id));
	for (const at of opts.addTerrain || []) {
		if (at.area !== biomeId) continue;
		// replace stale same-id rows so type changes (tilled -> watered -> water)
		// count immediately within the request that made them
		terrain = terrain.filter((tt) => tt.id !== at.id);
		terrain.push(at);
	}
	const wateredTiles = Math.min(10, terrain.filter((tt) => tt.type === 'watered').length);
	const openWaterTiles = terrain.filter((tt) => tt.type === 'water').length;
	// rivers and lakes shaped with the watering can feed water-dwelling animals
	const water = analyzeWater(terrain);

	// tended soil beds are worth 1 restoration point each, on the same slow curve
	const now = Date.now();
	const healthPoints = computeHealthPoints(d, placements, openWaterTiles, now) + wateredTiles;
	const health = healthFromPoints(healthPoints);

	// Live sky for condition-gated rare animals: derived from the acting player's
	// play-time clock, same as the weather snapshot and weather-gated gathering.
	const actor = opts.player || (await safeGet(t.Player, playerId));
	const wxTime = actor ? weatherTimeFromPlay(actor) : null;
	const wx: WxContext | null = wxTime === null ? null : {
		type: weatherTypeAt(wid, biomeId, wxTime),
		season: seasonAt(wxTime),
		dayPhase: dayPhaseAt(wxTime),
	};

	const discoveries = await byWorld(t.Discovery, wid);
	const returnedIds = new Set(discoveries.map((x) => x.animalId));

	// Balance tracks food-web completeness, recomputed as each animal comes back so
	// food-web chains can keep unlocking the rest.
	let balance = computeBalance(d, biomeId, returnedIds);

	// Animal returns — animals come back only when the habitat truly supports them.
	// One habitat = one animal: at most a single new animal returns per change, so
	// building out a biome brings visitors back one at a time rather than summoning
	// a whole swarm at once. Food-web chains resolve over subsequent actions.
	const newAnimals: any[] = [];
	const biomeAnimals = d.animals.filter((a: any) => a.biome === biomeId);
	// The grasshopper must be the very first animal to come home — the meadow's
	// first sign of life. Every other animal, in every biome, is gated behind it.
	const firstAnimalBack = returnedIds.has(FIRST_ANIMAL_ID);
	for (const animal of biomeAnimals) {
		if (returnedIds.has(animal.id)) continue;
		// nothing else returns until the grasshopper has
		if (!firstAnimalBack && animal.id !== FIRST_ANIMAL_ID) continue;
		if (meetsRequirements(animal, health, balance, counts, returnedIds, water, wx)) {
			const disc = {
				id: `${wid}:${animal.id}`,
				worldId: wid,
				playerId,
				animalId: animal.id,
				biomeId,
				comfort: computeComfort(animal, counts),
				timesObserved: 0,
				firstObservedAt: Date.now(),
				whyReturned: whyReturnedText(animal, d),
			};
			await t.Discovery.put(disc);
			returnedIds.add(animal.id);
			balance = computeBalance(d, biomeId, returnedIds); // more life back -> more balance
			newAnimals.push({ ...disc, animal });
			break;
		}
	}

	// Comfort drifts with habitat quality. Removing key habitat lowers comfort
	// (animals become "rarely seen") but they are never owned or lost like pets.
	for (const disc of discoveries) {
		if (disc.biomeId !== biomeId) continue;
		const animal = d.animal.get(disc.animalId);
		if (!animal) continue;
		const comfort = computeComfort(animal, counts);
		if (comfort !== disc.comfort) await t.Discovery.patch(disc.id, { comfort });
	}

	const returnedCount = [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
	const prior = await findInWorld(t.BiomeState, wid, `${wid}:${biomeId}`);
	await t.BiomeState.patch(`${wid}:${biomeId}`, { health, balance, returnedCount });
	const biomeState = {
		...(prior || { id: `${wid}:${biomeId}`, worldId: wid, playerId, biomeId, unlocked: biomeId === 'meadow' }),
		health, balance, returnedCount,
	};

	const unlockedBiomes = await checkUnlocks(wid, playerId, { player: opts.player, freshState: biomeState });
	return { biomeState, newAnimals, unlockedBiomes };
}

// Areas that begin partly shaped when first unlocked. Rushwater Wetland opens
// with channels and a pond already terraformed, so it reads as a wetland the
// moment you arrive — and gives the river/lake animals something to build on.
const STARTING_TERRAIN: Record<string, { x: number; y: number; type: string }[]> = {
	wetland: [
		// a winding river across the north
		...[6, 7, 8, 9, 10, 11, 12, 13, 14].map((x) => ({ x, y: 4, type: 'water' })),
		{ x: 14, y: 5, type: 'water' }, { x: 14, y: 6, type: 'water' }, { x: 15, y: 6, type: 'water' },
		// a small open pond
		{ x: 20, y: 6, type: 'water' }, { x: 21, y: 6, type: 'water' }, { x: 22, y: 6, type: 'water' },
		{ x: 20, y: 7, type: 'water' }, { x: 21, y: 7, type: 'water' }, { x: 22, y: 7, type: 'water' },
		// a couple of watered beds ready to plant
		{ x: 10, y: 14, type: 'watered' }, { x: 11, y: 14, type: 'watered' },
	],
};

/** Pre-shape an area's starting terrain the first time it unlocks. */
async function seedStartingTerrain(wid: string, playerId: string, biomeId: string) {
	const layout = STARTING_TERRAIN[biomeId];
	if (!layout) return;
	const t = db();
	for (const cell of layout) {
		const id = `${wid}:${biomeId}:${cell.x}:${cell.y}`;
		if (await t.TerrainTile.get(id)) continue; // never overwrite the world's own work
		await t.TerrainTile.put({ id, worldId: wid, playerId, area: biomeId, x: cell.x, y: cell.y, type: cell.type, updatedAt: Date.now() });
	}
}

/**
 * Evaluate biome unlock requirements; unlock anything newly earned. Biome
 * unlock is a world property (BiomeState.unlocked under the world id), but the
 * acting player's personal `unlockedBiomes` is also updated so their action
 * gates open immediately. World-mates pick up the new unlock on their next
 * login / world switch via syncMemberUnlocks.
 */
async function checkUnlocks(
	wid: string,
	playerId: string,
	fresh: { player?: any; freshState?: any } = {}
): Promise<any[]> {
	const t = db();
	const d = await defs();
	const player = fresh.player || (await t.Player.get(playerId));
	const unlockedNow: any[] = [];
	const unlockedSet = new Set(player.unlockedBiomes || []);
	// the world's own unlock state is authoritative for prerequisites
	const worldUnlocked = new Set((await byWorld(t.BiomeState, wid)).filter((b) => b.unlocked).map((b) => b.biomeId));

	for (const biome of d.biomes) {
		if (!biome.unlock || worldUnlocked.has(biome.id)) continue;
		const u = biome.unlock;
		const prereq =
			fresh.freshState?.biomeId === u.biome ? fresh.freshState : await findInWorld(t.BiomeState, wid, `${wid}:${u.biome}`);
		if (!prereq || !worldUnlocked.has(u.biome)) continue;
		if ((prereq.health || 0) < (u.minHealth || 0)) continue;
		if ((prereq.returnedCount || 0) < (u.minAnimals || 0)) continue;
		if (u.minTotalAnimals) {
			// total animals returned across the whole preserve (all biomes)
			const totalReturned = (await byWorld(t.Discovery, wid)).length;
			if (totalReturned < u.minTotalAnimals) continue;
		}
		if (u.requiresItem) {
			const crafted = player.craftedItems?.[u.requiresItem] || 0;
			const everCrafted = player.craftedEver?.[u.requiresItem] || 0;
			if (crafted <= 0 && everCrafted <= 0) continue;
		}
		if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) continue;

		worldUnlocked.add(biome.id);
		unlockedSet.add(biome.id);
		await t.Player.patch(playerId, { unlockedBiomes: [...unlockedSet] });
		await t.BiomeState.patch(`${wid}:${biome.id}`, { unlocked: true });
		await seedStartingTerrain(wid, playerId, biome.id);
		unlockedNow.push({ id: biome.id, name: biome.name });
	}
	return unlockedNow;
}

/**
 * Recipe unlocks. A recipe with no `unlock` block is craftable from the moment
 * its biome is open (the handful of starter recipes). Everything else is gated
 * behind progress *in that recipe's own biome* — health, the number of animals
 * welcomed back, a specific keystone animal, or having already crafted a
 * prerequisite item. This is what turns crafting into a steady retention loop:
 * restore a little, unlock a little more to craft.
 */
function recipeUnlockMet(
	recipe: any,
	ctx: { health: number; animalsReturned: number; returnedAnimalIds: Set<string>; craftedEver: Record<string, number> },
): boolean {
	const u = recipe.unlock;
	if (!u) return true; // starter recipe
	if (typeof u.minHealth === 'number' && ctx.health < u.minHealth) return false;
	if (typeof u.animalsReturned === 'number' && ctx.animalsReturned < u.animalsReturned) return false;
	if (u.requiresAnimal && !ctx.returnedAnimalIds.has(u.requiresAnimal)) return false;
	if (u.requiresCrafted && (ctx.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
	return true;
}

/**
 * Build the unlock context for one biome from live records, then judge a recipe.
 * Used by CraftItem to enforce the gate server-side (Harper is the source of
 * truth — the client only hides locked recipes for nicer UX).
 */
async function recipeUnlockContext(wid: string, biomeId: string, player: any, d: any) {
	const t = db();
	// Use the reliable per-world scan, not BiomeState.get(): a primary-key .get()
	// can return null for a record that exists on a cold Harper instance, which made
	// health read as 0 and wrongly rejected a craft the client correctly showed as
	// unlocked (e.g. a Bird Perch at 24% health).
	const bs = await findInWorld(t.BiomeState, wid, `${wid}:${biomeId}`);
	const discoveries = await byWorld(t.Discovery, wid);
	const returnedAnimalIds = new Set<string>(
		discoveries.filter((x: any) => d.animal.get(x.animalId)?.biome === biomeId).map((x: any) => x.animalId),
	);
	return {
		health: bs?.health || 0,
		animalsReturned: returnedAnimalIds.size,
		returnedAnimalIds,
		craftedEver: (player.craftedEver || {}) as Record<string, number>,
	};
}

/**
 * Fetch a player's chest by id, self-healing saves where the chest placement
 * exists but its storage record is missing (older/interrupted saves). Rebuilds
 * the Chest row from the placement so the player can use it again.
 */
async function getOwnedChest(t: any, d: any, chestId: string, wid: string): Promise<any | null> {
	const chest = await findInWorld(t.Chest, wid, chestId);
	if (chest) return chest;
	const placement = await findInWorld(t.Placement, wid, chestId);
	if (placement) {
		const def = d.object.get(placement.objectId);
		if (def?.isChest) {
			const healed = {
				id: chestId, worldId: wid, playerId: placement.playerId, area: placement.area, x: placement.x, y: placement.y,
				size: placement.objectId, capacity: def.chestCapacity || 60, contents: {},
			};
			await t.Chest.put(healed);
			return healed;
		}
	}
	return null;
}

// ------------------------------------------------------- crafting storage

/**
 * Consume materials from player inventory first, then from any of the
 * player's chests — crafting works anywhere, no station required.
 * Throws (and writes nothing) if materials are insufficient.
 * Returns a breakdown of where every material came from.
 */
async function consumeMaterials(player: any, materials: Record<string, number>, wid: string = player.id) {
	const t = db();
	// crafting draws from the player's basket first, then the shared world's chests
	const chests = await byWorld(t.Chest, wid);

	// availability check first — never partially consume
	for (const [resId, qty] of Object.entries(materials)) {
		const inInv = player.inventory?.[resId] || 0;
		const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
		if (inInv + inChests < qty) {
			throw new GameError(`Not enough ${resId}: need ${qty}, have ${inInv + inChests} (basket + chests)`);
		}
	}

	const usedFrom: any = { inventory: {}, chests: {} };
	const inventory = { ...(player.inventory || {}) };
	const chestContents = new Map(chests.map((c) => [c.id, { ...(c.contents || {}) }]));

	for (const [resId, qtyNeeded] of Object.entries(materials)) {
		let remaining = qtyNeeded;
		const fromInv = Math.min(inventory[resId] || 0, remaining);
		if (fromInv > 0) {
			inventory[resId] -= fromInv;
			if (inventory[resId] <= 0) delete inventory[resId];
			usedFrom.inventory[resId] = fromInv;
			remaining -= fromInv;
		}
		for (const chest of chests) {
			if (remaining <= 0) break;
			const contents = chestContents.get(chest.id)!;
			const fromChest = Math.min(contents[resId] || 0, remaining);
			if (fromChest > 0) {
				contents[resId] -= fromChest;
				if (contents[resId] <= 0) delete contents[resId];
				usedFrom.chests[chest.id] = usedFrom.chests[chest.id] || {};
				usedFrom.chests[chest.id][resId] = fromChest;
				remaining -= fromChest;
			}
		}
		if (remaining > 0) throw new GameError(`Not enough ${resId}`); // defensive; checked above
	}

	await t.Player.patch(player.id, { inventory });
	for (const chest of chests) {
		if (usedFrom.chests[chest.id]) {
			await t.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
		}
	}
	return { usedFrom, inventory };
}

// ------------------------------------------------------- snapshot for client

// ------------------------------------------------------------- daily tasks
// A small rotating task board: three light, doable goals per real (UTC) day,
// derived deterministically from (worldId, day) — no stored task rows, no
// scheduler. Progress reads the per-day counters bumped by normal play
// (player.daily), claims live in player.taskClaims, and everything resets
// itself at midnight simply because the dayKey changes. Rewards are small
// material bundles drawn from the biomes the player has unlocked, so a claim
// always nudges the next craft without unbalancing the economy.

interface DailyTask {
	id: string;
	kind: 'gather' | 'craft' | 'place' | 'water' | 'plant' | 'observe';
	icon: string;
	text: string;
	target: number;
	/** player.daily counter key this task reads. */
	counter: string;
	reward: Record<string, number>;
}

function dailyTasksFor(wid: string, player: any, d: any, discoveredCount: number, now: number): { dayKey: number; endsAt: number; tasks: DailyTask[] } {
	const dayKey = Math.floor(now / DAY_MS);
	const rng = seededRng(hash32(`tasks:${wid}:${dayKey}`));
	const unlocked: string[] = player?.unlockedBiomes?.length ? player.unlockedBiomes : ['meadow'];
	// gatherable pool: solid materials from unlocked biomes (weather-gated
	// specials are excluded so a task never depends on the right sky)
	const resPool = [...new Set(unlocked.flatMap((id: string) => d.biome.get(id)?.resources || []))]
		.filter((r) => r !== 'water' && !isWeatherGatheredResource(r) && d.resource.get(r));

	const pickFrom = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
	const bundle = (): Record<string, number> => {
		const out: Record<string, number> = {};
		const pool = [...resPool];
		for (let i = 0; i < 2 && pool.length; i++) {
			const r = pool.splice(Math.floor(rng() * pool.length), 1)[0];
			out[r] = 4 + Math.floor(rng() * 4); // 4–7 of each
		}
		return out;
	};

	const candidates: DailyTask[] = [];
	if (resPool.length) {
		const res = pickFrom(resPool);
		const target = [8, 12, 16][Math.floor(rng() * 3)];
		candidates.push({
			id: `${dayKey}-gather`, kind: 'gather', icon: 'basket',
			text: `Gather ${target}× ${d.resource.get(res)?.name || res}`,
			target, counter: `res:${res}`, reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-craft`, kind: 'craft', icon: 'hammer',
			text: `Craft ${target} ${target === 1 ? 'item' : 'items'} at the workbench`,
			target, counter: 'craft', reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-place`, kind: 'place', icon: 'pin',
			text: `Place ${target} crafted ${target === 1 ? 'thing' : 'things'}`,
			target, counter: 'place', reward: bundle(),
		});
	}
	{
		const target = 3 + Math.floor(rng() * 3);
		candidates.push({
			id: `${dayKey}-water`, kind: 'water', icon: 'drop',
			text: `Water ${target} soil beds`,
			target, counter: 'water', reward: bundle(),
		});
	}
	candidates.push({
		id: `${dayKey}-plant`, kind: 'plant', icon: 'leaf',
		text: 'Plant 2 seedlings in watered beds',
		target: 2, counter: 'plant', reward: bundle(),
	});
	if (discoveredCount >= 3) {
		candidates.push({
			id: `${dayKey}-observe`, kind: 'observe', icon: 'journal',
			text: 'Read about 3 animals in your journal',
			target: 3, counter: 'observe', reward: bundle(),
		});
	}

	// seeded shuffle → the day's three
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}
	return { dayKey, endsAt: (dayKey + 1) * DAY_MS, tasks: candidates.slice(0, 3) };
}

/** The day's tasks with this player's live progress + claim state folded in. */
function dailyTasksBlock(wid: string, player: any, d: any, discoveredCount: number, now: number) {
	const gen = dailyTasksFor(wid, player, d, discoveredCount, now);
	const daily = player?.daily?.dayKey === gen.dayKey ? player.daily.counts || {} : {};
	const claims = player?.taskClaims?.dayKey === gen.dayKey ? player.taskClaims.claimed || {} : {};
	return {
		dayKey: gen.dayKey,
		endsAt: gen.endsAt,
		tasks: gen.tasks.map((task) => ({
			...task,
			progress: Math.min(task.target, daily[task.counter] || 0),
			claimed: !!claims[task.id],
		})),
	};
}

async function snapshot(playerId: string, opts: { worldId?: string } = {}) {
	const t = db();
	const d = await defs();
	let player = await safeGet(t.Player, playerId);
	// normalize saves whose last area no longer exists / isn't explorable — but the
	// home interior ('home') is a valid non-biome area, so leave it be.
	const areaBiome = d.biome.get(player?.area);
	if (player && player.area !== 'home' && (!areaBiome || !areaBiome.explorable)) {
		player = { ...player, area: 'meadow', x: 24.5, y: 6.5 };
	}
	// World-owned state is read by the active world id; achievements stay personal.
	// `opts.worldId` lets a caller force the world even if the player's just-patched
	// worldId isn't visible yet within the same transaction (e.g. right after joining).
	const wid = opts.worldId || worldOf(player);
	const [biomeStates, placements, chests, discoveries, nodeStates, terrain, achievementRows, feedRows] = await Promise.all([
		byWorld(t.BiomeState, wid),
		byWorld(t.Placement, wid),
		byWorld(t.Chest, wid),
		byWorld(t.Discovery, wid),
		byWorld(t.NodeState, wid),
		byWorld(t.TerrainTile, wid),
		byPlayer(t.PlayerAchievement, playerId),
		byWorld(t.FeedEntry, wid),
	]);
	// In a co-op world, a player can roam any biome a world-mate has unlocked, so
	// the snapshot reflects the union of personal + world-unlocked biomes.
	if (player && wid !== player.id) {
		const unlocked = new Set(player.unlockedBiomes || ['meadow']);
		for (const bs of biomeStates) if (bs.unlocked) unlocked.add(bs.biomeId);
		player = { ...player, unlockedBiomes: [...unlocked] };
	}
	const now = Date.now();
	const wxTime = weatherTimeFromPlay(player);
	return {
		player: sanitizePlayer(player), worldId: wid, biomeStates, placements, chests, discoveries, nodeStates, terrain,
		// most-recently earned first, so the client can float fresh unlocks to the top
		achievements: [...achievementRows]
			.sort((a: any, b: any) => (b.earnedAt || 0) - (a.earnedAt || 0))
			.map((r: any) => r.achievementId),
		// persisted activity feed, oldest→newest (last 100 kept per player)
		feed: [...feedRows]
			.sort((a: any, b: any) => (a.at || 0) - (b.at || 0))
			.slice(-FEED_CAP)
			.map((r: any) => ({ id: r.id, at: r.at, icon: r.icon, text: r.text })),
		serverTime: now,
		weather: weatherSnapshot(wid, wxTime, WEATHER_BIOME_IDS),
		dailyTasks: dailyTasksBlock(wid, player, d, discoveries.length, now),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(player),
	};
}

async function bodyOf(data: any) {
	const body = await data;
	if (!body || typeof body !== 'object') throw new GameError('Request body required');
	return body;
}

// ----------------------------------------------------------- achievements
// Earned server-side from durable state + the metrics action counters, one
// PlayerAchievement row per achievement. Triggers are pure predicates over a
// context assembled from the player's live records; we only test the
// not-yet-earned set, and writes are idempotent on the composite id, so
// re-evaluating on every action never double-awards. awardAchievements never
// throws — a hiccup here must never break the action that triggered it.

// Reaching the grasshopper step means the caretaker worked through the guide.
const TUTORIAL_GRASSHOPPER_STEP = 14;

interface AchCtx {
	counts: Record<string, number>;
	health: (b: string) => number;
	returned: (b: string) => number;
	disc: (animalId: string) => any;
	totalReturned: number;
	kindReturned: (b: string, kind: string) => number;
	tool: (id: string) => number;
	unlockedCount: number;
	craftedDistinct: number;
	tutorialStep: number;
	water: (b: string) => { tiles: number; lake: number; river: number };
	biomesAtHealth: (h: number) => number;
	unlockedHealthy: (h: number) => boolean;
}

const ACHIEVEMENT_TRIGGERS: Record<string, (c: AchCtx) => boolean> = {
	// Earned the moment the grasshopper comes home — the payoff of the whole
	// starter loop (you can only get here by gathering, crafting, and placing).
	'welcome-grasshopper': (c) => !!c.disc('grasshopper'),
	forager: (c) => (c.counts.resourcesCollected || 0) >= 100,
	'makers-hands': (c) => (c.counts.itemsCrafted || 0) >= 10,
	'green-thumb': (c) => (c.counts.plantsPlanted || 0) >= 10,
	waterworks: (c) => (c.counts.terraformActions || 0) >= 15,

	'meadow-first-bloom': (c) => c.returned('meadow') >= 8,
	'meadow-pollinators': (c) => c.kindReturned('meadow', 'insect') >= 5,
	'meadow-apex': (c) => !!c.disc('red-fox-meadow'),
	'meadow-mender': (c) => c.health('meadow') >= 80,
	'meadow-reborn': (c) => c.returned('meadow') >= 25,

	'forest-understory': (c) => c.returned('forest') >= 10,
	'forest-cavities': (c) =>
		!!c.disc('pileated-woodpecker') &&
		(!!c.disc('wood-duck') || !!c.disc('northern-flying-squirrel') || !!c.disc('great-horned-owl') || !!c.disc('barred-owl')),
	'forest-night-shift': (c) => !!c.disc('great-horned-owl') && !!c.disc('barred-owl') && !!c.disc('little-brown-bat'),
	'forest-canopy': (c) => c.health('forest') >= 80,
	'forest-reborn': (c) => c.returned('forest') >= 25,

	'wetland-first-water': (c) => c.returned('wetland') >= 8,
	'wetland-engineer': (c) => !!c.disc('beaver'),
	'wetland-lakemaker': (c) => c.water('wetland').lake >= 6,
	'wetland-restored': (c) => c.health('wetland') >= 80,
	'wetland-reborn': (c) => c.returned('wetland') >= 25,

	'desert-first-life': (c) => c.returned('desert') >= 8,
	'desert-burrows': (c) => !!c.disc('burrowing-owl') && !!c.disc('kangaroo-rat') && !!c.disc('desert-tortoise'),
	'desert-hunter': (c) => !!c.disc('rattlesnake') || !!c.disc('coyote'),
	'desert-restored': (c) => c.health('desert') >= 80,
	'desert-reborn': (c) => c.returned('desert') >= 25,

	'alpine-treeline': (c) => c.returned('alpine') >= 8,
	'alpine-haypile': (c) => !!c.disc('pika'),
	'alpine-crown': (c) => !!c.disc('golden-eagle'),
	'alpine-restored': (c) => c.health('alpine') >= 80,
	'alpine-reborn': (c) => c.returned('alpine') >= 25,

	'coastal-tide': (c) => c.returned('coastal') >= 8,
	'coastal-keystone': (c) => !!c.disc('sea-star'),
	'coastal-otter': (c) => !!c.disc('sea-otter'),
	'coastal-restored': (c) => c.health('coastal') >= 80,
	'coastal-reborn': (c) => c.returned('coastal') >= 25,

	'well-stocked': (c) => (c.counts.resourcesCollected || 0) >= 1000,
	'master-builder': (c) => (c.counts.objectsPlaced || 0) >= 150,
	'master-gardener': (c) => (c.counts.plantsPlanted || 0) >= 75,
	landscaper: (c) => (c.counts.terraformActions || 0) >= 150,
	'fully-equipped': (c) => c.tool('basket') >= 4 && c.tool('shovel') >= 4 && c.tool('watering-can') >= 4,
	naturalist: (c) => c.tool('field-journal') >= 7,
	'recipe-collector': (c) => c.craftedDistinct >= 75,

	'open-road': (c) => c.unlockedCount >= 2,
	'welcoming-committee': (c) => c.totalReturned >= 50,
	'full-house': (c) => c.totalReturned >= 100,
	'field-notes': (c) => (c.counts.animalsObserved || 0) >= 100,
	'steady-hand': (c) => c.unlockedCount >= 3 && c.unlockedHealthy(50),
	'three-restored': (c) => c.biomesAtHealth(80) >= 3,
	trailblazer: (c) => c.unlockedCount >= 6,
	'caretaker-of-the-whole': (c) => c.totalReturned >= 150,
};

/** Read the achievement ids a player has already earned. */
async function earnedAchievementIds(playerId: string): Promise<Set<string>> {
	const rows = await byPlayer(db().PlayerAchievement, playerId);
	return new Set(rows.map((r: any) => r.achievementId));
}

/** Derived achievements view for one player's Metrics. */
async function achievementMetrics(playerId: string) {
	const d = await defs();
	const rows = await byPlayer(db().PlayerAchievement, playerId);
	const total = d.achievements.length || 1;
	const earnedById = new Map(rows.map((r: any) => [r.achievementId, r]));
	const points = d.achievements.reduce((sum: number, a: any) => sum + (earnedById.has(a.id) ? a.points || 0 : 0), 0);
	const byCategory: Record<string, number> = {};
	for (const a of d.achievements) if (earnedById.has(a.id)) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
	const recent = [...rows]
		.sort((a: any, b: any) => (b.earnedAt || 0) - (a.earnedAt || 0))
		.slice(0, 5)
		.map((r: any) => ({ id: r.achievementId, name: d.achievement.get(r.achievementId)?.name || r.achievementId, earnedAt: r.earnedAt }));
	return {
		earned: rows.length,
		total: d.achievements.length,
		points,
		completion: round1(rows.length / total),
		byCategory,
		recent,
	};
}

/**
 * Evaluate every not-yet-earned achievement for a player against their live
 * state and persist any newly earned ones. Returns the newly-earned definition
 * records (for logging); the client surfaces them by diffing the snapshot.
 *
 * `opts` lets callers fold in writes made earlier in THIS request that the
 * byPlayer searches can't see yet (Harper doesn't surface a transaction's own
 * writes to later searches) — e.g. the Discovery just created for a returning
 * animal, and the freshly recalculated BiomeState. Without this, achievements
 * like First Friend wouldn't fire until the *next* action.
 */
async function awardAchievements(
	playerId: string,
	opts: { addDiscoveries?: any[]; freshBiomeStates?: any[] } = {},
): Promise<any[]> {
	try {
		const t = db();
		const d = await defs();
		const player = await t.Player.get(playerId);
		if (!player) return [];
		const earned = await earnedAchievementIds(playerId);
		// achievement context comes from the world the player is acting in
		const wid = worldOf(player);

		let [biomeStates, discoveries, terrain] = await Promise.all([
			byWorld(t.BiomeState, wid),
			byWorld(t.Discovery, wid),
			byWorld(t.TerrainTile, wid),
		]);

		// fold in this-request writes the searches above can't see yet
		for (const ad of opts.addDiscoveries || []) {
			if (ad?.animalId && !discoveries.some((x: any) => x.animalId === ad.animalId)) discoveries.push(ad);
		}
		for (const bs of opts.freshBiomeStates || []) {
			if (!bs?.biomeId) continue;
			biomeStates = biomeStates.filter((b: any) => b.biomeId !== bs.biomeId);
			biomeStates.push(bs);
		}

		const stateByBiome = new Map(biomeStates.map((b: any) => [b.biomeId, b]));
		const discById = new Map(discoveries.map((x: any) => [x.animalId, x]));
		const waterCache = new Map<string, { tiles: number; lake: number; river: number }>();

		const unlockedSet = new Set(player.unlockedBiomes || []);

		const ctx: AchCtx = {
			counts: (player.metrics?.counts || {}) as Record<string, number>,
			health: (b) => (stateByBiome.get(b) as any)?.health || 0,
			returned: (b) => (stateByBiome.get(b) as any)?.returnedCount || 0,
			disc: (animalId) => discById.get(animalId),
			totalReturned: discoveries.length,
			kindReturned: (b, kind) =>
				discoveries.filter((x: any) => {
					const a = d.animal.get(x.animalId);
					return a && a.biome === b && a.kind === kind;
				}).length,
			tool: (id) => player.tools?.[id] || 1,
			unlockedCount: (player.unlockedBiomes || []).length,
			craftedDistinct: Object.keys(player.craftedEver || {}).length,
			tutorialStep: player.tutorialStep || 0,
			water: (b) => {
				if (!waterCache.has(b)) waterCache.set(b, analyzeWater(terrain.filter((tt: any) => tt.area === b)));
				return waterCache.get(b)!;
			},
			biomesAtHealth: (h) => biomeStates.filter((b: any) => (b.health || 0) >= h).length,
			unlockedHealthy: (h) =>
				biomeStates.filter((b: any) => unlockedSet.has(b.biomeId)).every((b: any) => (b.health || 0) >= h),
		};

		const now = Date.now();
		const newly: any[] = [];
		for (const def of d.achievements) {
			if (earned.has(def.id)) continue;
			const trigger = ACHIEVEMENT_TRIGGERS[def.id];
			if (!trigger || !trigger(ctx)) continue;
			await t.PlayerAchievement.put({
				id: `${playerId}:${def.id}`,
				playerId,
				achievementId: def.id,
				biome: def.biome,
				earnedAt: now,
			});
			newly.push(def);
		}
		return newly;
	} catch {
		return []; // never let achievement evaluation break the triggering action
	}
}

/**
 * Award achievements for a WORLD-changing action. The actor is evaluated as usual,
 * but in a co-op world every other member is evaluated too — so world-derived
 * achievements (welcoming the grasshopper / First Friend, keystones, biome
 * milestones…) land for everyone at the same moment, since they all share the same
 * world state. Personal achievements (your own crafting/gathering counts) still
 * only fire for whoever actually qualifies. Returns the actor's newly-earned set.
 */
async function awardWorldAchievements(
	wid: string,
	actorId: string,
	opts: { addDiscoveries?: any[]; freshBiomeStates?: any[] } = {},
): Promise<any[]> {
	const newlyForActor = await awardAchievements(actorId, opts);
	try {
		const t = db();
		const world = await t.World.get(wid);
		if (world && !world.solo) {
			for (const m of await byWorld(t.WorldMember, wid)) {
				if (m.playerId === actorId) continue;
				await awardAchievements(m.playerId, opts); // same world context → shared world achievements
			}
		}
	} catch { /* co-op fan-out is best-effort */ }
	return newlyForActor;
}

// ================================================================ ENDPOINTS

/**
 * MVP demo-player flow: the game endpoints are publicly accessible (no real
 * auth yet, per the MVP scope). All writes still go through full server-side
 * validation, the underlying tables are NOT exported over REST, and Harper
 * admin credentials are never used or exposed by the frontend. Swap these
 * allow* methods for role checks when real accounts are added.
 */
class PublicEndpoint extends Resource {
	allowRead() {
		return true;
	}
	allowCreate() {
		return true;
	}
	allowUpdate() {
		return true;
	}
	allowDelete() {
		return false;
	}
}

/** GET /GameData/ — all static definitions (biomes, animals, recipes, …). */
export class GameData extends PublicEndpoint {
	async get() {
		const d = await defs();
		return {
			biomes: d.biomes, animals: d.animals, resources: d.resources,
			recipes: d.recipes, habitatObjects: d.objects, tools: d.tools,
			achievements: d.achievements,
			homeStyles: HOME_STYLES,
			homeTracks: HOME_TRACKS,
			nodeRegenSeconds: NODE_REGEN_SECONDS,
			appearanceOptions: {
				skins: SKIN_TONES, hair: HAIR_COLORS, outfits: OUTFIT_COLORS,
				hats: HAT_STYLES, hatColors: HAT_COLORS, hairstyles: HAIRSTYLES,
				beards: BEARD_STYLES, bodies: BODY_TYPES,
			},
		};
	}
}

/** POST /CreatePlayer/ {name, passcode, appearance} — start a brand-new save. */
export class CreatePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode, appearance } = await bodyOf(data);
		const cleanName = String(name || '').trim();
		if (cleanName.length < 2 || cleanName.length > 24) throw new GameError('Pick a name between 2 and 24 characters');
		const code = String(passcode || '');
		if (code.length < 4 || code.length > 32) throw new GameError('Pick a passcode of at least 4 characters');
		const playerId = slugId(cleanName);
		if (!playerId) throw new GameError('That name needs at least one letter or number');

		const existing = await safeGet(db().Player, playerId);
		if (existing) throw new GameError('A save with that name already exists', 409);

		const created = await createPlayerRecords(playerId, cleanName, code, sanitizeAppearance(appearance));
		// World plumbing must never block starting a save: if the World/WorldMember
		// tables aren't ready yet (instance not restarted after the schema change),
		// fall back to a plain solo session so core play still works.
		let worlds: any[] = [];
		try { await ensureSoloWorld(created.player, { freshGrid: true }); worlds = await listMemberships(playerId); }
		catch (e) { console.error('world setup skipped (CreatePlayer):', e); }
		return { ok: true, playerId, worldId: playerId, worlds, state: await freshSnapshot(created) };
	}
}

/**
 * POST /DeletePlayer/ {name, passcode} — permanently delete a save and every
 * record that belongs to it. Passcode required so nobody can wipe your preserve.
 */
export class DeletePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode } = await bodyOf(data);
		const playerId = slugId(String(name || ''));
		const player = playerId ? await db().Player.get(playerId) : null;
		if (!player) throw new GameError('No save found with that name', 404);
		if (!(await verifyPasscode(player, passcode))) throw new GameError("That passcode doesn't match this save", 403);

		const t = db();
		let removed = 0;
		// Delete the player's own solo world (id === playerId) and personal records.
		// Co-op worlds they merely belong to are left intact for the other members.
		for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile, t.FeedEntry]) {
			for (const rec of await byWorld(table, playerId)) {
				await table.delete(rec.id);
				removed++;
			}
		}
		for (const rec of await byPlayer(t.PlayerAchievement, playerId)) {
			await t.PlayerAchievement.delete(rec.id);
			removed++;
		}
		// drop every world membership, and the solo World row itself
		for (const m of await byPlayer(t.WorldMember, playerId)) {
			await t.WorldMember.delete(m.id);
			removed++;
		}
		if (await t.World.get(playerId)) { await t.World.delete(playerId); removed++; }
		await t.Player.delete(playerId);
		return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
	}
}

/**
 * POST /ChangePasscode/ {playerId, currentPasscode, newPasscode} — change the
 * passcode while logged in. The current passcode must match before a new one
 * (re-hashed with a fresh salt) is stored.
 */
export class ChangePasscode extends PublicEndpoint {
	async post(data: any) {
		const { playerId, currentPasscode, newPasscode } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		if (!(await verifyPasscode(player, currentPasscode))) throw new GameError("That passcode doesn't match this save", 403);
		const next = String(newPasscode || '');
		if (next.length < 4 || next.length > 32) throw new GameError('Pick a new passcode between 4 and 32 characters');
		const { salt, hash } = hashPasscode(next);
		await db().Player.patch(playerId, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return { ok: true };
	}
}

/** POST /LoginPlayer/ {name, passcode} — load an existing save. */
export class LoginPlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode } = await bodyOf(data);
		const playerId = slugId(String(name || ''));
		const player = playerId ? await safeGet(db().Player, playerId) : null;
		if (!player) throw new GameError('No save found with that name — try New Game', 404);
		if (!(await verifyPasscode(player, passcode))) throw new GameError("That passcode doesn't match this save", 403);
		const d = await defs();
		// Reset the heartbeat clock so the first beat after login is counted as a
		// fresh play session (and back-fill metrics for saves made before tracking).
		// lastSeenAt is deliberately NOT bumped here — the first heartbeat reads it
		// to measure the absence for the welcome-back growth summary, then updates it.
		const now = Date.now();
		const prev = player.metrics || freshMetrics(player.createdAt || now);
		await db().Player.patch(playerId, { metrics: { ...prev, lastHeartbeatAt: 0 } });
		// Back-fill the solo "world of one" for saves made before multiplayer (this
		// also realigns the meadow to the current camp offset), then resume whichever
		// world this player was last active in (their solo world by default, or a
		// co-op world they had joined — this is how you log back in to co-op).
		// Guarded so a not-yet-migrated instance still logs you in (solo) rather than erroring.
		let active = player.worldId || playerId;
		let worlds: any[] = [];
		try {
			await ensureSoloWorld(player);
			active = (await db().Player.get(playerId)).worldId || playerId;
			await syncMemberUnlocks(playerId, active);
			worlds = await listMemberships(playerId);
		} catch (e) { console.error('world setup skipped (LoginPlayer):', e); }
		// On login, start back out in the meadow rather than loading straight into an
		// interior or a no-longer-explorable area. Done AFTER the meadow realignment
		// above so a returning player lands on the current spawn, never a shifted one.
		const areaBiome = d.biome.get(player.area);
		if (player.area === 'home' || !areaBiome || !areaBiome.explorable) {
			await db().Player.patch(playerId, { area: 'meadow', x: 24.5, y: 6.5 });
		}
		return { ok: true, playerId, worldId: active, worlds, state: await snapshot(playerId) };
	}
}

/** GET /GameState/<playerId> — create-or-load the player and return everything. */
export class GameState extends PublicEndpoint {
	async get() {
		const playerId = String(this.getId() || '');
		await requirePlayer(playerId);
		// note: GET handlers must not write — invalid areas are normalized in snapshot()
		return snapshot(playerId);
	}
}

// ------------------------------------------------------------- worlds API
// Co-op lets several players restore one shared preserve. Personal progress
// (inventory, tools, appearance, achievements, position) always stays with the
// player; only the world (biomes, terrain, placements, animals, chests, feed)
// is shared. A player can belong to many worlds and switch between them, and
// because membership is persisted they can log back in straight into a co-op
// world they had joined.

/** GET/POST /MyWorlds/ {playerId} — every world this player can enter. */
export class MyWorlds extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);
		return { ok: true, activeWorldId: worldOf(player), worlds: await listMemberships(playerId) };
	}
}

/** POST /CreateWorld/ {playerId, name} — start a new shared co-op preserve. */
export class CreateWorld extends PublicEndpoint {
	async post(data: any) {
		const { playerId, name } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);

		const cleanName = String(name || '').trim() || `${player.name}'s preserve`;
		if (cleanName.length > 40) throw new GameError('Pick a world name under 40 characters');

		// generate a unique world id + a collision-free join code
		const worldId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
		let joinCode = genJoinCode();
		const allWorlds = await allOf(t.World);
		const taken = new Set(allWorlds.map((w: any) => w.joinCode).filter(Boolean));
		let guard = 0;
		while (taken.has(joinCode) && guard++ < 20) joinCode = genJoinCode();

		const now = Date.now();
		await t.World.put({
			id: worldId, name: cleanName, solo: false, ownerId: playerId,
			joinCode, createdAt: now, maxMembers: DEFAULT_MAX_MEMBERS,
		});
		await t.WorldMember.put({
			id: `${worldId}:${playerId}`, worldId, playerId,
			role: 'owner', joinedAt: now, lastSeenAt: now,
		});
		// seed the shared world's biome rows (meadow unlocked, like a fresh save) so
		// restoration starts from scratch in the co-op world
		const d = await defs();
		for (const b of d.biomes) {
			await t.BiomeState.put({
				id: `${worldId}:${b.id}`, worldId, playerId, biomeId: b.id,
				health: BASE_HEALTH, balance: 0, returnedCount: 0, unlocked: b.id === 'meadow',
			});
		}
		return { ok: true, world: { worldId, name: cleanName, joinCode, solo: false, role: 'owner', isOwner: true, memberCount: 1, maxMembers: DEFAULT_MAX_MEMBERS }, worlds: await listMemberships(playerId) };
	}
}

/** POST /JoinWorld/ {playerId, joinCode} — join a co-op preserve and enter it. */
/** Find a joinable (non-solo) world by its code. */
async function worldByCode(t: any, joinCode: any): Promise<any | null> {
	const code = String(joinCode || '').trim().toUpperCase();
	if (!code) return null;
	return (await allOf(t.World)).find((w: any) => !w.solo && w.joinCode === code) || null;
}

export class JoinWorld extends PublicEndpoint {
	async post(data: any) {
		const { playerId, joinCode, token } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);

		const world = await worldByCode(t, joinCode);
		if (!world) throw new GameError('No world found with that code', 404);

		const memberId = `${world.id}:${playerId}`;
		const already = await t.WorldMember.get(memberId);
		if (!already) {
			// You can only become a member once the host has APPROVED your request —
			// redeem the token you got when you entered the code.
			const tok = String(token || '').trim();
			const req = tok ? await t.JoinRequest.get(`${world.id}:${tok}`) : null;
			if (!req || req.status !== 'approved') {
				throw new GameError('The host hasn’t approved you for this world yet', 403);
			}
			const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
			const members = await byWorld(t.WorldMember, world.id);
			if (members.length >= max) {
				throw new GameError(`This preserve is full — ${max} caretakers have joined and it's closed to new players.`, 409);
			}
			await t.WorldMember.put({
				id: memberId, worldId: world.id, playerId,
				role: 'member', joinedAt: Date.now(), lastSeenAt: Date.now(),
			});
			await t.JoinRequest.delete(`${world.id}:${tok}`); // consume the approval
			// announce the arrival in the shared world feed (everyone sees it)
			const at = Date.now();
			await t.FeedEntry.put({
				id: `f_${world.id}_${at}_${Math.random().toString(36).slice(2, 7)}`,
				worldId: world.id, playerId, at, icon: 'user', text: `${player.name} joined the preserve!`,
			});
		}
		// entering the world: make it active and open up whatever biomes it has unlocked
		await t.Player.patch(playerId, { worldId: world.id });
		await syncMemberUnlocks(playerId, world.id);
		// The membership/worldId we just wrote may not be visible to reads in this same
		// transaction yet, so force the active world id and make sure the joined world
		// is present in the returned list (otherwise the client needs a second load to
		// recognize co-op).
		let worldsList = await listMemberships(playerId);
		if (!worldsList.some((w: any) => w.worldId === world.id)) {
			const members = await byWorld(t.WorldMember, world.id);
			const here = members.some((m: any) => m.playerId === playerId) ? members.length : members.length + 1;
			worldsList = [...worldsList, {
				worldId: world.id, name: world.name, solo: false,
				role: world.ownerId === playerId ? 'owner' : 'member',
				joinCode: world.joinCode, memberCount: here,
				maxMembers: world.maxMembers || DEFAULT_MAX_MEMBERS, isOwner: world.ownerId === playerId,
			}];
		}
		return { ok: true, worldId: world.id, worlds: worldsList, state: await snapshot(playerId, { worldId: world.id }) };
	}
}

/** POST /CheckWorldCode/ {joinCode} — does this code point to a real co-op world? (no account needed) */
export class CheckWorldCode extends PublicEndpoint {
	async post(data: any) {
		const { joinCode } = await bodyOf(data);
		const t = db();
		const world = await worldByCode(t, joinCode);
		if (!world) return { ok: true, exists: false };
		const memberCount = (await byWorld(t.WorldMember, world.id)).length;
		const owner = await t.Player.get(world.ownerId);
		const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
		return {
			ok: true, exists: true,
			world: { worldId: world.id, name: world.name, hostName: owner?.name || 'the host', memberCount, maxMembers: max, full: memberCount >= max },
		};
	}
}

/** POST /RequestJoin/ {joinCode, token, name} — ask the host to let you in (before making a character). */
export class RequestJoin extends PublicEndpoint {
	async post(data: any) {
		const { joinCode, token, name } = await bodyOf(data);
		const t = db();
		const world = await worldByCode(t, joinCode);
		if (!world) throw new GameError('No world found with that code', 404);
		const tok = String(token || '').trim();
		if (!tok) throw new GameError('Missing request token');
		const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
		const memberCount = (await byWorld(t.WorldMember, world.id)).length;
		if (memberCount >= max) throw new GameError(`This preserve is full — it already has its ${max} caretakers and is closed to new players.`, 409);
		const cleanName = String(name || '').trim().slice(0, 24) || 'A caretaker';
		await t.JoinRequest.put({ id: `${world.id}:${tok}`, worldId: world.id, token: tok, name: cleanName, status: 'pending', createdAt: Date.now() });
		const owner = await t.Player.get(world.ownerId);
		return { ok: true, worldId: world.id, world: { name: world.name, hostName: owner?.name || 'the host' } };
	}
}

/** POST /JoinRequestStatus/ {worldId, token} — the waiting joiner polls this. */
export class JoinRequestStatus extends PublicEndpoint {
	async post(data: any) {
		const { worldId, token } = await bodyOf(data);
		const t = db();
		const req = await t.JoinRequest.get(`${worldId}:${String(token || '').trim()}`);
		return { ok: true, status: req?.status || 'none' };
	}
}

/** POST /PendingJoinRequests/ {playerId} — the host's pending requests for their active world. */
export class PendingJoinRequests extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const t = db();
		const wid = worldOf(player);
		const world = await t.World.get(wid);
		if (!world || world.solo || world.ownerId !== playerId) return { ok: true, requests: [] };
		const reqs = (await byWorld(t.JoinRequest, wid)).filter((r: any) => r.status === 'pending');
		reqs.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
		return { ok: true, requests: reqs.map((r: any) => ({ token: r.token, name: r.name, createdAt: r.createdAt })) };
	}
}

/** POST /ResolveJoin/ {playerId, worldId, token, approve} — host approves or denies a request. */
export class ResolveJoin extends PublicEndpoint {
	async post(data: any) {
		const { playerId, worldId, token, approve } = await bodyOf(data);
		await requirePlayer(playerId);
		const t = db();
		const world = await t.World.get(worldId);
		if (!world || world.solo) throw new GameError('No such co-op world', 404);
		if (world.ownerId !== playerId) throw new GameError('Only the host can approve players', 403);
		const id = `${worldId}:${String(token || '').trim()}`;
		const req = await t.JoinRequest.get(id);
		if (!req) throw new GameError('That request is no longer pending', 404);
		await t.JoinRequest.patch(id, { status: approve ? 'approved' : 'denied', resolvedAt: Date.now() });
		return { ok: true };
	}
}

/**
 * POST /WorldRoster/ {playerId} — the full join history of the active co-op world:
 * everyone who has ever joined (caretakers stay on the roster so they can always
 * return), in join order, plus whether the world has hit its cap and is closed.
 */
export class WorldRoster extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const t = db();
		const wid = worldOf(player);
		const world = await t.World.get(wid);
		const max = world?.maxMembers || DEFAULT_MAX_MEMBERS;
		if (!world || world.solo) return { ok: true, roster: [], closed: false, maxMembers: max, joinCode: null };
		const members = await byWorld(t.WorldMember, wid);
		const roster: any[] = [];
		for (const m of members) {
			const p = await safeGet(t.Player, m.playerId);
			roster.push({
				playerId: m.playerId,
				name: p?.name || 'caretaker',
				isOwner: m.role === 'owner' || world.ownerId === m.playerId,
				joinedAt: m.joinedAt || 0,
			});
		}
		roster.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
		return { ok: true, roster, closed: roster.length >= max, maxMembers: max, joinCode: world.joinCode };
	}
}

/** POST /SwitchWorld/ {playerId, worldId} — make one of your worlds active and load it. */
export class SwitchWorld extends PublicEndpoint {
	async post(data: any) {
		const { playerId, worldId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);

		const target = String(worldId || '');
		if (!(await t.WorldMember.get(`${target}:${playerId}`))) {
			throw new GameError('You are not a member of that world', 403);
		}
		await t.Player.patch(playerId, { worldId: target });
		await t.WorldMember.patch(`${target}:${playerId}`, { lastSeenAt: Date.now() });
		await syncMemberUnlocks(playerId, target);
		return { ok: true, worldId: target, worlds: await listMemberships(playerId), state: await snapshot(playerId, { worldId: target }) };
	}
}

/** POST /LeaveWorld/ {playerId, worldId} — leave a co-op world (your solo world stays). */
export class LeaveWorld extends PublicEndpoint {
	async post(data: any) {
		const { playerId, worldId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const target = String(worldId || '');
		if (target === playerId) throw new GameError('You cannot leave your own solo world');
		const memberId = `${target}:${playerId}`;
		if (!(await t.WorldMember.get(memberId))) throw new GameError('You are not in that world', 404);
		await t.WorldMember.delete(memberId);
		// if you were standing in that world, fall back to your solo world
		if (player.worldId === target) {
			await t.Player.patch(playerId, { worldId: playerId, area: 'meadow', x: 24.5, y: 6.5 });
			await syncMemberUnlocks(playerId, playerId);
		}
		const active = player.worldId === target ? playerId : (player.worldId || playerId);
		return { ok: true, worldId: active, worlds: await listMemberships(playerId), state: await snapshot(playerId, { worldId: active }) };
	}
}

// How recently a member must have pinged to count as "here right now".
const PRESENCE_WINDOW_MS = 15_000;

/**
 * POST /Presence/ {playerId, x, y, area} — live co-op presence. The caller's
 * position is recorded on their WorldMember row, and the positions of every
 * other member seen within the presence window are returned (with name +
 * appearance) so the client can render their avatars. A no-op for solo worlds.
 *
 * This is the pragmatic v1 transport (a short client poll). The design doc's
 * end state moves this onto Harper's native pub/sub so positions are pushed,
 * never persisted; the client contract here stays the same when that lands.
 */
export class Presence extends PublicEndpoint {
	async post(data: any) {
		const { playerId, x, y, area } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const now = Date.now();

		const px = Number.isFinite(Number(x)) ? Number(x) : player.x;
		const py = Number.isFinite(Number(y)) ? Number(y) : player.y;
		const parea = typeof area === 'string' ? area : player.area;

		// solo worlds have no one else — nothing to broadcast
		const world = await t.World.get(wid);
		if (world?.solo) return { ok: true, worldId: wid, peers: [] };

		// Merge my live position into the shared WorldPresence record. Writing it
		// pushes the new map to everyone SUBSCRIBED to this world over WebSocket —
		// that's the realtime channel (no one polls to see others move). We prune
		// players who've gone quiet so avatars disappear when someone leaves.
		const rec = (await t.WorldPresence.get(wid)) || { id: wid, players: {} };
		const players = { ...(rec.players || {}) };
		players[playerId] = { playerId, name: player.name, appearance: player.appearance, area: parea, x: px, y: py, t: now };
		for (const pid of Object.keys(players)) {
			if (now - (players[pid]?.t || 0) > PRESENCE_WINDOW_MS) delete players[pid];
		}
		await t.WorldPresence.put({ id: wid, players, updatedAt: now });

		// Also return the current peers, so a client whose WebSocket isn't connected
		// (or hasn't connected yet) still has a polling fallback.
		const peers = Object.values(players).filter((p: any) => p.playerId !== playerId);
		return { ok: true, worldId: wid, peers };
	}
}

/** POST /CollectResource/ {playerId, biomeId, nodeId, resourceId} */
export class CollectResource extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId, nodeId, resourceId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const biome = d.biome.get(biomeId);
		if (!biome) throw new GameError(`Unknown biome: ${biomeId}`);
		if (!(player.unlockedBiomes || []).includes(biomeId)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
		const resDef = d.resource.get(resourceId);
		if (!resDef) throw new GameError(`Unknown resource: ${resourceId}`);
		// Weather-gated resources sidestep the biome resource list, but the matching
		// weather must actually be active in this biome right now (recomputed from the
		// same deterministic function the client used to spawn the node).
		if (isWeatherGatheredResource(resourceId)) {
			// Weather-gated: the resource must be the one this biome's CURRENT weather
			// yields (recomputed from the same play-time base the snapshot used).
			const active = weatherTypeAt(wid, biomeId, weatherTimeFromPlay(player));
			if (gatherResourceIdFor(biomeId, active) !== resourceId) {
				throw new GameError(`${resDef.name} only appears in certain weather here`, 409);
			}
		} else if (!(biome.resources || []).includes(resourceId)) {
			throw new GameError(`${resourceId} is not found in ${biome.name}`);
		}
		if (!nodeId || typeof nodeId !== 'string') throw new GameError('nodeId required');

		// node regeneration cooldown — shared across the world so two players can't
		// both drain the same spot
		const nodeKey = `${wid}:${biomeId}:${nodeId}`;
		const nodeState = await t.NodeState.get(nodeKey);
		const now = Date.now();
		if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1000) {
			throw new GameError('This spot is still regrowing — come back soon', 409);
		}

		// carrying capacity (gathering basket)
		const capacity = inventoryCapacity(player);
		const carried = sumValues(player.inventory);
		if (carried >= capacity) throw new GameError('Your basket is full — store materials in a chest first', 409);

		// a higher-tier tool gathers more at once (tier 1→1 … tier 4→4)
		const toolTier = player.tools?.[resDef.tool] || 1;
		const amount = Math.min(Math.max(1, toolTier), capacity - carried);

		const inventory = { ...(player.inventory || {}) };
		inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		await t.Player.patch(playerId, { inventory });
		await t.NodeState.put({ id: nodeKey, worldId: wid, playerId, harvestedAt: now });

		await bumpMetrics(player, { resourcesCollected: amount }, { [`res:${resourceId}`]: amount });
		await awardAchievements(playerId);
		return { ok: true, gained: { [resourceId]: amount }, inventory, nodeId, harvestedAt: now };
	}
}

/** POST /ChestTransfer/ {playerId, chestId, resourceId, qty, direction: 'deposit'|'withdraw'} */
export class ChestTransfer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const amount = posInt(qty, 'qty');
		const chest = await getOwnedChest(t, d, chestId, wid);
		if (!chest) throw new GameError('Chest not found', 404);

		const inventory = { ...(player.inventory || {}) };
		const contents = { ...(chest.contents || {}) };

		if (direction === 'deposit') {
			if ((inventory[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in your inventory`);
			if (sumValues(contents) + amount > chest.capacity) throw new GameError('That chest is full', 409);
			inventory[resourceId] -= amount;
			if (inventory[resourceId] <= 0) delete inventory[resourceId];
			contents[resourceId] = (contents[resourceId] || 0) + amount;
		} else if (direction === 'withdraw') {
			if ((contents[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in that chest`);
			if (sumValues(inventory) + amount > inventoryCapacity(player)) throw new GameError('Your basket is full', 409);
			contents[resourceId] -= amount;
			if (contents[resourceId] <= 0) delete contents[resourceId];
			inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		} else {
			throw new GameError("direction must be 'deposit' or 'withdraw'");
		}

		await t.Player.patch(playerId, { inventory });
		await t.Chest.patch(chestId, { contents });
		return { ok: true, inventory, chest: { ...chest, contents } };
	}
}

/**
 * POST /DiscardItem/ {playerId, kind: 'material'|'crafted', id, qty}
 * Throw away unwanted basket materials or crafted items. Validated server-side
 * (you can't discard more than you hold); discarded things are simply gone.
 */
export class DiscardItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, kind, id, qty } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const amount = posInt(qty, 'qty');
		if (!id || typeof id !== 'string') throw new GameError('id required');

		if (kind === 'crafted') {
			const craftedItems = { ...(player.craftedItems || {}) };
			if ((craftedItems[id] || 0) < amount) throw new GameError('You do not have that many to throw away');
			craftedItems[id] -= amount;
			if (craftedItems[id] <= 0) delete craftedItems[id];
			await t.Player.patch(playerId, { craftedItems });
			return { ok: true, craftedItems };
		}

		const inventory = { ...(player.inventory || {}) };
		if ((inventory[id] || 0) < amount) throw new GameError('You do not have that many to throw away');
		inventory[id] -= amount;
		if (inventory[id] <= 0) delete inventory[id];
		await t.Player.patch(playerId, { inventory });
		return { ok: true, inventory };
	}
}

/** POST /CraftItem/ {playerId, recipeId} — uses inventory + all of the player's chests. */
export class CraftItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, recipeId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const recipe = d.recipe.get(recipeId);
		if (!recipe) throw new GameError(`Unknown recipe: ${recipeId}`);
		// Plantable objects can only be planted in a watered bed, never crafted.
		const outObj = d.object.get(recipe.output.itemId);
		if (outObj?.plantable) {
			throw new GameError(`${recipe.name} is planted, not crafted — dig a bed, water it, and plant it.`, 400);
		}
		// Dev override (dev save only): skip the biome + progress gates entirely.
		// House-only furniture can't be crafted until your home's Space is upgraded.
		if (!player.devUnlockAll && outObj?.homeMin && (homeOf(player).space || 1) < outObj.homeMin) {
			throw new GameError(`${recipe.name} needs a proper house — upgrade your home's Space first.`, 403);
		}
		const devUnlock = !!player.devUnlockAll;
		if (!devUnlock && recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
			throw new GameError('This recipe unlocks with a biome you have not restored yet', 403);
		}
		// Progress gate: most recipes only unlock once you've restored their biome
		// far enough (health / animals returned / a keystone animal back).
		if (!devUnlock && recipe.unlock && recipe.unlockBiome) {
			const ctx = await recipeUnlockContext(wid, recipe.unlockBiome, player, d);
			if (!recipeUnlockMet(recipe, ctx)) {
				throw new GameError(`Not unlocked yet — ${recipe.unlock.label}.`, 403);
			}
		}
		if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
			const tool = d.tool.get(recipe.requiresTool.id);
			throw new GameError(`Requires the upgraded ${tool?.name || recipe.requiresTool.id}`, 403);
		}
		// One-time recipes (restoration kits) can only ever be crafted once.
		if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
			throw new GameError(`You have already crafted the ${recipe.name} — it only needs to be made once.`, 409);
		}

		const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {}, wid);

		const craftedItems = { ...(player.craftedItems || {}) };
		const craftedEver = { ...(player.craftedEver || {}) };
		craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		await t.Player.patch(playerId, { craftedItems, craftedEver });

		// crafting key items (e.g. the water restoration kit) can unlock biomes
		const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, craftedItems, craftedEver } });

		const chests = await byWorld(t.Chest, wid);
		await bumpMetrics(player, { itemsCrafted: 1 }, { craft: 1 });
		await awardAchievements(playerId);
		return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, unlockedBiomes };
	}
}

/** POST /PlaceObject/ {playerId, objectId, area, x, y} — area is a biome id or 'home'. */
export class PlaceObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, objectId, area, x, y } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const def = d.object.get(objectId);
		if (!def) throw new GameError(`Unknown object: ${objectId}`);
		if (def.placement === 'none') throw new GameError(`${def.name} is a kit, not a placeable object`);
		if ((player.craftedItems?.[objectId] || 0) <= 0) throw new GameError(`You have no crafted ${def.name} to place`);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const grid = areaGrid(d, area);
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError('That spot is out of reach');
		}

		if (area === 'home') {
			// decorating your home interior — indoor or 'both' items, on the floor only
			if (def.placement === 'outdoor') throw new GameError(`${def.name} belongs out in the preserve, not indoors`);
			// some furniture needs a real house, not the starter tent
			if (def.homeMin && (homeOf(player).space || 1) < def.homeMin) {
				throw new GameError(`${def.name} needs a bigger home — upgrade your home's Space first.`, 403);
			}
			const r = homeRoom(player);
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) throw new GameError('Place it on the floor inside your home');
		} else {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(`Unknown area: ${area}`);
			if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
			if (def.placement === 'indoor') throw new GameError(`${def.name} cannot be placed out in the preserve`);
			if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} does not suit the ${biome.name} habitat`);
		}
		if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
			throw new GameError(`Placing ${def.name} requires an upgraded ${d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id}`, 403);
		}

		const placements = await byWorld(t.Placement, wid);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError('That spot is already taken', 409);
		}
		// terrain/water rules only apply outdoors — the home has no terrain
		const tileHere = area === 'home' ? null : await findInWorld(t.TerrainTile, wid, `${wid}:${area}:${tx}:${ty}`);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!def.bridge) throw new GameError('That is open water — a wooden bridge can span it', 409);
			} else {
				throw new GameError('That soil bed is for planting — or clear it with the shovel', 409);
			}
		} else if (def.bridge && area !== 'home') {
			throw new GameError('Bridges go over open water — flood a channel first', 409);
		}

		const craftedItems = { ...(player.craftedItems || {}) };
		craftedItems[objectId] -= 1;
		if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
		await t.Player.patch(playerId, { craftedItems });

		const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = { id: placementId, worldId: wid, playerId, objectId, area, x: tx, y: ty, placedAt: Date.now() };
		await t.Placement.put(placement);

		if (def.isChest) {
			await t.Chest.put({
				id: placementId, worldId: wid, playerId, area, x: tx, y: ty,
				size: objectId, capacity: def.chestCapacity || 60, contents: {},
			});
		}

		// Home decor doesn't affect any biome — skip the recalc entirely.
		if (area === 'home') {
			await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 });
			await awardAchievements(playerId);
			return { ok: true, placement, craftedItems };
		}

		const recalc = await recalcBiome(wid, playerId, area, {
			addPlacements: [placement],
			player: { ...player, craftedItems },
		});
		await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { place: 1 });
		await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
		return { ok: true, placement, craftedItems, ...recalc };
	}
}

/**
 * POST /Plant/ {playerId, area, x, y, plantId}
 * Sow flowers and trees directly into a watered soil bed. The bed is consumed
 * and becomes a growing plant (a placement with a plantedAt timestamp).
 */
export class Plant extends PublicEndpoint {
	async post(data: any) {
		const { playerId, area, x, y, plantId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError(`Unknown area: ${area}`);
		if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);

		const def = d.object.get(plantId);
		if (!def || !def.plantable) throw new GameError('That cannot be planted');
		if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} would not take root in the ${biome.name}`);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const tileId = `${wid}:${area}:${tx}:${ty}`;
		const bed = await findInWorld(t.TerrainTile, wid, tileId);
		if (!bed || bed.type !== 'watered') {
			throw new GameError('Plant into a watered soil bed — dig with the shovel, then water it');
		}

		const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {}, wid);

		await t.TerrainTile.delete(tileId); // the bed becomes the plant
		const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = {
			id: placementId, worldId: wid, playerId, objectId: plantId, area, x: tx, y: ty,
			placedAt: Date.now(), plantedAt: Date.now(),
		};
		await t.Placement.put(placement);

		const recalc = await recalcBiome(wid, playerId, area, {
			addPlacements: [placement],
			removeTerrainIds: [tileId],
			player: { ...player, inventory },
		});
		await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { plant: 1 });
		await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
		return { ok: true, placement, inventory, usedFrom, ...recalc };
	}
}

/** POST /UpdateAppearance/ {playerId, appearance} — restyle your caretaker anytime. */
export class UpdateAppearance extends PublicEndpoint {
	async post(data: any) {
		const { playerId, appearance } = await bodyOf(data);
		await requirePlayer(playerId);
		const clean = sanitizeAppearance(appearance);
		await db().Player.patch(playerId, { appearance: clean });
		return { ok: true, appearance: clean };
	}
}

/** POST /MoveObject/ {playerId, placementId, x, y} — relocate a placed object within its area. */
export class MoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, x, y } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const placements = await byWorld(t.Placement, wid);
		const placement = placements.find((p) => p.id === placementId);
		if (!placement) throw new GameError('Placement not found', 404);
		if (placement.objectId === 'workbench') throw new GameError('The old workbench stays put');

		const dGrid = await defs();
		const grid = areaGrid(dGrid, placement.area);
		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError('That spot is out of reach');
		}
		if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
			throw new GameError('That spot is already taken', 409);
		}
		const d = await defs();
		const movingDef = d.object.get(placement.objectId);
		const tileHere = await findInWorld(t.TerrainTile, wid, `${wid}:${placement.area}:${tx}:${ty}`);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!movingDef?.bridge) throw new GameError('That is open water — only a bridge can sit there', 409);
			} else {
				throw new GameError('That soil bed is for planting', 409);
			}
		} else if (movingDef?.bridge) {
			throw new GameError('Bridges go over open water', 409);
		}

		await t.Placement.patch(placementId, { x: tx, y: ty });
		const chest = await getOwnedChest(t, d, placementId, wid);
		if (chest) await t.Chest.patch(placementId, { x: tx, y: ty }); // chests move with their contents

		return { ok: true, placement: { ...placement, x: tx, y: ty } };
	}
}

/** POST /RemoveObject/ {playerId, placementId} — returns the object to your crafted items. */
export class RemoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const placement = await findInWorld(t.Placement, wid, placementId);
		if (!placement) throw new GameError('Placement not found', 404);
		if (placement.objectId === 'workbench') {
			throw new GameError('Your crafting station stays put — the preserve needs it');
		}

		const chest = await findInWorld(t.Chest, wid, placementId);
		if (chest && sumValues(chest.contents) > 0) {
			throw new GameError('Empty the chest before picking it up', 409);
		}

		// Digging up something you planted returns its materials instead of an item.
		// Refunds respect basket capacity and spill into chests — never silently
		// overflowing the basket (which used to wedge every later withdraw/gather).
		const d = await defs();
		const def = d.object.get(placement.objectId);
		let refunded: Record<string, number> | null = null;
		const craftedItems = { ...(player.craftedItems || {}) };
		const inventory = { ...(player.inventory || {}) };
		const chestUpdates = new Map<string, Record<string, number>>();
		if (def?.plantable && placement.plantedAt && Object.keys(def.plantCost || {}).length) {
			refunded = { ...def.plantCost };
			const capacity = inventoryCapacity(player);
			let carried = sumValues(inventory);
			const chests = (await byWorld(t.Chest, wid)).filter((c) => c.id !== placementId);
			for (const [resId, qty] of Object.entries(refunded!)) {
				let remaining = qty as number;
				const toBasket = Math.min(remaining, Math.max(0, capacity - carried));
				if (toBasket > 0) {
					inventory[resId] = (inventory[resId] || 0) + toBasket;
					carried += toBasket;
					remaining -= toBasket;
				}
				for (const c of chests) {
					if (remaining <= 0) break;
					const contents = chestUpdates.get(c.id) || { ...(c.contents || {}) };
					const room = c.capacity - sumValues(contents);
					const toChest = Math.min(room, remaining);
					if (toChest > 0) {
						contents[resId] = (contents[resId] || 0) + toChest;
						chestUpdates.set(c.id, contents);
						remaining -= toChest;
					}
				}
				if (remaining > 0) {
					throw new GameError('No room for the refunded materials — make space in your basket or a chest first', 409);
				}
			}
		} else {
			craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
		}

		// all checks passed — now write
		if (chest) await t.Chest.delete(placementId);
		await t.Placement.delete(placementId);
		if (refunded) {
			await t.Player.patch(playerId, { inventory });
			for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
		} else {
			await t.Player.patch(playerId, { craftedItems });
		}

		// old saves may still hold retired 'home' placements — skip recalc for those
		const recalc = placement.area !== 'home'
			? await recalcBiome(wid, playerId, placement.area, {
				removeIds: [placementId],
				player: { ...player, craftedItems, inventory },
			})
			: null;
		await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
		await awardWorldAchievements(wid, playerId, recalc ? { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] } : {});
		return { ok: true, removed: placementId, craftedItems, refunded, ...(recalc || {}) };
	}
}

/** POST /UpgradeTool/ {playerId, toolId} */
export class UpgradeTool extends PublicEndpoint {
	async post(data: any) {
		const { playerId, toolId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const toolDef = d.tool.get(toolId);
		if (!toolDef) throw new GameError(`Unknown tool: ${toolId}`);
		const wid = worldOf(player);
		const currentTier = player.tools?.[toolId] || 1;
		const nextTier = (toolDef.tiers || []).find((tt: any) => tt.tier === currentTier + 1);
		if (!nextTier) throw new GameError(`${toolDef.name} is already fully upgraded`);

		if (nextTier.requires?.biome) {
			const bs = await findInWorld(t.BiomeState, wid, `${wid}:${nextTier.requires.biome}`);
			if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
				const biome = d.biome.get(nextTier.requires.biome);
				throw new GameError(
					`Restore ${biome?.name || nextTier.requires.biome} to ${nextTier.requires.minHealth}% health first`, 403
				);
			}
		}

		const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {}, wid);
		const tools = { ...(player.tools || {}), [toolId]: nextTier.tier };
		await t.Player.patch(playerId, { tools });

		// tool upgrades can satisfy biome unlock requirements
		const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, tools } });
		const chests = await byWorld(t.Chest, wid);
		await bumpMetrics(player, { toolsUpgraded: 1 });
		await awardAchievements(playerId);
		return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
	}
}

/** POST /UpgradeHome/ {playerId, track} — level up one of the four home tracks. */
export class UpgradeHome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, track } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const def = HOME_TRACKS[track];
		if (!def) throw new GameError('Unknown home upgrade');
		const home = homeOf(player);
		if (!home.styleLocked) throw new GameError('Build your home in a style first.', 403);
		const level = home[track] || 1;
		const next = def.levels[level]; // levels[level] is the (level+1)th entry
		if (!next) throw new GameError(`Your home's ${def.name.toLowerCase()} is already at its finest.`);

		if (next.requires?.biome) {
			const bs = await findInWorld(t.BiomeState, wid, `${wid}:${next.requires.biome}`);
			if ((bs?.health || 0) < (next.requires.minHealth || 0)) {
				const d = await defs();
				const biome = d.biome.get(next.requires.biome);
				throw new GameError(`Restore ${biome?.name || next.requires.biome} to ${next.requires.minHealth}% health first`, 403);
			}
		}

		const { usedFrom, inventory } = await consumeMaterials(player, next.materials || {}, wid);
		const updated = { ...home, [track]: level + 1 };
		await t.Player.patch(playerId, { home: updated });
		const chests = await byWorld(t.Chest, wid);
		await awardAchievements(playerId);
		return { ok: true, home: updated, inventory, chests, usedFrom, upgraded: { track, level: level + 1, name: def.name } };
	}
}

// Objects you can sleep in/on to rest and refresh the preserve's gathering spots.
const SLEEP_OBJECTS = ['home-sleeping-bag', 'home-bed'];

/** POST /Rest/ {playerId} — sleep in your bed/bag to refresh every gathering spot. */
export class Rest extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const placements = await byWorld(t.Placement, wid);
		if (!placements.some((p) => SLEEP_OBJECTS.includes(p.objectId))) {
			throw new GameError('Craft and place a sleeping bag or bed in your home first.', 403);
		}
		// refresh all resources: clear node cooldowns so every gathering spot is ready
		const nodes = await byWorld(t.NodeState, wid);
		for (const n of nodes) await t.NodeState.delete(n.id);
		return { ok: true, rested: true, refreshed: nodes.length };
	}
}

const isHexColor = (c: any) => typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim());

/** POST /SetHomeColors/ {playerId, colors:{floor?,wall?,accent?}} — recolor the home interior (paint tool, built homes only). */
export class SetHomeColors extends PublicEndpoint {
	async post(data: any) {
		const { playerId, colors } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const home = homeOf(player) as any;
		if (!home.styleLocked) throw new GameError('Build your home before you can repaint it.', 403);
		const next: Record<string, string> = { ...home.colors };
		for (const k of ['floor', 'wall', 'accent', 'rug']) {
			if (colors?.[k] && isHexColor(colors[k])) next[k] = String(colors[k]).trim().toLowerCase();
		}
		await t.Player.patch(playerId, { home: { ...home, colors: next } });
		return { ok: true };
	}
}

/** POST /SetPlacementColor/ {playerId, placementId, color} — recolor one placed item (paint tool). */
export class SetPlacementColor extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, color } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		if (!(homeOf(player) as any).styleLocked) throw new GameError('Build your home before you can repaint your things.', 403);
		if (!isHexColor(color)) throw new GameError('Invalid color');
		const placement = await findInWorld(t.Placement, worldOf(player), placementId);
		if (!placement) throw new GameError('That item is not here', 404);
		await t.Placement.patch(placementId, { color: String(color).trim().toLowerCase() });
		return { ok: true };
	}
}

/**
 * POST /SetHomeStyle/ {playerId, style} — build your home in the chosen style. This
 * is the FIRST upgrade: it costs the first house's materials, restyles the tent into
 * that style, and enlarges it (Space → 2). Only after this do the four upgrade tracks
 * open up. The style is committed once built.
 */
export class SetHomeStyle extends PublicEndpoint {
	async post(data: any) {
		const { playerId, style } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const styleDef = HOME_STYLES[style];
		if (!styleDef) throw new GameError('Unknown home style');
		const home = homeOf(player);
		if (home.styleLocked) throw new GameError('Your home is already built — choose upgrades from here.', 403);
		const wid = worldOf(player);

		// building costs materials unique to the chosen style, behind a shared gate
		if (styleDef.requires?.biome) {
			const bs = await findInWorld(t.BiomeState, wid, `${wid}:${styleDef.requires.biome}`);
			if ((bs?.health || 0) < (styleDef.requires.minHealth || 0)) {
				const d = await defs();
				const biome = d.biome.get(styleDef.requires.biome);
				throw new GameError(`Restore ${biome?.name || styleDef.requires.biome} to ${styleDef.requires.minHealth}% health first`, 403);
			}
		}
		const { usedFrom, inventory } = await consumeMaterials(player, styleDef.materials || {}, wid);
		const updated = { ...home, style, styleLocked: true, space: 2 };
		await t.Player.patch(playerId, { home: updated });
		const chests = await byWorld(t.Chest, wid);
		await awardAchievements(playerId);
		return { ok: true, home: updated, inventory, chests, usedFrom, built: HOME_STYLES[style].name };
	}
}

/** POST /ObserveAnimal/ {playerId, animalId} — record an observation in the field journal. */
export class ObserveAnimal extends PublicEndpoint {
	async post(data: any) {
		const { playerId, animalId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const disc = await findInWorld(t.Discovery, wid, `${wid}:${animalId}`);
		if (!disc) throw new GameError('That animal has not returned yet', 404);
		// An observation is READING about the animal — opening its journal card
		// (or clicking it in the world, which opens the same card). The daily
		// "read about N animals" task only counts each animal once per day, so
		// re-opening the same card isn't farmable.
		const dayKey = Math.floor(Date.now() / DAY_MS);
		const firstToday = disc.lastObservedDayKey !== dayKey;
		const timesObserved = (disc.timesObserved || 0) + 1;
		await t.Discovery.patch(disc.id, { timesObserved, lastObservedDayKey: dayKey });
		await bumpMetrics(player, { animalsObserved: 1 }, firstToday ? { observe: 1 } : {});
		await awardAchievements(playerId);
		return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
	}
}

/**
 * POST /ClaimTask/ {playerId, taskId} — claim a finished daily task's reward.
 * The board itself is derived (see dailyTasksFor); only the claim is stored.
 */
export class ClaimTask extends PublicEndpoint {
	async post(data: any) {
		const { playerId, taskId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const now = Date.now();

		const discoveries = await byWorld(t.Discovery, wid);
		const block = dailyTasksBlock(wid, player, d, discoveries.length, now);
		const task = block.tasks.find((x: any) => x.id === String(taskId || ''));
		if (!task) throw new GameError("That task is not on today's board", 404);
		if (task.claimed) throw new GameError('Already claimed — fresh tasks arrive tomorrow', 409);
		if (task.progress < task.target) throw new GameError('Not finished yet — check the board for what remains', 409);

		// grant the material bundle, respecting carrying capacity
		const capacity = inventoryCapacity(player);
		const inventory = { ...(player.inventory || {}) };
		let room = Math.max(0, capacity - sumValues(inventory));
		const gained: Record<string, number> = {};
		for (const [resId, qty] of Object.entries(task.reward || {})) {
			const take = Math.min(qty as number, room);
			if (take <= 0) continue;
			inventory[resId] = (inventory[resId] || 0) + take;
			gained[resId] = take;
			room -= take;
		}
		if (!Object.keys(gained).length) throw new GameError('Your basket is full — make room for the reward first', 409);

		const claims = player.taskClaims?.dayKey === block.dayKey
			? { dayKey: block.dayKey, claimed: { ...(player.taskClaims.claimed || {}) } }
			: { dayKey: block.dayKey, claimed: {} as Record<string, boolean> };
		claims.claimed[task.id] = true;
		await t.Player.patch(playerId, { inventory, taskClaims: claims });
		await bumpMetrics(player, { tasksCompleted: 1 });
		await awardAchievements(playerId);

		const dailyTasks = {
			...block,
			tasks: block.tasks.map((x: any) => (x.id === task.id ? { ...x, claimed: true } : x)),
		};
		return { ok: true, taskId: task.id, gained, inventory, dailyTasks };
	}
}

/**
 * POST /Terraform/ {playerId, area, x, y, action: 'dig'|'water'|'clear'}
 * Gentle landscape shaping: the shovel prepares a soil bed, the watering can
 * brings it to life (consuming 1 water), and digging again clears it.
 * Watered beds raise biome health directly.
 */
export class Terraform extends PublicEndpoint {
	async post(data: any) {
		const { playerId, area, x, y, action } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError('You can only shape the ground out in the preserve');
		if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const grid = areaGrid(d, area);
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError('That spot is out of reach');
		}
		const placements = await byWorld(t.Placement, wid);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError('Something is already placed there');
		}

		const tileId = `${wid}:${area}:${tx}:${ty}`;
		const existing = await findInWorld(t.TerrainTile, wid, tileId);
		let inventory = player.inventory || {};
		let tile: any = null;
		let removedId: string | undefined;
		let dug: { resourceId: string; amount: number } | null = null;

		if (action === 'dig') {
			if ((player.tools?.shovel || 0) < 1) throw new GameError('You need your shovel for that');
			if (existing) throw new GameError('This ground is already prepared — water it, or clear it instead');
			tile = { id: tileId, worldId: wid, playerId, area, x: tx, y: ty, type: 'tilled', updatedAt: Date.now() };
			await t.TerrainTile.put(tile);

			// Breaking new ground may turn up a buried material. This only happens
			// when DIGGING a fresh bed — never when clearing/draining one back over.
			// The shovel's tier sets how much you pull up at once (tier 1→1 … 4→4),
			// so upgrading it actually pays off.
			const pool = biome.digResources || [];
			if (pool.length && Math.random() < DIG_FIND_CHANCE) {
				const resId = pool[Math.floor(Math.random() * pool.length)];
				const room = Math.max(0, inventoryCapacity(player) - sumValues(inventory));
				const amount = Math.min(player.tools?.shovel || 1, room);
				if (amount > 0) {
					inventory = { ...inventory, [resId]: (inventory[resId] || 0) + amount };
					await t.Player.patch(playerId, { inventory });
					dug = { resourceId: resId, amount };
				}
			}
		} else if (action === 'water') {
			if ((player.tools?.['watering-can'] || 0) < 1) throw new GameError('You need your watering can for that');
			if (!existing) throw new GameError('Prepare a soil bed with your shovel first');
			if (existing.type === 'water') throw new GameError('This is already open water');
			// tilled -> watered bed, watered -> flooded open water: 1 water either way.
			// Chain open-water tiles to shape ponds, lakes, and rivers.
			const cost = 1;
			const newType = existing.type === 'tilled' ? 'watered' : 'water';
			// dry biomes (e.g. the desert) can ready soil beds but cannot be flooded
			if (newType === 'water' && biome.canFlood === false) {
				throw new GameError(`${biome.name} is too dry to flood — soil beds here can only be readied for planting.`);
			}
			const have = (inventory.water || 0) + (inventory['clean-water'] || 0);
			if (have < cost) throw new GameError(`You need ${cost} water for that — gather more first`);
			inventory = { ...inventory };
			let remaining = cost;
			for (const key of ['water', 'clean-water']) {
				const take = Math.min(inventory[key] || 0, remaining);
				if (take > 0) {
					inventory[key] -= take;
					if (inventory[key] <= 0) delete inventory[key];
					remaining -= take;
				}
			}
			await t.Player.patch(playerId, { inventory });
			tile = { ...existing, type: newType, updatedAt: Date.now() };
			await t.TerrainTile.patch(tileId, { type: newType, updatedAt: Date.now() });
		} else if (action === 'clear') {
			if (!existing) throw new GameError('Nothing to clear here');
			await t.TerrainTile.delete(tileId);
			removedId = tileId;
		} else {
			throw new GameError("action must be 'dig', 'water', or 'clear'");
		}

		const recalc = await recalcBiome(wid, playerId, area, {
			addTerrain: tile ? [tile] : [],
			removeTerrainIds: removedId ? [removedId] : [],
			player: { ...player, inventory },
		});
		await bumpMetrics(player, { terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 }, action === 'water' ? { water: 1 } : {});
		await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
		return { ok: true, tile, removedId, dug, inventory, ...recalc };
	}
}

/** POST /RecalcBiome/ {playerId, biomeId} — explicit recalculation (also runs on every placement). */
export class RecalcBiome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const recalcResult = await recalcBiome(worldOf(player), playerId, biomeId);
		await awardWorldAchievements(worldOf(player), playerId, { addDiscoveries: recalcResult.newAnimals, freshBiomeStates: [recalcResult.biomeState] });
		return { ok: true, ...recalcResult };
	}
}

/** POST /SyncPlayer/ {playerId, x, y, area} — persist position (the save point for movement). */
export class SyncPlayer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, x, y, area, tutorialStep } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const patch: any = {};
		if (Number.isFinite(Number(x))) patch.x = Number(x);
		if (Number.isFinite(Number(y))) patch.y = Number(y);
		if (Number.isInteger(tutorialStep) && tutorialStep >= 0 && tutorialStep <= 99) {
			patch.tutorialStep = tutorialStep;
		}
		if (area === 'home') {
			// the home interior is always reachable from your camp — no gates
			patch.area = 'home';
		} else if (area) {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(`Unknown area: ${area}`);
			if (!(player.unlockedBiomes || []).includes(area)) {
				throw new GameError(`${biome.name} is not unlocked yet`, 403);
			}
			if (!biome.explorable) {
				throw new GameError(`${biome.name} is part of the preserve plan but not explorable yet`, 403);
			}
			patch.area = area;
			// Record the first walk into this area — this is what enables fast-travel
			// to it from the preserve guide (you must have physically arrived once).
			const visited = player.visitedBiomes || ['meadow'];
			if (!visited.includes(area)) patch.visitedBiomes = [...visited, area];

			// First time stepping into an area that begins partly shaped, seed its
			// starting terrain now. This also back-fills saves that unlocked the area
			// before the starting-terrain feature existed (e.g. wetlands already open).
			if (STARTING_TERRAIN[area]) {
				const wid = worldOf(player);
				const hasTerrain = (await byWorld(t.TerrainTile, wid)).some((tt) => tt.area === area);
				if (!hasTerrain) {
					await seedStartingTerrain(wid, playerId, area);
					await recalcBiome(wid, playerId, area, { player });
				}
			}
		}
		await t.Player.patch(playerId, patch);
		// the tutorial finishing (and reaching the grasshopper step) can earn First Friend
		if (patch.tutorialStep !== undefined) await awardAchievements(playerId);
		return { ok: true, player: sanitizePlayer(await t.Player.get(playerId)) };
	}
}

/**
 * POST /AppendFeed/ {playerId, entries:[{icon,text,at}]} — persist activity-feed
 * messages so a player can scroll back through them across sessions. Kept bounded:
 * after each append the player's feed is pruned to the most recent FEED_CAP rows.
 */
export class AppendFeed extends PublicEndpoint {
	async post(data: any) {
		const { playerId, entries } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const t = db();
		const list = Array.isArray(entries) ? entries.slice(0, FEED_CAP) : [];
		let added = 0;
		for (const e of list) {
			const text = String(e?.text || '').slice(0, 500).trim();
			if (!text) continue;
			const at = Number(e?.at) || Date.now();
			const icon = String(e?.icon || 'leaf').slice(0, 40);
			const id = `f_${wid}_${at}_${Math.random().toString(36).slice(2, 9)}`;
			await t.FeedEntry.put({ id, worldId: wid, playerId, at, icon, text });
			added++;
		}
		// prune to the most recent FEED_CAP messages for this world
		const all = (await byWorld(t.FeedEntry, wid)).sort((a, b) => (a.at || 0) - (b.at || 0));
		if (all.length > FEED_CAP) {
			for (const old of all.slice(0, all.length - FEED_CAP)) await t.FeedEntry.delete(old.id);
		}
		return { ok: true, added };
	}
}

const SESSION_GAP_MS = 30 * 60 * 1000; // a fresh heartbeat after this gap = a new session
const MAX_BEAT_MS = 90 * 1000; // credit at most this much play time per beat (guards idle/closed tabs)

/**
 * POST /Heartbeat/ {playerId} — the client pings this on a timer while the game
 * is open and focused. We accrue play time from the gap since the last beat
 * (capped, so a backgrounded tab or a closed laptop never inflates the number)
 * and count a new session whenever the gap is large or it's the first beat.
 */
export class Heartbeat extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const now = Date.now();
		const prev = player.metrics || freshMetrics(player.createdAt || now);
		const last = prev.lastHeartbeatAt || 0;
		const gap = now - last;

		let playSeconds = prev.playSeconds || 0;
		let sessions = prev.sessions || 0;
		const newSession = last === 0 || gap > SESSION_GAP_MS;
		if (newSession) {
			sessions += 1; // first beat of a new play session
		} else {
			playSeconds += Math.min(gap, MAX_BEAT_MS) / 1000;
		}

		const metrics = {
			...prev,
			firstSeenAt: prev.firstSeenAt || player.createdAt || now,
			lastSeenAt: now,
			lastHeartbeatAt: now,
			playSeconds: Math.round(playSeconds),
			sessions,
		};
		await t.Player.patch(playerId, { metrics });

		// ---- habitat growth: the preserve keeps living while the game is closed ----
		// Placements mature on wall-clock time (see matureMs), but biome health is
		// only ever recomputed on actions. The heartbeat is the "time passed" action:
		//  • every beat: if any placement crossed maturity since the last beat,
		//    recalc just those biomes (a tree finishing growth mid-session counts);
		//  • first beat of a session after a real absence: recalc every unlocked
		//    biome and shape a small welcome-back summary for the client.
		const wid = worldOf(player);
		let welcomeBack: any = null;
		const newAnimals: any[] = [];
		const freshBiomeStates: any[] = [];
		try {
			const awaySince = prev.lastSeenAt || 0;
			const longAway = newSession && awaySince > 0 && now - awaySince > 10 * 60_000;
			const placements = await byWorld(t.Placement, wid);
			const sinceBeat = last > 0 ? last : now;

			// biomes with a growth threshold crossed since we last looked
			const crossed = new Set<string>();
			for (const p of placements) {
				const def = d.object.get(p.objectId);
				if (maturedBetween(def, p, longAway ? awaySince : sinceBeat, now)) crossed.add(p.area);
			}

			const biomeStates = await byWorld(t.BiomeState, wid);
			const unlockedIds = new Set(biomeStates.filter((b: any) => b.unlocked).map((b: any) => b.biomeId));
			const toRecalc = longAway ? [...unlockedIds] : [...crossed].filter((b) => unlockedIds.has(b));

			let healthGain = 0;
			for (const biomeId of toRecalc) {
				const before = biomeStates.find((b: any) => b.biomeId === biomeId)?.health || 0;
				const r = await recalcBiome(wid, playerId, biomeId, { player });
				healthGain += Math.max(0, (r.biomeState?.health || 0) - before);
				newAnimals.push(...(r.newAnimals || []));
				freshBiomeStates.push(r.biomeState);
			}
			if (newAnimals.length || freshBiomeStates.length) {
				await awardWorldAchievements(wid, playerId, { addDiscoveries: newAnimals, freshBiomeStates });
			}
			if (longAway) {
				const matured = placements.filter((p) => {
					const def = d.object.get(p.objectId);
					return unlockedIds.has(p.area) && maturedBetween(def, p, awaySince, now);
				}).length;
				if (matured > 0 || newAnimals.length > 0 || healthGain > 0) {
					welcomeBack = {
						awayHours: Math.round(((now - awaySince) / 3_600_000) * 10) / 10,
						matured,
						healthGain,
						arrivals: newAnimals.map((n: any) => n.animal?.name).filter(Boolean),
					};
				}
			}
		} catch (e) {
			console.error('heartbeat growth pass skipped:', e); // growth must never break the heartbeat
		}

		await awardAchievements(playerId); // session-count achievements (e.g. A Familiar Face)
		return {
			ok: true,
			metrics: metricsView({ ...player, metrics }),
			...(newAnimals.length ? { newAnimals } : {}),
			...(freshBiomeStates.length ? { biomeStates: freshBiomeStates } : {}),
			...(welcomeBack ? { welcomeBack } : {}),
		};
	}
}

/**
 * GET /Metrics/        — global summary plus a per-player leaderboard.
 * GET /Metrics/<id>    — one player's metrics.
 * Read-only analytics view, safe to point a dashboard or cron at.
 */
export class Metrics extends PublicEndpoint {
	async get() {
		const t = db();
		const id = String((this as any).getId?.() || '').trim();

		if (id) {
			const player = await t.Player.get(id);
			if (!player) throw new GameError('No save found with that id', 404);
			// Per-player lookup includes full biome health numbers (no rendered
			// area snapshots — those were removed).
			const bm = await biomeMetrics(id);
			const view = metricsView(player);
			return {
				player: {
					...view,
					biomeSummary: bm.summary,
					activation: activationFlags(view, bm.summary, player),
					achievements: await achievementMetrics(id),
					biomes: bm.biomes,
				},
			};
		}

		// Global view stays light: biome health summaries per player, no images.
		const now = Date.now();
		const players = await allOf(t.Player);
		const allStates = await allOf(t.BiomeState);
		const d = await defs();

		const statesByPlayer = new Map<string, any[]>();
		for (const s of allStates) {
			const arr = statesByPlayer.get(s.playerId) || [];
			arr.push(s);
			statesByPlayer.set(s.playerId, arr);
		}

		const views = players
			.map((p) => {
				const view = metricsView(p);
				const biomeSummary = summarizeBiomes(statesByPlayer.get(p.id) || []);
				return { ...view, biomeSummary, activation: activationFlags(view, biomeSummary, p) };
			})
			.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);

		// Solo desktop/web players sync their local metrics view up periodically
		// (see SyncMetrics). Each snapshot has the same shape as a hosted view
		// (metricsView + biomeSummary + activation), so they merge straight into
		// the same list and every aggregate below counts them like anyone else.
		// Recency fields are recomputed here — the snapshot's were frozen at
		// sync time. A missing table (instance not restarted after the schema
		// deploy yet) must never break the dashboard.
		let soloViews: any[] = [];
		try {
			soloViews = (await allOf(t.SoloMetrics)).map((r: any) => {
				const s = r.snapshot || {};
				const lastSeenAt = s.lastSeenAt || r.updatedAt || null;
				const createdAt = s.createdAt || r.createdAt || now;
				const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
				let status: 'active' | 'recent' | 'dormant' = 'dormant';
				if (hoursSinceActive != null) {
					if (hoursSinceActive <= 24) status = 'active';
					else if (hoursSinceActive <= 24 * 7) status = 'recent';
				}
				return {
					...s,
					playerId: r.id, // slot-scoped id — solo name slugs can collide across machines
					solo: true,
					platform: r.platform || null,
					os: r.os || null,
					version: r.version || null,
					build: r.build || null,
					lastSyncedAt: r.updatedAt || null,
					counts: s.counts || {},
					playSeconds: s.playSeconds || 0,
					sessions: s.sessions || 0,
					totalActions: s.totalActions || 0,
					unlockedBiomes: s.unlockedBiomes || 0,
					activation: s.activation || {},
					biomeSummary: s.biomeSummary || { biomesUnlocked: 0, avgHealth: 0, biomesFullyRestored: 0, totalReturned: 0 },
					createdAt,
					lastSeenAt,
					hoursSinceActive,
					status,
					daysSinceJoined: Math.floor((now - createdAt) / DAY_MS),
					isNewToday: now - createdAt <= DAY_MS,
				};
			});
		} catch { /* SoloMetrics table not created yet */ }

		// Hosted + solo in one list — "players" means everyone from here down.
		const all = [...views, ...soloViews]
			.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);

		const N = all.length || 1;
		const pct = (n: number) => Math.round((n / N) * 100);

		// Action totals across everyone.
		const actionTotals: Record<string, number> = {};
		for (const v of all) {
			for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + (n as number);
		}

		const totalPlaySeconds = all.reduce((acc, v) => acc + v.playSeconds, 0);
		const totalSessions = all.reduce((acc, v) => acc + v.sessions, 0);
		const totalActions = all.reduce((acc, v) => acc + v.totalActions, 0);

		// Audience buckets by recency / recency of joining.
		const audience = {
			activeLast24h: all.filter((v) => v.status === 'active').length,
			activeLast7d: all.filter((v) => v.status === 'active' || v.status === 'recent').length,
			dormant: all.filter((v) => v.status === 'dormant').length,
			newLast24h: all.filter((v) => now - v.createdAt <= DAY_MS).length,
			newLast7d: all.filter((v) => now - v.createdAt <= 7 * DAY_MS).length,
		};

		// Retention: did they come back for more than one session?
		const returningPlayers = all.filter((v) => v.sessions >= 2).length;

		// Activation funnel — how far players get from first launch.
		const funnel = {
			created: all.length,
			collected: all.filter((v) => v.activation.collected).length,
			crafted: all.filter((v) => v.activation.crafted).length,
			placed: all.filter((v) => v.activation.placed).length,
			attractedAnimal: all.filter((v) => v.activation.attractedAnimal).length,
			unlockedSecondBiome: all.filter((v) => v.activation.unlockedSecondBiome).length,
		};
		const funnelPct = {
			collected: pct(funnel.collected),
			crafted: pct(funnel.crafted),
			placed: pct(funnel.placed),
			attractedAnimal: pct(funnel.attractedAnimal),
			unlockedSecondBiome: pct(funnel.unlockedSecondBiome),
		};

		// Where players spend time, and where they stall.
		const areaTally: Record<string, number> = {};
		for (const v of all) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
		const mostPopularArea =
			Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

		const perBiome = new Map<string, { players: number; healthSum: number; returned: number; fully: number }>();
		for (const s of allStates) {
			if (!s.unlocked) continue;
			const e = perBiome.get(s.biomeId) || { players: 0, healthSum: 0, returned: 0, fully: 0 };
			e.players++;
			e.healthSum += s.health || 0;
			e.returned += s.returnedCount || 0;
			if ((s.health || 0) >= 100) e.fully++;
			perBiome.set(s.biomeId, e);
		}
		const biomeBreakdown = d.biomes.map((b: any) => {
			const e = perBiome.get(b.id);
			return {
				biomeId: b.id,
				name: b.name,
				playersUnlocked: e?.players || 0,
				avgHealth: e?.players ? Math.round(e.healthSum / e.players) : 0,
				totalAnimalsReturned: e?.returned || 0,
				fullyRestored: e?.fully || 0,
			};
		});

		const withBiomes = all.filter((v) => v.biomeSummary.biomesUnlocked > 0);
		const avgBiomeHealth = withBiomes.length
			? Math.round(withBiomes.reduce((acc, v) => acc + v.biomeSummary.avgHealth, 0) / withBiomes.length)
			: 0;

		// Achievements: per-achievement earn counts (where players stall) + averages.
		const achRows = await allOf(t.PlayerAchievement);
		const earnedByPlayer = new Map<string, number>();
		const distribution: Record<string, number> = {};
		for (const r of achRows) {
			distribution[r.achievementId] = (distribution[r.achievementId] || 0) + 1;
			earnedByPlayer.set(r.playerId, (earnedByPlayer.get(r.playerId) || 0) + 1);
		}
		// completion histogram in buckets of 10 (0-10, 11-20, …) — hosted players
		// only: solo achievement rows live in local saves, not PlayerAchievement.
		const completionHistogram: Record<string, number> = {};
		for (const v of views) {
			const n = earnedByPlayer.get(v.playerId) || 0;
			const bucket = n === 0 ? '0' : `${Math.floor((n - 1) / 10) * 10 + 1}-${(Math.floor((n - 1) / 10) + 1) * 10}`;
			completionHistogram[bucket] = (completionHistogram[bucket] || 0) + 1;
		}
		const achievementsSummary = {
			totalDefined: d.achievements.length,
			totalEarned: achRows.length,
			// hosted denominator — PlayerAchievement rows only exist for hosted saves
			avgPerPlayer: round1(achRows.length / (views.length || 1)),
			playersWithFirstFriend: distribution['welcome-grasshopper'] || 0,
			distribution,
			completionHistogram,
		};

		// Co-op participation: shared worlds, who's in them, and pending invites.
		const allWorlds = await allOf(t.World);
		const coopWorlds = allWorlds.filter((w: any) => !w.solo);
		const coopIds = new Set(coopWorlds.map((w: any) => w.id));
		const coopMembers = (await allOf(t.WorldMember)).filter((m: any) => coopIds.has(m.worldId));
		const pendingJoins = (await allOf(t.JoinRequest)).filter((r: any) => r.status === 'pending').length;
		const coopSummary = {
			coopWorlds: coopWorlds.length,
			playersInCoop: new Set(coopMembers.map((m: any) => m.playerId)).size,
			avgMembersPerCoopWorld: coopWorlds.length ? round1(coopMembers.length / coopWorlds.length) : 0,
			pendingJoinRequests: pendingJoins,
		};

		return {
			generatedAt: now,
			summary: {
				players: all.length,
				hostedPlayers: views.length,
				soloPlayers: soloViews.length,
				audience,
				engagement: {
					totalPlayHours: round1(totalPlaySeconds / 3600),
					totalPlaySeconds,
					avgPlayMinutesPerPlayer: Math.round(totalPlaySeconds / 60 / N),
					totalSessions,
					avgSessionsPerPlayer: round1(totalSessions / N),
					avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
					totalActions,
					avgActionsPerPlayer: round1(totalActions / N),
				},
				retention: {
					returningPlayers,
					returningRatePct: pct(returningPlayers),
				},
				progression: {
					avgBiomeHealth,
					biomesFullyRestored: all.reduce((acc, v) => acc + (v.biomeSummary.biomesFullyRestored || 0), 0),
					avgUnlockedBiomes: round1(all.reduce((acc, v) => acc + v.unlockedBiomes, 0) / N),
					mostPopularArea,
				},
				funnel,
				funnelPct,
				actionTotals,
				achievements: achievementsSummary,
				coop: coopSummary,
				biomeBreakdown,
			},
			// One combined list — solo entries carry `solo: true` (+ platform/build
			// /lastSyncedAt) so a dashboard can still tell them apart.
			players: all,
		};
	}
}

/**
 * GET /BiomeSnapshot/<playerId> — generated SVG "postcards" of each unlocked
 * area, returned both as a base64 data URI (`image`) and raw markup (`svg`).
 * Rendered live from the player's current placements and terrain.
 */
export class BiomeSnapshot extends PublicEndpoint {
	async get() {
		const id = String((this as any).getId?.() || '').trim();
		if (!id) throw new GameError('Add a player id to the path: /BiomeSnapshot/<playerId>');
		await requirePlayer(id);
		const t = db();
		const d = await defs();
		const states = (await byPlayer(t.BiomeState, id)).filter((s) => s.unlocked);
		const placements = await byPlayer(t.Placement, id);
		const terrain = await byPlayer(t.TerrainTile, id);

		const areas = states.map((s) => {
			const biome = d.biome.get(s.biomeId);
			const pls = placements.filter((p) => p.area === s.biomeId);
			const ter = terrain.filter((tt) => tt.area === s.biomeId);
			const svg = renderBiomeSVG(d, biome, s.health || 0, pls, ter);
			return {
				area: s.biomeId,
				name: biome?.name || s.biomeId,
				health: s.health || 0,
				placements: pls.length,
				image: svgDataUri(svg),
				svg,
			};
		});

		return { ok: true, playerId: id, areas };
	}
}

/**
 * POST /DevTools/ {playerId, action, ...args} — testing helpers for development.
 * Not part of normal play; the client only exposes these behind a hidden dev panel.
 * Actions: 'seed-water' (reseed an area's starting terrain), 'clear-terrain',
 * 'grant-resources', 'max-tools', 'unlock-all', 'set-health', 'reset-biome'
 * (wipe the area back to its damaged state, keeping chests), 'lock-biome'
 * (re-lock the area to retest the unlock flow), 'unlock-recipes' (toggle all
 * recipes craftable), 'welcome-animals' (force every animal in the area back).
 */
const DEV_PLAYER = 'bailey'; // dev tools are restricted to this save

export class DevTools extends PublicEndpoint {
	async post(data: any) {
		const { playerId, action, area, amount, value, resources, animalId } = await bodyOf(data);
		// No username gate — the hidden panel is reached via a secret key sequence.
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const log: string[] = [];

		switch (action) {
			case 'seed-water': {
				// reset the area's terrain and lay down its starting layout again
				const ar = area || 'wetland';
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}
				await seedStartingTerrain(playerId, playerId, ar);
				await recalcBiome(playerId, playerId, ar, { player });
				log.push(`Reseeded starting terrain for ${ar}`);
				break;
			}
			case 'clear-terrain': {
				const ar = area || player.area;
				let n = 0;
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
					n++;
				}
				await recalcBiome(playerId, playerId, ar, { player });
				log.push(`Cleared ${n} terrain tiles in ${ar}`);
				break;
			}
			case 'grant-resources': {
				const inventory = { ...(player.inventory || {}) };
				const valid = new Set(d.resources.map((r: any) => r.id));
				let granted = 0;
				if (resources && typeof resources === 'object') {
					// per-resource amounts: { seeds: 50, clay: 10, ... }
					for (const [id, qty] of Object.entries(resources)) {
						const n = Math.floor(Number(qty) || 0);
						if (n > 0 && valid.has(id)) { inventory[id] = (inventory[id] || 0) + n; granted++; }
					}
					log.push(`Granted ${granted} resource type${granted === 1 ? '' : 's'}`);
				} else {
					// fallback: a flat amount of every resource
					const give = Math.max(1, Number(amount) || 200);
					for (const r of d.resources) inventory[r.id] = (inventory[r.id] || 0) + give;
					log.push(`Granted ${give} of every resource`);
				}
				await t.Player.patch(playerId, { inventory });
				break;
			}
			case 'max-tools': {
				const tools = { ...(player.tools || {}) };
				for (const tool of d.tools) {
					const top = Math.max(...tool.tiers.map((ti: any) => ti.tier));
					tools[tool.id] = top;
				}
				await t.Player.patch(playerId, { tools });
				log.push('All tools set to max tier');
				break;
			}
			case 'unlock-all': {
				const ids = d.biomes.map((b: any) => b.id);
				await t.Player.patch(playerId, { unlockedBiomes: ids });
				for (const id of ids) await t.BiomeState.patch(`${playerId}:${id}`, { unlocked: true });
				log.push(`Unlocked all biomes (${ids.length})`);
				break;
			}
			case 'unlock-next': {
				// unlock just the next locked biome in order (test progression one step)
				const sorted = [...d.biomes].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
				const unlocked = new Set<string>(player.unlockedBiomes || ['meadow']);
				const nextB = sorted.find((b: any) => !unlocked.has(b.id));
				if (!nextB) { log.push('Every biome is already unlocked'); break; }
				unlocked.add(nextB.id);
				await t.Player.patch(playerId, { unlockedBiomes: [...unlocked] });
				await t.BiomeState.patch(`${playerId}:${nextB.id}`, { unlocked: true });
				await seedStartingTerrain(playerId, playerId, nextB.id);
				log.push(`Unlocked the next area: ${nextB.name}`);
				break;
			}
			case 'relock-all': {
				// re-lock everything except the meadow, to retest the whole unlock flow
				await t.Player.patch(playerId, { unlockedBiomes: ['meadow'] });
				for (const b of d.biomes) await t.BiomeState.patch(`${playerId}:${b.id}`, { unlocked: b.id === 'meadow' });
				log.push('Re-locked every biome except the meadow');
				break;
			}
			case 'reset-tools': {
				await t.Player.patch(playerId, { tools: { ...START_TOOLS } });
				log.push('Tools reset to tier 1');
				break;
			}
			case 'build-home': {
				// build/found the home in a style (Space → 2, style locked)
				const style = value && HOME_STYLES[value] ? value : 'cabin';
				const home = { ...homeOf(player), style, space: Math.max(2, homeOf(player).space || 1), styleLocked: true };
				await t.Player.patch(playerId, { home });
				log.push(`Built home: ${HOME_STYLES[style].name}`);
				break;
			}
			case 'max-home': {
				const home = {
					style: value && HOME_STYLES[value] ? value : (homeOf(player).style || 'cabin'),
					space: HOME_TRACKS.space.levels.length,
					comfort: HOME_TRACKS.comfort.levels.length,
					decor: HOME_TRACKS.decor.levels.length,
					light: HOME_TRACKS.light.levels.length,
					styleLocked: true,
				};
				await t.Player.patch(playerId, { home });
				log.push('Home maxed on every track');
				break;
			}
			case 'reset-home': {
				await t.Player.patch(playerId, { home: { ...DEFAULT_HOME } });
				log.push('Home reset to the starter tent');
				break;
			}
			case 'set-health': {
				const ar = area || player.area;
				const h = Math.max(0, Math.min(100, Number(value) || 100));
				await t.BiomeState.patch(`${playerId}:${ar}`, { health: h });
				log.push(`Set ${ar} health to ${h}% (recomputes on next change)`);
				break;
			}
			case 'reset-biome': {
				// Wipe the current area back to its damaged starting state: remove all
				// placed habitat, terraforming, returned animals, and node timers, then
				// reseed the starting terrain and recompute. Chests (and the materials
				// inside them) are kept so a reset never destroys stored inventory.
				const ar = area || player.area;
				let placementsRemoved = 0;
				for (const pl of (await byPlayer(t.Placement, playerId)).filter((x) => x.area === ar)) {
					if (d.object.get(pl.objectId)?.isChest) continue; // keep chests + contents
					await t.Placement.delete(pl.id);
					placementsRemoved++;
				}
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}
				let animalsRemoved = 0;
				for (const disc of (await byPlayer(t.Discovery, playerId)).filter((x) => x.biomeId === ar)) {
					await t.Discovery.delete(disc.id);
					animalsRemoved++;
				}
				const nodePrefix = `${playerId}:${ar}:`;
				for (const ns of (await byPlayer(t.NodeState, playerId)).filter((x) => String(x.id).startsWith(nodePrefix))) {
					await t.NodeState.delete(ns.id);
				}
				await t.BiomeState.patch(`${playerId}:${ar}`, { health: BASE_HEALTH, balance: 0, returnedCount: 0 });
				await seedStartingTerrain(playerId, playerId, ar);
				await recalcBiome(playerId, playerId, ar, { player });
				log.push(`Reset ${ar} to its damaged state — removed ${placementsRemoved} object${placementsRemoved === 1 ? '' : 's'} and sent ${animalsRemoved} animal${animalsRemoved === 1 ? '' : 's'} away (chests kept)`);
				break;
			}
			case 'lock-biome': {
				// Re-lock the current area so the unlock flow can be retested. The
				// starting meadow can't be locked — you'd have nowhere to stand.
				const ar = area || player.area;
				if (ar === 'meadow') throw new GameError('The starting meadow cannot be locked');
				const unlocked = (player.unlockedBiomes || []).filter((b: string) => b !== ar);
				await t.Player.patch(playerId, { unlockedBiomes: unlocked });
				await t.BiomeState.patch(`${playerId}:${ar}`, { unlocked: false });
				log.push(`Locked ${ar} again (unlock requirements must be met to re-enter)`);
				break;
			}
			case 'unlock-recipes': {
				// Toggle the dev "all recipes craftable" override (ignores progress gates).
				const next = value === undefined ? !player.devUnlockAll : !!value;
				await t.Player.patch(playerId, { devUnlockAll: next });
				log.push(next ? 'All recipes unlocked (gates ignored)' : 'Recipe progress gates restored');
				break;
			}
			case 'welcome-animals': {
				// Force every animal in the current area to return — handy for testing
				// the journal, balance, and fully-recovered states.
				const ar = area || player.area;
				const here = d.animals.filter((a: any) => a.biome === ar);
				const already = new Set((await byPlayer(t.Discovery, playerId)).filter((x) => x.biomeId === ar).map((x) => x.animalId));
				let added = 0;
				for (const animal of here) {
					if (already.has(animal.id)) continue;
					await t.Discovery.put({
						id: `${playerId}:${animal.id}`, playerId, animalId: animal.id, biomeId: ar,
						comfort: 3, timesObserved: 0, firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
					added++;
				}
				await recalcBiome(playerId, playerId, ar, { player });
				log.push(`Welcomed ${added} animal${added === 1 ? '' : 's'} to ${ar} (${here.length} total)`);
				break;
			}
			case 'spawn-animal': {
				// Force a single animal (by id) to return — handy for checking one
				// species' sprite/entry without restoring its whole habitat.
				const animal = d.animals.find((a: any) => a.id === animalId);
				if (!animal) throw new GameError(`Unknown animal: ${animalId}`);
				const discId = `${playerId}:${animal.id}`;
				const existing = await t.Discovery.get(discId);
				if (!existing) {
					await t.Discovery.put({
						id: discId, playerId, animalId: animal.id, biomeId: animal.biome,
						comfort: 85, timesObserved: 1, firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
				}
				// Make sure the animal's biome is reachable so you can actually go see it.
				const unlocked: string[] = player.unlockedBiomes || ['meadow'];
				if (!unlocked.includes(animal.biome)) {
					await t.Player.patch(playerId, { unlockedBiomes: [...unlocked, animal.biome] });
				}
				// recalcBiome recomputes comfort from the (probably bare) habitat, which
				// would drop this animal to "rarely seen" and skip drawing it. Run it for
				// returnedCount/unlocks, then force comfort high so the spawn is visible.
				await recalcBiome(playerId, playerId, animal.biome, { player });
				await t.Discovery.patch(discId, { comfort: 85 });
				log.push(`Spawned ${animal.name} in ${animal.biome} — comfort 85, biome unlocked`);
				break;
			}
			default:
				throw new GameError(`Unknown dev action: ${action}`);
		}

		return { ok: true, log, state: await snapshot(playerId) };
	}
}

// ---------------------------------------------------------------- feedback
// Player feedback flows: client → POST /SubmitFeedback/ (always over the
// network to the hosted Harper, even from solo desktop builds — the client
// keeps an offline queue in localStorage and retries at session start until
// this returns ok) → stored in the Feedback table. The developer reads it
// back with GET /ListFeedback/, which requires Harper admin auth:
//   curl -u HDB_ADMIN https://wild.willows.harperfabric.com/ListFeedback/

const FEEDBACK_MAX_CHARS = 4000;

/**
 * POST /SubmitFeedback/ {message, replyTo?, metrics?, queuedAt?} — store the
 * feedback. Returns ok:true once the row is durably stored, which is the
 * client's cue to drop its local offline-queue copy.
 */
export class SubmitFeedback extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const message = String(body.message || '').trim();
		if (!message) throw new GameError('Please write a little something first');
		if (message.length > FEEDBACK_MAX_CHARS) throw new GameError(`Feedback is limited to ${FEEDBACK_MAX_CHARS} characters`);
		const replyTo = String(body.replyTo || '').trim().slice(0, 200) || null;
		if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new GameError('That reply email doesn’t look right — leave it blank if you don’t want a response');
		const metrics = body.metrics && typeof body.metrics === 'object' && !Array.isArray(body.metrics) ? body.metrics : {};
		const queuedAt = Number(body.queuedAt) || null;

		const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
		await db().Feedback.put({ id, message, replyTo, metrics, queuedAt, createdAt: Date.now() });
		return { ok: true, id };
	}
}

/**
 * GET /ListFeedback/ — every piece of player feedback, newest first.
 *
 * Deliberately extends the raw Resource (NOT PublicEndpoint), so Harper's
 * default permissions apply: only an authenticated super user can read it.
 * Feedback rows carry players' reply emails, which must never be public.
 */
export class ListFeedback extends Resource {
	async get() {
		const rows = await allOf(db().Feedback);
		rows.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
		return { count: rows.length, feedback: rows };
	}
}

// ---------------------------------------------------------------- solo metrics uplink
// Solo runs entirely in-app against local save files, so its players never
// appear in the hosted Player table. The client periodically POSTs the local
// save's derived metrics view here (see src/solo/metricsUplink.ts) — best
// effort, whenever a connection exists — and the row is upserted per save
// slot. The global /Metrics/ view then reports solo players alongside the
// hosted (web/co-op) ones.

const METRICS_SNAPSHOT_MAX_BYTES = 24_000;

/**
 * POST /SyncMetrics/ {clientId, name?, platform?, build?, snapshot} — upsert
 * one solo save's metrics view. `clientId` is the save slot's UUID, so the
 * same preserve updates the same row forever and renamed saves don't fork.
 */
export class SyncMetrics extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const clientId = String(body.clientId || '').trim().slice(0, 64);
		if (!clientId) throw new GameError('clientId required');
		const snapshot = body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot) ? body.snapshot : null;
		if (!snapshot) throw new GameError('snapshot required');
		if (JSON.stringify(snapshot).length > METRICS_SNAPSHOT_MAX_BYTES) throw new GameError('snapshot too large');

		const t = db();
		const id = `solo:${clientId}`;
		const existing = await safeGet(t.SoloMetrics, id);
		await t.SoloMetrics.put({
			id,
			clientId,
			name: String(body.name || snapshot.name || '').slice(0, 40),
			platform: String(body.platform || '').slice(0, 20) || null, // desktop | web
			os: String(body.os || '').slice(0, 20) || null,             // mac | windows | linux | …
			version: String(body.version || '').slice(0, 24) || null,   // wild-willows release
			build: String(body.build || '').slice(0, 40) || null,       // build timestamp
			snapshot,
			createdAt: existing?.createdAt || Date.now(),
			updatedAt: Date.now(),
		});
		return { ok: true };
	}
}

// ---------------------------------------------------------------- policy pages
// The hosted Harper serves NO static files — it is endpoints only (the game UI
// ships inside the desktop app). But store listings still need public URLs for
// the privacy policy and age-suitability pages, so these two endpoints return
// the HTML inlined from public/*.html (via scripts/build-pages.mjs, run by
// `npm run build:server`). Returning { headers, body } bypasses Harper's
// content negotiation, so the browser gets real text/html.
//
// Harper's path matcher also strips a .html suffix when resolving a resource,
// so the canonical store-facing URLs work as plain pages:
//   GET /privacy.html     → privacy      (also /privacy/)
//   GET /age-rating.html  → age-rating   (also /age-rating/)

const htmlPage = (html: string) => ({
	status: 200,
	headers: {
		'content-type': 'text/html; charset=utf-8',
		'cache-control': 'public, max-age=3600',
	},
	body: html,
});

/** GET /privacy.html — the privacy policy (linked from App Store Connect, itch, etc.). */
class PrivacyPage extends PublicEndpoint {
	async get() {
		return htmlPage(privacyHtml);
	}
}

/** GET /age-rating.html — age-suitability / content information page. */
class AgeRatingPage extends PublicEndpoint {
	async get() {
		return htmlPage(ageRatingHtml);
	}
}

/** GET /support.html — support / FAQ page (App Store Connect's Support URL). */
class SupportPage extends PublicEndpoint {
	async get() {
		return htmlPage(supportHtml);
	}
}

// Export under the exact URL paths (string export names keep the hyphen).
export { PrivacyPage as privacy, AgeRatingPage as 'age-rating', SupportPage as support };

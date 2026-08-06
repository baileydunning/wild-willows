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

// node:zlib is used ONLY on the hosted Harper (Node), to compress the big
// GameData response. This module is also bundled into the renderer for the
// in-app solo backend, so — exactly like node:crypto above — Vite aliases
// 'node:zlib' to a browser shim for the web build (see vite.config.ts +
// src/solo/zlibShim.ts). The server's esbuild build keeps the real node:zlib.
// The shim's functions are never actually invoked in the renderer: GameData.get()
// returns the plain object before touching compression when there's no HTTP context.
// @ts-ignore — node:zlib resolves via Vite's alias (web build) and the Harper Node
// runtime (server build); there are deliberately no @types/node in this project.
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';

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
import {
	weatherSnapshot,
	weatherTypeAt,
	gatherResourceIdFor,
	isWeatherGatheredResource,
	seasonAt,
	dayPhaseAt,
	nextDawnAt,
	nextPhaseAt,
	WEATHER_TYPES,
	SEASONS,
} from './weather';
// Player-facing text goes through tr() (i18n `t`, aliased because most handlers
// shadow the bare name with `const t = db()`).
import { t as tr } from '../src/i18n/server';
// Policy pages (privacy / age suitability), inlined from public/*.html by
// scripts/build-pages.mjs — served as endpoints, see the bottom of this file.
import { privacyHtml, ageRatingHtml, supportHtml, dashboardHtml, landingHtml, ogImageB64, buildStamp } from './pages';

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
	// `clockOffsetMs` lets in-game actions nudge the calendar forward (e.g. sleeping
	// skips to the start of the next day) on top of accrued play time.
	return Math.max(0, Math.round((readMetrics(player)?.playSeconds || 0) * 1000) + (player?.clockOffsetMs || 0));
}

// `databases.wildwillows` is undefined right after the database is dropped (until
// Harper restarts and the component recreates the tables). Fail cleanly with a 503
// instead of throwing raw TypeErrors on every request.
const db = () => {
	const d = typeof databases !== 'undefined' && databases ? databases.wildwillows : null;
	if (!d || !d.Player) throw new GameError(tr('server.err.dbStarting'), 503);
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
// weather module use. Rotating daily tasks are a pure function of (worldId,
// player-local day), so a device can re-derive the list with no stored state.
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
	if (!Number.isInteger(v) || v <= 0) throw new GameError(tr('server.err.positiveWholeNumber', { label }));
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
	try {
		await table.delete(id);
		return true;
	} catch (e) {
		if (!isDecodeError(e)) throw e;
	}
	try {
		await table.put({ id }); // overwrite the corrupt bytes with a valid stub
		await table.delete(id); // now it decodes → deletes cleanly
		return true;
	} catch {
		return false;
	}
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
		if (rec) {
			try {
				JSON.stringify({ ...rec });
			} catch (e) {
				if (isDecodeError(e)) throw e;
			}
		}
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

/**
 * Find a terrain tile by its board position (area + x + y), scoped to the world
 * — independent of the row's id string. Older saves keyed terrain ids off the
 * playerId (`${playerId}:${area}:${x}:${y}`) while current code keys them off
 * the worldId, so an exact-id lookup misses legacy beds even though they still
 * render (the world snapshot matches them by worldId). Matching on coordinates
 * recognizes them regardless of the id scheme; callers act on the tile's real
 * `.id`, so legacy rows are patched/deleted correctly and heal over time.
 */
async function findTerrainAt(table: any, worldId: string, area: string, x: number, y: number): Promise<any | null> {
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.area === area && r.x === x && r.y === y) || null;
}

/**
 * Find a world's BiomeState / Discovery row by its natural key (biomeId /
 * animalId) rather than a reconstructed `${worldId}:${key}` id — same legacy-id
 * safeguard as findTerrainAt. Callers patch the row's real `.id`.
 */
async function findBiomeState(table: any, worldId: string, biomeId: string): Promise<any | null> {
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.biomeId === biomeId) || null;
}
async function findDiscovery(table: any, worldId: string, animalId: string): Promise<any | null> {
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.animalId === animalId) || null;
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
			name: player.name ? tr('server.world.soloName', { name: player.name }) : tr('server.world.mySoloName'),
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
			id: memberId,
			worldId: soloId,
			playerId: player.id,
			role: 'owner',
			joinedAt: player.createdAt || Date.now(),
			lastSeenAt: Date.now(),
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
	const members = await byPlayer(t.WorldMember, playerId);
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
		'WorldMember',
		'World',
		'WorldPresence',
		'JoinRequest',
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
//
// SIGNATURE PERKS: each style also carries a perk in the spirit of its build —
// the cabin's woodcraft finds extra materials while gathering, the cottage's
// green thumb gives new plantings a growth head start, the stone hearth's
// thrift sometimes returns crafting materials. A perk's strength starts at
// `base` when the house is built and gains `perLevel` for EVERY level added on
// ANY of the four tracks (capped at `cap`), so each upgrade makes the house
// play better, not just look better. See homePerk() for the math.
const HOME_BUILD_GATE = { biome: 'meadow', minHealth: 30 };
type HomePerkDef = { id: 'forage' | 'growth' | 'thrift'; base: number; perLevel: number; cap: number };
const HOME_STYLES: Record<
	string,
	{
		name: string;
		floor: string;
		wall: string;
		accent: string;
		materials: Record<string, number>;
		requires: { biome: string; minHealth: number };
		perk: HomePerkDef;
	}
> = {
	cabin: {
		name: 'Log Cabin',
		floor: '#c8a064',
		wall: '#5e3f29',
		accent: '#b5707a',
		materials: { branches: 16, fiber: 6 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'forage', base: 0.1, perLevel: 0.05, cap: 0.6 },
	}, // warm golden pine + dark logs
	cottage: {
		name: 'Meadow Cottage',
		floor: '#e6d3a6',
		wall: '#aab9c6',
		accent: '#7fae6a',
		materials: { wildflowers: 6, fiber: 10, clay: 4 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'growth', base: 0.1, perLevel: 0.04, cap: 0.5 },
	}, // pale wood + airy blue-grey + green
	stone: {
		name: 'Stone Hearth',
		floor: '#a9a499',
		wall: '#6f6a62',
		accent: '#d98a4f',
		materials: { stones: 14, clay: 6 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'thrift', base: 0.1, perLevel: 0.05, cap: 0.6 },
	}, // slate floor + grey stone + hearth orange
};
const DEFAULT_HOME = { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };

// Each track is a list of levels (index 0 = level 1, free starter). Higher levels
// cost materials and a little biome progress.
const HOME_TRACKS: Record<string, { name: string; blurb: string; levels: any[] }> = {
	space: {
		name: 'Space',
		blurb: 'A bigger room with more floor to decorate.',
		levels: [
			{ inner: { w: 6, h: 5 } }, // tent
			{ inner: { w: 8, h: 6 }, materials: { branches: 12, fiber: 8 }, requires: { biome: 'meadow', minHealth: 30 } },
			{
				inner: { w: 10, h: 7 },
				materials: { branches: 18, stones: 6, clay: 6 },
				requires: { biome: 'forest', minHealth: 45 },
			},
			{
				inner: { w: 12, h: 9 },
				materials: { branches: 24, clay: 10, 'clean-water': 6 },
				requires: { biome: 'wetland', minHealth: 55 },
			},
		],
	},
	comfort: {
		name: 'Comfort',
		blurb: 'Carry more on every gathering trip (+capacity).',
		levels: [
			{ carry: 0 },
			{ carry: 45, materials: { fiber: 10, branches: 4 }, requires: { biome: 'meadow', minHealth: 35 } },
			{ carry: 95, materials: { fiber: 14, moss: 6 }, requires: { biome: 'forest', minHealth: 50 } },
			{ carry: 160, materials: { reeds: 10, fiber: 12 }, requires: { biome: 'wetland', minHealth: 60 } },
		],
	},
	decor: {
		name: 'Furnishings',
		blurb: 'A finer rug and wall trim in your style.',
		levels: [
			{},
			{ materials: { fiber: 8, wildflowers: 4 } },
			{ materials: { fiber: 12, berries: 6 }, requires: { biome: 'meadow', minHealth: 50 } },
			{ materials: { fiber: 16, clay: 6 }, requires: { biome: 'forest', minHealth: 55 } },
		],
	},
	light: {
		name: 'Warmth',
		blurb: 'Windows and a warm hearth glow.',
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

// A freshly built house sits at 5 total track levels (space 2 + three at 1);
// every level bought on any track past that strengthens the style's perk.
const HOME_BASE_LEVELS = 5;

/**
 * The signature perk of the player's house style, with its CURRENT strength
 * (0..1). null until the house is actually built — a tent grants nothing.
 */
function homePerk(player: any): { id: HomePerkDef['id']; strength: number } | null {
	const home = homeOf(player);
	if (!home.styleLocked) return null;
	const perk = HOME_STYLES[home.style]?.perk;
	if (!perk) return null;
	const levels = (home.space || 1) + (home.comfort || 1) + (home.decor || 1) + (home.light || 1);
	const strength = Math.min(perk.cap, perk.base + perk.perLevel * Math.max(0, levels - HOME_BASE_LEVELS));
	return { id: perk.id, strength };
}

/** Interior floor rectangle (tile coords) for a player's home, centred in the grid. */
function homeRoom(player: any) {
	const inner = HOME_TRACKS.space.levels[(homeOf(player).space || 1) - 1]?.inner || { w: 8, h: 6 };
	const x0 = Math.floor((GRID_W - inner.w) / 2);
	const y0 = Math.floor((GRID_H - inner.h) / 2);
	return { x0, y0, x1: x0 + inner.w - 1, y1: y0 + inner.h - 1 };
}

// -------------------------------------------------- trail-tent interiors
// A pitched trail tent (one per wild biome) opens into its own little interior
// — area id `tent-<biome>` — that's decorated exactly like the home, just
// tent-sized (the starter home footprint, so only `homeMin` 1 furniture fits).
// Interiors are world-shared, like the home, so co-op partners share the camp.
const TENT_INNER = { w: 6, h: 5 };
/** The wild-biome id a tent-interior area belongs to, or null if `area` isn't one. */
function tentBiomeOf(area: any): string | null {
	const m = /^tent-([a-z][a-z-]*)$/.exec(String(area || ''));
	return m ? m[1] : null;
}
/** Interior floor rectangle for a trail tent (fixed size, centred like the home). */
function tentRoom() {
	const x0 = Math.floor((GRID_W - TENT_INNER.w) / 2);
	const y0 = Math.floor((GRID_H - TENT_INNER.h) / 2);
	return { x0, y0, x1: x0 + TENT_INNER.w - 1, y1: y0 + TENT_INNER.h - 1 };
}
// Chance that digging a fresh soil bed turns up a buried material (not every dig).
const DIG_FIND_CHANCE = 0.75;
const CAPACITY_BY_BASKET: Record<number, number> = { 1: 200, 2: 350, 3: 550, 4: 800 };

// New caretakers start empty-handed — the first task is to gather seeds and
// fiber for a Grass Patch, so the tutorial's opening loop has real stakes.
// No starting seeds — the very first goal is "gather 12 seeds", so a fresh
// basket should read 0/12, not 2/12. (A little water lets you tend a bed right
// away for the tutorial.)
const START_INVENTORY: Record<string, number> = { water: 6, wildflowers: 1 };
const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1, 'field-journal': 1 };

// Character appearance options (validated server-side; the frontend renders these)
// Preset swatches the creator offers as quick-picks. Colors are no longer
// restricted to this list — players can pick any color — so these are just
// suggestions surfaced in the UI.
const SKIN_TONES = ['#f6d7b8', '#eec39a', '#d9a06b', '#b97f50', '#8d5a3a', '#6b4226'];
const HAIR_COLORS = ['#3b2e25', '#6e4a33', '#a3692f', '#c9913f', '#d9b380', '#8c8c8c'];
const OUTFIT_COLORS = ['#4a7c59', '#7a9ac0', '#b5707a', '#c9913f', '#7d6b9e', '#5d8a8a'];
const HAT_STYLES = [
	'straw',
	'leaf',
	'beanie',
	'cap',
	'bucket',
	'flower',
	'party',
	'ranger',
	'mushroom',
	'wizard',
	'crown',
	'bandana',
	'none',
];
// Suggested hat tints (any hex is accepted); null/absent hatColor = the hat's classic colors.
const HAT_COLORS = ['#c9a35c', '#b5707a', '#5f86b0', '#5d8a4a', '#7d6b9e', '#b05555'];
const HAIRSTYLES = [
	'short',
	'bald',
	'long',
	'bob',
	'curly',
	'curly-long',
	'bun',
	'braid',
	'ponytail',
	'pigtails',
	'afro',
	'mohawk',
];
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
		hatColor:
			typeof a.hatColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a.hatColor.trim())
				? a.hatColor.trim().toLowerCase()
				: null,
		hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : 'short',
		beard: BEARD_STYLES.includes(a.beard) ? a.beard : 'none',
		body: BODY_TYPES.includes(a.body) ? a.body : 'slim',
	};
}

/** Never send secrets back to the client. */
function sanitizePlayer(player: any) {
	if (!player) return player;
	const { passcode, passcodeHash, passcodeSalt, ...rest } = player;
	// metrics/daily are persisted as JSON strings; the client and the offline solo
	// backend expect them as objects, so decode them on the way out.
	if (rest.metrics !== undefined) rest.metrics = readMetrics(player);
	if (rest.daily !== undefined) rest.daily = readDaily(player);
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
	return String(name)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
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
	// Never shift without a World row to record the new offset on: if we shifted
	// from an assumed applied=0 here, we couldn't persist meadowShift and would
	// shift the meadow east AGAIN on the next call — an ever-drifting camp. The
	// caller (ensureSoloWorld) creates the World before calling us, so this only
	// guards a transiently unreadable/purged row.
	if (!world) return false;
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
	if (world && (applied !== MEADOW_SHIFT || appliedY !== MEADOW_SHIFT_Y))
		await t.World.patch(wid, { meadowShift: MEADOW_SHIFT, meadowShiftY: MEADOW_SHIFT_Y });
	return delta !== 0 || deltaY !== 0;
}

// ------------------------------------------------------------ player setup

/** Load an existing player or fail — creation only happens via /CreatePlayer/. */
async function requirePlayer(playerId: string): Promise<any> {
	if (!playerId || typeof playerId !== 'string') throw new GameError(tr('server.err.playerIdRequired'));
	const player = await safeGet(db().Player, playerId);
	if (!player) throw new GameError(tr('server.err.noSaveLogin'), 404);
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
		// Dwell time per area (seconds), accrued from the heartbeat gap and
		// attributed to whichever area the player is standing in.
		areaSeconds: {} as Record<string, number>,
		// Length of the in-progress session (seconds); rolled into sessionLengths
		// when a new session begins, so we keep a distribution of session lengths.
		curSessionSeconds: 0,
		sessionLengths: {} as Record<string, number>,
		// When the player first performed a real gameplay action (time-to-first-action).
		firstActionAt: 0,
		// How long character creation took, in ms (reported by the client at create).
		creationMs: 0,
	};
}

// Metrics & daily are persisted as JSON STRINGS on the Player row, never as
// nested maps. Harper encodes nested, open-ended maps (counts / areaSeconds /
// sessionLengths / daily.counts) with msgpackr record structures that drift as
// new keys appear and eventually become undecodable ("Data read, but end of
// buffer not reached"). Stringifying keeps the stored value a single stable
// scalar — the same rule SoloMetrics.snapshot already follows. Internal reads go
// through readMetrics/readDaily (which also tolerate legacy object rows written
// before this change, and a corrupt string by falling back to null → fresh);
// writes go through encodeMetrics/encodeDaily; sanitizePlayer decodes on the way
// out so the client and offline backend keep seeing objects.
function readMetrics(player: any): any | null {
	const m = player?.metrics;
	if (m == null) return null;
	if (typeof m === 'string') {
		try {
			return JSON.parse(m);
		} catch {
			return null; // unreadable — caller falls back to freshMetrics()
		}
	}
	return m; // legacy row: metrics still stored as an object
}
function encodeMetrics(metrics: any): string {
	return JSON.stringify(metrics ?? {});
}
function readDaily(player: any): any | null {
	const dld = player?.daily;
	if (dld == null) return null;
	if (typeof dld === 'string') {
		try {
			return JSON.parse(dld);
		} catch {
			return null;
		}
	}
	return dld; // legacy row: daily still stored as an object
}
function encodeDaily(daily: any): string {
	return JSON.stringify(daily ?? {});
}

// Cosmetic / UI-fiddling counters — recorded in `counts` for engagement insight
// but kept OUT of totalActions (and actionsPerMinute) so those stay a
// gameplay-intensity signal. (Declared here so bumpMetrics can tell a real
// gameplay action from cosmetic fiddling when stamping firstActionAt.)
const META_COUNTERS = new Set(['recolors', 'appearanceChanges']);

/** Session-length histogram bucket for a finished session. */
function sessionBucket(seconds: number): string {
	const m = seconds / 60;
	if (m < 2) return '<2m';
	if (m < 10) return '2-10m';
	if (m < 30) return '10-30m';
	return '30m+';
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
async function bumpMetrics(
	player: any,
	deltas: Record<string, number> = {},
	dailyDeltas: Record<string, number> = {},
): Promise<any> {
	if (!player?.id) return null;
	const entries = Object.entries(deltas).filter(([, v]) => v);
	const dailyEntries = Object.entries(dailyDeltas).filter(([, v]) => v);
	if (!entries.length && !dailyEntries.length) return readMetrics(player);
	const now = Date.now();
	// merge onto the freshest row — a single request can bump twice (e.g. a
	// placement bump plus recalcBiome's health/animal bump) from stale copies
	const live = (await db().Player.get(player.id)) || player;
	const prev = readMetrics(live) || freshMetrics(live.createdAt || now);
	const counts = { ...(prev.counts || {}) };
	for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
	const metrics = { ...prev, counts, lastSeenAt: now };
	// Stamp the first real gameplay action (cosmetic fiddling doesn't count), so
	// the dashboard can measure onboarding friction (create → first action).
	if (!prev.firstActionAt && entries.some(([k, v]) => v && !META_COUNTERS.has(k))) {
		metrics.firstActionAt = now;
	}
	const patch: any = { metrics: encodeMetrics(metrics) };
	if (dailyEntries.length) {
		const dayKey = playerDayKey(live, now);
		const prevDaily = readDaily(live);
		const base = prevDaily?.dayKey === dayKey ? prevDaily : { dayKey, counts: {} };
		const dcounts = { ...(base.counts || {}) };
		for (const [k, v] of dailyEntries) dcounts[k] = (dcounts[k] || 0) + v;
		patch.daily = encodeDaily({ dayKey, counts: dcounts });
	}
	await db().Player.patch(player.id, patch);
	return metrics;
}

/** Shape the stored metrics into a tidy, derived view for the Metrics endpoint. */
const DAY_MS = 86_400_000;

// Daily tasks (and the per-day counters that feed them) roll over each real-life
// MORNING: TASK_RESET_HOUR o'clock in the player's local timezone. The timezone
// offset is captured from the client at create/login; saves without one fall
// back to UTC.
const TASK_RESET_HOUR = 4;
const tzMs = (player: any) => (Number.isFinite(player?.tzOffsetMinutes) ? player.tzOffsetMinutes : 0) * 60_000;
/** Timezone offset from the client, clamped to the real-world range (UTC-14..+14). */
const sanitizeTzOffset = (v: any): number => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? clamp(n, -840, 840) : 0;
};
/** The player-local "task day" index of a timestamp — a new day starts at TASK_RESET_HOUR. */
function playerDayKey(player: any, at: number): number {
	return Math.floor((at + tzMs(player) - TASK_RESET_HOUR * 3_600_000) / DAY_MS);
}
const round1 = (n: number) => Math.round(n * 10) / 10;

function metricsView(player: any) {
	const now = Date.now();
	const m = readMetrics(player) || freshMetrics(player.createdAt || now);
	const playSeconds = m.playSeconds || 0;
	const sessions = m.sessions || 0;
	const counts: Record<string, number> = m.counts || {};
	const totalActions = Object.entries(counts).reduce((a, [k, b]) => a + (META_COUNTERS.has(k) ? 0 : b || 0), 0);
	const createdAt = player.createdAt || m.firstSeenAt || now;
	const lastSeenAt = m.lastSeenAt || null;

	// Dwell time per area, plus the area they've spent the most time in.
	const areaSeconds: Record<string, number> = m.areaSeconds || {};
	const areaMinutes: Record<string, number> = {};
	for (const [a, s] of Object.entries(areaSeconds)) areaMinutes[a] = Math.round((s || 0) / 60);
	const mostTimeArea = Object.entries(areaSeconds).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
	// Onboarding friction: how long from creating the save to the first action.
	const firstActionAt = m.firstActionAt || 0;
	const timeToFirstActionSeconds = firstActionAt ? round1((firstActionAt - createdAt) / 1000) : null;
	const creationMs = m.creationMs || 0;

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
		language: m.language || null, // interface language from the heartbeat
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
		// time-per-area
		areaSeconds,
		areaMinutes,
		mostTimeArea,
		// session-length distribution (finished sessions bucketed)
		sessionLengths: m.sessionLengths || {},
		// onboarding
		timeToFirstActionSeconds,
		// character creation: how long it took + the customization they chose
		creationMs,
		creationSeconds: creationMs ? round1(creationMs / 1000) : null,
		appearance: player.appearance || null,
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
		terraformed: (c.terraformActions || 0) > 0,
		planted: (c.plantsPlanted || 0) > 0,
		crafted: (c.itemsCrafted || 0) > 0 || Object.keys(player.craftedEver || {}).length > 0,
		placed: (c.objectsPlaced || 0) > 0,
		attractedAnimal: (biomeSummary?.totalAnimalsReturned || 0) > 0,
		upgradedTool: (c.toolsUpgraded || 0) > 0,
		builtHome: (c.homesBuilt || 0) > 0,
		upgradedHome: (c.homeUpgrades || 0) > 0,
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
const ALPINE_MTN_ROWS = 8; // impassable band the client adds above the alpine's playable grid (must match client MTN_ROWS)

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
				parts.push(
					`<rect x="${px(gx)}" y="${py(gy)}" width="${cell}" height="${cell}" fill="${groundDark}" opacity="0.22"/>`,
				);
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
async function createPlayerRecords(
	playerId: string,
	name: string,
	passcode: string,
	appearance: any,
	tzOffsetMinutes = 0,
	creationMs = 0,
	edition: 'demo' | 'full' = 'full',
): Promise<any> {
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
		tzOffsetMinutes, // local-morning task resets (see playerDayKey)
		createdAt: now,
		// Day-time is derived from accrued play time, and play-time 0 falls in the
		// night band — so start a fresh save at the top of the DAY phase (morning),
		// not in the dark. Sleeping later advances this offset the same way.
		clockOffsetMs: nextPhaseAt(0, 'day'),
		worldId: playerId, // start in your own private solo world (world of one)
		area: 'meadow',
		x: 24.5, // spawn right beside the camp crafting station
		y: 6.5,
		inventory: { ...START_INVENTORY },
		craftedItems: {},
		tools: { ...START_TOOLS },
		unlockedBiomes: ['meadow'],
		visitedBiomes: ['meadow'], // areas walked into at least once (enables fast-travel)
		tutorialStep: 0,
		home: { ...DEFAULT_HOME }, // your camp tent — upgrade it along four tracks, in two styles
		// Stamp how long character creation took (reported by the client), so the
		// dashboard can report average time-in-creator alongside the choices made.
		metrics: encodeMetrics({ ...freshMetrics(now), creationMs: creationMs > 0 ? Math.round(creationMs) : 0, edition }),
		// The board always shows a live "Unlock the next biome" guidance goal, so a
		// new player starts with no custom goals of their own yet.
		customGoals: [],
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
			id: chestPlacementId,
			worldId: wid,
			playerId,
			objectId: 'small-chest',
			area: 'meadow',
			x: STARTER_CHEST.x,
			y: STARTER_CHEST.y,
			placedAt: now,
		},
	];
	for (const p of placements) await t.Placement.put(p);

	const chest = {
		id: chestPlacementId,
		worldId: wid,
		playerId,
		area: 'meadow',
		x: STARTER_CHEST.x,
		y: STARTER_CHEST.y,
		size: 'small-chest',
		capacity: STARTER_CHEST.capacity,
		contents: {},
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
		dailyTasks: dailyTasksBlock({
			wid: worldId,
			player: created.player,
			d,
			discoveries: [],
			biomeStates: created.seeded.biomeStates,
			placements: created.seeded.placements,
			chests: created.seeded.chests,
			now,
		}),
		customGoals: created.player.customGoals || [],
		goalLimit: goalLimitFor(created.player, d),
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

// Health is also capped by how much LIFE has actually returned. Playtest:
// placements alone could push a biome to 40-50% health with only 1-2 of its 25
// animals back, so the health bar raced far ahead of the animal count. The
// land can't truly heal without its animals: health plateaus at each cap until
// enough of the biome's own animals have come home. (Milestones sit safely
// above every animal minHealth requirement and recipe health gate that could
// be needed to reach the next milestone, so progress can never deadlock —
// e.g. the highest recipe gate is 78, unlockable at the 15-animal cap of 88.
// Don't lower the first cap below ~45 without re-checking data/animals-* and
// recipes: under 40 the forest has exactly 5 reachable animals and no slack.)
const HEALTH_CAPS: { animals: number; cap: number }[] = [
	{ animals: 5, cap: 60 },
	{ animals: 10, cap: 75 },
	{ animals: 15, cap: 88 },
];

export function healthCapForReturns(returnedInBiome: number): number {
	for (const step of HEALTH_CAPS) {
		if (returnedInBiome < step.animals) return step.cap;
	}
	return 100;
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
const BALANCE_BREADTH_WEIGHT = 0.2;

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
function analyzeWater(terrain: any[], playerOnly = false) {
	// `playerOnly` drops the pre-seeded starting channels (the wetland ships with a
	// river + pond) so achievements like Lakemaker only reward water the PLAYER
	// actually shaped — otherwise unlocking the wetland auto-granted it. Animal
	// water needs still count the natural channels (default: everything).
	const cells = new Set(
		terrain.filter((t) => t.type === 'water' && (!playerOnly || !t.seeded)).map((t) => `${t.x},${t.y}`),
	);
	const seen = new Set<string>();
	let lake = 0;
	let river = 0;
	for (const key of cells) {
		if (seen.has(key)) continue;
		const stack = [key];
		seen.add(key);
		let size = 0;
		let minx = Infinity,
			maxx = -Infinity,
			miny = Infinity,
			maxy = -Infinity;
		while (stack.length) {
			const [x, y] = stack.pop()!.split(',').map(Number);
			size++;
			minx = Math.min(minx, x);
			maxx = Math.max(maxx, x);
			miny = Math.min(miny, y);
			maxy = Math.max(maxy, y);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nk = `${x + dx},${y + dy}`;
				if (cells.has(nk) && !seen.has(nk)) {
					seen.add(nk);
					stack.push(nk);
				}
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
	const objs = Object.entries(req.objects || {}).map(([id, q]) =>
		tr('server.whyReturned.objectQty', { qty: q as number, name: d.object.get(id)?.name || id }),
	);
	if (objs.length) parts.push(tr('server.whyReturned.habitat', { objects: objs.join(tr('server.list.comma')) }));
	if (req.water) {
		const w = req.water;
		if (w.lake) parts.push(tr('server.whyReturned.lake', { tiles: w.lake }));
		else if (w.river) parts.push(tr('server.whyReturned.river', { tiles: w.river }));
		else if (w.tiles) parts.push(tr('server.whyReturned.tiles', { tiles: w.tiles }));
	}
	if (req.minHealth) parts.push(tr('server.whyReturned.health', { health: req.minHealth }));
	if (req.minBalance) parts.push(tr('server.whyReturned.balance', { balance: req.minBalance }));
	if (req.animals?.length)
		parts.push(
			tr('server.whyReturned.animals', {
				animals: req.animals.map((a: string) => d.animal.get(a)?.name || a).join(tr('server.list.and')),
			}),
		);
	const cond = req.conditions;
	if (cond) {
		const bits: string[] = [];
		if (cond.weather?.length) bits.push(cond.weather.join(tr('server.list.or')));
		if (cond.season?.length)
			bits.push(tr('server.whyReturned.inSeason', { seasons: cond.season.join(tr('server.list.or')) }));
		if (cond.dayPhase?.length)
			bits.push(tr('server.whyReturned.atPhase', { phases: cond.dayPhase.join(tr('server.list.or')) }));
		if (bits.length) parts.push(tr('server.whyReturned.moment', { conditions: bits.join(tr('server.list.comma')) }));
	}
	return tr('server.whyReturned.sentence', { reasons: parts.join(tr('server.list.comma')) });
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
	opts: {
		addPlacements?: any[];
		removeIds?: string[];
		player?: any;
		addTerrain?: any[];
		removeTerrainIds?: string[];
	} = {},
) {
	const t = db();
	const d = await defs();
	if (!d.biome.get(biomeId)) throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }));

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
	// Watered beds nudge health only a LITTLE — a few beds, half a point each — so
	// you can't spam dig+water your way to enough health to pull animals back. Real
	// recovery comes from placed/planted habitat; a bare bed is just a step toward
	// planting. (Capped low on purpose.)
	const wateredTiles = Math.min(3, terrain.filter((tt) => tt.type === 'watered').length) * 0.5;
	// Pre-seeded starting water (the wetland's channels) doesn't count toward
	// health — only water the player shapes does — so a biome begins damaged.
	const openWaterTiles = terrain.filter((tt) => tt.type === 'water' && !tt.seeded).length;
	// rivers and lakes shaped with the watering can feed water-dwelling animals
	const water = analyzeWater(terrain);

	// tended soil beds are worth 1 restoration point each, on the same slow curve
	const now = Date.now();
	const healthPoints = computeHealthPoints(d, placements, openWaterTiles, now) + wateredTiles;
	const uncappedHealth = healthFromPoints(healthPoints);

	// Live sky for condition-gated rare animals: derived from the acting player's
	// play-time clock, same as the weather snapshot and weather-gated gathering.
	const actor = opts.player || (await safeGet(t.Player, playerId));
	const wxTime = actor ? weatherTimeFromPlay(actor) : null;
	const wx: WxContext | null =
		wxTime === null
			? null
			: {
					type: weatherTypeAt(wid, biomeId, wxTime),
					season: seasonAt(wxTime),
					dayPhase: dayPhaseAt(wxTime),
				};

	const discoveries = await byWorld(t.Discovery, wid);
	const returnedIds = new Set(discoveries.map((x) => x.animalId));
	// The land only heals as far as its returned life allows: health plateaus at
	// each HEALTH_CAPS milestone until enough of this biome's animals are home.
	const returnedHere = () => [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
	let health = Math.min(uncappedHealth, healthCapForReturns(returnedHere()));

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
	// a fresh return can lift the health cap — re-clamp with the new count so
	// the stored health reflects the milestone the moment it's crossed
	health = Math.min(uncappedHealth, healthCapForReturns(returnedHere()));

	// Comfort drifts with habitat quality. Removing key habitat lowers comfort
	// (animals become "rarely seen") but they are never owned or lost like pets.
	for (const disc of discoveries) {
		if (disc.biomeId !== biomeId) continue;
		const animal = d.animal.get(disc.animalId);
		if (!animal) continue;
		const comfort = computeComfort(animal, counts);
		if (comfort !== disc.comfort) await t.Discovery.patch(disc.id, { comfort });
	}

	const returnedCount = returnedHere();
	const prior = await findBiomeState(t.BiomeState, wid, biomeId);
	const bsId = prior?.id ?? `${wid}:${biomeId}`;
	await t.BiomeState.patch(bsId, { health, balance, returnedCount });
	const biomeState = {
		...(prior || { id: bsId, worldId: wid, playerId, biomeId, unlocked: biomeId === 'meadow' }),
		health,
		balance,
		returnedCount,
	};

	// Feed the daily task board: positive health gains and newly returned
	// animals bump the acting player's per-day counters (see dailyTasksFor).
	const healthGain = health - (prior?.health ?? BASE_HEALTH);
	const dailyDeltas: Record<string, number> = {};
	if (healthGain > 0) dailyDeltas[`health:${biomeId}`] = healthGain;
	if (newAnimals.length) {
		dailyDeltas[`animal:${biomeId}`] = newAnimals.length;
		dailyDeltas.animal = newAnimals.length;
	}
	if (Object.keys(dailyDeltas).length) {
		const actor = opts.player || (await t.Player.get(playerId));
		if (actor) await bumpMetrics(actor, {}, dailyDeltas);
	}

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
		{ x: 14, y: 5, type: 'water' },
		{ x: 14, y: 6, type: 'water' },
		{ x: 15, y: 6, type: 'water' },
		// a small open pond
		{ x: 20, y: 6, type: 'water' },
		{ x: 21, y: 6, type: 'water' },
		{ x: 22, y: 6, type: 'water' },
		{ x: 20, y: 7, type: 'water' },
		{ x: 21, y: 7, type: 'water' },
		{ x: 22, y: 7, type: 'water' },
		// a couple of watered beds ready to plant
		{ x: 10, y: 14, type: 'watered' },
		{ x: 11, y: 14, type: 'watered' },
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
		// `seeded` marks pre-shaped starting terrain so it doesn't count toward
		// biome health — the wetland begins damaged (≈5%), not half-restored just
		// because it ships with channels. It still feeds water-dwelling animals.
		await t.TerrainTile.put({
			id,
			worldId: wid,
			playerId,
			area: biomeId,
			x: cell.x,
			y: cell.y,
			type: cell.type,
			seeded: true,
			updatedAt: Date.now(),
		});
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
	fresh: { player?: any; freshState?: any } = {},
): Promise<any[]> {
	const t = db();
	const d = await defs();
	const player = fresh.player || (await t.Player.get(playerId));
	const unlockedNow: any[] = [];
	const unlockedSet = new Set(player.unlockedBiomes || []);
	// Newly-unlocked biomes each drop a one-time, claimable "welcome bundle" onto
	// the task board (see dailyTasksBlock). Existing saves start with no pending
	// rewards, so they aren't retroactively gifted for biomes opened long ago.
	const pendingRewards = new Set<string>(player.pendingUnlockRewards || []);
	// the world's own unlock state is authoritative for prerequisites
	const worldUnlocked = new Set((await byWorld(t.BiomeState, wid)).filter((b) => b.unlocked).map((b) => b.biomeId));

	for (const biome of d.biomes) {
		if (!biome.unlock || worldUnlocked.has(biome.id)) continue;
		const u = biome.unlock;
		const prereq =
			fresh.freshState?.biomeId === u.biome ? fresh.freshState : await findBiomeState(t.BiomeState, wid, u.biome);
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
		pendingRewards.add(biome.id);
		await t.Player.patch(playerId, { unlockedBiomes: [...unlockedSet], pendingUnlockRewards: [...pendingRewards] });
		const bsRow = await findBiomeState(t.BiomeState, wid, biome.id);
		await t.BiomeState.patch(bsRow?.id ?? `${wid}:${biome.id}`, { unlocked: true });
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
	const bs = await findBiomeState(t.BiomeState, wid, biomeId);
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
				id: chestId,
				worldId: wid,
				playerId: placement.playerId,
				area: placement.area,
				x: placement.x,
				y: placement.y,
				size: placement.objectId,
				capacity: def.chestCapacity || 60,
				contents: {},
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
			throw new GameError(tr('server.err.notEnough', { resource: resId, need: qty, have: inInv + inChests }));
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
		if (remaining > 0) throw new GameError(tr('server.err.notEnoughShort', { resource: resId })); // defensive; checked above
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
// A small task board: three light, doable goals per real day, refreshed every
// real-life morning (TASK_RESET_HOUR in the player's local time). The board
// doubles as a gentle how-to-play guide that reads the player's actual
// progress:
//   • day one is always the same on-ramp — welcome the grasshopper home,
//     collect 10 seeds, plant 3 seedlings — the loop that starts the game;
//   • until the grasshopper is home, welcoming it stays pinned as task #1;
//   • after that, task #1 pins a SMALL step toward the next real milestone:
//     whichever unlock requirement of the next biome is still unmet (raise
//     health by a few points, welcome one animal, craft the restoration kit)
//     — claim a step and the next appears, walking the player to the forest,
//     the wetland, and beyond.
// Every task must be doable in about five minutes of play — the board nudges,
// it never looms.
// Rotating filler tasks are derived deterministically from (worldId, day) —
// no stored task rows, no scheduler. Progress reads the per-day counters
// bumped by normal play (player.daily) or live world state (pinned tasks);
// claims live in player.taskClaims and reset when the dayKey rolls over.

interface DailyTask {
	id: string;
	kind: 'gather' | 'craft' | 'place' | 'water' | 'plant' | 'observe' | 'welcome' | 'goal';
	icon: string;
	text: string;
	target: number;
	/** player.daily counter key this task reads ('' for live-progress pinned tasks). */
	counter: string;
	reward: Record<string, number>;
	/** optional "how do I do this?" nudge, shown as a hover tip on the board */
	hint?: string;
	/** live progress for welcome/goal tasks, read from world state instead of daily counters */
	live?: number;
	/** Sub-requirements shown as checkboxes (the always-on "unlock next biome" goal). */
	steps?: { text: string; done: boolean }[];
	/** Guidance goal — always on the board, not claimable for a reward. */
	pinned?: boolean;
}

interface TaskCtx {
	wid: string;
	player: any;
	d: any;
	/** every Discovery row in this world (which animals have come home) */
	discoveries: any[];
	/** every BiomeState row in this world */
	biomeStates: any[];
	/** every Placement row in this world (for "plant N" goal progress) */
	placements?: any[];
	/** every Chest row in this world (for "collect N" goal progress) */
	chests?: any[];
	now: number;
	/** The biomes the PLAYER personally unlocked — the reward/gather pool draws
	 *  only from these, never the wider co-op roam set, so tasks stay specific to
	 *  what you've unlocked and the shown reward matches what's granted on claim. */
	unlockedBiomes?: string[];
}

/**
 * The pinned "next milestone" task, or null once every biome is unlocked.
 * Reads real progression state so the board always points at the thing that
 * actually moves the game forward. Claim-aware: a met step stays on the board
 * until its reward is claimed, then the following step surfaces immediately.
 */
function milestonePin(
	ctx: TaskCtx,
	dayKey: number,
	claims: Record<string, boolean>,
	daily: Record<string, number>,
	bundle: () => Record<string, number>,
): DailyTask | null {
	const { player, d, discoveries, biomeStates } = ctx;
	const bs = new Map(biomeStates.map((b: any) => [b.biomeId, b]));

	// 1) The grasshopper — the whole preserve starts here. Pinned until it's
	// home (and kept for the rest of that day so the reward can be claimed).
	const gh = discoveries.find((x: any) => x.animalId === FIRST_ANIMAL_ID);
	const welcomeId = `${dayKey}-welcome`;
	const welcomedToday = gh && playerDayKey(player, gh.firstObservedAt || ctx.now) === dayKey;
	if (!gh || (welcomedToday && !claims[welcomeId])) {
		return {
			id: welcomeId,
			kind: 'welcome',
			icon: 'sparkle',
			text: tr('server.task.welcomeGrasshopper'),
			target: 1,
			counter: '',
			reward: bundle(),
			hint: tr('server.task.welcomeGrasshopperHint'),
			live: gh ? 1 : 0,
		};
	}

	// 2) The next locked biome (the one whose prerequisite biome is already
	// unlocked): pin one SMALL step toward its first unmet requirement — a few
	// health points, a single animal, one craft — never the whole mountain.
	for (const biome of d.biomes) {
		const u = biome.unlock;
		if (!u || bs.get(biome.id)?.unlocked) continue;
		const prereq = bs.get(u.biome);
		if (!prereq?.unlocked) continue; // not the frontier yet
		const prereqName = d.biome.get(u.biome)?.name || u.biome;
		const steps: {
			step: string;
			icon: string;
			text: string;
			target: number;
			counter: string;
			live?: number;
			unmet: boolean;
		}[] = [];
		if (u.minHealth) {
			const remaining = Math.max(0, u.minHealth - (prereq.health || 0));
			const target = Math.max(1, Math.min(3, Math.ceil(remaining)));
			// "from X% to Y%" instead of "by N" — playtest: at 89% health, "raise
			// health by 3" read as ambiguous (3 what? out of what?).
			const current = Math.round(prereq.health || 0);
			steps.push({
				step: 'health',
				icon: 'leaf',
				unmet: remaining > 0,
				text: tr('server.task.raiseHealth', {
					biome: prereqName,
					count: target,
					current,
					goal: Math.min(100, current + target),
				}),
				target,
				counter: `health:${u.biome}`,
			});
		}
		if (u.minAnimals) {
			steps.push({
				step: 'animals',
				icon: 'sparkle',
				unmet: (prereq.returnedCount || 0) < u.minAnimals,
				text: tr('server.task.welcomeNewAnimal', { biome: prereqName }),
				target: 1,
				counter: `animal:${u.biome}`,
			});
		}
		if (u.minTotalAnimals) {
			steps.push({
				step: 'total',
				icon: 'journal',
				unmet: discoveries.length < u.minTotalAnimals,
				text: tr('server.task.welcomeAnyAnimal'),
				target: 1,
				counter: 'animal',
			});
		}
		if (u.requiresItem) {
			const itemName = d.object.get(u.requiresItem)?.name || u.requiresItem;
			const have = (player?.craftedItems?.[u.requiresItem] || 0) + (player?.craftedEver?.[u.requiresItem] || 0);
			steps.push({
				step: 'kit',
				icon: 'hammer',
				unmet: have <= 0,
				text: tr('server.task.craftKit', { item: itemName }),
				target: 1,
				counter: '',
				live: Math.min(1, have),
			});
		}
		for (const step of steps) {
			const id = `${dayKey}-goal-${biome.id}-${step.step}`;
			if (claims[id]) continue; // today's step claimed — surface the next one
			// a met requirement only lingers while today's progress awaits its claim
			const progressedToday = step.counter ? (daily[step.counter] || 0) > 0 : (step.live || 0) > 0;
			if (!step.unmet && !progressedToday) continue;
			return {
				id,
				kind: 'goal',
				icon: step.icon,
				text: step.text,
				target: step.target,
				counter: step.counter,
				reward: bundle(),
				...(step.counter ? {} : { live: step.live }),
			};
		}
		return null; // this unlock is fully handled — it fires on the next biome recalc
	}
	return null;
}

function dailyTasksFor(
	ctx: TaskCtx,
	claims: Record<string, boolean>,
	daily: Record<string, number>,
): { dayKey: number; endsAt: number; tasks: DailyTask[] } {
	const { wid, player, d, discoveries, now } = ctx;
	const discoveredCount = discoveries.length;
	const dayKey = playerDayKey(player, now);
	const endsAt = (dayKey + 1) * DAY_MS + TASK_RESET_HOUR * 3_600_000 - tzMs(player);
	const rng = seededRng(hash32(`tasks:${wid}:${dayKey}`));
	// Personal unlocked biomes only — NOT the co-op roam-expanded set the snapshot
	// may carry — so the pool matches on both the snapshot and claim paths.
	const unlocked: string[] = ctx.unlockedBiomes?.length
		? ctx.unlockedBiomes
		: player?.unlockedBiomes?.length
			? player.unlockedBiomes
			: ['meadow'];
	// gatherable pool: solid materials from unlocked biomes (weather-gated
	// specials are excluded so a task never depends on the right sky)
	const resPool = [...new Set(unlocked.flatMap((id: string) => d.biome.get(id)?.resources || []))].filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && d.resource.get(r),
	);

	const pickFrom = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
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
			id: `${dayKey}-gather`,
			kind: 'gather',
			icon: 'basket',
			text: tr('server.task.gather', { count: target, resource: d.resource.get(res)?.name || res }),
			target,
			counter: `res:${res}`,
			reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-craft`,
			kind: 'craft',
			icon: 'hammer',
			text: tr('server.task.craft', { count: target }),
			target,
			counter: 'craft',
			reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-place`,
			kind: 'place',
			icon: 'pin',
			text: tr('server.task.place', { count: target }),
			target,
			counter: 'place',
			reward: bundle(),
		});
	}
	{
		const target = 3 + Math.floor(rng() * 3);
		candidates.push({
			id: `${dayKey}-water`,
			kind: 'water',
			icon: 'drop',
			text: tr('server.task.water', { count: target }),
			target,
			counter: 'water',
			reward: bundle(),
		});
	}
	candidates.push({
		id: `${dayKey}-plant`,
		kind: 'plant',
		icon: 'leaf',
		text: tr('server.task.plantBeds'),
		target: 2,
		counter: 'plant',
		reward: bundle(),
	});
	if (discoveredCount >= 3) {
		candidates.push({
			id: `${dayKey}-observe`,
			kind: 'observe',
			icon: 'journal',
			text: tr('server.task.observe'),
			target: 3,
			counter: 'observe',
			reward: bundle(),
		});
	}

	// seeded shuffle → the day's filler rotation
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}

	// Day one is always the same gentle on-ramp — the exact loop that brings
	// the meadow (and the game) to life. Fixed for the whole first day.
	const firstDay = playerDayKey(player, player?.createdAt || now) === dayKey;
	if (firstDay) {
		const grasshopperHome = discoveries.some((x: any) => x.animalId === FIRST_ANIMAL_ID);
		return {
			dayKey,
			endsAt,
			tasks: [
				{
					id: `${dayKey}-welcome`,
					kind: 'welcome',
					icon: 'sparkle',
					text: tr('server.task.welcomeGrasshopper'),
					target: 1,
					counter: '',
					reward: bundle(),
					hint: tr('server.task.welcomeGrasshopperHint'),
					live: grasshopperHome ? 1 : 0,
				},
				{
					id: `${dayKey}-gather`,
					kind: 'gather',
					icon: 'basket',
					text: tr('server.task.collectSeeds'),
					target: 10,
					counter: 'res:seeds',
					reward: bundle(),
				},
				{
					id: `${dayKey}-plant`,
					kind: 'plant',
					icon: 'leaf',
					text: tr('server.task.plantThree'),
					target: 3,
					counter: 'plant',
					reward: bundle(),
				},
			],
		};
	}

	// From day two: pin the player's real next milestone first, fill with rotation.
	const pin = milestonePin(ctx, dayKey, claims, daily, bundle);
	const tasks = pin ? [pin, ...candidates.slice(0, 2)] : candidates.slice(0, 3);
	return { dayKey, endsAt, tasks };
}

// ---- player-authored goals (the custom task list) -------------------------
// The board is the player's OWN list now: three fixed starters that teach the
// core loop, then whatever goals the player builds. Progress is read from
// durable world state (not the day counters, which reset), claims are permanent
// (player.goalClaims), and each finished goal grants one small fixed bundle.

type GoalKind =
	| 'craft'
	| 'build'
	| 'grow'
	| 'plant'
	| 'collect'
	| 'observe'
	| 'welcome'
	| 'attract'
	| 'welcomeTotal'
	| 'home'
	| 'tool'
	| 'unlock'
	| 'health'
	| 'biomeAnimals';
interface CustomGoal {
	id: string;
	kind: GoalKind;
	target: number;
	itemId?: string;
	resourceId?: string;
	animalId?: string;
	track?: string;
	styleId?: string;
	toolId?: string;
	biomeId?: string;
	/** The metric value at the moment the goal was created. Progress for the
	 *  cumulative kinds (craft/build/plant/collect/observe) is measured as NEW work
	 *  done SINCE this baseline, so a fresh goal starts at 0 instead of instantly
	 *  completing off past progress. */
	base?: number;
	/** Second baseline for 'build' goals — the placed count at creation (base
	 *  tracks crafting, basePlace tracks placing). */
	basePlace?: number;
}

const GOAL_ICON: Record<GoalKind, string> = {
	craft: 'hammer',
	build: 'hammer',
	grow: 'leaf',
	plant: 'leaf',
	collect: 'basket',
	observe: 'journal',
	welcome: 'paw',
	attract: 'paw',
	welcomeTotal: 'paw',
	home: 'home',
	tool: 'hammer',
	unlock: 'map',
	health: 'leaf',
	biomeAnimals: 'paw',
};
const GOAL_HOME_TRACKS = ['space', 'comfort', 'decor', 'light'];
const MAX_CUSTOM_GOALS = 6; // hard ceiling; the live cap is 3 (or 6 fully unlocked)

/** How many custom goals a player may hold at once: 3 while biomes remain to
 *  unlock, 6 once the whole preserve is open. */
function goalLimitFor(player: any, d: any): number {
	const unlocked = new Set(player?.unlockedBiomes || ['meadow']);
	const allOpen = d.biomes.filter((b: any) => b.explorable).every((b: any) => unlocked.has(b.id));
	return allOpen ? 6 : 3;
}

/** The always-on "unlock the next biome" guidance goal: the frontier locked
 *  biome (its prerequisite is open) with each unlock requirement as a checkbox.
 *  Pinned + non-claimable; disappears once every biome is unlocked. */
function nextBiomeGoal(ctx: TaskCtx): any | null {
	const { d, biomeStates, discoveries, player } = ctx;
	const bs = new Map(biomeStates.map((b: any) => [b.biomeId, b]));
	for (const biome of d.biomes) {
		const u: any = biome.unlock;
		if (!u || bs.get(biome.id)?.unlocked) continue;
		const prereq = bs.get(u.biome);
		if (!prereq?.unlocked) continue; // not the frontier yet
		// You only get "unlock the next area" guidance once you've actually walked
		// through the gate into its prerequisite biome — arriving there is what
		// surfaces what's next, not merely unlocking it (the meadow counts as
		// visited from the start, so the very first goal still shows immediately).
		if (!(player?.visitedBiomes || ['meadow']).includes(u.biome)) continue;
		const prereqName = d.biome.get(u.biome)?.name || u.biome;
		const name = d.biome.get(biome.id)?.name || biome.id;
		const steps: { text: string; done: boolean }[] = [];
		if (u.minHealth)
			steps.push({
				text: tr('server.nextbiome.health', {
					biome: prereqName,
					goal: u.minHealth,
					cur: Math.round(prereq.health || 0),
				}),
				done: (prereq.health || 0) >= u.minHealth,
			});
		if (u.minAnimals)
			steps.push({
				text: tr('server.nextbiome.animals', { biome: prereqName, goal: u.minAnimals, cur: prereq.returnedCount || 0 }),
				done: (prereq.returnedCount || 0) >= u.minAnimals,
			});
		if (u.minTotalAnimals)
			steps.push({
				text: tr('server.nextbiome.total', { goal: u.minTotalAnimals, cur: discoveries.length }),
				done: discoveries.length >= u.minTotalAnimals,
			});
		if (u.requiresItem) {
			const item = d.object.get(u.requiresItem)?.name || u.requiresItem;
			const have = (player?.craftedItems?.[u.requiresItem] || 0) + (player?.craftedEver?.[u.requiresItem] || 0);
			steps.push({ text: tr('server.nextbiome.craft', { item }), done: have > 0 });
		}
		if (!steps.length) return null;
		const done = steps.filter((s) => s.done).length;
		return {
			id: 'next-biome',
			kind: 'unlock',
			icon: 'map',
			pinned: true,
			text: tr('server.nextbiome.title', { biome: name }),
			hint: tr('server.nextbiome.hint', { biome: name }),
			target: steps.length,
			progress: done,
			counter: '',
			reward: {},
			steps,
			claimed: false,
		};
	}
	return null;
}

/** Habitat checklist for an "attract {animal}" goal: each required object with
 *  how many are placed vs needed, plus a health step if the animal needs it. */
function attractSteps(animalId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	const a = ctx.d.animal.get(animalId);
	if (!a) return [];
	// Gated by the field guide: the exact habitat an animal needs is only revealed
	// once the player has upgraded their field journal to this biome's guide tier
	// (same rule as the journal). Until then, nudge them to upgrade instead of
	// spoiling the checklist.
	const needTier = (ctx.d.biome.get(a.biome)?.order || 1) + 1;
	const guideTier = ctx.player?.tools?.['field-journal'] || 1;
	if (guideTier < needTier) {
		return [{ text: tr('server.goal.upgradeGuide'), done: false }];
	}
	const steps: { text: string; done: boolean }[] = [];
	for (const [oid, need] of Object.entries(a.requirements?.objects || {})) {
		const have = (ctx.placements || []).filter((p: any) => p.objectId === oid && p.area === a.biome).length;
		steps.push({
			text: tr('server.goal.habitatStep', {
				have: Math.min(have, need as number),
				need: need as number,
				name: ctx.d.object.get(oid)?.name || oid,
			}),
			done: have >= (need as number),
		});
	}
	if (a.requirements?.minHealth) {
		const b = ctx.biomeStates.find((x: any) => x.biomeId === a.biome);
		const cur = Math.round(b?.health || 0);
		steps.push({
			text: tr('server.goal.healthStep', { cur, need: a.requirements.minHealth }),
			done: cur >= a.requirements.minHealth,
		});
	}
	return steps;
}

/** Materials-you-have vs materials-needed for a craft/build goal's recipe,
 *  shown in the goal's hover info box. */
function craftMaterialSteps(itemId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	const recipe = (ctx.d.recipes || []).find((r: any) => r.output?.itemId === itemId);
	return matSteps(recipe?.materials || {}, ctx);
}

/** Materials have/need for building a specific house style. */
function homeBuildSteps(styleId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	return matSteps(HOME_STYLES[styleId]?.materials || {}, ctx);
}

/** Materials have/need for upgrading a tool to its goal tier. */
function toolUpgradeSteps(toolId: string, tier: number, ctx: TaskCtx): { text: string; done: boolean }[] {
	const td = ctx.d.tool.get(toolId);
	const tierDef = (td?.tiers || []).find((tt: any) => tt.tier === tier);
	return matSteps(tierDef?.materials || {}, ctx);
}

/** Shared "have/need material" checklist. */
function matSteps(mats: Record<string, number>, ctx: TaskCtx): { text: string; done: boolean }[] {
	return Object.entries(mats).map(([mid, need]) => {
		const have = heldAmount(ctx, mid);
		return {
			text: tr('server.goal.matStep', { have: Math.min(have, need), need, name: ctx.d.resource.get(mid)?.name || mid }),
			done: have >= need,
		};
	});
}

/** Staple materials from the player's unlocked biomes (no water / weather specials). */
function goalRewardPool(ctx: TaskCtx): string[] {
	const unlocked: string[] = ctx.unlockedBiomes?.length
		? ctx.unlockedBiomes
		: ctx.player?.unlockedBiomes?.length
			? ctx.player.unlockedBiomes
			: ['meadow'];
	const all = unlocked.flatMap((id: string) => (ctx.d.biome.get(id)?.resources || []) as string[]);
	return [...new Set<string>(all)].filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && ctx.d.resource.get(r),
	);
}
/** A small, deterministic-per-key reward bundle for a finished goal. */
function goalReward(ctx: TaskCtx, key: string): Record<string, number> {
	const pool = goalRewardPool(ctx);
	const out: Record<string, number> = {};
	if (!pool.length) return out;
	const rng = seededRng(hash32(`goalreward:${key}`));
	const p = [...pool];
	for (let i = 0; i < 2 && p.length; i++) {
		const r = p.splice(Math.floor(rng() * p.length), 1)[0];
		out[r] = 3 + Math.floor(rng() * 3); // 3–5 each — deliberately small
	}
	return out;
}

/** One-time "welcome bundle" for freshly unlocking a biome: a couple of THAT
 *  biome's own resources (the next area), deterministic per biome so the reward
 *  shown on the board equals the reward granted on claim. */
function unlockBundle(ctx: TaskCtx, biomeId: string): Record<string, number> {
	const pool = ((ctx.d.biome.get(biomeId)?.resources || []) as string[]).filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && ctx.d.resource.get(r),
	);
	const out: Record<string, number> = {};
	if (!pool.length) return out;
	const rng = seededRng(hash32(`unlockreward:${biomeId}`));
	const p = [...pool];
	for (let i = 0; i < 2 && p.length; i++) {
		const r = p.splice(Math.floor(rng() * p.length), 1)[0];
		out[r] = 4 + Math.floor(rng() * 3); // 4–6 each — a small welcome to the new area
	}
	return out;
}

/** How much of a resource the player is holding, basket + all chests. */
function heldAmount(ctx: TaskCtx, resId: string): number {
	const inv = ctx.player?.inventory?.[resId] || 0;
	const inChests = (ctx.chests || []).reduce((s: number, c: any) => s + (c.contents?.[resId] || 0), 0);
	return inv + inChests;
}

/** How many of a given object are placed in the world right now. */
function placedCountFor(ctx: TaskCtx, objectId: string): number {
	return (ctx.placements || []).filter((p: any) => p.objectId === objectId).length;
}

/** How many of a given plantable object have been planted (placement + plantedAt). */
function plantedCountFor(ctx: TaskCtx, objectId: string): number {
	return (ctx.placements || []).filter((p: any) => p.objectId === objectId && typeof p.plantedAt === 'number').length;
}

/** The raw, absolute metric a goal tracks (before the baseline is subtracted). */
function goalMetric(goal: CustomGoal, ctx: TaskCtx): number {
	switch (goal.kind) {
		case 'craft':
		case 'build':
			return ctx.player?.craftedEver?.[goal.itemId || ''] || 0;
		case 'grow':
			return plantedCountFor(ctx, goal.itemId || '');
		case 'plant':
			return (ctx.placements || []).filter((p: any) => typeof p.plantedAt === 'number').length;
		case 'collect':
			return heldAmount(ctx, goal.resourceId || '');
		case 'observe':
			return ctx.discoveries.filter((x: any) => (x.timesObserved || 0) > 0).length;
		case 'welcomeTotal':
			return ctx.discoveries.length;
		default:
			return 0;
	}
}

/** Live progress for one player-set goal, read from durable world state.
 *  Cumulative kinds count only NEW work since the goal's baseline, so a freshly
 *  added goal never starts already-complete. */
function goalProgress(goal: CustomGoal, ctx: TaskCtx): number {
	switch (goal.kind) {
		case 'craft':
		case 'grow':
		case 'plant':
		case 'collect':
		case 'observe':
		case 'welcomeTotal':
			return Math.max(0, Math.min(goal.target, goalMetric(goal, ctx) - (goal.base || 0)));
		case 'build': {
			// Two steps per object: crafting it counts halfway, placing it completes.
			// Progress is out of target*2 (see the board's target below).
			const crafted = Math.max(
				0,
				Math.min(goal.target, (ctx.player?.craftedEver?.[goal.itemId || ''] || 0) - (goal.base || 0)),
			);
			const placed = Math.max(0, Math.min(goal.target, placedCountFor(ctx, goal.itemId || '') - (goal.basePlace || 0)));
			return crafted + placed;
		}
		case 'welcome':
		case 'attract':
			return ctx.discoveries.some((x: any) => x.animalId === goal.animalId) ? 1 : 0;
		case 'home':
			if (goal.track === 'build') {
				const h = ctx.player?.home;
				if (!h?.styleLocked) return 0;
				return !goal.styleId || h.style === goal.styleId ? 1 : 0; // that house (or any, if unspecified)
			}
			return (ctx.player?.home?.[goal.track || ''] as number) >= goal.target
				? goal.target
				: Math.min(goal.target, (ctx.player?.home?.[goal.track || ''] as number) || 1);
		case 'tool': {
			// Target is the goal's tier; progress is the tool's current tier, capped.
			const cur = (ctx.player?.tools?.[goal.toolId || ''] as number) || 1;
			return Math.min(goal.target, cur);
		}
		case 'unlock':
			return ctx.biomeStates.some((b: any) => b.biomeId === goal.biomeId && b.unlocked) ? 1 : 0;
		case 'health': {
			const b = ctx.biomeStates.find((x: any) => x.biomeId === goal.biomeId);
			return Math.min(goal.target, Math.round(b?.health || 0));
		}
		case 'biomeAnimals': {
			const ret = ctx.discoveries.filter((d: any) => d.biomeId === goal.biomeId).length;
			return Math.min(goal.target, ret);
		}
		default:
			return 0;
	}
}

/** Localized board label for a goal. */
function goalText(goal: CustomGoal, ctx: TaskCtx): string {
	const d = ctx.d;
	switch (goal.kind) {
		case 'craft':
			return tr('server.goal.craft', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'build':
			return tr('server.goal.build', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'grow':
			return tr('server.goal.grow', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'plant':
			return tr('server.goal.plant', { count: goal.target });
		case 'collect':
			return tr('server.goal.collect', {
				count: goal.target,
				resource: d.resource.get(goal.resourceId)?.name || goal.resourceId,
			});
		case 'observe':
			return tr('server.goal.observe', { count: goal.target });
		case 'welcome':
			return tr('server.goal.welcome', { animal: d.animal.get(goal.animalId)?.name || goal.animalId });
		case 'attract':
			return tr('server.goal.attract', { kind: d.animal.get(goal.animalId)?.kind || tr('server.goal.creature') });
		case 'welcomeTotal':
			return tr('server.goal.welcomeTotal', { count: goal.target });
		case 'home':
			return goal.track === 'build'
				? tr('server.goal.buildHome', { style: HOME_STYLES[goal.styleId || '']?.name || tr('server.goal.aHouse') })
				: tr('server.goal.home', { track: tr(`server.goal.track.${goal.track}`), level: goal.target });
		case 'tool': {
			const td = d.tool.get(goal.toolId);
			const tier = (td?.tiers || []).find((tt: any) => tt.tier === goal.target);
			return tr('server.goal.tool', { tool: tier?.name || td?.name || goal.toolId });
		}
		case 'unlock':
			return tr('server.goal.unlock', { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId });
		case 'health':
			return tr('server.goal.restore', { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId, pct: goal.target });
		case 'biomeAnimals':
			return tr('server.goal.biomeAnimals', {
				count: goal.target,
				biome: d.biome.get(goal.biomeId)?.name || goal.biomeId,
			});
		default:
			return '';
	}
}

/** The three fixed starter tasks that always begin the game (until claimed). */
function starterTasks(ctx: TaskCtx): any[] {
	const grasshopper = ctx.discoveries.some((x: any) => x.animalId === FIRST_ANIMAL_ID);
	const craftedAny = Object.keys(ctx.player?.craftedEver || {}).length > 0;
	return [
		{
			id: 'start-gather',
			kind: 'gather',
			icon: 'basket',
			text: tr('server.task.collectSeeds'),
			hint: tr('server.task.gatherHint'),
			target: 12,
			progress: Math.min(12, heldAmount(ctx, 'seeds')),
		},
		{
			id: 'start-craft',
			kind: 'craft',
			icon: 'hammer',
			text: tr('server.task.craftFirst'),
			hint: tr('server.task.craftFirstHint'),
			target: 1,
			progress: craftedAny ? 1 : 0,
		},
		{
			id: 'start-welcome',
			kind: 'welcome',
			icon: 'sparkle',
			text: tr('server.task.welcomeGrasshopper'),
			hint: tr('server.task.welcomeGrasshopperHint'),
			target: 1,
			progress: grasshopper ? 1 : 0,
		},
	];
}

/** Validate + normalize a player-submitted goal list (rewards + baselines are
 *  never client-supplied — they're derived server-side). Existing ids are kept so
 *  SetGoals can preserve each goal's baseline across edits. */
function sanitizeGoals(goals: any[], d: any): CustomGoal[] {
	const out: CustomGoal[] = [];
	const kinds: GoalKind[] = [
		'craft',
		'build',
		'grow',
		'plant',
		'collect',
		'observe',
		'welcome',
		'attract',
		'welcomeTotal',
		'home',
		'tool',
		'unlock',
		'health',
		'biomeAnimals',
	];
	let hasHome = false; // only one home goal (build or upgrade) at a time
	for (const g of Array.isArray(goals) ? goals : []) {
		if (out.length >= MAX_CUSTOM_GOALS) break;
		const kind = g?.kind as GoalKind;
		if (!kinds.includes(kind)) continue;
		if (kind === 'home') {
			if (hasHome) continue;
			hasHome = true;
		}
		const id = typeof g?.id === 'string' && g.id ? g.id.slice(0, 40) : `cg_${Math.random().toString(36).slice(2, 10)}`;
		const target = Math.max(1, Math.min(99, Math.floor(Number(g?.target) || 1)));
		const goal: CustomGoal = { id, kind, target };
		if (kind === 'craft' || kind === 'build' || kind === 'grow') {
			if (!d.object.get(g?.itemId)) continue;
			goal.itemId = g.itemId;
		} else if (kind === 'collect') {
			if (!d.resource.get(g?.resourceId)) continue;
			goal.resourceId = g.resourceId;
		} else if (kind === 'welcome' || kind === 'attract') {
			if (!d.animal.get(g?.animalId)) continue;
			goal.animalId = g.animalId;
			goal.target = 1;
		} else if (kind === 'home') {
			if (g?.track === 'build') {
				if (!HOME_STYLES[g?.styleId]) continue; // must name a real house style
				goal.track = 'build';
				goal.styleId = g.styleId;
				goal.target = 1;
			} else {
				if (!GOAL_HOME_TRACKS.includes(g?.track)) continue;
				goal.track = g.track;
			}
		} else if (kind === 'tool') {
			const td = d.tool.get(g?.toolId);
			if (!td) continue; // must name a real tool
			const maxTier = Math.max(1, ...(td.tiers || []).map((tt: any) => tt.tier));
			// Target is the tier to reach: at least tier 2, never past the tool's max.
			goal.toolId = g.toolId;
			goal.target = Math.min(maxTier, Math.max(2, Math.floor(Number(g?.target) || 2)));
		} else if (kind === 'unlock') {
			if (!d.biome.get(g?.biomeId)) continue;
			goal.biomeId = g.biomeId;
			goal.target = 1;
		} else if (kind === 'health') {
			if (!d.biome.get(g?.biomeId)) continue; // real biome only
			goal.biomeId = g.biomeId;
			goal.target = Math.max(1, Math.min(100, Math.floor(Number(g?.target) || 100)));
		} else if (kind === 'biomeAnimals') {
			if (!d.biome.get(g?.biomeId)) continue;
			// Target is authoritative: every animal that can live in that biome.
			const n = d.animals.filter((a: any) => a.biome === g.biomeId).length;
			if (n <= 0) continue;
			goal.biomeId = g.biomeId;
			goal.target = n;
		}
		out.push(goal);
	}
	return out;
}

/** The on-screen board: three fixed starters, then the player's own goal list. */
function dailyTasksBlock(ctx: TaskCtx) {
	const { player, now, d } = ctx;
	const dayKey = playerDayKey(player, now);
	const goalClaims: Record<string, boolean> = player?.goalClaims || {};
	const tasks: any[] = [];
	const pendingUnlock = (player?.pendingUnlockRewards || []) as string[];
	// The always-on "unlock the next biome" guidance (with its checklist) leads
	// the board — but NOT while a welcome bundle is still waiting to be claimed.
	// Freshly unlocking a biome should feel like an arrival, so we hold back any
	// mention of the *next* biome until the player claims their bundle.
	if (!pendingUnlock.length) {
		const nb = nextBiomeGoal(ctx);
		if (nb) tasks.push(nb);
	}
	// A just-unlocked biome shows a one-time, CLAIMABLE welcome bundle (a couple
	// of that new area's resources) — it flags the unlock in the task bar and the
	// player has to claim it. Cleared from player.pendingUnlockRewards on claim.
	for (const bid of pendingUnlock) {
		const bname = d.biome.get(bid)?.name || bid;
		tasks.push({
			id: `unlock-reward:${bid}`,
			kind: 'unlock',
			icon: 'sparkle',
			text: tr('server.unlockreward.title', { biome: bname }),
			hint: tr('server.unlockreward.hint', { biome: bname }),
			target: 1,
			progress: 1,
			counter: '',
			reward: unlockBundle(ctx, bid),
			claimed: false,
		});
	}
	// Then the three fixed starters, while any remain unclaimed.
	for (const s of starterTasks(ctx)) {
		if (goalClaims[s.id]) continue;
		tasks.push({ ...s, counter: '', reward: goalReward(ctx, s.id), claimed: false });
	}
	// Finally, the player's own goals.
	for (const g of (player?.customGoals || []) as CustomGoal[]) {
		if (goalClaims[g.id]) continue;
		// build goals have two steps per object (craft + place), so the bar runs to
		// twice the object count.
		const target = g.kind === 'build' ? g.target * 2 : g.target;
		// Hover-box checklists: attract → the animal's habitat pieces; craft/build →
		// the recipe's materials (have vs needed).
		const steps =
			g.kind === 'attract'
				? attractSteps(g.animalId || '', ctx)
				: g.kind === 'craft' || g.kind === 'build'
					? craftMaterialSteps(g.itemId || '', ctx)
					: g.kind === 'home' && g.track === 'build'
						? homeBuildSteps(g.styleId || '', ctx)
						: g.kind === 'tool'
							? toolUpgradeSteps(g.toolId || '', g.target, ctx)
							: undefined;
		tasks.push({
			id: g.id,
			kind: g.kind,
			icon: GOAL_ICON[g.kind] || 'check',
			text: goalText(g, ctx),
			target,
			counter: '',
			reward: goalReward(ctx, g.id),
			progress: goalProgress(g, ctx),
			claimed: false,
			hint: tr(`server.goal.hint.${g.kind}`),
			...(steps ? { steps } : {}),
		});
	}
	return { dayKey, endsAt: 0, tasks };
}

async function snapshot(playerId: string, opts: { worldId?: string } = {}) {
	const t = db();
	const d = await defs();
	let player = await safeGet(t.Player, playerId);
	// normalize saves whose last area no longer exists / isn't explorable — but the
	// home interior ('home') and trail-tent interiors ('tent-<biome>') are valid
	// non-biome areas, so leave those be (as long as the tent's biome still is).
	const areaBiome = d.biome.get(player?.area);
	const tentB = tentBiomeOf(player?.area);
	const validTent = tentB ? !!d.biome.get(tentB)?.explorable : false;
	if (player && player.area !== 'home' && !validTent && (!areaBiome || !areaBiome.explorable)) {
		player = { ...player, area: 'meadow', x: 24.5, y: 6.5 };
	}
	// World-owned state is read by the active world id; achievements stay personal.
	// `opts.worldId` lets a caller force the world even if the player's just-patched
	// worldId isn't visible yet within the same transaction (e.g. right after joining).
	const wid = opts.worldId || worldOf(player);
	const [biomeStates, placements, chests, discoveries, nodeStates, terrain, achievementRows, feedRows] =
		await Promise.all([
			byWorld(t.BiomeState, wid),
			byWorld(t.Placement, wid),
			byWorld(t.Chest, wid),
			byWorld(t.Discovery, wid),
			byWorld(t.NodeState, wid),
			byWorld(t.TerrainTile, wid),
			byPlayer(t.PlayerAchievement, playerId),
			byWorld(t.FeedEntry, wid),
		]);
	// The player's OWN unlocked biomes, before any co-op roam expansion below —
	// daily tasks & their rewards are scoped to these so you never get items from
	// (or tasks about) a biome you haven't personally unlocked.
	const personalUnlocked = [...(player?.unlockedBiomes?.length ? player.unlockedBiomes : ['meadow'])];
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
		player: sanitizePlayer(player),
		worldId: wid,
		biomeStates,
		placements,
		chests,
		discoveries,
		nodeStates,
		terrain,
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
		weather: weatherSnapshot(wid, wxTime, WEATHER_BIOME_IDS, player?.devWeather || null),
		dailyTasks: dailyTasksBlock({
			wid,
			player,
			d,
			discoveries,
			biomeStates,
			placements,
			chests,
			now,
			unlockedBiomes: personalUnlocked,
		}),
		customGoals: player?.customGoals || [],
		goalLimit: goalLimitFor(player, d),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(player),
	};
}

async function bodyOf(data: any) {
	const body = await data;
	if (!body || typeof body !== 'object') throw new GameError(tr('server.err.bodyRequired'));
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
		(!!c.disc('wood-duck') ||
			!!c.disc('northern-flying-squirrel') ||
			!!c.disc('great-horned-owl') ||
			!!c.disc('barred-owl')),
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
		.map((r: any) => ({
			id: r.achievementId,
			name: d.achievement.get(r.achievementId)?.name || r.achievementId,
			earnedAt: r.earnedAt,
		}));
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
		// safeGet (not raw .get): achievement fan-out reads every member of a co-op
		// world, so one member left with an undecodable record must not throw a
		// storage-layer decode error on every action. safeGet force-decodes, purges
		// the corrupt row, and returns null → this player is simply skipped.
		const player = await safeGet(t.Player, playerId);
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
			counts: (readMetrics(player)?.counts || {}) as Record<string, number>,
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
				// player-shaped water only — seeded starting channels don't earn Lakemaker
				if (!waterCache.has(b))
					waterCache.set(
						b,
						analyzeWater(
							terrain.filter((tt: any) => tt.area === b),
							true,
						),
					);
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
	} catch {
		/* co-op fan-out is best-effort */
	}
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

/**
 * GET /Version/ — the stamp baked into this bundle at build time (app version +
 * build timestamp, generated by scripts/build-pages.mjs). deploy-coop.sh polls
 * this on every public entry point after deploying and fails loudly if any node
 * is still serving an older bundle.
 */
export class Version extends PublicEndpoint {
	async get() {
		return { build: buildStamp };
	}
}

/** GET /GameData/ — all static definitions (biomes, animals, recipes, …).
 *
 * This is by far the largest response the game sends (~300 KB of JSON) and web /
 * demo / co-op clients fetch it once at open, before login. On the HOSTED Harper
 * we make it cheap two ways:
 *
 *  1. Revalidation. The payload is fully determined by the build (buildStamp),
 *     so we tag it with a build-stamped ETag and honour If-None-Match: repeat
 *     opens get an empty 304 instead of re-downloading the whole catalog.
 *  2. Compression. Harper's REST path does NOT compress resource responses, and
 *     this JSON is highly repetitive, so we brotli/gzip it per the client's
 *     Accept-Encoding — ~300 KB → ~65 KB on the wire.
 *
 * IMPORTANT — this module is bundled BOTH for the hosted Harper (Node) AND into
 * the renderer for the in-app solo backend (src/solo/backend.ts). That backend
 * calls get() with no HTTP request context and uses the return value AS the data,
 * and it runs in a browser where node:zlib does not exist. So get() must return
 * the PLAIN OBJECT whenever there's no request context, and it must never import
 * or touch zlib except on the real HTTP path (which the renderer never takes).
 * Desktop serves GameData locally through exactly that solo path.
 */
let gameDataCache: { stamp: string; obj: any; json: string; etag: string } | null = null;

async function gameDataCached() {
	if (gameDataCache && gameDataCache.stamp === buildStamp) return gameDataCache;
	const d = await defs();
	const obj = {
		biomes: d.biomes,
		animals: d.animals,
		resources: d.resources,
		recipes: d.recipes,
		habitatObjects: d.objects.map((o: any) => ({ ...o, rotatable: isRotatable(o) })),
		tools: d.tools,
		achievements: d.achievements,
		homeStyles: HOME_STYLES,
		homeTracks: HOME_TRACKS,
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		appearanceOptions: {
			skins: SKIN_TONES,
			hair: HAIR_COLORS,
			outfits: OUTFIT_COLORS,
			hats: HAT_STYLES,
			hatColors: HAT_COLORS,
			hairstyles: HAIRSTYLES,
			beards: BEARD_STYLES,
			bodies: BODY_TYPES,
		},
	};
	// Weak validator: body is identical for a given build (though exact bytes differ
	// across br/gzip/identity). `"gd-<build>"` changes whenever the catalog does.
	gameDataCache = { stamp: buildStamp, obj, json: JSON.stringify(obj), etag: `W/"gd-${buildStamp}"` };
	return gameDataCache;
}

// Buffer is a Node global in the Harper runtime; reach it via globalThis so this
// module still type-checks with no @types/node (same trick as the node:crypto use).
const nodeBuffer: any = (globalThis as any).Buffer;

// Compressed representations, built once per build and cached (server-only path).
let gameDataCompressed: { stamp: string; gzip?: Uint8Array; br?: Uint8Array } | null = null;
function compressedGameData(json: string, enc: 'br' | 'gzip'): Uint8Array {
	const cache =
		gameDataCompressed && gameDataCompressed.stamp === buildStamp
			? gameDataCompressed
			: (gameDataCompressed = { stamp: buildStamp });
	const buf = nodeBuffer.from(json, 'utf8');
	if (enc === 'br') {
		if (!cache.br)
			cache.br = brotliCompressSync(buf, {
				params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length },
			});
		return cache.br as Uint8Array;
	}
	if (!cache.gzip) cache.gzip = gzipSync(buf, { level: 6 });
	return cache.gzip as Uint8Array;
}

export class GameData extends PublicEndpoint {
	async get() {
		const { obj, json, etag } = await gameDataCached();
		// No HTTP request context → the in-app solo backend (or any internal JS
		// caller). Return the plain data object; do NOT build an envelope or touch
		// zlib (unavailable in the renderer).
		const reqHeaders: any = (this.getContext?.() as any)?.headers;
		if (!reqHeaders || typeof reqHeaders.get !== 'function') return obj;

		const cacheControl = 'public, max-age=300, stale-while-revalidate=604800';
		// Revalidation hit: same build the client already has → send nothing.
		// Compare loosely so a weak/strong prefix or quoting mismatch still matches.
		const norm = (s: string) => s.replace(/^W\//, '').trim();
		const ifNoneMatch = String(reqHeaders.get('if-none-match') || '');
		if (ifNoneMatch && norm(ifNoneMatch) === norm(etag)) {
			return { status: 304, headers: { etag, 'cache-control': cacheControl } };
		}

		const headers: Record<string, string> = {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': cacheControl,
			etag,
			vary: 'Accept-Encoding',
		};
		const accept = String(reqHeaders.get('accept-encoding') || '');
		let body: string | Uint8Array = json;
		if (/\bbr\b/.test(accept)) {
			headers['content-encoding'] = 'br';
			body = compressedGameData(json, 'br');
		} else if (/\bgzip\b/.test(accept)) {
			headers['content-encoding'] = 'gzip';
			body = compressedGameData(json, 'gzip');
		}
		return { status: 200, headers, body };
	}
}

/** POST /CreatePlayer/ {name, passcode, appearance} — start a brand-new save. */
export class CreatePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode, appearance, tzOffsetMinutes, creationMs, edition } = await bodyOf(data);
		const ed: 'demo' | 'full' = edition === 'demo' ? 'demo' : 'full';
		const cleanName = String(name || '').trim();
		if (cleanName.length < 2 || cleanName.length > 24) throw new GameError(tr('server.err.nameLength'));
		const code = String(passcode || '');
		if (code.length < 4 || code.length > 32) throw new GameError(tr('server.err.passcodeLength'));

		let playerId: string;
		if (ed === 'demo') {
			// Demo saves are anonymous and throwaway, and many players share the
			// hosted instance — so mint a UNIQUE id (name-slug + random suffix)
			// instead of the bare name-slug, which would collide the moment two
			// visitors pick the same caretaker name. The display name still shows
			// what they typed; only the internal id carries the suffix.
			const base = slugId(cleanName) || 'caretaker';
			const t = db();
			do {
				playerId = `${base}-${Math.random().toString(36).slice(2, 8)}`;
			} while (await safeGet(t.Player, playerId));
		} else {
			playerId = slugId(cleanName);
			if (!playerId) throw new GameError(tr('server.err.nameNeedsAlnum'));
			const existing = await safeGet(db().Player, playerId);
			if (existing) throw new GameError(tr('server.err.saveExists'), 409);
		}

		// Client reports how long the player spent in the character creator (ms),
		// clamped to a sane range so a bad clock can't skew the average.
		const cms = clamp(Math.round(Number(creationMs) || 0), 0, 60 * 60_000);
		const created = await createPlayerRecords(
			playerId,
			cleanName,
			code,
			sanitizeAppearance(appearance),
			sanitizeTzOffset(tzOffsetMinutes),
			cms,
			ed,
		);
		// World plumbing must never block starting a save: if the World/WorldMember
		// tables aren't ready yet (instance not restarted after the schema change),
		// fall back to a plain solo session so core play still works.
		let worlds: any[] = [];
		try {
			await ensureSoloWorld(created.player, { freshGrid: true });
			worlds = await listMemberships(playerId);
		} catch (e) {
			console.error('world setup skipped (CreatePlayer):', e);
		}
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
		if (!player) throw new GameError(tr('server.err.noSaveWithName'), 404);
		if (!(await verifyPasscode(player, passcode))) throw new GameError(tr('server.err.passcodeMismatch'), 403);

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
		if (await t.World.get(playerId)) {
			await t.World.delete(playerId);
			removed++;
		}
		await t.Player.delete(playerId);
		return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
	}
}

/**
 * POST /DeleteDemoSave/ {playerId} — passcode-free deletion, used ONLY by the
 * browser demo's hard-stop so a finished demo caretaker can't just log back in.
 * Guarded: it refuses unless the save is tagged edition:'demo' in its metrics,
 * so it can never wipe a real (paid) save even if the id is known. Idempotent —
 * an already-gone save returns ok.
 */
export class DeleteDemoSave extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const id = slugId(String(playerId || ''));
		const t = db();
		const player = id ? await safeGet(t.Player, id) : null;
		if (!player) return { ok: true, deleted: null }; // already gone / never existed
		if (readMetrics(player)?.edition !== 'demo') throw new GameError(tr('server.err.notDemoSave'), 403);

		let removed = 0;
		for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile, t.FeedEntry]) {
			for (const rec of await byWorld(table, id)) {
				await table.delete(rec.id);
				removed++;
			}
		}
		for (const rec of await byPlayer(t.PlayerAchievement, id)) {
			await t.PlayerAchievement.delete(rec.id);
			removed++;
		}
		for (const m of await byPlayer(t.WorldMember, id)) {
			await t.WorldMember.delete(m.id);
			removed++;
		}
		if (await safeGet(t.World, id)) {
			await t.World.delete(id);
			removed++;
		}
		await t.Player.delete(id);
		return { ok: true, deleted: id, recordsRemoved: removed + 1 };
	}
}

/**
 * POST /ExportDemoSave/ {playerId} — dump a demo save's world in the exact shape
 * the offline solo backend serializes ({ meta, data } where data is the dynamic
 * tables), so a demo player can download it and import it into the full
 * downloadable game. Guarded like DeleteDemoSave: only edition:'demo' saves,
 * passcode-free. The client encrypts the result into the standard save envelope.
 */
export class ExportDemoSave extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const id = slugId(String(playerId || ''));
		const t = db();
		const player = id ? await safeGet(t.Player, id) : null;
		if (!player) throw new GameError(tr('server.err.noSaveWithName'), 404);
		if (readMetrics(player)?.edition !== 'demo') throw new GameError(tr('server.err.notDemoSave'), 403);

		const wid = worldOf(player);
		// Reset edition to 'full' on the exported copy: the player is carrying this
		// into the paid game, so it should report as a full-game save (Heartbeat
		// keeps 'demo' sticky otherwise).
		const exportedPlayer = { ...player, metrics: encodeMetrics({ ...(readMetrics(player) || {}), edition: 'full' }) };

		const save = {
			meta: {
				playerId: id,
				name: player.name || 'Caretaker',
				appearance: player.appearance || {},
				createdAt: player.createdAt || Date.now(),
				updatedAt: Date.now(),
			},
			// Keys mirror src/solo/localDb.ts DYNAMIC_TABLES so loadSoloGame hydrates
			// cleanly. WorldPresence / JoinRequest are transient — exported empty.
			data: {
				Player: [exportedPlayer],
				PlayerAchievement: await byPlayer(t.PlayerAchievement, id),
				BiomeState: await byWorld(t.BiomeState, wid),
				Chest: await byWorld(t.Chest, wid),
				Placement: await byWorld(t.Placement, wid),
				Discovery: await byWorld(t.Discovery, wid),
				NodeState: await byWorld(t.NodeState, wid),
				TerrainTile: await byWorld(t.TerrainTile, wid),
				FeedEntry: await byWorld(t.FeedEntry, wid),
				World: (await safeGet(t.World, wid)) ? [await safeGet(t.World, wid)] : [],
				WorldMember: await byPlayer(t.WorldMember, id),
				WorldPresence: [],
				JoinRequest: [],
			},
		};
		return { ok: true, ...save };
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
		if (!(await verifyPasscode(player, currentPasscode))) throw new GameError(tr('server.err.passcodeMismatch'), 403);
		const next = String(newPasscode || '');
		if (next.length < 4 || next.length > 32) throw new GameError(tr('server.err.newPasscodeLength'));
		const { salt, hash } = hashPasscode(next);
		await db().Player.patch(playerId, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return { ok: true };
	}
}

/** POST /LoginPlayer/ {name, passcode} — load an existing save. */
export class LoginPlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode, tzOffsetMinutes } = await bodyOf(data);
		const playerId = slugId(String(name || ''));
		const player = playerId ? await safeGet(db().Player, playerId) : null;
		if (!player) throw new GameError(tr('server.err.noSaveTryNew'), 404);
		if (!(await verifyPasscode(player, passcode))) throw new GameError(tr('server.err.passcodeMismatch'), 403);
		const d = await defs();
		// Reset the heartbeat clock so the first beat after login is counted as a
		// fresh play session (and back-fill metrics for saves made before tracking).
		// lastSeenAt is deliberately NOT bumped here — the first heartbeat reads it
		// to measure the absence for the welcome-back growth summary, then updates it.
		const now = Date.now();
		const prev = readMetrics(player) || freshMetrics(player.createdAt || now);
		await db().Player.patch(playerId, {
			metrics: encodeMetrics({ ...prev, lastHeartbeatAt: 0 }),
			...(tzOffsetMinutes != null ? { tzOffsetMinutes: sanitizeTzOffset(tzOffsetMinutes) } : {}),
		});
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
		} catch (e) {
			console.error('world setup skipped (LoginPlayer):', e);
		}
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

		const cleanName = String(name || '').trim() || tr('server.world.coopName', { name: player.name });
		if (cleanName.length > 40) throw new GameError(tr('server.err.worldNameLength'));

		// generate a unique world id + a collision-free join code
		const worldId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
		let joinCode = genJoinCode();
		const allWorlds = await allOf(t.World);
		const taken = new Set(allWorlds.map((w: any) => w.joinCode).filter(Boolean));
		let guard = 0;
		while (taken.has(joinCode) && guard++ < 20) joinCode = genJoinCode();

		const now = Date.now();
		await t.World.put({
			id: worldId,
			name: cleanName,
			solo: false,
			ownerId: playerId,
			joinCode,
			createdAt: now,
			maxMembers: DEFAULT_MAX_MEMBERS,
		});
		await t.WorldMember.put({
			id: `${worldId}:${playerId}`,
			worldId,
			playerId,
			role: 'owner',
			joinedAt: now,
			lastSeenAt: now,
		});
		// seed the shared world's biome rows (meadow unlocked, like a fresh save) so
		// restoration starts from scratch in the co-op world
		const d = await defs();
		for (const b of d.biomes) {
			await t.BiomeState.put({
				id: `${worldId}:${b.id}`,
				worldId,
				playerId,
				biomeId: b.id,
				health: BASE_HEALTH,
				balance: 0,
				returnedCount: 0,
				unlocked: b.id === 'meadow',
			});
		}
		return {
			ok: true,
			world: {
				worldId,
				name: cleanName,
				joinCode,
				solo: false,
				role: 'owner',
				isOwner: true,
				memberCount: 1,
				maxMembers: DEFAULT_MAX_MEMBERS,
			},
			worlds: await listMemberships(playerId),
		};
	}
}

/** POST /JoinWorld/ {playerId, joinCode} — join a co-op preserve and enter it. */
/** Find a joinable (non-solo) world by its code. */
async function worldByCode(t: any, joinCode: any): Promise<any | null> {
	const code = String(joinCode || '')
		.trim()
		.toUpperCase();
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
		if (!world) throw new GameError(tr('server.err.noWorldWithCode'), 404);

		const memberId = `${world.id}:${playerId}`;
		const already = await t.WorldMember.get(memberId);
		if (!already) {
			// You can only become a member once the host has APPROVED your request —
			// redeem the token you got when you entered the code.
			const tok = String(token || '').trim();
			const req = tok ? await t.JoinRequest.get(`${world.id}:${tok}`) : null;
			if (!req || req.status !== 'approved') {
				throw new GameError(tr('server.err.hostNotApproved'), 403);
			}
			const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
			const members = await byWorld(t.WorldMember, world.id);
			if (members.length >= max) {
				throw new GameError(tr('server.err.worldFullJoined', { max }), 409);
			}
			await t.WorldMember.put({
				id: memberId,
				worldId: world.id,
				playerId,
				role: 'member',
				joinedAt: Date.now(),
				lastSeenAt: Date.now(),
			});
			await t.JoinRequest.delete(`${world.id}:${tok}`); // consume the approval
			// announce the arrival in the shared world feed (everyone sees it)
			const at = Date.now();
			await t.FeedEntry.put({
				id: `f_${world.id}_${at}_${Math.random().toString(36).slice(2, 7)}`,
				worldId: world.id,
				playerId,
				at,
				icon: 'user',
				text: tr('server.feed.joinedWorld', { name: player.name }),
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
			worldsList = [
				...worldsList,
				{
					worldId: world.id,
					name: world.name,
					solo: false,
					role: world.ownerId === playerId ? 'owner' : 'member',
					joinCode: world.joinCode,
					memberCount: here,
					maxMembers: world.maxMembers || DEFAULT_MAX_MEMBERS,
					isOwner: world.ownerId === playerId,
				},
			];
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
			ok: true,
			exists: true,
			world: {
				worldId: world.id,
				name: world.name,
				hostName: owner?.name || tr('server.fallback.host'),
				memberCount,
				maxMembers: max,
				full: memberCount >= max,
			},
		};
	}
}

/** POST /RequestJoin/ {joinCode, token, name} — ask the host to let you in (before making a character). */
export class RequestJoin extends PublicEndpoint {
	async post(data: any) {
		const { joinCode, token, name } = await bodyOf(data);
		const t = db();
		const world = await worldByCode(t, joinCode);
		if (!world) throw new GameError(tr('server.err.noWorldWithCode'), 404);
		const tok = String(token || '').trim();
		if (!tok) throw new GameError(tr('server.err.missingToken'));
		const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
		const memberCount = (await byWorld(t.WorldMember, world.id)).length;
		if (memberCount >= max) throw new GameError(tr('server.err.worldFullClosed', { max }), 409);
		const cleanName =
			String(name || '')
				.trim()
				.slice(0, 24) || tr('server.fallback.newCaretaker');
		await t.JoinRequest.put({
			id: `${world.id}:${tok}`,
			worldId: world.id,
			token: tok,
			name: cleanName,
			status: 'pending',
			createdAt: Date.now(),
		});
		const owner = await t.Player.get(world.ownerId);
		return {
			ok: true,
			worldId: world.id,
			world: { name: world.name, hostName: owner?.name || tr('server.fallback.host') },
		};
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
		if (!world || world.solo) throw new GameError(tr('server.err.noCoopWorld'), 404);
		if (world.ownerId !== playerId) throw new GameError(tr('server.err.onlyHostApproves'), 403);
		const id = `${worldId}:${String(token || '').trim()}`;
		const req = await t.JoinRequest.get(id);
		if (!req) throw new GameError(tr('server.err.requestNotPending'), 404);
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
				name: p?.name || tr('server.fallback.caretaker'),
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
			throw new GameError(tr('server.err.notWorldMember'), 403);
		}
		await t.Player.patch(playerId, { worldId: target });
		await t.WorldMember.patch(`${target}:${playerId}`, { lastSeenAt: Date.now() });
		await syncMemberUnlocks(playerId, target);
		return {
			ok: true,
			worldId: target,
			worlds: await listMemberships(playerId),
			state: await snapshot(playerId, { worldId: target }),
		};
	}
}

/** POST /LeaveWorld/ {playerId, worldId} — leave a co-op world (your solo world stays). */
export class LeaveWorld extends PublicEndpoint {
	async post(data: any) {
		const { playerId, worldId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const target = String(worldId || '');
		if (target === playerId) throw new GameError(tr('server.err.cannotLeaveSolo'));
		const memberId = `${target}:${playerId}`;
		if (!(await t.WorldMember.get(memberId))) throw new GameError(tr('server.err.notInWorld'), 404);
		await t.WorldMember.delete(memberId);
		// if you were standing in that world, fall back to your solo world
		if (player.worldId === target) {
			await t.Player.patch(playerId, { worldId: playerId, area: 'meadow', x: 24.5, y: 6.5 });
			await syncMemberUnlocks(playerId, playerId);
		}
		const active = player.worldId === target ? playerId : player.worldId || playerId;
		return {
			ok: true,
			worldId: active,
			worlds: await listMemberships(playerId),
			state: await snapshot(playerId, { worldId: active }),
		};
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
		players[playerId] = {
			playerId,
			name: player.name,
			appearance: player.appearance,
			area: parea,
			x: px,
			y: py,
			t: now,
		};
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
		if (!biome) throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }));
		if (!(player.unlockedBiomes || []).includes(biomeId))
			throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);
		const resDef = d.resource.get(resourceId);
		if (!resDef) throw new GameError(tr('server.err.unknownResource', { resource: resourceId }));
		// Weather-gated resources sidestep the biome resource list, but the matching
		// weather must actually be active in this biome right now (recomputed from the
		// same deterministic function the client used to spawn the node).
		if (isWeatherGatheredResource(resourceId)) {
			// Weather-gated: the resource must be the one this biome's CURRENT weather
			// yields (recomputed from the same play-time base the snapshot used).
			const active = weatherTypeAt(wid, biomeId, weatherTimeFromPlay(player));
			if (gatherResourceIdFor(biomeId, active) !== resourceId) {
				throw new GameError(tr('server.err.weatherOnly', { resource: resDef.name }), 409);
			}
		} else if (!(biome.resources || []).includes(resourceId)) {
			throw new GameError(tr('server.err.resourceNotInBiome', { resource: resourceId, biome: biome.name }));
		}
		if (!nodeId || typeof nodeId !== 'string') throw new GameError(tr('server.err.nodeIdRequired'));

		// node regeneration cooldown — shared across the world so two players can't
		// both drain the same spot
		const nodeKey = `${wid}:${biomeId}:${nodeId}`;
		const nodeState = await t.NodeState.get(nodeKey);
		const now = Date.now();
		if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1000) {
			throw new GameError(tr('server.err.regrowing'), 409);
		}

		// carrying capacity (gathering basket)
		const capacity = inventoryCapacity(player);
		const carried = sumValues(player.inventory);
		if (carried >= capacity) throw new GameError(tr('server.err.basketFullStore'), 409);

		// a higher-tier tool gathers more at once (tier 1→1 … tier 4→4)
		const toolTier = player.tools?.[resDef.tool] || 1;
		const amount = Math.min(Math.max(1, toolTier), capacity - carried);

		// House perk (Log Cabin — forager's instinct): a chance to spot one extra
		// material on every gather. The chance grows with every home upgrade.
		const perk = homePerk(player);
		const perkBonus = perk?.id === 'forage' && capacity - carried - amount > 0 && Math.random() < perk.strength ? 1 : 0;
		const total = amount + perkBonus;

		const inventory = { ...(player.inventory || {}) };
		inventory[resourceId] = (inventory[resourceId] || 0) + total;
		await t.Player.patch(playerId, { inventory });
		await t.NodeState.put({ id: nodeKey, worldId: wid, playerId, harvestedAt: now });

		await bumpMetrics(player, { resourcesCollected: total }, { [`res:${resourceId}`]: total });
		await awardAchievements(playerId);
		return {
			ok: true,
			gained: { [resourceId]: total },
			perkBonus: perkBonus || undefined,
			inventory,
			nodeId,
			harvestedAt: now,
		};
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
		if (!chest) throw new GameError(tr('server.err.chestNotFound'), 404);

		const inventory = { ...(player.inventory || {}) };
		const contents = { ...(chest.contents || {}) };

		if (direction === 'deposit') {
			if ((inventory[resourceId] || 0) < amount)
				throw new GameError(tr('server.err.notEnoughInBasket', { resource: resourceId }));
			if (sumValues(contents) + amount > chest.capacity) throw new GameError(tr('server.err.chestFull'), 409);
			inventory[resourceId] -= amount;
			if (inventory[resourceId] <= 0) delete inventory[resourceId];
			contents[resourceId] = (contents[resourceId] || 0) + amount;
		} else if (direction === 'withdraw') {
			if ((contents[resourceId] || 0) < amount)
				throw new GameError(tr('server.err.notEnoughInChest', { resource: resourceId }));
			if (sumValues(inventory) + amount > inventoryCapacity(player))
				throw new GameError(tr('server.err.basketFull'), 409);
			contents[resourceId] -= amount;
			if (contents[resourceId] <= 0) delete contents[resourceId];
			inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		} else {
			throw new GameError(tr('server.err.badDirection'));
		}

		await t.Player.patch(playerId, { inventory });
		await t.Chest.patch(chestId, { contents });
		await bumpMetrics(player, direction === 'deposit' ? { chestDeposits: 1 } : { chestWithdrawals: 1 });
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
		if (!id || typeof id !== 'string') throw new GameError(tr('server.err.idRequired'));

		if (kind === 'crafted') {
			const craftedItems = { ...(player.craftedItems || {}) };
			if ((craftedItems[id] || 0) < amount) throw new GameError(tr('server.err.discardTooMany'));
			craftedItems[id] -= amount;
			if (craftedItems[id] <= 0) delete craftedItems[id];
			await t.Player.patch(playerId, { craftedItems });
			await bumpMetrics(player, { itemsDiscarded: amount });
			return { ok: true, craftedItems };
		}

		const inventory = { ...(player.inventory || {}) };
		if ((inventory[id] || 0) < amount) throw new GameError(tr('server.err.discardTooMany'));
		inventory[id] -= amount;
		if (inventory[id] <= 0) delete inventory[id];
		await t.Player.patch(playerId, { inventory });
		await bumpMetrics(player, { itemsDiscarded: amount });
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
		if (!recipe) throw new GameError(tr('server.err.unknownRecipe', { recipe: recipeId }));
		// Plantable objects can only be planted in a watered bed, never crafted.
		const outObj = d.object.get(recipe.output.itemId);
		if (outObj?.plantable) {
			throw new GameError(tr('server.err.plantedNotCrafted', { name: recipe.name }), 400);
		}
		// Dev override (dev save only): skip the biome + progress gates entirely.
		// House-only furniture can't be crafted until your home's Space is upgraded.
		if (!player.devUnlockAll && outObj?.homeMin && (homeOf(player).space || 1) < outObj.homeMin) {
			throw new GameError(tr('server.err.needsProperHouse', { name: recipe.name }), 403);
		}
		const devUnlock = !!player.devUnlockAll;
		if (!devUnlock && recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
			throw new GameError(tr('server.err.recipeBiomeLocked'), 403);
		}
		// Progress gate: most recipes only unlock once you've restored their biome
		// far enough (health / animals returned / a keystone animal back).
		if (!devUnlock && recipe.unlock && recipe.unlockBiome) {
			const ctx = await recipeUnlockContext(wid, recipe.unlockBiome, player, d);
			if (!recipeUnlockMet(recipe, ctx)) {
				throw new GameError(tr('server.err.recipeLocked', { label: recipe.unlock.label }), 403);
			}
		}
		if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
			const tool = d.tool.get(recipe.requiresTool.id);
			throw new GameError(tr('server.err.requiresUpgradedTool', { tool: tool?.name || recipe.requiresTool.id }), 403);
		}
		// One-time recipes (restoration kits) can only ever be crafted once.
		if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
			throw new GameError(tr('server.err.craftOnce', { name: recipe.name }), 409);
		}

		const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {}, wid);

		// House perk (Stone Hearth — hearthkeeper's thrift): a chance that crafting
		// hands back half of each material it consumed (rounded down, at least 1).
		// Refunds land in the basket and never overflow its capacity.
		const perk = homePerk(player);
		let refund: Record<string, number> | undefined;
		if (perk?.id === 'thrift' && Object.keys(recipe.materials || {}).length && Math.random() < perk.strength) {
			let room = inventoryCapacity(player) - sumValues(inventory);
			for (const [rid, q] of Object.entries(recipe.materials || {})) {
				const back = Math.min(Math.max(1, Math.floor((q as number) / 2)), Math.max(0, room));
				if (back > 0) {
					refund = refund || {};
					refund[rid] = back;
					inventory[rid] = (inventory[rid] || 0) + back;
					room -= back;
				}
			}
		}

		const craftedItems = { ...(player.craftedItems || {}) };
		const craftedEver = { ...(player.craftedEver || {}) };
		craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		await t.Player.patch(playerId, refund ? { craftedItems, craftedEver, inventory } : { craftedItems, craftedEver });

		// crafting key items (e.g. the water restoration kit) can unlock biomes
		const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, craftedItems, craftedEver } });

		const chests = await byWorld(t.Chest, wid);
		await bumpMetrics(player, { itemsCrafted: 1 }, { craft: 1 });
		await awardAchievements(playerId);
		return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, refund, unlockedBiomes };
	}
}

/** Snap any angle to the nearest quarter-turn in [0,90,180,270]. Non-numbers → 0. */
function normRot(v: any): number {
	const n = Number(v);
	if (!Number.isFinite(n)) return 0;
	return (((Math.round(n / 90) * 90) % 360) + 360) % 360;
}

// Only things with a real orientation can be rotated — paths, fences/walls,
// bridges, and directional furniture. Trees, flowers, bushes, rocks, ponds and
// radial decor (lanterns, vases, chimes, gnomes…) always sit at 0°.
const ROTATABLE_IDS = new Set<string>([
	'wooden-fence',
	'dry-stone-wall',
	'wooden-bench',
	'hammock',
	'picnic-blanket',
	'garden-arch',
	'trail-signpost',
	'flower-cart',
	'home-bed',
	'home-sleeping-bag',
	'home-bookshelf',
	'home-armchair',
	'home-fireplace',
	'home-table',
	'home-dresser',
	'home-driftwoodshelf',
	'home-mushroomshelf',
	'home-reedmat',
	'home-peltrug',
	'home-rug',
	'home-cushions',
	'home-stool',
	'home-aquarium',
	'home-telescope',
]);
function isRotatable(def: any): boolean {
	if (!def) return false;
	if (def.rotatable === true) return true; // explicit data opt-in
	if (def.bridge) return true; // bridges span water either way
	if (/-path$/.test(def.id)) return true; // any path
	return ROTATABLE_IDS.has(def.id);
}

/** POST /PlaceObject/ {playerId, objectId, area, x, y, rotation?} — area is a biome id or 'home'. */
export class PlaceObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, objectId, area, x, y, rotation } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const def = d.object.get(objectId);
		if (!def) throw new GameError(tr('server.err.unknownObject', { object: objectId }));
		if (def.placement === 'none') throw new GameError(tr('server.err.kitNotPlaceable', { name: def.name }));
		if ((player.craftedItems?.[objectId] || 0) <= 0)
			throw new GameError(tr('server.err.noneCrafted', { name: def.name }));

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const grid = areaGrid(d, area);
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError(tr('server.err.outOfReach'));
		}

		const tentBiome = tentBiomeOf(area);
		if (area === 'home') {
			// decorating your home interior — indoor or 'both' items, on the floor only
			if (def.placement === 'outdoor') throw new GameError(tr('server.err.outdoorOnly', { name: def.name }));
			// some furniture needs a real house, not the starter tent
			if (def.homeMin && (homeOf(player).space || 1) < def.homeMin) {
				throw new GameError(tr('server.err.needsBiggerHome', { name: def.name }), 403);
			}
			const r = homeRoom(player);
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) throw new GameError(tr('server.err.placeOnFloor'));
		} else if (tentBiome) {
			// decorating a trail-tent interior — indoor rules, tent-sized floor,
			// and only furniture that fits a tent (homeMin 1)
			const biome = d.biome.get(tentBiome);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }));
			if (!(player.unlockedBiomes || []).includes(tentBiome))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);
			if (def.placement === 'outdoor') throw new GameError(tr('server.err.outdoorOnly', { name: def.name }));
			if (def.homeMin && def.homeMin > 1) throw new GameError(tr('server.err.tentTooSmall', { name: def.name }), 403);
			const r = tentRoom();
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) throw new GameError(tr('server.err.placeOnFloor'));
		} else {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }));
			if (!(player.unlockedBiomes || []).includes(area))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);
			if (def.placement === 'indoor') throw new GameError(tr('server.err.indoorOnly', { name: def.name }));
			if (!(def.biomes || []).includes(area))
				throw new GameError(tr('server.err.wrongHabitat', { name: def.name, biome: biome.name }));
			// nothing builds on the open ocean — coastal land ends before the reserved ocean columns
			if (biome.oceanCols && tx >= grid.cols - biome.oceanCols) throw new GameError(tr('server.err.openOcean'), 409);
		}
		if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
			throw new GameError(
				tr('server.err.placeRequiresTool', {
					name: def.name,
					tool: d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id,
				}),
				403,
			);
		}

		const placements = await byWorld(t.Placement, wid);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError(tr('server.err.spotTaken'), 409);
		}
		// Some structures are one-per-biome (e.g. the trail tent — a single shared
		// home base in each wild biome, not a tent city). World-scoped, because
		// each tent opens into one shared interior per biome (like the home).
		if (def.onePerArea && placements.some((p) => p.area === area && p.objectId === objectId)) {
			throw new GameError(tr('server.err.onePerArea', { name: def.name }), 409);
		}
		// terrain/water rules only apply outdoors — interiors have no terrain
		const indoors = area === 'home' || !!tentBiome;
		const tileHere = indoors ? null : await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!def.bridge) throw new GameError(tr('server.err.openWaterBridge'), 409);
			} else {
				throw new GameError(tr('server.err.bedForPlanting'), 409);
			}
		} else if (def.bridge && !indoors) {
			throw new GameError(tr('server.err.bridgeNeedsWater'), 409);
		}

		const craftedItems = { ...(player.craftedItems || {}) };
		craftedItems[objectId] -= 1;
		if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
		await t.Player.patch(playerId, { craftedItems });

		const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = {
			id: placementId,
			worldId: wid,
			playerId,
			objectId,
			area,
			x: tx,
			y: ty,
			placedAt: Date.now(),
			rotation: isRotatable(def) ? normRot(rotation) : 0,
		};
		await t.Placement.put(placement);

		if (def.isChest) {
			await t.Chest.put({
				id: placementId,
				worldId: wid,
				playerId,
				area,
				x: tx,
				y: ty,
				size: objectId,
				capacity: def.chestCapacity || 60,
				contents: {},
			});
		}

		// Indoor decor (home or a tent interior) doesn't affect any biome — skip the recalc.
		if (indoors) {
			await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 });
			await awardAchievements(playerId);
			return { ok: true, placement, craftedItems };
		}

		const recalc = await recalcBiome(wid, playerId, area, {
			addPlacements: [placement],
			player: { ...player, craftedItems },
		});
		await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { place: 1 });
		await awardWorldAchievements(wid, playerId, {
			addDiscoveries: recalc.newAnimals,
			freshBiomeStates: [recalc.biomeState],
		});
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
		if (!biome) throw new GameError(tr('server.err.unknownArea', { area }));
		if (!(player.unlockedBiomes || []).includes(area))
			throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);

		const def = d.object.get(plantId);
		if (!def || !def.plantable) throw new GameError(tr('server.err.notPlantable'));
		if (!(def.biomes || []).includes(area))
			throw new GameError(tr('server.err.wouldNotTakeRoot', { name: def.name, biome: biome.name }));

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const bed = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
		if (!bed || bed.type !== 'watered') {
			throw new GameError(tr('server.err.plantIntoWatered'));
		}

		const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {}, wid);

		await t.TerrainTile.delete(bed.id); // the bed becomes the plant

		// House perk (Meadow Cottage — green thumb): new plantings start partly
		// grown. Implemented by backdating the planting timestamps a fraction of
		// the grow/mature time — everything downstream (sprout gating, mature
		// habitat bonuses) already derives from these, so no extra state needed.
		const perk = homePerk(player);
		const headStart = perk?.id === 'growth' ? perk.strength : 0;
		const now = Date.now();
		const placementId = `pl_${now}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = {
			id: placementId,
			worldId: wid,
			playerId,
			objectId: plantId,
			area,
			x: tx,
			y: ty,
			placedAt: now - Math.round(matureMs(def) * headStart),
			plantedAt: now - Math.round((def.growSeconds || 0) * 1000 * headStart),
		};
		await t.Placement.put(placement);

		const recalc = await recalcBiome(wid, playerId, area, {
			addPlacements: [placement],
			removeTerrainIds: [bed.id],
			player: { ...player, inventory },
		});
		await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { plant: 1 });
		await awardWorldAchievements(wid, playerId, {
			addDiscoveries: recalc.newAnimals,
			freshBiomeStates: [recalc.biomeState],
		});
		return { ok: true, placement, inventory, usedFrom, perkGrowth: headStart || undefined, ...recalc };
	}
}

/**
 * When a planted, yield-bearing plant is ready to harvest — mature the first
 * time, then `regrowSeconds` after each harvest. Returns the ms timestamp it
 * becomes ready, or null if it never yields.
 */
function harvestReadyAt(def: any, placement: any): number | null {
	const y = def?.yield;
	if (!y || !def?.plantable || !placement?.plantedAt) return null;
	const growMs = (def.growSeconds || 0) * 1000;
	const regrowMs = (y.regrowSeconds || 60) * 1000;
	return placement.lastHarvestAt ? placement.lastHarvestAt + regrowMs : placement.plantedAt + growMs;
}

/**
 * POST /HarvestPlacement/ {playerId, placementId} — gather a mature plant's
 * yield (berries, flowers, acorns…) without uprooting it. The plant stays and
 * regrows its yield after `regrowSeconds`, turning planting into a renewable
 * source instead of dig-up-and-replant.
 */
export class HarvestPlacement extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const now = Date.now();

		const placement = (await byWorld(t.Placement, wid)).find((p) => p.id === placementId);
		if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404);
		const def = d.object.get(placement.objectId);
		const y = def?.yield;
		if (!y) throw new GameError(tr('server.err.notHarvestable'));
		const readyAt = harvestReadyAt(def, placement);
		if (readyAt == null || now < readyAt) throw new GameError(tr('server.err.notReadyYet'));

		// grant the yield, respecting carrying capacity
		const capacity = inventoryCapacity(player);
		const inventory = { ...(player.inventory || {}) };
		const room = Math.max(0, capacity - sumValues(inventory));
		const take = Math.min(y.qty || 1, room);
		if (take <= 0) throw new GameError(tr('server.err.basketFullHarvest'), 409);
		inventory[y.resourceId] = (inventory[y.resourceId] || 0) + take;

		await t.Player.patch(playerId, { inventory });
		await t.Placement.patch(placementId, { lastHarvestAt: now });
		await bumpMetrics(player, { resourcesCollected: take });
		return {
			ok: true,
			placementId,
			gained: { [y.resourceId]: take },
			inventory,
			placement: { ...placement, lastHarvestAt: now },
		};
	}
}

/** POST /UpdateAppearance/ {playerId, appearance} — restyle your caretaker anytime. */
export class UpdateAppearance extends PublicEndpoint {
	async post(data: any) {
		const { playerId, appearance } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const clean = sanitizeAppearance(appearance);
		await db().Player.patch(playerId, { appearance: clean });
		await bumpMetrics(player, { appearanceChanges: 1 });
		return { ok: true, appearance: clean };
	}
}

/** POST /MoveObject/ {playerId, placementId, x, y} — relocate a placed object within its area. */
export class MoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, x, y, rotation } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const placements = await byWorld(t.Placement, wid);
		const placement = placements.find((p) => p.id === placementId);
		if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404);
		if (placement.objectId === 'workbench') throw new GameError(tr('server.err.workbenchStays'));

		const dGrid = await defs();
		const grid = areaGrid(dGrid, placement.area);
		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError(tr('server.err.outOfReach'));
		}
		if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
			throw new GameError(tr('server.err.spotTaken'), 409);
		}
		const d = await defs();
		const movingDef = d.object.get(placement.objectId);
		const tileHere = await findTerrainAt(t.TerrainTile, wid, placement.area, tx, ty);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!movingDef?.bridge) throw new GameError(tr('server.err.openWaterBridgeOnly'), 409);
			} else {
				throw new GameError(tr('server.err.bedForPlantingShort'), 409);
			}
		} else if (movingDef?.bridge) {
			throw new GameError(tr('server.err.bridgesOverWater'), 409);
		}

		const patch: any = { x: tx, y: ty };
		if (rotation !== undefined && isRotatable(movingDef)) patch.rotation = normRot(rotation);
		await t.Placement.patch(placementId, patch);
		const chest = await getOwnedChest(t, d, placementId, wid);
		if (chest) await t.Chest.patch(placementId, { x: tx, y: ty }); // chests move with their contents

		await bumpMetrics(player, { objectsMoved: 1 });
		return { ok: true, placement: { ...placement, ...patch } };
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
		if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404);
		if (placement.objectId === 'workbench') {
			throw new GameError(tr('server.err.workbenchStays'));
		}

		const chest = await findInWorld(t.Chest, wid, placementId);
		if (chest && sumValues(chest.contents) > 0) {
			throw new GameError(tr('server.err.emptyChestFirst'), 409);
		}

		// A trail tent can't be packed up while furniture is still inside its
		// interior — pack up in there first (mirrors the chest-must-be-empty rule).
		if (placement.objectId === 'trail-tent') {
			const interior = `tent-${placement.area}`;
			const inside = (await byWorld(t.Placement, wid)).some((p) => p.area === interior);
			if (inside) throw new GameError(tr('server.err.tentNotEmpty'), 409);
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
					throw new GameError(tr('server.err.noRoomRefund'), 409);
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

		// interiors (home / tent) aren't biomes — skip recalc for their decor
		const recalc =
			placement.area !== 'home' && !tentBiomeOf(placement.area)
				? await recalcBiome(wid, playerId, placement.area, {
						removeIds: [placementId],
						player: { ...player, craftedItems, inventory },
					})
				: null;
		await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
		await awardWorldAchievements(
			wid,
			playerId,
			recalc ? { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] } : {},
		);
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
		if (!toolDef) throw new GameError(tr('server.err.unknownTool', { tool: toolId }));
		const wid = worldOf(player);
		const currentTier = player.tools?.[toolId] || 1;
		const nextTier = (toolDef.tiers || []).find((tt: any) => tt.tier === currentTier + 1);
		if (!nextTier) throw new GameError(tr('server.err.toolMaxed', { tool: toolDef.name }));

		if (nextTier.requires?.biome) {
			const bs = await findBiomeState(t.BiomeState, wid, nextTier.requires.biome);
			if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
				const biome = d.biome.get(nextTier.requires.biome);
				throw new GameError(
					tr('server.err.restoreFirst', {
						biome: biome?.name || nextTier.requires.biome,
						health: nextTier.requires.minHealth,
					}),
					403,
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
		return {
			ok: true,
			tools,
			inventory,
			chests,
			usedFrom,
			unlockedBiomes,
			upgraded: { toolId, tier: nextTier.tier, name: nextTier.name },
		};
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
		if (!def) throw new GameError(tr('server.err.unknownHomeUpgrade'));
		const home = homeOf(player);
		if (!home.styleLocked) throw new GameError(tr('server.err.buildStyleFirst'), 403);
		const level = home[track] || 1;
		const next = def.levels[level]; // levels[level] is the (level+1)th entry
		if (!next) throw new GameError(tr('server.err.trackMaxed', { track: def.name.toLowerCase() }));

		if (next.requires?.biome) {
			const bs = await findBiomeState(t.BiomeState, wid, next.requires.biome);
			if ((bs?.health || 0) < (next.requires.minHealth || 0)) {
				const d = await defs();
				const biome = d.biome.get(next.requires.biome);
				throw new GameError(
					tr('server.err.restoreFirst', { biome: biome?.name || next.requires.biome, health: next.requires.minHealth }),
					403,
				);
			}
		}

		const { usedFrom, inventory } = await consumeMaterials(player, next.materials || {}, wid);
		const updated = { ...home, [track]: level + 1 };
		await t.Player.patch(playerId, { home: updated });
		const chests = await byWorld(t.Chest, wid);
		await awardAchievements(playerId);
		await bumpMetrics(player, { homeUpgrades: 1 });
		return {
			ok: true,
			home: updated,
			inventory,
			chests,
			usedFrom,
			upgraded: { track, level: level + 1, name: def.name },
		};
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
			throw new GameError(tr('server.err.needBedToRest'), 403);
		}
		// refresh all resources: clear node cooldowns so every gathering spot is ready
		const nodes = await byWorld(t.NodeState, wid);
		for (const n of nodes) await t.NodeState.delete(n.id);
		// Sleep through to sunrise: advance the in-game clock to the next dawn (first
		// light), not raw day-start — the day now begins mid-night, so day-start
		// would wake you at 00:00 in the dark.
		const nowT = weatherTimeFromPlay(player);
		const skip = nextDawnAt(nowT) - nowT;
		await t.Player.patch(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
		await bumpMetrics(player, { restsTaken: 1 });
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
		if (!home.styleLocked) throw new GameError(tr('server.err.buildBeforeRepaint'), 403);
		const next: Record<string, string> = { ...home.colors };
		for (const k of ['floor', 'wall', 'accent', 'rug']) {
			if (colors?.[k] && isHexColor(colors[k])) next[k] = String(colors[k]).trim().toLowerCase();
		}
		await t.Player.patch(playerId, { home: { ...home, colors: next } });
		await bumpMetrics(player, { recolors: 1 });
		return { ok: true };
	}
}

/** POST /SetPlacementColor/ {playerId, placementId, color} — recolor one placed item (paint tool). */
export class SetPlacementColor extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, color } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		if (!(homeOf(player) as any).styleLocked) throw new GameError(tr('server.err.buildBeforeRepaintThings'), 403);
		if (!isHexColor(color)) throw new GameError(tr('server.err.invalidColor'));
		const placement = await findInWorld(t.Placement, worldOf(player), placementId);
		if (!placement) throw new GameError(tr('server.err.itemNotHere'), 404);
		await t.Placement.patch(placementId, { color: String(color).trim().toLowerCase() });
		await bumpMetrics(player, { recolors: 1 });
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
		if (!styleDef) throw new GameError(tr('server.err.unknownHomeStyle'));
		const home = homeOf(player);
		if (home.styleLocked) throw new GameError(tr('server.err.homeAlreadyBuilt'), 403);
		const wid = worldOf(player);

		// building costs materials unique to the chosen style, behind a shared gate
		if (styleDef.requires?.biome) {
			const bs = await findBiomeState(t.BiomeState, wid, styleDef.requires.biome);
			if ((bs?.health || 0) < (styleDef.requires.minHealth || 0)) {
				const d = await defs();
				const biome = d.biome.get(styleDef.requires.biome);
				throw new GameError(
					tr('server.err.restoreFirst', {
						biome: biome?.name || styleDef.requires.biome,
						health: styleDef.requires.minHealth,
					}),
					403,
				);
			}
		}
		const { usedFrom, inventory } = await consumeMaterials(player, styleDef.materials || {}, wid);
		const updated = { ...home, style, styleLocked: true, space: 2 };
		await t.Player.patch(playerId, { home: updated });
		const chests = await byWorld(t.Chest, wid);
		await awardAchievements(playerId);
		await bumpMetrics(player, { homesBuilt: 1 });
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

		const disc = await findDiscovery(t.Discovery, wid, animalId);
		if (!disc) throw new GameError(tr('server.err.animalNotReturned'), 404);
		// An observation is READING about the animal — opening its journal card
		// (or clicking it in the world, which opens the same card). The daily
		// "read about N animals" task only counts each animal once per day, so
		// re-opening the same card isn't farmable.
		const dayKey = playerDayKey(player, Date.now());
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

		const [discoveries, biomeStates, placements, chests] = await Promise.all([
			byWorld(t.Discovery, wid),
			byWorld(t.BiomeState, wid),
			byWorld(t.Placement, wid),
			byWorld(t.Chest, wid),
		]);
		const block = dailyTasksBlock({
			wid,
			player,
			d,
			discoveries,
			biomeStates,
			placements,
			chests,
			now,
			unlockedBiomes: player.unlockedBiomes,
		});
		const task = block.tasks.find((x: any) => x.id === String(taskId || ''));
		if (!task) throw new GameError(tr('server.err.taskNotOnBoard'), 404);
		if (task.pinned) throw new GameError(tr('server.err.taskNotClaimable'), 409); // guidance goals aren't claimed
		if (task.claimed) throw new GameError(tr('server.err.taskAlreadyClaimed'), 409);
		if (task.progress < task.target) throw new GameError(tr('server.err.taskNotFinished'), 409);

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
		if (!Object.keys(gained).length) throw new GameError(tr('server.err.basketFullReward'), 409);

		// Clear the finished goal out for good. Starters (start-*) aren't stored in
		// the goal list, so they're remembered via goalClaims; a player-set goal is
		// removed from customGoals entirely, so it leaves the board, the goals menu,
		// and frees its slot (no lingering "done" entries piling up).
		const isStarter = String(task.id).startsWith('start-');
		const isUnlockReward = String(task.id).startsWith('unlock-reward:');
		const patch: any = { inventory };
		if (isUnlockReward) {
			// one-time welcome bundle — drop it from the pending list so it doesn't reappear
			const bid = String(task.id).slice('unlock-reward:'.length);
			patch.pendingUnlockRewards = (player.pendingUnlockRewards || []).filter((id: string) => id !== bid);
		} else if (isStarter) {
			patch.goalClaims = { ...(player.goalClaims || {}), [task.id]: true };
		} else {
			patch.customGoals = (player.customGoals || []).filter((g: CustomGoal) => g.id !== task.id);
		}
		await t.Player.patch(playerId, patch);
		await bumpMetrics(player, { tasksCompleted: 1 });
		await awardAchievements(playerId);

		const dailyTasks = {
			...block,
			tasks: block.tasks.map((x: any) => (x.id === task.id ? { ...x, claimed: true } : x)),
		};
		return { ok: true, taskId: task.id, text: task.text, gained, inventory, dailyTasks };
	}
}

/**
 * POST /SetGoals/ {playerId, goals:[…]} — replace the player's custom goal list.
 * The client sends the full ordered list (add/remove/reorder are just edits to
 * it); the server validates every entry and stores it. Rewards are NEVER taken
 * from the client — they're derived on claim — so a crafted request can't grant
 * itself materials.
 */
export class SetGoals extends PublicEndpoint {
	async post(data: any) {
		const { playerId, goals } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const t = db();
		const d = await defs();
		const wid = worldOf(player);
		const now = Date.now();
		const [discoveries, biomeStates, placements, chests] = await Promise.all([
			byWorld(t.Discovery, wid),
			byWorld(t.BiomeState, wid),
			byWorld(t.Placement, wid),
			byWorld(t.Chest, wid),
		]);
		const ctx: TaskCtx = {
			wid,
			player,
			d,
			discoveries,
			biomeStates,
			placements,
			chests,
			now,
			unlockedBiomes: player.unlockedBiomes,
		};
		// Preserve each existing goal's baseline across edits (reorder/remove); a
		// brand-new goal gets its baseline captured NOW, so progress counts only the
		// work done from here on (fixes goals that showed complete the instant added).
		const prev = new Map<string, CustomGoal>((player.customGoals || []).map((g: CustomGoal) => [g.id, g]));
		// Hold at most `limit` custom goals at once (3 until every biome is open,
		// then 6). Existing goals are kept first; brand-new ones only fill remaining
		// slots, so a submission over the cap is trimmed rather than rejected.
		const limit = goalLimitFor(player, d);
		const cleaned = sanitizeGoals(goals, d);
		const keep: CustomGoal[] = [];
		for (const g of cleaned) {
			const existing = prev.get(g.id);
			if (!existing && keep.length >= limit) continue; // no room for another new one
			if (keep.length >= MAX_CUSTOM_GOALS) break; // hard safety ceiling
			const base = existing && typeof existing.base === 'number' ? existing.base : goalMetric(g, ctx);
			const out: CustomGoal = { ...g, base };
			if (g.kind === 'build') {
				out.basePlace =
					existing && typeof existing.basePlace === 'number' ? existing.basePlace : placedCountFor(ctx, g.itemId || '');
			}
			keep.push(out);
		}
		await t.Player.patch(playerId, { customGoals: keep });
		return { ok: true, customGoals: keep, goalLimit: limit };
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
		if (!biome) throw new GameError(tr('server.err.terraformOutdoors'));
		if (!(player.unlockedBiomes || []).includes(area))
			throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const grid = areaGrid(d, area);
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError(tr('server.err.outOfReach'));
		}
		const placements = await byWorld(t.Placement, wid);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError(tr('server.err.somethingPlaced'));
		}

		const tileId = `${wid}:${area}:${tx}:${ty}`;
		// Match by position, not id: legacy beds carry an old id but must still be
		// recognized here (see findTerrainAt). A freshly dug bed uses `tileId`.
		const existing = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
		let inventory = player.inventory || {};
		let tile: any = null;
		let removedId: string | undefined;
		let dug: { resourceId: string; amount: number } | null = null;

		if (action === 'dig') {
			if ((player.tools?.shovel || 0) < 1) throw new GameError(tr('server.err.needShovel'));
			if (existing) throw new GameError(tr('server.err.alreadyPrepared'));
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
			if ((player.tools?.['watering-can'] || 0) < 1) throw new GameError(tr('server.err.needWateringCan'));
			if (!existing) throw new GameError(tr('server.err.prepareBedFirst'));
			if (existing.type === 'water') throw new GameError(tr('server.err.alreadyOpenWater'));
			// tilled -> watered bed, watered -> flooded open water: 1 water either way.
			// Chain open-water tiles to shape ponds, lakes, and rivers.
			const cost = 1;
			const newType = existing.type === 'tilled' ? 'watered' : 'water';
			// dry biomes (e.g. the desert) can ready soil beds but cannot be flooded
			if (newType === 'water' && biome.canFlood === false) {
				throw new GameError(tr('server.err.tooDryToFlood', { biome: biome.name }));
			}
			const have = (inventory.water || 0) + (inventory['clean-water'] || 0);
			if (have < cost) throw new GameError(tr('server.err.needWater', { count: cost }));
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
			await t.TerrainTile.patch(existing.id, { type: newType, updatedAt: Date.now() });
		} else if (action === 'clear') {
			if (!existing) throw new GameError(tr('server.err.nothingToClear'));
			await t.TerrainTile.delete(existing.id);
			removedId = existing.id;
		} else {
			throw new GameError(tr('server.err.badTerraformAction'));
		}

		const recalc = await recalcBiome(wid, playerId, area, {
			addTerrain: tile ? [tile] : [],
			removeTerrainIds: removedId ? [removedId] : [],
			player: { ...player, inventory },
		});
		await bumpMetrics(
			player,
			{ terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 },
			action === 'water' ? { water: 1 } : {},
		);
		await awardWorldAchievements(wid, playerId, {
			addDiscoveries: recalc.newAnimals,
			freshBiomeStates: [recalc.biomeState],
		});
		return { ok: true, tile, removedId, dug, inventory, ...recalc };
	}
}

/** POST /RecalcBiome/ {playerId, biomeId} — explicit recalculation (also runs on every placement). */
export class RecalcBiome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const recalcResult = await recalcBiome(worldOf(player), playerId, biomeId);
		await awardWorldAchievements(worldOf(player), playerId, {
			addDiscoveries: recalcResult.newAnimals,
			freshBiomeStates: [recalcResult.biomeState],
		});
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
			// High-water mark: the furthest tutorial step this save ever reached.
			// Progressive UI (HUD nav buttons) keys off THIS, not the live step, so
			// replaying the tutorial from Help — which rewinds tutorialStep back to
			// 0 — never re-hides menu items the player already unlocked. Seed from
			// the current persisted step so pre-existing finished saves keep their
			// reveal on the very first sync after upgrading.
			patch.tutorialMaxStep = Math.max(player.tutorialMaxStep ?? 0, player.tutorialStep ?? 0, tutorialStep);
		}
		if (area === 'home') {
			// the home interior is always reachable from your camp — no gates
			patch.area = 'home';
		} else if (tentBiomeOf(area)) {
			// stepping inside a trail tent: its biome must be open and a tent
			// actually pitched there (the interior belongs to the placement)
			const tb = tentBiomeOf(area)!;
			const biome = d.biome.get(tb);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }));
			if (!(player.unlockedBiomes || []).includes(tb)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);
			}
			const wid = worldOf(player);
			const hasTent = (await byWorld(t.Placement, wid)).some((p) => p.area === tb && p.objectId === 'trail-tent');
			if (!hasTent) throw new GameError(tr('server.err.noTentHere'), 404);
			patch.area = area;
		} else if (area) {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }));
			if (!(player.unlockedBiomes || []).includes(area)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403);
			}
			if (!biome.explorable) {
				throw new GameError(tr('server.err.notExplorable', { biome: biome.name }), 403);
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
			const text = String(e?.text || '')
				.slice(0, 500)
				.trim();
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
		const { playerId, language, edition } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const now = Date.now();
		const prev = readMetrics(player) || freshMetrics(player.createdAt || now);
		// Interface language, reported by the client on every beat (BCP-47-ish
		// short code, e.g. "en"/"es"). Kept on the metrics blob for dashboards.
		const lang = typeof language === 'string' && language.trim() ? language.trim().toLowerCase().slice(0, 12) : null;
		// Which product this session belongs to (demo | full), so dashboards can
		// split demo players from paid. Sticky once set to 'demo'.
		const ed: 'demo' | 'full' | null = edition === 'demo' ? 'demo' : edition === 'full' ? 'full' : null;
		const last = prev.lastHeartbeatAt || 0;
		const gap = now - last;

		let playSeconds = prev.playSeconds || 0;
		let sessions = prev.sessions || 0;
		let curSessionSeconds = prev.curSessionSeconds || 0;
		const areaSeconds: Record<string, number> = { ...(prev.areaSeconds || {}) };
		const sessionLengths: Record<string, number> = { ...(prev.sessionLengths || {}) };
		const newSession = last === 0 || gap > SESSION_GAP_MS;
		if (newSession) {
			// The previous session just ended — bucket its length into the histogram
			// before starting the new one (nothing to bucket on the very first beat).
			if (curSessionSeconds > 0) {
				const b = sessionBucket(curSessionSeconds);
				sessionLengths[b] = (sessionLengths[b] || 0) + 1;
			}
			curSessionSeconds = 0;
			sessions += 1; // first beat of a new play session
		} else {
			const credit = Math.min(gap, MAX_BEAT_MS) / 1000;
			playSeconds += credit;
			curSessionSeconds += credit;
			// Attribute the elapsed time to the area the player is currently in.
			const area = player.area || 'unknown';
			areaSeconds[area] = round1((areaSeconds[area] || 0) + credit);
		}

		const metrics = {
			...prev,
			firstSeenAt: prev.firstSeenAt || player.createdAt || now,
			lastSeenAt: now,
			lastHeartbeatAt: now,
			playSeconds: Math.round(playSeconds),
			sessions,
			curSessionSeconds: Math.round(curSessionSeconds),
			areaSeconds,
			sessionLengths,
			...(lang ? { language: lang } : {}),
			// Keep 'demo' sticky: a demo player is never re-tagged 'full'.
			...(ed ? { edition: prev.edition === 'demo' ? 'demo' : ed } : {}),
		};
		await t.Player.patch(playerId, { metrics: encodeMetrics(metrics) });

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

// Small in-memory cache for the global dashboard rollup. The dashboard branch
// full-scans SoloMetrics and JSON.parses every row's snapshot; that's the only
// expensive part, so we cache the scanned+parsed rows for a short TTL and let
// each request apply its ?exclude filter + aggregation cheaply on top. Reset on
// every new uplink (SyncMetrics) so a player's own report shows up immediately.
let dashboardCache: { at: number; all: any[] } | null = null;
const DASHBOARD_CACHE_MS = 30_000;

/** Numeric segments of a version string, e.g. "0.2.10+build" → [0, 2, 10]. */
function versionSegments(s: string): number[] {
	return String(s)
		.split(/[^0-9]+/)
		.filter(Boolean)
		.map((n) => parseInt(n, 10));
}
/**
 * Semver-ish comparison: -1 if a<b, 0 if equal, 1 if a>b. Versions are compared
 * segment-by-segment numerically ("0.2.10" > "0.2.9"); a version with no numeric
 * segments ('unknown', '') sorts BELOW any real release, so it never counts as
 * "newer than" a selected version in the dashboard's min-mode filter.
 */
function compareVersions(a: string, b: string): number {
	const A = versionSegments(a);
	const B = versionSegments(b);
	if (!A.length && !B.length) return a < b ? -1 : a > b ? 1 : 0;
	if (!A.length) return -1;
	if (!B.length) return 1;
	const len = Math.max(A.length, B.length);
	for (let i = 0; i < len; i++) {
		const x = A[i] ?? 0;
		const y = B[i] ?? 0;
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

/**
 * GET /Metrics/        — global summary plus a per-player leaderboard.
 * GET /Metrics/<id>    — one player's metrics.
 * Read-only analytics view, safe to point a dashboard or cron at.
 */
export class Metrics extends PublicEndpoint {
	async get(target?: any) {
		const t = db();
		// `target` is Harper's RequestTarget (a URLSearchParams subclass): it carries
		// the path id and any ?query parameters.
		const id = String((this as any).getId?.() || target?.id || '').trim();

		if (id) {
			const player = await t.Player.get(id);
			if (!player) throw new GameError(tr('server.err.noSaveWithId'), 404);
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

		// Dashboard view — sourced ENTIRELY from the SoloMetrics table, which is now
		// the single client-metrics stream: desktop solo play, the browser demo (both
		// Harper mode and its offline fallback), and any offline solo all uplink a
		// full snapshot here (see SyncMetrics + src/solo/metricsUplink.ts). So this
		// endpoint rolls up every reporting player — split by `edition` (demo/full)
		// and `platform` (web/desktop) below — without touching the live
		// Player/BiomeState tables. (Full hosted web/co-op, if ever added, report
		// server-side and would stay out of this rollup.)
		const now = Date.now();
		let all: any[];
		if (dashboardCache && now - dashboardCache.at < DASHBOARD_CACHE_MS) {
			all = dashboardCache.all; // fresh enough — skip the full scan + JSON.parse
		} else {
			let soloRows: any[] = [];
			try {
				soloRows = await allOf(t.SoloMetrics);
			} catch {
				/* SoloMetrics table not created yet — empty dashboard */
			}

			all = soloRows
				.map((r: any) => {
					// snapshot is stored as a JSON string (see SyncMetrics); tolerate any
					// legacy object rows too.
					let s: any = {};
					if (r.snapshot) {
						try {
							s = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
						} catch {
							s = {};
						}
					}
					const lastSeenAt = s.lastSeenAt || r.updatedAt || null;
					const createdAt = s.createdAt || r.createdAt || now;
					const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
					let status: 'active' | 'recent' | 'dormant' = 'dormant';
					if (hoursSinceActive != null) {
						if (hoursSinceActive <= 24) status = 'active';
						else if (hoursSinceActive <= 24 * 7) status = 'recent';
					}
					// Count character-creation time as part of the session. The raw
					// `playSeconds` metric only starts accruing AFTER the creator, so a
					// player who spent 30–80s (sometimes minutes) customizing and then left
					// logged 0 play time and a 0-length session — noise that swamped the
					// report. Fold the creator time in here (report-only: the gameplay clock
					// still reads raw playSeconds elsewhere) and credit one session to anyone
					// who got as far as creating a character.
					const rawPlaySeconds = s.playSeconds || 0;
					const sessionSeconds = Math.round(rawPlaySeconds + (s.creationMs || 0) / 1000);
					const sessionCount = Math.max(s.sessions || 0, (s.creationMs || 0) > 0 ? 1 : 0);
					return {
						...s,
						playerId: r.id, // slot-scoped id — solo name slugs can collide across machines
						name: r.name || s.name || null,
						solo: true,
						platform: r.platform || null,
						os: r.os || null,
						language: r.language || s.language || null,
						version: r.version || null,
						build: r.build || null,
						lastSyncedAt: r.updatedAt || null,
						counts: s.counts || {},
						playSeconds: sessionSeconds,
						playMinutes: Math.round(sessionSeconds / 60),
						avgSessionMinutes: sessionCount ? Math.round(sessionSeconds / 60 / sessionCount) : 0,
						sessions: sessionCount,
						totalActions: s.totalActions || 0,
						currentArea: s.currentArea || null,
						unlockedBiomes: s.unlockedBiomes || 0,
						tutorialStep: s.tutorialStep || 0,
						activation: s.activation || {},
						achievements: s.achievements || null,
						biomeSummary: s.biomeSummary || {
							biomesUnlocked: 0,
							avgHealth: 0,
							biomesFullyRestored: 0,
							totalAnimalsReturned: 0,
						},
						// new metric fields (defaulted so aggregation is safe on legacy rows)
						areaSeconds: s.areaSeconds || {},
						sessionLengths: s.sessionLengths || {},
						creationMs: s.creationMs || 0,
						creationSeconds: s.creationSeconds ?? (s.creationMs ? round1(s.creationMs / 1000) : null),
						timeToFirstActionSeconds: s.timeToFirstActionSeconds ?? null,
						appearance: s.appearance || null,
						createdAt,
						lastSeenAt,
						hoursSinceActive,
						minutesSinceActive: lastSeenAt ? round1((now - lastSeenAt) / 60_000) : null,
						status,
						daysSinceJoined: Math.floor((now - createdAt) / DAY_MS),
						isNewToday: now - createdAt <= DAY_MS,
					};
				})
				.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);
			dashboardCache = { at: now, all }; // cache the scanned + parsed rollup
		}

		// Full list of versions seen (before any filtering), so the dashboard's
		// version dropdown always has every option regardless of the active filter.
		const versionCounts: Record<string, number> = {};
		for (const v of all) {
			const ver = v.version || 'unknown';
			versionCounts[ver] = (versionCounts[ver] || 0) + 1;
		}
		const availableVersions = Object.keys(versionCounts).sort((a, b) =>
			b.localeCompare(a, undefined, { numeric: true }),
		);
		// Same idea for edition (demo/full) and platform (web/desktop): full option
		// lists computed before filtering, so the dropdowns are always complete.
		const availableEditions = [...new Set(all.map((v) => (v.edition === 'demo' ? 'demo' : 'full')))].sort();
		const availablePlatforms = [...new Set(all.map((v) => v.platform || 'unknown'))].sort();

		// Optional `?exclude=<name>` filter (repeatable and/or comma-separated) so you
		// can drop your own test saves and not skew the numbers. Case-insensitive match
		// on the save's display name.
		const excludedNames = new Set<string>();
		try {
			const raw: string[] =
				typeof target?.getAll === 'function' ? [...target.getAll('exclude'), ...target.getAll('excludeName')] : [];
			for (const part of raw.flatMap((s: string) => String(s).split(','))) {
				const n = part.trim().toLowerCase();
				if (n) excludedNames.add(n);
			}
		} catch {
			/* no query params on this target */
		}
		if (excludedNames.size)
			all = all.filter(
				(v) =>
					!excludedNames.has(
						String(v.name || '')
							.trim()
							.toLowerCase(),
					),
			);

		// Optional `?version=<build>` filter — scopes the whole report (including the
		// acquisition funnel below) to a game version. `?versionMode=min` widens it to
		// "this version AND anything newer" (semver-ish compare); anything else (the
		// default) isolates the single selected version. 'all'/empty = no filter.
		let versionFilter = '';
		try {
			const raw = typeof target?.getAll === 'function' ? target.getAll('version') : [];
			versionFilter = String((raw && raw[0]) || '').trim();
		} catch {
			/* no query params on this target */
		}
		let versionMode: 'exact' | 'min' = 'exact';
		try {
			const raw = typeof target?.getAll === 'function' ? target.getAll('versionMode') : [];
			if (
				String((raw && raw[0]) || '')
					.trim()
					.toLowerCase() === 'min'
			)
				versionMode = 'min';
		} catch {
			/* no query params on this target */
		}
		const versionActive = !!versionFilter && versionFilter.toLowerCase() !== 'all';
		// Match a save's version against the active filter. In 'min' mode an
		// unparseable/'unknown' version sorts lowest, so it's only ever included when
		// no filter is active — never as "newer than" a real release.
		const matchesVersion = (ver: string): boolean => {
			if (!versionActive) return true;
			const vv = ver || 'unknown';
			return versionMode === 'min' ? compareVersions(vv, versionFilter) >= 0 : vv === versionFilter;
		};
		if (versionActive) all = all.filter((v) => matchesVersion(v.version || 'unknown'));

		// Optional `?edition=demo|full` and `?platform=web|desktop` filters.
		const oneParam = (key: string): string => {
			try {
				const raw = typeof target?.getAll === 'function' ? target.getAll(key) : [];
				return String((raw && raw[0]) || '').trim();
			} catch {
				return '';
			}
		};
		const editionFilter = oneParam('edition');
		const platformFilter = oneParam('platform');
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.platform || 'unknown') === platformFilter);

		const N = all.length || 1;
		const pct = (n: number) => Math.round((n / N) * 100);

		// Per-counter action totals across everyone (includes cosmetic counters).
		const actionTotals: Record<string, number> = {};
		for (const v of all) {
			for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + (n as number);
		}

		const totalPlaySeconds = all.reduce((acc, v) => acc + v.playSeconds, 0);
		const totalSessions = all.reduce((acc, v) => acc + v.sessions, 0);
		const totalActions = all.reduce((acc, v) => acc + v.totalActions, 0);

		// Audience buckets by recency. `activeNow` counts saves seen in the last 5
		// minutes — note solo saves uplink every ~3 min, so that's the practical
		// freshness floor for "playing right now".
		const audience = {
			activeNow: all.filter((v) => v.minutesSinceActive != null && v.minutesSinceActive <= 5).length,
			activeLast24h: all.filter((v) => v.status === 'active').length,
			activeLast7d: all.filter((v) => v.status === 'active' || v.status === 'recent').length,
			dormant: all.filter((v) => v.status === 'dormant').length,
			newLast24h: all.filter((v) => now - v.createdAt <= DAY_MS).length,
			newLast7d: all.filter((v) => now - v.createdAt <= 7 * DAY_MS).length,
		};

		// Composition breakdowns straight off the uplink envelope.
		const tally = (pick: (v: any) => string | null) => {
			const out: Record<string, number> = {};
			for (const v of all) {
				const k = pick(v) || 'unknown';
				out[k] = (out[k] || 0) + 1;
			}
			return out;
		};
		const languages = tally((v) => v.language || 'en');
		const platforms = tally((v) => v.platform);
		const operatingSystems = tally((v) => v.os);
		const versions = tally((v) => v.version);
		// demo vs paid split (rides inside each solo snapshot; defaults to full).
		const editions = tally((v) => v.edition || 'full');

		// Retention: did they come back for more than one session?
		const returningPlayers = all.filter((v) => v.sessions >= 2).length;

		// Activation funnel — how far players get from first launch. Each flag is
		// read from the snapshot's activation block when present, falling back to the
		// raw counts / durable biome state so legacy snapshots (uplinked before a flag
		// existed) still register. NOTE: these are independent booleans, not ordered
		// prerequisites — `attractedAnimal` comes from durable animal-return state,
		// while `crafted`/`placed` come from action counters that only tally actions
		// taken after counting shipped. So a player can show "attracted" without
		// "crafted": it's a data-source difference, not an impossible sequence. The
		// dashboard sorts the steps by count, so it always reads as a clean funnel.
		const did = (v: any, key: string) => v.counts && (v.counts[key] || 0) > 0;
		const funnel = {
			created: all.length,
			collected: all.filter((v) => v.activation?.collected || did(v, 'resourcesCollected')).length,
			terraformed: all.filter((v) => v.activation?.terraformed || did(v, 'terraformActions')).length,
			planted: all.filter((v) => v.activation?.planted || did(v, 'plantsPlanted')).length,
			crafted: all.filter((v) => v.activation?.crafted || did(v, 'itemsCrafted')).length,
			placed: all.filter((v) => v.activation?.placed || did(v, 'objectsPlaced')).length,
			attractedAnimal: all.filter(
				(v) => v.activation?.attractedAnimal || (v.biomeSummary?.totalAnimalsReturned || 0) > 0,
			).length,
			upgradedTool: all.filter((v) => v.activation?.upgradedTool || did(v, 'toolsUpgraded')).length,
			builtHome: all.filter((v) => v.activation?.builtHome || did(v, 'homesBuilt')).length,
			upgradedHome: all.filter((v) => v.activation?.upgradedHome || did(v, 'homeUpgrades')).length,
			unlockedSecondBiome: all.filter((v) => v.activation?.unlockedSecondBiome || (v.unlockedBiomes || 0) >= 2).length,
		};
		const funnelPct = {
			collected: pct(funnel.collected),
			terraformed: pct(funnel.terraformed),
			planted: pct(funnel.planted),
			crafted: pct(funnel.crafted),
			placed: pct(funnel.placed),
			attractedAnimal: pct(funnel.attractedAnimal),
			upgradedTool: pct(funnel.upgradedTool),
			builtHome: pct(funnel.builtHome),
			upgradedHome: pct(funnel.upgradedHome),
			unlockedSecondBiome: pct(funnel.unlockedSecondBiome),
		};

		// Where players are in the world.
		const areaTally: Record<string, number> = {};
		for (const v of all) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
		const mostPopularArea = Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

		// Tutorial progress — where first-run players stall.
		const tutorialTally: Record<string, number> = {};
		for (const v of all) {
			const k = String(v.tutorialStep || 0);
			tutorialTally[k] = (tutorialTally[k] || 0) + 1;
		}

		// Biome restoration, rolled up from each snapshot's biomeSummary.
		const withBiomes = all.filter((v) => (v.biomeSummary?.biomesUnlocked || 0) > 0);
		const avgBiomeHealth = withBiomes.length
			? Math.round(withBiomes.reduce((acc, v) => acc + (v.biomeSummary.avgHealth || 0), 0) / withBiomes.length)
			: 0;

		// Achievements, rolled up from each snapshot's achievements block. Hosted
		// PlayerAchievement rows are out of scope — this dashboard is solo-only.
		const withAch = all.filter((v) => v.achievements);
		const totalEarned = withAch.reduce((acc, v) => acc + (v.achievements.earned || 0), 0);
		const recentDistribution: Record<string, number> = {};
		const byCategory: Record<string, number> = {};
		const completionHistogram: Record<string, number> = {};
		for (const v of withAch) {
			for (const rec of v.achievements.recent || [])
				if (rec?.id) recentDistribution[rec.id] = (recentDistribution[rec.id] || 0) + 1;
			for (const [cat, n] of Object.entries(v.achievements.byCategory || {}))
				byCategory[cat] = (byCategory[cat] || 0) + (n as number);
			const e = v.achievements.earned || 0;
			const bucket = e === 0 ? '0' : `${Math.floor((e - 1) / 10) * 10 + 1}-${(Math.floor((e - 1) / 10) + 1) * 10}`;
			completionHistogram[bucket] = (completionHistogram[bucket] || 0) + 1;
		}
		const achievementsSummary = {
			totalDefined: withAch.reduce((m, v) => Math.max(m, v.achievements.total || 0), 0),
			totalEarned,
			avgPerPlayer: round1(totalEarned / (withAch.length || 1)),
			avgCompletionPct: withAch.length
				? Math.round((withAch.reduce((a, v) => a + (v.achievements.completion || 0), 0) / withAch.length) * 100)
				: 0,
			avgPoints: round1(withAch.reduce((a, v) => a + (v.achievements.points || 0), 0) / (withAch.length || 1)),
			byCategory,
			recentDistribution,
			completionHistogram,
		};

		// Time-per-area: sum every save's dwell time, so you can see where players
		// actually spend their sessions (and the single most-lived-in area).
		const areaSecondsTotals: Record<string, number> = {};
		for (const v of all) {
			for (const [a, sec] of Object.entries(v.areaSeconds || {}))
				areaSecondsTotals[a] = (areaSecondsTotals[a] || 0) + (sec as number);
		}
		const totalAreaSeconds = Object.values(areaSecondsTotals).reduce((a, b) => a + b, 0);
		const areaMinutesTotals: Record<string, number> = {};
		for (const [a, sec] of Object.entries(areaSecondsTotals)) areaMinutesTotals[a] = Math.round(sec / 60);
		const areaDwell = {
			totalSeconds: Math.round(totalAreaSeconds),
			byAreaSeconds: areaSecondsTotals,
			byAreaMinutes: areaMinutesTotals,
			mostTimeArea: Object.entries(areaSecondsTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
		};

		// Session-length distribution: sum each save's finished-session histogram.
		const sessionLengthDistribution: Record<string, number> = { '<2m': 0, '2-10m': 0, '10-30m': 0, '30m+': 0 };
		for (const v of all) {
			for (const [b, n] of Object.entries(v.sessionLengths || {}))
				sessionLengthDistribution[b] = (sessionLengthDistribution[b] || 0) + (n as number);
		}

		// Character creation: how long people spend in the creator (across saves).
		const withCreation = all.filter((v) => (v.creationMs || 0) > 0);
		const creation = {
			savesWithTiming: withCreation.length,
			avgCreationSeconds: withCreation.length
				? round1(withCreation.reduce((a, v) => a + v.creationMs, 0) / withCreation.length / 1000)
				: 0,
			medianCreationSeconds: withCreation.length
				? round1(
						[...withCreation].map((v) => v.creationMs).sort((a, b) => a - b)[Math.floor(withCreation.length / 2)] /
							1000,
					)
				: 0,
		};

		// Customization popularity: which appearance options players actually pick.
		const appTally: Record<string, Record<string, number>> = {};
		const bump = (field: string, val: any) => {
			if (val == null || val === '') return;
			const key = String(val);
			(appTally[field] ||= {})[key] = (appTally[field][key] || 0) + 1;
		};
		for (const v of all) {
			const a = v.appearance;
			if (!a) continue;
			bump('skin', a.skin);
			bump('hair', a.hair);
			bump('outfit', a.outfit);
			bump('hat', a.hat);
			bump('hatColor', a.hatColor);
			bump('hairstyle', a.hairstyle);
			bump('beard', a.beard);
			bump('body', a.body);
		}
		const appearancePopularity = { savesWithAppearance: all.filter((v) => v.appearance).length, choices: appTally };

		// Onboarding friction: how long from creating a save to the first action.
		const withTTFA = all.filter((v) => v.timeToFirstActionSeconds != null);
		const timeToFirstAction = {
			playersMeasured: withTTFA.length,
			avgSeconds: withTTFA.length
				? round1(withTTFA.reduce((a, v) => a + v.timeToFirstActionSeconds, 0) / withTTFA.length)
				: 0,
		};

		// Settings & accessibility usage — audio mute rate plus which accessibility
		// options players actually turn on. Sourced from the `prefs` block each solo
		// snapshot uplinks (see metricsUplink.ts); only saves that report it count.
		const withPrefs = all.filter((v) => v.prefs && typeof v.prefs === 'object');
		const prefN = withPrefs.length || 1;
		const countPref = (test: (p: any) => boolean) => withPrefs.filter((v) => test(v.prefs)).length;
		const tallyPref = (pick: (p: any) => string) => {
			const out: Record<string, number> = {};
			for (const v of withPrefs) {
				const k = pick(v.prefs) || 'unknown';
				out[k] = (out[k] || 0) + 1;
			}
			return out;
		};
		const musicOff = countPref((p) => p.musicEnabled === false);
		const sfxOff = countPref((p) => p.sfxEnabled === false);
		const settings = {
			savesReporting: withPrefs.length,
			audio: {
				musicOff,
				sfxOff,
				fullyMuted: countPref((p) => p.musicEnabled === false && p.sfxEnabled === false),
				musicOffPct: Math.round((musicOff / prefN) * 100),
				sfxOffPct: Math.round((sfxOff / prefN) * 100),
			},
			accessibility: {
				reduceMotion: countPref((p) => p.reduceMotion === true),
				dyslexiaFont: countPref((p) => p.dyslexiaFont === true),
				colorblindOn: countPref((p) => p.colorblindMode && p.colorblindMode !== 'off'),
				anyEnabled: countPref(
					(p) =>
						p.reduceMotion === true ||
						p.dyslexiaFont === true ||
						(p.colorblindMode && p.colorblindMode !== 'off') ||
						(p.textScale && p.textScale !== 'md'),
				),
				colorblindModes: tallyPref((p) => p.colorblindMode || 'off'),
				textScales: tallyPref((p) => p.textScale || 'md'),
			},
		};

		// Acquisition funnel — from the per-device AppOpen table, so it counts
		// people who opened the app but never made a character (bounced), and how
		// many characters each person creates. Independent of ?exclude (device-scoped).
		let openRows: any[] = [];
		try {
			openRows = await allOf(t.AppOpen);
		} catch {
			/* AppOpen table not created yet */
		}
		// Keep acquisition consistent with the active filters.
		if (versionActive) openRows = openRows.filter((o) => matchesVersion(o.version || 'unknown'));
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.platform || 'unknown') === platformFilter);
		const devices = openRows.length;
		const convertedDevices = openRows.filter((o) => o.converted).length;
		// Demo completion: of the demo installs that made a character, how many
		// reached the hard-stop (goal animals returned). Device-scoped + sticky.
		const demoDevices = openRows.filter((o) => o.edition === 'demo');
		const demoConverted = demoDevices.filter((o) => o.converted).length;
		const demoFinished = demoDevices.filter((o) => o.reachedDemoGoal).length;
		const demoCompletion = {
			demoInstalls: demoDevices.length,
			createdCharacter: demoConverted,
			reachedGoal: demoFinished,
			// completion rate among demo players who actually made a character
			completionPct: demoConverted ? Math.round((demoFinished / demoConverted) * 100) : 0,
		};
		// demo vs paid split of installs (edition is stamped on each AppOpen row).
		const editionSplit: Record<string, number> = {};
		for (const o of openRows) {
			const k = o.edition === 'demo' ? 'demo' : 'full';
			editionSplit[k] = (editionSplit[k] || 0) + 1;
		}
		const withCreatorTime = openRows.filter((o) => (o.creationMs || 0) > 0);
		const totalCharacters = openRows.reduce((a, o) => a + (o.savesCreated || 0), 0);
		const savesPerPersonHistogram: Record<string, number> = {};
		for (const o of openRows) {
			const k = String(o.savesCreated || 0);
			savesPerPersonHistogram[k] = (savesPerPersonHistogram[k] || 0) + 1;
		}
		const acquisition = {
			devices,
			totalOpens: openRows.reduce((a, o) => a + (o.opens || 0), 0),
			converted: convertedDevices,
			bounced: devices - convertedDevices,
			conversionPct: devices ? Math.round((convertedDevices / devices) * 100) : 0,
			bounceRatePct: devices ? Math.round(((devices - convertedDevices) / devices) * 100) : 0,
			avgCreatorSeconds: withCreatorTime.length
				? round1(withCreatorTime.reduce((a, o) => a + o.creationMs, 0) / withCreatorTime.length / 1000)
				: 0,
			totalCharactersCreated: totalCharacters,
			avgCharactersPerPerson: devices ? round1(totalCharacters / devices) : 0,
			avgCharactersPerConverted: convertedDevices ? round1(totalCharacters / convertedDevices) : 0,
			charactersPerPersonHistogram: savesPerPersonHistogram,
			editions: editionSplit,
		};

		return {
			generatedAt: now,
			source: 'solo-metrics',
			filters: {
				availableVersions,
				availableEditions,
				availablePlatforms,
				version: versionActive ? versionFilter : null,
				versionMode: versionActive ? versionMode : null,
				edition: editionFilter && editionFilter.toLowerCase() !== 'all' ? editionFilter : null,
				platform: platformFilter && platformFilter.toLowerCase() !== 'all' ? platformFilter : null,
			},
			summary: {
				players: all.length,
				soloPlayers: all.length,
				excludedNames: [...excludedNames],
				audience,
				languages,
				platforms,
				operatingSystems,
				versions,
				editions,
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
					biomesFullyRestored: all.reduce((acc, v) => acc + (v.biomeSummary?.biomesFullyRestored || 0), 0),
					avgUnlockedBiomes: round1(all.reduce((acc, v) => acc + (v.unlockedBiomes || 0), 0) / N),
					mostPopularArea,
					tutorialStepHistogram: tutorialTally,
				},
				areaDwell,
				sessionLengthDistribution,
				creation,
				appearancePopularity,
				timeToFirstAction,
				acquisition,
				demoCompletion,
				settings,
				funnel,
				funnelPct,
				actionTotals,
				achievements: achievementsSummary,
			},
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
		if (!id) throw new GameError(tr('server.err.snapshotPathId'));
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
 * recipes craftable), 'welcome-animals' (force every animal in the area back),
 * 'populate-biome' (build a fully-restored showcase biome for screenshots/video),
 * 'set-weather' (force weather/season for filming; value {type?,season?} or clear).
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
			case 'set-time': {
				// Jump the in-game clock forward to the start of a chosen phase, so the
				// HUD clock, weather, and world lighting all reflect it. `value` is the
				// phase id (dawn/day/dusk/night).
				const phase = String(value || 'dawn');
				const nowT = weatherTimeFromPlay(player);
				const skip = nextPhaseAt(nowT, phase) - nowT;
				await t.Player.patch(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
				log.push(`Set time to ${phase}`);
				break;
			}
			case 'reset-clock': {
				// Restart the game clock at day one's morning — the same starting time a
				// fresh save gets. Solve for the offset that lands the current play time
				// back on the day-phase start (season resets to the first day too).
				const playMs = Math.round((readMetrics(player)?.playSeconds || 0) * 1000);
				await t.Player.patch(playerId, { clockOffsetMs: nextPhaseAt(0, 'day') - playMs });
				log.push('Reset the game clock to the first morning');
				break;
			}
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
						if (n > 0 && valid.has(id)) {
							inventory[id] = (inventory[id] || 0) + n;
							granted++;
						}
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
				if (!nextB) {
					log.push('Every biome is already unlocked');
					break;
				}
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
			case 'restart-game': {
				// Wipe the solo save back to a brand-new game — same as making a fresh
				// character, but the identity (name, passcode, look) is kept. Solo only.
				const wid = playerId; // solo world id === player id
				for (const pl of await byPlayer(t.Placement, playerId)) await t.Placement.delete(pl.id);
				for (const ch of await byPlayer(t.Chest, playerId)) await t.Chest.delete(ch.id);
				for (const tt of await byPlayer(t.TerrainTile, playerId)) await t.TerrainTile.delete(tt.id);
				for (const disc of await byPlayer(t.Discovery, playerId)) await t.Discovery.delete(disc.id);
				for (const ns of await byPlayer(t.NodeState, playerId)) await t.NodeState.delete(ns.id);
				for (const fe of await byPlayer(t.FeedEntry, playerId)) await t.FeedEntry.delete(fe.id);
				for (const pa of await byPlayer(t.PlayerAchievement, playerId)) await t.PlayerAchievement.delete(pa.id);
				// Reset every biome to its damaged, locked state (meadow stays open).
				for (const b of d.biomes) {
					await t.BiomeState.put({
						id: `${wid}:${b.id}`,
						worldId: wid,
						playerId,
						biomeId: b.id,
						health: BASE_HEALTH,
						balance: 0,
						returnedCount: 0,
						unlocked: b.id === 'meadow',
					});
				}
				// Recreate the empty starter chest by the camp.
				const chestId = `pl_${playerId}_starter-chest`;
				await t.Placement.put({
					id: chestId,
					worldId: wid,
					playerId,
					objectId: 'small-chest',
					area: 'meadow',
					x: STARTER_CHEST.x,
					y: STARTER_CHEST.y,
					placedAt: Date.now(),
				});
				await t.Chest.put({
					id: chestId,
					worldId: wid,
					playerId,
					area: 'meadow',
					x: STARTER_CHEST.x,
					y: STARTER_CHEST.y,
					size: 'small-chest',
					capacity: STARTER_CHEST.capacity,
					contents: {},
				});
				// Reset the player fields to fresh-start values, keeping identity.
				await t.Player.patch(playerId, {
					area: 'meadow',
					x: 24.5,
					y: 6.5,
					inventory: { ...START_INVENTORY },
					craftedItems: {},
					craftedEver: {},
					tools: { ...START_TOOLS },
					unlockedBiomes: ['meadow'],
					visitedBiomes: ['meadow'],
					tutorialStep: 0,
					home: { ...DEFAULT_HOME },
					customGoals: [],
					goalClaims: {},
					devUnlockAll: false,
					// Restart the game clock at day one's morning too (same as a fresh save),
					// so a wiped game doesn't reopen at whatever time you left off.
					clockOffsetMs: nextPhaseAt(0, 'day') - Math.round((readMetrics(player)?.playSeconds || 0) * 1000),
				});
				log.push('Restarted the game — fresh save (name, passcode & look kept)');
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
					style: value && HOME_STYLES[value] ? value : homeOf(player).style || 'cabin',
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
				log.push(
					`Reset ${ar} to its damaged state — removed ${placementsRemoved} object${placementsRemoved === 1 ? '' : 's'} and sent ${animalsRemoved} animal${animalsRemoved === 1 ? '' : 's'} away (chests kept)`,
				);
				break;
			}
			case 'lock-biome': {
				// Re-lock the current area so the unlock flow can be retested. The
				// starting meadow can't be locked — you'd have nowhere to stand.
				const ar = area || player.area;
				if (ar === 'meadow') throw new GameError(tr('server.err.meadowCannotLock'));
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
				const already = new Set(
					(await byPlayer(t.Discovery, playerId)).filter((x) => x.biomeId === ar).map((x) => x.animalId),
				);
				let added = 0;
				for (const animal of here) {
					if (already.has(animal.id)) continue;
					await t.Discovery.put({
						id: `${playerId}:${animal.id}`,
						playerId,
						animalId: animal.id,
						biomeId: ar,
						comfort: 3,
						timesObserved: 0,
						firstObservedAt: Date.now(),
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
				if (!animal) throw new GameError(tr('server.err.unknownAnimal', { animal: animalId }));
				const discId = `${playerId}:${animal.id}`;
				const existing = await t.Discovery.get(discId);
				if (!existing) {
					await t.Discovery.put({
						id: discId,
						playerId,
						animalId: animal.id,
						biomeId: animal.biome,
						comfort: 85,
						timesObserved: 1,
						firstObservedAt: Date.now(),
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
			case 'populate-biome': {
				// Showcase builder: turn the current area into a lush, fully-restored
				// biome for screenshots/video — naturally SCATTERED clusters of trees,
				// flowers and shrubs, crafted accents dotted about, path runs, a carved
				// lake + winding river (where the biome holds water), every animal home
				// and comfortable, and health/balance pinned at 100. Deterministic per
				// biome so the scene is repeatable. Chests are kept; all other placements
				// + terrain here are replaced for a clean look.
				const ar = area || player.area;
				const biome = d.biome.get(ar);
				if (!biome || ar === 'home') throw new GameError(tr('server.err.cannotPopulate', { area: ar }));
				const wid = worldOf(player);

				// make sure the area is reachable so you can walk in and film it
				const unlockedSet = new Set<string>(player.unlockedBiomes || ['meadow']);
				if (!unlockedSet.has(ar)) {
					unlockedSet.add(ar);
					await t.Player.patch(playerId, { unlockedBiomes: [...unlockedSet] });
				}

				// clean canvas: drop existing non-chest placements + all terrain here
				for (const pl of (await byWorld(t.Placement, wid)).filter((p) => p.area === ar)) {
					if (d.object.get(pl.objectId)?.isChest) continue;
					await t.Placement.delete(pl.id);
				}
				for (const tt of (await byWorld(t.TerrainTile, wid)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}

				// playable region (mirror the client): alpine reserves a mountain band on
				// top, coastal reserves ocean columns on the east; the meadow keeps camp clear.
				const grid = areaGrid(d, ar);
				const playTop = ar === 'alpine' ? ALPINE_MTN_ROWS : 0;
				const landRight = ar === 'coastal' ? grid.cols - (biome.oceanCols || 0) : grid.cols;
				const xMin = 2,
					xMax = landRight - 2;
				const yMin = playTop + 2,
					yMax = grid.rows - 2;
				const inCamp = (x: number, y: number) => ar === 'meadow' && x >= 19 && x <= 24 && y >= 3 && y <= 6;
				const OLD = Date.now() - 45 * 86400000; // 45 days ago → plants read fully grown, objects fully "matured"

				// Deterministic per (world, biome) so re-running rebuilds the same scene.
				const rng = seededRng(hash32(`populate:${wid}:${ar}`));
				const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
				const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

				const occupied = new Set<string>();
				(await byWorld(t.Chest, wid)).filter((c) => c.area === ar).forEach((c) => occupied.add(`${c.x},${c.y}`));
				const free = (x: number, y: number) =>
					x >= xMin && x <= xMax && y >= yMin && y <= yMax && !inCamp(x, y) && !occupied.has(`${x},${y}`);

				// ---- water: shovel out a lake (big blob) and a river (long channel) ----
				const waterCells: { x: number; y: number }[] = [];
				const carve = (x: number, y: number) => {
					if (free(x, y)) {
						occupied.add(`${x},${y}`);
						waterCells.push({ x, y });
					}
				};
				if (biome.canFlood !== false) {
					// lake: a rounded blob toward the left-center of the map
					const lx = ri(xMin + 1, Math.max(xMin + 1, Math.min(xMax - 4, xMin + 8)));
					const ly = ri(yMin + 1, Math.max(yMin + 1, Math.min(yMax - 3, yMin + 6)));
					for (let dy = 0; dy < 3; dy++)
						for (let dx = 0; dx < 4; dx++) {
							if ((dx === 0 || dx === 3) && (dy === 0 || dy === 2)) continue; // clip corners → rounder
							carve(lx + dx, ly + dy);
						}
					carve(lx + 1, ly - 1);
					carve(lx + 2, ly + 3); // organic edges
					// river: a channel winding downhill — one 4-connected step at a time
					// (mostly down, occasional bend) so it stays a single connected river.
					let rx = ri(Math.floor((xMin + xMax) / 2), xMax - 2),
						ry = yMin;
					carve(rx, ry);
					for (let i = 0, steps = ri(13, 18); i < steps && ry < yMax; i++) {
						if (rng() < 0.25 && rx > xMin + 1 && rx < xMax - 1)
							rx += rng() < 0.5 ? -1 : 1; // bend
						else ry += 1; // flow down
						carve(rx, ry);
						if (rng() < 0.25) carve(Math.min(xMax, rx + 1), ry); // gentle widening (adjacent)
					}
				}

				// ---- object pools, classified by how they want to be laid out ----
				const usable = d.objects.filter(
					(o: any) =>
						(o.biomes || []).includes(ar) &&
						o.placement !== 'indoor' &&
						o.placement !== 'none' &&
						!o.isChest &&
						!o.bridge,
				);
				if (!usable.length) throw new GameError(tr('server.err.noPlaceableObjects', { biome: biome.name }));
				const isPath = (o: any) => /-path$/.test(o.id) || o.id === 'wooden-fence' || o.id === 'dry-stone-wall';
				const trees = usable.filter((o: any) => o.plantable && (o.growSeconds || 0) >= 80);
				const flowers = usable.filter((o: any) => o.plantable && (o.growSeconds || 0) < 80);
				const NATURE = new Set([
					'shrub',
					'rock-pile',
					'hollow-log',
					'log-shelter',
					'brush-pile',
					'stone-cairn',
					'rock-cairn',
					'clover-patch',
					'butterfly-flowers',
					'pollinator-garden',
					'fallen-branch-shelter',
					'insect-hotel',
					'birdhouse',
					'bird-perch',
				]);
				const nature = usable.filter((o: any) => !o.plantable && !isPath(o) && NATURE.has(o.id));
				const paths = usable.filter(isPath);
				const decor = usable.filter((o: any) => !o.plantable && !isPath(o) && !NATURE.has(o.id));
				const undergrowth = nature.length ? nature : flowers; // fallback for biomes with no "nature" props

				const places: any[] = [];
				const place = (def: any, x: number, y: number) => {
					if (!def || !free(x, y)) return false;
					occupied.add(`${x},${y}`);
					const row: any = {
						id: `pl_dev_${ar}_${x}_${y}`,
						worldId: wid,
						playerId,
						objectId: def.id,
						area: ar,
						x,
						y,
						placedAt: OLD,
					};
					if (def.plantable) row.plantedAt = OLD; // reads fully grown, not a sprout
					places.push(row);
					return true;
				};
				// A tight cluster of one theme around an anchor — usually dominated by a
				// single species so it reads as a natural patch/grove, not a mix.
				const cluster = (pool: any[], cx: number, cy: number, count: number, radius: number) => {
					if (!pool.length) return;
					const dom = rng() < 0.65 ? pick(pool) : null;
					for (let n = 0, tries = 0; n < count && tries < count * 8; tries++) {
						const def = dom && rng() < 0.7 ? dom : pick(pool);
						if (place(def, cx + ri(-radius, radius), cy + ri(-radius, radius))) n++;
					}
				};

				// themed clusters scattered across the WHOLE map — groves, flower patches,
				// shrubby corners — so it never lines up in rows.
				for (let i = 0, anchors = ri(8, 12); i < anchors; i++) {
					const cx = ri(xMin, xMax),
						cy = ri(yMin, yMax);
					const roll = rng();
					if (roll < 0.4 && flowers.length) cluster(flowers, cx, cy, ri(4, 8), 2);
					else if (roll < 0.72 && trees.length) {
						cluster(trees, cx, cy, ri(2, 4), 2);
						cluster(undergrowth, cx, cy, ri(1, 3), 2);
					} else cluster(undergrowth, cx, cy, ri(3, 6), 2);
				}

				// a path run or two (and paths/fences are the one thing that looks right in a line)
				if (paths.length) {
					for (let i = 0, runs = ri(1, 2); i < runs; i++) {
						const def = pick(paths);
						const horiz = rng() < 0.5;
						const len = ri(4, 6);
						const sx = ri(xMin, Math.max(xMin, xMax - (horiz ? len : 0)));
						const sy = ri(yMin, Math.max(yMin, yMax - (horiz ? 0 : len)));
						for (let k = 0; k < len; k++) place(def, sx + (horiz ? k : 0), sy + (horiz ? 0 : k));
					}
				}

				// crafted accents dotted individually across the map (never clumped)
				for (let n = 0, tries = 0, want = ri(14, 20); decor.length && n < want && tries < want * 12; tries++) {
					if (place(pick(decor), ri(xMin, xMax), ri(yMin, yMax))) n++;
				}
				// top-up so every biome reads lush even if it has few plant/nature types
				for (let tries = 0; places.length < 34 && tries < 500; tries++) {
					place(pick(usable), ri(xMin, xMax), ri(yMin, yMax));
				}

				// commit water + placements
				for (const w of waterCells) {
					await t.TerrainTile.put({
						id: `${wid}:${ar}:${w.x}:${w.y}`,
						worldId: wid,
						playerId,
						area: ar,
						x: w.x,
						y: w.y,
						type: 'water',
						updatedAt: Date.now(),
					});
				}
				for (const row of places) await t.Placement.put(row);
				const waterTiles = waterCells.length;
				const placed = places.length;

				// welcome every animal home, then recalc and pin the showcase numbers
				const here = d.animals.filter((a: any) => a.biome === ar);
				const already = new Set(
					(await byWorld(t.Discovery, wid)).filter((x) => x.biomeId === ar).map((x) => x.animalId),
				);
				for (const animal of here) {
					if (already.has(animal.id)) continue;
					await t.Discovery.put({
						id: `${wid}:${animal.id}`,
						worldId: wid,
						playerId,
						animalId: animal.id,
						biomeId: ar,
						comfort: 90,
						timesObserved: 0,
						firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
				}
				await recalcBiome(wid, playerId, ar, { player });
				// recalc recomputes comfort/health from the habitat; force the picture-perfect
				// state so every animal is drawn (comfort high) and the meters read full.
				const bs = await findBiomeState(t.BiomeState, wid, ar);
				await t.BiomeState.patch(bs?.id ?? `${wid}:${ar}`, { health: 100, balance: 100, returnedCount: here.length });
				for (const disc of (await byWorld(t.Discovery, wid)).filter((x) => x.biomeId === ar)) {
					await t.Discovery.patch(disc.id, { comfort: 90 });
				}
				log.push(
					`Populated ${biome.name}: ${placed} objects, ${waterTiles} water tiles, ${here.length} animals home, health 100`,
				);
				break;
			}
			case 'set-weather': {
				// Force the weather and/or season for filming — a persistent override
				// on the player that the snapshot (and the client's live clock) honor.
				// `value: { type?, season? }` merges into the current override; a null/
				// empty value (or value.clear) lifts the override back to the live sky.
				const v = value && typeof value === 'object' ? value : null;
				if (!v || v.clear) {
					await t.Player.patch(playerId, { devWeather: null });
					log.push('Weather override cleared — back to the live sky');
					break;
				}
				const cur = player.devWeather || {};
				const next: any = { type: cur.type ?? null, season: cur.season ?? null };
				if ('type' in v) {
					if (v.type && !WEATHER_TYPES.includes(v.type))
						throw new GameError(tr('server.err.unknownWeatherType', { type: v.type }));
					next.type = v.type || null;
				}
				if ('season' in v) {
					if (v.season && !SEASONS.includes(v.season))
						throw new GameError(tr('server.err.unknownSeason', { season: v.season }));
					next.season = v.season || null;
				}
				await t.Player.patch(playerId, { devWeather: next });
				log.push(`Weather override: ${next.type || 'live'} · ${next.season || 'live'}`);
				break;
			}
			default:
				throw new GameError(tr('server.err.unknownDevAction', { action }));
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
		if (!message) throw new GameError(tr('server.err.feedbackEmpty'));
		if (message.length > FEEDBACK_MAX_CHARS)
			throw new GameError(tr('server.err.feedbackTooLong', { max: FEEDBACK_MAX_CHARS }));
		const replyTo =
			String(body.replyTo || '')
				.trim()
				.slice(0, 200) || null;
		if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new GameError(tr('server.err.feedbackBadEmail'));
		const metrics =
			body.metrics && typeof body.metrics === 'object' && !Array.isArray(body.metrics) ? body.metrics : {};
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
		const clientId = String(body.clientId || '')
			.trim()
			.slice(0, 64);
		if (!clientId) throw new GameError(tr('server.err.clientIdRequired'));
		const snapshot =
			body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot) ? body.snapshot : null;
		if (!snapshot) throw new GameError(tr('server.err.snapshotRequired'));
		// Store the metrics view as a JSON STRING, not a nested map: this table is
		// typed (positional structon encoding), which cannot safely hold a nested
		// object — a scalar string round-trips cleanly. Read back with JSON.parse
		// in the /Metrics/ dashboard.
		const snapshotJson = JSON.stringify(snapshot);
		if (snapshotJson.length > METRICS_SNAPSHOT_MAX_BYTES) throw new GameError(tr('server.err.snapshotTooLarge'));

		const t = db();
		const id = `solo:${clientId}`;
		const existing = await safeGet(t.SoloMetrics, id);
		await t.SoloMetrics.put({
			id,
			clientId,
			name: String(body.name || snapshot.name || '').slice(0, 40),
			platform: String(body.platform || '').slice(0, 20) || null, // desktop | web
			os: String(body.os || '').slice(0, 20) || null, // mac | windows | linux | …
			version: String(body.version || '').slice(0, 24) || null, // wild-willows release
			build: String(body.build || '').slice(0, 40) || null, // build timestamp
			language:
				String(body.language || snapshot.language || '')
					.trim()
					.toLowerCase()
					.slice(0, 12) || null, // interface language
			snapshot: snapshotJson,
			createdAt: existing?.createdAt || Date.now(),
			updatedAt: Date.now(),
		});
		dashboardCache = null; // new data landed — force the next dashboard read to rebuild
		return { ok: true };
	}
}

// ---------------------------------------------------------------- app-open funnel
// Acquisition tracking that does NOT need a save to exist: the client pings this
// the moment the app opens (phase "open") and again once a character is created
// (phase "created"). Rows are keyed per install/device, so /Metrics/ can report
// how many people opened the app, how many created a character (vs bounced), the
// average time spent in the creator, and how many characters each person makes.

/**
 * POST /AppOpen/ {deviceId, phase?, platform?, os?, version?, language?, creationMs?}
 *   phase "open"    — app launched (counted toward opens)
 *   phase "created" — a character was just created (marks the device converted,
 *                     bumps savesCreated, and records the creator time)
 * Upserts one row per device. Best-effort; safe to point analytics at.
 */
export class AppOpen extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const deviceId = String(body.deviceId || '')
			.trim()
			.slice(0, 64);
		if (!deviceId) throw new GameError(tr('server.err.deviceIdRequired'));
		const phase = body.phase === 'created' ? 'created' : body.phase === 'demo_done' ? 'demo_done' : 'open';
		const now = Date.now();
		const t = db();
		const id = `dev:${deviceId}`;
		const existing = await safeGet(t.AppOpen, id);
		const cms = clamp(Math.round(Number(body.creationMs) || 0), 0, 60 * 60_000);
		await t.AppOpen.put({
			id,
			deviceId,
			platform: String(body.platform || '').slice(0, 20) || existing?.platform || null,
			os: String(body.os || '').slice(0, 20) || existing?.os || null,
			version: String(body.version || '').slice(0, 24) || existing?.version || null,
			// demo | full — which product this install opened; 'demo' is sticky.
			edition:
				body.edition === 'demo' || existing?.edition === 'demo'
					? 'demo'
					: body.edition === 'full'
						? 'full'
						: existing?.edition || null,
			language:
				String(body.language || '')
					.trim()
					.toLowerCase()
					.slice(0, 12) ||
				existing?.language ||
				null,
			firstOpenAt: existing?.firstOpenAt || now,
			lastOpenAt: now,
			// Count real app launches; a "created" ping shouldn't inflate opens.
			opens: (existing?.opens || 0) + (phase === 'open' ? 1 : 0),
			converted: existing?.converted || phase === 'created',
			firstConvertedAt: existing?.firstConvertedAt || (phase === 'created' ? now : 0),
			// How many characters this person has created.
			savesCreated: (existing?.savesCreated || 0) + (phase === 'created' ? 1 : 0),
			// Keep the most recent creator time we've seen for this device.
			creationMs: phase === 'created' && cms > 0 ? cms : existing?.creationMs || 0,
			// Demo completion: reached the hard-stop (goal animals returned). Sticky,
			// so it survives the save being reset when the thank-you popup is dismissed.
			reachedDemoGoal: existing?.reachedDemoGoal || phase === 'demo_done',
			demoGoalAt: existing?.demoGoalAt || (phase === 'demo_done' ? now : 0),
			updatedAt: now,
		});
		dashboardCache = null; // acquisition numbers changed — rebuild the dashboard
		return { ok: true };
	}
}

// ---------------------------------------------------------------- landing page: mailing list + analytics
// The marketing landing page (GET /) hosts a mailing-list signup form and
// sends anonymous, aggregate-only usage pings. Same shape as the rest of this
// file:
//  • MailingListSignup rows carry emails (PII), so — exactly like Feedback —
//    the table is never exported and reads go through the admin-only
//    ListMailingList (raw Resource → Harper default super-user permissions).
//  • LandingStat keeps ONE row per UTC day (`day:YYYY-MM-DD`) of plain
//    counters; the public LandingStats rollup only ever returns those counts,
//    never emails. Increments are read-modify-write like AppOpen — fine at
//    landing-page traffic, and analytics losing the odd count to a rare race
//    is acceptable by design.

const MAIL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Click targets the landing page reports (data-track attributes). Anything
// else collapses into "other" so junk can't mint unbounded counter keys.
const LANDING_CLICK_TARGETS = new Set([
	'appstore',
	'itch',
	'demo',
	'theme',
	'privacy',
	'support',
	'get-nav',
	'gallery',
]);
const landingDay = (t: number) => new Date(t).toISOString().slice(0, 10); // UTC day

let landingStatsCache: { at: number; out: any } | null = null;
const LANDING_STATS_CACHE_MS = 15_000;

/** Apply one mutation to today's LandingStat row. Never throws — a metrics
 *  hiccup (table not deployed yet, decode error, …) must not break the caller. */
async function bumpLandingStat(mutate: (row: any) => void): Promise<void> {
	try {
		const table = (db() as any).LandingStat;
		if (!table) return; // schema table not created yet — drop the count, not the request
		const now = Date.now();
		const day = landingDay(now);
		const id = `day:${day}`;
		const row = (await safeGet(table, id)) || { id, day, visits: 0, uniques: 0, clicks: {}, signups: 0 };
		mutate(row);
		row.updatedAt = now;
		await table.put(row);
		landingStatsCache = null; // new numbers — next LandingStats read rebuilds
	} catch (e: any) {
		console.error('landing stat bump failed —', e?.message || e);
	}
}

/**
 * POST /JoinMailingList/ {email, source?, website?} — add one address to the
 * update list, deduped by normalized email (id `ml:${email}`), so double
 * submits and re-signups never create duplicate rows. `website` is the form's
 * honeypot field: it's visually hidden, so a non-empty value means a bot —
 * we answer ok:true and store nothing. The response is {ok:true} whether the
 * address was new or already present, so the endpoint can't be used to probe
 * who is subscribed.
 */
export class JoinMailingList extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		if (String(body.website || '').trim()) return { ok: true }; // honeypot — bot, drop silently
		const email = String(body.email || '')
			.trim()
			.toLowerCase()
			.slice(0, 254);
		if (!email || !MAIL_EMAIL_RE.test(email)) throw new GameError(tr('server.err.mailBadEmail'));
		const source =
			String(body.source || 'landing')
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '')
				.slice(0, 24) || 'landing';
		const table = (db() as any).MailingListSignup;
		if (!table) throw new GameError(tr('server.err.dbStarting'), 503);
		const id = `ml:${email}`;
		const existing = await safeGet(table, id);
		if (!existing) {
			await table.put({
				id,
				email,
				source,
				language:
					String(body.lang || body.language || '')
						.trim()
						.toLowerCase()
						.slice(0, 12) || null,
				createdAt: Date.now(),
			});
			await bumpLandingStat((r) => {
				r.signups = (r.signups || 0) + 1;
			});
		}
		return { ok: true };
	}
}

/**
 * GET /ListMailingList/ — every mailing-list signup, newest first.
 *
 * Deliberately extends the raw Resource (NOT PublicEndpoint), so Harper's
 * default permissions apply: only an authenticated super user can read it.
 * These rows are email addresses, which must never be public (same rule as
 * ListFeedback).
 */
export class ListMailingList extends Resource {
	async get() {
		const table = (db() as any).MailingListSignup;
		const rows: any[] = table ? await allOf(table) : [];
		rows.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
		return { count: rows.length, signups: rows };
	}
}

/**
 * POST /LandingEvent/ {type: "visit"|"click", target?, first?} — anonymous
 * landing-page beacon, aggregated straight into today's LandingStat row.
 *   visit — one per browser session (sessionStorage-guarded client-side);
 *           first:true additionally counts a first-ever visitor (localStorage).
 *   click — an outbound link tap; `target` must be a known data-track name or
 *           it lands in "other".
 * Always answers ok:true — analytics never gets to break the page.
 */
export class LandingEvent extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const type = body.type === 'click' ? 'click' : body.type === 'visit' ? 'visit' : null;
		if (!type) return { ok: true }; // unknown ping — accept and drop
		if (type === 'visit') {
			await bumpLandingStat((r) => {
				r.visits = (r.visits || 0) + 1;
				if (body.first === true) r.uniques = (r.uniques || 0) + 1;
			});
		} else {
			const raw = String(body.target || '')
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '')
				.slice(0, 24);
			const target = LANDING_CLICK_TARGETS.has(raw) ? raw : 'other';
			await bumpLandingStat((r) => {
				r.clicks = r.clicks && typeof r.clicks === 'object' && !Array.isArray(r.clicks) ? r.clicks : {};
				r.clicks[target] = (r.clicks[target] || 0) + 1;
			});
		}
		return { ok: true };
	}
}

/**
 * GET /LandingStats/ — public, aggregate-only rollup of the landing page's
 * daily counters, consumed by the /dashboard "Landing page" section. Returns
 * per-day rows (last 60 days) plus lifetime totals. The signup total is the
 * REAL deduped row count from MailingListSignup (the per-day counter is also
 * summed, but the table is the source of truth if they ever drift). No emails
 * or any other PII ever leave through this endpoint.
 */
export class LandingStats extends PublicEndpoint {
	async get() {
		const now = Date.now();
		if (landingStatsCache && now - landingStatsCache.at < LANDING_STATS_CACHE_MS) return landingStatsCache.out;
		const t = db() as any;
		let rows: any[] = [];
		try {
			rows = t.LandingStat ? await allOf(t.LandingStat) : [];
		} catch {
			rows = [];
		}
		rows = rows.filter((r: any) => r && r.day).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));
		const totals = { visits: 0, uniques: 0, signups: 0, clicks: {} as Record<string, number> };
		for (const r of rows) {
			totals.visits += r.visits || 0;
			totals.uniques += r.uniques || 0;
			totals.signups += r.signups || 0;
			for (const [k, v] of Object.entries(r.clicks || {}))
				totals.clicks[k] = (totals.clicks[k] || 0) + (Number(v) || 0);
		}
		let signupCount = totals.signups;
		try {
			if (t.MailingListSignup) signupCount = (await allOf(t.MailingListSignup)).length;
		} catch {
			/* keep the counter sum */
		}
		const days = rows.slice(-60).map((r: any) => ({
			day: r.day,
			visits: r.visits || 0,
			uniques: r.uniques || 0,
			signups: r.signups || 0,
			clicks: r.clicks || {},
			totalClicks: sumValues(r.clicks),
		}));
		const out = {
			generatedAt: now,
			today: landingDay(now),
			totals: { ...totals, signups: signupCount, totalClicks: sumValues(totals.clicks) },
			days,
		};
		landingStatsCache = { at: now, out };
		return out;
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

/**
 * GET /dashboard — the anonymous gameplay-metrics dashboard. A static,
 * self-contained page (inline CSS/JS, no external deps) that fetches the
 * public GET /Metrics/ rollup at runtime and renders it: audience, engagement,
 * funnels, progression, action totals, achievements, and the caretakers'
 * customized characters (drawn from appearance data — no player names shown).
 * Cached briefly like the other pages; the live numbers come from /Metrics/.
 */
class DashboardPage extends PublicEndpoint {
	async get() {
		return htmlPage(dashboardHtml);
	}
}

/**
 * GET / — the public marketing landing page (the face of wild.willows.harperfabric.com).
 * Self-contained, SEO-optimized static HTML with inlined screenshots, served at the
 * site root. Registered under the empty-string export name below, which Harper's
 * router resolves as the explicit root path.
 */
class LandingPage extends PublicEndpoint {
	async get() {
		return htmlPage(landingHtml);
	}
}

// The game's leaf mark, served as a real favicon so it shows in browser tabs and
// (crawled from /favicon.ico) in Google's search results. SVG scales to any size.
const FAVICON_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
	'<circle cx="12" cy="12" r="11" fill="#4a7c59"/>' +
	'<path d="M7 17C7 10.5 11 7.5 17 7.2c.3 6-2.7 10-10 9.8" fill="#d8eec2"/></svg>';

/** GET /favicon.ico · /favicon.svg — the site favicon (Harper strips the extension). */
class Favicon extends PublicEndpoint {
	async get() {
		return {
			status: 200,
			headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' },
			body: FAVICON_SVG,
		};
	}
}

/** GET /og-image.jpg — the social/OpenGraph preview image for the landing page. */
class OgImage extends PublicEndpoint {
	async get() {
		return {
			status: 200,
			headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' },
			body: nodeBuffer.from(ogImageB64, 'base64'),
		};
	}
}

/** GET /theme.mp3 — the game's main theme (Jon Licht), for the landing-page player.
 * The ~2 MB audio lives in its own module and is dynamic-imported so it never lands
 * in the web/desktop bundle (this endpoint only ever runs on the hosted Harper). */
class Theme extends PublicEndpoint {
	async get() {
		const { themeMp3B64 } = await import('./theme-audio');
		return {
			status: 200,
			headers: {
				'content-type': 'audio/mpeg',
				'cache-control': 'public, max-age=604800',
				'accept-ranges': 'none',
			},
			body: nodeBuffer.from(themeMp3B64, 'base64'),
		};
	}
}

// Export under the exact URL paths (string export names keep the hyphen; the empty
// name serves the site root, and Harper strips a trailing .ico/.jpg/.svg extension).
export {
	LandingPage as '',
	PrivacyPage as privacy,
	AgeRatingPage as 'age-rating',
	SupportPage as support,
	DashboardPage as dashboard,
	Favicon as favicon,
	OgImage as 'og-image',
	Theme as theme,
};

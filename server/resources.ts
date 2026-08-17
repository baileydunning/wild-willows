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
// Retired animal ids -> what replaced them. Deliberately NOT in config.yaml's
// dataLoader glob: it is a build-time lookup table for migrating SAVES, not a
// seed table, and has no business being a database table of its own.
import animalAliasData from '../data/animal-aliases.json';
import {
	weatherSnapshot,
	weatherTypeAt,
	gatherResourceIdFor,
	isWeatherGatheredResource,
	seasonAt,
	dayPhaseAt,
	phasesSeen,
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
import {
	privacyHtml,
	ageRatingHtml,
	supportHtml,
	dashboardHtml,
	landingHtml,
	teachersHtml,
	ogImageB64,
	buildStamp,
} from './pages';
import { pageLastmod } from './page-lastmod';

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
	if (!d || !d.Player) throw new GameError(tr('server.err.dbStarting'), 503, 'server.err.dbStarting');
	return d;
};

// ---------------------------------------------------------------- helpers

/**
 * A refusal the player is meant to see: "not enough stones", "that recipe is
 * still locked", "your house isn't big enough yet".
 *
 * `code` is the message's catalog key, not its text — the text is already
 * translated by the time it gets here, so counting it would split one problem
 * across every language. The key is stable and comparable.
 *
 * Counting happens in the constructor because that is the ONE place all 163
 * refusal sites pass through; a dispatch-layer hook would have to be added to
 * every endpoint class and would be forgotten by the next one. It is a side
 * effect in a constructor, which is usually a smell — the tradeoff is that a
 * refusal cannot be raised without being recorded, which is the property worth
 * having. noteRefusal never throws and never blocks.
 */
class GameError extends Error {
	statusCode: number;
	code: string;
	constructor(message: string, statusCode = 400, code = 'unknown') {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		void noteRefusal(code, statusCode);
	}
}

/**
 * Count a refusal by message key. Refusals were the biggest blind spot on the
 * dashboard: a mis-gated recipe could turn away every player who found it and
 * the only signal was somebody writing in. Activity counters can't show this —
 * they count what worked.
 *
 * Aggregated in memory and flushed on a timer rather than written per refusal: a
 * player jabbing at a locked recipe generates a burst, and this is bookkeeping,
 * not the job. Counts are per key only — no player ids, no message text.
 */
const refusalBuffer = new Map<string, { code: string; status: number; count: number; firstSeenAt: number }>();
let refusalFlushTimer: any = null;
const REFUSAL_FLUSH_MS = 15_000;

/** UTC day key, `YYYY-MM-DD`. The bucket label for the per-day counters below. */
const dayKeyUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/**
 * How many days of per-code history to keep. Bounded on purpose: `byDay` lives
 * inside the row, so without a cap a code seen every day would grow its own
 * record forever. Sixty days is the same window LandingStat keeps, and it is far
 * longer than anyone looks back at a refusal.
 */
const PROBLEM_HISTORY_DAYS = 60;

/**
 * Fold today's count into a row's per-day map and drop anything past the window.
 *
 * These tables were pure running totals — one row per code with a `count` that
 * only ever went up. That answers "has this ever happened" and nothing else: a
 * refusal code sitting at 380 could be 380 yesterday or 380 spread over two
 * months, and there was no way to tell which from the stored data. Any date
 * filter built on top could only ever sort rows by `lastSeenAt` while showing
 * all-time numbers beside them.
 *
 * Bucketing by day makes the question answerable. No backfill is possible — the
 * history that was never recorded cannot be recovered — so `byDay` starts empty
 * on existing rows and fills from the day this ships.
 */
function bumpDay(prev: Record<string, number> | undefined, at: number, by: number): Record<string, number> {
	const cutoff = dayKeyUTC(at - PROBLEM_HISTORY_DAYS * 86_400_000);
	const out: Record<string, number> = {};
	for (const [day, n] of Object.entries(prev || {})) {
		// String compare is safe and cheap on YYYY-MM-DD, which sorts lexically.
		if (day >= cutoff && Number.isFinite(Number(n))) out[day] = Number(n);
	}
	const today = dayKeyUTC(at);
	out[today] = (out[today] || 0) + by;
	return out;
}

async function flushRefusals(): Promise<void> {
	refusalFlushTimer = null;
	if (!refusalBuffer.size) return;
	const batch = [...refusalBuffer.values()];
	refusalBuffer.clear();
	try {
		const t = (db() as any).Refusal;
		if (!t) return;
		const now = Date.now();
		for (const r of batch) {
			const row = (await safeGet(t, r.code)) || {
				id: r.code,
				code: r.code,
				status: r.status,
				firstSeenAt: r.firstSeenAt,
				count: 0,
			};
			await t.put({
				...row,
				status: r.status,
				lastSeenAt: now,
				count: (row.count || 0) + r.count,
				byDay: bumpDay(row.byDay, now, r.count),
			});
		}
	} catch (e: any) {
		console.error('refusal flush failed —', e?.message || e);
	}
}

async function noteRefusal(code: string, status: number): Promise<void> {
	try {
		const cur = refusalBuffer.get(code);
		if (cur) cur.count++;
		else refusalBuffer.set(code, { code, status, count: 1, firstSeenAt: Date.now() });
		if (!refusalFlushTimer) {
			refusalFlushTimer = setTimeout(() => void flushRefusals(), REFUSAL_FLUSH_MS);
			// Don't hold the process open for a counter.
			refusalFlushTimer?.unref?.();
		}
	} catch {
		/* bookkeeping must never break the refusal it is counting */
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
	if (!Number.isInteger(v) || v <= 0)
		throw new GameError(tr('server.err.positiveWholeNumber', { label }), 400, 'server.err.positiveWholeNumber');
	return v;
}

function sumValues(obj: Record<string, number> | undefined): number {
	if (!obj) return 0;
	return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}

/** True for the Harper structured-encoder error raised on a record whose stored
 *  bytes can't be decoded under the current layout. */
function isDecodeError(e: any): boolean {
	return /end of buffer|buffer not reached|decod/i.test(String(e?.message || e));
}

// ------------------------------------------------ undecodable-record salvage
//
// Two facts about Harper drive everything below, both worth stating plainly
// because they are the opposite of what the call sites here used to assume.
//
// 1. Harper does NOT throw when a record fails to decode. RecordEncoder.decode
//    catches the error, logs `Error decoding record … data: <hex>`, and returns
//    **null** (harper/resources/RecordEncoder.ts). So from up here an unreadable
//    row is indistinguishable from an absent one. That is the damaging part: a
//    null read on a Player or World reads as "no such save", and callers respond
//    by re-creating or overwriting live state (see ensureSoloWorld).
//
// 2. The error we actually see —
//       "Data read, but end of buffer not reached"
//    — is thrown by msgpackr AFTER the value has decoded *completely*. It only
//    reports that unread bytes remain in the buffer (msgpackr/unpack.js: the
//    `position < srcEnd` branch, which even embeds a JSON preview of the fully
//    decoded result in the message). Nothing is lost; Harper just discards a
//    good value because of trailing framing bytes.
//
// So these records are recoverable. msgpackr's sequential decoder
// (`unpackMultiple`) is the same code path with that trailing-bytes assertion
// disabled, so we re-read the raw stored bytes, decode them leniently, and write
// the value back. The rewrite re-encodes from scratch, after which Harper's
// normal read path works again and the log noise stops. Healing happens lazily,
// on the first read that touches a bad row.

/** The underlying store behind a Harper table (`static primaryStore` on the
 *  generated table class). Absent in the in-renderer solo backend, where every
 *  function below degrades to a no-op and reads behave exactly as before. */
function storeOf(table: any): any {
	return table?.primaryStore ?? null;
}

/** Raw stored bytes for one record — metadata header already stripped — or null
 *  if the row genuinely does not exist. `valueAsBuffer` makes RecordEncoder
 *  return the payload slice instead of trying (and failing) to unpack it. */
function rawBytesOf(table: any, id: string): any {
	const store = storeOf(table);
	if (!store || typeof store.getSync !== 'function') return null;
	try {
		const buf = store.getSync(id, { valueAsBuffer: true });
		return buf && (buf.byteLength ?? buf.length ?? 0) > 0 ? buf : null;
	} catch {
		return null;
	}
}

/**
 * Does this row physically exist, whether or not Harper can decode it? Use this
 * wherever a missing record would otherwise trigger a create/overwrite: it is
 * the only way to tell "absent" from "unreadable", since Harper reports both as
 * null. Returns false on the solo backend (no store), which is correct there —
 * that path has no replicated records and so no undecodable ones.
 */
function existsRaw(table: any, id: string): boolean {
	return rawBytesOf(table, id) != null;
}

/** Decode stored bytes while tolerating trailing bytes. Returns a detached plain
 *  object, or null if the bytes are unreadable for some other reason. */
function lenientDecode(table: any, bytes: any): any | null {
	const enc = storeOf(table)?.encoder;
	if (!enc || typeof enc.unpackMultiple !== 'function') return null;
	const first = (vals: any) => {
		const v = Array.isArray(vals) ? vals[0] : undefined;
		// Reject arrays/primitives: a record is always an object, and accepting
		// anything else would let us overwrite a row with junk.
		return v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : null;
	};
	try {
		// unpackMultiple runs msgpackr in sequential mode, which is exactly the mode
		// that skips the "end of buffer not reached" assertion. The first value is our
		// record; anything after it is the trailing framing we want to drop.
		return first(enc.unpackMultiple(bytes));
	} catch (e: any) {
		// Trailing bytes usually aren't a whole extra msgpack value, so the sequential
		// reader normally decodes our record and THEN throws on the leftovers. It
		// hands back everything it managed to read on `error.values` — which includes
		// the fully intact record. Verified against msgpackr's unpack.js. Without
		// this branch the common case would salvage nothing.
		return first(e?.values);
	}
}

/**
 * Fields that must survive a salvage before we are willing to make it permanent.
 * A salvage that dropped `passcodeHash` would lock a player out of their own save
 * for good, so a suspicious result is left on disk unrewritten — still broken, but
 * still recoverable by hand. Tables absent from this map have no such field and
 * are rewritten whenever they decode.
 */
const SALVAGE_REQUIRED: Record<string, string[]> = {
	// A salvage that drops any of these has lost something the player cannot get
	// back, so we refuse to make it permanent: the row stays broken on disk and is
	// recoverable by hand, rather than silently rewritten as a worse save. A reset
	// home / emptied chest / re-damaged biome is the outcome we are buying our way
	// out of here — it reads to the player as "my game restarted itself".
	//
	// The check below is `rec[k] == null`, so legitimately falsy values survive:
	// an empty `contents` ({}), a fully damaged `health` (0) and an empty
	// `inventory` are all valid and pass. Don't tighten it to a truthiness test.
	Player: ['passcodeHash', 'passcodeSalt', 'inventory', 'tools', 'unlockedBiomes', 'home'],
	World: ['ownerId'],
	Chest: ['contents'],
	BiomeState: ['biomeId', 'health'],
	Discovery: ['animalId'],
	Placement: ['objectId', 'area', 'x', 'y'],
};

function tableName(table: any): string {
	return table?.name || table?.tableName || '';
}

/**
 * Recover an undecodable record and write it back cleanly. Returns the recovered
 * value, or null when the row is genuinely absent, truly unreadable, or salvaged
 * only partially. Safe to call on any miss: for an absent id it is a single point
 * read that finds nothing and returns immediately.
 */
/**
 * Record that a row could not be read. Salvage failures used to exist only as a
 * console.error on the server, so nobody knew how many saves were affected until
 * a player wrote in. One row per record, counted, so /dashboard can show it.
 * Never throws and never blocks the caller — this is bookkeeping, not the job.
 */
async function noteSaveIncident(table: string, recordId: string, kind: 'unreadable' | 'refused'): Promise<void> {
	try {
		const t = (db() as any).SaveIncident;
		if (!t) return;
		const id = `${table}:${recordId}`;
		const now = Date.now();
		const row = (await safeGet(t, id)) || { id, table, recordId, kind, firstSeenAt: now, count: 0 };
		await t.put({ ...row, kind, lastSeenAt: now, count: (row.count || 0) + 1 });
	} catch (e: any) {
		console.error('save incident note failed —', e?.message || e);
	}
}

async function salvageRecord(table: any, id: string): Promise<any | null> {
	const bytes = rawBytesOf(table, id);
	if (!bytes) return null; // genuinely absent — nothing to heal
	const name = tableName(table) || '?';
	const rec = lenientDecode(table, bytes);
	if (!rec) {
		console.error(`undecodable record left intact (no salvage): ${name}/${id}`);
		await noteSaveIncident(name, id, 'unreadable');
		return null;
	}
	// The payload must identify itself as the row we asked for. This is the gate that
	// separates a real salvage from garbage: msgpackr decodes unreadable bytes into
	// plausible-looking objects rather than failing (0xc1 becomes
	// `{ name: 'MessagePack 0xC1' }`, for instance), and writing one of those back
	// would destroy the record we were trying to rescue. Every table here stores `id`
	// in the value, so a mismatch means we did not recover this record — refuse.
	if (rec.id !== id) {
		console.error(`salvage refused, decoded payload is not record ${name}/${id} — left intact`);
		return null;
	}
	// Second gate, for rows where a lossy salvage would be unrecoverable: dropping
	// passcodeHash locks a player out of their own save permanently.
	const missing = (SALVAGE_REQUIRED[name] || []).filter((k) => rec[k] == null);
	if (missing.length) {
		console.error(`partial salvage refused, row left intact: ${name}/${id} — missing ${missing.join(', ')}`);
		await noteSaveIncident(name, id, 'refused');
		return null;
	}
	try {
		await table.put(rec); // re-encode from scratch → subsequent reads decode normally
		console.error(`salvaged undecodable record: ${name}/${id}`);
	} catch (e: any) {
		// Return the value anyway: the caller gets correct data for this request
		// even if the row stays broken on disk and heals on a later attempt.
		console.error(`salvage rewrite failed for ${name}/${id} —`, e?.message || e);
	}
	return rec;
}

/**
 * Remove a record whose stored bytes can't be decoded. A plain delete() also fails
 * because Harper decodes the record (for index cleanup) on the way out, so we first
 * OVERWRITE the slot with a valid minimal record (a full put writes fresh bytes and
 * doesn't read the old corrupt value), then delete that now-decodable record.
 *
 * NOT wired into any read path. On a Player row this destroys the save outright —
 * credentials included — and the errors we see in production are trailing-byte
 * framing on otherwise intact records, where deleting would throw away recoverable
 * data. Reads salvage instead (see salvageRecord); this stays for deliberate,
 * operator-initiated cleanup of a row that salvage has already declined.
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
 * Read one record by id, healing it if its stored bytes don't decode. Returns
 * null only when the row is really absent (or is damaged past recovery).
 *
 * Harper turns an undecodable record into a silent null, so a null from get() is
 * ambiguous and we have to check the raw bytes to disambiguate. When bytes are
 * there, salvageRecord decodes them leniently and rewrites the row, so the very
 * next read of that id goes through Harper's normal path — self-healing on touch.
 */
async function safeGet(table: any, id: string): Promise<any | null> {
	let rec: any = null;
	try {
		rec = await table.get(id);
		// Harper decodes lazily (on property access), so force a full read NOW to
		// surface a bad record here where we can heal it — not later mid-patch.
		if (rec) {
			try {
				JSON.stringify({ ...rec });
			} catch (e) {
				if (!isDecodeError(e)) throw e;
				rec = null;
			}
		}
	} catch (e) {
		if (!isDecodeError(e)) throw e;
		rec = null;
	}
	if (rec) return rec;
	// Null means EITHER absent OR undecodable — Harper reports both identically.
	// Only the latter has bytes on disk.
	return await salvageRecord(table, id);
}

async function toArray(iterable: any, label = '?'): Promise<any[]> {
	const out: any[] = [];
	let dropped = 0;
	// Fast path for the in-app solo backend, where LocalTable.search() hands back a
	// plain array rather than a cursor. `for await` over a sync iterable is legal
	// but not free: it wraps every element in a resolved promise and awaits it, so
	// a snapshot's six table reads cost one microtask turn PER ROW — thousands of
	// them on a built-out save, on the same thread that draws the frame. A sync
	// loop over an array we already hold is identical in behaviour (same null
	// handling, same drop accounting) and skips all of it.
	if (Array.isArray(iterable)) {
		for (const item of iterable) {
			if (item == null) {
				dropped++;
				continue;
			}
			out.push(item);
		}
		if (dropped) console.error(`scan of ${label}: ${dropped} undecodable record(s) omitted from results`);
		return out;
	}
	try {
		for await (const item of iterable) {
			// Harper yields null in place of a record it couldn't decode (it logs and
			// swallows the error rather than throwing). Those rows can't be healed from
			// here — a null carries no id — but they must be counted, because otherwise
			// a scan silently returns fewer rows than exist and the caller reads that as
			// "this world has no placements/chests/tiles". Reads by id do heal (safeGet).
			if (item == null) {
				dropped++;
				continue;
			}
			out.push(item);
		}
	} catch (e: any) {
		// An outright throw ends iteration — an async iterator can't resume past a bad
		// element — so keep what we read rather than failing the whole request.
		console.error(`scan of ${label}: aborted at an undecodable record —`, e?.message || e);
	}
	if (dropped) console.error(`scan of ${label}: ${dropped} undecodable record(s) omitted from results`);
	return out;
}

async function allOf(table: any): Promise<any[]> {
	if (!table || typeof table.search !== 'function') return [];
	return toArray(table.search({}), tableName(table));
}

/**
 * Reliable single-row lookup by id, for the tiny analytics tables that
 * read-modify-write a shared counter row (LandingStat, AppOpen).
 *
 * A primary-key `.get()` can return null for a row that genuinely exists on a
 * cold Harper instance — the same failure findOwned/byPlayer were rewritten to
 * dodge. For a per-player read that's a retryable miss; here it is destructive,
 * because the caller reads the null as "no row for today yet", starts from zero
 * and `put`s over the whole day's accumulated counts.
 *
 * So the ONLY answer that must never be trusted is a null. A non-null row is
 * already proof the read worked, and that is the common case on every request
 * after the first. This used to scan the whole table unconditionally, which made
 * the cost of the cold-start guard grow with the table: AppOpen is keyed
 * `dev:<deviceId>` — one row per install, forever, not "one row per day" — so
 * every single app-open ping was scanning every device ever seen. Reading by id
 * first and scanning only to disambiguate a null keeps the guarantee (a false
 * null still can't reset a counter, because the scan runs before we believe it)
 * and takes the scan off the hot path.
 *
 * safeGet already does its own salvage on an undecodable record; the scan is the
 * last resort behind both.
 */
async function findCounterRow(table: any, id: string): Promise<any | null> {
	if (!table || typeof table.search !== 'function') return null;
	const direct = await safeGet(table, id);
	if (direct) return direct;
	// Null: EITHER genuinely absent OR a cold-instance miss. Only a scan can tell
	// the two apart, and only the second one is dangerous.
	const rows = await toArray(table.search({}), tableName(table));
	return rows.find((r: any) => r?.id === id) || null;
}

/**
 * A short-TTL, single-flight cache for the analytics rollups.
 *
 * Both rollups (the /dashboard numbers and the landing-page counters) full-scan a
 * table and parse every row, and both were being INVALIDATED by the very writes
 * that make them expensive: every AppOpen ping nulled the dashboard cache, every
 * landing visit nulled the landing one. Under any traffic at all the TTL never got
 * a chance to fire, so N dashboard reads after a write cost N full scans — the
 * cache was load-bearing on paper and dead in practice.
 *
 * Two changes fix that, and neither costs the write path anything:
 *
 *  • A WRITE NO LONGER TRIGGERS A SCAN. invalidate() sets a flag and bumps a
 *    version counter. That's it. Rebuilding stays lazy — the next reader pays,
 *    and only if one shows up.
 *  • SINGLE FLIGHT ON READ. Readers arriving while a scan is running join it
 *    instead of each starting their own, so a burst of dashboard loads costs one
 *    scan rather than one per load.
 *
 * The version counter is what makes joining safe. A reader may only join a scan
 * that STARTED AFTER the most recent write — otherwise it could be handed a
 * rollup that predates a write already committed when the read arrived, and
 * read-your-own-write is a property this thing needs to keep (a player's own
 * uplink has to show on the dashboard, and metrics-uplink / metrics-extra assert
 * exactly that ordering). A reader that can't join queues a fresh scan behind the
 * running one instead. Worst case — a write landing between two concurrent reads
 * — is two serialized scans, which is still bounded and still better than the
 * scan-per-read this replaced.
 *
 * Deliberately NOT stale-while-revalidate. Serving the previous rollup while
 * refreshing would be faster still, but it's the same read-your-own-write
 * sacrifice. If /dashboard ever gets heavy enough for the wait to show up in the
 * p95, returning `this.value` from get() when one exists is the one-line change.
 *
 * RETENTION, which is a separate axis from staleness and used not to exist here.
 * `ttlMs` only decides when the held value stops being SERVED; it never decided
 * when it stops being HELD. So the dashboard rollup — one fully parsed metrics
 * snapshot per reporting save — sat in the heap of every worker forever after a
 * single page load, whether or not anyone ever looked again. That is the one
 * cache in this file whose size tracks the number of players, so it is the one
 * that turns "more saves" into an out-of-memory rather than a slow query.
 *
 * `retainMs` fixes that without touching the read path: a value nobody has read
 * for that long is dropped, and the next reader simply pays for a rebuild it was
 * going to pay for anyway (it was already past `ttlMs` and would have rebuilt).
 * Eviction is therefore FREE in served latency — it can only ever discard a
 * value that was already too stale to serve. The sweep runs off an unref'd
 * timer so it never holds the process open.
 */
class RollupCache<T> {
	private value: T | null = null;
	private at = 0;
	private stale = false;
	/** Bumped by every write. A scan is only reusable by readers at its version. */
	private version = 0;
	private inFlight: Promise<T> | null = null;
	private inFlightVersion = -1;
	/** Last time a reader actually took this value — drives idle eviction. */
	private readAt = 0;

	constructor(
		private readonly ttlMs: number,
		private readonly build: () => Promise<T>,
		/**
		 * Drop the held value after this long with no reads. Must be >= ttlMs or
		 * eviction would throw away values that are still servable; defaults to a
		 * generous multiple so a dashboard left open on a slow refresh never pays.
		 */
		private readonly retainMs = Math.max(ttlMs * 20, 5 * 60_000),
	) {
		// Unref'd so this timer is never the reason the process stays alive, and
		// guarded because the same class is bundled into the in-app solo backend,
		// where `setInterval` exists but `unref` does not.
		const timer: any = setInterval(() => this.evictIfIdle(), Math.max(this.retainMs, 60_000));
		if (typeof timer?.unref === 'function') timer.unref();
	}

	/** The underlying table changed. Cheap: no scan, no allocation, no await. */
	invalidate(): void {
		this.stale = true;
		this.version++;
	}

	/**
	 * Release the held value if nobody has read it recently. Only ever discards
	 * something that is already past its TTL, so no reader is made to wait that
	 * wasn't already going to.
	 */
	private evictIfIdle(): void {
		if (this.value === null || this.inFlight) return;
		const now = Date.now();
		if (now - this.readAt < this.retainMs) return;
		this.value = null;
		this.at = 0;
		this.stale = false;
	}

	async get(now: number): Promise<T> {
		if (this.value !== null && !this.stale && now - this.at < this.ttlMs) {
			this.readAt = now;
			return this.value;
		}
		this.readAt = now;
		return this.refresh();
	}

	private refresh(): Promise<T> {
		// Joinable only if it started after the last write — see the note above.
		if (this.inFlight && this.inFlightVersion === this.version) return this.inFlight;
		const startedAt = this.version;
		const prior = this.inFlight;
		const p = (async () => {
			// Never run two scans at once; queue behind whatever is already going.
			if (prior) await prior.catch(() => {});
			const v = await this.build();
			this.value = v;
			this.at = Date.now();
			// Only call it fresh if nothing was written while the scan ran. If
			// something was, this result may predate it and the next read rebuilds.
			if (this.version === startedAt) this.stale = false;
			return v;
		})();
		this.inFlight = p;
		this.inFlightVersion = startedAt;
		// Clear the slot however it settles, so a failed rebuild doesn't wedge the
		// cache into never trying again. Guarded on identity in case a later refresh
		// has already claimed the slot.
		p.finally(() => {
			if (this.inFlight === p) this.inFlight = null;
		}).catch(() => {});
		return p;
	}
}

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
// The key shapes (KEY_REV 3):
//
//   BiomeState        `${wid}:${biomeId}`
//   NodeState         `${wid}:${biomeId}:${nodeId}`
//   TerrainTile       `${wid}:${area}:${x}:${y}`
//   Discovery         `${wid}:${animalId}`
//   Placement         `${wid}:pl_${ts}_${rand}`   (was `pl_${ts}_${rand}`)
//   Chest             the same id as its Placement — an invariant, not a coincidence
//   FeedEntry         `${wid}:feed`               one row holding the whole feed
//                                                 (was one row per line, `f_${wid}_${at}_${rand}`)
//   PlayerAchievement `${playerId}:${achievementId}`
//
// `:` is a safe delimiter: a player id is `slugId(name)` (lowercase a-z0-9 and
// `-`) optionally plus `-${rand}`, and a world id is `w_${ts36}_${rand}`.
// Neither can contain a colon, so no world's key prefix can be a prefix of
// another world's key. (This is why the prefix is `${wid}:` and never `${wid}`.)
const KEY_REV = 3;

/** Tables whose ids carry a `${worldId}:` prefix under KEY_REV 3. */
const WORLD_KEYED = new Set(['BiomeState', 'NodeState', 'TerrainTile', 'Discovery', 'Placement', 'Chest', 'FeedEntry']);

/** Tables re-keyed by the KEY_REV 3 migration (see migrateWorldKeys). */
const REKEYED_TABLES = ['Placement', 'Chest', 'FeedEntry', 'BiomeState', 'NodeState', 'TerrainTile', 'Discovery'];

/**
 * Bounded scan of one contiguous primary-key run.
 *
 * Same decode tolerance as a full scan (toArray) — an undecodable row inside the
 * range is counted and skipped, never allowed to abort the read.
 */
async function scanPrefix(table: any, prefix: string): Promise<any[]> {
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
const keyedWorlds = new Set<string>();

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
function rememberKeyed(set: Set<string>, key: string): void {
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
 * that last played in a pre-0.3 co-op world still carries a `w_…` worldId, and
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
function noteKeyedWorlds(player: any): void {
	if ((player?.keyRev || 0) >= KEY_REV && player?.id) rememberKeyed(keyedWorlds, player.id);
	for (const [wid, rev] of Object.entries(player?.keyRevs || {})) if ((rev as number) >= KEY_REV) rememberKeyed(keyedWorlds, wid);
}

async function worldIsKeyed(worldId: string, playerId?: string): Promise<boolean> {
	if (!worldId) return false;
	if (keyedWorlds.has(worldId)) return true;
	if ((await keyRevOf(worldId, playerId)) >= KEY_REV) {
		rememberKeyed(keyedWorlds, worldId);
		return true;
	}
	return false;
}

/**
 * Re-key one world's rows into the KEY_REV 3 contract, once, then mark the save
 * so it never happens again.
 *
 * The new id is simply `${wid}:${oldId}`. Old ids were already globally unique,
 * so the mapping is deterministic and collision-free, it needs no per-table
 * logic, and it preserves the Chest-id-equals-Placement-id invariant for free
 * (both rows carry the same old id, so both get the same new one).
 *
 * This is the ONLY full scan left on the per-world path, it runs at most once
 * per world, and it runs from write paths only (login and heartbeat) — never
 * from a GET handler, which must not write.
 */
async function migrateWorldKeys(worldId: string, playerId?: string): Promise<void> {
	if (!worldId || keyedWorlds.has(worldId)) return;
	const t = db();
	const owner = playerId || worldId;
	if ((await keyRevOf(worldId, owner)) >= KEY_REV) {
		rememberKeyed(keyedWorlds, worldId);
		return;
	}
	const prefix = `${worldId}:`;
	try {
		for (const name of REKEYED_TABLES) {
			const table = t[name];
			if (!table || typeof table.search !== 'function') continue;
			const stale = (await toArray(table.search({}), name)).filter(
				(r: any) => (r?.worldId ?? r?.playerId) === worldId && !String(r?.id ?? '').startsWith(prefix),
			);
			for (const row of stale) {
				const oldId = String(row.id);
				// Write the new row before removing the old one: a crash between the
				// two leaves a duplicate (which byWorld dedupes by id) rather than a
				// hole. Losing a placement is unrecoverable; seeing one twice is not.
				await table.put({ ...row, id: `${prefix}${oldId}`, worldId });
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
async function byPlayer(table: any, playerId: string, opts: { player?: any } = {}): Promise<any[]> {
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
async function byWorld(table: any, worldId: string): Promise<any[]> {
	if (!table || typeof table.search !== 'function' || !worldId) return [];
	const name = tableName(table);
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

/** Single record by id, scoped to one world. */
async function findInWorld(table: any, worldId: string, id: string): Promise<any | null> {
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
async function findTerrainAt(table: any, worldId: string, area: string, x: number, y: number): Promise<any | null> {
	// The current id IS the position, so try it directly before scanning. A hit
	// here turns the most frequent lookup in the game (every dig, plant, place and
	// terraform does at least one) into a single point read.
	const direct = await safeGet(table, `${worldId}:${area}:${x}:${y}`);
	if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.area === area && r.x === x && r.y === y) || null;
}

/**
 * Find a world's BiomeState / Discovery row by its natural key (biomeId /
 * animalId) rather than a reconstructed `${worldId}:${key}` id — same legacy-id
 * safeguard as findTerrainAt. Callers patch the row's real `.id`.
 */
async function findBiomeState(table: any, worldId: string, biomeId: string): Promise<any | null> {
	const direct = await safeGet(table, `${worldId}:${biomeId}`);
	if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.biomeId === biomeId) || null;
}
async function findDiscovery(table: any, worldId: string, animalId: string): Promise<any | null> {
	const direct = await safeGet(table, `${worldId}:${animalId}`);
	if (direct && (direct.worldId ?? direct.playerId) === worldId) return direct;
	const rows = await byWorld(table, worldId);
	return rows.find((r: any) => r.animalId === animalId) || null;
}

/**
 * Per-save setup on login and character creation. Idempotent.
 *
 * Named for the co-op era, when it built a "world of one" and a membership row.
 * Both are gone; what remains is the `worldId` compat field and the key-contract
 * migration. Kept under the old name because every login path calls it — renaming
 * it belongs with the Phase 4 cleanup, not here.
 */
async function ensureSoloWorld(player: any, opts: { freshGrid?: boolean } = {}): Promise<void> {
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

	// ---- Discovery rows. World-owned, so this covers every member of a co-op world.
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
 * these reads: the marker is an optimisation for the heartbeat path, not a
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
const REPAIR_REV = 3;

async function repairSave(
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
		await repairGateTrails(worldId, d);
		await migrateFieldJournal(playerId, d, opts.player);
		// Any of those three changes which animals count as home, and
		// BiomeState.returnedCount is a stored number that only recalcBiome
		// recomputes. Left alone the HUD reads "24 of 25 animals returned" for a
		// preserve with nine, and that same count feeds the biome unlock gates and
		// the `*-reborn` achievement triggers. Only pay for it when something
		// actually moved: an already-clean save (which is every save after the
		// first pass, and every save created from 0.3 on) does no extra work.
		if (renamed || dropped || refiled) await recalcRepairedBiomes(worldId, playerId, d);
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
async function recalcRepairedBiomes(worldId: string, playerId: string, d: any): Promise<void> {
	const t = db();
	const states = await byWorld(t.BiomeState, worldId);
	const open = states.filter((b: any) => b.unlocked && d.biome.get(b.biomeId)).map((b: any) => b.biomeId);
	const newAnimals: any[] = [];
	const freshBiomeStates: any[] = [];
	for (const biomeId of open) {
		const r = await recalcBiome(worldId, playerId, biomeId);
		newAnimals.push(...(r.newAnimals || []));
		if (r.biomeState) freshBiomeStates.push(r.biomeState);
	}
	if (newAnimals.length || freshBiomeStates.length)
		await awardWorldAchievements(worldId, playerId, { addDiscoveries: newAnimals, freshBiomeStates });
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
async function defs() {
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

// ------------------------------------------------------------- constants

const NODE_REGEN_SECONDS = 75;
const BASE_HEALTH = 5;
// The grasshopper is always the first animal to return anywhere — the meadow's
// first sign of life — and every other animal is gated behind it (see recalcBiome).
const FIRST_ANIMAL_ID = 'grasshopper';
// How many activity-feed messages we keep per player (the feed is pruned to this
// on every append so the table never grows unbounded as people play).
const FEED_CAP = 100;

// ------------------------------------------------------------- activity feed
//
// The feed is ONE row per world (`${wid}:feed`) holding an array, not one row
// per line.
//
// It used to be a row per line, and that made it the most expensive thing in the
// game per unit of value. Every flush wrote a row per entry, and then pruned to
// the cap — so once a world had been played for a while, each line cost a put
// AND a delete. A capped, append-only log that is only ever read whole has no
// use for per-row addressability; it was paying for random access nobody used.
// As a single row it is one write per flush no matter how many lines it carries,
// and pruning is a slice() rather than a stream of deletes.
const feedRowId = (worldId: string) => `${worldId}:feed`;

/**
 * The world's feed, oldest→newest. Falls back to the pre-KEY_REV-3 per-line rows
 * for a world that has not been collapsed yet, so an un-migrated save shows its
 * history rather than an empty panel.
 */
async function readFeed(worldId: string): Promise<any[]> {
	const t = db();
	const row = await safeGet(t.FeedEntry, feedRowId(worldId));
	const entries = Array.isArray(row?.entries) ? row.entries : [];
	if (await worldIsKeyed(worldId)) return entries;
	const legacy = (await byWorld(t.FeedEntry, worldId)).filter((r: any) => r?.id !== feedRowId(worldId));
	if (!legacy.length) return entries;
	return [...entries, ...legacy].sort((a: any, b: any) => (a.at || 0) - (b.at || 0)).slice(-FEED_CAP);
}

/** Replace the world's feed with `entries`, newest kept, capped. One write. */
async function writeFeed(worldId: string, entries: any[]): Promise<void> {
	await db().FeedEntry.put({
		id: feedRowId(worldId),
		worldId,
		// solo worlds are keyed by the player's id, and several reset/delete paths
		// still find rows via byPlayer — keep them working by carrying it through.
		playerId: worldId,
		entries: entries.slice(-FEED_CAP),
		updatedAt: Date.now(),
	});
}

/** Append lines to a world's feed. One write regardless of how many. */
async function appendFeed(worldId: string, lines: any[]): Promise<number> {
	const clean = lines
		.map((e: any) => ({
			id: `f_${Number(e?.at) || Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			at: Number(e?.at) || Date.now(),
			icon: String(e?.icon || 'leaf').slice(0, 40),
			text: String(e?.text || '')
				.slice(0, 500)
				.trim(),
		}))
		.filter((e) => e.text);
	if (!clean.length) return 0;
	const next = [...(await readFeed(worldId)), ...clean].sort((a, b) => (a.at || 0) - (b.at || 0));
	await writeFeed(worldId, next);
	return clean.length;
}

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

// ------------------------------------------------------- sleeping furniture
// The two things you can sleep on. Sleeping skips the clock to the next dawn, so
// a bed parked in the doorway is a trap: every attempt to leave lands on it.
// Keep them clear of the exit. The client mirrors this rule so the placement
// ghost turns red (see canPlaceAt in src/game/WorldScene.ts), but this is the
// copy that counts — the frontend is never trusted.
const SLEEPABLE_OBJECTS = new Set(['home-bed', 'home-sleeping-bag']);

/** The door tile of an interior: bottom wall, horizontally centred. Must match
 *  `roomSpec()` in the client, which derives it from the same rectangle. */
function doorTileOf(room: { x0: number; y0: number; x1: number; y1: number }): { x: number; y: number } {
	return { x: Math.round((room.x0 + room.x1) / 2), y: room.y1 };
}

/**
 * True if a bed at (tx, ty) would sit on, or in the ring immediately around, the
 * doorway. Chebyshev distance ≤ 1, so the door tile and its eight neighbours are
 * all refused — enough to always leave a clear step in and out.
 */
function blocksDoorway(
	objectId: string,
	room: { x0: number; y0: number; x1: number; y1: number },
	tx: number,
	ty: number,
): boolean {
	if (!SLEEPABLE_OBJECTS.has(objectId)) return false;
	const door = doorTileOf(room);
	return Math.abs(tx - door.x) <= 1 && Math.abs(ty - door.y) <= 1;
}
// Chance that digging a fresh soil bed turns up a buried material (not every dig).
const DIG_FIND_CHANCE = 0.75;
const CAPACITY_BY_BASKET: Record<number, number> = { 1: 200, 2: 350, 3: 550, 4: 800 };

// New caretakers start empty-handed — the first task is to gather seeds and
// fiber for a Grass Patch, so the tutorial's opening loop has real stakes.
// No starting seeds — the very first goal is "gather 10 seeds", so a fresh
// basket should read 0/10, not 2/10. (A little water lets you tend a bed right
// away for the tutorial.)
const START_INVENTORY: Record<string, number> = { water: 6, wildflowers: 1 };
const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1 };

// ------------------------------------------------------------- field guides
//
// Each AREA has a guide, rather than the preserve sharing one ladder, and each
// guide is written up in two steps:
//
//   1  pocket notes    names, sketches, and a caretaker's hint
//   2  field guide     opens each animal's full page — role, food web, when
//                      they're about, the habitat they keep
//   3  expanded guide  spells out exactly what each animal is waiting for, in
//                      the journal and on the goals the player sets
//
// GUIDE_MAX is the top rung; the naturalist badge and the legacy migration both
// mean "written all the way up" and neither should hardcode a number.
// Tools default to 1 when absent, so nothing has to be seeded.
const guideTool = (biome: string) => `journal-${biome}`;
const GUIDE_MAX = 3;
/** The pre-split tool: ONE journal whose tier N covered every area of order < N. */
const LEGACY_JOURNAL_TOOL = 'field-journal';

const guideLevel = (player: any, biome: string) => (player?.tools?.[guideTool(biome)] as number) || 1;
/** Can this save read the full animal pages for `biome`? */
const hasGuide = (player: any, biome: string) => guideLevel(player, biome) >= 2;
/** …and the exact "what it's waiting for" requirements? */
const hasExpandedGuide = (player: any, biome: string) => guideLevel(player, biome) >= GUIDE_MAX;

// Character appearance options (validated server-side; the frontend renders these)
// Preset swatches the creator offers as quick-picks. Colors are no longer
// restricted to this list — players can pick any color — so these are just
// suggestions surfaced in the UI.
// The creator falls back to these when a saved value is missing or malformed.
// Named rather than indexed so the swatch lists below can be reordered freely.
const DEFAULT_SKIN = '#eec39a';
const DEFAULT_HAIR = '#6e4a33';
const DEFAULT_OUTFIT = '#4a7c59';
const SKIN_TONES = [
	'#fbe8d5',
	'#f6d7b8',
	'#f0cba6',
	'#eec39a',
	'#dcae7f',
	'#d9a06b',
	'#cf9662',
	'#c98f5e',
	'#b97f50',
	'#ad7248',
	'#a66b45',
	'#96603d',
	'#8d5a3a',
	'#7a4a30',
	'#6b4226',
	'#5a3720',
	'#4e2f1e',
];
const HAIR_COLORS = [
	'#1c1614',
	'#2b2320',
	'#3b2e25',
	'#4a3b30',
	'#5c4636',
	'#6e4a33',
	'#7d5439',
	'#8a5f3d',
	'#a3692f',
	'#b5502e',
	'#c2632f',
	'#c9913f',
	'#d4a44f',
	'#d9b380',
	'#e8dcc0',
	'#8c8c8c',
	'#c9c9c9',
];
const OUTFIT_COLORS = [
	'#3f6b4c',
	'#4a7c59',
	'#5f9166',
	'#8a9a5b',
	'#4f9a94',
	'#7a9ac0',
	'#5a6b8c',
	'#3f5f80',
	'#7d6b9e',
	'#9b6bb0',
	'#a8586b',
	'#b5707a',
	'#c4653f',
	'#d4783f',
	'#c9913f',
	'#d4a373',
	'#6b7280',
];
const HAT_STYLES = [
	// 'none' leads the list because it's the default a new character starts with
	'none',
	'straw',
	'leaf',
	'beanie',
	'cap',
	'visor',
	'bucket',
	'flower',
	'party',
	'acorn',
	'beret',
	'ranger',
	'mushroom',
	'wizard',
	'witch',
	'crown',
	'bandana',
	'tophat',
	'newspaper',
	'chef',
	'pirate',
	'frog',
	'cat-ears',
	'headphones',
	'halo',
];
// Suggested hat tints (any hex is accepted); null/absent hatColor = the hat's classic colors.
const HAT_COLORS = [
	'#c9a35c',
	'#8a734f',
	'#5d4a36',
	'#b05555',
	'#e8734f',
	'#b5707a',
	'#d77bb1',
	'#a8586b',
	'#7d6b9e',
	'#5f86b0',
	'#4f9a94',
	'#5d8a4a',
	'#6aa84f',
	'#e0b23e',
	'#f2efe6',
	'#8c8c8c',
	'#3f3b47',
];
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
	'wavy',
	'spiky',
	'dreads',
	'space-buns',
	'bowl',
	'double-braid',
	'half-up',
	'pixie',
	'cornrows',
	'shag',
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
		skin: cleanHex(a.skin, DEFAULT_SKIN),
		hair: cleanHex(a.hair, DEFAULT_HAIR),
		outfit: cleanHex(a.outfit, DEFAULT_OUTFIT),
		hat: HAT_STYLES.includes(a.hat) ? a.hat : 'none',
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
		await patchPlayer(player.id, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
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

// ------------------------------------------------------------ player setup

/** Load an existing player or fail — creation only happens via /CreatePlayer/. */
/**
 * Serialise everything that touches one player's row.
 *
 * Every mutating endpoint here is read-modify-write: read the player, compute the
 * new inventory / craftedItems / tools, patch it back. Two requests for the same
 * player interleave freely, so both read the same baseline and the second patch
 * lands on top of the first. On a craft that costs the player either the item or
 * the materials, depending which write wins — and with materials for one craft, a
 * double-click passed BOTH availability checks and made two.
 *
 * The window is exactly as wide as one round trip, which is why an impatient
 * double-click on a slow connection was enough to hit it.
 *
 * A queue per player, not a global one: unrelated players never wait on each
 * other. The promise stored in the map always resolves (the release runs in a
 * finally), so one failed request can't wedge the queue behind it.
 */
const playerLocks = new Map<string, Promise<void>>();

// ------------------------------------------------- coalesced player writes
//
// One gameplay action used to write the Player row two or three times: once for
// the state change (inventory, tools, craftedItems), once for bumpMetrics'
// counters, and sometimes again for achievements. Same row, same request, and on
// Harper every one of those is a separate billable write. On the free tier the
// 1,000 writes/minute allowance is what caps how many people can play at once,
// so the duplicates were coming straight out of the concurrency budget.
//
// While a player is inside withPlayerLock, patches to their row accumulate here
// and are written ONCE when the lock releases. Outside a lock (Heartbeat and the
// login/admin paths do not take one) patchPlayer writes through immediately, so
// a buffered patch can never be left unflushed by a path that does not know
// about the buffer.
//
// Reads have to see the buffer or the coalescing would be observable: bumpMetrics
// deliberately re-reads the freshest row before merging counters, and snapshot()
// builds its response from the row mid-action. getPlayer() overlays the pending
// patch, so every reader sees the row as this request has left it.
const pendingPlayerPatch = new Map<string, any>();
const bufferingPlayers = new Set<string>();

/** Patch the player row — buffered inside a lock, written through outside one. */
async function patchPlayer(playerId: string, partial: any): Promise<void> {
	if (!playerId || !partial) return;
	if (!bufferingPlayers.has(playerId)) {
		await db().Player.patch(playerId, partial); // the real write — never patchPlayer, that is this function
		return;
	}
	const cur = pendingPlayerPatch.get(playerId);
	// Shallow merge, exactly like a sequence of Harper patches: last write wins
	// per key, so collapsing them changes the number of writes and nothing else.
	pendingPlayerPatch.set(playerId, cur ? { ...cur, ...partial } : { ...partial });
}

/** The player row as this request has left it: stored row plus anything pending. */
async function getPlayer(playerId: string): Promise<any | null> {
	const stored = await safeGet(db().Player, playerId);
	const pending = pendingPlayerPatch.get(playerId);
	if (!pending) return stored;
	return { ...(stored || { id: playerId }), ...pending };
}

async function flushPlayerPatch(playerId: string): Promise<void> {
	const pending = pendingPlayerPatch.get(playerId);
	pendingPlayerPatch.delete(playerId);
	if (pending) await db().Player.patch(playerId, pending); // the real write
}

async function withPlayerLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
	const ahead = playerLocks.get(playerId);
	let release!: () => void;
	const mine = new Promise<void>((r) => (release = r));
	playerLocks.set(playerId, mine);
	if (ahead) await ahead;
	bufferingPlayers.add(playerId);
	try {
		return await fn();
	} finally {
		// Flush BEFORE releasing, so the next request in the chain reads a row that
		// already includes this one's writes. On the error path we still flush: the
		// un-coalesced code had already written each patch by the time it threw, and
		// collapsing writes must not also change what survives a failure.
		bufferingPlayers.delete(playerId);
		try {
			await flushPlayerPatch(playerId);
		} catch (e: any) {
			console.error(`flushing player writes for ${playerId} failed —`, e?.message || e);
		}
		release();
		// Only the last one out clears the slot, or a queued request would be
		// dropped from the chain and start racing again.
		if (playerLocks.get(playerId) === mine) playerLocks.delete(playerId);
	}
}

async function requirePlayer(playerId: string): Promise<any> {
	if (!playerId || typeof playerId !== 'string')
		throw new GameError(tr('server.err.playerIdRequired'), 400, 'server.err.playerIdRequired');
	const player = await getPlayer(playerId);
	if (!player) throw new GameError(tr('server.err.noSaveLogin'), 404, 'server.err.noSaveLogin');
	noteKeyedWorlds(player);
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
		// Dwell time per MENU (seconds) and how often each was opened, reported by
		// the client on the heartbeat (which panel is open is client state — the
		// server cannot see it). Menu time OVERLAPS areaSeconds rather than being
		// carved out of it, so areaSeconds keeps exactly the meaning it had before
		// this existed and old rows stay comparable with new ones.
		menuSeconds: {} as Record<string, number>,
		menuOpens: {} as Record<string, number>,
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
// Counters that are NOT actions of their own: cosmetic fiddling, and tallies
// kept alongside an action that already counts (bedsWatered rides on a terraform
// action, gathered:<id> rides on resourcesCollected). Excluded from totalActions
// so the dashboard's per-player action count keeps meaning the same thing it did
// before each one was added.
const META_COUNTERS = new Set(['recolors', 'appearanceChanges', 'bedsWatered', 'goalsCreated']);
/** Per-resource lifetime gather tallies — one key per resource, all meta. */
const META_COUNTER_PREFIX = 'gathered:';
const isMetaCounter = (key: string) => META_COUNTERS.has(key) || key.startsWith(META_COUNTER_PREFIX);

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
	// placement bump plus recalcBiome's health/animal bump) from stale copies.
	// safeGet so an undecodable row heals here instead of silently falling back
	// to the stale in-memory copy and writing its older counters back over the top.
	const live = (await getPlayer(player.id)) || player;
	const prev = readMetrics(live) || freshMetrics(live.createdAt || now);
	const counts = { ...(prev.counts || {}) };
	for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
	const metrics = { ...prev, counts, lastSeenAt: now };
	// Stamp the first real gameplay action (cosmetic fiddling doesn't count), so
	// the dashboard can measure onboarding friction (create → first action).
	if (!prev.firstActionAt && entries.some(([k, v]) => v && !isMetaCounter(k))) {
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
	await patchPlayer(player.id, patch);
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
	const totalActions = Object.entries(counts).reduce((a, [k, b]) => a + (isMetaCounter(k) ? 0 : b || 0), 0);
	const createdAt = player.createdAt || m.firstSeenAt || now;
	const lastSeenAt = m.lastSeenAt || null;

	// Dwell time per area, plus the area they've spent the most time in.
	const areaSeconds: Record<string, number> = m.areaSeconds || {};
	const areaMinutes: Record<string, number> = {};
	for (const [a, s] of Object.entries(areaSeconds)) areaMinutes[a] = Math.round((s || 0) / 60);
	const mostTimeArea = Object.entries(areaSeconds).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
	// Time in menus, and how often each was opened. Reported by the client on the
	// heartbeat; overlaps areaSeconds rather than being subtracted from it, so
	// `menuShareOfPlay` is a share of play time and NOT one minus time-in-world.
	// Saves recorded before this shipped simply have empty maps — read a 0% share
	// on an old row as "not measured", which is what `menuMeasured` is for.
	const menuSeconds: Record<string, number> = m.menuSeconds || {};
	const menuOpens: Record<string, number> = m.menuOpens || {};
	const menuMinutes: Record<string, number> = {};
	for (const [k, sec] of Object.entries(menuSeconds)) menuMinutes[k] = Math.round((sec || 0) / 60);
	const menuTotalSeconds = Object.values(menuSeconds).reduce((a, b) => a + (b || 0), 0);
	const menuTotalOpens = Object.values(menuOpens).reduce((a, b) => a + (b || 0), 0);
	const mostUsedMenu = Object.entries(menuSeconds).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || null;
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
		// time-per-menu (overlaps the above — see the note where these are read)
		menuSeconds,
		menuMinutes,
		menuOpens,
		menuTotalSeconds: Math.round(menuTotalSeconds),
		menuTotalMinutes: Math.round(menuTotalSeconds / 60),
		menuTotalOpens,
		mostUsedMenu,
		menuShareOfPlay: playSeconds > 0 ? round1((menuTotalSeconds / playSeconds) * 100) : null,
		// False on a save that has never reported menu time — either it predates
		// this metric or it has only ever beaten from an old client. Without it a
		// dashboard cannot tell "never opened a menu" from "never measured".
		menuMeasured: menuTotalSeconds > 0 || menuTotalOpens > 0,
		// session-length distribution (finished sessions bucketed)
		sessionLengths: m.sessionLengths || {},
		// The in-progress session's accrued seconds. Surfaced because "in progress"
		// is only true until the player closes the game — after that this IS the
		// length of a finished session, and the heartbeat will never bucket it
		// (bucketing happens when the NEXT session starts, which for someone who
		// doesn't come back is never). The roll-up reads it together with lastSeenAt
		// to count abandoned sessions instead of losing them.
		curSessionSeconds: Math.round(m.curSessionSeconds || 0),
		// onboarding
		timeToFirstActionSeconds,
		// character creation: how long it took + the customization they chose
		creationMs,
		creationSeconds: creationMs ? round1(creationMs / 1000) : null,
		appearance: player.appearance || null,
		counts,
		// Onboarding: how far into the ten-goal starter chain this save got, and
		// whether it went on to author goals of its own. Rides on the snapshot, so
		// the solo/demo uplink reports it exactly like the hosted game does.
		...starterChainMetrics(player),
		// Demo → full carry-over. Stamped by ExportDemoSave onto the copy the player
		// downloads, so a save that was bought and imported can say so about itself
		// for the rest of its life. Null on saves that started in the full game (and
		// on demo saves that have not been exported yet).
		convertedFromDemoAt: m.convertedFromDemoAt || null,
		// What they had done in the demo at the moment they carried it over — the
		// interesting half of the milestone. Frozen at export; the live counters keep
		// climbing past these.
		demoPlaySeconds: m.demoPlaySeconds ?? null,
		demoSessions: m.demoSessions ?? null,
		demoActions: m.demoActions ?? null,
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

/**
 * Where an area's trail gates sit, mirroring `dimsOf()` in the client's
 * WorldScene: the gates are one tile in from each side, on the middle row of
 * the playable band. The first biome has no gate west, the last none east.
 */
function gateGeomOf(d: any, area: string): { gateY: number; landRight: number; westGate: boolean; eastGate: boolean } {
	const biome = d.biome.get(area);
	const g = biome?.grid;
	const cols = g?.cols || GRID_W;
	const baseRows = g?.rows || GRID_H;
	const playTop = area === 'alpine' ? ALPINE_MTN_ROWS : 0;
	const order = biome?.order || 1;
	const last = Math.max(...d.biomes.map((b: any) => b.order || 1));
	return {
		gateY: playTop + baseRows / 2 - 0.2,
		landRight: biome?.oceanCols ? cols - biome.oceanCols : cols,
		westGate: order > 1,
		eastGate: order < last,
	};
}

/**
 * True if flooding (tx, ty) would wall off a trail gate. Open water blocks
 * walking, so a channel across the mouth of a gate locks the player out of the
 * next biome — you cannot stand next to the gate to use it. The gate tile, one
 * row either side of it and the two columns in from that edge are all refused.
 * Tilled and watered beds are walkable, so only the flood step is blocked.
 * Mirrored by blocksGateTrail() in src/game/interactions.ts, which greys the
 * click out before it ever reaches here.
 */
function blocksGateTrail(tx: number, ty: number, g: ReturnType<typeof gateGeomOf>): boolean {
	if (Math.abs(ty - Math.round(g.gateY)) > 1) return false;
	if (g.westGate && tx <= 2) return true;
	if (g.eastGate && tx >= g.landRight - 3) return true;
	return false;
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
async function biomeMetrics(playerId: string, opts: { images?: boolean; player?: any } = {}) {
	const t = db();
	const d = await defs();
	// BiomeState / Placement / TerrainTile are WORLD-keyed, so `byPlayer` cannot
	// use their prefix and degrades to a full scan of the whole table — three of
	// them, on a path GET /Metrics/<playerId> reaches on every read. Resolve the
	// world once and use the bounded read instead; for a solo save the world id IS
	// the player id, so this returns the same rows by a much cheaper route.
	const player = opts.player && opts.player.id === playerId ? opts.player : await getPlayer(playerId);
	const wid = player ? worldOf(player) : playerId;
	const states = await byWorld(t.BiomeState, wid);
	const byId = new Map(states.map((s) => [s.biomeId, s]));
	const placements = opts.images ? await byWorld(t.Placement, wid) : [];
	const terrain = opts.images ? await byWorld(t.TerrainTile, wid) : [];

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
		// Born on the current key contract, on both axes. `keyRev` says this world's
		// rows are already prefixed, so migrateWorldKeys never scans for it;
		// `achKeyRev` says the same for PlayerAchievement, which is what lets
		// byPlayer skip its legacy-rescue scan for a save that has simply not earned
		// anything yet. Without the second marker every action taken by a brand-new
		// save — the first ten minutes of the game, for everyone — full-scanned every
		// achievement row in the database looking for legacy rows that cannot exist.
		keyRev: KEY_REV,
		achKeyRev: KEY_REV,
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
		// Born current: a save created on this build has no retired animal ids, no
		// mis-filed discoveries and no gate it walled off before the rule existed,
		// so the repair pass has nothing to find. Stamped here rather than left for
		// the first heartbeat to discover, because that would spend a Player write
		// per new save to learn there was no work — and the write budget is what
		// caps how many people can play at once. Only pre-0.3 saves lack it.
		repairRev: REPAIR_REV,
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

	const chestPlacementId = `${wid}:pl_${playerId}_starter-chest`;
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
	if (!d.biome.get(biomeId))
		throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }), 400, 'server.err.unknownBiome');

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
	// The lifetime `animalsReturned` counter is bumped HERE rather than at the call
	// sites, because this is the only place an animal can actually come home. It
	// used to be bumped by the four player actions that trigger a recalc (place,
	// plant, terraform, remove), which silently missed every other route: the
	// heartbeat growth pass (a tree finishing maturity mid-session, and the
	// welcome-back catch-up after time away), POST /RecalcBiome/, and the recalc
	// that follows seeding an area's starting terrain. That left the dashboard
	// showing two different "Animals returned" numbers for the same player —
	// biomeSummary.totalAnimalsReturned (derived from BiomeState, always right)
	// against a counts.animalsReturned that under-reported. Bumping at the source
	// means a new path can't reintroduce the drift.
	const deltas: Record<string, number> = newAnimals.length ? { animalsReturned: newAnimals.length } : {};
	if (Object.keys(dailyDeltas).length || Object.keys(deltas).length) {
		const actor = opts.player || (await safeGet(t.Player, playerId));
		if (actor) await bumpMetrics(actor, deltas, dailyDeltas);
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
 * gates open immediately.
 */
async function checkUnlocks(
	wid: string,
	playerId: string,
	fresh: { player?: any; freshState?: any } = {},
): Promise<any[]> {
	const t = db();
	const d = await defs();
	const player = fresh.player || (await safeGet(t.Player, playerId));
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
		await patchPlayer(playerId, { unlockedBiomes: [...unlockedSet], pendingUnlockRewards: [...pendingRewards] });
		const bsRow = await findBiomeState(t.BiomeState, wid, biome.id);
		await t.BiomeState.patch(bsRow?.id ?? `${wid}:${biome.id}`, { unlocked: true });
		await seedStartingTerrain(wid, playerId, biome.id);
		unlockedNow.push({ id: biome.id, name: biome.name });
	}
	return unlockedNow;
}

/**
 * Recipe unlocks. A recipe with no `unlock` block is craftable from the moment
 * its biome is open (three starters per area). Everything else waits on its own
 * condition, and no two recipes in an area share one — so the crafting menu
 * grows a little at a time, and each new line in it is the reward for a
 * particular piece of caretaking rather than for a health bar ticking over.
 *
 * The conditions reach across the whole game: this area's health and ecological
 * balance, how many animals are back (in total, of one kind, or one specific
 * keystone species), what you have crafted before and how widely, what is
 * standing or planted on the ground here, the open water you've shaped, your
 * tool tiers, your home upgrades, achievements, and progress in other areas.
 * See RecipeUnlock in src/types.ts; the client mirrors this in src/recipes.ts.
 */
interface RecipeUnlockCtx {
	health: number;
	balance: number;
	animalsReturned: number;
	returnedAnimalIds: Set<string>;
	returnedKinds: Record<string, number>;
	totalAnimals: number;
	craftedEver: Record<string, number>;
	craftedDistinct: number;
	placedHere: Record<string, number>;
	water: { tiles: number; lake: number; river: number };
	tools: Record<string, number>;
	home: Record<string, any>;
	homeBuilt: boolean;
	biomeHealth: Record<string, number>;
	achievements: Set<string>;
	biomesOpen: number;
	seenPhases: string[];
}

function recipeUnlockMet(recipe: any, ctx: RecipeUnlockCtx): boolean {
	const u = recipe.unlock;
	if (!u) return true; // starter recipe
	// how far this area has come back
	if (typeof u.minHealth === 'number' && ctx.health < u.minHealth) return false;
	if (typeof u.minBalance === 'number' && ctx.balance < u.minBalance) return false;
	// the life that's returned
	if (typeof u.animalsReturned === 'number' && ctx.animalsReturned < u.animalsReturned) return false;
	if (u.requiresAnimal && !ctx.returnedAnimalIds.has(u.requiresAnimal)) return false;
	if (u.requiresKind && (ctx.returnedKinds[u.requiresKind.kind] || 0) < u.requiresKind.count) return false;
	if (typeof u.totalAnimals === 'number' && ctx.totalAnimals < u.totalAnimals) return false;
	// what you've made, and what you've put in the ground here
	if (u.requiresCrafted && (ctx.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
	if (typeof u.craftedDistinct === 'number' && ctx.craftedDistinct < u.craftedDistinct) return false;
	if (u.requiresPlaced && (ctx.placedHere[u.requiresPlaced.objectId] || 0) < u.requiresPlaced.count) return false;
	if (u.requiresWater) {
		if (ctx.water.tiles < (u.requiresWater.tiles || 0)) return false;
		if (ctx.water.lake < (u.requiresWater.lake || 0)) return false;
		if (ctx.water.river < (u.requiresWater.river || 0)) return false;
	}
	// your own kit
	if (u.requiresTool && (ctx.tools[u.requiresTool.id] || 1) < u.requiresTool.tier) return false;
	if (u.requiresHome && (ctx.home[u.requiresHome.track] || 1) < u.requiresHome.level) return false;
	if (u.homeBuilt && !ctx.homeBuilt) return false; // a real house, not the starting tent
	// a time of day you've been through once (the headlamp arrives at nightfall
	// and stays — see phasesSeen() in server/weather.ts)
	if (u.phaseSeen?.length && !u.phaseSeen.some((p: string) => ctx.seenPhases.includes(p))) return false;
	// the wider preserve
	if (u.requiresBiome && (ctx.biomeHealth[u.requiresBiome.biome] || 0) < u.requiresBiome.minHealth) return false;
	if (u.requiresAchievement && !ctx.achievements.has(u.requiresAchievement)) return false;
	if (typeof u.biomesOpen === 'number' && ctx.biomesOpen < u.biomesOpen) return false;
	return true;
}

/**
 * Build the unlock context for one biome from live records, then judge a recipe.
 * Used by CraftItem to enforce the gate server-side (Harper is the source of
 * truth — the client only hides locked recipes for nicer UX).
 */
async function recipeUnlockContext(
	wid: string,
	biomeId: string,
	player: any,
	d: any,
	unlock?: any,
): Promise<RecipeUnlockCtx> {
	const t = db();
	// Read only what THIS gate actually asks about. Every field below that comes
	// off the player row is free, but each of the four world reads is a scan, and
	// CraftItem builds this context on every single craft. Nearly every recipe
	// names one condition, so gathering all four was three scans of pure waste per
	// craft — working directly against the read budget the rest of 0.3 buys back.
	// With no `unlock` argument the context is built in full, which is what a
	// caller judging several recipes at once wants.
	const u = unlock || {};
	const all = !unlock;
	const needStates = all || u.minHealth != null || u.minBalance != null || u.requiresBiome != null;
	const needAnimals =
		all || u.animalsReturned != null || u.requiresAnimal != null || u.requiresKind != null || u.totalAnimals != null;
	const needPlaced = all || u.requiresPlaced != null;
	const needWater = all || u.requiresWater != null;
	const needAchievements = all || u.requiresAchievement != null;

	// Use the reliable per-world scan, not BiomeState.get(): a primary-key .get()
	// can return null for a record that exists on a cold Harper instance, which made
	// health read as 0 and wrongly rejected a craft the client correctly showed as
	// unlocked (e.g. a Bird Perch at 24% health).
	const states = needStates ? await byWorld(t.BiomeState, wid) : [];
	const bs = needStates
		? states.find((s: any) => s.biomeId === biomeId) || (await findBiomeState(t.BiomeState, wid, biomeId))
		: null;
	const discoveries = needAnimals ? await byWorld(t.Discovery, wid) : [];
	const here = discoveries.filter((x: any) => d.animal.get(x.animalId)?.biome === biomeId);
	const returnedAnimalIds = new Set<string>(here.map((x: any) => x.animalId));
	const returnedKinds: Record<string, number> = {};
	for (const x of here) {
		const kind = d.animal.get(x.animalId)?.kind;
		if (kind) returnedKinds[kind] = (returnedKinds[kind] || 0) + 1;
	}
	const placements = needPlaced ? (await byWorld(t.Placement, wid)).filter((p: any) => p.area === biomeId) : [];
	const terrain = needWater ? (await byWorld(t.TerrainTile, wid)).filter((tt: any) => tt.area === biomeId) : [];
	const achievements = needAchievements ? await earnedAchievementIds(player.id) : new Set<string>();
	const biomeHealth: Record<string, number> = {};
	for (const s of states) biomeHealth[s.biomeId] = s.health || 0;
	const wxTime = weatherTimeFromPlay(player); // play-time clock, never null
	return {
		health: bs?.health || 0,
		balance: bs?.balance || 0,
		animalsReturned: returnedAnimalIds.size,
		returnedAnimalIds,
		returnedKinds,
		totalAnimals: discoveries.length,
		craftedEver: (player.craftedEver || {}) as Record<string, number>,
		craftedDistinct: Object.keys(player.craftedEver || {}).length,
		placedHere: placementCounts(placements),
		// playerOnly. The "shape N water tiles" gates are defined as open water YOU
		// shaped, and Rushwater opens with 18 pre-seeded tiles (a nine-tile channel
		// plus a six-tile pond) — counting those satisfied a 6-tile gate the moment
		// the wetland unlocked. Animal water needs are a separate question and still
		// read the natural channels: see the bare analyzeWater(terrain) in recalcBiome.
		water: analyzeWater(terrain, true),
		tools: (player.tools || {}) as Record<string, number>,
		home: homeOf(player),
		homeBuilt: !!homeOf(player).styleLocked,
		biomeHealth,
		achievements,
		biomesOpen: (player.unlockedBiomes || []).length,
		// same play-time clock the weather snapshot and rare animals read
		seenPhases: phasesSeen(wxTime),
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
			throw new GameError(
				tr('server.err.notEnough', { resource: resId, need: qty, have: inInv + inChests }),
				400,
				'server.err.notEnough',
			);
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
		if (remaining > 0)
			throw new GameError(tr('server.err.notEnoughShort', { resource: resId }), 400, 'server.err.notEnoughShort'); // defensive; checked above
	}

	await patchPlayer(player.id, { inventory });
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
	/** every TerrainTile row in this world (for the starter chain's stream goal).
	 *  Optional: callers that don't have it pass nothing and the water-shaped
	 *  metric reads zero, which is only ever a goal showing 0/3 for one render. */
	terrain?: any[];
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
// The board is the player's OWN list now: the ten-goal starter chain that teaches the
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
	// Gated by the EXPANDED guide for this animal's area: the exact checklist is
	// what that edition is for, in the journal and here alike (same rule both
	// places — see hasExpandedGuide).
	//
	// Without it the goal is not blank. It carries the caretaker's hint — the
	// plain-language "leave a little brush at the edge" line every animal has —
	// and then says where the exact list comes from. A goal you set yourself
	// should always tell you something about how to finish it; "go buy a book"
	// on its own is a locked door with your own goal behind it.
	if (!hasExpandedGuide(ctx.player, a.biome)) {
		const steps: { text: string; done: boolean }[] = [];
		// The hint rides through as written in the definitions, the same way the
		// habitat steps below carry raw object names: the server bundle registers
		// only the `server` catalog, so animal content text isn't translatable here.
		const hint = a.requirements?.hint;
		if (hint) steps.push({ text: hint, done: false });
		steps.push({ text: tr('server.goal.upgradeGuide'), done: false });
		return steps;
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

/**
 * The starter chain: ten fixed goals that open the game, shown ONE AT A TIME.
 *
 * Each link is a different verb — gather, craft-and-place, welcome, plant,
 * harvest, welcome again (a whole group this time), upgrade, build at volume,
 * shape the land, build a home — so
 * a player who follows the chain has touched every core mechanic once by the end
 * of it. No link repeats another's motion: watering, for instance, is not its own
 * goal because you cannot plant without doing it, and a goal for something the
 * player has already had to do reads as filler.
 *
 * The order is a dependency chain, not a difficulty ramp. The grasshopper is
 * third because it is the game's first real reward and the whole premise —
 * animals come home when the habitat is right — and it needs exactly what the
 * two goals before it produce: a crafted grass patch, placed. Harvest follows
 * planting because it needs something grown. The bugs goal sits where a planted,
 * flowering meadow has started drawing small neighbours in on its own.
 *
 * The finale is deliberate: shaping open water is the most advanced thing the
 * land lets you do, and building a house is the biggest thing you can make.
 *
 * Only one is on the board at a time (see dailyTasksBlock) — claiming reveals
 * the next. Ten visible at once reads as a chore list; one reads as the next
 * thing to do. Finishing all ten is what unlocks player-authored goals.
 *
 * Progress comes from durable world state wherever possible (held materials,
 * placements and their harvest stamps, discoveries, tool tiers, terrain, the home
 * row) so it survives a reload and cannot be replayed. The one exception is
 * `objectsPlaced`, a lifetime counter: the seeded camp tent and chest are
 * placements too, so counting live rows would hand the player two free steps
 * they never took.
 */
function starterTasks(ctx: TaskCtx): any[] {
	const counts = (readMetrics(ctx.player)?.counts || {}) as Record<string, number>;
	const placed = counts.objectsPlaced || 0;
	const grasshopper = ctx.discoveries.some((x: any) => x.animalId === FIRST_ANIMAL_ID);
	const planted = (ctx.placements || []).filter((p: any) => typeof p.plantedAt === 'number').length;
	const harvested = (ctx.placements || []).some((p: any) => typeof p.lastHarvestAt === 'number');
	// "Bugs" in the way a caretaker means it: the small crawling, flying, creeping
	// neighbours. The definitions split `kind` into 'insect' (grasshopper, ladybug,
	// bumblebee) and 'invertebrate' (snail, pillbug, garden spider) for display;
	// both are bugs to a player, and splitting them here would make the goal a
	// puzzle about the data model rather than about the meadow.
	//
	// The grasshopper from three goals earlier counts, so this arrives at 1/3 and
	// asks for two more — a visible head start rather than a fresh zero.
	const bugs = ctx.discoveries.filter((x: any) => BUG_KINDS.has(ctx.d?.animal?.get(x.animalId)?.kind)).length;
	// The opening chain is a tour of the meadow, so the guide it asks for is the
	// meadow's — the cheap one, buyable from meadow materials alone.
	const meadowGuide = hasGuide(ctx.player, 'meadow');
	// Largest connected body of water the PLAYER shaped — the seeded channels the
	// wetland ships with are excluded, so a stream has to be dug, not inherited.
	const water = analyzeWater(ctx.terrain || [], true);
	return [
		{
			id: 'start-seeds',
			kind: 'gather',
			icon: 'basket',
			text: tr('server.starter.seeds', { count: STARTER_SEEDS }),
			hint: tr('server.task.gatherHint'),
			target: STARTER_SEEDS,
			progress: Math.min(STARTER_SEEDS, counts[`${META_COUNTER_PREFIX}seeds`] || 0),
			// `event` + `resourceId` let the client credit a pickup the moment it
			// happens rather than at the next full sync — the very first goal in the
			// game used to sit at 0/10 while seeds visibly piled up, which reads as a
			// broken counter. Monotonic because it counts gathering, not holding: the
			// bar must not fall back when those seeds get planted.
			resourceId: 'seeds',
			base: 0,
			monotonic: true,
			event: 'gather',
		},
		{
			id: 'start-grasshopper',
			kind: 'welcome',
			icon: 'sparkle',
			text: tr('server.task.welcomeGrasshopper'),
			hint: tr('server.task.welcomeGrasshopperHint'),
			target: 1,
			progress: grasshopper ? 1 : 0,
		},
		{
			id: 'start-plant',
			kind: 'plant',
			icon: 'leaf',
			text: tr('server.starter.plant', { count: 3 }),
			hint: tr('server.starter.plantHint'),
			target: 3,
			progress: Math.min(3, planted),
		},
		{
			id: 'start-harvest',
			kind: 'gather',
			icon: 'basket',
			text: tr('server.starter.harvest'),
			hint: tr('server.starter.harvestHint'),
			target: 1,
			progress: harvested ? 1 : 0,
		},
		{
			id: 'start-bugs',
			kind: 'welcome',
			icon: 'paw',
			text: tr('server.starter.bugs', { count: STARTER_BUGS }),
			hint: tr('server.starter.bugsHint'),
			target: STARTER_BUGS,
			progress: Math.min(STARTER_BUGS, bugs),
		},
		{
			id: 'start-journal-upgrade',
			kind: 'goal',
			icon: 'journal',
			text: tr('server.starter.journal'),
			hint: tr('server.starter.journalHint'),
			target: 1,
			progress: meadowGuide ? 1 : 0,
		},
		{
			id: 'start-build-ten',
			kind: 'place',
			icon: 'hammer',
			text: tr('server.starter.buildTen', { count: STARTER_PLACE_TOTAL }),
			hint: tr('server.starter.buildTenHint'),
			target: STARTER_PLACE_TOTAL,
			progress: Math.min(STARTER_PLACE_TOTAL, placed),
			// Credited the moment the thing lands in the world, not at the next sync:
			// the player watched themselves put it down, so the bar moving a second
			// later reads as the game missing it. Counts placements, so crafting
			// something and leaving it in the basket is not enough — it has to be out
			// there, which is what makes a habitat.
			monotonic: true,
			event: 'place',
		},
		{
			// Craft a sleeping bag, put it in the tent, sleep in it: crafting, placing
			// indoors, and resting in one small errand. It sits late on purpose — a
			// night's sleep refreshes every gathering spot, which is worth most to a
			// caretaker who has just spent their materials on ten placed things and is
			// about to need more for a stream.
			//
			// The recipe was gated behind welcoming the ground squirrel, which put this
			// goal behind an animal that arrives on its own schedule. It ships ungated
			// (four fiber, see data/recipes.json) — a caretaker sleeping rough until a
			// squirrel turns up was never the intent.
			id: 'start-rest',
			kind: 'goal',
			icon: 'home',
			text: tr('server.starter.rest'),
			hint: tr('server.starter.restHint'),
			target: 1,
			progress: (counts.restsTaken || 0) > 0 ? 1 : 0,
		},
		{
			id: 'start-stream',
			kind: 'water',
			icon: 'can',
			text: tr('server.starter.stream'),
			hint: tr('server.starter.streamHint'),
			target: STARTER_STREAM_TILES,
			progress: Math.min(STARTER_STREAM_TILES, water.lake || 0),
		},
		{
			id: 'start-home',
			kind: 'goal',
			icon: 'home',
			text: tr('server.starter.home'),
			hint: tr('server.starter.homeHint'),
			target: 1,
			progress: ctx.player?.home?.styleLocked ? 1 : 0,
		},
	];
}

/** The definition `kind`s a player would call a bug. */
const BUG_KINDS = new Set(['invertebrate', 'insect']);

/** How many links of the chain are on the board at once. */
const STARTER_VISIBLE = 3;

/** Sizes for the chain's counted goals. */
const STARTER_SEEDS = 10;
const STARTER_BUGS = 3;
const STARTER_PLACE_TOTAL = 10;
/** Connected open-water tiles that count as "a stream" — small enough to dig in
 *  one sitting (each tile is a dig plus two waterings), big enough that the
 *  player has to chain them and see a channel appear rather than a puddle. */
const STARTER_STREAM_TILES = 3;

/**
 * The three starter ids the SHIPPED build used. Nothing writes them any more —
 * they exist purely as the marker for "this save finished the old chain".
 *
 * A save that claimed all three was already past its onboarding, and dropping
 * seven tutorial goals onto a board that has been running for weeks is noise, so
 * those saves skip the chain entirely (and keep their custom goals unlocked,
 * since `startersDone` on the client is simply "no start-* task on the board").
 * The ids in the new chain are all fresh, so no new player can ever accidentally
 * satisfy this test.
 */
const LEGACY_STARTER_IDS = ['start-gather', 'start-craft', 'start-welcome'];

/** Did this save finish the pre-chain starters? Then it never sees the chain. */
function starterChainRetired(player: any): boolean {
	const claims: Record<string, boolean> = player?.goalClaims || {};
	return LEGACY_STARTER_IDS.every((id) => claims[id]);
}

/**
 * The chain's ids, in order. Derived from the chain itself rather than written
 * out a second time, so a goal renamed or reordered can't quietly desync the
 * funnel from the thing it measures. The dummy context is safe because every
 * field starterTasks() reads is optional-with-a-default; only the ids are used.
 */
function starterTaskIds(): string[] {
	return starterTasks({ player: {}, discoveries: [], biomeStates: [] } as any).map((s: any) => s.id);
}

/**
 * Where one save is in the opening, for the metrics roll-up.
 *
 * The whole point of the chain is to hand the board over: ten goals that teach
 * the game and then get out of the way. So the number that matters is not how
 * many players finished it — it's how many went on to write a goal of their own
 * afterwards, which is the behaviour the chain is trying to produce. `step` is
 * where the rest stalled, and it's the only way to tell "quit the game" from
 * "stuck on Build a home".
 *
 * All of it is read from data the save already stores (goalClaims, and the
 * goalsCreated counter), so it costs nothing and works retroactively.
 */
function starterChainMetrics(player: any) {
	const claims: Record<string, boolean> = player?.goalClaims || {};
	const ids = starterTaskIds();
	const claimed = ids.filter((id) => claims[id]).length;
	const retired = starterChainRetired(player);
	return {
		// 0-10, or 10 for a save that finished the old three-goal opening — those
		// never see the chain, so counting them as stalled at 0 would be a lie.
		starterStep: retired ? ids.length : claimed,
		starterTotal: ids.length,
		starterDone: retired || claimed >= ids.length,
		/** Pre-chain save: its step is inferred, not observed. */
		starterLegacy: retired,
		/** Goals the player wrote themselves, ever (see SetGoals). */
		goalsCreated: (readMetrics(player)?.counts?.goalsCreated as number) || 0,
	};
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

/** The on-screen board: the current starter (one at a time), then the player's own goal list. */
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
	// Then the starter chain — the next STARTER_VISIBLE unclaimed links, in order,
	// sitting under the pinned biome goal. Claiming one pulls the following link up
	// into the empty slot (the client refreshes state after a claim), so the board
	// always shows the same short horizon instead of a ten-item backlog.
	//
	// Three rather than one because a single goal gives a player nothing to do when
	// the current one is gated on something slow — a plant maturing, an animal
	// deciding to come home. Three is enough to always have a move available and
	// still few enough to read as "what's next" rather than a chore list.
	if (!starterChainRetired(player)) {
		const next = starterTasks(ctx)
			.filter((s) => !goalClaims[s.id])
			.slice(0, STARTER_VISIBLE);
		for (const s of next) tasks.push({ ...s, counter: '', reward: goalReward(ctx, s.id), claimed: false });
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
			// A "collect N of X" goal counts held materials, so the client can keep it
			// live between syncs (withHeldTaskProgress). The baseline rides along
			// because progress is what has been gathered SINCE the goal was set.
			...(g.kind === 'collect' ? { resourceId: g.resourceId, base: g.base || 0 } : {}),
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
	let player = await getPlayer(playerId);
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
			readFeed(wid),
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
	const wxTime = weatherTimeFromPlay(player); // play-time clock, never null
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
		// persisted activity feed, oldest→newest (last 100 kept per world)
		feed: feedRows.slice(-FEED_CAP).map((r: any) => ({ id: r.id, at: r.at, icon: r.icon, text: r.text })),
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
			terrain,
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
	if (!body || typeof body !== 'object')
		throw new GameError(tr('server.err.bodyRequired'), 400, 'server.err.bodyRequired');
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
	/** Every area of the preserve, so a "one per biome" trigger can't fall out of
	 *  step with the data by hardcoding the list. */
	biomeIds: string[];
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
	'meadow-apex': (c) => !!c.disc('red-fox'),
	'meadow-mender': (c) => c.health('meadow') >= 80,
	'meadow-reborn': (c) => c.returned('meadow') >= 25,

	'forest-understory': (c) => c.returned('forest') >= 10,
	'forest-cavities': (c) =>
		!!c.disc('pileated-woodpecker') &&
		(!!c.disc('wood-duck') || !!c.disc('flying-squirrel') || !!c.disc('great-horned-owl') || !!c.disc('goshawk')),
	'forest-night-shift': (c) => !!c.disc('great-horned-owl') && !!c.disc('goshawk') && !!c.disc('skunk'),
	'forest-canopy': (c) => c.health('forest') >= 80,
	'forest-reborn': (c) => c.returned('forest') >= 25,

	'wetland-first-water': (c) => c.returned('wetland') >= 8,
	'wetland-engineer': (c) => !!c.disc('beaver'),
	'wetland-lakemaker': (c) => c.water('wetland').lake >= 6,
	'wetland-restored': (c) => c.health('wetland') >= 80,
	'wetland-reborn': (c) => c.returned('wetland') >= 25,

	'desert-first-life': (c) => c.returned('desert') >= 8,
	'desert-burrows': (c) => !!c.disc('burrowing-owl') && !!c.disc('kangaroo-rat') && !!c.disc('desert-tortoise'),
	'desert-hunter': (c) => !!c.disc('rattlesnake') || !!c.disc('mountain-lion'),
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
	// Every area's guide, written all the way up to its expanded edition. "Every
	// guide filled in, every animal's secrets unlocked" is what the badge already
	// promised; before the split it was one ladder for the whole preserve, and now
	// it is one per place.
	naturalist: (c) => c.biomeIds.every((b) => c.tool(guideTool(b)) >= GUIDE_MAX),
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
async function earnedAchievementIds(playerId: string, player?: any): Promise<Set<string>> {
	// `player` is passed through purely so byPlayer's legacy-key check can answer
	// from a row the caller already holds instead of re-reading it. Every gameplay
	// action reaches here via awardAchievements.
	const rows = await byPlayer(db().PlayerAchievement, playerId, { player });
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
	/* When each achievement was earned, for ALL of them — not just the five in
	 * `recent`. Time-to-earn is only interesting for the achievements everybody
	 * gets, and those are the EARLY ones, which is exactly what a most-recent-five
	 * list leaves out: a player with twenty achievements reports nothing about the
	 * first one they ever earned. A flat id -> timestamp map is a few hundred
	 * bytes and makes both popularity and pacing computable from the rollup.
	 * `recent` stays as it is; something may still be reading it. */
	const earnedAt: Record<string, number> = {};
	for (const r of rows) if (r.achievementId && r.earnedAt) earnedAt[String(r.achievementId)] = Number(r.earnedAt);

	return {
		earned: rows.length,
		total: d.achievements.length,
		points,
		completion: round1(rows.length / total),
		byCategory,
		recent,
		earnedAt,
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
	opts: {
		addDiscoveries?: any[];
		freshBiomeStates?: any[];
		/** Rows the caller has already read this request — see the note below. */
		player?: any;
		biomeStates?: any[];
		discoveries?: any[];
		terrain?: any[];
	} = {},
): Promise<any[]> {
	try {
		const t = db();
		const d = await defs();
		// safeGet (not raw .get): achievement fan-out reads every member of a co-op
		// world, so one member left with an undecodable record must not throw a
		// storage-layer decode error on every action. safeGet force-decodes, purges
		// the corrupt row, and returns null → this player is simply skipped.
		const player = opts.player && opts.player.id === playerId ? opts.player : await safeGet(t.Player, playerId);
		if (!player) return [];
		const earned = await earnedAchievementIds(playerId, player);
		// achievement context comes from the world the player is acting in
		const wid = worldOf(player);

		// Reuse whatever the caller already read. These three scans are bounded per
		// world, but the heartbeat and several actions had ALREADY read the same
		// rows moments earlier in the same request and were paying for them twice —
		// the reads are identical, so the only thing the second pass bought was
		// latency. `opts` was always the place for this; the addDiscoveries /
		// freshBiomeStates folding below exists for exactly the same reason.
		let [biomeStates, discoveries, terrain] = await Promise.all([
			opts.biomeStates ?? byWorld(t.BiomeState, wid),
			opts.discoveries ?? byWorld(t.Discovery, wid),
			opts.terrain ?? byWorld(t.TerrainTile, wid),
		]);
		// Never mutate an array the caller lent us — the folding below pushes.
		if (opts.biomeStates) biomeStates = biomeStates.slice();
		if (opts.discoveries) discoveries = discoveries.slice();

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
			biomeIds: d.biomes.map((b: any) => b.id),
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
 * Award achievements for a world-changing action. One player owns one world, so
 * this is just the actor — the wrapper stays because every world-mutating call
 * site already goes through it, and it is the right seam if that ever changes.
 */
async function awardWorldAchievements(
	wid: string,
	actorId: string,
	opts: Parameters<typeof awardAchievements>[1] = {},
): Promise<any[]> {
	// One player owns one world, so there is nobody else to evaluate. The wrapper
	// stays because every world-mutating call site already routes through it.
	return awardAchievements(actorId, opts);
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
 * Roles allowed to read the dashboard's data feeds. `super_user` is Harper's
 * own; `metrics_reader` is a role you create with no write permission, so the
 * credential the dashboard holds in a browser tab can read these numbers and do
 * nothing else. That matters because the page keeps the password it logged in
 * with in order to authenticate its own requests — a super-user password sitting
 * in sessionStorage is the keys to the database; a read-only one is a leak worth
 * rotating and nothing worse.
 */
const DASHBOARD_ROLES = new Set(['super_user', 'metrics_reader']);

/** The role name off Harper's user object, tolerating either shape it might take.
 *  Probed rather than assumed — see SystemProbe's 'authenticated user shape'. */
function roleNameOf(user: any): string {
	const r = user?.role;
	if (typeof r === 'string') return r;
	if (r && typeof r === 'object') return String(r.role || r.role_name || r.name || '');
	return '';
}

/** True for Harper's own super-user flag, whichever way it is expressed. */
function isSuperUser(user: any): boolean {
	return !!(user?.role?.permission?.super_user || user?.role?.super_user || roleNameOf(user) === 'super_user');
}

/**
 * Base class for the endpoints the metrics dashboard reads.
 *
 * Authentication is still entirely Harper's — this only decides WHICH
 * authenticated users get through, and it fails closed: no user object, no
 * access. It deliberately does not fall back to "allow if we can't tell", which
 * is the shape that turns an unrecognised user object into an open endpoint.
 *
 * Endpoints carrying more than gameplay numbers do NOT use this. ListFeedback
 * holds players' reply emails and SystemProbe reports server internals; both stay
 * on the raw Resource, so they need the real super-user key.
 */
class DashboardEndpoint extends Resource {
	allowRead(user?: any) {
		if (!user) return false;
		return isSuperUser(user) || DASHBOARD_ROLES.has(roleNameOf(user));
	}
	allowCreate() {
		return false;
	}
	allowUpdate() {
		return false;
	}
	allowDelete() {
		return false;
	}
}

/**
 * GET /DashboardAuth/ — "are these credentials good, and who am I?"
 *
 * The login form needs something cheap to test a username and password against.
 * Without this it would have to call /MetricsSummary/, which scans and rolls up
 * every save just to find out whether a password was typed correctly. This reads
 * nothing.
 *
 * It returns the username and role name so the page can show who is signed in —
 * and so a credential that authenticates but lacks the role gets a clear "your
 * account cannot read this" instead of a bare 401 it can't explain.
 */
export class DashboardAuth extends DashboardEndpoint {
	async get() {
		const user: any = (this as any).getContext?.()?.user;
		return {
			ok: true,
			username: user?.username || user?.name || null,
			role: roleNameOf(user) || null,
			superUser: isSuperUser(user),
		};
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

		// `no-cache` means "cache it, but revalidate every time" — NOT "don't cache".
		// The catalog changes on deploy (new hats, hairstyles, skin tones), and the
		// old value here — `public, max-age=300, stale-while-revalidate=604800` —
		// meant a browser served the OLD catalog from cache for 5 minutes without
		// asking, then served it stale for up to 7 more days while revalidating in
		// the background. A deploy could take a week to show up in a browser, which
		// looked exactly like "the new options didn't ship". Revalidation is cheap:
		// the etag below is the build stamp, so an unchanged catalog costs a 304.
		const cacheControl = 'no-cache';
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
		if (cleanName.length < 2 || cleanName.length > 24)
			throw new GameError(tr('server.err.nameLength'), 400, 'server.err.nameLength');
		const code = String(passcode || '');
		if (code.length < 4 || code.length > 32)
			throw new GameError(tr('server.err.passcodeLength'), 400, 'server.err.passcodeLength');

		// EVERY save gets a unique id (name-slug + random suffix), demo or not. The
		// caretaker name is a label, not an identity: two people — or one person
		// with two saves — may both be "Willow", and neither should be told the
		// name is taken.
		//
		// This also closes a data-loss path. Ids used to be the bare name slug, so
		// a returning player whose row had gone undecodable was told "no save, try
		// New Game" (safeGet reports absent and corrupt identically), typed the
		// same name, landed on the SAME id, and the collision check — also a
		// safeGet — saw nothing and let the fresh save overwrite them. House back
		// to a tent, inventory empty, world untouched in the other tables. A random
		// id cannot land on an existing row, so that sequence is impossible now.
		//
		// existsRaw backs up safeGet here for the same reason: a row that is on
		// disk but unreadable still occupies its id.
		const base = slugId(cleanName) || 'caretaker';
		const t = db();
		let playerId: string;
		do {
			playerId = `${base}-${Math.random().toString(36).slice(2, 8)}`;
		} while ((await safeGet(t.Player, playerId)) || existsRaw(t.Player, playerId));

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
		await indexPlayerName(cleanName, playerId);
		// Per-save setup must never block starting a save — if it throws, the save
		// still works and the next login retries it.
		try {
			await ensureSoloWorld(created.player, { freshGrid: true });
		} catch (e) {
			console.error('save setup skipped (CreatePlayer):', e);
		}
		// COMPAT: `worldId` and `worlds` are dead fields a 0.2.x client still reads.
		return { ok: true, playerId, worldId: playerId, worlds: [], state: await freshSnapshot(created) };
	}
}

/**
 * POST /DeletePlayer/ {name, passcode} — permanently delete a save and every
 * record that belongs to it. Passcode required so nobody can wipe your preserve.
 */
/**
 * Name-slug -> save ids. Exists for one reason: salvageRecord only runs on a
 * POINT READ by id (safeGet), and since ids stopped being the bare name slug a
 * login had no id to point at. A scan can't stand in — toArray drops rows it
 * cannot decode, and a dropped row carries no id — so an undecodable save became
 * unreachable and unhealable. This keeps the ids reachable.
 *
 * Best-effort throughout: a missing or unreadable index must never block a login
 * or a save creation, because the name scan below still finds healthy rows.
 */
async function indexPlayerName(name: string, playerId: string): Promise<void> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return;
		const id = slugId(String(name || ''));
		if (!id) return;
		const row = (await safeGet(t.PlayerNameIndex, id)) || { id, playerIds: [] };
		const ids: string[] = Array.isArray(row.playerIds) ? row.playerIds : [];
		if (!ids.includes(playerId)) await t.PlayerNameIndex.put({ ...row, id, playerIds: [...ids, playerId] });
	} catch (e: any) {
		console.error('player name index write failed —', e?.message || e);
	}
}

async function unindexPlayerName(name: string, playerId: string): Promise<void> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return;
		const id = slugId(String(name || ''));
		if (!id) return;
		const row = await safeGet(t.PlayerNameIndex, id);
		if (!row || !Array.isArray(row.playerIds)) return;
		await t.PlayerNameIndex.put({ ...row, playerIds: row.playerIds.filter((p: string) => p !== playerId) });
	} catch (e: any) {
		console.error('player name index cleanup failed —', e?.message || e);
	}
}

/** Ids recorded under a name slug. Empty when the index is absent/unreadable. */
async function indexedIdsFor(name: string): Promise<string[]> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return [];
		const id = slugId(String(name || ''));
		if (!id) return [];
		const row = await safeGet(t.PlayerNameIndex, id);
		return Array.isArray(row?.playerIds) ? row.playerIds : [];
	} catch {
		return [];
	}
}

/**
 * Resolve the save behind a typed caretaker name + passcode.
 *
 * Player ids used to BE the name slug, so every "log me in / delete my save"
 * endpoint just rebuilt the id from the name. Ids are unique per save now (names
 * are a label, and two saves may share one), so the id can no longer be derived
 * — we try the legacy slug first for saves created before the change, then fall
 * back to every player carrying that name and let the passcode pick.
 *
 * `nameSeen` keeps the old 404-vs-403 split: no save by that name at all, versus
 * a save whose passcode did not match.
 */
/**
 * How many same-name saves the last-resort login scan will run scrypt against.
 * Bounds the work an unauthenticated failed login can cost — see the note at the
 * scan itself. Well above any plausible number of real saves sharing one name.
 */
const LOGIN_SCAN_CANDIDATE_MAX = 25;

async function resolveByNameAndPasscode(
	name: any,
	passcode: any,
): Promise<{ player: any | null; nameSeen: boolean; unreadable?: boolean }> {
	const wanted = String(name || '')
		.trim()
		.toLowerCase();
	if (!wanted) return { player: null, nameSeen: false, unreadable: false };
	const slug = slugId(String(name || ''));
	const legacy = slug ? await safeGet(db().Player, slug) : null;
	if (legacy && (await verifyPasscode(legacy, passcode))) return { player: legacy, nameSeen: true };
	// Point-read each indexed id BEFORE falling back to a scan. safeGet salvages
	// an undecodable row here; the scan below never can, so this ordering is what
	// keeps a corrupt save recoverable.
	let indexSeen = false;
	let unreadable = false;
	for (const pid of await indexedIdsFor(name)) {
		const p = await safeGet(db().Player, pid);
		if (!p) {
			// Nothing decoded, but the bytes are on disk: this save exists and we
			// could not open it. Telling the player "no save — try New Game" here is
			// both false and the worst possible advice.
			if (existsRaw(db().Player, pid)) unreadable = true;
			continue;
		}
		indexSeen = true;
		if (await verifyPasscode(p, passcode)) return { player: p, nameSeen: true };
	}
	// Last-resort scan for a save the name index never learned about. Everything
	// above is a point read; this is the only unbounded read on the login path, and
	// it is reached precisely when a login FAILS — a wrong passcode, or a name that
	// doesn't exist. That makes it the one place an unauthenticated caller can
	// choose to make the server do expensive work, and the work is not cheap on
	// either axis: a full Player scan, and then `verifyPasscode` per candidate,
	// which is scrypt — deliberately slow and, worse, SYNCHRONOUS, so each call
	// blocks the whole event loop rather than just the request that asked for it.
	//
	// Two bounds, neither of which can turn a good login into a failed one:
	//
	//  • Skip the scan entirely when the index already produced candidates. If
	//    `indexSeen` is true the name IS indexed, every save under it has just been
	//    point-read, and none matched the passcode. The scan cannot find a
	//    different answer — it can only re-derive the same rows the slow way.
	//  • Cap how many name-matches we are willing to hash. Names collide (a shared
	//    family machine, a common first name), and without a cap one POST costs one
	//    scrypt per colliding save. The cap is generous enough that a real player is
	//    never turned away by it, and the overflow is logged rather than silently
	//    dropped, because "your save is beyond the cap" would otherwise look
	//    identical to "wrong passcode".
	let candidates: any[] = [];
	if (!indexSeen) {
		candidates = (await allOf(db().Player)).filter(
			(p: any) =>
				String(p?.name || '')
					.trim()
					.toLowerCase() === wanted,
		);
		if (candidates.length > LOGIN_SCAN_CANDIDATE_MAX) {
			console.error(
				`login scan for "${wanted}": ${candidates.length} name matches, hashing the ${LOGIN_SCAN_CANDIDATE_MAX} most recent`,
			);
			// Newest first — a save someone is actively trying to log into is far more
			// likely to be recent than to be the oldest row that ever used the name.
			candidates = candidates
				.slice()
				.sort((a: any, b: any) => (b?.createdAt || 0) - (a?.createdAt || 0))
				.slice(0, LOGIN_SCAN_CANDIDATE_MAX);
		}
		for (const c of candidates) {
			if (await verifyPasscode(c, passcode)) return { player: c, nameSeen: true };
		}
	}
	if (slug && !legacy && existsRaw(db().Player, slug)) unreadable = true;
	return { player: null, nameSeen: !!legacy || indexSeen || candidates.length > 0, unreadable };
}

export class DeletePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode } = await bodyOf(data);
		const found = await resolveByNameAndPasscode(name, passcode);
		if (!found.player) {
			if (found.unreadable) throw new GameError(tr('server.err.saveUnreadable'), 409, 'server.err.saveUnreadable');
			if (found.nameSeen) throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
			throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');
		}
		const player = found.player;
		const playerId = player.id;

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
		// Deleting the save is the one place a still-undecodable row must not be
		// left behind, so fall back to forceRemove (stub-then-delete) when the row
		// exists on disk but neither salvage nor a plain delete can touch it.
		if (existsRaw(t.Player, playerId)) await forceRemove(t.Player, playerId);
		await t.Player.delete(playerId);
		await unindexPlayerName(player.name, playerId);
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
		if (readMetrics(player)?.edition !== 'demo')
			throw new GameError(tr('server.err.notDemoSave'), 403, 'server.err.notDemoSave');

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
		await t.Player.delete(id);
		await unindexPlayerName(player?.name, id);
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
		if (!id) throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');

		// The WHOLE snapshot is taken under the player's lock, reads included.
		//
		// This endpoint reads nine tables one after another, and without the lock
		// there is nothing stopping a gameplay request landing in the middle of that
		// — the client does not serialize its fetches. Worse, withPlayerLock BUFFERS
		// Player patches and only writes them out as the lock releases, so a
		// half-overlapped action is visible in exactly the wrong order: PlaceObject
		// decrements `craftedItems` inside the lock and writes the Placement row
		// immediately, so an export threading between them captures a Player who
		// still owns the brush pile AND a Placement of the brush pile already in the
		// ground. Import that save into the full game and the item has been
		// duplicated.
		//
		// Taking the lock costs a moment of waiting on a button press the player
		// makes once, and buys a snapshot that is consistent with itself — which is
		// the entire point of a save they are carrying between games.
		return withPlayerLock(id, async () => {
			const t = db();
			const player = await safeGet(t.Player, id);
			if (!player) throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');
			if (readMetrics(player)?.edition !== 'demo')
				throw new GameError(tr('server.err.notDemoSave'), 403, 'server.err.notDemoSave');

			const wid = worldOf(player);
			// Reset edition to 'full' on the exported copy: the player is carrying this
			// into the paid game, so it should report as a full-game save (Heartbeat
			// keeps 'demo' sticky otherwise).
			//
			// Flipping that flag used to be ALL this did, which erased the most
			// interesting thing that had ever happened to the save: after import it was
			// indistinguishable from one that started in the full game, so "played the
			// demo, liked it, bought it, carried their meadow across" — the single
			// clearest signal the demo is doing its job — left no trace anywhere. Stamp
			// the milestone and freeze how far they had got, so the save can report it
			// about itself from then on.
			const prevMetrics = readMetrics(player) || {};
			const atExport = metricsView(player);
			const exportedPlayer = {
				...player,
				metrics: encodeMetrics({
					...prevMetrics,
					edition: 'full',
					convertedFromDemoAt: Date.now(),
					demoPlaySeconds: atExport.playSeconds,
					demoSessions: atExport.sessions,
					demoActions: atExport.totalActions,
				}),
			};

			const save = {
				meta: {
					playerId: id,
					name: player.name || 'Caretaker',
					appearance: player.appearance || {},
					createdAt: player.createdAt || Date.now(),
					updatedAt: Date.now(),
				},
				// Keys mirror src/solo/localDb.ts DYNAMIC_TABLES so loadSoloGame hydrates
				// cleanly.
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
				},
			};
			return { ok: true, ...save };
		});
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
		if (!(await verifyPasscode(player, currentPasscode)))
			throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
		const next = String(newPasscode || '');
		if (next.length < 4 || next.length > 32)
			throw new GameError(tr('server.err.newPasscodeLength'), 400, 'server.err.newPasscodeLength');
		const { salt, hash } = hashPasscode(next);
		await patchPlayer(playerId, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return { ok: true };
	}
}

/** POST /LoginPlayer/ {name, passcode} — load an existing save. */
export class LoginPlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode, tzOffsetMinutes } = await bodyOf(data);
		const found = await resolveByNameAndPasscode(name, passcode);
		if (!found.player) {
			// 409, not 404: the save is on disk and unreadable. A 404 sends the player
			// to New Game, which is exactly what must not happen here.
			if (found.unreadable) throw new GameError(tr('server.err.saveUnreadable'), 409, 'server.err.saveUnreadable');
			if (found.nameSeen) throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
			throw new GameError(tr('server.err.noSaveTryNew'), 404, 'server.err.noSaveTryNew');
		}
		const player = found.player;
		const d = await defs();
		// Reset the heartbeat clock so the first beat after login is counted as a
		// fresh play session (and back-fill metrics for saves made before tracking).
		// lastSeenAt is deliberately NOT bumped here — the first heartbeat reads it
		// to measure the absence for the welcome-back growth summary, then updates it.
		const now = Date.now();
		const playerId = player.id;
		const prev = readMetrics(player) || freshMetrics(player.createdAt || now);
		await patchPlayer(playerId, {
			metrics: encodeMetrics({ ...prev, lastHeartbeatAt: 0 }),
			...(tzOffsetMinutes != null ? { tzOffsetMinutes: sanitizeTzOffset(tzOffsetMinutes) } : {}),
		});
		// Back-fill the solo "world of one" for saves made before multiplayer (this
		// also realigns the meadow to the current camp offset), then resume whichever
		// world this player was last active in (their solo world by default, or a
		// co-op world they had joined — this is how you log back in to co-op).
		// Guarded so a not-yet-migrated instance still logs you in (solo) rather than erroring.
		let active = player.worldId || playerId;
		try {
			await ensureSoloWorld(player);
			active = (await safeGet(db().Player, playerId))?.worldId || playerId;
			await repairSave(active, playerId, d, { force: true });
		} catch (e) {
			console.error('world setup skipped (LoginPlayer):', e);
		}
		// On login, start back out in the meadow rather than loading straight into an
		// interior or a no-longer-explorable area. Done AFTER the meadow realignment
		// above so a returning player lands on the current spawn, never a shifted one.
		const areaBiome = d.biome.get(player.area);
		if (player.area === 'home' || !areaBiome || !areaBiome.explorable) {
			await patchPlayer(playerId, { area: 'meadow', x: 24.5, y: 6.5 });
		}
		// COMPAT: `worldId` and `worlds` are dead fields a 0.2.x client still reads.
		return { ok: true, playerId, worldId: active, worlds: [], state: await snapshot(playerId) };
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

/**
 * COMPAT: `MyWorlds` outlives co-op.
 *
 * Deleting it looked safe — co-op is behind a false flag — but `api.myWorlds()`
 * is called UNGATED in three core solo paths (startNewSolo, resumeSolo,
 * continueLast). In continueLast the catch rethrows, and `isMissingSaveError` is
 * `status === 404`, so a missing endpoint would break the Continue button AND
 * call `forgetSave()`, dropping the player's save pointer. The solo backend
 * returns 404 for an unknown endpoint too, so desktop would break the same way.
 *
 * So it stays, answering the only shape the client reads: one solo world, which
 * is the player themselves. Remove in Phase 4, together with the client calls —
 * gated on /MetricsSummary/ showing no clients below 0.3.0 for 30 days.
 */
export class MyWorlds extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);
		return { ok: true, activeWorldId: player.id, worlds: [] };
	}
}

/** POST /CollectResource/ {playerId, biomeId, nodeId, resourceId} */
export class CollectResource extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId, nodeId, resourceId } = await bodyOf(data);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const biome = d.biome.get(biomeId);
			if (!biome)
				throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }), 400, 'server.err.unknownBiome');
			if (!(player.unlockedBiomes || []).includes(biomeId))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			const resDef = d.resource.get(resourceId);
			if (!resDef)
				throw new GameError(
					tr('server.err.unknownResource', { resource: resourceId }),
					400,
					'server.err.unknownResource',
				);
			// Weather-gated resources sidestep the biome resource list, but the matching
			// weather must actually be active in this biome right now (recomputed from the
			// same deterministic function the client used to spawn the node).
			if (isWeatherGatheredResource(resourceId)) {
				// Weather-gated: the resource must be the one this biome's weather yields,
				// recomputed here rather than trusted from the client.
				//
				// The catch is that the two sides SAMPLE the same deterministic function from
				// clocks that tick differently. The client's advances smoothly on wall time, so
				// it crosses a weather boundary the moment it happens and immediately draws the
				// node. This one runs off accrued play time, which only moves in 30s heartbeat
				// steps (and trails further after a hidden tab, capped at MAX_BEAT_MS). So for
				// up to a beat after rain starts, the player is standing in visible rain beside
				// a rainwater node and getting told it "only appears in certain weather".
				//
				// Being strict here protects nothing: weather is deterministic and public, a
				// block is 12 minutes wide, and the grace can only ever admit a resource the
				// player is about to be — or just was — legitimately able to gather. So accept
				// the gather if it matches anywhere in the window the clocks can disagree over.
				// Sampling the two edges as well as the middle is enough because the grace is
				// far smaller than a block, so any boundary inside it falls between two samples.
				//
				// A dev weather override has to gate the same way, for the same reason. It is
				// stored on the player and forces the type for EVERY biome in the snapshot
				// (see weatherSnapshot), which is what the client draws its sky and its gather
				// nodes from. Recomputing the live sky here instead meant "set weather: rain"
				// produced falling rain and rainwater nodes that then refused to be picked up —
				// the override was honoured everywhere except the one check that mattered.
				const forced = player?.devWeather?.type || null;
				const base = weatherTimeFromPlay(player);
				const matches = forced
					? gatherResourceIdFor(biomeId, forced) === resourceId
					: [base - MAX_BEAT_MS, base, base + MAX_BEAT_MS].some(
							(at) => gatherResourceIdFor(biomeId, weatherTypeAt(wid, biomeId, Math.max(0, at))) === resourceId,
						);
				if (!matches) {
					throw new GameError(tr('server.err.weatherOnly', { resource: resDef.name }), 409, 'server.err.weatherOnly');
				}
			} else if (!(biome.resources || []).includes(resourceId)) {
				throw new GameError(
					tr('server.err.resourceNotInBiome', { resource: resourceId, biome: biome.name }),
					400,
					'server.err.resourceNotInBiome',
				);
			}
			// Shape-check, not just presence. This string goes straight into a primary
			// key (`${wid}:${biomeId}:${nodeId}`) and the row is never deleted, so an
			// unvalidated value is a client-controlled, permanent key in this world's
			// range — the same hazard the menu-metrics allowlist exists to prevent
			// ("the key space of a stored map should never be whatever a client decides
			// to send"), except here it also inflates every byWorld(NodeState) read the
			// snapshot makes, forever. computeNodes mints `n0…nN`, so the real client
			// is comfortably inside this; a colon is excluded outright because it is
			// the key delimiter the whole scoping contract rests on.
			if (!nodeId || typeof nodeId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(nodeId))
				throw new GameError(tr('server.err.nodeIdRequired'), 400, 'server.err.nodeIdRequired');

			// node regeneration cooldown — shared across the world so two players can't
			// both drain the same spot
			const nodeKey = `${wid}:${biomeId}:${nodeId}`;
			const nodeState = await t.NodeState.get(nodeKey);
			const now = Date.now();
			if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1000) {
				throw new GameError(tr('server.err.regrowing'), 409, 'server.err.regrowing');
			}

			// carrying capacity (gathering basket)
			const capacity = inventoryCapacity(player);
			const carried = sumValues(player.inventory);
			if (carried >= capacity) throw new GameError(tr('server.err.basketFullStore'), 409, 'server.err.basketFullStore');

			// a higher-tier tool gathers more at once (tier 1→1 … tier 4→4)
			const toolTier = player.tools?.[resDef.tool] || 1;
			const amount = Math.min(Math.max(1, toolTier), capacity - carried);

			// House perk (Log Cabin — forager's instinct): a chance to spot one extra
			// material on every gather. The chance grows with every home upgrade.
			const perk = homePerk(player);
			const perkBonus =
				perk?.id === 'forage' && capacity - carried - amount > 0 && Math.random() < perk.strength ? 1 : 0;
			const total = amount + perkBonus;

			const inventory = { ...(player.inventory || {}) };
			inventory[resourceId] = (inventory[resourceId] || 0) + total;
			await patchPlayer(playerId, { inventory });
			await t.NodeState.put({ id: nodeKey, worldId: wid, playerId, harvestedAt: now });

			// `gathered:<id>` is the LIFETIME tally for that resource, next to the
			// per-day `res:<id>` counter. The starter chain's opening goal reads it so
			// "gather 10 seeds" measures what you have gathered, not what you are still
			// holding: seeds get spent on the very next goal, and a counter that falls
			// back to 4/10 because you planted something is telling the player their
			// work was undone. META-prefixed, so it doesn't double-count against
			// resourcesCollected in the action totals.
			await bumpMetrics(
				player,
				{ resourcesCollected: total, [`gathered:${resourceId}`]: total },
				{ [`res:${resourceId}`]: total },
			);
			await awardAchievements(playerId);
			return {
				ok: true,
				gained: { [resourceId]: total },
				// Named explicitly so the client's optimistic patch knows WHICH resource
				// this pickup was, without inferring it from the gained map — that's how
				// it credits a gather-counting goal on the same frame (actionPatch.ts).
				resourceId,
				perkBonus: perkBonus || undefined,
				inventory,
				nodeId,
				harvestedAt: now,
			};
		});
	}
}

/** POST /ChestTransfer/ {playerId, chestId, resourceId, qty, direction: 'deposit'|'withdraw'} */
export class ChestTransfer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const amount = posInt(qty, 'qty');
			const chest = await getOwnedChest(t, d, chestId, wid);
			if (!chest) throw new GameError(tr('server.err.chestNotFound'), 404, 'server.err.chestNotFound');

			const inventory = { ...(player.inventory || {}) };
			const contents = { ...(chest.contents || {}) };

			if (direction === 'deposit') {
				if ((inventory[resourceId] || 0) < amount)
					throw new GameError(
						tr('server.err.notEnoughInBasket', { resource: resourceId }),
						400,
						'server.err.notEnoughInBasket',
					);
				if (sumValues(contents) + amount > chest.capacity)
					throw new GameError(tr('server.err.chestFull'), 409, 'server.err.chestFull');
				inventory[resourceId] -= amount;
				if (inventory[resourceId] <= 0) delete inventory[resourceId];
				contents[resourceId] = (contents[resourceId] || 0) + amount;
			} else if (direction === 'withdraw') {
				if ((contents[resourceId] || 0) < amount)
					throw new GameError(
						tr('server.err.notEnoughInChest', { resource: resourceId }),
						400,
						'server.err.notEnoughInChest',
					);
				if (sumValues(inventory) + amount > inventoryCapacity(player))
					throw new GameError(tr('server.err.basketFull'), 409, 'server.err.basketFull');
				contents[resourceId] -= amount;
				if (contents[resourceId] <= 0) delete contents[resourceId];
				inventory[resourceId] = (inventory[resourceId] || 0) + amount;
			} else {
				throw new GameError(tr('server.err.badDirection'), 400, 'server.err.badDirection');
			}

			await patchPlayer(playerId, { inventory });
			await t.Chest.patch(chestId, { contents });
			await bumpMetrics(player, direction === 'deposit' ? { chestDeposits: 1 } : { chestWithdrawals: 1 });
			return { ok: true, inventory, chest: { ...chest, contents } };
		});
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
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const amount = posInt(qty, 'qty');
			if (!id || typeof id !== 'string') throw new GameError(tr('server.err.idRequired'), 400, 'server.err.idRequired');

			if (kind === 'crafted') {
				const craftedItems = { ...(player.craftedItems || {}) };
				if ((craftedItems[id] || 0) < amount)
					throw new GameError(tr('server.err.discardTooMany'), 400, 'server.err.discardTooMany');
				craftedItems[id] -= amount;
				if (craftedItems[id] <= 0) delete craftedItems[id];
				await patchPlayer(playerId, { craftedItems });
				await bumpMetrics(player, { itemsDiscarded: amount });
				return { ok: true, craftedItems };
			}

			const inventory = { ...(player.inventory || {}) };
			if ((inventory[id] || 0) < amount)
				throw new GameError(tr('server.err.discardTooMany'), 400, 'server.err.discardTooMany');
			inventory[id] -= amount;
			if (inventory[id] <= 0) delete inventory[id];
			await patchPlayer(playerId, { inventory });
			await bumpMetrics(player, { itemsDiscarded: amount });
			return { ok: true, inventory };
		});
	}
}

/** POST /CraftItem/ {playerId, recipeId} — uses inventory + all of the player's chests. */
export class CraftItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, recipeId } = await bodyOf(data);
		// Read-modify-write on the player row — see withPlayerLock. Without this a
		// double-click either loses one craft's output or pays for one and makes two.
		return withPlayerLock(playerId, () => this.craft(playerId, recipeId));
	}

	private async craft(playerId: string, recipeId: string) {
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const recipe = d.recipe.get(recipeId);
		if (!recipe)
			throw new GameError(tr('server.err.unknownRecipe', { recipe: recipeId }), 400, 'server.err.unknownRecipe');
		// Plantable objects can only be planted in a watered bed, never crafted.
		const outObj = d.object.get(recipe.output.itemId);
		if (outObj?.plantable) {
			throw new GameError(
				tr('server.err.plantedNotCrafted', { name: recipe.name }),
				400,
				'server.err.plantedNotCrafted',
			);
		}
		// Dev override (dev save only): skip the biome + progress gates entirely.
		// House-only furniture can't be crafted until your home's Space is upgraded.
		if (!player.devUnlockAll && outObj?.homeMin && (homeOf(player).space || 1) < outObj.homeMin) {
			throw new GameError(tr('server.err.needsProperHouse', { name: recipe.name }), 403, 'server.err.needsProperHouse');
		}
		const devUnlock = !!player.devUnlockAll;
		if (!devUnlock && recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
			throw new GameError(tr('server.err.recipeBiomeLocked'), 403, 'server.err.recipeBiomeLocked');
		}
		// Progress gate: most recipes only unlock once you've restored their biome
		// far enough (health / animals returned / a keystone animal back).
		if (!devUnlock && recipe.unlock && recipe.unlockBiome) {
			const ctx = await recipeUnlockContext(wid, recipe.unlockBiome, player, d, recipe.unlock);
			if (!recipeUnlockMet(recipe, ctx)) {
				throw new GameError(
					tr('server.err.recipeLocked', { label: recipe.unlock.label }),
					403,
					'server.err.recipeLocked',
				);
			}
		}
		if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
			const tool = d.tool.get(recipe.requiresTool.id);
			throw new GameError(
				tr('server.err.requiresUpgradedTool', { tool: tool?.name || recipe.requiresTool.id }),
				403,
				'server.err.requiresUpgradedTool',
			);
		}
		// One-time recipes (restoration kits) can only ever be crafted once.
		if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
			throw new GameError(tr('server.err.craftOnce', { name: recipe.name }), 409, 'server.err.craftOnce');
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
		await patchPlayer(playerId, refund ? { craftedItems, craftedEver, inventory } : { craftedItems, craftedEver });

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
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const def = d.object.get(objectId);
			if (!def)
				throw new GameError(tr('server.err.unknownObject', { object: objectId }), 400, 'server.err.unknownObject');
			if (def.placement === 'none')
				throw new GameError(tr('server.err.kitNotPlaceable', { name: def.name }), 400, 'server.err.kitNotPlaceable');
			if ((player.craftedItems?.[objectId] || 0) <= 0)
				throw new GameError(tr('server.err.noneCrafted', { name: def.name }), 400, 'server.err.noneCrafted');

			const tx = Math.round(Number(x));
			const ty = Math.round(Number(y));
			const grid = areaGrid(d, area);
			if (
				!Number.isFinite(tx) ||
				!Number.isFinite(ty) ||
				tx < 1 ||
				ty < 1 ||
				tx > grid.cols - 2 ||
				ty > grid.rows - 2
			) {
				throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
			}

			const tentBiome = tentBiomeOf(area);
			if (area === 'home') {
				// decorating your home interior — indoor or 'both' items, on the floor only
				if (def.placement === 'outdoor')
					throw new GameError(tr('server.err.outdoorOnly', { name: def.name }), 400, 'server.err.outdoorOnly');
				// some furniture needs a real house, not the starter tent
				if (def.homeMin && (homeOf(player).space || 1) < def.homeMin) {
					throw new GameError(tr('server.err.needsBiggerHome', { name: def.name }), 403, 'server.err.needsBiggerHome');
				}
				const r = homeRoom(player);
				if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1)
					throw new GameError(tr('server.err.placeOnFloor'), 400, 'server.err.placeOnFloor');
				if (blocksDoorway(objectId, r, tx, ty))
					throw new GameError(tr('server.err.bedBlocksDoor', { name: def.name }), 400, 'server.err.bedBlocksDoor');
			} else if (tentBiome) {
				// decorating a trail-tent interior — indoor rules, tent-sized floor,
				// and only furniture that fits a tent (homeMin 1)
				const biome = d.biome.get(tentBiome);
				if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
				if (!(player.unlockedBiomes || []).includes(tentBiome))
					throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
				if (def.placement === 'outdoor')
					throw new GameError(tr('server.err.outdoorOnly', { name: def.name }), 400, 'server.err.outdoorOnly');
				if (def.homeMin && def.homeMin > 1)
					throw new GameError(tr('server.err.tentTooSmall', { name: def.name }), 403, 'server.err.tentTooSmall');
				const r = tentRoom();
				if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1)
					throw new GameError(tr('server.err.placeOnFloor'), 400, 'server.err.placeOnFloor');
				if (blocksDoorway(objectId, r, tx, ty))
					throw new GameError(tr('server.err.bedBlocksDoor', { name: def.name }), 400, 'server.err.bedBlocksDoor');
			} else {
				const biome = d.biome.get(area);
				if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
				if (!(player.unlockedBiomes || []).includes(area))
					throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
				if (def.placement === 'indoor')
					throw new GameError(tr('server.err.indoorOnly', { name: def.name }), 400, 'server.err.indoorOnly');
				if (!(def.biomes || []).includes(area))
					throw new GameError(
						tr('server.err.wrongHabitat', { name: def.name, biome: biome.name }),
						400,
						'server.err.wrongHabitat',
					);
				// nothing builds on the open ocean — coastal land ends before the reserved ocean columns
				if (biome.oceanCols && tx >= grid.cols - biome.oceanCols)
					throw new GameError(tr('server.err.openOcean'), 409, 'server.err.openOcean');
			}
			if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
				throw new GameError(
					tr('server.err.placeRequiresTool', {
						name: def.name,
						tool: d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id,
					}),
					403,
					'server.err.placeRequiresTool',
				);
			}

			const placements = await byWorld(t.Placement, wid);
			if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
				throw new GameError(tr('server.err.spotTaken'), 409, 'server.err.spotTaken');
			}
			// Some structures are one-per-biome (e.g. the trail tent — a single shared
			// home base in each wild biome, not a tent city). World-scoped, because
			// each tent opens into one shared interior per biome (like the home).
			if (def.onePerArea && placements.some((p) => p.area === area && p.objectId === objectId)) {
				throw new GameError(tr('server.err.onePerArea', { name: def.name }), 409, 'server.err.onePerArea');
			}
			// terrain/water rules only apply outdoors — interiors have no terrain
			const indoors = area === 'home' || !!tentBiome;
			const tileHere = indoors ? null : await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
			if (tileHere) {
				if (tileHere.type === 'water') {
					if (!def.bridge) throw new GameError(tr('server.err.openWaterBridge'), 409, 'server.err.openWaterBridge');
				} else {
					throw new GameError(tr('server.err.bedForPlanting'), 409, 'server.err.bedForPlanting');
				}
			} else if (def.bridge && !indoors) {
				throw new GameError(tr('server.err.bridgeNeedsWater'), 409, 'server.err.bridgeNeedsWater');
			}

			const craftedItems = { ...(player.craftedItems || {}) };
			craftedItems[objectId] -= 1;
			if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
			await patchPlayer(playerId, { craftedItems });

			const placementId = `${wid}:pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
			await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 }); // recalcBiome counts any animal that returned
			await awardWorldAchievements(wid, playerId, {
				addDiscoveries: recalc.newAnimals,
				freshBiomeStates: [recalc.biomeState],
			});
			return { ok: true, placement, craftedItems, ...recalc };
		});
	}
}

/**
 * POST /Plant/ {playerId, area, x, y, plantId}
 * Sow flowers and trees directly into a watered soil bed. The bed is consumed
 * and becomes a growing plant (a placement with a plantedAt timestamp).
 */
export class Plant extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		// Read-modify-write on the player row, exactly like CraftItem: consumeMaterials
		// checks the seed is affordable, then debits the player and any chests it drew
		// from in separate awaits. Unlocked, a double-click on "plant" could pass the
		// affordability check twice against the same inventory and plant two seeds for
		// the price of one.
		return withPlayerLock(playerId, () => this.plant(data));
	}

	private async plant(data: any) {
		const { playerId, area, x, y, plantId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
		if (!(player.unlockedBiomes || []).includes(area))
			throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');

		const def = d.object.get(plantId);
		if (!def || !def.plantable) throw new GameError(tr('server.err.notPlantable'), 400, 'server.err.notPlantable');
		if (!(def.biomes || []).includes(area))
			throw new GameError(
				tr('server.err.wouldNotTakeRoot', { name: def.name, biome: biome.name }),
				400,
				'server.err.wouldNotTakeRoot',
			);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const bed = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
		if (!bed || bed.type !== 'watered') {
			throw new GameError(tr('server.err.plantIntoWatered'), 400, 'server.err.plantIntoWatered');
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
		const placementId = `${wid}:pl_${now}_${Math.random().toString(36).slice(2, 8)}`;
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
		await bumpMetrics(player, { plantsPlanted: 1 }, { plant: 1 }); // recalcBiome counts any animal that returned
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
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const now = Date.now();

			const placement = (await byWorld(t.Placement, wid)).find((p) => p.id === placementId);
			if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
			const def = d.object.get(placement.objectId);
			const y = def?.yield;
			if (!y) throw new GameError(tr('server.err.notHarvestable'), 400, 'server.err.notHarvestable');
			const readyAt = harvestReadyAt(def, placement);
			if (readyAt == null || now < readyAt)
				throw new GameError(tr('server.err.notReadyYet'), 400, 'server.err.notReadyYet');

			// grant the yield, respecting carrying capacity
			const capacity = inventoryCapacity(player);
			const inventory = { ...(player.inventory || {}) };
			const room = Math.max(0, capacity - sumValues(inventory));
			const take = Math.min(y.qty || 1, room);
			if (take <= 0) throw new GameError(tr('server.err.basketFullHarvest'), 409, 'server.err.basketFullHarvest');
			inventory[y.resourceId] = (inventory[y.resourceId] || 0) + take;

			await patchPlayer(playerId, { inventory });
			await t.Placement.patch(placementId, { lastHarvestAt: now });
			await bumpMetrics(player, { resourcesCollected: take });
			return {
				ok: true,
				placementId,
				gained: { [y.resourceId]: take },
				inventory,
				placement: { ...placement, lastHarvestAt: now },
			};
		});
	}
}

/** POST /UpdateAppearance/ {playerId, appearance} — restyle your caretaker anytime. */
export class UpdateAppearance extends PublicEndpoint {
	async post(data: any) {
		const { playerId, appearance } = await bodyOf(data);
		const { player } = await requirePlayer(playerId);
		const clean = sanitizeAppearance(appearance);
		await patchPlayer(playerId, { appearance: clean });
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
		if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
		if (placement.objectId === 'workbench')
			throw new GameError(tr('server.err.workbenchStays'), 400, 'server.err.workbenchStays');

		const dGrid = await defs();
		const grid = areaGrid(dGrid, placement.area);
		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
		}
		if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
			throw new GameError(tr('server.err.spotTaken'), 409, 'server.err.spotTaken');
		}
		const d = await defs();
		const movingDef = d.object.get(placement.objectId);
		// Same doorway rule as PlaceObject — otherwise a bed could simply be MOVED
		// into the spot it isn't allowed to be placed in.
		if (SLEEPABLE_OBJECTS.has(placement.objectId)) {
			const tentBiome = tentBiomeOf(placement.area);
			const room = placement.area === 'home' ? homeRoom(player) : tentBiome ? tentRoom() : null;
			if (room && blocksDoorway(placement.objectId, room, tx, ty)) {
				throw new GameError(
					tr('server.err.bedBlocksDoor', { name: movingDef?.name || placement.objectId }),
					400,
					'server.err.bedBlocksDoor',
				);
			}
		}
		const tileHere = await findTerrainAt(t.TerrainTile, wid, placement.area, tx, ty);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!movingDef?.bridge)
					throw new GameError(tr('server.err.openWaterBridgeOnly'), 409, 'server.err.openWaterBridgeOnly');
			} else {
				throw new GameError(tr('server.err.bedForPlantingShort'), 409, 'server.err.bedForPlantingShort');
			}
		} else if (movingDef?.bridge) {
			throw new GameError(tr('server.err.bridgesOverWater'), 409, 'server.err.bridgesOverWater');
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
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const placement = await findInWorld(t.Placement, wid, placementId);
			if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
			if (placement.objectId === 'workbench') {
				throw new GameError(tr('server.err.workbenchStays'), 400, 'server.err.workbenchStays');
			}

			const chest = await findInWorld(t.Chest, wid, placementId);
			if (chest && sumValues(chest.contents) > 0) {
				throw new GameError(tr('server.err.emptyChestFirst'), 409, 'server.err.emptyChestFirst');
			}

			// A trail tent can't be packed up while furniture is still inside its
			// interior — pack up in there first (mirrors the chest-must-be-empty rule).
			if (placement.objectId === 'trail-tent') {
				const interior = `tent-${placement.area}`;
				const inside = (await byWorld(t.Placement, wid)).some((p) => p.area === interior);
				if (inside) throw new GameError(tr('server.err.tentNotEmpty'), 409, 'server.err.tentNotEmpty');
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
						throw new GameError(tr('server.err.noRoomRefund'), 409, 'server.err.noRoomRefund');
					}
				}
			} else {
				craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
			}

			// all checks passed — now write
			if (chest) await t.Chest.delete(placementId);
			await t.Placement.delete(placementId);
			if (refunded) {
				await patchPlayer(playerId, { inventory });
				for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
			} else {
				await patchPlayer(playerId, { craftedItems });
			}

			// interiors (home / tent) aren't biomes — skip recalc for their decor
			const recalc =
				placement.area !== 'home' && !tentBiomeOf(placement.area)
					? await recalcBiome(wid, playerId, placement.area, {
							removeIds: [placementId],
							player: { ...player, craftedItems, inventory },
						})
					: null;
			await bumpMetrics(player, { objectsRemoved: 1 }); // recalcBiome counts any animal that returned
			await awardWorldAchievements(
				wid,
				playerId,
				recalc ? { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] } : {},
			);
			return { ok: true, removed: placementId, craftedItems, refunded, ...(recalc || {}) };
		});
	}
}

/** POST /UpgradeTool/ {playerId, toolId} */
export class UpgradeTool extends PublicEndpoint {
	async post(data: any) {
		const { playerId, toolId } = await bodyOf(data);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);

			const toolDef = d.tool.get(toolId);
			if (!toolDef) throw new GameError(tr('server.err.unknownTool', { tool: toolId }), 400, 'server.err.unknownTool');
			const wid = worldOf(player);
			const currentTier = player.tools?.[toolId] || 1;
			const nextTier = (toolDef.tiers || []).find((tt: any) => tt.tier === currentTier + 1);
			if (!nextTier)
				throw new GameError(tr('server.err.toolMaxed', { tool: toolDef.name }), 400, 'server.err.toolMaxed');

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
						'server.err.restoreFirst',
					);
				}
			}

			const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {}, wid);
			const tools = { ...(player.tools || {}), [toolId]: nextTier.tier };
			await patchPlayer(playerId, { tools });

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
		});
	}
}

/** POST /UpgradeHome/ {playerId, track} — level up one of the four home tracks. */
export class UpgradeHome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, track } = await bodyOf(data);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const def = HOME_TRACKS[track];
			if (!def) throw new GameError(tr('server.err.unknownHomeUpgrade'), 400, 'server.err.unknownHomeUpgrade');
			const home = homeOf(player);
			if (!home.styleLocked) throw new GameError(tr('server.err.buildStyleFirst'), 403, 'server.err.buildStyleFirst');
			const level = home[track] || 1;
			const next = def.levels[level]; // levels[level] is the (level+1)th entry
			if (!next)
				throw new GameError(
					tr('server.err.trackMaxed', { track: def.name.toLowerCase() }),
					400,
					'server.err.trackMaxed',
				);

			if (next.requires?.biome) {
				const bs = await findBiomeState(t.BiomeState, wid, next.requires.biome);
				if ((bs?.health || 0) < (next.requires.minHealth || 0)) {
					const d = await defs();
					const biome = d.biome.get(next.requires.biome);
					throw new GameError(
						tr('server.err.restoreFirst', {
							biome: biome?.name || next.requires.biome,
							health: next.requires.minHealth,
						}),
						403,
						'server.err.restoreFirst',
					);
				}
			}

			const { usedFrom, inventory } = await consumeMaterials(player, next.materials || {}, wid);
			const updated = { ...home, [track]: level + 1 };
			await patchPlayer(playerId, { home: updated });
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
		});
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
			throw new GameError(tr('server.err.needBedToRest'), 403, 'server.err.needBedToRest');
		}
		// refresh all resources: clear node cooldowns so every gathering spot is ready
		const nodes = await byWorld(t.NodeState, wid);
		for (const n of nodes) await t.NodeState.delete(n.id);
		// Sleep through to sunrise: advance the in-game clock to the next dawn (first
		// light), not raw day-start — the day now begins mid-night, so day-start
		// would wake you at 00:00 in the dark.
		const nowT = weatherTimeFromPlay(player);
		const skip = nextDawnAt(nowT) - nowT;
		await patchPlayer(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
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
		if (!home.styleLocked)
			throw new GameError(tr('server.err.buildBeforeRepaint'), 403, 'server.err.buildBeforeRepaint');
		const next: Record<string, string> = { ...home.colors };
		for (const k of ['floor', 'wall', 'accent', 'rug']) {
			if (colors?.[k] && isHexColor(colors[k])) next[k] = String(colors[k]).trim().toLowerCase();
		}
		await patchPlayer(playerId, { home: { ...home, colors: next } });
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
		if (!(homeOf(player) as any).styleLocked)
			throw new GameError(tr('server.err.buildBeforeRepaintThings'), 403, 'server.err.buildBeforeRepaintThings');
		if (!isHexColor(color)) throw new GameError(tr('server.err.invalidColor'), 400, 'server.err.invalidColor');
		const placement = await findInWorld(t.Placement, worldOf(player), placementId);
		if (!placement) throw new GameError(tr('server.err.itemNotHere'), 404, 'server.err.itemNotHere');
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
		const { playerId } = await bodyOf(data);
		// Same read-modify-write as Plant/CraftItem — this spends materials through
		// consumeMaterials. The `styleLocked` check above is itself part of the
		// race: two concurrent requests can both read an unlocked home, both pass,
		// and both pay.
		return withPlayerLock(playerId, () => this.setStyle(data));
	}

	private async setStyle(data: any) {
		const { playerId, style } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const styleDef = HOME_STYLES[style];
		if (!styleDef) throw new GameError(tr('server.err.unknownHomeStyle'), 400, 'server.err.unknownHomeStyle');
		const home = homeOf(player);
		if (home.styleLocked) throw new GameError(tr('server.err.homeAlreadyBuilt'), 403, 'server.err.homeAlreadyBuilt');
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
					'server.err.restoreFirst',
				);
			}
		}
		const { usedFrom, inventory } = await consumeMaterials(player, styleDef.materials || {}, wid);
		const updated = { ...home, style, styleLocked: true, space: 2 };
		await patchPlayer(playerId, { home: updated });
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
		if (!disc) throw new GameError(tr('server.err.animalNotReturned'), 404, 'server.err.animalNotReturned');
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
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const now = Date.now();

			// Terrain rides along because the starter chain's stream goal is measured
			// from it, and this board is the one a claim is validated against — read it
			// here or "Dig a stream" would compute 0/3 and refuse a finished goal. It's
			// one extra read on a claim, which happens a handful of times per save,
			// not on every GameState.
			const [discoveries, biomeStates, placements, chests, terrain] = await Promise.all([
				byWorld(t.Discovery, wid),
				byWorld(t.BiomeState, wid),
				byWorld(t.Placement, wid),
				byWorld(t.Chest, wid),
				byWorld(t.TerrainTile, wid),
			]);
			const block = dailyTasksBlock({
				wid,
				player,
				d,
				discoveries,
				biomeStates,
				placements,
				chests,
				terrain,
				now,
				unlockedBiomes: player.unlockedBiomes,
			});
			const task = block.tasks.find((x: any) => x.id === String(taskId || ''));
			if (!task) throw new GameError(tr('server.err.taskNotOnBoard'), 404, 'server.err.taskNotOnBoard');
			if (task.pinned) throw new GameError(tr('server.err.taskNotClaimable'), 409, 'server.err.taskNotClaimable'); // guidance goals aren't claimed
			if (task.claimed) throw new GameError(tr('server.err.taskAlreadyClaimed'), 409, 'server.err.taskAlreadyClaimed');
			if (task.progress < task.target)
				throw new GameError(tr('server.err.taskNotFinished'), 409, 'server.err.taskNotFinished');

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
			if (!Object.keys(gained).length)
				throw new GameError(tr('server.err.basketFullReward'), 409, 'server.err.basketFullReward');

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
			await patchPlayer(playerId, patch);
			await bumpMetrics(player, { tasksCompleted: 1 });
			await awardAchievements(playerId);

			// Return the board AS IT IS NOW — recomputed against the patched player, so
			// the claimed goal is gone and the next link of the starter chain is
			// already on it. The response used to carry the pre-claim board with the
			// finished goal flagged `claimed`, which meant the new goal only appeared
			// after the client's follow-up GameState fetch: claim, then a beat of
			// nothing, then the board moves. The player reads that pause as the game
			// not having noticed.
			const dailyTasks = dailyTasksBlock({
				wid,
				player: { ...player, ...patch },
				d,
				discoveries,
				biomeStates,
				placements,
				chests,
				terrain,
				now,
				unlockedBiomes: player.unlockedBiomes,
			});
			return { ok: true, taskId: task.id, text: task.text, gained, inventory, dailyTasks };
		});
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
		// Count goals the player AUTHORED, not goals they hold. The list is the wrong
		// thing to measure: a finished goal is deleted from it on claim, so someone
		// who set six and finished six looks identical to someone who never set any.
		// This counter is the only durable trace of "picked the board up as a tool",
		// which is the question the starter chain exists to move (see
		// starterChainMetrics). META, so it doesn't inflate the action totals.
		const added = keep.filter((g) => !prev.has(g.id)).length;
		await patchPlayer(playerId, { customGoals: keep });
		if (added) await bumpMetrics(player, { goalsCreated: added });
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
		const { playerId, area, x, y, action, expect } = await bodyOf(data);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.terraformOutdoors'), 400, 'server.err.terraformOutdoors');
			if (!(player.unlockedBiomes || []).includes(area))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');

			const tx = Math.round(Number(x));
			const ty = Math.round(Number(y));
			const grid = areaGrid(d, area);
			if (
				!Number.isFinite(tx) ||
				!Number.isFinite(ty) ||
				tx < 1 ||
				ty < 1 ||
				tx > grid.cols - 2 ||
				ty > grid.rows - 2
			) {
				throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
			}
			const placements = await byWorld(t.Placement, wid);
			if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
				throw new GameError(tr('server.err.somethingPlaced'), 400, 'server.err.somethingPlaced');
			}

			const tileId = `${wid}:${area}:${tx}:${ty}`;
			// Match by position, not id: legacy beds carry an old id but must still be
			// recognized here (see findTerrainAt). A freshly dug bed uses `tileId`.
			const existing = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);

			// Compare-and-swap on the tile's type.
			//
			// Watering ESCALATES — bare ground is dug into a bed, a bed is watered, a
			// watered bed floods into open water — and the client decides which of
			// those a click means from its own copy of the tile. That copy doesn't
			// change until the round trip lands, so on a slow connection a player who
			// waters a bed, sees nothing, and clicks again sends a second "water" that
			// was decided against 'tilled' but arrives at a tile that is now 'watered'.
			// The server obligingly floods it, and the bed they were tending becomes a
			// pond. Same shape of accident for a shovel click that lands after the
			// ground it was aimed at has already been dug.
			//
			// So the client now says what it believed the tile was, and a command aimed
			// at ground that has become something else is refused instead of applied to
			// whatever happens to be there. `undefined` skips the check, which keeps
			// older clients (and the integration suites' direct posts) working.
			if (expect !== undefined) {
				const actual = existing?.type ?? null;
				if ((expect ?? null) !== actual) {
					// The overwhelmingly common case, and the one worth explaining: the
					// bed finished watering between the click and its arrival.
					const key =
						expect === 'tilled' && actual === 'watered' ? 'server.err.bedJustWatered' : 'server.err.groundChanged';
					throw new GameError(tr(key), 409, key);
				}
			}

			let inventory = player.inventory || {};
			let tile: any = null;
			let removedId: string | undefined;
			let dug: { resourceId: string; amount: number } | null = null;

			if (action === 'dig') {
				if ((player.tools?.shovel || 0) < 1)
					throw new GameError(tr('server.err.needShovel'), 400, 'server.err.needShovel');
				if (existing) throw new GameError(tr('server.err.alreadyPrepared'), 400, 'server.err.alreadyPrepared');
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
						await patchPlayer(playerId, { inventory });
						dug = { resourceId: resId, amount };
					}
				}
			} else if (action === 'water') {
				if ((player.tools?.['watering-can'] || 0) < 1)
					throw new GameError(tr('server.err.needWateringCan'), 400, 'server.err.needWateringCan');
				if (!existing) throw new GameError(tr('server.err.prepareBedFirst'), 400, 'server.err.prepareBedFirst');
				if (existing.type === 'water')
					throw new GameError(tr('server.err.alreadyOpenWater'), 400, 'server.err.alreadyOpenWater');
				// tilled -> watered bed, watered -> flooded open water: 1 water either way.
				// Chain open-water tiles to shape ponds, lakes, and rivers.
				const cost = 1;
				const newType = existing.type === 'tilled' ? 'watered' : 'water';
				// dry biomes (e.g. the desert) can ready soil beds but cannot be flooded
				if (newType === 'water' && biome.canFlood === false) {
					throw new GameError(tr('server.err.tooDryToFlood', { biome: biome.name }), 400, 'server.err.tooDryToFlood');
				}
				// ...and the trail gates stay walkable: water there would seal the
				// way into the next biome (see blocksGateTrail)
				if (newType === 'water' && blocksGateTrail(tx, ty, gateGeomOf(d, area))) {
					throw new GameError(tr('server.err.gateMustStayClear'), 400, 'server.err.gateMustStayClear');
				}
				const have = (inventory.water || 0) + (inventory['clean-water'] || 0);
				if (have < cost) throw new GameError(tr('server.err.needWater', { count: cost }), 400, 'server.err.needWater');
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
				await patchPlayer(playerId, { inventory });
				tile = { ...existing, type: newType, updatedAt: Date.now() };
				await t.TerrainTile.patch(existing.id, { type: newType, updatedAt: Date.now() });
			} else if (action === 'clear') {
				if (!existing) throw new GameError(tr('server.err.nothingToClear'), 400, 'server.err.nothingToClear');
				await t.TerrainTile.delete(existing.id);
				removedId = existing.id;
			} else {
				throw new GameError(tr('server.err.badTerraformAction'), 400, 'server.err.badTerraformAction');
			}

			const recalc = await recalcBiome(wid, playerId, area, {
				addTerrain: tile ? [tile] : [],
				removeTerrainIds: removedId ? [removedId] : [],
				player: { ...player, inventory },
			});
			// recalcBiome counts any animal that returned
			// `bedsWatered` is a lifetime tally for the starter chain's watering goal.
			// It has to be a counter rather than a count of watered tiles, because
			// planting turns a watered bed into a planted one — counting live tiles
			// would make that goal's progress run backwards the moment the player
			// actually used the bed. It's in META_COUNTERS, so it doesn't double-count
			// against terraformActions in the action totals the dashboard reports.
			await bumpMetrics(
				player,
				{ terraformActions: 1, ...(action === 'water' ? { bedsWatered: 1 } : {}) },
				action === 'water' ? { water: 1 } : {},
			);
			await awardWorldAchievements(wid, playerId, {
				addDiscoveries: recalc.newAnimals,
				freshBiomeStates: [recalc.biomeState],
			});
			return { ok: true, tile, removedId, dug, inventory, ...recalc };
		});
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
		const { playerId } = await bodyOf(data);
		// Read-modify-write on two accumulating fields: `visitedBiomes` is rebuilt
		// from the row it just read, and `tutorialStep` is kept as a high-water mark.
		// Position sync fires on a timer, so it interleaves with real actions
		// constantly; unlocked, a concurrent write could drop a just-visited biome or
		// walk the tutorial backwards.
		return withPlayerLock(playerId, () => this.sync(data));
	}

	private async sync(data: any) {
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
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
			if (!(player.unlockedBiomes || []).includes(tb)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			}
			const wid = worldOf(player);
			const hasTent = (await byWorld(t.Placement, wid)).some((p) => p.area === tb && p.objectId === 'trail-tent');
			if (!hasTent) throw new GameError(tr('server.err.noTentHere'), 404, 'server.err.noTentHere');
			patch.area = area;
		} else if (area) {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
			if (!(player.unlockedBiomes || []).includes(area)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			}
			if (!biome.explorable) {
				throw new GameError(tr('server.err.notExplorable', { biome: biome.name }), 403, 'server.err.notExplorable');
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
		await patchPlayer(playerId, patch);
		// the tutorial finishing (and reaching the grasshopper step) can earn First Friend
		if (patch.tutorialStep !== undefined) await awardAchievements(playerId);
		return { ok: true, player: sanitizePlayer(await safeGet(t.Player, playerId)) };
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
		// One write for the whole batch, and the cap is applied by slicing the array
		// rather than by deleting rows — so a long-running save costs no more per
		// line than a fresh one.
		const added = await appendFeed(wid, list);
		return { ok: true, added };
	}
}

const SESSION_GAP_MS = 30 * 60 * 1000; // a fresh heartbeat after this gap = a new session
const MAX_BEAT_MS = 90 * 1000; // credit at most this much play time per beat (guards idle/closed tabs)

// --------------------------------------------------------- idle-window anomaly
// A window left open on screen still beats. Heartbeat is paused while the tab is
// hidden (see the beat() guard in src/state.tsx), but a VISIBLE tab nobody is
// sitting at looked exactly like play, and the 90s cap above only bounds each
// beat — not how many of them an abandoned window sends. One such save logged
// 798 minutes against 152 actions, which was 17% of every hour this dashboard
// had ever recorded: enough on its own to move every average on the page.
//
// The tell is the rate, not the length. A long session is normal; a long session
// with almost nothing happening in it is someone who walked away. Real players
// bottom out around 1.2 actions/min even when playing slowly, and abandoned
// windows sit at 0.0-0.3, so the floor goes between them. It only applies once a
// session is long enough for the distinction to mean anything — a two-minute
// look-and-leave is a bounce, which the acquisition funnel already counts, and
// not the same thing at all.
//
// This classifies; it never deletes. The rows keep their real numbers and the
// dashboard decides whether to count them (`?idle=exclude`).
const IDLE_MIN_MINUTES = 10;
const IDLE_MAX_ACTIONS_PER_MIN = 0.5;

// How this save's play time was recorded. 1 = every visible window beat, for as
// long as it stayed open. 2 = the client also requires input within its idle
// window (reported as `idleGateMs`) before it beats, so an abandoned window stops
// the clock on its own. Stamped on the metrics blob, surfaced per row and counted
// in the dashboard's anomalies block, so a window spanning the change reads as
// two populations rather than as a fall in engagement.
const METRICS_REV = 2;

// The menus a heartbeat may report time against — PanelId in src/types.ts, plus
// 'help' for the help overlay, which is a menu to a player even though it isn't
// a panel in the code. A fixed set on purpose: the key space of a stored map
// should never be whatever a client decides to send, and an unknown panel is
// dropped rather than allowed to open a new column in every dashboard.
const MENU_PANELS = new Set([
	'inventory',
	'crafting',
	'chest',
	'journal',
	'tools',
	'biomes',
	'achievements',
	'feed',
	'home',
	'animal',
	'settings',
	'weather',
	'materials',
	'goals',
	'help',
]);
/** At most this many opens of one menu per beat — a beat covers ~90s, so a
 *  larger number is a broken or hostile client, not a busy player. */
const MAX_MENU_OPENS_PER_BEAT = 200;

/** Did this save spend its time as an unattended window rather than as play? */
function isIdleAnomaly(row: { playSeconds?: number; totalActions?: number }): boolean {
	const minutes = (row.playSeconds || 0) / 60;
	if (minutes < IDLE_MIN_MINUTES) return false;
	return (row.totalActions || 0) / minutes < IDLE_MAX_ACTIONS_PER_MIN;
}

/**
 * POST /Heartbeat/ {playerId} — the client pings this on a timer while the game
 * is open and focused. We accrue play time from the gap since the last beat
 * (capped, so a backgrounded tab or a closed laptop never inflates the number)
 * and count a new session whenever the gap is large or it's the first beat.
 */
export class Heartbeat extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		// The heartbeat is a read-modify-write of the metrics blob, and it fires
		// every 30 s for every player whether or not they touched anything — so it
		// was both the most frequent unlocked writer in the file and the one most
		// likely to interleave with a real action. Two things follow from taking the
		// lock, and the second is the reason it matters at this scale:
		//
		//  • Correctness. `prev` is read at the top and written back at the bottom;
		//    a bumpMetrics from a concurrent gather landing in between was silently
		//    discarded, because this beat's `...prev` spread reinstates the older
		//    counts wholesale.
		//  • Write volume. Inside the lock, patchPlayer BUFFERS (see the note on
		//    pendingPlayerPatch) and flushes once at release. The beat used to write
		//    the metrics blob here, again from repairSave, and a THIRD time from
		//    recalcBiome's bumpMetrics — three separate writes of the same row, per
		//    player, per 30 s. Against the write allowance this endpoint's cost is
		//    what caps how many people can play at once, so collapsing three into
		//    one raises that ceiling directly.
		return withPlayerLock(String(playerId || ''), () => this.beat(data));
	}

	private async beat(data: any) {
		const { playerId, language, edition, idleGateMs, panel, panelOpens } = await bodyOf(data);
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
		// How long the client lets an untouched window keep beating (see
		// HEARTBEAT_IDLE_MS in src/state.tsx). A 0.2.x client doesn't send it and
		// stays on rev 1, which is exactly the point: playSeconds means something
		// slightly different either side of that line, and a dashboard averaging the
		// two together would report a drop in play time that never happened.
		const gateMs = typeof idleGateMs === 'number' && idleGateMs > 0 ? Math.round(idleGateMs) : null;
		const last = prev.lastHeartbeatAt || 0;
		const gap = now - last;

		let playSeconds = prev.playSeconds || 0;
		let sessions = prev.sessions || 0;
		let curSessionSeconds = prev.curSessionSeconds || 0;
		const areaSeconds: Record<string, number> = { ...(prev.areaSeconds || {}) };
		const menuSeconds: Record<string, number> = { ...(prev.menuSeconds || {}) };
		const menuOpens: Record<string, number> = { ...(prev.menuOpens || {}) };
		const sessionLengths: Record<string, number> = { ...(prev.sessionLengths || {}) };
		// Which menu was open at the moment of the beat, if any and if we know it.
		const openMenu = typeof panel === 'string' && MENU_PANELS.has(panel) ? panel : null;
		// Menu opens counted by the client since its last successful beat. Merged
		// here rather than sent as their own request; anything unrecognised, not a
		// positive number, or implausibly large for one beat is dropped.
		if (panelOpens && typeof panelOpens === 'object' && !Array.isArray(panelOpens)) {
			for (const [menu, raw] of Object.entries(panelOpens as Record<string, unknown>)) {
				if (!MENU_PANELS.has(menu)) continue;
				const n = Math.floor(Number(raw));
				if (!Number.isFinite(n) || n <= 0) continue;
				menuOpens[menu] = (menuOpens[menu] || 0) + Math.min(n, MAX_MENU_OPENS_PER_BEAT);
			}
		}
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
			// …and, if a menu was open, to that menu as well. Same approximation the
			// line above already makes: the whole gap goes to whatever was open when
			// the beat fired, which over many beats averages out and over one does
			// not. Overlapping, not carved out — see freshMetrics.
			if (openMenu) menuSeconds[openMenu] = round1((menuSeconds[openMenu] || 0) + credit);
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
			menuSeconds,
			menuOpens,
			sessionLengths,
			...(lang ? { language: lang } : {}),
			...(gateMs ? { metricsRev: METRICS_REV, idleGateMs: gateMs } : {}),
			// Keep 'demo' sticky: a demo player is never re-tagged 'full'.
			...(ed ? { edition: prev.edition === 'demo' ? 'demo' : ed } : {}),
		};
		await patchPlayer(playerId, { metrics: encodeMetrics(metrics) });

		// ---- habitat growth: the preserve keeps living while the game is closed ----
		// Placements mature on wall-clock time (see matureMs), but biome health is
		// only ever recomputed on actions. The heartbeat is the "time passed" action:
		//  • every beat: if any placement crossed maturity since the last beat,
		//    recalc just those biomes (a tree finishing growth mid-session counts);
		//  • first beat of a session after a real absence: recalc every unlocked
		//    biome and shape a small welcome-back summary for the client.
		const wid = worldOf(player);
		// Backstop for the one-shot save work: ensureSoloWorld covers the login
		// screen, but "Continue" resumes through GameState — a GET, which must not
		// write — so a player who never logs in again would otherwise never migrate
		// or be repaired at all. Both are marked and memoized, so every later beat
		// is a no-op.
		await migrateWorldKeys(wid, playerId);
		await repairSave(wid, playerId, d, { player });
		let welcomeBack: any = null;
		let awarded = false;
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
				// Hand over the rows this pass already read. Without this the
				// achievement pass re-read BiomeState for the same world microseconds
				// after the loop above finished with it.
				await awardWorldAchievements(wid, playerId, {
					addDiscoveries: newAnimals,
					freshBiomeStates,
					player,
					biomeStates,
				});
				awarded = true;
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

		// Session-count achievements (e.g. A Familiar Face). This ran on EVERY beat,
		// and each run costs three world scans plus an achievement read — for a
		// player who is standing still, which is most beats. Two guards, and neither
		// can lose an award:
		//
		//  • Only the first beat of a session can change a session count, so a beat
		//    that isn't one has nothing new to evaluate. Anything else an achievement
		//    keys on is driven by an ACTION, and every action already awards on its
		//    own way through.
		//  • If the growth pass above already awarded, it evaluated the same context
		//    a moment ago and there is nothing left for a second pass to find.
		if (newSession && !awarded) await awardAchievements(playerId, { player });
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
// each request apply its ?exclude filter + aggregation cheaply on top. Marked
// stale on every new uplink (SyncMetrics / AppOpen) so a player's own report
// shows up on the next read — see RollupCache for why it's marked rather than
// dropped.
const DASHBOARD_CACHE_MS = 30_000;

/**
 * Scan SoloMetrics and flatten every stored snapshot into the row shape the
 * dashboard aggregates over. The expensive half of GET /Metrics/ — everything
 * downstream of this is cheap filtering and summing over the result.
 */
async function buildDashboardRows(): Promise<any[]> {
	const now = Date.now();
	const t = db();
	let soloRows: any[] = [];
	try {
		soloRows = await allOf(t.SoloMetrics);
	} catch {
		/* SoloMetrics table not created yet — empty dashboard */
	}

	const rows = soloRows
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
				// The SAVE's own id (`<name-slug>-<random6>`, minted once by
				// CreatePlayer and carried through an export/import unchanged), kept
				// under its own name because `playerId` above deliberately overwrites
				// it with the slot-scoped one. This is the only thing that survives a
				// demo save being carried into the full game, so it is what links the
				// two rows together below.
				savePlayerId: s.playerId || null,
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
				// Menu dwell. Solo and demo saves reach the roll-up through THIS
				// projection, not through metricsView, so anything the summary reads
				// has to be lifted out of the snapshot here or it aggregates as empty
				// for the desktop audience — which is most of it.
				menuSeconds: s.menuSeconds || {},
				menuOpens: s.menuOpens || {},
				menuMeasured: !!s.menuMeasured,
				// The highlights wall sorts on this one, so it has to survive the
				// projection too — recomputed rather than defaulted to 0, because a
				// snapshot from a client that predates the field still carries the map.
				menuTotalSeconds:
					s.menuTotalSeconds ??
					Math.round(Object.values((s.menuSeconds || {}) as Record<string, number>).reduce((a, b) => a + (b || 0), 0)),
				menuTotalOpens:
					s.menuTotalOpens ??
					Object.values((s.menuOpens || {}) as Record<string, number>).reduce((a, b) => a + (b || 0), 0),
				menuMinutes: s.menuMinutes || {},
				menuShareOfPlay: s.menuShareOfPlay ?? null,
				mostUsedMenu: s.mostUsedMenu || null,
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
				// Reported on every row so the dashboard can badge one player, not just
				// drop them from a total.
				idle: isIdleAnomaly({ playSeconds: sessionSeconds, totalActions: s.totalActions || 0 }),
				// Which definition of play time this row was recorded under, so time
				// series can be split at the change instead of straddling it.
				metricsRev: s.metricsRev || 1,
				idleGateMs: s.idleGateMs ?? null,
				// Starter chain (defaulted, so snapshots uplinked before it existed
				// aggregate as "step 0" rather than NaN — they're excluded from the
				// funnel's denominator below by `starterTotal`, which only rows that
				// know about the chain carry).
				starterStep: s.starterStep || 0,
				starterTotal: s.starterTotal || 0,
				starterDone: s.starterDone === true,
				starterLegacy: s.starterLegacy === true,
				goalsCreated: s.goalsCreated || (s.counts?.goalsCreated as number) || 0,
			};
		})
		.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);

	return markDemoConversions(rows);
}

/**
 * Flag the saves that came over from the demo — the "played the demo, bought the
 * game, brought their meadow with them" milestone.
 *
 * Two ways a row can prove it, because one of them only works going forward:
 *
 *  1. `convertedFromDemoAt` — stamped by ExportDemoSave onto the copy the player
 *     downloads. Authoritative, and it survives everything: the demo row could be
 *     deleted tomorrow and the save would still know its own history.
 *
 *  2. A DEMO row sharing this row's `savePlayerId`. Importing a save mints a new
 *     slot id, so the carried-over save uplinks as a NEW SoloMetrics row while the
 *     demo's original row stays put — two rows, same save id, different editions.
 *     That pairing is what makes conversions that already happened visible, before
 *     the stamp existed. Save ids are `<name-slug>-<random6>` and minted once per
 *     save, so this is a real identity match, not a name collision.
 *
 * The demo half of a pair is marked `supersededByFull` rather than dropped. Both
 * rows are real uplinks and quietly deleting one would make the player count move
 * for reasons nothing in the response explained; the aggregate below counts the
 * pair once and says how many rows are doubled up.
 */
function markDemoConversions(rows: any[]): any[] {
	const editionOf = (r: any) => (r.edition === 'demo' ? 'demo' : 'full');
	// Newest demo row per save id — a save could have uplinked from more than one
	// demo session before it was carried over.
	const demoBySave = new Map<string, any>();
	for (const r of rows) {
		if (editionOf(r) !== 'demo' || !r.savePlayerId) continue;
		const prev = demoBySave.get(r.savePlayerId);
		if (!prev || (r.lastSeenAt || 0) > (prev.lastSeenAt || 0)) demoBySave.set(r.savePlayerId, r);
	}
	const convertedSaveIds = new Set<string>();
	for (const r of rows) {
		if (editionOf(r) !== 'full' || !r.savePlayerId) continue;
		if (r.convertedFromDemoAt || demoBySave.has(r.savePlayerId)) convertedSaveIds.add(r.savePlayerId);
	}

	return rows.map((r) => {
		if (editionOf(r) === 'demo') {
			const superseded = !!(r.savePlayerId && convertedSaveIds.has(r.savePlayerId));
			return { ...r, convertedFromDemo: false, supersededByFull: superseded };
		}
		const twin = r.savePlayerId ? demoBySave.get(r.savePlayerId) : null;
		if (!r.convertedFromDemoAt && !twin) return { ...r, convertedFromDemo: false, supersededByFull: false };
		return {
			...r,
			convertedFromDemo: true,
			supersededByFull: false,
			conversion: {
				// The stamp is exact. Without it, the demo row's last sighting is the
				// closest honest answer, so it is labelled as an estimate rather than
				// dressed up as a timestamp.
				at: r.convertedFromDemoAt || twin?.lastSeenAt || null,
				exact: !!r.convertedFromDemoAt,
				source: r.convertedFromDemoAt ? 'stamped-at-export' : 'paired-demo-save',
				// How far they got in the demo before buying. Prefers the frozen stamp;
				// falls back to whatever the demo row last reported.
				demoPlaySeconds: r.demoPlaySeconds ?? twin?.playSeconds ?? null,
				demoSessions: r.demoSessions ?? twin?.sessions ?? null,
				demoActions: r.demoActions ?? twin?.totalActions ?? null,
			},
		};
	});
}

const dashboardCache = new RollupCache<any[]>(DASHBOARD_CACHE_MS, buildDashboardRows);

/**
 * The acquisition funnel's source rows, cached on the same terms as the
 * dashboard rollup they are read alongside.
 *
 * AppOpen holds one row per install for the lifetime of the game, so the scan
 * cost tracks total installs — the largest and fastest-growing table on the
 * analytics path, and the only one that was being re-scanned per request. Sharing
 * DASHBOARD_CACHE_MS keeps the two halves of a single dashboard render coherent:
 * player rows and acquisition rows go stale together rather than one refreshing
 * under the other.
 */
const appOpenCache = new RollupCache<any[]>(DASHBOARD_CACHE_MS, async () => {
	const t = db();
	return t.AppOpen ? await allOf(t.AppOpen) : [];
});

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
 * GET /Metrics/<id> — ONE player's own metrics, computed live from that player's
 * game state. Stays public because the game client reads its own view through it
 * (src/api.ts `metrics()` → metricsUplink.ts / steamSync.ts): knowing the save's
 * UUID is the capability, exactly as it is for /GameState/<id> and every other
 * game endpoint under the MVP auth model.
 *
 * GET /Metrics/ (no id) used to return the whole analytics roll-up — the global
 * aggregates AND a row per player carrying names, first/last activity timestamps,
 * OS, accessibility preferences and behaviour — to anyone who asked for it. That
 * was the leak. The roll-up now lives behind Harper admin auth, split in two:
 *
 *   GET /MetricsSummary/            — the aggregates (~6 KB): what a dashboard or cron wants
 *   GET /MetricsPlayers/            — per-player rows, paginated
 *   GET /MetricsPlayers/<playerId>  — one player's full row
 *
 * The no-id branch is kept as an explicit 404 rather than deleted, so an old
 * bookmark, script or cron is told where the data went.
 */
export class Metrics extends PublicEndpoint {
	async get(target?: any) {
		const t = db();
		// `target` is Harper's RequestTarget (a URLSearchParams subclass): it carries
		// the path id and any ?query parameters.
		const id = String((this as any).getId?.() || target?.id || '').trim();

		if (!id) return metricsRollupMoved();

		const player = await safeGet(t.Player, id);
		if (!player) throw new GameError(tr('server.err.noSaveWithId'), 404, 'server.err.noSaveWithId');
		// Per-player lookup includes full biome health numbers (no rendered
		// area snapshots — those were removed).
		const bm = await biomeMetrics(id, { player });
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
}

/**
 * The signpost left at the old public roll-up URL. Deliberately NOT a GameError:
 * a crawler following a stale link is not a gameplay refusal and has no business
 * showing up in the dashboard's refusal counters.
 */
function metricsRollupMoved() {
	return {
		status: 404,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
		body: JSON.stringify({
			title: 'The /Metrics/ roll-up moved',
			detail:
				'Aggregates: GET /MetricsSummary/ · per-player rows: GET /MetricsPlayers/ · one row: GET /MetricsPlayers/<playerId>. All three require Harper admin auth. GET /Metrics/<playerId> is unchanged.',
		}),
	};
}

/**
 * Build the analytics roll-up: apply the ?query filters, aggregate, and hand back
 * BOTH halves — `summary` (the aggregates) and `rows` (one record per reporting
 * save). The two admin endpoints below each return one half, which is the whole
 * point of the split: reading the dashboard summary no longer serializes every
 * player record on the way out.
 *
 * Sourced ENTIRELY from the SoloMetrics table, which is now
 * the single client-metrics stream: desktop solo play, the browser demo (both
 * Harper mode and its offline fallback), and any offline solo all uplink a
 * full snapshot here (see SyncMetrics + src/solo/metricsUplink.ts). So this
 * rolls up every reporting player — split by `edition` (demo/full)
 * and `platform` (web/desktop) below — without touching the live
 * Player/BiomeState tables. (Full hosted web/co-op, if ever added, report
 * server-side and would stay out of this rollup.)
 */
async function metricsRollup(target?: any): Promise<{
	generatedAt: number;
	filters: any;
	summary: any;
	rows: any[];
}> {
	// The body below is verbatim from the old Metrics.get() roll-up branch, kept in
	// its original block so the move reads as a move in review rather than a rewrite.
	// Nothing about how a row is derived changed, so every snapshot already in
	// SoloMetrics — including the legacy ones buildDashboardRows back-fills — rolls
	// up exactly as it did before.
	{
		const t = db();
		const now = Date.now();
		// `all` is the SHARED cached rollup — the ?filter branches below rebind it to
		// new arrays via .filter() and never mutate the rows, so the cache stays intact.
		let all = await dashboardCache.get(now);

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
		const availableChannels = [...new Set(all.map((v) => v.channel || 'unknown'))].sort();

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

		// Optional `?excludeDevice=<deviceId>` filter (repeatable and/or comma-
		// separated), the acquisition-side twin of `?exclude=<name>`.
		//
		// `?exclude=` drops SAVES by display name, which is enough for the player
		// numbers — but the acquisition funnel doesn't read saves, it reads AppOpen,
		// one row per install. So a developer's own machine kept counting: every
		// launch during development is a real `open`, and after a few weeks of that
		// the "App opens" figure is mostly one person. (Devices and the conversion
		// rate barely move — a dev machine is one device — so the distortion is
		// concentrated in the raw open and character-creation totals, which is
		// exactly where it is least obvious.)
		//
		// Excluding by device id rather than guessing: an unusually busy device could
		// equally be somebody who loves the game, and there is no honest way to tell
		// those apart from the row. The dashboard's Devices panel lists the roster so
		// you can identify your own machine and name it explicitly.
		const excludedDevices = new Set<string>();
		try {
			const raw: string[] =
				typeof target?.getAll === 'function'
					? [...target.getAll('excludeDevice'), ...target.getAll('excludeDeviceId')]
					: [];
			for (const part of raw.flatMap((s: string) => String(s).split(','))) {
				const d = part.trim();
				if (d) excludedDevices.add(d);
			}
		} catch {
			/* no query params on this target */
		}

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
		const channelFilter = oneParam('channel');
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.platform || 'unknown') === platformFilter);
		if (channelFilter && channelFilter.toLowerCase() !== 'all')
			all = all.filter((v) => (v.channel || 'unknown') === channelFilter);

		// `?idle=exclude` drops windows that were left open rather than played
		// (see isIdleAnomaly). Counted BEFORE the filter runs, so the dashboard can
		// say what it is leaving out instead of silently shrinking. Default is to
		// include them: the raw endpoint keeps reporting everything it recorded,
		// and the dashboard opts out on the reader's behalf.
		const idleRows = all.filter((v) => v.idle);
		const idleExcluded = oneParam('idle').toLowerCase() === 'exclude';
		// Note what is NOT filtered here. An idle window is still a real person who
		// really opened the game, so they stay in the head count, the audience
		// buckets, the funnel, retention and their own (real) action totals. What
		// cannot be trusted is their CLOCK — the play time, the sessions the gaps
		// invented, and the hours parked in one area. Those aggregates read from
		// `timed` instead, and everything else keeps reading `all`.
		const timed = idleExcluded ? all.filter((v) => !v.idle) : all;
		const anomalies = {
			idlePlayers: idleRows.length,
			idleHours: round1(idleRows.reduce((acc, v) => acc + (v.playSeconds || 0), 0) / 3600),
			idleActions: idleRows.reduce((acc, v) => acc + (v.totalActions || 0), 0),
			excluded: idleExcluded,
			rule: `over ${IDLE_MIN_MINUTES} min of play at under ${IDLE_MAX_ACTIONS_PER_MIN} actions/min`,
			// Spelled out because "excluded" is easy to over-read: these saves keep
			// their place in the player count, the funnel and retention. It is only
			// their play time, sessions and area dwell that stop counting.
			affects: 'play time, sessions and area dwell only',
			// Play time is not one measurement across this population. Rows on rev 1
			// were recorded before the client stopped beating for an untouched window,
			// so they include time nobody was there for; rev 2 rows do not. Reported
			// rather than reconciled — there is no honest way to back out idle time a
			// rev 1 row never recorded separately, so the split is shown and any trend
			// that crosses it is read as two series.
			clock: {
				rev: METRICS_REV,
				byRev: all.reduce((acc: Record<string, number>, v) => {
					const k = `rev${v.metricsRev || 1}`;
					acc[k] = (acc[k] || 0) + 1;
					return acc;
				}, {}),
				idleGateMinutes: round1((all.find((v) => v.idleGateMs)?.idleGateMs || 0) / 60_000) || null,
				note: 'rev 1 play time includes untouched windows; rev 2 does not',
			},
		};

		const N = all.length || 1;
		const pct = (n: number) => Math.round((n / N) * 100);

		// Per-counter action totals across everyone (includes cosmetic counters).
		const actionTotals: Record<string, number> = {};
		for (const v of all) {
			for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + (n as number);
		}

		// Sessions count as clock, not population: an abandoned tab crossing the
		// 30-minute gap threshold mints a fresh "session" every time it does it
		// (one such save logged 16 of them without a single action).
		const totalPlaySeconds = timed.reduce((acc, v) => acc + v.playSeconds, 0);
		const totalSessions = timed.reduce((acc, v) => acc + v.sessions, 0);
		// Actions are real even when the clock around them is not, so this one keeps
		// reading everybody.
		const totalActions = all.reduce((acc, v) => acc + v.totalActions, 0);
		/** Denominator for the per-player time averages — the saves whose clock counts. */
		const NT = timed.length || 1;

		// Audience buckets by recency. `activeNow` counts saves seen in the last 5
		// minutes — note solo saves uplink every ~3 min, so that's the practical
		// freshness floor for "playing right now".
		const audience = {
			activeNow: all.filter((v) => v.minutesSinceActive != null && v.minutesSinceActive <= 5).length,
			activeLast24h: all.filter((v) => v.status === 'active').length,
			activeLast7d: all.filter((v) => v.status === 'active' || v.status === 'recent').length,
			// `status` only knows the 24h and 7d cutoffs, so this one is measured
			// straight off the clock. It is a superset of activeLast7d.
			activeLast14d: all.filter((v) => v.hoursSinceActive != null && v.hoursSinceActive <= 24 * 14).length,
			dormant: all.filter((v) => v.status === 'dormant').length,
			newLast24h: all.filter((v) => now - v.createdAt <= DAY_MS).length,
			newLast7d: all.filter((v) => now - v.createdAt <= 7 * DAY_MS).length,
		};

		// Daily series, built from the two timestamps every row already carries.
		//
		// Read `created` as the real one: a save is created once, on a known day, so
		// summing them per day is exact and complete.
		//
		// `lastSeen` needs its label read carefully — it is "saves whose MOST RECENT
		// activity was this day", NOT daily active players. Each row holds a single
		// lastSeenAt, so somebody who played every day for a week appears once, on the
		// last of those days, and every earlier day they played is unrecoverable.
		// Charting it as "active per day" would understate every day but the newest.
		// True DAU would need a per-day record the uplink does not keep; this is the
		// honest thing derivable from what is stored, and it is named for what it is.
		//
		// The range is DENSE — every day from the first to the last, zeros included.
		// A bar chart that silently omits empty days shows a busier game than exists.
		const dayKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
		const createdByDay: Record<string, number> = {};
		const lastSeenByDay: Record<string, number> = {};
		let firstMs = 0;
		let lastMs = 0;
		for (const v of all) {
			if (v.createdAt) {
				const k = dayKeyOf(v.createdAt);
				createdByDay[k] = (createdByDay[k] || 0) + 1;
				if (!firstMs || v.createdAt < firstMs) firstMs = v.createdAt;
				if (v.createdAt > lastMs) lastMs = v.createdAt;
			}
			if (v.lastSeenAt) {
				const k = dayKeyOf(v.lastSeenAt);
				lastSeenByDay[k] = (lastSeenByDay[k] || 0) + 1;
				if (v.lastSeenAt > lastMs) lastMs = v.lastSeenAt;
			}
		}
		const days: Array<{ day: string; created: number; lastSeen: number }> = [];
		if (firstMs) {
			// Walk by UTC day index rather than adding 86_400_000 to a timestamp, so a
			// leap second or a DST-adjacent value can't skip or repeat a day.
			const startDay = Math.floor(firstMs / DAY_MS);
			const endDay = Math.floor((lastMs || firstMs) / DAY_MS);
			for (let d = startDay; d <= endDay && days.length < 1200; d++) {
				const key = dayKeyOf(d * DAY_MS);
				days.push({ day: key, created: createdByDay[key] || 0, lastSeen: lastSeenByDay[key] || 0 });
			}
		}
		const daily = {
			days,
			firstDay: days.length ? days[0].day : null,
			lastDay: days.length ? days[days.length - 1].day : null,
			note: 'created is exact; lastSeen is the day of each save’s most recent activity, not daily active players',
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
		// Which channel each save came from. Also rides inside the snapshot (see
		// metricsUplink), so it needs no column and lands on the row via the spread
		// above. Saves written before this shipped have none — they read 'unknown'
		// rather than being folded into a real channel, so the backfill gap stays
		// visible instead of quietly padding whichever store you look at first.
		const channels = tally((v) => v.channel);

		// Retention: did they come back for more than one session?
		const returningPlayers = all.filter((v) => v.sessions >= 2).length;

		// Demo → full carry-overs (see markDemoConversions). The strongest signal the
		// demo is earning its keep: not "they finished it", but "they bought the game
		// and brought their meadow with them".
		const convertedSaves = all.filter((v) => v.convertedFromDemo);
		const supersededDemoSaves = all.filter((v) => v.supersededByFull).length;
		// Denominator: demo saves that ever reported, counting a converted pair once.
		const demoSavesSeen = all.filter((v) => (v.edition === 'demo' ? 'demo' : 'full') === 'demo').length;
		const demoPopulation = demoSavesSeen - supersededDemoSaves + convertedSaves.length;
		const carriedSeconds = convertedSaves.reduce((a, v) => a + (v.conversion?.demoPlaySeconds || 0), 0);
		const conversions = {
			demoToFull: convertedSaves.length,
			// How many of those we know exactly (stamped at export) vs inferred from a
			// paired demo save. Conversions that predate the stamp are the inferred ones.
			stamped: convertedSaves.filter((v) => v.conversion?.exact).length,
			inferred: convertedSaves.filter((v) => v.conversion && !v.conversion.exact).length,
			demoSavesSeen: demoPopulation,
			ratePct: demoPopulation ? Math.round((convertedSaves.length / demoPopulation) * 100) : 0,
			avgDemoMinutesBeforeBuying: convertedSaves.length ? Math.round(carriedSeconds / 60 / convertedSaves.length) : 0,
			// A converted player has TWO rows (the demo original and the imported
			// save), so `players` above counts them twice. Said out loud rather than
			// silently reconciled — both rows are real uplinks.
			supersededDemoSaves,
		};

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

		// The starter chain, and the conversion it exists to produce.
		//
		// Denominator is saves that actually KNOW about the chain (`starterTotal`
		// set) — snapshots uplinked before it shipped carry no step and would
		// otherwise pile up at 0 and read as a catastrophic first-goal drop-off.
		// Legacy saves that finished the old three-goal opening are reported
		// separately for the same reason: they're counted as done because they are,
		// but their step was inferred, not watched, so folding them into the
		// per-step numbers would put ten fictional claims in the funnel.
		//
		// `authoredAfter` is the number this whole feature is judged on: of the
		// players who finished the chain, how many then wrote a goal of their own.
		// Finishing ten goals is not the win — picking up the board is.
		const chainRows = all.filter((v) => (v.starterTotal || 0) > 0 && !v.starterLegacy);
		const chainIds = starterTaskIds();
		const chainBase = chainRows.length;
		const chainPct = (n: number) => (chainBase ? Math.round((n / chainBase) * 100) : 0);
		const finishedChain = chainRows.filter((v) => v.starterDone);
		const starterChain = {
			saves: chainBase,
			legacySaves: all.filter((v) => v.starterLegacy).length,
			// One entry per goal, in chain order: how many saves have claimed it.
			// Reading top to bottom gives the drop-off, goal by goal.
			steps: chainIds.map((id, i) => {
				const reached = chainRows.filter((v) => (v.starterStep || 0) >= i + 1).length;
				return { id, step: i + 1, reached, pct: chainPct(reached) };
			}),
			completed: finishedChain.length,
			completedPct: chainPct(finishedChain.length),
			// Where the unfinished ones are sitting right now.
			stalledAt: chainIds.reduce<Record<string, number>>((acc, id, i) => {
				const n = chainRows.filter((v) => !v.starterDone && (v.starterStep || 0) === i).length;
				if (n) acc[id] = n;
				return acc;
			}, {}),
			authoredOwnGoal: chainRows.filter((v) => (v.goalsCreated || 0) > 0).length,
			authoredAfterFinishing: finishedChain.filter((v) => (v.goalsCreated || 0) > 0).length,
			authoredAfterFinishingPct: finishedChain.length
				? Math.round((finishedChain.filter((v) => (v.goalsCreated || 0) > 0).length / finishedChain.length) * 100)
				: 0,
			avgGoalsAuthored: chainBase ? round1(chainRows.reduce((a, v) => a + (v.goalsCreated || 0), 0) / chainBase) : 0,
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
		/* The five achievements the most people have, and how long each took.
		 *
		 * Popularity is counted from `earnedAt`, which lists every achievement a
		 * save holds — NOT from `recentDistribution`, which only sees each player's
		 * last five and therefore systematically under-counts the early
		 * achievements that are the popular ones.
		 *
		 * "Time to earn" is measured from the save's creation, and is reported as a
		 * MEDIAN alongside the mean: one player who left the game open for a week
		 * before finishing the tutorial drags a mean badly, and with a handful of
		 * saves it is a mean of almost nothing. `players` and `timed` are both
		 * reported because they differ — a save whose snapshot predates this field
		 * counts for neither, and one with no usable creation time counts for
		 * popularity but not for pacing. */
		/* Idle windows are counted for POPULARITY but never for PACING.
		 *
		 * "Time to earn" is wall-clock from the save's creation, so a window left
		 * open over a lunch break stamps a first-session achievement hours after
		 * the save began — nobody played for those hours. One such save was enough
		 * to turn a range that should have read "34s – 6m" into "34s – 11h 12m",
		 * and it dragged the mean with it. Two things make it safe to drop them
		 * here specifically: the row already carries the same `idle` flag the rest
		 * of this endpoint filters on (so the definition of idle does not fork),
		 * and the popularity count is untouched — an abandoned window still earned
		 * the achievement, it just cannot say how long it took.
		 *
		 * The rows dropped are counted, not silently discarded: `timingIdleSkipped`
		 * rides along in the coverage block so the card can say what the numbers
		 * are drawn from. */
		const achEarnedBy = new Map<string, { players: number; times: number[] }>();
		let timingIdleSkipped = 0;
		for (const v of withAch) {
			const map = v.achievements.earnedAt;
			if (!map || typeof map !== 'object') continue;
			if (v.idle) timingIdleSkipped++;
			for (const [id, at] of Object.entries(map)) {
				let e = achEarnedBy.get(id);
				if (!e) achEarnedBy.set(id, (e = { players: 0, times: [] }));
				e.players++;
				if (v.idle) continue; // popularity yes, duration no — see above
				const ms = Number(at) - Number(v.createdAt || 0);
				// Guard both ends: a missing createdAt yields an absurd age, and clock
				// skew on a client-stamped timestamp can put an achievement before the
				// save existed. Neither is a real duration.
				if (v.createdAt && Number.isFinite(ms) && ms >= 0 && ms <= 365 * DAY_MS) e.times.push(ms / 1000);
			}
		}
		const achDefs = await defs().catch(() => null);
		const topAchievements = [...achEarnedBy.entries()]
			.sort((a, b) => b[1].players - a[1].players || a[0].localeCompare(b[0]))
			.slice(0, 5)
			.map(([id, e]) => {
				const sorted = [...e.times].sort((a, b) => a - b);
				const mid = sorted.length
					? sorted.length % 2
						? sorted[(sorted.length - 1) / 2]
						: (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
					: null;
				return {
					id,
					name: (achDefs as any)?.achievement?.get?.(id)?.name || id,
					players: e.players,
					// How many of those players had a usable duration behind them.
					timed: sorted.length,
					medianSecondsToEarn: mid == null ? null : round1(mid),
					avgSecondsToEarn: sorted.length ? round1(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
					fastestSeconds: sorted.length ? round1(sorted[0]) : null,
					slowestSeconds: sorted.length ? round1(sorted[sorted.length - 1]) : null,
				};
			});
		// Saves whose snapshot predates the per-achievement timestamps contribute
		// nothing here, and a top-five drawn from four saves is not a top five.
		const achTimingCoverage = {
			savesWithAchievements: withAch.length,
			savesWithTimestamps: withAch.filter((v) => v.achievements.earnedAt && Object.keys(v.achievements.earnedAt).length)
				.length,
			// Counted in `players`, excluded from every duration — see above.
			idleSkipped: timingIdleSkipped,
		};

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
			topAchievements,
			timingCoverage: achTimingCoverage,
		};

		// Time-per-area: sum every save's dwell time, so you can see where players
		// actually spend their sessions (and the single most-lived-in area).
		const areaSecondsTotals: Record<string, number> = {};
		for (const v of timed) {
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

		// Time-in-menus: the same sum across saves, plus how often each menu was
		// opened. `measuredSaves` is the denominator that matters — saves recorded
		// before this metric existed contribute nothing, and averaging over every
		// save would report a drop in menu use that never happened.
		const menuSecondsTotals: Record<string, number> = {};
		const menuOpensTotals: Record<string, number> = {};
		let menuMeasuredSaves = 0;
		let menuPlaySecondsOfMeasured = 0;
		for (const v of timed) {
			const ms = (v.menuSeconds || {}) as Record<string, number>;
			const mo = (v.menuOpens || {}) as Record<string, number>;
			if (v.menuMeasured) {
				menuMeasuredSaves++;
				menuPlaySecondsOfMeasured += v.playSeconds || 0;
			}
			for (const [k, sec] of Object.entries(ms)) menuSecondsTotals[k] = (menuSecondsTotals[k] || 0) + (sec || 0);
			for (const [k, n] of Object.entries(mo)) menuOpensTotals[k] = (menuOpensTotals[k] || 0) + (n || 0);
		}
		const totalMenuSeconds = Object.values(menuSecondsTotals).reduce((a, b) => a + b, 0);
		const menuMinutesTotals: Record<string, number> = {};
		for (const [k, sec] of Object.entries(menuSecondsTotals)) menuMinutesTotals[k] = Math.round(sec / 60);
		const menuDwell = {
			measuredSaves: menuMeasuredSaves,
			totalSeconds: Math.round(totalMenuSeconds),
			totalMinutes: Math.round(totalMenuSeconds / 60),
			totalOpens: Object.values(menuOpensTotals).reduce((a, b) => a + b, 0),
			byMenuSeconds: menuSecondsTotals,
			byMenuMinutes: menuMinutesTotals,
			byMenuOpens: menuOpensTotals,
			mostUsedMenu: Object.entries(menuSecondsTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
			// Share of play time spent in a menu, over the saves that measured it.
			shareOfPlayPct:
				menuPlaySecondsOfMeasured > 0 ? round1((totalMenuSeconds / menuPlaySecondsOfMeasured) * 100) : null,
			// Mean seconds per open, per menu: separates "a menu people live in"
			// from "a menu people check constantly and leave".
			secondsPerOpen: Object.fromEntries(
				Object.entries(menuSecondsTotals).map(([k, sec]) => [
					k,
					menuOpensTotals[k] ? round1(sec / menuOpensTotals[k]) : null,
				]),
			),
		};

		// Session-length distribution: sum each save's finished-session histogram.
		//
		// This is a SUBSET and the name hides it. A save only contributes buckets for
		// sessions that ended cleanly enough to be measured, and only clients new
		// enough to record `sessionLengths` contribute at all — so the histogram has
		// been totalling a couple of dozen sessions while `engagement.totalSessions`
		// reported hundreds, with nothing in the response admitting the gap. Reading
		// it as "the shape of all sessions" is then just wrong, and there is no way to
		// tell from the payload.
		//
		// Fixed by reporting the coverage next to the buckets instead of renaming the
		// field (which would break every existing consumer, this dashboard included):
		// `sessionsCovered` is what the buckets actually add up to, `totalSessions` is
		// the population it is drawn from, and `coveragePct` is the ratio to caveat
		// the chart with.
		const sessionLengthDistribution: Record<string, number> = { '<2m': 0, '2-10m': 0, '10-30m': 0, '30m+': 0 };
		let sessionLengthSaves = 0;
		for (const v of timed) {
			const buckets = Object.entries(v.sessionLengths || {});
			if (buckets.length) sessionLengthSaves++;
			for (const [b, n] of buckets) sessionLengthDistribution[b] = (sessionLengthDistribution[b] || 0) + (n as number);
		}
		// Count the ABANDONED sessions the heartbeat can never bucket.
		//
		// A session's length is only written when the NEXT one begins. For a player
		// who closes the game and doesn't come back, that moment never arrives — so
		// their session sits marked "in progress" forever and never reaches the
		// histogram. Since most players do exactly that, the histogram was covering
		// about 4% of sessions and looked broken.
		//
		// But nothing about that session is unknown. `curSessionSeconds` holds its
		// accrued length, and once `lastSeenAt` is older than the session gap the
		// player has demonstrably gone. That is a FINISHED session with a known
		// duration, so bucket it here rather than pretending it is still running.
		//
		// No double counting: when a player does return, the heartbeat buckets that
		// session itself and resets `curSessionSeconds`, so the same session can never
		// be counted from both sides.
		const abandonedBuckets: Record<string, number> = {};
		let abandonedCount = 0;
		let stillLive = 0;
		for (const v of timed) {
			const open = Math.round(v.curSessionSeconds || 0);
			if (open <= 0) continue;
			const quietFor = v.lastSeenAt ? now - v.lastSeenAt : Infinity;
			if (quietFor > SESSION_GAP_MS) {
				const b = sessionBucket(open);
				abandonedBuckets[b] = (abandonedBuckets[b] || 0) + 1;
				sessionLengthDistribution[b] = (sessionLengthDistribution[b] || 0) + 1;
				abandonedCount++;
			} else {
				stillLive++; // genuinely mid-session right now
			}
		}
		const sessionsCovered = Object.values(sessionLengthDistribution).reduce((a, b) => a + b, 0);
		// Only sessions happening RIGHT NOW are unmeasurable. Everything else either
		// ended cleanly or was abandoned, and both are counted above.
		const sessionsMeasurable = Math.max(0, totalSessions - stillLive);
		const sessionLengths = {
			buckets: sessionLengthDistribution,
			sessionsCovered,
			// Where the coverage came from, kept apart so the inference is auditable.
			fromClient: sessionsCovered - abandonedCount,
			fromAbandoned: abandonedCount,
			sessionsMeasurable,
			sessionsLiveNow: stillLive,
			totalSessions,
			savesReporting: sessionLengthSaves,
			savesMeasured: timed.length,
			// Saves too old to report curSessionSeconds still can't contribute their
			// abandoned session — said plainly so a gap has a name.
			savesMissingOpenSession: timed.filter((v) => v.curSessionSeconds == null).length,
			abandonedBuckets,
			coveragePct: sessionsMeasurable ? Math.round((sessionsCovered / sessionsMeasurable) * 100) : 0,
			note: 'a session the client never closed is bucketed here once the player has been quiet longer than the session gap — only sessions live right now are unmeasurable',
		};

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
		//
		// The plain mean is unusable here and was being read as if it weren't. Real
		// first actions land in the seconds — 5.9s, 14.1s, 19.7s — but a save that was
		// created and then left open overnight before anyone touched it contributes a
		// five-figure number, and a handful of those dragged the reported average past
		// 80 minutes. Nobody's onboarding takes 80 minutes; the statistic was measuring
		// abandonment, not friction.
		//
		// So: report the MEDIAN (which the outliers cannot move), keep the raw mean for
		// continuity, and add a trimmed mean over the plausible window. `avgSeconds`
		// deliberately keeps its old meaning rather than being quietly redefined — an
		// existing consumer reading it gets the same number it got yesterday, and the
		// honest numbers sit next to it under new names.
		const TTFA_OUTLIER_SECONDS = 30 * 60; // half an hour to press one button = walked away
		const ttfaAll = all.filter((v) => v.timeToFirstActionSeconds != null).map((v) => v.timeToFirstActionSeconds);
		const ttfaSorted = [...ttfaAll].sort((a, b) => a - b);
		const ttfaKept = ttfaSorted.filter((s) => s <= TTFA_OUTLIER_SECONDS);
		const median = (xs: number[]): number => {
			if (!xs.length) return 0;
			const mid = xs.length >> 1;
			return round1(xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2);
		};
		const mean = (xs: number[]): number => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
		const timeToFirstAction = {
			playersMeasured: ttfaAll.length,
			// Unchanged meaning, kept for continuity. Skewed by design — see below.
			avgSeconds: mean(ttfaAll),
			// The number to actually quote. Immune to the walked-away tail.
			medianSeconds: median(ttfaSorted),
			// Mean over everyone who acted within the plausible window.
			trimmedAvgSeconds: mean(ttfaKept),
			trimmedMedianSeconds: median(ttfaKept),
			p90Seconds: ttfaKept.length
				? round1(ttfaKept[Math.min(ttfaKept.length - 1, Math.floor(ttfaKept.length * 0.9))])
				: 0,
			// Said out loud rather than silently dropped, so the exclusion is auditable.
			outliersExcluded: ttfaAll.length - ttfaKept.length,
			outlierThresholdSeconds: TTFA_OUTLIER_SECONDS,
			note: 'avgSeconds includes saves left open before the first action; medianSeconds and trimmedAvgSeconds do not',
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
				highContrast: countPref((p) => p.highContrast === true),
				colorblindOn: countPref((p) => p.colorblindMode && p.colorblindMode !== 'off'),
				// The font picker replaced a dyslexia-font toggle. It's a taste setting
				// now, not an assistive one, so it no longer counts toward anyEnabled —
				// otherwise every player who just liked the serif would inflate the
				// accessibility-adoption number. Dark mode is kept out for the same
				// reason, and turning the interact hint OFF is the opposite of enabling
				// an aid. Both are still reported below, just not counted here.
				anyEnabled: countPref(
					(p) =>
						p.reduceMotion === true ||
						p.highContrast === true ||
						(p.colorblindMode && p.colorblindMode !== 'off') ||
						(p.textScale && p.textScale !== 'md') ||
						p.simpleText === true,
				),
				colorblindModes: tallyPref((p) => p.colorblindMode || 'off'),
				textScales: tallyPref((p) => p.textScale || 'md'),
				simpleText: countPref((p) => p.simpleText === true),
				// interactHint ships ON, so the number worth watching is who turns it OFF.
				interactHintOff: countPref((p) => p.interactHint === false),
				// Saves that predate the picker still carry `dyslexiaFont: true`; the
				// client migrates those to 'plain' on load, so mirror that here rather
				// than tallying them as an absent field.
				fonts: tallyPref((p) => p.fontChoice || (p.dyslexiaFont === true ? 'plain' : 'storybook')),
				// Theme, both ways round. `themes` is what players picked, which is the
				// actionable number; `themesResolved` is what they were actually looking
				// at, which is the only way to see through 'system'. Snapshots that
				// predate dark mode carry neither and count as light — that build had no
				// other option, so it's what those players saw.
				themes: tallyPref((p) => p.theme || 'light'),
				themesResolved: tallyPref((p) => p.themeResolved || p.theme || 'light'),
			},
		};

		// Acquisition funnel — from the per-device AppOpen table, so it counts
		// people who opened the app but never made a character (bounced), and how
		// many characters each person creates. `?exclude=<name>` does not reach here
		// (that filters saves, and these rows are devices); `?excludeDevice=` does.
		let openRows: any[] = [];
		try {
			// Cached, NOT a bare `allOf`. AppOpen is keyed `dev:<deviceId>` — one row
			// per install, forever, never one per day — so this scan grows with every
			// person who has ever launched the game and never shrinks. It sat inside
			// metricsRollup but OUTSIDE dashboardCache, so unlike every other read on
			// this path it was paid in full on every /MetricsSummary/ hit and on every
			// page of /MetricsPlayers/, including the auto-refresh. It uses the same
			// RollupCache the rest of the dashboard already relies on, invalidated by
			// the same AppOpen writes that already call dashboardCache.invalidate().
			openRows = await appOpenCache.get(now);
		} catch {
			/* AppOpen table not created yet */
		}
		// Keep acquisition consistent with the active filters.
		if (versionActive) openRows = openRows.filter((o) => matchesVersion(o.version || 'unknown'));
		if (editionFilter && editionFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.edition === 'demo' ? 'demo' : 'full') === editionFilter);
		if (platformFilter && platformFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.platform || 'unknown') === platformFilter);
		if (channelFilter && channelFilter.toLowerCase() !== 'all')
			openRows = openRows.filter((o) => (o.channel || 'unknown') === channelFilter);

		const deviceIdOf = (o: any) => String(o?.deviceId || String(o?.id || '').replace(/^dev:/, ''));

		/* OUR OWN devices come out by default — the ones that marked themselves via
		 * ?dev=1, plus anything running on localhost (channel 'dev'). On a young
		 * game these are most of the funnel: every title-screen reload while
		 * checking a change counts as an install that never converted, so the
		 * numbers say more about the week's development than about players.
		 *
		 * `?includeDev=1` puts them back for anyone who wants the raw totals. What
		 * was removed is reported below rather than left to be inferred from a
		 * number that quietly got smaller. */
		const includeDev = ['1', 'true'].includes(String(oneParam('includeDev') || '').toLowerCase());
		const isOurs = (o: any) => !!o?.isDev || (o?.channel || '') === 'dev';
		const devRows = includeDev ? [] : openRows.filter(isOurs);
		if (devRows.length) openRows = openRows.filter((o) => !isOurs(o));

		const excludedRows = excludedDevices.size ? openRows.filter((o) => excludedDevices.has(deviceIdOf(o))) : [];
		if (excludedDevices.size) openRows = openRows.filter((o) => !excludedDevices.has(deviceIdOf(o)));
		// What the exclusion actually removed, stated rather than left to be inferred
		// from a number that quietly got smaller.
		const excludedDeviceStats = {
			ids: [...excludedDevices],
			matched: excludedRows.length,
			opens: excludedRows.reduce((a, o) => a + (o.opens || 0), 0),
			charactersCreated: excludedRows.reduce((a, o) => a + (o.savesCreated || 0), 0),
		};

		const devices = openRows.length;
		const convertedDevices = openRows.filter((o) => o.converted).length;
		// Demo completion: of the demo installs that made a character, how many
		// reached the hard-stop (goal animals returned). Device-scoped + sticky.
		const demoDevices = openRows.filter((o) => o.edition === 'demo');
		const demoConverted = demoDevices.filter((o) => o.converted).length;
		const demoFinished = demoDevices.filter((o) => o.reachedDemoGoal).length;
		// The "are you done playing?" prompt, as a funnel: raised → save exported →
		// store link clicked. Device-scoped and sticky like everything else on this
		// row, so it survives the demo save being wiped at the hard-stop.
		//
		// Exports are counted here rather than at ExportDemoSave because the server
		// endpoint cannot tell WHERE an export came from, and that is the entire
		// question: the prompt is only worth its interruption if it produces exports
		// that the Settings button and the end-of-demo popup would not have. Compare
		// `exported` against demoCompletion.reachedGoal to see it.
		const nudgeShown = demoDevices.filter((o) => o.demoNudgeShown).length;
		const nudgeExported = demoDevices.filter((o) => o.demoNudgeExported).length;
		const nudgeStore = demoDevices.filter((o) => o.demoNudgeStore).length;
		const demoNudge = {
			shown: nudgeShown,
			exported: nudgeExported,
			storeClicked: nudgeStore,
			exportPct: nudgeShown ? Math.round((nudgeExported / nudgeShown) * 100) : 0,
			storePct: nudgeShown ? Math.round((nudgeStore / nudgeShown) * 100) : 0,
		};
		/* The end-of-demo popup, as its own funnel off the SAME denominator the
		 * completion rate uses: every device that reaches the hard-stop sees this
		 * screen, so `reachedGoal` is how many were shown it and needs no separate
		 * flag. Read `storePct` next to demoNudge.storePct — the two screens are
		 * asking the same question of the same people at different moments, and
		 * until the popup had a store link at all, the nudge's number was the only
		 * one moving. */
		const endExported = demoDevices.filter((o) => o.demoEndExported).length;
		const endStore = demoDevices.filter((o) => o.demoEndStore).length;
		const demoEnd = {
			shown: demoFinished,
			exported: endExported,
			storeClicked: endStore,
			exportPct: demoFinished ? Math.round((endExported / demoFinished) * 100) : 0,
			storePct: demoFinished ? Math.round((endStore / demoFinished) * 100) : 0,
		};
		const demoCompletion = {
			demoInstalls: demoDevices.length,
			createdCharacter: demoConverted,
			reachedGoal: demoFinished,
			// completion rate among demo players who actually made a character
			completionPct: demoConverted ? Math.round((demoFinished / demoConverted) * 100) : 0,
			nudge: demoNudge,
			endScreen: demoEnd,
		};
		// demo vs paid split of installs (edition is stamped on each AppOpen row).
		const editionSplit: Record<string, number> = {};
		for (const o of openRows) {
			const k = o.edition === 'demo' ? 'demo' : 'full';
			editionSplit[k] = (editionSplit[k] || 0) + 1;
		}
		/* Per-CHANNEL funnel: how many devices each channel brought, and how
		 * many of them went on to make a character.
		 *
		 * Deliberately not a bare count. Raw device counts across channels are not
		 * comparable — inside itch's game iframe the device id lives in THIRD-PARTY
		 * storage, which browsers partition or clear on their own, so one itch
		 * player can show up as several devices while a wildwillows.app player
		 * (first-party) shows up as one. Conversion RATE survives that; totals do
		 * not. Both are returned, but the rate is the one to compare on.
		 *
		 * 'unknown' is its own bucket: every device that opened the game before
		 * this shipped has no channel, and folding those into a real one
		 * would silently inflate whichever one you happened to look at.
		 */
		const channelSplit: Record<string, any> = {};
		for (const o of openRows) {
			const k = String(o.channel || 'unknown');
			const c = (channelSplit[k] ||= { devices: 0, opens: 0, converted: 0, charactersCreated: 0, conversionPct: 0 });
			c.devices++;
			c.opens += o.opens || 0;
			c.charactersCreated += o.savesCreated || 0;
			if (o.converted) c.converted++;
		}
		for (const c of Object.values<any>(channelSplit))
			c.conversionPct = c.devices ? Math.round((c.converted / c.devices) * 100) : 0;

		/* The keyboard gate: devices shown "Wild Willows needs a keyboard".
		 *
		 * These are not bounces. A bounce opened the game and chose to leave; these
		 * people never got the chance, and until the gate started reporting they were
		 * silently mixed into the same number — which is the sort of thing that makes
		 * a bounce rate look like a design problem when it is a hardware one.
		 *
		 * `turnedAway` is the count that matters: shown the screen and never got in.
		 * `gotIn` is the tablet-with-a-keyboard case, kept out of it.
		 *
		 * COVERAGE: only devices that have opened the game since the gate started
		 * reporting can appear here, so early numbers understate — and a device that
		 * was never gated is indistinguishable from one that predates the field, both
		 * being simply absent. There is no honest way to compute that gap, so none is
		 * offered; `since` carries the first gate report instead, and the dashboard
		 * dates the number rather than implying it covers all time.
		 */
		const gatedRows = openRows.filter((o) => o.keyboardGated);
		const gotInRows = gatedRows.filter((o) => o.keyboardGatePassed);
		const turnedAwayRows = gatedRows.filter((o) => !o.keyboardGatePassed);
		// Which devices they are. The gate is about hardware, so the answer people
		// actually want from this number is "are these phones?" — os carries that
		// (ios | android | windows | mac | linux), platform only says web vs desktop.
		const turnedAwayByOs: Record<string, number> = {};
		for (const o of turnedAwayRows) {
			const k = String(o.os || 'unknown');
			turnedAwayByOs[k] = (turnedAwayByOs[k] || 0) + 1;
		}
		const bouncedDevices = devices - convertedDevices;
		const gateTimes = gatedRows.map((o) => Number(o.keyboardGatedAt) || 0).filter((v) => v > 0);
		const keyboardGate = {
			shown: gatedRows.length,
			turnedAway: turnedAwayRows.length,
			gotIn: gotInRows.length,
			// Share of ALL devices, not of the ones that reported — the honest
			// denominator, and the one that makes the bounce comparison meaningful.
			pctOfDevices: devices ? Math.round((turnedAwayRows.length / devices) * 100) : 0,
			// How much of the bounce rate is actually this.
			pctOfBounced: bouncedDevices ? Math.round((turnedAwayRows.length / bouncedDevices) * 100) : 0,
			byOs: turnedAwayByOs,
			// When the first device reported being gated — i.e. how far back this
			// number goes. 0 until one does.
			since: gateTimes.length ? Math.min(...gateTimes) : 0,
		};

		const withCreatorTime = openRows.filter((o) => (o.creationMs || 0) > 0);
		const totalCharacters = openRows.reduce((a, o) => a + (o.savesCreated || 0), 0);
		const savesPerPersonHistogram: Record<string, number> = {};
		for (const o of openRows) {
			const k = String(o.savesCreated || 0);
			savesPerPersonHistogram[k] = (savesPerPersonHistogram[k] || 0) + 1;
		}
		/* PLAYED = created a character OR came back to an existing save.
		 *
		 * Bounce used to mean "never made a character", which counted every
		 * returning player as a bounce — the rate got WORSE as the game started
		 * retaining people, which is precisely backwards. Someone who pressed
		 * Continue did not bounce; they are the best outcome on this screen.
		 *
		 * `converted` is left alone and still means character creation, so the
		 * existing series keeps its meaning. Bounce is recomputed on `played`.
		 *
		 * Note for reading old numbers: devices that last opened the game before
		 * this shipped have no `resumed` flag, so historical bounce stays overstated.
		 * It corrects going forward rather than retroactively. */
		const resumedDevices = openRows.filter((o) => o.resumed).length;
		const playedDevices = openRows.filter((o) => o.converted || o.resumed).length;
		const acquisition = {
			devices,
			totalOpens: openRows.reduce((a, o) => a + (o.opens || 0), 0),
			converted: convertedDevices,
			// Came back to a save they already had.
			resumed: resumedDevices,
			// Did either — the honest denominator for "did this device play?"
			played: playedDevices,
			playedPct: devices ? Math.round((playedDevices / devices) * 100) : 0,
			bounced: devices - playedDevices,
			conversionPct: devices ? Math.round((convertedDevices / devices) * 100) : 0,
			bounceRatePct: devices ? Math.round(((devices - playedDevices) / devices) * 100) : 0,
			avgCreatorSeconds: withCreatorTime.length
				? round1(withCreatorTime.reduce((a, o) => a + o.creationMs, 0) / withCreatorTime.length / 1000)
				: 0,
			totalCharactersCreated: totalCharacters,
			avgCharactersPerPerson: devices ? round1(totalCharacters / devices) : 0,
			avgCharactersPerConverted: convertedDevices ? round1(totalCharacters / convertedDevices) : 0,
			charactersPerPersonHistogram: savesPerPersonHistogram,
			editions: editionSplit,
			// Per-channel funnel (itch | mas | direct | dev) — see channelSplit.
			channels: channelSplit,
			// Devices the keyboard gate turned away — see keyboardGate above. Sits in
			// acquisition because that is where they were being miscounted.
			keyboardGate,
			// What the ?excludeDevice= filter took out. The dashboard no longer offers
			// a device picker — raw app opens came off the page entirely, which removes
			// the distortion rather than filtering around it — but the query parameter
			// stays for anyone reading this endpoint directly.
			excludedDevices: excludedDeviceStats,
			// Our own machines, dropped by default. `?includeDev=1` keeps them in.
			ownDevices: {
				matched: devRows.length,
				opens: devRows.reduce((a, o) => a + (o.opens || 0), 0),
				charactersCreated: devRows.reduce((a, o) => a + (o.savesCreated || 0), 0),
				included: includeDev,
			},
		};

		return {
			generatedAt: now,
			filters: {
				availableVersions,
				availableEditions,
				availablePlatforms,
				availableChannels,
				version: versionActive ? versionFilter : null,
				versionMode: versionActive ? versionMode : null,
				edition: editionFilter && editionFilter.toLowerCase() !== 'all' ? editionFilter : null,
				platform: platformFilter && platformFilter.toLowerCase() !== 'all' ? platformFilter : null,
				channel: channelFilter && channelFilter.toLowerCase() !== 'all' ? channelFilter : null,
				idle: idleExcluded ? 'exclude' : null,
				excludedDevices: [...excludedDevices],
			},
			summary: {
				players: all.length,
				soloPlayers: all.length,
				excludedNames: [...excludedNames],
				excludedDevices: [...excludedDevices],
				anomalies,
				audience,
				daily,
				languages,
				platforms,
				operatingSystems,
				versions,
				editions,
				channels,
				engagement: {
					totalPlayHours: round1(totalPlaySeconds / 3600),
					totalPlaySeconds,
					avgPlayMinutesPerPlayer: Math.round(totalPlaySeconds / 60 / NT),
					totalSessions,
					// totalSessions comes from `timed`, so this divides by the same population.
					avgSessionsPerPlayer: round1(totalSessions / NT),
					avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
					totalActions,
					avgActionsPerPlayer: round1(totalActions / N),
				},
				retention: {
					returningPlayers,
					returningRatePct: pct(returningPlayers),
				},
				conversions,
				progression: {
					avgBiomeHealth,
					biomesFullyRestored: all.reduce((acc, v) => acc + (v.biomeSummary?.biomesFullyRestored || 0), 0),
					avgUnlockedBiomes: round1(all.reduce((acc, v) => acc + (v.unlockedBiomes || 0), 0) / N),
					mostPopularArea,
					tutorialStepHistogram: tutorialTally,
				},
				areaDwell,
				menuDwell,
				// Kept verbatim so existing readers (this repo's dashboard included)
				// don't break; `sessionLengths` is the same buckets plus the coverage
				// they were always missing.
				sessionLengthDistribution,
				sessionLengths,
				creation,
				appearancePopularity,
				timeToFirstAction,
				acquisition,
				demoCompletion,
				settings,
				funnel,
				funnelPct,
				starterChain,
				actionTotals,
				achievements: achievementsSummary,
			},
			rows: all,
		};
	}
}

/** Largest page /MetricsPlayers/ will hand out in one response. */
const METRICS_PAGE_MAX = 500;
/** Page size when the caller doesn't ask for one. */
const METRICS_PAGE_DEFAULT = 100;

/** Read a single ?key=value off Harper's RequestTarget, '' when absent. */
function queryOne(target: any, key: string): string {
	try {
		const raw = typeof target?.getAll === 'function' ? target.getAll(key) : [];
		return String((raw && raw[0]) || '').trim();
	} catch {
		return '';
	}
}

/**
 * GET /MetricsSummary/ — the analytics aggregates, and ONLY the aggregates.
 *
 * Extends the raw Resource (NOT PublicEndpoint), so Harper's default permissions
 * apply and only an authenticated super user can read it — the same treatment
 * ListFeedback gets, and for the same reason:
 *   curl -u HDB_ADMIN 'https://wild.willows.harperfabric.com/MetricsSummary/'
 *
 * This is the response a dashboard, a cron job or a capacity report actually
 * wants. It used to arrive with ~500 KB of per-player records stapled to it;
 * those now live on /MetricsPlayers/ and are fetched only when something needs
 * them. Every ?filter the old endpoint took still works here unchanged.
 */
export class MetricsSummary extends DashboardEndpoint {
	async get(target?: any) {
		const { generatedAt, filters, summary, rows } = await metricsRollup(target);
		return {
			generatedAt,
			source: 'solo-metrics',
			filters,
			summary,
			// So a caller can size its paging without a second request.
			players: { total: rows.length, endpoint: '/MetricsPlayers/', maxLimit: METRICS_PAGE_MAX },
		};
	}
}

/**
 * GET /MetricsPlayers/                — per-player rows, newest-active first, paginated.
 * GET /MetricsPlayers/<playerId>      — one player's full row.
 *
 * Admin-only for the same reason as MetricsSummary — these rows are the sensitive
 * half: display names, exact first/last activity, OS, accessibility preferences,
 * appearance and behaviour.
 *
 * Paging: `?limit=` (default 100, max 500) and `?cursor=`, where the cursor is the
 * opaque token handed back as `nextCursor`. Rows are sorted deterministically
 * (last seen desc, then play time desc) by buildDashboardRows, so the cursor names
 * the last row of the previous page and paging resumes just after it. If that row
 * has vanished between pages — a re-uplink can reorder it — paging restarts from
 * the top rather than silently skipping records, and `cursorStale: true` says so.
 *
 * BACKWARDS COMPATIBILITY: a row here is byte-for-byte the row that used to appear
 * in the old `players` array, derived fields and all. Nothing was renamed, nothing
 * dropped. `?fields=list` is opt-in, for callers that only want to draw a table.
 */
export class MetricsPlayers extends DashboardEndpoint {
	async get(target?: any) {
		const id = String((this as any).getId?.() || target?.id || '').trim();
		const { generatedAt, filters, rows } = await metricsRollup(target);

		if (id) {
			const row = rows.find((r: any) => r.playerId === id);
			if (!row) throw new GameError(tr('server.err.noSaveWithId'), 404, 'server.err.noSaveWithId');
			return { generatedAt, player: row };
		}

		const asked = parseInt(queryOne(target, 'limit'), 10) || METRICS_PAGE_DEFAULT;
		const limit = Math.min(Math.max(asked, 1), METRICS_PAGE_MAX);
		const cursor = queryOne(target, 'cursor');
		let start = 0;
		let cursorStale = false;
		if (cursor) {
			const after = decodeMetricsCursor(cursor);
			const at = after ? rows.findIndex((r: any) => r.playerId === after) : -1;
			if (at >= 0) start = at + 1;
			else cursorStale = true;
		}

		const page = rows.slice(start, start + limit);
		const last = page[page.length - 1];
		const more = start + page.length < rows.length;
		const lean = queryOne(target, 'fields').toLowerCase() === 'list';

		return {
			generatedAt,
			filters,
			total: rows.length,
			offset: start,
			limit,
			returned: page.length,
			nextCursor: more && last ? encodeMetricsCursor(last.playerId) : null,
			...(cursorStale ? { cursorStale: true } : {}),
			players: lean ? page.map(metricsListRow) : page,
		};
	}
}

// ---------------------------------------------------------------- system probe
// Harper records its own telemetry into two tables in the `system` database —
// hdb_analytics (aggregated once a minute) and hdb_raw_analytics (per second,
// per thread). If a component can read those in-process, the dashboard can show
// real server health (thread utilisation, database size, HTTP error rate) with
// no credentials stored anywhere and no call out to the operations API on :9925.
//
// Whether a component CAN read them is not documented either way, and the answer
// decides the whole design — so this endpoint finds out instead of guessing. It
// is a throwaway: once we know, it either turns into a real health endpoint or
// gets deleted. Every step is independently caught, so one failure still leaves a
// useful report rather than a stack trace.
//
//   curl -u HDB_ADMIN https://wild.willows.harperfabric.com/SystemProbe/

/** Read at most `max` records from a search, whatever the query did.
 *  The cap is enforced HERE, not in the query: if a condition is ignored or
 *  unsupported, an unbounded scan of a per-minute telemetry table would be
 *  enormous, and the point of a probe is to not take the server down. */
async function takeFrom(iterable: any, max: number): Promise<any[]> {
	const out: any[] = [];
	for await (const item of iterable) {
		if (item != null) out.push(item);
		if (out.length >= max) break;
	}
	return out;
}

/**
 * GET /ServerHealth/ — how the SERVER is doing, as opposed to the players.
 *
 * Reads Harper's own telemetry out of `system.hdb_analytics` in-process, which
 * SystemProbe confirmed a component can do. That is the whole reason this exists
 * in this shape: no super-user password stored in the app, no proxying the
 * operations API on :9925, no second credential to leak. Same DashboardEndpoint
 * gate as the metrics feeds, so the read-only role reaches it.
 *
 * ONE UNVERIFIED THING, stated because it decides whether this works for you: the
 * probe ran as HDB_ADMIN, so it proved a SUPER-USER can read the system database
 * from a component. Whether a `metrics_reader` request can do the same is NOT
 * established — Harper's super_user role carries explicit
 * `permission.system.tables.hdb_analytics.read`, and a role without it may be
 * refused. So the read is caught and reported as `readable: false` with the error
 * attached rather than thrown. If this reads fine as super-user and not as
 * metrics_reader, that IS the answer, and it says so on the page instead of
 * turning into a 500.
 *
 * Record shape: { id: [timeMs, nodeId], period, metric, path, method, type,
 * total, count, ratio, mean, median, p95, p99, time }. `id` is a COMPOSITE array,
 * so it is used for range filtering as a whole and the numeric timestamp is read
 * from `time` — never by coercing `id`, which yields NaN.
 */
const HEALTH_MAX_ROWS = 4000;

export class ServerHealth extends DashboardEndpoint {
	async get(target?: any) {
		const now = Date.now();
		// Default 60, not 15. The gauges (database-size, storage-volume,
		// main-thread-utilization) are emitted sparsely, so a 15-minute window
		// routinely landed between samples and reported them as absent.
		const mins = Math.min(Math.max(parseInt(queryOne(target, 'minutes'), 10) || 60, 1), 1440);
		const since = now - mins * 60_000;

		/* ?raw=<metric> dumps a few records verbatim.
		 *
		 * Everything above this line is an interpretation of these records, and the
		 * interpretations have been wrong twice — first about the metric names, then
		 * about the units. This exists so the next question is settled by looking
		 * rather than by another guess. Same auth gate as the rest. */
		const rawMetric = queryOne(target, 'raw');

		let rows: any[] = [];
		let readable = true;
		let readError: string | null = null;
		try {
			const t: any = (globalThis as any).databases?.system?.hdb_analytics;
			if (!t || typeof t.search !== 'function') {
				readable = false;
				readError = 'system.hdb_analytics is not visible to this component';
			} else {
				// Cap enforced in the loop, not trusted to the query: per-minute
				// telemetry across every metric and thread adds up fast.
				rows = await takeFrom(
					t.search({ conditions: [{ attribute: 'id', comparator: 'between', value: [since, now] }] }),
					HEALTH_MAX_ROWS,
				);
			}
		} catch (e: any) {
			readable = false;
			readError = String(e?.message || e);
		}

		/* Metric names are matched by SHAPE, not by an exact string.
		 *
		 * The first cut of this hard-coded 'main-thread-utilization', 'cpu-usage',
		 * 'database-size' and friends, and on the real instance every one of them
		 * missed: the response_* and duration metrics resolved, so the panel looked
		 * alive while thread utilization, CPU, database size and replication lag all
		 * rendered as em-dashes — the failure mode that looks exactly like a healthy
		 * idle server. Harper's names vary by version and casing, so normalise both
		 * sides to bare lowercase letters and match on that: mainThreadUtilization,
		 * main-thread-utilization and MAIN_THREAD_UTILIZATION all reduce to the same
		 * key. `metricsSeen` in the response lists whatever did NOT match, so an
		 * unrecognised name is visible on the page instead of silently absent. */
		const norm = (s: any) =>
			String(s || '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '');
		const pick = (...names: string[]) => {
			const want = names.map(norm);
			return rows.filter((r) => want.includes(norm(r.metric)));
		};
		/* Which field carries the number also varies by metric — a gauge lands in
		 * `total`, a rate in `ratio`, a timing in `mean`. Take the first that is
		 * actually a number rather than assuming one. */
		// Bookkeeping, not measurements: numbers present on every record, none of
		// which is the thing the metric is actually reporting.
		const NON_VALUE = new Set(['time', 'period', 'id', 'nodeid', 'node', 'count', 'timestamp', 'starttime', 'endtime']);
		const valueOf = (r: any, prefer?: string) => {
			for (const f of [prefer, 'total', 'value', 'ratio', 'mean', 'median'].filter(Boolean) as string[]) {
				const n = Number(r?.[f]);
				if (Number.isFinite(n)) return n;
			}
			/* Last resort: the first numeric field that is not bookkeeping.
			 *
			 * Hard-coding the field list turned out to be the same mistake as
			 * hard-coding the metric names. database-size and main-thread-utilization
			 * both arrive on the live instance and both still rendered as em-dashes,
			 * because their number is not in `total`. A gauge whose value sits under a
			 * name nothing predicted is still a gauge, and reading it beats reporting
			 * nothing — with `allMetrics[].fields` publishing what was actually there,
			 * so this stays checkable rather than magic. */
			if (r && typeof r === 'object') {
				for (const [k, v] of Object.entries(r)) {
					if (NON_VALUE.has(k.toLowerCase())) continue;
					if (typeof v !== 'number' || !Number.isFinite(v)) continue;
					return v;
				}
			}
			return null;
		};
		/* Every numeric leaf on a record, one level into nested objects, as dotted
		 * paths. This is the diagnostic that ends the guessing: when a gauge reads
		 * em-dash, this says what its records actually carry. */
		const numericFields = (r: any, depth = 0): string[] => {
			if (!r || typeof r !== 'object') return [];
			const out: string[] = [];
			for (const [k, v] of Object.entries(r)) {
				if (k === 'id' || k === 'metric' || k === 'path' || k === 'method' || k === 'type') continue;
				if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) {
					for (const sub of numericFields(v, depth + 1)) out.push(`${k}.${sub}`);
				} else if (typeof v === 'number' && Number.isFinite(v)) out.push(k);
			}
			return out;
		};
		// Harper writes one row per metric per minute per thread, so a point reading
		// and a window average answer different questions — a utilization spike and a
		// sustained ceiling are not the same problem and shouldn't collapse together.
		/* When a record was written.
		 *
		 * NOT simply `r.time`. The primary key is a composite [timeMs, nodeId], and
		 * on the live instance `time` is frequently absent — so `Number(r.time) || 0`
		 * silently became 0 for every row. Everything built on "the newest sample"
		 * then broke in ways that looked like data rather than like a bug: latestOf
		 * returned the FIRST row it scanned instead of the newest, and grouping by
		 * newest timestamp matched all 80 records in the window at once, which is how
		 * a 4MB database was reported as "17.66GB across 80 databases". Read the
		 * composite id when the field is missing. */
		const timeOf = (r: any): number => {
			const t = Number(r?.time);
			if (Number.isFinite(t) && t > 0) return t;
			const id = r?.id;
			if (Array.isArray(id)) {
				const t0 = Number(id[0]);
				if (Number.isFinite(t0) && t0 > 0) return t0;
			}
			return 0;
		};
		/* Every record sharing the newest timestamp for a metric. Metrics that are
		 * emitted per-database (or per-thread) produce several records an interval,
		 * and picking one of them is arbitrary in a way that is invisible on screen. */
		const latestGroup = (...names: string[]) => {
			const rs = pick(...names);
			if (!rs.length) return [];
			const newest = rs.reduce((m, r) => Math.max(m, timeOf(r)), 0);
			// A metric with no usable timestamp anywhere: one record is all that can
			// honestly be claimed, rather than the whole window summed together.
			if (!newest) return rs.slice(-1);
			return rs.filter((r) => timeOf(r) === newest);
		};
		const latestSum = (...names: string[]) => {
			const vs = latestGroup(...names)
				.map((r) => valueOf(r))
				.filter((v): v is number => v != null);
			return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
		};
		const latestParts = (...names: string[]) => latestGroup(...names).length || null;
		const latestOf = (...names: string[]) => {
			let best: any = null;
			for (const r of pick(...names)) if (!best || timeOf(r) > timeOf(best)) best = r;
			return best;
		};
		// Raw, deliberately unrounded. Rounding here destroyed ratio metrics before
		// they could be converted: round1(0.75) is 0.7, so a 75% window average came
		// out as 70%. Each call site rounds in the unit it is actually reporting.
		const avgOfField = (field: string | undefined, names: string[]) => {
			const xs = pick(...names)
				.map((r) => valueOf(r, field))
				.filter((n): n is number => n != null);
			return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
		};
		const avgOf = (...names: string[]) => avgOfField(undefined, names);
		const sumOf = (...names: string[]) => pick(...names).reduce((a, r) => a + (valueOf(r) || 0), 0);

		// HTTP outcomes arrive as one metric per status (response_200, response_404,
		// response_409…). Counting by prefix means a status this code has never seen
		// still lands somewhere instead of being dropped.
		const byStatus: Record<string, number> = {};
		for (const r of rows) {
			const m = String(r.metric || '');
			if (!m.startsWith('response_')) continue;
			const code = m.slice('response_'.length);
			byStatus[code] = (byStatus[code] || 0) + (Number(r.count) || 0);
		}
		const totalResponses = Object.values(byStatus).reduce((a, b) => a + b, 0);
		const serverErrors = Object.entries(byStatus)
			.filter(([code]) => code.startsWith('5'))
			.reduce((a, [, n]) => a + n, 0);

		/* Slowest paths — GROUPED by path+method across the window.
		 *
		 * These used to be listed raw, one line per analytics record, which on the
		 * real instance meant ten lines of `Metrics GET` each with count 1 and p95
		 * equal to median: a list of the ten slowest individual REQUESTS wearing the
		 * heading "slowest endpoints, by p95". A p95 over one sample is just that
		 * sample. Group first, then report.
		 *
		 * Harper writes these per period, so a row's `count` may be 1 (a single
		 * request) or many (a pre-aggregated period). Both are handled: counts sum,
		 * and the typical figure is weighted by count so a busy period is not given
		 * the same say as a lone slow request. A true window p95 cannot be recovered
		 * from per-period summaries, so the tail is reported as the worst p95 seen
		 * and named `worstMs` rather than dressed up as a percentile it is not. */
		/* Infrastructure traffic is not players, and mixing them makes both numbers
		 * lie. `status` is Harper Fabric's load-balancer probe — @harperdb/status-check,
		 * installed by the platform, not by this app — and on a two-node instance it
		 * runs often enough to dominate the request count. Harper's own operations
		 * (get_usage_licenses and friends) arrive as snake_case names with no HTTP
		 * method, which is what separates them from this app's PascalCase resources.
		 * Neither belongs in "slowest endpoints" or in the denominator of an error
		 * rate that is supposed to describe what players experienced. */
		const PROBE_PATHS = new Set(['status', 'getstatus', 'health', 'healthz', 'healthcheck', 'ping']);
		/* Two different things, kept apart because they mean different things.
		 *
		 * A PROBE is automatic and constant — the platform asking "is this node up"
		 * every few seconds forever. An OPERATION is a person: opening the Harper
		 * console lists your users, describes your tables and reads your components,
		 * and alter_user is somebody changing a password. Calling both "the health
		 * probe" was wrong, and it mattered — a spike in operations is you, and a
		 * spike in probes is the platform deciding something is unwell. */
		/* This dashboard's own endpoints. Listed explicitly rather than pattern-
		 * matched, because the line is about WHO CALLS them, not what they are
		 * named: /Metrics/ looks like tooling and is not — the game client fetches
		 * it on every uplink — while /MetricsSummary/ and /MetricsPlayers/ are only
		 * ever reached by this page. Getting that backwards would move real player
		 * traffic into the tooling bucket and quietly shrink the numbers that
		 * matter. Anything not named here is gameplay. */
		const DASHBOARD_PATHS = new Set(
			[
				'MetricsSummary',
				'MetricsPlayers',
				'GameplayHealth',
				'SaveHealth',
				'ServerHealth',
				'LandingStats',
				'ClearProblem',
				'DashboardAuth',
				'DashboardPage',
				'dashboard',
				'ListFeedback',
				'SystemProbe',
			].map(norm),
		);
		const classify = (path: any, method: any): 'gameplay' | 'dashboard' | 'probe' | 'operation' => {
			const p = String(path || '');
			if (PROBE_PATHS.has(norm(p))) return 'probe';
			// A Harper operation: no HTTP method and a snake_case/lowercase name.
			// This app's resources are PascalCase and always arrive with a method.
			if (!method && /^[a-z][a-z0-9_]*$/.test(p)) return 'operation';
			return DASHBOARD_PATHS.has(norm(p)) ? 'dashboard' : 'gameplay';
		};

		let appCalls = 0;
		let dashCalls = 0;
		let probeCalls = 0;
		let opCalls = 0;
		const probesSeen = new Set<string>();
		const opsSeen = new Set<string>();
		const groups = new Map<
			string,
			{ kind: string; path: string; method: string | null; calls: number; worst: number; wsum: number; wn: number }
		>();
		for (const r of pick('duration', 'transfer', 'request')) {
			if (!r.path) continue;
			const calls0 = Math.max(1, Number(r.count) || 0);
			const kind = classify(r.path, r.method);
			if (kind === 'probe') {
				probeCalls += calls0;
				probesSeen.add(String(r.path));
				continue;
			}
			if (kind === 'operation') {
				opCalls += calls0;
				opsSeen.add(String(r.path));
				continue;
			}
			if (kind === 'dashboard') dashCalls += calls0;
			else appCalls += calls0;
			const method = r.method ? String(r.method) : null;
			const key = `${kind}\u0000${r.path}\u0000${method || ''}`;
			let g = groups.get(key);
			if (!g) groups.set(key, (g = { kind, path: String(r.path), method, calls: 0, worst: 0, wsum: 0, wn: 0 }));
			const calls = Math.max(1, Number(r.count) || 0);
			const tail = Number(r.p95);
			const mid = Number(r.median);
			const typical = Number.isFinite(mid) ? mid : Number(r.mean);
			g.calls += calls;
			if (Number.isFinite(tail)) g.worst = Math.max(g.worst, tail);
			else if (Number.isFinite(typical)) g.worst = Math.max(g.worst, typical);
			if (Number.isFinite(typical)) {
				g.wsum += typical * calls;
				g.wn += calls;
			}
		}
		const rank = (g: any) => ({
			kind: g.kind,
			path: g.path,
			method: g.method,
			// Worst single p95 observed in the window, not a window percentile.
			worstMs: round1(g.worst),
			// Count-weighted typical response, so volume carries the weight.
			typicalMs: g.wn ? round1(g.wsum / g.wn) : null,
			calls: g.calls,
		});
		const byWorst = (a: any, b: any) => b.worstMs - a.worstMs;
		// Two lists, because they answer different questions: one is what players
		// wait for, the other is what this page costs to look at.
		const slowest = [...groups.values()]
			.filter((g) => g.kind === 'gameplay')
			.map(rank)
			.sort(byWorst)
			.slice(0, 10);
		const slowestDashboard = [...groups.values()]
			.filter((g) => g.kind === 'dashboard')
			.map(rank)
			.sort(byWorst)
			.slice(0, 10);

		const util = latestOf('main-thread-utilization', 'mainThreadUtilization', 'thread-utilization', 'utilization');
		// Utilization arrives as a 0-1 ratio from some sources and an already-scaled
		// percent from others (cpu-usage reads 23, thread utilization reads 0.85).
		// round1 on a ratio is destructive — 0.853 becomes 0.9, which is the
		// difference between "comfortable" and "at the ceiling" — so normalise to a
		// percent first and keep one decimal of real precision.
		const asPct = (v: any): number | null => {
			// null must survive as null. Number(null) is 0 and 0 is finite, so the
			// obvious guard let a metric that was never found render as a confident
			// "0%" — a missing gauge and an idle server displayed identically, which
			// is exactly how this panel shipped looking healthy while reading nothing.
			if (v == null || v === '') return null;
			const n = Number(v);
			if (!Number.isFinite(n) || n < 0) return null;
			/* Anything above 100 is not a percentage.
			 *
			 * The old rule was "<= 1 means a ratio, otherwise it is already a
			 * percent", which held for cpu-usage and then met main-thread-utilization
			 * reporting 89,876 — rendered, with total confidence, as "89876%". Some
			 * unit is being used here that this code does not know (microseconds of
			 * busy time, most likely), and the correct response to an unrecognised
			 * unit is to decline rather than to print it with a % sign on the end.
			 * The raw value is published on the metric so it stays diagnosable. */
			if (n > 100) return null;
			return round1(n <= 1 ? n * 100 : n);
		};

		if (rawMetric) {
			const want = norm(rawMetric);
			// Newest first — when you are chasing a unit, the most recent record is
			// the one you want at the top rather than wherever the scan happened to
			// put it.
			const sample = rows
				.filter((r) => norm(r.metric) === want)
				.sort((a, b) => timeOf(b) - timeOf(a))
				.slice(0, 12);
			return {
				generatedAt: now,
				windowMinutes: mins,
				readable,
				readError,
				raw: rawMetric,
				matched: sample.length,
				// Verbatim, so units and per-record breakdowns are visible as they are.
				records: sample,
			};
		}

		const REPL_LATENCY = ['replication-latency', 'replicationLatency', 'replication-lag', 'replicationLag'];
		const seen = [...new Set(rows.map((r) => String(r.metric)))].sort();
		// Anything this endpoint consumed, so the leftovers can be named.
		const matched = new Set(
			[
				'main-thread-utilization',
				'mainThreadUtilization',
				'thread-utilization',
				'utilization',
				'cpu-usage',
				'cpuUsage',
				'cpu',
				'process-cpu',
				'cpu-utilization',
				'memory',
				'memory-usage',
				'memoryUsage',
				'heap-used',
				'rss',
				'database-size',
				'databaseSize',
				'db-size',
				'storage-size',
				'storage-volume',
				'storageVolume',
				'volume-size',
				'disk-size',
				'disk-total',
				'node-storage',
				'nodeStorage',
				'duration',
				'transfer',
				'request',
				'bytes-sent',
				'bytesSent',
				'egress',
				'transfer-out',
				'bytes-received',
				'bytesReceived',
				'ingress',
				'transfer-in',
				...REPL_LATENCY,
			].map(norm),
		);
		for (const m of seen) if (norm(m).startsWith('response')) matched.add(norm(m));

		return {
			generatedAt: now,
			windowMinutes: mins,
			readable,
			readError,
			samples: rows.length,
			cappedAtMaxRows: rows.length >= HEALTH_MAX_ROWS,
			// The capacity ceiling. This app is served by a small number of threads,
			// so sustained utilization is the thing that runs out before anything else.
			threads: {
				utilizationPct: util ? asPct(valueOf(util)) : null,
				/* What the metric actually said, and whether it could be read as a
				 * percentage at all. A gauge that is present but unintelligible is a
				 * different fact from a gauge that is missing, and the panel says which
				 * instead of showing the same em-dash for both. */
				utilizationRaw: util ? valueOf(util) : null,
				utilizationUnitKnown: util ? asPct(valueOf(util)) != null : null,
				windowAvgPct: asPct(
					avgOf('main-thread-utilization', 'mainThreadUtilization', 'thread-utilization', 'utilization'),
				),
				cpuPct: asPct(avgOf('cpu-usage', 'cpuUsage', 'cpu', 'process-cpu', 'cpu-utilization')),
				/* `memory` reports 33 with a max of 84 on the live instance — that is a
				 * percentage, not a byte count, and calling the field memoryBytes was
				 * wrong even though nothing rendered it. Report it as what it is, and
				 * only when it is in a range a percentage can occupy. */
				memoryPct: asPct(valueOf(latestOf('memory', 'memory-usage', 'memoryUsage'))),
			},
			storage: {
				/* Sum the newest sample, not one of them.
				 *
				 * database-size arrives once per DATABASE per interval, so latestOf
				 * returned whichever record happened to land last — 4MB on an instance
				 * whose records range to 437MB, displayed as "0.00GB". Taking every
				 * record sharing the newest timestamp gives the total across
				 * databases, which is what "database size" means on a tile. */
				databaseBytes: latestSum('database-size', 'databaseSize', 'db-size', 'storage-size'),
				databaseParts: latestParts('database-size', 'databaseSize', 'db-size', 'storage-size'),
				volumeBytes: valueOf(latestOf('storage-volume', 'storageVolume', 'volume-size', 'disk-size', 'disk-total')),
				nodeStorageBytes: valueOf(latestOf('node-storage', 'nodeStorage')),
			},
			http: (() => {
				/* The 5xx rate should describe what PLAYERS hit, but the response_*
				 * counters carry no path — they are global per status — so 5xx cannot
				 * be attributed to a route directly. The duration records DO carry
				 * paths, which gives an exact infrastructure request count.
				 *
				 * Subtracting one from the other is only sound if the two families are
				 * counting the same events. They are checked against each other rather
				 * than assumed: if the totals do not reconcile within 5%, the app-only
				 * rate is NOT reported, because scaling a denominator by a ratio that
				 * does not hold is a guess wearing a percentage sign. `basis` says
				 * which of the two you are looking at, every time. */
				// The dashboard's own traffic is not player traffic either. Counting it
				// as such put six requests per page view into the denominator of a
				// rate that is supposed to describe the game.
				const infraCalls = probeCalls + opCalls + dashCalls;
				const totalCalls = appCalls + infraCalls;
				const reconciles =
					totalResponses > 0 && totalCalls > 0 && Math.abs(totalCalls - totalResponses) / totalResponses <= 0.05;
				const appResponses = reconciles ? Math.max(0, totalResponses - infraCalls) : null;
				const basis = appResponses && appResponses > 0 ? 'app' : 'all';
				const denom = basis === 'app' ? (appResponses as number) : totalResponses;
				return {
					responses: totalResponses,
					byStatus,
					serverErrors,
					// Over player traffic where that is defensible, over everything where
					// it is not — and `errorRateBasis` always says which.
					errorRatePct: denom ? round1((serverErrors / denom) * 100) : 0,
					errorRateBasis: basis,
					errorRateOf: denom,
					requests: {
						app: appCalls,
						gameplay: appCalls,
						// This page looking at itself.
						dashboard: dashCalls,
						// The platform asking whether this node is alive.
						probes: probeCalls,
						probePaths: [...probesSeen].sort(),
						// A human in the Harper console, or a tool acting like one.
						operations: opCalls,
						operationPaths: [...opsSeen].sort(),
						infrastructure: infraCalls,
						infrastructurePaths: [...probesSeen, ...opsSeen].sort(),
						// Whether the request records and the response counters agree. When
						// they don't, something is being counted by one and not the other,
						// and that is worth seeing rather than smoothing over.
						reconcilesWithResponses: reconciles,
					},
					slowest,
					slowestDashboard,
					/* How long gameplay actually takes, as a headline rather than
					 * something to be reconstructed from the table below. The 5xx rate
					 * only reports requests that FAILED; a server that answers every
					 * call successfully in two seconds has a perfect error rate and a
					 * game nobody wants to play. Count-weighted so the endpoints players
					 * hit constantly carry the number, and the worst path is named
					 * because "worst 1.4s" without a name is not actionable. */
					gameplayTiming: (() => {
						const gs = [...groups.values()].filter((g) => g.kind === 'gameplay');
						if (!gs.length) return null;
						const calls = gs.reduce((a, g) => a + g.calls, 0);
						const wsum = gs.reduce((a, g) => a + g.wsum, 0);
						const wn = gs.reduce((a, g) => a + g.wn, 0);
						const worstG = gs.reduce((m, g) => (g.worst > (m?.worst ?? -1) ? g : m), null as any);
						return {
							calls,
							typicalMs: wn ? round1(wsum / wn) : null,
							worstMs: worstG ? round1(worstG.worst) : null,
							worstPath: worstG ? worstG.path : null,
							worstMethod: worstG ? worstG.method : null,
							// How many distinct gameplay routes were exercised at all.
							paths: gs.length,
						};
					})(),
				};
			})(),
			// Two nodes replicate behind this, so latency between them is what says
			// whether they are actually keeping up with each other.
			replication: {
				latencyMs: (() => {
					const v = avgOfField('mean', REPL_LATENCY) ?? avgOf(...REPL_LATENCY);
					return v == null ? null : round1(v);
				})(),
				samples: pick(...REPL_LATENCY).length,
				bytesSent: sumOf('bytes-sent', 'bytesSent', 'egress', 'transfer-out'),
				bytesReceived: sumOf('bytes-received', 'bytesReceived', 'ingress', 'transfer-in'),
			},
			/* Every metric name that arrived, and which of them this endpoint knows
			 * what to do with. `unmatched` is the important one: it is the list that
			 * would have told me the gauges were reading the wrong names, instead of
			 * five em-dashes that look exactly like an idle server. It is rendered on
			 * the page, so the panel diagnoses itself next time. */
			metricsSeen: seen,
			metricsUnmatched: seen.filter((m) => !matched.has(norm(m))),
			/* Every metric in the window, aggregated the same way regardless of what
			 * it is. The named gauges above are an opinionated reading of a handful
			 * of these; this is the rest of the telemetry without an opinion, so a
			 * metric this endpoint has never heard of is still legible instead of
			 * being a name in an apology at the bottom of the page. */
			allMetrics: seen
				.map((name) => {
					const rs = pick(name);
					const vals = rs.map((r) => valueOf(r)).filter((v): v is number => v != null);
					let latest: any = null;
					for (const r of rs) if (!latest || timeOf(r) > timeOf(latest)) latest = r;
					const sum = vals.reduce((a, b) => a + b, 0);
					return {
						metric: name,
						samples: rs.length,
						// Counters are worth summing, gauges are worth reading latest. Both
						// are given rather than guessing which kind this metric is.
						latest: latest ? valueOf(latest) : null,
						total: vals.length ? round1(sum) : null,
						mean: vals.length ? round1(sum / vals.length) : null,
						min: vals.length ? round1(Math.min(...vals)) : null,
						max: vals.length ? round1(Math.max(...vals)) : null,
						// A metric with paths is per-route; one without is instance-wide.
						paths: [
							...new Set(
								rs
									.map((r) => r.path)
									.filter(Boolean)
									.map(String),
							),
						].length,
						read: matched.has(norm(name)),
						// Where this metric's numbers actually live. When a gauge above
						// shows an em-dash, this is the field list that explains why.
						fields: [...new Set(rs.flatMap((r) => numericFields(r)))].sort(),
					};
				})
				.sort((a, b) => b.samples - a.samples),
		};
	}
}

export class SystemProbe extends Resource {
	async get() {
		const now = Date.now();
		const steps: any[] = [];
		const step = async (name: string, fn: () => Promise<any>) => {
			try {
				steps.push({ step: name, ok: true, ...((await fn()) || {}) });
			} catch (e: any) {
				steps.push({ step: name, ok: false, error: String(e?.message || e) });
			}
		};

		const dbs: any = (globalThis as any).databases;

		await step('databases global', async () => ({
			present: !!dbs,
			names: dbs ? Object.keys(dbs) : [],
		}));

		await step('system database', async () => {
			const sys = dbs?.system;
			return { present: !!sys, tables: sys ? Object.keys(sys) : [] };
		});

		// The two tables we actually care about, and what they look like.
		for (const tableName of ['hdb_analytics', 'hdb_raw_analytics']) {
			await step(`${tableName} · shape`, async () => {
				const t = dbs?.system?.[tableName];
				if (!t) return { present: false };
				return {
					present: true,
					hasSearch: typeof t.search === 'function',
					hasGet: typeof t.get === 'function',
				};
			});
		}

		// Try to actually read the last hour. Several condition shapes, because the
		// in-process search API and the operations API do not obviously take the
		// same one — whichever returns rows is the answer.
		const since = now - 3_600_000;
		const shapes: Array<{ label: string; query: any }> = [
			{
				label: 'between [since, now]',
				query: { conditions: [{ attribute: 'id', comparator: 'between', value: [since, now] }] },
			},
			{
				label: 'greater_than since',
				query: { conditions: [{ attribute: 'id', comparator: 'greater_than', value: since }] },
			},
			{ label: 'gt since', query: { conditions: [{ attribute: 'id', comparator: 'gt', value: since }] } },
			{ label: 'no conditions, limit 50', query: { limit: 50 } },
		];
		for (const shape of shapes) {
			await step(`hdb_analytics · ${shape.label}`, async () => {
				const t = dbs?.system?.hdb_analytics;
				if (!t || typeof t.search !== 'function') return { skipped: 'table not readable' };
				const rows = await takeFrom(t.search(shape.query), 200);
				// Report the SHAPE of what came back, not the rows themselves — this is
				// reconnaissance, and a telemetry dump is not something to page through.
				const metrics: Record<string, number> = {};
				const types: Record<string, number> = {};
				let oldest = 0;
				let newest = 0;
				for (const r of rows) {
					const m = String(r?.metric || '?');
					metrics[m] = (metrics[m] || 0) + 1;
					const ty = String(r?.type || '?');
					types[ty] = (types[ty] || 0) + 1;
					const id = Number(r?.id) || 0;
					if (id && (!oldest || id < oldest)) oldest = id;
					if (id > newest) newest = id;
				}
				return {
					returned: rows.length,
					cappedAt200: rows.length >= 200,
					metrics,
					types,
					oldest: oldest ? new Date(oldest).toISOString() : null,
					newest: newest ? new Date(newest).toISOString() : null,
					sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
					sample: rows[0] || null,
				};
			});
		}

		// Replication, specifically. There are two nodes behind this, so
		// replication-latency / bytes-sent / bytes-received are the metrics that
		// actually matter — a Problems page for a two-node setup that cannot say
		// whether the nodes are in sync is missing its main job.
		await step('hdb_analytics · replication metrics', async () => {
			const t = dbs?.system?.hdb_analytics;
			if (!t || typeof t.search !== 'function') return { skipped: 'table not readable' };
			const rows = await takeFrom(
				t.search({ conditions: [{ attribute: 'id', comparator: 'between', value: [now - 3_600_000, now] }] }),
				500,
			);
			const wanted = new Set(['replication-latency', 'bytes-sent', 'bytes-received']);
			const hits = rows.filter((r: any) => wanted.has(String(r?.metric)));
			return {
				scanned: rows.length,
				replicationRows: hits.length,
				byMetric: hits.reduce((acc: Record<string, number>, r: any) => {
					acc[r.metric] = (acc[r.metric] || 0) + 1;
					return acc;
				}, {}),
				sample: hits[0] || null,
			};
		});

		// `server` carries cluster information per the component docs. With two nodes
		// replicating, whatever is on here may answer "are both nodes up and caught
		// up" without touching the operations API at all.
		await step('server global', async () => {
			const s: any = (globalThis as any).server;
			if (!s) return { present: false };
			const keys = Object.keys(s);
			// Anything that looks like it knows about the other node.
			const clusterish = keys.filter((k) => /cluster|repl|node|peer|leader|member/i.test(k));
			const detail: Record<string, any> = {};
			for (const k of clusterish) {
				try {
					const v = s[k];
					detail[k] =
						typeof v === 'function' ? 'function' : v && typeof v === 'object' ? Object.keys(v).slice(0, 20) : v;
				} catch (e: any) {
					detail[k] = `threw: ${e?.message || e}`;
				}
			}
			return { present: true, keys: keys.slice(0, 40), clusterish, detail };
		});

		// Node skew, checked the way deploy-coop.sh already checks it: ask both
		// public entry points what build they are serving. This needs no credentials
		// and no operations API — GET /Version/ is public and already exists — and a
		// mismatch is exactly what deploy-coop.sh calls "a stale component or broken
		// replication". Done server-side so there is no cross-origin problem, with a
		// short timeout so a wedged peer cannot hang this request.
		await step('node build skew', async () => {
			const peers = ['https://wild.willows.harperfabric.com', 'https://wild.willows.harperfabric.com:9926'];
			const results = await Promise.all(
				peers.map(async (base) => {
					try {
						const res = await fetch(`${base}/Version/`, {
							headers: { accept: 'application/json' },
							signal: AbortSignal.timeout(3000),
						});
						if (!res.ok) return { node: base, ok: false, status: res.status };
						const body: any = await res.json();
						return { node: base, ok: true, build: body?.build || null };
					} catch (e: any) {
						return { node: base, ok: false, error: String(e?.message || e) };
					}
				}),
			);
			const builds = [...new Set(results.filter((r: any) => r.ok).map((r: any) => r.build))];
			return {
				expected: buildStamp,
				results,
				inSync: builds.length === 1 && builds[0] === buildStamp,
				distinctBuilds: builds.length,
			};
		});

		// The authenticated user, as Harper hands it to an endpoint.
		//
		// This decides how role-based access gets written. `allowRead(user)` is the
		// hook, but the shape of `user` is not documented, and auth code written
		// against a guessed shape fails in exactly two ways: it denies everybody, or
		// it lets everybody in. Neither is discoverable by reading the code. So read
		// the real object off the real server first.
		//
		// Values are described, never echoed — this response is a diagnostic, and a
		// diagnostic that prints password hashes is a new vulnerability.
		await step('authenticated user shape', async () => {
			const ctx: any = (this as any).getContext?.();
			const user: any = ctx?.user;
			if (!user) return { present: false, contextKeys: ctx ? Object.keys(ctx).slice(0, 30) : [] };
			const describe = (v: any): any => {
				if (v === null) return 'null';
				if (Array.isArray(v))
					return `array[${v.length}]${v.length && typeof v[0] === 'string' ? ': ' + v.slice(0, 8).join(',') : ''}`;
				if (typeof v === 'object')
					return Object.fromEntries(
						Object.entries(v)
							.slice(0, 12)
							.map(([k, x]) => [k, describe(x)]),
					);
				if (typeof v === 'string') {
					// Names and role labels are the whole point of this probe; anything
					// that smells like a secret is reported as present, not printed.
					return /pass|hash|salt|secret|token|key/i.test(v) ? `string(${v.length})` : v;
				}
				return typeof v;
			};
			const safe: Record<string, any> = {};
			for (const [k, v] of Object.entries(user)) {
				safe[k] = /pass|hash|salt|secret|token|key/i.test(k) ? `«redacted ${typeof v}»` : describe(v);
			}
			return {
				present: true,
				keys: Object.keys(user),
				shape: safe,
				// The two candidate paths for a role check, resolved against reality.
				'user.role': describe(user.role),
				'user.role?.role': typeof user.role === 'object' ? describe((user.role as any)?.role) : undefined,
			};
		});

		await step('logger global', async () => {
			const l: any = (globalThis as any).logger;
			return { present: !!l, methods: l ? Object.keys(l).slice(0, 20) : [] };
		});

		return {
			checkedAt: now,
			note: 'Throwaway reconnaissance for the Problems page — delete once the answer is known.',
			verdict: steps.find((s) => s.step?.startsWith('hdb_analytics ·') && s.returned > 0)
				? 'hdb_analytics IS readable in-process — the dashboard can show real server health with no stored credentials.'
				: dbs?.system
					? 'system database is visible but no analytics rows came back — check the condition shapes above.'
					: 'system database is NOT visible to this component — server health would need the operations API on :9925.',
			steps,
		};
	}
}

/** Cursor codec. Base64url of the row's playerId — opaque to callers, and it
 *  carries no data a caller could not already read off the row it came from. */
function encodeMetricsCursor(playerId: string): string {
	return nodeBuffer.from(String(playerId), 'utf8').toString('base64url');
}
function decodeMetricsCursor(cursor: string): string | null {
	try {
		const out = nodeBuffer.from(String(cursor), 'base64url').toString('utf8');
		return out || null;
	} catch {
		return null;
	}
}

/**
 * The `?fields=list` shape — enough to draw a table row or a caretaker card and
 * nothing else, for callers that don't need the full record. The dashboard does
 * not use this (it wants everything, so its existing rendering keeps working
 * untouched); it exists so a future list view doesn't have to pull 1.6 KB a head.
 */
function metricsListRow(r: any) {
	return {
		playerId: r.playerId,
		name: r.name,
		edition: r.edition || 'full',
		platform: r.platform,
		os: r.os,
		version: r.version,
		language: r.language,
		status: r.status,
		idle: r.idle,
		createdAt: r.createdAt,
		lastSeenAt: r.lastSeenAt,
		playSeconds: r.playSeconds,
		sessions: r.sessions,
		totalActions: r.totalActions,
		unlockedBiomes: r.unlockedBiomes,
		tutorialStep: r.tutorialStep,
		achievementsEarned: r.achievements?.earned ?? null,
		avgHealth: r.biomeSummary?.avgHealth ?? null,
		appearance: r.appearance,
	};
}

/**
 * GET /BiomeSnapshot/<playerId> — generated SVG "postcards" of each unlocked
 * area, returned both as a base64 data URI (`image`) and raw markup (`svg`).
 * Rendered live from the player's current placements and terrain.
 */
export class BiomeSnapshot extends PublicEndpoint {
	async get() {
		const id = String((this as any).getId?.() || '').trim();
		if (!id) throw new GameError(tr('server.err.snapshotPathId'), 400, 'server.err.snapshotPathId');
		const { player } = await requirePlayer(id);
		const t = db();
		const d = await defs();
		// These three are the largest tables in the database and all three are
		// WORLD-keyed, so `byPlayer` could not use their prefix and fell through to
		// a full scan apiece — on a PUBLIC endpoint whose only gate is knowing a
		// player id, and which then SVG-renders whatever it read. `byWorld` returns
		// the identical rows from the bounded range this world already occupies.
		const wid = worldOf(player);
		const states = (await byWorld(t.BiomeState, wid)).filter((s) => s.unlocked);
		const placements = await byWorld(t.Placement, wid);
		const terrain = await byWorld(t.TerrainTile, wid);

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
		const { playerId, action, area, amount, value, resources, animalId, seed } = await bodyOf(data);
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
				await patchPlayer(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
				log.push(`Set time to ${phase}`);
				break;
			}
			case 'reset-clock': {
				// Restart the game clock at day one's morning — the same starting time a
				// fresh save gets. Solve for the offset that lands the current play time
				// back on the day-phase start (season resets to the first day too).
				const playMs = Math.round((readMetrics(player)?.playSeconds || 0) * 1000);
				await patchPlayer(playerId, { clockOffsetMs: nextPhaseAt(0, 'day') - playMs });
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
				await patchPlayer(playerId, { inventory });
				break;
			}
			case 'max-tools': {
				const tools = { ...(player.tools || {}) };
				for (const tool of d.tools) {
					const top = Math.max(...tool.tiers.map((ti: any) => ti.tier));
					tools[tool.id] = top;
				}
				await patchPlayer(playerId, { tools });
				log.push('All tools set to max tier');
				break;
			}
			case 'unlock-all': {
				const ids = d.biomes.map((b: any) => b.id);
				await patchPlayer(playerId, { unlockedBiomes: ids });
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
				await patchPlayer(playerId, { unlockedBiomes: [...unlocked] });
				await t.BiomeState.patch(`${playerId}:${nextB.id}`, { unlocked: true });
				await seedStartingTerrain(playerId, playerId, nextB.id);
				log.push(`Unlocked the next area: ${nextB.name}`);
				break;
			}
			case 'relock-all': {
				// re-lock everything except the meadow, to retest the whole unlock flow
				await patchPlayer(playerId, { unlockedBiomes: ['meadow'] });
				for (const b of d.biomes) await t.BiomeState.patch(`${playerId}:${b.id}`, { unlocked: b.id === 'meadow' });
				log.push('Re-locked every biome except the meadow');
				break;
			}
			case 'reset-tools': {
				await patchPlayer(playerId, { tools: { ...START_TOOLS } });
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
				const chestId = `${wid}:pl_${playerId}_starter-chest`;
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
				await patchPlayer(playerId, {
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
				await patchPlayer(playerId, { home });
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
				await patchPlayer(playerId, { home });
				log.push('Home maxed on every track');
				break;
			}
			case 'reset-home': {
				await patchPlayer(playerId, { home: { ...DEFAULT_HOME } });
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
				if (ar === 'meadow') throw new GameError(tr('server.err.meadowCannotLock'), 400, 'server.err.meadowCannotLock');
				const unlocked = (player.unlockedBiomes || []).filter((b: string) => b !== ar);
				await patchPlayer(playerId, { unlockedBiomes: unlocked });
				await t.BiomeState.patch(`${playerId}:${ar}`, { unlocked: false });
				log.push(`Locked ${ar} again (unlock requirements must be met to re-enter)`);
				break;
			}
			case 'unlock-recipes': {
				// Toggle the dev "all recipes craftable" override (ignores progress gates).
				const next = value === undefined ? !player.devUnlockAll : !!value;
				await patchPlayer(playerId, { devUnlockAll: next });
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
				if (!animal)
					throw new GameError(tr('server.err.unknownAnimal', { animal: animalId }), 400, 'server.err.unknownAnimal');
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
					await patchPlayer(playerId, { unlockedBiomes: [...unlocked, animal.biome] });
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
				// and comfortable, and health/balance pinned at 100 — with at least one of
				// EVERY object the biome can build standing somewhere, so the shot doubles
				// as a look at the whole catalogue. Every run lays out a DIFFERENT scene,
				// so you can keep hitting the button until one frames well; pass back the
				// `seed` from the log to rebuild an exact one. Chests are kept (and not
				// added); all other placements + terrain here are replaced for a clean look.
				const ar = area || player.area;
				const wid = worldOf(player);
				// One seed drives the whole layout — the lake, the river's course, every
				// cluster and accent (or, indoors, where each piece of furniture lands).
				// It changes per run so Populate reshuffles the scene instead of rebuilding
				// the same one; passing a seed back (it's printed in the log) reproduces
				// that exact scene, which is what the old fixed `populate:world:biome` seed
				// gave you every time.
				const runSeed =
					seed === undefined || seed === null || seed === ''
						? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
						: String(seed);

				// ---- the home interior gets its own showcase -----------------------
				// Same idea indoors, different furniture: max every upgrade track (the
				// biggest floor, and the pieces that need a real house become legal),
				// clear the floor, then set out one of everything that fits. Wall-hung
				// things go against the walls and rugs land in the open middle, so it
				// reads as a furnished room rather than a jumble.
				if (ar === 'home') {
					const rng = seededRng(hash32(`populate:${wid}:home:${runSeed}`));
					const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
					const home = {
						style: homeOf(player).style || 'cabin',
						space: HOME_TRACKS.space.levels.length,
						comfort: HOME_TRACKS.comfort.levels.length,
						decor: HOME_TRACKS.decor.levels.length,
						light: HOME_TRACKS.light.levels.length,
						styleLocked: true,
					};
					await patchPlayer(playerId, { home });
					const r = homeRoom({ ...player, home });
					const door = doorTileOf(r);
					const AGED = Date.now() - 45 * 86400000;

					// clean floor — the player's chests and what's in them stay put
					const taken = new Set<string>();
					for (const pl of (await byWorld(t.Placement, wid)).filter((p) => p.area === 'home')) {
						if (d.object.get(pl.objectId)?.isChest) {
							taken.add(`${pl.x},${pl.y}`);
							continue;
						}
						await t.Placement.delete(pl.id);
					}
					(await byWorld(t.Chest, wid)).filter((c) => c.area === 'home').forEach((c) => taken.add(`${c.x},${c.y}`));

					// everything indoor-or-both that this (now maxed) house can hold
					const fits = d.objects.filter(
						(o: any) =>
							o.placement !== 'outdoor' &&
							o.placement !== 'none' &&
							!o.isChest &&
							!o.bridge &&
							(o.homeMin || 0) <= home.space,
					);
					// The doorway and the ring around it stay clear for everything, not
					// just beds: a screenshot wants to see the way out, and it keeps the
					// authoritative blocksDoorway rule satisfied for free.
					const openFloor = (x: number, y: number) =>
						x >= r.x0 &&
						x <= r.x1 &&
						y >= r.y0 &&
						y <= r.y1 &&
						!(Math.abs(x - door.x) <= 1 && Math.abs(y - door.y) <= 1) &&
						!taken.has(`${x},${y}`);
					const rows: any[] = [];
					const put = (def: any, x: number, y: number): boolean => {
						if (!openFloor(x, y)) return false;
						taken.add(`${x},${y}`);
						const row: any = {
							id: `${wid}:pl_dev_home_${x}_${y}`,
							worldId: wid,
							playerId,
							objectId: def.id,
							area: 'home',
							x,
							y,
							placedAt: AGED,
						};
						if (def.plantable) row.plantedAt = AGED;
						rows.push(row);
						return true;
					};
					/** Tiles touching a wall — where anything hung or shelved belongs. */
					const againstWall = (x: number, y: number) => x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1;
					const WALL_HUNG = /painting|wallclock|shelf|chandelier|string-lights|telescope|dresser|bookshelf/;
					const FLOOR_SPREAD = /rug|reedmat|blanket|cushions|hammock/;
					const putSomewhere = (def: any): boolean => {
						const wants: ((x: number, y: number) => boolean) | null = WALL_HUNG.test(def.id)
							? againstWall
							: FLOOR_SPREAD.test(def.id)
								? (x, y) => !againstWall(x, y)
								: null;
						// the tiles this piece prefers first, then anywhere in the room, then
						// a sweep so a full floor can't silently drop a piece
						for (const test of wants ? [wants, null] : [null]) {
							for (let tries = 0; tries < 80; tries++) {
								const x = ri(r.x0, r.x1),
									y = ri(r.y0, r.y1);
								if (test && !test(x, y)) continue;
								if (put(def, x, y)) return true;
							}
						}
						for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (put(def, x, y)) return true;
						return false;
					};
					const missing: string[] = [];
					for (const def of fits) if (!putSomewhere(def)) missing.push(def.id);
					for (const row of rows) await t.Placement.put(row);

					log.push(
						`Furnished the home (${home.space === HOME_TRACKS.space.levels.length ? 'maxed' : 'space ' + home.space}): ` +
							`${rows.length} pieces, ${fits.length - missing.length} of ${fits.length} object types` +
							(missing.length ? ` — no floor left for ${missing.join(', ')}` : ''),
					);
					log.push(`Layout seed ${runSeed} — run Populate again for a different one, or pass this seed to rebuild it`);
					break;
				}

				const biome = d.biome.get(ar);
				if (!biome)
					throw new GameError(tr('server.err.cannotPopulate', { area: ar }), 400, 'server.err.cannotPopulate');

				// make sure the area is reachable so you can walk in and film it
				const unlockedSet = new Set<string>(player.unlockedBiomes || ['meadow']);
				if (!unlockedSet.has(ar)) {
					unlockedSet.add(ar);
					await patchPlayer(playerId, { unlockedBiomes: [...unlockedSet] });
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

				const rng = seededRng(hash32(`populate:${wid}:${ar}:${runSeed}`));
				const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
				const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

				const occupied = new Set<string>();
				(await byWorld(t.Chest, wid)).filter((c) => c.area === ar).forEach((c) => occupied.add(`${c.x},${c.y}`));
				const free = (x: number, y: number) =>
					x >= xMin && x <= xMax && y >= yMin && y <= yMax && !inCamp(x, y) && !occupied.has(`${x},${y}`);

				// ---- water: shovel out a lake (big blob) and a river (long channel) ----
				const waterCells: { x: number; y: number }[] = [];
				const waterAt = new Set<string>();
				/** Carve one cell. False when it was refused: camp, board edge, already taken. */
				const carve = (x: number, y: number): boolean => {
					if (!free(x, y)) return false;
					occupied.add(`${x},${y}`);
					waterAt.add(`${x},${y}`);
					waterCells.push({ x, y });
					return true;
				};
				/** Move the river onto a cell, carving it unless it is already water. Water
				 *  the channel laid down earlier is somewhere it can keep flowing THROUGH —
				 *  only genuinely forbidden ground (camp, lake, edge) turns it back. */
				const flow = (x: number, y: number): boolean => carve(x, y) || waterAt.has(`${x},${y}`);
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
					//
					// carve() REFUSES a cell that isn't free — the camp box, the lake, the
					// board edge — and a refused step used to be skipped in place. That
					// punched a hole straight THROUGH the channel rather than shortening it:
					// the meadow's camp sits at x19-24 / y3-6 and the river starts somewhere
					// in x22-40, so about one scene in six arrived as two short stubs with the
					// middle missing — the longer piece as little as five tiles. A blocked step
					// now flows AROUND the obstruction, and the walk counts the rows it
					// actually carved rather than the turns it took, so the river comes out one
					// long connected run whatever it has to get past.
					let rx = ri(Math.floor((xMin + xMax) / 2), xMax - 2),
						ry = yMin;
					while (!carve(rx, ry) && rx < xMax) rx++; // an open cell to spring from
					const riverRows = ri(13, 18);
					// Every pass either moves the head or gives up, so this terminates on its
					// own — the guard is belt and braces, sized to leave room for the bends and
					// detours that cost a pass without gaining a row.
					for (let rows = 1, guard = 0; rows < riverRows && ry < yMax && guard < 6 * riverRows; guard++) {
						// an occasional bend, for a channel that winds rather than ruling a line
						if (rng() < 0.25 && rx > xMin + 1 && rx < xMax - 1) {
							const bx = rx + (rng() < 0.5 ? -1 : 1);
							if (flow(bx, ry)) rx = bx;
							continue;
						}
						if (flow(rx, ry + 1)) {
							ry += 1;
							rows += 1; // only downstream progress counts toward the river's length
							if (rng() < 0.25) carve(Math.min(xMax, rx + 1), ry); // gentle widening (adjacent)
							continue;
						}
						// Blocked below. Sidestep — still 4-connected to the cell the head is on
						// — and try to resume downhill from there, so the water flows AROUND the
						// camp instead of leaving a hole in the middle of the channel.
						const dir = rx < xMax - 1 ? 1 : -1;
						if (flow(rx + dir, ry)) {
							rx += dir;
							continue;
						}
						if (flow(rx - dir, ry)) {
							rx -= dir;
							continue;
						}
						break; // boxed in both ways; the river ends here
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
				if (!usable.length)
					throw new GameError(
						tr('server.err.noPlaceableObjects', { biome: biome.name }),
						400,
						'server.err.noPlaceableObjects',
					);
				// The trail tent is one-per-area, so it stays out of the random scatter and
				// is placed exactly once by the coverage pass — two tents in a screenshot
				// is a bug the eye catches immediately.
				const scatter = usable.filter((o: any) => !o.onePerArea);
				const isPath = (o: any) => /-path$/.test(o.id) || o.id === 'wooden-fence' || o.id === 'dry-stone-wall';
				const trees = scatter.filter((o: any) => o.plantable && (o.growSeconds || 0) >= 80);
				const flowers = scatter.filter((o: any) => o.plantable && (o.growSeconds || 0) < 80);
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
				const nature = scatter.filter((o: any) => !o.plantable && !isPath(o) && NATURE.has(o.id));
				const paths = scatter.filter(isPath);
				const decor = scatter.filter((o: any) => !o.plantable && !isPath(o) && !NATURE.has(o.id));
				const undergrowth = nature.length ? nature : flowers; // fallback for biomes with no "nature" props

				const places: any[] = [];
				const place = (def: any, x: number, y: number) => {
					if (!def || !free(x, y)) return false;
					occupied.add(`${x},${y}`);
					const row: any = {
						id: `${wid}:pl_dev_${ar}_${x}_${y}`,
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
					place(pick(scatter), ri(xMin, xMax), ri(yMin, yMax));
				}

				// ---- coverage: one of EVERY buildable thing this biome has ----
				// The passes above pick at random, so a showcase shot would routinely
				// miss half the catalogue — no good when the point is to see all of it
				// at once. Anything not already standing gets planted here: random tries
				// first (so it lands scattered, like the accent pass), then a systematic
				// sweep so a crowded map can't silently drop an object.
				const placeAnywhere = (def: any): boolean => {
					for (let tries = 0; tries < 60; tries++) if (place(def, ri(xMin, xMax), ri(yMin, yMax))) return true;
					for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) if (place(def, x, y)) return true;
					return false;
				};
				const standing = new Set<string>(places.map((r) => r.objectId));
				const missing: string[] = [];
				for (const def of usable) {
					if (standing.has(def.id)) continue;
					if (placeAnywhere(def)) standing.add(def.id);
					else missing.push(def.id);
				}

				// Bridges belong ON the water, so they get their own pass: cross the
				// channel where it's one tile wide, falling back to any open cell. A
				// biome that can't be flooded (the desert) simply has nowhere to put one.
				const bridgeDefs = d.objects.filter(
					(o: any) => (o.biomes || []).includes(ar) && o.bridge && o.placement !== 'indoor',
				);
				const spannedWater = new Set<string>();
				const crossing = (c: { x: number; y: number }) =>
					!waterAt.has(`${c.x - 1},${c.y}`) && !waterAt.has(`${c.x + 1},${c.y}`);
				for (const def of bridgeDefs) {
					const cell =
						waterCells.find((c) => !spannedWater.has(`${c.x},${c.y}`) && crossing(c)) ||
						waterCells.find((c) => !spannedWater.has(`${c.x},${c.y}`));
					if (!cell) {
						missing.push(def.id);
						continue;
					}
					spannedWater.add(`${cell.x},${cell.y}`);
					standing.add(def.id);
					places.push({
						id: `${wid}:pl_dev_${ar}_${cell.x}_${cell.y}`,
						worldId: wid,
						playerId,
						objectId: def.id,
						area: ar,
						x: cell.x,
						y: cell.y,
						placedAt: OLD,
					});
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
				log.push(
					`Every buildable thing is standing: ${standing.size} of ${usable.length + bridgeDefs.length} object types` +
						(missing.length ? ` — nowhere to put ${missing.join(', ')}` : ''),
				);
				log.push(`Layout seed ${runSeed} — run Populate again for a different one, or pass this seed to rebuild it`);
				break;
			}
			case 'set-weather': {
				// Force the weather and/or season for filming — a persistent override
				// on the player that the snapshot (and the client's live clock) honor.
				// `value: { type?, season? }` merges into the current override; a null/
				// empty value (or value.clear) lifts the override back to the live sky.
				const v = value && typeof value === 'object' ? value : null;
				if (!v || v.clear) {
					await patchPlayer(playerId, { devWeather: null });
					log.push('Weather override cleared — back to the live sky');
					break;
				}
				const cur = player.devWeather || {};
				const next: any = { type: cur.type ?? null, season: cur.season ?? null };
				if ('type' in v) {
					if (v.type && !WEATHER_TYPES.includes(v.type))
						throw new GameError(
							tr('server.err.unknownWeatherType', { type: v.type }),
							400,
							'server.err.unknownWeatherType',
						);
					next.type = v.type || null;
				}
				if ('season' in v) {
					if (v.season && !SEASONS.includes(v.season))
						throw new GameError(tr('server.err.unknownSeason', { season: v.season }), 400, 'server.err.unknownSeason');
					next.season = v.season || null;
				}
				await patchPlayer(playerId, { devWeather: next });
				log.push(`Weather override: ${next.type || 'live'} · ${next.season || 'live'}`);
				break;
			}
			default:
				throw new GameError(tr('server.err.unknownDevAction', { action }), 400, 'server.err.unknownDevAction');
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
		if (!message) throw new GameError(tr('server.err.feedbackEmpty'), 400, 'server.err.feedbackEmpty');
		if (message.length > FEEDBACK_MAX_CHARS)
			throw new GameError(
				tr('server.err.feedbackTooLong', { max: FEEDBACK_MAX_CHARS }),
				400,
				'server.err.feedbackTooLong',
			);
		const replyTo =
			String(body.replyTo || '')
				.trim()
				.slice(0, 200) || null;
		if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo))
			throw new GameError(tr('server.err.feedbackBadEmail'), 400, 'server.err.feedbackBadEmail');
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
// slot. The global roll-up (/MetricsSummary/ + /MetricsPlayers/) then reports
// solo players alongside the hosted (web/co-op) ones.

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
		if (!clientId) throw new GameError(tr('server.err.clientIdRequired'), 400, 'server.err.clientIdRequired');
		const snapshot =
			body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot) ? body.snapshot : null;
		if (!snapshot) throw new GameError(tr('server.err.snapshotRequired'), 400, 'server.err.snapshotRequired');
		// Store the metrics view as a JSON STRING, not a nested map: this table is
		// typed (positional structon encoding), which cannot safely hold a nested
		// object — a scalar string round-trips cleanly. Read back with JSON.parse
		// in the /MetricsSummary/ roll-up.
		const snapshotJson = JSON.stringify(snapshot);
		if (snapshotJson.length > METRICS_SNAPSHOT_MAX_BYTES)
			throw new GameError(tr('server.err.snapshotTooLarge'), 400, 'server.err.snapshotTooLarge');

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
		dashboardCache.invalidate(); // new data landed — the next dashboard read refreshes
		return { ok: true };
	}
}

// ---------------------------------------------------------------- app-open funnel
// Acquisition tracking that does NOT need a save to exist: the client pings this
// the moment the app opens (phase "open") and again once a character is created
// (phase "created"). Rows are keyed per install/device, so /MetricsSummary/ can report
// how many people opened the app, how many created a character (vs bounced), the
// average time spent in the creator, and how many characters each person makes.

/**
 * POST /AppOpen/ {deviceId, phase?, platform?, os?, version?, language?, creationMs?}
 *   phase "open"    — app launched (counted toward opens)
 *   phase "created" — a character was just created (marks the device converted,
 *                     bumps savesCreated, and records the creator time)
 *   phase "kb_gate" — the keyboard gate turned this device away, with
 *                     keyboardGatePassed:true on a later ping if a keyboard
 *                     turned up and it got in after all. NOT counted toward
 *                     opens: it describes a launch that already pinged, and
 *                     double-counting it would inflate the denominator of every
 *                     rate on the acquisition panel.
 *   phase "demo_nudge" — the demo's "are you done playing?" prompt, with
 *                     nudgeStep 'shown' | 'exported' | 'store'. Same rule as the
 *                     gate: describes a launch that already pinged, so it is NOT
 *                     counted toward opens.
 *   phase "demo_end" — the end-of-demo popup, with endStep 'exported' | 'store'.
 *                     Kept apart from demo_nudge because the two screens answer
 *                     different questions and used to be conflated; the popup's
 *                     denominator is reachedDemoGoal, so it needs no 'shown'.
 *                     Not counted toward opens either.
 * Upserts one row per device. Best-effort; safe to point analytics at.
 */
export class AppOpen extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const deviceId = String(body.deviceId || '')
			.trim()
			.slice(0, 64);
		if (!deviceId) throw new GameError(tr('server.err.deviceIdRequired'), 400, 'server.err.deviceIdRequired');
		const phase =
			body.phase === 'created'
				? 'created'
				: body.phase === 'resumed'
					? 'resumed'
					: body.phase === 'demo_done'
						? 'demo_done'
						: body.phase === 'demo_nudge'
							? 'demo_nudge'
							: body.phase === 'demo_end'
								? 'demo_end'
								: body.phase === 'kb_gate'
									? 'kb_gate'
									: 'open';
		const now = Date.now();
		const t = db();
		const id = `dev:${deviceId}`;
		// Same cold-start hazard as LandingStat: a spurious null here would reset
		// this device's open count and its converted/firstConvertedAt funnel flags.
		const existing = await findCounterRow(t.AppOpen, id);
		const cms = clamp(Math.round(Number(body.creationMs) || 0), 0, 60 * 60_000);
		await t.AppOpen.put({
			id,
			deviceId,
			platform: String(body.platform || '').slice(0, 20) || existing?.platform || null,
			// Which channel handed this device its copy (itch | mas | direct |
			// dev). Orthogonal to `platform`, because itch ships both a download and
			// the browser demo.
			//
			// FIRST-WINS, unlike platform/os/version. Those describe the device as it
			// is right now and should follow it; a channel describes where the copy
			// was ACQUIRED, and that never changes for a given install. Last-wins
			// would let one player who later opens the browser demo silently re-file
			// their original itch download, which is how an acquisition number quietly
			// stops meaning acquisition. Safe to add here at all only because AppOpen
			// is a dynamic table — see the schema note before adding fields to a typed
			// one like SoloMetrics.
			channel:
				existing?.channel ||
				String(body.channel || '')
					.trim()
					.toLowerCase()
					.slice(0, 16) ||
				null,
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
			/* Picked up an existing save — Continue, Load Game, or a passcode login.
			 *
			 * Kept as its OWN flag rather than folded into `converted`, for two
			 * reasons. `converted` means "made a character" and has months of history
			 * behind it; quietly widening it would rewrite what every past number
			 * meant. And the two facts answer different questions — creation measures
			 * whether the game gets people started, resumption measures whether it
			 * gets them back. The funnel below combines them into "played"; the raw
			 * flags stay separable forever.
			 *
			 * Sticky: someone who returned once has returned, whatever they do next. */
			/* One of our own machines rather than a player's (see isDevDevice() in
			 * src/platform.ts). Deliberately NOT sticky-true like the others: this one
			 * has to be undoable, or a mis-marked device is excluded from the numbers
			 * forever with no way back. An absent flag leaves whatever was there. */
			isDev: body.dev === true ? true : body.dev === false ? false : existing?.isDev || false,
			resumed: existing?.resumed || phase === 'resumed',
			firstResumedAt: existing?.firstResumedAt || (phase === 'resumed' ? now : 0),
			// How many characters this person has created.
			savesCreated: (existing?.savesCreated || 0) + (phase === 'created' ? 1 : 0),
			// Keep the most recent creator time we've seen for this device.
			creationMs: phase === 'created' && cms > 0 ? cms : existing?.creationMs || 0,
			// Demo completion: reached the hard-stop (goal animals returned). Sticky,
			// so it survives the save being reset when the thank-you popup is dismissed.
			reachedDemoGoal: existing?.reachedDemoGoal || phase === 'demo_done',
			demoGoalAt: existing?.demoGoalAt || (phase === 'demo_done' ? now : 0),
			/* The "are you done playing?" prompt (src/ui/DemoNudge.tsx), as three
			 * sticky flags rather than a count: raised, exported a save from it,
			 * clicked through to a store. Sticky because the question is how many
			 * PEOPLE it moved, not how many times it fired — and it only ever fires
			 * once per page load anyway.
			 *
			 * `shown` is its own flag instead of being inferred from the other two.
			 * Without it, a prompt that everyone dismisses is indistinguishable from
			 * a prompt that never appeared, and those call for opposite fixes. */
			demoNudgeShown: existing?.demoNudgeShown || phase === 'demo_nudge',
			demoNudgeExported: existing?.demoNudgeExported || (phase === 'demo_nudge' && body.nudgeStep === 'exported'),
			demoNudgeStore: existing?.demoNudgeStore || (phase === 'demo_nudge' && body.nudgeStep === 'store'),
			demoNudgeAt: existing?.demoNudgeAt || (phase === 'demo_nudge' ? now : 0),
			/* The end-of-demo popup (DemoCompleteModal in src/App.tsx), same idea,
			 * two flags. No `shown` twin: reachedDemoGoal above already IS the
			 * screen's denominator — every device that reaches the budget reports
			 * demo_done and then sees this popup — so a third flag would be a second
			 * copy of that number, free to drift from it.
			 *
			 * Separate from the nudge's flags on purpose. They were one funnel while
			 * the end screen had no store link at all, which meant the nudge's
			 * store-click rate was silently carrying every click in the demo and
			 * looked healthy for it. */
			demoEndExported: existing?.demoEndExported || (phase === 'demo_end' && body.endStep === 'exported'),
			demoEndStore: existing?.demoEndStore || (phase === 'demo_end' && body.endStep === 'store'),
			demoEndAt: existing?.demoEndAt || (phase === 'demo_end' ? now : 0),
			/* The keyboard gate. Both sticky, and deliberately so: this is the one
			 * question a device answers ONCE and then keeps answering differently.
			 * A phone that was turned away in March is still a phone that was turned
			 * away, even though today's ping is a launch like any other — so
			 * `keyboardGated` must not be re-derived from the current request.
			 *
			 * keyboardGatePassed is separate rather than an unset of keyboardGated,
			 * because "shown the screen" and "stopped by it" are different numbers
			 * and only the second one is a lost player. A tablet with a Bluetooth
			 * keyboard trips the gate for the half-second before a key is pressed;
			 * folding that into the blocked count would repeat, in a new number, the
			 * bounce-rate mistake this field exists to correct. */
			keyboardGated: existing?.keyboardGated || phase === 'kb_gate',
			keyboardGatePassed: existing?.keyboardGatePassed || (phase === 'kb_gate' && body.keyboardGatePassed === true),
			keyboardGatedAt: existing?.keyboardGatedAt || (phase === 'kb_gate' ? now : 0),
			updatedAt: now,
		});
		// Both caches, because the acquisition rows now have their own. Invalidation
		// is deliberately cheap (a flag and a counter — no scan, no await), and this
		// is what keeps read-your-own-write true for the funnel: a ping followed by a
		// dashboard read must show the ping, which is exactly what the keyboard-gate
		// and menu-metrics integration tests assert.
		dashboardCache.invalidate(); // acquisition numbers changed — refresh on the next read
		appOpenCache.invalidate();
		return { ok: true };
	}
}

// ---------------------------------------------------------------- landing page: analytics
// The marketing landing page (GET /) sends anonymous, aggregate-only usage
// pings. Nothing here is personal data, and nothing here ever was after the
// mailing list was removed: the form, the MailingListSignup table and the
// admin-only ListMailingList reader all went with it, so the landing page now
// collects no email address by any route. The subreddit is the follow-along
// channel in its place.
//  • LandingStat keeps ONE row per UTC day (`day:YYYY-MM-DD`) of plain
//    counters. Increments are read-modify-write like AppOpen — fine at
//    landing-page traffic, and analytics losing the odd count to a rare race
//    is acceptable by design.

// Click targets the landing page reports (data-track attributes). Anything
// else collapses into "other" so junk can't mint unbounded counter keys.
const LANDING_CLICK_TARGETS = new Set([
	'appstore',
	'itch',
	// 'play' is the landing page's primary CTA — it opens the browser demo at
	// /play on this domain. 'demo' is what that same button reported back when it
	// pointed at the itch storefront instead; kept so the historical counts stay
	// readable rather than quietly changing meaning mid-series.
	'play',
	'demo',
	'theme',
	'privacy',
	'support',
	'get-nav',
	'gallery',
	'edu-nav',
	// /teachers reports itself here, once per browser session, as a click rather
	// than a visit. Visits are ONE undifferentiated series shared by every page
	// that sends them, so a teachers-page visit would silently inflate the landing
	// page's number with no way to unmix them later. Its own target keeps both
	// numbers honest. See the comment in public/teachers.html's script.
	'edu-page',
	'pdf-guide',
	'pdf-worksheets',
	'school-copy',
	// The subreddit card in the landing page's Updates section, and the matching
	// footer link. Its own target rather than "other" so the dashboard can say how
	// many people the page actually sends to the community.
	'reddit',
]);
const landingDay = (t: number) => new Date(t).toISOString().slice(0, 10); // UTC day

const LANDING_STATS_CACHE_MS = 15_000;

/**
 * The landing-page counter rollup: scan every LandingStat day-row, sum the
 * totals, and count the mailing list. Behind a stale-while-revalidate cache
 * (see RollupCache) because bumpLandingStat fires on every single landing visit
 * and used to drop this on the floor each time.
 */
async function buildLandingStats(): Promise<any> {
	const now = Date.now();
	const t = db() as any;
	let rows: any[] = [];
	try {
		rows = t.LandingStat ? await allOf(t.LandingStat) : [];
	} catch {
		rows = [];
	}
	rows = rows.filter((r: any) => r && r.day).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));
	const totals = {
		visits: 0,
		uniques: 0,
		clicks: {} as Record<string, number>,
		downloads: {} as Record<string, number>,
	};
	for (const r of rows) {
		totals.visits += r.visits || 0;
		totals.uniques += r.uniques || 0;
		for (const [k, v] of Object.entries(r.clicks || {})) totals.clicks[k] = (totals.clicks[k] || 0) + (Number(v) || 0);
		for (const [k, v] of Object.entries(r.downloads || {}))
			totals.downloads[k] = (totals.downloads[k] || 0) + (Number(v) || 0);
	}
	/* How many day-rows ride along with the totals.
	 *
	 * Was 60, chosen when the dashboard drew a fixed last-14-days histogram off
	 * the tail of this list. That chart now has the same preset row as New
	 * caretakers per day — 7d / 30d / 90d / All — and a 90d preset reading a
	 * 60-day payload silently shows 60 days under a "90d" pill, which is the
	 * kind of wrong that never announces itself. Sized to cover the widest
	 * preset with room to spare; these are eight small numbers per day, so the
	 * payload cost of the extra two months is trivial. */
	const LANDING_DAYS_RETURNED = 180;
	const days = rows.slice(-LANDING_DAYS_RETURNED).map((r: any) => ({
		day: r.day,
		visits: r.visits || 0,
		uniques: r.uniques || 0,
		clicks: r.clicks || {},
		totalClicks: sumValues(r.clicks),
		downloads: r.downloads || {},
		totalDownloads: sumValues(r.downloads),
	}));
	return {
		generatedAt: now,
		today: landingDay(now),
		totals: {
			...totals,
			totalClicks: sumValues(totals.clicks),
			totalDownloads: sumValues(totals.downloads),
		},
		days,
	};
}

const landingStatsCache = new RollupCache<any>(LANDING_STATS_CACHE_MS, buildLandingStats);

/** Copy a stored `{ key: count }` map into a fresh, plain, sane object. Anything
 *  that isn't a finite positive number is dropped rather than carried forward. */
function countMap(stored: any): Record<string, number> {
	const out: Record<string, number> = {};
	if (stored && typeof stored === 'object' && !Array.isArray(stored))
		for (const [k, v] of Object.entries(stored)) {
			const n = Number(v);
			if (Number.isFinite(n) && n > 0) out[k] = n;
		}
	return out;
}

/** Apply one mutation to today's LandingStat row. Never throws — a metrics
 *  hiccup (table not deployed yet, decode error, …) must not break the caller.
 *
 *  The mutation is applied to a PLAIN object rebuilt from the stored row, never to
 *  the record Harper handed back. Harper FREEZES every record it decodes (its row
 *  cache depends on that), and this bundle is ESM — strict mode — so `row.visits =
 *  …` on a fetched record throws "Cannot assign to read only property". That throw
 *  landed in the catch below and was quietly logged, so every increment after the
 *  day's row existed was thrown away: each day stayed at whatever the FIRST event
 *  of the day wrote, i.e. visits: 1. That is the "one visit a day" the dashboard
 *  was reporting — not the traffic, the write.
 *
 *  Every other counter in this file (AppOpen, flushRefusals, noteSaveIncident)
 *  already rebuilds a literal before put; this was the one that mutated in place.
 *  The integration harness handed back structuredClones, which are writable, so
 *  the tests passed while production flatlined — tests/integration/harness.ts now
 *  freezes reads the way Harper does, so this can't come back unnoticed. */
async function bumpLandingStat(mutate: (row: any) => void): Promise<void> {
	try {
		const table = (db() as any).LandingStat;
		if (!table) return; // schema table not created yet — drop the count, not the request
		const now = Date.now();
		const day = landingDay(now);
		const id = `day:${day}`;
		// findCounterRow, NOT safeGet: a cold-start null from a primary-key .get()
		// would look like "first event of the day" and reset the row to zero.
		const stored = await findCounterRow(table, id);
		const row: any = {
			id,
			day,
			visits: Number(stored?.visits) || 0,
			uniques: Number(stored?.uniques) || 0,
			clicks: countMap(stored?.clicks),
			downloads: countMap(stored?.downloads),
		};
		mutate(row);
		row.updatedAt = now;
		await table.put(row);
		landingStatsCache.invalidate(); // new numbers — the next LandingStats read refreshes
	} catch (e: any) {
		console.error('landing stat bump failed —', e?.message || e);
	}
}

/** One classroom-PDF download, counted server-side by the pdf endpoints below.
 *  This is the honest number: it also catches the direct links teachers forward to
 *  each other, which never touch the landing page's click beacon. */
async function bumpPdfDownload(which: 'guide' | 'worksheets'): Promise<void> {
	await bumpLandingStat((r) => {
		r.downloads[which] = (r.downloads[which] || 0) + 1;
	});
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
				r.clicks[target] = (r.clicks[target] || 0) + 1;
			});
		}
		return { ok: true };
	}
}

/**
 * POST /ReportSaveIncident/ {table, recordId, kind?, platform?, version?, build?}
 *
 * Desktop solo runs the whole backend in-app, so noteSaveIncident writes to the
 * PLAYER'S local database and never reaches this instance — the saves we most
 * need to hear about are the ones we cannot see. This is the uplink: the client
 * posts here when a save will not open, so an unreadable desktop save shows up on
 * /dashboard alongside the hosted ones. Same shape as the metrics uplink.
 *
 * Aggregate bookkeeping only — ids and counts, never save contents. Always
 * answers ok:true; a telemetry hiccup must never add a second failure on top of
 * the one the player already hit.
 */
export class ReportSaveIncident extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const table = String(body.table || 'Player').slice(0, 40);
		const recordId = String(body.recordId || '').slice(0, 120);
		if (!recordId) return { ok: true };
		const kind = body.kind === 'refused' ? 'refused' : 'unreadable';
		try {
			const t = (db() as any).SaveIncident;
			if (!t) return { ok: true };
			const id = `${table}:${recordId}`;
			const now = Date.now();
			const row = (await safeGet(t, id)) || { id, table, recordId, kind, firstSeenAt: now, count: 0 };
			await t.put({
				...row,
				kind,
				lastSeenAt: now,
				count: (row.count || 0) + 1,
				reportedByClient: true,
				platform: String(body.platform || '').slice(0, 16) || row.platform || null,
				version: String(body.version || '').slice(0, 32) || row.version || null,
				build: String(body.build || '').slice(0, 64) || row.build || null,
			});
		} catch (e: any) {
			console.error('save incident report failed —', e?.message || e);
		}
		return { ok: true };
	}
}

/**
 * POST /ReportClientError/ {message, where?, stack?, platform?, version?, build?}
 *
 * A crash in the interface is completely invisible from the server: the player
 * gets a blank screen and closes the tab, and nothing was ever written down. The
 * only previous signal was somebody writing in to say the game "broke".
 *
 * Aggregated by a fingerprint of message + location, not stored per occurrence,
 * so one bad render loop firing every frame becomes one row with a count rather
 * than thousands of rows. Deliberately narrow about what it keeps: a truncated
 * message and the top of the stack. No save contents, no player id, no free text
 * the player typed — a crash report must never become a way to exfiltrate a save.
 */
export class ReportClientError extends PublicEndpoint {
	async post(data: any) {
		const body = await bodyOf(data);
		const message = String(body.message || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 300);
		if (!message) return { ok: true };
		const where = String(body.where || '')
			.trim()
			.slice(0, 200);
		// Only the top frame: enough to locate the fault, short enough that a stack
		// full of user data can't ride along.
		const stack = String(body.stack || '')
			.split('\n')
			.slice(0, 3)
			.join(' | ')
			.slice(0, 400);
		try {
			const t = (db() as any).ClientError;
			if (!t) return { ok: true };
			const id = `e${hash32(`${message}|${where}`).toString(36)}`;
			const now = Date.now();
			const row = (await safeGet(t, id)) || { id, message, where, firstSeenAt: now, count: 0 };
			await t.put({
				...row,
				message,
				where,
				stack: stack || row.stack || null,
				lastSeenAt: now,
				count: (row.count || 0) + 1,
				byDay: bumpDay(row.byDay, now, 1),
				platform: String(body.platform || '').slice(0, 16) || row.platform || null,
				version: String(body.version || '').slice(0, 32) || row.version || null,
				build: String(body.build || '').slice(0, 64) || row.build || null,
			});
		} catch (e: any) {
			console.error('client error report failed —', e?.message || e);
		}
		return { ok: true };
	}
}

/**
 * POST /ClearProblem/ {kind:"refusal"|"crash", ids:[...]} — delete telemetry rows.
 *
 * The only WRITE the dashboard sign-in can perform, and it is deliberately not a
 * general one. `kind` selects between exactly two hard-coded table names and
 * anything else is refused, so the id is never used to reach a table the caller
 * named: the credential that can clear a stale crash counter still cannot touch
 * a Player row, which is the one thing on this server that is irreplaceable.
 *
 * Scoped this way ON PURPOSE because the dashboard role can reach it. A
 * read-only role that can also delete is not read-only, so the blast radius is
 * moved into the endpoint instead: two tables of regenerable counters, nothing
 * else. If a delete is ever wanted for saves, it belongs behind super-user and a
 * separate endpoint, not behind another value of `kind`.
 *
 * Idempotent. Deleting an id that is already gone is reported in `missing`
 * rather than failed — two clicks on the same row is a normal thing to do, and
 * an error there would just teach you to ignore errors.
 */
/* A Map, not an object literal, and an explicit string check at the call site.
 * An object literal answers to inherited keys — CLEARABLE['constructor'] returns
 * a function rather than undefined — and String(['crash']) is 'crash', so an
 * array argument coerced straight through the lookup. Neither could reach a
 * table outside this pair, but "fails safe by accident" is not the property to
 * rely on for the one endpoint that deletes. */
const CLEARABLE = new Map<string, string>([
	['refusal', 'Refusal'],
	['crash', 'ClientError'],
]);

export class ClearProblem extends DashboardEndpoint {
	// POST maps to create in Harper's permission model; the read gate is the gate.
	allowCreate(user?: any) {
		return (this as any).allowRead(user);
	}

	async post(data: any) {
		const body = await bodyOf(data);
		const kind = body?.kind;
		const table = typeof kind === 'string' ? CLEARABLE.get(kind) : undefined;
		if (!table) return { ok: false, error: 'kind must be "refusal" or "crash"', deleted: 0 };

		// Cap the batch: a "clear all" from a page showing thousands of rows should
		// not turn into one unbounded delete loop inside a request.
		const ids = (Array.isArray(body.ids) ? body.ids : [body.id])
			.filter((x: any) => x != null && x !== '')
			.map((x: any) => String(x))
			.slice(0, 500);
		if (!ids.length) return { ok: false, error: 'no ids given', deleted: 0 };

		const t = (db() as any)[table];
		if (!t) return { ok: false, error: `${table} table is not available`, deleted: 0 };

		// Refusal counts sit in an in-memory buffer between flushes. Flushing BEFORE
		// the delete means the row being removed includes everything counted so far,
		// and anything that arrives after this point legitimately recreates it —
		// which is the honest outcome. Dropping the buffer instead would silently
		// discard refusals that happened while you were reading the page.
		if (table === 'Refusal') await flushRefusals();

		let deleted = 0;
		const missing: string[] = [];
		const failed: { id: string; error: string }[] = [];
		for (const id of ids) {
			try {
				// Point-read first so "already gone" and "delete failed" stay distinct.
				const row = await safeGet(t, id);
				if (!row) {
					missing.push(id);
					continue;
				}
				await t.delete(id);
				deleted++;
			} catch (e: any) {
				failed.push({ id, error: String(e?.message || e) });
			}
		}
		return { ok: failed.length === 0, table, deleted, missing, failed };
	}
}

/**
 * POST /DeleteSoloMetrics/ {id} or {ids:[…]} — remove a caretaker's telemetry
 * row from SoloMetrics. Driven by the Remove button in the dashboard's player
 * modal.
 *
 * WHAT THIS DELETES, precisely, because the button says "remove caretaker" and
 * that reads like more than it is:
 *
 *   • The SoloMetrics row — the uplinked snapshot this dashboard is built from.
 *     Nothing else stores it, so this is destructive and there is no undo.
 *   • NOT their save. Saves live on the player's own device as local files (it
 *     is the first promise the privacy policy makes) and this server has never
 *     held one. Nobody loses a preserve because of this endpoint.
 *
 * AND IT MAY COME BACK. SyncMetrics upserts `solo:${clientId}` on every sync, so
 * a save that is still being played uplinks a fresh row the next time it is
 * online. That is not a bug to paper over: this is "forget what we know right
 * now", not a ban, and the modal says so in as many words. For a dead test save
 * it stays gone; for a live one it comes back thinner, having lost its history.
 *
 * SUPER-USER ONLY — deliberately narrower than allowRead. metrics_reader exists
 * precisely so the password sitting in a browser tab is one whose leak is "worth
 * rotating and nothing worse" (see DASHBOARD_ROLES). A read-only credential that
 * can destroy records would make that claim false.
 */
export class DeleteSoloMetrics extends DashboardEndpoint {
	// POST maps to create in Harper's permission model. Note this does NOT defer
	// to allowRead the way ClearProblem does — see the super-user note above.
	allowCreate(user?: any) {
		return isSuperUser(user);
	}

	async post(data: any) {
		const body = await bodyOf(data);
		// Batch-capable so the UI can grow a multi-select later without a second
		// endpoint, capped so it can never become an unbounded delete loop inside
		// one request. Lower than ClearProblem's 500: that clears counters, this
		// destroys histories, and a runaway here is not recoverable.
		const ids = (Array.isArray(body?.ids) ? body.ids : [body?.id])
			.filter((x: any) => x != null && x !== '')
			.map((x: any) => String(x))
			.slice(0, 100);
		if (!ids.length) return { ok: false, error: 'no ids given', deleted: 0 };

		const table = (db() as any).SoloMetrics;
		if (!table) return { ok: false, error: 'SoloMetrics table is not available', deleted: 0 };

		// No `solo:` prefix check on the ids. Every row SyncMetrics writes carries
		// it, but buildDashboardRows also back-fills legacy rows, and a guard that
		// rejected their shape would leave exactly the oldest junk undeletable —
		// which is most of what anyone would want this button for. The table
		// binding is the scope; a stray id simply misses.
		let deleted = 0;
		const missing: string[] = [];
		const failed: { id: string; error: string }[] = [];
		for (const id of ids) {
			try {
				// Point-read first so "already gone" and "delete failed" stay distinct
				// in the response — the UI treats one as success and one as an error.
				const row = await safeGet(table, id);
				if (!row) {
					missing.push(id);
					continue;
				}
				await table.delete(id);
				deleted++;
			} catch (e: any) {
				failed.push({ id, error: String(e?.message || e) });
			}
		}

		// The roll-up is cached for DASHBOARD_CACHE_MS and every number on the page
		// derives from it. Skip this and the row is gone from the database but still
		// on screen until the TTL lapses, which reads as the delete having failed.
		if (deleted) dashboardCache.invalidate();

		return { ok: failed.length === 0, deleted, missing, failed };
	}
}

/**
 * GET /GameplayHealth/ — what is going WRONG, as opposed to what players did.
 *
 * The rest of the metrics count successes: resources gathered, items crafted,
 * tasks finished. That makes a whole class of problem invisible — a recipe gated
 * on the wrong biome refuses every player who finds it, and every counter still
 * looks healthy because the refusal isn't an activity. Same for a crash in the
 * interface, which produces no events at all by definition.
 *
 * Two tables, side by side, both counts-only:
 *   refusals — every "no" the server gave, by message key
 *   clientErrors — crashes the interface reported
 *
 * ADMIN ONLY, like the rest of the dashboard's feeds. Its only reader is
 * /dashboard, and crash reports carry whatever text the client threw — which is
 * not something to publish just because nothing sensitive happens to be in it
 * today.
 */
export class GameplayHealth extends DashboardEndpoint {
	async get(target?: any) {
		// Fold anything still buffered in memory in first, so a quiet server does
		// not look healthier than it is just because the flush timer hasn't fired.
		await flushRefusals();
		const t = db() as any;
		const read = async (name: string): Promise<any[]> => {
			try {
				return t[name] ? await allOf(t[name]) : [];
			} catch {
				return [];
			}
		};
		const [refusalRows, errorRows] = await Promise.all([read('Refusal'), read('ClientError')]);

		// Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive, over the per-day
		// buckets. Every row keeps its all-time `count` untouched alongside a
		// `windowCount`, because those answer different questions and conflating
		// them is how a filtered view starts quietly lying: "380 refusals" filtered
		// to one day still means 380 all-time, and the reader has no way to know
		// which they are looking at unless both are on the page.
		//
		// `covered` is the honest part. `byDay` only exists from the day it shipped,
		// so a window that reaches back further covers less than it appears to. A
		// row with no buckets at all reports windowCount: null — not zero, which
		// would read as "this never happened in your range".
		const from = queryOne(target, 'from');
		const to = queryOne(target, 'to');
		const windowed = !!(from || to);
		const inWindow = (day: string) => (!from || day >= from) && (!to || day <= to);
		const windowCountOf = (byDay: any): number | null => {
			if (!byDay || typeof byDay !== 'object') return null;
			const days = Object.entries(byDay);
			if (!days.length) return null;
			let n = 0;
			for (const [day, c] of days) if (inWindow(day)) n += Number(c) || 0;
			return n;
		};
		const daysCovered = new Set<string>();
		for (const r of [...refusalRows, ...errorRows])
			for (const day of Object.keys(r?.byDay || {})) if (inWindow(day)) daysCovered.add(day);

		const shape = (r: any) => ({
			count: Number(r.count) || 0,
			windowCount: windowCountOf(r.byDay),
			byDay: r.byDay && typeof r.byDay === 'object' ? r.byDay : null,
			firstSeenAt: r.firstSeenAt || 0,
			lastSeenAt: r.lastSeenAt || 0,
		});

		// `id` rides along so a row can be addressed for deletion. The code/message
		// is what you READ, but it is not the key — two rows can share a message
		// from different places, and deleting by message would take both.
		const refusals = refusalRows
			.map((r: any) => ({
				id: String(r.id ?? r.code ?? ''),
				code: String(r.code || r.id || '?'),
				status: Number(r.status) || 0,
				...shape(r),
			}))
			.sort((a, b) => b.count - a.count);

		const clientErrors = errorRows
			.map((r: any) => ({
				id: String(r.id ?? ''),
				message: String(r.message || '?'),
				where: String(r.where || ''),
				stack: r.stack || null,
				platform: r.platform || null,
				version: r.version || null,
				...shape(r),
			}))
			.sort((a, b) => b.count - a.count);

		// Rows with nothing in the window are dropped from `top` when a window is
		// active — but only rows that HAVE buckets. A row that predates the per-day
		// counters has no evidence either way, and hiding it would be asserting
		// something the data cannot support.
		const inRange = (r: any) => !windowed || r.windowCount === null || r.windowCount > 0;
		const sumWindow = (rows: any[]) => rows.reduce((n, r) => n + (r.windowCount === null ? 0 : r.windowCount), 0);
		const shownRefusals = refusals.filter(inRange);
		const shownErrors = clientErrors.filter(inRange);

		return {
			generatedAt: Date.now(),
			// What the ?from/?to window actually managed to cover, so the page can
			// say "these counters only start on the 12th" instead of implying the
			// game was quiet before then.
			window: windowed
				? {
						from: from || null,
						to: to || null,
						daysWithData: daysCovered.size,
						earliestBucket: [...daysCovered].sort()[0] || null,
						note: 'per-day counters begin when this feature shipped; anything older has an all-time count only',
					}
				: null,
			refusals: {
				distinct: shownRefusals.length,
				total: refusals.reduce((n, r) => n + r.count, 0),
				windowTotal: windowed ? sumWindow(shownRefusals) : null,
				// 4xx is the game saying no on purpose; 5xx is the game falling over.
				serverFaults: refusals.filter((r) => r.status >= 500).reduce((n, r) => n + r.count, 0),
				top: shownRefusals.slice(0, 25),
			},
			clientErrors: {
				distinct: shownErrors.length,
				total: clientErrors.reduce((n, e) => n + e.count, 0),
				windowTotal: windowed ? sumWindow(shownErrors) : null,
				top: shownErrors.slice(0, 25),
			},
		};
	}
}

/**
 * GET /SaveHealth/ — how many stored records could not be read, from the
 * SaveIncident table. Salvage failures used to live only in server logs, so a
 * save that would not open was invisible until the player wrote in; this is the
 * same information on /dashboard. Ids and counts only — never save contents.
 *
 * ADMIN ONLY, and this one is not merely tidiness. `recent[].recordId` is a real
 * primary key, and for the Player table that is a save's UUID — the exact secret
 * that GET /Metrics/<playerId>, /GameState/<playerId> and every other capability
 * endpoint treats as proof you own the save. Published anonymously, this endpoint
 * handed out working ids for those, which is the one thing the MVP auth model
 * depends on not happening. Its only reader is /dashboard, which is now
 * authenticated too.
 */
export class SaveHealth extends DashboardEndpoint {
	async get() {
		const t = db() as any;
		let rows: any[] = [];
		try {
			rows = t.SaveIncident ? await allOf(t.SaveIncident) : [];
		} catch {
			rows = [];
		}
		const byTable: Record<string, number> = {};
		const byKind: Record<string, number> = {};
		let events = 0;
		for (const r of rows) {
			const tbl = String(r?.table || '?');
			byTable[tbl] = (byTable[tbl] || 0) + 1;
			const k = String(r?.kind || 'unreadable');
			byKind[k] = (byKind[k] || 0) + 1;
			events += Number(r?.count) || 0;
		}
		const recent = rows
			.slice()
			.sort((a: any, b: any) => (b?.lastSeenAt || 0) - (a?.lastSeenAt || 0))
			.slice(0, 25)
			.map((r: any) => ({
				table: r.table,
				recordId: r.recordId,
				kind: r.kind,
				count: Number(r.count) || 0,
				firstSeenAt: r.firstSeenAt || 0,
				lastSeenAt: r.lastSeenAt || 0,
			}));
		return {
			generatedAt: Date.now(),
			affected: rows.length,
			events,
			savesAffected: byTable.Player || 0,
			byTable,
			byKind,
			recent,
		};
	}
}

/**
 * GET /LandingStats/ — aggregate-only rollup of the landing page's daily
 * counters, consumed by the /dashboard "Landing page" section. Returns per-day
 * rows (see LANDING_DAYS_RETURNED) plus lifetime totals: visits, first-time
 * visitors, outbound link clicks and classroom-PDF downloads. Counts only —
 * there is no personal data anywhere behind this endpoint to leak.
 *
 * ADMIN ONLY. Nothing here is sensitive — it is counts, and it stayed harmless
 * when it was public. It moves behind auth because its only reader is /dashboard
 * and a business metric (visits, clicks, conversion) is not something to hand
 * to anyone who asks. POST /LandingEvent/ stays public: the landing page has to
 * be able to write to it.
 */
export class LandingStats extends DashboardEndpoint {
	async get() {
		return landingStatsCache.get(Date.now());
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

/**
 * Compressed representations of the inlined pages, built lazily ONCE per process.
 *
 * Same reason GameData compresses itself: Harper's REST path does not compress
 * resource responses, so whatever these endpoints return goes out on the wire
 * verbatim. That is fine for the policy pages and very much not fine for the two
 * big ones — /dashboard is ~90 KB of HTML and the landing page is ~575 KB, and
 * every visit was paying for all of it.
 *
 * The bytes are fixed by the build, so this is a one-time cost per page per
 * process (~15 ms for the landing page at quality 5) and free forever after.
 * Note the landing page is mostly base64-inlined screenshots, i.e. already-
 * compressed image data — it only comes down to ~403 KB. Getting it properly
 * small means serving those screenshots as their own cacheable endpoints rather
 * than compressing them harder.
 */
const pageCompressed = new Map<string, { br?: Uint8Array; gzip?: Uint8Array }>();
function compressedPage(key: string, html: string, enc: 'br' | 'gzip'): Uint8Array {
	let entry = pageCompressed.get(key);
	if (!entry) pageCompressed.set(key, (entry = {}));
	if (enc === 'br') {
		if (!entry.br) {
			const buf = nodeBuffer.from(html, 'utf8');
			entry.br = brotliCompressSync(buf, {
				params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length },
			});
		}
		return entry.br as Uint8Array;
	}
	if (!entry.gzip) entry.gzip = gzipSync(nodeBuffer.from(html, 'utf8'), { level: 6 });
	return entry.gzip as Uint8Array;
}

/**
 * Every public URL this Harper serves, in ONE table — because two lists that
 * have to agree with each other eventually won't, and the failure is silent: a
 * page added to the site but forgotten in the sitemap just quietly never gets
 * indexed.
 *
 * `redirect` — requests for this path arriving on the ORIGIN hostname are 301'd
 * to the apex. Background: wildwillows.app is a proxied CNAME to this Harper, so
 * the origin answers the identical pages under its own name, and Google indexed
 * the origin INSTEAD of the apex (the Mac App Store listing pointed at it, which
 * is how the crawler found it). Two hostnames serving byte-identical HTML split
 * every ranking signal between them.
 *
 * The flag is on individual paths, and NOT a blanket "redirect all HTML", for
 * one reason: the desktop app, the itch build and the browser demo all call this
 * Harper cross-origin BY ITS REAL HOSTNAME. A 301 on those endpoints would break
 * every one of them. Only what is listed here can ever redirect.
 *
 * `sitemap` — the path is listed in /sitemap.xml.
 *
 * Two flags rather than one because they genuinely diverge: the dashboard wants
 * neither, and a future noindex page would want the redirect without the
 * listing. Keeping them distinct means neither decision has to be re-derived.
 */
const PUBLIC_PAGES: Record<string, { path: string; redirect: boolean; sitemap: boolean }> = {
	landing: { path: '/', redirect: true, sitemap: true },
	privacy: { path: '/privacy.html', redirect: true, sitemap: true },
	'age-rating': { path: '/age-rating.html', redirect: true, sitemap: true },
	support: { path: '/support.html', redirect: true, sitemap: true },
	// Extensionless on purpose: this one is not a store-listing URL that anything
	// external already points at, so it gets the cleaner path teachers will type
	// and share. Harper serves /teachers.html too (it strips the suffix), which
	// costs nothing and cannot be linked to by accident.
	teachers: { path: '/teachers', redirect: true, sitemap: true },
	// The classroom PDFs. Indexable — Google indexes PDF content, and these are
	// the only thing on the site aimed squarely at teachers searching for a
	// classroom ecology resource. No redirect: they are not served through
	// htmlPage(), so nothing would read the flag.
	'educator-guide': { path: '/educator-guide.pdf', redirect: false, sitemap: true },
	'student-worksheets': { path: '/student-worksheets.pdf', redirect: false, sitemap: true },
	// Neither. The metrics dashboard is noindex, is reached by URL on the origin,
	// and redirecting it would strip the Authorization header on the way.
	dashboard: { path: '/dashboard', redirect: false, sitemap: false },
};
const ORIGIN_HOSTNAME = 'wild.willows.harperfabric.com';
const SITE_ORIGIN = 'https://wildwillows.app';

/**
 * One of the inlined HTML pages, content-negotiated and revalidatable.
 *
 * `res` is the endpoint instance, needed only to reach the request headers. As in
 * GameData: no HTTP context means an internal/renderer caller, and those get the
 * plain string back without zlib ever being touched (node:zlib is a no-op shim in
 * the web build).
 *
 * The ETag is the build stamp, so a returning visitor's browser revalidates into
 * an empty 304 instead of re-downloading the page — which matters more here than
 * the compression does, since the landing page's weight is images that don't
 * shrink but do cache.
 */
function htmlPage(res: any, key: string, html: string, opts: { private?: boolean } = {}) {
	const etag = `W/"${key}-${buildStamp}"`;
	const headers: Record<string, string> = {
		'content-type': 'text/html; charset=utf-8',
		// `private` for anything behind admin auth: a shared cache or proxy that
		// stored a `public` copy would serve the authed page to whoever asked next,
		// which would hand back the very thing the auth is there to stop.
		'cache-control': opts.private ? 'private, no-store' : 'public, max-age=3600',
		etag,
		vary: 'Accept-Encoding',
	};

	const reqHeaders: any = res?.getContext?.()?.headers;
	if (!reqHeaders || typeof reqHeaders.get !== 'function') return { status: 200, headers, body: html };

	// Origin hostname -> apex. See PUBLIC_PAGES above for why this is a table
	// lookup and not a blanket rule.
	const page = PUBLIC_PAGES[key];
	const canonicalPath = page?.redirect ? page.path : undefined;
	const host = String(reqHeaders.get('host') || '')
		.toLowerCase()
		.split(':')[0];
	if (canonicalPath && host === ORIGIN_HOSTNAME) {
		return {
			status: 301,
			headers: {
				location: SITE_ORIGIN + canonicalPath,
				// A 301 is cached forever by browsers unless told otherwise, and this
				// one is a hostname decision that could plausibly be revisited. An hour
				// is long enough for crawlers to act on and short enough to take back.
				'cache-control': 'public, max-age=3600',
			},
		};
	}

	// Compare loosely so a weak/strong prefix or quoting mismatch still matches.
	const norm = (s: string) => s.replace(/^W\//, '').trim();
	const ifNoneMatch = String(reqHeaders.get('if-none-match') || '');
	if (ifNoneMatch && norm(ifNoneMatch) === norm(etag)) return { status: 304, headers };

	const accept = String(reqHeaders.get('accept-encoding') || '');
	if (/\bbr\b/.test(accept))
		return { status: 200, headers: { ...headers, 'content-encoding': 'br' }, body: compressedPage(key, html, 'br') };
	if (/\bgzip\b/.test(accept))
		return {
			status: 200,
			headers: { ...headers, 'content-encoding': 'gzip' },
			body: compressedPage(key, html, 'gzip'),
		};
	return { status: 200, headers, body: html };
}

/** GET /privacy.html — the privacy policy (linked from App Store Connect, itch, etc.). */
class PrivacyPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'privacy', privacyHtml);
	}
}

/** GET /age-rating.html — age-suitability / content information page. */
class AgeRatingPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'age-rating', ageRatingHtml);
	}
}

/** GET /support.html — support / FAQ page (App Store Connect's Support URL). */
class SupportPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'support', supportHtml);
	}
}

/**
 * GET /dashboard — the internal gameplay-metrics dashboard. A static,
 * self-contained page (inline CSS/JS, no external deps) that fetches the roll-up
 * at runtime and renders it: audience, engagement, funnels, progression, action
 * totals, achievements, and the caretakers' customized characters.
 *
 * The PAGE is public; everything it reads is not. That split is deliberate and it
 * is the only arrangement a login form can work under — a form cannot live behind
 * the thing it logs you into. What ships here is an empty shell: inline CSS and
 * JS, not one number baked in. Serving it to a stranger reveals nothing, and
 * every fetch it makes is refused without credentials.
 *
 * So the security boundary is entirely on the endpoints — /DashboardAuth/,
 * /MetricsSummary/, /MetricsPlayers/, /SaveHealth/, /GameplayHealth/ and
 * /LandingStats/, all DashboardEndpoint — and never on the URL of this page.
 * Which is the fix for how it started: public AND unlisted, which is not a
 * control. It renders player display names, exact activity timestamps, OS and
 * accessibility preferences, and it fetched all of that from the reader's
 * browser, so anyone with the URL had the lot. (The README used to claim "no
 * player names"; the player modal has always shown them.)
 *
 * `no-store` all the same: a shell whose whole job is to ask for a password is
 * not worth caching, and it means a redeploy shows up on the next reload.
 */
class DashboardPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'dashboard', dashboardHtml, { private: true });
	}
}

/**
 * GET /teachers — the classroom page: what the game teaches, how one class
 * period runs, discussion prompts, and the two free PDFs.
 *
 * Its own page rather than a section of the landing page because the audience
 * arrives differently. A teacher searching "ecosystem lesson plan grades 5-8"
 * is not looking for a cozy game, and an anchor deep inside a 480 KB marketing
 * page is neither a shareable link nor something a search engine will surface
 * on its own terms. Splitting it also means the landing page stops paying for
 * copy that only teachers read.
 */
class TeachersPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'teachers', teachersHtml);
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
		return htmlPage(this, 'landing', landingHtml);
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

/**
 * The base64-inlined binaries (og image, theme audio, the two PDFs), decoded
 * ONCE per process.
 *
 * These were being re-decoded on every single request: `Buffer.from(b64,
 * 'base64')` over ~2.8 MB of base64 for /theme.mp3 and ~2 MB for each PDF, per
 * hit, throwing the result away afterwards. The source strings are compiled into
 * the bundle and never change, so there is nothing to invalidate — decode on
 * first use and hold the buffer.
 *
 * The decoded buffers are held for the life of the process (a few MB resident).
 * That is the trade being made deliberately: memory that the module's base64
 * strings were already costing anyway, in exchange for taking the decode off
 * every response.
 */
const decodedBinaries = new Map<string, any>();
function decodedBinary(key: string, b64: string): any {
	let buf = decodedBinaries.get(key);
	if (!buf) decodedBinaries.set(key, (buf = nodeBuffer.from(b64, 'base64')));
	return buf;
}

/**
 * GET /img/<name>.webp — the screenshots for the landing and teachers pages.
 *
 * These were base64 data URIs inside the HTML until the pages grew to 470 KB and
 * 260 KB of render-blocking document. Inlining looks like it saves a request, and
 * it does — at the cost of the one thing that actually matters here: an inlined
 * image cannot be cached apart from the page carrying it, cannot be fetched in
 * parallel with it, and cannot be deferred, because `loading="lazy"` on a data
 * URI defers nothing that has not already been downloaded. Four of these nine are
 * on BOTH pages, and as data URIs each one was paid for twice.
 *
 * Names are content-hashed by the build, so the answer is `immutable` with a
 * one-year max-age: a changed screenshot gets a new filename, and a name that
 * never changes never needs revalidating. That also makes the lookup its own
 * path-traversal defence — the key either exists in the generated record or the
 * request is a 404, and nothing here ever touches a filesystem path.
 *
 * Not in PUBLIC_PAGES: these are not pages, so there is no canonical to redirect
 * to and a 301 would just buy every image an extra round trip.
 */
class Screenshot extends PublicEndpoint {
	async get() {
		const raw = String((this as any).getId?.() || '').trim();
		// Harper strips some trailing extensions and not others; accept either form
		// rather than depending on which list .webp happens to be on today.
		const name = raw.endsWith('.webp') ? raw : `${raw}.webp`;
		let body = decodedBinaries.get(`img:${name}`);
		if (!body) {
			const { screenshotsB64 } = await import('./img-assets');
			const b64 = Object.prototype.hasOwnProperty.call(screenshotsB64, name) ? screenshotsB64[name] : null;
			if (!b64) return { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'Not found' };
			body = decodedBinary(`img:${name}`, b64);
		}
		return {
			status: 200,
			headers: {
				'content-type': 'image/webp',
				'cache-control': 'public, max-age=31536000, immutable',
			},
			body,
		};
	}
}

/** GET /og-image.jpg — the social/OpenGraph preview image for the landing page. */
class OgImage extends PublicEndpoint {
	async get() {
		return {
			status: 200,
			headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' },
			body: decodedBinary('og-image', ogImageB64),
		};
	}
}

/** GET /theme.mp3 — the game's main theme (Jon Licht), for the landing-page player.
 * The ~2 MB audio lives in its own module and is dynamic-imported so it never lands
 * in the web/desktop bundle (this endpoint only ever runs on the hosted Harper).
 * The import is cheap after the first call (module registry); the base64 decode was
 * not, hence decodedBinary. */
class Theme extends PublicEndpoint {
	async get() {
		let body = decodedBinaries.get('theme');
		if (!body) {
			const { themeMp3B64 } = await import('./theme-audio');
			body = decodedBinary('theme', themeMp3B64);
		}
		return {
			status: 200,
			headers: {
				'content-type': 'audio/mpeg',
				'cache-control': 'public, max-age=604800',
				'accept-ranges': 'none',
			},
			body,
		};
	}
}

/** The two classroom PDFs behind the landing page's "For teachers" section.
 *
 * Same deal as /theme.mp3: the hosted Harper serves no static files, so the bytes
 * are inlined as base64 by scripts/build-pages.mjs into server/pdf-assets.ts and
 * dynamic-imported here — that keeps ~2 MB of base64 out of the web/desktop bundle
 * (Vite code-splits it; the game never loads it) while esbuild inlines it into the
 * server's resources.js.
 *
 * Each GET counts a download before it answers. Deliberately a SHORT cache: a
 * week-long one would hide every repeat download from the numbers, and an hour is
 * plenty to stop a reload from re-sending a megabyte. */
const pdfPage = (body: any, filename: string) => ({
	status: 200,
	headers: {
		'content-type': 'application/pdf',
		'cache-control': 'public, max-age=3600',
		// ASCII-only filename on purpose — a header value is latin-1, and the real
		// titles carry an em dash.
		'content-disposition': `inline; filename="${filename}"`,
	},
	body,
});

class EducatorGuidePdf extends PublicEndpoint {
	async get() {
		await bumpPdfDownload('guide');
		let body = decodedBinaries.get('pdf-guide');
		if (!body) {
			const { educatorGuidePdfB64 } = await import('./pdf-assets');
			body = decodedBinary('pdf-guide', educatorGuidePdfB64);
		}
		return pdfPage(body, 'Wild-Willows-Educator-Guide.pdf');
	}
}

class StudentWorksheetsPdf extends PublicEndpoint {
	async get() {
		await bumpPdfDownload('worksheets');
		let body = decodedBinaries.get('pdf-worksheets');
		if (!body) {
			const { studentWorksheetsPdfB64 } = await import('./pdf-assets');
			body = decodedBinary('pdf-worksheets', studentWorksheetsPdfB64);
		}
		return pdfPage(body, 'Wild-Willows-Student-Worksheets.pdf');
	}
}

/**
 * GET /robots.txt and GET /sitemap.xml — the two files that tell Google this
 * site exists and which URLs are worth having.
 *
 * There were none. Cloudflare was answering /robots.txt with its managed
 * content-signals block, which contains no User-agent, Allow, Disallow or
 * Sitemap line at all — so nothing was BLOCKED, but nothing was announced
 * either, and there was no sitemap for a crawler to find. Combined with the
 * origin-hostname duplicate above, the apex was absent from search entirely.
 *
 * Cloudflare appends its content-signals block to an origin robots.txt rather
 * than replacing it, so this file and that block should coexist. Worth
 * confirming on the live domain after this deploys — if Cloudflare still wins,
 * the managed robots.txt has to be turned off in the dashboard.
 *
 * Everything here is public and worth indexing except the metrics dashboard,
 * which is disallowed as a courtesy (its real protection is that every endpoint
 * it reads refuses an unauthenticated request — see DashboardPage).
 */
class RobotsTxt extends PublicEndpoint {
	async get() {
		const body = [
			'User-agent: *',
			'Allow: /',
			'Disallow: /dashboard',
			'',
			`Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
			'',
		].join('\n');
		return {
			status: 200,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
			body,
		};
	}
}

/**
 * GET /sitemap.xml — the four public pages plus the two classroom PDFs.
 *
 * What is deliberately NOT here:
 *
 * <priority> and <changefreq>. Google ignores both, and has said so plainly for
 * years. They are inherited from a 2005 spec that no major engine implements.
 * Emitting them costs bytes and buys a false sense of control over crawl order.
 *
 * A build-time <lastmod>. See server/page-lastmod.ts: the date comes from git,
 * per file, and a path that cannot be dated honestly is simply emitted without
 * the element. A sitemap that claims every page changed on every deploy is worse
 * than one that claims nothing, because the engine stops believing the field.
 *
 * play.wildwillows.app. It is intentionally noindex (see workers/play.js), and a
 * sitemap may only list URLs on its own host anyway.
 */
class SitemapXml extends PublicEndpoint {
	async get() {
		// Static, known-safe paths today. Escaped regardless: <loc> is XML, and the
		// day someone adds a query string with an `&` the feed silently stops
		// parsing — Search Console reports it as an unreadable sitemap, which is a
		// slow thing to notice and an annoying one to diagnose.
		const xml = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

		const entries = Object.values(PUBLIC_PAGES)
			.filter((p) => p.sitemap)
			.map((p) => {
				const lastmod = pageLastmod[p.path];
				return (
					'\t<url>\n' +
					`\t\t<loc>${xml(SITE_ORIGIN + p.path)}</loc>\n` +
					(lastmod ? `\t\t<lastmod>${lastmod}</lastmod>\n` : '') +
					'\t</url>\n'
				);
			})
			.join('');

		const body =
			'<?xml version="1.0" encoding="UTF-8"?>\n' +
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
			entries +
			'</urlset>\n';

		return {
			status: 200,
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				// Short on purpose: this is the file Search Console re-fetches to find
				// out what changed, and a long TTL at the CDN would hand it a stale
				// answer for the rest of the day after a deploy.
				'cache-control': 'public, max-age=3600',
			},
			body,
		};
	}
}

// Export under the exact URL paths (string export names keep the hyphen; the empty
// name serves the site root, and Harper strips a trailing .ico/.jpg/.svg extension).
// The PDFs are exported under BOTH the bare name and the .pdf one, because the
// extension-stripping list is Harper's, not ours — this way /educator-guide.pdf
// resolves whether or not Harper decides to trim the suffix first.
export {
	LandingPage as home,
	PrivacyPage as privacy,
	AgeRatingPage as 'age-rating',
	SupportPage as support,
	TeachersPage as teachers,
	DashboardPage as dashboard,
	Favicon as favicon,
	OgImage as 'og-image',
	Screenshot as img,
	Theme as theme,
	EducatorGuidePdf as 'educator-guide',
	EducatorGuidePdf as 'educator-guide.pdf',
	StudentWorksheetsPdf as 'student-worksheets',
	StudentWorksheetsPdf as 'student-worksheets.pdf',
	RobotsTxt as robots,
	RobotsTxt as 'robots.txt',
	SitemapXml as sitemap,
	SitemapXml as 'sitemap.xml',
};

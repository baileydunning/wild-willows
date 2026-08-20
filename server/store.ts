// Wild Willows — server: store
//
// Defensive record access. Harper can hand back a row it cannot decode; these
// helpers salvage what they can, quarantine what they cannot, and give the rest
// of the server a `safeGet` / `allOf` / `toArray` surface that never throws a raw
// decode error at a player. `RollupCache` lives here too.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { db, isDecodeError } from './core';
import { scanPrefix } from './keys';

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
export function existsRaw(table: any, id: string): boolean {
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

export function tableName(table: any): string {
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
export async function forceRemove(table: any, id: string): Promise<boolean> {
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
export async function safeGet(table: any, id: string): Promise<any | null> {
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

export async function toArray(iterable: any, label = '?'): Promise<any[]> {
	const out: any[] = [];
	let dropped = 0;
	// Fast path for the in-app solo backend, where LocalTable.search() hands back a
	// plain array rather than a cursor. `for await` over a sync iterable is legal
	// but not free: it wraps every element in a resolved promise and awaits it, so
	// a snapshot's six table reads cost one microtask turn PER ROW — thousands of
	// them on a built-out save, on the same thread that draws the frame. A sync
	// loop over an array we already hold is identical in behavior (same null
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

export async function allOf(table: any): Promise<any[]> {
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
export async function findCounterRow(table: any, id: string): Promise<any | null> {
	if (!table || typeof table.search !== 'function') return null;
	const direct = await safeGet(table, id);
	if (direct) return direct;
	// Null: EITHER genuinely absent OR a cold-instance miss. Only a range read can
	// tell the two apart, and only the second one is dangerous.
	//
	// This used to be an UNBOUNDED scan, which made the guard quadratic on the one
	// table where the caller picks the key: AppOpen is keyed `dev:${deviceId}` from
	// the request body, so a novel device id always misses, always scanned, and the
	// table it scanned had one row per device id ever seen. N invented ids cost
	// ~N²/2 row reads, and every row is permanent.
	//
	// A `starts_with` on the FULL id is bounded to the rows sharing that exact
	// prefix — normally one — while keeping the property the scan was here for:
	// Harper compiles it to `primaryStore.getRange`, the same store-level read that
	// an unbounded scan makes, so it cannot be colder or less ready than the scan it
	// replaces. (See the KEY_REV note; this is that argument applied to a single
	// key.) The exact-id filter below still runs, because a prefix read can also
	// return `dev:abc123` when asked for `dev:abc`.
	const rows = await scanPrefix(table, id);
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
export class RollupCache<T> {
	private value: T | null = null;
	private at = 0;
	private stale = false;
	/** Bumped by every write. A scan is only reusable by readers at its version. */
	private version = 0;
	private inFlight: Promise<T> | null = null;
	private inFlightVersion = -1;
	/** Last time a reader actually took this value — drives idle eviction. */
	private readAt = 0;
	/** What `identity()` answered when the held value was built. */
	private builtFrom: unknown = undefined;

	constructor(
		private readonly ttlMs: number,
		private readonly build: () => Promise<T>,
		/**
		 * Drop the held value after this long with no reads. Must be >= ttlMs or
		 * eviction would throw away values that are still servable; defaults to a
		 * generous multiple so a dashboard left open on a slow refresh never pays.
		 */
		private readonly retainMs = Math.max(ttlMs * 20, 5 * 60_000),
		/**
		 * What the cached value was derived FROM. A cache is only valid for the
		 * database it scanned, and `invalidate()` cannot express that: it is called
		 * by the endpoints that WRITE, so it never fires when the underlying
		 * database is REPLACED wholesale rather than written to.
		 *
		 * That is not hypothetical. The integration harness loads this module once
		 * and swaps in a brand-new empty world before each test, so a rollup built
		 * during one test would otherwise be served intact to the next — a test
		 * asserting "nothing has happened yet" reading back the previous test's
		 * devices. Comparing identity lets the cache notice on its own, which beats
		 * exporting a reset hook that only the tests call and that production
		 * therefore never exercises.
		 */
		private readonly identity: () => unknown = () => null,
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
		this.builtFrom = undefined;
		this.at = 0;
		this.stale = false;
	}

	async get(now: number): Promise<T> {
		this.readAt = now;
		if (this.value !== null && !this.stale && now - this.at < this.ttlMs && this.sameSource()) return this.value;
		return this.refresh();
	}

	/** True when the held value came from the source we would read now. */
	private sameSource(): boolean {
		try {
			return this.identity() === this.builtFrom;
		} catch {
			// identity() reads the database, which throws while Harper is starting.
			// Unknowable is not the same as unchanged — rebuild rather than serve.
			return false;
		}
	}

	private refresh(): Promise<T> {
		// Joinable only if it started after the last write — see the note above.
		if (this.inFlight && this.inFlightVersion === this.version) return this.inFlight;
		const startedAt = this.version;
		const prior = this.inFlight;
		const p = (async () => {
			// Never run two scans at once; queue behind whatever is already going.
			if (prior) await prior.catch(() => {});
			let source: unknown = null;
			try {
				source = this.identity();
			} catch {
				/* database unavailable — sameSource() simply rebuilds next time */
			}
			const v = await this.build();
			this.value = v;
			this.builtFrom = source;
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

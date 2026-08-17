// Solo save slots. On the desktop build these are JSON files in the app's
// userData dir (so they're offline, durable, and Steam-Cloud-syncable); in a
// plain browser we fall back to localStorage so solo still works for dev/web.
//
// A slot file is { meta, data } where `data` is the serialized dynamic tables
// from the in-app backend and `meta` is light info for the load menu.

import { activeSaveRow, activeSaveVersion, serializeActiveSave, serializeActiveSaveJson } from './backend';

export interface SaveMeta {
	slotId: string;
	playerId: string;
	name: string;
	appearance: any;
	createdAt: number;
	updatedAt: number;
}

interface SaveFile {
	meta: SaveMeta;
	data: Record<string, any[]>;
}

interface DesktopBridge {
	isDesktop?: boolean;
	saves?: {
		list(): Promise<string[]>;
		read(slotId: string): Promise<string | null>;
		write(slotId: string, contents: string): Promise<void>;
		remove(slotId: string): Promise<void>;
	};
}

const bridge = (): DesktopBridge | null => (globalThis as any).wildWillowsDesktop || null;
const hasDesktopSaves = () => !!bridge()?.saves;

const LS_PREFIX = 'wild-willows:solo-save:';

// ---- browser storage: IndexedDB, with localStorage as the fallback ----
//
// The desktop build writes real files through the bridge and is unaffected by
// everything below. The BROWSER build (the itch demo, `npm run browser`, local
// web dev) used `localStorage`, which is wrong for this data on two counts:
//
//  • It is SYNCHRONOUS. `setItem` blocks the main thread for the whole write, and
//    autosave fires after actions, so every save was a hitch in the middle of
//    play that got worse as the save grew.
//  • It has a hard ~5 MB per-origin quota, and several engines store strings as
//    UTF-16 — so the real ceiling is closer to 2.5 MB of ASCII JSON. This file's
//    own callers describe a long save as "megabytes of JSON". A player who hit
//    that got a QuotaExceededError mid-session and every save from then on was
//    lost, which is the worst possible time to find out.
//
// IndexedDB is asynchronous and has no comparable quota. It is also absent in
// some environments — private browsing on some engines, sandboxed iframes, and
// the unit-test environment — so every operation below degrades to exactly the
// localStorage behaviour it replaces rather than failing. `indexedSoloSaves() === null` is the
// normal, supported state, not an error path.

const SOLO_SAVE_DB = 'wild-willows';
const SOLO_SAVE_STORE = 'solo-saves';

/** Resolves to an open database, or null when IndexedDB is unusable here. */
let openHandle: Promise<IDBDatabase | null> | null = null;

function openSaveDb(): Promise<IDBDatabase | null> {
	if (openHandle) return openHandle;
	openHandle = new Promise<IDBDatabase | null>((resolve) => {
		let req: IDBOpenDBRequest;
		try {
			if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null);
			req = indexedDB.open(SOLO_SAVE_DB, 1);
		} catch {
			return resolve(null); // SecurityError in a sandboxed frame, etc.
		}
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(SOLO_SAVE_STORE)) db.createObjectStore(SOLO_SAVE_STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => resolve(null);
		// Another tab is holding an old version open. Falling back beats hanging the
		// load menu on a tab the player may not even remember having open.
		req.onblocked = () => resolve(null);
	});
	return openHandle;
}

/** Run one transaction, resolving to `fallback` on any failure. */
function saveStoreRun<T>(
	db: IDBDatabase,
	mode: IDBTransactionMode,
	fallback: T,
	body: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
	return new Promise<T>((resolve) => {
		let req: IDBRequest;
		try {
			const tx = db.transaction(SOLO_SAVE_STORE, mode);
			tx.onabort = () => resolve(fallback);
			req = body(tx.objectStore(SOLO_SAVE_STORE));
		} catch {
			return resolve(fallback);
		}
		req.onsuccess = () => resolve(req.result as T);
		req.onerror = () => resolve(fallback);
	});
}

const saveStoreGet = (db: IDBDatabase, id: string) =>
	saveStoreRun<string | null>(db, 'readonly', null, (st) => st.get(id));
const saveStoreKeys = (db: IDBDatabase) =>
	saveStoreRun<IDBValidKey[]>(db, 'readonly', [], (st) => st.getAllKeys()).then((ks) => ks.map(String));
const saveStoreDelete = (db: IDBDatabase, id: string) =>
	saveStoreRun<unknown>(db, 'readwrite', null, (st) => st.delete(id));

/** Write, reporting whether it actually landed so the caller can fall back. */
async function saveStorePut(db: IDBDatabase, id: string, contents: string): Promise<boolean> {
	const sentinel = Symbol('failed');
	const out = await saveStoreRun<unknown>(db, 'readwrite', sentinel, (st) => st.put(contents, id));
	return out !== sentinel;
}

/** Keys still sitting in localStorage, if there is a localStorage at all. */
function localSlotIds(): string[] {
	const ids: string[] = [];
	try {
		if (typeof localStorage === 'undefined') return ids;
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(LS_PREFIX)) ids.push(k.slice(LS_PREFIX.length));
		}
	} catch {
		/* storage disabled */
	}
	return ids;
}

/**
 * Open the database and, once per page load, move any localStorage saves into it.
 *
 * The order here is the whole safety argument: a save is written to IndexedDB,
 * READ BACK, and compared byte-for-byte before the localStorage copy is dropped.
 * Anything short of an exact match leaves the original exactly where it is, so
 * the failure mode of this migration is a save that lives in both places — which
 * costs quota and nothing else, because reads prefer IndexedDB and `listSlotIds`
 * unions the two.
 *
 * Clearing the localStorage copy is not tidiness: it is the point. Reclaiming
 * that quota is what stops a returning player from hitting the 5 MB ceiling on a
 * save that has already outgrown it.
 */
let indexedSoloSavesReady: Promise<IDBDatabase | null> | null = null;
function indexedSoloSaves(): Promise<IDBDatabase | null> {
	if (indexedSoloSavesReady) return indexedSoloSavesReady;
	indexedSoloSavesReady = (async () => {
		const db = await openSaveDb();
		if (!db) return null;
		for (const id of localSlotIds()) {
			try {
				const raw = localStorage.getItem(LS_PREFIX + id);
				if (raw == null) continue;
				if (!(await saveStorePut(db, id, raw))) continue;
				if ((await saveStoreGet(db, id)) !== raw) continue; // not verified — keep the original
				localStorage.removeItem(LS_PREFIX + id);
			} catch {
				/* leave this slot in localStorage; it stays readable either way */
			}
		}
		return db;
	})();
	return indexedSoloSavesReady;
}

export const newSlotId = () => {
	try {
		return crypto.randomUUID();
	} catch {
		return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	}
};

// ---- low-level slot IO (desktop bridge or localStorage) ----

async function readRawText(slotId: string): Promise<string | null> {
	try {
		if (hasDesktopSaves()) return (await bridge()!.saves!.read(slotId)) || null;
		const saves = await indexedSoloSaves();
		if (saves) {
			const hit = await saveStoreGet(saves, slotId);
			// A miss is not proof of absence: migration may have been interrupted, or
			// this slot may predate it. Fall through to localStorage before giving up.
			if (hit != null) return hit;
		}
		return typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_PREFIX + slotId);
	} catch {
		return null;
	}
}

async function readRaw(slotId: string): Promise<SaveFile | null> {
	try {
		const raw = await readRawText(slotId);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

/**
 * Just the `meta` half of a slot, without parsing the save body.
 *
 * `persist` writes the file as `{"meta":<meta>,"data":<data>}` — meta first and
 * small, data last and potentially megabytes — so the header can be sliced off
 * and parsed on its own. The load menu only ever wants the header, and parsing
 * every slot in full to read a name and a timestamp meant opening the save list
 * cost a full JSON.parse of every save on disk, on the title screen, serially.
 *
 * The slice is a brace-matched scan rather than a search for `,"data":`, because
 * a save whose NAME contained that text would otherwise cut in the wrong place.
 * Anything unexpected falls back to the full parse, so a file written by an older
 * build (or by hand) still reads correctly — this is an optimization, never a
 * format requirement.
 */
async function readMeta(slotId: string): Promise<SaveMeta | null> {
	const raw = await readRawText(slotId);
	if (!raw) return null;
	const head = '{"meta":';
	if (raw.startsWith(head)) {
		const end = matchingBraceEnd(raw, head.length);
		if (end > 0) {
			try {
				return JSON.parse(raw.slice(head.length, end)) as SaveMeta;
			} catch {
				/* fall through to the full parse */
			}
		}
	}
	try {
		return (JSON.parse(raw) as SaveFile)?.meta ?? null;
	} catch {
		return null;
	}
}

/** Index just past the object that starts at `from`, or -1. String-aware, so a
 *  brace or a backslash inside a save name can't throw off the count. */
function matchingBraceEnd(s: string, from: number): number {
	if (s[from] !== '{') return -1;
	let depth = 0;
	let inStr = false;
	let esc = false;
	for (let i = from; i < s.length; i++) {
		const ch = s[i];
		if (inStr) {
			if (esc) esc = false;
			else if (ch === '\\') esc = true;
			else if (ch === '"') inStr = false;
			continue;
		}
		if (ch === '"') inStr = true;
		else if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) return i + 1;
	}
	return -1;
}

async function writeRaw(slotId: string, file: SaveFile): Promise<void> {
	await writeRawJson(slotId, JSON.stringify(file));
}

/** Write an already-serialized save file. The autosave path builds its JSON
 *  incrementally (see persist), so it must not be re-stringified here. */
async function writeRawJson(slotId: string, contents: string): Promise<void> {
	if (hasDesktopSaves()) {
		await bridge()!.saves!.write(slotId, contents);
		return;
	}
	const saves = await indexedSoloSaves();
	if (saves && (await saveStorePut(saves, slotId, contents))) return;
	// No IndexedDB, or the write did not land. localStorage is the same storage
	// this used to be, with the same quota — so a throw here is the same
	// QuotaExceededError the caller already handles (api.ts reports it and shows a
	// save-error toast), not a new failure mode.
	localStorage.setItem(LS_PREFIX + slotId, contents);
}

async function listSlotIds(): Promise<string[]> {
	if (hasDesktopSaves()) {
		try {
			return await bridge()!.saves!.list();
		} catch {
			return [];
		}
	}
	// The UNION of both stores, de-duplicated. If a migration was interrupted —
	// the tab closed mid-loop — some slots are in IndexedDB and some are still in
	// localStorage, and a load menu that showed only one of the two would look
	// like the game had eaten half the player's saves.
	const saves = await indexedSoloSaves();
	const ids = new Set<string>(localSlotIds());
	if (saves) for (const id of await saveStoreKeys(saves)) ids.add(id);
	return [...ids];
}

// ---- public API ----

/** Every solo save, newest first, for the load menu. */
export async function listSaves(): Promise<SaveMeta[]> {
	const ids = await listSlotIds();
	// Header-only reads, and concurrent rather than serial — the menu wants a name
	// and a timestamp per slot, not the worlds behind them.
	const metas = (await Promise.all(ids.map(async (id) => ({ id, meta: await readMeta(id) }))))
		.filter((r): r is { id: string; meta: SaveMeta } => !!r.meta)
		.map(({ id, meta }) => ({ ...meta, slotId: id }));
	return metas.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function loadSaveData(slotId: string): Promise<SaveFile | null> {
	return readRaw(slotId);
}

/** Create a slot record for a brand-new save (data persisted by `persist`). */
export async function createSlot(meta: Omit<SaveMeta, 'slotId' | 'createdAt' | 'updatedAt'>): Promise<SaveMeta> {
	const now = Date.now();
	const slotId = newSlotId();
	const full: SaveMeta = { ...meta, slotId, createdAt: now, updatedAt: now };
	const data = serializeActiveSave() || {};
	await writeRaw(slotId, { meta: full, data });
	return full;
}

/** Snapshot the active world to a slot (autosave after each action). Keeps the
 *  load-menu meta in sync with the live player — appearance and name can change
 *  in-game (restyle your caretaker), so re-read them from the saved player row
 *  instead of trusting the meta captured when the slot was created/loaded. */
export async function persist(meta: SaveMeta): Promise<void> {
	// Nothing has been written since the last save — skip it. Rewriting an
	// identical multi-megabyte file costs a full serialize and a blocking
	// localStorage write for no change at all.
	const version = activeSaveVersion();
	if (version === lastPersistedVersion && lastPersistedSlot === meta.slotId) return;

	// Serialize via the per-table caches instead of handing the whole row graph
	// to JSON.stringify. A typical action dirties one or two of the nine dynamic
	// tables, so the rest are reused verbatim as already-valid JSON.
	const dataJson = serializeActiveSaveJson();
	if (dataJson === null) return;
	const player = activeSaveRow('Player', meta.playerId);
	const updated: SaveMeta = {
		...meta,
		name: player?.name ?? meta.name,
		appearance: player?.appearance ?? meta.appearance,
		updatedAt: Date.now(),
	};
	// Assembled by hand so `data` is spliced in as pre-built JSON. Both halves are
	// valid JSON, so the result parses back to exactly the old shape.
	await writeRawJson(meta.slotId, '{"meta":' + JSON.stringify(updated) + ',"data":' + dataJson + '}');
	lastPersistedVersion = version;
	lastPersistedSlot = meta.slotId;
}

// Guard state for the no-op skip above. Slot is tracked too, so saving into a
// different slot always writes even when the world hasn't changed.
let lastPersistedVersion = -1;
let lastPersistedSlot: string | null = null;

export async function deleteSave(slotId: string): Promise<void> {
	try {
		if (hasDesktopSaves()) {
			await bridge()!.saves!.remove(slotId);
			return;
		}
		// BOTH stores, unconditionally. A slot that exists in each (an interrupted
		// migration) must not come back from the dead because only one copy was
		// removed — "I deleted this save and it reappeared" is worse than a failed
		// delete, and listSlotIds would surface the survivor immediately.
		const saves = await indexedSoloSaves();
		if (saves) await saveStoreDelete(saves, slotId);
		if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_PREFIX + slotId);
	} catch {
		/* ignore */
	}
}

/**
 * Remove every browser-stored save, from BOTH stores.
 *
 * Exists because `localStorage.clear()` stopped meaning "clear the saves" the
 * moment they moved to IndexedDB. The dev panel's reset button says, in the
 * confirmation the developer reads, that browser-stored saves are also cleared —
 * so it has to call this, or the button quietly stops doing half of what it
 * promises and leaves saves behind that the reset was meant to remove.
 *
 * Desktop saves are files owned by the bridge and are deliberately untouched.
 */
export async function clearBrowserSaves(): Promise<void> {
	try {
		const saves = await indexedSoloSaves();
		if (saves) for (const id of await saveStoreKeys(saves)) await saveStoreDelete(saves, id);
	} catch {
		/* ignore */
	}
	try {
		if (typeof localStorage !== 'undefined') for (const id of localSlotIds()) localStorage.removeItem(LS_PREFIX + id);
	} catch {
		/* ignore */
	}
}

export const soloSavesAvailable = () =>
	hasDesktopSaves() || typeof indexedDB !== 'undefined' || typeof localStorage !== 'undefined';

// ---- export / import (single-file backups) ----
//
// Saves are single local JSON files with no cloud sync, so a corrupt write or a
// new machine loses everything. These let a player back a save up to a file and
// bring it back later — the cheap, itch-friendly "export/import save".
//
// An exported file is an ENCRYPTED envelope: { app, v, nonce, sig, enc }. The
// save JSON is encrypted (so the file can't be read or edited in a text editor)
// and carries an integrity tag `sig` (so a tampered or half-written file is
// rejected on import instead of loading broken / cheated state).
//
// Honest scope: this is strong obfuscation, NOT unbreakable encryption. It's a
// solo, offline game, so the key necessarily ships inside the client and someone
// determined who digs it out can still decrypt. It stops the easy paths (reading
// the file, hand-editing values, "export, bump the numbers, re-import") and
// catches corruption. Real competitive integrity lives on the server (co-op).
const SAVE_APP_TAG = 'wild-willows';
const SAVE_FORMAT_VERSION = 1;
const SIG_SECRET = 'wild-willows/solo-save/sig/v1';
const ENC_SECRET = 'wild-willows/solo-save/enc/v1';

/** Two-lane FNV-1a-style mix into four 32-bit words. Deterministic, synchronous,
 *  dependency-free; the shared primitive under both the tag and the keystream.
 *
 *  Split into a resumable mix + a finish so callers can hash A THEN B without
 *  building the string `A + B` first. The digest is bit-for-bit what the old
 *  single-string version produced — the mix is a plain left-to-right fold and the
 *  only length-dependent step is the final `h1 ^ len`, which now takes the summed
 *  length — so every save exported before this change still verifies and decrypts.
 *  Two hot paths needed it:
 *
 *   • signPayload was concatenating a full copy of a multi-megabyte payload onto
 *     its secret just to hash it, doubling peak memory and walking it twice.
 *   • keystreamBlock rebuilds `${ENC_SECRET}|${nonce}|${counter}` and hashes all
 *     ~50 characters of it once per SIXTEEN output bytes — about three inner
 *     iterations per byte of save. Only the counter changes between blocks, so
 *     the constant prefix can be folded once and resumed per block. */
const H1_SEED = 0x811c9dc5 >>> 0;
const H2_SEED = 0xc2b2ae35 >>> 0;

/** Fold `s` into a running two-lane state. */
function hashMix(state: [number, number], s: string): [number, number] {
	let h1 = state[0];
	let h2 = state[1];
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ c, 0x85ebca77) >>> 0;
		h1 ^= h1 >>> 15;
		h2 ^= h2 >>> 13;
	}
	return [h1, h2];
}

/** Close out a running state over `len` total input characters. */
function hashFinish(state: [number, number], len: number): [number, number, number, number] {
	const h1 = (state[0] ^ len) >>> 0;
	const h2 = state[1];
	const h3 = Math.imul(h1 ^ h2, 0x27d4eb2f) >>> 0;
	const h4 = (h1 + h2) >>> 0;
	return [h1, h2, h3, h4];
}

function hash128(s: string): [number, number, number, number] {
	return hashFinish(hashMix([H1_SEED, H2_SEED], s), s.length);
}

const hex32 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

/** Keyed integrity tag over a plaintext payload, as 128-bit hex.
 *  Streams the secret and the payload separately rather than concatenating them —
 *  same digest, without allocating a second copy of a save that can be megabytes. */
function signPayload(payload: string): string {
	const prefix = SIG_SECRET + ' ';
	const [a, b, c, d] = hashFinish(
		hashMix(hashMix([H1_SEED, H2_SEED], prefix), payload),
		prefix.length + payload.length,
	);
	return hex32(a) + hex32(b) + hex32(c) + hex32(d);
}

/** Constant-ish time string compare for the integrity tag. */
function tagsMatch(a: string, b: string): boolean {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

// ---- keystream cipher (hash-based CTR) + base64 ----

/** The per-nonce constant half of the keystream input, folded once. */
function keystreamPrefix(nonce: string): { state: [number, number]; len: number } {
	const prefix = `${ENC_SECRET}|${nonce}|`;
	return { state: hashMix([H1_SEED, H2_SEED], prefix), len: prefix.length };
}

/** One 16-byte keystream block, written straight into `out` at `at`.
 *  Takes the pre-folded prefix so only the counter's few digits are hashed here. */
function keystreamBlockInto(
	pre: { state: [number, number]; len: number },
	counter: number,
	out: Uint8Array,
	at: number,
) {
	const c = String(counter);
	const [a, b, c3, d] = hashFinish(hashMix([pre.state[0], pre.state[1]], c), pre.len + c.length);
	const words = [a, b, c3, d];
	for (let i = 0; i < 4; i++) {
		const o = at + i * 4;
		if (o >= out.length) return;
		out[o] = words[i] & 0xff;
		if (o + 1 < out.length) out[o + 1] = (words[i] >>> 8) & 0xff;
		if (o + 2 < out.length) out[o + 2] = (words[i] >>> 16) & 0xff;
		if (o + 3 < out.length) out[o + 3] = (words[i] >>> 24) & 0xff;
	}
}

/** XOR bytes against the nonce-seeded keystream (encrypt and decrypt are identical).
 *  Generates the stream a block at a time into a scratch buffer instead of
 *  re-deriving a fresh Uint8Array per 16 bytes; byte-for-byte the same output. */
function xorKeystream(bytes: Uint8Array, nonce: string): Uint8Array {
	const out = new Uint8Array(bytes.length);
	const pre = keystreamPrefix(nonce);
	const block = new Uint8Array(16);
	for (let i = 0; i < bytes.length; i += 16) {
		keystreamBlockInto(pre, i >> 4, block, 0);
		const end = Math.min(16, bytes.length - i);
		for (let j = 0; j < end; j++) out[i + j] = bytes[i + j] ^ block[j];
	}
	return out;
}

/** Base64 in chunks.
 *  This used to build the binary string one character at a time —
 *  `bin += String.fromCharCode(bytes[i])` — which on a save the code elsewhere
 *  describes as "megabytes of JSON" is a million-iteration rope concat on the
 *  main thread, and it sat behind the demo's Export button: the last screen a
 *  demo player sees and the game's single best conversion moment. Chunking with
 *  `String.fromCharCode.apply` does the same work in ~1/8000th the iterations;
 *  the chunk is kept well under the argument-count limit that makes `apply`
 *  throw on large arrays. */
function bytesToB64(bytes: Uint8Array): string {
	const CHUNK = 8192;
	const parts: string[] = [];
	for (let i = 0; i < bytes.length; i += CHUNK) {
		parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]));
	}
	return btoa(parts.join(''));
}

function b64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

/** Encrypt a { meta, data } save into the standard pretty-printed envelope that
 *  importSave (and the desktop game's Import) accepts. */
function encryptSaveEnvelope(save: SaveFile): string {
	const payload = JSON.stringify(save);
	const nonce = newSlotId(); // per-file, so identical saves export differently
	const cipher = xorKeystream(new TextEncoder().encode(payload), nonce);
	return JSON.stringify(
		{
			app: SAVE_APP_TAG,
			v: SAVE_FORMAT_VERSION,
			nonce,
			sig: signPayload(payload), // MAC over the plaintext, checked after decrypt
			enc: bytesToB64(cipher),
		},
		null,
		2,
	);
}

/** The active save as an encrypted, pretty-printed envelope for download/backup. */
export async function exportSlot(slotId: string): Promise<string | null> {
	const file = await readRaw(slotId);
	if (!file?.meta) return null;
	// Normalize the embedded slotId to match how it was stored/listed.
	return encryptSaveEnvelope({ meta: { ...file.meta, slotId }, data: file.data || {} });
}

/** Encrypt an arbitrary meta + dynamic-table data into an importable save file.
 *  Used to export a Harper-backed demo save (server-dumped rows) so it imports
 *  into the offline/desktop game exactly like a local solo save. */
export function packSaveFile(
	meta: { playerId: string; name?: string; appearance?: any; createdAt?: number; updatedAt?: number },
	data: Record<string, any[]>,
): string {
	const now = Date.now();
	const full: SaveMeta = {
		slotId: newSlotId(),
		playerId: meta.playerId,
		name: meta.name || 'Caretaker',
		appearance: meta.appearance || {},
		createdAt: meta.createdAt || now,
		updatedAt: meta.updatedAt || now,
	};
	return encryptSaveEnvelope({ meta: full, data: data || {} });
}

/** True when a parsed object looks like a Wild Willows save payload. */
function looksLikeSave(parsed: any): parsed is SaveFile {
	return (
		!!parsed &&
		typeof parsed === 'object' &&
		parsed.meta &&
		typeof parsed.meta === 'object' &&
		typeof parsed.meta.playerId === 'string' &&
		parsed.meta.playerId &&
		parsed.data &&
		typeof parsed.data === 'object' &&
		!Array.isArray(parsed.data)
	);
}

/** Bring an exported save file back in as a NEW slot: decrypt, verify the
 *  integrity tag (rejecting edited or corrupted files), then always mint a fresh
 *  slotId so importing never clobbers an existing save. Throws 'invalid-save'
 *  for anything missing, malformed, tampered with, or damaged. */
export async function importSave(contents: string): Promise<SaveMeta> {
	let env: any;
	try {
		env = JSON.parse(contents);
	} catch {
		throw new Error('invalid-save');
	}
	// Must be our encrypted envelope — bare JSON or a foreign file is refused.
	if (
		!env ||
		typeof env !== 'object' ||
		env.app !== SAVE_APP_TAG ||
		typeof env.nonce !== 'string' ||
		typeof env.sig !== 'string' ||
		typeof env.enc !== 'string'
	) {
		throw new Error('invalid-save');
	}

	let save: any;
	try {
		const plain = new TextDecoder().decode(xorKeystream(b64ToBytes(env.enc), env.nonce));
		// Verify the tag against the decrypted plaintext before trusting it, then
		// parse. Tampered ciphertext decrypts to garbage → tag mismatch or bad JSON.
		if (!tagsMatch(signPayload(plain), env.sig)) throw new Error('invalid-save');
		save = JSON.parse(plain);
	} catch {
		throw new Error('invalid-save');
	}
	if (!looksLikeSave(save)) throw new Error('invalid-save');

	const now = Date.now();
	const slotId = newSlotId();
	const src = save.meta;
	const meta: SaveMeta = {
		slotId,
		playerId: src.playerId,
		name: typeof src.name === 'string' && src.name.trim() ? src.name : 'Caretaker',
		appearance: src.appearance ?? {},
		createdAt: typeof src.createdAt === 'number' ? src.createdAt : now,
		updatedAt: now,
	};
	await writeRaw(slotId, { meta, data: save.data });
	return meta;
}

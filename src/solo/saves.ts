// Solo save slots. On the desktop build these are JSON files in the app's
// userData dir (so they're offline, durable, and Steam-Cloud-syncable); in a
// plain browser we fall back to localStorage so solo still works for dev/web.
//
// A slot file is { meta, data } where `data` is the serialized dynamic tables
// from the in-app backend and `meta` is light info for the load menu.

import { serializeActiveSave } from './backend';

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

export const newSlotId = () => {
	try {
		return crypto.randomUUID();
	} catch {
		return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	}
};

// ---- low-level slot IO (desktop bridge or localStorage) ----

async function readRaw(slotId: string): Promise<SaveFile | null> {
	try {
		if (hasDesktopSaves()) {
			const raw = await bridge()!.saves!.read(slotId);
			return raw ? JSON.parse(raw) : null;
		}
		const raw = localStorage.getItem(LS_PREFIX + slotId);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

async function writeRaw(slotId: string, file: SaveFile): Promise<void> {
	const contents = JSON.stringify(file);
	if (hasDesktopSaves()) {
		await bridge()!.saves!.write(slotId, contents);
		return;
	}
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
	const ids: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k?.startsWith(LS_PREFIX)) ids.push(k.slice(LS_PREFIX.length));
	}
	return ids;
}

// ---- public API ----

/** Every solo save, newest first, for the load menu. */
export async function listSaves(): Promise<SaveMeta[]> {
	const ids = await listSlotIds();
	const metas: SaveMeta[] = [];
	for (const id of ids) {
		const f = await readRaw(id);
		if (f?.meta) metas.push({ ...f.meta, slotId: id });
	}
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
	const data = serializeActiveSave();
	if (!data) return;
	const player = (data.Player || []).find((p: any) => p?.id === meta.playerId);
	const updated: SaveMeta = {
		...meta,
		name: player?.name ?? meta.name,
		appearance: player?.appearance ?? meta.appearance,
		updatedAt: Date.now(),
	};
	await writeRaw(meta.slotId, { meta: updated, data });
}

export async function deleteSave(slotId: string): Promise<void> {
	try {
		if (hasDesktopSaves()) await bridge()!.saves!.remove(slotId);
		else localStorage.removeItem(LS_PREFIX + slotId);
	} catch {
		/* ignore */
	}
}

export const soloSavesAvailable = () => hasDesktopSaves() || typeof localStorage !== 'undefined';

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
 *  dependency-free; the shared primitive under both the tag and the keystream. */
function hash128(s: string): [number, number, number, number] {
	let h1 = 0x811c9dc5 >>> 0;
	let h2 = 0xc2b2ae35 >>> 0;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ c, 0x85ebca77) >>> 0;
		h1 ^= h1 >>> 15;
		h2 ^= h2 >>> 13;
	}
	h1 = (h1 ^ s.length) >>> 0;
	const h3 = Math.imul(h1 ^ h2, 0x27d4eb2f) >>> 0;
	const h4 = (h1 + h2) >>> 0;
	return [h1, h2, h3, h4];
}

const hex32 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

/** Keyed integrity tag over a plaintext payload, as 128-bit hex. */
function signPayload(payload: string): string {
	const [a, b, c, d] = hash128(SIG_SECRET + ' ' + payload);
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

function keystreamBlock(nonce: string, counter: number): Uint8Array {
	const [a, b, c, d] = hash128(`${ENC_SECRET}|${nonce}|${counter}`);
	const out = new Uint8Array(16);
	const words = [a, b, c, d];
	for (let i = 0; i < 4; i++) {
		out[i * 4] = words[i] & 0xff;
		out[i * 4 + 1] = (words[i] >>> 8) & 0xff;
		out[i * 4 + 2] = (words[i] >>> 16) & 0xff;
		out[i * 4 + 3] = (words[i] >>> 24) & 0xff;
	}
	return out;
}

/** XOR bytes against the nonce-seeded keystream (encrypt and decrypt are identical). */
function xorKeystream(bytes: Uint8Array, nonce: string): Uint8Array {
	const out = new Uint8Array(bytes.length);
	let block = keystreamBlock(nonce, 0);
	let counter = 0;
	let bi = 0;
	for (let i = 0; i < bytes.length; i++) {
		if (bi >= block.length) {
			block = keystreamBlock(nonce, ++counter);
			bi = 0;
		}
		out[i] = bytes[i] ^ block[bi++];
	}
	return out;
}

function bytesToB64(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

/** The active save as an encrypted, pretty-printed envelope for download/backup. */
export async function exportSlot(slotId: string): Promise<string | null> {
	const file = await readRaw(slotId);
	if (!file?.meta) return null;
	// Normalize the embedded slotId to match how it was stored/listed.
	const save: SaveFile = { meta: { ...file.meta, slotId }, data: file.data || {} };
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

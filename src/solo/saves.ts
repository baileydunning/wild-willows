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

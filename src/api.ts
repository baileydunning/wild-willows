// Client for the game API. Every persisted action goes through these calls.
//
// Transport: on the web the frontend talks to its own origin (the deployed
// Harper). On the desktop build there are two backends — SOLO runs the same
// server logic in-app against local save files (fully offline, see src/solo),
// and CO-OP talks to the hosted Harper. `transport` selects which is live.

import type { Appearance, GameData, GameState, WorldSummary, Peer, RosterEntry } from './types';
import { soloRequest } from './solo/backend';
import { persist as persistSolo, type SaveMeta } from './solo/saves';

const STORAGE_KEY = 'wild-willows:last-save';

// Hosted Harper for desktop co-op. (Web builds ignore this and use their own
// origin.) Override-able later via Settings if needed.
export const COOP_BASE_URL = 'https://wild.willows.harperfabric.com';

const isDesktop = !!(globalThis as any).wildWillowsDesktop?.isDesktop;

export type Transport = 'web' | 'solo' | 'coop';
// Desktop defaults to solo so the title screen + solo play work with no network;
// the web build always uses its own origin.
let transport: Transport = isDesktop ? 'solo' : 'web';
let soloSlot: SaveMeta | null = null;

export function setTransport(t: Transport) {
	transport = t;
}
export function getTransport(): Transport {
	return transport;
}
// The save slot the active solo game autosaves to after each action.
export function setSoloSlot(meta: SaveMeta | null) {
	soloSlot = meta;
}
export function getSoloSlot(): SaveMeta | null {
	return soloSlot;
}

// Throttled autosave: at most one write per window, always capturing the latest
// state at fire time. Bounds data loss to the window length and avoids writing
// the whole save on every single action.
const SAVE_THROTTLE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePending = false;

function scheduleSoloSave() {
	savePending = true;
	if (saveTimer != null) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		if (savePending && soloSlot) {
			savePending = false;
			persistSolo(soloSlot).catch(() => {});
		}
	}, SAVE_THROTTLE_MS);
}

/** Force any pending solo save to disk now (on quit / tab hide / leaving play). */
export async function flushSoloSave(): Promise<void> {
	if (saveTimer != null) {
		clearTimeout(saveTimer);
		saveTimer = null;
	}
	if (savePending && soloSlot) {
		savePending = false;
		try {
			await persistSolo(soloSlot);
		} catch {
			/* best effort */
		}
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => void flushSoloSave());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void flushSoloSave();
	});
}

let currentPlayerId: string | null = null;

export function setPlayerId(id: string | null) {
	currentPlayerId = id;
}
export function getPlayerId(): string | null {
	return currentPlayerId;
}

export type SaveMode = 'solo' | 'coop';
const modeKey = (mode: SaveMode) => `${STORAGE_KEY}:${mode}`;

// The last save is remembered per mode, so the title screen's "Continue" only
// offers the most recent save that matches the Solo/Co-op toggle.
export function rememberSave(playerId: string, name: string, mode: SaveMode = 'solo') {
	try {
		const rec = JSON.stringify({ playerId, name, mode });
		localStorage.setItem(modeKey(mode), rec);
		localStorage.setItem(STORAGE_KEY, rec); // overall most-recent (legacy/fallback)
	} catch { /* private mode etc. */ }
}
export function lastSave(mode?: SaveMode): { playerId: string; name: string; mode?: SaveMode } | null {
	try {
		if (!mode) {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		}
		const raw = localStorage.getItem(modeKey(mode));
		if (raw) return JSON.parse(raw);
		// Legacy fallback: a save made before per-mode tracking has no mode tag —
		// treat it as solo so existing players keep their Continue button.
		const legacy = localStorage.getItem(STORAGE_KEY);
		if (legacy) {
			const rec = JSON.parse(legacy);
			if (rec.mode === mode || (!rec.mode && mode === 'solo')) return rec;
		}
		return null;
	} catch {
		return null;
	}
}
export function forgetSave(mode?: SaveMode) {
	try {
		if (mode) localStorage.removeItem(modeKey(mode));
		else {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(modeKey('solo'));
			localStorage.removeItem(modeKey('coop'));
		}
	} catch { /* ignore */ }
}

// GameData is static definitions bundled with the app, so on desktop it's always
// served locally — the title screen then works offline regardless of mode.
const isLocalCall = (path: string) =>
	transport === 'solo' || (isDesktop && path.startsWith('/GameData'));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const method = (options?.method || 'GET').toUpperCase();

	// --- solo / local in-app backend ---
	if (isLocalCall(path)) {
		const body = options?.body ? JSON.parse(String(options.body)) : undefined;
		const res = await soloRequest(path, method, body);
		if (res.status >= 400) {
			const err: any = new Error(res.body?.title || `Request failed (${res.status})`);
			err.status = res.status;
			throw err;
		}
		// Autosave the world after any mutating action — throttled so frequent
		// actions (movement sync, heartbeats) don't serialize+write the whole save
		// every time. The trailing write captures the latest state.
		if (method !== 'GET' && soloSlot && transport === 'solo') scheduleSoloSave();
		return res.body as T;
	}

	// --- web (same origin) or desktop co-op (hosted Harper) ---
	const base = transport === 'coop' && isDesktop ? COOP_BASE_URL : '';
	const res = await fetch(base + path, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		...options,
	});
	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		try {
			const body = await res.json();
			message = body?.title || body?.error || body?.message || message;
		} catch {
			/* keep default */
		}
		const err: any = new Error(message);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

function post<T>(path: string, body: object): Promise<T> {
	return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

const pid = () => {
	if (!currentPlayerId) throw new Error('Not logged in');
	return currentPlayerId;
};

export const api = {
	gameData: () => request<GameData>('/GameData/'),
	gameState: (playerId?: string) => request<GameState>(`/GameState/${playerId ?? pid()}`),
	createPlayer: (name: string, passcode: string, appearance: Appearance) =>
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>('/CreatePlayer/', { name, passcode, appearance, tzOffsetMinutes: -new Date().getTimezoneOffset() }),
	login: (name: string, passcode: string) =>
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>('/LoginPlayer/', { name, passcode, tzOffsetMinutes: -new Date().getTimezoneOffset() }),

	// --- multiplayer: shared co-op worlds (personal progress stays per-player) ---
	myWorlds: () => post<{ ok: boolean; activeWorldId: string; worlds: WorldSummary[] }>('/MyWorlds/', { playerId: pid() }),
	createWorld: (name: string) =>
		post<{ ok: boolean; world: WorldSummary; worlds: WorldSummary[] }>('/CreateWorld/', { playerId: pid(), name }),
	joinWorld: (joinCode: string, token?: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/JoinWorld/', { playerId: pid(), joinCode, token }),

	// --- co-op join: verify code, request approval, host resolves ---
	checkWorldCode: (joinCode: string) =>
		post<{ ok: boolean; exists: boolean; world?: { worldId: string; name: string; hostName: string; memberCount: number; maxMembers: number; full: boolean } }>('/CheckWorldCode/', { joinCode }),
	requestJoin: (joinCode: string, token: string, name: string) =>
		post<{ ok: boolean; worldId: string; world: { name: string; hostName: string } }>('/RequestJoin/', { joinCode, token, name }),
	joinStatus: (worldId: string, token: string) =>
		post<{ ok: boolean; status: 'pending' | 'approved' | 'denied' | 'none' }>('/JoinRequestStatus/', { worldId, token }),
	pendingRequests: () =>
		post<{ ok: boolean; requests: { token: string; name: string; createdAt: number }[] }>('/PendingJoinRequests/', { playerId: pid() }),
	resolveJoin: (worldId: string, token: string, approve: boolean) =>
		post<{ ok: boolean }>('/ResolveJoin/', { playerId: pid(), worldId, token, approve }),
	worldRoster: () =>
		post<{ ok: boolean; roster: RosterEntry[]; closed: boolean; maxMembers: number; joinCode: string | null }>('/WorldRoster/', { playerId: pid() }),
	switchWorld: (worldId: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/SwitchWorld/', { playerId: pid(), worldId }),
	leaveWorld: (worldId: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/LeaveWorld/', { playerId: pid(), worldId }),
	presence: (x: number, y: number, area: string) =>
		post<{ ok: boolean; worldId: string; peers: Peer[] }>('/Presence/', { playerId: pid(), x, y, area }),
	deletePlayer: (name: string, passcode: string) =>
		post<{ ok: boolean; deleted: string }>('/DeletePlayer/', { name, passcode }),
	changePasscode: (currentPasscode: string, newPasscode: string) =>
		post<{ ok: boolean }>('/ChangePasscode/', { playerId: pid(), currentPasscode, newPasscode }),
	updateAppearance: (appearance: Appearance) =>
		post<{ ok: boolean; appearance: Appearance }>('/UpdateAppearance/', { playerId: pid(), appearance }),
	collect: (biomeId: string, nodeId: string, resourceId: string) =>
		post<any>('/CollectResource/', { playerId: pid(), biomeId, nodeId, resourceId }),
	chestTransfer: (chestId: string, resourceId: string, qty: number, direction: 'deposit' | 'withdraw') =>
		post<any>('/ChestTransfer/', { playerId: pid(), chestId, resourceId, qty, direction }),
	craft: (recipeId: string) => post<any>('/CraftItem/', { playerId: pid(), recipeId }),
	discard: (kind: 'material' | 'crafted', id: string, qty: number) =>
		post<any>('/DiscardItem/', { playerId: pid(), kind, id, qty }),
	place: (objectId: string, area: string, x: number, y: number) =>
		post<any>('/PlaceObject/', { playerId: pid(), objectId, area, x, y }),
	remove: (placementId: string) => post<any>('/RemoveObject/', { playerId: pid(), placementId }),
	move: (placementId: string, x: number, y: number) =>
		post<any>('/MoveObject/', { playerId: pid(), placementId, x, y }),
	upgradeTool: (toolId: string) => post<any>('/UpgradeTool/', { playerId: pid(), toolId }),
	upgradeHome: (track: string) => post<any>('/UpgradeHome/', { playerId: pid(), track }),
	setHomeStyle: (style: string) => post<any>('/SetHomeStyle/', { playerId: pid(), style }),
	rest: () => post<any>('/Rest/', { playerId: pid() }),
	setHomeColors: (colors: { floor?: string; wall?: string; accent?: string; rug?: string }) =>
		post<any>('/SetHomeColors/', { playerId: pid(), colors }),
	setPlacementColor: (placementId: string, color: string) =>
		post<any>('/SetPlacementColor/', { playerId: pid(), placementId, color }),
	observe: (animalId: string) => post<any>('/ObserveAnimal/', { playerId: pid(), animalId }),
	claimTask: (taskId: string) => post<any>('/ClaimTask/', { playerId: pid(), taskId }),
	terraform: (area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') =>
		post<any>('/Terraform/', { playerId: pid(), area, x, y, action }),
	plant: (area: string, x: number, y: number, plantId: string) =>
		post<any>('/Plant/', { playerId: pid(), area, x, y, plantId }),
	syncPlayer: (x: number, y: number, area?: string, tutorialStep?: number) =>
		post<any>('/SyncPlayer/', { playerId: pid(), x, y, area, tutorialStep }),
	heartbeat: () => post<any>('/Heartbeat/', { playerId: pid() }),
	appendFeed: (entries: { icon: string; text: string; at: number }[]) =>
		post<any>('/AppendFeed/', { playerId: pid(), entries }),
	recalc: (biomeId: string) => post<any>('/RecalcBiome/', { playerId: pid(), biomeId }),
	dev: (action: string, args: Record<string, any> = {}) =>
		post<any>('/DevTools/', { playerId: pid(), action, ...args }),
	// Per-player metrics view (drives Steam Stats/Achievements on desktop).
	metrics: (playerId?: string) => request<{ player: any }>(`/Metrics/${playerId ?? pid()}`),
};

// ---------------------------------------------------------------- solo saves
// Desktop solo play needs no passcode and no server: start a save, autosave to a
// local slot, and load it back. These wrap the in-app backend + slot storage.

import { newSoloGame as backendNew, loadSoloGame as backendLoad, endSolo } from './solo/backend';
import { createSlot, listSaves as listSoloSaves, loadSaveData, deleteSave as deleteSoloSave } from './solo/saves';

export type { SaveMeta } from './solo/saves';
export { listSoloSaves, deleteSoloSave };

/** Start a fresh solo game (no passcode) and create its save slot. */
export async function startSoloGame(name: string, appearance: Appearance): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const created = await backendNew(name, appearance);
	const slot = await createSlot({ playerId: created.playerId, name, appearance });
	setSoloSlot(slot);
	setPlayerId(created.playerId);
	return { playerId: created.playerId, state: created.state, slot };
}

/** Load a solo save slot back into play. */
export async function resumeSoloGame(slotId: string): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const file = await loadSaveData(slotId);
	if (!file) throw new Error('That save could not be found');
	const state = await backendLoad(file.meta.playerId, file.data);
	setSoloSlot(file.meta);
	setPlayerId(file.meta.playerId);
	return { playerId: file.meta.playerId, state, slot: file.meta };
}

/** Leave the active solo game (back to the menu) and reset the transport. */
export function exitSolo() {
	void flushSoloSave(); // persist any pending throttled write before we drop it
	setSoloSlot(null);
	endSolo();
	setTransport(isDesktop ? 'solo' : 'web');
}

/** True on the desktop (Electron) build. The web build always uses its origin. */
export const IS_DESKTOP = isDesktop;

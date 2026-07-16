// Client for the game API. Every persisted action goes through these calls.
//
// Transport: on the web the frontend talks to its own origin (the deployed
// Harper). On the desktop build there are two backends — SOLO runs the same
// server logic in-app against local save files (fully offline, see src/solo),
// and CO-OP talks to the hosted Harper. `transport` selects which is live.

import type { Appearance, GameData, GameState, WorldSummary, Peer, RosterEntry } from './types';
import { t, getLocale } from './i18n';
import { soloRequest } from './solo/backend';
import { persist as persistSolo, type SaveMeta } from './solo/saves';
import { DEMO, EDITION, DEMO_WEB_BACKEND } from './demo';

const STORAGE_KEY = 'wild-willows:last-save';

// Hosted Harper for desktop co-op. (Web builds ignore this and use their own
// origin.) Override-able later via Settings if needed.
export const COOP_BASE_URL = 'https://wild.willows.harperfabric.com';

const isDesktop = !!(globalThis as any).wildWillowsDesktop?.isDesktop;

export type Transport = 'web' | 'solo' | 'coop';
// Desktop defaults to solo so the title screen + solo play work with no network;
// the web build normally uses its own origin. The itch demo defaults to the
// offline solo backend too (passwordless, no accounts) unless it's explicitly
// configured for Harper accounts.
const DEMO_SOLO_DEFAULT = DEMO && !isDesktop && DEMO_WEB_BACKEND === 'solo';
let transport: Transport = isDesktop || DEMO_SOLO_DEFAULT ? 'solo' : 'web';
let soloSlot: SaveMeta | null = null;

// ------------------------------------------------------------- demo backend
// The itch DEMO is a WEB build served as static files, so it has no same-origin
// Harper. It talks to the hosted Harper cross-origin (Harper-first). If that
// probe fails (offline, or CORS not allowed for the itch origin), the demo falls
// back to the fully-offline in-app solo backend so it still plays.
const DEMO_WEB = DEMO && !isDesktop;
let demoBackend: 'pending' | 'harper' | 'solo' = !DEMO_WEB
	? 'harper'
	: DEMO_WEB_BACKEND === 'solo'
		? 'solo' // passwordless offline demo — no probe needed
		: 'pending';

/** The resolved demo backend: 'harper' once the hosted server answered, 'solo'
 *  once we've committed to the offline fallback, 'pending' before the probe. */
export function getDemoBackend(): 'pending' | 'harper' | 'solo' {
	return demoBackend;
}

/** Probe the hosted Harper once at startup (DEMO web only). On success we keep
 *  the 'web' transport pointed at the hosted Harper; on any failure we commit to
 *  the in-app solo backend for the whole session. A no-op for every other build. */
export async function resolveDemoBackend(): Promise<'harper' | 'solo'> {
	if (!DEMO_WEB) return 'harper';
	// Solo-default demo: already committed to the offline backend, no probe.
	if (demoBackend !== 'pending') return demoBackend;
	try {
		// Probe with the SAME headers real API calls use (Content-Type triggers a
		// CORS preflight). A bare GET could pass while real calls fail the
		// preflight — this way the probe fails exactly when gameplay would, so we
		// fall back to solo instead of dead-ending on the first real request.
		const res = await fetch(COOP_BASE_URL + '/GameData/', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) throw new Error(`status ${res.status}`);
		demoBackend = 'harper';
		setTransport('web');
	} catch {
		// Hosted Harper unreachable or blocked by CORS — play fully offline.
		demoBackend = 'solo';
		setTransport('solo');
	}
	return demoBackend;
}

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
	} catch {
		/* private mode etc. */
	}
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
	} catch {
		/* ignore */
	}
}

// GameData is static definitions bundled with the app, so on desktop it's always
// served locally — the title screen then works offline regardless of mode.
const isLocalCall = (path: string) => transport === 'solo' || (isDesktop && path.startsWith('/GameData'));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const method = (options?.method || 'GET').toUpperCase();

	// --- solo / local in-app backend ---
	if (isLocalCall(path)) {
		const body = options?.body ? JSON.parse(String(options.body)) : undefined;
		const res = await soloRequest(path, method, body);
		if (res.status >= 400) {
			const err: any = new Error(res.body?.title || t('app.error.requestFailed', { status: res.status }));
			err.status = res.status;
			throw err;
		}
		// Autosave the world after any mutating action — throttled so frequent
		// actions (movement sync, heartbeats) don't serialize+write the whole save
		// every time. The trailing write captures the latest state.
		if (method !== 'GET' && soloSlot && transport === 'solo') scheduleSoloSave();
		return res.body as T;
	}

	// --- web (same origin) or desktop co-op / demo (hosted Harper) ---
	// The itch demo is served cross-origin from the hosted Harper, so its web
	// calls target COOP_BASE_URL too (only reached in Harper mode; the solo
	// fallback routes through the local branch above).
	const base = (transport === 'coop' && isDesktop) || DEMO_WEB ? COOP_BASE_URL : '';
	const res = await fetch(base + path, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		...options,
	});
	if (!res.ok) {
		let message = t('app.error.requestFailed', { status: res.status });
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
	if (!currentPlayerId) throw new Error(t('app.error.notLoggedIn'));
	return currentPlayerId;
};

export const api = {
	gameData: () => request<GameData>('/GameData/'),
	gameState: (playerId?: string) => request<GameState>(`/GameState/${playerId ?? pid()}`),
	createPlayer: (name: string, passcode: string, appearance: Appearance, creationMs = 0) =>
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>(
			'/CreatePlayer/',
			{ name, passcode, appearance, tzOffsetMinutes: -new Date().getTimezoneOffset(), creationMs, edition: EDITION },
		),
	login: (name: string, passcode: string) =>
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>(
			'/LoginPlayer/',
			{ name, passcode, tzOffsetMinutes: -new Date().getTimezoneOffset() },
		),

	// --- multiplayer: shared co-op worlds (personal progress stays per-player) ---
	myWorlds: () =>
		post<{ ok: boolean; activeWorldId: string; worlds: WorldSummary[] }>('/MyWorlds/', { playerId: pid() }),
	createWorld: (name: string) =>
		post<{ ok: boolean; world: WorldSummary; worlds: WorldSummary[] }>('/CreateWorld/', { playerId: pid(), name }),
	joinWorld: (joinCode: string, token?: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/JoinWorld/', {
			playerId: pid(),
			joinCode,
			token,
		}),

	// --- co-op join: verify code, request approval, host resolves ---
	checkWorldCode: (joinCode: string) =>
		post<{
			ok: boolean;
			exists: boolean;
			world?: {
				worldId: string;
				name: string;
				hostName: string;
				memberCount: number;
				maxMembers: number;
				full: boolean;
			};
		}>('/CheckWorldCode/', { joinCode }),
	requestJoin: (joinCode: string, token: string, name: string) =>
		post<{ ok: boolean; worldId: string; world: { name: string; hostName: string } }>('/RequestJoin/', {
			joinCode,
			token,
			name,
		}),
	joinStatus: (worldId: string, token: string) =>
		post<{ ok: boolean; status: 'pending' | 'approved' | 'denied' | 'none' }>('/JoinRequestStatus/', {
			worldId,
			token,
		}),
	pendingRequests: () =>
		post<{ ok: boolean; requests: { token: string; name: string; createdAt: number }[] }>('/PendingJoinRequests/', {
			playerId: pid(),
		}),
	resolveJoin: (worldId: string, token: string, approve: boolean) =>
		post<{ ok: boolean }>('/ResolveJoin/', { playerId: pid(), worldId, token, approve }),
	worldRoster: () =>
		post<{ ok: boolean; roster: RosterEntry[]; closed: boolean; maxMembers: number; joinCode: string | null }>(
			'/WorldRoster/',
			{ playerId: pid() },
		),
	switchWorld: (worldId: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/SwitchWorld/', {
			playerId: pid(),
			worldId,
		}),
	leaveWorld: (worldId: string) =>
		post<{ ok: boolean; worldId: string; worlds: WorldSummary[]; state: GameState }>('/LeaveWorld/', {
			playerId: pid(),
			worldId,
		}),
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
	place: (objectId: string, area: string, x: number, y: number, rotation = 0) =>
		post<any>('/PlaceObject/', { playerId: pid(), objectId, area, x, y, rotation }),
	remove: (placementId: string) => post<any>('/RemoveObject/', { playerId: pid(), placementId }),
	move: (placementId: string, x: number, y: number, rotation?: number) =>
		post<any>('/MoveObject/', { playerId: pid(), placementId, x, y, rotation }),
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
	setGoals: (goals: any[]) => post<any>('/SetGoals/', { playerId: pid(), goals }),
	terraform: (area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') =>
		post<any>('/Terraform/', { playerId: pid(), area, x, y, action }),
	plant: (area: string, x: number, y: number, plantId: string) =>
		post<any>('/Plant/', { playerId: pid(), area, x, y, plantId }),
	harvest: (placementId: string) => post<any>('/HarvestPlacement/', { playerId: pid(), placementId }),
	syncPlayer: (x: number, y: number, area?: string, tutorialStep?: number) =>
		post<any>('/SyncPlayer/', { playerId: pid(), x, y, area, tutorialStep }),
	// language + edition ride on the heartbeat so metrics can report interface
	// language and split demo vs paid players
	heartbeat: () => post<any>('/Heartbeat/', { playerId: pid(), language: getLocale(), edition: EDITION }),
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
import {
	createSlot,
	listSaves as listSoloSaves,
	loadSaveData,
	deleteSave as deleteSoloSave,
	exportSlot,
	importSave,
	packSaveFile,
} from './solo/saves';

export type { SaveMeta } from './solo/saves';
export { listSoloSaves, deleteSoloSave };

/** DEMO hard-stop cleanup: permanently delete the just-finished demo save so the
 *  player can't log back in and keep going. Handles either backend — the local
 *  slot (solo fallback) or the hosted Harper record (via the guarded, passcode-
 *  free DeleteDemoSave endpoint) — and clears the remembered "Continue" pointer.
 *  Best-effort: a failure here must never block returning to the title. */
export async function deleteDemoSave(): Promise<void> {
	try {
		if (transport === 'solo') {
			const slot = getSoloSlot();
			setSoloSlot(null); // stop the throttled autosave from resurrecting the slot
			endSolo();
			if (slot) await deleteSoloSave(slot.slotId);
		} else {
			const id = currentPlayerId;
			if (id) await request('/DeleteDemoSave/', { method: 'POST', body: JSON.stringify({ playerId: id }) });
		}
	} catch {
		/* best-effort — the popup still returns to the title */
	}
	forgetSave('solo');
}

/** Export the active solo save as a downloadable file. Flushes any pending
 *  autosave first so the backup captures the very latest state — the whole
 *  world, journal, progress, AND the caretaker's name + appearance. */
export async function exportActiveSolo(): Promise<{ filename: string; contents: string } | null> {
	await flushSoloSave();
	const slot = getSoloSlot();
	if (!slot) return null;
	const contents = await exportSlot(slot.slotId);
	if (!contents) return null;
	const safe =
		(slot.name || 'save')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'save';
	const stamp = new Date().toISOString().slice(0, 10);
	return { filename: `wild-willows-${safe}-${stamp}.json`, contents };
}

/** Import an exported save file as a new local slot; returns the new slot meta. */
export async function importSoloSave(contents: string): Promise<SaveMeta> {
	return importSave(contents);
}

/** Export the active DEMO save as an importable file, whichever backend it's on:
 *  the local solo slot (offline fallback), or the hosted Harper record (dumped by
 *  the guarded ExportDemoSave endpoint, then encrypted client-side into the same
 *  envelope). Lets a demo player carry their meadow into the full downloadable
 *  game via its Import Save. */
export async function exportDemoSave(): Promise<{ filename: string; contents: string } | null> {
	if (transport === 'solo') return exportActiveSolo();
	const id = currentPlayerId;
	if (!id) return null;
	const res: any = await request('/ExportDemoSave/', { method: 'POST', body: JSON.stringify({ playerId: id }) });
	if (!res?.meta || !res?.data) return null;
	const contents = packSaveFile(res.meta, res.data);
	const safe =
		String(res.meta.name || 'save')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'save';
	const stamp = new Date().toISOString().slice(0, 10);
	return { filename: `wild-willows-${safe}-${stamp}.json`, contents };
}

/** Start a fresh solo game (no passcode) and create its save slot. */
export async function startSoloGame(
	name: string,
	appearance: Appearance,
	creationMs = 0,
): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const created = await backendNew(name, appearance, creationMs);
	const slot = await createSlot({ playerId: created.playerId, name, appearance });
	setSoloSlot(slot);
	setPlayerId(created.playerId);
	return { playerId: created.playerId, state: created.state, slot };
}

/** Load a solo save slot back into play. */
export async function resumeSoloGame(slotId: string): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const file = await loadSaveData(slotId);
	if (!file) throw new Error(t('app.error.saveNotFound'));
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
	// Back to this build's title-screen backend: solo for desktop and for a demo
	// that fell back to offline; web (hosted Harper) otherwise.
	setTransport(isDesktop || demoBackend === 'solo' ? 'solo' : 'web');
}

/** True on the desktop (Electron) build. The web build always uses its origin. */
export const IS_DESKTOP = isDesktop;

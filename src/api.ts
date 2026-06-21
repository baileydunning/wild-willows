// Thin client for the Harper-backed game API. Every persisted action goes
// through these calls — the frontend never computes game state on its own.

import type { Appearance, GameData, GameState, WorldSummary, Peer, RosterEntry } from './types';

const STORAGE_KEY = 'wild-willows:last-save';

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
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
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>('/CreatePlayer/', { name, passcode, appearance }),
	login: (name: string, passcode: string) =>
		post<{ ok: boolean; playerId: string; worldId: string; worlds: WorldSummary[]; state: GameState }>('/LoginPlayer/', { name, passcode }),

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
};

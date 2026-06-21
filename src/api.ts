// Thin client for the Harper-backed game API. Every persisted action goes
// through these calls — the frontend never computes game state on its own.

import type { Appearance, GameData, GameState } from './types';

const STORAGE_KEY = 'wild-willows:last-save';

let currentPlayerId: string | null = null;

export function setPlayerId(id: string | null) {
	currentPlayerId = id;
}
export function getPlayerId(): string | null {
	return currentPlayerId;
}

export function rememberSave(playerId: string, name: string) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerId, name }));
	} catch { /* private mode etc. */ }
}
export function lastSave(): { playerId: string; name: string } | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
export function forgetSave() {
	try {
		localStorage.removeItem(STORAGE_KEY);
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
		post<{ ok: boolean; playerId: string; state: GameState }>('/CreatePlayer/', { name, passcode, appearance }),
	login: (name: string, passcode: string) =>
		post<{ ok: boolean; playerId: string; state: GameState }>('/LoginPlayer/', { name, passcode }),
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

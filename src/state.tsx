import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, forgetSave, lastSave, rememberSave, setPlayerId } from './api';
import { bridge } from './game/bridge';
import type { Appearance, GameData, GameState, PanelId } from './types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Toast {
	id: number;
	text: string;
	kind: 'info' | 'animal' | 'unlock' | 'error';
}

export interface LogEntry {
	id: number;
	icon: string;
	text: string;
	at: number;
}

interface Ctx {
	data: GameData | null;
	state: GameState | null;
	dataError: string | null;
	saveStatus: SaveStatus;
	panel: PanelId;
	setPanel: (p: PanelId) => void;
	helpOpen: boolean;
	setHelpOpen: (b: boolean) => void;
	activeChestId: string | null;
	openChest: (id: string) => void;
	animalCardId: string | null;
	setAnimalCardId: (id: string | null) => void;
	placementObjectId: string | null;
	startPlacement: (objectId: string) => void;
	cancelPlacement: () => void;
	toasts: Toast[];
	notify: (text: string, kind?: Toast['kind']) => void;
	log: LogEntry[];
	selectedTool: string;
	setSelectedTool: (toolId: string) => void;
	terraform: (area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') => Promise<void>;
	plant: (area: string, x: number, y: number, plantId: string) => Promise<void>;
	setTutorialStep: (step: number) => void;
	startNew: (name: string, passcode: string, appearance: Appearance) => Promise<void>;
	startLogin: (name: string, passcode: string) => Promise<void>;
	continueLast: () => Promise<void>;
	logout: () => void;
	refresh: () => Promise<void>;
	collect: (biomeId: string, nodeId: string, resourceId: string) => Promise<void>;
	transfer: (chestId: string, resourceId: string, qty: number, dir: 'deposit' | 'withdraw') => Promise<void>;
	craft: (recipeId: string) => Promise<void>;
	discard: (kind: 'material' | 'crafted', id: string, qty: number, name?: string) => Promise<void>;
	place: (objectId: string, area: string, x: number, y: number) => Promise<void>;
	removePlacement: (placementId: string) => Promise<void>;
	movePlacement: (placementId: string, x: number, y: number) => Promise<void>;
	upgradeTool: (toolId: string) => Promise<void>;
	observe: (animalId: string) => Promise<void>;
	changeArea: (area: string) => Promise<void>;
}

const GameCtx = createContext<Ctx>(null as any);
export const useGame = () => useContext(GameCtx);

let toastSeq = 1;

export function GameProvider({ children }: { children: React.ReactNode }) {
	const [data, setData] = useState<GameData | null>(null);
	const [state, setState] = useState<GameState | null>(null);
	const [dataError, setDataError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
	const [panel, setPanel] = useState<PanelId>(null);
	const [helpOpen, setHelpOpen] = useState(false);
	const [activeChestId, setActiveChestId] = useState<string | null>(null);
	const [animalCardId, setAnimalCardId] = useState<string | null>(null);
	const [placementObjectId, setPlacementObjectId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [log, setLog] = useState<LogEntry[]>([]);
	const [selectedTool, setSelectedToolState] = useState('basket');
	const saveTimer = useRef<number | null>(null);
	const logSeq = useRef(1);

	const pushLog = useCallback((icon: string, text: string) => {
		setLog((entries) => [...entries.slice(-40), { id: logSeq.current++, icon, text, at: Date.now() }]);
	}, []);

	// Definitions load once, before login (the character creator needs them).
	useEffect(() => {
		api.gameData()
			.then((d) => {
				setData(d);
				bridge.shared.data = d;
			})
			.catch(() => setDataError('Could not reach the Harper backend. Is it running? (see README)'));
	}, []);

	useEffect(() => {
		bridge.shared.state = state;
	}, [state]);

	const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
		const id = toastSeq++;
		setToasts((ts) => [...ts.slice(-3), { id, text, kind }]);
		window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), kind === 'error' ? 4000 : 6000);
	}, []);

	const markSaved = useCallback(() => {
		setSaveStatus('saved');
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => setSaveStatus('idle'), 1800);
	}, []);

	const adoptState = useCallback((s: GameState) => {
		setState(s);
		bridge.shared.state = s;
		bridge.emit('world-dirty');
	}, []);

	const refresh = useCallback(async () => {
		adoptState(await api.gameState());
	}, [adoptState]);

	// ---- session starters (welcome screens) ----
	const startNew = useCallback(async (name: string, passcode: string, appearance: Appearance) => {
		const r = await api.createPlayer(name, passcode, appearance);
		setPlayerId(r.playerId);
		rememberSave(r.playerId, r.state.player.name);
		adoptState(r.state);
	}, [adoptState]);

	const startLogin = useCallback(async (name: string, passcode: string) => {
		const r = await api.login(name, passcode);
		setPlayerId(r.playerId);
		rememberSave(r.playerId, r.state.player.name);
		adoptState(r.state);
	}, [adoptState]);

	const continueLast = useCallback(async () => {
		const last = lastSave();
		if (!last) throw new Error('No previous save on this device');
		setPlayerId(last.playerId);
		try {
			adoptState(await api.gameState());
		} catch (e) {
			setPlayerId(null);
			forgetSave();
			throw e;
		}
	}, [adoptState]);

	const logout = useCallback(() => {
		setPlayerId(null);
		setState(null);
		bridge.shared.state = null;
		setPanel(null);
		setPlacementObjectId(null);
	}, []);

	// Heartbeat: while a save is open, ping the server on a timer so it can
	// accrue play time and session counts. Best-effort and paused when the tab
	// is hidden, so backgrounded tabs never inflate the numbers.
	const sessionPlayerId = state?.player?.id ?? null;
	useEffect(() => {
		if (!sessionPlayerId) return;
		const beat = () => {
			if (document.visibilityState === 'hidden') return;
			api.heartbeat().catch(() => undefined);
		};
		beat(); // open the session right away
		const id = window.setInterval(beat, 30_000);
		const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [sessionPlayerId]);

	/** Run a persisted action against Harper, then re-sync state. */
	const act = useCallback(
		async (fn: () => Promise<any>, onResult?: (r: any) => void) => {
			setSaveStatus('saving');
			try {
				const result = await fn();
				if (result?.newAnimals?.length) {
					for (const na of result.newAnimals) {
						toast(`${na.animal?.name || 'An animal'} has returned to the preserve!`, 'animal');
						pushLog('paw', `${na.animal?.name || 'An animal'} felt safe enough to return!`);
					}
				}
				if (result?.unlockedBiomes?.length) {
					for (const b of result.unlockedBiomes) {
						toast(`New biome unlocked: ${b.name}!`, 'unlock');
						pushLog('sparkle', `New biome unlocked: ${b.name}!`);
					}
				}
				onResult?.(result);
				await refresh();
				markSaved();
			} catch (e: any) {
				setSaveStatus('error');
				toast(e.message || 'Something went wrong', 'error');
				window.setTimeout(() => setSaveStatus('idle'), 1500);
			}
		},
		[refresh, markSaved, toast]
	);

	const collect = useCallback(
		(biomeId: string, nodeId: string, resourceId: string) =>
			act(
				() => api.collect(biomeId, nodeId, resourceId),
				(r) => {
					const res = data?.resources.find((x) => x.id === resourceId);
					const qty = r?.gained?.[resourceId] || 1;
					pushLog('basket', `Gathered ${qty}× ${res?.name || resourceId} into your basket.`);
					// the basket is the gathering tool — other tools are for shaping the land
					bridge.emit('collected', { nodeId, resourceId, qty, tool: 'basket', color: res?.color });
				}
			),
		[act, data, pushLog]
	);

	const terraform = useCallback(
		(area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') =>
			act(
				() => api.terraform(area, x, y, action),
				(r) => {
					if (action === 'dig') pushLog('shovel', 'Prepared a soil bed with your shovel.');
					else if (action === 'water') {
						if (r?.tile?.type === 'water') {
							pushLog('drop', 'Flooded the bed into open water.');
						} else {
							pushLog('drop', 'Watered the soil — the ground here will recover (+1 biome health).');
							toast('Bed ready — walk up and press E (or tap it) to plant.');
						}
					} else pushLog('shovel', 'Cleared the soil bed.');
					bridge.emit('terraformed', { x, y, action });
				}
			),
		[act, pushLog, toast]
	);

	const plant = useCallback(
		(area: string, x: number, y: number, plantId: string) =>
			act(
				() => api.plant(area, x, y, plantId),
				() => {
					const name = data?.habitatObjects.find((o) => o.id === plantId)?.name || 'something';
					pushLog('leaf', `Planted ${name} in the watered bed — give it a little time to grow.`);
				}
			),
		[act, data, pushLog]
	);

	const setSelectedTool = useCallback((toolId: string) => {
		setSelectedToolState(toolId);
		bridge.emit('tool-selected', toolId);
	}, []);

	const setTutorialStep = useCallback(
		(step: number) => {
			setState((s) => (s ? { ...s, player: { ...s.player, tutorialStep: step } } : s));
			if (bridge.shared.state) bridge.shared.state.player.tutorialStep = step;
			const p = bridge.shared.state?.player;
			api.syncPlayer(p?.x ?? 0, p?.y ?? 0, undefined, step).catch(() => undefined);
		},
		[]
	);

	const transfer = useCallback(
		(chestId: string, resourceId: string, qty: number, dir: 'deposit' | 'withdraw') =>
			act(() => api.chestTransfer(chestId, resourceId, qty, dir)),
		[act]
	);

	const craft = useCallback(
		(recipeId: string) =>
			act(
				() => api.craft(recipeId),
				(r) => {
					const name = data?.habitatObjects.find((o) => o.id === r?.crafted?.itemId)?.name || 'Item';
					const fromChests = Object.keys(r?.usedFrom?.chests || {}).length > 0;
					toast(`Crafted ${name}${fromChests ? ' (used linked chest materials)' : ''}`);
					pushLog('hammer', `Crafted ${name}${fromChests ? ' using linked chest storage' : ''}.`);
				}
			),
		[act, data, toast]
	);

	const discard = useCallback(
		(kind: 'material' | 'crafted', id: string, qty: number, name?: string) =>
			act(
				() => api.discard(kind, id, qty),
				() => {
					const label = name
						|| (kind === 'crafted'
							? data?.habitatObjects.find((o) => o.id === id)?.name
							: data?.resources.find((r) => r.id === id)?.name)
						|| id;
					pushLog('basket', `Threw away ${qty}× ${label}.`);
				}
			),
		[act, data, pushLog]
	);

	const place = useCallback(
		(objectId: string, area: string, x: number, y: number) =>
			act(
				() => api.place(objectId, area, x, y),
				(r) => {
					const name = data?.habitatObjects.find((o) => o.id === objectId)?.name || objectId;
					const h = r?.biomeState?.health;
					pushLog('pin', `Placed ${name}${typeof h === 'number' ? ` — biome health now ${h}%` : ''}.`);
				}
			),
		[act, data, pushLog]
	);

	const removePlacement = useCallback(
		(placementId: string) =>
			act(
				() => api.remove(placementId),
				(r) => {
					if (r?.refunded) {
						const back = Object.entries(r.refunded)
							.map(([id, q]) => `${q}× ${data?.resources.find((x) => x.id === id)?.name || id}`)
							.join(', ');
						pushLog('spade', `Dug it up — got back ${back}.`);
					} else {
						pushLog('basket', 'Picked the item back up — it is in your crafted items again.');
					}
				}
			),
		[act, data, pushLog]
	);

	const movePlacement = useCallback(
		(placementId: string, x: number, y: number) =>
			act(
				() => api.move(placementId, x, y),
				() => pushLog('pin', 'Moved it to a new spot.')
			),
		[act, pushLog]
	);

	const upgradeTool = useCallback(
		(toolId: string) =>
			act(
				() => api.upgradeTool(toolId),
				(r) => toast(`Upgraded: ${r?.upgraded?.name || toolId}`)
			),
		[act, toast]
	);

	const observe = useCallback(
		async (animalId: string) => {
			setAnimalCardId(animalId);
			setPanel('animal');
			try {
				setSaveStatus('saving');
				await api.observe(animalId);
				await refresh();
				markSaved();
			} catch {
				setSaveStatus('idle');
			}
		},
		[refresh, markSaved]
	);

	const changeArea = useCallback(
		async (area: string) => {
			try {
				setSaveStatus('saving');
				const r = await api.syncPlayer(state?.player.x ?? 0, state?.player.y ?? 0, area);
				setState((s) => (s ? { ...s, player: r.player } : s));
				bridge.shared.state = bridge.shared.state ? { ...bridge.shared.state, player: r.player } : null;
				bridge.emit('area-changed', area);
				markSaved();
			} catch (e: any) {
				setSaveStatus('idle');
				toast(e.message || 'You cannot go there yet', 'error');
			}
		},
		[state, markSaved, toast]
	);

	const openChest = useCallback((id: string) => {
		setActiveChestId(id);
		setPanel('chest');
	}, []);

	const startPlacement = useCallback((objectId: string) => {
		setPanel(null);
		setPlacementObjectId(objectId);
		bridge.emit('enter-placement', { objectId });
	}, []);

	const cancelPlacement = useCallback(() => {
		setPlacementObjectId(null);
		bridge.emit('cancel-placement');
	}, []);

	const value = useMemo<Ctx>(
		() => ({
			data, state, dataError, saveStatus, panel, setPanel, helpOpen, setHelpOpen,
			activeChestId, openChest, animalCardId, setAnimalCardId,
			placementObjectId, startPlacement, cancelPlacement, toasts, notify: toast,
			log, selectedTool, setSelectedTool, terraform, plant, setTutorialStep,
			startNew, startLogin, continueLast, logout,
			refresh, collect, transfer, craft, discard, place, removePlacement, movePlacement,
			upgradeTool, observe, changeArea,
		}),
		[data, state, dataError, saveStatus, panel, helpOpen, activeChestId, animalCardId,
			placementObjectId, toasts, toast, log, selectedTool, setSelectedTool, terraform, plant,
			setTutorialStep, startNew, startLogin, continueLast, logout,
			refresh, collect, transfer, craft, discard, place, removePlacement, movePlacement, upgradeTool,
			observe, changeArea, openChest, startPlacement, cancelPlacement]
	);

	return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

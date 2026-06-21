import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, forgetSave, getPlayerId, lastSave, rememberSave, setPlayerId } from './api';
import { bridge } from './game/bridge';
import { unlockedRecipeIds } from './recipes';
import { narrativeBeats, nextFeedFact, healthMilestoneLine, HEALTH_THRESHOLDS } from './ui/narrative';
import type { Appearance, GameData, GameState, PanelId } from './types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Toast {
	id: number;
	text: string;
	kind: 'info' | 'animal' | 'unlock' | 'error' | 'achievement';
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
	dismissToast: (id: number) => void;
	log: LogEntry[];
	feedLog: LogEntry[];
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
	upgradeHome: (track: string) => Promise<void>;
	setHomeStyle: (style: string) => Promise<void>;
	rest: () => Promise<void>;
	paintColor: string;
	setPaintColor: (c: string) => void;
	paintHome: (part: 'floor' | 'wall' | 'rug', color: string) => Promise<void>;
	paintPlacement: (placementId: string, color: string) => Promise<void>;
	observe: (animalId: string) => Promise<void>;
	changeArea: (area: string) => Promise<void>;
	recalcArea: (area: string) => Promise<void>;
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
	// `log` = the live corner feed (everything, including mundane gathering/crafting).
	// `feedLog` = only the notable beats, for the Feed menu (F) and DB persistence.
	const [log, setLog] = useState<LogEntry[]>([]);
	const [feedLog, setFeedLog] = useState<LogEntry[]>([]);
	const [selectedTool, setSelectedToolState] = useState('basket');
	const [paintColor, setPaintColor] = useState('#c8a064');
	const saveTimer = useRef<number | null>(null);
	const logSeq = useRef(1);
	// Tracks which recipes were unlocked last time we looked, so we can announce
	// newly unlocked ones. null = not seeded yet (first load announces nothing).
	const prevUnlocked = useRef<Set<string> | null>(null);
	// Same idea for achievements: diff the snapshot to surface freshly earned ones.
	const prevAchievements = useRef<Set<string> | null>(null);
	// Returned-animal set last seen, for weaving narrative beats as combinations land.
	const prevDiscoveries = useRef<Set<string> | null>(null);
	// Educational biome facts already shown this session (so they don't repeat).
	const shownFacts = useRef<Set<string>>(new Set());
	// Last-seen biome health, to fire a progress beat when a threshold is crossed.
	const prevHealth = useRef<Map<string, number> | null>(null);
	// Last-seen home config signature, so upgrading/restyling while inside redraws the room.
	const prevHomeSig = useRef<string | null>(null);
	// Feed persistence: buffer new lines and flush them to Harper (capped per player),
	// and seed the in-memory log from the saved feed once per login.
	const feedBuffer = useRef<{ icon: string; text: string; at: number }[]>([]);
	const feedSeeded = useRef(false);

	const dismissToast = useCallback((id: number) => {
		setToasts((ts) => ts.filter((t) => t.id !== id));
	}, []);

	// Prominent, ephemeral notifications (top-right) — the same place errors appear.
	const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
		const id = toastSeq++;
		setToasts((ts) => [...ts.slice(-3), { id, text, kind }]);
		window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), kind === 'error' ? 4000 : 6000);
	}, []);

	// Every line shows in the live corner feed (`log`). "Notable" beats also go to
	// `feedLog` (the Feed menu) and persist to Harper. The narrative/fact/milestone
	// beats live in the feed only — the prominent toast area is reserved for the big
	// moments (animal returns, unlocks, achievements, errors), which fire their own toasts.
	const pushLog = useCallback((icon: string, text: string, notable = false) => {
		const at = Date.now();
		const entry = { id: logSeq.current++, icon, text, at };
		setLog((entries) => [...entries.slice(-79), entry]); // corner feed: everything
		if (notable) {
			setFeedLog((entries) => [...entries.slice(-99), entry]); // menu: notable only
			feedBuffer.current.push({ icon, text, at }); // persisted to Harper (pruned to 100)
		}
	}, []);

	// Push any buffered feed lines to Harper. Best-effort: on failure we just keep
	// them buffered for the next flush.
	const flushFeed = useCallback(() => {
		if (!getPlayerId() || feedBuffer.current.length === 0) return;
		const batch = feedBuffer.current.splice(0, feedBuffer.current.length);
		// best-effort: if it fails (e.g. offline, or the feed table isn't there yet),
		// just drop the batch rather than growing the buffer without bound
		api.appendFeed(batch).catch(() => undefined);
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

	// When the home config changes while you're inside it, restart the scene so the
	// room is redrawn at its new size, style, and trimmings.
	useEffect(() => {
		if (!state) return;
		const h = state.player.home;
		const sig = h ? `${h.style}:${h.space}:${h.comfort}:${h.decor}:${h.light}` : 'default';
		const prev = prevHomeSig.current;
		prevHomeSig.current = sig;
		if (prev !== null && sig !== prev) {
			if (state.player.area === 'home') bridge.emit('area-changed', 'home'); // redraw the room
			else bridge.emit('home-upgraded'); // play the build animation on the camp building
		}
	}, [state]);

	// Seed the in-memory log from the player's saved feed, once per login, so they
	// can scroll back through messages from previous sessions.
	useEffect(() => {
		if (!state || feedSeeded.current) return;
		feedSeeded.current = true;
		const seed = (state.feed || []).map((f) => ({ id: logSeq.current++, icon: f.icon, text: f.text, at: f.at }));
		if (seed.length) { setLog(seed); setFeedLog(seed); }
	}, [state]);

	// Announce newly unlocked recipes. When progress in a biome crosses a gate,
	// new recipes appear in the crafting menu — surface that clearly so players
	// know there's something new to make. The first computation after a load just
	// seeds the baseline silently (so we don't toast every starter recipe).
	useEffect(() => {
		if (!data || !state) return;
		const now = unlockedRecipeIds(data, state);
		const prev = prevUnlocked.current;
		prevUnlocked.current = now;
		if (!prev) return; // baseline seeded, nothing to announce yet
		const added = [...now].filter((id) => !prev.has(id));
		if (!added.length) return;
		const names = added
			.map((id) => data.recipes.find((r) => r.id === id)?.name)
			.filter(Boolean) as string[];
		// Recipes are tuned to unlock roughly one at a time; announce each by name.
		// (Cap the toasts if several ever land together so we don't flood the HUD.)
		names.slice(0, 3).forEach((name) => toast(`New Crafting Recipe Unlocked — ${name}`, 'unlock'));
		for (const name of names) pushLog('sparkle', `New Crafting Recipe Unlocked — ${name}.`, true);
	}, [data, state, toast, pushLog]);

	// Announce freshly earned achievements by diffing the snapshot (the server
	// awards them; we surface the gold toast + a feed line carrying the flavor).
	// The first load after login just seeds the baseline silently.
	useEffect(() => {
		if (!data || !state) return;
		const now = new Set(state.achievements || []);
		const prev = prevAchievements.current;
		prevAchievements.current = now;
		if (!prev) return; // baseline seeded
		const added = [...now].filter((id) => !prev.has(id));
		if (!added.length) return;
		const defs = added
			.map((id) => data.achievements.find((a) => a.id === id))
			.filter(Boolean) as typeof data.achievements;
		defs.slice(0, 3).forEach((a) => toast(`Achievement unlocked — ${a.name}`, 'achievement'));
		for (const a of defs) pushLog('star', `Achievement unlocked: ${a.name}. ${a.flavor}`, true);
	}, [data, state, toast, pushLog]);

	// Weave narrative beats into the feed as combinations of animals return — e.g.
	// "three kinds of insect are back…", or a predator + its prey both home. Each
	// beat fires once, the moment a return flips its condition true (diffed against
	// the previous returned set, so reloads don't replay history).
	useEffect(() => {
		if (!data || !state) return;
		const after = new Set(state.discoveries.map((d) => d.animalId));
		const before = prevDiscoveries.current;
		prevDiscoveries.current = after;
		if (!before) return; // seed baseline silently on first load
		let grew = false;
		for (const id of after) if (!before.has(id)) { grew = true; break; }
		if (!grew) return;
		for (const beat of narrativeBeats(before, after, data)) pushLog(beat.icon, beat.text, true);
	}, [data, state, pushLog]);

	// Progress beats: when a biome crosses a health threshold (25/50/80/100), weave
	// in a line about what that milestone means for the habitat.
	useEffect(() => {
		if (!data || !state) return;
		const cur = new Map(state.biomeStates.map((b) => [b.biomeId, b.health]));
		const prev = prevHealth.current;
		prevHealth.current = cur;
		if (!prev) return; // seed baseline silently
		for (const [biomeId, h] of cur) {
			const p = prev.get(biomeId);
			if (p === undefined) continue;
			const name = data.biomes.find((b) => b.id === biomeId)?.name || biomeId;
			for (const t of HEALTH_THRESHOLDS) {
				if (p < t && h >= t) {
					const line = healthMilestoneLine(t, name);
					if (line) pushLog('leaf', line, true);
				}
			}
		}
	}, [data, state, pushLog]);

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
		flushFeed(); // persist any unsaved feed lines before we drop the session
		setPlayerId(null);
		setState(null);
		bridge.shared.state = null;
		setPanel(null);
		setPlacementObjectId(null);
		setLog([]); // clear the on-screen feed; it re-seeds from Harper on next login
		setFeedLog([]);
		feedSeeded.current = false;
		feedBuffer.current = [];
		prevUnlocked.current = null; // re-seed the unlock baseline on next login
		prevAchievements.current = null; // and the achievement baseline
		prevDiscoveries.current = null; // and the narrative baseline
		prevHealth.current = null; // and the health-milestone baseline
		prevHomeSig.current = null;
		shownFacts.current = new Set(); // fresh fact pool next session
	}, [flushFeed]);

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

	// As the player keeps playing, gently weave educational biome facts and fun
	// nature facts into the feed — one every few minutes of active play, drawn
	// from the area they're currently in plus a general pool, never repeating.
	useEffect(() => {
		if (!sessionPlayerId) return;
		const tick = () => {
			if (document.visibilityState === 'hidden') return;
			const s = bridge.shared.state;
			const area = s?.player?.area;
			if (!area) return;
			// always biome-specific to where the player currently is, gated by that
			// biome's recovery and the animals back there
			const health = s?.biomeStates?.find((b: any) => b.biomeId === area)?.health || 0;
			const returnedIds = new Set<string>((s?.discoveries || []).map((d: any) => d.animalId));
			// crafting combinations: things crafted (ever) plus anything placed in this area
			const crafted = new Set<string>([
				...Object.keys(s?.player?.craftedEver || {}),
				...(s?.placements || []).filter((p: any) => p.area === area).map((p: any) => p.objectId),
			]);
			const pick = nextFeedFact({ area, health, returnedIds, crafted, shown: shownFacts.current });
			if (!pick) return;
			shownFacts.current.add(pick.key);
			pushLog(pick.icon, pick.text, true);
		};
		const id = window.setInterval(tick, 150_000); // ~2.5 min of active play
		return () => window.clearInterval(id);
	}, [sessionPlayerId, pushLog]);

	// Flush buffered feed lines to Harper on a timer (and when the tab is hidden or
	// closed), so the activity feed survives reloads. The server keeps the last 100.
	useEffect(() => {
		if (!sessionPlayerId) return;
		const id = window.setInterval(flushFeed, 6000);
		const onHide = () => { if (document.visibilityState === 'hidden') flushFeed(); };
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('beforeunload', flushFeed);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('beforeunload', flushFeed);
			flushFeed();
		};
	}, [sessionPlayerId, flushFeed]);

	/** Run a persisted action against Harper, then re-sync state. */
	const act = useCallback(
		async (fn: () => Promise<any>, onResult?: (r: any) => void) => {
			setSaveStatus('saving');
			try {
				const result = await fn();
				if (result?.newAnimals?.length) {
					for (const na of result.newAnimals) {
						const name = na.animal?.name || 'An animal';
						toast(`${name} has returned to the preserve!`, 'animal');
						pushLog('paw', `${name} felt safe enough to return!`, true);
						// coexistence beat: if it arrived after animals it depends on, say so
						const prereqs = (na.animal?.requirements?.animals || [])
							.map((id: string) => data?.animals.find((a) => a.id === id)?.name)
							.filter(Boolean);
						if (prereqs.length) {
							pushLog('leaf', `${name} came back now that the ${prereqs.join(' and ')} had returned — the food web is filling in.`, true);
						}
						// a fun fact about the animal that just arrived (shows in both feeds)
						if (na.animal?.fact) pushLog('paw', `${name}: ${na.animal.fact}`, true);
					}
				}
				if (result?.unlockedBiomes?.length) {
					for (const b of result.unlockedBiomes) {
						toast(`New biome unlocked: ${b.name}!`, 'unlock');
						pushLog('sparkle', `New biome unlocked: ${b.name}!`, true);
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
		[refresh, markSaved, toast, pushLog, data]
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
					if (action === 'dig') {
						if (r?.dug) {
							const name = data?.resources.find((x: any) => x.id === r.dug.resourceId)?.name || r.dug.resourceId;
							pushLog('shovel', `Dug a soil bed and turned up ${r.dug.amount}× ${name}.`);
							toast(`Dug up ${r.dug.amount}× ${name}!`, 'info');
						} else {
							pushLog('shovel', 'Prepared a soil bed with your shovel.');
						}
					} else if (action === 'water') {
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
		[act, pushLog, toast, data]
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

	const upgradeHome = useCallback(
		(track: string) => act(() => api.upgradeHome(track), (r) => toast(`Home upgraded: ${r?.upgraded?.name || 'your home'} ${r?.upgraded?.level || ''}`, 'unlock')),
		[act, toast]
	);
	const setHomeStyle = useCallback(
		(style: string) => act(() => api.setHomeStyle(style), (r) => toast(`You built your ${r?.built || 'home'}!`, 'unlock')),
		[act, toast]
	);
	const paintHome = useCallback((part: 'floor' | 'wall' | 'rug', color: string) => act(() => api.setHomeColors({ [part]: color })), [act]);
	const paintPlacement = useCallback((placementId: string, color: string) => act(() => api.setPlacementColor(placementId, color)), [act]);
	const rest = useCallback(
		() => act(() => api.rest(), () => {
			toast('You sleep soundly — every gathering spot has regrown.', 'unlock');
			pushLog('drop', 'You rested. The preserve’s gathering spots have all refreshed.', true);
		}),
		[act, toast, pushLog]
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
				await api.syncPlayer(state?.player.x ?? 0, state?.player.y ?? 0, area);
				// pull a fresh snapshot so any terrain seeded on first entry (e.g. the
				// wetland's starting water) is loaded before the scene redraws
				adoptState(await api.gameState());
				bridge.emit('area-changed', area);
				markSaved();
			} catch (e: any) {
				setSaveStatus('idle');
				toast(e.message || 'You cannot go there yet', 'error');
			}
		},
		[state, markSaved, toast, adoptState]
	);

	// Re-evaluate a biome's animals (e.g. after a planted habitat finishes growing
	// in) so anything now eligible returns without needing another manual action.
	const recalcArea = useCallback((area: string) => act(() => api.recalc(area)), [act]);

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
			placementObjectId, startPlacement, cancelPlacement, toasts, notify: toast, dismissToast,
			log, feedLog, selectedTool, setSelectedTool, terraform, plant, setTutorialStep,
			startNew, startLogin, continueLast, logout,
			refresh, collect, transfer, craft, discard, place, removePlacement, movePlacement,
			upgradeTool, upgradeHome, setHomeStyle, rest, paintColor, setPaintColor, paintHome, paintPlacement,
			observe, changeArea, recalcArea,
		}),
		[data, state, dataError, saveStatus, panel, helpOpen, activeChestId, animalCardId,
			placementObjectId, toasts, toast, dismissToast, log, feedLog, selectedTool, setSelectedTool, terraform, plant,
			setTutorialStep, startNew, startLogin, continueLast, logout,
			refresh, collect, transfer, craft, discard, place, removePlacement, movePlacement, upgradeTool,
			observe, changeArea, recalcArea, openChest, startPlacement, cancelPlacement, upgradeHome, setHomeStyle, rest,
			paintColor, setPaintColor, paintHome, paintPlacement]
	);

	return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
	api,
	forgetSave,
	isMissingSaveError,
	getPlayerId,
	lastSave,
	rememberSave,
	setDemoSaveHome,
	clearDemoSaveHome,
	setPlayerId,
	startSoloGame,
	resumeSoloGame,
	exitSolo,
	resolveDemoBackend,
	deleteDemoSave,
	exportDemoSave,
} from './api';
import { DEMO, DEMO_FOREST_BIOME, DEMO_FOREST_MS } from './demo';
import { flushFeedbackQueue } from './feedback';
import { t, content, onLocaleChange } from './i18n';
import { pokeMetricsUplink } from './solo/metricsUplink';
import { reportSaveIncident } from './solo/saveIncident';
import { reportCharacterCreated, reportDemoComplete } from './solo/appOpen';
import { bridge } from './game/bridge';
import { unlockedRecipeIds } from './recipes';
import { applyTerraformResult } from './terraformPatch';
import { narrativeBeats, nextFeedFact, healthMilestoneLine, HEALTH_THRESHOLDS } from './ui/narrative';
import { weatherForArea, weatherFeedLine, seasonFeedLine, liveCalendar } from './weather';
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
	// itch demo only: which backend the demo resolved to (drives the title-screen
	// flow), and whether the 5-animal hard-stop has been reached.
	demoBackend: 'pending' | 'harper' | 'solo';
	demoComplete: boolean;
	dismissDemo: () => void;
	/** Download the finished demo save for import into the full game; resolves to
	 *  the filename on success, null on failure. */
	exportDemo: () => Promise<string | null>;
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
	/** Append a line to the activity feed. `notable` also saves it to the Feed
	 *  menu (F) and persists it, so players can scroll back to it later. */
	pushLog: (icon: string, text: string, notable?: boolean) => void;
	selectedTool: string;
	setSelectedTool: (toolId: string) => void;
	terraform: (area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') => Promise<void>;
	plant: (area: string, x: number, y: number, plantId: string) => Promise<void>;
	setTutorialStep: (step: number) => void;
	startNew: (name: string, passcode: string, appearance: Appearance, creationMs?: number) => Promise<void>;
	startLogin: (name: string, passcode: string) => Promise<void>;
	continueLast: (mode?: 'solo' | 'coop') => Promise<void>;
	// Desktop solo: no passcode, local save slots.
	startNewSolo: (name: string, appearance: Appearance, creationMs?: number) => Promise<void>;
	loadSoloSlot: (slotId: string) => Promise<void>;
	logout: () => void;
	refresh: () => Promise<void>;
	collect: (biomeId: string, nodeId: string, resourceId: string) => Promise<void>;
	transfer: (chestId: string, resourceId: string, qty: number, dir: 'deposit' | 'withdraw') => Promise<void>;
	craft: (recipeId: string) => Promise<void>;
	discard: (kind: 'material' | 'crafted', id: string, qty: number, name?: string) => Promise<void>;
	place: (objectId: string, area: string, x: number, y: number, rotation?: number) => Promise<void>;
	removePlacement: (placementId: string) => Promise<void>;
	harvest: (placementId: string) => Promise<void>;
	movePlacement: (placementId: string, x: number, y: number, rotation?: number) => Promise<void>;
	rotatePlacement: (placementId: string) => Promise<void>;
	upgradeTool: (toolId: string) => Promise<void>;
	upgradeHome: (track: string) => Promise<void>;
	setHomeStyle: (style: string) => Promise<void>;
	rest: () => Promise<void>;
	paintColor: string;
	setPaintColor: (c: string) => void;
	paintHome: (part: 'floor' | 'wall' | 'rug', color: string) => Promise<void>;
	paintPlacement: (placementId: string, color: string) => Promise<void>;
	observe: (animalId: string) => Promise<void>;
	claimTask: (taskId: string) => Promise<void>;
	setGoals: (goals: any[]) => Promise<void>;
	addGoal: (goal: any) => Promise<void>;
	changeArea: (area: string) => Promise<void>;
	recalcArea: (area: string) => Promise<void>;
}

const GameCtx = createContext<Ctx>(null as any);
export const useGame = () => useContext(GameCtx);

let toastSeq = 1;

/** Quiet period after the last optimistic action before the trailing full sync. */
const RECONCILE_MS = 1500;

/**
 * How long without a click, keypress, touch or scroll before the heartbeat stops
 * crediting play time.
 *
 * Generous on purpose: this game is meant to be sat with, and reading a journal
 * entry or watching the meadow for a few minutes is playing it. What it catches
 * is the other thing — a window left open on screen for hours.
 */
const HEARTBEAT_IDLE_MS = 30 * 60 * 1000;
// The activity feed rides the heartbeat (see the flush effect below). This is a
// safety net for lines buffered between beats — not a second, faster cadence.
const FEED_FLUSH_MS = 30_000;

export function GameProvider({ children }: { children: React.ReactNode }) {
	const [data, setData] = useState<GameData | null>(null);
	const [state, setState] = useState<GameState | null>(null);
	const [dataError, setDataError] = useState<string | null>(null);
	// itch demo: resolved backend (Harper vs offline solo) + the 5-animal gate.
	const [demoBackend, setDemoBackend] = useState<'pending' | 'harper' | 'solo'>(DEMO ? 'pending' : 'harper');
	const [demoComplete, setDemoComplete] = useState(false);
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
	// Last-seen weather per biome (so feed beats fire only on real weather changes,
	// not when walking between biomes) and the last-seen season.
	const prevWeatherByArea = useRef<Record<string, string>>({});
	const prevSeason = useRef<string | null>(null);
	const prevTasksDone = useRef<Set<string> | null>(null);
	// Whether the three fixed starters were on the board last snapshot — so we can
	// announce (once) when the last of them clears and the player unlocks the builder.
	const prevStartersPresent = useRef<boolean | null>(null);
	// Last-seen home config signature, so upgrading/restyling while inside redraws the room.
	const prevHomeSig = useRef<string | null>(null);
	// Feed persistence: buffer new lines and flush them to Harper (capped per player),
	// and seed the in-memory log from the saved feed once per login.
	const feedBuffer = useRef<{ icon: string; text: string; at: number }[]>([]);
	const feedSeeded = useRef(false);
	// true while a local mutation is running, so the co-op poll won't refresh over it
	const actionInFlight = useRef(false);

	// The message currently on screen, so an identical one doesn't stack behind it.
	const lastToast = useRef<{ text: string; kind: Toast['kind']; id: number; timer: number } | null>(null);

	const dismissToast = useCallback((id: number) => {
		setToasts((ts) => ts.filter((t) => t.id !== id));
		// Dismissing by hand has to release the coalescing slot too, or the next
		// identical message would "extend" a card that is no longer on screen and
		// the player would see nothing at all.
		if (lastToast.current?.id === id) {
			window.clearTimeout(lastToast.current.timer);
			lastToast.current = null;
		}
	}, []);

	// Prominent, ephemeral notifications (top-right) — the same place errors appear.
	//
	// Repeats of the message already showing extend that one instead of stacking a
	// second copy. Losing the connection mid-session used to raise a fresh toast —
	// and a fresh sound — for EVERY action the player took, so a walk across the
	// preserve produced a hundred identical cards. One problem should say so once.
	const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
		const ttl = kind === 'error' ? 4000 : 6000;
		const expire = (id: number) => () => {
			setToasts((ts) => ts.filter((t) => t.id !== id));
			if (lastToast.current?.id === id) lastToast.current = null;
		};
		const showing = lastToast.current;
		if (showing && showing.text === text && showing.kind === kind) {
			window.clearTimeout(showing.timer);
			showing.timer = window.setTimeout(expire(showing.id), ttl);
			return;
		}
		const id = toastSeq++;
		setToasts((ts) => [...ts.slice(-3), { id, text, kind }]);
		bridge.emit('audio-toast', { kind });
		lastToast.current = { text, kind, id, timer: window.setTimeout(expire(id), ttl) };
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

	// Walking up to a locked gate posts what's still needed to the corner feed
	// (Phaser figures out the details; it only fires when the remaining list
	// changes, so it doesn't spam). Kept out of the persistent Feed menu.
	useEffect(
		() =>
			bridge.on('gate-info', (p: any) => {
				if (p?.text) pushLog('map', p.text, false);
			}),
		[pushLog],
	);

	// A solo save that would not write. api.ts can't raise a toast itself, so it
	// says so on the bridge. Coalescing above means a disk that stays full reports
	// once rather than on every autosave tick.
	useEffect(
		() =>
			bridge.on('save-error', (p: any) => {
				if (p?.message) toast(p.message, 'error');
			}),
		[toast],
	);

	// Push any buffered feed lines to Harper. Best-effort: on failure we just keep
	// them buffered for the next flush.
	const flushFeed = useCallback(() => {
		if (!getPlayerId() || feedBuffer.current.length === 0) return;
		const batch = feedBuffer.current.splice(0, feedBuffer.current.length);
		// best-effort: if it fails (e.g. offline, or the feed table isn't there yet),
		// just drop the batch rather than growing the buffer without bound
		api.appendFeed(batch).catch(() => undefined);
	}, []);

	// Definitions load once, before login (the character creator needs them). In
	// the itch demo we first probe the hosted Harper: on success we play against
	// it, otherwise we commit to the offline solo backend before the first call.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (DEMO) setDemoBackend(await resolveDemoBackend());
			try {
				const d = await api.gameData();
				if (cancelled) return;
				setData(d);
				bridge.shared.data = d;
			} catch {
				if (!cancelled) setDataError(t('app.error.backendUnreachable'));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Demo hard-stop: the caretaker restores the meadow to unlock the forest, then
	// gets up to DEMO_FOREST_MS of time exploring it before play freezes with the
	// thank-you popup. (No meadow cap — nothing ends the demo before they reach the
	// forest, which is the whole point of the taste.) The save is NOT wiped yet —
	// the popup offers a "download my save" export first, so deletion is deferred to
	// dismiss (see dismissDemo). We flush the feed so an export captures the latest.
	const finishDemo = useCallback(() => {
		setDemoComplete(true);
		reportDemoComplete(); // metrics: demo completion (device-scoped + sticky)
		flushFeed(); // persist buffered feed so an export captures it
	}, [flushFeed]);

	// Forest time cap — accumulate wall-clock only while the caretaker is actually
	// standing in the forest and the tab is visible, so it measures time spent
	// there rather than total play time. Ticks once a second; stops itself when it
	// trips the limit so it can't re-fire.
	const demoForestMsRef = useRef(0);
	useEffect(() => {
		if (!DEMO) return;
		let last = Date.now();
		const id = setInterval(() => {
			const now = Date.now();
			const dt = now - last;
			last = now;
			const inForest = bridge.shared.state?.player?.area === DEMO_FOREST_BIOME;
			const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
			if (!inForest || !visible) return;
			demoForestMsRef.current += dt;
			if (demoForestMsRef.current >= DEMO_FOREST_MS) {
				clearInterval(id);
				finishDemo();
			}
		}, 1000);
		return () => clearInterval(id);
	}, [finishDemo]);

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
			if (state.player.area === 'home')
				bridge.emit('area-changed', 'home'); // redraw the room
			else bridge.emit('home-upgraded'); // play the build animation on the camp building
		}
	}, [state]);

	// Seed the in-memory log from the player's saved feed, once per login, so they
	// can scroll back through messages from previous sessions.
	useEffect(() => {
		if (!state || feedSeeded.current) return;
		feedSeeded.current = true;
		const seed = (state.feed || []).map((f) => ({
			id: logSeq.current++,
			icon: f.icon,
			text: f.text,
			at: f.at,
		}));
		if (seed.length) {
			setLog(seed);
			setFeedLog(seed);
		}
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
		const defs = added.map((id) => data.recipes.find((r) => r.id === id)).filter(Boolean) as typeof data.recipes;
		// Recipes are tuned to unlock roughly one at a time; announce each by name.
		// (Cap the toasts if several ever land together so we don't flood the HUD.)
		defs.slice(0, 3).forEach((r) =>
			toast(
				t('app.toast.recipeUnlocked', {
					name: content('recipe', r.id, 'name', r.name),
				}),
				'unlock',
			),
		);
		for (const r of defs)
			pushLog(
				'sparkle',
				t('app.feed.recipeUnlocked', {
					name: content('recipe', r.id, 'name', r.name),
				}),
				true,
			);
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
		defs.slice(0, 3).forEach((a) =>
			toast(
				t('app.toast.achievementUnlocked', {
					name: content('achievement', a.id, 'name', a.name),
				}),
				'achievement',
			),
		);
		for (const a of defs)
			pushLog(
				'star',
				t('app.feed.achievementUnlocked', {
					name: content('achievement', a.id, 'name', a.name),
					flavor: content('achievement', a.id, 'flavor', a.flavor),
				}),
				true,
			);
		// The grand finale — every animal in every biome home — rains confetti.
		if (added.includes('caretaker-of-the-whole')) bridge.emit('confetti');
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
		for (const id of after)
			if (!before.has(id)) {
				grew = true;
				break;
			}
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
			const biomeDef = data.biomes.find((b) => b.id === biomeId);
			const name = biomeDef ? content('biome', biomeDef.id, 'name', biomeDef.name) : biomeId;
			for (const th of HEALTH_THRESHOLDS) {
				if (p < th && h >= th) {
					const line = healthMilestoneLine(th, name);
					if (line) pushLog('leaf', line, true);
				}
			}
		}
	}, [data, state, pushLog]);

	// Daily-task beats: the moment a task crosses its target, nudge the player to
	// claim the reward. Baseline seeds silently so reloads don't replay old wins.
	useEffect(() => {
		const tasks = state?.dailyTasks?.tasks;
		if (!tasks) return;
		const done = new Set(tasks.filter((task) => task.progress >= task.target).map((task) => task.id));
		const before = prevTasksDone.current;
		prevTasksDone.current = done;
		if (!before) return;
		for (const task of tasks) {
			if (done.has(task.id) && !before.has(task.id) && !task.claimed) {
				toast(t('app.toast.taskComplete'), 'unlock');
				pushLog('sparkle', t('app.feed.taskComplete', { text: task.text }), true);
			}
		}
	}, [state, toast, pushLog]);

	// Starters graduation: when the last of the three fixed starters clears off the
	// board, cheer the player on to design their own goals — once, as a toast and a
	// feed line. We only fire on the present→absent transition we actually witnessed
	// this session, so returning saves that finished long ago stay quiet.
	useEffect(() => {
		const tasks = state?.dailyTasks?.tasks;
		if (!tasks) return;
		const present = tasks.some((tk) => tk.id.startsWith('start-'));
		const before = prevStartersPresent.current;
		prevStartersPresent.current = present;
		if (before && !present) {
			toast(t('app.toast.startersDone'), 'unlock');
			pushLog('target', t('app.feed.startersDone'), true);
		}
	}, [state, toast, pushLog, t]);

	// Weather beats (retention): when the weather in the player's current biome
	// changes — or the season turns — weave a flavor line into the feed. Same
	// snapshot-diff pattern as the health milestones above. Baseline is seeded
	// silently on the first state so we never announce weather the moment you log
	// in (that's the welcome-back summary's job in a later phase).
	useEffect(() => {
		if (!state?.weather) return;
		const area = state.player.area;
		const nowWeather = weatherForArea(state, area);
		const nowSeason = state.weather.season;
		const ps = prevSeason.current;
		prevSeason.current = nowSeason;
		if (ps !== null && nowSeason !== ps) {
			const sl = seasonFeedLine(nowSeason);
			if (sl) pushLog(sl.icon, sl.text, true);
		}
		// Announce weather PER biome: only when a biome's weather actually changes
		// over time — never just because the player walked into a different biome
		// (which previously fired a line on every area change). The first time we
		// see a biome we silently seed its baseline.
		const seen = prevWeatherByArea.current;
		const had = Object.prototype.hasOwnProperty.call(seen, area);
		const prev = seen[area];
		seen[area] = nowWeather;
		if (had && nowWeather !== prev && area !== 'home') {
			const wl = weatherFeedLine(nowWeather, 'onArrive');
			if (wl) pushLog(wl.icon, wl.text, true);
		}
	}, [state, pushLog]);

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

	/**
	 * Trailing, coalesced full sync for actions that applied their result locally.
	 *
	 * An optimistic action paints immediately from the response it already has, so
	 * it skips the blocking `await refresh()`. A few things the server decides on
	 * its own — achievements, in particular — aren't in that response, so one sync
	 * still runs after the burst settles. Digging ten beds costs one refetch here
	 * instead of ten, and none of them are on the critical path to seeing the soil.
	 */
	const reconcileTimer = useRef<number | null>(null);
	const scheduleReconcile = useCallback(() => {
		if (reconcileTimer.current) window.clearTimeout(reconcileTimer.current);
		reconcileTimer.current = window.setTimeout(() => {
			reconcileTimer.current = null;
			// Don't race a request that's mid-flight; it will reschedule us on landing.
			if (actionInFlight.current) return scheduleReconcile();
			refresh().catch(() => undefined);
		}, RECONCILE_MS);
	}, [refresh]);
	useEffect(() => () => void (reconcileTimer.current && window.clearTimeout(reconcileTimer.current)), []);

	const startNew = useCallback(
		async (name: string, passcode: string, appearance: Appearance, creationMs = 0) => {
			const r = await api.createPlayer(name, passcode, appearance, creationMs);
			setPlayerId(r.playerId);
			rememberSave(r.playerId, r.state.player.name, 'solo');
			// This demo save lives on the hosted Harper. Remember that, so a later
			// session whose probe times out doesn't quietly show the (empty) offline
			// store instead and make the save look deleted.
			if (DEMO) setDemoSaveHome('harper');
			adoptState(r.state);
			reportCharacterCreated(creationMs); // acquisition funnel: opens → character created
		},
		[adoptState],
	);

	// Desktop solo: no passcode, no server. Start a fresh save in the in-app
	// backend (writes a local slot), or load an existing slot back into play.
	const startNewSolo = useCallback(
		async (name: string, appearance: Appearance, creationMs = 0) => {
			const { playerId, state } = await startSoloGame(name, appearance, creationMs);
			reportCharacterCreated(creationMs); // acquisition funnel: opens → character created
			feedSeeded.current = false;
			adoptState(state);
		},
		[adoptState],
	);

	const loadSoloSlot = useCallback(
		async (slotId: string) => {
			// Report a save that will not open BEFORE rethrowing. Desktop solo runs the
			// backend in-app, so this failure is otherwise invisible to us — the player
			// just sees an error and starts over, and we never learn it happened.
			let resumed: Awaited<ReturnType<typeof resumeSoloGame>>;
			try {
				resumed = await resumeSoloGame(slotId);
			} catch (e: any) {
				// A slot that simply is not on this device is not a corrupt save — pass
				// it through untouched rather than reporting it or alarming the player.
				if (e?.saveMissing) throw e;
				// The file is here and would not load. Report before rethrowing (desktop
				// solo is invisible to the server otherwise), and replace whatever the
				// storage layer threw with wording that tells the player it is the save,
				// not the app, and what to do next.
				reportSaveIncident(`solo:${slotId}`);
				console.error('solo save would not open —', e?.message || e);
				throw new Error(t('server.err.saveUnreadable'));
			}
			const { state } = resumed;
			feedSeeded.current = false;
			adoptState(state);
		},
		[adoptState],
	);

	const startLogin = useCallback(
		async (name: string, passcode: string) => {
			const r = await api.login(name, passcode);
			setPlayerId(r.playerId);
			rememberSave(r.playerId, r.state.player.name, 'solo');
			adoptState(r.state);
		},
		[adoptState],
	);

	const continueLast = useCallback(
		async (mode?: 'solo' | 'coop') => {
			const last = lastSave(mode);
			if (!last) throw new Error(t('app.error.noPreviousSave'));
			setPlayerId(last.playerId);
			try {
				adoptState(await api.gameState());
				rememberSave(last.playerId, last.name, 'solo');
			} catch (e) {
				setPlayerId(null);
				// Only drop the remembered save when the server actually said it's gone
				// (404). Anything else — offline, CORS, a 503 while Harper boots, or a
				// demo session that fell back to the offline backend and can't see a
				// Harper save — is temporary, and erasing the pointer on those turned a
				// one-off blip into a permanently lost save with no way back to it.
				if (isMissingSaveError(e)) {
					forgetSave(mode);
					// The save is confirmed gone, so drop the demo store pin with it.
					// Leaving it pinned to 'harper' would keep locking this device out
					// of offline play whenever the server is down, guarding a save that
					// no longer exists.
					if (DEMO) clearDemoSaveHome();
				}
				throw e;
			}
		},
		[adoptState],
	);

	const logout = useCallback(() => {
		flushFeed(); // persist any unsaved feed lines before we drop the session
		exitSolo(); // tear down any in-app solo world + reset transport (no-op on web)
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
		prevTasksDone.current = null; // and the daily-task baseline
		prevStartersPresent.current = null; // and the starters-graduation baseline
		shownFacts.current = new Set(); // fresh fact pool next session
	}, [flushFeed]);

	// Demo hard-stop: closing the thank-you popup wipes the save (so they can't log
	// back in and keep going) and returns to the title. Deletion happens HERE, not
	// at completion, so the "download my save" export still has something to read.
	// Only reachable in a real DEMO build (that's the only place the popup shows).
	const dismissDemo = useCallback(() => {
		setDemoComplete(false);
		void deleteDemoSave();
		logout();
	}, [logout]);

	// Export the finished demo save as a file the full downloadable game can
	// import (Import Save on its title screen). Returns the filename on success.
	const exportDemo = useCallback(async (): Promise<string | null> => {
		try {
			const out = await exportDemoSave();
			if (!out) return null;
			const blob = new Blob([out.contents], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = out.filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			return out.filename;
		} catch {
			return null;
		}
	}, []);

	// Heartbeat: while a save is open, ping the server on a timer so it can
	// accrue play time and session counts. Best-effort, and skipped in two cases
	// so the number means what it says: while the tab is hidden, and once nobody
	// has touched anything for HEARTBEAT_IDLE_MS.
	//
	// Hiding alone was not enough. A window left open ON SCREEN kept beating every
	// 30 seconds indefinitely, and one abandoned tab logged 798 minutes of "play"
	// against 152 actions — 17% of all the play time the dashboard had ever
	// recorded, from one person who wasn't there. Requiring recent input means
	// walking away stops the clock and coming back restarts it on the first touch.
	//
	// The window is deliberately long — 30 minutes, the same gap that ends a
	// session server-side. This gate is a backstop against a window left open for
	// hours, NOT the thing that decides whether a session was real: that judgement
	// is isIdleAnomaly() in server/resources.ts, which reads actions-per-minute and
	// works the same on rows recorded before this gate existed. A short window here
	// would quietly stop crediting genuine quiet play — reading a journal entry,
	// watching the meadow — and, because it only ever applies going forward, would
	// make new play time mean something different from old play time. Every beat
	// reports the window it was recorded under (see metricsRev on the metrics blob)
	// so the two are never averaged together by accident.
	const sessionPlayerId = state?.player?.id ?? null;
	const lastInputAt = useRef(Date.now());
	useEffect(() => {
		// Deliberately not pointermove: a cursor crossing the window on its way
		// somewhere else is not someone playing. These are the events the game runs
		// on anyway — clicks, keys (WASD repeats while held), touch, wheel.
		const seen = () => {
			lastInputAt.current = Date.now();
		};
		const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
		for (const e of events) window.addEventListener(e, seen, { passive: true });
		return () => {
			for (const e of events) window.removeEventListener(e, seen);
		};
	}, []);
	useEffect(() => {
		if (!sessionPlayerId) return;
		const beat = () => {
			if (document.visibilityState === 'hidden') return;
			if (Date.now() - lastInputAt.current > HEARTBEAT_IDLE_MS) return;
			// Send buffered feed lines on the same beat, so an active player costs
			// one feed write per heartbeat instead of one every six seconds.
			flushFeed();
			api
				.heartbeat(HEARTBEAT_IDLE_MS)
				.then((r: any) => {
					if (!r) return;
					// The preserve kept living while the game was closed: the heartbeat is
					// where "time passed" lands (matured plants, health gains, arrivals).
					const wb = r.welcomeBack;
					if (wb) {
						const bits: string[] = [];
						if (wb.matured) bits.push(t('app.welcomeBack.matured', { count: wb.matured }));
						if (wb.healthGain) bits.push(t('app.welcomeBack.healthGain', { count: wb.healthGain }));
						if (bits.length) {
							pushLog(
								'leaf',
								t('app.welcomeBack.summary', {
									bits: bits.join(t('app.list.and')),
								}),
								true,
							);
							toast(t('app.toast.preserveGrew'), 'unlock');
						}
					}
					if (r.newAnimals?.length) {
						for (const na of r.newAnimals) {
							const name = na.animal
								? content('animal', na.animal.id, 'name', na.animal.name || t('app.fallback.animal'))
								: t('app.fallback.animal');
							toast(t('app.toast.animalReturned', { name }), 'animal');
							pushLog(
								'paw',
								wb ? t('app.feed.animalReturnedWhileAway', { name }) : t('app.feed.animalReturned', { name }),
								true,
							);
							if (na.animal?.fact)
								pushLog(
									'paw',
									t('app.feed.animalFact', {
										name,
										fact: content('animal', na.animal.id, 'fact', na.animal.fact),
									}),
									true,
								);
						}
					}
					// pull the recalculated world (health, discoveries) into view
					if (r.newAnimals?.length || r.biomeStates?.length) refresh().catch(() => undefined);
				})
				.catch(() => undefined);
		};
		beat(); // open the session right away
		const id = window.setInterval(beat, 30_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') beat();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [sessionPlayerId, pushLog, toast, refresh]);

	// Day-rollover refresh: the in-game day (~24 real min) turns over on its own,
	// bringing new weather. Solo play has no world poll, so without this the
	// snapshot would sit stale while idle and only catch up (jumping the day +
	// weather) on your next action. Watch the live clock and pull a fresh snapshot
	// the moment the day index changes, so weather turns over smoothly on time.
	const lastDayIndex = useRef<number | null>(null);
	useEffect(() => {
		if (!sessionPlayerId) return;
		const check = () => {
			const snap = bridge.shared.state?.weather;
			if (!snap) return;
			const idx = liveCalendar(snap).dayIndex;
			if (lastDayIndex.current === null) {
				lastDayIndex.current = idx;
				return;
			}
			if (idx !== lastDayIndex.current) {
				lastDayIndex.current = idx;
				if (document.visibilityState !== 'hidden' && !actionInFlight.current) refresh().catch(() => undefined);
			}
		};
		const id = window.setInterval(check, 4000);
		return () => window.clearInterval(id);
	}, [sessionPlayerId, refresh]);

	// The daily-task board is server-derived text (tr('server.task.*')), so it's
	// rendered in whatever language was active when the state was built. The es
	// catalog loads asynchronously, so tasks can bake in English before it applies
	// — and switching language mid-game should re-localize them. Re-fetch the
	// state on every locale change so the board regenerates in the new language.
	useEffect(() => {
		return onLocaleChange(() => {
			if (getPlayerId()) refresh().catch(() => undefined);
		});
	}, [refresh]);

	// Feedback written while offline waits in a localStorage queue; retry it at
	// the start of every session. Items are deleted only once the server
	// confirms it stored them (see src/feedback.ts). Fire-and-forget. A solo
	// session also uplinks its metrics right away (then every few minutes via
	// the interval in metricsUplink.ts), so fresh saves appear on dashboards
	// without waiting for the first interval.
	useEffect(() => {
		if (!sessionPlayerId) return;
		void flushFeedbackQueue();
		pokeMetricsUplink();
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
			const pick = nextFeedFact({
				area,
				health,
				returnedIds,
				crafted,
				shown: shownFacts.current,
			});
			if (!pick) return;
			shownFacts.current.add(pick.key);
			pushLog(pick.icon, pick.text, true);
		};
		const id = window.setInterval(tick, 150_000); // ~2.5 min of active play
		return () => window.clearInterval(id);
	}, [sessionPlayerId, pushLog]);

	// Flush buffered feed lines to Harper (and when the tab is hidden or closed),
	// so the activity feed survives reloads. The server keeps the last 100.
	//
	// The cadence is the HEARTBEAT's, not a timer of its own. This used to flush
	// every 6 seconds, which meant ten writes a minute per player for a panel
	// nobody reads in real time — and Harper's free tier allows 1,000 writes a
	// minute across everyone, so that alone was capping simultaneous players.
	// Riding the 30s beat costs two. Nothing is lost by waiting: the buffer still
	// flushes on hide, on unload, and on unmount, so the only lines at risk are
	// ones from the last few seconds of a session that ended in a hard crash.
	useEffect(() => {
		if (!sessionPlayerId) return;
		const id = window.setInterval(flushFeed, FEED_FLUSH_MS);
		const onHide = () => {
			if (document.visibilityState === 'hidden') flushFeed();
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('beforeunload', flushFeed);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('beforeunload', flushFeed);
			flushFeed();
		};
	}, [sessionPlayerId, flushFeed]);

	/**
	 * Run a persisted action against Harper, then re-sync state.
	 *
	 * `opts.apply` lets an action fold its own response into the local snapshot
	 * instead of waiting on a second, full-state round trip. Return the next state
	 * to take that path, or null to fall back to the blocking refetch — so an
	 * action can opt out on the spot when the response says something happened that
	 * it can't reconstruct locally.
	 */
	const act = useCallback(
		async (
			fn: () => Promise<any>,
			onResult?: (r: any) => void,
			opts?: { apply?: (r: any, prev: GameState) => GameState | null },
		) => {
			setSaveStatus('saving');
			actionInFlight.current = true;
			try {
				const result = await fn();
				if (result?.newAnimals?.length) {
					for (const na of result.newAnimals) {
						const name = na.animal
							? content('animal', na.animal.id, 'name', na.animal.name || t('app.fallback.animal'))
							: t('app.fallback.animal');
						toast(t('app.toast.animalReturned', { name }), 'animal');
						pushLog('paw', t('app.feed.animalReturned', { name }), true);
						// coexistence beat: if it arrived after animals it depends on, say so
						const prereqs = (na.animal?.requirements?.animals || [])
							.map((id: string) => {
								const dep = data?.animals.find((a) => a.id === id);
								return dep ? content('animal', dep.id, 'name', dep.name) : undefined;
							})
							.filter(Boolean);
						if (prereqs.length) {
							pushLog(
								'leaf',
								t('app.feed.animalPrereqs', {
									name,
									others: prereqs.join(t('app.list.and')),
								}),
								true,
							);
						}
						// a fun fact about the animal that just arrived (shows in both feeds)
						if (na.animal?.fact)
							pushLog(
								'paw',
								t('app.feed.animalFact', {
									name,
									fact: content('animal', na.animal.id, 'fact', na.animal.fact),
								}),
								true,
							);
					}
				}
				if (result?.unlockedBiomes?.length) {
					for (const b of result.unlockedBiomes) {
						const bName = b?.id ? content('biome', b.id, 'name', b.name) : b.name;
						toast(t('app.toast.biomeUnlocked', { name: bName }), 'unlock');
						bridge.emit('audio-sfx', { id: 'areaUnlocked' });
						pushLog('sparkle', t('app.feed.biomeUnlocked', { name: bName }), true);
						// Reinforce the core loop each time a new area opens (playtest #12).
						pushLog('leaf', t('app.feed.loopReminder', { name: bName }), true);
					}
				}
				onResult?.(result);
				const prev = bridge.shared.state;
				const patched = opts?.apply && prev ? opts.apply(result, prev) : null;
				if (patched) {
					adoptState(patched);
					scheduleReconcile();
				} else {
					await refresh();
				}
				markSaved();
			} catch (e: any) {
				setSaveStatus('error');
				toast(e.message || t('app.error.generic'), 'error');
				window.setTimeout(() => setSaveStatus('idle'), 1500);
			} finally {
				actionInFlight.current = false;
			}
		},
		[refresh, adoptState, scheduleReconcile, markSaved, toast, pushLog, data],
	);

	const collect = useCallback(
		(biomeId: string, nodeId: string, resourceId: string) =>
			act(
				() => api.collect(biomeId, nodeId, resourceId),
				(r) => {
					const res = data?.resources.find((x) => x.id === resourceId);
					const qty = r?.gained?.[resourceId] || 1;
					const name = res ? content('resource', res.id, 'name', res.name) : resourceId;
					pushLog('basket', t('app.log.gathered', { qty, name }));
					if (qty > 0) {
						const pickupSfx = /water/i.test(resourceId) ? 'water' : 'pickup';
						bridge.emit('audio-sfx', { id: pickupSfx });
					}
					// house perk (Log Cabin): the forager's instinct found one extra
					if (r?.perkBonus) toast(t('app.toast.perkForage', { name }), 'unlock');
					// the basket is the gathering tool — other tools are for shaping the land
					bridge.emit('collected', {
						nodeId,
						resourceId,
						qty,
						tool: 'basket',
						color: res?.color,
					});
				},
			),
		[act, data, pushLog, toast],
	);

	const terraform = useCallback(
		(area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') =>
			act(
				() => api.terraform(area, x, y, action),
				(r) => {
					if (action === 'dig') {
						if (r?.dug) {
							const resDef = data?.resources.find((x: any) => x.id === r.dug.resourceId);
							const name = resDef ? content('resource', resDef.id, 'name', resDef.name) : r.dug.resourceId;
							pushLog('shovel', t('app.log.dugTurnedUp', { qty: r.dug.amount, name }));
							toast(t('app.toast.dugUp', { qty: r.dug.amount, name }), 'info');
						} else {
							pushLog('shovel', t('app.log.preparedBed'));
						}
						bridge.emit('audio-sfx', { id: 'dig' });
					} else if (action === 'water') {
						if (r?.tile?.type === 'water') {
							pushLog('drop', t('app.log.flooded'));
							bridge.emit('audio-sfx', { id: 'water' });
						} else {
							pushLog('drop', t('app.log.watered'));
							toast(t('app.toast.bedReady'));
							bridge.emit('audio-sfx', { id: 'waterground' });
						}
					} else pushLog('shovel', t('app.log.clearedBed'));
					bridge.emit('terraformed', { x, y, action });
				},
				{
					// Terraform already returns the finished tile, the new inventory and the
					// recalculated biome state, so the soil can appear on the first round trip
					// instead of the second. Skipping the refetch also stops re-downloading the
					// whole terrain array — which grows by a row on every dig — each time you
					// dig. The trailing reconcile picks up anything not in the response.
					apply: (r, prev) => applyTerraformResult(r, prev, area, x, y),
				},
			),
		[act, pushLog, toast, data],
	);

	const plant = useCallback(
		(area: string, x: number, y: number, plantId: string) =>
			act(
				() => api.plant(area, x, y, plantId),
				(r) => {
					const def = data?.habitatObjects.find((o) => o.id === plantId);
					const name = def ? content('habitatObject', def.id, 'name', def.name) : t('app.fallback.plant');
					// house perk (Meadow Cottage): green thumb — planted with a head start
					if (r?.perkGrowth)
						pushLog(
							'leaf',
							t('app.log.plantedHeadStart', {
								name,
								pct: Math.round(r.perkGrowth * 100),
							}),
						);
					else pushLog('leaf', t('app.log.planted', { name }));
					bridge.emit('audio-sfx', { id: 'plant' });
				},
			),
		[act, data, pushLog],
	);

	// Gather a mature plant's yield without uprooting it — it regrows for next time.
	const harvest = useCallback(
		(placementId: string) =>
			act(
				() => api.harvest(placementId),
				(r) => {
					const gained = Object.entries(r?.gained || {})
						.map(([id, q]) => {
							const def = data?.resources.find((x) => x.id === id);
							return t('app.format.qtyName', {
								qty: q as number,
								name: def ? content('resource', def.id, 'name', def.name) : id,
							});
						})
						.join(', ');
					if (gained) {
						toast(t('app.toast.harvested', { items: gained }), 'unlock');
						pushLog('leaf', t('app.feed.harvested', { items: gained }), true);
						bridge.emit('audio-sfx', { id: 'harvest' });
					}
				},
			),
		[act, data, toast, pushLog],
	);

	const setSelectedTool = useCallback((toolId: string) => {
		setSelectedToolState(toolId);
		bridge.emit('tool-selected', toolId);
	}, []);

	const setTutorialStep = useCallback((step: number) => {
		setState((s) => (s ? { ...s, player: { ...s.player, tutorialStep: step } } : s));
		if (bridge.shared.state) bridge.shared.state.player.tutorialStep = step;
		const p = bridge.shared.state?.player;
		api.syncPlayer(p?.x ?? 0, p?.y ?? 0, undefined, step).catch(() => undefined);
	}, []);

	const transfer = useCallback(
		(chestId: string, resourceId: string, qty: number, dir: 'deposit' | 'withdraw') =>
			act(() => api.chestTransfer(chestId, resourceId, qty, dir)),
		[act],
	);

	const craft = useCallback(
		(recipeId: string) =>
			act(
				() => api.craft(recipeId),
				(r) => {
					const def = data?.habitatObjects.find((o) => o.id === r?.crafted?.itemId);
					const name = def ? content('habitatObject', def.id, 'name', def.name) : t('app.fallback.item');
					const fromChests = Object.keys(r?.usedFrom?.chests || {}).length > 0;
					toast(t(fromChests ? 'app.toast.craftedFromChests' : 'app.toast.crafted', { name }));
					pushLog(
						'hammer',
						t(fromChests ? 'app.log.craftedFromChests' : 'app.log.crafted', {
							name,
						}),
					);
					// house perk (Stone Hearth): thrift returned part of the materials
					if (r?.refund && Object.keys(r.refund).length) {
						const items = Object.entries(r.refund as Record<string, number>)
							.map(([rid, q]) => {
								const rd = data?.resources.find((x) => x.id === rid);
								return `${q}× ${rd ? content('resource', rd.id, 'name', rd.name) : rid}`;
							})
							.join(', ');
						toast(t('app.toast.perkThrift', { items }), 'unlock');
					}
					bridge.emit('audio-sfx', { id: 'craft' });
				},
			),
		[act, data, toast],
	);

	const discard = useCallback(
		(kind: 'material' | 'crafted', id: string, qty: number, name?: string) =>
			act(
				() => api.discard(kind, id, qty),
				() => {
					const def =
						kind === 'crafted'
							? data?.habitatObjects.find((o) => o.id === id)
							: data?.resources.find((r) => r.id === id);
					const label =
						name || (def && content(kind === 'crafted' ? 'habitatObject' : 'resource', def.id, 'name', def.name)) || id;
					pushLog('basket', t('app.log.discarded', { qty, name: label }));
				},
			),
		[act, data, pushLog],
	);

	const place = useCallback(
		(objectId: string, area: string, x: number, y: number, rotation = 0) =>
			act(
				() => api.place(objectId, area, x, y, rotation),
				(r) => {
					const def = data?.habitatObjects.find((o) => o.id === objectId);
					const name = def ? content('habitatObject', def.id, 'name', def.name) : objectId;
					const h = r?.biomeState?.health;
					pushLog(
						'pin',
						typeof h === 'number' ? t('app.log.placedWithHealth', { name, health: h }) : t('app.log.placed', { name }),
					);
					bridge.emit('audio-sfx', { id: 'place' });
				},
			),
		[act, data, pushLog],
	);

	const removePlacement = useCallback(
		(placementId: string) =>
			act(
				() => api.remove(placementId),
				(r) => {
					if (r?.refunded) {
						const back = Object.entries(r.refunded)
							.map(([id, q]) => {
								const def = data?.resources.find((x) => x.id === id);
								return t('app.format.qtyName', {
									qty: q as number,
									name: def ? content('resource', def.id, 'name', def.name) : id,
								});
							})
							.join(', ');
						pushLog('spade', t('app.log.dugUpRefund', { items: back }));
					} else {
						pushLog('basket', t('app.log.pickedUp'));
					}
					bridge.emit('audio-sfx', { id: 'pickup' });
				},
			),
		[act, data, pushLog],
	);

	const movePlacement = useCallback(
		(placementId: string, x: number, y: number, rotation?: number) =>
			act(
				() => api.move(placementId, x, y, rotation),
				() => {
					pushLog('pin', t('app.log.moved'));
					bridge.emit('audio-sfx', { id: 'move' });
				},
			),
		[act, pushLog],
	);

	// Rotate a placed object a quarter-turn in place (Move popup button).
	const rotatePlacement = useCallback(
		(placementId: string) => {
			const p = bridge.shared.state?.placements.find((pl: any) => pl.id === placementId);
			if (!p) return Promise.resolve();
			return act(
				() => api.move(placementId, p.x, p.y, ((p.rotation || 0) + 90) % 360),
				() => {
					pushLog('pin', t('app.log.rotated'));
					bridge.emit('audio-sfx', { id: 'move' });
				},
			);
		},
		[act, pushLog],
	);

	const upgradeTool = useCallback(
		(toolId: string) =>
			act(
				() => api.upgradeTool(toolId),
				(r) => {
					toast(t('app.toast.toolUpgraded', { name: r?.upgraded?.name || toolId }));
					bridge.emit('audio-sfx', { id: 'upgrade' });
				},
			),
		[act, toast],
	);

	const upgradeHome = useCallback(
		(track: string) =>
			act(
				() => api.upgradeHome(track),
				(r) => {
					toast(
						t('app.toast.homeUpgraded', {
							name: r?.upgraded?.name || t('app.fallback.home'),
							level: r?.upgraded?.level || '',
						}),
						'unlock',
					);
					bridge.emit('audio-sfx', { id: 'upgrade' });
				},
			),
		[act, toast],
	);
	const setHomeStyle = useCallback(
		(style: string) =>
			act(
				() => api.setHomeStyle(style),
				(r) => {
					toast(
						t('app.toast.homeBuilt', {
							name: r?.built || t('app.fallback.homeBuilt'),
						}),
						'unlock',
					);
					bridge.emit('audio-sfx', { id: 'upgrade' });
				},
			),
		[act, toast],
	);
	const paintHome = useCallback(
		(part: 'floor' | 'wall' | 'rug', color: string) => act(() => api.setHomeColors({ [part]: color })),
		[act],
	);
	const paintPlacement = useCallback(
		(placementId: string, color: string) => act(() => api.setPlacementColor(placementId, color)),
		[act],
	);
	const rest = useCallback(
		() =>
			act(
				() => api.rest(),
				() => {
					toast(t('app.toast.rested'), 'unlock');
					pushLog('drop', t('app.log.rested'), true);
					bridge.emit('audio-sfx', { id: 'rest' });
				},
			),
		[act, toast, pushLog],
	);

	// Opening an animal's card IS the observation — reading about the animal in
	// the journal (or clicking it in the world, which opens the same card) is
	// what counts. Unreturned animals just open silently; nothing to record yet.
	const observe = useCallback(
		async (animalId: string) => {
			setAnimalCardId(animalId);
			setPanel('animal');
			const returned = bridge.shared.state?.discoveries?.some((d) => d.animalId === animalId);
			if (!returned) return;
			try {
				setSaveStatus('saving');
				await api.observe(animalId);
				await refresh();
				markSaved();
			} catch {
				setSaveStatus('idle');
			}
		},
		[refresh, markSaved],
	);

	const claimTask = useCallback(
		(taskId: string) =>
			act(
				() => api.claimTask(taskId),
				(r) => {
					// Announce the finished goal itself in BOTH feeds (corner log + Feed
					// menu, via notable=true), then the reward it granted.
					if (r?.text) {
						toast(t('app.toast.goalComplete', { goal: r.text }), 'achievement');
						pushLog('check', t('app.feed.goalComplete', { goal: r.text }), true);
					}
					const gainedTxt = Object.entries(r?.gained || {})
						.map(([id, q]) => {
							const def = data?.resources.find((x) => x.id === id);
							return t('app.format.qtyName', {
								qty: q as number,
								name: def ? content('resource', def.id, 'name', def.name) : id,
							});
						})
						.join(', ');
					if (gainedTxt) {
						toast(t('app.toast.taskReward', { items: gainedTxt }), 'unlock');
						pushLog('sparkle', t('app.feed.taskReward', { items: gainedTxt }), true);
					}
				},
			),
		[act, data, toast, pushLog],
	);

	// Save the player's custom goal list (add/remove/reorder are edits to it).
	const setGoals = useCallback((goals: any[]) => act(() => api.setGoals(goals)), [act]);

	// Whether the player already holds enough materials (basket + chests) to craft
	// `count` of an item right now — used to reject pointless "craft X" goals.
	const canAffordCraft = useCallback((itemId: string | undefined, count: number) => {
		const d = bridge.shared.data;
		const st = bridge.shared.state;
		if (!d || !st || !itemId) return false;
		const recipe = (d.recipes || []).find((r: any) => r.output?.itemId === itemId);
		if (!recipe) return false;
		const held = (id: string) =>
			(st.player.inventory?.[id] || 0) +
			(st.chests || []).reduce((s: number, c: any) => s + (c.contents?.[id] || 0), 0);
		return Object.entries(recipe.materials || {}).every(([mid, need]) => held(mid) >= (need as number) * count);
	}, []);

	// Add a single goal from a menu (journal / crafting / biomes), skipping exact
	// duplicates and respecting the list cap. Announces the add with a toast.
	const addGoal = useCallback(
		async (goal: any) => {
			const live = (bridge.shared.state as any) || state;
			const cur = live?.customGoals || [];
			const limit = live?.goalLimit ?? 3;
			// Gate custom goals behind the three fixed starters (same rule as the goals
			// builder) — the field-journal "attract" button reaches here too.
			const startersDone = !(live?.dailyTasks?.tasks || []).some(
				(tk: any) => typeof tk.id === 'string' && tk.id.startsWith('start-'),
			);
			if (!startersDone) {
				toast(t('app.toast.goalStartersFirst'), 'info');
				return;
			}
			const same = (g: any) =>
				g.kind === goal.kind &&
				g.itemId === goal.itemId &&
				g.resourceId === goal.resourceId &&
				g.animalId === goal.animalId &&
				g.track === goal.track &&
				g.biomeId === goal.biomeId;
			if (cur.some(same)) {
				toast(t('app.toast.goalAlready'), 'info');
				return;
			}
			if (cur.length >= limit) {
				toast(t('app.toast.goalLimit', { max: limit }), 'info');
				return;
			}
			// No busywork goals: if you already have the materials to make it right now,
			// there's nothing to work toward — just craft it.
			if ((goal.kind === 'craft' || goal.kind === 'build') && canAffordCraft(goal.itemId, goal.target || 1)) {
				toast(t('app.toast.goalAffordable'), 'info');
				return;
			}
			// Biome-unlock kits are already tracked by the pinned "unlock next biome" goal.
			if (
				(goal.kind === 'craft' || goal.kind === 'build') &&
				(bridge.shared.data?.biomes || []).some((b: any) => b.unlock?.requiresItem === goal.itemId)
			) {
				toast(t('app.toast.goalUnlockKit'), 'info');
				return;
			}
			await act(() => api.setGoals([...cur, goal]));
			toast(t('app.toast.goalAdded'), 'unlock');
		},
		[act, state, toast, canAffordCraft],
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
				toast(e.message || t('app.error.cannotGoThere'), 'error');
			}
		},
		[state, markSaved, toast, adoptState],
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
			data,
			state,
			dataError,
			demoBackend,
			demoComplete,
			dismissDemo,
			exportDemo,
			saveStatus,
			panel,
			setPanel,
			helpOpen,
			setHelpOpen,
			activeChestId,
			openChest,
			animalCardId,
			setAnimalCardId,
			placementObjectId,
			startPlacement,
			cancelPlacement,
			toasts,
			notify: toast,
			dismissToast,
			log,
			feedLog,
			pushLog,
			selectedTool,
			setSelectedTool,
			terraform,
			plant,
			setTutorialStep,
			startNew,
			startLogin,
			continueLast,
			startNewSolo,
			loadSoloSlot,
			logout,
			refresh,
			collect,
			transfer,
			craft,
			discard,
			place,
			removePlacement,
			harvest,
			movePlacement,
			rotatePlacement,
			upgradeTool,
			upgradeHome,
			setHomeStyle,
			rest,
			paintColor,
			setPaintColor,
			paintHome,
			paintPlacement,
			observe,
			claimTask,
			setGoals,
			addGoal,
			changeArea,
			recalcArea,
		}),
		[
			data,
			state,
			dataError,
			demoBackend,
			demoComplete,
			dismissDemo,
			exportDemo,
			saveStatus,
			panel,
			helpOpen,
			activeChestId,
			animalCardId,
			placementObjectId,
			toasts,
			toast,
			dismissToast,
			log,
			feedLog,
			pushLog,
			selectedTool,
			setSelectedTool,
			terraform,
			plant,
			setTutorialStep,
			startNew,
			startLogin,
			continueLast,
			startNewSolo,
			loadSoloSlot,
			logout,
			refresh,
			collect,
			transfer,
			craft,
			discard,
			place,
			removePlacement,
			harvest,
			movePlacement,
			rotatePlacement,
			upgradeTool,
			observe,
			claimTask,
			setGoals,
			addGoal,
			changeArea,
			recalcArea,
			openChest,
			startPlacement,
			cancelPlacement,
			upgradeHome,
			setHomeStyle,
			rest,
			paintColor,
			setPaintColor,
			paintHome,
			paintPlacement,
		],
	);

	return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

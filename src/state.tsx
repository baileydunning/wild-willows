import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
	api,
	forgetSave,
	getPlayerId,
	lastSave,
	rememberSave,
	setPlayerId,
	startSoloGame,
	resumeSoloGame,
	exitSolo,
	resolveDemoBackend,
	deleteDemoSave,
	exportDemoSave,
} from './api';
import { DEMO, DEMO_ANIMAL_GOAL, DEMO_BIOME } from './demo';
import { flushFeedbackQueue } from './feedback';
import { t, content, onLocaleChange } from './i18n';
import { pokeMetricsUplink } from './solo/metricsUplink';
import { reportCharacterCreated } from './solo/appOpen';
import { bridge } from './game/bridge';
import { unlockedRecipeIds } from './recipes';
import { narrativeBeats, nextFeedFact, healthMilestoneLine, HEALTH_THRESHOLDS } from './ui/narrative';
import { weatherForArea, weatherFeedLine, seasonFeedLine, liveCalendar } from './weather';
import type { Appearance, GameData, GameState, PanelId, WorldSummary, PendingRequest } from './types';

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
	// multiplayer: the world this save belongs to (solo, or one co-op world)
	worlds: WorldSummary[];
	activeWorldId: string | null;
	// New-game co-op: host a fresh shared world (get a code) or join one with a code.
	// Join carries the request token (sent at the code step) + the world it's for.
	startNewCoop: (
		name: string,
		passcode: string,
		appearance: Appearance,
		opts: {
			mode: 'host' | 'join';
			worldName?: string;
			code?: string;
			token?: string;
			joinWorldId?: string;
			hostName?: string;
			creationMs?: number;
		},
	) => Promise<void>;
	refreshWorlds: () => Promise<void>;
	// join waiting room (joiner side)
	pendingJoin: { worldId: string; worldName: string; hostName: string; code: string; token: string } | null;
	checkJoinApproval: () => Promise<'pending' | 'approved' | 'denied' | 'none'>;
	playSoloInstead: () => void;
	// host approval side
	pendingRequests: PendingRequest[];
	approveJoin: (token: string) => Promise<void>;
	denyJoin: (token: string) => Promise<void>;
}

const GameCtx = createContext<Ctx>(null as any);
export const useGame = () => useContext(GameCtx);

let toastSeq = 1;

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
	// multiplayer: the worlds this player belongs to, and which one is active
	const [worlds, setWorlds] = useState<WorldSummary[]>([]);
	const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
	// joiner is waiting for the host to approve their request
	const [pendingJoin, setPendingJoin] = useState<{
		worldId: string;
		worldName: string;
		hostName: string;
		code: string;
		token: string;
	} | null>(null);
	// host's inbox of people asking to join the active world
	const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
	const seenRequestTokens = useRef<Set<string>>(new Set());
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

	// Demo hard-stop: the moment the meadow has welcomed back DEMO_ANIMAL_GOAL
	// animals, freeze play with the thank-you popup. The save is NOT wiped yet —
	// the popup offers a "download my save" export first, so deletion is deferred
	// to dismiss (see dismissDemo). We do flush the feed now so an export captures
	// the latest activity.
	useEffect(() => {
		if (!DEMO || demoComplete || !state) return;
		const meadow = state.biomeStates.find((b) => b.biomeId === DEMO_BIOME);
		if ((meadow?.returnedCount || 0) >= DEMO_ANIMAL_GOAL) {
			setDemoComplete(true);
			flushFeed(); // persist buffered feed so an export captures it
		}
	}, [state, demoComplete, flushFeed]);

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
		const seed = (state.feed || []).map((f) => ({ id: logSeq.current++, icon: f.icon, text: f.text, at: f.at }));
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
		defs
			.slice(0, 3)
			.forEach((r) =>
				toast(t('app.toast.recipeUnlocked', { name: content('recipe', r.id, 'name', r.name) }), 'unlock'),
			);
		for (const r of defs)
			pushLog('sparkle', t('app.feed.recipeUnlocked', { name: content('recipe', r.id, 'name', r.name) }), true);
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
		defs
			.slice(0, 3)
			.forEach((a) =>
				toast(
					t('app.toast.achievementUnlocked', { name: content('achievement', a.id, 'name', a.name) }),
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

	const applyWorlds = useCallback((list: WorldSummary[], active: string | null) => {
		setWorlds(list || []);
		if (active) setActiveWorldId(active);
	}, []);

	// One-time welcome to the activity feed when you start (or join) a co-op preserve,
	// spelling out the join code and exactly how to invite friends.
	const coopWelcome = useCallback(
		(joinCode: string | null, hosting: boolean) => {
			if (hosting && joinCode) {
				// auto-copy the code so the host can paste it to friends right away
				try {
					navigator.clipboard?.writeText(joinCode).catch(() => undefined);
				} catch {
					/* clipboard unavailable */
				}
				pushLog('leaf', t('app.coop.hostWelcomeFeed', { code: joinCode }), true);
				toast(t('app.coop.hostWelcomeToast', { code: joinCode }), 'unlock');
			} else {
				pushLog('leaf', t('app.coop.joinWelcomeFeed'), true);
				toast(t('app.coop.joinWelcomeToast'), 'unlock');
			}
		},
		[pushLog, toast],
	);

	// ---- session starters (welcome screens) ----
	// Solo: your own private preserve.
	const startNew = useCallback(
		async (name: string, passcode: string, appearance: Appearance, creationMs = 0) => {
			const r = await api.createPlayer(name, passcode, appearance, creationMs);
			setPlayerId(r.playerId);
			rememberSave(r.playerId, r.state.player.name, 'solo');
			applyWorlds(r.worlds || [], r.worldId || r.playerId);
			adoptState(r.state);
			reportCharacterCreated(creationMs); // acquisition funnel: opens → character created
		},
		[adoptState, applyWorlds],
	);

	// Desktop solo: no passcode, no server. Start a fresh save in the in-app
	// backend (writes a local slot), or load an existing slot back into play.
	const startNewSolo = useCallback(
		async (name: string, appearance: Appearance, creationMs = 0) => {
			const { playerId, state } = await startSoloGame(name, appearance, creationMs);
			reportCharacterCreated(creationMs); // acquisition funnel: opens → character created
			try {
				const w = await api.myWorlds();
				applyWorlds(w.worlds || [], w.activeWorldId || playerId);
			} catch {
				applyWorlds([], playerId);
			}
			feedSeeded.current = false;
			adoptState(state);
		},
		[adoptState, applyWorlds],
	);

	const loadSoloSlot = useCallback(
		async (slotId: string) => {
			const { playerId, state } = await resumeSoloGame(slotId);
			try {
				const w = await api.myWorlds();
				applyWorlds(w.worlds || [], w.activeWorldId || playerId);
			} catch {
				applyWorlds([], playerId);
			}
			feedSeeded.current = false;
			adoptState(state);
		},
		[adoptState, applyWorlds],
	);

	// Co-op: a new game that lives in a shared world — either you HOST a fresh one
	// (and get a code to share) or JOIN a friend's with their code. A save belongs to
	// exactly one world, chosen here at New Game; there's no spinning up more later.
	const startNewCoop = useCallback(
		async (
			name: string,
			passcode: string,
			appearance: Appearance,
			opts: {
				mode: 'host' | 'join';
				worldName?: string;
				code?: string;
				token?: string;
				joinWorldId?: string;
				hostName?: string;
				creationMs?: number;
			},
		) => {
			const r = await api.createPlayer(name, passcode, appearance, opts.creationMs || 0);
			setPlayerId(r.playerId);
			rememberSave(r.playerId, r.state.player.name, 'coop');
			reportCharacterCreated(opts.creationMs || 0); // acquisition funnel: opens → character created
			if (opts.mode === 'join') {
				// The request was already sent at the code step. Try to enter now; if the
				// host hasn't approved yet, drop into the waiting room until they do.
				try {
					const j = await api.joinWorld((opts.code || '').trim(), opts.token);
					applyWorlds(j.worlds || [], j.worldId);
					feedSeeded.current = false;
					bridge.shared.presence = [];
					adoptState(j.state);
					coopWelcome(null, false);
				} catch (e: any) {
					if (e?.status === 403 && opts.joinWorldId && opts.token) {
						adoptState(r.state); // hold in the (solo) session behind the waiting room
						setPendingJoin({
							worldId: opts.joinWorldId,
							worldName: opts.worldName || t('app.coop.fallbackWorldName'),
							hostName: opts.hostName || t('app.coop.fallbackHostName'),
							code: (opts.code || '').trim(),
							token: opts.token,
						});
					} else {
						throw e;
					}
				}
			} else {
				const c = await api.createWorld(opts.worldName || t('app.coop.defaultWorldName', { name }));
				const s = await api.switchWorld(c.world.worldId);
				applyWorlds(s.worlds || [], s.worldId);
				feedSeeded.current = false;
				adoptState(s.state);
				coopWelcome(c.world.joinCode, true);
			}
		},
		[adoptState, applyWorlds, coopWelcome],
	);

	// Joiner waiting room: poll for approval; on approval, redeem and enter the world.
	const checkJoinApproval = useCallback(async (): Promise<'pending' | 'approved' | 'denied' | 'none'> => {
		if (!pendingJoin) return 'none';
		const s = await api.joinStatus(pendingJoin.worldId, pendingJoin.token);
		if (s.status === 'approved') {
			const j = await api.joinWorld(pendingJoin.code, pendingJoin.token);
			applyWorlds(j.worlds || [], j.worldId);
			feedSeeded.current = false;
			bridge.shared.presence = [];
			adoptState(j.state);
			coopWelcome(null, false);
			setPendingJoin(null);
			return 'approved';
		}
		return s.status;
	}, [pendingJoin, adoptState, applyWorlds, coopWelcome]);

	const playSoloInstead = useCallback(() => {
		setPendingJoin(null);
	}, []);

	// Host approval actions.
	const approveJoin = useCallback(
		async (token: string) => {
			if (!activeWorldId) return;
			await api.resolveJoin(activeWorldId, token, true);
			setPendingRequests((rs) => rs.filter((r) => r.token !== token));
		},
		[activeWorldId],
	);
	const denyJoin = useCallback(
		async (token: string) => {
			if (!activeWorldId) return;
			await api.resolveJoin(activeWorldId, token, false);
			setPendingRequests((rs) => rs.filter((r) => r.token !== token));
		},
		[activeWorldId],
	);

	const startLogin = useCallback(
		async (name: string, passcode: string) => {
			const r = await api.login(name, passcode);
			setPlayerId(r.playerId);
			const active = r.worldId || r.playerId;
			rememberSave(r.playerId, r.state.player.name, active === r.playerId ? 'solo' : 'coop');
			applyWorlds(r.worlds || [], active);
			adoptState(r.state);
		},
		[adoptState, applyWorlds],
	);

	const continueLast = useCallback(
		async (mode?: 'solo' | 'coop') => {
			const last = lastSave(mode);
			if (!last) throw new Error(t('app.error.noPreviousSave'));
			setPlayerId(last.playerId);
			try {
				adoptState(await api.gameState());
				// resume whichever world this save belongs to (solo or its co-op world)
				const w = await api.myWorlds();
				const active = w.activeWorldId || last.playerId;
				applyWorlds(w.worlds || [], active);
				rememberSave(last.playerId, last.name, active === last.playerId ? 'solo' : 'coop');
			} catch (e) {
				setPlayerId(null);
				forgetSave(mode);
				throw e;
			}
		},
		[adoptState, applyWorlds],
	);

	// ---- multiplayer helpers (read-only from the in-game People menu) ----
	const refreshWorlds = useCallback(async () => {
		const w = await api.myWorlds();
		applyWorlds(w.worlds || [], w.activeWorldId);
	}, [applyWorlds]);

	const logout = useCallback(() => {
		flushFeed(); // persist any unsaved feed lines before we drop the session
		exitSolo(); // tear down any in-app solo world + reset transport (no-op on web)
		setPlayerId(null);
		setState(null);
		bridge.shared.state = null;
		bridge.shared.presence = [];
		setWorlds([]);
		setActiveWorldId(null);
		setPendingJoin(null);
		setPendingRequests([]);
		seenRequestTokens.current = new Set();
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
	// accrue play time and session counts. Best-effort and paused when the tab
	// is hidden, so backgrounded tabs never inflate the numbers.
	const sessionPlayerId = state?.player?.id ?? null;
	useEffect(() => {
		if (!sessionPlayerId) return;
		const beat = () => {
			if (document.visibilityState === 'hidden') return;
			api
				.heartbeat()
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
							pushLog('leaf', t('app.welcomeBack.summary', { bits: bits.join(t('app.list.and')) }), true);
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
									t('app.feed.animalFact', { name, fact: content('animal', na.animal.id, 'fact', na.animal.fact) }),
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

	// Co-op presence. We publish our exact position ~12×/sec; each publish returns
	// the world's current positions map, which we apply straight to the avatars
	// (Phaser interpolates between them for smooth movement). This uses only short,
	// quickly-closed reads — deliberately NOT a long-lived WebSocket subscription,
	// which Harper holds a read transaction open for and force-closes after a few
	// minutes. A separate slower poll pulls DB-backed world changes + join requests.
	const inCoop = !!sessionPlayerId && !!activeWorldId && activeWorldId !== sessionPlayerId;
	useEffect(() => {
		if (!inCoop) {
			bridge.shared.presence = [];
			bridge.emit('presence-updated');
			return;
		}
		const myId = sessionPlayerId!;

		const applyPeers = (peers: any[]) => {
			const now = Date.now();
			bridge.shared.presence = (peers || [])
				.filter((p: any) => p && p.playerId !== myId && (!p.t || now - p.t < 8000))
				.map((p: any) => ({
					playerId: p.playerId,
					name: p.name,
					appearance: p.appearance,
					area: p.area,
					x: p.x,
					y: p.y,
				}));
			bridge.emit('presence-updated');
		};

		// publish my position fast, chained so requests never overlap/pile up. On
		// errors (server down / restarting) back off hard so we never flood the log.
		let stopped = false;
		let pubTimer: number | undefined;
		let failStreak = 0;
		const publish = async () => {
			if (stopped) return;
			let delay = 80; // ~12×/sec when healthy
			if (document.visibilityState !== 'hidden') {
				const self = bridge.shared.self || {
					x: bridge.shared.state?.player?.x ?? 0,
					y: bridge.shared.state?.player?.y ?? 0,
					area: bridge.shared.state?.player?.area || 'meadow',
				};
				try {
					const r = await api.presence(self.x, self.y, self.area);
					applyPeers(r.peers || []);
					failStreak = 0;
				} catch {
					failStreak = Math.min(failStreak + 1, 6);
					delay = Math.min(500 * 2 ** failStreak, 10000); // 1s → 10s backoff
				}
			}
			if (!stopped) pubTimer = window.setTimeout(publish, delay);
		};
		publish();

		// DB-backed world changes (placements, terraform, animals, collecting),
		// plus the host's inbox of pending join requests.
		const stateId = window.setInterval(async () => {
			if (document.visibilityState === 'hidden') return;
			if (!actionInFlight.current) {
				try {
					adoptState(await api.gameState());
				} catch {
					/* ignore */
				}
			}
			try {
				const pr = await api.pendingRequests();
				const reqs = pr.requests || [];
				setPendingRequests(reqs);
				for (const rq of reqs) {
					if (!seenRequestTokens.current.has(rq.token)) {
						seenRequestTokens.current.add(rq.token);
						toast(t('app.toast.joinRequest', { name: rq.name }), 'unlock');
					}
				}
			} catch {
				/* not a host, or offline */
			}
		}, 1500);

		return () => {
			stopped = true;
			if (pubTimer) window.clearTimeout(pubTimer);
			window.clearInterval(stateId);
			bridge.shared.presence = [];
			bridge.emit('presence-updated');
			setPendingRequests([]);
		};
	}, [inCoop, adoptState, sessionPlayerId, activeWorldId, toast]);

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

	/** Run a persisted action against Harper, then re-sync state. */
	const act = useCallback(
		async (fn: () => Promise<any>, onResult?: (r: any) => void) => {
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
							pushLog('leaf', t('app.feed.animalPrereqs', { name, others: prereqs.join(t('app.list.and')) }), true);
						}
						// a fun fact about the animal that just arrived (shows in both feeds)
						if (na.animal?.fact)
							pushLog(
								'paw',
								t('app.feed.animalFact', { name, fact: content('animal', na.animal.id, 'fact', na.animal.fact) }),
								true,
							);
					}
				}
				if (result?.unlockedBiomes?.length) {
					for (const b of result.unlockedBiomes) {
						const bName = b?.id ? content('biome', b.id, 'name', b.name) : b.name;
						toast(t('app.toast.biomeUnlocked', { name: bName }), 'unlock');
						pushLog('sparkle', t('app.feed.biomeUnlocked', { name: bName }), true);
						// Reinforce the core loop each time a new area opens (playtest #12).
						pushLog('leaf', t('app.feed.loopReminder', { name: bName }), true);
					}
				}
				onResult?.(result);
				await refresh();
				markSaved();
			} catch (e: any) {
				setSaveStatus('error');
				toast(e.message || t('app.error.generic'), 'error');
				window.setTimeout(() => setSaveStatus('idle'), 1500);
			} finally {
				actionInFlight.current = false;
			}
		},
		[refresh, markSaved, toast, pushLog, data],
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
					// house perk (Log Cabin): the forager's instinct found one extra
					if (r?.perkBonus) toast(t('app.toast.perkForage', { name }), 'unlock');
					// the basket is the gathering tool — other tools are for shaping the land
					bridge.emit('collected', { nodeId, resourceId, qty, tool: 'basket', color: res?.color });
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
					} else if (action === 'water') {
						if (r?.tile?.type === 'water') {
							pushLog('drop', t('app.log.flooded'));
						} else {
							pushLog('drop', t('app.log.watered'));
							toast(t('app.toast.bedReady'));
						}
					} else pushLog('shovel', t('app.log.clearedBed'));
					bridge.emit('terraformed', { x, y, action });
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
						pushLog('leaf', t('app.log.plantedHeadStart', { name, pct: Math.round(r.perkGrowth * 100) }));
					else pushLog('leaf', t('app.log.planted', { name }));
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
					pushLog('hammer', t(fromChests ? 'app.log.craftedFromChests' : 'app.log.crafted', { name }));
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
				},
			),
		[act, data, pushLog],
	);

	const movePlacement = useCallback(
		(placementId: string, x: number, y: number, rotation?: number) =>
			act(
				() => api.move(placementId, x, y, rotation),
				() => pushLog('pin', t('app.log.moved')),
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
				() => pushLog('pin', t('app.log.rotated')),
			);
		},
		[act, pushLog],
	);

	const upgradeTool = useCallback(
		(toolId: string) =>
			act(
				() => api.upgradeTool(toolId),
				(r) => toast(t('app.toast.toolUpgraded', { name: r?.upgraded?.name || toolId })),
			),
		[act, toast],
	);

	const upgradeHome = useCallback(
		(track: string) =>
			act(
				() => api.upgradeHome(track),
				(r) =>
					toast(
						t('app.toast.homeUpgraded', {
							name: r?.upgraded?.name || t('app.fallback.home'),
							level: r?.upgraded?.level || '',
						}),
						'unlock',
					),
			),
		[act, toast],
	);
	const setHomeStyle = useCallback(
		(style: string) =>
			act(
				() => api.setHomeStyle(style),
				(r) => toast(t('app.toast.homeBuilt', { name: r?.built || t('app.fallback.homeBuilt') }), 'unlock'),
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
			worlds,
			activeWorldId,
			startNewCoop,
			refreshWorlds,
			pendingJoin,
			checkJoinApproval,
			playSoloInstead,
			pendingRequests,
			approveJoin,
			denyJoin,
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
			worlds,
			activeWorldId,
			startNewCoop,
			refreshWorlds,
			pendingJoin,
			checkJoinApproval,
			playSoloInstead,
			pendingRequests,
			approveJoin,
			denyJoin,
		],
	);

	return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

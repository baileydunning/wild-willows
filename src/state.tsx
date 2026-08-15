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
import { watchDemoNudge } from './demoNudge';
import { flushFeedbackQueue } from './feedback';
import { serialRun } from './serialRun';
import { t, content, onLocaleChange } from './i18n';
import { pokeMetricsUplink } from './solo/metricsUplink';
import { reportSaveIncident } from './solo/saveIncident';
import { reportCharacterCreated, reportDemoComplete, reportDemoNudge, reportSaveResumed } from './solo/appOpen';
import { bridge } from './game/bridge';
import { unlockedRecipeIds } from './recipes';
import { applyTerraformResult } from './terraformPatch';
import {
	applyCollectResult,
	applyCraftResult,
	applyHarvestResult,
	applyMoveResult,
	applyPlaceResult,
	applyPlantResult,
	withHeldTaskProgress,
} from './actionPatch';
import { coalesceAfter, cancelCoalesced } from './perf';
import { narrativeBeats, nextFeedFact, healthMilestoneLine, HEALTH_THRESHOLDS } from './ui/narrative';
import { weatherForArea, weatherFeedLine, seasonFeedLine, liveCalendar } from './weather';
import type { Appearance, GameData, GameState, PanelId } from './types';
import { notePanelOpen, resetPanelOpens, settlePanelOpens, snapshotPanelOpens } from './menuMetrics';

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
	/** itch demo only: the soft "are you done playing?" prompt is up — raised on
	 *  idleness or on coming back from being away, dismissible, and nothing to do
	 *  with the hard-stop above. */
	demoNudge: boolean;
	dismissDemoNudge: () => void;
	/** The one-time "now the goals are yours" hand-off, raised when the last
	 *  starter goal is claimed. */
	goalsUnlocked: boolean;
	dismissGoalsUnlocked: () => void;
	/** Download the demo save for import into the full game; resolves to the
	 *  filename on success, null on failure. */
	exportDemo: () => Promise<string | null>;
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
	notify: (text: string, kind?: Toast['kind']) => void;
	/** Append a line to the activity feed. `notable` also saves it to the Feed
	 *  menu (F) and persists it, so players can scroll back to it later. */
	pushLog: (icon: string, text: string, notable?: boolean) => void;
	selectedTool: string;
	setSelectedTool: (toolId: string) => void;
	terraform: (
		area: string,
		x: number,
		y: number,
		action: 'dig' | 'water' | 'clear',
		/** the tile type this command was decided against — see api.terraform */
		expect?: string | null,
	) => Promise<void>;
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
	// Fire-and-forget, NOT a promise: the recalc is coalesced (see recalcArea), so
	// the call returns as soon as the request is queued and there is nothing
	// meaningful to await — the refreshed state arrives via adoptState.
	recalcArea: (area: string) => void;
}

const GameCtx = createContext<Ctx>(null as any);
export const useGame = () => useContext(GameCtx);

/**
 * The high-churn half of the store, deliberately kept OUT of Ctx.
 *
 * Ctx is one memoised object, so ANY field in it changing hands every consumer a
 * brand-new value. These five change far more often than the rest of the app:
 * a single gather writes saveStatus twice ('saving' then 'saved', plus an 'idle'
 * 1.8s later), pushes a log line, and can raise a toast — six new context values
 * for one action, each re-rendering the entire overlay layer, none of which had
 * anything to do with the HUD or the toolbelt.
 *
 * Split out, a log line re-renders the feed and nothing else.
 */
export interface FeedCtx {
	toasts: Toast[];
	dismissToast: (id: number) => void;
	log: LogEntry[];
	feedLog: LogEntry[];
	saveStatus: SaveStatus;
}

const GameFeedCtx = createContext<FeedCtx>(null as any);
export const useGameFeed = () => useContext(GameFeedCtx);

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
// How long a burst of biome recalcs is collected before one is sent. Long enough
// to swallow a field of plants finishing together, short enough that an animal
// arriving still feels like it followed what you planted.
const RECALC_COALESCE_MS = 1200;
// The activity feed rides the heartbeat (see the flush effect below). This is a
// safety net for lines buffered between beats — not a second, faster cadence.
const FEED_FLUSH_MS = 30_000;

/**
 * Remember, per save, that the "now the goals are yours" hand-off has been seen,
 * and report whether this is the first time. Storage is best-effort: if it's
 * unavailable (private mode), we show the modal — a player who has finished ten
 * starter goals and is never told the board is theirs is the worse failure.
 */
const GOALS_UNLOCKED_KEY = 'wild-willows:goals-unlocked-seen';

function markGoalsUnlockedSeen(playerId: string | undefined): boolean {
	if (!playerId) return false;
	try {
		const raw = localStorage.getItem(GOALS_UNLOCKED_KEY);
		const seen: string[] = raw ? JSON.parse(raw) : [];
		if (Array.isArray(seen) && seen.includes(playerId)) return false;
		const next = [...(Array.isArray(seen) ? seen : []), playerId].slice(-20);
		localStorage.setItem(GOALS_UNLOCKED_KEY, JSON.stringify(next));
		return true;
	} catch {
		return true;
	}
}

export function GameProvider({ children }: { children: React.ReactNode }) {
	const [data, setData] = useState<GameData | null>(null);
	const [state, setState] = useState<GameState | null>(null);
	const [dataError, setDataError] = useState<string | null>(null);
	// itch demo: resolved backend (Harper vs offline solo) + the 5-animal gate.
	const [demoBackend, setDemoBackend] = useState<'pending' | 'harper' | 'solo'>(DEMO ? 'pending' : 'harper');
	const [demoComplete, setDemoComplete] = useState(false);
	const [demoNudge, setDemoNudge] = useState(false);
	const [goalsUnlocked, setGoalsUnlocked] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
	const [panel, setPanelState] = useState<PanelId>(null);
	// Which menu is open, readable from the heartbeat without making the beat
	// re-arm every time a panel changes (a dependency on `panel` would restart the
	// interval on every open, and a player flicking between menus would then never
	// complete one). Written on every set so the beat always reads the live value.
	const panelRef = useRef<PanelId>(null);
	panelRef.current = panel;
	// Count the transition INTO a menu, not every set: closing a panel, or code
	// re-asserting the one already open, is not someone opening a menu.
	//
	// Counted here rather than inside the state updater on purpose. A setState
	// updater has to be pure — React is free to call it more than once for a
	// single update (it does exactly that under StrictMode) — and a counter
	// incremented in there would report two opens for every one. The ref is
	// written eagerly as well as on render, so two setPanel calls in the same
	// tick still count one open.
	const setPanel = useCallback((p: PanelId) => {
		if (p && p !== panelRef.current) notePanelOpen(p);
		panelRef.current = p;
		setPanelState(p);
	}, []);
	// The help overlay isn't a PanelId, but to a player it is a menu like any
	// other, so it reports its own dwell and opens under the id 'help'.
	const [helpOpen, setHelpOpenState] = useState(false);
	const helpOpenRef = useRef(false);
	helpOpenRef.current = helpOpen;
	const setHelpOpen = useCallback((b: boolean) => {
		if (b && !helpOpenRef.current) notePanelOpen('help');
		helpOpenRef.current = b;
		setHelpOpenState(b);
	}, []);
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

	/**
	 * Push any buffered feed lines to Harper.
	 *
	 * RETURNS A PROMISE, and any caller about to read the feed back has to await
	 * it. Exporting a save is the one that matters: the exporter reads `FeedEntry`
	 * rows straight out of the database, so a fire-and-forget flush raced its own
	 * export — and when the export won, the save the player carried into the full
	 * game was missing exactly the lines the flush existed to keep.
	 *
	 * SERIALIZED (see serialRun), which is what makes awaiting it mean anything.
	 * Emptying the buffer and then awaiting the write reads as awaitable and is
	 * not: a second caller arriving mid-write finds an empty buffer and returns
	 * straight away, while the first request is still on the wire. That is not
	 * hypothetical here — the heartbeat flushes without awaiting, and the demo's
	 * hard-stop fires one at the exact moment the export button appears. Chaining
	 * makes `await flushFeed()` mean "every line queued before or during this call
	 * has landed", rather than "the array is empty right now".
	 *
	 * Best-effort on failure: the batch is spliced out and DROPPED rather than put
	 * back, so an offline stretch cannot grow the buffer without bound. A lost
	 * feed line is one missing sentence of scrollback; a buffer that grows forever
	 * is a leak in a game people leave open for hours.
	 */
	const flushFeed = useMemo(
		() =>
			serialRun(async () => {
				if (!getPlayerId() || feedBuffer.current.length === 0) return;
				const batch = feedBuffer.current.splice(0, feedBuffer.current.length);
				await api.appendFeed(batch).catch(() => undefined);
			}),
		[],
	);

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
		setDemoNudge(false); // the hard-stop supersedes the soft prompt; never stack them
		reportDemoComplete(); // metrics: demo completion (device-scoped + sticky)
		// Kicked off here so the lines are on their way before the popup's export
		// button can be pressed. Not awaited, and it does not need to be: flushes are
		// serialized, so the export's own `await flushFeed()` waits for THIS one to
		// land before it reads the feed back.
		void flushFeed();
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

	// Demo re-engagement prompt: raised once, when a player stops playing without
	// finishing (window untouched for five minutes, or back after a spell away).
	// See src/demoNudge.ts for the two signals and why they're the ones worth
	// watching; the prompt itself is src/ui/DemoNudge.tsx.
	//
	// `demoNudgeShown` makes it once-per-page-load rather than once-per-watcher:
	// the effect re-attaches whenever the demo save changes hands (new game after a
	// logout, say), and a second prompt in one sitting reads as nagging even when
	// the first one was answered ten minutes earlier.
	//
	// The dependency is the player ID, NOT `state`. `state` is a fresh object after
	// every action and every background refresh, so depending on it would tear the
	// watcher down and rebuild it — resetting the idle clock — several times a
	// minute, and the five-minute mark would never arrive.
	const demoNudgeShown = useRef(false);
	const demoSavePlayerId = state?.player?.id ?? null;
	useEffect(() => {
		if (!DEMO || !demoSavePlayerId || demoComplete || demoNudgeShown.current) return;
		return watchDemoNudge((reason) => {
			demoNudgeShown.current = true;
			setDemoNudge(true);
			reportDemoNudge('shown'); // metrics: the prompt's funnel starts here
			pushLog('target', t(reason === 'idle' ? 'app.feed.demoNudgeIdle' : 'app.feed.demoNudgeReturned'));
		});
	}, [demoSavePlayerId, demoComplete]);

	const dismissDemoNudge = useCallback(() => setDemoNudge(false), []);
	const dismissGoalsUnlocked = useCallback(() => setGoalsUnlocked(false), []);

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

	// Starters graduation: when the last of the ten starter goals clears off the
	// board, hand the board over — a toast, a feed line, and the one-time modal
	// that actually explains what just became possible (src/ui/GoalsUnlocked.tsx).
	// We only fire on the present→absent transition we actually witnessed this
	// session, so returning saves that finished long ago stay quiet.
	//
	// The modal is additionally pinned to the save in localStorage. The transition
	// alone is nearly enough — it happens once per save — but "nearly" is doing
	// real work there: a co-op member watching someone else claim the last one, or
	// any future path that briefly empties the board, would re-open a modal the
	// player has already read and dismissed. Once means once.
	useEffect(() => {
		const tasks = state?.dailyTasks?.tasks;
		if (!tasks) return;
		const present = tasks.some((tk) => tk.id.startsWith('start-'));
		const before = prevStartersPresent.current;
		prevStartersPresent.current = present;
		if (before && !present) {
			toast(t('app.toast.startersDone'), 'unlock');
			pushLog('target', t('app.feed.startersDone'), true);
			if (markGoalsUnlockedSeen(state?.player?.id)) setGoalsUnlocked(true);
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

	// One funnel for every state the app adopts — server snapshots and optimistic
	// patches alike. The held-materials pass runs here rather than inside each
	// patcher so a goal like "gather 10 seeds" tracks the basket no matter which
	// action moved it (gathering, harvesting, a chest transfer, spending on a
	// craft). On a server snapshot it's a no-op: the numbers already agree.
	const adoptState = useCallback((s: GameState) => {
		const next = withHeldTaskProgress(s);
		setState(next);
		bridge.shared.state = next;
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
			reportSaveResumed(); // funnel: a returning player is not a bounce
		},
		[adoptState],
	);

	const startLogin = useCallback(
		async (name: string, passcode: string) => {
			const r = await api.login(name, passcode);
			setPlayerId(r.playerId);
			rememberSave(r.playerId, r.state.player.name, 'solo');
			adoptState(r.state);
			reportSaveResumed(); // funnel: a returning player is not a bounce
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
				reportSaveResumed(); // funnel: a returning player is not a bounce
			} catch (e) {
				// Drop BOTH halves of the session, not just one.
				//
				// A session lives in two places: `currentPlayerId` inside api.ts, and
				// the React state that `sessionPlayerId` is derived from. This used to
				// clear only the first. If anything threw AFTER adoptState() had already
				// set the second — adoptState ends with a synchronous bridge.emit(), so
				// any subscriber that throws lands here — React went on believing a save
				// was open while the API layer knew there wasn't one.
				//
				// The next render then armed the heartbeat effect (it keys off
				// sessionPlayerId) and called beat() straight away, which asked for a
				// player id that no longer existed. That is the "Not logged in" crash:
				// not a login failure, a login that half-succeeded and left the two
				// halves disagreeing.
				setPlayerId(null);
				setState(null);
				bridge.shared.state = null;
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
		void flushFeed(); // persist any unsaved feed lines before we drop the session
		exitSolo(); // tear down any in-app solo world + reset transport (no-op on web)
		setPlayerId(null);
		setState(null);
		bridge.shared.state = null;
		setPanel(null);
		setPlacementObjectId(null);
		resetPanelOpens(); // unsent menu opens belong to the save that made them
		setDemoNudge(false); // a soft prompt belongs to the save it was raised over
		setGoalsUnlocked(false);
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

	// Export the demo save as a file the full downloadable game can import (Import
	// Save on its title screen). Returns the filename on success.
	//
	// Flushes the buffered feed first. The hard-stop path already did that when it
	// finished the demo, but the soft prompt (src/ui/DemoNudge.tsx) can export at
	// any moment mid-play, and a feed line still sitting in the buffer would be
	// missing from the copy they carry across.
	const exportDemo = useCallback(async (): Promise<string | null> => {
		// AWAITED, not fired and forgotten: the exporter reads the feed rows out of
		// the database, so letting the append race the export is how the carried
		// save loses its most recent lines.
		await flushFeed();
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
	}, [flushFeed]);

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
			void flushFeed();
			// Menu dwell + opens ride the beat (see src/menuMetrics.ts). The opens
			// are only cleared once the beat lands, so a dropped request re-sends
			// them rather than losing them.
			const opens = snapshotPanelOpens();
			// A panel wins over the help overlay when somehow both are up: the panel
			// is the thing in front, and one beat can only be credited once.
			const openMenu = panelRef.current || (helpOpenRef.current ? 'help' : null);
			api
				.heartbeat(HEARTBEAT_IDLE_MS, openMenu, opens)
				.then((r: any) => {
					if (!r) return;
					settlePanelOpens(opens);
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
		// Ambient flushes: nothing reads the feed back straight afterwards, so these
		// stay fire-and-forget. `onUnload` deliberately ignores the promise — a page
		// being torn down will not wait for one.
		const onUnload = () => void flushFeed();
		const id = window.setInterval(onUnload, FEED_FLUSH_MS);
		const onHide = () => {
			if (document.visibilityState === 'hidden') void flushFeed();
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('beforeunload', onUnload);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('beforeunload', onUnload);
			void flushFeed();
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
				{ apply: (r, prev) => applyCollectResult(r, prev, biomeId) },
			),
		[act, data, pushLog, toast],
	);

	const terraform = useCallback(
		(area: string, x: number, y: number, action: 'dig' | 'water' | 'clear', expect?: string | null) =>
			act(
				() => api.terraform(area, x, y, action, expect),
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
				{ apply: applyPlantResult },
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
				{ apply: applyHarvestResult },
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
				{ apply: applyCraftResult },
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
				{ apply: applyPlaceResult },
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
				{ apply: applyMoveResult },
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
				{ apply: applyMoveResult },
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
				{
					// The response already carries the board as it stands AFTER the claim —
					// finished goal gone, next one in its place — so paint it now instead
					// of waiting out a full GameState round trip. Claiming and then
					// watching nothing happen for a beat reads as the game not having
					// registered the click. The trailing reconcile still runs for
					// everything else the claim touched (achievements, unlocks).
					apply: (r, prev) =>
						r?.dailyTasks && r?.inventory
							? { ...prev, dailyTasks: r.dailyTasks, player: { ...prev.player, inventory: r.inventory } }
							: null,
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

	// The area change in flight, if any. Stepping through a door is a round trip
	// (sync the position, refetch the snapshot, then rebuild the scene), and every
	// door is a thing you can click twice — or click and then press the interact
	// key on — before the first trip lands. Each extra request re-ran the whole
	// transition, and the duplicate that arrived AFTER the scene had already moved
	// asked it to travel from the meadow to the meadow, which the spawn rules read
	// as "arrived from a neighbouring biome" and answered with the trail gate. So
	// the caretaker stepped out of their house and was yanked across the meadow.
	//
	// One transition at a time, and none at all to where we already are.
	const areaChanging = useRef<string | null>(null);
	const changeArea = useCallback(
		async (area: string) => {
			if (areaChanging.current || (bridge.shared.state?.player.area ?? state?.player.area) === area) return;
			areaChanging.current = area;
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
			} finally {
				areaChanging.current = null;
			}
		},
		[state, markSaved, toast, adoptState],
	);

	// Re-evaluate a biome's animals (e.g. after a planted habitat finishes growing
	// in) so anything now eligible returns without needing another manual action.
	//
	// COALESCED, because this is the expensive end of a maturation. Each call is a
	// RecalcBiome POST followed (inside act) by a full GameState refetch, and a row
	// of plants sown in one sitting finishes within seconds of itself — so the
	// unthrottled version fired a burst of concurrent round trips, each landing as
	// its own adoptState and its own world rebuild. Animals noticing new habitat is
	// ambient, not a response to a click, so spending a second to collect the burst
	// costs the player nothing they can perceive. Keyed by area: two biomes
	// maturing at once still get their own recalc.
	const recalcKeys = useRef<Set<string>>(new Set());
	const recalcArea = useCallback(
		(area: string) => {
			const key = `recalc:${area}`;
			recalcKeys.current.add(key);
			coalesceAfter(key, RECALC_COALESCE_MS, () => void act(() => api.recalc(area)));
		},
		[act],
	);
	// A queued recalc outliving the provider would fire against a torn-down tree.
	useEffect(() => {
		const keys = recalcKeys.current;
		return () => {
			for (const key of keys) cancelCoalesced(key);
		};
	}, []);

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
			demoNudge,
			dismissDemoNudge,
			goalsUnlocked,
			dismissGoalsUnlocked,
			exportDemo,
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
			notify: toast,
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
			demoNudge,
			dismissDemoNudge,
			goalsUnlocked,
			dismissGoalsUnlocked,
			exportDemo,
			panel,
			helpOpen,
			activeChestId,
			animalCardId,
			placementObjectId,
			toast,
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

	// Separate memo, separate provider: the feed half re-renders on its own churn
	// without dragging the rest of the tree along.
	const feedValue = useMemo<FeedCtx>(
		() => ({ toasts, dismissToast, log, feedLog, saveStatus }),
		[toasts, dismissToast, log, feedLog, saveStatus],
	);

	return (
		<GameCtx.Provider value={value}>
			<GameFeedCtx.Provider value={feedValue}>{children}</GameFeedCtx.Provider>
		</GameCtx.Provider>
	);
}

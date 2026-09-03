import { useEffect, useRef, useState, type ComponentType } from 'react';
import { api } from './api';
import { applyAudioPrefs, bindGameAudio, primeAudio, setAmbienceActive, setMusicActive } from './audio';
import { bridge } from './game/bridge';
import { STORE_ITCH_URL, STORE_MAS_URL } from './demo';
import { PhaserGame } from './game/PhaserGame';
import { reportDemoEnd } from './solo/appOpen';
import { usePrefs } from './prefs';
import { actionForToken, BIND_ACTIONS, tokenFromEvent } from './keybindings';
import { GameProvider, useGame, useGameFeed } from './state';
import { useI18n } from './i18n/react';
import { liveDayPhase, liveWeatherType } from './weather';
import { harvestReadyAt, harvestWeatherOk } from './types';
import { isTypingTarget } from './typing';
import { HelpModal } from './ui/Help';
import { ColorblindFilters } from './ui/ColorblindFilters';
import { HUD, Toasts } from './ui/HUD';
import { Confetti } from './ui/Confetti';
import { MobileControls } from './ui/MobileControls';
import { SettingsPanel } from './ui/Settings';
import { ActivityLog, FeedPanel, Toolbelt } from './ui/Toolbelt';
import { Tutorial } from './ui/Tutorial';
import { CoachTips, dismissCoachTip } from './ui/CoachTips';

/* ---------------------------------------------------------------- lazy panels
 *
 * Every panel below is mounted only while it is open (`{panel === 'x' && …}`),
 * but it was IMPORTED unconditionally — so all ~4,200 lines of panel UI were
 * downloaded and parsed before the title screen could paint, including for a
 * player who bounces off the character creator without ever opening one.
 *
 * Split by module, not by component: Rollup gives one chunk per dynamic import
 * specifier, so the eight `./ui/Panels` entries below collapse into a single
 * chunk fetched once, and the rest resolve from the module cache after that.
 *
 * Only modules NOTHING eager imports are listed here, because a lazy wrapper
 * around a module something else already pulls in creates a chunk without
 * removing a byte. That is why `./ui/Settings` is still a static import above:
 * Welcome.tsx — the title screen, and the first thing rendered — uses its
 * appearance and accessibility controls in the character creator, so the module
 * ships eagerly no matter how SettingsPanel is imported. Splitting the shared
 * controls out into their own module would fix that, but it moves ~350 of its
 * 1,015 lines for a real refactor's worth of risk; left alone deliberately.
 *
 * Panels that render UNCONDITIONALLY and manage their own open state internally
 * (HelpModal, GoalsUnlocked, DemoNudge) are also left eager on purpose — their
 * chunk would be fetched at boot anyway, gaining only an extra request. */

/**
 * A code-split panel that renders SYNCHRONOUSLY once its chunk is in memory.
 *
 * This is React.lazy's job, and React.lazy cannot do it. `lazy()` does not call
 * its loader until the component is first RENDERED — so even with the module
 * already fetched and sitting in the module cache, the first render still
 * suspends: React throws the thenable, commits the Suspense fallback, and swaps
 * the real panel in on the following tick. With `fallback={null}` that is one
 * frame of nothing. Opening a panel over the world hides it, which is why it
 * looked fine at first; going from one panel STRAIGHT to another does not,
 * because the panel being read blanks out before its replacement appears.
 *
 * This was measured, not reasoned about: rendering a fully warmed `lazy()`
 * component yields an empty first frame, and the component below yields the
 * panel. Pre-fetching the module does not help, because the suspend happens
 * regardless of whether the promise is already resolved.
 *
 * So keep the dynamic import — the chunk still leaves the entry bundle — and
 * hold the resolved component in a module-level slot. `useState`'s initializer
 * reads that slot during the first render, so a warmed panel is on screen in the
 * very commit that opened it: no boundary, no fallback, nothing to flash. A
 * panel opened before warming finished renders null for a tick exactly as it
 * would have anyway, and warmPanelChunks makes that window small.
 */
function lazyPanel<P extends object>(load: () => Promise<ComponentType<P>>) {
	let Loaded: ComponentType<any> | null = null;
	let inFlight: Promise<void> | null = null;

	const preload = (): Promise<void> => {
		if (!inFlight) {
			inFlight = load()
				.then((C) => {
					Loaded = C as ComponentType<any>;
				})
				.catch(() => {
					// Let a failed fetch be retried when the panel is next opened,
					// rather than wedging it closed for the rest of the session.
					inFlight = null;
				});
		}
		return inFlight;
	};

	return Object.assign(
		(props: P) => {
			const [Ready, setReady] = useState<ComponentType<any> | null>(() => Loaded);
			useEffect(() => {
				if (Ready) return;
				let alive = true;
				void preload().then(() => {
					if (alive && Loaded) setReady(() => Loaded);
				});
				return () => {
					alive = false;
				};
			}, [Ready]);
			return Ready ? <Ready {...props} /> : null;
		},
		{ preload },
	);
}

const InventoryPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.InventoryPanel));
const ChestPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.ChestPanel));
const CraftingPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.CraftingPanel));
const ToolsPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.ToolsPanel));
const BiomesPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.BiomesPanel));
const HomePanel = lazyPanel(() => import('./ui/Panels').then((m) => m.HomePanel));
const WeatherPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.WeatherPanel));
const MaterialsPanel = lazyPanel(() => import('./ui/Panels').then((m) => m.MaterialsPanel));
const JournalPanel = lazyPanel(() => import('./ui/Journal').then((m) => m.JournalPanel));
const AnimalCard = lazyPanel(() => import('./ui/Journal').then((m) => m.AnimalCard));
const AchievementsPanel = lazyPanel(() => import('./ui/Achievements').then((m) => m.AchievementsPanel));
const GoalsPanel = lazyPanel(() => import('./ui/GoalsPanel').then((m) => m.GoalsPanel));
const DevPanel = lazyPanel(() => import('./ui/DevPanel').then((m) => m.DevPanel));

/**
 * Fetch the panel chunks in the background, before anyone asks for one.
 *
 * Splitting them out kept ~4,200 lines off the critical path to first paint, but
 * it moved the download to the moment a panel OPENS — the one moment it must not
 * happen. Warming during the first idle window (the title screen alone buys
 * seconds of it, while the player reads save slots) means every panel is already
 * resolved by the time one is opened, and lazyPanel renders a resolved panel in
 * the same commit as the click.
 *
 * Honest about the trade: the bytes are still fetched for everyone, including a
 * player who never opens a panel. What splitting buys is a faster first paint and
 * parse, not less bandwidth.
 *
 * DevPanel is deliberately absent: it is dev-only, reached by a secret key
 * sequence, and there is no reason to spend a request on it during play.
 */
const WARM_PANELS = [
	InventoryPanel,
	ChestPanel,
	CraftingPanel,
	ToolsPanel,
	BiomesPanel,
	HomePanel,
	WeatherPanel,
	MaterialsPanel,
	JournalPanel,
	AnimalCard,
	AchievementsPanel,
	GoalsPanel,
];

function warmPanelChunks(): void {
	for (const panel of WARM_PANELS) void panel.preload();
}

/** Run `fn` when the browser is next idle, or soon, wherever requestIdleCallback
 *  isn't available. Returns its own canceller so a quick unmount doesn't leave a
 *  timer holding a reference to a screen that is gone. */
function onIdle(fn: () => void, timeout = 2000): () => void {
	const w = window as any;
	if (typeof w.requestIdleCallback === 'function') {
		const id = w.requestIdleCallback(fn, { timeout });
		return () => w.cancelIdleCallback?.(id);
	}
	const id = window.setTimeout(fn, 200);
	return () => window.clearTimeout(id);
}
import { KeyboardGate } from './ui/KeyboardGate';
import { WelcomeScreen } from './ui/Welcome';
import { DemoNudge } from './ui/DemoNudge';
import { GoalsUnlocked } from './ui/GoalsUnlocked';
import { Icon, ObjectIcon, ResourceIcon } from './ui/icons';
import { journalNav } from './ui/journalNav';

interface ClickedPlacement {
	placementId: string;
	objectId: string;
	name: string;
	plantedAt?: number;
	/** Crafted structures that yield (the rain basin) have no plantedAt — they are
	 *  ready from the moment they are set down, so readiness reads off this. */
	placedAt?: number;
	lastHarvestAt?: number;
	area?: string;
	x?: number;
	y?: number;
	rotation?: number;
}

interface ClickedBed {
	area: string;
	x: number;
	y: number;
}

/** Pick what to sow in a watered soil bed — flowers and trees, costs from basket + chests. */
function PlantMenu({ bed, onClose }: { bed: ClickedBed; onClose: () => void }) {
	const { data, state, plant } = useGame();
	const { t, content } = useI18n();
	if (!data || !state) return null;
	const avail = (resId: string) =>
		(state.player.inventory?.[resId] || 0) + state.chests.reduce((s, c) => s + (c.contents?.[resId] || 0), 0);
	const plantables = data.habitatObjects.filter((o) => o.plantable && (o.biomes || []).includes(bed.area));
	const trees = plantables.filter((o) => (o.growSeconds || 0) >= 80);
	const flowers = plantables.filter((o) => (o.growSeconds || 0) < 80);

	const row = (o: (typeof plantables)[number]) => {
		const canAfford = Object.entries(o.plantCost || {}).every(([id, q]) => avail(id) >= q);
		return (
			<div className="recipe" key={o.id}>
				{/* the same sprite that will grow in the world */}
				<ObjectIcon shape={o.shape} color={o.color} size={34} />
				<div className="grow">
					<b>{content('habitatObject', o.id, 'name', o.name)}</b>
					<div className="muted small">{content('habitatObject', o.id, 'description', o.description || '')}</div>
					<div className="mats">
						{Object.entries(o.plantCost || {}).map(([id, q]) => {
							const r = data.resources.find((rr) => rr.id === id);
							return (
								<span key={id} className={`mat ${avail(id) >= q ? 'mat-ok' : 'mat-no'}`}>
									<ResourceIcon id={id} color={r?.color} />
									{content('resource', id, 'name', r?.name || id)} {Math.min(avail(id), q)}/{q}
								</span>
							);
						})}
					</div>
				</div>
				<button
					disabled={!canAfford}
					onClick={() => {
						plant(bed.area, bed.x, bed.y, o.id);
						onClose();
					}}
				>
					{t('app.plantMenu.plant')}
				</button>
			</div>
		);
	};

	return (
		<div className="panel-backdrop" onClick={onClose}>
			<div className="panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="leaf" size={20} /> {t('app.plantMenu.title')}
					</h2>
					<button className="icon-btn" onClick={onClose} aria-label={t('app.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body">
					<h3>{t('app.plantMenu.flowers')}</h3>
					{flowers.map(row)}
					<h3>{t('app.plantMenu.trees')}</h3>
					{trees.map(row)}
					<p className="muted small">{t('app.plantMenu.hint')}</p>
				</div>
			</div>
		</div>
	);
}

/** Small action menu when you click one of your placed items. */
function PlacementMenu({ item, onClose }: { item: ClickedPlacement; onClose: () => void }) {
	const { removePlacement, rotatePlacement, harvest, data, state } = useGame();
	const { t, content } = useI18n();
	const def = data?.habitatObjects.find((o) => o.id === item.objectId);
	const planted = !!(def?.plantable && item.plantedAt);
	const readyAt = harvestReadyAt(def, {
		plantedAt: item.plantedAt,
		placedAt: item.placedAt,
		lastHarvestAt: item.lastHarvestAt,
	});
	// A rain basin can be full and still refuse to be emptied: it wants rain
	// falling. Offer the action only when the server would honor it, so the menu
	// never dangles a harvest that comes back as an error.
	const weatherHere = liveWeatherType(state?.worldId, item.area || state?.player?.area || '', state?.weather);
	const canHarvest = readyAt != null && Date.now() >= readyAt && harvestWeatherOk(def, weatherHere);
	const yieldName = def?.yield
		? content(
				'resource',
				def.yield.resourceId,
				'name',
				data?.resources.find((r) => r.id === def.yield!.resourceId)?.name || def.yield.resourceId,
			)
		: '';
	return (
		<div className="placement-menu">
			<b>{content('habitatObject', item.objectId, 'name', item.name)}</b>
			{canHarvest && (
				<button
					className="harvest-btn"
					onClick={() => {
						harvest(item.placementId);
						onClose();
					}}
				>
					<Icon name="basket" size={15} /> {t('app.placementMenu.harvest', { name: yieldName })}
				</button>
			)}
			<button
				onClick={() => {
					bridge.emit('enter-move', { placementId: item.placementId });
					onClose();
				}}
			>
				<Icon name="pin" size={15} /> {t('app.placementMenu.move')}
			</button>
			{def?.rotatable && (
				<button
					onClick={() => {
						rotatePlacement(item.placementId);
						onClose();
					}}
				>
					<Icon name="gear" size={15} /> {t('app.placementMenu.rotate')}
				</button>
			)}
			<button
				onClick={() => {
					removePlacement(item.placementId);
					onClose();
				}}
			>
				<Icon name={planted ? 'spade' : 'basket'} size={15} />{' '}
				{planted ? t('app.placementMenu.digUp') : t('app.placementMenu.pickUp')}
			</button>
			<button
				className="icon-btn subtle"
				onClick={onClose}
				aria-label={t('app.common.close')}
				style={{ width: 30, height: 30 }}
			>
				<Icon name="close" size={14} />
			</button>
		</div>
	);
}

function GameScreen() {
	const game = useGame();
	const { t } = useI18n();
	const { panel, setPanel, placementObjectId, cancelPlacement, notify } = game;
	// Toasts live in their own context now (see FeedCtx) so a raised toast doesn't
	// re-render the whole game screen.
	const { toasts, dismissToast } = useGameFeed();
	const [clickedPlacement, setClickedPlacement] = useState<ClickedPlacement | null>(null);
	const [clickedBed, setClickedBed] = useState<ClickedBed | null>(null);
	const [devOpen, setDevOpen] = useState(false);

	// Tell the Phaser world when a modal overlay is open so it swallows world
	// clicks (no moving/placing "through" a panel, card, help, or plant menu).
	useEffect(() => {
		bridge.shared.uiBlocking = !!panel || game.helpOpen || !!clickedBed || devOpen;
	}, [panel, game.helpOpen, clickedBed, devOpen]);

	// On login the world scene can boot a moment before (or after) the saved state
	// is ready, which used to leave the preserve blank until the first place/dig.
	// Nudge the scene to repaint a few times right after it mounts so placements,
	// chests, terrain, and animals always appear on their own.
	useEffect(() => {
		const ids = [60, 200, 500, 1000, 1800].map((ms) => window.setTimeout(() => bridge.emit('world-dirty'), ms));
		return () => ids.forEach((id) => window.clearTimeout(id));
	}, []);

	// Wire Phaser -> React events.
	useEffect(() => {
		const subs = [
			bridge.on('collect-node', (p: any) => game.collect(p.biomeId, p.nodeId, p.resourceId, p.alsoNodeIds)),
			bridge.on('open-chest', (p: any) => game.openChest(p.chestId)),
			bridge.on('open-crafting', () => setPanel('crafting')),
			bridge.on('open-journal', (p: any) => {
				// A field journal stand sends the biome it stands in; point the journal
				// there before opening so it never shows a different biome's page. The
				// menu/J-key path sends nothing and keeps resuming where you left off.
				if (p?.area) journalNav.openAt(p.area);
				setPanel('journal');
			}),
			bridge.on('open-home', () => setPanel('home')),
			bridge.on('rest', () => game.rest()),
			bridge.on('paint-click', (p: any) => {
				if (p?.placementId) game.paintPlacement(p.placementId, game.paintColor);
				else if (p?.target === 'wall') game.paintHome('wall', game.paintColor);
				else if (p?.target === 'rug') game.paintHome('rug', game.paintColor);
				else game.paintHome('floor', game.paintColor);
			}),
			bridge.on('animal-clicked', (p: any) => game.observe(p.animalId)),
			bridge.on('request-area', (p: any) => game.changeArea(p.area)),
			bridge.on('plant-matured', (area: any) => game.recalcArea(area)),
			bridge.on('toast', (p: any) => notify(p.text, p.kind || 'info')),
			bridge.on('placement-exited', () => cancelPlacement()),
			bridge.on('remove-placement', (p: any) => {
				if (window.confirm(t('app.confirm.pickUpPlacement', { name: p.name }))) {
					game.removePlacement(p.placementId);
				}
			}),
			bridge.on('place-at', async (p: any) => {
				const area = bridge.shared.state?.player.area || 'meadow';
				await game.place(p.objectId, area, p.x, p.y, p.rotation || 0);
				const remaining = bridge.shared.state?.player.craftedItems?.[p.objectId] || 0;
				if (remaining <= 0) cancelPlacement();
			}),
			bridge.on('player-moved', (p: any) => {
				api.syncPlayer(p.x, p.y).catch(() => undefined); // quiet background save
			}),
			bridge.on('terraform-at', (p: any) => {
				// flooding the tile you're standing on is blocked outright
				if (p.block) {
					notify(p.block, 'info');
					return;
				}
				// destructive actions on a watered bed (clear / flood) confirm first
				if (p.confirm && !window.confirm(p.confirm)) return;
				// p.expect carries the tile this click was aimed at, so the server can
				// refuse it if the ground has changed since (see api.terraform).
				game.terraform(p.area, p.x, p.y, p.action, p.expect);
			}),
			bridge.on('placement-clicked', (p: any) => setClickedPlacement(p)),
			bridge.on('harvest-placement', (p: any) => game.harvest(p.placementId)),
			bridge.on('bed-clicked', (p: any) => setClickedBed(p)),
			bridge.on('dig-up', (p: any) => {
				if (window.confirm(t('app.confirm.digUpPlacement', { name: p.name }))) {
					game.removePlacement(p.placementId);
				}
			}),
			bridge.on('move-to', (p: any) => game.movePlacement(p.placementId, p.x, p.y, p.rotation)),
		];
		return () => subs.forEach((u) => u());
	}, [game, setPanel, cancelPlacement, notify]);

	// Keyboard shortcuts for panels (documented in How to Play).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Typing in any text box (passcode, feedback, chest amounts, …) must
			// never trigger panel/tool shortcuts — letters belong to the text.
			// Escape steps out of the box first; pressing it again closes the panel.
			if (isTypingTarget(e.target)) {
				if (e.key === 'Escape') (e.target as HTMLElement).blur();
				return;
			}
			// hidden developer panel: Cmd/Ctrl + Shift + Delete (obscure, no username gate).
			// Macs label Backspace as "delete", so accept both keys.
			if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setDevOpen((v) => !v);
				return;
			}
			const k = e.key.toLowerCase();
			if (k === 'escape') {
				// One consistent close chain: Escape always dismisses the topmost
				// thing — dev panel, help, the plant/placement popups, the floating
				// messages, then panels, then placement mode. (Playtest: Esc
				// "sometimes worked" because the popups weren't in this chain.)
				//
				// The messages sit ahead of panels deliberately. A menu's own coach
				// hint appears OVER that menu, so if Esc closed both at once there was
				// no way to dismiss the hint and keep reading the menu it describes.
				// One press, one thing.
				//
				// The demo's "are you done playing?" prompt is first because it sits over
				// everything else. It joins this chain rather than listening for Escape
				// itself, for exactly the reason above — as does the goals hand-off.
				if (game.demoNudge) {
					game.dismissDemoNudge();
					return;
				}
				if (game.goalsUnlocked) {
					game.dismissGoalsUnlocked();
					return;
				}
				if (devOpen) {
					setDevOpen(false);
					return;
				}
				if (game.helpOpen) {
					game.setHelpOpen(false);
					return;
				}
				if (clickedBed) {
					setClickedBed(null);
					return;
				}
				if (clickedPlacement) {
					setClickedPlacement(null);
					return;
				}
				if (dismissCoachTip()) return;
				if (toasts.length) {
					// Newest first — that's the one that just appeared over everything else.
					dismissToast(toasts[toasts.length - 1].id);
					return;
				}
				if (panel) setPanel(null);
				else if (placementObjectId) cancelPlacement();
				return;
			}
			// Resolve the pressed key against the player's (customizable) bindings:
			// help is a modal, panels toggle, tools select. Movement/interact live in the
			// game scene. See src/keybindings.ts.
			const boundAction = actionForToken(tokenFromEvent(e));
			if (boundAction === 'help') {
				game.setHelpOpen(!game.helpOpen);
				return;
			}
			const boundDef = boundAction ? BIND_ACTIONS.find((a) => a.id === boundAction) : null;
			if (boundDef?.panel) setPanel(panel === boundDef.panel ? null : (boundDef.panel as typeof panel));
			if (boundDef?.tool) game.setSelectedTool(boundDef.tool);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [
		panel,
		setPanel,
		placementObjectId,
		cancelPlacement,
		game,
		devOpen,
		clickedBed,
		clickedPlacement,
		toasts,
		dismissToast,
	]);

	return (
		<div className="game-screen">
			<PhaserGame />
			{/* All DOM overlays live in one layer so the colorblind correction filter can
			    apply to the (mostly static) UI independently of the per-frame game canvas
			    — the UI's filtered result is cached and only re-rendered when it changes.
			    `.ui-layer` is display:contents (a no-op) until a colorblind mode is on, so
			    normal play is completely unaffected. */}
			<div className="ui-layer">
				<HUD />
				<Toolbelt />
				<ActivityLog />
				<Tutorial />
				<CoachTips />
				<MobileControls />
				<Toasts />
				<Confetti />
				{clickedPlacement && <PlacementMenu item={clickedPlacement} onClose={() => setClickedPlacement(null)} />}
				{clickedBed && <PlantMenu bed={clickedBed} onClose={() => setClickedBed(null)} />}
				{panel === 'inventory' && <InventoryPanel />}
				{panel === 'chest' && <ChestPanel />}
				{panel === 'crafting' && <CraftingPanel />}
				{panel === 'tools' && <ToolsPanel />}
				{panel === 'biomes' && <BiomesPanel />}
				{panel === 'journal' && <JournalPanel />}
				{panel === 'achievements' && <AchievementsPanel />}
				{panel === 'feed' && <FeedPanel />}
				{panel === 'home' && <HomePanel />}
				{panel === 'animal' && <AnimalCard />}
				{panel === 'settings' && <SettingsPanel />}
				{panel === 'weather' && <WeatherPanel />}
				{panel === 'materials' && <MaterialsPanel />}
				{panel === 'goals' && <GoalsPanel />}
				{devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
			</div>
		</div>
	);
}

/** DEMO only: the hard-stop popup shown when the demo budget is spent (15 minutes
 *  of play after the forest unlocks, which the player earns by restoring the
 *  meadow first). It blocks all play, and it comes back on the next load if the
 *  budget is still spent — the save is only deleted when this is DISMISSED, so
 *  reloading past it used to be a way to keep playing. Closing it drops the
 *  player back at the title screen with nothing to continue.
 *
 *  This screen is the last thing a demo player ever sees, and for a long time it
 *  was the ONLY demo screen with no way to buy the game: the buy line was
 *  unlinked text, the store URLs were imported solely by the soft nudge, and the
 *  one `primary` button was the one that ends the session and deletes the save.
 *  Three things follow from fixing that, and they are all deliberate:
 *
 *   1. The store links are here, and they are here UNCONDITIONALLY — unlike the
 *      soft nudge, which reveals them only after an export because that prompt
 *      interrupts play and can afford to wait. There is no "later" from this
 *      screen. They open in a new tab (see STORE_*_URL in src/demo.ts), so
 *      clicking one costs nothing: the popup stays up and the save is still
 *      exportable behind it.
 *   2. "Back to title" is no longer the primary button. It is the exit, and the
 *      exit should not be the loudest thing on an ending.
 *   3. It asks first if the meadow has not been downloaded. Deleting an
 *      unexported save silently is both a bad last impression and a thrown-away
 *      reason to buy — the carry-over is the strongest argument this screen has.
 */
function DemoCompleteModal() {
	const { demoComplete, dismissDemo, exportDemo, data, state } = useGame();
	const { t } = useI18n();
	const [exporting, setExporting] = useState(false);
	const [exported, setExported] = useState(false);
	const [exportError, setExportError] = useState(false);
	// Second press of "Back to title" when nothing has been downloaded yet. Not a
	// separate dialog: stacking a confirm on top of a modal that is already the
	// end of the game reads as nagging, and the button relabelling itself in
	// place is a smaller interruption that still cannot be clicked through by
	// accident.
	const [confirmLeave, setConfirmLeave] = useState(false);
	if (!demoComplete) return null;
	const onExport = async () => {
		setExporting(true);
		setExportError(false);
		const name = await exportDemo();
		setExporting(false);
		if (name) {
			setExported(true);
			setConfirmLeave(false); // nothing left to lose — drop back to a plain exit
			reportDemoEnd('exported'); // metrics: the end screen produced a carried save
		} else setExportError(true);
	};
	const onLeave = () => {
		if (!exported && !confirmLeave) return setConfirmLeave(true);
		dismissDemo();
	};

	/* What this player actually did, in their own numbers.
	 *
	 * The body paragraph above sells the full game as a feature list — five more
	 * biomes, seasons, deeper crafting — which is the same sentence every player
	 * gets and is about the game rather than about them. These two figures are
	 * the ending: how many neighbours they brought home, and how much of the
	 * preserve's food web that is. The second number is deliberately the small
	 * one. A player who returned fourteen species reads "9% of the food web" and
	 * sees the other 91% for the first time, which is the argument this screen is
	 * trying to make and cannot make with adjectives.
	 *
	 * Both definitions are lifted from UI the player has already seen rather than
	 * invented here, so the recap cannot disagree with the Journal they were
	 * reading five minutes ago: `state.discoveries.length` over
	 * `data.animals.length` is exactly the Journal overview's own (returned/total)
	 * header (src/ui/Journal.tsx), and the same pair the HUD prints as "across the
	 * preserve".
	 *
	 * Skipped entirely at zero. A save can in principle reach the hard-stop having
	 * returned nothing, and "0 animals home · 0% of the food web" is a worse last
	 * impression than no recap at all. */
	const returnedAnimals = state ? state.discoveries.length : 0;
	const totalAnimals = data ? data.animals.length : 0;
	const webPct = totalAnimals ? Math.round((returnedAnimals / totalAnimals) * 100) : 0;
	const showRecap = returnedAnimals > 0 && totalAnimals > 0;

	return (
		<div
			className="panel-backdrop demo-done-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="demo-done-title"
		>
			<div className="panel demo-done-card">
				<div className="demo-done-icon">
					<Icon name="paw" size={30} />
				</div>
				<h2 id="demo-done-title">{t('app.demo.doneTitle')}</h2>
				<p>{t('app.demo.doneBody')}</p>

				{showRecap && (
					<div className="demo-done-recap">
						<div className="demo-done-figures">
							<div className="demo-done-figure">
								<b>{returnedAnimals}</b>
								<span>{t('app.demo.recapAnimals', { count: returnedAnimals })}</span>
							</div>
							<div className="demo-done-figure">
								<b>{webPct}%</b>
								<span>{t('app.demo.recapWeb')}</span>
							</div>
						</div>
						{/* Floored at 2% so a single returned species still draws a mark —
						    a bar with nothing in it reads as "you did nothing". */}
						<div className="demo-done-webbar" role="presentation">
							<i style={{ width: `${Math.max(2, webPct)}%` }} />
						</div>
						<p className="demo-done-recap-line">
							{t('app.demo.recapLine', { returned: returnedAnimals, total: totalAnimals })}
						</p>
					</div>
				)}

				<div className="demo-done-export">
					<p className="demo-done-export-hint">{t('app.demo.exportHint')}</p>
					<button className={`big-btn${exported ? '' : ' primary'}`} onClick={onExport} disabled={exporting}>
						<Icon name={exported ? 'check' : 'download'} size={15} />{' '}
						<span>
							{exporting ? t('app.demo.exporting') : exported ? t('app.demo.exportDone') : t('app.demo.exportButton')}
						</span>
					</button>
					{exportError && <p className="form-error">{t('app.demo.exportFail')}</p>}
				</div>

				{/* The pitch changes once the save is in their downloads: before, it is
				    "buy the game"; after, it is "you already have your meadow, here is
				    where it opens", which is a much smaller step to take. */}
				<p className="demo-done-cta">{exported ? t('app.demo.doneCtaSaved') : t('app.demo.doneCta')}</p>

				{/* New tab on purpose (see STORE_*_URL in src/demo.ts): inside itch's
				    embed a same-frame navigation would tear down the running game, and
				    here it would take the un-exported save with it. */}
				<div className="demo-nudge-stores demo-done-stores">
					<a
						className="big-btn primary demo-nudge-store"
						href={STORE_ITCH_URL}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => reportDemoEnd('store')}
					>
						<Icon name="star" size={15} /> <span>{t('app.demo.storeItch')}</span>
					</a>
					<a
						className="big-btn demo-nudge-store"
						href={STORE_MAS_URL}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => reportDemoEnd('store')}
					>
						<Icon name="star" size={15} /> <span>{t('app.demo.storeMas')}</span>
					</a>
				</div>

				{confirmLeave && <p className="demo-done-warn">{t('app.demo.leaveWarn')}</p>}
				<button className="big-btn subtle demo-done-leave" onClick={onLeave}>
					<span>{confirmLeave ? t('app.demo.doneButtonConfirm') : t('app.demo.doneButton')}</span>
				</button>
			</div>
		</div>
	);
}

function Root() {
	const { state, data } = useGame();
	const prefs = usePrefs();
	const [audioClock, setAudioClock] = useState(0);
	const wasOpeningFlowRef = useRef(true);
	const meadowCueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** The day phase this effect last saw, so first light can be noticed as a
	 *  CHANGE. null until the first pass — see the sunrise cue below. */
	const lastDayPhaseRef = useRef<string | null>(null);
	const audioEnabled = (prefs as any).audioEnabled ?? true;
	const masterVolume = typeof (prefs as any).masterVolume === 'number' ? (prefs as any).masterVolume : 0.8;
	const musicEnabled = prefs.musicEnabled;
	const sfxEnabled = prefs.sfxEnabled;
	const sfxVolume = prefs.sfxVolume;
	const musicVolume = prefs.musicVolume;

	// Warm the lazily-split panel chunks once the app is up and the browser has a
	// spare moment — see warmPanelChunks. Mounted at Root, not GameScreen, so the
	// fetch happens while the player is still on the title screen rather than
	// competing with the first frames of play.
	useEffect(() => onIdle(warmPanelChunks), []);

	// Keep audio listeners and browser-gesture unlock in one place.
	useEffect(() => {
		const unbind = bindGameAudio();
		const unlock = () => primeAudio();
		window.addEventListener('pointerdown', unlock, { passive: true });
		window.addEventListener('keydown', unlock);
		return () => {
			unbind();
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
		};
	}, []);

	// Apply the latest settings panel audio values immediately.
	useEffect(() => {
		applyAudioPrefs({
			audioEnabled,
			musicEnabled,
			sfxEnabled,
			masterVolume,
			sfxVolume,
			musicVolume,
		});
	}, [audioEnabled, musicEnabled, sfxEnabled, masterVolume, sfxVolume, musicVolume]);

	useEffect(
		() => () => {
			if (meadowCueTimeoutRef.current) {
				clearTimeout(meadowCueTimeoutRef.current);
				meadowCueTimeoutRef.current = null;
			}
		},
		[],
	);

	// Keep ambience in sync with live weather/day-phase between state refreshes.
	useEffect(() => {
		const id = window.setInterval(() => {
			setAudioClock((n) => n + 1);
		}, 15000);
		return () => {
			window.clearInterval(id);
		};
	}, []);

	// Play the opening theme only on pre-game screens (menu / character creator).
	useEffect(() => {
		const inOpeningFlow = !state || !data;
		const isHome = !!state && !!data && state.player.area === 'home';
		const outdoors = !!state && !!data && !isHome;
		const worldId = state?.worldId || state?.player?.id || null;
		const area = state?.player.area;
		const dayPhase = liveDayPhase(state?.weather);
		const weatherType = outdoors && area ? liveWeatherType(worldId, area, state?.weather) : 'clear';
		const outdoorAmbienceTrack: 'meadow' | 'night' | 'rain' =
			weatherType === 'rain' ? 'rain' : dayPhase === 'night' ? 'night' : 'meadow';
		const meadowHealth = state?.biomeStates.find((b) => b.biomeId === 'meadow')?.health ?? 0;
		const forestHealth = state?.biomeStates.find((b) => b.biomeId === 'forest')?.health ?? 0;
		const wetlandsHealth = state?.biomeStates.find((b) => b.biomeId === 'wetland')?.health ?? 0;
		const scrublandHealth = state?.biomeStates.find((b) => b.biomeId === 'desert')?.health ?? 0;
		const alpineHealth = state?.biomeStates.find((b) => b.biomeId === 'alpine')?.health ?? 0;
		const coastalHealth = state?.biomeStates.find((b) => b.biomeId === 'coastal')?.health ?? 0;
		const outdoorTrack =
			state?.player.area === 'forest'
				? forestHealth < 50
					? 'hollowforest_level1'
					: forestHealth < 80
						? 'hollowforest_level2'
						: 'hollowforest_level3'
				: state?.player.area === 'wetland'
					? wetlandsHealth < 50
						? 'wetlands_level1'
						: wetlandsHealth < 80
							? 'wetlands_level2'
							: 'wetlands_level3'
					: state?.player.area === 'desert'
						? scrublandHealth < 50
							? 'scrubland_level1'
							: scrublandHealth < 80
								? 'scrubland_level2'
								: 'scrubland_level3'
						: state?.player.area === 'alpine'
							? alpineHealth < 50
								? 'graywind_level1'
								: alpineHealth < 80
									? 'graywind_level2'
									: 'graywind_level3'
							: state?.player.area === 'coastal'
								? coastalHealth < 50
									? 'pelicanbay_level1'
									: coastalHealth < 80
										? 'pelicanbay_level2'
										: 'pelicanbay_level3'
								: meadowHealth < 50
									? 'meadowambient'
									: meadowHealth < 80
										? 'meadowambient_level2'
										: 'meadowambient_level3';
		// Indoors the biome stops carrying the room. The cabin has its own piece,
		// and it plays at every biome and every health level — what you hear in
		// there is the house, not the land outside it.
		const gameplayTrack = isHome ? 'home' : outdoorTrack;

		/* FIRST LIGHT. One birdsong cue on the night -> dawn turn, and only that
		 * turn: this effect re-runs on every audio clock tick, so "it is dawn" is
		 * true for a whole phase and would retrigger for as long as it lasted.
		 *
		 * Never on the first pass into the world. With no previous phase to compare
		 * against, a player who loads a save at dawn would be handed a sunrise they
		 * did not watch arrive — so the menu deliberately forgets the phase rather
		 * than recording one, and the first in-world pass always has nothing to
		 * compare to. Indoors is silent too: the birds are outside. */
		const lastPhase = lastDayPhaseRef.current;
		lastDayPhaseRef.current = inOpeningFlow ? null : dayPhase;
		if (!inOpeningFlow && outdoors && lastPhase && lastPhase !== 'dawn' && dayPhase === 'dawn') {
			bridge.emit('audio-sfx', { id: 'sunriseBirds' });
		}

		if (inOpeningFlow) {
			if (meadowCueTimeoutRef.current) {
				clearTimeout(meadowCueTimeoutRef.current);
				meadowCueTimeoutRef.current = null;
			}
			wasOpeningFlowRef.current = true;
			setMusicActive(true, 'wildwillowstheme');
			setAmbienceActive(false);
			return;
		}

		setAmbienceActive(outdoors, outdoorAmbienceTrack);

		// Transitioning from opening flow into gameplay: stop menu theme now, then
		// start meadowambient after a short lead-in.
		if (wasOpeningFlowRef.current) {
			wasOpeningFlowRef.current = false;
			setMusicActive(false, 'wildwillowstheme');
			setMusicActive(false, gameplayTrack);
			if (meadowCueTimeoutRef.current) clearTimeout(meadowCueTimeoutRef.current);
			meadowCueTimeoutRef.current = setTimeout(() => {
				setMusicActive(true, gameplayTrack);
				meadowCueTimeoutRef.current = null;
			}, 5000);
			return;
		}

		// Once the transition has happened, keep the gameplay cue active.
		setMusicActive(true, gameplayTrack);
	}, [state, data, audioClock]);

	// the game needs both definitions and a logged-in save before it can render.
	return (
		<>
			{state && data ? <GameScreen /> : <WelcomeScreen />}
			<HelpModal />
			<GoalsUnlocked />
			{/* The soft prompt renders first so the hard-stop popup, if both were ever
			    somehow up at once, is the one on top. */}
			<DemoNudge />
			<DemoCompleteModal />
		</>
	);
}

export default function App() {
	return (
		<KeyboardGate>
			<ColorblindFilters />
			<GameProvider>
				<Root />
			</GameProvider>
		</KeyboardGate>
	);
}

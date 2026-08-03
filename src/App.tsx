import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { applyAudioPrefs, bindGameAudio, primeAudio, setAmbienceActive, setMusicActive } from './audio';
import { bridge } from './game/bridge';
import { PhaserGame } from './game/PhaserGame';
import { usePrefs } from './prefs';
import { GameProvider, useGame } from './state';
import { useI18n } from './i18n/react';
import { liveDayPhase, liveWeatherType } from './weather';
import { harvestReadyAt } from './types';
import { isTypingTarget } from './typing';
import { HelpModal } from './ui/Help';
import { ColorblindFilters } from './ui/ColorblindFilters';
import { HUD, Toasts } from './ui/HUD';
import { Confetti } from './ui/Confetti';
import { AnimalCard, JournalPanel } from './ui/Journal';
import { AchievementsPanel } from './ui/Achievements';
import { MobileControls } from './ui/MobileControls';
import {
	BiomesPanel,
	ChestPanel,
	CraftingPanel,
	HomePanel,
	InventoryPanel,
	MaterialsPanel,
	ToolsPanel,
	WeatherPanel,
} from './ui/Panels';
import { SettingsPanel } from './ui/Settings';
import { ActivityLog, FeedPanel, Toolbelt } from './ui/Toolbelt';
import { Tutorial } from './ui/Tutorial';
import { CoachTips } from './ui/CoachTips';
import { GoalsPanel } from './ui/GoalsPanel';
import { DevPanel } from './ui/DevPanel';
import { KeyboardGate } from './ui/KeyboardGate';
import { WelcomeScreen } from './ui/Welcome';
import { JoinWaitingScreen } from './ui/JoinWaiting';
import { JoinApprovalPopup } from './ui/JoinApproval';
import { PeoplePanel } from './ui/People';
import { Icon, ObjectIcon, ResourceIcon } from './ui/icons';

interface ClickedPlacement {
	placementId: string;
	objectId: string;
	name: string;
	plantedAt?: number;
	lastHarvestAt?: number;
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
	const { removePlacement, rotatePlacement, harvest, data } = useGame();
	const { t, content } = useI18n();
	const def = data?.habitatObjects.find((o) => o.id === item.objectId);
	const planted = !!(def?.plantable && item.plantedAt);
	const readyAt = harvestReadyAt(def, {
		plantedAt: item.plantedAt,
		lastHarvestAt: item.lastHarvestAt,
	});
	const canHarvest = readyAt != null && Date.now() >= readyAt;
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
			bridge.on('collect-node', (p: any) => game.collect(p.biomeId, p.nodeId, p.resourceId)),
			bridge.on('open-chest', (p: any) => game.openChest(p.chestId)),
			bridge.on('open-crafting', () => setPanel('crafting')),
			bridge.on('open-journal', () => setPanel('journal')),
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
				game.terraform(p.area, p.x, p.y, p.action);
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
				// thing — dev panel, help, the plant/placement popups, then panels,
				// then placement mode. (Playtest: Esc "sometimes worked" because the
				// popups weren't in this chain.)
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
				if (panel) setPanel(null);
				else if (placementObjectId) cancelPlacement();
				return;
			}
			// H toggles the How-to-Play help modal (it isn't a panel).
			if (k === 'h') {
				game.setHelpOpen(!game.helpOpen);
				return;
			}
			// B = basket, J = journal, K = achievements, F = feed, T = tools,
			// M = map/preserve (P kept as a legacy alias), N = weather & seasons,
			// G = goals, C = crafting (I = basket alias), O = options/settings (gear).
			// The daily task board's collapse toggle is Tab, handled in TasksWidget.
			const map: Record<string, any> = {
				b: 'inventory',
				i: 'inventory',
				j: 'journal',
				k: 'achievements',
				f: 'feed',
				t: 'tools',
				m: 'biomes',
				p: 'biomes',
				g: 'goals',
				c: 'crafting',
				u: 'people',
				n: 'weather',
				o: 'settings',
			};
			if (map[k]) setPanel(panel === map[k] ? null : map[k]);
			// number keys select toolbelt tools
			const toolByKey: Record<string, string> = {
				'1': 'basket',
				'2': 'shovel',
				'3': 'watering-can',
				'4': 'paint',
			};
			if (toolByKey[k]) game.setSelectedTool(toolByKey[k]);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [panel, setPanel, placementObjectId, cancelPlacement, game, devOpen, clickedBed, clickedPlacement]);

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
				<JoinApprovalPopup />
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
				{panel === 'people' && <PeoplePanel />}
				{panel === 'weather' && <WeatherPanel />}
				{panel === 'materials' && <MaterialsPanel />}
				{panel === 'goals' && <GoalsPanel />}
				{devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
			</div>
		</div>
	);
}

/** DEMO only: the hard-stop popup shown once 5 animals return to the meadow.
 *  It blocks all play; the save has already been deleted, so closing it drops
 *  the player back at the title screen with nothing to continue. */
function DemoCompleteModal() {
	const { demoComplete, dismissDemo, exportDemo } = useGame();
	const { t } = useI18n();
	const [exporting, setExporting] = useState(false);
	const [exported, setExported] = useState(false);
	const [exportError, setExportError] = useState(false);
	if (!demoComplete) return null;
	const onExport = async () => {
		setExporting(true);
		setExportError(false);
		const name = await exportDemo();
		setExporting(false);
		if (name) setExported(true);
		else setExportError(true);
	};
	return (
		<div className="panel-backdrop demo-done-backdrop" role="dialog" aria-modal="true">
			<div className="panel demo-done-card">
				<div className="demo-done-icon">
					<Icon name="paw" size={30} />
				</div>
				<h2>{t('app.demo.doneTitle')}</h2>
				<p>{t('app.demo.doneBody', { count: 5 })}</p>

				<div className="demo-done-export">
					<p className="demo-done-export-hint">{t('app.demo.exportHint')}</p>
					<button className="big-btn" onClick={onExport} disabled={exporting}>
						<Icon name={exported ? 'check' : 'download'} size={15} />{' '}
						<span>
							{exporting ? t('app.demo.exporting') : exported ? t('app.demo.exportDone') : t('app.demo.exportButton')}
						</span>
					</button>
					{exportError && <p className="form-error">{t('app.demo.exportFail')}</p>}
				</div>

				<p className="demo-done-cta">{t('app.demo.doneCta')}</p>
				<button className="big-btn primary" onClick={dismissDemo}>
					<Icon name="check" size={15} /> <span>{t('app.demo.doneButton')}</span>
				</button>
			</div>
		</div>
	);
}

function Root() {
	const { state, data, pendingJoin } = useGame();
	const prefs = usePrefs();
	const [audioClock, setAudioClock] = useState(0);
	const wasOpeningFlowRef = useRef(true);
	const meadowCueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const audioEnabled = (prefs as any).audioEnabled ?? true;
	const masterVolume = typeof (prefs as any).masterVolume === 'number' ? (prefs as any).masterVolume : 0.8;
	const musicEnabled = prefs.musicEnabled;
	const sfxEnabled = prefs.sfxEnabled;
	const sfxVolume = prefs.sfxVolume;
	const musicVolume = prefs.musicVolume;

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
		const gameplayTrack =
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
	// A joiner awaiting host approval sits in the waiting room until let in.
	return (
		<>
			{pendingJoin ? <JoinWaitingScreen /> : state && data ? <GameScreen /> : <WelcomeScreen />}
			<HelpModal />
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

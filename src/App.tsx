import { useEffect, useState } from 'react';
import { api } from './api';
import { bridge } from './game/bridge';
import { PhaserGame } from './game/PhaserGame';
import { GameProvider, useGame } from './state';
import { HelpModal } from './ui/Help';
import { HUD, Toasts } from './ui/HUD';
import { AnimalCard, JournalPanel } from './ui/Journal';
import { AchievementsPanel } from './ui/Achievements';
import { MobileControls } from './ui/MobileControls';
import { BiomesPanel, ChestPanel, CraftingPanel, InventoryPanel, ToolsPanel } from './ui/Panels';
import { SettingsPanel } from './ui/Settings';
import { ActivityLog, FeedPanel, Toolbelt } from './ui/Toolbelt';
import { Tutorial } from './ui/Tutorial';
import { DevPanel } from './ui/DevPanel';
import { KeyboardGate } from './ui/KeyboardGate';
import { WelcomeScreen } from './ui/Welcome';
import { Icon } from './ui/icons';

interface ClickedPlacement {
	placementId: string;
	objectId: string;
	name: string;
	plantedAt?: number;
}

interface ClickedBed {
	area: string;
	x: number;
	y: number;
}

/** Pick what to sow in a watered soil bed — flowers and trees, costs from basket + chests. */
function PlantMenu({ bed, onClose }: { bed: ClickedBed; onClose: () => void }) {
	const { data, state, plant } = useGame();
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
				<div className="grow">
					<b>{o.name}</b>
					<div className="muted small">{o.description}</div>
					<div className="mats">
						{Object.entries(o.plantCost || {}).map(([id, q]) => (
							<span key={id} className={`mat ${avail(id) >= q ? 'mat-ok' : 'mat-no'}`}>
								{data.resources.find((r) => r.id === id)?.name || id} {Math.min(avail(id), q)}/{q}
							</span>
						))}
					</div>
				</div>
				<button
					disabled={!canAfford}
					onClick={() => {
						plant(bed.area, bed.x, bed.y, o.id);
						onClose();
					}}
				>
					Plant
				</button>
			</div>
		);
	};

	return (
		<div className="panel-backdrop" onClick={onClose}>
			<div className="panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="leaf" size={20} /> Plant in the watered bed</h2>
					<button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					<h3>Flowers</h3>
					{flowers.map(row)}
					<h3>Trees</h3>
					{trees.map(row)}
					<p className="muted small">Planted things sprout right away and grow in over a minute or two.</p>
				</div>
			</div>
		</div>
	);
}

/** Small action menu when you click one of your placed items. */
function PlacementMenu({ item, onClose }: { item: ClickedPlacement; onClose: () => void }) {
	const { removePlacement, data } = useGame();
	const def = data?.habitatObjects.find((o) => o.id === item.objectId);
	const planted = !!(def?.plantable && item.plantedAt);
	return (
		<div className="placement-menu">
			<b>{item.name}</b>
			<button
				onClick={() => {
					bridge.emit('enter-move', { placementId: item.placementId });
					onClose();
				}}
			>
				<Icon name="pin" size={15} /> Move
			</button>
			<button
				onClick={() => {
					removePlacement(item.placementId);
					onClose();
				}}
			>
				<Icon name={planted ? 'spade' : 'basket'} size={15} /> {planted ? 'Dig up (returns materials)' : 'Pick up'}
			</button>
			<button className="icon-btn subtle" onClick={onClose} aria-label="Close" style={{ width: 30, height: 30 }}>
				<Icon name="close" size={14} />
			</button>
		</div>
	);
}

function GameScreen() {
	const game = useGame();
	const { panel, setPanel, placementObjectId, cancelPlacement, notify } = game;
	const [clickedPlacement, setClickedPlacement] = useState<ClickedPlacement | null>(null);
	const [clickedBed, setClickedBed] = useState<ClickedBed | null>(null);
	const [devOpen, setDevOpen] = useState(false);

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
			bridge.on('open-workbench', () => setPanel('crafting')),
			bridge.on('open-journal', () => setPanel('journal')),
			bridge.on('animal-clicked', (p: any) => game.observe(p.animalId)),
			bridge.on('request-area', (p: any) => game.changeArea(p.area)),
			bridge.on('plant-matured', (area: any) => game.recalcArea(area)),
			bridge.on('toast', (p: any) => notify(p.text, p.kind || 'info')),
			bridge.on('placement-exited', () => cancelPlacement()),
			bridge.on('remove-placement', (p: any) => {
				if (window.confirm(`Pick up ${p.name}? Animals that depend on it may visit less often.`)) {
					game.removePlacement(p.placementId);
				}
			}),
			bridge.on('place-at', async (p: any) => {
				const area = bridge.shared.state?.player.area || 'meadow';
				await game.place(p.objectId, area, p.x, p.y);
				const remaining = bridge.shared.state?.player.craftedItems?.[p.objectId] || 0;
				if (remaining <= 0) cancelPlacement();
			}),
			bridge.on('player-moved', (p: any) => {
				api.syncPlayer(p.x, p.y).catch(() => undefined); // quiet background save
			}),
			bridge.on('terraform-at', (p: any) => {
				// flooding the tile you're standing on is blocked outright
				if (p.block) { notify(p.block, 'info'); return; }
				// destructive actions on a watered bed (clear / flood) confirm first
				if (p.confirm && !window.confirm(p.confirm)) return;
				game.terraform(p.area, p.x, p.y, p.action);
			}),
			bridge.on('placement-clicked', (p: any) => setClickedPlacement(p)),
			bridge.on('bed-clicked', (p: any) => setClickedBed(p)),
			bridge.on('dig-up', (p: any) => {
				if (window.confirm(`Dig up ${p.name}? Its planting materials are refunded.`)) {
					game.removePlacement(p.placementId);
				}
			}),
			bridge.on('move-to', (p: any) => game.movePlacement(p.placementId, p.x, p.y)),
		];
		return () => subs.forEach((u) => u());
	}, [game, setPanel, cancelPlacement, notify]);

	// Keyboard shortcuts for panels (documented in How to Play).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
			// backtick toggles the hidden developer panel (developer save only)
			if (e.key === '`') { if (game.state?.player.id === 'bailey') setDevOpen((v) => !v); return; }
			const k = e.key.toLowerCase();
			if (k === 'escape') {
				if (devOpen) { setDevOpen(false); return; }
				if (game.helpOpen) { game.setHelpOpen(false); return; }
				if (panel) setPanel(null);
				else if (placementObjectId) cancelPlacement();
				return;
			}
			// H toggles the How-to-Play help modal (it isn't a panel).
			if (k === 'h') { game.setHelpOpen(!game.helpOpen); return; }
			// B = basket, J = journal, K = achievements, F = feed, T = tools, P = preserve,
			// G = settings (gear), C = crafting (I = basket alias)
			const map: Record<string, any> = { b: 'inventory', i: 'inventory', j: 'journal', k: 'achievements', f: 'feed', t: 'tools', p: 'biomes', g: 'settings', c: 'crafting' };
			if (map[k]) setPanel(panel === map[k] ? null : map[k]);
			// number keys select toolbelt tools
			const toolByKey: Record<string, string> = { '1': 'basket', '2': 'shovel', '3': 'watering-can' };
			if (toolByKey[k]) game.setSelectedTool(toolByKey[k]);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [panel, setPanel, placementObjectId, cancelPlacement, game, devOpen]);

	return (
		<div className="game-screen">
			<PhaserGame />
			<HUD />
			<Toolbelt />
			<ActivityLog />
			<Tutorial />
			<MobileControls />
			<Toasts />
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
			{panel === 'animal' && <AnimalCard />}
			{panel === 'settings' && <SettingsPanel />}
			{devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
		</div>
	);
}

function Root() {
	const { state, data } = useGame();
	// the game needs both definitions and a logged-in save before it can render
	return (
		<>
			{state && data ? <GameScreen /> : <WelcomeScreen />}
			<HelpModal />
		</>
	);
}

export default function App() {
	return (
		<KeyboardGate>
			<GameProvider>
				<Root />
			</GameProvider>
		</KeyboardGate>
	);
}

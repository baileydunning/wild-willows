import { useEffect, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { COOP_ENABLED } from '../features';
import { weatherType, seasonStyle, liveSeason, liveWeatherType } from '../weather';
import { Icon } from './icons';
import { TasksWidget } from './TasksWidget';

export function Meter({ label, icon, value, color }: { label: string; icon: string; value: number; color: string }) {
	return (
		<div className="meter" title={`${label}: ${value}%`}>
			<span className="meter-icon" style={{ color }}><Icon name={icon} size={15} /></span>
			<span className="meter-label">{label}</span>
			<div className="meter-track">
				<div className="meter-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
			</div>
			<span className="meter-value">{value}%</span>
		</div>
	);
}

export function HUD() {
	const { data, state, saveStatus, panel, setPanel, helpOpen, setHelpOpen, logout, placementObjectId, cancelPlacement, worlds, activeWorldId } = useGame();
	const [prompt, setPrompt] = useState('');
	// The top-right menu can be tucked away so it's out of the scene.
	const [navOpen, setNavOpen] = useState(true);
	// Tick occasionally so the weather chip reflects the ~10-min weather change
	// even when the player is idle (no state refresh).
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = window.setInterval(() => setTick((n) => n + 1), 10000);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => bridge.on('prompt', (p: string) => setPrompt(p || '')), []);

	if (!data || !state) return null;
	const area = state.player.area;
	const biome = data.biomes.find((b) => b.id === area);
	const bState = state.biomeStates.find((b) => b.biomeId === area);
	const totalAnimals = data.animals.filter((a) => a.biome === area).length;
	const returnedAll = state.biomeStates.reduce((sum, b) => sum + (b.returnedCount || 0), 0);
	const allAnimals = data.animals.length;

	// indoors: show home info instead of biome health/animals
	const isHome = area === 'home';
	const home = state.player.home;
	const homeBuilt = !!home?.styleLocked;
	const homeName = homeBuilt ? (data.homeStyles?.[home!.style]?.name || 'Your Home') : 'Canvas Tent';
	const homeCarry = data.homeTracks?.comfort?.levels?.[((home?.comfort) || 1) - 1]?.carry || 0;
	const homeDecor = state.placements.filter((p) => p.area === 'home').length;

	const activeWorld = worlds.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const peersHere = bridge.shared.presence?.length || 0;

	const toggle = (id: any) => setPanel(panel === id ? null : id);
	const navBtn = (id: any, icon: string, label: string, keyHint?: string) => (
		<button
			className={`icon-btn ${panel === id ? 'on' : ''}`}
			onClick={() => toggle(id)}
			title={label}
			aria-label={label}
		>
			<Icon name={icon} />
			{keyHint && <span className="nav-key">{keyHint}</span>}
		</button>
	);

	return (
		<>
			<div className="hud-left-col">
			<div className="hud-top-left">
				{isHome ? (
					<>
						<div className="hud-area-name"><Icon name="home" size={17} /> Your Home</div>
						<div className="hud-returned"><Icon name="sparkle" size={13} /> {homeName}{homeCarry > 0 ? ` · +${homeCarry} carry` : ''}</div>
						<div className="hud-returned hud-returned-total"><Icon name="leaf" size={12} /> {homeDecor} {homeDecor === 1 ? 'thing' : 'things'} placed</div>
					</>
				) : (
					<>
						<div className="hud-area-name">
							<Icon name="leaf" size={17} /> {biome?.name || 'The Preserve'}
							{isCoop && (
								<button className="coop-badge" onClick={() => setPanel('people')} title="Co-op preserve — invite & see who's here (U)">
									<Icon name="user" size={12} /> Co-op{peersHere > 0 ? ` · ${peersHere + 1} here` : ''}
								</button>
							)}
						</div>
						{state.weather && (() => {
							const snap = state.weather;
							const worldId = (state as any).worldId || state.player.id;
							const wt = weatherType(liveWeatherType(worldId, area, snap));
							const ss = seasonStyle(liveSeason(snap));
							return (
								<div className="hud-weather" title={`${wt.name} · ${ss.label}`}>
									<Icon name={wt.icon} size={13} /> {wt.name}
									<span className="hud-season" style={{ color: ss.accent, borderColor: ss.accent }}>{ss.label}</span>
								</div>
							);
						})()}
						{biome && bState && (
							<>
								<Meter label="Health" icon="leaf" value={bState.health} color="#6aa253" />
								<Meter label="Balance" icon="scales" value={bState.balance} color="#5b9cab" />
								<div className="hud-returned">
									<Icon name="paw" size={14} /> {bState.returnedCount}/{totalAnimals} animals returned
								</div>
								<div className="hud-returned hud-returned-total">
									<Icon name="paw" size={12} /> {returnedAll}/{allAnimals} across the preserve
								</div>
							</>
						)}
					</>
				)}
			</div>
			{/* Today's tasks sit right under the biome card, out of the toasts' way. */}
			<TasksWidget />
			</div>

			<div className={`hud-top-right ${navOpen ? '' : 'nav-collapsed'}`}>
				{/* Collapse toggle so the whole menu can tuck out of the way. */}
				<button
					className="icon-btn nav-toggle"
					onClick={() => setNavOpen((v) => !v)}
					title={navOpen ? 'Hide menu' : 'Show menu'}
					aria-label={navOpen ? 'Hide menu' : 'Show menu'}
					aria-expanded={navOpen}
				>
					<Icon name={navOpen ? 'forward' : 'back'} />
				</button>
				{/* A save only surfaces if it FAILS — no persistent "Synced" chip. */}
				{saveStatus === 'error' && (
					<span className="save-pill save-error" title="A save didn't go through — it'll keep retrying">
						<Icon name="cloud" size={15} />
						<span>Retry</span>
					</span>
				)}
				{navOpen && (<>
				{/* Buttons are grouped by purpose so the toolbar reads as a few small
				    clusters rather than one long row: Learn (what you've discovered),
				    Build (your stuff & upgrades), World (places & people), System. */}
				<div className="nav-group" role="group" aria-label="Learn">
					<span className="nav-group-label">Learn</span>
					<div className="nav-group-btns">
						{navBtn('journal', 'journal', 'Field journal (J)', 'J')}
						{navBtn('achievements', 'star', 'Achievements (K)', 'K')}
						{navBtn('feed', 'chat', 'Activity feed (F)', 'F')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label="Build">
					<span className="nav-group-label">Build</span>
					<div className="nav-group-btns">
						{navBtn('inventory', 'basket', 'Basket contents (B)', 'B')}
						{navBtn('crafting', 'hammer', 'Crafting (C)', 'C')}
						{navBtn('tools', 'tools', 'Tool upgrades (T)', 'T')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label="World">
					<span className="nav-group-label">World</span>
					<div className="nav-group-btns">
						{navBtn('biomes', 'map', 'Preserve overview (P)', 'P')}
						{navBtn('weather', 'cloud', 'Weather & seasons (M)', 'M')}
						{isCoop && navBtn('people', 'user', 'People — invite & who’s here (U)', 'U')}
					</div>
				</div>
				<div className="nav-group nav-group-system" role="group" aria-label="System">
					<span className="nav-group-label">System</span>
					<div className="nav-group-btns">
						<button className={`icon-btn ${panel === 'settings' ? 'on' : ''}`} onClick={() => toggle('settings')} title="Settings — change character, delete save (G)" aria-label="Settings">
							<Icon name="sliders" />
							<span className="nav-key">G</span>
						</button>
						<button className={`icon-btn ${helpOpen ? 'on' : ''}`} onClick={() => setHelpOpen(!helpOpen)} title="How to play (H)" aria-label="How to play">
							<Icon name="help" />
							<span className="nav-key">H</span>
						</button>
						<button className="icon-btn subtle" onClick={logout} title={`Save & quit (${state.player.name})`} aria-label="Save and quit">
							<Icon name="logout" />
						</button>
					</div>
				</div>
				</>)}
			</div>

			{(placementObjectId || prompt) && (
				<div className="hud-bottom">
					{placementObjectId ? (
						<span className="prompt-line">
							<Icon name="pin" size={15} />
							Placing <b>{data.habitatObjects.find((o) => o.id === placementObjectId)?.name}</b> — click a tile
							<button className="link" onClick={cancelPlacement}>stop placing</button>
						</span>
					) : (
						<span className="prompt-line"><Icon name="sparkle" size={15} /> {prompt}</span>
					)}
				</div>
			)}
		</>
	);
}

export function Toasts() {
	const { toasts, dismissToast } = useGame();
	const iconFor = { animal: 'paw', unlock: 'sparkle', error: 'help', info: 'leaf', achievement: 'star' } as const;
	return (
		<div className="toasts">
			{toasts.map((t) => (
				<div key={t.id} className={`toast toast-${t.kind}`}>
					<Icon name={iconFor[t.kind] || 'leaf'} size={17} />
					<span>{t.text}</span>
					<button
						className="toast-close"
						onClick={() => dismissToast(t.id)}
						title="Dismiss"
						aria-label="Dismiss message"
					>
						<Icon name="close" size={13} />
					</button>
				</div>
			))}
		</div>
	);
}

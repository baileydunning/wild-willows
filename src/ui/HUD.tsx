import { useEffect, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { Icon } from './icons';

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
	const { data, state, saveStatus, panel, setPanel, helpOpen, setHelpOpen, logout, placementObjectId, cancelPlacement } = useGame();
	const [prompt, setPrompt] = useState('');

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
			<div className="hud-top-left">
				{isHome ? (
					<>
						<div className="hud-area-name"><Icon name="home" size={17} /> Your Home</div>
						<div className="hud-returned"><Icon name="sparkle" size={13} /> {homeName}{homeCarry > 0 ? ` · +${homeCarry} carry` : ''}</div>
						<div className="hud-returned hud-returned-total"><Icon name="leaf" size={12} /> {homeDecor} {homeDecor === 1 ? 'thing' : 'things'} placed</div>
					</>
				) : (
					<>
						<div className="hud-area-name"><Icon name="leaf" size={17} /> {biome?.name || 'The Preserve'}</div>
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

			<div className="hud-top-right">
				<span className={`save-pill save-${saveStatus}`} title="Progress syncs to Harper automatically">
					<Icon name="cloud" size={15} />
					<span>{saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry' : 'Synced'}</span>
				</span>
				{navBtn('inventory', 'basket', 'Basket contents (B)', 'B')}
				{navBtn('journal', 'journal', 'Field journal (J)', 'J')}
				{navBtn('achievements', 'star', 'Achievements (K)', 'K')}
				{navBtn('feed', 'chat', 'Activity feed (F)', 'F')}
				{navBtn('biomes', 'map', 'Preserve overview (P)', 'P')}
				{navBtn('tools', 'tools', 'Tool upgrades (T)', 'T')}
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

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
	const { data, state, saveStatus, panel, setPanel, setHelpOpen, logout, placementObjectId, cancelPlacement } = useGame();
	const [prompt, setPrompt] = useState('');

	useEffect(() => bridge.on('prompt', (p: string) => setPrompt(p || '')), []);

	if (!data || !state) return null;
	const area = state.player.area;
	const biome = data.biomes.find((b) => b.id === area);
	const bState = state.biomeStates.find((b) => b.biomeId === area);
	const totalAnimals = data.animals.filter((a) => a.biome === area).length;

	const toggle = (id: any) => setPanel(panel === id ? null : id);
	const navBtn = (id: any, icon: string, label: string) => (
		<button
			className={`icon-btn ${panel === id ? 'on' : ''}`}
			onClick={() => toggle(id)}
			title={label}
			aria-label={label}
		>
			<Icon name={icon} />
		</button>
	);

	return (
		<>
			<div className="hud-top-left">
				<div className="hud-area-name"><Icon name="leaf" size={17} /> {biome?.name || 'The Preserve'}</div>
				{biome && bState && (
					<>
						<Meter label="Health" icon="leaf" value={bState.health} color="#6aa253" />
						<Meter label="Balance" icon="drop" value={bState.balance} color="#5b9cab" />
						<div className="hud-returned">
							<Icon name="paw" size={14} /> {bState.returnedCount}/{totalAnimals} animals returned
						</div>
					</>
				)}
			</div>

			<div className="hud-top-right">
				<span className={`save-pill save-${saveStatus}`} title="Progress syncs to Harper automatically">
					<Icon name="cloud" size={15} />
					<span>{saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry' : 'Synced'}</span>
				</span>
				{navBtn('inventory', 'basket', 'Basket contents (B)')}
				{navBtn('journal', 'journal', 'Field journal (J)')}
				{navBtn('biomes', 'map', 'Preserve overview (P)')}
				<button className="icon-btn" onClick={() => setHelpOpen(true)} title="How to play" aria-label="How to play">
					<Icon name="help" />
				</button>
				<button className={`icon-btn ${panel === 'settings' ? 'on' : ''}`} onClick={() => toggle('settings')} title="Settings — change character, delete save" aria-label="Settings">
					<Icon name="gear" />
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
	const iconFor = { animal: 'paw', unlock: 'sparkle', error: 'help', info: 'leaf' } as const;
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

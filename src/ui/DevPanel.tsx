import { useState } from 'react';
import { api } from '../api';
import { useGame } from '../state';
import { Icon } from './icons';

/**
 * Hidden developer panel for testing — opened with Cmd/Ctrl + Shift + Delete,
 * available to any save. Calls the server DevTools endpoint, then refreshes
 * state. Never surfaced in normal play.
 */
export function DevPanel({ onClose }: { onClose: () => void }) {
	const { data, state, refresh, notify, changeArea } = useGame();
	const [busy, setBusy] = useState<string | null>(null);
	const [amounts, setAmounts] = useState<Record<string, number>>({});
	const [fill, setFill] = useState(100);
	const [health, setHealth] = useState(100);
	if (!data || !state) return null;
	const area = state.player.area;
	const recipesUnlocked = !!state.player.devUnlockAll;

	const run = async (label: string, action: string, args: Record<string, any> = {}) => {
		setBusy(action);
		try {
			const r = await api.dev(action, args);
			await refresh();
			notify(`Dev: ${r.log?.join(' · ') || label}`);
		} catch (e: any) {
			notify(e.message || 'Dev action failed', 'error');
		} finally {
			setBusy(null);
		}
	};

	const setAll = (n: number) => {
		const next: Record<string, number> = {};
		for (const r of data.resources) next[r.id] = n;
		setAmounts(next);
	};

	const grant = () => {
		const resources = Object.fromEntries(Object.entries(amounts).filter(([, v]) => v > 0));
		if (!Object.keys(resources).length) { notify('Set an amount for at least one resource', 'error'); return; }
		run('Granted resources', 'grant-resources', { resources });
	};

	const Btn = ({ label, action, args }: { label: string; action: string; args?: Record<string, any> }) => (
		<button disabled={!!busy} onClick={() => run(label, action, args)}>
			{busy === action ? '…' : label}
		</button>
	);

	return (
		<div className="panel-backdrop" onClick={onClose}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="gear" size={20} /> Dev tools <span className="muted small">· {area}</span></h2>
					<button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					<p className="muted small">Testing only — opened with Cmd/Ctrl + Shift + Delete.</p>

					<h3><Icon name="leaf" size={15} /> This biome <span className="muted small">· {area}</span></h3>
					<div className="dev-grid">
						<Btn label={`Reseed ${area}`} action="seed-water" args={{ area }} />
						<Btn label={`Clear ${area} terrain`} action="clear-terrain" args={{ area }} />
						<Btn label={`Welcome all animals to ${area}`} action="welcome-animals" args={{ area }} />
						<button
							disabled={!!busy}
							onClick={() => {
								if (window.confirm(`Reset ${area} to its damaged state? This removes all placed habitat, terraforming, and returned animals here. Chests and their contents are kept.`)) {
									run(`Reset ${area}`, 'reset-biome', { area });
								}
							}}
						>
							{busy === 'reset-biome' ? '…' : `Reset ${area}`}
						</button>
						<button
							disabled={!!busy || area === 'meadow'}
							title={area === 'meadow' ? 'The starting meadow cannot be locked' : ''}
							onClick={() => run(`Lock ${area}`, 'lock-biome', { area })}
						>
							{busy === 'lock-biome' ? '…' : `Lock ${area} again`}
						</button>
					</div>
					<div className="dev-fill">
						<span className="muted small" style={{ flex: '0 0 auto' }}>Set {area} health</span>
						<input type="number" min={0} max={100} value={health} onChange={(e) => setHealth(Number(e.target.value))} style={{ width: 70 }} />
						<button disabled={!!busy} onClick={() => run(`Set ${area} health`, 'set-health', { area, value: health })}>
							{busy === 'set-health' ? '…' : 'Apply'}
						</button>
					</div>

					<h3><Icon name="gear" size={15} /> Travel</h3>
					<div className="dev-grid">
						{data.biomes.filter((b) => b.explorable).map((b) => {
							const unlocked = state.player.unlockedBiomes.includes(b.id);
							return (
								<button
									key={b.id}
									disabled={!!busy || !unlocked || b.id === area}
									title={!unlocked ? 'Unlock it first (Unlock all biomes)' : ''}
									onClick={async () => { await changeArea(b.id); onClose(); }}
								>
									{b.id === area ? `${b.name} (here)` : `Go to ${b.name}`}
								</button>
							);
						})}
					</div>

					<h3><Icon name="gear" size={15} /> Whole preserve</h3>
					<div className="dev-grid">
						<Btn label="Unlock next area" action="unlock-next" />
						<Btn label="Unlock all biomes" action="unlock-all" />
						<button disabled={!!busy} onClick={() => { if (window.confirm('Re-lock every biome except the meadow?')) run('Re-lock all', 'relock-all'); }}>
							{busy === 'relock-all' ? '…' : 'Re-lock all biomes'}
						</button>
						<button disabled={!!busy} onClick={() => run('Toggle recipes', 'unlock-recipes')}>
							{busy === 'unlock-recipes' ? '…' : recipesUnlocked ? 'Re-lock recipes' : 'Unlock all recipes'}
						</button>
						<Btn label="Max all tools" action="max-tools" />
						<Btn label="Reset tools to tier 1" action="reset-tools" />
					</div>

					<h3><Icon name="home" size={15} /> Home</h3>
					<div className="dev-grid">
						{Object.entries(data.homeStyles || {}).map(([id, s]) => (
							<Btn key={id} label={`Build: ${s.name}`} action="build-home" args={{ value: id }} />
						))}
						<Btn label="Max home (all tracks)" action="max-home" />
						<button disabled={!!busy} onClick={() => { if (window.confirm('Reset your home to the starter tent?')) run('Reset home', 'reset-home'); }}>
							{busy === 'reset-home' ? '…' : 'Reset home to tent'}
						</button>
					</div>

					<h3><Icon name="basket" size={15} /> Grant resources</h3>
					<div className="dev-fill">
						<label className="field" style={{ flex: '0 0 auto' }}>
							<input type="number" min={0} value={fill} onChange={(e) => setFill(Number(e.target.value))} style={{ width: 70 }} />
						</label>
						<button onClick={() => setAll(fill)}>Fill all</button>
						<button onClick={() => setAll(0)}>Clear</button>
					</div>
					<div className="dev-res-grid">
						{data.resources.map((r) => (
							<label key={r.id} className="dev-res">
								<span className="swatch" style={{ background: r.color || '#888' }} />
								<span className="dev-res-name">{r.name}</span>
								<input
									type="number"
									min={0}
									value={amounts[r.id] ?? 0}
									onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: Number(e.target.value) }))}
								/>
							</label>
						))}
					</div>
					<div className="form-actions" style={{ justifyContent: 'flex-end' }}>
						<button className="big-btn primary" disabled={!!busy} onClick={grant}>
							<Icon name="check" /> <span>Grant selected</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

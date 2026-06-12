import { useState } from 'react';
import { api } from '../api';
import { useGame } from '../state';
import { Icon } from './icons';

/**
 * Hidden developer panel for testing — toggled with the backtick (`) key, and
 * only available on the developer save ("bailey"). Calls the server DevTools
 * endpoint, then refreshes state. Not shown in normal play.
 */
export function DevPanel({ onClose }: { onClose: () => void }) {
	const { data, state, refresh, notify } = useGame();
	const [busy, setBusy] = useState<string | null>(null);
	const [amounts, setAmounts] = useState<Record<string, number>>({});
	const [fill, setFill] = useState(100);
	if (!data || !state || state.player.id !== 'bailey') return null;
	const area = state.player.area;

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
					<p className="muted small">Testing only — press <b>`</b> (backtick) to toggle.</p>

					<div className="dev-grid">
						<Btn label="Reseed wetland water" action="seed-water" args={{ area: 'wetland' }} />
						<Btn label={`Reseed ${area} water`} action="seed-water" args={{ area }} />
						<Btn label={`Clear ${area} terrain`} action="clear-terrain" args={{ area }} />
						<Btn label="Max all tools" action="max-tools" />
						<Btn label="Unlock all biomes" action="unlock-all" />
						<Btn label={`Set ${area} health to 100%`} action="set-health" args={{ area, value: 100 }} />
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

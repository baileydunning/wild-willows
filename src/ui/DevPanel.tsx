import { useState } from 'react';
import { api } from '../api';
import { useGame } from '../state';
import { animalSpriteDataUri } from '../game/textures';
import { bridge } from '../game/bridge';
import { Icon } from './icons';
import { WEATHER_TYPES, SEASONS, weatherType, seasonStyle } from '../weather';

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
	const [spawnQuery, setSpawnQuery] = useState('');
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
						<button
							disabled={!!busy}
							title={`Scatter habitat, mature plant clusters, path runs, a lake + river, every animal home, and 100% health — a showcase for screenshots/video. Replaces existing placements & terrain here (chests kept).`}
							onClick={() => run(`Populate ${area}`, 'populate-biome', { area })}
						>
							<Icon name="sparkle" size={13} /> {busy === 'populate-biome' ? 'Populating…' : `Populate ${area} (showcase)`}
						</button>
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

					<h3><Icon name="cloud" size={15} /> Weather &amp; season</h3>
					{(() => {
						const ov = state.weather?.override;
						const curType = ov?.type || null;
						const curSeason = ov?.season || null;
						return (
							<>
								<p className="muted small">
									Force the sky for filming. {ov ? `Override: ${curType ? weatherType(curType).name : 'live'} · ${curSeason ? seasonStyle(curSeason).label : 'live'}.` : 'Currently following the live clock.'}
								</p>
								<div className="dev-grid">
									{WEATHER_TYPES.map((id) => (
										<button
											key={id}
											disabled={!!busy}
											style={curType === id ? { outline: '2px solid var(--green)' } : undefined}
											onClick={() => run(`Weather: ${id}`, 'set-weather', { value: { type: id } })}
										>
											{weatherType(id).name}
										</button>
									))}
								</div>
								<div className="dev-grid" style={{ marginTop: 6 }}>
									{SEASONS.map((s) => (
										<button
											key={s}
											disabled={!!busy}
											style={curSeason === s ? { outline: '2px solid var(--green)' } : undefined}
											onClick={() => run(`Season: ${s}`, 'set-weather', { value: { season: s } })}
										>
											{seasonStyle(s).label}
										</button>
									))}
									<button disabled={!!busy || !ov} onClick={() => run('Weather cleared', 'set-weather', { value: { clear: true } })}>
										Back to live
									</button>
								</div>
							</>
						);
					})()}

					<h3><Icon name="paw" size={15} /> Spawn animal</h3>
					<p className="muted small">Type an animal's name — click a match to bring it back to its biome right away.</p>
					{(() => {
						const q = spawnQuery.trim().toLowerCase();
						const discovered = new Set(state.discoveries.map((disc) => disc.animalId));
						const biomeName = (id: string) => data.biomes.find((b) => b.id === id)?.name || id;
						const matches = q
							? data.animals
									.filter((an) =>
										[an.name, an.id, an.biome, an.kind, an.rarity].join(' ').toLowerCase().includes(q)
									)
									.sort((a, b) => a.name.localeCompare(b.name))
									.slice(0, 12)
							: [];
						return (
							<>
								<input
									className="craft-search"
									type="search"
									placeholder="e.g. raccoon, bear, owl, forest…"
									value={spawnQuery}
									onChange={(e) => setSpawnQuery(e.target.value)}
									autoComplete="off"
									autoFocus
									aria-label="Search animals to spawn"
								/>
								{q && (
									<div className="dev-spawn-results">
										{matches.length === 0 && <p className="muted small">No animals match “{spawnQuery}”.</p>}
										{matches.map((an) => (
											<button
												key={an.id}
												className="dev-spawn-row"
												disabled={!!busy}
												title={`Spawn ${an.name} in the ${biomeName(an.biome)}`}
												onClick={() => run(`Spawn ${an.name}`, 'spawn-animal', { animalId: an.id })}
											>
												<img className="ani-thumb" src={animalSpriteDataUri(an.id, an.kind)} alt="" />
												<span className="grow">{an.name}</span>
												<span className="muted small">{biomeName(an.biome)} · {an.rarity}</span>
												{discovered.has(an.id) ? <span className="dev-spawn-here">✓ here</span> : <Icon name="plus" size={14} />}
											</button>
										))}
									</div>
								)}
							</>
						);
					})()}

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

					<h3><Icon name="star" size={15} /> Celebrate</h3>
					<div className="dev-grid">
						<button disabled={!!busy} onClick={() => bridge.emit('confetti')}>
							<Icon name="sparkle" size={13} /> Trigger confetti
						</button>
					</div>

					<h3><Icon name="logout" size={15} /> Restart game</h3>
					<p className="muted small">Wipes this save back to a brand-new game (fresh onboarding, no progress) — keeps your name, passcode, and character look.</p>
					<div className="dev-grid">
						<button
							disabled={!!busy}
							onClick={() => {
								if (!window.confirm('Restart the whole game? This erases ALL progress (biomes, animals, home, goals, inventory) and starts you over at the tutorial. Your character is kept.')) return;
								// Replay onboarding: clear the client-side tutorial / goals-intro flags.
								for (const k of ['wild-willows:tutorial-pos', 'wild-willows:tutorial-min', 'wild-willows:tutorial-cardpos', 'ww-goals-intro', 'ww-tasks-collapsed']) {
									try { localStorage.removeItem(k); } catch { /* ignore */ }
								}
								void run('Restarted game', 'restart-game').then(onClose);
							}}
						>
							{busy === 'restart-game' ? 'Restarting…' : 'Restart from scratch'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

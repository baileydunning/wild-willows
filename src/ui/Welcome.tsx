import { useEffect, useMemo, useState } from 'react';
import { api, forgetSave, lastSave, IS_DESKTOP, listSoloSaves, deleteSoloSave, setTransport, type SaveMeta } from '../api';
import { useGame } from '../state';
import { COOP_ENABLED } from '../features';
import type { Appearance } from '../types';
import { CharacterPreview, Icon } from './icons';

type Mode = 'menu' | 'new' | 'load' | 'join-code';

const genToken = () => {
	try { return crypto.randomUUID(); } catch { return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
};

interface JoinCtx { code: string; token: string; worldId: string; worldName: string; hostName: string; }

function Scenery() {
	// decorative dusk-meadow backdrop
	return (
		<svg className="welcome-scenery" viewBox="0 0 1000 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
			<path d="M0 150 Q250 90 500 140 T1000 130 V240 H0 Z" fill="#3d5232" />
			<path d="M0 185 Q300 140 600 180 T1000 175 V240 H0 Z" fill="#324528" />
			{/* willow tree */}
			<g transform="translate(820 30)">
				<path d="M0 150 Q8 80 4 40" stroke="#5a4632" strokeWidth="14" fill="none" strokeLinecap="round" />
				<ellipse cx="5" cy="30" rx="78" ry="42" fill="#4a6b3a" />
				<ellipse cx="-30" cy="48" rx="40" ry="26" fill="#557a44" />
				<ellipse cx="45" cy="50" rx="36" ry="24" fill="#557a44" />
				{[-60, -35, -8, 20, 48, 70].map((x, i) => (
					<path key={i} d={`M${x} ${52 + (i % 3) * 6} q4 36 -4 62`} stroke="#6b9152" strokeWidth="4" fill="none" strokeLinecap="round" />
				))}
			</g>
			{/* little campsite */}
			<g transform="translate(120 130)">
				<path d="M0 60 L38 0 L76 60 Z" fill="#9e5f69" />
				<path d="M38 0 L76 60 L56 60 Z" fill="#8a4f59" />
				<path d="M38 14 L26 60 L50 60 Z" fill="#5d4128" />
				<g transform="translate(100 38)">
					<circle cx="0" cy="22" r="4" fill="#8e8e8a" />
					<circle cx="18" cy="24" r="4" fill="#8e8e8a" />
					<rect x="-2" y="14" width="22" height="5" rx="2.5" fill="#7c5a3c" />
					<path d="M9 -8 L1 14 L17 14 Z" fill="#e8954f" />
					<path d="M9 -2 L4 13 L14 13 Z" fill="#f4c95f" />
					<circle cx="9" cy="2" r="14" fill="#ffd98a" opacity="0.18" />
				</g>
			</g>
			{/* fireflies */}
			{[210, 330, 450, 560, 660, 740].map((x, i) => (
				<circle key={i} className={`firefly f${i % 3}`} cx={x} cy={120 + (i % 4) * 18} r="2.6" fill="#ffe9a8" />
			))}
		</svg>
	);
}

export function WelcomeScreen() {
	const { data, dataError, startNew, startNewCoop, startLogin, continueLast, startNewSolo, loadSoloSlot, setHelpOpen } = useGame();
	const [mode, setMode] = useState<Mode>('menu');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [passcode, setPasscode] = useState('');
	// Main-menu world toggle: Solo or Co-op. Co-op New Game then hosts or joins.
	const [coop, setCoop] = useState(false);
	const [coopKind, setCoopKind] = useState<'host' | 'join'>('host');
	const [joinCode, setJoinCode] = useState('');
	// set once a join code is verified + the request is sent; carried into character creation
	const [joinCtx, setJoinCtx] = useState<JoinCtx | null>(null);
	// The most recent save for the currently-selected mode (re-read when toggled),
	// so "Continue" only appears for a matching solo/co-op save. `bumpLast` lets a
	// failed continue clear it.
	const [lastBump, setLastBump] = useState(0);
	const last = useMemo(() => lastSave(coop ? 'coop' : 'solo'), [coop, lastBump]);

	// Desktop solo: no passcode, local save slots (each with the saved avatar).
	const soloLocal = IS_DESKTOP && !coop;
	const [slots, setSlots] = useState<SaveMeta[] | null>(null);
	const refreshSlots = () => { if (soloLocal) listSoloSaves().then(setSlots).catch(() => setSlots([])); };
	useEffect(() => { refreshSlots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [soloLocal]);
	const recentSlot = soloLocal ? slots?.[0] ?? null : null;

	// On desktop, point the API at the right backend for the selected mode BEFORE
	// any call fires: solo → in-app/offline, co-op → hosted Harper. (Web ignores
	// this and always uses its own origin.)
	useEffect(() => { if (IS_DESKTOP) setTransport(coop ? 'coop' : 'solo'); }, [coop]);

	const opts = data?.appearanceOptions;
	const [appearance, setAppearance] = useState<Appearance>({
		skin: '#eec39a',
		hair: '#6e4a33',
		outfit: '#4a7c59',
		hat: 'straw',
		hairstyle: 'short',
		body: 'slim',
	});

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (e: any) {
			setError(e.message || 'Something went wrong');
		} finally {
			setBusy(false);
		}
	};

	// Continue can fail if the save was made against a different Harper instance —
	// fall back to the login form with the name prefilled instead of dead-ending.
	const onContinue = () =>
		run(async () => {
			try {
				await continueLast(coop ? 'coop' : 'solo');
			} catch (e: any) {
				if (last) setName(last.name);
				forgetSave(coop ? 'coop' : 'solo');
				setLastBump((n) => n + 1);
				setMode('load');
				throw new Error(`${e.message || 'Could not load that save'} — log in below instead.`);
			}
		});

	const hatLabel: Record<string, string> = { straw: 'Straw hat', leaf: 'Leaf hat', beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', flower: 'Flower crown', party: 'Party hat', none: 'No hat' };
	const hairstyleLabel: Record<string, string> = { short: 'Short', long: 'Long', curly: 'Curly', 'curly-long': 'Curly long', bun: 'Bun', ponytail: 'Ponytail', pigtails: 'Pigtails', afro: 'Afro', mohawk: 'Mohawk' };
	const bodyLabel: Record<string, string> = { slim: 'Slender', round: 'Sturdy' };

	return (
		<div className="welcome">
			<div className="welcome-sky" />
			<Scenery />
			<div className="welcome-card">
				<h1 className="game-title">Wild Willows</h1>

				{dataError && <p className="form-error"><Icon name="help" size={16} /> {dataError}</p>}

				{mode === 'menu' && (
					<div className="menu-buttons">
						{COOP_ENABLED && (
							<>
								<div className="mode-toggle" role="group" aria-label="Play mode">
									<button
										type="button"
										className={`mode-toggle-btn ${!coop ? 'on' : ''}`}
										onClick={() => setCoop(false)}
									>
										<Icon name="leaf" size={15} /> Solo
									</button>
									<button
										type="button"
										className={`mode-toggle-btn ${coop ? 'on' : ''}`}
										onClick={() => setCoop(true)}
									>
										<Icon name="user" size={15} /> Co-op
									</button>
								</div>
								<p className="muted small mode-hint">
									{coop
										? 'Restore a shared preserve with friends — host one for a join code, or join with a friend’s code.'
										: 'Your own private preserve, just for you.'}
								</p>
							</>
						)}
						{soloLocal && recentSlot && (
							<button className="big-btn primary" disabled={busy || !data} onClick={() => run(() => loadSoloSlot(recentSlot.slotId))}>
								<Icon name="play" /> <span>{busy ? 'Loading your save…' : `Continue as ${recentSlot.name}`}</span>
							</button>
						)}
						{!soloLocal && last && (
							<button className="big-btn primary" disabled={busy || !data} onClick={onContinue}>
								<Icon name="play" /> <span>{busy ? 'Loading your save…' : `Continue as ${last.name}`}</span>
							</button>
						)}
						{coop ? (
							<>
								<button className={`big-btn ${last ? '' : 'primary'}`} disabled={busy || !data} onClick={() => { setCoopKind('host'); setError(null); setMode('new'); }}>
									<Icon name="plus" /> <span>Host a New Preserve</span>
								</button>
								<button className="big-btn" disabled={busy || !data} onClick={() => { setCoopKind('join'); setError(null); setJoinCtx(null); setMode('join-code'); }}>
									<Icon name="user" /> <span>Join with a Code</span>
								</button>
								<button className="big-btn" disabled={busy || !data} onClick={() => { setError(null); setMode('load'); }}>
									<Icon name="folder" /> <span>Load a Co-op Save</span>
								</button>
							</>
						) : (
							<>
								<button className={`big-btn ${(soloLocal ? recentSlot : last) ? '' : 'primary'}`} disabled={busy || !data} onClick={() => { setError(null); setMode('new'); }}>
									<Icon name="plus" /> <span>New Game</span>
								</button>
								<button className="big-btn" disabled={busy || !data || (soloLocal && !(slots && slots.length))} onClick={() => { setError(null); refreshSlots(); setMode('load'); }}>
									<Icon name="folder" /> <span>Load Game</span>
								</button>
							</>
						)}
						<button className="big-btn subtle" onClick={() => setHelpOpen(true)}>
							<Icon name="help" /> <span>How to Play</span>
						</button>
						{!data && !dataError && <p className="muted small">Reaching the preserve…</p>}
					</div>
				)}

				{mode === 'join-code' && (
					<form
						className="creator"
						onSubmit={(e) => {
							e.preventDefault();
							run(async () => {
								const code = joinCode.trim();
								if (name.trim().length < 2) throw new Error('Enter the name you’ll play as');
								if (code.length < 4) throw new Error('Enter the join code your friend shared');
								const chk = await api.checkWorldCode(code);
								if (!chk.exists || !chk.world) throw new Error('No world found with that code — double-check it.');
								if (chk.world.full) throw new Error('That world is full right now.');
								const token = genToken();
								await api.requestJoin(code, token, name.trim());
								setJoinCtx({ code, token, worldId: chk.world.worldId, worldName: chk.world.name, hostName: chk.world.hostName });
								setMode('new');
							});
						}}
					>
						<p className="muted small mode-hint">
							Enter your caretaker name and the code your friend shared. We’ll let the host know you’d like to join while you build your character.
						</p>
						<label className="field">
							<Icon name="user" size={17} />
							<input placeholder="Your caretaker name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
						</label>
						<label className="field">
							<Icon name="leaf" size={17} />
							<input placeholder="Join code (e.g. K7P2QM)" value={joinCode} maxLength={6} style={{ textTransform: 'uppercase' }} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
						</label>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>Back</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || name.trim().length < 2 || joinCode.trim().length < 4}>
								<Icon name="user" /> <span>{busy ? 'Asking the host…' : 'Ask to join & build character'}</span>
							</button>
						</div>
					</form>
				)}

				{mode === 'new' && (
					<form
						className="creator"
						onSubmit={(e) => {
							e.preventDefault();
							if (soloLocal) run(() => startNewSolo(name, appearance));
							else if (!coop) run(() => startNew(name, passcode, appearance));
							else if (coopKind === 'host') run(() => startNewCoop(name, passcode, appearance, { mode: 'host' }));
							else if (joinCtx) run(() => startNewCoop(name, passcode, appearance, { mode: 'join', code: joinCtx.code, token: joinCtx.token, joinWorldId: joinCtx.worldId, worldName: joinCtx.worldName, hostName: joinCtx.hostName }));
						}}
					>
						{COOP_ENABLED && (
							<div className="mode-banner">
								<Icon name={coop ? 'user' : 'leaf'} size={15} /> {coop ? (coopKind === 'host' ? 'Host a Preserve' : `Joining ${joinCtx?.worldName || 'a Preserve'}`) : 'New Solo Game'}
								{!(coop && coopKind === 'join') && (
									<button type="button" className="link-btn small" onClick={() => setCoop((v) => !v)}>
										switch to {coop ? 'Solo' : 'Co-op'}
									</button>
								)}
							</div>
						)}
						{coop && (
							<p className="muted small mode-hint">
								{coopKind === 'host'
									? "Start a shared preserve — you'll get a join code to invite friends."
									: joinCtx
										? `Joining ${joinCtx.worldName} — ${joinCtx.hostName} is reviewing your request while you customize. You'll enter as soon as they approve.`
										: "Enter a friend's code to restore their preserve together."}
							</p>
						)}
						<div className="creator-cols">
							<div className="creator-preview">
								<CharacterPreview appearance={appearance} />
							</div>
							<div className="creator-options">
								<label className="field">
									<Icon name="user" size={17} />
									<input
										placeholder="Caretaker name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										maxLength={24}
										autoFocus
									/>
								</label>
								{!soloLocal && (
									<label className="field">
										<Icon name="lock" size={17} />
										<input
											placeholder="Passcode (4+ characters)"
											type="password"
											value={passcode}
											onChange={(e) => setPasscode(e.target.value)}
										/>
									</label>
								)}

								<div className="swatch-row">
									<span className="swatch-label">Skin</span>
									{(opts?.skins || []).map((c) => (
										<button type="button" key={c} className={`swatch-btn ${appearance.skin === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setAppearance((a) => ({ ...a, skin: c }))} aria-label={`Skin ${c}`} />
									))}
									<label className="swatch-pick" title="Pick any skin color">
										<Icon name="eyedropper" size={14} />
										<input type="color" value={appearance.skin} onChange={(e) => setAppearance((a) => ({ ...a, skin: e.target.value }))} aria-label="Custom skin color" />
									</label>
								</div>
								<div className="swatch-row">
									<span className="swatch-label">Hair</span>
									{(opts?.hair || []).map((c) => (
										<button type="button" key={c} className={`swatch-btn ${appearance.hair === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setAppearance((a) => ({ ...a, hair: c }))} aria-label={`Hair ${c}`} />
									))}
									<label className="swatch-pick" title="Pick any hair color">
										<Icon name="eyedropper" size={14} />
										<input type="color" value={appearance.hair} onChange={(e) => setAppearance((a) => ({ ...a, hair: e.target.value }))} aria-label="Custom hair color" />
									</label>
								</div>
								<div className="swatch-row">
									<span className="swatch-label">Style</span>
									{(opts?.hairstyles || []).map((h) => (
										<button type="button" key={h} className={`hat-btn ${appearance.hairstyle === h ? 'sel' : ''}`} onClick={() => setAppearance((a) => ({ ...a, hairstyle: h }))}>
											{hairstyleLabel[h] || h}
										</button>
									))}
								</div>
								<div className="swatch-row">
									<span className="swatch-label">Build</span>
									{(opts?.bodies || []).map((b) => (
										<button type="button" key={b} className={`hat-btn ${appearance.body === b ? 'sel' : ''}`} onClick={() => setAppearance((a) => ({ ...a, body: b }))}>
											{bodyLabel[b] || b}
										</button>
									))}
								</div>
								<div className="swatch-row">
									<span className="swatch-label">Outfit</span>
									{(opts?.outfits || []).map((c) => (
										<button type="button" key={c} className={`swatch-btn ${appearance.outfit === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setAppearance((a) => ({ ...a, outfit: c }))} aria-label={`Outfit ${c}`} />
									))}
									<label className="swatch-pick" title="Pick any outfit color">
										<Icon name="eyedropper" size={14} />
										<input type="color" value={appearance.outfit} onChange={(e) => setAppearance((a) => ({ ...a, outfit: e.target.value }))} aria-label="Custom outfit color" />
									</label>
								</div>
								<div className="swatch-row">
									<span className="swatch-label">Hat</span>
									{(opts?.hats || []).map((h) => (
										<button type="button" key={h} className={`hat-btn ${appearance.hat === h ? 'sel' : ''}`} onClick={() => setAppearance((a) => ({ ...a, hat: h }))}>
											{hatLabel[h] || h}
										</button>
									))}
								</div>
							</div>
						</div>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>Back</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || name.trim().length < 2 || (!soloLocal && passcode.length < 4)}>
								<Icon name="sparkle" /> <span>{busy ? 'Settling in…' : !coop ? 'Begin restoring' : coopKind === 'join' ? 'Create & join' : 'Start co-op'}</span>
							</button>
						</div>
					</form>
				)}

				{mode === 'load' && soloLocal && (
					<div className="creator">
						<p className="muted small mode-hint">Pick up where you left off — your saves live on this computer.</p>
						<div className="save-slots">
							{(slots || []).length === 0 && (
								<p className="muted small">No saved games yet. Start a New Game to begin your preserve.</p>
							)}
							{(slots || []).map((s) => (
								<div key={s.slotId} className="save-slot">
									<button
										type="button"
										className="save-slot-main"
										disabled={busy}
										onClick={() => run(() => loadSoloSlot(s.slotId))}
									>
										<span className="save-slot-avatar">
											<CharacterPreview appearance={s.appearance} size={56} />
										</span>
										<span className="save-slot-info">
											<span className="save-slot-name">{s.name}</span>
											<span className="muted small">
												{new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(s.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
											</span>
										</span>
									</button>
									<button
										type="button"
										className="save-slot-del"
										title={`Delete ${s.name}`}
										disabled={busy}
										onClick={async () => {
											if (!window.confirm(`Delete "${s.name}"? This can't be undone.`)) return;
											await deleteSoloSave(s.slotId);
											refreshSlots();
										}}
									>
										<Icon name="trash" size={16} />
									</button>
								</div>
							))}
						</div>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>Back</span>
							</button>
						</div>
					</div>
				)}

				{mode === 'load' && !soloLocal && (
					<form
						className="creator"
						onSubmit={(e) => {
							e.preventDefault();
							run(() => startLogin(name, passcode));
						}}
					>
						<label className="field">
							<Icon name="user" size={17} />
							<input placeholder="Caretaker name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
						</label>
						<label className="field">
							<Icon name="lock" size={17} />
							<input placeholder="Passcode" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
						</label>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>Back</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || !name.trim() || !passcode}>
								<Icon name="play" /> <span>{busy ? 'Walking the trail…' : 'Load Game'}</span>
							</button>
						</div>
					</form>
				)}

			</div>
		</div>
	);
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, forgetSave, lastSave, IS_DESKTOP, listSoloSaves, deleteSoloSave, importSoloSave, setTransport, type SaveMeta } from '../api';
import { useGame } from '../state';
import { LOCALE_NAMES, chooseLocale } from '../i18n';
import { useI18n } from '../i18n/react';
import { COOP_ENABLED } from '../features';
import type { Appearance } from '../types';
import { CharacterPreview, Icon } from './icons';
import { AppearanceRows, AccessibilityControls, randomizeAppearance } from './Settings';
import { randomName } from './names';

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
	const { data, dataError, startNew, startNewCoop, startLogin, continueLast, startNewSolo, loadSoloSlot } = useGame();
	const { t, locale } = useI18n();
	const [mode, setMode] = useState<Mode>('menu');
	const [settingsOpen, setSettingsOpen] = useState(false);
	// The title screen gets its own short, welcoming intro — not the dense
	// in-game How to Play (full loop + every keyboard shortcut), which would
	// overwhelm someone who hasn't even started yet.
	const [introOpen, setIntroOpen] = useState(false);
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

	// Import a save file the player exported earlier (e.g. moving to a new machine
	// or restoring a backup). Lands as a new slot — never clobbers an existing one.
	const fileRef = useRef<HTMLInputElement | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const onImportFile = async (file: File | null | undefined) => {
		if (!file) return;
		setNotice(null);
		await run(async () => {
			const text = await file.text();
			let meta: SaveMeta;
			try {
				meta = await importSoloSave(text);
			} catch {
				throw new Error(t('app.welcome.errImport'));
			}
			refreshSlots();
			setMode('load');
			setNotice(t('app.welcome.importDone', { name: meta.name }));
		});
	};

	// On desktop, point the API at the right backend for the selected mode BEFORE
	// any call fires: solo → in-app/offline, co-op → hosted Harper. (Web ignores
	// this and always uses its own origin.)
	useEffect(() => { if (IS_DESKTOP) setTransport(coop ? 'coop' : 'solo'); }, [coop]);

	const [appearance, setAppearance] = useState<Appearance>({
		skin: '#eec39a',
		hair: '#6e4a33',
		outfit: '#4a7c59',
		hat: 'straw',
		hairstyle: 'short',
		beard: 'none',
		body: 'slim',
	});

	// The New Game creator opens with an empty name field — naming yourself is
	// part of the fun. The dice button is the only thing that rolls a random
	// caretaker name (see randomizeAppearance's onClick below).

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (e: any) {
			setError(e.message || t('app.error.generic'));
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
				throw new Error(t('app.welcome.continueFailed', { message: e.message || t('app.error.loadSave') }));
			}
		});

	return (
		<div className="welcome">
			<div className="welcome-sky" />
			<Scenery />
			<div className="welcome-card">
				<h1 className="game-title">{t('app.title')}</h1>

				{soloLocal && (
					// Off-screen (not display:none) so the native picker reliably opens when
					// clicked programmatically in Electron. No `accept` filter — the file is
					// validated on import, and a strict filter can grey out valid saves.
					<input
						ref={fileRef}
						type="file"
						aria-hidden="true"
						tabIndex={-1}
						style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
						onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onImportFile(f); }}
					/>
				)}

				{dataError && <p className="form-error"><Icon name="help" size={16} /> {dataError}</p>}

				{mode === 'menu' && (
					<div className="menu-buttons">
						{COOP_ENABLED && (
							<>
								<div className="mode-toggle" role="group" aria-label={t('app.welcome.playMode')}>
									<button
										type="button"
										className={`mode-toggle-btn ${!coop ? 'on' : ''}`}
										onClick={() => setCoop(false)}
									>
										<Icon name="leaf" size={15} /> {t('app.welcome.solo')}
									</button>
									<button
										type="button"
										className={`mode-toggle-btn ${coop ? 'on' : ''}`}
										onClick={() => setCoop(true)}
									>
										<Icon name="user" size={15} /> {t('app.welcome.coop')}
									</button>
								</div>
								<p className="muted small mode-hint">
									{coop
										? t('app.welcome.coopHint')
										: t('app.welcome.soloHint')}
								</p>
							</>
						)}
						{soloLocal && recentSlot && (
							<button className="big-btn primary" disabled={busy || !data} onClick={() => run(() => loadSoloSlot(recentSlot.slotId))}>
								<Icon name="play" /> <span>{busy ? t('app.welcome.loadingSave') : t('app.welcome.continueAs', { name: recentSlot.name })}</span>
							</button>
						)}
						{!soloLocal && last && (
							<button className="big-btn primary" disabled={busy || !data} onClick={onContinue}>
								<Icon name="play" /> <span>{busy ? t('app.welcome.loadingSave') : t('app.welcome.continueAs', { name: last.name })}</span>
							</button>
						)}
						{coop ? (
							<>
								<button className={`big-btn ${last ? '' : 'primary'}`} disabled={busy || !data} onClick={() => { setCoopKind('host'); setError(null); setMode('new'); }}>
									<Icon name="plus" /> <span>{t('app.welcome.hostNew')}</span>
								</button>
								<button className="big-btn" disabled={busy || !data} onClick={() => { setCoopKind('join'); setError(null); setJoinCtx(null); setMode('join-code'); }}>
									<Icon name="user" /> <span>{t('app.welcome.joinWithCode')}</span>
								</button>
								<button className="big-btn" disabled={busy || !data} onClick={() => { setError(null); setMode('load'); }}>
									<Icon name="folder" /> <span>{t('app.welcome.loadCoopSave')}</span>
								</button>
							</>
						) : (
							<>
								<button className={`big-btn ${(soloLocal ? recentSlot : last) ? '' : 'primary'}`} disabled={busy || !data} onClick={() => { setError(null); setMode('new'); }}>
									<Icon name="plus" /> <span>{t('app.welcome.newGame')}</span>
								</button>
								<button className="big-btn" disabled={busy || !data} onClick={() => { setError(null); refreshSlots(); setMode('load'); }}>
									<Icon name="folder" /> <span>{t('app.welcome.loadGame')}</span>
								</button>
							</>
						)}
						<div className="menu-links">
							<button className="big-btn subtle" onClick={() => setIntroOpen(true)}>
								<Icon name="help" /> <span>{t('app.welcome.howToPlay')}</span>
							</button>
							<button className="big-btn subtle" onClick={() => setSettingsOpen(true)}>
								<Icon name="gear" /> <span>{t('app.settings.title')}</span>
							</button>
						</div>
						{!data && !dataError && <p className="muted small">{t('app.welcome.reaching')}</p>}
					</div>
				)}

				{mode === 'join-code' && (
					<form
						className="creator"
						onSubmit={(e) => {
							e.preventDefault();
							run(async () => {
								const code = joinCode.trim();
								if (name.trim().length < 2) throw new Error(t('app.welcome.errName'));
								if (code.length < 4) throw new Error(t('app.welcome.errCode'));
								const chk = await api.checkWorldCode(code);
								if (!chk.exists || !chk.world) throw new Error(t('app.welcome.errNoWorld'));
								if (chk.world.full) throw new Error(t('app.welcome.errWorldFull'));
								const token = genToken();
								await api.requestJoin(code, token, name.trim());
								setJoinCtx({ code, token, worldId: chk.world.worldId, worldName: chk.world.name, hostName: chk.world.hostName });
								setMode('new');
							});
						}}
					>
						<p className="muted small mode-hint">
							{t('app.welcome.joinHint')}
						</p>
						<label className="field">
							<Icon name="user" size={17} />
							<input placeholder={t('app.welcome.yourNamePlaceholder')} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
						</label>
						<label className="field">
							<Icon name="leaf" size={17} />
							<input placeholder={t('app.welcome.joinCodePlaceholder')} value={joinCode} maxLength={6} style={{ textTransform: 'uppercase' }} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
						</label>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>{t('app.common.back')}</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || name.trim().length < 2 || joinCode.trim().length < 4}>
								<Icon name="user" /> <span>{busy ? t('app.welcome.askingHost') : t('app.welcome.askToJoin')}</span>
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
								<Icon name={coop ? 'user' : 'leaf'} size={15} /> {coop ? (coopKind === 'host' ? t('app.welcome.hostBanner') : t('app.welcome.joiningBanner', { name: joinCtx?.worldName || t('app.welcome.aPreserve') })) : t('app.welcome.newSoloBanner')}
								{!(coop && coopKind === 'join') && (
									<button type="button" className="link-btn small" onClick={() => setCoop((v) => !v)}>
										{coop ? t('app.welcome.switchToSolo') : t('app.welcome.switchToCoop')}
									</button>
								)}
							</div>
						)}
						{coop && (
							<p className="muted small mode-hint">
								{coopKind === 'host'
									? t('app.welcome.hostFormHint')
									: joinCtx
										? t('app.welcome.joinFormHint', { world: joinCtx.worldName, host: joinCtx.hostName })
										: t('app.welcome.codeFormHint')}
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
										placeholder={t('app.welcome.namePlaceholder')}
										value={name}
										onChange={(e) => setName(e.target.value)}
										maxLength={24}
										autoFocus
									/>
									<button
										type="button"
										className="dice-btn"
										onClick={(e) => { e.preventDefault(); setAppearance(randomizeAppearance(data?.appearanceOptions, appearance)); setName(randomName(name)); }}
										title={t('app.welcome.randomize')}
										aria-label={t('app.welcome.randomize')}
									>
										<Icon name="dice" size={16} />
									</button>
								</label>
								{!soloLocal && (
									<label className="field">
										<Icon name="lock" size={17} />
										<input
											placeholder={t('app.welcome.passcodeNewPlaceholder')}
											type="password"
											value={passcode}
											onChange={(e) => setPasscode(e.target.value)}
										/>
									</label>
								)}

								<AppearanceRows value={appearance} onChange={setAppearance} />
							</div>
						</div>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>{t('app.common.back')}</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || name.trim().length < 2 || (!soloLocal && passcode.length < 4)}>
								<Icon name="sparkle" /> <span>{busy ? t('app.welcome.settlingIn') : !coop ? t('app.welcome.beginRestoring') : coopKind === 'join' ? t('app.welcome.createAndJoin') : t('app.welcome.startCoop')}</span>
							</button>
						</div>
					</form>
				)}

				{mode === 'load' && soloLocal && (
					<div className="creator">
						<p className="muted small mode-hint">{t('app.welcome.loadHint')}</p>
						{notice && <p className="form-notice"><Icon name="check" size={14} /> {notice}</p>}
						<div className="save-slots">
							{(slots || []).length === 0 && (
								<p className="muted small">{t('app.welcome.noSaves')}</p>
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
										title={t('app.welcome.deleteSave', { name: s.name })}
										disabled={busy}
										onClick={async () => {
											if (!window.confirm(t('app.confirm.deleteSlot', { name: s.name }))) return;
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
								<Icon name="back" /> <span>{t('app.common.back')}</span>
							</button>
							<button type="button" className="big-btn subtle" disabled={busy} onClick={() => { fileRef.current?.click(); setError(null); setNotice(null); }}>
								<Icon name="upload" /> <span>{busy ? t('app.welcome.importing') : t('app.welcome.importSave')}</span>
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
							<input placeholder={t('app.welcome.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
						</label>
						<label className="field">
							<Icon name="lock" size={17} />
							<input placeholder={t('app.welcome.passcodePlaceholder')} type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
						</label>
						{error && <p className="form-error">{error}</p>}
						<div className="form-actions">
							<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
								<Icon name="back" /> <span>{t('app.common.back')}</span>
							</button>
							<button type="submit" className="big-btn primary" disabled={busy || !name.trim() || !passcode}>
								<Icon name="play" /> <span>{busy ? t('app.welcome.walkingTrail') : t('app.welcome.loadGame')}</span>
							</button>
						</div>
					</form>
				)}

			</div>

			{introOpen && (
				<div className="panel-backdrop help-backdrop" onClick={() => setIntroOpen(false)}>
					<div className="panel welcome-intro" role="dialog" aria-modal="true" aria-label={t('app.welcome.intro.title')} onClick={(e) => e.stopPropagation()}>
						<div className="panel-head">
							<h2><Icon name="leaf" size={18} /> {t('app.welcome.intro.title')}</h2>
							<button className="icon-btn" onClick={() => setIntroOpen(false)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
						</div>
						<div className="panel-body">
							<p className="welcome-intro-lede">{t('app.welcome.intro.lede')}</p>
							<div className="welcome-intro-steps">
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon"><Icon name="basket" size={22} /></span>
									<div>
										<b>{t('app.welcome.intro.gatherTitle')}</b>
										<p>{t('app.welcome.intro.gatherText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon"><Icon name="hammer" size={22} /></span>
									<div>
										<b>{t('app.welcome.intro.craftTitle')}</b>
										<p>{t('app.welcome.intro.craftText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon"><Icon name="paw" size={22} /></span>
									<div>
										<b>{t('app.welcome.intro.welcomeTitle')}</b>
										<p>{t('app.welcome.intro.welcomeText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon"><Icon name="map" size={22} /></span>
									<div>
										<b>{t('app.welcome.intro.unlockTitle')}</b>
										<p>{t('app.welcome.intro.unlockText')}</p>
									</div>
								</div>
							</div>
							<p className="welcome-intro-reassure"><Icon name="sparkle" size={15} /> {t('app.welcome.intro.reassure')}</p>
							<div className="form-actions end">
								<button className="big-btn primary" style={{ width: 'auto', marginTop: 0 }} onClick={() => setIntroOpen(false)}>
									<Icon name="check" size={15} /> <span>{t('app.welcome.intro.gotIt')}</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{settingsOpen && (
				<div className="panel-backdrop help-backdrop" onClick={() => setSettingsOpen(false)}>
					<div className="panel lang-panel" role="dialog" aria-modal="true" aria-label={t('app.settings.title')} onClick={(e) => e.stopPropagation()}>
						<div className="panel-head">
							<h2><Icon name="gear" size={18} /> {t('app.settings.title')}</h2>
							<button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
						</div>
						<div className="panel-body settings-body">
							<h3><Icon name="globe" size={15} /> {t('app.settings.language')}</h3>
							<div className="craft-filter lang-filter">
								<label htmlFor="welcome-language">{t('app.settings.language')}:</label>
								<select id="welcome-language" value={locale} onChange={(e) => void chooseLocale(e.target.value)}>
									{Object.entries(LOCALE_NAMES).map(([code, name]) => (
										<option key={code} value={code}>{name}</option>
									))}
								</select>
							</div>
							<h3><Icon name="sliders" size={15} /> {t('app.settings.accessibility')}</h3>
							<AccessibilityControls />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

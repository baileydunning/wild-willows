import { useEffect, useMemo, useRef, useState } from 'react';
import {
	api,
	forgetSave,
	isMissingSaveError,
	isDemoSaveUnreachable,
	lastSave,
	IS_DESKTOP,
	listSoloSaves,
	deleteSoloSave,
	importSoloSave,
	setTransport,
	type SaveMeta,
} from '../api';
import { useGame } from '../state';
import { LOCALE_NAMES, chooseLocale } from '../i18n';
import { useI18n } from '../i18n/react';
import { COOP_ENABLED } from '../features';
import { DEMO } from '../demo';
import type { Appearance } from '../types';
import { CharacterPreview, Icon } from './icons';
import {
	AppearanceRows,
	AccessibilityControls,
	SoundControls,
	randomizeAppearance,
	randomStartingAppearance,
} from './Settings';
import { randomName } from './names';

type Mode = 'menu' | 'new' | 'load' | 'join-code';

const genToken = () => {
	try {
		return crypto.randomUUID();
	} catch {
		return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	}
};

// The itch demo plays against Harper without asking the player for a passcode:
// we mint a throwaway one they never see. The server pairs it with a unique id
// (edition:'demo'), and the save is wiped at the 5-animal hard-stop anyway.
const genDemoPasscode = () => genToken().replace(/-/g, '').slice(0, 16);

interface JoinCtx {
	code: string;
	token: string;
	worldId: string;
	worldName: string;
	hostName: string;
}

function Scenery() {
	// Decorative dusk-meadow backdrop, now covering the whole screen so the
	// sky can host clouds and birds while the meadow bustles with wildlife.
	// Every creature borrows its palette + shapes from the in-game sprites
	// (src/game/textures.ts) so the title screen previews the game's charm.
	// All movement is pure CSS animation, so the global
	// [data-reduce-motion="1"] rule stills the whole scene automatically.
	return (
		<svg className="welcome-scenery" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
			{/* drifting clouds */}
			<g className="cloud c0" fill="#f7e9c8" opacity="0.16">
				<ellipse cx="0" cy="64" rx="72" ry="15" />
				<ellipse cx="52" cy="52" rx="46" ry="12" />
			</g>
			<g className="cloud c1" fill="#f7e9c8" opacity="0.12">
				<ellipse cx="0" cy="128" rx="54" ry="11" />
				<ellipse cx="-40" cy="136" rx="36" ry="9" />
			</g>
			<g className="cloud c2" fill="#f7e9c8" opacity="0.1">
				<ellipse cx="0" cy="188" rx="60" ry="12" />
				<ellipse cx="44" cy="196" rx="38" ry="9" />
			</g>

			{/* a little flock heading home for the evening */}
			<g className="flock">
				{[
					[0, 0],
					[34, 14],
					[62, 4],
				].map(([x, y], i) => (
					<g key={i} transform={`translate(${x} ${y})`}>
						<path
							className={`bird-wings w${i % 2}`}
							d="M0 0 Q6 -7 12 0 Q18 -7 24 0"
							stroke="#2e2820"
							strokeWidth="2.4"
							fill="none"
							strokeLinecap="round"
						/>
					</g>
				))}
			</g>

			{/* meadow hills */}
			<path d="M0 470 Q250 410 500 460 T1000 450 V560 H0 Z" fill="#3d5232" />
			<path d="M0 505 Q300 460 600 500 T1000 495 V560 H0 Z" fill="#324528" />

			{/* willow tree */}
			<g transform="translate(820 350)">
				<path d="M0 150 Q8 80 4 40" stroke="#5a4632" strokeWidth="14" fill="none" strokeLinecap="round" />
				<path d="M2 95 q-30 -8 -50 0" stroke="#5a4632" strokeWidth="7" fill="none" strokeLinecap="round" />
				<ellipse cx="5" cy="30" rx="78" ry="42" fill="#4a6b3a" />
				<ellipse cx="-30" cy="48" rx="40" ry="26" fill="#557a44" />
				<ellipse cx="45" cy="50" rx="36" ry="24" fill="#557a44" />
				<g className="willow-fronds">
					{[-60, -35, -8, 20, 48, 70].map((x, i) => (
						<path
							key={i}
							d={`M${x} ${52 + (i % 3) * 6} q4 36 -4 62`}
							stroke="#6b9152"
							strokeWidth="4"
							fill="none"
							strokeLinecap="round"
						/>
					))}
				</g>
				{/* owl keeping watch from the low branch */}
				<g transform="translate(-58 68) scale(0.95)">
					<ellipse cx="13" cy="17" rx="10" ry="11" fill="#7c6248" />
					<path d="M5 6 L9 12 L3 12 Z" fill="#7c6248" />
					<path d="M21 6 L23 12 L17 12 Z" fill="#7c6248" />
					<ellipse cx="13" cy="20" rx="6" ry="7" fill="#d8c8a8" />
					<g className="owl-eyes">
						<circle cx="9" cy="12" r="3.4" fill="#f4e3b1" />
						<circle cx="17" cy="12" r="3.4" fill="#f4e3b1" />
						<circle cx="9" cy="12" r="1.6" fill="#2e2018" />
						<circle cx="17" cy="12" r="1.6" fill="#2e2018" />
					</g>
					<path d="M13 14 L11 17 L15 17 Z" fill="#e3c75f" />
				</g>
			</g>

			{/* deer grazing by the willow (mirrored to face left) */}
			<g transform="translate(712 468) scale(-1 1)">
				<ellipse cx="15" cy="16" rx="11" ry="7" fill="#b08a5c" />
				<rect x="7" y="22" width="3" height="9" fill="#b08a5c" />
				<rect x="21" y="22" width="3" height="9" fill="#b08a5c" />
				<ellipse cx="6" cy="14" rx="3" ry="3.5" fill="#f4ecd8" />
				<g className="deer-head">
					<circle cx="27" cy="9" r="6" fill="#b08a5c" />
					<ellipse cx="24" cy="3" rx="1.5" ry="3.5" fill="#b08a5c" />
					<ellipse cx="30" cy="3" rx="1.5" ry="3.5" fill="#b08a5c" />
					<circle cx="29" cy="8" r="1.3" fill="#2e2018" />
				</g>
			</g>

			{/* little campsite */}
			<g transform="translate(120 450)">
				<path d="M0 60 L38 0 L76 60 Z" fill="#9e5f69" />
				<path d="M38 0 L76 60 L56 60 Z" fill="#8a4f59" />
				<path d="M38 14 L26 60 L50 60 Z" fill="#5d4128" />
				<g transform="translate(100 38)">
					<circle cx="0" cy="22" r="4" fill="#8e8e8a" />
					<circle cx="18" cy="24" r="4" fill="#8e8e8a" />
					<rect x="-2" y="14" width="22" height="5" rx="2.5" fill="#7c5a3c" />
					<circle className="smoke s0" cx="9" cy="-12" r="3.5" fill="#d8d3c8" />
					<circle className="smoke s1" cx="7" cy="-12" r="3" fill="#d8d3c8" />
					<circle className="smoke s2" cx="11" cy="-12" r="4" fill="#d8d3c8" />
					<g className="campfire-flame">
						<path d="M9 -8 L1 14 L17 14 Z" fill="#e8954f" />
						<path d="M9 -2 L4 13 L14 13 Z" fill="#f4c95f" />
						<circle cx="9" cy="2" r="14" fill="#ffd98a" opacity="0.18" />
					</g>
				</g>
			</g>

			{/* squirrel in the foreground, a little clear of the campfire, tail twitching */}
			<g transform="translate(285 498)">
				<g className="squirrel-tail">
					<ellipse cx="6" cy="12" rx="4.5" ry="8" fill="#7c5a3c" />
				</g>
				<rect x="11" y="22" width="3.4" height="4" fill="#9a7448" />
				<rect x="17" y="22" width="3.4" height="4" fill="#9a7448" />
				<ellipse cx="14" cy="18" rx="7" ry="5.5" fill="#9a7448" />
				<circle cx="20" cy="12" r="5" fill="#9a7448" />
				<circle cx="19" cy="7" r="2" fill="#7c5a3c" />
				<circle cx="21" cy="11" r="1.2" fill="#2e2018" />
			</g>

			{/* meadow flowers for the butterflies */}
			{[
				[470, 512, '#d98a9e'],
				[508, 520, '#e3c75f'],
				[548, 514, '#c9884f'],
				[432, 522, '#b8a3d6'],
			].map(([x, y, c], i) => (
				<g key={i} transform={`translate(${x} ${y})`}>
					<path d="M0 0 q1 8 0 14" stroke="#557a44" strokeWidth="2" fill="none" />
					<circle cx="0" cy="0" r="3.4" fill={c as string} />
					<circle cx="0" cy="0" r="1.3" fill="#f4e3b1" />
				</g>
			))}

			{/* butterflies wandering between the flowers */}
			<g className="butterfly-drift bd0">
				<g className="butterfly-wings">
					<ellipse cx="-5" cy="-2" rx="5" ry="5" fill="#e8771f" />
					<ellipse cx="5" cy="-2" rx="5" ry="5" fill="#e8771f" />
					<ellipse cx="-4" cy="4" rx="3.4" ry="3" fill="#e8954f" />
					<ellipse cx="4" cy="4" rx="3.4" ry="3" fill="#e8954f" />
				</g>
				<ellipse cx="0" cy="1" rx="1.4" ry="5.5" fill="#2e2018" />
			</g>
			<g className="butterfly-drift bd1">
				<g className="butterfly-wings">
					<ellipse cx="-5" cy="-2" rx="5" ry="5" fill="#2a2420" />
					<ellipse cx="5" cy="-2" rx="5" ry="5" fill="#2a2420" />
					<ellipse cx="-4" cy="2" rx="2.6" ry="2.2" fill="#d8472a" />
					<ellipse cx="4" cy="2" rx="2.6" ry="2.2" fill="#d8472a" />
				</g>
				<ellipse cx="0" cy="1" rx="1.4" ry="5.5" fill="#2e2018" />
			</g>

			{/* rabbit hopping across the meadow */}
			<g transform="translate(0 494)">
				<g className="run-across rabbit-run">
					<g className="rabbit-hop">
						<rect x="9" y="23" width="3.5" height="3" fill="#b0987c" />
						<rect x="16" y="23" width="3.5" height="3" fill="#b0987c" />
						<ellipse cx="13" cy="18" rx="9" ry="6.5" fill="#b0987c" />
						<circle cx="20" cy="13" r="6" fill="#b0987c" />
						<ellipse cx="18" cy="5" rx="2" ry="5" fill="#b0987c" />
						<ellipse cx="23" cy="6" rx="2" ry="5" fill="#b0987c" />
						<circle cx="4" cy="19" r="4" fill="#fff" />
						<circle cx="22" cy="12" r="1.4" fill="#2e2018" />
					</g>
				</g>
			</g>

			{/* fox trotting home along the near hill */}
			<g transform="translate(0 524)">
				<g className="run-across fox-run">
					<g transform="scale(-1 1)">
						<g className="fox-trot">
							<rect x="9" y="19" width="3" height="6" fill="#46301f" />
							<rect x="14" y="20" width="3" height="6" fill="#46301f" />
							<rect x="20" y="19" width="3" height="6" fill="#46301f" />
							<ellipse cx="15" cy="16" rx="10" ry="6" fill="#d3722e" />
							<circle cx="25" cy="10" r="6" fill="#d3722e" />
							<path d="M21 3 L24 9 L19 9 Z" fill="#d3722e" />
							<path d="M27 3 L30 9 L25 9 Z" fill="#d3722e" />
							<ellipse cx="6" cy="16" rx="6" ry="4" fill="#d3722e" />
							<circle cx="3" cy="15" r="3" fill="#fff" />
							<ellipse cx="24" cy="13" rx="3" ry="2" fill="#fff" />
							<circle cx="27" cy="9" r="1.3" fill="#2e2018" />
							<circle cx="30" cy="11" r="1.4" fill="#2e2018" />
						</g>
					</g>
				</g>
			</g>

			{/* swaying grass tufts on the near hill */}
			{[80, 320, 410, 600, 690, 930].map((x, i) => (
				<g key={i} transform={`translate(${x} ${530 + (i % 2) * 10})`}>
					<path
						className={`grass gr${i % 3}`}
						d="M0 0 q-3 -12 -6 -16 M0 0 q0 -14 1 -18 M0 0 q4 -11 7 -15"
						stroke="#4a6b3a"
						strokeWidth="2.4"
						fill="none"
						strokeLinecap="round"
					/>
				</g>
			))}

			{/* fireflies */}
			{[160, 240, 330, 420, 500, 580, 650, 730, 780, 900].map((x, i) => (
				<circle key={i} className={`firefly f${i % 4}`} cx={x} cy={430 + ((i * 37) % 90)} r="2.6" fill="#ffe9a8" />
			))}
		</svg>
	);
}

export function WelcomeScreen() {
	const { data, dataError, demoBackend, startNew, startNewCoop, startLogin, continueLast, startNewSolo, loadSoloSlot } =
		useGame();
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

	// Local (no-passcode, save-slot) title flow: the desktop build always, and the
	// itch demo when its Harper probe failed and it fell back to the offline solo
	// backend.
	const soloLocal = (IS_DESKTOP || (DEMO && demoBackend === 'solo')) && !coop;
	// Demo playing against Harper: passwordless too (the passcode is auto-minted),
	// but saves live on the server. New Game only asks for a name + look.
	const demoHarper = DEMO && demoBackend === 'harper' && !coop;
	// Whether the passcode field/gate applies at all for this title flow.
	const needsPasscode = !soloLocal && !demoHarper;
	const [slots, setSlots] = useState<SaveMeta[] | null>(null);
	const refreshSlots = () => {
		if (soloLocal)
			listSoloSaves()
				.then(setSlots)
				.catch(() => setSlots([]));
	};
	useEffect(() => {
		refreshSlots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
	}, [soloLocal]);
	const recentSlot = soloLocal ? (slots?.[0] ?? null) : null;

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
	useEffect(() => {
		if (IS_DESKTOP) setTransport(coop ? 'coop' : 'solo');
	}, [coop]);

	const [appearance, setAppearance] = useState<Appearance>({
		skin: '#eec39a',
		hair: '#6e4a33',
		outfit: '#4a7c59',
		hat: 'none',
		hairstyle: 'short',
		beard: 'none',
		body: 'slim',
	});

	// How long the player spends in the character creator — measured from when the
	// creator opens to when they submit, and reported with the new save so the
	// metrics dashboard can show average time-in-creation and the choices made.
	const creationStartRef = useRef<number>(0);
	useEffect(() => {
		if (mode === 'new') creationStartRef.current = Date.now();
	}, [mode]);

	// Roll a fresh starting look each time the creator opens, so New Game doesn't
	// always present the same character. Guarded by a ref because appearanceOptions
	// arrives asynchronously — we want exactly one roll per visit, not one per
	// render, and re-rolling after the player has started tweaking would be rude.
	const rolledRef = useRef(false);
	useEffect(() => {
		if (mode !== 'new') {
			rolledRef.current = false;
			return;
		}
		if (rolledRef.current || !data?.appearanceOptions) return;
		rolledRef.current = true;
		setAppearance((a) => randomStartingAppearance(data.appearanceOptions, a));
	}, [mode, data?.appearanceOptions]);
	const creatorMs = () => (creationStartRef.current ? Date.now() - creationStartRef.current : 0);

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
				// Same rule as continueLast: only forget the save when the server said
				// it doesn't exist. A transient failure used to wipe the Continue button,
				// which read to players as "my save was deleted" — they had no way back
				// to a save that was still sitting there perfectly intact.
				if (isMissingSaveError(e)) {
					forgetSave(coop ? 'coop' : 'solo');
					setLastBump((n) => n + 1);
					setMode('load');
				}
				throw new Error(t('app.welcome.continueFailed', { message: e.message || t('app.error.loadSave') }));
			}
		});

	return (
		<div className="welcome">
			<div className="welcome-sky" />
			<Scenery />
			<div className="welcome-stack">
				<h1 className="game-title welcome-title">{t('app.title')}</h1>
				<div className={`welcome-card${mode === 'new' ? ' welcome-card-wide' : ''}`}>
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
							onChange={(e) => {
								const f = e.target.files?.[0];
								e.target.value = '';
								void onImportFile(f);
							}}
						/>
					)}

					{dataError && (
						<p className="form-error">
							<Icon name="help" size={16} /> {dataError}
						</p>
					)}

					{/* This device HAS a demo save, on the hosted server, and we couldn't
					    reach it this session. Say so plainly. Silently showing an empty
					    title here is what made players think their save was deleted —
					    they'd start a new one and lose the old for good. */}
					{isDemoSaveUnreachable() && (
						<p className="form-error">
							<Icon name="cloud" size={16} /> {t('app.welcome.demoSaveUnreachable')}
						</p>
					)}

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
										{coop ? t('app.welcome.coopHint') : t('app.welcome.soloHint')}
									</p>
								</>
							)}
							{soloLocal && recentSlot && (
								<button
									className="big-btn primary"
									disabled={busy || !data}
									onClick={() => run(() => loadSoloSlot(recentSlot.slotId))}
								>
									<Icon name="play" />{' '}
									<span>
										{busy ? t('app.welcome.loadingSave') : t('app.welcome.continueAs', { name: recentSlot.name })}
									</span>
								</button>
							)}
							{!soloLocal && last && (
								<button className="big-btn primary" disabled={busy || !data} onClick={onContinue}>
									<Icon name="play" />{' '}
									<span>{busy ? t('app.welcome.loadingSave') : t('app.welcome.continueAs', { name: last.name })}</span>
								</button>
							)}
							{coop ? (
								<>
									<button
										className={`big-btn ${last ? '' : 'primary'}`}
										disabled={busy || !data}
										onClick={() => {
											setCoopKind('host');
											setError(null);
											setMode('new');
										}}
									>
										<Icon name="plus" /> <span>{t('app.welcome.hostNew')}</span>
									</button>
									<button
										className="big-btn"
										disabled={busy || !data}
										onClick={() => {
											setCoopKind('join');
											setError(null);
											setJoinCtx(null);
											setMode('join-code');
										}}
									>
										<Icon name="user" /> <span>{t('app.welcome.joinWithCode')}</span>
									</button>
									<button
										className="big-btn"
										disabled={busy || !data}
										onClick={() => {
											setError(null);
											setMode('load');
										}}
									>
										<Icon name="folder" /> <span>{t('app.welcome.loadCoopSave')}</span>
									</button>
								</>
							) : (
								<>
									<button
										className={`big-btn ${(soloLocal ? recentSlot : last) ? '' : 'primary'}`}
										disabled={busy || !data}
										onClick={() => {
											setError(null);
											setMode('new');
										}}
									>
										<Icon name="plus" /> <span>{t('app.welcome.newGame')}</span>
									</button>
									{/* No manual Load in the demo: saves are passwordless + throwaway,
									    so "Continue" (remembered on this device) is all that's needed. */}
									{!DEMO && (
										<button
											className="big-btn"
											disabled={busy || !data}
											onClick={() => {
												setError(null);
												refreshSlots();
												setMode('load');
											}}
										>
											<Icon name="folder" /> <span>{t('app.welcome.loadGame')}</span>
										</button>
									)}
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
									setJoinCtx({
										code,
										token,
										worldId: chk.world.worldId,
										worldName: chk.world.name,
										hostName: chk.world.hostName,
									});
									setMode('new');
								});
							}}
						>
							<p className="muted small mode-hint">{t('app.welcome.joinHint')}</p>
							<label className="field">
								<Icon name="user" size={17} />
								<input
									placeholder={t('app.welcome.yourNamePlaceholder')}
									value={name}
									maxLength={24}
									onChange={(e) => setName(e.target.value)}
									autoFocus
								/>
							</label>
							<label className="field">
								<Icon name="leaf" size={17} />
								<input
									placeholder={t('app.welcome.joinCodePlaceholder')}
									value={joinCode}
									maxLength={6}
									style={{ textTransform: 'uppercase' }}
									onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
								/>
							</label>
							{error && <p className="form-error">{error}</p>}
							<div className="form-actions">
								<button type="button" className="big-btn subtle" onClick={() => setMode('menu')}>
									<Icon name="back" /> <span>{t('app.common.back')}</span>
								</button>
								<button
									type="submit"
									className="big-btn primary"
									disabled={busy || name.trim().length < 2 || joinCode.trim().length < 4}
								>
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
								const creationMs = creatorMs();
								if (soloLocal) run(() => startNewSolo(name, appearance, creationMs));
								else if (demoHarper) run(() => startNew(name, genDemoPasscode(), appearance, creationMs));
								else if (!coop) run(() => startNew(name, passcode, appearance, creationMs));
								else if (coopKind === 'host')
									run(() => startNewCoop(name, passcode, appearance, { mode: 'host', creationMs }));
								else if (joinCtx)
									run(() =>
										startNewCoop(name, passcode, appearance, {
											mode: 'join',
											code: joinCtx.code,
											token: joinCtx.token,
											joinWorldId: joinCtx.worldId,
											worldName: joinCtx.worldName,
											hostName: joinCtx.hostName,
											creationMs,
										}),
									);
							}}
						>
							{COOP_ENABLED && (
								<div className="mode-banner">
									<Icon name={coop ? 'user' : 'leaf'} size={15} />{' '}
									{coop
										? coopKind === 'host'
											? t('app.welcome.hostBanner')
											: t('app.welcome.joiningBanner', { name: joinCtx?.worldName || t('app.welcome.aPreserve') })
										: t('app.welcome.newSoloBanner')}
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
											onClick={(e) => {
												e.preventDefault();
												setAppearance(randomizeAppearance(data?.appearanceOptions, appearance));
												setName(randomName(name));
											}}
											title={t('app.welcome.randomize')}
											aria-label={t('app.welcome.randomize')}
										>
											<Icon name="dice" size={16} />
										</button>
									</label>
									{needsPasscode && (
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
								<button
									type="submit"
									className="big-btn primary"
									disabled={busy || name.trim().length < 2 || (needsPasscode && passcode.length < 4)}
								>
									<Icon name="leaf" />{' '}
									<span>
										{busy
											? t('app.welcome.settlingIn')
											: !coop
												? t('app.welcome.beginRestoring')
												: coopKind === 'join'
													? t('app.welcome.createAndJoin')
													: t('app.welcome.startCoop')}
									</span>
								</button>
							</div>
						</form>
					)}

					{mode === 'load' && soloLocal && (
						<div className="creator">
							<p className="muted small mode-hint">{t('app.welcome.loadHint')}</p>
							{notice && (
								<p className="form-notice">
									<Icon name="check" size={14} /> {notice}
								</p>
							)}
							<div className="save-slots">
								{(slots || []).length === 0 && <p className="muted small">{t('app.welcome.noSaves')}</p>}
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
													{new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
													{new Date(s.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
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
								<button
									type="button"
									className="big-btn subtle"
									disabled={busy}
									onClick={() => {
										fileRef.current?.click();
										setError(null);
										setNotice(null);
									}}
								>
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
								<input
									placeholder={t('app.welcome.namePlaceholder')}
									value={name}
									onChange={(e) => setName(e.target.value)}
									autoFocus
								/>
							</label>
							<label className="field">
								<Icon name="lock" size={17} />
								<input
									placeholder={t('app.welcome.passcodePlaceholder')}
									type="password"
									value={passcode}
									onChange={(e) => setPasscode(e.target.value)}
								/>
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
				<p className="welcome-credits-footer">
					<span className="credit-entry">
						<Icon name="code" size={12} /> {t('app.welcome.creditDev')} Bailey Dunning
					</span>
					<span className="credit-dot" aria-hidden="true">
						·
					</span>
					<span className="credit-entry">
						<Icon name="note" size={12} /> {t('app.welcome.creditAudio')} Jon Licht
					</span>
				</p>
			</div>

			{introOpen && (
				<div className="panel-backdrop help-backdrop" onClick={() => setIntroOpen(false)}>
					<div
						className="panel welcome-intro"
						role="dialog"
						aria-modal="true"
						aria-label={t('app.welcome.intro.title')}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="panel-head">
							<h2>
								<Icon name="leaf" size={18} /> {t('app.welcome.intro.title')}
							</h2>
							<button className="icon-btn" onClick={() => setIntroOpen(false)} aria-label={t('panels.common.close')}>
								<Icon name="close" />
							</button>
						</div>
						<div className="panel-body">
							<p className="welcome-intro-lede">{t('app.welcome.intro.lede')}</p>
							<div className="welcome-intro-steps">
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon">
										<Icon name="basket" size={22} />
									</span>
									<div>
										<b>{t('app.welcome.intro.gatherTitle')}</b>
										<p>{t('app.welcome.intro.gatherText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon">
										<Icon name="hammer" size={22} />
									</span>
									<div>
										<b>{t('app.welcome.intro.craftTitle')}</b>
										<p>{t('app.welcome.intro.craftText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon">
										<Icon name="paw" size={22} />
									</span>
									<div>
										<b>{t('app.welcome.intro.welcomeTitle')}</b>
										<p>{t('app.welcome.intro.welcomeText')}</p>
									</div>
								</div>
								<div className="welcome-intro-step">
									<span className="welcome-intro-icon">
										<Icon name="map" size={22} />
									</span>
									<div>
										<b>{t('app.welcome.intro.unlockTitle')}</b>
										<p>{t('app.welcome.intro.unlockText')}</p>
									</div>
								</div>
							</div>
							<p className="welcome-intro-reassure">
								<Icon name="sparkle" size={15} /> {t('app.welcome.intro.reassure')}
							</p>
							<div className="form-actions end">
								<button
									className="big-btn primary"
									style={{ width: 'auto', marginTop: 0 }}
									onClick={() => setIntroOpen(false)}
								>
									<Icon name="check" size={15} /> <span>{t('app.welcome.intro.gotIt')}</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{settingsOpen && (
				<div className="panel-backdrop help-backdrop" onClick={() => setSettingsOpen(false)}>
					<div
						className="panel lang-panel"
						role="dialog"
						aria-modal="true"
						aria-label={t('app.settings.title')}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="panel-head">
							<h2>
								<Icon name="gear" size={18} /> {t('app.settings.title')}
							</h2>
							<button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label={t('panels.common.close')}>
								<Icon name="close" />
							</button>
						</div>
						<div className="panel-body settings-body">
							<h3>
								<Icon name="globe" size={15} /> {t('app.settings.language')}
							</h3>
							<div className="craft-filter lang-filter">
								<label htmlFor="welcome-language">{t('app.settings.language')}:</label>
								<select id="welcome-language" value={locale} onChange={(e) => void chooseLocale(e.target.value)}>
									{Object.entries(LOCALE_NAMES).map(([code, name]) => (
										<option key={code} value={code}>
											{name}
										</option>
									))}
								</select>
							</div>
							<h3>
								<Icon name="note" size={15} /> {t('app.settings.sound')}
							</h3>
							<SoundControls />
							<h3>
								<Icon name="sliders" size={15} /> {t('app.settings.accessibility')}
							</h3>
							<AccessibilityControls />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

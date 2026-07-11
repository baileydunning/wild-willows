import { useEffect, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { COOP_ENABLED } from '../features';
import { homePerkStrength } from '../types';
import { weatherType, seasonStyle, liveSeason, liveWeatherType, liveDayPhase, dayPhaseStyle, phaseAtProgress } from '../weather';
import { Icon } from './icons';
import { TasksWidget } from './TasksWidget';

export function Meter({ label, icon, value, color, hint }: { label: string; icon: string; value: number; color: string; hint?: string }) {
	return (
		<div className="meter">
			<span className="meter-icon" style={{ color }}><Icon name={icon} size={15} /></span>
			<span className="meter-label">{label}</span>
			<div className="meter-track">
				<div className="meter-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
			</div>
			<span className="meter-value">{value}%</span>
			{hint && (
				<span className="meter-hint" tabIndex={0} role="note" aria-label={hint}>
					<Icon name="help" size={12} />
					<span className="meter-hint-tip" role="tooltip">{hint}</span>
				</span>
			)}
		</div>
	);
}

/**
 * A gentle day clock for the biome card: the preserve cycles a full 24-hour day
 * in about 24 real minutes, so one in-game hour passes each real minute. We show
 * the whole-hour time (e.g. 14:00) and step the bar by the hour — so it advances
 * calmly once a minute and never jitters as the underlying clock is re-estimated.
 */
function DayTimer() {
	const { state } = useGame();
	const { t } = useI18n();
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = window.setInterval(() => setTick((n) => n + 1), 5000);
		return () => window.clearInterval(id);
	}, []);
	const snap = state?.weather;
	const dayMs = snap?.dayMs || 24 * 60 * 1000;
	// Free-running wall-clock anchor. The shared liveTime() yanks back to the
	// snapshot every few seconds, which (in solo, where the snapshot rarely
	// refreshes) leaves the clock stuck — so we keep our own anchor here and
	// re-sync it only when the server's day actually moves.
	const anchor = useRef<{ base: number; wall: number } | null>(null);
	const dayIndex = snap?.dayIndex, dayProgress = snap?.dayProgress;
	useEffect(() => {
		if (dayIndex == null || dayProgress == null) return;
		anchor.current = { base: (dayIndex + dayProgress) * dayMs, wall: Date.now() };
	}, [dayIndex, dayProgress, dayMs]);
	if (!snap || !anchor.current) return null;
	const now = anchor.current.base + (Date.now() - anchor.current.wall);
	const progress = ((now % dayMs) + dayMs) % dayMs / dayMs;
	const hour = Math.floor(progress * 24) % 24; // whole in-game hour, 0–23
	// Star vs sun follows the real night band (data/weather.json), keyed off the
	// displayed hour so the knob icon matches both the clock and the weather chip.
	const night = phaseAtProgress(hour / 24) === 'night';
	const clock = `${String(hour).padStart(2, '0')}:00`;
	const pct = (hour / 24) * 100; // stepped — moves once per in-game hour
	return (
		<div className="hud-daytimer" title={t('app.hud.dayTimerTitle')}>
			<div className={`daytimer-track ${night ? 'night' : ''}`}>
				<div className="daytimer-fill" style={{ width: `${pct}%` }} />
				<span className="daytimer-knob" style={{ left: `${pct}%` }}><Icon name={night ? 'star' : 'sun'} size={10} /></span>
			</div>
			<span className="daytimer-label">{clock}</span>
		</div>
	);
}

export function HUD() {
	const { data, state, saveStatus, panel, setPanel, helpOpen, setHelpOpen, logout, placementObjectId, cancelPlacement, worlds, activeWorldId } = useGame();
	const { t, content } = useI18n();
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
	const homeName = homeBuilt ? (data.homeStyles?.[home!.style]?.name || t('app.hud.yourHome')) : t('app.hud.canvasTent');
	const homeCarry = data.homeTracks?.comfort?.levels?.[((home?.comfort) || 1) - 1]?.carry || 0;
	const homeDecor = state.placements.filter((p) => p.area === 'home').length;
	// The house perk (and its current strength) + every upgrade track level, so
	// the Your Home card shows all the buffs and upgrades you've earned.
	const homeStyleDef = homeBuilt ? data.homeStyles?.[home!.style] : undefined;
	const homePerk = homeStyleDef?.perk;
	const homePerkStr = homePerk && home ? homePerkStrength(homePerk, home) : 0;
	const homeTrackDefs: Record<string, any> = data.homeTracks || {};
	const HOME_TRACK_ORDER = ['space', 'comfort', 'decor', 'light'];

	const activeWorld = worlds.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const peersHere = bridge.shared.presence?.length || 0;

	// Progressive disclosure: keep the first-run screen calm by revealing toolbar
	// buttons as they become relevant, instead of dumping every cluster at once.
	// A button shows once EITHER the tutorial has reached the step that teaches it
	// OR the player has organically done the thing — so nothing ever stays stuck
	// hidden if someone ignores, skips, or closes the tutorial (skipping/closing
	// jumps tutorialStep to DONE, and free-play trips the organic signals anyway).
	// Old/finished saves (no tutorialStep) default to "done" → everything shows.
	// Use the FURTHEST step ever reached (tutorialMaxStep), never the live step:
	// replaying the tutorial from Help rewinds tutorialStep to 0, and keying off
	// the live value would re-hide menu buttons the player already unlocked.
	const tutStep = Math.max(state.player.tutorialMaxStep ?? 0, state.player.tutorialStep ?? 99);
	// Co-op prepends 1–2 intro steps, so the base-arc thresholds shift accordingly.
	const stepOffset = isCoop ? (activeWorld?.isOwner ? 2 : 1) : 0;
	const taught = (baseStep: number) => tutStep >= baseStep + stepOffset;
	const gathered = (state.nodeStates?.length || 0) > 0 || Object.keys(state.player.inventory || {}).length > 0;
	const crafted = Object.keys(state.player.craftedEver || state.player.craftedItems || {}).length > 0;
	const discovered = (state.discoveries?.length || 0) > 0;
	const moreBiomes = (state.player.unlockedBiomes?.length || 0) > 1 || (state.player.visitedBiomes?.length || 0) > 1;
	const show = {
		feed: taught(1) || (state.feed?.length || 0) > 0,
		journal: taught(7) || discovered,
		achievements: taught(16) || state.achievements.length > 0,
		inventory: taught(1) || gathered || crafted,
		crafting: taught(12) || gathered || crafted,
		tools: taught(8) || crafted || moreBiomes,
		biomes: taught(9) || moreBiomes,
		weather: taught(10) || moreBiomes,
	};

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
						<div className="hud-area-name"><Icon name="home" size={17} /> {t('app.hud.yourHome')}</div>
						<div className="hud-returned"><Icon name="sparkle" size={13} /> {homeName}{homeCarry > 0 ? t('app.hud.carrySuffix', { count: homeCarry }) : ''}</div>
						<div className="hud-returned hud-returned-total"><Icon name="leaf" size={12} /> {t('app.hud.thingsPlaced', { count: homeDecor })}</div>
						{homeBuilt && homePerk && (
							<div className="hud-home-perk" title={t(`panels.home.perkBlurb.${homePerk.id}`, { pct: Math.round(homePerkStr * 100) })}>
								<Icon name="sparkle" size={12} /> {t(`panels.home.perkName.${homePerk.id}`)} · {Math.round(homePerkStr * 100)}%
							</div>
						)}
						{homeBuilt && (
							<div className="hud-home-tracks">
								{HOME_TRACK_ORDER.filter((k) => homeTrackDefs[k]).map((k) => (
									<span key={k} className="hud-home-track" title={homeTrackDefs[k].name}>
										{homeTrackDefs[k].name} {t('app.hud.trackLevel', { level: (home as any)?.[k] || 1 })}
									</span>
								))}
							</div>
						)}
					</>
				) : (
					<>
						<div className="hud-area-name">
							<Icon name="leaf" size={17} /> {biome ? content('biome', biome.id, 'name', biome.name) : t('app.hud.thePreserve')}
							{isCoop && (
								<button className="coop-badge" onClick={() => setPanel('people')} title={t('app.hud.coopBadgeTitle')}>
									<Icon name="user" size={12} /> {t('app.hud.coop')}{peersHere > 0 ? t('app.hud.hereCount', { count: peersHere + 1 }) : ''}
								</button>
							)}
						</div>
						{state.weather && (() => {
							const snap = state.weather;
							const worldId = (state as any).worldId || state.player.id;
							const wtId = liveWeatherType(worldId, area, snap);
							const wt = weatherType(wtId);
							const wtName = content('weather', wtId, 'name', wt.name);
							const seasonId = liveSeason(snap);
							const ss = seasonStyle(seasonId);
							// Season/day-phase labels are data content (data/weather.json); overlay
							// keys nest under weather.season.* / weather.dayPhase.* per the template.
							const ssLabel = content('weather', `season.${seasonId}`, 'label', ss.label);
							const phase = liveDayPhase(snap);
							const ps = dayPhaseStyle(phase);
							const psLabel = content('weather', `dayPhase.${phase}`, 'label', ps.label);
							const phaseAccent: Record<string, string> = { dawn: '#e0913f', day: '#d9a13a', dusk: '#c96a3a', night: '#6274b4' };
							const pAccent = phaseAccent[phase] || '#d9a13a';
							const pIcon = phase === 'night' ? 'star' : 'sun';
							return (
								<div className="hud-weather" title={`${wtName} · ${ssLabel} · ${psLabel}`}>
									<Icon name={wt.icon} size={13} /> {wtName}
									<span className="hud-dayphase" style={{ color: pAccent, borderColor: pAccent }}><Icon name={pIcon} size={11} /> {psLabel}</span>
									<span className="hud-season" style={{ color: ss.accent, borderColor: ss.accent }}>{ssLabel}</span>
								</div>
							);
						})()}
						{state.weather && area !== 'home' && <DayTimer />}
						{biome && bState && (
							<>
								<Meter label={t('app.hud.health')} icon="leaf" value={bState.health} color="#6aa253" hint={t('app.hud.healthHint')} />
								<Meter label={t('app.hud.balance')} icon="scales" value={bState.balance} color="#5b9cab" hint={t('app.hud.balanceHint')} />
								<div className="hud-returned">
									<Icon name="paw" size={14} /> {t('app.hud.animalsReturned', { returned: bState.returnedCount, total: totalAnimals })}
								</div>
								<div className="hud-returned hud-returned-total">
									<Icon name="paw" size={12} /> {t('app.hud.acrossPreserve', { returned: returnedAll, total: allAnimals })}
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
					title={navOpen ? t('app.hud.hideMenu') : t('app.hud.showMenu')}
					aria-label={navOpen ? t('app.hud.hideMenu') : t('app.hud.showMenu')}
					aria-expanded={navOpen}
				>
					<Icon name={navOpen ? 'forward' : 'back'} />
				</button>
				{/* A save only surfaces if it FAILS — no persistent "Synced" chip. */}
				{saveStatus === 'error' && (
					<span className="save-pill save-error" title={t('app.hud.saveRetryTitle')}>
						<Icon name="cloud" size={15} />
						<span>{t('app.hud.retry')}</span>
					</span>
				)}
				{navOpen && (<>
				{/* Buttons are grouped by purpose so the toolbar reads as a few small
				    clusters rather than one long row: Learn (what you've discovered),
				    Build (your stuff & upgrades), World (places & people), System. */}
				<div className="nav-group" role="group" aria-label={t('app.hud.groupLearn')}>
					<span className="nav-group-label">{t('app.hud.groupLearn')}</span>
					<div className="nav-group-btns">
						{show.journal && navBtn('journal', 'journal', t('app.hud.navJournal'), 'J')}
						{show.achievements && navBtn('achievements', 'star', t('app.hud.navAchievements'), 'K')}
						{show.feed && navBtn('feed', 'chat', t('app.hud.navFeed'), 'F')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label={t('app.hud.groupBuild')}>
					<span className="nav-group-label">{t('app.hud.groupBuild')}</span>
					<div className="nav-group-btns">
						{show.inventory && navBtn('inventory', 'basket', t('app.hud.navInventory'), 'B')}
						{show.crafting && navBtn('crafting', 'hammer', t('app.hud.navCrafting'), 'C')}
						{show.tools && navBtn('tools', 'tools', t('app.hud.navTools'), 'T')}
						{navBtn('goals', 'target', t('app.hud.navGoals'), 'G')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label={t('app.hud.groupWorld')}>
					<span className="nav-group-label">{t('app.hud.groupWorld')}</span>
					<div className="nav-group-btns">
						{show.biomes && navBtn('biomes', 'map', t('app.hud.navBiomes'), 'M')}
						{show.weather && navBtn('weather', 'cloud', t('app.hud.navWeather'), 'N')}
						{isCoop && navBtn('people', 'user', t('app.hud.navPeople'), 'U')}
					</div>
				</div>
				<div className="nav-group nav-group-system" role="group" aria-label={t('app.hud.groupSystem')}>
					<span className="nav-group-label">{t('app.hud.groupSystem')}</span>
					<div className="nav-group-btns">
						<button className={`icon-btn ${panel === 'settings' ? 'on' : ''}`} onClick={() => toggle('settings')} title={t('app.hud.settingsTitle')} aria-label={t('app.hud.settings')}>
							<Icon name="gear" />
							<span className="nav-key">O</span>
						</button>
						<button className={`icon-btn ${helpOpen ? 'on' : ''}`} onClick={() => setHelpOpen(!helpOpen)} title={t('app.hud.howToPlayTitle')} aria-label={t('app.hud.howToPlay')}>
							<Icon name="help" />
							<span className="nav-key">H</span>
						</button>
						<button className="icon-btn subtle" onClick={logout} title={t('app.hud.saveQuitTitle', { name: state.player.name })} aria-label={t('app.hud.saveQuit')}>
							<Icon name="logout" />
						</button>
					</div>
				</div>
				</>)}
			</div>

			{(placementObjectId || prompt) && (
				<div className={`hud-bottom ${placementObjectId ? 'placing' : ''}`}>
					{placementObjectId ? (
						<span className="prompt-line">
							<Icon name="pin" size={15} />
							{t('app.hud.placing')} <b>{content('habitatObject', placementObjectId, 'name', data.habitatObjects.find((o) => o.id === placementObjectId)?.name || '')}</b> {t('app.hud.placingHint')}
							<button className="link" onClick={cancelPlacement}>{t('app.hud.stopPlacing')}</button>
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
	const { t } = useI18n();
	const iconFor = { animal: 'paw', unlock: 'sparkle', error: 'help', info: 'leaf', achievement: 'star' } as const;
	return (
		<div className="toasts">
			{toasts.map((toast) => (
				<div key={toast.id} className={`toast toast-${toast.kind}`}>
					<Icon name={iconFor[toast.kind] || 'leaf'} size={17} />
					<span>{toast.text}</span>
					<button
						className="toast-close"
						onClick={() => dismissToast(toast.id)}
						title={t('app.common.dismiss')}
						aria-label={t('app.common.dismissMessage')}
					>
						<Icon name="close" size={13} />
					</button>
				</div>
			))}
		</div>
	);
}

import { useEffect, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { COOP_ENABLED } from '../features';
import { weatherType, seasonStyle, liveSeason, liveWeatherType, liveDayPhase, dayPhaseStyle } from '../weather';
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
						<div className="hud-area-name"><Icon name="home" size={17} /> {t('app.hud.yourHome')}</div>
						<div className="hud-returned"><Icon name="sparkle" size={13} /> {homeName}{homeCarry > 0 ? t('app.hud.carrySuffix', { count: homeCarry }) : ''}</div>
						<div className="hud-returned hud-returned-total"><Icon name="leaf" size={12} /> {t('app.hud.thingsPlaced', { count: homeDecor })}</div>
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
						{biome && bState && (
							<>
								<Meter label={t('app.hud.health')} icon="leaf" value={bState.health} color="#6aa253" />
								<Meter label={t('app.hud.balance')} icon="scales" value={bState.balance} color="#5b9cab" />
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
						{navBtn('journal', 'journal', t('app.hud.navJournal'), 'J')}
						{navBtn('achievements', 'star', t('app.hud.navAchievements'), 'K')}
						{navBtn('feed', 'chat', t('app.hud.navFeed'), 'F')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label={t('app.hud.groupBuild')}>
					<span className="nav-group-label">{t('app.hud.groupBuild')}</span>
					<div className="nav-group-btns">
						{navBtn('inventory', 'basket', t('app.hud.navInventory'), 'B')}
						{navBtn('crafting', 'hammer', t('app.hud.navCrafting'), 'C')}
						{navBtn('tools', 'tools', t('app.hud.navTools'), 'T')}
					</div>
				</div>
				<div className="nav-group" role="group" aria-label={t('app.hud.groupWorld')}>
					<span className="nav-group-label">{t('app.hud.groupWorld')}</span>
					<div className="nav-group-btns">
						{navBtn('biomes', 'map', t('app.hud.navBiomes'), 'P')}
						{navBtn('weather', 'cloud', t('app.hud.navWeather'), 'M')}
						{isCoop && navBtn('people', 'user', t('app.hud.navPeople'), 'U')}
					</div>
				</div>
				<div className="nav-group nav-group-system" role="group" aria-label={t('app.hud.groupSystem')}>
					<span className="nav-group-label">{t('app.hud.groupSystem')}</span>
					<div className="nav-group-btns">
						<button className={`icon-btn ${panel === 'settings' ? 'on' : ''}`} onClick={() => toggle('settings')} title={t('app.hud.settingsTitle')} aria-label={t('app.hud.settings')}>
							<Icon name="sliders" />
							<span className="nav-key">G</span>
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
				<div className="hud-bottom">
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

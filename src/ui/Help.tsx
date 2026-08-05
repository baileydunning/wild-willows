import { useGame } from '../state';
import { COOP_ENABLED } from '../features';
import { DEMO } from '../demo';
import { useI18n } from '../i18n/react';
import { visibleShortcuts, shortcutKeys } from '../shortcuts';
import { usePrefs } from '../prefs';
import { savedTutorialPos } from './Tutorial';
import { Icon } from './icons';

// Step copy lives in the panels.help.loop.* catalog keys.
const STEPS: Array<{ icon: string; key: string }> = [
	{ icon: 'basket', key: 'gather' },
	{ icon: 'chest', key: 'store' },
	{ icon: 'hammer', key: 'craft' },
	{ icon: 'pin', key: 'rebuild' },
	{ icon: 'paw', key: 'welcome' },
	{ icon: 'journal', key: 'record' },
	{ icon: 'cloud', key: 'weather' },
	{ icon: 'check', key: 'board' },
];

// The things players kept missing in playtests, gathered in one place. Copy lives
// in panels.help.more.* — the same lessons the contextual tips deliver in-game.
const MORE: Array<{ icon: string; key: string }> = [
	{ icon: 'paw', key: 'animals' },
	{ icon: 'home', key: 'home' },
	{ icon: 'tools', key: 'tools' },
	{ icon: 'spade', key: 'land' },
];

export function HelpModal() {
	const { helpOpen, setHelpOpen, setTutorialStep, state, worlds, activeWorldId } = useGame();
	const { t } = useI18n();
	usePrefs(); // reflect live key bindings
	if (!helpOpen) return null;
	// In solo play there's no People/invite system, so drop those keys entirely.
	const activeWorld = worlds?.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const keys = visibleShortcuts(isCoop);
	const replay = () => {
		// Resume where the player last left the tutorial (0 if they finished it or
		// never opened it) so reopening it from Help picks up where they closed it.
		setTutorialStep(savedTutorialPos());
		setHelpOpen(false);
	};
	return (
		<div className="panel-backdrop help-backdrop" onClick={() => setHelpOpen(false)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="help" size={20} /> {t('panels.help.title')}
					</h2>
					<div className="help-head-actions">
						{state && (
							<button className="help-replay-btn" onClick={replay} title={t('panels.help.replayTitle')}>
								<Icon name="play" size={14} /> {t('panels.help.replay')}
							</button>
						)}
						<button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label={t('panels.common.close')}>
							<Icon name="close" />
						</button>
					</div>
				</div>
				<div className="panel-body">
					<p className="help-intro">{t('panels.help.intro')}</p>
					{DEMO && (
						<div className="help-demo-note">
							<Icon name="sparkle" size={15} /> {t('panels.help.demoNote')}
						</div>
					)}
					<div className="help-section-label">
						<Icon name="leaf" size={15} /> {t('panels.help.loopLabel')}
					</div>
					<div className="help-steps">
						{STEPS.map((s, i) => (
							<div className="help-step" key={s.key}>
								<div className="help-step-icon">
									<Icon name={s.icon} size={22} />
									<span className="step-num">{i + 1}</span>
								</div>
								<div>
									<b>{t(`panels.help.loop.${s.key}.title`)}</b>
									<p>{t(`panels.help.loop.${s.key}.text`)}</p>
								</div>
							</div>
						))}
					</div>
					<div className="help-section-label">
						<Icon name="star" size={15} /> {t('panels.help.moreLabel')}
					</div>
					<div className="help-steps">
						{MORE.map((s) => (
							<div className="help-step" key={s.key}>
								<div className="help-step-icon">
									<Icon name={s.icon} size={22} />
								</div>
								<div>
									<b>{t(`panels.help.more.${s.key}.title`)}</b>
									<p>{t(`panels.help.more.${s.key}.text`)}</p>
								</div>
							</div>
						))}
					</div>
					<div className="help-section-label">
						<Icon name="keyboard" size={15} /> {t('panels.help.keysLabel')}
					</div>
					<div className="key-list">
						{keys.map((k) => (
							<div className="key-row" key={k.does}>
								<span className="kbds">
									{shortcutKeys(k).map((key) => (
										<kbd key={key}>{key}</kbd>
									))}
								</span>
								<span>{t(k.does)}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

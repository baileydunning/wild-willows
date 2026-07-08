import { useGame } from '../state';
import { COOP_ENABLED } from '../features';
import { useI18n } from '../i18n/react';
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

// The literal key caps stay as-is; only the description is translated.
const KEYS: Array<{ keys: string[]; does: string }> = [
	{ keys: ['W', 'A', 'S', 'D'], does: 'panels.help.keys.move' },
	{ keys: ['E'], does: 'panels.help.keys.interact' },
	{ keys: ['Space'], does: 'panels.help.keys.space' },
	{ keys: ['Click'], does: 'panels.help.keys.click' },
	{ keys: ['Shift', 'Click'], does: 'panels.help.keys.shiftClick' },
	{ keys: ['\\'], does: 'panels.help.keys.rotate' },
	{ keys: ['1', '2', '3', '4'], does: 'panels.help.keys.toolSelect' },
	{ keys: ['C'], does: 'panels.help.keys.crafting' },
	{ keys: ['B'], does: 'panels.help.keys.basket' },
	{ keys: ['J'], does: 'panels.help.keys.journal' },
	{ keys: ['K'], does: 'panels.help.keys.achievements' },
	{ keys: ['O'], does: 'panels.help.keys.tasks' },
	{ keys: ['F'], does: 'panels.help.keys.feed' },
	{ keys: ['T'], does: 'panels.help.keys.tools' },
	{ keys: ['M', 'P'], does: 'panels.help.keys.preserve' },
	{ keys: ['N'], does: 'panels.help.keys.weather' },
	{ keys: ['U'], does: 'panels.help.keys.people' },
	{ keys: ['G'], does: 'panels.help.keys.settings' },
	{ keys: ['H'], does: 'panels.help.keys.help' },
	{ keys: ['+', '−'], does: 'panels.help.keys.zoom' },
	{ keys: ['Esc'], does: 'panels.help.keys.esc' },
];

export function HelpModal() {
	const { helpOpen, setHelpOpen, setTutorialStep, state, worlds, activeWorldId } = useGame();
	const { t } = useI18n();
	if (!helpOpen) return null;
	// In solo play there's no People/invite system, so drop those keys entirely.
	const activeWorld = worlds?.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const keys = KEYS.filter((k) => isCoop || !k.keys.includes('U'));
	const replay = () => {
		setTutorialStep(0); // restart the interactive tutorial from the first step
		setHelpOpen(false);
	};
	return (
		<div className="panel-backdrop help-backdrop" onClick={() => setHelpOpen(false)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="help" size={20} /> {t('panels.help.title')}</h2>
					<div className="help-head-actions">
						{state && (
							<button className="help-replay-btn" onClick={replay} title={t('panels.help.replayTitle')}>
								<Icon name="play" size={14} /> {t('panels.help.replay')}
							</button>
						)}
						<button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
					</div>
				</div>
				<div className="panel-body">
					<p className="help-intro">
						{t('panels.help.intro')}
					</p>
					<div className="help-section-label"><Icon name="leaf" size={15} /> {t('panels.help.loopLabel')}</div>
					<div className="help-steps">
						{STEPS.map((s, i) => (
							<div className="help-step" key={s.key}>
								<div className="help-step-icon"><Icon name={s.icon} size={22} /><span className="step-num">{i + 1}</span></div>
								<div>
									<b>{t(`panels.help.loop.${s.key}.title`)}</b>
									<p>{t(`panels.help.loop.${s.key}.text`)}</p>
								</div>
							</div>
						))}
					</div>
					<div className="help-section-label"><Icon name="keyboard" size={15} /> {t('panels.help.keysLabel')}</div>
					<div className="key-list">
						{keys.map((k) => (
							<div className="key-row" key={k.does}>
								<span className="kbds">
									{k.keys.map((key) => (
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

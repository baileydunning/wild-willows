import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * The one-time hand-off, shown when the last of the ten starter goals is
 * claimed: from here the player writes their own.
 *
 * It exists because the starter chain does its teaching invisibly. Ten goals
 * arrive on their own, one after another, and nothing about that tells a player
 * the board is a tool they can pick up themselves — the toast that used to mark
 * this moment scrolled past in a second, and the goals menu only explains itself
 * to someone who already thought to open it. So the moment the chain ends, the
 * game says what just changed and how to use it, including the two shortcuts
 * (journal entry, crafting recipe) that are otherwise pure discovery.
 *
 * Once, ever. See `goalsUnlockedSeen` in src/state.tsx for the guard.
 */
export function GoalsUnlocked() {
	const { goalsUnlocked, dismissGoalsUnlocked, setPanel } = useGame();
	const { t } = useI18n();
	if (!goalsUnlocked) return null;

	return (
		<div
			className="panel-backdrop goals-unlocked-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="goals-unlocked-title"
		>
			<div className="panel goals-unlocked-card">
				<div className="goals-unlocked-icon">
					<Icon name="target" size={30} />
				</div>
				<h2 id="goals-unlocked-title">{t('app.goalsUnlocked.title')}</h2>
				<p>{t('app.goalsUnlocked.body')}</p>
				<p>{t('app.goalsUnlocked.how')}</p>
				<p className="muted small">{t('app.goalsUnlocked.shortcut')}</p>
				<div className="goals-unlocked-actions">
					<button
						className="big-btn primary"
						onClick={() => {
							dismissGoalsUnlocked();
							setPanel('goals');
						}}
					>
						<Icon name="target" size={15} /> <span>{t('app.goalsUnlocked.openButton')}</span>
					</button>
					<button className="big-btn subtle" onClick={dismissGoalsUnlocked}>
						<span>{t('app.goalsUnlocked.laterButton')}</span>
					</button>
				</div>
			</div>
		</div>
	);
}

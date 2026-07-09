import { useEffect, useState } from 'react';
import { useGame } from '../state';
import { isTypingTarget } from '../typing';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * Today's Tasks — a small on-screen board, not a menu panel. It sits under the
 * top-right nav, collapses to a little pill (O toggles it too), and tidies up
 * after itself: claimed tasks drop off the list, and once everything is
 * claimed the whole board disappears until tomorrow's tasks arrive.
 */
const COLLAPSE_KEY = 'ww-tasks-collapsed';

export function TasksWidget() {
	const { data, state, claimTask, setPanel } = useGame();
	const { t, content } = useI18n();
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
	});
	const toggle = () => {
		setCollapsed((c) => {
			try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* private mode */ }
			return !c;
		});
	};

	// Tab (or O) toggles the board (same input guard as the panel shortcuts).
	// Tab is swallowed here so it doesn't also move browser focus around.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === 'Tab') { e.preventDefault(); toggle(); return; }
			if (e.key.toLowerCase() === 'o') toggle();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	if (!data || !state) return null;
	const tasks = state.dailyTasks?.tasks || [];
	const open = tasks.filter((task) => !task.claimed);
	if (!open.length) return null; // all claimed (or no board) — out of the way until tomorrow

	const doneCount = tasks.filter((task) => task.progress >= task.target).length;
	const claimable = open.some((task) => task.progress >= task.target);
	const resName = (id: string) => {
		const r = data.resources.find((rr) => rr.id === id);
		return r ? content('resource', r.id, 'name', r.name) : id;
	};

	if (collapsed) {
		return (
			<button
				className={`tasks-widget tasks-pill ${claimable ? 'tasks-glow' : ''}`}
				onClick={toggle}
				title={t('panels.tasks.pillTitle')}
				aria-label={t('panels.tasks.pillAria', { done: doneCount, total: tasks.length })}
			>
				<Icon name="check" size={14} /> {doneCount}/{tasks.length}
			</button>
		);
	}

	return (
		<div className="tasks-widget tasks-board">
			<div className="tasks-head">
				<span className="tasks-title"><Icon name="check" size={14} /> {t('panels.tasks.title')}</span>
				<button className="tasks-collapse" onClick={() => setPanel('goals')} title={t('panels.tasks.editTitle')} aria-label={t('panels.tasks.editTitle')}>
					<Icon name="gear" size={13} />
				</button>
				<button className="tasks-collapse" onClick={toggle} title={t('panels.tasks.collapseTitle')} aria-label={t('panels.tasks.collapseAria')}>
					<Icon name="forward" size={13} />
				</button>
			</div>
			{open.map((task) => {
				const done = task.progress >= task.target;
				const rewardTxt = Object.entries(task.reward).map(([id, q]) => t('panels.tasks.rewardItem', { qty: q, name: resName(id) })).join(', ');
				return (
					<div key={task.id} className="tasks-row" title={t('panels.tasks.rewardTitle', { reward: rewardTxt })}>
						<span className="tasks-row-icon"><Icon name={task.icon} size={14} /></span>
						<div className="tasks-row-main">
							<span className="tasks-row-text">
							{task.text}
							{task.hint && (
								<span className="tasks-hint" tabIndex={0} role="note" aria-label={task.hint}>
									<Icon name="help" size={12} />
									<span className="tasks-hint-tip" role="tooltip">{task.hint}</span>
								</span>
							)}
						</span>
							<div className="tasks-row-bar">
								<div className="meter-track">
									<div
										className="meter-fill"
										style={{ width: `${Math.min(100, (task.progress / task.target) * 100)}%`, background: done ? 'var(--green-2, #6aa253)' : '#b89b5e' }}
									/>
								</div>
								<span className="tasks-row-count">{task.progress}/{task.target}</span>
							</div>
						</div>
						{done && (
							<button className="tasks-claim" onClick={() => claimTask(task.id)} title={t('panels.tasks.claimTitle', { reward: rewardTxt })}>
								{t('panels.tasks.claim')}
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}

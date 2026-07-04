import { useEffect, useState } from 'react';
import { useGame } from '../state';
import { isTypingTarget } from '../typing';
import { Icon } from './icons';

/**
 * Today's Tasks — a small on-screen board, not a menu panel. It sits under the
 * top-right nav, collapses to a little pill (O toggles it too), and tidies up
 * after itself: claimed tasks drop off the list, and once everything is
 * claimed the whole board disappears until tomorrow's tasks arrive.
 */
const COLLAPSE_KEY = 'ww-tasks-collapsed';

export function TasksWidget() {
	const { data, state, claimTask } = useGame();
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
	});
	// Which task's how-to hint is expanded (click the ? to toggle). Only one at a time.
	const [openHint, setOpenHint] = useState<string | null>(null);
	const toggle = () => {
		setCollapsed((c) => {
			try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* private mode */ }
			return !c;
		});
	};

	// O toggles the board (same input guard as the panel shortcuts)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;
			if (e.key.toLowerCase() === 'o' && !e.metaKey && !e.ctrlKey && !e.altKey) toggle();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	if (!data || !state) return null;
	const tasks = state.dailyTasks?.tasks || [];
	const open = tasks.filter((t) => !t.claimed);
	if (!open.length) return null; // all claimed (or no board) — out of the way until tomorrow

	const doneCount = tasks.filter((t) => t.progress >= t.target).length;
	const claimable = open.some((t) => t.progress >= t.target);
	const resName = (id: string) => data.resources.find((r) => r.id === id)?.name || id;

	if (collapsed) {
		return (
			<button
				className={`tasks-widget tasks-pill ${claimable ? 'tasks-glow' : ''}`}
				onClick={toggle}
				title="Today's tasks (O)"
				aria-label={`Today's tasks: ${doneCount} of ${tasks.length} done`}
			>
				<Icon name="check" size={14} /> {doneCount}/{tasks.length}
			</button>
		);
	}

	return (
		<div className="tasks-widget tasks-board">
			<div className="tasks-head">
				<span className="tasks-title"><Icon name="check" size={14} /> Today's tasks</span>
				<button className="tasks-collapse" onClick={toggle} title="Tuck away (O)" aria-label="Collapse the task board">
					<Icon name="forward" size={13} />
				</button>
			</div>
			{open.map((t) => {
				const done = t.progress >= t.target;
				const rewardTxt = Object.entries(t.reward).map(([id, q]) => `${q}× ${resName(id)}`).join(', ');
				return (
					<div key={t.id} className="tasks-row" title={`Reward: ${rewardTxt}`}>
						<span className="tasks-row-icon"><Icon name={t.icon} size={14} /></span>
						<div className="tasks-row-main">
							<span className="tasks-row-text">
							{t.text}
							{t.hint && (
								<button
									type="button"
									className="tasks-hint"
									onClick={() => setOpenHint((cur) => (cur === t.id ? null : t.id))}
									aria-label={openHint === t.id ? 'Hide how-to' : 'How to do this'}
									aria-expanded={openHint === t.id}
								>
									<Icon name="help" size={12} />
								</button>
							)}
						</span>
							{t.hint && openHint === t.id && (
								<p className="tasks-hint-text">{t.hint}</p>
							)}
							<div className="tasks-row-bar">
								<div className="meter-track">
									<div
										className="meter-fill"
										style={{ width: `${Math.min(100, (t.progress / t.target) * 100)}%`, background: done ? 'var(--green-2, #6aa253)' : '#b89b5e' }}
									/>
								</div>
								<span className="tasks-row-count">{t.progress}/{t.target}</span>
							</div>
						</div>
						{done && (
							<button className="tasks-claim" onClick={() => claimTask(t.id)} title={`Claim: ${rewardTxt}`}>
								Claim
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}

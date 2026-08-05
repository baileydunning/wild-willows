import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import { BIND_ACTIONS, getBindings, keyLabel } from '../keybindings';
import { usePrefs } from '../prefs';

// `how` is a catalog key (app.toolbelt.how.*), resolved with t() at render time.
export const TOOL_META: Array<{ id: string; icon: string; key: string; how: string }> = [
	{ id: 'basket', icon: 'basket', key: '1', how: 'app.toolbelt.how.basket' },
	{ id: 'shovel', icon: 'spade', key: '2', how: 'app.toolbelt.how.shovel' },
	{ id: 'watering-can', icon: 'can', key: '3', how: 'app.toolbelt.how.watering-can' },
];

const PAINT_PALETTE = [
	'#c8a064',
	'#e6d3a6',
	'#b5895a',
	'#8a6a48',
	'#a9a499',
	'#6f6a62',
	'#b5707a',
	'#7fae6a',
	'#7a9ac0',
	'#e3c75f',
	'#d98a4f',
	'#9e6f9e',
	'#e6e0d2',
	'#3a3a2c',
];

export function Toolbelt() {
	const { data, state, selectedTool, setSelectedTool, notify, paintColor, setPaintColor } = useGame();
	const { t, content } = useI18n();
	usePrefs(); // reflect custom tool-select keys
	// The key cap shown on each tool = its current binding (tool1..tool4).
	const keyForTool = (toolId: string): string => {
		const a = BIND_ACTIONS.find((x) => x.tool === toolId);
		return a ? keyLabel(getBindings()[a.id][0]) : '';
	};
	if (!data || !state) return null;
	// the paint tool only exists indoors, and only once the home is built into a house
	const canPaint = state.player.area === 'home' && !!state.player.home?.styleLocked;

	return (
		<div className="toolbelt-wrap">
			{canPaint && selectedTool === 'paint' && (
				<div className="paint-palette">
					{PAINT_PALETTE.map((c) => (
						<button
							key={c}
							className={`paint-swatch ${paintColor === c ? 'on' : ''}`}
							style={{ background: c }}
							title={c}
							aria-label={t('app.toolbelt.paintColorAria', { color: c })}
							onClick={() => setPaintColor(c)}
						/>
					))}
				</div>
			)}
			<div className="toolbelt">
				{TOOL_META.map((meta) => {
					const def = data.tools.find((tool) => tool.id === meta.id);
					const tier = state.player.tools?.[meta.id] || 1;
					const tierDef = def?.tiers.find((td) => td.tier === tier);
					const selected = selectedTool === meta.id;
					const toolName = content('tool', meta.id, 'name', tierDef?.name || def?.name || meta.id);
					const how = t(meta.how);
					return (
						<button
							key={meta.id}
							className={`tool-slot ${selected ? 'on' : ''}`}
							title={t('app.toolbelt.titleFormat', { name: toolName, key: keyForTool(meta.id), how })}
							aria-label={toolName}
							onClick={() => {
								setSelectedTool(meta.id);
								notify(t('app.toolbelt.selected', { name: toolName, how }));
							}}
						>
							<Icon name={meta.icon} size={22} />
							<span className="tool-key">{keyForTool(meta.id)}</span>
							{tier > 1 && (
								<span className="tool-tier">
									<Icon name="sparkle" size={10} />
								</span>
							)}
						</button>
					);
				})}
				{canPaint && (
					<button
						className={`tool-slot ${selectedTool === 'paint' ? 'on' : ''}`}
						title={t('app.toolbelt.paintTitle')}
						aria-label={t('app.toolbelt.paint')}
						onClick={() => {
							setSelectedTool('paint');
							notify(t('app.toolbelt.paintHow'));
						}}
					>
						<Icon name="paint" size={22} />
						<span className="tool-key">{keyForTool('paint')}</span>
						<span className="tool-tier paint-dot" style={{ background: paintColor }} />
					</button>
				)}
			</div>
		</div>
	);
}

function feedTime(at: number): string {
	const d = new Date(at);
	const today = new Date();
	const sameDay = d.toDateString() === today.toDateString();
	const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

/** The full activity feed as a panel (F) — scroll back through the last 100 notable moments. */
export function FeedPanel() {
	const { feedLog, setPanel } = useGame();
	const { t } = useI18n();
	const entries = [...feedLog].reverse(); // notable beats only, newest first
	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="chat" size={20} /> {t('app.feedPanel.title')}
					</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('app.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body">
					{entries.length === 0 ? (
						<p className="muted small">{t('app.feedPanel.empty')}</p>
					) : (
						<div className="feed-list">
							{entries.map((entry) => (
								<div className="feed-row" key={entry.id}>
									<span className="feed-row-icon">
										<Icon name={entry.icon} size={15} />
									</span>
									<span className="feed-row-text">{entry.text}</span>
									<span className="feed-row-time">{feedTime(entry.at)}</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

const LOG_PREF_KEY = 'wild-willows:log-open';

export function ActivityLog() {
	const { log, panel } = useGame();
	const { t } = useI18n();
	const [open, setOpen] = useState(() => {
		try {
			return localStorage.getItem(LOG_PREF_KEY) !== '0';
		} catch {
			return true;
		}
	});

	const toggle = () => {
		setOpen((o) => {
			try {
				localStorage.setItem(LOG_PREF_KEY, o ? '0' : '1');
			} catch {
				/* ignore */
			}
			return !o;
		});
	};

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const hovering = useRef(false);

	// Keep the feed pinned to the newest entry — unless the player is hovering and
	// has scrolled up to read older messages, in which case we leave it alone.
	useEffect(() => {
		const el = scrollRef.current;
		if (el && !hovering.current) el.scrollTop = el.scrollHeight;
	}, [log, open]);

	// Collapse the side feed entirely while the full Feed menu (F) is open — it
	// reappears (at its prior open/closed state) the moment the menu is closed.
	if (panel === 'feed') return null;

	return (
		<div className="activity-log" aria-live="polite">
			{open && (
				<div
					className="activity-scroll"
					ref={scrollRef}
					onMouseEnter={() => {
						hovering.current = true;
					}}
					onMouseLeave={() => {
						hovering.current = false;
						const el = scrollRef.current;
						if (el) el.scrollTop = el.scrollHeight; // snap back to newest on leave
					}}
				>
					{log.map((entry) => (
						<div className="activity-entry" key={entry.id}>
							<Icon name={entry.icon} size={14} />
							<span>{entry.text}</span>
						</div>
					))}
				</div>
			)}
			<button
				className="log-toggle"
				onClick={toggle}
				title={open ? t('app.activityLog.hide') : t('app.activityLog.show')}
				aria-label={open ? t('app.activityLog.hide') : t('app.activityLog.show')}
			>
				<Icon name="chat" size={15} />
				<Icon name={open ? 'close' : 'back'} size={11} className={open ? '' : 'flip'} />
			</button>
		</div>
	);
}

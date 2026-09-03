import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useGameFeed } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import { BIND_ACTIONS, getBindings, keyLabel } from '../keybindings';
import { usePrefs } from '../prefs';
import { TUTORIAL_TOOLBELT_STEP, useTutorialReveal } from './Tutorial';
import { brushSizesFor } from '../game/worldRules';

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

/** The tools whose work covers ground, and so can carry a brush size. */
const SHAPING_TOOLS = new Set(['shovel', 'watering-can']);

export function Toolbelt() {
	const { data, state, selectedTool, setSelectedTool, notify, paintColor, setPaintColor, brushSize, setBrushSize } =
		useGame();
	const { t, content } = useI18n();
	// The brush picker is an accordion off the tool itself: picking up a shovel
	// opens it, clicking that same shovel again folds it away. Somebody who always
	// works one square at a time should be able to put the panel down and not have
	// it in front of the world.
	const [brushOpen, setBrushOpen] = useState(true);
	usePrefs(); // reflect custom tool-select keys
	// The toolbelt stays off screen until the tutorial step that hands it over, so
	// a new caretaker's first minute is a meadow and a card telling them to walk —
	// not a row of implements they have no use for yet. Latched, so stepping back
	// through the tutorial can't take it away again; saves past that step (or with
	// no tutorial at all) have always had it.
	const toolbeltRevealed = useTutorialReveal(state, TUTORIAL_TOOLBELT_STEP);
	// The key cap shown on each tool = its current binding (tool1..tool4).
	const keyForTool = (toolId: string): string => {
		const a = BIND_ACTIONS.find((x) => x.tool === toolId);
		return a ? keyLabel(getBindings()[a.id][0]) : '';
	};
	if (!data || !state || !toolbeltRevealed) return null;
	// the paint tool only exists indoors, and only once the home is built into a house
	const canPaint = state.player.area === 'home' && !!state.player.home?.styleLocked;
	// The brush picker appears only for the tool in hand, and only once that tool
	// offers more than one size. Holding a plain shovel, there is nothing to pick
	// and nothing to explain.
	const brushes = SHAPING_TOOLS.has(selectedTool) ? brushSizesFor(state.player.tools?.[selectedTool] || 1) : [1];
	const hasBrushes = brushes.length > 1;
	const showBrushes = hasBrushes && brushOpen;
	// Switching to a tool that cannot manage the current size drops back to a
	// single square rather than silently shaping more ground than the picker shows.
	const activeBrush = brushes.includes(brushSize) ? brushSize : 1;

	return (
		<div className="toolbelt-wrap">
			{showBrushes && (
				<div className="brush-sizes" id="brush-sizes" role="group" aria-label={t('app.toolbelt.brushGroup')}>
					{brushes.map((n) => (
						<button
							key={n}
							className={`brush-size ${activeBrush === n ? 'on' : ''}`}
							aria-pressed={activeBrush === n}
							title={t('app.toolbelt.brushTitle', { n, tiles: n * n })}
							onClick={() => {
								setBrushSize(n);
								notify(t('app.toolbelt.brushSelected', { n, tiles: n * n }));
							}}
						>
							{/* A plan view of the ground one action covers. Capped at a 3x3 of
							    marks for the 9x9 so the chip stays a chip. */}
							<span
								className="brush-grid"
								aria-hidden="true"
								style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, 1fr)` }}
							>
								{Array.from({ length: Math.min(n, 3) ** 2 }, (_, i) => (
									<i key={i} />
								))}
							</span>
							<span className="brush-label">{t('app.toolbelt.brushSize', { n })}</span>
						</button>
					))}
				</div>
			)}
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
					// A tool that carries brush sizes says on hover that clicking it again
					// folds them away — otherwise the toggle is only found by accident.
					const foldable = SHAPING_TOOLS.has(meta.id) && brushSizesFor(tier).length > 1;
					const title = t('app.toolbelt.titleFormat', { name: toolName, key: keyForTool(meta.id), how });
					return (
						<button
							key={meta.id}
							className={`tool-slot ${selected ? 'on' : ''}`}
							// `title` doubles as the screen-reader description (what the tool does),
							// so the name stays short for navigation and the explanation follows.
							title={foldable && selected ? `${title} — ${t('app.toolbelt.brushToggleHint')}` : title}
							aria-label={toolName}
							aria-pressed={selected}
							aria-keyshortcuts={keyForTool(meta.id)}
							aria-expanded={foldable && selected ? brushOpen : undefined}
							// Only while the panel is actually on screen — aria-controls pointing
							// at an id that isn't in the document is worse than none.
							aria-controls={foldable && selected && showBrushes ? 'brush-sizes' : undefined}
							onClick={() => {
								// Clicking the tool already in hand folds its brush picker away,
								// and clicking once more brings it back.
								if (selected && foldable) {
									const next = !brushOpen;
									setBrushOpen(next);
									notify(t(next ? 'app.toolbelt.brushShown' : 'app.toolbelt.brushHidden'));
									return;
								}
								setSelectedTool(meta.id);
								notify(t('app.toolbelt.selected', { name: toolName, how }));
							}}
						>
							<Icon name={meta.icon} size={22} />
							{/* Decorative: the number repeats aria-keyshortcuts, and left in the
							    tree it's what a mouse-tracking screen reader reads instead of the
							    tool name. The tier pip is pure decoration. */}
							<span className="tool-key" aria-hidden="true">
								{keyForTool(meta.id)}
							</span>
							{tier > 1 && (
								<span className="tool-tier" aria-hidden="true">
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
						aria-pressed={selectedTool === 'paint'}
						aria-keyshortcuts={keyForTool('paint')}
						onClick={() => {
							setSelectedTool('paint');
							notify(t('app.toolbelt.paintHow'));
						}}
					>
						<Icon name="paint" size={22} />
						<span className="tool-key" aria-hidden="true">
							{keyForTool('paint')}
						</span>
						<span className="tool-tier paint-dot" style={{ background: paintColor }} aria-hidden="true" />
					</button>
				)}
			</div>
		</div>
	);
}

// Built once, not once per row. toLocaleTimeString/toLocaleDateString construct a
// fresh Intl formatter on every call, and this runs for every entry in a feed
// that holds up to 100 of them — a few hundred Intl operations per render of the
// Feed panel. These use the browser's default locale exactly as the old calls did
// (`[]` and `undefined` mean the same thing to Intl), so the output is unchanged.
const FEED_TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const FEED_DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function feedTime(at: number): string {
	const d = new Date(at);
	const today = new Date();
	const sameDay = d.toDateString() === today.toDateString();
	const time = FEED_TIME_FMT.format(d);
	return sameDay ? time : `${FEED_DATE_FMT.format(d)} · ${time}`;
}

/** The full activity feed as a panel (F) — scroll back through the last 100 notable moments. */
export function FeedPanel() {
	const { setPanel } = useGame();
	const { feedLog } = useGameFeed();
	const { t } = useI18n();
	// Copy + reverse only when the feed actually changes, not on every render the
	// panel happens to do.
	const entries = useMemo(() => [...feedLog].reverse(), [feedLog]); // notable beats only, newest first
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
	const { panel } = useGame();
	const { log } = useGameFeed();
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

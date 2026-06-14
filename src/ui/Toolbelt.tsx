import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state';
import { Icon } from './icons';

export const TOOL_META: Array<{ id: string; icon: string; key: string; how: string }> = [
	{ id: 'basket', icon: 'basket', key: '1', how: 'Your gathering tool — walk to any gathering spot and interact to collect it into your basket.' },
	{ id: 'shovel', icon: 'spade', key: '2', how: 'Terraform — dig soil beds in nearby ground; dig a shaped tile again to clear or drain it.' },
	{ id: 'watering-can', icon: 'can', key: '3', how: 'Terraform — water a soil bed to make it plantable; water it again to flood it into open water. Chain water tiles into ponds, rivers, and lakes.' },
];

export function Toolbelt() {
	const { data, state, selectedTool, setSelectedTool, setPanel, panel, notify } = useGame();
	if (!data || !state) return null;

	return (
		<div className="toolbelt">
			{TOOL_META.map((meta) => {
				const def = data.tools.find((t) => t.id === meta.id);
				const tier = state.player.tools?.[meta.id] || 1;
				const tierDef = def?.tiers.find((t) => t.tier === tier);
				const selected = selectedTool === meta.id;
				return (
					<button
						key={meta.id}
						className={`tool-slot ${selected ? 'on' : ''}`}
						title={`${tierDef?.name || def?.name} (${meta.key}): ${meta.how}`}
						aria-label={tierDef?.name || def?.name}
						onClick={() => {
							setSelectedTool(meta.id);
							notify(`${tierDef?.name || def?.name}: ${meta.how}`);
						}}
					>
						<Icon name={meta.icon} size={22} />
						<span className="tool-key">{meta.key}</span>
						{tier > 1 && <span className="tool-tier"><Icon name="sparkle" size={10} /></span>}
					</button>
				);
			})}
			<span className="belt-divider" />
			<button
				className={`tool-slot craft ${panel === 'crafting' ? 'on' : ''}`}
				title="Craft (C) — anywhere, using your basket and chests"
				aria-label="Craft"
				onClick={() => setPanel(panel === 'crafting' ? null : 'crafting')}
			>
				<Icon name="hammer" size={22} />
				<span className="tool-key">C</span>
			</button>
			<button
				className="tool-slot subtle"
				title="Tool upgrades (T)"
				aria-label="Tool upgrades"
				onClick={() => setPanel('tools')}
			>
				<Icon name="tools" size={20} />
				<span className="tool-key">T</span>
			</button>
		</div>
	);
}

const LOG_PREF_KEY = 'wild-willows:log-open';

export function ActivityLog() {
	const { log } = useGame();
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
			} catch { /* ignore */ }
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

	return (
		<div className="activity-log" aria-live="polite">
			{open && (
				<div
					className="activity-scroll"
					ref={scrollRef}
					onMouseEnter={() => { hovering.current = true; }}
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
				title={open ? 'Hide activity feed' : 'Show activity feed'}
				aria-label={open ? 'Hide activity feed' : 'Show activity feed'}
			>
				<Icon name="chat" size={15} />
				<Icon name={open ? 'close' : 'back'} size={11} className={open ? '' : 'flip'} />
			</button>
		</div>
	);
}

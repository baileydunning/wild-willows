import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import { DEMO, DEMO_ANIMAL_GOAL, DEMO_BIOME } from '../demo';

// ── Contextual hints ──────────────────────────────────────────────────────────
// The first time a player opens each menu (or steps into their home), a short
// explanation of what it's for appears as a slim banner at the top of the screen
// — visible right there over the open menu, so they understand it while they're
// looking at it — and is ALSO dropped into the activity feed (notable), so it
// stays there to scroll back to. Each hint fires once ever (localStorage), so the
// guidance never repeats or nags. A menu hint clears when that menu closes; the
// home/demo hints stay until dismissed.

// Which menus explain themselves on first open. Keys resolve to panels.coach.<key>
// (a single short sentence); the icon matches the menu's own button.
const PANEL_HINTS: Record<string, { icon: string; key: string }> = {
	journal: { icon: 'journal', key: 'journal' },
	achievements: { icon: 'star', key: 'achievements' },
	feed: { icon: 'chat', key: 'feed' },
	inventory: { icon: 'basket', key: 'inventory' },
	crafting: { icon: 'hammer', key: 'crafting' },
	tools: { icon: 'tools', key: 'tools' },
	goals: { icon: 'target', key: 'goals' },
	biomes: { icon: 'map', key: 'biomes' },
	weather: { icon: 'cloud', key: 'weather' },
	people: { icon: 'user', key: 'people' },
	settings: { icon: 'gear', key: 'settings' },
};

const SEEN_KEY = 'wild-willows:coach-seen';
function loadSeen(): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
	} catch {
		return new Set();
	}
}
function persistSeen(seen: Set<string>) {
	try {
		localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
	} catch {
		/* ignore */
	}
}

interface Active {
	id: string;
	icon: string;
	key: string;
	/** The panel this hint belongs to; the banner auto-clears when it closes.
	 *  null for world hints (home, demo) that stay until dismissed. */
	panelTie: string | null;
}

export function CoachTips() {
	const { state, panel, pushLog } = useGame();
	const { t } = useI18n();
	const seenRef = useRef<Set<string>>(loadSeen());
	const [active, setActive] = useState<Active | null>(null);

	// Show a hint once: mark it seen, log it to the feed, and raise the banner.
	const fireRef = useRef<(a: Active) => void>(() => {});
	fireRef.current = (a: Active) => {
		if (seenRef.current.has(a.id)) return;
		seenRef.current.add(a.id);
		persistSeen(seenRef.current);
		pushLog(a.icon, `${t('panels.coach.label')} · ${t(`panels.coach.${a.key}`)}`, true);
		setActive(a);
	};

	// First time each menu opens → raise its banner.
	useEffect(() => {
		if (panel && PANEL_HINTS[panel]) {
			const h = PANEL_HINTS[panel];
			fireRef.current({ id: `panel:${panel}`, icon: h.icon, key: h.key, panelTie: panel });
		}
	}, [panel]);

	// A menu-tied banner clears when that menu closes or another opens.
	useEffect(() => {
		setActive((a) => (a && a.panelTie && a.panelTie !== panel ? null : a));
	}, [panel]);

	// First time you step into your home.
	const area = state?.player?.area;
	useEffect(() => {
		if (area === 'home') fireRef.current({ id: 'home', icon: 'home', key: 'home', panelTie: null });
	}, [area]);

	// Demo: one animal away from finishing.
	const returned = state?.biomeStates?.find((b: any) => b.biomeId === DEMO_BIOME)?.returnedCount ?? 0;
	useEffect(() => {
		if (DEMO && returned >= DEMO_ANIMAL_GOAL - 1 && returned < DEMO_ANIMAL_GOAL) {
			fireRef.current({ id: 'demoNear', icon: 'sparkle', key: 'demoNear', panelTie: null });
		}
	}, [returned]);

	// Esc dismisses the banner.
	useEffect(() => {
		if (!active) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setActive(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [active]);

	if (!active) return null;

	return (
		<div className="coach-banner" role="status">
			<div className="coach-banner-icon">
				<Icon name={active.icon} size={18} />
			</div>
			<div className="coach-banner-text">
				<b>{t('panels.coach.label')}</b> {t(`panels.coach.${active.key}`)}
			</div>
			<button className="coach-banner-close" onClick={() => setActive(null)} aria-label={t('panels.common.close')}>
				<Icon name="close" size={14} />
			</button>
		</div>
	);
}

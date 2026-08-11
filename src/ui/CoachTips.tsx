import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

// ── Contextual hints ──────────────────────────────────────────────────────────
// The first time a player opens each menu (or steps into their home), a short
// explanation of what it's for appears as a slim banner at the top of the screen
// — visible right there over the open menu, so they understand it while they're
// looking at it — and is ALSO dropped into the activity feed (notable), so it
// stays there to scroll back to. Each hint fires once ever (localStorage), so the
// guidance never repeats or nags. A hint is tied to whatever it describes and
// goes when that does: a menu hint clears when its menu closes, an area hint when
// you walk out of the area.

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

/** Set while a banner is up; App's Escape chain calls it through
 *  dismissCoachTip(). A module-level hook rather than game state because the
 *  banner is entirely CoachTips' business — App only needs to know whether
 *  there was one to close. */
let dismissCurrent: (() => boolean) | null = null;

/** Dismiss the coach banner if one is showing. Returns true if it did, so a
 *  caller working down a close chain knows the keypress was spent. */
export function dismissCoachTip(): boolean {
	return dismissCurrent ? dismissCurrent() : false;
}

interface Active {
	id: string;
	icon: string;
	key: string;
	/** The panel this hint belongs to; the banner auto-clears when it closes.
	 *  null for hints that aren't about a menu. */
	panelTie: string | null;
	/** The area this hint belongs to; the banner auto-clears when you walk out of
	 *  it. null for hints that aren't about a place. A hint explains whatever you
	 *  are currently looking at, so it should outlive neither the menu nor the
	 *  place it describes — it used to sit there until dismissed, which meant a
	 *  note about your home followed you around the whole preserve. */
	areaTie: string | null;
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
			fireRef.current({ id: `panel:${panel}`, icon: h.icon, key: h.key, panelTie: panel, areaTie: null });
		}
	}, [panel]);

	// A menu-tied banner clears when that menu closes or another opens.
	useEffect(() => {
		setActive((a) => (a && a.panelTie && a.panelTie !== panel ? null : a));
	}, [panel]);

	// First time you step into your home — and it goes when you step back out.
	const area = state?.player?.area;
	useEffect(() => {
		if (area === 'home') fireRef.current({ id: 'home', icon: 'home', key: 'home', panelTie: null, areaTie: 'home' });
	}, [area]);

	// An area-tied banner clears when you leave that area, the same way a menu-tied
	// one clears when its menu closes.
	useEffect(() => {
		setActive((a) => (a && a.areaTie && a.areaTie !== area ? null : a));
	}, [area]);

	// Esc is handled by App's close chain rather than a listener of our own. It
	// used to be one here, which meant a single press ran BOTH: the banner went
	// away and the menu underneath closed with it — so there was no way to dismiss
	// a menu's own hint and keep reading that menu. Registering with the chain
	// makes one press do one thing, hint first, menu second.
	useEffect(() => {
		dismissCurrent = active
			? () => {
					setActive(null);
					return true;
				}
			: null;
		return () => {
			dismissCurrent = null;
		};
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

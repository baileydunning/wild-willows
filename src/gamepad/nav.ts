// Spatial navigation for the DOM UI, driven by the controller.
//
// Every panel, popup and the title screen are ordinary React DOM, built from
// real <button>s and form controls (see the accessibility notes all over
// src/ui). So instead of teaching each panel about controllers, this finds the
// topmost open surface, collects its focusable controls, and moves a focus ring
// between them by screen geometry. A presses the focused control the same way a
// click would; the panels never know the difference.

export type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = [
	'button:not([disabled])',
	'a[href]',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'summary',
	'[role="button"]:not([aria-disabled="true"])',
	'[role="tab"]',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

// The ring is a data attribute, not a class: React rewrites `className` whenever
// a control's own classes change (a key flashing "pressed", a toggle turning
// "on"), which would strip a class off the very control the player is on.
const RING = 'data-pad-focus';
let ringEl: HTMLElement | null = null;
// Where the ring is DRAWN, usually the same element. A custom toggle or color
// swatch is a real input made invisible (opacity 0) over its styled track, and
// an outline on it would be invisible too, so the ring is drawn on the control
// the player can see while focus and A stay on the input.
let ringShownOn: HTMLElement | null = null;
function ringHost(el: HTMLElement): HTMLElement {
	if (el.tagName !== 'INPUT' || getComputedStyle(el).opacity !== '0') return el;
	return (el.closest('.switch, label') as HTMLElement | null) || el.parentElement || el;
}
// Where the ring last was, so a control React re-renders out from under it
// (pressing a swatch, a list re-sorting) hands the ring to whatever now sits
// in that spot instead of throwing it back to the top of the panel.
let lastCenter: { x: number; y: number; surface: HTMLElement; kind: string } | null = null;

/** Tag plus first class: enough to tell "the same chip, re-rendered" from a
 *  different screen that happens to put a control in the same place. */
const kindOf = (el: Element) => `${el.tagName}.${el.classList[0] || ''}`;

/** Whether the HUD "menu mode" (Menu button) is scoping navigation to the HUD. */
let hudMode = false;
export function setHudMode(on: boolean) {
	hudMode = on;
	document.body.classList.toggle('pad-hud-mode', on);
	if (!on) clearRing();
}
export function inHudMode() {
	return hudMode;
}

function visible(el: Element): boolean {
	const h = el as HTMLElement;
	if (!h.isConnected) return false;
	const r = h.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return false;
	if (h.closest('[aria-hidden="true"], [inert]')) return false;
	const cs = getComputedStyle(h);
	if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
	return true;
}

/**
 * The surface navigation is scoped to, or null when the controller should be
 * driving the world. Popups and panels are `.panel-backdrop`s (modals) or
 * `[aria-modal]` dialogs; the placement popup is `.placement-menu`. With no
 * game screen at all (title screen, character creation) the whole page is the
 * surface.
 */
export function activeSurface(): HTMLElement | null {
	const candidates = Array.from(
		document.querySelectorAll<HTMLElement>('.panel-backdrop, [aria-modal="true"], .placement-menu, .kb-gate'),
	).filter(visible);
	if (candidates.length) return candidates[candidates.length - 1];
	if (hudMode) return document.querySelector<HTMLElement>('.ui-layer');
	if (!document.querySelector('.game-screen')) return document.getElementById('root') || document.body;
	return null;
}

export function focusables(surface: HTMLElement): HTMLElement[] {
	return Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => visible(el) && !el.classList.contains('panel-backdrop'),
	);
}

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
	if (!el) return false;
	if (el.tagName === 'TEXTAREA') return true;
	if (el.tagName !== 'INPUT') return false;
	const type = (el as HTMLInputElement).type;
	return ['text', 'search', 'email', 'password', 'number', 'tel', 'url', ''].includes(type);
}
export { isTextField };

/** Form controls are ringed but not given DOM focus while navigating: a focused
 *  input counts as "typing" everywhere in the game (isTypingTarget), which would
 *  freeze the world keyboard and swallow B. They only take real focus on A. */
function isFormControl(el: Element) {
	return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
}

export function ringed(): HTMLElement | null {
	if (ringEl && !ringEl.isConnected) ringEl = null;
	return ringEl;
}

// A control that should get the ring the next time one is placed (the text
// field the on-screen keyboard just typed into). Survives clearRing, because
// closing the keyboard changes the surface and clears the ring on the way.
let pending: HTMLElement | null = null;
export function preferRing(el: HTMLElement) {
	pending = el;
}

export function clearRing() {
	ringShownOn?.removeAttribute(RING);
	ringShownOn = null;
	ringEl = null;
	lastCenter = null;
}

export function setRing(el: HTMLElement, scroll = true) {
	if (ringEl !== el) {
		ringShownOn?.removeAttribute(RING);
		ringEl = el;
		ringShownOn = ringHost(el);
		ringShownOn.setAttribute(RING, '');
	}
	if (!isFormControl(el)) {
		try {
			el.focus({ preventScroll: true });
		} catch {
			/* not focusable — the ring still shows */
		}
	} else if (document.activeElement && document.activeElement !== el && isTextField(document.activeElement)) {
		(document.activeElement as HTMLElement).blur();
	}
	if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	const r = el.getBoundingClientRect();
	const surface = activeSurface();
	if (surface) lastCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2, surface, kind: kindOf(el) };
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
	for (let n = el?.parentElement; n; n = n.parentElement) {
		const cs = getComputedStyle(n);
		if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) return n;
	}
	return null;
}

function inView(el: HTMLElement): boolean {
	const r = el.getBoundingClientRect();
	const sp = scrollParent(el);
	const box = sp ? sp.getBoundingClientRect() : { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
	return r.bottom > box.top + 4 && r.top < box.bottom - 4;
}

/** Where focus should start when a surface opens: the first control in the
 *  panel's body (so you land on content, not the close button), or the first
 *  HUD menu button in menu mode. */
export function initialFocus(surface: HTMLElement): HTMLElement | null {
	const all = focusables(surface);
	if (!all.length) return null;
	if (hudMode && surface.classList.contains('ui-layer')) {
		const nav = all.find((el) => el.closest('.nav-group-btns'));
		if (nav) return nav;
	}
	const preferred =
		all.find((el) => el.hasAttribute('data-pad-default')) ||
		// a screen's main action, like Continue or New Game on the title screen
		(!surface.querySelector('.panel-body') ? all.find((el) => el.classList.contains('primary')) : undefined);
	if (preferred) return preferred;
	const selectedTab = all.find((el) => el.getAttribute('aria-selected') === 'true');
	const body = all.find((el) => el.closest('.panel-body') && inView(el) && !el.closest('.tabs'));
	// A read-only panel (How to Play, a guide page) has nothing in its body to
	// press: start on its close button, never on a header action like "Replay
	// tutorial" that a reflexive A would set off.
	const close = all.find((el) => el.matches('.panel-head .icon-btn[aria-label]'));
	return body || selectedTab || close || all[0];
}

/** Ensure the ring is on something inside the surface; returns the ringed element. */
export function ensureRing(surface: HTMLElement): HTMLElement | null {
	const cur = ringed();
	if (cur && surface.contains(cur) && visible(cur)) return cur;
	if (pending) {
		const p = pending;
		pending = null;
		if (p.isConnected && surface.contains(p) && visible(p)) {
			setRing(p);
			return p;
		}
	}
	if (lastCenter && lastCenter.surface === surface) {
		const { x, y } = lastCenter;
		let near: HTMLElement | null = null;
		let nd = 60; // only a control that really took the old one's place
		for (const el of focusables(surface)) {
			if (kindOf(el) !== lastCenter.kind) continue;
			const r = el.getBoundingClientRect();
			const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
			if (d < nd) {
				nd = d;
				near = el;
			}
		}
		if (near) {
			setRing(near, false);
			return near;
		}
	}
	const first = initialFocus(surface);
	if (first) setRing(first);
	autoPlaced = true;
	return first;
}

// True while the ring sits where ensureRing put it and the player hasn't moved
// it yet. A screen that is still loading (the title screen's buttons are
// disabled until the game data arrives) first gets the ring on whatever is
// pressable; once its real first choice appears, the ring moves there.
let autoPlaced = false;
export function refreshAutoRing(surface: HTMLElement) {
	if (!autoPlaced) return;
	const cur = ringed();
	const best = initialFocus(surface);
	if (best && best !== cur) {
		setRing(best);
		autoPlaced = true;
	}
}

function center(r: DOMRect) {
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Move the ring one step in a direction. Returns false when nothing lies that way. */
export function moveRing(surface: HTMLElement, dir: Dir): boolean {
	const all = focusables(surface);
	if (!all.length) return false;
	let cur = ringed();
	if (!cur || !surface.contains(cur) || !visible(cur)) {
		const first = initialFocus(surface);
		if (first) setRing(first);
		return !!first;
	}
	// The ring was scrolled out of sight with the right stick: start again from
	// whatever is visible now, rather than yanking the view back.
	if (!inView(cur)) {
		const seen = all.filter(inView);
		if (seen.length) {
			setRing(dir === 'up' ? seen[seen.length - 1] : seen[0]);
			return true;
		}
	}
	const cr = cur.getBoundingClientRect();
	const cc = center(cr);
	const vertical = dir === 'up' || dir === 'down';
	const cands: Array<{ el: HTMLElement; primary: number; ortho: number; overlap: boolean }> = [];
	for (const el of all) {
		if (el === cur || cur.contains(el) || el.contains(cur)) continue;
		const r = el.getBoundingClientRect();
		const c = center(r);
		let primary: number;
		let overlap: boolean;
		let ortho: number;
		if (!vertical) {
			primary = dir === 'right' ? r.left - cr.right : cr.left - r.right;
			if ((dir === 'right' ? c.x - cc.x : cc.x - c.x) <= 1) continue;
			overlap = r.top < cr.bottom && r.bottom > cr.top;
			ortho = overlap ? 0 : Math.abs(c.y - cc.y);
		} else {
			primary = dir === 'down' ? r.top - cr.bottom : cr.top - r.bottom;
			if ((dir === 'down' ? c.y - cc.y : cc.y - c.y) <= 1) continue;
			overlap = r.left < cr.right && r.right > cr.left;
			ortho = overlap ? 0 : Math.abs(c.x - cc.x);
		}
		cands.push({ el, primary: Math.max(0, primary), ortho, overlap });
	}
	if (!cands.length) return false;
	let best: HTMLElement | null = null;
	if (vertical) {
		// Up/down go to the NEXT ROW, then to whatever in it sits closest
		// sideways. Preferring things directly in line skipped rows: down from a
		// button on the left of Settings jumped past every toggle on the right to
		// the next dropdown that happened to line up with it.
		const nearest = Math.min(...cands.map((c) => c.primary));
		let bestOrtho = Infinity;
		for (const c of cands) {
			if (c.primary > nearest + 24) continue;
			if (c.ortho < bestOrtho) {
				bestOrtho = c.ortho;
				best = c.el;
			}
		}
	} else {
		// Left/right stay in the row: right from a footer button reaches the
		// button beside it, not a nearer chip diagonally above. Off-line
		// candidates still count when nothing is in line.
		let bestScore = Infinity;
		for (const c of cands) {
			const score = c.primary + (c.overlap ? 0 : 250 + c.ortho * 4);
			if (score < bestScore) {
				bestScore = score;
				best = c.el;
			}
		}
	}
	if (!best) return false;
	setRing(best);
	autoPlaced = false;
	return true;
}

// ------------------------------------------------------------ form controls

function nativeSetter(el: HTMLElement, value: string) {
	const proto =
		el.tagName === 'SELECT'
			? HTMLSelectElement.prototype
			: el.tagName === 'TEXTAREA'
				? HTMLTextAreaElement.prototype
				: HTMLInputElement.prototype;
	// React tracks `value` on the instance; going through the prototype setter is
	// what makes the following input/change event register as a real edit.
	Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
}

export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
	nativeSetter(el, value);
	el.dispatchEvent(new Event('input', { bubbles: true }));
	el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Left/right on a slider changes its value instead of moving focus. (A
 *  dropdown opens with A instead: src/ui/SelectPicker.tsx.)
 *  Returns true when the press was used that way. */
export function adjustControl(el: HTMLElement, dir: Dir): boolean {
	if (dir !== 'left' && dir !== 'right') return false;
	const sign = dir === 'right' ? 1 : -1;
	if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') {
		const r = el as HTMLInputElement;
		const step = Number(r.step) || 1;
		const min = r.min === '' ? 0 : Number(r.min);
		const max = r.max === '' ? 100 : Number(r.max);
		// Ten presses end to end for fine-grained sliders, never finer than their step.
		const jump = Math.max(step, Math.round((max - min) / 10 / step) * step);
		const next = Math.min(max, Math.max(min, Number(r.value) + sign * jump));
		setFieldValue(r, String(next));
		return true;
	}
	return false;
}

/** Scroll the panel under the ring (or the surface's main scroller). */
export function scrollSurface(surface: HTMLElement, dy: number) {
	const cur = ringed();
	let sp = cur && surface.contains(cur) ? scrollParent(cur) : null;
	if (!sp) {
		const body = surface.querySelector<HTMLElement>('.panel-body');
		sp =
			body && body.scrollHeight > body.clientHeight + 2 ? body : scrollParent(surface.firstElementChild as HTMLElement);
	}
	if (!sp) {
		const all = Array.from(surface.querySelectorAll<HTMLElement>('*')).filter(
			(n) => n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY),
		);
		sp = all.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
	}
	sp?.scrollBy({ top: dy });
}

/** LB/RB: step through the surface's tab row, if it has one. */
export function cycleTabs(surface: HTMLElement, sign: number): boolean {
	const group =
		surface.querySelector<HTMLElement>('[role="tablist"]') ||
		surface.querySelector<HTMLElement>('.tabs') ||
		surface.querySelector<HTMLElement>('[role="tab"]')?.parentElement ||
		null;
	if (!group) return false;
	const tabs = Array.from(group.querySelectorAll<HTMLElement>('[role="tab"], button')).filter(
		(t) => visible(t) && !(t as HTMLButtonElement).disabled,
	);
	if (tabs.length < 2) return false;
	let i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true' || t.classList.contains('on'));
	if (i < 0) i = 0;
	const next = tabs[(i + sign + tabs.length) % tabs.length];
	next.click();
	next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	return true;
}

/** B on a surface without the in-game Escape chain (the title screen's dialogs):
 *  press its close button, or its backdrop. */
export function closeSurface(surface: HTMLElement): boolean {
	const close = surface.querySelector<HTMLElement>(
		'.panel-head .icon-btn[aria-label], button[aria-label="Close"], .help-head-actions .icon-btn',
	);
	if (close && visible(close)) {
		close.click();
		return true;
	}
	if (surface.classList.contains('panel-backdrop')) {
		surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return true;
	}
	return false;
}

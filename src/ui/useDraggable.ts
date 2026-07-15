import { useEffect, useRef, useState } from 'react';
import type {
	CSSProperties,
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
	RefObject,
} from 'react';

interface Pos {
	x: number;
	y: number;
}

const MARGIN = 8; // keep at least this many px of the window on every side
const KEY_STEP = 16; // arrow-key nudge distance (px); Shift = fine 2px steps

export interface Draggable {
	/** Attach to the element that should move. */
	ref: RefObject<HTMLDivElement>;
	/** Spread onto the drag handle (e.g. a panel/card header). */
	handleProps: {
		tabIndex: number;
		onPointerDown: (e: ReactPointerEvent) => void;
		onPointerMove: (e: ReactPointerEvent) => void;
		onPointerUp: (e: ReactPointerEvent) => void;
		onPointerCancel: (e: ReactPointerEvent) => void;
		onLostPointerCapture: (e: ReactPointerEvent) => void;
		onKeyDown: (e: ReactKeyboardEvent) => void;
	};
	/** Inline style to spread onto the ref element (empty until first moved). */
	style: CSSProperties;
}

/**
 * Make a floating element draggable by a handle. Position is tracked as
 * viewport-relative left/top, clamped so the element can never be dragged fully
 * off-screen, re-clamped on window resize, and (optionally) remembered across
 * sessions in localStorage. Dragging never starts from a <button> inside the
 * handle, so header controls keep working.
 *
 * The handle is also focusable, and arrow keys nudge the element (Shift for
 * fine steps) — a keyboard alternative to mouse dragging (playtest request).
 *
 * Drags end on pointerup, pointercancel, OR lost pointer capture, and a mouse
 * move with no button held also ends them. Playtest: when capture was lost
 * mid-drag (e.g. focus stolen by a recording overlay), the card stayed glued
 * to the cursor and kept following it with no button pressed.
 */
export function useDraggable(storageKey?: string): Draggable {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState<Pos | null>(() => {
		if (!storageKey) return null;
		try {
			const v = localStorage.getItem(storageKey);
			return v ? (JSON.parse(v) as Pos) : null;
		} catch {
			return null;
		}
	});
	const drag = useRef<{ dx: number; dy: number } | null>(null);

	const clamp = (x: number, y: number): Pos => {
		const el = ref.current;
		const w = el?.offsetWidth ?? 0;
		const h = el?.offsetHeight ?? 0;
		return {
			x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
			y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
		};
	};

	// Remember where the player left it.
	useEffect(() => {
		if (storageKey && pos) {
			try {
				localStorage.setItem(storageKey, JSON.stringify(pos));
			} catch {
				/* ignore */
			}
		}
	}, [pos, storageKey]);

	// Keep it on-screen if the window is resized.
	useEffect(() => {
		const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	// Safety net: any pointerup anywhere ends the drag, even if the handle
	// never receives it (capture lost, element re-rendered under the cursor…).
	useEffect(() => {
		const end = () => {
			drag.current = null;
		};
		window.addEventListener('pointerup', end);
		window.addEventListener('blur', end);
		return () => {
			window.removeEventListener('pointerup', end);
			window.removeEventListener('blur', end);
		};
	}, []);

	const endDrag = (e: ReactPointerEvent) => {
		drag.current = null;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
	};

	const handleProps = {
		tabIndex: 0,
		onPointerDown: (e: ReactPointerEvent) => {
			// let clicks on header controls (close, etc.) behave normally
			if ((e.target as HTMLElement).closest('button')) return;
			const el = ref.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
			try {
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
		},
		onPointerMove: (e: ReactPointerEvent) => {
			if (!drag.current) return;
			// a mouse drag can only continue while a button is actually held
			if (e.pointerType === 'mouse' && e.buttons === 0) {
				drag.current = null;
				return;
			}
			setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
		},
		onPointerUp: endDrag,
		onPointerCancel: endDrag,
		onLostPointerCapture: endDrag,
		onKeyDown: (e: ReactKeyboardEvent) => {
			const step = e.shiftKey ? 2 : KEY_STEP;
			let dx = 0,
				dy = 0;
			if (e.key === 'ArrowLeft') dx = -step;
			else if (e.key === 'ArrowRight') dx = step;
			else if (e.key === 'ArrowUp') dy = -step;
			else if (e.key === 'ArrowDown') dy = step;
			if (!dx && !dy) return;
			// swallow the key so the arrow doesn't also walk the player
			e.preventDefault();
			e.stopPropagation();
			const el = ref.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			setPos((p) => clamp((p?.x ?? r.left) + dx, (p?.y ?? r.top) + dy));
		},
	};

	// Once moved, drive position from left/top and neutralize any CSS edge anchoring.
	const style: CSSProperties = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};
	return { ref, handleProps, style };
}

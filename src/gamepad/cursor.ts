// A virtual mouse pointer for the controller.
//
// The world is built for pointing: placing an object, digging a bed, watering,
// painting, clicking an animal or a placed item all happen "at the pointer"
// (WorldScene reads activePointer). Rather than fork every one of those paths,
// the right stick drives an on-screen cursor and the triggers click with it —
// by dispatching the same mouse events a real mouse would, to whatever element
// is under the cursor. Phaser's MouseManager and React both take them as-is, so
// the controller reaches exactly what the mouse reaches, Shift-click included.

let el: HTMLDivElement | null = null;
let x = -1;
let y = -1;
let shown = false;

function ensureEl(): HTMLDivElement {
	if (el && el.isConnected) return el;
	el = document.createElement('div');
	el.className = 'pad-cursor';
	el.setAttribute('aria-hidden', 'true');
	document.body.appendChild(el);
	return el;
}

function paint() {
	const c = ensureEl();
	c.style.transform = `translate(${x}px, ${y}px)`;
	c.classList.toggle('on', shown);
}

export function cursorPos() {
	return { x, y };
}
export function cursorShown() {
	return shown;
}

export function showCursor(on: boolean) {
	if (on === shown) return;
	shown = on;
	if (on && x < 0) {
		x = innerWidth / 2;
		y = innerHeight / 2;
	}
	paint();
	if (on) hover();
}

function fire(type: string, target: Element, extra: MouseEventInit = {}) {
	const init: MouseEventInit = {
		bubbles: true,
		cancelable: true,
		composed: true,
		clientX: x,
		clientY: y,
		screenX: x,
		screenY: y,
		view: window,
		...extra,
	};
	const ev = type.startsWith('pointer')
		? new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true })
		: new MouseEvent(type, init);
	target.dispatchEvent(ev);
}

let lastHover: Element | null = null;
function under(): Element | null {
	return document.elementFromPoint(x, y);
}

/** Tell whatever is under the cursor that the pointer moved there (Phaser uses
 *  this to update activePointer, the placement ghost and hover highlights). */
function hover() {
	const t = under();
	if (!t) return;
	if (t !== lastHover) {
		if (lastHover?.isConnected) {
			fire('pointerout', lastHover);
			fire('mouseout', lastHover);
		}
		fire('pointerover', t);
		fire('mouseover', t);
		lastHover = t;
	}
	fire('pointermove', t);
	fire('mousemove', t);
}

/** Put the cursor at a screen position (clamped to the window). */
export function moveCursorTo(nx: number, ny: number) {
	x = Math.min(innerWidth - 2, Math.max(1, nx));
	y = Math.min(innerHeight - 2, Math.max(1, ny));
	paint();
	if (shown) hover();
}

/** Nudge the cursor by a stick vector for one frame. Squared response curve:
 *  a light push crawls tile by tile, a full push crosses the screen in ~1.5s. */
export function driveCursor(sx: number, sy: number, dt: number) {
	const mag = Math.hypot(sx, sy);
	if (!mag) return;
	const speed = 120 + 900 * mag * mag; // px/s
	moveCursorTo(x + (sx / mag) * speed * mag * dt, y + (sy / mag) * speed * mag * dt);
}

/** Click at the cursor. `shift` makes it a Shift-click (pick up in the world). */
export function clickAtCursor(shift = false) {
	const t = under();
	if (!t) return;
	const mods: MouseEventInit = { button: 0, shiftKey: shift };
	fire('pointerdown', t, { ...mods, buttons: 1 });
	fire('mousedown', t, { ...mods, buttons: 1 });
	fire('pointerup', t, { ...mods, buttons: 0 });
	fire('mouseup', t, { ...mods, buttons: 0 });
	fire('click', t, { ...mods, buttons: 0 });
}

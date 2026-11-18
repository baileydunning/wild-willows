// An invisible mouse pointer for the controller.
//
// The world is built for pointing: placing an object, digging a bed, watering,
// painting, clicking a placed item all happen "at the pointer" (WorldScene reads
// activePointer). On a controller the player never sees a pointer — they aim at
// a tile beside the caretaker — but rather than fork every one of those paths,
// this pointer is parked on the aim tile and the triggers click with it, by
// dispatching the same mouse events a real mouse would. Phaser's MouseManager
// takes them as-is, so the controller reaches exactly what the mouse reaches,
// Shift-click included. The dot can still be drawn, for debugging.

let el: HTMLDivElement | null = null;
let x = -1;
let y = -1;
let shown = false; // dispatching pointer events
let drawn = false; // and visible on screen

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
	c.classList.toggle('on', shown && drawn);
}

export function cursorPos() {
	return { x, y };
}
export function cursorShown() {
	return shown;
}

export function showCursor(on: boolean, visible = false) {
	if (on === shown && visible === drawn) return;
	drawn = visible;
	if (on === shown) {
		paint();
		return;
	}
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
	const cx = Math.min(innerWidth - 2, Math.max(1, nx));
	const cy = Math.min(innerHeight - 2, Math.max(1, ny));
	if (Math.abs(cx - x) < 0.5 && Math.abs(cy - y) < 0.5) return; // parked: nothing to tell anyone
	x = cx;
	y = cy;
	paint();
	if (shown) hover();
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

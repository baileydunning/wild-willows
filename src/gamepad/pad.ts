// Controller state for Wild Willows: polls the Gamepad API once a frame, turns
// raw buttons into press edges (with repeat for menu navigation), and tracks
// which input the player is using right now so prompts can show the right
// glyphs.
//
// Steam Deck (and any pad Steam is managing) reaches Chromium as a standard
// XInput-style gamepad, so the W3C "standard" mapping below covers it, Xbox,
// PlayStation and Switch Pro pads alike. Several connected pads are merged:
// any of them can drive the game.

export const BTN = {
	A: 0,
	B: 1,
	X: 2,
	Y: 3,
	LB: 4,
	RB: 5,
	LT: 6,
	RT: 7,
	VIEW: 8,
	MENU: 9,
	LS: 10,
	RS: 11,
	UP: 12,
	DOWN: 13,
	LEFT: 14,
	RIGHT: 15,
} as const;
export type BtnName = keyof typeof BTN;

export type PadFamily = 'xbox' | 'deck' | 'playstation' | 'nintendo';
export type InputMode = 'kbm' | 'pad';

export const STICK_DEADZONE = 0.22;
const NAV_REPEAT_DELAY = 360; // ms before a held direction starts repeating
const NAV_REPEAT_EVERY = 110;

export interface PadFrame {
	connected: boolean;
	/** Buttons that went down this frame. */
	pressed: Set<number>;
	/** Buttons that came up this frame. */
	released: Set<number>;
	/** Buttons held right now. */
	down: Set<number>;
	/** Analog trigger values 0..1 (LT, RT). */
	lt: number;
	rt: number;
	/** Sticks after the radial deadzone, each component -1..1. */
	left: { x: number; y: number };
	right: { x: number; y: number };
	/** Menu-navigation direction this frame (from the d-pad OR the left stick),
	 *  with key-repeat applied. Null when nothing fired. */
	nav: 'up' | 'down' | 'left' | 'right' | null;
	/** Same, but from the d-pad only (the left stick may be doing something else). */
	dpadNav: 'up' | 'down' | 'left' | 'right' | null;
}

function deadzone(x: number, y: number): { x: number; y: number } {
	const mag = Math.hypot(x, y);
	if (mag < STICK_DEADZONE) return { x: 0, y: 0 };
	// Rescale so output starts at 0 right past the deadzone instead of jumping.
	const scaled = Math.min(1, (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE));
	return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

function isSteamDeckHost(): boolean {
	const desktop: any = (globalThis as any).wildWillowsDesktop;
	if (desktop?.isSteamDeck) return true;
	try {
		// SteamOS ships Chromium with this UA bit; harmless elsewhere.
		return /Steam Deck|SteamOS/i.test(navigator.userAgent || '');
	} catch {
		return false;
	}
}

export function familyFromId(id: string): PadFamily {
	// Sony's vendor id, or its product names. NOT the bare words "Wireless
	// Controller": Xbox pads report "Xbox Wireless Controller" too.
	if (/054c|playstation|dualsense|dualshock/i.test(id)) return 'playstation';
	if (/057e|nintendo|pro controller|joy-con/i.test(id)) return 'nintendo';
	// On a Deck, Steam hands the game a virtual Xbox-style pad, so the Deck's own
	// labels win over anything the id says.
	if (/28de-1205|28de:1205|steam deck/i.test(id) || isSteamDeckHost()) return 'deck';
	return 'xbox';
}

// ---------------------------------------------------------------- input mode

type Listener = () => void;
const listeners = new Set<Listener>();
// A Steam Deck starts on its controls: the selection ring shows on the title
// screen before anything is pressed.
let mode: InputMode = isSteamDeckHost() ? 'pad' : 'kbm';
let family: PadFamily = isSteamDeckHost() ? 'deck' : 'xbox';
let everSeen = false;

export function getInputMode(): InputMode {
	return mode;
}
export function getPadFamily(): PadFamily {
	return family;
}
/** True once any controller has been used this session (or on a Steam Deck). */
export function padEverSeen(): boolean {
	return everSeen || isSteamDeckHost();
}
export function subscribePad(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
function emit() {
	if (typeof document !== 'undefined') document.body.classList.toggle('pad-active', mode === 'pad');
	listeners.forEach((fn) => {
		try {
			fn();
		} catch (e) {
			console.error('pad listener failed', e);
		}
	});
}
export function setInputMode(next: InputMode) {
	if (next === 'pad') everSeen = true;
	if (next === mode) return;
	mode = next;
	emit();
}
function setFamily(next: PadFamily) {
	if (next === family) return;
	family = next;
	emit();
}

/* A real keyboard press or a real mouse movement hands control back to
 * keyboard+mouse. Only TRUSTED events count: the controller layer itself
 * dispatches synthetic mouse and key events, and those must not flip the mode
 * back out from under the player. */
if (typeof window !== 'undefined') {
	let lastX = -1;
	let lastY = -1;
	window.addEventListener(
		'keydown',
		(e) => {
			if (e.isTrusted) setInputMode('kbm');
		},
		true,
	);
	window.addEventListener(
		'mousemove',
		(e) => {
			if (!e.isTrusted) return;
			// Ignore sub-pixel jitter and the single move a window focus can produce.
			// Not on a Steam Deck: its trackpads and screen taps arrive as mouse
			// events, and they shouldn't swap every prompt over to keyboard keys.
			if (family === 'deck') return;
			if (lastX >= 0 && Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 6) setInputMode('kbm');
			lastX = e.clientX;
			lastY = e.clientY;
		},
		true,
	);
	window.addEventListener(
		'pointerdown',
		(e) => {
			// A mouse or pen click. NOT a touch: tapping a Steam Deck's screen
			// mid-game shouldn't swap every prompt over to keyboard keys.
			if (family === 'deck') return; // see mousemove above
			if (e.isTrusted && (e.pointerType === 'mouse' || e.pointerType === 'pen')) setInputMode('kbm');
		},
		true,
	);
	// Browsers only announce a pad once one of its buttons is pressed, so this
	// IS the player reaching for it.
	// Hide the mouse pointer once it has sat still for a few seconds (a Deck's
	// trackpad, or a laptop mouse left alone while playing on keys or a pad).
	// Any real movement brings it straight back.
	let idleTimer = 0;
	const IDLE_MS = 3000;
	const wake = (e: Event) => {
		if (!e.isTrusted) return;
		document.documentElement.classList.remove('mouse-idle');
		window.clearTimeout(idleTimer);
		idleTimer = window.setTimeout(() => document.documentElement.classList.add('mouse-idle'), IDLE_MS);
	};
	window.addEventListener('mousemove', wake, { passive: true, capture: true });
	window.addEventListener('mousedown', wake, { passive: true, capture: true });

	window.addEventListener('gamepadconnected', (e: any) => {
		everSeen = true;
		setFamily(familyFromId(e.gamepad?.id || ''));
		setInputMode('pad');
		emit();
	});
	if (mode === 'pad') document.body?.classList.add('pad-active');
}

// --------------------------------------------------------------------- poll

const prevDown = new Set<number>();
const navHeld: { dir: PadFrame['nav']; since: number; last: number; fromDpad: boolean } = {
	dir: null,
	since: 0,
	last: 0,
	fromDpad: false,
};

function readPads(): Gamepad[] {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
	const out: Gamepad[] = [];
	for (const p of navigator.getGamepads()) if (p && p.connected) out.push(p);
	return out;
}

function stickDir(v: { x: number; y: number }): PadFrame['nav'] {
	// Wider threshold than the movement deadzone so a resting thumb never scrolls a menu.
	if (Math.hypot(v.x, v.y) < 0.5) return null;
	if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'right' : 'left';
	return v.y > 0 ? 'down' : 'up';
}

/** Read every pad and return this frame's merged state. Call once per frame. */
export function pollPads(now: number): PadFrame {
	const pads = readPads();
	const down = new Set<number>();
	let lx = 0,
		ly = 0,
		rx = 0,
		ry = 0,
		lt = 0,
		rt = 0;
	for (const p of pads) {
		p.buttons.forEach((b, i) => {
			if (b.pressed || b.value > 0.5) down.add(i);
		});
		const ax = p.axes;
		if (Math.hypot(ax[0] || 0, ax[1] || 0) > Math.hypot(lx, ly)) {
			lx = ax[0] || 0;
			ly = ax[1] || 0;
		}
		if (Math.hypot(ax[2] || 0, ax[3] || 0) > Math.hypot(rx, ry)) {
			rx = ax[2] || 0;
			ry = ax[3] || 0;
		}
		lt = Math.max(lt, p.buttons[BTN.LT]?.value || 0);
		rt = Math.max(rt, p.buttons[BTN.RT]?.value || 0);
	}
	const pressed = new Set<number>();
	const released = new Set<number>();
	for (const b of down) if (!prevDown.has(b)) pressed.add(b);
	for (const b of prevDown) if (!down.has(b)) released.add(b);
	prevDown.clear();
	for (const b of down) prevDown.add(b);

	const left = deadzone(lx, ly);
	const right = deadzone(rx, ry);

	if (pads.length && (pressed.size || Math.hypot(left.x, left.y) > 0.5 || Math.hypot(right.x, right.y) > 0.5)) {
		setFamily(familyFromId(pads[0].id));
		setInputMode('pad');
	}

	const dpad: PadFrame['nav'] = down.has(BTN.UP)
		? 'up'
		: down.has(BTN.DOWN)
			? 'down'
			: down.has(BTN.LEFT)
				? 'left'
				: down.has(BTN.RIGHT)
					? 'right'
					: null;
	const dir = dpad || stickDir(left);
	let nav: PadFrame['nav'] = null;
	if (!dir) {
		navHeld.dir = null;
	} else if (dir !== navHeld.dir) {
		navHeld.dir = dir;
		navHeld.since = now;
		navHeld.last = now;
		navHeld.fromDpad = !!dpad;
		nav = dir;
	} else if (now - navHeld.since > NAV_REPEAT_DELAY && now - navHeld.last > NAV_REPEAT_EVERY) {
		navHeld.last = now;
		nav = dir;
	}
	return {
		connected: pads.length > 0,
		pressed,
		released,
		down,
		lt,
		rt,
		left,
		right,
		nav,
		dpadNav: nav && navHeld.fromDpad ? nav : null,
	};
}

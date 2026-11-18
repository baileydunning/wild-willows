// Full controller support. Mounted once, inside GameProvider; renders nothing.
//
// Two modes, picked fresh every frame:
//
//  WORLD (no panel or popup open): the left stick walks, A interacts, the right
//  stick moves a pointer and the triggers click with it, the bumpers change
//  tools, the face buttons open the most-used panels and Menu opens the HUD.
//
//  MENUS (a panel, popup, dialog or the title screen is up, or the HUD is in
//  menu mode): the d-pad / left stick move a focus ring between controls, A
//  presses, B backs out, the bumpers switch tabs and the right stick scrolls.
//
// Panel shortcuts and the Escape chain are reached by dispatching the SAME key
// the player has bound (keybindings.ts) — App's keyboard handler does the rest,
// so the controller can never drift from what the keyboard does.

import { useEffect, useRef } from 'react';
import { bridge } from '../game/bridge';
import { keysFor } from '../keybindings';
import { useGame } from '../state';
import { clickAtCursor, cursorShown, driveCursor, moveCursorTo, showCursor } from './cursor';
import {
	activeSurface,
	adjustControl,
	clearRing,
	closeSurface,
	cycleSelect,
	cycleTabs,
	ensureRing,
	inHudMode,
	isTextField,
	moveRing,
	ringed,
	scrollSurface,
	setFieldValue,
	setHudMode,
	type Dir,
} from './nav';
import { BTN, getInputMode, pollPads, subscribePad } from './pad';

const SHAPING = new Set(['shovel', 'watering-can', 'paint']);
const CURSOR_IDLE_MS = 5000;

function keyEventInit(key: string): KeyboardEventInit {
	let code = '';
	if (key === ' ') code = 'Space';
	else if (/^[a-z]$/i.test(key)) code = `Key${key.toUpperCase()}`;
	else if (/^[0-9]$/.test(key)) code = `Digit${key}`;
	else code = key; // Escape, Tab, ArrowUp, …
	return { key, code, bubbles: true, cancelable: true };
}

/** Dispatch a key press on window, where every game shortcut listens. */
function pressKey(key: string) {
	window.dispatchEvent(new KeyboardEvent('keydown', keyEventInit(key)));
	window.dispatchEvent(new KeyboardEvent('keyup', keyEventInit(key)));
}

/** The first key bound to an action, as a KeyboardEvent.key. */
function boundKey(actionId: string): string | null {
	const tok = keysFor(actionId)[0];
	if (!tok) return null;
	if (tok === 'space') return ' ';
	if (tok.startsWith('arrow')) return 'Arrow' + tok.slice(5, 6).toUpperCase() + tok.slice(6);
	return tok;
}
function pressAction(actionId: string) {
	const k = boundKey(actionId);
	if (k) pressKey(k);
}

/** Ask Steam for its on-screen keyboard for a text field (Steam Deck, Big
 *  Picture). The floating keyboard types straight into the focused field; the
 *  older full-screen one hands back a string, which we write in. Does nothing
 *  outside Steam, where there is a physical keyboard. */
async function steamKeyboard(el: HTMLInputElement | HTMLTextAreaElement) {
	const steam: any = (globalThis as any).wildWillowsDesktop?.steam;
	if (!steam?.textInput) return;
	const r = el.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	try {
		const res = await steam.textInput({
			x: Math.round(r.left * dpr),
			y: Math.round(r.top * dpr),
			width: Math.round(r.width * dpr),
			height: Math.round(r.height * dpr),
			multiline: el.tagName === 'TEXTAREA',
			numeric: el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number',
			value: el.value,
			label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || '',
			max: el.maxLength > 0 ? el.maxLength : 200,
		});
		if (res && typeof res.text === 'string') setFieldValue(el, res.text);
	} catch {
		/* no keyboard — the field is still focused for a physical one */
	}
}

// The text field the player opened with A. B steps out of THAT field first
// (as Escape does on a keyboard); a field a panel focused on its own, like a
// search box, should not cost an extra press to close the panel.
let typingIn: HTMLElement | null = null;

/** Write the stick into the shared vector in place: Phaser reads it every
 *  frame, and this runs every frame, so no fresh object each time. */
function setPad(x: number, y: number) {
	const p = bridge.shared.pad;
	p.x = x;
	p.y = y;
}

function activate(el: HTMLElement) {
	if (isTextField(el)) {
		typingIn = el;
		el.focus();
		void steamKeyboard(el);
		return;
	}
	if (el.tagName === 'SELECT') {
		cycleSelect(el as HTMLSelectElement, 1);
		return;
	}
	if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') return; // ← → adjusts
	el.click();
}

/** Step a toolbelt sub-picker (brush sizes, paint swatches) left or right. */
function stepPicker(selector: string, sign: number): boolean {
	const opts = Array.from(document.querySelectorAll<HTMLElement>(selector));
	if (opts.length < 2) return false;
	const i = Math.max(
		0,
		opts.findIndex((o) => o.classList.contains('on')),
	);
	opts[(i + sign + opts.length) % opts.length].click();
	return true;
}

export function GamepadLayer() {
	const game = useGame();
	const gameRef = useRef(game);
	useEffect(() => {
		gameRef.current = game;
	}, [game]);

	useEffect(() => {
		let raf = 0;
		let last = 0;
		let lastSurface: HTMLElement | null = null;
		let lastEnsure = 0;
		let cursorActiveAt = 0;
		// The pointer was put away because a menu opened over it (a confirm, a
		// popup): it comes back exactly where it was, still aimed at the same tile.
		let cursorParked = false;
		const sweepHeld = new Set<string>();

		const releaseSweep = () => {
			for (const k of sweepHeld) window.dispatchEvent(new KeyboardEvent('keyup', keyEventInit(k)));
			sweepHeld.clear();
		};
		const setSweep = (want: Set<string>) => {
			for (const k of sweepHeld)
				if (!want.has(k)) {
					window.dispatchEvent(new KeyboardEvent('keyup', keyEventInit(k)));
					sweepHeld.delete(k);
				}
			for (const k of want)
				if (!sweepHeld.has(k)) {
					window.dispatchEvent(new KeyboardEvent('keydown', keyEventInit(k)));
					sweepHeld.add(k);
				}
		};

		const recenterCursor = () => {
			const p = bridge.shared.playerScreen;
			const canvas = document.querySelector('.game-screen canvas') as HTMLCanvasElement | null;
			if (p && canvas) {
				const r = canvas.getBoundingClientRect();
				const sx = r.width / (canvas.width || r.width);
				const sy = r.height / (canvas.height || r.height);
				// one tile to the side the caretaker faces, so the ghost isn't under them
				moveCursorTo(r.left + p.x * sx + 36 * (p.facingLeft ? -1 : 1), r.top + p.y * sy);
			} else moveCursorTo(innerWidth / 2 + 36, innerHeight / 2);
		};

		const cycleTool = (sign: number) => {
			const g = gameRef.current;
			const st = g.state;
			if (!st) return;
			const tools = ['basket', 'shovel', 'watering-can'];
			if (st.player.area === 'home' && st.player.home?.styleLocked) tools.push('paint');
			// the toolbelt isn't handed over until its tutorial step
			if (!document.querySelector('.toolbelt')) return;
			const i = Math.max(0, tools.indexOf(g.selectedTool));
			g.setSelectedTool(tools[(i + sign + tools.length) % tools.length]);
		};

		const back = (surface: HTMLElement) => {
			const active = document.activeElement as HTMLElement | null;
			if (active && (isTextField(active) || active.tagName === 'SELECT')) {
				active.blur();
				if (active === typingIn) {
					typingIn = null;
					return;
				}
			}
			if (inHudMode() && surface.classList.contains('ui-layer')) {
				setHudMode(false);
				return;
			}
			if (document.querySelector('.game-screen') || surface.closest('.game-screen')) {
				pressKey('Escape');
				return;
			}
			if (!closeSurface(surface)) pressKey('Escape');
		};

		const enterHud = () => {
			const toggle = document.querySelector<HTMLElement>('.hud-top-right.nav-collapsed .nav-toggle');
			toggle?.click(); // unfold a tucked-away menu first
			setHudMode(true);
			clearRing();
			lastSurface = null;
		};

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
			last = now;
			const f = pollPads(now);
			if (!f.connected) {
				setPad(0, 0);
				if (cursorShown()) showCursor(false);
				return;
			}
			const padMode = getInputMode() === 'pad';
			const inGame = !!document.querySelector('.game-screen');
			if (!inGame && inHudMode()) setHudMode(false);
			const surface = activeSurface();

			// ------------------------------------------------------------ menus
			if (surface) {
				setPad(0, 0);
				if (cursorShown()) {
					showCursor(false);
					cursorParked = true;
				}
				if (surface !== lastSurface) {
					releaseSweep();
					clearRing();
					lastSurface = surface;
					lastEnsure = 0;
				}
				const hadRing = !!ringed();
				if (padMode && now - lastEnsure > 150 && !hadRing) {
					lastEnsure = now;
					ensureRing(surface);
				}
				const sweep = !!surface.querySelector('[data-pad-sweep]');
				if (sweep) {
					const want = new Set<string>();
					if (f.left.x > 0.35) want.add('ArrowRight');
					if (f.left.x < -0.35) want.add('ArrowLeft');
					if (f.left.y > 0.35) want.add('ArrowDown');
					if (f.left.y < -0.35) want.add('ArrowUp');
					setSweep(want);
				} else if (sweepHeld.size) releaseSweep();

				const nav: Dir | null = sweep ? f.dpadNav : f.nav;
				if (nav) {
					const cur = ringed();
					if (!(cur && surface.contains(cur) && adjustControl(cur, nav))) moveRing(surface, nav);
				}
				if (f.pressed.has(BTN.A)) {
					// With no ring showing yet (first press, or just back from the
					// mouse), A only reveals the ring: pressing something you could
					// not see was selected is worse than one extra press.
					const cur = ringed();
					if (cur && hadRing) activate(cur);
					else ensureRing(surface);
				}
				if (f.pressed.has(BTN.B)) back(surface);
				if (f.pressed.has(BTN.LB)) cycleTabs(surface, -1);
				if (f.pressed.has(BTN.RB)) cycleTabs(surface, 1);
				if (Math.abs(f.right.y) > 0) scrollSurface(surface, f.right.y * 1100 * dt);
				if (f.pressed.has(BTN.MENU)) {
					if (inHudMode() && surface.classList.contains('ui-layer')) setHudMode(false);
					else if (inGame) pressKey('Escape');
				}
				// Face-button shortcuts still jump straight between game panels.
				if (inGame && !surface.classList.contains('ui-layer')) {
					if (f.pressed.has(BTN.X)) pressAction('crafting');
					if (f.pressed.has(BTN.Y)) pressAction('basket');
					if (f.pressed.has(BTN.VIEW)) pressAction('preserve');
				}
				return;
			}

			// ------------------------------------------------------------ world
			if (lastSurface) {
				releaseSweep();
				clearRing();
				const a = document.activeElement as HTMLElement | null;
				if (a && a !== document.body) a.blur(); // don't leave focus on a closed panel
				lastSurface = null;
			}
			setPad(f.left.x, f.left.y);
			const g = gameRef.current;
			const placing = bridge.shared.placing;
			const aiming = placing || SHAPING.has(g.selectedTool);
			const stickMoved = Math.abs(f.right.x) + Math.abs(f.right.y) > 0;
			if (stickMoved) cursorActiveAt = now;
			const wantCursor = padMode && (aiming || now - cursorActiveAt < CURSOR_IDLE_MS);
			if (wantCursor && !cursorShown()) {
				if (!cursorParked) recenterCursor();
				showCursor(true);
			} else if (!wantCursor && cursorShown()) showCursor(false);
			cursorParked = false;
			if (stickMoved) driveCursor(f.right.x, f.right.y, dt);

			if (f.pressed.has(BTN.A)) bridge.emit('pad-interact');
			if (f.pressed.has(BTN.B)) {
				if (placing) bridge.emit('pad-cancel');
				else pressKey('Escape');
			}
			if (f.pressed.has(BTN.X)) pressAction('crafting');
			if (f.pressed.has(BTN.Y)) pressAction('basket');
			if (f.pressed.has(BTN.VIEW)) pressAction('preserve');
			if (f.pressed.has(BTN.MENU)) enterHud();
			if (f.pressed.has(BTN.LB)) cycleTool(-1);
			if (f.pressed.has(BTN.RB)) cycleTool(1);
			if (f.pressed.has(BTN.LS)) pressKey('Tab'); // task board
			if (f.pressed.has(BTN.RS)) {
				cursorActiveAt = now;
				recenterCursor();
				showCursor(true);
			}
			if (f.pressed.has(BTN.RT) || f.pressed.has(BTN.LT)) {
				cursorActiveAt = now;
				if (!cursorShown()) {
					recenterCursor();
					showCursor(true);
				}
				clickAtCursor(f.pressed.has(BTN.LT));
			}
			if (f.pressed.has(BTN.UP)) bridge.emit('pad-zoom', 1);
			if (f.pressed.has(BTN.DOWN)) bridge.emit('pad-zoom', -1);
			for (const [btn, sign] of [
				[BTN.LEFT, -1],
				[BTN.RIGHT, 1],
			] as const) {
				if (!f.pressed.has(btn)) continue;
				if (placing) bridge.emit('pad-rotate', sign);
				else if (g.selectedTool === 'paint') stepPicker('.paint-palette .paint-swatch', sign);
				else stepPicker('.brush-sizes .brush-size', sign);
			}
		};
		raf = requestAnimationFrame(frame);

		// Switching back to keyboard/mouse drops the ring and the virtual pointer.
		const unsub = subscribePad(() => {
			if (getInputMode() === 'kbm') {
				clearRing();
				showCursor(false);
				if (inHudMode()) setHudMode(false);
			}
		});
		return () => {
			cancelAnimationFrame(raf);
			releaseSweep();
			unsub();
			showCursor(false);
			clearRing();
			bridge.shared.pad = { x: 0, y: 0 };
		};
	}, []);

	return null;
}

// Full controller support. Mounted once, inside GameProvider; renders nothing.
//
// Two modes, picked fresh every frame:
//
//  WORLD (no panel or popup open): the left stick walks, A interacts, R2 uses
//  the tool in hand on the aim tile beside the caretaker (the right stick moves
//  that tile), the bumpers change tools, the face buttons open the most-used
//  panels and Menu opens the menus.
//
//  MENUS (a panel, popup, dialog or the title screen is up, or the HUD is in
//  focus mode): the d-pad / left stick move a focus ring between controls, A
//  presses, B backs out, L1/R1 move between menus, L2/R2 switch tabs inside
//  one and the right stick scrolls.
//
// Panel shortcuts and the Escape chain are reached by dispatching the SAME key
// the player has bound (keybindings.ts) — App's keyboard handler does the rest,
// so the controller can never drift from what the keyboard does.

import { useEffect, useRef } from 'react';
import { bridge } from '../game/bridge';
import { keysFor } from '../keybindings';
import { useGame } from '../state';
import { clickAtCursor, cursorShown, moveCursorTo, showCursor } from './cursor';
import { closeMenu, currentMenu, openLastMenu, stepMenu } from './menus';
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
	refreshAutoRing,
	ringed,
	scrollSurface,
	setHudMode,
	type Dir,
} from './nav';
import { BTN, getInputMode, pollPads, subscribePad } from './pad';
import { closeKeyboard, keyboardActions, openKeyboard } from '../ui/OnScreenKeyboard';

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

/** Write the stick into the shared vector in place: Phaser reads it every
 *  frame, and this runs every frame, so no fresh object each time. */
function setPad(x: number, y: number) {
	const p = bridge.shared.pad;
	p.x = x;
	p.y = y;
}

function activate(el: HTMLElement) {
	if (isTextField(el)) {
		openKeyboard(el);
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

		// Park the (invisible) pointer on the scene's aim tile, so the placement
		// ghost, the dig/water marker and any click all land there.
		const aimCursor = () => {
			const p = bridge.shared.playerScreen;
			const canvas = document.querySelector('.game-screen canvas') as HTMLCanvasElement | null;
			if (!p || !canvas) return;
			const r = canvas.getBoundingClientRect();
			const sx = r.width / (canvas.width || r.width);
			const sy = r.height / (canvas.height || r.height);
			moveCursorTo(r.left + p.aimX * sx, r.top + p.aimY * sy);
		};
		// The right stick steps the aim tile around the caretaker, one tile per
		// push and repeating while held, like moving through a grid.
		const aimHeld = { dir: '', since: 0, last: 0 };
		const stepAim = (rx: number, ry: number, now: number) => {
			const mag = Math.hypot(rx, ry);
			if (mag < 0.5) {
				aimHeld.dir = '';
				return;
			}
			const x = Math.abs(rx) > 0.38 * mag ? Math.sign(rx) : 0;
			const y = Math.abs(ry) > 0.38 * mag ? Math.sign(ry) : 0;
			const dir = `${x},${y}`;
			if (dir !== aimHeld.dir) {
				aimHeld.dir = dir;
				aimHeld.since = now;
				aimHeld.last = now;
			} else if (now - aimHeld.since < 320 || now - aimHeld.last < 150) return;
			else aimHeld.last = now;
			bridge.emit('pad-aim', { x, y });
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
			if (active && (isTextField(active) || active.tagName === 'SELECT')) active.blur();
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

		const menus = () => {
			const g = gameRef.current;
			return { panel: g.panel, helpOpen: g.helpOpen, setPanel: g.setPanel, setHelpOpen: g.setHelpOpen };
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
				// A Steam Deck starts in controller mode, and the browser hides its
				// pad until a button is pressed: show the ring anyway, so the very
				// first screen already says what A will press.
				const s0 = getInputMode() === 'pad' ? activeSurface() : null;
				if (s0) {
					if (s0 !== lastSurface) {
						clearRing();
						lastSurface = s0;
					}
					if (now - lastEnsure > 150) {
						lastEnsure = now;
						if (!ringed()) ensureRing(s0);
						else refreshAutoRing(s0);
					}
				}
				return;
			}
			const padMode = getInputMode() === 'pad';
			const inGame = !!document.querySelector('.game-screen');
			if (!inGame && inHudMode()) setHudMode(false);
			const surface = activeSurface();

			// ------------------------------------------------------------ menus
			if (surface) {
				setPad(0, 0);
				if (cursorShown()) showCursor(false);
				if (surface !== lastSurface) {
					releaseSweep();
					clearRing();
					lastSurface = surface;
					lastEnsure = 0;
				}
				const hadRing = !!ringed();
				if (padMode && now - lastEnsure > 150) {
					lastEnsure = now;
					if (!hadRing) ensureRing(surface);
					else refreshAutoRing(surface);
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
				// The on-screen keyboard: A types the key under the ring (below), and
				// the face buttons are its shortcuts. B closes it, keeping the text.
				if (surface.hasAttribute('data-pad-keyboard')) {
					if (f.pressed.has(BTN.X)) keyboardActions.backspace();
					if (f.pressed.has(BTN.Y)) keyboardActions.space();
					if (f.pressed.has(BTN.LB)) keyboardActions.shift();
					if (f.pressed.has(BTN.B) || f.pressed.has(BTN.MENU)) closeKeyboard();
					if (f.pressed.has(BTN.A)) {
						const cur = ringed();
						if (cur && hadRing) cur.click();
						else ensureRing(surface);
					}
					return;
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
				// L1/R1 move between the game's menus (journal → achievements → …);
				// L2/R2 switch the tabs inside one. A popup that isn't one of those
				// menus (a chest, an animal card) keeps L1/R1 for its tabs.
				const inMenu = inGame && !!currentMenu(menus());
				if (f.pressed.has(BTN.LB) && !(inMenu && stepMenu(menus(), -1))) cycleTabs(surface, -1);
				if (f.pressed.has(BTN.RB) && !(inMenu && stepMenu(menus(), 1))) cycleTabs(surface, 1);
				if (f.pressed.has(BTN.LT)) cycleTabs(surface, -1);
				if (f.pressed.has(BTN.RT)) cycleTabs(surface, 1);
				if (Math.abs(f.right.y) > 0) scrollSurface(surface, f.right.y * 1100 * dt);
				if (f.pressed.has(BTN.MENU)) {
					if (inHudMode() && surface.classList.contains('ui-layer')) setHudMode(false);
					else if (inMenu) closeMenu(menus());
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
			// On a controller the pointer is never drawn: it sits on the aim tile.
			if (padMode && !cursorShown()) showCursor(true, false);
			else if (!padMode && cursorShown()) showCursor(false);
			if (padMode) {
				stepAim(f.right.x, f.right.y, now);
				aimCursor();
			}

			if (f.pressed.has(BTN.A)) bridge.emit('pad-interact');
			if (f.pressed.has(BTN.B)) {
				if (placing) bridge.emit('pad-cancel');
				else pressKey('Escape');
			}
			if (f.pressed.has(BTN.X)) pressAction('crafting');
			if (f.pressed.has(BTN.Y)) pressAction('basket');
			if (f.pressed.has(BTN.VIEW)) pressAction('preserve');
			if (f.pressed.has(BTN.MENU)) openLastMenu(menus());
			if (f.pressed.has(BTN.LB)) cycleTool(-1);
			if (f.pressed.has(BTN.RB)) cycleTool(1);
			// L3 puts the focus ring on the HUD itself: the goals board, the task
			// board, the tutorial card's buttons, the menu bar.
			if (f.pressed.has(BTN.LS)) enterHud();
			if (f.pressed.has(BTN.RS)) bridge.emit('pad-aim-reset');
			if (f.pressed.has(BTN.RT) || f.pressed.has(BTN.LT)) {
				if (!cursorShown()) showCursor(true, false);
				aimCursor();
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

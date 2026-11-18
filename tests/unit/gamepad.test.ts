import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BTN, familyFromId, getInputMode, pollPads, setInputMode } from '../../src/gamepad/pad';
import { adjustControl, cycleTabs, moveRing, ringed, setRing } from '../../src/gamepad/nav';
import { PAD_SHORTCUTS } from '../../src/shortcuts';

// Controller support (src/gamepad). The pad layer reads the W3C standard
// mapping, so these fake a Gamepad object the way Chromium hands one over —
// on a Steam Deck that is Steam's virtual Xbox-style pad.

function fakePad(id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)') {
	return {
		id,
		index: 0,
		connected: true,
		mapping: 'standard',
		timestamp: 0,
		buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
		axes: [0, 0, 0, 0],
	};
}

describe('familyFromId', () => {
	it('does not mistake an Xbox pad for a PlayStation one', () => {
		// Both report "Wireless Controller"; only Sony's vendor id means PlayStation.
		expect(familyFromId('Xbox Wireless Controller (Vendor: 045e Product: 0b13)')).toBe('xbox');
		expect(familyFromId('DualSense Wireless Controller (Vendor: 054c Product: 0ce6)')).toBe('playstation');
	});
	it('recognizes Switch pads and the Deck itself', () => {
		expect(familyFromId('Pro Controller (Vendor: 057e Product: 2009)')).toBe('nintendo');
		expect(familyFromId('Steam Deck (Vendor: 28de Product: 1205)')).toBe('deck');
	});
});

describe('pollPads', () => {
	let pad: ReturnType<typeof fakePad>;
	beforeEach(() => {
		pad = fakePad();
		vi.stubGlobal('navigator', { ...navigator, getGamepads: () => [pad, null, null, null] });
		pollPads(0); // settle edge state from any previous test
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		setInputMode('kbm');
	});

	it('reports a press once, on the frame it goes down', () => {
		pad.buttons[BTN.A] = { pressed: true, touched: true, value: 1 };
		expect(pollPads(16).pressed.has(BTN.A)).toBe(true);
		expect(pollPads(32).pressed.has(BTN.A)).toBe(false);
		pad.buttons[BTN.A] = { pressed: false, touched: false, value: 0 };
		expect(pollPads(48).released.has(BTN.A)).toBe(true);
	});

	it('switches the game into controller mode on use', () => {
		setInputMode('kbm');
		pad.buttons[BTN.B] = { pressed: true, touched: true, value: 1 };
		pollPads(16);
		expect(getInputMode()).toBe('pad');
	});

	it('ignores a resting stick and rescales past the deadzone', () => {
		pad.axes = [0.1, -0.1, 0, 0];
		expect(pollPads(16).left).toEqual({ x: 0, y: 0 });
		pad.axes = [1, 0, 0, 0];
		const f = pollPads(32);
		expect(f.left.x).toBeCloseTo(1);
		expect(f.nav).toBe('right');
	});

	it('repeats a held direction for menus only after a delay', () => {
		pad.buttons[BTN.DOWN] = { pressed: true, touched: true, value: 1 };
		expect(pollPads(1000).nav).toBe('down');
		expect(pollPads(1100).nav).toBe(null); // still inside the repeat delay
		expect(pollPads(1500).nav).toBe('down'); // repeating now
		expect(pollPads(1500).dpadNav).toBe(null);
	});
});

describe('focus ring navigation', () => {
	// jsdom has no layout, so each control gets a fixed box.
	function place(el: HTMLElement, x: number, y: number, w = 80, h = 30) {
		el.getBoundingClientRect = () =>
			({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y, toJSON() {} }) as DOMRect;
	}
	let root: HTMLElement;
	beforeEach(() => {
		Element.prototype.scrollIntoView = () => {}; // jsdom has no scrolling
		document.body.innerHTML = '';
		root = document.createElement('div');
		root.className = 'panel-backdrop';
		document.body.appendChild(root);
		// make the backdrop itself "visible" for activeSurface()
		place(root, 0, 0, 1280, 800);
	});

	it('prefers the control in the same row over a nearer one diagonally above', () => {
		// The character screen: Back and Begin share the footer, a row of hat chips
		// sits just above Back's right edge.
		root.innerHTML =
			'<button id="back">Back</button><button id="hat">Pirate hat</button><button id="go">Begin</button>';
		const [back, hat, go] = ['back', 'hat', 'go'].map((id) => document.getElementById(id)!);
		place(back, 240, 627, 117, 46);
		place(hat, 432, 574, 79, 25);
		place(go, 839, 627, 201, 46);
		setRing(back, false);
		moveRing(root, 'right');
		expect(ringed()).toBe(go);
	});

	it('goes down to the next row instead of skipping to something in line further down', () => {
		// Settings: a theme button on the left, a column of toggles on the right,
		// and a dropdown much further down that happens to line up with the button.
		root.innerHTML = '<button id="dark">Dark</button><button id="sw">toggle</button><button id="sel">Off</button>';
		const [dark, sw, sel] = ['dark', 'sw', 'sel'].map((id) => document.getElementById(id)!);
		place(dark, 684, 316, 76, 28);
		place(sw, 807, 377, 46, 26);
		place(sel, 724, 652, 129, 30);
		setRing(dark, false);
		moveRing(root, 'down');
		expect(ringed()).toBe(sw);
	});

	it('moves a slider with left/right instead of leaving it', () => {
		root.innerHTML = '<input type="range" min="0" max="100" step="1" value="50" />';
		const r = root.querySelector('input')!;
		let seen = '';
		r.addEventListener('input', () => (seen = r.value));
		expect(adjustControl(r, 'right')).toBe(true);
		expect(seen).toBe('60');
		expect(adjustControl(r, 'up')).toBe(false);
	});

	it('steps through a tab row with the bumpers', () => {
		root.innerHTML = '<div class="tabs"><button class="on">A</button><button>B</button><button>C</button></div>';
		const tabs = Array.from(root.querySelectorAll('button'));
		tabs.forEach((t, i) => place(t, i * 90, 10));
		let clicked = '';
		tabs.forEach((t) => t.addEventListener('click', () => (clicked = t.textContent || '')));
		expect(cycleTabs(root, 1)).toBe(true);
		expect(clicked).toBe('B');
		expect(cycleTabs(root, -1)).toBe(true);
		expect(clicked).toBe('C'); // wraps from the selected first tab
	});
});

describe('controller map', () => {
	const en = JSON.parse(readFileSync(resolve(__dirname, '../../src/i18n/en/panels.json'), 'utf8'));
	const es = JSON.parse(readFileSync(resolve(__dirname, '../../src/i18n/es/panels.json'), 'utf8'));
	const get = (o: any, key: string) => key.split('.').reduce((n, k) => n?.[k], o);

	it('every row has English and Spanish copy', () => {
		for (const row of PAD_SHORTCUTS) {
			const key = row.does.replace(/^panels\./, '');
			expect(get(en, key), row.does).toBeTypeOf('string');
			expect(get(es, key), row.does).toBeTypeOf('string');
		}
	});

	it('confirms go through confirmAsync, which only swaps the dialog on a controller', () => {
		// window.confirm is drawn by the OS: no controller can press its buttons,
		// so callers never use it directly. On keyboard/mouse confirmAsync still does.
		for (const f of ['src/App.tsx', 'src/ui/Panels.tsx', 'src/ui/Settings.tsx', 'src/ui/Welcome.tsx']) {
			const src = readFileSync(resolve(__dirname, '../..', f), 'utf8');
			expect(src, f).not.toMatch(/window\.confirm\(/);
		}
	});
});

describe('L1/R1 menu cycle', () => {
	function game(panel: string | null, helpOpen = false) {
		const g = {
			panel,
			helpOpen,
			setPanel: (p: string | null) => (g.panel = p),
			setHelpOpen: (v: boolean) => (g.helpOpen = v),
		};
		return g;
	}

	it('walks the HUD order and wraps through How to Play', async () => {
		const { stepMenu, currentMenu } = await import('../../src/gamepad/menus');
		const g = game('journal');
		stepMenu(g, 1);
		expect(g.panel).toBe('achievements');
		stepMenu(g, -1);
		stepMenu(g, -1);
		expect(currentMenu(g)).toBe('help'); // journal ← help wraps around
		expect(g.panel).toBe(null);
		stepMenu(g, 1);
		expect(g.helpOpen).toBe(false);
		expect(g.panel).toBe('journal');
	});

	it('leaves popups that are not menus alone', async () => {
		const { stepMenu } = await import('../../src/gamepad/menus');
		const g = game('chest');
		expect(stepMenu(g, 1)).toBe(false);
		expect(g.panel).toBe('chest');
	});
});

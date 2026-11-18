// Button caps for on-screen prompts, per controller family. Like keyboard key
// caps these are symbols, not words, so they are not run through i18n. The
// standard mapping is POSITIONAL (index 0 is always the bottom face button), so
// a Switch pad's south button is labelled B even though it fires BTN.A here.

import { useSyncExternalStore } from 'react';
import { getInputMode, getPadFamily, padEverSeen, subscribePad, type BtnName, type PadFamily } from './pad';

const CAPS: Record<PadFamily, Record<BtnName, string>> = {
	xbox: {
		A: 'A',
		B: 'B',
		X: 'X',
		Y: 'Y',
		LB: 'LB',
		RB: 'RB',
		LT: 'LT',
		RT: 'RT',
		VIEW: 'View',
		MENU: 'Menu',
		LS: 'LS',
		RS: 'RS',
		UP: '↑',
		DOWN: '↓',
		LEFT: '←',
		RIGHT: '→',
	},
	deck: {
		A: 'A',
		B: 'B',
		X: 'X',
		Y: 'Y',
		LB: 'L1',
		RB: 'R1',
		LT: 'L2',
		RT: 'R2',
		VIEW: '⧉',
		MENU: '☰',
		LS: 'L3',
		RS: 'R3',
		UP: '↑',
		DOWN: '↓',
		LEFT: '←',
		RIGHT: '→',
	},
	playstation: {
		A: '✕',
		B: '○',
		X: '□',
		Y: '△',
		LB: 'L1',
		RB: 'R1',
		LT: 'L2',
		RT: 'R2',
		VIEW: 'Create',
		MENU: 'Options',
		LS: 'L3',
		RS: 'R3',
		UP: '↑',
		DOWN: '↓',
		LEFT: '←',
		RIGHT: '→',
	},
	nintendo: {
		A: 'B',
		B: 'A',
		X: 'Y',
		Y: 'X',
		LB: 'L',
		RB: 'R',
		LT: 'ZL',
		RT: 'ZR',
		VIEW: '−',
		MENU: '+',
		LS: 'LS',
		RS: 'RS',
		UP: '↑',
		DOWN: '↓',
		LEFT: '←',
		RIGHT: '→',
	},
};

/** The cap to print for a button on the pad in use. */
export function padCap(btn: BtnName): string {
	return CAPS[getPadFamily()][btn];
}

let snap = { mode: getInputMode(), family: getPadFamily(), seen: padEverSeen() };
function snapshot() {
	const next = { mode: getInputMode(), family: getPadFamily(), seen: padEverSeen() };
	if (next.mode !== snap.mode || next.family !== snap.family || next.seen !== snap.seen) snap = next;
	return snap;
}

/** React hook: re-renders when the player switches between keyboard and pad,
 *  or picks up a different kind of pad. */
export function usePadState() {
	return useSyncExternalStore(subscribePad, snapshot, snapshot);
}

/** Interpolation values for copy that names controller buttons ("press {a}").
 *  `words` translates the stick names, which are words rather than symbols. */
export function padVars(words: (key: string) => string): Record<string, string> {
	return {
		a: padCap('A'),
		b: padCap('B'),
		x: padCap('X'),
		y: padCap('Y'),
		lb: padCap('LB'),
		rb: padCap('RB'),
		lt: padCap('LT'),
		rt: padCap('RT'),
		view: padCap('VIEW'),
		menu: padCap('MENU'),
		ls: padCap('LS'),
		up: padCap('UP'),
		down: padCap('DOWN'),
		rs: padCap('RS'),
		stick: words('panels.help.pad.cap.leftStick').toLowerCase(),
		rstick: words('panels.help.pad.cap.rightStick').toLowerCase(),
	};
}

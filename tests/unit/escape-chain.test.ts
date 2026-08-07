import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// App.tsx keeps "one consistent close chain" for Escape, and its own comment
// records that this has already regressed once — Esc "sometimes worked" because
// the plant/placement popups were never added to it. The failure mode is the same
// every time: something new appears on top, dismisses itself with a listener of
// its own, and now one keypress closes two things at once.
//
// That is precisely what the coach banner did. It appears OVER the menu it is
// describing, so a press that closed both left no way to dismiss the hint and keep
// reading the menu. These assertions pin the ordering so the next thing added on
// top has to join the chain rather than race it.

const APP = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
const COACH = readFileSync(resolve(__dirname, '../../src/ui/CoachTips.tsx'), 'utf8');

/** The body of the `if (k === 'escape') { … }` branch, brace-matched. */
function escapeBranch(): string {
	const at = APP.indexOf("if (k === 'escape')");
	expect(at, "App.tsx no longer has an `if (k === 'escape')` branch").toBeGreaterThan(-1);
	const open = APP.indexOf('{', at);
	let depth = 0;
	for (let i = open; i < APP.length; i++) {
		if (APP[i] === '{') depth++;
		else if (APP[i] === '}' && --depth === 0) return APP.slice(open + 1, i);
	}
	throw new Error('unbalanced braces in the escape branch');
}

describe("Escape's close chain", () => {
	const branch = escapeBranch();
	const at = (needle: string) => {
		const i = branch.indexOf(needle);
		expect(i, `${needle} is not in the Escape chain`).toBeGreaterThan(-1);
		return i;
	};

	it('closes every layer that can sit on top of a panel', () => {
		for (const step of ['devOpen', 'helpOpen', 'clickedBed', 'clickedPlacement', 'dismissCoachTip', 'toasts']) {
			at(step);
		}
	});

	it('dismisses a floating message before the panel underneath it', () => {
		// The whole point: a menu's coach hint has to be dismissable without also
		// closing the menu it explains.
		expect(at('dismissCoachTip()')).toBeLessThan(at('setPanel(null)'));
		expect(at('dismissToast(')).toBeLessThan(at('setPanel(null)'));
	});

	it('leaves placement mode last, so Esc never cancels a placement early', () => {
		expect(at('setPanel(null)')).toBeLessThan(at('cancelPlacement()'));
	});

	it('spends the keypress on exactly one thing', () => {
		// Every guard in the chain has to bail out, or one press falls through and
		// closes the next layer down too — which is the bug this whole chain exists
		// to prevent. Counting is enough: fewer returns than guards means at least
		// one of them runs on into its neighbour.
		const guards = branch.split('\n').filter((l) => /^\s*if \(/.test(l)).length;
		const returns = branch.split('\n').filter((l) => /\breturn;/.test(l)).length;
		expect(guards).toBeGreaterThanOrEqual(5);
		expect(returns, `${guards} guards but only ${returns} returns`).toBeGreaterThanOrEqual(guards);
	});

	it('leaves Escape to the chain instead of listening for it separately', () => {
		// A private keydown listener is how the double-close came back last time.
		expect(COACH).not.toMatch(/addEventListener\(\s*'keydown'/);
		expect(COACH).toContain('export function dismissCoachTip');
	});

	it('re-reads the toast list rather than closing over a stale one', () => {
		// The handler is installed in an effect; if `toasts` is missing from its
		// dependencies, Esc keeps dismissing from whatever list existed when the
		// listener was attached — usually an empty one.
		const deps = APP.slice(APP.indexOf("if (k === 'escape')"));
		const arr = deps.slice(deps.indexOf('\t}, ['), deps.indexOf(']);') + 1);
		expect(arr).toContain('toasts');
		expect(arr).toContain('dismissToast');
	});
});

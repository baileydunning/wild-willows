import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A coach hint explains the thing you are looking at right now, so it should
// outlive neither that thing nor your attention. Menu hints already cleared when
// their menu closed; the home hint didn't clear when you walked out of your home,
// so a note about the house followed the player across the whole preserve — and
// with its close button rendering 0px wide (see icon-buttons.test.ts), there was
// no way to get rid of it at all.
//
// Two bugs compounding is what made it feel permanent. This pins the rule that
// prevents the first: every hint is tied to something, and goes when that goes.

const SRC = readFileSync(resolve(__dirname, '../../src/ui/CoachTips.tsx'), 'utf8');

describe('coach tips', () => {
	const fired = [...SRC.matchAll(/fireRef\.current\(\{([\s\S]*?)\}\);/g)].map((m) => m[1]);

	it('raises at least the menu and home hints', () => {
		expect(fired.length).toBeGreaterThanOrEqual(2);
	});

	it('ties every hint to the menu or the place it describes', () => {
		for (const call of fired) {
			expect(call, `hint is missing panelTie: ${call.trim()}`).toContain('panelTie:');
			expect(call, `hint is missing areaTie: ${call.trim()}`).toContain('areaTie:');
			// Both null would mean nothing can ever clear it but the player, which is
			// how the home hint became permanent.
			const bothNull = /panelTie:\s*null/.test(call) && /areaTie:\s*null/.test(call);
			expect(bothNull, `hint is tied to nothing and will never clear: ${call.trim()}`).toBe(false);
		}
	});

	it('clears a hint when its menu closes and when its area is left', () => {
		expect(SRC).toMatch(/a\.panelTie && a\.panelTie !== panel \? null : a/);
		expect(SRC).toMatch(/a\.areaTie && a\.areaTie !== area \? null : a/);
	});

	it('sends the home hint out with the player', () => {
		const home = fired.find((c) => /id: 'home'/.test(c));
		expect(home, "the home hint is gone — if it moved, keep it tied to 'home'").toBeTruthy();
		expect(home!).toMatch(/areaTie: 'home'/);
	});
});

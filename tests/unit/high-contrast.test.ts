import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The "High contrast" option is a promise about numbers: text and edges clear
// WCAG AA against the surfaces they sit on. A hand-picked hex can drift a shade
// lighter in a later tweak and silently stop clearing it — nothing renders wrong,
// it just quietly isn't high contrast any more. So measure the shipped CSS.
//
// The second half of the promise is that it stays COZY: same warm cream-and-green
// palette, deepened — not the stark black-on-white the colorblind modes use. That
// is asserted too, because "make it readable" is otherwise trivially satisfied by
// #000 on #fff, which is exactly what was asked NOT to happen.

const CSS = readFileSync(resolve(__dirname, '../../src/styles.css'), 'utf8');

/** Pull the custom properties out of one selector's block. */
function varsIn(selector: string): Record<string, string> {
	const at = CSS.indexOf(selector + ' {');
	expect(at, `${selector} not found in styles.css`).toBeGreaterThan(-1);
	const block = CSS.slice(at, CSS.indexOf('}', at));
	const out: Record<string, string> = {};
	for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]] = m[2];
	return out;
}

const rgb = (hex: string): [number, number, number] => {
	const h = hex.replace('#', '');
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h;
	return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** WCAG relative luminance. */
function luminance(hex: string): number {
	const [r, g, b] = rgb(hex).map((c) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5; // body text
const AA_UI = 3.0; // borders, large text

describe('high contrast', () => {
	const hc = varsIn("[data-high-contrast='1']");
	const base = varsIn(':root');

	it('defines the whole palette, not a subset', () => {
		// A partial override is the dangerous shape: the un-overridden colours keep
		// their low-contrast values and sit next to the deepened ones.
		for (const key of [
			'ink',
			'ink-soft',
			'paper',
			'paper-2',
			'cream',
			'green',
			'green-deep',
			'green-2',
			'rose',
			'gold',
			'line',
		])
			expect(hc[key], `--${key} missing from the high-contrast block`).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it('clears AA for text on both paper surfaces', () => {
		for (const key of ['ink', 'ink-soft', 'green', 'green-deep', 'green-2', 'rose', 'gold']) {
			for (const surface of ['paper', 'cream'] as const) {
				const ratio = contrast(hc[key], hc[surface]);
				expect(ratio, `--${key} on --${surface} is ${ratio.toFixed(2)}:1, needs ${AA_TEXT}`).toBeGreaterThanOrEqual(
					AA_TEXT,
				);
			}
		}
	});

	it('clears the 3:1 bar for borders', () => {
		for (const surface of ['paper', 'cream'] as const) {
			const ratio = contrast(hc.line, hc[surface]);
			expect(ratio, `--line on --${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_UI);
		}
	});

	it('keeps white button text legible on the greens', () => {
		for (const key of ['green', 'green-deep']) {
			const ratio = contrast('#ffffff', hc[key]);
			expect(ratio, `white on --${key} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
		}
	});

	// Guards against the option being quietly turned into a no-op — if someone
	// "simplified" the block by pasting the default values back in, every check
	// above would still pass for --ink (which was always dark) while the muted text
	// and borders that were the actual problem went back to being unreadable.
	it('actually improves on the default palette', () => {
		for (const key of ['ink-soft', 'line', 'gold', 'rose', 'green-2']) {
			const before = contrast(base[key], base.paper);
			const after = contrast(hc[key], hc.paper);
			expect(after, `--${key} should improve on ${before.toFixed(2)}:1`).toBeGreaterThan(before);
		}
		// …and the defaults really were short of the bar, so these aren't vacuous.
		expect(contrast(base['ink-soft'], base.paper)).toBeLessThan(AA_TEXT);
		expect(contrast(base.line, base.paper)).toBeLessThan(AA_UI);
	});

	it('stays cozy rather than going stark black-and-white', () => {
		// Paper keeps its cream warmth: noticeably more red than blue.
		const [pr, , pb] = rgb(hc.paper);
		expect(pr - pb, 'the paper surface has gone grey').toBeGreaterThan(12);
		// Ink is deep but not pure black, so it reads as ink on paper.
		expect(luminance(hc.ink)).toBeGreaterThan(luminance('#000000'));
		// The accents stay recognisably green / rose / gold — a greyscale
		// "high contrast" would flatten each of these to near-zero spread.
		for (const key of ['green', 'green-2', 'rose', 'gold']) {
			const [r, g, b] = rgb(hc[key]);
			expect(Math.max(r, g, b) - Math.min(r, g, b), `--${key} has lost its hue`).toBeGreaterThan(24);
		}
		// The green is still green: more green channel than red or blue.
		const [gr, gg, gb] = rgb(hc.green);
		expect(gg).toBeGreaterThan(gr);
		expect(gg).toBeGreaterThan(gb);
	});
});

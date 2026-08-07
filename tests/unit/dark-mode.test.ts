import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Companion to high-contrast.test.ts, and the same argument: dark mode is a
// promise about numbers. Every colour in the [data-theme='dark'] block was picked
// against a measured ratio, and a later "just a shade lighter" tweak can quietly
// drop body text under AA without anything looking broken. So measure the shipped
// CSS rather than trusting the comments next to the hexes.
//
// The other half of the promise is that it stays restful: near-neutral greys for
// the surfaces, with the colour left to the accents. That is asserted too, because
// "make it dark" is otherwise trivially satisfied by #fff on #000 — which is the
// stark treatment the colorblind modes deliberately own, and this isn't it.

const CSS = readFileSync(resolve(__dirname, '../../src/styles.css'), 'utf8');

/** Pull every custom property out of one selector's block, hex or rgb()/rgba(). */
function varsIn(selector: string): Record<string, string> {
	const at = CSS.indexOf(selector + ' {');
	expect(at, `${selector} not found in styles.css`).toBeGreaterThan(-1);
	const block = CSS.slice(at, CSS.indexOf('\n}', at));
	const out: Record<string, string> = {};
	for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)) out[m[1]] = m[2];
	return out;
}

/** Straight sRGB channels. An alpha channel is dropped — see `over` below. */
function rgb(color: string): [number, number, number] {
	const fn = color.match(/rgba?\(([^)]*)\)/);
	if (fn) {
		const [r, g, b] = fn[1].split(',').map((n) => parseFloat(n));
		return [r, g, b];
	}
	const h = color.replace('#', '');
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h.slice(0, 6);
	return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function alpha(color: string): number {
	const fn = color.match(/rgba\(([^)]*)\)/);
	if (!fn) return 1;
	const parts = fn[1].split(',');
	return parts.length > 3 ? parseFloat(parts[3]) : 1;
}

/** Flatten a translucent colour onto what sits behind it, so it can be measured. */
function over(fg: string, bg: string): string {
	const a = alpha(fg);
	if (a === 1) return fg;
	const [fr, fg_, fb] = rgb(fg);
	const [br, bg_, bb] = rgb(bg);
	const mix = (f: number, b: number) => Math.round(f * a + b * (1 - a));
	return `rgb(${mix(fr, br)}, ${mix(fg_, bg_)}, ${mix(fb, bb)})`;
}

function luminance(color: string): number {
	const [r, g, b] = rgb(color).map((c) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5; // body text
const AA_UI = 3.0; // borders, icons, large text

describe('dark mode', () => {
	const base = varsIn(':root');
	const dark = varsIn("[data-theme='dark']");
	const darkHc = varsIn("[data-theme='dark'][data-high-contrast='1']");

	it('never lets the stored "system" choice reach the stylesheet', () => {
		// prefs.ts resolves 'system' to a literal before writing data-theme. If a
		// selector for it ever appears here, that contract has been misunderstood
		// and the theme would silently stop applying for everyone on Match system.
		expect(CSS).not.toContain("data-theme='system'");
		expect(CSS).not.toContain('data-theme="system"');
	});

	it('gives every themed colour a dark value', () => {
		// The dangerous shape is a partial override: a token left at its daylight
		// value turns up as a cream-coloured surface in the middle of a dark panel.
		// Anyone adding a colour to :root has to add its dark counterpart too, and
		// this is what tells them so.
		const missing = Object.keys(base).filter((k) => !(k in dark));
		expect(missing, `these :root colours have no [data-theme='dark'] value: ${missing.join(', ')}`).toEqual([]);
	});

	it('clears AA for text on every panel surface', () => {
		for (const surface of ['paper', 'paper-2', 'cream', 'field'] as const) {
			expect(contrast(dark.ink, dark[surface]), `ink on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT);
			// --ink-soft carries every hint and caption in the settings panel; it is
			// body text, not decoration, so it gets the body-text bar.
			expect(contrast(dark['ink-soft'], dark[surface]), `ink-soft on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT);
		}
	});

	it('clears AA for the accent colours used as text', () => {
		// Each of these is read as words somewhere: links and headings (green),
		// counts (gold), notices (good/bad-ink), locked labels (violet).
		for (const key of ['green', 'gold', 'rose', 'violet', 'good-ink', 'bad-ink'] as const) {
			expect(contrast(dark[key], dark.paper), `${key} on paper`).toBeGreaterThanOrEqual(AA_TEXT);
		}
		// green-deep is icon-and-edge work rather than prose, so it gets the UI bar.
		expect(contrast(dark['green-deep'], dark.paper)).toBeGreaterThanOrEqual(AA_UI);
	});

	it('keeps button labels legible once the accent brightens', () => {
		// This is the one that white-on-green cannot survive: the dark accent is
		// light enough to read as text on a dark panel, which leaves white labels
		// sitting on it at about 2:1. --on-accent is why it flips to near-black.
		for (const fill of ['green', 'green-deep', 'green-2', 'gold'] as const) {
			expect(contrast(dark['on-accent'], dark[fill]), `on-accent on ${fill}`).toBeGreaterThanOrEqual(AA_TEXT);
		}
		expect(luminance(dark['on-accent'])).toBeLessThan(luminance(dark.ink));
	});

	it('keeps the bubbles over the world readable, and separate from the panels', () => {
		// The activity feed and prompt bar were already dark over a lit world. At
		// night they must not merge into the panels behind them.
		const bubble = over(dark.bubble, dark['world-void']);
		expect(contrast(dark['bubble-ink'], bubble)).toBeGreaterThanOrEqual(AA_TEXT);
		expect(contrast(dark['bubble-accent'], bubble)).toBeGreaterThanOrEqual(AA_UI);
		expect(luminance(bubble)).toBeLessThan(luminance(dark.paper));
	});

	it('is actually dark, and darker behind the panels than in them', () => {
		expect(luminance(dark.paper)).toBeLessThan(luminance(base.paper));
		expect(luminance(dark.ink)).toBeGreaterThan(luminance(base.ink));
		expect(luminance(dark.paper)).toBeLessThan(0.05);
		// A panel has to lift off the world behind it — that is the whole depth cue
		// once the warm daylight shadow stops reading.
		expect(luminance(dark.paper)).toBeGreaterThan(luminance(dark['world-void']));
	});

	it('keeps the surfaces a calm near-neutral grey', () => {
		// Dark mode is meant to be restful, and a tinted surface is the opposite:
		// spread a hue across a whole panel and it reads as a colour wash rather
		// than as an absence of light. The daylight theme carries the game's
		// character in its surfaces; at night that job moves to the accents, and
		// the surfaces get out of the way. Guard the greys against drifting back
		// toward an olive or navy cast.
		const chroma = (c: string) => {
			const [r, g, b] = rgb(c);
			return Math.max(r, g, b) - Math.min(r, g, b);
		};
		for (const key of ['paper', 'paper-2', 'cream', 'field', 'track', 'world-void', 'line'] as const) {
			expect(chroma(dark[key]), `${key} should read as grey, not a tint`).toBeLessThanOrEqual(10);
		}
		expect(chroma(dark.ink), 'ink should be near-neutral').toBeLessThanOrEqual(10);

		// The accents are where the colour lives instead — if these ever flattened
		// out too, the interface would have no character left at all.
		for (const key of ['green', 'green-2', 'gold'] as const) {
			expect(chroma(dark[key]), `${key} should still carry real colour`).toBeGreaterThan(25);
		}
		// And the greens should still be recognisably green.
		for (const key of ['green', 'green-deep', 'green-2'] as const) {
			const [r, g, b] = rgb(dark[key]);
			expect(g, `${key} should lead on green`).toBeGreaterThan(r);
			expect(g, `${key} should lead on green`).toBeGreaterThan(b);
		}
	});

	it('layers high contrast on top of dark instead of replacing it', () => {
		// Someone who needs both must get both: still dark, but measurably crisper
		// than plain dark rather than falling back to the daylight high-contrast
		// palette (which is written against cream and would be blinding here).
		expect(luminance(darkHc.paper)).toBeLessThan(0.05);
		expect(contrast(darkHc.ink, darkHc.paper)).toBeGreaterThan(contrast(dark.ink, dark.paper));
		expect(contrast(darkHc['ink-soft'], darkHc.paper)).toBeGreaterThan(contrast(dark['ink-soft'], dark.paper));
		// Borders are the thing that vanishes first, and the reason people reach for
		// this setting at all.
		expect(contrast(darkHc.line, darkHc.paper)).toBeGreaterThanOrEqual(AA_UI);
		expect(contrast(darkHc.line, darkHc.paper)).toBeGreaterThan(contrast(dark.line, dark.paper));
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dark mode for the classroom pages, held to the same promise src/styles.css
// makes: the colors are measured, not eyeballed.
//
// The specific thing this caught while being written: site-core.css hard-codes
// `color:#fff` on .btn-go. That is correct on the daylight green (#4a7c59) and
// fails outright on the dark one — white on #7dac83 measures 2.59, below AA for
// any text at any size. Nothing about it LOOKS broken; it just quietly becomes
// hard to read for the students most likely to need dark mode. So the override
// is asserted here rather than trusted to survive the next refactor.
//
// The other half of the promise is that it stays restful: near-neutral greys for
// the surfaces, color left to the accents. "Make it dark" is otherwise trivially
// satisfied by #fff on #000.

const CSS = readFileSync(resolve(__dirname, '../../public/partials/ww-dark.css'), 'utf8');

const rgb = (hex: string): [number, number, number] => {
	let h = hex.replace('#', '');
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

const luminance = (hex: string): number => {
	const s = rgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};

/** WCAG contrast ratio between two hex colors. */
const ratio = (a: string, b: string): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** Every custom property declared in the [data-theme='dark'] block. */
const tokens = (): Record<string, string> => {
	const at = CSS.indexOf("[data-theme='dark'] {");
	expect(at, 'the dark block should exist in ww-dark.css').toBeGreaterThan(-1);
	const block = CSS.slice(at, CSS.indexOf('\n}', at));
	const out: Record<string, string> = {};
	for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]] = m[2];
	return out;
};

describe('classroom dark mode — measured contrast', () => {
	const t = tokens();

	it('declares the surfaces the classroom pages draw on', () => {
		for (const name of [
			'paper',
			'paper-deep',
			'panel',
			'panel-edge',
			'ink',
			'ink-soft',
			'ink-faint',
			'green',
			'green-deep',
		])
			expect(t[name], `--${name} should be repointed for dark`).toBeTruthy();
	});

	it('clears AA for body text on every surface', () => {
		// --ink is body copy; it has to clear 4.5 on the page, the sidebar and the
		// raised panels alike, because all three carry running text.
		for (const surface of ['paper', 'paper-deep', 'panel'])
			expect(ratio(t.ink, t[surface]), `--ink on --${surface}`).toBeGreaterThanOrEqual(4.5);
	});

	it('clears AA for muted and faint text, which carry real content here', () => {
		// --ink-soft is hint text under every checkpoint; --ink-faint is the section
		// headings and the editor's line numbers. Both are small, so both need 4.5 —
		// the game's equivalent faint token sits at 3.18, which would not do.
		for (const name of ['ink-soft', 'ink-faint'])
			for (const surface of ['paper', 'paper-deep', 'panel'])
				expect(ratio(t[name], t[surface]), `--${name} on --${surface}`).toBeGreaterThanOrEqual(4.5);
	});

	it('clears AA for the green used as text', () => {
		for (const name of ['green', 'green-deep'])
			expect(ratio(t[name], t.paper), `--${name} as text on --paper`).toBeGreaterThanOrEqual(4.5);
	});

	it('does NOT leave white text on the dark accent', () => {
		// The regression. If .btn-go keeps site-core's #fff here it measures 2.59.
		expect(ratio('#ffffff', t.green)).toBeLessThan(3);

		const override = /\[data-theme='dark'\][^{]*\.btn-go[^{]*\{([^}]*)\}/.exec(CSS);
		expect(override, '.btn-go must be re-inked for dark').toBeTruthy();
		const color = /color:\s*(#[0-9a-fA-F]{3,8})/.exec(override![1]);
		expect(color, '.btn-go override should set a color').toBeTruthy();
		expect(ratio(color![1], t.green), 'button label on --green').toBeGreaterThanOrEqual(4.5);
	});

	it('keeps the surfaces near-neutral rather than tinted', () => {
		// Restful, not stark, and not a green-tinted night mode either: the color
		// belongs to the accents. Measured as channel spread, which is cheap and
		// catches "I nudged the background greener" without a color-space library.
		for (const name of ['paper', 'paper-deep', 'panel']) {
			const c = rgb(t[name]);
			expect(Math.max(...c) - Math.min(...c), `--${name} should be near-neutral`).toBeLessThanOrEqual(8);
		}
	});

	it('is genuinely dark, not merely dimmed', () => {
		expect(luminance(t.paper)).toBeLessThan(0.05);
		expect(luminance(t.panel)).toBeLessThan(0.06);
	});
});

describe('the theme toggle', () => {
	const page = readFileSync(resolve(__dirname, '../../public/learn-code-builder.html'), 'utf8');
	const script = readFileSync(resolve(__dirname, '../../public/partials/ww-theme.js'), 'utf8');

	it('runs before the body so there is no flash of the wrong theme', () => {
		// The include has to sit in <head>. A student who chose dark seeing a
		// full-page flash of cream on every navigation is worse than no setting.
		expect(page.indexOf('ww-theme.js')).toBeLessThan(page.indexOf('</head>'));
	});

	it('only ever writes a literal light or dark onto the element', () => {
		// Same contract as the game's prefs.ts: 'system' is resolved before it is
		// written, so no stylesheet has to know the third state exists.
		expect(script).toContain("v === 'light' || v === 'dark'");
		expect(script).not.toMatch(/setAttribute\(['"]data-theme['"],\s*['"]system['"]\)/);
	});

	it('offers both icons and describes what pressing it will do', () => {
		expect(page).toContain('id="theme-toggle"');
		expect(page).toContain('class="icon-moon"');
		expect(page).toContain('class="icon-sun"');
		// Not "Dark mode: on" — a label that reads as a state leaves people guessing
		// what the click does.
		expect(script).toContain('Switch to light mode');
		expect(script).toContain('Switch to dark mode');
	});

	it('survives a browser that will not let it save the choice', () => {
		// Managed school profiles and private windows can throw on localStorage.
		// Not being able to REMEMBER the choice must not stop them making it.
		expect(script).toMatch(/catch\s*\(e\)/);
	});
});

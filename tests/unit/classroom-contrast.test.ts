import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Daylight contrast for the classroom pages.
//
// The dark palette was measured from the start; this file exists because the
// LIGHT one was not, and it turned out to be the one with the problem. Two inks
// inherited from site-core.css fail AA on the cream surfaces they sit on:
//
//   --ink-soft  #75765f -> 4.01 on --paper, 3.66 on --paper-deep
//   --ink-faint #9d9c85 -> 2.40 on --paper, 2.20 on --paper-deep
//
// On the landing page those carry decorative captions under big art, and it is a
// judgement call. On the builder they carry the hint under every checkpoint, the
// sidebar headings and the editor's line numbers — content a student has to read,
// frequently on a projector or a cheap Chromebook panel in a bright classroom.
//
// site-core.css is byte-locked to landing.html (site-css.test.ts), so the fix is
// a scoped repoint in ww-runner.css rather than an edit upstream. This holds it
// there, and holds the surfaces it was measured against.

const RUNNER = readFileSync(resolve(__dirname, '../../public/partials/ww-runner.css'), 'utf8');
const SITE = readFileSync(resolve(__dirname, '../../public/partials/site-core.css'), 'utf8');

const rgb = (hex: string): number[] => {
	let h = hex.replace('#', '');
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

const luminance = (hex: string): number => {
	const s = rgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};

const ratio = (a: string, b: string): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** A token's value as declared in the site's :root block. */
const siteToken = (name: string): string => {
	const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(SITE);
	expect(m, `--${name} should be declared in site-core.css`).toBeTruthy();
	return m![1];
};

/** A token as the classroom pages repoint it for daylight. */
const override = (name: string): string => {
	const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6});\\s*/\\* [\\d.]+`).exec(RUNNER);
	expect(m, `--${name} should be repointed in ww-runner.css`).toBeTruthy();
	return m![1];
};

/** Every cream the classroom pages actually put text on. */
const SURFACES = ['paper', 'paper-deep', 'panel', 'sprout'];

describe('classroom daylight contrast', () => {
	it('the inherited muted inks really do fail — this is why the override exists', () => {
		// Pinned so that if site-core is ever fixed upstream, this fails and tells
		// whoever is reading that the local override can be dropped.
		expect(ratio(siteToken('ink-soft'), siteToken('paper'))).toBeLessThan(4.5);
		expect(ratio(siteToken('ink-faint'), siteToken('paper'))).toBeLessThan(4.5);
	});

	it('clears AA for muted text on every cream surface', () => {
		for (const name of ['ink-soft', 'ink-faint'])
			for (const surface of SURFACES)
				expect(ratio(override(name), siteToken(surface)), `--${name} on --${surface}`).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps body text and links comfortably clear', () => {
		for (const surface of SURFACES) {
			expect(ratio(siteToken('ink'), siteToken(surface)), `--ink on --${surface}`).toBeGreaterThanOrEqual(4.5);
			expect(ratio(siteToken('green-deep'), siteToken(surface)), `--green-deep on --${surface}`).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});

	it('keeps the button label readable on the accent', () => {
		expect(ratio('#ffffff', siteToken('green'))).toBeGreaterThanOrEqual(4.5);
	});

	it('does not leave the error line as the hardest thing to read', () => {
		// The console's error colour was --clay, which measures 3.25 on cream. This
		// is the line telling a student something went wrong; it does not get to be
		// the one they squint at.
		const m = /\.wwr-console-line\.is-error\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/.exec(RUNNER);
		expect(m, 'the console error colour should be set explicitly').toBeTruthy();
		expect(ratio(m![1], siteToken('paper'))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(siteToken('clay'), siteToken('paper'))).toBeLessThan(4.5); // why it was changed
	});

	it('keeps the error panel readable on its warm background', () => {
		// The panel borrows the site's .chip.warm palette; its background is a
		// literal there, so it is a literal here.
		const PANEL_BG = '#f7ead2';
		const title = /\.wwr-error-title\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/.exec(RUNNER);
		expect(title).toBeTruthy();
		expect(ratio(title![1], PANEL_BG)).toBeGreaterThanOrEqual(4.5);
	});
});

describe('the runner layout', () => {
	it('gives the console the full width and real height', () => {
		// It used to be nested in the right-hand column under the preview: half the
		// width, and stacked against the student's own page. console.log(data) on
		// the game catalog is a chapter-4 instruction, and a three-line box makes
		// that look like the code failed.
		const RUNNER_JS = readFileSync(resolve(__dirname, '../../public/partials/ww-runner.js'), 'utf8');
		expect(RUNNER_JS).toContain('host.appendChild(consoleBox)');
		expect(RUNNER_JS).not.toContain('out.appendChild(consoleBox)');
		expect(RUNNER).toMatch(/\.wwr-console\s*\{[^}]*min-height:\s*7\.5rem/);
	});
});

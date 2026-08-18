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
const LESSON = readFileSync(resolve(__dirname, '../../public/partials/ww-lesson.css'), 'utf8');

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
		// Height is set inline by the drag handle now, so the rule carries no fixed
		// min-height any more — what matters is that it is a full-width row of its
		// own and that the drag handle exists to size it.
		expect(RUNNER).toMatch(/\.wwr-console\s*\{[^}]*flex:\s*0 0 auto/);
		expect(RUNNER).toMatch(/\.wwr-console-head\s*\{[^}]*cursor:\s*ns-resize/);
	});
});

describe('the lesson page inherits the classroom inks', () => {
	// The override in ww-runner.css is scoped to a selector list, not to a
	// stylesheet, so a new page only gets it by JOINING that list. The lesson
	// page carries `body.lesson`; when it was first written it did not, and every
	// caption, chapter number and table heading on it silently fell back to
	// site-core's 4.01 and 2.40. That is the failure this asserts against.
	it('body.lesson is on the daylight override', () => {
		expect(RUNNER).toMatch(/body\.lab,\s*\n\s*body\.lesson,\s*\n\s*\.wwr\s*\{/);
	});

	it('body.lesson is on the dark override too', () => {
		// Specificity, not source order, decides this one — see the note in
		// ww-dark.css. Without the dark counterpart the daylight greys would win
		// at night and the rail would turn to mud.
		const DARK = readFileSync(resolve(__dirname, '../../public/partials/ww-dark.css'), 'utf8');
		expect(DARK).toContain("[data-theme='dark'] body.lesson");
	});
});

describe('the JSON tree colours types legibly', () => {
	// The tree is the only place on the site where colour carries a fact — which
	// type each value is. The legend under it names all six, so colour is never
	// the sole carrier, but they still have to be READ, at 0.82rem monospace.
	//
	// MEASURED AGAINST THE BOX, NOT THE PAGE. The first pass measured against
	// --paper and shipped three values that were fine there and failed inside the
	// tree: the green measured 4.62 on the page and 4.22 on --paper-deep, which
	// is the surface it is actually drawn on.
	const TREE_LIGHT = 'paper-deep';
	const TREE_DARK = '#17191b'; // --paper-deep, dark

	const leaf = (cls: string, dark = false): string => {
		const src = dark ? `\\[data-theme='dark'\\] \\.${cls}` : `^\\.${cls}`;
		const m = new RegExp(`${src}\\s*\\{\\s*color:\\s*(#[0-9a-fA-F]{6})`, 'm').exec(LESSON);
		expect(m, `.${cls}${dark ? ' (dark)' : ''} should set a colour`).toBeTruthy();
		return m![1];
	};

	it('every type clears AA on the tree background in daylight', () => {
		for (const cls of ['jstr', 'jnum', 'jbool', 'jnull'])
			expect(ratio(leaf(cls), siteToken(TREE_LIGHT)), `.${cls}`).toBeGreaterThanOrEqual(4.5);
	});

	it('every type clears AA on the tree background in the dark', () => {
		for (const cls of ['jstr', 'jnum', 'jbool', 'jnull'])
			expect(ratio(leaf(cls, true), TREE_DARK), `.${cls} dark`).toBeGreaterThanOrEqual(4.5);
	});

	it('the four types are distinguishable from each other, not just readable', () => {
		// A palette where every value clears contrast and two of them look the same
		// teaches nothing. Crude but sufficient: no two may be within 60 units of
		// summed channel distance.
		const hexes = ['jstr', 'jnum', 'jbool', 'jnull'].map((c) => leaf(c));
		for (let i = 0; i < hexes.length; i++)
			for (let j = i + 1; j < hexes.length; j++) {
				const d = rgb(hexes[i]).reduce((a, v, k) => a + Math.abs(v - rgb(hexes[j])[k]), 0);
				expect(d, `${hexes[i]} vs ${hexes[j]}`).toBeGreaterThan(60);
			}
	});
});

describe('green on a dark ground goes the right way', () => {
	// --green-deep is the DARKER step: right under white text and on cream,
	// backwards on a dark surface, where it measures 4.33 on the dark --sprout.
	// The lesson puts green text on --sprout in four places (the current rail
	// row, callout titles, the lit flow step), so all four need re-aiming.
	it('the dark sheet re-aims the places green sits on sprout', () => {
		expect(LESSON).toMatch(/\[data-theme='dark'\][^{]*\.note-t[^{]*\{\s*color:\s*var\(--green-bright\)/);
	});

	it('and --green-bright actually clears AA there', () => {
		// #26302a is the dark --sprout (ww-dark.css) and #99c89e is --green-bright.
		expect(ratio('#99c89e', '#26302a')).toBeGreaterThanOrEqual(4.5);
		expect(ratio('#6d9c74', '#26302a')).toBeLessThan(4.5); // the value it replaces
	});
});

describe('the layout survives a narrow screen', () => {
	const BUILDER = readFileSync(resolve(__dirname, '../../public/partials/ww-builder.css'), 'utf8');

	it('names both rows when the columns stack', () => {
		// Dropping to one column left grid-template-rows at a single minmax(0, 1fr)
		// from the two-column layout, so the code pane took the whole explicit row
		// and the preview landed in an implicit row sized `auto`. Inside a bounded
		// container that resolves to zero: the preview measured 0px tall on every
		// iPad in portrait and every phone, which is the half of the screen the
		// teaching depends on.
		const block = /@media \(max-width: 820px\) \{([\s\S]*?)\n\}/.exec(RUNNER);
		expect(block, 'the stacking breakpoint should exist').toBeTruthy();
		expect(block![1]).toMatch(/grid-template-columns:\s*1fr/);
		expect(block![1]).toMatch(/grid-template-rows:\s*minmax\(0, [\d.]+fr\) minmax\(0, [\d.]+fr\)/);
	});

	it('gives each stacked pane a floor', () => {
		const block = /@media \(max-width: 820px\) \{([\s\S]*?)\n\}/.exec(RUNNER)![1];
		const code = /\.wwr-code \{[^}]*min-height:\s*(\d+)px/.exec(block);
		const preview = /\.wwr-preview \{[^}]*min-height:\s*(\d+)px/.exec(block);
		expect(code, 'the code pane needs a min-height when stacked').toBeTruthy();
		expect(preview, 'the preview needs one too').toBeTruthy();
		expect(Number(code![1])).toBeGreaterThanOrEqual(150);
		expect(Number(preview![1])).toBeGreaterThanOrEqual(140);
	});

	it('lets the builder scroll rather than squeezing the editor on a tablet', () => {
		// Side by side the builder is a fixed-height app. Stacked, the sidebar, the
		// toolbar and the console take their cut of the same 100vh and the editor
		// gets the remainder: 77px of code above 94px of preview on an iPad in
		// portrait, and 42/52 on an iPad mini. Below 940px the document scrolls and
		// the runner is given a height instead of a leftover.
		const block = /@media \(max-width: 940px\) \{([\s\S]*?)\n\}/.exec(BUILDER);
		expect(block).toBeTruthy();
		expect(block![1]).toMatch(/overflow:\s*auto/);
		expect(block![1]).toMatch(/\.lab-stage \.wwr \{[^}]*min-height:\s*\d+vh/);
		// …and the editor comes first, because that is what the page was opened for.
		expect(block![1]).toMatch(/\.lab-stage \{[^}]*order:\s*1/);
		expect(block![1]).toMatch(/\.lab-side \{[^}]*order:\s*2/);
	});

	it('hides the filename without hiding it from a screen reader', () => {
		// display:none would take the name out of the accessibility tree with it,
		// and the tab would announce as an unlabelled button. The clip-path recipe
		// leaves it readable to assistive technology and invisible to everyone else.
		const rule = /\.ch ww-runner \.wwr-tab-name \{([^}]*)\}/.exec(LESSON);
		expect(rule, 'the lesson should hide the filename visually').toBeTruthy();
		expect(rule![1]).toMatch(/clip-path:\s*inset\(50%\)/);
		expect(rule![1]).not.toMatch(/display:\s*none/);
		expect(rule![1]).not.toMatch(/visibility:\s*hidden/);
	});
});

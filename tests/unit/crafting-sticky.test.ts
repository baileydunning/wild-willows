import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The crafting panel's header stays put while the recipe list scrolls.
//
// The list runs to dozens of recipes, and the two things a player reaches for
// mid-scroll — the Place/Type/Search filters, and the tray of things they have
// made but not yet put down — both used to sit at the very top, so using either
// meant scrolling back up and then finding your place again.
//
// This is a layout rule that lives in two files at once: the markup has to keep
// both controls inside ONE sticky wrapper (two separate sticky elements would
// stack and leave the second one drifting), and the CSS has to keep pinning it
// against .panel-body, which is the scroll container. Either half alone does
// nothing, so both are asserted here.

const root = process.cwd();
const PANELS = readFileSync(join(root, 'src/ui/Panels.tsx'), 'utf8');
const CSS = readFileSync(join(root, 'src/styles.css'), 'utf8');

/** The `.craft-sticky { … }` rule body. */
const stickyRule = (): string => {
	const at = CSS.indexOf('.craft-sticky {');
	expect(at).toBeGreaterThan(-1);
	return CSS.slice(at, CSS.indexOf('}', at));
};

describe('the crafting panel header', () => {
	it('wraps the filters and the ready-to-place tray together', () => {
		const open = PANELS.indexOf('<div className="craft-sticky">');
		expect(open).toBeGreaterThan(-1);
		const rest = PANELS.slice(open);
		const filters = rest.indexOf('className="craft-filter"');
		const tray = rest.indexOf('className="placeable-bar"');
		const firstRecipeSection = rest.indexOf('{categories.map(');
		expect(filters).toBeGreaterThan(-1);
		expect(tray).toBeGreaterThan(filters); // tray sits below the filters…
		expect(firstRecipeSection).toBeGreaterThan(tray); // …and the list below both
	});

	it('is pinned to the top of the scrolling body', () => {
		const rule = stickyRule();
		expect(rule).toMatch(/position:\s*sticky/);
		expect(rule).toMatch(/top:\s*-?\d/);
		// It must paint: a transparent sticky header shows the list sliding through it.
		expect(rule).toMatch(/background:/);
	});

	it('bleeds out to the panel edges so nothing scrolls past in the gutters', () => {
		// .panel-body carries 20px of side padding; the header cancels it with a
		// negative margin and puts it back as its own padding. If those two ever
		// disagree, recipes show up either side of the pinned header.
		const rule = stickyRule();
		const bleed = rule.match(/margin:\s*0\s+-(\d+)px/)?.[1];
		const pad = rule.match(/padding:\s*\d+px\s+(\d+)px/)?.[1];
		expect(bleed).toBeDefined();
		expect(pad).toBe(bleed);

		const body = CSS.slice(CSS.indexOf('.panel-body {'), CSS.indexOf('}', CSS.indexOf('.panel-body {')));
		expect(body).toMatch(/overflow-y:\s*auto/); // still the scroll container
		expect(body).toContain(`${bleed}px`); // and still padded by the amount cancelled
	});

	it('caps the tray so a big backlog cannot swallow the panel', () => {
		const at = CSS.indexOf('.craft-sticky .placeable-bar {');
		expect(at).toBeGreaterThan(-1);
		const rule = CSS.slice(at, CSS.indexOf('}', at));
		expect(rule).toMatch(/max-height:/);
		expect(rule).toMatch(/overflow-y:\s*auto/);
	});
});

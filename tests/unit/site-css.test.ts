import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// public/partials/site-core.css is the site's shared design system — tokens,
// buttons, chips, nav, wrap, section heads — extracted VERBATIM from the landing
// page's <style> so the classroom pages can @include it.
//
// The landing page, /teachers, /age-rating and /support each still carry their
// own hand-copied duplicate of exactly these bytes, with a comment on each
// telling the next person to re-copy rather than tweak. That instruction is only
// as good as whoever reads it, and a classroom page that quietly drifts a shade
// off-brand is the kind of bug nobody files and everybody notices.
//
// So: assert the extraction is still an exact copy. If this fails, the landing
// page's design changed and site-core.css needs re-extracting — the fix is never
// to loosen the comparison.

const root = process.cwd();
const styleOf = (page: string) => {
	const html = readFileSync(join(root, 'public', page), 'utf8');
	const m = /<style>([\s\S]*?)<\/style>/.exec(html);
	if (!m) throw new Error(`${page} has no <style> block`);
	return m[1];
};

/** site-core.css minus the header comment this repo added around the copy. */
const extracted = () => {
	const css = readFileSync(join(root, 'public/partials/site-core.css'), 'utf8');
	const start = css.indexOf(':root{');
	expect(start, 'site-core.css should contain the :root token block').toBeGreaterThan(-1);
	return css.slice(start);
};

describe('site-core.css', () => {
	it('is byte-identical to the shared block in landing.html', () => {
		const landing = styleOf('landing.html');
		const core = extracted();
		const from = landing.indexOf(':root{');
		expect(landing.slice(from, from + core.length)).toBe(core);
	});

	it('carries the tokens the classroom pages build on', () => {
		const core = extracted();
		// Named individually rather than counted: these are the ones ww-runner.css
		// and ww-builder.css reference by name, and a rename upstream would leave
		// the classroom pages rendering unstyled text on unstyled panels.
		for (const token of [
			'--paper:',
			'--paper-deep:',
			'--panel:',
			'--panel-edge:',
			'--ink:',
			'--ink-soft:',
			'--ink-faint:',
			'--green:',
			'--green-deep:',
			'--sprout:',
			'--toast:',
			'--shadow:',
			'--r:',
			'--rlg:',
			'--f:',
		])
			expect(core, `token ${token} is used by the classroom pages`).toContain(token);
	});

	it('carries the controls the classroom pages reuse instead of reinventing', () => {
		const core = extracted();
		for (const cls of ['.btn', '.btn-go', '.btn-paper', '.chip', '.chip.on', '.nav', '.wrap', '.brand'])
			expect(core, `${cls} is used by the classroom pages`).toContain(cls);
	});

	it('stops before anything page-specific', () => {
		// The shared block ends at the section-head rules; everything after it in
		// landing.html is that page's own hero and section styling, which the
		// classroom pages must not inherit.
		const core = extracted();
		expect(core).not.toContain('.hero-scene');
		expect(core.trimEnd().endsWith('}')).toBe(true);
	});
});

describe('the classroom pages use the shared system', () => {
	const builder = readFileSync(join(root, 'public/learn-code-builder.html'), 'utf8');

	it('includes the site stylesheet before its own', () => {
		const site = builder.indexOf('site-core.css');
		const own = builder.indexOf('ww-builder.css');
		expect(site).toBeGreaterThan(-1);
		// Order matters: ww-builder.css overrides site-core (the fixed-height tool
		// layout), and CSS cascade resolves ties by source order.
		expect(site).toBeLessThan(own);
	});

	it('uses the site nav and the site buttons rather than look-alikes', () => {
		expect(builder).toContain('<nav class="nav">');
		expect(builder).toContain('class="brand"');
		expect(builder).toContain('btn btn-go');
		expect(builder).toContain('btn btn-paper');
		// The ideas filters are real site chips; `on` is site-core's selected state.
		expect(builder).toContain('class="chip on"');
	});

	it('loads the same webfont the rest of the site does', () => {
		expect(builder).toContain('family=Quicksand:wght@500;600;700');
	});
});

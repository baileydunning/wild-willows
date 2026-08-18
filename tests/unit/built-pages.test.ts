import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Does the page a browser receives actually parse?
//
// This exists because of a bug that every other check waved through. The runner
// partial carries a long comment explaining the trap where a closing script tag
// inside a string ends the enclosing block early — and that comment spelled the
// sequence out literally. Inlined into the builder page's <script>, the browser
// ended the block mid-file and rendered the rest of the runner as text.
//
// Everything looked fine: the bytes were all present, every @include had
// expanded, the local preview returned 200 with a plausible length, and the
// component's own unit tests passed because the component was never the problem.
// Only opening the page in a browser showed it.
//
// So these assertions read the GENERATED output — server/pages.ts, the artifact
// that actually ships — and walk it the way an HTML parser does: after a
// <script>, raw text runs to the FIRST closing tag, whatever the author meant.

const root = process.cwd();

/** The inlined page string for one export in the generated server/pages.ts. */
const builtPage = (exportName: string): string => {
	const src = readFileSync(join(root, 'server/pages.ts'), 'utf8');
	const m = new RegExp(`export const ${exportName}: string = ("(?:[^"\\\\]|\\\\.)*");`).exec(src);
	if (!m) throw new Error(`${exportName} not found in server/pages.ts — run npm run build:server`);
	return JSON.parse(m[1]);
};

/**
 * Split a document into raw-text elements the way the HTML parser does.
 *
 * Deliberately NOT a tag counter. Counting `<script` and `</script` occurrences
 * is what makes this bug invisible: the runner's own JavaScript contains the
 * strings "<script>" and "</style>" as data, so any count is wrong in both
 * directions at once. What matters is only where the parser stops.
 */
const rawTextBlocks = (doc: string, tag: string) => {
	const open = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
	const close = new RegExp(`</${tag}\\s*>`, 'i');
	const blocks: Array<{ tag: string; body: string; closed: boolean }> = [];
	let i = 0;
	for (;;) {
		open.lastIndex = i;
		const o = open.exec(doc);
		if (!o) break;
		const after = doc.slice(o.index + o[0].length);
		const c = close.exec(after);
		if (!c) {
			blocks.push({ tag: o[0], body: after, closed: false });
			break;
		}
		blocks.push({ tag: o[0], body: after.slice(0, c.index), closed: true });
		i = o.index + o[0].length + c.index + c[0].length;
	}
	return blocks;
};

describe('the built Code Builder page', () => {
	const html = builtPage('learnCodeBuilderHtml');

	it('has no unexpanded include directives', () => {
		expect(/<!--\s*@include/.test(html)).toBe(false);
	});

	it('closes every script element', () => {
		for (const b of rawTextBlocks(html, 'script')) expect(b.closed, `unclosed ${b.tag}`).toBe(true);
	});

	it('delivers the runner in one piece', () => {
		// The specific failure: the block ended early and the rest of the file
		// became visible text. Asserting the LAST thing the file defines is present
		// inside a single script block is what proves it survived intact.
		const blocks = rawTextBlocks(html, 'script');
		const runner = blocks.find((b) => b.body.includes('function assembleDocument'));
		expect(runner, 'runner partial should be inlined').toBeTruthy();
		expect(runner!.body).toContain('window.WwRunner = {');
	});

	it('delivers the builder in one piece', () => {
		const blocks = rawTextBlocks(html, 'script');
		const builder = blocks.find((b) => b.body.includes('var CHECKPOINTS'));
		expect(builder, 'builder partial should be inlined').toBeTruthy();
		expect(builder!.body).toContain('window.WwBuilder = {');
	});

	it('keeps the starter files as their own script elements', () => {
		const files = rawTextBlocks(html, 'script').filter((b) => b.tag.includes('text/ww-file'));
		expect(files).toHaveLength(3);
		// An unknown script type is never executed or rendered, which is why the
		// starter HTML can contain real tags without being escaped by hand.
		for (const f of files) expect(f.closed).toBe(true);
	});

	it('has exactly one stylesheet, and it closes', () => {
		// Script contents are blanked first: the runner's JavaScript contains the
		// strings "<style>" and "</style>" as data, and they are not markup.
		let stripped = html;
		for (const b of rawTextBlocks(html, 'script')) stripped = stripped.replace(b.body, '');
		const styles = rawTextBlocks(stripped, 'style');
		expect(styles).toHaveLength(1);
		expect(styles[0].closed).toBe(true);
		// …and it really is the site's stylesheet, not just a well-formed empty one.
		expect(styles[0].body).toContain('--green-deep:');
		expect(styles[0].body).toContain('.wwr-gutter');
		expect(styles[0].body).toContain('.lab-bar');
	});

	it('draws its icons rather than typing them', () => {
		// No emoji, and no "safe" symbol characters either. A play triangle or a die
		// is whatever glyph the platform's font decides — anywhere from a hairline
		// arrow to a full-colour emoji at a size nothing else on the page uses, and
		// a blank box on a machine missing the font. Every icon here is an SVG path.
		//
		// Typographic punctuation is fine and deliberate; it is only pictographs
		// this rules out.
		const allowed = new Set(['\u2013', '\u2014', '\u2018', '\u2019', '\u201c', '\u201d', '\u2026']);
		const pictographs = [...html].filter((c) => c.codePointAt(0)! > 0x2100 && !allowed.has(c));
		expect([...new Set(pictographs)]).toEqual([]);
	});

	it('carries the whole ideas pool and every checkpoint', () => {
		// Cheap end-to-end proof that nothing was truncated somewhere in the middle,
		// where a partial delivery would still parse and still look plausible.
		expect(html).toContain('meadow-roll-call'); // first idea
		expect(html).toContain('field-journal'); // last idea
		expect(html).toContain("id: 'title'"); // first checkpoint
		expect(html).toContain("id: 'fails'"); // last checkpoint
	});
});

describe('the dashboard', () => {
	const html = builtPage('dashboardHtml');

	it('is built on the site stylesheet rather than its own palette', () => {
		// It had a near-miss green-and-cream of its own, three values of which
		// failed AA on the site's creams (--muted 4.29, --faint 2.31, --accent
		// 4.24) while carrying every sub-label, hint and axis on the page.
		expect(html).toContain('--green-deep:#39604a'); // site-core, inlined
		expect(html).toContain('--bg: var(--paper)');
		expect(html).toContain('font: 15px/1.55 var(--f)');
		expect(html).toContain('family=Quicksand');
	});

	it('offers the four views', () => {
		for (const view of ['game', 'website', 'harper', 'problems'])
			expect(html, view).toContain(`data-view-tab="${view}"`);
		// The site's own chips, not a lookalike control.
		expect(html).toContain('class="chip on" role="tab" data-view-tab="game"');
	});

	it('hides the sections that do not match the chosen view', () => {
		for (const view of ['game', 'website', 'harper', 'problems'])
			expect(html, view).toContain(`body[data-view='${view}'] section[data-view]:not([data-view='${view}'])`);
	});

	it('files every section under a view', () => {
		// sec() defaults to 'game', so this only has to pin the ones that are not.
		expect(html).toContain("'problems',"); // What is going wrong · Save health
		expect(html).toContain("'website',"); // Landing page · Classroom
		expect(html).toContain("'harper',"); // Server health, both branches
		expect(html).toContain('section data-view=');
	});

	it('gives nothing away on the sign-in screen', () => {
		// Before this, the page announced itself as "Wild Willows Metrics" above the
		// form, with a nav, a version filter and a Problems toggle — so anyone who
		// found the URL learned that it exists, what it reports and roughly how it
		// is organised, without a password.
		expect(html).toContain('<title>Wild Willows</title>');
		expect(html).not.toContain('<title>Wild Willows — Metrics Dashboard</title>');
		expect(html).toContain('content="noindex, nofollow"');
		for (const sel of ['body.signed-out .nav', 'body.signed-out header.top', 'body.signed-out .views'])
			expect(html, sel).toContain(sel);
		// Concealed at boot, not after the first auth check: a flash of the real
		// header is the same disclosure, just briefer.
		expect(html).toContain("document.body.classList.add('signed-out')");
		// The title is part of it — a tab or a history entry says as much as the page.
		expect(html).toContain('function setSignedOut');
	});

	it('leaves no stray section arguments in the markup', () => {
		// A brace-balancing edit once walked past a template literal and inserted a
		// section's view argument AFTER </html>, which rendered as the literal text
		// "'harper'," at the bottom of the page.
		expect(html.trimEnd().endsWith('</html>')).toBe(true);
		expect(html).not.toMatch(/<\/html>\s*,/);
	});

	it('remembers the view, and says when one is empty', () => {
		// Whoever opens this at 3am to find out why it is on fire wants Problems,
		// and should not have to choose it every time. And an empty view looks
		// identical whether there is nothing to report or the feed failed.
		expect(html).toContain("const VIEW_KEY = 'wwDashboardView'");
		expect(html).toContain('function noteEmptyView');
	});
});

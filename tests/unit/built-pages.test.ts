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

describe('the Code Builder on a screen too small for it', () => {
	const html = builtPage('learnCodeBuilderHtml');

	it('ships the explanation, hidden, above the workspace', () => {
		// Hidden in the markup so a laptop never sees it flash; ww-builder.js
		// decides which of the two a visitor gets.
		expect(html).toContain('<section class="lab-blocked" id="lab-blocked" hidden>');
		// …and it comes after the nav, not before it. It replaced a banner that sat
		// above <nav>, which put the brand and the theme toggle underneath a
		// full-page message.
		expect(html.indexOf('<section class="lab-blocked"')).toBeGreaterThan(html.indexOf('</div></nav>'));
	});

	it('sends a phone somewhere that works instead of just refusing', () => {
		expect(html).toContain('href="/learn/web-development"');
		expect(html).toContain('href="/learn"');
	});

	it('holds the editor back so a phone never opens its iframes', () => {
		// `defer` is the same mechanism the lesson panels use. Without it,
		// ww-runner.js boots every runner at DOMContentLoaded and a device that
		// cannot use the editor still pays for two preview documents.
		expect(html).toMatch(/<ww-runner defer/);
	});

	it('no longer carries the banner it replaced', () => {
		expect(html).not.toContain('lab-small-screen');
	});

	it('can collapse its side panel out of the way', () => {
		// The toggle lives in the toolbar rather than on the panel, because it is
		// the one control that has to still be there once the panel is gone.
		expect(html).toContain('id="lab-side-toggle"');
		expect(html).toContain('aria-controls="lab-side"');
		expect(html).toContain('<aside class="lab-side" id="lab-side">');
		expect(html.indexOf('id="lab-side-toggle"')).toBeLessThan(html.indexOf('<aside class="lab-side"'));
	});
});

describe('the built lesson page', () => {
	const html = builtPage('learnWebDevelopmentHtml');

	it('has no unexpanded include directives', () => {
		expect(/<!--\s*@include/.test(html)).toBe(false);
	});

	it('closes every script element', () => {
		for (const b of rawTextBlocks(html, 'script')) expect(b.closed, `unclosed ${b.tag}`).toBe(true);
	});

	it('delivers both partials in one piece', () => {
		const blocks = rawTextBlocks(html, 'script');
		const runner = blocks.find((b) => b.body.includes('function assembleDocument'));
		expect(runner, 'runner partial should be inlined').toBeTruthy();
		expect(runner!.body).toContain('window.WwRunner = {');
		const lesson = blocks.find((b) => b.body.includes('function parsePath'));
		expect(lesson, 'lesson partial should be inlined').toBeTruthy();
		expect(lesson!.body).toContain('window.WwLesson = {');
	});

	it('carries every starter file as its own unexecuted script element', () => {
		// Every editable example on the page is one of these. An unknown script
		// type is never run or rendered, which is why chapter 1's starter can be
		// literal HTML tags rather than hand-escaped entities.
		const files = rawTextBlocks(html, 'script').filter((b) => b.tag.includes('text/ww-file'));
		expect(files.length).toBeGreaterThan(20);
		for (const f of files) expect(f.closed).toBe(true);
	});

	it('has ten chapters, and a rail entry for each', () => {
		for (let n = 1; n <= 10; n++) {
			expect(html, `section ${n}`).toContain(`id="chapter-${n}"`);
			expect(html, `rail link ${n}`).toContain(`href="#chapter-${n}" data-ch="${n}"`);
		}
		expect(html).not.toContain('id="chapter-11"');
	});

	it('every chapter reference in the copy points at a chapter that exists', () => {
		// A CSS chapter was inserted at position 2, which moved eight chapters up
		// one and made every "see chapter 6" in the prose wrong by one. There are
		// forty-odd of those and nothing about a stale one looks broken: it sends
		// a stuck student to confidently the wrong place.
		let markup = html;
		for (const b of [...rawTextBlocks(html, 'script'), ...rawTextBlocks(html, 'style')])
			markup = markup.replace(b.body, '');
		const refs = [...markup.matchAll(/[Cc]hapters?\s+(\d+)(?:\s+(?:and|to)\s+(\d+))?/g)];
		expect(refs.length).toBeGreaterThan(20);
		for (const m of refs)
			for (const n of [m[1], m[2]].filter(Boolean))
				expect(Number(n), `"${m[0]}"`).toBeLessThanOrEqual(10);
	});

	it('is readable with scripting switched off', () => {
		// A real constraint on a locked-down school machine, not a hypothetical.
		// Every runner wraps a static copy of its own starter code, which the
		// component replaces on boot — so this only ever shows when it did not.
		//
		// Script AND style bodies are blanked first, for the reason the stylesheet
		// check blanks scripts: both partials open with a comment naming the
		// element they define, so a raw count of "<ww-runner" over the whole
		// document counts prose as markup and demands a fallback for something
		// that is not there.
		let markup = html;
		for (const b of [...rawTextBlocks(html, 'script'), ...rawTextBlocks(html, 'style')])
			markup = markup.replace(b.body, '');
		const runners = (markup.match(/<ww-runner[\s>]/g) || []).length;
		const fallbacks = (markup.match(/class="static-fallback"/g) || []).length;
		expect(runners).toBeGreaterThan(15);
		expect(fallbacks).toBe(runners);
	});

	it('has exactly one stylesheet, and it closes', () => {
		let stripped = html;
		for (const b of rawTextBlocks(html, 'script')) stripped = stripped.replace(b.body, '');
		const styles = rawTextBlocks(stripped, 'style');
		expect(styles).toHaveLength(1);
		expect(styles[0].closed).toBe(true);
		expect(styles[0].body).toContain('--green-deep:');
		expect(styles[0].body).toContain('.wwr-gutter'); // the runner sheet
		expect(styles[0].body).toContain('.lrail'); // the lesson sheet
		expect(styles[0].body).toContain("[data-theme='dark']"); // and the dark one
	});

	it('draws its icons rather than typing them', () => {
		// Same rule as the builder: no emoji and no "safe" symbol characters, which
		// render as whatever glyph the platform's font decides. The tree's fold
		// arrows are the one exception and they are geometric shapes, not
		// pictographs, so they sit below the range this checks.
		const allowed = new Set(['\u2013', '\u2014', '\u2018', '\u2019', '\u201c', '\u201d', '\u2026']);
		const pictographs = [...html].filter((c) => c.codePointAt(0)! > 0x2100 && !allowed.has(c));
		expect([...new Set(pictographs)]).toEqual([]);
	});

	it('lets students edit the files the challenges tell them to edit', () => {
		// Chapter 10 says "it is in index.html" and "that one is in styles.css".
		// Both were `context` files, which the runner renders but does not expose,
		// so two of the five challenges could not be done at all and no tabs
		// appeared to suggest otherwise.
		const ch10 = html.slice(html.indexOf('id="chapter-10"'));
		const runner = ch10.slice(ch10.indexOf('<ww-runner'), ch10.indexOf('</ww-runner>'));
		for (const file of ['index.html', 'styles.css', 'main.js'])
			expect(runner, file).toContain(`name="${file}">`); // no ` context` after the name
		expect(runner).not.toMatch(/name="(index\.html|styles\.css)" context/);
	});

	it('teaches against values that exist in the data', () => {
		// The counterpart to classroom-contract.test.ts, from the other side: that
		// file pins the data, this one pins that the page still names it. A filter
		// on a value that does not exist returns an empty list and reads to a
		// student as their own broken code.
		expect(html).toContain('animal.biome === "meadow"');
		expect(html).toContain('animal.rarity === "rare"');
		expect(html).toContain('"Red Fox"');
		expect(html).toContain('apex-predator');
	});

	it('hands off to the builder without putting student code in a URL the server sees', () => {
		expect(html).toContain("'/learn/code-builder#start='");
	});

	it('has no em dashes in anything a student reads', () => {
		// House style for this page. Only the markup is checked: the partials
		// inlined into it are shared with the builder and their comments are for
		// whoever maintains them, not for the class.
		let markup = html;
		for (const b of [...rawTextBlocks(html, 'script'), ...rawTextBlocks(html, 'style')])
			markup = markup.replace(b.body, '');
		expect(markup).not.toContain('&mdash;');
		expect(markup).not.toContain('\u2014');
	});

	it('gives every chapter its own Going Deeper, closed', () => {
		// One panel per chapter, attached to the material it goes further on, rather
		// than one section at the end of the page. Collected at the end it read as a
		// second lesson nobody asked for; attached, it is an offer about the idea
		// they have just finished.
		const panels = [...html.matchAll(/<details class="deeper" data-deeper="(chapter-\d+)">/g)].map((m) => m[1]);
		expect(panels).toEqual(Array.from({ length: 10 }, (_, i) => `chapter-${i + 1}`));
		// A <details> with no `open`. Fourteen more topics unfurled in front of a
		// student who has just finished a chapter reads as "you are not done".
		expect(html).not.toMatch(/<details class="deeper"[^>]*\bopen\b/);
		// And the standalone section it replaced is gone, rail entry and all.
		expect(html).not.toContain('id="going-deeper"');
		expect(html).not.toContain('href="#going-deeper"');
	});

	it('holds the panel\'s runners back until it is opened', () => {
		// Every runner renders on start and each owns two iframes; the nine
		// chapters already open fifty-two documents before a word is read.
		// Charging a Chromebook for another twelve on behalf of a panel most
		// readers never open is the thing `defer` exists to prevent.
		const deferred = (html.match(/<ww-runner[^>]*\bdefer\b/g) || []).length;
		expect(deferred).toBeGreaterThanOrEqual(5);
		// …and every deferred one is inside a panel, not loose in a chapter.
		const insidePanels = [...html.matchAll(/<details class="deeper"[\s\S]*?<\/details>/g)]
			.map((m) => (m[0].match(/<ww-runner[^>]*\bdefer\b/g) || []).length)
			.reduce((a, n) => a + n, 0);
		expect(insidePanels).toBe(deferred);
	});
});

describe('the built /learn hub', () => {
	const html = builtPage('learnIndexHtml');

	it('has no unexpanded include directives', () => {
		expect(/<!--\s*@include/.test(html)).toBe(false);
	});

	it('closes every script element', () => {
		for (const b of rawTextBlocks(html, 'script')) expect(b.closed, `unclosed ${b.tag}`).toBe(true);
	});

	it('gives both doors the same call to action', () => {
		// Equal weight, down to the button. A quieter one on the second card read as
		// the lesser option rather than the other one; the recommendation is carried
		// by the order and by the two kickers above the headings.
		const doors = [...html.matchAll(/<p class="door-go"><a class="([^"]+)"/g)].map((m) => m[1]);
		expect(doors).toHaveLength(2);
		expect(doors[0]).toBe(doors[1]);
		expect(doors[0]).toContain('btn-go');
	});

	it('is two doors and nothing else to run', () => {
		// The hub carries no editor and no preview on purpose: a student who lands
		// here should be one click from writing code, not looking at a demo of it.
		// It is also what keeps the page a few kilobytes instead of a few hundred.
		expect(html).not.toContain('<ww-runner');
		expect(html).not.toContain('function assembleDocument');
		expect(html).toContain('href="/learn/web-development"');
		expect(html).toContain('href="/learn/code-builder"');
	});

	it('includes the theme script exactly once', () => {
		// ww-theme.js wires the toggle itself on DOMContentLoaded. Inlining it a
		// second time at the foot of the page attaches a SECOND click handler, so
		// every press toggles twice and lands back where it started, which looks
		// exactly like a dead button.
		const blocks = rawTextBlocks(html, 'script').filter((b) => b.body.includes("var KEY = 'wildWillowsTheme'"));
		expect(blocks).toHaveLength(1);
		// …and it is in the head, before any markup, or dark mode flashes cream.
		expect(html.indexOf("var KEY = 'wildWillowsTheme'")).toBeLessThan(html.indexOf('</head>'));
	});

	it('reports which door was taken', () => {
		// The one number worth having about a hub: if everybody leaves through the
		// same side, it is a redirect with extra steps rather than a choice.
		expect(html).toContain("'builder-nav': 'nav_builder'");
		expect(html).toContain("'lesson-nav': 'nav_lesson'");
		expect(html).toContain('view_learn');
	});

	it('draws its icons rather than typing them', () => {
		const allowed = new Set(['\u2013', '\u2014', '\u2018', '\u2019', '\u201c', '\u201d', '\u2026']);
		const pictographs = [...html].filter((c) => c.codePointAt(0)! > 0x2100 && !allowed.has(c));
		expect([...new Set(pictographs)]).toEqual([]);
	});

	it('has exactly one stylesheet, and it closes', () => {
		let stripped = html;
		for (const b of rawTextBlocks(html, 'script')) stripped = stripped.replace(b.body, '');
		const styles = rawTextBlocks(stripped, 'style');
		expect(styles).toHaveLength(1);
		expect(styles[0].closed).toBe(true);
		expect(styles[0].body).toContain('--green-deep:'); // site-core
		expect(styles[0].body).toContain('.door'); // the hub sheet
		expect(styles[0].body).toContain("[data-theme='dark']"); // and the dark one
	});
});

describe('the classroom pages link to each other', () => {
	// /learn is only a hub if the pages under it lead back to it. Both student
	// pages carry the link in their nav, next to the other section links.
	it.each([
		['learnWebDevelopmentHtml', 'the lesson'],
		['learnCodeBuilderHtml', 'the builder'],
	])('%s links up to /learn', (exportName) => {
		expect(builtPage(exportName)).toContain('href="/learn" data-track="learn-nav"');
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

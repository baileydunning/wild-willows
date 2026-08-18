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

describe('the lesson says what an API is before asking anyone to use one', () => {
	const html = builtPage('learnWebDevelopmentHtml');

	it('expands the acronym in full', () => {
		// It never did. Chapter 4 introduced the idea and chapter 5 went straight to
		// fetch(), so a student could finish the lesson using an API without ever
		// being told what the three letters stand for.
		expect(html.toLowerCase()).toContain('application programming interface');
	});

	it('and does it where the word is introduced, not where it is used', () => {
		// Chapter 4 is where "API" first appears as a thing rather than a word. The
		// expansion lived in chapter 5 for a while, which meant a student met the
		// term, read a page about it, and only then found out what it stood for.
		const ch4 = html.slice(html.indexOf('id="chapter-4"'), html.indexOf('id="chapter-5"'));
		expect(ch4.toLowerCase()).toContain('application programming interface');
		expect(ch4).toContain('interface');
		// And chapter 5, where they first send one a request, still names the
		// address they are sending it to.
		const ch5 = html.slice(html.indexOf('id="chapter-5"'), html.indexOf('id="chapter-6"'));
		expect(ch5).toContain('https://wildwillows.app/GameData');
		expect(ch5).toContain('web API');
	});
});

describe('the landing page nav actually goes where it says', () => {
	const html = builtPage('landingHtml');

	// EVERY NAV LINK LANDED AT THE FOOTER. `content-visibility: auto` gave each
	// off-screen section a `contain-intrinsic-size` placeholder — measured at
	// 412px, a phone, where cards stack. Applied at every width those estimates
	// were hundreds of pixels too tall each, so the document claimed ~12,900px on
	// a desktop; clicking a nav link started a smooth scroll toward an offset
	// computed from that, the sections resolved to their real heights on the way
	// past, the page collapsed ~2,000px underneath the animation, and the scroll
	// clamped to the bottom. Anything below Accessibility went to the footer.
	it('only applies the phone placeholders at phone widths', () => {
		const block = /@media\(max-width:820px\)\{\n#look[^]*?\n\}/.exec(html);
		expect(block, 'the containment block should be inside a max-width media query').toBeTruthy();
		expect(block![0]).toContain('content-visibility:auto');
		// and nowhere else: an unscoped copy is the bug coming back.
		const unscoped = html.replace(block![0], '');
		expect(unscoped).not.toContain('content-visibility:auto');
		expect(unscoped).not.toContain('contain-intrinsic-size');
	});

	it('gives every named section a placeholder, including the newest', () => {
		const block = /@media\(max-width:820px\)\{\n#look[^]*?\n\}/.exec(html)![0];
		// #developers was added after this block was written and had none, so it
		// was the one section whose estimate was zero while its neighbours were
		// over-estimated.
		for (const id of ['look', 'reviews', 'everyone', 'educators', 'developers', 'soundtrack', 'updates', 'faq', 'get'])
			expect(block, `#${id}`).toContain(`#${id}{contain-intrinsic-size:`);
	});

	it('and every anchor clears the sticky nav when you land on it', () => {
		// Without this the heading you jumped to sits behind the 59px header and
		// the first thing you see is the paragraph after it.
		const m = /#look,#reviews,[^{]*\{scroll-margin-top:([\d.]+)rem\}/.exec(html);
		expect(m, 'the landing sections should set scroll-margin-top').toBeTruthy();
		expect(parseFloat(m![1]) * 16).toBeGreaterThan(59);
	});

	it('every nav target is a section that exists', () => {
		const nav = /<div class="links">([\s\S]*?)<\/div>/.exec(html)![1];
		for (const [, id] of nav.matchAll(/href="#([a-z]+)"/g))
			expect(html, `#${id}`).toMatch(new RegExp(`<(section|header)[^>]*id="${id}"`));
	});
});

describe('no public page names the Steam build', () => {
	// A product decision, not a style one: the storefronts the site points at are
	// the Mac App Store and itch.io, and a page that names a third one it does not
	// link to raises a question it then does not answer.
	const PUBLIC = [
		'landingHtml',
		'privacyHtml',
		'supportHtml',
		'ageRatingHtml',
		'teachersIndexHtml',
		'teachersScienceHtml',
		'teachersCodingHtml',
		'developersApiHtml',
		'learnIndexHtml',
		'learnWebDevelopmentHtml',
		'learnCodeBuilderHtml',
	];

	it.each(PUBLIC)('%s', (name) => {
		const html = builtPage(name);
		expect(html).not.toMatch(/\bSteam\b/);
		expect(html).not.toContain('steampowered');
		expect(html).not.toMatch(/\bValve\b/);
	});
});

describe('the landing page routes to the rest of the site', () => {
	const html = builtPage('landingHtml');

	it('offers the six sections in the nav, in order', () => {
		const nav = /<div class="links">([\s\S]*?)<\/div>/.exec(html);
		expect(nav, 'the nav links block should be findable').toBeTruthy();
		const labels = [...nav![1].matchAll(/<a class="hide-sm"[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
		expect(labels).toEqual(['Reviews', 'Accessibility', 'Teachers', 'Developers', 'Community', 'FAQ']);
	});

	it('and every one of them is a section that exists', () => {
		const nav = /<div class="links">([\s\S]*?)<\/div>/.exec(html)![1];
		for (const [, id] of nav.matchAll(/href="#([a-z]+)"/g))
			expect(html, `#${id}`).toMatch(new RegExp(`<section[^>]*id="${id}"`));
	});

	it('sends teachers to both kits, not just the science one', () => {
		// This section was written when there was one kit. A hub link alone made
		// the coding kit invisible to anyone who did not click through.
		expect(html).toContain('href="/teachers/science"');
		expect(html).toContain('href="/teachers/coding"');
		expect(html).toContain('href="/teachers"');
		// The PDFs stayed reachable in one click — they are the thing teachers came for.
		expect(html).toContain('href="/educator-guide.pdf"');
		expect(html).toContain('href="/student-worksheets.pdf"');
	});

	it('sends developers to the lesson, the builder and the endpoint', () => {
		expect(html).toMatch(/<section[^>]*id="developers"/);
		expect(html).toContain('href="/learn/web-development"');
		expect(html).toContain('href="/learn/code-builder"');
		expect(html).toContain('href="/learn"');
		expect(html).toContain('https://wildwillows.app/GameData');
	});

	it('reports those clicks on a target the endpoint accepts', () => {
		// An unlisted target is not dropped, it is bucketed into `other` — so the
		// counter still moves and says nothing. See LANDING_CLICK_TARGETS.
		const targets = new Set([...html.matchAll(/data-track="([a-z-]+)"/g)].map((m) => m[1]));
		expect(targets.has('learn-nav')).toBe(true);
		const RESOURCES = readFileSync(join(root, 'server/resources.ts'), 'utf8');
		const list = /const LANDING_CLICK_TARGETS = new Set\(\[([\s\S]*?)\]\)/.exec(RESOURCES);
		expect(list, 'LANDING_CLICK_TARGETS should be findable').toBeTruthy();
		for (const t of targets) expect(list![1], `data-track="${t}" is not allowlisted`).toContain(`'${t}'`);
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
		// The toggle rides the seam between the panel and the editor rather than
		// living inside the panel, because it is the one control that has to still
		// be there once the panel is gone.
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
			for (const n of [m[1], m[2]].filter(Boolean)) expect(Number(n), `"${m[0]}"`).toBeLessThanOrEqual(10);
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
		for (const file of ['index.html', 'styles.css', 'main.js']) expect(runner, file).toContain(`name="${file}">`); // no ` context` after the name
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

	it("holds the panel's runners back until it is opened", () => {
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

describe('the two classroom pages link out to the API docs', () => {
	// A student in the editor and a teacher reading over their shoulder both end
	// up wanting the endpoint's own page: what it returns, what the fields are,
	// what the limits are. It was two clicks away through the footer.
	const PAGES: Array<[string, string]> = [
		['learnWebDevelopmentHtml', 'the lesson'],
		['learnCodeBuilderHtml', 'the code builder'],
	];

	it.each(PAGES)('%s has it in the header', (exportName) => {
		const html = builtPage(exportName);
		const nav = html.slice(html.indexOf('<nav class="nav">'), html.indexOf('</nav>'));
		expect(nav).toContain('href="/developers/api"');
		expect(nav).toContain('API docs');
	});

	it.each(PAGES)('%s opens it in a new tab, without handing over the opener', (exportName) => {
		const html = builtPage(exportName);
		const link = /<a[^>]*href="\/developers\/api"[^>]*>/.exec(html);
		expect(link, 'the API docs link should be findable').toBeTruthy();
		expect(link![0]).toContain('target="_blank"');
		// Without rel=noopener the opened page gets a handle on window.opener.
		expect(link![0]).toContain('rel="noopener"');
	});

	it.each(PAGES)('%s says out loud that it opens in a new tab', (exportName) => {
		const html = builtPage(exportName);
		// A drawn arrow is a convention a sighted reader has learned. It is not an
		// announcement, so the words ride along for anyone who is listening.
		const i = html.indexOf('href="/developers/api"');
		expect(html.slice(i, i + 700)).toContain('(opens in a new tab)');
	});

	it.each(PAGES)('%s counts the click', (exportName) => {
		const html = builtPage(exportName);
		expect(html).toContain('data-track="api-nav"');
		expect(html).toContain("'api-nav': 'nav_api'");
	});

	it.each(PAGES)('%s sizes the icon, because an unsized svg is 300x150', (exportName) => {
		const html = builtPage(exportName);
		// site-core also sets svg { display: block } sitewide, which dropped the
		// arrow onto a line of its own under the label the first time.
		const i = html.indexOf('.nav .links a .ext');
		expect(i, 'the rule should be in the page').toBeGreaterThan(-1);
		// Read a window rather than matching to the closing brace: the rule carries
		// a comment that contains a } of its own, and [^}]* stops at that one.
		const rule = html.slice(i, i + 500);
		expect(rule).toContain('display: inline-block');
		expect(rule).toContain('width: 0.78em');
	});
});

describe('the lesson says where to look things up before it asks anyone to', () => {
	const html = builtPage('learnWebDevelopmentHtml');
	const section = html.slice(html.indexOf('id="look-things-up"'), html.indexOf('id="chapter-1"'));

	it('comes before chapter 1', () => {
		// A student who needs this needs it at minute three, not in an optional
		// panel at the bottom of a 2,000-line page.
		const at = html.indexOf('id="look-things-up"');
		expect(at).toBeGreaterThan(-1);
		expect(at).toBeLessThan(html.indexOf('id="chapter-1"'));
	});

	it('is not a chapter, and the rail must not think it is', () => {
		// ww-lesson.js picks up `.ch[id^="chapter-"]`, counts CHAPTERS = 10, and
		// keys per-chapter dwell off the number in the id. An eleventh section
		// matching that selector would put an unnumbered entry in the rail and send
		// `chapter_NaN_reached` to a server that would fold it into `other`.
		expect(section).not.toContain('id="chapter-');
		const chapterSections = [...html.matchAll(/<section class="ch" id="chapter-(\d+)"/g)].map((m) => Number(m[1]));
		expect(chapterSections).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(html).toContain('var CHAPTERS = 10');
	});

	it('names references a student can actually reach', () => {
		for (const host of ['developer.mozilla.org', 'javascript.info', 'caniuse.com', 'stackoverflow.com', 'devdocs.io'])
			expect(section, host).toContain(host);
		// The panel three inches above their code answers half of it, and it is free.
		expect(section).toContain('The error panel on this page');
	});

	it('opens every one of them in a new tab, and says so out loud', () => {
		const links = [...section.matchAll(/<a[^>]*href="https?:[^"]*"[^>]*>/g)].map((m) => m[0]);
		expect(links.length).toBeGreaterThanOrEqual(6);
		for (const a of links) {
			// Losing the editor mid-lesson to a documentation link is the whole
			// reason these are _blank.
			expect(a, a).toContain('target="_blank"');
			expect(a, a).toContain('rel="noopener"');
		}
		expect((section.match(/\(opens in a new tab\)/g) || []).length).toBeGreaterThanOrEqual(links.length);
	});

	it('warns about the site that outranks all of them', () => {
		// W3Schools is the first result for nearly every question a beginner types.
		expect(section).toContain('W3Schools');
		expect(section).toMatch(/out of date/i);
	});

	it('gives one testable rule for code a student did not write', () => {
		expect(section).toContain('could you tell if it was wrong?');
	});

	it('claims only what it can stand behind about how professionals use AI', () => {
		// "A lot of" rather than a percentage or "nearly every". A figure would date
		// and would invite an argument with a teacher about the exact number, and
		// the paragraph does not rest on how large the share is — it rests on the
		// difference between going faster and skipping the understanding.
		expect(section).toContain('A lot of professional software engineers use it');
		expect(section).not.toMatch(/\b\d{1,3}%/);
	});

	it('and does not pretend they can avoid it forever', () => {
		// Vague disapproval is ignorable and, on this subject, wrong. The line the
		// section draws is between going faster at something you understand and
		// skipping the understanding, which is a line a student can actually apply.
		expect(section).toMatch(/no version of this advice where you never touch it/);
		expect(section).toMatch(/go faster at something you understand/);
		expect(section).toMatch(/skip understanding/);
		// And it says why the next ten chapters are the exception, in terms of what
		// the student gets rather than what they are not allowed to do.
		expect(section).toMatch(/typing it yourself is not busywork/);
	});

	it('leaves the teacher in charge', () => {
		expect(section).toMatch(/their rule wins/);
	});
});

describe('chapter 3 says what const, let and var are', () => {
	const html = builtPage('learnWebDevelopmentHtml');
	const ch3 = html.slice(html.indexOf('id="chapter-3"'), html.indexOf('id="chapter-4"'));
	const main = ch3.slice(0, ch3.indexOf('<details class="deeper"'));

	it('compares the three in the main body, not only in an optional panel', () => {
		// The variables section introduces `const` and then every example uses it.
		// A student who wonders why it is not `let` should not have to open a
		// collapsed panel to find out.
		for (const word of ['const', 'let', 'var']) expect(main).toContain(`<code>${word}</code>`);
		expect(main).toMatch(/Use <code>const<\/code> until something has to change/);
	});

	it('warns about the thing const does not do', () => {
		// `const` protects the name, not the contents. Nearly everyone assumes
		// otherwise once, usually while pushing to an array.
		expect(main).toContain('assignment to constant variable');
		expect(main).toMatch(/protects the name, not what the name holds/);
	});

	it('and the panel adds scope rather than repeating the table', () => {
		const deeper = ch3.slice(ch3.indexOf('<details class="deeper"'));
		expect(deeper).toContain('Where a name lives');
		// The old panel restated the whole comparison, including the same example.
		expect(deeper).not.toContain('Almost every example on this page uses');
		expect(deeper).not.toContain('animals.push("Red Fox")');
	});
});

describe('chapter 5 says what an HTTP method is', () => {
	const html = builtPage('learnWebDevelopmentHtml');
	const ch5 = html.slice(html.indexOf('id="chapter-5"'), html.indexOf('id="chapter-6"'));

	it('names the four a student will meet', () => {
		// A student sends a request in this chapter and then spends five more
		// chapters sending the same kind without ever being told it has a kind.
		for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) expect(ch5).toContain(`<code>${method}</code>`);
	});

	it('says fetch defaults to GET, and how to send anything else', () => {
		expect(ch5).toMatch(/with nothing after the address is a <code>GET<\/code>/);
		expect(ch5).toContain('method: "POST"');
	});

	it('and says why the whole lesson is GET', () => {
		// Not "we are keeping it simple". The endpoint is read-only, which is the
		// property that makes every request in the lesson safe to repeat.
		expect(ch5).toMatch(/read-only/);
		expect(ch5).toMatch(/safe to send twice/);
	});

	it('warns that a GET which changes something is a bug', () => {
		expect(ch5).toMatch(/delete link/i);
	});
});

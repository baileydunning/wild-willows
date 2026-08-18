import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// What a keyboard and a screen reader meet on the classroom pages.
//
// Every assertion here is the written-down half of something that was MEASURED
// in a real browser first, because none of it is visible in the source:
//
//   • 38 tab stops from the top of the Code Builder to the code editor. The
//     whole nav, the toolbar, six checkpoints with two controls each, the help
//     panel and its copy buttons, before reaching the one thing the page is for.
//   • 64 polite live regions on the lesson: two per runner, times thirty-two
//     runners, all of which run their example on load. A screen reader opened
//     the page and read out every console on it.
//   • A tab strip announcing itself as role="tablist" — which tells the user to
//     press the arrow keys — with no arrow-key handling and all three tabs in
//     the tab order. Worse than either plain buttons or a real tablist.
//   • The ideas dialog dropping focus on the document when it closed, so Escape
//     sent a keyboard user back to the top of the page.

const partial = (name: string) => readFileSync(resolve(__dirname, `../../public/partials/${name}`), 'utf8');
const page = (name: string) => readFileSync(resolve(__dirname, `../../public/${name}`), 'utf8');

const A11Y = partial('ww-a11y.css');
const RUNNER = partial('ww-runner.js');
const BUILDER = partial('ww-builder.js');

const CLASSROOM = [
	'learn-web-development.html',
	'learn-code-builder.html',
	'learn-index.html',
	'teachers-index.html',
	'teachers-science.html',
	'teachers-coding.html',
];

describe('every classroom page can be skipped into', () => {
	it.each(CLASSROOM)('%s has a skip link, and it lands on something real', (name) => {
		const html = page(name);
		const m = /<a class="skip-link" href="#([a-z-]+)">/.exec(html);
		expect(m, `${name} has no skip link`).toBeTruthy();
		const target = m![1];
		// The destination has to exist AND be focusable, or the link moves the
		// viewport and leaves focus at the top — which looks fixed and is not.
		expect(html, `#${target} is not in ${name}`).toMatch(new RegExp(`id="${target}"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="${target}"`));
	});

	it.each(CLASSROOM)('%s loads the sheet that makes the link visible on focus', (name) => {
		expect(page(name)).toContain('ww-a11y.css');
	});

	it.each(CLASSROOM)('%s has one main landmark', (name) => {
		expect((page(name).match(/<main[\s>]/g) || []).length, name).toBe(1);
	});

	it('the link is off-screen rather than undisplayed, and comes back on focus', () => {
		// display:none is not focusable, so a skip link written that way is
		// decoration that no keyboard user can ever reach.
		expect(A11Y).toMatch(/\.skip-link\s*\{[^}]*left: -9999px/);
		expect(A11Y).toMatch(/\.skip-link:focus\s*\{\s*left: 0/);
		expect(A11Y).not.toMatch(/\.skip-link\s*\{[^}]*display: none/);
	});
});

describe('the editor is escapable, and says so', () => {
	it('Tab indents, and Escape releases it', () => {
		expect(RUNNER).toContain("if (e.key === 'Escape')");
		expect(RUNNER).toMatch(/e\.key === 'Tab' && !escaping/);
	});

	it('and the way out is in the field description, not only in a comment', () => {
		// WCAG 2.1.2: if focus can only be moved with a non-standard key, the user
		// has to be told which one. A working escape nobody knows about is a trap.
		expect(RUNNER).toContain("area.setAttribute('aria-describedby'");
		expect(RUNNER).toMatch(/press Escape and then Tab/);
	});
});

describe('the file tabs behave like the tablist they claim to be', () => {
	it('keeps one tab stop, not one per file', () => {
		expect(RUNNER).toContain("t.tabIndex = i === 0 ? 0 : -1;");
		expect(RUNNER).toContain('c.tabIndex = on ? 0 : -1;');
	});

	it('and moves with the arrow keys, Home and End', () => {
		expect(RUNNER).toMatch(/ArrowRight: 1[\s\S]*ArrowLeft: -1/);
		expect(RUNNER).toContain("e.key === 'Home'");
		expect(RUNNER).toContain("e.key === 'End'");
	});
});

describe('only the runner you are in announces itself', () => {
	it('starts every runner silent', () => {
		expect(RUNNER).toContain('setLive(false);');
	});

	it('and turns announcements on and off with focus', () => {
		expect(RUNNER).toContain("host.addEventListener('focusin'");
		expect(RUNNER).toMatch(/focusout[\s\S]{0,120}relatedTarget/);
	});

	it('using aria-live="off" rather than a removed attribute', () => {
		// role="status" carries an IMPLICIT polite live region, so deleting
		// aria-live leaves the error panel announcing anyway. This was the fix that
		// looked right and did nothing.
		expect(RUNNER).toMatch(/var v = on \? 'polite' : 'off'/);
		expect(RUNNER).not.toMatch(/removeAttribute\('aria-live'\)/);
	});
});

describe('the ideas dialog gives focus back', () => {
	it('remembers what opened it and returns there', () => {
		expect(BUILDER).toContain('var modalOpener = null;');
		expect(BUILDER).toMatch(/modalOpener = document\.activeElement/);
		expect(BUILDER).toMatch(/if \(back && back\.focus\) back\.focus\(\);/);
	});

	it('and falls back to the Ideas button when it opened itself', () => {
		// It also opens on its own after a few idle minutes, and in that case there
		// is no opener to go back to.
		expect(BUILDER).toContain("$('#lab-ideas-open')");
	});
});

describe('the pages that describe the kits describe both of them', () => {
	it.each(['support.html', 'age-rating.html'])('%s points at each kit, not only the hub', (name) => {
		const html = page(name);
		expect(html).toContain('href="/teachers/science"');
		expect(html).toContain('href="/teachers/coding"');
		expect(html).toContain('href="/teachers"');
	});
});

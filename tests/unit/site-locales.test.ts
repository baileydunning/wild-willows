import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	DEFAULT_LOCALE,
	SITE_ORIGIN,
	SITE_PAGES,
	alternatesByGroup,
	assertTableSound,
} from '../../scripts/site-pages.mjs';

// The Spanish site, and the machinery that keeps it wired to the English one.
//
// hreflang has exactly one rule and it is unforgiving: the annotations must be
// reciprocal. Every version has to list itself AND every other version, on every
// page, or the whole set is ignored — silently, with nothing logged anywhere and
// nothing visibly wrong with the page. That is why the links are generated from
// scripts/site-pages.mjs rather than written into the HTML, and why this file
// asserts on server/pages.ts: the artifact that actually ships, not the source
// it was built from.
//
// The other failure this guards is slower and worse. A translated site does not
// break, it drifts: the English page gets a new section, the Spanish one does
// not, and six months later half the copy is stale in a language nobody on the
// project reads. Nothing here can check a translation is GOOD. It can check that
// the two pages still point at each other and still share a stylesheet, which is
// where the rot starts.

const root = process.cwd();

/** The inlined page string for one export in the generated server/pages.ts. */
const builtPage = (exportName: string): string => {
	const src = readFileSync(join(root, 'server/pages.ts'), 'utf8');
	const m = new RegExp(`export const ${exportName}: string = ("(?:[^"\\\\]|\\\\.)*");`).exec(src);
	if (!m) throw new Error(`${exportName} not found in server/pages.ts — run npm run build:server`);
	return JSON.parse(m[1]);
};

const translated = [...alternatesByGroup().keys()];
const translatedPages = SITE_PAGES.filter((p: any) => translated.includes(p.group));

describe('the site URL table', () => {
	it('holds together', () => {
		expect(() => assertTableSound()).not.toThrow();
	});

	it('names files that exist', () => {
		for (const page of SITE_PAGES.filter((p: any) => p.src)) {
			expect(existsSync(join(root, page.src)), `${page.key} -> ${page.src}`).toBe(true);
		}
	});

	it('has been generated into the server, in agreement with itself', () => {
		// server/site-pages.ts is committed like server/pages.ts, so it can be stale
		// in a way nothing else notices until a URL 404s in production.
		const generated = readFileSync(join(root, 'server/site-pages.ts'), 'utf8');
		for (const page of SITE_PAGES) {
			expect(generated, `${page.key} missing from server/site-pages.ts — run npm run build:server`).toContain(
				`"${page.key}": {`,
			);
			expect(generated).toContain(`"path": ${JSON.stringify(page.path)}`);
		}
	});

	it('offers at least one page in Spanish', () => {
		// Not a tautology: the plumbing is only worth its weight if something uses
		// it. If the Spanish page is ever dropped, this says so out loud rather than
		// leaving an unused code path to be tidied away by someone who reads it as
		// dead.
		expect(SITE_PAGES.some((p: any) => p.locale === 'es')).toBe(true);
	});
});

describe.each(translatedPages.filter((p: any) => p.const))('$path', (page: any) => {
	const html = () => builtPage(page.const);
	const siblings = alternatesByGroup().get(page.group) as { locale: string; path: string }[];

	it('declares the language it is written in', () => {
		expect(html()).toContain(`<html lang="${page.locale}">`);
	});

	it('canonicalises to itself', () => {
		// The classic way a translated site deletes itself from the index: copy the
		// English page, keep its canonical, and every Spanish URL now says "index
		// that other page instead of me".
		const m = /<link\s[^>]*rel="canonical"[^>]*>/i.exec(html());
		expect(m, 'no canonical link').not.toBeNull();
		expect(m![0]).toContain(`href="${SITE_ORIGIN}${page.path}"`);
	});

	it('lists every version of itself, including itself', () => {
		const doc = html();
		for (const sibling of siblings) {
			expect(doc, `missing hreflang="${sibling.locale}"`).toContain(
				`<link rel="alternate" hreflang="${sibling.locale}" href="${SITE_ORIGIN}${sibling.path}">`,
			);
		}
	});

	it('names a fallback for everyone else', () => {
		const fallback = siblings.find((s) => s.locale === DEFAULT_LOCALE)!;
		expect(html()).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${fallback.path}">`);
	});

	it('carries a link a person can click to the other languages', () => {
		// hreflang is for crawlers. Nothing redirects a visitor by Accept-Language —
		// Google asks that sites not guess, and a visitor sent somewhere they did
		// not choose usually cannot get back — so the only way across is a link that
		// is actually on the page.
		const doc = html();
		for (const sibling of siblings.filter((s) => s.path !== page.path)) {
			expect(doc, `no link to the ${sibling.locale} version`).toContain(`href="${sibling.path}"`);
		}
	});
});

describe('the Spanish landing page', () => {
	// It is a copy of the English page's markup with the copy translated, which
	// means it carries a second copy of the landing page's 22 KB <style>. That is
	// the same arrangement /age-rating and /support are already in (see
	// tests/unit/site-css.test.ts), and the same risk: a design change lands on one
	// page and quietly not the other.
	const styleOf = (page: string) => {
		const html = readFileSync(join(root, 'public', page), 'utf8');
		const m = /<style>([\s\S]*?)<\/style>/.exec(html);
		if (!m) throw new Error(`${page} has no <style> block`);
		return m[1];
	};

	it('is styled by the same bytes as the English one', () => {
		expect(styleOf('es/landing.html')).toBe(styleOf('landing.html'));
	});

	it('offers the same sections, so neither page is quietly missing content', () => {
		const ids = (page: string) =>
			[...readFileSync(join(root, 'public', page), 'utf8').matchAll(/<section[^>]*\sid="([^"]+)"/g)]
				.map((m) => m[1])
				.sort();
		expect(ids('es/landing.html')).toEqual(ids('landing.html'));
	});

	it('is not written in English', () => {
		// A crude smoke test for the copy-and-forget-to-translate case, which is
		// otherwise invisible to every check here: the page would have a perfect
		// canonical, perfect hreflang and English prose.
		const doc = builtPage('landingEsHtml');
		const body = doc.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
		for (const word of ['&middot;', 'Wild Willows']) expect(body).toContain(word);
		expect(body).toMatch(/[áéíóúñ¿¡]/);
	});
});

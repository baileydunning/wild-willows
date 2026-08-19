import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SITE_PAGES } from '../../scripts/site-pages.mjs';

/**
 * WHAT A SEARCH RESULT IS MADE OF, checked on every public page.
 *
 * None of this is a ranking trick. It is the set of things that are invisible
 * while they are right and expensive when they are wrong: a page with no
 * description gets a sentence Google picks out of the middle of it, a page with
 * no og:image is a grey box when a teacher shares it in a staff group, and a
 * page with two <h1>s is a document that claims to be about two things.
 *
 * The lengths are what a result actually renders. Longer is not a penalty, it is
 * a truncation — and a title cut mid-word is a title somebody else wrote.
 */

const root = process.cwd();
const PAGES = readdirSync(resolve(root, 'public'))
	.filter((f) => f.endsWith('.html'))
	// The dashboard is noindex by design: it is a private admin view, and every
	// endpoint it reads refuses an unauthenticated request.
	.filter((f) => f !== 'dashboard.html');

const read = (f: string) => readFileSync(join(root, 'public', f), 'utf8');
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const attr = (html: string, re: RegExp) => (html.match(re) || [])[1];
const title = (h: string) => attr(h, /<title>([^<]*)<\/title>/) || '';
const desc = (h: string) => attr(h, /<meta name="description" content="([^"]*)"/) || '';
/** Entities render as one character; a length check has to count what a reader sees. */
const rendered = (s: string) => s.replace(/&mdash;|&ndash;/g, '-').replace(/&[a-z]+;/g, '?');

describe('every public page can be found and shared', () => {
	it.each(PAGES)('%s has a title that fits a result', (f) => {
		const t = rendered(title(read(f)));
		expect(t.length, `${f}: "${t}"`).toBeGreaterThan(15);
		expect(t.length, `${f}: "${t}" is cut off in results`).toBeLessThanOrEqual(65);
	});

	it.each(PAGES)('%s writes its own description', (f) => {
		const d = rendered(desc(read(f)));
		expect(d.length, `${f} description`).toBeGreaterThan(70);
		// Policy pages are allowed to run long: nobody chooses them from a result.
		const cap = /privacy|age-rating/.test(f) ? 230 : 175;
		expect(d.length, `${f} description is ${d.length}`).toBeLessThanOrEqual(cap);
	});

	it.each(PAGES)('%s says which URL it is', (f) => {
		const html = read(f);
		const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
		expect(canonical, `${f} needs a canonical`).toBeTruthy();
		expect(canonical!.startsWith('https://wildwillows.app'), canonical).toBe(true);
		// The apex serves the same documents on a second hostname; a canonical is
		// what stops the two competing with each other.
		const ogUrl = attr(html, /<meta property="og:url" content="([^"]*)"/);
		if (ogUrl) expect(ogUrl, `${f}: og:url should match the canonical`).toBe(canonical);
	});

	it.each(PAGES)('%s brings a card when somebody shares it', (f) => {
		const html = read(f);
		for (const tag of ['og:title', 'og:description', 'og:image'])
			expect(html, `${f} is missing ${tag}`).toContain(`property="${tag}"`);
		expect(html, `${f} is missing a twitter card`).toContain('name="twitter:card"');
		// Sized, or several clients will not render it large.
		expect(html).toContain('property="og:image:width"');
		expect(html).toContain('property="og:image:alt"');
	});

	it.each(PAGES)('%s is one document about one thing', (f) => {
		const body = strip(read(f));
		const h1s = [...body.matchAll(/<h1[^>]*>/g)];
		expect(h1s.length, `${f} has ${h1s.length} <h1>s`).toBe(1);
	});

	it.each(PAGES)('%s does not skip a heading level', (f) => {
		// A jump from h2 to h4 is a broken outline for anyone navigating by
		// headings, which on these pages is the fastest way through them.
		const levels = [...strip(read(f)).matchAll(/<h([1-6])[^>]*>/g)].map((m) => Number(m[1]));
		const jumps = levels.map((l, i) => (i && l - levels[i - 1] > 1 ? `h${levels[i - 1]}->h${l}` : '')).filter(Boolean);
		expect(jumps, `${f}`).toEqual([]);
	});

	it.each(PAGES)('%s ships valid structured data, if any', (f) => {
		const blocks = [...read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
		for (const [, json] of blocks) expect(() => JSON.parse(json), `${f} has unparseable JSON-LD`).not.toThrow();
	});

	it.each(PAGES)('%s labels every image', (f) => {
		const imgs = [...strip(read(f)).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
		expect(
			imgs.filter((i) => !/\balt=/.test(i)),
			`${f}`,
		).toEqual([]);
	});
});

describe('the pages that exist to be found say what they are', () => {
	/** The three pages a stranger could plausibly search their way to. */
	const INDEXABLE = [
		'landing.html',
		'learn-index.html',
		'learn-web-development.html',
		'teachers-index.html',
		'teachers-science.html',
		'teachers-coding.html',
		'developers-api.html',
	];

	it.each(INDEXABLE)('%s asks for a large image preview', (f) => {
		expect(read(f)).toMatch(/<meta name="robots" content="index, follow, max-image-preview:large">/);
	});

	it('the lesson describes itself as the course it is', () => {
		// Course + LearningResource is what an education search reads. Without it
		// nine thousand words of lesson are just a long page.
		const html = read('learn-web-development.html');
		const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
		const course = ld['@graph'].find((n: any) => String(n['@type']).includes('Course'));
		expect(course).toBeTruthy();
		expect(course.isAccessibleForFree).toBe(true);
		expect(course.teaches.length).toBeGreaterThan(4);
		expect(course.syllabusSections).toHaveLength(10);
		expect(course.hasCourseInstance).toBeTruthy();
	});

	it('the API docs describe the data as a dataset Google can list', () => {
		// Dataset Search will not accept one without a license, and this page is
		// the only realistic shot the project has at that surface.
		const html = read('developers-api.html');
		const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
		const set = ld['@graph'].find((n: any) => n['@type'] === 'Dataset');
		expect(set).toBeTruthy();
		for (const field of ['license', 'creator', 'publisher', 'distribution', 'identifier', 'variableMeasured'])
			expect(set[field], `Dataset.${field}`).toBeTruthy();
		expect(set.distribution.contentUrl).toBe('https://wildwillows.app/GameData');
	});

	it('the code builder stays out of the index, and out of the sitemap with it', () => {
		// It is a tool, not a document. An indexed editor competes with the lesson
		// that explains it — and the sitemap has to agree with the page.
		expect(read('learn-code-builder.html')).toContain('content="noindex, follow"');
		// Asked of the URL table itself (scripts/site-pages.mjs), which is what the
		// sitemap is generated from — rather than pattern-matched out of the
		// generated source, where a reformat could break the test without breaking
		// anything real, or fix the test without fixing anything real.
		const builder = SITE_PAGES.find((p: any) => p.path === '/learn/code-builder');
		expect(builder, 'no /learn/code-builder row in scripts/site-pages.mjs').toBeTruthy();
		expect(builder.sitemap, 'a noindex page must stay out of the sitemap').toBe(false);
		expect(builder.redirect, 'it still canonicalises to the apex').toBe(true);
	});
});

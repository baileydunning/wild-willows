import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// EVERY COUNTER A PAGE CAN SEND MUST BE ONE THE SERVER ACCEPTS.
//
// This is the failure mode that hides. An unlisted key is not rejected loudly —
// it is folded into `other`, so the counter still moves, the dashboard still
// renders, and the number means nothing. You find out months later, when you go
// looking for a figure that was never being recorded.
//
// It was found by driving all eleven pages in a browser and capturing what they
// actually put on the wire. This is the cheap version of that: the literal keys
// are extracted from source and checked against the server's own rule, so the
// next one is caught at commit time rather than by another audit.

const root = process.cwd();
const RESOURCES = readFileSync(resolve(root, 'server/resources.ts'), 'utf8');

/** Strip comments before pulling string literals, or prose leaks in as keys. */
const clean = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const listIn = (re: RegExp, what: string): string[] => {
	const m = re.exec(RESOURCES);
	expect(m, `${what} should be findable in server/resources.ts`).toBeTruthy();
	return [...clean(m![1]).matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

const LESSON_EXACT = new Set(listIn(/const LESSON_EXACT = new Set\(\[([\s\S]*?)\n\]\);/, 'LESSON_EXACT'));
const LESSON_ERRORS = new Set(listIn(/const LESSON_ERROR_KEYS = new Set\(\[([\s\S]*?)\n\]\);/, 'LESSON_ERROR_KEYS'));
const LANDING_TARGETS = new Set(
	listIn(/const LANDING_CLICK_TARGETS = new Set\(\[([\s\S]*?)\n\]\);/, 'LANDING_CLICK_TARGETS'),
);
const LESSON_PATTERNS = (() => {
	const m = /const LESSON_PATTERNS[^=]*= \[([\s\S]*?)\n\];/.exec(RESOURCES);
	expect(m, 'LESSON_PATTERNS should be findable').toBeTruthy();
	return [...clean(m![1]).matchAll(/\/(\^[^/]*)\/[a-z]*,/g)].map((x) => new RegExp(x[1]));
})();

/** The server's own decision, re-implemented from the same source it reads. */
const allowed = (key: string): boolean => {
	if (LESSON_EXACT.has(key)) return true;
	if (key.startsWith('errors_')) return LESSON_ERRORS.has(key.slice('errors_'.length));
	return LESSON_PATTERNS.some((re) => re.test(key));
};

const SOURCES = [
	...readdirSync(resolve(root, 'public'))
		.filter((f) => f.endsWith('.html'))
		.map((f) => join('public', f)),
	...readdirSync(resolve(root, 'public/partials'))
		.filter((f) => f.endsWith('.js'))
		.map((f) => join('public/partials', f)),
];

/** Literal counter names a file can put in a LessonEvent payload. */
const lessonKeysIn = (src: string): string[] => {
	const keys = new Set<string>();
	for (const m of src.matchAll(/bump\('([a-z][a-z0-9_-]*)'\)/g)) keys.add(m[1]);
	for (const m of src.matchAll(/report\(\{\s*([a-z][a-z0-9_]*):\s*\d/g)) keys.add(m[1]);
	for (const m of src.matchAll(/opening\.([a-z][a-z0-9_]*)\s*=\s*\d/g)) keys.add(m[1]);
	for (const m of src.matchAll(/counts\.([a-z][a-z0-9_]*)\s*=\s*\d/g)) keys.add(m[1]);
	// NAV maps: 'data-track-value': 'counter_name'
	for (const m of src.matchAll(/'[a-z][a-z0-9-]*':\s*'([a-z][a-z0-9_]*)'/g)) keys.add(m[1]);
	for (const m of src.matchAll(/\b([a-z][a-z0-9-]*):\s*'(nav_[a-z]+)'/g)) keys.add(m[2]);
	return [...keys];
};

describe('every counter a page can send is one the server keeps', () => {
	const found: Array<[string, string]> = [];
	for (const file of SOURCES) {
		const src = readFileSync(resolve(root, file), 'utf8');
		if (!src.includes('LessonEvent')) continue;
		for (const k of lessonKeysIn(src)) found.push([file, k]);
	}

	it('found counters to check at all', () => {
		// A regex that silently matches nothing would make every assertion below
		// pass while checking exactly zero keys.
		expect(found.length).toBeGreaterThan(30);
		expect(new Set(found.map(([f]) => f)).size).toBeGreaterThanOrEqual(6);
	});

	it.each(found)('%s sends %s', (file, key) => {
		expect(allowed(key), `${file} sends "${key}", which the server folds into "other"`).toBe(true);
	});
});

describe('every data-track target a page can send is one the landing endpoint keeps', () => {
	const found: Array<[string, string]> = [];
	for (const file of SOURCES.filter((f) => f.endsWith('.html'))) {
		const src = readFileSync(resolve(root, file), 'utf8');
		if (!src.includes('LandingEvent')) continue;
		const nav = new Set([...src.matchAll(/'[a-z-]+':\s*'(nav_[a-z]+)'/g)].map((m) => m[1]));
		for (const m of src.matchAll(/data-track="([a-z-]+)"/g)) if (!nav.has(m[1])) found.push([file, m[1]]);
		// the page's own once-per-session self-report
		for (const m of src.matchAll(/track\('click','([a-z-]+)'\)/g)) found.push([file, m[1]]);
	}

	it('found targets to check', () => {
		expect(found.length).toBeGreaterThan(10);
	});

	it.each(found)('%s sends %s', (file, target) => {
		expect(LANDING_TARGETS.has(target), `${file} sends data-track="${target}", which becomes "other"`).toBe(true);
	});
});

describe('every public page reports that it was opened', () => {
	// Three pages reported NOTHING before this audit — including the privacy
	// policy, which is the page a district reads before approving anything.
	const PAGES: Array<[string, RegExp]> = [
		['landing.html', /track\('visit'/],
		['privacy.html', /track\('click','privacy-page'\)/],
		['support.html', /track\('click','support-page'\)/],
		['age-rating.html', /track\('click','rating-page'\)/],
		['teachers-index.html', /view_hub/],
		['teachers-science.html', /view_science/],
		['teachers-coding.html', /view_coding/],
		['developers-api.html', /view_developers/],
		['learn-index.html', /view_learn/],
	];

	it.each(PAGES)('%s', (name, re) => {
		expect(readFileSync(resolve(root, 'public', name), 'utf8')).toMatch(re);
	});

	it('the lesson and the builder do too, from their partials', () => {
		expect(readFileSync(resolve(root, 'public/partials/ww-lesson.js'), 'utf8')).toContain("bump('view_lesson')");
		expect(readFileSync(resolve(root, 'public/partials/ww-builder.js'), 'utf8')).toContain("bump('view_builder')");
	});
});

describe('reach is measured separately from traffic', () => {
	// A page whose views and first-visits are close is finding new people; one
	// where views run far ahead is being reloaded by the same few. Those are
	// opposite problems, and one number cannot tell them apart.
	const UNIQUE: Array<[string, string]> = [
		['public/teachers-index.html', 'unique_hub'],
		['public/teachers-science.html', 'unique_science'],
		['public/teachers-coding.html', 'unique_coding'],
		['public/developers-api.html', 'unique_developers'],
		['public/learn-index.html', 'unique_learn'],
		['public/partials/ww-lesson.js', 'unique_lesson'],
		['public/partials/ww-builder.js', 'unique_builder'],
	];

	it.each(UNIQUE)('%s sends %s', (file, key) => {
		const src = readFileSync(resolve(root, file), 'utf8');
		expect(src).toContain(key);
		// localStorage, not sessionStorage: a per-session flag counts a returning
		// visitor as new every morning, which is the number it exists to exclude.
		expect(src).toMatch(/localStorage/);
		expect(allowed(key)).toBe(true);
	});

	it('and the server hands both back per page', () => {
		expect(RESOURCES).toMatch(/const reach = \[/);
		expect(RESOURCES).toMatch(/views: step\('view_hub'\), unique: step\('unique_hub'\)/);
		// null rather than 0 for a page that does not report it: "nobody new" and
		// "not measured" are different answers.
		expect(RESOURCES).toMatch(/unique: step\('unique_\w+'\) \|\| null/);
	});
});

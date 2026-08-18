import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// What the website beacon puts on the wire.
//
// This exists because of a specific failure that no test could have caught,
// because nothing was broken in the usual sense: every page sent `ref` — up to
// 200 characters of raw document.referrer, which on a search engine includes the
// query the visitor typed — and `lang`, on EVERY event, and the endpoint that
// received them read neither. Data collected and never used is the worst trade
// available: all of the cost, none of the answer. PRIVACY.md says the site keeps
// counters; a referrer URL is not a counter.
//
// So these assert the shape of the payload rather than the behaviour of the
// page. They are deliberately about the SOURCE TEXT: a payload field is a
// promise, and the cheapest place to check a promise is where it is written.

const root = process.cwd();
const PAGES = ['landing.html', 'teachers.html', 'privacy.html', 'support.html', 'age-rating.html'];
const src = (p: string) => readFileSync(join(root, 'public', p), 'utf8');

describe('the /LandingEvent/ beacon', () => {
	it.each(PAGES)('%s sends no referrer and no browser language', (page) => {
		const s = src(page);
		expect(s).not.toContain('document.referrer?String');
		expect(s).not.toMatch(/\bref\s*:/);
		expect(s).not.toContain('navigator.language');
	});

	it.each(PAGES)('%s sends only type, target, first and from', (page) => {
		const m = /JSON\.stringify\(\{type:type[\s\S]*?\}\)/.exec(src(page));
		expect(m, `${page} has no beacon payload`).toBeTruthy();
		// Keys only: a bare /(\w+):/ also matches the `firstVisit` in the ternary
		// that decides whether `first` is sent, so anchor on the `{` or the `,`.
		const fields = [...m![0].matchAll(/[{,]\s*(\w+)\s*:/g)].map((x) => x[1]);
		expect(new Set(fields)).toEqual(new Set(['type', 'target', 'from', ...(page === 'landing.html' ? ['first'] : [])]));
	});
});

describe('the arrival bucket', () => {
	// Only the two pages with a once-per-session ping resolve one. The policy
	// pages send clicks and no page ping, so they have no arrival to report and
	// must not carry the bucketer at all.
	const WITH = ['landing.html', 'teachers.html'];
	const WITHOUT = ['privacy.html', 'support.html', 'age-rating.html'];

	it.each(WITH)('%s resolves the referrer in the browser', (page) => {
		const s = src(page);
		expect(s).toContain('function sourceBucket()');
		// The URL is parsed and reduced to a hostname here. If a future edit ever
		// puts document.referrer into the payload instead, the test above fails.
		expect(s).toContain('new URL(document.referrer).hostname');
	});

	it.each(WITH)('%s passes the bucket on its once-per-session ping only', (page) => {
		const s = src(page);
		const calls = [...s.matchAll(/track\((?:[^)]*)\)/g)].map((m) => m[0]);
		const withBucket = calls.filter((c) => c.includes('sourceBucket()'));
		// Exactly the two call sites in the session-ping function: the normal path
		// and its storage-unavailable fallback.
		expect(withBucket).toHaveLength(2);
		// Every other track() call — the outbound link clicks — sends no bucket, so
		// one visitor clicking six links is still one arrival.
		expect(calls.length).toBeGreaterThan(withBucket.length);
	});

	it.each(WITHOUT)('%s reports no arrival at all', (page) => {
		expect(src(page)).not.toContain('sourceBucket');
	});

	it('never sends a bucket outside the nine the server accepts', () => {
		const s = src('landing.html');
		// The bucket NAMES the table can emit — the second half of each pair — plus
		// the two the function returns directly. Matching on the name would be
		// wrong: 'bsky' is what a hostname contains, 'bluesky' is what we count.
		const buckets = [...s.matchAll(/\['[a-z]+','([a-z]+)'\]/g)].map((m) => m[1]);
		expect(buckets.length).toBe(7);
		const emitted = new Set([...buckets, 'direct', 'other']);
		expect(emitted).toEqual(
			new Set(['google', 'bing', 'duckduckgo', 'reddit', 'itch', 'apple', 'bluesky', 'direct', 'other']),
		);
	});

	it('treats a same-site referrer as no arrival', () => {
		// Clicking from the landing page to /teachers is navigation, not an
		// arrival. Without this, every internal link would inflate 'other'.
		expect(src('landing.html')).toContain('if(h===location.hostname)return null');
	});
});

describe('sourceBucket, run', () => {
	// The tests above check what the source says. This one runs it: the function
	// is lifted out of the page and given a document and a location to look at,
	// so a real referrer goes in and a bucket comes out. Byte-level assertions
	// would not have caught a regex that matched the wrong half of a hostname.
	const build = () => {
		const html = src('landing.html');
		const hosts = /var SOURCE_HOSTS=\[[\s\S]*?\]\];/.exec(html);
		const fn = /function sourceBucket\(\)\{[\s\S]*?\n  \}/.exec(html);
		expect(hosts, 'SOURCE_HOSTS not found').toBeTruthy();
		expect(fn, 'sourceBucket not found').toBeTruthy();
		return new Function(
			'document',
			'location',
			`${hosts![0]}\n${fn![0]}\nreturn sourceBucket;`,
		) as (d: unknown, l: unknown) => () => string | null;
	};

	const bucketFor = (referrer: string) =>
		build()({ referrer }, { hostname: 'wildwillows.app' })();

	it.each([
		['https://www.google.com/search?q=teach+kids+apis', 'google'],
		['https://google.co.uk/', 'google'],
		['https://duckduckgo.com/', 'duckduckgo'],
		['https://www.reddit.com/r/teachers/comments/abc/', 'reddit'],
		['https://wild-willows.itch.io/', 'itch'],
		['https://apps.apple.com/app/id123', 'apple'],
		// Bluesky's hosts carry 'bsky', never 'bluesky' — the bucket is named for
		// the service, the match is on the domain, and they are not the same string.
		['https://bsky.app/profile/someone', 'bluesky'],
		['https://bsky.social/', 'bluesky'],
		['https://some.school.edu/library/links', 'other'],
	])('%s -> %s', (referrer, expected) => {
		expect(bucketFor(referrer)).toBe(expected);
	});

	it('calls an empty referrer direct', () => {
		expect(bucketFor('')).toBe('direct');
	});

	it('returns nothing for our own pages', () => {
		// An internal link is navigation, not an arrival. Returning null here is
		// what keeps a click from /teachers back to / out of the numbers.
		expect(bucketFor('https://wildwillows.app/teachers')).toBeNull();
		expect(bucketFor('https://www.wildwillows.app/privacy')).toBeNull();
	});

	it('never throws on a referrer that is not a URL', () => {
		// document.referrer is not ours and the beacon must not be the thing that
		// breaks a page. Anything unparseable is just "somewhere else".
		expect(bucketFor('not a url at all')).toBe('other');
	});

	it('emits no query string, no path and no host under any input', () => {
		const nasty = 'https://mail.google.com/inbox?token=abc123&user=bailey%40example.com';
		const out = bucketFor(nasty);
		expect(out).toBe('google');
		expect(out).not.toContain('abc123');
		expect(out).not.toContain('@');
	});
});

// Wild Willows — every public URL the site serves, in ONE table.
//
// Which file a page is built from, what URL serves it, whether it 301s to the
// apex, whether it is listed in /sitemap.xml, and which pages are translations
// of one another. Everything downstream is derived from here.
//
// WHY IT LIVES IN scripts/ RATHER THAN server/: two consumers need it and they
// run in different worlds. scripts/build-pages.mjs imports this module directly
// at build time (plain Node, no TypeScript loader); server/endpoints-pages.ts is
// bundled by esbuild and reads server/site-pages.ts, which build-pages.mjs
// GENERATES from this file. Same arrangement as server/pages.ts and
// server/page-lastmod.ts: generated, committed, never hand-edited.
//
// WHY ONE TABLE: this replaced three that had to agree with each other — the
// inline-these-files map, the sitemap's URL list, and the lastmod source map —
// and nothing checked that they did. The failure mode is silent and slow: a page
// added to the site but forgotten in the sitemap simply never gets indexed, and
// you find out months later. A second language would have turned three lists
// into six, so the lists went first.

/** The one hostname the public site is served under. */
export const SITE_ORIGIN = 'https://wildwillows.app';

/**
 * The locale everything falls back to: what `hreflang="x-default"` points at,
 * and the language a visitor gets when nothing else applies.
 */
export const DEFAULT_LOCALE = 'en';

/**
 * The pages.
 *
 * `key`      — unique per URL. It is the ETag/compression cache key in
 *              htmlPage() and the name the endpoints ask for.
 * `group`    — pages that are the SAME page in different languages share one
 *              group. That is the only thing that pairs them, and it is what
 *              hreflang and the sitemap's alternates are generated from.
 * `locale`   — the language the page is written in.
 * `const`    — the export name in the generated server/pages.ts.
 * `src`      — the file in public/ it is inlined from.
 * `path`     — the URL. Also the key into pageLastmod.
 * `redirect` — requests arriving on the ORIGIN hostname are 301'd to the apex.
 *              See the note in server/endpoints-pages.ts for why this is a
 *              per-path flag and never a blanket rule: the desktop app, the itch
 *              build and the browser demo all call this Harper by its real
 *              hostname, and a 301 on those would break every one of them.
 * `sitemap`  — the path is listed in /sitemap.xml.
 * `pdf`      — for the classroom PDFs: the keyword their filename is matched by,
 *              instead of a `src`. They have no HTML and no const; they are here
 *              because they ARE public URLs in the sitemap, and a URL table that
 *              omitted them would be back to two lists.
 *
 * Two flags rather than one because they genuinely diverge: the dashboard wants
 * neither, and a noindex page wants the redirect without the listing.
 */
export const SITE_PAGES = [
	// Marketing landing page served at the site root (GET /). Screenshots are
	// real cacheable URLs under /img/, so this ships as one string like the
	// policy pages.
	{
		key: 'landing',
		group: 'landing',
		locale: 'en',
		const: 'landingHtml',
		src: 'public/landing.html',
		path: '/',
		redirect: true,
		sitemap: true,
	},
	// The Spanish landing page. The GAME has shipped full Spanish since 0.3 —
	// app, panels, narrative and the whole data-content overlay — and until this
	// page existed none of that was discoverable by anyone searching in Spanish:
	// every public URL was lang="en" and said so. Its copy uses the terminology
	// in src/i18n/es so the site and the game call things the same thing.
	//
	// /es/ is a subdirectory, not a subdomain: it inherits the apex's authority
	// instead of splitting it, and it costs no extra hosting. It is also NOT
	// reached by sniffing Accept-Language — Google asks explicitly that sites not
	// auto-redirect on presumed language, and a visitor bounced into a language
	// they did not choose cannot get back out. The footer link is the way in.
	{
		key: 'landing-es',
		group: 'landing',
		locale: 'es',
		const: 'landingEsHtml',
		src: 'public/es/landing.html',
		path: '/es/',
		redirect: true,
		sitemap: true,
	},
	{
		key: 'privacy',
		group: 'privacy',
		locale: 'en',
		const: 'privacyHtml',
		src: 'public/privacy.html',
		path: '/privacy.html',
		redirect: true,
		sitemap: true,
	},
	{
		key: 'age-rating',
		group: 'age-rating',
		locale: 'en',
		const: 'ageRatingHtml',
		src: 'public/age-rating.html',
		path: '/age-rating.html',
		redirect: true,
		sitemap: true,
	},
	{
		key: 'support',
		group: 'support',
		locale: 'en',
		const: 'supportHtml',
		src: 'public/support.html',
		path: '/support.html',
		redirect: true,
		sitemap: true,
	},
	// Who makes the game. Its own URL rather than a section of the landing page
	// for the same reason /teachers is: it answers a different question, from a
	// visitor who has usually already played, and it is the page a press mention
	// or a store listing links when it wants "the developer" rather than "the
	// game". Extensionless like /teachers and /learn — nothing external points at
	// an .html version of it, so it gets the cleaner path.
	{
		key: 'about',
		group: 'about',
		locale: 'en',
		const: 'aboutHtml',
		src: 'public/about.html',
		path: '/about',
		redirect: true,
		sitemap: true,
	},
	// The teachers section: a hub and its two kits, all three under one resource.
	//
	// /teachers is extensionless on purpose — it is not a store-listing URL that
	// anything external already points at, so it gets the cleaner path teachers
	// will type and share. It used to BE the science lesson, and it stays a 200
	// rather than redirecting: an established URL printed inside both classroom
	// PDFs should change job, not change address.
	{
		key: 'teachers',
		group: 'teachers',
		locale: 'en',
		const: 'teachersIndexHtml',
		src: 'public/teachers-index.html',
		path: '/teachers',
		redirect: true,
		sitemap: true,
	},
	{
		key: 'teachers-science',
		group: 'teachers-science',
		locale: 'en',
		const: 'teachersScienceHtml',
		src: 'public/teachers-science.html',
		path: '/teachers/science',
		redirect: true,
		sitemap: true,
	},
	{
		key: 'teachers-coding',
		group: 'teachers-coding',
		locale: 'en',
		const: 'teachersCodingHtml',
		src: 'public/teachers-coding.html',
		path: '/teachers/coding',
		redirect: true,
		sitemap: true,
	},
	// The public-API documentation. /developers serves the same document and is
	// deliberately NOT listed: two URLs in a sitemap for one page is the
	// split-signal problem this table exists to avoid. The page's canonical says
	// which of the two is the real one.
	{
		key: 'developers-api',
		group: 'developers-api',
		locale: 'en',
		const: 'developersApiHtml',
		src: 'public/developers-api.html',
		path: '/developers/api',
		redirect: true,
		sitemap: true,
	},
	// The classroom hub at /learn: the two doors and enough copy to choose
	// between them. Indexable — "learn javascript with a real api" is a thing
	// people search for, and this is the page that answers it for someone who has
	// not heard of the game.
	{
		key: 'learn',
		group: 'learn',
		locale: 'en',
		const: 'learnIndexHtml',
		src: 'public/learn-index.html',
		path: '/learn',
		redirect: true,
		sitemap: true,
	},
	// The Code Builder is `noindex` in its own <head> — it is a tool, not a
	// document, and an indexed code editor competes with the lesson that explains
	// it. Absent from the sitemap, still canonicalising to the apex.
	{
		key: 'learn-code-builder',
		group: 'learn-code-builder',
		locale: 'en',
		const: 'learnCodeBuilderHtml',
		src: 'public/learn-code-builder.html',
		path: '/learn/code-builder',
		redirect: true,
		sitemap: false,
	},
	// The lesson, unlike the builder, IS a document — nine chapters of teachable
	// prose that a teacher searching for "high school API lesson" should find.
	{
		key: 'learn-web-development',
		group: 'learn-web-development',
		locale: 'en',
		const: 'learnWebDevelopmentHtml',
		src: 'public/learn-web-development.html',
		path: '/learn/web-development',
		redirect: true,
		sitemap: true,
	},
	// Indexable — Google indexes PDF content, and these are the only thing on the
	// site aimed squarely at a teacher searching for a classroom ecology
	// resource. No redirect: they are not served through htmlPage(), so nothing
	// would read the flag.
	{
		key: 'educator-guide',
		group: 'educator-guide',
		locale: 'en',
		pdf: 'educator',
		path: '/educator-guide.pdf',
		redirect: false,
		sitemap: true,
	},
	{
		key: 'student-worksheets',
		group: 'student-worksheets',
		locale: 'en',
		pdf: 'worksheet',
		path: '/student-worksheets.pdf',
		redirect: false,
		sitemap: true,
	},
	// Neither flag. The metrics dashboard is noindex, is reached by URL on the
	// origin, and redirecting it would strip the Authorization header on the way.
	{
		key: 'dashboard',
		group: 'dashboard',
		locale: 'en',
		const: 'dashboardHtml',
		src: 'public/dashboard.html',
		path: '/dashboard',
		redirect: false,
		sitemap: false,
	},
];

/**
 * group -> every locale it exists in, in table order.
 *
 * Built rather than written down, which is the whole point: hreflang is only
 * honoured when the annotations are reciprocal — every version listing itself
 * AND all the others — and a hand-maintained set gets that wrong the first time
 * a page is added. Derived from one table, it cannot disagree with itself.
 */
export function alternatesByGroup(pages = SITE_PAGES) {
	const groups = new Map();
	for (const p of pages) {
		if (!groups.has(p.group)) groups.set(p.group, []);
		groups.get(p.group).push({ locale: p.locale, path: p.path });
	}
	// A page with no translation gets no annotations at all: hreflang on a
	// single-language page is noise that says nothing.
	for (const [group, alts] of groups) if (alts.length < 2) groups.delete(group);
	return groups;
}

/** Fail the build on the mistakes this table makes possible. */
export function assertTableSound(pages = SITE_PAGES) {
	const seenKeys = new Set();
	const seenPaths = new Set();
	const seenConsts = new Set();
	for (const p of pages) {
		for (const [field, set] of [
			['key', seenKeys],
			['path', seenPaths],
		]) {
			if (set.has(p[field])) throw new Error(`site-pages: duplicate ${field} "${p[field]}"`);
			set.add(p[field]);
		}
		if (p.const) {
			if (seenConsts.has(p.const)) throw new Error(`site-pages: duplicate const "${p.const}"`);
			seenConsts.add(p.const);
		}
		if (Boolean(p.const) === Boolean(p.pdf))
			throw new Error(`site-pages: "${p.key}" needs exactly one of const+src or pdf`);
		if (p.const && !p.src) throw new Error(`site-pages: "${p.key}" has a const but no src`);
		if (!p.path.startsWith('/')) throw new Error(`site-pages: "${p.key}" path must be absolute`);
	}
	for (const [group, alts] of alternatesByGroup(pages)) {
		const locales = alts.map((a) => a.locale);
		if (new Set(locales).size !== locales.length)
			throw new Error(`site-pages: group "${group}" has two pages in the same locale`);
		if (!locales.includes(DEFAULT_LOCALE))
			throw new Error(
				`site-pages: group "${group}" has translations but no ${DEFAULT_LOCALE} page — ` +
					`hreflang="x-default" would have nothing to point at`,
			);
	}
}

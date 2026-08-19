// Wild Willows — server: endpoints-pages
//
// The static site served straight out of Harper: policy and marketing pages, the
// favicon and og-image, the PDFs, robots.txt and sitemap.xml.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { pageLastmod } from './page-lastmod';
import {
	ageRatingHtml,
	buildStamp,
	dashboardHtml,
	developersApiHtml,
	landingHtml,
	learnCodeBuilderHtml,
	learnIndexHtml,
	learnWebDevelopmentHtml,
	ogImageB64,
	privacyHtml,
	supportHtml,
	teachersCodingHtml,
	teachersIndexHtml,
	teachersScienceHtml,
} from './pages';
// @ts-ignore — Node built-in; this project deliberately has no @types/node
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

import { BROTLI_QUALITY, PublicEndpoint, nodeBuffer } from './endpoints-game';
import { bumpPdfDownload } from './endpoints-telemetry';

// ---------------------------------------------------------------- policy pages
// The hosted Harper serves NO static files — it is endpoints only (the game UI
// ships inside the desktop app). But store listings still need public URLs for
// the privacy policy and age-suitability pages, so these two endpoints return
// the HTML inlined from public/*.html (via scripts/build-pages.mjs, run by
// `npm run build:server`). Returning { headers, body } bypasses Harper's
// content negotiation, so the browser gets real text/html.
//
// Harper's path matcher also strips a .html suffix when resolving a resource,
// so the canonical store-facing URLs work as plain pages:
//   GET /privacy.html     → privacy      (also /privacy/)
//   GET /age-rating.html  → age-rating   (also /age-rating/)

/**
 * Compressed representations of the inlined pages, built lazily ONCE per process.
 *
 * Same reason GameData compresses itself: Harper's REST path does not compress
 * resource responses, so whatever these endpoints return goes out on the wire
 * verbatim. That is fine for the policy pages and very much not fine for the two
 * big ones — /dashboard is ~90 KB of HTML and the landing page is ~575 KB, and
 * every visit was paying for all of it.
 *
 * The bytes are fixed by the build, so this is a one-time cost per page per
 * process (~15 ms for the landing page at quality 5) and free forever after.
 * Note the landing page is mostly base64-inlined screenshots, i.e. already-
 * compressed image data — it only comes down to ~403 KB. Getting it properly
 * small means serving those screenshots as their own cacheable endpoints rather
 * than compressing them harder.
 */
const pageCompressed = new Map<string, { br?: Uint8Array; gzip?: Uint8Array }>();
function compressedPage(key: string, html: string, enc: 'br' | 'gzip'): Uint8Array {
	let entry = pageCompressed.get(key);
	if (!entry) pageCompressed.set(key, (entry = {}));
	if (enc === 'br') {
		if (!entry.br) {
			const buf = nodeBuffer.from(html, 'utf8');
			entry.br = brotliCompressSync(buf, {
				params: {
					[zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
					[zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
				},
			});
		}
		return entry.br as Uint8Array;
	}
	if (!entry.gzip) entry.gzip = gzipSync(nodeBuffer.from(html, 'utf8'), { level: 6 });
	return entry.gzip as Uint8Array;
}

/**
 * Every public URL this Harper serves, in ONE table — because two lists that
 * have to agree with each other eventually won't, and the failure is silent: a
 * page added to the site but forgotten in the sitemap just quietly never gets
 * indexed.
 *
 * `redirect` — requests for this path arriving on the ORIGIN hostname are 301'd
 * to the apex. Background: wildwillows.app is a proxied CNAME to this Harper, so
 * the origin answers the identical pages under its own name, and Google indexed
 * the origin INSTEAD of the apex (the Mac App Store listing pointed at it, which
 * is how the crawler found it). Two hostnames serving byte-identical HTML split
 * every ranking signal between them.
 *
 * The flag is on individual paths, and NOT a blanket "redirect all HTML", for
 * one reason: the desktop app, the itch build and the browser demo all call this
 * Harper cross-origin BY ITS REAL HOSTNAME. A 301 on those endpoints would break
 * every one of them. Only what is listed here can ever redirect.
 *
 * `sitemap` — the path is listed in /sitemap.xml.
 *
 * Two flags rather than one because they genuinely diverge: the dashboard wants
 * neither, and a future noindex page would want the redirect without the
 * listing. Keeping them distinct means neither decision has to be re-derived.
 */
const PUBLIC_PAGES: Record<string, { path: string; redirect: boolean; sitemap: boolean }> = {
	landing: { path: '/', redirect: true, sitemap: true },
	privacy: { path: '/privacy.html', redirect: true, sitemap: true },
	'age-rating': { path: '/age-rating.html', redirect: true, sitemap: true },
	support: { path: '/support.html', redirect: true, sitemap: true },
	// Extensionless on purpose: this one is not a store-listing URL that anything
	// external already points at, so it gets the cleaner path teachers will type
	// and share. Harper serves /teachers.html too (it strips the suffix), which
	// costs nothing and cannot be linked to by accident.
	teachers: { path: '/teachers', redirect: true, sitemap: true },
	// The two kits the hub leads to. /teachers stays a 200 and keeps its equity:
	// it is an established URL printed in both PDFs and linked externally, so it
	// changes job rather than changing address.
	'teachers-science': { path: '/teachers/science', redirect: true, sitemap: true },
	'teachers-coding': { path: '/teachers/coding', redirect: true, sitemap: true },
	// The API docs. /developers serves the same document and is deliberately NOT
	// listed: two URLs in a sitemap for one page is the split-signal problem the
	// comment at the top of this table is about. The page's canonical says which
	// of the two is the real one.
	'developers-api': { path: '/developers/api', redirect: true, sitemap: true },
	// The classroom student pages live under /learn/<slug>, resolved by ONE
	// resource reading getId() — the same shape /img/<name>.webp already uses.
	// The builder is `noindex` in its own <head> (it is a tool, not a document,
	// and an indexed code editor competes with the lesson that explains it), so
	// it is deliberately absent from the sitemap while still canonicalising to
	// the apex like every other page.
	'learn-code-builder': { path: '/learn/code-builder', redirect: true, sitemap: false },
	// The lesson, unlike the builder, IS a document — nine chapters of teachable
	// prose that a teacher searching for "high school API lesson" should be able
	// to find. Indexable and in the sitemap; the builder it hands off to is not.
	'learn-web-development': { path: '/learn/web-development', redirect: true, sitemap: true },
	// The hub the two student pages hang off. Indexable: "learn javascript with a
	// real api" is a thing people search for, and this is the page that answers it
	// for someone who has not heard of the game.
	learn: { path: '/learn', redirect: true, sitemap: true },
	// The classroom PDFs. Indexable — Google indexes PDF content, and these are
	// the only thing on the site aimed squarely at teachers searching for a
	// classroom ecology resource. No redirect: they are not served through
	// htmlPage(), so nothing would read the flag.
	'educator-guide': { path: '/educator-guide.pdf', redirect: false, sitemap: true },
	'student-worksheets': { path: '/student-worksheets.pdf', redirect: false, sitemap: true },
	// Neither. The metrics dashboard is noindex, is reached by URL on the origin,
	// and redirecting it would strip the Authorization header on the way.
	dashboard: { path: '/dashboard', redirect: false, sitemap: false },
};
const ORIGIN_HOSTNAME = 'wild.willows.harperfabric.com';
const SITE_ORIGIN = 'https://wildwillows.app';

/**
 * One of the inlined HTML pages, content-negotiated and revalidatable.
 *
 * `res` is the endpoint instance, needed only to reach the request headers. As in
 * GameData: no HTTP context means an internal/renderer caller, and those get the
 * plain string back without zlib ever being touched (node:zlib is a no-op shim in
 * the web build).
 *
 * The ETag is the build stamp, so a returning visitor's browser revalidates into
 * an empty 304 instead of re-downloading the page — which matters more here than
 * the compression does, since the landing page's weight is images that don't
 * shrink but do cache.
 */
function htmlPage(res: any, key: string, html: string, opts: { private?: boolean } = {}) {
	const etag = `W/"${key}-${buildStamp}"`;
	const headers: Record<string, string> = {
		'content-type': 'text/html; charset=utf-8',
		// `private` for anything behind admin auth: a shared cache or proxy that
		// stored a `public` copy would serve the authed page to whoever asked next,
		// which would hand back the very thing the auth is there to stop.
		'cache-control': opts.private ? 'private, no-store' : 'public, max-age=3600',
		etag,
		vary: 'Accept-Encoding',
	};

	const reqHeaders: any = res?.getContext?.()?.headers;
	if (!reqHeaders || typeof reqHeaders.get !== 'function') return { status: 200, headers, body: html };

	// Origin hostname -> apex. See PUBLIC_PAGES above for why this is a table
	// lookup and not a blanket rule.
	const page = PUBLIC_PAGES[key];
	const canonicalPath = page?.redirect ? page.path : undefined;
	const host = String(reqHeaders.get('host') || '')
		.toLowerCase()
		.split(':')[0];
	if (canonicalPath && host === ORIGIN_HOSTNAME) {
		return {
			status: 301,
			headers: {
				location: SITE_ORIGIN + canonicalPath,
				// A 301 is cached forever by browsers unless told otherwise, and this
				// one is a hostname decision that could plausibly be revisited. An hour
				// is long enough for crawlers to act on and short enough to take back.
				'cache-control': 'public, max-age=3600',
			},
		};
	}

	// Compare loosely so a weak/strong prefix or quoting mismatch still matches.
	const norm = (s: string) => s.replace(/^W\//, '').trim();
	const ifNoneMatch = String(reqHeaders.get('if-none-match') || '');
	if (ifNoneMatch && norm(ifNoneMatch) === norm(etag)) return { status: 304, headers };

	const accept = String(reqHeaders.get('accept-encoding') || '');
	if (/\bbr\b/.test(accept))
		return { status: 200, headers: { ...headers, 'content-encoding': 'br' }, body: compressedPage(key, html, 'br') };
	if (/\bgzip\b/.test(accept))
		return {
			status: 200,
			headers: { ...headers, 'content-encoding': 'gzip' },
			body: compressedPage(key, html, 'gzip'),
		};
	return { status: 200, headers, body: html };
}

/** GET /privacy.html — the privacy policy (linked from App Store Connect, itch, etc.). */
export class PrivacyPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'privacy', privacyHtml);
	}
}

/** GET /age-rating.html — age-suitability / content information page. */
export class AgeRatingPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'age-rating', ageRatingHtml);
	}
}

/** GET /support.html — support / FAQ page (App Store Connect's Support URL). */
export class SupportPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'support', supportHtml);
	}
}

/**
 * GET /dashboard — the internal gameplay-metrics dashboard. A static,
 * self-contained page (inline CSS/JS, no external deps) that fetches the roll-up
 * at runtime and renders it: audience, engagement, funnels, progression, action
 * totals, achievements, and the caretakers' customized characters.
 *
 * The PAGE is public; everything it reads is not. That split is deliberate and it
 * is the only arrangement a login form can work under — a form cannot live behind
 * the thing it logs you into. What ships here is an empty shell: inline CSS and
 * JS, not one number baked in. Serving it to a stranger reveals nothing, and
 * every fetch it makes is refused without credentials.
 *
 * So the security boundary is entirely on the endpoints — /DashboardAuth/,
 * /MetricsSummary/, /MetricsPlayers/, /SaveHealth/, /GameplayHealth/ and
 * /LandingStats/, all DashboardEndpoint — and never on the URL of this page.
 * Which is the fix for how it started: public AND unlisted, which is not a
 * control. It renders player display names, exact activity timestamps, OS and
 * accessibility preferences, and it fetched all of that from the reader's
 * browser, so anyone with the URL had the lot. (The README used to claim "no
 * player names"; the player modal has always shown them.)
 *
 * `no-store` all the same: a shell whose whole job is to ask for a password is
 * not worth caching, and it means a redeploy shows up on the next reload.
 */
export class DashboardPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'dashboard', dashboardHtml, { private: true });
	}
}

/**
 * GET /teachers — the classroom page: what the game teaches, how one class
 * period runs, discussion prompts, and the two free PDFs.
 *
 * Its own page rather than a section of the landing page because the audience
 * arrives differently. A teacher searching "ecosystem lesson plan grades 5-8"
 * is not looking for a cozy game, and an anchor deep inside a 480 KB marketing
 * page is neither a shareable link nor something a search engine will surface
 * on its own terms. Splitting it also means the landing page stops paying for
 * copy that only teachers read.
 */
/**
 * GET /teachers and /teachers/<slug> — the classroom hub and its two kits.
 *
 * Same shape as LearnPage, and for the same reason: Harper resolves the FIRST
 * path segment to a resource and hands the rest to getId(), so one resource
 * covers the section and the hub is the empty slug rather than a separate
 * export.
 *
 * /teachers used to BE the science lesson. It stays a 200 rather than
 * redirecting to /teachers/science: it is an established URL, printed inside
 * both classroom PDFs and linked from outside, and an established URL should
 * change job rather than change address. The lesson's title, description,
 * keywords and LearningResource markup went with it to the new path, so the two
 * pages target two different intents instead of competing for one.
 */
const TEACHER_PAGES: Record<string, { key: string; html: string }> = {
	'': { key: 'teachers', html: teachersIndexHtml },
	science: { key: 'teachers-science', html: teachersScienceHtml },
	coding: { key: 'teachers-coding', html: teachersCodingHtml },
};

export class TeachersPage extends PublicEndpoint {
	async get() {
		const slug = String((this as any).getId?.() || '')
			.trim()
			.replace(/^\/+|\/+$/g, '');
		const page = Object.prototype.hasOwnProperty.call(TEACHER_PAGES, slug) ? TEACHER_PAGES[slug] : null;
		if (!page) {
			return {
				status: 404,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
				body: 'Not found',
			};
		}
		return htmlPage(this, page.key, page.html);
	}
}

/**
 * GET /learn/<slug> — the classroom student pages.
 *
 * One resource for the whole section, dispatching on getId(), because Harper
 * resolves the FIRST path segment to a resource and hands the rest to getId() —
 * the same mechanism the screenshot endpoint uses for /img/<name>.webp. A
 * resource per page would need one export per page and give /learn itself
 * nothing to serve.
 *
 * Unknown slugs 404 from an explicit map rather than falling through to a
 * default page: a typo'd link a teacher hands thirty students should say so
 * plainly, not silently serve them the wrong lesson.
 */
const LEARN_PAGES: Record<string, { key: string; html: string }> = {
	// The empty slug is /learn itself, which is the case the getId() dispatch was
	// shaped for: one resource for the section, so the hub is not a fourth export
	// and a third routing story.
	'': { key: 'learn', html: learnIndexHtml },
	'code-builder': { key: 'learn-code-builder', html: learnCodeBuilderHtml },
	'web-development': { key: 'learn-web-development', html: learnWebDevelopmentHtml },
};

/**
 * /developers and /developers/api — the public-API documentation.
 *
 * Both paths serve the same document, and the page canonicalises to
 * /developers/api. `/developers` is what somebody types; `/developers/api` is
 * what the plan named and what leaves room for a second doc later, so it is the
 * one in the sitemap and the one the canonical points at.
 *
 * Same getId() dispatch as the two sections above, and an unknown slug 404s
 * rather than quietly serving the docs from any URL under /developers.
 */
const DEVELOPER_PAGES: Record<string, { key: string; html: string }> = {
	'': { key: 'developers-api', html: developersApiHtml },
	api: { key: 'developers-api', html: developersApiHtml },
};

export class DevelopersPage extends PublicEndpoint {
	async get() {
		const slug = String((this as any).getId?.() || '')
			.trim()
			.replace(/^\/+|\/+$/g, '');
		const page = Object.prototype.hasOwnProperty.call(DEVELOPER_PAGES, slug) ? DEVELOPER_PAGES[slug] : null;
		if (!page) {
			return {
				status: 404,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
				body: 'Not found',
			};
		}
		return htmlPage(this, page.key, page.html);
	}
}

export class LearnPage extends PublicEndpoint {
	async get() {
		const slug = String((this as any).getId?.() || '')
			.trim()
			.replace(/^\/+|\/+$/g, '');
		const page = Object.prototype.hasOwnProperty.call(LEARN_PAGES, slug) ? LEARN_PAGES[slug] : null;
		if (!page) {
			return {
				status: 404,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
				body: 'Not found',
			};
		}
		return htmlPage(this, page.key, page.html);
	}
}

/**
 * GET / — the public marketing landing page (the face of wild.willows.harperfabric.com).
 * Self-contained, SEO-optimized static HTML with inlined screenshots, served at the
 * site root. Registered under the empty-string export name below, which Harper's
 * router resolves as the explicit root path.
 */
export class LandingPage extends PublicEndpoint {
	async get() {
		return htmlPage(this, 'landing', landingHtml);
	}
}

// The game's leaf mark, served as a real favicon so it shows in browser tabs and
// (crawled from /favicon.ico) in Google's search results. SVG scales to any size.
const FAVICON_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
	'<circle cx="12" cy="12" r="11" fill="#4a7c59"/>' +
	'<path d="M7 17C7 10.5 11 7.5 17 7.2c.3 6-2.7 10-10 9.8" fill="#d8eec2"/></svg>';

/** GET /favicon.ico · /favicon.svg — the site favicon (Harper strips the extension). */
export class Favicon extends PublicEndpoint {
	async get() {
		return {
			status: 200,
			headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' },
			body: FAVICON_SVG,
		};
	}
}

/**
 * The base64-inlined binaries (og image, theme audio, the two PDFs), decoded
 * ONCE per process.
 *
 * These were being re-decoded on every single request: `Buffer.from(b64,
 * 'base64')` over ~2.8 MB of base64 for /theme.mp3 and ~2 MB for each PDF, per
 * hit, throwing the result away afterwards. The source strings are compiled into
 * the bundle and never change, so there is nothing to invalidate — decode on
 * first use and hold the buffer.
 *
 * The decoded buffers are held for the life of the process (a few MB resident).
 * That is the trade being made deliberately: memory that the module's base64
 * strings were already costing anyway, in exchange for taking the decode off
 * every response.
 */
const decodedBinaries = new Map<string, any>();
function decodedBinary(key: string, b64: string): any {
	let buf = decodedBinaries.get(key);
	if (!buf) decodedBinaries.set(key, (buf = nodeBuffer.from(b64, 'base64')));
	return buf;
}

/**
 * GET /img/<name>.webp — the screenshots for the landing and teachers pages.
 *
 * These were base64 data URIs inside the HTML until the pages grew to 470 KB and
 * 260 KB of render-blocking document. Inlining looks like it saves a request, and
 * it does — at the cost of the one thing that actually matters here: an inlined
 * image cannot be cached apart from the page carrying it, cannot be fetched in
 * parallel with it, and cannot be deferred, because `loading="lazy"` on a data
 * URI defers nothing that has not already been downloaded. Four of these nine are
 * on BOTH pages, and as data URIs each one was paid for twice.
 *
 * Names are content-hashed by the build, so the answer is `immutable` with a
 * one-year max-age: a changed screenshot gets a new filename, and a name that
 * never changes never needs revalidating. That also makes the lookup its own
 * path-traversal defense — the key either exists in the generated record or the
 * request is a 404, and nothing here ever touches a filesystem path.
 *
 * Not in PUBLIC_PAGES: these are not pages, so there is no canonical to redirect
 * to and a 301 would just buy every image an extra round trip.
 */
export class Screenshot extends PublicEndpoint {
	async get() {
		const raw = String((this as any).getId?.() || '').trim();
		// Harper strips some trailing extensions and not others; accept either form
		// rather than depending on which list .webp happens to be on today.
		const name = raw.endsWith('.webp') ? raw : `${raw}.webp`;
		let body = decodedBinaries.get(`img:${name}`);
		if (!body) {
			const { screenshotsB64 } = await import('./img-assets');
			const b64 = Object.prototype.hasOwnProperty.call(screenshotsB64, name) ? screenshotsB64[name] : null;
			if (!b64) return { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'Not found' };
			body = decodedBinary(`img:${name}`, b64);
		}
		return {
			status: 200,
			headers: {
				'content-type': 'image/webp',
				'cache-control': 'public, max-age=31536000, immutable',
			},
			body,
		};
	}
}

/** GET /og-image.jpg — the social/OpenGraph preview image for the landing page. */
export class OgImage extends PublicEndpoint {
	async get() {
		return {
			status: 200,
			headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' },
			body: decodedBinary('og-image', ogImageB64),
		};
	}
}

/** GET /theme.mp3 — the game's main theme (Jon Licht), for the landing-page player.
 * The ~2 MB audio lives in its own module and is dynamic-imported so it never lands
 * in the web/desktop bundle (this endpoint only ever runs on the hosted Harper).
 * The import is cheap after the first call (module registry); the base64 decode was
 * not, hence decodedBinary. */
export class Theme extends PublicEndpoint {
	async get() {
		let body = decodedBinaries.get('theme');
		if (!body) {
			const { themeMp3B64 } = await import('./theme-audio');
			body = decodedBinary('theme', themeMp3B64);
		}
		return {
			status: 200,
			headers: {
				'content-type': 'audio/mpeg',
				'cache-control': 'public, max-age=604800',
				'accept-ranges': 'none',
			},
			body,
		};
	}
}

/** The two classroom PDFs behind the landing page's "For teachers" section.
 *
 * Same deal as /theme.mp3: the hosted Harper serves no static files, so the bytes
 * are inlined as base64 by scripts/build-pages.mjs into server/pdf-assets.ts and
 * dynamic-imported here — that keeps ~2 MB of base64 out of the web/desktop bundle
 * (Vite code-splits it; the game never loads it) while esbuild inlines it into the
 * server's resources.js.
 *
 * Each GET counts a download before it answers. Deliberately a SHORT cache: a
 * week-long one would hide every repeat download from the numbers, and an hour is
 * plenty to stop a reload from re-sending a megabyte. */
const pdfPage = (body: any, filename: string) => ({
	status: 200,
	headers: {
		'content-type': 'application/pdf',
		'cache-control': 'public, max-age=3600',
		// ASCII-only filename on purpose — a header value is latin-1, and the real
		// titles carry an em dash.
		'content-disposition': `inline; filename="${filename}"`,
	},
	body,
});

export class EducatorGuidePdf extends PublicEndpoint {
	async get() {
		await bumpPdfDownload('guide');
		let body = decodedBinaries.get('pdf-guide');
		if (!body) {
			const { educatorGuidePdfB64 } = await import('./pdf-assets');
			body = decodedBinary('pdf-guide', educatorGuidePdfB64);
		}
		return pdfPage(body, 'Wild-Willows-Educator-Guide.pdf');
	}
}

export class StudentWorksheetsPdf extends PublicEndpoint {
	async get() {
		await bumpPdfDownload('worksheets');
		let body = decodedBinaries.get('pdf-worksheets');
		if (!body) {
			const { studentWorksheetsPdfB64 } = await import('./pdf-assets');
			body = decodedBinary('pdf-worksheets', studentWorksheetsPdfB64);
		}
		return pdfPage(body, 'Wild-Willows-Student-Worksheets.pdf');
	}
}

/**
 * GET /robots.txt and GET /sitemap.xml — the two files that tell Google this
 * site exists and which URLs are worth having.
 *
 * There were none. Cloudflare was answering /robots.txt with its managed
 * content-signals block, which contains no User-agent, Allow, Disallow or
 * Sitemap line at all — so nothing was BLOCKED, but nothing was announced
 * either, and there was no sitemap for a crawler to find. Combined with the
 * origin-hostname duplicate above, the apex was absent from search entirely.
 *
 * Cloudflare appends its content-signals block to an origin robots.txt rather
 * than replacing it, so this file and that block should coexist. Worth
 * confirming on the live domain after this deploys — if Cloudflare still wins,
 * the managed robots.txt has to be turned off in the dashboard.
 *
 * Everything here is public and worth indexing except the metrics dashboard,
 * which is disallowed as a courtesy (its real protection is that every endpoint
 * it reads refuses an unauthenticated request — see DashboardPage).
 */
export class RobotsTxt extends PublicEndpoint {
	async get() {
		const body = [
			'User-agent: *',
			'Allow: /',
			'Disallow: /dashboard',
			'',
			`Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
			'',
		].join('\n');
		return {
			status: 200,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
			body,
		};
	}
}

/**
 * GET /sitemap.xml — the four public pages plus the two classroom PDFs.
 *
 * What is deliberately NOT here:
 *
 * <priority> and <changefreq>. Google ignores both, and has said so plainly for
 * years. They are inherited from a 2005 spec that no major engine implements.
 * Emitting them costs bytes and buys a false sense of control over crawl order.
 *
 * A build-time <lastmod>. See server/page-lastmod.ts: the date comes from git,
 * per file, and a path that cannot be dated honestly is simply emitted without
 * the element. A sitemap that claims every page changed on every deploy is worse
 * than one that claims nothing, because the engine stops believing the field.
 *
 * play.wildwillows.app. It is intentionally noindex (see workers/play.js), and a
 * sitemap may only list URLs on its own host anyway.
 */
export class SitemapXml extends PublicEndpoint {
	async get() {
		// Static, known-safe paths today. Escaped regardless: <loc> is XML, and the
		// day someone adds a query string with an `&` the feed silently stops
		// parsing — Search Console reports it as an unreadable sitemap, which is a
		// slow thing to notice and an annoying one to diagnose.
		const xml = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

		const entries = Object.values(PUBLIC_PAGES)
			.filter((p) => p.sitemap)
			.map((p) => {
				const lastmod = pageLastmod[p.path];
				return (
					'\t<url>\n' +
					`\t\t<loc>${xml(SITE_ORIGIN + p.path)}</loc>\n` +
					(lastmod ? `\t\t<lastmod>${lastmod}</lastmod>\n` : '') +
					'\t</url>\n'
				);
			})
			.join('');

		const body =
			'<?xml version="1.0" encoding="UTF-8"?>\n' +
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
			entries +
			'</urlset>\n';

		return {
			status: 200,
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				// Short on purpose: this is the file Search Console re-fetches to find
				// out what changed, and a long TTL at the CDN would hand it a stale
				// answer for the rest of the day after a deploy.
				'cache-control': 'public, max-age=3600',
			},
			body,
		};
	}
}

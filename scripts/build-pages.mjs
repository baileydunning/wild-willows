#!/usr/bin/env node
// Inlines public/*.html into server/pages.ts so the policy pages can be served
// by pure Harper ENDPOINTS — the hosted Harper serves no static files (the
// game UI ships only in the desktop app), but App Store Connect still needs
// public URLs for the privacy policy and age-suitability pages.
//
// Runs automatically as part of `npm run build:server` (before esbuild).
// server/pages.ts is generated + committed (like resources.js) so `npm run
// check`, Vite, and the integration harness all see a plain TS module and no
// bundler needs an .html loader. Edit public/*.html, not server/pages.ts.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LOCALE, SITE_ORIGIN, SITE_PAGES, alternatesByGroup, assertTableSound } from './site-pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

assertTableSound();

// --- Per-page <lastmod> for /sitemap.xml ------------------------------------
// The date a page's SOURCE last changed, from git, per file.
//
// The obvious shortcut — stamp every URL with the build time — is worse than
// having no lastmod at all. It claims all six pages changed every time anything
// deploys, and Google's stated behavior is to fall back on its own crawl
// signals once a site's lastmod proves unreliable. So the rule here is: emit a
// date only when we can prove one, and omit the element entirely otherwise.
// Silence is a legal sitemap; a confident wrong date is a liability.
const git = (...args) => {
	try {
		return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return null; // no git, no repo, or the command failed — caller degrades
	}
};

// A shallow clone (actions/checkout's default fetch-depth: 1) has exactly one
// commit, so `git log -1 -- <file>` returns that same commit for EVERY file —
// which is the all-pages-changed-today lie, laundered through git. Detect it and
// emit no dates at all rather than six identical wrong ones.
const isShallow = git('rev-parse', '--is-shallow-repository') !== 'false';
if (isShallow)
	console.warn(
		'build-pages: shallow clone — omitting <lastmod> from the sitemap.\n' +
			'            Set `fetch-depth: 0` on actions/checkout to get real per-page dates.',
	);

// LOCAL date, deliberately not toISOString().slice(0,10). `git log --format=%cs`
// renders a commit's date in the timezone that commit recorded, so a commit made
// at 21:14 in Denver is "2026-08-12" — while the UTC date is already the 13th.
// Mixing the two bases makes an uncommitted file look a day NEWER than a file
// committed minutes earlier, which is the one comparison this map exists to get
// right.
const buildDate = (() => {
	const d = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

/** YYYY-MM-DD the file last changed, or null if we cannot honestly say. */
const lastmodFor = (relPath) => {
	if (isShallow) return null;

	// `git status --porcelain` prints NOTHING for a clean file — the same falsy
	// value the helper returns when git itself failed. Those two cases must not
	// collapse: one means "provably unchanged since the last commit", the other
	// means "we know nothing". Compare against null explicitly.
	const status = git('status', '--porcelain', '--', relPath);
	if (status === null) return null;
	// Uncommitted edits mean the committed date is already stale — the version
	// about to ship is the one on disk right now, so today is the truthful answer.
	if (status !== '') return buildDate;

	const date = git('log', '-1', '--format=%cs', '--', relPath);
	return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : null;
};

// The inline-these-files map, derived from the ONE table in
// scripts/site-pages.mjs: export name in the generated server/pages.ts -> the
// file in public/ it is built from. Every page-shaped comment that used to live
// here lives there now, next to the URL it belongs to.
const pages = Object.fromEntries(SITE_PAGES.filter((p) => p.const).map((p) => [p.const, p.src]));

// --- build-time includes ---------------------------------------------------
//
//   <!-- @include public/partials/ww-runner.js -->
//
// Replaced by that file's contents, verbatim, wherever the comment appears.
//
// WHY: the two classroom student pages (/learn/web-development and
// /learn/code-builder) share one editor/preview component, ~700 lines of JS and
// CSS. The alternatives were both worse. Serving it as its own URL costs an
// extra request on a school network and a second endpoint to maintain, for a
// file that only ever loads with these two pages. Pasting it into both means
// hand-maintaining two copies of the thing every code example on the site runs
// through — and they WILL drift, silently, in whichever page gets edited less.
//
// Deliberately not a general template engine: one directive, no arguments, no
// nesting, no conditionals. If this ever needs a second feature, that is the
// signal to reach for a real build step instead of growing this one.
const INCLUDE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;

/**
 * Whether a given offset in the page sits inside a <script> or a <style> block.
 *
 * An include is pasted in verbatim, so what is legal in the included file
 * depends entirely on where the directive sits. Counting unclosed opening tags
 * before the offset is enough here: these are our own hand-written pages, not
 * arbitrary HTML, and every block is opened and closed on its own line.
 */
const contextAt = (html, index) => {
	const before = html.slice(0, index);
	for (const tag of ['script', 'style']) {
		const opens = (before.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
		const closes = (before.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
		if (opens > closes) return tag;
	}
	return 'html';
};

/**
 * Expand every @include in `html`.
 *
 * Throws on a missing file: a silently unexpanded include ships a page whose
 * interactive examples are all inert, which looks like a content bug and is
 * nearly impossible to spot in review.
 *
 * ESCAPES CLOSING TAGS, and this is not a theoretical nicety. public/partials/
 * ww-runner.js contains a long comment explaining the bug where a closing script
 * tag inside a string ends the enclosing block early — and that comment spelled
 * the sequence out literally. Inlined into the builder page's <script>, it ended
 * the block mid-file and the browser rendered the rest of the runner as visible
 * text on the page. Every automated check passed: the bytes were all present,
 * the includes had all expanded, and curl showed a 200 with the right length.
 * Only a human opening the page in a browser could see it.
 *
 * So the build fixes it rather than trusting anyone to remember:
 *   • into a <script> — escape the slash. Inside JavaScript that is the SAME
 *     string, so this can never change behavior, only prevent the break.
 *   • into a <style>  — throw instead. A backslash in CSS is an escape
 *     character, so "fixing" it could silently change a selector; and there is
 *     no legitimate reason for a closing style tag to appear in a stylesheet.
 */
const expandIncludes = (html, sourcePath) =>
	html.replace(INCLUDE, (match, rel, offset) => {
		const target = join(root, rel);
		if (!existsSync(target)) {
			throw new Error(`build-pages: ${sourcePath} includes "${rel}", which does not exist.`);
		}
		let body = readFileSync(target, 'utf8');
		if (INCLUDE.test(body)) {
			// Reset lastIndex — INCLUDE is /g and .test() advances it.
			INCLUDE.lastIndex = 0;
			throw new Error(`build-pages: ${rel} contains its own @include; nesting is not supported.`);
		}

		const context = contextAt(html, offset);
		if (context === 'script') {
			const before = body;
			body = body.replace(/<\/(script)/gi, '<\\/$1');
			if (body !== before) {
				const n = (before.match(/<\/script/gi) || []).length;
				console.warn(
					`build-pages: escaped ${n} closing script tag(s) while inlining ${rel} into ${sourcePath}.\n` +
						`            Harmless (same string in JS), but prefer not to write the literal sequence.`,
				);
			}
		} else if (context === 'style' && /<\/style/i.test(body)) {
			throw new Error(
				`build-pages: ${rel} contains a closing style tag and is being inlined into a <style> ` +
					`block in ${sourcePath}. That would end the block early. Remove it — this one cannot be ` +
					`escaped safely, because a backslash in CSS is an escape character.`,
			);
		}
		return body;
	});

// --- hreflang ---------------------------------------------------------------
//
// Injected at build time, immediately after each page's canonical link, from the
// groups in scripts/site-pages.mjs. NEVER hand-written into the HTML.
//
// The reason is the one rule hreflang has: the annotations must be reciprocal.
// Every version has to list itself AND every other version, on every page, or
// Google ignores the whole set — silently, with no error anywhere, which is
// exactly the bug you do not find by looking at the page. Generated from the
// table, the set is reciprocal by construction and a new translation cannot be
// half-wired.
//
// x-default points at the DEFAULT_LOCALE page: it is what a searcher whose
// language matches neither version gets, not a third copy of anything.
const HREFLANG_OPEN = '<!-- hreflang: generated by scripts/build-pages.mjs from scripts/site-pages.mjs -->';
const CANONICAL = /<link\s[^>]*rel="canonical"[^>]*>/i;
const HANDWRITTEN_HREFLANG = /<link\s[^>]*\bhreflang=/i;

const groupAlternates = alternatesByGroup();
const pageByConst = new Map(SITE_PAGES.filter((p) => p.const).map((p) => [p.const, p]));

const withHreflang = (html, page) => {
	const alts = groupAlternates.get(page.group);
	if (!alts) return html;

	if (HANDWRITTEN_HREFLANG.test(html))
		throw new Error(
			`build-pages: ${page.src} contains a hand-written hreflang <link>. ` +
				`Those are generated from scripts/site-pages.mjs — a second copy is the thing ` +
				`that goes stale and breaks the reciprocity the annotations depend on.`,
		);

	// A page in a translated group MUST point its canonical at itself. Pointing it
	// at the English original instead is the single most common way a translated
	// site is deindexed on day one: the canonical says "index that one, not me",
	// and Google obliges.
	const canonical = CANONICAL.exec(html);
	if (!canonical)
		throw new Error(`build-pages: ${page.src} has no <link rel="canonical">, so hreflang has nowhere to go.`);
	const self = `${SITE_ORIGIN}${page.path}`;
	if (!canonical[0].includes(`href="${self}"`))
		throw new Error(
			`build-pages: ${page.src} is the ${page.locale} version of "${page.group}" but its canonical is not ` +
				`${self}.\n            Found: ${canonical[0]}\n` +
				`            A translated page must canonicalise to itself, or it asks to be dropped from the index.`,
		);

	const links = alts.map((a) => `<link rel="alternate" hreflang="${a.locale}" href="${SITE_ORIGIN}${a.path}">`);
	const fallback = alts.find((a) => a.locale === DEFAULT_LOCALE);
	links.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${fallback.path}">`);

	return html.replace(CANONICAL, (m) => `${m}\n${HREFLANG_OPEN}\n${links.join('\n')}`);
};

let out =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	'// Source of truth: the files in public/. Regenerated by `npm run build:server`.\n\n';
const builtHtml = new Map();
for (const [name, path] of Object.entries(pages)) {
	const page = pageByConst.get(name);
	const html = withHreflang(expandIncludes(readFileSync(join(root, path), 'utf8'), path), page);
	builtHtml.set(page.key, html);
	out += `/** Inlined from ${path} — serves ${page.path} */\nexport const ${name}: string = ${JSON.stringify(html)};\n\n`;
}

// Every translated page must LINK to its siblings, in the page itself.
//
// hreflang tells a crawler the other version exists; it does nothing for a
// person, and Google asks that sites not bounce visitors between languages on a
// guess from Accept-Language. So the link has to be on the page — and since the
// only thing keeping it there is somebody remembering, the build checks.
for (const [group, alts] of groupAlternates) {
	for (const page of SITE_PAGES.filter((p) => p.group === group && p.const)) {
		const html = builtHtml.get(page.key);
		for (const other of alts.filter((a) => a.path !== page.path)) {
			if (html.includes(`href="${other.path}"`)) continue;
			throw new Error(
				`build-pages: ${page.src} never links to ${other.path} (its ${other.locale} version).\n` +
					`            Add a language link — a visitor who cannot read this page has no other way across.`,
			);
		}
	}
}

// Social/OpenGraph preview image for the landing page, inlined as base64 so the
// endpoints-only Harper can serve it at GET /og-image.jpg (crawlers need a real
// fetchable URL — a data URI won't do for og:image).
const ogImageB64 = readFileSync(join(root, 'public/og-image.jpg')).toString('base64');
out += `/** Base64 of public/og-image.jpg — served by the og-image endpoint. */\nexport const ogImageB64: string = ${JSON.stringify(ogImageB64)};\n\n`;

// Unique stamp for THIS build, baked into the bundle and served by the
// GET /Version/ endpoint. deploy.sh compares the served stamp against the
// staged bundle after deploying, so a node that silently kept the old
// component fails the deploy instead of quietly serving stale code.
const buildStamp = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version}+${new Date().toISOString()}`;
out += `/** Stamp for this build (app version + build time) — see GET /Version/. */\nexport const buildStamp: string = ${JSON.stringify(buildStamp)};\n`;

writeFileSync(join(root, 'server/pages.ts'), out);
console.log(`server/pages.ts generated from ${Object.values(pages).join(', ')} (build ${buildStamp})`);

// The landing page's theme-song player (GET /theme.mp3) needs the audio served by
// the endpoints-only Harper, so we inline it as base64. It lives in its OWN module
// (not pages.ts) and is dynamic-imported by the Theme endpoint — that keeps this
// ~2 MB out of the web/desktop bundle (Vite code-splits it; it's never loaded in
// the game), while the server's esbuild build inlines it into resources.js.
const themeMp3B64 = readFileSync(join(root, 'public/theme.mp3')).toString('base64');
const themeOut =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT. Base64 of public/theme.mp3.\n' +
	`export const themeMp3B64: string = ${JSON.stringify(themeMp3B64)};\n`;
writeFileSync(join(root, 'server/theme-audio.ts'), themeOut);
console.log(
	`server/theme-audio.ts generated from public/theme.mp3 (${(themeMp3B64.length / 1024).toFixed(0)} KB base64)`,
);

// The landing page's "For teachers" section links two classroom PDFs (educator
// guide + student worksheets), served by GET /educator-guide.pdf and
// /student-worksheets.pdf. Same reasoning as the theme audio: the endpoints-only
// Harper serves no static files, so the bytes ride along as base64 in their OWN
// module, dynamic-imported by those endpoints — out of the web/desktop bundle,
// inlined into resources.js by the server build.
// Matched by keyword against whatever is in public/pdfs/, NOT by exact filename.
// Replacing a PDF then has one step: drop the new file in and rebuild. Re-exports
// tend to come back named slightly differently (a hyphen where the em dash was, a
// version suffix, a stray "(1)"), and an exact-path read would just fail the build
// on a file that is perfectly fine.
const pdfDir = join(root, 'public/pdfs');
const pdfFiles = readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
const pickPdf = (keyword) => {
	const hits = pdfFiles.filter((f) => f.toLowerCase().includes(keyword));
	if (hits.length !== 1)
		throw new Error(
			`public/pdfs/: expected exactly one filename containing "${keyword}", found ${hits.length}` +
				` [${pdfFiles.join(', ') || 'the folder is empty'}]. ` +
				`Rename the PDF so "${keyword}" appears in its name, and remove any older copy.`,
		);
	return hits[0];
};
const pdfs = {
	educatorGuidePdfB64: pickPdf('educator'),
	studentWorksheetsPdfB64: pickPdf('worksheet'),
};
let pdfOut =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	'// Base64 of the classroom PDFs in public/pdfs/. Replace the PDFs and rebuild.\n';
for (const [name, file] of Object.entries(pdfs)) {
	const b64 = readFileSync(join(pdfDir, file)).toString('base64');
	pdfOut += `/** Inlined from public/pdfs/${file} */\nexport const ${name}: string = ${JSON.stringify(b64)};\n`;
	console.log(`server/pdf-assets.ts ← public/pdfs/${file} (${(b64.length / 1024).toFixed(0)} KB base64)`);
}
writeFileSync(join(root, 'server/pdf-assets.ts'), pdfOut);

// The screenshots for the landing and teachers pages. They used to be base64
// data URIs inside the HTML, which made the two pages 470 KB and 260 KB of
// render-blocking document — `loading="lazy"` buys nothing on a data URI,
// because the bytes have already arrived with the page, and the browser cannot
// cache an inlined image separately from the page that carries it. As real URLs
// they cost 66 KB of HTML plus nine independently cacheable images, and the four
// screenshots the two pages SHARE are fetched once for both.
//
// Filenames are content-hashed by scripts/extract-screenshots (see public/img/),
// so the endpoint can answer `immutable` with a one-year max-age: changing a
// screenshot changes its name, and a name that never changes never needs
// revalidating. Same base64-in-its-own-module trick as the PDFs above — out of
// the web/desktop bundle, inlined into resources.js by the server build.
const imgDir = join(root, 'public/img');
const imgFiles = readdirSync(imgDir)
	.filter((f) => f.toLowerCase().endsWith('.webp'))
	.sort();
if (!imgFiles.length) throw new Error('public/img/: no .webp screenshots found — the pages reference them by name.');
let imgOut =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	'// Base64 of the content-hashed screenshots in public/img/, keyed by filename.\n' +
	'export const screenshotsB64: Record<string, string> = {\n';
let imgBytes = 0;
for (const file of imgFiles) {
	const b64 = readFileSync(join(imgDir, file)).toString('base64');
	imgBytes += b64.length;
	imgOut += `\t${JSON.stringify(file)}: ${JSON.stringify(b64)},\n`;
}
imgOut += '};\n';
writeFileSync(join(root, 'server/img-assets.ts'), imgOut);
console.log(
	`server/img-assets.ts ← ${imgFiles.length} screenshots from public/img/ (${(imgBytes / 1024).toFixed(0)} KB base64)`,
);

// URL path -> the source file behind it, so /sitemap.xml can carry a per-page
// <lastmod>. Derived from the same table as everything else, so a page cannot be
// in the sitemap without a date source or carry a date for a URL the sitemap
// never emits. The PDFs' filenames are only known once pickPdf() has matched
// them, which is why this is built here and not in site-pages.mjs.
const sitemapSources = Object.fromEntries(
	SITE_PAGES.filter((p) => p.sitemap).map((p) => [p.path, p.pdf ? `public/pdfs/${pickPdf(p.pdf)}` : p.src]),
);
const pageLastmod = {};
for (const [urlPath, srcPath] of Object.entries(sitemapSources)) {
	const date = lastmodFor(srcPath);
	if (date) pageLastmod[urlPath] = date;
}
const lastmodOut =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	"// URL path -> YYYY-MM-DD that page's source last changed, for /sitemap.xml.\n" +
	'// A path is ABSENT when no honest date could be determined; the sitemap then\n' +
	'// omits <lastmod> for it rather than inventing one.\n' +
	`export const pageLastmod: Record<string, string> = ${JSON.stringify(pageLastmod, null, '\t')};\n`;
writeFileSync(join(root, 'server/page-lastmod.ts'), lastmodOut);
console.log(
	`server/page-lastmod.ts generated (${Object.keys(pageLastmod).length}/${Object.keys(sitemapSources).length} paths dated)`,
);

// --- server/site-pages.ts ----------------------------------------------------
//
// The same table again, in the shape the server needs it: what redirects, what
// is listed in the sitemap, and which paths are alternates of which. Generated
// rather than imported because scripts/site-pages.mjs is plain Node and
// server/endpoints-pages.ts is bundled by esbuild through the TypeScript build —
// generating it is what keeps ONE source of truth across that boundary, the same
// way server/pages.ts and server/page-lastmod.ts already work.
const serverPages = Object.fromEntries(
	SITE_PAGES.map((p) => [
		p.key,
		{ group: p.group, locale: p.locale, path: p.path, redirect: p.redirect, sitemap: p.sitemap },
	]),
);
const serverAlternates = Object.fromEntries(groupAlternates);
const sitePagesOut =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	'// Source of truth: scripts/site-pages.mjs. Regenerated by `npm run build:server`.\n\n' +
	'export type SitePage = {\n' +
	'\t/** Pages that are the same page in another language share a group. */\n' +
	'\tgroup: string;\n' +
	'\tlocale: string;\n' +
	'\tpath: string;\n' +
	'\t/** Requests on the origin hostname are 301d to the apex. */\n' +
	'\tredirect: boolean;\n' +
	'\tsitemap: boolean;\n' +
	'};\n\n' +
	`export const SITE_ORIGIN = ${JSON.stringify(SITE_ORIGIN)};\n` +
	`export const DEFAULT_LOCALE = ${JSON.stringify(DEFAULT_LOCALE)};\n\n` +
	'/** Every public URL, keyed by the page key the endpoints ask for. */\n' +
	`export const PUBLIC_PAGES: Record<string, SitePage> = ${JSON.stringify(serverPages, null, '\t')};\n\n` +
	'/**\n' +
	' * group -> the locales it exists in. Only groups with a translation appear.\n' +
	" * Feeds /sitemap.xml's xhtml:link alternates, which say the same thing the\n" +
	' * pages’ own hreflang links do, from the same table, so they cannot disagree.\n' +
	' */\n' +
	`export const PAGE_ALTERNATES: Record<string, { locale: string; path: string }[]> = ${JSON.stringify(
		serverAlternates,
		null,
		'\t',
	)};\n`;
writeFileSync(join(root, 'server/site-pages.ts'), sitePagesOut);
console.log(
	`server/site-pages.ts generated (${Object.keys(serverPages).length} URLs, ` +
		`${Object.keys(serverAlternates).length} translated${Object.keys(serverAlternates).length === 1 ? ' group' : ' groups'})`,
);

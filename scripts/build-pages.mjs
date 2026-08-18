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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const pages = {
	privacyHtml: 'public/privacy.html',
	ageRatingHtml: 'public/age-rating.html',
	supportHtml: 'public/support.html',
	dashboardHtml: 'public/dashboard.html',
	// Marketing landing page served at the site root (GET /). Self-contained:
	// screenshots are inlined as data URIs, so it ships as a single string like
	// the policy pages. Regenerate with scripts/build-landing.mjs when screenshots
	// or copy change.
	landingHtml: 'public/landing.html',
	// The teachers section, three pages under one resource. The science page is
	// the one that used to be /teachers: self-contained, screenshots inlined as
	// data URIs, and its <style> is the landing page's copied verbatim so the two
	// cannot drift. The hub and the coding guide are assembled from partials like
	// the /learn pages are.
	//
	// /teachers is a hub now: two kit cards and the material that belongs to
	// both. The science lesson it used to be moved to /teachers/science with its
	// title, description, keywords and LearningResource markup intact, because
	// two URLs claiming to be the same grades 5-8 activity is the one thing a
	// split like this must not do.
	teachersIndexHtml: 'public/teachers-index.html',
	teachersScienceHtml: 'public/teachers-science.html',
	teachersCodingHtml: 'public/teachers-coding.html',
	// The classroom Code Builder, served at /learn/code-builder. Unlike the pages
	// above this one is assembled from parts: its <style> and <script> blocks are
	// @include directives pulling in public/partials/ww-*.{css,js}, so the editor
	// component stays a single source shared with the lesson page.
	learnCodeBuilderHtml: 'public/learn-code-builder.html',
	// The public-API documentation at /developers/api. Same shell as the teacher
	// guides, and the only page on the site whose audience is not a player, a
	// student or a teacher.
	developersApiHtml: 'public/developers-api.html',
	// The nine-chapter student lesson, served at /learn/web-development. Assembled
	// the same way as the builder and sharing ww-runner.{css,js} with it, so every
	// one of its fifteen editable examples behaves exactly like the builder a
	// student opens straight afterwards.
	learnWebDevelopmentHtml: 'public/learn-web-development.html',
	// The classroom hub at /learn: the two doors and enough copy to choose
	// between them. Served by the same LearnPage resource under the empty slug,
	// which is what the getId() dispatch was shaped for.
	learnIndexHtml: 'public/learn-index.html',
};

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

let out =
	'// GENERATED by scripts/build-pages.mjs — DO NOT EDIT.\n' +
	'// Source of truth: the files in public/. Regenerated by `npm run build:server`.\n\n';
for (const [name, path] of Object.entries(pages)) {
	const html = expandIncludes(readFileSync(join(root, path), 'utf8'), path);
	out += `/** Inlined from ${path} */\nexport const ${name}: string = ${JSON.stringify(html)};\n\n`;
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
// <lastmod>. Keyed by PATH rather than by page name because that is what the
// sitemap emits, which keeps the lookup in resources.ts a plain index.
const sitemapSources = {
	'/': 'public/landing.html',
	'/privacy.html': 'public/privacy.html',
	'/age-rating.html': 'public/age-rating.html',
	'/support.html': 'public/support.html',
	'/teachers': 'public/teachers-index.html',
	'/teachers/science': 'public/teachers-science.html',
	'/teachers/coding': 'public/teachers-coding.html',
	// The lesson is in the sitemap (see PUBLIC_PAGES in server/resources.ts); the
	// Code Builder is not, so it is deliberately absent here too. A lastmod for a
	// URL the sitemap never emits would be dead weight in the generated file.
	'/learn': 'public/learn-index.html',
	'/learn/web-development': 'public/learn-web-development.html',
	'/developers/api': 'public/developers-api.html',
	'/educator-guide.pdf': `public/pdfs/${pdfs.educatorGuidePdfB64}`,
	'/student-worksheets.pdf': `public/pdfs/${pdfs.studentWorksheetsPdfB64}`,
};
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

#!/usr/bin/env node
// `npm run landing` — look at the website in a browser, without Harper.
//
// The hosted site serves no static files: every page is a string compiled into
// resources.js by build-pages.mjs and returned by an endpoint. That is great in
// production and miserable for "does this look right?", which used to mean a
// full `npm run build:server` plus a running Harper just to check a margin.
//
// This serves the SAME public/*.html files at the SAME URL paths, straight from
// disk, with the @include directives expanded exactly as the build expands them.
// Nothing is cached: edit a file, hit refresh, see it. No build, no Harper, no
// dependencies.
//
// What it is NOT: it does not run the game, it has no database, and API calls
// still go to the real hosted https://wildwillows.app. That is deliberate — the
// classroom pages fetch /GameData/ over CORS, so they work here exactly as they
// will for a student who opens their downloaded file at home.
//
//   npm run landing            → http://localhost:4321
//   npm run landing -- 8080    → a different port
//   npm run landing -- --no-open

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a))) || 4321;
const shouldOpen = !args.includes('--no-open');

/* URL path -> the file in public/ that serves it.
 *
 * Kept in step with PUBLIC_PAGES in server/resources.ts by hand, and that is
 * fine: this is a preview tool, and a page missing here is a 404 with a list of
 * every route it does know, not a silent wrong answer. */
const PAGES = {
	'/': 'public/landing.html',
	'/privacy.html': 'public/privacy.html',
	'/age-rating.html': 'public/age-rating.html',
	'/support.html': 'public/support.html',
	'/teachers': 'public/teachers-index.html',
	'/teachers/science': 'public/teachers-science.html',
	'/teachers/coding': 'public/teachers-coding.html',
	'/dashboard': 'public/dashboard.html',
	'/learn': 'public/learn-index.html',
	'/learn/code-builder': 'public/learn-code-builder.html',
	'/learn/web-development': 'public/learn-web-development.html',
};

/* Same directive and same rules as scripts/build-pages.mjs. Duplicated on
 * purpose rather than exported from there: build-pages does a lot of other work
 * at import time (base64-ing 3 MB of audio and PDFs), and paying that on every
 * page refresh would make this tool slower than the build it replaces. */
const INCLUDE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;

function expandIncludes(html, sourcePath) {
	return html.replace(INCLUDE, (_m, rel) => {
		const target = join(root, rel);
		if (!existsSync(target)) throw new Error(`${sourcePath} includes "${rel}", which does not exist`);
		return readFileSync(target, 'utf8');
	});
}

/* ---------------------------------------------------------- local /GameData/
 *
 * The classroom pages fetch https://wildwillows.app/GameData/ — an absolute URL,
 * deliberately, because students read it, copy it, and take it home in their
 * downloaded file. Locally that means the preview hits PRODUCTION, and until the
 * CORS header ships there, the sandboxed iframe gets "Load failed" and the whole
 * builder is untestable. Which is exactly what happened.
 *
 * So the preview serves its own /GameData/ from the seed files in data/, and
 * rewrites that one absolute URL in the HTML it hands over. Both halves live
 * HERE, in the dev tool — nothing dev-only ships in public/partials, and the
 * pages Harper serves are untouched.
 *
 * It is a stand-in, not the endpoint: the real one adds computed fields and
 * compresses. It carries the fields the lesson actually reads, which is what the
 * builder needs to be exercised.
 */
const seedRecords = (file) => JSON.parse(readFileSync(join(root, 'data', file), 'utf8')).records;

let gameData = null;
const localGameData = () => {
	if (gameData) return gameData;
	gameData = JSON.stringify({
		biomes: seedRecords('biomes.json'),
		animals: [...seedRecords('animals-1.json'), ...seedRecords('animals-2.json')],
		resources: seedRecords('resources.json'),
		recipes: seedRecords('recipes.json'),
		habitatObjects: seedRecords('habitat-objects.json'),
		tools: seedRecords('tools.json'),
		achievements: seedRecords('achievements.json'),
	});
	return gameData;
};

/** The production URL the pages ship with, and what it becomes locally. */
const API_ABSOLUTE = 'https://wildwillows.app/GameData/';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.pdf': 'application/pdf',
	'.json': 'application/json; charset=utf-8',
};

/** public/ files the pages link to directly: /img/*.webp, /og-image.jpg, /theme.mp3. */
function staticFile(pathname) {
	// normalize + prefix check: this binds to localhost, but a preview server is
	// exactly the kind of thing that gets casually exposed on a hotel wifi, and
	// `/../../.ssh/id_rsa` is not a fun way to find that out.
	const candidate = normalize(join(root, 'public', pathname));
	if (!candidate.startsWith(join(root, 'public'))) return null;
	if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
	return candidate;
}

const server = createServer((req, res) => {
	const url = new URL(req.url, `http://localhost:${port}`);
	const pathname = url.pathname.replace(/\/+$/, '') || '/';

	/* The pages send an anonymous counter beacon here at the end of a session.
	 * The endpoint does not exist yet (it is the next phase), and a 404 in the
	 * dev-tools console while you are debugging something else is pure noise —
	 * worse, it looks like a symptom of whatever you are actually chasing. */
	if (pathname === '/LessonEvent') {
		res.writeHead(204, { 'access-control-allow-origin': '*' });
		res.end();
		return;
	}

	if (pathname === '/GameData') {
		res.writeHead(200, {
			'content-type': MIME['.json'],
			'cache-control': 'no-store',
			// The preview iframe is sandbox="allow-scripts" with no allow-same-origin,
			// so it has an opaque origin and this read is cross-origin even from
			// localhost. Same header the real endpoint now sends.
			'access-control-allow-origin': '*',
		});
		res.end(localGameData());
		return;
	}

	const pageFile = PAGES[pathname] || PAGES[pathname + '.html'];
	if (pageFile) {
		try {
			const html = expandIncludes(readFileSync(join(root, pageFile), 'utf8'), pageFile)
				.split(API_ABSOLUTE)
				.join('/GameData/');
			res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
			res.end(html);
		} catch (err) {
			// Show the failure in the browser rather than only in the terminal — the
			// whole point of this tool is that the browser is where you are looking.
			res.writeHead(500, { 'content-type': MIME['.html'] });
			res.end(`<pre style="padding:2rem;font:14px ui-monospace,monospace;color:#b5707a">${err.message}</pre>`);
			console.error(`  ✗ ${pathname} — ${err.message}`);
		}
		return;
	}

	const file = staticFile(pathname);
	if (file) {
		res.writeHead(200, {
			'content-type': MIME[extname(file)] || 'application/octet-stream',
			'cache-control': 'no-store',
		});
		res.end(readFileSync(file));
		return;
	}

	res.writeHead(404, { 'content-type': MIME['.html'] });
	res.end(
		`<body style="font:16px system-ui;padding:2rem;background:#f4eeda;color:#3b4232">` +
			`<h1 style="color:#39604a">Not served here</h1>` +
			`<p><code>${pathname}</code> is not one of the pages this preview knows about.</p><ul>` +
			Object.keys(PAGES)
				.map((p) => `<li><a href="${p}" style="color:#39604a">${p}</a></li>`)
				.join('') +
			`</ul><p style="color:#75765f">API calls still go to the real https://wildwillows.app.</p></body>`,
	);
});

server.listen(port, '127.0.0.1', () => {
	const url = `http://localhost:${port}`;
	console.log(`\n  Wild Willows — local page preview\n`);
	for (const p of Object.keys(PAGES)) console.log(`    ${url}${p === '/' ? '' : p}`);
	console.log(`\n  Files are read fresh on every request — edit public/, then just refresh.`);
	console.log(`  /GameData/ is served locally from data/*.json, and ${API_ABSOLUTE}`);
	console.log(`  is rewritten to it — so the code builder works before the CORS header deploys.`);
	console.log(`  Ctrl+C to stop.\n`);
	if (shouldOpen) {
		const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
		spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
	}
});

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`\n  Port ${port} is busy. Try: npm run landing -- ${port + 1}\n`);
		process.exit(1);
	}
	throw err;
});

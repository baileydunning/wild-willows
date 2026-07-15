#!/usr/bin/env node
// scripts/check-i18n.mjs — CI lint for i18n key hygiene. Zero dependencies.
//
//   node scripts/check-i18n.mjs
//
// 1. Scans src/ and server/ for string-literal keys passed to t('…'),
//    tList('…') and hasKey('…'). Dynamic keys (template literals with ${…},
//    variables) are skipped but counted.
// 2. Loads + flattens every src/i18n/en/*.json catalog with the same
//    semantics as core.ts: nested objects become dot-keys, arrays (line
//    pools) and {one,other} plural pairs stay whole. Each file is prefixed
//    with its basename (app.json -> app.*), mirroring how index.ts registers
//    them — unless the file already wraps itself in that key (content.json).
// 3. Reports:
//    - MISSING: referenced keys absent from en (excluding content.*, which
//      fall back to data/*.json by design). Exit 1 if any.
//    - UNUSED: en keys never referenced (excluding _readme docs and
//      content.*). Warning only — keys may be built dynamically.
//    - Per-locale coverage: keys every other src/i18n/<locale>/ is missing
//      relative to en. Warning only.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = join(ROOT, 'src', 'i18n');
const NON_LOCALE_DIRS = new Set(['en', 'templates']); // dirs under src/i18n that aren't locales

// ---------------------------------------------------------------------------
// 1. Collect referenced keys from source.
// ---------------------------------------------------------------------------

function* walk(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (/\.tsx?$/.test(e.name)) yield p;
	}
}

// A call to t/tList/hasKey not preceded by an identifier char, so split(…),
// at(…), addEventListener(…) etc. never match; obj.t(…) does.
const CALL_RE = /(?<![\w$])(?:t|tList|hasKey)\(\s*/g;
const LITERAL_RE = /^(['"])((?:\\.|(?!\1)[^\\\n])+)\1/; // '…' or "…", escapes ok

const refs = new Map(); // key -> Set<"file:line">
let dynamicSkipped = 0;
let filesScanned = 0;

for (const top of ['src', 'server']) {
	for (const file of walk(join(ROOT, top))) {
		filesScanned++;
		const text = readFileSync(file, 'utf8');
		for (const m of text.matchAll(CALL_RE)) {
			const rest = text.slice(m.index + m[0].length);
			let key;
			const lit = rest.match(LITERAL_RE);
			if (lit) {
				key = lit[2];
			} else if (rest.startsWith('`')) {
				const tpl = rest.match(/^`([^`]*)`/);
				if (tpl && !tpl[1].includes('${'))
					key = tpl[1]; // constant template
				else {
					dynamicSkipped++;
					continue;
				}
			} else if (/^[A-Za-z_$[(]/.test(rest)) {
				dynamicSkipped++; // variable / expression key
				continue;
			} else {
				continue; // not a key call (regex arg, number, declaration, …)
			}
			const line = text.slice(0, m.index).split('\n').length;
			if (!refs.has(key)) refs.set(key, new Set());
			refs.get(key).add(`${relative(ROOT, file)}:${line}`);
		}
	}
}

// ---------------------------------------------------------------------------
// 2. Load + flatten catalogs (same semantics as core.ts flatten()).
// ---------------------------------------------------------------------------

function flatten(src, prefix, out) {
	for (const [k, v] of Object.entries(src)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (typeof v === 'string' || Array.isArray(v)) {
			out[key] = v;
		} else if (v && typeof v === 'object') {
			if (typeof v.one === 'string' && typeof v.other === 'string') out[key] = v;
			else flatten(v, key, out);
		}
	}
	return out;
}

const parseErrors = []; // "file: message" — malformed catalog JSON fails the run

/** Flatten every *.json in a locale dir into one key set. */
function loadLocale(dir) {
	const flat = {};
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.sort();
	for (const f of files) {
		let json;
		try {
			json = JSON.parse(readFileSync(join(dir, f), 'utf8'));
		} catch (err) {
			parseErrors.push(`${relative(ROOT, join(dir, f))}: ${err.message}`);
			continue;
		}
		const name = basename(f, '.json');
		// index.ts registers catalogs namespaced by filename (app.json -> app.*);
		// a file whose only real top-level key IS its own name (content.json's
		// { "content": … } template shape) is registered unwrapped.
		const realKeys = Object.keys(json).filter((k) => !k.startsWith('_'));
		const wrapSelf = realKeys.length === 1 && realKeys[0] === name;
		flatten(json, wrapSelf ? '' : name, flat);
	}
	return { flat, files };
}

const en = loadLocale(join(I18N_DIR, 'en'));
const enKeys = new Set(Object.keys(en.flat));

// ---------------------------------------------------------------------------
// 3. Reports.
// ---------------------------------------------------------------------------

const isReadme = (k) => k === '_readme' || k.endsWith('._readme');
const isContent = (k) => k.startsWith('content.');

const missing = [...refs.keys()].filter((k) => !isContent(k) && !enKeys.has(k)).sort();
const unused = [...enKeys].filter((k) => !isReadme(k) && !isContent(k) && !refs.has(k)).sort();

console.log('check-i18n');
console.log(
	`  scanned ${filesScanned} files under src/ + server/ — ` +
		`${refs.size} unique literal keys via t()/tList()/hasKey(), ${dynamicSkipped} dynamic keys skipped`,
);
console.log(`  en catalogs: ${en.files.length} files (${en.files.join(', ')}), ${enKeys.size} flat keys`);

if (missing.length) {
	console.log(`\nMISSING — referenced but not in en catalogs (${missing.length}):`);
	for (const k of missing) {
		const where = [...refs.get(k)];
		const shown = where.slice(0, 2).join(', ') + (where.length > 2 ? ` (+${where.length - 2} more)` : '');
		console.log(`  ${k}  [${shown}]`);
	}
} else {
	console.log('\nMISSING: none — every referenced key resolves in en.');
}

if (unused.length) {
	console.log(`\nUNUSED (warning) — en keys never referenced by a literal (${unused.length}):`);
	for (const k of unused) console.log(`  ${k}`);
} else {
	console.log('\nUNUSED: none.');
}

const localeDirs = readdirSync(I18N_DIR, { withFileTypes: true })
	.filter((e) => e.isDirectory() && !NON_LOCALE_DIRS.has(e.name))
	.map((e) => e.name)
	.sort();

for (const locale of localeDirs) {
	const { flat } = loadLocale(join(I18N_DIR, locale));
	const localeKeys = new Set(Object.keys(flat));
	const gaps = [...enKeys].filter((k) => !isReadme(k) && !localeKeys.has(k)).sort();
	if (gaps.length) {
		console.log(`\nLOCALE ${locale} (warning) — ${gaps.length} en keys untranslated:`);
		for (const k of gaps.slice(0, 20)) console.log(`  ${k}`);
		if (gaps.length > 20) console.log(`  … +${gaps.length - 20} more`);
	} else {
		console.log(`\nLOCALE ${locale}: complete relative to en.`);
	}
}
if (!localeDirs.length) console.log('\nNo non-en locales yet.');

if (parseErrors.length) {
	console.log(`\nPARSE ERRORS — catalog files that are not valid JSON (${parseErrors.length}):`);
	for (const e of parseErrors) console.log(`  ${e}`);
}

if (missing.length || parseErrors.length) {
	console.log(`\nFAIL: ${missing.length} missing key(s), ${parseErrors.length} unparsable catalog file(s).`);
	process.exit(1);
}
console.log('\nOK.');

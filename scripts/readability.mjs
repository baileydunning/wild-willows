#!/usr/bin/env node
// scripts/readability.mjs — reading-level report for the player-facing text.
// Zero dependencies, same as check-i18n.mjs.
//
//   node scripts/readability.mjs              human-readable report
//   node scripts/readability.mjs --markdown   the PR-comment body
//   node scripts/readability.mjs --json       machine-readable
//   node scripts/readability.mjs --fail-drift exit 1 if simple stops being simpler
//
// WHY THIS EXISTS
// src/i18n/<locale>/simple.json says of itself: "Plain-language overlay for the
// 'simpler wording' accessibility option (~5th-grade reading level)". That is a
// promise about prose, and prose rots quietly — a rewritten sentence lands in the
// normal catalog, someone copies it into the overlay with two words changed, and
// the plain-language option slowly stops being plainer. No test notices, because
// every string still resolves and still renders.
//
// So this measures the two corpora and compares them PAIRWISE: only keys that
// exist in both the normal catalog and the overlay, so it is the same sentence
// judged twice, not "all the UI" against "the subset someone simplified".
//
// THE NUMBERS
// English uses Flesch Reading Ease (higher = easier) and Flesch–Kincaid Grade
// Level (US school grade). Spanish uses Fernández Huerta, the Spanish adaptation
// of Flesch — running English Flesch constants over Spanish is a well-known
// mistake, because Spanish words carry more syllables for the same difficulty and
// the score comes out looking artificially hard.
//
// Both are crude: they count syllables and sentence length, and know nothing
// about whether a word is common. Treat a single number as noise and the
// normal → simple DELTA as the signal — that comparison holds the vocabulary and
// subject matter fixed, which is exactly where these formulas are least wrong.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = join(ROOT, 'src', 'i18n');

const MARKDOWN = process.argv.includes('--markdown');
const JSON_OUT = process.argv.includes('--json');
const FAIL_DRIFT = process.argv.includes('--fail-drift');

/** The reading level simple.json promises, in US grades. */
const SIMPLE_TARGET_GRADE = 5;
/** Sentences shorter than this are labels ("Crafting", "Field Journal"), not
 *  prose. Scoring them says more about UI chrome than about how hard the game is
 *  to read, and there are enough of them to swamp everything else. */
const MIN_WORDS = 5;

// ---------------------------------------------------------------------------
// Catalog loading — same flattening semantics as core.ts / check-i18n.mjs,
// except that line pools are kept as separate strings: each line is read on its
// own, so each should be scored on its own.
// ---------------------------------------------------------------------------

function flatten(value, prefix, out) {
	if (typeof value === 'string') {
		out.set(prefix, value);
	} else if (Array.isArray(value)) {
		value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
	} else if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
	}
	return out;
}

/** { normal: Map<key,string>, simple: Map<key,string> } for one locale dir. */
function loadLocale(dir) {
	const normal = new Map();
	const simple = new Map();
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
		const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
		const name = basename(file, '.json');
		const realKeys = Object.keys(json).filter((k) => !k.startsWith('_'));
		const wrapSelf = realKeys.length === 1 && realKeys[0] === name;
		const target = name === 'simple' ? simple : normal;
		// simple.json is already written in full key paths (panels.*, content.*),
		// so it is never prefixed with its own filename.
		flatten(json, name === 'simple' || wrapSelf ? '' : name, target);
	}
	for (const map of [normal, simple]) for (const k of [...map.keys()]) if (/(^|\.)_readme/.test(k)) map.delete(k);
	return { normal, simple };
}

// ---------------------------------------------------------------------------
// Counting.
// ---------------------------------------------------------------------------

/** Strip what a player never reads as words: {placeholders}, markup, ellipses. */
const clean = (s) =>
	s
		.replace(/\{[^}]*\}/g, ' ') // interpolation tokens
		.replace(/<[^>]*>/g, ' ') // any stray markup
		.replace(/[·•—–]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const words = (s) =>
	clean(s)
		.split(/[^\p{L}\p{N}'’-]+/u)
		.filter(Boolean);

/** Sentences, floored at 1: a UI string often has no terminal punctuation and is
 *  still exactly one sentence's worth of reading. */
const sentences = (s) => Math.max(1, (clean(s).match(/[.!?…]+(\s|$)/g) || []).length);

/** English syllables: vowel groups, minus a silent trailing 'e', plus the usual
 *  '-le' correction. Wrong on the occasional word, close enough in aggregate. */
function syllablesEn(word) {
	const w = word.toLowerCase().replace(/[^a-z]/g, '');
	if (!w) return 0;
	if (w.length <= 3) return 1;
	const groups = w.replace(/e$/, '').match(/[aeiouy]+/g) || [];
	let n = groups.length;
	if (/[^aeiouy]le$/.test(w)) n++; // "table", "little"
	return Math.max(1, n);
}

/** Spanish syllables: vowel groups, then split the hiatuses (two strong vowels
 *  are two syllables) — Spanish spelling is regular enough that this is close to
 *  exact, unlike the English heuristic. */
function syllablesEs(word) {
	const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
	if (!w) return 0;
	const groups = w.match(/[aeiouáéíóúü]+/g) || [];
	let n = 0;
	for (const g of groups) {
		n += 1;
		// within a vowel run, each extra STRONG vowel (a/e/o, or an accented weak
		// one) opens another syllable; weak unaccented vowels glide instead.
		for (let i = 1; i < g.length; i++) {
			const prev = g[i - 1];
			const cur = g[i];
			const strong = (c) => 'aeoáéíóú'.includes(c);
			if (strong(prev) && strong(cur)) n += 1;
		}
	}
	return Math.max(1, n);
}

/** Score one bag of strings. Returns null when nothing was long enough to score. */
function score(strings, locale) {
	const syll = locale === 'es' ? syllablesEs : syllablesEn;
	let w = 0;
	let s = 0;
	let y = 0;
	let scored = 0;
	let skipped = 0;
	for (const str of strings) {
		const ws = words(str);
		if (ws.length < MIN_WORDS) {
			skipped++;
			continue;
		}
		scored++;
		w += ws.length;
		s += sentences(str);
		for (const word of ws) y += syll(word);
	}
	if (!scored) return null;
	const wps = w / s; // words per sentence
	const spw = y / w; // syllables per word
	const ease =
		locale === 'es'
			? 206.84 - 60 * spw - 1.02 * wps // Fernández Huerta
			: 206.835 - 1.015 * wps - 84.6 * spw; // Flesch Reading Ease
	// Flesch–Kincaid maps onto US school grades and its constants are fitted to
	// English. Spanish carries more syllables per word at the same difficulty, so
	// the formula returns a grade in the teens for text a child reads fine —
	// a number worse than none. Spanish gets the Huerta ease score only.
	const grade = locale === 'en' ? +(0.39 * wps + 11.8 * spw - 15.59).toFixed(1) : null;
	return {
		scored,
		skipped,
		words: w,
		wordsPerSentence: +wps.toFixed(2),
		syllablesPerWord: +spw.toFixed(2),
		ease: +ease.toFixed(1),
		grade,
	};
}

/** Plain-English band for a Flesch-family ease score. */
function band(ease) {
	if (ease >= 90) return 'very easy';
	if (ease >= 80) return 'easy';
	if (ease >= 70) return 'fairly easy';
	if (ease >= 60) return 'plain';
	if (ease >= 50) return 'fairly hard';
	if (ease >= 30) return 'hard';
	return 'very hard';
}

// ---------------------------------------------------------------------------
// English `content.*` originals.
//
// The overlay rewrites animal diets, habitat blurbs, achievement flavor and so
// on under content.<type>.<id>.<field>. In Spanish the originals sit in
// es/content.json, so pairing is easy. In English there IS no en/content.json —
// content() falls back to the definition text in data/*.json by design — so
// without this the English comparison silently drops ~1,000 of the longest,
// most prose-like strings in the game and reports on UI copy alone.
// ---------------------------------------------------------------------------

const DATA_SOURCES = {
	animal: ['data/animals-1.json', 'data/animals-2.json'],
	habitatObject: ['data/habitat-objects.json'],
	achievement: ['data/achievements.json'],
	biome: ['data/biomes.json'],
	tool: ['data/tools.json'],
};

const DATA_BY_TYPE = {};
for (const [type, files] of Object.entries(DATA_SOURCES)) {
	const byId = new Map();
	for (const f of files) {
		for (const rec of JSON.parse(readFileSync(join(ROOT, f), 'utf8')).records) byId.set(rec.id, rec);
	}
	DATA_BY_TYPE[type] = byId;
}

/** Resolve `content.animal.gray-fox.diet` against data/*.json, or undefined. */
function contentOriginal(key) {
	const m = /^content\.([^.]+)\.(.+)$/.exec(key);
	if (!m) return undefined;
	const byId = DATA_BY_TYPE[m[1]];
	if (!byId) return undefined;
	// ids contain hyphens but never dots, so the id is the first segment and the
	// rest is a (possibly nested, e.g. `tiers.2.name`) field path.
	const [id, ...fieldPath] = m[2].split('.');
	let node = byId.get(id);
	for (const step of fieldPath) node = node?.[step];
	return typeof node === 'string' ? node : undefined;
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

const locales = readdirSync(I18N_DIR, { withFileTypes: true })
	.filter((e) => e.isDirectory() && e.name !== 'templates')
	.map((e) => e.name)
	.sort();

const report = { target: SIMPLE_TARGET_GRADE, minWords: MIN_WORDS, locales: {} };

for (const locale of locales) {
	const { normal, simple } = loadLocale(join(I18N_DIR, locale));

	// The honest comparison: only keys the overlay actually rewrote, so both
	// columns are the same sentences said two ways. The original is whichever the
	// game would have shown — the locale catalog, or (English content.*) the
	// definition text in data/*.json.
	const pairs = [];
	for (const [key, text] of simple) {
		const original = normal.get(key) ?? contentOriginal(key);
		if (original) pairs.push({ key, original, simple: text });
	}
	const paired = pairs.map((p) => p.key);
	const before = pairs.map((p) => p.original);
	const after = pairs.map((p) => p.simple);

	// Which lines to actually look at.
	//
	// NOT the hardest ones: those are all animal diets — "Scorpions, centipedes,
	// beetles, and other mice" — where every hard word is a species name and there
	// is nothing to simplify. Ranking by absolute difficulty just lists the
	// wildlife back at you.
	//
	// So: the lines the overlay barely changed. A near-zero delta means someone
	// copied the original across and tweaked a word, which is the actual failure
	// mode this report exists to surface.
	const leastImproved = pairs
		.map((p) => ({ key: p.key, text: p.simple, a: score([p.original], locale), b: score([p.simple], locale) }))
		.filter((r) => r.a && r.b)
		.map((r) => ({ key: r.key, delta: +(r.b.ease - r.a.ease).toFixed(1), ease: r.b.ease, text: r.text }))
		.sort((a, b) => a.delta - b.delta)
		.slice(0, 5)
		.map((r) => ({ ...r, text: r.text.slice(0, 90) }));

	report.locales[locale] = {
		all: score([...normal.values()], locale),
		overlaySize: simple.size,
		pairedKeys: paired.length,
		before: score(before, locale),
		after: score(after, locale),
		leastImproved,
	};
}

/** Did the overlay make its paired lines easier, in every locale? */
const drift = [];
for (const [locale, r] of Object.entries(report.locales)) {
	if (!r.before || !r.after) continue;
	if (r.after.ease <= r.before.ease) drift.push(`${locale}: overlay is not easier than the normal text`);
	if (locale === 'en' && r.after.grade > SIMPLE_TARGET_GRADE + 1) {
		drift.push(`en: overlay reads at grade ${r.after.grade}, above the ~${SIMPLE_TARGET_GRADE} it promises`);
	}
}
report.drift = drift;

if (JSON_OUT) {
	console.log(JSON.stringify(report, null, 2));
} else if (MARKDOWN) {
	const L = [];
	L.push('### Readability');
	L.push('');
	L.push('How hard the game reads, per language, and whether "simpler wording" is actually simpler.');
	L.push('');
	L.push('| Language | Whole catalog | Normal (paired) | Simpler wording | Change |');
	L.push('| --- | --- | --- | --- | --- |');
	for (const [locale, r] of Object.entries(report.locales)) {
		if (!r.before || !r.after) continue;
		const d = +(r.after.ease - r.before.ease).toFixed(1);
		const arrow = d > 0 ? `+${d} easier` : `${d} harder`;
		L.push(
			`| \`${locale}\` | ${r.all.ease} (${band(r.all.ease)}) | ${r.before.ease} | ${r.after.ease} (${band(r.after.ease)}) | ${d > 0 ? '✅' : '⚠️'} ${arrow} |`,
		);
	}
	L.push('');
	const en = report.locales.en;
	if (en?.after) {
		const ok = en.after.grade <= SIMPLE_TARGET_GRADE + 1;
		L.push(
			`${ok ? '✅' : '⚠️'} English "simpler wording" reads at **grade ${en.after.grade}** ` +
				`(target ~${SIMPLE_TARGET_GRADE}, per \`simple.json\`'s own note). ` +
				`The normal wording of the same ${en.pairedKeys} strings reads at grade ${en.before.grade}.`,
		);
		L.push('');
	}
	if (drift.length) {
		L.push('**Worth a look:**');
		for (const d of drift) L.push(`- ${d}`);
		L.push('');
	}
	for (const [locale, r] of Object.entries(report.locales)) {
		if (!r.leastImproved?.length) continue;
		L.push(`<details><summary>Lines the <code>${locale}</code> overlay barely simplified</summary>`);
		L.push('');
		for (const w of r.leastImproved) {
			const d = w.delta >= 0 ? `+${w.delta}` : `${w.delta}`;
			L.push(`- **${d} ease** \`${w.key}\` — ${w.text}`);
		}
		L.push('');
		L.push('</details>');
		L.push('');
	}
	L.push(
		`<sub>English: Flesch Reading Ease + Flesch–Kincaid. Spanish: Fernández Huerta (Flesch's constants ` +
			`misjudge Spanish). Strings under ${MIN_WORDS} words are labels, not prose, and are skipped. ` +
			`Syllables are counted by heuristic, which over-counts silent vowels ("caretaker" as four), so ` +
			`absolute scores run slightly harsh — the grade check is conservative in the safe direction. ` +
			`Compare the change column, not the absolute numbers across languages.</sub>`,
	);
	console.log(L.join('\n'));
} else {
	console.log('readability\n');
	for (const [locale, r] of Object.entries(report.locales)) {
		const g = (s) => (s.grade === null ? '' : `  grade ${s.grade}`);
		console.log(`  ${locale}`);
		if (r.all) {
			console.log(
				`    whole catalog   ease ${r.all.ease} (${band(r.all.ease)})${g(r.all)}` +
					`  · ${r.all.scored} strings scored, ${r.all.skipped} labels skipped`,
			);
		}
		if (r.before && r.after) {
			console.log(`    normal (paired) ease ${r.before.ease}${g(r.before)}  · ${r.pairedKeys} keys`);
			console.log(`    simpler wording ease ${r.after.ease} (${band(r.after.ease)})${g(r.after)}`);
			console.log(`    change          ${(r.after.ease - r.before.ease).toFixed(1)} ease`);
		}
		console.log('');
	}
	if (drift.length) {
		console.log('DRIFT:');
		for (const d of drift) console.log(`  ${d}`);
	} else {
		console.log('No drift: every overlay reads easier than the text it replaces.');
	}
}

if (FAIL_DRIFT && drift.length) process.exit(1);

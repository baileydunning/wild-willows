// Reading-level report for every player-facing string.
//
//   node scripts/readability.mjs              # summary + what's still hard
//   node scripts/readability.mjs --list       # every string still above target
//   node scripts/readability.mjs --json       # machine-readable, for tooling
//   node scripts/readability.mjs --locale es
//
// Backs the "Simpler wording" accessibility option (prefs.simpleText). That
// option layers src/i18n/<locale>/simple.json over the normal catalogs, so this
// script scores BOTH: the normal text, and what a player actually reads with the
// option on. The gap between them is the remaining work.
//
// Flesch–Kincaid grade is the yardstick. It's a crude instrument — it counts
// syllables and sentence length, and knows nothing about whether a word is
// familiar — so treat it as a way to RANK and to catch regressions, not as
// proof a sentence is readable. Short labels are skipped for that reason: "Food
// web" is not 12th-grade English just because it lacks a full stop.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_GRADE = 5;
/** Below this many words, grade scores are noise (labels, buttons, tags). */
const MIN_WORDS = 8;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const listAll = args.includes('--list');
// indexOf returns -1 when the flag is absent, and args[0] would then be picked
// up as the locale (`--json` became a locale name). Guard the lookup.
const localeAt = args.indexOf('--locale');
const locale = (localeAt >= 0 ? args[localeAt + 1] : null) || 'en';

// ---------------------------------------------------------------- scoring

function syllables(word) {
	const w = word.toLowerCase().replace(/[^a-z]/g, '');
	if (!w) return 0;
	if (w.length <= 3) return 1;
	const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
	return (trimmed.match(/[aeiouy]{1,2}/g) || []).length || 1;
}

/** Flesch–Kincaid grade, or null when the text is too short to mean anything. */
export function gradeLevel(text) {
	const clean = String(text)
		.replace(/\{[^}]*\}/g, 'thing') // placeholders stand in as one plain word
		.replace(/<[^>]*>/g, ' ')
		.replace(/[·•—–]/g, ' ');
	const words = clean.split(/\s+/).filter((w) => /[a-z]/i.test(w));
	if (words.length < MIN_WORDS) return null;
	const sentences = (clean.match(/[.!?…]+/g) || []).length || 1;
	const syl = words.reduce((s, w) => s + syllables(w), 0);
	return 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
}

// ---------------------------------------------------------------- gathering

const strings = [];
const walk = (node, path, src) => {
	if (typeof node === 'string') {
		if (!path.endsWith('_readme')) strings.push({ key: path, text: node, src });
		return;
	}
	if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`, src));
	if (node && typeof node === 'object')
		for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, src);
};

const dir = join(ROOT, 'src/i18n', locale);
for (const f of readdirSync(dir)) {
	if (!f.endsWith('.json') || f === 'simple.json') continue;
	walk(JSON.parse(readFileSync(join(dir, f), 'utf8')), f === 'content.json' ? '' : f.replace('.json', ''), 'ui');
}

// The nature writing lives in data/*.json for English; other locales carry it in
// their content.json overlay, which the loop above already picked up.
if (locale === 'en') {
	const PROSE = [
		'description',
		'diet',
		'fact',
		'role',
		'preferredHabitat',
		'hint',
		'flavor',
		'blurb',
		'restorationGoal',
		'effect',
		'label',
		'shelter',
	];
	for (const f of readdirSync(join(ROOT, 'data'))) {
		if (!f.endsWith('.json')) continue;
		const j = JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
		const scan = (o, path) => {
			if (!o || typeof o !== 'object') return;
			if (Array.isArray(o)) return o.forEach((v, i) => scan(v, `${path}[${i}]`));
			for (const [k, v] of Object.entries(o)) {
				if (typeof v === 'string' && PROSE.includes(k)) strings.push({ key: `${path}.${k}`, text: v, src: 'data' });
				else scan(v, `${path}.${k}`);
			}
		};
		scan(j, f.replace('.json', ''));
	}
}

// ---------------------------------------------------------------- overlay

/** The plain-language overlay, flattened to the same dot-keys. */
const simple = {};
const simplePath = join(ROOT, 'src/i18n', locale, 'simple.json');
if (existsSync(simplePath)) {
	const flat = (o, prefix) => {
		for (const [k, v] of Object.entries(o)) {
			const key = prefix ? `${prefix}.${k}` : k;
			if (typeof v === 'string') simple[key] = v;
			else if (Array.isArray(v)) v.forEach((s, i) => (simple[`${key}[${i}]`] = s));
			else if (v && typeof v === 'object') flat(v, key);
		}
	};
	flat(JSON.parse(readFileSync(simplePath, 'utf8')), '');
}
delete simple._readme;

// A data-content key like `animals-1.records[12].diet` is reached in the overlay
// as `content.animal.<id>.diet`, so map data paths onto content keys to tell
// whether a nature-writing string has a plain version.
const DATA_KIND = {
	'animals-1': 'animal',
	'animals-2': 'animal',
	'habitat-objects': 'habitatObject',
	biomes: 'biome',
	achievements: 'achievement',
	tools: 'tool',
	recipes: 'recipe',
	resources: 'resource',
};
const idIndex = {};
const recIndex = {};
for (const f of readdirSync(join(ROOT, 'data'))) {
	if (!f.endsWith('.json')) continue;
	const base = f.replace('.json', '');
	const recs = JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')).records || [];
	recs.forEach((r, i) => {
		idIndex[`${base}.records[${i}]`] = r.id;
		recIndex[`${base}.records[${i}]`] = r;
	});
}

// Not every translatable string sits directly on the record. `content()` is called
// with a dotted field path for the nested ones, and the path it uses is NOT the
// data path — an animal's `requirements.hint` is read as plain `hint`, and a tool
// tier is addressed by its `tier` NUMBER rather than its array index. Getting this
// wrong doesn't warn, it just reports covered strings as still-to-do (and hides
// real gaps), so the mapping is spelled out rather than guessed.
function overlayField(rec, path) {
	if (path === 'requirements.hint') return 'hint'; // Journal.tsx: content('animal', id, 'hint', req.hint)
	const tier = path.match(/^tiers\[(\d+)\]\.(\w+)$/); // Panels.tsx: content('tool', id, `tiers.${tier}.effect`)
	if (tier) {
		const n = rec?.tiers?.[Number(tier[1])]?.tier;
		return n == null ? null : `tiers.${n}.${tier[2]}`;
	}
	return /^[\w.]+$/.test(path) ? path : null; // plain and dotted-plain (unlock.label)
}

function overlayKey(entry) {
	if (entry.src !== 'data') return entry.key;
	const m = entry.key.match(/^(.*\.records\[\d+\])\.(.+)$/);
	if (!m) return entry.key;
	const base = m[1].split('.records')[0];
	const id = idIndex[m[1]];
	const kind = DATA_KIND[base];
	if (!id || !kind) return entry.key;
	const field = overlayField(recIndex[m[1]], m[2]);
	return field ? `content.${kind}.${id}.${field}` : entry.key;
}

// ---------------------------------------------------------------- report

const rows = [];
for (const entry of strings) {
	const before = gradeLevel(entry.text);
	if (before == null) continue;
	const ok = overlayKey(entry);
	const plain = simple[ok];
	// A plain version can score `null` — the rewrite came in under MIN_WORDS. By the
	// script's own rule that's below the noise floor, i.e. as good as it gets, NOT
	// unknown. Falling back to `before` here (which is what `plain ? … : before`
	// did) reported those at the ORIGINAL grade and left dozens of finished strings
	// sitting in the still-to-do list forever. Treat unscorably-short as at target.
	const after = plain ? (gradeLevel(plain) ?? 0) : before;
	rows.push({ ...entry, overlayKey: ok, before, plain: plain ?? null, after });
}

const hardBefore = rows.filter((r) => r.before > TARGET_GRADE);
const hardAfter = rows.filter((r) => r.after > TARGET_GRADE);
const covered = rows.filter((r) => r.plain);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

if (asJson) {
	console.log(
		JSON.stringify(
			{
				locale,
				target: TARGET_GRADE,
				total: rows.length,
				hardBefore: hardBefore.length,
				hardAfter: hardAfter.length,
				covered: covered.length,
				// `grade` is the ORIGINAL score and `after` what a player with the option
				// on actually reads. They differ once a plain version exists but still
				// lands above target, which is most of the tail — reporting only the
				// original made covered strings look untouched.
				remaining: hardAfter.map((r) => ({
					key: r.overlayKey,
					grade: +r.before.toFixed(1),
					after: +r.after.toFixed(1),
					text: r.text,
					plain: r.plain,
				})),
			},
			null,
			2,
		),
	);
	process.exit(0);
}

console.log(`readability — locale ${locale}, target grade ${TARGET_GRADE}\n`);
if (locale !== 'en') {
	// Flesch–Kincaid is calibrated on English. Spanish words carry more syllables
	// per idea, so the same sentence scores several grades higher — the absolute
	// numbers below are NOT comparable to the English target. Use them only to
	// compare Spanish against Spanish: normal vs simple, and before vs after.
	console.log('  NOTE: grade numbers are only meaningful relative to other');
	console.log('        text in the SAME language — the formula is English-tuned.\n');
}
console.log(`  scorable strings      ${rows.length}`);
console.log(`  above target (normal) ${hardBefore.length}`);
console.log(`  plain versions written ${covered.length}`);
console.log(`  above target WITH the option on   ${hardAfter.length}`);
console.log(
	`  mean grade  normal ${mean(rows.map((r) => r.before)).toFixed(1)}  →  simple ${mean(rows.map((r) => r.after)).toFixed(1)}`,
);

const bySrc = {};
for (const r of hardAfter) bySrc[r.src] = (bySrc[r.src] || 0) + 1;
console.log(`  still to do by source ${JSON.stringify(bySrc)}`);

// Two very different things end up in that count, and conflating them makes the
// work look unfinished when it isn't:
//
//   • strings with NO plain version — real, actionable work;
//   • strings already rewritten in plain words that still score above target.
//
// The second group is mostly the formula's floor. A one-sentence line like "Tiger
// salamanders are among the biggest land salamanders in North America" scores 13th
// grade purely because "salamander" has four syllables and appears twice. It's a
// species name; there is no plainer word, and splitting the sentence to game the
// score would make it read worse. Report the two separately so the actionable
// number is the one that stands out.
// For a non-English locale the "above target" set is not a real work list — the
// formula flags 1900 of 1938 Spanish strings, including ones already rewritten as
// plainly as Spanish allows. Deriving "not yet rewritten" from it would invent
// hundreds of phantom tasks. The meaningful question for another language is key
// PARITY: which strings has English simplified that this locale hasn't? That's
// also what tests/unit/simple-text.test.ts enforces, so the two agree.
const unwritten =
	locale === 'en'
		? hardAfter.filter((r) => !r.plain)
		: (() => {
				const enSimple = {};
				const enPath = join(ROOT, 'src/i18n/en/simple.json');
				if (existsSync(enPath)) {
					const flat = (o, prefix) => {
						for (const [k, v] of Object.entries(o)) {
							const key = prefix ? `${prefix}.${k}` : k;
							if (typeof v === 'string') enSimple[key] = v;
							else if (Array.isArray(v)) v.forEach((s, i) => (enSimple[`${key}[${i}]`] = s));
							else if (v && typeof v === 'object') flat(v, key);
						}
					};
					flat(JSON.parse(readFileSync(enPath, 'utf8')), '');
				}
				delete enSimple._readme;
				return Object.keys(enSimple)
					.filter((k) => simple[k] === undefined)
					.map((k) => ({ overlayKey: k, after: 0, plain: null, text: enSimple[k] }));
			})();
console.log(
	locale === 'en'
		? `  of those, with no plain version yet ${unwritten.length}`
		: `  keys English has simplified but ${locale} has not ${unwritten.length}`,
);
if (unwritten.length === 0 && hardAfter.length) {
	if (locale === 'en') {
		console.log(`  (every string above target has a plain version; the rest is the formula's floor —`);
		console.log(`   short single sentences whose score is driven by unavoidable names)`);
	} else {
		console.log(`  (nothing to port from English — the count above is the English-tuned`);
		console.log(`   formula misreading Spanish, not untranslated work)`);
	}
}

const show = listAll ? hardAfter : (unwritten.length ? unwritten : hardAfter).slice(0, 15);
if (show.length) {
	const label = unwritten.length && !listAll ? 'not yet rewritten' : `still above grade ${TARGET_GRADE}`;
	console.log(`\n${label}${listAll ? '' : ' (hardest 15 — pass --list for all)'}:`);
	for (const r of [...show].sort((a, b) => b.after - a.after)) {
		console.log(
			`  ${r.after.toFixed(1).padStart(5)}  ${r.overlayKey.slice(0, 52).padEnd(52)} ${JSON.stringify(r.plain ?? r.text).slice(0, 70)}`,
		);
	}
}

// Regressions matter more than absolute coverage: a plain version that reads
// HARDER than the original is a mistake, not partial progress.
//
// ENGLISH ONLY. The syllable heuristic is English-tuned, and on Spanish it
// flagged 15 rewrites that are plainly simpler than their originals — "Casi solo
// semillas" scored WORSE than "Casi por completo semillas". A check that cries
// wolf gets ignored, which would waste the one check that catches real mistakes.
// Other locales still get the coverage numbers above; they just don't get a
// verdict the formula isn't entitled to give.
const worse = locale === 'en' ? covered.filter((r) => r.after > r.before + 0.5) : [];
if (locale !== 'en') {
	console.log('\n(regression check skipped — the formula is English-tuned and misjudges this language)');
}
if (worse.length) {
	console.log(`\nWARNING — ${worse.length} plain version(s) score HARDER than the original:`);
	for (const r of worse.slice(0, 10)) console.log(`  ${r.before.toFixed(1)} → ${r.after.toFixed(1)}  ${r.overlayKey}`);
	process.exitCode = 1;
}

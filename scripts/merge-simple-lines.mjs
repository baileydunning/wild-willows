// Merge plain-language rewrites into an ARRAY-valued catalog key (the narrative
// line pools).
//
//   node scripts/merge-simple-lines.mjs <patch.mjs> <locale>
//
// The patch default-exports { 'narrative.lines.meadow': { 0: '…', 5: '…' } } —
// sparse, indexed by position in the normal pool.
//
// Why this exists instead of hand-writing the arrays: narrative.ts reads
// `tList('narrative.lines.<biome>')[i]` and pairs index i with a separate table of
// gating rules. The overlay replaces the WHOLE array, so a plain version that is
// short by one line, or shifted by one, silently attaches the wrong text to a
// gate — or renders `undefined`. Rebuilding each array from the normal pool and
// overwriting only the named indices makes both mistakes impossible to express.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [patchPath, locale] = process.argv.slice(2);
if (!patchPath || !locale) {
	console.error('usage: merge-simple-lines.mjs <patch.mjs> <locale>');
	process.exit(1);
}

const patch = (await import(patchPath)).default;
const simplePath = join(ROOT, 'src/i18n', locale, 'simple.json');
const simple = JSON.parse(readFileSync(simplePath, 'utf8'));

let written = 0;
for (const [key, byIndex] of Object.entries(patch)) {
	const parts = key.split('.');

	// The normal pool this overlay shadows — read from whichever catalog file holds
	// it, so the rebuilt array is always exactly as long as the real one.
	const file = join(ROOT, 'src/i18n', locale, `${parts[0]}.json`);
	let node = JSON.parse(readFileSync(file, 'utf8'));
	for (const p of parts.slice(1)) node = node?.[p];
	if (!Array.isArray(node)) throw new Error(`${key} is not an array in ${locale}/${parts[0]}.json`);

	// Start from the existing overlay if there is one, so repeated runs accumulate.
	let cur = simple;
	for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
	const existing = cur[parts.at(-1)];
	const out = Array.isArray(existing) && existing.length === node.length ? [...existing] : [...node];

	for (const [i, text] of Object.entries(byIndex)) {
		const n = Number(i);
		if (!Number.isInteger(n) || n < 0 || n >= out.length)
			throw new Error(`${key}[${i}] is out of range (0..${out.length - 1})`);
		out[n] = text;
		written++;
	}
	cur[parts.at(-1)] = out;
}

writeFileSync(simplePath, JSON.stringify(simple, null, '\t') + '\n');
console.log(`merged ${written} lines into ${simplePath}`);

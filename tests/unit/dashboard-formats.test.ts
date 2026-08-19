import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Two pure helpers inside dashboard.html that fail SILENTLY — not as an error,
// but as a plausible-looking number or a plausible-looking name:
//
//   • fmtShort, which shortens a count for the six-across stat strip on a
//     highlight card. A wrong rounding rule still renders something that looks
//     like a number, and the card is the only place the figure is shortened, so
//     nothing downstream disagrees with it.
//   • speciesName, which labels each row of the arrivals timeline. It prefers
//     the name the save recorded and un-slugs the id only for rows written
//     before names were stored. Dropping the preference would quietly downgrade
//     every new save to the fallback and turn "Red-tailed Hawk" into "Red Tailed
//     Hawk" for everyone.
//
// Same approach as dashboard-highlights-sort.test.ts: the page has no module
// boundary to import, so the helper is lifted out of the source as text and run
// for real rather than merely asserted to exist.

const DASHBOARD = readFileSync(resolve(__dirname, '../../', 'public/dashboard.html'), 'utf8');

/** Lift a `const NAME = (…) => …;` declaration out of the page and evaluate it.
 *
 *  The end of the declaration is found by walking brackets rather than by
 *  matching a closing token: a single-expression arrow ends at a bare `;` and a
 *  braced one at `};`, and looking for either literally would swallow whatever
 *  happens to follow. Strings are skipped so a semicolon inside one cannot end
 *  the scan early; regex literals are not, which is fine for the helpers lifted
 *  here — none of their patterns contain a bracket or a quote. */
function lift<T>(name: string, deps = ''): T {
	const start = DASHBOARD.indexOf(`const ${name} = (`);
	expect(start, `${name} not found in dashboard.html`).toBeGreaterThan(-1);
	let depth = 0;
	let quote = '';
	let end = -1;
	for (let i = start; i < DASHBOARD.length; i++) {
		const c = DASHBOARD[i];
		if (quote) {
			if (c === '\\') i++;
			else if (c === quote) quote = '';
			continue;
		}
		if (c === "'" || c === '"' || c === '`') quote = c;
		else if ('([{'.includes(c)) depth++;
		else if (')]}'.includes(c)) depth--;
		else if (c === ';' && depth === 0) {
			end = i + 1;
			break;
		}
	}
	expect(end, `could not find the end of ${name}`).toBeGreaterThan(start);
	const src = DASHBOARD.slice(start, end);
	return new Function(`${deps}\n${src}\nreturn ${name};`)() as T;
}

const N_AND_FMT = "const n = (x) => (x == null || isNaN(x) ? 0 : x);\nconst fmt = (x) => n(x).toLocaleString('en-US');";

describe('fmtShort — the highlight card stat strip', () => {
	const fmtShort = lift<(x: unknown) => string>('fmtShort', N_AND_FMT);

	it('leaves anything under a thousand exactly as it is', () => {
		expect(fmtShort(0)).toBe('0');
		expect(fmtShort(7)).toBe('7');
		expect(fmtShort(999)).toBe('999');
	});

	it('switches to K at exactly one thousand', () => {
		expect(fmtShort(999)).toBe('999');
		expect(fmtShort(1000)).toBe('1K');
	});

	it('keeps one decimal below ten thousand and drops it above', () => {
		expect(fmtShort(2640)).toBe('2.6K');
		expect(fmtShort(9949)).toBe('9.9K');
		expect(fmtShort(12480)).toBe('12K');
		expect(fmtShort(128400)).toBe('128K');
	});

	it('never renders a pointless ".0"', () => {
		expect(fmtShort(2000)).toBe('2K');
		expect(fmtShort(2040)).toBe('2K');
		expect(fmtShort(1000000)).toBe('1M');
	});

	it('rolls over to M rather than printing 1000K', () => {
		expect(fmtShort(999499)).toBe('999K');
		expect(fmtShort(999500)).toBe('1M');
		expect(fmtShort(1250000)).toBe('1.3M');
	});

	it('treats junk as zero rather than printing NaN', () => {
		expect(fmtShort(null)).toBe('0');
		expect(fmtShort(undefined)).toBe('0');
	});
});

describe('speciesName — the arrivals timeline label', () => {
	const speciesName = lift<(a: { id: string; name?: string }) => string>('speciesName');

	it('uses the name the save recorded', () => {
		expect(speciesName({ id: 'red-winged-blackbird', name: 'Red-winged Blackbird' })).toBe('Red-winged Blackbird');
	});

	it('un-slugs the id for rows written before names were stored', () => {
		expect(speciesName({ id: 'western-bluebird' })).toBe('Western Bluebird');
		expect(speciesName({ id: 'grasshopper' })).toBe('Grasshopper');
	});

	it('is why the name is stored: un-slugging cannot recover a real hyphen', () => {
		// The fallback is close enough to read on an old save and wrong enough not
		// to rely on — this is the case that made storing the name worth it.
		expect(speciesName({ id: 'red-tailed-hawk' })).toBe('Red Tailed Hawk');
		expect(speciesName({ id: 'red-tailed-hawk', name: 'Red-tailed Hawk' })).toBe('Red-tailed Hawk');
	});
});

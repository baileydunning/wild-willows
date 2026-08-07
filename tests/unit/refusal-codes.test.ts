import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every refusal carries its message KEY, not just its translated text, because
// the text is already localized by the time it's raised — counting that would
// split one problem across every language the game ships in.
//
// The keys were added to all 163 throw sites at once. The risk now is the 164th:
// someone adds a refusal, doesn't pass the key, and it silently lands in the
// dashboard's bucket as "unknown" — which looks like no problem at all. Nothing
// at runtime can catch that, since an untagged refusal still works perfectly for
// the player. So check the source.

const SRC = readFileSync(resolve(__dirname, '../../server/resources.ts'), 'utf8');

/** Index of the ')' matching the '(' at `open`, skipping string contents. */
function matchParen(src: string, open: number): number {
	let depth = 0;
	let quote: string | null = null;
	for (let i = open; i < src.length; i++) {
		const c = src[i];
		if (quote) {
			if (c === '\\') i++;
			else if (c === quote) quote = null;
			continue;
		}
		if (c === "'" || c === '"' || c === '`') quote = c;
		else if (c === '(') depth++;
		else if (c === ')' && --depth === 0) return i;
	}
	throw new Error('unbalanced parentheses');
}

/** Split on top-level commas only, so nested calls stay in one piece. */
function splitArgs(args: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let cur = '';
	for (let i = 0; i < args.length; i++) {
		const c = args[i];
		if (quote) {
			cur += c;
			if (c === '\\') cur += args[++i];
			else if (c === quote) quote = null;
			continue;
		}
		if (c === "'" || c === '"' || c === '`') quote = c;
		else if ('([{'.includes(c)) depth++;
		else if (')]}'.includes(c)) depth--;
		if (c === ',' && depth === 0) {
			out.push(cur);
			cur = '';
			continue;
		}
		cur += c;
	}
	if (cur.trim()) out.push(cur);
	return out;
}

interface Site {
	key: string | null;
	code: string | null;
	line: number;
}

function refusalSites(): Site[] {
	const sites: Site[] = [];
	for (const m of SRC.matchAll(/new GameError\(/g)) {
		const open = m.index! + m[0].length - 1;
		const args = splitArgs(SRC.slice(open + 1, matchParen(SRC, open)));
		const key = args[0]?.match(/^\s*tr\(\s*'([^']+)'/)?.[1] ?? null;
		const code = args[2]?.trim().match(/^'([^']+)'$/)?.[1] ?? null;
		sites.push({ key, code, line: SRC.slice(0, m.index!).split('\n').length });
	}
	return sites;
}

describe('refusal codes', () => {
	const sites = refusalSites();

	it('finds the refusals (so a rename cannot quietly empty this suite)', () => {
		expect(sites.length).toBeGreaterThan(100);
	});

	it('tags every refusal with the key of the message it shows', () => {
		const untagged = sites.filter((s) => s.key && !s.code).map((s) => `resources.ts:${s.line}`);
		expect(
			untagged,
			`these refusals would be counted as "unknown" on the dashboard:\n  ${untagged.join('\n  ')}`,
		).toEqual([]);
	});

	it('tags each one with its OWN key, not a neighbour’s', () => {
		// A copy-pasted throw site with the wrong key is worse than an untagged one:
		// it silently inflates another reason's count and hides its own.
		const mismatched = sites
			.filter((s) => s.key && s.code && s.key !== s.code)
			.map((s) => `resources.ts:${s.line} shows ${s.key} but counts as ${s.code}`);
		expect(mismatched, mismatched.join('\n  ')).toEqual([]);
	});

	it('counts refusals where they are raised, so none can bypass it', () => {
		// The counter lives in the constructor precisely so a refusal cannot be
		// raised without being recorded. If that moves to a dispatch layer, the next
		// endpoint that forgets to call it goes silent.
		const ctor = SRC.slice(SRC.indexOf('class GameError extends Error'));
		expect(ctor.slice(0, ctor.indexOf('\n}'))).toMatch(/noteRefusal\(/);
	});
});

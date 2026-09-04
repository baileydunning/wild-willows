import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serverSource } from '../serverSource';

// /developers/api — the public-API documentation.
//
// A reference page has one failure mode that matters: saying something the data
// does not say. Everything checkable on this page is checked against the data
// files the endpoint is actually built from, so a content change that makes the
// docs lie fails here rather than in somebody's inbox.

const root = process.cwd();
const PAGE = readFileSync(resolve(root, 'public/developers-api.html'), 'utf8');
const text = PAGE.replace(/<[^>]+>/g, ' ')
	.replace(/&mdash;/g, '—')
	.replace(/\s+/g, ' ');

const records = (file: string): any[] => {
	const j = JSON.parse(readFileSync(resolve(root, 'data', file), 'utf8'));
	return j.records || (Array.isArray(j) ? j : Object.values(j).find(Array.isArray as any));
};
const ANIMALS = [...records('animals-1.json'), ...records('animals-2.json')];
const BIOMES = records('biomes.json');

describe('the counts on the page are the counts in the data', () => {
	it.each([
		['animals', ANIMALS.length, 150],
		['biomes', BIOMES.length, 6],
		['habitatObjects', records('habitat-objects.json').length, 436],
		['recipes', records('recipes.json').length, 406],
		['resources', records('resources.json').length, 37],
		['achievements', records('achievements.json').length, 50],
		['tools', records('tools.json').length, 9],
	])('%s: the page says %i and the data has %i', (_key, actual, onPage) => {
		expect(actual).toBe(onPage);
		expect(PAGE).toContain(`<td class="num">${onPage}</td>`);
	});

	it('the trophic counts in the census output are real', () => {
		// The page prints the output of a script. If the data shifts under it, the
		// printed output becomes a plausible-looking lie.
		const counts: Record<string, number> = {};
		for (const a of ANIMALS) counts[a.trophic] = (counts[a.trophic] || 0) + 1;
		for (const [role, n] of Object.entries(counts))
			expect(text, `${role} ${n}`).toMatch(new RegExp(`${role}\\s+${n}\\b`));
	});

	it('the rarity split is real', () => {
		for (const r of ['common', 'uncommon', 'rare']) {
			const n = ANIMALS.filter((a) => a.rarity === r).length;
			expect(text).toContain(`${r}</code> (${n})`.replace(/<\/code>/, ''));
		}
	});

	it('the first meadow arrivals are the ones the ladder output shows', () => {
		const ladder = ANIMALS.filter((a) => a.biome === 'meadow').sort(
			(a, b) => a.requirements.minHealth - b.requirements.minHealth,
		);
		expect(ladder[0].name).toBe('Grasshopper');
		expect(ladder[0].requirements.minHealth).toBe(8);
		expect(text).toMatch(/8%\s+Grasshopper/);
		expect(ladder[ladder.length - 1].requirements.minHealth).toBe(80);
	});
});

describe('every value the page enumerates still exists', () => {
	it('the trophic roles', () => {
		for (const t of new Set(ANIMALS.map((a) => a.trophic))) expect(PAGE, t).toContain(`<b>${t}</b>`);
	});

	it('the kinds', () => {
		for (const k of new Set(ANIMALS.map((a) => a.kind))) expect(PAGE, k).toContain(`<code>${k}</code>`);
	});

	it('the biome ids and their names', () => {
		for (const b of BIOMES) {
			expect(PAGE, b.id).toContain(`<code>${b.id}</code>`);
			expect(text, b.name).toContain(b.name);
		}
	});

	it('and every field it documents is on the record it claims', () => {
		// Scoped per section, because the caching table has the same row shape and
		// its "fields" are HTTP headers.
		const section = (id: string) => {
			const m = new RegExp(`<section class="tsec" id="${id}">([\\s\\S]*?)<\\/section>`).exec(PAGE);
			expect(m, `#${id} should be on the page`).toBeTruthy();
			return [...m![1].matchAll(/<tr><td><code>(\w+)<\/code><\/td><td class="tight">/g)].map((x) => x[1]);
		};
		const cases: [string, Set<string>][] = [
			['animal', new Set(Object.keys(ANIMALS[0]))],
			['requirements', new Set(Object.keys(ANIMALS.find((a) => a.id === 'red-fox')!.requirements))],
			['biome', new Set(Object.keys(BIOMES[0]))],
		];
		let total = 0;
		for (const [id, fields] of cases) {
			const documented = section(id);
			expect(documented.length, id).toBeGreaterThan(4);
			total += documented.length;
			for (const f of documented) expect(fields.has(f), `#${id} documents ${f}, which is on no record`).toBe(true);
		}
		expect(total).toBeGreaterThan(30);
	});

	it('and documents every field the records actually have', () => {
		// The other direction: a field added to the data and not to the page is an
		// undocumented feature, which is how a reference goes quietly stale.
		const animalDoc = PAGE.slice(PAGE.indexOf('id="animal"'), PAGE.indexOf('id="requirements"'));
		for (const f of Object.keys(ANIMALS[0]))
			expect(animalDoc, `animals[].${f} is in the data and not in the docs`).toContain(`<code>${f}</code>`);
	});
});

describe('the page is honest about what it is', () => {
	it('names the endpoint, and only that endpoint', () => {
		expect(PAGE).toContain('https://wildwillows.app/GameData');
		// There is no /api/v1: the URL is hardcoded in every shipped build and
		// cannot move, and promising a versioned one would be a lie.
		expect(PAGE).not.toMatch(/\/api\/v\d/);
	});

	it('says which fields are safe to build on and which are not', () => {
		expect(PAGE).toMatch(/<section class="tsec" id="stability">/);
		expect(text).toContain('Safe to build on');
		expect(text).toContain('May change without warning');
	});

	it('does not claim to be a scientific reference', () => {
		expect(text).toContain('Not suitable as a scientific reference');
	});

	it('canonicalises to one of its two paths', () => {
		expect(PAGE).toContain('<link rel="canonical" href="https://wildwillows.app/developers/api">');
	});
});

describe('the documented rate limit is the one the server enforces', () => {
	// A docs page that states a limit the code does not have is worse than one
	// that says nothing: somebody sizes their client against it. This reads the
	// tier out of the server source and checks the page against it.
	const RESOURCES = serverSource();
	const tier = /catalog: \{ perMinute: (\d+), burst: (\d+) \}/.exec(RESOURCES);

	it('the catalog has a tier of its own', () => {
		expect(tier, 'a `catalog` rate tier should exist').toBeTruthy();
		expect(RESOURCES).toMatch(/export class GameData extends PublicEndpoint \{\s*\n\s*static rateTier = 'catalog';/);
		expect(RESOURCES).toContain("rateLimit(this, 'catalog')");
	});

	it('and the page prints the same numbers', () => {
		const perMinute = Number(tier![1]);
		const burst = Number(tier![2]);
		// Printed with a thousands separator on the page, without one in the code.
		expect(text).toContain(perMinute.toLocaleString('en-US'));
		expect(text).toContain(String(burst));
		expect(text).toContain(`${perMinute.toLocaleString('en-US')} requests a minute per address`);
	});

	it('no longer claims there is no limit', () => {
		expect(text).not.toMatch(/no rate limit/i);
		expect(text).not.toMatch(/no rate-limit headers/i);
	});

	it('shows what a refusal looks like, including the header that makes it readable', () => {
		// A 429 without CORS reaches a browser as an opaque failure with no status.
		// The example has to show the header, because the whole point of answering
		// the refusal by hand instead of throwing is that the header is on it.
		expect(PAGE).toContain('429 Too Many Requests');
		expect(PAGE).toContain('access-control-allow-origin: *');
		expect(PAGE).toContain('retry-after: 60');
		expect(PAGE).toMatch(/res\.status === 429/);
	});

	it('and the server really does put those headers on it', () => {
		const handler = /try \{\s*\n\s*rateLimit\(this, 'catalog'\);[\s\S]*?\n\t\t\}\n/.exec(RESOURCES);
		expect(handler, 'the catalog refusal handler should be findable').toBeTruthy();
		expect(handler![0]).toContain("'retry-after': '60'");
		expect(handler![0]).toContain('GAME_DATA_CORS');
		// GameError carries `statusCode`, not `status`. Checking the wrong one
		// rethrew every refusal, so the CORS-safe answer above never ran.
		expect(handler![0]).toContain('err?.statusCode !== 429');
	});
});

describe('the site points at it', () => {
	it('from the landing page and the learn hub', () => {
		expect(readFileSync(resolve(root, 'public/landing.html'), 'utf8')).toContain('href="/developers/api"');
		expect(readFileSync(resolve(root, 'public/learn-index.html'), 'utf8')).toContain('href="/developers/api"');
	});

	it('with a target the beacon endpoint accepts', () => {
		const RESOURCES = serverSource();
		const list = /const LANDING_CLICK_TARGETS = new Set\(\[([\s\S]*?)\]\)/.exec(RESOURCES);
		expect(list![1]).toContain("'api-docs'");
	});
});

// The appended blocks below read the page source under the name the rest of
// this file uses for it.
const html = PAGE;

describe('the docs do not oversell what a repeat costs', () => {
	// A reviewer's catch, and a fair one: a 304 saves bandwidth, not requests.
	// Calling it "free" told a developer that a polling loop was fine as long as
	// it sent If-None-Match, which is exactly the loop that would have kept the
	// origin busy.
	it('never calls a repeat request free', () => {
		// Every sentence with "free" in it, judged one at a time. A blanket regex
		// either bans the word — the lesson and the API really are free of charge —
		// or matches the honest sentences that now say "cheap, not free".
		const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => /\bfree\b/i.test(x));
		expect(sentences.length, 'the page should still say what is free of charge').toBeGreaterThan(0);
		const offenders = sentences.filter((x) => {
			if (/not free|rather than free|free of charge/i.test(x)) return false; // explicitly the opposite claim
			if (/free (lesson|public API|to use|educator|classroom|copies)/i.test(x)) return false; // free of charge
			return /etag|repeat|request|304|limit/i.test(x); // a cost claim
		});
		expect(offenders).toEqual([]);
	});

	it('says what a 304 actually saves, and what it does not', () => {
		expect(html).toMatch(/Cheap, not free/i);
		expect(html).toContain('it is still a request');
	});

	it('explains what caching even is before explaining this one', () => {
		// The audience includes a fifteen-year-old on their second API. "Honor the
		// etag" is instructions; this is the paragraph that makes them mean
		// something.
		expect(html).toMatch(/Caching is keeping a copy of an answer/i);
		expect(html).toMatch(/private cache|Browser cache/i);
		expect(html).toMatch(/shared cache/i);
		expect(html).toMatch(/never reach the database/i);
	});

	it('names all three copies, including the one it does not control', () => {
		// The third is the one that actually decides whether an integration is
		// polite: a variable in the caller's own program.
		const i = html.indexOf('id="caching-explained"');
		const section = html.slice(i, html.indexOf('Only <code>GET</code>', i));
		expect(section).toMatch(/in your program|A variable, a file on disk/);
		expect(section).toMatch(/expiry/i);
		expect(section).toMatch(/validator/i);
		// The two TTLs, which are a Cloudflare rule rather than only this header.
		expect(section).toMatch(/[Tt]en minutes/);
		expect(section).toMatch(/One day/i);
	});

	it('keeps the security claim to what is checkable', () => {
		// "nothing here that can be injected into" is broader than anyone should
		// promise on a public page. The facts underneath it are fine.
		expect(html).not.toMatch(/nothing here that can be injected/i);
		expect(html).toContain('no request parameters and no write operations');
		expect(html).toContain('attack surface intentionally small');
	});

	it('publishes the shared-cache window the server actually sends', () => {
		// The origin's own header is the authority for the EDGE window, so that
		// number is read from source rather than trusted.
		const resources = serverSource();
		const m = /const cacheControl = '([^']+)';/.exec(resources);
		expect(m, 'GameData should set a cache-control it can be checked against').toBeTruthy();
		expect(m![1]).toContain('s-maxage=86400');
		expect(html).toContain('s-maxage=86400');
	});

	it('and documents the browser window a reader will really observe', () => {
		/* THE HEADER ON THE WIRE IS NOT THE HEADER IN THE SOURCE. The Cloudflare
		 * cache rule takes its edge TTL from the origin's header and rewrites the
		 * browser TTL to ten minutes, so a developer running `curl -I` sees
		 * max-age=600 where this file says max-age=0. Documenting the origin's
		 * string would be documenting something nobody receives. */
		expect(html).toContain('max-age=600');
		expect(html).not.toMatch(/<code>public, max-age=0/);
	});
});

describe('the docs say how to get the data corrected', () => {
	it('has a section of its own, in the page nav', () => {
		expect(html).toContain('id="corrections"');
		expect(html).toContain('href="#corrections"');
	});

	it('names the inbox it goes to', () => {
		const i = html.indexOf('id="corrections"');
		const section = html.slice(i, html.indexOf('id="terms"'));
		expect(section).toContain('wildwillowsgame@gmail.com');
	});

	it('asks for the four things that make a correction actionable', () => {
		const i = html.indexOf('id="corrections"');
		const section = html.slice(i, html.indexOf('id="terms"'));
		for (const want of ['<code>id</code>', 'field', 'should say', 'sources'])
			expect(section, `a correction should ask for: ${want}`).toContain(want);
	});

	it('is honest about what gets refused', () => {
		const i = html.indexOf('id="corrections"');
		const section = html.slice(i, html.indexOf('id="terms"'));
		// Better here than in a reply to someone who spent an evening on it.
		expect(section).toMatch(/push back/i);
		expect(section).toMatch(/no service-level promise|no ticket number/i);
	});
});

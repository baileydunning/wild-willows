import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// The classroom contract.
//
// /learn/web-development and /learn/code-builder teach students to fetch
// GET /GameData/ and read specific fields out of it. Those pages are static
// HTML: they cannot know that a field was renamed, and neither can a teacher
// standing in front of thirty students. The failure mode is not a stack trace,
// it is a worked example that silently returns an empty list — which every
// beginner reads as "I broke it", because they have no way to tell the
// difference between their typo and our refactor.
//
// So this file pins the exact surface the lesson depends on:
//   • the CORS header the sandboxed preview and downloaded projects need,
//   • the field NAMES the chapters read,
//   • the VALUE SETS the chapters filter on (a wrong value is invisible —
//     `trophic === 'predator'` matches nothing and throws nothing),
//   • the COUNTS the lesson prints in its own prose.
//
// If something here fails, the fix is either to restore the field or to update
// the lesson copy — not to loosen the assertion. Each one names the chapter it
// protects so whoever hits it knows what breaks.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

/** The catalog as a browser receives it (no compression, so the body is JSON). */
const catalog = async (): Promise<any> => {
	const res = await w.fetch<any>('GameData', {});
	return JSON.parse(String(res.body));
};

describe('GameData — CORS for the classroom pages', () => {
	it('allows any origin on a 200', async () => {
		// Without this, the preview iframe (sandbox="allow-scripts", i.e. an opaque
		// origin) and every downloaded project (file://, Origin: null) fail to fetch.
		const res = await w.fetch<any>('GameData', {});
		expect(res.status).toBe(200);
		expect(res.headers['access-control-allow-origin']).toBe('*');
	});

	it('allows any origin on a 304 as well', async () => {
		// The regression this exists to prevent: a cross-origin lesson page works on
		// first load, then breaks on every reload, because the revalidation response
		// carried no CORS headers. Reload is the single most common thing a student
		// does in a code editor.
		const first = await w.fetch<any>('GameData', {});
		const etag = first.headers.etag;
		expect(etag).toMatch(/^W\/"gd-/);

		const second = await w.fetch<any>('GameData', { 'if-none-match': etag });
		expect(second.status).toBe(304);
		expect(second.headers['access-control-allow-origin']).toBe('*');
	});

	it('never sends credentials alongside the wildcard', async () => {
		// `*` and Access-Control-Allow-Credentials are mutually exclusive by spec,
		// and the combination is what turns a public read into a session-hijack
		// primitive. Assert the absence rather than trusting nobody adds it later.
		const res = await w.fetch<any>('GameData', {});
		expect(res.headers['access-control-allow-credentials']).toBeUndefined();
	});

	it('does NOT leak CORS onto per-player state', async () => {
		// GameData is a public catalog. GameState is ONE player's save. The scoping
		// here is by construction (a const on one endpoint, not middleware), and
		// this is the test that keeps it that way.
		const created = await w.post<any>('CreatePlayer', {
			name: 'Ada',
			passcode: 'pw1234',
			appearance: { skin: 0, hair: 0, hairstyle: 0, outfit: 0, hat: 'straw', hatColor: 0, beard: 0, body: 0 },
		});
		const res = await w.fetch<any>('GameState', {}, created.playerId);
		expect(res.headers?.['access-control-allow-origin']).toBeUndefined();
	});

	it('still returns the plain object to internal callers', async () => {
		// The in-app solo backend calls get() with no request context and uses the
		// return value AS the data. Adding headers must not have wrapped it.
		const obj = await w.get<any>('GameData');
		expect(Array.isArray(obj.animals)).toBe(true);
		expect(obj).not.toHaveProperty('status');
		expect(obj).not.toHaveProperty('headers');
	});
});

describe('GameData — fields the lesson reads', () => {
	it('every animal has the fields the chapters use', async () => {
		const d = await catalog();
		for (const a of d.animals) {
			// ch.3 (JSON types) · ch.5 (property access) · ch.7 (map/filter/sort)
			expect(typeof a.name, `${a.id}.name`).toBe('string');
			expect(typeof a.biome, `${a.id}.biome`).toBe('string');
			expect(typeof a.kind, `${a.id}.kind`).toBe('string');
			expect(typeof a.trophic, `${a.id}.trophic`).toBe('string');
			expect(typeof a.rarity, `${a.id}.rarity`).toBe('string');
			expect(typeof a.diet, `${a.id}.diet`).toBe('string');
			expect(typeof a.fact, `${a.id}.fact`).toBe('string');
			expect(typeof a.scientificName, `${a.id}.scientificName`).toBe('string');
			expect(typeof a.shelter, `${a.id}.shelter`).toBe('string');
			expect(typeof a.preferredHabitat, `${a.id}.preferredHabitat`).toBe('string');
			// ch.6 — `if (animal.requirements.minHealth > 50)` is a worked example.
			expect(typeof a.requirements?.minHealth, `${a.id}.requirements.minHealth`).toBe('number');
			// ch.7 chaining + the What Eats What / Food Web idea cards.
			expect(Array.isArray(a.eats), `${a.id}.eats`).toBe(true);
			expect(Array.isArray(a.eatenBy), `${a.id}.eatenBy`).toBe(true);
			// The Sources Page idea card, and the credibility claim on /teachers.
			expect(Array.isArray(a.sources) && a.sources.length > 0, `${a.id}.sources`).toBe(true);
		}
	});

	it('every biome has the fields the chapters use', async () => {
		const d = await catalog();
		for (const b of d.biomes) {
			expect(typeof b.id, `${b.id}.id`).toBe('string');
			expect(typeof b.name, `${b.id}.name`).toBe('string');
			// The Biome Colors idea card styles the page with these hexes, so they
			// have to BE hexes — a named colour or an rgb() string would break it.
			expect(b.palette?.healthy, `${b.id}.palette.healthy`).toMatch(/^#[0-9a-f]{6}$/i);
			expect(b.palette?.damaged, `${b.id}.palette.damaged`).toMatch(/^#[0-9a-f]{6}$/i);
			// The Resource Map idea card.
			expect(Array.isArray(b.resources), `${b.id}.resources`).toBe(true);
		}
	});
});

describe('GameData — values the lesson filters on', () => {
	// A renamed VALUE is worse than a renamed field: `=== 'predator'` throws
	// nothing, matches nothing, and renders an empty page. These sets are quoted
	// verbatim in chapter 6, chapter 7 and the ideas pool.

	it('trophic uses the exact values the examples filter on', async () => {
		const d = await catalog();
		const seen = new Set(d.animals.map((a: any) => a.trophic));
		// Named in ch.6 (`=== 'apex-predator'`) and the Top of the Chain idea card.
		expect(seen.has('apex-predator')).toBe(true);
		expect(seen.has('herbivore')).toBe(true);
		// The lesson explicitly warns that plain 'predator' is NOT a value. If this
		// ever becomes one, the warning is now the thing that is wrong.
		expect(seen.has('predator')).toBe(false);
	});

	it('rarity uses the exact values the examples filter on', async () => {
		const d = await catalog();
		const seen = new Set(d.animals.map((a: any) => a.rarity));
		// ch.6's else-if chain renders one badge per value, and covers all three.
		expect([...seen].sort()).toEqual(['common', 'rare', 'uncommon']);
	});

	it('kind uses the exact values the examples filter on', async () => {
		const d = await catalog();
		const seen = new Set(d.animals.map((a: any) => a.kind));
		// The Tiny Things idea card, and ch.6's `||` example (bird || mammal).
		for (const k of ['invertebrate', 'mammal', 'bird', 'insect']) expect(seen.has(k), k).toBe(true);
	});

	it('every biome id the lesson names still exists', async () => {
		const d = await catalog();
		const ids = new Set(d.biomes.map((b: any) => b.id));
		// ch.7 tells students to swap "meadow" for any of these and watch the count
		// change. A renamed id makes that instruction produce an empty list.
		for (const id of ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal']) expect(ids.has(id), id).toBe(true);
	});
});

describe('GameData — counts the lesson prints in its own prose', () => {
	// These numbers are written into the page copy ("an array of 150 things",
	// "150 in, 25 out"). If the content changes, the lesson is lying to students
	// and the copy needs updating — that is what this failure means.

	it('has 150 animals', async () => {
		expect((await catalog()).animals.length).toBe(150);
	});

	it('has 6 biomes', async () => {
		expect((await catalog()).biomes.length).toBe(6);
	});

	it('has 25 animals in the meadow', async () => {
		const d = await catalog();
		// This is chapter 7's headline example, verbatim.
		expect(d.animals.filter((a: any) => a.biome === 'meadow').length).toBe(25);
	});

	it("chapter 6's worked example matches at least one animal", async () => {
		const d = await catalog();
		// `minHealth > 50` must not be a filter that quietly returns nothing.
		expect(d.animals.filter((a: any) => a.requirements.minHealth > 50).length).toBeGreaterThan(0);
	});
});

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

describe('the /learn section routes', () => {
	// One resource for the whole section, dispatching on getId(). The hub is the
	// EMPTY slug, which is the case that shape was chosen for; a resource per page
	// would have left /learn itself with nothing to serve.
	const learn = async (slug: string) => w.fetch<any>('learn', {}, slug);

	it('serves the hub at /learn', async () => {
		const res = await learn('');
		expect(res.status ?? 200).toBe(200);
		expect(String(res.body)).toContain('Learn to code with real game data');
	});

	it('serves both student pages under it', async () => {
		expect(String((await learn('web-development')).body)).toContain('Build with Wild Willows');
		expect(String((await learn('code-builder')).body)).toContain('Code Builder');
	});

	it('404s an unknown slug rather than serving the wrong lesson', async () => {
		// A typo'd link a teacher hands thirty students should say so plainly.
		const res = await learn('web-developement');
		expect(res.status).toBe(404);
	});
});

describe('the claims /learn/web-development makes about specific records', () => {
	// The chapters below do not just read fields — they are written around what
	// PARTICULAR records contain, and the teaching depends on the value. These are
	// the ones where a data change would not break the page, it would break the
	// lesson, silently, in a way only a teacher standing in the room would notice.

	it("chapter 7's if/else exercise actually reaches the other branch", async () => {
		// The exercise says: change data.animals[0] to data.animals[8] and see which
		// branch you get. It only teaches anything if the two indices land on
		// DIFFERENT sides of `rarity === "rare"`.
		//
		// It used to say animals[3]. That is the Porcupine, which is uncommon — the
		// same else branch as animals[0] — so a student followed the instruction,
		// watched nothing change, and had no way to tell whether they had done it
		// wrong. The numbers are printed in the lesson copy, so they get pinned.
		const d = await catalog();
		expect(d.animals[0].rarity).not.toBe('rare');
		expect(d.animals[8].rarity).toBe('rare');
		expect(d.animals[8].name).toBe('Black Bear');
	});

	it('chapter 6 opens on an animal that is NOT rare', async () => {
		// The chapter's whole first beat is running `if (rarity === "rare")` on
		// data.animals[0] and having NOTHING happen — "the code ran fine, the
		// condition was false" — before the student changes the value and watches
		// it fire. If animals[0] ever became rare, the example would print on the
		// first run and the lesson would lose the point it is built on.
		const first = (await catalog()).animals[0];
		expect(first.rarity).not.toBe('rare');
		expect(first.name).toBeTruthy();
	});

	it('chapter 3 can still point at a null and a true', async () => {
		// The six-type table cites `"unlock": null` on the meadow and
		// `"explorable": true` as its examples of null and boolean. There is no
		// other null in the catalog a beginner would meet this early.
		const d = await catalog();
		const meadow = d.biomes.find((b: any) => b.id === 'meadow');
		expect(meadow.unlock).toBeNull();
		expect(typeof meadow.explorable).toBe('boolean');
	});

	it("chapter 5's example paths all resolve", async () => {
		// The explorer ships five preset paths as buttons. A preset that returns
		// undefined would teach the wrong thing on the first click.
		const d = await catalog();
		expect(Array.isArray(d.animals)).toBe(true);
		expect(typeof d.animals[0]).toBe('object');
		expect(typeof d.biomes[2].name).toBe('string');
		expect(typeof d.animals[7].diet).toBe('string');
		expect(d.animals[999]).toBeUndefined(); // the deliberate one
	});

	it("chapter 7's .find() example finds the Red Fox, with a diet to print", async () => {
		const fox = (await catalog()).animals.find((a: any) => a.name === 'Red Fox');
		expect(fox, 'the .find() example names this animal literally').toBeTruthy();
		expect(typeof fox.diet).toBe('string');
		expect(typeof fox.fact).toBe('string');
	});

	it('chapter 9 challenge 5 has the 17 apex predators it promises', async () => {
		// The challenge text says "There are 17 of them", which is how a student
		// checks their own answer. A number in prose is a contract like any other.
		const apex = (await catalog()).animals.filter((a: any) => a.trophic === 'apex-predator');
		expect(apex.length).toBe(17);
	});

	it('the biome named in chapter 6\'s empty-state guard still does not exist', async () => {
		// The guard example filters for "tundra" ON PURPOSE, so the zero branch
		// runs and the student sees the empty-state message. If a tundra biome
		// ever shipped, that example would quietly start taking the other branch.
		const d = await catalog();
		expect(d.animals.some((a: any) => a.biome === 'tundra')).toBe(false);
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// The four books on the home bookshelf: src/ui/stories.ts lists them, the
// catalog holds their words, and src/ui/storyArt.tsx says which of the world's
// sprites each page's picture is drawn from — plus which book sprite is on each
// cover (src/game/sprites/books.ts).
//
// Nothing at runtime complains when those drift apart. A page of prose with no
// picture opens onto an empty frame; a picture pointing at a renamed sprite
// falls back to a leaf glyph; a caption pool one short leaves the last figure
// unlabelled. All of it quiet, in a menu reached by walking up to a piece of
// furniture — so check it statically instead.
//
// Read as source text rather than imported, for the reason achievement-art does
// it: the sprite modules pull in Phaser, and this is a question about the files.

const ROOT = resolve(__dirname, '../../');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));

const STORIES_SRC = read('src/ui/stories.ts');
const ART_SRC = read('src/ui/storyArt.tsx');
const BOOKS_SRC = read('src/game/sprites/books.ts');

/** Shelf order, as stories.ts declares it. */
const storyIds = [...(STORIES_SRC.match(/STORY_IDS = \[([^\]]+)\]/)?.[1] || '').matchAll(/'([\w-]+)'/g)].map(
	(m) => m[1],
);

/** `somewhere: 'book-habitat'` — one cover sprite per book. */
const covers = new Map(
	[
		...ART_SRC.slice(ART_SRC.indexOf('STORY_COVERS'), ART_SRC.indexOf('STORY_PAGES')).matchAll(/(\w+): '([\w-]+)'/g),
	].map((m) => [m[1], m[2]] as const),
);

/** Every page of every book, as storyArt.tsx declares it. */
const PAGES_SRC = ART_SRC.slice(ART_SRC.indexOf('STORY_PAGES'), ART_SRC.indexOf('export const pageCount'));
const books = [...PAGES_SRC.matchAll(/\n\t(\w+): \[([\s\S]*?)\n\t\],/g)].map(([, id, body]) => ({
	id,
	pages: [...body.matchAll(/\{\s*figures: \[([\s\S]*?)\],\s*joiners: \[([^\]]*)\],?([\s\S]*?)\n\t\t\}/g)].map(
		([, figs, joins, rest]) => ({
			objects: [...figs.matchAll(/\{ object: '([\w-]+)' \}/g)].map((m) => m[1]),
			animals: [...figs.matchAll(/\{ animal: '([\w-]+)', kind: '(\w+)' \}/g)].map((m) => [m[1], m[2]] as const),
			emblems: [...figs.matchAll(/\{ emblem: '([\w-]+)' \}/g)].map((m) => m[1]),
			figures: [...figs.matchAll(/\{ (?:object|animal|emblem): '[\w-]+'/g)].length,
			joiners: [...joins.matchAll(/'(plus|arrow)'/g)].length,
			sizes: [...(rest.match(/sizes: \[([^\]]*)\]/)?.[1] || '').matchAll(/[\d.]+/g)].length,
		}),
	),
}));

const animals = ['data/animals-1.json', 'data/animals-2.json'].flatMap(
	(f) => json(f).records as { id: string; kind: string }[],
);

/** Sprite keys as the object modules define them: plainly, or via pickable(). */
const objectSpriteKeys = () => {
	const dir = join(ROOT, 'src/game/sprites/objects');
	const keys = new Set<string>();
	for (const f of readdirSync(dir)) {
		const src = readFileSync(join(dir, f), 'utf8');
		for (const m of src.matchAll(/^\t([a-zA-Z0-9]+): def\(/gm)) keys.add(m[1]);
		for (const m of src.matchAll(/pickable\('([a-zA-Z0-9]+)'/g)) keys.add(m[1]);
	}
	return keys;
};

const emblemKeys = () =>
	new Set([...read('src/game/sprites/emblems.ts').matchAll(/^\t'?([\w-]+)'?: def\(/gm)].map((m) => m[1]));
const bookKeys = () => new Set([...BOOKS_SRC.matchAll(/^\t'([\w-]+)': storyBook\(/gm)].map((m) => m[1]));

/** Sorting ids for comparison — an explicit comparator, never the default. */
const byId = (a: string, b: string) => a.localeCompare(b);

const LOCALES = ['en', 'es'] as const;
const catalog = (locale: string) => json(`src/i18n/${locale}/narrative.json`).stories as Record<string, any>;

describe('bookshelf stories', () => {
	it('has four books, and pages for each', () => {
		expect(storyIds).toHaveLength(4);
		expect(books.map((b) => b.id).sort(byId)).toEqual([...storyIds].sort(byId));
		for (const b of books) expect(b.pages.length, `${b.id} has no pages`).toBeGreaterThan(1);
	});

	it('gives every book its own cover sprite', () => {
		const drawn = bookKeys();
		expect([...covers.keys()].sort(byId)).toEqual([...storyIds].sort(byId));
		for (const [id, sprite] of covers) expect(drawn.has(sprite), `${id} → no sprite '${sprite}'`).toBe(true);
		// A shelf of four identical spines is no shelf.
		expect(new Set(covers.values()).size, 'two books share a cover').toBe(covers.size);
	});

	it('joins every picture with exactly one joiner per gap', () => {
		for (const b of books) {
			b.pages.forEach((p, i) => {
				expect(p.figures, `${b.id} p${i + 1}: a picture needs at least two figures`).toBeGreaterThan(1);
				expect(p.joiners, `${b.id} p${i + 1}: ${p.figures} figures need ${p.figures - 1} joiners`).toBe(p.figures - 1);
				// `sizes` is optional, but a partial one would silently size the wrong figures.
				expect(
					p.sizes === 0 || p.sizes === p.figures,
					`${b.id} p${i + 1}: ${p.sizes} sizes for ${p.figures} figures`,
				).toBe(true);
			});
		}
	});

	it('draws every picture from sprites the world actually has', () => {
		const objects = objectSpriteKeys();
		const emblems = emblemKeys();
		for (const b of books) {
			b.pages.forEach((p, i) => {
				const where = `${b.id} p${i + 1}`;
				for (const shape of p.objects) expect(objects.has(shape), `${where} → unknown object '${shape}'`).toBe(true);
				for (const e of p.emblems) expect(emblems.has(e), `${where} → unknown emblem '${e}'`).toBe(true);
				for (const [id, kind] of p.animals) {
					const animal = animals.find((a) => a.id === id);
					expect(animal, `${where} → unknown animal '${id}'`).toBeTruthy();
					expect(animal?.kind, `${where} → '${id}' is a ${animal?.kind}, not a ${kind}`).toBe(kind);
				}
			});
		}
	});

	for (const locale of LOCALES) {
		it(`gives every book a title, a subject and every page its text in ${locale}`, () => {
			const cat = catalog(locale);
			for (const b of books) {
				const s = cat[b.id];
				expect(s, `${locale}: no narrative.stories.${b.id}`).toBeTruthy();
				for (const field of ['title', 'byline'] as const) {
					expect(typeof s[field], `${locale}/${b.id}.${field}`).toBe('string');
					expect(s[field].trim().length, `${locale}/${b.id}.${field} is empty`).toBeGreaterThan(0);
				}
				expect(Object.keys(s.pages).length, `${locale}/${b.id}: pages`).toBe(b.pages.length);
				for (let i = 1; i <= b.pages.length; i++) {
					const page = s.pages[String(i)];
					expect(page, `${locale}/${b.id}: no page ${i}`).toBeTruthy();
					for (const field of ['title', 'text'] as const) {
						expect(page[field]?.trim().length, `${locale}/${b.id} p${i}.${field}`).toBeGreaterThan(0);
					}
				}
			}
		});

		it(`captions every figure of every picture in ${locale}`, () => {
			const cat = catalog(locale);
			for (const b of books) {
				b.pages.forEach((p, i) => {
					const captions = cat[b.id]?.pages?.[String(i + 1)]?.figures;
					expect(Array.isArray(captions), `${locale}/${b.id} p${i + 1}: figures should be a pool`).toBe(true);
					expect(
						captions.length,
						`${locale}/${b.id} p${i + 1}: ${p.figures} figures, ${captions.length} captions`,
					).toBe(p.figures);
					for (const c of captions)
						expect(c.trim().length, `${locale}/${b.id} p${i + 1}: empty caption`).toBeGreaterThan(0);
				});
			}
		});
	}

	it('names the panel and its pager in every locale', () => {
		for (const locale of LOCALES) {
			const panel = json(`src/i18n/${locale}/panels.json`).stories;
			for (const key of ['title', 'intro', 'back', 'prev', 'next', 'page']) {
				expect(panel?.[key], `${locale}: panels.stories.${key}`).toBeTruthy();
			}
			expect(panel.page, `${locale}: the page counter needs both numbers`).toContain('{n}');
			expect(panel.page, `${locale}: the page counter needs both numbers`).toContain('{total}');
		}
	});
});

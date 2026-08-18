import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The lesson page's own behaviour — /learn/web-development.
//
// Like ww-runner.test.ts, the source is evaluated the way a browser evaluates
// it and the assertions run against the API it publishes on window. Testing a
// re-implementation would test the re-implementation.
//
// The path explorer in chapter 5 is the reason most of this file exists. It
// takes TEXT A STUDENT TYPED and walks it across our data, and the obvious way
// to build that — hand it to eval — would put arbitrary execution behind an
// input box on a page written for schools. It parses instead, which is both
// safer and better teaching: a parser can say WHICH step failed, and eval can
// only say that something did.

let L: any;
let doc: Document;

beforeAll(() => {
	const src = readFileSync(join(process.cwd(), 'public/partials/ww-lesson.js'), 'utf8');
	doc = document;
	doc.body.innerHTML = '';
	new Function(src)();
	L = (window as any).WwLesson;
	expect(L, 'ww-lesson.js should publish its API on window').toBeTruthy();
});

describe('the chapter 5 path explorer', () => {
	const steps = (text: string) => L.parsePath(text).steps;

	it('reads dotted property access', () => {
		expect(steps('data.animals')).toEqual(['animals']);
		expect(steps('data.biomes[2].name')).toEqual(['biomes', 2, 'name']);
	});

	it('reads numeric and quoted index access', () => {
		expect(steps('data.animals[0]')).toEqual(['animals', 0]);
		expect(steps("data['animals'][0].name")).toEqual(['animals', 0, 'name']);
		expect(steps('data["animals"]')).toEqual(['animals']);
	});

	it('tolerates whitespace the way a student types it', () => {
		expect(steps('  data.animals[ 3 ].name  ')).toEqual(['animals', 3, 'name']);
	});

	it('insists the path starts at data', () => {
		// Not pedantry: `animals[0]` walked against the root would silently return
		// undefined, and "nothing there" is the wrong answer to "you named the
		// wrong thing".
		expect(L.parsePath('animals[0]').error).toMatch(/start the path with/i);
		expect(L.parsePath('window.location').error).toBeTruthy();
	});

	it('says which part it could not read, rather than just failing', () => {
		const e = L.parsePath('data.animals(0)').error;
		expect(e).toMatch(/could not read/i);
		expect(e).toContain('(0)');
	});

	it('never executes anything it is handed', () => {
		// The whole point. Each of these parses to an error or to plain steps; none
		// of them can run, because nothing here is ever evaluated as code.
		(globalThis as any).__pwned = false;
		for (const attack of [
			'data.x; globalThis.__pwned = true',
			'data[(globalThis.__pwned = true)]',
			'data.constructor.constructor("globalThis.__pwned = true")()',
		]) {
			const r = L.parsePath(attack);
			if (r.steps) L.walk({ x: 1 }, r.steps);
		}
		expect((globalThis as any).__pwned).toBe(false);
	});

	it('walks a real shape and stops cleanly where it runs out', () => {
		const data = { animals: [{ name: 'Banana Slug', eats: ['leaves'] }] };
		expect(L.walk(data, ['animals', 0, 'name']).value).toBe('Banana Slug');
		expect(L.walk(data, ['animals', 0, 'eats', 0]).value).toBe('leaves');
		// Past the end is undefined — the chapter teaches this deliberately.
		expect(L.walk(data, ['animals', 999]).value).toBeUndefined();
		// Reaching INTO something missing is a different answer: the walk reports
		// which step it died at so the page can name it.
		expect(L.walk(data, ['animals', 999, 'name']).missing).toBe(true);
		expect(L.walk(data, ['animals', 999, 'name']).at).toBe(2);
	});
});

describe('naming the type of a value', () => {
	// Chapter 3 puts six types in a table; chapter 5's explorer says which one
	// came back. If these two disagree the table becomes decoration.
	it('distinguishes array from object, which typeof does not', () => {
		expect(L.typeOf([])).toBe('array');
		expect(L.typeOf({})).toBe('object');
		expect(L.typeOf(null)).toBe('null'); // nor this
	});

	it('describes each type in the words the chapter uses', () => {
		expect(L.describe(new Array(150))).toBe('an array of 150 things');
		expect(L.describe(['one'])).toBe('an array of 1 thing');
		expect(L.describe({ a: 1, b: 2 })).toBe('an object with 2 parts');
		expect(L.describe({ a: 1 })).toBe('an object with 1 part');
		expect(L.describe('Red Fox')).toBe('a string');
		expect(L.describe(35)).toBe('a number');
		expect(L.describe(true)).toBe('a boolean');
		expect(L.describe(null)).toMatch(/nothing, on purpose/);
		expect(L.describe(undefined)).toMatch(/there is nothing here/);
	});

	it('quotes strings and only strings, and truncates a long one', () => {
		expect(L.literal('Red Fox')).toBe('"Red Fox"');
		expect(L.literal(35)).toBe('35');
		expect(L.literal(true)).toBe('true');
		expect(L.literal(null)).toBe('null');
		// `fact` and `role` on an animal run to several hundred characters; a tree
		// row is one line, and a row that wraps for a paragraph is not a tree.
		const long = L.literal('x'.repeat(300));
		expect(long.length).toBeLessThan(120);
		expect(long).toContain('…');
	});
});

describe('dwell buckets', () => {
	// Bucketed, never a raw duration — the same promise as the builder's session
	// length. A precise per-chapter time is a behavioural trace of one reader.
	it('ignores a chapter that was only scrolled past', () => {
		expect(L.dwellBand(0)).toBeNull();
		expect(L.dwellBand(9_000)).toBeNull();
	});

	it('bands the rest', () => {
		expect(L.dwellBand(30_000)).toBe('lt1m');
		expect(L.dwellBand(90_000)).toBe('1to3m');
		expect(L.dwellBand(5 * 60_000)).toBe('3to10m');
		expect(L.dwellBand(45 * 60_000)).toBe('gt10m');
	});

	it('only ever emits names the server will accept', () => {
		// server/resources.ts: /^dwell_chapter-[1-9]_(lt1m|1to3m|3to10m|gt10m)$/
		const allowed = /^(lt1m|1to3m|3to10m|gt10m)$/;
		for (const ms of [10_000, 59_999, 60_000, 179_999, 600_000, 9e6])
			expect(allowed.test(L.dwellBand(ms)), String(ms)).toBe(true);
	});
});

describe('what the page promises about student code', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-lesson.js'), 'utf8');

	it('carries chapter 9 into the builder in the URL fragment, not the query', () => {
		// A fragment is not sent to the server. PRIVACY.md says a student's code
		// never leaves their browser, and a `?start=` would make that false the
		// moment they clicked through.
		expect(SRC).toContain("'/learn/code-builder#start='");
		expect(SRC).not.toMatch(/code-builder\?start=/);
	});

	it('reports counters and nothing else', () => {
		// The beacon body is built in exactly one place; this is the shape.
		const m = /JSON\.stringify\(\{ page: '(\w+)', counts: (\w+) \}\)/.exec(SRC);
		expect(m, 'the lesson beacon should post {page, counts}').toBeTruthy();
		expect(m![1]).toBe('lesson');
	});

	it('does not keep a batch after sending it', () => {
		// THE BUILDER'S BUG, which this file was written after fixing. Holding the
		// batch behind a latch meant the periodic timer re-sent everything a
		// student had done before their first tab switch. Emptying on send is what
		// makes that impossible, so it is asserted rather than trusted.
		expect(SRC).toMatch(/var batch = counts;\s*\n\s*counts = \{\};/);
		expect(SRC).not.toMatch(/if \(sent\) return/);
	});
});

describe('the Going Deeper panel', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-lesson.js'), 'utf8');
	const RUNNER = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	it('the runner leaves deferred hosts alone at boot', () => {
		// The whole mechanism. If init() ever goes back to querying every
		// ww-runner, the panel silently costs twelve iframes on load again and
		// nothing anywhere would fail.
		expect(RUNNER).toContain("querySelectorAll('ww-runner:not([defer])')");
		expect(RUNNER).toContain('mount: mount');
	});

	it('mounting the same host twice is a no-op', () => {
		// Opening, closing and reopening the panel must not build a second copy of
		// every editor inside it.
		expect(RUNNER).toMatch(/function mount\(host\) \{\s*\n\s*if \(!host \|\| host\.dataset\.wwReady\) return;/);
	});

	it('each panel mounts its own runners on open, once', () => {
		expect(SRC).toContain("$$('details.deeper')");
		expect(SRC).toContain("$$('ww-runner[defer]', panel)");
		expect(SRC).toContain("host.removeAttribute('defer')");
		expect(SRC).toMatch(/if \(started\) return;\s*\n\s*started = true;/);
		// `started` is per panel, inside the forEach, not one flag for the page.
		// One shared flag would mean opening chapter 2 marked chapter 8 as done
		// and its editors never appeared.
		const body = /function initDeeper\(\)[\s\S]*?\n\t\}/.exec(SRC)![0];
		expect(body.indexOf('var started = false')).toBeGreaterThan(body.indexOf('forEach'));
	});

	it('counts the open and which chapter it was', () => {
		// `deeper_opened` sits outside the `started` guard on purpose: how often a
		// student comes back is a different question from whether it was ever
		// built. `deeper_chapter-N` is the one that decides where the next piece of
		// writing should go.
		const body = /function initDeeper\(\)[\s\S]*?\n\t\}/.exec(SRC)![0];
		expect(body.indexOf("bump('deeper_opened')")).toBeLessThan(body.indexOf('if (started) return'));
		expect(body).toContain("bump('deeper_' + which)");
	});

	it('emits only counter names the server will accept', () => {
		// server/resources.ts: 'deeper_opened' exactly, plus /^deeper_[a-z][a-z0-9-]{0,23}$/
		// for the per-topic keys, which ride on the data-concept attributes.
		const page = readFileSync(join(process.cwd(), 'public/learn-web-development.html'), 'utf8');
		const concepts = [...page.matchAll(/data-concept="(deeper_[^"]+)"/g)].map((m) => m[1]);
		expect(concepts.length).toBeGreaterThanOrEqual(5);
		for (const key of concepts) expect(key, key).toMatch(/^deeper_[a-z][a-z0-9-]{0,23}$/);
		expect(new Set(concepts).size, 'every topic needs its own key').toBe(concepts.length);
		// The per-panel keys are built as 'deeper_' + the data-deeper attribute, so
		// they have to clear the same pattern. `deeper_chapter-10` is the longest.
		const panels = [...page.matchAll(/data-deeper="([^"]+)"/g)].map((m) => 'deeper_' + m[1]);
		expect(panels).toHaveLength(10);
		for (const key of panels) expect(key, key).toMatch(/^deeper_[a-z][a-z0-9-]{0,23}$/);
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The project ideas the Code Builder offers, and the brief it shows once one is
// picked.
//
// WHY THE BRIEF EXISTS. The wall of cards is a menu, so each card gets ONE
// sentence — a paragraph on thirty cards is a wall nobody reads. But a sentence
// is what gets an idea chosen, not what gets it started: "show every animal
// whose kind is invertebrate" left a student looking at three files with nowhere
// to put their hands. The brief panel only ever shows the one idea they picked
// and stays on screen for the rest of the period, so it is where the detail
// belongs: three first moves and a finish line.
//
// This asserts the shape of that data, because a half-filled idea degrades
// silently — the panel renders, it is just useless again.

const SRC = readFileSync(resolve(__dirname, '../../public/partials/ww-builder.js'), 'utf8');

type Idea = { id: string; level: string; uses: string[]; title: string; what: string; data: string; steps: string[]; done: string };

const IDEAS: Idea[] = (() => {
	const m = /\tvar IDEAS = \[([\s\S]*?)\n\t\];/.exec(SRC);
	expect(m, 'the IDEAS array should be findable in ww-builder.js').toBeTruthy();
	// The array is plain data: object literals of strings and string arrays.
	return new Function(`return [${m![1]}]`)() as Idea[];
})();

const LEVELS = ['easy', 'medium', 'ambitious'];
const METHODS = ['filter', 'map', 'sort', 'reduce', 'if'];

describe('the ideas pool', () => {
	it('offers thirty, evenly across the three levels', () => {
		// Three pages say "thirty project ideas" in prose. They said it when there
		// were twenty-nine.
		expect(IDEAS).toHaveLength(30);
		for (const level of LEVELS) expect(IDEAS.filter((i) => i.level === level), level).toHaveLength(10);
	});

	it('has no duplicate ids, because the counter is keyed on them', () => {
		// A repeat would merge two ideas into one number on the dashboard, and the
		// `idea_<id>` key is allowlisted server-side by pattern rather than by name.
		expect(new Set(IDEAS.map((i) => i.id)).size).toBe(IDEAS.length);
		for (const i of IDEAS) expect(i.id, i.id).toMatch(/^[a-z][a-z0-9-]{0,23}$/);
	});

	it('names only levels and methods the interface can filter on', () => {
		for (const i of IDEAS) {
			expect(LEVELS, i.id).toContain(i.level);
			expect(i.uses.length, i.id).toBeGreaterThan(0);
			for (const u of i.uses) expect(METHODS, `${i.id} uses ${u}`).toContain(u);
		}
	});

	it('keeps the card line to one sentence', () => {
		// The card is a menu entry. The moment it needs a paragraph it is an
		// assignment, and students stop reading the wall.
		for (const i of IDEAS) {
			expect(i.what.length, `${i.id} is too long for a card`).toBeLessThanOrEqual(90);
			expect(i.what.trim(), i.id).toMatch(/[.!?]$/);
		}
	});
});

describe('the brief behind each idea', () => {
	it('gives three first moves, and they are moves rather than labels', () => {
		for (const i of IDEAS) {
			expect(i.steps, `${i.id} steps`).toHaveLength(3);
			for (const s of i.steps) {
				expect(s.length, `${i.id}: "${s}" is too short to act on`).toBeGreaterThan(25);
				expect(s.trim(), `${i.id}: "${s}"`).toMatch(/[.!?]$/);
			}
		}
	});

	it('says how a student knows they are finished', () => {
		// Without this a student who has done the work keeps fiddling, because
		// nothing told them the work was done.
		for (const i of IDEAS) {
			expect(i.done, `${i.id} done`).toBeTruthy();
			expect(i.done.length, i.id).toBeGreaterThan(25);
			expect(i.done.trim(), i.id).toMatch(/[.!?]$/);
		}
	});

	it('names the data it needs, in the path form the lesson uses', () => {
		for (const i of IDEAS) expect(i.data, i.id).toMatch(/^(animals|biomes)\[\]\./);
	});

	it('never asks for browser storage, which the preview cannot give it', () => {
		// The preview iframe is sandbox="allow-scripts" WITHOUT allow-same-origin,
		// so it runs on an opaque origin and touching localStorage throws a
		// SecurityError before any of the student's own code is at fault. One idea
		// used to ask for exactly that: "a list of favorites that survives a
		// refresh". Verified in a real sandboxed frame, not assumed.
		const text = IDEAS.map((i) => [i.what, i.done, ...i.steps].join(' ')).join(' ');
		expect(text).not.toMatch(/localStorage|sessionStorage|survives a refresh/i);
	});
});

describe('the brief panel renders all of it', () => {
	const PAGE = readFileSync(resolve(__dirname, '../../public/learn-code-builder.html'), 'utf8');

	it('has somewhere to put every field', () => {
		for (const id of ['lab-brief-title', 'lab-brief-what', 'lab-brief-tags', 'lab-brief-steps', 'lab-brief-done', 'lab-brief-data'])
			expect(PAGE, id).toContain(`id="${id}"`);
	});

	it('empties each region before refilling it', () => {
		// "Pick another" reuses the same panel. Appending instead of replacing gives
		// the second idea six steps, three of which belong to a project the student
		// abandoned.
		expect(SRC).toContain("tags.textContent = '';");
		expect(SRC).toContain("list.textContent = '';");
	});

	it('builds the steps as elements rather than as a string of HTML', () => {
		// Several steps talk about elements and tags. A brief assembled with `+`
		// breaks the first time one of them contains an angle bracket.
		expect(SRC).toContain("list.appendChild(el('li', '', steps[i]))");
		expect(SRC).not.toMatch(/lab-brief-steps'\)[\s\S]{0,120}innerHTML/);
	});

	it('writes the methods the way the lesson writes them', () => {
		expect(SRC).toMatch(/METHOD_LABEL = \{[^}]*filter: '\.filter\(\)'/);
		expect(SRC).toMatch(/METHOD_LABEL = \{[^}]*if: 'if \/ else'/);
	});
});


describe('"Show me" reveals the answer, it does not apply it', () => {
	// IT USED TO OVERWRITE THEIR FILES, behind a confirm() and a one-shot undo.
	// Two things wrong with that: a student pressing it is usually stuck and wants
	// to LOOK, and the price of looking was their own work; and once it had been
	// applied there was nothing left to compare against, so the thing they were
	// stuck on had gone off the screen. It reveals the code beside theirs now,
	// with a Copy button.
	const PAGE = readFileSync(resolve(__dirname, '../../public/learn-code-builder.html'), 'utf8');
	const CSS = readFileSync(resolve(__dirname, '../../public/partials/ww-builder.css'), 'utf8');

	it('never writes to the editor and never confirms', () => {
		const handler = /var show = el\('button', 'cp-show'[\s\S]*?main\.appendChild\(codeBox\);/.exec(SRC);
		expect(handler, 'the Show me block should be findable').toBeTruthy();
		expect(handler![0]).not.toContain('runner.wwSet');
		expect(handler![0]).not.toContain('window.confirm');
	});

	it('and does not tick the checkpoint off either', () => {
		// Looking is not finishing. Ticking it was the old behaviour's way of
		// saying "this one is handled", which it was not.
		const handler = /show\.addEventListener\('click'[\s\S]*?\n\t\t\t\t\}\);/.exec(SRC);
		expect(handler).toBeTruthy();
		expect(handler![0]).not.toContain('doneSet[cp.id] = true');
	});

	it('starts hidden and is announced as a disclosure', () => {
		expect(SRC).toContain('codeBox.hidden = true;');
		expect(SRC).toContain("show.setAttribute('aria-expanded', 'false')");
		expect(SRC).toContain("show.setAttribute('aria-expanded', open ? 'true' : 'false')");
	});

	it('is not remembered between sessions', () => {
		// A revealed answer is a moment, not a preference. Coming back next period
		// to six open answers is not where anyone wants to start.
		expect(SRC).toMatch(/var openHints = \{\};/);
		expect(SRC).not.toMatch(/ui\.openHints/);
	});

	it('offers a Copy per file, with two fallbacks under it', () => {
		// The async clipboard needs a secure context and a permission a managed
		// school profile can refuse. Then execCommand on a selection, which needs
		// neither. Then the text stays highlighted and we name the two keys.
		expect(SRC).toContain("var copy = el('button', 'cp-copy', 'Copy');");
		expect(SRC).toContain('navigator.clipboard.writeText');
		expect(SRC).toContain("document.execCommand('copy')");
		expect(SRC).toMatch(/COPY_KEYS = .*'Cmd\+C' : 'Ctrl\+C'/);
	});

	it('gives the answer room to be read', () => {
		// 280px turns `await fetch("https://wildwillows.app/GameData/")` into four
		// wrapped lines that stop looking like code. The column widens only while
		// something is showing.
		expect(CSS).toMatch(/body\.lab\.hint-open \{\s*\n\s*--lab-side-w: \d+px;/);
		expect(SRC).toContain("document.body.classList.toggle('hint-open'");
	});

	it('the page still ships the checkpoint list it renders into', () => {
		expect(PAGE).toContain('id="lab-checkpoints"');
	});
});

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// <ww-runner> — the shared editor/preview component behind both classroom
// student pages (/learn/web-development, /learn/code-builder).
//
// It ships inlined into those pages by scripts/build-pages.mjs rather than as a
// module, so there is nothing to import: the source is evaluated here the same
// way a browser evaluates it, and the assertions run against the API it
// publishes on window. That is deliberate — testing a copy would test the copy.
//
// What matters most here is the assembler. Everything a student ever runs, in
// every example on both pages AND in the file they download at the end, goes
// through assembleDocument(). A bug in it is a bug in all of them at once.

let R: any;

/**
 * The document the runner most recently rendered.
 *
 * NOT simply the first iframe. The runner double-buffers: it renders into the
 * hidden frame and swaps on load, so on the very first run the frame carrying
 * the content is the second one. Reading `querySelector('iframe')` got the empty
 * one and every assertion below silently had nothing to look at.
 */
const renderedDoc = (): string => {
	const frames = [...document.querySelectorAll('iframe.wwr-preview')] as HTMLIFrameElement[];
	const withDoc = frames.map((f) => f.srcdoc).filter(Boolean);
	expect(withDoc.length, 'the runner should have rendered into one of its buffers').toBeGreaterThan(0);
	return withDoc[withDoc.length - 1];
};

beforeAll(() => {
	const src = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	// jsdom gives us a real document; the IIFE finds no <ww-runner> elements and
	// simply publishes its API.
	new Function(src)();
	R = (window as any).WwRunner;
});

describe('assembleDocument', () => {
	it('folds three files into one runnable document', () => {
		const out = R.assembleDocument('<h1>Hi</h1>', 'h1{color:red}', 'console.log(1)');
		expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
		expect(out).toContain('<h1>Hi</h1>');
		expect(out).toContain('h1{color:red}');
		expect(out).toContain('console.log(1)');
		// One script block, not two: a stray extra would swallow the student's code.
		expect(out.match(/<script>/g)?.length).toBe(1);
	});

	it('escapes </script> inside student JavaScript', () => {
		// The real case, and it is not exotic: chapter 8 has students build HTML
		// with template literals, and the moment one contains a closing script tag
		// the HTML parser ends the block THERE. The rest of their code renders as
		// visible text, nothing throws, and it looks like the editor ate it.
		const out = R.assembleDocument('', '', 'const s = "</script><b>oops</b>";');
		expect(out).not.toContain('</script><b>');
		expect(out).toContain('<\\/script>');
	});

	it('escapes </script> regardless of case', () => {
		expect(R.assembleDocument('', '', 'x = "</SCRIPT>";')).toContain('<\\/SCRIPT>');
	});

	it('escapes </style> inside student CSS', () => {
		expect(R.assembleDocument('', '/* </style> */', '')).toContain('<\\/style>');
	});

	it('survives empty and missing sources', () => {
		expect(R.assembleDocument('', '', '')).toMatch(/<html lang="en">[\s\S]*<\/html>/);
		expect(R.assembleDocument(null, undefined, null).startsWith('<!DOCTYPE html>')).toBe(true);
	});

	it('produces a document a parser accepts', () => {
		const out = R.assembleDocument('<p id="x">hi</p>', 'p{margin:0}', 'document.title = "t";');
		const parsed = new DOMParser().parseFromString(out, 'text/html');
		expect(parsed.querySelector('#x')?.textContent).toBe('hi');
		expect(parsed.querySelectorAll('script').length).toBe(1);
	});
});

describe('dedent', () => {
	it('strips the page indentation but keeps the code shape', () => {
		// Starter code sits indented inside the page source; students must not
		// inherit that indentation, but the code's OWN nesting has to survive.
		const src = '\n      const a = 1;\n        const b = 2;\n      const c = 3;\n   ';
		expect(R.dedent(src)).toBe('const a = 1;\n  const b = 2;\nconst c = 3;');
	});

	it('leaves already-flush code alone', () => {
		expect(R.dedent('const a = 1;\nconst b = 2;')).toBe('const a = 1;\nconst b = 2;');
	});
});

describe('explain — the beginner error catalogue', () => {
	// Order matters in the matcher (several of these substrings overlap), so this
	// pins the mapping rather than just the presence of an entry.
	const cases: Array<[string, string]> = [
		["TypeError: Cannot read properties of null (reading 'textContent')", 'null-property'],
		["TypeError: Cannot read properties of undefined (reading 'name')", 'undefined-property'],
		['ReferenceError: animal is not defined', 'not-defined'],
		['TypeError: data.animals.filte is not a function', 'not-a-function'],
		['TypeError: Failed to fetch', 'fetch-failed'],
		['SyntaxError: Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON', 'json-parse'],
		['SyntaxError: Unexpected end of input', 'unexpected-eof'],
		['SyntaxError: await is only valid in async functions', 'await-async'],
		['TypeError: Assignment to constant variable.', 'const-assign'],
		['TypeError: data.animals is not iterable', 'not-iterable'],
		['SyntaxError: Unexpected identifier', 'syntax'],
	];

	it.each(cases)('maps %s', (message, key) => {
		expect(R.explain(message).key).toBe(key);
	});

	it('always offers something to check, not just what broke', () => {
		for (const [message] of cases) {
			const e = R.explain(message);
			expect(e.title.length).toBeGreaterThan(0);
			// A one-liner restating the error would be no better than the console.
			expect(e.help.length).toBeGreaterThan(40);
		}
	});

	it('falls back usefully on an error it has never seen', () => {
		const e = R.explain('RangeError: Maximum call stack size exceeded');
		expect(e.key).toBe('other');
		expect(e.help.length).toBeGreaterThan(0);
	});

	it('never matches a null-property error as the undefined one, or vice versa', () => {
		// These two differ by one word and mean different things to a student:
		// null is "your element isn't on the page", undefined is "that field isn't
		// in the data". Getting them the wrong way round sends them hunting in the
		// wrong file.
		expect(R.explain("Cannot read properties of null (reading 'x')").key).toBe('null-property');
		expect(R.explain("Cannot read properties of undefined (reading 'x')").key).toBe('undefined-property');
	});
});

describe('the element itself', () => {
	const mount = (inner: string) => {
		document.body.innerHTML = `<ww-runner>${inner}</ww-runner>`;
		const host = document.querySelector('ww-runner') as any;
		new Function(readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8'))();
		return host;
	};

	it('builds an editor and a sandboxed preview from its starter files', () => {
		const host = mount(
			'<script type="text/ww-file" name="index.html">&lt;h1&gt;Hi&lt;/h1&gt;</script>' +
				'<script type="text/ww-file" name="main.js">console.log(1)</script>',
		);
		expect(host.querySelectorAll('textarea.wwr-code').length).toBe(2);
		const frame = host.querySelector('iframe.wwr-preview') as HTMLIFrameElement;
		// The security property the whole design rests on: scripts may run, but the
		// frame gets an opaque origin and cannot reach this page. If allow-same-origin
		// ever appears here, student code can touch the lesson page.
		expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
	});

	it('exposes the sources it is currently running', () => {
		const host = mount('<script type="text/ww-file" name="main.js">const a = 1;</script>');
		expect(host.wwGet().js).toBe('const a = 1;');
	});

	it('hides the tab strip when there is only one file', () => {
		const host = mount('<script type="text/ww-file" name="main.js">x</script>');
		expect((host.querySelector('.wwr-tabs') as HTMLElement).hidden).toBe(true);
	});
});

describe('the preview, and why it stopped flickering', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	const CSS = readFileSync(join(process.cwd(), 'public/partials/ww-runner.css'), 'utf8');

	const mount = (inner: string) => {
		document.body.innerHTML = `<ww-runner console>${inner}</ww-runner>`;
		const host = document.querySelector('ww-runner') as any;
		new Function(SRC)();
		return host;
	};

	it('double-buffers the preview', () => {
		// One iframe meant reassigning srcdoc on every debounce, and the frame
		// paints white while it rebuilds — a visible flash every time a student
		// paused typing. Two frames, swapped on load, means they keep looking at
		// the last good render until the next one is ready.
		const host = mount('<script type="text/ww-file" name="main.js">x</script>');
		const frames = host.querySelectorAll('iframe.wwr-preview');
		expect(frames).toHaveLength(2);
		expect(host.querySelectorAll('iframe.is-live')).toHaveLength(1);
	});

	it('retires the frame it swaps away from', () => {
		// Otherwise a student's setInterval keeps running in a hidden document,
		// once more per render, forever.
		expect(SRC).toContain("old.srcdoc = ''");
	});

	it('does not re-run when nothing changed', () => {
		expect(SRC).toContain("if (doc === lastDoc && how !== 'manual') return;");
	});

	it('always honours an explicit Run', () => {
		// "I pressed Run and nothing happened" is worse than a redundant render.
		expect(/how !== 'manual'/.test(SRC)).toBe(true);
	});

	it('keeps both buffers stacked so a swap cannot reflow', () => {
		expect(CSS).toMatch(/\.wwr-preview\s*\{[^}]*position:\s*absolute/);
		expect(CSS).toMatch(/\.wwr-preview\.is-live\s*\{[^}]*opacity:\s*1/);
	});
});

describe('the console, and why it stopped hanging', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	it('caps how much one log can send', () => {
		// Chapter 4 says console.log(data). That is ~300 KB of JSON, which
		// pretty-printed is ~600 KB of string, posted across a message channel and
		// written into the DOM. The browser sat there doing that instead of
		// painting, which reads as "the console is broken".
		expect(SRC).toContain('MAX_CHARS = 2000');
		expect(SRC).toContain('MAX_LINES = 200');
	});

	it('summarises long arrays instead of serialising all of them', () => {
		// 150 animal records is the normal case. "Array(150) [first three…]" is
		// both faster and a better answer than 150 pretty-printed objects.
		expect(SRC).toContain('Array.isArray(v) && v.length > 8');
	});

	it('caps what the DOM has to hold as well', () => {
		expect(SRC).toContain('consoleCount > 250');
	});

	it('accepts messages from both buffers', () => {
		// The incoming render starts logging before it has been swapped in.
		// Listening only to the live frame drops the first console line and any
		// error thrown during load — which is most of them.
		expect(SRC).toContain('frames[0].contentWindow');
		expect(SRC).toContain('frames[1].contentWindow');
	});
});

describe('view modes', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	const CSS = readFileSync(join(process.cwd(), 'public/partials/ww-runner.css'), 'utf8');

	/* This example has to RENDER something, or there is nothing to switch to: a
	 * JavaScript-only runner is console-only by definition and ships without a
	 * switcher at all (see the describe below). The context file is what makes
	 * this one a page rather than a script. */
	const mount = () => {
		document.body.innerHTML =
			'<ww-runner console>' +
			'<script type="text/ww-file" name="index.html" context><p id="x">hi</p></script>' +
			'<script type="text/ww-file" name="main.js">x</script></ww-runner>';
		const host = document.querySelector('ww-runner') as any;
		new Function(SRC)();
		return host;
	};

	it('offers split, code and page, and starts on split', () => {
		const host = mount();
		const buttons = host.querySelectorAll('.wwr-view');
		expect(buttons).toHaveLength(3);
		expect(host.classList.contains('wwr--view-split')).toBe(true);
		expect(host.querySelectorAll('.wwr-view.is-on')).toHaveLength(1);
	});

	it('switches, and says so to assistive tech', () => {
		const host = mount();
		const code = [...host.querySelectorAll('.wwr-view')].find(
			(b: any) => b.getAttribute('aria-label') === 'Show code',
		) as HTMLButtonElement;
		expect(code).toBeTruthy();
		code.click();
		expect(host.classList.contains('wwr--view-code')).toBe(true);
		expect(host.classList.contains('wwr--view-split')).toBe(false);
		expect(code.getAttribute('aria-pressed')).toBe('true');
	});

	it('hides the other half in each single view', () => {
		expect(CSS).toContain('.wwr--view-code .wwr-out');
		expect(CSS).toContain('.wwr--view-preview .wwr-panes');
	});

	it('opens the page in a tab as a standalone blob, without the harness', () => {
		// A blob: URL gives the new tab a real origin, so fetch behaves exactly as
		// it will in the file the student downloads. srcdoc would not.
		expect(SRC).toContain('function standaloneDoc()');
		expect(SRC).toContain('new Blob([standaloneDoc()]');
		expect(SRC).toMatch(/standaloneDoc[\s\S]{0,200}assembleDocument\(src\.html, src\.css, src\.js\)/);
	});
});

describe('the height chain', () => {
	const CSS = readFileSync(join(process.cwd(), 'public/partials/ww-runner.css'), 'utf8');

	it('pins every level so the editor scrolls instead of growing', () => {
		// The gutter is `white-space: pre` with one line per row, so its intrinsic
		// height IS the length of the file. Grid and flex children default to
		// min-height:auto, so that height was free to push every ancestor open —
		// which is how the console ended up stranded in the middle of the editor.
		expect(CSS).toMatch(/\.wwr-body\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/);
		expect(CSS).toMatch(/\.wwr-panes\s*\{[^}]*min-height:\s*0/);
		expect(CSS).toMatch(/\.wwr-editor\s*\{[^}]*min-height:\s*0/);
		expect(CSS).toMatch(/\.wwr-gutter\s*\{[^}]*min-height:\s*0/);
	});

	it('scrolls the code both ways', () => {
		// `pre`, not `pre-wrap`: a 200-character line should scroll sideways, not
		// silently rewrap and hide from the student that it is 200 characters long.
		expect(CSS).toMatch(/\.wwr-code\s*\{[^}]*white-space:\s*pre;/);
		expect(CSS).toMatch(/\.wwr-code\s*\{[^}]*overflow:\s*auto/);
		expect(CSS).toMatch(/\.wwr-code\s*\{[^}]*height:\s*100%/);
	});
});

describe('the assembled preview actually parses', () => {
	// THE TEST THAT WAS MISSING.
	//
	// The reporting harness used to be written as an array of JavaScript string
	// literals — a program expressed inside strings, where every backslash needs
	// doubling and nothing checks that you did it. A `\n` that was meant to be two
	// characters became a real newline, split a string across two lines, and the
	// whole harness failed to parse. The preview threw `SyntaxError: Unexpected
	// EOF` before running a single line, so the console stayed empty and the page
	// looked merely broken.
	//
	// Every other check passed: the file parsed, the page built, the includes
	// expanded, the bytes were all there. The thing nobody was checking was
	// whether the document we hand the iframe is itself valid JavaScript.

	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	/* EVERY script block in the assembled document, in order.
	 *
	 * This used to grab one block with a GREEDY /<script>\n([\s\S]*)\n<\/script>/.
	 * That was right when there was one block and quietly wrong the moment the
	 * harness moved into its own — the match ran from the first <script> to the
	 * LAST </script> and swallowed the HTML between them, so every one of these
	 * assertions failed on `Unexpected token '<'` and was reporting the regex
	 * rather than the document. Non-greedy, and check them all: the reason the
	 * harness is in a separate block is that both have to parse independently. */
	const assembledScripts = (js: string): string[] => {
		document.body.innerHTML = `<ww-runner console><script type="text/ww-file" name="main.js">${js}</script></ww-runner>`;
		new Function(SRC)();
		const blocks = [...renderedDoc().matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map((m) => m[1]);
		expect(blocks.length, 'the assembled document should contain script blocks').toBeGreaterThan(0);
		return blocks;
	};
	const expectAllParse = (js: string) => {
		for (const [i, block] of assembledScripts(js).entries())
			// new Function throws on a syntax error without executing anything.
			expect(() => new Function(block), `script block ${i} should parse`).not.toThrow();
	};

	it('produces a preview script that is valid JavaScript', () => {
		expectAllParse('console.log(1);');
	});

	it('stays valid with the starter project in it', () => {
		const starter = [
			'async function loadGameData() {',
			'  const response = await fetch("https://wildwillows.app/GameData/");',
			'  const data = await response.json();',
			'  console.log(data);',
			'}',
			'loadGameData();',
		].join('\n');
		expectAllParse(starter);
	});

	it('stays valid when the student writes a closing script tag', () => {
		expectAllParse('const s = "</scr" + "ipt>";');
	});

	it('builds the harness from a real function rather than string literals', () => {
		// The structural guarantee behind the tests above: this file's own parser
		// now checks the harness, so the escaping cannot silently rot again.
		expect(SRC).toContain('function harnessProgram()');
		expect(SRC).toContain("var HARNESS = '(' + harnessProgram.toString() + ')();'");
	});
});

describe("a syntax error in the student's code still gets reported", () => {
	// THE BUG THIS FILE EXISTS FOR, second time around.
	//
	// The harness used to be concatenated in front of the student's code in ONE
	// script block. A syntax error is a PARSE-time failure — the browser discards
	// the whole block before running any of it — so a student who left a `var`
	// dangling took the harness down with them. window.onerror was never
	// installed, nothing was posted to the host, and they got a blank preview, an
	// empty console, and an error visible only in devtools.
	//
	// That is exactly the "I have no idea what is wrong" moment this component
	// exists to prevent, and it only happened for BROKEN code — so every test
	// written against working code passed.

	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	const previewBlocks = (js: string) => {
		document.body.innerHTML = `<ww-runner console><script type="text/ww-file" name="main.js">${js}</script></ww-runner>`;
		new Function(SRC)();
		const parsed = new DOMParser().parseFromString(renderedDoc(), 'text/html');
		return [...parsed.querySelectorAll('script')].map((n) => n.textContent || '');
	};

	it('puts the harness in a block of its own', () => {
		const blocks = previewBlocks('console.log(1);');
		expect(blocks.length).toBe(2);
		expect(blocks[0]).toContain('harnessProgram');
		expect(blocks[1]).not.toContain('harnessProgram');
	});

	it("keeps the harness parseable even when the student's code is not", () => {
		// A dangling `var` — literally what was on screen when this was found.
		const blocks = previewBlocks('loadGameData();\n\nvar');
		expect(() => new Function(blocks[0]), 'the harness must still install').not.toThrow();
		expect(() => new Function(blocks[1]), 'the student block is the broken one').toThrow();
	});

	it("explains the end-of-input error in every browser's wording", () => {
		// Chrome says "Unexpected end of input", Safari "Unexpected end of script"
		// and sometimes "Unexpected EOF". Same mistake, three wordings — and the
		// students likeliest to hit it are the least able to tell they are the same.
		const R = (window as any).WwRunner;
		for (const message of [
			'SyntaxError: Unexpected end of input',
			'SyntaxError: Unexpected end of script',
			'SyntaxError: Unexpected EOF',
		])
			expect(R.explain(message).key, message).toBe('unexpected-eof');
	});
});

describe('editing keeps native undo working', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	it('inserts a tab without wiping the undo stack', () => {
		// Assigning .value replaces the field wholesale and the browser throws away
		// its undo history when you do — so Cmd/Ctrl+Z silently stopped working from
		// the first time a student pressed Tab. execCommand('insertText') is
		// deprecated and still the only way to edit a textarea undoably.
		expect(SRC).toContain("insertText(area, '  ')");
		expect(SRC).toContain("document.execCommand('insertText', false, text)");
	});

	it('replaces a whole file undoably too', () => {
		// The idea scaffolds and Reset throw work away. Those are the actions where
		// one Cmd+Z putting your own version back matters most. ("Show me" used to
		// be on this list; it reveals the answer beside their code now instead of
		// pasting it over the top, which is why it no longer needs an undo.)
		expect(SRC).toContain('function replaceValue');
		expect(SRC).toContain('replaceValue(editors[f.name].area');
	});
});

describe('the console can be resized and ignored', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	const CSS = readFileSync(join(process.cwd(), 'public/partials/ww-runner.css'), 'utf8');

	it('drags from the header', () => {
		expect(CSS).toMatch(/\.wwr-console-head\s*\{[^}]*cursor:\s*ns-resize/);
		expect(SRC).toContain("chead.addEventListener('pointerdown'");
	});

	it('does not lose the drag over the preview', () => {
		// The iframes would otherwise swallow the pointer the moment it crossed them.
		expect(CSS).toContain('body.wwr-resizing iframe');
	});

	it('folds away entirely', () => {
		expect(SRC).toContain('function setCollapsed');
		expect(CSS).toContain('.wwr-console.is-collapsed .wwr-console-lines');
	});

	it('is operable from the keyboard', () => {
		expect(SRC).toContain("chead.setAttribute('role', 'separator')");
		expect(SRC).toContain("e.key === 'ArrowUp'");
	});
});

describe('the host parses the code itself', () => {
	// Safari will not describe a script error in a sandboxed, opaque-origin frame
	// to a cross-origin listener: window.onerror receives "Script error." — two
	// words that name nothing, point nowhere, and are indistinguishable from every
	// other failure. Chrome hands over the real message, which is why this went
	// unnoticed through a full browser test run.
	//
	// So the host compiles the student's JavaScript itself, purely to find out what
	// is wrong with it. new Function only PARSES — it never runs the code.

	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');

	it('checks syntax in the host, where the message is real', () => {
		expect(SRC).toContain('function syntaxErrorIn(js)');
		expect(SRC).toContain('new Function(js)');
	});

	it('measures the wrapper’s line offset rather than assuming it', () => {
		// new Function wraps the code, so a reported line is offset by however many
		// lines that wrapper adds — which differs by engine and version.
		expect(SRC).toContain('SYNTAX_LINE_OFFSET');
	});

	it('does not blame the wrapper’s own closing brace', () => {
		// An unterminated file makes the parser trip on the brace new Function
		// appended, reporting a character the student never typed.
		expect(SRC).toContain("if (/unexpected token '?\\}'?/i.test(message)) message = 'Unexpected end of input';");
	});

	it('still explains the masked message if one ever reaches the panel', () => {
		const R = (window as any).WwRunner;
		expect(R.explain('Script error.').key).toBe('masked');
		expect(R.explain('Script error').help).toMatch(/Safari hides/);
	});

	it('reports one message per failure', () => {
		expect(SRC).toContain('if (syntaxProblem) {');
	});
});

describe('a JavaScript-only example has no page to show', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	// Twenty-three of the lesson's runners are one main.js and a console: the
	// fetch steps, the property paths, every iterator method. Their output is
	// console.log and nothing else, so a preview column is a permanently blank
	// rectangle taking half the width, with a switcher above it offering three
	// ways to look at it.
	const mount = (files: string) => {
		document.body.innerHTML = `<ww-runner console>${files}</ww-runner>`;
		new Function(SRC)();
		return document.querySelector('ww-runner')!;
	};
	const JS_ONLY = '<script type="text/ww-file" name="main.js">console.log(1);</script>';
	const WITH_PAGE =
		'<script type="text/ww-file" name="index.html" context><p id="x">hi</p></script>' +
		'<script type="text/ww-file" name="main.js">console.log(1);</script>';

	it('is detected from its files, not from an attribute', () => {
		// The condition IS the definition: one file, it is JavaScript, and there is
		// no HTML or CSS behind it. Anything that renders has one of those.
		expect(mount(JS_ONLY).classList.contains('wwr--console-only')).toBe(true);
		expect(mount(WITH_PAGE).classList.contains('wwr--console-only')).toBe(false);
	});

	it('drops the view switcher and the open-in-a-tab button', () => {
		const host = mount(JS_ONLY);
		expect(host.querySelector('.wwr-views')).toBeNull();
		expect(host.querySelector('.wwr-open')).toBeNull();
		// Run and Reset stay: both still mean something without a preview.
		expect(host.querySelector('.wwr-run')).toBeTruthy();
		expect(host.querySelector('.wwr-reset')).toBeTruthy();
	});

	it('starts in the code view, without reporting a view change', () => {
		// Set directly rather than through setView(): this is the starting state,
		// not something the student chose, and a metric would say otherwise.
		const host = mount(JS_ONLY);
		expect(host.classList.contains('wwr--view-code')).toBe(true);
		expect(host.classList.contains('wwr--view-split')).toBe(false);
	});

	it('still builds the preview, because that is where the code runs', () => {
		// Hidden, not absent. The iframe executes the student's JavaScript and
		// reports the console lines and any error back to the host.
		expect(mount(JS_ONLY).querySelectorAll('iframe.wwr-preview')).toHaveLength(2);
	});

	it('shows the console even if the author forgot the attribute', () => {
		document.body.innerHTML = `<ww-runner>${JS_ONLY}</ww-runner>`;
		new Function(SRC)();
		const box = document.querySelector('.wwr-console') as HTMLElement;
		expect(box).toBeTruthy();
		expect(box.hidden).toBe(false); // otherwise the runner would show nothing at all
	});

	it('keeps the switcher on everything else', () => {
		expect(mount(WITH_PAGE).querySelector('.wwr-views')).toBeTruthy();
	});
});

describe('the silent-failure hints do not accuse the innocent', () => {
	const SRC = readFileSync(join(process.cwd(), 'public/partials/ww-runner.js'), 'utf8');
	// document.body.innerText has a trapdoor: on an element that is not being
	// rendered it falls back to textContent. A preview that is display:none —
	// which is every JavaScript-only example, and any runner switched to the code
	// view — therefore returned the SOURCE of both script blocks, harness
	// included. And the harness contains the literal "[object Object]" in the very
	// test that looks for it, so the check matched itself and every console
	// example in chapters 5 through 9 accused the student of rendering an object
	// they never rendered.
	it('reads the page without reading the code that made it', () => {
		expect(SRC).toContain('function pageText()');
		expect(SRC).toContain("clone.querySelectorAll('script, style')");
		expect(SRC).toMatch(/var text = pageText\(\);/);
	});

	it('no longer reads the page through innerText', () => {
		// Matched on the CALL, not the mention: the comment above the fix names the
		// property it replaced, and a bare search for the string finds that comment
		// and fails on the explanation rather than on the code. Third time this
		// file has taught that lesson, after the closing script tag and the fold
		// arrow.
		expect(SRC).not.toMatch(/=\s*document\.body\.innerText/);
		expect(SRC).not.toMatch(/\(\s*document\.body\.innerText\s*\)/);
	});
});

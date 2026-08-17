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
				'<script type="text/ww-file" name="index.js">console.log(1)</script>',
		);
		expect(host.querySelectorAll('textarea.wwr-code').length).toBe(2);
		const frame = host.querySelector('iframe.wwr-preview') as HTMLIFrameElement;
		// The security property the whole design rests on: scripts may run, but the
		// frame gets an opaque origin and cannot reach this page. If allow-same-origin
		// ever appears here, student code can touch the lesson page.
		expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
	});

	it('exposes the sources it is currently running', () => {
		const host = mount('<script type="text/ww-file" name="index.js">const a = 1;</script>');
		expect(host.wwGet().js).toBe('const a = 1;');
	});

	it('hides the tab strip when there is only one file', () => {
		const host = mount('<script type="text/ww-file" name="index.js">x</script>');
		expect((host.querySelector('.wwr-tabs') as HTMLElement).hidden).toBe(true);
	});
});

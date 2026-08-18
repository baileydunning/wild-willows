/* Wild Willows — <ww-runner>
 *
 * The shared code-editor-and-live-preview element behind BOTH classroom student
 * pages. /learn/web-development uses it ~15 times in one-file mode for its inline
 * examples; /learn/code-builder uses it once in three-file mode with tabs. One
 * implementation, so a student who has used the lesson's examples already knows
 * how the builder behaves.
 *
 * Inlined into both pages at build time by scripts/build-pages.mjs (see the
 * @include directive there) — NOT served as its own file. The hosted Harper
 * serves no static files, and duplicating this in two hand-maintained pages is
 * exactly the drift the include exists to prevent.
 *
 * DESIGN CONSTRAINTS, all deliberate:
 *  • No dependencies. No CodeMirror, no Monaco, no CDN. School networks block
 *    CDNs, the page has to inline into resources.js as one string, and a styled
 *    <textarea> genuinely is enough for a 40-line file.
 *  • The preview iframe is sandbox="allow-scripts" WITHOUT allow-same-origin, so
 *    student code runs on an opaque origin and cannot touch this page. That is
 *    why GET /GameData/ sends Access-Control-Allow-Origin (see GAME_DATA_CORS in
 *    server/resources.ts) — without it, the fetch the whole lesson is about fails
 *    from inside here.
 *  • Errors surface in the UI, never only in a console the student will not open.
 *    A blank preview with a silent error is the #1 way a beginner concludes they
 *    are bad at this and stops.
 */
(function () {
	'use strict';

	/* ---------------------------------------------------------------- assembly */

	/**
	 * Three sources -> one HTML document for the preview iframe.
	 *
	 * Exposed on window for the unit tests (tests/unit/ww-runner.test.ts) and for
	 * the builder's Download, which must produce the SAME bytes the preview ran —
	 * a downloaded file that behaves differently from the preview is the worst
	 * possible ending to the lesson.
	 */
	function assembleDocument(html, css, js, harness) {
		return (
			'<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
			'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
			'<style>\n' +
			escapeForStyle(css || '') +
			'\n</style>\n</head>\n<body>\n' +
			(html || '') +
			/* THE HARNESS GETS ITS OWN SCRIPT BLOCK, and this is not tidiness.
			 *
			 * It used to be concatenated in front of the student's code in ONE block,
			 * and that quietly broke the most important case this component handles.
			 * A syntax error is a PARSE-time failure: the browser throws out the
			 * whole block before executing any of it. So a student who left a `var`
			 * dangling took the harness down with them — window.onerror was never
			 * installed, nothing was posted to the host, and the result was a blank
			 * preview, an empty console, and an error visible only in devtools.
			 * Which is precisely the "I have no idea what is wrong" moment the error
			 * panel exists to prevent.
			 *
			 * Two blocks: the harness parses and installs on its own, then a parse
			 * error in the student's block fires window.onerror and gets reported
			 * like any other mistake.
			 *
			 * Omitted entirely when there is no harness — that path is Download, and
			 * the file a student takes home carries none of our plumbing. */
			(harness ? '\n<script>\n' + escapeForScript(harness) + '\n<\/script>' : '') +
			'\n<script>\n' +
			escapeForScript(js || '') +
			'\n<\/script>\n</body>\n</html>\n'
		);
	}

	/**
	 * The bug this prevents: a student writes a closing script tag inside a string
	 * — in a template literal building HTML, say — and the HTML parser ends the
	 * script block THERE. The rest of their JavaScript renders as visible text and
	 * the page silently does nothing. No error, no clue, and it looks like the
	 * editor ate their code.
	 *
	 * Only that one sequence matters, and only case-insensitively; escaping the
	 * slash keeps the JavaScript semantically identical, because inside a string
	 * "<\/script>" and the unescaped form are the same three-word value.
	 *
	 * NOTE, and this is not a joke: this comment used to spell the sequence out
	 * literally. This whole file is inlined INTO a <script> block by
	 * scripts/build-pages.mjs, so the comment explaining the trap sprang the trap
	 * — the browser ended the block mid-file and rendered the rest of the runner
	 * as text on the page. Do not write it out here. build-pages now escapes it
	 * on the way in as a backstop, and tests/unit/built-pages.test.ts asserts the
	 * generated page has balanced tags.
	 */
	function escapeForScript(code) {
		return String(code).replace(/<\/(script)/gi, '<\\/$1');
	}

	/** Same class of problem for </style> inside a CSS string or comment. */
	function escapeForStyle(code) {
		return String(code).replace(/<\/(style)/gi, '<\\/$1');
	}

	/* ------------------------------------------------- friendly error messages */

	/**
	 * Plain-English explanations for the errors beginners actually hit, ordered
	 * most-specific-first because several of these substrings overlap.
	 *
	 * Every entry says WHAT IT MEANS and WHAT TO CHECK. A raw `TypeError: Cannot
	 * read properties of null` teaches nothing to someone in week one; "the page
	 * couldn't find the element you asked for — check the spelling of your id"
	 * fixes the bug and teaches what null is in the same breath.
	 *
	 * Three of these are data-type errors wearing different hats (null, undefined,
	 * text-vs-number), and they deliberately name the type — that is where the
	 * lesson's types material gets used, rather than in a chapter nobody rereads.
	 *
	 * Add to this list from real usage: the builder counts which errors fire
	 * (ww:metric -> errors_*), so the ranking tells you which explanation to write
	 * next instead of guessing.
	 */
	var ERROR_HELP = [
		{
			key: 'fetch-failed',
			match: /failed to fetch|networkerror|load failed/i,
			title: "Couldn't reach the Wild Willows data",
			help:
				'The request for the game data did not get through. Check the address is exactly ' +
				'https://wildwillows.app/GameData/ and if it looks right, ask your teacher: some school ' +
				'networks block outside websites.',
		},
		{
			key: 'json-parse',
			match: /unexpected token '?<'?|is not valid json/i,
			title: 'That answer was not the data',
			help:
				'The server sent back a webpage (usually an error page) where your code expected JSON. ' +
				'Check the address you passed to fetch().',
		},
		{
			key: 'null-property',
			match: /(reading|properties) (of )?'?null'?|of null/i,
			title: 'That element is not on the page',
			help:
				'querySelector gives you null when it cannot find what you asked for, and null means ' +
				'"deliberately nothing". Check the spelling in your HTML and your JavaScript, and remember ' +
				'#name looks for id="name", while .name looks for class="name".',
		},
		{
			key: 'undefined-property',
			match: /(reading|properties) (of )?'?undefined'?|of undefined/i,
			title: 'That piece of the data is not there',
			help:
				'undefined means "nothing found". You asked for something the data does not have. Check the ' +
				'spelling of the property, and check you are not one level too deep (data.animals[0].name, ' +
				'not data.animals.name).',
		},
		{
			key: 'not-defined',
			match: /is not defined/i,
			title: 'JavaScript does not recognize that name',
			help:
				'Either it is spelled differently from where you created it, or it does not exist yet. ' +
				'Capital letters count: animal and Animal are two different names.',
		},
		{
			key: 'not-a-function',
			match: /is not a function/i,
			title: 'That is not something you can call',
			help:
				'You put () after something that is not a function, often a typo in the method name, or a ' +
				'value that turned out to be undefined.',
		},
		{
			key: 'await-async',
			match: /await is only valid|await outside/i,
			title: 'await needs an async function',
			help: 'await only works inside a function marked async. Check that the word async is on the function it sits in.',
		},
		{
			key: 'const-assign',
			match: /assignment to constant|invalid assignment/i,
			title: 'That value cannot be changed',
			help: 'A const can be set once. Use let instead if you need to change it later.',
		},
		{
			key: 'not-iterable',
			match: /is not iterable/i,
			title: 'That is not a list',
			help:
				'for...of and the array methods need an array. Check what you actually got: it may be a single ' +
				'object, or undefined.',
		},
		{
			key: 'unexpected-eof',
			/* Chrome: "Unexpected end of input". Safari: "Unexpected end of script",
			 * and sometimes "Unexpected EOF". Same mistake, three wordings — and the
			 * students most likely to hit it are the least able to tell that those
			 * are the same thing. */
			match: /unexpected end of (input|script)|unexpected eof/i,
			title: 'Something was left open',
			help: 'Usually a missing } or ) or a missing closing quote. Check the end of the last few lines you wrote.',
		},
		{
			key: 'masked',
			/* Safari's placeholder for an error it will not describe across an origin
			 * boundary. syntaxErrorIn() should have caught the common cause first, so
			 * reaching this means something rarer — but it still must not leave a
			 * student staring at two words. */
			match: /^\s*script error\.?\s*$/i,
			title: 'Your code stopped, and the browser would not say why',
			help:
				'Safari hides the details of some errors for security reasons. Check the last thing you ' +
				'changed, and try commenting lines out until the page runs again. The last line you removed ' +
				'is the one to look at.',
		},
		{
			key: 'syntax',
			match: /syntaxerror|unexpected token|unexpected identifier/i,
			title: 'JavaScript could not read that',
			help:
				'A typo somewhere in the shape of the code: a missing comma, bracket or quote. The line number ' +
				'is where JavaScript gave up, so the real mistake is often just above it.',
		},
	];

	/* Calibrate how `new Function` reports line numbers.
	 *
	 * It wraps the code in a synthetic function, so a reported line is offset from
	 * the student's by however many lines that wrapper adds — which differs by
	 * engine and by version. Measuring it once with a known-broken probe is exact,
	 * and cheap: the error is on line 3 of the probe, so whatever it claims minus
	 * three is the wrapper's contribution. */
	var SYNTAX_LINE_OFFSET = (function () {
		try {
			new Function('\n\n(');
		} catch (e) {
			if (typeof e.line === 'number') return e.line - 3; // Safari reports .line
			var m = /<anonymous>:(\d+)/.exec(String(e.stack || ''));
			if (m) return Number(m[1]) - 3;
		}
		return 0;
	})();

	/**
	 * Compile the student's JavaScript HERE, in the host page, purely to find out
	 * whether it parses — and if not, what is actually wrong with it.
	 *
	 * WHY THIS EXISTS. The preview runs in a sandboxed, opaque-origin iframe, and
	 * Safari refuses to tell a cross-origin listener anything about a script error
	 * in one: `window.onerror` receives the string "Script error." with no message,
	 * no file and no line. Chrome hands over the real message, which is exactly why
	 * this survived a browser test — one browser was being helpful.
	 *
	 * "Script error." is worse than useless to a beginner. It names nothing, points
	 * nowhere, and is indistinguishable from every other failure.
	 *
	 * The host has the source and no origin barrier, so compiling it here gets the
	 * real SyntaxError. new Function only PARSES — it never runs the code, so this
	 * cannot have side effects.
	 *
	 * Not a substitute for the in-frame harness: that still reports everything that
	 * happens at RUN time, which no amount of parsing can predict.
	 */
	function syntaxErrorIn(js) {
		if (!js || !js.trim()) return null;
		try {
			new Function(js);
			return null;
		} catch (e) {
			if (!(e instanceof SyntaxError)) return null;
			var line = null;
			if (typeof e.line === 'number') line = e.line - SYNTAX_LINE_OFFSET;
			else {
				var m = /<anonymous>:(\d+)/.exec(String(e.stack || ''));
				if (m) line = Number(m[1]) - SYNTAX_LINE_OFFSET;
			}
			var total = js.split('\n').length;
			if (!(line > 0)) line = null;
			else if (line > total) line = total;

			var message = String(e.message || 'SyntaxError');
			/* Undo the wrapper's fingerprint. new Function appends a closing brace of
			 * its own, so when the student leaves something open the parser trips on
			 * THAT brace and reports "Unexpected token '}'" — blaming a character the
			 * student never typed and cannot find. A complaint about the wrapper's
			 * own brace is, by construction, the unterminated case; say so. */
			if (/unexpected token '?\}'?/i.test(message)) message = 'Unexpected end of input';
			return { message: message, line: line };
		}
	}

	function explain(message) {
		for (var i = 0; i < ERROR_HELP.length; i++) {
			if (ERROR_HELP[i].match.test(message)) return ERROR_HELP[i];
		}
		return { key: 'other', title: 'Something went wrong', help: 'Read the message above and check the line it names.' };
	}

	/* --------------------------------------------------------------- telemetry */

	/**
	 * Fire-and-forget counter. The page listens for these and batches them into
	 * one beacon (see the LessonEvent notes in server/resources.ts); the component
	 * deliberately knows nothing about transport, so the lesson page and the
	 * builder can count different things without touching this file.
	 *
	 * Counters only, ever. No code, no text the student typed, no identifiers.
	 */
	function metric(key, host) {
		try {
			(host || document).dispatchEvent(new CustomEvent('ww:metric', { bubbles: true, detail: { key: String(key) } }));
		} catch (e) {
			/* analytics must never break a lesson in progress */
		}
	}

	/* ----------------------------------------------------- the runtime injected
	 * into every preview, ahead of the student's own code.
	 *
	 * Reports errors and console output OUT to the host via postMessage, because
	 * the iframe is opaque-origin and the host cannot reach in. Kept small and
	 * defensive: it runs before student code and must survive whatever follows.
	 */
	/* The reporting harness that runs inside every preview, ahead of the student's
	 * own code. It reports errors and console output OUT to the host by
	 * postMessage, because the iframe is opaque-origin and the host cannot reach in.
	 *
	 * WRITTEN AS A REAL FUNCTION and stringified, NOT as an array of string
	 * literals. It was the latter, and that is a trap: the harness is a JavaScript
	 * program expressed inside JavaScript string literals, so every backslash needs
	 * doubling and nothing checks that you did it. A single `\n` meant to be two
	 * characters became an actual newline, which split a string across two lines
	 * and made the whole harness fail to parse — so the preview threw
	 * `SyntaxError: Unexpected EOF` before running a line, and the console stayed
	 * empty with no clue why. Stringifying a real function means this file's own
	 * parser checks the harness, and there is no escaping to get wrong.
	 */
	function harnessProgram() {
		var send = function (kind, payload) {
			try {
				parent.postMessage({ __ww: true, kind: kind, payload: payload }, '*');
			} catch (e) {
				/* nothing useful to do from in here */
			}
		};

		window.addEventListener('error', function (e) {
			send('error', { message: String(e.message || e.error || 'Error'), line: e.lineno || null });
		});

		/* Did the student's own fetch get through?
		 *
		 * This is the single most important thing to know about a classroom we
		 * cannot see. A school filter that blocks the API breaks the lesson
		 * completely and silently: the teacher assumes the site is broken, we never
		 * hear about it, and they do not come back. A failed fetch also looks
		 * exactly like a mistake in the student's code from where they are sitting.
		 *
		 * Reports ONLY whether it succeeded — never the URL, never the response. */
		var nativeFetch = window.fetch;
		if (typeof nativeFetch === 'function') {
			window.fetch = function () {
				var p = nativeFetch.apply(window, arguments);
				try {
					p.then(
						function (r) {
							send('fetch', { ok: !!(r && r.ok) });
						},
						function () {
							send('fetch', { ok: false });
						},
					);
				} catch (e) {
					/* a thenable that is not a promise — not ours to fix */
				}
				return p;
			};
		}

		window.addEventListener('unhandledrejection', function (e) {
			var r = e.reason;
			send('error', { message: String((r && r.message) || r || 'Something failed'), line: null });
		});

		/* HARD CAPS, and they are the difference between a working console and a
		 * hung tab. Chapter 4's instruction is literally console.log(data) on the
		 * whole game catalog: ~300 KB of JSON, which pretty-printed is ~600 KB of
		 * string, posted across a message channel and then written into the DOM.
		 * The browser sat there doing that instead of painting, which reads to a
		 * student as "the console is broken". A beginner learns exactly as much
		 * from the first two thousand characters. */
		var MAX_CHARS = 2000;
		var MAX_LINES = 200;
		var sent = 0;

		['log', 'warn', 'error', 'info'].forEach(function (level) {
			var original = console[level];
			console[level] = function () {
				try {
					original.apply(console, arguments);
				} catch (e) {
					/* the real console is not our problem */
				}
				if (sent > MAX_LINES) return;
				if (sent === MAX_LINES) {
					sent++;
					send('console', { level: 'warn', text: '... more output was hidden.' });
					return;
				}
				sent++;
				var parts = [];
				for (var i = 0; i < arguments.length; i++) parts.push(format(arguments[i]));
				var text = parts.join(' ');
				if (text.length > MAX_CHARS)
					text = text.slice(0, MAX_CHARS) + '\n... (' + (text.length - MAX_CHARS) + ' more characters)';
				send('console', { level: level, text: text });
			};
		});

		/* Beginners log whole objects constantly; [object Object] would make the
		 * console useless for exactly the chapter it exists to support. And 150
		 * animal records is the normal case here, so the count plus the first few
		 * IS the useful answer to console.log(data.animals) — and one a student can
		 * actually read. */
		function format(v) {
			if (typeof v === 'string') return v;
			if (v instanceof Error) return v.message;
			if (Array.isArray(v) && v.length > 8) {
				var head = v.slice(0, 3).map(function (x) {
					return format(x);
				});
				return 'Array(' + v.length + ') [\n  ' + head.join(',\n  ') + ',\n  ... ' + (v.length - 3) + ' more\n]';
			}
			try {
				return JSON.stringify(v, null, 2);
			} catch (e) {
				return String(v);
			}
		}

		/* What the page actually SHOWS, with the code that produced it left out.
		 *
		 * This was document.body.innerText, and innerText has a trapdoor: when an
		 * element is not being rendered it falls back to textContent. A preview
		 * that is display:none — which is every JavaScript-only example in the
		 * lesson, and any runner switched to the code view — therefore returned the
		 * SOURCE of both script blocks, including this harness. And this harness
		 * contains the literal "[object Object]", in the test immediately below.
		 * So the check matched itself, and every console example in chapters 5
		 * through 9 accused the student of rendering an object they never rendered.
		 *
		 * A clone with the scripts and styles taken out reads the same whether the
		 * document is rendered or not, which is the property the old version was
		 * quietly relying on and did not have. */
		function pageText() {
			if (!document.body) return '';
			try {
				var clone = document.body.cloneNode(true);
				var junk = clone.querySelectorAll('script, style');
				for (var i = 0; i < junk.length; i++) junk[i].parentNode.removeChild(junk[i]);
				return clone.textContent || '';
			} catch (e) {
				return '';
			}
		}

		/* The silent failure: nothing is thrown, the page just renders the word
		 * "undefined" or "[object Object]". Nothing in the browser flags it, and a
		 * student stares at it with no idea what to search for. */
		window.addEventListener('load', function () {
			setTimeout(function () {
				var text = pageText();
				if (/\[object Object\]/.test(text)) send('hint', { key: 'object-object' });
				else if (/\bundefined\b/.test(text)) send('hint', { key: 'undefined-text' });
			}, 300);
		});
	}

	var HARNESS = '(' + harnessProgram.toString() + ')();';

	var SILENT_HINTS = {
		'object-object': {
			title: 'Your page is showing [object Object]',
			help:
				'You are putting a whole object on the page where you meant one part of it. ' +
				'Try adding the piece you want, for example .name instead of the whole animal.',
		},
		'undefined-text': {
			title: 'Your page is showing the word "undefined"',
			help:
				'Something you asked for was not there. Check the spelling of the property, and check the data ' +
				'actually arrived before you used it.',
		},
	};

	/* ------------------------------------------------------------- the element */

	var DEBOUNCE_MS = 400;
	var uid = 0;

	/** Insert text at the caret while keeping the browser's undo stack.
	 *  Returns false if the browser refused, so callers can fall back. */
	function insertText(area, text) {
		try {
			area.focus();
			return document.execCommand && document.execCommand('insertText', false, text);
		} catch (e) {
			return false;
		}
	}

	/**
	 * Replace a whole file's contents, still undoably where possible.
	 *
	 * This is what "Show me", the idea scaffolds, Reset and Open all go through.
	 * Selecting everything and inserting means one Cmd+Z puts the student's own
	 * version back — which matters most for exactly those actions, because they
	 * are the ones that throw work away.
	 *
	 * A hidden textarea cannot take focus, so those fall back to assignment; the
	 * builder's own Undo button covers that case.
	 */
	function replaceValue(area, text) {
		if (area.value === text) return;
		var wasFocused = document.activeElement;
		var scroll = area.scrollTop;
		var ok = false;
		if (!area.closest || !area.closest('[hidden]')) {
			try {
				area.focus();
				area.select();
				ok = document.execCommand && document.execCommand('insertText', false, text);
			} catch (e) {
				ok = false;
			}
		}
		if (!ok) area.value = text;
		area.scrollTop = scroll;
		if (wasFocused && wasFocused !== area && wasFocused.focus) wasFocused.focus();
	}

	function makeEditor(file, value, onInput) {
		var wrap = document.createElement('div');
		wrap.className = 'wwr-editor';

		var gutter = document.createElement('div');
		gutter.className = 'wwr-gutter';
		gutter.setAttribute('aria-hidden', 'true');

		var area = document.createElement('textarea');
		area.className = 'wwr-code';
		area.value = value || '';
		area.spellcheck = false;
		area.setAttribute('aria-label', file + ', code editor');
		/* Real keyboards, real settings: without these a browser will happily
		 * autocapitalise a student's first line of JavaScript into a SyntaxError. */
		area.setAttribute('autocomplete', 'off');
		area.setAttribute('autocorrect', 'off');
		area.setAttribute('autocapitalize', 'off');

		function renderGutter() {
			var lines = area.value.split('\n').length;
			var out = '';
			for (var i = 1; i <= lines; i++) out += i + '\n';
			gutter.textContent = out;
		}

		/* Tab indents rather than moving focus — but Esc first releases the trap,
		 * so the field is still escapable by keyboard alone. Without this a
		 * keyboard-only student is stuck in the textarea with no way out, which
		 * fails the page outright. */
		var escaping = false;
		area.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				escaping = true;
				return;
			}
			if (e.key === 'Tab' && !escaping) {
				e.preventDefault();
				/* insertText, NOT `area.value = ...`.
				 *
				 * Assigning .value replaces the field's contents wholesale, and the
				 * browser throws away its undo history when you do — so Cmd/Ctrl+Z
				 * silently stopped working from the first time a student pressed Tab.
				 * They would try to undo a mistake, get nothing, and have no idea why.
				 *
				 * execCommand('insertText') is formally deprecated and remains the
				 * only way to edit a textarea while keeping native undo intact. Every
				 * browser supports it; the direct assignment below is the fallback for
				 * one that ever stops. */
				if (!insertText(area, '  ')) {
					var start = area.selectionStart;
					var end = area.selectionEnd;
					area.value = area.value.slice(0, start) + '  ' + area.value.slice(end);
					area.selectionStart = area.selectionEnd = start + 2;
				}
				renderGutter();
				onInput();
				return;
			}
			escaping = false;
		});

		area.addEventListener('input', function () {
			renderGutter();
			onInput();
		});
		area.addEventListener('scroll', function () {
			gutter.scrollTop = area.scrollTop;
		});

		renderGutter();
		wrap.appendChild(gutter);
		wrap.appendChild(area);
		return { wrap: wrap, area: area, refresh: renderGutter };
	}

	function WwRunner(host) {
		var id = ++uid;
		var files = readFiles(host);
		var mode = files.length > 1 ? 'multi' : 'single';
		var showConsole = host.hasAttribute('console');
		var autorun = !host.hasAttribute('manual');
		var label = host.getAttribute('label') || '';

		/* A JAVASCRIPT-ONLY EXAMPLE HAS NO PAGE TO SHOW.
		 *
		 * Twenty-three of the lesson's runners are one main.js and a console: the
		 * fetch steps, the property paths, every iterator method. Their output is
		 * console.log and nothing else, so the preview column is a permanently
		 * blank white rectangle taking half the width, and the view switcher above
		 * it offers three ways to look at that blank rectangle.
		 *
		 * So these get code with the console under it, and no switcher. The
		 * preview iframe is still built and still runs the code (it is where the
		 * code executes and what reports back); it is only hidden, via the same
		 * `code` view a student could have chosen by hand.
		 *
		 * Detected rather than declared, because the condition IS the definition:
		 * one file, it is JavaScript, and no HTML or CSS behind it. An example
		 * that renders something has one of those, and keeps its preview. */
		var ctx = files[0].context || {};
		var consoleOnly = mode === 'single' && files[0].kind === 'js' && !ctx.html && !ctx.css;
		/* Without this such a runner would show nothing at all: no preview by
		 * design, and no console either. */
		if (consoleOnly) showConsole = true;

		host.classList.add('wwr', mode === 'multi' ? 'wwr--multi' : 'wwr--single');
		if (consoleOnly) host.classList.add('wwr--console-only');
		host.innerHTML = '';

		/* ---- toolbar ---- */
		var bar = document.createElement('div');
		bar.className = 'wwr-bar';
		if (label) {
			var tag = document.createElement('span');
			tag.className = 'wwr-label';
			tag.textContent = label;
			bar.appendChild(tag);
		}

		var tabs = document.createElement('div');
		tabs.className = 'wwr-tabs';
		tabs.setAttribute('role', 'tablist');
		bar.appendChild(tabs);

		var spacer = document.createElement('span');
		spacer.className = 'wwr-spacer';
		bar.appendChild(spacer);

		/* View modes.
		 *
		 * Split is the teaching default — cause and effect in one eyeful. But a
		 * student writing a long function wants the width, and one showing a
		 * classmate what they made wants the page. On a Chromebook at 1366px, two
		 * half-columns is genuinely cramped for both. */
		var views = document.createElement('div');
		views.className = 'wwr-views';
		views.setAttribute('role', 'group');
		views.setAttribute('aria-label', 'What to show');

		var VIEWS = [
			{ id: 'split', label: 'Split', icon: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M12 4.5v15"/>' },
			{ id: 'code', label: 'Code', icon: '<path d="M9 7.5 4.5 12 9 16.5M15 7.5 19.5 12 15 16.5"/>' },
			{ id: 'preview', label: 'Page', icon: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18"/>' },
		];
		var viewBtns = {};
		VIEWS.forEach(function (v) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'wwr-view' + (v.id === 'split' ? ' is-on' : '');
			b.title = v.label;
			b.setAttribute('aria-label', 'Show ' + v.label.toLowerCase());
			b.setAttribute('aria-pressed', v.id === 'split' ? 'true' : 'false');
			b.innerHTML =
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
				'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
				v.icon +
				'</svg>';
			b.addEventListener('click', function () {
				setView(v.id);
			});
			viewBtns[v.id] = b;
			views.appendChild(b);
		});
		if (!consoleOnly) bar.appendChild(views);

		var runBtn = button('Run', 'wwr-run', ICON_RUN);
		var resetBtn = button('Reset', 'wwr-reset', ICON_RESET);
		var openBtn = button('Open', 'wwr-open', ICON_OPEN);
		openBtn.title = 'Open your page in a new tab';
		/* Opening a blank page in a new tab is not a thing worth offering. */
		if (!consoleOnly) bar.appendChild(openBtn);
		bar.appendChild(runBtn);
		bar.appendChild(resetBtn);
		host.appendChild(bar);

		function setView(id) {
			host.classList.remove('wwr--view-split', 'wwr--view-code', 'wwr--view-preview');
			host.classList.add('wwr--view-' + id);
			VIEWS.forEach(function (v) {
				viewBtns[v.id].classList.toggle('is-on', v.id === id);
				viewBtns[v.id].setAttribute('aria-pressed', v.id === id ? 'true' : 'false');
			});
			metric('view_' + id, host);
		}
		/* Set directly rather than through setView(), which reports a view change:
		 * this is the starting state, not something the student chose. */
		host.classList.add(consoleOnly ? 'wwr--view-code' : 'wwr--view-split');

		/* ---- panes ---- */
		var body = document.createElement('div');
		body.className = 'wwr-body';
		host.appendChild(body);

		var editors = {};
		var pane = document.createElement('div');
		pane.className = 'wwr-panes';
		body.appendChild(pane);

		files.forEach(function (f, i) {
			var ed = makeEditor(f.name, f.code, schedule);
			ed.wrap.hidden = i !== 0;
			editors[f.name] = ed;
			pane.appendChild(ed.wrap);

			var t = document.createElement('button');
			t.type = 'button';
			t.className = 'wwr-tab' + (i === 0 ? ' is-active' : '');
			/* BOTH, ALWAYS. The lesson shows the icon and the builder shows the
			 * name (see ww-lesson.css), but the filename is in the DOM either way:
			 * it is the accessible name of the tab, it is what a screen reader
			 * announces, and it is what the builder's help sidebar reads to decide
			 * which file it is describing. An icon-only tab with no text is a
			 * button that says nothing to anyone who cannot see it. */
			t.innerHTML = fileIcon(f.name) + '<span class="wwr-tab-name">' + f.name + '</span>';
			t.title = f.name;
			t.setAttribute('role', 'tab');
			t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
			t.addEventListener('click', function () {
				files.forEach(function (other) {
					editors[other.name].wrap.hidden = other.name !== f.name;
				});
				Array.prototype.forEach.call(tabs.children, function (c) {
					c.classList.toggle('is-active', c === t);
					c.setAttribute('aria-selected', c === t ? 'true' : 'false');
				});
				metric('tab_' + f.name.split('.').pop(), host);
			});
			tabs.appendChild(t);
		});
		/* One file needs no tab strip — the lesson's inline examples would just be
		 * wearing chrome that explains nothing. */
		if (mode === 'single') tabs.hidden = true;

		var out = document.createElement('div');
		out.className = 'wwr-out';
		body.appendChild(out);

		/* TWO preview frames, not one.
		 *
		 * Assigning srcdoc tears the document down and rebuilds it, and the frame
		 * paints white in between. At a 400 ms debounce that is a white flash every
		 * time a student pauses typing — the page visibly flickering while they
		 * work, which is what it was doing.
		 *
		 * So: render into the hidden frame, and swap only once it has loaded. The
		 * student keeps looking at the last working render until the new one is
		 * ready, and never sees the gap. */
		function makeFrame() {
			var f = document.createElement('iframe');
			f.className = 'wwr-preview';
			f.title = 'Live preview' + (label ? ': ' + label : '');
			/* allow-scripts WITHOUT allow-same-origin: student code runs on an opaque
			 * origin and cannot reach this page, its storage, or its cookies. */
			f.setAttribute('sandbox', 'allow-scripts');
			out.appendChild(f);
			return f;
		}

		var frames = [makeFrame(), makeFrame()];
		var live = 0;
		frames[0].classList.add('is-live');

		/* The console spans the FULL width beneath both columns, rather than sitting
		 * in the right-hand column under the preview.
		 *
		 * It was nested in .wwr-out, which gave it half the width and stacked it
		 * against the student's own page — so a logged object wrapped after about
		 * forty characters and the preview lost a third of its height to a panel
		 * that is empty most of the time. console.log(data) on the game catalog is
		 * a chapter-4 instruction; it needs room to be readable. */
		var consoleBox = document.createElement('div');
		consoleBox.className = 'wwr-console';
		consoleBox.hidden = !showConsole;
		if (showConsole) {
			var chead = document.createElement('div');
			chead.className = 'wwr-console-head';
			chead.title = 'Drag to resize, or double-click to collapse';

			var ctitle = document.createElement('span');
			ctitle.textContent = 'Console';
			chead.appendChild(ctitle);

			var cspace = document.createElement('span');
			cspace.className = 'wwr-spacer';
			chead.appendChild(cspace);

			var cfold = document.createElement('button');
			cfold.type = 'button';
			cfold.className = 'wwr-fold';
			cfold.innerHTML =
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
				'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5 12 15l6-5.5"/></svg>';
			chead.appendChild(cfold);
			consoleBox.appendChild(chead);

			/* Resizable, because how much console a student wants is entirely
			 * situational: none at all while laying out HTML, and as much as
			 * possible on the chapter that is only about reading logged data.
			 * Anything fixed is wrong for somebody. */
			var MIN_H = 64;
			var collapsed = false;
			var lastHeight = 150;

			function setCollapsed(next) {
				collapsed = next;
				consoleBox.classList.toggle('is-collapsed', collapsed);
				consoleBox.style.height = collapsed ? '' : lastHeight + 'px';
				cfold.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
				cfold.setAttribute('aria-label', collapsed ? 'Show the console' : 'Hide the console');
				metric(collapsed ? 'console_collapsed' : 'console_expanded', host);
			}

			cfold.addEventListener('click', function (e) {
				e.stopPropagation();
				setCollapsed(!collapsed);
			});
			chead.addEventListener('dblclick', function () {
				setCollapsed(!collapsed);
			});

			var dragFrom = 0;
			var dragH = 0;

			function onMove(e) {
				/* Upwards is taller: the panel is anchored at the bottom of the card,
				 * so the handle moving up has to grow it, not shrink it. */
				var next = Math.max(MIN_H, dragH + (dragFrom - e.clientY));
				var ceiling = Math.max(MIN_H, host.getBoundingClientRect().height - 140);
				lastHeight = Math.min(next, ceiling);
				consoleBox.style.height = lastHeight + 'px';
			}

			function endDrag() {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', endDrag);
				document.body.classList.remove('wwr-resizing');
				metric('console_resized', host);
			}

			chead.addEventListener('pointerdown', function (e) {
				if (e.target.closest && e.target.closest('.wwr-fold')) return;
				if (collapsed) setCollapsed(false);
				e.preventDefault();
				dragFrom = e.clientY;
				dragH = consoleBox.getBoundingClientRect().height;
				/* On <body>, not the handle: it stops the drag selecting text across
				 * the whole page, and keeps the resize cursor while the pointer
				 * inevitably wanders off the 20px strip being dragged. */
				document.body.classList.add('wwr-resizing');
				document.addEventListener('pointermove', onMove);
				document.addEventListener('pointerup', endDrag);
			});

			/* Keyboard: the handle is a real control, so it has to be operable
			 * without a pointer. Arrows resize, Enter folds. */
			chead.tabIndex = 0;
			chead.setAttribute('role', 'separator');
			chead.setAttribute('aria-orientation', 'horizontal');
			chead.setAttribute('aria-label', 'Console size');
			chead.addEventListener('keydown', function (e) {
				if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
					e.preventDefault();
					if (collapsed) setCollapsed(false);
					lastHeight = Math.max(MIN_H, lastHeight + (e.key === 'ArrowUp' ? 24 : -24));
					consoleBox.style.height = lastHeight + 'px';
				} else if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					setCollapsed(!collapsed);
				}
			});

			setCollapsed(false);
		}
		var consoleLines = document.createElement('pre');
		consoleLines.className = 'wwr-console-lines';
		consoleLines.setAttribute('aria-live', 'polite');
		consoleBox.appendChild(consoleLines);
		host.appendChild(consoleBox);

		var errBox = document.createElement('div');
		errBox.className = 'wwr-error';
		errBox.hidden = true;
		errBox.setAttribute('role', 'status');
		errBox.setAttribute('aria-live', 'polite');
		host.appendChild(errBox);

		/* ---- running ---- */
		var timer = null;
		var firstRunDone = false;
		var firstFetchDone = false;

		function currentSources() {
			return {
				html: editors['index.html'] ? editors['index.html'].area.value : mode === 'single' ? singleValue('html') : '',
				css: editors['styles.css'] ? editors['styles.css'].area.value : mode === 'single' ? singleValue('css') : '',
				js: editors['main.js'] ? editors['main.js'].area.value : mode === 'single' ? singleValue('js') : '',
			};
		}

		/* In single-file mode the one editor holds whichever language the example
		 * teaches; the other two come from the element's static attributes, so a
		 * CSS example can still render against fixed HTML. */
		function singleValue(kind) {
			var f = files[0];
			if (f.kind === kind) return editors[f.name].area.value;
			return f.context && f.context[kind] ? f.context[kind] : '';
		}

		function schedule() {
			if (!autorun) {
				markDirty();
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(function () {
				run('auto');
			}, DEBOUNCE_MS);
		}

		function markDirty() {
			runBtn.classList.add('is-dirty');
		}

		var lastDoc = null;
		var consoleCount = 0;
		/* How many lines of OUR document sit above the student's code.
		 *
		 * `e.lineno` on a script error is relative to the whole document, and the
		 * document begins with a <head>, their HTML, and a hundred-odd lines of
		 * reporting harness. So a mistake on line 3 of a twelve-line file was
		 * reported as "line 103" — a number that does not exist in anything the
		 * student can see, and which sends them scrolling for code that is not
		 * theirs. Subtracting this is the difference between a line number that
		 * helps and one that actively misleads. */
		var jsLineOffset = 0;
		/* The parse error we already reported for this render, if any. */
		var syntaxProblem = null;

		function run(how) {
			clearTimeout(timer);
			runBtn.classList.remove('is-dirty');
			var src = currentSources();
			var doc = assembleDocument(src.html, src.css, src.js, HARNESS);

			/* Nothing changed — do not tear the page down to rebuild the same thing.
			 * Input events fire for plenty of reasons that leave the code identical
			 * (arrow keys, selection, a tab switch), and every one of those was
			 * costing a full reload and a flash. Run always honours an explicit
			 * press, because "I pressed Run and nothing happened" is worse. */
			if (doc === lastDoc && how !== 'manual') return;
			lastDoc = doc;

			clearError();
			consoleLines.textContent = '';
			consoleCount = 0;

			/* Parse the student's JavaScript here, where the real message is
			 * available, and report it before the frame gets a chance to hand us
			 * Safari's "Script error." instead. The page still renders — their HTML
			 * and CSS are probably fine, and seeing the rest of their work survive is
			 * a better experience than a blank rectangle. */
			syntaxProblem = syntaxErrorIn(src.js);
			if (syntaxProblem) {
				var si = explain(syntaxProblem.message);
				showError(si.title, syntaxProblem.message, si.help, syntaxProblem.line);
				logToConsole('error', syntaxProblem.message + (syntaxProblem.line ? '  (line ' + syntaxProblem.line + ')' : ''));
				metric('errors_' + si.key, host);
			}

			var next = frames[1 - live];
			next.onload = function () {
				next.onload = null;
				var old = frames[live];
				next.classList.add('is-live');
				old.classList.remove('is-live');
				live = 1 - live;
				/* Blank the retired frame so its timers, listeners and any runaway
				 * loop stop. Without this a student's setInterval would keep running
				 * — invisibly — once per render, forever. */
				old.onload = null;
				old.srcdoc = '';
			};
			/* The student's block is always the last one in the document. */
			var marker = '\n<script>\n';
			var at = doc.lastIndexOf(marker);
			jsLineOffset = at < 0 ? 0 : doc.slice(0, at + marker.length).split('\n').length - 1;

			next.srcdoc = doc;

			metric(how === 'manual' ? 'runs_manual' : 'runs_debounced', host);
			if (!firstRunDone) {
				firstRunDone = true;
				metric('first_run', host);
			}
		}

		/** The student's page on its own, with none of our reporting harness —
		 *  byte-identical to what Download produces. */
		function standaloneDoc() {
			var src = currentSources();
			return assembleDocument(src.html, src.css, src.js);
		}

		var openedUrl = null;
		function openInTab() {
			try {
				if (openedUrl) URL.revokeObjectURL(openedUrl);
				openedUrl = URL.createObjectURL(new Blob([standaloneDoc()], { type: 'text/html' }));
				/* A blob: URL rather than the srcdoc: the new tab gets a real origin,
				 * so fetch works there exactly as it does in a downloaded file — which
				 * is the point of offering this at all. */
				window.open(openedUrl, '_blank', 'noopener');
				metric('open_tab', host);
			} catch (e) {
				showError('Could not open a new tab', '', 'Your browser blocked the pop-up. Allow pop-ups for this page and try again.', null);
			}
		}

		function logToConsole(level, text) {
			if (!showConsole) return;
			var lineEl = document.createElement('div');
			lineEl.className = 'wwr-console-line is-' + level;
			lineEl.textContent = text;
			consoleLines.appendChild(lineEl);
			/* Second cap, on this side of the channel. The harness bounds what it
			 * sends per run; this bounds what the DOM has to hold across a long
			 * period of a student pressing Run over and over. */
			consoleCount++;
			while (consoleCount > 250 && consoleLines.firstChild) {
				consoleLines.removeChild(consoleLines.firstChild);
				consoleCount--;
			}
			consoleLines.scrollTop = consoleLines.scrollHeight;
		}

		function showError(title, message, help, line) {
			errBox.hidden = false;
			errBox.innerHTML = '';
			var h = document.createElement('div');
			h.className = 'wwr-error-title';
			h.textContent = title;
			errBox.appendChild(h);
			if (message) {
				var m = document.createElement('code');
				m.className = 'wwr-error-msg';
				m.textContent = message + (line ? '  (line ' + line + ')' : '');
				errBox.appendChild(m);
			}
			var p = document.createElement('p');
			p.className = 'wwr-error-help';
			p.textContent = help;
			errBox.appendChild(p);
		}

		function clearError() {
			errBox.hidden = true;
			errBox.textContent = '';
		}

		window.addEventListener('message', function (e) {
			var d = e && e.data;
			if (!d || d.__ww !== true) return;
			/* Every runner on the page hears every runner's messages, so match on the
			 * frames this instance owns rather than trusting anything in the payload.
			 * BOTH buffers count: the incoming render starts talking before it has
			 * been swapped in, and dropping those would lose the first console line
			 * and any error thrown during load — which is most of them. */
			if (e.source !== frames[0].contentWindow && e.source !== frames[1].contentWindow) return;

			if (d.kind === 'error') {
				/* We already described this failure from the host, where the message is
				 * real. The frame is about to report the same thing — as "Script error."
				 * in Safari, and as a duplicate in Chrome. One failure, one message.
				 *
				 * But take its LINE NUMBER if we lack one. The two sources are good at
				 * different halves of the problem: the host has the true message and no
				 * origin barrier, while Chrome attaches no line to a SyntaxError raised
				 * by new Function — and the frame, which parsed the code as a real
				 * script, knows exactly where it gave up. Message from one, position
				 * from the other. */
				if (syntaxProblem) {
					if (!syntaxProblem.line && d.payload.line) {
						var fromFrame = d.payload.line - jsLineOffset;
						var lines = currentSources().js.split('\n').length;
						if (fromFrame > 0) {
							syntaxProblem.line = Math.min(fromFrame, lines);
							var si2 = explain(syntaxProblem.message);
							showError(si2.title, syntaxProblem.message, si2.help, syntaxProblem.line);
							if (consoleLines.lastChild) consoleLines.lastChild.textContent += '  (line ' + syntaxProblem.line + ')';
						}
					}
					return;
				}
				var info = explain(d.payload.message);
				/* Report the line in THEIR file, or no line at all. A wrong line number
				 * is worse than none: it looks authoritative.
				 *
				 * Clamped to the length of the file because an end-of-input error is
				 * reported at the line AFTER the last one — Chrome is pointing at
				 * where input ran out, which is correct and useless. "Line 4" in a
				 * three-line file just reads as broken; the last line is where they
				 * actually need to look. */
				var line = d.payload.line ? d.payload.line - jsLineOffset : null;
				if (line > 0) {
					var total = currentSources().js.split('\n').length;
					line = Math.min(line, total);
				} else {
					line = null;
				}
				showError(info.title, d.payload.message, info.help, line);
				/* ALSO echo it into the console pane.
				 *
				 * Every console a student will ever meet shows errors alongside logs,
				 * so an error that appears only in a separate panel reads as the
				 * console being broken — especially in the case that matters most: a
				 * syntax error means NONE of their code ran, so nothing they logged
				 * shows up and the pane sits there empty with no explanation. The
				 * panel is the friendly version; this is the record of what happened. */
				logToConsole('error', d.payload.message + (line ? '  (line ' + line + ')' : ''));
				metric('errors_' + info.key, host);
			} else if (d.kind === 'hint') {
				var hint = SILENT_HINTS[d.payload.key];
				if (hint) {
					showError(hint.title, '', hint.help, null);
					logToConsole('warn', hint.title);
					metric('errors_' + d.payload.key, host);
				}
			} else if (d.kind === 'fetch') {
				metric(d.payload.ok ? 'fetch_ok' : 'fetch_failed', host);
				if (d.payload.ok && !firstFetchDone) {
					firstFetchDone = true;
					/* The funnel step that says a student got all the way to real data.
					 * Everything before it is setup; everything after is their own work. */
					metric('first_fetch_ok', host);
				}
			} else if (d.kind === 'console') {
				logToConsole(d.payload.level, d.payload.text);
			}
		});

		runBtn.addEventListener('click', function () {
			run('manual');
		});
		openBtn.addEventListener('click', openInTab);
		resetBtn.addEventListener('click', function () {
			files.forEach(function (f) {
				replaceValue(editors[f.name].area, f.code);
				editors[f.name].refresh();
			});
			metric('reset', host);
			run('manual');
		});

		/* Public surface, used by the builder page for save/download/seeding. */
		host.wwGet = currentSources;
		host.wwSet = function (next) {
			files.forEach(function (f) {
				if (next[f.name] != null) {
					replaceValue(editors[f.name].area, next[f.name]);
					editors[f.name].refresh();
				}
			});
			run('manual');
		};
		host.wwRun = function () {
			run('manual');
		};

		run('auto');
	}

	/* One icon per file kind, keyed off the extension.
	 *
	 * They are the three questions the lesson opens with, in the same order: a
	 * document for what is HERE, a drop of paint for what it LOOKS like, a bolt
	 * for what it DOES. Which means a student meets these shapes in chapter 1 as
	 * prose and again in every toolbar afterwards as a label.
	 *
	 * Drawn, like everything else on these pages, for the reason set out below:
	 * a character would be whatever glyph the platform's font decides. */
	var FILE_ICONS = {
		html: '<path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5z"/><path d="M13.5 3.5V8h4.5"/>',
		css: '<path d="M12 3.5s5.5 5.6 5.5 9.3a5.5 5.5 0 0 1-11 0C6.5 9.1 12 3.5 12 3.5z"/>',
		js: '<path d="M13.2 3.5 6.5 13.2h4.6l-.9 7.3 7-9.9h-4.6z"/>',
	};

	function fileIcon(name) {
		var ext = String(name).split('.').pop().toLowerCase();
		var path = FILE_ICONS[ext] || FILE_ICONS.html;
		return (
			'<svg class="wwr-tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
			'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			path +
			'</svg>'
		);
	}

	/* Icons are DRAWN, never typed.
	 *
	 * A play triangle and a reset arrow look like safe characters, and they are
	 * not: the glyph comes from whatever font the platform decides, so it lands
	 * anywhere between a hairline arrow and a full-colour emoji, at a size nothing
	 * else in the toolbar uses. On a school Windows machine missing the font it is
	 * a blank box on the one button a student needs most. Two SVG paths cost
	 * nothing and look the same everywhere. */
	var ICON_RUN = '<path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" stroke="none"/>';
	var ICON_OPEN =
		'<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/>' +
		'<path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>';
	var ICON_RESET =
		'<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.2 4v5h5"/>';

	function button(text, cls, icon) {
		var b = document.createElement('button');
		b.type = 'button';
		b.className = 'wwr-btn ' + cls;
		b.innerHTML =
			'<svg class="wwr-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
			'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			icon +
			'</svg>' +
			text;
		return b;
	}

	/**
	 * Read the starter files out of the element's <script type="text/ww-file">
	 * children.
	 *
	 * A script tag rather than a textarea or an attribute: the browser will not
	 * execute or render an unknown script type, so student-facing starter code can
	 * contain < and & and quotes without being HTML-escaped by hand in the page
	 * source. That matters — the starter code IS HTML in one of the three files.
	 */
	function readFiles(host) {
		var nodes = host.querySelectorAll('script[type="text/ww-file"]');
		var files = [];
		var context = {};
		Array.prototype.forEach.call(nodes, function (n) {
			var name = n.getAttribute('name') || 'main.js';
			var code = dedent(n.textContent || '');
			var kind = name.split('.').pop();
			if (n.hasAttribute('context')) {
				context[kind === 'js' ? 'js' : kind === 'css' ? 'css' : 'html'] = code;
				return;
			}
			files.push({ name: name, code: code, kind: kind === 'js' ? 'js' : kind === 'css' ? 'css' : 'html' });
		});
		if (!files.length) files.push({ name: 'main.js', code: '', kind: 'js' });
		files[0].context = context;
		return files;
	}

	/** Starter code is indented to match the page's HTML; students should not see
	 *  that indentation. Strip the common leading whitespace, tabs or spaces. */
	function dedent(text) {
		var lines = String(text).replace(/^\n+|\s+$/g, '').split('\n');
		var indent = null;
		lines.forEach(function (l) {
			if (!l.trim()) return;
			var m = l.match(/^[\t ]*/)[0];
			if (indent === null || m.length < indent.length) indent = m;
		});
		if (!indent) return lines.join('\n');
		return lines
			.map(function (l) {
				return l.indexOf(indent) === 0 ? l.slice(indent.length) : l;
			})
			.join('\n');
	}

	/**
	 * Start one runner. Safe to call twice — the second call is a no-op.
	 *
	 * Split out of init() so a page can hold some of its runners back. Every
	 * runner renders on start (see the run('auto') at the end of WwRunner), and
	 * each one owns two iframes, so a page with thirty of them opens thirty
	 * documents before the student has read a word. That is affordable for the
	 * chapters, which are the point of the page; it is not affordable for
	 * material inside a panel that begins closed and that most readers will never
	 * open. Those carry `defer` and are mounted when the panel is.
	 */
	function mount(host) {
		if (!host || host.dataset.wwReady) return;
		host.dataset.wwReady = '1';
		try {
			WwRunner(host);
		} catch (e) {
			/* A broken runner must not take the rest of the lesson down with it —
			 * the page is readable without any of them (see the static fallback
			 * markup each one wraps). */
			host.classList.add('wwr--failed');
			if (window.console) console.error('ww-runner failed to start', e);
		}
	}

	function init() {
		Array.prototype.forEach.call(document.querySelectorAll('ww-runner:not([defer])'), mount);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.WwRunner = {
		assembleDocument: assembleDocument,
		explain: explain,
		escapeForScript: escapeForScript,
		dedent: dedent,
		mount: mount,
	};
})();

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
	function assembleDocument(html, css, js) {
		return (
			'<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
			'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
			'<style>\n' +
			escapeForStyle(css || '') +
			'\n</style>\n</head>\n<body>\n' +
			(html || '') +
			'\n<script>\n' +
			escapeForScript(js || '') +
			'\n<\/script>\n</body>\n</html>\n'
		);
	}

	/**
	 * The bug this prevents: a student writes the string "</script>" — in a
	 * template literal building HTML, say — and the HTML parser ends the script
	 * block THERE. The rest of their JavaScript renders as visible text and the
	 * page silently does nothing. No error, no clue, and it looks like the editor
	 * ate their code.
	 *
	 * Only the `</script` sequence matters, and only case-insensitively; escaping
	 * the slash keeps the JavaScript semantically identical (inside a string,
	 * "<\/script>" === "</script>").
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
				'https://wildwillows.app/GameData/ — and if it looks right, ask your teacher: some school ' +
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
				'"deliberately nothing". Check the spelling in your HTML and your JavaScript — and remember ' +
				'#name looks for id="name", while .name looks for class="name".',
		},
		{
			key: 'undefined-property',
			match: /(reading|properties) (of )?'?undefined'?|of undefined/i,
			title: 'That piece of the data is not there',
			help:
				'undefined means "nothing found". You asked for something the data does not have — check the ' +
				'spelling of the property, and check you are not one level too deep (data.animals[0].name, ' +
				'not data.animals.name).',
		},
		{
			key: 'not-defined',
			match: /is not defined/i,
			title: 'JavaScript does not recognise that name',
			help:
				'Either it is spelled differently from where you created it, or it does not exist yet. ' +
				'Capital letters count: animal and Animal are two different names.',
		},
		{
			key: 'not-a-function',
			match: /is not a function/i,
			title: 'That is not something you can call',
			help:
				'You put () after something that is not a function — often a typo in the method name, or a ' +
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
				'for...of and the array methods need an array. Check what you actually got — it may be a single ' +
				'object, or undefined.',
		},
		{
			key: 'unexpected-eof',
			match: /unexpected end of input/i,
			title: 'Something was left open',
			help: 'Usually a missing } or ) or a missing closing quote. Check the end of the last few lines you wrote.',
		},
		{
			key: 'syntax',
			match: /syntaxerror|unexpected token|unexpected identifier/i,
			title: 'JavaScript could not read that',
			help:
				'A typo somewhere in the shape of the code — a missing comma, bracket or quote. The line number ' +
				'is where JavaScript gave up, so the real mistake is often just above it.',
		},
	];

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
	var HARNESS = [
		'(function(){',
		'  var send = function(kind, payload){ try { parent.postMessage({ __ww: true, kind: kind, payload: payload }, "*"); } catch(e){} };',
		'  window.addEventListener("error", function(e){',
		'    send("error", { message: String(e.message || e.error || "Error"), line: e.lineno || null });',
		'  });',
		'  window.addEventListener("unhandledrejection", function(e){',
		'    var r = e.reason; send("error", { message: String((r && r.message) || r || "Something failed"), line: null });',
		'  });',
		'  ["log","warn","error","info"].forEach(function(level){',
		'    var original = console[level];',
		'    console[level] = function(){',
		'      var parts = [];',
		'      for (var i = 0; i < arguments.length; i++) parts.push(format(arguments[i]));',
		'      send("console", { level: level, text: parts.join(" ") });',
		'      try { original.apply(console, arguments); } catch(e){}',
		'    };',
		'  });',
		/* Beginners log whole objects constantly; [object Object] would make the
		 * console pane useless for exactly the chapter it exists to support. */
		'  function format(v){',
		'    if (typeof v === "string") return v;',
		'    if (v instanceof Error) return v.message;',
		'    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }',
		'  }',
		/* The silent failure: no error is thrown, the page just renders the word
		 * "undefined" or "[object Object]". Nothing in the browser flags it, and a
		 * student stares at it with no idea what to search for. */
		'  window.addEventListener("load", function(){',
		'    setTimeout(function(){',
		'      var text = document.body ? document.body.innerText : "";',
		'      if (/\\[object Object\\]/.test(text)) send("hint", { key: "object-object" });',
		'      else if (/\\bundefined\\b/.test(text)) send("hint", { key: "undefined-text" });',
		'    }, 300);',
		'  });',
		'})();',
	].join('\n');

	var SILENT_HINTS = {
		'object-object': {
			title: 'Your page is showing [object Object]',
			help:
				'You are putting a whole object on the page where you meant one part of it. ' +
				'Try adding the piece you want — for example .name instead of the whole animal.',
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
		area.setAttribute('aria-label', file + ' — code editor');
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
				var start = area.selectionStart;
				var end = area.selectionEnd;
				area.value = area.value.slice(0, start) + '  ' + area.value.slice(end);
				area.selectionStart = area.selectionEnd = start + 2;
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

		host.classList.add('wwr', mode === 'multi' ? 'wwr--multi' : 'wwr--single');
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

		var runBtn = button('Run', 'wwr-run', '▶');
		var resetBtn = button('Reset', 'wwr-reset', '↺');
		bar.appendChild(runBtn);
		bar.appendChild(resetBtn);
		host.appendChild(bar);

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
			t.textContent = f.name;
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

		var frame = document.createElement('iframe');
		frame.className = 'wwr-preview';
		frame.title = 'Live preview' + (label ? ' — ' + label : '');
		/* allow-scripts WITHOUT allow-same-origin: student code runs on an opaque
		 * origin and cannot reach this page, its storage, or its cookies. */
		frame.setAttribute('sandbox', 'allow-scripts');
		out.appendChild(frame);

		var consoleBox = document.createElement('div');
		consoleBox.className = 'wwr-console';
		consoleBox.hidden = !showConsole;
		if (showConsole) {
			var chead = document.createElement('div');
			chead.className = 'wwr-console-head';
			chead.textContent = 'Console';
			consoleBox.appendChild(chead);
		}
		var consoleLines = document.createElement('pre');
		consoleLines.className = 'wwr-console-lines';
		consoleLines.setAttribute('aria-live', 'polite');
		consoleBox.appendChild(consoleLines);
		out.appendChild(consoleBox);

		var errBox = document.createElement('div');
		errBox.className = 'wwr-error';
		errBox.hidden = true;
		errBox.setAttribute('role', 'status');
		errBox.setAttribute('aria-live', 'polite');
		host.appendChild(errBox);

		/* ---- running ---- */
		var timer = null;
		var firstRunDone = false;

		function currentSources() {
			return {
				html: editors['index.html'] ? editors['index.html'].area.value : mode === 'single' ? singleValue('html') : '',
				css: editors['styles.css'] ? editors['styles.css'].area.value : mode === 'single' ? singleValue('css') : '',
				js: editors['index.js'] ? editors['index.js'].area.value : mode === 'single' ? singleValue('js') : '',
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

		function run(how) {
			clearTimeout(timer);
			runBtn.classList.remove('is-dirty');
			clearError();
			consoleLines.textContent = '';
			var src = currentSources();
			var doc = assembleDocument(src.html, src.css, HARNESS + '\n' + src.js);
			/* Reassigning srcdoc reloads the frame, which is what discards the
			 * previous run's timers, listeners and any runaway state. */
			frame.srcdoc = doc;
			metric(how === 'manual' ? 'runs_manual' : 'runs_debounced', host);
			if (!firstRunDone) {
				firstRunDone = true;
				metric('first_run', host);
			}
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
				m.textContent = message + (line ? '  — line ' + line : '');
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
			/* Every runner on the page hears every runner's messages — opaque-origin
			 * frames give us no usable source identity, so match on the frame's own
			 * contentWindow instead of trusting anything in the payload. */
			if (e.source !== frame.contentWindow) return;

			if (d.kind === 'error') {
				var info = explain(d.payload.message);
				showError(info.title, d.payload.message, info.help, d.payload.line);
				metric('errors_' + info.key, host);
			} else if (d.kind === 'hint') {
				var hint = SILENT_HINTS[d.payload.key];
				if (hint) {
					showError(hint.title, '', hint.help, null);
					metric('errors_' + d.payload.key, host);
				}
			} else if (d.kind === 'console' && showConsole) {
				var lineEl = document.createElement('div');
				lineEl.className = 'wwr-console-line is-' + d.payload.level;
				lineEl.textContent = d.payload.text;
				consoleLines.appendChild(lineEl);
				consoleLines.scrollTop = consoleLines.scrollHeight;
			}
		});

		runBtn.addEventListener('click', function () {
			run('manual');
		});
		resetBtn.addEventListener('click', function () {
			files.forEach(function (f) {
				editors[f.name].area.value = f.code;
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
					editors[f.name].area.value = next[f.name];
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

	function button(text, cls, glyph) {
		var b = document.createElement('button');
		b.type = 'button';
		b.className = 'wwr-btn ' + cls;
		b.innerHTML = '<span aria-hidden="true">' + glyph + '</span> ' + text;
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
			var name = n.getAttribute('name') || 'index.js';
			var code = dedent(n.textContent || '');
			var kind = name.split('.').pop();
			if (n.hasAttribute('context')) {
				context[kind === 'js' ? 'js' : kind === 'css' ? 'css' : 'html'] = code;
				return;
			}
			files.push({ name: name, code: code, kind: kind === 'js' ? 'js' : kind === 'css' ? 'css' : 'html' });
		});
		if (!files.length) files.push({ name: 'index.js', code: '', kind: 'js' });
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

	function init() {
		Array.prototype.forEach.call(document.querySelectorAll('ww-runner'), function (host) {
			if (host.dataset.wwReady) return;
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
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.WwRunner = { assembleDocument: assembleDocument, explain: explain, escapeForScript: escapeForScript, dedent: dedent };
})();

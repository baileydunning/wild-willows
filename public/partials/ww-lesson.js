/* Wild Willows: the student lesson at /learn/web-development.
 *
 * The page's own behavior. The editors and previews are ww-runner.js; this file
 * is everything the lesson adds around them:
 *
 *   • the chapter rail: where you are, where you have been, and per-chapter
 *     dwell time bucketed for the dashboard
 *   • the API probe in chapter 3: a real request to /GameData, reporting the
 *     status, the time and the size a student's own network actually produced
 *   • the JSON tree: collapsible, colored by type, shared by chapters 3 and 5
 *   • the path explorer in chapter 5: type a path, see which part of the tree
 *     it selected and what type came back
 *   • the five challenges in chapter 9, and the hand-off into the Code Builder
 *   • one batched beacon of anonymous counters, on the same contract as the
 *     builder's (see PRIVACY.md): names from a fixed list and numbers, nothing
 *     else, ever.
 *
 * No framework, no build step, no CDN. This file is inlined into the page at
 * build time by the @include directive in scripts/build-pages.mjs.
 */
(function () {
	'use strict';

	var CHAPTERS = 10;
	var API_URL = 'https://wildwillows.app/GameData';
	var DONE_KEY = 'wwLessonDone'; // chapters seen, for the rail's ticks
	var CHAL_KEY = 'wwLessonChallenges'; // which of chapter 9's five are ticked

	/* ------------------------------------------------------------- counters
	 *
	 * READ THE NOTE ON flush() IN ww-builder.js BEFORE CHANGING THIS. It is the
	 * same design and it is the same trap: counts are emptied on every send, and
	 * anything that should be reported exactly once per session rides on the
	 * final flush only. The builder's version of this once kept a batch after
	 * sending it, behind a latch, and the five-minute timer sent it a second
	 * time: every counter before a student's first tab switch was recorded
	 * twice. Do not reintroduce a latch here. */
	var counts = {};
	var summarySent = false;

	function bump(key) {
		counts[key] = (counts[key] || 0) + 1;
	}

	/* FIRST VISIT EVER, not first visit this session.
	 *
	 * `view_lesson` is traffic and this is reach: how many different browsers have
	 * ever opened the page. The gap between the two is how much of the traffic is
	 * the same people coming back, which for a lesson is the difference between
	 * being used and being reloaded. One bit, readable only by this origin, and
	 * it identifies nobody. */
	function bumpFirstEver() {
		try {
			if (localStorage.getItem('ww_ever_lesson')) return;
			localStorage.setItem('ww_ever_lesson', '1');
		} catch (e) {
			/* storage refused: overstating reach a little beats losing it */
		}
		bump('unique_lesson');
	}

	/** Counters that describe the session as a whole rather than an event in it:
	 *  how many chapters were reached, how many challenges ticked, and how long
	 *  was spent in each chapter. Once per session, at the end. */
	function addSummary() {
		var reached = 0;
		for (var i = 1; i <= CHAPTERS; i++) if (dwell[i] > 0) reached++;
		if (reached) bump('chapters_' + Math.min(CHAPTERS, reached));

		var ticked = challengesDone().length;
		if (ticked) bump('challenges_' + Math.min(5, ticked));

		for (var c = 1; c <= CHAPTERS; c++) {
			var band = dwellBand(dwell[c] || 0);
			if (band) bump('dwell_chapter-' + c + '_' + band);
		}

		/* HOW LONG THE WHOLE VISIT WAS, which the per-chapter bands cannot answer.
		 * Summing them would count only the time a chapter was the current one and
		 * would miss every session that never settled on one; and the question a
		 * teacher actually asks is about the period, not about chapter 7. */
		var whole = sessionBand(totalMs);
		if (whole) bump('dwell_lesson_' + whole);
	}

	/** Bucketed, never a raw duration. A precise per-chapter time is a behavioral
	 *  trace of one reader; a band answers "is chapter 7 too long" just as well and
	 *  describes nobody. Under ten seconds is scrolling past, not reading. */
	/* Bands for a whole visit, cut where the answers differ: under two minutes is
	 * a look rather than a lesson, an hour is a full period, and the two in
	 * between are the difference between one sitting and most of a class. Under
	 * five seconds is a prefetch, a bot or a mis-click, and says nothing.
	 *
	 * Bucketed for the same reason every other duration here is (see PRIVACY.md):
	 * a precise session length is a trace of one reader, and a band answers "does
	 * this fit in a period" just as well while describing nobody. */
	function sessionBand(ms) {
		if (ms < 5000) return null;
		var m = ms / 60000;
		if (m < 2) return 'lt2m';
		if (m < 10) return '2to10m';
		if (m < 30) return '10to30m';
		if (m < 60) return '30to60m';
		return 'gt60m';
	}

	function dwellBand(ms) {
		if (ms < 10000) return null;
		var m = ms / 60000;
		if (m < 1) return 'lt1m';
		if (m < 3) return '1to3m';
		if (m < 10) return '3to10m';
		return 'gt10m';
	}

	function flush(final) {
		tickDwell();
		if (final && !summarySent) {
			summarySent = true;
			addSummary();
		}
		if (!Object.keys(counts).length) return;
		var batch = counts;
		counts = {};
		try {
			var body = JSON.stringify({ page: 'lesson', counts: batch });
			if (navigator.sendBeacon) navigator.sendBeacon('/LessonEvent/', new Blob([body], { type: 'application/json' }));
		} catch (e) {
			/* analytics never gets to break a lesson */
		}
	}

	/* Everything ww-runner reports (runs, errors, fetch outcomes, view changes)
	 * arrives here as a bubbling event, so instrumentation is written once rather
	 * than at each of the page's fifteen runners. */
	document.addEventListener('ww:metric', function (e) {
		if (!e || !e.detail || !e.detail.key) return;
		bump(e.detail.key);
		/* A runner tagged with the concept it teaches also reports that concept the
		 * first time it is actually run. That is what makes "which iterator methods
		 * did students really try" answerable: as opposed to "which ones were on
		 * the page", which we already know. */
		var host = e.target && e.target.closest && e.target.closest('ww-runner[data-concept]');
		if (host && !host.dataset.conceptSent && /^runs_/.test(e.detail.key)) {
			host.dataset.conceptSent = '1';
			bump(host.getAttribute('data-concept'));
		}
	});

	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden') {
			tickDwell(); // bank what was earned up to this moment…
			visible = false; // …and then stop the clock
			flush(false);
			return;
		}
		/* Back on screen. Restart from now, or the next tick would quietly count
		 * the whole time the tab spent in the background — the exact thing the
		 * gates above exist to prevent. Switching back is itself an interaction. */
		visible = true;
		lastInput = Date.now();
		if (since) since = Date.now();
		totalSince = Date.now();
	});
	window.addEventListener('pagehide', function () {
		flush(true);
	});
	setInterval(function () {
		flush(false);
	}, 300000);

	/* ------------------------------------------------------ small utilities */

	function $(sel, root) {
		return (root || document).querySelector(sel);
	}
	function $$(sel, root) {
		return Array.prototype.slice.call((root || document).querySelectorAll(sel));
	}
	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}
	function store(key, value) {
		try {
			if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
			localStorage.setItem(key, JSON.stringify(value));
		} catch (e) {
			/* Guest mode and managed Chromebooks: storage can be unavailable or
			 * full. The lesson works without it: you lose the ticks, not the page. */
			if (value === undefined) return null;
		}
		return null;
	}

	/* ------------------------------------------- the rail, and chapter dwell */

	var dwell = {}; // chapter number -> milliseconds actually spent
	var totalMs = 0; // the whole session, same clock
	var currentCh = 0;
	var since = 0;
	var totalSince = Date.now();

	/* TIME IS ONLY COUNTED WHILE SOMEBODY IS ACTUALLY HERE.
	 *
	 * Wall-clock is the wrong measure and it was the one being used. The old
	 * version added `now - since` on every tick with nothing to stop it, so a tab
	 * left open on chapter 7 over a weekend reported chapter 7 as gt10m — the
	 * lesson's longest chapter, made to look longer by a browser nobody was
	 * looking at. Two gates fix it:
	 *
	 *   VISIBLE. A background tab counts for nothing. Note that the flag is kept
	 *   here rather than read at tick time: the handler has to bank the time up
	 *   to the moment of hiding, and by then visibilityState already says hidden.
	 *
	 *   RECENT. Five minutes past the last scroll, key or tap the clock stops,
	 *   and starts again on the next one. Long enough to read a chapter without
	 *   touching anything, short enough that a class that walked out at the bell
	 *   does not read as an hour of study.
	 *
	 * Both gates only ever REMOVE time, so every number this produces is a floor.
	 * That is the right direction for a figure a teacher plans a period against. */
	var IDLE_MS = 300000;
	var visible = document.visibilityState !== 'hidden';
	var lastInput = Date.now();

	['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) {
		window.addEventListener(
			ev,
			function () {
				lastInput = Date.now();
			},
			{ passive: true, capture: true },
		);
	});

	/** Milliseconds between `from` and now that anybody was present for. */
	function countable(from, now) {
		if (!visible || !from) return 0;
		return Math.max(0, Math.min(now, lastInput + IDLE_MS) - from);
	}

	function tickDwell() {
		var now = Date.now();
		totalMs += countable(totalSince, now);
		totalSince = now;
		if (!currentCh || !since) return;
		dwell[currentCh] = (dwell[currentCh] || 0) + countable(since, now);
		since = now;
	}

	function setCurrent(n) {
		if (n === currentCh) return;
		tickDwell();
		currentCh = n;
		since = Date.now();
		$$('.lrail a').forEach(function (a) {
			a.classList.toggle('is-current', Number(a.getAttribute('data-ch')) === n);
			if (Number(a.getAttribute('data-ch')) === n) a.setAttribute('aria-current', 'true');
			else a.removeAttribute('aria-current');
		});
		markDone(n);
	}

	function doneSet() {
		var raw = store(DONE_KEY);
		return Array.isArray(raw) ? raw : [];
	}

	function markDone(n) {
		if (!n) return;
		if (!dwell[n]) {
			dwell[n] = 0;
			bump('chapter_' + n + '_reached');
			if (n === 1) bump('lesson_start');
		}
		var seen = doneSet();
		if (seen.indexOf(n) < 0) {
			seen.push(n);
			store(DONE_KEY, seen);
		}
		paintDone();
	}

	function paintDone() {
		var seen = doneSet();
		$$('.lrail a').forEach(function (a) {
			var n = Number(a.getAttribute('data-ch'));
			a.classList.toggle('is-done', seen.indexOf(n) >= 0 && n !== currentCh);
		});
	}

	function initRail() {
		paintDone();
		var sections = $$('.ch[id^="chapter-"]');
		if (!sections.length) return;

		/* WHICH CHAPTER IS "CURRENT" IS A GEOMETRY QUESTION, not a visibility one.
		 *
		 * The obvious version of this: rank the sections by intersection ratio and
		 * take the highest: has a hole at both ends of the page, and the top one
		 * is the one a student sees first: standing at the hero, NO chapter is
		 * intersecting, every ratio is 0, and the rail highlights nothing at all.
		 * A syllabus that shows no position until you have scrolled past the first
		 * heading is worse than no syllabus.
		 *
		 * So: the current chapter is the LAST one whose top has passed the reading
		 * line, and chapter 1 before any of them have. That is well defined
		 * everywhere on the page, including both ends and including a final
		 * chapter too short to ever win on ratio.
		 *
		 * The observer is still here, but only as a cheap way to be told that
		 * something moved: it does not decide anything. That keeps this off the
		 * scroll path, which matters on the Chromebooks this page is written for. */
		var READING_LINE = 96; // px below the sticky nav

		function pick() {
			var best = 0;
			sections.forEach(function (sec) {
				if (sec.getBoundingClientRect().top - READING_LINE <= 0) best = Number(sec.id.replace('chapter-', ''));
			});
			setCurrent(best || 1);
		}

		pick();

		if (!window.IntersectionObserver) {
			/* No observer: fall back to the scroll event, throttled to one frame.
			 * Older managed Chromebooks do exist and the rail is not optional. */
			var queued = false;
			window.addEventListener(
				'scroll',
				function () {
					if (queued) return;
					queued = true;
					requestAnimationFrame(function () {
						queued = false;
						pick();
					});
				},
				{ passive: true },
			);
			return;
		}

		var obs = new IntersectionObserver(pick, { rootMargin: '-96px 0px 0px 0px', threshold: [0, 0.02, 0.5, 1] });
		sections.forEach(function (sec) {
			obs.observe(sec);
		});
	}

	/* --------------------------------------------------------- the JSON tree
	 *
	 * Written by hand rather than dumping JSON.stringify into a <pre> for one
	 * reason: the colors ARE the lesson. Chapter 3 names six types in a table,
	 * and a tree that paints strings, numbers, booleans and null differently
	 * means a student sees the type before they read anything about it: and in
	 * chapter 5 they can see that a path landed on an array rather than a string
	 * without running it. */

	function typeOf(v) {
		if (v === null) return 'null';
		if (Array.isArray(v)) return 'array';
		return typeof v; // string | number | boolean | object
	}

	var TYPE_CLASS = { string: 'jstr', number: 'jnum', boolean: 'jbool', null: 'jnull' };

	/** A human sentence naming what a value is: used under the tree and by the
	 *  chapter 5 explorer, so chapter 3's table gets used rather than read once. */
	function describe(v) {
		var t = typeOf(v);
		if (t === 'array') return 'an array of ' + v.length + ' thing' + (v.length === 1 ? '' : 's');
		if (t === 'object') {
			var n = Object.keys(v).length;
			return 'an object with ' + n + ' part' + (n === 1 ? '' : 's');
		}
		if (t === 'null') return 'null: nothing, on purpose';
		if (t === 'undefined') return 'undefined: there is nothing here';
		return 'a ' + t;
	}

	/** One row of the tree. `open` controls whether containers start expanded;
	 *  everything below the top level starts folded so 150 animals do not arrive
	 *  as a wall. */
	function jsonRow(key, value, depth, openTo) {
		var t = typeOf(v_(value));
		var row = el('div', 'jrow');
		var wrap = el('div', 'jnode');
		var container = t === 'object' || t === 'array';
		wrap.appendChild(row);

		var kids = null;
		if (container) {
			var toggle = el('button', 'jtoggle');
			toggle.type = 'button';
			var open = depth < openTo;
			setChevron(toggle, open);
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			row.appendChild(toggle);
			if (key != null) row.appendChild(el('span', 'jkey', key + ':'));
			row.appendChild(el('span', 'jmeta', summary(value)));

			kids = el('div', 'jkids');
			kids.hidden = !open;
			wrap.appendChild(kids);
			var built = open;
			if (open) buildKids(kids, value, depth, openTo);

			toggle.addEventListener('click', function () {
				var nowOpen = kids.hidden;
				if (nowOpen && !built) {
					built = true;
					buildKids(kids, value, depth, openTo);
				}
				kids.hidden = !nowOpen;
				setChevron(toggle, nowOpen);
				toggle.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
				if (nowOpen) bump('types_tree-expanded');
			});
		} else {
			row.appendChild(el('span', 'jspace'));
			if (key != null) row.appendChild(el('span', 'jkey', key + ':'));
			row.appendChild(el('span', TYPE_CLASS[t] || 'jmeta', literal(value)));
		}
		return wrap;
	}

	function v_(x) {
		return x;
	}

	/* The fold marker is DRAWN, not typed.
	 *
	 * Every icon on these pages is an SVG path, and the reason is the one that
	 * rules out emoji: a geometric-shape character is whatever glyph the
	 * platform's font decides: a hairline arrow on one machine, a full-color
	 * pictograph at a size nothing else on the page uses on another, and an empty
	 * box on a managed Chromebook missing the font. This is a control a student
	 * hits a hundred times to read one record; it does not get to be a lottery.
	 *
	 * (This comment deliberately does not print the character it is arguing
	 * about. tests/unit/built-pages.test.ts scans the delivered page for
	 * pictographs, and this file is inlined into it: a comment naming the
	 * forbidden glyph would be the thing that fails the check. The runner partial
	 * learned the same lesson about closing script tags.)
	 *
	 * One path, rotated, so open and closed cannot drift apart. */
	function setChevron(button, open) {
		button.innerHTML =
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
			'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
			'style="width:.62em;height:.62em;display:block;transition:transform .12s ease;' +
			'transform:rotate(' +
			(open ? 90 : 0) +
			'deg)"><path d="M9 5l7 7-7 7"/></svg>';
	}

	function summary(value) {
		if (Array.isArray(value)) return 'Array(' + value.length + ')';
		return '{ ' + Object.keys(value).length + ' }';
	}

	function literal(value) {
		var t = typeOf(value);
		if (t === 'string') {
			var s = value.length > 90 ? value.slice(0, 90) + '…' : value;
			return '"' + s + '"';
		}
		return String(value);
	}

	/** Children are built the first time a node is opened, not up front. The full
	 *  catalog is a few hundred kilobytes of JSON; rendering every node of it
	 *  eagerly is tens of thousands of elements and a visibly janky page on the
	 *  hardware this lesson is written for. */
	function buildKids(into, value, depth, openTo) {
		var isArr = Array.isArray(value);
		var keys = isArr ? null : Object.keys(value);
		var n = isArr ? value.length : keys.length;
		var LIMIT = 40;
		for (var i = 0; i < Math.min(n, LIMIT); i++) {
			var k = isArr ? String(i) : keys[i];
			into.appendChild(jsonRow(k, isArr ? value[i] : value[k], depth + 1, openTo));
		}
		if (n > LIMIT) {
			var more = el('button', 'jtoggle jmore', 'show ' + (n - LIMIT) + ' more');
			more.type = 'button';
			more.addEventListener('click', function () {
				more.remove();
				for (var j = LIMIT; j < n; j++) {
					var kk = isArr ? String(j) : keys[j];
					into.appendChild(jsonRow(kk, isArr ? value[j] : value[kk], depth + 1, openTo));
				}
			});
			into.appendChild(more);
		}
	}

	function renderTree(mount, value, openTo) {
		mount.innerHTML = '';
		mount.appendChild(jsonRow(null, value, 0, openTo == null ? 1 : openTo));
	}

	/* ------------------------------------------------------ the API probe */

	var gameData = null; // shared by chapters 3 and 5: fetched at most once
	var pending = null;

	function loadGameData() {
		if (gameData) return Promise.resolve({ data: gameData, cached: true });
		if (pending) return pending;
		var started = Date.now();
		pending = fetch(API_URL)
			.then(function (res) {
				return res.text().then(function (text) {
					var ms = Date.now() - started;
					var data = JSON.parse(text);
					gameData = data;
					return { data: data, ms: ms, status: res.status, bytes: text.length };
				});
			})
			.catch(function (err) {
				pending = null;
				throw err;
			});
		return pending;
	}

	function initProbe() {
		var probe = $('#api-probe');
		if (!probe) return;
		var btn = $('#probe-go', probe);
		var out = $('#probe-out', probe);
		var tree = $('#probe-tree', probe);
		if (!btn) return;

		btn.addEventListener('click', function () {
			btn.disabled = true;
			var label = btn.textContent;
			btn.textContent = 'Asking…';
			out.hidden = false;
			out.innerHTML = '';
			loadGameData()
				.then(function (r) {
					btn.disabled = false;
					btn.textContent = label;
					bump('fetch_ok');
					/* REAL NUMBERS FROM THEIR OWN NETWORK. A screenshot of a response
					 * teaches nothing; "412 ms, 318 KB, on this school's wifi" is a
					 * fact about the machine in front of them. */
					out.appendChild(stat(r.cached ? 'n/a' : r.status, 'status'));
					out.appendChild(stat(r.cached ? 'cached' : r.ms + ' ms', 'took'));
					out.appendChild(stat(r.cached ? 'n/a' : Math.round(r.bytes / 1024) + ' KB', 'size'));
					out.appendChild(stat(Object.keys(r.data).length, 'top-level keys'));
					if (tree) renderTree(tree, r.data, 1);
				})
				.catch(function () {
					btn.disabled = false;
					btn.textContent = label;
					bump('fetch_failed');
					out.textContent =
						'The request did not get through. That is usually the school network blocking it rather than anything on this page. Try again, and tell your teacher if it keeps happening.';
				});
		});
	}

	function stat(value, label) {
		var box = el('div', 'pstat');
		box.appendChild(el('b', null, String(value)));
		box.appendChild(el('span', null, label));
		return box;
	}

	/* ------------------------------------------ chapter 5: the path explorer
	 *
	 * A student types data.animals[0].name and sees which row of the tree it
	 * landed on and what type came back. The path is PARSED, not evaluated: this
	 * takes text a student typed and walks it across our own object, and eval on
	 * that input would be a needless liability on a page built for schools.
	 * Parsing also gives a better error: it can say which step failed. */

	function parsePath(text) {
		var src = String(text).trim();
		if (src.indexOf('data') !== 0) return { error: 'Start the path with `data`.' };
		var rest = src.slice(4);
		var steps = [];
		var re = /^\s*(?:\.([A-Za-z_$][\w$]*)|\[\s*(\d+)\s*\]|\[\s*'([^']*)'\s*\]|\[\s*"([^"]*)"\s*\])/;
		while (rest.length) {
			var m = re.exec(rest);
			if (!m) return { error: 'I could not read this part: `' + rest.trim() + '`' };
			steps.push(m[1] != null ? m[1] : m[2] != null ? Number(m[2]) : m[3] != null ? m[3] : m[4]);
			rest = rest.slice(m[0].length);
			if (/^\s*$/.test(rest)) break;
		}
		return { steps: steps };
	}

	function walk(root, steps) {
		var cur = root;
		for (var i = 0; i < steps.length; i++) {
			if (cur === null || cur === undefined) return { missing: true, at: i };
			cur = cur[steps[i]];
		}
		return { value: cur };
	}

	function initExplorer() {
		var box = $('#ch5-explorer');
		if (!box) return;
		var input = $('#ch5-path', box);
		var go = $('#ch5-go', box);
		var out = $('#ch5-out', box);
		var tree = $('#ch5-tree', box);
		if (!input || !go) return;

		function show(msg, cls) {
			out.className = 'cap' + (cls ? ' ' + cls : '');
			out.textContent = msg;
		}

		function run() {
			var parsed = parsePath(input.value);
			if (parsed.error) return show(parsed.error);
			loadGameData()
				.then(function (r) {
					var got = walk(r.data, parsed.steps);
					if (got.missing)
						return show('That path stops early: `' + parsed.steps.slice(0, got.at).join('.') + '` is not there.');
					var v = got.value;
					if (v === undefined) {
						/* The undefined callout from the plan, delivered by the student's
						 * own typo rather than by a paragraph they skimmed. */
						show(
							'undefined: there is nothing at that path. Not an error, not zero, not empty. It is JavaScript saying "nothing here".',
						);
					} else {
						show(describe(v) + (typeOf(v) === 'string' ? ': ' + literal(v) : ''));
					}
					if (tree) {
						renderTree(tree, v === undefined ? {} : v, 1);
						var first = $('.jrow', tree);
						if (first) first.classList.add('is-lit');
					}
					bump('types_tree-expanded');
				})
				.catch(function () {
					show('Could not load the data to look in. Check the network and try the button in chapter 3.');
				});
		}

		go.addEventListener('click', run);
		input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				e.preventDefault();
				run();
			}
		});
		$$('[data-path]', box).forEach(function (b) {
			b.addEventListener('click', function () {
				input.value = b.getAttribute('data-path');
				run();
			});
		});
	}

	/* ------------------------------------------------------- going deeper
	 *
	 * One panel per chapter, each closed, each holding its own runners back.
	 *
	 * The runners carry `defer`, so ww-runner.js leaves them alone at boot and
	 * they are started here when their panel is first opened. That is not a
	 * micro-optimization: every runner renders on start and each owns two
	 * iframes, and the chapters already open sixty-odd documents before a
	 * student has read a word. Paying for another twenty on behalf of panels
	 * most readers never open is the difference between this page being usable
	 * on a school Chromebook and not.
	 *
	 * Two counters, and the difference between them is the useful part.
	 * `deeper_opened` is every open on the page. `deeper_chapter-N` says WHICH
	 * chapters leave students wanting more, which is the question that decides
	 * where the next piece of writing should go. */

	/* Where a reader went next. The nav links leave the page, so this has to be a
	 * plain click listener rather than anything that waits for a response:
	 * bump() batches into the pagehide flush, which fires on the way out.
	 *
	 * The same map lives in ww-builder.js and in the hub's own script. Three
	 * copies of five pairs is less bad than a fourth shared partial for it, but
	 * they do have to agree, so the KEYS are the allowlist in server/resources.ts
	 * and that is the thing to check against. */
	var NAV = {
		'learn-nav': 'nav_learn',
		'lesson-nav': 'nav_lesson',
		'builder-nav': 'nav_builder',
		'hub-nav': 'nav_hub',
		'game-nav': 'nav_game',
		'api-nav': 'nav_api',
	};

	function initNav() {
		document.addEventListener('click', function (e) {
			var a = e.target && e.target.closest && e.target.closest('a[data-track]');
			if (a && NAV[a.getAttribute('data-track')]) bump(NAV[a.getAttribute('data-track')]);
		});
	}

	function initDeeper() {
		$$('details.deeper').forEach(function (panel) {
			var started = false;
			var which = panel.getAttribute('data-deeper');
			panel.addEventListener('toggle', function () {
				if (!panel.open) return;
				bump('deeper_opened');
				if (which) bump('deeper_' + which);
				if (started) return;
				started = true;
				var mount = window.WwRunner && window.WwRunner.mount;
				$$('ww-runner[defer]', panel).forEach(function (host) {
					host.removeAttribute('defer');
					if (mount) mount(host);
				});
			});
		});
	}

	/* ------------------------------------------------ chapter 3 type legend */

	function initLegend() {
		var d = $('#types-legend');
		if (!d) return;
		d.addEventListener('toggle', function () {
			if (d.open) bump('types_legend-opened');
		});
	}

	/* ------------------------------------------------- chapter 9 challenges */

	function challengesDone() {
		var raw = store(CHAL_KEY);
		return Array.isArray(raw) ? raw : [];
	}

	function initChallenges() {
		var list = $('#challenges');
		if (!list) return;
		var done = challengesDone();

		$$('.chal', list).forEach(function (row) {
			var id = row.getAttribute('data-chal');
			var box = $('.chal-box', row);
			if (!box) return;
			var on = done.indexOf(id) >= 0;
			row.classList.toggle('is-done', on);
			box.setAttribute('aria-pressed', on ? 'true' : 'false');

			box.addEventListener('click', function () {
				var now = challengesDone();
				var at = now.indexOf(id);
				var turningOn = at < 0;
				if (turningOn) now.push(id);
				else now.splice(at, 1);
				store(CHAL_KEY, now);
				row.classList.toggle('is-done', turningOn);
				box.setAttribute('aria-pressed', turningOn ? 'true' : 'false');
				if (turningOn) bump('challenge_' + id);
			});
		});
	}

	/* --------------------------------------------------- hand-off to builder
	 *
	 * Chapter 9's last runner carries across into the Code Builder, so a student
	 * arrives there with their own work already open rather than with a starter
	 * project that throws it away. The code travels in the URL FRAGMENT, which
	 * browsers do not send to the server: their code stays theirs, and the
	 * promise on this page and in PRIVACY.md stays true. */

	function initHandoff() {
		var link = $('#to-builder');
		if (!link) return;
		link.addEventListener('click', function () {
			var host = $('#chapter-9 ww-runner[data-carry]');
			var area = host && $('textarea.wwr-code', host);
			if (!area || !area.value.trim()) return; // no work to carry: plain link
			try {
				var payload = { js: area.value };
				link.href = '/learn/code-builder#start=' + encodeURIComponent(JSON.stringify(payload));
			} catch (e) {
				/* Fall through to the plain link. Losing the carry-over is a small
				 * disappointment; a click that does nothing is a broken lesson. */
			}
		});
	}

	/* ------------------------------------------------------ the flow diagram */

	function initFlow() {
		var flow = $('#ch8-flow');
		if (!flow) return;
		var steps = $$('.flow-step', flow);
		var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!steps.length) return;
		if (reduced) {
			/* Reduced motion means no sequence, not no information: light all four
			 * at once so the diagram still reads as the completed path. */
			steps.forEach(function (s) {
				s.classList.add('is-lit');
			});
			return;
		}
		if (!window.IntersectionObserver) return;
		var played = false;
		var obs = new IntersectionObserver(
			function (entries) {
				if (played || !entries.some((en) => en.isIntersecting)) return;
				played = true;
				steps.forEach(function (s, i) {
					setTimeout(function () {
						s.classList.add('is-lit');
					}, i * 420);
				});
				obs.disconnect();
			},
			{ threshold: 0.6 },
		);
		obs.observe(flow);
	}

	/* ----------------------------------------------------------------- boot */

	function init() {
		bump('view_lesson');
		bumpFirstEver();
		var w = window.innerWidth || 0;
		bump('env_viewport-' + (w < 700 ? 'sm' : w < 1100 ? 'md' : 'lg'));

		try {
			var r = document.referrer;
			var host = r ? new URL(r).hostname.toLowerCase().replace(/^www\./, '') : '';
			bump(
				!r
					? 'ref_direct'
					: host === location.hostname
						? 'ref_internal'
						: /google|bing|duckduckgo|ecosia|yahoo/.test(host)
							? 'ref_search'
							: /reddit|bsky|mastodon|facebook|instagram|linkedin/.test(host)
								? 'ref_social'
								: 'ref_other',
			);
		} catch (e) {
			bump('ref_other');
		}

		initRail();
		initProbe();
		initExplorer();
		initLegend();
		initChallenges();
		initNav();
		initDeeper();
		initHandoff();
		initFlow();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.WwLesson = {
		parsePath: parsePath,
		walk: walk,
		describe: describe,
		typeOf: typeOf,
		dwellBand: dwellBand,
		sessionBand: sessionBand,
		/* The clock, exposed so its two gates can be tested rather than argued
		 * about. `countable` is the whole rule: what it refuses to count is the
		 * difference between "time in the lesson" and "a tab that was open". */
		countable: countable,
		setPresence: function (isVisible, lastInputAt) {
			visible = isVisible;
			lastInput = lastInputAt;
		},
		literal: literal,
	};
})();

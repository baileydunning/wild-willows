/* Wild Willows — Code Builder controller.
 *
 * Everything on /learn/code-builder that is NOT the editor itself: saving,
 * downloading, importing, the checkpoint list, the ideas modal, the help
 * sidebar, and the metrics beacon. The editing and preview come from
 * <ww-runner> (public/partials/ww-runner.js), which this file drives through the
 * small wwGet/wwSet/wwRun surface that element publishes.
 *
 * Inlined at build time by scripts/build-pages.mjs. No dependencies, no network
 * beyond the one anonymous counter beacon at the end of the session.
 *
 * NOTHING a student types leaves the browser. Not on save, not on error, not in
 * the beacon. That claim is printed on the page and in PRIVACY.md, and it is a
 * load-bearing part of why a district lets thirty minors use this — so treat any
 * change that sends more than a bounded counter as a change to the privacy
 * policy first and a feature second.
 */
(function () {
	'use strict';

	var SAVE_KEY = 'wildWillowsCodeLab';
	var SAVE_VERSION = 1;
	var API = 'https://wildwillows.app/GameData/';

	var FILES = ['index.html', 'styles.css', 'main.js'];

	/* The starter project is defined ONCE, in the page's own <ww-runner> markup,
	 * and captured here at boot before any saved work is restored.
	 *
	 * It was a constant in this file to begin with, duplicating the markup. That
	 * is a bug waiting to happen in the quietest possible way: edit the page,
	 * forget this copy, and now "Start over" hands the student a project that is
	 * not the one the lesson describes — while the idle-detection below, which
	 * compares against the starter to decide whether anyone has typed anything,
	 * silently stops firing. One source, no drift. */
	var starter = null;

	/* ------------------------------------------------------------- checkpoints
	 *
	 * Grouped by day so a student always knows where the class is and where they
	 * are. Ticks persist in the save, which on day 2 gives them a small "look what
	 * I already did" for free.
	 *
	 * `show` is working code. `hint` is the nudge that comes first — the button is
	 * a fallback, not the path, and a student who reads the hint and writes it
	 * themselves has learned more.
	 */
	var CHECKPOINTS = [
		{
			id: 'title',
			day: 'Day 1 — the parts',
			file: 'index.html',
			goal: 'Put your name in the page title',
			hint: 'Change the text between <h1> and </h1>.',
			show: { 'index.html': '<h1>Ada’s Wild Willows Explorer</h1>\n<p id="message">Loading game data...</p>' },
		},
		{
			id: 'meadow',
			day: 'Day 1 — the parts',
			file: 'styles.css',
			goal: 'Make the background look like a meadow',
			hint: 'Add a background color to the body rule. Try #eef5e2.',
			show: {
				'styles.css':
					'body {\n  font-family: sans-serif;\n  padding: 2rem;\n  background: #eef5e2;\n}\n\nh1 {\n  color: seagreen;\n}',
			},
		},
		{
			id: 'fetch',
			day: 'Day 2 — the data',
			file: 'main.js',
			goal: 'Fetch the game data and look at it',
			hint: 'The starter code already does this. Open the Console panel and press Run.',
			show: {
				'main.js':
					'async function loadGameData() {\n  const response = await fetch("' +
					API +
					'");\n  const data = await response.json();\n\n  console.log(data);\n}\n\nloadGameData();',
			},
		},
		{
			id: 'one',
			day: 'Day 2 — the data',
			file: 'main.js',
			goal: "Show one animal's name on the page",
			hint: 'data.animals[0].name is the first one. Put it into #message with textContent.',
			show: {
				'main.js':
					'async function loadGameData() {\n  const response = await fetch("' +
					API +
					'");\n  const data = await response.json();\n\n  document.querySelector("#message").textContent = data.animals[0].name;\n}\n\nloadGameData();',
			},
		},
		{
			id: 'many',
			day: 'Day 2 — the data',
			file: 'main.js',
			goal: 'Show six animals, using a loop',
			hint: 'Use .slice(0, 6) then .map() to build <li> items, and .join("") to glue them together.',
			show: {
				'index.html': '<h1>Wild Willows Explorer</h1>\n<ul id="animal-list"></ul>',
				'main.js':
					'async function loadGameData() {\n  const response = await fetch("' +
					API +
					'");\n  const data = await response.json();\n\n  const items = data.animals\n    .slice(0, 6)\n    .map(animal => `<li>${animal.name}</li>`)\n    .join("");\n\n  document.querySelector("#animal-list").innerHTML = items;\n}\n\nloadGameData();',
			},
		},
		{
			id: 'fails',
			day: 'Day 3 — make it yours',
			file: 'main.js',
			goal: 'Say something useful when the data will not load',
			hint: 'Wrap the fetch in try / catch, and put a friendly message on the page in the catch.',
			show: {
				'main.js':
					'async function loadGameData() {\n  try {\n    const response = await fetch("' +
					API +
					'");\n    if (!response.ok) {\n      throw new Error("The server said no");\n    }\n    const data = await response.json();\n\n    const items = data.animals\n      .slice(0, 6)\n      .map(animal => `<li>${animal.name}</li>`)\n      .join("");\n\n    document.querySelector("#animal-list").innerHTML = items;\n  } catch (error) {\n    document.querySelector("#animal-list").textContent =\n      "Could not load the animals right now. Try again in a moment.";\n  }\n}\n\nloadGameData();',
			},
		},
	];

	/* ------------------------------------------------------------------- ideas
	 *
	 * The escape hatch for the student who finishes early, and for the one who
	 * cannot think of anything and is thirty seconds from disengaging. "Build
	 * something with the data" is paralyzing; "show every animal that eats
	 * berries" is a task you can start immediately.
	 *
	 * Every idea is real and checkable against /GameData/ — the contract test in
	 * tests/integration/classroom-contract.test.ts pins the fields and values
	 * these depend on, because an idea that silently returns an empty list is
	 * worse than no idea at all.
	 *
	 * Keep each `what` to ONE sentence. The moment an idea needs a paragraph it is
	 * an assignment, not an idea, and students stop reading.
	 */
	var IDEAS = [
		// --- easy: one filter or one map -------------------------------------
		{ id: 'meadow-roll-call', level: 'easy', uses: ['filter'], title: 'Meadow Roll Call', what: 'List every animal that lives in Willow Meadow.', data: 'animals[].biome' },
		{ id: 'berry-eaters', level: 'easy', uses: ['filter'], title: 'Berry Eaters', what: 'Show only the animals whose diet mentions berries.', data: 'animals[].diet' },
		{ id: 'name-that-species', level: 'easy', uses: ['map'], title: 'Name That Species', what: "Show each animal's name with its scientific name in italics underneath.", data: 'animals[].scientificName' },
		{ id: 'rare-finds', level: 'easy', uses: ['filter'], title: 'Rare Finds', what: 'Show only the animals marked rare.', data: 'animals[].rarity' },
		{ id: 'top-of-chain', level: 'easy', uses: ['filter'], title: 'Top of the Chain', what: 'Show every apex predator in the preserve.', data: 'animals[].trophic' },
		{ id: 'fact-of-the-day', level: 'easy', uses: ['if'], title: 'Fact of the Day', what: 'Show one random animal fact, with a button for another.', data: 'animals[].fact' },
		{ id: 'biome-colors', level: 'easy', uses: ['map'], title: 'Biome Colors', what: "Show each biome's name styled with its own color from the data.", data: 'biomes[].palette.healthy' },
		{ id: 'tiny-things', level: 'easy', uses: ['filter'], title: 'Tiny Things', what: 'Show every animal whose kind is invertebrate.', data: 'animals[].kind' },
		{ id: 'six-biomes', level: 'easy', uses: ['map'], title: 'Six Biomes', what: 'Show all six biomes with their descriptions.', data: 'biomes[].description' },

		// --- medium: filter plus sort, or two fields together -----------------
		{ id: 'a-z-guide', level: 'medium', uses: ['sort', 'map'], title: 'A–Z Field Guide', what: 'List all 150 animals in alphabetical order.', data: 'animals[].name' },
		{ id: 'biome-picker', level: 'medium', uses: ['filter', 'if'], title: 'Biome Picker', what: 'Six buttons, one per biome — click one and the list swaps.', data: 'biomes[].id' },
		{ id: 'search-box', level: 'medium', uses: ['filter', 'if'], title: 'Search Box', what: 'Type a name and filter the list as you go.', data: 'animals[].name' },
		{ id: 'habitat-checklist', level: 'medium', uses: ['map'], title: 'Habitat Checklist', what: 'Show what one animal needs before it will come home.', data: 'animals[].requirements.objects' },
		{ id: 'hardest-to-please', level: 'medium', uses: ['sort'], title: 'Hardest to Please', what: 'Sort animals by how healthy their biome must be, toughest first.', data: 'animals[].requirements.minHealth' },
		{ id: 'diet-cards', level: 'medium', uses: ['map'], title: 'Diet Cards', what: 'A card per animal with its diet, shelter and preferred habitat.', data: 'animals[].diet, .shelter' },
		{ id: 'what-eats-what', level: 'medium', uses: ['map', 'if'], title: 'What Eats What', what: 'Pick an animal and show what it eats and what eats it.', data: 'animals[].eats, .eatenBy' },
		{ id: 'resource-map', level: 'medium', uses: ['map'], title: 'Resource Map', what: 'Show each biome with the resources you can gather there.', data: 'biomes[].resources' },
		{ id: 'sources-page', level: 'medium', uses: ['map'], title: 'Sources Page', what: "Show one animal's real-world sources as clickable links.", data: 'animals[].sources' },
		{ id: 'rarity-badges', level: 'medium', uses: ['if', 'map'], title: 'Rarity Badges', what: 'Give every animal a badge — common, uncommon or rare.', data: 'animals[].rarity' },

		// --- ambitious: reduce, grouping, or real interaction ------------------
		{ id: 'species-census', level: 'ambitious', uses: ['reduce'], title: 'Species Census', what: 'Count the animals in each biome and draw bars to compare them.', data: 'animals[].biome' },
		{ id: 'food-web', level: 'ambitious', uses: ['filter', 'if'], title: 'Food Web', what: 'Pick an animal and walk outwards through what eats it.', data: 'animals[].eats, .eatenBy' },
		{ id: 'trophic-pyramid', level: 'ambitious', uses: ['reduce'], title: 'Trophic Pyramid', what: 'Stack the animals by their role in the food chain.', data: 'animals[].trophic' },
		{ id: 'restoration-planner', level: 'ambitious', uses: ['filter', 'if'], title: 'Restoration Planner', what: 'Pick a health level and show which animals would return.', data: 'animals[].requirements.minHealth' },
		{ id: 'rarity-breakdown', level: 'ambitious', uses: ['reduce'], title: 'Rarity Breakdown', what: 'Count common, uncommon and rare, and draw it as a chart.', data: 'animals[].rarity' },
		{ id: 'two-biomes', level: 'ambitious', uses: ['filter'], title: 'Two-Biome Comparison', what: 'Show two biomes side by side and compare their species.', data: 'animals[].biome' },
		{ id: 'quiz-mode', level: 'ambitious', uses: ['if'], title: 'Quiz Mode', what: 'Show a fact and ask which animal it belongs to.', data: 'animals[].fact, .name' },
		{ id: 'water-dependents', level: 'ambitious', uses: ['filter'], title: 'Water Dependents', what: 'Find every animal that needs water to come home.', data: 'animals[].requirements' },
		{ id: 'guess-the-biome', level: 'ambitious', uses: ['if'], title: 'Guess the Biome', what: 'Show a habitat description and let the player guess where it is.', data: 'animals[].preferredHabitat' },
		{ id: 'field-journal', level: 'ambitious', uses: ['filter', 'if'], title: 'Field Journal', what: 'Let the reader keep a list of favorites that survives a refresh.', data: 'animals[].name' },
	];

	/* --------------------------------------------------------------- help text */

	var HELP = {
		'index.html': {
			title: 'HTML',
			body: 'HTML creates the things you see on the page.',
			snippets: [
				{ label: 'A heading', code: '<h1>My page</h1>' },
				{ label: 'A paragraph with an id', code: '<p id="message">Loading...</p>' },
				{ label: 'An empty list to fill in', code: '<ul id="animal-list"></ul>' },
			],
		},
		'styles.css': {
			title: 'CSS',
			body: 'CSS changes how those things look.',
			snippets: [
				{ label: 'Color a heading', code: 'h1 {\n  color: seagreen;\n}' },
				{ label: 'A card', code: '.card {\n  border: 1px solid #ccc;\n  border-radius: 8px;\n  padding: 1rem;\n}' },
				{ label: 'Side by side', code: '.list {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 1rem;\n}' },
			],
		},
		'main.js': {
			title: 'JavaScript',
			body: 'JavaScript can change the page and fetch data.',
			snippets: [
				{ label: 'Fetch the game data', code: 'const response = await fetch("' + API + '");\nconst data = await response.json();' },
				{ label: 'Show one value', code: 'document.querySelector("#message").textContent = value;' },
				{ label: 'Keep only some animals', code: 'const meadow = data.animals.filter(animal => animal.biome === "meadow");' },
				{ label: 'Build a list', code: 'const items = list.map(animal => `<li>${animal.name}</li>`).join("");' },
				{ label: 'Handle nothing found', code: 'if (matches.length === 0) {\n  list.textContent = "Nothing matched.";\n}' },
			],
		},
	};

	/* ------------------------------------------------------------------ helpers */

	var $ = function (sel, root) {
		return (root || document).querySelector(sel);
	};
	var el = function (tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	};

	/* ----------------------------------------------------------------- metrics
	 *
	 * Counters accumulate in memory and go out as ONE beacon per session.
	 *
	 * Not one request per event: the preview fires on every debounce and a whole
	 * classroom shares one NAT'd school IP, so per-event posting would exhaust the
	 * telemetry rate tier for everyone in the room. sendBeacon because it survives
	 * the tab closing — a plain fetch on pagehide loses exactly the sessions that
	 * ran to completion, which are the ones worth counting.
	 */
	var counts = {};
	var sent = false;

	function bump(key) {
		counts[key] = (counts[key] || 0) + 1;
	}

	function flush() {
		if (sent) return;
		var keys = Object.keys(counts);
		if (!keys.length) return;
		sent = true;
		try {
			var body = JSON.stringify({ page: 'builder', counts: counts });
			if (navigator.sendBeacon) navigator.sendBeacon('/LessonEvent/', new Blob([body], { type: 'application/json' }));
		} catch (e) {
			/* analytics never gets to break the page */
		}
	}

	document.addEventListener('ww:metric', function (e) {
		if (e && e.detail && e.detail.key) bump(e.detail.key);
	});
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden') flush();
	});
	window.addEventListener('pagehide', flush);
	/* Long lessons: a student can sit in here for a whole period without ever
	 * hiding the tab, and a session that never reports is a session we cannot see. */
	setInterval(function () {
		if (Object.keys(counts).length) {
			sent = false;
			flush();
			counts = {};
		}
	}, 300000);

	/* --------------------------------------------------------------- persistence */

	function load() {
		try {
			var raw = localStorage.getItem(SAVE_KEY);
			if (!raw) return null;
			var save = JSON.parse(raw);
			/* A save from a future/older format is not something to guess at. Say so
			 * and keep the starter files, rather than showing an empty editor with no
			 * explanation — which reads as "it deleted my work". */
			if (!save || save.version !== SAVE_VERSION) return null;
			return save;
		} catch (e) {
			return null;
		}
	}

	function save(files, done, ui) {
		try {
			localStorage.setItem(
				SAVE_KEY,
				JSON.stringify({
					version: SAVE_VERSION,
					html: files.html,
					css: files.css,
					js: files.js,
					done: done,
					ui: ui || {},
					updatedAt: Date.now(),
				}),
			);
			return true;
		} catch (e) {
			return false;
		}
	}

	/* ------------------------------------------------- download / import format
	 *
	 * Download produces EXACTLY what assembleDocument() gives the preview (minus
	 * the reporting harness). A file that behaves differently from the preview
	 * would be the worst possible ending to the lesson, so there is one function
	 * and one format.
	 *
	 * Import parses that same format back into three files. This pair is the real
	 * save system: managed Chromebook carts often do not hand a student the same
	 * machine twice, so localStorage cannot be the only way work survives to the
	 * next period. Round-trip fidelity is asserted in tests/unit/ww-builder.test.ts.
	 */
	function buildDownload(files) {
		return window.WwRunner.assembleDocument(files.html, files.css, files.js);
	}

	function parseProject(text) {
		var css = /<style>\n([\s\S]*?)\n<\/style>\n<\/head>/.exec(text);
		/* The JS group is GREEDY and the tail is anchored to the document's exact
		 * ending. A lazy match would stop at the first closing script tag it saw,
		 * and a student whose code contains one (escaped, as the regex above spells
		 * it) would get their file silently truncated on import — losing work, with
		 * no error. Anchoring to the document's own final closing tags means only
		 * the real one can end the match.
		 *
		 * Do NOT write that sequence out literally anywhere in this file: it is
		 * inlined into a <script> block, so the comment would end the block. See the
		 * note in ww-runner.js, which learned this the hard way. */
		var rest = /<body>\n([\s\S]*?)\n<script>\n([\s\S]*)\n<\/script>\n<\/body>/.exec(text);
		if (!rest) return null;
		/* Undo the escapes assembleDocument applied on the way out, so a student who
		 * wrote a closing script or style tag gets their source back byte-for-byte.
		 * BOTH directions or neither: escaping on write without unescaping on read
		 * silently corrupts the file a little more on every save/open cycle. */
		return {
			html: rest[1],
			css: css ? css[1].replace(/<\\\/(style)/gi, '</$1') : '',
			js: rest[2].replace(/<\\\/(script)/gi, '</$1'),
		};
	}

	/* ------------------------------------------------------------------- boot */

	function init() {
		var runner = $('ww-runner');
		if (!runner || !window.WwRunner) return;

		var statusEl = $('#lab-status');
		var doneSet = {};

		function files() {
			return runner.wwGet();
		}

		/* Before anything is restored or seeded — this IS the starter project. */
		starter = files();

		/* Which side panels are open. Remembered because a student who collapsed
		 * the checkpoints on day 2 did not mean "only until I reload". */
		var ui = {};

		function status(text, kind) {
			if (!statusEl) return;
			statusEl.textContent = text;
			statusEl.className = 'lab-status' + (kind ? ' is-' + kind : '');
			clearTimeout(status._t);
			status._t = setTimeout(function () {
				statusEl.textContent = '';
				statusEl.className = 'lab-status';
			}, 4000);
		}

		/* ---- restore ---- */
		var restored = load();
		if (restored) {
			runner.wwSet({ 'index.html': restored.html, 'styles.css': restored.css, 'main.js': restored.js });
			doneSet = restored.done || {};
			ui = restored.ui || {};
			status('Picking up where you left off.', 'ok');
			bump('restored');
		} else if (localStorage.getItem(SAVE_KEY)) {
			status('Your saved work could not be opened, so this is a fresh start.', 'warn');
			bump('save_unreadable');
		}

		/* ---- autosave ---- */
		var saveTimer = null;
		var warnedNoStorage = false;
		document.addEventListener('input', function () {
			clearTimeout(saveTimer);
			saveTimer = setTimeout(function () {
				if (!save(files(), doneSet, ui) && !warnedNoStorage) {
					warnedNoStorage = true;
					bump('storage_unavailable');
					status('This browser will not let the page save. Use Download to keep your work.', 'warn');
				}
			}, 800);
		});

		/* ---- download ---- */
		var dl = $('#lab-download');
		if (dl)
			dl.addEventListener('click', function () {
				var blob = new Blob([buildDownload(files())], { type: 'text/html' });
				var url = URL.createObjectURL(blob);
				var a = el('a');
				a.href = url;
				a.download = 'my-wild-willows-page.html';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				setTimeout(function () {
					URL.revokeObjectURL(url);
				}, 1000);
				bump('download');
				status('Downloaded. Open it any time, or bring it back here with Open.', 'ok');
			});

		/* ---- import ---- */
		var picker = $('#lab-import-input');
		var open = $('#lab-import');
		if (open && picker) {
			open.addEventListener('click', function () {
				picker.click();
			});
			picker.addEventListener('change', function () {
				var file = picker.files && picker.files[0];
				if (!file) return;
				var reader = new FileReader();
				reader.onload = function () {
					var parsed = parseProject(String(reader.result));
					if (!parsed) {
						bump('import_failed');
						status('That file was not a page saved from here.', 'warn');
						return;
					}
					runner.wwSet({ 'index.html': parsed.html, 'styles.css': parsed.css, 'main.js': parsed.js });
					bump('import');
					status('Opened. Carry on where you left off.', 'ok');
				};
				reader.readAsText(file);
				picker.value = '';
			});
		}

		/* ---- reset ---- */
		var reset = $('#lab-reset');
		if (reset)
			reset.addEventListener('click', function () {
				if (!window.confirm('Start over with the original files? Your current work will be replaced.')) return;
				runner.wwSet({ 'index.html': starter.html, 'styles.css': starter.css, 'main.js': starter.js });
				doneSet = {};
				save(files(), doneSet, ui);
				renderCheckpoints();
				bump('reset_project');
				status('Back to the starting files.', 'ok');
			});

		/* ---- checkpoints ---- */
		var cpList = $('#lab-checkpoints');
		var undo = null;

		var cpCount = $('#lab-cp-count');

		/* The count in the summary is what makes collapsing safe to offer: a
		 * student who has folded the list away can still see where they are, so
		 * "out of sight" does not become "forgot there were steps". */
		function renderCount() {
			if (!cpCount) return;
			var done = CHECKPOINTS.filter(function (cp) {
				return doneSet[cp.id];
			}).length;
			cpCount.textContent = done + '/' + CHECKPOINTS.length;
			cpCount.classList.toggle('is-complete', done === CHECKPOINTS.length);
		}

		function renderCheckpoints() {
			renderCount();
			if (!cpList) return;
			cpList.innerHTML = '';
			var lastDay = null;
			CHECKPOINTS.forEach(function (cp, i) {
				if (cp.day !== lastDay) {
					lastDay = cp.day;
					cpList.appendChild(el('li', 'cp-day', cp.day));
				}
				var li = el('li', 'cp' + (doneSet[cp.id] ? ' is-done' : ''));

				var tick = el('button', 'cp-tick');
				tick.type = 'button';
				tick.setAttribute('aria-pressed', doneSet[cp.id] ? 'true' : 'false');
				tick.setAttribute('aria-label', 'Mark "' + cp.goal + '" as done');
				/* Drawn, not typed. A check character is a different font on every
				 * platform and lands anywhere from a hairline to a green emoji tick. */
				if (doneSet[cp.id]) {
					tick.innerHTML =
						'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" ' +
						'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
						'style="width:11px;height:11px;display:block;margin:0 auto"><path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>';
				} else {
					tick.textContent = String(i + 1);
				}
				tick.addEventListener('click', function () {
					doneSet[cp.id] = !doneSet[cp.id];
					if (doneSet[cp.id]) bump('checkpoint_' + cp.id);
					save(files(), doneSet, ui);
					renderCheckpoints();
				});

				var main = el('div', 'cp-main');
				main.appendChild(el('div', 'cp-goal', cp.goal));
				main.appendChild(el('div', 'cp-hint', cp.hint));

				var show = el('button', 'cp-show', 'Show me');
				show.type = 'button';
				show.addEventListener('click', function () {
					var target = Object.keys(cp.show).join(' and ');
					if (!window.confirm('This will replace what is in ' + target + '. Continue? (You can undo once.)')) return;
					undo = files();
					runner.wwSet(cp.show);
					doneSet[cp.id] = true;
					save(files(), doneSet, ui);
					renderCheckpoints();
					bump('hint_' + cp.id);
					status('Filled in. Undo is in the toolbar if you want your version back.', 'ok');
					if (undoBtn) undoBtn.hidden = false;
				});
				main.appendChild(show);

				li.appendChild(tick);
				li.appendChild(main);
				cpList.appendChild(li);
			});
		}

		var undoBtn = $('#lab-undo');
		if (undoBtn) {
			undoBtn.hidden = true;
			undoBtn.addEventListener('click', function () {
				if (!undo) return;
				runner.wwSet({ 'index.html': undo.html, 'styles.css': undo.css, 'main.js': undo.js });
				undo = null;
				undoBtn.hidden = true;
				bump('undo');
				status('Put back the way it was.', 'ok');
			});
		}
		renderCheckpoints();

		/* ---- collapsible side panels ---- */
		[
			['checkpoints', $('#lab-checkpoints-details')],
			['help', $('#lab-help-details')],
		].forEach(function (pair) {
			var name = pair[0];
			var panel = pair[1];
			if (!panel) return;
			if (ui[name] === false) panel.open = false;
			panel.addEventListener('toggle', function () {
				ui[name] = panel.open;
				save(files(), doneSet, ui);
				bump('panel_' + name + '_' + (panel.open ? 'open' : 'closed'));
			});
		});

		/* ---- the brief: whatever idea they picked, kept on screen ---- */
		var briefBox = $('#lab-current-idea');

		function showBrief(idea) {
			if (!briefBox) return;
			if (!idea) {
				briefBox.hidden = true;
				return;
			}
			briefBox.hidden = false;
			var set = function (sel, text) {
				var n = $(sel);
				if (n) n.textContent = text;
			};
			set('#lab-brief-title', idea.title);
			set('#lab-brief-what', idea.what);
			set('#lab-brief-data', 'Uses ' + idea.data);
		}

		function ideaById(id) {
			for (var i = 0; i < IDEAS.length; i++) if (IDEAS[i].id === id) return IDEAS[i];
			return null;
		}

		var briefChange = $('#lab-brief-change');
		if (briefChange)
			briefChange.addEventListener('click', function () {
				openModal('click');
			});

		var briefClear = $('#lab-brief-clear');
		if (briefClear)
			briefClear.addEventListener('click', function () {
				ui.idea = null;
				showBrief(null);
				save(files(), doneSet, ui);
				bump('brief_cleared');
			});

		/* ---- ideas modal ---- */
		var modal = $('#lab-ideas');
		var cards = $('#lab-idea-cards');
		var level = 'all';
		var uses = 'all';
		var offered = false;

		function pick(n) {
			var pool = IDEAS.filter(function (idea) {
				return (level === 'all' || idea.level === level) && (uses === 'all' || idea.uses.indexOf(uses) !== -1);
			});
			/* Shuffle a copy — Math.random in sort() is not a shuffle, it is a
			 * biased mess that keeps showing the same three cards. */
			for (var i = pool.length - 1; i > 0; i--) {
				var j = Math.floor(Math.random() * (i + 1));
				var t = pool[i];
				pool[i] = pool[j];
				pool[j] = t;
			}
			return pool.slice(0, n);
		}

		function renderIdeas() {
			if (!cards) return;
			cards.innerHTML = '';
			var chosen = pick(3);
			if (!chosen.length) {
				cards.appendChild(el('p', 'idea-empty', 'No ideas match those filters — try widening them.'));
				return;
			}
			chosen.forEach(function (idea) {
				var card = el('article', 'idea');
				card.appendChild(el('h3', 'idea-title', idea.title));
				card.appendChild(el('p', 'idea-what', idea.what));
				card.appendChild(el('p', 'idea-data', 'Uses ' + idea.data));
				var go = el('button', 'idea-start', 'Start this');
				go.type = 'button';
				go.addEventListener('click', function () {
					startIdea(idea);
				});
				card.appendChild(go);
				cards.appendChild(card);
			});
		}

		/* Seeds a scaffold of TODO comments, NEVER working code. The idea should
		 * hand over a starting point; doing the assignment defeats the point of
		 * having one. */
		function startIdea(idea) {
			var current = files();
			undo = current;
			if (undoBtn) undoBtn.hidden = false;
			var scaffold =
				'// Idea: ' +
				idea.title +
				' — ' +
				idea.what +
				'\n' +
				'// Data you need: ' +
				idea.data +
				'\n' +
				'//\n' +
				'// 1. fetch the game data\n' +
				'// 2. pick out the part you want\n' +
				'// 3. put it on the page\n\n' +
				'async function loadGameData() {\n' +
				'  const response = await fetch("' +
				API +
				'");\n' +
				'  const data = await response.json();\n\n' +
				'  // your code goes here\n' +
				'  console.log(data);\n' +
				'}\n\n' +
				'loadGameData();\n';
			runner.wwSet({ 'main.js': scaffold });
			/* The brief outlives the modal. Before this, the prompt vanished the
			 * moment the dialog closed, and a student two minutes in had nothing to
			 * check what they had agreed to build. */
			ui.idea = idea.id;
			showBrief(idea);
			save(files(), doneSet, ui);
			closeModal();
			bump('idea_started');
			bump('idea_' + idea.id);
			status('Added to main.js — the brief is in the sidebar. Undo is in the toolbar.', 'ok');
		}

		function openModal(why) {
			if (!modal) return;
			modal.hidden = false;
			renderIdeas();
			bump(why === 'auto' ? 'ideas_auto_offered' : 'ideas_opened');
			var first = modal.querySelector('button');
			if (first) first.focus();
		}

		function closeModal() {
			if (modal) modal.hidden = true;
		}

		var ideasBtn = $('#lab-ideas-open');
		if (ideasBtn)
			ideasBtn.addEventListener('click', function () {
				openModal('click');
			});
		var shuffle = $('#lab-ideas-shuffle');
		if (shuffle)
			shuffle.addEventListener('click', function () {
				renderIdeas();
				bump('ideas_shuffled');
			});
		var surprise = $('#lab-ideas-surprise');
		if (surprise)
			surprise.addEventListener('click', function () {
				var one = pick(1)[0];
				if (one) startIdea(one);
				bump('ideas_surprise');
			});
		var closeBtn = $('#lab-ideas-close');
		if (closeBtn)
			closeBtn.addEventListener('click', function () {
				closeModal();
				bump('ideas_dismissed');
			});
		if (modal)
			modal.addEventListener('click', function (e) {
				if (e.target === modal) {
					closeModal();
					bump('ideas_dismissed');
				}
			});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && modal && !modal.hidden) {
				closeModal();
				bump('ideas_dismissed');
			}
		});

		Array.prototype.forEach.call(document.querySelectorAll('[data-idea-filter]'), function (b) {
			b.addEventListener('click', function () {
				var group = b.getAttribute('data-idea-filter');
				var value = b.getAttribute('data-value');
				if (group === 'level') level = value;
				else uses = value;
				/* `on` is the site's own selected-chip state (see .chip.on in
				 * site-core.css) — the filters are real site chips, not look-alikes. */
				Array.prototype.forEach.call(document.querySelectorAll('[data-idea-filter="' + group + '"]'), function (o) {
					o.classList.toggle('on', o === b);
				});
				renderIdeas();
			});
		});

		/* The idle offer. The student this feature exists for is the one who has
		 * stopped typing and is about to give up — so offer once, unprompted, then
		 * never again this session. */
		var idle = null;
		function resetIdle() {
			clearTimeout(idle);
			if (offered) return;
			idle = setTimeout(function () {
				if (offered) return;
				var f = files();
				var untouched = f.html === starter.html && f.css === starter.css && f.js === starter.js;
				if (untouched && modal && modal.hidden) {
					offered = true;
					openModal('auto');
				}
			}, 90000);
		}
		document.addEventListener('input', resetIdle);
		resetIdle();

		/* Restore whatever they were building, after IDEAS and showBrief exist. */
		if (ui.idea) showBrief(ideaById(ui.idea));

		/* ---- help sidebar follows the open file ---- */
		var helpBox = $('#lab-help');
		function renderHelp(fileName) {
			if (!helpBox) return;
			var h = HELP[fileName];
			if (!h) return;
			helpBox.innerHTML = '';
			helpBox.appendChild(el('h2', 'help-title', h.title));
			helpBox.appendChild(el('p', 'help-body', h.body));
			h.snippets.forEach(function (s) {
				var row = el('div', 'help-snip');
				row.appendChild(el('div', 'help-label', s.label));
				row.appendChild(el('pre', 'help-code', s.code));
				var insert = el('button', 'help-insert', 'Copy');
				insert.type = 'button';
				insert.addEventListener('click', function () {
					try {
						navigator.clipboard.writeText(s.code);
						insert.textContent = 'Copied';
						setTimeout(function () {
							insert.textContent = 'Copy';
						}, 1500);
						bump('help_copy');
					} catch (e) {
						/* clipboard blocked — the code is on screen and selectable anyway */
					}
				});
				row.appendChild(insert);
				helpBox.appendChild(row);
			});
		}
		renderHelp('index.html');
		runner.addEventListener('click', function (e) {
			var tab = e.target.closest && e.target.closest('.wwr-tab');
			if (tab) renderHelp(tab.textContent.trim());
		});

		bump('builder_open');
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.WwBuilder = {
		FILES: FILES,
		CHECKPOINTS: CHECKPOINTS,
		IDEAS: IDEAS,
		buildDownload: buildDownload,
		parseProject: parseProject,
	};
})();

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
	var SEEN_KEY = 'wildWillowsCodeLabSeen';
	var API = 'https://wildwillows.app/GameData';

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
	 * Every idea is real and checkable against /GameData — the contract test in
	 * tests/integration/classroom-contract.test.ts pins the fields and values
	 * these depend on, because an idea that silently returns an empty list is
	 * worse than no idea at all.
	 *
	 * Keep each `what` to ONE sentence. The moment an idea needs a paragraph it is
	 * an assignment, not an idea, and students stop reading.
	 *
	 * `steps` and `done` are the other half of that trade. The one-liner is what
	 * gets an idea CHOSEN, off a wall of thirty; it is not enough to start from,
	 * and "show every animal whose kind is invertebrate" left a student staring at
	 * three files with nowhere to put their hands. So the card stays a sentence
	 * and the brief panel, which only ever shows the ONE idea they picked, carries
	 * three first moves and a finish line. Each step names a real field, and the
	 * first one is always small enough to do wrong and see.
	 */
	var IDEAS = [
		// --- easy: one filter or one map -------------------------------------
		{
			id: 'meadow-roll-call',
			level: 'easy',
			uses: ['filter'],
			title: 'Meadow Roll Call',
			what: 'List every animal that lives in Willow Meadow.',
			data: 'animals[].biome',
			steps: [
				'Fetch the data and log it once, so you can see the shape before you use it.',
				'Filter animals down to the ones whose biome is exactly "meadow".',
				'Build one list item per animal and put the whole list into the page.',
			],
			done: 'The page lists 25 animals, and none of them are from another biome.',
		},
		{
			id: 'berry-eaters',
			level: 'easy',
			uses: ['filter'],
			title: 'Berry Eaters',
			what: 'Show only the animals whose diet mentions berries.',
			data: 'animals[].diet',
			steps: [
				'Log a few diet values first. They are sentences, not tidy tags.',
				'Keep the animals whose diet contains "berr", so berry and berries both match.',
				'Show the diet line next to the name, so the match is visible on the page.',
			],
			done: 'Every animal shown has berries somewhere in its diet, and you can see where.',
		},
		{
			id: 'name-that-species',
			level: 'easy',
			uses: ['map'],
			title: 'Name That Species',
			what: 'Show each animal\'s name with its scientific name in italics underneath.',
			data: 'animals[].scientificName',
			steps: [
				'Map each animal to a small block of HTML rather than to a single string.',
				'Put the common name in a heading and the scientific name in an em below it.',
				'In styles.css, make the italic line smaller and lighter than the name.',
			],
			done: '150 entries, each with two lines that clearly look different from each other.',
		},
		{
			id: 'rare-finds',
			level: 'easy',
			uses: ['filter'],
			title: 'Rare Finds',
			what: 'Show only the animals marked rare.',
			data: 'animals[].rarity',
			steps: [
				'Log the rarity values first. There are only three of them.',
				'Filter to the ones where rarity is "rare".',
				'Put the count at the top of the page, so the number is part of the answer.',
			],
			done: 'Only rare animals are on the page, and it says how many there are.',
		},
		{
			id: 'top-of-chain',
			level: 'easy',
			uses: ['filter'],
			title: 'Top of the Chain',
			what: 'Show every apex predator in the preserve.',
			data: 'animals[].trophic',
			steps: [
				'Check what trophic actually contains. The value you want is "apex-predator".',
				'Filter to trophic === \'apex-predator\', hyphen and all. "apex" alone matches nothing.',
				'Show each one with its biome, so the spread across the preserve is visible.',
			],
			done: 'Only apex predators, and you can tell which biome each one came from.',
		},
		{
			id: 'fact-of-the-day',
			level: 'easy',
			uses: ['if'],
			title: 'Fact of the Day',
			what: 'Show one random animal fact, with a button for another.',
			data: 'animals[].fact',
			steps: [
				'Pick one animal with Math.floor(Math.random() * animals.length).',
				'Show that animal\'s name and its fact.',
				'Add a button whose click handler picks again and rewrites the same element.',
			],
			done: 'Pressing the button changes the fact without reloading anything.',
		},
		{
			id: 'biome-colors',
			level: 'easy',
			uses: ['map'],
			title: 'Biome Colors',
			what: 'Show each biome\'s name styled with its own color from the data.',
			data: 'biomes[].palette.healthy',
			steps: [
				'Log one biome and find where the color lives inside the object.',
				'Map each biome to an element and set its color from palette.healthy.',
				'Add a filled swatch next to the name, so the color reads at small sizes too.',
			],
			done: 'Six biome names, each drawn in a color that came from the data rather than from you.',
		},
		{
			id: 'tiny-things',
			level: 'easy',
			uses: ['filter'],
			title: 'Tiny Things',
			what: 'Show every animal whose kind is invertebrate.',
			data: 'animals[].kind',
			steps: [
				'Log the kind values to see the exact vocabulary the data uses.',
				'Filter to the ones where kind is "invertebrate".',
				'Show the kind next to each name, so the filter is visible rather than assumed.',
			],
			done: 'Everything on the page is an invertebrate, and nothing else got through.',
		},
		{
			id: 'six-biomes',
			level: 'easy',
			uses: ['map'],
			title: 'Six Biomes',
			what: 'Show all six biomes with their descriptions.',
			data: 'biomes[].description',
			steps: [
				'Map biomes to a card with the name as a heading and the description under it.',
				'Join the cards together and write them into one container element.',
				'Give the cards a border, a radius and some padding in styles.css.',
			],
			done: 'Six cards, each with a name and its own description.',
		},
		{
			id: 'shelter-notes',
			level: 'easy',
			uses: ['map'],
			title: 'Shelter Notes',
			what: 'Show where each animal sleeps, nests or hides.',
			data: 'animals[].shelter',
			steps: [
				'Log one shelter value. They are full sentences, so give them room to wrap.',
				'Map each animal to its name plus its shelter description.',
				'In styles.css, make the name bold and the shelter line lighter beneath it.',
			],
			done: '150 entries, each naming an animal and where it actually shelters.',
		},

		// --- medium: filter plus sort, or two fields together -----------------
		{
			id: 'a-z-guide',
			level: 'medium',
			uses: ['sort', 'map'],
			title: 'A–Z Field Guide',
			what: 'List all 150 animals in alphabetical order.',
			data: 'animals[].name',
			steps: [
				'Copy the array before sorting. .sort() changes the original in place.',
				'Sort with (a, b) => a.name.localeCompare(b.name).',
				'Map to list items and render them.',
			],
			done: '150 names, A to Z, with nothing missing off either end.',
		},
		{
			id: 'biome-picker',
			level: 'medium',
			uses: ['filter', 'if'],
			title: 'Biome Picker',
			what: 'Six buttons, one per biome — click one and the list swaps.',
			data: 'biomes[].id',
			steps: [
				'Build one button per biome, carrying the biome id on a data attribute.',
				'On click, filter the animals to that biome and rewrite the list below.',
				'Mark the pressed button, so it is obvious which biome is showing.',
			],
			done: 'Clicking any of the six buttons swaps the list underneath it.',
		},
		{
			id: 'search-box',
			level: 'medium',
			uses: ['filter', 'if'],
			title: 'Search Box',
			what: 'Type a name and filter the list as you go.',
			data: 'animals[].name',
			steps: [
				'Add an input and listen for its input event, not its change event.',
				'Compare with .toLowerCase() on both sides, or capitals will break the match.',
				'Handle the no-match case with a message instead of an empty page.',
			],
			done: 'Typing narrows the list as you go, and a search that matches nothing says so.',
		},
		{
			id: 'habitat-checklist',
			level: 'medium',
			uses: ['map'],
			title: 'Habitat Checklist',
			what: 'Show what one animal needs before it will come home.',
			data: 'animals[].requirements.objects',
			steps: [
				'Log one animal\'s requirements. objects is an object, not an array.',
				'Use Object.keys() for the habitat items and the value for how many are needed.',
				'Show them as a checklist, with minHealth as the heading above it.',
			],
			done: 'One animal, the list of what it needs, and the health level it is waiting for.',
		},
		{
			id: 'hardest-to-please',
			level: 'medium',
			uses: ['sort'],
			title: 'Hardest to Please',
			what: 'Sort animals by how healthy their biome must be, toughest first.',
			data: 'animals[].requirements.minHealth',
			steps: [
				'Copy the array, then sort by requirements.minHealth, largest first.',
				'Show the number beside each name, so the ordering can be checked.',
				'Take the top 20 with .slice(0, 20) to keep the page readable.',
			],
			done: 'The list runs from the fussiest animal downwards, with the numbers visible.',
		},
		{
			id: 'diet-cards',
			level: 'medium',
			uses: ['map'],
			title: 'Diet Cards',
			what: 'A card per animal with its diet, shelter and preferred habitat.',
			data: 'animals[].diet, .shelter',
			steps: [
				'Map each animal to a card holding name, diet, shelter and preferredHabitat.',
				'Label every line, so a reader can tell which fact is which.',
				'Lay the cards out with CSS grid in styles.css.',
			],
			done: 'A grid of cards, each carrying four labeled facts about one animal.',
		},
		{
			id: 'what-eats-what',
			level: 'medium',
			uses: ['map', 'if'],
			title: 'What Eats What',
			what: 'Pick an animal and show what it eats and what eats it.',
			data: 'animals[].eats, .eatenBy',
			steps: [
				'eats and eatenBy hold ids, not names. Build a lookup from id to animal first.',
				'Show one animal with two lists: what it eats, and what eats it.',
				'Handle the empty case. An apex predator has nothing in eatenBy.',
			],
			done: 'Both lists show real names, and an apex predator says so rather than showing a blank.',
		},
		{
			id: 'resource-map',
			level: 'medium',
			uses: ['map'],
			title: 'Resource Map',
			what: 'Show each biome with the resources you can gather there.',
			data: 'biomes[].resources',
			steps: [
				'Log one biome to see how resources is stored before you loop over it.',
				'Map each biome to its name plus its resources joined with commas.',
				'Color each biome heading with that biome\'s own palette color.',
			],
			done: 'Six biomes, each listing what you can gather there.',
		},
		{
			id: 'sources-page',
			level: 'medium',
			uses: ['map'],
			title: 'Sources Page',
			what: 'Show one animal\'s real-world sources as clickable links.',
			data: 'animals[].sources',
			steps: [
				'Log one animal\'s sources to see what each entry actually contains.',
				'Map them to anchor elements with the href set and the title as the text.',
				'Add target="_blank" and rel="noopener", so a click does not lose your page.',
			],
			done: 'A list of real references for one animal, and every one of them opens.',
		},
		{
			id: 'rarity-badges',
			level: 'medium',
			uses: ['if', 'map'],
			title: 'Rarity Badges',
			what: 'Give every animal a badge — common, uncommon or rare.',
			data: 'animals[].rarity',
			steps: [
				'Map each animal to its name plus a span carrying its rarity as a class name.',
				'Style the three classes differently in styles.css.',
				'Put the word inside the badge as well. Color on its own is not a label.',
			],
			done: 'Every animal has a badge, and the three kinds are still tellable apart in gray.',
		},

		// --- ambitious: reduce, grouping, or real interaction ------------------
		{
			id: 'species-census',
			level: 'ambitious',
			uses: ['reduce'],
			title: 'Species Census',
			what: 'Count the animals in each biome and draw bars to compare them.',
			data: 'animals[].biome',
			steps: [
				'Reduce the animals into an object mapping each biome to a count.',
				'Turn that object into rows with Object.entries().',
				'Draw each bar as a div whose width is its share of the largest count.',
			],
			done: 'Six bars whose lengths match the numbers printed beside them.',
		},
		{
			id: 'food-web',
			level: 'ambitious',
			uses: ['filter', 'if'],
			title: 'Food Web',
			what: 'Pick an animal and walk outwards through what eats it.',
			data: 'animals[].eats, .eatenBy',
			steps: [
				'Build the id-to-animal lookup once, at the start, not inside the loop.',
				'Show one animal, and make every name in its two lists clickable.',
				'A click re-renders the whole view centered on the animal that was clicked.',
			],
			done: 'You can walk from any animal to its neighbors, and back again.',
		},
		{
			id: 'trophic-pyramid',
			level: 'ambitious',
			uses: ['reduce'],
			title: 'Trophic Pyramid',
			what: 'Stack the animals by their role in the food chain.',
			data: 'animals[].trophic',
			steps: [
				'Reduce into a count for each trophic value.',
				'Write the level order yourself. The data is not stored in pyramid order.',
				'Draw each level as a row, widest at the bottom.',
			],
			done: 'A pyramid whose rows are in food-chain order rather than data order.',
		},
		{
			id: 'restoration-planner',
			level: 'ambitious',
			uses: ['filter', 'if'],
			title: 'Restoration Planner',
			what: 'Pick a health level and show which animals would return.',
			data: 'animals[].requirements.minHealth',
			steps: [
				'Add a range input running from 0 to 100.',
				'On input, keep the animals whose requirements.minHealth is at or below it.',
				'Show the count, so moving the slider visibly changes something every time.',
			],
			done: 'Dragging the slider adds and removes animals as the threshold moves.',
		},
		{
			id: 'rarity-breakdown',
			level: 'ambitious',
			uses: ['reduce'],
			title: 'Rarity Breakdown',
			what: 'Count common, uncommon and rare, and draw it as a chart.',
			data: 'animals[].rarity',
			steps: [
				'Reduce into counts for the three rarity values.',
				'Work out each one\'s share of the total as a percentage.',
				'Draw three bars, each labeled with its count and its share.',
			],
			done: 'Three bars whose percentages add up to 100.',
		},
		{
			id: 'two-biomes',
			level: 'ambitious',
			uses: ['filter'],
			title: 'Two-Biome Comparison',
			what: 'Show two biomes side by side and compare their species.',
			data: 'animals[].biome',
			steps: [
				'Two select elements, one per side, both built from the biome list.',
				'Filter the animals twice, once per chosen biome, and render two columns.',
				'Print how many species each side has, so the columns can be compared.',
			],
			done: 'Two columns you can change independently, each with its own count.',
		},
		{
			id: 'quiz-mode',
			level: 'ambitious',
			uses: ['if'],
			title: 'Quiz Mode',
			what: 'Show a fact and ask which animal it belongs to.',
			data: 'animals[].fact, .name',
			steps: [
				'Pick a random animal and show its fact, without the name.',
				'Offer four buttons: the right answer and three others picked at random.',
				'Say whether the guess was right, then offer the next question.',
			],
			done: 'You can answer several in a row, and it keeps the score.',
		},
		{
			id: 'water-dependents',
			level: 'ambitious',
			uses: ['filter'],
			title: 'Water Dependents',
			what: 'Find every animal that needs water to come home.',
			data: 'animals[].requirements',
			steps: [
				'Log a requirements.objects to see what the habitat items are called.',
				'Keep the animals whose object names mention pond, water or pool.',
				'Show which item matched, so the filter can be checked rather than trusted.',
			],
			done: 'Every animal listed needs water, and the page names the item that proves it.',
		},
		{
			id: 'guess-the-biome',
			level: 'ambitious',
			uses: ['if'],
			title: 'Guess the Biome',
			what: 'Show a habitat description and let the player guess where it is.',
			data: 'animals[].preferredHabitat',
			steps: [
				'Show one animal\'s preferredHabitat, with any biome name taken out of it.',
				'Offer the six biomes as buttons.',
				'After a guess, reveal both the answer and the animal it described.',
			],
			done: 'A round plays all the way through: read, guess, reveal, next.',
		},
		{
			id: 'field-journal',
			level: 'ambitious',
			uses: ['filter', 'if'],
			title: 'Field Journal',
			what: 'Keep a running list of favorites you can add to and clear.',
			data: 'animals[].name',
			steps: [
				'Keep a favorites array in your own code, and add to it on a button click.',
				'Re-render both lists after every change, rather than patching one of them.',
				'Handle the empty journal with a line of text, not an empty box.',
			],
			done: 'You can add, see and clear favorites, and the empty state says something.',
		},
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
	var durationSent = false;

	function bump(key) {
		counts[key] = (counts[key] || 0) + 1;
	}

	/* FIRST VISIT EVER, not first visit this session.
	 *
	 * `view_builder` is traffic and this is reach: how many different browsers have
	 * ever opened the page. The gap between the two is how much of the traffic is
	 * the same people coming back, which for a tool is the difference between
	 * being used and being reloaded. One bit, readable only by this origin, and
	 * it identifies nobody. */
	function bumpFirstEver() {
		try {
			if (localStorage.getItem('ww_ever_builder')) return;
			localStorage.setItem('ww_ever_builder', '1');
		} catch (e) {
			/* storage refused: overstating reach a little beats losing it */
		}
		bump('unique_builder');
	}

	/* ------------------------------------------------------- time in the builder
	 *
	 * How long a student actually spends here is the number that says whether this
	 * is a five-minute curiosity or the thing they did for a whole period — and it
	 * is the one figure a teacher will ask about that nothing else answers.
	 *
	 * ACTIVE time, not wall-clock: the tab left open over lunch is not an hour of
	 * building. The clock stops whenever the page is hidden.
	 *
	 * BUCKETED, never a raw duration. A precise per-session length is a behavioral
	 * trace of one person; "somewhere between fifteen and thirty minutes" answers
	 * the question just as well and describes nobody. Same reasoning as everything
	 * else in this file: if it cannot be a counter, it does not leave the browser.
	 */
	var activeMs = 0;
	var since = Date.now();

	function tickActive() {
		var now = Date.now();
		if (document.visibilityState !== 'hidden') activeMs += now - since;
		since = now;
	}

	function durationBucket(ms) {
		var m = ms / 60000;
		if (m < 5) return 'duration_lt5m';
		if (m < 15) return 'duration_5to15m';
		if (m < 30) return 'duration_15to30m';
		if (m < 60) return 'duration_30to60m';
		return 'duration_gt60m';
	}

	/* Send whatever has accumulated and START A NEW BATCH.
	 *
	 * `final` marks the flush that happens because the session is ending — a tab
	 * closing or a navigation away — as opposed to an interim one from a tab
	 * switch or the periodic timer.
	 *
	 * TWO THINGS HERE ARE NOT OPTIONAL, both learned the hard way:
	 *
	 *   • `counts` is emptied on every send. It used to survive the send behind a
	 *     `sent` latch, so a student who switched tabs once had that first batch
	 *     sent, kept, and sent AGAIN by the five-minute timer — every counter
	 *     before the first tab switch was recorded twice. Clearing after the send
	 *     also makes the latch unnecessary: pagehide and visibilitychange both
	 *     firing on the way out is harmless, because the second one finds nothing
	 *     to send.
	 *   • The duration bucket rides on the FINAL flush only. A session that runs
	 *     past a boundary would otherwise land in two bands at once (lt5m and
	 *     then 5to15m), and a distribution where one student appears in three
	 *     bands is not a distribution.
	 */
	function flush(final) {
		tickActive();
		if (final && !durationSent) {
			durationSent = true;
			bump(durationBucket(activeMs));
		}
		if (!Object.keys(counts).length) return;
		var batch = counts;
		counts = {};
		try {
			var body = JSON.stringify({ page: 'builder', counts: batch });
			if (navigator.sendBeacon) navigator.sendBeacon('/LessonEvent/', new Blob([body], { type: 'application/json' }));
		} catch (e) {
			/* analytics never gets to break the page */
		}
	}

	/* The runner's two funnel steps arrive under their generic names, because the
	 * component is shared and knows nothing about which page it is on. The builder
	 * files them under its OWN names.
	 *
	 * Both pages count into one set of totals, so leaving them merged made the
	 * classroom funnel unreadable: `first_run` would be the sum of the lesson's
	 * runs and the builder's, sitting under a `view_lesson` that counts only one
	 * of the two pages, and anybody arriving straight at /learn/code-builder
	 * pushed the step above 100% of the one before it. Split, each strand is
	 * strictly nested inside its own entry point. */
	var RUNNER_STEPS = { first_run: 'builder_first_run', first_fetch_ok: 'builder_first_fetch_ok' };
	document.addEventListener('ww:metric', function (e) {
		if (!e || !e.detail || !e.detail.key) return;
		bump(RUNNER_STEPS[e.detail.key] || e.detail.key);
	});
	/* A tab switch is not the end of a session — the student is looking something
	 * up and will be back. Send what we have, keep the clock running. */
	document.addEventListener('visibilitychange', function () {
		tickActive();
		if (document.visibilityState === 'hidden') flush(false);
	});
	window.addEventListener('pagehide', function () {
		flush(true);
	});
	/* Long lessons: a student can sit in here for a whole period without ever
	 * hiding the tab, and a session that never reports is a session we cannot see. */
	setInterval(function () {
		flush(false);
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

	/* THE BUILDER DRAWS A LINE THE LESSON DOES NOT.
	 *
	 * The lesson works on a phone, editors and all, and should: its examples are
	 * a dozen lines each, most chapters are read rather than typed, and a student
	 * on a bus getting through chapter 4 is a win.
	 *
	 * This page is the opposite shape. It is three files, a live preview and a
	 * console, all on screen together, and it exists to be typed into for a whole
	 * period. On a phone the soft keyboard covers the line being written, there
	 * is no Tab key, and autocorrect fights punctuation the entire way. Shipping
	 * a version of that is not generosity, it is a period spent on the keyboard
	 * instead of on the code.
	 *
	 * So a phone gets a straight answer and a link to the thing that does work,
	 * and the runner is never mounted: it carries `defer`, so no editor is built
	 * and no preview iframes are opened on a device that cannot use them.
	 *
	 * The second clause is the landscape phone, wide enough to look like a tablet
	 * with 400px of height and a keyboard over half of it. An iPad in portrait is
	 * 744px or more and is not caught by either. */
	function tooSmall() {
		if (!window.matchMedia) return false;
		return window.matchMedia('(max-width: 700px), (pointer: coarse) and (max-height: 460px)').matches;
	}

	function init() {
		if (tooSmall()) {
			var blocked = document.getElementById('lab-blocked');
			if (blocked) blocked.hidden = false;
			document.body.classList.add('is-too-small');
			bump('env_too-small');
			flush(true);
			return;
		}
		var host = document.querySelector('ww-runner[defer]');
		if (host && window.WwRunner && window.WwRunner.mount) {
			host.removeAttribute('defer');
			window.WwRunner.mount(host);
		}
		start();
	}

	function start() {
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

		/* ---- arriving from the lesson ----
		 *
		 * The last chapter of /learn/web-development hands the student's own work
		 * across rather than dropping them into a starter project that throws it
		 * away. It travels in the URL FRAGMENT, which browsers do not send to the
		 * server: their code stays theirs, and the promise this page and
		 * PRIVACY.md both make stays true.
		 *
		 * It wins over the autosave, and that is the right way round. Someone who
		 * clicked "Open the Code Builder" at the end of the lesson thirty seconds
		 * ago means the thing they were just looking at, not whatever they left
		 * here last week. The old work is not lost either: this does not save
		 * over it until they type something. */
		var carried = null;
		try {
			var m = /[#&]start=([^&]+)/.exec(location.hash || '');
			if (m) {
				var payload = JSON.parse(decodeURIComponent(m[1]));
				if (payload && typeof payload === 'object') {
					carried = {
						'index.html': typeof payload.html === 'string' ? payload.html : undefined,
						'styles.css': typeof payload.css === 'string' ? payload.css : undefined,
						'main.js': typeof payload.js === 'string' ? payload.js : undefined,
					};
					// The fragment is long and means nothing to a reader. Take it out of
					// the bar so a reload or a bookmark is a plain /learn/code-builder.
					if (history.replaceState) history.replaceState(null, '', location.pathname);
				}
			}
		} catch (e) {
			/* Anything unparseable in a hash a student may well have edited by hand
			 * is not worth a broken page: fall through to the normal opening. */
		}
		if (carried) {
			var only = {};
			for (var name in carried) if (carried[name] !== undefined) only[name] = carried[name];
			if (Object.keys(only).length) {
				runner.wwSet(only);
				status('Brought your code over from the lesson.', 'ok');
				bump('carried_in');
			} else {
				carried = null;
			}
		}

		/* ---- restore ---- */
		var restored = carried ? null : load();
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
		/* Which answers are showing. Deliberately NOT saved with the rest of the
		   layout: a revealed answer is a moment, not a preference, and coming back
		   next period to six open answers is not where anyone wants to start. */
		var openHints = {};
		/* The panel is 280px because that is enough for a goal and a hint. It is not
		   enough for `const response = await fetch("https://wildwillows.app/...")`,
		   which wraps to four lines and stops looking like code. So while an answer
		   is showing the column gets 100px more, and gives it straight back. */
		function paintHintWidth() {
			document.body.classList.toggle('hint-open', !!document.querySelector('.cp-code:not([hidden])'));
		}

		var COPY_KEYS = /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Cmd+C' : 'Ctrl+C';

		function selectText(node) {
			if (!node) return false;
			try {
				var range = document.createRange();
				range.selectNodeContents(node);
				var sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
				return true;
			} catch (e) {
				return false;
			}
		}

		/* THREE WAYS, IN ORDER OF HOW NICE THEY ARE.
		 *
		 * The async clipboard is the good one and the one that usually runs. It
		 * needs a secure context and a permission a managed school profile can
		 * refuse — so when it says no, select the block and ask the browser to copy
		 * the selection, which needs neither. If even that is refused the text is
		 * left highlighted and the student presses Cmd+C, which is one instruction
		 * rather than a dead button. */
		function copyText(text, node) {
			try {
				if (navigator.clipboard && navigator.clipboard.writeText)
					return navigator.clipboard.writeText(text).catch(function () {
						return legacyCopy(node);
					});
			} catch (e) {
				/* falls through */
			}
			return legacyCopy(node);
		}

		function legacyCopy(node) {
			if (!selectText(node)) return Promise.reject(new Error('cannot select'));
			var worked = false;
			try {
				worked = document.execCommand('copy');
			} catch (e) {
				worked = false;
			}
			return worked ? Promise.resolve() : Promise.reject(new Error('selected only'));
		}

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

				/* SHOWS the answer, it does not APPLY it.
				 *
				 * This used to overwrite the student's files with the worked version,
				 * behind a confirm() and a one-shot undo. Two things were wrong with
				 * that. A student pressing "Show me" is usually stuck and wants to
				 * LOOK at the answer, and the price of looking was their own work.
				 * And once it had been applied there was nothing left to compare
				 * against — the thing they were stuck on was gone from the screen.
				 *
				 * So it reveals the code in place, next to their own, with a Copy
				 * button. Copying is the same keystrokes as typing it, and it is
				 * their decision rather than a modal's. Nothing in the editor moves,
				 * so the checkpoint is not ticked either: looking is not finishing.
				 */
				var show = el('button', 'cp-show', 'Show me');
				show.type = 'button';
				show.setAttribute('aria-expanded', 'false');
				main.appendChild(show);

				var codeBox = el('div', 'cp-code');
				codeBox.hidden = true;
				Object.keys(cp.show).forEach(function (name) {
					var head = el('div', 'cp-code-head');
					head.appendChild(el('span', 'cp-code-name', name));

					var copy = el('button', 'cp-copy', 'Copy');
					copy.type = 'button';
					copy.addEventListener('click', function () {
						var pre = codeBox.querySelector('[data-file="' + name + '"]');
						copyText(cp.show[name], pre).then(
							function () {
								copy.textContent = 'Copied';
								status('Copied. Paste it into ' + name + ' and change it until it is yours.', 'ok');
								setTimeout(function () {
									copy.textContent = 'Copy';
								}, 1600);
								bump('copy_' + cp.id);
							},
							function () {
								/* Everything refused. The block is highlighted by now, so the
								   one thing left to say is which two keys to press. */
								status('Highlighted for you — press ' + COPY_KEYS + ' to copy it.', '');
							},
						);
					});
					head.appendChild(copy);
					codeBox.appendChild(head);

					var pre = el('pre', 'cp-pre', cp.show[name]);
					pre.setAttribute('data-file', name);
					pre.tabIndex = 0;
					codeBox.appendChild(pre);
				});
				main.appendChild(codeBox);

				if (openHints[cp.id]) {
					codeBox.hidden = false;
					show.textContent = 'Hide';
					show.setAttribute('aria-expanded', 'true');
				}

				show.addEventListener('click', function () {
					var open = codeBox.hidden;
					codeBox.hidden = !open;
					openHints[cp.id] = open;
					show.textContent = open ? 'Hide' : 'Show me';
					show.setAttribute('aria-expanded', open ? 'true' : 'false');
					paintHintWidth();
					if (open) bump('hint_' + cp.id);
				});

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

		/* ---- the side panel, collapsed to nothing ----
		 *
		 * The checkpoints and the help are reference: worth having open while you
		 * are working out what to do next, and 280px of permanent tax once you
		 * know. A student writing a long chained expression wants the window.
		 *
		 * All the way out rather than narrower, because a squeezed sidebar is the
		 * worst of both: still taking room, no longer readable. The bubble rides
		 * the seam and stays in the same place in both states, which it has to:
		 * it is the only control that survives the panel disappearing.
		 *
		 * Remembered with the rest of the layout, for the same reason the panels
		 * themselves are: somebody who collapsed it on day two did not mean "until
		 * I reload". */
		var sideToggle = $('#lab-side-toggle');
		if (sideToggle) {
			var sideLabel = $('.lab-side-toggle-text', sideToggle);

			function paintSide() {
				var hidden = document.body.classList.contains('side-hidden');
				sideToggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
				// The control says what pressing it will DO, not what the state is.
				sideToggle.title = hidden ? 'Show the side panel' : 'Hide the side panel';
				// The bubble shows a chevron and nothing else, so this label is the
				// only wording a screen reader has. It is hidden, not absent.
				if (sideLabel) sideLabel.textContent = hidden ? 'Show panel' : 'Hide panel';
			}

			if (ui.sideHidden === true) document.body.classList.add('side-hidden');
			paintSide();

			sideToggle.addEventListener('click', function () {
				var hidden = document.body.classList.toggle('side-hidden');
				ui.sideHidden = hidden;
				save(files(), doneSet, ui);
				paintSide();
				bump(hidden ? 'panel_side_hidden' : 'panel_side_shown');
			});
		}

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

		/* The wall of thirty cards is a MENU: one line each, because a paragraph on
		 * thirty cards is a wall nobody reads. This panel is the opposite problem.
		 * It shows exactly one idea, the one they chose, and it stays on screen for
		 * the rest of the period — so it is the right place for everything the card
		 * could not carry. "Show every animal whose kind is invertebrate" is enough
		 * to pick; it is not enough to start.
		 *
		 * Built with el() rather than innerHTML. The text is ours, so this is not
		 * about untrusted input; it is that a brief assembled with `+` breaks the
		 * first time an idea's wording contains an angle bracket, and several of
		 * these steps talk about elements and tags. */
		var METHOD_LABEL = { filter: '.filter()', map: '.map()', sort: '.sort()', reduce: '.reduce()', if: 'if / else' };

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

			var tags = $('#lab-brief-tags');
			if (tags) {
				tags.textContent = '';
				var chips = [idea.level].concat(idea.uses || []);
				for (var t = 0; t < chips.length; t++)
					tags.appendChild(
						el('span', 'brief-tag' + (t === 0 ? ' is-level' : ''), t === 0 ? chips[t] : METHOD_LABEL[chips[t]] || chips[t]),
					);
			}

			var list = $('#lab-brief-steps');
			if (list) {
				list.textContent = '';
				var steps = idea.steps || [];
				for (var i = 0; i < steps.length; i++) list.appendChild(el('li', '', steps[i]));
				list.hidden = steps.length === 0;
				var heading = $('.brief-h', briefBox);
				if (heading) heading.hidden = steps.length === 0;
			}

			var doneLine = $('#lab-brief-done');
			if (doneLine) {
				doneLine.textContent = idea.done ? 'Done when: ' + idea.done : '';
				doneLine.hidden = !idea.done;
			}
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

		/* WHERE FOCUS GOES WHEN THIS SHUTS.
		 *
		 * Focus moved into the dialog and, on close, was dropped on the document —
		 * so a keyboard user who opened Ideas, looked, and pressed Escape restarted
		 * from the top of the page, twenty-odd tab stops from where they were. The
		 * opener is remembered rather than assumed, because this dialog also opens
		 * by itself after a few idle minutes, and in that case there is no button
		 * to go back to. */
		var modalOpener = null;

		function openModal(why) {
			if (!modal) return;
			modalOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
			modal.hidden = false;
			renderIdeas();
			bump(why === 'auto' ? 'ideas_auto_offered' : 'ideas_opened');
			var first = modal.querySelector('button');
			if (first) first.focus();
		}

		function closeModal() {
			if (!modal || modal.hidden) return;
			modal.hidden = true;
			var back = modalOpener && document.contains(modalOpener) ? modalOpener : $('#lab-ideas-open');
			modalOpener = null;
			if (back && back.focus) back.focus();
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
		bump('view_builder');
		bumpFirstEver();
		bump('session_total');

		/* Which screens this is actually used on. The page claims to work on a
		 * Chromebook; this is how that claim gets checked. */
		var w = window.innerWidth || 0;
		bump('env_viewport-' + (w < 700 ? 'sm' : w < 1100 ? 'md' : 'lg'));

		/* How they got here, as one word from a fixed list. The referrer URL is
		 * read in this browser and thrown away in this browser; only the bucket is
		 * ever sent. A referrer from our own host is 'internal', which is the
		 * difference between "arrived from the lesson" and "arrived from Google". */
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
							: /reddit|bluesky|bsky|mastodon|facebook|instagram|linkedin/.test(host)
								? 'ref_social'
								: 'ref_other',
			);
		} catch (e) {
			bump('ref_other');
		}

		/* Where they went next. The nav links leave the page, so this has to be a
		 * plain click listener rather than anything that waits for a response —
		 * bump() batches into the pagehide flush, which fires on the way out. */
		var NAV = {
			'lesson-nav': 'nav_lesson',
			'learn-nav': 'nav_learn',
			'hub-nav': 'nav_hub',
			'game-nav': 'nav_game',
			'api-nav': 'nav_api',
		};
		document.addEventListener('click', function (e) {
			var a = e.target && e.target.closest && e.target.closest('a[data-track]');
			if (a && NAV[a.getAttribute('data-track')]) bump(NAV[a.getAttribute('data-track')]);
		});

		/* Did they come back? Stored as a DATE, not an identifier — it says "this
		 * browser has been here before", which is all the question needs. */
		try {
			var today = new Date().toISOString().slice(0, 10);
			var firstDay = localStorage.getItem(SEEN_KEY);
			if (!firstDay) localStorage.setItem(SEEN_KEY, today);
			else if (firstDay !== today) {
				var days = Math.round((Date.parse(today) - Date.parse(firstDay)) / 86400000);
				if (days === 1) bump('returning_day2');
				else if (days >= 2) bump('returning_day3');
			}
		} catch (e) {
			/* storage unavailable — see load(); the lesson does not depend on this */
		}
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

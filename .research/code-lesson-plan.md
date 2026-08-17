# Build With Wild Willows — Intro to APIs & Web Development

**Plan v2.** Grades 9–12 · 60–120 minutes (1–3 periods) · no prerequisites · no installs · no accounts.
One coherent experience: **`/teachers` hub → Teacher Guide → Learn → Build.**

| Path | Page |
|---|---|
| `/teachers` | Hub — both classroom kits |
| `/teachers/science` | Existing grades 5–8 ecosystem kit |
| `/teachers/coding` | Educator guide for this module |
| `/learn/web-development` | Student lesson, 9 interactive chapters |
| | *1 HTML/CSS/JS · 2 JS changes HTML · 3 APIs + JSON types · 4 fetch · 5 inside the data · 6 if/else · 7 loops · 8 render it · 9 your turn* |
| `/learn/code-builder` | Three-file browser code editor |

Learning arc: *HTML gives a page structure → CSS controls how it looks → JavaScript makes it interactive → APIs let JavaScript get information from somewhere else → **`if / else` lets the page make decisions about that data, and loops turn it into a whole page** → students use real Wild Willows data to build their own webpage.*

Two things drive every decision below: **every concept is demonstrated in something the student can run and change**, and **every meaningful action is counted** so you can see what's actually working.

---

## Contents

1. [Where this sits in the repo](#1-where-this-sits-in-the-repo)
2. [Four decisions to make first](#2-four-decisions-to-make-first)
3. [The interactive core — build one component, use it everywhere](#3-the-interactive-core)
4. [Page 1 — Educator guide](#4-page-1--educator-guide)
5. [Page 2 — Student lesson](#5-page-2--student-lesson)
6. [Page 3 — Code Builder](#6-page-3--code-builder)
7. [Metrics — the full design](#7-metrics--the-full-design)
8. [Privacy, and why it's load-bearing here](#8-privacy-and-why-its-load-bearing-here)
9. [Wiring checklist](#9-wiring-checklist)
10. [Testing](#10-testing)
11. [Build order](#11-build-order)
12. [The bigger play — Wild Willows Open Game Data](#12-the-bigger-play)
13. [Open questions](#13-open-questions)

---

## 1. Where this sits in the repo

| Thing that already exists | Where | How this uses it |
|---|---|---|
| `/teachers` — grades 5–8 ecosystem lesson | `public/teachers.html` → `server/pages.ts` → `TeachersPage` (`server/resources.ts` L13001) | Copy the page shell, `<style>`, nav and FAQ verbatim. The new module is the 9–12 sibling, cross-linked both ways |
| `GET /GameData/` | `server/resources.ts` L5921 | The endpoint students fetch. ~300 KB JSON → ~65 KB brotli, build-stamped ETag |
| HTML → endpoint build pipeline | `scripts/build-pages.mjs` (`pages` map, L77–91) | Add three entries. **Explicit map, not a directory scan** — an unlisted file is silently ignored |
| Sitemap + per-page `lastmod` | `PUBLIC_PAGES` (L12851), `server/page-lastmod.ts` | Add three rows; dates come from git automatically |
| **`LandingStat` / `LandingEvent` / `LandingStats` + dashboard section** | L12106–12320, L12772, `public/dashboard.html` L3368 | **The template for the entire metrics system in §7.** Proven pattern, known failure modes, existing dashboard chrome |
| Sub-path routing via `getId()` | `Screenshot` (L13079), serving `/img/<name>.webp` | Proves `/learn/<slug>` works — see §2b |
| Classroom PDFs, base64 from endpoints | `public/pdfs/`, `bumpPdfDownload` | Same mechanism for a printable handout later; also the model for server-side download counting |

**The data is good teaching material.** `/GameData/` returns `biomes`, `animals`, `resources`, `recipes`, `habitatObjects`, `tools`, `achievements`, `homeStyles`, `homeTracks`, `appearanceOptions`. Each of the 150 animals carries `name`, `scientificName`, `kind`, `trophic`, `rarity`, `diet`, `shelter`, `preferredHabitat`, `fact`, `eats`, `eatsOther`, `eatenBy`, `requirements`, `sources`, `biome`. Real fields, real ecology, and enough shape to teach objects, arrays and nesting without contriving anything.

---

## 2. Four decisions to make first

### 2a. `Access-Control-Allow-Origin: *` on `/GameData/` — required, not optional

`GameData` currently sends no CORS header, which has never mattered because only same-origin pages fetch it. Here it blocks three separate things:

1. **The sandboxed preview.** Student code runs in an iframe. Locked down properly with `sandbox="allow-scripts"`, that iframe has an **opaque origin** — so `fetch('/GameData/')` from inside it is cross-origin and fails. Without the header you're forced to add `allow-same-origin`, which hands student JavaScript access to the parent page.
2. **Downloaded projects.** The export button produces a real `.html` file. Opened from `file://` it sends `Origin: null` and the fetch fails. The most satisfying moment of the lesson — "this is *my* website and it works on *my* laptop" — depends on this one header.
3. **Anywhere else students go next.** CodePen, Glitch, a school Google Site.

**Safe because:** the endpoint is public, unauthenticated, identical for every caller, carries no player data, and is already fetched by anonymous browsers. `Access-Control-Allow-Origin: *` on a credential-less `GET` exposes nothing that isn't already a public URL. Keep it off `GameState` and everything under `DashboardEndpoint`.

```ts
// in the headers object of GameData.get() — server/resources.ts ~L5950
'access-control-allow-origin': '*',
```

Teach `fetch(url)` with **no custom headers** so no `OPTIONS` preflight is triggered and no preflight handler is needed. `CONTRIBUTING.md` L215 already notes the packaged app's `file://` origin needs CORS from Harper, so this is a direction the codebase was heading anyway.

### 2b. Routes — `/teachers` becomes the hub

Harper resolves the **first** path segment to a resource and hands the remainder to `getId()` — `Screenshot` already relies on this to serve `/img/<name>.webp`. That gives you nested paths with a proven mechanism, and it makes the hub structure clean:

| Path | Resource · id | What it is |
|---|---|---|
| `/teachers` | `Teachers`, no id | **Hub.** Both kits, side by side |
| `/teachers/science` | `Teachers`, `science` | The existing grades 5–8 ecosystem kit |
| `/teachers/coding` | `Teachers`, `coding` | The new grades 9–12 educator guide |
| `/learn/web-development` | `Learn`, `web-development` | Student lesson |
| `/learn/code-builder` | `Learn`, `code-builder` | Code Builder |

Two `PublicEndpoint` classes (`Teachers`, `Learn`), each switching on `getId()` and 404-ing on anything else. Avoid three-segment paths (`/educators/high-school/api-lesson`) — untested here, and the `PUBLIC_PAGES` canonical/sitemap logic assumes flat paths.

**The hub page** is short on purpose — the two kits as cards, not a wall of text:

> ### Wild Willows in the classroom
> Two free, ready-to-run kits. No accounts, no cost, nothing to install.
>
> **🌿 Ecosystems & Habitat** · Grades 5–8 · 45–60 min · Science
> Students restore a damaged meadow, log which animals return and why, and learn that habitat is food, water, shelter and space. Educator guide + six printable worksheets. → *Open the science kit*
>
> **💻 Intro to APIs & Web Development** · Grades 9–12 · 60–120 min · Computer Science
> Students learn how HTML, CSS, JavaScript and APIs work together by pulling real Wild Willows data into a webpage they build themselves. Interactive lesson + browser code editor. → *Open the coding kit*

Plus the shared material that belongs to both and shouldn't be duplicated: free classroom copies, "can I photocopy this?", contact, and the cost/grade-level FAQ.

⚠️ **One real cost: the SEO.** `/teachers` currently carries `LearningResource` structured data, a `<title>` and a keyword set all aimed squarely at *"ecosystem lesson plan grades 5–8"*, and it's the URL printed in both PDFs and linked externally. Turning it into a hub means:

- **Move the science kit's structured data, title, meta description and FAQ schema to `/teachers/science`** — don't leave them on a hub that no longer matches them, and don't duplicate them across both.
- **Keep `/teachers` a 200, not a redirect.** It's an established URL; it should stay valid and just do a different job. The hub's own `<title>`/description target the broader *"free classroom kit"* intent.
- **The hub links to both kits above the fold** so the equity a teacher's click carries still flows to the science page.
- Add all five paths to `PUBLIC_PAGES` with `sitemap: true`, and re-submit the sitemap after deploy.

Net: you probably dip on the science-lesson keyword for a few weeks and come back stronger, with two pages ranking for two different intents instead of one page ranking for one. Worth it, but go in knowing it, and don't ship it the week before a conference where you're handing out the PDFs.

### 2c. Protect the lesson from your own refactors — but don't version `/GameData/`

Your instinct is right: a classroom exercise that breaks because you renamed a field is a support nightmare, and teachers won't come back. But **`/api/v1/GameData` isn't available to you.** `/GameData/` is hardcoded in `src/api.ts`, the Cloudflare Worker's `PROXIED` allowlist (`workers/play.js`), `scripts/audit-content.mjs`, the integration harness, and — decisively — **every already-shipped desktop, Steam and Mac App Store build.** You can add a path; you can't move this one.

Two options, and I'd do the first now and the second only if §12 happens:

- **Now: a contract test.** One integration test that pins the exact fields the lesson depends on — `animals[].name`, `.biome`, `.diet`, `.fact`, `.kind`, `.trophic`, `biomes[].id`, `.name`. Rename one and CI fails with "this breaks the classroom lesson," naming the page. ~30 lines, zero runtime cost, and it turns an invisible risk into a loud one.
- **Later: `/EduData/`.** A thin, frozen projection over the same `defs()` — the fields above and nothing else, ~15 KB instead of 300 KB. Faster on school wifi, less overwhelming, and free to diverge from the game's internal shape forever. Worth it the moment you want other people building against your data.

Teach against `/GameData/` either way. Students seeing a real response with more in it than they need is a feature: *the API gives you everything and your job is to pick* is one of the actual lessons.

### 2d. Anonymous counters only — no per-student or per-class tracking

You want to capture all metrics around usage. §7 designs that in full. The one decision to make up front, because it constrains everything downstream: **no student identifiers, no class codes, no logins, no free text, no code contents.**

The moment you attach a class code or a student name to a progress record, an anonymous counter system becomes an education-records system, and you inherit FERPA, COPPA-adjacent state student-privacy laws, district vendor review, and data-subject requests — for a free lesson page. Aggregate counters answer every question you actually have ("do students get past chapter 4?", "does the fetch work on school networks?") without any of that. If a teacher needs per-student progress, the exported `.html` file **is** the artifact — they already collect it.

---

## 3. The interactive core

Build one component. Use it on both student pages. This is the single highest-leverage decision in the plan.

**`<ww-runner>`** — a small, dependency-free element:

```
┌──────────────────────────┬───────────────────┐
│  editable code (textarea)│   live preview    │
│                          │   (iframe)        │
├──────────────────────────┴───────────────────┤
│  [Run ▶]  [Reset]        error bar (hidden)  │
└──────────────────────────────────────────────┘
```

- Takes up to three sources (html / css / js), assembles them into one document, renders via `iframe srcdoc` with `sandbox="allow-scripts"`.
- Re-runs on a **~400 ms debounce** after typing stops, **and** on an explicit **Run ▶** button. Both, deliberately: the debounce makes exploration feel alive, the button makes cause-and-effect legible for students who need it discrete.
- Catches `window.onerror` and `unhandledrejection` inside the iframe, `postMessage`s them out, renders them in the error bar (§6).
- Emits metric events (§7) — so instrumentation is written once, not eleven times.

On the **lesson page** it appears in a compact one-file mode, ~15 times. On the **builder** it appears once in three-file mode with tabs. Same code, same behavior, so a student who's used the inline examples already knows how the builder works.

**No CodeMirror, no Monaco, no CDN.** Three reasons: the project's zero-asset philosophy, school networks that block CDNs, and the fact that the whole page has to inline into `resources.js` as one string anyway. A styled `<textarea>` with a scroll-synced line-number gutter is genuinely enough. Tab inserts two spaces, **Esc-then-Tab escapes the field** (accessibility requirement, not a nicety).

Syntax highlighting — a token-colored `<pre>` behind a transparent textarea — is the one stretch goal. **Cut it first.** It's the fiddliest part of the build and adds nothing pedagogically.

---

## 4. Page 1 — Educator guide

`/teachers/coding` (linked from the `/teachers` hub, alongside `/teachers/science`)

Written so a teacher who has never written JavaScript can run this confidently. That's the bar, and it's a higher bar than the existing grades 5–8 guide had to clear.

**Hero**
> ### Build a Webpage With Real Game Data
> Students learn how HTML, CSS, JavaScript and APIs work together by retrieving real data from Wild Willows and using it to create their own interactive webpage.

**Quick facts strip** — Grades 9–12 · 60–120 minutes · Beginner-friendly · No software installation · No student accounts · HTML, CSS, JavaScript, APIs, JSON · **Uses real data from Wild Willows**.

That last one is the hook. Lead with it in the meta description and the OG card too — "real API" is what makes this different from every other intro-to-web lesson a teacher has already seen.

**A callout, high on the page:** *"You do not need to know JavaScript to teach this lesson."* Then say how that's true: every step has a working answer one click away, the error panel explains problems in plain English, and §4's troubleshooting table covers what actually goes wrong.

**Learning objectives** — by the end, students can:
explain the different roles of HTML, CSS and JavaScript · explain what an API does · describe the request/response relationship between a browser and an API · recognize JSON as a common data format · **identify the basic data types in a JSON response and explain why quotes matter** · use `fetch()` to request data · read values from a JavaScript object or array · **write an `if / else` statement that makes the page behave differently depending on the data** · **loop through a list of data and transform, filter and sort it** · use API data to update HTML · modify all three files to create a webpage of their own.

That looping objective is the one that separates this from a typical intro lesson — most stop at "display one value." Chapter 7 is where students stop copying and start asking their own questions of the data.

**Vocabulary** — one line each, no padding:

| | |
|---|---|
| **HTML** | structure |
| **CSS** | appearance |
| **JavaScript** | behavior |
| **API** | a way for programs to communicate |
| **Endpoint** | a specific location where an API provides information |
| **Request** | asking an API for something |
| **Response** | what the API sends back |
| **JSON** | a structured format commonly used to send data |
| **`fetch()`** | a JavaScript function used to make web requests |
| **String** | text — always in quotes |
| **Number** | a value you can do math with — no quotes |
| **Boolean** | `true` or `false` |
| **Array** | an ordered list of things |
| **Object** | a thing with named parts |
| **`null` / `undefined`** | nothing on purpose / nothing found |
| **Condition** | a question with a yes-or-no answer |
| **`if` / `else`** | do one thing when a condition is true, another when it isn't |
| **`===`** | asks "is this exactly the same?" — one `=` sets, three `===` ask |
| **Loop** | doing something once for each item in a list |
| **`.map()`** | make a new list by changing each item |
| **`.filter()`** | make a shorter list by keeping only some items |

Make it a printable/copyable block — teachers will want it on the board.

**Teacher prep** — four steps, and say plainly that there's nothing to install:
1. Open the student lesson yourself once.
2. **Check the school network can reach `wildwillows.app`** — do this a week ahead, not the morning of. (§7 gives you a metric for how often this fails.)
3. Optional: show 5 minutes of Wild Willows so students see where the data comes from.
4. Decide your timing — §4's three flows below.

**Suggested lesson flow**, offered as **three presets** rather than one, because "60–120 minutes" means different things in different schools. The `/teachers` vertical-timeline component handles this well.

- **Single period (60 min)** — 10 What is a webpage? · 10 What is an API? · 30 Guided coding (chapters 1–8, trimmed per the note below) · 10 Build challenge. Tight; the builder is a taster.
- **Two periods** — Day 1: chapters 1–5 + builder challenges 1–2. Day 2: chapters 6–9 (decisions, looping, rendering) + a build challenge.
- **Three periods** — Day 1 the web stack (ch. 1–2) · Day 2 the API and its data (ch. 3–6) · Day 3 looping, rendering and build (ch. 7–9). **Chapters 6 and 7 are the heart of the whole module** — if a day is going to run long, let it be that one.

**What to cut when time is short**, said plainly on the page so a teacher can make the call mid-lesson instead of running out of road: keep `if / else`, `.map()` and `.filter()` — those three carry chapter 8, which is where the payoff is. `.reduce()`, `.sort()`, `&&`/`||` and the `? :` shorthand are all enrichment. Mark them as such in the page's own UI so skipping them doesn't feel like falling behind.

For the **What is a webpage?** opener: show a simple page and ask what controls the text, the colors, and what happens on click. Let them guess before naming HTML/CSS/JS. For **What is an API?**, get to the real endpoint fast:

> **Browser:** "Wild Willows API, give me the game data."
> **API:** `{ "animals": [...], "biomes": [...] }`

then show the actual `/GameData/` response on screen.

**Assessment** — deliberately not quiz-heavy. A three-band rubric teachers can grade as completion, points, or a project:

| | Understanding | Technical | Creative |
|---|---|---|---|
| | Can explain what HTML, CSS and JS each do | Successfully retrieves API data | Creates a page that communicates something about the Wild Willows data |
| | Can explain what an API is | Displays at least one API value on the page | |
| | | Uses `if / else` to handle a case the data might not cover | |
| | | Modifies HTML, CSS **and** JavaScript | |

Note for the teacher: the *understanding* column is the one worth grading hardest. A student who used **Show me** and can explain the code has learned more than one who wrote messier code unaided.

**Troubleshooting** — the section that makes this teachable by a non-coder. A table of *symptom → what it means → what to do*: blank preview, "Failed to fetch" (network filter — the big one), work missing from yesterday, preview not updating, `is not defined`, `Cannot read properties of null`. Six rows, plain language.

**Answer key** — the finished three files in copyable blocks, plus a one-click **Open this in the Code Builder** link that seeds the builder via URL hash. Also a deliberately **broken** version with three planted bugs (typo'd selector, missing `await`, wrong property name) as a warm-up or a sub-plan.

**Cross-links out:** *Teach the lesson →* `/learn/web-development`, plus the grades 5–8 ecology kit, plus classroom copies.

---

## 5. Page 2 — Student lesson

`/learn/web-development`

Nine short chapters, each with a live `<ww-runner>`. Not a tutorial article with code blocks — a page where **every single code sample is editable and runs**. A student should be unable to get through this page without having changed something and seen it happen.

**Chapter 1 — Three languages, one webpage**
Build one card up in three passes, same content each time.

*HTML = what is here?*
```html
<h1>Wild Willows Animals</h1>
<p>Animals return when their habitat is healthy.</p>
```
Result shown immediately, unstyled and plain. *"This is a webpage. It's just labeled text."*

*CSS = what does it look like?*
```css
h1 { color: forestgreen; }
p  { font-size: 18px; }
```
Same HTML, now styled. Three ideas only: selector, property, value.

*JavaScript = what does it do?*
```js
const heading = document.querySelector("h1");
heading.addEventListener("click", () => {
  heading.textContent = "You found an animal!";
});
```
Three ideas only: find the element, listen for something, change it.

**Interactive requirement:** each pass is editable and the caption underneath names what changed. First challenge in the margin: *change `forestgreen` to your favorite color.* Ten seconds in, they've written CSS.

**Chapter 2 — JavaScript can change HTML**
The conceptual bridge before `fetch()`, and the chapter people skip. Don't.
```html
<p id="animal-count">Loading...</p>
```
```js
const element = document.querySelector("#animal-count");
element.textContent = "150 animals";
```
Visually: **JavaScript found this HTML element → JavaScript changed its text.** Animate the connection — highlight the `id` in the HTML pane and the selector in the JS pane in the same color, draw the arrow between them. This is the mental model everything after depends on.

**Chapter 3 — Programs can talk to other programs**
Introduce APIs with Wild Willows directly. One short analogy at most, then concrete:

> The Wild Willows game contains information about animals, plants, biomes, recipes and other systems. The Wild Willows API lets another program ask for some of that information.

```
Your webpage
     ↓ request
Wild Willows API
     ↓ response
Game data
```

Then a **See the real API response** button that actually calls `/GameData/` and shows: the URL, the status code, how long it took, how many kilobytes came back. **Real numbers from their own network.** A student on school wifi seeing `412 ms · 64 KB` learns something a screenshot cannot teach.

Below it, the response rendered as a **collapsible JSON tree**, folded to top-level keys. Let them expand `animals` → `[0]` and see one full record. They know these animals from the game — this is where abstract becomes real.

**Data types live here, not in their own chapter.** JSON *is* a set of types, so this is the one place where naming them costs nothing and explains something the student is already looking at. Six lines, then move on:

| In the data | What it's called | Example from `/GameData/` |
|---|---|---|
| words in quotes | **string** | `"name": "Red Fox"` |
| plain numbers | **number** | `"minHealth": 35` |
| `true` / `false` | **boolean** | `"explorable": true` |
| `[ ... ]` | **array** — a list | `"eats": ["berries", "seeds"]` |
| `{ ... }` | **object** — a thing with named parts | one whole animal |
| `null` | **nothing on purpose** | `"unlock": null` on the meadow |

**Make the JSON tree color-code by type, with a small legend.** You're building the tree anyway; coloring it teaches types visually, with no extra text to read, and it makes chapter 5's property access legible at a glance — a student can see they landed on a string versus an array before they run anything.

The one rule worth stating out loud: **quotes mean text.** `35` is a number you can do math with; `"35"` is text that looks like a number. That single distinction prevents more beginner bugs than everything else on this list combined, and it comes back in chapter 6 the moment they compare `minHealth > 50`.

Then leave it. A "Data Types" chapter with a seven-row table and no code is the most forgettable page in every intro course — types stick when a student hits one, not when they read a list. The rest is handled where it bites: `undefined` in chapter 7 (`.find()` with no match), `null` in the error panel (`Cannot read properties of null` is the #1 beginner error), and string-vs-number in the two callouts below.

**Chapter 4 — Fetch your first API**
Built up one line at a time, each stage runnable:

```js
fetch("https://wildwillows.app/GameData/")
```
```js
fetch("https://wildwillows.app/GameData/")
  .then(response => response.json())
```
```js
fetch("https://wildwillows.app/GameData/")
  .then(response => response.json())
  .then(data => {
    console.log(data);
  });
```

**Teach `.then()` first, `async/await` second.** Agreed, and worth stating the reason on the page: the chain *looks like* the sequence — request, then convert, then use. Then show the modern equivalent:

```js
async function loadGameData() {
  const response = await fetch("https://wildwillows.app/GameData/");
  const data = await response.json();
  console.log(data);
}
loadGameData();
```

Now `await` has something to mean: it's waiting for the thing they just watched arrive. Include a **console pane** in the runner for this chapter — capture `console.log` inside the iframe and display it, rather than sending beginners to DevTools on a locked-down Chromebook.

End the chapter with **what if it fails?** — `.catch`, and the error message they'd see. Don't skip it; a beginner's first fetch failure is otherwise a blank page and a lost period.

**Chapter 5 — Look inside the data**
Generated from the real schema. Three steps, each with the matching part of the JSON tree highlighted as they run it:

```js
console.log(data.animals);        // an array of 150 things
console.log(data.animals[0]);     // one animal
console.log(data.animals[0].name);// one value
```

**This is the best interaction on the page.** Split view: code on the left, live JSON tree on the right, and running a line lights up exactly what it selected. Objects, arrays and property access — three things that usually take a week — become one thing you can see. Then let them edit the path themselves: `data.biomes[2].name`, `data.animals[7].diet`.

Have the runner **label what type came back** on each result — *"an array of 150 things" / "an object with 16 parts" / "a string"* — so chapter 3's table gets used rather than read once and forgotten. Two callouts belong here, both one line, both prompted by something they just ran:
- `data.animals.length` is a **number**; `"150 animals"` is a **string**. `data.animals.length + " animals"` glues them; `+` means add for numbers and join for text, and it decides based on what you gave it.
- Ask for something that isn't there — `data.animals[999]` — and you get **`undefined`**. Not an error, not zero, not empty. That's JavaScript saying "there's nothing here," and it's the value behind half the confusing errors they'll see later.

**Chapter 6 — Make decisions**

`if / else` goes **before** loops, not after, and that ordering is doing real work. A `.filter()` callback asks students to absorb two new ideas at once: a boolean test, *and* handing a function to another function. Teaching the test first means chapter 7 only has to introduce the second one. The chapter you're most likely to lose people in gets meaningfully easier for the cost of ten minutes here.

Start with one animal they already have from chapter 5:

```js
const animal = data.animals[0];

if (animal.rarity === "rare") {
  console.log(animal.name + " is a rare find!");
}
```

Run it. Nothing happens — the first animal is common. **That's the lesson**, so let it land before fixing it: the code ran fine, the condition was false, so the block was skipped. A beginner's instinct is that nothing happening means broken. Then change `"rare"` to `"common"` and watch it fire.

**`else` — always do one or the other**
```js
if (animal.rarity === "rare") {
  message.textContent = animal.name + " is a rare find!";
} else {
  message.textContent = animal.name + " is fairly common.";
}
```

**`else if` — more than two outcomes**
```js
if (animal.rarity === "rare")            badge = "🌟 Rare";
else if (animal.rarity === "uncommon")   badge = "✨ Uncommon";
else                                     badge = "Common";
```
Three real values, three outcomes, and the result is visible on the page rather than in a console. Have them reorder the branches to discover that **the first true one wins and the rest are skipped** — a rule that's much easier to see than to be told.

**Comparisons — where chapter 3's types come back**

| | Means | Use on |
|---|---|---|
| `===` | is exactly the same as | text or numbers |
| `!==` | is not the same as | text or numbers |
| `>` `<` `>=` `<=` | bigger / smaller than | numbers only |

```js
if (animal.requirements.minHealth > 50) { ... }   // number — no quotes
if (animal.biome === "wetland") { ... }           // text — quotes
```
Say the `=` versus `===` trap out loud once: **one `=` sets a value, three `===` asks a question.** It's the single most common typo in this whole lesson, and the error it produces doesn't mention `=` at all.

**`&&` and `||` — asking two things at once**
```js
if (animal.rarity === "rare" && animal.biome === "meadow") { ... }   // both
if (animal.kind === "bird" || animal.kind === "mammal") { ... }      // either
```
Let them swap `&&` for `||` on the same line and watch the count change. That's the definition, demonstrated.

**The empty-state guard — the one they'll actually reuse**
```js
if (matches.length === 0) {
  list.textContent = "No animals matched. Try another biome.";
} else {
  // show the list
}
```
Genuinely load-bearing: without it, a filter that matches nothing renders a blank page and every student assumes their code broke. Teach it here, require it in the day-3 rubric, and put it in the Search Box and Biome Picker idea cards.

**Tie it back to `fetch`** — chapter 5 ended on failure handling; now they can read the honest version:
```js
if (!response.ok) {
  message.textContent = "Couldn't load the game data.";
  return;
}
```
`!` means *not*. One line, and it connects a thing they've already seen fail to a thing they just learned.

**Stretch: the `? :` shorthand.** Mark it optional in the page's own UI, but include it — it's what makes conditional rendering readable inside `.map()` in chapter 8:
```js
const badge = animal.rarity === "rare" ? "🌟" : "";
```
*If this is true use the first thing, otherwise the second.* Show it beside the `if/else` that does the same job so it reads as shorthand, not as new magic.

**Close the chapter on the bridge to chapter 7** — say this explicitly, because it's the whole reason the order changed:

> `animal.rarity === "rare"` is a question with a yes-or-no answer. You just used it in an `if`. Next chapter you'll hand the same question to `.filter()` and let it ask that question about all 150 animals at once.

**Chapter 7 — Loop through the data**

The chapter that turns "I displayed one animal" into "I built a page." 150 animals is a genuinely good array to learn on — big enough that looping obviously beats typing, varied enough that filtering and sorting produce visibly different results.

Teach the methods in this order, each with a live runner and each rendering its result **as a visible list, not a `console.log`** — students should see 25 cards appear when they change a filter:

**`for...of` first.** The honest starting point, and the one that reads like English:
```js
for (const animal of data.animals) {
  console.log(animal.name);
}
```
Say plainly that this always works and is never wrong. Everything after is a shorter way to say a specific kind of loop — that framing stops the array methods feeling like arbitrary magic words.

**`.forEach()` — do something for each one**
```js
data.animals.forEach(animal => {
  console.log(animal.name);
});
```
Introduce the arrow function *here*, once, slowly: `animal =>` means "for each one, call it `animal`, and here's what to do with it." This is the concept the rest of the chapter rests on, so give it its own beat and let them rename the parameter to prove it's theirs to choose.

**`.map()` — turn each one into something else**
```js
const names = data.animals.map(animal => animal.name);
console.log(names);   // ["Banana Slug", "Grasshopper", ...]
```
**The key visual:** 150 objects in, 150 strings out, same length, side by side. `.map()` is the single most useful method they'll learn today because it's how a list of data becomes a list of HTML — flag that now and deliver on it in chapter 8.

**`.filter()` — keep only some of them**
```js
const meadow = data.animals.filter(animal => animal.biome === "meadow");
console.log(meadow.length);   // 25
```
150 in, 25 out. Then let them edit the biome — `forest`, `wetland`, `desert`, `alpine`, `coastal` — and watch the count change. Then filter on something else entirely: `animal.trophic === "apex-predator"`, `animal.rarity === "rare"`. **This is where students start asking their own questions of the data**, which is the whole point of the Data Detective challenge later.

⚠️ **Check the real values before writing any lesson copy.** `trophic` is not `"predator"` — the actual set is `detritivore · herbivore · insectivore · omnivore · mesopredator · apex-predator · filter-feeder · decomposer · scavenger`. (`rarity` is `common · uncommon · rare`; `kind` is `invertebrate · mammal · bird · amphibian · reptile · insect · fish`.) A wrong value in an example returns an empty list and looks to a student like their code is broken. This is exactly what the §2c contract test is for — pin the value sets, not just the field names.

Chapter 3's types pay off here, so make it explicit with one contrasting pair:
```js
.filter(animal => animal.biome === "meadow")              // string — needs quotes
.filter(animal => animal.requirements.minHealth > 50)     // number — no quotes, and > works
```
*You compare text with `===` and quotes. You compare numbers with `>`, `<` and no quotes. `"50"` in quotes is text, and text doesn't do math.* One sentence, at the exact moment it matters.

**`.find()` — get exactly one**
```js
const fox = data.animals.find(animal => animal.name === "Red Fox");
console.log(fox.diet);
```
Name the difference explicitly, because it's the #1 confusion: **`.filter()` gives you an array, `.find()` gives you one thing.** Show what `fox[0]` does versus `fox.diet` and let the error teach it.

**`.reduce()` — combine them into one value**
```js
const count = data.animals.reduce((total, animal) => total + 1, 0);
```
`.reduce()` is where beginner tutorials usually lose people. Two defences: introduce it as *"a running total"* rather than *"an accumulator"*, and start with a case where the answer is obvious so the mechanism is the only new thing. Then something genuinely useful:
```js
const perBiome = data.animals.reduce((counts, animal) => {
  counts[animal.biome] = (counts[animal.biome] || 0) + 1;
  return counts;
}, {});
// { meadow: 25, forest: 25, wetland: 25, ... }
```
Mark this one **optional / stretch** in the page's own UI. A student who doesn't get `.reduce()` should be able to move on without feeling stuck — everything after works fine without it.

**`.sort()` — put them in order**
```js
const alphabetical = [...data.animals].sort((a, b) => a.name.localeCompare(b.name));
```
Worth the one-line honesty note: `.sort()` changes the original array, which is why we copy it first with `[...]`. That's a real bug students will otherwise hit and never diagnose.

**Then chain them — the payoff:**
```js
const list = data.animals
  .filter(animal => animal.biome === "meadow")
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(animal => animal.name)
  .join(", ");
```
Run it, then let them reorder the chain and see what breaks. *Filter first, then map* vs *map first, then filter* is a lesson that lands hard when you can watch it fail in 400 ms.

**A comparison card to close the chapter** — students will come back to this one block more than anything else on the page:

| Method | Gives you back | Use it when |
|---|---|---|
| `for...of` | nothing | you just want to do something with each one |
| `.forEach()` | nothing | same, in a shorter form |
| `.map()` | a new array, same length | you want to turn each one into something else |
| `.filter()` | a new array, shorter | you only want some of them |
| `.find()` | one item (or `undefined`) | you want one specific one |
| `.reduce()` | one value of any kind | you want to combine them all |
| `.sort()` | the array, reordered | you want them in a particular order |

**Chapter 8 — Put API data on your webpage**
The whole chain, in one runner:
```html
<h1>Wild Willows</h1>
<p id="animal-name">Loading animal...</p>
```
```js
async function loadGameData() {
  const response = await fetch("https://wildwillows.app/GameData/");
  const data = await response.json();
  document.querySelector("#animal-name").textContent = data.animals[0].name;
}
loadGameData();
```
Then the diagram, animated once: **API → JavaScript → HTML → Browser**, with the actual animal's name traveling along it. That's the lesson, in one picture.

**Then immediately cash in chapter 7** — one animal becomes twenty-five, and it's *fewer* lines than doing it by hand:
```html
<h1>Willow Meadow</h1>
<ul id="animal-list"></ul>
```
```js
async function loadGameData() {
  const response = await fetch("https://wildwillows.app/GameData/");
  const data = await response.json();

  const items = data.animals
    .filter(animal => animal.biome === "meadow")
    .map(animal => `<li>${animal.name}</li>`)
    .join("");

  document.querySelector("#animal-list").innerHTML = items;
}
loadGameData();
```

This is the moment the whole lesson pays off, so land it deliberately: **`.map()` turned data into HTML, and `.join("")` glued it together.** Then have them change `"meadow"` to `"forest"` and watch a different 25 appear — one word, a whole new page.

One honest sentence about `innerHTML`, no lecture: *we're building HTML from data we trust, from our own API. If the data came from strangers on the internet you'd use `textContent` instead, because `innerHTML` will run anything it's given.* That's the right amount of security for grade 10, and it's true.

**Chapter 9 — Your turn**
Five micro-challenges before the builder, each checkable in place:
1. Change the heading.
2. Change its color.
3. Display a different value from `/GameData/` (try `.diet` or `.fact`).
4. Show a different biome's animals.
5. Show only the apex predators, sorted by name.

The last two are chapters 6 and 7 in disguise — a student who can do them is ready for the builder, and one who can't knows exactly which chapter to scroll back to.

Then: **Ready to build your own? → Open Code Builder**, carrying their chapter-9 code across via the URL hash so they land in the builder with their own work already in it.

**Build notes:** in-page chapter nav with progress ticks; each chapter deep-linkable (`#chapter-4`) so a teacher can project one; fully readable with JS disabled (inline the example output as static HTML the runner replaces); `prefers-reduced-motion` respected on every animation above.

---

## 6. Page 3 — Code Builder

`/learn/code-builder`

```
┌───────────────────────────────────────────────────────────┐
│ Wild Willows Code Builder  [💡 Ideas][Run ▶][Reset][↓]   │
├──────────────┬────────────────────────┬───────────────────┤
│ index.html   │                        │                   │
│ styles.css   │        EDITOR          │   LIVE PREVIEW    │
│ index.js     │                        │                   │
├──────────────┤                        │                   │
│ Need help?   ├────────────────────────┤                   │
│ Challenges   │  error panel (hidden)  │                   │
└──────────────┴────────────────────────┴───────────────────┘
```

Three files, no filesystem, no tree, no new-file button. Stacks vertically under ~900 px for Chromebooks in portrait or split-screen.

**Preview** — exactly as you described: assemble into one document and hand it to `iframe srcdoc`, sandboxed. Never execute student JS in the page itself.

```js
preview.srcdoc = `<!DOCTYPE html>
<html><head><style>${css}</style></head>
<body>${html}<script>${js}<\/script></body></html>`;
```

~400 ms debounce **plus** an explicit **Run ▶**. Guard the `</script>` sequence in student JS or a stray string closes the block early — a real bug that produces a baffling blank page.

**Starter project** — never a blank screen.

```html
<h1>Wild Willows Explorer</h1>
<p id="message">Loading game data...</p>
```
```css
body { font-family: sans-serif; padding: 2rem; }
h1   { color: seagreen; }
```
```js
async function loadGameData() {
  const response = await fetch("https://wildwillows.app/GameData/");
  const data = await response.json();
  console.log(data);
}
loadGameData();
```

It runs, it does something, and there's an obvious next move. That's the whole design.

**Choose a Challenge drawer** — four prompts instead of one prescribed result:

| Challenge | Build | Extensions |
|---|---|---|
| **Animal Explorer** | A page showing animals from Wild Willows | cards · filter by biome · animal count · search |
| **Biome Dashboard** | Information about each biome | biome cards · counts · progress bars · colors |
| **Field Guide** | A digital field guide from game data | names · habitat requirements · diet · species info |
| **Data Detective** | Answer a question using the API | *Which biome has the most species? How many depend on water?* |

Data Detective is the sleeper — it smuggles genuine data literacy into a coding lesson, and it's the one that makes this cross-curricular without anyone announcing that it's cross-curricular. It's also **chapter 7's exam**: "which biome has the most species?" is `.reduce()`, "how many depend on water?" is `.filter().length`. A student who can answer either has understood the iterator chapter, whatever the rubric says.

**"Give me an idea" modal** — the four challenges above are the structured path; this is the escape hatch for everyone else. A **💡 Ideas** button in the toolbar opens a modal of small, concrete, buildable projects drawn from the real data, with a **Shuffle** button that deals a fresh handful.

Why both: the four challenges are what a teacher assigns, and the modal is what a student opens at minute 38 when they've finished early, or at minute 12 when they can't think of anything and are about to disengage. *"Build something with the data"* is paralyzing for a beginner. *"Show every animal that eats berries"* is a task you can start in ten seconds.

**Mechanics**
- Opens on demand, and **auto-offers once** — the first time a student sits idle in the builder for ~90 seconds with unmodified starter files. Once, dismissible, never again that session. That idle student is the one this feature exists for.
- Shows 3 cards at a time from a pool of ~30. **Shuffle 🎲** deals three more; **Surprise me** picks one at random and closes.
- Filter chips: **Easy · Medium · Ambitious**, plus **Uses `if / else` · `.filter()` · `.map()` · `.reduce()`** so a student who wants to practice one thing can find an idea that needs it.
- Each card: a title, one plain sentence, and a small line naming which data it uses (`animals[].diet`, `biomes[].palette`).
- **Start this** seeds `index.js` with a *scaffold of TODO comments* — never working code. The idea should hand them a starting point, not do the assignment:
  ```js
  // Idea: Berry Eaters — show every animal that eats berries
  // 1. fetch the game data
  // 2. filter animals whose `eats` or `eatsOther` includes "berries"
  // 3. map each one to a <li> and put it on the page
  ```
  Seeding is undoable, same as the checkpoint **Show me**.

**The idea pool** — every one of these is real and checkable against `/GameData/`, which is the whole point. Sample across the tiers:

*Easy — one filter or one map*
- **Meadow Roll Call** — every animal in Willow Meadow, as a list.
- **Berry Eaters** — animals whose diet mentions berries.
- **Name That Species** — each animal's common name with its `scientificName` underneath in italics.
- **Rare Finds** — only the animals marked `rare`.
- **Top of the Chain** — everything with `trophic: "apex-predator"`.
- **Fact of the Day** — one random animal's `fact`, with a "Show me another" button.
- **Biome Colors** — each biome's name, styled with its own `palette.healthy` hex. *The data ships you a color scheme; use it.*
- **Tiny Things** — every animal whose `kind` is `invertebrate`.

*Medium — filter plus sort, or two fields together*
- **A–Z Field Guide** — all 150 animals sorted alphabetically, grouped by first letter.
- **Biome Picker** — six buttons, one per biome; click one and the list swaps.
- **Search Box** — type a name and filter as you go.
- **Habitat Checklist** — one animal's `requirements.objects` as a to-do list of what it needs to come home.
- **Hardest to Please** — animals sorted by `requirements.minHealth`, toughest first.
- **Diet Cards** — a card per animal with diet, shelter and preferred habitat.
- **What Eats What** — pick an animal, show its `eats` and `eatenBy` as two columns.
- **Recipe Lookup** — a crafting recipe and the materials it needs.
- **Resource Map** — each biome with the resources you can gather there.
- **Sources Page** — one animal's real-world `sources` as clickable links. *Quietly teaches citation.*

*Ambitious — reduce, grouping, or real interaction*
- **Species Census** — a count per biome, as bars scaled to the biggest.
- **Food Web** — pick an animal and walk the `eats` / `eatenBy` chain outward.
- **Trophic Pyramid** — animals stacked by `trophic`, widest tier at the bottom.
- **Restoration Planner** — pick a health percentage and show which animals would return at that level.
- **Rarity Breakdown** — how many common vs uncommon vs rare, as a chart you draw with `<div>` widths.
- **Two-Biome Comparison** — side by side, whose species overlap.
- **Quiz Mode** — show a `fact`, ask which animal it belongs to, three choices.
- **Water Dependents** — everything whose requirements mention water.
- **Guess the Biome** — show an animal's `preferredHabitat` and let the player guess where it lives.
- **Field Journal** — pick favorites and keep them in a list that survives a refresh.

**Design notes**
- Keep every card **one sentence.** The moment an idea needs a paragraph it's an assignment, not an idea, and students stop reading.
- Bias the pool toward **visibly different results** — a page of colored biome cards, a bar chart, a quiz. Twenty variations on "a list of names" makes the data feel smaller than it is.
- Write ideas that **flatter the dataset**: `palette` hex codes, `scientificName`, `sources`, `eats`/`eatenBy`. A student who discovers the data is richer than they assumed starts having their own ideas, which is the actual goal.
- **Ideas are the natural home for anything cross-curricular** — Sources Page and Guess the Biome are science lessons in a coding assignment's clothing, and they're the link back to the `/teachers/science` kit.
- Store the pool as one array of objects in the page. Adding an idea should be one line, so you can grow it whenever a class produces a good one.

**Metrics** — `ideas{opened, shuffled, surprise, auto-offered, dismissed}` and `idea_started{<slug>}` (allowlisted to the pool's own slugs, `other` otherwise). This gives you something you can't get any other way: **which prompts students actually pick, and which ones they pick and then abandon.** Prune the dead ones, write more like the popular ones, and the pool gets better every semester. Pair `idea_started` with `download` to see which ideas get finished, not just chosen.

**"Need help?" sidebar** — context-aware, reacting to which file is open:

> **HTML** — creates the things you see on the page.
> **CSS** — changes how those things look.
> **JavaScript** — can change the page and retrieve data.
>
> **Fetching Wild Willows data**
> ```js
> const response = await fetch("https://wildwillows.app/GameData/");
> const data = await response.json();
> ```
> **Displaying something**
> ```js
> document.querySelector("#example").textContent = value;
> ```

Every snippet has a **Copy** and an **Insert** button. This is the feature that stops one teacher having to debug thirty students' JavaScript, and it's worth more than syntax highlighting by a wide margin.

**Error panel that teaches debugging** — never a silent blank preview:

> **Something went wrong**
> `ReferenceError: animal is not defined` — line 8
> *JavaScript doesn't recognize the name `animal`. Check whether you created a variable with that name, and check the spelling — `Animal` and `animal` are different.*

Ship plain-English explanations for the ~15 errors beginners actually hit: `is not defined` · `Cannot read properties of null` (the `querySelector` typo — by far #1) · `Cannot read properties of undefined` (asked for something that isn't in the data) · `Unexpected token` · `Unexpected end of input` · `is not a function` · `Failed to fetch` (network filter — say so, and tell them to ask the teacher) · `Unexpected token '<' in JSON` · `await is only valid in async functions` · `Assignment to constant variable` · `undefined is not iterable`. Each gets *what it means* and *what to check*, never just the raw message.

**Three of those are data-type errors wearing different hats** — `null`, `undefined`, and "this is text, not a number." Write their explanations to say so, and link back to chapter 3's table. A student who reads *"`null` means there's deliberately nothing here — `querySelector` gives you `null` when it can't find the element you asked for, so check the spelling of your `id`"* has learned the type and fixed the bug in the same breath. That's the payoff for not making them sit through a types chapter up front.

Also catch the silent one, which throws no error at all: a page rendering the literal text **`undefined`** or **`[object Object]`**. Detect both in the preview and surface a note — *"you're showing a whole object where you meant one of its parts — try `.name`"*. Nothing in the browser tells them; it just looks broken. Log which ones fire (§7) and write more explanations for whatever actually shows up.

**Saving** — `localStorage`, one versioned key:
```
wildWillowsCodeLab: { version, html, css, javascript, challenge, updatedAt }
```
Autosaved on a debounce; on load, *"Picking up where you left off — [Start over]."* If storage is unavailable or unparseable, say so plainly and keep the starter files rather than showing an empty editor with no explanation.

**Reset project** — back to starter files, with a confirm.

**Download project** — bundles into one standalone `.html` (CSS in `<style>`, JS in `<script>`) via a Blob. This is the turn-in artifact, the take-home artifact, and — if you add the matching **Open a saved file** — the only save that survives a wiped Chromebook or a different machine on day 2. Given managed-Chromebook carts, I'd treat import/export as the real persistence story and `localStorage` as the convenience layer, not the reverse. Downloading their actual website is the right note to end on.

**URL seeding** — `#challenge=field-guide` and a compressed `#code=` payload, so the answer-key link and the chapter-9 hand-off both work.

---

## 7. Metrics — the full design

You want everything. Here's a system that captures it while staying counters-only, which is what keeps it shippable (§8).

### 7a. Shape: copy `LandingStat`, don't extend it

A new **`LessonStat`** table, one row per UTC day, same architecture as `LandingStat` — which is proven under real traffic and whose failure modes are already documented in your own comments.

**Don't reuse `LandingStat`.** Your own code explains why: visits there are *"ONE undifferentiated series shared by every page that sends them"*, which is exactly why `/teachers` had to report itself as a fake click (`edu-page`) instead of a visit. Three new pages with rich funnels would make that worse. Separate table, separate rollup, separate dashboard section.

```graphql
# LessonStat : ONE row per UTC day (`day:YYYY-MM-DD`) · day, plus flat
#              { key: n } counter maps — views, funnel, chapters, challenges,
#              errors, env — and updatedAt. Aggregate counters ONLY: no
#              identifiers, no free text, no student code, ever.
type LessonStat @table(database: "wildwillows") { id: ID @primaryKey }
```

**Reuse `bumpLandingStat`'s exact implementation shape** and read the comment above it before writing a line. The bug it documents — mutating a Harper record in place, which is frozen, which throws in ESM strict mode, which got swallowed by the catch, so every day flatlined at the first event — is a trap you will otherwise fall into a second time. Rebuild a plain literal from `findCounterRow` (**not** `safeGet`, or a cold-start null looks like "first event of the day" and zeroes the row), mutate that, `put` it.

### 7b. What to count

Six groups. Every value is a bounded, allowlisted key — anything unrecognized collapses to `other`, exactly like `LANDING_CLICK_TARGETS`, so a malicious or buggy client can't mint unbounded counter keys.

**1 · Reach** — who arrives
`views{hub, science, coding, lesson, builder}` · `uniques{...}` (first-ever, localStorage-guarded) · `referrer{internal, search, social, direct, other}` — **bucketed on the client, raw referrer never sent.**

**2 · Funnel** — the number you'll actually act on
`funnel{hub_view, science_view, coding_view, lesson_start, chapter_2…9_reached, builder_open, first_run, first_fetch_ok, challenge_chosen, download}`
Read as a drop-off curve, this tells you where the lesson loses people. If `chapter_7_reached` is half of `chapter_6_reached`, the iterator chapter is too steep and you can go fix it. Nothing else you build here will be as useful.

The hub also gives you a split you can't currently see: **of the teachers who land on `/teachers`, how many go to science and how many to coding?** That's the number that tells you whether the 9–12 kit was worth building, and it only exists once the hub exists.

**3 · Learning progress**
`types{legend-opened, tree-expanded}` — whether chapter 3's type legend gets used at all, which is how you find out in a month whether folding types in worked or whether it needs its own chapter after all · `chapters{1…9}` reached · `challenges{1…5}` completed (chapter 9) · `hints{chapter-n}` — "Show me" / help-sidebar insert used · `dwell{chapter-n: bucket}` where bucket is `<1m / 1-3m / 3-10m / >10m`, **never a raw timestamp**.

**Instrument chapters 6 and 7 more finely than the rest** — `cond{if, else, else-if, comparison, and-or, empty-guard, ternary}` and `iter{for-of, forEach, map, filter, find, reduce, sort, chained}`, one counter per construct actually run.

Chapter 6's counters answer a question you can't otherwise settle: **was moving `if / else` ahead of loops the right call?** If `chapter_7_reached` stays high after the change, and `filter` runs climb relative to the old numbers, the reordering worked. If chapter 6 becomes the new drop-off point, it's too long and the `&&`/`||` and ternary sections are what to cut first. It's the longest chapter, the one most likely to lose people, and the only one where you'd genuinely want to know *which specific idea* was the wall. If `reduce` runs are a tenth of `filter` runs, that confirms marking it optional was right; if `map` runs are low, chapter 8 is about to fail for everyone and you'd never otherwise know why.

**4 · Builder health**
`runs{debounced, manual}` — the debounce/Run split answers whether the button earns its place · `fetch{ok, failed, blocked}` · `errors{reference, null-property, syntax, unexpected-eof, not-a-function, fetch-failed, json-parse, await-async, const-assign, other}` · `edits{html, css, js}` bucketed per session (`1-5 / 6-20 / 21-50 / 50+`) · `challenge{animal-explorer, biome-dashboard, field-guide, data-detective, none}` · `actions{download, import, reset, seeded}`.

The `errors` map is quietly the most valuable thing here: it tells you which plain-English explanations to write next, ranked by how often students actually hit them.

**5 · Environment** — the invisible failure
`env{viewport-sm, viewport-md, viewport-lg}` · `env{fetch-blocked}` · `env{storage-unavailable}`.
**`fetch-blocked` is the one to watch.** A school filter that blocks `wildwillows.app` breaks the lesson completely and silently — the teacher assumes the lesson is broken, you never hear about it, and they don't come back. A counter turns "did any school get blocked today?" into a number on your dashboard.

**6 · Session shape**
`sessions{total}` · `duration{<5m, 5-15m, 15-30m, 30-60m, >60m}` · `returning{day2, day3}` (localStorage flag, no identifier).

### 7c. Transport: one batched beacon, not one POST per event

Preview runs fire on every debounce. Chapter scrolls fire constantly. **Do not POST each one** — the `telemetry` rate tier is 60/min and a keystroke-driven beacon would blow it for a whole classroom sharing one NAT'd school IP.

- Accumulate counts in memory in a plain `{ key: n }` object.
- Flush on `visibilitychange → hidden` and on `pagehide` via **`navigator.sendBeacon`**, which survives the tab closing (a plain `fetch` does not — you'd lose exactly the sessions that completed).
- Also flush on a slow interval (~60 s) so a browser that never fires `pagehide` still reports.
- One POST carries the whole session's counters.

```
POST /LessonEvent/  { page: "builder", counts: { runs_manual: 12, errors_reference: 2, ... } }
```

Server-side: allowlist every key, clamp every value to a sane ceiling, sum into today's row. `rateTier = 'telemetry'`. **Always return `{ ok: true }`** — analytics never gets to break a lesson in progress. Same discipline as `LandingEvent`.

Count the **download** server-side too where you can, the way `bumpPdfDownload` already does for the PDFs — client beacons undercount, and a download is your best success signal.

### 7d. Reading it back

- **`GET /LessonStats/`** — a `DashboardEndpoint` behind auth, backed by a `RollupCache` (15 s, same as `landingStatsCache`), returning ~180 day-rows plus lifetime totals. Model it on `buildLandingStats` including the `LANDING_DAYS_RETURNED` comment's lesson: **size the payload to the widest dashboard preset**, or a "90d" pill silently renders 60 days and nothing tells you.
- **A new `/dashboard` section, "Classroom"** — sitting near the Landing page section. Four blocks:
  1. **Funnel bar** — hub → coding guide → lesson → builder → first fetch → download, with drop-off percentages. The headline.
  2. **Hub split** — science vs coding, as a share of hub visits. Answers "was the 9–12 kit worth it?"
  3. **Chapter drop-off** — where students stop, with chapter 7's per-method breakdown expandable underneath.
  4. **Top errors** — ranked, i.e. your work queue for explanation copy.
  5. **Health strip** — fetch-blocked count, storage-unavailable count, viewport split.
- Presets 7d / 30d / 90d / All, matching the existing charts.

Before writing the dashboard charts, read the **`dataviz` skill** — there's an established palette and a set of rules in this environment for exactly this kind of KPI-row-plus-funnel layout, and the dashboard already has a visual language to match.

### 7e. What not to collect

No IP storage. No cookies. No third-party analytics — you don't have any today and adding one to a page used by minors in schools would be the single worst decision available here. No raw referrer URLs. No raw timings. No student code, ever, not even on error. No identifiers of any kind.

---

## 8. Privacy, and why it's load-bearing here

`PRIVACY.md` currently covers the game: device storage, gameplay stats, feedback, children, the browser version. **It says nothing about website analytics** — not even the existing landing-page counters. That gap is survivable for a marketing page. It is not survivable for a page a school district evaluates before letting thirty minors use it.

Before these pages ship:

1. **Add a "Website and classroom pages" section to `PRIVACY.md`** — what's counted, that it's aggregate-only, that there are no cookies, no accounts, no third parties, no student identifiers, and that nothing a student types is ever transmitted. Cover the existing landing counters at the same time; they're currently undocumented.
2. **Put a plain-language privacy line on the educator page itself**, linked to the policy. Teachers get asked "what does this site collect about my students?" and need a link they can forward to an administrator. One paragraph they can paste into a district form is worth more to adoption than any feature in this plan.
3. **State it in the Code Builder too** — one line under the editor: *"Your code stays in your browser. It is never sent to us."* True, and it's the question a sharp student will ask.
4. Extend the `Children` section to name the classroom pages explicitly.

This is not box-ticking. "No accounts, no cost, nothing to install, nothing collected about students" is the strongest adoption argument you have, and it's only credible if it's written down.

---

## 9. Wiring checklist

1. **Split `public/teachers.html`** into `public/teachers-hub.html` (new, short) and `public/teachers-science.html` (the existing content, with its structured data and meta intact — see §2b). Add `public/teachers-coding.html`, `public/learn-web-development.html`, `public/learn-code-builder.html`. All self-contained; `<style>` shared from the existing page so the five can't drift.
2. `scripts/build-pages.mjs` — five entries in the **explicit** `pages` map (L77–91): `teachersHubHtml`, `teachersScienceHtml`, `teachersCodingHtml`, `learnWebDevHtml`, `learnCodeBuilderHtml`. Drop the old `teachersHtml` entry once nothing imports it.
3. `server/resources.ts` — import them from `./pages` (next to the current `teachersHtml`, L67).
4. `server/resources.ts` — rewrite `TeachersPage` (L13001) to switch on `getId()`: empty → hub, `science` → science, `coding` → coding, anything else → 404. Add a `Learn` class on the same pattern (`Screenshot`, L13079).
5. `server/resources.ts` — `PUBLIC_PAGES` rows (L12851) for `/teachers`, `/teachers/science`, `/teachers/coding`, `/learn`, `/learn/web-development`, `/learn/code-builder`, all `{ redirect: true, sitemap: true }`.
6. `server/resources.ts` — export map (L13287): keep `TeachersPage as teachers`, add `Learn as learn`.
6b. **Existing links to `/teachers` now land on the hub, not the science lesson.** Audit and repoint the ones that meant the science kit specifically: the landing page's "For teachers" section and `edu-nav` links, the FAQ answers on `/support` and `/age-rating`, and — the ones you can't fix — the URLs printed inside both classroom PDFs. Those are the argument for keeping `/teachers` a useful destination rather than a redirect: a teacher arriving from a printed PDF still gets somewhere sensible, one click from what they wanted.
7. `schema.graphql` — the `LessonStat` table (§7a), with the comment block explaining the counters-only contract.
8. `server/resources.ts` — `bumpLessonStat`, `LESSON_EVENT_KEYS` allowlist, `LessonEvent` (public, `rateTier = 'telemetry'`), `buildLessonStats`, `lessonStatsCache`, `LessonStats` (`DashboardEndpoint`).
9. `public/dashboard.html` — the Classroom section + its `fetch('../LessonStats/')`, hidden if unavailable (existing pattern, L4937).
10. `workers/play.js` — add `LessonEvent` to the `PROXIED` allowlist **only if** the pages are ever served from `play.wildwillows.app`. They aren't, so probably don't — and the comment there is emphatic that the allowlist is never a prefix match.
11. `GameData.get()` (L5921) — the `access-control-allow-origin` header (§2a).
12. `PRIVACY.md` — the new section (§8). `README.md` and `CONTRIBUTING.md` — the endpoint table at L248 gets `/LessonEvent/`, `/LessonStats/` and the CORS note.
13. Cross-links: landing nav, `/teachers` → `/educators`, the three pages to each other (Teach → Learn → Build, and *Need a refresher?* back).
14. `npm run build:server` — regenerates `server/pages.ts`, `server/page-lastmod.ts`, `resources.js`. All generated-and-committed; commit them.

---

## 10. Testing

- **Integration** — each of the five routes 200s with `text/html`; **`/teachers` with no id still 200s** (the printed-PDF guard — assert it explicitly, it's the regression that would embarrass you); unknown `/teachers/<slug>` and `/learn/<slug>` 404; all five paths in `/sitemap.xml`; `/teachers/science` carries the `LearningResource` structured data and the hub does not; `GameData` returns the CORS header. Plus a **`LessonEvent` suite** modeled on `tests/integration/landing.test.ts`: counters aggregate into one day-row, unknown keys collapse to `other`, values clamp, a second event of the day increments rather than resets (**the frozen-record regression — the harness already freezes reads specifically to catch this**), and `LessonStats` requires auth.
- **Contract test** — the `/GameData/` field pins from §2c, failing with a message that names the classroom pages. **Extend it to the ideas pool**: every idea card names the fields it uses, so assert each one still resolves and each filter value still matches something. An idea that silently returns an empty list is worse than no idea — the student assumes they broke it.
- **Unit** — the `<ww-runner>` assembler (three strings → one document, including the `</script>` escape), the download bundler, the import parser. Plus the **chapter 6 and 7 worked examples run against real `/GameData/`** and produce the counts the page claims (25 meadow animals, 150 total) — the numbers are printed in the lesson copy, and a content change that makes the lesson lie to students should fail CI. **Round-trip is the assertion that matters**: three files → download → import → identical three files. That's the cross-day recovery path.
- **E2E** (Playwright is configured) — type into the builder, assert the preview updates; trigger each known error and assert the friendly explanation renders; run every challenge's starter and assert no error bar; download and assert the file fetches successfully when opened (the real regression guard for §2a).
- **Manual** — a Chromebook, a tablet, a phone, and if you can borrow one, a filtered school network.
- `npm run test:all` and `npm run lint` before commit; `deploy.sh` already verifies the served build stamp.

---

## 11. Build order

Your phasing is right and the reasoning behind it is the important part: you can't write curriculum around a sandbox whose capabilities you're still guessing at.

| Phase | Work |
|---|---|
| **0** | Decisions §2a–d. CORS header + its test. `/GameData/` contract test. |
| **1** | **`<ww-runner>`** (§3) — the shared editor/preview/error component. Everything downstream is built on it. |
| **2** | **Code Builder** — three files, tabs, preview, error panel with explanations, localStorage, reset, download/import. |
| **3** | **Metrics** — `LessonStat`, `LessonEvent`, batched beacon, `LessonStats`, dashboard section. Ship it *with* the builder, not after: retrofitting instrumentation means the first cohort of real classroom use goes unmeasured, and that's the cohort you most want data on. |
| **4** | **Student lesson** — chapters 1–9, reusing `<ww-runner>` throughout. |
| **5** | **Educator guide** (`/teachers/coding`) — written last, once the student experience exists to describe accurately. **Then the `/teachers` split**: hub + science page, shipped in the same deploy so the reorganization and its payoff go live together. |
| **6** | Polish: challenges drawer, **ideas modal + its pool**, help sidebar, answer key, seeding links, accessibility pass, keyboard nav, small-screen handling, `PRIVACY.md`, cross-links, sitemap. |
| **7** | Optional: printable handout PDF via the existing base64 mechanism. |

One change from your ordering: **metrics move up to phase 3**, ahead of the lesson and guide. It's cheap while the builder's event points are fresh, and it means you learn from the very first classroom that uses it.

---

## 12. The bigger play

The framing is right, and it's a bigger deal than the lesson itself:

> **Wild Willows Open Game Data** — public game data that students, educators and developers can use to learn programming, explore ecology and build their own projects.

That reframes the ask from "here are worksheets to go with my game" to "this game ships a real public data API and a browser coding environment where high schoolers learn web development against ecological data." Computer Science + Biology + Environmental Science + Data Literacy, from one dataset. Very few indie games can say that, and it's a much stronger educator-outreach story than either the 5–8 kit or this lesson standing alone.

If you go there, a `/developers/api` page documenting one endpoint with JavaScript and Python examples is the whole first version, and §2c's `/EduData/` projection becomes worth building — a documented public contract you can actually promise not to break. Scratch-compatible activities would reach the middle-school end and connect back to the existing kit.

Worth doing **after** the three pages ship, not before. The lesson proves the data is useful; the platform page then has something to point at.

---

## 13. Open questions

1. **Spanish.** The game ships English + Spanish; public pages are English-only. These pages roughly double in copy if localized — decide before writing, not after. (A lesson usable in a bilingual classroom is a real differentiator, but it's a big content commitment.)
2. **Timing the `/teachers` split.** The hub is the right structure, but it moves the science kit to a new URL and temporarily unsettles a page that currently ranks for its keyword (§2b). Don't ship it right before an event where you're handing out the PDFs, and consider shipping the hub *with* the coding kit rather than ahead of it, so the reorganization and the reason for it land together.
3. **Managed Chromebooks and `localStorage`.** Carts often don't hand a student the same machine twice, and guest mode clears storage. Confirm with a real teacher before the educator page promises work is saved — and treat download/import as the actual answer.
4. **Link the builder from inside the game?** A "how was this made?" link in the How to Play panel would reach exactly the right students — but it also puts a code editor one click from a game the school approved. Probably worth doing; worth deciding deliberately rather than by accident.
5. **Dashboard retention.** `LandingStat` keeps 60 days elsewhere in the codebase but the rollup returns 180. Decide the `LessonStat` retention story up front — school-year comparisons ("how did this go in September vs February?") argue for keeping day-rows indefinitely, and they're eight small numbers a day.

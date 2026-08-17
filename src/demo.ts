// Build-time switches for the browser-playable itch.io DEMO.
//
// The demo is a WEB build (`DEMO=true npm run build:web`) served as static files
// on itch. It plays the real game against the hosted Harper (Harper-first), and
// if Harper can't be reached (offline / CORS) it falls back to the in-app solo
// backend so the demo still runs — see resolveDemoBackend() in src/api.ts.
//
// Scope of the demo: a caretaker restores the starter meadow to unlock the forest,
// then gets a taste of what lies past it. The demo hard-stops — with a thank-you
// popup that returns to the title screen — once DEMO_BUDGET_MINUTES of play have
// passed SINCE the forest unlocked, wherever they're spent. There's deliberately NO
// meadow cap, so nothing ends the demo before they reach the forest.
//
// That budget is persisted per save (src/demoBudget.ts) rather than held in memory.
// In memory it reset on every reload and only ran while the player stood in the
// forest, which is how a demo player reached the wetland and put in two hours. See
// the demo gate in src/state.tsx + App.tsx.
//
// `typeof` keeps this safe in non-Vite contexts (e.g. Vitest), where the
// injected constant doesn't exist — there it falls back to `false`.
export const DEMO: boolean = typeof __DEMO__ !== 'undefined' ? __DEMO__ : false;

/**
 * The second biome, and the one whose unlock starts the demo's clock.
 *
 * Not a cap on the forest itself: the demo doesn't restrict which biomes a player
 * can open (unlocks are ordinary game rules, see data/biomes.json), so anything
 * that counted forest time alone stopped counting the moment they moved on. The
 * budget lives in src/demoBudget.ts.
 */
export const DEMO_FOREST_BIOME = 'forest';

// Where a demo player goes to buy the game. Both stores sell the SAME full
// game, so both are offered rather than guessed at: the browser demo runs inside
// itch's iframe (where the itch page is one click away and already familiar),
// but a Mac player who found the demo elsewhere would rather have the App Store
// build than a DMG. Any link out of the demo must open in a NEW tab — inside the
// itch embed, navigating the frame itself would replace the running game.
export const STORE_ITCH_URL = 'https://bai13y.itch.io/wild-willows';
export const STORE_MAS_URL = 'https://apps.apple.com/us/app/wild-willows/id6787300760?mt=12';

/** Which product a metrics report belongs to, so dashboards can split demo vs
 *  paid players. Rides on heartbeats, app-open pings, and solo metric uplinks.
 *  Build-time only — a dev preview toggle (below) never tags real metrics. */
export const EDITION: 'demo' | 'full' = DEMO ? 'demo' : 'full';

// Which backend the browser demo plays against:
//   'harper' — the hosted Harper is the source of truth (server-validated
//              gameplay), same as the full game. Still PASSWORDLESS: the demo
//              hides the passcode field, auto-generates one, and the server mints
//              a unique player id per demo save so anonymous players never collide
//              (see CreatePlayer's edition:'demo' path). Needs CORS for itch's
//              origin; if the hosted Harper can't be reached, it falls back to the
//              offline solo backend so the demo still runs.
//   'solo'   — fully-offline in-app backend (localStorage saves, no network to
//              play). Metrics still upload best-effort.
// Metrics are tagged edition:'demo' either way.
//
// 'harper' — the demo plays against the real server, same rules and same
// validation as the full game, with ONE source of truth for game logic instead
// of a second copy running in the browser.
//
// The cost is a concurrency ceiling, and it is NOT a single number: per-player
// read cost scales with how much of the world the player has built, so the
// ceiling falls as people play. Measured with scripts/capacity-report.mjs on a
// warm worker, against a PRO tier (1M row reads/min):
//
//   brand-new save          145 writes ·  1,500 rows/min  → ~650 concurrent
//   forest just unlocked    149 writes · 12,200 rows/min  →  ~82 concurrent
//   15-min budget spent     164 writes · 21,100 rows/min  →  ~47 concurrent
//   a meadow completionist  165 writes · 48,300 rows/min  →  ~20 concurrent
//
// It binds on READS at every size. If the demo ever gets that busy the fix is
// read amplification first, not a bigger instance — and the biggest remaining
// one is Placement, whose ids carry no area, so every per-biome placement read
// is still a whole-world scan (see byArea in server/resources.ts).
//
// Cross-origin is handled by the Worker (workers/play.js), which proxies these
// endpoints server-side so the browser only ever talks to its own origin. Do not
// "simplify" that away by pointing the client straight at the API host; that
// needs CORS on Harper, and when CORS breaks these calls fail silently.
export const DEMO_WEB_BACKEND: 'solo' | 'harper' = 'harper';

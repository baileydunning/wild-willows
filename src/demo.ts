// Build-time switches for the browser-playable itch.io DEMO.
//
// The demo is a WEB build (`DEMO=true npm run build:web`) served as static files
// on itch. It plays the real game against the hosted Harper (Harper-first), and
// if Harper can't be reached (offline / CORS) it falls back to the in-app solo
// backend so the demo still runs — see resolveDemoBackend() in src/api.ts.
//
// Scope of the demo: a caretaker restores the starter meadow to unlock the forest,
// then gets a taste of it. The demo hard-stops — with a thank-you popup that
// returns to the title screen — once the player has spent DEMO_FOREST_MINUTES in
// the forest. There's deliberately NO meadow cap, so nothing ends the demo before
// they reach the forest. See the demo gate in src/state.tsx + App.tsx.
//
// `typeof` keeps this safe in non-Vite contexts (e.g. Vitest), where the
// injected constant doesn't exist — there it falls back to `false`.
export const DEMO: boolean = typeof __DEMO__ !== 'undefined' ? __DEMO__ : false;

/** The second biome the demo lets you reach; time spent here is what's capped. */
export const DEMO_FOREST_BIOME = 'forest';

/** Minutes of time in the forest before the demo hard-stops. */
export const DEMO_FOREST_MINUTES = 10;

/** Same limit in milliseconds (accumulated wall-clock while in the forest). */
export const DEMO_FOREST_MS = DEMO_FOREST_MINUTES * 60 * 1000;

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
// The cost is a concurrency ceiling: server-authoritative play measures ~145
// writes and ~1,750 row reads per player per MINUTE (scripts/capacity-report.mjs),
// which caps the hosted instance around 570 concurrent players and binds on
// READS, not writes. If the demo ever gets that busy, the fix is read
// amplification first — Terraform reads 53 rows per call and GameState 30 —
// not a bigger instance.
//
// Cross-origin is handled by the Worker (workers/play.js), which proxies these
// endpoints server-side so the browser only ever talks to its own origin. Do not
// "simplify" that away by pointing the client straight at the API host; that
// needs CORS on Harper, and when CORS breaks these calls fail silently.
export const DEMO_WEB_BACKEND: 'solo' | 'harper' = 'harper';

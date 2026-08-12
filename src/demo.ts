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
// 'solo' because the demo is the one build that can be handed to an unbounded
// number of people at once. Server-authoritative play costs ~145 writes and
// ~1,750 row reads per player per MINUTE (measured — scripts/capacity-report.mjs),
// which caps the hosted instance in the hundreds of concurrent players. The same
// game running in-app costs one AppOpen write per launch and one SyncMetrics
// write every 3 minutes, so the ceiling stops being a database question and
// becomes a CDN question. A cozy single-player demo gains nothing from
// server-side validation — there is no leaderboard and no economy to protect.
//
// What this does NOT change: metrics. shouldUplink() (src/solo/metricsUplink.ts)
// reports on the 'solo' transport too, so the demo→full funnel, the acquisition
// counts and the channel split all keep working.
//
// Returning players with a save created under 'harper' are NOT stranded by this —
// resolveDemoBackend() (src/api.ts) still honours the DEMO_HOME_KEY pin and
// probes Harper for them. Read that before changing this back.
export const DEMO_WEB_BACKEND: 'solo' | 'harper' = 'solo';

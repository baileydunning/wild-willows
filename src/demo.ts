// Build-time switches for the browser-playable itch.io DEMO.
//
// The demo is a WEB build (`DEMO=true npm run build:web`) served as static files
// on itch. It plays the real game against the hosted Harper (Harper-first), and
// if Harper can't be reached (offline / CORS) it falls back to the in-app solo
// backend so the demo still runs — see resolveDemoBackend() in src/api.ts.
//
// Scope of the demo: a caretaker restores the meadow until DEMO_ANIMAL_GOAL
// animals have returned, then the game hard-stops with a thank-you popup that
// returns to the title screen (see the demo gate in src/state.tsx + App.tsx).
//
// `typeof` keeps this safe in non-Vite contexts (e.g. Vitest), where the
// injected constant doesn't exist — there it falls back to `false`.
export const DEMO: boolean = typeof __DEMO__ !== 'undefined' ? __DEMO__ : false;

/** How many animals must return to the meadow before the demo hard-stops. */
export const DEMO_ANIMAL_GOAL = 5;

/** The single biome the demo lets you work on (the starter meadow). */
export const DEMO_BIOME = 'meadow';

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
export const DEMO_WEB_BACKEND: 'solo' | 'harper' = 'harper';

// ---------------------------------------------------------------- dev preview
// Devs can flip demo mode ON from the Dev panel to exercise the player-facing
// demo gating (the 5-animal hard-stop popup + the tutorial "demo" note) against
// a normal `npm run dev`, without a separate DEMO build. It is a pure UX preview:
// it does NOT change the backend/probe, metrics edition, or actually delete a
// save — those stay keyed on the build-time DEMO flag. Persisted in localStorage
// so it survives reloads.
const DEV_DEMO_KEY = 'wild-willows:dev-demo';

/** The dev override is THREE-STATE so it can force demo gating either way:
 *  true = force on, false = force off, null = no override (use the build's DEMO).
 *  This lets dev tools turn the demo OFF inside a real demo build (e.g. to play
 *  past the 5-animal stop), not just turn it on in a normal dev build. */
export function readDevDemoOverride(): boolean | null {
	try {
		const v = localStorage.getItem(DEV_DEMO_KEY);
		return v === '1' ? true : v === '0' ? false : null;
	} catch {
		return null;
	}
}

export function writeDevDemoOverride(on: boolean | null): void {
	try {
		if (on === null) localStorage.removeItem(DEV_DEMO_KEY);
		else localStorage.setItem(DEV_DEMO_KEY, on ? '1' : '0');
	} catch {
		/* private mode etc. — the override just won't persist */
	}
}

/** Whether the demo's player-facing gating is active: a dev override wins if set,
 *  otherwise it's the build's DEMO flag. Use this for the gate + tutorial note;
 *  use the raw `DEMO` const for anything that must only happen in an actual
 *  shipped demo (backend, metrics, deletion). */
export function isDemoActive(): boolean {
	const override = readDevDemoOverride();
	return override === null ? DEMO : override;
}

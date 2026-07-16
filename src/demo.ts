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

// ---------------------------------------------------------------- dev preview
// Devs can flip demo mode ON from the Dev panel to exercise the player-facing
// demo gating (the 5-animal hard-stop popup + the tutorial "demo" note) against
// a normal `npm run dev`, without a separate DEMO build. It is a pure UX preview:
// it does NOT change the backend/probe, metrics edition, or actually delete a
// save — those stay keyed on the build-time DEMO flag. Persisted in localStorage
// so it survives reloads.
const DEV_DEMO_KEY = 'wild-willows:dev-demo';

export function readDevDemoOverride(): boolean {
	try {
		return localStorage.getItem(DEV_DEMO_KEY) === '1';
	} catch {
		return false;
	}
}

export function writeDevDemoOverride(on: boolean): void {
	try {
		if (on) localStorage.setItem(DEV_DEMO_KEY, '1');
		else localStorage.removeItem(DEV_DEMO_KEY);
	} catch {
		/* private mode etc. — the override just won't persist */
	}
}

/** True in a real demo build, OR when a dev has toggled the preview on. Use this
 *  for the demo's player-facing gating; use the raw `DEMO` const for anything
 *  that must only happen in an actual shipped demo (backend, metrics, deletion). */
export function isDemoActive(): boolean {
	return DEMO || readDevDemoOverride();
}

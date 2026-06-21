// Build-time feature switches.
//
// COOP_ENABLED controls the hosted-Harper multiplayer path (the Solo/Co-op
// toggle on the title screen and the in-game People/invite UI). It is OFF for
// the v1 itch.io release: the shipped desktop app is solo-only and fully
// offline, so it needs no server and no network.
//
// To bring co-op back you have two options (the code paths are all still here,
// just hidden):
//   1. Permanent: change the fallback below to `true`.
//   2. Per-build: build with the env var COOP_ENABLED=true (Vite bakes it in
//      via __COOP_ENABLED__ — see vite.config.ts). The co-op E2E CI job uses
//      this so multiplayer stays tested while v1 ships solo-only.
//
// `typeof` keeps this safe in non-Vite contexts (e.g. Vitest), where the
// injected constant doesn't exist — there it falls back to `false`.
export const COOP_ENABLED: boolean =
	typeof __COOP_ENABLED__ !== 'undefined' ? __COOP_ENABLED__ : false;

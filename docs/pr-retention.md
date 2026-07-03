# Retention: daily tasks, real-time growth, day phases, player feedback & CI deploys

This branch is about giving players reasons to come back — and giving me a way to hear from them when they do.

## Daily task board & per-day metrics

A rotating "Today's Tasks" board (collapsible widget under the top-right nav, `O` toggles it). Tasks are derived server-side as a pure function of `(worldId, UTC day)` — every device and co-op member computes the identical list with no stored state, and it resets at UTC midnight. Player actions bump new per-day counters (`player.daily`) alongside the existing lifetime metrics, `ClaimTask` awards completions, and claimed tasks tidy themselves off the board.

## Habitat growth over real time

Plantings now mature over real wall-clock hours whether or not the game is open. Habitat object defs opt in via `matureHours`/`matureBonus` (52 objects so far); a mature plant contributes bonus restoration points, so a preserve is literally healthier when you return. Everything derives from the placement's own `placedAt` timestamp — no background tick, no stored growth state. The heartbeat now returns a `welcomeBack` summary ("While you were away, 3 of your plantings matured and the land grew 2 points healthier") surfaced as a toast + feed line.

## Day phases & animal sighting conditions

- The world clock (driven by accrued play time) now surfaces a dawn/day/dusk/night phase: a colored chip in the HUD next to weather/season.
- Animals gained sighting `conditions` (day phase, season, weather) plus locked-entry hints. Journal cards show derived "when to spot them" notes — crepuscular/nocturnal/diurnal phrasing, seasonal windows, weather that coaxes them out.
- New hand-drawn texture work for the expanded roster (ringed tails, cetaceans, and friends).

## Biome grids

Per-biome `grid` sizes in `biomes.json` (meadow and others larger than one screen) with fixed meadow alignment logic, so the camera window reads at the same zoom in every biome.

## Player feedback (Settings → Send feedback)

- New section at the bottom of Settings: message box + optional reply email. Sends attach light diagnostics (build, platform, solo/coop/web mode, playtime, sessions, tutorial step, unlocked biomes).
- `POST /SubmitFeedback/` stores it in a new `Feedback` table on the hosted Harper. Feedback always travels over the network — even from the solo desktop build, whose game transport is the offline in-app backend.
- Offline-safe: failed sends queue in localStorage and retry at the start of every session; items are deleted only after the server confirms the row is stored. The button swaps to "Sent!" for 5s on confirmed delivery.
- `GET /ListFeedback/` returns everything newest-first. It extends the raw `Resource` (not `PublicEndpoint`), so Harper's default permissions apply — admin auth required, since rows carry player reply emails:
  `curl -u HDB_ADMIN https://wild.willows.harperfabric.com/ListFeedback/`

## Settings cleanup for solo

Solo saves have no real passcode and are deleted from the load menu, so the "Change passcode" and "Delete this save" sections are now hidden when the transport is solo.

## Typing no longer plays the game

New shared `isTypingTarget()` guard used by every keyboard listener (panel/tool hotkeys, task-board toggle, tutorial movement detector, Phaser scene — which also now handles a field already focused at scene start). Previously only `INPUT` was guarded, so typing in a textarea toggled panels and moved the caretaker. Escape steps out of a text box first; a second Escape closes the panel.

## Deploy workflow

`.github/workflows/deploy.yml` builds and deploys the co-op component to the hosted Harper (pattern from HarperFast/nextjs-example: configure a local Harper for the CLI, then `harper deploy`). It reuses `deploy-coop.sh` — now env-driven (`HARPER_PW`, `HARPER_USER`, `TARGET_URL`, `COOP_ENABLED`) with interactive fallback — so manual and CI deploys share one recipe. Triggers: manual run (with a co-op on/off checkbox) or a `deploy-*` tag. Secrets: `HARPER_USERNAME`, `HARPER_PASSWORD`, `TARGET_URL`.

## Testing

- New integration suites: `daily-and-growth.test.ts` (task derivation, day rollover, maturity windows) and `feedback.test.ts` (store/validate/list) — both drive the real `resources.js` bundle.
- New unit suite: `feedback.test.ts` (offline queue semantics: queue on network failure, flush-and-confirm, drop permanent rejections).
- 92 tests passing; typecheck clean.

## Schema note

One new dynamic table: `Feedback` (id-only declaration, like the other mutable tables). Existing tables are untouched, so no migration concerns — but the hosted instance needs a deploy + restart to pick up the new table before feedback starts landing.

# Weather Systems — Design & Build Plan

Status: **Phase 1 in progress.** Phases 2–4 are designed but not yet built.

## Goal

A full weather simulation for Wild Willows that ties into the four systems the
game already runs on: **terrain/watering**, **biome health/growth**,
**animals**, and a longer **season** cycle. Weather should feel cozy and
diegetic — rain that waters your beds, frogs that show up after a storm, the
meadow going gold in autumn — never punishing.

## The one architectural constraint that shapes everything

The server has **no background tick**. Every state change in `server/resources.ts`
is action-driven and stamped with `Date.now()`; the client polls a state
snapshot that already carries `serverTime`. There is no `setInterval`, cron, or
simulation loop, and adding one would fight the whole design (and break solo
offline mode, which runs the same `resources.js` logic locally with no server).

So weather is **not simulated** — it is a **pure deterministic function of
`(worldId, time)`**:

```
weatherAt(worldId, t) -> { season, weather, dayPhase, ... }
```

Consequences, all of them good:

- **Co-op is free.** Everyone in a world derives identical weather from the
  shared `worldId` + `serverTime` — no syncing, no shared mutable weather row.
- **Solo offline works** identically — the same pure function runs in-app.
- **No new moving parts.** The schedule needs no table; it's computed on read.
- **Time travel / testing is trivial** — pass any `t` and assert the result.

Gameplay *effects* of weather (rain watering soil, drought drying it) are applied
**lazily**: when an action triggers `recalcBiome`, we look at how much in-game
time has elapsed since the tile's `updatedAt` and apply the net weather effect
over that interval. This is the same "compute on read" pattern the node-regen
and presence systems already use.

## Time model

Real time is the only clock. We layer three derived cycles on top of `serverTime`:

| Cycle | Default length | Purpose |
|---|---|---|
| **Day phase** | a "game day" = `DAY_MS` (default ~24 real min) split into dawn / day / dusk / night | lighting + ambience |
| **Weather block** | one block per game day (drawn at "dawn") | the active weather type |
| **Season** | `DAYS_PER_SEASON` game days (default ~3) × 4 seasons | palette, weather odds, animal sets |

All lengths live in named constants near the top of `resources.ts` so they're
tunable in one place. `DAY_MS` is deliberately short so a play session sees the
sky change.

### Determinism

A small seeded PRNG (e.g. mulberry32) keyed by a hash of
`worldId + ":" + blockIndex` draws each block's weather from the active season's
+ biome's weighted distribution. Same inputs → same draw, forever. No persisted
RNG state.

## Data model

### `data/weather.json` (new — seeded like the other defs)

Imported into `resources.ts` the same way as `biomes.json` etc. (esbuild inlines
it; reconciled in `reconcileDefinitions`). Holds two things:

1. **Weather type definitions** — id, display name, icon glyph key, a flavor
   line, and effect parameters (e.g. `waterPerDay`, `growthMult`, `tags` like
   `wet`/`cold`/`harsh`). Initial set: `clear`, `cloudy`, `rain`, `storm`,
   `fog`, `snow`, `heat` (drought).
2. **Climate tables** — per **biome** × per **season** weighted odds for each
   weather type. Examples: desert is mostly `clear`/`heat` with rare `rain`;
   wetland leans `rain`/`cloudy`; alpine gets `snow` in winter; meadow is mild.

Per-biome climate lives here (not on the `Biome` typed table) on purpose: the
`Biome` table is positional/structon-encoded with a fixed column set, and adding
a column risks the "end of buffer not reached" decode error documented in
`schema.graphql`. Keeping climate in the dynamic weather config sidesteps that.

### Snapshot additions (Phase 1)

Every state snapshot (`freshSnapshot` and the main sync payload) gains a
`weather` block:

```jsonc
{
  "serverTime": 1750000000000,
  "weather": {
    "season": "summer",
    "dayPhase": "day",
    "dayProgress": 0.42,          // 0..1 through the current game day
    "byBiome": {                   // weather is per-biome (climate differs)
      "meadow": { "type": "rain", "since": 1749999000000 },
      "desert": { "type": "heat", "since": 1749999000000 }
    }
  }
}
```

No new table. No behavior change in Phase 1 — purely additive, so the client can
start rendering before any gameplay effect exists.

## Effect hooks (Phase 3)

All inside the existing `recalcBiome` flow in `resources.ts`:

- **Terrain / watering** — `recalcBiome` already counts `watered` tiles (+1
  health each, capped at 10) and open `water` tiles. Rain passively refreshes /
  creates `watered` beds over elapsed game-time; `heat`/drought decays `watered`
  → `tilled`. Implemented as a lazy delta on each tile's `updatedAt`.
- **Health / growth** — apply a small weather multiplier (`growthMult`) to the
  restoration points feeding `healthFromPoints`. Rain speeds recovery slightly;
  harsh weather is neutral-to-slightly-slow, never negative enough to feel like
  damage.
- **Animals** — extend `meetsRequirements` with optional `weather` / `season`
  conditions on `AnimalDef.requirements` (e.g. frogs after `rain`, snowshoe hare
  in `snow`). Weather also nudges `computeComfort`. The flavor text in
  `narrative.ts` already gestures at several of these (frogs, rain, snow hares).
- **Seasons** — shift each biome's `palette` lerp in `renderBiomeSVG` toward a
  seasonal tint; gate seasonal animal sets; change weather odds (the climate
  table above).

## Retention: weather-driven feed events

Weather is a retention lever, not just set dressing. The game already has an
activity feed (the `FeedEntry` table + client `pushLog` beats in `state.tsx`),
and weather is the perfect engine for **fresh, varied things to come back to**.
Two complementary surfaces, both fed by the `feed` section of `data/weather.json`:

1. **Live change beats (client).** When the snapshot's
   `weather.byBiome[area].type` changes from the last-seen value (the same diff
   pattern `state.tsx` already uses for health milestones and new achievements),
   surface a feed line — e.g. *"Rain begins to fall — your soil beds drink it
   in."* Each weather type has several `onArrive` variants so repeat sessions
   stay fresh, and season changes get their own beat (*"Autumn turns the
   preserve gold and amber."*). No server write, no new table.

2. **Welcome-back summary (server, login).** Because weather is a deterministic
   function of time, on login we can look back over the in-game days that passed
   since the player's last visit and tell them what they *missed* — *"Rain
   passed through overnight — your beds woke up watered."* This is the strongest
   retention hook: it makes time away feel productive and gives a concrete reason
   to return. The `overnight` lines in the config exist for exactly this. (Once
   Phase 3 lands, these summaries can reflect real effects — beds that got
   watered, or dried out in a heat spell.)

The flavor lines live in data so they're easy to tune/expand without code
changes. Weather-themed **achievements** (first rain, weather a storm, see all
seasons) reinforce the same loop in Phase 4.

## Render plan (Phase 2 — client)

- **`src/game/WorldScene.ts`** — a weather overlay layer above terrain: Phaser
  particle emitters for `rain`/`snow`, a translucent tint for `fog`/`cloudy`/
  `storm`, and a day-phase lighting tint (dawn warm, night cool/dim). Read from
  the snapshot's `weather` block via the existing `bridge`/`state.tsx` flow.
  Reuse the procedural-art approach (no asset files).
- **Season palette** — feed the season tint into ground-tile coloring so the
  whole biome shifts with the calendar.
- **HUD** — a small weather + season indicator (`src/ui/HUD.tsx`) using a glyph
  from `icons.tsx`.
- **Journal** — `renderBiomeSVG` snapshots reflect the current season tint.

## Phased milestones

1. **Phase 1 — Foundation (server, derived, zero behavior change).**
   `data/weather.json`; deterministic `seasonAt` / `dayPhaseAt` / `weatherAt`
   pure functions + seeded PRNG; weather block added to every snapshot;
   defs reconciled; unit tests for determinism, cycle boundaries, and climate
   distribution. **← current**
2. **Phase 2 — Visuals + live feed beats (retention).** Phaser overlay
   (rain/snow/fog/lighting), season palette, HUD indicator, journal tint, AND
   the client-side weather-change feed beats (item 1 above) — the first
   retention payoff, shippable without any gameplay effect.
3. **Phase 3 — Gameplay effects.** Lazy rain-watering / drought-drying, growth
   multiplier, weather/season animal gates + comfort, seasonal animal sets.
   Tests.
4. **Phase 4 — Welcome-back summaries + polish.** Login "what you missed"
   weather summaries (item 2 above), weather achievements, tutorial mention,
   balance tuning, co-op consistency check, full `npm run test:all` pass.

## Testing strategy

- **Unit (Vitest):** weather functions are pure → assert determinism, cycle
  boundaries, distribution sanity, snapshot shape. (Phase 1)
- **Integration (Vitest):** the real built `resources.js` against the in-memory
  Harper mock — snapshot carries weather; later, that rain waters beds and gated
  animals return under the right weather. (Phases 1/3)
- **E2E (Playwright):** the overlay renders and the HUD shows weather in solo
  mode. (Phase 2)

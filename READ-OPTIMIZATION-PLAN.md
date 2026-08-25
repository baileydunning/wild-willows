# Read optimization plan

Measured baseline, ordered by impact. Every figure below is from `node scripts/write-profile.mjs`
against the committed `resources.js` — one browser save, one simulated minute at 40 actions/min.

**Baseline: 892 rows read/min, 97 writes/min.** Reads bind capacity at every tier; writes have
roughly 12× more headroom. So this is entirely a read problem.

## Where the reads are

| Table | Rows/min | Share | Scales with |
| --- | --: | --: | --- |
| `BiomeState` | 437 | 49% | Nothing — ~6 rows, read over and over |
| `TerrainTile` | 169 | 19% | **World size** |
| `Player` | 138 | 16% | Nothing — same row, re-read |
| `NodeState` | 91 | 10% | **World size** |
| `Placement` | 35 | 4% | **World size** |
| `Chest` / `FeedEntry` | 15 | 2% | Slowly |

By endpoint:

| Endpoint | Rows/min | Per action | Reads |
| --- | --: | --: | --- |
| `Terraform` | 455 | 35 | `BiomeState` 17 · `TerrainTile` 13 · `Player` 3 · `Placement` 2 |
| `CollectResource` | 243 | 9 | `BiomeState` 6 · `Player` 3 |
| `GameState` GET | 168 | 24 | `NodeState` 13 · `BiomeState` 6 · `Player` 2 |
| `Heartbeat` | 16 | 8 | `BiomeState` 6 · `Player` 1 · `Placement` 1 |

Two separate problems live in that table, and they need different fixes:

1. **Re-reading the same small data repeatedly.** `BiomeState` is six rows per world and accounts
   for half of all reads. `Player` is one row read three times per action. This is a constant-factor
   problem — bad, but it doesn't get worse.
2. **Scanning collections that grow.** `TerrainTile`, `NodeState`, `Placement`. This is why a
   completionist save costs 30× a fresh one, and it's the one that actually threatens the cost curve.

Fix (1) for immediate headroom. Fix (2) because it's the reason capacity falls as people play.

## The constraint that shapes every fix

**Do not replace scans with primary-key `.get()`.** `server/biome.ts:991` documents why: a `.get()`
can return `null` for a record that exists on a cold Harper instance, which made biome health read
as 0 and wrongly rejected a craft the client had correctly shown as unlocked. The bounded
`starts_with` scans are a correctness workaround, not laziness. Any fix has to keep reading through
`byWorld` / `byArea` / `findBiomeState` — or stop needing the data at all.

Secondary indexes are also off the table for the reasons in `ARCHITECTURE.md` §3. That leaves three
honest levers: **read once per request instead of many**, **narrow the key prefix**, and
**maintain a counter instead of recounting**.

---

## 1. Request-scoped scan cache

**Saves ~230 rows/min (26%). Low risk. Do this first.**

`Terraform` reads `BiomeState` 17 times per action — about three separate `byWorld(t.BiomeState, wid)`
calls, each returning the same six rows. `Player` is read three times per `CollectResource`. Nothing
between those reads changed the data.

Memoize per request, keyed by `table + worldId`, invalidated on any write to that table within the
request. `withPlayerLock` already establishes a per-request scope in `server/core.ts` — hang the cache
off that rather than introducing `AsyncLocalStorage`.

Expected: `BiomeState` 437 → ~294, `Player` 138 → ~50.

The invalidation is the whole risk. `recalcBiome` writes `BiomeState` and then callers read it back
(`biome.ts:745`, `biome.ts:887`), and there is already a comment at `biome.ts:636` noting that
in-transaction searches can return the pre-write version of a record. A cache that serves a stale
biome after a write would produce exactly the class of bug that comment exists to prevent. Invalidate
on write, and add a test that recalculates twice in one request and asserts the second sees the first.

## 2. Maintain counts on `BiomeState` instead of recomputing them

**Saves ~195 rows/min (22%), and flattens the growth curve. Highest structural value.**

`recalcBiome` (`server/biome.ts:613`) reads every placement in the world and every terrain tile in the
area on every call, purely to count them:

```
let placements = (await byWorld(t.Placement, wid)).filter((p) => p.area === biomeId);
const counts = placementCounts(placements, d);
let terrain = await byArea(t.TerrainTile, wid, biomeId);
```

Those two lines are the reason a big save costs 30× a small one. The counts they produce —
placement counts by type, watered-bed count — are small, derived, and only change when a placement
or tile changes. Store them on the `BiomeState` row and update them incrementally in the same write
that changes a placement or a tile.

`recalcBiome` already accepts `addPlacements` / `removeIds` / `addTerrain` / `removeTerrainIds`, so
every caller is already telling it exactly what changed. The deltas are in hand; they just aren't
being used to avoid the read.

Keep a rebuild-from-scan path behind a flag for repair and migration, and assert the two agree in an
integration test — a maintained counter that drifts is worse than a slow one.

## 3. Don't recalculate a biome that didn't change

**Saves an estimated 100–150 rows/min. Medium effort.**

`CollectResource` costs 6 `BiomeState` reads per action. Gathering a resource does not change biome
health, balance, or animal-return conditions — it changes inventory. If the recalc is there to catch
achievement triggers, gate it on whether the action could plausibly have moved any of those inputs.

Worth confirming against `endpoints-game.ts:1663` and `:1749` before assuming it's removable; there
may be a reason it runs unconditionally that isn't visible from the call site.

## 4. Give `Placement` an area segment in its key

**Saves ~30 rows/min today. Matters much more later. Needs a key migration.**

`Placement` ids carry no area, so `recalcBiome` reads every placement in the world and filters five
sixths away in JS. `server/worlds.ts` already has `AREA_KEYED` and `byArea` for exactly this shape —
`TerrainTile` uses it. Re-key placements to `${wid}:${area}:${id}`, add `Placement` to `AREA_KEYED`,
and the filter becomes a narrower prefix scan.

This is `KEY_REV 4`. `migrateWorldKeys` already establishes the pattern: migrate once per world from a
write path, merge a legacy scan until the world is marked. Follow it exactly — and note that if
change 2 lands first, this gets much less urgent, because `recalcBiome` stops reading placements at all.

## 5. Send one area's nodes in the snapshot, not all of them

**Saves ~75 rows/min (9%). Requires a client change.**

`GameState` reads 13 `NodeState` rows per call to build a snapshot covering every area, while the
player stands in one. The `AREA_KEYED` comment in `server/worlds.ts` notes `NodeState` ids are already
`${wid}:${biomeId}:${nodeId}` and would work with `byArea` "the day something reads nodes per biome."

Make that day this one: send the current area's nodes, fetch the rest on area change. The cost is a
client round-trip when crossing a boundary and a released-client compatibility window, which is why
this is last despite being straightforward.

---

## Expected result

| | Rows/min | Free tier (heavy) | PRO (heavy) |
| --- | --: | --: | --: |
| Today | 892 | 1 | 1,121 |
| After 1 + 2 | ~470 | 2 | ~2,100 |
| After 1–5 | ~350 | 2 | ~2,800 |

Roughly **2.5× the concurrent capacity**, and — more importantly — changes 2 and 4 mean a
completionist save stops costing 30× a fresh one, so capacity stops falling as people play.

## How to verify each step

`scripts/write-profile.mjs` prints reads and writes bucketed by endpoint and table. Run it before and
after each change; the per-table lines make it obvious when a change moved reads somewhere else rather
than removing them.

Two things the profiler will not catch, so guard them with tests:

- `tests/integration/read-amplification.test.ts` already asserts on row counts through the harness's
  scan stats. Extend it as each change lands — read amplification regresses silently, since nothing
  breaks and no test fails, the game just gets more expensive the more of it a player has built.
- A stale cache or a drifted counter produces wrong game state, not a slow one. Every change above
  needs a correctness test, not just a cost measurement.

**Watch the write count as you go.** Change 2 trades reads for writes — counters are updated on every
placement and tile change. Writes currently have about 12× the headroom reads do, so that is a good
trade, but it stops being one if the counter updates land as separate writes rather than folding into
the `BiomeState` write already happening.

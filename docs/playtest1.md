# Playtest Action Plan (code-traced)

Source: playtest review — https://www.youtube.com/watch?v=DtYca9n_NRc
CORE score: 35/50 (Clarity 10, Operations 6, Rewards 9, Effects 6, Entertainment 4)

Priorities: **P0** = blocks/stalls players · **P1** = quick wins · **P2** = medium effort · **P3** = design work.
Each item lists where it lives in the code and concrete steps.

---

## P0 — Blockers

### 1. "Wildflower" not findable in crafting search (1:16:03) — ended his session
**Root cause found:** `src/recipes.ts:22-24` — `recipeUnlocked()` returns `false` for any output whose habitat object has `plantable: true`, so wildflowers are filtered out of the crafting menu *before* search runs (`CraftingPanel`, `src/ui/Panels.tsx:271-283`). Searching "wildflower" silently matches nothing.
- In `CraftingPanel`, when `query` matches a `plantable` object in `data.habitatObjects` (or its planted resource, e.g. `wildflowers` in `data/resources.json`), render an info row: "🌱 Wildflower Patch is planted, not crafted — dig a bed with the shovel (2), water it (3), then click the bed to plant." Button: "Show me" → could pin the hint.
- Same message in the no-match copy (`panels.crafting.noMatch`, `src/i18n/en/panels.json`).
- The PlantMenu (`src/App.tsx:42-97`) is the actual planting UI — mention it by name in the tutorial `land`/`plant` steps.

### 2. Edge gathering spots trapped under UI (32:01, 50:24, 52:33) — ✅ done (no fence, per Bailey)
**Trace:** camera was clamped to the exact world rect (`setBounds` + `fit` floor in `applyZoom`), so edge tiles could never scroll clear of fixed UI. Player movement was already hard-clamped at the world edge (`handleMovement`).
**Shipped (v2, per Bailey):** outdoors the camera is now UNBOUNDED — it always keeps the caretaker centered, so the player can never end up under the fixed UI at all (indoors stays clamped to the room). The world is ringed with `SURROUND_X/Y` (20×14 tiles) of identical-shade ground + sparse tufts/pebbles (`drawSurround`) sized to cover the widest possible view, so past-the-edge land blends seamlessly; alpine sky/range and coastal ocean extend through it, rain/snow falls across it. Movement stays hard-clamped at the true world edge — no fence, no darker ring. The edge is marked all the way around (`drawEdgeGrass`): tall grass in green biomes (forest mixes in trees), boulders in alpine/desert/coastal. The unwalkable surround is densely overgrown per biome (`surroundDeco`): uncut meadow grass (3 mixed sprites), unbroken forest woods (`wildtree` + understory), marsh reeds, desert scrub/rock, alpine scree + snow patches, coastal dune grass. Gate trails run OUTWARD past the edge toward the next biome, through a cleared corridor in the growth — beside the gate, never under it. Also fixed: clicking animals/placements/interactables through open modals (object-level pointerdown handlers now check `uiBlocking`).

### 3. Lag spikes (0:32, 1:01:30)
**Suspects found in `WorldScene.ts`:**
- `refreshDynamic()` (line 868) destroys and recreates the *entire* dynamic layer (terrain, doodads, nodes, placements) on every `world-dirty` — which fires on every gather/place/terraform, plus repeated boot timers (`App.tsx:160`, `ensurePainted` line 366).
- Dozens of infinite `ambientTween`s (every node, doodad, water tile, foam, glint) rebuilt each refresh.
- Snow prewarm `fastForward(13000, 50)` (line 863) simulates 13s of particles in one frame on biome entry.
Steps: profile with Chrome perf while gathering in the meadow; make `refreshDynamic` diff instead of rebuild (keep keyed sprites, update only changed placements/terrain — nodes already do this pattern via `nodeSprites` map); cap ambient tweens (one shared timeline or tween only on-camera sprites); reduce snow `fastForward` resolution (e.g. `fastForward(lifespan, 500)`).

---

## P1 — Quick wins

### 4. Map key: P vs M (23:13)
**Trace:** `src/App.tsx:247` — `p: 'biomes'` (the map), `m: 'weather'`. HUD hints at `src/ui/HUD.tsx:203-204` show "P" / "M".
- Swap: `m: 'biomes'`, move weather to `w`… (w is movement — use `n` or keep on P) → simplest: `m: 'biomes'`, `p: 'biomes'` (alias), weather stays reachable via HUD button only or `y`. Update `nav-key` hints in HUD, Help modal (`src/ui/Help.tsx`), and tutorial map copy (`panels.tutorial.map` in `src/i18n/en/panels.json`).

### 5. Escape doesn't always close popups (0:25, 54:34)
**Root cause found:** `App.tsx:218-255` Escape handler covers `devOpen`, `helpOpen`, `panel`, `placementObjectId` — but **not** `clickedPlacement` (PlacementMenu), `clickedBed` (PlantMenu), or the tutorial card. Those only close via backdrop click / close button. That's the exact inconsistency he felt.
- Add them to the Escape chain (order: dev → help → plant menu → placement menu → panel → placement mode). They're local state in `GameScreen`, so the handler is right there.
- The Phaser-side ESC (WorldScene line 276) only exits placement — fine, keep.

### 6. Crafting menu forgets where you were (0:44, 1:11:08)
**Trace:** `CraftingPanel` (`Panels.tsx:234+`) holds `placeFilter`/`typeFilter`/`query` in `useState`; the panel unmounts on close (`App.tsx:271`), losing everything, and reopens scrolled to top.
- Persist `query`, both filters, and last-interacted recipe id in module-level vars or `localStorage` (pattern exists: `LOG_PREF_KEY`, `Toolbelt.tsx:124`). On mount, restore and `scrollIntoView({block:'center'})` the last recipe.

### 7. Ambiguous "+3 health" tasks (1:08:52)
**Trace:** `server/resources.ts:1805` + `src/i18n/en/server.json:129` — `"Raise {biome}'s health by {count}"`. `dailyTasksFor` has `biomeStates` in ctx, so current health is available.
- Change copy to `"Raise {biome}'s health from {current}% to {goal}%"` and pass both values. Update `es` catalog too (`npm run i18n:check` enforces parity).

### 8. Copy fixes (10:19, 23:51, 18:07, 1:02:22)
All in `src/i18n/en/panels.json` (+ mirrored `es`):
- Basket tip (lines 287-288) already says "top-right" — grep all catalogs for stale position words (`far left`) and align: "Press B or the basket button in the top-right toolbar."
- Field-guide text: rewrite `panels.tutorial.journal` (line 317-318) and journal upsell/locked-card copy (lines 156, 246) into short sentences — pull his rewrite from 18:07-20:20.
- "Build" vs "plant/place": audit `place`/`build`/`plant` strings; reserve *craft* (make it), *place* (put it down), *plant* (grow it). The green ready-to-place state is the `startPlacement` flow + `hud-bottom` prompt (`HUD.tsx:227-238`) — make that bar more prominent (color pulse on first-ever placement).

### 9. Controls list in Settings (6:43)
**Trace:** shortcuts are hardcoded in `App.tsx:247-251`, tool keys in `Toolbelt.tsx:7-11`, zoom/rotate keys in `WorldScene.ts:281-295`. No single source.
- Export a `SHORTCUTS` table from a new `src/shortcuts.ts`; render it in `SettingsPanel` (`src/ui/Settings.tsx`) as a "Controls" section; have `App.tsx` and Help consume the same table.

### 10. Proximity mechanic never taught (1:06:07)
**Trace:** the rule lives server-side in `meetsRequirements`/`analyzeWater` + habitat counting (`server/resources.ts:1104-1176`); the tutorial (`src/ui/Tutorial.tsx` `BASE_STEPS`) never mentions placing pieces near each other.
- Add one step after `placeGrass` (icon `pin`, key `panels.tutorial.proximity`): "Animals come back to *neighborhoods* — place food, water and shelter near each other." Add the same line to `panels.biomes` guide copy.

### 11. Tutorial: less intimidating up front
**Trace:** `Tutorial.tsx` — 18 `BASE_STEPS`, all dots visible (`tutorial-dots`, line 376), 7s hold on step 1 (`FIRST_STEP_HOLD`). HUD already does progressive disclosure (`HUD.tsx:59-83`) — the card itself doesn't.
- Group steps into 4 named chapters (Move & Gather / Work the Land / Read the Land / First Friend); show "Chapter 1 of 4" + dots for the current chapter only, so the first screen never says "step 1 of 18".
- Shorten the welcome card copy (`panels.tutorial.welcome`); details can live in Help (H).

### 12. Tutorial: teach the core loop explicitly
- New step 2 card (or fold into welcome): "Your job: restore each biome so its animals return — every animal back opens the way to the next biome." The unlock rule is real (`recipeUnlocked`/biome gates, `server/resources.ts:1719-1810`), the tutorial just never states it.
- Reinforce: when a biome unlocks, the toast/feed already fires — add the loop reminder there (`src/ui/narrative.ts`).

### 13. Log/journal + **materials menu with pictures** (49:48 + your request)
**Trace:** every resource already has a hand-drawn sprite — `makeNodeTextures` in `src/game/textures.ts:178+` (`rnode-<id>`), and the pickup animation reuses them. The React UI only shows color swatches (`swatch` in `InventoryPanel`/`ChestPanel`, `Panels.tsx:101,185`).
- **Bridge the textures to the DOM:** after `makeNodeTextures` runs, snapshot each `rnode-*` texture to a data URL (draw its source canvas/image to an offscreen canvas → `toDataURL`) and stash in `bridge.shared.resourceIcons: Record<string,string>`. One-time cost, cached.
- Add `<ResourceIcon id/>` component; use it in InventoryPanel, ChestPanel, PlantMenu costs, crafting material chips, TasksWidget rewards, ActivityLog entries.
- **New "Materials" guide** (the menu you asked for): a panel listing every resource gatherable in the current biome — picture, name, and how to get it (`data/resources.json` has biome + weather gating; `gatherResourceFor` in `src/weather.ts` resolves weather-only ones — show "appears during rain"). Entry points: a tab inside the Journal (J) and a "?" link from inventory. Kills the "blindly pressing E hoping it's plant fiber" problem.

### 14. Interaction hitboxes (0:19, 28:07, 40:30)
**Trace:** `WorldScene.ts` — node containers `setSize(36,36)` (line 1423), generic interact zones `44×46` (line 942), action radius `dist <= 96` px (line 960), E-key nearest-interactable radius (see `nearestInteractable`).
- Bump zones to ~`52×52`, keep visuals unchanged; raise click-action radius to ~120 so "walk closer" toasts stop firing on near-misses; make the tile cursor (`tileCursor`) show on hover over interactables for feedback.

---

## P2 — UI/UX systems

### 15. Draggable / repositionable windows (13:30, 15:46, 1:11:58)
**Trace:** all panels render via the shared `Panel` wrapper + `.panel-backdrop` centering (`Panels.tsx`); the tutorial card is a fixed-position `.tutorial-card` (`Tutorial.tsx:353`); PlacementMenu/PlantMenu are separate fixed elements (`App.tsx`).
- Write a `useDraggable(ref)` hook (pointer events on `.panel-head`/`.tutorial-head`, translate via CSS transform, clamp to viewport). Apply to `Panel`, `Tutorial`, `PlantMenu`, `PlacementMenu`.
- Persist per-window position in `localStorage`; "reset layout" button in Settings.
- Cheap interim fix shipping first: dock the tutorial card bottom-center and panels slightly off-center so the play area midline stays visible (fixes "chest hidden behind tip box", 13:18).

### 16. Weather/preserve tooltip covers the middle (25:20)
`WeatherPanel`/`BiomesPanel` use the same centered `Panel`. Once #15 lands they're draggable; also add a `side` variant (`.panel--side` docked right) used by Weather by default.

### 17. Pinnable objectives (1:11:43)
**Trace:** `TasksWidget` (`src/ui/TasksWidget.tsx`) is already a compact on-screen board under the HUD — perfect home for pins.
- Add a pin icon per recipe row in `CraftingPanel`; store `pinnedRecipes: string[]` in game state (`src/state.tsx`) or localStorage.
- Render pinned recipes in TasksWidget with live material progress (`have/need` — reuse the `avail()` inventory+chest sum from `PlantMenu`, `App.tsx:46-47`). Click → opens crafting at that recipe (ties into #6's remembered position).

### 18. Post-tutorial direction — "now what?" (35:26, 57:37)
**Trace:** the server *already* computes next-unlock guidance — `dailyTasksFor` (`server/resources.ts:1719+`) generates "raise health / welcome an animal / craft the kit" goal tasks toward the next biome, surfaced in TasksWidget. The gap: tutorial end (`DONE_STEP`) never hands off to it.
- Replace the last tutorial card with a handoff: "From here, the task board (top-left) always shows your next step toward opening the next biome."
- Make the goal task visually distinct (star icon, always on top, not claimable-daily) so there's a persistent north star.

### 19. Audio pass — the most repeated note (7:13, 9:24, 1:25:00)
**Trace:** zero audio code anywhere in `src/` or `electron/` (verified). Phaser's sound manager is available and unused.
- Create `src/game/audio.ts`: preload a small set (title loop, ambient nature loop per-biome-family, gather pluck, craft thunk, place thud, UI tick, animal-arrival chime, rain/snow beds tied to `applyWeather`).
- Wire to existing bridge events — they already exist: `collected`, `terraformed`, `home-upgraded`, `toast`, `area-changed` (`WorldScene.ts:374-393`), panel changes in `state.tsx`.
- Volume + mute sliders in Settings via `prefs.ts` (the `reduceMotion` pref pattern, `getPrefs`/`subscribe`, is the template — `WorldScene` already live-subscribes).
- Title screen: `src/ui/Welcome.tsx` gets the music + some ambient motion (drifting leaves CSS) — covers the "dead title screen" note (7:13).
- Assets: kenney.nl / freesound CC0 packs are fine as placeholders.

---

## P3 — Design & content

### 20. Harvestable plants (53:23, 1:01:07, 1:20:59) — biggest Entertainment lever
**Trace:** planting = placement with `plantedAt` (`server/resources.ts:3120-3160`); growth is timestamp-derived (`growSeconds`, `maturedBetween`, lines 1134-1180); today the only "harvest" is dig-up-and-lose-it (`removePlacement`). All data-driven from `data/habitat-objects.json`.
- Data: add `yield: { resourceId, qty, regrowSeconds }` to berry bushes, flowers, trees.
- Server: new `harvestPlacement` action — requires mature (`now - plantedAt >= growSeconds*1000`), grants yield to inventory, stamps `lastHarvestAt` (new field on placement), regrow gate like node regen (`NODE_REGEN` pattern at line 2821).
- Client: `PlacementMenu` (`App.tsx:100`) grows a "Harvest" button when ready; WorldScene shows a subtle berry/sparkle overlay on harvest-ready plants (like `updateNodeVisuals`' sprout swap, line 1442).
- This makes planting a renewable economy instead of re-dig/re-water/re-plant.

### 21. Day-night & time (39:09, 57:44)
**Partial system already exists:** `weather.ts` has `liveDayPhase`/`dayPhaseStyle` and the HUD shows dawn/day/dusk/night (`HUD.tsx:129-139`) — but the world doesn't render it (`WorldScene.ts:756`: "No day/night lighting").
- Cheap visible win: phase-tinted overlay in `applyWeather` (reuse `weatherOverlay` layering; night = deep blue at low alpha, dawn/dusk warm). Include phase in `weatherSig` so it transitions.
- Then: phase-gated content — fireflies/owls at night (nodes/animals with a `dayPhase` requirement, same shape as weather-gated nodes, line 1353). Skip hunger/cold — wrong genre for the cozy audience; he conceded this himself.

### 22. Animals feel alive (1:21:14, 1:21:46, 1:28:43)
**Trace:** animals wander in their own layer (`drawAnimals`, redrawn only on cast change — `refreshDynamic` line 896); clicking = `observe` only (`animal-clicked`, `App.tsx:179`).
- Tier 1 (client-only): richer behaviors in the wander loop — pause-and-nibble near plants, drink at `waterTileCenters`, flee radius from the player, pair up.
- Tier 2 (server): daily "hungry animal" moments — a discovery gets `wantsFeed: resourceId` (data: each animal's `diet` already exists in the journal); feeding grants comfort/facts. Reuses daily-task counters plumbing (`dailyTasksFor`).
- Tier 3 (design doc first): simple ecology (predator presence nudges balance). Prototype behind `devUnlockAll`-style flag in `src/features.ts`.

### 23. Water mechanics confusion (1:13:58-1:15:39)
**Trace:** flood = terraform `water` on a watered bed (`WorldScene.terraformPayload`, line 501); pond/river/lake classification is `analyzeWater` (`server/resources.ts:1224+`) with shape thresholds; collected water nodes vanish on regen timer like all nodes; water tiles block walking (`waterTiles` collision, line 874-888).
- Feedback: when a flood doesn't change classification, toast *why* ("too narrow to be a river — extend it 2 more tiles"). `analyzeWater` already computes the numbers; return the near-miss reason.
- Renewable water: rain refills water nodes early (weather is already live per-biome — cut node regen time during `rain`/`storm` in `nodeAvailable`), and/or a craftable well.
- Walkable shallows: allow walking on water tiles adjacent to land (wading) or make the existing `bridge` objects cheaper/earlier. Show a splash + slow-walk instead of a hard block.

### 24. Animation pass (1:25:42) + cute factor (1:20:07)
**Trace:** every creature is a single static generated texture (`makeAnimalTextures`, `textures.ts`); "wobble" is a tween. No sprite sheets.
- Generate 2-3 frames per animal in `textures.ts` (wing up/down for bees & butterflies, S-curve phases for the snake, leg swap for walkers) and register `this.anims` — the drawing code is already parameterized enough to vary per frame.
- Player: bob + directional flip already exist (`walkT`); add a 2-frame leg swap.
- Journal art: the journal reuses `animalTexture` renders — a "cute pass" on the texture functions (bigger heads/eyes) automatically upgrades journal + world. Do the journal-facing ones first (1:20:07).

### 25. Graphics direction (1:25:23)
Decide placeholder vs final. Everything is procedural canvas (`textures.ts`, 2789 lines) — swapping to drawn sprite sheets later is contained: keep texture keys stable (`rnode-*`, animal ids) and only `textures.ts` changes. Note it in the store/demo blurb ("art in progress") either way.

---

## Don't break these (what he praised)
Failure-reason messaging, destructive-action confirms (`window.confirm` flows in `App.tsx`), hover/highlight feedback, numbered tutorial nav + replay (Tutorial frontier/replay logic), current-vs-upgraded tool stats, reward tooltips (TasksWidget titles), the activity log, save/continue, real animal facts. Most live in the files this plan touches — regression-check them (there are Playwright e2e projects: `npm run test:e2e:solo`).

## Progress
✅ **Done & verified** (tsc, i18n check, 91 unit tests):
- #1 Wildflower search cross-reference ("planted, not crafted" rows)
- #2 Edge spots / walking under UI — unbounded outdoor camera (player always centered), per-biome overgrown surround (grass sets in 4 real palettes, forest `wildtree` mix, marsh reeds, desert straw+sandstone, alpine sage+scree+snow, coastal dune grass; no edge line along the ocean), outward gate trails through cleared corridors
- #4 Map on M (P alias; weather → N) · #5 Escape closes all popups · #6 crafting menu memory · #7 "from X% to Y%" task copy (en+es)
- Bonus: Tab toggles the task board · click-through-modal bug fixed (uiBlocking on object-level handlers)

## Remaining scope (from the playtest review)

### Sprint 1 — finish the quick wins (all Small unless noted)
| Item | Effort | Where |
|---|---|---|
| #3 Lag fixes: diff `refreshDynamic` instead of full rebuild, cap ambient tweens, soften snow `fastForward` | **M** | `WorldScene.ts:868,863` |
| #8 Copy pass: field-guide rewrite (his 18:07 version), basket-tip position audit, craft/place/plant wording, ready-to-place prominence | S | `i18n/en+es/panels.json`, `HUD.tsx` |
| #9 Controls list in Settings (single `SHORTCUTS` table consumed by App/Help/Settings) | S | new `src/shortcuts.ts`, `Settings.tsx` |
| #10 Proximity mechanic tutorial step | S | `Tutorial.tsx`, `panels.json` |
| #11+#12 Tutorial chapters (4 named phases, per-chapter dots) + explicit core-loop card (animals back → biomes unlock) | **M** | `Tutorial.tsx`, `panels.json` |
| #13 Resource icons in UI + Materials guide panel (pictures of what you can collect, where/when) | **M** | `textures.ts` → data-URLs via bridge, new panel |
| #14 Hitboxes: zones 44→52px, action radius 96→120, hover cursor feedback | S | `WorldScene.ts:942,960,1049` |

### Sprint 2 — UI systems
| Item | Effort | Where |
|---|---|---|
| #15 Draggable windows (`useDraggable` hook on panel/tutorial/plant/placement menus, persisted positions, layout reset) | **M** | `Panels.tsx`, `Tutorial.tsx`, `App.tsx`, CSS |
| #16 Weather panel docks to the side | S | with #15 |
| #17 Pinnable objectives (pin recipes → tracked on TasksWidget with live have/need) | **M** | `Panels.tsx`, `TasksWidget.tsx`, `state.tsx` |
| #18 Post-tutorial handoff card → goal tasks as persistent "north star" | S | `Tutorial.tsx`, `TasksWidget.tsx` |

### Sprint 3 — audio (his most-repeated note)
| Item | Effort | Where |
|---|---|---|
| #19 `src/game/audio.ts`: title + per-biome ambient loops, gather/craft/place/UI SFX, weather beds, arrival chime; volume prefs in Settings; title-screen music + motion | **L** | new file, `prefs.ts`, `Settings.tsx`, `Welcome.tsx`; CC0 assets |

### Next milestone — design bets (order by Entertainment-score impact)
| Item | Effort | Notes |
|---|---|---|
| #20 Harvestable plants | **L** | `yield` in habitat-objects.json, `harvestPlacement` server action, Harvest button + ready-glint. Biggest loop fix. |
| #21 Day-night rendering | S–M | phase system already exists (`liveDayPhase`); add world tint overlay, then phase-gated nodes/animals |
| #23 Water: near-miss feedback from `analyzeWater`, rain-refilled water nodes, wading/bridges decision | **M** | `resources.ts`, `WorldScene.ts` |
| #22 Animals alive: tier 1 client behaviors (drink/nibble/flee/pairs), tier 2 feed-the-hungry moments | **M–L** | `WorldScene.ts`, then server |
| #24 Animation pass: 2-3 frame loops (butterfly flap, snake slither, walk cycles) + journal cute pass | **M–L** | `textures.ts` |
| #25 Art direction decision: placeholder vs final; keep texture keys stable either way | — | store-page messaging |

# Steam achievements — id → API name

Generated from `data/achievements.json`. **Source of truth for the Steamworks dashboard.**

Every in-game achievement is mirrored to Steam 1:1 by `electron/metrics-sync.js`. The Steam
**API name** is derived from the achievement id: uppercased, with every run of non-alphanumeric
characters (the hyphens) collapsed to a single underscore.

    welcome-grasshopper     ->  WELCOME_GRASSHOPPER
    caretaker-of-the-whole  ->  CARETAKER_OF_THE_WHOLE

Each of the 50 **API name** values below must exist in the Steamworks dashboard
(App Admin → Achievements) spelled **exactly** as shown, or that achievement will never unlock
for players. Display name / description / icon are set in Steamworks and are independent of the
in-game copy (the game shows its own from `data/achievements.json` + translations).

All 50 achievements are currently **visible** (none hidden). Total Steam points if you
mirror the in-game weighting: **1395** — but Steam does not use per-achievement points, so this
is informational only.

> Superseded: the pre-1.0 placeholder names `ACH_FIRST_ANIMAL`, `ACH_FIRST_CRAFT`,
> `ACH_SECOND_BIOME`, `ACH_NATURALIST`, `ACH_GREEN_THUMB`, `ACH_DEDICATED` are no longer used.
> Delete them from the dashboard so they do not sit permanently locked on the store page.

## Stats (INT)

`play_minutes`, `sessions`, `resources_collected`, `items_crafted`, `objects_placed`,
`plants_planted`, `animals_observed`, `animals_returned`, `biomes_unlocked`.

## Achievements (50)

| # | Game id | Steam API name | In-game name | Biome | Points | Hidden |
|---|---------|----------------|--------------|-------|--------|--------|
| 1 | `welcome-grasshopper` | `WELCOME_GRASSHOPPER` | First Friend | preserve | 10 | no |
| 2 | `forager` | `FORAGER` | Forager | preserve | 10 | no |
| 3 | `makers-hands` | `MAKERS_HANDS` | Maker's Hands | preserve | 10 | no |
| 4 | `green-thumb` | `GREEN_THUMB` | Green Thumb | preserve | 10 | no |
| 5 | `waterworks` | `WATERWORKS` | Waterworks | preserve | 10 | no |
| 6 | `meadow-first-bloom` | `MEADOW_FIRST_BLOOM` | First Bloom | meadow | 15 | no |
| 7 | `meadow-pollinators` | `MEADOW_POLLINATORS` | Pollinator Highway | meadow | 20 | no |
| 8 | `meadow-apex` | `MEADOW_APEX` | Apex of the Grass | meadow | 25 | no |
| 9 | `meadow-mender` | `MEADOW_MENDER` | Meadow Mender | meadow | 25 | no |
| 10 | `meadow-reborn` | `MEADOW_REBORN` | Willow Meadow Reborn | meadow | 50 | no |
| 11 | `forest-understory` | `FOREST_UNDERSTORY` | Understory Returns | forest | 15 | no |
| 12 | `forest-cavities` | `FOREST_CAVITIES` | Hollow Dwellers | forest | 25 | no |
| 13 | `forest-night-shift` | `FOREST_NIGHT_SHIFT` | Night Shift | forest | 25 | no |
| 14 | `forest-canopy` | `FOREST_CANOPY` | Canopy Restored | forest | 25 | no |
| 15 | `forest-reborn` | `FOREST_REBORN` | Old Hollow Forest Reborn | forest | 50 | no |
| 16 | `wetland-first-water` | `WETLAND_FIRST_WATER` | Water Returns | wetland | 15 | no |
| 17 | `wetland-engineer` | `WETLAND_ENGINEER` | The Engineer | wetland | 25 | no |
| 18 | `wetland-lakemaker` | `WETLAND_LAKEMAKER` | Lakemaker | wetland | 20 | no |
| 19 | `wetland-restored` | `WETLAND_RESTORED` | Marsh Restored | wetland | 25 | no |
| 20 | `wetland-reborn` | `WETLAND_REBORN` | Rushwater Wetland Reborn | wetland | 50 | no |
| 21 | `desert-first-life` | `DESERT_FIRST_LIFE` | Life in the Heat | desert | 15 | no |
| 22 | `desert-burrows` | `DESERT_BURROWS` | Burrow Network | desert | 25 | no |
| 23 | `desert-hunter` | `DESERT_HUNTER` | Dryland Hunter | desert | 25 | no |
| 24 | `desert-restored` | `DESERT_RESTORED` | Scrubland Restored | desert | 25 | no |
| 25 | `desert-reborn` | `DESERT_REBORN` | Redstone Scrubland Reborn | desert | 50 | no |
| 26 | `alpine-treeline` | `ALPINE_TREELINE` | Above the Treeline | alpine | 15 | no |
| 27 | `alpine-haypile` | `ALPINE_HAYPILE` | The Haymaker | alpine | 20 | no |
| 28 | `alpine-crown` | `ALPINE_CROWN` | Crown of the Range | alpine | 25 | no |
| 29 | `alpine-restored` | `ALPINE_RESTORED` | Heights Restored | alpine | 25 | no |
| 30 | `alpine-reborn` | `ALPINE_REBORN` | Graywind Heights Reborn | alpine | 50 | no |
| 31 | `coastal-tide` | `COASTAL_TIDE` | The Tide Returns | coastal | 15 | no |
| 32 | `coastal-keystone` | `COASTAL_KEYSTONE` | Keystone | coastal | 25 | no |
| 33 | `coastal-otter` | `COASTAL_OTTER` | Otter's Garden | coastal | 25 | no |
| 34 | `coastal-restored` | `COASTAL_RESTORED` | Shore Restored | coastal | 25 | no |
| 35 | `coastal-reborn` | `COASTAL_REBORN` | Pelican Shore Reborn | coastal | 50 | no |
| 36 | `well-stocked` | `WELL_STOCKED` | Well Stocked | preserve | 25 | no |
| 37 | `master-builder` | `MASTER_BUILDER` | Master Builder | preserve | 25 | no |
| 38 | `master-gardener` | `MASTER_GARDENER` | Master Gardener | preserve | 25 | no |
| 39 | `landscaper` | `LANDSCAPER` | Landscaper | preserve | 25 | no |
| 40 | `fully-equipped` | `FULLY_EQUIPPED` | Fully Equipped | preserve | 30 | no |
| 41 | `naturalist` | `NATURALIST` | Naturalist | preserve | 30 | no |
| 42 | `recipe-collector` | `RECIPE_COLLECTOR` | Recipe Collector | preserve | 30 | no |
| 43 | `open-road` | `OPEN_ROAD` | Open Road | preserve | 20 | no |
| 44 | `welcoming-committee` | `WELCOMING_COMMITTEE` | Welcoming Committee | preserve | 30 | no |
| 45 | `full-house` | `FULL_HOUSE` | Full House | preserve | 50 | no |
| 46 | `field-notes` | `FIELD_NOTES` | Field Notes | preserve | 25 | no |
| 47 | `steady-hand` | `STEADY_HAND` | Steady Hand | preserve | 30 | no |
| 48 | `three-restored` | `THREE_RESTORED` | Halfway Wild | preserve | 35 | no |
| 49 | `trailblazer` | `TRAILBLAZER` | Trailblazer | preserve | 40 | no |
| 50 | `caretaker-of-the-whole` | `CARETAKER_OF_THE_WHOLE` | Caretaker of the Whole | preserve | 100 | no |

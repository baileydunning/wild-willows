# Wild Willows — data rebuild: what changed and what the code needs

Rebuilt data is in `.research/rebuild/data/`. It does **not** overwrite `data/` — diff it first.

```
.research/rebuild/
  data/
    animals-1.json        40 records  (was 45)
    animals-2.json       110 records  (was 105)
    habitat-objects.json 325 records  (was 179)
    recipes.json         296 records  (was 150)
    biomes.json            6 records  (coastal description + resources edited)
  REBUILD-SUMMARY.txt     per-biome roster, tiers, signature objects, unlock chains
  INTEGRATION.md          this file
  validate.py             the validator — re-run it after any hand edit
```

`validate.py` currently reports **0 errors** against 11 rules. Run it before you commit anything.

---

## Headline numbers

| | before | after |
|---|---|---|
| species | 150 | 150 (30 replaced) |
| habitat objects | 179 | 325 |
| recipes | 150 | 296 |
| recipes gated on a species returning | **1** | **58** |
| food-web edges | 310 | 347 |
| species with no predator | 53 | 25 |
| species with no food source at all | 89 | **0** |
| objects required by nobody | 50 | 0 among the new set |
| `shrub` gates | 34 species | **0** |
| `rock-pile` gates | 33 species | 4 |
| `tidepool` gates | 20 species | 4 |
| `dune-grass` gates | 17 species | **0** |
| `desert-brush` gates | 19 species | **0** |
| `alpine-wildflower-patch` gates | 17 species | 5 |
| species with a water requirement | 12 | 47 |

Every one of the 150 species now has exactly one **signature object** that no other species in the game requires. 120 of those signatures are new objects; the rest are objects you had already built and never wired up (`pika-haypile`, `whitebark-cache`, `heron-rookery`, `cliff-nest-niche`, `scree-slope`, `snowbank-roost`, `lichen-boulder`, `bulrush`, `alder-snag`, `insect-hotel`, `sunflower-patch`, `prickly-pear`, `palo-verde-tree` and others).

---

## Trophic pyramid

Target was producers 2 · decomposers 3 · herbivores 7 · mid 7 · mesopredators 4 · apex 2 per biome, ±1.

```
           produ  decom  herbi   mid   meso  apex
meadow      2[2]   2[3]   8[7]  7[7]  4[4]  2[2]
forest      2[2]   3[3]   7[7]  7[7]  4[4]  2[2]
wetland     2[2]   2[3]   6[7]  8[7]  5[4]  2[2]
desert      2[2]   2[3]   7[7]  8[7]  5[4]  1[2]
alpine      2[2]   2[3]   8[7]  8[7]  3[4]  2[2]
coastal     2[2]   3[3]   7[7]  6[7]  5[4]  2[2]
```

All within tolerance. Game-wide the enum now reads: producer 12 · decomposer 5 · detritivore 9 · filter-feeder 5 · herbivore 38 · insectivore 23 · omnivore 19 · scavenger 2 · mesopredator 26 · apex-predator 11.

The 30 replacements went almost entirely into the tiers that were empty: 12 producers (milkweed, blue grama, white oak, eastern hemlock, cattail, wild celery, creosote, saguaro, moss campion, map lichen, giant kelp, surfgrass), 9 decomposers/detritivores (turkey tail, deer truffle, meadow mushroom, snowbank fungus, burying beetle, darkling beetle, desert termite, amphipod, beach hopper), plus the missing forage base (northern anchovy, purple sea urchin, crayfish, freshwater mussel, polyphemus moth) and four predators that close dangling `eatenBy` chains (great horned owl, cougar, common raven).

---

## Code changes required

### 1. `src/types.ts` — new enum value

`trophic` already includes `producer`. Add:

```ts
| 'detritivore'
```

Used by 9 species. Everything else in the enum is unchanged.

### 2. `server/resources.ts` — `meetsRequirements`, around line 2075

Two new requirement forms.

**`water.ocean`** — 22 coastal species now require open ocean. This is what stops a gray whale being satisfiable by two tidepools. The whale asks for `{"ocean": 14, "deep": true}`.

```ts
const w = req.water;
if (w) {
    if ((water.tiles || 0) < (w.tiles || 0)) return false;
    if ((water.lake  || 0) < (w.lake  || 0)) return false;
    if ((water.river || 0) < (w.river || 0)) return false;
    if ((water.ocean || 0) < (w.ocean || 0)) return false;          // new
    if (w.deep && !water.deepOcean) return false;                    // new
}
```

You'll need the terraform/water counter to produce `ocean` and `deepOcean`. Simplest read: ocean tiles are water tiles contiguous with the map's seaward edge; `deepOcean` is true once that body exceeds some depth or distance threshold. If you'd rather not add depth, drop the `deep` flag and raise the `ocean` counts — the counts alone already prevent the tidepool loophole.

**`excludes`** — one species uses it (`wetland-salamander`, which breeds only in fishless pools; that's the whole point of the record):

```ts
for (const other of req.excludes || []) {
    if (returnedIds.has(other)) return false;                        // new
}
```

`whyReturnedText` needs matching branches for `ocean` and `excludes` so the journal explains them.

### 3. `eats` may now contain stage-annotated edges

50 edges are `{"id": "...", "stage": "eggs" | "young" | "adult"}` instead of a bare string. These are the ones the audit flagged as true only for a life stage — raccoons taking wood duck *eggs*, black bears taking deer *fawns*, golden eagles taking bighorn *lambs*. Without the annotation the food-web view teaches that a bear hunts adult deer.

```ts
type FoodEdge = string | { id: string; stage: 'eggs' | 'young' | 'adult' };
eats?: FoodEdge[];
eatenBy?: FoodEdge[];
```

Anywhere you currently read `eats` as `string[]`, normalise with `typeof e === 'string' ? e : e.id`, and render the stage as a qualifier in the journal ("eggs and nestlings").

### 4. `kind` — five new values

`kind` is typed `string`, so nothing breaks, but the UI needs icons, filters and `kindReturned` strings for: `plant` (10), `fungus` (4), `lichen` (1), `algae` (1). Worksheet 3 asks students to count "kinds of living thing," so these should be first-class in the journal's kind filter, not lumped under "other."

### 5. `requirements.signature` — new optional field

Metadata; nothing needs to read it. Worth surfacing though — highlighting the signature object in the journal's needs list ("this one is only for the barn owl") is exactly the distinction Worksheet 4 asks students to make.

### 6. Coastal objects carry `zone` and `waveExposure`

38 objects now have `zone` (`splash` / `high` / `mid` / `low` / `subtidal` / `backdune`) and `waveExposure` (`sheltered` / `moderate` / `exposed`). Nothing enforces them yet — they're there so placement can eventually respect tidal zonation, which is the organising principle of a rocky shore and the thing the anemone, sea star and oystercatcher cards all describe. Ignoring the fields is safe.

### 7. Four objects flagged `decorative: true`

`frostflower-planter`, `dew-lantern`, `stormglass-lantern`, `crystal-cairn`. The ptarmigan was previously *required* to have a frostflower planter — a fictional plant gating the only bird that lives above treeline year-round. No species requires a decorative object now. Suggest rendering them in a separate crafting category so students don't infer frostflowers are real.

### 8. i18n

`npm run i18n:extract` regenerates the English template. What it can't do:

- **`src/i18n/es/content.json`** — 30 new species and 146 new objects need Spanish.
- **`src/i18n/en/simple.json`** — same set needs simpler-wording variants. The educator guide tells teachers to switch this on for grades 5–8, so it isn't optional.

The new `hint` fields are written to be the teaching moment (e.g. the red-backed salamander's says outright *"Do not build a pond for this one — red-backed salamanders have no tadpole stage at all"*). Keep that voice when translating.

### 9. Existing recipe unlock thresholds were lowered

24 pre-existing recipes unlocked at a higher biome health than the new species that need them, which would have made those species unreachable. They were lowered automatically — `mud-bank` 72→8 and `fallen-branch-shelter` 44→10 are the biggest moves. Full list is in `validate.py`'s output. If any of those thresholds existed for pacing reasons rather than by accident, re-raise them and move the species instead.

---

## Content changes worth knowing about

**Biome edits.** Coastal's description said the ocean breaks along the *eastern* edge while 100% of its roster is Northeast Pacific — changed to western. `coral` was removed from the coastal resource and dig lists; there are no shallow reef-building corals in the temperate NE Pacific, and the `coral-garden` object is replaced by living kelp. You'll want to check nothing else references the `coral` resource id.

**Non-native plants.** The meadow was awarding health points for planting oxeye daisy (a listed noxious weed in three states), foxglove, field poppy and birdsfoot trefoil while telling students they were restoring native meadow. Swapped to blanketflower, penstemon, California poppy and native clover. Alpine's clover patch got the same treatment.

**The keystone chains are now playable.** These were all asserted in `role` text and impossible to build:

- **Desert:** saguaro → Gila woodpecker → `saguaro-boot` → elf owl. The woodpecker excavates the cavity; the cactus seals it into a boot; the owl nests in it. Also desert tortoise → `tortoise-burrow` → burrowing owl.
- **Coastal:** giant kelp → `urchin-crevice-pit` → purple sea urchin → sea otter. The otter/urchin/kelp trophic cascade, which the otter's own `role` describes verbatim, now runs end to end.
- **Forest:** turkey tail → `soft-rot-snag` → downy woodpecker → `downy-cavity` → nuthatch; and the pileated woodpecker's cavities feeding flying squirrel, fisher and wood duck. The keystone-cavity story was entirely prose before.
- **Wetland:** the beaver moved from minHealth 70 to 38 and now unlocks seven downstream habitats. It was arriving *after* fifteen species its own role says depend on it.
- **Alpine:** map lichen → `fellfield-gravel` → moss campion → `alpine-turf-mat` → ten species. Soil formation as the actual first step, which is the honest version of restoring a trampled alpine slope.

**Facts.** The false ones from the audit are corrected in place — the monarch's "very few predators," the fox pouncing northeast, the raccoon's touch receptors, the desert bee's "shared colonies," the barn swallow's borrowed Cliff Swallow nest fact, the bobcat's borrowed lynx–hare cycle. Items the audit marked `[unverified]` were softened rather than asserted.

---

## Known gaps

Each biome had a 5-species replacement budget and each spent it on the structural holes first. Left undone:

- **Meadow:** no coyote, so mule deer and badger are still terminal nodes. First thing to add if you widen the budget.
- **Forest:** no deer mouse, blue jay, diurnal raptor or migratory warbler. No pollinator — the polyphemus moth was added for its caterpillar, and adults have no mouthparts.
- **Wetland:** no watersnake, raccoon or midge. Nothing preys on turtle or bird nests, which is the biggest missing story in a marsh restoration.
- **Desert:** only 1 apex predator. Harris's hawk is the recommended second, and it would also close `elf-owl` and `common-raven`'s empty `eatenBy`.
- **Alpine:** no cavity excavator, so `old-woodpecker-cavity` unlocks on health rather than on the bird that makes it. American three-toed woodpecker would convert it.
- **Coastal:** the hermit crab's shell supply unlocks on health rather than on the black turban snail that produces the shells. Barnacles and mole crabs are modelled as objects rather than organisms. One peregrine or bald eagle would close nine of the ten remaining empty `eatenBy` fields.
- **Game-wide:** 25 species still have no predator (down from 53). Most are legitimate near-apex; roughly ten are not, and the additions above fix them.
- `kind` still mixes taxonomic axes (`insect` vs `invertebrate`) — a schema call, deliberately not made here.
- Two ids now hold different species than their name suggests: `eastern-bluebird` holds Western Bluebird and `meadow-vole` holds Montane Vole. Kept to avoid breaking cross-file edges; both want a rename migration.

---

## Suggested integration order

1. Diff `.research/rebuild/data/` against `data/`. Spot-check five species you know well.
2. Apply the `types.ts` and `server/resources.ts` changes (items 1–3). Without the `water.ocean` handler the coastal species are unreachable.
3. Copy the data files in, run `python3 validate.py`, then `npm run check && npm run test`.
4. `npm run i18n:extract`, then fill Spanish and simple-wording for the 176 new entries.
5. Playtest the meadow start-to-finish — the unlock ordering changed the most there and in the wetland.
6. Update the educator guide's species table: add the prey (`animals`) column it currently omits, and the signature-object column, which is now the thing Worksheet 4 is actually about.

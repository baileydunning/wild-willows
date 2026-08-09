# Wild Willows — Ecological Accuracy Audit

Full scan of `data/animals-1.json`, `data/animals-2.json`, `data/habitat-objects.json`, `data/biomes.json`.
150 species · 179 habitat objects · 6 biomes · 310 food-web edges · 243 citations.

Every claim below was checked against ADW, Cornell Lab / Birds of the World, USFWS, NPS, NOAA, IUCN, the Mammal Diversity Database, or primary literature. Items I could not verify are marked **[unverified]** rather than asserted.

---

## How to read this

Findings are grouped by **what you'd change in the codebase**, not by species, because most of them are the same bug repeated. Sections 1–3 are engine and schema changes that fix dozens of species at once. Sections 4–9 are the per-record corrections.

Severity:

- **CRITICAL** — teaches a factual misconception a student will carry away
- **HIGH** — clearly wrong, contained blast radius
- **MEDIUM** — misleading oversimplification
- **LOW** — polish

---

## 0. Correction to my earlier review

Two things I got wrong reading only the PDFs, now that I've read the data:

1. **Predator prey-gating does exist.** `red-fox-meadow` requires `animals: [meadow-vole, cottontail-rabbit]`, `red-tailed-hawk` requires `[meadow-vole, ground-squirrel]`, `barn-owl` requires `[meadow-vole]`. The educator guide's species table omits the `animals` column entirely — so the **document** is wrong, not the game. Add that column to the guide and Worksheet 4 stops walking students into a contradiction.

2. **There is one decomposer** — `banana-slug` — not zero. It is also mislabelled (see 1.2).

Everything else in that review stands, and the data makes the "no populations, no competition" point sharper: there is no population size anywhere in the schema.

---

## 1. Engine and schema changes (highest leverage)

These are ordered by how many findings each one closes.

### 1.1 — CRITICAL · Requirements don't encode ecology; they encode "rocks and shrubs"

**50 of the 121 ecologically-meaningful habitat objects are required by no species at all.** Meanwhile:

| object | required by |
|---|---|
| `shrub` | 34 species |
| `rock-pile` | 33 |
| `reed-bed` | 23 |
| `tidepool` | 20 |
| `desert-brush` | 19 |
| `shallow-water-pool` | 18 |
| `alpine-wildflower-patch` | 17 |
| `dune-grass` | 17 |

The purpose-built, ecologically specific objects your team already wrote are the unused ones: `pika-haypile`, `whitebark-cache`, `lichen-boulder`, `scree-slope`, `snowbank-roost`, `cliff-nest-niche`, `heron-rookery`, `dragonfly-pond`, `alder-snag`, `marsh-log`, `bulrush`, `marsh-marigold`, `mushroom-ring`, `fern-spring`, `woodland-pool`, `prickly-pear`, `palo-verde-tree`, `juniper-thicket`, `crystal-spring`, `gentian-patch`, `moss-cushion`, `beach-shrub`, `shore-pine`, `sunflower-patch`, `lupine-patch`, `poppy-patch`, `daisy-patch`, `foxglove`, `willow-tree`, `pine-tree`, `boardwalk`, `garden-arch`, `bird-bath`, `planter-box`.

**This single mismatch is the root cause of roughly a third of the per-species findings below.** The animal cards describe real, specific ecology; the requirement lists then ask for generic cover. A student who reads the card correctly builds the wrong thing.

**Fix:** rewire requirements onto the specialist objects that already exist. Most of Section 5 is exactly this, species by species. Nothing new needs to be built for about 60% of it.

### 1.2 — CRITICAL · The decomposition half of every ecosystem is missing

Across all 150 species: **1 decomposer** (`banana-slug`, which is really a detritivore — slugs shred litter, fungi and bacteria mineralize it), **2 scavengers**, **3 filter-feeders**.

Meanwhile the `eatsOther` strings reference food that no organism produces or processes:

| phantom food | referenced by |
|---|---|
| `insects` | 62 species |
| `seeds` | 27 |
| `berries` | 22 |
| `fish` | 14 |
| `carrion` | 11 |
| `earthworms` | 8 |
| `mice` / `voles` | 15 |
| `crayfish` | 7 |
| `algae` | 8 |

A student can complete all six biomes without ever encountering nutrient cycling. Since `SC.5.2.2` / `5-LS2-1` and `SC.MS.2.6` / `MS-LS2-3` both require a **model of matter cycling including decomposers**, this is simultaneously the biggest ecological gap and the biggest standards gap.

**Fix:** add a decomposer and a detritivore to every biome (Section 8 lists specific species per biome), and add a `detritivore` value to the `trophic` enum so the slug can be labelled correctly.

### 1.3 — CRITICAL · There are no primary producers

Plants exist only as buildable objects with a `plant` tag. No species record is a producer. Every food chain in the game therefore begins with an animal, and the sun appears nowhere.

This is most acute in `coastal`, where there is no kelp, no phytoplankton, and no algal node — six species eat "fish," four eat "algae," three eat "plankton," all as string literals.

**Fix:** promote a small number of plants to species records with their own `requirements` — milkweed, a native bunchgrass, cattail, creosote, whitebark pine, giant kelp. It costs six records and it puts the base under the pyramid.

### 1.4 — CRITICAL · Water is not a modelled requirement

Only **12 of 150** species have any `requirements.water`. Six species that are literally aquatic have none: `forest-salamander`, `chorus-frog`, `wetland-salamander`, `freshwater-fish`, `snowmelt-trout`, `ensatina`.

In `coastal` this produces the worst results in the dataset: a **gray whale, a bottlenose dolphin, a harbor seal, a brown pelican and a sea otter are all gated on planting dune grass and building tidepools, with no water requirement at all.**

There are also four incompatible encodings in use — `objects: {shallow-water-pool}`, `water: {tiles}`, `water: {river}`, `water: {lake}` — with no stated rule for which applies.

**Fix:** one water model. Every aquatic and semi-aquatic species gets a `water` minimum; object-based pools count toward it. Add a `deep` / `open-water` flag so marine species can't be satisfied by two tidepools.

### 1.5 — HIGH · The food web is mostly disconnected

- **89 of 150 species have no `eats` edge at all**, including 27 predators and insectivores.
- **53 of 150 have `eatenBy: None`** — 12 apex predators (fine), but also 11 mesopredators, 11 insectivores, 9 omnivores and 8 herbivores (not fine).
- Coastal is the worst: **19 of 25 species have no predator**, and every apex predator there has an empty `eats`.
- 310 species-to-species edges vs 135 distinct phantom-food strings.

**Fix:** the missing-species additions in Section 8 close most of the dangling edges at once, because the gaps are concentrated — no fish anywhere in coastal, no snake in wetland, no raptor in desert, no cougar/coyote in alpine, no coyote or great horned owl in meadow.

### 1.6 — HIGH · Life stages are conflated

The web has one node per species, so it contains contradictions that are both true at different stages: `freshwater-fish` eats `dragonfly` while dragonfly nymphs eat small fish; `chorus-frog` is tagged `insectivore` though its tadpoles graze algae; golden eagle "eats" adult bighorn and mountain goat when it takes neonates only; `snapping-turtle` and `desert-tortoise` are near predator-free as adults and heavily preyed on as eggs.

**Fix:** add a `stage` annotation to edges (`eggs`, `young`, `adult`). This is a small schema change that fixes about 25 individually-flagged edges and lets you keep the ecologically real ones.

### 1.7 — MEDIUM · `trophic` contradicts `role` on 19 species

The `role` prose says one thing, the enum says another:

| species | `trophic` | `role` says |
|---|---|---|
| `coyote` | apex-predator | "an omnivore" |
| `burrowing-owl` | insectivore | "both an insectivore and a mesopredator" |
| `tarantula`, `scorpion`, `banded-gecko`, `collared-lizard`, `elf-owl` | insectivore | "a mesopredator" |
| `tidepool-crab`, `gull`, `snapping-turtle`, `purple-shore-crab` | omnivore | "scavenger" |
| `bat-star` | scavenger | "an omnivorous scavenger" |
| `raccoon`, `tree-squirrel` | omnivore | "mesopredator" |
| `sea-turtle` | herbivore | "omnivore" |
| `water-strider` | insectivore | "scavenger" |
| `elk-forest` | herbivore | (scavenger reference) |
| `pileated-woodpecker`, `ensatina` | insectivore | (decomposer reference) |

Also inconsistent: `lady-beetle` is `insectivore` while `praying-mantis` is `mesopredator` though both are generalist arthropod predators; `costas-hummingbird` and `gambels-quail` are `herbivore` despite insect diets; `red-admiral` is `herbivore` with a diet of sap and fermenting fruit.

**Fix:** pick a convention (I'd suggest trophic level, not diet category), then regenerate the labels from the diet text rather than hand-assigning.

### 1.8 — MEDIUM · Seasonality is used on 14 of 150 species, and one of them is backwards

`ermine` is gated to `season: ["winter"]`. **Ermines don't hibernate and are resident year-round** — they breed in summer. Meanwhile `marmot`, whose own `role` says it hibernates eight months, has no seasonal condition at all, and neither does `boreal-toad` (Sept–May underground) or the migratory `elk-alpine` / `mule-deer-alpine`.

**Fix:** remove the ermine gate (or use it only to trigger the white-pelage art), and add correct gates to hibernators and elevational migrants. Alpine is where this teaches the most.

### 1.9 — MEDIUM · `eatsOther` double-counts nodes that already exist

Seven wetland predators list `'fish'` in `eatsOther` while also listing `freshwater-fish` in `eats`; the same pattern applies to `'insects'` vs the dragonfly/damselfly/water-strider nodes. This inflates the apparent web and makes the real node look optional.

### 1.10 — LOW · `kind` mixes two taxonomic axes

`desert-bee` is `kind: insect` while `tarantula` and `scorpion` are `kind: invertebrate`. Insects *are* invertebrates. Pick one axis (`arthropod` / `mollusc` / `insect` as a sub-tag, or just be consistent).

---

## 2. Regional coherence — the single biggest decision

**Four of six biomes are composites of species that cannot co-occur.** This is the finding I'd act on first, because it changes which species you keep before you spend time fixing their records.

### 2.1 — CRITICAL · Willow Meadow: eastern + western

Strictly western taxa — California Ground Squirrel (*Otospermophilus beecheyi*), Western Screech-Owl, Western Meadowlark, Mule Deer — sit beside strictly eastern taxa — Eastern Cottontail (*Sylvilagus floridanus*), Eastern Bluebird (*Sialia sialis*), Meadow Vole (*Microtus pennsylvanicus*). **The meadow as assembled exists nowhere on Earth.**

Given the game's Colorado/Western feel and the meadowlark and mule deer, **commit to western shortgrass prairie**:

| replace | with |
|---|---|
| Eastern Cottontail *S. floridanus* | Desert Cottontail *S. audubonii* or Mountain Cottontail *S. nuttallii* |
| Eastern Bluebird *S. sialis* | Western Bluebird *S. mexicana* or Mountain Bluebird *S. currucoides* |
| Meadow Vole *M. pennsylvanicus* | California Vole *M. californicus* or Montane Vole *M. montanus* |

### 2.2 — CRITICAL · Old Hollow Forest: eastern + Pacific Northwest + Rocky Mountain

Three regions in one 25-species roster. Eastern deciduous is the best fit for the majority and for a "logged-over woodland" narrative.

| replace | with |
|---|---|
| `pacific-wren` *Troglodytes pacificus* | Winter Wren *T. hiemalis* (split 2010) |
| `spotted-towhee` *Pipilo maculatus* | Eastern Towhee *P. erythrophthalmus* |
| `rough-skinned-newt` *Taricha granulosa* | Eastern Newt *Notophthalmus viridescens* |
| `ensatina` *E. eschscholtzii* | Northern Slimy Salamander *Plethodon glutinosus* |
| `mule-deer-forest` | White-tailed Deer *Odocoileus virginianus* |
| `elk-forest` | cut, or explicitly frame as a reintroduced eastern population |
| `banana-slug` *Ariolimax columbianus* | no eastern equivalent — replace with a millipede or isopod detritivore |

The incoherence shows up inside single records: `garter-snake-forest`'s `role` invokes the Pacific Northwest newt/snake toxin arms race while the snake sits in an eastern woodland, and `spotted-towhee`'s `preferredHabitat` cites *chaparral* — a California shrubland — inside a forest biome. `elk-forest`'s `fact` and `role` are pure Yellowstone and describe a wolf-driven system this biome does not contain.

### 2.3 — CRITICAL · Redstone Scrubland: three non-overlapping deserts

Saguaro-obligate Sonoran species (Gila Woodpecker, Elf Owl) + a Great Basin sand endemic + a Chihuahuan/plains lizard + a plains/Ozark lizard + a Mojave-only tortoise. **Commit to the Sonoran Desert** — that's where the buildable objects already point (palo verde, ironwood, ocotillo, mesquite, agave, prickly pear).

| replace | with | why |
|---|---|---|
| `kangaroo-mouse` *Microdipodops pallidus* | Desert Pocket Mouse *Chaetodipus penicillatus* | *M. pallidus* is a Great Basin sand-dune obligate; same "never drinks" teaching value |
| `horned-lizard` *Phrynosoma cornutum* | Regal Horned Lizard *P. solare* | *P. cornutum* is southern Great Plains / Chihuahuan |
| `desert-tortoise` *Gopherus agassizii* | Sonoran Desert Tortoise *G. morafkai* | *G. agassizii* was split in 2011 and now means Mojave only |
| `collared-lizard` *Crotaphytus collaris* | Sonoran Collared Lizard *C. nebrius* | *C. collaris* is eastern/plains/Chihuahuan |
| `antelope-squirrel` *Ammospermophilus leucurus* | Harris's Antelope Squirrel *A. harrisii* | Sonoran congener |

Also: **landform mismatch.** Saguaro, palo verde and ironwood grow on rocky **bajadas and slopes**; the biome describes a fine-soil valley **flat**, which supports creosote–bursage and burrowing rodents. Pick one.

### 2.4 — CRITICAL · Graywind Heights: Rockies + Sierra + Cascades

`cascades-frog` (*Rana cascadae*) is a Cascades endemic; `alpine-chipmunk` (*Neotamias alpinus*) is a Sierra Nevada endemic; the bulk of the roster (bighorn, elk, nutcracker, *Parnassius smintheus*, boreal toad) is Rocky Mountain. **Commit to the Southern Rockies.**

| replace | with |
|---|---|
| `cascades-frog` *Rana cascadae* | drop (boreal toad already covers alpine amphibians) |
| `alpine-chipmunk` *Tamias alpinus* | Least Chipmunk *Neotamias minimus* |
| `mountain-goat` | keep but label as **introduced** in Colorado, or remove |

### 2.5 — CRITICAL · Pelican Shore: the description faces the wrong ocean

The biome description says the open ocean breaks along the **eastern** edge. **100% of the roster is Northeast Pacific** — *Pisaster ochraceus*, *Mytilus californianus*, *Enhydra lutris*, *Haematopus bachmani*, *Cepphus columba*, *Urile pelagicus*, *Larus occidentalis*, *Eschrichtius robustus*, plus Monterey cypress and coast live oak.

**Fix:** change to "western edge" and commit explicitly to the California rocky intertidal. Then follow through on `oyster-bed` (name the native Olympia oyster *Ostrea lurida*, not the introduced *Magallana gigas*), `pelican` (California Brown Pelican *P. o. californicus*) and `brant-goose` (Black Brant *B. b. nigricans*).

### 2.6 — CRITICAL · Rushwater Wetland: marsh + southeastern swamp

The biome is defined as an emergent freshwater marsh, but offers `bald-cypress` (*Taxodium distichum*) and `water-tupelo` (*Nyssa aquatica*) — southeastern bottomland swamp trees — plus `prothonotary-warbler`, a flooded-bottomland-forest bird, alongside a northern prairie-pothole assemblage (beaver, sandhill crane, tiger salamander, chorus frog, hooded merganser). A river requirement is also grafted on for the kingfisher, and `wooden-bridge` references "your rivers and lakes."

**Fix:** move cypress / tupelo / prothonotary to a future Bottomland Swamp biome; substitute `willow-tree` and `alder-snag` here.

---

## 3. Names — generic labels beside real binomials

A product that displays a scientific name has to display the matching species-level common name, or students learn the binomial names the whole group. These records fail that:

| id | shows | should show |
|---|---|---|
| `tree-squirrel` | "Tree Squirrel" / *Sciurus carolinensis* | Eastern Gray Squirrel |
| `woodpecker` | "Woodpecker" / *Picoides pubescens* | Downy Woodpecker (and see 4.1 — genus is wrong too) |
| `forest-salamander` | "Forest Salamander" / *Plethodon cinereus* | Eastern Red-backed Salamander (no species is called a "forest salamander") |
| `wetland-salamander` | "Tiger Salamander" / *Ambystoma tigrinum* | Eastern Tiger Salamander; rename id to `tiger-salamander` |
| `chorus-frog` | "Chorus Frog" / *Pseudacris triseriata* | Midland Chorus Frog, or switch to Boreal Chorus Frog *P. maculata* |
| `ground-squirrel` | "Ground Squirrel" / *Otospermophilus beecheyi* | California Ground Squirrel |
| `rattlesnake` | "Western Rattlesnake" / *Crotalus atrox* | **Western Diamondback** — "Western Rattlesnake" is *C. oreganus*, a different species |
| `scorpion` | "Desert Scorpion" / *Hadrurus arizonensis* | Giant Desert Hairy Scorpion |
| `tarantula` | / *Aphonopelma chalcodes* | Arizona Blond Tarantula |
| `desert-bee` | "Desert Bee" / *Diadasia rinconis* | Cactus Bee |
| `kangaroo-rat` | / *Dipodomys merriami* | Merriam's Kangaroo Rat |
| `horned-lizard` | "Horned Lizard" | Regal Horned Lizard (after 2.3) |
| `alpine-butterfly` | "Alpine Butterfly" / *Parnassius smintheus* | Rocky Mountain Parnassian |
| `bumblebee-alpine` | "Alpine Bumblebee" | High Country Bumble Bee |
| `pine-marten` | "Pine Marten" / *Martes americana* | **American Marten** — "pine marten" is the European *M. martes* |
| `ermine` | "Ermine" / *Mustela richardsonii* | American Ermine (binomial is correct and current; sources still point at *M. erminea*) |
| `tidepool-crab` | "Shore Crab" / *Pachygrapsus crassipes* | Striped Shore Crab (also collides with `purple-shore-crab`) |
| `hermit-crab` | "Hermit Crab" / *Pagurus samuelis* | Blueband Hermit Crab |
| `chipmunk`, `nuthatch`, `porcupine`, `elk`, `garter-snake` | generic | Eastern Chipmunk, White-breasted Nuthatch, North American Porcupine, Elk/Wapiti, Common Gartersnake |

**Not binomials at all** — these sit in a `scientificName` field beside 140 real ones:

| id | shows | rank | fix |
|---|---|---|---|
| `dragonfly` | "Anisoptera (Odonata)" | suborder | Common Green Darner *Anax junius* |
| `damselfly` | "Zygoptera (Odonata)" | suborder | Familiar Bluet *Enallagma civile* |
| `water-strider` | "Gerridae (Hemiptera)" | family | Common Water Strider *Aquarius remigis* |
| `freshwater-fish` | "Freshwater Minnows / Leuciscidae" | family | Fathead Minnow *Pimephales promelas* (and note the assemblage it stands for includes non-Leuciscidae) |
| `praying-mantis` | "*Stagmomantis* spp. / *Mantis religiosa*" | two taxa, one native + one introduced | pick one and state native vs. introduced |

**`shorebird` and `snowy-plover` are the same bird** — Snowy Plover *Charadrius nivosus* and Western Snowy Plover *C. n. nivosus*, listed twice with different rarity, near-identical diet and fact, and **the same two source URLs**. Delete `shorebird`.

---

## 4. Taxonomy — deprecated or wrong binomials

| id | current | correct | note |
|---|---|---|---|
| `barn-owl` | *Tyto alba* | ***Tyto furcata*** | AOS 65th Supplement (2024) split American Barn Owl; *T. alba* no longer occurs in the Americas. Your own cited URL is `/guide/American_Barn_Owl/` |
| `coopers-hawk` | *Accipiter cooperii* | ***Astur cooperii*** | AOS genus reassignment |
| `woodpecker` | *Picoides pubescens* | ***Dryobates pubescens*** | *Picoides* now restricted to three-toed woodpeckers |
| `bumblebee-alpine` | *Bombus balteatus* | ***Bombus kirbiellus*** | Nearctic taxon separated from Palearctic *balteatus*; your own cited paper is the study that did it |
| `alpine-chipmunk` | *Tamias alpinus* | ***Neotamias alpinus*** | genus reassignment (moot if replaced per 2.4) |
| `desert-tortoise` | *Gopherus agassizii* | ***G. morafkai*** | 2011 split (see 2.3) |
| `rattlesnake` | name/binomial mismatch | see §3 | |
| `boreal-toad` | *Anaxyrus boreas boreas* | **[unverified]** | Southern Rocky Mountain population is treated as a distinct lineage (NatureServe "*A. boreas* pop. 1"); trinomial is defensible but check the current USFWS decision before publishing |
| `northern-flying-squirrel` | *G. sabrinus* | note | Humboldt's flying squirrel *G. oregonensis* was split off for the Pacific coast in 2017; this record's ecology is written as coastal-PNW truffle ecology |

**Stale source URLs** (name updated, citation not): `elk-forest` and `elk-alpine` cite `Cervus_elaphus` while using *C. canadensis*; `fisher` cites `Martes_pennanti` while using *Pekania pennanti*; `ermine` cites *M. erminea*; `ensatina` cites the Plethodontidae family page; `red-fox-forest` cites an NWF **raccoon** page; **`clam` cites `animaldiversity.org/accounts/Enhydra_lutris/` — the sea otter's page**.

---

## 5. Requirements that contradict the species' own card

This is the largest category and the one that directly breaks Worksheet 4. In each case the record's own `diet` / `shelter` / `preferredHabitat` field says one thing and `requirements.objects` asks for another.

### Meadow

| species | requires | problem | fix |
|---|---|---|---|
| `garter-snake-meadow` | rock-pile, grass-patch, shrub | own habitat says "near sunny rocks **and water**"; diet is amphibians, earthworms, small fish | add `small-pond` or `shallow-water-pool` |
| `barn-swallow` | small-pond, bird-perch, shrub | no nest substrate; barn swallows essentially only nest on human structures now | require `wooden-bridge` (already exists) or add an eaves object |
| `red-admiral` | butterfly-flowers, wildflower-patch, insect-hotel | larvae are **stinging nettle** specialists; `butterfly-flowers` is milkweed; **no nettle object exists** | add `nettle-patch`, require it |
| `barn-owl` | log-shelter, shrub | cavity nester per its own `shelter` field; a ground-level log stack is not a roost | require `oak-tree` or add a nest-box/barn object |
| `leafcutter-bee` | clover-patch, wildflower-patch, shrub | obligate cavity nester in hollow stems — and `insect-hotel` is described as exactly that, unused | require `insect-hotel` |
| `bumblebee` | wildflower-patch, pollinator-garden, shrub | all forage, no nest site; nest-site loss is a leading decline driver | add `native-grass-patch` (tussocks) or `brush-pile` |
| `killdeer` | native-grass-patch, ... | own habitat says "**very short grass** and scattered stones"; deep bunchgrass is the opposite | swap to `gravel-path` |
| `eastern-bluebird` | bird-perch, native-grass-patch, berry-bush | obligate secondary cavity nester per its own `shelter` | require `oak-tree` or a nest-box |
| `red-tailed-hawk` | bird-perch, shrub | own shelter: "bulky stick nest in the **crown of a tall tree**" | require `oak-tree` or `pine-tree` |
| `american-badger` | brush-pile, rock-pile, shrub | needs deep diggable soil + a burrowing-rodent colony; rock and brush are what badger habitat isn't | `native-grass-patch: 2`; add `ground-squirrel` to `animals` |
| `western-screech-owl` | oak-tree, hollow-log, log-shelter | two of three are ground level; nests in woodpecker cavities | replace log objects with a cavity/nest-box |
| `western-meadowlark` | ... shrub, rain-basin | grassland obligate whose occupancy **declines** with woody encroachment — requiring a shrub teaches the inverse conservation lesson | `native-grass-patch: 3`, `bird-perch: 1`; drop shrub |
| `american-goldfinch` | wildflower-patch | diet names thistle and **sunflower**; `sunflower-patch` exists and is required by nobody | require `sunflower-patch`; add a thistle object |
| `red-fox-meadow` | ... wildflower-patch | arbitrary; foxes dig earthen dens and no den object exists | swap to `native-grass-patch` (= vole habitat) or add an earth-den |
| `lady-beetle` | clover-patch | arbitrary; no aphid or host-plant link modelled anywhere | see 8 — add aphids |
| `song-sparrow` | shrub, bird-perch | hint says "shrubs, **native grass**, and somewhere high to sing from" but grass isn't in objects | add `native-grass-patch: 1` |

### Forest

| species | requires | problem | fix |
|---|---|---|---|
| `forest-salamander` | **shallow-water-pool** | *Plethodon cinereus* is "entirely terrestrial and does not have an aquatic larval stage" (ADW). Requiring a pond teaches the exact misconception this species is the textbook counterexample to. The hint says "clean shallow water," compounding it | `leaf-litter-pile`, `log-shelter`, `fern-spring` |
| `ensatina` | **shallow-water-pool** | same error — fully terrestrial plethodontid, direct development | `fern-spring`, `leaf-litter-pile`, `mushroom-log` |
| `banana-slug` | shallow-water-pool | needs persistent humidity and litter, not open water | `leaf-litter-pile`, `mushroom-log`, `fern-spring` |
| `wood-duck` | nesting-tree, shrub, water | obligate cavity nester; `role` explicitly says it depends on woodpecker cavities | add `standing-deadwood`; ideally gate on `pileated-woodpecker` |
| `northern-flying-squirrel` | nesting-tree, tree-stump, shrub | diet is "mostly underground **truffle fungi**", shelter is cavities; neither is required | `nesting-tree`, `standing-deadwood`, `mushroom-log` |
| `little-brown-bat` | bat-box, standing-deadwood, shrub | diet is **exclusively emergent aquatic insects**; no water required | add `small-pond` or `woodland-pool` |
| `garter-snake-forest` | rock-pile, grass-patch, shrub | riparian species, >half the diet aquatic-derived; no water | add `small-pond` |
| `fisher` | birch-tree, tree-stump, mushroom-log | nothing about fishers points to birch; needs high canopy closure and hollow trees | `nesting-tree: 2`, `hollow-log`, `standing-deadwood` |
| `great-horned-owl` | nesting-tree: 2 | own shelter says it **never builds a nest** — it adopts old hawk/crow/heron nests | add `standing-deadwood`; gate on a stick-nest builder |
| `chipmunk` | rock-pile, fallen-branch-shelter | shelter is "underground burrows up to 10 m" — the defining feature. No soil/burrow object exists anywhere | add a burrow object (also fixes red fox and snake hibernacula) |
| `tree-squirrel` | nesting-tree, log-shelter | habitat is "rich in oaks and hickories", diet is acorns, shelter is cavity dens — none required | `oak-tree: 2`, `nesting-tree`, `standing-deadwood` |
| `black-bear` | berry-bush ×3 | no hard mast though diet and habitat both name nuts/acorns; `log-shelter` instead of a den | `berry-bush: 2`, `oak-tree: 2`, `hollow-log`, `small-pond` |
| `porcupine` | nesting-tree, fallen-branch-shelter, shrub | shelter is "rock dens, hollow logs" | swap branch shelter for `rock-pile` or `hollow-log` |
| `barred-owl` | oak-tree | no oak association; meanwhile habitat says "near water", the fact is about wading for fish, and no water is required | replace `oak-tree` with `woodland-pool` |
| `pacific-wren` | — | habitat "near streams", fact is about salmon-fed streams; no water. Signature nest substrate (upturned root wads) has no object | add `fern-spring` |
| `pileated-woodpecker` | standing-deadwood: 1 | needs **large-diameter** snags plus downed woody debris for carpenter ants; its `role` calls it the keystone cavity provider yet it has the loosest deadwood ask in the biome | `standing-deadwood: 2`, `log-shelter`, `nesting-tree` |

### Wetland

| species | requires | problem | fix |
|---|---|---|---|
| `beaver` | shallow-water-pool ×2, mud-bank, reed-bed | **no tree** — the hint says "woody plants", diet names willow and aspen cambium, and `willow-tree` exists. "Shallow" also inverts the beaver's defining behavior | `willow-tree: 2`, `mud-bank`, `shallow-water-pool: 2`, `water: {tiles: 5}` |
| `belted-kingfisher` | nesting-platform, reed-bed | nests in **tunnels dug into earthen banks** — the one thing it will never use is a platform. `mud-bank` not required | `mud-bank`, `alder-snag` (fishing perch) |
| `great-blue-heron` | nesting-platform | colonial stick-nester in tall trees; `heron-rookery` exists, described as exactly this, and is required by nobody | `heron-rookery`, `willow-tree`, `shallow-water-pool: 2` |
| `prothonotary-warbler` | bald-cypress, reed-bed, nesting-platform | one of only two North American warblers that nest in **tree cavities**; asked to use an open platform and a reed bed | `alder-snag` or `duck-nest-box`; drop reed-bed |
| `mink` | mud-bank, reed-bed, sedge-tussock | **no water at all** for a semi-aquatic predator whose fact is "can swim 30 m underwater" | `water: {tiles: 3}`, `animals: [freshwater-fish, chorus-frog]` |
| `wetland-salamander` | shallow-water-pool | its own shelter and habitat both specify **fishless** pools — and this is the same object `freshwater-fish` requires | add an exclusion (`excludes: [freshwater-fish]`) or a vernal-pool object |
| `painted-turtle` | shallow-water-pool, mud-bank, reed-bed | no basking structure, though `basking-log` and `marsh-log` exist and `spotted-turtle` correctly requires one. Basking is thermoregulation-obligate | add `basking-log` |
| `muskrat` | reed-bed, pool, sedge-tussock | diet is "mainly **cattails**", habitat is "abundant cattails", `cattail-stand` exists | add `cattail-stand` |
| `marsh-wren` | reed-bed ×2, sedge-tussock | shelter says cattails and bulrushes; sedge tussocks are **Sedge Wren** microhabitat, a different species | `cattail-stand`, `bulrush`, `reed-bed` |
| `green-heron` | water-tupelo | forces a Coastal Plain swamp tree on a continent-wide bird that nests in any tree over water | `willow-tree` or `alder-snag` |
| `red-winged-blackbird` | reed-bed: 2 | nests over standing water; no water requirement, no insect prerequisite | add `water: {tiles: 2}` |
| `hooded-merganser` | duck-nest-box, reed-bed | no tree, for a species whose habitat is "quiet wooded ponds" and which nests 10–50 ft up | add a tree |
| 4 fish-eaters | — | `green-heron`, `american-bittern`, `hooded-merganser`, `snapping-turtle` all list `freshwater-fish` in `eats` but have no `animals` prerequisite, while otter, heron and kingfisher do | add `animals: [freshwater-fish]` — the rule is applied to 3 species and silently dropped for 4 |

### Desert

| species | requires | problem | fix |
|---|---|---|---|
| `gila-woodpecker` | cactus-patch: 2 | shelter says "cavities excavated in **saguaro**" — and **no saguaro object exists**. A prickly-pear pad cannot hold a cavity | add a `saguaro` object; require it |
| `elf-owl` | trees + cactus-patch | secondary cavity nester in old woodpecker holes — **no `animals: [gila-woodpecker]` prerequisite**. This is the best keystone lesson in the dataset and the game doesn't teach it | `saguaro`, `mesquite-tree`, `animals: [gila-woodpecker]` |
| `desert-iguana` | agave-rosette, rock-pile | diet says "especially **creosote**"; iguanas use rodent burrows at creosote bases. **No creosote object exists at all**, despite it being the dominant shrub of the Sonoran and Mojave | add `creosote-bush`; require it + `burrow-mound` |
| `phainopepla` | desert-brush: 2, dew-basin | its fact is that it's desert mistletoe's key disperser; mistletoe grows on mesquite/palo verde/ironwood, none required, **and no mistletoe object exists** | add `desert-mistletoe`; require `mesquite-tree` + mistletoe |
| `horned-lizard` | rock-pile, rock-crevice | **harvester-ant specialist** per its own role. Rock piles don't produce harvester ants — those need open bare ground. *Pogonomyrmex* appears nowhere | add `harvester-ant-mound` (or the ant as a species); use open sandy ground, not crevices |
| `cactus-wren` | cactus-patch | nests in **cholla**, palo verde, acacia or mesquite; a pad cactus is not a nest substrate | add `cholla`; require it |
| `costas-hummingbird` | **nectar-feeder**, cactus-patch | in a restoration game, gating a pollinator on a sugar-water feeder teaches the wrong lesson | `ocotillo` + `agave-rosette`, or add `chuparosa`; keep the feeder as decor |
| `desert-bee` | cactus-patch | needs prickly pear/cholla specifically **and bare, undisturbed, uncompacted ground** for nest aggregations — exactly what overgrazing destroys. Best "why overgrazing matters" hook in the biome, unused | `prickly-pear`, `bare-ground-patch` (new) |
| `banded-gecko` | ocotillo | irrelevant to a nocturnal crevice dweller; own shelter says "rock crevices" | `rock-crevice`, `shaded-rock-shelter`, `desert-brush` |
| `scorpion` | rock-pile | *H. arizonensis* digs burrows **up to 2.5 m deep** — its primary heat and water refuge | `burrow-mound` + `rock-pile`; update `shelter` text |
| `antelope-squirrel` | burrow-mound, desert-brush, rock-crevice | ADW: "must have some succulent plants or free water… in order to survive" | add `prickly-pear` or `dew-basin` |
| `gambels-quail` | — | genuinely free-water-using; concentrates at seeps and tanks in summer | add `dew-basin` or `bird-bath` |
| `chuckwalla` | cactus-patch | grazes annual wildflowers, creosote and brittlebush; cactus is incidental. (`sunstone-cairn` + `rock-crevice` are excellent and correctly reasoned) | swap cactus for a wildflower/annual-bloom object |

**Object tag bugs:** `rock-crevice` has `needs: []` despite being reptile heat shelter, and `dew-basin` has `needs: []` despite being the biome's only water feature. Neither counts toward a `shelter` or `water` need. Fix to `['shelter']` and `['water']`.

### Alpine

| species | requires | problem | fix |
|---|---|---|---|
| `clarks-nutcracker` | rock-pile, alpine-wildflower-patch, heather-mat | its entire identity is the obligate whitebark pine mutualism; **`whitebark-cache` exists and is required by nobody** | `whitebark-cache`, `krummholz-pine` |
| `ptarmigan` | **frostflower-planter** | the only bird that lives above treeline year-round is gated on a fictional decorative planter of "ice-blooms," while `snowbank-roost`, `scree-slope` and `heather-mat` go unused and **no willow object exists** despite willow being its stated winter food | `snowbank-roost`, `heather-mat`, `scree-slope`, new `willow-thicket` |
| `rosy-finch` | wildflower, rock-pile, heather-mat | obligate crevice nester on "talus, scree, cliffs, glaciers" per its own card; `scree-slope`, `talus-pile`, `cliff-nest-niche` all unused | `scree-slope`, `cliff-nest-niche`, `snowbank-roost` |
| `golden-eagle` | rock-pile ×2, wildflower | shelter says "huge stick eyries on **cliffs**"; `cliff-nest-niche` unused | `cliff-nest-niche` |
| `pine-marten` | rock-pile ×2, wildflower | habitat is "structurally complex **treeline forest**" — cannot be built from rocks and flowers | `subalpine-fir: 2`, `krummholz-pine`, `talus-pile` |
| `snowshoe-hare` | grass-patch ×2, rock-pile | own shelter says "forms under dense shrubs and conifer cover"; hares are the textbook cover-dependent prey | `subalpine-fir`, `krummholz-pine`, `juniper-thicket` |
| `pika` | talus-pile, rock-pile | hint says "flowers to harvest" but **no plant is required**, and the purpose-built `pika-haypile` is used by nobody. Haying is the pika's defining adaptation | `pika-haypile`, `alpine-wildflower-patch: 2`, `talus-pile: 2` |
| `mountain-goat` | rock-pile | diet includes lichens and mosses; `lichen-boulder` exists, unused. `rock-pile` also stands in for **escape terrain** (near-vertical broken cliff), which is what goat and bighorn survival actually depends on | `lichen-boulder`; add an `escape-cliff` object |
| `mountain-bluebird`, `mountain-chickadee` | krummholz-pine | both cavity-obligate; the bluebird's own fact says it "cannot dig its own hole" — and **the game has no cavity excavator and no snag object** | add a woodpecker species or a `snag`/nest-box object |
| `pine-grosbeak` | quaking-aspen | conifer-buds-and-seeds specialist. Also: aspen **does not grow above treeline**, and the object description calls it "alpine" | `subalpine-fir: 2`, `krummholz-pine`; fix the aspen description |
| `white-crowned-sparrow` | alpine-nest-shelf | builds a ground/low-shrub cup nest; the sheltered rock ledge is the **rosy-finch's** niche | `heather-mat: 2`, `krummholz-pine`; move the shelf to the rosy-finch |
| `elk-alpine` | rock-pile | no ecological basis; filler | `subalpine-fir` |
| `cascades-frog` | `conditions.weather: ["rain"]` | high-country amphibian breeding is triggered by **snowmelt/ice-out**, not rain — this teaches lowland vernal-pool phenology in an alpine biome | replace with a snowmelt condition |
| `snowmelt-trout` | snowmelt-pool: 2 | own habitat says "**connected** snowmelt streams and lakes"; two isolated stone-lined pools are the opposite of connectivity | see 6.4 — probably remove the species |

### Coastal — the worst-affected biome

| species | requires | problem |
|---|---|---|
| `sea-otter` | kelp-wrack: 2, **dune-grass: 1**, no water | kelp *wrack* is dead kelp on the beach; otters raft in **living surface canopy**, which its own `shelter` field says |
| `dolphin` | tidepool: 2, kelp-wrack, **dune-grass**, no water | a bottlenose dolphin gated on building two tidepools and planting dune grass |
| `migrating-whale` | tidepool: 2, **dune-grass: 2**, coastal-nesting-area, no water | a 40-ton gray whale gated on two dune-grass plantings and a bird nesting closure |
| `harbor-seal` | coastal-nesting-area, tidepool, **dune-grass**, no water | a seal haul-out is not a bird nesting closure |
| `pelican` | coastal-nesting-area, tidepool, **dune-grass**, no water | California brown pelicans nest **only on offshore islands** (Anacapa, Santa Barbara), never on mainland dune beaches |
| `cormorant` | tidepool ×2, **dune-grass**, no water, no cliff | cliff-ledge nester; `nesting-bluff` exists and is unused |
| `sea-turtle` | coastal-nesting-area, **dune-grass: 2** | green sea turtles **do not nest anywhere on the US Pacific coast** (USFWS). Reframe as a summer foraging visitor requiring `eelgrass-bed` + water |
| `snowy-plover` / `shorebird` | **dune-grass: 2** | backwards from real recovery practice — plovers select open sparse sand, and CA State Parks removes invasive beachgrass *specifically because* it prevents plover nesting |
| `black-oystercatcher` | **oyster-bed** | black oystercatchers **do not eat oysters** — the name is a misnomer, and gating them on an oyster bed reinforces it. Free myth-busting moment in the `fact` instead |
| `purple-shore-crab` | oyster-bed, dune-grass | lives **under loose rocks** in the sheltered mid-high intertidal, per its own shelter field |
| `hermit-crab` | dune-grass | hint says "tidepools plus washed-up **shells**" — and shell supply genuinely limits hermit crab abundance. No shell source exists |
| `sea-star` | dune-grass | on an ochre sea star |
| `clam` | tidepool, dune-grass | *Leukoma staminea* buries in sand-gravel of protected bays, per its own habitat field |
| `sanderling` | dune-grass ×2 | swash-zone specialist on open sandy beach; the hint states the mismatch out loud |
| `annas-hummingbird` | **dune-grass** | **dune grasses are wind-pollinated and produce no nectar**; `sea-thrift`, `beach-shrub` and `planter-box` all exist |
| `acorn-woodpecker` | **tidepool**, driftwood-shelter | an oak-woodland bird gated on a tidepool. Should be `coast-live-oak: 2` (granaries need a group) |
| `bat-star` | eelgrass-bed | *Patiria miniata* is a rocky-bottom / kelp / surfgrass species **[some local populations do occur in eelgrass — flag as probable]** |
| `pigeon-guillemot` | oyster-bed | not a guillemot resource; needs forage fish. (`nesting-bluff` + `water: 4` are correct — one of the better-built records) |
| `mussel`, `clam` | tidepool, no water, no current | filter feeders whose whole trophic identity is moving water |

**Two objects are doing the work of the entire ocean:** `tidepool` is required by **15 of 25** coastal species including a dolphin, a gray whale, a seal, a pelican and an acorn woodpecker; `coastal-nesting-area` covers a plover scrape, a pelican island colony, a turtle nest beach, a seal haul-out *and* a whale sighting. Split them (`plover-scrape-closure`, `haul-out-rocks`, `offshore-nesting-island`) and add real water.

**No zonation model.** Intertidal life is organized by tidal zone and wave exposure, and the cards state zonation-dependent facts the game can't represent — the sea star sets "the mussel bed's lower limit," the anemone sits "below mussel beds," the oystercatcher nests "just above the tide." Adding `zone` and `waveExposure` attributes is the highest-value structural addition available for this biome.

---

## 6. Food-web edges to delete, add, or qualify

### 6.1 Delete — predator can't or doesn't take this prey

| edge | why |
|---|---|
| `garter-snake-meadow` → `ground-squirrel` | a garter snake cannot take a 450–900 g ground squirrel — and this **inverts** the relationship described in the squirrel's own `fact` |
| `red-tailed-hawk` → `barn-swallow`, `eastern-bluebird` | red-tails are slow soaring buteos taking ground prey; they don't catch swallows in flight. These are Cooper's Hawk prey |
| `barn-owl` → `cottontail-rabbit`, `ground-squirrel`, `garter-snake-meadow` | barn owls take prey mostly under ~100 g; reptiles are near-absent from their diet; and the squirrel is diurnal while the owl is gated to dusk/night |
| `great-horned-owl` → `bobcat` | a 1.4 kg owl does not prey on a 7–14 kg felid |
| `black-bear` → `red-fox-forest`, `garter-snake-forest` | no meaningful predator-prey relationship |
| `bobcat` → `elk-forest` | bobcats cannot kill adult elk; even calf predation is essentially unrecorded |
| `fisher` → `bobcat` (and `bobcat.eatenBy: fisher`) | bobcat→fisher is documented; the reverse is not. The documented mustelid-on-cat case is fisher predation on **Canada lynx**. Also a mutual-predation loop in a graph meant to teach directional energy flow |
| `red-fox-forest` → `fisher`, `raccoon` | both are comparable-size or larger; fishers dominate foxes |
| `garter-snake-forest` → `little-brown-bat`, `wood-duck` | snake doesn't take bats, and an adult wood duck is far outside its prey size |
| `pileated-woodpecker` → `nuthatch` | carpenter-ant and beetle-larva specialist; does not prey on adult songbirds |
| `ensatina` → `banana-slug` | a 5–8 cm salamander cannot eat a 25 cm slug |
| `muskrat` → `spotted-turtle` | muskrats are primarily herbivorous; turtles aren't on the menu |
| `chorus-frog` → `dragonfly` | a 2–4 cm frog doesn't take adult dragonflies — the real edge runs the other way (nymphs eat tadpoles) |
| `painted-turtle` → `freshwater-fish` | too slow to take healthy fish; move to `eatsOther: [carrion, dead fish]` |
| `tarantula` → `scorpion` | the in-game scorpion is the **largest in North America** (10–18 cm) and itself preys on spiders. Reverse the arrow |
| `scorpion` ← `banded-gecko` | a 7 cm gecko cannot eat a 15 cm *Hadrurus* |
| `banded-gecko` → `desert-bee` | gecko is strictly nocturnal; the cactus bee is a diurnal morning specialist. They never meet |
| `collared-lizard` → `banded-gecko` | diurnal rock basker vs nocturnal crevice dweller |
| `rattlesnake` → `chuckwalla` | chuckwallas wedge into crevices and inflate specifically to defeat this |
| `kit-fox` → `desert-tortoise` | not in ADW's kit fox diet; eggs/hatchlings only |
| `fox-alpine` → `boreal-toad` | bufotoxins make toads strongly aversive to canids |
| `fox-alpine` ← `golden-eagle` | adult red foxes are effectively unpreyed-upon in alpine; kits only |
| `snowmelt-trout` → `cascades-frog` | trout eat tadpoles, not adult frogs — and the documented predator is **introduced** brook/rainbow trout, not native cutthroat |
| `song-sparrow` → `praying-mantis` | an adult mantis is 7–10 cm and predatory; sparrows glean small invertebrates |
| `coopers-hawk` → `garter-snake-meadow` | bird-and-small-mammal specialist; reptiles negligible |
| `barn-swallow` → `painted-lady`, `red-admiral` | swallows take small soft-bodied flying insects; large butterflies rarely |
| `great-horned-owl` → `forest-salamander`, `pacific-wren`; `bobcat` → `spotted-towhee` | 0.5 g salamander and 9–40 g songbirds are not meaningful prey for these predators |
| `barred-owl` → `rough-skinned-newt` | preying on a TTX-laden newt is unverified; the raccoon's skin-avoiding evisceration technique is the real and better story |

### 6.2 Qualify as eggs / young / nestlings only

`golden-eagle` → `mountain-goat`, `bighorn-sheep`, `mule-deer-alpine` (neonates only — as drawn, the web teaches an eagle kills adult ungulates) · `bobcat` → `mule-deer-forest` (fawns, winter-stressed) · `great-horned-owl` → `red-fox-forest`, `raccoon` (kits/juveniles) · `raccoon` → `barred-owl`, `pileated-woodpecker`, `pacific-wren`, `northern-flying-squirrel`, `little-brown-bat` (nest predation; ADW notes raccoons "consume more invertebrates than vertebrates" — the current 14-species prey list badly overstates them) · `tree-squirrel` → `nuthatch`, `woodpecker` (nest depredation; move to `eatsOther`) · `garter-snake-forest` → `woodpecker`, `pacific-wren`, `spotted-towhee` (eggs/nestlings) · `roadrunner` → `gambels-quail` (eggs and chicks) · `rattlesnake` → `desert-cottontail` (juveniles) · `snapping-turtle` → `mallard-duck` (ducklings)

### 6.3 Add — missing edges that matter

- **Meadow:** `monarch-butterfly.eatenBy` is empty — add `praying-mantis`. Only ~5% of monarchs reach the last instar; ants, spiders, wasps, lacewings and mantids take eggs and larvae heavily, and at overwintering sites black-backed orioles and black-headed grosbeaks cause **over 60% of overwinter mortality**.
- **Meadow:** `western-screech-owl`, `coopers-hawk`, `red-fox-meadow`, `red-tailed-hawk` all have `eatenBy: None` — all are regularly killed by Great Horned Owls (already referenced in three other species' `eatenBy` but not on the roster), foxes by coyotes.
- **Meadow:** `bumblebee.eatenBy` omits its dominant predators — crab spiders ambushing at flowers, robber flies, and badgers/skunks digging up nests.
- **Wetland:** `great-blue-heron.eatenBy: None` while bald eagles and great horned owls kill adults and raccoons/crows/gulls take eggs. 12 of 25 wetland species are terminal nodes, including three small passerines and a salamander.
- **Alpine:** `alpine-butterfly` and `bumblebee-alpine` have no predator and nothing eats them, though six species list "insects" — add edges from pipit, white-crowned sparrow, bluebird, rosy-finch.
- **Alpine:** `marmot.eatenBy` omits `pine-marten` (ADW lists American marten among yellow-bellied marmot predators); `fox-alpine`'s diet text says "hares" but `eats` omits `snowshoe-hare`.
- **Coastal:** every apex predator has an empty `eats` — pelican→anchovy; cormorant→anchovy, sculpin, shore crab; harbor-seal→anchovy, sculpin; dolphin→anchovy, squid; guillemot→sand lance, sculpin; whale→benthic amphipods. And `anemone.eatenBy: None` is false — the leather star *Dermasterias imbricata*, nudibranchs and sea spiders all take it.
- **Desert:** `costas-hummingbird`, `elf-owl`, `phainopepla` have `eatenBy: None` **while their own `role` text names predators**. `tarantula.role` names the tarantula hawk wasp, which doesn't exist as a species — one of the most memorable desert interactions, described but not modelled.

### 6.4 — CRITICAL · `snowmelt-trout` shouldn't be a restoration goal

The overwhelming majority of alpine lakes and snowmelt pools above treeline were naturally **fishless**. Stocked trout are the single largest driver of alpine amphibian and aquatic-insect collapse, and non-native trout even depress alpine-nesting birds by removing emergent-insect subsidies. The game currently asks the player to build snowmelt pools for the frog and toad, then rewards them with a trout that eats the frog.

**Fix:** remove it, or reframe as a below-treeline species, with explicit text that the high pools must stay fishless.

### 6.5 Cross-biome edges with no in-biome referent

Nine edges point across biomes: `great-horned-owl`, `bobcat`, `red-fox-forest`, `barred-owl` → `cottontail-rabbit` / `meadow-vole` (meadow); `black-bear`, `raccoon` → `freshwater-fish` (wetland). Students can't complete those chains in the forest. Either mirror the prey into the forest roster — cottontail and vole are genuine eastern-forest-edge residents and would fix the forest's rodent gap — or route the predators through in-biome prey. `barred-owl` is the least defensible: a mature-forest species listed as a meadow-vole predator.

Also: `freshwater-fish.eatenBy` contains `black-bear` and `raccoon`, neither of which exists in the wetland roster.

---

## 7. `fact` fields that are false, garbled, or misattributed

This is the highest-risk field in the product — memorable, quotable, and what students repeat.

| species | current | problem | fix |
|---|---|---|---|
| `monarch-butterfly` (role) | toxins keep "nearly all birds and mammals away, so they have very few predators" | flatly wrong — see 6.3 | "chemical defence deters most, but not all — some birds have evolved to eat them anyway, and over 90% of caterpillars are killed by insect predators" |
| `red-fox-meadow` | pounces "facing magnetic **northeast**" | the cited Červený et al. study found **north** (340°–40°), 72.5% success, and **only when prey is hidden** in tall vegetation or snow | "facing magnetic north" + the hidden-prey caveat, which is the part that makes it meaningful |
| `barn-swallow` | "up to 1,000 individual beakfuls of mud" | the >1,000 mud-pellet figure is Cornell's for the **Cliff Swallow**, whose nest is entirely mud. Barn swallows build a smaller cup of mud pellets mixed with grass | drop the number or reattribute |
| `raccoon` | forepaws have "four times more touch receptors **than its eyes have light receptors**" | nonsense as written — a mammalian retina has ~10⁸ photoreceptors. Two real facts mangled together | "four to five times more touch receptors than most mammals' — and about two-thirds of its sense-processing brain is dedicated to touch" |
| `black-bear` | "the smallest newborns relative to adult size of any placental mammal" | the record holder is the giant panda (~1/900); black bear cubs are ~1/300 | "among the smallest…" or drop the superlative |
| `bobcat` | "in the eastern U.S. bobcat numbers rise and fall closely with the local cottontail supply" | this is the **Canada lynx–snowshoe hare** cycle relocated onto a dietary generalist | replace (bobcats take prey up to 8× their weight; they cache kills under snow). If you want the cycle, teach it with lynx and hare |
| `porcupine` | the fisher's fact, in its mythologized "flip them over" form | duplicates the `fisher` record, and the fisher's own version is the accurate one | give the porcupine its own: quills aren't thrown, they detach on contact, and their barbed tips carry a fatty antibiotic |
| `desert-bee` | "nest alone but gather by the thousands in **shared ground colonies**" | solitary bees form **aggregations of independent nests** — no shared colony, no queen, no cooperative brood care. Actively reinforces "all bees live in hives" | "each female digs and provisions her own nest — but thousands of these single mothers nest side by side in the same patch of bare ground" |
| `desert-tortoise` | "98% of their lives underground"; burrows "exceed 10 metres" | NPS and the Desert Tortoise Council both say **95%** (98% appears in NPS material as the fraction of hatchlings that die before maturity — two stats merged). Burrows are ~0.5–3 m, max ~9 m; >10 m is the **gopher tortoise** | 95%; "up to about 9 metres" |
| `anemone` | "its green glow comes from algae living inside its tissues" | the **glow** is the anemone's own green fluorescent proteins; symbionts supply sugars. Shaded individuals stay green with reduced symbionts | "its glow comes from its own fluorescent proteins, while algae living inside it photosynthesize and share sugars" |
| `migrating-whale` (`eatsOther`) | `['plankton']` | contradicts its own diet and role ("rolls on its side to suck up sediment"). NOAA describes benthic amphipods, not plankton. "Baleen whale = plankton" is exactly the misconception the gray whale disproves | `['benthic amphipods','mysids']` |
| `cormorant` | "cormorant feathers soak through on purpose" | oversimplified into a near-myth — plumage is **partially** wettable: the outer vane wets to cut buoyancy, an inner region stays dry and holds insulating air | "only the outer part soaks up water — that cuts buoyancy for diving, while an inner layer stays dry to keep it warm" |
| `dolphin` | "call each other by name" | Janik & King 2013 showed dolphins **copy another's signature whistle to address it**; a signature whistle is self-invented, not assigned. "Name" is press framing | "each dolphin invents its own signature whistle, and others copy that whistle to call it over" |
| `hermit-crab` | "line up by size and swap shells down the chain" | the synchronous queuing vacancy chain is documented in **terrestrial** *Coenobita*; marine *Pagurus* form asynchronous chains without the size-ordered queue | "when one hermit crab moves into a bigger shell, a smaller crab takes the one it left — and so on down a chain" |
| `praying-mantis` (role) | helps "regulate insect numbers" | contradicted by **your own cited source** (NC State Extension, "Challenging the Conventional Wisdom About Praying Mantids") — indiscriminate generalists, poor biocontrol. Your own `eats` list proves it: bumblebee, leafcutter-bee, painted-lady, red-admiral | reframe as a generalist ambush predator that eats pests and pollinators alike |
| `alpine-butterfly` | "pale red-and-black wings" | *P. smintheus* wings are **translucent white** with black and red markings — and the see-through quality is the memorable part | "its white, almost see-through wings carry red warning spots that tell birds it tastes foul" |
| `ptarmigan` | lives "entirely above treeline all year" | contradicted by its own habitat field ("winters in willow basins"); Cornell notes descent below treeline in severe weather | "the only North American bird that spends its whole life cycle in alpine habitat — it moves only to sheltered willow basins in the worst storms" |
| `mule-deer` (role) | "grazing herbivore… its grazing and droppings" | contradicts its own diet ("**browses** shrubs, forbs, twigs"). Grazer vs. browser is a grade 5–8 concept | "browsing herbivore… its browsing and droppings" |
| `pine-grosbeak` | "a plump, unhurried finch of the cold high forests" | not a fact — a description, duplicating the `role` | Pine Grosbeaks are irruptive, moving far south only when northern conifer seed and fruit crops fail |
| `freshwater-fish` | "minnow schools are the foundation that herons, otters and mink all depend on" | restates the `role`; overstated for otters, which favor larger slow fish and crayfish | fathead minnows spawn on the undersides of submerged objects, males guarding the eggs |
| `great-blue-heron` | "strike like lightning to **spear** a fish" | Cornell: herons "grab smaller prey in their strong mandibles" — spearing is the exception. Leading with it reinforces the commonest heron misconception | "strikes in a fraction of a second, seizing fish crosswise in its bill — only the largest are speared" |
| `northern-leopard-frog` | "erratic zig-zag leaps **straight back into the water**" | self-contradictory; the documented escape is unpredictable zigzags, often *away* from water into dense grass | |
| `painted-turtle` | "taking in oxygen through their **skin**" | the cited source describes **cloacal** respiration; the primary overwintering mechanism is anaerobic metabolism buffered by shell carbonate | "absorbing oxygen through the lining of the cloaca, and buffering the rest with their own shells" |
| `garter-snake-meadow` | "mildly venomous… completely harmless" | rare allergic reactions are documented; and the secretion comes from a **Duvernoy's gland**, so "venomous" is contested | "harmless to people, though a bite can itch" |
| `western-meadowlark` | "state bird **anthem** of six states" | the six is right (KS, MT, NE, ND, OR, WY); "anthem" is garbled | "state bird of six states" |
| `red-fox-forest` | "28 calls… each individual's voice is recognizable **to other foxes**" | 28 traces to Tembrock 1963; Newton-Fisher 1993 found 20. Vocal individuality is documented; *recognition by other foxes* is not | "more than 20 distinct calls, and each fox's bark has its own recognizable rhythm" |
| `dragonfly` | "up to 95% of the prey they chase" | your own cited NHM source says 97%, and the figure comes from a lab study of one genus chasing fruit flies | "in lab tests, dragonflies caught up to 95% of the prey they chased" |
| `water-strider` | "thousands of tiny hairs" | understated by orders of magnitude — microsetae are counted in the thousands **per square millimetre** | add "on every square millimetre" |
| `marmot` | "predation causes about 98% of summer deaths" | traces to one ADW sentence, and the same ADW account elsewhere says predation is "only a minor cause of mortality for colonial animals" | replace with the eight-month hibernation / half-body-weight loss fact — more teachable and better supported |
| `snapping-turtle` | "have almost no natural predators" | true for adults; eggs and hatchlings are heavily taken by herons, crows, raccoons, skunks, foxes, bullfrogs, water snakes and bass | add "**Adult**" |
| `tarantula` | "may live 25 years within a few feet of one burrow" | true of **females only** — males die 2–3 months after their final molt and spend their last season wandering (which is why hikers see them) | "A female may live 25 years within a few feet of one burrow — while males spend their final summer wandering the open desert" |
| `burrowing-owl` | rattlesnake-rasp mimicry stated as settled | rests on Rowe, Coss & Owings 1986; still a hypothesis, later work has questioned it, and Cornell's account doesn't mention it | hedge: "scientists think it may be copying one" |
| `woodpecker` | goldenrod galls | **true** (downies are major *Eurosta solidaginis* predators) but goldenrod is an old-field resource and this biome has no goldenrod. The causal framing is also off — the constraint is weight on slender stalks, not bill size | move to the meadow biome, or reframe |
| `elk-forest` | 85% of winter wolf kills, feeds 12 scavenger species | **true of Yellowstone**, a wolf-driven Rocky Mountain system. Unanchored inside a logged eastern woodland with no wolves and no scavengers | see 2.2 |
| `banana-slug` | seed dispersal | fungal **spore** transport is well documented (Kitabayashi et al. 2022); the seed-dispersal paper is titled "The *Potential* for…" and other work shows gastropods destroy many ingested seeds. Your cited NPS page mentions neither | lead with spores: "fungal spores survive a trip through a banana slug's gut, so every slug trail helps spread the mycorrhizal networks that feed forest trees" |
| `sea-star` | Paine's keystone experiment | correct, but omits the modern half: since 2013 **sea star wasting disease** has killed ochre sea stars along thousands of km and mussel beds measurably expanded — an unplanned continent-scale replication | for a game about restoring a scoured coast, that's the most relevant fact available |
| `song-sparrow` | "up to about 20 different tunes" | **[unverified]** — published repertoires are 5–13 types (mean ~9), and this isn't in Cornell's current Cool Facts | "8–10 song types, each sung with many variations" |
| `mussel` | "filters several liters of seawater an hour" | **[unverified]** at species level; bivalve clearance rates are strongly size- and temperature-dependent | add a size qualifier or drop the number |
| `clam` | growth-ring aging | true in outline, but *Leukoma staminea* rings record growth interruptions (spawning, storms, exposure) and aren't reliably annual | "growth rings record the clam's good and bad seasons — biologists use them to estimate its age" |
| `harbor-seal` | "surfaces to breathe without fully waking" | **[unverified]** for *Phoca vitulina* specifically | "harbor seals can sleep in the water as well as on shore" |
| `tidepool-crab` | "turn cannibal after molting" | **[unverified]** at species level | soften or source. Better unused fact: *P. crassipes* is semi-terrestrial and breathes air out of water |
| `alpine-chipmunk` | "up to 3,900 m" | **[unverified]** to a primary source; moot if swapped per 2.4 | |
| `mule-deer-alpine` / `mule-deer` | stotting "clears obstacles"; metatarsal gland "alerts every nearby deer at once" | the gland is real (Müller-Schwarze) but reach and instantaneity are overstated, and stotting and the gland are two separate things fused into one sentence | "when a mule deer bounds away it releases a scent from a gland on its hind leg that warns other deer of danger" |
| `elf-owl` | "the world's smallest owl" | true by mass; Cornell says "smallest raptor," and the long-whiskered owlet is shorter | "the world's lightest owl" |
| `pelican` | 65 ft plunge | sits at the top of the cited range | "up to about 60 feet" |
| `annas-hummingbird` | "about 27 m" dive | oddly precise and unsourced; published dives average ~30 m | ~30 m |
| `coyote` | "most vocal wild mammal in North America" | widely repeated, unquantified | lead with the second half — the **"beau geste" effect**, where a pack sounds like many more |
| `bumblebee-alpine` | tongue shortening "from 1966 to 2014" | broadly right but implies continuous measurement, and the finding covers two species | "between the 1960s and today, this bee's tongue has grown measurably shorter as its deep alpine flowers have declined" |
| `rough-skinned-newt` | "enough tetrodotoxin to kill several adults" | ambiguous | add "human" |
| `porcupine` | "strict herbivore" | famously gnaws bones and shed antlers for sodium | "almost entirely herbivorous, but gnaws bones and antlers for minerals" |
| `ptarmigan` | "willow is the sole winter food" | predominantly, but includes alder, birch and other shrubs | "almost entirely willow buds and twigs" |
| `nuthatch` (role) | "bark-dwelling insects, including **tent caterpillars**" | tent caterpillars build silk tents in branch forks; not bark-dwelling. (The bill-sweeping fact is real — keep it) | |
| `kangaroo-rat` | "deep burrow systems" | *D. merriami* is the **shallow**-burrowing member of the genus; deep mounded systems are *D. spectabilis* | "shallow burrows under shrubs, plugged by day" |
| `alpine-butterfly` (shelter) | "overwintering as eggs" | the first-instar larva develops fully **inside the egg** within a month and overwinters there, hatching at snowmelt — more accurate and more interesting | |
| `american-goldfinch` (shelter) | "lashed **high** in a shrub" | goldfinch nests are typically 4–10 ft up | |

**Overstated `role` claims:**

- `meadow-vole` "keystone prey species" — misuses the term. A keystone species has effect *disproportionate to its abundance*; voles are the textbook opposite. Use "foundational" or "basal."
- `pika` "the engine of the alpine food web" — pikas are an **indicator/sentinel** species for alpine climate change, not the system's energetic engine. Its `minHealth: 14` also implies pikas colonize near-bare ground when they're among the most habitat-conservative alpine mammals.
- `bobcat` "keystone mesopredators" — influential generalist, not an established keystone. The passage also says they "sit below cougars and wolves," neither of which exists in the game, while the data has them eaten by an owl and a fisher.
- `beaver` "habitat that most other marsh species depend on" — overstated for **emergent marsh** specifically; bittern, marsh wren, blackbird and crane are cattail/sedge specialists. Beaver ponds are a distinct habitat type.
- `river-otter` "otters keep fish and amphibian numbers in check" — not documented, and this is the specific claim historically used to justify otter persecution at fisheries. The same sentence already gives the better framing (indicator of connected, prey-rich water).
- `northern-leopard-frog` "a wide-mouthed generalist that eats almost any small animal it can swallow, from insects to smaller frogs" — this is the **American Bullfrog's** description transplanted. Leopard frogs are primarily invertebrate feeders.
- `snowshoe-hare` "numbers cycle roughly every ten years" — the 10-year cycle is a **northern boreal** phenomenon; in southern montane forests including the Rockies, fluctuations are dampened and often non-cyclic.
- `black-oystercatcher`, `sea-otter` — both keystone stories are asserted in prose and unbuildable in mechanics (see 5, coastal).
- `desert-tortoise` — its ecosystem-engineer role is asserted (burrows shelter snakes, lizards, rodents, burrowing owls) but **no species requires it**; `burrowing-owl` requires a generic `burrow-mound`. Same problem for `gila-woodpecker` → `elf-owl`.
- `role` text names predators that don't exist in the game: **desert** — bobcats ×4, hawks/raptors/kestrels ×9, badgers, shrikes, pygmy-owls; **alpine** — cougars ×4, coyotes ×3, falcons, great horned owls; **wetland** — snakes ×2; **coastal** — foxes, coyotes, sharks, orcas, octopus, falcons. Students read that hawks eat the jackrabbit, then find no hawk to build.

---

## 8. Species to add — missing functional groups

Ranked by how many dangling edges each one closes.

### Every biome — decomposers and detritivores

The whole point of 1.2. Minimum viable set:

| biome | add |
|---|---|
| meadow | earthworm, dung beetle, carrion beetle |
| forest | a saprotrophic fungus (turkey tail / oyster mushroom) **and** a mycorrhizal fungus; springtail/millipede/isopod |
| wetland | an amphipod shredder (*Hyalella azteca*) and a freshwater mussel (Unionidae — also a keystone water-quality species) |
| desert | subterranean termite (*Gnathamitermes* / *Heterotermes* — these process the majority of dead plant litter in hot deserts) and a darkling beetle (*Eleodes*, with its headstand defense) |
| alpine | springtail or alpine soil micro-arthropod |
| coastal | **Beach Hopper** *Megalorchestia californiana* — eats kelp wrack, eaten by plover/sanderling/gull. The wrack line is the beach's decomposition engine and `kelp-wrack` already exists as an object that **nothing eats** |

The forest already has `mushroom-log`, `mushroom-ring` and `mushrooms` as a resource, and two species (`northern-flying-squirrel`, `banana-slug`) whose ecology is *defined* by fungi — but fungi never appear as an organism.

### Scavengers

Zero in meadow, forest, wetland, desert, alpine. `carrion` appears in 11 species' diets with nothing producing or specializing on it.

- **Turkey Vulture** (*Cathartes aura*) — meadow, forest, desert
- **Common Raven** (*Corvus corax*) — desert and alpine. In the desert it does triple duty: the missing scavenger, the **missing desert tortoise predator** (human-subsidized ravens are the dominant source of juvenile tortoise mortality and the focus of federal management), and the best human-impact story in the game — roads, landfills and powerlines raise raven numbers, which raises tortoise mortality.
- **American Crow** — wetland nest predator

### Coastal — the food web has no base

1. **Kelp** (*Macrocystis pyrifera* / *Nereocystis luetkeana*) as a living object **and** a species. Replace the `coral-garden` object with it (see 9).
2. **Purple Sea Urchin** *Strongylocentrotus purpuratus* — herbivore, eats kelp, eaten by sea otter and sea star. **Without it the otter/urchin/kelp trophic cascade — which the sea otter's `role` states verbatim — is unbuildable.**
3. **Forage fish:** Northern Anchovy *Engraulis mordax*, Pacific Sand Lance *Ammodytes personatus*, tidepool sculpin *Oligocottus maculatus*. Six species eat "fish"; **there is not one fish in the coastal biome.**
4. **Grazers:** limpets, chitons, Black Turban Snail *Tegula funebralis* (also fixes the hermit crab shell dependency). The sea star's diet names limpets, chitons and snails; the turnstone's names limpets; none exist.
5. **Barnacles** — named in three diet fields, absent, and the other half of the classic zonation lesson.
6. **Pacific Mole Crab** *Emerita analoga* — filter feeder, sanderling/plover prey, named as a string literal in two diets.
7. **A peregrine falcon or bald eagle** — every coastal bird has `eatenBy: None`.

### Meadow

- **Coyote** — the defining North American meadow mesopredator, *explicitly named* in the badger's fact and the mule deer's role, absent from the roster. Gives fox, badger and deer real predators.
- **Great Horned Owl** — already referenced in three `eatenBy` lists, not on the roster. Fixes the apex gap for both owls and both hawks.
- **Spiders** — crab spiders, orb weavers, wolf spiders. An entire dominant predator guild missing, and the primary food of every insectivorous bird here.
- **Aphids** — the lady beetle's whole ecology depends on them; referenced in its diet and hint, exist as neither species nor object. Its food chain has no base.
- **A frog or toad** — the garter snake eats amphibians, the biome has two water objects, and there's no amphibian.
- **Pocket gopher** (named in the badger's diet), **shrew** (named as barn owl prey), **a bat**, **a hummingbird or hawkmoth**.

### Forest

- **Deer Mouse** *Peromyscus* — the most abundant mammal in eastern forests, the prey base for nearly every predator here, and the cleanest fix for the cross-biome edges in 6.5. `mice`, `voles` and `shrews` are phantom food in five predators' lists.
- **Blue Jay** — the primary long-distance acorn disperser, which drove the northward re-forestation of oaks after glaciation. The biome sells oak restoration and omits the animal that does it.
- **Insects of any kind** — no pollinators, no herbivorous insects, no wood-borers. Caterpillars are the energy base of the entire forest songbird food web, and six species here depend on an insect layer the student can't build. `garden-arch` even advertises "feeds passing pollinators."
- **A diurnal raptor** — all three forest predatory birds are owls, so the game contains no daytime predation event at all.
- **Migratory songbirds** — the biome description is literally "the birds have moved on," and there are no warblers, vireos or thrushes: the guild most affected by logging and the one whose return would best dramatize the goal.

### Wetland

- **Crayfish** (*Faxonius* sp.) — the most-cited food in the biome (5 predators) with no card. Also fills the scavenger slot.
- **Northern Watersnake** *Nerodia sipedon* or Common Gartersnake — **two `role` fields cite snakes as key predators and no snake exists.** The missing mid-web link for frogs, salamanders, minnows and fledglings.
- **Raccoon** *Procyon lotor* — cited in `freshwater-fish.eatenBy` but absent; the dominant nest predator of both turtles and marsh birds, and the single biggest missing story in a wetland restoration game.
- **Northern Harrier** *Circus hudsonius*.
- **Chironomid midges / mosquitoes** — the emergence pulse that feeds blackbirds, swallows, dragonflies and fish, and the reason wetlands matter to terrestrial food webs. The dragonfly card advertises eating mosquito larvae that don't exist.
- **A toad, a green frog, a newt** — `dragonfly-pond` explicitly promises newt breeding habitat.

### Desert

- **Harvester ants** *Pogonomyrmex* — dominant seed harvesters, major soil turners, and the horned lizard's obligate prey.
- **Harris's Hawk** (cooperative pack hunting — a signature Sonoran story) and **American Kestrel** (secondary cavity user, closing the Gila Woodpecker loop). The `apex-predator` tier is currently vacant and raptors are named nine times in prose.
- **Couch's Spadefoot** *Scaphiopus couchii* — estivates 9–11 months underground and emerges within minutes of monsoon thunder to breed in pools that last days. The single best teaching species for ephemeral desert water, and the biome has no amphibian, no ephemeral pool object and no rain event.
- **Southern Grasshopper Mouse** *Onychomys torridus* — carnivorous, howling, and **physiologically resistant to bark scorpion venom**. Also gives the scorpion a real predator.
- **Sidewinder** *Crotalus cerastes* — sand locomotion.
- **Tarantula Hawk** *Pepsis grossa* — named in the tarantula's own role, absent.
- **Lesser Long-nosed Bat** *Leptonycteris yerbabuenae* — the saguaro and agave pollinator. The `nectar-feeder` object already promises "nectar bats," and `agave-rosette` ("whose tall bloom feeds desert pollinators") is currently pollinated by nothing.

### Alpine

- **Cougar** *Puma concolor* and **Coyote** — four `role` fields invoke cougars and three invoke coyotes; neither exists, so the ungulates are top-down unregulated.
- **Prairie Falcon or Peregrine** — the rosy-finch's role names falcons.
- **Common Raven** — the real alpine scavenger and nest predator.
- **Golden-mantled Ground Squirrel and Montane Vole** — the numerical backbone of alpine predator diets, currently `eatsOther` strings for fox, marten, ermine and eagle.
- **A cavity excavator** (Northern Flicker / American Three-toed Woodpecker) — two cavity-obligate birds with no excavator and no snag object.
- **Map lichen and a cushion plant** (moss campion, alpine avens) — `lichen-boulder` and `moss-cushion` exist as scenery but no lichen or cushion plant is an organism. Crustose lichens grow on the order of a **millimetre per decade**, which is the single best vehicle for teaching the extreme slowness of alpine recovery — and it's absent from a biome whose premise is a trampled slope.

---

## 9. Habitat objects and copy

### CRITICAL

**`coral-garden` + the `coral` resource (coastal)** — "transplanted coral rubble that grows back into a living reef." **There are no shallow reef-building corals in the temperate NE Pacific.** Reef corals need ~23–25 °C; California nearshore runs ~11–21 °C, and the only California corals are azooxanthellate deep-sea taxa below ~50 m. Replace with a living `kelp-forest` object (which the roster urgently needs) or a surfgrass *Phyllospadix* bed. Delete `coral` from resources.

**`dune-grass` (coastal)** — "deep-rooted grass that anchors the dunes and **hides shorebird nests**." Wrong twice: no species named (on the Pacific coast the default referent is the **invasive** *Ammophila arenaria*), and shorebird nests are **not** hidden in grass — plovers and oystercatchers nest in bare open scrapes. Name it American dunegrass *Leymus mollis*, drop the shorebird clause, and remove it from all 17 requirement lists where it doesn't belong.

**Meadow plant palette — the "native restoration" plants are mostly European non-natives.** The `restorationGoal` says "replant grasses and wildflowers" and objects are labelled native, but:

| object | is | status |
|---|---|---|
| `daisy-patch` "cheerful oxeye daisies" | *Leucanthemum vulgare* | **listed noxious weed** in WA/MT/NM; invasive per the Invasive Plant Atlas |
| `foxglove` | *Digitalis purpurea* | non-native, toxic, invasive in the PNW |
| `poppy-patch` "bright field poppies" | *Papaver rhoeas* | European agricultural weed |
| `clover-patch` "clover and trefoil" | birdsfoot trefoil *Lotus corniculatus* | invasive |

The game **awards health points for planting invasives while telling students they are restoring native meadow.** Swap to natives (California poppy *Eschscholzia californica*, native asters and goldenrod, *Penstemon*, native *Trifolium*), or label the non-natives explicitly. Same issue in alpine: `clover-patch` is offered on a damaged alpine slope, where *Trifolium* of this kind are introduced lowland forage legumes — replace with *Trifolium dasyphyllum* or *Astragalus alpinus*.

### HIGH / MEDIUM

- **`rock-pile`** — "insects, lizards, and **pika** approve." Appears in **meadow, forest, desert and alpine**. Pikas are alpine talus obligates and a climate-indicator species; they occur in none of the first three. Also, lizards are largely absent above treeline. Fix per biome.
- **`mossy-path`** — "the forest approves" appears in the **wetland, desert and coastal** object lists. Leftover forest copy.
- **`wooden-bridge`** — "place it on open water to cross your rivers and lakes" appears in the **desert**, which has no standing water.
- **`monterey-cypress`** — *Hesperocyparis macrocarpa* is native to **only two relict groves** on the Monterey Peninsula and is planted/naturalizing far outside them. Offering it as generic coastal restoration teaches that horticultural convention equals native restoration. Use Shore Pine or Sitka spruce, or label it "planted, not native here."
- **`oyster-bed`** — names no species. The Pacific native is the Olympia oyster *Ostrea lurida*, an active restoration target; *Magallana gigas* is introduced. A restoration game should say which one the player is building.
- **`eelgrass-bed`** — name the species (*Zostera marina*); "sea geese" is informal.
- **`pearl` resource + `pearl-display`** — "the pride of a restored coast." Pearls come from wild-harvesting or culturing bivalves; there is no natural pearl fishery on the Pacific rocky coast, and rewarding pearl collection contradicts the leave-no-trace framing the path objects establish.
- **`heron-rookery`** — "a tall marsh snag crowned with **a** stick nest." A rookery is a colony of many nests, typically in live trees.
- **`quaking-aspen` (alpine)** — "white-barked aspen whose golden leaves shiver in the **alpine** wind." Aspen does not grow above treeline.
- **`berry-bush`** — "thornless native berry bush… songbirds, rabbits, deer, and **bears** all visit" appears in the meadow, which has no bear. Most native North American *Rubus* are also thorny.
- **`oak-tree`** — "squirrels and jays will thank you," and neither a tree squirrel nor a jay is on the meadow roster. Bigger missed hook: oaks support ~500 Lepidoptera species, the highest of any North American genus — a much better lesson than acorns.
- **`dragonfly-pond` (wetland)** — mentions newts; there is no newt in the biome.
- **`nectar-feeder` (desert)** — advertises "nectar bats"; no bat exists.
- **`planter-box` (desert)** — "brimming with flowers" (unspecified ornamentals) contradicts the stated goal of replanting native cactus and brush.
- **Fantasy objects with health values, listed inline with real habitat:** `frostflower-planter`, `dew-lantern`, `stormglass-lantern`, `sunstone-cairn`, `crystal-cairn`, `sea-glass-lantern`. `frostflower-planter` is currently a **required** object for the ptarmigan. At minimum, visually separate decorative from ecological objects so students don't infer that frostflowers are a real plant.
- **`nesting-bluff` and `driftwood-pile` have healthValue 2** vs 5–8 for comparable habitat objects — and `nesting-bluff` is the coastal biome's only correct cliff-nesting habitat. Looks like a data-entry inconsistency.
- **Oaks are decoupled from acorns (forest).** `acorns` appear in nine species' diets and in the biome resource list, but `oak-tree` is required by exactly one species — `barred-owl`, which has no oak association at all. Inverted mapping.
- **Rock-object redundancy (desert).** `rock-pile`, `rock-crevice`, `shaded-rock-shelter` and `sunstone-cairn` are four near-identical objects, while the ecologically meaningful axis — **thermal refuge depth** (surface cover → crevice → deep burrow) — isn't represented. Consolidating them into that ladder would teach the single most important fact about desert shelter: it's almost entirely about escaping heat.
- **Deadwood is under-modelled (forest).** One snag object serves six-plus cavity-dependent species with wildly different cavity-size needs, and nothing distinguishes an excavator-created cavity from a natural one — which is exactly the distinction the `woodpecker`/`pileated-woodpecker` (excavators) vs `nuthatch`/`wood-duck`/`flying-squirrel`/`barred-owl` (secondary users) records set up. The keystone-cavity story is written in the `role` text and absent from the mechanics.
- **Cryptobiotic soil crust (desert)** — the biome premise is an **overgrazed** flat, and the first thing hoof traffic destroys is the biological soil crust (cyanobacteria, lichens, mosses) that fixes nitrogen, holds moisture and blocks weed germination. It should be a recoverable ground layer with a long recovery time, probably a prerequisite for the plant objects. Related: there is **no grazing agent and no grass** — three herbivores list "grasses" in `eatsOther` with no grass object to build. Consider buffelgrass / red brome and the grass–fire cycle, the leading modern threat to the Sonoran Desert.
- **No trampling or timescale representation (alpine).** The premise is a trampled slope, but nothing conveys that alpine turf recovery takes decades to centuries. Paths and fences exist as objects and no species requires or benefits from them, so the "stay on the trail" lesson is never mechanically reinforced.

---

## 10. Sequencing and threshold problems

**Successional order is inverted in the wetland.** `beaver` — described in its own `role` as the ecosystem engineer creating "habitat that most other marsh species depend on" — is gated at `minHealth: 70` and `rarity: rare`, so it arrives *after* 15 species that supposedly depend on it (water strider unlocks at 12, chorus frog at 30, dragonfly at 35). In a real restoration the beaver is an early driver, not a trophy.

**Fix:** order unlocks along a real restoration trajectory — water and plants → invertebrates and fish → the beaver → the predators its ponds support. Then the biome teaches succession instead of just gating content.

Related: `pika`'s `minHealth: 14` implies it colonizes near-bare ground, when it's among the most habitat-conservative alpine mammals.

**Trophic thresholds are otherwise well-shaped** — apex predators average minHealth 66.8 vs herbivores at 42.2, which is the right direction and is the game's best existing mechanic. Worth protecting when you rewire requirements.

---

## 11. Citations

243 citations, 1.62 per species. **40 species have fewer than 2 sources.** Domain mix is good — ADW (82), All About Birds (59), Audubon (19), NPS/FWS/USGS/USDA-FS (24), IUCN (3) — with only 2 Wikipedia citations.

Errors found: 6 stale-name URLs and 1 wrong-animal URL (see §4). Recommend a link-check pass and a minimum of 2 sources per record, since the guide sells this as "evidence-based, not answer-based."

---

## Suggested order of work

1. **Pick a region per biome** (§2). Everything else depends on which species survive.
2. **Fix the false facts** (§7). Highest misconception risk per unit of effort, and independent of everything else.
3. **Rewire requirements onto the 50 unused objects** (§1.1, §5). Biggest single quality jump; about 60% needs no new content.
4. **Add water as a real requirement** (§1.4). Fixes the entire coastal biome and most amphibians.
5. **Add decomposers, scavengers and primary producers** (§1.2, §1.3, §8). Closes the biggest ecological *and* standards gap simultaneously.
6. **Prune and qualify the food-web edges** (§6), adding the `stage` annotation from §1.6.
7. **Fix the names and taxonomy** (§3, §4). Mechanical, scriptable.
8. **Object copy and non-native plants** (§9).
9. **Resequence the wetland** (§10).
10. **Update the educator guide** to include the `animals` requirement column (§0).

---

*Audit performed against the data files as of the repository state on 9 August 2026. Items marked **[unverified]** need a second look before you act on them — I flagged them rather than guessing.*

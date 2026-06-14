# Wild Willows 🌿

A cozy nature-restoration life sim. You've set up camp at the edge of a damaged nature preserve: gather fallen materials, craft and plant habitat, shape the land biome by biome — and real animals return when the habitat truly supports them.

**Harper is the source of truth.** Player progress, inventory, chests, crafting, placements, terrain, biome health, ecological balance, animal discoveries, comfort levels, tool upgrades, biome unlocks, and play metrics all live in Harper and are validated server-side. The browser never computes game state on its own.

Built with TypeScript, React + Vite (UI shell), Phaser 3 (world), and Harper v5 (database, API resources, seeded data, static hosting). All art — terrain, objects, animals, the player, and journal thumbnails — is procedurally generated from simple shapes at boot, so the game ships with zero asset files.

---

## Run it locally

Prerequisites: Node 20+, Harper v5 (`npm install -g harper`).

```bash
npm install
npm run build        # builds resources.js (esbuild) and web/ (vite)
harper run .         # or: harper dev .  (watches for changes)
```

Open **https://localhost:9926/** (Harper local dev uses a self-signed certificate — accept the browser warning). Choose **New Game**, customize your caretaker (skin, hair color, hairstyle, build, outfit, hat), pick a name and passcode, and begin. **Load Game** signs back into any save from any browser; the last save on a device also gets a one-click **Continue**. An interactive tutorial walks new caretakers through the loop (skippable; progress saved to Harper).

> **Keyboard required.** Wild Willows is a keyboard game (WASD/arrows to roam, letter keys for panels, number keys for tools), so it gates to devices with a keyboard. A computer (any mouse/trackpad) is allowed; a touch-only phone/tablet sees a "connect a keyboard" screen until a key is pressed.

Frontend hot-reload during development:

```bash
harper run .         # terminal 1 — backend on :9926
npm run dev:web      # terminal 2 — vite on http://localhost:5173, proxies API to Harper
```

After changing `server/resources.ts`, run `npm run build:server` (or `npm run dev`, which rebuilds then starts `harper dev .`). A scripted end-to-end API check lives at `scripts/smoke-test.sh`.

> **Editing `data/*.json` live:** the server inlines the definition JSON for boot-time reconciliation, so after renaming/removing definition records, rebuild `resources.js` and restart Harper. Write data files atomically (temp + rename) so the live data loader never reads a half-written file.

## Deploy to Harper / Fabric

```bash
npm run build
harper deploy \
  project=wild-willows \
  package=. \
  target=<your-instance-url> \
  username=<HARPER_USERNAME> \
  password=<HARPER_PASSWORD> \
  restart=true
```

Credentials can also go in `CLI_TARGET_USERNAME` / `CLI_TARGET_PASSWORD`. The `dataLoader` seeds all definition tables on every deploy (player data is never touched). Admin credentials are used only by the CLI — they never appear in the frontend.

---

## Content at a glance

- **6 biomes** — Willow Meadow, Old Hollow Forest, Rushwater Wetland, Redstone Scrubland (desert), Graywind Heights (alpine), Pelican Shore (coastal). Four are explorable on foot today; alpine + coastal are seeded and signposted "coming soon."
- **132 animals** — exactly **22 per biome**, each with diet, shelter, a real-world fact, and habitat return requirements.
- **103 habitat objects** and **96 recipes** across plants/trees, habitat, structures & decor, paths, storage, camp comforts, and restoration kits.
- **23 gatherable resources**, including biome-exclusive ones (e.g. geode and agave nectar only in the desert).
- **4 tools** with deep upgrade tracks (basket/shovel/watering can each have 4 tiers; the field journal has 6).
- Every biome has **at least 3 plantable tree types** plus its own distinct plants, palette, and animals.

## Database schema (`schema.graphql`)

Definition tables, seeded from `data/*.json` by the built-in dataLoader: `Biome` · `Animal` · `ResourceType` · `Recipe` · `HabitatObject` · `ToolDef`.

Per-player state tables: `Player` (inventory, crafted items, `craftedEver`, tool tiers, unlocked biomes, position, tutorial step, and a `metrics` blob) · `BiomeState` (health, balance, returned count, unlocked) · `Chest` · `Placement` · `Discovery` (returned animals: comfort, observations, why they returned) · `NodeState` (resource node regen timestamps) · `TerrainTile` (tilled / watered / open-water tiles).

Tables are deliberately **not** exported over REST — everything flows through the custom resources below. On boot the server **reconciles** the seed tables against the definition JSON, deleting any orphaned records left by a rename/removal (Harper's loader only upserts, so this prevents stale duplicates like an old "Water Restoration Kit").

## API resources (`server/resources.ts` → `resources.js`)

| Endpoint | Does |
|---|---|
| `GET /GameData/` | All static definitions + character appearance options |
| `POST /CreatePlayer/` · `POST /LoginPlayer/` · `POST /DeletePlayer/` | Create / load / delete a save (name + passcode) |
| `GET /GameState/<playerId>` | Full state snapshot |
| `POST /CollectResource/` | Gather from a node (cooldown, basket capacity, tool-tier yield 1–4) |
| `POST /ChestTransfer/` | Deposit / withdraw with capacity enforced |
| `POST /CraftItem/` | Craft from basket + all chests; restoration kits are one-time |
| `POST /PlaceObject/` · `POST /RemoveObject/` | Place / pick up objects → recalculates the biome |
| `POST /Plant/` | Plant into a watered bed; the plant grows in over time |
| `POST /Terraform/` | Shovel digs beds, watering can waters (1 water) or floods into open water; dry biomes can't be flooded |
| `POST /UpgradeTool/` | Tool upgrades (materials + biome-progress gates) |
| `POST /ObserveAnimal/` | Record a field-journal observation |
| `POST /RecalcBiome/` | Re-evaluate health / balance / animal returns (also fires when a plant matures) |
| `POST /SyncPlayer/` | Persist position / area changes (seeds an area's starting terrain on first entry) |
| `POST /Heartbeat/` | Accrue play time + session counts while the game is open |
| `GET /Metrics/` · `GET /Metrics/<playerId>` | Analytics dashboard (see below) |
| `GET /BiomeSnapshot/<playerId>` | Generated SVG "postcards" of each area |
| `POST /DevTools/` | Developer-only testing helpers (restricted to one save) |

## How animals return

On every change the biome is recalculated:

- **Health** = 5 baseline + the health value of placed objects + tended soil/open-water bonuses, on a gentle curve toward 100. The ground visibly greens (or warms, in the desert) as it rises.
- **Ecological balance** climbs as animals actually return, so a thriving food web is what raises it.
- Each animal has **return requirements**: minimum health, sometimes balance, specific habitat objects, sometimes water features, and sometimes other animals already back (predators wait for their prey). There are intentional **easy starter animals** in every biome, with the rest hardened to need a real mix of *planting and crafting*.
- **Water-dwellers need terraformed water.** Shaping open-water tiles with the watering can forms ponds, **lakes** (a large connected body), and **rivers** (a long connected channel). Animals like the snapping turtle (lake), belted kingfisher (river), and bittern (open water) only return once you've shaped the right water.
- **Plants must mature.** A freshly planted habitat is a sprout and does **not** count toward an animal's requirement until it has fully grown in — and the moment it matures the biome re-checks, so anything now eligible arrives on its own.
- Animals return **one at a time** per change, so a biome fills with visitors gradually rather than all at once.
- Returned animals get a **comfort level**; remove key habitat and they become "rarely seen," but they're never owned, captured, or lost like pets.

## Biomes, restoration kits & progression

Restore each biome to unlock the next. There's **one restoration kit per area** (each craftable only once) plus health/animal thresholds:

| Unlock | Requirements |
|---|---|
| Old Hollow Forest | Meadow 80% health · 5 meadow animals · Meadow Restoration Kit |
| Rushwater Wetland | Forest 75% · 10 forest animals · Wetland Restoration Kit |
| Redstone Scrubland (desert) | Wetland 80% · 5 wetland animals · **30 total animals** · Scrubland Restoration Kit |
| Graywind Heights (alpine) | Desert 80% · Alpine Restoration Kit |
| Pelican Shore (coastal) | Alpine 80% · Migration Path Marker |

Areas connect by trail gates, and you spawn at the correct edge when you travel. **Rushwater Wetland opens partly pre-shaped** — channels, a pond, and watered beds are seeded the first time you enter, so it reads as a wetland immediately. **Redstone Scrubland** is dry by design: you can ready soil beds for planting but **cannot flood it** into open water, and it has exclusive resources (geode, agave nectar) feeding desert-only crafts.

## Tools

Four tools, each upgraded with materials gated on biome progress. Higher tiers gather more at once (tier 1→1 … tier 4→4):

- **Gathering Basket** (4 tiers) — carry capacity 80 → 380.
- **Shovel** (4 tiers) — prepare beds, shape mud banks/burrows, dig more per swing.
- **Watering Can** (4 tiers) — collect 1 → 4 water per fill.
- **Field Journal** (6 tiers) — each tier unlocks the **full field entries and return hints for the next area** (meadow → coastal). Until you upgrade, that area's journal shows the animal and its comfort but locks the diet/shelter/fact and detailed hints behind an "upgrade your field guide" prompt.

## Crafting, planting & terraforming

Crafting needs no station — press **C** anywhere; it draws from your basket first, then all linked chests, atomically. The crafting menu has two filter dropdowns: **Place** (by biome the item can go in) and **Type** (Plants & flowers / Habitat / Structures & decor / Paths & fences / Storage / Camp comforts / Restoration kits). Each recipe shows the areas it can be placed in, and one-time kits show a "Crafted ✓" state once made.

Many items can also be **planted**: dig a soil bed with the shovel, water it, then plant a seed/sapling that sprouts and grows in over time. Every biome has 3+ plantable trees and its own flowers/grasses. Crafted items each get a small deterministic visual variation so no two look identical.

## Resource nodes & water

Resource nodes are scattered per area, with the mix **randomized per player** (deterministic, so they stay put) while guaranteeing every biome resource appears. A **water source is guaranteed near where you spawn** (skipped in the dry desert), and new saves start with extra water so early bed-watering isn't a grind. You can **build anywhere** — if you place or plant on a regen spot, the node simply **relocates** to the nearest free tile, keeping its regrowth timer. Nodes regenerate on a per-node timer.

## Field journal

Grouped by biome, the journal shows each animal's actual **sprite thumbnail** (a colored creature for returned animals, a silhouette for ones still to come), comfort level, why it returned, and — once the field guide is upgraded for that area — full diet/shelter/habitat notes and exact return hints.

## Metrics & analytics

A client **heartbeat** accrues play time and counts sessions while the game is open (paused when the tab is hidden). The read-only **Metrics** endpoint surfaces it for dashboards:

- `GET /Metrics/<playerId>` — one player's play time, engagement intensity, recency/status, progression, per-biome health, and a rendered **SVG snapshot** of each unlocked area (ground tinted by health, terrain and placed objects drawn in).
- `GET /Metrics/` — global **audience** (active/new buckets), **engagement**, **retention** (returning players), **progression**, an **activation funnel** (created → collected → crafted → placed → attracted animal → unlocked 2nd biome), summed action totals, and a per-biome breakdown.
- `GET /BiomeSnapshot/<playerId>` — just the area images, as base64 data-URIs + raw SVG.

## Saves & developer tools

Each save is a name + passcode pair (demo-grade; passcode never sent back to clients). **Settings → Lock this save** logs out and clears the remembered session so reopening requires the passcode. A hidden **developer panel** (backtick key, restricted to the developer save and enforced server-side) offers testing helpers: reseed/clear an area's terrain, grant chosen amounts of each resource, max all tools, unlock all biomes, and set biome health.

## Controls

WASD / arrows to move · **E** / Space to interact · **1–3** select tools · **J** journal · **C** crafting · click animals to observe · Shift+click a placed object to pick it up · Esc closes menus / cancels placement · **`** (backtick) opens the developer panel on the dev save. Gathering spots glow, the nearest interactable gets a pulsing ring, pickups animate into your basket, and the activity feed narrates what you just did. The **?** button opens How to Play with the full reference.

## Notes & simplifications

- Lightweight saves instead of real auth — swap in hashing + sessions/roles before anything public. Game endpoints are open while the underlying tables are not.
- Animal behavior is gentle wandering + click-to-observe; no seasons/weather/day-night yet.
- Harper subtlety: conditional searches inside one transaction don't see that transaction's own writes, so endpoints pass fresh records into recalculation explicitly (see comments in `server/resources.ts`).

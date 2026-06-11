# Wild Willows 🌿

A cozy nature-restoration life sim. You've set up camp at the edge of a damaged nature preserve: gather fallen materials, craft habitat objects, rebuild habitats biome by biome — and real animals return when the habitat truly supports them.

**Harper is the source of truth.** Player progress, inventory, chests, crafting, placements, biome health, ecological balance, animal discoveries, comfort levels, tool upgrades, and biome unlocks all live in Harper and are validated server-side. The browser never computes game state on its own.

Built with TypeScript, React + Vite (UI shell), Phaser 3 (world), and Harper v5 (database, API resources, seeded data, static hosting). All art is procedurally generated at boot — zero asset files.

---

## Run it locally

Prerequisites: Node 20+, Harper v5 (`npm install -g harper`).

```bash
npm install
npm run build        # builds resources.js (esbuild) and web/ (vite)
harper run .         # or: harper dev .  (watches for changes)
```

Open **https://localhost:9926/** (Harper local dev uses a self-signed certificate — accept the browser warning). Choose **New Game**, customize your caretaker (skin, hair color, hairstyle, build, outfit, hat), pick a name and passcode, and begin. **Load Game** signs back into any save from any browser; the last save on a device also gets a one-click **Continue** button. An interactive tutorial walks brand-new caretakers through the whole loop (skippable; progress is saved to Harper). Harper serves the game, the API, and the seeded data from this one directory.

The game is touch-friendly: on phones and tablets you get a virtual joystick, a big interact button, tap-to-interact on everything in the world, and bottom-sheet menus.

Frontend hot-reload during development:

```bash
harper run .         # terminal 1 — backend on :9926
npm run dev:web      # terminal 2 — vite on http://localhost:5173, proxies API to Harper
```

After changing `server/resources.ts`, run `npm run build:server` (or `npm run dev`, which rebuilds then starts `harper dev .`).

A scripted end-to-end check of the whole API (gather → chest → craft → place → animal returns) lives at `scripts/smoke-test.sh` — start Harper, then run it.

## Deploy to Harper / Fabric

```bash
npm run build        # make sure resources.js and web/ are current

harper deploy \
  project=wild-willows \
  package=. \
  target=<your-instance-url> \           # e.g. https://my-instance.harperfabric.com:9925
  username=<HARPER_USERNAME> \
  password=<HARPER_PASSWORD> \
  restart=true
```

Credentials can also go in `CLI_TARGET_USERNAME` / `CLI_TARGET_PASSWORD` env vars instead of flags. Omit `target` to deploy to a locally running `harper` instance. The `dataLoader` seeds all definition tables on every deploy (content-hashed, so player data is never touched). Admin credentials are used only by the CLI — they never appear in the frontend.

---

## Database schema (Harper, `schema.graphql`)

Definition tables, seeded from `data/*.json` by the built-in dataLoader:

`Biome` (6 biomes with unlock requirements, resources, palettes) · `Animal` (all 90 animals with diets, shelter, real-world facts, and return requirements) · `ResourceType` (21 materials) · `Recipe` (41 recipes) · `HabitatObject` (41 placeable objects/kits with health values, supported needs, biome compatibility, indoor/outdoor rules) · `ToolDef` (4 tools with upgrade tiers).

Per-player state tables: `Player` (inventory, crafted items, tool tiers, unlocked biomes, position) · `BiomeState` (health, balance, returned count, unlocked — one row per biome) · `Chest` (contents, capacity, placement) · `Placement` (every placed object) · `Discovery` (returned animals: comfort, observations, why they returned) · `NodeState` (resource node regeneration timestamps).

Tables are deliberately **not** exported over REST — everything flows through the custom resources below, so the frontend can't bypass validation.

## API resources (`server/resources.ts` → `resources.js`)

| Endpoint | Does |
|---|---|
| `GET /GameData/` | All static definitions (including character appearance options) |
| `POST /CreatePlayer/` | New save: name + passcode + character appearance (validated server-side) |
| `POST /LoginPlayer/` | Load an existing save by name + passcode |
| `POST /DeletePlayer/` | Permanently delete a save and all of its records (passcode required) |
| `GET /GameState/<playerId>` | Full state snapshot for an existing player |
| `POST /CollectResource/` | Gather from a node (biome unlock, node cooldown, basket capacity, tool bonuses) |
| `POST /ChestTransfer/` | Deposit/withdraw (no negative quantities, capacity enforced both ways) |
| `POST /CraftItem/` | Craft anywhere using inventory + all chests; returns a per-source materials breakdown |
| `POST /PlaceObject/` | Place crafted object (biome compatibility, indoor/outdoor, occupancy, tool gates) → recalculates biome |
| `POST /RemoveObject/` | Pick an object back up (chests must be empty) → recalculates biome |
| `POST /UpgradeTool/` | Tool upgrades (materials + biome-progress requirements) |
| `POST /ObserveAnimal/` | Record a field-journal observation |
| `POST /Terraform/` | Shape the ground: shovel digs soil beds, watering can waters them (consumes water, +1 biome health each, capped) |
| `POST /RecalcBiome/` | Explicit health/balance/animal-return recalculation |
| `POST /SyncPlayer/` | Persist position / area changes (locked biomes rejected) |

Every endpoint re-validates on the server: inventory can't go below zero, crafting fails without materials, locked biomes can't be entered, objects only go where their habitat rules allow, and animals never spawn unless conditions are met.

## How animals return

On every placement change the biome is recalculated:

- **Health** = 5 (baseline) + sum of placed objects' health values, capped at 100. The ground visibly greens as it rises.
- **Ecological balance** rewards covering all five habitat needs — food, water, shelter, plants, open space — and gently penalizes monoculture (a wall of berry bushes won't max it). Hoarding doesn't pay; variety does.
- Each animal has **return requirements**: minimum health, sometimes minimum balance, specific habitat objects (e.g. monarchs need wildflowers + butterfly flowers), and sometimes other animals already returned (the red fox waits for voles and rabbits). Returns are evaluated in a loop so food-web chains resolve naturally.
- Returned animals get a **comfort level** from how well the habitat still meets their needs. Remove key habitat and comfort drops — they become "rarely seen" and appear less often in the world, but they're never owned, captured, or lost like pets.

## Crafting & chests

Crafting needs no station: press **C** (or the hammer button) anywhere. It consumes from your basket first, then from any of your chests, atomically — the crafting UI shows exactly how many of each material come from basket vs. chests. Your base camp is a tent, campfire, and starter chest in the meadow; more chests are craftable and placeable anywhere, and all of them feed crafting. Chest contents and placements persist in Harper.

## MVP scope & simplifications

- **Explorable now:** Meadow (fully featured) and Forest (unlocks at Meadow 80% health + 5 animals returned). Your base camp (tent, campfire, starter chest) sits in the meadow. Wetland/Desert/Alpine/Coastal are fully seeded — biomes, all animals, recipes, unlock chain — but on-foot exploration is "trail washed out" signposted for a future update.
- Lightweight saves instead of real auth: each save is a name + passcode pair stored on the Player record (plain text, demo-grade — the passcode is never sent back to clients, but swap in hashing + sessions/roles before anything public). Game endpoints are open while the underlying tables are not.
- Resource nodes regenerate on a simple 75-second timer (per node, validated server-side) rather than a day cycle.
- Watering-can interactions are folded into gathering/crafting (water is a crafting material) rather than a separate tile-watering mechanic.
- Animal behavior is gentle wandering + click-to-observe; one writable save slot; no seasons/weather/day-night yet.
- Known Harper subtlety: conditional searches inside one transaction don't see that transaction's own writes, so endpoints pass fresh records into recalculation explicitly (see comments in `server/resources.ts`).

The data model already carries everything the full design needs (all 6 biomes, 90 animals, prey chains, rarity, kits, migration-path unlock), so seasons, quests, photo mode, richer behaviors — and Willow the Pyrenees — can land without schema rewrites.

## Controls

WASD / arrows (or virtual joystick) to move · **E** / Space / tap to interact · **1–4** select tools, **5**/**J** journal, **C** crafting (works anywhere — materials come from your basket plus all of your chests) · click or tap animals to observe · Shift+click a placed object to pick it up · Esc closes menus / cancels placement. The **toolbelt** at the bottom shows each tool's hotkey: the basket gathers, shovel and watering can terraform (click/tap nearby ground), the hammer crafts, and the wrench opens upgrades. The activity feed in the corner is collapsible. Saves can be deleted from the Load Game screen (passcode required). Gathering spots glow, the nearest interactable gets a pulsing ring, every pickup animates into your basket, and the activity feed narrates what you just did. The **?** button opens How to Play with the full keyboard reference (panel shortcuts: I / J / T / B).

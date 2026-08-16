# Wild Willows 🌿

A cozy nature-restoration life sim. You've set up camp at the edge of a damaged nature preserve: gather fallen materials, craft and plant habitat, shape the land biome by biome — and real animals return when the habitat truly supports them.

Built with TypeScript, React + Vite (UI shell), Phaser 3 (world), and Harper v5 (database, API resources, seeded data). Harper is the source of truth — every action is validated server-side; the browser never computes game state on its own. All art — terrain, objects, animals, the player, and journal thumbnails — is procedurally generated from simple shapes at boot, so the game ships with zero asset files.

**Play it:** [bai13y.itch.io/wild-willows](https://bai13y.itch.io/wild-willows) (download) · [play.wildwillows.app](https://play.wildwillows.app/) (browser demo)

> **Source available, not open source.** © 2026 Bailey Dunning, all rights reserved. The code is here to be read, studied and learned from — no licence to use it is granted. See [NOTICE.md](NOTICE.md) for what that does and doesn't allow. Running, building, distributing or deriving from it needs written permission; ask and it may well be yes.

## Quick start

```bash
npm install
npm run dev          # terminal 1 — Harper (API only) on :9926
npm run dev:web      # terminal 2 — the UI on http://localhost:5173
```

Needs Node 24+ and Harper v5 (`npm install -g harper`). Full setup, testing, deploy and desktop/Steam build instructions live in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

> **Keyboard required.** Wild Willows is a keyboard game (WASD/arrows to roam, letter keys for panels, number keys for tools), so it gates to devices with a keyboard.

**v1 ships solo-only and fully offline** — the desktop app runs the same server logic in-app against local save files, with no server, no account, and nothing to install on first run. Co-op is complete and tested but hidden behind a build flag.

---

## Content at a glance

- **6 biomes** — Willow Meadow, Old Hollow Forest, Rushwater Wetland, Redstone Scrubland (desert), Graywind Heights (alpine), Pelican Shore (coastal). All six are explorable on foot and fully restorable.
- **150 animals** — **25 per biome**, each with diet, shelter, a real-world fact, and habitat return requirements. Every animal has a **unique, procedurally-built sprite** composed from its species traits (quills for a porcupine, antlers for a deer, long legs for a heron, a domed shell for a turtle, claws for a crab…), so no two read alike.
- **385 habitat objects** and **355 recipes** across habitat, structures & decor, paths, storage, camp comforts, and restoration kits. Plantable flowers/grasses/trees are **planted, not crafted**, so 341 of the recipes are craftable items and the remaining 14 are the plant set.
- **Unlockable crafting** — most recipes start locked and unlock one at a time as a biome recovers (health crossed, a keystone animal welcomed), with a clear "New Crafting Recipe Unlocked" callout. New caretakers begin with a handful of starter recipes (Grass Patch + a few) and **almost no materials** — the first job is to gather.
- **Three chest sizes** — Small (**120**), Medium (**250**), and a Large Chest (**500**) that unlocks later, once Redstone Scrubland is restored to 60% and you've crafted a Medium Chest first.
- **38 gatherable resources**, including biome-exclusive ones (geode and agave nectar in the desert; quartz crystal, obsidian, pine nuts, lichen, juniper berries, and packed snow in the alpine) and **5 weather-gated rarities** that only surface during the right weather. Node generation **guarantees every resource appears** in its biome.
- **4 tools** with deep upgrade tracks (basket/shovel/watering can each have 4 tiers; the field journal has 7 — a baseline plus one guide per area).
- **50 achievements** for restoration milestones, food-web moments (keystones, predators, ecosystem engineers), gathering/crafting/terraforming mastery, and preserve-wide progress (no hidden ones; locked entries show a non-spoilery hint). The first, **First Friend**, is earned the moment you welcome the grasshopper home — and the **grasshopper is always the first animal to return anywhere**. All are server-validated and shown in a dedicated **Achievements** menu (**K**).
- **A home you can step inside, decorate, and upgrade.** Walk up to your camp tent in Willow Meadow and press **E** to step inside. Decorate with indoor-only **"camp comfort"** items — sleeping bag, rug, lamp, house plant, hammock, string lights, armchair, fireplace, bookshelf and more. First you **build** your home in one of three styles — **Log Cabin** (wood), **Meadow Cottage** (fiber & flowers), or **Stone Hearth** (stone) — which sets its look for good, then upgrade along four tracks: **Space**, **Comfort** (a flat carry-capacity perk), **Furnishings**, and **Warmth**. Some bigger pieces need a proper house, not the starter tent.
- **Daily tasks** — a small rotating board of three light goals per real (UTC) day (gather / craft / place / water / plant / observe), with small material rewards drawn from your unlocked biomes. Collapses with **O** and disappears once everything's claimed.
- **A living, biome-specific feed.** A corner activity feed narrates everything you do, and notable beats persist to a **Feed** menu (**F**); toasts are reserved for the big moments. Each biome has **50+ randomized lines** (ecology, atmosphere, coexistence, fun facts) that surface over time, always specific to the area you're in, many gated to that biome's recovery, the animals back there, or the habitat you've built.

## How animals return

On every change the biome is recalculated:

- **Health** = a baseline plus the health value of placed objects and tended soil/open-water bonuses, on a gentle curve toward 100. The ground visibly greens (or warms, in the desert) as it rises.
- **Ecological balance** measures how complete the **food web** is: how many of the biome's animals have returned, how many of its **predators / top-of-chain species** are back (they depend on prey, so a biome of herbivores correctly reads as unbalanced), and **trophic breadth** — how many different animal *kinds* are represented. By design it **cannot reach 100% until every animal in the biome is back**.
- Each animal has **return requirements**: minimum health, sometimes balance, specific habitat objects, sometimes water features, and sometimes other animals already back. Every biome has a quick **early ramp** — the meadow grasshopper returns at just 15% health with a single Grass Patch — with the rest hardened to need a real mix of *planting and crafting*.
- **Water-dwellers need terraformed water.** Shaping open-water tiles with the watering can forms ponds, **lakes** (a large connected body), and **rivers** (a long connected channel). The snapping turtle (lake), belted kingfisher (river), and bittern (open water) only return once you've shaped the right water.
- **Plants must mature.** A freshly planted habitat is a sprout and doesn't count until it has fully grown in — and the moment it matures the biome re-checks, so anything now eligible arrives on its own.
- Animals return **one at a time** per change, so a biome fills with visitors gradually.
- Returned animals get a **comfort level**; remove key habitat and they become "rarely seen," but they're never owned, captured, or lost like pets.

## Biomes, restoration kits & progression

Restore each biome to unlock the next. There's **one restoration kit per area** — each craftable only once, but available **right away** (no health gate), so the real bar is the health + animals, not the kit. Every unlock needs the gating biome at **80% health**, with progressively steeper animal counts:

| Unlock | Requirements |
|---|---|
| Old Hollow Forest | Meadow **80%** · **10** meadow animals · Forest Restoration Kit |
| Rushwater Wetland | Forest **80%** · **10** forest animals · **25 total animals** · Wetland Restoration Kit |
| Redstone Scrubland (desert) | Wetland **80%** · **13** wetland animals · **45 total** · Scrubland Restoration Kit |
| Graywind Heights (alpine) | Desert **80%** · **15** desert animals · **65 total** · Alpine Restoration Kit |
| Pelican Shore (coastal) | Alpine **80%** · **17** alpine animals · **85 total** · Migration Path Marker |

All targets stay attainable — every one of a biome's 25 animals can return by 80% health. Areas connect by trail gates, and you spawn at the correct edge when you travel; a forward trail shows a **trail sign** until its destination is unlocked, then becomes an open gate. **Rushwater Wetland opens partly pre-shaped** — channels, a pond, and watered beds are seeded on first entry. **Redstone Scrubland** is dry by design: you can ready soil beds but **cannot flood it** into open water. **Graywind Heights** rises into an **impassable, snow-capped range** along its skyline (the map extends downward by the same number of rows, so its restorable floor stays full size) and carries exclusive resources feeding alpine-only crafts like the Crystal Snowmelt Spring, Pika Haypile, Whitebark Seed Cache, Crystal Cairn, and Obsidian Totem.

## Tools

Four tools, each upgraded with materials gated on biome progress. Higher tiers gather more at once (tier 1→1 … tier 4→4):

- **Gathering Basket** (4 tiers) — carry capacity 200 → 800.
- **Shovel** (4 tiers) — prepare beds, shape mud banks/burrows, dig more per swing.
- **Watering Can** (4 tiers) — collect 1 → 4 water per fill.
- **Field Journal** (7 tiers) — a baseline journal plus a dedicated field guide for each area. The baseline shows each animal's basic entry and comfort, but the **full diet, shelter, fact, and return hints stay locked** until you gather that area's own materials and upgrade its guide — so even the meadow's full entries are earned, not free.

## Crafting, planting & terraforming

Crafting needs no station — press **C** anywhere; it draws from your basket first, then all linked chests, atomically. The crafting menu has two filter dropdowns — **Place** (by biome) and **Type** (Plants & flowers / Habitat / Structures & decor / Paths & fences / Storage / Camp comforts / Restoration kits) — plus a **search box** that matches a recipe's name, what it makes, its type, **and its ingredients**, so typing "reeds" or "clay" surfaces everything that uses them. One-time kits show a "Crafted ✓" state, and restoration kits in your basket **can't be thrown away**.

Many items can also be **planted**: dig a soil bed with the shovel, water it, then plant a seed/sapling that sprouts and grows in over time. Every biome has 3+ plantable trees and its own flowers/grasses. Crafted items each get a small deterministic visual variation so no two look identical.

## Resource nodes & water

Resource nodes are scattered per area, with the mix **randomized per player** (deterministic, so they stay put) while guaranteeing every biome resource appears. A **water source is guaranteed near where you spawn** (skipped in the dry desert), and new saves start with extra water so early bed-watering isn't a grind. You can **build anywhere** — place or plant on a regen spot and the node simply **relocates** to the nearest free tile, keeping its regrowth timer. Nodes regenerate on a per-node timer.

## Weather & seasons

Every biome has its own **weather**, changing about every ten **minutes of play** — the calendar advances from accrued play time, not the wall clock, so a world you leave for a week is exactly where you left it. There's deliberately **no day/night cycle**.

- **Seasons** cycle spring → summer → autumn → winter (a few play-days each), biasing which weather a biome rolls and subtly tinting the ground.
- **Seven weather types** — clear, cloudy, rain, storm, fog, snow, heat — each with a full-screen colour wash and, for rain/storm and snow, falling **particle** weather (pre-warmed on biome entry so you arrive mid-storm). A HUD chip shows the current weather + season.
- **Weather & Seasons guide (M)** is an educational panel: for the biome you're standing in it explains, in plain language grounded in **credible sources** (USGS, NOAA/NWS, NPS, US FWS, EPA, university extension, Britannica, Audubon, Smithsonian), **how the current weather and season shape that biome** — desert rain waking spadefoot toads, alpine snowpack as a slow-release "water tower," forest "fog drip," storm-cast kelp wrack feeding the beach. It also shows a short cross-preserve **forecast** (Now / Next / Later) per biome. The weather-gated resources are intentionally **not** listed — finding them is a surprise.
- **Weather-gated gather nodes.** While the right weather is active, a biome sprouts a couple of nodes for a unique material: rain → **Rainwater**, desert storm → **Stormglass** (fused like fulgurite), snow → **Frostflower**, fog → **Morning Dew**, desert heat → **Sunstone**. The pairing is biome-specific, and the server re-checks the live weather before granting one.
- **They're functional, not just collectibles.** Each crafts into bespoke decor with real restoration value — **Rain Basin** (a water source), **Sunstone Cairn** (shelter), **Frostflower Planter** (plant), plus a **Dewlit Lantern**, **Stormglass Lantern**, and two home pieces. Three uncommon animals want a weather build to settle: the **Chuckwalla** basks on a Sunstone Cairn, the **White-tailed Ptarmigan** wants a Frostflower Planter in bloom, and the **Western Meadowlark** drinks from a Rain Basin.

## Field journal

Grouped by biome, the journal shows each animal's actual **sprite thumbnail** (colored for returned animals, a silhouette for ones still to come), comfort level, why it returned, and — once the field guide is upgraded for that area — full diet/shelter/habitat notes and exact return hints.

> **The expanded guide asks before it answers.** Opening a still-missing animal's entry poses one question first: from the habitat hint, which of three same-biome habitat objects is this one really waiting for? Answer and the full checklist opens; there's also a *Just show me the list* link, so nobody is ever blocked. Wrong answers cost nothing and name the right object, and the card keeps a running "read right" tally. Guesses grant nothing and gate nothing. Each full entry ends with a collapsed **Sources** list (Animal Diversity Web, NPS, US FWS, Cornell Lab and friends). Toggle **Unknown first** to surface what you haven't found, or **search** by name or kind.

## Controls

WASD / arrows to move · **E** / Space to interact · **1–4** select tools (basket · shovel · watering can · paint) · **B** basket · **J** journal · **K** achievements · **F** activity feed · **C** crafting · **P** preserve map · **M** weather & seasons guide · **T** tools & upgrades · **O** today's tasks board · **U** People (co-op worlds only) · **G** settings · **H** How to Play · click animals to observe · Shift+click a placed object to pick it up · Esc closes menus / cancels placement. Gathering spots glow, the nearest interactable gets a pulsing ring, and pickups animate into your basket. The **?** button (or **H**) opens How to Play with the full reference.

## Co-op multiplayer

> **Hidden in v1.** Co-op is gated behind a build flag and off in the shipped solo-only build. The code is intact and tested — see [CONTRIBUTING.md](CONTRIBUTING.md#re-enabling-co-op-later). When enabled, the title screen shows a Solo/Co-op toggle.

At **New Game** you choose **Solo** or **Co-op**. A save is bound to one world for its lifetime.

- **Host** creates a shared preserve and a 6-character **join code**. **Join** verifies a code, sends a request to the host, lets you build your character while the host reviews, then drops you into a **waiting room** until they approve — the host gets a popup with Approve / Deny. When you're let in, the world feed announces *"{name} joined the preserve!"*.
- **What's shared vs. personal.** The world — biomes, terrain, placements, plants, chests, returning animals, biome health, the activity feed — is shared by everyone in it. Your **basket, tools, field journal, appearance, position, and achievements stay personal**. (Exception: *world* achievements like **First Friend** are earned by **all** members at once.)
- **Live presence.** Other players appear as their own caretakers and move smoothly; other world changes (placing, terraforming, collecting) sync on a short timer.
- **People menu (U)** shows the join code to copy, who's currently here, and the host's pending requests. A **Co-op** badge by the area name marks a shared world, and the guided tutorial adapts: the host's first step teaches inviting, a joiner's just welcomes them.
- Up to **6 caretakers** per preserve.

## Localization

The game ships in **English and Spanish** (pick on the title screen or in Settings → Language), with all player-facing text flowing through a zero-dependency i18n layer. Adding a language is a matter of dropping in catalog files — see [CONTRIBUTING.md](CONTRIBUTING.md#localization-i18n).

## Privacy

Anonymous per-save-slot gameplay metrics, plus an optional email only if you submit feedback. No tracking, no ads, no third-party analytics. Full details in [PRIVACY.md](PRIVACY.md).

---

**Developer documentation:** [CONTRIBUTING.md](CONTRIBUTING.md) — local setup, testing, deploying to Harper, desktop/Steam/Mac App Store builds, code signing, the database schema, the API reference, systems internals, metrics, and known limitations.

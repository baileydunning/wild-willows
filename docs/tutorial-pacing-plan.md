# Tutorial Pacing Plan

**Problem (playtest2):** the information all exists, but it arrives while the player
is still learning controls + UI, so little of it sticks. Specific failures:

- The reviewer crafted habitats but didn't realize they had to be **placed**.
- The **H for Help** hint appears once, on slide 1, and was missed.
- The early game shows lots of UI at once; he only discovered panel
  **minimizing** hours in.
- Chapter 4 is a six-step "open this panel" tour with nothing driving it.

**Principle:** teach at the moment of need. Keep a short guided arc for the core
loop (it builds to the grasshopper payoff, which works); move everything else
into one-time contextual tips that fire when the player first touches the
relevant system.

---

## Phase 1 — Contextual tip system (the foundation)

New `src/ui/ContextTips.tsx`: small, dismissible, one-time cards in the corner
(reuse the tutorial card styling, smaller). Each tip has an id, a trigger, and
copy in `panels.tips.*`. Seen-state in localStorage first
(`wild-willows:tips-seen`), promotable to the player record later so it syncs.

Triggers wire into what already exists: `bridge` events (`collected`,
`plant-matured`, `placement-exited`), the `panel` state in `useGame`, and
game-state predicates like the ones in Tutorial.tsx (`hasGrassPatch`, etc.).

Launch set of tips:

| id | trigger | teaches |
|---|---|---|
| `craft-then-place` | first item crafted, not yet placed after ~10s | "It's in your basket — hit Place." **(the reviewer's exact confusion)** |
| `panels-minimize` | second panel/widget open | panels + tutorial card can be minimized (review item) |
| `help-key` | chapter 1 completes | H opens Help, any time — repeat of the slide-1 hint |
| `chest-storage` | basket ≥ 70% full | chests exist, all chests feed crafting |
| `proximity` | second habitat placed | habitats closer together support more species |
| `goals` | goals panel first opened OR first animal returns | how goals work |
| `new-biome` | first entry to any second biome | Materials guide shows what's gatherable here |
| `search-crafting` | crafting menu has >12 recipes unlocked | search/filter hint |

## Phase 2 — Trim the guided arc

Tutorial.tsx `BASE_STEPS` goes from 20 steps to ~12; every cut becomes a tip:

- **Cut `coreLoop` + `goals` info cards** (chapter 1): fold one sentence of the
  loop into `welcome`; goals become the `goals` tip.
- **Cut `chest`** (chapter 1): becomes the `chest-storage` tip. Chapter 1 is now
  move → basket → gather: pure hands-on.
- **Cut `proximity` info card** (chapter 3): becomes the `proximity` tip.
- **Keep chapter 2 (dig/plant/water) and the craft → place → grasshopper → star
  spine of chapter 3 unchanged** — it's the emotional payoff and it works.
- **Delete chapter 4 entirely** (journal/tools/map/weather/tips/home tour).
  Replace with one closing card after `star`: "The rest of the preserve is
  yours to explore — press H whenever you want a refresher." Journal, tools,
  map, weather each get their intro as a tip on first open instead.

Chapter count goes 4 → 3; the header framing ("Chapter N of 3") stays.

## Phase 3 — Progressive HUD

The "overwhelmed by UI" complaint isn't just the tutorial — it's everything
being visible at once on a fresh save. Gate initial visibility by tutorial
progress (fresh saves only; existing saves see everything):

- Chapter 1: HUD shows movement hints, basket, and the tutorial card only.
  Tasks widget, goals widget, and weather chip hidden.
- Chapter 2: toolbelt fully visible (shovel/can are now relevant).
- Chapter 3: crafting reachable; goals + tasks widgets appear with the `goals`
  tip.
- After the closing card: everything visible, "new" dot on toolbar buttons
  never yet opened (dot clears on first open).

Implementation: a `hudStage` derived from `player.tutorialStep` in HUD.tsx —
no server change needed.

## Phase 4 — Retention aids

- One-line recap card at each chapter end ("You can now gather and carry —
  next: healing the land itself").
- Help panel gains a **Tips** section listing every tip already seen, so
  "what was that again?" has an answer. (Help.tsx already exists; render the
  seen-tips list from the same catalog.)
- Metrics: count tip impressions + tutorial skip position via the existing
  `metricsUplink`, so the next playtest tells us which cards still don't land.

---

## Order & effort

1. Phase 1 — tip system + the `craft-then-place`, `panels-minimize`, `help-key`
   tips. Biggest fix per line of code; ships alone safely. (~1 day)
2. Phase 2 — step cuts + remaining tips. Mostly deleting steps and moving copy
   between i18n keys; touch `savedTutorialPos` migration (old saved positions
   may exceed the new step count — clamp). (~half day)
3. Phase 3 — progressive HUD. Most visible polish, needs a fresh-save playtest
   pass. (~1 day)
4. Phase 4 — recaps, Help tips archive, metrics. (~half day)

## Risks / notes

- `tutorialStep` is stored per player server-side; shortening `BASE_STEPS`
  shifts indices for anyone mid-tutorial. Clamp `step` to the new length and
  accept that mid-tutorial saves may jump a card (harmless; tutorial is
  replayable from Help).
- Co-op intro steps (`COOP_HOST_INTRO` / `COOP_JOIN_INTRO`) keep working — they
  prepend to the shorter arc unchanged.
- Touch variants: every new tip needs a `.touch` string like the current steps.
- Don't fire two tips at once: simple queue in ContextTips, one visible, 5s gap.

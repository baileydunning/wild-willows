# Wild Willows — Playtest Action Plan

Based on solo playtest metrics (19 players, July 2026) and the full-completion written review.

## What the data says

**Funnel:** created 19 → collected 15 (79%) → crafted 11 (58%) → placed 10 (53%) → attracted animal 10 (53%) → unlocked 2nd biome 3 (16%).

Two cliffs stand out:

1. **First-session bounce:** 4 players (21%) logged zero meaningful actions. Lola played *4 sessions* totaling 12 min with 0 actions, stuck at tutorial step 1 — she kept coming back and still couldn't get started. That's the strongest single signal in the dataset.
2. **Second-biome cliff:** 10 players attracted an animal but only 3 unlocked a second biome. The reviewer explains why: biome restoration outpaces animal return, leaving a long stretch of "craft and place habitats and wait" before the unlock.

**Retention:** 32% returning, 1.7 sessions avg. But players who get over the hump go deep — PermanX (5.2 hrs, 6 biomes) and Laurel (3 hrs, all 6 biomes fully restored, 48/50 achievements) prove the loop holds up. The problem is getting people *into* the loop, not keeping them there.

**Craft→place gap:** the reviewer crafted habitats and didn't realize they needed placing — and the funnel shows the same drop (58% crafted → 53% placed).

**Reviewer's core verdict:** the game explains everything, but front-loads it. Information isn't missing; it isn't retained.

---

## P0 — Bugs (fix before next playtest wave)

| # | Item | Evidence |
|---|------|----------|
| 1 | **Slider/scrollbar stays attached to cursor after drag** | Reproduced in character creation and elsewhere; reviewer has video. This is the *first* interaction new players have (character creator) — a bad first minute for everyone. |
| 2 | **Crafting search doesn't rank matches** | "grass" doesn't surface Grass Patch above Poppy Patch/Willow Tree. Fix: prefix/substring match on name, exact-prefix first. Reviewer has screenshots. |
| 3 | **Intermittent movement issues** | Slowdown and stuck-direction input. Not reproducible — add input-state logging so the next occurrence is diagnosable. |
| 4 | **Perf dips during snow/rain particles** | Graywind Heights on integrated graphics. Cap or LOD particle counts on low-end. Low severity — game otherwise runs well on a 4GB i3. |

## P1 — First-time experience (biggest funnel lever)

| # | Item | Evidence |
|---|------|----------|
| 5 | **Make tutorial contextual instead of front-loaded** | Reviewer's #1 suggestion; 5 players stuck at tutorial steps 0–18; Lola bounced 4 times at step 1. Trigger each lesson when the mechanic first becomes relevant (crafting explained at first craft, habitats at first habitat, etc.). |
| 6 | **Close the craft→place gap** | After crafting a placeable item, prompt "Place it in the world" with a marker/arrow until first placement. Directly targets the 58%→53% funnel drop and the reviewer's confusion. |
| 7 | **Surface "panels can be minimized" hint** | Reviewer felt the UI was crowded until discovering minimize. One-time tooltip, or start panels minimized by default. |
| 8 | **Keep H-for-Help discoverable** | Persistent small "H = Help" indicator for the first session instead of one tutorial slide. |
| 9 | **Investigate zero-action sessions** | Ryan/teser/Fossil: 0–7 min, ~0 actions, on 0.1.6. Check whether 0.1.6 had a blocker at game start, or whether the opening flow loses people before the meadow. |

## P2 — Progression pacing (second-biome cliff)

| # | Item | Evidence |
|---|------|----------|
| 10 | **Narrow the restoration ↔ animal-return gap** | Reviewer hit 40–50% restoration with 1–2/25 animals returned. Options: earlier/cheaper animal returns in biome 1, or partial-progress feedback ("3 species are getting curious…") so the wait reads as anticipation, not stall. Keep the organic timing — reviewer liked the surprise returns. |
| 11 | **Re-examine the second-biome unlock requirement** | Only 3/19 got there; 7 players attracted animals but never unlocked. If unlock requires heavy animal return, item 10 partly fixes this; otherwise consider lowering the first unlock threshold specifically (later unlocks can stay as-is — players who reach biome 2 tend to finish). |
| 12 | **Look at power-player inventory friction** | Laurel discarded 1,253 items. Basket/chest flow may break down at high collection rates — possibly auto-deposit or a "don't pick up X" filter. |

## P3 — Quality of life

| # | Item | Evidence |
|---|------|----------|
| 13 | **Journal next/prev buttons** | Reviewer request; cheap win for a beloved feature. |
| 14 | **Keyboard control for sliders** | Also mitigates bug #1 until fixed. Fits the existing accessibility story (colorblind mode, dyslexia font). |
| 15 | **Night-time character visibility** | Small lantern glow or character rim-light; don't brighten the world. |
| 16 | **Hat/hairstyle layering fixes** | Hats clip into large hairstyles; reviewer has comparison screenshots. |

## P4 — Polish (pre-launch)

| # | Item | Evidence |
|---|------|----------|
| 17 | **Main menu visual pass** | Functional but doesn't sell the game's charm. First impression matters given the bounce rate. |
| 18 | **Audio (already planned)** | Reviewer played hours with no audio and still flags this as the highest-impact atmosphere work: ambient biome loops, animal calls, weather, night wildlife. |

---

## Suggested sequencing

- **Next patch (0.1.12):** items 1, 2, 7, 8, 13, 14 — small, high-visibility fixes.
- **Following release:** items 5, 6, 10, 11 — the FTUE/pacing rework; this is the retention play.
- **Ongoing:** 3, 9 (instrumentation + investigation), 12, 15, 16.
- **Pre-launch:** 17, 18.

## Success metrics for the next playtest wave

- Crafted→placed funnel gap ≤ 2 pts (now 5)
- Second-biome unlock ≥ 35% (now 16%)
- Zero-action players ≤ 5% (now ~21%)
- Returning rate ≥ 45% (now 32%)
- Tutorial completion ≥ 85% reaching step 99 (now 74%)

## Also worth collecting

- Ask the reviewer for the slider video and search/hat screenshots (offered in the review).
- Instrument tutorial step timestamps to see *where* time is spent, not just the last step reached.
- Log discards and chest usage per session to validate item 12.

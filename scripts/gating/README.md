# Recipe gating

`data/recipes.json` is generated: every craftable recipe's `unlock` block comes
out of this three-file pass, so the pacing can be re-tuned in one place instead
of by hand across 337 records.

```
python3 scripts/gating/gen_recipes.py    # re-gate + rewrite data/recipes.json
python3 scripts/gating/validate.py       # check only: curve, deadlocks, duplicates
```

* `gates.py` — the design. Target curve per area, the gate vocabulary and which
  kinds of object may use which gate, the labels, and the hand-authored
  `OVERRIDES` for chests and caretaker gear.
* `validate.py` — puts every gate on one scale (`stage = areaOrder*100 + health`)
  and proves three things: no two recipes in an area share a requirement, every
  habitat an animal needs unlocks *before* that animal is reachable, and nothing
  is gated behind something that can never happen.
* `gen_recipes.py` — applies the result to `data/recipes.json`. Refuses to write
  if `validate.py` reports a single problem.

The generator only rewrites `unlock`; names, categories, materials and outputs
are left exactly as authored. Plantables keep whatever they had — they're
planted, never crafted, so their gate is inert.

Knobs worth turning in `gates.py`: `targets_for()` (how late a habitat unlocks
relative to the animal that needs it — currently 65% of the way), `QUOTA` (the
mix of requirement types), `BANDS` (which requirements suit early vs late), and
`ALLOWED` (which requirements suit which kind of object).

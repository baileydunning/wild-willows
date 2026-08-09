#!/usr/bin/env python3
"""
Standalone integrity check for Wild Willows game data.

    python3 .research/rebuild/validate-data.py [data-dir]

Reads data/ directly and re-checks every invariant the ecology rebuild
established. Run it after any hand edit to the species or object files.
"""
import json, os, sys, collections

DATA = sys.argv[1] if len(sys.argv) > 1 else 'data'
def load(f): return json.load(open(os.path.join(DATA, f), encoding='utf-8'))

a1, a2 = load('animals-1.json'), load('animals-2.json')
species = {r['id']: r for r in a1['records'] + a2['records']}
objects = {h['id']: h for h in load('habitat-objects.json')['records']}
recipes = {r['output']['itemId']: r for r in load('recipes.json')['records']}
biomes  = {b['id']: b for b in load('biomes.json')['records']}
resource_ids = {r['id'] for r in load('resources.json')['records']}

GENERIC = {'shrub','rock-pile','tidepool','reed-bed','desert-brush',
           'alpine-wildflower-patch','dune-grass','shallow-water-pool','grass-patch'}
TIERS = {
    'decomposers':   (['decomposer','detritivore'], 2),
    'herbivores':    (['herbivore','filter-feeder'], 8),
    'mid':           (['insectivore','omnivore','scavenger'], 8),
    'mesopredators': (['mesopredator'], 4),
    'apex':          (['apex-predator'], 3),
}
# Weather-event drops: not in any biome's base resource list, but craftable with.
WEATHER_RESOURCES = {'rainwater','dewdrops','sunstone','frostflower','stormglass'}

errors, warnings = [], []
def err(m): errors.append(m)
def warn(m): warnings.append(m)
def eid(e): return e['id'] if isinstance(e, dict) else e

print(f"checking {DATA}/ — {len(species)} species, {len(objects)} objects, {len(recipes)} recipes\n")

# roster size
per_biome = collections.Counter(s['biome'] for s in species.values())
for b, n in sorted(per_biome.items()):
    if n != 25: err(f"[{b}] {n} species, expected 25")

# trophic pyramid
print("trophic pyramid (target in brackets, +/-1 allowed)")
for b in sorted(per_biome):
    c = collections.Counter(s['trophic'] for s in species.values() if s['biome'] == b)
    cells = []
    for tier, (vals, target) in TIERS.items():
        n = sum(c[v] for v in vals)
        if abs(n - target) > 1: err(f"[{b}] tier {tier}={n}, target {target}")
        cells.append(f"{tier[:5]} {n}[{target}]")
    print("  " + f"{b:9}" + "  ".join(cells))

# signatures
sig_owner = {}
for sid, s in species.items():
    sig = s['requirements'].get('signature')
    if not sig: err(f"{sid}: no signature object"); continue
    if sig in GENERIC: err(f"{sid}: signature '{sig}' is a generic object")
    if sig not in s['requirements'].get('objects', {}): err(f"{sid}: signature not in own objects")
    if sig in sig_owner: err(f"signature '{sig}' claimed by {sig_owner[sig]} and {sid}")
    sig_owner[sig] = sid
for sid, s in species.items():
    for o in s['requirements'].get('objects', {}):
        if o in sig_owner and sig_owner[o] != sid:
            err(f"{sid} requires '{o}', which is {sig_owner[o]}'s signature")

# objects exist, are in-biome, generic use capped
for sid, s in species.items():
    objs = s['requirements'].get('objects', {})
    if not (2 <= len(objs) <= 4): err(f"{sid}: {len(objs)} objects, expected 2-4")
    if len([o for o in objs if o in GENERIC]) > 1: err(f"{sid}: >1 generic object")
    for o in objs:
        if o not in objects: err(f"{sid}: unknown object '{o}'")
        elif s['biome'] not in objects[o].get('biomes', []):
            err(f"{sid}: object '{o}' unavailable in {s['biome']}")

# recipe materials
for oid, r in recipes.items():
    b = r.get('unlockBiome')
    if b not in biomes: continue
    allowed = set(biomes[b]['resources']) | set(biomes[b]['digResources'])
    for m in r.get('materials', {}):
        if m not in resource_ids: err(f"recipe {oid}: unknown resource '{m}'")
        elif m not in allowed and m not in WEATHER_RESOURCES:
            # Inventory is shared across biomes, so this is legal — just means the
            # player has to carry the material in. Worth knowing, not an error.
            warn(f"recipe {oid} ({b}) uses '{m}', which must be carried in from another biome")

# unlock reachability
requirers = collections.defaultdict(list)
for sid, s in species.items():
    for o in s['requirements'].get('objects', {}):
        requirers[o].append((sid, s['requirements']['minHealth']))
for oid, reqs in requirers.items():
    u = (recipes.get(oid) or {}).get('unlock') or {}
    if 'minHealth' in u:
        lo = min(h for _, h in reqs)
        if u['minHealth'] > lo:
            who = next(s for s, h in reqs if h == lo)
            err(f"'{oid}' unlocks at {u['minHealth']}% but {who} needs it at {lo}%")
    if 'requiresAnimal' in u:
        g = u['requiresAnimal']
        if g not in species: err(f"'{oid}' gated on unknown species '{g}'")
        else:
            gh = species[g]['requirements']['minHealth']
            for sid, h in reqs:
                if h < gh: err(f"'{oid}' gated on {g} ({gh}%) but {sid} needs it at {h}%")

# prey gates
for sid, s in species.items():
    for prey in s['requirements'].get('animals', []):
        if prey not in species: err(f"{sid}: prey gate '{prey}' not a species")
        elif species[prey]['biome'] != s['biome']: err(f"{sid}: prey gate '{prey}' cross-biome")
        elif species[prey]['requirements']['minHealth'] >= s['requirements']['minHealth']:
            err(f"{sid} gated on {prey}, which unlocks no earlier")
    for x in s['requirements'].get('excludes', []):
        if x not in species: err(f"{sid}: excludes unknown species '{x}'")

# food web
for sid, s in species.items():
    for e in s.get('eats') or []:
        p = eid(e)
        if p == sid: err(f"{sid} eats itself")
        elif p not in species: err(f"{sid} eats unknown '{p}'")
        else:
            if species[p]['biome'] != s['biome']: err(f"{sid} eats cross-biome '{p}'")
            if sid not in [eid(x) for x in (species[p].get('eatenBy') or [])]:
                err(f"asymmetry: {sid} eats {p}, but {p}.eatenBy lacks {sid}")
    for e in s.get('eatenBy') or []:
        pr = eid(e)
        if pr not in species: err(f"{sid}.eatenBy unknown '{pr}'")
        elif sid not in [eid(x) for x in (species[pr].get('eats') or [])]:
            err(f"asymmetry: {sid}.eatenBy has {pr}, but {pr}.eats lacks {sid}")

# report
use = collections.Counter()
for s in species.values():
    for o in s['requirements'].get('objects', {}): use[o] += 1
orphans = [s for s in species.values() if not s.get('eatenBy') and s['trophic'] not in ('apex-predator','producer')]
chains  = [k for k, v in recipes.items() if (v.get('unlock') or {}).get('requiresAnimal')]
staged  = sum(1 for s in species.values() for e in (s.get('eats') or []) if isinstance(e, dict))

print(f"\ngeneric-object load: " + ", ".join(f"{o} {use[o]}" for o in sorted(GENERIC) if use[o]) or "  none")
print(f"unlock chains gated on a species: {len(chains)}")
print(f"stage-qualified food-web edges:   {staged}")
print(f"species with no predator:         {len(orphans)}")
print(f"unused objects (no species needs them): "
      f"{sum(1 for o, h in objects.items() if h.get('healthValue', 0) > 0 and not use[o] and not h.get('decorative'))}")

print("\n" + ("0 errors" if not errors else f"{len(errors)} ERROR(S):"))
for e in errors[:40]: print("  x", e)
if len(errors) > 40: print(f"  ... and {len(errors)-40} more")
if warnings:
    print(f"\n{len(warnings)} note(s) — legal, but worth a look:")
    for w in warnings[:10]: print("  !", w)
    if len(warnings) > 10: print(f"  ... and {len(warnings)-10} more")
sys.exit(1 if errors else 0)

#!/usr/bin/env python3
"""Validate the six biome rebuild files and merge them into the game data files."""
import json, glob, os, collections, sys, shutil

SRC = os.environ.get('WW_DATA', '../../../data')
OUT = os.environ.get('WW_OUT', '.')
os.makedirs(OUT, exist_ok=True)

BANNED = {'shrub','rock-pile','tidepool','reed-bed','desert-brush','alpine-wildflower-patch',
          'dune-grass','shallow-water-pool','grass-patch'}
TIERS = {
    'producers':      (['producer'], 2),
    'decomposers':    (['decomposer','detritivore'], 3),
    'herbivores':     (['herbivore','filter-feeder'], 7),
    'mid':            (['insectivore','omnivore','scavenger'], 7),
    'mesopredators':  (['mesopredator'], 4),
    'apex':           (['apex-predator'], 2),
}

def load(f): return json.load(open(os.path.join(SRC, f)))

a1, a2 = load('animals-1.json'), load('animals-2.json')
ho, rc, bi, res = load('habitat-objects.json'), load('recipes.json'), load('biomes.json'), load('resources.json')

old_species = {r['id']: r for r in a1['records'] + a2['records']}
file_of = {r['id']: 1 for r in a1['records']}
file_of.update({r['id']: 2 for r in a2['records']})
objects = {h['id']: h for h in ho['records']}
recipes = {r['output']['itemId']: r for r in rc['records']}
biomes = {b['id']: b for b in bi['records']}
resource_ids = {r['id'] for r in res['records']}

builds = {}
for f in sorted(glob.glob('/tmp/out/*.json')):
    d = json.load(open(f))
    builds[d['biome']] = d

errors, warnings = [], []
def err(m): errors.append(m)
def warn(m): warnings.append(m)

# ---- assemble new world state -------------------------------------------------
new_species, new_objects, new_recipes = {}, dict(objects), dict(recipes)
removed = set()
for b, d in builds.items():
    removed |= set(d.get('removedSpecies', []))
    for s in d['species']:
        if s['id'] in new_species:
            err(f"duplicate species id across biomes: {s['id']}")
        s['biome'] = b
        new_species[s['id']] = s
    for o in d.get('newObjects', []):
        if o['id'] in objects: err(f"[{b}] newObject collides with existing object id: {o['id']}")
        if o['id'] in new_objects and o['id'] not in objects: err(f"[{b}] newObject id used twice: {o['id']}")
        new_objects[o['id']] = o
    for r in d.get('newRecipes', []):
        new_recipes[r['output']['itemId']] = r
    for e in d.get('recipeEdits', []):
        tgt = new_recipes.get(e['id'])
        if not tgt: warn(f"[{b}] recipeEdit targets unknown recipe {e['id']}")
        else: tgt['unlock'] = e['unlock']
    for e in d.get('objectEdits', []):
        tgt = new_objects.get(e['id'])
        if not tgt: warn(f"[{b}] objectEdit targets unknown object {e['id']}")
        else: tgt[e['field']] = e['to']

# ---- checks -------------------------------------------------------------------
print("=" * 72); print("VALIDATION"); print("=" * 72)

# 1 roster size
for b, d in builds.items():
    if len(d['species']) != 25: err(f"[{b}] {len(d['species'])} species, expected 25")
if len(new_species) != 150: err(f"total species {len(new_species)}, expected 150")

# 2 replacement budget
for b, d in builds.items():
    n = len(d.get('removedSpecies', []))
    if n > 5: err(f"[{b}] removed {n} species, budget is 5")

# 3 trophic pyramid
print("\n-- trophic pyramid (target in brackets, +/-1 allowed) --")
for b in sorted(builds):
    counts = collections.Counter(s['trophic'] for s in builds[b]['species'])
    row, ok = [], True
    for tier, (vals, target) in TIERS.items():
        n = sum(counts[v] for v in vals)
        flag = '' if abs(n - target) <= 1 else ' !!'
        if abs(n - target) > 1: ok = False; err(f"[{b}] tier {tier}={n}, target {target} (>1 off)")
        row.append(f"{tier[:5]} {n}[{target}]{flag}")
    print(f"  {b:8} " + "  ".join(row) + ("" if ok else "   <-- OUT OF TOLERANCE"))

# 4 signature uniqueness, globally
sig_owner = {}
for sid, s in new_species.items():
    sig = s['requirements'].get('signature')
    if not sig: err(f"{sid}: no signature object"); continue
    if sig in BANNED: err(f"{sid}: signature '{sig}' is a banned generic object")
    if sig not in s['requirements'].get('objects', {}): err(f"{sid}: signature '{sig}' not in its own objects")
    if sig in sig_owner: err(f"signature '{sig}' claimed by both {sig_owner[sig]} and {sid}")
    sig_owner[sig] = sid

# 4b signature exclusivity: no other species may require it
for sid, s in new_species.items():
    for o in s['requirements'].get('objects', {}):
        if o in sig_owner and sig_owner[o] != sid:
            err(f"{sid} requires '{o}', which is {sig_owner[o]}'s signature")

# 5 objects: count, banned usage, existence, biome availability
for sid, s in new_species.items():
    objs = s['requirements'].get('objects', {})
    if not (2 <= len(objs) <= 4): err(f"{sid}: {len(objs)} objects, expected 2-4")
    nb = [o for o in objs if o in BANNED]
    if len(nb) > 1: err(f"{sid}: {len(nb)} banned generic objects {nb}, max 1")
    for o in objs:
        if o not in new_objects: err(f"{sid}: requires unknown object '{o}'")
        elif s['biome'] not in new_objects[o].get('biomes', []):
            err(f"{sid}: object '{o}' not available in biome {s['biome']}")

# 6 every new object craftable or plantable
for b, d in builds.items():
    for o in d.get('newObjects', []):
        if o.get('plantable'):
            if 'plantCost' not in o or 'growSeconds' not in o:
                err(f"[{b}] plantable object {o['id']} missing plantCost/growSeconds")
        elif o['id'] not in new_recipes:
            err(f"[{b}] new object {o['id']} has no recipe and is not plantable")

# 7 recipe materials within biome resources
for b, d in builds.items():
    allowed = set(biomes[b]['resources']) | set(biomes[b]['digResources'])
    for r in d.get('newRecipes', []):
        for m in r.get('materials', {}):
            if m not in resource_ids: err(f"[{b}] recipe {r['id']}: unknown resource '{m}'")
            elif m not in allowed: err(f"[{b}] recipe {r['id']}: resource '{m}' not gatherable in {b}")

# 8 unlock reachability: object unlock minHealth <= minHealth of every requirer
requirers = collections.defaultdict(list)
for sid, s in new_species.items():
    for o in s['requirements'].get('objects', {}):
        requirers[o].append((sid, s['requirements']['minHealth']))
for oid, reqs in requirers.items():
    r = new_recipes.get(oid)
    if not r: continue
    u = r.get('unlock') or {}
    if 'minHealth' in u:
        lowest = min(h for _, h in reqs)
        if u['minHealth'] > lowest:
            who = [sid for sid, h in reqs if h == lowest][0]
            err(f"object '{oid}' unlocks at {u['minHealth']}% but {who} needs it at {lowest}%")
    if 'requiresAnimal' in u:
        gate = u['requiresAnimal']
        if gate not in new_species: err(f"object '{oid}' gated on unknown species '{gate}'")
        else:
            gh = new_species[gate]['requirements']['minHealth']
            for sid, h in reqs:
                if h < gh: err(f"object '{oid}' gated on {gate} ({gh}%) but {sid} needs it at {h}%")

# 9 prey gating ordering
for sid, s in new_species.items():
    for prey in s['requirements'].get('animals', []):
        if prey not in new_species: err(f"{sid}: prey gate '{prey}' is not a species")
        elif new_species[prey]['biome'] != s['biome']: err(f"{sid}: prey gate '{prey}' is in another biome")
        elif new_species[prey]['requirements']['minHealth'] >= s['requirements']['minHealth']:
            err(f"{sid} ({s['requirements']['minHealth']}%) gated on {prey} "
                f"({new_species[prey]['requirements']['minHealth']}%) which unlocks no earlier")

# 10 food web: symmetry, in-biome, no self
def edge_id(e): return e['id'] if isinstance(e, dict) else e
for sid, s in new_species.items():
    for e in s.get('eats', []) or []:
        p = edge_id(e)
        if p == sid: err(f"{sid} eats itself")
        elif p not in new_species: err(f"{sid} eats unknown species '{p}'")
        else:
            if new_species[p]['biome'] != s['biome']: err(f"{sid} eats '{p}' from another biome")
            if sid not in [edge_id(x) for x in (new_species[p].get('eatenBy') or [])]:
                err(f"asymmetry: {sid} eats {p} but {p}.eatenBy lacks {sid}")
    for e in s.get('eatenBy', []) or []:
        pr = edge_id(e)
        if pr not in new_species: err(f"{sid}.eatenBy has unknown species '{pr}'")
        elif sid not in [edge_id(x) for x in (new_species[pr].get('eats') or [])]:
            err(f"asymmetry: {sid}.eatenBy has {pr} but {pr}.eats lacks {sid}")

# 11 orphan report (informational, not an error)
orphans = [s for s in new_species.values()
           if not s.get('eatenBy') and s['trophic'] not in ('apex-predator', 'producer')]
no_food = [s for s in new_species.values()
           if not s.get('eats') and not s.get('eatsOther') and s['trophic'] != 'producer']

print("\n-- generic-object load (was: shrub 34, rock-pile 33, tidepool 20, dune-grass 17) --")
use = collections.Counter()
for s in new_species.values():
    for o in s['requirements'].get('objects', {}): use[o] += 1
for o in sorted(BANNED):
    print(f"  {o:26} {use[o]:3} species  (before: {sum(1 for x in old_species.values() if o in x['requirements'].get('objects', {}))})")

print(f"\n-- unlock chains --")
ra = [(k, v.get('unlock', {}).get('requiresAnimal')) for k, v in new_recipes.items()
      if (v.get('unlock') or {}).get('requiresAnimal')]
print(f"  recipes gated on a species returning: {len(ra)}  (before: 1)")
print(f"\n-- food web --")
print(f"  species with no predator (excl. apex/producer): {len(orphans)}  (before: 53)")
print(f"  species with no food source at all: {len(no_food)}")
print(f"  total edges: {sum(len(s.get('eats') or []) for s in new_species.values())}  (before: 310)")
print(f"\n-- content --")
print(f"  habitat objects: {len(new_objects)}  (before: {len(objects)})")
print(f"  recipes: {len(new_recipes)}  (before: {len(recipes)})")
print(f"  species replaced: {len(removed)}")

print("\n" + "=" * 72)
if errors:
    print(f"{len(errors)} ERROR(S):")
    for e in errors[:60]: print("  x", e)
    if len(errors) > 60: print(f"  ... and {len(errors)-60} more")
else:
    print("0 errors")
if warnings:
    print(f"\n{len(warnings)} warning(s):")
    for w in warnings[:20]: print("  !", w)

# ---- write merged files -------------------------------------------------------
if '--write' in sys.argv:
    for s in new_species.values():
        s.pop('changed', None); s.pop('changeNote', None)
    r1 = [new_species[i] for i in new_species if file_of.get(i) == 1]
    r2 = [new_species[i] for i in new_species if file_of.get(i) != 1]
    a1['records'], a2['records'] = r1, r2
    ho['records'] = list(new_objects.values())
    rc['records'] = list(new_recipes.values())
    for name, doc in [('animals-1.json', a1), ('animals-2.json', a2),
                      ('habitat-objects.json', ho), ('recipes.json', rc)]:
        json.dump(doc, open(os.path.join(OUT, name), 'w'), indent=2, ensure_ascii=False)
    # biome-level fixes flagged by the agents
    for b in biomes.values():
        if b['id'] == 'coastal':
            b['description'] = b['description'].replace('eastern edge', 'western edge')
            b['resources'] = [r for r in b['resources'] if r != 'coral']
            b['digResources'] = [r for r in b['digResources'] if r != 'coral']
    json.dump(bi, open(os.path.join(OUT, 'biomes.json'), 'w'), indent=2, ensure_ascii=False)
    print(f"\nwrote 5 files to {OUT}  (animals-1={len(r1)}, animals-2={len(r2)})")

"""Write the re-gated data/recipes.json (+ the two content gaps it exposed)."""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gates as G  # noqa: E402
from validate import main as validate

# ---- 17 habitats animals require that had no recipe at all (pre-existing gap:
# each one silently made its animal unreturnable). Costs mirror their siblings.
NEW = [
    ('snake-egg-mound',       'forest',  {'bark': 3, 'moss': 2, 'branches': 2}),
    ('bramble-ground-nest',   'forest',  {'branches': 3, 'fiber': 2}),
    ('elk-wallow',            'forest',  {'clay': 3, 'water': 3, 'moss': 2}),
    ('still-water-cove',      'wetland', {'mud': 2, 'clean-water': 3, 'reeds': 2}),
    ('eagle-nest-crown',      'wetland', {'branches': 8, 'reeds': 4, 'mud': 2}),
    ('tarantula-silk-burrow', 'desert',  {'sand': 3, 'clay': 2, 'fiber': 2}),
    ('saguaro-crown-nest',    'desert',  {'branches': 4, 'cactus-fruit': 3, 'sand': 3}),
    ('canyon-ledge-den',      'desert',  {'stones': 6, 'clay': 3, 'sand': 2}),
    ('moth-scree-crack',      'alpine',  {'stones': 4, 'lichen': 1}),
    ('winter-sleep-burrow',   'alpine',  {'stones': 3, 'clay': 2, 'fiber': 2}),
    ('swift-cliff-seam',      'alpine',  {'stones': 5, 'clay': 2, 'moss': 1}),
    ('goat-cliff-ledge',      'alpine',  {'stones': 7, 'clay': 3, 'lichen': 2}),
    ('deep-snow-den',         'alpine',  {'snow': 5, 'stones': 3, 'moss': 2}),
    ('alpine-mineral-lick',   'alpine',  {'clay': 4, 'stones': 2, 'snow': 2}),
    ('eelgrass-grazing-lawn', 'coastal', {'kelp': 4, 'sand': 3, 'water': 2}),
    ('breaking-surf-line',    'coastal', {'water': 4, 'sand': 3, 'shells': 2}),
    ('deep-canyon-edge',      'coastal', {'stones': 8, 'kelp': 4, 'driftwood': 3, 'water': 3}),
]
# a recipe that produced an item with no object definition (uncraftable-into-placeable)
ORPHAN_OBJ = {
    'id': 'bunchgrass-sod-plug', 'name': 'Bunchgrass Sod Plug', 'placement': 'outdoor',
    'biomes': ['meadow', 'alpine'], 'healthValue': 3, 'needs': ['plant', 'open'], 'shape': 'bunchgrass',
    'color': '#8aa85e',
    'description': 'A hand-cut plug of native bunchgrass, roots and soil together. Set it in bare ground and it spreads on its own.',
    'matureHours': 2, 'matureBonus': 1,
}

def write_json(path, obj):
    """data/*.json is hand-authored JSON (2-space, no trailing newline) — keep it that way."""
    open(path, 'w').write(json.dumps(obj, indent=2, ensure_ascii=False))

def patch_sources():
    """Add the missing recipes/object to the in-memory data before gating runs."""
    have = {r['output']['itemId'] for r in G.RECIPES}
    for oid, biome, mats in NEW:
        if oid in have: continue   # already applied — this pass is re-runnable
        o = G.OBJS[oid]
        G.RECIPES.append({'id': oid, 'name': o['name'], 'category': 'habitat', 'unlockBiome': biome,
                          'output': {'itemId': oid, 'qty': 1}, 'materials': mats})
    G.OBJS[ORPHAN_OBJ['id']] = ORPHAN_OBJ
    G.CRAFTABLE[:] = [r for r in G.RECIPES if not G.OBJS.get(r['output']['itemId'], {}).get('plantable')]
    G.PLANTABLE[:] = [r for r in G.RECIPES if G.OBJS.get(r['output']['itemId'], {}).get('plantable')]

def write():
    patch_sources()
    gates, stages, problems, notes = validate(verbose=True)
    if problems:
        print('\nREFUSING TO WRITE — unresolved problems above'); sys.exit(1)

    raw = json.load(open(os.path.join(G.ROOT, 'data/recipes.json')))
    by_id = {r['id']: r for r in raw['records']}
    order_key = {r['id']: i for i, r in enumerate(raw['records'])}
    records = []
    for r in G.RECIPES:
        src = by_id.get(r['id'])
        rec = dict(src) if src else dict(r)
        if r['id'] not in by_id:  # brand-new recipe
            rec = {'id': r['id'], 'name': r['name'], 'category': r['category'],
                   'unlockBiome': r['unlockBiome'], 'output': r['output'], 'materials': r['materials']}
        g = gates.get(r['id'], 'keep')
        if g == 'keep':          # plantables are planted, never crafted — leave them be
            pass
        elif g is None:
            rec.pop('unlock', None)
        else:
            rec['unlock'] = {k: g[k] for k in g if k != 'label'} | {'label': g['label']}
        # keep a stable, readable field order
        keys = ['id', 'name', 'category', 'unlockBiome', 'requiresTool', 'once', 'unlock', 'output', 'materials']
        records.append({k: rec[k] for k in keys if k in rec})
    records.sort(key=lambda r: (order_key.get(r['id'], 10_000 + G.ORDER.index(r['unlockBiome'])), r['id']))
    raw['records'] = records
    write_json(os.path.join(G.ROOT, 'data/recipes.json'), raw)

    ho = json.load(open(os.path.join(G.ROOT, 'data/habitat-objects.json')))
    if not any(o['id'] == ORPHAN_OBJ['id'] for o in ho['records']):
        ho['records'].append(ORPHAN_OBJ)
        write_json(os.path.join(G.ROOT, 'data/habitat-objects.json'), ho)

    print(f'\nwrote {len(records)} recipes ({len(NEW)} new) and 1 new habitat object')
    return gates, stages

if __name__ == '__main__':
    write()

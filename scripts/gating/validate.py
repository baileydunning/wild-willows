"""Reachability + pacing check for the generated recipe gates.

Everything is measured on one global scale: stage = biomeOrder*100 + health.
A gate's stage is the earliest point in the whole run at which it can be met.
"""
import json, collections, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import *   # noqa

INF = 10_000
STAGE = lambda b, h: ORDER.index(b) * 100 + h
TOOL_REQ = {}
for t in TOOLS.values():
    for tier in t['tiers']:
        TOOL_REQ[(t['id'], tier['tier'])] = tier.get('requires') or {}
HOME_REQ = {  # mirrored from HOME_TRACKS in server/resources.ts
    ('space', 2): ('meadow', 30), ('space', 3): ('forest', 45), ('space', 4): ('wetland', 55),
    ('comfort', 2): ('meadow', 35), ('comfort', 3): ('forest', 50), ('comfort', 4): ('wetland', 60),
    ('decor', 2): ('meadow', 0), ('decor', 3): ('meadow', 50), ('decor', 4): ('forest', 55),
    ('light', 2): ('meadow', 0), ('light', 3): ('forest', 45), ('light', 4): ('wetland', 55),
}
BUILD_HOME = STAGE('meadow', 30)
# total animals home by the time each area is opened (data/biomes.json unlock bars)
TOTAL_ANCHORS = [(1, STAGE('meadow', 8)), (10, STAGE('meadow', 60)), (25, STAGE('forest', 80)),
                 (45, STAGE('wetland', 80)), (65, STAGE('desert', 80)), (85, STAGE('alpine', 80)),
                 (150, STAGE('coastal', 100))]

def stage_for_total(n):
    prev = (0, 0)
    for cnt, st in TOTAL_ANCHORS:
        if n <= cnt:
            span = cnt - prev[0] or 1
            return int(prev[1] + (st - prev[1]) * (n - prev[0]) / span)
        prev = (cnt, st)
    return INF

def stage_for_ach(aid):
    a = ACHIEVEMENTS.get(aid)
    req = (a or {}).get('req') or {}
    t = req.get('t')
    if t == 'health': return STAGE(req['biome'], req['n'])
    if t == 'returned': return STAGE(req['biome'], health_for_nth(req['biome'], req['n']))
    if t == 'kindReturned': return STAGE(req['biome'], health_for_kind(req['biome'], req['kind'], req['n']))
    if t == 'animal':
        return max(STAGE(ANIMAL[i]['biome'], AH(ANIMAL[i])) for i in req['ids'])
    if t == 'total': return stage_for_total(req['n'])
    if t == 'biomesAtHealth': return STAGE(ORDER[min(5, req['n'] - 1)], req['h'])
    if t == 'tools': return STAGE('forest', 60)
    if t == 'tool':
        rq = TOOL_REQ.get((req['id'], req['n']), {})
        return STAGE(rq.get('biome', 'meadow'), rq.get('minHealth', 0))
    return STAGE(a['biome'] if a and a['biome'] in ORDER else 'forest', 50)  # effort-style

def build_stages(gates, recipe_by_id, obj_recipe):
    stages = {rid: 0 for rid in gates}
    distinct_curve = []
    for _ in range(4):  # fixed point: craftedDistinct depends on everyone else's stage
        distinct_curve = sorted(stages.values())
        new = {}
        for rid in gates:
            new[rid] = gate_stage(rid, gates, recipe_by_id, obj_recipe, stages, distinct_curve, set())
        if new == stages: break
        stages = new
    return stages

def gate_stage(rid, gates, recipe_by_id, obj_recipe, stages, distinct_curve, seen):
    if rid in seen: return INF
    g = gates.get(rid)
    r = recipe_by_id[rid]; b = r['unlockBiome']
    base = STAGE(b, 0)
    if not g: return base
    seen = seen | {rid}
    s = base
    up = lambda v: max(s, v)
    if 'minHealth' in g: s = up(STAGE(b, g['minHealth']))
    if 'minBalance' in g: s = up(STAGE(b, health_for_balance(b, g['minBalance'])))
    if 'animalsReturned' in g: s = up(STAGE(b, health_for_nth(b, g['animalsReturned'])))
    if 'requiresAnimal' in g:
        a = ANIMAL[g['requiresAnimal']]; s = up(STAGE(a['biome'], AH(a)))
    if 'requiresKind' in g:
        k = g['requiresKind']; s = up(STAGE(b, health_for_kind(b, k['kind'], k['count'])))
    if 'requiresCrafted' in g:
        pr = obj_recipe.get(g['requiresCrafted'])
        s = up(gate_stage(pr['id'], gates, recipe_by_id, obj_recipe, stages, distinct_curve, seen) if pr else INF)
    if 'requiresPlaced' in g:
        pid = g['requiresPlaced']['objectId']
        if not OBJS.get(pid, {}).get('plantable'):
            pr = obj_recipe.get(pid)
            s = up(gate_stage(pr['id'], gates, recipe_by_id, obj_recipe, stages, distinct_curve, seen) if pr else INF)
    if 'requiresTool' in g:
        rq = TOOL_REQ.get((g['requiresTool']['id'], g['requiresTool']['tier']), {})
        s = up(STAGE(rq.get('biome', b), rq.get('minHealth', 0)))
    if 'requiresHome' in g:
        hb, hh = HOME_REQ[(g['requiresHome']['track'], g['requiresHome']['level'])]
        s = up(max(STAGE(hb, hh), BUILD_HOME))
    if g.get('homeBuilt'): s = up(BUILD_HOME)
    # a live sky condition costs nothing but patience — it never blocks progress
    if 'requiresBiome' in g: s = up(STAGE(g['requiresBiome']['biome'], g['requiresBiome']['minHealth']))
    if 'totalAnimals' in g: s = up(stage_for_total(g['totalAnimals']))
    if 'requiresAchievement' in g: s = up(stage_for_ach(g['requiresAchievement']))
    if 'biomesOpen' in g: s = up(STAGE(ORDER[min(5, g['biomesOpen'] - 1)], 0))
    if 'craftedDistinct' in g:
        n = g['craftedDistinct']
        s = up(distinct_curve[min(len(distinct_curve) - 1, n - 1)] if distinct_curve else base)
    return s

def animal_prereq_stages():
    """Earliest stage each animal can actually be home, following the food web.

    An animal's own bar is its minHealth (plus whatever health its minBalance
    implies), but a prey requirement pushes it later: nothing returns before the
    animals it eats. Resolved to a fixed point so chains three or four deep
    (shrimp -> minnow -> mussel) settle, with cycles reported instead of hanging.
    """
    own = {}
    for a in ANIMALS:
        b = a['biome']
        h = max(AH(a), health_for_balance(b, a['requirements'].get('minBalance', 0) or 0))
        own[a['id']] = STAGE(b, h)
    stage = dict(own)
    cycles = []
    color = {}

    def walk(aid, path):
        if color.get(aid) == 2: return stage[aid]
        if color.get(aid) == 1:
            cycles.append(path[path.index(aid):] + [aid]); return INF
        color[aid] = 1
        s = own[aid]
        for prey in ANIMAL[aid]['requirements'].get('animals') or []:
            if prey not in ANIMAL: continue
            s = max(s, walk(prey, path + [aid]) + 1)  # +1: one animal returns per action
        color[aid] = 2
        stage[aid] = min(s, INF)
        return stage[aid]

    for a in ANIMALS: walk(a['id'], [])
    return stage, cycles


def check_food_web(problems, notes):
    """Every `requirements.animals` edge must be same-biome, acyclic and earlier."""
    stage, cycles = animal_prereq_stages()
    for c in cycles:
        problems.append('FOOD-WEB CYCLE: ' + ' -> '.join(c))
    for a in ANIMALS:
        for prey in a['requirements'].get('animals') or []:
            if prey not in ANIMAL:
                problems.append(f'{a["id"]}: requires unknown animal {prey}'); continue
            if prey == a['id']:
                problems.append(f'{a["id"]}: requires itself'); continue
            p = ANIMAL[prey]
            if p['biome'] != a['biome']:
                notes.append(f'CROSS-BIOME GATE: {a["id"]} ({a["biome"]}) requires {prey} ({p["biome"]})')
            if stage[prey] >= stage[a['id']]:
                problems.append(f'PREY DEADLOCK {a["id"]} ({a["biome"]} {AH(a)}%) requires {prey}, '
                                f'which is only reachable at stage {stage[prey]} (>= {stage[a["id"]]})')
            # a gate on something it doesn't eat is legal (cavity nesters need the
            # woodpecker; mussel larvae need a host fish) — just worth seeing listed
            eaten = {e['id'] if isinstance(e, dict) else e for e in a.get('eats') or []}
            if prey not in eaten:
                notes.append(f'NON-PREY GATE: {a["id"]} needs {prey} without eating it (host/cavity relationship?)')
    return stage


def main(verbose=True):
    gates, rep = run()
    recipe_by_id = {r['id']: r for r in RECIPES}
    obj_recipe = {r['output']['itemId']: r for r in RECIPES}
    stages = build_stages(gates, recipe_by_id, obj_recipe)
    problems, notes = [], []

    for rid, g in gates.items():
        if not g: continue
        b = recipe_by_id[rid]['unlockBiome']
        if 'requiresAnimal' in g and ANIMAL.get(g['requiresAnimal'], {}).get('biome') != b:
            problems.append(f'{rid}: requiresAnimal {g["requiresAnimal"]} is not a {b} animal')
        if 'requiresCrafted' in g and g['requiresCrafted'] not in obj_recipe:
            problems.append(f'{rid}: requiresCrafted {g["requiresCrafted"]} has no recipe')
        if 'requiresPlaced' in g and g['requiresPlaced']['objectId'] not in OBJS:
            problems.append(f'{rid}: requiresPlaced unknown object')
        if 'requiresAchievement' in g and g['requiresAchievement'] not in ACHIEVEMENTS:
            problems.append(f'{rid}: unknown achievement')
        if 'requiresTool' in g and (g['requiresTool']['id'], g['requiresTool']['tier']) not in TOOL_REQ:
            problems.append(f'{rid}: unknown tool tier')
        if stages[rid] >= INF: problems.append(f'{rid}: gate can never be satisfied')

    sigs = collections.Counter(sig(recipe_by_id[rid]['unlockBiome'], g) for rid, g in gates.items() if g)
    for s, n in sigs.items():
        if n > 1: problems.append(f'duplicate requirement ({n}x): {s}')

    for a in ANIMALS:
        astage = STAGE(a['biome'], AH(a))
        for oid in (a['requirements'].get('objects') or {}):
            if OBJS.get(oid, {}).get('plantable'): continue
            r = obj_recipe.get(oid)
            if not r:
                notes.append(f'CONTENT GAP: {a["id"]} needs {oid} — no recipe and not plantable'); continue
            st = stages.get(r['id'], 0)
            if st >= astage:
                problems.append(f'DEADLOCK {a["id"]} ({a["biome"]} {AH(a)}%) needs {oid}, '
                                f'which unlocks at stage {st} (>= {astage})')

    astage = check_food_web(problems, notes)

    if verbose:
        print('\nFood web (animals whose return is gated on other animals):')
        for b in ORDER:
            ans = [a for a in ANIMALS if a['biome'] == b]
            gated = [a for a in ans if a['requirements'].get('animals')]
            depth = max((astage[a['id']] - STAGE(b, AH(a)) for a in ans), default=0)
            tail = f'deepest chain delays a return by {depth} stages' if depth else 'no chain outruns its own health bar'
            print(f'  {b:<9} {len(gated):>3}/{len(ans):<3} gated on prey   {tail}')

        print('\nRecipes craftable as each area recovers (cumulative, own-area health):')
        print(f"{'health':>7} " + ' '.join(f'{b[:6]:>7}' for b in ORDER))
        for h in [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]:
            row = []
            for b in ORDER:
                rs = [r for r in CRAFTABLE if r['unlockBiome'] == b]
                row.append(sum(1 for r in rs if stages.get(r['id'], 0) <= STAGE(b, h)))
            print(f'{h:>6}% ' + ' '.join(f'{v:>7}' for v in row))
        tot = {b: sum(1 for r in CRAFTABLE if r['unlockBiome'] == b) for b in ORDER}
        late = {b: sum(1 for r in CRAFTABLE if r['unlockBiome'] == b and stages.get(r['id'], 0) > STAGE(b, 100))
                for b in ORDER}
        print('total per area:', tot)
        print('unlocking only after later areas (mastery items):', late)
        print(f'\n{len(problems)} problems, {len(notes)} content notes')
        for p in problems[:40]: print('  !', p)
        for n in dict.fromkeys(notes): print('  ~', n)
    return gates, stages, problems, notes

if __name__ == '__main__':
    main()

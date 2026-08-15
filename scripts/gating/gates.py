"""Re-gate every craftable recipe with a unique unlock condition.

Design goals (bailey's brief):
  * fewer recipes open at once, especially in the first hour
  * every recipe has its OWN requirement — no two share a signature
  * requirements pull from the whole game: health, balance, animals returning,
    kinds of animal, food-web totals, crafting chains, things you've placed,
    water you've shaped, tool tiers, home upgrades, achievements, other biomes
  * an object an animal NEEDS always unlocks well before that animal is reachable
"""
import json, collections, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = lambda p: json.load(open(os.path.join(ROOT, 'data', p)))['records']

RECIPES = D('recipes.json')
OBJS = {o['id']: o for o in D('habitat-objects.json')}
ANIMALS = D('animals-1.json') + D('animals-2.json')
BIOMES = {b['id']: b for b in D('biomes.json')}
TOOLS = {t['id']: t for t in D('tools.json')}
ACHIEVEMENTS = {a['id']: a for a in D('achievements.json')}

ORDER = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal']
BNAME = {b: BIOMES[b]['name'] for b in ORDER}

# ---------------------------------------------------------------- ecology model
# Animals come home roughly in order of the health they need. That order is the
# spine every other gate is measured against.
def animal_order(biome):
    ans = [a for a in ANIMALS if a['biome'] == biome]
    ans.sort(key=lambda a: (a['requirements'].get('minHealth', 0), a['requirements'].get('minBalance', 0), a['id']))
    return ans

AORDER = {b: animal_order(b) for b in ORDER}
ANIMAL = {a['id']: a for a in ANIMALS}
AH = lambda a: a['requirements'].get('minHealth', 0)

def health_for_nth(biome, n):
    """Own-biome health the player needs before the nth animal can be home."""
    ans = AORDER[biome]
    if n <= 0: return 0
    if n > len(ans): return 999
    return AH(ans[n - 1])

def balance_after(biome, n):
    """Mirror of computeBalance() for the first n animals in return order."""
    ans = AORDER[biome]
    total = len(ans)
    back = ans[:n]
    if n >= total: return 100
    preds = [a for a in ans if a['requirements'].get('animals')]
    preds_back = len([a for a in back if a['requirements'].get('animals')])
    web = preds_back / len(preds) if preds else 1
    kinds_all = {a.get('kind') for a in ans}
    kinds_back = {a.get('kind') for a in back}
    raw = 0.45 * (n / total) + 0.35 * web + 0.20 * (len(kinds_back) / len(kinds_all))
    return min(99, round(raw * 100))

def health_for_balance(biome, bal):
    for n in range(0, len(AORDER[biome]) + 1):
        if balance_after(biome, n) >= bal:
            return health_for_nth(biome, n)
    return 999

def kind_list(biome, kind):
    return [a for a in AORDER[biome] if a.get('kind') == kind]

def health_for_kind(biome, kind, n):
    ks = kind_list(biome, kind)
    if n > len(ks): return 999
    return AH(ks[n - 1])

# animal -> objects it needs; object -> earliest health at which it is needed
NEEDED_AT = {}
NEEDED_BY = collections.defaultdict(list)
for a in ANIMALS:
    for oid in (a['requirements'].get('objects') or {}):
        NEEDED_BY[oid].append(a['id'])
        NEEDED_AT[oid] = min(NEEDED_AT.get(oid, 999), AH(a))

# ------------------------------------------------------------- recipe grouping
CRAFTABLE = [r for r in RECIPES if not OBJS.get(r['output']['itemId'], {}).get('plantable')]
PLANTABLE = [r for r in RECIPES if OBJS.get(r['output']['itemId'], {}).get('plantable')]
KIT_IDS = {b['unlock']['requiresItem'] for b in BIOMES.values() if b.get('unlock')}

RES_TIER = {  # rough "how deep in the game is this material" weight
    'seeds': 0, 'fiber': 0, 'stones': 0, 'branches': 0, 'water': 0, 'berries': 0, 'wildflowers': 0, 'clay': 1,
    'bark': 1, 'moss': 1, 'mushrooms': 1, 'pinecones': 1, 'acorns': 1, 'reeds': 2, 'mud': 2, 'clean-water': 2,
    'sand': 2, 'cactus-fruit': 2, 'agave-nectar': 3, 'geode': 4, 'alpine-flowers': 3, 'quartz-crystal': 4,
    'pine-nuts': 3, 'lichen': 3, 'snow': 3, 'juniper-berries': 3, 'obsidian': 4, 'shells': 3, 'driftwood': 3,
    'kelp': 3, 'sea-glass': 4, 'coral': 4, 'pearl': 5, 'rainwater': 3, 'stormglass': 5, 'frostflower': 5,
    'dewdrops': 4, 'sunstone': 5,
}
CAT_WEIGHT = {'habitat': 0, 'decoration': 2, 'storage': 3, 'structure': 5, 'home': 4, 'gear': 6, 'kit': 8}

def complexity(r):
    m = r['materials']
    o = OBJS.get(r['output']['itemId'], {})
    return (sum(m.values()) + 3 * len(m) + 4 * max([RES_TIER.get(k, 2) for k in m] or [0])
            + 1.5 * (o.get('healthValue') or 0) + CAT_WEIGHT.get(r['category'], 3))

# --------------------------------------------------------------- target curve
def targets_for(biome):
    rs = [r for r in RECIPES if r['unlockBiome'] == biome and r in CRAFTABLE]
    comp = sorted(complexity(r) for r in rs)
    def pct(r):
        c = complexity(r)
        return comp.index(c) / max(1, len(comp) - 1)
    T = {}
    for r in rs:
        oid = r['output']['itemId']
        if oid in KIT_IDS:
            nxt = next((b for b in BIOMES.values() if b.get('unlock', {}) and b['unlock'].get('requiresItem') == oid), None)
            T[r['id']] = max(10, (nxt['unlock']['minHealth'] if nxt else 60) - 15)
        elif oid in NEEDED_AT:
            need = NEEDED_AT[oid]
            T[r['id']] = max(1, min(int(round(0.65 * need)), need - 6))
        else:
            T[r['id']] = int(round(10 + 72 * pct(r)))
    return rs, T

def ceiling_for(r):
    oid = r['output']['itemId']
    return (NEEDED_AT[oid] - 6) if oid in NEEDED_AT else 100

# ------------------------------------------------------------ gate difficulty
# Tool tiers and home tracks that mean something in each biome: the ones whose
# own requirement lives in THAT biome (so they read as real progress there), plus
# the top tiers, which are a genuine investment whenever you get to them.
TOOL_GATES = {
    'meadow':  [('shovel', 2, 30), ('watering-can', 2, 30), ('basket', 2, 40)],
    'forest':  [('watering-can', 3, 55), ('shovel', 3, 55), ('basket', 3, 60)],
    'wetland': [('shovel', 4, 65), ('basket', 4, 65), ('watering-can', 4, 65)],
    # Each area's own field guide, at the rung that opens the animal pages. (This
    # was one preserve-wide journal on a 7-tier ladder — tier 5/6/7 for these
    # three — before every area got a guide of its own.)
    'desert':  [('journal-desert', 2, 35)],
    'alpine':  [('journal-alpine', 2, 35)],
    'coastal': [('journal-coastal', 2, 35)],
}
HOME_GATES = {
    'meadow':  [('space', 2, 30), ('comfort', 2, 35), ('decor', 3, 50)],
    'forest':  [('light', 3, 45), ('space', 3, 45), ('decor', 4, 55)],
    'wetland': [('light', 4, 55), ('space', 4, 55), ('comfort', 4, 60)],
    'desert':  [('comfort', 4, 40), ('decor', 4, 40)],
    'alpine':  [('space', 4, 40), ('light', 4, 40)],
    'coastal': [('comfort', 4, 45), ('space', 4, 45)],
}
TOOL_TIER_NAME = {}
for t in TOOLS.values():
    for tier in t['tiers']:
        TOOL_TIER_NAME[(t['id'], tier['tier'])] = tier.get('name') or t['name']
HOME_TRACK_NAME = {'space': 'Space', 'comfort': 'Comfort', 'decor': 'Furnishings', 'light': 'Warmth'}
KIND_PLURAL = {'bird': 'birds', 'mammal': 'mammals', 'insect': 'insects', 'invertebrate': 'small invertebrates',
               'reptile': 'reptiles', 'amphibian': 'amphibians', 'fish': 'fish'}
PREV_BIOME = {b: ORDER[i - 1] for i, b in enumerate(ORDER) if i > 0}

# Hand-authored gates for the few items where quality-of-life beats pacing: the
# chests you store things in and the caretaker gear. These are chains, so each
# one still teaches the next.
OVERRIDES = {
    'small-chest':  {'minHealth': 6, 'requiresCrafted': 'grass-patch'},
    'medium-chest': {'minHealth': 15, 'requiresCrafted': 'small-chest'},
    'large-chest':  {'minHealth': 25, 'requiresCrafted': 'medium-chest'},
    'hiking-boots': {'animalsReturned': 8},
    'binoculars':   {'minHealth': 20, 'requiresTool': {'id': 'journal-meadow', 'tier': 2}},
    # the headlamp turns up the first time the sun goes down — the moment you
    # actually want one — and stays on the list from then on.
    'headlamp':     {'phaseSeen': ['night']},
    # The five area-opening kits are the critical path: the goals panel pins them,
    # and everything else waits on them. A plain health bar is the only gate that
    # explains itself at that moment — chaining one behind another crafted item
    # reads as a bug ("why can't I make the kit?"). Each sits well under its
    # area's own unlock bar (60/80/80/80/80).
    'forest-restoration-kit':    {'minHealth': 45},
    'wetland-restoration-kit':   {'minHealth': 65},
    'scrubland-restoration-kit': {'minHealth': 65},
    'alpine-restoration-kit':    {'minHealth': 65},
    'migration-path-marker':     {'minHealth': 65},
    # The meadow's two grass-and-forb plantings wait on the grasshopper — the first
    # thing the grass itself brings back, so its return is the moment the meadow
    # starts being a meadow. The health floors only exist to keep the two gates
    # distinct: validate.py rejects two recipes in one area sharing a requirement,
    # and squirrel-burrow-town already holds the bare grasshopper gate.
    'clover-patch':       {'requiresAnimal': 'grasshopper', 'minHealth': 10},
    'native-grass-patch': {'requiresAnimal': 'grasshopper', 'minHealth': 14},
    # The opening hour has to be buildable. None of these may sit behind a tool
    # upgrade, a home level, terraforming or a distinct-craft count — a new player
    # has none of those, and a habitat recipe they cannot reach reads as a bug.
    # Plain health is the only gate that explains itself at 10%.
    'shallow-water-pool': {'minHealth': 7},
    'picnic-blanket':     {'minHealth': 11},
    'stone-cairn':        {'minHealth': 13},
    'pinwheel':           {'minHealth': 15},
    'hollow-log':         {'minHealth': 17},
    'bird-perch':         {'minHealth': 18},
    'small-pond':         {'minHealth': 19},
    # Camp comforts do not unlock habitat. Picnic blankets, wind chimes and home
    # upgrade levels are how you make the camp yours; they have nothing to say
    # about whether a shrub or a den belongs in the world. Habitat waits on the
    # restoration itself.
    # (ALLOWED below now enforces this for future regenerations; these entries
    # only exist because data/recipes.json is currently hand-maintained.)
    'alpine-mineral-lick':         {'minHealth': 28},
    'canopy-nest-limb':            {'minHealth': 31},
    'clearwater-shallows':         {'minHealth': 24},
    'desert-mistletoe':            {'minHealth': 18},
    'haul-out-rocks':              {'minHealth': 28},
    'ledge-natal-den':             {'minHealth': 19},
    'sea-glass-path':              {'minHealth': 22},
    'serviceberry-browse-thicket': {'minHealth': 22},
    'shrub':                       {'minHealth': 34},
    'tree-stump':                  {'minHealth': 16},
    # a housewarming present to yourself — the first thing the meadow offers once
    # you stop living in the tent
    'happy-buddha': {'homeBuilt': True},
}

def article(name):
    if name.endswith('s') and not name.endswith('ss'): return ''   # "craft String Lights"
    return 'an' if name[:1].lower() in 'aeiou' else 'a'

def objname(oid):
    return (OBJS.get(oid) or {}).get('name') or oid

def plural(name):
    if name.endswith('s'): return name          # already plural ("Sap-Rich Stems")
    return name + ('es' if name.endswith(('x', 'ch', 'sh')) else 's')

# ------------------------------------------------------------------- labelling
def label_for(g, biome):
    bits = []
    if 'minHealth' in g: bits.append(f"restore {BNAME[biome]} to {g['minHealth']}% health")
    if 'minBalance' in g: bits.append(f"bring {BNAME[biome]} to {g['minBalance']}% ecological balance")
    if 'animalsReturned' in g: bits.append(f"welcome {g['animalsReturned']} animals back to {BNAME[biome]}")
    if 'requiresAnimal' in g: bits.append(f"welcome the {ANIMAL[g['requiresAnimal']]['name']} back to {BNAME[biome]}")
    if 'requiresKind' in g:
        k = g['requiresKind']; bits.append(f"welcome {k['count']} {KIND_PLURAL.get(k['kind'], k['kind'])} back to {BNAME[biome]}")
    if 'totalAnimals' in g: bits.append(f"welcome {g['totalAnimals']} animals back across the preserve")
    if 'requiresPlaced' in g:
        p = g['requiresPlaced']
        verb = 'growing' if OBJS.get(p['objectId'], {}).get('plantable') else 'standing'
        bits.append(f"have {p['count']} {plural(objname(p['objectId']))} {verb} in {BNAME[biome]}"
                    if p['count'] > 1 else
                    f"put {article(objname(p['objectId']))} {objname(p['objectId'])} in the ground in {BNAME[biome]}"
                    .replace('put  ', 'put '))
    if 'requiresWater' in g:
        w = g['requiresWater']
        if 'lake' in w: bits.append(f"shape a pond of {w['lake']} connected water tiles in {BNAME[biome]}")
        elif 'river' in w: bits.append(f"shape a channel {w['river']} tiles long in {BNAME[biome]}")
        else: bits.append(f"shape {w['tiles']} tiles of open water in {BNAME[biome]}")
    if 'requiresTool' in g:
        t = g['requiresTool']; bits.append(f"upgrade your {TOOLS[t['id']]['name']} to the {TOOL_TIER_NAME[(t['id'], t['tier'])]}")
    if 'requiresHome' in g:
        h = g['requiresHome']; bits.append(f"raise your home's {HOME_TRACK_NAME[h['track']]} to level {h['level']}")
    if g.get('homeBuilt'): bits.append('build yourself a home')
    if g.get('phaseSeen'):
        WHEN = {'night': 'your first nightfall', 'dusk': 'your first dusk',
                'dawn': 'your first dawn', 'day': 'your first daylight'}
        bits.append('see ' + ' or '.join(WHEN.get(p, p) for p in g['phaseSeen']))
    if 'requiresBiome' in g:
        b = g['requiresBiome']; bits.append(f"restore {BNAME[b['biome']]} to {b['minHealth']}% health")
    if 'biomesOpen' in g: bits.append(f"open {g['biomesOpen']} areas of the preserve")
    if 'requiresAchievement' in g: bits.append(f"earn the “{ACHIEVEMENTS[g['requiresAchievement']]['name']}” achievement")
    if 'craftedDistinct' in g: bits.append(f"craft {g['craftedDistinct']} different things")
    if 'requiresCrafted' in g:
        n = objname(g['requiresCrafted']); bits.append(f"craft {article(n)} {n}".replace('craft  ', 'craft '))
    s = ' and '.join(bits) if len(bits) < 3 else ', '.join(bits[:-1]) + ', and ' + bits[-1]
    return s[0].upper() + s[1:]

# ------------------------------------------------------------------- families
# Not every requirement suits every object: a rug shouldn't ask you to dig a
# pond, and a footpath shouldn't wait on the food web.
QUOTA_KEYS = ['health', 'chain', 'animal', 'placed', 'kind', 'balance', 'count',
              'tool', 'home', 'water', 'cross', 'total', 'achv', 'distinct', 'open']
ALLOWED = {
    # Camp comforts do not unlock habitat. How snug your house is says nothing
    # about whether a shrub or a den belongs in the world, so 'home' is off the
    # table here — and the 'placed' builder below will only ask for habitat.
    'habitat':    set(QUOTA_KEYS) - {'home'},
    'structure':  set(QUOTA_KEYS),
    'home':       {'health', 'chain', 'home', 'tool', 'distinct', 'animal', 'kind', 'count', 'balance',
                   'achv', 'cross', 'total', 'open'},
    'decoration': {'health', 'chain', 'placed', 'tool', 'distinct', 'home', 'count'},
    'storage':    {'health', 'chain', 'count', 'tool', 'home', 'distinct'},
    'gear':       {'health', 'chain', 'tool', 'animal', 'count', 'distinct', 'achv', 'placed', 'kind'},
    'kit':        {'health', 'chain'},
}
WATER_OK = lambda o: 'water' in (o.get('needs') or [])

BANDS = {
    'health':      (3, 95), 'chain':   (8, 95), 'animal': (6, 95), 'placed': (6, 70),
    'kind':        (18, 95), 'balance': (22, 95), 'count': (10, 95), 'tool':  (18, 95),
    'home':        (18, 95), 'water':   (8, 95), 'cross': (42, 100), 'total': (45, 100),
    'achv':        (38, 100), 'distinct': (22, 100), 'open': (35, 100),
}
QUOTA = {
    'health': .26, 'chain': .17, 'animal': .14, 'placed': .09, 'kind': .05, 'balance': .05,
    'count': .05, 'tool': .04, 'home': .04, 'water': .035, 'cross': .025, 'total': .02,
    'achv': .02, 'distinct': .02, 'open': .015,
}
WATER_SHAPES = [('tiles', [4, 6, 8, 10, 12, 14]), ('lake', [4, 5, 6, 8, 10]), ('river', [6, 8, 10, 12])]

def near(options, target):
    """(value, diff) pairs -> the one whose diff sits closest to target."""
    return min(options, key=lambda o: (abs(o[1] - target), o[1]))

class Assigner:
    def __init__(self, biome):
        self.b = biome
        self.rs, self.T = targets_for(biome)
        self.rs.sort(key=lambda r: (self.T[r['id']], complexity(r), r['id']))
        self.diff = {}          # recipe id -> realized difficulty (own-biome health equivalent)
        self.gates = {}         # recipe id -> gate dict
        self.used_animals = set()
        self.used_ach = set()
        self.used = collections.Counter()
        self.tool_i = self.home_i = self.water_i = self.cross_i = 0

    # ---- prerequisite pickers
    def earlier(self, r, maxdiff):
        oid = r['output']['itemId']
        out = []
        for p in self.rs:
            if p['id'] == r['id'] or p['id'] not in self.gates: continue
            if p['output']['itemId'] in KIT_IDS or p.get('once'): continue
            if self.diff.get(p['id'], 999) > maxdiff: continue
            share = len(set(p['materials']) & set(r['materials']))
            same = 1 if p['category'] == r['category'] else 0
            out.append((-(share + same), -self.diff.get(p['id'], 0), p))
        out.sort(key=lambda x: (x[0], x[1], x[2]['id']))
        return [o[2] for o in out]

    def plantables_here(self):
        return [p['output']['itemId'] for p in PLANTABLE if p['unlockBiome'] == self.b]

    # ---- gate builders (return (gate, difficulty) or None)
    GLOBAL_FAMS = {'cross', 'total', 'achv', 'distinct', 'open'}

    def build(self, fam, r, T, ceil):
        b, oid = self.b, r['output']['itemId']
        # An object an animal NEEDS can never hang off preserve-wide progress —
        # that would let a gate outrank the very animal it is meant to serve.
        if fam in self.GLOBAL_FAMS and ceil < 100: return None
        if fam == 'health':
            h = max(3, min(T, ceil)); return ({'minHealth': h}, h)
        if fam == 'chain':
            h = max(3, min(T, ceil))
            for p in self.earlier(r, max(0, h - 3)):
                return ({'minHealth': h, 'requiresCrafted': p['output']['itemId']}, h)
            return None
        if fam == 'animal':
            cands = [(a, AH(a)) for a in AORDER[b]
                     if AH(a) <= ceil and a['id'] not in self.used_animals
                     and oid not in (a['requirements'].get('objects') or {})]
            if not cands: return None
            a, h = near(cands, T); self.used_animals.add(a['id'])
            return ({'requiresAnimal': a['id']}, h)
        if fam == 'count':
            cands = [(n, health_for_nth(b, n)) for n in range(2, len(AORDER[b]) + 1) if health_for_nth(b, n) <= ceil]
            if not cands: return None
            n, h = near(cands, T); return ({'animalsReturned': n}, h)
        if fam == 'kind':
            cands = []
            for k in KIND_PLURAL:
                for n in range(2, len(kind_list(b, k)) + 1):
                    hh = health_for_kind(b, k, n)
                    if hh <= ceil: cands.append(((k, n), hh))
            if not cands: return None
            (k, n), h = near(cands, T); return ({'requiresKind': {'kind': k, 'count': n}}, h)
        if fam == 'balance':
            cands = [(bal, health_for_balance(b, bal)) for bal in range(10, 70, 5) if health_for_balance(b, bal) <= ceil]
            if not cands: return None
            bal, h = near(cands, T); return ({'minBalance': bal}, h)
        if fam == 'placed':
            # A habitat recipe may ask for more habitat standing in the area, never
            # for camp comforts: "3 picnic blankets" is a chore, not restoration.
            # healthValue > 0 is exactly the line between the two.
            want_habitat = (r.get('category') == 'habitat')
            pool = [(p['output']['itemId'], self.diff[p['id']]) for p in self.rs
                    if p['id'] in self.gates and self.diff[p['id']] <= max(0, min(T, ceil) - 4)
                    and not OBJS.get(p['output']['itemId'], {}).get('onePerArea')
                    and (not want_habitat or (OBJS.get(p['output']['itemId'], {}).get('healthValue') or 0) > 0)
                    and (OBJS.get(p['output']['itemId'], {}).get('placement') in ('outdoor', 'both'))]
            pool += [(pid, 4) for pid in self.plantables_here() if min(T, ceil) >= 8]
            if not pool: return None
            pid, d0 = near(pool, max(0, T - 6))
            count = 2 if T < 25 else (3 if T < 50 else 4)
            return ({'requiresPlaced': {'objectId': pid, 'count': count}}, min(ceil, max(d0 + 4, T)))
        if fam == 'tool':
            opts = [((tid, tier), h if h <= 100 else 0) for tid, tier, h in TOOL_GATES[b]]
            opts = [o for o in opts if o[1] <= ceil]
            if not opts: return None
            (tid, tier), h = opts[self.tool_i % len(opts)]; self.tool_i += 1
            return ({'requiresTool': {'id': tid, 'tier': tier}}, h)
        if fam == 'home':
            opts = [((tr, lv), h) for tr, lv, h in HOME_GATES[b] if h <= ceil]
            if not opts: return None
            (tr, lv), h = opts[self.home_i % len(opts)]; self.home_i += 1
            return ({'requiresHome': {'track': tr, 'level': lv}}, h)
        if fam == 'water':
            kind, vals = WATER_SHAPES[self.water_i % len(WATER_SHAPES)]; self.water_i += 1
            v = vals[min(len(vals) - 1, max(0, int(T / 18)))]
            return ({'requiresWater': {kind: v}}, min(ceil, max(T, 8)))
        if fam == 'cross':
            others = [x for x in ORDER if x != b]
            prev = [x for x in others if ORDER.index(x) < ORDER.index(b)]
            pool = prev or others[:2]
            tgt = pool[self.cross_i % len(pool)]; self.cross_i += 1
            h = 85 + 5 * (self.cross_i % 3)
            return ({'requiresBiome': {'biome': tgt, 'minHealth': h}}, min(ceil, max(T, 55)))
        if fam == 'total':
            n = [30, 55, 75, 95, 110, 125][ORDER.index(b)] + 5 * (self.used['total'])
            return ({'totalAnimals': min(140, n)}, min(ceil, max(T, 55)))
        if fam == 'achv':
            cands = [a for a in ACHIEVEMENTS.values()
                     if a['id'] not in self.used_ach and a['biome'] in (b, 'preserve') and not a.get('hidden')]
            if not cands: return None
            a = sorted(cands, key=lambda a: (a['biome'] != b, a.get('order', 0)))[0]
            self.used_ach.add(a['id'])
            return ({'requiresAchievement': a['id']}, min(ceil, max(T, 45)))
        if fam == 'distinct':
            n = [14, 26, 38, 50, 62, 74][ORDER.index(b)] + 6 * self.used['distinct']
            return ({'craftedDistinct': n}, min(ceil, max(T, 30)))
        if fam == 'open':
            n = min(6, ORDER.index(b) + 1 + (1 if T > 60 else 0))
            if n < 2: return None
            return ({'biomesOpen': n}, min(ceil, max(T, 40)))
        return None

def sig(biome, g):
    return biome + '|' + json.dumps({k: v for k, v in sorted(g.items()) if k != 'label'}, sort_keys=True)

NUDGE_KEYS = ['minHealth', 'minBalance', 'animalsReturned', 'totalAnimals', 'craftedDistinct']

def run():
    seen = set()
    out = {}
    reports = {}
    for b in ORDER:
        A = Assigner(b)
        n_total = len(A.rs)
        pool = [r for r in A.rs if r['output']['itemId'] not in KIT_IDS]
        starters = [r for r in pool if r['category'] == 'habitat'][:3] or pool[:3]
        starter_ids = {r['id'] for r in starters}
        for r in starters:
            out[r['id']] = None
            A.gates[r['id']] = {}
            A.diff[r['id']] = 0
        rest = [r for r in A.rs if r['id'] not in starter_ids]
        for rid, og in OVERRIDES.items():
            if any(r['id'] == rid for r in rest): seen.add(sig(b, og))
        picks = collections.Counter()
        for i, r in enumerate(rest):
            T, ceil = A.T[r['id']], ceiling_for(r)
            oid = r['output']['itemId']
            # biome-unlock kits keep a plain, legible gate: a health floor plus a
            # crafting chain, always comfortably under the biome's own unlock bar
            if r['id'] in OVERRIDES:
                g, fam = (dict(OVERRIDES[r['id']]), max(T, 1)), 'authored'
            else:
                done = sum(picks.values()) or 1
                order = sorted(QUOTA, key=lambda f: (picks[f] / done) - QUOTA[f])
                g, fam = None, None
                cat = r['category']
                obj = OBJS.get(oid, {})
                for f in order:
                    lo, hi = BANDS[f]
                    if not (lo <= T <= hi): continue
                    if f not in ALLOWED.get(cat, set(QUOTA)): continue
                    if f == 'water' and not WATER_OK(obj): continue
                    got = A.build(f, r, T, ceil)
                    if got: g, fam = got, f; break
                if g is None:
                    g, fam = A.build('health', r, T, ceil), 'health'
            gate, d = g
            # ---- uniqueness: no two recipes may share a requirement
            if fam == 'authored':
                seen.add(sig(b, gate))
                gate['label'] = label_for(gate, b)
                out[r['id']] = gate; A.gates[r['id']] = gate; A.diff[r['id']] = min(d, ceil)
                picks[fam] += 1
                continue
            if sig(b, gate) in seen:
                for p in A.earlier(r, max(0, min(T, ceil) - 3))[:6]:
                    if 'requiresCrafted' in gate: break
                    trial = dict(gate, requiresCrafted=p['output']['itemId'])
                    if sig(b, trial) not in seen: gate = trial; break
            if sig(b, gate) in seen:
                for k in NUDGE_KEYS:
                    if k not in gate: continue
                    for delta in (1, -1, 2, -2, 3, -3, 4, 5):
                        v = gate[k] + delta
                        if v < 1 or (k == 'minHealth' and v > min(ceil, 95)): continue
                        trial = dict(gate); trial[k] = v
                        if sig(b, trial) not in seen: gate = trial; d = v if k == 'minHealth' else d; break
                    if sig(b, gate) not in seen: break
            if sig(b, gate) in seen:  # last resort: a distinct health floor
                for h in range(max(3, min(T, ceil)), 0, -1):
                    trial = {'minHealth': h}
                    if sig(b, trial) not in seen: gate, d, fam = trial, h, 'health'; break
            OWN = ('minHealth', 'minBalance', 'animalsReturned', 'requiresAnimal', 'requiresKind')
            if fam != 'authored' and not any(k in gate for k in OWN):
                gate = {'minHealth': max(3, min(int(round(0.6 * T)), ceil))} | gate
                d = max(d, gate['minHealth'])
            seen.add(sig(b, gate))
            gate['label'] = label_for(gate, b)
            out[r['id']] = gate
            A.gates[r['id']] = gate
            A.diff[r['id']] = min(d, ceil)
            picks[fam] += 1
        reports[b] = dict(total=n_total, starters=[r['id'] for r in starters], picks=dict(picks),
                          assigner=A)
    return out, reports

if __name__ == '__main__':
    gates, rep = run()
    for b in ORDER:
        r = rep[b]
        print(f"\n=== {b}: {r['total']} craftable recipes · starters {r['starters']}")
        print('   families:', dict(sorted(r['picks'].items(), key=lambda kv: -kv[1])))

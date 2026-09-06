// Wild Willows — server: home coziness
//
// Decorating your house used to be worth exactly nothing. The four upgrade
// tracks were the only thing the style perk read, so a room with nineteen
// carefully-placed pieces played identically to an empty one — the Your Home
// card counted your furniture and then quietly told you it didn't matter.
//
// Coziness is the answer: a 0–100 reading of the room itself, climbing five
// named tiers, each one strengthening the house perk AND adding carry. It is
// deliberately NOT a count of things. Nineteen identical stools is a storeroom,
// so the score is three parts, weighted hard toward VARIETY:
//
//   PIECES   how much is in the room at all   (15 pts, maxed at 50 pieces)
//   VARIETY  how many DIFFERENT things        (55 pts, maxed at 44 kinds of thing)
//   BALANCE  how many KINDS of comfort        (30 pts, all nine covered)
//
// On top of that raw reading, the FURNISHINGS upgrade track multiplies what the
// room is worth (`cozyBoost` in HOME_TRACKS) — the one thing that makes maxing
// out reachable, and the reason Furnishings is now an upgrade you'd actually
// buy rather than a nicer rug.
//
// Eighty-five of the hundred points are for range, so filling a room with
// copies of the one thing you can afford gets you almost nowhere while a room
// of thirty different things — which is a room that looks like someone lives in
// it — gets you everything. Deliberately a LONG climb: a well-decorated house of
// ~19 pieces of ~18 types sits at Snug, and Beloved wants around forty
// DIFFERENT pieces out at once (or thirty with Furnishings maxed), because a
// top rung you reach in an afternoon is not a thing anyone keeps decorating
// for. For scale: nineteen identical stools scores 10 — still Bare — where the
// same nineteen chosen for range scores 58.
//
// PURE MODULE — no imports, no database, no Harper globals. Both sides read it:
// the server for the buffs (server/home.ts), and the HUD for the live meter
// (src/ui/HUD.tsx), which is why it isn't simply part of home.ts. The client
// recomputes from the placements it already has, so the bar moves the instant
// you set something down rather than on the next round trip.

/** The nine kinds of comfort a room can cover. Order is display order. */
export const COZY_KINDS = [
	'sleeping',
	'seating',
	'surface',
	'storage',
	'light',
	'greenery',
	'water',
	'art',
	'curio',
] as const;
export type CozyKind = (typeof COZY_KINDS)[number];

/** A tier of home coziness — the named rung, and what standing on it buys. */
export interface CozyTierDef {
	id: 'bare' | 'homey' | 'snug' | 'cozy' | 'beloved' | 'storied';
	/** Minimum score to stand on this rung. */
	min: number;
	/** Added to the house style's perk strength (0..1), ON TOP of its cap. */
	perk: number;
	/** Flat carry capacity, added to the Comfort track's bonus. Sized against the
	 *  basket ladder (200 → 2000), not against pocket change: a Beloved home is
	 *  worth more than a whole basket tier, because it costs more to earn. */
	carry: number;
	/** Walking-speed multiplier while WELL RESTED — see restedSpeed(). 1 = none. */
	speed: number;
}

/** Six rungs, lowest first. `bare` is the floor and grants nothing; `storied`
 *  is the late one, and is not reachable at all without the Showcase ability
 *  (Furnishings 7) — see cozyTierAt(). */
export const COZY_TIERS: CozyTierDef[] = [
	{ id: 'bare', min: 0, perk: 0, carry: 0, speed: 1 },
	{ id: 'homey', min: 18, perk: 0.03, carry: 60, speed: 1.05 },
	{ id: 'snug', min: 38, perk: 0.06, carry: 160, speed: 1.1 },
	{ id: 'cozy', min: 62, perk: 0.1, carry: 320, speed: 1.16 },
	{ id: 'beloved', min: 86, perk: 0.15, carry: 550, speed: 1.24 },
	{ id: 'storied', min: 100, perk: 0.22, carry: 900, speed: 1.34 },
];

/**
 * The RAW score a room must reach to be Storied, on top of owning Showcase.
 *
 * Deliberately measured on the raw reading rather than the boosted one, which
 * is the opposite of every rung below it. The Furnishings multiplier is what
 * carries a good room to Beloved; the top rung is not for sale. Ninety-five raw
 * is a room with essentially everything out — with Curator's Eye (the level
 * before it) that is around thirty different pieces covering eight of the nine
 * comforts, and without it it is not really reachable at all. The last rung
 * should be the one you EARNED by decorating, or it is just another number the
 * upgrade bought for you.
 */
export const STORIED_RAW = 95;

/** What the late Furnishings abilities change about the reading. Both come from
 *  the upgrade track (see HOME_ABILITIES in src/homeAbilities.ts); both halves
 *  of the game pass the same pair in, so the meter and the buff agree. */
export interface CozyOpts {
	/** Curator's Eye (Furnishings 6): variety and balance pay far sooner. */
	curator?: boolean;
	/** Showcase (Furnishings 7): the `storied` rung exists for this room. */
	showcase?: boolean;
}

// Component ceilings. They sum to 100 — a perfect room is a full bar, not a
// number that keeps climbing past the last tier for no reward.
const PIECES_CAP = 15;
const PIECES_FULL = 50; // pieces at which PIECES_CAP is reached
const VARIETY_CAP = 55;
const VARIETY_FULL = 44; // distinct object types at which VARIETY_CAP is reached
const BALANCE_CAP = 30;

// Curator's Eye (Furnishings 6) moves those three posts closer. It is not a
// multiplier — the multiplier is what the track already sold you four times —
// it is the same climb made walkable at the point where the climb had become
// the thing standing between a well-decorated house and the top of the meter:
// a full variety score wanted forty-four DIFFERENT things out at once, and the
// game has 77 indoor objects to find. Eight comforts of nine now reads as
// balanced, because the ninth is usually water, and not every house wants a pond.
const CURATOR_PIECES_FULL = 38;
const CURATOR_VARIETY_FULL = 30;
const CURATOR_BALANCE_FULL = 8;

/**
 * Which comfort a piece of furniture provides.
 *
 * Definitions may say so outright (`cozyKind` in data/habitat-objects.json),
 * which is the answer for anything whose purpose isn't visible in its other
 * flags. Everything else is derived from what the object already IS, so a new
 * indoor object added later scores something sensible on the day it ships
 * rather than silently counting as nothing:
 *
 *   wall-mounted → art        (pictures, clocks, hangings)
 *   plantable / yields → greenery
 *   a surface → surface       (tables, shelves, benches to put things on)
 *   a chest → storage
 *   anything else → curio     (the trinkets, and the honest unknown)
 */
export function cozyKindOf(def: any): CozyKind {
	const named = def?.cozyKind;
	if (named && (COZY_KINDS as readonly string[]).includes(named)) return named as CozyKind;
	if (def?.mount === 'wall') return 'art';
	if (def?.plantable || def?.yield) return 'greenery';
	if (def?.isChest) return 'storage';
	if (def?.surface) return 'surface';
	return 'curio';
}

/** A room's coziness, everything the HUD and the buffs need in one shape. */
export interface CozyReading {
	/** 0..100, rounded. */
	score: number;
	/** Index into COZY_TIERS. */
	tier: number;
	tierId: CozyTierDef['id'];
	/** Total things standing in the room. */
	pieces: number;
	/** Distinct object types. */
	types: number;
	/** Which comforts are covered, in COZY_KINDS order. */
	kinds: CozyKind[];
	/** Perk bonus this tier grants (0..1). */
	perk: number;
	/** Carry bonus this tier grants. */
	carry: number;
	/** Well-rested walking-speed multiplier this tier grants (1 = none). */
	speed: number;
	/** Score at which the next tier begins, or null at the top. */
	nextAt: number | null;
	/** The score BEFORE the Furnishings multiplier, so the track's contribution
	 *  can be shown and so the save can store a boost-independent number. */
	raw: number;
}

/** The empty room — what a save with no home placements reads as. */
export const EMPTY_COZY: CozyReading = {
	score: 0,
	tier: 0,
	tierId: 'bare',
	pieces: 0,
	types: 0,
	kinds: [],
	perk: 0,
	carry: 0,
	speed: 1,
	nextAt: COZY_TIERS[1].min,
	raw: 0,
};

/**
 * The tier index a room stands on.
 *
 * The first five rungs are the boosted `score`, exactly as they always were.
 * The sixth is the exception, and takes both of its conditions: the room must
 * own Showcase, and its RAW reading must have reached STORIED_RAW on its own.
 * Passing no opts can therefore never return `storied`, which is what keeps
 * every existing save — and every caller that has not been taught about the
 * abilities yet — reading exactly as it did.
 */
export function cozyTierAt(score: number, raw = score, opts: CozyOpts = {}): number {
	let idx = 0;
	const top = COZY_TIERS.length - 1; // `storied` — never reached by score alone
	for (let i = 0; i < top; i++) if (score >= COZY_TIERS[i].min) idx = i;
	if (opts.showcase && raw >= STORIED_RAW) idx = top;
	return idx;
}

/**
 * Read the coziness of a room.
 *
 * `placements` is every placement in the home interior (the caller filters by
 * area — this function does not know about areas). `lookup` resolves an object
 * id to its definition; on the client that's `data.object`-shaped, on the
 * server it's `d.object.get`. An id that resolves to nothing still counts as a
 * piece — something IS standing there — it just lands in `curio`.
 *
 * `boost` is the Furnishings multiplier (0..1) from HOME_TRACKS.decor — it
 * scales the raw reading, and the unscaled number rides back as `raw`.
 */
export function readCoziness(
	placements: Array<{ objectId: string }>,
	lookup: (objectId: string) => any,
	boost = 0,
	opts: CozyOpts = {},
): CozyReading {
	if (!placements?.length) return { ...EMPTY_COZY };
	const types = new Set<string>();
	const kinds = new Set<CozyKind>();
	for (const p of placements) {
		if (!p?.objectId) continue;
		types.add(p.objectId);
		kinds.add(cozyKindOf(lookup(p.objectId)));
	}
	const pieces = placements.length;
	// Curator's Eye moves the three posts closer; everything else about the
	// climb — the weights, the ceilings, the shape of it — is untouched.
	const piecesFull = opts.curator ? CURATOR_PIECES_FULL : PIECES_FULL;
	const varietyFull = opts.curator ? CURATOR_VARIETY_FULL : VARIETY_FULL;
	const balanceFull = opts.curator ? CURATOR_BALANCE_FULL : COZY_KINDS.length;
	const piecePts = Math.min(PIECES_CAP, (pieces / piecesFull) * PIECES_CAP);
	const varietyPts = Math.min(VARIETY_CAP, (types.size / varietyFull) * VARIETY_CAP);
	const balancePts = Math.min(BALANCE_CAP, (kinds.size / balanceFull) * BALANCE_CAP);
	const raw = Math.round(Math.min(100, piecePts + varietyPts + balancePts));
	const score = Math.min(100, Math.round(raw * (1 + Math.max(0, boost))));
	const tier = cozyTierAt(score, raw, opts);
	const def = COZY_TIERS[tier];
	return {
		score,
		raw,
		tier,
		tierId: def.id,
		pieces,
		types: types.size,
		kinds: COZY_KINDS.filter((k) => kinds.has(k)),
		perk: def.perk,
		carry: def.carry,
		speed: def.speed,
		nextAt: COZY_TIERS[tier + 1]?.min ?? null,
	};
}

/**
 * Read a stored reading off a player row, tolerating saves that predate it.
 *
 * `boost` (the Furnishings multiplier) is applied HERE rather than baked into
 * what was stored, so buying the upgrade raises the buff immediately instead of
 * waiting for the next time someone moves a chair.
 */
export function cozyOf(player: any, boost = 0, opts: CozyOpts = {}): CozyReading {
	const c = player?.homeCozy;
	if (!c || typeof c.score !== 'number') return { ...EMPTY_COZY };
	// Tier effects are re-derived from the score rather than trusted as stored,
	// so retuning COZY_TIERS retunes every existing save without a migration.
	//
	// The stored raw is written WITH whatever Curator's Eye state the save had at
	// the time — the ability changes how the raw score is computed, so it cannot
	// be applied on the way out the way the multiplier is. Buying it rewrites the
	// cache on the spot (see UpgradeHome), which is what keeps this in step with
	// the meter on the HUD, since that recomputes from the placements it holds.
	const raw = c.score;
	const score = Math.min(100, Math.round(raw * (1 + Math.max(0, boost))));
	const tier = cozyTierAt(score, raw, opts);
	const def = COZY_TIERS[tier];
	return {
		score,
		raw,
		tier,
		tierId: def.id,
		pieces: c.pieces || 0,
		types: c.types || 0,
		kinds: Array.isArray(c.kinds) ? c.kinds : [],
		perk: def.perk,
		carry: def.carry,
		speed: def.speed,
		nextAt: COZY_TIERS[tier + 1]?.min ?? null,
	};
}

/**
 * The walking-speed multiplier a WELL RESTED caretaker moves at.
 *
 * Sleeping in a home you have actually made comfortable sends you out the door
 * quicker, and the boost lasts through the morning — `restedUntil` is a play-
 * time stamp set to the next noon when you wake (see the Rest endpoint), so a
 * night in a Beloved house buys the whole first half of the day at +24%.
 *
 * A bare room grants nothing, which is the point: this is the buff you can feel
 * on the very next step, and it is the one decorating buys you outright.
 * Multiplies with the hiking boots rather than replacing them.
 */
export function restedSpeed(player: any, playTime: number, boost = 0, opts: CozyOpts = {}): number {
	const until = Number(player?.restedUntil) || 0;
	if (!until || playTime >= until) return 1;
	return cozyOf(player, boost, opts).speed;
}

/** The stored shape on the player row. Deliberately small: the buffs are
 *  re-derived from `score` on every read (see cozyOf), so nothing here can
 *  drift out of step with a retuned tier table. */
export interface StoredCozy {
	score: number;
	pieces: number;
	types: number;
	kinds: CozyKind[];
}

/** Reduce a fresh reading to what gets written to the save. Stores the RAW
 *  score — the Furnishings multiplier is applied on read (see cozyOf), so an
 *  upgrade takes effect the moment it is bought. */
export function storedCozy(r: CozyReading): StoredCozy {
	return { score: r.raw, pieces: r.pieces, types: r.types, kinds: r.kinds };
}

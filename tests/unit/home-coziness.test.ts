import { describe, it, expect } from 'vitest';
import objectsData from '../../data/habitat-objects.json';
import {
	COZY_KINDS,
	COZY_TIERS,
	STORIED_RAW,
	cozyKindOf,
	cozyOf,
	readCoziness,
	restedSpeed,
	storedCozy,
} from '../../server/cozy';
import { HOME_TRACKS, homeCarryBonus, homeCozy, homeCozyBoost, homePerk, homeRestedHold } from '../../server/home';

// What this covers: decorating your home used to be worth nothing at all — the
// style perk read the four upgrade tracks and ignored the room. Coziness is the
// buff that reads the room, so these tests are mostly about the SHAPE of the
// reward: that variety beats hoarding, that the buff can go back down, and that
// the three payouts (perk, carry, morning speed) actually land on the player.

const DEFS: any[] = (objectsData as any).records;
const byId = new Map(DEFS.map((o) => [o.id, o]));
const lookup = (id: string) => byId.get(id);
const place = (...ids: string[]) => ids.map((objectId) => ({ objectId }));

/** A built house at a given set of track levels, with a stored reading on it. */
const saveWith = (ids: string[], home: any = {}) => ({
	home: { style: 'cottage', space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true, ...home },
	homeCozy: storedCozy(readCoziness(place(...ids), lookup)),
});

describe('coziness scoring', () => {
	it('reads an empty room as bare, and grants nothing for it', () => {
		const r = readCoziness([], lookup);
		expect(r.score).toBe(0);
		expect(r.tierId).toBe('bare');
		expect(r.perk).toBe(0);
		expect(r.carry).toBe(0);
		expect(r.speed).toBe(1);
	});

	it('values VARIETY over quantity — the whole point of the formula', () => {
		// Twelve of the same stool is a storeroom; twelve different things across
		// several comforts is a home. The second must score higher.
		const hoard = readCoziness(place(...Array(12).fill('home-stool')), lookup);
		const home = readCoziness(
			place(
				'home-bed',
				'home-armchair',
				'home-table',
				'home-lamp',
				'home-potplant',
				'home-aquarium',
				'home-painting',
				'small-chest',
				'home-rug',
				'home-bookshelf',
				'home-fireplace',
				'home-terrarium',
			),
			lookup,
		);
		expect(home.score).toBeGreaterThan(hoard.score);
		expect(home.kinds.length).toBeGreaterThan(hoard.kinds.length);
	});

	it('caps at 100 rather than climbing forever past the last rung', () => {
		const everything = DEFS.filter((o) => o.placement === 'indoor').map((o) => ({ objectId: o.id }));
		const r = readCoziness(everything, lookup);
		expect(r.score).toBeLessThanOrEqual(100);
		expect(r.tierId).toBe('beloved');
	});

	it('is a LONG climb — a nicely decorated room is not yet the top rung', () => {
		// The thing that makes decorating worth continuing is that a good room
		// isn't the finished room. Twenty different pieces should be comfortably
		// short of Beloved; getting there wants most of the furniture in the game.
		const twenty = DEFS.filter((o) => o.placement === 'indoor')
			.slice(0, 20)
			.map((o) => ({ objectId: o.id }));
		expect(readCoziness(twenty, lookup).tierId).not.toBe('beloved');
	});

	it('barely rewards a room full of copies', () => {
		// Twenty of one thing has to stay near the floor — this is the guardrail on
		// the whole design, and the number people would otherwise farm.
		expect(readCoziness(place(...Array(20).fill('home-stool')), lookup).tierId).toBe('bare');
	});

	it('climbs the rungs in order as a room fills out', () => {
		const seen = [
			readCoziness(place('home-stool'), lookup),
			readCoziness(place('home-stool', 'home-bed', 'home-lamp', 'home-table'), lookup),
			readCoziness(
				place('home-stool', 'home-bed', 'home-lamp', 'home-table', 'home-potplant', 'small-chest', 'home-painting'),
				lookup,
			),
		].map((r) => r.tier);
		expect(seen).toEqual([...seen].sort((a, b) => a - b));
	});

	it('counts a piece it has never heard of, rather than ignoring it', () => {
		// Something IS standing in the room. An unknown id lands in `curio` — it
		// must never make a placement worth zero.
		const r = readCoziness(place('a-thing-from-a-future-update'), lookup);
		expect(r.pieces).toBe(1);
		expect(r.kinds).toEqual(['curio']);
	});
});

describe('comfort kinds', () => {
	it('derives a sensible kind for any indoor object without being told', () => {
		// Every indoor object must land somewhere real, tagged or not — this is the
		// check that a new piece of furniture ships scoring something on day one.
		for (const o of DEFS.filter((d) => d.placement === 'indoor' || d.placement === 'both')) {
			expect(COZY_KINDS).toContain(cozyKindOf(o));
		}
	});

	it('reads wall decor as art and planters as greenery with no tag needed', () => {
		expect(cozyKindOf({ mount: 'wall' })).toBe('art');
		expect(cozyKindOf({ plantable: true })).toBe('greenery');
		expect(cozyKindOf({ surface: true })).toBe('surface');
		expect(cozyKindOf({})).toBe('curio');
	});

	it('lets the data override the derived kind', () => {
		// The dresser is a surface AND storage; the tag is what settles it.
		expect(cozyKindOf({ surface: true, cozyKind: 'storage' })).toBe('storage');
	});

	it('every tagged kind in the data is a kind the score knows about', () => {
		const tagged = [...new Set(DEFS.map((o) => o.cozyKind).filter(Boolean))];
		expect(tagged.length).toBeGreaterThan(0); // the tags didn't silently vanish
		expect(tagged.filter((k) => !(COZY_KINDS as readonly string[]).includes(k))).toEqual([]);
	});
});

describe('what coziness actually buys', () => {
	const COZY_ROOM = [
		'home-bed',
		'home-armchair',
		'home-table',
		'home-lamp',
		'home-potplant',
		'home-aquarium',
		'home-painting',
		'small-chest',
		'home-rug',
		'home-bookshelf',
		'home-fireplace',
		'home-terrarium',
	];

	it('adds to the style perk ON TOP of the upgrade cap, so a maxed house still gains', () => {
		const maxed = { space: 4, comfort: 4, decor: 4, light: 4 };
		const bare = homePerk(saveWith([], maxed))!;
		const cozy = homePerk(saveWith(COZY_ROOM, maxed))!;
		expect(bare.strength).toBe(bare.upgrades); // capped by the tracks alone
		expect(cozy.strength).toBeGreaterThan(bare.strength);
		expect(cozy.strength).toBeCloseTo(bare.upgrades + cozy.cozy.perk, 5);
	});

	it('never lets a perk read as a certainty', () => {
		const p = homePerk(saveWith(COZY_ROOM, { space: 4, comfort: 4, decor: 4, light: 4 }))!;
		expect(p.strength).toBeLessThanOrEqual(0.95);
	});

	it('grants nothing at all to an unbuilt tent', () => {
		// A canvas tent has no style to carry a perk, however lovingly it's furnished.
		const tent = { ...saveWith(COZY_ROOM), home: { style: 'cottage', space: 1, styleLocked: false } };
		expect(homePerk(tent)).toBeNull();
	});

	it('adds carry capacity on top of the Comfort track', () => {
		const bare = homeCarryBonus(saveWith([]));
		const cozy = homeCarryBonus(saveWith(COZY_ROOM));
		expect(cozy).toBeGreaterThan(bare);
	});

	it('GOES BACK DOWN when the room is taken apart', () => {
		// A tier that can only ever rise is a high-water mark, not a buff. Removing
		// furniture has to cost you the bonus it bought.
		const full = homeCarryBonus(saveWith(COZY_ROOM));
		const stripped = homeCarryBonus(saveWith(COZY_ROOM.slice(0, 2)));
		expect(stripped).toBeLessThan(full);
	});

	it('lets the Furnishings track multiply what the room is worth', () => {
		// Furnishings used to buy a nicer rug. It is now the thing that makes the
		// top rung reachable, so more of it must always mean a higher reading.
		const room = place(
			...DEFS.filter((o) => o.placement === 'indoor')
				.slice(0, 24)
				.map((o) => o.id),
		);
		const bare = readCoziness(room, lookup, 0);
		const trimmed = readCoziness(room, lookup, HOME_TRACKS.decor.levels[3].cozyBoost);
		expect(trimmed.score).toBeGreaterThan(bare.score);
		expect(trimmed.raw).toBe(bare.raw); // the room itself didn't change
		expect(trimmed.tier).toBeGreaterThanOrEqual(bare.tier);
	});

	it('applies the Furnishings multiplier on READ, so buying it pays off at once', () => {
		// The save stores the raw reading; the boost is applied when it's read. An
		// upgrade must not sit inert until the player happens to move a chair.
		const ids = DEFS.filter((o) => o.placement === 'indoor')
			.slice(0, 24)
			.map((o) => o.id);
		const stored = storedCozy(readCoziness(place(...ids), lookup, 0.34));
		expect(stored.score).toBe(readCoziness(place(...ids), lookup, 0).score); // raw was stored
		const plain = { homeCozy: stored, home: { style: 'cottage', decor: 1, styleLocked: true } };
		const trimmed = { ...plain, home: { ...plain.home, decor: 4 } };
		expect(homeCozy(trimmed).score).toBeGreaterThan(homeCozy(plain).score);
	});

	it('re-derives tier effects from the score, so retuning the table needs no migration', () => {
		// A save stored before a retune keeps only its score; the perk/carry/speed
		// it grants come from today's COZY_TIERS.
		const legacy = { homeCozy: { score: COZY_TIERS[3].min, pieces: 99, types: 99, kinds: [] } };
		expect(cozyOf(legacy).perk).toBe(COZY_TIERS[3].perk);
		expect(cozyOf(legacy).carry).toBe(COZY_TIERS[3].carry);
	});

	it('reads a save that predates coziness as bare rather than crashing', () => {
		expect(cozyOf({}).score).toBe(0);
		expect(cozyOf(undefined).tierId).toBe('bare');
		expect(homeCarryBonus({ home: { comfort: 2, styleLocked: true } })).toBeGreaterThan(0);
	});
});

describe('the well-rested speed boost', () => {
	const cozySave = (ids: string[]) => saveWith(ids);

	it('does nothing without a rest, however cozy the room', () => {
		expect(restedSpeed(cozySave(['home-bed', 'home-lamp', 'home-potplant']), 5_000)).toBe(1);
	});

	it('speeds you up while it lasts and stops exactly when it expires', () => {
		const player: any = {
			...cozySave([
				'home-bed',
				'home-armchair',
				'home-table',
				'home-lamp',
				'home-potplant',
				'home-aquarium',
				'home-painting',
				'small-chest',
			]),
			restedUntil: 1_000,
		};
		expect(restedSpeed(player, 999)).toBeGreaterThan(1);
		expect(restedSpeed(player, 1_000)).toBe(1); // noon: it's over
		expect(restedSpeed(player, 5_000)).toBe(1);
	});

	it('gives a bare room nothing to wake up to', () => {
		expect(restedSpeed({ ...cozySave([]), restedUntil: 1_000 }, 0)).toBe(1);
	});

	it('rewards a better-decorated home with a bigger boost', () => {
		const speeds = COZY_TIERS.map((t) => t.speed);
		expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
		expect(speeds[0]).toBe(1);
		expect(speeds[speeds.length - 1]).toBeGreaterThan(1);
	});
});

describe('every upgrade track buys something you can feel', () => {
	// The complaint this answers: Furnishings and Warmth were a finer rug and a
	// prettier window. Nobody gathers clay for a prettier window.
	it('gives Furnishings a rising coziness multiplier', () => {
		const boosts = HOME_TRACKS.decor.levels.map((l: any) => l.cozyBoost ?? 0);
		expect(boosts[0]).toBe(0);
		for (let i = 1; i < boosts.length; i++) expect(boosts[i]).toBeGreaterThan(boosts[i - 1]);
		expect(homeCozyBoost({ home: { decor: 4 } })).toBe(boosts[3]);
		expect(homeCozyBoost({})).toBe(0);
	});

	it('gives Warmth a rising hold on the well-rested boost', () => {
		const holds = HOME_TRACKS.light.levels.map((l: any) => l.restedHold ?? 0);
		expect(holds[0]).toBe(0);
		for (let i = 1; i < holds.length; i++) expect(holds[i]).toBeGreaterThan(holds[i - 1]);
		expect(homeRestedHold({ home: { light: 4 } })).toBe(holds[3]);
		expect(homeRestedHold({})).toBe(0);
	});

	it('still gives Comfort its carry and Space its floor plan', () => {
		expect(HOME_TRACKS.comfort.levels[3].carry).toBeGreaterThan(HOME_TRACKS.comfort.levels[1].carry);
		expect(HOME_TRACKS.space.levels[3].inner.w).toBeGreaterThan(HOME_TRACKS.space.levels[0].inner.w);
	});
});

describe('the tier table itself', () => {
	it('is ordered, starts at zero, and every rung pays more than the last', () => {
		expect(COZY_TIERS[0].min).toBe(0);
		for (let i = 1; i < COZY_TIERS.length; i++) {
			expect(COZY_TIERS[i].min).toBeGreaterThan(COZY_TIERS[i - 1].min);
			expect(COZY_TIERS[i].perk).toBeGreaterThan(COZY_TIERS[i - 1].perk);
			expect(COZY_TIERS[i].carry).toBeGreaterThan(COZY_TIERS[i - 1].carry);
			expect(COZY_TIERS[i].speed).toBeGreaterThan(COZY_TIERS[i - 1].speed);
		}
	});

	it('is reachable — the top rung you can score your way onto is below a perfect score', () => {
		// `storied` is the exception and is excluded on purpose: it is not reached
		// by score at all (see cozyTierAt), so its min is allowed to sit at 100.
		expect(COZY_TIERS[COZY_TIERS.length - 2].min).toBeLessThan(100);
	});
});

describe('Storied — the rung Showcase unlocks (Furnishings 7)', () => {
	// A room good enough to be Beloved on the multiplier alone, but nowhere near
	// full: the raw reading is what the top rung asks for, and this is not it.
	const boosted = { score: 60, pieces: 20, types: 18, kinds: [...COZY_KINDS] };
	// A room with essentially everything out.
	const full = { score: STORIED_RAW, pieces: 44, types: 40, kinds: [...COZY_KINDS] };

	it('is out of reach without the ability, however high the score goes', () => {
		expect(cozyOf({ homeCozy: full }, 0.9).tierId).toBe('beloved');
		expect(cozyOf({ homeCozy: full }, 0.9, {}).tierId).toBe('beloved');
	});

	it('is not for sale — the multiplier cannot buy it, only decorating can', () => {
		// Score 100 (60 x 1.9, capped), Showcase owned, and still not Storied:
		// the raw reading is 60 and the rung wants 95.
		const r = cozyOf({ homeCozy: boosted }, 0.9, { showcase: true });
		expect(r.score).toBe(100);
		expect(r.tierId).toBe('beloved');
	});

	it('lands the moment the room itself is full', () => {
		const r = cozyOf({ homeCozy: full }, 0.9, { showcase: true });
		expect(r.tierId).toBe('storied');
		expect(r.carry).toBe(COZY_TIERS[COZY_TIERS.length - 1].carry);
		expect(r.perk).toBeGreaterThan(COZY_TIERS[COZY_TIERS.length - 2].perk);
	});
});

describe("Curator's Eye — the rung before it (Furnishings 6)", () => {
	// Thirty different things out, covering eight of the nine comforts: a room
	// somebody clearly lives in, and short of the un-eased posts by a long way.
	const room = Array.from({ length: 34 }, (_, i) => ({ objectId: `thing-${i % 30}` }));
	const kindOf = (id: string) => ({ cozyKind: COZY_KINDS[Number(id.split('-')[1]) % 8] });

	it('pays far sooner for the same room', () => {
		const plain = readCoziness(room, kindOf);
		const eased = readCoziness(room, kindOf, 0, { curator: true });
		expect(eased.raw).toBeGreaterThan(plain.raw);
	});

	it('is what puts the Storied rung in reach at all', () => {
		expect(readCoziness(room, kindOf, 0, { curator: true }).raw).toBeGreaterThanOrEqual(STORIED_RAW);
		expect(readCoziness(room, kindOf).raw).toBeLessThan(STORIED_RAW);
	});

	it('still cannot push a reading past a full bar', () => {
		const everything = Array.from({ length: 60 }, (_, i) => ({ objectId: `thing-${i}` }));
		expect(readCoziness(everything, () => ({}), 0, { curator: true }).raw).toBeLessThanOrEqual(100);
	});
});

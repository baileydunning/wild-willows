import { describe, it, expect } from 'vitest';
import biomesData from '../../data/biomes.json';
import resourcesData from '../../data/resources.json';
import {
	BRISK_STEP_SPEED,
	HOME_ABILITIES,
	type HomeAbilityId,
	cozyOptsFor,
	craftCostWith,
	hasHomeAbility,
	homeAbilitiesOf,
} from '../../src/homeAbilities';
import { HOME_TRACKS, homeCarryBonus, homeCozyBoost, homeHas, homeRestedHold } from '../../server/home';
import { APPROACH_MAX, approachMaxFor, approachRadius, approachWaitMs } from '../../src/game/worldRules';

// What this covers: the house used to stop growing at the wetland, which is the
// halfway point of the preserve. Every track now runs to seven, and the three
// new rungs are gated on the desert, the alpine and the coast in that order.
//
// The numbers keep climbing, but the reason to climb is the named ABILITY each
// late level switches on — so most of this file is about those: that they are
// derived from the levels rather than stored, that a tent has none, and that
// each one actually reaches the rule it is supposed to change.

const BIOMES: any[] = (biomesData as any).records;
const RESOURCES: any[] = (resourcesData as any).records;
const TRACKS = ['space', 'comfort', 'decor', 'light'] as const;
/** The three biomes past the wetland, in the order the game opens them. */
const LATE = ['desert', 'alpine', 'coastal'];

const built = (levels: Partial<Record<string, number>> = {}) => ({
	home: { style: 'cabin', space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true, ...levels },
});

describe('the ladder — every track runs to seven', () => {
	it('gives all four tracks the same number of rungs', () => {
		for (const tk of TRACKS) expect(HOME_TRACKS[tk].levels).toHaveLength(7);
	});

	it('gates the last three on the desert, the alpine and the coast, in that order', () => {
		for (const tk of TRACKS) {
			const late = HOME_TRACKS[tk].levels.slice(4);
			expect(late.map((l: any) => l.requires?.biome)).toEqual(LATE);
		}
	});

	it('never gates a rung on a biome the one before it did not need', () => {
		// The house should open as you walk forward, so a track's gates can only
		// ever move later through the biome order — never back to an earlier one.
		const order = new Map(BIOMES.map((b) => [b.id, b.order]));
		for (const tk of TRACKS) {
			const gates = HOME_TRACKS[tk].levels.map((l: any) => order.get(l.requires?.biome) ?? 0);
			for (let i = 1; i < gates.length; i++) expect(gates[i]).toBeGreaterThanOrEqual(gates[i - 1]);
		}
	});

	it('asks for materials you can actually gather where the rung is gated', () => {
		for (const tk of TRACKS) {
			for (const level of HOME_TRACKS[tk].levels.slice(4)) {
				const mats = Object.keys(level.materials || {});
				expect(mats.length).toBeGreaterThan(0);
				for (const id of mats) expect(RESOURCES.some((r) => r.id === id)).toBe(true);
			}
		}
	});

	it('keeps every number climbing to the top rung', () => {
		expect(homeCarryBonus(built({ comfort: 7 }))).toBeGreaterThan(homeCarryBonus(built({ comfort: 4 })));
		expect(homeCozyBoost(built({ decor: 7 }))).toBeGreaterThan(homeCozyBoost(built({ decor: 4 })));
		expect(homeRestedHold(built({ light: 7 }))).toBeGreaterThan(homeRestedHold(built({ light: 4 })));
	});
});

describe('the abilities themselves', () => {
	const granted = TRACKS.flatMap((tk) =>
		HOME_TRACKS[tk].levels.map((l: any, i: number) => ({ track: tk, level: i + 1, id: l.ability })).filter((g) => g.id),
	);

	it('grants every declared ability exactly once', () => {
		const asc = (a: string, b: string) => a.localeCompare(b);
		expect(granted.map((g) => String(g.id)).sort(asc)).toEqual(Object.keys(HOME_ABILITIES).sort(asc));
	});

	it('grants each one from the track it says it belongs to, on a late rung', () => {
		for (const g of granted) {
			expect(HOME_ABILITIES[g.id as HomeAbilityId].track).toBe(g.track);
			expect(g.level).toBeGreaterThan(4);
		}
	});

	it('gives Space none of them — its floor plan is the payoff', () => {
		expect(HOME_TRACKS.space.levels.some((l: any) => l.ability)).toBe(false);
	});

	it('gives every one a name and a sentence about playing', () => {
		for (const a of Object.values(HOME_ABILITIES)) {
			expect(a.name.length).toBeGreaterThan(2);
			expect(a.blurb.length).toBeGreaterThan(20);
		}
	});
});

describe('reading them off a save', () => {
	it('grants nothing at all while the home is still a tent', () => {
		const tent = { style: 'cabin', space: 4, comfort: 7, decor: 7, light: 7, styleLocked: false };
		expect(homeAbilitiesOf(tent, HOME_TRACKS).size).toBe(0);
		expect(hasHomeAbility(tent, HOME_TRACKS, 'briskStep')).toBe(false);
	});

	it('grants the ones the levels have reached, and no others', () => {
		const home = { style: 'cabin', space: 2, comfort: 6, decor: 1, light: 5, styleLocked: true };
		expect([...homeAbilitiesOf(home, HOME_TRACKS)].sort((a, b) => a.localeCompare(b))).toEqual([
			'homeOverflow',
			'lightLoad',
			'openHearth',
		]);
		expect(hasHomeAbility(home, HOME_TRACKS, 'briskStep')).toBe(false);
		expect(hasHomeAbility(home, HOME_TRACKS, 'openHearth')).toBe(true);
	});

	it('reads the same answer through the server helper', () => {
		expect(homeHas(built({ light: 7 }), 'emberWatch')).toBe(true);
		expect(homeHas(built({ light: 6 }), 'emberWatch')).toBe(false);
		expect(homeHas({}, 'emberWatch')).toBe(false); // no home at all
	});

	it('survives a save with no home and a track table that never arrived', () => {
		expect(homeAbilitiesOf(null, HOME_TRACKS).size).toBe(0);
		expect(homeAbilitiesOf(built().home, null).size).toBe(0);
		expect(cozyOptsFor(null, null)).toEqual({ curator: false, showcase: false });
	});

	it('hands the coziness rules the two Furnishings abilities', () => {
		const maxed = { style: 'cabin', space: 1, comfort: 1, decor: 7, light: 1, styleLocked: true };
		expect(cozyOptsFor(maxed, HOME_TRACKS)).toEqual({ curator: true, showcase: true });
		expect(cozyOptsFor({ ...maxed, decor: 6 }, HOME_TRACKS)).toEqual({ curator: true, showcase: false });
	});
});

describe('Fine Fittings — what a home furnishing costs', () => {
	const fitting = { category: 'home', materials: { fiber: 8, clay: 4, moss: 1 } };
	const kit = { category: 'kit', materials: { fiber: 8, clay: 4 } };

	it('takes a quarter off anything for indoors', () => {
		expect(craftCostWith(fitting, true)).toEqual({ fiber: 6, clay: 3, moss: 1 });
	});

	it('never takes the last one — nothing is ever free', () => {
		expect(craftCostWith({ category: 'home', materials: { pearl: 1 } }, true)).toEqual({ pearl: 1 });
	});

	it('leaves everything that is not a furnishing exactly as it was', () => {
		expect(craftCostWith(kit, true)).toEqual(kit.materials);
		expect(craftCostWith(fitting, false)).toEqual(fitting.materials);
		expect(craftCostWith(null, true)).toEqual({});
	});
});

describe('the Warmth abilities reach the stillness rules', () => {
	it('grows the crowd, one rung at a time', () => {
		expect(approachMaxFor({})).toBe(APPROACH_MAX);
		expect(approachMaxFor({ hearthsong: true })).toBeGreaterThan(APPROACH_MAX);
		expect(approachMaxFor({ emberWatch: true })).toBeGreaterThan(approachMaxFor({ hearthsong: true }));
	});

	it('sends them off sooner with an open hearth, from near and from far', () => {
		for (const d of [40, 200, 600]) {
			expect(approachWaitMs(d, { hearth: { openHearth: true } })).toBeLessThan(approachWaitMs(d));
		}
	});

	it('never turns the wait into no wait at all — company still has to arrive', () => {
		expect(approachWaitMs(0, { hearth: { openHearth: true } })).toBeGreaterThan(0);
	});

	it('settles them closer with hearthsong, without ever landing in your lap', () => {
		for (const kind of ['mammal', 'bird', 'insect', 'fish']) {
			const close = approachRadius(kind, { hearthsong: true });
			expect(close).toBeLessThanOrEqual(approachRadius(kind));
			expect(close).toBeGreaterThanOrEqual(26);
		}
	});
});

describe('Second Wind', () => {
	it('is a gentle nudge, not a replacement for the boots', () => {
		expect(BRISK_STEP_SPEED).toBeGreaterThan(1);
		expect(BRISK_STEP_SPEED).toBeLessThan(1.2); // the hiking boots
	});
});

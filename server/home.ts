// Wild Willows — server: home
//
// The player's home — styles, upgrade tracks, perks and room geometry — plus the
// trail-tent interiors and the sleeping-furniture rules that share that geometry.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { GRID_H, GRID_W } from './biome';
import { cozyOf, type CozyOpts, type CozyReading } from './cozy';
import { type HomeAbilityId, cozyOptsFor, craftCostWith, homeAbilitiesOf, hasHomeAbility } from '../src/homeAbilities';
import {
	type HomeLayout,
	type LaidRoom,
	type PlanDef,
	isFloorTile,
	isOpening,
	isWallTile as isWallTileOf,
	layoutOf,
	nearestHangSpot,
	roomAt,
	roomsOf,
	wallTilesOf as wallTilesOfLayout,
} from '../src/homePlan';

export type { HomeLayout, LaidRoom } from '../src/homePlan';
export { HOME_ABILITIES, craftCostWith, type HomeAbilityId } from '../src/homeAbilities';
export {
	canHangAt,
	floorTilesOf,
	hasWindow,
	nearestHangSpot,
	isBackWall,
	isFloorTile,
	isOpening,
	isWalkable,
	roomAt,
	roomsOf,
	wallRoomOf,
	windowTilesOf,
} from '../src/homePlan';

// ----------------------------------------------------------- the home
// A personal interior (area id 'home') you step into from your camp tent, decorate
// with indoor "camp comfort" items, and upgrade. The home upgrades along FOUR
// independent tracks (Space, Comfort, Furnishings, Warmth) — you can pour
// materials into whichever you like — and you can take it in one of TWO style
// directions (a warm Woodland Cabin or a bright Meadow Cottage) that restyle the
// floor and walls. EVERY track now buys something you can feel: Space sets the
// room size, Comfort is a flat carry bonus, Furnishings multiplies what your
// decorating is worth (see server/cozy.ts — it is what makes a Beloved home
// reachable), and Warmth keeps the well-rested speed boost running past noon.
// Furnishings and Warmth used to be a nicer rug and a prettier window, which is
// not a thing anyone spends a morning gathering clay for.
// Each style is built from materials that suit it: a log cabin from wood, a cottage
// from fiber and flowers, a stone hearth from stone. All buildable from the meadow.
//
// SIGNATURE PERKS: each style also carries a perk in the spirit of its build —
// the cabin's woodcraft finds extra materials while gathering, the cottage's
// green thumb gives new plantings a growth head start, the stone hearth's
// thrift sometimes returns crafting materials. A perk's strength starts at
// `base` when the house is built and gains `perLevel` for EVERY level added on
// ANY of the four tracks (capped at `cap`), so each upgrade makes the house
// play better, not just look better. See homePerk() for the math.
const HOME_BUILD_GATE = { biome: 'meadow', minHealth: 30 };
type HomePerkDef = { id: 'forage' | 'growth' | 'thrift'; base: number; perLevel: number; cap: number };
export const HOME_STYLES: Record<
	string,
	{
		name: string;
		floor: string;
		wall: string;
		accent: string;
		materials: Record<string, number>;
		requires: { biome: string; minHealth: number };
		perk: HomePerkDef;
	}
> = {
	cabin: {
		name: 'Log Cabin',
		floor: '#c8a064',
		wall: '#5e3f29',
		accent: '#b5707a',
		materials: { branches: 16, fiber: 6 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'forage', base: 0.1, perLevel: 0.05, cap: 0.6 },
	}, // warm golden pine + dark logs
	cottage: {
		name: 'Meadow Cottage',
		floor: '#e6d3a6',
		wall: '#aab9c6',
		accent: '#7fae6a',
		materials: { wildflowers: 6, fiber: 10, clay: 4 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'growth', base: 0.1, perLevel: 0.04, cap: 0.5 },
	}, // pale wood + airy blue-gray + green
	stone: {
		name: 'Stone Hearth',
		floor: '#a9a499',
		wall: '#6f6a62',
		accent: '#d98a4f',
		materials: { stones: 14, clay: 6 },
		requires: HOME_BUILD_GATE,
		perk: { id: 'thrift', base: 0.1, perLevel: 0.05, cap: 0.6 },
	}, // slate floor + gray stone + hearth orange
};
export const DEFAULT_HOME = { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };

// Each track is a list of levels (index 0 = level 1, free starter). Higher levels
// cost materials and a little biome progress.
//
// SEVEN levels, not four. Four was the wetland's ceiling: the house stopped
// growing at the halfway point of the preserve and the desert, the alpine and
// the coast had nothing to spend their materials on. Levels 5, 6 and 7 of every
// track are gated on those three, in that order, so walking into a new biome
// always reopens the house.
//
// The late levels keep raising the number AND switch on a named ABILITY
// (src/homeAbilities.ts) — one sentence of new behavior, because doubling a
// bonus you already have is not worth a week of desert clay. Space is the
// exception: its levels 5-7 open floor plans of six, seven and eight rooms, and
// floor space is where every other track's payoff goes, so it needs no ability
// of its own. Rooms only ever GROW across an upgrade, and every room keeps its
// id, so paint and furniture survive the move (reflowInterior catches the rest).
export const HOME_TRACKS: Record<string, { name: string; blurb: string; levels: any[] }> = {
	space: {
		name: 'Space',
		blurb: 'A bigger place — and, past the first rooms, a real floor plan.',
		levels: [
			{ inner: { w: 6, h: 5 } }, // tent
			{ inner: { w: 8, h: 6 }, materials: { branches: 12, fiber: 8 }, requires: { biome: 'meadow', minHealth: 30 } },
			{
				// The first real floor plan: a great room with a bedroom and a pantry off
				// its left side, each through a doorway in the wall they share.
				label: 'Two-Room Cabin',
				inner: { w: 14, h: 8 },
				rooms: [
					{ id: 'main', name: 'Great Room', x: 5, y: 0, w: 9, h: 8 },
					{ id: 'bedroom', name: 'Bedroom', x: 0, y: 0, w: 4, h: 4 },
					{ id: 'pantry', name: 'Pantry', x: 0, y: 5, w: 4, h: 3 },
				],
				doors: [
					{ x: 4, y: 1 },
					{ x: 4, y: 6 },
				],
				materials: { branches: 18, stones: 6, clay: 6 },
				requires: { biome: 'forest', minHealth: 45 },
			},
			{
				// The house you were building toward: a great-room spine down the middle
				// with a wing on either side of it — the bedroom and pantry you already
				// had, now facing a study and a sunroom across the room. Five rooms, four
				// doorways, and every room keeps the id it had, so whatever you painted
				// at the last level is still that color at this one.
				label: 'Five-Room House',
				inner: { w: 19, h: 11 },
				rooms: [
					{ id: 'main', name: 'Great Room', x: 6, y: 0, w: 7, h: 11 },
					{ id: 'bedroom', name: 'Bedroom', x: 0, y: 0, w: 5, h: 6 },
					{ id: 'pantry', name: 'Pantry', x: 0, y: 7, w: 5, h: 4 },
					{ id: 'study', name: 'Study', x: 14, y: 0, w: 5, h: 5 },
					{ id: 'sunroom', name: 'Sunroom', x: 14, y: 6, w: 5, h: 5 },
				],
				doors: [
					{ x: 5, y: 2 },
					{ x: 5, y: 9 },
					{ x: 13, y: 2 },
					{ x: 13, y: 8 },
				],
				materials: { branches: 24, clay: 10, 'clean-water': 6 },
				requires: { biome: 'wetland', minHealth: 55 },
			},
			{
				// Redstone Scrubland money. The left wing splits in three and gains a
				// WORKSHOP between the bedroom and the pantry; the right wing's two rooms
				// stretch to fill the new height. 262 tiles of floor against 177 — half
				// again as much room, and a sixth wall to hang things on.
				label: 'Courtyard House',
				inner: { w: 22, h: 14 },
				rooms: [
					{ id: 'main', name: 'Great Room', x: 7, y: 0, w: 8, h: 14 },
					{ id: 'bedroom', name: 'Bedroom', x: 0, y: 0, w: 6, h: 5 },
					{ id: 'workshop', name: 'Workshop', x: 0, y: 6, w: 6, h: 3 },
					{ id: 'pantry', name: 'Pantry', x: 0, y: 10, w: 6, h: 4 },
					{ id: 'study', name: 'Study', x: 16, y: 0, w: 6, h: 7 },
					{ id: 'sunroom', name: 'Sunroom', x: 16, y: 8, w: 6, h: 6 },
				],
				doors: [
					{ x: 6, y: 2 },
					{ x: 6, y: 7 },
					{ x: 6, y: 11 },
					{ x: 15, y: 3 },
					{ x: 15, y: 10 },
				],
				materials: { branches: 30, clay: 16, sand: 20 },
				requires: { biome: 'desert', minHealth: 60 },
			},
			{
				// Graywind Heights. Both wings now run three rooms deep — a CELLAR joins
				// the study and the sunroom — and the great room reaches its full height.
				// 340 tiles.
				label: 'Highland Lodge',
				inner: { w: 25, h: 16 },
				rooms: [
					{ id: 'main', name: 'Great Room', x: 8, y: 0, w: 9, h: 16 },
					{ id: 'bedroom', name: 'Bedroom', x: 0, y: 0, w: 7, h: 6 },
					{ id: 'workshop', name: 'Workshop', x: 0, y: 7, w: 7, h: 3 },
					{ id: 'pantry', name: 'Pantry', x: 0, y: 11, w: 7, h: 5 },
					{ id: 'study', name: 'Study', x: 18, y: 0, w: 7, h: 6 },
					{ id: 'cellar', name: 'Cellar', x: 18, y: 7, w: 7, h: 2 },
					{ id: 'sunroom', name: 'Sunroom', x: 18, y: 10, w: 7, h: 6 },
				],
				doors: [
					{ x: 7, y: 2 },
					{ x: 7, y: 8 },
					{ x: 7, y: 13 },
					{ x: 17, y: 2 },
					{ x: 17, y: 7 },
					{ x: 17, y: 12 },
				],
				materials: { stones: 30, obsidian: 10, 'quartz-crystal': 8 },
				requires: { biome: 'alpine', minHealth: 65 },
			},
			{
				// Pelican Shore, and the last house there is. The great room steps down a
				// row to make space for a LOFT across the back of it — the first room the
				// plan has ever put ABOVE another — and every other room reaches its
				// final size. Eight rooms, seven doorways, 401 tiles: two and a quarter
				// times the house you crossed the wetland with.
				//
				// This is the ceiling on purpose: 28x17 is the largest plan that still
				// leaves a wall ring and a door threshold inside the 30x20 interior grid.
				label: 'Shorewood Hall',
				inner: { w: 28, h: 17 },
				rooms: [
					{ id: 'main', name: 'Great Room', x: 9, y: 3, w: 11, h: 14 },
					{ id: 'loft', name: 'Loft', x: 9, y: 0, w: 11, h: 2 },
					{ id: 'bedroom', name: 'Bedroom', x: 0, y: 0, w: 8, h: 6 },
					{ id: 'workshop', name: 'Workshop', x: 0, y: 7, w: 8, h: 4 },
					{ id: 'pantry', name: 'Pantry', x: 0, y: 12, w: 8, h: 5 },
					{ id: 'study', name: 'Study', x: 21, y: 0, w: 7, h: 6 },
					{ id: 'cellar', name: 'Cellar', x: 21, y: 7, w: 7, h: 3 },
					{ id: 'sunroom', name: 'Sunroom', x: 21, y: 11, w: 7, h: 6 },
				],
				doors: [
					{ x: 14, y: 2 },
					{ x: 8, y: 4 },
					{ x: 8, y: 8 },
					{ x: 8, y: 13 },
					{ x: 20, y: 4 },
					{ x: 20, y: 8 },
					{ x: 20, y: 13 },
				],
				materials: { driftwood: 28, shells: 20, 'sea-glass': 10 },
				requires: { biome: 'coastal', minHealth: 70 },
			},
		],
	},
	// Carry numbers are sized against the basket ladder (200 at tier 1, 2000 at
	// tier 7). At 45/95/160 this track was rounding error next to a basket
	// upgrade, which is not what "the functional one" should feel like.
	//
	// Past level 4 the number keeps climbing — 2000 at the top, a whole extra
	// tier-7 basket — but the reason to buy is the ability: the basket stops
	// having a bad edge case (heavy things), then stops having a full state at
	// all, and finally the house makes you quicker on your feet everywhere.
	comfort: {
		name: 'Comfort',
		blurb: 'Carry much more on every gathering trip (+capacity).',
		levels: [
			{ carry: 0 },
			{ carry: 150, materials: { fiber: 10, branches: 4 }, requires: { biome: 'meadow', minHealth: 35 } },
			{ carry: 350, materials: { fiber: 14, moss: 6 }, requires: { biome: 'forest', minHealth: 50 } },
			{ carry: 600, materials: { reeds: 10, fiber: 12 }, requires: { biome: 'wetland', minHealth: 60 } },
			{
				carry: 950,
				ability: 'lightLoad',
				materials: { sand: 20, 'cactus-fruit': 8, fiber: 16 },
				requires: { biome: 'desert', minHealth: 50 },
			},
			{
				carry: 1400,
				ability: 'homeOverflow',
				materials: { lichen: 14, 'pine-nuts': 10, moss: 12 },
				requires: { biome: 'alpine', minHealth: 60 },
			},
			{
				carry: 2000,
				ability: 'briskStep',
				materials: { kelp: 18, driftwood: 14, shells: 12 },
				requires: { biome: 'coastal', minHealth: 70 },
			},
		],
	},
	// `cozyBoost` multiplies the room's coziness score (server/cozy.ts). At level
	// 4 a room is worth a third more than the same furniture in a bare-trimmed
	// house — which is the difference between Cozy and Beloved, and the reason
	// this track is worth buying at all.
	//
	// The late levels widen what "the room" even means: first your trail tents
	// count as part of it, then arranging it well pays sooner, and finally there
	// is a rung above Beloved to climb to.
	decor: {
		name: 'Furnishings',
		blurb: 'Better trim and fittings — everything you place counts for more.',
		levels: [
			{ cozyBoost: 0 },
			{ cozyBoost: 0.1, materials: { fiber: 8, wildflowers: 4 } },
			{ cozyBoost: 0.21, materials: { fiber: 12, berries: 6 }, requires: { biome: 'meadow', minHealth: 50 } },
			{ cozyBoost: 0.34, materials: { fiber: 16, clay: 6 }, requires: { biome: 'forest', minHealth: 55 } },
			{
				cozyBoost: 0.48,
				ability: 'fineFittings',
				materials: { geode: 6, 'agave-nectar': 8, clay: 12 },
				requires: { biome: 'desert', minHealth: 55 },
			},
			{
				cozyBoost: 0.66,
				ability: 'curatorsEye',
				materials: { 'quartz-crystal': 8, 'alpine-flowers': 12, 'juniper-berries': 8 },
				requires: { biome: 'alpine', minHealth: 65 },
			},
			{
				cozyBoost: 0.9,
				ability: 'showcase',
				materials: { pearl: 4, 'sea-glass': 10, shells: 16 },
				requires: { biome: 'coastal', minHealth: 75 },
			},
		],
	},
	// `restedHold` is extra day-fractions the well-rested speed boost runs for,
	// past its default noon. At level 4 a good night carries you to dusk, and at
	// level 7 a night's sleep lasts the whole of the next day.
	//
	// The abilities are the other half of what a hearth is for. Sitting still
	// already draws the animals of an area over (see the stillness block in
	// src/game/worldRules.ts); Warmth is what makes that gathering bigger, faster
	// and — at the top — something you can have anywhere you stop walking.
	light: {
		name: 'Warmth',
		blurb: 'Windows and a hearth — a night in keeps you quick for longer, and the animals notice.',
		levels: [
			{ restedHold: 0 },
			{ restedHold: 0.08, materials: { branches: 6, stones: 4 } },
			{ restedHold: 0.16, materials: { stones: 8, clay: 4 }, requires: { biome: 'forest', minHealth: 45 } },
			{ restedHold: 0.25, materials: { clay: 6, 'clean-water': 4 }, requires: { biome: 'wetland', minHealth: 55 } },
			{
				restedHold: 0.4,
				ability: 'openHearth',
				materials: { stones: 14, geode: 4, sand: 12 },
				requires: { biome: 'desert', minHealth: 50 },
			},
			{
				restedHold: 0.62,
				ability: 'hearthsong',
				materials: { obsidian: 8, 'quartz-crystal': 6, snow: 10 },
				requires: { biome: 'alpine', minHealth: 60 },
			},
			{
				restedHold: 1,
				ability: 'emberWatch',
				materials: { driftwood: 16, 'sea-glass': 8, kelp: 10 },
				requires: { biome: 'coastal', minHealth: 70 },
			},
		],
	},
};

/** Normalize a player's home config, migrating old linear `homeTier` saves. */
export function homeOf(player: any) {
	if (player?.home) return { ...DEFAULT_HOME, ...player.home };
	const t = player?.homeTier || 1; // legacy: map the old single tier onto space + comfort
	return { ...DEFAULT_HOME, space: t, comfort: t, styleLocked: t > 1 };
}
/** The Comfort track's carry bonus, plus whatever the room's coziness adds. */
export const homeCarryBonus = (player: any) =>
	(HOME_TRACKS.comfort.levels[(homeOf(player).comfort || 1) - 1]?.carry || 0) + homeCozy(player).carry;

/** The Furnishings track's multiplier on what the room's decor is worth (0..1). */
export const homeCozyBoost = (player: any) => HOME_TRACKS.decor.levels[(homeOf(player).decor || 1) - 1]?.cozyBoost || 0;

/** Extra day-fractions the Warmth track holds the well-rested boost past noon. */
export const homeRestedHold = (player: any) =>
	HOME_TRACKS.light.levels[(homeOf(player).light || 1) - 1]?.restedHold || 0;

/**
 * Every named ability this home has switched on (src/homeAbilities.ts).
 *
 * Derived from the LEVELS on the save, never stored: an ability is a fact about
 * the house, so moving one up or down the ladder retunes every existing save
 * with no migration — the same rule the coziness tiers follow.
 */
export const homeAbilities = (player: any): Set<HomeAbilityId> => homeAbilitiesOf(homeOf(player), HOME_TRACKS);

/** True if this player's home has `id`. The form nearly every call site wants. */
export const homeHas = (player: any, id: HomeAbilityId): boolean => hasHomeAbility(homeOf(player), HOME_TRACKS, id);

/** The two late Furnishings abilities, in the shape server/cozy.ts asks for.
 *  Every path that scores a room — reading it AND caching it — passes this, so
 *  the meter, the cache and the buff can never quote different numbers. */
export const homeCozyOpts = (player: any): CozyOpts => cozyOptsFor(homeOf(player), HOME_TRACKS);

/** What a recipe costs this player — the recipe's own materials, less whatever
 *  Fine Fittings (Furnishings 5) takes off a home furnishing. The crafting menu
 *  quotes the same function, so the card and the charge always agree. */
export const craftCost = (recipe: any, player: any): Record<string, number> =>
	craftCostWith(recipe, homeHas(player, 'fineFittings'));

/** The player's coziness reading WITH their Furnishings multiplier applied —
 *  the one every gameplay path should use, so nobody forgets the boost. */
export const homeCozy = (player: any): CozyReading => cozyOf(player, homeCozyBoost(player), homeCozyOpts(player));

// A freshly built house sits at 5 total track levels (space 2 + three at 1);
// every level bought on any track past that strengthens the style's perk.
const HOME_BASE_LEVELS = 5;

/** Nothing gets a free ride to certainty — a perk never reads as a sure thing. */
export const PERK_CEILING = 0.95;

/**
 * The signature perk of the player's house style, with its CURRENT strength
 * (0..1). null until the house is actually built — a tent grants nothing.
 *
 * Two inputs: the four upgrade tracks (capped at the style's `cap`), and the
 * room's coziness tier (added after that cap, so decorating keeps paying even
 * on a maxed house). `cozy` is returned alongside so callers that want to show
 * the split — the HUD does — don't have to read it twice.
 */
export function homePerk(
	player: any,
): { id: HomePerkDef['id']; strength: number; upgrades: number; cozy: CozyReading } | null {
	const home = homeOf(player);
	if (!home.styleLocked) return null;
	const perk = HOME_STYLES[home.style]?.perk;
	if (!perk) return null;
	const levels = (home.space || 1) + (home.comfort || 1) + (home.decor || 1) + (home.light || 1);
	const upgrades = Math.min(perk.cap, perk.base + perk.perLevel * Math.max(0, levels - HOME_BASE_LEVELS));
	const cozy = homeCozy(player);
	return { id: perk.id, strength: Math.min(PERK_CEILING, upgrades + cozy.perk), upgrades, cozy };
}

/** The floor plan of a Space level — the room list a level draws, defaulted for
 *  the two levels that are still a plain rectangle. */
export const spacePlan = (space: number): PlanDef => HOME_TRACKS.space.levels[(space || 1) - 1] as PlanDef;

/** A player's home laid out in the grid: every room, its doorways and its exit.
 *  Named `homeRoom` still because it is also a Rect — the bounding box of the
 *  whole floor — so callers that only want the extents read it unchanged. */
export function homeRoom(player: any): HomeLayout {
	const home = homeOf(player);
	// Warmth goes in because it decides where the windows are, and a window is a
	// place nothing may be hung — geometry as far as the placement rules care.
	return layoutOf(spacePlan(home.space || 1), GRID_W, GRID_H, home.light || 1);
}

/** The rooms of a player's home, for anything that needs them by id (per-room
 *  paint) rather than by tile. */
export const homeRooms = (player: any): LaidRoom[] => homeRoom(player).rooms;

// -------------------------------------------------- trail-tent interiors
// A pitched trail tent (one per wild biome) opens into its own little interior
// — area id `tent-<biome>` — that's decorated exactly like the home, just
// tent-sized (the starter home footprint, so only `homeMin` 1 furniture fits).
// Interiors are world-shared, like the home.
const TENT_INNER = { w: 6, h: 5 };
/** The wild-biome id a tent-interior area belongs to, or null if `area` isn't one. */
export function tentBiomeOf(area: any): string | null {
	const m = /^tent-([a-z][a-z-]*)$/.exec(String(area || ''));
	return m ? m[1] : null;
}
/** Interior layout for a trail tent (one fixed room, centered like the home). */
export function tentRoom(): HomeLayout {
	return layoutOf({ inner: TENT_INNER }, GRID_W, GRID_H, 1); // canvas has no windows
}

// ------------------------------------------------------- sleeping furniture
// The things you can sleep on. Sleeping skips the clock to the next dawn, so
// a bed parked in the doorway is a trap: every attempt to leave lands on it.
// Keep them clear of the exit. The client mirrors this rule so the placement
// ghost turns red (see canPlaceAt in src/game/WorldScene.ts), but this is the
// copy that counts — the frontend is never trusted.
//
// The hammock used to be on this list and is not any more: you lie in one, you
// don't sleep the day away in it (see the same set in src/game/interactions.ts).
// It follows that it is no longer held to the doorway rule either — nothing
// about lying in it skips the clock, so as far as the exit is concerned it is
// ordinary furniture.
export const SLEEPABLE_OBJECTS = new Set(['home-bed', 'home-sleeping-bag']);

/** The door tile of an interior: the floor tile just inside the exit, on the
 *  bottom wall of the main room. Both halves of the game read it off the same
 *  layout (src/homePlan.ts), so they cannot disagree about where the door is. */
export function doorTileOf(room: HomeLayout): { x: number; y: number } {
	return { x: room.doorX, y: room.doorY };
}

// --------------------------------------------------------------- tabletops
// Most of what you put down needs a tile to itself. A few things are FURNITURE
// YOU PUT THINGS ON — a table, a dresser, the top of a bookshelf — and a few
// others are small enough to stand on one: a vase, a snow globe, a model boat.
// Those two facts are `surface: true` and `small: true` in the object data, and
// together they buy exactly one exception to the one-thing-per-tile rule: a
// small thing may share a tile with a surface, and nothing else may share with
// anything.
//
// Deliberately no deeper than that. Two items per tile is a tabletop; three is a
// stack, and a stack is a physics problem — which of them is the player clicking
// on, which one comes off first, what happens when the bottom one is picked up.
// One-on-one keeps every one of those questions answerable.

export const isSurface = (def: any): boolean => !!def?.surface;
export const isSmall = (def: any): boolean => !!def?.small;

/**
 * True if `def` may be set down on a tile where `standing` is already placed.
 *
 * Only ever ONE direction: a small thing goes onto a surface. The reverse —
 * sliding a table under a vase already sitting on the floor — is refused, because
 * the tile it would be sharing is not a tabletop, it is the floor, and allowing it
 * means "a tile can hold two things" is no longer a rule anyone can predict.
 */
export function canStackOn(def: any, standing: any[]): boolean {
	if (!isSmall(def)) return false;
	return standing.length === 1 && isSurface(standing[0]);
}

/** The thing standing ON `placement`, if `placement` is a surface with something on it. */
export function itemOnSurface(def: any, sharing: { def: any; placement: any }[]): any | null {
	if (!isSurface(def)) return null;
	return sharing.find((o) => isSmall(o.def))?.placement || null;
}

// ------------------------------------------------------------ hanging space
// Some decor belongs on a wall and nowhere else — a framed landscape standing on
// the floorboards looked like something you had forgotten to hang. So an object
// def may carry `mount: 'wall'`, and those items place onto the WALL RING rather
// than the floor.
//
// Which tiles of that ring count is worked out in src/homePlan.ts — one rule for
// every floor plan, read by the server here and by the client's placement ghost
// (src/game/worldRules.ts). Corners are out, the door wall is out, the single
// tile of wall shared between two rooms is out, and a doorway is a hole rather
// than a wall. What is left is a run the player is always looking at.

/** True if this object def hangs on a wall rather than standing on the floor. */
export const isWallMounted = (def: any): boolean => def?.mount === 'wall';

/** True if (tx, ty) is part of a wall run — the shape test, windows included. */
export const isWallTile = (room: HomeLayout, tx: number, ty: number): boolean => isWallTileOf(room, tx, ty);

/** Every hangable wall tile of `room`, in reading order. */
export const wallTilesOf = (room: HomeLayout): { x: number; y: number }[] => wallTilesOfLayout(room);

/**
 * Where a piece being put down in an interior LANDS, or the code to refuse with.
 *
 * One place, so PlaceObject and MoveObject cannot drift apart, and the client's
 * preview reads the same function (src/homePlan.ts) so the ghost sits on the
 * tile the piece will actually end up on.
 *
 * Floor items land exactly where they were put. A wall item aimed AT THE WALL
 * lands on the nearest free spot along it — the clicked tile when that tile is
 * free, and the closest one that is otherwise. The two things that can already
 * own a wall tile are a window and another picture; both are plainly visible,
 * and sliding along one tile is a better answer to either than a refusal.
 * Aiming off the wall entirely is still refused: a painting does not fly to the
 * wall from the middle of the room.
 */
export type InteriorSpotError = 'server.err.hangOnWall' | 'server.err.placeOnFloor' | 'server.err.wallsFull';
export function interiorSpotFor(
	def: any,
	room: HomeLayout,
	tx: number,
	ty: number,
	taken: (x: number, y: number) => boolean,
): { x: number; y: number } | InteriorSpotError {
	if (!isWallMounted(def)) {
		// A doorway between two rooms is not floor — it is a hole in a wall, and one
		// tile wide. Nothing stands in it, so the way through is always clear.
		if (isOpening(room, tx, ty) || !isFloorTile(room, tx, ty)) return 'server.err.placeOnFloor';
		return { x: tx, y: ty };
	}
	if (!isWallTileOf(room, tx, ty)) return 'server.err.hangOnWall';
	return nearestHangSpot(room, tx, ty, taken) || 'server.err.wallsFull';
}

/**
 * True if a bed at (tx, ty) would sit on, or in the ring immediately around, the
 * doorway. Chebyshev distance ≤ 1, so the door tile and its eight neighbors are
 * all refused — enough to always leave a clear step in and out.
 */
export function blocksDoorway(objectId: string, room: HomeLayout, tx: number, ty: number): boolean {
	if (!SLEEPABLE_OBJECTS.has(objectId)) return false;
	const door = doorTileOf(room);
	return Math.abs(tx - door.x) <= 1 && Math.abs(ty - door.y) <= 1;
}
// Chance that digging a fresh soil bed turns up a buried material (not every dig).
export const DIG_FIND_CHANCE = 0.75;
export const CAPACITY_BY_BASKET: Record<number, number> = {
	1: 200,
	2: 350,
	3: 550,
	4: 800,
	5: 1100,
	6: 1500,
	7: 2000,
};

// The tier at which each late tool ability switches on, kept beside the capacity
// table so the whole ladder is tunable from one place. Tiers 1-4 are pure
// scalars (amount gathered/dug per action); 5-7 each add one ability on top.
export const BASKET_OVERFLOW_TIER = 5; // a full basket spills into your nearest chest
export const BASKET_FRAME_TIER = 6; // a stiff frame stops heavy material costing double
export const BASKET_SWEEP_TIER = 7; // one gather takes the whole adjacent cluster
export const SHOVEL_SURVEY_TIER = 6; // buried material is visible, and finding it is certain
export const SHOVEL_SALVAGE_TIER = 7; // clearing gives back what the tile absorbed
export const CAN_DIP_TIER = 6; // fill straight from any open water you shaped

/**
 * Brush size — how much ground one shaping action covers.
 *
 * This is a CHOICE, never a consequence of the tier. A bigger tool adds sizes to
 * the picker and changes nothing else: at 1x1 a tier-7 spade behaves exactly like
 * a tier-1 one, and the default is always 1x1. An upgrade that quietly started
 * shaping nine squares at a time would be taking the land out of the caretaker's
 * hands, which is the opposite of the point.
 */
export const BRUSH_SIZES = [1, 3, 9] as const;
export const BRUSH_3X3_TIER = 5;
export const BRUSH_9X9_TIER = 7;

/** The brush sizes a tool of this tier offers, smallest first. */
export function brushSizesFor(tier: number): number[] {
	const out = [1];
	if (tier >= BRUSH_3X3_TIER) out.push(3);
	if (tier >= BRUSH_9X9_TIER) out.push(9);
	return out;
}

// A 9x9 is 81 tiles, and that is the ceiling on purpose: it is one request and
// one recalc instead of the 81 requests the same work costs by hand, so the
// widest brush is cheaper than doing it the slow way, not more expensive.
export const MAX_BRUSH_TILES = 81;
// How many gather nodes one sweep may clear, the clicked one included.
export const MAX_SWEEP_NODES = 5;
// Roughly what share of an area's diggable tiles hide something. Low enough that
// a surveyed map reads as a handful of marks rather than a field of them.
export const BURIED_CACHE_DENSITY = 0.06;

// New caretakers start empty-handed — the first task is to gather seeds and
// fiber for a Grass Patch, so the tutorial's opening loop has real stakes.
// No starting seeds — the very first goal is "gather 10 seeds", so a fresh
// basket should read 0/10, not 2/10. (A little water lets you tend a bed right
// away for the tutorial.)
export const START_INVENTORY: Record<string, number> = { water: 6, wildflowers: 1 };
export const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1 };

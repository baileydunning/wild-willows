// Wild Willows — server: home
//
// The player's home — styles, upgrade tracks, perks and room geometry — plus the
// trail-tent interiors and the sleeping-furniture rules that share that geometry.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { GRID_H, GRID_W } from './biome';

// ----------------------------------------------------------- the home
// A personal interior (area id 'home') you step into from your camp tent, decorate
// with indoor "camp comfort" items, and upgrade. The home upgrades along FOUR
// independent tracks (Space, Comfort, Furnishings, Warmth) — you can pour
// materials into whichever you like — and you can take it in one of TWO style
// directions (a warm Woodland Cabin or a bright Meadow Cottage) that restyle the
// floor and walls. Space sets the room size; Comfort is the functional perk (a
// flat carry-capacity bonus); Furnishings and Warmth add cosmetic flourishes.
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
export const HOME_TRACKS: Record<string, { name: string; blurb: string; levels: any[] }> = {
	space: {
		name: 'Space',
		blurb: 'A bigger room with more floor to decorate.',
		levels: [
			{ inner: { w: 6, h: 5 } }, // tent
			{ inner: { w: 8, h: 6 }, materials: { branches: 12, fiber: 8 }, requires: { biome: 'meadow', minHealth: 30 } },
			{
				inner: { w: 10, h: 7 },
				materials: { branches: 18, stones: 6, clay: 6 },
				requires: { biome: 'forest', minHealth: 45 },
			},
			{
				inner: { w: 12, h: 9 },
				materials: { branches: 24, clay: 10, 'clean-water': 6 },
				requires: { biome: 'wetland', minHealth: 55 },
			},
		],
	},
	comfort: {
		name: 'Comfort',
		blurb: 'Carry more on every gathering trip (+capacity).',
		levels: [
			{ carry: 0 },
			{ carry: 45, materials: { fiber: 10, branches: 4 }, requires: { biome: 'meadow', minHealth: 35 } },
			{ carry: 95, materials: { fiber: 14, moss: 6 }, requires: { biome: 'forest', minHealth: 50 } },
			{ carry: 160, materials: { reeds: 10, fiber: 12 }, requires: { biome: 'wetland', minHealth: 60 } },
		],
	},
	decor: {
		name: 'Furnishings',
		blurb: 'A finer rug and wall trim in your style.',
		levels: [
			{},
			{ materials: { fiber: 8, wildflowers: 4 } },
			{ materials: { fiber: 12, berries: 6 }, requires: { biome: 'meadow', minHealth: 50 } },
			{ materials: { fiber: 16, clay: 6 }, requires: { biome: 'forest', minHealth: 55 } },
		],
	},
	light: {
		name: 'Warmth',
		blurb: 'Windows and a warm hearth glow.',
		levels: [
			{},
			{ materials: { branches: 6, stones: 4 } },
			{ materials: { stones: 8, clay: 4 }, requires: { biome: 'forest', minHealth: 45 } },
			{ materials: { clay: 6, 'clean-water': 4 }, requires: { biome: 'wetland', minHealth: 55 } },
		],
	},
};

/** Normalize a player's home config, migrating old linear `homeTier` saves. */
export function homeOf(player: any) {
	if (player?.home) return { ...DEFAULT_HOME, ...player.home };
	const t = player?.homeTier || 1; // legacy: map the old single tier onto space + comfort
	return { ...DEFAULT_HOME, space: t, comfort: t, styleLocked: t > 1 };
}
export const homeCarryBonus = (player: any) =>
	HOME_TRACKS.comfort.levels[(homeOf(player).comfort || 1) - 1]?.carry || 0;

// A freshly built house sits at 5 total track levels (space 2 + three at 1);
// every level bought on any track past that strengthens the style's perk.
const HOME_BASE_LEVELS = 5;

/**
 * The signature perk of the player's house style, with its CURRENT strength
 * (0..1). null until the house is actually built — a tent grants nothing.
 */
export function homePerk(player: any): { id: HomePerkDef['id']; strength: number } | null {
	const home = homeOf(player);
	if (!home.styleLocked) return null;
	const perk = HOME_STYLES[home.style]?.perk;
	if (!perk) return null;
	const levels = (home.space || 1) + (home.comfort || 1) + (home.decor || 1) + (home.light || 1);
	const strength = Math.min(perk.cap, perk.base + perk.perLevel * Math.max(0, levels - HOME_BASE_LEVELS));
	return { id: perk.id, strength };
}

/** Interior floor rectangle (tile coords) for a player's home, centered in the grid. */
export function homeRoom(player: any) {
	const inner = HOME_TRACKS.space.levels[(homeOf(player).space || 1) - 1]?.inner || { w: 8, h: 6 };
	const x0 = Math.floor((GRID_W - inner.w) / 2);
	const y0 = Math.floor((GRID_H - inner.h) / 2);
	return { x0, y0, x1: x0 + inner.w - 1, y1: y0 + inner.h - 1 };
}

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
/** Interior floor rectangle for a trail tent (fixed size, centered like the home). */
export function tentRoom() {
	const x0 = Math.floor((GRID_W - TENT_INNER.w) / 2);
	const y0 = Math.floor((GRID_H - TENT_INNER.h) / 2);
	return { x0, y0, x1: x0 + TENT_INNER.w - 1, y1: y0 + TENT_INNER.h - 1 };
}

// ------------------------------------------------------- sleeping furniture
// The two things you can sleep on. Sleeping skips the clock to the next dawn, so
// a bed parked in the doorway is a trap: every attempt to leave lands on it.
// Keep them clear of the exit. The client mirrors this rule so the placement
// ghost turns red (see canPlaceAt in src/game/WorldScene.ts), but this is the
// copy that counts — the frontend is never trusted.
export const SLEEPABLE_OBJECTS = new Set(['home-bed', 'home-sleeping-bag']);

/** The door tile of an interior: bottom wall, horizontally centered. Must match
 *  `roomSpec()` in the client, which derives it from the same rectangle. */
export function doorTileOf(room: { x0: number; y0: number; x1: number; y1: number }): { x: number; y: number } {
	return { x: Math.round((room.x0 + room.x1) / 2), y: room.y1 };
}

/**
 * True if a bed at (tx, ty) would sit on, or in the ring immediately around, the
 * doorway. Chebyshev distance ≤ 1, so the door tile and its eight neighbors are
 * all refused — enough to always leave a clear step in and out.
 */
export function blocksDoorway(
	objectId: string,
	room: { x0: number; y0: number; x1: number; y1: number },
	tx: number,
	ty: number,
): boolean {
	if (!SLEEPABLE_OBJECTS.has(objectId)) return false;
	const door = doorTileOf(room);
	return Math.abs(tx - door.x) <= 1 && Math.abs(ty - door.y) <= 1;
}
// Chance that digging a fresh soil bed turns up a buried material (not every dig).
export const DIG_FIND_CHANCE = 0.75;
export const CAPACITY_BY_BASKET: Record<number, number> = { 1: 200, 2: 350, 3: 550, 4: 800 };

// New caretakers start empty-handed — the first task is to gather seeds and
// fiber for a Grass Patch, so the tutorial's opening loop has real stakes.
// No starting seeds — the very first goal is "gather 10 seeds", so a fresh
// basket should read 0/10, not 2/10. (A little water lets you tend a bed right
// away for the tutorial.)
export const START_INVENTORY: Record<string, number> = { water: 6, wildflowers: 1 };
export const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1 };

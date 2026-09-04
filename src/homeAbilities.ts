// Wild Willows — home abilities (shared)
//
// The four upgrade tracks used to end at level 4, which was also the end of the
// preserve you had seen: the wetland. Past it lie the desert, the alpine and the
// coast, and a house that stopped growing three biomes early stopped being a
// thing you thought about. So every track now runs to SEVEN, and each of those
// late levels is gated on one of the three far biomes.
//
// The first four levels of a track buy a NUMBER — a bigger room, more carry, a
// higher multiplier, a longer morning. Numbers are the right shape for the early
// game and the wrong shape for the end of it: doubling a bonus you already have
// is not a reason to spend a week of desert clay. So each of the twelve new
// levels also switches on a named ABILITY — one sentence of new behaviour you
// can feel the moment you walk out the door.
//
// This module is the one list of them, imported by BOTH halves of the game: the
// server decides with it (server/home.ts and the endpoints), and the client
// draws the menu and runs the two that are pure presentation (the walking speed
// and the animals that come over) from the same ids. Which level grants which
// ability lives in HOME_TRACKS, not here, so a retune moves an ability up or
// down the ladder without touching this file.
//
// PURE MODULE — no imports, no database. Keep it that way.

/** Every named ability a home upgrade can switch on. */
export type HomeAbilityId =
	// Comfort — what the caretaker can carry and how they move.
	| 'lightLoad'
	| 'homeOverflow'
	| 'briskStep'
	// Furnishings — what the room itself is worth.
	| 'fineFittings'
	| 'curatorsEye'
	| 'showcase'
	// Warmth — the hearth, and who it draws in.
	| 'openHearth'
	| 'hearthsong'
	| 'emberWatch';

export interface HomeAbilityDef {
	id: HomeAbilityId;
	/** The track that grants it — for grouping in the menu. */
	track: 'space' | 'comfort' | 'decor' | 'light';
	/** What it is called, in the house menu and the upgrade toast. */
	name: string;
	/** One sentence: what changes about playing. Written as a promise, not a
	 *  formula — the numbers live in the code that reads the ability. */
	blurb: string;
}

/**
 * The nine abilities, in ladder order per track.
 *
 * Space grants none, on purpose. Its late levels open floor plans of six, seven
 * and eight rooms, and floor space is not a passive bonus — it is where every
 * other track's payoff goes. A bigger house holds more pieces, more kinds of
 * piece and more kinds of comfort, which is the coziness reading (server/cozy.ts),
 * which is carry, walking speed and the style perk. Space already pays three
 * times over; giving it a fourth thing to do would have made the other tracks
 * read as its accessories.
 */
export const HOME_ABILITIES: Record<HomeAbilityId, HomeAbilityDef> = {
	// ---------------------------------------------------------------- comfort
	lightLoad: {
		id: 'lightLoad',
		track: 'comfort',
		name: 'Packed Well',
		blurb: 'Bulk earth and stone ride in the basket as though they were light.',
	},
	homeOverflow: {
		id: 'homeOverflow',
		track: 'comfort',
		name: 'Standing Order',
		blurb:
			'A full basket never turns you away — the spare goes home to your own chests, from anywhere in the preserve.',
	},
	briskStep: {
		id: 'briskStep',
		track: 'comfort',
		name: 'Second Wind',
		blurb: 'You walk quicker everywhere, rested or not — the comfort of the place follows you out the door.',
	},
	// ------------------------------------------------------------ furnishings
	fineFittings: {
		id: 'fineFittings',
		track: 'decor',
		name: 'Fine Fittings',
		blurb: 'You make your own trim now: anything for the house costs a quarter less to craft.',
	},
	curatorsEye: {
		id: 'curatorsEye',
		track: 'decor',
		name: "Curator's Eye",
		blurb: 'You know how to arrange a room: variety and balance pay far sooner than they used to.',
	},
	showcase: {
		id: 'showcase',
		track: 'decor',
		name: 'Showcase',
		blurb: 'There is a rung above Beloved after all. A storied house carries more, and sends you out quicker still.',
	},
	// ----------------------------------------------------------------- warmth
	openHearth: {
		id: 'openHearth',
		track: 'light',
		name: 'Open Hearth',
		blurb: 'Sit still and the animals set off sooner, and come from further across the area.',
	},
	hearthsong: {
		id: 'hearthsong',
		track: 'light',
		name: 'Hearthsong',
		blurb: 'The gathering grows: eight animals settle around you instead of five, and they settle closer in.',
	},
	emberWatch: {
		id: 'emberWatch',
		track: 'light',
		name: 'Ember Watch',
		blurb: 'You no longer need a seat. Stand still anywhere and they come — ten of them.',
	},
};

/** A level of an upgrade track, as far as this module cares. */
interface AbilityLevel {
	ability?: string;
}
/** The track table, as far as this module cares (server/home.ts HOME_TRACKS, and
 *  the same object shipped to the client in GameData). */
export type AbilityTracks = Record<string, { levels?: AbilityLevel[] } | undefined>;

/**
 * A player's home config, as far as this module cares: whether the house has
 * been built, and a level under each track's own key.
 *
 * Deliberately NOT an index signature. Every caller hands in something with a
 * real shape — HomeConfig on the client, a save row on the server — and an
 * interface is not assignable to Record<string, unknown> in TypeScript, so
 * asking for one here would have every call site writing a cast. The key lookup
 * casts once, inside, where the dynamic access actually happens.
 */
export interface HomeLike {
	styleLocked?: boolean;
}
const levelOf = (home: HomeLike, track: string): number => Number((home as Record<string, unknown>)[track]) || 1;

const isAbility = (id: unknown): id is HomeAbilityId =>
	typeof id === 'string' && Object.prototype.hasOwnProperty.call(HOME_ABILITIES, id);

/**
 * Every ability a home currently has.
 *
 * Read off the LEVELS the player has bought, not stored on the save: an ability
 * is a fact about the house, so retuning which level grants it retunes every
 * existing save with no migration — exactly like the coziness tiers.
 *
 * `home` is the player's home config; a house that was never built (no style
 * locked) has nothing, because none of this exists in a canvas tent.
 */
export function homeAbilitiesOf(
	home: HomeLike | null | undefined,
	tracks: AbilityTracks | null | undefined,
): Set<HomeAbilityId> {
	const out = new Set<HomeAbilityId>();
	if (!home?.styleLocked || !tracks) return out;
	for (const [key, def] of Object.entries(tracks)) {
		const level = levelOf(home, key);
		const levels = def?.levels || [];
		// levels[0] is level 1 — the free starter rung — so the first `level`
		// entries are the ones this house has actually reached.
		for (let i = 0; i < Math.min(level, levels.length); i++) {
			const id = levels[i]?.ability;
			if (isAbility(id)) out.add(id);
		}
	}
	return out;
}

/** True if this home has `id`. The one-shot form of homeAbilitiesOf, for the
 *  call sites that only ask about one ability (most of them). */
export function hasHomeAbility(
	home: HomeLike | null | undefined,
	tracks: AbilityTracks | null | undefined,
	id: HomeAbilityId,
): boolean {
	if (!home?.styleLocked || !tracks) return false;
	const def = HOME_ABILITIES[id];
	const levels = tracks[def.track]?.levels || [];
	const level = levelOf(home, def.track);
	for (let i = 0; i < Math.min(level, levels.length); i++) if (levels[i]?.ability === id) return true;
	return false;
}

/**
 * The two late Furnishings abilities in the shape server/cozy.ts asks for.
 *
 * Every path that scores a room passes this — the server's buffs, the server's
 * cache, and the live meter on the HUD — so the three can never quote different
 * numbers at each other. Structural, not imported from cozy.ts: this module
 * stays pure and dependency-free, and cozy.ts stays free of the ability list.
 */
export function cozyOptsFor(
	home: HomeLike | null | undefined,
	tracks: AbilityTracks | null | undefined,
): { curator: boolean; showcase: boolean } {
	return {
		curator: hasHomeAbility(home, tracks, 'curatorsEye'),
		showcase: hasHomeAbility(home, tracks, 'showcase'),
	};
}

// ------------------------------------------------------------ Fine Fittings
// The one ability whose effect is a NUMBER the player reads before they act, so
// it lives here rather than in the endpoint: the crafting menu has to quote the
// same price the server is about to charge, or the discount reads as a bug the
// first time a recipe costs less than the card said.

/** How much Fine Fittings takes off a home furnishing. */
export const FITTINGS_DISCOUNT = 0.25;
/** The recipe category it applies to — the indoor furniture, and only that. */
export const FITTINGS_CATEGORY = 'home';

/**
 * What a recipe actually costs this house.
 *
 * Rounded DOWN (the discount should feel like a discount) but never below one:
 * a fitting that took a single reed still takes a single reed, because free
 * furniture would make the coziness ladder a formality rather than a project.
 * Anything that isn't a home furnishing, and any house without the ability,
 * gets the recipe's own materials back unchanged.
 */
export function craftCostWith(
	recipe: { category?: string; materials?: Record<string, number> } | null | undefined,
	fineFittings: boolean,
): Record<string, number> {
	const materials = recipe?.materials || {};
	if (!fineFittings || recipe?.category !== FITTINGS_CATEGORY) return materials;
	const out: Record<string, number> = {};
	for (const [id, qty] of Object.entries(materials)) out[id] = Math.max(1, Math.floor(qty * (1 - FITTINGS_DISCOUNT)));
	return out;
}

// -------------------------------------------------------------- Second Wind
/**
 * The walking-speed multiplier Second Wind (Comfort 7) grants, always, anywhere.
 *
 * Sized deliberately below the hiking boots (1.2) and below a Beloved night's
 * sleep: it is the floor under both rather than a third thing racing them, and
 * it multiplies with them the way they multiply with each other. What it
 * actually buys is that the slow walk — no boots on, nothing slept off — stops
 * existing once the house is finished.
 */
export const BRISK_STEP_SPEED = 1.12;

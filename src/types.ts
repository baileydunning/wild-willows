// Shared frontend types for Wild Willows.

export interface BiomeDef {
	id: string;
	name: string;
	order: number;
	explorable: boolean;
	description: string;
	restorationGoal: string;
	unlock: null | {
		biome: string;
		minHealth?: number;
		minAnimals?: number;
		minTotalAnimals?: number;
		requiresItem?: string;
		requiresTool?: { id: string; tier: number };
		label: string;
	};
	resources: string[];
	/** Materials the shovel can randomly turn up when digging a soil bed here. */
	digResources?: string[];
	palette: { damaged: string; healthy: string };
	canFlood?: boolean;
	/** Playable grid size (tiles). Biomes are different sizes — the meadow is the
	 * biggest. Alpine's mountain band / coastal's ocean band are added on top. */
	grid?: { cols: number; rows: number };
}

export interface AnimalSource {
	/** Publisher/source name, e.g. "Cornell Lab — All About Birds". */
	name: string;
	/** Canonical URL for the reference. */
	url: string;
}

/** A food-web edge: an animal id, optionally narrowed to a life stage. */
export type FoodEdge = string | { id: string; stage?: 'eggs' | 'young' | 'adult' };

export interface AnimalDef {
	id: string;
	name: string;
	biome: string;
	kind: string;
	diet: string;
	shelter: string;
	fact: string;
	rarity: string;
	featured?: boolean;
	preferredHabitat: string;
	/** Latin binomial (or genus for composite entries), verified against sources. */
	scientificName?: string;
	/** 2–3 sentence ecosystem-role write-up (keystone, pollinator, engineer, …). */
	role?: string;
	/** Coarse trophic position for the food-web view and a badge. */
	trophic?:
		| 'producer'
		| 'herbivore'
		| 'omnivore'
		| 'insectivore'
		| 'mesopredator'
		| 'apex-predator'
		| 'scavenger'
		| 'filter-feeder'
		| 'decomposer'
		| 'detritivore';
	/** Animal ids (in this game) this species eats. Cross-biome links allowed.
	 * An edge may be stage-qualified when the predation is only true of a life
	 * stage — a bear takes deer fawns, not adult deer. */
	eats?: FoodEdge[];
	/** Animal ids (in this game) that eat this species. */
	eatenBy?: FoodEdge[];
	/** Non-animal food/forage eaten (e.g. "grasses", "nectar", "carrion"). */
	eatsOther?: string[];
	/** Credible references backing this entry's ecology. */
	sources?: AnimalSource[];
	requirements: {
		minHealth?: number;
		minBalance?: number;
		objects?: Record<string, number>;
		animals?: string[];
		hint?: string;
		/** Open water this animal needs in its area.
		 *
		 * `tiles` / `lake` / `river` are the shapes you dig: any water at all, a
		 * connected pond, a long channel. Those three are what canReturn() weighs
		 * (see server/resources.ts) — the rest of the animal's needs can be met and
		 * it still stays away until the water is there.
		 *
		 * `ocean` / `deep` describe water the coastal map already has, so they gate
		 * nothing and the journal deliberately doesn't list them as chores. They are
		 * kept because they say what the species actually needs. */
		water?: { tiles?: number; lake?: number; river?: number; ocean?: number; deep?: boolean };
		/** Rare-sighting gate: this animal only returns while the live weather /
		 * season / day-phase matches (any listed value). Derived server-side. */
		conditions?: { weather?: string[]; season?: string[]; dayPhase?: string[] };
		/** The one habitat object most associated with this species — authoring
		 * metadata from the ecology pass, carried in the data but not read at
		 * runtime today. */
		signature?: string;
		/** Objects whose presence keeps this animal away. Authored, currently
		 * empty everywhere, and not yet weighed by canReturn(). */
		excludes?: string[];
	};
}

export interface ResourceDef {
	id: string;
	name: string;
	tool: string;
	color: string;
}

/**
 * What a recipe is waiting on. Every listed condition must be met (AND), and no
 * two recipes in an area share the same set — each thing you can make has its
 * own reason to open up, drawn from a different part of the game.
 *
 * Unless noted, a condition reads the recipe's OWN area (`RecipeDef.unlockBiome`).
 */
export interface RecipeUnlock {
	/** Restoration health of this area, 0-100. */
	minHealth?: number;
	/** Ecological balance of this area (food-web completeness), 0-100. */
	minBalance?: number;
	/** How many of this area's animals have come home. */
	animalsReturned?: number;
	/** A specific animal of this area must be back. */
	requiresAnimal?: string;
	/** N animals of one kind ('bird', 'mammal', 'insect'…) back in this area. */
	requiresKind?: { kind: string; count: number };
	/** Animals welcomed back across the whole preserve. */
	totalAnimals?: number;
	/** Something you must have crafted at least once (anywhere, ever). */
	requiresCrafted?: string;
	/** How many DIFFERENT things you've crafted, ever. */
	craftedDistinct?: number;
	/** Copies of an object standing (or planted) in this area right now. */
	requiresPlaced?: { objectId: string; count: number };
	/** A tool upgraded to at least this tier. */
	requiresTool?: { id: string; tier: number };
	/** A home upgrade track raised to at least this level. */
	requiresHome?: { track: 'space' | 'comfort' | 'decor' | 'light'; level: number };
	/** You've traded the starting tent for an actual house (any style). */
	homeBuilt?: boolean;
	/** Once your clock has been through this time of day — 'dawn' | 'day' | 'dusk'
	 *  | 'night' (any listed). A one-way milestone: your first nightfall unlocks
	 *  the headlamp, and it stays unlocked at sunrise. */
	phaseSeen?: string[];
	/** Open water shaped in this area: total tiles / largest pond / longest channel. */
	requiresWater?: { tiles?: number; lake?: number; river?: number };
	/** Progress in a DIFFERENT area (mastery items that look outward). */
	requiresBiome?: { biome: string; minHealth: number };
	/** An achievement you must have earned. */
	requiresAchievement?: string;
	/** How many areas of the preserve are open. */
	biomesOpen?: number;
	/** Plain-language rendering of the whole condition, shown in the UI. */
	label: string;
}

export interface RecipeDef {
	id: string;
	name: string;
	category: string;
	unlockBiome: string;
	requiresTool?: { id: string; tier: number };
	once?: boolean;
	/** Progress gate within `unlockBiome`. Absent = craftable from the start. */
	unlock?: RecipeUnlock;
	output: { itemId: string; qty: number };
	materials: Record<string, number>;
}

export interface HabitatObjectDef {
	id: string;
	name: string;
	placement: 'outdoor' | 'indoor' | 'both' | 'none';
	biomes: string[];
	healthValue: number;
	needs: string[];
	shape: string;
	color: string;
	description: string;
	requiresTool?: { id: string; tier: number };
	isChest?: boolean;
	chestCapacity?: number;
	/** Only one of these per biome (e.g. the trail tent — each opens into one
	 * shared `tent-<biome>` interior, like the home). */
	onePerArea?: boolean;
	plantable?: boolean;
	plantCost?: Record<string, number>;
	growSeconds?: number;
	/** Real-time growth: hours until this living habitat is fully grown… */
	matureHours?: number;
	/** …and the bonus restoration points it contributes once it is. */
	matureBonus?: number;
	/** A renewable harvest: once mature, gathering grants this yield and the plant
	 * regrows it after `regrowSeconds` (it stays planted). A crafted structure can
	 * carry one too — the rain basin fills with water — in which case it is ready
	 * from the moment it is placed rather than from the moment it finishes growing. */
	yield?: { resourceId: string; qty: number; regrowSeconds: number };
	/** Weather types this object's yield can be taken in. A rain basin only gives
	 * up its water while rain is actually falling; absent means any weather. */
	harvestWeather?: string[];
	bridge?: boolean;
	/** Indoor items: minimum home size (Space track level) needed to place — a tent
	 * fits the basics; a fireplace needs a proper house. */
	homeMin?: number;
	/** Whether this object can be rotated when placing/moving (paths, fences,
	 * bridges, directional furniture). Computed server-side, sent in GameData. */
	rotatable?: boolean;
}

export interface ToolTier {
	tier: number;
	name: string;
	effect: string;
	/** Object-sprite key (obj-<shape>) for this specific tier, so the tool's
	 *  picture in the Tools & Upgrades menu evolves as you upgrade it. */
	shape?: string;
	materials?: Record<string, number>;
	/** `minHealth` is optional: a tier can name the area it belongs to purely as
	 *  provenance (the field guides do) without gating on restoration. */
	requires?: { biome: string; minHealth?: number };
}

export interface ToolDef {
	id: string;
	name: string;
	description: string;
	/** Object-sprite key (obj-<shape>) shown beside the tool in the Tools &
	 *  Upgrades menu, mirroring how crafting shows the thing you're making. */
	shape?: string;
	/** Set on the six field guides: which area's animals this one covers. The tools
	 *  menu shows only the guide for the ground the caretaker is standing on (see
	 *  guideBiomeFor), so the bench stays a short page rather than a catalogue of
	 *  books for places they may not have walked into yet. */
	journalBiome?: string;
	tiers: ToolTier[];
}

export interface AchievementDef {
	id: string;
	name: string;
	biome: string; // a biome id, or "preserve" for cross-biome / getting-started
	category: 'getting-started' | 'biome' | 'mastery' | 'preserve';
	order: number;
	points: number;
	hidden: boolean;
	icon: string;
	flavor: string;
	hint: string;
	/** Structured, exact unlock criteria — rendered into a plain requirement line
	 *  (see reqText in Achievements.tsx). Mirrors the server's ACHIEVEMENT_TRIGGERS. */
	req?: AchievementReq;
}

/** Machine-readable achievement criteria (kept in sync with server triggers). */
export type AchievementReq =
	| {
			t: 'collect' | 'craft' | 'craftDistinct' | 'plant' | 'terraform' | 'place' | 'observe' | 'unlocked' | 'total';
			n: number;
	  }
	| { t: 'returned' | 'health' | 'lake'; biome: string; n: number }
	| { t: 'kindReturned'; biome: string; kind: string; n: number }
	| { t: 'tools'; n: number }
	| { t: 'tool'; id: string; n: number }
	| { t: 'biomesAtHealth'; h: number; n: number }
	| { t: 'healthyOpen'; h: number; min: number }
	| { t: 'animal'; ids: string[]; mode?: 'all' | 'any' }
	| { t: 'animalChain'; all: string[]; any: string[] };

/** A house style's signature perk. Strength = min(cap, base + perLevel × extra
 * track levels beyond a fresh build). See homePerkStrength(). */
export interface HomePerkDef {
	id: 'forage' | 'growth' | 'thrift';
	base: number;
	perLevel: number;
	cap: number;
}

export interface HomeStyleDef {
	name: string;
	floor: string;
	wall: string;
	accent: string;
	materials?: Record<string, number>;
	requires?: { biome: string; minHealth: number };
	/** Signature gameplay perk this style grants once built. */
	perk?: HomePerkDef;
}

/** A freshly built house has 5 total track levels (space 2 + three tracks at 1). */
const HOME_BASE_LEVELS = 5;

/** Current strength (0..1) of a style perk given the home's track levels. */
export function homePerkStrength(perk: HomePerkDef, home: HomeConfig): number {
	const levels = (home.space || 1) + (home.comfort || 1) + (home.decor || 1) + (home.light || 1);
	return Math.min(perk.cap, perk.base + perk.perLevel * Math.max(0, levels - HOME_BASE_LEVELS));
}

/** When a yield-bearing thing is ready to harvest — its maturity the first time,
 *  then `regrowSeconds` after each harvest. null if it never yields / isn't
 *  planted. Shared by the client UI and the world glint.
 *
 *  Mirrors the server's copy in endpoints-game.ts, which is the one that counts.
 *  A planted thing has to finish growing before its first yield; a crafted
 *  structure that fills by itself (the rain basin) has nothing to grow, so it is
 *  ready as soon as it is standing. Weather is NOT part of this: readiness is a
 *  clock, and `harvestWeather` is a separate gate applied on top — a basin that
 *  is full but standing under a blue sky is ready and simply cannot be emptied
 *  yet. Keeping them apart is what stops a passing shower from resetting the
 *  regrow timer. */
/** Whether an object's yield can be taken under `weatherType`. `harvestWeather`
 *  absent or empty means any sky will do; a rain basin lists the wet ones.
 *  Mirrors the gate in HarvestPlacement (server/endpoints-game.ts), which is the
 *  copy that counts — this one only decides what the UI offers. */
export function harvestWeatherOk(def: HabitatObjectDef | undefined, weatherType: string): boolean {
	const gate = def?.harvestWeather;
	return !gate || gate.length === 0 || gate.includes(weatherType);
}

export function harvestReadyAt(
	def: HabitatObjectDef | undefined,
	p: { plantedAt?: number; lastHarvestAt?: number; placedAt?: number } | undefined,
): number | null {
	const y = def?.yield;
	if (!y || !p) return null;
	const regrowMs = (y.regrowSeconds || 60) * 1000;
	if (p.lastHarvestAt) return p.lastHarvestAt + regrowMs;
	if (def?.plantable) return p.plantedAt ? p.plantedAt + (def.growSeconds || 0) * 1000 : null;
	return p.placedAt ?? null;
}

export interface HomeTrackLevel {
	inner?: { w: number; h: number };
	carry?: number;
	materials?: Record<string, number>;
	requires?: { biome: string; minHealth: number };
}

export interface HomeTrackDef {
	name: string;
	blurb: string;
	levels: HomeTrackLevel[];
}

export interface HomeConfig {
	style: string;
	space: number;
	comfort: number;
	decor: number;
	light: number;
	/** Once you make your first upgrade, your style direction locks in. */
	styleLocked?: boolean;
	/** Custom interior colors painted over the style palette (paint tool). */
	colors?: { floor?: string; wall?: string; accent?: string; rug?: string };
}

export interface AppearanceOptions {
	skins: string[];
	hair: string[];
	outfits: string[];
	hats: string[];
	hatColors: string[];
	hairstyles: string[];
	beards: string[];
	bodies: string[];
}

export interface Appearance {
	skin: string;
	hair: string;
	outfit: string;
	hat: string;
	/** Custom hat color; unset/null = the hat's classic colors. */
	hatColor?: string | null;
	hairstyle: string;
	/** Facial hair (drawn in the hair color); 'none' by default. */
	beard?: string;
	body: string;
}

export interface GameData {
	biomes: BiomeDef[];
	animals: AnimalDef[];
	resources: ResourceDef[];
	recipes: RecipeDef[];
	habitatObjects: HabitatObjectDef[];
	tools: ToolDef[];
	achievements: AchievementDef[];
	homeStyles: Record<string, HomeStyleDef>;
	homeTracks: Record<string, HomeTrackDef>;
	nodeRegenSeconds: number;
	appearanceOptions: AppearanceOptions;
}

export interface Player {
	id: string;
	name: string;
	appearance?: Appearance;
	area: string;
	x: number;
	y: number;
	inventory: Record<string, number>;
	craftedItems: Record<string, number>;
	craftedEver?: Record<string, number>;
	tools: Record<string, number>;
	unlockedBiomes: string[];
	/** Areas the player has physically walked into at least once (enables fast-travel). */
	visitedBiomes?: string[];
	tutorialStep?: number;
	/** Furthest tutorial step ever reached. Progressive UI keys off this so
	 *  replaying the tutorial (which rewinds tutorialStep) never re-hides menu. */
	tutorialMaxStep?: number;
	/** Home interior config: style direction + four upgrade-track levels. */
	home?: HomeConfig;
	/** Dev-only: when true, every recipe is craftable regardless of progress gates. */
	devUnlockAll?: boolean;
}

export interface TerrainTile {
	id: string;
	area: string;
	x: number;
	y: number;
	type: 'tilled' | 'watered' | 'water';
	/** Pre-shaped starting terrain (Rushwater's channels and pond), laid down when
	 *  the area first unlocks. It is scenery the player was given, not work they
	 *  did, so it counts toward neither biome health nor the "shape N water tiles"
	 *  recipe gates — see seedStartingTerrain() and analyzeWater() on the server. */
	seeded?: boolean;
}

export interface BiomeState {
	id: string;
	biomeId: string;
	health: number;
	balance: number;
	returnedCount: number;
	unlocked: boolean;
	/**
	 * Open water the PLAYER shaped here — seeded starting channels excluded —
	 * as the largest connected body, written by recalcBiome from the biome's own
	 * terrain. It is what lets `waterShape` in src/recipes.ts answer for a biome
	 * the player is not standing in, now that the snapshot only sends the current
	 * area's tiles.
	 *
	 * Optional: a save whose biomes have not been recalculated since this field
	 * existed has no value yet, and every reader falls back to counting tiles.
	 */
	playerWater?: { tiles: number; lake: number; river: number };
}

/**
 * Derived weather block included in every state snapshot. Weather is a pure
 * deterministic function of (worldId, serverTime) computed server-side
 * (see server/weather.ts) — the client only reads it, never computes state.
 */
export interface WeatherSnapshot {
	season: string;
	dayPhase: string;
	/** 0..1 progress through the current in-game day. */
	dayProgress: number;
	dayIndex: number;
	/** Real-time length of one in-game day, so the client can advance lighting locally. */
	dayMs: number;
	/** Times of day this player's clock has already been through at least once
	 *  (mirrors phasesSeen() in server/weather.ts). Grows, never shrinks. */
	seenPhases?: string[];
	/** Active weather per biome (climate differs by biome). */
	byBiome: Record<string, { type: string; since: number }>;
	/** Present only when a dev override forces weather/season — honored verbatim. */
	override?: { type?: string | null; season?: string | null };
}

export interface ChestState {
	id: string;
	area: string;
	x: number;
	y: number;
	size: string;
	capacity: number;
	contents: Record<string, number>;
}

export interface Placement {
	id: string;
	objectId: string;
	area: string;
	x: number;
	y: number;
	placedAt?: number;
	plantedAt?: number;
	/** When this plant's yield was last harvested (drives regrow timing). */
	lastHarvestAt?: number;
	/** Optional per-item recolor (paint tool, home only). */
	color?: string;
	/** Quarter-turn rotation in degrees (0/90/180/270), set when placing/moving. */
	rotation?: number;
}

export interface Discovery {
	id: string;
	animalId: string;
	biomeId: string;
	comfort: number;
	timesObserved: number;
	firstObservedAt: number;
	whyReturned: string;
}

export interface NodeStateRec {
	id: string; // playerId:area:nodeId
	harvestedAt: number;
}

export interface GameState {
	/** The world this snapshot belongs to (solo world id === player id). */
	worldId?: string;
	player: Player;
	biomeStates: BiomeState[];
	placements: Placement[];
	chests: ChestState[];
	discoveries: Discovery[];
	nodeStates: NodeStateRec[];
	terrain: TerrainTile[];
	/** Ids of achievements this player has earned. */
	achievements: string[];
	/** Persisted activity-feed messages (oldest→newest, last 100 kept per player). */
	feed: { id: string; at: number; icon: string; text: string }[];
	serverTime: number;
	/** Derived weather/season/day-phase for this world at serverTime. */
	weather?: WeatherSnapshot;
	/** The on-screen task board: fixed starters + the player's own goals. */
	dailyTasks?: DailyTasksBlock;
	/** The player's saved custom goal definitions (for the goals builder menu). */
	customGoals?: CustomGoal[];
	/** How many custom goals may be held at once (3, or 6 once all biomes open). */
	goalLimit?: number;
	nodeRegenSeconds: number;
	inventoryCapacity: number;
}

export interface DailyTask {
	id: string;
	kind: string;
	icon: string;
	text: string;
	target: number;
	counter: string;
	reward: Record<string, number>;
	/** optional "how do I do this?" nudge, shown as a hover tip on the board */
	hint?: string;
	progress: number;
	claimed: boolean;
	/** Sub-requirement checklist (unlock-next-biome shows these inline; attract /
	 *  craft goals show them in a hover info box). */
	steps?: { text: string; done: boolean }[];
	/** Guidance goal — always on the board, tracks progress, isn't claimed. */
	pinned?: boolean;
	/** Set on goals whose progress is simply "how much of this are you holding"
	 *  (the opening gather goal, and any collect-N goal). The client recomputes
	 *  those locally as materials come in, so the bar moves with the basket rather
	 *  than with the next state sync — see withHeldTaskProgress in actionPatch.ts. */
	resourceId?: string;
	/** Held amount at the moment the goal was set; progress counts only what has
	 *  been gathered since. Zero for the fixed starter. */
	base?: number;
	/** This goal counts what has been DONE, not what is currently held, so it never
	 *  falls back when the player spends or removes the thing (the server keeps a
	 *  lifetime tally). */
	monotonic?: boolean;
	/** Which action credits this goal locally, so the bar moves on the same frame
	 *  as the act rather than at the next full sync — see withEventTaskProgress in
	 *  actionPatch.ts. 'gather' also matches on `resourceId`. */
	event?: 'gather' | 'place';
}

/**
 * Can the player write their own goals yet?
 *
 * They can once the starter chain is finished — no `start-*` task left on the
 * board. Until then the preserve sets the goals, and every "add this as a goal"
 * affordance (the target buttons on journal entries, recipes, house styles and
 * locked biomes) stays HIDDEN rather than sitting there refusing: a button that
 * exists but always says no teaches nothing except not to press buttons.
 *
 * A state with no board yet reads as locked — the caller re-renders when it
 * arrives, and showing the button for a frame and then taking it away is worse
 * than showing it a frame late.
 */
export function customGoalsUnlocked(state: { dailyTasks?: DailyTasksBlock } | null | undefined): boolean {
	const tasks = state?.dailyTasks?.tasks;
	if (!tasks) return false;
	return !tasks.some((t) => typeof t.id === 'string' && t.id.startsWith('start-'));
}

// ------------------------------------------------------------ field guides
//
// Each AREA has a guide, rather than the preserve sharing one ladder, and each
// guide is written up in two steps:
//
//   1  pocket notes    names, sketches, and a caretaker's hint
//   2  field guide     opens each animal's full page
//   3  expanded guide  spells out exactly what each animal is waiting for
//
// It is an ordinary tool, so it sits on the bench beside the basket and the
// shovel and offers one upgrade at a time — write up the field guide and the
// expanded edition is what it offers next. The id is built here, in one place,
// because the same string is spelled out in data/tools.json, the achievement
// trigger, the tools menu and both journal gates, and five spellings of one
// string is how one of them ends up wrong.
export const guideToolId = (biome: string) => `journal-${biome}`;

/** How far the guide to `biome` has been written up: 1, 2, or 3 (see above). */
export const guideLevel = (tools: Record<string, number> | undefined, biome: string) =>
	(tools || {})[guideToolId(biome)] || 1;

/** Can this save read the full animal pages for `biome` — role, food web, when
 *  to spot them, the habitat they keep? */
export const hasGuide = (tools: Record<string, number> | undefined, biome: string) => guideLevel(tools, biome) >= 2;

/** …and the exact list of what each animal there is waiting for? */
export const hasExpandedGuide = (tools: Record<string, number> | undefined, biome: string) =>
	guideLevel(tools, biome) >= 3;

/**
 * Which area's guides apply where the player is standing.
 *
 * The tools menu offers the books for HERE, and "here" is not always somewhere
 * with animals in it: the home interior is `home`, and a trail tent is
 * `tent-<biome>`. Both belong to a real place — your camp is in the meadow, a
 * tent is pitched in the biome it was carried to — so they resolve to it rather
 * than showing an empty shelf. Anything unrecognised falls back to the meadow,
 * which is where a save with no area at all begins.
 */
export function guideBiomeFor(area: string | null | undefined): string {
	if (!area || area === 'home') return 'meadow';
	const tent = /^tent-([a-z][a-z-]*)$/.exec(area);
	return tent ? tent[1] : area;
}

export interface DailyTasksBlock {
	dayKey: number;
	/** When this board expires (the next local morning) and a fresh one appears. */
	endsAt: number;
	tasks: DailyTask[];
}

/** A player-authored goal — the building block of the custom task list. */
export type CustomGoalKind =
	| 'craft'
	| 'build'
	| 'grow'
	| 'plant'
	| 'collect'
	| 'observe'
	| 'welcome'
	| 'attract'
	| 'welcomeTotal'
	| 'home'
	| 'tool'
	| 'unlock'
	| 'health'
	| 'biomeAnimals';
export interface CustomGoal {
	id: string;
	kind: CustomGoalKind;
	target: number;
	/** habitat-object id (craft/build), resource id (collect), animal id (welcome), home track (home), biome id (unlock). */
	itemId?: string;
	resourceId?: string;
	animalId?: string;
	track?: string;
	/** which house style to build (home goals with track 'build'). */
	styleId?: string;
	/** which tool to upgrade (tool goals); target holds the goal tier. */
	toolId?: string;
	biomeId?: string;
	/** metric value(s) captured when the goal was created (server-managed). */
	base?: number;
	basePlace?: number;
}

export type PanelId =
	| 'inventory'
	| 'crafting'
	| 'chest'
	| 'journal'
	| 'tools'
	| 'biomes'
	| 'achievements'
	| 'feed'
	| 'home'
	| 'animal'
	| 'settings'
	| 'weather'
	| 'materials'
	| 'goals'
	| null;

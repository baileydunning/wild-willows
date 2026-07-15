// Shared frontend types for Wild Willows.

/**
 * A world the player can enter. Single-player is a private "world of one"
 * (`solo: true`); co-op worlds are shared by several members via `joinCode`.
 * Personal progress (inventory, tools, achievements) always stays per-player —
 * only the world's restorable state (biomes, terrain, placements, animals) is shared.
 */
export interface WorldSummary {
	worldId: string;
	name: string;
	solo: boolean;
	role: 'owner' | 'member';
	joinCode: string | null;
	memberCount: number;
	maxMembers: number;
	isOwner: boolean;
}

/** A pending request to join the host's co-op world, shown in the People menu. */
export interface PendingRequest {
	token: string;
	name: string;
	createdAt: number;
}

/** A caretaker on a co-op world's roster (everyone who has ever joined). */
export interface RosterEntry {
	playerId: string;
	name: string;
	isOwner: boolean;
	joinedAt: number;
}

/** Another player currently in the same co-op world (for live presence avatars). */
export interface Peer {
	playerId: string;
	name: string;
	appearance: Appearance;
	area: string;
	x: number;
	y: number;
}

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
		| 'decomposer';
	/** Animal ids (in this game) this species eats. Cross-biome links allowed. */
	eats?: string[];
	/** Animal ids (in this game) that eat this species. */
	eatenBy?: string[];
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
		/** Rare-sighting gate: this animal only returns while the live weather /
		 * season / day-phase matches (any listed value). Derived server-side. */
		conditions?: { weather?: string[]; season?: string[]; dayPhase?: string[] };
	};
}

export interface ResourceDef {
	id: string;
	name: string;
	tool: string;
	color: string;
}

export interface RecipeUnlock {
	minHealth?: number;
	animalsReturned?: number;
	requiresAnimal?: string;
	requiresCrafted?: string;
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
	 * regrows it after `regrowSeconds` (it stays planted). */
	yield?: { resourceId: string; qty: number; regrowSeconds: number };
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
	requires?: { biome: string; minHealth: number };
}

export interface ToolDef {
	id: string;
	name: string;
	description: string;
	/** Object-sprite key (obj-<shape>) shown beside the tool in the Tools &
	 *  Upgrades menu, mirroring how crafting shows the thing you're making. */
	shape?: string;
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

/** When a yield-bearing plant is ready to harvest — its maturity the first time,
 *  then `regrowSeconds` after each harvest. null if it never yields / isn't
 *  planted. Shared by the client UI and the world glint. */
export function harvestReadyAt(
	def: HabitatObjectDef | undefined,
	p: { plantedAt?: number; lastHarvestAt?: number } | undefined,
): number | null {
	const y = def?.yield;
	if (!y || !def?.plantable || !p?.plantedAt) return null;
	const growMs = (def.growSeconds || 0) * 1000;
	const regrowMs = (y.regrowSeconds || 60) * 1000;
	return p.lastHarvestAt ? p.lastHarvestAt + regrowMs : p.plantedAt + growMs;
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
}

export interface BiomeState {
	id: string;
	biomeId: string;
	health: number;
	balance: number;
	returnedCount: number;
	unlocked: boolean;
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
	| 'people'
	| 'weather'
	| 'materials'
	| 'goals'
	| null;

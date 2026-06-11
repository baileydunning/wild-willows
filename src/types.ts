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
		requiresItem?: string;
		requiresTool?: { id: string; tier: number };
		label: string;
	};
	resources: string[];
	palette: { damaged: string; healthy: string };
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
	requirements: {
		minHealth?: number;
		minBalance?: number;
		objects?: Record<string, number>;
		animals?: string[];
		hint?: string;
	};
}

export interface ResourceDef {
	id: string;
	name: string;
	tool: string;
	color: string;
}

export interface RecipeDef {
	id: string;
	name: string;
	category: string;
	unlockBiome: string;
	requiresTool?: { id: string; tier: number };
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
	bundle?: Record<string, number>;
	plantable?: boolean;
	plantCost?: Record<string, number>;
	growSeconds?: number;
	bridge?: boolean;
}

export interface ToolTier {
	tier: number;
	name: string;
	effect: string;
	materials?: Record<string, number>;
	requires?: { biome: string; minHealth: number };
}

export interface ToolDef {
	id: string;
	name: string;
	description: string;
	tiers: ToolTier[];
}

export interface AppearanceOptions {
	skins: string[];
	hair: string[];
	outfits: string[];
	hats: string[];
	hairstyles: string[];
	bodies: string[];
}

export interface Appearance {
	skin: string;
	hair: string;
	outfit: string;
	hat: string; // 'straw' | 'leaf' | 'beanie' | 'none'
	hairstyle: string; // 'short' | 'long' | 'ponytail' | 'bun' | 'curly'
	body: string; // 'slim' | 'round'
}

export interface GameData {
	biomes: BiomeDef[];
	animals: AnimalDef[];
	resources: ResourceDef[];
	recipes: RecipeDef[];
	habitatObjects: HabitatObjectDef[];
	tools: ToolDef[];
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
	tools: Record<string, number>;
	unlockedBiomes: string[];
	tutorialStep?: number;
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
	plantedAt?: number;
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
	player: Player;
	biomeStates: BiomeState[];
	placements: Placement[];
	chests: ChestState[];
	discoveries: Discovery[];
	nodeStates: NodeStateRec[];
	terrain: TerrainTile[];
	serverTime: number;
	nodeRegenSeconds: number;
	inventoryCapacity: number;
}

export type PanelId =
	| 'inventory'
	| 'crafting'
	| 'chest'
	| 'journal'
	| 'tools'
	| 'biomes'
	| 'animal'
	| 'settings'
	| null;

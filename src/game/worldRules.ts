/**
 * World rules — the decidable half of WorldScene.
 *
 * Everything in here answers a question with an answer you can write a test
 * for: how big is this area, can something be placed on this tile, where do
 * the gather nodes go, what does this click to the shovel actually mean.
 * Nothing in here draws, tweens, subscribes, or touches Phaser.
 *
 * It exists for the same reason interactions.ts does. These rules were private
 * methods on a Phaser scene that needs a WebGL context to instantiate, so they
 * could not be tested where they lived — and the invariants leaked out as
 * COMMENTS in tests of other modules instead ("Mirrors the gate in
 * WorldScene…", "WorldScene.nodeAvailable reads `${worldId}:${area}:${nodeId}`
 * …"). A transcribed rule drifts from the real one silently. Now the real one
 * is the one under test.
 *
 * Deliberately NOT here: the memo caches (nodeStateMap, placementByTile,
 * objectDefMap, the sprite pools). Those are the scene's, they are load-bearing
 * performance work, and moving them behind a module boundary would either
 * duplicate them or force everything to reach back through the scene — which
 * is the same coupling with more indirection. The scene keeps the caches and
 * calls in here for the decision.
 */
import { blocksDoorway } from './interactions';
import { type HomeLayout, isFloorTile, isOpening, isWallTile, nearestHangSpot } from '../homePlan';
import type { BiomeDef } from '../types';

// ----------------------------------------------------------------- constants

export const TILE = 32;

/** Base grid — the home interior's world size, and the fallback for any biome
 *  without an explicit `grid` in data/biomes.json. */
export const OUT_W = 30;
export const OUT_H = 20;

/** Rows reserved for Graywind Heights' impassable alpine range. */
export const MTN_ROWS = 8;
/** Columns reserved for the ocean along Pelican Shore's east edge. */
export const COAST_COLS = 4;

/** Base camp: tent + campfire scenery beside the crafting station & chest. */
export const CAMP = { tent: { x: 20.5, y: 4.2 }, fire: { x: 21.6, y: 5.1 } };
/** Right in front of the tent door — where you land stepping out of the home. */
export const CAMP_TENT_FRONT = { x: CAMP.tent.x, y: CAMP.tent.y + 1.8 };
/** Keep nodes/placements clear of camp. */
export const CAMP_BLOCK = { x0: 19.5, y0: 3.2, x1: 23.9, y1: 5.9 };

/** The west→east walking order of the preserve. */
export const AREA_ORDER = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];
export const SPAWN_DEFAULT = { x: 24, y: 11 };

/**
 * Can the animal layer be painted yet? BOTH halves have to be in hand: the save
 * (which discoveries have returned) and the definitions (what each species is).
 * On a fresh login the scene routinely boots before one or both land, and the
 * two arrive independently — so this is asked on every repaint, not just once.
 */
export function animalsReady(
	data: { animals?: unknown[] } | null | undefined,
	state: unknown | null | undefined,
): boolean {
	return !!state && !!data && Array.isArray(data.animals) && data.animals.length > 0;
}

/**
 * How many animal sprites one area may draw at once. Every species a biome can
 * hold has returned when this is reached, so the cap is a safety bound on the
 * layer, not a density knob: a fully restored area is supposed to look full.
 * Keep it at or above the largest per-biome animal roster in data/animals-*.json.
 */
export const ANIMAL_DRAW_CAP = 30;

/** How long a shaped tile ignores a second command (see shouldSwallowRepeat). */
export const TERRAFORM_REPEAT_MS = 700;

/**
 * Basket tier at which one gather clears a whole patch, and how many extra spots
 * the client offers up with the one that was clicked. Mirrors BASKET_SWEEP_TIER
 * and MAX_SWEEP_NODES on the server, which remains the authority — these only
 * decide whether it is worth naming the neighbours at all.
 */
export const SWEEP_TIER = 7;
export const SWEEP_REACH = 4;

/**
 * Brush sizes — how much ground one shaping action covers. A CHOICE, never a
 * consequence of the tier: a better tool adds sizes to the picker and changes
 * nothing else, and the default is always 1x1. Mirrors brushSizesFor on the
 * server, which remains the authority and refuses anything the tier has not
 * earned.
 */
export const BRUSH_SIZES = [1, 3, 9];
/** Watering-can tier that can fill straight from open water you shaped. */
export const DIP_TIER = 6;
export const BRUSH_3X3_TIER = 5;
export const BRUSH_9X9_TIER = 7;

/** The brush sizes a tool of this tier offers, smallest first. */
export function brushSizesFor(tier: number): number[] {
	const out = [1];
	if (tier >= BRUSH_3X3_TIER) out.push(3);
	if (tier >= BRUSH_9X9_TIER) out.push(9);
	return out;
}

/** Player-chosen zoom: up to two steps out and two steps in from "perfect". */
export const ZOOM_STEP = 1.25;
export const USER_ZOOM_MIN = 1 / (ZOOM_STEP * ZOOM_STEP);
export const USER_ZOOM_MAX = ZOOM_STEP * ZOOM_STEP;

/** Phaser.Math.Clamp, without Phaser. */
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const dist = (x0: number, y0: number, x1: number, y1: number): number => Math.hypot(x1 - x0, y1 - y0);

// -------------------------------------------------------------------- hashing

export function hashStr(s: string): number {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

/** Fold an epoch-milliseconds value into a running hash, BOTH halves of it.
 *  `^` coerces through ToInt32, and a 13-digit ms timestamp does not fit — so
 *  mixing one in directly would silently discard everything above bit 31 and
 *  let two times exactly 2^32 ms apart (~49.7 days) hash identically. Growth
 *  and regrow timers are driven off these, so that collision would show up as a
 *  plant that never visually matures. */
export function mixMs(h: number, ms: number): number {
	const lo = ms >>> 0;
	const hi = Math.floor(ms / 4294967296) >>> 0;
	h = Math.imul(h ^ lo, 16777619) >>> 0;
	return Math.imul(h ^ hi, 16777619) >>> 0;
}

export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ------------------------------------------------------------------ geometry

/** Everything derived from an area's grid. */
export interface AreaDims {
	cols: number;
	baseRows: number;
	/** baseRows plus any reserved mountain band. */
	rows: number;
	/** First walkable row — the mountain band sits above it. */
	playTop: number;
	/** First ocean column; playable land is columns 1..landRight-1. */
	landRight: number;
	/** Row the trail gates sit on. */
	gateY: number;
}

/** Width of an area's impassable ocean band, 0 for an inland area. */
export function oceanColsOf(area: string, biomes?: BiomeDef[]): number {
	if (area === 'home') return 0;
	const def = biomes?.find((b) => b.id === area) as any;
	if (def?.oceanCols) return def.oceanCols;
	return area === 'coastal' ? COAST_COLS : 0;
}

export function dimsOf(area: string, biomes?: BiomeDef[]): AreaDims {
	const g = area === 'home' ? null : (biomes?.find((b) => b.id === area) as any)?.grid;
	const cols = g?.cols || OUT_W;
	const baseRows = g?.rows || OUT_H;
	const mtn = area === 'alpine' ? MTN_ROWS : 0;
	const ocean = oceanColsOf(area, biomes);
	return {
		cols,
		baseRows,
		rows: baseRows + mtn,
		playTop: mtn,
		// Same test as gateGeomOf() on the server: an area has an ocean band if the
		// data gives it one. COAST_COLS only covers a definition that names no width.
		landRight: ocean ? cols - ocean : cols,
		// gates sit at the vertical middle of the playable band
		gateY: mtn + baseRows / 2 - 0.2,
	};
}

/** The wild-biome id a trail-tent interior belongs to (null outside tents). */
export function tentBiomeOf(area: string): string | null {
	const m = /^tent-([a-z][a-z-]*)$/.exec(area);
	return m ? m[1] : null;
}

/** Inside any interior — the home or a trail tent. */
export const isIndoorArea = (area: string): boolean => area === 'home' || !!tentBiomeOf(area);

// ------------------------------------------------------------- camp & gates

export function inCamp(area: string, tx: number, ty: number): boolean {
	return (
		area === 'meadow' &&
		tx > CAMP_BLOCK.x0 - 1 &&
		tx < CAMP_BLOCK.x1 + 1 &&
		ty > CAMP_BLOCK.y0 - 1 &&
		ty < CAMP_BLOCK.y1 + 1
	);
}

/** Keep gather nodes clear of the gate openings (both edges, at the gate row)
 *  so nothing spawns blocking the way into the next/previous biome. */
export function nearGate(tx: number, ty: number, dims: AreaDims): boolean {
	if (Math.abs(ty - dims.gateY) > 2) return false;
	return tx < 4 || tx > dims.landRight - 4;
}

/** Nearest in-bounds tile (ring search) that isn't built on or used by another node. */
export function findFreeTile(
	cx: number,
	cy: number,
	occupied: Set<string>,
	taken: Set<string>,
	area: string,
	dims: AreaDims,
): { tx: number; ty: number } | null {
	for (let r = 1; r <= 10; r++) {
		for (let dx = -r; dx <= r; dx++) {
			for (let dy = -r; dy <= r; dy++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // current ring only
				const tx = cx + dx;
				const ty = cy + dy;
				if (tx < 1 || ty < dims.playTop || tx > dims.landRight - 2 || ty > dims.rows - 2) continue;
				const key = `${tx},${ty}`;
				if (occupied.has(key) || taken.has(key) || inCamp(area, tx, ty) || nearGate(tx, ty, dims)) continue;
				// Don't let gather nodes clump: skip any tile touching an existing node
				// (Chebyshev-adjacent), matching the spacing the main scatter enforces.
				let adjacent = false;
				for (let ax = -1; ax <= 1 && !adjacent; ax++)
					for (let ay = -1; ay <= 1; ay++)
						if ((ax || ay) && taken.has(`${tx + ax},${ty + ay}`)) {
							adjacent = true;
							break;
						}
				if (adjacent) continue;
				return { tx, ty };
			}
		}
	}
	return null;
}

// ------------------------------------------------------------------ placement

/** The interior the placement rules read: the laid-out floor plan (rooms,
 *  doorways, exit) from src/homePlan.ts, which the server decides from too. */
export type RoomRect = HomeLayout;

/** The bits of a habitat-object def that decide whether it can go somewhere. */
export interface PlaceableDef {
	homeMin?: number;
	placement?: string;
	/** 'wall' hangs on the wall ring instead of standing on the floor. */
	mount?: string;
	/** Furniture you put things on — a table, a dresser, a shelf top. */
	surface?: boolean;
	/** Small enough to stand on one of those. */
	small?: boolean;
	bridge?: boolean;
}

/**
 * True if `def` may be set down on a tile already holding `standing`.
 *
 * Mirrors canStackOn() in server/home.ts, which is the copy that counts: a small
 * thing goes onto a surface, and that is the only time two things share a tile.
 */
export function canStackOn(def: PlaceableDef | undefined, standing: (PlaceableDef | undefined)[]): boolean {
	if (!def?.small) return false;
	return standing.length === 1 && !!standing[0]?.surface;
}

/**
 * True if (tx, ty) is a hangable wall tile.
 *
 * The rule itself lives in src/homePlan.ts and the server decides with the same
 * function, so the placement ghost turns green over exactly the walls the server
 * will accept. Re-exported here because everything else the placement code needs
 * is in this file.
 */
export { isWallTile };

export interface PlaceContext {
	area: string;
	indoors: boolean;
	dims: AreaDims;
	/** The interior rectangle, when indoors. */
	room?: RoomRect | null;
	/** Home size tier; a trail tent always counts as the starter size (1). */
	homeSpace: number;
	/** The object being placed or moved, if any. */
	activeObjectId: string | null;
	activeDef?: PlaceableDef;
	/** Id of the placement standing on a tile of THIS area, if any. */
	occupantIdAt: (tx: number, ty: number) => string | undefined;
	/** The defs of everything already on a tile — what the tabletop rule reads.
	 *  Optional so a caller that never places small things need not supply it. */
	occupantDefsAt?: (tx: number, ty: number) => (PlaceableDef | undefined)[];
	isWater: (tx: number, ty: number) => boolean;
}

/**
 * The tile a wall item aimed at (tx, ty) would actually hang on, or null.
 *
 * Reads nearestHangSpot — the same function the server lands it with — so the
 * ghost can be drawn on the tile the piece ends up on rather than on the one the
 * pointer happens to be over. Returns null when the aim is off the wall entirely
 * or every wall tile is spoken for, which is exactly when the ghost turns red.
 */
export function hangSpotFor(
	tx: number,
	ty: number,
	ctx: PlaceContext,
	ignoreId?: string,
): { x: number; y: number } | null {
	const r = ctx.room;
	if (!r || !ctx.indoors || ctx.activeDef?.mount !== 'wall') return null;
	if (!isWallTile(r, tx, ty)) return null;
	return nearestHangSpot(r, tx, ty, (x, y) => {
		const id = ctx.occupantIdAt(x, y);
		return id !== undefined && id !== ignoreId;
	});
}

export function canPlaceAt(
	tx: number,
	ty: number,
	ctx: PlaceContext,
	forTerraform = false,
	ignoreId?: string,
): boolean {
	// Indoors: floor items go on the floor, wall items go on the wall ring.
	if (ctx.indoors) {
		const r = ctx.room;
		if (!r) return false;
		// A wall item hangs on a wall run; anything else stands on the floor of one
		// of the rooms. A doorway between two rooms is a hole rather than either,
		// so nothing goes there and the way through is always clear. Mirrors
		// interiorSpotFor() on the server.
		const wallItem = !!ctx.activeObjectId && ctx.activeDef?.mount === 'wall';
		if (wallItem) {
			// Aimed at the wall is enough: hangSpotFor slides it past a window or a
			// picture to the nearest free tile, so the only "no" left is a wall with
			// no free tile on it at all.
			if (!hangSpotFor(tx, ty, ctx, ignoreId)) return false;
		} else if (!isFloorTile(r, tx, ty) || isOpening(r, tx, ty)) return false;
		const onTile = ctx.occupantIdAt(tx, ty);
		// ...unless what is already there is a surface and this is small enough to
		// stand on it (canStackOn — the tabletop rule). A wall item has already
		// been slid clear of whatever is there, so this is not its question.
		if (
			!wallItem &&
			onTile !== undefined &&
			onTile !== ignoreId &&
			!canStackOn(ctx.activeDef, ctx.occupantDefsAt?.(tx, ty) || [])
		)
			return false;
		// Items that need a bigger home can't be placed in a small one yet.
		const homeMin = ctx.activeObjectId ? ctx.activeDef?.homeMin || 0 : 0;
		if (homeMin > ctx.homeSpace) return false;
		// Outdoor-only things (the campfire) belong in neither the house nor a
		// trail tent. The indoor branch never checked `placement` at all, so the
		// ghost would read green over a tile the server was always going to
		// refuse. Mirrors the authoritative check in PlaceObject.
		if (ctx.activeObjectId && ctx.activeDef?.placement === 'outdoor') return false;
		// Beds stay clear of the doorway. Sleeping jumps the clock to dawn, so a
		// bed parked in the exit is a trap you have to walk over to leave. Mirrors
		// the authoritative check in server/resources.ts (blocksDoorway).
		if (blocksDoorway(ctx.activeObjectId, r, tx, ty)) return false;
		return true;
	}
	// Pelican Shore: nothing builds on the open ocean; land ends at landRight.
	const right = ctx.area === 'coastal' ? ctx.dims.landRight : ctx.dims.cols - 1;
	if (tx < 1 || ty < (ctx.dims.playTop || 1) || tx >= right || ty >= ctx.dims.rows - 1) return false;
	if (
		ctx.area === 'meadow' &&
		tx >= CAMP.tent.x - 0.5 &&
		tx <= CAMP.tent.x + 1.5 &&
		ty >= Math.floor(CAMP.tent.y) &&
		ty <= Math.floor(CAMP.fire.y)
	)
		return false; // tent + campfire tiles (rows derived from the camp so they track it)
	const occupant = ctx.occupantIdAt(tx, ty);
	if (occupant !== undefined && occupant !== ignoreId && !canStackOn(ctx.activeDef, ctx.occupantDefsAt?.(tx, ty) || []))
		return false;
	// note: resource nodes never block building — if you build on a regen spot,
	// the node relocates itself (see computeNodeLayout)
	// water tiles only accept bridges (terraform clicks are exempt — the can/shovel work on water)
	if (!forTerraform && ctx.isWater(tx, ty)) {
		return !!(ctx.activeObjectId && ctx.activeDef?.bridge);
	}
	return true;
}

/** A roomy reach so digging/watering/placing doesn't need you right on top of
 *  the tile (was 2.4 — bumped so you can act from a step or so further back). */
export const REACH_TILES = 3.2;

export function withinReach(tx: number, ty: number, playerTileX: number, playerTileY: number): boolean {
	return Math.abs(tx - playerTileX) <= REACH_TILES && Math.abs(ty - playerTileY) <= REACH_TILES;
}

// ------------------------------------------------------------------ terraform

export type TerraformAction = 'dig' | 'water' | 'clear';

/** Which shaping action the held tool performs at all, if any. */
export function terraformTool(activeTool: string): 'dig' | 'water' | null {
	if (activeTool === 'shovel') return 'dig';
	if (activeTool === 'watering-can') return 'water';
	return null;
}

/** Digging prepared ground clears it; watering needs a prepared bed. */
export function terraformActionFor(activeTool: string, existingType?: string | null): TerraformAction {
	if (activeTool === 'shovel') return existingType ? 'clear' : 'dig';
	return 'water';
}

/**
 * Should a repeat shaping command on this tile be swallowed?
 *
 * Watering escalates — a tilled bed becomes a watered bed, and a watered bed
 * becomes open water — and which of those a click means is decided from the
 * LOCAL copy of the tile, which doesn't change until the round trip lands. On a
 * slow connection the player waters a bed, sees nothing happen, clicks again,
 * and the second click (still reading "tilled") reaches a server that has since
 * written "watered" — so it floods the bed they were tending into a pond.
 *
 * The server refuses the mismatch outright now (Terraform's `expect`), but a
 * bounced request is still a wasted trip and an error toast for what is plainly
 * a double-click. Anything inside this window on the same tile is dropped in
 * silence; a deliberate second visit is well past it.
 */
export function shouldSwallowRepeat(lastAt: number | undefined, now: number, windowMs = TERRAFORM_REPEAT_MS): boolean {
	return lastAt !== undefined && now - lastAt < windowMs;
}

export interface TerraformDecision {
	action: TerraformAction;
	/**
	 * What this click was decided against. The server compares it to the tile it
	 * actually holds and refuses the command if the two disagree, so a click
	 * aimed at a bed can never land on the different bed it has become in the
	 * meantime — which is the whole of the "watering turned my bed into a pond"
	 * report. `null` means "I believe this ground is unshaped".
	 */
	expect: string | null;
	/** i18n key of the confirmation to ask first, if any. */
	confirmKey?: string;
	/** i18n key of the reason this is refused outright, if any. */
	blockKey?: string;
}

export function terraformDecision(opts: {
	activeTool: string;
	existingType?: string | null;
	tx: number;
	ty: number;
	/** Tile the caretaker is standing on, by the same floor() the collision uses. */
	playerTx: number;
	playerTy: number;
	/** Whether this tile is the mouth of a trail gate (see blocksGateTrail). */
	onGateTrail: boolean;
}): TerraformDecision {
	const action = terraformActionFor(opts.activeTool, opts.existingType);
	let confirmKey: string | undefined;
	let blockKey: string | undefined;
	if (opts.existingType === 'watered') {
		if (action === 'clear') confirmKey = 'game.confirm.clearWateredBed';
		else if (action === 'water') {
			// Flooding the tile you're standing on would strand you in open water,
			// so block it outright instead of asking.
			if (opts.playerTx === opts.tx && opts.playerTy === opts.ty) blockKey = 'game.block.standingHere';
			// Same for the mouth of a trail gate: water there walls off the way into
			// the next biome (mirrors the check in the Terraform endpoint).
			else if (opts.onGateTrail) blockKey = 'game.block.gateTrail';
			// otherwise flooding happens immediately — no confirmation prompt
		}
	}
	return { action, expect: opts.existingType ?? null, confirmKey, blockKey };
}

// ---------------------------------------------------------------------- spawn

/** The arrival kinds interactions.arrivalKind() hands back. */
export type SpawnKind = 'in-place' | 'camp-door' | 'tent-door' | 'west-edge' | 'east-edge' | string;

/**
 * Where to stand when arriving in an area: beside the gate on the edge that
 * faces where you came from, computed from the DESTINATION's own grid size
 * (biomes are different sizes now, the meadow biggest of all).
 */
export function spawnFor(
	kind: SpawnKind,
	dims: AreaDims,
	currentTile: { x: number; y: number },
	tent?: { x: number; y: number } | null,
): { x: number; y: number } {
	switch (kind) {
		case 'in-place':
			return { ...currentTile };
		case 'camp-door':
			return { ...CAMP_TENT_FRONT };
		case 'tent-door':
			return tent ? { x: tent.x + 0.5, y: tent.y + 1.4 } : { ...SPAWN_DEFAULT };
		case 'west-edge':
			return { x: 1.8, y: dims.gateY };
		case 'east-edge':
			return { x: dims.cols - 2.2, y: dims.gateY };
		default:
			return { ...SPAWN_DEFAULT };
	}
}

/** Keep a restored save position inside the area it is being restored into. */
export function clampSpawn(p: { x: number; y: number }, dims: AreaDims): { x: number; y: number } {
	return { x: clamp(p.x, 1, dims.cols - 1), y: clamp(p.y, dims.playTop + 1, dims.rows - 1) };
}

// ---------------------------------------------------------------------- nodes

export interface NodeDef {
	id: string;
	resourceId: string;
	tx: number;
	ty: number;
}

/** Is a gathered node back? `harvestedAt` undefined means it was never taken. */
export function nodeReady(harvestedAt: number | undefined, nodeRegenSeconds: number, now: number): boolean {
	if (harvestedAt === undefined) return true;
	return now - harvestedAt >= nodeRegenSeconds * 1000;
}

/** The key a node's cooldown is stored under. Node cooldowns are world-scoped,
 *  so this matches on the world id (which falls back to the player id for
 *  solo / legacy rows). */
export const nodeStateKey = (worldId: string, area: string, nodeId: string): string => `${worldId}:${area}:${nodeId}`;

export interface NodeLayoutInput {
	area: string;
	dims: AreaDims;
	/** Gatherable resource ids this biome offers (biome.resources). */
	resources: string[];
	/** Seed for the node scatter — stable per world+area, so every session in
	 *  one world sees the same nodes in the same spots. */
	nodeSeed: string;
	/** Tiles already built on or shaped, as `x,y` keys, for THIS area. */
	occupied: Set<string>;
	/** The resource a currently-active special weather makes gatherable, if any. */
	weatherResourceId?: string | null;
	/** Seed for the weather-gated spots — stable per world+area+weather. */
	weatherSeed?: string;
}

/**
 * Resource node layout.
 *
 * Seeded from the world id, so it only changes when the SET of nodes changes —
 * not when one is gathered. Whether a node is currently available is a separate
 * question (see nodeReady), which is why gathering does not move anything.
 */
export function computeNodeLayout(input: NodeLayoutInput): NodeDef[] {
	const { area, dims, resources: res, occupied } = input;
	const rng = mulberry32(hashStr(input.nodeSeed));

	// Node budget — at least twice the resource count (plus a little extra room
	// for weighted staples), so there's always space for two nodes of every
	// resource this biome offers. Scaled with the biome's playable area so
	// bigger preserves (the meadow especially) don't feel picked bare.
	const areaScale = Math.max(1, (dims.landRight * (dims.rows - dims.playTop)) / (30 * 20));
	const count = Math.round(Math.max(20, res.length * 2 + 4) * areaScale);

	// Build the resource bag for this area. GUARANTEE every biome resource
	// appears at least TWICE (two of each, placed first), then fill the rest
	// with a weighted random draw so early-game staples are easy to find (seeds
	// especially — used by almost every meadow recipe). Coverage is no longer
	// left to a shuffle that could drop a resource.
	const NODE_WEIGHT: Record<string, number> = { seeds: 4, fiber: 2 };
	const weighted: string[] = [];
	for (const r of res) for (let i = 0; i < (NODE_WEIGHT[r] || 1); i++) weighted.push(r);
	const pool: string[] = [...res, ...res];
	while (pool.length < count && weighted.length) pool.push(weighted[Math.floor(rng() * weighted.length)]);

	const nodes: NodeDef[] = [];
	let attempts = 0;
	while (nodes.length < count && attempts < 900) {
		attempts++;
		const tx = 1 + Math.floor(rng() * (dims.landRight - 3));
		const ty = dims.playTop + 1 + Math.floor(rng() * (dims.rows - dims.playTop - 3));
		if (inCamp(area, tx, ty) || nearGate(tx, ty, dims)) continue;
		if (nodes.some((n) => Math.abs(n.tx - tx) < 2 && Math.abs(n.ty - ty) < 2)) continue;
		const resourceId = pool[nodes.length] || res[nodes.length % res.length];
		nodes.push({ id: `n${nodes.length}`, resourceId, tx, ty });
	}

	// Players can build anywhere; a regen spot that ends up under a placement or
	// terraformed tile simply relocates to the nearest free tile (keeping its id
	// and cooldown). Unaffected nodes stay put.
	const taken = new Set(nodes.map((n) => `${n.tx},${n.ty}`));
	for (const node of nodes) {
		if (!occupied.has(`${node.tx},${node.ty}`)) continue;
		const spot = findFreeTile(node.tx, node.ty, occupied, taken, area, dims);
		if (spot) {
			taken.delete(`${node.tx},${node.ty}`);
			node.tx = spot.tx;
			node.ty = spot.ty;
			taken.add(`${node.tx},${node.ty}`);
		}
	}

	// Coverage safety net — every gatherable resource MUST have at least a
	// minimum number of spawn spots the moment the world spawns. The placement
	// loop above covers this normally, but if anything slipped through (an
	// unusually crowded map that exhausted placement attempts), force extra nodes
	// in on the nearest free tiles so the guarantee is hard, not a statistic.
	const MIN_PER_RESOURCE = 2;
	// The meadow is the opening biome: guarantee a comfortable supply of the two
	// starter staples new caretakers reach for first — plant fiber and water.
	// Fallen branches are an early staple too, so meadow and forest keep three.
	const minFor = (r: string) => {
		if (area === 'meadow' && (r === 'fiber' || r === 'water')) return 4;
		if (r === 'branches' && (area === 'meadow' || area === 'forest')) return 3;
		return MIN_PER_RESOURCE;
	};
	const perResource = new Map<string, number>();
	for (const n of nodes) perResource.set(n.resourceId, (perResource.get(n.resourceId) || 0) + 1);
	for (const r of res) {
		while ((perResource.get(r) || 0) < minFor(r)) {
			const spot = findFreeTile(
				Math.floor(dims.cols / 2),
				dims.playTop + Math.floor(dims.baseRows / 2),
				occupied,
				taken,
				area,
				dims,
			);
			if (!spot) break;
			nodes.push({ id: `n${nodes.length}`, resourceId: r, tx: spot.tx, ty: spot.ty });
			taken.add(`${spot.tx},${spot.ty}`);
			perResource.set(r, (perResource.get(r) || 0) + 1);
		}
	}

	// Always guarantee a water source near where you spawn — early game needs
	// water for soil beds and recipes. (Skipped in dry biomes like the desert,
	// which have no water resource.)
	const waterRes = res.includes('water') ? 'water' : res.includes('clean-water') ? 'clean-water' : null;
	if (waterRes) {
		const anchor = area === 'meadow' ? { tx: 26, ty: 8 } : { tx: 4, ty: 11 };
		const hasNearby = nodes.some(
			(n) =>
				(n.resourceId === 'water' || n.resourceId === 'clean-water') &&
				Math.abs(n.tx - anchor.tx) <= 5 &&
				Math.abs(n.ty - anchor.ty) <= 5,
		);
		if (!hasNearby) {
			const aKey = `${anchor.tx},${anchor.ty}`;
			const anchorFree =
				anchor.tx >= 1 &&
				anchor.ty >= dims.playTop &&
				anchor.tx <= dims.landRight - 2 &&
				anchor.ty <= dims.rows - 2 &&
				!occupied.has(aKey) &&
				!taken.has(aKey) &&
				!inCamp(area, anchor.tx, anchor.ty);
			const spot = anchorFree ? anchor : findFreeTile(anchor.tx, anchor.ty, occupied, taken, area, dims);
			if (spot) {
				nodes.push({ id: 'nw', resourceId: waterRes, tx: spot.tx, ty: spot.ty });
				taken.add(`${spot.tx},${spot.ty}`);
			}
		}
	}

	// Weather-gated gather nodes: while a special weather is active in this biome
	// (rain, storm, snow, fog, heat) a couple of spots for its unique resource
	// appear, then vanish when the weather turns over. Positions are seeded by
	// world+biome+weather so they land in the same places every visit.
	if (input.weatherResourceId) {
		const wrng = mulberry32(hashStr(input.weatherSeed || ''));
		for (let i = 0; i < 2; i++) {
			const ax = 2 + Math.floor(wrng() * Math.max(1, dims.landRight - 4));
			const ay = dims.playTop + 1 + Math.floor(wrng() * Math.max(1, dims.rows - dims.playTop - 3));
			const spot = findFreeTile(ax, ay, occupied, taken, area, dims);
			if (spot) {
				nodes.push({
					id: `wx-${input.weatherResourceId}-${i}`,
					resourceId: input.weatherResourceId,
					tx: spot.tx,
					ty: spot.ty,
				});
				taken.add(`${spot.tx},${spot.ty}`);
			}
		}
	}
	return nodes;
}

// -------------------------------------------------------------------- animals

export type Gait = 'hop' | 'flit' | 'flutter' | 'swim' | 'slither' | 'amble';

export function animalGait(animal: { id?: string; kind?: string; ocean?: boolean; aquatic?: boolean }): Gait {
	const id = String(animal.id || '');
	if (id.includes('bat') && !id.includes('bat-star')) return 'flutter';
	if (animal.kind === 'insect') return 'flutter';
	if (animal.kind === 'bird') return 'flit';
	if (animal.kind === 'fish' || animal.ocean === true || animal.aquatic === true) return 'swim';
	if (/rabbit|hare|squirrel|chipmunk|mouse|vole|frog|toad/.test(id)) return 'hop';
	if (/snake|salamander|ensatina/.test(id)) return 'slither';
	return 'amble';
}

/** Vertical bounce amplitude in texture px, sized so every species hops roughly
 *  the same few screen pixels regardless of its scale. */
export function hopAmp(scaleX: number): number {
	return clamp(4 / Math.max(0.05, scaleX), 8, 26);
}

/** Pick a point out on the open ocean, preferring within `roam` of home. */
export function oceanTarget(
	rng: () => number,
	dims: AreaDims,
	homeX?: number,
	homeY?: number,
	roam = Infinity,
): { x: number; y: number } {
	const x0 = (dims.landRight + 0.6) * TILE;
	const x1 = (dims.cols - 0.8) * TILE;
	const y0 = (dims.playTop + 0.8) * TILE;
	const y1 = dims.rows * TILE - TILE;
	for (let i = 0; i < 8; i++) {
		const x = x0 + rng() * Math.max(1, x1 - x0);
		const y = y0 + rng() * Math.max(1, y1 - y0);
		if (homeX == null || dist(homeX, homeY!, x, y) <= roam * 1.5) return { x, y };
	}
	return { x: (x0 + x1) / 2, y: y0 + rng() * Math.max(1, y1 - y0) };
}

/** Pick a point over open water, preferring tiles within `roam` of home. */
export function fishTarget(
	waterTileCenters: { x: number; y: number }[],
	homeX: number,
	homeY: number,
	roam: number,
	rng: () => number,
): { x: number; y: number } | null {
	if (!waterTileCenters.length) return null;
	const near = waterTileCenters.filter((c) => dist(homeX, homeY, c.x, c.y) <= roam * 1.5);
	const pool = near.length ? near : waterTileCenters;
	const c = pool[Math.floor(rng() * pool.length)];
	// jitter within the tile so a fish doesn't snap dead-center
	return { x: c.x + (rng() - 0.5) * TILE * 0.6, y: c.y + (rng() - 0.5) * TILE * 0.6 };
}

// ----------------------------------------------------------------------- zoom

export function nextUserZoom(current: number, factor: number): number {
	return clamp(current * factor, USER_ZOOM_MIN, USER_ZOOM_MAX);
}

// ----------------------------------------------------------------- stillness

/**
 * Sitting still, and what it is worth.
 *
 * A seat used to be a pose and nothing else. It is now the one thing in the
 * game that pays you for doing nothing: stay on the bench and the wildlife
 * already living here works its way over to you.
 *
 * WHO comes, and in what order, is one thing only — how far each animal was
 * from the bench when you sat down. The nearest notices almost at once; the far
 * side of the area takes its time getting there. So a sit reads as word getting
 * round, near to far, rather than as a draw roll nobody can see.
 *
 * Nothing GATES it. Not what you planted, not the biome's health, not how
 * settled an animal is — those last two only change how long something dithers
 * before it sets off. An earlier cut of this scored each animal on how much of
 * its own habitat you had parked beside, which was a fine idea on paper and in
 * play was a bench that looked broken: you sat, and most of the meadow ignored
 * you for reasons the game never showed you.
 *
 * Nothing about any of it is recorded anywhere. The company IS the reward, so
 * there is no counter to farm and the numbers can be generous.
 */

/** How soon the animal already at your elbow gets up and comes over. */
export const APPROACH_FIRST_MS = 2_500;

/** How long one on the far side of the area takes to decide. */
export const APPROACH_FAR_MS = 14_000;

/** The distance that counts as "the far side of the area" for that wait. */
export const APPROACH_SPAN = 18 * TILE;

/** How near the seat a patch of water has to be for a swimmer to come over. */
export const APPROACH_WATER_REACH = 8 * TILE;

/**
 * How many animals may be on their way over at once, out of the ANIMAL_DRAW_CAP
 * an area can show. A handful — five settled right around the bench is company;
 * twenty is a swarm, which is both a worse picture and a busier one than this
 * moment is meant to be. The rest of the area carries on with its own business,
 * which is most of what makes the five read as having chosen to come over.
 */
export const APPROACH_MAX = 5;

// --------------------------------------------- what the hearth changes
// The three Warmth abilities (src/homeAbilities.ts) all land here, because this
// is where "who comes over" is decided. None of them changes the RULE — near
// first, nothing gated, nothing recorded — they widen it:
//
//   Open Hearth (Warmth 5)  they set off sooner, and from further out
//   Hearthsong  (Warmth 6)  more of them come, and they settle closer in
//   Ember Watch (Warmth 7)  no seat needed: stand still anywhere and they come
//
// A hearth you keep banked all winter is the reason animals in the world learn
// that a person sitting still is not a person hunting, so the house is a
// sensible thing for this to be bought with.

/** What Open Hearth takes off the wait, and how much further the span reaches. */
const OPEN_HEARTH_HASTE = 0.6; // 40% off the dithering
const OPEN_HEARTH_SPAN = 1.5; // "the far side of the area" is half again as far

/** Crowd sizes the two later Warmth abilities buy. */
export const APPROACH_MAX_HEARTHSONG = 8;
export const APPROACH_MAX_EMBERWATCH = 10;

/** How much closer Hearthsong lets them settle — a ring you are inside of,
 *  rather than one you are watching from the middle of. */
const HEARTHSONG_CLOSER = 0.82;

/** How long you have to stand still, with Ember Watch, before the area decides
 *  you have stopped. Long enough that crossing a biome on foot never trips it,
 *  short enough that stopping to look at something is enough. */
export const EMBER_WATCH_STILL_MS = 3_000;

/** The abilities the stillness rules care about, in the shape the scene has
 *  them. Everything here takes this rather than a player row: worldRules is
 *  pure, and the scene reads the set once and passes it down. */
export interface HearthAbilities {
	openHearth?: boolean;
	hearthsong?: boolean;
	emberWatch?: boolean;
}

/** How many animals may be on their way over at once, for this house. */
export function approachMaxFor(h: HearthAbilities = {}): number {
	if (h.emberWatch) return APPROACH_MAX_EMBERWATCH;
	if (h.hearthsong) return APPROACH_MAX_HEARTHSONG;
	return APPROACH_MAX;
}

/**
 * How close each kind is willing to get, 0 (fearless) → 1 (keeps its distance).
 * Bugs come to your boots; a fox stops at the edge of the clearing and looks.
 */
const SHYNESS: Record<string, number> = {
	mammal: 1,
	bird: 0.8,
	fish: 0.9,
	reptile: 0.75,
	amphibian: 0.55,
	invertebrate: 0.45,
	insect: 0.3,
};

/**
 * How long this one waits before setting off, from how far it has to come.
 *
 * `comfort` (the Discovery's, 0–100) and `health` (the biome's) stretch that
 * wait by up to a quarter and no more: a newcomer to a struggling preserve is
 * warier about crossing open ground than a settled one in a thriving meadow,
 * but it still comes. Neither can return Infinity — there is no "never" here,
 * which is the whole difference between this and the version before it.
 */
export function approachWaitMs(
	distance: number,
	opts: { comfort?: number; health?: number; hearth?: HearthAbilities } = {},
): number {
	// Open Hearth stretches what counts as the far side of the area — so an
	// animal that used to be too far away to have an opinion now simply takes the
	// long-wait figure — and then takes nearly half off every wait on top.
	const span = APPROACH_SPAN * (opts.hearth?.openHearth ? OPEN_HEARTH_SPAN : 1);
	const far = clamp(distance / span, 0, 1);
	const base = APPROACH_FIRST_MS + far * (APPROACH_FAR_MS - APPROACH_FIRST_MS);
	const comfort = clamp((opts.comfort ?? 50) / 100, 0, 1);
	const health = clamp((opts.health ?? 50) / 100, 0, 1);
	const haste = opts.hearth?.openHearth ? OPEN_HEARTH_HASTE : 1;
	return Math.round(base * (1.25 - 0.15 * comfort - 0.1 * health) * haste);
}

/**
 * How close it settles, in pixels from the seat — one to two tiles, so the
 * gathering is around the bench rather than loosely in the same clearing.
 * Shyness alone decides where in that band a species lands, and the floor is
 * wide enough that nothing ever ends up in the caretaker's lap.
 */
export function approachRadius(kind: string, hearth: HearthAbilities = {}): number {
	const shy = SHYNESS[kind] ?? 0.7;
	// Hearthsong pulls the whole ring in. The floor comes down with it, but not
	// to nothing — the caretaker never ends up wearing a marmot.
	const close = hearth.hearthsong ? HEARTHSONG_CLOSER : 1;
	return Math.round(Math.max(26, (26 + shy * 30) * close));
}

/** Has this animal arrived — i.e. is it near enough to read as company? */
export function hasArrived(x: number, y: number, seatX: number, seatY: number, radius: number): boolean {
	return dist(x, y, seatX, seatY) <= radius * 1.25;
}

/**
 * Where an animal means to end up: on the circle of `radius` around the seat,
 * on the side it is already coming from, so it never walks THROUGH the
 * caretaker to reach a spot behind them. Squashed vertically because the world
 * is drawn at a slight lean and a true circle reads as a ring on the floor.
 */
export function approachPoint(
	seatX: number,
	seatY: number,
	fromX: number,
	fromY: number,
	radius: number,
	rng: () => number,
): { x: number; y: number } {
	const angle = Math.atan2(fromY - seatY, fromX - seatX) + (rng() - 0.5) * 1.6;
	return { x: seatX + Math.cos(angle) * radius, y: seatY + Math.sin(angle) * radius * 0.8 };
}

/**
 * One leg of the journey over: a fraction of what's left, off the straight line
 * by a few degrees. Closing the whole distance in a single tween looks like a
 * summons; three or four short legs look like an animal that happens to keep
 * ending up nearer you.
 */
export function approachLeg(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	rng: () => number,
): { x: number; y: number } {
	const d = dist(fromX, fromY, toX, toY);
	if (d <= 8) return { x: toX, y: toY };
	const step = Math.min(d, d * (0.4 + rng() * 0.35));
	const angle = Math.atan2(toY - fromY, toX - fromX) + (rng() - 0.5) * 0.7;
	return { x: fromX + Math.cos(angle) * step, y: fromY + Math.sin(angle) * step };
}

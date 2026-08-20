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

/** How long a shaped tile ignores a second command (see shouldSwallowRepeat). */
export const TERRAFORM_REPEAT_MS = 700;

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

/** The interior rectangle (tile coords) plus its doorway. */
export interface RoomRect {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	doorX: number;
	doorY: number;
}

/** The bits of a habitat-object def that decide whether it can go somewhere. */
export interface PlaceableDef {
	homeMin?: number;
	placement?: string;
	bridge?: boolean;
}

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
	isWater: (tx: number, ty: number) => boolean;
}

export function canPlaceAt(
	tx: number,
	ty: number,
	ctx: PlaceContext,
	forTerraform = false,
	ignoreId?: string,
): boolean {
	// Indoors: you can only decorate on the floor (inside the walls).
	if (ctx.indoors) {
		const r = ctx.room;
		if (!r) return false;
		if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) return false;
		const onTile = ctx.occupantIdAt(tx, ty);
		if (onTile !== undefined && onTile !== ignoreId) return false;
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
	if (occupant !== undefined && occupant !== ignoreId) return false;
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

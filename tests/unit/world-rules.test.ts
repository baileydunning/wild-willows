import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	TILE,
	CAMP_BLOCK,
	dimsOf,
	oceanColsOf,
	inCamp,
	nearGate,
	findFreeTile,
	canPlaceAt,
	canStackOn,
	isWallTile,
	withinReach,
	terraformTool,
	terraformActionFor,
	terraformDecision,
	shouldSwallowRepeat,
	spawnFor,
	clampSpawn,
	nodeReady,
	nodeStateKey,
	computeNodeLayout,
	animalGait,
	animalsReady,
	hopAmp,
	nextUserZoom,
	mixMs,
	mulberry32,
	approachWaitMs,
	approachRadius,
	approachPoint,
	approachLeg,
	hasArrived,
	APPROACH_MAX,
	APPROACH_FIRST_MS,
	APPROACH_FAR_MS,
	APPROACH_SPAN,
	ANIMAL_DRAW_CAP,
	USER_ZOOM_MIN,
	USER_ZOOM_MAX,
	type AreaDims,
	type PlaceContext,
} from '../../src/game/worldRules';
import type { BiomeDef } from '../../src/types';
import animals1 from '../../data/animals-1.json';
import animals2 from '../../data/animals-2.json';

// A minimal stand-in for data/biomes.json — only the fields the geometry reads.
const biomes = [
	{
		id: 'meadow',
		resources: ['fiber', 'water', 'branches', 'seeds'],
		grid: { cols: 44, rows: 26 },
	},
	{ id: 'forest', resources: ['branches', 'fiber'] },
	{ id: 'alpine', resources: ['stone'] },
	{ id: 'coastal', resources: ['sand', 'clean-water'] },
	{ id: 'desert', resources: ['sand'] },
] as unknown as BiomeDef[];

describe('dimsOf', () => {
	it('falls back to the base grid for a biome the data gives no grid', () => {
		const d = dimsOf('forest', biomes);
		expect(d.cols).toBe(30);
		expect(d.baseRows).toBe(20);
	});

	it('reads the grid the data does give', () => {
		const d = dimsOf('meadow', biomes);
		expect(d.cols).toBe(44);
		expect(d.baseRows).toBe(26);
	});

	it('grows the alpine area downward so its PLAYABLE band matches everyone else', () => {
		// Graywind Heights reserves rows at the top for an impassable range. If the
		// area did not also get taller, the mountain would eat the biome.
		const alpine = dimsOf('alpine', biomes);
		const forest = dimsOf('forest', biomes);
		expect(alpine.playTop).toBeGreaterThan(0);
		expect(alpine.rows - alpine.playTop).toBe(forest.rows - forest.playTop);
	});

	it('reserves an ocean band on the coast and nowhere inland', () => {
		expect(oceanColsOf('coastal', biomes)).toBeGreaterThan(0);
		expect(oceanColsOf('meadow', biomes)).toBe(0);
		expect(oceanColsOf('home', biomes)).toBe(0);
		const c = dimsOf('coastal', biomes);
		expect(c.landRight).toBe(c.cols - oceanColsOf('coastal', biomes));
	});

	it('puts the gates on the vertical middle of the playable band', () => {
		for (const id of ['meadow', 'forest', 'alpine', 'coastal']) {
			const d = dimsOf(id, biomes);
			const mid = d.playTop + (d.rows - d.playTop) / 2;
			expect(Math.abs(d.gateY - mid)).toBeLessThanOrEqual(0.5);
		}
	});
});

describe('inCamp / nearGate', () => {
	it('fences off the camp, and only in the meadow', () => {
		const cx = (CAMP_BLOCK.x0 + CAMP_BLOCK.x1) / 2;
		const cy = (CAMP_BLOCK.y0 + CAMP_BLOCK.y1) / 2;
		expect(inCamp('meadow', cx, cy)).toBe(true);
		// The camp only exists in the meadow — the same coordinates are open ground
		// everywhere else, and a node refusing to spawn there would be a silent
		// dead zone in the middle of five biomes.
		for (const a of ['forest', 'wetland', 'desert', 'alpine', 'coastal']) {
			expect(inCamp(a, cx, cy)).toBe(false);
		}
	});

	it('keeps both gate mouths clear so nothing spawns blocking the way through', () => {
		const d = dimsOf('forest', biomes);
		expect(nearGate(1, d.gateY, d)).toBe(true); // west gate
		expect(nearGate(d.landRight - 1, d.gateY, d)).toBe(true); // east gate
		// …but only at the gate row. The edges elsewhere are ordinary ground.
		expect(nearGate(1, d.gateY + 5, d)).toBe(false);
		expect(nearGate(Math.floor(d.cols / 2), d.gateY, d)).toBe(false);
	});
});

describe('findFreeTile', () => {
	const dims = dimsOf('forest', biomes);

	it('finds the nearest free ring rather than the first tile it can think of', () => {
		const spot = findFreeTile(10, 10, new Set(['10,10']), new Set(), 'forest', dims)!;
		expect(spot).not.toBeNull();
		expect(Math.max(Math.abs(spot.tx - 10), Math.abs(spot.ty - 10))).toBe(1);
	});

	it('refuses to clump nodes: a tile touching an existing node is not free', () => {
		// Every neighbour of (10,10) is Chebyshev-adjacent to a taken tile, so the
		// answer has to come from further out.
		const taken = new Set(['10,10']);
		const spot = findFreeTile(10, 10, new Set(['10,10']), taken, 'forest', dims)!;
		expect(Math.max(Math.abs(spot.tx - 10), Math.abs(spot.ty - 10))).toBeGreaterThan(1);
	});

	it('stays inside the playable band and off the ocean', () => {
		const c = dimsOf('coastal', biomes);
		const spot = findFreeTile(c.landRight + 2, 5, new Set(), new Set(), 'coastal', c);
		if (spot) expect(spot.tx).toBeLessThanOrEqual(c.landRight - 2);
	});

	it('gives up rather than looping forever when there is nowhere to go', () => {
		const occupied = new Set<string>();
		for (let x = -20; x < 60; x++) for (let y = -20; y < 60; y++) occupied.add(`${x},${y}`);
		expect(findFreeTile(10, 10, occupied, new Set(), 'forest', dims)).toBeNull();
	});
});

// --------------------------------------------------------------------- placing

const outdoorCtx = (over: Partial<PlaceContext> = {}): PlaceContext => ({
	area: 'meadow',
	indoors: false,
	dims: dimsOf('meadow', biomes),
	room: null,
	homeSpace: 1,
	activeObjectId: 'willow',
	activeDef: {},
	occupantIdAt: () => undefined,
	isWater: () => false,
	...over,
});

const room = { x0: 4, y0: 4, x1: 12, y1: 10, doorX: 8, doorY: 10 };
const indoorCtx = (over: Partial<PlaceContext> = {}): PlaceContext =>
	outdoorCtx({ area: 'home', indoors: true, room, ...over });

describe('canPlaceAt — outdoors', () => {
	it('keeps everything off the world edge', () => {
		const d = dimsOf('meadow', biomes);
		expect(canPlaceAt(0, 5, outdoorCtx())).toBe(false);
		expect(canPlaceAt(5, 0, outdoorCtx())).toBe(false);
		expect(canPlaceAt(d.cols - 1, 5, outdoorCtx())).toBe(false);
		expect(canPlaceAt(5, d.rows - 1, outdoorCtx())).toBe(false);
		expect(canPlaceAt(10, 10, outdoorCtx())).toBe(true);
	});

	it('nothing builds on the open ocean at Pelican Shore', () => {
		const c = dimsOf('coastal', biomes);
		const ctx = outdoorCtx({ area: 'coastal', dims: c });
		expect(canPlaceAt(c.landRight, 8, ctx)).toBe(false);
		expect(canPlaceAt(c.landRight - 1, 8, ctx)).toBe(true);
	});

	it('leaves the tent and campfire tiles alone', () => {
		expect(canPlaceAt(21, 5, outdoorCtx())).toBe(false);
	});

	it('will not stack a second thing on an occupied tile', () => {
		const ctx = outdoorCtx({ occupantIdAt: () => 'pl1' });
		expect(canPlaceAt(10, 10, ctx)).toBe(false);
	});

	it('lets you move a placement without it blocking itself', () => {
		// Moving is place-plus-remove. Without ignoreId the ghost reads red over the
		// tile the object is already standing on, so nudging something one tile is
		// impossible.
		const ctx = outdoorCtx({ occupantIdAt: () => 'pl1' });
		expect(canPlaceAt(10, 10, ctx, false, 'pl1')).toBe(true);
	});

	it('only bridges go on water — and the shovel and can are exempt', () => {
		const water = outdoorCtx({ isWater: () => true });
		expect(canPlaceAt(10, 10, water)).toBe(false);
		expect(canPlaceAt(10, 10, outdoorCtx({ isWater: () => true, activeDef: { bridge: true } }))).toBe(true);
		// forTerraform: shaping a water tile is exactly what the can is for
		expect(canPlaceAt(10, 10, water, true)).toBe(true);
	});
});

describe('canPlaceAt — indoors', () => {
	it('keeps decoration inside the walls', () => {
		expect(canPlaceAt(room.x0 - 1, 6, indoorCtx())).toBe(false);
		expect(canPlaceAt(6, room.y1 + 1, indoorCtx())).toBe(false);
		expect(canPlaceAt(6, 6, indoorCtx())).toBe(true);
	});

	it('THE BUG: an outdoor-only object must read red indoors, not green', () => {
		// The indoor branch never checked `placement` at all, so the ghost showed
		// green over a tile the server was always going to refuse — the player
		// clicked, and got an error instead of a campfire.
		const ctx = indoorCtx({
			activeObjectId: 'campfire',
			activeDef: { placement: 'outdoor' },
		});
		expect(canPlaceAt(6, 6, ctx)).toBe(false);
	});

	it('keeps beds clear of the doorway', () => {
		// Sleeping jumps the clock to dawn, so a bed parked in the exit is a trap
		// you have to walk over to leave.
		const bed = indoorCtx({ activeObjectId: 'home-bed', activeDef: {} });
		expect(canPlaceAt(room.doorX, room.doorY, bed)).toBe(false);
		expect(canPlaceAt(room.doorX, room.doorY - 3, bed)).toBe(true);
		// A chair in the doorway is only ever mildly annoying, so it is allowed.
		const chair = indoorCtx({ activeObjectId: 'home-chair', activeDef: {} });
		expect(canPlaceAt(room.doorX, room.doorY, chair)).toBe(true);
	});

	it('holds back objects that need a bigger home than you have', () => {
		const big = indoorCtx({ activeDef: { homeMin: 3 }, homeSpace: 1 });
		expect(canPlaceAt(6, 6, big)).toBe(false);
		expect(canPlaceAt(6, 6, indoorCtx({ activeDef: { homeMin: 3 }, homeSpace: 3 }))).toBe(true);
	});
});

// ---------------------------------------------------------------- wall decor
// A wall item and a floor item want opposite tiles, and the ghost has to say so
// before the click: the whole point of `mount: 'wall'` is that a framed
// landscape stops being something you leave leaning on the floorboards.

describe('isWallTile', () => {
	it('takes the back run and both sides', () => {
		expect(isWallTile(room, room.x0, room.y0 - 1)).toBe(true); // back wall
		expect(isWallTile(room, room.x1, room.y0 - 1)).toBe(true);
		expect(isWallTile(room, room.x0 - 1, room.y0)).toBe(true); // left wall
		expect(isWallTile(room, room.x1 + 1, room.y1)).toBe(true); // right wall
	});

	it('refuses the corners, the door wall, the floor and anything outside', () => {
		// A corner is one tile belonging to two runs and reads as neither.
		expect(isWallTile(room, room.x0 - 1, room.y0 - 1)).toBe(false);
		expect(isWallTile(room, room.x1 + 1, room.y1 + 1)).toBe(false);
		// The door wall is between the camera and the room: anything hung there is
		// behind the caretaker's own back.
		expect(isWallTile(room, room.doorX, room.y1 + 1)).toBe(false);
		expect(isWallTile(room, 6, 6)).toBe(false); // floor
		expect(isWallTile(room, room.x0 - 2, room.y0)).toBe(false); // past the ring
	});
});

describe('canPlaceAt — wall decor', () => {
	const hanging = (over: Partial<PlaceContext> = {}) =>
		indoorCtx({ activeObjectId: 'home-painting', activeDef: { placement: 'indoor', mount: 'wall' }, ...over });

	it('hangs on a wall and nowhere else', () => {
		expect(canPlaceAt(room.x0, room.y0 - 1, hanging())).toBe(true);
		expect(canPlaceAt(room.x0 - 1, room.y0 + 2, hanging())).toBe(true);
		expect(canPlaceAt(6, 6, hanging())).toBe(false); // the floor is not for hanging
		expect(canPlaceAt(room.doorX, room.y1 + 1, hanging())).toBe(false); // nor the door wall
	});

	it('keeps floor furniture off the walls', () => {
		const chair = indoorCtx({ activeObjectId: 'home-armchair', activeDef: { placement: 'indoor' } });
		expect(canPlaceAt(room.x0, room.y0 - 1, chair)).toBe(false);
		expect(canPlaceAt(6, 6, chair)).toBe(true);
	});

	it('will not hang two things on one nail', () => {
		expect(canPlaceAt(room.x0, room.y0 - 1, hanging({ occupantIdAt: () => 'pl1' }))).toBe(false);
	});

	it('still respects a home-size gate up on the wall', () => {
		expect(canPlaceAt(room.x0, room.y0 - 1, hanging({ activeDef: { mount: 'wall', homeMin: 3 }, homeSpace: 1 }))).toBe(
			false,
		);
	});
});

// --------------------------------------------------------------- tabletops
// A tile holds one thing, except that a small ornament may stand on a surface.
// The ghost has to agree with the server about that or the player clicks a table
// and gets a refusal.

describe('canStackOn', () => {
	const table = { surface: true };
	const vase = { small: true };

	it('puts a small thing on a surface', () => {
		expect(canStackOn(vase, [table])).toBe(true);
	});

	it('refuses everything else', () => {
		expect(canStackOn({}, [table])).toBe(false); // not small
		expect(canStackOn(vase, [{}])).toBe(false); // not a surface
		expect(canStackOn(table, [vase])).toBe(false); // no sliding a table under a vase
		expect(canStackOn(vase, [])).toBe(false); // nothing to stand on
		expect(canStackOn(vase, [table, vase])).toBe(false); // one ornament per top
	});
});

describe('canPlaceAt — tabletops', () => {
	const onTable = (over: Partial<PlaceContext> = {}) =>
		indoorCtx({
			activeObjectId: 'home-potplant',
			activeDef: { placement: 'indoor', small: true },
			occupantIdAt: () => 'pl-table',
			occupantDefsAt: () => [{ surface: true }],
			...over,
		});

	it('reads green over an occupied tile when the occupant is a table', () => {
		expect(canPlaceAt(6, 6, onTable())).toBe(true);
	});

	it('reads red when the occupant is not a surface', () => {
		expect(canPlaceAt(6, 6, onTable({ occupantDefsAt: () => [{}] }))).toBe(false);
	});

	it('reads red for something too big to stand on a table', () => {
		expect(canPlaceAt(6, 6, onTable({ activeDef: { placement: 'indoor' } }))).toBe(false);
	});

	it('reads red once the table already has something on it', () => {
		expect(canPlaceAt(6, 6, onTable({ occupantDefsAt: () => [{ surface: true }, { small: true }] }))).toBe(false);
	});
});

describe('withinReach', () => {
	it('lets you act from a step or so back, but not across the clearing', () => {
		expect(withinReach(10, 10, 10, 10)).toBe(true);
		expect(withinReach(13, 10, 10, 10)).toBe(true);
		expect(withinReach(14, 10, 10, 10)).toBe(false);
	});
});

// ------------------------------------------------------------------ terraform

describe('terraform', () => {
	it('maps the held tool to what it shapes', () => {
		expect(terraformTool('shovel')).toBe('dig');
		expect(terraformTool('watering-can')).toBe('water');
		expect(terraformTool('basket')).toBeNull();
	});

	it('digging prepared ground clears it; digging bare ground tills it', () => {
		expect(terraformActionFor('shovel', null)).toBe('dig');
		expect(terraformActionFor('shovel', 'tilled')).toBe('clear');
		expect(terraformActionFor('watering-can', 'tilled')).toBe('water');
	});

	it('asks before undoing a watered bed, and not before an ordinary dig', () => {
		const at = (existingType: string | null, activeTool = 'shovel') =>
			terraformDecision({
				activeTool,
				existingType,
				tx: 5,
				ty: 5,
				playerTx: 9,
				playerTy: 9,
				onGateTrail: false,
			});
		expect(at('watered').confirmKey).toBe('game.confirm.clearWateredBed');
		expect(at(null).confirmKey).toBeUndefined();
		expect(at('tilled').confirmKey).toBeUndefined();
	});

	it('THE BUG: flooding the tile you are standing on is blocked, not confirmed', () => {
		// It would strand the caretaker in open water, so there is no "are you sure"
		// to say yes to — the click is refused outright.
		const d = terraformDecision({
			activeTool: 'watering-can',
			existingType: 'watered',
			tx: 5,
			ty: 5,
			playerTx: 5,
			playerTy: 5,
			onGateTrail: false,
		});
		expect(d.blockKey).toBe('game.block.standingHere');
		expect(d.confirmKey).toBeUndefined();
	});

	it('will not let you wall off the way into the next biome', () => {
		const d = terraformDecision({
			activeTool: 'watering-can',
			existingType: 'watered',
			tx: 1,
			ty: 10,
			playerTx: 9,
			playerTy: 9,
			onGateTrail: true,
		});
		expect(d.blockKey).toBe('game.block.gateTrail');
	});

	it('carries what the click was decided against, so the server can refuse a stale one', () => {
		// This is the whole of the "watering turned my bed into a pond" report: the
		// second click of a double-click was decided against a tile the server had
		// already changed. `expect` is what lets the server notice.
		const d = terraformDecision({
			activeTool: 'watering-can',
			existingType: 'tilled',
			tx: 5,
			ty: 5,
			playerTx: 9,
			playerTy: 9,
			onGateTrail: false,
		});
		expect(d.expect).toBe('tilled');
		expect(
			terraformDecision({
				activeTool: 'shovel',
				existingType: null,
				tx: 5,
				ty: 5,
				playerTx: 9,
				playerTy: 9,
				onGateTrail: false,
			}).expect,
		).toBeNull();
	});

	it('swallows the impatient second click but not a deliberate second visit', () => {
		expect(shouldSwallowRepeat(1000, 1300)).toBe(true);
		expect(shouldSwallowRepeat(1000, 2000)).toBe(false);
		// A tile never shaped this session has nothing to swallow.
		expect(shouldSwallowRepeat(undefined, 1000)).toBe(false);
	});
});

// ---------------------------------------------------------------------- spawn

describe('spawnFor', () => {
	const d = dimsOf('meadow', biomes);
	const here = { x: 7, y: 7 };

	it('does not move you when you were already there', () => {
		expect(spawnFor('in-place', d, here)).toEqual(here);
	});

	it('lands you on the edge that faces where you came from', () => {
		expect(spawnFor('west-edge', d, here).x).toBeLessThan(d.cols / 2);
		expect(spawnFor('east-edge', d, here).x).toBeGreaterThan(d.cols / 2);
		// Both on the gate row, so you step out facing the trail you came in by.
		expect(spawnFor('west-edge', d, here).y).toBe(d.gateY);
		expect(spawnFor('east-edge', d, here).y).toBe(d.gateY);
	});

	it('computes the east edge from the DESTINATION grid, not a fixed width', () => {
		// Biomes are different sizes; a hard-coded east edge drops you outside the
		// smaller ones and short of the meadow's real edge.
		const wide = spawnFor('east-edge', dimsOf('meadow', biomes), here);
		const narrow = spawnFor('east-edge', dimsOf('forest', biomes), here);
		expect(wide.x).toBeGreaterThan(narrow.x);
	});

	it('puts you in front of a trail tent when you step out of one', () => {
		const s = spawnFor('tent-door', d, here, { x: 10, y: 10 });
		expect(s).toEqual({ x: 10.5, y: 11.4 });
	});

	it('falls back rather than guessing when the tent it named is not pitched', () => {
		expect(spawnFor('tent-door', d, here, null)).not.toEqual(here);
	});
});

describe('clampSpawn', () => {
	it('drags a restored position back inside the area it is restored into', () => {
		const d = dimsOf('alpine', biomes);
		// Above playTop is inside the mountain — a save from before the range existed
		// would put the caretaker in the rock.
		expect(clampSpawn({ x: 5, y: 0 }, d).y).toBeGreaterThan(d.playTop);
		expect(clampSpawn({ x: -3, y: 5 }, d).x).toBe(1);
		expect(clampSpawn({ x: 9999, y: 5 }, d).x).toBe(d.cols - 1);
		// …and leaves a legitimate position alone.
		expect(clampSpawn({ x: 12, y: 15 }, d)).toEqual({ x: 12, y: 15 });
	});
});

// ---------------------------------------------------------------------- nodes

describe('nodeStateKey / nodeReady', () => {
	it('is the key the cooldown is written under', () => {
		// applyCollectResult writes this exact string (see action-patch.test.ts). If
		// reader and writer ever disagree the node renders full and the player
		// gathers a bare patch.
		expect(nodeStateKey('w1', 'meadow', 'n7')).toBe('w1:meadow:n7');
	});

	it('treats a node that was never gathered as ready', () => {
		expect(nodeReady(undefined, 60, Date.now())).toBe(true);
	});

	it('holds a gathered node until its regen window is up', () => {
		const t0 = 1_000_000;
		expect(nodeReady(t0, 60, t0 + 59_000)).toBe(false);
		expect(nodeReady(t0, 60, t0 + 60_000)).toBe(true);
	});
});

describe('computeNodeLayout', () => {
	const layout = (over: any = {}) =>
		computeNodeLayout({
			area: 'meadow',
			dims: dimsOf('meadow', biomes),
			resources: ['fiber', 'water', 'branches', 'seeds'],
			nodeSeed: 'w1-meadow-nodes',
			occupied: new Set<string>(),
			...over,
		});

	it('is the same layout every session in the same world', () => {
		// The whole reason the layout is seeded: gathering a node must not shuffle
		// the map, and neither must reloading.
		expect(layout()).toEqual(layout());
	});

	it('is a different layout in a different world', () => {
		expect(layout()).not.toEqual(layout({ nodeSeed: 'w2-meadow-nodes' }));
	});

	it('guarantees every biome resource actually appears', () => {
		// Coverage used to be left to a shuffle that could drop a resource
		// entirely — a biome you could not finish because one material never spawned.
		const counts = new Map<string, number>();
		for (const n of layout()) counts.set(n.resourceId, (counts.get(n.resourceId) || 0) + 1);
		for (const r of ['fiber', 'water', 'branches', 'seeds']) {
			expect(counts.get(r) || 0).toBeGreaterThanOrEqual(2);
		}
		// The meadow is the opening biome, so its starter staples get more.
		expect(counts.get('fiber')!).toBeGreaterThanOrEqual(4);
		expect(counts.get('water')!).toBeGreaterThanOrEqual(4);
		expect(counts.get('branches')!).toBeGreaterThanOrEqual(3);
	});

	it('never spawns a node in the camp or in a gate mouth', () => {
		const d = dimsOf('meadow', biomes);
		for (const n of layout()) {
			expect(inCamp('meadow', n.tx, n.ty)).toBe(false);
			expect(nearGate(n.tx, n.ty, d)).toBe(false);
		}
	});

	it('keeps every node inside the playable band', () => {
		const d = dimsOf('meadow', biomes);
		for (const n of layout()) {
			expect(n.tx).toBeGreaterThanOrEqual(1);
			expect(n.ty).toBeGreaterThanOrEqual(d.playTop);
			expect(n.tx).toBeLessThan(d.landRight);
			expect(n.ty).toBeLessThan(d.rows);
		}
	});

	it('relocates a node you built on instead of burying it', () => {
		// Players can build anywhere. A regen spot under a new placement moves to the
		// nearest free tile and keeps its id, so the cooldown follows it.
		const plain = layout();
		const buried = plain[0];
		const moved = layout({ occupied: new Set([`${buried.tx},${buried.ty}`]) });
		const same = moved.find((n) => n.id === buried.id)!;
		expect(same).toBeDefined();
		expect(`${same.tx},${same.ty}`).not.toBe(`${buried.tx},${buried.ty}`);
	});

	it('scales the node budget with the size of the preserve', () => {
		const big = layout().length;
		const small = layout({
			dims: dimsOf('forest', biomes),
			area: 'forest',
			resources: ['branches', 'fiber'],
		}).length;
		expect(big).toBeGreaterThan(small);
	});

	it('puts a water source near where you spawn, and skips it in a dry biome', () => {
		const meadow = layout();
		const anchor = { tx: 26, ty: 8 };
		expect(
			meadow.some(
				(n) =>
					(n.resourceId === 'water' || n.resourceId === 'clean-water') &&
					Math.abs(n.tx - anchor.tx) <= 5 &&
					Math.abs(n.ty - anchor.ty) <= 5,
			),
		).toBe(true);
		const desert = layout({
			area: 'desert',
			dims: dimsOf('desert', biomes),
			resources: ['sand'],
			nodeSeed: 'w1-desert-nodes',
		});
		expect(desert.every((n) => n.resourceId === 'sand')).toBe(true);
	});

	it('adds weather-gated spots only while that weather is up, in stable places', () => {
		const dry = layout();
		const rainy = () =>
			layout({
				weatherResourceId: 'rainwater',
				weatherSeed: 'w1:meadow:wx:rain',
			});
		expect(dry.some((n) => n.resourceId === 'rainwater')).toBe(false);
		expect(rainy().filter((n) => n.resourceId === 'rainwater')).toHaveLength(2);
		// Same weather, same world, same spots — so they don't jitter every repaint.
		expect(rainy()).toEqual(rainy());
	});
});

// -------------------------------------------------------------------- animals

describe('animalGait', () => {
	it('reads the kind first', () => {
		expect(animalGait({ id: 'x', kind: 'insect' })).toBe('flutter');
		expect(animalGait({ id: 'x', kind: 'bird' })).toBe('flit');
		expect(animalGait({ id: 'x', kind: 'fish' })).toBe('swim');
	});

	it('swims anything the data marks as ocean or aquatic', () => {
		expect(animalGait({ id: 'otter', ocean: true })).toBe('swim');
		expect(animalGait({ id: 'newt', aquatic: true })).toBe('swim');
	});

	it('THE BUG: a bat star is a starfish, and starfish do not flutter', () => {
		// Substring matching on 'bat' caught it. It lives on the seafloor.
		expect(animalGait({ id: 'bat-star', kind: 'invertebrate' })).not.toBe('flutter');
		expect(animalGait({ id: 'little-brown-bat', kind: 'mammal' })).toBe('flutter');
	});

	it('hops the hoppers and slithers the slitherers', () => {
		expect(animalGait({ id: 'cottontail-rabbit', kind: 'mammal' })).toBe('hop');
		expect(animalGait({ id: 'pacific-chorus-frog', kind: 'amphibian' })).toBe('hop');
		expect(animalGait({ id: 'garter-snake', kind: 'reptile' })).toBe('slither');
		expect(animalGait({ id: 'mule-deer', kind: 'mammal' })).toBe('amble');
	});
});

describe('hopAmp', () => {
	it('keeps the bounce the same few screen pixels whatever the species scale', () => {
		// Amplitude is in texture px, so it has to be divided back out by scale —
		// otherwise a scaled-down mouse bounces its own height.
		expect(hopAmp(0.2)).toBeGreaterThan(hopAmp(0.5));
		// …but clamped, so nothing is either imperceptible or launched off-screen.
		expect(hopAmp(0.001)).toBeLessThanOrEqual(26);
		expect(hopAmp(100)).toBeGreaterThanOrEqual(8);
	});
});

// ----------------------------------------------------------------- misc rules

describe('nextUserZoom', () => {
	it('is a nudge, not a telescope — two steps each way', () => {
		let z = 1;
		for (let i = 0; i < 10; i++) z = nextUserZoom(z, 1.25);
		expect(z).toBeCloseTo(USER_ZOOM_MAX);
		for (let i = 0; i < 20; i++) z = nextUserZoom(z, 1 / 1.25);
		expect(z).toBeCloseTo(USER_ZOOM_MIN);
	});
});

describe('mixMs', () => {
	it('THE BUG: two times 49.7 days apart must not hash the same', () => {
		// `^` coerces through ToInt32, so a 13-digit ms timestamp folded in directly
		// loses everything above bit 31 — and growth timers are driven off these, so
		// the collision showed up as a plant that never visually matured.
		const t0 = 1_700_000_000_000;
		expect(mixMs(7, t0)).not.toBe(mixMs(7, t0 + 2 ** 32));
	});

	it('is stable for the same inputs', () => {
		expect(mixMs(7, 1234)).toBe(mixMs(7, 1234));
	});
});

describe('mulberry32', () => {
	it('replays the same stream from the same seed', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it('stays in [0, 1)', () => {
		const r = mulberry32(1);
		for (let i = 0; i < 500; i++) {
			const v = r();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('TILE', () => {
	it('is the one tile size the whole world is measured in', () => {
		expect(TILE).toBe(32);
	});
});

// A dims object built by hand still satisfies the contract the rules expect,
// so a future biome shape can be tested without touching data/biomes.json.
const custom: AreaDims = {
	cols: 50,
	baseRows: 30,
	rows: 30,
	playTop: 0,
	landRight: 50,
	gateY: 15,
};
describe('the rules take any area shape', () => {
	it('works on a grid no biome file describes', () => {
		expect(nearGate(2, 15, custom)).toBe(true);
		expect(canPlaceAt(25, 15, outdoorCtx({ dims: custom, area: 'forest' }))).toBe(true);
	});
});

// ---------------------------------------------------------------- stillness
//
// Sitting still is the one mechanic that pays for doing nothing, and the rule
// is deliberately one the player can see out of the window: whoever was nearest
// when you sat down comes first, and everyone gets there eventually. These
// tests exist because the obvious "improvements" to that — gate it on habitat,
// gate it on health, add a threshold — all quietly turn a bench that fills up
// into a bench that looks broken.

describe('approachWaitMs', () => {
	it('sends the animal at your elbow over within a few seconds', () => {
		expect(approachWaitMs(20, { comfort: 60, health: 60 })).toBeLessThan(4000);
	});

	it('takes longer the further it has to come, all the way across the area', () => {
		const settled = { comfort: 60, health: 60 };
		const waits = [0, 2, 5, 10, 18].map((tiles) => approachWaitMs(tiles * TILE, settled));
		for (let i = 1; i < waits.length; i++) expect(waits[i]).toBeGreaterThan(waits[i - 1]);
	});

	it('stops getting slower past the far side of the area', () => {
		expect(approachWaitMs(APPROACH_SPAN * 4)).toBe(approachWaitMs(APPROACH_SPAN));
	});

	it('stays inside the two ends it promises, whatever it is handed', () => {
		const inputs = [0, -50, 40, 900, Infinity];
		for (const d of inputs)
			for (const comfort of [0, 50, 100])
				for (const health of [0, 50, 100]) {
					const w = approachWaitMs(d, { comfort, health });
					expect(w).toBeGreaterThanOrEqual(APPROACH_FIRST_MS);
					expect(w).toBeLessThanOrEqual(Math.round(APPROACH_FAR_MS * 1.25));
				}
	});

	it('lets comfort and health stretch the wait but never stop it', () => {
		// The whole difference from the version before this one: there is no
		// "never". A newcomer to a struggling preserve dithers; it still comes.
		const wary = approachWaitMs(6 * TILE, { comfort: 0, health: 0 });
		const settled = approachWaitMs(6 * TILE, { comfort: 100, health: 100 });
		expect(wary).toBeGreaterThan(settled);
		expect(wary / settled).toBeLessThan(1.3);
		expect(Number.isFinite(wary)).toBe(true);
	});

	it('never gates on what the player planted', () => {
		// The rule the player can see out of the window. Source-scanned rather
		// than rendered — same style and same reason as toast-discipline.test.ts —
		// because the regression this guards against is someone reaching for the
		// placement list again to make the bench "smarter", which is how it came
		// to look broken the first time.
		const scene = readFileSync(resolve(__dirname, '../../src/game/WorldScene.ts'), 'utf8');
		const armStillness = scene.slice(scene.indexOf('private armStillness()'));
		const body = armStillness.slice(0, armStillness.indexOf('\n\t}\n'));
		expect(body, 'armStillness not found — the scan is looking at the wrong thing').toContain('approachWaitMs');
		expect(body, 'the wait is reading habitat again').not.toMatch(/requirements|placements/);
	});
});

describe('ANIMAL_DRAW_CAP', () => {
	it('clears the biggest roster a biome can hold, so a restored area shows all of it', () => {
		// The cap is a safety bound on the layer, not a density knob — its own
		// comment says so, and this is what keeps that true as animals are added.
		// Without it, growing a biome past the cap silently stops drawing the
		// animals you welcomed most recently, which is the hardest kind of missing
		// to notice: the area still looks full.
		const perBiome = new Map<string, number>();
		for (const a of [...animals1.records, ...animals2.records]) perBiome.set(a.biome, (perBiome.get(a.biome) ?? 0) + 1);
		const largest = Math.max(...perBiome.values());
		expect(largest).toBeGreaterThan(0);
		expect(ANIMAL_DRAW_CAP, `one biome holds ${largest} animals`).toBeGreaterThanOrEqual(largest);
	});
});

describe('a seat draws company, not a swarm', () => {
	it('keeps the gathering to a handful, however full the area is', () => {
		// A biome can show ANIMAL_DRAW_CAP animals at once; only a few of them are
		// ever coming over. The rest carrying on with their own business is what
		// makes the ones that came read as having chosen to.
		expect(APPROACH_MAX).toBeGreaterThanOrEqual(3);
		expect(APPROACH_MAX).toBeLessThanOrEqual(6);
		expect(APPROACH_MAX).toBeLessThan(ANIMAL_DRAW_CAP / 3);
	});

	it('staggers them near to far, over a stretch you can watch', () => {
		// Everyone arriving at once is a cutscene; near-to-far over some seconds
		// is a meadow gradually deciding you are furniture.
		const near = approachWaitMs(TILE, { comfort: 60, health: 60 });
		const far = approachWaitMs(APPROACH_SPAN, { comfort: 60, health: 60 });
		expect(far - near).toBeGreaterThan(6000);
	});
});

describe('approachRadius', () => {
	it('keeps the shy kinds further back than the bold ones', () => {
		expect(approachRadius('mammal')).toBeGreaterThan(approachRadius('insect'));
		expect(approachRadius('bird')).toBeGreaterThan(approachRadius('invertebrate'));
	});

	it('settles everything right around the bench — one to two tiles, never in the lap', () => {
		for (const kind of ['mammal', 'bird', 'fish', 'reptile', 'amphibian', 'invertebrate', 'insect', 'nonsense']) {
			expect(approachRadius(kind), kind).toBeGreaterThanOrEqual(30);
			expect(approachRadius(kind), kind).toBeLessThanOrEqual(2 * TILE);
		}
	});
});

describe('approachPoint', () => {
	it('lands on the animal’s own side of the seat, so nothing walks through you', () => {
		const rng = () => 0.5; // no jitter
		const fromEast = approachPoint(100, 100, 400, 100, 50, rng);
		expect(fromEast.x).toBeGreaterThan(100);
		const fromWest = approachPoint(100, 100, -400, 100, 50, rng);
		expect(fromWest.x).toBeLessThan(100);
	});

	it('stops at the radius rather than at the seat', () => {
		const p = approachPoint(100, 100, 300, 100, 60, () => 0.5);
		expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(60, 5);
	});
});

describe('approachLeg', () => {
	it('closes part of the distance at a time — an arrival is several legs', () => {
		const leg = approachLeg(0, 0, 400, 0, () => 0.5);
		const covered = Math.hypot(leg.x, leg.y);
		expect(covered).toBeGreaterThan(0);
		expect(covered).toBeLessThan(400);
	});

	it('lands exactly on the goal once it is all but there', () => {
		expect(approachLeg(0, 0, 4, 0, () => 0.5)).toEqual({ x: 4, y: 0 });
	});
});

describe('hasArrived', () => {
	it('counts as company a little outside the ring, and not far outside it', () => {
		expect(hasArrived(150, 100, 100, 100, 50)).toBe(true);
		expect(hasArrived(160, 100, 100, 100, 50)).toBe(true);
		expect(hasArrived(200, 100, 100, 100, 50)).toBe(false);
	});
});

describe('animalsReady', () => {
	// The intermittent no-animals bug: the save and the animal definitions reach
	// the bridge independently, so a repaint can land with discoveries in hand and
	// nothing to draw them from. Painting is only safe once BOTH are there — the
	// caller uses this to decide whether the cast it painted may be cached.
	const data = { animals: [{ id: 'red-fox' }] };
	const state = { discoveries: [] };

	it('is ready only when the save and the definitions have both landed', () => {
		expect(animalsReady(data, state)).toBe(true);
		expect(animalsReady(data, null)).toBe(false);
		expect(animalsReady(null, state)).toBe(false);
		expect(animalsReady(null, null)).toBe(false);
	});

	it('is not ready while the definitions are present but empty', () => {
		expect(animalsReady({ animals: [] }, state)).toBe(false);
		expect(animalsReady({}, state)).toBe(false);
	});

	it('treats undefined the same as missing', () => {
		expect(animalsReady(undefined, state)).toBe(false);
		expect(animalsReady(data, undefined)).toBe(false);
	});
});

describe('a restarted scene inherits no stale draw signature', () => {
	// The reported bug: step into the home, step back out, and every animal in the
	// area is gone until the cast itself changes.
	//
	// Area transitions go through scene.restart(), which REUSES this instance —
	// field initializers do not run again. The layers are rebuilt empty, so any
	// cached "this is what I drew last time" signature that survives the restart
	// now describes sprites that no longer exist, and the next repaint reads
	// "nothing changed" and skips. Indoors makes it reachable on purpose:
	// refreshDynamic returns before the animal block, so going in never refreshes
	// animalSig, and coming back out recomputes the very same one.
	const scene = readFileSync(resolve(__dirname, '../../src/game/WorldScene.ts'), 'utf8');
	const reset = (() => {
		const from = scene.slice(scene.indexOf('private resetTransientState()'));
		return from.slice(0, from.indexOf('\n\t}\n'));
	})();

	it('found resetTransientState — the scan is looking at the right thing', () => {
		expect(reset).toContain('dynamicSig');
	});

	it('clears every signature that can skip a repaint', () => {
		for (const sig of ['animalSig', 'dynamicSig', 'weatherSig']) {
			expect(reset, `${sig} survives scene.restart() and will skip the first repaint`).toMatch(
				new RegExp(`this\\.${sig} = '';`),
			);
		}
	});

	it('leaves no cached signature field unreset anywhere', () => {
		const declared = [...scene.matchAll(/private (\w+Sig) = '';/g)].map((m) => m[1]);
		expect(declared.length).toBeGreaterThan(0);
		for (const sig of declared) {
			const clears = [...scene.matchAll(new RegExp(`this\\.${sig} = '';`, 'g'))].length;
			expect(clears, `${sig} is declared but never cleared on a (re)create path`).toBeGreaterThan(0);
		}
	});
});


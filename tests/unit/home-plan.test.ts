import { describe, it, expect } from 'vitest';
import {
	type PlanDef,
	floorTilesOf,
	isBackWall,
	isFloorTile,
	isOpening,
	isWalkable,
	canHangAt,
	hasWindow,
	isWallTile,
	layoutOf,
	roomAt,
	wallRoomOf,
	wallTilesOf,
} from '../../src/homePlan';
import { HOME_TRACKS } from '../../server/home';

// The home's floor plan.
//
// Space used to buy a bigger rectangle. Past level 2 it buys ROOMS — a great
// room with a nook off it, and later a study as well — joined by 1-tile
// doorways cut through the walls between them. Every rule that used to be a
// pair of comparisons against one rectangle ("is this floor", "may something
// hang here") is now a question about the plan, asked by BOTH halves of the
// game through this module. So this suite is where those rules are pinned.

const GRID_W = 30;
const GRID_H = 20;
const lay = (plan: PlanDef) => layoutOf(plan, GRID_W, GRID_H);

/** The shipped plans, so the tests below check the rooms players actually get. */
const LEVELS = HOME_TRACKS.space.levels as PlanDef[];

describe('a single-room level behaves exactly as the old rectangle did', () => {
	const r = lay({ inner: { w: 8, h: 6 } }); // space 2 — a freshly built house

	it('centers itself in the grid', () => {
		expect({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }).toEqual({ x0: 11, y0: 7, x1: 18, y1: 12 });
	});

	it('hangs on the back run and both side runs', () => {
		expect(isWallTile(r, r.x0, r.y0 - 1)).toBe(true); // back
		expect(isWallTile(r, r.x1, r.y0 - 1)).toBe(true);
		expect(isWallTile(r, r.x0 - 1, r.y0)).toBe(true); // left
		expect(isWallTile(r, r.x1 + 1, r.y1)).toBe(true); // right
	});

	it('hangs on neither the corners nor the door wall', () => {
		expect(isWallTile(r, r.x0 - 1, r.y0 - 1)).toBe(false);
		expect(isWallTile(r, r.x1 + 1, r.y1 + 1)).toBe(false);
		expect(isWallTile(r, r.doorX, r.y1 + 1)).toBe(false);
	});

	it('puts the door at the bottom center, with a walkable threshold outside it', () => {
		expect({ x: r.doorX, y: r.doorY }).toEqual({ x: 15, y: 12 });
		expect(isWalkable(r, r.doorX, r.doorY + 1)).toBe(true);
		expect(isWalkable(r, r.doorX + 2, r.doorY + 1)).toBe(false);
	});
});

describe('a floor plan — rooms joined by doorways', () => {
	// Two rooms side by side sharing one wall column, with a door through it.
	const plan: PlanDef = {
		inner: { w: 13, h: 7 },
		rooms: [
			{ id: 'main', name: 'Great Room', x: 0, y: 0, w: 9, h: 7 },
			{ id: 'nook', name: 'Nook', x: 10, y: 0, w: 3, h: 5 },
		],
		doors: [{ x: 9, y: 2 }],
	};
	const r = lay(plan);
	const main = r.rooms[0];
	const nook = r.rooms[1];
	const divider = { x: main.x1 + 1, y: main.y0 + 1 }; // shared wall, not the door

	it('lays every room out in the same grid', () => {
		expect(roomAt(r, main.x0, main.y0)?.id).toBe('main');
		expect(roomAt(r, nook.x0, nook.y0)?.id).toBe('nook');
		expect(roomAt(r, divider.x, divider.y)).toBe(null);
	});

	it('counts the floor of every room, not the bounding box', () => {
		expect(floorTilesOf(r)).toBe(9 * 7 + 3 * 5);
	});

	it('lets you walk through a doorway but not through the wall it is cut into', () => {
		const door = { x: r.doorX, y: r.doorY };
		expect(isOpening(r, main.x1 + 1, main.y0 + 2)).toBe(true);
		expect(isWalkable(r, main.x1 + 1, main.y0 + 2)).toBe(true);
		expect(isWalkable(r, divider.x, divider.y)).toBe(false);
		expect(isWalkable(r, door.x, door.y)).toBe(true);
	});

	it('refuses to hang anything on a doorway or on the wall the two rooms share', () => {
		expect(isWallTile(r, main.x1 + 1, main.y0 + 2)).toBe(false); // the doorway
		expect(isWallTile(r, divider.x, divider.y)).toBe(false); // faces two rooms
	});

	it('gives the nook wall runs of its own to hang on', () => {
		expect(isWallTile(r, nook.x1 + 1, nook.y0)).toBe(true); // its outer side wall
		expect(isWallTile(r, nook.x0, nook.y0 - 1)).toBe(true); // its own back run
		// and the great room's back wall keeps every tile it had
		for (let x = main.x0; x <= main.x1; x++) expect(isWallTile(r, x, main.y0 - 1)).toBe(true);
	});

	it('finds a wall below the nook, where the plan steps in', () => {
		// The nook is shorter than the great room, so the tiles under it are wall
		// — and they are BELOW floor, which is the door-wall case: nothing hangs.
		expect(isFloorTile(r, nook.x0, nook.y1 + 1)).toBe(false);
		expect(isWallTile(r, nook.x0, nook.y1 + 1)).toBe(false);
	});

	it('gives every wall tile a room whose paint it wears', () => {
		expect(wallRoomOf(r, main.x0, main.y0 - 1)?.id).toBe('main');
		expect(wallRoomOf(r, nook.x1 + 1, nook.y0)?.id).toBe('nook');
		// the shared divider goes to the room listed first, so the great room's
		// walls stay one color and the little room borrows the divider
		expect(wallRoomOf(r, divider.x, divider.y)?.id).toBe('main');
	});

	it('lists only hangable tiles as wall tiles', () => {
		for (const w of wallTilesOf(r)) {
			expect(isWallTile(r, w.x, w.y)).toBe(true);
			expect(isFloorTile(r, w.x, w.y)).toBe(false);
		}
	});

	it('marks the ceiling edge of every room, which is where trim and windows go', () => {
		expect(isBackWall(r, main.x0 + 1, main.y0 - 1)).toBe(true);
		expect(isBackWall(r, nook.x0, nook.y0 - 1)).toBe(true);
		expect(isBackWall(r, main.x0 - 1, main.y0)).toBe(false); // a side wall
	});

	it('keeps the exit on the great room, never on a room hanging off it', () => {
		expect(roomAt(r, r.doorX, r.doorY)?.id).toBe('main');
		expect(isFloorTile(r, r.doorX, r.doorY + 1)).toBe(false);
	});
});

describe('the plans the game actually ships', () => {
	it('gives every Space level a plan that fits in the grid', () => {
		for (const [i, level] of LEVELS.entries()) {
			const r = lay(level);
			expect(r.x0 - 1, `level ${i + 1} left wall`).toBeGreaterThanOrEqual(0);
			expect(r.y0 - 1, `level ${i + 1} back wall`).toBeGreaterThanOrEqual(0);
			expect(r.x1 + 1, `level ${i + 1} right wall`).toBeLessThan(GRID_W);
			expect(r.y1 + 1, `level ${i + 1} door wall`).toBeLessThan(GRID_H);
		}
	});

	it('never shrinks the place you live in', () => {
		const sizes = LEVELS.map((l) => floorTilesOf(lay(l)));
		for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
	});

	it('opens up into rooms once the house is past its starter size', () => {
		expect(lay(LEVELS[1]).rooms).toHaveLength(1); // the house you build
		expect(lay(LEVELS[2]).rooms.length).toBeGreaterThan(1);
		expect(lay(LEVELS[3]).rooms.length).toBeGreaterThan(lay(LEVELS[2]).rooms.length);
	});

	it('finishes on a proper house — the last level is at least four rooms', () => {
		expect(lay(LEVELS[LEVELS.length - 1]).rooms.length).toBeGreaterThanOrEqual(4);
	});

	it('gives every level more wall to hang things on than the one before', () => {
		const walls = LEVELS.map((l) => wallTilesOf(lay(l)).length);
		for (let i = 1; i < walls.length; i++) expect(walls[i]).toBeGreaterThan(walls[i - 1]);
	});

	it('keeps room ids stable across levels, so paint survives an upgrade', () => {
		// Every step of the ladder, not just the one that first had rooms: the plan
		// a room id belongs to changes shape at 3, 4, 5, 6 and 7, and the color the
		// player chose is filed under that id.
		for (let i = 3; i < LEVELS.length; i++) {
			const before = lay(LEVELS[i - 1]).rooms.map((r) => r.id);
			const after = lay(LEVELS[i]).rooms.map((r) => r.id);
			for (const id of before) expect(after, `room ${id} lost its id at Space ${i + 1}`).toContain(id);
		}
	});

	it('never makes an individual room smaller, only the house bigger', () => {
		// The whole-house total climbing is not enough on its own: an upgrade that
		// grew the great room by carving the bedroom in half would pass that and
		// still leave someone's furniture shuffled onto the nearest free tile.
		const areaOf = (level: PlanDef) =>
			new Map(lay(level).rooms.map((r) => [r.id, (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)]));
		for (let i = 3; i < LEVELS.length; i++) {
			const before = areaOf(LEVELS[i - 1]);
			const after = areaOf(LEVELS[i]);
			for (const [id, size] of before) {
				expect(after.get(id), `room ${id} shrank at Space ${i + 1}`).toBeGreaterThanOrEqual(size);
			}
		}
	});

	it('never lets two rooms share a tile, or sit against each other without a wall', () => {
		const overlaps: string[] = [];
		const touching: string[] = [];
		for (const [i, level] of LEVELS.entries()) {
			const r = lay(level);
			for (const room of r.rooms) {
				for (let y = room.y0; y <= room.y1; y++) {
					for (let x = room.x0; x <= room.x1; x++) {
						const here = roomAt(r, x, y);
						if (here?.id !== room.id) overlaps.push(`level ${i + 1}: ${room.id} vs ${here?.id} at ${x},${y}`);
						// the tile east and the tile south are either the same room, a wall,
						// or a doorway — never a different room's floor touching this one
						for (const [dx, dy] of [
							[1, 0],
							[0, 1],
						]) {
							const other = roomAt(r, x + dx, y + dy);
							if (other && other.id !== room.id) {
								touching.push(`level ${i + 1}: ${room.id} touches ${other.id} at ${x},${y}`);
							}
						}
					}
				}
			}
		}
		expect(overlaps).toEqual([]);
		expect(touching).toEqual([]);
	});

	it('grows the house by more than half again over the three late levels', () => {
		// Space 5, 6 and 7 are gated on the desert, the alpine and the coast, and
		// each one is a week of gathering: the house has to feel different after.
		const sizes = LEVELS.map((l) => floorTilesOf(lay(l)));
		expect(sizes[LEVELS.length - 1]).toBeGreaterThan(sizes[3] * 2);
		for (let i = 4; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1] * 1.15);
	});

	it('cuts every doorway through an actual wall between two rooms', () => {
		for (const [i, level] of LEVELS.entries()) {
			const r = lay(level);
			for (const key of r.openings) {
				const [x, y] = key.split(',').map(Number);
				expect(isFloorTile(r, x, y), `level ${i + 1}: doorway ${key} is inside a room`).toBe(false);
				const sides = [roomAt(r, x - 1, y), roomAt(r, x + 1, y), roomAt(r, x, y - 1), roomAt(r, x, y + 1)].filter(
					Boolean,
				);
				expect(new Set(sides.map((s) => s!.id)).size, `level ${i + 1}: doorway ${key} joins two rooms`).toBe(2);
			}
		}
	});

	it('leaves no room you cannot walk to', () => {
		for (const [i, level] of LEVELS.entries()) {
			const r = lay(level);
			// flood fill from just inside the front door across floor + doorways
			const seen = new Set<string>();
			const queue = [{ x: r.doorX, y: r.doorY }];
			while (queue.length) {
				const p = queue.pop()!;
				const key = `${p.x},${p.y}`;
				if (seen.has(key) || !(isFloorTile(r, p.x, p.y) || isOpening(r, p.x, p.y))) continue;
				seen.add(key);
				queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
			}
			for (const room of r.rooms)
				expect(seen.has(`${room.x0},${room.y0}`), `level ${i + 1}: ${room.id} is walled off`).toBe(true);
		}
	});
});

describe('windows — part of the house, not of the decorating', () => {
	const plan = LEVELS[LEVELS.length - 1];
	const lit = (light: number) => layoutOf(plan, GRID_W, GRID_H, light);

	it('gives a house with no Warmth no windows at all', () => {
		expect(lit(1).windows.size).toBe(0);
	});

	it('opens more of them as the Warmth track climbs, and never fewer', () => {
		const counts = [2, 3, 4, 5, 6, 7].map((n) => lit(n).windows.size);
		for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
		expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
	});

	it("never glazes more than a third of any room's wall", () => {
		// The wall is somewhere to hang things. A room that is mostly glass has
		// nowhere left for a picture, which is the whole point of the wall runs.
		for (const level of LEVELS) {
			const r = layoutOf(level, GRID_W, GRID_H, 7);
			const perRoom = new Map<string, { wall: number; win: number }>();
			for (const w of wallTilesOf(r)) {
				const id = wallRoomOf(r, w.x, w.y)!.id;
				const tally = perRoom.get(id) || { wall: 0, win: 0 };
				tally.wall++;
				if (hasWindow(r, w.x, w.y)) tally.win++;
				perRoom.set(id, tally);
			}
			// A third of the wall, or the single window every room is guaranteed —
			// a cellar with two tiles of outward wall still gets one of them.
			for (const [id, { wall, win }] of perRoom)
				expect(win, `${id}: ${win} of ${wall} wall tiles are window`).toBeLessThanOrEqual(
					Math.max(1, Math.floor(wall / 3)),
				);
		}
	});

	it('puts every one on a wall that looks outside', () => {
		const r = lit(4);
		for (const key of r.windows) {
			const [x, y] = key.split(',').map(Number);
			// a wall run tile — which by definition has floor on exactly one side, so
			// it can never be the tile two rooms share
			expect(isWallTile(r, x, y), `window at ${key} is not on an outward wall`).toBe(true);
		}
	});

	it('lights every room, including the ones tucked in behind another', () => {
		const r = lit(2);
		for (const room of r.rooms) {
			const own = [...r.windows].some((key) => {
				const [x, y] = key.split(',').map(Number);
				return wallRoomOf(r, x, y)?.id === room.id;
			});
			expect(own, `${room.id} has no window`).toBe(true);
		}
	});

	it('refuses to let anything hang where a window is', () => {
		const r = lit(4);
		for (const key of r.windows) {
			const [x, y] = key.split(',').map(Number);
			expect(hasWindow(r, x, y)).toBe(true);
			expect(canHangAt(r, x, y), `${key} accepted a picture over a window`).toBe(false);
		}
		// and the rest of the wall is still perfectly hangable
		const free = wallTilesOf(r).filter((w) => !hasWindow(r, w.x, w.y));
		expect(free.length).toBeGreaterThan(0);
		for (const w of free) expect(canHangAt(r, w.x, w.y)).toBe(true);
	});

	it('puts them in the same places every time — they do not depend on anything placed', () => {
		expect([...lit(3).windows].sort()).toEqual([...lit(3).windows].sort());
		expect([...lit(3).windows]).not.toEqual([...lit(4).windows]);
	});
});

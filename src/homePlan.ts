// Wild Willows — home floor plans (shared geometry)
//
// The one description of what an interior IS, read by both halves of the game:
// the server decides from it (server/home.ts) and the client draws and
// ghost-checks against it (src/game/worldRules.ts, src/game/WorldScene.ts).
// Wall runs, doorways and "is this tile floor" used to be a pair of one-line
// rectangle tests written out twice, which was fine while an interior was one
// rectangle. A floor plan is not a rectangle, and two copies of a floor plan is
// two floor plans — so this module is imported by both rather than mirrored.
//
// A PLAN is a handful of rooms laid out in a little coordinate space of its own,
// with 1-tile openings cut through the walls between them. The whole plan is
// then centered in the area grid, exactly as the single room always was.
//
//   ┌──────────┬─────┐   rooms are rectangles
//   │          │     │   the wall between two of them is ONE tile, shared
//   │  main    ░ nook│   ░ is a doorway: walkable, but nothing may stand on it
//   │          │     │
//   └────░─────┴─────┘   the exit door is on the main room's bottom wall
//
// Everything here is pure and allocation-light on the hot paths — canPlaceAt and
// the movement check ask these questions several times a frame.

/** A tile rectangle, inclusive on all four sides. */
export interface Rect {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** One room of a plan, in the plan's own space: (0,0) is the top-left tile of
 *  the plan's bounding box. `id` is what per-room paint is filed under, so it
 *  must stay stable across Space levels — the nook you painted at level 3 is
 *  still `nook` at level 4. */
export interface PlanRoom {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A Space level's floor plan. `inner` is the bounding box of all the rooms
 *  together — kept even for a single-room level, because it is what centres the
 *  plan in the grid and what the size-gated furniture (`homeMin`) reads. */
export interface PlanDef {
	/** Optional only so a Space level (which also carries costs and gates) types
	 *  as a plan; a level without one falls back to the starter room. */
	inner?: { w: number; h: number };
	/** Omitted for a plain rectangular level: one room filling `inner`. */
	rooms?: PlanRoom[];
	/** Openings cut through interior walls, in plan coordinates. */
	doors?: { x: number; y: number }[];
}

/** A room of a laid-out interior, in absolute tile coordinates. */
export interface LaidRoom extends Rect {
	id: string;
	name: string;
}

/** A plan placed in the grid: every room in absolute tiles, plus the doorways
 *  and the exit. Extends Rect with the bounding box of the whole floor, so the
 *  many callers that only want the extents keep reading `x0..y1`. */
export interface HomeLayout extends Rect {
	rooms: LaidRoom[];
	/** Interior doorway tiles as "x,y" — walkable holes in a shared wall. */
	openings: Set<string>;
	/** Wall tiles the Warmth track has glazed, as "x,y". Fixed by the plan and the
	 *  Warmth level and by nothing else: a window is part of the house, so it does
	 *  not shuffle out of the way of a picture — the picture goes elsewhere. */
	windows: Set<string>;
	/** The floor tile just inside the exit (the door itself is one row below). */
	doorX: number;
	doorY: number;
}

/** The starter plan, used when a Space level carries no plan of its own. */
export const FALLBACK_PLAN = { inner: { w: 8, h: 6 } } as const;

const ROOM_MAIN = 'main';

/** The rooms of `plan`, defaulted to the single room that fills its box. */
const planRooms = (plan: PlanDef & { inner: { w: number; h: number } }): PlanRoom[] =>
	plan.rooms?.length ? plan.rooms : [{ id: ROOM_MAIN, name: 'Room', x: 0, y: 0, w: plan.inner.w, h: plan.inner.h }];

/**
 * Place a plan in a `gridW` × `gridH` area, centered the way a single room always
 * was — so a save's absolute tile coordinates keep meaning what they meant.
 */
export function layoutOf(plan: PlanDef | undefined | null, gridW: number, gridH: number, light = 0): HomeLayout {
	const p = (plan?.inner ? plan : FALLBACK_PLAN) as PlanDef & { inner: { w: number; h: number } };
	const ox = Math.floor((gridW - p.inner.w) / 2);
	const oy = Math.floor((gridH - p.inner.h) / 2);
	const rooms: LaidRoom[] = planRooms(p).map((r) => ({
		id: r.id,
		name: r.name,
		x0: ox + r.x,
		y0: oy + r.y,
		x1: ox + r.x + r.w - 1,
		y1: oy + r.y + r.h - 1,
	}));
	const openings = new Set<string>();
	for (const d of p.doors || []) openings.add(`${ox + d.x},${oy + d.y}`);
	// The exit hangs off the MAIN room — rooms[0] — and nothing may be attached
	// below it, so that the tile under the door is always outside wall.
	const main = rooms[0];
	const base = {
		x0: ox,
		y0: oy,
		x1: ox + p.inner.w - 1,
		y1: oy + p.inner.h - 1,
		rooms,
		openings,
		windows: new Set<string>(),
		doorX: Math.round((main.x0 + main.x1) / 2),
		doorY: main.y1,
	};
	base.windows = windowTilesOf(base, light);
	return base;
}

/**
 * Where the Warmth track puts this interior's windows.
 *
 * Decided from the plan and the Warmth level alone, so every part of the game
 * agrees on it without being told: the client draws them, the placement ghost
 * refuses them, and the server refuses them again. Nothing about what the player
 * has PUT anywhere is an input — windows used to dodge whatever was already hung,
 * which meant hanging a picture slid a window along the wall.
 *
 * The great room gets a window per Warmth level; the smaller rooms get one, and a
 * second once the track is finished. They go on the wall a room faces — its back
 * run — and on a side wall for a room tucked in behind another, which has no
 * outward-facing back wall and would otherwise never see daylight.
 */
export function windowTilesOf(layout: Rect & { rooms?: LaidRoom[]; openings?: Set<string> }, light: number) {
	const out = new Set<string>();
	if (light < 2) return out; // Warmth 1 is a house with no windows at all
	const outward = new Map<string, { x: number; y: number }[]>();
	for (const w of wallTilesOf(layout)) {
		const owner = wallRoomOf(layout, w.x, w.y);
		if (!owner) continue;
		const list = outward.get(owner.id);
		if (list) list.push(w);
		else outward.set(owner.id, [w]);
	}
	roomsOf(layout).forEach((room) => {
		const all = outward.get(room.id) || [];
		const back = all.filter((w) => isBackWall(layout, w.x, w.y));
		const run = back.length ? back : all;
		if (!run.length) return;
		// A third of the run, at most — the wall is somewhere to HANG things, and a
		// room that is mostly glass has nowhere left to put a picture. Within that
		// ceiling the first window arrives at Warmth 2 and one more every two levels
		// after, so every room is lit early, the track keeps paying, and the house
		// never ends up glazed: better than four fifths of every wall stays bare at
		// Warmth 7, on every plan.
		const want = Math.min(Math.max(1, Math.floor(run.length / 3)), 1 + Math.floor((light - 2) / 2));
		for (let k = 0; k < want; k++) {
			// Spread them down the middle of the run rather than at k/(want+1) of it,
			// which bunched the last two together on a short wall.
			const idx = Math.max(0, Math.min(run.length - 1, Math.round(((k + 0.5) * run.length) / want - 0.5)));
			out.add(`${run[idx].x},${run[idx].y}`);
		}
	});
	return out;
}

/**
 * Where a piece aimed at (tx, ty) actually hangs: that tile when it is free, and
 * otherwise the nearest wall tile that is. null when there is nowhere left.
 *
 * A wall tile can already be spoken for in two ways — a window is in it, or
 * something else is hanging there — and neither is worth refusing a click over.
 * Both are things the player can see, and "it went to the next spot along" is a
 * result; "no" is not. Ties break in reading order, because wallTilesOf is in
 * reading order and the scan keeps the first of an equal pair — so the client's
 * preview and the server's answer are the same tile, every time.
 */
export function nearestHangSpot(
	layout: Rect & { rooms?: LaidRoom[]; openings?: Set<string>; windows?: Set<string> },
	tx: number,
	ty: number,
	taken: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
	if (canHangAt(layout, tx, ty) && !taken(tx, ty)) return { x: tx, y: ty };
	let best: { x: number; y: number } | null = null;
	let bestD = Infinity;
	for (const w of wallTilesOf(layout)) {
		if (!canHangAt(layout, w.x, w.y) || taken(w.x, w.y)) continue;
		const d = (w.x - tx) ** 2 + (w.y - ty) ** 2;
		if (d < bestD) {
			bestD = d;
			best = w;
		}
	}
	return best;
}

/** True if the Warmth track has glazed this wall tile. */
export const hasWindow = (layout: { windows?: Set<string> }, tx: number, ty: number): boolean =>
	!!layout.windows?.has(`${tx},${ty}`);

/**
 * True if something may be HUNG on (tx, ty).
 *
 * The wall run, minus the windows in it. A painting and a window competing for
 * the same few pixels looked like a drawing mistake, and between the two it is
 * the window that is part of the house: it stays, and the picture finds another
 * spot. Both halves of the game ask this, so the ghost turns red over exactly
 * the tiles the server will refuse.
 */
export function canHangAt(
	layout: Rect & { rooms?: LaidRoom[]; openings?: Set<string>; windows?: Set<string> },
	tx: number,
	ty: number,
): boolean {
	return isWallTile(layout, tx, ty) && !hasWindow(layout, tx, ty);
}

/** The rooms of a laid-out interior; tolerates a bare rectangle (old callers and
 *  tests hand one in), which reads as a single room. */
export function roomsOf(layout: Rect & { rooms?: LaidRoom[] }): LaidRoom[] {
	return layout.rooms?.length
		? layout.rooms
		: [{ id: ROOM_MAIN, name: 'Room', x0: layout.x0, y0: layout.y0, x1: layout.x1, y1: layout.y1 }];
}

const inRect = (r: Rect, tx: number, ty: number) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;

/** The room whose floor covers (tx, ty), or null if that tile is not floor. */
export function roomAt(layout: Rect & { rooms?: LaidRoom[] }, tx: number, ty: number): LaidRoom | null {
	for (const r of roomsOf(layout)) if (inRect(r, tx, ty)) return r;
	return null;
}

/** True if (tx, ty) is floor you can stand something on. */
export function isFloorTile(layout: Rect & { rooms?: LaidRoom[] }, tx: number, ty: number): boolean {
	return !!roomAt(layout, tx, ty);
}

/** True if (tx, ty) is a doorway cut through an interior wall. */
export function isOpening(layout: { openings?: Set<string> }, tx: number, ty: number): boolean {
	return !!layout.openings?.has(`${tx},${ty}`);
}

/** True if you can walk on (tx, ty): floor, an interior doorway, or the exit
 *  threshold one row below the door. */
export function isWalkable(layout: HomeLayout | (Rect & { doorX: number; doorY: number }), tx: number, ty: number) {
	const l = layout as HomeLayout;
	if (tx === l.doorX && ty === l.doorY + 1) return true;
	return isFloorTile(l, tx, ty) || isOpening(l, tx, ty);
}

/**
 * True if (tx, ty) is a wall tile you may hang something on.
 *
 * The old rule — back run and the two side runs, no corners, never the door wall
 * — falls out of one count once you stop assuming a rectangle. A hangable wall
 * is a tile that is NOT floor and has EXACTLY ONE floor tile beside it, and that
 * floor is not above it:
 *
 *  • exactly one  → a corner (no floor beside it, or floor on two sides) is out,
 *                   and so is the single tile of wall shared between two rooms —
 *                   it has a room on either side and belongs wholly to neither.
 *  • not above    → the bottom run, the one carrying the door and sitting between
 *                   the camera and the room, is out. Anything hung there is behind
 *                   the caretaker's own back.
 *
 * For a single rectangle this picks out exactly the tiles the rectangle version
 * did. A doorway is a hole, not a wall, so nothing hangs on one.
 */
export function isWallTile(layout: Rect & { rooms?: LaidRoom[]; openings?: Set<string> }, tx: number, ty: number) {
	if (isFloorTile(layout, tx, ty) || isOpening(layout, tx, ty)) return false;
	const above = isFloorTile(layout, tx, ty - 1);
	if (above) return false;
	let n = 0;
	if (isFloorTile(layout, tx, ty + 1)) n++;
	if (isFloorTile(layout, tx - 1, ty)) n++;
	if (isFloorTile(layout, tx + 1, ty)) n++;
	return n === 1;
}

/** Every hangable wall tile, in reading order (back runs before side runs of the
 *  same row), so "the first free wall" is a stable, sensible spot. */
export function wallTilesOf(layout: Rect & { rooms?: LaidRoom[]; openings?: Set<string> }): { x: number; y: number }[] {
	const out: { x: number; y: number }[] = [];
	for (let y = layout.y0 - 1; y <= layout.y1 + 1; y++)
		for (let x = layout.x0 - 1; x <= layout.x1 + 1; x++) if (isWallTile(layout, x, y)) out.push({ x, y });
	return out;
}

/**
 * The room a wall tile belongs to — whose paint it wears.
 *
 * A wall is owned by the room it faces. The one tile of wall SHARED between two
 * rooms faces both, and can only be one color: it goes to whichever room comes
 * first in the plan, so the great room's walls stay one color and the little
 * room borrows the divider. Corners face nothing directly and take the nearest
 * room diagonally.
 */
export function wallRoomOf(layout: Rect & { rooms?: LaidRoom[] }, tx: number, ty: number): LaidRoom | null {
	const rooms = roomsOf(layout);
	for (const r of rooms)
		if (inRect(r, tx, ty + 1) || inRect(r, tx, ty - 1) || inRect(r, tx - 1, ty) || inRect(r, tx + 1, ty)) return r;
	for (const r of rooms)
		if (
			inRect(r, tx - 1, ty - 1) ||
			inRect(r, tx + 1, ty - 1) ||
			inRect(r, tx - 1, ty + 1) ||
			inRect(r, tx + 1, ty + 1)
		)
			return r;
	return rooms[0] || null;
}

/** True if this wall tile carries the ceiling edge you see — floor directly
 *  below it. The back runs, in other words: where trim, shadow and windows go. */
export const isBackWall = (layout: Rect & { rooms?: LaidRoom[] }, tx: number, ty: number) =>
	!isFloorTile(layout, tx, ty) && isFloorTile(layout, tx, ty + 1);

/** Total floor tiles — what the upgrade menu quotes as the size of the place. */
export const floorTilesOf = (layout: Rect & { rooms?: LaidRoom[] }) =>
	roomsOf(layout).reduce((n, r) => n + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0);

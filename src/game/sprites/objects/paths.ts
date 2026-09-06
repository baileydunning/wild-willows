// Paths — the one placeable that is the ground rather than a thing standing on it.
//
// Every other object gets a little deterministic character when it's placed: a
// flip, a few degrees of lean, a size and shade jitter, so a hedgerow of six
// bushes doesn't look stamped. Applied to a walkway that same jitter is exactly
// wrong — it turned a path into a row of separate wobbling pills, each a
// slightly different brown, with grass showing between them. So paths are drawn
// tile-shaped and edge-aware (see ../tiles.ts) and buildPlacement skips the
// variation for them.
//
// Each material is a rim colour, a surface colour, and the grain drawn on top.
// The grain is given the box it may draw in — the surface inset from the OPEN
// edges only — so it runs right up to the seam with a connected neighbour and
// stops short of the rounded outside edge, without any clipping.

import Phaser from 'phaser';
import { C, tex } from '../canvas';
import type { G } from '../canvas';
import { CONN_E, CONN_N, CONN_S, CONN_W, fillLayer, insetBox } from '../tiles';
import type { Conn } from '../tiles';

/** The shapes drawn by this module. WorldScene asks this to decide whether a
 *  placement is a piece of ground (edge-aware, no jitter, drawn flat under
 *  everything) or an object standing on it. */
export const PATH_SHAPES = new Set(['path', 'gravel', 'planks', 'flagstone', 'mossy', 'seaglasspath']);

/** Texture key for one path tile shape. */
export const pathTileKey = (shape: string, m: Conn) => `pathtile-${shape}-${m}`;

/** The area a material's grain may draw in, and how the run is oriented. */
interface Grain {
	x: number;
	y: number;
	w: number;
	h: number;
	/** The tile's own mask, for grain that wants to fill the surface rather than
	 *  scatter over it — `fillLayer` with this keeps it inside the rounded end. */
	m: Conn;
	/** True when the walkway runs north–south here — boards and worn lines that
	 *  have a direction follow it instead of always lying east–west. */
	vertical: boolean;
}

interface PathMaterial {
	/** The worn shoulder where the path meets open ground. */
	rim: string;
	/** The surface itself. */
	fill: string;
	detail: (g: G, b: Grain) => void;
}

/** Spread `n` deterministic points through a box — same every boot, and it
 *  scales with the box so a tile that reaches its neighbour is filled to the
 *  seam instead of leaving a bald strip. */
const spread = (b: Grain, pts: [number, number][]): [number, number][] =>
	pts.map(([u, v]) => [b.x + u * b.w, b.y + v * b.h]);

const MATERIALS: Record<string, PathMaterial> = {
	// flat stepping stones set into packed earth
	path: {
		rim: '#a89468',
		fill: '#c9b98a',
		detail: (g, b) => {
			g.fillStyle(C('#b5a578'), 1);
			for (const [x, y] of spread(b, [
				[0.24, 0.26],
				[0.7, 0.2],
				[0.5, 0.55],
				[0.22, 0.76],
				[0.78, 0.72],
			]))
				g.fillEllipse(x, y, 8.5, 7);
			g.fillStyle(C('#d8c99c'), 0.8);
			for (const [x, y] of spread(b, [
				[0.22, 0.22],
				[0.68, 0.16],
				[0.48, 0.5],
			]))
				g.fillEllipse(x, y, 4, 3);
		},
	},
	// crunchy pea gravel — no shape to align, so it just fills the box
	gravel: {
		rim: '#938d80',
		fill: '#bdb6a4',
		detail: (g, b) => {
			g.fillStyle(C('#9a948a'), 1);
			for (const [x, y] of spread(b, [
				[0.14, 0.2],
				[0.42, 0.36],
				[0.66, 0.16],
				[0.86, 0.44],
				[0.24, 0.62],
				[0.55, 0.74],
				[0.8, 0.82],
				[0.1, 0.88],
				[0.36, 0.08],
				[0.7, 0.58],
			]))
				g.fillCircle(x, y, 1.8);
			g.fillStyle(C('#d5cfc2'), 1);
			for (const [x, y] of spread(b, [
				[0.28, 0.3],
				[0.6, 0.5],
				[0.84, 0.24],
				[0.44, 0.86],
				[0.16, 0.5],
			]))
				g.fillCircle(x, y, 1.2);
		},
	},
	// boardwalk: the boards lie ACROSS the direction of travel, with the two
	// stringers they're nailed to running along it
	planks: {
		rim: '#6f5334',
		fill: '#8c6a42',
		detail: (g, b) => {
			const along = b.vertical ? b.h : b.w;
			const boards = Math.max(3, Math.round(along / 7));
			const step = along / boards;
			g.fillStyle(C('#a3814f'), 1);
			for (let i = 0; i < boards; i++) {
				const o = (b.vertical ? b.y : b.x) + i * step + 0.7;
				if (b.vertical) g.fillRect(b.x, o, b.w, step - 1.4);
				else g.fillRect(o, b.y, step - 1.4, b.h);
			}
			g.lineStyle(1, C('#7c5a3c'), 0.4);
			for (const t of [0.32, 0.68]) {
				if (b.vertical) g.lineBetween(b.x + t * b.w, b.y, b.x + t * b.w, b.y + b.h);
				else g.lineBetween(b.x, b.y + t * b.h, b.x + b.w, b.y + t * b.h);
			}
		},
	},
	// broad slabs, laid in a staggered bond. It is the JOINTS that are drawn, not
	// the slabs: they run edge to edge, so they carry on into the next tile
	// instead of boxing every tile in its own little 2×2 of stones — which is
	// what made this material, more than any other, read as a grid.
	flagstone: {
		rim: '#7c7c76',
		fill: '#9a948a',
		detail: (g, b) => {
			g.fillStyle(C('#a6a69e'), 1);
			fillLayer(g, b.m, 4.5, 6); // one continuous slab face
			const line = (u1: number, v1: number, u2: number, v2: number) =>
				g.lineBetween(b.x + u1 * b.w, b.y + v1 * b.h, b.x + u2 * b.w, b.y + v2 * b.h);
			g.lineStyle(1.3, C('#78786f'), 0.75);
			if (b.vertical) {
				line(0.5, 0, 0.5, 1); // the joint running with the path
				line(0, 0.26, 0.5, 0.26); // courses, offset half a slab side to side
				line(0.5, 0.6, 1, 0.6);
				line(0, 0.86, 0.5, 0.86);
			} else {
				line(0, 0.5, 1, 0.5);
				line(0.26, 0, 0.26, 0.5);
				line(0.6, 0.5, 0.6, 1);
				line(0.86, 0, 0.86, 0.5);
			}
		},
	},
	// old stones the wet ground has grown moss over
	mossy: {
		rim: '#6f7a62',
		fill: '#8e8e8a',
		detail: (g, b) => {
			g.fillStyle(C('#a8a8a2'), 1);
			for (const [x, y] of spread(b, [
				[0.26, 0.3],
				[0.72, 0.26],
				[0.5, 0.62],
				[0.16, 0.76],
				[0.84, 0.74],
			]))
				g.fillCircle(x, y, 5);
			g.fillStyle(C('#5d8a4a'), 0.85);
			for (const [x, y] of spread(b, [
				[0.1, 0.5],
				[0.46, 0.16],
				[0.62, 0.86],
				[0.9, 0.46],
				[0.3, 0.9],
			]))
				g.fillCircle(x, y, 3);
			g.fillStyle(C('#74a85e'), 0.9);
			for (const [x, y] of spread(b, [
				[0.36, 0.44],
				[0.78, 0.56],
			]))
				g.fillCircle(x, y, 1.7);
		},
	},
	// tumbled glass pressed into the sand
	seaglasspath: {
		rim: '#c2ac7e',
		fill: '#dcc890',
		detail: (g, b) => {
			const bits: [number, number, string][] = [
				[0.2, 0.24, '#8fc6c2'],
				[0.48, 0.42, '#a9d8d0'],
				[0.74, 0.2, '#bcd8e6'],
				[0.86, 0.6, '#9fd0cc'],
				[0.3, 0.68, '#8fc6c2'],
				[0.6, 0.84, '#a9d8d0'],
				[0.12, 0.48, '#bcd8e6'],
			];
			for (const [u, v, c] of bits) {
				g.fillStyle(C(c), 0.95);
				g.fillRoundedRect(b.x + u * b.w - 2.2, b.y + v * b.h - 2.2, 4.5, 4.5, 1);
			}
		},
	},
};

function drawPath(g: G, mat: PathMaterial, m: Conn) {
	g.fillStyle(C(mat.rim), 1);
	fillLayer(g, m, 0, 9); // worn shoulder, only ever visible on an open edge
	g.fillStyle(C(mat.fill), 1);
	fillLayer(g, m, 2, 7.5);
	// 4.5 is the smallest inset at which grain drawn right to the box edge still
	// sits inside the tile's rounded end cap, so nothing spills onto the rim.
	const box = insetBox(m, 4.5);
	mat.detail(g, {
		...box,
		m,
		// A dead end or a lone stone counts as east–west, which is how a single
		// piece has always looked in the crafting menu.
		vertical: !!(m & (CONN_N | CONN_S)) && !(m & (CONN_E | CONN_W)),
	});
}

/**
 * The tile shape one path piece needs, rasterized the first time it is asked
 * for.
 *
 * Six materials × sixteen shapes is ninety-six textures, and a preserve
 * typically uses one material and half a dozen shapes — so these are generated
 * on demand, the same way the composed animal sprites are, rather than uploaded
 * to the GPU at boot for paths nobody has crafted.
 */
export function ensurePathTile(scene: Phaser.Scene, shape: string, m: Conn): string {
	const mat = MATERIALS[shape];
	if (!mat) return `obj-${shape}`; // not a path after all — let the caller's fallback handle it
	const key = pathTileKey(shape, m);
	tex(scene, key, 32, 32, (g) => drawPath(g, mat, m));
	return key;
}

/**
 * The isolated tile of each material, under its plain `obj-` key.
 *
 * That key is what the crafting and planting menus snapshot for their icons, so
 * the icon is the real "one piece on its own" tile rather than a separate
 * drawing that could drift from it — which is why these six are registered at
 * boot, before the snapshot runs, while the shapes above are not.
 */
export function makePathTextures(scene: Phaser.Scene) {
	for (const [shape, mat] of Object.entries(MATERIALS)) tex(scene, `obj-${shape}`, 32, 32, (g) => drawPath(g, mat, 0));
}

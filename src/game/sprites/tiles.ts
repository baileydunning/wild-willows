// Ground that knows its neighbours.
//
// Water and paths are the two surfaces a player builds in RUNS, and both used
// to be drawn as one self-contained rounded stamp per tile. Four water tiles in
// a row therefore read as four puddles with pinched waists between them, never
// as one pond, and a walkway read as a line of separate pills with grass showing
// through the gaps. This module is the fix, and it is deliberately the smallest
// one that works.
//
// The trick: draw every tile FULL-BLEED (32×32, no margin) and let the
// neighbour mask decide one thing only — which corners are rounded, and which
// edges the inner colour bands are inset from. A corner is rounded only when
// BOTH edges touching it are open, so two tiles that share an edge meet square,
// with the same colour arriving at the seam from both sides. The outline and the
// shoreline shading then exist only on the outside of the shape, which is what
// makes a run look like one object.
//
// That is 16 textures per surface (N/E/S/W), not the 47 a full blob set needs.
// The cases a 47-set adds are the diagonal ones — two tiles touching only at a
// corner. Here they simply stay rounded and touch, which for water and stone
// reads fine, and it keeps both the texture memory and the boot-time rasterizing
// at a sixteenth of what per-tile art would cost.

import Phaser from 'phaser';
import { C, tex } from './canvas';
import type { G } from './canvas';

/** Neighbour bits. The order is only a convention, but every mask built in the
 *  scene has to use this one. */
export const CONN_N = 1;
export const CONN_E = 2;
export const CONN_S = 4;
export const CONN_W = 8;
/** A neighbour mask: 0 (alone) through 15 (surrounded). */
export type Conn = number;

/** Build a mask from four "is my neighbour the same surface?" answers. */
export const connOf = (n: boolean, e: boolean, s: boolean, w: boolean): Conn =>
	(n ? CONN_N : 0) | (e ? CONN_E : 0) | (s ? CONN_S : 0) | (w ? CONN_W : 0);

/** Per-corner radii: square wherever the surface continues into a neighbour,
 *  rounded only where it actually ends. */
export function cornersOf(m: Conn, r: number) {
	return {
		tl: m & CONN_N || m & CONN_W ? 0 : r,
		tr: m & CONN_N || m & CONN_E ? 0 : r,
		bl: m & CONN_S || m & CONN_W ? 0 : r,
		br: m & CONN_S || m & CONN_E ? 0 : r,
	};
}

/** The rectangle a layer inset by `inset` covers — pulled in on the OPEN sides
 *  only, so the band it draws appears along the shore and nowhere else, and the
 *  layer runs clean into the neighbour on every connected side. */
export function insetBox(m: Conn, inset: number) {
	const x = m & CONN_W ? 0 : inset;
	const y = m & CONN_N ? 0 : inset;
	return { x, y, w: 32 - x - (m & CONN_E ? 0 : inset), h: 32 - y - (m & CONN_S ? 0 : inset) };
}

/** Fill one inset layer of a connected tile. Call these outside-in: the first
 *  is the rim at the shore, the last is the middle of the surface. */
export function fillLayer(g: G, m: Conn, inset: number, r: number) {
	const b = insetBox(m, inset);
	const c = cornersOf(m, r);
	if (!c.tl && !c.tr && !c.bl && !c.br) g.fillRect(b.x, b.y, b.w, b.h);
	else g.fillRoundedRect(b.x, b.y, b.w, b.h, c);
}

/** Texture key for one water tile shape. */
export const waterTileKey = (m: Conn) => `terrain-water-${m}`;

/**
 * Open water, one shape at a time.
 *
 * Two rules, and they pull against each other. Neighbouring tiles have to put
 * the same colour on both sides of a shared edge or the grid shows through —
 * that is the whole point of the mask. But a surface with nothing on it stops
 * reading as water and starts reading as a painted trough, which is exactly
 * what a first pass at this produced: four concentric colour bands, a hard
 * outline, and a still, flat middle.
 *
 * So the tile itself carries only what the SHORE needs — a thin waterline and a
 * pale shelf where the bank shelves in, inset on the open sides only — and the
 * open water is one flat colour, the same `#5d96c8` the crafted pond holds, so
 * a dug channel and a built pond are the same blue. Everything that makes it
 * look wet (ripples, glints, drift) is a per-tile sprite over the top, because
 * anything baked in here repeats every 32px and turns a big pond into graph
 * paper.
 *
 * Rasterized on demand, like the generated animal sprites: sixteen shapes for
 * every surface is a lot of texture to upload at boot for a biome that may have
 * no water in it at all, and a pond only ever uses the handful of shapes its own
 * outline needs.
 */
export function ensureWaterTile(scene: Phaser.Scene, m: Conn): string {
	const key = waterTileKey(m);
	tex(scene, key, 32, 32, (g) => {
		g.fillStyle(C('#3f6f96'), 1);
		fillLayer(g, m, 0, 6); // the waterline, a thin dark edge against the bank
		g.fillStyle(C('#8fc0e0'), 1);
		fillLayer(g, m, 1.2, 5); // pale shallows where you can see the bottom
		g.fillStyle(C('#5d96c8'), 1);
		fillLayer(g, m, 4.5, 3.5); // open water — every tile more than a step from a bank
	});
	return key;
}

/**
 * The surface: four ripple shapes, scattered one per water tile and flipped and
 * offset by that tile's own hash, so the detail is everywhere without ever
 * repeating on a 32px beat.
 *
 * Cheap, and needed the moment any water is drawn, so unlike the tile shapes
 * these are registered at boot. They are drawn in the same pale blue and white
 * the old single water tile used, because that highlight is what read as water.
 */
export function makeWaterDetailTextures(scene: Phaser.Scene) {
	tex(scene, 'water-ripple0', 22, 12, (g) => {
		g.lineStyle(2, C('#8fc0e0'), 0.8).lineBetween(2, 4, 11, 4).lineBetween(8, 9, 19, 9);
	});
	tex(scene, 'water-ripple1', 22, 12, (g) => {
		g.lineStyle(2, C('#8fc0e0'), 0.75).lineBetween(3, 7, 14, 7);
		g.fillStyle(0xffffff, 0.5).fillCircle(18, 3, 1.6);
	});
	tex(scene, 'water-ripple2', 22, 12, (g) => {
		g.lineStyle(1.8, C('#8fc0e0'), 0.7).lineBetween(2, 3, 8, 3).lineBetween(11, 6, 17, 6).lineBetween(5, 10, 13, 10);
	});
	tex(scene, 'water-ripple3', 22, 12, (g) => {
		g.lineStyle(2, C('#a8d2ea'), 0.7).lineBetween(4, 8, 16, 8);
		g.fillStyle(0xffffff, 0.45).fillCircle(7, 3, 1.4).fillCircle(15, 4, 1.1);
	});
}

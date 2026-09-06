// The lights a caretaker hangs — the two that come in RUNS.
//
// String lights and the meadow's lantern row are placed tile by tile, but what
// the player is making is one continuous line. Drawn as a self-contained sprite
// each, a row of six read as six separate little swags with a gap and a pair of
// posts between every one. So these are edge-aware, the way paths are (see
// ../tiles.ts): the cord leaves at the tile edge exactly where the neighbour's
// arrives, and the posts are drawn only where the run actually ends.
//
// Only the run axis matters here, so it is two bits rather than four: a light is
// joined to the west, to the east, both, or stands alone.

import Phaser from 'phaser';
import { C, def, tex } from '../canvas';
import { CONN_E, CONN_W } from '../tiles';
import type { G, SpriteDef, SpriteSet } from '../canvas';
import type { Conn } from '../tiles';

/** Shapes that join up into a run instead of standing on their own. */
export const RUN_SHAPES = new Set(['lanternstring', 'lanternrow']);

/**
 * Everything a caretaker hangs, sets or stands to make light — wherever its
 * sprite happens to live. These are lamps, not fires: after dusk each holds a
 * small, steady pool of its own against the night tint (WorldScene's night
 * lights), a fraction of what a campfire pushes back.
 */
export const LIT_SHAPES = new Set([
	'lanternstring',
	'lanternrow',
	'lantern',
	'dewlantern',
	'crystallantern',
	'seaglasslantern',
	'stormglasslantern',
]);

/** Texture key for one piece of a run. */
export const runTileKey = (shape: string, m: Conn) => `runtile-${shape}-${m & (CONN_E | CONN_W)}`;

/** A point on the cord's sag: a quadratic curve whose middle dips by `d`. */
const cord = (x1: number, y1: number, x2: number, y2: number, d: number) => {
	const cx = (x1 + x2) / 2,
		cy = (y1 + y2) / 2 + 2 * d;
	return (t: number) => ({
		x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2,
		y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2,
	});
};

/** Draw a sagging cord as short segments — Graphics and the SVG writer both
 *  only know straight lines, and 10 of them read as a curve at this size. */
const drawCord = (g: G, at: (t: number) => { x: number; y: number }, w: number, colour: string) => {
	g.lineStyle(w, C(colour), 1);
	let p = at(0);
	for (let i = 1; i <= 10; i++) {
		const q = at(i / 10);
		g.lineBetween(p.x, p.y, q.x, q.y);
		p = q;
	}
};

/**
 * String lights: overhead, on a wire strung post to post, in party colours.
 * The wire leaves both edges at the same height, so tile meets tile in one long
 * scalloped run.
 */
const drawStringLights = (g: G, m: Conn) => {
	const openW = !(m & CONN_W),
		openE = !(m & CONN_E);
	const post = (x: number) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(x - 1.4, 9, 2.8, 27); // pole, into the ground
		g.fillStyle(C('#7c5a3c'), 1).fillCircle(x, 9, 2.2); // the knob the wire ties off on
	};
	if (openW) post(5);
	if (openE) post(27);
	const x1 = openW ? 5 : 0,
		x2 = openE ? 27 : 32;
	const at = cord(x1, 9, x2, 9, 4.5);
	drawCord(g, at, 1.3, '#6b5238');
	const bulb = (t: number, colour: string) => {
		const p = at(t);
		g.lineStyle(1, C('#6b5238'), 1).lineBetween(p.x, p.y, p.x, p.y + 3);
		g.fillStyle(C(colour), 1).fillRoundedRect(p.x - 2.6, p.y + 3, 5.2, 7.6, 2.6);
		g.fillStyle(0xffffff, 0.45).fillCircle(p.x - 0.8, p.y + 5.6, 1.1); // the lit side
	};
	// Three to a tile where the wire runs edge to edge, evenly enough that the
	// gap across a seam matches the gaps inside a tile; two on the shorter span
	// that ties off at a post.
	const stops: [number, string][] =
		openW || openE
			? [
					[0.3, '#e8954f'],
					[0.7, '#7fb4d8'],
				]
			: [
					[1 / 6, '#e8954f'],
					[0.5, '#e3c75f'],
					[5 / 6, '#7fb4d8'],
				];
	for (const [t, c] of stops) bulb(t, c);
};

/**
 * The meadow's lantern row: the same idea hung at knee height on a woven cord,
 * all warm amber rather than party colours — low light the moths will settle on.
 */
const drawLanternRow = (g: G, m: Conn) => {
	const openW = !(m & CONN_W),
		openE = !(m & CONN_E);
	const stake = (x: number) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(x - 1.2, 11, 2.4, 13); // short stake
		g.fillStyle(C('#6f9a4a'), 1).fillEllipse(x, 24, 9, 4); // grass at its foot
		g.fillStyle(C('#a3814f'), 1).fillCircle(x, 11, 1.8);
	};
	if (openW) stake(5);
	if (openE) stake(27);
	const x1 = openW ? 5 : 0,
		x2 = openE ? 27 : 32;
	const at = cord(x1, 11, x2, 11, 3);
	drawCord(g, at, 1.6, '#a3814f'); // woven cord: a pale strand…
	drawCord(g, (t) => ({ x: at(t).x, y: at(t).y + 0.9 }), 0.9, '#8c6a42'); // …twisted with a dark one
	const lantern = (t: number) => {
		const p = at(t);
		g.lineStyle(1, C('#8c6a42'), 1).lineBetween(p.x, p.y, p.x, p.y + 2.5);
		g.fillStyle(C('#e8a54f'), 1).fillRoundedRect(p.x - 3, p.y + 2.5, 6, 2, 1); // paper cap
		g.fillStyle(C('#f0c46a'), 1).fillEllipse(p.x, p.y + 7.5, 7, 9); // the paper globe
		g.fillStyle(C('#ffe6a8'), 1).fillEllipse(p.x, p.y + 7.5, 4, 6); // lit through the paper
		g.fillStyle(0xffffff, 0.5).fillCircle(p.x - 1.2, p.y + 5.6, 1);
	};
	for (const t of [0.25, 0.75]) lantern(t); // evenly spaced whether or not it ties off here
	// One moth, at the end of the run rather than over every tile of it.
	if (openE) {
		g.fillStyle(C('#efe6cf'), 0.9).fillEllipse(23.4, 6.4, 3.4, 2.2).fillEllipse(25.4, 5.6, 3, 2);
		g.fillStyle(C('#c9b98a'), 1).fillCircle(24.4, 6.2, 0.9);
	}
};

interface RunSprite extends Omit<SpriteDef, 'draw'> {
	draw: (g: G, m: Conn) => void;
}

/** The runs, by shape: size plus a draw that takes the joint it is drawing. */
export const RUN_SPRITES: Record<string, RunSprite> = {
	lanternstring: { w: 32, h: 36, draw: drawStringLights },
	lanternrow: { w: 32, h: 26, draw: drawLanternRow },
};

/**
 * The alone-in-the-world version of each run, under its plain `obj-` key.
 *
 * That is the key the crafting menu snapshots for its icon, so the picture in
 * the menu is the real sprite rather than a second drawing that could drift from
 * it — the same bargain paths make (see paths.ts).
 */
export const LIGHTS: SpriteSet = Object.fromEntries(
	Object.entries(RUN_SPRITES).map(([shape, s]) => [shape, def(s.w, s.h, (g) => s.draw(g, 0))]),
);

/** The texture for one piece of a run, built on first sight of that joint. */
export function ensureRunTile(scene: Phaser.Scene, shape: string, m: Conn): string {
	const s = RUN_SPRITES[shape];
	if (!s) return `obj-${shape}`; // not a run after all — the caller's fallback handles it
	const key = runTileKey(shape, m);
	tex(scene, key, s.w, s.h, (g) => s.draw(g, m & (CONN_E | CONN_W)));
	return key;
}

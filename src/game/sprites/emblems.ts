// Achievement emblems: the handful of achievement pictures that stand for
// something no single sprite in the world can — a whole area restored, three
// biomes healthy, a hundred animals welcomed home.
//
// Every OTHER achievement shows the real thing (see ui/achievementArt): the
// game's own fox, its own cattails, its own watering can. These are drawn with
// the same commands and the same palette so they sit in the same set — flat
// filled shapes, a soft ground under whatever stands on it, no outlines.

import { C, def } from './canvas';
import type { G, SpriteSet } from './canvas';
import { spriteDataUri } from './svg';

/** The sun that crowns a restored area — same disc, painted for its biome. */
const sun = (g: G, x: number, y: number, core: string, ring: string) => {
	g.fillStyle(C(ring), 1).fillCircle(x, y, 8.6);
	g.fillStyle(C(core), 1).fillCircle(x, y, 6.4);
	g.fillStyle(0xfff3c4, 0.85).fillCircle(x - 1.8, y - 2, 2.6);
};

/** One snowcapped peak: lit face, shaded face, snow. */
const peak = (g: G, x: number, base: number, w: number, h: number, lit: string, shade: string) => {
	g.fillStyle(C(shade), 1).fillTriangle(x - w, base, x, base - h, x + w, base);
	g.fillStyle(C(lit), 1).fillTriangle(x - w, base, x, base - h, x - w * 0.1, base);
	const sw = w * 0.34,
		sh = h * 0.3;
	g.fillStyle(C('#eef2f5'), 1).fillTriangle(x - sw, base - h + sh, x, base - h, x + sw, base - h + sh);
};

/** A single leaf, drawn from its stem end — the shape the whole set shares. */
const leaf = (g: G, x: number, y: number, rx: number, ry: number, fill: string, vein: string) => {
	g.fillStyle(C(fill), 1).fillEllipse(x, y, rx * 2, ry * 2);
	g.lineStyle(1, C(vein), 0.85).lineBetween(x - rx * 0.8, y, x + rx * 0.8, y);
};

/** A leaf as a pointed oval drawn along any axis — the fanned sets need angles. */
const leafPoly = (g: G, bx: number, by: number, tx: number, ty: number, w: number, fill: string, vein: string) => {
	const dx = tx - bx,
		dy = ty - by;
	const len = Math.hypot(dx, dy) || 1;
	const nx = (-dy / len) * w,
		ny = (dx / len) * w;
	const mx = bx + dx * 0.45,
		my = by + dy * 0.45;
	g.fillStyle(C(fill), 1).fillPoints([
		{ x: bx, y: by },
		{ x: mx + nx, y: my + ny },
		{ x: tx, y: ty },
		{ x: mx - nx, y: my - ny },
	]);
	g.lineStyle(1, C(vein), 0.8).lineBetween(bx, by, tx, ty);
};

/** A bar of any thickness along any axis — handles, hafts, a mallet's head. */
const bar = (g: G, x1: number, y1: number, x2: number, y2: number, w: number, fill: string) => {
	const dx = x2 - x1,
		dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	const nx = (-dy / len) * (w / 2),
		ny = (dx / len) * (w / 2);
	g.fillStyle(C(fill), 1).fillPoints([
		{ x: x1 + nx, y: y1 + ny },
		{ x: x2 + nx, y: y2 + ny },
		{ x: x2 - nx, y: y2 - ny },
		{ x: x1 - nx, y: y1 - ny },
	]);
};

export const EMBLEMS: SpriteSet = {
	// ---- an area brought all the way back: its sun over its own ground ----
	'sun-meadow': def(36, 32, (g) => {
		sun(g, 18, 12, '#e3c75f', '#f0dd8f');
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 27, 34, 12); // meadow rise
		g.fillStyle(C('#5f9440'), 1).fillEllipse(9, 29, 16, 7);
		g.lineStyle(1.2, C('#4f8a38'), 1).lineBetween(7, 26, 6, 21).lineBetween(29, 26, 30, 21);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(13, 22.5, 1.8);
		g.fillStyle(C('#e8954f'), 1).fillCircle(23, 23, 1.8);
	}),
	'sun-marsh': def(36, 32, (g) => {
		sun(g, 18, 11, '#e8cf74', '#f2e3a6');
		g.fillStyle(C('#5f9fb0'), 1).fillEllipse(18, 26, 34, 13); // open water
		g.fillStyle(C('#7fbccb'), 1).fillEllipse(18, 24.5, 30, 9);
		g.lineStyle(1, C('#5f9fb0'), 0.9).lineBetween(9, 27.5, 17, 27.5).lineBetween(21, 29.5, 28, 29.5);
		// two cattails standing in it
		[8, 28].forEach((x, i) => {
			g.lineStyle(1.4, C('#6f9a4a'), 1).lineBetween(x, 24, x, 12 + i * 2);
			g.fillStyle(C('#8a6330'), 1).fillRoundedRect(x - 1.3, 10 + i * 2, 2.6, 6, 1.3);
		});
	}),
	'sun-desert': def(36, 32, (g) => {
		sun(g, 24, 9, '#e8a54f', '#f2c98a');
		g.fillStyle(C('#c98a52'), 1).fillEllipse(18, 27, 34, 12); // sand
		g.fillStyle(C('#e0c98a'), 1).fillEllipse(18, 25.5, 28, 8);
		g.fillStyle(C('#b5703a'), 1).fillRoundedRect(24, 17, 9, 8, 2); // redstone mesa
		g.fillStyle(C('#9a5c30'), 1).fillRect(24, 20.5, 9, 1.6);
		g.fillStyle(C('#6f8a5a'), 1).fillRoundedRect(8, 11, 4, 14, 2); // saguaro, one arm up
		g.fillStyle(C('#6f8a5a'), 1).fillRoundedRect(4, 15, 3.2, 6, 1.6).fillRoundedRect(4, 18.5, 7, 3, 1.5);
		g.fillStyle(C('#5f7a4a'), 1).fillRect(9.4, 12, 1, 12);
	}),

	// ---- the heights: one peak reached, then the whole range ----
	peak: def(32, 30, (g) => {
		g.fillStyle(C('#8e949e'), 0.45).fillEllipse(16, 27, 28, 5); // haze at the base
		peak(g, 16, 26, 12, 20, '#98a0aa', '#6a7486');
	}),
	range: def(36, 30, (g) => {
		peak(g, 8, 26, 8, 12, '#a8b0ba', '#7c8694');
		peak(g, 28, 26, 8, 13, '#a8b0ba', '#7c8694');
		peak(g, 18, 27, 11, 19, '#98a0aa', '#6a7486');
	}),

	// ---- the preserve at large ----
	paws: def(32, 30, (g) => {
		const paw = (x: number, y: number, s: number, c: string) => {
			g.fillStyle(C(c), 1).fillEllipse(x, y, 8 * s, 6.6 * s);
			[
				[-3, -4.4],
				[-1, -6],
				[1.4, -6],
				[3.4, -4.2],
			].forEach(([dx, dy]) => g.fillCircle(x + dx * s, y + dy * s, 1.5 * s));
		};
		paw(9, 21, 1, '#8a6330');
		paw(21, 12, 0.9, '#a97a3e');
	}),
	'leaf-balance': def(34, 28, (g) => {
		g.fillStyle(C('#a97a3e'), 1).fillEllipse(17, 25, 18, 4.5); // foot
		g.fillStyle(C('#8a6330'), 1).fillTriangle(11, 24, 17, 12, 23, 24); // fulcrum
		g.fillStyle(C('#a97a3e'), 1).fillRoundedRect(3, 10, 28, 2.6, 1.3); // beam, dead level
		g.fillStyle(C('#8a6330'), 1).fillCircle(17, 11.3, 2.2); // pivot
		g.lineStyle(1, C('#8a6330'), 1).lineBetween(7, 12, 7, 14).lineBetween(27, 12, 27, 14);
		leafPoly(g, 7, 15, 3, 6, 3.2, '#7ab35c', '#4f8a38'); // a leaf riding each pan
		leafPoly(g, 27, 15, 31, 6, 3.2, '#7ab35c', '#4f8a38');
	}),
	'leaf-triple': def(34, 30, (g) => {
		g.fillStyle(C('#6f9a4a'), 0.55).fillEllipse(17, 26, 22, 5); // ground
		g.lineStyle(1.6, C('#5f8a3a'), 1).lineBetween(17, 26, 17, 18);
		leafPoly(g, 17, 19, 4, 11, 4.2, '#6b8f4e', '#4f7a38'); // out to the left
		leafPoly(g, 17, 19, 30, 11, 4.2, '#6b8f4e', '#4f7a38'); // out to the right
		leafPoly(g, 17, 19, 17, 4, 4.6, '#7ab35c', '#4f8a38'); // and straight up
	}),
	laurel: def(34, 32, (g) => {
		// leaves marching up each side of the wreath, meeting near the top
		const arc: [number, number, number][] = [
			[6, 24, 0.1],
			[4.6, 19, 0.45],
			[5, 14, 0.8],
			[7.2, 9.6, 1.15],
			[11, 6.5, 1.45],
		];
		[-1, 1].forEach((side) => {
			arc.forEach(([x, y, a], i) => {
				const cx = 17 + side * (x - 17);
				leafPoly(
					g,
					cx,
					y,
					cx + side * -Math.cos(a) * 6.5,
					y - Math.sin(a) * 6.5,
					2.6,
					i > 2 ? '#8fb46a' : '#6b8f4e',
					'#4f7a38',
				);
			});
		});
		g.fillStyle(C('#e3c75f'), 1).fillCircle(17, 17, 5.6); // the medal they frame
		g.fillStyle(C('#f0dd8f'), 1).fillCircle(17, 17, 3.6);
		g.fillStyle(C('#c9913f'), 1).fillCircle(17, 17, 1.6);
	}),
	mallet: def(32, 30, (g) => {
		bar(g, 6, 25, 19, 12, 3.6, '#8a6330'); // handle
		bar(g, 15, 8, 25, 18, 11, '#b98a4e'); // head, struck across it
		bar(g, 15, 8, 20, 13, 11, '#c99a5e'); // its lit half
		g.fillStyle(C('#a97a3e'), 1).fillCircle(19.8, 12.8, 1.4); // pin
		g.fillStyle(C('#e0c98a'), 0.9).fillEllipse(6, 10, 7, 3.4); // a curl of shaving
	}),
	kit: def(38, 28, (g) => {
		g.lineStyle(1.6, C('#8a6330'), 1).strokeEllipse(8, 13, 11, 7); // basket handle
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(3, 14, 10, 8, 2);
		g.fillStyle(C('#a97a3e'), 1).fillRect(3, 17, 10, 1.2);
		bar(g, 19, 6, 19, 17, 2.4, '#8a6330'); // shovel
		g.fillStyle(C('#8a6330'), 1).fillRoundedRect(17.2, 4.5, 3.6, 2.4, 1.2);
		g.fillStyle(C('#9aa0a6'), 1).fillTriangle(15.6, 17, 22.4, 17, 19, 24);
		g.fillStyle(C('#7fbccb'), 1).fillRoundedRect(26, 13, 9, 9, 2); // watering can
		g.fillStyle(C('#5f9fb0'), 1).fillRoundedRect(26, 13, 9, 2.4, 1.2);
		bar(g, 26, 16, 22, 13, 2, '#5f9fb0'); // spout
		g.lineStyle(1.6, C('#5f9fb0'), 1).strokeEllipse(33.5, 11.5, 6, 6); // handle
	}),
	sprout: def(30, 28, (g) => {
		g.fillStyle(C('#5d4128'), 1).fillEllipse(15, 22, 24, 9); // turned soil
		g.fillStyle(C('#6b4d30'), 1).fillEllipse(15, 20.5, 18, 5.5);
		g.lineStyle(1.6, C('#5f9e44'), 1).lineBetween(15, 21, 15, 10); // stem
		leaf(g, 9.5, 10, 5, 3.2, '#7ab35c', '#4f8a38');
		leaf(g, 20.5, 8, 5, 3.2, '#8fc46a', '#4f8a38');
	}),
};

/** One emblem as an SVG data URI, for the achievement panel. */
export function emblemSpriteDataUri(name: string, opts: { override?: string | null } = {}): string | null {
	const s = EMBLEMS[name];
	return s ? spriteDataUri(s, opts) : null;
}

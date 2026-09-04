// Furniture and decor for an interior — the home or a trail tent.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const INDOOR: SpriteSet = {
	// ---- indoor furniture (the home interior) ----
	rug: def(42, 30, (g) => {
		g.fillStyle(C('#b5707a'), 1).fillRoundedRect(3, 6, 36, 20, 6);
		g.fillStyle(C('#e3c75f'), 1).fillRoundedRect(7, 10, 28, 12, 4);
		g.fillStyle(C('#b5707a'), 1).fillRoundedRect(12, 13, 18, 6, 2);
	}),
	bed: def(42, 32, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 12, 34, 16, 3); // frame
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(6, 8, 13, 10, 3); // pillow
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(17, 13, 20, 13, 3); // blanket
		g.fillStyle(C('#5d3f28'), 1).fillRect(5, 26, 3, 4).fillRect(34, 26, 3, 4);
	}),
	bookshelf: def(34, 38, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(4, 3, 26, 32, 2);
		g.fillStyle(C('#5a3a26'), 1).fillRect(4, 15, 26, 2).fillRect(4, 25, 26, 2);
		const cols = ['#b5707a', '#7a9ac0', '#e3c75f', '#6da84e', '#c45ad0'];
		for (let r = 0; r < 3; r++)
			for (let i = 0; i < 5; i++) {
				g.fillStyle(C(cols[(i + r) % cols.length]), 1).fillRect(7 + i * 4, 6 + r * 10, 3, 7);
			}
	}),
	table: def(38, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(5, 10, 28, 7, 2); // top
		g.fillStyle(C('#6e4a33'), 1).fillRect(8, 16, 3, 10).fillRect(27, 16, 3, 10); // legs
		g.fillStyle(C('#e86a6a'), 1).fillCircle(19, 9, 3); // little vase
		g.fillStyle(C('#6da84e'), 1).fillRect(18, 4, 2, 4);
	}),
	armchair: def(34, 32, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(6, 24, 22, 5, 2); // base
		g.fillStyle(C('#8a5a6a'), 1).fillRoundedRect(5, 8, 24, 18, 5); // back
		g.fillStyle(C('#a86f80'), 1).fillRoundedRect(8, 16, 18, 10, 4); // cushion
		g.fillStyle(C('#8a5a6a'), 1).fillRoundedRect(4, 14, 5, 12, 3).fillRoundedRect(25, 14, 5, 12, 3); // arms
	}),
	fireplace: def(38, 36, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(4, 6, 30, 28, 3); // stone surround
		g.fillStyle(C('#3a2a22'), 1).fillRoundedRect(11, 16, 16, 16, 2); // firebox
		g.fillStyle(C('#e8954f'), 1).fillTriangle(15, 32, 19, 20, 23, 32); // flame
		g.fillStyle(C('#f3d24a'), 1).fillTriangle(17, 32, 19, 25, 21, 32);
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 12, 32, 3); // mantel
	}),
	lamp: def(26, 38, (g) => {
		g.fillStyle(C('#f3d98a'), 0.9).fillEllipse(13, 9, 20, 12); // shade
		g.fillStyle(C('#6e4a33'), 1).fillRect(12, 12, 2, 22); // pole
		g.fillStyle(C('#5a3f28'), 1).fillEllipse(13, 35, 14, 5); // base
	}),
	potplant: def(28, 34, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(10, 12, 7).fillCircle(18, 11, 7).fillCircle(14, 6, 7);
		g.fillStyle(C('#c47a3a'), 1).fillRoundedRect(8, 20, 12, 12, 2); // pot
		g.fillStyle(C('#a8652f'), 1).fillRect(7, 19, 14, 3);
	}),
	painting: def(34, 28, (g) => {
		g.fillStyle(C('#caa15e'), 1).fillRoundedRect(3, 3, 28, 22, 2); // frame
		g.fillStyle(C('#9cc6e0'), 1).fillRect(6, 6, 22, 16); // sky
		g.fillStyle(C('#6da84e'), 1).fillRect(6, 16, 22, 6); // hills
		g.fillStyle(C('#e3c75f'), 1).fillCircle(23, 11, 3); // sun
	}),
	sleepingbag: def(42, 26, (g) => {
		g.fillStyle(C('#5b7d9a'), 1).fillRoundedRect(4, 8, 34, 14, 6); // bag
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(7, 10, 17, 10, 5); // folded-open flap
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(29, 9, 9, 12, 4); // little pillow
		g.lineStyle(1, C('#456178'), 0.8).lineBetween(12, 9, 12, 21).lineBetween(18, 9, 18, 21);
	}),
	cushions: def(34, 24, (g) => {
		g.fillStyle(C('#c98a6a'), 1).fillRoundedRect(3, 10, 18, 12, 4);
		g.fillStyle(C('#7fae6a'), 1).fillRoundedRect(13, 6, 18, 13, 4);
		g.lineStyle(1, C('#000000'), 0.12).strokeRoundedRect(13, 6, 18, 13, 4);
	}),
	stool: def(26, 28, (g) => {
		g.fillStyle(C('#a86f80'), 1).fillEllipse(13, 10, 20, 9); // cushion top
		g.fillStyle(C('#6e4a33'), 1).fillRect(6, 13, 3, 12).fillRect(17, 13, 3, 12); // legs
	}),
	wallclock: def(26, 28, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillCircle(13, 14, 12);
		g.fillStyle(C('#f3ecd6'), 1).fillCircle(13, 14, 9);
		g.lineStyle(1.5, C('#3a3a2c'), 1).lineBetween(13, 14, 13, 8).lineBetween(13, 14, 18, 14);
	}),
	dresser: def(32, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(4, 6, 24, 22, 2);
		g.fillStyle(C('#6e4a33'), 1).fillRect(4, 15, 24, 2);
		g.fillStyle(C('#caa15e'), 1)
			.fillCircle(11, 11, 1.4)
			.fillCircle(21, 11, 1.4)
			.fillCircle(11, 21, 1.4)
			.fillCircle(21, 21, 1.4);
	}),
	mushroomshelf: def(32, 30, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(4, 8, 24, 3).fillRect(4, 20, 24, 3);
		g.fillStyle(C('#d9756a'), 1).fillEllipse(10, 7, 9, 5);
		g.fillStyle(C('#efe7d6'), 1).fillRect(9, 7, 2, 3);
		g.fillStyle(C('#e3a14a'), 1).fillEllipse(20, 19, 9, 5);
		g.fillStyle(C('#efe7d6'), 1).fillRect(19, 19, 2, 3);
	}),
	reedmat: def(38, 24, (g) => {
		g.fillStyle(C('#b9a06a'), 1).fillRoundedRect(4, 6, 30, 14, 3);
		g.lineStyle(1, C('#8a7440'), 0.8);
		for (let i = 1; i < 6; i++) g.lineBetween(4 + i * 5, 6, 4 + i * 5, 20);
	}),
	cactuspot: def(24, 32, (g) => {
		g.fillStyle(C('#4f8a4a'), 1).fillRoundedRect(9, 6, 6, 16, 3); // cactus body
		g.fillStyle(C('#4f8a4a'), 1).fillRoundedRect(4, 12, 5, 5, 2).fillRoundedRect(15, 10, 5, 5, 2); // arms
		g.fillStyle(C('#c47a3a'), 1).fillRoundedRect(6, 22, 12, 9, 2); // pot
	}),
	peltrug: def(40, 28, (g) => {
		g.fillStyle(C('#caa15e'), 1).fillEllipse(20, 16, 30, 18);
		g.fillStyle(C('#caa15e'), 1).fillEllipse(20, 6, 10, 8); // head
		g.fillStyle(C('#efe7d6'), 1).fillEllipse(20, 16, 18, 9);
	}),
	chandelier: def(32, 30, (g) => {
		g.lineStyle(2, C('#5a3f2a'), 1).lineBetween(16, 0, 16, 8);
		g.fillStyle(C('#caa15e'), 1).fillRoundedRect(4, 8, 24, 4, 2);
		['8', '16', '24'].forEach((sx) => {
			const x = +sx;
			g.fillStyle(C('#5a3f2a'), 1).fillRect(x - 1, 11, 2, 6);
			g.fillStyle(C('#f3d24a'), 1).fillCircle(x, 19, 2.4);
		});
	}),
	aquarium: def(34, 28, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 22, 28, 4); // stand
		g.fillStyle(C('#7fb4d8'), 1).fillRoundedRect(5, 4, 24, 18, 2); // water
		g.lineStyle(2, C('#cfe0ee'), 1).strokeRoundedRect(5, 4, 24, 18, 2);
		g.fillStyle(C('#e8954f'), 1).fillEllipse(14, 12, 6, 3);
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(22, 16, 5, 2.5);
	}),
	telescope: def(28, 34, (g) => {
		g.lineStyle(3, C('#3a3a2c'), 1).lineBetween(8, 32, 14, 16).lineBetween(20, 32, 14, 16); // tripod
		g.fillStyle(C('#5a6b7a'), 1).fillRoundedRect(10, 6, 16, 6, 3); // barrel (tilted-ish)
		g.fillStyle(C('#cfe0ee'), 1).fillCircle(25, 9, 2.5); // lens
	}),
	driftwoodshelf: def(34, 26, (g) => {
		g.fillStyle(C('#b6a68c'), 1).fillRoundedRect(3, 10, 28, 4, 2); // weathered plank
		g.fillStyle(C('#8a7a60'), 1).fillRect(6, 14, 2, 8).fillRect(25, 14, 2, 8);
		g.fillStyle(C('#e3a8b0'), 1).fillCircle(12, 8, 2.5); // shell
		g.fillStyle(C('#7fb4a0'), 1).fillCircle(20, 8, 2.5); // sea glass
	}),
	// Frostflower Vase — a clear glass vase of pale ice-blooms on the sill.
	frostflowervase: def(26, 34, (g) => {
		g.fillStyle(C('#cfe6f2'), 0.5).fillRoundedRect(8, 16, 10, 14, 3); // glass vase body
		g.fillStyle(C('#eaf6ff'), 0.7).fillRoundedRect(9, 17, 4, 12, 2); // glass highlight
		g.fillStyle(C('#9fc4d8'), 0.6).fillEllipse(13, 30, 12, 4); // base shadow
		g.lineStyle(1, C('#8fb8cc'), 1).lineBetween(13, 16, 10, 8).lineBetween(13, 16, 16, 6).lineBetween(13, 16, 13, 5); // stems
		const bloom = (x: number, y: number) => {
			g.fillStyle(C('#bcd9e8'), 1);
			for (let i = 0; i < 5; i++) {
				const an = (i / 5) * Math.PI * 2;
				g.fillCircle(x + Math.cos(an) * 3, y + Math.sin(an) * 3, 2);
			}
			g.fillStyle(C('#eaf6ff'), 1).fillCircle(x, y, 1.8);
		};
		bloom(10, 7);
		bloom(16, 5);
		bloom(13, 4);
		g.fillStyle(0xffffff, 0.6).fillCircle(9, 3, 0.9); // frost sparkle
	}),
	// Stormglass Chandelier — hanging cluster of lightning-glass shards.
	stormglasschandelier: def(36, 30, (g) => {
		g.fillStyle(C('#3a2f4a'), 1).fillRect(17, 0, 2, 6); // chain
		g.fillStyle(C('#2c2438'), 1).fillRoundedRect(7, 5, 22, 3, 1); // crossbar
		g.fillStyle(C('#7b8fd6'), 0.25).fillEllipse(18, 16, 30, 18); // cool glow
		const shard = (x: number) => {
			g.fillStyle(C('#5566a3'), 1).fillTriangle(x, 8, x - 3, 22, x + 3, 22);
			g.fillStyle(C('#8fa0e0'), 0.9).fillTriangle(x, 11, x - 1.5, 21, x + 1.5, 21);
			g.fillStyle(0xffffff, 0.8).fillCircle(x - 1, 12, 0.9);
		};
		shard(9);
		shard(18);
		shard(27);
		g.lineStyle(1, C('#dfe6ff'), 0.7).lineBetween(9, 22, 18, 26).lineBetween(18, 26, 27, 22); // light arc
	}),
	// ---- wall-mounted decor (mount: 'wall' — these hang, they never stand) ----
	// Drawn flat and shallow on purpose: no legs, no base, no cast shadow of their
	// own. A hung piece reads as part of the wall, so anything that suggests it is
	// resting on something makes it look like it fell off.
	pressedflowers: def(30, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(3, 3, 24, 24, 2); // frame
		g.fillStyle(C('#f3ecd6'), 1).fillRect(6, 6, 18, 18); // mount card
		const bloom = (x: number, y: number, c: string) => {
			g.fillStyle(C(c), 1);
			for (let i = 0; i < 5; i++) {
				const an = (i / 5) * Math.PI * 2;
				g.fillCircle(x + Math.cos(an) * 2.2, y + Math.sin(an) * 2.2, 1.5);
			}
			g.fillStyle(C('#e3c75f'), 1).fillCircle(x, y, 1.2);
		};
		g.lineStyle(1, C('#6da84e'), 0.9).lineBetween(11, 21, 11, 13).lineBetween(19, 21, 19, 15);
		bloom(11, 11, '#d8a0b4');
		bloom(19, 13, '#b58ac0');
	}),
	wallhanging: def(28, 36, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 3, 22, 2); // dowel
		g.fillStyle(C('#c98a6a'), 1).fillRect(5, 5, 18, 24); // woven field
		g.fillStyle(C('#e3c75f'), 1).fillRect(5, 11, 18, 3);
		g.fillStyle(C('#7fae6a'), 1).fillRect(5, 18, 18, 3);
		g.fillStyle(C('#b5707a'), 1).fillRect(5, 24, 18, 2);
		g.lineStyle(1, C('#a86f80'), 0.9); // fringe
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 3, 29, 6 + i * 3, 33);
	}),
	strawwreath: def(30, 30, (g) => {
		g.lineStyle(6, C('#d9bc72'), 1).strokeCircle(15, 16, 9); // braided ring
		g.lineStyle(1, C('#b9a06a'), 0.9);
		for (let i = 0; i < 10; i++) {
			const an = (i / 10) * Math.PI * 2;
			g.lineBetween(15 + Math.cos(an) * 6, 16 + Math.sin(an) * 6, 15 + Math.cos(an) * 12, 16 + Math.sin(an) * 12);
		}
		g.fillStyle(C('#d8a0b4'), 1).fillCircle(10, 11, 2).fillCircle(21, 19, 2);
		g.fillStyle(C('#e3c75f'), 1).fillCircle(20, 10, 1.8);
		g.fillStyle(C('#b5707a'), 1).fillRect(14, 2, 2, 5); // hanging ribbon
	}),
	mosswall: def(32, 26, (g) => {
		g.fillStyle(C('#5a4030'), 1).fillRoundedRect(2, 2, 28, 22, 2); // frame
		g.fillStyle(C('#3f6b32'), 1).fillRect(5, 5, 22, 16); // moss bed
		const tuft = (x: number, y: number, c: string) => g.fillStyle(C(c), 1).fillCircle(x, y, 3);
		tuft(10, 10, '#5c8a45');
		tuft(17, 8, '#79a85c');
		tuft(22, 13, '#4f7d3a');
		tuft(12, 17, '#79a85c');
		tuft(20, 18, '#5c8a45');
		g.fillStyle(C('#8fa88a'), 0.9).fillEllipse(15, 13, 5, 3); // a patch of lichen
	}),
	barkrelief: def(28, 34, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 3, 20, 28, 3); // bark slab
		g.fillStyle(C('#8a6a44'), 0.6).fillRect(6, 5, 16, 24); // sanded face
		g.lineStyle(0.8, C('#6a4a2c'), 0.7); // grain down both edges
		g.lineBetween(5, 5, 5, 29).lineBetween(23, 5, 23, 29);
		// the carving, cut back to the pale wood underneath: a broad tree over a
		// low ridge. Three overlapping rounds for the crown rather than one ring —
		// a single outlined ellipse read as a keyhole, not a canopy.
		g.fillStyle(C('#c3a878'), 1).fillRect(13, 14, 3, 12); // trunk
		g.fillStyle(C('#c3a878'), 1).fillCircle(10, 13, 5).fillCircle(18, 13, 5).fillCircle(14, 9, 5.5);
		g.fillStyle(C('#d8c096'), 1).fillCircle(12, 11, 3).fillCircle(16, 12, 2.5); // catching the light
		g.lineStyle(1, C('#5a3f28'), 0.85);
		g.lineBetween(14, 20, 11, 17).lineBetween(14, 19, 17, 16); // two boughs
		g.lineBetween(11, 26, 14, 24).lineBetween(17, 26, 14, 24); // root flare
		g.lineStyle(1, C('#6a4a2c'), 0.6).lineBetween(7, 28, 21, 28); // the ridge it stands on
	}),
	wallfern: def(28, 32, (g) => {
		// on a bracket screwed to the wall, not swinging from a ceiling
		g.fillStyle(C('#5a5048'), 1).fillRect(4, 6, 3, 14); // upright
		g.lineStyle(2, C('#5a5048'), 1).lineBetween(6, 8, 17, 14).lineBetween(6, 18, 15, 15); // arm + stay
		g.fillStyle(C('#a8845a'), 1).fillRoundedRect(10, 14, 13, 8, 3); // pot
		g.fillStyle(C('#8a6a44'), 1).fillRect(10, 14, 13, 2); // rim
		g.fillStyle(C('#4f7d3a'), 1);
		const frond = (x: number, y: number, dx: number) => {
			for (let i = 0; i < 5; i++) g.fillEllipse(x + dx * i * 2.2, y + i * 2.6, 6.5 - i * 0.8, 3);
		};
		frond(14, 22, -1);
		frond(19, 22, 1);
		g.fillStyle(C('#6da84e'), 1).fillEllipse(16, 12, 12, 6).fillEllipse(16, 9, 7, 5);
	}),
	reedscreen: def(34, 32, (g) => {
		g.fillStyle(C('#8a7440'), 1).fillRect(3, 4, 28, 2).fillRect(3, 26, 28, 2); // top + bottom bindings
		g.fillStyle(C('#b9a06a'), 1);
		for (let i = 0; i < 9; i++) g.fillRect(4 + i * 3, 5, 2, 22); // reeds side by side
		g.lineStyle(1, C('#8a7440'), 0.7).lineBetween(3, 15, 31, 15); // middle binding
	}),
	dragonflies: def(32, 30, (g) => {
		// three of them mounted straight onto the wall, climbing to the corner
		const fly = (x: number, y: number, c: string, sz: number) => {
			g.fillStyle(C('#8a7440'), 1).fillRoundedRect(x - 0.8, y - 5 * sz, 1.6, 11 * sz, 0.8); // body
			g.fillStyle(C(c), 0.8)
				.fillEllipse(x - 3.4 * sz, y - 2 * sz, 8 * sz, 3 * sz)
				.fillEllipse(x + 3.4 * sz, y - 2 * sz, 8 * sz, 3 * sz)
				.fillEllipse(x - 3 * sz, y + 1.6 * sz, 6.5 * sz, 2.6 * sz)
				.fillEllipse(x + 3 * sz, y + 1.6 * sz, 6.5 * sz, 2.6 * sz);
			g.fillStyle(C('#5a4028'), 1).fillCircle(x, y - 5 * sz, 1.4 * sz); // head
		};
		fly(8, 22, '#7fae6a', 0.85);
		fly(16, 15, '#6fb0c4', 1.05);
		fly(24, 8, '#8fa0e0', 0.9);
	}),
	cattailbundle: def(26, 34, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRect(11, 1, 4, 3); // the peg it hangs from
		// hung head-down to dry: the stems gather at the tie and the heavy seed
		// heads hang free below, which is the whole silhouette of a drying bundle
		const cat = (x: number, len: number) => {
			g.lineStyle(1.4, C('#9fae72'), 1).lineBetween(13, 7, x, 7 + len);
			g.fillStyle(C('#5a4028'), 1).fillRoundedRect(x - 2.2, 7 + len, 4.4, 11, 2.2); // seed head
			g.fillStyle(C('#7a5a38'), 0.9).fillRoundedRect(x - 1.4, 8 + len, 1.8, 8, 0.9); // highlight
			g.lineStyle(1, C('#9fae72'), 1).lineBetween(x, 7 + len, x, 4 + len); // the stem tip above it
		};
		cat(6, 9);
		cat(13, 5);
		cat(20, 8);
		g.lineStyle(2, C('#b5707a'), 1).lineBetween(9, 6, 17, 6); // the tie
	}),
	sundisk: def(30, 30, (g) => {
		g.fillStyle(C('#b8703a'), 1).fillCircle(15, 15, 12); // rim
		g.fillStyle(C('#d0894a'), 1).fillCircle(15, 15, 9);
		g.fillStyle(C('#e8b06a'), 1).fillCircle(15, 15, 5); // carved sun
		g.lineStyle(1.5, C('#8a4f28'), 1);
		for (let i = 0; i < 12; i++) {
			const an = (i / 12) * Math.PI * 2;
			g.lineBetween(15 + Math.cos(an) * 6, 15 + Math.sin(an) * 6, 15 + Math.cos(an) * 9, 15 + Math.sin(an) * 9);
		}
	}),
	agavefan: def(32, 28, (g) => {
		g.fillStyle(C('#9fae72'), 1); // splayed blades
		for (let i = 0; i < 7; i++) {
			const an = Math.PI + (i / 6) * Math.PI * 0.86 + 0.24;
			g.fillTriangle(
				16,
				24,
				16 + Math.cos(an) * 15,
				24 + Math.sin(an) * 19,
				16 + Math.cos(an + 0.16) * 15,
				24 + Math.sin(an + 0.16) * 19,
			);
		}
		g.fillStyle(C('#c3cf9a'), 0.6).fillEllipse(16, 17, 20, 10);
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(13, 22, 6, 5, 2); // bound handle
	}),
	geodeslice: def(28, 28, (g) => {
		g.fillStyle(C('#6e6154'), 1).fillCircle(14, 14, 11); // rough rind
		g.fillStyle(C('#b9a8c8'), 1).fillCircle(14, 14, 8);
		g.fillStyle(C('#9a7fc0'), 1).fillCircle(14, 14, 5); // crystal heart
		g.fillStyle(C('#d8cbe8'), 1);
		for (let i = 0; i < 8; i++) {
			const an = (i / 8) * Math.PI * 2;
			g.fillTriangle(
				14,
				14,
				14 + Math.cos(an) * 7,
				14 + Math.sin(an) * 7,
				14 + Math.cos(an + 0.5) * 7,
				14 + Math.sin(an + 0.5) * 7,
			);
		}
		g.fillStyle(0xffffff, 0.85).fillCircle(12, 11, 1.3);
	}),
	windowstar: def(28, 28, (g) => {
		g.fillStyle(C('#cfe6f2'), 0.85);
		for (let i = 0; i < 3; i++) {
			const an = (i / 3) * Math.PI;
			g.fillTriangle(
				14 - Math.cos(an) * 12,
				14 - Math.sin(an) * 12,
				14 + Math.cos(an) * 12,
				14 + Math.sin(an) * 12,
				14 + Math.sin(an) * 3,
				14 - Math.cos(an) * 3,
			);
		}
		g.lineStyle(1, C('#8fb8cc'), 1);
		for (let i = 0; i < 6; i++) {
			const an = (i / 6) * Math.PI * 2;
			g.lineBetween(14, 14, 14 + Math.cos(an) * 12, 14 + Math.sin(an) * 12);
		}
		g.fillStyle(C('#eaf6ff'), 1).fillCircle(14, 14, 3);
		g.fillStyle(0xffffff, 0.7).fillCircle(10, 9, 1);
	}),
	lichenwreath: def(30, 30, (g) => {
		g.lineStyle(5, C('#6e5a44'), 1).strokeCircle(15, 16, 9); // juniper frame
		g.fillStyle(C('#8fa88a'), 1);
		for (let i = 0; i < 12; i++) {
			const an = (i / 12) * Math.PI * 2;
			g.fillCircle(15 + Math.cos(an) * 9, 16 + Math.sin(an) * 9, 3);
		}
		g.fillStyle(C('#b6c8b0'), 0.9);
		for (let i = 0; i < 6; i++) {
			const an = (i / 6) * Math.PI * 2 + 0.4;
			g.fillCircle(15 + Math.cos(an) * 9, 16 + Math.sin(an) * 9, 2);
		}
		g.fillStyle(C('#5a7a9a'), 1).fillCircle(21, 10, 1.6); // a juniper berry or two
		g.fillStyle(C('#5a7a9a'), 1).fillCircle(9, 20, 1.4);
	}),
	summitmap: def(32, 28, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(2, 2, 28, 24, 2); // frame
		g.fillStyle(C('#e8dcc0'), 1).fillRect(5, 5, 22, 18); // paper
		g.fillStyle(C('#c3a878'), 1).fillTriangle(9, 20, 15, 8, 21, 20); // the ridge
		g.fillStyle(C('#efe7d6'), 1).fillTriangle(13, 13, 15, 8, 17, 13); // snowcap
		g.lineStyle(0.8, C('#9a8055'), 0.9); // contour lines
		g.lineBetween(7, 17, 25, 17).lineBetween(8, 20, 24, 20);
		g.fillStyle(C('#b5707a'), 1).fillCircle(15, 8, 1.3); // a summit marked
	}),
	shellgarland: def(34, 26, (g) => {
		// the string, pinned at both ends and sagging in the middle
		const sag = (x: number) => 4 + Math.sin((x / 34) * Math.PI) * 8;
		g.lineStyle(1.2, C('#c3b49a'), 1);
		for (let x = 2; x < 32; x += 2) g.lineBetween(x, sag(x), x + 2, sag(x + 2));
		g.fillStyle(C('#8a7a60'), 1).fillCircle(2, sag(2), 1.4).fillCircle(32, sag(32), 1.4); // the two pins
		const shell = (x: number, c: string) => {
			const y = sag(x);
			g.fillStyle(C(c), 1).fillTriangle(x - 4, y + 8, x + 4, y + 8, x, y + 1); // fan
			g.fillStyle(C(c), 1).fillEllipse(x, y + 7.5, 8, 3.5);
			g.lineStyle(0.6, C('#b09a80'), 0.9); // the ribs of the fan
			g.lineBetween(x, y + 2, x - 2.6, y + 7.6)
				.lineBetween(x, y + 2, x, y + 8)
				.lineBetween(x, y + 2, x + 2.6, y + 7.6);
		};
		shell(9, '#e6d3c0');
		shell(17, '#f0e2d2');
		shell(25, '#e3c9b4');
	}),
	driftmirror: def(30, 30, (g) => {
		g.fillStyle(C('#cfe0ee'), 1).fillCircle(15, 15, 9); // glass
		g.fillStyle(0xffffff, 0.55).fillEllipse(12, 11, 8, 5); // reflection
		// the frame is short chunks of driftwood laid around the rim, not spokes:
		// beachcombed wood, each piece a different length and grey
		const greys = ['#b6a68c', '#a2937b', '#c6b79c', '#9a8b73'];
		for (let i = 0; i < 12; i++) {
			const an = (i / 12) * Math.PI * 2;
			const r = 11.5;
			g.fillStyle(C(greys[i % greys.length]), 1);
			g.fillEllipse(15 + Math.cos(an) * r, 15 + Math.sin(an) * r, 6.5, 4);
		}
		g.lineStyle(1, C('#8a7a62'), 0.6).strokeCircle(15, 15, 9);
		g.fillStyle(C('#7fb4a0'), 1).fillCircle(22, 22, 2); // sea glass tucked in the frame
	}),
	netdrape: def(34, 32, (g) => {
		g.fillStyle(C('#8a7a60'), 1).fillRect(3, 3, 28, 2); // the batten it hangs from
		g.lineStyle(1, C('#a8b49a'), 0.95); // knotted mesh, drooping
		for (let i = 0; i <= 7; i++) g.lineBetween(4 + i * 4, 5, 6 + i * 3, 29);
		for (let r = 1; r <= 4; r++) {
			const y = 5 + r * 6;
			g.lineBetween(4 + r, y, 30 - r, y);
		}
		g.fillStyle(C('#e6d3c0'), 1).fillCircle(12, 17, 2.2); // shells still caught in it
		g.fillStyle(C('#7fb4a0'), 1).fillCircle(23, 23, 2);
	}),

	// ---- floor decor ----
	rockingchair: def(32, 34, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(8, 6, 16, 16, 3); // back
		g.fillStyle(C('#6e4a33'), 1).fillRect(11, 9, 2, 11).fillRect(15, 9, 2, 11).fillRect(19, 9, 2, 11); // slats
		g.fillStyle(C('#a86f80'), 1).fillRoundedRect(7, 21, 18, 6, 2); // seat cushion
		g.fillStyle(C('#6e4a33'), 1).fillRect(9, 26, 2, 5).fillRect(21, 26, 2, 5); // legs
		g.lineStyle(2, C('#5a3f28'), 1).lineBetween(5, 30, 27, 30); // rockers
		g.lineStyle(2, C('#5a3f28'), 1).lineBetween(5, 30, 7, 27).lineBetween(27, 30, 25, 27);
	}),
	roomdivider: def(40, 36, (g) => {
		const panel = (x: number, lean: number) => {
			g.fillStyle(C('#a8895a'), 1).fillRoundedRect(x, 4 + lean, 11, 27, 2);
			g.fillStyle(C('#c3a878'), 1).fillRect(x + 2, 6 + lean, 7, 23);
			g.lineStyle(1, C('#8a7440'), 0.8);
			for (let i = 1; i < 6; i++) g.lineBetween(x + 2, 6 + lean + i * 4, x + 9, 6 + lean + i * 4);
		};
		panel(3, 2);
		panel(15, 0);
		panel(27, 2);
	}),
	logtable: def(32, 28, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillEllipse(16, 12, 24, 12); // cross-cut top
		g.fillStyle(C('#a8845a'), 1).fillEllipse(16, 11, 19, 9);
		g.lineStyle(0.8, C('#6e4a33'), 0.9); // growth rings
		g.strokeCircle(16, 11, 7);
		g.strokeCircle(16, 11, 4.5);
		g.strokeCircle(16, 11, 2);
		g.fillStyle(C('#6e4a33'), 1).fillRect(8, 16, 3, 9).fillRect(21, 16, 3, 9).fillRect(15, 17, 3, 8); // three legs
	}),
	toadstool: def(26, 26, (g) => {
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(10, 14, 6, 10, 2); // stalk
		g.fillStyle(C('#c05a4a'), 1).fillEllipse(13, 12, 22, 13); // cap
		g.fillStyle(C('#efe7d6'), 1).fillCircle(8, 10, 2).fillCircle(17, 9, 2.4).fillCircle(13, 14, 1.8); // spots
		g.fillStyle(C('#a8483a'), 0.5).fillEllipse(13, 16, 20, 4);
	}),
	marshterrarium: def(30, 30, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(6, 25, 18, 3); // stand
		g.fillStyle(C('#cfe6f2'), 0.45).fillCircle(15, 15, 11); // glass globe
		g.fillStyle(C('#6a5a3a'), 1).fillEllipse(15, 22, 17, 6); // soil
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(11, 18, 7, 5).fillEllipse(19, 17, 6, 4);
		g.fillStyle(C('#7fae6a'), 1).fillEllipse(15, 15, 5, 8);
		g.fillStyle(C('#8fb8cc'), 0.5).fillEllipse(15, 21, 10, 3); // a little standing water
		g.fillStyle(0xffffff, 0.5).fillEllipse(11, 10, 6, 4); // glass highlight
	}),
	reedlantern: def(26, 36, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillEllipse(13, 33, 14, 5); // base
		g.fillStyle(C('#6e4a33'), 1).fillRect(12, 18, 2, 14); // stem
		g.fillStyle(C('#e3c75f'), 0.9).fillRoundedRect(5, 4, 16, 15, 3); // woven shade, lit
		g.lineStyle(1, C('#b9a06a'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(6 + i * 3.5, 4, 6 + i * 3.5, 19);
		g.lineBetween(5, 11, 21, 11);
		g.fillStyle(C('#fff0b8'), 0.55).fillEllipse(13, 12, 12, 10); // glow through the weave
	}),
	clayurn: def(28, 34, (g) => {
		g.fillStyle(C('#b0653a'), 1).fillEllipse(14, 21, 20, 22); // belly
		g.fillStyle(C('#b0653a'), 1).fillRoundedRect(10, 5, 8, 10, 2); // neck
		g.fillStyle(C('#8a4a28'), 1).fillEllipse(14, 5, 12, 5); // rim
		g.fillStyle(C('#d08a5a'), 0.7).fillEllipse(10, 18, 5, 10); // highlight
		g.lineStyle(1.5, C('#e8b06a'), 0.9).lineBetween(6, 20, 22, 20).lineBetween(7, 25, 21, 25); // painted bands
	}),
	firewoodrack: def(36, 30, (g) => {
		g.fillStyle(C('#5a3f28'), 1).fillRect(4, 6, 3, 22).fillRect(29, 6, 3, 22); // uprights
		g.fillStyle(C('#7a5a3a'), 1).fillRect(4, 26, 28, 3); // floor bar
		const logs = ['#a8845a', '#8a6a48', '#9a7550', '#7a5a3a'];
		for (let row = 0; row < 3; row++)
			for (let i = 0; i < 5; i++) {
				g.fillStyle(C(logs[(row + i) % logs.length]), 1).fillCircle(9 + i * 4.6, 23 - row * 5, 2.3);
				g.fillStyle(C('#c3a878'), 0.7).fillCircle(9 + i * 4.6, 23 - row * 5, 1.1); // cut end
			}
	}),
	driftbench: def(38, 26, (g) => {
		g.fillStyle(C('#a89880'), 1).fillRoundedRect(3, 8, 32, 6, 2); // seat plank
		g.fillStyle(C('#c3b49a'), 0.7).fillRect(5, 9, 28, 2); // sun-bleached grain
		g.lineStyle(0.8, C('#8a7a60'), 0.8).lineBetween(6, 12, 32, 12);
		g.fillStyle(C('#8a7a60'), 1).fillRoundedRect(7, 14, 5, 9, 1).fillRoundedRect(26, 14, 5, 9, 1); // stone-ish legs
		g.fillStyle(C('#7fb4a0'), 1).fillCircle(19, 7, 1.6); // a chip of sea glass set in the seat
	}),
	tideglass: def(26, 34, (g) => {
		g.fillStyle(C('#8a7a60'), 1).fillEllipse(13, 31, 14, 5); // driftwood foot
		g.fillStyle(C('#a89880'), 1).fillRect(11, 24, 4, 7);
		g.fillStyle(C('#7fb4d8'), 0.8).fillRoundedRect(5, 5, 16, 19, 4); // glass body
		g.fillStyle(C('#a8d8e8'), 0.7).fillRoundedRect(7, 8, 5, 13, 2);
		g.fillStyle(C('#7fb4a0'), 0.8).fillRoundedRect(14, 11, 5, 9, 2);
		g.fillStyle(C('#fff0b8'), 0.65).fillEllipse(13, 15, 10, 12); // the light inside
		g.fillStyle(C('#8a7a60'), 1).fillRect(11, 1, 4, 5); // hanging loop
	}),
	// ---- the fun half: wall ----
	paperbutterflies: def(32, 32, (g) => {
		// a loose spiral climbing the wall, biggest at the bottom
		const fly = (x: number, y: number, c: string, sz: number, tilt: number) => {
			g.fillStyle(C(c), 1)
				.fillEllipse(x - 2.6 * sz, y - 1 * sz + tilt, 6 * sz, 7 * sz)
				.fillEllipse(x + 2.6 * sz, y - 1 * sz - tilt, 6 * sz, 7 * sz);
			g.fillStyle(C(c), 0.75)
				.fillEllipse(x - 2.2 * sz, y + 3 * sz + tilt, 4.6 * sz, 4.6 * sz)
				.fillEllipse(x + 2.2 * sz, y + 3 * sz - tilt, 4.6 * sz, 4.6 * sz);
			g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(x - 0.6, y - 4 * sz, 1.2, 9 * sz, 0.6);
		};
		fly(9, 26, '#e8b0c8', 1.05, 0.6);
		fly(19, 21, '#f0d08a', 0.85, -0.5);
		fly(11, 14, '#c8a0d8', 0.75, 0.4);
		fly(21, 9, '#a8c8e8', 0.62, -0.3);
		fly(14, 4, '#e8b0c8', 0.5, 0.2);
	}),
	findsboard: def(34, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(2, 2, 30, 26, 2); // frame
		g.fillStyle(C('#b98f5a'), 1).fillRect(5, 5, 24, 20); // cork
		g.fillStyle(C('#e8dcc0'), 1).fillRect(7, 8, 8, 7).fillRect(20, 15, 8, 7); // two notes
		g.lineStyle(0.6, C('#a8845a'), 0.9).lineBetween(8, 11, 14, 11).lineBetween(8, 13, 12, 13);
		g.fillStyle(C('#cfe0ee'), 1).fillEllipse(21, 9, 4, 9); // a feather
		g.lineStyle(0.7, C('#8a9aa8'), 1).lineBetween(21, 5, 21, 13);
		g.fillStyle(C('#6e8a3a'), 1).fillEllipse(11, 20, 8, 3.5); // a seed pod
		g.fillStyle(C('#c04a5a'), 1).fillCircle(11, 7, 1.4).fillCircle(24, 14, 1.4).fillCircle(9, 19, 1.4); // pins
	}),
	mousedoor: def(22, 26, (g) => {
		g.fillStyle(C('#6a4a2c'), 1).fillRoundedRect(4, 6, 14, 20, 7); // arch, flat on the floor line
		g.fillStyle(C('#8a5a3a'), 1).fillRoundedRect(6, 8, 10, 18, 5);
		g.lineStyle(0.6, C('#6a4a2c'), 0.8).lineBetween(11, 9, 11, 25); // plank seam
		g.fillStyle(C('#e3c75f'), 1).fillCircle(14, 18, 1.2); // brass knob
		g.fillStyle(C('#f3ecd6'), 0.85).fillEllipse(11, 12, 5, 4); // a tiny fanlight
	}),
	antlerrack: def(34, 26, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(3, 15, 28, 6, 2); // mounting board
		g.fillStyle(C('#5a3f28'), 1).fillCircle(6, 18, 1).fillCircle(28, 18, 1); // screws
		g.lineStyle(2.6, C('#c3a878'), 1).lineBetween(17, 16, 9, 5); // the shed antler, sweeping up
		g.lineStyle(2.2, C('#c3a878'), 1);
		g.lineBetween(14, 12, 12, 4).lineBetween(12, 10, 8, 3).lineBetween(15, 14, 19, 7).lineBetween(19, 7, 22, 4);
		g.fillStyle(C('#d8c096'), 1).fillCircle(17, 16, 2.6); // the burr where it was shed
	}),
	birdflock: def(34, 28, (g) => {
		const bird = (x: number, y: number, sz: number, c: string) => {
			g.fillStyle(C(c), 1).fillEllipse(x, y, 9 * sz, 4 * sz); // body
			g.fillStyle(C(c), 1).fillTriangle(x + 3 * sz, y, x + 8 * sz, y - 2 * sz, x + 7 * sz, y + 2 * sz); // tail
			g.fillStyle(C('#a8845a'), 1).fillTriangle(x - 1 * sz, y - 1 * sz, x + 3 * sz, y - 5 * sz, x + 4 * sz, y); // wing
			g.fillStyle(C('#5a3f28'), 1).fillCircle(x - 4 * sz, y - 1 * sz, 1.1 * sz);
		};
		bird(8, 24, 0.8, '#7a5a3a');
		bird(17, 20, 0.95, '#8a6a44');
		bird(11, 14, 0.75, '#6e4a33');
		bird(22, 11, 0.85, '#7a5a3a');
		bird(15, 5, 0.65, '#8a6a44');
	}),
	frogplaques: def(32, 30, (g) => {
		const frog = (x: number, y: number, sz: number) => {
			g.fillStyle(C('#c3a878'), 1).fillCircle(x, y, 7 * sz); // clay disc
			g.fillStyle(C('#6da84e'), 1).fillEllipse(x, y + 1 * sz, 9 * sz, 7 * sz); // body
			g.fillStyle(C('#8fc46a'), 1).fillEllipse(x, y + 3 * sz, 6 * sz, 3.5 * sz); // pale throat, sung out
			g.fillStyle(C('#4f7d3a'), 1)
				.fillCircle(x - 3 * sz, y - 3 * sz, 2 * sz)
				.fillCircle(x + 3 * sz, y - 3 * sz, 2 * sz);
			g.fillStyle(C('#2c2418'), 1)
				.fillCircle(x - 3 * sz, y - 3 * sz, 0.9 * sz)
				.fillCircle(x + 3 * sz, y - 3 * sz, 0.9 * sz);
		};
		frog(9, 9, 0.85);
		frog(23, 12, 0.95);
		frog(14, 23, 0.8);
	}),
	heronprint: def(28, 34, (g) => {
		g.fillStyle(C('#8a7440'), 1).fillRoundedRect(2, 2, 24, 30, 1); // slim reed frame
		g.fillStyle(C('#e8dcc0'), 1).fillRect(4, 4, 20, 26); // reed paper
		g.fillStyle(C('#b8ccd8'), 0.7).fillRect(4, 24, 20, 6); // the patient inch of water
		g.lineStyle(1.6, C('#8fa8b8'), 1).lineBetween(14, 24, 14, 15); // legs and neck
		g.fillStyle(C('#8fa8b8'), 1).fillEllipse(14, 13, 11, 6); // body
		g.lineStyle(1.4, C('#8fa8b8'), 1).lineBetween(15, 11, 17, 7);
		g.fillStyle(C('#8fa8b8'), 1).fillCircle(17, 7, 2);
		g.lineStyle(1.2, C('#d8a84a'), 1).lineBetween(18, 7, 23, 8); // bill
		g.fillStyle(C('#6a8494'), 1).fillTriangle(10, 12, 16, 13, 9, 17); // folded wing
	}),
	fossilplaque: def(30, 30, (g) => {
		g.fillStyle(C('#8a8070'), 1).fillRoundedRect(3, 3, 24, 24, 3); // split rock
		g.fillStyle(C('#a8a090'), 1).fillRoundedRect(5, 5, 20, 20, 2);
		g.fillStyle(C('#b8a888'), 1).fillCircle(15, 15, 9); // the coil
		g.lineStyle(1.6, C('#6a6050'), 1);
		for (let i = 0; i < 22; i++) {
			const t = i / 22;
			const an = t * Math.PI * 3.2;
			const r = 1.5 + t * 8;
			const r2 = 1.5 + ((i + 1) / 22) * 8;
			const an2 = ((i + 1) / 22) * Math.PI * 3.2;
			g.lineBetween(15 + Math.cos(an) * r, 15 + Math.sin(an) * r, 15 + Math.cos(an2) * r2, 15 + Math.sin(an2) * r2);
		}
		g.lineStyle(0.8, C('#8a7f6a'), 0.9);
		for (let i = 0; i < 9; i++) {
			const an = (i / 9) * Math.PI * 2;
			g.lineBetween(15 + Math.cos(an) * 4, 15 + Math.sin(an) * 4, 15 + Math.cos(an) * 9, 15 + Math.sin(an) * 9);
		}
	}),
	cactusribs: def(28, 34, (g) => {
		g.fillStyle(C('#8a7a60'), 1).fillRoundedRect(9, 29, 10, 3, 1); // the mount
		g.fillStyle(C('#c8a878'), 1);
		const rib = (x: number, top: number, bow: number) => {
			for (let i = 0; i < 12; i++) {
				const t = i / 11;
				g.fillCircle(x + Math.sin(t * Math.PI) * bow, top + t * (29 - top), 1.5);
			}
		};
		rib(8, 6, 2.2);
		rib(14, 3, 0);
		rib(20, 6, -2.2);
		g.lineStyle(1, C('#a8895a'), 0.9); // the lattice that held them together
		g.lineBetween(8, 14, 20, 14).lineBetween(8, 22, 20, 22);
	}),
	snowshoes: def(34, 32, (g) => {
		const shoe = (flip: number) => {
			const cx = 17 + flip * 5;
			g.lineStyle(2.4, C('#c3a878'), 1);
			g.strokeEllipse(cx + flip * 2, 15, 13, 26); // bent frame, teardrop
			g.lineStyle(0.7, C('#e0d0b0'), 0.95); // the rawhide webbing
			for (let i = 1; i < 6; i++) g.lineBetween(cx + flip * 2 - 6, 5 + i * 4, cx + flip * 2 + 6, 3 + i * 4);
			for (let i = 1; i < 4; i++) g.lineBetween(cx + flip * 2 - 5 + i * 3, 4, cx + flip * 2 - 7 + i * 3, 26);
			g.fillStyle(C('#5a4028'), 1).fillRoundedRect(cx + flip * 2 - 3, 13, 6, 3, 1); // binding
		};
		shoe(-1);
		shoe(1);
		g.fillStyle(C('#8a7a60'), 1).fillCircle(17, 3, 1.6); // the nail they hang from
	}),
	starchart: def(32, 30, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(2, 2, 28, 26, 2); // frame
		g.fillStyle(C('#3f4a6a'), 1).fillRect(5, 5, 22, 20); // dark cloth
		g.fillStyle(C('#5a6a8a'), 1).fillTriangle(5, 25, 13, 14, 21, 25); // the ridge, in silhouette
		g.fillStyle(C('#4a5878'), 1).fillTriangle(17, 25, 24, 17, 27, 25);
		const star = (x: number, y: number, r: number) => g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
		const pts: [number, number][] = [
			[9, 9],
			[13, 7],
			[17, 10],
			[21, 8],
			[24, 12],
			[11, 13],
			[19, 14],
		];
		g.lineStyle(0.5, C('#8fa0d0'), 0.8);
		g.lineBetween(9, 9, 13, 7).lineBetween(13, 7, 17, 10).lineBetween(17, 10, 21, 8).lineBetween(21, 8, 24, 12);
		for (const [x, y] of pts) star(x, y, 1.1);
		star(13, 7, 1.7);
	}),
	bottlerack: def(32, 30, (g) => {
		g.fillStyle(C('#8a7a60'), 1).fillRect(3, 6, 26, 2.5).fillRect(3, 24, 26, 2.5); // driftwood rails
		const bottle = (x: number, c: string, lean: number) => {
			g.fillStyle(C(c), 0.85).fillRoundedRect(x - 3.5, 10, 7, 14, 2);
			g.fillStyle(C(c), 0.85).fillRect(x - 1.4 + lean, 6, 2.8, 5); // neck
			g.fillStyle(C('#b98f5a'), 1).fillRect(x - 1.6 + lean, 5, 3.2, 2); // cork
			g.fillStyle(C('#e8dcc0'), 1).fillRoundedRect(x - 2.2, 14, 4.4, 7, 1); // the note inside
		};
		bottle(9, '#7fb4a0', 0);
		bottle(17, '#a8c8d8', 0.4);
		bottle(25, '#8aa870', -0.4);
	}),
	kelppress: def(28, 34, (g) => {
		g.fillStyle(C('#8a7a60'), 1).fillRoundedRect(2, 2, 24, 30, 1); // driftwood frame
		g.fillStyle(C('#efe7d6'), 1).fillRect(4, 4, 20, 26); // mounting sheet
		g.fillStyle(C('#6a8a5a'), 1).fillRoundedRect(13, 8, 2.4, 20, 1.2); // stipe
		g.fillStyle(C('#5a7a4a'), 0.9); // ruffled blades either side
		for (let i = 0; i < 5; i++) {
			g.fillEllipse(9.5 - (i % 2), 11 + i * 4, 9, 4.5);
			g.fillEllipse(18.5 + (i % 2), 12 + i * 4, 9, 4.5);
		}
		g.fillStyle(C('#7a9a68'), 1).fillCircle(14, 7, 2.6); // holdfast float
		g.lineStyle(0.5, C('#3f5a34'), 0.7).lineBetween(14, 8, 14, 28);
	}),
	// ---- the fun half: floor ----
	glowjar: def(26, 34, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(7, 27, 12, 5, 2); // little stand
		g.fillStyle(C('#a8d878'), 0.35).fillCircle(13, 16, 12); // the glow itself
		g.fillStyle(C('#cfe6f2'), 0.45).fillRoundedRect(5, 6, 16, 21, 5); // jar
		g.fillStyle(C('#8ac850'), 0.9).fillEllipse(13, 21, 12, 9); // moss inside
		g.fillStyle(C('#c8f088'), 0.95).fillEllipse(11, 19, 6, 4);
		g.fillStyle(C('#8a7a60'), 1).fillRoundedRect(8, 4, 10, 3, 1); // lid
		g.fillStyle(0xffffff, 0.45).fillEllipse(9, 12, 3.5, 8); // glass highlight
	}),
	mushroomlamp: def(32, 34, (g) => {
		g.fillStyle(C('#e8a86a'), 0.3).fillEllipse(16, 22, 28, 14); // the light it throws
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(13, 16, 6, 15, 2); // stem
		g.fillStyle(C('#d8ddc8'), 1).fillEllipse(16, 18, 12, 4); // the skirt
		g.fillStyle(C('#c05a4a'), 1).fillEllipse(16, 12, 26, 16); // cap
		g.fillStyle(C('#e8785a'), 1).fillEllipse(16, 10, 20, 11);
		g.fillStyle(C('#efe7d6'), 1).fillCircle(9, 10, 2.4).fillCircle(21, 8, 2.8).fillCircle(16, 14, 2);
		g.fillStyle(C('#f0c890'), 0.8).fillEllipse(16, 19, 16, 4); // lit from underneath
		g.fillStyle(C('#8a7a60'), 1).fillEllipse(16, 31, 14, 4); // base
	}),
	mosspouf: def(34, 26, (g) => {
		g.fillStyle(C('#3f6b32'), 1).fillEllipse(17, 16, 30, 18); // squashy round
		g.fillStyle(C('#5c8a45'), 1).fillEllipse(17, 14, 27, 15);
		g.fillStyle(C('#79a85c'), 1).fillEllipse(14, 11, 12, 6); // the sat-in dent, catching light
		g.lineStyle(1, C('#2f5426'), 0.7); // seams
		g.lineBetween(6, 15, 28, 15);
		g.lineBetween(17, 6, 17, 24);
		g.fillStyle(C('#8fc46a'), 1).fillCircle(9, 19, 1.6).fillCircle(25, 12, 1.4).fillCircle(20, 20, 1.2); // tufts
	}),
	pebblefountain: def(30, 32, (g) => {
		g.fillStyle(C('#6a6558'), 1).fillEllipse(15, 27, 26, 9); // basin
		g.fillStyle(C('#7fb4d8'), 0.85).fillEllipse(15, 26, 21, 6); // water in it
		const stone = (x: number, y: number, w: number, c: string) => g.fillStyle(C(c), 1).fillEllipse(x, y, w, w * 0.62);
		stone(15, 22, 15, '#8a857a');
		stone(15, 16, 12, '#9a9488');
		stone(15, 11, 9, '#7f7a70');
		stone(15, 7, 6, '#8a857a');
		g.fillStyle(C('#a8d8ee'), 0.75).fillEllipse(15, 9, 5, 3); // the trickle over the top
		g.lineStyle(1.4, C('#a8d8ee'), 0.7).lineBetween(10, 12, 8, 24).lineBetween(20, 12, 22, 24);
		g.fillStyle(0xffffff, 0.6).fillCircle(9, 25, 1.2).fillCircle(21, 25, 1);
	}),
	lilystool: def(30, 24, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(15, 12, 28, 16); // the pad
		g.fillStyle(C('#6da84e'), 1).fillEllipse(15, 11, 25, 14);
		g.fillStyle(C('#8a7a60'), 1).fillTriangle(15, 11, 27, 6, 27, 16); // the notch, cut to the wood
		g.lineStyle(0.7, C('#3f6b32'), 0.8); // veins
		for (let i = 0; i < 7; i++) {
			const an = (i / 7) * Math.PI * 2 + 0.5;
			g.lineBetween(15, 11, 15 + Math.cos(an) * 12, 11 + Math.sin(an) * 6.5);
		}
		g.fillStyle(C('#6e4a33'), 1).fillRect(8, 17, 2.4, 6).fillRect(20, 17, 2.4, 6); // legs
	}),
	sandgarden: def(34, 24, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(2, 6, 30, 16, 2); // tray
		g.fillStyle(C('#e0c08a'), 1).fillRect(4, 8, 26, 12); // red sand
		g.lineStyle(0.8, C('#c4a068'), 1); // raked rings
		for (let i = 1; i <= 4; i++) g.strokeEllipse(12, 14, 6 + i * 4, 4 + i * 2.6);
		g.fillStyle(C('#7f7a70'), 1).fillEllipse(12, 14, 6, 4); // three stones
		g.fillStyle(C('#8a857a'), 1).fillEllipse(24, 11, 5, 3.4);
		g.fillStyle(C('#6a6558'), 1).fillEllipse(26, 18, 4, 2.8);
		g.fillStyle(C('#a8845a'), 1).fillRect(4, 19, 26, 1.5); // the rake, left across it
	}),
	sunstonebowl: def(28, 24, (g) => {
		g.fillStyle(C('#f0a84a'), 0.3).fillEllipse(14, 12, 26, 20); // the warmth coming off it
		g.fillStyle(C('#a8653a'), 1).fillEllipse(14, 18, 22, 10); // clay bowl
		g.fillStyle(C('#8a4a28'), 1).fillEllipse(14, 14, 22, 8);
		g.fillStyle(C('#f0a84a'), 1).fillEllipse(14, 14, 17, 5.5); // the chips inside
		g.fillStyle(C('#ffd88a'), 1).fillCircle(10, 13, 2).fillCircle(15, 14, 2.4).fillCircle(19, 13, 1.7);
		g.fillStyle(0xffffff, 0.7).fillCircle(15, 13, 1);
	}),
	snowglobe: def(28, 32, (g) => {
		g.fillStyle(C('#5a3f28'), 1).fillRoundedRect(6, 24, 16, 6, 2); // plinth
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(8, 22, 12, 3, 1);
		g.fillStyle(C('#cfe6f2'), 0.5).fillCircle(14, 14, 11); // glass
		g.fillStyle(C('#efe7d6'), 1).fillEllipse(14, 22, 18, 6); // snow floor
		g.fillStyle(C('#8fa8b8'), 1).fillTriangle(6, 22, 13, 7, 20, 22); // the ridge
		g.fillStyle(C('#efe7d6'), 1).fillTriangle(10, 13, 13, 7, 16, 13); // snowcap
		g.fillStyle(C('#3f6b32'), 1).fillTriangle(17, 22, 20, 15, 23, 22); // a pine
		g.fillStyle(0xffffff, 0.95); // the blizzard
		const flakes: [number, number, number][] = [
			[9, 10, 1],
			[19, 9, 0.8],
			[12, 17, 0.9],
			[21, 17, 0.7],
			[16, 12, 0.7],
			[7, 17, 0.7],
		];
		for (const [x, y, r] of flakes) g.fillCircle(x, y, r);
		g.fillStyle(0xffffff, 0.4).fillEllipse(10, 9, 6, 4); // glass highlight
	}),
	cocoastand: def(26, 30, (g) => {
		g.fillStyle(C('#5a5048'), 1).fillRoundedRect(5, 24, 16, 3, 1); // stand
		g.lineStyle(1.6, C('#5a5048'), 1).lineBetween(8, 24, 8, 18).lineBetween(18, 24, 18, 18);
		g.fillStyle(C('#e8954f'), 0.55).fillEllipse(13, 25, 12, 4); // the little flame under it
		g.fillStyle(C('#a8653a'), 1).fillRoundedRect(5, 10, 16, 9, 3); // pot
		g.fillStyle(C('#8a4a28'), 1).fillRoundedRect(5, 9, 16, 2.4, 1); // rim
		g.fillStyle(C('#8a4a28'), 1).fillRoundedRect(20, 12, 4, 5, 2); // handle
		g.fillStyle(C('#5a3f28'), 1).fillEllipse(13, 9, 12, 3); // cocoa, right to the top
		g.fillStyle(C('#e8dcc0'), 0.8).fillEllipse(11, 8.6, 5, 2); // a marshmallow
		g.fillStyle(0xffffff, 0.35).fillEllipse(13, 5, 7, 4); // steam
		g.fillStyle(0xffffff, 0.22).fillEllipse(15, 2, 5, 3);
	}),
	modelboat: def(34, 30, (g) => {
		g.fillStyle(C('#5a4028'), 1).fillRoundedRect(9, 26, 16, 3, 1); // display stand
		g.fillStyle(C('#8a6a48'), 1).fillTriangle(6, 22, 28, 22, 24, 26).fillRoundedRect(6, 20, 22, 4, 2); // hull
		g.fillStyle(C('#a8845a'), 1).fillRect(6, 20, 22, 1.6); // gunwale
		g.fillStyle(C('#6e4a33'), 1).fillRect(16, 4, 1.8, 16); // mast
		g.fillStyle(C('#efe7d6'), 1).fillTriangle(16, 5, 16, 19, 5, 19); // mainsail
		g.fillStyle(C('#e8dcc0'), 1).fillTriangle(18, 7, 18, 19, 27, 19); // jib
		g.lineStyle(0.5, C('#8a7a60'), 1).lineBetween(17, 4, 27, 19).lineBetween(17, 4, 6, 19); // real thread
		g.fillStyle(C('#c04a5a'), 1).fillTriangle(17, 3, 17, 6, 22, 4.5); // pennant
	}),
	lighthouselamp: def(26, 36, (g) => {
		g.fillStyle(C('#8a857a'), 1).fillEllipse(13, 33, 20, 6); // rock base
		g.fillStyle(C('#efe7d6'), 1).fillTriangle(7, 32, 19, 32, 16, 8).fillTriangle(7, 32, 10, 8, 16, 8); // tower
		g.fillStyle(C('#e8544a'), 1).fillTriangle(8.4, 26, 17.6, 26, 17, 21).fillTriangle(8.4, 26, 9, 21, 17, 21); // red band
		g.fillStyle(C('#e8544a'), 1).fillRect(9.6, 12, 6.8, 3);
		g.fillStyle(C('#5a5048'), 1).fillRoundedRect(8, 7, 10, 2, 1); // gallery
		g.fillStyle(C('#fff0b8'), 1).fillRoundedRect(9.5, 2.5, 7, 5, 2); // the lamp room
		g.fillStyle(C('#5a5048'), 1).fillRoundedRect(9.5, 1, 7, 2, 1); // cap
		g.fillStyle(C('#fff0b8'), 0.42).fillTriangle(13, 5, 26, 0, 26, 11); // the beam, going round
		g.fillStyle(C('#fff0b8'), 0.18).fillTriangle(13, 5, 0, 1, 0, 10);
	}),
};

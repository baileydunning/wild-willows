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
};

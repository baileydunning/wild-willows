// Ground, water, grass, the surround past the fence, and the small shared
// pieces (shadow, glow, ring, ghost) every other sprite leans on.

import Phaser from 'phaser';
import { C, tex } from './canvas';
import { makeWaterDetailTextures } from './tiles';

export function makeBaseTextures(scene: Phaser.Scene) {
	// ground tile (white — tinted per biome/health at runtime)
	tex(scene, 'tile', 32, 32, (g) => {
		g.fillStyle(0xffffff, 1).fillRect(0, 0, 32, 32);
		g.fillStyle(0xe9e9e9, 1);
		for (let i = 0; i < 6; i++) g.fillRect((i * 13) % 30, (i * 7 + 4) % 30, 2, 2);
	});
	tex(scene, 'shadow', 36, 14, (g) => {
		g.fillStyle(0x1a2012, 0.22).fillEllipse(18, 7, 34, 11);
	});
	// ground doodads (scattered by biome health)
	tex(scene, 'tuft', 14, 12, (g) => {
		g.lineStyle(2, C('#5f9e44'), 0.9);
		g.lineBetween(3, 11, 2, 4).lineBetween(7, 11, 7, 2).lineBetween(11, 11, 12, 4);
	});
	// Tall boundary/surround grass — three clump shapes × four biome palettes
	// (drawn in real colors, NOT runtime tints — multiply-tinting green blades
	// just muddies them). The overgrown surround mixes all three shapes so the
	// growth never reads as a repeat.
	const grassSet = (prefix: string, dark: string, light: string, head: string | null) => {
		// upright clump with seed heads
		tex(scene, prefix, 18, 26, (g) => {
			g.lineStyle(2, C(dark), 0.95);
			g.lineBetween(3, 25, 1, 8).lineBetween(8, 25, 7, 3).lineBetween(13, 25, 15, 7);
			g.lineStyle(2, C(light), 0.9);
			g.lineBetween(5, 25, 4, 5).lineBetween(11, 25, 12, 4).lineBetween(16, 25, 17, 10);
			if (head) g.fillStyle(C(head), 0.9).fillEllipse(7, 3, 3, 5).fillEllipse(12, 4, 3, 5);
		});
		// wider, wind-bent clump, blades draping right
		tex(scene, `${prefix}2`, 20, 24, (g) => {
			g.lineStyle(2, C(dark), 0.95);
			g.lineBetween(4, 23, 2, 6).lineBetween(9, 23, 11, 4).lineBetween(14, 23, 18, 8);
			g.lineStyle(2, C(light), 0.9);
			g.lineBetween(6, 23, 6, 3).lineBetween(12, 23, 15, 6);
			if (head) g.fillStyle(C(head), 0.85).fillEllipse(15, 6, 3, 5);
		});
		// shorter, bushier tussock — no seed heads
		tex(scene, `${prefix}3`, 16, 20, (g) => {
			g.lineStyle(2, C(dark), 0.95);
			g.lineBetween(3, 19, 1, 7).lineBetween(6, 19, 5, 4).lineBetween(9, 19, 9, 3);
			g.lineBetween(12, 19, 13, 5).lineBetween(15, 19, 16, 8);
		});
	};
	grassSet('tallgrass', '#4f8a3c', '#5f9e44', '#b9c98a'); // lush green (meadow/forest/wetland)
	grassSet('drygrass', '#a8874a', '#c4a75e', '#e0cf96'); // sun-cured desert straw
	grassSet('palegrass', '#7c8a6e', '#98a687', '#cfd8c2'); // hardy alpine sage
	grassSet('dunegrass', '#9a9a55', '#b5b06a', '#e3d8a0'); // salt-bleached dune grass
	// wild tree — fills the forest's unwalkable surround (mixed with grass) so
	// the woods read as continuing unbroken past the boundary
	tex(scene, 'wildtree', 36, 44, (g) => {
		g.fillStyle(C('#6b4a2f'), 1).fillRect(16, 28, 5, 14); // trunk
		g.fillStyle(C('#00000c'), 0.12).fillEllipse(18, 41, 24, 6); // ground shadow
		g.fillStyle(C('#4e7a3a'), 1).fillCircle(18, 18, 13).fillCircle(9, 24, 9).fillCircle(28, 23, 9);
		g.fillStyle(C('#5f9247'), 1).fillCircle(15, 14, 8).fillCircle(24, 17, 7);
		g.fillStyle(C('#77a85c'), 0.9).fillCircle(13, 11, 4).fillCircle(21, 12, 3.5);
	});
	// boundary boulder — the rocky biomes (alpine, desert, coastal) mark their
	// walkable edge with rocks instead of tall grass (tinted per biome)
	tex(scene, 'boulder', 26, 20, (g) => {
		g.fillStyle(0x8a8880, 1).fillEllipse(13, 12, 24, 15);
		g.fillStyle(0xa5a39a, 1).fillEllipse(11, 9, 14, 8);
		g.fillStyle(0xffffff, 0.22).fillEllipse(9, 7, 6, 3.5);
		g.fillStyle(0x000000, 0.15).fillEllipse(13, 18, 22, 4);
	});
	tex(scene, 'tinyflower', 10, 10, (g) => {
		g.fillStyle(0xffffff, 0.95);
		g.fillCircle(3, 5, 2.2).fillCircle(7, 5, 2.2).fillCircle(5, 3, 2.2).fillCircle(5, 7, 2.2);
		g.fillStyle(C('#e3c75f'), 1).fillCircle(5, 5, 1.6);
	});
	tex(scene, 'pebble', 10, 8, (g) => {
		g.fillStyle(0x8e8e84, 0.7).fillEllipse(5, 4, 8, 6);
		g.fillStyle(0xffffff, 0.25).fillEllipse(4, 3, 3, 2);
	});
	tex(scene, 'crack', 18, 10, (g) => {
		g.lineStyle(1.5, 0x6e5a40, 0.45);
		g.lineBetween(1, 5, 7, 4).lineBetween(7, 4, 12, 7).lineBetween(12, 7, 17, 5);
	});
	tex(scene, 'leaf-fall', 10, 10, (g) => {
		g.fillStyle(C('#8aa860'), 0.85).fillEllipse(5, 5, 9, 5);
	});
	tex(scene, 'ring', 44, 44, (g) => {
		g.lineStyle(3, 0xffffff, 1).strokeCircle(22, 22, 19);
	});
	// proper radial glow (white, so tints + additive blending work)
	tex(scene, 'glow', 56, 56, (g) => {
		g.fillStyle(0xffffff, 0.1).fillCircle(28, 28, 27);
		g.fillStyle(0xffffff, 0.16).fillCircle(28, 28, 20);
		g.fillStyle(0xffffff, 0.26).fillCircle(28, 28, 13);
		g.fillStyle(0xffffff, 0.4).fillCircle(28, 28, 7);
	});
	tex(scene, 'campfire', 34, 32, (g) => {
		g.fillStyle(C('#8e8e8a'), 1); // stone ring
		g.fillCircle(6, 26, 3.4).fillCircle(13, 29, 3.4).fillCircle(21, 29, 3.4).fillCircle(28, 26, 3.4);
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(8, 22, 18, 5, 2); // logs
		g.fillStyle(C('#6a4a30'), 1).fillRoundedRect(11, 19, 12, 5, 2);
		g.fillStyle(C('#e8954f'), 1).fillTriangle(17, 4, 9, 22, 25, 22); // flame
		g.fillStyle(C('#f4c95f'), 1).fillTriangle(17, 9, 12, 21, 22, 21);
		g.fillStyle(C('#fff3c4'), 1).fillTriangle(17, 14, 14.5, 20, 19.5, 20);
	});
	tex(scene, 'tent', 64, 52, (g) => {
		g.fillStyle(C('#b5707a'), 1).fillTriangle(2, 48, 32, 4, 62, 48); // canvas
		g.fillStyle(C('#9e5f69'), 1).fillTriangle(32, 4, 62, 48, 46, 48);
		g.fillStyle(C('#6a4a3a'), 1).fillTriangle(32, 12, 22, 48, 42, 48); // opening
		g.lineStyle(2, C('#8c6a42'), 1).lineBetween(32, 4, 32, 0);
	});
	// Home exteriors — what the meadow camp building looks like once you've built it.
	tex(scene, 'home-cabin', 66, 58, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(8, 26, 50, 30); // log walls
		g.lineStyle(1, C('#5a3a26'), 0.7);
		for (let y = 31; y < 56; y += 6) g.lineBetween(8, y, 58, y);
		g.fillStyle(C('#4a3322'), 1).fillTriangle(2, 28, 33, 5, 64, 28); // roof
		g.fillStyle(C('#caa15e'), 1).fillRect(28, 40, 12, 16); // door
		g.fillStyle(C('#cfe6f2'), 1).fillRect(14, 33, 8, 8).fillRect(44, 33, 8, 8); // windows
		g.fillStyle(C('#5a3a26'), 1).fillRect(48, 8, 7, 15); // chimney
	});
	tex(scene, 'home-cottage', 66, 58, (g) => {
		g.fillStyle(C('#efe4c8'), 1).fillRect(8, 26, 50, 30); // pale plaster walls
		g.fillStyle(C('#7e96ab'), 1).fillTriangle(2, 28, 33, 5, 64, 28); // blue-grey roof
		g.fillStyle(C('#a86f80'), 1).fillRect(28, 40, 12, 16); // door
		g.fillStyle(C('#cfe6f2'), 1).fillRect(14, 33, 9, 9).fillRect(43, 33, 9, 9);
		g.lineStyle(1.5, C('#7e96ab'), 1).strokeRect(14, 33, 9, 9).strokeRect(43, 33, 9, 9);
		g.fillStyle(C('#5e8a4a'), 1).fillRect(8, 53, 50, 3); // window box greenery
		[16, 24, 42, 50].forEach((sx) => {
			g.fillStyle(C('#e86a6a'), 1).fillCircle(sx, 53, 2);
		});
	});
	tex(scene, 'home-stone', 66, 58, (g) => {
		g.fillStyle(C('#8a857c'), 1).fillRect(8, 26, 50, 30); // stone block walls
		g.lineStyle(1, C('#6f6a62'), 0.8);
		for (let y = 32; y < 56; y += 7) g.lineBetween(8, y, 58, y);
		for (let x = 18; x < 58; x += 12) g.lineBetween(x, 26, x, 56);
		g.fillStyle(C('#5b5650'), 1).fillTriangle(2, 28, 33, 5, 64, 28); // slate roof
		g.fillStyle(C('#6e4a33'), 1).fillRect(28, 40, 12, 16); // door
		g.fillStyle(C('#f3d98a'), 1).fillRect(14, 33, 8, 8).fillRect(44, 33, 8, 8); // warm-lit windows
		g.fillStyle(C('#6f6a62'), 1).fillRect(47, 8, 8, 16); // chimney
	});
	tex(scene, 'tilled', 30, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(1, 1, 28, 28, 7);
		g.lineStyle(2.5, C('#6e5238'), 0.9);
		g.lineBetween(5, 8, 25, 8).lineBetween(5, 15, 25, 15).lineBetween(5, 22, 25, 22);
	});
	// Open water is edge-aware — sixteen shapes, one per neighbour combination —
	// so a dug channel reads as one body of water rather than a row of puddles.
	// Those shapes are rasterized on demand (ensureWaterTile); only the ripples
	// scattered over the surface are registered here.
	makeWaterDetailTextures(scene);
	tex(scene, 'watered', 30, 30, (g) => {
		g.fillStyle(C('#6a4f34'), 1).fillRoundedRect(1, 1, 28, 28, 7);
		g.lineStyle(2.5, C('#54402a'), 0.9);
		g.lineBetween(5, 8, 25, 8).lineBetween(5, 15, 25, 15).lineBetween(5, 22, 25, 22);
		g.fillStyle(C('#8fd0e8'), 0.55).fillCircle(9, 11, 2.4).fillCircle(20, 18, 2.4).fillCircle(14, 24, 2);
		g.fillStyle(C('#7fb86a'), 1).fillEllipse(22, 7, 4, 6); // little sprout
	});
	// mini tools (shown during gather/terraform animations)
	tex(scene, 'tool-basket', 22, 20, (g) => {
		g.fillStyle(C('#c9a35c'), 1).fillRoundedRect(2, 7, 18, 11, { tl: 2, tr: 2, bl: 8, br: 8 });
		g.lineStyle(2, C('#a3814f'), 1).strokeCircle(11, 7, 6);
		g.lineStyle(1.5, C('#a3814f'), 1).lineBetween(4, 11, 18, 11).lineBetween(5, 14, 17, 14);
	});
	tex(scene, 'tool-shovel', 22, 24, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(9.5, 1, 3, 13);
		g.fillStyle(C('#8c9aa8'), 1).fillRoundedRect(6, 13, 10, 10, { tl: 2, tr: 2, bl: 5, br: 5 });
		g.fillStyle(C('#7c5a3c'), 1).fillRect(7, 0, 8, 3);
	});
	tex(scene, 'tool-watering-can', 26, 20, (g) => {
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(6, 6, 14, 12, 3);
		g.fillStyle(C('#7a9ac0'), 1).fillTriangle(2, 16, 8, 8, 8, 14);
		g.fillStyle(C('#6788ae'), 1).fillCircle(2.5, 14.5, 2.2);
		g.lineStyle(2, C('#6788ae'), 1).strokeCircle(16, 6, 4);
	});
	// alpine mountain range backdrop — layered snow-capped peaks
	tex(scene, 'mtnridge', 420, 150, (g) => {
		// far range (hazy blue-gray)
		g.fillStyle(C('#8a93a6'), 1);
		const far: [number, number][] = [
			[0, 150],
			[40, 70],
			[90, 110],
			[150, 50],
			[210, 100],
			[270, 58],
			[340, 104],
			[390, 64],
			[420, 110],
			[420, 150],
		];
		g.fillPoints(
			far.map(([x, y]) => new Phaser.Geom.Point(x, y)),
			true,
		);
		// near range (cool gray)
		g.fillStyle(C('#6b7384'), 1);
		const near: [number, number][] = [
			[0, 150],
			[60, 40],
			[120, 96],
			[185, 24],
			[250, 92],
			[320, 30],
			[380, 90],
			[420, 50],
			[420, 150],
		];
		g.fillPoints(
			near.map(([x, y]) => new Phaser.Geom.Point(x, y)),
			true,
		);
		// snow caps on the tall near peaks
		g.fillStyle(C('#eef4fb'), 1);
		g.fillTriangle(185, 24, 168, 52, 202, 52);
		g.fillTriangle(320, 30, 305, 56, 335, 56);
		g.fillTriangle(60, 40, 47, 64, 73, 64);
		g.fillTriangle(420, 50, 405, 74, 435, 74);
		// little snow streaks down the faces
		g.fillStyle(0xffffff, 0.85);
		g.fillTriangle(185, 30, 180, 50, 190, 50);
		g.fillTriangle(320, 36, 316, 54, 324, 54);
	});
}

// Procedural placeholder art — every sprite in Wild Willows is generated at
// boot from simple shapes, so the game ships with zero asset files.

import Phaser from 'phaser';
import { bridge } from './bridge';
import { hatPalette, flowerPalette } from '../color';

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

type G = Phaser.GameObjects.Graphics;

/**
 * Supersampling factor for all procedural textures. Shapes are authored in
 * "logical" pixels (32px tiles) but rasterized TEX_SCALE× larger so they stay
 * crisp under camera zoom + HiDPI. Every sprite must render at
 * `INV_TEX_SCALE` scale to appear at its logical size — WorldScene's `img()`
 * helper does this. Power of two so logical sizes stay float-exact (no tile seams).
 */
export const TEX_SCALE = 4;
export const INV_TEX_SCALE = 1 / TEX_SCALE;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
	if (scene.textures.exists(key)) return;
	const g = scene.make.graphics({ x: 0, y: 0 }, false);
	g.scaleCanvas(TEX_SCALE, TEX_SCALE); // rasterize the logical-pixel draw commands 4× sharper
	draw(g);
	g.generateTexture(key, w * TEX_SCALE, h * TEX_SCALE);
	g.destroy();
}

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
		g.fillStyle(0xffffff, 0.10).fillCircle(28, 28, 27);
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
		g.lineStyle(1, C('#5a3a26'), 0.7); for (let y = 31; y < 56; y += 6) g.lineBetween(8, y, 58, y);
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
		[16, 24, 42, 50].forEach((sx) => { g.fillStyle(C('#e86a6a'), 1).fillCircle(sx, 53, 2); });
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
	tex(scene, 'terrain-water', 32, 32, (g) => {
		g.fillStyle(C('#4a7ba8'), 1).fillRoundedRect(0, 0, 32, 32, 5);
		g.fillStyle(C('#5d96c8'), 1).fillRoundedRect(2, 2, 28, 28, 5);
		g.lineStyle(2, C('#8fc0e0'), 0.8);
		g.lineBetween(6, 11, 14, 11).lineBetween(16, 20, 25, 20).lineBetween(8, 26, 15, 26);
		g.fillStyle(0xffffff, 0.5).fillCircle(23, 8, 1.6);
	});
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
		const far: [number, number][] = [[0, 150], [40, 70], [90, 110], [150, 50], [210, 100], [270, 58], [340, 104], [390, 64], [420, 110], [420, 150]];
		g.fillPoints(far.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
		// near range (cool gray)
		g.fillStyle(C('#6b7384'), 1);
		const near: [number, number][] = [[0, 150], [60, 40], [120, 96], [185, 24], [250, 92], [320, 30], [380, 90], [420, 50], [420, 150]];
		g.fillPoints(near.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
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

/**
 * Gathering spots — every material gets its own recognizable little sprite so
 * players can see at a glance what's scavengeable.
 */
export function makeNodeTextures(scene: Phaser.Scene) {
	const n = (id: string, w: number, h: number, draw: (g: G) => void) => tex(scene, `rnode-${id}`, w, h, draw);

	n('seeds', 28, 28, (g) => {
		g.lineStyle(2, C('#8aa860'), 1);
		g.lineBetween(8, 26, 6, 10).lineBetween(14, 26, 14, 6).lineBetween(20, 26, 22, 10);
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(6, 8, 6, 8).fillEllipse(14, 5, 6, 8).fillEllipse(22, 8, 6, 8);
	});
	n('geode', 28, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(9, 15, 8); // rough half
		g.fillStyle(C('#6a5a7a'), 1).fillCircle(19, 13, 9); // opened half
		g.fillStyle(C('#a98fd0'), 1).fillCircle(19, 13, 5.5); // crystal lining
		g.fillStyle(C('#e0d4f4'), 1).fillTriangle(16, 13, 19, 7, 22, 13).fillTriangle(19, 15, 22, 10, 25, 15);
	});
	n('agave-nectar', 28, 28, (g) => {
		g.fillStyle(C('#6f8a6a'), 1); // blue-green agave rosette
		for (const ang of [-1.2, -0.5, 0.2, 0.9, 2.4, 3.6]) g.fillTriangle(13, 20, 13 + Math.sin(ang) * 12 - 2, 20 - Math.cos(ang) * 12, 13 + Math.sin(ang) * 12 + 2, 20 - Math.cos(ang) * 12 + 3);
		g.lineStyle(2, C('#9a8a52'), 1).lineBetween(13, 18, 21, 4); // bloom stalk
		g.fillStyle(C('#e3b93f'), 1).fillCircle(21, 4, 3); // golden nectar bloom
		g.fillStyle(C('#f4e08a'), 1).fillCircle(20, 3, 1.2);
	});
	n('berries', 30, 26, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(10, 17, 8).fillCircle(20, 16, 9).fillCircle(15, 10, 8);
		g.fillStyle(C('#c14a6a'), 1).fillCircle(10, 14, 3).fillCircle(19, 11, 3).fillCircle(23, 18, 3).fillCircle(13, 20, 2.6);
		g.fillStyle(0xffffff, 0.5).fillCircle(9, 13, 1).fillCircle(18, 10, 1);
	});
	n('stones', 28, 22, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(9, 14, 8).fillCircle(20, 15, 6);
		g.fillStyle(C('#a8a8a4'), 1).fillCircle(15, 9, 6);
		g.fillStyle(0xffffff, 0.3).fillCircle(13, 7, 2).fillCircle(7, 11, 1.6);
	});
	n('branches', 32, 22, (g) => {
		g.lineStyle(4, C('#8a6a44'), 1);
		g.lineBetween(3, 17, 28, 9);
		g.lineStyle(3.4, C('#7c5a3c'), 1).lineBetween(5, 9, 29, 17);
		g.lineStyle(2.4, C('#9a7448'), 1).lineBetween(10, 19, 24, 4);
	});
	n('wildflowers', 30, 26, (g) => {
		const cols = ['#d77bb1', '#e8954f', '#c45ad0'];
		cols.forEach((c, i) => {
			const x = 6 + i * 9;
			g.lineStyle(2, C('#5f9e44'), 1).lineBetween(x, 11 + (i % 2) * 4, x, 24);
			[[-3, 0], [3, 0], [0, -3], [0, 3]].forEach(([dx, dy]) => g.fillStyle(C(c), 1).fillCircle(x + dx, 8 + (i % 2) * 4 + dy, 2.6));
			g.fillStyle(C('#fff3c4'), 1).fillCircle(x, 8 + (i % 2) * 4, 2);
		});
	});
	n('reeds', 26, 30, (g) => {
		g.lineStyle(2.4, C('#7fa05a'), 1);
		g.lineBetween(6, 28, 5, 6).lineBetween(13, 28, 13, 3).lineBetween(20, 28, 21, 6);
		g.fillStyle(C('#8a6a44'), 1).fillEllipse(5, 7, 4.4, 9).fillEllipse(13, 4, 4.4, 9).fillEllipse(21, 7, 4.4, 9);
	});
	n('clay', 28, 20, (g) => {
		g.fillStyle(C('#b07a52'), 1).fillEllipse(14, 13, 26, 13);
		g.lineStyle(2, C('#925f3e'), 1).strokeEllipse(14, 13, 16, 7);
		g.fillStyle(C('#c08a60'), 1).fillEllipse(11, 9, 8, 4);
	});
	n('water', 30, 22, (g) => {
		g.fillStyle(C('#b9c8a0'), 1).fillEllipse(15, 12, 30, 18);
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(15, 12, 24, 13);
		g.fillStyle(0xffffff, 0.55).fillEllipse(11, 9, 8, 3.4);
		g.fillStyle(0xffffff, 0.85).fillCircle(20, 8, 1.4);
	});
	n('fiber', 26, 26, (g) => {
		g.lineStyle(2.2, C('#b8b06a'), 1);
		g.lineBetween(6, 24, 3, 6).lineBetween(11, 24, 10, 3).lineBetween(16, 24, 17, 4).lineBetween(21, 24, 24, 7);
	});
	n('mushrooms', 28, 24, (g) => {
		g.fillStyle(C('#f0e2cc'), 1).fillRoundedRect(7, 12, 5, 10, 2).fillRoundedRect(18, 14, 5, 8, 2);
		g.fillStyle(C('#c0563e'), 1).fillEllipse(9.5, 11, 14, 9);
		g.fillStyle(C('#c8997a'), 1).fillEllipse(20.5, 13, 11, 7);
		g.fillStyle(0xffffff, 0.8).fillCircle(6, 9, 1.6).fillCircle(12, 11, 1.4);
	});
	n('pinecones', 26, 24, (g) => {
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(13, 5, 18, 7);
		g.fillStyle(C('#7d5b3a'), 1).fillEllipse(9, 15, 9, 13).fillEllipse(18, 16, 8, 11);
		g.lineStyle(1.4, C('#5d4128'), 1);
		g.lineBetween(5, 13, 13, 15).lineBetween(5, 18, 13, 19).lineBetween(14, 14, 22, 16);
	});
	n('acorns', 26, 22, (g) => {
		g.fillStyle(C('#a07a3e'), 1).fillEllipse(9, 14, 10, 12).fillEllipse(19, 15, 9, 11);
		g.fillStyle(C('#6e553c'), 1).fillEllipse(9, 8, 11, 6).fillEllipse(19, 10, 10, 5);
		g.fillStyle(C('#6e553c'), 1).fillRect(8, 4, 2, 4).fillRect(18, 6, 2, 4);
	});
	n('sand', 28, 18, (g) => {
		g.fillStyle(C('#dcc890'), 1).fillEllipse(14, 11, 26, 12);
		g.fillStyle(C('#c9b276'), 1).fillCircle(8, 10, 1.4).fillCircle(15, 13, 1.4).fillCircle(20, 9, 1.4);
	});
	n('shells', 24, 20, (g) => {
		g.fillStyle(C('#e6d8c8'), 1).fillEllipse(12, 13, 18, 13);
		g.lineStyle(1.6, C('#c8a8a0'), 1);
		g.lineBetween(12, 6, 6, 17).lineBetween(12, 6, 12, 18).lineBetween(12, 6, 18, 17);
		g.fillStyle(C('#d8b8b0'), 1).fillCircle(12, 6, 2.4);
	});
	n('driftwood', 32, 18, (g) => {
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(2, 7, 28, 8, 4);
		g.fillStyle(C('#c4b6a0'), 1).fillRoundedRect(6, 3, 16, 6, 3);
	});
	n('alpine-flowers', 28, 24, (g) => {
		['#9d86d9', '#b8a8e8'].forEach((c, i) => {
			const x = 8 + i * 12;
			g.lineStyle(2, C('#6a8a5a'), 1).lineBetween(x, 12, x, 22);
			[[-3, 0], [3, 0], [0, -3], [0, 3]].forEach(([dx, dy]) => g.fillStyle(C(c), 1).fillCircle(x + dx, 9 + dy, 2.8));
			g.fillStyle(C('#fff3c4'), 1).fillCircle(x, 9, 2);
		});
	});
	n('cactus-fruit', 26, 28, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillRoundedRect(9, 6, 8, 21, 4);
		g.fillStyle(C('#d96a5a'), 1).fillCircle(13, 5, 3.4).fillCircle(7, 12, 3).fillCircle(19, 14, 3);
	});
	n('mud', 28, 18, (g) => {
		g.fillStyle(C('#7a6a52'), 1).fillEllipse(14, 11, 26, 12);
		g.fillStyle(C('#695a44'), 1).fillEllipse(11, 10, 12, 6);
		g.fillStyle(0xffffff, 0.18).fillEllipse(18, 8, 6, 2.4);
	});
	n('clean-water', 30, 22, (g) => {
		g.fillStyle(C('#a8c8b9'), 1).fillEllipse(15, 12, 30, 18);
		g.fillStyle(C('#8fd0e8'), 1).fillEllipse(15, 12, 24, 13);
		g.fillStyle(0xffffff, 0.7).fillEllipse(11, 9, 9, 3.6);
		g.fillStyle(0xffffff, 1).fillCircle(20, 8, 1.6);
	});
	n('bark', 26, 22, (g) => {
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(4, 4, 8, 16, 3);
		g.fillStyle(C('#7c6248'), 1).fillRoundedRect(14, 7, 8, 13, 3);
		g.lineStyle(1.4, C('#54402a'), 1).lineBetween(8, 6, 8, 18).lineBetween(18, 9, 18, 18);
	});
	n('moss', 28, 20, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 13, 22, 12);
		g.fillStyle(C('#5d8a4a'), 1).fillCircle(9, 9, 5).fillCircle(16, 7, 5.4).fillCircle(21, 11, 4.4);
		g.fillStyle(C('#74a85e'), 1).fillCircle(12, 6, 3).fillCircle(19, 7, 2.6);
	});
	n('quartz-crystal', 28, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 22, 22, 7); // rock base
		g.fillStyle(C('#9fcfe0'), 1).fillTriangle(7, 22, 13, 22, 9, 6); // crystal cluster
		g.fillStyle(C('#cfe8f2'), 1).fillTriangle(12, 22, 19, 22, 16, 3);
		g.fillStyle(C('#bfe0ee'), 1).fillTriangle(17, 22, 23, 22, 21, 9);
		g.fillStyle(0xffffff, 0.9).fillCircle(16, 7, 1.2).fillCircle(9, 10, 1);
	});
	n('pine-nuts', 28, 26, (g) => {
		g.fillStyle(C('#6f5a3a'), 1).fillEllipse(9, 11, 12, 16); // open cone
		g.lineStyle(1.2, C('#4f3f28'), 1).lineBetween(4, 8, 14, 10).lineBetween(4, 13, 14, 14).lineBetween(5, 17, 13, 17);
		g.fillStyle(C('#c8a86a'), 1).fillEllipse(18, 18, 6, 8).fillEllipse(23, 20, 5, 7).fillEllipse(20, 13, 5, 7); // shed nuts
		g.fillStyle(C('#e0c690'), 0.8).fillCircle(17, 16, 1.2).fillCircle(22, 18, 1.2);
	});
	n('lichen', 28, 22, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 14, 24, 13); // stone
		g.fillStyle(C('#9fb38a'), 1).fillCircle(9, 12, 4.5).fillCircle(18, 11, 4).fillCircle(22, 16, 3.4); // crusty lichen
		g.fillStyle(C('#c2cf9e'), 1).fillCircle(9, 12, 2.4).fillCircle(18, 11, 2);
		g.fillStyle(C('#d9a24a'), 1).fillCircle(14, 15, 1.4); // map-lichen
	});
	n('snow', 28, 20, (g) => {
		g.fillStyle(C('#cdd9e8'), 1).fillEllipse(14, 13, 26, 11);
		g.fillStyle(C('#eef4fb'), 1).fillEllipse(14, 11, 24, 10);
		g.fillStyle(0xffffff, 1).fillEllipse(10, 9, 11, 5);
		g.fillStyle(0xffffff, 0.95).fillCircle(20, 7, 1.2).fillCircle(8, 13, 1).fillCircle(17, 13, 1);
	});
	n('juniper-berries', 26, 26, (g) => {
		g.lineStyle(2, C('#5d7a66'), 1).lineBetween(13, 24, 13, 8); // sprig
		g.fillStyle(C('#5d7a66'), 1); // needles
		for (const [x, y] of [[7, 12], [19, 12], [9, 17], [17, 17]] as const) g.fillTriangle(13, y, x, y - 3, x, y + 1);
		g.fillStyle(C('#6a7fa0'), 1).fillCircle(9, 9, 3).fillCircle(17, 10, 3).fillCircle(13, 14, 3); // frosted berries
		g.fillStyle(0xffffff, 0.4).fillCircle(8, 8, 1).fillCircle(16, 9, 1).fillCircle(12, 13, 1);
	});
	n('obsidian', 28, 22, (g) => {
		g.fillStyle(C('#2e2b38'), 1).fillTriangle(6, 18, 14, 18, 8, 5); // glassy shards
		g.fillStyle(C('#3a3648'), 1).fillTriangle(12, 18, 22, 18, 18, 7);
		g.fillStyle(C('#46435a'), 1).fillTriangle(18, 18, 25, 18, 23, 10);
		g.fillStyle(0xffffff, 0.45).lineStyle(1, 0xffffff, 0.45);
		g.fillRect(9, 9, 1.4, 7).fillRect(18, 11, 1.4, 6); // sharp highlights
	});
	n('kelp', 26, 30, (g) => {
		g.lineStyle(3, C('#3f6432'), 1); // bull-kelp stipes
		g.lineBetween(8, 28, 6, 8).lineBetween(14, 28, 14, 5).lineBetween(20, 28, 22, 9);
		g.fillStyle(C('#4f7a3f'), 1); // floats + blades
		g.fillCircle(6, 7, 3).fillCircle(14, 4, 3.2).fillCircle(22, 8, 3);
		g.fillStyle(C('#6f9a52'), 1).fillEllipse(3, 13, 5, 9).fillEllipse(25, 14, 5, 9);
	});
	n('sea-glass', 26, 22, (g) => {
		g.fillStyle(C('#dcc890'), 1).fillEllipse(13, 16, 22, 9); // wet sand
		g.fillStyle(C('#8fc6c2'), 0.92).fillRoundedRect(4, 6, 8, 7, 2); // frosted shards
		g.fillStyle(C('#a9d8d0'), 0.92).fillRoundedRect(13, 9, 7, 6, 2);
		g.fillStyle(C('#bcd8e6'), 0.92).fillTriangle(9, 3, 14, 9, 5, 10);
		g.fillStyle(0xffffff, 0.5).fillCircle(7, 8, 1).fillCircle(16, 11, 1);
	});
	n('coral', 28, 26, (g) => {
		g.fillStyle(C('#cdbfa0'), 1).fillEllipse(14, 22, 24, 8); // sandy base
		g.fillStyle(C('#e58b6f'), 1); // branching coral
		g.fillRoundedRect(11, 6, 5, 16, 2).fillRoundedRect(5, 11, 4, 11, 2).fillRoundedRect(18, 9, 4, 13, 2);
		g.fillStyle(C('#f2a98f'), 1).fillCircle(13, 6, 3).fillCircle(7, 11, 2.6).fillCircle(20, 9, 2.6);
		g.fillStyle(0xffffff, 0.35).fillCircle(12, 6, 1.2);
	});
	n('pearl', 24, 22, (g) => {
		g.fillStyle(C('#c8b8a8'), 1).fillEllipse(12, 15, 22, 13); // open shell
		g.lineStyle(1.4, C('#a89a88'), 1);
		g.lineBetween(12, 5, 4, 16).lineBetween(12, 5, 12, 17).lineBetween(12, 5, 20, 16);
		g.fillStyle(C('#f2ece0'), 1).fillCircle(12, 13, 4.4); // the pearl
		g.fillStyle(0xffffff, 0.85).fillCircle(10, 11, 1.6);
	});
	tex(scene, 'gate', 40, 44, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRect(2, 6, 6, 38).fillRect(32, 6, 6, 38);
		g.fillStyle(C('#a3814f'), 1).fillRect(0, 2, 40, 6);
	});
	tex(scene, 'sign', 28, 32, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRect(12, 12, 5, 20);
		g.fillStyle(C('#b59264'), 1).fillRect(0, 0, 28, 14);
		g.lineStyle(1, C('#7c5a3c'), 1).strokeRect(0, 0, 28, 14);
	});
	tex(scene, 'node', 26, 26, (g) => {
		g.fillStyle(0xffffff, 1).fillCircle(13, 14, 10);
		g.fillStyle(0xffffff, 0.5).fillCircle(9, 9, 4);
	});
	tex(scene, 'sprout', 20, 20, (g) => {
		g.fillStyle(C('#7fa05a'), 0.8);
		g.fillEllipse(10, 13, 4, 10).fillEllipse(6, 14, 6, 4).fillEllipse(14, 14, 6, 4);
	});
	tex(scene, 'ghost-ok', 36, 36, (g) => {
		g.fillStyle(0x7fd87f, 0.35).fillRect(0, 0, 36, 36);
		g.lineStyle(2, 0x4caf50, 0.9).strokeRect(1, 1, 34, 34);
	});
	tex(scene, 'ghost-bad', 36, 36, (g) => {
		g.fillStyle(0xd87f7f, 0.35).fillRect(0, 0, 36, 36);
		g.lineStyle(2, 0xc0392b, 0.9).strokeRect(1, 1, 34, 34);
	});
}

/** Habitat / home object sprites, keyed `obj-<shape>`. */
export function makeObjectTextures(scene: Phaser.Scene) {
	const o = (shape: string, w: number, h: number, draw: (g: G) => void) => tex(scene, `obj-${shape}`, w, h, draw);

	// ---- indoor furniture (the home interior) ----
	o('rug', 42, 30, (g) => {
		g.fillStyle(C('#b5707a'), 1).fillRoundedRect(3, 6, 36, 20, 6);
		g.fillStyle(C('#e3c75f'), 1).fillRoundedRect(7, 10, 28, 12, 4);
		g.fillStyle(C('#b5707a'), 1).fillRoundedRect(12, 13, 18, 6, 2);
	});
	o('bed', 42, 32, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 12, 34, 16, 3); // frame
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(6, 8, 13, 10, 3);  // pillow
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(17, 13, 20, 13, 3); // blanket
		g.fillStyle(C('#5d3f28'), 1).fillRect(5, 26, 3, 4).fillRect(34, 26, 3, 4);
	});
	o('bookshelf', 34, 38, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(4, 3, 26, 32, 2);
		g.fillStyle(C('#5a3a26'), 1).fillRect(4, 15, 26, 2).fillRect(4, 25, 26, 2);
		const cols = ['#b5707a', '#7a9ac0', '#e3c75f', '#6da84e', '#c45ad0'];
		for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { g.fillStyle(C(cols[(i + r) % cols.length]), 1).fillRect(7 + i * 4, 6 + r * 10, 3, 7); }
	});
	o('table', 38, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(5, 10, 28, 7, 2); // top
		g.fillStyle(C('#6e4a33'), 1).fillRect(8, 16, 3, 10).fillRect(27, 16, 3, 10); // legs
		g.fillStyle(C('#e86a6a'), 1).fillCircle(19, 9, 3); // little vase
		g.fillStyle(C('#6da84e'), 1).fillRect(18, 4, 2, 4);
	});
	o('armchair', 34, 32, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(6, 24, 22, 5, 2); // base
		g.fillStyle(C('#8a5a6a'), 1).fillRoundedRect(5, 8, 24, 18, 5); // back
		g.fillStyle(C('#a86f80'), 1).fillRoundedRect(8, 16, 18, 10, 4); // cushion
		g.fillStyle(C('#8a5a6a'), 1).fillRoundedRect(4, 14, 5, 12, 3).fillRoundedRect(25, 14, 5, 12, 3); // arms
	});
	o('fireplace', 38, 36, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(4, 6, 30, 28, 3); // stone surround
		g.fillStyle(C('#3a2a22'), 1).fillRoundedRect(11, 16, 16, 16, 2); // firebox
		g.fillStyle(C('#e8954f'), 1).fillTriangle(15, 32, 19, 20, 23, 32); // flame
		g.fillStyle(C('#f3d24a'), 1).fillTriangle(17, 32, 19, 25, 21, 32);
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 12, 32, 3); // mantel
	});
	o('lamp', 26, 38, (g) => {
		g.fillStyle(C('#f3d98a'), 0.9).fillEllipse(13, 9, 20, 12); // shade
		g.fillStyle(C('#6e4a33'), 1).fillRect(12, 12, 2, 22); // pole
		g.fillStyle(C('#5a3f28'), 1).fillEllipse(13, 35, 14, 5); // base
	});
	o('potplant', 28, 34, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(10, 12, 7).fillCircle(18, 11, 7).fillCircle(14, 6, 7);
		g.fillStyle(C('#c47a3a'), 1).fillRoundedRect(8, 20, 12, 12, 2); // pot
		g.fillStyle(C('#a8652f'), 1).fillRect(7, 19, 14, 3);
	});
	o('painting', 34, 28, (g) => {
		g.fillStyle(C('#caa15e'), 1).fillRoundedRect(3, 3, 28, 22, 2); // frame
		g.fillStyle(C('#9cc6e0'), 1).fillRect(6, 6, 22, 16); // sky
		g.fillStyle(C('#6da84e'), 1).fillRect(6, 16, 22, 6); // hills
		g.fillStyle(C('#e3c75f'), 1).fillCircle(23, 11, 3); // sun
	});
	o('sleepingbag', 42, 26, (g) => {
		g.fillStyle(C('#5b7d9a'), 1).fillRoundedRect(4, 8, 34, 14, 6); // bag
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(7, 10, 17, 10, 5); // folded-open flap
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(29, 9, 9, 12, 4); // little pillow
		g.lineStyle(1, C('#456178'), 0.8).lineBetween(12, 9, 12, 21).lineBetween(18, 9, 18, 21);
	});
	o('cushions', 34, 24, (g) => {
		g.fillStyle(C('#c98a6a'), 1).fillRoundedRect(3, 10, 18, 12, 4);
		g.fillStyle(C('#7fae6a'), 1).fillRoundedRect(13, 6, 18, 13, 4);
		g.lineStyle(1, C('#000000'), 0.12).strokeRoundedRect(13, 6, 18, 13, 4);
	});
	o('stool', 26, 28, (g) => {
		g.fillStyle(C('#a86f80'), 1).fillEllipse(13, 10, 20, 9); // cushion top
		g.fillStyle(C('#6e4a33'), 1).fillRect(6, 13, 3, 12).fillRect(17, 13, 3, 12); // legs
	});
	o('wallclock', 26, 28, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillCircle(13, 14, 12);
		g.fillStyle(C('#f3ecd6'), 1).fillCircle(13, 14, 9);
		g.lineStyle(1.5, C('#3a3a2c'), 1).lineBetween(13, 14, 13, 8).lineBetween(13, 14, 18, 14);
	});
	o('dresser', 32, 30, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillRoundedRect(4, 6, 24, 22, 2);
		g.fillStyle(C('#6e4a33'), 1).fillRect(4, 15, 24, 2);
		g.fillStyle(C('#caa15e'), 1).fillCircle(11, 11, 1.4).fillCircle(21, 11, 1.4).fillCircle(11, 21, 1.4).fillCircle(21, 21, 1.4);
	});
	o('mushroomshelf', 32, 30, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(4, 8, 24, 3).fillRect(4, 20, 24, 3);
		g.fillStyle(C('#d9756a'), 1).fillEllipse(10, 7, 9, 5); g.fillStyle(C('#efe7d6'), 1).fillRect(9, 7, 2, 3);
		g.fillStyle(C('#e3a14a'), 1).fillEllipse(20, 19, 9, 5); g.fillStyle(C('#efe7d6'), 1).fillRect(19, 19, 2, 3);
	});
	o('reedmat', 38, 24, (g) => {
		g.fillStyle(C('#b9a06a'), 1).fillRoundedRect(4, 6, 30, 14, 3);
		g.lineStyle(1, C('#8a7440'), 0.8);
		for (let i = 1; i < 6; i++) g.lineBetween(4 + i * 5, 6, 4 + i * 5, 20);
	});
	o('cactuspot', 24, 32, (g) => {
		g.fillStyle(C('#4f8a4a'), 1).fillRoundedRect(9, 6, 6, 16, 3); // cactus body
		g.fillStyle(C('#4f8a4a'), 1).fillRoundedRect(4, 12, 5, 5, 2).fillRoundedRect(15, 10, 5, 5, 2); // arms
		g.fillStyle(C('#c47a3a'), 1).fillRoundedRect(6, 22, 12, 9, 2); // pot
	});
	o('peltrug', 40, 28, (g) => {
		g.fillStyle(C('#caa15e'), 1).fillEllipse(20, 16, 30, 18);
		g.fillStyle(C('#caa15e'), 1).fillEllipse(20, 6, 10, 8); // head
		g.fillStyle(C('#efe7d6'), 1).fillEllipse(20, 16, 18, 9);
	});
	o('chandelier', 32, 30, (g) => {
		g.lineStyle(2, C('#5a3f2a'), 1).lineBetween(16, 0, 16, 8);
		g.fillStyle(C('#caa15e'), 1).fillRoundedRect(4, 8, 24, 4, 2);
		['8', '16', '24'].forEach((sx) => { const x = +sx; g.fillStyle(C('#5a3f2a'), 1).fillRect(x - 1, 11, 2, 6); g.fillStyle(C('#f3d24a'), 1).fillCircle(x, 19, 2.4); });
	});
	o('aquarium', 34, 28, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 22, 28, 4); // stand
		g.fillStyle(C('#7fb4d8'), 1).fillRoundedRect(5, 4, 24, 18, 2); // water
		g.lineStyle(2, C('#cfe0ee'), 1).strokeRoundedRect(5, 4, 24, 18, 2);
		g.fillStyle(C('#e8954f'), 1).fillEllipse(14, 12, 6, 3); g.fillStyle(C('#e3c75f'), 1).fillEllipse(22, 16, 5, 2.5);
	});
	o('telescope', 28, 34, (g) => {
		g.lineStyle(3, C('#3a3a2c'), 1).lineBetween(8, 32, 14, 16).lineBetween(20, 32, 14, 16); // tripod
		g.fillStyle(C('#5a6b7a'), 1).fillRoundedRect(10, 6, 16, 6, 3); // barrel (tilted-ish)
		g.fillStyle(C('#cfe0ee'), 1).fillCircle(25, 9, 2.5); // lens
	});
	o('driftwoodshelf', 34, 26, (g) => {
		g.fillStyle(C('#b6a68c'), 1).fillRoundedRect(3, 10, 28, 4, 2); // weathered plank
		g.fillStyle(C('#8a7a60'), 1).fillRect(6, 14, 2, 8).fillRect(25, 14, 2, 8);
		g.fillStyle(C('#e3a8b0'), 1).fillCircle(12, 8, 2.5); // shell
		g.fillStyle(C('#7fb4a0'), 1).fillCircle(20, 8, 2.5); // sea glass
	});

	o('patch', 36, 30, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 20, 34, 16);
		g.lineStyle(2, C('#4f8a38'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 5, 22, 8 + i * 5, 10);
	});
	o('flowers', 36, 32, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 24, 32, 12);
		const cols = ['#d77bb1', '#e8954f', '#e3c75f', '#c45ad0', '#e86a6a'];
		cols.forEach((c, i) => {
			const x = 6 + i * 6, y = 10 + (i % 2) * 6;
			g.lineStyle(1, C('#4f8a38'), 1).lineBetween(x, y + 4, x, 22);
			g.fillStyle(C(c), 1).fillCircle(x, y, 3.4);
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 1.2);
		});
	});
	o('bush', 36, 32, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(12, 20, 11).fillCircle(24, 18, 12).fillCircle(18, 12, 10);
		g.fillStyle(C('#5d3a5f'), 1).fillCircle(12, 14, 2.4).fillCircle(22, 11, 2.4).fillCircle(27, 20, 2.4);
	});
	o('pond', 52, 40, (g) => {
		g.fillStyle(C('#b9a37c'), 1).fillEllipse(26, 22, 52, 34);
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(26, 22, 44, 27);
		g.fillStyle(C('#8fc0e0'), 0.8).fillEllipse(22, 18, 18, 8);
	});
	o('pool', 44, 32, (g) => {
		g.fillStyle(C('#c9b98a'), 1).fillEllipse(22, 18, 44, 26);
		g.fillStyle(C('#7fb4d8'), 1).fillEllipse(22, 18, 36, 19);
		g.fillStyle(0xffffff, 0.45).fillEllipse(18, 14, 12, 5);
	});
	o('log', 42, 26, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(2, 8, 38, 14, 7);
		g.fillStyle(C('#9a7448'), 1).fillEllipse(38, 15, 8, 12);
		g.fillStyle(C('#5d4128'), 1).fillEllipse(38, 15, 4, 6);
		g.fillStyle(C('#5d8a4a'), 0.9).fillEllipse(10, 8, 10, 5);
	});
	o('rocks', 38, 30, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(12, 20, 9).fillCircle(26, 21, 8);
		g.fillStyle(C('#a8a8a4'), 1).fillCircle(19, 12, 8);
		g.fillStyle(0xffffff, 0.25).fillCircle(17, 9, 3);
	});
	o('perch', 22, 46, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(9, 4, 4, 40);
		g.fillRect(2, 8, 18, 3).fillRect(4, 18, 14, 3);
	});
	o('fence', 36, 26, (g) => {
		g.fillStyle(C('#a3814f'), 1).fillRect(2, 6, 5, 18).fillRect(29, 6, 5, 18);
		g.fillRect(0, 9, 36, 4).fillRect(0, 17, 36, 4);
	});
	o('path', 34, 26, (g) => {
		g.fillStyle(C('#c9b98a'), 1).fillRoundedRect(1, 4, 32, 18, 8);
		g.fillStyle(C('#b5a578'), 1).fillCircle(10, 13, 3).fillCircle(22, 11, 3).fillCircle(17, 17, 2.4);
	});
	o('gravel', 34, 26, (g) => {
		g.fillStyle(C('#bdb6a4'), 1).fillRoundedRect(1, 4, 32, 18, 8);
		g.fillStyle(C('#9a948a'), 1);
		const dots = [[7, 9], [13, 14], [19, 10], [25, 15], [10, 18], [22, 18], [16, 8], [28, 9]];
		for (const [x, y] of dots) g.fillCircle(x, y, 1.8);
		g.fillStyle(C('#cfcabd'), 1).fillCircle(11, 11, 1.2).fillCircle(20, 16, 1.2).fillCircle(26, 11, 1.2);
	});
	o('planks', 34, 26, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(1, 4, 32, 18, 3);
		g.fillStyle(C('#a3814f'), 1);
		for (let i = 0; i < 3; i++) g.fillRoundedRect(3, 6 + i * 5.6, 28, 4.4, 1.5); // boards
		g.lineStyle(1, C('#7c5a3c'), 1).lineBetween(11, 5, 11, 21).lineBetween(23, 5, 23, 21); // seams
	});
	o('flagstone', 34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(1, 4, 32, 18, 5);
		g.fillStyle(C('#a8a8a2'), 1);
		g.fillTriangle(3, 6, 15, 5, 9, 20).fillTriangle(15, 5, 17, 21, 5, 20); // irregular slabs
		g.fillStyle(C('#9a9a94'), 1).fillTriangle(17, 5, 31, 7, 21, 20).fillTriangle(31, 7, 31, 20, 21, 20);
		g.lineStyle(1.2, C('#6e6e68'), 0.8).lineBetween(16, 5, 19, 21); // grout
	});
	o('mossy', 34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(1, 4, 32, 18, 5);
		g.fillStyle(C('#a8a8a2'), 1).fillCircle(10, 12, 5).fillCircle(23, 13, 5.4).fillCircle(17, 9, 4);
		g.fillStyle(C('#5d8a4a'), 0.85).fillCircle(7, 16, 2.6).fillCircle(15, 17, 3).fillCircle(26, 17, 2.6).fillCircle(20, 7, 2.2);
		g.fillStyle(C('#74a85e'), 0.9).fillCircle(13, 14, 1.6).fillCircle(24, 10, 1.6);
	});
	o('chest', 32, 28, (g) => {
		g.fillStyle(C('#8a6a44'), 1).fillRoundedRect(2, 8, 28, 18, 3);
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(2, 4, 28, 9, 3);
		g.fillStyle(C('#e3c75f'), 1).fillRect(14, 11, 4, 6);
		g.lineStyle(1, C('#5d4128'), 1).strokeRoundedRect(2, 4, 28, 22, 3);
	});
	o('largechest', 38, 32, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRoundedRect(2, 9, 34, 21, 3); // deep body
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(2, 4, 34, 11, 3); // domed lid
		g.fillStyle(C('#7c6248'), 1).fillRect(4, 16, 30, 3); // plank seam
		g.fillStyle(C('#8a8c92'), 1).fillRect(8, 4, 3, 26).fillRect(27, 4, 3, 26); // iron bands
		g.lineStyle(1, C('#3a2c1e'), 1).strokeRoundedRect(2, 4, 34, 26, 3);
		g.fillStyle(C('#e3c75f'), 1).fillRect(17, 13, 4, 7); // brass lock plate
		g.fillStyle(C('#a9842f'), 1).fillCircle(19, 16, 1.3);
	});
	o('stand', 26, 38, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(11, 12, 4, 24).fillRect(4, 32, 18, 4);
		g.fillStyle(C('#f4ecd8'), 1).fillRect(3, 2, 20, 13);
		g.lineStyle(1, C('#8a6a44'), 1).strokeRect(3, 2, 20, 13).lineBetween(13, 2, 13, 15);
	});
	o('tree', 52, 64, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(23, 36, 8, 26);
		g.fillStyle(C('#3f6e38'), 1).fillCircle(26, 22, 18).fillCircle(13, 31, 11).fillCircle(39, 31, 11);
		g.fillStyle(C('#558a4a'), 0.9).fillCircle(20, 16, 8);
	});
	o('deadwood', 30, 56, (g) => {
		g.fillStyle(C('#8d7a5e'), 1).fillRect(12, 8, 7, 48);
		g.fillRect(4, 16, 10, 4).fillRect(17, 26, 11, 4);
		g.fillStyle(C('#5d4128'), 1).fillCircle(15, 20, 1.6).fillCircle(16, 34, 1.6);
	});
	o('reed', 36, 42, (g) => {
		g.fillStyle(C('#6aa884'), 0.6).fillEllipse(18, 36, 34, 10);
		g.lineStyle(2, C('#7fa05a'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(6 + i * 6, 38, 6 + i * 6, 8 + (i % 2) * 5);
		g.fillStyle(C('#8a6a44'), 1);
		for (let i = 0; i < 5; i++) g.fillEllipse(6 + i * 6, 8 + (i % 2) * 5, 4, 8);
	});
	o('mound', 38, 26, (g) => {
		g.fillStyle(C('#a8845c'), 1).fillEllipse(19, 18, 36, 16);
		g.fillStyle(C('#4a3826'), 1).fillEllipse(19, 18, 12, 8);
	});
	o('platform', 30, 50, (g) => {
		g.fillStyle(C('#9a8a64'), 1).fillRect(13, 12, 5, 38);
		g.fillStyle(C('#b5a578'), 1).fillEllipse(15, 10, 28, 10);
		g.fillStyle(C('#8a6a44'), 1).fillEllipse(15, 7, 14, 6);
	});
	o('cactus', 32, 44, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillRoundedRect(12, 6, 9, 36, 4);
		g.fillRoundedRect(3, 14, 10, 6, 3).fillRoundedRect(2, 10, 6, 12, 3);
		g.fillStyle(C('#d96a5a'), 1).fillCircle(16, 6, 3);
	});
	o('brush', 38, 28, (g) => {
		g.fillStyle(C('#8a8a4e'), 1).fillCircle(11, 19, 8).fillCircle(25, 18, 9).fillCircle(18, 12, 7);
		g.lineStyle(1, C('#6e6e3a'), 1).lineBetween(11, 26, 14, 12).lineBetween(25, 26, 22, 12);
	});
	o('shade', 40, 30, (g) => {
		g.fillStyle(C('#a08a72'), 1).fillRoundedRect(2, 4, 36, 10, 3);
		g.fillStyle(C('#3a3026'), 1).fillRect(6, 14, 28, 8);
		g.fillStyle(C('#8e8e8a'), 1).fillRect(2, 22, 8, 6).fillRect(30, 22, 8, 6);
	});
	o('tidepool', 46, 34, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(23, 18, 46, 30);
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(23, 18, 34, 20);
		g.fillStyle(C('#e8954f'), 1).fillCircle(17, 20, 3); // little sea star
		g.fillStyle(0xffffff, 0.4).fillEllipse(20, 14, 10, 4);
	});
	o('dunegrass', 36, 34, (g) => {
		g.fillStyle(C('#dcc890'), 1).fillEllipse(18, 28, 34, 10);
		g.lineStyle(2, C('#bdb670'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 5, 30, 3 + i * 5.5, 8 + (i % 3) * 3);
	});
	o('driftwood', 42, 26, (g) => {
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(2, 12, 38, 9, 4);
		g.fillStyle(C('#c4b6a0'), 1).fillRoundedRect(8, 4, 26, 7, 3);
	});
	o('kelp', 36, 30, (g) => {
		g.fillStyle(C('#6a7a3a'), 1);
		g.fillEllipse(8, 18, 10, 22).fillEllipse(18, 20, 10, 18).fillEllipse(28, 17, 10, 22);
		g.fillStyle(C('#8a9a4e'), 1).fillCircle(12, 10, 2.4).fillCircle(24, 12, 2.4);
	});
	o('nest', 40, 30, (g) => {
		g.fillStyle(C('#d8c8a0'), 1).fillEllipse(20, 18, 38, 20);
		g.lineStyle(2, C('#8a6a44'), 1).strokeEllipse(20, 18, 30, 14);
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(16, 17, 6, 5).fillEllipse(24, 18, 6, 5);
	});
	o('coralgarden', 42, 32, (g) => {
		g.fillStyle(C('#cdbfa0'), 1).fillEllipse(21, 26, 40, 12); // sandy bed
		g.fillStyle(C('#5d96c8'), 0.55).fillEllipse(21, 24, 36, 9); // shallow water film
		const branch = (x: number, h: number, c: string) => {
			g.fillStyle(C(c), 1).fillRoundedRect(x - 2, 26 - h, 4, h, 2);
			g.fillCircle(x, 26 - h, 3);
		};
		branch(10, 14, '#e58b6f'); branch(17, 20, '#f2a98f'); branch(24, 16, '#e0876f');
		branch(31, 12, '#e8a07a'); branch(20, 11, '#d96e8a');
		g.fillStyle(C('#6f9a52'), 1).fillEllipse(6, 22, 5, 12).fillEllipse(36, 21, 5, 12); // kelp fronds
		g.fillStyle(0xffffff, 0.4).fillCircle(15, 19, 1.2).fillCircle(27, 17, 1.2);
	});
	o('seaglasslantern', 22, 44, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(9, 30, 4, 12); // driftwood post
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(4, 8, 14, 22, 3); // weathered frame
		g.fillStyle(C('#8fc6c2'), 1).fillRoundedRect(6, 11, 5, 7, 1); // sea-glass panes
		g.fillStyle(C('#a9d8d0'), 1).fillRoundedRect(11, 11, 5, 7, 1);
		g.fillStyle(C('#bcd8e6'), 1).fillRoundedRect(6, 19, 5, 7, 1);
		g.fillStyle(C('#9fd0cc'), 1).fillRoundedRect(11, 19, 5, 7, 1);
		g.fillStyle(0xffffff, 0.55).fillCircle(8, 13, 1.2);
		g.fillStyle(C('#9a7448'), 1).fillRoundedRect(3, 4, 16, 5, 2); // cap
	});
	o('tidechime', 28, 40, (g) => {
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(6, 6, 16, 4, 2); // driftwood bar
		const items: [number, string, number][] = [[9, '#e6d8c8', 16], [13, '#8fc6c2', 22], [17, '#9bbcc8', 18], [21, '#a9d8d0', 24]];
		items.forEach(([x, c, len]) => {
			g.lineStyle(1, C('#9a948a'), 1).lineBetween(x, 10, x, 14);
			g.fillStyle(C(c), 1).fillRoundedRect(x - 1.6, 14, 3.2, len, 1);
			g.fillStyle(0xffffff, 0.4).fillCircle(x - 0.5, 17, 0.9);
		});
	});
	o('pearldisplay', 30, 28, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(7, 22, 5, 6).fillRect(18, 22, 5, 6); // little stand legs
		g.fillStyle(C('#c8b8a8'), 1).fillEllipse(15, 18, 26, 14); // big shell cradle
		g.lineStyle(1.4, C('#a89a88'), 1);
		g.lineBetween(15, 7, 5, 19).lineBetween(15, 7, 15, 20).lineBetween(15, 7, 25, 19);
		g.fillStyle(C('#f2ece0'), 1).fillCircle(11, 17, 3).fillCircle(19, 17, 3).fillCircle(15, 14, 3.4); // pearls
		g.fillStyle(0xffffff, 0.85).fillCircle(10, 15, 1.1).fillCircle(18, 15, 1.1).fillCircle(14, 12, 1.2);
	});
	o('seaglasspath', 34, 26, (g) => {
		g.fillStyle(C('#dcc890'), 1).fillRoundedRect(1, 4, 32, 18, 8); // sand
		const bits: [number, number, string][] = [[8, 9, '#8fc6c2'], [15, 13, '#a9d8d0'], [22, 9, '#bcd8e6'], [27, 15, '#9fd0cc'], [12, 17, '#8fc6c2'], [20, 7, '#a9d8d0']];
		for (const [x, y, c] of bits) g.fillStyle(C(c), 0.95).fillRoundedRect(x - 2, y - 2, 4.5, 4.5, 1);
	});
	o('rug', 40, 28, (g) => {
		g.fillStyle(C('#b5707a'), 1).fillRoundedRect(2, 2, 36, 24, 5);
		g.lineStyle(2, C('#e8d8c8'), 1).strokeRoundedRect(6, 6, 28, 16, 4);
	});
	o('vase', 22, 30, (g) => {
		g.fillStyle(C('#7a9ac0'), 1).fillEllipse(11, 21, 14, 16);
		g.fillRect(8, 10, 6, 6);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(7, 7, 3).fillCircle(15, 7, 3).fillCircle(11, 4, 3);
	});
	o('bridge', 36, 34, (g) => {
		g.fillStyle(C('#a3814f'), 1);
		for (let i = 0; i < 5; i++) g.fillRoundedRect(2, 4 + i * 6, 32, 4.6, 2); // planks
		g.fillStyle(C('#7c5a3c'), 1).fillRect(4, 0, 4, 34).fillRect(28, 0, 4, 34); // rails
		g.fillStyle(C('#8c6a42'), 1).fillCircle(6, 2, 2.4).fillCircle(30, 2, 2.4).fillCircle(6, 32, 2.4).fillCircle(30, 32, 2.4);
	});
	o('poppies', 34, 30, (g) => {
		['#d9534f', '#e86a5a', '#c9443f'].forEach((c, i) => {
			const x = 7 + i * 10;
			g.lineStyle(2, C('#5f9e44'), 1).lineBetween(x, 12 + (i % 2) * 4, x, 26);
			g.fillStyle(C(c), 1).fillCircle(x, 9 + (i % 2) * 4, 4.4);
			g.fillStyle(0x2e2018, 1).fillCircle(x, 9 + (i % 2) * 4, 1.6);
		});
	});
	o('sunflowers', 34, 38, (g) => {
		[9, 24].forEach((x, i) => {
			const y = 8 + i * 4;
			g.lineStyle(2.6, C('#5f9e44'), 1).lineBetween(x, y + 4, x, 34);
			g.fillStyle(C('#e3c75f'), 1);
			for (let p = 0; p < 8; p++) {
				const a = (p / 8) * Math.PI * 2;
				g.fillEllipse(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 5, 3);
			}
			g.fillStyle(C('#7c5a3c'), 1).fillCircle(x, y, 3.4);
		});
	});
	o('lupines', 32, 34, (g) => {
		['#7d6b9e', '#9d86d9', '#6a5a8e'].forEach((c, i) => {
			const x = 6 + i * 10;
			g.lineStyle(2, C('#5f9e44'), 1).lineBetween(x, 14, x, 30);
			g.fillStyle(C(c), 1);
			for (let b = 0; b < 5; b++) g.fillCircle(x + (b % 2 === 0 ? -1.6 : 1.6), 6 + b * 2.6 + (i % 2) * 3, 2.2);
		});
	});
	o('willow', 52, 62, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(23, 38, 7, 24);
		g.fillStyle(C('#6b9152'), 1).fillEllipse(26, 22, 42, 30);
		g.fillStyle(C('#7fa860'), 1).fillEllipse(22, 16, 22, 14);
		g.lineStyle(2.4, C('#8aba6a'), 1);
		for (let i = 0; i < 6; i++) {
			const x = 8 + i * 7.4;
			g.lineBetween(x, 28, x - 2, 48 + (i % 3) * 4);
		}
	});
	o('oak', 50, 58, (g) => {
		g.fillStyle(C('#6e553c'), 1).fillRect(22, 34, 8, 24);
		g.fillRect(17, 38, 6, 4).fillRect(29, 40, 7, 4);
		g.fillStyle(C('#4a6b3a'), 1).fillCircle(25, 20, 17).fillCircle(12, 28, 10).fillCircle(38, 28, 10);
		g.fillStyle(C('#5d8a4a'), 1).fillCircle(20, 14, 8);
		g.fillStyle(C('#a07a3e'), 1).fillCircle(33, 26, 2).fillCircle(15, 22, 2);
	});
	o('pine', 40, 60, (g) => {
		g.fillStyle(C('#6e553c'), 1).fillRect(17, 46, 6, 14);
		g.fillStyle(C('#3a5a44'), 1);
		g.fillTriangle(20, 2, 4, 26, 36, 26);
		g.fillTriangle(20, 14, 2, 42, 38, 42);
		g.fillTriangle(20, 28, 0, 52, 40, 52);
		g.fillStyle(C('#4d7257'), 1).fillTriangle(20, 6, 10, 22, 30, 22);
	});
	o('workbench', 48, 38, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(2, 10, 44, 10);
		g.fillStyle(C('#7c5a3c'), 1).fillRect(5, 20, 6, 16).fillRect(37, 20, 6, 16);
		g.fillStyle(C('#8e8e8a'), 1).fillRect(10, 5, 10, 5); // little tool
		g.fillStyle(C('#c9a35c'), 1).fillCircle(32, 8, 4);
	});
	o('bed', 44, 34, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(1, 4, 42, 28, 4);
		g.fillStyle(C('#88a8c8'), 1).fillRoundedRect(4, 12, 36, 17, 3); // blanket
		g.fillStyle(C('#f4ecd8'), 1).fillRoundedRect(5, 6, 14, 8, 3); // pillow
	});
	o('kit', 30, 26, (g) => {
		g.fillStyle(C('#c9b98a'), 1).fillRoundedRect(2, 6, 26, 18, 3);
		g.fillStyle(C('#4a7c59'), 1).fillRect(12, 9, 6, 12).fillRect(9, 12, 12, 6);
	});

	// --- decorative structures ---
	o('lantern', 22, 44, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(9, 30, 4, 12); // post
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(4, 8, 14, 22, 4); // housing
		g.fillStyle(C('#ffd680'), 1).fillRoundedRect(7, 12, 8, 14, 2); // warm glass
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(3, 4, 16, 5, 2); // cap
	});
	o('bench', 40, 30, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(5, 20, 5, 10).fillRect(30, 20, 5, 10); // legs
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(3, 16, 34, 6, 2); // seat
		g.fillStyle(C('#9a7448'), 1).fillRoundedRect(4, 6, 32, 4, 2).fillRect(6, 8, 3, 10).fillRect(31, 8, 3, 10); // back
	});
	o('arch', 40, 48, (g) => {
		g.lineStyle(5, C('#8c6a42'), 1).strokeRoundedRect(6, 6, 28, 44, 14); // arch frame
		g.fillStyle(C('#5e9455'), 1).fillCircle(10, 10, 5).fillCircle(30, 10, 5).fillCircle(20, 6, 5); // greenery
		g.fillStyle(C('#d77bb1'), 1).fillCircle(8, 14, 2.4).fillCircle(33, 13, 2.4).fillCircle(20, 7, 2.4); // blooms
	});
	o('birdbath', 30, 38, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillRect(12, 18, 6, 18); // pedestal
		g.fillStyle(C('#a8a8a2'), 1).fillEllipse(15, 16, 26, 10); // basin
		g.fillStyle(C('#7fb4d8'), 1).fillEllipse(15, 15, 18, 6); // water
		g.fillStyle(0xffffff, 0.5).fillEllipse(11, 14, 6, 2);
	});
	o('signpost', 26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 6, 4, 36); // post
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(2, 10, 22, 10, 2); // board
		g.lineStyle(1, C('#7c5a3c'), 1).lineBetween(5, 15, 21, 15);
	});
	o('planter', 34, 28, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(3, 14, 28, 12, 2); // box
		g.fillStyle(C('#7c5a3c'), 1).fillRect(3, 14, 28, 3);
		g.fillStyle(C('#5e9455'), 1).fillCircle(9, 12, 5).fillCircle(18, 10, 5).fillCircle(26, 12, 5); // foliage
		g.fillStyle(C('#e3c75f'), 1).fillCircle(12, 9, 2).fillCircle(23, 9, 2); // flowers
	});
	// --- decorative camp comforts (purely for fun) ---
	o('campfire', 38, 30, (g) => {
		g.fillStyle(C('#8e8e8a'), 1);
		for (const [x, y] of [[7, 24], [14, 27], [22, 27], [30, 24], [11, 20], [27, 20]] as const) g.fillCircle(x, y, 3.6);
		g.fillStyle(C('#7a5a3a'), 1).fillRect(10, 19, 18, 4).fillRect(15, 16, 4, 8);
		g.fillStyle(C('#e8954f'), 1).fillTriangle(19, 4, 12, 22, 26, 22);
		g.fillStyle(C('#f4d35e'), 1).fillTriangle(19, 11, 15, 22, 23, 22);
	});
	o('lanternstring', 50, 30, (g) => {
		g.lineStyle(1.5, C('#6b5238'), 1).lineBetween(2, 4, 48, 4);
		const cols = ['#e8954f', '#e3c75f', '#d77bb1', '#7fb4d8', '#9bd17a'];
		cols.forEach((c, i) => {
			const x = 6 + i * 9.5;
			g.lineStyle(1, C('#6b5238'), 1).lineBetween(x, 4, x, 9);
			g.fillStyle(C(c), 1).fillRoundedRect(x - 3, 9, 6, 9, 3);
			g.fillStyle(0xffffff, 0.4).fillCircle(x - 1, 12, 1.2);
		});
	});
	o('pinwheel', 26, 42, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRect(12, 16, 3, 26);
		const blades: [string, number, number, number, number, number, number][] = [
			['#e86a8a', 13, 10, 22, 6, 22, 14],
			['#7fb4d8', 13, 10, 17, 1, 9, 4],
			['#f4d35e', 13, 10, 4, 6, 4, 14],
			['#9bd17a', 13, 10, 9, 16, 17, 19],
		];
		for (const [c, ax, ay, bx, by, cx, cy] of blades) g.fillStyle(C(c), 1).fillTriangle(ax, ay, bx, by, cx, cy);
		g.fillStyle(C('#6b5238'), 1).fillCircle(13, 10, 2);
	});
	o('birdhouse', 26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 22, 4, 20);
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(5, 10, 16, 16, 2);
		g.fillStyle(C('#8c5a3a'), 1).fillTriangle(3, 11, 13, 2, 23, 11);
		g.fillStyle(C('#3a2a1c'), 1).fillCircle(13, 18, 3.2);
		g.fillStyle(C('#6b5238'), 1).fillRect(12, 22, 2, 5);
	});
	o('flowercart', 42, 32, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(6, 12, 30, 12, 2);
		g.fillStyle(C('#6b5238'), 1).fillCircle(13, 27, 5).fillCircle(30, 27, 5);
		g.fillStyle(C('#caa15a'), 1).fillCircle(13, 27, 2).fillCircle(30, 27, 2);
		const cols = ['#d77bb1', '#e8954f', '#e3c75f', '#c45ad0', '#e86a6a'];
		cols.forEach((c, i) => g.fillStyle(C(c), 1).fillCircle(10 + i * 6, 10 - (i % 2) * 2, 3.4));
	});
	o('hammock', 46, 30, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(3, 6, 3, 22).fillRect(40, 6, 3, 22);
		g.fillStyle(C('#c8a86a'), 1).fillTriangle(5, 9, 41, 9, 23, 24);
		g.lineStyle(1, C('#a3814f'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(9 + i * 7, 10, 23, 23);
	});
	o('gnome', 22, 34, (g) => {
		g.fillStyle(C('#5e9455'), 1).fillRoundedRect(6, 20, 11, 13, 4);
		g.fillStyle(C('#f0d2a8'), 1).fillCircle(11, 17, 5);
		g.fillStyle(C('#e8e0d0'), 1).fillTriangle(7, 18, 15, 18, 11, 26);
		g.fillStyle(C('#c0392b'), 1).fillTriangle(4, 16, 18, 16, 11, 1);
		g.fillStyle(C('#3a2a1c'), 1).fillCircle(9, 16, 0.9).fillCircle(13, 16, 0.9);
	});
	o('windchime', 28, 38, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(7, 6, 14, 4, 2);
		const cols = ['#9bbcc8', '#c8b88a', '#b0a0c0', '#a8c0a0'];
		cols.forEach((c, i) => {
			const x = 9 + i * 3.5;
			g.lineStyle(1, C('#9a948a'), 1).lineBetween(x, 10, x, 14);
			g.fillStyle(C(c), 1).fillRoundedRect(x - 1.4, 14, 2.8, 14 + (i % 2) * 4, 1);
		});
	});
	o('sundial', 32, 28, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillRect(13, 14, 6, 14);
		g.fillStyle(C('#b8b4ac'), 1).fillEllipse(16, 13, 26, 9);
		g.fillStyle(C('#8a847a'), 1).fillTriangle(16, 13, 16, 4, 24, 12);
		g.lineStyle(1, C('#7a746a'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(16, 13, 6 + i * 5, 9);
	});
	o('cairnstack', 26, 36, (g) => {
		const stones: [number, number, number, number][] = [[13, 31, 11, 7], [13, 24, 9, 6], [13, 18, 7, 5], [13, 13, 5.5, 4.5], [13, 9, 4, 3.5]];
		stones.forEach(([x, y, rw, rh], i) => g.fillStyle(C(i % 2 ? '#9a948a' : '#8e8e8a'), 1).fillEllipse(x, y, rw * 2, rh * 2));
	});
	o('picnic', 42, 30, (g) => {
		g.fillStyle(C('#d8d0c0'), 1).fillRoundedRect(4, 6, 34, 20, 3);
		g.fillStyle(C('#c25a5a'), 0.7);
		for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) g.fillRect(5 + c * 5.4, 7 + r * 4.6, 5, 4.2);
	});
	o('potrow', 42, 26, (g) => {
		for (let i = 0; i < 3; i++) {
			const x = 7 + i * 13;
			g.fillStyle(C('#cf7a52'), 1).fillRoundedRect(x - 5, 13, 10, 11, 2);
			g.fillStyle(C('#b5683f'), 1).fillRect(x - 5, 13, 10, 2.5);
			g.fillStyle(C('#5e9455'), 1).fillCircle(x - 3, 10, 3).fillCircle(x + 3, 10, 3).fillCircle(x, 7, 3);
			g.fillStyle(C(['#d77bb1', '#e8954f', '#e3c75f'][i]), 1).fillCircle(x, 7, 1.6);
		}
	});
	// --- new craftable habitat shelters ---
	o('insecthotel', 30, 36, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(4, 8, 22, 26, 2); // frame
		g.fillStyle(C('#6b5238'), 1).fillTriangle(2, 9, 15, 1, 28, 9); // roof
		g.fillStyle(C('#caa15a'), 1).fillRect(6, 11, 8, 9).fillRect(16, 22, 8, 9); // straw cells
		g.fillStyle(C('#a3814f'), 1).fillRect(16, 11, 8, 9).fillRect(6, 22, 8, 9);
		g.fillStyle(C('#5d4128'), 1);
		for (const cx of [8, 10, 12, 18, 20, 22]) g.fillCircle(cx, 15.5, 0.9);
		for (const cx of [18, 20, 22]) g.fillCircle(cx, 26.5, 0.9);
	});
	o('stonewall', 40, 24, (g) => {
		const rows: [number, number][] = [[6, 18], [6, 12], [9, 6]];
		rows.forEach(([y, , ], r) => {
			const off = r % 2 ? 5 : 0;
			for (let x = 2 + off; x < 38; x += 9) g.fillStyle(C(r % 2 ? '#9a948a' : '#8e8e8a'), 1).fillRoundedRect(x, y, 8, 6, 2);
		});
	});
	o('batbox', 24, 40, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(10, 26, 4, 14); // post
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(4, 6, 16, 22, 2); // tall box
		g.fillStyle(C('#7c5a3c'), 1).fillTriangle(3, 7, 12, 1, 21, 7); // roof
		g.fillStyle(C('#2e2018'), 1).fillRect(7, 24, 10, 3); // entry slot beneath
	});
	o('leaflitter', 36, 22, (g) => {
		g.fillStyle(C('#6b4f30'), 1).fillEllipse(18, 16, 32, 12); // mound
		const cols = ['#b07a3a', '#caa15a', '#9a6a32', '#8a6a3a'];
		for (let i = 0; i < 11; i++) {
			const x = 5 + (i * 2.8), y = 9 + ((i * 5) % 8);
			g.fillStyle(C(cols[i % 4]), 1).fillEllipse(x, y, 5, 3.4);
		}
	});
	o('ducknest', 26, 38, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(11, 22, 4, 16); // post
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(4, 8, 18, 16, 2); // box
		g.fillStyle(C('#6b5238'), 1).fillRect(3, 6, 20, 4); // roof lip
		g.fillStyle(C('#2e2018'), 1).fillCircle(13, 16, 3.6); // round hole
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(13, 24, 8, 3); // grass tuft
	});
	o('baskinglog', 42, 22, (g) => {
		g.fillStyle(C('#6f93b0'), 0.7).fillEllipse(21, 17, 40, 9); // water around
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 8, 34, 9, 4); // log
		g.fillStyle(C('#9a7448'), 1).fillEllipse(37, 12, 7, 9); // cut end
		g.fillStyle(C('#5d8a4a'), 0.9).fillEllipse(12, 8, 9, 4); // moss
	});
	o('crevice', 38, 26, (g) => {
		g.fillStyle(C('#b07a4a'), 1).fillTriangle(2, 24, 16, 4, 22, 24); // left slab
		g.fillStyle(C('#9a6838'), 1).fillTriangle(18, 24, 26, 6, 36, 24); // right slab
		g.fillStyle(C('#3a2a1c'), 1).fillTriangle(15, 24, 20, 11, 23, 24); // shadow crack
	});
	o('guzzler', 36, 24, (g) => {
		g.fillStyle(C('#9a8a6a'), 1).fillEllipse(18, 16, 34, 14); // clay rim
		g.fillStyle(C('#6f93b0'), 1).fillEllipse(18, 16, 24, 8); // water
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 14, 8, 2.5); // glint
	});
	o('talus', 34, 26, (g) => {
		const rocks: [number, number, number][] = [[8, 20, 7], [18, 21, 8], [27, 20, 6], [13, 13, 6], [22, 13, 6], [17, 7, 5]];
		rocks.forEach(([x, y, r], i) => g.fillStyle(C(['#9a948a', '#8e8e8a', '#a8a29a'][i % 3]), 1).fillCircle(x, y, r));
	});
	o('nestshelf', 32, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(2, 12, 28, 11, 2); // rock ledge
		g.fillStyle(C('#6b8a4a'), 1).fillEllipse(16, 12, 22, 7); // mossy lining
		g.fillStyle(C('#caa15a'), 1).fillCircle(11, 11, 1.8).fillCircle(16, 12, 1.8).fillCircle(21, 11, 1.8); // eggs
	});
	o('driftpile', 40, 24, (g) => {
		const cols = ['#c8b89a', '#b8a888', '#d8cab0'];
		const logs: [number, number, number, number, number][] = [[4, 16, 30, 6, 0], [8, 11, 26, 5, 1], [6, 7, 22, 4, 2]];
		logs.forEach(([x, y, w, h, c]) => g.fillStyle(C(cols[c]), 1).fillRoundedRect(x, y, w, h, 3));
		g.fillStyle(C('#9a8a6a'), 1).fillCircle(34, 16, 3).fillCircle(34, 11, 2.5);
	});
	o('bluff', 40, 28, (g) => {
		g.fillStyle(C('#c2b9a0'), 1).fillRoundedRect(2, 10, 36, 18, 3); // sandy bank
		g.fillStyle(C('#a89878'), 1).fillRect(2, 16, 36, 2).fillRect(2, 22, 36, 2); // strata
		g.fillStyle(C('#3a2e22'), 1).fillEllipse(12, 14, 5, 4).fillEllipse(27, 14, 5, 4); // nest hollows
	});
	// --- additional habitat objects (distinct silhouettes) ---
	o('clover', 34, 26, (g) => {
		g.fillStyle(C('#6fae5a'), 1).fillEllipse(17, 18, 32, 14);
		g.fillStyle(C('#4f8a38'), 1);
		for (const [x, y] of [[9, 12], [17, 9], [25, 13], [13, 17], [22, 17]] as const) {
			g.fillCircle(x - 2, y, 2.4).fillCircle(x + 2, y, 2.4).fillCircle(x, y - 2, 2.4);
		}
		g.fillStyle(C('#f0e2a0'), 1).fillCircle(20, 8, 2);
	});
	o('brushpile', 42, 26, (g) => {
		g.fillStyle(C('#8a7048'), 1);
		const sticks = [[2, 18, 30, 4], [6, 13, 28, 4], [3, 8, 24, 4]] as const;
		for (const [x, y, w, h] of sticks) g.fillRoundedRect(x, y, w, h, 2);
		g.lineStyle(2, C('#6b5238'), 1).lineBetween(8, 6, 34, 20).lineBetween(30, 5, 6, 21);
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(34, 9, 9, 5);
	});
	o('fernclump', 34, 34, (g) => {
		g.lineStyle(2.5, C('#4f7d3a'), 1);
		for (const ang of [-0.9, -0.45, 0, 0.45, 0.9]) {
			const tx = 17 + Math.sin(ang) * 15;
			g.lineBetween(17, 32, tx, 6 + Math.abs(ang) * 6);
		}
		g.fillStyle(C('#6ba04a'), 1).fillEllipse(17, 30, 16, 6);
	});
	o('stump', 30, 26, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(5, 8, 20, 16, 4);
		g.fillStyle(C('#9a7448'), 1).fillEllipse(15, 9, 20, 9);
		g.fillStyle(C('#7c5a3c'), 1).fillEllipse(15, 9, 12, 5);
		g.fillStyle(C('#5d4128'), 1).fillEllipse(15, 9, 5, 2.4);
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(8, 22, 9, 4);
	});
	o('sedge', 32, 34, (g) => {
		g.fillStyle(C('#7a9a4a'), 1).fillEllipse(16, 30, 24, 8);
		g.lineStyle(2, C('#8aa85a'), 1);
		for (const x of [8, 12, 16, 20, 24]) g.lineBetween(x, 30, x + (x - 16) * 0.3, 6 + Math.abs(x - 16));
		g.fillStyle(C('#b58a4a'), 1).fillCircle(16, 7, 2).fillCircle(11, 12, 1.6).fillCircle(21, 11, 1.6);
	});
	o('snag', 24, 44, (g) => {
		g.fillStyle(C('#8a7860'), 1).fillRect(8, 8, 7, 36);
		g.fillStyle(C('#6e5c46'), 1).fillRect(8, 8, 3, 36);
		g.fillStyle(C('#8a7860'), 1).fillRect(2, 18, 7, 4).fillRect(15, 14, 6, 4); // broken limbs
		g.fillStyle(C('#5d4a36'), 1).fillTriangle(8, 8, 15, 8, 11, 2); // jagged top
	});
	o('agave', 34, 30, (g) => {
		g.fillStyle(C('#6f8a5a'), 1);
		for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, 3.14]) {
			const tx = 17 + Math.sin(ang) * 15;
			const ty = 22 - Math.cos(ang) * 14;
			g.fillTriangle(17, 22, tx - 3, ty + 3, tx + 3, ty + 3);
		}
		g.fillStyle(C('#8aa86a'), 1).fillCircle(17, 22, 4);
	});
	o('ocotillo', 30, 46, (g) => {
		g.lineStyle(2.5, C('#6e5238'), 1);
		for (const x of [9, 15, 21]) g.lineBetween(15, 44, x, 6);
		g.fillStyle(C('#c44a3a'), 1).fillCircle(9, 6, 2.4).fillCircle(15, 5, 2.4).fillCircle(21, 6, 2.4); // red tips
		g.fillStyle(C('#5d8a4a'), 0.7).fillEllipse(15, 42, 12, 5);
	});
	o('heather', 34, 24, (g) => {
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(17, 17, 32, 12);
		g.fillStyle(C('#a06aa8'), 1);
		for (const [x, y] of [[8, 12], [14, 9], [20, 11], [26, 10], [11, 14], [23, 14]] as const) g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#c89ad0'), 1).fillCircle(14, 8, 1.2).fillCircle(26, 9, 1.2);
	});
	o('krummholz', 34, 36, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRect(15, 26, 4, 10);
		g.fillStyle(C('#3f5e3a'), 1);
		g.fillTriangle(6, 28, 26, 24, 14, 10); // wind-bent canopy leaning right
		g.fillTriangle(10, 20, 28, 17, 17, 6);
		g.fillStyle(C('#4f7048'), 1).fillTriangle(12, 14, 26, 12, 19, 4);
	});
	o('seagrass', 34, 30, (g) => {
		g.fillStyle(C('#cdbf94'), 1).fillEllipse(17, 26, 32, 8); // sand
		g.lineStyle(2.5, C('#5a9a6a'), 1);
		for (const x of [7, 12, 17, 22, 27]) {
			const sway = Math.sin(x) * 4;
			g.lineBetween(x, 26, x + sway, 4);
		}
		g.fillStyle(C('#7fb88a'), 0.6).fillEllipse(17, 12, 22, 14);
	});
	o('oyster', 34, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(17, 18, 32, 12); // rock
		g.fillStyle(C('#b6b2a6'), 1);
		for (const [x, y] of [[9, 14], [16, 12], [23, 15], [13, 18], [21, 18]] as const) g.fillEllipse(x, y, 8, 6);
		g.lineStyle(1, C('#7c786e'), 1);
		for (const [x, y] of [[9, 14], [16, 12], [23, 15]] as const) g.lineBetween(x - 3, y, x + 3, y);
	});

	o('gazebo', 54, 58, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(27, 52, 46, 10); // stone base
		g.fillStyle(C('#a8a8a2'), 1).fillRoundedRect(7, 46, 40, 6, 2); // deck
		g.fillStyle(C('#7c5a3c'), 1).fillRect(10, 24, 5, 24).fillRect(39, 24, 5, 24).fillRect(20, 26, 4, 22).fillRect(30, 26, 4, 22); // posts
		g.fillStyle(C('#6b5238'), 1).fillRect(8, 30, 38, 3); // rail
		g.fillStyle(C('#5d7c8a'), 1).fillTriangle(27, 2, 4, 26, 50, 26); // roof
		g.fillStyle(C('#7a9aa8'), 1).fillTriangle(27, 8, 12, 25, 42, 25); // roof highlight
		g.fillStyle(C('#c9a35c'), 1).fillCircle(27, 4, 3); // finial
	});

	// --- additional plantable vegetation (one distinct sprite each) ---
	o('daisies', 34, 26, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(17, 20, 32, 12);
		for (const [x, y] of [[9, 12], [18, 9], [26, 13], [13, 17], [23, 17]] as const) {
			g.fillStyle(0xffffff, 1);
			for (const a of [0, 1.05, 2.1, 3.14, 4.19, 5.24]) g.fillEllipse(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 3, 3);
			g.fillStyle(C('#e3c75f'), 1).fillCircle(x, y, 2);
		}
	});
	o('foxglove', 28, 42, (g) => {
		g.lineStyle(3, C('#4f7d3a'), 1).lineBetween(10, 40, 10, 8).lineBetween(18, 40, 18, 12);
		g.fillStyle(C('#c45ad0'), 1);
		for (let i = 0; i < 5; i++) g.fillEllipse(10, 10 + i * 5, 7, 5);
		for (let i = 0; i < 4; i++) g.fillEllipse(18, 14 + i * 5, 6, 4);
	});
	o('mushrooms', 32, 24, (g) => {
		g.fillStyle(C('#e6dccd'), 1).fillRect(9, 12, 3, 9).fillRect(18, 14, 3, 8).fillRect(24, 16, 2, 6);
		g.fillStyle(C('#c0392b'), 1).fillEllipse(10, 12, 14, 9).fillEllipse(19, 14, 11, 7).fillEllipse(25, 16, 7, 5);
		g.fillStyle(0xffffff, 0.85).fillCircle(7, 11, 1.4).fillCircle(13, 13, 1.2).fillCircle(20, 14, 1.2);
	});
	o('birch', 34, 42, (g) => {
		g.fillStyle(C('#e8e6df'), 1).fillRect(15, 18, 5, 24); // white trunk
		g.fillStyle(0x2e2e2e, 1).fillRect(15, 24, 5, 1.6).fillRect(15, 31, 5, 1.6);
		g.fillStyle(C('#7bbf5a'), 1).fillCircle(17, 12, 11).fillCircle(9, 18, 6).fillCircle(25, 18, 6);
	});
	o('marshflower', 32, 26, (g) => {
		g.fillStyle(C('#5a8a4a'), 1).fillEllipse(16, 20, 30, 12);
		g.fillStyle(C('#e3b93f'), 1);
		for (const [x, y] of [[10, 12], [18, 10], [24, 14], [14, 16]] as const) g.fillCircle(x, y, 3.4);
		g.fillStyle(C('#f4e08a'), 1).fillCircle(18, 10, 1.4).fillCircle(10, 12, 1.4);
	});
	o('bulrush', 28, 40, (g) => {
		g.lineStyle(2.5, C('#5a8a4a'), 1);
		for (const x of [8, 14, 20]) g.lineBetween(x, 38, x, 6);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(7, 8, 3, 12, 1.5).fillRoundedRect(13, 5, 3, 12, 1.5).fillRoundedRect(19, 9, 3, 12, 1.5);
	});
	o('pricklypear', 34, 30, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillEllipse(13, 20, 14, 18).fillEllipse(22, 13, 12, 14).fillEllipse(24, 24, 10, 11);
		g.lineStyle(1, C('#3f6e38'), 1).strokeEllipse(13, 20, 14, 18).strokeEllipse(22, 13, 12, 14);
		g.fillStyle(C('#e8954f'), 1).fillCircle(22, 6, 2.6).fillCircle(28, 9, 2.2);
	});
	o('desertbloom', 32, 24, (g) => {
		g.fillStyle(C('#7c8a4e'), 1).fillEllipse(16, 19, 28, 10);
		g.fillStyle(C('#e88a2f'), 1);
		for (const [x, y] of [[9, 11], [17, 9], [24, 12], [13, 15]] as const) g.fillCircle(x, y, 3);
		g.fillStyle(C('#f4c75f'), 1).fillCircle(17, 9, 1.3);
	});
	o('gentian', 32, 24, (g) => {
		g.fillStyle(C('#5e7a4a'), 1).fillEllipse(16, 19, 28, 10);
		g.fillStyle(C('#3a6ad0'), 1);
		for (const [x, y] of [[10, 11], [18, 9], [25, 12], [14, 15]] as const) {
			for (const a of [0, 1.26, 2.51, 3.77, 5.03]) g.fillEllipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.4, 3.2);
		}
	});
	o('cushion', 30, 18, (g) => {
		g.fillStyle(C('#6fae5a'), 1).fillEllipse(15, 12, 28, 12);
		g.fillStyle(C('#5a9a48'), 1).fillCircle(9, 10, 3).fillCircle(17, 9, 3).fillCircle(23, 11, 3);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(12, 9, 1.2).fillCircle(20, 10, 1.2).fillCircle(16, 12, 1.2);
	});
	o('thrift', 32, 26, (g) => {
		g.fillStyle(C('#7a9a6a'), 1).fillEllipse(16, 21, 28, 9);
		g.lineStyle(1.5, C('#5a8a4a'), 1);
		for (const x of [9, 16, 23]) g.lineBetween(x, 21, x, 9);
		g.fillStyle(C('#e57aa8'), 1).fillCircle(9, 8, 3.2).fillCircle(16, 7, 3.4).fillCircle(23, 9, 3);
	});
	o('coastalshrub', 34, 28, (g) => {
		g.fillStyle(C('#7d8f6a'), 1).fillCircle(12, 18, 9).fillCircle(23, 16, 10).fillCircle(18, 12, 8);
		g.fillStyle(C('#9aa882'), 1).fillCircle(14, 14, 2.4).fillCircle(22, 13, 2.4).fillCircle(19, 18, 2.4);
	});

	// --- desert exclusive crafts + biome trees ---
	o('feeder', 26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 4, 3, 8); // hook
		g.lineStyle(1.5, C('#6b5238'), 1).strokeCircle(12, 4, 3);
		g.fillStyle(C('#c0392b'), 1).fillRoundedRect(5, 14, 16, 16, 5); // red bottle
		g.fillStyle(C('#e3c75f'), 1).fillRoundedRect(4, 28, 18, 7, 3); // yellow base
		g.fillStyle(C('#f4e08a'), 1).fillCircle(8, 31, 1.6).fillCircle(13, 31, 1.6).fillCircle(18, 31, 1.6); // ports
		g.fillStyle(0xffffff, 0.4).fillEllipse(10, 19, 4, 7);
	});
	o('geoderock', 32, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(10, 17, 9).fillCircle(22, 18, 8); // grey rock
		g.fillStyle(C('#6a5a7a'), 1).fillCircle(20, 12, 7); // opened geode shell
		g.fillStyle(C('#a98fd0'), 1).fillCircle(20, 12, 4.5); // crystal lining
		g.fillStyle(C('#d8c8f0'), 1).fillTriangle(18, 12, 20, 7, 22, 12).fillTriangle(20, 13, 22, 9, 24, 13);
	});
	o('totem', 26, 46, (g) => {
		g.fillStyle(C('#b07a52'), 1).fillRoundedRect(5, 30, 16, 14, 3); // base block
		g.fillStyle(C('#c98a5a'), 1).fillRoundedRect(6, 18, 14, 13, 3); // middle block
		g.fillStyle(C('#a86a44'), 1).fillRoundedRect(7, 8, 12, 11, 3); // top block
		g.lineStyle(1, C('#6b4a32'), 1).lineBetween(6, 30, 20, 30).lineBetween(6, 18, 20, 18);
		g.fillStyle(C('#a98fd0'), 1).fillTriangle(13, 8, 9, 2, 17, 2); // crystal top
	});
	o('paloverde', 34, 42, (g) => {
		g.fillStyle(C('#7a9a4a'), 1).fillRect(15, 22, 4, 20); // green trunk
		g.lineStyle(2, C('#7a9a4a'), 1).lineBetween(17, 28, 9, 18).lineBetween(17, 26, 25, 16);
		g.fillStyle(C('#9ab86a'), 1).fillCircle(16, 12, 11).fillCircle(8, 18, 6).fillCircle(25, 17, 6); // airy canopy
		g.fillStyle(C('#e3c75f'), 1).fillCircle(12, 9, 1.6).fillCircle(20, 11, 1.6).fillCircle(17, 6, 1.6); // yellow blooms
	});
	o('shorepine', 34, 40, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 24, 4, 16); // trunk
		g.fillStyle(C('#3f6e4a'), 1); // wind-bent canopy leaning left
		g.fillTriangle(4, 24, 26, 20, 14, 8).fillTriangle(7, 17, 25, 14, 16, 4);
		g.fillStyle(C('#4f8a5a'), 1).fillTriangle(10, 12, 24, 10, 18, 2);
	});

	// --- additional biome trees (distinct silhouettes) ---
	o('cypress', 34, 44, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(15, 34, 4, 10);
		g.fillStyle(C('#6a8a5a'), 1); // narrow feathery conical
		g.fillTriangle(6, 36, 28, 36, 17, 20).fillTriangle(8, 26, 26, 26, 17, 12).fillTriangle(10, 17, 24, 17, 17, 4);
	});
	o('tupelo', 34, 42, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(14, 28, 6, 14).fillEllipse(17, 40, 16, 6); // swollen base
		g.fillStyle(C('#5e8a6a'), 1).fillCircle(17, 16, 13).fillCircle(8, 22, 7).fillCircle(26, 22, 7);
	});
	o('mesquite', 38, 34, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(17, 22, 4, 12);
		g.lineStyle(2, C('#6b5238'), 1).lineBetween(19, 26, 9, 18).lineBetween(19, 24, 29, 16);
		g.fillStyle(C('#8a9a5a'), 1).fillEllipse(19, 13, 30, 16); // low wide airy canopy
		g.fillStyle(C('#9aab6a'), 1).fillCircle(11, 12, 5).fillCircle(27, 12, 5);
	});
	o('ironwood', 34, 38, (g) => {
		g.fillStyle(C('#5a5040'), 1).fillRect(15, 24, 5, 14);
		g.fillStyle(C('#7a8a6a'), 1).fillCircle(17, 15, 13).fillCircle(9, 20, 7).fillCircle(25, 20, 7); // dense grey-green
		g.fillStyle(C('#c89ad0'), 1).fillCircle(13, 11, 1.6).fillCircle(21, 13, 1.6); // pale blooms
	});
	o('fir', 30, 46, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRect(13, 38, 4, 8);
		g.fillStyle(C('#3f5e48'), 1); // very narrow spire
		g.fillTriangle(7, 40, 23, 40, 15, 26).fillTriangle(8, 30, 22, 30, 15, 16).fillTriangle(10, 20, 20, 20, 15, 6).fillTriangle(12, 12, 18, 12, 15, 2);
	});
	o('aspen', 32, 42, (g) => {
		g.fillStyle(C('#e8e6df'), 1).fillRect(14, 18, 4, 24); // white trunk
		g.fillStyle(0x2e2e2e, 1).fillRect(14, 25, 4, 1.4).fillRect(14, 32, 4, 1.4);
		g.fillStyle(C('#c9b34a'), 1).fillCircle(16, 12, 11).fillCircle(8, 17, 6).fillCircle(24, 17, 6); // gold autumn canopy
	});
	o('mcypress', 36, 38, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 24, 4, 14);
		g.fillStyle(C('#4f7050'), 1).fillEllipse(19, 14, 34, 16); // flat wind-swept top
		g.fillStyle(C('#5e8a5e'), 1).fillEllipse(24, 11, 18, 9);
	});
	o('liveoak', 38, 38, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 22, 6, 16);
		g.fillStyle(C('#4a6b40'), 1).fillEllipse(19, 14, 36, 20).fillCircle(8, 20, 7).fillCircle(30, 20, 7); // broad rounded
		g.fillStyle(C('#5e8a4a'), 0.7).fillCircle(13, 10, 5).fillCircle(25, 11, 5);
	});

	// --- Graywind Heights (alpine) exclusive crafts ---
	o('haypile', 32, 26, (g) => {
		g.fillStyle(C('#cdbc7e'), 1).fillEllipse(16, 19, 30, 13); // cured grass mound
		g.fillStyle(C('#bda968'), 1).fillEllipse(16, 22, 30, 7);
		g.lineStyle(1.4, C('#a8923f'), 1);
		for (const x of [6, 11, 16, 21, 26]) g.lineBetween(x, 18, x + (x % 2 ? 2 : -2), 6); // stray stalks
		g.fillStyle(C('#d77bb1'), 1).fillCircle(10, 12, 1.6).fillCircle(22, 13, 1.6); // dried flowers
	});
	o('lichenrock', 34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(17, 16, 30, 18); // boulder
		g.fillStyle(C('#a8a29a'), 1).fillEllipse(12, 11, 12, 8);
		g.fillStyle(C('#9fb38a'), 1).fillCircle(22, 12, 4).fillCircle(9, 18, 3.4).fillCircle(26, 19, 3); // lichen
		g.fillStyle(C('#c2cf9e'), 1).fillCircle(22, 12, 2).fillCircle(9, 18, 1.6);
		g.fillStyle(C('#d9a24a'), 1).fillCircle(15, 8, 1.6); // map-lichen fleck
	});
	o('scree', 36, 26, (g) => {
		const cols = ['#9a948a', '#8e8e8a', '#a8a29a', '#7e7c78'];
		const rocks: [number, number, number][] = [[6, 21, 5], [13, 22, 6], [21, 22, 6], [29, 21, 5], [10, 15, 5], [18, 15, 5], [26, 15, 5], [14, 9, 4], [22, 9, 4]];
		rocks.forEach(([x, y, r], i) => { g.fillStyle(C(cols[i % 4]), 1).fillCircle(x, y, r); g.fillStyle(0xffffff, 0.18).fillCircle(x - r / 3, y - r / 3, r / 3); });
	});
	o('snowbank', 36, 24, (g) => {
		g.fillStyle(C('#cdd9e8'), 1).fillEllipse(18, 18, 34, 12); // shadowed base
		g.fillStyle(C('#eef4fb'), 1).fillEllipse(18, 15, 32, 12); // drift
		g.fillStyle(0xffffff, 1).fillEllipse(13, 12, 16, 7);
		g.fillStyle(C('#bfe0f0'), 0.7).fillEllipse(26, 18, 10, 3); // meltwater glint
	});
	o('seedcache', 30, 26, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(15, 19, 26, 12); // hollow
		g.fillStyle(C('#5d4128'), 1).fillEllipse(15, 19, 18, 7);
		g.fillStyle(C('#c8a86a'), 1); // cached nuts
		for (const [x, y] of [[10, 17], [15, 15], [20, 17], [13, 19], [18, 19]] as const) g.fillEllipse(x, y, 5, 6);
		g.fillStyle(C('#e0c690'), 0.8).fillCircle(13, 14, 1.4).fillCircle(18, 16, 1.4);
	});
	o('juniper', 34, 30, (g) => {
		g.fillStyle(C('#5a4634'), 1).fillRect(15, 22, 4, 8); // gnarled stem
		g.fillStyle(C('#4f6b54'), 1).fillEllipse(16, 17, 30, 18); // dense low shrub
		g.fillStyle(C('#5d7a66'), 1).fillCircle(8, 15, 6).fillCircle(24, 15, 6).fillCircle(16, 11, 7);
		g.fillStyle(C('#6a7fa0'), 1); // frosted berries
		for (const [x, y] of [[10, 14], [22, 13], [16, 17], [13, 19], [25, 18], [18, 10]] as const) g.fillCircle(x, y, 2);
		g.fillStyle(0xffffff, 0.4); for (const [x, y] of [[10, 13], [22, 12], [16, 16]] as const) g.fillCircle(x, y, 0.8);
	});
	o('cliffniche', 34, 28, (g) => {
		g.fillStyle(C('#8a847a'), 1).fillRoundedRect(2, 4, 30, 24, 3); // cliff face
		g.fillStyle(C('#9c968c'), 1).fillRect(2, 4, 30, 3);
		g.lineStyle(1.4, C('#6e685e'), 1).lineBetween(2, 13, 32, 11).lineBetween(2, 20, 32, 22); // strata
		g.fillStyle(C('#3a352e'), 1).fillEllipse(17, 17, 14, 12); // dark niche
		g.fillStyle(C('#6b8a4a'), 1).fillEllipse(17, 22, 16, 5); // mossed lip
		g.fillStyle(C('#caa15a'), 1).fillCircle(14, 17, 1.6).fillCircle(19, 18, 1.6); // eggs tucked in
	});
	o('crystalspring', 34, 28, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(17, 17, 32, 18); // stone rim
		g.fillStyle(C('#6fb6cf'), 1).fillEllipse(17, 17, 24, 13); // cold water
		g.fillStyle(C('#9fdff0'), 1).fillEllipse(17, 15, 16, 8);
		g.fillStyle(0xffffff, 0.7).fillEllipse(12, 13, 7, 2.6);
		g.fillStyle(C('#cfe8f2'), 1).fillTriangle(26, 16, 28, 7, 30, 16).fillTriangle(4, 18, 6, 10, 8, 18); // quartz spurs
		g.fillStyle(0xffffff, 0.9).fillCircle(28, 9, 1).fillCircle(6, 12, 1);
	});
	o('crystalcairn', 28, 36, (g) => {
		const stones: [number, number, number, number][] = [[14, 31, 11, 7], [14, 24, 9, 6], [14, 18, 7, 5]];
		stones.forEach(([x, y, w, h]) => { g.fillStyle(C('#8e8e8a'), 1).fillEllipse(x, y, w, h); g.fillStyle(0xffffff, 0.2).fillEllipse(x - 2, y - 1, w / 3, h / 3); });
		g.fillStyle(C('#cfe8f2'), 1).fillTriangle(10, 14, 18, 14, 14, 2); // crystal crown
		g.fillStyle(C('#e6f4fb'), 1).fillTriangle(12, 14, 16, 14, 14, 5);
		g.fillStyle(0xffffff, 0.9).fillCircle(14, 7, 1.2);
	});
	o('prayerflags', 40, 26, (g) => {
		g.lineStyle(1.4, C('#6e553c'), 1).lineBetween(2, 6, 38, 10); // string sags
		const cols = ['#d77bb1', '#e8954f', '#5f9ed6', '#6fae5a', '#caa84e'];
		cols.forEach((c, i) => { const x = 4 + i * 7; const yt = 6 + i * 0.8; g.fillStyle(C(c), 1).fillTriangle(x, yt, x + 6, yt + 0.6, x + 3, yt + 11); });
	});
	o('crystallantern', 24, 34, (g) => {
		g.fillStyle(C('#7c7670'), 1).fillRect(6, 28, 12, 5); // stone base
		g.fillStyle(C('#8e8880'), 1).fillRect(8, 10, 8, 18); // post
		g.fillStyle(C('#6e685e'), 1).fillRect(5, 6, 14, 5).fillRect(7, 2, 10, 4); // cap
		g.fillStyle(C('#9fdff0'), 0.55).fillCircle(12, 18, 8); // glow
		g.fillStyle(C('#d8f0fa'), 1).fillTriangle(8, 22, 16, 22, 12, 12); // quartz shard
		g.fillStyle(0xffffff, 0.9).fillCircle(12, 15, 1.4);
	});
	o('obsidiantotem', 24, 36, (g) => {
		g.fillStyle(C('#7c7670'), 1).fillEllipse(12, 33, 18, 6); // stone foot
		g.fillStyle(C('#2e2b38'), 1).fillRoundedRect(7, 4, 10, 28, 3); // glassy column
		g.fillStyle(C('#46435a'), 1).fillTriangle(7, 4, 17, 4, 12, 32);
		g.fillStyle(0xffffff, 0.5).fillRect(10, 8, 2, 20); // sharp highlight
		g.fillStyle(C('#8fd0e8'), 0.5).fillCircle(12, 12, 2); // cold glint
	});

	// ---- weather-resource craftables (bespoke art) ----
	// Rain Basin — a carved stone bowl brimming with collected rainwater.
	o('rainbasin', 34, 30, (g) => {
		g.fillStyle(C('#7d7a72'), 1).fillEllipse(17, 24, 28, 9);            // stone base shadow
		g.fillStyle(C('#9a978d'), 1).fillRoundedRect(4, 12, 26, 12, 5);     // bowl body
		g.fillStyle(C('#84817a'), 1).fillEllipse(17, 12, 26, 9);            // rim
		g.fillStyle(C('#6fa8d6'), 1).fillEllipse(17, 12, 20, 6);            // water
		g.fillStyle(C('#bfe0f4'), 0.8).fillEllipse(13, 11, 7, 2);          // sky glint
		g.lineStyle(1, C('#bfe0f4'), 0.5).strokeEllipse(17, 12, 13, 4);     // ripple
		g.fillStyle(C('#cdecff'), 0.9).fillCircle(21, 6, 1).fillCircle(15, 4, 1); // falling drops
	});
	// Dewlit Lantern — a glass globe of glowing morning dew on a slim post.
	o('dewlantern', 24, 38, (g) => {
		g.fillStyle(C('#6e5a3a'), 1).fillRect(11, 20, 2, 16);              // post
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(12, 36, 12, 4);          // foot
		g.fillStyle(C('#a8d2c0'), 0.35).fillCircle(12, 13, 11);          // soft glow halo
		g.fillStyle(C('#cdeee0'), 0.95).fillCircle(12, 13, 7);          // dew globe
		g.fillStyle(C('#7fc4a8'), 0.9).fillCircle(12, 15, 4);          // dew pool inside
		g.fillStyle(0xffffff, 0.9).fillCircle(9, 10, 1.6);            // highlight
		g.fillStyle(C('#6e5a3a'), 1).fillRect(7, 4, 10, 2);          // top cap
	});
	// Sunstone Cairn — a stack of warm, sun-baked stones with an inner glow.
	o('sunstonecairn', 30, 34, (g) => {
		g.fillStyle(C('#b98a3a'), 1).fillEllipse(15, 30, 24, 7);          // base
		g.fillStyle(C('#e6a94e'), 1).fillEllipse(15, 27, 20, 9);          // bottom stone
		g.fillStyle(C('#eebb63'), 1).fillEllipse(14, 19, 15, 8);          // mid stone
		g.fillStyle(C('#f5cf7e'), 1).fillEllipse(15, 12, 10, 7);          // top stone
		g.fillStyle(C('#fff0c4'), 0.7).fillCircle(15, 12, 3);            // warm glow
		g.fillStyle(0xffffff, 0.5).fillCircle(12, 10, 1.4);            // glint
		g.lineStyle(1, C('#a8742c'), 0.5).strokeEllipse(15, 27, 10, 4);   // seam
	});
	// Frostflower Planter — pale-blue ice blooms in a wooden box.
	o('frostflowerplanter', 32, 30, (g) => {
		g.fillStyle(C('#6e5a3a'), 1).fillRoundedRect(5, 18, 22, 10, 2);    // planter box
		g.fillStyle(C('#5a4a30'), 1).fillRect(5, 18, 22, 2);             // soil line
		const bloom = (x: number, y: number) => {
			g.fillStyle(C('#bcd9e8'), 1);
			for (let i = 0; i < 5; i++) { const an = (i / 5) * Math.PI * 2; g.fillCircle(x + Math.cos(an) * 3.2, y + Math.sin(an) * 3.2, 2.2); }
			g.fillStyle(C('#eaf6ff'), 1).fillCircle(x, y, 2);            // pale core
		};
		g.lineStyle(1, C('#8fb8cc'), 1).lineBetween(11, 18, 11, 10).lineBetween(21, 18, 21, 12);
		bloom(11, 8); bloom(21, 10);
		g.fillStyle(0xffffff, 0.6).fillCircle(9, 6, 1);                // frost sparkle
	});
	// Stormglass Lantern — a shard of lightning-fused glass throwing cold light.
	o('stormglasslantern', 26, 38, (g) => {
		g.fillStyle(C('#3a2f4a'), 1).fillRect(12, 22, 2, 14);            // post
		g.fillStyle(C('#2c2438'), 1).fillEllipse(13, 36, 12, 4);        // foot
		g.fillStyle(C('#7b8fd6'), 0.3).fillCircle(13, 13, 12);         // electric halo
		g.fillStyle(C('#5566a3'), 1).fillTriangle(13, 3, 6, 22, 20, 22); // glass shard
		g.fillStyle(C('#8fa0e0'), 0.9).fillTriangle(13, 7, 9, 20, 17, 20); // inner glass
		g.lineStyle(1.5, C('#dfe6ff'), 0.95).lineBetween(13, 8, 10, 15).lineBetween(10, 15, 15, 16).lineBetween(15, 16, 12, 21); // lightning
		g.fillStyle(0xffffff, 0.8).fillCircle(11, 11, 1.2);           // glint
	});

	// ---- weather-resource home decor (indoor, bespoke art) ----
	// Frostflower Vase — a clear glass vase of pale ice-blooms on the sill.
	o('frostflowervase', 26, 34, (g) => {
		g.fillStyle(C('#cfe6f2'), 0.5).fillRoundedRect(8, 16, 10, 14, 3);   // glass vase body
		g.fillStyle(C('#eaf6ff'), 0.7).fillRoundedRect(9, 17, 4, 12, 2);    // glass highlight
		g.fillStyle(C('#9fc4d8'), 0.6).fillEllipse(13, 30, 12, 4);          // base shadow
		g.lineStyle(1, C('#8fb8cc'), 1).lineBetween(13, 16, 10, 8).lineBetween(13, 16, 16, 6).lineBetween(13, 16, 13, 5); // stems
		const bloom = (x: number, y: number) => {
			g.fillStyle(C('#bcd9e8'), 1);
			for (let i = 0; i < 5; i++) { const an = (i / 5) * Math.PI * 2; g.fillCircle(x + Math.cos(an) * 3, y + Math.sin(an) * 3, 2); }
			g.fillStyle(C('#eaf6ff'), 1).fillCircle(x, y, 1.8);
		};
		bloom(10, 7); bloom(16, 5); bloom(13, 4);
		g.fillStyle(0xffffff, 0.6).fillCircle(9, 3, 0.9);                   // frost sparkle
	});
	// Stormglass Chandelier — hanging cluster of lightning-glass shards.
	o('stormglasschandelier', 36, 30, (g) => {
		g.fillStyle(C('#3a2f4a'), 1).fillRect(17, 0, 2, 6);                 // chain
		g.fillStyle(C('#2c2438'), 1).fillRoundedRect(7, 5, 22, 3, 1);       // crossbar
		g.fillStyle(C('#7b8fd6'), 0.25).fillEllipse(18, 16, 30, 18);       // cool glow
		const shard = (x: number) => {
			g.fillStyle(C('#5566a3'), 1).fillTriangle(x, 8, x - 3, 22, x + 3, 22);
			g.fillStyle(C('#8fa0e0'), 0.9).fillTriangle(x, 11, x - 1.5, 21, x + 1.5, 21);
			g.fillStyle(0xffffff, 0.8).fillCircle(x - 1, 12, 0.9);
		};
		shard(9); shard(18); shard(27);
		g.lineStyle(1, C('#dfe6ff'), 0.7).lineBetween(9, 22, 18, 26).lineBetween(18, 26, 27, 22); // light arc
	});

	// ---- wetland craftables (bespoke art) ----
	// Boardwalk — raised plank walkway over the marsh.
	o('boardwalk', 40, 24, (g) => {
		g.fillStyle(C('#46708a'), 0.5).fillRect(0, 14, 40, 10);             // water beneath
		g.fillStyle(C('#5a3f28'), 1).fillRect(4, 18, 2, 5).fillRect(20, 18, 2, 5).fillRect(34, 18, 2, 5); // posts
		g.fillStyle(C('#9a7448'), 1).fillRect(2, 10, 36, 6);               // deck
		g.fillStyle(C('#7c5a3c'), 1);
		for (let x = 4; x < 38; x += 5) g.fillRect(x, 10, 1, 6);           // plank seams
		g.fillStyle(C('#b8956a'), 1).fillRect(2, 10, 36, 1);              // sunlit top edge
	});
	// Heron Rookery — a tall snag with a stick nest for wading birds.
	o('heronrookery', 30, 40, (g) => {
		g.fillStyle(C('#8a8270'), 1).fillRect(13, 10, 4, 28);              // dead trunk
		g.fillStyle(C('#6f6857'), 1).fillRect(13, 10, 1.5, 28);           // shadow side
		g.fillStyle(C('#7a6a4a'), 1).fillRect(6, 16, 8, 2).fillRect(16, 22, 8, 2); // bare branches
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(15, 8, 20, 8);           // stick nest
		g.fillStyle(C('#6e5a3a'), 1);
		for (let i = 0; i < 7; i++) g.fillRect(6 + i * 3, 6, 2, 1);       // nest sticks
		g.fillStyle(C('#eae6da'), 1).fillCircle(12, 7, 1.4).fillCircle(17, 7, 1.4); // eggs
	});
	// Dragonfly Pond — open water ringed with reeds, a dragonfly skimming.
	o('dragonflypond', 36, 28, (g) => {
		g.fillStyle(C('#3f7d6a'), 1).fillEllipse(18, 18, 32, 16);          // pond
		g.fillStyle(C('#5aa6cf'), 0.8).fillEllipse(18, 16, 24, 10);       // open water
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 14, 8, 2);            // glint
		g.lineStyle(2, C('#6da84e'), 1).lineBetween(5, 22, 4, 10).lineBetween(31, 22, 33, 9).lineBetween(9, 23, 8, 13); // reeds
		g.fillStyle(C('#3a5f2e'), 1).fillCircle(4, 9, 1.5).fillCircle(33, 8, 1.5); // reed heads
		g.fillStyle(C('#5b9cab'), 1).fillRect(19, 9, 6, 1.4);            // dragonfly wings
		g.fillStyle(C('#2f6f6a'), 1).fillRect(21, 8, 2, 4);              // dragonfly body
	});
}

/**
 * Animal sprite registry. Each entry is a width/height + a draw function using
 * the same primitives as the Phaser Graphics API. The in-game textures and the
 * field-journal thumbnails both render from these, so they always match.
 * Featured species have bespoke art with baked colours; generic kind bodies are
 * drawn in white (0xffffff) and tinted per animal.
 */
export const ANIMAL_SPRITES: Record<string, { w: number; h: number; draw: (g: G) => void }> = {};
const a = (key: string, w: number, h: number, draw: (g: G) => void) => { ANIMAL_SPRITES[key] = { w, h, draw }; };

/** Generate the Phaser textures for every animal sprite. */
export function makeAnimalTextures(scene: Phaser.Scene) {
	for (const [key, s] of Object.entries(ANIMAL_SPRITES)) tex(scene, `ani-${key}`, s.w, s.h, s.draw);
	// A bespoke trait-built sprite for every animal that isn't a hand-drawn
	// featured one, so no two species share a silhouette.
	for (const an of bridge.shared.data?.animals || []) {
		if (FEATURED_TEXTURE[an.id] || /snake/.test(an.id)) continue;
		const c = composeAnimalDraw(an.id, an.kind);
		tex(scene, `ani-gen-${an.id}`, c.w, c.h, c.draw);
	}
}

/** Make sure one animal's trait sprite exists (covers the fresh-login race where
 * definitions arrive after the scene first booted). */
export function ensureAnimalTexture(scene: Phaser.Scene, id: string, kind: string) {
	if (FEATURED_TEXTURE[id] || /snake/.test(id)) return; // those are always registered
	const key = `ani-gen-${id}`;
	if (scene.textures.exists(key)) return;
	const c = composeAnimalDraw(id, kind);
	tex(scene, key, c.w, c.h, c.draw);
}

{
	a('rabbit', 26, 26, (g) => {
		g.fillStyle(C('#b0987c'), 1).fillRect(9, 23, 3.5, 3).fillRect(16, 23, 3.5, 3); // feet
		g.fillEllipse(13, 18, 18, 13).fillCircle(20, 13, 6);
		g.fillEllipse(18, 5, 4, 10).fillEllipse(23, 6, 4, 10); // ears
		g.fillStyle(0xffffff, 1).fillCircle(4, 19, 4); // tail
		g.fillStyle(0x2e2018, 1).fillCircle(22, 12, 1.4);
	});
	a('butterfly', 24, 20, (g) => {
		g.fillStyle(C('#e8771f'), 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12);
		g.fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
		g.lineStyle(2, 0x2e2018, 1).strokeEllipse(7, 8, 12, 12).strokeEllipse(17, 8, 12, 12);
		g.fillStyle(0x2e2018, 1).fillEllipse(12, 11, 3, 12);
	});
	a('sparrow', 28, 20, (g) => {
		g.fillStyle(C('#8a6a44'), 1).fillEllipse(11, 11, 16, 12);
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(10, 14, 10, 7); // breast
		g.fillStyle(C('#8a6a44'), 1).fillCircle(19, 7, 5);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(23, 7, 27, 8, 23, 10); // beak
		g.fillStyle(0x2e2018, 1).fillCircle(20, 6, 1.2);
	});
	a('deer', 34, 32, (g) => {
		g.fillStyle(C('#b08a5c'), 1).fillEllipse(15, 16, 22, 14);
		g.fillRect(7, 22, 3, 9).fillRect(21, 22, 3, 9); // legs
		g.fillCircle(27, 9, 6);
		g.fillEllipse(24, 3, 3, 7).fillEllipse(30, 3, 3, 7); // big mule ears
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(6, 14, 6, 7); // rump patch
		g.fillStyle(0x2e2018, 1).fillCircle(29, 8, 1.3);
	});
	a('fox', 32, 26, (g) => {
		g.fillStyle(C('#46301f'), 1).fillRect(9, 19, 3, 6).fillRect(14, 20, 3, 6).fillRect(20, 19, 3, 6); // dark-socked legs
		g.fillStyle(C('#d3722e'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6);
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillEllipse(6, 16, 12, 8); // tail
		g.fillStyle(0xffffff, 1).fillCircle(3, 15, 3).fillEllipse(24, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	});
	a('squirrel', 26, 26, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(11, 22, 3.4, 4).fillRect(17, 22, 3.4, 4); // feet
		g.fillEllipse(14, 18, 14, 11).fillCircle(20, 12, 5);
		g.fillStyle(C('#7c5a3c'), 1).fillEllipse(6, 12, 9, 16); // big tail
		g.fillCircle(19, 7, 2); // ear
		g.fillStyle(0x2e2018, 1).fillCircle(21, 11, 1.2);
	});
	a('woodpecker', 22, 26, (g) => {
		g.fillStyle(0x2e2e2e, 1).fillEllipse(10, 14, 12, 16);
		g.fillStyle(0xffffff, 1).fillEllipse(9, 16, 6, 9);
		g.fillStyle(C('#c0392b'), 1).fillCircle(13, 5, 4); // red cap
		g.fillStyle(0x2e2e2e, 1).fillCircle(14, 7, 3.4);
		g.fillStyle(C('#8e8e8a'), 1).fillTriangle(17, 7, 22, 8, 17, 10);
	});
	a('salamander', 30, 18, (g) => {
		g.fillStyle(C('#3a4a3a'), 1).fillEllipse(13, 10, 18, 8).fillCircle(22, 8, 4);
		g.fillEllipse(5, 11, 10, 4); // tail
		g.fillStyle(C('#e8954f'), 1).fillCircle(10, 9, 1.6).fillCircle(15, 11, 1.6).fillCircle(19, 8, 1.4);
		g.fillStyle(0x2e2018, 1).fillCircle(24, 7, 1);
	});
	a('snake', 36, 18, (g) => {
		// a legless serpent: a smooth S-curve of overlapping body segments,
		// a slightly larger head, an eye, and a little forked tongue
		g.fillStyle(0xffffff, 1);
		const body: [number, number, number][] = [
			[4, 11, 3], [7, 8, 3.3], [11, 7, 3.5], [15, 8, 3.5],
			[19, 10, 3.5], [23, 12, 3.4], [26, 10, 3.3],
		];
		for (const [x, y, r] of body) g.fillCircle(x, y, r);
		g.fillCircle(29, 8, 4); // head
		g.lineStyle(1, C('#c0392b'), 1).lineBetween(33, 8, 36, 6).lineBetween(33, 8, 36, 10); // forked tongue
		g.fillStyle(0x2e2018, 1).fillCircle(30, 7, 1); // eye
	});
	a('owl', 26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillTriangle(5, 6, 9, 12, 3, 12).fillTriangle(21, 6, 23, 12, 17, 12); // tufts
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(13, 20, 12, 14);
		g.fillStyle(0xf4e3b1, 1).fillCircle(9, 12, 3.4).fillCircle(17, 12, 3.4);
		g.fillStyle(0x2e2018, 1).fillCircle(9, 12, 1.6).fillCircle(17, 12, 1.6);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(13, 14, 11, 17, 15, 17);
	});
	a('bear', 40, 32, (g) => {
		// Matches the house style (deer/fox): body, head, ears, muzzle + nose,
		// and a single small light eye-dot each — like the bat — since the fur
		// is dark. No eye whites/pupils/catchlights; those read too detailed.
		g.fillStyle(0x2a2118, 1).fillRoundedRect(11, 22, 8, 9, 3).fillRoundedRect(25, 22, 8, 9, 3); // legs
		g.fillStyle(C('#6e4d34'), 1).fillEllipse(20, 18, 32, 18); // body (warm brown, light enough for dark eyes)
		g.fillCircle(29, 12, 9); // head
		g.fillCircle(23, 5, 4).fillCircle(35, 5, 4); // ears
		g.fillStyle(C('#9a7a54'), 1).fillEllipse(31, 15, 9, 6); // muzzle
		g.fillStyle(0x1a1410, 1).fillCircle(34, 14, 1.4); // nose
		g.fillStyle(0x2e2018, 1).fillCircle(26, 10, 1.3).fillCircle(31, 10, 1.3); // eyes (dark, like fox/deer)
	});
	a('raccoon', 38, 30, (g) => {
		// Matches the house style: body, head, ears, ringed tail, pale muzzle,
		// bandit mask, and a single small light eye-dot on the mask (like the
		// yellowthroat's masked face). No pupils/catchlights.
		g.fillStyle(C('#6e6857'), 1).fillRoundedRect(13, 21, 5, 9, 2).fillRoundedRect(24, 21, 5, 9, 2); // legs
		g.fillStyle(C('#8a7a5c'), 1).fillEllipse(7, 17, 15, 10); // ringed tail
		g.fillStyle(0x4a3f30, 1).fillEllipse(5, 18, 4, 8).fillEllipse(11, 15, 3.5, 9); // tail rings
		g.fillStyle(C('#9c988a'), 1).fillEllipse(20, 18, 26, 15); // body
		g.fillCircle(28, 12, 9); // head
		g.fillCircle(22, 4, 4).fillCircle(34, 4, 4); // ears
		g.fillStyle(C('#efe9dc'), 1).fillEllipse(28, 15, 12, 9); // pale muzzle
		g.fillStyle(0x3a3128, 1).fillEllipse(24.5, 10.5, 6, 5).fillEllipse(31.5, 10.5, 6, 5); // bandit mask
		g.fillStyle(C('#f2ece0'), 1).fillCircle(25, 10.5, 1.3).fillCircle(31, 10.5, 1.3); // eyes
		g.fillStyle(0x2e2018, 1).fillEllipse(28, 16, 2.2, 1.6); // nose
	});

	// --- unique sprites for the newer animals ---
	a('mantis', 28, 22, (g) => {
		g.fillStyle(C('#7fb04a'), 1).fillEllipse(13, 14, 18, 7).fillEllipse(6, 16, 8, 5); // body + abdomen
		g.fillStyle(C('#6a9a3a'), 1).fillTriangle(20, 9, 26, 6, 24, 12); // angular head
		g.lineStyle(2, C('#7fb04a'), 1).lineBetween(20, 12, 24, 17).lineBetween(24, 17, 19, 18); // raised foreleg
		g.fillStyle(0x2e2018, 1).fillCircle(24, 8, 1.2);
	});
	a('killdeer', 28, 20, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillEllipse(12, 12, 18, 10).fillCircle(20, 8, 4.5); // brown back + head
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 14, 6); // white belly
		g.fillStyle(0x2e2018, 1).fillRect(7, 11, 13, 1.6).fillRect(7, 14, 13, 1.6); // two breast bands
		g.fillStyle(0x1a1a1a, 1).fillTriangle(24, 7, 28, 8, 24, 9); // bill
		g.fillStyle(C('#d83a3a'), 1).fillCircle(21, 7, 1.4); // red eye-ring
		g.fillStyle(0x2e2018, 1).fillCircle(21, 7, 0.9);
	});
	a('redadmiral', 24, 20, (g) => {
		g.fillStyle(C('#2a2420'), 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12); // dark forewings
		g.fillStyle(C('#2a2420'), 1).fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
		g.fillStyle(C('#d8472a'), 1).fillTriangle(2, 9, 9, 7, 5, 13).fillTriangle(22, 9, 15, 7, 19, 13); // red bands
		g.fillStyle(C('#d8472a'), 1).fillRect(5, 18, 6, 2).fillRect(13, 18, 6, 2);
		g.fillStyle(0x2e2018, 1).fillEllipse(12, 11, 2.4, 12);
	});
	a('bat', 30, 20, (g) => {
		g.fillStyle(C('#5a4636'), 1).fillTriangle(15, 11, 2, 4, 4, 16).fillTriangle(15, 11, 28, 4, 26, 16); // wings
		g.fillStyle(C('#3a2c22'), 1).fillEllipse(15, 11, 8, 11); // body
		g.fillStyle(C('#3a2c22'), 1).fillTriangle(12, 4, 14, 8, 11, 8).fillTriangle(18, 4, 16, 8, 19, 8); // ears
		g.fillStyle(C('#e3a14f'), 1).fillCircle(13, 9, 1).fillCircle(17, 9, 1); // eyes
	});
	a('ensatina', 28, 16, (g) => {
		g.fillStyle(C('#c4682f'), 1).fillEllipse(13, 9, 18, 7).fillCircle(22, 8, 3.6); // orange body + head
		g.fillStyle(C('#7a3e1c'), 1).fillEllipse(13, 7, 16, 3); // darker back
		g.fillStyle(C('#c4682f'), 1).fillEllipse(5, 10, 9, 3.4); // tail
		g.fillStyle(C('#3a2c22'), 1).fillRect(8, 12, 2, 3).fillRect(16, 12, 2, 3); // little legs
		g.fillStyle(0x2e2018, 1).fillCircle(23, 7, 1);
	});
	a('towhee', 27, 20, (g) => {
		g.fillStyle(0x1c1c1c, 1).fillEllipse(11, 11, 16, 12).fillCircle(18, 7, 4.5); // black hood/back
		g.fillStyle(C('#b5532f'), 1).fillEllipse(8, 14, 9, 8); // rufous flank
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 6, 5); // white belly
		g.fillStyle(C('#d83a3a'), 1).fillCircle(19, 6, 1.1); // red eye
		g.fillStyle(0x1a1a1a, 1).fillTriangle(22, 6, 26, 7, 22, 9);
	});
	a('merganser', 30, 22, (g) => {
		g.fillStyle(C('#5a3a22'), 1).fillEllipse(13, 14, 20, 11); // brown body
		g.fillStyle(0x1c1c1c, 1).fillCircle(22, 9, 5); // black head
		g.fillStyle(C('#f4efe6'), 1).fillTriangle(20, 9, 27, 4, 27, 11); // white fan crest
		g.fillStyle(C('#caa15a'), 1).fillTriangle(26, 9, 30, 10, 26, 11); // bill
		g.fillStyle(C('#e8d35e'), 1).fillCircle(22, 8, 1); // yellow eye
	});
	a('spottedturtle', 28, 18, (g) => {
		g.fillStyle(C('#2c3a30'), 1).fillEllipse(14, 11, 22, 12); // dark domed shell
		g.fillStyle(C('#1d2620'), 1).fillEllipse(14, 13, 22, 6);
		g.fillStyle(C('#e8c84a'), 1); // yellow dots
		for (const [x, y] of [[8, 8], [13, 6], [18, 8], [11, 10], [17, 11]] as const) g.fillCircle(x, y, 1.3);
		g.fillStyle(C('#3a4a3a'), 1).fillCircle(25, 11, 3.4); // head
		g.fillStyle(C('#e8c84a'), 1).fillCircle(26, 10, 0.7);
		g.fillStyle(0x2e2018, 1).fillCircle(26, 11, 0.8);
	});
	a('yellowthroat', 24, 18, (g) => {
		g.fillStyle(C('#9a8a4a'), 1).fillEllipse(10, 10, 15, 10); // olive back
		g.fillStyle(C('#f2d83a'), 1).fillEllipse(9, 12, 11, 8).fillCircle(16, 8, 4); // yellow throat + head
		g.fillStyle(0x1a1a1a, 1).fillRect(13, 6, 8, 3.4); // black bandit mask
		g.fillStyle(C('#f2d83a'), 1).fillCircle(15, 8, 1.4);
		g.fillStyle(0x1a1a1a, 1).fillTriangle(20, 7, 23, 8, 20, 9);
	});
	a('chuckwalla', 32, 18, (g) => {
		g.fillStyle(C('#4a3a30'), 1).fillEllipse(14, 10, 22, 9).fillCircle(24, 9, 4); // stout dark body + head
		g.fillStyle(C('#b5683f'), 1).fillEllipse(6, 11, 12, 5); // lighter tail
		g.fillStyle(C('#4a3a30'), 1).fillRect(9, 13, 2.5, 3).fillRect(18, 13, 2.5, 3); // legs
		g.fillStyle(0x2e2018, 1).fillCircle(25, 8, 1);
	});
	a('phainopepla', 24, 22, (g) => {
		g.fillStyle(0x16161a, 1).fillEllipse(12, 14, 15, 12).fillCircle(17, 8, 4.5); // glossy black
		g.fillStyle(0x16161a, 1).fillTriangle(14, 5, 18, 1, 20, 6); // pointed crest
		g.fillStyle(C('#d83a3a'), 1).fillCircle(18, 7, 1.2); // red eye
		g.fillStyle(0x2e2018, 1).fillTriangle(21, 7, 24, 8, 21, 9);
	});
	a('antelopesquirrel', 28, 22, (g) => {
		g.fillStyle(C('#c2a06a'), 1).fillEllipse(13, 16, 16, 10).fillCircle(20, 11, 4.5); // sandy body
		g.fillStyle(C('#e8dcc2'), 1).fillEllipse(8, 8, 12, 5); // tail arched over back
		g.fillStyle(C('#f4efe6'), 1).fillRect(10, 13, 8, 1.4); // white side stripe
		g.fillStyle(0x2e2018, 1).fillCircle(21, 10, 1);
	});
	a('alpinechipmunk', 26, 22, (g) => {
		g.fillStyle(C('#9a8460'), 1).fillEllipse(13, 15, 15, 9).fillCircle(20, 11, 4); // greyish body
		g.fillStyle(C('#7a6446'), 1).fillEllipse(6, 11, 9, 13); // tail
		g.fillStyle(0x2e2620, 1).fillRect(9, 11, 8, 1).fillRect(9, 14, 8, 1); // back stripes
		g.fillStyle(C('#f4efe6'), 1).fillRect(9, 12.5, 8, 1);
		g.fillStyle(0x2e2018, 1).fillCircle(21, 10, 1);
	});
	a('whitecrown', 24, 20, (g) => {
		g.fillStyle(C('#9a8a72'), 1).fillEllipse(11, 12, 16, 10); // grey-brown body
		g.fillStyle(C('#d8cdba'), 1).fillEllipse(10, 14, 11, 6); // pale breast
		g.fillStyle(C('#e8e2d6'), 1).fillCircle(18, 8, 4); // head base
		g.fillStyle(0x1a1a1a, 1).fillRect(15, 5, 7, 1.4).fillRect(15, 8, 7, 1.4); // black crown stripes
		g.fillStyle(C('#e3a14f'), 1).fillTriangle(21, 8, 24, 9, 21, 10); // orange bill
		g.fillStyle(0x2e2018, 1).fillCircle(18, 8, 0.9);
	});
	a('cascadesfrog', 24, 18, (g) => {
		g.fillStyle(C('#6a7a40'), 1).fillEllipse(12, 12, 18, 11); // green-brown body
		g.fillStyle(C('#4a5a2c'), 1).fillCircle(8, 9, 1.3).fillCircle(14, 8, 1.3).fillCircle(11, 13, 1.3).fillCircle(16, 12, 1.3); // spots
		g.fillStyle(C('#8a9a58'), 1).fillCircle(7, 7, 2.6).fillCircle(17, 7, 2.6); // bulging eyes
		g.fillStyle(0x2e2018, 1).fillCircle(7, 7, 1.1).fillCircle(17, 7, 1.1);
		g.fillStyle(C('#6a7a40'), 1).fillTriangle(4, 16, 9, 14, 6, 17).fillTriangle(20, 16, 15, 14, 18, 17); // legs
	});
	a('turnstone', 26, 20, (g) => {
		g.fillStyle(C('#3a3a42'), 1).fillEllipse(12, 11, 18, 11).fillCircle(19, 8, 4); // dark slate
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 13, 6); // white belly
		g.fillStyle(0x1a1a1a, 1).fillTriangle(22, 7, 26, 8, 22, 9); // bill
		g.fillStyle(C('#e3a14f'), 1).fillRect(9, 18, 1.6, 2.4).fillRect(14, 18, 1.6, 2.4); // legs
		g.fillStyle(C('#f2ece0'), 1).fillCircle(20, 7, 0.9);
	});
	a('guillemot', 28, 22, (g) => {
		g.fillStyle(0x1a1a1a, 1).fillEllipse(12, 13, 18, 12).fillCircle(19, 8, 4.5); // black body
		g.fillStyle(C('#f4efe6'), 1).fillEllipse(10, 11, 7, 5); // white wing patch
		g.fillStyle(0x16161a, 1).fillTriangle(22, 7, 27, 8, 22, 9); // bill
		g.fillStyle(C('#d8472a'), 1).fillRect(10, 19, 1.8, 3).fillRect(15, 19, 1.8, 3); // red feet
		g.fillStyle(C('#f4efe6'), 1).fillCircle(20, 7, 0.8);
	});
	a('batstar', 24, 24, (g) => {
		g.fillStyle(C('#d8542f'), 1);
		const cx = 12, cy = 12, R = 11;
		for (let i = 0; i < 5; i++) {
			const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
			const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
			const a0 = ((i - 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
			g.fillTriangle(cx, cy, cx + Math.cos(a0) * R * 0.6, cy + Math.sin(a0) * R * 0.6, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
			g.fillTriangle(cx, cy, cx + Math.cos(a2) * R * 0.6, cy + Math.sin(a2) * R * 0.6, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
		}
		g.fillStyle(C('#e8825a'), 1).fillCircle(cx, cy, 4); // webbed center
		g.fillStyle(C('#b53a1f'), 1).fillCircle(cx, cy, 1.4);
	});

	// Generic bodies by kind. Each kind gets three silhouette variants so that,
	// combined with a unique per-animal tint and size, even same-kind animals
	// read as distinct individuals rather than copies of one another.
	for (let v = 0; v < 3; v++) {
		a(`mammal-${v}`, 28, 22, (g) => {
			const bw = 15 + v * 3;
			g.fillStyle(0xffffff, 1).fillRect(7, 16, 3, 5).fillRect(16, 16, 3, 5); // legs
			g.fillEllipse(13, 14, bw, 11).fillCircle(20, 9, 5);
			if (v === 0) g.fillCircle(18, 4, 2.4).fillCircle(22, 4, 2.4); // round ears
			else if (v === 1) g.fillEllipse(18, 3, 3, 7).fillEllipse(22, 3, 3, 7); // tall ears
			else g.fillTriangle(16, 5, 19, 0, 21, 5).fillTriangle(20, 5, 23, 0, 25, 5); // pointed ears
			if (v === 0) g.fillEllipse(4, 13, 5, 4); // stub tail
			else if (v === 1) g.fillEllipse(3, 12, 10, 4); // long tail
			else g.fillCircle(4, 12, 4.5); // bushy tail
			g.fillStyle(0x2e2018, 1).fillCircle(21, 8, 1.2);
		});
		a(`bird-${v}`, 24, 20, (g) => {
			g.fillStyle(0xffffff, 1).fillEllipse(10, 11, 13 + v * 2, 11).fillCircle(16, 6, 4);
			g.fillStyle(0xe3c75f, 1).fillTriangle(19, 6, 23, 7, 19, 9);
			g.fillStyle(0xffffff, 1);
			if (v === 1) g.fillTriangle(1, 8, 8, 11, 2, 15); // long tail
			else if (v === 2) g.fillTriangle(13, 1, 16, 5, 18, 2); // head crest
			g.fillStyle(0x2e2018, 1).fillCircle(17, 5, 1);
		});
		a(`insect-${v}`, 18, 16, (g) => {
			const ww = 7 + v;
			g.fillStyle(0xffffff, 0.85).fillEllipse(5, 5, ww, 7).fillEllipse(12, 5, ww, 7);
			if (v === 2) g.fillEllipse(5, 11, ww - 2, 5).fillEllipse(12, 11, ww - 2, 5); // hindwings
			g.fillStyle(0x2e2018, 1).fillEllipse(8, 8, 3, v === 0 ? 6 : 9);
		});
		a(`reptile-${v}`, 30, 16, (g) => {
			g.fillStyle(0xffffff, 1).fillEllipse(13, 8, 16 + v * 2, 7).fillCircle(21, 7, 3.4);
			g.fillEllipse(3, 8, 8 + v * 2, 3.4); // tail
			if (v === 2) g.fillRect(9, 11, 2, 3).fillRect(16, 11, 2, 3); // little legs
			g.fillStyle(0x2e2018, 1).fillCircle(22, 6, 1);
		});
		a(`amphibian-${v}`, 24, 16, (g) => {
			g.fillStyle(0xffffff, 1).fillEllipse(11, 10, 15 + v * 2, 9).fillCircle(16, 6, 4);
			if (v === 1) g.fillCircle(13, 3.5, 2).fillCircle(19, 3.5, 2); // bulging eyes
			g.fillStyle(0x2e2018, 1).fillCircle(17, 5, 1.2);
			if (v === 1) g.fillCircle(13, 3.2, 0.9).fillCircle(19, 3.2, 0.9);
		});
		a(`fish-${v}`, 26, 16, (g) => {
			g.fillStyle(0xffffff, 1).fillEllipse(13, 8, 15 + v * 2, 9);
			g.fillTriangle(2, 3, 6, 8, 2, 13); // tail
			if (v === 2) g.fillTriangle(12, 1, 16, 5, 12, 5); // dorsal fin
			g.fillStyle(0x2e2018, 1).fillCircle(18, 7, 1.2);
		});
		a(`invertebrate-${v}`, 20, 18, (g) => {
			g.fillStyle(0xffffff, 1).fillCircle(9, 9, 6 + v);
			if (v === 2) {
				g.lineStyle(1.4, 0xffffff, 1);
				for (let i = 0; i < 3; i++) g.lineBetween(4, 7 + i * 3, 1, 6 + i * 3).lineBetween(14, 7 + i * 3, 17, 6 + i * 3);
			}
			g.lineStyle(1, 0x2e2018, 0.4).strokeCircle(9, 9, 4);
			g.fillStyle(0x2e2018, 1).fillCircle(13, 6, 1);
		});
	}
}

const FEATURED_TEXTURE: Record<string, string> = {
	'cottontail-rabbit': 'ani-rabbit',
	'monarch-butterfly': 'ani-butterfly',
	'song-sparrow': 'ani-sparrow',
	'mule-deer': 'ani-deer',
	'red-fox-meadow': 'ani-fox',
	'red-fox-forest': 'ani-fox',
	'fox-alpine': 'ani-fox',
	'tree-squirrel': 'ani-squirrel',
	'woodpecker': 'ani-woodpecker',
	'forest-salamander': 'ani-salamander',
	'wetland-salamander': 'ani-salamander',
	'great-horned-owl': 'ani-owl',
	'barn-owl': 'ani-owl',
	'black-bear': 'ani-bear',
	'raccoon': 'ani-raccoon',
	'mule-deer-forest': 'ani-deer',
	'mule-deer-alpine': 'ani-deer',
	// newer animals — each gets its own bespoke sprite
	'praying-mantis': 'ani-mantis',
	'killdeer': 'ani-killdeer',
	'red-admiral': 'ani-redadmiral',
	'little-brown-bat': 'ani-bat',
	'ensatina': 'ani-ensatina',
	'spotted-towhee': 'ani-towhee',
	'hooded-merganser': 'ani-merganser',
	'spotted-turtle': 'ani-spottedturtle',
	'common-yellowthroat': 'ani-yellowthroat',
	'chuckwalla': 'ani-chuckwalla',
	'phainopepla': 'ani-phainopepla',
	'white-crowned-sparrow': 'ani-whitecrown',
	'cascades-frog': 'ani-cascadesfrog',
	'black-turnstone': 'ani-turnstone',
	'pigeon-guillemot': 'ani-guillemot',
	'bat-star': 'ani-batstar',
};

const GENERIC_KINDS = ['mammal', 'bird', 'insect', 'reptile', 'amphibian', 'fish'];

/** A soft, natural-looking colour unique to each animal id. */
function animalTint(hash: number): number {
	const h = (hash % 360) / 360;
	const s = 0.34 + ((hash >> 4) % 30) / 100; // 0.34 .. 0.63
	const v = 0.62 + ((hash >> 9) % 24) / 100; // 0.62 .. 0.85
	const c = Phaser.Display.Color.HSVToRGB(h, s, v) as any;
	return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const hexOf = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);

/**
 * Compose a distinctive sprite for ANY animal from its species traits, so every
 * creature reads as itself rather than one of a few shared silhouettes. The body
 * is drawn in white (so it picks up the animal's unique tint), with fixed-colour
 * features layered on — quills for a porcupine, antlers for a deer, long legs for
 * a heron, a domed shell for a turtle, and so on. Works for both the Phaser
 * texture and the SVG journal thumbnail (shared drawing API), and collapses to a
 * clean silhouette when drawn in silhouette mode.
 */
function composeAnimalDraw(id: string, kind: string): { w: number; h: number; draw: (g: G) => void } {
	const t = (re: RegExp) => re.test(id);
	const BODY = 0xffffff;       // tintable body colour
	const DK = 0x2e2018;         // eyes / dark detail
	const draw = (fn: (g: G) => void) => fn;

	if (kind === 'mammal') {
		if (t(/porcupine|hedgehog/)) {
			return { w: 38, h: 30, draw: draw((g) => {
				// Compact, low-slung body so it reads as cute and recognizable in thumbnails.
				g.fillStyle(C('#3a2c1e'), 1);

				const quills: [number, number, number, number, number, number][] = [
					[6, 16, 8, 8, 10, 16],
					[9, 15, 11, 6, 13, 15],
					[12, 14, 14, 7, 16, 14],
					[15, 14, 17, 5, 19, 14],
					[18, 14, 20, 7, 22, 14],
					[21, 15, 23, 8, 25, 15],
					[24, 16, 26, 10, 28, 16],
				];

				for (const [x1, y1, x2, y2, x3, y3] of quills) g.fillTriangle(x1, y1, x2, y2, x3, y3);

				// Tail + body.
				g.fillStyle(C('#4a3828'), 1).fillEllipse(6, 20, 8, 5);
				g.fillStyle(BODY, 1).fillEllipse(18, 18, 25, 14);
				g.fillCircle(30, 16, 5.6);

				// Tiny legs.
				g.fillRect(12, 24, 3.2, 4.5).fillRect(23, 24, 3.2, 4.5);

				// Face details.
				g.fillStyle(C('#3a2c1e'), 1).fillCircle(35, 17, 1.6);
				g.fillStyle(DK, 1).fillCircle(31, 14, 1.1);
				g.fillStyle(BODY, 1).fillCircle(28, 11, 2.2);

				// Soft quill highlights for readability at small sizes.
				g.lineStyle(1.1, C('#d8c49a'), 0.75);
				g.lineBetween(10, 15, 12, 9)
					.lineBetween(16, 14, 18, 8)
					.lineBetween(22, 15, 24, 10);
			}) };
		}

		// Fixed natural accent colours layered over the tintable body.
		const NOSE = 0x1a1410;

		// --- Cetaceans: smooth spindle body, flukes, dorsal fin, a flipper ---
		if (t(/whale|dolphin|porpoise/)) {
			const dolphin = t(/dolphin|porpoise/);
			return { w: 42, h: 22, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(21, 12, 32, 13);                       // spindle body
				g.fillTriangle(2, 5, 10, 12, 2, 12);                 // upper fluke
				g.fillTriangle(2, 19, 10, 12, 2, 12);                // lower fluke
				g.fillTriangle(19, 5, 24, 12, 14, 12);               // dorsal fin
				g.fillTriangle(23, 15, 31, 15, 24, 21);              // pectoral flipper
				if (dolphin) g.fillTriangle(35, 10, 42, 12, 35, 14); // rostrum/beak
				else { g.fillStyle(0x000000, 0.12).fillEllipse(24, 9, 22, 5); } // mottled back
				g.fillStyle(0xffffff, 0.28).fillEllipse(20, 16, 22, 5); // pale belly
				g.fillStyle(DK, 1).fillCircle(dolphin ? 33 : 32, 10, 1.1);
			}) };
		}
		// --- Seals: plump torpedo, fore-flippers, rear-flipper V, dog-like head ---
		if (t(/seal|sea-lion|walrus/)) {
			return { w: 38, h: 24, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillTriangle(2, 8, 11, 14, 2, 15).fillTriangle(2, 20, 11, 14, 2, 15); // rear flippers
				g.fillEllipse(19, 15, 30, 15);                       // body
				g.fillCircle(31, 11, 5.4);                           // head
				g.fillEllipse(35, 12, 5, 4);                         // snout
				g.fillTriangle(16, 22, 24, 17, 25, 24);             // fore-flipper
				if (t(/harbor|spotted/)) { g.fillStyle(0x000000, 0.22); for (const [x, y] of [[12, 11], [18, 13], [24, 11], [15, 17], [22, 16]] as const) g.fillCircle(x, y, 1.3); }
				g.fillStyle(NOSE, 1).fillCircle(37, 12, 1);
				g.fillStyle(DK, 1).fillCircle(31, 10, 1.2);
			}) };
		}
		// --- Otters (river & sea): long-bodied, four short legs, thick tapering
		//     tail — walking, since they move around on land and in water ---
		if (t(/otter/)) {
			const sea = t(/sea-otter/);
			return { w: 40, h: 24, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(8, 16, 17, 8);                        // thick tapering tail
				g.fillRect(13, 18, 3.6, 6).fillRect(19, 18, 3.6, 6).fillRect(25, 18, 3.6, 6).fillRect(30, 18, 3.6, 6); // four legs
				g.fillEllipse(21, 14, 28, sea ? 15 : 13);          // long low body (sea otter bulkier)
				g.fillCircle(33, 11, 5.2);                          // rounded head
				g.fillCircle(30, 6.5, 1.8).fillCircle(35.5, 6.5, 1.8); // small round ears
				g.fillStyle(C('#e8dcc6'), 0.55).fillEllipse(33, 13, 7, 5); // pale muzzle/throat
				g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
				g.fillStyle(DK, 1).fillCircle(33, 10, 1.2);
			}) };
		}
		// --- American badger: low broad body, short digging legs, and the
		//     signature face — white median stripe over a black-masked face ---
		if (t(/badger/)) {
			return { w: 40, h: 26, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillRect(9, 19, 4, 6).fillRect(15, 19, 4, 6).fillRect(25, 20, 4, 5).fillRect(31, 20, 4, 5); // short sturdy legs
				g.fillEllipse(18, 13, 32, 15);                     // broad, low, flat-backed body
				g.fillStyle(0xffffff, 0.14).fillEllipse(16, 9, 25, 7); // grizzled sheen along the back
				g.fillStyle(BODY, 1);
				g.fillCircle(31, 13, 5.4);                         // head (small, held low & forward)
				g.fillTriangle(35, 11, 39, 14, 35, 17);           // pointed snout
				g.fillCircle(28, 8, 1.9);                          // small ear
				// face: a round dark cheek badge with a white eye-spot inside it,
				// plus the white median stripe running from the crown to the nose
				g.fillStyle(C('#2b2620'), 1).fillCircle(32, 14, 4.8); // dark cheek badge
				g.fillStyle(C('#f4efe6'), 1);
				g.fillTriangle(27, 7, 29.5, 7, 38, 13).fillTriangle(29.5, 7, 38, 13, 36.5, 14.5); // white median stripe
				g.fillCircle(32.2, 13.6, 1.9);                    // white eye-spot inside the badge
				g.fillStyle(DK, 1).fillCircle(32.7, 13.6, 0.95);  // pupil
				g.fillStyle(C('#efe7d6'), 1).fillTriangle(25.5, 25, 27, 25, 26.2, 26.6).fillTriangle(27.5, 25, 29, 25, 28.2, 26.6); // front claws
				g.fillStyle(NOSE, 1).fillCircle(38.5, 13.5, 1.1); // nose
			}) };
		}
		// --- Minks, weasels, marten, fisher, ermine:
		//     long low sinuous body, short legs, small round ears ---
		if (t(/mink|weasel|ermine|marten|fisher|ferret|stoat/)) {
			const arch = t(/marten|fisher/);           // martens sit with an arched back
			return { w: 40, h: 22, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(7, 15, 14, 7);                    // thick tapering tail
				g.fillRect(12, 16, 3, 6).fillRect(20, 16, 3, 6).fillRect(27, 16, 3, 6); // short legs
				if (arch) { g.fillEllipse(13, 12, 16, 10).fillEllipse(24, 13, 14, 11); } // arched back
				else g.fillEllipse(19, 14, 28, 11);             // long tube body
				g.fillCircle(32, 11, 4.6);                      // small head
				g.fillCircle(29.5, 6.5, 1.7).fillCircle(34, 6.5, 1.7); // round ears
				if (t(/ermine|stoat|weasel/)) { g.fillStyle(0x111111, 1).fillEllipse(4, 15, 6, 5); } // black tail tip
				if (arch) { g.fillStyle(C('#e0a24a'), 1).fillEllipse(30, 15, 7, 4); } // throat bib
				g.fillStyle(NOSE, 1).fillCircle(35, 11, 1);
				g.fillStyle(DK, 1).fillCircle(32, 10, 1.2);
			}) };
		}
		// --- Deer / elk / moose: long legs, raised neck, big ears, antlers ---
		if (t(/deer|elk|moose|caribou|pronghorn/)) {
			const big = t(/elk|moose/);
			return { w: 40, h: 34, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillRect(11, 24, 3.4, 9).fillRect(17, 24, 3.4, 9).fillRect(24, 24, 3.4, 9).fillRect(29, 24, 3.4, 9); // 4 long legs
				g.fillEllipse(20, 19, 26, 14);                      // deep body
				g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 17, 7, 9); // pale rump patch
				g.fillStyle(BODY, 1);
				g.fillTriangle(28, 20, 33, 20, 31, 9);             // raised neck
				g.fillCircle(32, 9, 4.4);                           // head
				g.fillEllipse(34, 11, 6, 3.4);                      // muzzle
				g.fillEllipse(28, 5, 3.4, 7).fillEllipse(33, 4, 3.4, 7); // big mule ears
				// antlers (bulls) — a branched beam sweeping up and back, in-frame
				if (big) {
					g.lineStyle(2.2, C('#9a7a52'), 1);
					g.lineBetween(31, 6, 29, 0).lineBetween(29, 0, 26, 1).lineBetween(29, 0, 30, 2); // left beam + tines
					g.lineBetween(34, 6, 36, 0).lineBetween(36, 0, 39, 1).lineBetween(36, 0, 35, 2); // right beam + tines
				}
				g.fillStyle(NOSE, 1).fillCircle(36, 11, 1);
				g.fillStyle(DK, 1).fillCircle(33, 8, 1.2);
			}) };
		}
		// --- Goat / bighorn: blocky body, horns, (goat) beard ---
		if (t(/goat|bighorn|ram|sheep/)) {
			const bighorn = t(/bighorn|ram|sheep/);
			return { w: 36, h: 30, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillRect(11, 21, 3.6, 9).fillRect(17, 21, 3.6, 9).fillRect(23, 21, 3.6, 9).fillRect(28, 21, 3.6, 9); // legs
				g.fillEllipse(20, 16, 26, 15);                      // stocky body
				g.fillCircle(30, 12, 5);                            // head
				g.fillEllipse(33, 13, 5, 4);                        // muzzle
				g.fillTriangle(26, 9, 28, 13, 30, 9);              // ear
				if (bighorn) { g.fillStyle(C('#b79466'), 1); g.fillEllipse(27, 9, 8, 9); g.fillEllipse(26, 13, 6, 8); g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 15, 6, 8); } // curl horn + white rump
				else { g.fillStyle(C('#efe9dc'), 1).fillTriangle(28, 8, 27, 0, 30, 8).fillTriangle(32, 8, 33, 0, 30, 8); g.fillTriangle(29, 15, 33, 15, 31, 22); } // straight horns + beard
				g.fillStyle(NOSE, 1).fillCircle(34, 13, 1);
				g.fillStyle(DK, 1).fillCircle(31, 11, 1.2);
			}) };
		}
		// --- Hares & jackrabbits: big body, very long ears, long hind legs ---
		if (t(/hare|jackrabbit|rabbit|cottontail/)) {
			return { w: 30, h: 34, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(6, 24, 12, 7);                        // big haunch
				g.fillRect(4, 27, 3, 5).fillRect(18, 27, 3, 5);     // feet
				g.fillEllipse(16, 20, 20, 15);                      // upright body
				g.fillCircle(21, 11, 5);                            // head
				g.fillEllipse(19, 7, 4, 13).fillEllipse(24, 7, 4, 13); // very long ears
				g.fillStyle(0xffffff, 1).fillCircle(4, 22, 3);      // cotton tail
				g.fillStyle(C('#f6efe2'), 0.5).fillEllipse(19, 6, 2, 10).fillEllipse(24, 6, 2, 10); // ear inner
				g.fillStyle(DK, 1).fillCircle(23, 10, 1.3);
				g.fillStyle(NOSE, 1).fillCircle(25, 13, 0.9);
			}) };
		}
		// --- Pika: round, earthy, tiny round ears, NO tail ---
		if (t(/pika/)) {
			return { w: 26, h: 24, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillRect(7, 19, 3.6, 4).fillRect(12, 20, 3.6, 4).fillRect(18, 19, 3.6, 4); // short legs
				g.fillEllipse(13, 14, 22, 15);                      // round egg body
				g.fillCircle(19, 9, 5.4);                           // head blends in
				g.fillCircle(16, 3.5, 2.8).fillCircle(22, 3.5, 2.8); // big round ears
				g.fillStyle(C('#f0e6d4'), 0.55).fillEllipse(19, 11, 7, 5); // pale muzzle
				g.fillStyle(DK, 1).fillCircle(21, 8, 1.3);
				g.fillStyle(NOSE, 1).fillCircle(23, 10, 0.9);
			}) };
		}
		// --- Marmot / woodchuck / prairie dog: chunky, sitting upright ---
		if (t(/marmot|woodchuck|groundhog|prairie-dog/)) {
			return { w: 30, h: 30, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(6, 24, 9, 6);                         // stubby tail/haunch
				g.fillEllipse(15, 19, 22, 20);                      // pear body, wide at base
				g.fillCircle(17, 8, 6);                             // head on top
				g.fillCircle(13, 3, 2.2).fillCircle(21, 3, 2.2);   // small rounded ears
				g.fillRect(11, 20, 3, 7).fillRect(18, 20, 3, 7);   // hind feet
				g.fillEllipse(15, 15, 5, 6);                        // little forepaws at chest
				g.fillStyle(C('#e0b866'), 0.4).fillEllipse(15, 22, 12, 10); // yellow belly
				g.fillStyle(DK, 1).fillCircle(15, 7, 1.2).fillCircle(20, 7, 1.2);
				g.fillStyle(NOSE, 1).fillCircle(17.5, 10, 0.9);
			}) };
		}
		// --- Beaver: bulky body, small head, big scaly paddle tail ---
		if (t(/beaver/)) {
			return { w: 40, h: 26, draw: draw((g) => {
				g.fillStyle(C('#5a4632'), 1).fillEllipse(6, 18, 12, 9); // flat paddle tail
				g.lineStyle(0.8, 0x000000, 0.3); g.lineBetween(3, 15, 9, 21).lineBetween(3, 18, 9, 18).lineBetween(3, 21, 9, 15); // cross-hatch
				g.fillStyle(BODY, 1);
				g.fillRect(15, 20, 3.6, 5).fillRect(22, 20, 3.6, 5).fillRect(29, 20, 3.6, 5); // legs
				g.fillEllipse(22, 15, 28, 16);                      // bulky body
				g.fillCircle(33, 12, 5.4);                          // small head
				g.fillCircle(31, 6.5, 2).fillCircle(36, 6.5, 2);   // small round ears
				g.fillStyle(C('#c8922f'), 1).fillRect(35, 14, 2.2, 3); // orange incisors
				g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
				g.fillStyle(DK, 1).fillCircle(34, 11, 1.2);
			}) };
		}
		// --- Muskrat: rat-like swimmer, long thin tail ---
		if (t(/muskrat/)) {
			return { w: 38, h: 20, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(18, 12, 28, 12);                      // low body
				g.lineStyle(2, C('#4a3a2c'), 1).lineBetween(6, 13, 1, 18); // thin tail
				g.fillStyle(BODY, 1).fillCircle(30, 9, 4.6);        // head
				g.fillCircle(28, 5, 1.6).fillCircle(33, 5, 1.6);   // small ears
				g.fillRect(13, 17, 3, 3).fillRect(20, 17, 3, 3).fillRect(26, 17, 3, 3); // legs
				g.fillStyle(NOSE, 1).fillCircle(34, 10, 1);
				g.fillStyle(DK, 1).fillCircle(31, 8, 1.1);
			}) };
		}
		// --- Bipedal desert rodents: huge hind legs, tiny arms, tufted tail ---
		if (t(/kangaroo-rat|kangaroo-mouse|jerboa/)) {
			return { w: 30, h: 30, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.lineStyle(2, BODY, 1).lineBetween(6, 20, 3, 26); // long tail
				g.fillStyle(0x2e2620, 1).fillCircle(3, 26, 2.2);   // dark tail tuft
				g.fillStyle(BODY, 1);
				g.fillEllipse(13, 20, 12, 14);                      // big hind haunch
				g.fillRect(10, 25, 3.4, 5).fillRect(15, 26, 3.2, 4); // two hind feet
				g.fillEllipse(19, 13, 13, 12);                      // upright body
				g.fillCircle(23, 7, 5);                             // big head
				g.fillEllipse(21, 3.2, 3, 6).fillEllipse(25, 3.2, 3, 6); // tall ears
				g.fillEllipse(20, 14, 3.5, 4);                      // tiny forepaw
				g.fillStyle(DK, 1).fillCircle(25, 6, 1.6);         // big eye
				g.fillStyle(NOSE, 1).fillCircle(27, 8, 0.9);
			}) };
		}
		// --- Flying squirrel: stretched gliding membrane, flat tail, big eyes ---
		if (t(/flying-squirrel/)) {
			return { w: 34, h: 24, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(8, 14, 12, 7);                        // flat paddle tail
				g.fillRect(12, 18, 3.2, 5).fillRect(21, 18, 3.2, 5); // legs
				g.fillTriangle(10, 8, 26, 8, 24, 18).fillTriangle(10, 8, 10, 18, 24, 18); // patagium
				g.fillEllipse(18, 13, 18, 12);                      // body
				g.fillCircle(26, 9, 5);                             // head
				g.fillCircle(24, 4.5, 2).fillCircle(29, 4.5, 2);   // round ears
				g.fillStyle(C('#f2ece0'), 0.4).fillEllipse(18, 16, 14, 5); // pale belly
				g.fillStyle(DK, 1).fillCircle(28, 8, 1.8);         // big eye
				g.fillStyle(NOSE, 1).fillCircle(30, 10, 0.9);
			}) };
		}
		// --- Chipmunks & striped ground squirrels: upright, striped, tail up ---
		if (t(/chipmunk|antelope-squirrel|ground-squirrel/)) {
			const striped = t(/chipmunk|antelope/);
			return { w: 30, h: 28, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(7, 12, 10, 20);                       // tail arched up alongside
				g.fillRect(12, 23, 3.4, 4).fillRect(18, 23, 3.4, 4); // hind feet
				g.fillEllipse(16, 18, 15, 15);                      // upright body
				g.fillCircle(20, 9, 5);                             // head
				g.fillCircle(18, 4, 2.2).fillCircle(23, 4, 2.2);   // round ears
				g.fillEllipse(17, 18, 4, 5);                        // little forepaws
				if (striped) { g.fillStyle(C('#3a2c1e'), 1).fillRect(11, 13, 11, 1.3).fillRect(11, 17, 11, 1.3); g.fillStyle(C('#f4efe6'), 1).fillRect(11, 15, 11, 1.2); }
				g.fillStyle(DK, 1).fillCircle(22, 8, 1.3);
				g.fillStyle(NOSE, 1).fillCircle(24, 10, 0.8);
			}) };
		}
		// --- Voles / mice / rats: compact, blunt face, small ears, thin tail ---
		if (t(/vole|mouse|rat|shrew|mole|gopher|lemming/)) {
			return { w: 32, h: 19, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.lineStyle(1.6, C('#caa98a'), 1).lineBetween(6, 12, 1, 15); // thin tail
				g.fillStyle(BODY, 1);
				g.fillRect(10, 14, 2.6, 4).fillRect(17, 14, 2.6, 4).fillRect(23, 14, 2.6, 4); // little legs
				g.fillEllipse(15, 11, 22, 11);                     // plump body
				g.fillCircle(25, 9, 4.6);                          // head, blunt
				g.fillCircle(23, 4.5, 2.4).fillCircle(28, 5, 2.2); // rounded ears
				g.fillStyle(DK, 1).fillCircle(27, 8, 1.2);
				g.fillStyle(NOSE, 1).fillCircle(29, 10, 0.9);
			}) };
		}
		// --- Cats (bobcat/lynx): compact cat, tufted ears, spots, bobbed tail ---
		if (t(/bobcat|lynx|cat|cougar|puma|mountain-lion/)) {
			const bob = t(/bobcat|lynx/);
			return { w: 38, h: 30, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				if (bob) g.fillEllipse(6, 15, 7, 5);               // short bobbed tail
				else g.fillEllipse(6, 17, 13, 6);                  // long tail
				g.fillRect(12, 22, 3.6, 7).fillRect(18, 22, 3.6, 7).fillRect(25, 22, 3.6, 7).fillRect(30, 22, 3.6, 7); // legs
				g.fillEllipse(20, 17, 26, 13);                     // lithe body
				g.fillCircle(31, 11, 5.4);                         // round head
				g.fillTriangle(26, 8, 29, 2, 32, 8).fillTriangle(31, 8, 34, 2, 37, 8); // upright pointed ears
				if (bob) { g.fillStyle(0x2a2620, 1).fillTriangle(28.4, 3, 29, 0.4, 29.6, 3).fillTriangle(33.4, 3, 34, 0.4, 34.6, 3); g.fillStyle(BODY, 1); } // dark ear tufts
				g.fillStyle(0x000000, 0.2); for (const [x, y] of [[15, 14], [21, 13], [26, 15], [18, 18], [24, 18]] as const) g.fillCircle(x, y, 1.2); // spots
				g.fillStyle(C('#f2ece0'), 1).fillEllipse(31, 13, 7, 4); // muzzle
				g.fillStyle(NOSE, 1).fillEllipse(33, 12, 1.8, 1.3);
				g.fillStyle(DK, 1).fillCircle(29, 10, 1.2).fillCircle(33, 10, 1.2);
			}) };
		}
		// --- Wild canids (coyote/kit fox/wolf): long legs, snout, bushy tail ---
		if (t(/coyote|wolf|kit-fox|fox|jackal/)) {
			const kit = t(/kit-fox/);
			return { w: 40, h: 30, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(8, 18, 14, 9);                       // bushy tail
				g.fillRect(13, 22, 3.4, 7).fillRect(19, 22, 3.4, 7).fillRect(26, 22, 3.4, 7).fillRect(31, 22, 3.4, 7); // long legs
				g.fillEllipse(21, 16, 26, 13);                     // lean body
				g.fillTriangle(30, 17, 34, 17, 33, 8);            // neck
				g.fillCircle(33, 8, 4.6);                          // head
				g.fillTriangle(35, 8, 40, 11, 35, 12);           // pointed snout
				if (kit) g.fillTriangle(29, 7, 30, 0.5, 33, 6).fillTriangle(34, 6, 37, 0.5, 38, 7); // kit fox = huge ears
				else g.fillTriangle(30, 6, 31, 2, 33, 6).fillTriangle(34, 6, 36, 2, 37, 6);
				g.fillStyle(0xffffff, 1).fillCircle(4, 17, 3);     // tail tip
				g.fillStyle(NOSE, 1).fillCircle(39, 11, 1);
				g.fillStyle(DK, 1).fillCircle(34, 7, 1.2);
			}) };
		}

		// --- Generic quadruped fallback (small unhandled mammals) ---
		return { w: 36, h: 28, draw: draw((g) => {
			g.fillStyle(BODY, 1);
			if (t(/squirrel/)) g.fillEllipse(6, 13, 11, 15);       // bushy squirrel tail
			else g.fillEllipse(7, 17, 9, 5);
			g.fillRect(12, 23, 3.6, 5.5).fillRect(17, 23, 3.6, 5.5).fillRect(23, 23, 3.6, 5.5).fillRect(28, 23, 3.6, 5.5); // four legs
			g.fillEllipse(19, 17, 23, 14);                         // body + head
			g.fillCircle(28, 13, 6.2);
			g.fillCircle(25, 7, 2.6).fillCircle(31, 7, 2.6);      // round ears
			g.fillStyle(NOSE, 1).fillCircle(33, 13, 1);
			g.fillStyle(DK, 1).fillCircle(29, 12, 1.2);
		}) };
	}

	if (kind === 'bird') {
		if (t(/heron/)) {
			return { w: 34, h: 28, draw: draw((g) => {
				// Shorter, contained legs so journal/card thumbnails do not crop the bird.
				g.lineStyle(1.3, C('#c9a35c'), 1);
				g.lineBetween(12, 18, 12, 25)
					.lineBetween(17, 18, 16, 25)
					.lineBetween(12, 25, 9, 26)
					.lineBetween(16, 25, 19, 26);

				// Body, wing, neck, and head.
				g.fillStyle(BODY, 1).fillEllipse(14, 13, 18, 11);
				g.fillStyle(0x000000, 0.12).fillEllipse(13, 14, 10, 6);
				g.fillStyle(BODY, 1);
				g.fillTriangle(5, 12, 10, 9, 10, 16);
				g.fillRect(20, 5, 3, 10);
				g.fillCircle(22, 5, 4.2);

				// Beak + eye.
				g.fillStyle(C('#e0a93f'), 1).fillTriangle(25, 4, 33, 5.5, 25, 7);
				g.fillStyle(DK, 1).fillCircle(23, 4.5, 1);
			}) };
		}

		// Waterfowl: a low, boat-shaped body that sits on the water, rounded head,
		// and a broad flat bill — reads clearly as a duck/goose vs a songbird.
		if (t(/duck|mallard|merganser|teal|widgeon|wigeon|goose|brant|gadwall|pintail|shoveler/)) {
			return { w: 33, h: 22, draw: draw((g) => {
				const goose = t(/goose|brant/);
				g.fillStyle(BODY, 1);
				g.fillEllipse(13, 15, 22, 11);                 // boat body
				g.fillTriangle(2, 12, 8, 16, 4, 17);           // upswept tail
				if (goose) { g.fillRect(20, 4, 3.4, 9); g.fillCircle(22, 4, 3.8); }  // long neck + head
				else g.fillCircle(23, 9, 5);                   // tucked head
				const hx = goose ? 22 : 25, hy = goose ? 4 : 9;
				g.fillStyle(C('#e0a93f'), 1).fillEllipse(hx + 4, hy + 0.5, 6, 3.2); // broad flat bill
				g.fillStyle(0xffffff, 0.5).fillEllipse(11, 13, 12, 4); // wing highlight
				g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
			}) };
		}
		// Ground cuckoo (roadrunner): long body, very long tail, shaggy crest,
		// long striding legs, straight bill.
		if (t(/roadrunner/)) {
			return { w: 34, h: 26, draw: draw((g) => {
				g.lineStyle(1.5, C('#8a6a44'), 1).lineBetween(12, 16, 11, 24).lineBetween(16, 16, 18, 24); // legs
				g.fillStyle(BODY, 1);
				g.fillEllipse(13, 12, 16, 9);                  // body
				g.fillTriangle(1, 4, 8, 12, 6, 16);            // long cocked tail
				g.fillRect(18, 6, 3, 6); g.fillCircle(21, 6, 4);// neck + head
				g.fillTriangle(19, 3, 23, 0, 24, 4);           // shaggy crest
				g.fillStyle(C('#e0a93f'), 1).fillTriangle(24, 5, 31, 6, 24, 7.5); // long straight bill
				g.fillStyle(DK, 1).fillCircle(22, 5, 1.1);
			}) };
		}
		// Small shorebird (plover / sandpiper / sanderling / turnstone): compact
		// upright body, two thin legs, and a short-to-medium straight probing bill.
		if (t(/plover|sanderling|sandpiper|turnstone|shorebird|killdeer|dunlin|dowitcher|godwit|yellowlegs/)) {
			return { w: 28, h: 26, draw: draw((g) => {
				g.lineStyle(1.3, C('#c9a35c'), 1).lineBetween(11, 16, 10, 24).lineBetween(15, 16, 16, 24); // legs
				g.fillStyle(BODY, 1);
				g.fillEllipse(12, 12, 15, 11);                 // plump body
				g.fillCircle(18, 6, 4);                        // head high on body
				g.fillTriangle(2, 9, 7, 12, 3, 14);            // short tail
				g.fillStyle(DK, 1);
				g.fillTriangle(21, 5.5, 27, 6, 21, 7);         // straight bill
				g.fillCircle(19, 5, 1.1);
			}) };
		}
		// Seabird (gull / tern / cormorant): sleek elongated body; gulls get a
		// slightly hooked bill, cormorants a long neck + hook.
		if (t(/gull|tern|cormorant|guillemot|kittiwake/)) {
			const corm = t(/cormorant|guillemot/);
			return { w: 32, h: 24, draw: draw((g) => {
				g.fillStyle(BODY, 1);
				g.fillEllipse(13, 14, 20, 10);                 // sleek body
				g.fillTriangle(2, 11, 8, 15, 3, 16);           // tail
				if (corm) { g.fillRect(19, 5, 3, 8); g.fillCircle(21, 5, 4); }
				else g.fillCircle(21, 9, 4.6);
				const hx = corm ? 21 : 22, hy = corm ? 5 : 9;
				g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 9, hy, hx + 3, hy + 1.5); // hooked-ish bill
				g.lineStyle(1.4, C('#e0a93f'), 1).lineBetween(hx + 9, hy, hx + 8, hy + 1.5);
				g.fillStyle(0x000000, 0.14).fillEllipse(9, 11, 13, 4); // grey wing
				g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
			}) };
		}
		// Eagle — the apex raptor. A big, upright, broad-chested hunter: heavy
		// hooked bill, the golden eagle's signature tawny nape, a fierce amber eye
		// under a heavy brow, a folded wing with drooping primaries, and gripping
		// yellow talons. Reads as a predator, not a generic songbird.
		if (t(/eagle/)) {
			// Same clean, flat silhouette as the other birds — but unmistakably a
			// raptor: a hooked bill, the golden eagle's tawny nape, a fierce amber
			// eye, and gripping talons. No muddy overlays.
			return { w: 30, h: 26, draw: draw((g) => {
				// short perched legs + talons
				g.lineStyle(1.6, C('#e0a93f'), 1).lineBetween(12, 17, 11, 23).lineBetween(16, 17, 17, 23);
				g.fillStyle(C('#e0a93f'), 1).fillTriangle(8, 23, 13, 22, 10, 25).fillTriangle(15, 23, 20, 22, 17, 25);
				// simple tail + plump body + rounded head (matches the other birds)
				g.fillStyle(BODY, 1);
				g.fillTriangle(2, 8, 9, 13, 3, 15);
				g.fillEllipse(13, 13, 19, 15);
				g.fillCircle(20, 7, 5.4);
				// one restrained folded-wing accent, same touch as the gull/duck
				g.fillStyle(0x000000, 0.12).fillEllipse(11, 13, 13, 6);
				// the golden eagle's signature tawny nape, a clean patch on the crown
				g.fillStyle(C('#c79a3f'), 1).fillEllipse(17, 5, 6, 5);
				// heavy hooked bill: yellow, tipped with a small dark down-curved hook
				g.fillStyle(C('#e0a93f'), 1).fillTriangle(23, 5.5, 29, 7, 23, 9);
				g.fillStyle(C('#33302b'), 1).fillTriangle(27, 6.4, 29.6, 8, 27, 9.2);
				// fierce amber eye
				g.fillStyle(C('#f2c033'), 1).fillCircle(21, 6, 1.7);
				g.fillStyle(DK, 1).fillCircle(21.3, 6, 1);
			}) };
		}

		const wader = t(/heron|crane|egret|bittern|stilt|flamingo|sandhill/);
		const raptor = t(/hawk|owl|falcon|kite|harrier|osprey|goshawk|kestrel|merlin/);
		const finch = t(/finch|grosbeak|goldfinch|sparrow|bunting|crossbill|junco|towhee/);
		const chunky = t(/ptarmigan|quail|grouse|partridge/);
		// Long-billed birds need a wider canvas so the bill tip isn't clipped;
		// waders need a taller one so the raised neck/head clears the top edge.
		const longBill = t(/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|pelican|oystercatcher|hummingbird/);
		const W = longBill ? 32 : 28;
		const H = wader ? 34 : 24;
		return { w: W, h: H, draw: draw((g) => {
			const baseY = wader ? 16 : 13;
			g.fillStyle(BODY, 1);
			// legs
			if (wader) { g.lineStyle(1.4, C('#c9a35c'), 1); g.lineBetween(12, baseY + 8, 11, H - 1).lineBetween(16, baseY + 8, 17, H - 1); g.fillStyle(BODY, 1); }
			// body + head — plump, rounded body for chunky ground birds (ptarmigan/quail)
			if (chunky) g.fillEllipse(12, baseY, 20, 15).fillCircle(20, baseY - 7, 4.6);
			else g.fillEllipse(13, baseY, 17, 12).fillCircle(20, baseY - 6, 4.6);
			if (wader) { g.fillRect(18, baseY - 9, 3, 8); g.fillCircle(20, baseY - 10, 4); } // long neck + head
			// tail
			if (t(/wren/)) g.fillTriangle(3, baseY - 5, 7, baseY, 4, baseY - 1);
			else g.fillTriangle(2, baseY - 3, 8, baseY, 3, baseY + 4);
			// crest
			if (t(/quail|cardinal|jay|waxwing|nutcracker|titmouse|chickadee|kingfisher|phainopepla/)) { g.fillTriangle(18, baseY - 9, 21, baseY - 13, 24, baseY - 8); }
			// beak
			const hx = 20, hy = wader ? baseY - 10 : baseY - 6;
			if (t(/hummingbird/)) { g.fillStyle(DK, 1); g.lineStyle(1.2, DK, 1).lineBetween(hx + 3, hy, hx + 11, hy - 1); }
			else if (t(/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|pelican|oystercatcher/)) { g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1.5, hx + 11, hy, hx + 3, hy + 1.5); }
			else if (raptor) { g.fillStyle(C('#e6b84a'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy + 0.5, hx + 3, hy + 2.5); g.fillStyle(C('#33302b'), 1).fillTriangle(hx + 6, hy - 0.2, hx + 9, hy + 1, hx + 5.5, hy + 2); }
			// finches/sparrows/grosbeaks: short, deep conical seed-cracking bill
			else if (finch) { g.fillStyle(C('#d8b25a'), 1).fillTriangle(hx + 3, hy - 2, hx + 7, hy, hx + 3, hy + 2); }
			else { g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy, hx + 3, hy + 1.5); }
			// pelican: a big orange gular pouch slung under the long bill
			if (t(/pelican/)) { g.fillStyle(C('#e6a63c'), 1).fillEllipse(hx + 6, hy + 4, 11, 8); g.fillStyle(C('#f0c060'), 1).fillEllipse(hx + 6, hy + 3, 8, 5); }
			// owl big eyes / ear tufts
			if (t(/owl/)) { g.fillStyle(C('#f4e3b1'), 1).fillCircle(18, hy, 2).fillCircle(22, hy, 2); g.fillStyle(DK, 1).fillCircle(18, hy, 1).fillCircle(22, hy, 1); g.fillStyle(BODY, 1).fillTriangle(16, hy - 4, 18, hy - 7, 19, hy - 3).fillTriangle(21, hy - 3, 22, hy - 7, 24, hy - 4); }
			// other raptors: a fierce amber eye under a heavy brow
			else if (raptor) { g.lineStyle(1.4, C('#5a4a30'), 1).lineBetween(18, hy - 1.5, 23, hy - 0.5); g.fillStyle(C('#f2c033'), 1).fillCircle(21, hy, 1.8); g.fillStyle(DK, 1).fillCircle(21.3, hy, 1); }
			else g.fillStyle(DK, 1).fillCircle(21, hy, 1.1);
			// woodpecker: a white cheek patch under a red cap (classic trunk-clinger)
			if (t(/woodpecker|sapsucker/)) {
				g.fillStyle(0xffffff, 0.82).fillEllipse(19, hy + 1.5, 6, 4.5);
				g.fillStyle(DK, 1).fillCircle(21, hy, 1.1);
				g.fillStyle(C('#c0392b'), 1).fillCircle(19, hy - 4, 2.6);
			}
			// hummingbird: an iridescent gorget at the throat + a swept blur-wing
			if (t(/hummingbird/)) {
				g.fillStyle(0x000000, 0.14).fillTriangle(7, baseY - 3, 15, baseY - 1, 9, baseY + 3);
				g.fillStyle(C('#c0396b'), 1).fillEllipse(19, baseY - 3.5, 5, 4);
				g.fillStyle(DK, 1).fillCircle(20, baseY - 6, 1.05);
			}
		}) };
	}

	if (kind === 'insect') {
		return { w: 24, h: 20, draw: draw((g) => {
			if (t(/butterfly|monarch|admiral|swallowtail|fritillary|painted|lady$|painted-lady/)) {
				g.fillStyle(BODY, 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12).fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
				g.fillStyle(0x000000, 0.18).fillEllipse(7, 8, 5, 6).fillEllipse(17, 8, 5, 6);
				g.fillStyle(DK, 1).fillEllipse(12, 11, 2.4, 12);
				g.lineStyle(1, DK, 1).lineBetween(12, 4, 9, 0).lineBetween(12, 4, 15, 0);
				return;
			}
			if (t(/dragonfly|damselfly/)) {
				g.fillStyle(BODY, 1).fillRect(3, 9, 18, 2.4).fillCircle(20, 10, 3);
				g.fillStyle(0xffffff, 0.6).fillEllipse(11, 6, 12, 4).fillEllipse(11, 14, 12, 4);
				g.fillStyle(DK, 1).fillCircle(21, 9, 1);
				return;
			}
			if (t(/bee|bumblebee/)) {
				g.fillStyle(BODY, 1).fillEllipse(11, 11, 14, 10).fillCircle(18, 9, 3.4);
				g.fillStyle(0x2e2620, 1).fillRect(7, 7, 2.6, 8).fillRect(12, 7, 2.6, 8); // stripes
				g.fillStyle(0xffffff, 0.7).fillEllipse(9, 4, 8, 5);
				g.fillStyle(DK, 1).fillCircle(19, 8, 1);
				return;
			}
			if (t(/mantis/)) {
				g.fillStyle(BODY, 1).fillEllipse(12, 13, 16, 6).fillTriangle(20, 9, 24, 7, 22, 13);
				g.lineStyle(2, BODY, 1).lineBetween(19, 12, 23, 16).lineBetween(23, 16, 18, 17);
				g.fillStyle(DK, 1).fillCircle(23, 8, 1);
				return;
			}
			// grasshopper / beetle / strider — generic 6-legged
			g.fillStyle(BODY, 1).fillEllipse(11, 11, 15, 8).fillCircle(18, 9, 3);
			if (t(/beetle/)) { g.fillStyle(0x000000, 0.18).fillEllipse(10, 11, 12, 7); g.lineStyle(1, DK, 1).lineBetween(11, 6, 11, 16); }
			g.lineStyle(1, DK, 1);
			for (const lx of [6, 10, 14]) g.lineBetween(lx, 14, lx - 2, 18).lineBetween(lx, 8, lx - 2, 4);
			if (t(/grasshopper|cricket/)) g.lineStyle(2.2, BODY, 1).lineBetween(8, 13, 4, 18);
			g.fillStyle(DK, 1).fillCircle(19, 8, 1);
		}) };
	}

	if (kind === 'reptile') {
		if (t(/turtle|tortoise/)) {
			return { w: 30, h: 20, draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(15, 12, 22, 13);
				g.fillStyle(0x000000, 0.16).fillEllipse(15, 14, 22, 7);
				g.lineStyle(1, 0x000000, 0.25).strokeCircle(15, 11, 5);
				g.fillStyle(BODY, 1).fillCircle(26, 12, 3.4).fillRect(7, 16, 3, 4).fillRect(20, 16, 3, 4); // head + legs
				g.fillStyle(DK, 1).fillCircle(27, 11, 1);
			}) };
		}
		// lizard / gecko / iguana
		return { w: 34, h: 18, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(14, 10, 20, 8).fillCircle(25, 9, 4);
			g.fillEllipse(6, 11, 12, 4); // tail
			g.fillRect(9, 13, 2.4, 4).fillRect(18, 13, 2.4, 4); // legs
			if (t(/horned|collared/)) { g.fillStyle(BODY, 1).fillTriangle(27, 6, 30, 3, 30, 9); } // head spikes/frill
			if (t(/iguana|chuckwalla/)) { g.fillStyle(0x000000, 0.15); for (const sx of [10, 14, 18, 22]) g.fillTriangle(sx, 6, sx + 1.5, 3, sx + 3, 6); } // dorsal crest
			g.fillStyle(DK, 1).fillCircle(26, 8, 1);
		}) };
	}

	if (kind === 'amphibian') {
		if (t(/frog|toad/)) {
			return { w: 26, h: 18, draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(13, 12, 19, 11).fillCircle(7, 7, 3).fillCircle(19, 7, 3); // body + eye bulges
				g.fillStyle(DK, 1).fillCircle(7, 7, 1.2).fillCircle(19, 7, 1.2);
				g.fillStyle(BODY, 1).fillTriangle(3, 16, 9, 14, 6, 18).fillTriangle(23, 16, 17, 14, 20, 18); // legs
				if (t(/toad/)) { g.fillStyle(0x000000, 0.14).fillCircle(9, 11, 1.3).fillCircle(15, 13, 1.3).fillCircle(17, 10, 1.3); } // warts
			}) };
		}
		// salamander / newt
		return { w: 30, h: 16, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(14, 9, 18, 7).fillCircle(23, 8, 3.4).fillEllipse(6, 10, 10, 3.4);
			g.fillRect(9, 11, 2, 3).fillRect(17, 11, 2, 3);
			g.fillStyle(C('#e8954f'), 1).fillCircle(11, 8, 1.3).fillCircle(16, 9, 1.3).fillCircle(20, 8, 1.1); // spots
			g.fillStyle(DK, 1).fillCircle(24, 7, 1);
		}) };
	}

	if (kind === 'fish') {
		return { w: 28, h: 16, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(14, 8, 18, 10).fillTriangle(2, 3, 7, 8, 2, 13);
			g.fillStyle(0xffffff, 0.6).fillTriangle(13, 1, 17, 5, 13, 5); // dorsal fin
			g.fillStyle(DK, 1).fillCircle(20, 7, 1.2);
		}) };
	}

	// invertebrate — crabs, stars, anemones, slugs, shellfish, spiders, scorpions
	if (t(/crab/)) {
		return { w: 26, h: 22, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(13, 13, 18, 11);
			g.lineStyle(1.4, BODY, 1);
			for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.lineBetween(13 + s * 6, 13 + i * 2, 13 + s * 11, 11 + i * 3);
			g.fillStyle(BODY, 1).fillCircle(4, 9, 3).fillCircle(22, 9, 3); // claws
			g.fillStyle(DK, 1).fillCircle(10, 9, 1).fillCircle(16, 9, 1);
		}) };
	}
	if (t(/star/)) {
		return { w: 24, h: 24, draw: draw((g) => {
			g.fillStyle(BODY, 1);
			const cx = 12, cy = 12, R = 11;
			for (let i = 0; i < 5; i++) {
				const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
				const a0 = ((i - 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
				const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
				g.fillTriangle(cx, cy, cx + Math.cos(a0) * R * 0.55, cy + Math.sin(a0) * R * 0.55, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
				g.fillTriangle(cx, cy, cx + Math.cos(a2) * R * 0.55, cy + Math.sin(a2) * R * 0.55, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
			}
			g.fillStyle(0x000000, 0.12).fillCircle(cx, cy, 3.5);
		}) };
	}
	if (t(/anemone/)) {
		return { w: 24, h: 22, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(12, 17, 14, 9);
			g.lineStyle(1.6, BODY, 1);
			for (let i = 0; i < 9; i++) { const x = 5 + i * 1.8; g.lineBetween(x, 14, x - 1 + (i % 2) * 2, 3 + (i % 3)); }
		}) };
	}
	if (t(/scorpion/)) {
		return { w: 28, h: 20, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(12, 13, 14, 8).fillCircle(5, 9, 2.6).fillCircle(19, 9, 2.6); // body + pincers
			g.lineStyle(1.8, BODY, 1).lineBetween(18, 11, 23, 6).lineBetween(23, 6, 24, 12); // curled tail
			g.fillStyle(BODY, 1).fillCircle(24, 12, 1.8);
			g.lineStyle(1, DK, 1); for (const lx of [9, 13, 17]) g.lineBetween(lx, 16, lx - 2, 19);
		}) };
	}
	if (t(/spider|tarantula/)) {
		return { w: 24, h: 22, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillCircle(12, 12, 6).fillCircle(12, 6, 3);
			g.lineStyle(1.6, BODY, 1);
			for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.lineBetween(12, 11, 12 + s * (8 + i), 6 + i * 4);
			g.fillStyle(DK, 1).fillCircle(11, 5, 0.9).fillCircle(13, 5, 0.9);
		}) };
	}
	if (t(/slug|snail/)) {
		return { w: 26, h: 16, draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(13, 11, 22, 8);
			if (t(/snail/)) g.fillStyle(0x000000, 0.16).fillCircle(9, 9, 5);
			g.lineStyle(1.4, BODY, 1).lineBetween(21, 8, 23, 3).lineBetween(23, 8, 25, 4); // eye stalks
			g.fillStyle(DK, 1).fillCircle(23, 3, 0.8).fillCircle(25, 4, 0.8);
		}) };
	}
	// mussel / clam / oyster — bivalve shell
	return { w: 22, h: 18, draw: draw((g) => {
		g.fillStyle(BODY, 1).fillEllipse(11, 11, 18, 12);
		g.lineStyle(1, 0x000000, 0.25); for (let i = 1; i < 4; i++) g.strokeEllipse(11, 11, 18 - i * 4, 12 - i * 3);
		g.fillStyle(0x000000, 0.12).fillTriangle(11, 5, 9, 11, 13, 11);
	}) };
}

/**
 * Minimal SVG-emitting stand-in for Phaser.Graphics. Implements the same draw
 * primitives the sprite functions use, so the exact same draw code renders a
 * faithful thumbnail in the DOM (no duplicated art). `tint` recolours the
 * white (0xffffff) base of generic sprites; `override` forces every colour
 * (used for undiscovered silhouettes).
 */
class SvgGraphics {
	parts: string[] = [];
	private fill = '#000000';
	private fillA = 1;
	private stroke = '#000000';
	private strokeA = 1;
	private sw = 1;
	constructor(private tint: string | null, private override: string | null = null) {}
	private col(c: number) {
		if (this.override) return this.override;
		if (this.tint && c === 0xffffff) return this.tint;
		return hexOf(c);
	}
	fillStyle(c: number, a = 1) { this.fill = this.col(c); this.fillA = a; return this; }
	lineStyle(w: number, c: number, a = 1) { this.sw = w; this.stroke = this.col(c); this.strokeA = a; return this; }
	fillEllipse(x: number, y: number, w: number, h: number) { this.parts.push(`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`); return this; }
	fillCircle(x: number, y: number, r: number) { this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`); return this; }
	fillRect(x: number, y: number, w: number, h: number) { this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`); return this; }
	fillRoundedRect(x: number, y: number, w: number, h: number, r: number) { this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`); return this; }
	fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) { this.parts.push(`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`); return this; }
	lineBetween(x1: number, y1: number, x2: number, y2: number) { this.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}" stroke-linecap="round"/>`); return this; }
	strokeEllipse(x: number, y: number, w: number, h: number) { this.parts.push(`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`); return this; }
	strokeCircle(x: number, y: number, r: number) { this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`); return this; }
	strokeRoundedRect(x: number, y: number, w: number, h: number, r: number) { this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`); return this; }
	toSvg(w: number, h: number) {
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${this.parts.join('')}</svg>`;
	}
}

/**
 * Render an animal's sprite as an SVG data URI for use in the DOM (field
 * journal). `silhouette` draws it as a single dark shape for animals that have
 * not returned yet. Featured animals use their hand-drawn sprite; everyone else
 * gets the same trait-built sprite the world uses.
 */
export function animalSpriteDataUri(animalId: string, kind: string, opts: { silhouette?: boolean } = {}): string {
	const override = opts.silhouette ? '#4a4636' : null;
	const toUri = (g: SvgGraphics, w: number, h: number) => 'data:image/svg+xml;base64,' + btoa(g.toSvg(w, h));

	if (FEATURED_TEXTURE[animalId]) {
		const name = FEATURED_TEXTURE[animalId].replace('ani-', '');
		const shape = ANIMAL_SPRITES[name] || ANIMAL_SPRITES['mammal-0'];
		const g = new SvgGraphics(null, override);
		shape.draw(g as unknown as G);
		return toUri(g, shape.w, shape.h);
	}
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const tintHex = hexOf(animalTint(hash));
	if (/snake/.test(animalId)) {
		const shape = ANIMAL_SPRITES['snake'];
		const g = new SvgGraphics(tintHex, override);
		shape.draw(g as unknown as G);
		return toUri(g, shape.w, shape.h);
	}
	const c = composeAnimalDraw(animalId, kind);
	const g = new SvgGraphics(tintHex, override);
	c.draw(g as unknown as G);
	return toUri(g, c.w, c.h);
}

/**
 * Build the player's sprite from their saved appearance — round and cozy,
 * matching the SVG preview in the character creator.
 */
export function makePlayerTexture(
	scene: Phaser.Scene,
	appearance: { skin?: string; hair?: string; outfit?: string; hat?: string; hatColor?: string | null; hairstyle?: string; beard?: string; body?: string } | undefined
): string {
	const a = {
		skin: appearance?.skin || '#eec39a',
		hair: appearance?.hair || '#6e4a33',
		outfit: appearance?.outfit || '#4a7c59',
		hat: appearance?.hat || 'straw',
		hatColor: appearance?.hatColor || null,
		hairstyle: appearance?.hairstyle || 'short',
		beard: appearance?.beard || 'none',
		body: appearance?.body || 'slim',
	};
	const key = `player-${a.skin}-${a.hair}-${a.outfit}-${a.hat}-${a.hatColor || 'classic'}-${a.hairstyle}-${a.beard}-${a.body}`.replace(/#/g, '');
	tex(scene, key, 32, 36, (g) => {
		const skin = C(a.skin), hair = C(a.hair), outfit = C(a.outfit);
		const hp = hatPalette(a.hat, a.hatColor); // classic or custom-tinted hat tones
		const bw = a.body === 'round' ? 21 : 17; // body width by build
		// long styles fall behind the body
		if (a.hairstyle === 'long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
		}
		if (a.hairstyle === 'curly-long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
			g.fillCircle(8, 22, 4).fillCircle(24, 22, 4).fillCircle(9, 27, 3.6).fillCircle(23, 27, 3.6).fillCircle(16, 29, 4);
		}
		if (a.hairstyle === 'ponytail') {
			g.fillStyle(hair, 1).fillEllipse(22, 11, 7, 8).fillEllipse(25, 20, 7, 14);
		}
		if (a.hairstyle === 'pigtails') {
			g.fillStyle(hair, 1).fillEllipse(8, 11, 6, 7).fillEllipse(6, 19, 6, 12).fillEllipse(24, 11, 6, 7).fillEllipse(26, 19, 6, 12);
		}
		if (a.hairstyle === 'afro') {
			g.fillStyle(hair, 1).fillCircle(16, 11, 11.5);
		}
		if (a.hairstyle === 'bob') {
			g.fillStyle(hair, 1).fillEllipse(9.5, 14, 6.5, 11).fillEllipse(22.5, 14, 6.5, 11);
		}
		if (a.hairstyle === 'braid') {
			g.fillStyle(hair, 1).fillEllipse(22.5, 11.5, 6, 7);
			g.fillCircle(24.5, 16.5, 3.2).fillCircle(25.5, 21, 2.9).fillCircle(26, 25, 2.5);
			g.fillStyle(C('#c9913f'), 1).fillRect(24.7, 27, 2.6, 1.4);
		}
		// body
		g.fillStyle(outfit, 1).fillEllipse(16, 25, bw, 16);
		g.fillStyle(0xffffff, 0.14).fillEllipse(16, 22, bw - 6, 7);
		// boots
		g.fillStyle(C('#5d4a36'), 1).fillEllipse(12, 33, 6, 4).fillEllipse(20, 33, 6, 4);
		// head
		g.fillStyle(skin, 1).fillCircle(16, 12, 8.4);
		// hairstyle fringe / volume
		g.fillStyle(hair, 1);
		if (a.hairstyle === 'curly' || a.hairstyle === 'curly-long') {
			g.fillCircle(10, 8, 4).fillCircle(15, 6, 4.4).fillCircle(21, 8, 4).fillCircle(8, 12, 3).fillCircle(24, 12, 3);
		} else if (a.hairstyle === 'afro') {
			g.fillCircle(10, 7, 4.4).fillCircle(15, 5, 4.8).fillCircle(21, 7, 4.4).fillCircle(7, 12, 3.4).fillCircle(25, 12, 3.4);
		} else if (a.hairstyle === 'mohawk') {
			g.fillTriangle(12.5, 9, 14, 1.5, 15.5, 9);
			g.fillTriangle(15, 9, 16, 0, 17, 9);
			g.fillTriangle(16.5, 9, 18, 1.5, 19.5, 9);
		} else if (a.hairstyle === 'bald') {
			// no hair at all
		} else {
			g.fillEllipse(16, 7.4, 15, 7);
		}
		if (a.hairstyle === 'bun' && a.hat === 'none') {
			g.fillCircle(16, 2.4, 4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13, 4.6, 6, 1.6);
		}
		// beard (always the hair color): a soft, short jaw wrap
		if (a.beard === 'beard') {
			g.fillStyle(hair, 1).fillEllipse(16, 17.6, 13, 7);
			g.fillStyle(hair, 1).fillEllipse(13.9, 15.8, 3.8, 1.8).fillEllipse(18.1, 15.8, 3.8, 1.8);
		}
		// face
		g.fillStyle(0x3b2e25, 1).fillCircle(13, 13, 1.2).fillCircle(19, 13, 1.2);
		if (a.beard !== 'beard') {
			g.fillStyle(0xe88888, 0.4).fillCircle(10.6, 15.2, 1.5).fillCircle(21.4, 15.2, 1.5);
		}
		// hats — tones come from hatPalette so a custom hatColor recolors every hat
		if (a.hat === 'straw') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7, 21, 6);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 4, 11, 6);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(10, 6.5, 22, 6.5);
		} else if (a.hat === 'leaf') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 5, 17, 6);
			g.lineStyle(1.2, C(hp.line), 1).lineBetween(9, 5.5, 23, 4);
		} else if (a.hat === 'beanie') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 5.6, 16, 8);
			g.fillStyle(C(hp.b), 1).fillRect(8, 7, 16, 2.4);
			g.fillStyle(C('#e8d8c8'), 1).fillCircle(16, 1.8, 2);
		} else if (a.hat === 'cap') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6, 16, 11);
			g.fillStyle(C(hp.b), 1).fillEllipse(23, 8.4, 13, 4);
		} else if (a.hat === 'bucket') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6, 15, 10);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 9.2, 20, 4);
		} else if (a.hat === 'flower') {
			g.lineStyle(2, C('#5d8a4a'), 1).lineBetween(9, 7.6, 23, 7.6);
			const fc = flowerPalette(a.hatColor); // blooms hue-rotate together
			[10, 16, 22].forEach((x, i) => {
				g.fillStyle(C(fc[i]), 1).fillCircle(x, 6.6, 1.9);
				g.fillStyle(C('#fff3c4'), 1).fillCircle(x, 6.6, 0.8);
			});
		} else if (a.hat === 'party') {
			g.fillStyle(C(hp.a), 1).fillTriangle(16, -0.5, 11.5, 8.5, 20.5, 8.5);
			g.fillStyle(C(hp.b), 1).fillTriangle(16, 2.5, 14, 6.5, 18, 6.5);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(16, 0.4, 1.5);
		} else if (a.hat === 'ranger') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7, 23, 5);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 3.8, 10.5, 6.5);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(11, 6.5, 21, 6.5);
		} else if (a.hat === 'mushroom') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 4.6, 18, 8.5);
			g.fillStyle(C(hp.line), 1).fillEllipse(16, 8, 13, 2.4);
			g.fillStyle(C('#f6efe3'), 1).fillCircle(13, 3.2, 1.2).fillCircle(18.5, 2.6, 1.4).fillCircle(20.5, 5.4, 0.9).fillCircle(14.5, 5.8, 0.8);
		} else if (a.hat === 'wizard') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 8, 19, 4.5);
			g.fillStyle(C(hp.b), 1).fillTriangle(16.8, -3, 10.5, 8, 21.8, 8);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(11.5, 7.5, 20.5, 7.5);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(17.8, 2.5, 1);
		} else if (a.hat === 'crown') {
			g.fillStyle(C(hp.a), 1).fillPoints([
				{ x: 10, y: 8 }, { x: 10, y: 3 }, { x: 12.5, y: 5.5 }, { x: 16, y: 1.2 },
				{ x: 19.5, y: 5.5 }, { x: 22, y: 3 }, { x: 22, y: 8 },
			], true);
			g.fillStyle(C(hp.line), 1).fillRect(10, 7, 12, 1.4);
			g.fillStyle(C('#c0503f'), 1).fillCircle(16, 6, 0.9);
			g.fillStyle(C('#3f6fa8'), 1).fillCircle(12.8, 6.4, 0.7).fillCircle(19.2, 6.4, 0.7);
		} else if (a.hat === 'bandana') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.5, 17, 8.5);
			g.lineStyle(1, C(hp.line), 0.6).lineBetween(10.5, 7.5, 21.5, 7.5);
			g.fillStyle(C(hp.a), 1).fillTriangle(23, 7.5, 27, 9.5, 23.5, 11);
			g.fillStyle(C(hp.b), 1).fillTriangle(23.5, 10, 26, 13.5, 22.5, 12.5);
			g.fillStyle(0xffffff, 0.55);
			g.fillCircle(13.5, 4.5, 0.6).fillCircle(18.5, 4.5, 0.6).fillCircle(16, 3, 0.6);
		} else if (!['bun', 'curly', 'curly-long', 'afro', 'mohawk', 'bald'].includes(a.hairstyle)) {
			g.fillStyle(hair, 1).fillEllipse(16, 5.6, 14, 7);
		}
	});
	return key;
}

export function animalTexture(animalId: string, kind: string): { key: string; tint: number | null } {
	if (FEATURED_TEXTURE[animalId]) return { key: FEATURED_TEXTURE[animalId], tint: null };
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	// snakes are legless — use the dedicated serpent sprite, not the generic lizard
	if (/snake/.test(animalId)) return { key: 'ani-snake', tint: animalTint(hash) };
	// every other animal gets its own trait-built sprite (registered at boot)
	return { key: `ani-gen-${animalId}`, tint: animalTint(hash) };
}

// Roughly proportional sprite sizes so a bear reads as far bigger than a
// chipmunk or a salamander. Most specific keyword wins (rules are checked top
// to bottom), then we fall back to a per-kind size, then add a tiny
// deterministic jitter so same-size species still look like individuals.
const SIZE_RULES: [RegExp, number][] = [
	[/whale|dolphin/, 1.95],
	[/bear|elk|moose/, 1.7],
	[/deer|bighorn|mountain-goat|coyote|seal|sandhill|crane|pelican|eagle|turkey/, 1.42],
	[/fox|bobcat|otter|beaver|raccoon|porcupine|heron|owl|hawk|cormorant|marten|muskrat|mink|marmot|tortoise|sea-turtle|roadrunner|gull|snowshoe-hare/, 1.18],
	[/rabbit|cottontail|jackrabbit|duck|quail|ptarmigan|squirrel|rattlesnake|snake|nutcracker|woodpecker|shorebird|crab|sea-star|anemone/, 0.95],
	[/chipmunk|vole|rat|mouse|pika|sparrow|swallow|nuthatch|blackbird|meadowlark|frog|salamander|newt|lizard|turtle|trout|fish|mussel|clam/, 0.7],
	[/butterfly|bee|beetle|dragonfly|damselfly|grasshopper|strider|scorpion|tarantula|slug|snail/, 0.5],
];

const KIND_SIZE: Record<string, number> = {
	mammal: 1.0,
	bird: 0.9,
	reptile: 0.8,
	amphibian: 0.65,
	fish: 0.8,
	insect: 0.5,
	invertebrate: 0.5,
};

/** Proportional size multiplier for an animal sprite. */
export function animalScale(animalId: string, kind = 'mammal'): number {
	let base: number | null = null;
	for (const [re, size] of SIZE_RULES) {
		if (re.test(animalId)) { base = size; break; }
	}
	if (base == null) base = KIND_SIZE[kind] ?? 1.0;
	// small deterministic jitter (±0.05) keyed off the id — variety without
	// ever flipping the size ordering between species.
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const jitter = (((hash >>> 3) % 11) - 5) / 100; // ±0.05, unsigned so it never overshoots
	return Math.round((base + jitter) * 100) / 100;
}

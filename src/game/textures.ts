// Procedural placeholder art — every sprite in Wild Willows is generated at
// boot from simple shapes, so the game ships with zero asset files.

import Phaser from 'phaser';
import { bridge } from './bridge';
import { hatPalette, flowerPalette } from '../color';
import { getPrefs } from '../prefs';

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

type G = Phaser.GameObjects.Graphics;

/**
 * Supersampling factor for all procedural textures. Shapes are authored in
 * "logical" pixels (32px tiles) but rasterized TEX_SCALE× larger so they stay
 * crisp under camera zoom + HiDPI. Every sprite must render at
 * `INV_TEX_SCALE` scale to appear at its logical size — WorldScene's `img()`
 * helper does this. Power of two so logical sizes stay float-exact (no tile seams).
 *
 * RESOLVED ONCE, HERE, AT MODULE LOAD — and it has to stay that way. Both
 * constants are read from dozens of call sites across this file and WorldScene
 * (`0.55 * INV_TEX_SCALE`, `g.generateTexture(k, w * TEX_SCALE, …)`), and the
 * whole scheme only holds together because the factor a texture was rasterized
 * at is the same factor its sprite is scaled back down by. A function that could
 * answer differently at two call sites would render sprites at the wrong size.
 * So this deliberately does NOT follow a mid-session Graphics Quality change —
 * the textures already uploaded to the GPU were built at the old factor, and the
 * next reload picks up the new one. (prefs.ts restores localStorage at import
 * time and is a dependency of this module, so the value below is the player's
 * saved choice, not the default.)
 *
 * Low quality drops to 2×: a QUARTER of the texture memory and of the boot-time
 * rasterizing, since the factor squares into pixel area. That is the trade the
 * setting exists to make, and there is room for it — Low also pins the canvas to
 * 1 device pixel per CSS pixel (renderScale() in prefs.ts), and WorldScene's
 * applyZoom clamps the camera to 2.6× that ratio, so even the most zoomed-in
 * view Low can produce still samples these textures at under 2× density.
 *
 * High stays at 4× on HiDPI as well. That looks like supersampling twice, but it
 * isn't: the device-pixel ratio enters the render path exactly ONCE, through
 * that same camera clamp, which multiplies its bounds by renderScale(). On a 2×
 * display the world is therefore drawn at twice as many device pixels per tile,
 * and 4× textures are barely oversampled — cutting them there would be a visible
 * softening rather than a free win.
 */
export const TEX_SCALE = getPrefs().graphicsQuality === 'low' ? 2 : 4;
export const INV_TEX_SCALE = 1 / TEX_SCALE;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
	if (scene.textures.exists(key)) return;
	const g = scene.make.graphics({ x: 0, y: 0 }, false);
	g.scaleCanvas(TEX_SCALE, TEX_SCALE); // rasterize the logical-pixel draw commands TEX_SCALE× sharper
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
		for (const ang of [-1.2, -0.5, 0.2, 0.9, 2.4, 3.6])
			g.fillTriangle(
				13,
				20,
				13 + Math.sin(ang) * 12 - 2,
				20 - Math.cos(ang) * 12,
				13 + Math.sin(ang) * 12 + 2,
				20 - Math.cos(ang) * 12 + 3,
			);
		g.lineStyle(2, C('#9a8a52'), 1).lineBetween(13, 18, 21, 4); // bloom stalk
		g.fillStyle(C('#e3b93f'), 1).fillCircle(21, 4, 3); // golden nectar bloom
		g.fillStyle(C('#f4e08a'), 1).fillCircle(20, 3, 1.2);
	});
	n('berries', 30, 26, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(10, 17, 8).fillCircle(20, 16, 9).fillCircle(15, 10, 8);
		g.fillStyle(C('#c14a6a'), 1)
			.fillCircle(10, 14, 3)
			.fillCircle(19, 11, 3)
			.fillCircle(23, 18, 3)
			.fillCircle(13, 20, 2.6);
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
			[
				[-3, 0],
				[3, 0],
				[0, -3],
				[0, 3],
			].forEach(([dx, dy]) => g.fillStyle(C(c), 1).fillCircle(x + dx, 8 + (i % 2) * 4 + dy, 2.6));
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
		// A bundle of dried grass fibre. Brighter, thicker strands than before with
		// pale seed heads at the tips so it reads clearly against green ground —
		// no dark outline, matching the fill-based style of the other nodes.
		g.lineStyle(2.6, C('#cfc47a'), 1); // bright fibre strands
		g.lineBetween(6, 24, 3, 6).lineBetween(11, 24, 10, 3).lineBetween(16, 24, 17, 4).lineBetween(21, 24, 24, 7);
		g.fillStyle(C('#efe6b0'), 1); // fluffy seed heads at the tips
		g.fillEllipse(3, 5, 5, 4).fillEllipse(10, 2.5, 5.2, 4.2).fillEllipse(17, 3.5, 5, 4).fillEllipse(24, 6.5, 5, 4);
		g.fillStyle(0xffffff, 0.55).fillCircle(9.4, 2, 1.2).fillCircle(16.4, 3, 1.1);
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
			[
				[-3, 0],
				[3, 0],
				[0, -3],
				[0, 3],
			].forEach(([dx, dy]) => g.fillStyle(C(c), 1).fillCircle(x + dx, 9 + dy, 2.8));
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
		for (const [x, y] of [
			[7, 12],
			[19, 12],
			[9, 17],
			[17, 17],
		] as const)
			g.fillTriangle(13, y, x, y - 3, x, y + 1);
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

	// ---- weather-gated gather nodes (appear only during certain weather) ----
	n('rainwater', 28, 24, (g) => {
		// a shallow rain puddle with a fresh drop falling in
		g.fillStyle(C('#5b93c4'), 0.95).fillEllipse(14, 18, 24, 11);
		g.fillStyle(C('#7fb4dd'), 1).fillEllipse(14, 17, 17, 7);
		g.fillStyle(0xffffff, 0.5).fillEllipse(11, 16, 7, 2.4); // sheen
		g.fillStyle(C('#bfe0f5'), 1).fillCircle(17, 6, 3).fillTriangle(14.4, 5.5, 19.6, 5.5, 17, 0.6); // drop
		g.fillStyle(0xffffff, 0.7).fillCircle(16, 5, 1);
	});
	n('dewdrops', 26, 26, (g) => {
		// dewdrops clinging to a blade of grass
		g.lineStyle(2.4, C('#6f9a5a'), 1).lineBetween(9, 25, 13, 3);
		g.lineStyle(2, C('#82ad68'), 1).lineBetween(16, 25, 13, 8);
		const drop = (x: number, y: number, r: number) => {
			g.fillStyle(C('#a8d2c0'), 0.9).fillCircle(x, y, r);
			g.fillStyle(0xffffff, 0.75).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
		};
		drop(12, 10, 4);
		drop(15.5, 16, 3);
		drop(9, 20, 2.6);
	});
	n('sunstone', 26, 24, (g) => {
		// a warm, faceted amber gem catching the light
		g.fillStyle(C('#c77d2e'), 1).fillPoints(
			[
				{ x: 13, y: 2 },
				{ x: 23, y: 11 },
				{ x: 13, y: 22 },
				{ x: 3, y: 11 },
			],
			true,
		);
		g.fillStyle(C('#e6a94e'), 1).fillPoints(
			[
				{ x: 13, y: 2 },
				{ x: 18, y: 11 },
				{ x: 13, y: 22 },
				{ x: 8, y: 11 },
			],
			true,
		);
		g.fillStyle(C('#f4cf82'), 1).fillTriangle(13, 2, 18, 11, 8, 11); // bright top facet
		g.fillStyle(0xffffff, 0.85).fillCircle(11, 8, 1.4); // glint
	});
	n('stormglass', 26, 26, (g) => {
		// a jagged shard of storm-fused glass, with a little spark
		g.fillStyle(C('#3c4677'), 1).fillPoints(
			[
				{ x: 9, y: 24 },
				{ x: 6, y: 12 },
				{ x: 12, y: 2 },
				{ x: 16, y: 12 },
				{ x: 14, y: 24 },
			],
			true,
		);
		g.fillStyle(C('#5566a3'), 1).fillPoints(
			[
				{ x: 12, y: 2 },
				{ x: 16, y: 12 },
				{ x: 14, y: 24 },
				{ x: 11, y: 13 },
			],
			true,
		);
		g.fillStyle(C('#aeb8e6'), 0.9).fillTriangle(12, 2, 15, 11, 10, 11); // lit facet
		g.lineStyle(1.6, C('#eaf0ff'), 0.95)
			.lineBetween(18, 6, 21, 10)
			.lineBetween(21, 10, 19, 11)
			.lineBetween(19, 11, 22, 15);
	});
	n('frostflower', 26, 26, (g) => {
		// a six-spoked ice crystal with a bright frozen center
		g.lineStyle(2, C('#8fb6cf'), 1);
		for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3]) {
			const dx = Math.cos(a) * 10,
				dy = Math.sin(a) * 10;
			g.lineBetween(13, 13, 13 + dx, 13 + dy);
			const bx = 13 + dx * 0.6,
				by = 13 + dy * 0.6;
			g.lineBetween(bx, by, bx + Math.cos(a + 0.6) * 3.2, by + Math.sin(a + 0.6) * 3.2);
			g.lineBetween(bx, by, bx + Math.cos(a - 0.6) * 3.2, by + Math.sin(a - 0.6) * 3.2);
		}
		g.fillStyle(C('#dceaf4'), 1).fillCircle(13, 13, 3.2);
		g.fillStyle(0xffffff, 0.9).fillCircle(12, 12, 1.3);
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

/**
 * Bridge the generated resource sprites to the DOM: snapshot every `rnode-*`
 * texture to a PNG data URL and cache it on `bridge.shared.resourceIcons`,
 * keyed by resource id. One-time cost at boot; the React UI (`ResourceIcon`)
 * then shows the same hand-drawn picture the world uses instead of a flat
 * colour swatch. Must run after makeNodeTextures.
 */
/**
 * Rasterize every texture under `prefix` to a data URL, once.
 *
 * getBase64() is a canvas toDataURL('image/png') per texture — a full PNG encode.
 * There are 38 `rnode-` and 367 `obj-` textures, and at TEX_SCALE 4 that measured
 * at roughly 120-200ms of blocked main thread for the set.
 *
 * create() called both snapshots unconditionally, and create() re-runs on every
 * scene restart — which is every area transition. So walking through a gate paid
 * a fifth of a second re-encoding PNGs that were byte-identical to the ones
 * already sitting in bridge.shared. bridge.ts has described these as snapshotted
 * "once at boot" all along; now they actually are.
 *
 * Guarded on the number of matching texture keys rather than a plain boolean, so
 * if a texture under the prefix is ever added later the set is rebuilt instead of
 * going quietly stale.
 */
const iconSnapshotCounts: Record<string, number> = {};

function snapshotIcons(scene: Phaser.Scene, prefix: string): Record<string, string> | null {
	const keys = scene.textures.getTextureKeys().filter((k) => k.startsWith(prefix));
	if (iconSnapshotCounts[prefix] === keys.length) return null;
	const icons: Record<string, string> = {};
	for (const key of keys) {
		try {
			const uri = scene.textures.getBase64(key);
			if (uri) icons[key.slice(prefix.length)] = uri;
		} catch {
			/* a texture that can't be rasterized just gets no picture */
		}
	}
	iconSnapshotCounts[prefix] = keys.length;
	return icons;
}

export function snapshotResourceIcons(scene: Phaser.Scene) {
	const icons = snapshotIcons(scene, 'rnode-');
	if (icons) bridge.shared.resourceIcons = icons;
}

/**
 * The same bridge for object sprites: snapshot every `obj-*` texture to a PNG
 * data URL on `bridge.shared.objectIcons`, keyed by shape, so the crafting and
 * planting menus can show the exact sprite that will appear in the world.
 * Must run after makeObjectTextures.
 */
export function snapshotObjectIcons(scene: Phaser.Scene) {
	const icons = snapshotIcons(scene, 'obj-');
	if (icons) bridge.shared.objectIcons = icons;
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
		g.fillStyle(C('#efe7d6'), 1).fillRoundedRect(6, 8, 13, 10, 3); // pillow
		g.fillStyle(C('#7a9ac0'), 1).fillRoundedRect(17, 13, 20, 13, 3); // blanket
		g.fillStyle(C('#5d3f28'), 1).fillRect(5, 26, 3, 4).fillRect(34, 26, 3, 4);
	});
	o('bookshelf', 34, 38, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRoundedRect(4, 3, 26, 32, 2);
		g.fillStyle(C('#5a3a26'), 1).fillRect(4, 15, 26, 2).fillRect(4, 25, 26, 2);
		const cols = ['#b5707a', '#7a9ac0', '#e3c75f', '#6da84e', '#c45ad0'];
		for (let r = 0; r < 3; r++)
			for (let i = 0; i < 5; i++) {
				g.fillStyle(C(cols[(i + r) % cols.length]), 1).fillRect(7 + i * 4, 6 + r * 10, 3, 7);
			}
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
		g.fillStyle(C('#caa15e'), 1)
			.fillCircle(11, 11, 1.4)
			.fillCircle(21, 11, 1.4)
			.fillCircle(11, 21, 1.4)
			.fillCircle(21, 21, 1.4);
	});
	o('mushroomshelf', 32, 30, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(4, 8, 24, 3).fillRect(4, 20, 24, 3);
		g.fillStyle(C('#d9756a'), 1).fillEllipse(10, 7, 9, 5);
		g.fillStyle(C('#efe7d6'), 1).fillRect(9, 7, 2, 3);
		g.fillStyle(C('#e3a14a'), 1).fillEllipse(20, 19, 9, 5);
		g.fillStyle(C('#efe7d6'), 1).fillRect(19, 19, 2, 3);
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
		['8', '16', '24'].forEach((sx) => {
			const x = +sx;
			g.fillStyle(C('#5a3f2a'), 1).fillRect(x - 1, 11, 2, 6);
			g.fillStyle(C('#f3d24a'), 1).fillCircle(x, 19, 2.4);
		});
	});
	o('aquarium', 34, 28, (g) => {
		g.fillStyle(C('#6e4a33'), 1).fillRect(3, 22, 28, 4); // stand
		g.fillStyle(C('#7fb4d8'), 1).fillRoundedRect(5, 4, 24, 18, 2); // water
		g.lineStyle(2, C('#cfe0ee'), 1).strokeRoundedRect(5, 4, 24, 18, 2);
		g.fillStyle(C('#e8954f'), 1).fillEllipse(14, 12, 6, 3);
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(22, 16, 5, 2.5);
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
	// Bunchgrass is not a lawn: it grows in separate tussocks with bare ground
	// between them, blades arching out from a tight crown, seed heads held above.
	// That gapped, three-mound silhouette is the whole point — `patch` above is
	// the flat continuous mat, and the two must not read as the same plant.
	o('bunchgrass', 36, 32, (g) => {
		const clump = (cx: number, base: number, scale: number) => {
			g.fillStyle(C('#6b5a3e'), 1).fillEllipse(cx, base, 13 * scale, 4); // soil at the crown
			g.fillStyle(C('#5f7334'), 1).fillEllipse(cx, base - 3, 11 * scale, 7 * scale); // dense tuft
			g.lineStyle(1.4, C('#7f9440'), 1);
			for (let i = -3; i <= 3; i++) {
				// blades arch up and only a little out, so the clump stays a column
				g.lineBetween(cx, base - 2, cx + i * 2.1 * scale, base - 6 - (13 - Math.abs(i) * 2.2) * scale);
			}
		};
		clump(8, 28, 0.8);
		clump(28, 29, 0.75);
		clump(18, 26, 1); // the tallest sits behind, between the other two
		g.lineStyle(1, C('#a89355'), 1);
		g.fillStyle(C('#cdb972'), 1);
		for (const [x, y, foot] of [
			[6, 8, 26],
			[18, 3, 24],
			[30, 10, 27],
		] as [number, number, number][]) {
			g.lineBetween(x, y + 2, x + 1.5, foot); // seed stalk, right down into the tuft
			g.fillEllipse(x, y, 2.6, 5.4); // nodding seed head
		}
	});
	o('flowers', 36, 32, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 24, 32, 12);
		const cols = ['#d77bb1', '#e8954f', '#e3c75f', '#c45ad0', '#e86a6a'];
		cols.forEach((c, i) => {
			const x = 6 + i * 6,
				y = 10 + (i % 2) * 6;
			g.lineStyle(1, C('#4f8a38'), 1).lineBetween(x, y + 4, x, 22);
			g.fillStyle(C(c), 1).fillCircle(x, y, 3.4);
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 1.2);
		});
	});
	// Butterfly flowers: tall milkweed stems with monarch-orange bloom clusters —
	// deliberately nothing like the pink multicolor wildflower patch (playtest: the
	// two read as the same plant). No resting insect: the little butterfly beside
	// the blooms just read as a stray bug, so the sprite is now clean flowers.
	o('butterflyflowers', 36, 34, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 27, 30, 11);
		g.lineStyle(1.5, C('#4f8a38'), 1)
			.lineBetween(10, 27, 10, 12)
			.lineBetween(18, 27, 18, 8)
			.lineBetween(26, 27, 26, 13);
		g.fillStyle(C('#e8813a'), 1).fillCircle(10, 11, 3.6).fillCircle(18, 7, 4.2).fillCircle(26, 12, 3.6);
		g.fillStyle(C('#c95f1e'), 1).fillCircle(9, 9.6, 1.4).fillCircle(17, 5.6, 1.6).fillCircle(25, 10.6, 1.4);
		g.fillStyle(C('#f4b04a'), 1).fillCircle(11.2, 11.8, 1.3).fillCircle(19.2, 8.2, 1.5).fillCircle(27.2, 12.8, 1.3);
	});
	// Pollinator garden: a tended soil bed packed with blue/violet blooms and a
	// bee — reads as a planted garden, not a wild patch.
	o('pollinatorgarden', 40, 32, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(2, 18, 36, 10, 4); // bed edge
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(4, 20, 32, 6, 3); // dark soil
		const blues = ['#5a7bd8', '#7d6bd8', '#4a9ad0', '#5a7bd8', '#8a5ad0', '#4a6ad8'];
		blues.forEach((c, i) => {
			const x = 6 + i * 5.6,
				y = 14 - (i % 2) * 4;
			g.lineStyle(1, C('#4f8a38'), 1).lineBetween(x, y + 3, x, 21);
			g.fillStyle(C(c), 1).fillCircle(x, y, 3);
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 1);
		});
		// a busy bee
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(34, 7, 3.4, 2.4);
		g.fillStyle(C('#3b2e25'), 1).fillRect(33.4, 5.8, 1.1, 2.4);
		g.fillStyle(0xffffff, 0.7).fillEllipse(35.6, 5.4, 2, 1.2);
	});
	o('bush', 36, 32, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(12, 20, 11).fillCircle(24, 18, 12).fillCircle(18, 12, 10);
		g.fillStyle(C('#5d3a5f'), 1).fillCircle(12, 14, 2.4).fillCircle(22, 11, 2.4).fillCircle(27, 20, 2.4);
	});
	// Small Pond: the built one — a deliberately dug clay basin with a clean
	// packed rim. Every other body of water in the game now draws its own shape
	// (see the water section further down), so this one is free to read as
	// man-made rather than as the generic "some water goes here" ellipse.
	o('pond', 52, 40, (g) => {
		g.fillStyle(C('#a89372'), 1).fillEllipse(26, 22, 52, 34); // excavated spoil rim
		g.fillStyle(C('#b9a37c'), 1).fillEllipse(26, 20, 48, 28); // packed clay lip
		g.fillStyle(C('#8a7550'), 1).fillEllipse(26, 22, 44, 27); // the liner, cut clean
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(26, 22, 40, 23); // held water
		g.fillStyle(C('#417ba8'), 1).fillEllipse(28, 24, 26, 13); // deeper middle
		g.fillStyle(C('#8fc0e0'), 0.8).fillEllipse(20, 17, 18, 8); // sky on the surface
		g.fillStyle(0xffffff, 0.4).fillEllipse(18, 15, 10, 3);
		g.fillStyle(C('#6f9450'), 1).fillEllipse(7, 30, 10, 5).fillEllipse(45, 14, 9, 4); // planted edge taking hold
	});
	o('log', 42, 26, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(21, 23, 40, 8); // ground
		g.fillStyle(C('#6a4a30'), 1).fillRoundedRect(2, 8, 30, 13, 6); // the log
		g.fillStyle(C('#7f5c3c'), 1).fillRoundedRect(2, 8, 26, 4, 2); // sunlit upper curve
		g.fillStyle(C('#8a6544'), 1).fillEllipse(32, 14, 12, 15); // the open end
		g.fillStyle(C('#5d4128'), 1).fillEllipse(32, 14, 9, 12);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(32, 15, 6, 9); // the dry chamber inside
		g.fillStyle(C('#3d3120'), 1).fillEllipse(32, 18, 6, 2.4); // its worn floor
		g.fillStyle(C('#5d8a4a'), 0.9).fillEllipse(11, 8, 11, 4); // moss on the outside
		g.fillStyle(C('#4f4030'), 1).fillEllipse(16, 15, 9, 3); // the seam it was opened along
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
		const dots = [
			[7, 9],
			[13, 14],
			[19, 10],
			[25, 15],
			[10, 18],
			[22, 18],
			[16, 8],
			[28, 9],
		];
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
		g.fillStyle(C('#5d8a4a'), 0.85)
			.fillCircle(7, 16, 2.6)
			.fillCircle(15, 17, 3)
			.fillCircle(26, 17, 2.6)
			.fillCircle(20, 7, 2.2);
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
	// Reed Bed: a lush stand of soft green marsh grasses with feathery seed
	// plumes — deliberately NO brown seed spikes, so it can't be mistaken for the
	// cattail stand (playtest: the two read as the same plant).
	o('reed', 36, 42, (g) => {
		g.fillStyle(C('#6aa884'), 0.6).fillEllipse(18, 36, 34, 10);
		const cols = ['#7fa05a', '#8fb46a', '#6f9450'];
		for (let i = 0; i < 8; i++) {
			const x = 4 + i * 4;
			const top = 6 + (i % 3) * 5;
			g.lineStyle(2, C(cols[i % 3]), 1).lineBetween(x, 38, x, top);
			// soft feathery green plume (not a hard brown head)
			g.fillStyle(C('#b7c98a'), 1).fillEllipse(x, top, 3, 6);
			g.fillStyle(C('#cdd99e'), 1).fillEllipse(x - 0.6, top - 1.5, 1.4, 3);
		}
	});
	// Cattail Stand: the signature brown cylindrical seed heads on tall stems, a
	// couple of thin leaf blades behind — unmistakably different from the reed bed.
	o('cattail', 34, 46, (g) => {
		g.fillStyle(C('#6aa884'), 0.6).fillEllipse(17, 40, 32, 9);
		// thin green leaf blades fanning out behind the stalks
		g.lineStyle(1.5, C('#7fa05a'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(5 + i * 6, 42, 5 + i * 6 + (i % 2 ? 4 : -4), 12 + (i % 2) * 8);
		const stalks = [
			{ x: 9, top: 12 },
			{ x: 17, top: 6 },
			{ x: 25, top: 14 },
		];
		stalks.forEach((s) => {
			// upright green stem
			g.lineStyle(2.4, C('#5f8a44'), 1).lineBetween(s.x, 42, s.x, s.top + 11);
			// little tip spike above the head
			g.lineStyle(1.5, C('#5f8a44'), 1).lineBetween(s.x, s.top + 1, s.x, s.top - 5);
			// the brown "corn-dog" seed head
			g.fillStyle(C('#7a4a22'), 1).fillRoundedRect(s.x - 2.6, s.top, 5.2, 13, 2.6);
			g.fillStyle(C('#8f5a2c'), 1).fillRoundedRect(s.x - 1.2, s.top + 1.5, 2, 10, 1);
		});
	});
	o('mound', 38, 26, (g) => {
		g.fillStyle(C('#a8905f'), 1).fillEllipse(19, 17, 38, 17); // the heaped rise
		g.fillStyle(C('#c2a070'), 1).fillEllipse(18, 13, 32, 12); // loose sunlit crown
		g.fillStyle(C('#d4b585'), 1).fillEllipse(15, 10, 20, 7); // freshly turned, still pale
		g.fillStyle(C('#8a7048'), 1).fillEllipse(24, 18, 20, 11); // the one bare worked face
		g.fillStyle(C('#241c14'), 1).fillEllipse(24, 18, 11, 8); // tunnelled straight in
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(24, 21, 11, 2.4); // worn sill
		g.fillStyle(C('#b59a6c'), 1).fillEllipse(9, 21, 12, 4); // spoil spilling off the side
		g.fillStyle(C('#8f7850'), 1).fillCircle(6, 14, 1.6).fillCircle(30, 9, 1.4).fillCircle(12, 8, 1.2); // clods
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
		g.fillStyle(C('#6b5b3e'), 1).fillEllipse(20, 22, 40, 14); // leaf litter
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(9, 20, 12, 4).fillEllipse(31, 21, 11, 4);
		g.fillStyle(C('#5f4c33'), 1).fillEllipse(20, 22, 18, 8); // the cup, sunk level with it
		g.fillStyle(C('#a89a68'), 1).fillEllipse(20, 22, 14, 6); // grass lining
		g.fillStyle(C('#c2b478'), 1).fillEllipse(18, 21, 6, 2).fillEllipse(23, 23, 5, 1.8);
		g.fillStyle(C('#e8e2d4'), 1).fillEllipse(18, 22, 4.4, 3.4).fillEllipse(22.5, 22.6, 4.4, 3.4); // eggs
		g.fillStyle(C('#a89478'), 1).fillCircle(17, 21.4, 0.6).fillCircle(23, 22, 0.6);
		g.lineStyle(2.4, C('#4f7d3a'), 1); // the bramble arching over — the whole defence
		g.lineBetween(1, 24, 12, 5).lineBetween(12, 5, 28, 4).lineBetween(28, 4, 39, 22);
		g.lineStyle(1.6, C('#5f9448'), 1).lineBetween(4, 24, 14, 9).lineBetween(26, 8, 36, 23);
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(9, 7, 8, 5).fillEllipse(20, 3, 9, 5).fillEllipse(31, 9, 8, 5); // leaves
		g.lineStyle(1, C('#7a5a3a'), 1); // and it is thorny
		for (const [x, y] of [
			[6, 15],
			[14, 6],
			[24, 4],
			[34, 15],
		] as [number, number][])
			g.lineBetween(x, y, x + 1.8, y + 1.8).lineBetween(x, y, x - 1.8, y + 1.6);
	});
	o('coralgarden', 42, 32, (g) => {
		g.fillStyle(C('#cdbfa0'), 1).fillEllipse(21, 26, 40, 12); // sandy bed
		g.fillStyle(C('#5d96c8'), 0.55).fillEllipse(21, 24, 36, 9); // shallow water film
		const branch = (x: number, h: number, c: string) => {
			g.fillStyle(C(c), 1).fillRoundedRect(x - 2, 26 - h, 4, h, 2);
			g.fillCircle(x, 26 - h, 3);
		};
		branch(10, 14, '#e58b6f');
		branch(17, 20, '#f2a98f');
		branch(24, 16, '#e0876f');
		branch(31, 12, '#e8a07a');
		branch(20, 11, '#d96e8a');
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
		const items: [number, string, number][] = [
			[9, '#e6d8c8', 16],
			[13, '#8fc6c2', 22],
			[17, '#9bbcc8', 18],
			[21, '#a9d8d0', 24],
		];
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
		const bits: [number, number, string][] = [
			[8, 9, '#8fc6c2'],
			[15, 13, '#a9d8d0'],
			[22, 9, '#bcd8e6'],
			[27, 15, '#9fd0cc'],
			[12, 17, '#8fc6c2'],
			[20, 7, '#a9d8d0'],
		];
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
		g.fillStyle(C('#8c6a42'), 1)
			.fillCircle(6, 2, 2.4)
			.fillCircle(30, 2, 2.4)
			.fillCircle(6, 32, 2.4)
			.fillCircle(30, 32, 2.4);
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
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4); // shadow
		g.fillStyle(C('#6b5f47'), 1).fillRoundedRect(3, 10, 28, 15, 2); // the crate
		g.fillStyle(C('#6fa8d6'), 1).fillRect(3, 14, 28, 4); // wetland livery
		g.lineStyle(1, C('#524936'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25); // slats
		g.fillStyle(C('#4f6b74'), 1).fillEllipse(10, 6, 15, 7); // a rolled pond liner
		g.fillStyle(C('#6a8b94'), 1).fillEllipse(10, 5, 12, 4);
		g.lineStyle(1, C('#3d545c'), 1).strokeEllipse(10, 5.4, 8, 3);
		g.fillStyle(C('#c9b48c'), 1).fillRoundedRect(19, 2, 9, 8, 1.5); // a filter box
		g.fillStyle(C('#8fa8b0'), 1).fillRect(20, 3.4, 7, 1.4).fillRect(20, 6, 7, 1.4).fillRect(20, 8, 7, 1.2);
		g.fillStyle(C('#8a8478'), 1).fillRect(29, 1, 1.8, 9); // a channel tool
		g.fillStyle(C('#a8a29a'), 1).fillTriangle(28, 9, 32, 9, 30, 12);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
	});
	o('binoculars', 30, 24, (g) => {
		// two barrels joined by a bridge, glass catching the light
		g.fillStyle(C('#5d4a36'), 1).fillRoundedRect(2, 4, 11, 16, 4).fillRoundedRect(17, 4, 11, 16, 4);
		g.fillStyle(C('#7a6a4f'), 1).fillRect(12, 8, 6, 5); // bridge
		g.fillStyle(C('#a8c8d8'), 1).fillCircle(7.5, 17, 3.6).fillCircle(22.5, 17, 3.6); // lenses
		g.fillStyle(0xffffff, 0.85).fillCircle(6.4, 15.8, 1.2).fillCircle(21.4, 15.8, 1.2); // glints
		g.fillStyle(C('#e3c75f'), 1).fillRect(4, 2, 22, 2.5); // woven strap across the top
	});
	// Headlamp: a lamp module on a woven head strap, warm beam spilling down — its
	// own sprite now, so it no longer looks like a generic restoration kit.
	o('headlamp', 30, 24, (g) => {
		// woven head strap (a band around the head, seen head-on)
		g.lineStyle(3, C('#6b5a3c'), 1).strokeEllipse(15, 15, 22, 15);
		// soft warm beam spilling down from the lens
		g.fillStyle(C('#ffd98a'), 0.32).fillTriangle(15, 9, 5, 23, 25, 23);
		// lamp housing + mount plate over the top of the band
		g.fillStyle(C('#2f2a24'), 1).fillRoundedRect(6, 10, 18, 3, 1.5);
		g.fillStyle(C('#4a4038'), 1).fillRoundedRect(9, 3, 12, 9, 2);
		// warm lens
		g.fillStyle(C('#ffd98a'), 1).fillCircle(15, 8, 3.4);
		g.fillStyle(C('#fff3c4'), 1).fillCircle(15, 8, 1.6);
	});
	// Hiking Boots: a broken-in pair, side-on, with lugged soles and woven laces.
	o('hikingboots', 32, 26, (g) => {
		const boot = (ox: number, tone: string, lace: string) => {
			g.fillStyle(C(tone), 1);
			g.fillRoundedRect(ox, 5, 8, 12, 2); // ankle shaft
			g.fillRoundedRect(ox - 3, 14, 15, 6, 2); // foot
			g.fillStyle(C('#3b2a1c'), 1).fillRect(ox - 3, 19, 15, 2.6); // lugged sole
			g.fillStyle(C(lace), 1); // laces up the front
			g.fillRect(ox + 1, 7, 6, 1.2)
				.fillRect(ox + 1, 9.5, 6, 1.2)
				.fillRect(ox + 1, 12, 6, 1.2);
		};
		boot(15, '#6b4326', '#d9b877'); // back boot (darker, slightly behind)
		boot(6, '#8a5a34', '#e3c75f'); // front boot
	});

	// --- tool sprites (shown in the Tools & Upgrades menu) ---
	// Each tool's picture evolves per upgrade tier: sturdier baskets, bigger/
	// tempered spades, fancier watering vessels, and richer field guides.

	// Gathering Basket → Reinforced → Woven Carryall → Naturalist's Pack
	o('basket1', 30, 28, (g) => {
		g.lineStyle(2.4, C('#8a6330'), 1).strokeEllipse(15, 11, 22, 11); // carry handle
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(5, 12, 20, 13, 3); // woven body
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 3; i++) g.fillRect(5, 14 + i * 3.4, 20, 1.2); // weave courses
		g.fillStyle(C('#8a6330'), 1).fillRect(7, 13, 1.4, 12).fillRect(14, 13, 1.4, 12).fillRect(21, 13, 1.4, 12);
		g.fillStyle(C('#c99a5e'), 1).fillRect(4, 11, 22, 2.2); // rim
	});
	o('basket2', 30, 28, (g) => {
		g.lineStyle(2.6, C('#6e4e22'), 1).strokeEllipse(15, 10, 24, 12); // sturdier handle
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(3, 12, 24, 14, 3); // bigger body
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 3; i++) g.fillRect(3, 14 + i * 3.6, 24, 1.2);
		g.fillStyle(C('#7a5a34'), 1).fillRect(3, 17, 24, 2.6); // reinforcement band
		g.fillStyle(C('#9aa0a6'), 1).fillCircle(8, 18.3, 1.2).fillCircle(15, 18.3, 1.2).fillCircle(22, 18.3, 1.2); // studs
		g.fillStyle(C('#c99a5e'), 1).fillRect(2, 11, 26, 2.4); // rim
	});
	o('basket3', 30, 28, (g) => {
		g.lineStyle(2.4, C('#7a5a34'), 1).strokeEllipse(15, 9, 22, 12);
		g.fillStyle(C('#c9a56a'), 1).fillRoundedRect(5, 9, 20, 18, 3); // tall carryall
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 4; i++) g.fillRect(5, 11 + i * 3.8, 20, 1); // finer weave
		g.fillStyle(C('#8a6330'), 1);
		for (let i = 0; i < 5; i++) g.fillRect(6 + i * 3.7, 10, 1, 16);
		g.fillStyle(C('#c99a5e'), 1).fillRect(4, 8, 22, 2.2); // rim
		g.lineStyle(3, C('#6b4f2c'), 1).lineBetween(4, 6, 26, 22); // shoulder strap
	});
	o('basket4', 30, 30, (g) => {
		g.lineStyle(2, C('#4a3a24'), 1).lineBetween(9, 9, 7, 26).lineBetween(21, 9, 23, 26); // shoulder straps
		g.fillStyle(C('#6b5334'), 1).fillRoundedRect(6, 7, 18, 20, 4); // pack body
		g.fillStyle(C('#5a4630'), 1).fillRoundedRect(9, 19, 12, 7, 2); // front pocket
		g.fillStyle(C('#7a6140'), 1).fillRoundedRect(6, 6, 18, 9, 4); // top flap
		g.fillStyle(C('#4a3a24'), 1).fillRect(14, 13, 2, 4); // strap
		g.fillStyle(C('#c9a45a'), 1).fillRect(13.4, 14.5, 3.2, 2.2); // buckle
	});

	// Basic Shovel → Restoration Shovel → Tempered Spade → Earthshaper's Spade
	o('shovel1', 26, 36, (g) => {
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 2, 3, 22); // handle
		g.fillStyle(C('#7a6544'), 1).fillRect(10.5, 2, 1.2, 22);
		g.fillStyle(C('#b8bcc2'), 1).fillTriangle(6, 22, 19, 22, 12.5, 32); // blade
		g.fillStyle(C('#d7dade'), 1).fillTriangle(9, 23, 16, 23, 12.5, 29); // highlight
	});
	o('shovel2', 26, 36, (g) => {
		g.fillStyle(C('#7a6544'), 1).fillRect(10.5, 2, 3, 2.5); // grip nub
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 4, 3, 18); // handle
		g.fillStyle(C('#8a8f96'), 1).fillRect(9.5, 21, 6, 3); // metal collar
		g.fillStyle(C('#aeb4ba'), 1).fillTriangle(5, 23, 20, 23, 12.5, 34); // bigger blade
		g.fillStyle(C('#d7dade'), 1).fillTriangle(8, 24, 17, 24, 12.5, 31);
	});
	o('shovel3', 26, 36, (g) => {
		g.fillStyle(C('#7a6544'), 1).fillRect(9, 2, 7, 3); // T-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 16); // handle
		g.fillStyle(C('#8a8f96'), 1).fillRect(9.5, 20, 6, 2.6); // collar
		g.fillStyle(C('#9fb0be'), 1).fillRoundedRect(6, 22, 13, 12, 2); // square spade
		g.fillStyle(C('#5f7d92'), 1).fillRect(6, 22, 13, 2); // tempered edge
		g.fillStyle(C('#cdd6dc'), 1).fillRect(9, 25, 6, 5); // sheen
	});
	o('shovel4', 26, 36, (g) => {
		g.lineStyle(2.4, C('#7a6544'), 1).strokeEllipse(12.5, 4, 9, 6); // D-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 15); // handle
		g.fillStyle(C('#c9a45a'), 1).fillRect(9.5, 19, 6, 2.6); // gold collar
		g.fillStyle(C('#8f9aa4'), 1).fillRoundedRect(5, 21, 15, 13, 2); // big blade
		g.fillStyle(C('#c9a45a'), 1).fillRect(5, 21, 15, 1.6); // gold trim
		g.fillStyle(C('#6f7d88'), 1).fillRect(12, 22, 1.4, 11); // center rib
		g.fillStyle(C('#cdd6dc'), 1).fillTriangle(7, 23, 11, 23, 9, 30); // sheen
	});

	// Tin Watering Can → Rainwater Canteen → Spring-fed Ewer → Cloudcatcher Urn
	o('wateringcan1', 32, 28, (g) => {
		g.lineStyle(2.2, C('#8a9096'), 1).strokeEllipse(17, 8, 11, 9); // handle
		g.fillStyle(C('#aab0b4'), 1).fillTriangle(2, 21, 9, 12, 9, 21); // spout
		g.fillStyle(C('#b9bfc2'), 1).fillRoundedRect(8, 10, 15, 14, 3); // tin body
		g.fillStyle(C('#9aa0a4'), 1).fillRect(8, 10, 15, 2.5); // rim
		g.fillStyle(0xffffff, 0.5).fillRect(10, 13, 3, 8); // shine
		g.fillStyle(C('#c7ccce'), 1).fillCircle(4, 21, 2.2); // rose
	});
	o('wateringcan2', 32, 28, (g) => {
		g.fillStyle(C('#6fa8d6'), 1).fillRect(12, 2, 1, 3).fillRect(17, 1, 1, 3); // falling rain
		g.lineStyle(2.2, C('#7a8690'), 1).strokeEllipse(18, 9, 10, 9); // handle
		g.fillStyle(C('#8fa6b8'), 1).fillTriangle(2, 21, 9, 13, 9, 21); // spout
		g.fillStyle(C('#c7d6e2'), 1).fillTriangle(7, 11, 24, 11, 15.5, 6); // rain-catch funnel
		g.fillStyle(C('#9fb4c4'), 1).fillRoundedRect(8, 11, 15, 13, 3); // galvanized body
		g.fillStyle(C('#6fa8d6'), 1).fillRect(9, 16, 13, 7); // rainwater fill
		g.fillStyle(C('#c7ccce'), 1).fillCircle(4, 21, 2.2); // rose
	});
	o('wateringcan3', 32, 28, (g) => {
		g.lineStyle(2.4, C('#6f9a6a'), 1).strokeEllipse(19, 8, 10, 10); // handle
		g.fillStyle(C('#7fae8a'), 1).fillTriangle(1, 19, 8, 9, 8, 19); // long spout
		g.fillStyle(C('#8fbf9a'), 1).fillRoundedRect(9, 8, 14, 16, 4); // tall ewer
		g.fillStyle(C('#bfe0d0'), 1).fillRect(10, 15, 12, 8); // clear spring water
		g.fillStyle(C('#5f8a44'), 1).fillEllipse(15, 6, 5, 2.6); // leaf motif on lid
		g.fillStyle(C('#cfe7d6'), 1).fillCircle(3, 19, 2.4); // rose
	});
	o('wateringcan4', 32, 28, (g) => {
		g.lineStyle(2.6, C('#c9a45a'), 1).strokeEllipse(19, 8, 11, 10); // gold handle
		g.fillStyle(C('#5f8fb8'), 1).fillTriangle(1, 19, 8, 9, 8, 19); // spout
		g.fillStyle(C('#6f9fc8'), 1).fillRoundedRect(8, 9, 16, 16, 5); // urn body
		g.fillStyle(C('#c9a45a'), 1).fillRect(8, 9, 16, 2); // gold rim
		g.fillStyle(C('#8fd0e8'), 1).fillRect(10, 16, 12, 8); // clean water
		g.fillStyle(0xffffff, 0.85).fillCircle(13, 13, 2.4).fillCircle(17, 12.6, 3).fillCircle(20, 14, 2); // cloud
		g.fillStyle(C('#c9a45a'), 1).fillCircle(3.5, 19, 2.6); // gold rose
	});

	// Field journals: the cover is tinted to each area's field guide, with one
	// bookmark ribbon per tier (the final Master guide gets a gold ribbon).
	const book = (shape: string, cover: string, band: string, ribbons: number) =>
		o(shape, 28, 30, (g) => {
			g.fillStyle(C(cover), 1).fillRoundedRect(5, 4, 18, 24, 2); // cover
			g.fillStyle(C('#f3ead2'), 1).fillRect(8, 6, 14, 20); // pages
			g.fillStyle(C('#5a4326'), 1).fillRect(5, 4, 3, 24); // spine
			g.fillStyle(C(band), 1).fillRect(8, 8, 14, 3); // title band
			g.lineStyle(1, C('#b7a988'), 1);
			for (let i = 0; i < 3; i++) g.lineBetween(10, 14 + i * 4, 20, 14 + i * 4); // ruled lines
			for (let i = 0; i < ribbons; i++)
				g.fillStyle(C(i === ribbons - 1 && ribbons > 1 ? '#e3c75f' : '#c45a5a'), 1).fillRect(8 + i * 2, 2, 1.6, 7);
		});
	book('journal1', '#8a7a52', '#b7a988', 1); // starter field journal (kraft)
	book('journal2', '#6b8f4e', '#8fb46a', 2); // Willow Meadow (green)
	book('journal3', '#3f5f3a', '#6b8f4e', 3); // Old Hollow Forest (deep green)
	book('journal4', '#3f7a86', '#7fbccb', 4); // Rushwater Wetland (teal)
	book('journal5', '#b5703a', '#e0a45a', 5); // Redstone Scrubland (terracotta)
	book('journal6', '#6a7486', '#aab9c6', 6); // Graywind Heights (slate)
	book('journal7', '#7a2f3a', '#e3c75f', 7); // Master Naturalist's Guide (burgundy + gold)

	// --- house-style sprites (shown in the House upgrade menu) ---
	// Log Cabin: dark log walls, warm golden-pine door, brown gabled roof.
	o('house-cabin', 48, 44, (g) => {
		g.fillStyle(C('#6e4a2c'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#83603a'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#5e3f29'), 1).fillRoundedRect(8, 23, 32, 17, 2); // log wall
		g.lineStyle(1, C('#4a3020'), 1);
		for (let i = 0; i < 3; i++) g.lineBetween(8, 28 + i * 4, 40, 28 + i * 4); // log courses
		g.fillStyle(C('#c8a064'), 1).fillRoundedRect(20, 28, 9, 12, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 27, 6, 6); // lit window
	});
	// Meadow Cottage: pale wood walls, airy blue-grey roof, green trim + window box.
	o('house-cottage', 48, 44, (g) => {
		g.fillStyle(C('#8b98a6'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#aab9c6'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#e6d3a6'), 1).fillRoundedRect(8, 23, 32, 17, 2); // pale wood wall
		g.fillStyle(C('#7fae6a'), 1).fillRect(8, 23, 32, 2.4); // green trim
		g.fillStyle(C('#c9b483'), 1).fillRoundedRect(20, 28, 9, 12, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 28, 6, 6).fillRect(30, 28, 6, 6); // windows
		g.fillStyle(C('#7fae6a'), 1).fillRect(11, 34, 8, 1.5); // window box
	});
	// Stone Hearth: slate-grey stone blocks, dark roof, a chimney with hearth glow.
	o('house-stone', 48, 44, (g) => {
		g.fillStyle(C('#5a5650'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#6f6a62'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#6f6a62'), 1).fillRect(31, 7, 6, 13); // chimney
		g.fillStyle(C('#d98a4f'), 1).fillCircle(34, 10, 2.2); // hearth glow
		g.fillStyle(C('#a9a499'), 1).fillRoundedRect(8, 23, 32, 17, 2); // stone wall
		g.lineStyle(1, C('#8a857b'), 1);
		g.lineBetween(8, 31, 40, 31).lineBetween(18, 23, 18, 31).lineBetween(28, 31, 28, 40); // block seams
		g.fillStyle(C('#7a756b'), 1).fillRoundedRect(20, 30, 9, 10, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 26, 6, 6); // lit window
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
		for (const [x, y] of [
			[7, 24],
			[14, 27],
			[22, 27],
			[30, 24],
			[11, 20],
			[27, 20],
		] as const)
			g.fillCircle(x, y, 3.6);
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
		const stones: [number, number, number, number][] = [
			[13, 31, 11, 7],
			[13, 24, 9, 6],
			[13, 18, 7, 5],
			[13, 13, 5.5, 4.5],
			[13, 9, 4, 3.5],
		];
		stones.forEach(([x, y, rw, rh], i) =>
			g.fillStyle(C(i % 2 ? '#9a948a' : '#8e8e8a'), 1).fillEllipse(x, y, rw * 2, rh * 2),
		);
	});
	o('picnic', 42, 30, (g) => {
		g.fillStyle(C('#d8d0c0'), 1).fillRoundedRect(4, 6, 34, 20, 3);
		g.fillStyle(C('#c25a5a'), 0.7);
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) g.fillRect(5 + c * 5.4, 7 + r * 4.6, 5, 4.2);
	});
	o('potrow', 42, 26, (g) => {
		for (let i = 0; i < 3; i++) {
			const x = 7 + i * 13;
			g.fillStyle(C('#cf7a52'), 1).fillRoundedRect(x - 5, 13, 10, 11, 2);
			g.fillStyle(C('#b5683f'), 1).fillRect(x - 5, 13, 10, 2.5);
			g.fillStyle(C('#5e9455'), 1)
				.fillCircle(x - 3, 10, 3)
				.fillCircle(x + 3, 10, 3)
				.fillCircle(x, 7, 3);
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
		const rows: [number, number][] = [
			[6, 18],
			[6, 12],
			[9, 6],
		];
		rows.forEach(([y, ,], r) => {
			const off = r % 2 ? 5 : 0;
			for (let x = 2 + off; x < 38; x += 9)
				g.fillStyle(C(r % 2 ? '#9a948a' : '#8e8e8a'), 1).fillRoundedRect(x, y, 8, 6, 2);
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
			const x = 5 + i * 2.8,
				y = 9 + ((i * 5) % 8);
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
		const rocks: [number, number, number][] = [
			[8, 20, 7],
			[18, 21, 8],
			[27, 20, 6],
			[13, 13, 6],
			[22, 13, 6],
			[17, 7, 5],
		];
		rocks.forEach(([x, y, r], i) => g.fillStyle(C(['#9a948a', '#8e8e8a', '#a8a29a'][i % 3]), 1).fillCircle(x, y, r));
	});
	o('nestshelf', 32, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(2, 12, 28, 11, 2); // rock ledge
		g.fillStyle(C('#6b8a4a'), 1).fillEllipse(16, 12, 22, 7); // mossy lining
		g.fillStyle(C('#caa15a'), 1).fillCircle(11, 11, 1.8).fillCircle(16, 12, 1.8).fillCircle(21, 11, 1.8); // eggs
	});
	o('driftpile', 40, 24, (g) => {
		const cols = ['#c8b89a', '#b8a888', '#d8cab0'];
		const logs: [number, number, number, number, number][] = [
			[4, 16, 30, 6, 0],
			[8, 11, 26, 5, 1],
			[6, 7, 22, 4, 2],
		];
		logs.forEach(([x, y, w, h, c]) => g.fillStyle(C(cols[c]), 1).fillRoundedRect(x, y, w, h, 3));
		g.fillStyle(C('#9a8a6a'), 1).fillCircle(34, 16, 3).fillCircle(34, 11, 2.5);
	});
	o('bluff', 40, 28, (g) => {
		g.fillStyle(C('#a89878'), 1).fillRoundedRect(2, 4, 36, 24, 3); // the built-up sandy bank
		g.fillStyle(C('#c2b9a0'), 1).fillRoundedRect(2, 4, 36, 9, 3); // sunlit top
		g.fillStyle(C('#8f8268'), 1).fillRoundedRect(2, 22, 36, 6, 3); // sheer, shadowed below
		g.fillStyle(C('#b5aa8e'), 1); // narrow ledges cut across the face
		g.fillRect(4, 13, 15, 2.6).fillRect(22, 15, 14, 2.6).fillRect(9, 19, 16, 2.4);
		g.fillStyle(C('#d0c8b0'), 1).fillRect(4, 13, 15, 1).fillRect(22, 15, 14, 1).fillRect(9, 19, 16, 1);
		g.fillStyle(C('#3a2e22'), 1); // burrow mouths along them
		g.fillEllipse(9, 13, 5, 3.4).fillEllipse(16, 13, 4.4, 3).fillEllipse(27, 15, 5, 3.4);
		g.fillEllipse(14, 19, 4.4, 3).fillEllipse(21, 19, 4, 2.8);
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(11, 4, 14, 4).fillEllipse(30, 4, 12, 4); // turf on the crest
		g.fillStyle(C('#6f6858'), 1).fillEllipse(20, 28, 34, 3); // and nothing to stand on beneath
	});
	// --- additional habitat objects (distinct silhouettes) ---
	o('clover', 34, 26, (g) => {
		g.fillStyle(C('#6fae5a'), 1).fillEllipse(17, 18, 32, 14);
		g.fillStyle(C('#4f8a38'), 1);
		for (const [x, y] of [
			[9, 12],
			[17, 9],
			[25, 13],
			[13, 17],
			[22, 17],
		] as const) {
			g.fillCircle(x - 2, y, 2.4)
				.fillCircle(x + 2, y, 2.4)
				.fillCircle(x, y - 2, 2.4);
		}
		g.fillStyle(C('#f0e2a0'), 1).fillCircle(20, 8, 2);
	});
	o('brushpile', 42, 26, (g) => {
		g.fillStyle(C('#8a7048'), 1);
		const sticks = [
			[2, 18, 30, 4],
			[6, 13, 28, 4],
			[3, 8, 24, 4],
		] as const;
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
		for (const [x, y] of [
			[8, 12],
			[14, 9],
			[20, 11],
			[26, 10],
			[11, 14],
			[23, 14],
		] as const)
			g.fillCircle(x, y, 2.4);
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
		for (const [x, y] of [
			[9, 14],
			[16, 12],
			[23, 15],
			[13, 18],
			[21, 18],
		] as const)
			g.fillEllipse(x, y, 8, 6);
		g.lineStyle(1, C('#7c786e'), 1);
		for (const [x, y] of [
			[9, 14],
			[16, 12],
			[23, 15],
		] as const)
			g.lineBetween(x - 3, y, x + 3, y);
	});

	o('gazebo', 54, 58, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(27, 52, 46, 10); // stone base
		g.fillStyle(C('#a8a8a2'), 1).fillRoundedRect(7, 46, 40, 6, 2); // deck
		g.fillStyle(C('#7c5a3c'), 1)
			.fillRect(10, 24, 5, 24)
			.fillRect(39, 24, 5, 24)
			.fillRect(20, 26, 4, 22)
			.fillRect(30, 26, 4, 22); // posts
		g.fillStyle(C('#6b5238'), 1).fillRect(8, 30, 38, 3); // rail
		g.fillStyle(C('#5d7c8a'), 1).fillTriangle(27, 2, 4, 26, 50, 26); // roof
		g.fillStyle(C('#7a9aa8'), 1).fillTriangle(27, 8, 12, 25, 42, 25); // roof highlight
		g.fillStyle(C('#c9a35c'), 1).fillCircle(27, 4, 3); // finial
	});
	o('trailtent', 48, 40, (g) => {
		// the away-from-home base camp: blue canvas (vs the pink meadow camp
		// tent), a stitched seam, a peg line, and a little pennant on the pole
		g.fillStyle(C('#3a4a5c'), 0.5).fillEllipse(24, 36, 40, 8); // ground cloth
		g.fillStyle(C('#5a86b8'), 1).fillTriangle(3, 35, 24, 6, 45, 35); // canvas
		g.fillStyle(C('#476e9c'), 1).fillTriangle(24, 6, 45, 35, 34, 35); // shaded side
		g.lineStyle(1.5, C('#3c5e88'), 0.8).lineBetween(24, 6, 24, 35); // seam
		g.fillStyle(C('#3c3324'), 1).fillTriangle(24, 12, 17, 35, 31, 35); // opening
		g.fillStyle(C('#2a2418'), 1).fillTriangle(24, 16, 20, 35, 28, 35);
		g.lineStyle(2, C('#8c6a42'), 1).lineBetween(24, 6, 24, 1); // pole
		g.lineStyle(1.5, C('#a89a78'), 1).lineBetween(3, 35, 0, 39).lineBetween(45, 35, 48, 39); // guy lines
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(24, 1, 24, 6, 31, 3.5); // pennant
	});

	// --- additional plantable vegetation (one distinct sprite each) ---
	o('daisies', 34, 26, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(17, 20, 32, 12);
		for (const [x, y] of [
			[9, 12],
			[18, 9],
			[26, 13],
			[13, 17],
			[23, 17],
		] as const) {
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
		for (const [x, y] of [
			[10, 12],
			[18, 10],
			[24, 14],
			[14, 16],
		] as const)
			g.fillCircle(x, y, 3.4);
		g.fillStyle(C('#f4e08a'), 1).fillCircle(18, 10, 1.4).fillCircle(10, 12, 1.4);
	});
	o('bulrush', 28, 40, (g) => {
		g.lineStyle(2.5, C('#5a8a4a'), 1);
		for (const x of [8, 14, 20]) g.lineBetween(x, 38, x, 6);
		g.fillStyle(C('#7a5a3a'), 1)
			.fillRoundedRect(7, 8, 3, 12, 1.5)
			.fillRoundedRect(13, 5, 3, 12, 1.5)
			.fillRoundedRect(19, 9, 3, 12, 1.5);
	});
	o('pricklypear', 34, 30, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillEllipse(13, 20, 14, 18).fillEllipse(22, 13, 12, 14).fillEllipse(24, 24, 10, 11);
		g.lineStyle(1, C('#3f6e38'), 1).strokeEllipse(13, 20, 14, 18).strokeEllipse(22, 13, 12, 14);
		g.fillStyle(C('#e8954f'), 1).fillCircle(22, 6, 2.6).fillCircle(28, 9, 2.2);
	});
	o('desertbloom', 32, 24, (g) => {
		g.fillStyle(C('#7c8a4e'), 1).fillEllipse(16, 19, 28, 10);
		g.fillStyle(C('#e88a2f'), 1);
		for (const [x, y] of [
			[9, 11],
			[17, 9],
			[24, 12],
			[13, 15],
		] as const)
			g.fillCircle(x, y, 3);
		g.fillStyle(C('#f4c75f'), 1).fillCircle(17, 9, 1.3);
	});
	o('gentian', 32, 24, (g) => {
		g.fillStyle(C('#5e7a4a'), 1).fillEllipse(16, 19, 28, 10);
		g.fillStyle(C('#3a6ad0'), 1);
		for (const [x, y] of [
			[10, 11],
			[18, 9],
			[25, 12],
			[14, 15],
		] as const) {
			for (const a of [0, 1.26, 2.51, 3.77, 5.03])
				g.fillEllipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.4, 3.2);
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
		g.fillTriangle(7, 40, 23, 40, 15, 26)
			.fillTriangle(8, 30, 22, 30, 15, 16)
			.fillTriangle(10, 20, 20, 20, 15, 6)
			.fillTriangle(12, 12, 18, 12, 15, 2);
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
		const rocks: [number, number, number][] = [
			[6, 21, 5],
			[13, 22, 6],
			[21, 22, 6],
			[29, 21, 5],
			[10, 15, 5],
			[18, 15, 5],
			[26, 15, 5],
			[14, 9, 4],
			[22, 9, 4],
		];
		rocks.forEach(([x, y, r], i) => {
			g.fillStyle(C(cols[i % 4]), 1).fillCircle(x, y, r);
			g.fillStyle(0xffffff, 0.18).fillCircle(x - r / 3, y - r / 3, r / 3);
		});
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
		for (const [x, y] of [
			[10, 17],
			[15, 15],
			[20, 17],
			[13, 19],
			[18, 19],
		] as const)
			g.fillEllipse(x, y, 5, 6);
		g.fillStyle(C('#e0c690'), 0.8).fillCircle(13, 14, 1.4).fillCircle(18, 16, 1.4);
	});
	o('juniper', 34, 30, (g) => {
		g.fillStyle(C('#5a4634'), 1).fillRect(15, 22, 4, 8); // gnarled stem
		g.fillStyle(C('#4f6b54'), 1).fillEllipse(16, 17, 30, 18); // dense low shrub
		g.fillStyle(C('#5d7a66'), 1).fillCircle(8, 15, 6).fillCircle(24, 15, 6).fillCircle(16, 11, 7);
		g.fillStyle(C('#6a7fa0'), 1); // frosted berries
		for (const [x, y] of [
			[10, 14],
			[22, 13],
			[16, 17],
			[13, 19],
			[25, 18],
			[18, 10],
		] as const)
			g.fillCircle(x, y, 2);
		g.fillStyle(0xffffff, 0.4);
		for (const [x, y] of [
			[10, 13],
			[22, 12],
			[16, 16],
		] as const)
			g.fillCircle(x, y, 0.8);
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
		const stones: [number, number, number, number][] = [
			[14, 31, 11, 7],
			[14, 24, 9, 6],
			[14, 18, 7, 5],
		];
		stones.forEach(([x, y, w, h]) => {
			g.fillStyle(C('#8e8e8a'), 1).fillEllipse(x, y, w, h);
			g.fillStyle(0xffffff, 0.2).fillEllipse(x - 2, y - 1, w / 3, h / 3);
		});
		g.fillStyle(C('#cfe8f2'), 1).fillTriangle(10, 14, 18, 14, 14, 2); // crystal crown
		g.fillStyle(C('#e6f4fb'), 1).fillTriangle(12, 14, 16, 14, 14, 5);
		g.fillStyle(0xffffff, 0.9).fillCircle(14, 7, 1.2);
	});
	o('prayerflags', 40, 26, (g) => {
		g.lineStyle(1.4, C('#6e553c'), 1).lineBetween(2, 6, 38, 10); // string sags
		const cols = ['#d77bb1', '#e8954f', '#5f9ed6', '#6fae5a', '#caa84e'];
		cols.forEach((c, i) => {
			const x = 4 + i * 7;
			const yt = 6 + i * 0.8;
			g.fillStyle(C(c), 1).fillTriangle(x, yt, x + 6, yt + 0.6, x + 3, yt + 11);
		});
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
		g.fillStyle(C('#7d7a72'), 1).fillEllipse(17, 24, 28, 9); // stone base shadow
		g.fillStyle(C('#9a978d'), 1).fillRoundedRect(4, 12, 26, 12, 5); // bowl body
		g.fillStyle(C('#84817a'), 1).fillEllipse(17, 12, 26, 9); // rim
		g.fillStyle(C('#6fa8d6'), 1).fillEllipse(17, 12, 20, 6); // water
		g.fillStyle(C('#bfe0f4'), 0.8).fillEllipse(13, 11, 7, 2); // sky glint
		g.lineStyle(1, C('#bfe0f4'), 0.5).strokeEllipse(17, 12, 13, 4); // ripple
		g.fillStyle(C('#cdecff'), 0.9).fillCircle(21, 6, 1).fillCircle(15, 4, 1); // falling drops
	});
	// Dewlit Lantern — a glass globe of glowing morning dew on a slim post.
	o('dewlantern', 24, 38, (g) => {
		g.fillStyle(C('#6e5a3a'), 1).fillRect(11, 20, 2, 16); // post
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(12, 36, 12, 4); // foot
		g.fillStyle(C('#a8d2c0'), 0.35).fillCircle(12, 13, 11); // soft glow halo
		g.fillStyle(C('#cdeee0'), 0.95).fillCircle(12, 13, 7); // dew globe
		g.fillStyle(C('#7fc4a8'), 0.9).fillCircle(12, 15, 4); // dew pool inside
		g.fillStyle(0xffffff, 0.9).fillCircle(9, 10, 1.6); // highlight
		g.fillStyle(C('#6e5a3a'), 1).fillRect(7, 4, 10, 2); // top cap
	});
	// Sunstone Cairn — a stack of warm, sun-baked stones with an inner glow.
	o('sunstonecairn', 30, 34, (g) => {
		g.fillStyle(C('#b98a3a'), 1).fillEllipse(15, 30, 24, 7); // base
		g.fillStyle(C('#e6a94e'), 1).fillEllipse(15, 27, 20, 9); // bottom stone
		g.fillStyle(C('#eebb63'), 1).fillEllipse(14, 19, 15, 8); // mid stone
		g.fillStyle(C('#f5cf7e'), 1).fillEllipse(15, 12, 10, 7); // top stone
		g.fillStyle(C('#fff0c4'), 0.7).fillCircle(15, 12, 3); // warm glow
		g.fillStyle(0xffffff, 0.5).fillCircle(12, 10, 1.4); // glint
		g.lineStyle(1, C('#a8742c'), 0.5).strokeEllipse(15, 27, 10, 4); // seam
	});
	// Frostflower Planter — pale-blue ice blooms in a wooden box.
	o('frostflowerplanter', 32, 30, (g) => {
		g.fillStyle(C('#6e5a3a'), 1).fillRoundedRect(5, 18, 22, 10, 2); // planter box
		g.fillStyle(C('#5a4a30'), 1).fillRect(5, 18, 22, 2); // soil line
		const bloom = (x: number, y: number) => {
			g.fillStyle(C('#bcd9e8'), 1);
			for (let i = 0; i < 5; i++) {
				const an = (i / 5) * Math.PI * 2;
				g.fillCircle(x + Math.cos(an) * 3.2, y + Math.sin(an) * 3.2, 2.2);
			}
			g.fillStyle(C('#eaf6ff'), 1).fillCircle(x, y, 2); // pale core
		};
		g.lineStyle(1, C('#8fb8cc'), 1).lineBetween(11, 18, 11, 10).lineBetween(21, 18, 21, 12);
		bloom(11, 8);
		bloom(21, 10);
		g.fillStyle(0xffffff, 0.6).fillCircle(9, 6, 1); // frost sparkle
	});
	// Stormglass Lantern — a shard of lightning-fused glass throwing cold light.
	o('stormglasslantern', 26, 38, (g) => {
		g.fillStyle(C('#3a2f4a'), 1).fillRect(12, 22, 2, 14); // post
		g.fillStyle(C('#2c2438'), 1).fillEllipse(13, 36, 12, 4); // foot
		g.fillStyle(C('#7b8fd6'), 0.3).fillCircle(13, 13, 12); // electric halo
		g.fillStyle(C('#5566a3'), 1).fillTriangle(13, 3, 6, 22, 20, 22); // glass shard
		g.fillStyle(C('#8fa0e0'), 0.9).fillTriangle(13, 7, 9, 20, 17, 20); // inner glass
		g.lineStyle(1.5, C('#dfe6ff'), 0.95)
			.lineBetween(13, 8, 10, 15)
			.lineBetween(10, 15, 15, 16)
			.lineBetween(15, 16, 12, 21); // lightning
		g.fillStyle(0xffffff, 0.8).fillCircle(11, 11, 1.2); // glint
	});

	// ---- weather-resource home decor (indoor, bespoke art) ----
	// Frostflower Vase — a clear glass vase of pale ice-blooms on the sill.
	o('frostflowervase', 26, 34, (g) => {
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
	});
	// Stormglass Chandelier — hanging cluster of lightning-glass shards.
	o('stormglasschandelier', 36, 30, (g) => {
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
	});

	// ---- wetland craftables (bespoke art) ----
	// Boardwalk — raised plank walkway over the marsh.
	o('boardwalk', 40, 24, (g) => {
		g.fillStyle(C('#46708a'), 0.5).fillRect(0, 14, 40, 10); // water beneath
		g.fillStyle(C('#5a3f28'), 1).fillRect(4, 18, 2, 5).fillRect(20, 18, 2, 5).fillRect(34, 18, 2, 5); // posts
		g.fillStyle(C('#9a7448'), 1).fillRect(2, 10, 36, 6); // deck
		g.fillStyle(C('#7c5a3c'), 1);
		for (let x = 4; x < 38; x += 5) g.fillRect(x, 10, 1, 6); // plank seams
		g.fillStyle(C('#b8956a'), 1).fillRect(2, 10, 36, 1); // sunlit top edge
	});
	// Heron Rookery — a tall snag with a stick nest for wading birds.
	o('heronrookery', 30, 40, (g) => {
		g.fillStyle(C('#8a8270'), 1).fillRect(13, 10, 4, 28); // dead trunk
		g.fillStyle(C('#6f6857'), 1).fillRect(13, 10, 1.5, 28); // shadow side
		g.fillStyle(C('#7a6a4a'), 1).fillRect(6, 16, 8, 2).fillRect(16, 22, 8, 2); // bare branches
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(15, 8, 20, 8); // stick nest
		g.fillStyle(C('#6e5a3a'), 1);
		for (let i = 0; i < 7; i++) g.fillRect(6 + i * 3, 6, 2, 1); // nest sticks
		g.fillStyle(C('#eae6da'), 1).fillCircle(12, 7, 1.4).fillCircle(17, 7, 1.4); // eggs
	});
	// Dragonfly Pond — open water ringed with reeds, a dragonfly skimming.
	o('dragonflypond', 36, 28, (g) => {
		g.fillStyle(C('#3f7d6a'), 1).fillEllipse(18, 18, 32, 16); // pond
		g.fillStyle(C('#5aa6cf'), 0.8).fillEllipse(18, 16, 24, 10); // open water
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 14, 8, 2); // glint
		g.lineStyle(2, C('#6da84e'), 1).lineBetween(5, 22, 4, 10).lineBetween(31, 22, 33, 9).lineBetween(9, 23, 8, 13); // reeds
		g.fillStyle(C('#3a5f2e'), 1).fillCircle(4, 9, 1.5).fillCircle(33, 8, 1.5); // reed heads
		g.fillStyle(C('#5b9cab'), 1).fillRect(19, 9, 6, 1.4); // dragonfly wings
		g.fillStyle(C('#2f6f6a'), 1).fillRect(21, 8, 2, 4); // dragonfly body
	});

	// --- Pass-2 meadow habitat objects -------------------------------------
	// --- Willow Meadow habitat objects ---

	// Abandoned stick nest: a flat grey raft slumped in a bare fork — wide and
	// untidy, deliberately nothing like the tight woven cup of `nest`.
	o('oldsticknest', 36, 28, (g) => {
		g.lineStyle(3, C('#6b5a44'), 1).lineBetween(6, 27, 16, 17).lineBetween(30, 27, 20, 17); // bare fork
		g.fillStyle(C('#6d6046'), 1).fillEllipse(18, 15, 32, 11); // raft of weathered sticks
		g.fillStyle(C('#8a7c60'), 1).fillEllipse(16, 12, 28, 7);
		g.lineStyle(1.2, C('#574c38'), 1);
		for (const [x1, y1, x2, y2] of [
			[3, 14, 15, 10],
			[6, 17, 20, 13],
			[12, 9, 32, 14],
			[9, 12, 28, 9],
			[14, 18, 33, 17],
		] as const)
			g.lineBetween(x1, y1, x2, y2); // loose twig ends
		g.fillStyle(C('#4a412f'), 1).fillEllipse(25, 16, 12, 5); // rim sagging on one side
		g.fillStyle(C('#d8cdb4'), 1).fillTriangle(28, 21, 34, 9, 31, 22); // barred feather caught in it
		g.lineStyle(0.7, C('#8a7a58'), 1).lineBetween(30, 19, 33, 12).lineBetween(30, 16, 33.5, 10);
	});

	// Bare soil scrape: raked mineral soil ringed by cut stubble. Flat and open —
	// a hole in the vegetation, not a mound.
	o('soilscrape', 34, 24, (g) => {
		g.fillStyle(C('#6e8a46'), 1).fillEllipse(17, 14, 33, 18); // cut grass stubble ring
		g.lineStyle(1, C('#88a35a'), 1);
		for (let i = 0; i < 10; i++) g.lineBetween(2 + i * 3.4, 13 + (i % 2) * 3, 2 + i * 3.4, 7 + (i % 2) * 3);
		g.fillStyle(C('#a89065'), 1).fillEllipse(17, 15, 24, 12); // scraped down to tan mineral soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(17, 14, 21, 9);
		g.fillStyle(C('#d8c79a'), 0.7).fillEllipse(13, 11, 11, 3);
		g.lineStyle(1, C('#a08a5e'), 0.9).lineBetween(8, 11, 26, 13).lineBetween(8, 14, 26, 16).lineBetween(9, 17, 25, 18); // rake lines
	});

	// Bluebird box: pale cedar on a slim pole with a flaring cone guard — the
	// silhouette is a lollipop on a stick, unlike the flush-mounted cavities.
	o('bluebirdbox', 26, 36, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRect(11, 19, 3.5, 17); // slim grey pole
		g.fillStyle(C('#9a8460'), 1).fillTriangle(2, 30, 24, 30, 13, 19); // predator guard flaring below
		g.fillStyle(C('#cdb68c'), 1).fillTriangle(4, 29, 22, 29, 13, 21);
		g.fillStyle(C('#d8c49c'), 1).fillRect(6, 5, 14, 15); // pale cedar box
		g.fillStyle(C('#bda87f'), 1).fillRect(6, 5, 4.5, 15);
		g.fillStyle(C('#a8916a'), 1).fillTriangle(2, 6, 22, 2, 22, 5).fillTriangle(2, 6, 2, 3, 22, 2); // sloped roof
		g.fillStyle(C('#2b2118'), 1).fillCircle(13, 11, 3.2); // round entrance hole
		g.fillStyle(C('#6b8cc4'), 1).fillCircle(13.6, 11.6, 1.4); // blue shoulder in the dark
	});

	// Brush form hollow: a fur-smoothed bowl pressed into dry grass under a twig
	// arch — a dish with two ear shadows in it, read from above.
	o('formhollow', 34, 24, (g) => {
		g.fillStyle(C('#c2ab72'), 1).fillEllipse(17, 16, 32, 15); // straw-gold grass
		g.lineStyle(1.4, C('#6b5a3c'), 1).lineBetween(2, 14, 11, 4).lineBetween(11, 4, 24, 5).lineBetween(24, 5, 32, 13); // low twig arch
		g.fillStyle(C('#a8925c'), 1).fillEllipse(17, 17, 23, 11); // pressed bowl
		g.fillStyle(C('#8a7648'), 1).fillEllipse(17, 18, 18, 8); // fur-smoothed floor
		g.fillStyle(C('#5f5133'), 0.85).fillEllipse(13, 17, 4, 9).fillEllipse(20, 17, 4, 9); // two long ear shadows
		g.fillStyle(C('#d8c795'), 0.6).fillEllipse(12, 13, 10, 3); // sun on the lip
	});

	// Bumblebee tussock: a shaggy fountain of blades with a thumb-sized hole at
	// the very base — the dome is the giveaway, plus one fat bee going in.
	o('nesttussock', 32, 32, (g) => {
		g.lineStyle(1.6, C('#8a9a4e'), 1);
		for (let i = 0; i < 11; i++) g.lineBetween(16, 26, 1 + i * 3, 3 + Math.abs(i - 5) * 3); // blades fountaining out
		g.fillStyle(C('#9aa85f'), 1).fillEllipse(16, 24, 28, 15); // shaggy dome
		g.fillStyle(C('#b0bd72'), 1).fillEllipse(13, 20, 18, 8);
		g.fillStyle(C('#5d5a33'), 1).fillEllipse(16, 27, 9, 6); // worn rim
		g.fillStyle(C('#241d10'), 1).fillEllipse(16, 28, 7, 5); // thumb-hole at the base
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(19, 28, 4.4, 3.2); // bee entering
		g.fillStyle(C('#3b2e25'), 1).fillRect(19.4, 27, 1.2, 2.6);
	});

	// Bunchgrass sod plugs: three squat turf cylinders in a row, one tipped on
	// its side to show the root mat. Blocky and countable, not a patch.
	o('sodplug', 34, 26, (g) => {
		for (const x of [7, 17]) {
			g.fillStyle(C('#4a3626'), 1).fillRect(x - 5, 12, 10, 10); // root-bound soil
			g.fillStyle(C('#3a2a1c'), 1).fillEllipse(x, 22, 10, 4);
			g.fillStyle(C('#8fa05a'), 1).fillEllipse(x, 12, 10, 5); // blue-green cap
			g.lineStyle(1.2, C('#6f8a45'), 1);
			for (const d of [-3, 0, 3]) g.lineBetween(x + d, 12, x + d * 1.5, 4);
		}
		g.fillStyle(C('#4a3626'), 1).fillEllipse(28, 18, 13, 10); // third plug tipped over
		g.fillStyle(C('#7a5c3c'), 1).fillEllipse(28, 18, 9, 6);
		g.lineStyle(0.8, C('#c9b183'), 1);
		for (const dy of [-3, -1, 1, 3]) g.lineBetween(24, 18 + dy, 32, 18 + dy * 1.2); // exposed root mat
	});

	// Crown eyrie: a deep pale stick bowl wedged in the topmost fork with sky all
	// round it — tall and narrow where the old hawk nest is wide and flat.
	o('crowneyrie', 30, 30, (g) => {
		g.fillStyle(C('#5a4634'), 1).fillRect(13, 20, 4, 10); // trunk top
		g.lineStyle(2.4, C('#5a4634'), 1).lineBetween(15, 22, 7, 15).lineBetween(15, 22, 23, 15); // crown fork
		g.fillStyle(C('#8a7452'), 1).fillEllipse(15, 16, 26, 14); // deep bowl
		g.fillStyle(C('#a89070'), 1).fillEllipse(15, 13, 26, 10); // sunlit pale sticks
		g.fillStyle(C('#4a3d2a'), 1).fillEllipse(15, 11, 15, 6); // dark cup interior
		g.lineStyle(1, C('#c4b08a'), 1);
		for (const [x1, y1, x2, y2] of [
			[1, 15, 13, 12],
			[5, 19, 27, 15],
			[3, 12, 21, 17],
			[11, 20, 29, 13],
		] as const)
			g.lineBetween(x1, y1, x2, y2); // sticks jutting into the air
		g.lineStyle(1.4, C('#5d8a4a'), 1).lineBetween(19, 11, 26, 6); // fresh green sprig on the rim
		g.fillStyle(C('#6da84e'), 1).fillEllipse(25, 6, 6, 3).fillEllipse(22, 8, 4.4, 2.4);
	});

	// Deep loam bank: a cutaway face in three chocolate layers with a spoil fan at
	// the foot — reads as a straight-edged cut, not a rounded mound.
	o('loambank', 34, 26, (g) => {
		g.fillStyle(C('#33261a'), 1).fillRect(3, 3, 28, 7); // dark topsoil
		g.fillStyle(C('#584530'), 1).fillRect(3, 10, 28, 6); // loam
		g.fillStyle(C('#7d6647'), 1).fillRect(3, 16, 28, 5); // subsoil
		g.fillStyle(C('#1e160d'), 0.8).fillRect(3, 9.2, 28, 1.2).fillRect(3, 15.2, 28, 1.2); // layer seams
		g.fillStyle(0xffffff, 0.16).fillRect(3, 3, 28, 2); // light off the cut face
		g.fillStyle(C('#7a6347'), 1).fillEllipse(17, 23, 30, 8); // freshly thrown soil
		g.fillStyle(C('#8c7454'), 1).fillEllipse(15, 22, 20, 5);
		g.fillStyle(C('#5a462f'), 1).fillCircle(9, 24, 1.6).fillCircle(21, 25, 1.4).fillCircle(26, 23, 1.2); // crumbs
	});

	// Domed grass nest: a hummock with a woven straw roof and a low arched tunnel
	// mouth at ground level, eggs just visible in the shadow.
	o('domednest', 32, 26, (g) => {
		g.fillStyle(C('#a8934f'), 1).fillEllipse(16, 18, 30, 16); // hummock
		g.fillStyle(C('#c8b46a'), 1).fillEllipse(16, 15, 28, 12); // grass roof
		g.lineStyle(0.9, C('#9a8442'), 1);
		for (const y of [10, 13, 16]) g.lineBetween(3, y, 29, y + 1); // woven courses
		for (const x of [8, 16, 24]) g.lineBetween(x, 8, x - 2, 20);
		g.fillStyle(C('#8a7436'), 1).fillEllipse(16, 21, 15, 10); // mouth rim
		g.fillStyle(C('#221b0e'), 1).fillEllipse(16, 22, 11, 7); // arched tunnel mouth
		g.fillStyle(C('#efe7cd'), 1)
			.fillCircle(13, 22, 1.6)
			.fillCircle(16, 21, 1.6)
			.fillCircle(19, 22, 1.6)
			.fillCircle(16, 24, 1.5); // speckled eggs
		g.fillStyle(C('#9a7448'), 1).fillCircle(12.6, 21.6, 0.5).fillCircle(19.4, 22.4, 0.5);
	});

	// Earthen fox den: two dark mouths in one mound with a pale spoil fan below.
	// Two openings is the tell — mountain-lion dens get one wide one.
	o('foxden', 34, 26, (g) => {
		g.fillStyle(C('#7c6242'), 1).fillEllipse(17, 13, 32, 18); // earth mound
		g.fillStyle(C('#8f7450'), 1).fillEllipse(14, 9, 22, 10);
		g.fillStyle(C('#5c452c'), 1).fillEllipse(10, 15, 11, 9).fillEllipse(24, 16, 9, 7); // worn rims
		g.fillStyle(C('#2a1d12'), 1).fillEllipse(10, 16, 9, 7).fillEllipse(24, 17, 7, 5); // two den mouths
		g.fillStyle(C('#b49a70'), 1).fillEllipse(17, 23, 30, 7); // fan of dug soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(14, 22, 18, 4);
		g.fillStyle(C('#efe9dc'), 1).fillRect(19, 23, 6, 1.4).fillCircle(19, 23.7, 1.1).fillCircle(25, 23.7, 1.1); // gnawed bone
		g.fillStyle(C('#b4622e'), 1).fillEllipse(6, 21, 5, 3); // rust-red tuft of fur
	});

	// Grass thatch litter: springy dead layers pressed flat, straw-blond and
	// horizontal, with pale mushroom caps pushing up through the middle.
	o('thatchmat', 34, 22, (g) => {
		g.fillStyle(C('#9a8759'), 1).fillEllipse(17, 16, 32, 10); // packed bottom layer
		g.fillStyle(C('#b6a06a'), 1).fillEllipse(17, 13, 31, 9); // springy middle
		g.fillStyle(C('#cbb87f'), 1).fillEllipse(16, 10, 28, 7); // sun-bleached top
		g.lineStyle(1, C('#8d7a4c'), 0.9);
		for (let i = 0; i < 8; i++) g.lineBetween(3 + i * 4, 9 + (i % 3), 8 + i * 4, 12 - (i % 2) * 2); // flattened stems
		g.fillStyle(C('#5d4c30'), 0.8).fillEllipse(9, 12, 6, 1.6).fillEllipse(26, 15, 7, 1.8); // shadowed gaps
		g.fillStyle(C('#e8dcc0'), 1).fillRect(15, 7, 1.6, 5).fillRect(20, 6, 1.6, 5); // mushroom stalks
		g.fillStyle(C('#efe4cc'), 1).fillEllipse(15.8, 7, 7, 4).fillEllipse(20.8, 6, 6, 3.4); // pale caps
	});

	// Grasshopper egg-pod bank: a sunlit sandy ridge with one shoulder cut away so
	// two frothy cream pods show, buried like corks.
	o('eggpodbank', 34, 24, (g) => {
		g.fillStyle(C('#bda06d'), 1).fillEllipse(17, 15, 32, 16); // firm sandy ridge
		g.fillStyle(C('#d9c48a'), 1).fillEllipse(16, 11, 28, 9); // sunlit crest
		g.fillStyle(C('#6b5734'), 1).fillTriangle(17, 3, 33, 11, 33, 23); // cut-away face
		g.fillStyle(C('#846d44'), 1).fillTriangle(19, 6, 32, 12, 32, 21);
		g.fillStyle(C('#fbf4dc'), 1).fillEllipse(24, 12, 6, 10).fillEllipse(29, 17, 5.4, 9); // frothy egg pods
		g.fillStyle(C('#ddd0a6'), 1).fillEllipse(24, 14, 5, 5).fillEllipse(29, 19, 4.4, 4.4);
		g.lineStyle(0.7, C('#b9a97e'), 1).lineBetween(21.5, 10, 26.5, 10).lineBetween(21.5, 13, 26.5, 13); // foam banding
		g.fillStyle(C('#cbb277'), 1).fillCircle(8, 20, 1.4).fillCircle(12, 21, 1.1); // loose sand
	});

	// Hedgerow lane: a dark green wall seen end-on, tangled bare twigs under the
	// leaves and one narrow flight gap punched through at bird height.
	o('hedgerow', 36, 30, (g) => {
		g.lineStyle(1.2, C('#584732'), 1);
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 4, 29, 6 + i * 3, 14); // tangled bare twigs
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 14, 36, 20); // dense hedge wall
		g.fillStyle(C('#3f5c39'), 1).fillCircle(7, 12, 8).fillCircle(18, 9, 9).fillCircle(29, 12, 8);
		g.fillStyle(C('#54774a'), 1).fillCircle(10, 8, 4).fillCircle(22, 6, 4.5).fillCircle(31, 10, 3.5); // sunlit leaf tops
		g.fillStyle(C('#1a2a18'), 1).fillEllipse(18, 17, 8, 10); // flight gap punched through
		g.fillStyle(C('#243a20'), 1).fillEllipse(18, 17, 5, 7);
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 26, 34, 8); // shaded base
	});

	// Mantis ootheca: two stiff dead stems, one carrying a tan foam case ridged in
	// horizontal bands — a lump on a stick, no foliage at all.
	o('ootheca', 28, 32, (g) => {
		g.fillStyle(C('#7f8a5c'), 1).fillEllipse(14, 30, 22, 6); // dead grass base
		g.lineStyle(2, C('#c2b489'), 1).lineBetween(9, 30, 8, 2); // stiff pale stem
		g.lineStyle(1.6, C('#ab9d74'), 1).lineBetween(19, 30, 21, 5); // second stem
		g.fillStyle(C('#8f8258'), 1).fillEllipse(20.8, 15, 11, 16); // case, shaded side
		g.fillStyle(C('#a89a6c'), 1).fillEllipse(20, 15, 10, 15); // hardened foam
		g.fillStyle(C('#c8bb8c'), 1).fillEllipse(18.6, 13, 5, 9); // lit side
		g.lineStyle(0.8, C('#7d7049'), 1);
		for (const y of [10, 13, 16, 19]) g.lineBetween(15.5, y, 24.5, y + 0.6); // ridged banding
	});

	// Milkweed aphid colony: one green stem crawling with a dense band of lemon
	// dots, with a lady beetle larva climbing up toward them.
	o('aphidcluster', 26, 32, (g) => {
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(13, 30, 18, 5); // leaf litter base
		g.fillStyle(C('#4f8a38'), 1).fillRect(11, 2, 4, 29); // milkweed stem
		g.fillStyle(C('#6da84e'), 1).fillRect(11, 2, 1.5, 29);
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(6, 9, 12, 5).fillEllipse(20, 20, 12, 5); // paired leaves
		g.fillStyle(C('#e8d24a'), 1); // dense band of aphids
		for (const [x, y] of [
			[9, 7],
			[13, 6],
			[16, 8],
			[9, 10],
			[12, 10],
			[16, 11],
			[10, 13],
			[14, 13],
			[17, 14],
			[9, 16],
			[13, 16],
			[16, 17],
			[11, 19],
			[15, 20],
			[12, 22],
		] as const)
			g.fillCircle(x, y, 1.5);
		g.fillStyle(C('#f7ea8e'), 1)
			.fillCircle(12.6, 5.6, 0.6)
			.fillCircle(9.6, 12.6, 0.6)
			.fillCircle(12.6, 15.6, 0.6)
			.fillCircle(14.6, 19.6, 0.6);
		g.lineStyle(0.5, C('#2b2415'), 1)
			.lineBetween(8, 8, 6.6, 9)
			.lineBetween(17, 12, 18.4, 13)
			.lineBetween(8, 17, 6.6, 18); // tiny black legs
		g.fillStyle(C('#e08030'), 1).fillEllipse(19, 26, 4, 7); // lady beetle larva
		g.fillStyle(C('#3b2e25'), 1).fillEllipse(19, 23.5, 3, 2.4);
	});

	// Milkweed rhizome bed: broad grey-green paddles on thick stems, dusty-pink
	// flower domes, and one pod split open spilling white silk.
	o('milkweedbed', 36, 32, (g) => {
		g.fillStyle(C('#4f6b3a'), 1).fillEllipse(18, 29, 32, 7); // rhizome bed
		g.lineStyle(2.4, C('#5d7a44'), 1).lineBetween(11, 29, 10, 8).lineBetween(24, 29, 26, 10); // thick stems
		g.fillStyle(C('#7f9273'), 1); // grey-green paddle leaves
		for (const [x, y, w, h] of [
			[5, 16, 13, 7],
			[17, 14, 13, 7],
			[4, 23, 12, 6],
			[31, 19, 10, 6],
			[20, 24, 13, 6],
		] as const)
			g.fillEllipse(x, y, w, h);
		g.fillStyle(C('#93a686'), 1).fillEllipse(5, 15, 8, 3).fillEllipse(18, 13, 8, 3); // leaf sheen
		g.fillStyle(C('#c98fa8'), 1).fillCircle(10, 7, 5).fillCircle(26, 9, 4.2); // dusty-pink flower balls
		g.fillStyle(C('#e0acc0'), 1).fillCircle(8.6, 5.6, 2).fillCircle(24.8, 7.8, 1.7);
		g.fillStyle(C('#8fa06a'), 1).fillEllipse(31, 12, 6, 11); // split seed pod
		g.fillStyle(C('#f4f0e6'), 1).fillEllipse(32, 9, 5, 6).fillCircle(34, 5, 2).fillCircle(30, 4, 1.6); // spilling silk
	});

	// Native thistle stand: three tall spiny stems with lavender shaving-brush
	// heads, one already blown to seed-down. Vertical and prickly.
	o('thistlestand', 32, 34, (g) => {
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(16, 31, 26, 7); // basal rosette
		g.lineStyle(2, C('#7d9078'), 1).lineBetween(8, 31, 7, 12).lineBetween(16, 31, 16, 7).lineBetween(24, 31, 25, 14); // grey-green stems
		g.lineStyle(0.8, C('#9aae94'), 1);
		for (const [x, y] of [
			[7, 16],
			[16, 12],
			[25, 18],
			[7, 22],
			[16, 19],
			[25, 24],
		] as const)
			g.lineBetween(x - 4, y + 2, x, y).lineBetween(x + 4, y + 3, x, y + 1); // spiny leaves
		g.fillStyle(C('#5f6b4a'), 1).fillEllipse(7, 12, 6, 5).fillEllipse(16, 7, 7, 6).fillEllipse(25, 14, 6, 5); // spiny bracts
		g.fillStyle(C('#9b6fa8'), 1).fillEllipse(7, 8, 7, 6).fillEllipse(16, 3, 8, 6); // shaving-brush blooms
		g.lineStyle(1, C('#b98ec4'), 1);
		for (const d of [-3, -1, 1, 3]) g.lineBetween(7 + d, 9, 7 + d * 1.5, 4).lineBetween(16 + d, 4, 16 + d * 1.5, 0);
		g.fillStyle(C('#f2efe6'), 1).fillCircle(25, 10, 5); // one head gone to seed-down
		g.fillStyle(0xffffff, 0.8).fillCircle(23.6, 8.6, 2.4);
	});

	// Pebble scrape: a ring of grey and cream stones on open gravel with four eggs
	// that match them almost exactly. Flat, stony, no green at all.
	o('pebblescrape', 34, 24, (g) => {
		g.fillStyle(C('#a29a8c'), 1).fillEllipse(17, 13, 33, 20); // open gravel
		g.fillStyle(C('#8e867a'), 1)
			.fillCircle(5, 6, 2.2)
			.fillCircle(28, 6, 2.2)
			.fillCircle(4, 19, 2)
			.fillCircle(31, 18, 2)
			.fillCircle(17, 3, 2);
		g.fillStyle(C('#7d766a'), 1).fillEllipse(17, 14, 21, 12); // scraped dish
		const peb = ['#b9b0a0', '#cfc8b6', '#9d968a', '#c4bca8'];
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * 6.283;
			g.fillStyle(C(peb[i % 4]), 1).fillCircle(17 + Math.cos(a) * 11, 14 + Math.sin(a) * 7, 2.4); // pebble rim
		}
		g.fillStyle(C('#c9c0a8'), 1)
			.fillEllipse(14, 13, 6, 4.6)
			.fillEllipse(20, 12, 6, 4.6)
			.fillEllipse(15, 17, 6, 4.6)
			.fillEllipse(21, 16, 6, 4.6); // cryptic eggs
		g.fillStyle(C('#6e6558'), 1);
		for (const [x, y] of [
			[13, 12],
			[15, 14],
			[21, 11],
			[19, 13],
			[14, 17],
			[16, 18],
			[22, 16],
			[20, 17],
		] as const)
			g.fillCircle(x, y, 0.6); // speckling
		g.fillStyle(0xffffff, 0.22).fillEllipse(13, 11.4, 3, 1.6);
	});

	// Prairie swale seedbed: a dished scrape holding a shine of standing water,
	// sown seed on the surface and a green fringe of seedlings round the rim.
	o('swaleseedbed', 34, 24, (g) => {
		g.lineStyle(1.4, C('#6f7a4a'), 1);
		for (let i = 0; i < 11; i++) g.lineBetween(2 + i * 3.1, 9 + (i % 2) * 3, 3 + i * 3.1, 1 + (i % 3) * 2); // fringe of seedlings
		g.fillStyle(C('#86994f'), 1);
		for (let i = 0; i < 11; i++) g.fillEllipse(3 + i * 3.1, 1 + (i % 3) * 2, 3.4, 1.8);
		g.fillStyle(C('#4a3a26'), 1).fillEllipse(17, 15, 32, 16); // dish of loosened soil
		g.fillStyle(C('#5e4a30'), 1).fillEllipse(17, 13, 28, 12);
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(17, 15, 23, 11); // wet hollow
		g.fillStyle(C('#5d8fa8'), 0.75).fillEllipse(17, 15, 18, 8); // standing water
		g.fillStyle(0xffffff, 0.32).fillEllipse(13, 13, 8, 2.4); // sky shine on it
		g.fillStyle(C('#c9b183'), 1);
		for (const [x, y] of [
			[10, 12],
			[14, 17],
			[20, 12],
			[23, 16],
			[17, 19],
			[12, 19],
			[24, 11],
		] as const)
			g.fillCircle(x, y, 0.9); // scattered seed
	});

	// Serviceberry thicket: several grey stems fanning from the ground with purple
	// berry clusters, and lower twigs bitten off blunt by browsing.
	o('serviceberry', 34, 34, (g) => {
		g.lineStyle(2.4, C('#9a968c'), 1)
			.lineBetween(17, 33, 9, 14)
			.lineBetween(17, 33, 17, 11)
			.lineBetween(17, 33, 25, 15); // multi-stemmed
		g.lineStyle(2, C('#8a8680'), 1).lineBetween(14, 26, 6, 24).lineBetween(20, 24, 27, 23); // lower twigs
		g.fillStyle(C('#b8b2a4'), 1).fillCircle(5.6, 24, 1.5).fillCircle(27.6, 23, 1.5); // blunt browse-clipped tips
		g.fillStyle(C('#5d7a4a'), 1); // small oval leaves
		for (const [x, y] of [
			[9, 12],
			[14, 9],
			[20, 10],
			[25, 13],
			[6, 17],
			[28, 17],
			[17, 6],
			[12, 16],
			[22, 17],
		] as const)
			g.fillEllipse(x, y, 7, 4);
		g.fillStyle(C('#749360'), 1).fillEllipse(13, 8, 6, 3.4).fillEllipse(24, 12, 6, 3.4); // sunlit leaves
		g.fillStyle(C('#4a3a6a'), 1).fillCircle(11, 15, 2.2).fillCircle(19, 13, 2.2).fillCircle(24, 19, 2.2); // berry clusters
		g.fillStyle(C('#6b53a0'), 1).fillCircle(10.2, 14.2, 1.1).fillCircle(18.2, 12.2, 1.1).fillCircle(23.2, 18.2, 1.1);
	});

	// Snake hibernaculum: a stone-lined shaft cut away in section, dropping past a
	// dashed frost line into a dark chamber with three snakes coiled inside.
	o('hibernaculum', 30, 34, (g) => {
		g.fillStyle(C('#79633f'), 1).fillRect(1, 4, 28, 30); // soil in section
		g.fillStyle(C('#9a958a'), 1); // stone lining
		for (const [x, y] of [
			[9, 6],
			[20, 6],
			[8, 11],
			[21, 11],
			[9, 16],
			[20, 16],
		] as const)
			g.fillCircle(x, y, 3.4);
		g.fillStyle(C('#241c12'), 1).fillRect(12, 4, 5, 15); // the shaft
		g.lineStyle(1, C('#a8c4d8'), 0.9);
		for (const x of [2, 7, 21, 26]) g.lineBetween(x, 13, x + 3, 13); // dashed frost line
		g.fillStyle(C('#1c150d'), 1).fillCircle(15, 25, 9); // chamber below the frost
		g.fillStyle(C('#3d6b4a'), 1).fillEllipse(15, 27, 15, 4).fillEllipse(13, 23, 12, 4).fillEllipse(17, 20, 10, 3.4); // coiled snakes
		g.lineStyle(0.8, C('#d9c86a'), 1).lineBetween(8, 27, 22, 27).lineBetween(7, 23, 19, 23).lineBetween(12, 20, 22, 20); // yellow stripes
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(15, 3, 22, 5); // capstone
	});

	// Squirrel burrow town: three craters joined by worn dirt paths, each with a
	// dark mouth, one animal standing bolt upright on the biggest mound.
	o('burrowtown', 36, 26, (g) => {
		g.fillStyle(C('#7f9450'), 1).fillEllipse(18, 15, 36, 22); // meadow floor
		g.lineStyle(3.4, C('#a89268'), 1).lineBetween(8, 19, 20, 21).lineBetween(20, 21, 30, 15); // worn paths between them
		const mounds: [number, number, number][] = [
			[8, 18, 8],
			[20, 20, 10],
			[30, 14, 7],
		];
		mounds.forEach(([x, y, r]) => {
			g.fillStyle(C('#8b7a5a'), 1).fillEllipse(x, y, r * 2, r); // crater rim
			g.fillStyle(C('#a3906c'), 1).fillEllipse(x, y - 1, r * 1.6, r * 0.6);
			g.fillStyle(C('#231a10'), 1).fillEllipse(x, y, r * 0.85, r * 0.45); // dark mouth
		});
		g.fillStyle(C('#9a7a4e'), 1).fillEllipse(24, 11, 3.4, 9).fillEllipse(20, 12, 5, 9); // tail and upright body
		g.fillStyle(C('#c4a878'), 1).fillEllipse(20, 13, 3, 5);
		g.fillStyle(C('#9a7a4e'), 1).fillCircle(20, 6, 2.6);
		g.fillStyle(C('#2b2118'), 1).fillCircle(19.2, 5.6, 0.7);
	});

	// Vole runways: seen from above — clipped channels winding through the grass
	// with seed husks and dark pellets dropped along them.
	o('volerunway', 36, 26, (g) => {
		// A soft patch of grass seen from above, not a tile — the old square fill
		// made it the only boxy thing on the map.
		g.fillStyle(C('#4f7a34'), 1).fillEllipse(18, 14, 34, 21); // grass patch
		g.fillEllipse(8, 9, 14, 11).fillEllipse(28, 18, 14, 11); // lumpy edges
		g.fillStyle(C('#5d8a3c'), 1);
		for (const [x, y] of [
			[7, 8],
			[14, 5],
			[22, 7],
			[29, 11],
			[10, 17],
			[19, 20],
			[27, 21],
			[15, 13],
		] as [number, number][])
			g.fillEllipse(x, y, 8, 5); // tufts
		g.lineStyle(4, C('#7d9a48'), 1);
		g.lineBetween(2, 10, 13, 12); // the runs worn through the grass
		g.lineBetween(13, 12, 18, 20);
		g.lineBetween(18, 20, 30, 17);
		g.lineBetween(13, 12, 25, 6);
		g.lineStyle(1.8, C('#b3c982'), 1);
		g.lineBetween(3, 10, 13, 12).lineBetween(13, 12, 18, 19).lineBetween(18, 19, 29, 17); // clipped, paler floor
		g.fillStyle(C('#3d5f28'), 1).fillCircle(13, 12, 2.2).fillCircle(18, 20, 2); // dark holes where they duck under
	});

	// Wet meadow sedge: a stiff triangular fountain in dark wet soil with water
	// standing round the base — darker and sharper-edged than the dryland `sedge`.
	o('sedgeclump', 32, 34, (g) => {
		g.fillStyle(C('#3a2e22'), 1).fillEllipse(16, 30, 30, 9); // dark damp soil
		g.fillStyle(C('#4a7a8a'), 0.65).fillEllipse(16, 31, 26, 6); // water pooling
		g.fillStyle(0xffffff, 0.25).fillEllipse(11, 30, 10, 2);
		g.fillStyle(C('#2f6b4e'), 1); // arching triangular blades
		for (let i = 0; i < 9; i++) {
			const s = i - 4;
			g.fillTriangle(16, 30, 16 + s * 3.6 - 1, 3 + Math.abs(s) * 5, 16 + s * 3.6 + 1.8, 4 + Math.abs(s) * 5);
		}
		g.fillStyle(C('#3f7a5c'), 1);
		for (const s of [-3, -1, 2])
			g.fillTriangle(16, 29, 16 + s * 4 - 1, 6 + Math.abs(s) * 4, 16 + s * 4 + 1.4, 7 + Math.abs(s) * 4); // lit blades
		g.lineStyle(1.4, C('#6b5a3c'), 1).lineBetween(16, 28, 27, 12).lineBetween(16, 28, 6, 14); // seed spikes leaning out
		g.fillStyle(C('#8a6b42'), 1).fillEllipse(27, 11, 3.4, 6).fillEllipse(6, 13, 3.4, 6);
		g.fillStyle(C('#a3854f'), 1).fillEllipse(26.4, 10, 1.6, 3).fillEllipse(5.4, 12, 1.6, 3);
	});

	// Rotting log crumble: bark split off a core of orange punky crumb, curls of
	// grey bark shed either side, pillbugs dotted through the soft wood.
	o('punkylog', 36, 24, (g) => {
		g.fillStyle(C('#3a2c1e'), 1).fillEllipse(18, 21, 34, 7); // damp soil beneath
		g.fillStyle(C('#8e887c'), 1).fillEllipse(18, 14, 32, 14); // grey bark shell
		g.fillStyle(C('#a89570'), 1).fillEllipse(18, 11, 30, 8);
		g.fillStyle(C('#b5651f'), 1).fillEllipse(19, 15, 24, 11); // split open to punky orange
		g.fillStyle(C('#d1832e'), 1).fillEllipse(18, 14, 20, 8);
		g.fillStyle(C('#e0a04f'), 1)
			.fillEllipse(11, 13, 4, 2.4)
			.fillEllipse(16, 16, 4, 2.4)
			.fillEllipse(22, 12, 4, 2.4)
			.fillEllipse(26, 15, 4, 2.4); // crumbling fibre
		g.fillStyle(C('#7c746a'), 1).fillEllipse(4, 12, 7, 10).fillEllipse(32, 13, 6, 10); // bark peeling in curls
		g.fillStyle(C('#9a9288'), 1).fillEllipse(4, 11, 4, 6).fillEllipse(32, 12, 3.4, 6);
		g.fillStyle(C('#5a6068'), 1)
			.fillEllipse(13, 17, 3, 2)
			.fillEllipse(21, 18, 3, 2)
			.fillEllipse(27, 13, 3, 2)
			.fillEllipse(9, 19, 3, 2); // slate-grey pillbugs
		g.fillStyle(C('#7d848d'), 1).fillEllipse(13, 16.4, 2, 0.9).fillEllipse(21, 17.4, 2, 0.9);
	});

	// Orb web: an actual spiral strung between two dry stems, with the bold white
	// zigzag stitched down the middle and the spider hanging head-down at the hub.
	o('orbweb', 34, 34, (g) => {
		g.fillStyle(C('#7f8a5c'), 1).fillEllipse(17, 32, 22, 5); // dry ground
		g.lineStyle(2, C('#b8a878'), 1).lineBetween(4, 33, 3, 3).lineBetween(30, 33, 31, 4); // two upright stems
		g.lineStyle(0.7, C('#cfd6c2'), 0.95);
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * 6.283;
			g.lineBetween(17, 16, 17 + Math.cos(a) * 14, 16 + Math.sin(a) * 13); // radials
		}
		for (const r of [4.5, 7.5, 10.5, 13]) {
			let px = 17 + r,
				py = 16;
			for (let i = 1; i <= 12; i++) {
				const a = (i / 12) * 6.283,
					nx = 17 + Math.cos(a) * r,
					ny = 16 + Math.sin(a) * r * 0.93;
				g.lineBetween(px, py, nx, ny); // spiral rings
				px = nx;
				py = ny;
			}
		}
		g.lineStyle(1.6, 0xffffff, 0.9);
		for (let i = 0; i < 5; i++)
			g.lineBetween(17 + (i % 2 ? 3 : -3), 17 + i * 2.6, 17 + (i % 2 ? -3 : 3), 19.6 + i * 2.6); // zigzag stabilimentum
		g.fillStyle(C('#cfd6c2'), 0.9).fillCircle(17, 16, 1.6); // empty hub where the lines meet
	});

	// Bat maternity roost: a long horizontal slot under weathered boards with a
	// warm glow inside — a wide letterbox, not a round hole.
	o('batroost', 34, 26, (g) => {
		g.fillStyle(C('#7e7a72'), 1).fillRect(2, 2, 30, 11); // weathered grey boards
		g.fillStyle(C('#8e8a80'), 1).fillRect(2, 2, 30, 3).fillRect(2, 8, 30, 2.4);
		g.lineStyle(0.8, C('#5e5a52'), 1)
			.lineBetween(2, 5, 32, 5)
			.lineBetween(2, 10.6, 32, 10.6)
			.lineBetween(12, 2, 12, 13); // plank seams
		g.fillStyle(C('#6b6760'), 1).fillRect(2, 13, 30, 3); // lintel over the slot
		g.fillStyle(C('#120d10'), 1).fillRect(4, 16, 26, 7); // narrow dark slot
		g.fillStyle(C('#4a3020'), 0.9).fillRect(5, 17, 24, 4); // warm brown glow inside
		g.fillStyle(C('#5a4a5e'), 1).fillEllipse(13, 19, 5, 7).fillEllipse(21, 19, 5, 7); // two folded bats
		g.fillStyle(C('#6e5c74'), 1).fillTriangle(11, 16, 15, 16, 12, 22).fillTriangle(19, 16, 23, 16, 20, 22); // one wing edge each
		g.fillStyle(C('#3d3242'), 1).fillTriangle(11.8, 17, 14.4, 17, 13.2, 14.2); // one ear showing
		g.fillStyle(C('#7e7a72'), 1).fillRect(2, 23, 30, 3); // sill below
	});

	// Barn loft nest box: red plank gable with a square loft opening, straw over
	// the sill and a pale heart face just inside the shadow.
	o('plankloft', 34, 32, (g) => {
		g.fillStyle(C('#8f3324'), 1).fillTriangle(1, 12, 17, 1, 33, 12); // gable peak
		g.fillStyle(C('#a83c2b'), 1).fillRect(3, 12, 28, 20); // weathered red planks
		g.lineStyle(0.9, C('#7a2a1d'), 1);
		for (const x of [8, 13, 18, 23, 28]) g.lineBetween(x, 12, x, 32); // plank seams
		g.fillStyle(C('#c05a44'), 0.45).fillRect(3, 12, 28, 2.4).fillRect(24, 12, 4, 20); // sun-bleached boards
		g.fillStyle(C('#6b2418'), 1).fillRect(9, 15, 16, 15); // opening frame
		g.fillStyle(C('#120e0a'), 1).fillRect(11, 17, 12, 13); // dark loft slot
		g.fillStyle(C('#8a6a3c'), 1).fillRect(9, 29, 16, 2); // sill
		g.lineStyle(1, C('#cbb87f'), 1).lineBetween(12, 29, 10, 32).lineBetween(17, 29, 19, 32).lineBetween(21, 30, 23, 32); // straw wisps
		g.fillStyle(C('#2a211a'), 1).fillRect(11, 17, 12, 3); // lintel shadow, so the slot reads as deep
		g.fillStyle(C('#3d3025'), 0.7).fillRect(11, 27, 12, 3); // dusty floor of the loft
	});

	// Flicker cavity snag: a silver standing stub with one neat round hole
	// chiselled in it and pale chips at the foot — a tall pillar, not a box.
	o('flickerhole', 26, 36, (g) => {
		g.fillStyle(C('#8a8378'), 1).fillRect(6, 2, 14, 31); // silver-grey snag
		g.fillStyle(C('#9c8a6e'), 1).fillRect(6, 2, 5, 31); // lit face
		g.lineStyle(0.8, C('#6e675c'), 1).lineBetween(11, 3, 12, 32).lineBetween(16, 2, 15, 33); // weather checks
		g.fillStyle(C('#6b5a44'), 1).fillTriangle(6, 3, 20, 3, 13, 0); // broken top
		g.fillStyle(C('#5a4a34'), 1).fillCircle(13, 13, 5.4); // chiselled rim
		g.fillStyle(C('#181209'), 1).fillCircle(13, 13, 4.4); // the cavity
		g.fillStyle(C('#9a8258'), 1).fillEllipse(13, 14, 7.4, 5.4); // small owl filling it
		g.fillStyle(C('#b39a6c'), 1).fillTriangle(10, 12, 12, 12, 10.2, 9).fillTriangle(16, 12, 14, 12, 15.8, 9); // ear tufts
		g.fillStyle(C('#f2e08a'), 1).fillCircle(11.4, 13.4, 1.3).fillCircle(14.6, 13.4, 1.3);
		g.fillStyle(C('#2b2118'), 1).fillCircle(11.4, 13.4, 0.7).fillCircle(14.6, 13.4, 0.7);
		g.fillStyle(C('#e0d2b0'), 1)
			.fillEllipse(5, 33, 4, 1.8)
			.fillEllipse(9, 34, 4, 1.8)
			.fillEllipse(14, 34, 4, 1.8)
			.fillEllipse(19, 33, 4, 1.8); // pale chips at the foot
	});

	// Coyote natal den: a single wide dark mouth in a brush-topped bank, with a
	// packed trail leading in and paw tracks fanning across the dirt apron.
	o('coyoteden', 36, 26, (g) => {
		g.fillStyle(C('#7a6444'), 1).fillEllipse(18, 13, 36, 20); // low earth bank
		g.fillStyle(C('#8a6f4a'), 1).fillEllipse(16, 10, 30, 13);
		g.fillStyle(C('#4a5c38'), 1).fillCircle(6, 5, 5).fillCircle(15, 3, 6).fillCircle(25, 5, 5).fillCircle(32, 7, 4); // brush cap
		g.fillStyle(C('#5e7346'), 1).fillCircle(13, 1, 3).fillCircle(27, 3, 2.6);
		g.fillStyle(C('#5c4830'), 1).fillEllipse(16, 17, 17, 13); // worn mouth rim
		g.fillStyle(C('#150f08'), 1).fillEllipse(16, 18, 13, 10); // wide dark den mouth
		g.fillStyle(C('#c0a87e'), 1).fillEllipse(18, 24, 32, 6); // bare dirt apron
		g.fillStyle(C('#ab9068'), 1).fillEllipse(16, 23, 10, 5); // packed trail leading in
		g.fillStyle(C('#6b573a'), 1);
		for (const [x, y] of [
			[7, 24],
			[11, 22],
			[25, 23],
			[29, 25],
			[22, 25],
		] as const) {
			g.fillEllipse(x, y, 2.6, 2);
			g.fillCircle(x - 1, y - 1.7, 0.5).fillCircle(x + 1, y - 1.7, 0.5); // paw tracks
		}
	});
	o('leafcorner', 32, 24, (g) => {
		g.fillStyle(C('#4a3d28'), 1).fillEllipse(16, 18, 30, 11); // damp shaded ground
		const leaves: [number, number, number, string][] = [
			[8, 16, -0.3, '#8a6a3a'],
			[16, 15, 0.2, '#a07f45'],
			[24, 17, -0.1, '#7a5c33'],
			[12, 11, 0.4, '#b08a4e'],
			[21, 10, -0.4, '#96773f'],
		];
		for (const [x, y, tilt, col] of leaves) {
			g.fillStyle(C(col), 1).fillEllipse(x, y, 12, 6); // fallen leaf
			g.lineStyle(0.7, C('#5f4a28'), 1).lineBetween(x - 5, y - tilt * 3, x + 5, y + tilt * 3); // midrib
		}
		g.fillStyle(C('#2f2a1e'), 1).fillEllipse(16, 21, 16, 4); // dark damp gap underneath
		g.fillStyle(C('#9fb38a'), 0.6).fillCircle(6, 20, 2).fillCircle(27, 20, 1.6); // moss on the edge
	});
	o('sedgetussock', 30, 28, (g) => {
		g.fillStyle(C('#3f4a2a'), 1).fillEllipse(15, 25, 24, 7); // damp shaded base
		g.fillStyle(C('#6f8340'), 1).fillEllipse(15, 21, 22, 10); // dense clump body
		g.lineStyle(1.6, C('#8fa551'), 1);
		for (const [x, tx] of [
			[7, 2],
			[10, 6],
			[13, 11],
			[16, 16],
			[19, 21],
			[22, 26],
		] as [number, number][])
			g.lineBetween(x, 22, tx, 4); // arching blades
		g.fillStyle(C('#2b2a1c'), 1).fillEllipse(15, 20, 7, 4); // the hidden nest cup
		g.fillStyle(C('#c3b06a'), 1).fillEllipse(5, 6, 5, 2.5).fillEllipse(24, 8, 5, 2.5); // seed heads
	});
	o('nativegrass', 36, 32, (g) => {
		g.fillStyle(C('#8f9a44'), 1).fillEllipse(18, 25, 34, 13); // yellower base than the starter grass
		g.lineStyle(2, C('#a8a94e'), 1);
		for (let i = 0; i < 7; i++) g.lineBetween(4 + i * 4.6, 27, 6 + i * 4.6, 6); // long blades
		g.lineStyle(1.6, C('#c4b45c'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 4.8, 26, 3 + i * 4.8, 2); // taller, paler blades leaning the other way
		g.fillStyle(C('#d8c87a'), 1);
		for (const [x, y] of [
			[5, 4],
			[14, 2],
			[24, 5],
			[32, 3],
		] as [number, number][])
			g.fillEllipse(x, y, 5, 2.4); // ripe seed heads
		g.fillStyle(C('#6f7f3a'), 1).fillEllipse(18, 27, 30, 5); // shaded root mat
	});
	o('buddhastatue', 28, 30, (g) => {
		g.fillStyle(C('#7d6440'), 1).fillEllipse(14, 28, 22, 5); // shadow on the base
		g.fillStyle(C('#b8935c'), 1).fillEllipse(14, 25, 20, 8); // crossed legs
		g.fillStyle(C('#c9a86a'), 1).fillEllipse(14, 19, 19, 14); // big round belly
		g.fillStyle(C('#d9bc86'), 0.7).fillEllipse(11, 17, 8, 6); // worn shine where it gets rubbed
		g.fillStyle(C('#c9a86a'), 1).fillEllipse(3, 13, 7, 10).fillEllipse(25, 13, 7, 10); // both arms thrown up
		g.fillCircle(14, 9, 7); // head
		g.fillStyle(C('#8a6c42'), 1).fillEllipse(14, 4, 11, 4); // topknot
		g.fillStyle(C('#5c4526'), 1);
		g.fillEllipse(11, 8.5, 3, 1.2).fillEllipse(17, 8.5, 3, 1.2); // happy closed eyes
		g.fillEllipse(14, 12, 7, 3); // wide grin
		g.fillStyle(C('#e8d3a0'), 1).fillEllipse(14, 11.2, 6, 1.2); // teeth line
	});
	o('luckytoad', 28, 24, (g) => {
		g.fillStyle(C('#c9a83f'), 1).fillEllipse(14, 21, 22, 6); // heap of coins
		g.fillStyle(C('#e0c25a'), 1);
		for (const [x, y] of [
			[7, 20],
			[13, 21],
			[20, 20],
			[10, 18],
			[17, 18],
		] as [number, number][])
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#7f9a48'), 1).fillEllipse(6, 16, 7, 5).fillEllipse(22, 16, 7, 5); // two front feet
		g.fillStyle(C('#9ab35c'), 1).fillEllipse(14, 12, 21, 14); // fat body
		g.fillStyle(C('#87a04d'), 1).fillCircle(8, 9, 3).fillCircle(20, 9, 3); // bulging eyes
		g.fillStyle(C('#f2efe2'), 1).fillCircle(8, 9, 1.8).fillCircle(20, 9, 1.8);
		g.fillStyle(C('#2e2418'), 1).fillCircle(8, 9, 0.9).fillCircle(20, 9, 0.9);
		g.fillStyle(C('#7f9a48'), 1).fillEllipse(14, 15, 11, 3); // wide mouth
		g.fillStyle(C('#e0c25a'), 1).fillCircle(14, 16, 3); // the coin held in it
		g.fillStyle(C('#b8973a'), 1).fillRect(13, 15, 2, 2);
	});

	// --- Water bodies, wet margins and tidal ground -------------------------
	// Every object that is (or sits in) water used to fall back on one of four
	// generic shapes — `pool`, `pond`, `mound`, `rocks` — so a vernal pool, a
	// beaver dam and a surge pool all drew the same blue ellipse. Each one below
	// gets its own silhouette, water colour and a couple of identifying details,
	// so they read apart at a glance without needing the label.

	// --- Freshwater pools and ponds ---
	// Fern Spring: a mossy seep, not open water — a dark trickle under arching fronds.
	o('springseep', 38, 32, (g) => {
		g.fillStyle(C('#4a6b48'), 1).fillEllipse(19, 22, 36, 18); // wet mossy ground
		g.fillStyle(C('#6aa884'), 1).fillEllipse(19, 22, 26, 11); // the seep face
		g.fillStyle(C('#2f4a3c'), 1).fillEllipse(20, 25, 14, 5); // dark seep mouth
		g.fillStyle(0xffffff, 0.35).fillEllipse(15, 21, 8, 2.5); // wet shine on it
		const fronds: [number, number, number, number][] = [
			[5, 25, 10, 5],
			[33, 25, 28, 4],
			[12, 26, 17, 9],
			[27, 26, 23, 10],
		];
		fronds.forEach(([x0, y0, x1, y1]) => {
			g.lineStyle(1.5, C('#4f7d3a'), 1).lineBetween(x0, y0, x1, y1); // the frond's midrib
			g.fillStyle(C('#6da84e'), 1);
			for (let i = 1; i <= 5; i++) {
				const t = i / 6;
				g.fillEllipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 6 - i * 0.7, 2); // pinnae down its length
			}
		});
	});
	// Shallow Water Pool: deliberately flat and wide, with a long pale wading
	// shelf down one side — the shape says "you could walk across this".
	o('shallowpool', 48, 26, (g) => {
		g.fillStyle(C('#c2b189'), 1).fillEllipse(24, 15, 48, 22); // sandy surround
		g.fillStyle(C('#a9cfe2'), 1).fillEllipse(24, 15, 40, 15); // the shallow shelf
		g.fillStyle(C('#7fb4d8'), 1).fillEllipse(27, 15, 26, 11); // slightly deeper middle
		g.lineStyle(1, 0xffffff, 0.55).strokeEllipse(27, 15, 16, 6).strokeEllipse(27, 15, 9, 3.4); // ripple rings
		g.fillStyle(C('#b5a074'), 1).fillEllipse(8, 16, 12, 6); // wadeable bar breaking the edge
	});
	// Lily Pool: pads packed edge to edge — the water barely shows.
	o('lilypool', 42, 34, (g) => {
		g.fillStyle(C('#3f5f4a'), 1).fillEllipse(21, 18, 42, 30); // shaded water beneath
		g.fillStyle(C('#2e4a3c'), 1).fillEllipse(21, 20, 32, 20); // cool dark underside
		const pads: [number, number, number][] = [
			[10, 12, 7],
			[22, 9, 6.5],
			[32, 14, 6],
			[8, 24, 6.5],
			[19, 22, 7],
			[31, 25, 6],
			[25, 16, 5],
		];
		pads.forEach(([x, y, r], i) => {
			g.fillStyle(C(['#6fae86', '#5f9d76', '#7cbb90'][i % 3]), 1).fillCircle(x, y, r);
			g.fillStyle(C('#4a7d5e'), 1).fillTriangle(x, y, x + r, y - 1.6, x + r, y + 1.6); // pad notch
		});
		g.fillStyle(C('#f4f0e2'), 1).fillCircle(19, 22, 3.2); // one open bloom
		g.fillStyle(C('#e8c85a'), 1).fillCircle(19, 22, 1.3);
	});
	// Snowmelt Pool: stone-kerbed, hard-edged and glacier-pale. Deliberately
	// unstocked — no fish, no plants, just cold clean water.
	o('snowmeltpool', 40, 30, (g) => {
		g.fillStyle(C('#8d9298'), 1).fillEllipse(20, 17, 40, 26); // stone rim
		const kerb: [number, number, number][] = [
			[5, 13, 4],
			[13, 6, 4.5],
			[24, 5, 4],
			[34, 12, 4.5],
			[36, 22, 4],
			[6, 23, 4],
		];
		kerb.forEach(([x, y, r], i) => g.fillStyle(C(['#a8adb2', '#93989e', '#b8bcc0'][i % 3]), 1).fillCircle(x, y, r));
		g.fillStyle(C('#8fd0e8'), 1).fillEllipse(20, 17, 26, 15); // meltwater
		g.fillStyle(C('#c8ecf6'), 0.8).fillEllipse(20, 15, 18, 8); // pale cold shine
		g.fillStyle(0xffffff, 0.9).fillEllipse(9, 8, 9, 4); // a last patch of snow on the rim
	});
	// Clearwater Shallows: the point is that you can see the bottom — stones and
	// submerged weed read straight through the water.
	o('clearshallows', 42, 28, (g) => {
		g.fillStyle(C('#9aa88e'), 1).fillEllipse(21, 16, 42, 24); // silty surround
		g.fillStyle(C('#8fc7d6'), 0.9).fillEllipse(21, 16, 34, 17); // clear water
		g.fillStyle(C('#7f8a72'), 0.85); // bottom stones showing through
		for (const [x, y, r] of [
			[12, 19, 2.6],
			[20, 21, 2],
			[28, 18, 2.4],
			[24, 13, 1.8],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.lineStyle(1.4, C('#4f8f66'), 0.85); // submerged plants standing in the light
		g.lineBetween(14, 21, 13, 11).lineBetween(22, 22, 24, 10).lineBetween(29, 20, 30, 12);
		g.fillStyle(0xffffff, 0.45).fillEllipse(16, 11, 10, 3); // surface glint
	});
	// Stable Silt Shoal: a broad tan shelf sitting just under the surface — more
	// sediment than water, and flat enough to read as a shoal rather than a pool.
	o('siltshoal', 46, 24, (g) => {
		g.fillStyle(C('#7fa8b8'), 0.8).fillEllipse(23, 13, 46, 20); // slow water over it
		g.fillStyle(C('#b9ae90'), 1).fillEllipse(23, 14, 36, 14); // the shoal itself
		g.fillStyle(C('#cbc0a2'), 1).fillEllipse(20, 12, 24, 8); // sunlit crown, nearly breaking surface
		g.fillStyle(C('#a09678'), 0.8).fillEllipse(33, 16, 12, 5).fillEllipse(11, 16, 10, 4); // settled edges
		g.fillStyle(0xffffff, 0.3).fillEllipse(18, 10, 12, 2.4);
	});
	// Fishless Vernal Pool: a drying ring is the whole identity — cracked mud
	// collar around a shrinking centre.
	o('vernalpool', 40, 30, (g) => {
		g.fillStyle(C('#a89a7c'), 1).fillEllipse(20, 17, 40, 26); // dried outer ring
		g.lineStyle(1, C('#7f7258'), 1); // shrinkage cracks in the exposed collar
		g.lineBetween(4, 12, 10, 15).lineBetween(36, 14, 29, 16).lineBetween(20, 3, 20, 8).lineBetween(9, 26, 14, 22);
		g.fillStyle(C('#c2b596'), 1).fillEllipse(20, 17, 30, 18); // damp last-wet band
		g.fillStyle(C('#7fb2a8'), 1).fillEllipse(20, 17, 20, 11); // what water is left
		g.fillStyle(C('#9ccdc2'), 0.8).fillEllipse(18, 15, 12, 5);
		g.fillStyle(C('#5f8f86'), 1).fillCircle(24, 19, 1.6).fillCircle(21, 20, 1.3); // no fish — just egg mass
	});
	// Overwater Thicket: dark deep water with willow leaning right out over it
	// from one side. The overhang, not the water, is the sprite.
	o('overwaterthicket', 44, 34, (g) => {
		g.fillStyle(C('#2f4a52'), 1).fillEllipse(22, 24, 44, 20); // deep still water
		g.fillStyle(C('#3d5f68'), 1).fillEllipse(22, 22, 34, 12);
		g.fillStyle(C('#4f7a45'), 1).fillEllipse(11, 10, 26, 16).fillEllipse(28, 8, 22, 14); // leaning canopy
		g.fillStyle(C('#3f6238'), 1).fillEllipse(15, 15, 24, 9); // shaded underside
		g.lineStyle(2, C('#6a5a3a'), 1).lineBetween(2, 4, 16, 14).lineBetween(4, 10, 20, 17); // branches out over water
		g.fillStyle(C('#5f9d50'), 1).fillEllipse(33, 14, 12, 6); // fringe hanging above the surface
		g.fillStyle(0x000000, 0.25).fillEllipse(20, 26, 26, 6); // shadow thrown on the water
	});
	// Dammed Pond: the stick dam and the drowned standing snags are what tell it
	// apart from open marsh.
	o('beaverpond', 48, 36, (g) => {
		g.fillStyle(C('#6a7a58'), 1).fillEllipse(24, 20, 48, 30); // wet surround
		g.fillStyle(C('#4f7d93'), 1).fillEllipse(24, 18, 40, 22); // deep permanent water
		g.fillStyle(C('#67a0b5'), 0.7).fillEllipse(20, 15, 22, 8);
		g.fillStyle(C('#8a8270'), 1).fillRect(14, 4, 3, 16).fillRect(30, 6, 2.6, 14); // drowned snags still standing
		g.fillStyle(C('#6f6857'), 1).fillRect(14, 4, 1.2, 16).fillRect(30, 6, 1, 14);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 26, 40, 7, 3); // the dam
		g.lineStyle(1.4, C('#5d4128'), 1); // criss-crossed sticks in it
		g.lineBetween(7, 33, 14, 26).lineBetween(15, 33, 22, 26).lineBetween(23, 33, 30, 26).lineBetween(31, 33, 38, 26);
		g.fillStyle(C('#4a3826'), 1).fillEllipse(24, 33, 36, 4); // packed mud face
	});
	// Still Water Cove: framed tight by reeds on both sides, mirror-flat, with a
	// couple of stems drifting on it.
	o('stillcove', 40, 32, (g) => {
		g.fillStyle(C('#5f7d45'), 1).fillEllipse(20, 16, 40, 30); // the reed bank hemming it in
		g.fillStyle(C('#6f9450'), 1).fillEllipse(20, 13, 38, 20);
		g.fillStyle(C('#93c0cf'), 1).fillEllipse(21, 21, 30, 18); // the pocket of open water
		g.fillStyle(C('#b6d8e2'), 1).fillEllipse(21, 19, 24, 11); // sky on it, unbroken
		g.fillStyle(0xffffff, 0.4).fillEllipse(17, 17, 14, 3); // glass-flat glint
		g.lineStyle(2, C('#7fa05a'), 1); // reeds standing round the back of it
		g.lineBetween(4, 20, 3, 6).lineBetween(9, 15, 8, 3).lineBetween(31, 15, 33, 4).lineBetween(36, 20, 37, 7);
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(3, 5, 2.2, 5).fillEllipse(33, 4, 2.2, 5); // a couple of old heads
		g.fillStyle(C('#8a9a5e'), 1).fillEllipse(17, 24, 9, 1.6).fillEllipse(25, 27, 7, 1.4); // stems drifting on it
	});
	// Browsed Shallows: murky green, chest-deep, and thick with cropped-off stems.
	o('browsedshallows', 42, 30, (g) => {
		g.fillStyle(C('#3f5636'), 1).fillEllipse(21, 19, 42, 22); // soft dark bottom
		g.fillStyle(C('#4f6b48'), 1).fillEllipse(21, 17, 34, 16); // murky water
		g.fillStyle(C('#5f7d56'), 0.7).fillEllipse(19, 15, 22, 7);
		g.lineStyle(2, C('#6f8a4e'), 1); // stems, all cropped at different heights
		g.lineBetween(7, 22, 7, 12).lineBetween(12, 23, 12, 6).lineBetween(17, 22, 17, 14);
		g.lineBetween(24, 23, 24, 5).lineBetween(29, 22, 29, 13).lineBetween(34, 21, 34, 9);
		g.fillStyle(C('#a8b578'), 1); // pale blunt cut ends
		for (const [x, y] of [
			[7, 12],
			[17, 14],
			[29, 13],
			[34, 9],
		] as [number, number][])
			g.fillEllipse(x, y, 2.4, 1.2);
	});
	// Woodland Pool: deep shade, cold blue-grey water, soft muddy walk-down edge.
	o('woodlandpool', 44, 32, (g) => {
		g.fillStyle(C('#5a4a34'), 1).fillEllipse(22, 19, 44, 24); // damp forest floor
		g.fillStyle(C('#6b5a3e'), 1).fillEllipse(9, 24, 20, 9); // muddy walk-down edge
		g.fillStyle(C('#4f86a8'), 1).fillEllipse(23, 17, 34, 18); // cold spring-fed water
		g.fillStyle(C('#2f5468'), 1).fillEllipse(26, 18, 20, 10); // deep shaded middle
		g.fillStyle(C('#6fa8c4'), 0.6).fillEllipse(17, 13, 14, 5); // the one shaft of light on it
		g.fillStyle(C('#3a2e20'), 0.5).fillEllipse(30, 8, 22, 7); // canopy shadow across the top
	});
	// Dug Channel: a narrow worked channel running off across the sprite, with a
	// branch floating down it — nothing like an open pool.
	o('beavercanal', 44, 28, (g) => {
		g.fillStyle(C('#6a7a52'), 1).fillEllipse(22, 14, 44, 26); // marsh ground
		g.fillStyle(C('#7f8f5e'), 1).fillEllipse(11, 8, 20, 11).fillEllipse(33, 20, 20, 11); // drier hummocks
		g.fillStyle(C('#4a5a3a'), 1).fillTriangle(6, 25, 14, 3, 22, 3).fillTriangle(6, 25, 22, 3, 15, 26); // cut banks
		g.fillStyle(C('#5f8fa0'), 1).fillTriangle(8, 24, 15, 4, 19, 4).fillTriangle(8, 24, 19, 4, 13, 25); // the channel
		g.fillStyle(C('#84b2c0'), 0.75).fillTriangle(10, 23, 16, 6, 18, 6).fillTriangle(10, 23, 18, 6, 13, 24);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(11, 12, 9, 2.6, 1.3); // a branch floating down it
		g.fillStyle(C('#5d4128'), 1).fillCircle(11.5, 13.3, 1.5);
	});

	// --- Wet margins: mud, meadow edge, submerged beds ---
	// Mud Bank: a shaped, shovel-cut slope of bare damp earth going into water.
	o('mudbank', 42, 28, (g) => {
		g.fillStyle(C('#5f7f8a'), 1).fillEllipse(21, 23, 42, 10); // water at the foot of it
		g.fillStyle(C('#7a6a52'), 1).fillTriangle(0, 4, 42, 10, 42, 22).fillTriangle(0, 4, 42, 22, 0, 22); // sloped bank
		g.fillStyle(C('#94836a'), 1).fillTriangle(0, 4, 42, 10, 42, 13).fillTriangle(0, 4, 42, 13, 0, 8); // sunlit face
		g.fillStyle(C('#5a4c3a'), 1).fillEllipse(14, 20, 16, 4).fillEllipse(32, 21, 12, 3); // wet dark waterline
		g.fillStyle(C('#4f4133'), 1); // dug-in prints and scrapes
		for (const [x, y] of [
			[9, 12],
			[17, 15],
			[26, 13],
			[34, 16],
		] as [number, number][])
			g.fillEllipse(x, y, 3.4, 2);
	});
	// Sunlit Mudflat: flat, bright, cracked and shining — germination ground, not
	// a bank. Seedlings just breaking through.
	o('mudflat', 44, 24, (g) => {
		g.fillStyle(C('#6f8f9a'), 1).fillEllipse(38, 12, 16, 22); // water pulled back to one side
		g.fillStyle(C('#8a6f4e'), 1).fillEllipse(20, 13, 40, 20); // exposed flat
		g.fillStyle(C('#a3855f'), 1).fillEllipse(19, 11, 32, 13); // sun-warmed crust
		g.lineStyle(0.9, C('#6b5540'), 1); // drying cracks
		g.lineBetween(6, 8, 13, 12).lineBetween(13, 12, 11, 19).lineBetween(13, 12, 22, 10);
		g.lineBetween(22, 10, 28, 15).lineBetween(22, 10, 24, 4).lineBetween(28, 15, 34, 13);
		g.fillStyle(0xffffff, 0.28).fillEllipse(16, 9, 14, 3); // wet shine
		g.lineStyle(1.2, C('#7fae5a'), 1); // cattail seedlings taking the light
		g.lineBetween(10, 17, 10, 11).lineBetween(18, 18, 18, 12).lineBetween(27, 18, 27, 13);
	});
	// Wet Meadow Edge: half damp grass, half marsh — the sprite is the gradient.
	o('wetmeadow', 44, 28, (g) => {
		g.fillStyle(C('#86a35a'), 1).fillEllipse(22, 14, 44, 26); // damp grassy band
		g.fillStyle(C('#9ab469'), 1).fillEllipse(13, 9, 26, 12); // drier upslope side
		g.fillStyle(C('#6f8f52'), 1).fillEllipse(23, 19, 38, 14); // greener, wetter downslope
		g.fillStyle(C('#5f8a7a'), 1).fillEllipse(30, 23, 26, 8); // marsh water creeping in
		g.fillStyle(C('#7fae9c'), 0.7).fillEllipse(32, 22, 18, 4);
		g.lineStyle(1.6, C('#7f9a4a'), 1); // grass thinning out as it gets wetter
		for (let i = 0; i < 8; i++) g.lineBetween(6 + i * 4.4, 20 - (i % 3), 5 + i * 4.4, 8 + (i % 4) * 3);
		g.fillStyle(C('#b9c98a'), 1);
		for (let i = 0; i < 4; i++) g.fillEllipse(7 + i * 8, 8 + (i % 2) * 3, 3, 1.5); // seed heads
	});
	// Submerged Spawning Slab: a flat plate lying just under the surface with a
	// clear dark gap beneath it — a ceiling, not a floor.
	o('spawningslab', 40, 26, (g) => {
		g.fillStyle(C('#5f8a96'), 1).fillEllipse(20, 14, 40, 22); // water over everything
		g.fillStyle(C('#4a6b72'), 1).fillEllipse(20, 19, 34, 10); // dark silt below
		g.fillStyle(C('#2f4046'), 1).fillEllipse(20, 17, 26, 6); // the gap underneath
		g.fillStyle(C('#6e7d78'), 1).fillRoundedRect(5, 9, 30, 6, 2); // the slab
		g.fillStyle(C('#8b9a94'), 1).fillRoundedRect(5, 9, 30, 2.6, 1.2); // scrubbed-clean upper face
		g.fillStyle(C('#5b6a66'), 1).fillRect(7, 15, 3, 2).fillRect(30, 15, 3, 2); // props holding it clear
		g.fillStyle(0xffffff, 0.35).fillEllipse(14, 7, 12, 2.4); // surface just above it
	});
	// Wild Celery Bed: long ribbon leaves streaming downcurrent underwater.
	o('celerybed', 40, 30, (g) => {
		g.fillStyle(C('#6fa8b8'), 0.85).fillEllipse(20, 17, 40, 26); // lit shallow water
		g.fillStyle(C('#8a7f62'), 1).fillEllipse(20, 26, 34, 8); // silt bed they root in
		g.lineStyle(2.2, C('#4f8f66'), 1); // ribbons all streaming the same way
		for (let i = 0; i < 7; i++) {
			const x = 4 + i * 5.4;
			g.lineBetween(x, 26, x + 7, 8 + (i % 3) * 3);
		}
		g.lineStyle(1.4, C('#7fbf8a'), 0.9);
		for (let i = 0; i < 5; i++) {
			const x = 7 + i * 6;
			g.lineBetween(x, 26, x + 9, 6 + (i % 2) * 4);
		}
		g.fillStyle(0xffffff, 0.3).fillEllipse(15, 7, 16, 3); // light reaching the bottom
	});
	// Cattail Root Shallows: shallow water over a mat of pale swollen rootstocks —
	// the food is under the surface, so that is what shows.
	o('cattailroots', 42, 28, (g) => {
		g.fillStyle(C('#5f7a4a'), 1).fillEllipse(21, 16, 42, 24); // muddy shallows
		g.fillStyle(C('#6d8a4a'), 0.85).fillEllipse(21, 14, 36, 15); // thin water over the mat
		g.fillStyle(C('#c2bc8a'), 1); // packed starchy rootstocks
		for (const [x, y, w] of [
			[10, 20, 14],
			[24, 21, 15],
			[16, 17, 13],
			[31, 18, 12],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 5);
		g.lineStyle(1.2, C('#a89f6a'), 1); // the runners tying them together
		g.lineBetween(5, 20, 36, 19).lineBetween(8, 17, 34, 18);
		g.lineStyle(2, C('#6f9450'), 1); // a few blades still up out of the water
		g.lineBetween(9, 15, 8, 3).lineBetween(30, 15, 32, 4);
	});
	// Flooded Reed Clump: a tight stiff stand in ankle-deep water — narrow and
	// vertical where the reed bed is broad.
	o('floodedreeds', 30, 40, (g) => {
		g.fillStyle(C('#5f8a8a'), 1).fillEllipse(15, 34, 28, 10); // shallow standing water
		g.fillStyle(C('#87b0b0'), 0.7).fillEllipse(13, 33, 18, 4);
		g.lineStyle(2.4, C('#7f8f4e'), 1); // stiff stems, tight together
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 3.6, 35, 5 + i * 3.8, 4 + (i % 3) * 4);
		g.lineStyle(1.6, C('#98a85e'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(8 + i * 3.4, 34, 9 + i * 3.6, 6 + (i % 2) * 5);
		g.fillStyle(C('#8a6a3a'), 1); // a couple of old cattail heads
		g.fillEllipse(8, 7, 2.6, 6).fillEllipse(20, 5, 2.6, 6);
		g.fillStyle(C('#5f7a3a'), 1).fillEllipse(15, 34, 16, 3); // stems meeting the waterline
	});

	// --- Things standing in, or lying on, the water ---
	// Marsh Log: one end up in the sun, the other lost under the surface.
	o('marshlog', 44, 26, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(30, 16, 30, 18); // water it slides into
		g.fillStyle(C('#4a6b78'), 0.9).fillEllipse(34, 18, 20, 9);
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(2, 8, 34, 10, 5); // the trunk
		g.fillStyle(C('#8a6d4a'), 1).fillRoundedRect(2, 8, 30, 4, 2); // sunlit upper side
		g.fillStyle(C('#9a7a52'), 1).fillEllipse(4, 13, 7, 10); // raised cut end
		g.fillStyle(C('#5d4128'), 1).fillEllipse(4, 13, 3.5, 5.5);
		g.fillStyle(C('#3f5f4a'), 1).fillEllipse(16, 8, 12, 4); // moss along the top
		g.fillStyle(C('#4a6b78'), 0.55).fillRoundedRect(28, 12, 12, 7, 3); // submerged end going dark
		g.fillStyle(0xffffff, 0.25).fillEllipse(30, 12, 10, 1.6);
	});
	// Dead Tree Over Water: the drop below the cavity is the whole point.
	o('floodedsnag', 30, 44, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(15, 39, 30, 12); // water at the base
		g.fillStyle(C('#87b0c0'), 0.6).fillEllipse(12, 38, 16, 4);
		g.fillStyle(C('#7e7458'), 1).fillRect(11, 2, 8, 38); // dead trunk standing in it
		g.fillStyle(C('#5f5844'), 1).fillRect(11, 2, 3, 38); // shadow side
		g.fillStyle(C('#948a6a'), 1).fillRect(16, 2, 2, 38); // bleached side
		g.fillStyle(C('#8a8068'), 1).fillRect(3, 9, 8, 2.4).fillRect(19, 15, 8, 2.2); // broken limbs
		g.fillStyle(C('#2a2318'), 1).fillEllipse(15, 11, 7, 8); // the cavity, high up
		g.fillStyle(C('#4a4030'), 1).fillEllipse(15, 8.5, 7, 2.6); // worn lip
		g.fillStyle(0x000000, 0.2).fillEllipse(15, 39, 12, 3); // reflection under it
	});
	// Litter Drift: a submerged raft of dead leaves furred over with decay.
	o('detritusdrift', 42, 26, (g) => {
		g.fillStyle(C('#5f7f80'), 1).fillEllipse(21, 14, 42, 22); // tea-coloured water
		g.fillStyle(C('#6b5a3e'), 1).fillEllipse(21, 16, 34, 14); // the sunken raft
		g.fillStyle(C('#836f4c'), 1); // individual sodden leaves and stems, lying every which way
		for (const [x, y, w, h] of [
			[10, 14, 13, 4],
			[19, 12, 6, 9],
			[28, 15, 12, 5],
			[15, 19, 5, 8],
			[26, 20, 11, 4],
		] as [number, number, number, number][])
			g.fillEllipse(x, y, w, h);
		g.fillStyle(C('#c2c4ae'), 0.7); // the fur of fungi and bacteria on it
		for (const [x, y] of [
			[12, 12],
			[22, 14],
			[17, 18],
			[29, 17],
		] as [number, number][])
			g.fillEllipse(x, y, 6, 2.4);
		g.fillStyle(0xffffff, 0.22).fillEllipse(16, 8, 18, 2.4); // surface above it
	});
	// Crane Nest Mound: a heap of piled marsh plants standing clear of open water
	// — anything coming at it has to wade.
	o('cranenest', 42, 30, (g) => {
		g.fillStyle(C('#5f8a96'), 1).fillEllipse(21, 20, 42, 20); // open shallow water all round
		g.fillStyle(C('#82adb8'), 0.7).fillEllipse(18, 18, 26, 7);
		g.fillStyle(C('#6b6a42'), 1).fillEllipse(21, 18, 30, 14); // waterlogged base of the heap
		g.fillStyle(C('#8a8557'), 1).fillEllipse(21, 14, 28, 13); // the built mound
		g.fillStyle(C('#a3a06a'), 1).fillEllipse(21, 12, 22, 9); // dry top standing clear
		g.lineStyle(1.2, C('#6f6c44'), 1); // piled stems
		g.lineBetween(8, 15, 21, 10).lineBetween(34, 15, 21, 10).lineBetween(10, 11, 30, 13).lineBetween(12, 17, 32, 12);
		g.fillStyle(C('#c9bf9a'), 1).fillEllipse(21, 11, 12, 5); // the shallow cup
		g.fillStyle(C('#c2b28a'), 1).fillEllipse(19, 11, 4.5, 3.4).fillEllipse(24, 11.5, 4.5, 3.4); // two big eggs
	});
	// Hidden Reed Platform: living reeds bent down and woven, barely a hand above
	// the water, walled in on every side.
	o('reedplatform', 36, 34, (g) => {
		g.fillStyle(C('#4a6b62'), 1).fillEllipse(18, 26, 36, 16); // dark water inside the stand
		g.fillStyle(C('#7a7a44'), 1).fillEllipse(18, 22, 24, 9); // woven platform
		g.fillStyle(C('#98974f'), 1).fillEllipse(18, 21, 20, 6);
		g.lineStyle(1.4, C('#8a8a4a'), 1); // the weave
		g.lineBetween(8, 21, 28, 22).lineBetween(8, 23, 28, 20).lineBetween(12, 18, 14, 25).lineBetween(22, 18, 20, 25);
		g.lineStyle(2.4, C('#6f8a3f'), 1); // the stand closing over it
		for (const x of [2, 5, 9, 27, 31, 34]) g.lineBetween(x, 32, x - 1 + (x % 3), 2 + (x % 4) * 3);
		g.lineStyle(1.8, C('#8aa050'), 1);
		for (const x of [7, 13, 24, 29]) g.lineBetween(x, 30, x + 1, 4 + (x % 3) * 4);
	});

	// --- Bank dens at the waterline ---
	// Crayfish Burrow Bank: saturated clay riddled with finger-wide holes, each
	// capped with the little turret of pellets they push out.
	o('crayfishbank', 40, 28, (g) => {
		g.fillStyle(C('#5f7f74'), 1).fillEllipse(20, 24, 40, 8); // drawn-down water at the foot
		g.fillStyle(C('#9c7b52'), 1).fillRoundedRect(0, 4, 40, 20, 3); // wet clay bank
		g.fillStyle(C('#b0916a'), 1).fillRoundedRect(0, 4, 40, 7, 3); // drier top
		g.fillStyle(C('#2f2418'), 1); // the tunnels
		for (const [x, y] of [
			[8, 16],
			[19, 14],
			[29, 17],
			[34, 12],
		] as [number, number][])
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#8a6a44'), 1); // chimneys of stacked mud pellets
		for (const [x, y] of [
			[8, 16],
			[19, 14],
			[29, 17],
		] as [number, number][]) {
			g.fillEllipse(x, y - 3.4, 6.5, 3);
			g.fillEllipse(x, y - 5.4, 5, 2.6);
		}
		g.fillStyle(C('#7f6448'), 1).fillEllipse(20, 23, 34, 3); // wet dark waterline
	});
	// Cut Bank Burrow: a sheer earth wall rising straight out of the water, with a
	// row of tunnel mouths along it.
	o('cutbank', 40, 30, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(20, 25, 40, 10); // water right at its foot
		g.fillStyle(C('#87b0c0'), 0.6).fillEllipse(18, 23, 28, 3.4);
		g.fillStyle(C('#a08258'), 1).fillRoundedRect(2, 5, 36, 19, 3); // sheer vertical face
		g.fillStyle(C('#b89a70'), 1).fillRoundedRect(2, 5, 36, 5, 2.5); // lip
		g.fillStyle(C('#8a6f4a'), 1).fillRect(2, 13, 36, 1.6).fillRect(2, 19, 36, 1.4); // soil strata
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(11, 5, 16, 5).fillEllipse(29, 4, 18, 5); // turf overhanging the top
		g.fillStyle(C('#2a2016'), 1); // burrow mouths in a row
		for (const x of [8, 17, 26, 33]) g.fillEllipse(x, 16, 5, 4.4);
		g.fillStyle(C('#8a7050'), 0.9);
		for (const x of [8, 17, 26, 33]) g.fillEllipse(x, 18.6, 5, 1.6); // worn sills
	});
	// Old Bank Den: entrance below the waterline, chamber dry above it — the
	// sprite cuts away to show both.
	o('muskratden', 42, 30, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(21, 24, 42, 12); // water level cutting across
		g.fillStyle(C('#7d6647'), 1).fillRoundedRect(2, 3, 38, 22, 4); // the bank, shown in section
		g.fillStyle(C('#94794f'), 1).fillRoundedRect(2, 3, 38, 7, 3.5); // dry upper soil
		g.fillStyle(C('#5f8494'), 0.85).fillRect(2, 18, 38, 7); // waterline across the cut
		g.fillStyle(C('#7fa8b8'), 0.5).fillRect(2, 18, 38, 1.6);
		g.fillStyle(C('#5f4c34'), 1).fillEllipse(27, 23, 20, 9); // submerged bank shoulder
		g.fillStyle(C('#241c12'), 1).fillEllipse(30, 22, 7, 6); // entrance, below the waterline
		g.fillStyle(C('#241c12'), 1).fillEllipse(15, 13, 15, 9); // dry chamber above it
		g.fillStyle(C('#3d3120'), 1).fillEllipse(15, 15, 13, 4.5); // bedding on the floor
		g.lineStyle(2.4, C('#241c12'), 1).lineBetween(27, 20, 19, 15); // the run between them
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(13, 3, 20, 5).fillEllipse(32, 3, 15, 4); // turf on top
	});
	// River Bank Den: roomier than the muskrat's, with a worn slide down into the
	// water beside the underwater door.
	o('otterden', 44, 30, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(22, 24, 44, 12); // the river
		g.fillStyle(C('#6b5540'), 1).fillRoundedRect(2, 3, 40, 22, 4); // bank in section
		g.fillStyle(C('#836a50'), 1).fillRoundedRect(2, 3, 40, 7, 3.5);
		g.fillStyle(C('#5f8494'), 0.85).fillRect(2, 19, 40, 6); // waterline across the cut
		g.fillStyle(C('#87b0c0'), 0.5).fillRect(2, 19, 40, 1.6);
		g.fillStyle(C('#9a8464'), 1).fillTriangle(30, 5, 41, 5, 37, 21); // the polished mud slide
		g.fillStyle(C('#b09a76'), 1).fillTriangle(32, 6, 39, 6, 36, 20);
		g.fillStyle(C('#241c12'), 1).fillEllipse(21, 23, 9, 7); // underwater entrance
		g.fillStyle(C('#241c12'), 1).fillRoundedRect(6, 9, 19, 10, 4); // big dry chamber
		g.fillStyle(C('#43382a'), 1).fillEllipse(15, 16, 15, 4); // dry bedding
		g.lineStyle(3, C('#241c12'), 1).lineBetween(20, 21, 15, 17); // run up from the water
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(12, 3, 20, 5); // turf lip
	});

	// --- Forest and alpine water ---
	// Crayfish Shallows: ankle-deep, all loose flat rock, dark gaps under every one.
	o('crayfishshallows', 42, 26, (g) => {
		g.fillStyle(C('#5f7d84'), 1).fillEllipse(21, 14, 42, 22); // thin cold water
		g.fillStyle(C('#8aa8ae'), 0.6).fillEllipse(18, 11, 26, 7); // glare off the surface
		g.fillStyle(C('#7f8a80'), 1).fillEllipse(21, 20, 36, 9); // gravel bed
		const slabs: [number, number, number, number][] = [
			[9, 15, 13, 6],
			[22, 13, 14, 6],
			[33, 17, 12, 5],
			[16, 20, 12, 5],
			[28, 20, 11, 5],
		];
		slabs.forEach(([x, y, w, h], i) => {
			g.fillStyle(C('#2f3c40'), 1).fillEllipse(x, y + 2, w, h * 0.7); // the dark gap under it
			g.fillStyle(C(['#93a09a', '#87938e', '#a3aea6'][i % 3]), 1).fillEllipse(x, y, w, h); // the flat rock
		});
	});
	// Elk Wallow: churned bare mud with a heavy body-print dish in the middle,
	// holding a shine of water.
	o('elkwallow', 42, 28, (g) => {
		g.fillStyle(C('#5f6b46'), 1).fillEllipse(21, 15, 42, 24); // forest opening
		g.fillStyle(C('#6b5a45'), 1).fillEllipse(21, 16, 34, 18); // churned bare ring
		g.fillStyle(C('#54452f'), 1).fillEllipse(21, 17, 24, 12); // the dish
		g.fillStyle(C('#7f8a76'), 1).fillEllipse(21, 18, 16, 7); // puddle left in it
		g.fillStyle(0xffffff, 0.35).fillEllipse(18, 17, 8, 2.4);
		g.fillStyle(C('#3f3423'), 1); // split hoof marks around the rim
		for (const [x, y] of [
			[7, 12],
			[33, 13],
			[12, 24],
			[31, 24],
		] as [number, number][]) {
			g.fillEllipse(x - 1, y, 2, 3.2);
			g.fillEllipse(x + 1.4, y, 2, 3.2);
		}
		g.fillStyle(C('#7f6a4a'), 1).fillEllipse(24, 9, 12, 4); // thrown-up mud
	});
	// Splash Ledge: a shelf tucked behind a falling thread of meltwater, moss on
	// permanently wet rock.
	o('splashledge', 34, 40, (g) => {
		g.fillStyle(C('#4a505a'), 1).fillCircle(11, 12, 13).fillCircle(9, 28, 12).fillCircle(20, 6, 10); // broken cliff behind
		g.fillStyle(C('#5b6169'), 1).fillCircle(9, 15, 10).fillCircle(7, 30, 9); // lit rock faces
		g.fillStyle(C('#39404a'), 1).fillEllipse(13, 22, 22, 9); // the recess it sits in
		g.fillStyle(C('#2a3038'), 1).fillEllipse(14, 27, 22, 7); // dark undercut below the shelf
		g.fillStyle(C('#6f8894'), 1).fillEllipse(14, 23, 24, 7); // the wet shelf jutting out
		g.fillStyle(C('#8aa4ae'), 1).fillEllipse(13, 21, 20, 4); // shine along its top
		g.fillStyle(C('#4f7d54'), 1).fillEllipse(7, 22, 10, 4).fillEllipse(19, 23, 9, 3.4); // moss, permanently damp
		g.fillStyle(C('#6fae6a'), 1).fillCircle(6, 21, 2).fillCircle(10, 22, 1.6).fillCircle(20, 22, 1.8);
		g.fillStyle(C('#c8e6f0'), 0.9).fillTriangle(24, 0, 29, 0, 27, 30); // the thread, tapering as it falls
		g.fillStyle(0xffffff, 0.7).fillTriangle(25.5, 0, 27.5, 0, 26.5, 26);
		g.fillStyle(0xffffff, 0.55).fillEllipse(26, 33, 14, 6); // where it lands
		g.fillStyle(0xffffff, 0.4)
			.fillCircle(21, 31, 1.8)
			.fillCircle(31, 30, 1.5)
			.fillCircle(23, 36, 1.3)
			.fillCircle(30, 36, 1.1);
	});

	// --- Coastal water ---
	// Sunlit Surge Pool: deep, open to the sky, with white surge pouring in over
	// the rim from the rocks above.
	o('surgepool', 42, 34, (g) => {
		g.fillStyle(C('#6b7076'), 1).fillEllipse(21, 18, 42, 30); // rock bowl
		g.fillStyle(C('#2e8f7d'), 1).fillEllipse(21, 19, 32, 21); // deep sunlit pool
		g.fillStyle(C('#1d5f56'), 1).fillEllipse(23, 22, 20, 11); // the deep middle
		g.fillStyle(C('#4fc0a4'), 0.8).fillEllipse(16, 14, 16, 7); // full sun reaching in
		g.fillStyle(0xffffff, 0.85).fillEllipse(30, 8, 16, 6); // surge spilling over the rim
		g.fillStyle(0xffffff, 0.6).fillEllipse(27, 12, 11, 4).fillCircle(34, 12, 1.6).fillCircle(24, 10, 1.3);
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(5, 10, 10, 8).fillEllipse(38, 24, 9, 8); // rim boulders
	});
	// Upwelling Current: cold deep water rising — a pale plankton plume lifting
	// through dark blue.
	o('upwelling', 36, 40, (g) => {
		g.fillStyle(C('#17384a'), 1).fillEllipse(18, 21, 34, 40); // deep water column
		g.fillStyle(C('#2f6b86'), 1).fillEllipse(18, 25, 28, 28); // the rising body of it
		g.fillStyle(C('#4a92a8'), 0.9).fillEllipse(18, 20, 21, 22);
		g.fillStyle(C('#7fc0c4'), 0.75).fillEllipse(18, 13, 15, 15); // plankton-rich crown
		g.lineStyle(2, C('#a8dcd8'), 0.75); // upward streamlines
		g.lineBetween(11, 33, 12, 12).lineBetween(18, 36, 18, 8).lineBetween(25, 33, 24, 12);
		g.fillStyle(C('#c8ece2'), 0.9); // the fine stuff it carries up
		for (const [x, y] of [
			[13, 16],
			[18, 10],
			[23, 15],
			[15, 23],
			[22, 25],
			[18, 19],
		] as [number, number][])
			g.fillCircle(x, y, 1.3);
	});
	// Nearshore Spawning Shallows: barely moving, warm on top, thick with drift.
	o('spawnshallows', 44, 26, (g) => {
		g.fillStyle(C('#3b7ea1'), 1).fillEllipse(22, 13, 44, 24); // quiet water
		g.fillStyle(C('#5fa3bf'), 1).fillEllipse(22, 7, 40, 10); // warm surface layer
		g.fillStyle(C('#7fc0d4'), 0.6).fillEllipse(17, 5, 24, 4);
		g.fillStyle(C('#2f6480'), 1).fillEllipse(22, 21, 34, 7); // still bottom
		g.fillStyle(C('#cfe4d8'), 0.85); // drifting food, hanging exactly where it is
		for (const [x, y] of [
			[9, 12],
			[15, 8],
			[21, 14],
			[27, 10],
			[33, 14],
			[12, 17],
			[25, 18],
			[35, 9],
			[18, 19],
			[31, 19],
		] as [number, number][])
			g.fillCircle(x, y, 1.2);
		g.lineStyle(1, 0xffffff, 0.3).lineBetween(6, 4, 38, 5); // no chop at all
	});
	// Swash-Zone Runnel: the sliding wet strip a wave drains back down, with a
	// thin lace of foam at its edge.
	o('swashrunnel', 44, 26, (g) => {
		g.fillStyle(C('#dfd0a8'), 1).fillEllipse(22, 13, 44, 24); // sand
		g.fillStyle(C('#c2ae82'), 1).fillEllipse(11, 5, 20, 6); // dry sand above the reach
		g.fillStyle(C('#a9c4cf'), 1).fillTriangle(1, 11, 43, 5, 43, 19).fillTriangle(1, 11, 43, 19, 1, 23); // wet sliding strip
		g.fillStyle(C('#c2d8e0'), 1).fillTriangle(1, 13, 43, 7, 43, 12).fillTriangle(1, 13, 43, 12, 1, 18); // sheeting water
		g.fillStyle(0xffffff, 0.85); // foam lace along the leading edge
		for (let i = 0; i < 8; i++) g.fillCircle(4 + i * 5, 12 - i * 0.65, 1.6 + (i % 2) * 0.7);
		g.fillStyle(0xffffff, 0.4).fillEllipse(22, 10, 28, 2);
		g.fillStyle(C('#8fa8b2'), 0.8).fillEllipse(29, 20, 17, 4); // draining back
	});
	// Breaking Surf Line: a wave standing up and toppling — the only sprite here
	// with real vertical motion in it.
	o('surfline', 46, 30, (g) => {
		g.fillStyle(C('#2f7f8c'), 1).fillEllipse(23, 19, 46, 22); // open water
		g.fillStyle(C('#1f5f6b'), 1).fillEllipse(23, 24, 40, 10); // trough
		g.fillStyle(C('#3f9aa8'), 1).fillTriangle(4, 24, 26, 4, 33, 24); // the wave standing up
		g.fillStyle(C('#5fbcc4'), 1).fillTriangle(11, 24, 26, 7, 30, 24); // lit face
		g.fillStyle(0xffffff, 0.9).fillEllipse(27, 6, 14, 6); // the lip curling over
		g.fillStyle(0xffffff, 0.75).fillEllipse(33, 12, 12, 7).fillEllipse(37, 18, 10, 6); // white water tumbling down
		g.fillStyle(0xffffff, 0.5).fillEllipse(39, 23, 11, 5);
		g.fillStyle(0xffffff, 0.35).fillCircle(31, 4, 1.6).fillCircle(36, 8, 1.3).fillCircle(24, 3, 1.2); // spray
	});
	// Deep Canyon Edge: the shelf stops and it goes blue-black. All the drama is
	// in the drop-off line.
	o('deepedge', 44, 32, (g) => {
		g.fillStyle(C('#12384f'), 1).fillEllipse(22, 16, 44, 32); // the deep
		g.fillStyle(C('#08202f'), 1).fillEllipse(29, 22, 30, 20); // colder, blacker below
		g.fillStyle(C('#4a8fa8'), 1).fillTriangle(2, 7, 21, 7, 4, 25); // sunlit shelf
		g.fillStyle(C('#6fb0c2'), 1).fillTriangle(3, 7, 17, 7, 4, 18);
		g.fillStyle(C('#7f8f80'), 1).fillTriangle(1, 5, 22, 9, 2, 13); // rock lip of the shelf
		g.fillStyle(C('#5f6f62'), 1).fillTriangle(15, 9, 22, 9, 17, 19); // the wall falling away
		g.fillStyle(0x000000, 0.35).fillTriangle(17, 11, 24, 11, 21, 29); // shadow down the face
		g.fillStyle(C('#8fd0e0'), 0.35).fillEllipse(9, 4, 14, 3); // light, only up top
	});
	// Sheltered Rafting Cove: flat as a pond, with loose kelp fronds lying across
	// the surface and a point of rock holding the swell off.
	o('raftingcove', 44, 30, (g) => {
		g.fillStyle(C('#356b7d'), 1).fillEllipse(22, 18, 44, 26); // calm water in the lee
		g.fillStyle(C('#4f8a9c'), 1).fillEllipse(20, 14, 32, 12); // glassy top
		g.fillStyle(C('#767f86'), 1).fillEllipse(3, 8, 20, 18); // the sheltering point
		g.fillStyle(C('#8e938a'), 1).fillEllipse(4, 5, 14, 10);
		g.fillStyle(C('#6a7a3a'), 1); // kelp lying loose across the surface
		for (const [x, y, w] of [
			[16, 12, 18],
			[26, 18, 20],
			[20, 23, 16],
			[33, 13, 14],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.6);
		g.fillStyle(C('#8a9a4e'), 1).fillCircle(24, 12, 1.8).fillCircle(35, 18, 1.6).fillCircle(14, 22, 1.5); // floats
		g.fillStyle(0xffffff, 0.25).fillEllipse(26, 9, 16, 2);
	});
	// Sandbar Roost: flat, dry, and ringed with water on every side.
	o('sandbar', 44, 24, (g) => {
		g.fillStyle(C('#6f9aa8'), 1).fillEllipse(22, 12, 44, 22); // water all round it
		g.fillStyle(C('#8ab4c0'), 0.6).fillEllipse(11, 5, 20, 4).fillEllipse(33, 19, 18, 4);
		g.fillStyle(C('#b5a882'), 1).fillEllipse(22, 12, 36, 12); // wet fringe of the bar
		g.fillStyle(C('#ccbf9d'), 1).fillEllipse(22, 11, 29, 9); // dry flat top
		g.fillStyle(C('#ddd2b2'), 1).fillEllipse(20, 10, 20, 5); // bleached crown
		g.lineStyle(1, C('#b8ab88'), 1).strokeEllipse(22, 12, 33, 10.5); // the tide line around it
		g.fillStyle(C('#a89a76'), 1).fillCircle(14, 12, 1.2).fillCircle(28, 11, 1.1).fillCircle(21, 13, 1); // shell grit
	});
	// Offshore Nesting Island: a stack standing in deep water, no way up from below.
	o('offshoreislet', 34, 40, (g) => {
		g.fillStyle(C('#3b7ea1'), 1).fillEllipse(17, 33, 34, 14); // deep water round it
		g.fillStyle(C('#2f6480'), 1).fillEllipse(17, 36, 32, 10);
		g.fillStyle(C('#9b9384'), 1).fillTriangle(4, 32, 17, 4, 30, 32); // the stack
		g.fillStyle(C('#b0a898'), 1).fillTriangle(10, 32, 17, 5, 20, 32); // lit face
		g.fillStyle(C('#6f6a60'), 1).fillTriangle(20, 32, 17, 6, 30, 32); // shadowed face
		g.fillStyle(C('#8a8478'), 1).fillRect(6, 30, 22, 3); // sheer waterline base
		g.fillStyle(0xffffff, 0.75).fillEllipse(17, 7, 12, 3.4); // guano cap on top
		g.fillStyle(0xffffff, 0.4).fillEllipse(12, 14, 6, 2).fillEllipse(23, 18, 5, 1.8); // streaks down the face
		g.fillStyle(0xffffff, 0.55).fillEllipse(6, 31, 9, 3).fillEllipse(28, 31, 8, 3); // wash at the base
	});

	// --- Tidal rock ---
	// Low-Tide Rock Bench: a broad flat shelf with a thin film of water still on
	// it and weed fringing the edge.
	o('lowtidebench', 46, 24, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(23, 19, 46, 10); // water waiting to come back
		g.fillStyle(C('#6d7a80'), 1).fillRoundedRect(1, 4, 44, 14, 2); // bedrock bench
		g.fillStyle(C('#87939a'), 1).fillRoundedRect(1, 4, 44, 5, 2); // exposed dry-ish top
		g.fillStyle(C('#9aa8ae'), 0.6).fillEllipse(16, 8, 24, 4); // film of water still standing
		g.fillStyle(C('#4a5f3a'), 1); // weed fringe along the seaward lip
		for (let i = 0; i < 8; i++) g.fillEllipse(3 + i * 6, 17, 7, 3.4);
		g.fillStyle(C('#6a7a3a'), 1);
		for (let i = 0; i < 7; i++) g.fillEllipse(6 + i * 6, 18, 5, 2.4);
		g.fillStyle(C('#4f6b74'), 1).fillEllipse(30, 11, 9, 4).fillEllipse(11, 12, 7, 3); // little pools left on it
	});
	// Urchin Pit: smooth ground-out bowls in solid rock, one occupied.
	o('urchinpit', 38, 26, (g) => {
		g.fillStyle(C('#7d848a'), 1).fillRoundedRect(1, 2, 36, 22, 3); // solid rock
		g.fillStyle(C('#8f969a'), 1).fillRoundedRect(1, 2, 36, 7, 3);
		g.fillStyle(C('#5f6a70'), 1).fillCircle(11, 12, 6).fillCircle(26, 10, 5.5).fillCircle(19, 20, 5); // ground-out pits
		g.fillStyle(C('#48545a'), 1).fillCircle(11, 13, 4.4).fillCircle(26, 11, 4).fillCircle(19, 21, 3.6); // each a smooth bowl
		g.fillStyle(C('#6b4a8a'), 1).fillCircle(11, 12.5, 3.4); // the urchin still in one
		g.lineStyle(1.2, C('#4f3468'), 1);
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			g.lineBetween(11 + Math.cos(a) * 3, 12.5 + Math.sin(a) * 3, 11 + Math.cos(a) * 5.6, 12.5 + Math.sin(a) * 5.6);
		}
		g.fillStyle(C('#8a63a8'), 1).fillCircle(10, 11.5, 1.2);
	});
	// Barnacle Crust: the sprite is texture, not shape — a hard white stipple
	// welded across the upper rock.
	o('barnaclerock', 38, 26, (g) => {
		g.fillStyle(C('#7d7367'), 1).fillEllipse(19, 16, 38, 20); // the rock
		g.fillStyle(C('#8f8578'), 1).fillEllipse(17, 13, 30, 12);
		g.fillStyle(C('#d8d2c4'), 1).fillEllipse(18, 12, 32, 12); // the crust across the top of it
		g.fillStyle(C('#eae5d8'), 1);
		const cones: [number, number, number][] = [
			[7, 12, 2.6],
			[12, 9, 2.2],
			[17, 12, 2.8],
			[22, 8, 2.4],
			[27, 12, 2.6],
			[31, 10, 2],
			[10, 15, 2.2],
			[20, 16, 2.4],
			[25, 15, 2],
			[14, 6, 1.8],
			[29, 6, 1.8],
			[5, 9, 1.8],
		];
		cones.forEach(([x, y, r]) => g.fillCircle(x, y, r));
		g.fillStyle(C('#b0a898'), 1);
		cones.forEach(([x, y, r]) => g.fillEllipse(x, y, r * 0.7, r * 0.5)); // the little plate opening in each
	});
	// Splash-Zone Crevice: the driest tier of the shore — dark cracks, sun-bleached
	// rock, and only a fleck or two of spray.
	o('splashcrevice', 36, 30, (g) => {
		g.fillStyle(C('#7d7367'), 1).fillRoundedRect(1, 1, 34, 28, 2); // dry upper rock
		g.fillStyle(C('#948a7c'), 1).fillRoundedRect(1, 1, 34, 9, 2); // sun-bleached top
		g.fillStyle(C('#a89e8e'), 0.6).fillEllipse(14, 5, 20, 4);
		g.lineStyle(2.6, C('#3a352c'), 1); // the cracks
		g.lineBetween(8, 4, 11, 27).lineBetween(20, 2, 17, 28).lineBetween(28, 6, 31, 26);
		g.lineStyle(1.2, C('#57503f'), 1).lineBetween(11, 14, 17, 16).lineBetween(17, 20, 28, 18);
		g.fillStyle(C('#c9c2b0'), 1).fillEllipse(24, 12, 6, 3).fillEllipse(5, 20, 5, 2.4); // salt crust
		g.fillStyle(0xffffff, 0.55).fillCircle(30, 3, 1.4).fillCircle(13, 2, 1.1).fillCircle(23, 6, 0.9); // the only water it gets
	});
	// Shell-Dropping Rock: a hard flat anvil standing clear of the sand, littered
	// with what has already been broken on it.
	o('shellrock', 40, 28, (g) => {
		g.fillStyle(C('#d8c9a4'), 1).fillEllipse(20, 23, 40, 10); // sand around it
		g.fillStyle(C('#9a958c'), 1).fillRoundedRect(5, 8, 30, 15, 3); // the boulder
		g.fillStyle(C('#b0aba0'), 1).fillRoundedRect(5, 8, 30, 6, 3); // hard flat top
		g.fillStyle(C('#7f7a72'), 1).fillEllipse(20, 23, 30, 4); // shadowed base
		g.fillStyle(C('#efe6d2'), 1); // cracked shells on the anvil
		g.fillEllipse(12, 10, 7, 3.4).fillEllipse(24, 9, 6, 3).fillEllipse(30, 12, 5, 2.6);
		g.lineStyle(0.9, C('#b5a88e'), 1).lineBetween(9, 10, 15, 10).lineBetween(22, 9, 27, 9);
		g.fillStyle(C('#e2d6bc'), 1).fillEllipse(6, 24, 5, 2.4).fillEllipse(34, 25, 4.5, 2.2); // fragments fallen off
	});
	// High-Tide Roost: raised, dry at the top of the tide, water all the way round.
	o('roostrock', 36, 30, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(18, 21, 36, 18); // high water on every side
		g.fillStyle(C('#7fa8b8'), 0.6).fillEllipse(8, 18, 16, 4).fillEllipse(28, 26, 16, 4);
		g.fillStyle(C('#8d8a84'), 1).fillEllipse(18, 15, 26, 20); // the rock
		g.fillStyle(C('#a09d96'), 1).fillEllipse(16, 10, 20, 11); // dry crown standing clear
		g.fillStyle(C('#6f6d68'), 1).fillEllipse(24, 18, 14, 9); // shadow side
		g.fillStyle(0xffffff, 0.7).fillEllipse(16, 7, 15, 4); // whitewash where they stand
		g.fillStyle(0xffffff, 0.4).fillEllipse(11, 12, 5, 2).fillEllipse(22, 13, 4, 1.8);
		g.fillStyle(0xffffff, 0.5).fillEllipse(18, 25, 26, 3); // wash line around the base
	});
	// Seal Haul-Out Rocks: low, gently sloping, easy to climb straight out onto —
	// and a wide quiet buffer marked around them.
	o('haulout', 46, 28, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(23, 20, 46, 16); // water
		g.lineStyle(1, 0xffffff, 0.3).strokeEllipse(23, 16, 44, 22); // the buffer, kept quiet
		g.fillStyle(C('#c2b48e'), 1).fillEllipse(34, 17, 24, 9); // sand spit
		g.fillStyle(C('#767f86'), 1).fillEllipse(12, 15, 22, 12).fillEllipse(25, 16, 18, 10); // low rocks
		g.fillStyle(C('#8b939a'), 1).fillEllipse(11, 12, 17, 7).fillEllipse(25, 13, 13, 6); // dry sloping backs
		g.fillStyle(C('#5f676d'), 1).fillEllipse(16, 19, 20, 5); // wet lower slope, easy to climb
		g.fillStyle(0xffffff, 0.3).fillEllipse(20, 21, 26, 2.4); // waterline
		g.fillStyle(C('#a3a8ad'), 0.8).fillEllipse(7, 11, 8, 3); // worn smooth on top
	});
	// Surge-Swept Rock Face: open rock with the swell dragging past it — motion
	// streaks are the identifying detail.
	o('surgeface', 36, 34, (g) => {
		g.fillStyle(C('#5b6169'), 1).fillRoundedRect(2, 1, 32, 32, 2); // the face
		g.fillStyle(C('#6e747c'), 1).fillRoundedRect(2, 1, 32, 10, 2);
		g.fillStyle(C('#474d54'), 1).fillRoundedRect(2, 22, 32, 11, 2); // wet lower band
		g.lineStyle(1.6, C('#3d434a'), 1).lineBetween(9, 2, 7, 32).lineBetween(21, 1, 24, 33); // seams in the rock
		g.fillStyle(0xffffff, 0.65); // water tearing past, all one direction
		for (const [x, y, w] of [
			[10, 8, 18],
			[22, 15, 20],
			[13, 21, 22],
			[24, 27, 16],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.4);
		g.fillStyle(0xffffff, 0.35).fillEllipse(18, 12, 14, 1.6).fillEllipse(16, 30, 20, 2);
		g.fillStyle(0xffffff, 0.5).fillCircle(31, 6, 1.6).fillCircle(6, 17, 1.3).fillCircle(29, 22, 1.2); // spray coming off it
	});

	// --- Seabed and living beds ---
	// Muddy Seabed: soft deep sediment so thick with amphipod tubes it is more
	// animal than mud.
	o('amphipodbed', 42, 26, (g) => {
		g.fillStyle(C('#3f6b7a'), 1).fillEllipse(21, 8, 42, 16); // dim water above
		g.fillStyle(C('#8a7f6a'), 1).fillEllipse(21, 18, 42, 18); // deep soft sediment
		g.fillStyle(C('#9c9078'), 1).fillEllipse(20, 14, 34, 9);
		g.fillStyle(C('#b5aa90'), 1); // the tube stubble
		for (let i = 0; i < 14; i++) {
			const x = 4 + i * 2.5,
				h = 3 + (i % 4) * 1.6;
			g.fillRect(x, 13 - h, 1.4, h);
		}
		g.fillStyle(C('#cfc6ae'), 1);
		for (let i = 0; i < 14; i++) g.fillCircle(4.7 + i * 2.5, 13 - (3 + (i % 4) * 1.6), 0.9); // tube mouths
		g.fillStyle(C('#6f6552'), 0.7).fillEllipse(21, 22, 32, 5); // undisturbed depth below
	});
	// Rippled Sand: even combed ridges, and nothing else — the pattern is the object.
	o('rippledsand', 44, 24, (g) => {
		g.fillStyle(C('#8fbccf'), 0.5).fillEllipse(22, 12, 44, 24); // clean water over it
		g.fillStyle(C('#d8c9a4'), 1).fillEllipse(22, 13, 42, 20); // sand
		g.fillStyle(C('#c2b28a'), 1); // the troughs
		for (let i = 0; i < 6; i++) g.fillEllipse(22, 6 + i * 3.2, 40 - Math.abs(i - 2.5) * 4, 1.8);
		g.fillStyle(C('#eadfbe'), 1); // the sunlit crests
		for (let i = 0; i < 6; i++) g.fillEllipse(22, 4.9 + i * 3.2, 38 - Math.abs(i - 2.5) * 4, 1.1);
		g.fillStyle(0xffffff, 0.22).fillEllipse(15, 8, 20, 3); // light banding across them
	});
	// Subtidal Rubble Flat: loose cobble under water with drifted material
	// settling into the gaps.
	o('rubbleflat', 42, 26, (g) => {
		g.fillStyle(C('#4f7f8f'), 0.85).fillEllipse(21, 13, 42, 26); // water
		g.fillStyle(C('#5f6b62'), 1).fillEllipse(21, 18, 40, 14); // dark gaps between the stones
		const stones: [number, number, number, number][] = [
			[8, 14, 9, 7],
			[18, 12, 10, 7],
			[29, 15, 9, 7],
			[36, 12, 7, 6],
			[12, 21, 10, 6],
			[24, 22, 11, 6],
			[33, 21, 8, 5],
		];
		stones.forEach(([x, y, w, h], i) =>
			g.fillStyle(C(['#7a7f75', '#8b9086', '#6e7369'][i % 3]), 1).fillEllipse(x, y, w, h),
		);
		g.fillStyle(C('#6b6a4a'), 0.85); // drift settling down into it
		g.fillEllipse(13, 17, 8, 2.4).fillEllipse(27, 18, 9, 2.2).fillEllipse(21, 24, 10, 2);
		g.fillStyle(0xffffff, 0.18).fillEllipse(18, 4, 22, 3);
	});
	// Sheltered Sand-Gravel Flat: firm, even, mixed grain, and conspicuously
	// undisturbed — a diggable flat rather than a rubble one.
	o('gravelflat', 44, 24, (g) => {
		g.fillStyle(C('#6f9aab'), 0.7).fillEllipse(22, 6, 42, 11); // calm water in the lee
		g.fillStyle(C('#b5ac8e'), 1).fillEllipse(22, 14, 44, 19); // the flat
		g.fillStyle(C('#c4bc9e'), 1).fillEllipse(21, 11, 34, 8); // firm sunlit surface
		g.fillStyle(C('#9a927a'), 1); // mixed gravel worked evenly through it
		for (let i = 0; i < 20; i++) g.fillCircle(6 + ((i * 7) % 33), 9 + ((i * 5) % 12), 1.1 + (i % 3) * 0.4);
		g.fillStyle(C('#d2cbb0'), 1);
		for (let i = 0; i < 13; i++) g.fillCircle(8 + ((i * 11) % 30), 12 + ((i * 3) % 9), 0.9);
		g.fillStyle(C('#8f8770'), 0.7).fillEllipse(22, 20, 32, 4); // settled, going nowhere
	});
	// Sheltered Cobble Field: the underside is the habitat, so one stone is turned
	// over to show it.
	o('cobblefield', 42, 26, (g) => {
		g.fillStyle(C('#a8a48f'), 1).fillEllipse(21, 13, 42, 24); // damp shore
		const cobbles: [number, number, number, number][] = [
			[9, 9, 11, 8],
			[21, 7, 10, 7],
			[32, 10, 10, 8],
			[14, 18, 11, 8],
			[34, 19, 9, 7],
		];
		cobbles.forEach(([x, y, w, h], i) => {
			g.fillStyle(C('#5f5a50'), 0.8).fillEllipse(x, y + 3, w, h * 0.6); // dark and damp underneath
			g.fillStyle(C(['#8b8578', '#9a948a', '#7c776c'][i % 3]), 1).fillEllipse(x, y, w, h);
			g.fillStyle(0xffffff, 0.18).fillEllipse(x - 2, y - 2, w * 0.5, h * 0.35);
		});
		g.fillStyle(C('#3f3a32'), 1).fillEllipse(26, 19, 12, 8); // one flipped over
		g.fillStyle(C('#4f4a40'), 1).fillEllipse(26, 19, 9, 5.5); // the dark damp face
		g.fillStyle(C('#6b6a4a'), 1).fillCircle(24, 18, 1.2).fillCircle(28, 20, 1).fillCircle(26, 21, 0.9); // what lives on it
	});
	// Empty Shell Drift: wave-sorted, heaped up by size in a rock hollow.
	o('shelldrift', 40, 26, (g) => {
		g.fillStyle(C('#8b8578'), 1).fillEllipse(20, 18, 40, 18); // the rock hollow holding them
		g.fillStyle(C('#6f6a60'), 1).fillEllipse(20, 20, 32, 11);
		g.fillStyle(C('#b8a68b'), 1).fillEllipse(20, 16, 30, 12); // the heap
		g.fillStyle(C('#d8cbb2'), 1); // big shells settled at the bottom
		g.fillEllipse(10, 19, 9, 4.5).fillEllipse(21, 20, 10, 4.5).fillEllipse(30, 19, 8, 4);
		g.fillStyle(C('#e8ddc6'), 1); // medium
		g.fillEllipse(13, 15, 6.5, 3.4).fillEllipse(22, 14, 7, 3.4).fillEllipse(29, 15, 6, 3);
		g.fillStyle(C('#f2ebd8'), 1); // small on top, sorted
		g.fillEllipse(16, 11, 4.5, 2.4).fillEllipse(23, 10, 4, 2.2).fillEllipse(27, 12, 3.6, 2);
		g.lineStyle(0.8, C('#b0a58c'), 1).lineBetween(7, 19, 13, 19).lineBetween(18, 20, 25, 20);
	});
	// Mussel Bed: a dense blue-black band, shells packed upright two and three deep.
	o('musselbed', 40, 26, (g) => {
		g.fillStyle(C('#7d7367'), 1).fillRoundedRect(1, 1, 38, 24, 3); // mid-zone rock
		g.fillStyle(C('#8f8578'), 1).fillRoundedRect(1, 1, 38, 6, 3);
		g.fillStyle(C('#3c3a4a'), 1).fillRoundedRect(2, 6, 36, 17, 2); // the packed band
		g.fillStyle(C('#4a4759'), 1); // individual shells standing on end
		for (let i = 0; i < 12; i++) g.fillEllipse(4 + i * 3, 11 + (i % 3) * 1.4, 2.6, 8);
		g.fillStyle(C('#5a5668'), 1);
		for (let i = 0; i < 11; i++) g.fillEllipse(5.5 + i * 3.1, 17 - (i % 2) * 1.6, 2.4, 7);
		g.fillStyle(C('#6f6b80'), 0.8); // the shine along the top of the band
		for (let i = 0; i < 12; i++) g.fillEllipse(4 + i * 3, 8 + (i % 3) * 1.4, 1.6, 2.4);
		g.fillStyle(C('#2b2937'), 1).fillEllipse(20, 22, 34, 3); // dark packed base
	});
	// Mussel Bed Edge: the same band, but the sprite is the hard line where it
	// stops and clean rock begins.
	// Kelp Holdfast Reef: bare hard bottom with the claw-like holdfasts gripping
	// it — the anchor, not the forest.
	o('holdfastreef', 42, 26, (g) => {
		g.fillStyle(C('#3f6b7a'), 0.8).fillEllipse(21, 12, 42, 24); // shallow seafloor water
		g.fillStyle(C('#6b7168'), 1).fillEllipse(21, 18, 40, 15); // clean hard rock
		g.fillStyle(C('#7d8378'), 1).fillEllipse(20, 14, 34, 7);
		const bases: [number, number][] = [
			[10, 14],
			[21, 13],
			[32, 15],
		];
		bases.forEach(([x, y]) => {
			g.fillStyle(C('#4a5f3a'), 1).fillEllipse(x, y, 13, 6); // the holdfast
			g.lineStyle(1.6, C('#3d4f30'), 1); // haptera gripping outward
			g.lineBetween(x, y, x - 6, y + 4)
				.lineBetween(x, y, x - 3, y + 5)
				.lineBetween(x, y, x + 3, y + 5);
			g.lineBetween(x, y, x + 6, y + 4);
			g.fillStyle(C('#5f7a45'), 1).fillEllipse(x, y - 3, 6, 4); // stub of the stipe
			g.lineStyle(2, C('#5f7a45'), 1).lineBetween(x, y - 4, x + 2, 1);
		});
	});
	// Kelp Forest: full height — stipes rising through dim green water to a golden
	// canopy lying on the surface.
	o('kelpforest', 40, 46, (g) => {
		g.fillStyle(C('#2f5a4a'), 1).fillEllipse(20, 24, 38, 44); // dim green water
		g.fillStyle(C('#c9a84a'), 1).fillEllipse(20, 6, 36, 9); // golden surface canopy
		g.fillStyle(C('#e0c25a'), 1).fillEllipse(12, 5, 20, 6).fillEllipse(29, 4, 18, 5);
		g.lineStyle(2.4, C('#3f6b45'), 1); // stipes rising the whole way
		g.lineBetween(9, 42, 11, 6).lineBetween(20, 43, 18, 5).lineBetween(30, 42, 28, 6);
		g.fillStyle(C('#4f7d4a'), 1); // blades hanging off them
		for (const [x, y] of [
			[10, 14],
			[19, 12],
			[29, 16],
			[11, 24],
			[18, 26],
			[28, 28],
			[10, 34],
			[20, 36],
		] as [number, number][]) {
			g.fillEllipse(x - 5, y, 10, 3);
			g.fillEllipse(x + 5, y + 3, 10, 3);
		}
		g.fillStyle(C('#8a9a4e'), 1); // the gas floats
		for (const [x, y] of [
			[10, 14],
			[19, 12],
			[29, 16],
			[11, 24],
			[18, 26],
			[28, 28],
		] as [number, number][])
			g.fillCircle(x, y, 1.8);
		g.fillStyle(C('#7fd8a8'), 0.15).fillEllipse(20, 22, 30, 28); // green light filtering down
	});
	// Surfgrass Bed: long blades all laid over sideways in the surge, dense enough
	// to hide the rock.
	o('surfgrass', 42, 28, (g) => {
		g.fillStyle(C('#4f7f8f'), 0.8).fillEllipse(21, 14, 42, 26); // moving water
		g.fillStyle(C('#6b7168'), 1).fillEllipse(21, 24, 36, 8); // low-zone rock beneath
		g.lineStyle(2.2, C('#3d7a52'), 1); // blades streaming one way
		for (let i = 0; i < 8; i++) g.lineBetween(4 + i * 4.4, 24, 15 + i * 3, 9 + (i % 3) * 3);
		g.lineStyle(1.6, C('#55a06a'), 1);
		for (let i = 0; i < 7; i++) g.lineBetween(6 + i * 4.6, 25, 18 + i * 2.6, 6 + (i % 4) * 4);
		g.lineStyle(1.2, C('#7fbf8a'), 0.9);
		for (let i = 0; i < 5; i++) g.lineBetween(8 + i * 5.2, 24, 20 + i * 2.8, 11 + (i % 2) * 5);
		g.fillStyle(C('#2f6b45'), 1).fillEllipse(21, 25, 30, 4); // dense root band
	});
	// Turtle Grazing Lawn: eelgrass cropped short and even — the opposite of
	// surfgrass, and the crop is what makes it habitat.
	o('eelgrasslawn', 42, 24, (g) => {
		g.fillStyle(C('#6fa8b8'), 0.75).fillEllipse(21, 12, 42, 22); // clear shallow water
		g.fillStyle(C('#9a9078'), 1).fillEllipse(21, 19, 38, 8); // sandy bottom
		g.fillStyle(C('#7fae6d'), 1).fillRoundedRect(4, 9, 34, 10, 3); // the cropped lawn
		g.lineStyle(1.6, C('#6f9d5d'), 1); // short, even, tender blades
		for (let i = 0; i < 12; i++) g.lineBetween(6 + i * 2.8, 19, 6 + i * 2.8, 9 + (i % 3));
		g.fillStyle(C('#a8cf92'), 1);
		for (let i = 0; i < 12; i++) g.fillEllipse(6 + i * 2.8, 9 + (i % 3), 1.8, 1.2); // blunt cropped tips
		g.fillStyle(C('#5f8a4a'), 1).fillEllipse(21, 19, 32, 3); // even root line
		g.fillStyle(0xffffff, 0.2).fillEllipse(16, 5, 20, 3);
	});
	// Coralline Turf: pink branching crust — nothing else on the shore is this colour.
	o('corallineturf', 38, 24, (g) => {
		g.fillStyle(C('#4f7f8f'), 0.7).fillEllipse(19, 12, 38, 22); // low-zone water
		g.fillStyle(C('#6b7168'), 1).fillEllipse(19, 18, 34, 10); // the rock
		g.fillStyle(C('#c07a97'), 1).fillEllipse(19, 15, 32, 11); // pink crust over it
		g.fillStyle(C('#d894ac'), 1).fillEllipse(18, 13, 24, 7);
		g.lineStyle(1.4, C('#a85f7c'), 1); // the branching turf
		for (let i = 0; i < 7; i++) {
			const x = 6 + i * 4.2;
			g.lineBetween(x, 18, x, 9 + (i % 3) * 2);
			g.lineBetween(x, 12 + (i % 3), x - 2.4, 8 + (i % 3) * 2);
			g.lineBetween(x, 12 + (i % 3), x + 2.4, 8 + (i % 2) * 2);
		}
		g.fillStyle(C('#e8b0c4'), 1);
		for (let i = 0; i < 7; i++) g.fillCircle(6 + i * 4.2, 8 + (i % 3) * 2, 1.3); // pale branch tips
	});
	// --- Dens, burrows and hibernacula ---------------------------------------
	// Thirty-two objects used to share `obj-stump`, so a tortoise burrow, a snow
	// den and an octopus midden all drew the same mossy stump. What separates
	// these in the fiction is the *entrance* — its shape, what it is cut into,
	// and what is piled outside it — so that is what each sprite leads with.

	// Boulder Burrow Den: the boulder is the roof; chambers run away below the
	// frost line, shown as the dark room under the rock.
	o('boulderden', 40, 32, (g) => {
		g.fillStyle(C('#6f6a56'), 1).fillEllipse(20, 25, 40, 14); // turned earth apron
		g.fillStyle(C('#8b7f68'), 1).fillCircle(20, 15, 13).fillCircle(9, 20, 7).fillCircle(31, 20, 7); // the boulder
		g.fillStyle(C('#a49881'), 1).fillCircle(17, 11, 8); // lit crown
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 26, 12, 7); // the mouth beneath it
		g.fillStyle(C('#3a2f22'), 1).fillEllipse(20, 24, 12, 3); // shaded lintel
		g.fillStyle(C('#4a3f30'), 0.9).fillEllipse(13, 30, 9, 3).fillEllipse(28, 30, 8, 3); // side chambers hinted below
	});
	// Inherited Earth Den: a hollow under boulders and roots, visibly widened —
	// the fresh cut ring around an older mouth is the whole story.
	o('inheritedden', 40, 30, (g) => {
		g.fillStyle(C('#8a6f50'), 1).fillEllipse(20, 19, 40, 22); // earth bank
		g.fillStyle(C('#9c8160'), 1).fillEllipse(19, 14, 32, 12);
		g.fillStyle(C('#7f7568'), 1).fillCircle(6, 12, 6).fillCircle(34, 13, 6); // boulders either side
		g.lineStyle(2, C('#6b5540'), 1).lineBetween(10, 8, 17, 15).lineBetween(30, 7, 23, 15); // roots over the top
		g.fillStyle(C('#b09472'), 1).fillEllipse(20, 21, 19, 13); // the newly widened collar
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 22, 13, 9); // the older mouth inside it
		g.fillStyle(C('#4a3a28'), 1).fillEllipse(20, 27, 12, 3); // worn sill
	});
	// Nest Burrow: an abandoned tunnel in turf, stuffed with old dry bedding.
	o('bumblebeeburrow', 34, 26, (g) => {
		g.fillStyle(C('#7f9a52'), 1).fillEllipse(17, 15, 34, 20); // turf
		g.fillStyle(C('#8f7c55'), 1).fillEllipse(17, 18, 24, 12); // bare worn ground at the mouth
		g.fillStyle(C('#241c14'), 1).fillEllipse(17, 17, 13, 10); // the tunnel
		g.fillStyle(C('#c9b878'), 1).fillEllipse(17, 19, 11, 6); // packed dry grass bedding
		g.fillStyle(C('#ded0a0'), 1).fillEllipse(15, 18, 6, 2.4).fillEllipse(20, 20, 5, 2.2);
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(26, 8, 4, 3); // a bee at the entrance
		g.fillStyle(C('#3b2e25'), 1).fillRect(25.4, 7, 1.1, 2.6);
		g.fillStyle(0xffffff, 0.7).fillEllipse(27.4, 6.6, 2.4, 1.4);
	});
	// Chipmunk Burrow Larder: a flat slab lid, and the side room stacked with
	// seed heads showing through beside it.
	o('chipmunklarder', 40, 26, (g) => {
		g.fillStyle(C('#a08a63'), 1).fillEllipse(20, 17, 40, 18); // dry ground
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 11, 26, 11); // the slab it runs under
		g.fillStyle(C('#a3a39e'), 1).fillEllipse(13, 9, 22, 7);
		g.fillStyle(C('#241c14'), 1).fillEllipse(15, 17, 9, 7); // tunnel mouth under the slab
		g.fillStyle(C('#3d3120'), 1).fillEllipse(30, 18, 16, 10); // the side larder
		g.fillStyle(C('#c9a95f'), 1); // seed heads packed into it
		for (const [x, y] of [
			[26, 17],
			[31, 16],
			[35, 18],
			[29, 20],
			[34, 21],
		] as [number, number][])
			g.fillEllipse(x, y, 4.5, 2.4);
		g.fillStyle(C('#e0c98a'), 1).fillEllipse(31, 16, 3, 1.4);
	});
	// Toad Upland Burrow: small, in dark damp ground, with the soil visibly moist
	// around it — no spoil heap, because it was borrowed.
	o('toadburrow', 32, 24, (g) => {
		g.fillStyle(C('#6a6a4a'), 1).fillEllipse(16, 14, 32, 18); // damp upland ground
		g.fillStyle(C('#7a6f57'), 1).fillEllipse(16, 12, 24, 11); // bare patch
		g.fillStyle(C('#4f4a34'), 1).fillEllipse(16, 16, 20, 8); // wet dark soil ring
		g.fillStyle(C('#241c14'), 1).fillEllipse(16, 15, 9, 7); // the small mouth
		g.fillStyle(C('#3f3a28'), 1).fillEllipse(16, 18, 9, 2.4);
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(4, 8, 8, 4).fillEllipse(28, 9, 7, 3.5); // damp-ground plants
		g.fillStyle(0xffffff, 0.18).fillEllipse(11, 11, 7, 2);
	});
	// Treeline Log Den: a hollow log half-buried in old drift, with snow tunnels
	// running away from it.
	o('treelinelogden', 44, 28, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(22, 21, 44, 14); // packed snow around it
		g.fillStyle(C('#59493a'), 1).fillRoundedRect(4, 8, 32, 12, 6); // the log
		g.fillStyle(C('#6f5c47'), 1).fillRoundedRect(4, 8, 30, 4, 2); // sunlit top
		g.fillStyle(C('#7a6852'), 1).fillEllipse(35, 14, 8, 12); // cut end
		g.fillStyle(C('#1f1810'), 1).fillEllipse(35, 14, 5, 8); // the hollow
		g.fillStyle(C('#c8d8e4'), 1).fillEllipse(10, 22, 14, 5).fillEllipse(30, 24, 13, 5); // tunnel mouths under the snowpack
		g.fillStyle(C('#8fa4b4'), 1).fillEllipse(10, 22, 8, 3).fillEllipse(30, 24, 7, 3);
		g.fillStyle(C('#3f5a44'), 1).fillEllipse(41, 8, 8, 12); // the last conifer
	});
	// Fur-Lined Prey Den: small and close, with tufts of pulled fur caught round
	// the rim — the relining is the identifying detail.
	o('furlinedden', 34, 26, (g) => {
		g.fillStyle(C('#9c8d78'), 1).fillEllipse(17, 16, 34, 18); // dry ground
		g.fillStyle(C('#b0a28c'), 1).fillEllipse(16, 13, 26, 11);
		g.fillStyle(C('#241c14'), 1).fillEllipse(17, 16, 12, 9); // the mouth
		g.fillStyle(C('#e0d6c4'), 1); // fur caught on the rim
		for (const [x, y, w] of [
			[10, 13, 5],
			[17, 11, 6],
			[24, 13, 5],
			[9, 20, 4],
			[25, 20, 4],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.6);
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(17, 19, 9, 3); // fur lining the floor
		g.fillStyle(C('#c4b8a4'), 1).fillEllipse(17, 12, 8, 2);
	});
	// Ledge Den: a dry overhang deep inside broken cliff, screened by fallen rock
	// so only one narrow way in shows.
	o('ledgeden', 40, 32, (g) => {
		g.fillStyle(C('#6b5f52'), 1).fillRoundedRect(2, 2, 36, 26, 3); // broken cliff
		g.fillStyle(C('#7f7263'), 1).fillRoundedRect(2, 2, 36, 8, 3); // lit upper band
		g.fillStyle(C('#150f0a'), 1).fillEllipse(20, 18, 22, 13); // the dry overhang
		g.fillStyle(C('#2f2418'), 1).fillEllipse(20, 13, 22, 5); // roof of it
		g.fillStyle(C('#8b8073'), 1).fillCircle(8, 24, 8).fillCircle(31, 25, 8).fillCircle(20, 28, 6); // fallen rock screening it
		g.fillStyle(C('#9c9184'), 1).fillCircle(6, 22, 4).fillCircle(33, 23, 4);
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 23, 7, 5); // the one narrow way in
	});
	// Tortoise Burrow: the giveaway is the shape — a wide, flat-floored half-moon
	// mouth, far bigger and straighter-sided than anything else out here.
	o('tortoiseburrow', 42, 28, (g) => {
		g.fillStyle(C('#9c8a68'), 1).fillEllipse(21, 20, 42, 16); // apron of worn spoil
		g.fillStyle(C('#7b6a4f'), 1).fillRoundedRect(4, 4, 34, 17, 4); // the bank it is cut into
		g.fillStyle(C('#8f7c5c'), 1).fillRoundedRect(4, 4, 34, 6, 3);
		g.fillStyle(C('#241c14'), 1).fillRoundedRect(11, 12, 20, 10, 5); // wide flat-floored mouth
		g.fillStyle(C('#241c14'), 1).fillEllipse(21, 12, 20, 8); // its domed roof
		g.fillStyle(C('#4f4030'), 1).fillEllipse(21, 21, 21, 3); // the worn sill it is kept open by
		g.fillStyle(C('#b5a07c'), 1).fillEllipse(21, 24, 26, 5); // the polished ramp out
	});
	// Caliche Den: pale, hard, ready-made — a chamber eroded into a cemented bank,
	// with no spoil outside because nothing had to be dug.
	o('calichecave', 40, 28, (g) => {
		g.fillStyle(C('#8a7f68'), 1).fillEllipse(20, 24, 38, 8); // rocky slope below
		g.fillStyle(C('#b9ac8e'), 1).fillRoundedRect(2, 3, 36, 20, 3); // the caliche bank
		g.fillStyle(C('#cdc2a6'), 1).fillRoundedRect(2, 3, 36, 6, 3); // hard cemented cap
		g.fillStyle(C('#a3957a'), 1).fillRect(2, 14, 36, 1.6); // a bedding seam
		g.fillStyle(C('#1f1810'), 1).fillEllipse(19, 17, 18, 12); // the eroded chamber
		g.fillStyle(C('#4a4030'), 1).fillEllipse(19, 12, 18, 4); // its solid roof
		g.fillStyle(C('#d8cdb2'), 1).fillEllipse(8, 8, 7, 4).fillEllipse(32, 10, 6, 3.5); // hard nodules in the face
	});
	// Seed Larder Burrow: the sand plug across the mouth is the point — it traps
	// humid air inside. Shown sealed, under its shrub.
	o('seedlarder', 38, 28, (g) => {
		g.fillStyle(C('#a4885c'), 1).fillEllipse(19, 20, 38, 16); // sandy ground
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(19, 7, 32, 14); // the shrub over it
		g.fillStyle(C('#8f9c68'), 1).fillEllipse(13, 5, 18, 9);
		g.fillStyle(C('#3d3120'), 1).fillEllipse(13, 20, 11, 8); // one mouth, open
		g.fillStyle(C('#c2a878'), 1).fillEllipse(27, 20, 11, 8); // the other, plugged with sand
		g.fillStyle(C('#d8c49a'), 1).fillEllipse(27, 19, 8, 5);
		g.fillStyle(C('#8a7048'), 1).fillEllipse(20, 25, 24, 4); // swept apron
		g.fillStyle(C('#c9a95f'), 1).fillEllipse(9, 24, 4, 2).fillEllipse(31, 25, 3.5, 1.8); // spilled seed
	});
	// Deep Sand Burrow: a spiral shaft — drawn as descending rings so the depth,
	// not the mouth, is what reads.
	o('deepsandburrow', 34, 30, (g) => {
		g.fillStyle(C('#c2a878'), 1).fillEllipse(17, 15, 34, 28); // loose sand
		g.fillStyle(C('#9c7f5a'), 1).fillEllipse(17, 10, 26, 11); // the open shaft mouth
		const rings: [number, number, number, number][] = [
			[17, 11, 22, 9],
			[16, 15, 17, 7],
			[18, 19, 13, 5.5],
			[16, 22, 9, 4],
			[18, 25, 6, 3],
		];
		rings.forEach(([x, y, w, h], i) => {
			g.fillStyle(C(['#7f6544', '#6b5438', '#57432c', '#43331f', '#2f2416'][i]), 1).fillEllipse(x, y, w, h);
		});
		g.fillStyle(C('#d8c49a'), 1).fillEllipse(17, 6, 26, 5); // rim of thrown sand
	});
	// Sandy Den: several mouths in one low rise — the extra doors are the feature.
	o('kitfoxden', 42, 26, (g) => {
		g.fillStyle(C('#8d7f66'), 1).fillEllipse(21, 16, 42, 18); // low sandy rise
		g.fillStyle(C('#a3957a'), 1).fillEllipse(20, 11, 34, 11); // sunlit crown
		g.fillStyle(C('#241c14'), 1); // the several entrances
		g.fillEllipse(9, 17, 10, 7).fillEllipse(22, 19, 11, 8).fillEllipse(34, 16, 9, 6);
		g.fillStyle(C('#4a3f2e'), 1);
		g.fillEllipse(9, 19.5, 10, 2.4).fillEllipse(22, 22, 11, 2.6).fillEllipse(34, 18.5, 9, 2.2); // worn sills
		g.fillStyle(C('#c2b494'), 1).fillEllipse(15, 23, 10, 3).fillEllipse(29, 23, 9, 3); // fans of loose sand
	});
	// Wash Bank Den: cut into a dry wash's bank, set clearly above the flood line
	// with dry gravel running below it.
	o('washbankden', 44, 28, (g) => {
		g.fillStyle(C('#c2b494'), 1).fillEllipse(22, 24, 44, 9); // dry gravel wash bed
		g.fillStyle(C('#a89a7c'), 1).fillEllipse(12, 25, 12, 3).fillEllipse(31, 25, 11, 3);
		g.fillStyle(C('#85704f'), 1).fillRoundedRect(2, 3, 40, 18, 3); // the cut bank
		g.fillStyle(C('#9a8560'), 1).fillRoundedRect(2, 3, 40, 5, 2.5); // dry top
		g.fillStyle(C('#6f5c42'), 1).fillRect(2, 12, 40, 1.4).fillRect(2, 17, 40, 1.2); // flood strata
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 12, 14, 9); // the den, above the flood line
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(20, 15, 14, 2.6);
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(8, 3, 12, 4).fillEllipse(34, 3, 11, 4); // scrub on the rim
	});
	// Winter Rock Den (desert): a deep fissure in warm-toned rock, used year after
	// year — the crack runs back further than the light goes.
	o('desertwinterden', 38, 30, (g) => {
		g.fillStyle(C('#6f6660'), 1).fillCircle(12, 17, 12).fillCircle(27, 16, 11).fillCircle(19, 23, 10); // broken rock
		g.fillStyle(C('#857a72'), 1).fillCircle(11, 12, 8).fillCircle(28, 12, 7);
		g.fillStyle(C('#0f0b08'), 1).fillTriangle(15, 4, 22, 4, 19, 27); // the fissure
		g.fillStyle(C('#0f0b08'), 1).fillTriangle(16, 12, 24, 16, 19, 27);
		g.fillStyle(C('#3a322c'), 1).fillTriangle(15, 4, 18, 4, 18, 14); // its lit lip
		g.fillStyle(C('#9a8f86'), 1).fillEllipse(6, 25, 9, 5).fillEllipse(33, 25, 8, 5); // rubble at the foot
	});
	// Larder Burrow: a coin-sized mouth, and a cutaway of the tunnel running down
	// to a store bigger than the entrance would suggest.
	o('larderburrow', 40, 30, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillEllipse(20, 18, 40, 22); // forest soil, in section
		g.fillStyle(C('#7d6b52'), 1).fillEllipse(20, 8, 36, 10); // leaf-mould surface
		g.fillStyle(C('#241c14'), 1).fillCircle(11, 8, 2.4); // the tiny entrance
		g.lineStyle(2.6, C('#241c14'), 1).lineBetween(11, 9, 15, 16).lineBetween(15, 16, 25, 20); // tunnels running away
		g.fillStyle(C('#241c14'), 1).fillEllipse(16, 17, 9, 6); // nest chamber
		g.fillStyle(C('#3d3120'), 1).fillEllipse(30, 21, 16, 11); // the store room
		g.fillStyle(C('#c9a95f'), 1); // more than a litre of seed
		for (const [x, y] of [
			[26, 20],
			[30, 19],
			[34, 21],
			[28, 23],
			[33, 24],
			[31, 22],
		] as [number, number][])
			g.fillCircle(x, y, 2);
	});
	// Root-Mass Den: the tipped-up root plate is the roof, and the dry hollow left
	// underneath is the den.
	o('rootplateden', 42, 34, (g) => {
		g.fillStyle(C('#5a4a36'), 1).fillCircle(20, 15, 15); // the root plate, stood on end
		g.fillStyle(C('#6b5a42'), 1).fillCircle(18, 12, 12); // earth still held in it
		g.lineStyle(1.8, C('#43351f'), 1); // roots radiating out of it
		for (let i = 0; i < 8; i++) {
			const a = -0.4 + (i / 7) * 3.9;
			g.lineBetween(20, 15, 20 + Math.cos(a) * 17, 15 + Math.sin(a) * 15);
		}
		g.fillStyle(C('#7a6a52'), 1).fillRoundedRect(30, 20, 12, 6, 3); // the trunk lying away
		g.fillStyle(C('#3d3120'), 1).fillEllipse(19, 28, 24, 10); // the dry hollow beneath
		g.fillStyle(C('#150f0a'), 1).fillEllipse(19, 27, 17, 7);
		g.fillStyle(C('#6b5a3e'), 1).fillEllipse(19, 32, 28, 4); // the floor of it
	});
	// Earth Den Bank: a whole well-drained slope with a row of mouths along the
	// face, widened by generations.
	o('earthdenbank', 46, 28, (g) => {
		g.fillStyle(C('#6f5c42'), 1).fillEllipse(23, 17, 46, 24); // the slope
		g.fillStyle(C('#856f50'), 1).fillEllipse(22, 9, 40, 13); // dry sunlit upper face
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(10, 3, 18, 6).fillEllipse(34, 3, 16, 6); // turf on the crest
		g.fillStyle(C('#241c14'), 1); // several entrances along it
		g.fillEllipse(10, 16, 11, 8).fillEllipse(24, 18, 12, 9).fillEllipse(37, 15, 10, 7);
		g.fillStyle(C('#4a3f2e'), 1);
		g.fillEllipse(10, 19, 11, 2.4).fillEllipse(24, 21.5, 12, 2.6).fillEllipse(37, 17.5, 10, 2.2);
		g.fillStyle(C('#9a8464'), 1).fillEllipse(17, 24, 13, 4).fillEllipse(31, 24, 12, 4); // spoil fans, long since packed
	});
	// Forest Winter Den: a rubble-filled crack in cool grey rock, going down past
	// the frost line.
	o('forestwinterden', 40, 28, (g) => {
		g.fillStyle(C('#4f5a3f'), 1).fillEllipse(20, 22, 40, 12); // forest floor
		g.fillStyle(C('#78736a'), 1).fillEllipse(11, 14, 20, 18).fillEllipse(29, 13, 19, 17); // split rock
		g.fillStyle(C('#8d887e'), 1).fillEllipse(10, 9, 15, 9).fillEllipse(30, 8, 14, 9);
		g.fillStyle(C('#100d0a'), 1).fillTriangle(16, 3, 24, 3, 20, 24); // the crack
		g.fillStyle(C('#3a352c'), 1); // rubble packed into it
		for (const [x, y, r] of [
			[19, 8, 2.2],
			[21, 13, 2],
			[19, 18, 1.8],
			[21, 21, 1.5],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(4, 20, 8, 4).fillEllipse(36, 20, 7, 4); // ferns at the base
	});
	// Hollow Denning Tree: a living tree with the chamber metres up — the height is
	// the defence, so the sprite is tall.
	o('denningtree', 32, 46, (g) => {
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(16, 42, 26, 7); // ground cover at the foot
		g.fillStyle(C('#6c5f47'), 1).fillRect(11, 10, 10, 32); // trunk
		g.fillStyle(C('#52472f'), 1).fillRect(11, 10, 3.4, 32); // shadow side
		g.fillStyle(C('#7f7256'), 1).fillRect(18.4, 10, 2, 32); // lit side
		g.fillStyle(C('#5c5038'), 1).fillEllipse(16, 41, 15, 5); // root flare
		g.fillStyle(C('#2f5a30'), 1).fillEllipse(16, 12, 30, 15); // lower canopy
		g.fillStyle(C('#3f6e38'), 1).fillEllipse(11, 8, 20, 13).fillEllipse(23, 7, 18, 12); // upper masses
		g.fillStyle(C('#4f8442'), 1).fillEllipse(13, 4, 15, 8).fillEllipse(24, 4, 12, 7); // sunlit tops
		g.fillStyle(C('#241c14'), 1).fillEllipse(16, 22, 9.5, 10); // the chamber, metres up
		g.fillStyle(C('#4a3f2b'), 1).fillEllipse(16, 18, 9.5, 3.4); // worn upper lip
		g.fillStyle(0x000000, 0.3).fillEllipse(16, 25, 7, 2.4); // depth inside it
	});
	// Rocky Den Ledge: a leaning slab with a gap under it, open at both ends and
	// screened by brush.
	o('rockydenledge', 42, 28, (g) => {
		g.fillStyle(C('#8a8a70'), 1).fillEllipse(21, 24, 40, 8); // ground
		g.fillStyle(C('#7f8288'), 1).fillTriangle(3, 20, 38, 4, 41, 12).fillTriangle(3, 20, 41, 12, 8, 22); // the leaning slab
		g.fillStyle(C('#969aa0'), 1).fillTriangle(4, 19, 37, 5, 39, 9).fillTriangle(4, 19, 39, 9, 7, 20); // lit face
		g.fillStyle(C('#150f0a'), 1).fillTriangle(6, 22, 36, 12, 38, 19).fillTriangle(6, 22, 38, 19, 10, 24); // the gap beneath
		g.fillStyle(C('#5f6a70'), 1).fillCircle(38, 21, 6).fillCircle(5, 23, 5); // rock at each end
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(12, 21, 7).fillCircle(20, 23, 6); // brush screening it
		g.fillStyle(C('#5f9448'), 1).fillCircle(11, 18, 4).fillCircle(21, 20, 3.5);
	});
	// Deep Snow Den: white on white — a shaft driven down into a late drift, with
	// boulders threaded through it and food stashed off to the side.
	o('snowden', 42, 30, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(21, 17, 42, 26); // the drift
		g.fillStyle(0xffffff, 0.9).fillEllipse(19, 11, 34, 13); // wind-smoothed crown
		g.fillStyle(C('#a8bfd0'), 1).fillEllipse(20, 19, 15, 11); // the shaft going down
		g.fillStyle(C('#6f8ba3'), 1).fillEllipse(20, 21, 10, 7);
		g.fillStyle(C('#3f5468'), 1).fillEllipse(20, 23, 6, 4); // and into the dark
		g.fillStyle(C('#9aa8b0'), 1).fillCircle(7, 20, 6).fillCircle(34, 19, 5.5); // boulders it threads around
		g.fillStyle(C('#c8d8e4'), 1).fillEllipse(33, 25, 12, 6); // a side chamber
		g.fillStyle(C('#8a6a4a'), 1).fillEllipse(33, 25, 7, 3); // with food frozen into it
	});
	// Silk-Lined Burrow: a small hole with a silk-bound rim and trip-lines fanned
	// across the sand — the lines are the tell.
	o('silkburrow', 38, 30, (g) => {
		g.fillStyle(C('#a89474'), 1).fillEllipse(19, 17, 38, 24); // firm sand
		g.fillStyle(C('#b8a687'), 1).fillEllipse(18, 13, 30, 13);
		g.lineStyle(1, C('#f2ece0'), 0.9); // trip-lines fanning out
		for (let i = 0; i < 7; i++) {
			const a = -2.6 + (i / 6) * 2.2;
			g.lineBetween(19, 17, 19 + Math.cos(a) * 17, 17 + Math.sin(a) * 13);
		}
		g.lineStyle(1, C('#f2ece0'), 0.7);
		for (let i = 0; i < 4; i++) g.lineBetween(19, 17, 5 + i * 9, 27);
		g.fillStyle(C('#e8e2d4'), 1).fillCircle(19, 17, 6); // the smoothed silk rim
		g.fillStyle(C('#6b5844'), 1).fillCircle(19, 17, 4.2);
		g.fillStyle(C('#150f0a'), 1).fillCircle(19, 17, 3); // the hole
	});
	// Winter Sleep Burrow: a tilted slab, one tunnel, one grass-lined chamber.
	// Nothing stored — that is what separates it from the larder burrows.
	o('wintersleepburrow', 40, 30, (g) => {
		g.fillStyle(C('#5c4a38'), 1).fillEllipse(20, 19, 40, 22); // soil, in section
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(20, 7, 36, 9); // turf above
		g.fillStyle(C('#8e8e8a'), 1).fillTriangle(4, 12, 24, 3, 27, 8).fillTriangle(4, 12, 27, 8, 8, 14); // the tilted slab
		g.fillStyle(C('#a3a39e'), 1).fillTriangle(5, 11, 23, 4, 25, 6).fillTriangle(5, 11, 25, 6, 7, 12);
		g.lineStyle(3, C('#241c14'), 1).lineBetween(9, 14, 20, 20); // the one tunnel
		g.fillStyle(C('#241c14'), 1).fillEllipse(26, 22, 16, 10); // the chamber
		g.fillStyle(C('#a89a5e'), 1).fillEllipse(26, 24, 13, 4); // grass lining, and nothing else
		g.fillStyle(C('#c2b478'), 1).fillEllipse(24, 23, 6, 1.6).fillEllipse(29, 24, 5, 1.4);
	});
	// Canyon Ledge Den: red rock, a cut-back overhang, and fallen slabs across the
	// front leaving one route in.
	o('canyonledgeden', 42, 30, (g) => {
		g.fillStyle(C('#8a5f45'), 1).fillRoundedRect(2, 2, 38, 24, 3); // canyon wall
		g.fillStyle(C('#a3765a'), 1).fillRoundedRect(2, 2, 38, 7, 3); // sunlit rim
		g.fillStyle(C('#75503a'), 1).fillRect(2, 13, 38, 1.6).fillRect(2, 19, 38, 1.4); // strata
		g.fillStyle(C('#120c08'), 1).fillEllipse(21, 19, 26, 12); // the cut-back overhang
		g.fillStyle(C('#3a2418'), 1).fillEllipse(21, 14, 26, 5); // its shaded roof
		g.fillStyle(C('#9c6f52'), 1).fillTriangle(4, 28, 14, 14, 18, 28).fillTriangle(28, 28, 34, 16, 40, 28); // fallen slabs
		g.fillStyle(C('#b08066'), 1).fillTriangle(5, 27, 13, 16, 15, 27);
		g.fillStyle(C('#120c08'), 1).fillEllipse(23, 25, 7, 5); // the one way in
	});
	// Hidden Grass Nest: a standing tussock with a cup pressed into the middle —
	// you would walk past it.
	o('grasstussocknest', 36, 30, (g) => {
		g.fillStyle(C('#6f8a44'), 1).fillEllipse(18, 21, 36, 16); // damp hollow
		g.lineStyle(2.4, C('#8a9a52'), 1); // the thick tussock
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 3.8, 24, 2 + i * 4, 4 + (i % 4) * 4);
		g.lineStyle(1.8, C('#a3b06a'), 1);
		for (let i = 0; i < 8; i++) g.lineBetween(5 + i * 3.6, 24, 7 + i * 3.6, 6 + (i % 3) * 5);
		g.fillStyle(C('#5f6f3a'), 1).fillEllipse(18, 17, 17, 9); // the pressed-down cup
		g.fillStyle(C('#43502a'), 1).fillEllipse(18, 18, 12, 6);
		g.fillStyle(C('#c2b478'), 1).fillEllipse(18, 19, 9, 3.5); // dry grass lining it
	});
	// Den Scrap Pile: a crevice under a boulder with a rock hauled part-way across
	// it, and a tidy midden of emptied shells outside.
	o('octopusmidden', 42, 28, (g) => {
		g.fillStyle(C('#4f7f8f'), 0.8).fillEllipse(21, 14, 42, 26); // water
		g.fillStyle(C('#6a6f7a'), 1).fillCircle(15, 12, 13); // the boulder
		g.fillStyle(C('#7f8590'), 1).fillCircle(13, 8, 9);
		g.fillStyle(C('#0d0f14'), 1).fillEllipse(17, 20, 16, 9); // the crevice under it
		g.fillStyle(C('#8b909a'), 1).fillEllipse(24, 20, 11, 8); // the rock dragged across
		g.fillStyle(C('#9ba0aa'), 1).fillEllipse(24, 18, 8, 4);
		g.fillStyle(C('#d8cdb8'), 1); // the midden, tidily heaped
		for (const [x, y, w] of [
			[33, 22, 7],
			[38, 20, 6],
			[35, 17, 5],
			[31, 18, 5],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 4);
		g.fillStyle(C('#b0a48c'), 1).fillCircle(33, 22, 1.4).fillCircle(38, 20, 1.2).fillCircle(35, 17, 1); // drilled holes
	});
	// Borrowed Burrow: swept clean, with a fan of loose sand thrown out in front.
	o('borrowedburrow', 38, 26, (g) => {
		g.fillStyle(C('#9a7f52'), 1).fillEllipse(19, 15, 38, 18); // desert ground
		g.fillStyle(C('#b09468'), 1).fillEllipse(18, 11, 30, 11);
		g.fillStyle(C('#d8c49a'), 1).fillTriangle(19, 15, 4, 25, 34, 25); // the fan of thrown sand
		g.fillStyle(C('#e2d3ac'), 1).fillTriangle(19, 16, 9, 24, 29, 24);
		g.fillStyle(C('#241c14'), 1).fillEllipse(19, 14, 13, 10); // the widened mouth
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(19, 17.5, 13, 2.6); // swept sill
		g.fillStyle(C('#c2ad86'), 1).fillEllipse(11, 12, 6, 3).fillEllipse(28, 12, 5, 2.6); // spoil either side
	});
	// Clifftop Burrow: a round hole driven back into deep turf, with the entrance
	// worn to bare earth and the drop just beyond.
	o('clifftopburrow', 40, 28, (g) => {
		g.fillStyle(C('#6f7a52'), 1).fillEllipse(20, 14, 40, 22); // deep sea-cliff turf
		g.fillStyle(C('#83904f'), 1).fillEllipse(19, 9, 34, 13);
		g.lineStyle(1.4, C('#5f6b3a'), 0.9);
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 4.2, 12, 2 + i * 4.4, 5 + (i % 3) * 3); // turf blades
		g.fillStyle(C('#9a8a68'), 1).fillEllipse(20, 18, 17, 9); // worn bare patch at the mouth
		g.fillStyle(C('#241c14'), 1).fillCircle(20, 17, 5.5); // the round hole
		g.fillStyle(C('#3f3a28'), 1).fillEllipse(20, 20, 10, 2.4);
		g.fillStyle(C('#8fb0c0'), 1).fillEllipse(20, 27, 40, 5); // the drop, just beyond
	});
	// Meadow Burrow Mound: a fan of fresh earth round the main hole, and a second
	// one hidden in the grass a few paces off.
	o('groundhogmound', 44, 28, (g) => {
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(22, 16, 44, 22); // meadow
		g.fillStyle(C('#8a7550'), 1).fillEllipse(15, 17, 26, 14); // the fan of turned earth
		g.fillStyle(C('#9c8560'), 1).fillEllipse(14, 14, 20, 9); // freshly dug, still pale
		g.fillStyle(C('#241c14'), 1).fillEllipse(15, 17, 12, 9); // the main hole
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(15, 20, 12, 2.6);
		g.lineStyle(2, C('#6f8a3f'), 1); // grass hiding the back door
		for (const x of [30, 33, 36, 39]) g.lineBetween(x, 22, x - 1, 8 + (x % 4) * 2);
		g.fillStyle(C('#241c14'), 1).fillEllipse(35, 20, 8, 5); // the second hole
		g.fillStyle(C('#5f7a35'), 1).fillEllipse(35, 18, 9, 3); // half-covered by grass
	});
	// Den Hollow: a leaning log with a dry cavity under it, floored with dragged-in
	// leaves and open at both ends.
	o('opossumhollow', 44, 26, (g) => {
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(22, 19, 44, 14); // meadow floor
		g.fillStyle(C('#6b5a44'), 1).fillRoundedRect(3, 5, 36, 11, 5); // the leaning log
		g.fillStyle(C('#85704f'), 1).fillRoundedRect(3, 5, 34, 4, 2); // sunlit upper side
		g.fillStyle(C('#8a7358'), 1).fillEllipse(39, 12, 8, 11); // raised end
		g.fillStyle(C('#4f4030'), 1).fillEllipse(39, 12, 4, 6);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(20, 18, 30, 9); // the dry cavity beneath
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(20, 20, 24, 5); // dragged-in leaves on the floor
		g.fillStyle(C('#a3814f'), 1).fillEllipse(14, 20, 7, 2.6).fillEllipse(26, 21, 6, 2.4);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(5, 18, 7, 6).fillEllipse(37, 18, 7, 6); // open at both ends
	});

	// --- Desert shrubs, mounds and forage ground -----------------------------
	// Eighteen objects shared `obj-mound` — a plain brown hummock — which meant
	// a creosote bush, an ant mound and a hemlock stand were the same picture.

	// Krummholz Bed Hollow: a scrape pressed flat under a wind-bent conifer mat.
	// The mat leans all one way, because the wind does.
	o('krummholzbed', 42, 28, (g) => {
		g.fillStyle(C('#6a7355'), 1).fillEllipse(21, 20, 42, 15); // stony alpine ground
		g.fillStyle(C('#3f5a44'), 1).fillEllipse(22, 11, 40, 15); // the krummholz mat
		g.fillStyle(C('#4f6f4a'), 1).fillEllipse(26, 8, 30, 10); // wind-combed upper surface
		g.lineStyle(1.6, C('#35503a'), 1); // everything laid over downwind
		for (let i = 0; i < 7; i++) g.lineBetween(4 + i * 5, 16, 12 + i * 4.6, 6);
		g.fillStyle(C('#2f4436'), 1).fillEllipse(18, 18, 26, 7); // deep shade under it
		g.fillStyle(C('#55503c'), 1).fillEllipse(16, 20, 17, 6); // the scrape, pressed flat
		g.fillStyle(C('#6b6650'), 1).fillEllipse(16, 19, 12, 3.5);
	});
	// Open Sand Beach: the habitat is emptiness — flat, pale, undisturbed, with
	// nothing on it but faint wind ripples.
	o('sandbeach', 46, 22, (g) => {
		g.fillStyle(C('#e2d3ac'), 1).fillEllipse(23, 12, 46, 18); // wide open sand
		g.fillStyle(C('#eee2c0'), 1).fillEllipse(22, 9, 38, 10); // sun-bleached crown
		g.fillStyle(C('#d4c49c'), 0.8); // faint wind ripples, nothing more
		for (let i = 0; i < 4; i++) g.fillEllipse(23, 9 + i * 3.4, 40 - i * 5, 1.2);
		g.fillStyle(C('#c9b892'), 1).fillEllipse(9, 17, 8, 2).fillEllipse(35, 18, 7, 2); // faint shadowed troughs
		g.fillStyle(C('#f4ead0'), 1).fillCircle(14, 7, 1).fillCircle(31, 6, 0.9).fillCircle(24, 5, 0.8); // grains catching light
	});
	// Dune Manzanita: low and spreading, with the smooth red bark manzanita is
	// known for and pale berries held into winter.
	o('dunemanzanita', 40, 28, (g) => {
		g.fillStyle(C('#ded0a8'), 1).fillEllipse(20, 23, 38, 9); // dune sand
		g.fillStyle(C('#8f6f5c'), 1); // the red-barked frame, spreading low
		g.fillRoundedRect(17, 12, 5, 11, 2);
		g.lineStyle(2.4, C('#a3705a'), 1);
		g.lineBetween(19, 16, 7, 12).lineBetween(19, 15, 32, 11).lineBetween(19, 18, 11, 17).lineBetween(19, 17, 30, 16);
		g.fillStyle(C('#5f7a52'), 1).fillEllipse(9, 10, 15, 8).fillEllipse(29, 9, 16, 8).fillEllipse(19, 8, 14, 8); // grey-green leaves
		g.fillStyle(C('#728a5f'), 1).fillEllipse(8, 8, 9, 4).fillEllipse(28, 7, 9, 4);
		g.fillStyle(C('#e8dcc0'), 1); // pale berries held hard into the cold
		for (const [x, y] of [
			[7, 13],
			[13, 11],
			[25, 12],
			[32, 13],
			[19, 12],
		] as [number, number][])
			g.fillCircle(x, y, 1.8);
	});
	// Creosote Bush: open and airy with visible gaps — it is spaced wide because
	// its roots take everything around it, and the silhouette should say so.
	o('creosotebush', 40, 32, (g) => {
		g.fillStyle(C('#c2ab7e'), 1).fillEllipse(20, 27, 34, 8); // bare ground it has cleared
		g.lineStyle(1.8, C('#7a6a44'), 1); // the open woody frame
		g.lineBetween(20, 28, 14, 10).lineBetween(20, 28, 20, 6).lineBetween(20, 28, 27, 11).lineBetween(20, 28, 9, 16);
		g.lineBetween(20, 28, 31, 18);
		g.fillStyle(C('#6b7f4a'), 1); // small resinous leaf clusters, deliberately sparse
		for (const [x, y, r] of [
			[14, 9, 4.5],
			[20, 5, 5],
			[27, 10, 4.5],
			[9, 15, 4],
			[31, 17, 4],
			[17, 14, 3.5],
			[24, 16, 3.5],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#e0c95a'), 1).fillCircle(12, 7, 1.6).fillCircle(23, 4, 1.6).fillCircle(30, 14, 1.4); // yellow flowers
		g.fillStyle(0xffffff, 0.8).fillCircle(17, 12, 1.3).fillCircle(28, 20, 1.2); // fuzzy seed capsules
	});
	// Desert Mistletoe: leafless, and rooted *inside* the host — so it hangs as
	// dense clumps within another plant's branches, not on the ground.
	o('mistletoe', 38, 30, (g) => {
		g.lineStyle(3.4, C('#7a6a4a'), 1); // the host branch it is rooted inside
		g.lineBetween(2, 6, 36, 11);
		g.lineStyle(2.6, C('#6b5b3f'), 1).lineBetween(14, 8, 8, 20).lineBetween(24, 9, 31, 19);
		g.fillStyle(C('#5f5836'), 1).fillEllipse(19, 20, 30, 22); // the clump, hanging heavy
		g.fillStyle(C('#7f7548'), 1).fillEllipse(18, 18, 26, 18);
		g.fillStyle(C('#9a8f5c'), 1).fillEllipse(17, 16, 19, 12); // lit outer growth
		g.lineStyle(1.2, C('#b0a468'), 1); // jointed, leafless stems all through it
		for (let i = 0; i < 9; i++) {
			const a = 0.2 + (i / 8) * 2.7;
			g.lineBetween(19, 14, 19 + Math.cos(a) * 13, 14 + Math.sin(a) * 13);
		}
		g.lineStyle(1, C('#8a8050'), 1);
		for (let i = 0; i < 6; i++) {
			const a = 0.5 + (i / 5) * 2.2;
			g.lineBetween(
				19 + Math.cos(a) * 7,
				14 + Math.sin(a) * 7,
				19 + Math.cos(a + 0.5) * 13,
				14 + Math.sin(a + 0.5) * 12,
			);
		}
		g.fillStyle(C('#d8484a'), 1); // midwinter fruit, the only red out here
		for (const [x, y] of [
			[10, 20],
			[16, 25],
			[23, 24],
			[28, 19],
			[13, 15],
			[24, 14],
			[19, 28],
		] as [number, number][])
			g.fillCircle(x, y, 2);
		g.fillStyle(0xffffff, 0.5).fillCircle(9.4, 19.4, 0.8).fillCircle(22.4, 23.4, 0.8).fillCircle(12.4, 14.4, 0.7);
	});
	// Chuparosa: a soft grey shrub carrying scarlet tubular flowers — the tube
	// shape matters, so they are drawn as little trumpets, not dots.
	o('chuparosa', 38, 30, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(19, 26, 32, 7); // desert ground
		g.fillStyle(C('#9aa08a'), 1).fillEllipse(12, 16, 18, 16).fillEllipse(25, 15, 18, 16); // soft grey growth
		g.fillStyle(C('#adb39c'), 1).fillEllipse(11, 12, 13, 9).fillEllipse(26, 11, 12, 9);
		g.lineStyle(1.2, C('#8a9078'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(7 + i * 5, 25, 8 + i * 4.6, 9 + (i % 3) * 3); // wandy stems
		g.fillStyle(C('#c4523a'), 1); // scarlet tubes
		for (const [x, y, a] of [
			[6, 11, 1],
			[14, 7, 1],
			[22, 9, -1],
			[31, 8, -1],
			[18, 16, 1],
			[28, 17, -1],
		] as [number, number, number][]) {
			g.fillEllipse(x, y, 6.5, 2.6);
			g.fillCircle(x + 3 * a, y, 1.7);
		}
		g.fillStyle(C('#e0735a'), 1).fillEllipse(14, 6.4, 4, 1.2).fillEllipse(31, 7.4, 3.5, 1.1);
	});
	// Catclaw Acacia: low, wide and thorny, with the hooked spines drawn as little
	// claws along the branches and heavy pods hanging under them.
	o('catclaw', 42, 30, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(21, 26, 34, 7); // wash floor
		g.fillStyle(C('#6b5b3f'), 1).fillRect(19, 14, 4, 12); // short trunk
		g.lineStyle(2.2, C('#7a6a4a'), 1); // wide-spreading limbs
		g.lineBetween(21, 16, 6, 11).lineBetween(21, 15, 36, 10).lineBetween(21, 17, 12, 18).lineBetween(21, 16, 32, 17);
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(10, 8, 18, 9).fillEllipse(30, 7, 19, 9).fillEllipse(20, 6, 15, 8); // feathery canopy
		g.fillStyle(C('#8d9a68'), 1).fillEllipse(9, 6, 11, 5).fillEllipse(31, 5, 11, 5);
		g.lineStyle(1, C('#4f4030'), 1); // the hooked spines
		for (const [x, y] of [
			[11, 11],
			[16, 13],
			[26, 12],
			[33, 11],
			[14, 17],
			[29, 16],
		] as [number, number][])
			g.lineBetween(x, y, x + 2, y + 2.4).lineBetween(x + 2, y + 2.4, x + 0.4, y + 3);
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(15, 20, 3, 9).fillEllipse(27, 21, 3, 8); // heavy seed pods
	});
	// Bush Muhly: fine and wispy, and specifically growing up *through* a shrub —
	// the shrub it shelters in is part of the identity.
	o('bushmuhly', 38, 30, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(19, 26, 34, 8); // desert soil
		g.fillStyle(C('#6f7a4a'), 1).fillEllipse(19, 19, 26, 14); // the sheltering shrub
		g.fillStyle(C('#7d8a56'), 1).fillEllipse(17, 16, 19, 9);
		g.lineStyle(1, C('#b8a35e'), 1); // very fine grass stems pushing up through it
		for (let i = 0; i < 11; i++) g.lineBetween(6 + i * 2.7, 24, 4 + i * 3, 4 + (i % 5) * 3);
		g.lineStyle(0.8, C('#cdb974'), 1);
		for (let i = 0; i < 9; i++) g.lineBetween(8 + i * 2.6, 23, 10 + i * 2.8, 6 + (i % 4) * 3);
		g.fillStyle(C('#ded0a0'), 0.85); // the airy seed haze it makes
		for (const [x, y] of [
			[6, 6],
			[13, 4],
			[21, 5],
			[29, 4],
			[34, 8],
			[17, 9],
			[26, 9],
		] as [number, number][])
			g.fillEllipse(x, y, 4, 2);
	});
	// Harvester Ant Mound: a gravel cap, a bare cleared disc around it, a rim of
	// discarded husks, and a column of ants coming in.
	o('antmound', 42, 28, (g) => {
		g.fillStyle(C('#c9b48c'), 1).fillEllipse(21, 16, 42, 22); // the cleared disc
		g.fillStyle(C('#d8c8a0'), 1).fillEllipse(21, 15, 34, 17); // swept bare
		g.fillStyle(C('#a8763f'), 1).fillEllipse(21, 15, 22, 13); // the mound
		g.fillStyle(C('#bd8a4c'), 1).fillEllipse(20, 12, 17, 8); // gravel cap
		g.fillStyle(C('#8a5f30'), 1); // individual gravel
		for (const [x, y] of [
			[15, 12],
			[21, 10],
			[26, 13],
			[18, 15],
			[24, 16],
		] as [number, number][])
			g.fillCircle(x, y, 1.4);
		g.fillStyle(C('#241c14'), 1).fillEllipse(21, 15, 5, 3.5); // the hole
		g.fillStyle(C('#e0d0a4'), 1); // rim of discarded seed husks
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2;
			g.fillEllipse(21 + Math.cos(a) * 14, 15 + Math.sin(a) * 8, 3, 1.4);
		}
		g.fillStyle(C('#3f2f1c'), 1); // the column coming in
		for (const [x, y] of [
			[33, 20],
			[36, 21],
			[39, 22],
		] as [number, number][])
			g.fillEllipse(x, y, 2, 1.2);
	});
	// Creosote Coppice Mound: wind-caught soil heaped round a shrub's base and
	// riddled with fine tunnels — the mound is the habitat, the shrub is the lid.
	o('creosotemound', 40, 30, (g) => {
		g.fillStyle(C('#7e7d55'), 1).fillEllipse(20, 21, 40, 18); // the heaped mound
		g.fillStyle(C('#8f8d62'), 1).fillEllipse(19, 17, 32, 12); // loose windblown crown
		g.fillStyle(C('#6b7f4a'), 1).fillEllipse(20, 8, 30, 14); // the creosote above it
		g.fillStyle(C('#7b8f56'), 1).fillEllipse(14, 6, 17, 8).fillEllipse(28, 6, 14, 7);
		g.lineStyle(1.6, C('#6b5b3f'), 1).lineBetween(20, 18, 16, 8).lineBetween(20, 18, 25, 9); // stems out of the heap
		g.fillStyle(C('#3d3120'), 1); // fine tunnels all through it
		for (const [x, y] of [
			[8, 20],
			[14, 24],
			[22, 25],
			[30, 22],
			[34, 19],
			[18, 21],
		] as [number, number][])
			g.fillEllipse(x, y, 4, 2.6);
		g.fillStyle(C('#5c4a38'), 1);
		for (const [x, y] of [
			[8, 20],
			[22, 25],
			[34, 19],
		] as [number, number][])
			g.fillEllipse(x, y, 2, 1.4);
	});
	// Browse Exclosure: a ring fence with knee-high oak seedlings safe inside and
	// nothing outside it — the contrast is the whole idea.
	o('browseexclosure', 44, 30, (g) => {
		g.fillStyle(C('#7a8f52'), 1).fillEllipse(22, 20, 44, 18); // forest floor
		g.fillStyle(C('#6b7f44'), 1).fillEllipse(22, 19, 30, 13); // protected ground inside
		g.fillStyle(C('#4f7d3a'), 1); // oak seedlings, actually getting away
		for (const [x, y, h] of [
			[14, 18, 9],
			[21, 16, 12],
			[28, 18, 10],
		] as [number, number, number][]) {
			g.fillRect(x - 0.7, y - h + 4, 1.4, h);
			g.fillEllipse(x - 3, y - h + 5, 6, 3.4);
			g.fillEllipse(x + 3, y - h + 8, 6, 3.4);
			g.fillEllipse(x, y - h + 3, 6, 3.4);
		}
		g.fillStyle(C('#a3814f'), 1); // the low ring fence
		for (const x of [5, 14, 23, 32, 39]) g.fillRect(x, 14, 2, 11);
		g.fillStyle(C('#b8975e'), 1).fillEllipse(22, 17, 40, 2).fillEllipse(22, 23, 40, 2);
		g.fillStyle(C('#8a9a5e'), 1).fillEllipse(3, 26, 8, 3).fillEllipse(41, 26, 7, 3); // grazed-flat ground outside
	});
	// Hemlock Stand: close-grown dark conifers holding snow up off the ground.
	o('hemlockstand', 40, 44, (g) => {
		g.fillStyle(C('#4a5f3f'), 1).fillEllipse(20, 40, 38, 8); // shaded floor beneath
		g.fillStyle(C('#6b5b3f'), 1).fillRect(11, 30, 3, 10).fillRect(25, 32, 3, 8).fillRect(18, 28, 3.4, 12);
		g.fillStyle(C('#2f4a37'), 1); // three crowns, close-grown
		g.fillTriangle(2, 34, 12, 6, 22, 34).fillTriangle(17, 36, 27, 10, 37, 36).fillTriangle(10, 32, 20, 2, 30, 32);
		g.fillStyle(C('#3d5c44'), 1).fillTriangle(6, 32, 12, 10, 18, 32).fillTriangle(15, 30, 20, 6, 25, 30);
		g.fillStyle(0xffffff, 0.8); // snow held in the canopy, not on the ground
		g.fillEllipse(12, 12, 9, 3).fillEllipse(20, 8, 8, 3).fillEllipse(27, 16, 8, 3).fillEllipse(15, 20, 7, 2.6);
		g.fillStyle(0xffffff, 0.5).fillEllipse(24, 24, 7, 2.4).fillEllipse(9, 26, 6, 2.2);
	});
	// Sandy Nest Bank: a warm, quick-draining rise of sand and fine gravel standing
	// above the waterline.
	o('sandnestbank', 42, 26, (g) => {
		g.fillStyle(C('#6f9aa8'), 1).fillEllipse(21, 23, 42, 8); // water below it
		g.fillStyle(C('#c2ad7e'), 1).fillEllipse(21, 14, 40, 18); // the rise
		g.fillStyle(C('#d8c69a'), 1).fillEllipse(20, 10, 32, 11); // dry sunlit crown
		g.fillStyle(C('#a89474'), 1); // fine gravel through it
		for (let i = 0; i < 16; i++) g.fillCircle(5 + ((i * 9) % 32), 10 + ((i * 5) % 10), 1.1);
		g.fillStyle(C('#e8dcc0'), 1);
		for (let i = 0; i < 10; i++) g.fillCircle(7 + ((i * 7) % 28), 8 + ((i * 3) % 7), 0.8);
		g.fillStyle(C('#b0996f'), 1).fillEllipse(21, 20, 34, 4); // where it drops to the water
		g.fillStyle(0xffffff, 0.25).fillEllipse(16, 7, 14, 2.4);
	});
	// Snake Egg Mound: a heap of rotting chips banked against a cut stump. The
	// warmth is the point, so the sprite shows heat coming off it.
	o('eggmound', 42, 30, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(21, 24, 42, 11); // forest floor
		g.fillStyle(C('#8a7358'), 1).fillEllipse(33, 16, 16, 20); // the cut stump
		g.fillStyle(C('#a08a6a'), 1).fillEllipse(33, 9, 15, 7); // sawn top
		g.fillStyle(C('#7a6249'), 1).fillEllipse(17, 20, 30, 16); // the banked heap
		g.fillStyle(C('#8f7455'), 1).fillEllipse(16, 16, 24, 10); // loose chips on top
		g.fillStyle(C('#5f4c38'), 1); // bark and chips, individually
		for (const [x, y, w] of [
			[8, 19, 7],
			[16, 15, 8],
			[23, 18, 7],
			[12, 23, 6],
			[21, 23, 6],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 3);
		g.fillStyle(0xffffff, 0.22).fillEllipse(13, 8, 5, 8).fillEllipse(20, 6, 4, 7); // warmth rising off it
	});
	// Acorn Cache: soft open ground pocked with single little digs, one acorn each.
	o('acorncache', 42, 26, (g) => {
		g.fillStyle(C('#7a6340'), 1).fillEllipse(21, 15, 42, 20); // soft open ground
		g.fillStyle(C('#8d7550'), 1).fillEllipse(20, 11, 34, 12);
		const digs: [number, number][] = [
			[8, 12],
			[16, 9],
			[24, 12],
			[32, 10],
			[12, 19],
			[21, 20],
			[30, 18],
			[36, 15],
		];
		digs.forEach(([x, y], i) => {
			g.fillStyle(C('#5c4a30'), 1).fillEllipse(x, y, 7, 4.5); // the little dig
			g.fillStyle(C('#43351f'), 1).fillEllipse(x, y + 0.6, 4.5, 2.6);
			if (i % 2 === 0) {
				g.fillStyle(C('#9a7038'), 1).fillEllipse(x, y, 3.4, 4); // the acorn pushed in
				g.fillStyle(C('#6b4a24'), 1).fillEllipse(x, y - 1.6, 3.6, 1.8); // its cap
			}
		});
		g.fillStyle(C('#a89060'), 1).fillEllipse(21, 23, 30, 3); // scuffed soil
	});
	// Snowbank Mushrooms: pale hairy-stemmed caps crowded right at a melting edge —
	// half snow, half fruiting.
	o('snowbankmushrooms', 40, 28, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillEllipse(20, 20, 40, 15); // wet ground the drift has left
		g.fillStyle(C('#cfd6dc'), 1).fillEllipse(9, 13, 26, 20); // the shrinking drift
		g.fillStyle(0xffffff, 0.9).fillEllipse(7, 10, 20, 12);
		g.fillStyle(C('#8fa4b0'), 1).fillEllipse(15, 21, 14, 5); // its melting lip
		const caps: [number, number, number][] = [
			[21, 17, 5],
			[26, 15, 4.5],
			[31, 18, 5],
			[35, 15, 4],
			[24, 21, 4],
			[30, 22, 3.6],
		];
		caps.forEach(([x, y, r]) => {
			g.fillStyle(C('#e8e2d2'), 1).fillRect(x - 0.9, y, 1.8, 6); // hairy stem
			g.lineStyle(0.7, C('#c4bca8'), 1).lineBetween(x - 1.4, y + 2, x + 1.4, y + 3);
			g.fillStyle(C('#f2ede0'), 1).fillEllipse(x, y, r * 2, r); // pale cap
			g.fillStyle(C('#d8d0bc'), 1).fillEllipse(x, y + 0.8, r * 1.6, r * 0.5);
		});
	});
	// Digging Ground: unpacked leaf-mould already pitted with small cone-shaped
	// holes where something has been turning it over.
	o('diggingground', 42, 26, (g) => {
		g.fillStyle(C('#6b5a3f'), 1).fillEllipse(21, 15, 42, 20); // soft leaf-mould
		g.fillStyle(C('#7d6a4a'), 1).fillEllipse(20, 11, 34, 12); // loose unpacked crown
		g.fillStyle(C('#8a6a3a'), 0.7); // leaf fragments through it
		for (const [x, y] of [
			[7, 9],
			[17, 7],
			[29, 9],
			[36, 12],
		] as [number, number][])
			g.fillEllipse(x, y, 7, 2.6);
		const pits: [number, number, number][] = [
			[10, 14, 5],
			[19, 12, 6],
			[27, 15, 5.5],
			[34, 13, 4.5],
			[15, 19, 5],
			[25, 20, 4.5],
		];
		pits.forEach(([x, y, r]) => {
			g.fillStyle(C('#4f4030'), 1).fillEllipse(x, y, r * 2, r); // the cone-shaped hole
			g.fillStyle(C('#2f2618'), 1).fillTriangle(x - r * 0.7, y - 0.4, x + r * 0.7, y - 0.4, x, y + r * 0.7);
			g.fillStyle(C('#8d7a58'), 1).fillEllipse(x, y - r * 0.6, r * 1.6, 1.4); // spoil on the upslope rim
		});
	});

	// --- Deadwood: logs, snags, cavities and trees ---------------------------
	// The `log`, `deadwood`, `tree` and `birdhouse` shapes covered twenty-six
	// objects between them. What distinguishes dead wood is how far the rot has
	// got and what the rot has opened up, so each sprite below leads with that.

	// Log Shelter: stacked, not single — the gaps running through the middle of
	// the pile are the habitat.
	o('logpile', 44, 28, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(22, 23, 42, 9); // damp ground
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(4, 15, 36, 9, 4.5); // bottom course
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(2, 9, 30, 9, 4.5); // middle log, offset
		g.fillStyle(C('#94703f'), 1).fillRoundedRect(14, 4, 28, 8, 4); // top log
		g.fillStyle(C('#a3814f'), 1).fillEllipse(41, 8, 7, 8).fillEllipse(31, 13, 7, 9); // cut ends
		g.fillStyle(C('#5d4128'), 1).fillEllipse(41, 8, 3.4, 4).fillEllipse(31, 13, 3.4, 4.4);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(9, 19, 8, 5).fillEllipse(24, 19, 7, 5); // gaps right through
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(12, 8, 9, 3.4).fillEllipse(22, 15, 7, 3); // moss going soft
	});
	// Fallen Branch Shelter: thrown together rather than stacked — all angles,
	// twigs still on, riddled with holes.
	o('branchpile', 42, 28, (g) => {
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(21, 23, 40, 9); // ground
		g.lineStyle(3.4, C('#94703f'), 1); // branches thrown down every which way
		g.lineBetween(3, 22, 33, 8).lineBetween(6, 8, 36, 21).lineBetween(20, 4, 24, 24).lineBetween(2, 15, 39, 14);
		g.lineStyle(2.2, C('#7a5a3a'), 1);
		g.lineBetween(9, 24, 29, 5).lineBetween(12, 6, 32, 23);
		g.lineStyle(1.2, C('#a3814f'), 1); // twigs still on them
		g.lineBetween(33, 8, 39, 4).lineBetween(33, 8, 38, 10).lineBetween(6, 8, 2, 4).lineBetween(24, 24, 27, 27);
		g.lineBetween(20, 4, 17, 1).lineBetween(36, 21, 40, 24);
		g.fillStyle(C('#150f0a'), 0.85).fillEllipse(15, 16, 7, 5).fillEllipse(27, 17, 6, 4); // gaps to disappear into
	});
	// Mushroom Log: mossy and damp, with the fungus doing the visible work —
	// brackets stepping up the side and caps along the top.
	o('mushroomlog', 44, 26, (g) => {
		g.fillStyle(C('#4f6b3a'), 1).fillEllipse(22, 22, 42, 8); // damp forest floor
		g.fillStyle(C('#7c6248'), 1).fillRoundedRect(2, 9, 38, 12, 6); // the log
		g.fillStyle(C('#8f7355'), 1).fillRoundedRect(2, 9, 34, 4, 2); // upper curve
		g.fillStyle(C('#3f6b3a'), 1).fillEllipse(14, 9, 20, 5).fillEllipse(30, 10, 12, 4); // moss along the top
		g.fillStyle(C('#5f9448'), 1).fillEllipse(12, 8, 12, 3);
		g.fillStyle(C('#c2a05f'), 1); // brackets stepping up the flank
		g.fillEllipse(8, 15, 11, 5).fillEllipse(17, 18, 9, 4).fillEllipse(26, 15, 10, 4.5);
		g.fillStyle(C('#d8bc7a'), 1).fillEllipse(8, 14, 8, 2.4).fillEllipse(17, 17, 6.5, 2).fillEllipse(26, 14, 7, 2.2);
		g.fillStyle(C('#e0d0a8'), 1); // caps coming up out of the top
		g.fillRect(21, 5, 1.4, 5).fillRect(34, 6, 1.3, 5);
		g.fillEllipse(21.7, 5, 7, 3.4).fillEllipse(34.6, 6, 6, 3);
	});
	// Rotting Conifer Log: alpine, soft enough to push a finger into, lying where
	// the drifts pile deepest — so it keeps a collar of old snow.
	o('coniferlog', 44, 26, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(22, 21, 42, 10); // drift that hasn't gone yet
		g.fillStyle(C('#5c4a35'), 1).fillRoundedRect(3, 8, 36, 12, 6); // the log
		g.fillStyle(C('#6f5a42'), 1).fillRoundedRect(3, 8, 32, 4, 2);
		g.fillStyle(C('#4a3a28'), 1); // soft punky patches you could press into
		g.fillEllipse(12, 14, 12, 7).fillEllipse(26, 15, 10, 6);
		g.fillStyle(C('#3a2c1e'), 1).fillEllipse(12, 15, 7, 4).fillEllipse(26, 16, 6, 3.4);
		g.fillStyle(C('#7a6a52'), 1).fillEllipse(38, 13, 7, 11); // shattered end
		g.lineStyle(1, C('#4a3a28'), 1).lineBetween(36, 8, 40, 18).lineBetween(38, 8, 37, 19); // splinters
		g.fillStyle(0xffffff, 0.85).fillEllipse(8, 8, 12, 4).fillEllipse(31, 9, 10, 3.4); // snow along the top
	});
	// Nurse Log Seedbed: the whole point is what is growing *on* it — a rank of
	// hemlock seedlings in a line along a moss-covered log.
	o('nurselog', 46, 30, (g) => {
		g.fillStyle(C('#5f6b44'), 1).fillEllipse(23, 26, 44, 8); // forest floor
		g.fillStyle(C('#6b5a42'), 1).fillRoundedRect(3, 14, 40, 11, 5.5); // the rotting log
		g.fillStyle(C('#6b7a55'), 1).fillRoundedRect(3, 13, 40, 6, 3); // moss blanket over it
		g.fillStyle(C('#84936a'), 1).fillEllipse(20, 14, 32, 4);
		g.fillStyle(C('#2f5a30'), 1); // seedlings, in a line because the log is
		for (const [x, h] of [
			[9, 9],
			[17, 12],
			[25, 8],
			[33, 11],
			[39, 7],
		] as [number, number][]) {
			g.fillRect(x - 0.6, 13 - h + 2, 1.2, h);
			g.fillTriangle(x - 3.4, 15 - h + 4, x + 3.4, 15 - h + 4, x, 13 - h);
		}
		g.fillStyle(C('#3f7a3a'), 1);
		for (const [x, h] of [
			[17, 12],
			[33, 11],
		] as [number, number][])
			g.fillTriangle(x - 2.4, 13 - h + 3, x + 2.4, 13 - h + 3, x, 12 - h);
		g.fillStyle(C('#4f4030'), 1).fillEllipse(43, 20, 5, 9); // crumbling end
	});
	// Hollowed Log: gone punky and tunnelled through and through — the sprite is a
	// cutaway riddled with pencil-lead galleries.
	// Rotted-Out Log: shell intact, middle gone — a thick ring of sound wood
	// around a dark sealed void.
	o('hollowheartlog', 42, 28, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(21, 24, 40, 8); // ground
		g.fillStyle(C('#7a6a4e'), 1).fillRoundedRect(2, 9, 30, 13, 6); // the outer shell
		g.fillStyle(C('#8f7e5e'), 1).fillRoundedRect(2, 9, 26, 4, 2);
		g.fillStyle(C('#95845f'), 1).fillEllipse(32, 15, 12, 15); // the open end, shell still sound
		g.fillStyle(C('#6b5b42'), 1).fillEllipse(32, 15, 9, 12); // inner ring
		g.fillStyle(C('#0f0b08'), 1).fillEllipse(32, 15, 6.5, 9); // and nothing in the middle
		g.fillStyle(C('#3d3120'), 0.9).fillEllipse(32, 19, 6, 2.4); // damp floor of the void
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(12, 9, 14, 4); // moss on the sound outside
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(7, 14, 6, 3); // a knot
	});

	// Beetle-Killed Snag: still standing hard, but the bark is lifting off in
	// sheets and the wood beneath is galleried.
	// Buried Deadwood: stems worked *into* the soil — half above, half below, in
	// contact with damp earth rather than lying dry on it.
	o('burieddeadwood', 42, 26, (g) => {
		g.fillStyle(C('#b09874'), 1).fillEllipse(21, 11, 42, 16); // dry desert surface
		g.fillStyle(C('#8a7050'), 1).fillEllipse(21, 19, 42, 14); // damp worked soil below
		g.fillStyle(C('#6e5a41'), 1); // stems part-buried, at angles
		g.fillRoundedRect(4, 12, 18, 4, 2).fillRoundedRect(14, 17, 20, 4, 2).fillRoundedRect(24, 9, 15, 3.4, 1.7);
		g.fillStyle(C('#846d4e'), 1).fillRoundedRect(4, 12, 16, 1.6, 0.8).fillRoundedRect(24, 9, 13, 1.4, 0.7);
		g.fillStyle(C('#7d6a4e'), 0.75).fillEllipse(12, 15, 16, 5).fillEllipse(28, 20, 15, 5); // soil closing over them
		g.fillStyle(C('#5c4a35'), 1).fillEllipse(21, 22, 30, 5); // dark damp contact zone
		g.fillStyle(C('#c2ab82'), 1).fillCircle(8, 7, 1.4).fillCircle(31, 5, 1.2).fillCircle(19, 6, 1.1); // surface grit
	});
	// Rotting Dead Tree: a short stub gone pale and soft with white rot — the
	// bleached colour is the tell.
	o('softrotsnag', 28, 34, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(14, 31, 24, 7); // forest floor
		g.fillStyle(C('#8c7f6a'), 1).fillRoundedRect(8, 6, 12, 26, 2); // the stub
		g.fillStyle(C('#a89c88'), 1).fillRoundedRect(8, 6, 5, 26, 2); // pale rotted side
		g.fillStyle(C('#c9c2b0'), 1).fillEllipse(14, 7, 12, 5); // soft white-rot top
		g.fillStyle(C('#ded8c8'), 1).fillEllipse(13, 6, 8, 3);
		g.fillStyle(C('#b5aa94'), 1); // thumbnail-soft pockets
		g.fillEllipse(11, 15, 6, 4).fillEllipse(17, 22, 5, 4).fillEllipse(12, 26, 5, 3.4);
		g.fillStyle(C('#7f7360'), 1).fillEllipse(11, 15, 3, 2).fillEllipse(17, 22, 2.6, 2);
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(14, 30, 15, 4); // moss at the base
	});
	// Peeling Bark Tree: the flat dry gap behind each curling slab is the habitat,
	// so the slabs stand proud of the trunk with shadow behind them.
	o('barkslabsnag', 30, 44, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(15, 41, 26, 6); // ground
		g.fillStyle(C('#6b6152'), 1).fillRect(10, 2, 11, 40); // trunk beneath
		g.fillStyle(C('#7f7565'), 1).fillRect(16, 2, 3, 40);
		g.fillStyle(0x000000, 0.35).fillEllipse(8, 12, 5, 12).fillEllipse(23, 24, 5, 12); // the dry gaps, in shadow
		g.fillStyle(C('#87765d'), 1); // slabs curling away
		g.fillTriangle(10, 6, 4, 12, 10, 20).fillTriangle(21, 18, 27, 25, 21, 33).fillTriangle(10, 24, 5, 30, 10, 36);
		g.fillStyle(C('#9c8b70'), 1);
		g.fillTriangle(10, 7, 6, 12, 10, 18).fillTriangle(21, 19, 25, 25, 21, 31).fillTriangle(10, 25, 7, 30, 10, 34);
		g.lineStyle(0.9, C('#6b5b45'), 1).lineBetween(8, 9, 8, 17).lineBetween(23, 21, 23, 30); // bark fissures
		g.fillStyle(C('#7f7565'), 1).fillEllipse(15, 3, 12, 4); // broken top
	});

	// Alpine Turf Mat: a knitted low mat over dark soil — decades to close over,
	// so it is drawn dense and continuous with soil showing only at the edge.
	o('turfmat', 42, 24, (g) => {
		g.fillStyle(C('#3f3528'), 1).fillEllipse(21, 15, 42, 16); // dark alpine soil
		g.fillStyle(C('#7c8f5a'), 1).fillEllipse(21, 12, 38, 13); // the knitted mat
		g.fillStyle(C('#8fa168'), 1).fillEllipse(19, 9, 30, 8);
		g.fillStyle(C('#6b8049'), 1); // individual cushions knitted together
		for (const [x, y, r] of [
			[8, 11, 5],
			[16, 8, 5.5],
			[25, 10, 5],
			[33, 9, 4.5],
			[12, 15, 4.5],
			[22, 16, 4.5],
			[30, 15, 4],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#a3b57c'), 1);
		for (const [x, y] of [
			[8, 10],
			[16, 7],
			[25, 9],
			[33, 8],
		] as [number, number][])
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#d8c86a'), 1).fillCircle(13, 11, 1.3).fillCircle(28, 12, 1.2); // avens flowers
		g.fillStyle(C('#c9a0c0'), 1).fillCircle(20, 13, 1.2).fillCircle(34, 12, 1.1);
	});
	// Willow Basin Thicket: low, dense, filling a dish in the ground, with the
	// winter snow line showing how far it gets buried.
	o('willowbasin', 44, 28, (g) => {
		g.fillStyle(C('#7f8a6a'), 1).fillEllipse(22, 21, 44, 14); // the sheltered basin
		g.fillStyle(C('#68705a'), 1).fillEllipse(22, 23, 32, 8); // its dished floor
		g.fillStyle(C('#5f6f42'), 1).fillEllipse(22, 16, 40, 20); // willow packed into it
		g.fillStyle(C('#6f7f52'), 1).fillEllipse(13, 12, 24, 15).fillEllipse(31, 11, 22, 14);
		g.fillStyle(C('#84956a'), 1).fillEllipse(12, 8, 16, 8).fillEllipse(31, 7, 14, 7); // sunlit tops
		g.lineStyle(1.4, C('#8a7a5c'), 1); // bud-bearing twigs above the drift line
		for (let i = 0; i < 9; i++) g.lineBetween(6 + i * 4, 15, 5 + i * 4.2, 4 + (i % 3) * 3);
		g.fillStyle(C('#b0a888'), 1);
		for (let i = 0; i < 7; i++) g.fillEllipse(6 + i * 5, 4 + (i % 3) * 3, 2.2, 3);
		g.fillStyle(0xffffff, 0.28).fillEllipse(22, 20, 34, 2.4); // where the drifts reach each winter
	});
	// Whitebark Pine: grown from a buried seed — so it is drawn as a cluster of
	// stems from one spot, carrying cones that never open.
	o('whitebarkpine', 34, 44, (g) => {
		g.fillStyle(C('#6f7a58'), 1).fillEllipse(17, 41, 28, 6); // stony alpine ground
		g.fillStyle(C('#7f7058'), 1); // several stems from a single cache
		g.fillRect(13, 20, 3, 21).fillRect(17, 22, 2.6, 19).fillRect(10, 26, 2.2, 15);
		g.fillStyle(C('#55684a'), 1); // wind-shaped crowns
		g.fillEllipse(14, 16, 24, 16).fillEllipse(22, 24, 18, 12).fillEllipse(9, 26, 14, 10);
		g.fillStyle(C('#66795a'), 1).fillEllipse(13, 12, 18, 9).fillEllipse(23, 21, 12, 7);
		g.lineStyle(1.2, C('#43563c'), 1); // needle bundles
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 4.4, 14 + (i % 3) * 3, 4 + i * 4.6, 9 + (i % 3) * 3);
		g.fillStyle(C('#7a5f3f'), 1); // cones that stay shut
		g.fillEllipse(9, 13, 4, 6).fillEllipse(20, 11, 4, 6).fillEllipse(25, 22, 3.6, 5.4);
		g.fillStyle(C('#5f4830'), 1).fillEllipse(9, 13, 2, 3.4).fillEllipse(20, 11, 2, 3.4);
	});
	// Broken-Top Chimney Tree: a big living tree snapped off high, with the open
	// shaft looking straight down into it.
	o('chimneytree', 34, 46, (g) => {
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(17, 43, 28, 6); // ground
		g.fillStyle(C('#7b6e52'), 1).fillRect(9, 12, 16, 31); // big trunk
		g.fillStyle(C('#5f5540'), 1).fillRect(9, 12, 5, 31); // shadow side
		g.fillStyle(C('#948871'), 1).fillRect(21, 12, 3, 31); // lit side
		g.fillStyle(C('#3f6e38'), 1).fillEllipse(6, 24, 14, 12).fillEllipse(29, 20, 13, 12); // it is still alive
		g.fillStyle(C('#4f8442'), 1).fillEllipse(5, 21, 9, 7).fillEllipse(30, 17, 8, 7);
		g.fillStyle(C('#8f8471'), 1).fillEllipse(17, 12, 16, 7); // the snapped-off top
		g.fillStyle(C('#241c14'), 1).fillEllipse(17, 12, 10, 4.5); // open chimney, a foot across
		g.fillStyle(0x000000, 0.45).fillRect(13.5, 12, 7, 10); // and it goes straight down
		g.lineStyle(1.4, C('#6b6152'), 1).lineBetween(10, 12, 8, 6).lineBetween(24, 12, 26, 7); // splintered rim
	});
	// Mineral Lick: a damp salty bank gnawed down into a hollow — the tooth-marked
	// scoop is the whole object.
	o('minerallick', 42, 26, (g) => {
		g.fillStyle(C('#8a9a68'), 1).fillEllipse(21, 20, 42, 12); // turf around it
		g.fillStyle(C('#c9bfa6'), 1).fillEllipse(21, 13, 36, 18); // the pale salty bank
		g.fillStyle(C('#ded6c0'), 1).fillEllipse(20, 9, 28, 9); // dried crust on top
		g.fillStyle(C('#a89f88'), 1).fillEllipse(21, 15, 24, 11); // the licked-out hollow
		g.fillStyle(C('#8d8574'), 1).fillEllipse(21, 16, 18, 8); // damp inside it
		g.fillStyle(C('#9a927e'), 1); // gnaw scoops around the rim
		for (let i = 0; i < 7; i++) g.fillEllipse(9 + i * 4, 11 + (i % 2) * 1.6, 3.4, 2.4);
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 8, 10, 2.4); // salt showing
		g.fillStyle(C('#6b6a52'), 1).fillEllipse(21, 20, 20, 3); // wet floor of the scoop
	});
	// Willow Thicket (dune swale): tangled right to the ground — impenetrable, so
	// there is no visible floor at all.
	o('dunewillow', 44, 28, (g) => {
		g.fillStyle(C('#ded0a8'), 1).fillEllipse(22, 24, 42, 8); // dune sand behind it
		g.fillStyle(C('#4f6b3f'), 1).fillEllipse(22, 17, 44, 20); // the mass of it
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(13, 12, 22, 14).fillEllipse(31, 11, 20, 13); // sunlit crowns
		g.fillStyle(C('#809a68'), 1).fillEllipse(12, 8, 15, 8).fillEllipse(31, 7, 13, 7);
		g.lineStyle(1.4, C('#5f5540'), 1); // bramble and willow tangled to ground level
		g.lineBetween(4, 24, 16, 8).lineBetween(14, 25, 8, 9).lineBetween(24, 25, 34, 9);
		g.lineBetween(36, 24, 28, 8).lineBetween(6, 18, 38, 16).lineBetween(8, 22, 36, 21);
		g.fillStyle(C('#3f5533'), 1).fillEllipse(22, 22, 38, 7); // no way in at the bottom
		g.fillStyle(C('#7a3a52'), 1).fillCircle(10, 14, 1.4).fillCircle(29, 13, 1.3).fillCircle(20, 10, 1.2); // bramble fruit
	});

	// Old Woodpecker Cavity: clean-edged and empty — an old hole in a dead trunk
	// with nothing living in it.
	o('oldcavity', 28, 42, (g) => {
		g.fillStyle(C('#6f7a58'), 1).fillEllipse(14, 39, 24, 6); // ground
		g.fillStyle(C('#4f4335'), 1).fillRect(8, 2, 13, 38); // the dead trunk
		g.fillStyle(C('#665949'), 1).fillRect(16, 2, 3.4, 38); // lit side
		g.fillStyle(C('#3a3128'), 1).fillRect(8, 2, 3.4, 38);
		g.lineStyle(0.9, C('#3a3128'), 1); // old weathered bark
		for (let i = 0; i < 5; i++) g.lineBetween(10 + i * 2.4, 4, 10 + i * 2.4, 38);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(14, 15, 5.4); // the hole, still clean-edged
		g.fillStyle(C('#7d6f5c'), 1).fillCircle(14, 15, 5.4);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(14, 15, 4.2);
		g.fillStyle(C('#8f8170'), 1).fillEllipse(14, 10.6, 9, 2); // the crisp upper rim
		g.fillStyle(C('#5f5344'), 1).fillEllipse(14, 3, 13, 4); // broken top
	});
	// Cactus Hollow: the hard waterproof flask a saguaro grows around a wound —
	// pale callus, and it outlasts the plant.
	o('saguaroboot', 30, 40, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(15, 37, 26, 6); // desert floor
		g.fillStyle(C('#5e8a4a'), 1).fillRoundedRect(9, 4, 13, 32, 6); // what is left of the cactus
		g.fillStyle(C('#6f9c58'), 1).fillRoundedRect(9, 4, 5, 32, 3);
		g.lineStyle(1, C('#4a7038'), 1);
		for (const x of [12, 16, 20]) g.lineBetween(x, 6, x, 34); // ribs
		g.fillStyle(C('#8f7f5e'), 1).fillEllipse(15, 17, 17, 18); // the hard callus boot
		g.fillStyle(C('#a3947a'), 1).fillEllipse(14, 14, 13, 11); // smooth waterproof wall
		g.fillStyle(C('#0f0b08'), 1).fillEllipse(15, 17, 8, 9); // the flask inside
		g.fillStyle(C('#5f5544'), 1).fillEllipse(15, 13, 8, 2.6); // its lip
		g.fillStyle(C('#c2b08c'), 1).fillEllipse(15, 24, 12, 3); // where the flesh has gone
	});
	// Downy Woodpecker Hole: deliberately tiny — a thumb-wide hole, and the sprite
	// is scaled so it reads small.
	o('downycavity', 26, 38, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(13, 35, 22, 6); // ground
		g.fillStyle(C('#9a8b70'), 1).fillRect(7, 2, 12, 34); // slim dead trunk
		g.fillStyle(C('#b0a189'), 1).fillRect(14, 2, 3, 34); // lit side
		g.fillStyle(C('#7f7360'), 1).fillRect(7, 2, 3, 34);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(13, 14, 2.8); // the thumb-wide hole
		g.fillStyle(C('#c2b49c'), 1).fillEllipse(13, 11.6, 5, 1.4); // fresh pale rim
		g.fillStyle(C('#d8cbb2'), 1); // a season's chips still at the foot
		g.fillEllipse(9, 33, 5, 2).fillEllipse(16, 34, 4, 1.8).fillEllipse(13, 32, 3.4, 1.6);
		g.fillStyle(C('#8a7a62'), 1).fillEllipse(13, 3, 12, 3.4); // snapped top
	});
	// Tall Hollow Tree: the cavity is rectangular and big enough to put an arm
	// into — that shape is unmistakably pileated.
	o('pileatedsnag', 32, 48, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(16, 45, 28, 6); // ground
		g.fillStyle(C('#8a7a5e'), 1).fillRect(9, 2, 15, 43); // big snag
		g.fillStyle(C('#a3947a'), 1).fillRect(19, 2, 4, 43); // lit side
		g.fillStyle(C('#6b5f4a'), 1).fillRect(9, 2, 4, 43);
		g.fillStyle(C('#0f0b08'), 1).fillRoundedRect(12, 13, 9, 14, 2); // this year's rectangular cut
		g.fillStyle(C('#5f5344'), 1).fillRect(12, 13, 9, 2.4); // its chiselled top edge
		g.fillStyle(C('#3d3428'), 1).fillRoundedRect(13, 31, 7, 9, 2); // last year's, further down
		g.fillStyle(C('#c9bca0'), 1); // big chips thrown out below
		g.fillEllipse(8, 43, 7, 2.6).fillEllipse(24, 44, 6, 2.4).fillEllipse(16, 42, 5, 2.2);
		g.fillStyle(C('#7f7360'), 1).fillEllipse(16, 3, 14, 4); // broken top
	});
	// Lined Rock Crack: a narrow dry fissure with down and fur packed into the
	// back of it — the lining is what you can actually see.
	o('linedcrack', 36, 30, (g) => {
		g.fillStyle(C('#8b8378'), 1).fillCircle(11, 15, 13).fillCircle(26, 14, 12).fillCircle(18, 25, 10); // wind-scoured face
		g.fillStyle(C('#9e968a'), 1).fillCircle(9, 10, 8).fillCircle(28, 9, 7);
		g.fillStyle(C('#110e0b'), 1).fillTriangle(14, 2, 22, 2, 18, 27); // the fissure
		g.fillStyle(C('#e8e2d4'), 1); // down and fur packed into the back of it
		g.fillEllipse(18, 17, 8, 11);
		g.fillEllipse(16, 13, 4.5, 5).fillEllipse(20, 15, 4, 5).fillEllipse(17, 21, 5, 4);
		g.fillStyle(C('#f6f2e8'), 1).fillEllipse(18, 16, 5, 7).fillEllipse(19, 20, 3.4, 3);
		g.fillStyle(C('#4a443c'), 1).fillTriangle(14, 2, 16.5, 2, 16.5, 11); // its one lit edge
		g.fillStyle(C('#d8d0c0'), 1).fillCircle(14, 8, 1.3).fillCircle(22, 23, 1.1).fillCircle(21, 6, 1); // wisps escaping
	});

	// --- Nests, litter beds and cliff ledges ---------------------------------
	// `nest`, `leaflitter` and `bluff` covered twenty-five objects. A roped-off
	// beach closure, an eagle's crown nest and a bramble ground cup are not the
	// same picture, and neither are nine different piles of dead leaves.

	// Coastal Nesting Area: the object is the protection, not a nest — posts and
	// line across a broad stretch of quiet upper beach.
	o('beachclosure', 46, 26, (g) => {
		g.fillStyle(C('#d8c8a0'), 1).fillEllipse(23, 16, 46, 18); // quiet upper beach
		g.fillStyle(C('#e6d8b4'), 1).fillEllipse(22, 13, 38, 11);
		g.fillStyle(C('#9a8560'), 1); // posts
		for (const x of [4, 15, 27, 39]) g.fillRect(x, 6, 2, 13);
		g.lineStyle(1, C('#f2ece0'), 1).lineBetween(4, 9, 41, 8).lineBetween(4, 13, 41, 12); // the line between them
		g.fillStyle(C('#e8e2d4'), 1).fillRoundedRect(18, 4, 9, 6, 1); // a sign
		g.fillStyle(C('#7a8f9a'), 1).fillRect(19.5, 5.5, 6, 1).fillRect(19.5, 7.5, 4, 1);
		g.fillStyle(C('#c2ad86'), 1).fillCircle(9, 21, 1.3).fillCircle(31, 22, 1.2).fillCircle(20, 22, 1.1); // undisturbed sand
	});
	// Plover Scrape Closure: narrower and stricter — bare unvegetated sand, with a
	// single shallow scrape inside the fence and nothing built.
	o('ploverscrape', 42, 26, (g) => {
		g.fillStyle(C('#ddd0b0'), 1).fillEllipse(21, 15, 42, 18); // bare open sand
		g.fillStyle(C('#ebe0c4'), 1).fillEllipse(20, 12, 34, 11); // nothing growing on it
		g.fillStyle(C('#9a8560'), 1);
		for (const x of [3, 14, 26, 37]) g.fillRect(x, 8, 1.8, 10);
		g.lineStyle(0.9, C('#f2ece0'), 1).lineBetween(3, 10, 38, 9.4).lineBetween(3, 14, 38, 13.4);
		g.fillStyle(C('#c2b28e'), 1).fillEllipse(20, 19, 13, 6); // the scrape itself
		g.fillStyle(C('#a89876'), 1).fillEllipse(20, 20, 9, 4);
		g.fillStyle(C('#e0d6c0'), 1); // three speckled eggs, and that is all there is
		g.fillEllipse(18, 20, 3, 2.4).fillEllipse(21.5, 19.4, 3, 2.4).fillEllipse(20, 21.6, 3, 2.4);
		g.fillStyle(C('#8a7a5c'), 1).fillCircle(17.6, 19.6, 0.5).fillCircle(22, 19, 0.5).fillCircle(20.4, 21.8, 0.5);
	});
	// Thorn Thicket Nest: a bulky stick platform wedged up inside a thorn bush —
	// the thorns around it are the defence.
	o('thornnest', 40, 34, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(20, 30, 34, 7); // desert ground
		g.fillStyle(C('#5f7042'), 1).fillEllipse(20, 18, 38, 26); // the thorny shrub
		g.fillStyle(C('#6f8250'), 1).fillEllipse(12, 13, 20, 14).fillEllipse(29, 12, 18, 13);
		g.lineStyle(1.2, C('#4f5f38'), 1); // thorns bristling out of it
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2;
			g.lineBetween(20 + Math.cos(a) * 15, 18 + Math.sin(a) * 11, 20 + Math.cos(a) * 19, 18 + Math.sin(a) * 14);
		}
		g.fillStyle(C('#7a6a4c'), 1).fillEllipse(20, 15, 22, 10); // the stick platform, wedged in
		g.lineStyle(1.2, C('#5f5238'), 1);
		g.lineBetween(10, 15, 30, 14).lineBetween(11, 17, 29, 16).lineBetween(14, 11, 17, 19).lineBetween(24, 11, 22, 19);
		g.fillStyle(C('#9a8a68'), 1).fillEllipse(20, 13, 14, 5); // the cup
		g.fillStyle(C('#c2b28e'), 1).fillEllipse(18, 13, 4, 3).fillEllipse(22, 13.4, 4, 3);
	});
	// Shade Form: a scrape in deep shade under a shrub, down to cool soil. The
	// contrast between hot open ground and the dark hollow is the object.
	o('shadeform', 40, 28, (g) => {
		g.fillStyle(C('#dcc79a'), 1).fillEllipse(20, 20, 40, 16); // hot open ground
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(20, 9, 36, 16); // the shrub
		g.fillStyle(C('#8d9a68'), 1).fillEllipse(13, 6, 20, 9).fillEllipse(29, 6, 16, 8);
		g.fillStyle(C('#4a4130'), 0.55).fillEllipse(20, 20, 30, 11); // its pool of shade
		g.fillStyle(C('#a3906a'), 1).fillEllipse(20, 20, 18, 8); // the scrape
		g.fillStyle(C('#6f6148'), 1).fillEllipse(20, 21, 13, 5.5); // cool soil at the bottom
		g.fillStyle(C('#544a36'), 1).fillEllipse(20, 22, 9, 3);
		g.fillStyle(C('#b5a078'), 1).fillEllipse(20, 17, 16, 2.4); // spoil pushed to the upslope rim
	});
	// Adopted Stick Nest: an old platform in a high fork — weathered, sagging a
	// little, and clearly second-hand.
	o('adoptednest', 38, 34, (g) => {
		g.fillStyle(C('#6b5b45'), 1); // the fork it sits in
		g.fillRect(17, 16, 5, 18);
		g.lineStyle(3, C('#7a6a52'), 1).lineBetween(19, 20, 8, 12).lineBetween(19, 20, 31, 11);
		g.fillStyle(C('#8b7c63'), 1).fillEllipse(19, 13, 30, 12); // the bulky old platform
		g.fillStyle(C('#9c8d72'), 1).fillEllipse(19, 11, 26, 8);
		g.lineStyle(1.2, C('#6f6049'), 1); // weathered sticks, sagging out of line
		g.lineBetween(5, 14, 33, 13).lineBetween(6, 16, 32, 16).lineBetween(9, 9, 12, 18).lineBetween(27, 9, 25, 18);
		g.fillStyle(C('#7f7058'), 1).fillEllipse(19, 17, 24, 5); // the sag underneath
		g.fillStyle(C('#5f5240'), 1).fillEllipse(19, 10, 15, 5); // the old cup
		g.fillStyle(C('#8a7a5c'), 1).fillEllipse(11, 8, 6, 2).fillEllipse(28, 8, 5, 2); // leaves worked in
	});
	// Eagle Nest Crown: the top of the tallest tree, with a nest the size of a
	// bathtub in it. Scale is the point, so the tree is tall and the nest huge.
	o('eaglecrown', 40, 48, (g) => {
		g.fillStyle(C('#4a6b3a'), 1).fillEllipse(20, 44, 30, 8); // canopy below
		g.fillStyle(C('#6b5b45'), 1).fillRect(17, 20, 6, 26); // the trunk, right to the top
		g.lineStyle(2.6, C('#7a6a52'), 1).lineBetween(20, 26, 8, 20).lineBetween(20, 28, 32, 21); // crown limbs
		g.fillStyle(C('#6c7b4e'), 1).fillEllipse(9, 30, 18, 12).fillEllipse(31, 31, 16, 11); // living foliage
		g.fillStyle(C('#7d8c5c'), 1).fillEllipse(8, 27, 12, 7).fillEllipse(32, 28, 10, 6);
		g.fillStyle(C('#7a6a4e'), 1).fillEllipse(20, 14, 34, 16); // the nest — enormous
		g.fillStyle(C('#8f7f60'), 1).fillEllipse(20, 11, 30, 11);
		g.lineStyle(1.4, C('#5f5238'), 1); // years of added sticks
		g.lineBetween(4, 15, 36, 14).lineBetween(5, 18, 35, 17).lineBetween(10, 6, 14, 21).lineBetween(30, 6, 26, 21);
		g.fillStyle(C('#5f5240'), 1).fillEllipse(20, 10, 17, 6); // the bowl
		g.fillStyle(C('#e8e2d4'), 1).fillEllipse(17, 10, 5, 4).fillEllipse(23, 10.6, 5, 4); // two eggs
	});
	// Canopy Nest Limb: no nest yet — the object is a limb thick enough to hold
	// one, high where the canopy closes over.
	o('canopylimb', 42, 32, (g) => {
		g.fillStyle(C('#4a5f3c'), 1).fillEllipse(21, 6, 42, 14); // canopy closing overhead
		g.fillStyle(C('#3d5232'), 1).fillEllipse(12, 4, 22, 9).fillEllipse(31, 5, 20, 9);
		g.fillStyle(C('#5f5240'), 1).fillRect(3, 8, 9, 24); // the trunk
		g.fillStyle(C('#75664f'), 1).fillRect(9, 8, 3, 24);
		g.fillStyle(C('#6b5b45'), 1).fillRoundedRect(10, 16, 30, 8, 4); // a genuinely heavy limb
		g.fillStyle(C('#83725a'), 1).fillRoundedRect(10, 16, 28, 3, 1.5); // lit upper surface
		g.fillStyle(C('#4f4433'), 1).fillEllipse(13, 20, 7, 8); // where it joins the trunk
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(24, 16, 12, 3.4).fillEllipse(34, 17, 8, 3); // moss along the top
		g.lineStyle(1.6, C('#6b5b45'), 1).lineBetween(38, 20, 42, 14).lineBetween(38, 21, 42, 26); // it forks at the end
	});
	// Stick Nest (shore): salt-bleached sticks, patched every season — paler and
	// scruffier than the forest platforms.
	o('shorenest', 38, 32, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillRect(16, 16, 5, 16); // fork
		g.lineStyle(2.6, C('#7a6a52'), 1).lineBetween(18, 19, 8, 12).lineBetween(18, 19, 29, 12);
		g.fillStyle(C('#8f8470'), 1).fillEllipse(19, 13, 32, 13); // the bulky platform
		g.fillStyle(C('#a8a08c'), 1).fillEllipse(19, 11, 27, 9); // salt-bleached upper sticks
		g.lineStyle(1.3, C('#c2bca8'), 1); // pale, weathered, added to every year
		g.lineBetween(4, 13, 34, 12).lineBetween(5, 16, 33, 15).lineBetween(10, 7, 13, 19).lineBetween(28, 7, 25, 19);
		g.lineStyle(1.2, C('#7a6a4e'), 1).lineBetween(7, 10, 30, 17); // this season's patch, still brown
		g.fillStyle(C('#6f6857'), 1).fillEllipse(19, 10, 15, 5); // the cup
		g.fillStyle(C('#e8e2d4'), 1).fillEllipse(19, 10, 5, 4);
	});

	// Snowfield Debris Line: a dark seam of wind-carried grit stranded along a
	// melting edge — mostly snow, with one dirty line across it.
	o('debrisline', 44, 26, (g) => {
		g.fillStyle(C('#c9d3dc'), 1).fillEllipse(22, 13, 44, 22); // the shrinking snowfield
		g.fillStyle(0xffffff, 0.9).fillEllipse(20, 8, 36, 12); // clean upper snow
		g.fillStyle(C('#8fa4b4'), 1).fillEllipse(22, 18, 38, 9); // its melting lower edge
		g.fillStyle(C('#5f5238'), 1).fillEllipse(22, 17, 36, 4); // the stranded seam
		g.fillStyle(C('#7a6a4a'), 1); // seed, pollen and grit delivered uphill
		for (let i = 0; i < 13; i++) g.fillEllipse(5 + i * 3, 17 + (i % 3) - 1, 3, 1.6);
		g.fillStyle(C('#a8945f'), 1);
		for (let i = 0; i < 8; i++) g.fillCircle(7 + i * 4.4, 16 + (i % 2), 1);
		g.fillStyle(0xffffff, 0.6).fillEllipse(14, 6, 16, 3);
	});
	// Shrub Litter Mound: wind-drifted husks heaped under a shrub — crackling on
	// top, dark and damp underneath.
	o('shrublitter', 40, 28, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(20, 23, 38, 8); // desert floor
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(20, 7, 34, 13); // the shrub catching it
		g.fillStyle(C('#8d9a68'), 1).fillEllipse(13, 5, 18, 8);
		g.fillStyle(C('#4f4130'), 1).fillEllipse(20, 20, 30, 10); // damp dark underside
		g.fillStyle(C('#8a7a52'), 1).fillEllipse(20, 17, 30, 11); // the dry heap
		g.fillStyle(C('#a3936a'), 1).fillEllipse(19, 15, 24, 7); // crackling top
		g.fillStyle(C('#b8a878'), 1); // individual husks and stems
		for (const [x, y, w] of [
			[9, 16, 7],
			[17, 14, 8],
			[26, 16, 7],
			[31, 19, 6],
			[13, 19, 6],
			[22, 19, 6],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.4);
		g.fillStyle(C('#d8c8a0'), 1).fillEllipse(17, 13, 5, 1.8).fillEllipse(27, 15, 4, 1.6);
	});
	// Crumbled Soil: worked from below — cemented sheeting over the surface with
	// fine old galleries showing through where it has broken.
	o('crumbledsoil', 42, 24, (g) => {
		g.fillStyle(C('#7a6748'), 1).fillEllipse(21, 14, 42, 18); // the worked ground
		g.fillStyle(C('#8f7c58'), 1).fillEllipse(20, 10, 34, 11); // cemented litter sheeting
		g.fillStyle(C('#a08d66'), 1); // plates of it
		for (const [x, y, w, h] of [
			[9, 9, 12, 6],
			[22, 8, 13, 6],
			[33, 11, 11, 5],
			[15, 15, 12, 5],
			[28, 16, 11, 5],
		] as [number, number, number, number][])
			g.fillEllipse(x, y, w, h);
		g.lineStyle(1, C('#5c4a35'), 1); // fine galleries showing at the breaks
		g.lineBetween(6, 12, 14, 13).lineBetween(16, 12, 27, 11).lineBetween(29, 13, 38, 14);
		g.lineBetween(12, 8, 13, 17).lineBetween(26, 7, 25, 18);
		g.fillStyle(C('#4a3b28'), 1).fillCircle(15, 12, 1.1).fillCircle(28, 12, 1).fillCircle(21, 16, 0.9);
	});
	// Deep Leaf Mould: years deep and undisturbed — shown in section, threaded
	// through with roots and pale fungal strands.
	o('deepduff', 42, 26, (g) => {
		g.fillStyle(C('#4a3b28'), 1).fillEllipse(21, 15, 42, 20); // years of mould
		g.fillStyle(C('#5f4c33'), 1).fillEllipse(21, 10, 38, 11); // looser upper layer
		g.fillStyle(C('#7a5f3a'), 1); // last autumn still recognisable on top
		for (const [x, y, w] of [
			[8, 6, 10],
			[19, 5, 11],
			[31, 7, 10],
			[37, 10, 8],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 3);
		g.lineStyle(1.6, C('#6b5540'), 1); // tree roots running through it
		g.lineBetween(2, 14, 40, 17).lineBetween(8, 21, 34, 12);
		g.lineStyle(0.9, C('#c9c0a8'), 0.85); // fungal strands
		g.lineBetween(6, 18, 16, 13).lineBetween(18, 20, 28, 14).lineBetween(24, 19, 36, 20);
		g.fillStyle(C('#332718'), 1).fillEllipse(21, 21, 34, 5); // and it just keeps going down
	});
	// Leaf Drey: a woven ball of leaves and twigs wedged tight into a high fork.
	o('leafdrey', 34, 34, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillRect(15, 18, 4.6, 16); // the fork
		g.lineStyle(2.6, C('#7a6a52'), 1).lineBetween(17, 22, 7, 14).lineBetween(17, 22, 28, 14);
		g.fillStyle(C('#5f5138'), 1).fillCircle(17, 15, 13); // the ball
		g.fillStyle(C('#7f6b45'), 1).fillCircle(16, 13, 11); // leaves woven from the inside out
		g.fillStyle(C('#94804f'), 1); // individual leaves on the outside
		for (const [x, y, w, h] of [
			[10, 10, 9, 4],
			[20, 8, 9, 4],
			[24, 15, 8, 4],
			[12, 19, 8, 4],
			[19, 20, 8, 4],
			[8, 15, 7, 4],
		] as [number, number, number, number][])
			g.fillEllipse(x, y, w, h);
		g.lineStyle(1, C('#5f5138'), 1); // twigs bound through it
		g.lineBetween(7, 12, 26, 10).lineBetween(8, 18, 25, 19).lineBetween(13, 5, 15, 23);
		g.fillStyle(C('#241c14'), 1).fillEllipse(24, 12, 5, 4); // the way in
	});
	// Winter Litter Mound: deep enough that the middle never freezes — drawn tall
	// and banked, beside the marsh rather than in it.
	o('winterlitter', 42, 30, (g) => {
		g.fillStyle(C('#7f9a6a'), 1).fillEllipse(21, 26, 40, 8); // dry ground beside the marsh
		g.fillStyle(C('#4f4130'), 1).fillEllipse(21, 20, 38, 16); // the deep pile
		g.fillStyle(C('#6a5a3c'), 1).fillEllipse(20, 14, 32, 14); // heaped high
		g.fillStyle(C('#7f6c48'), 1).fillEllipse(19, 10, 24, 9); // loose crown
		g.fillStyle(C('#8f7a52'), 1); // bark and old stems through it
		for (const [x, y, w] of [
			[10, 14, 9],
			[20, 11, 10],
			[29, 14, 9],
			[15, 19, 8],
			[26, 20, 8],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 3);
		g.lineStyle(1.2, C('#5f5238'), 1).lineBetween(6, 18, 16, 15).lineBetween(24, 16, 36, 19);
		g.fillStyle(0xffffff, 0.16).fillEllipse(17, 6, 6, 5); // warmth in the middle of it
	});
	// Cocoon Leaf Drift: curled leaves banked against a log, with one cocoon
	// visible inside a rolled leaf — that is the whole reason it matters.
	o('cocoondrift', 44, 26, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(22, 22, 42, 8); // forest floor
		g.fillStyle(C('#6b5b45'), 1).fillRoundedRect(2, 6, 12, 16, 5); // the log it banks against
		g.fillStyle(C('#83725a'), 1).fillRoundedRect(2, 6, 11, 5, 2.5);
		g.fillStyle(C('#8a6a3c'), 1).fillEllipse(27, 16, 34, 14); // the drift
		g.fillStyle(C('#a37f47'), 1); // curled leaves, each rolled
		for (const [x, y, w, h] of [
			[17, 13, 10, 5],
			[26, 11, 11, 5],
			[35, 14, 10, 5],
			[21, 18, 10, 5],
			[31, 19, 10, 5],
			[40, 18, 8, 4],
		] as [number, number, number, number][]) {
			g.fillEllipse(x, y, w, h);
			g.fillStyle(C('#7f6033'), 1).fillEllipse(x + w * 0.28, y, w * 0.35, h * 0.8); // the curl
			g.fillStyle(C('#a37f47'), 1);
		}
		g.fillStyle(C('#c2a05f'), 1).fillEllipse(26, 11, 11, 5); // the one with something in it
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(27, 11, 6, 3.4); // the cocoon inside
		g.lineStyle(0.8, C('#d8c8a0'), 1).lineBetween(24, 10, 30, 12); // silk holding it to the leaf
	});
	// Frozen Leaf Bed: deliberately shallow — only a few centimetres of loose
	// leaves over soil, with frost showing at the surface.
	o('frozenleafbed', 44, 22, (g) => {
		g.fillStyle(C('#5f5138'), 1).fillEllipse(22, 15, 44, 14); // soft soil below
		g.fillStyle(C('#6f5b3e'), 1).fillEllipse(22, 11, 40, 11); // the shallow bed
		g.fillStyle(C('#87703f'), 1); // loose leaves, barely a layer
		for (const [x, y, w] of [
			[8, 9, 11],
			[19, 7, 12],
			[30, 9, 11],
			[38, 11, 9],
			[13, 13, 10],
			[26, 13, 10],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 3.4);
		g.fillStyle(0xffffff, 0.4); // frost right at the surface
		for (const [x, y, w] of [
			[12, 6, 8],
			[24, 5, 9],
			[34, 8, 7],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 1.6);
		g.fillStyle(C('#c8d8e4'), 0.5).fillEllipse(22, 6, 34, 2.4);
		g.fillStyle(C('#463a26'), 1).fillEllipse(22, 17, 34, 4); // and soil directly beneath
	});

	// Escape Cliff: near-vertical, but cut with ledges and footholds the whole way
	// up — the route is what makes it safe ground.
	o('escapecliff', 36, 42, (g) => {
		g.fillStyle(C('#7d7469'), 1).fillRoundedRect(2, 1, 32, 40, 3); // the band of cliff
		g.fillStyle(C('#8e857a'), 1).fillRoundedRect(2, 1, 32, 8, 3); // lit top
		g.fillStyle(C('#655d54'), 1); // ledges stepping the whole way up
		for (const [x, y, w] of [
			[4, 10, 18],
			[14, 17, 20],
			[3, 24, 17],
			[13, 31, 20],
			[6, 37, 16],
		] as [number, number, number][])
			g.fillRect(x, y, w, 3);
		g.fillStyle(C('#9a9186'), 1);
		for (const [x, y, w] of [
			[4, 10, 18],
			[14, 17, 20],
			[3, 24, 17],
			[13, 31, 20],
			[6, 37, 16],
		] as [number, number, number][])
			g.fillRect(x, y, w, 1);
		g.lineStyle(1.2, C('#5a5249'), 1).lineBetween(11, 2, 13, 40).lineBetween(24, 2, 22, 40); // vertical seams
	});
	// Cliff Eyrie: the same sheer rock, but the object is the enormous stick nest
	// on the ledge, added to for decades.
	o('eyrie', 40, 36, (g) => {
		g.fillStyle(C('#6f6a61'), 1).fillRoundedRect(2, 1, 36, 34, 3); // sheer face
		g.fillStyle(C('#7f7a70'), 1).fillRoundedRect(2, 1, 36, 7, 3);
		g.fillStyle(C('#54504a'), 1).fillRect(2, 20, 36, 3); // the ledge
		g.fillStyle(C('#8a857c'), 1).fillRect(2, 20, 36, 1);
		g.fillStyle(C('#6b5b45'), 1).fillEllipse(21, 15, 30, 12); // the eyrie, decades deep
		g.fillStyle(C('#7f6f56'), 1).fillEllipse(21, 12, 26, 9);
		g.lineStyle(1.3, C('#5f5238'), 1);
		g.lineBetween(7, 15, 35, 14).lineBetween(8, 18, 34, 17).lineBetween(12, 8, 15, 20).lineBetween(29, 8, 27, 20);
		g.fillStyle(C('#4f4433'), 1).fillEllipse(21, 11, 15, 5); // the bowl
		g.fillStyle(0xffffff, 0.55).fillEllipse(9, 24, 8, 3).fillEllipse(31, 25, 7, 3); // whitewash down the ledge
	});
	// Goat Cliff Ledge: no wider than a doormat, scraped bare and dusty, on ground
	// far steeper than anything else would attempt.
	o('goatledge', 38, 40, (g) => {
		g.fillStyle(C('#8d8579'), 1).fillTriangle(2, 0, 30, 0, 36, 40).fillTriangle(2, 0, 36, 40, 6, 40); // the steep face
		g.fillStyle(C('#9c9488'), 1).fillTriangle(3, 0, 20, 0, 26, 38).fillTriangle(3, 0, 26, 38, 5, 38);
		g.fillStyle(C('#6f685e'), 1).fillTriangle(24, 0, 30, 0, 36, 40).fillTriangle(24, 0, 36, 40, 30, 40); // shadowed side
		g.fillStyle(C('#5f584f'), 1).fillRect(9, 20, 17, 3.4); // the shelf — barely there
		g.fillStyle(C('#b0a89a'), 1).fillRect(9, 20, 17, 1.4); // scraped bare and dusty
		g.fillStyle(C('#c9c0b0'), 0.7).fillEllipse(17, 19, 14, 2); // dust on it
		g.lineStyle(1, C('#6f685e'), 1).lineBetween(8, 8, 30, 12).lineBetween(6, 30, 32, 33); // strata across the face
	});
	// Cliff Seam: a crack too tight to stand in — narrow, vertical, and the only
	// way in is head-first.
	o('cliffseam', 34, 42, (g) => {
		g.fillStyle(C('#6e7480'), 1).fillRoundedRect(2, 1, 30, 40, 3); // sheer rock
		g.fillStyle(C('#7f8590'), 1).fillRoundedRect(2, 1, 30, 8, 3);
		g.fillStyle(C('#5a606b'), 1).fillRoundedRect(2, 24, 30, 17, 3); // shadowed lower half
		g.fillStyle(C('#0f1116'), 1).fillTriangle(15, 4, 19, 4, 17.5, 34); // the seam — very tight
		g.fillStyle(C('#0f1116'), 1).fillRect(15.4, 4, 3, 24);
		g.fillStyle(C('#39404a'), 1).fillRect(15.4, 4, 1.2, 24); // its one lit edge
		g.lineStyle(1, C('#5a606b'), 1).lineBetween(4, 14, 14, 15).lineBetween(20, 13, 30, 14); // strata running into it
		g.lineBetween(4, 28, 14, 27).lineBetween(21, 29, 30, 28);
		g.fillStyle(C('#8b919c'), 1).fillEllipse(17, 2, 14, 4); // the rim above
	});
	// Scrape Ledge: a gravel-floored shelf with a dip kicked into the grit. No
	// nest built — the ledge and the drop are the nest.
	o('scrapeledge', 40, 34, (g) => {
		g.fillStyle(C('#7b8290'), 1).fillRoundedRect(2, 1, 36, 32, 3); // the cliff
		g.fillStyle(C('#8c93a0'), 1).fillRoundedRect(2, 1, 36, 7, 3);
		g.fillStyle(C('#5f6672'), 1).fillRect(2, 26, 36, 7); // shadow under the shelf
		g.fillStyle(C('#6b7280'), 1).fillRect(2, 16, 36, 10); // the shelf itself
		g.fillStyle(C('#a3aab6'), 1).fillRect(2, 16, 36, 2.4); // its gravel floor
		g.fillStyle(C('#b8bfc9'), 1); // loose grit
		for (let i = 0; i < 14; i++) g.fillCircle(5 + i * 2.4, 19 + (i % 3), 1);
		g.fillStyle(C('#57606d'), 1).fillEllipse(20, 21, 16, 5); // the dip kicked into it
		g.fillStyle(C('#454d59'), 1).fillEllipse(20, 21.6, 11, 3);
		g.fillStyle(C('#e0d6c0'), 1).fillEllipse(18, 21, 4, 3.2).fillEllipse(22, 21.6, 4, 3.2); // eggs straight on the grit
	});
	// Dig Slope: a high bank torn open, with the turned soil left in heaps below —
	// the damage is the habitat.
	o('digslope', 44, 30, (g) => {
		g.fillStyle(C('#7f8f5a'), 1).fillEllipse(22, 6, 42, 11); // alpine turf on the crest
		g.fillStyle(C('#8a7a5c'), 1).fillEllipse(22, 17, 44, 22); // the bank
		g.fillStyle(C('#9c8c6a'), 1).fillEllipse(21, 13, 36, 12);
		g.fillStyle(C('#5f5138'), 1); // torn-open patches
		g.fillEllipse(12, 15, 15, 9).fillEllipse(28, 17, 14, 9);
		g.fillStyle(C('#4a3f2b'), 1).fillEllipse(12, 16, 10, 6).fillEllipse(28, 18, 9, 6);
		g.lineStyle(1.4, C('#7a6a4a'), 1); // roots left hanging in the tear
		g.lineBetween(7, 13, 16, 18).lineBetween(24, 14, 33, 19).lineBetween(10, 19, 15, 13);
		g.fillStyle(C('#a3937a'), 1); // heaps of turned soil below
		g.fillEllipse(9, 26, 14, 6).fillEllipse(24, 27, 15, 6).fillEllipse(37, 25, 11, 5);
		g.fillStyle(C('#b5a68c'), 1).fillEllipse(9, 25, 9, 3).fillEllipse(24, 26, 10, 3);
	});

	// --- Plants, ground cover, kits and storage ------------------------------
	// The last of the shared shapes: `flowers`, `cactus`, `brush`, `bush`,
	// `cushion`, `mushrooms`, `talus`, `rocks`, `kit` and `chest`.

	// Alpine Wildflower Patch: low and tight to the ground, all flowering at once —
	// the opposite of the meadow drift's tall loose stems.
	o('alpineflowers', 38, 22, (g) => {
		g.fillStyle(C('#5f6b4a'), 1).fillEllipse(19, 14, 38, 15); // thin high-country soil
		g.fillStyle(C('#6f8050'), 1).fillEllipse(18, 11, 32, 10); // tight cushion foliage
		g.fillStyle(C('#7d8f5c'), 1);
		for (const [x, y, r] of [
			[8, 11, 5],
			[17, 9, 5.5],
			[26, 11, 5],
			[33, 12, 4],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		const blooms: [number, number, string][] = [
			[6, 9, '#9d86d9'],
			[11, 7, '#d9869d'],
			[16, 6, '#9d86d9'],
			[21, 8, '#e0d05a'],
			[26, 7, '#86a8d9'],
			[31, 9, '#9d86d9'],
			[13, 12, '#e0d05a'],
			[23, 13, '#d9869d'],
			[30, 13, '#86a8d9'],
		];
		blooms.forEach(([x, y, c]) => {
			g.fillStyle(C(c), 1).fillCircle(x, y, 2.4); // no stems — they hug the ground
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 0.9);
		});
	});
	// Open Bare Ground: deliberately left open and loose — the object is soil you
	// could dig straight into, so nothing grows on it.
	o('bareground', 42, 22, (g) => {
		g.fillStyle(C('#b59c72'), 1).fillEllipse(21, 12, 42, 16); // the open patch
		g.fillStyle(C('#cbb287'), 1).fillEllipse(20, 9, 34, 11); // soft uncompacted soil
		g.fillStyle(C('#d8c49a'), 1).fillEllipse(17, 7, 22, 6);
		g.fillStyle(C('#a08a64'), 1); // crumb structure, nothing packed
		for (let i = 0; i < 18; i++) g.fillCircle(4 + ((i * 7) % 34), 7 + ((i * 5) % 10), 1.2 + (i % 3) * 0.3);
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(2, 6, 9, 6).fillEllipse(40, 8, 8, 6); // shrubs, kept back from it
		g.fillStyle(C('#8f6f4a'), 1).fillEllipse(21, 18, 26, 3); // and the ground stays bare
	});
	// Carrion Ground: bones and a stain in the soil — what is left within days,
	// with the beetles and flies that did it.
	o('carrionground', 42, 24, (g) => {
		g.fillStyle(C('#9a8464'), 1).fillEllipse(21, 14, 42, 18); // desert ground
		g.fillStyle(C('#7d6b63'), 1).fillEllipse(20, 14, 30, 12); // the dark stain left behind
		g.fillStyle(C('#665650'), 1).fillEllipse(20, 15, 22, 8);
		g.fillStyle(C('#e0d8c4'), 1); // what is left of it
		g.fillRoundedRect(10, 12, 15, 3, 1.5).fillRoundedRect(14, 17, 13, 2.6, 1.3); // long bones
		g.fillCircle(9, 13.5, 2.6).fillCircle(26, 13.5, 2.6).fillCircle(13, 18.3, 2.2);
		g.fillStyle(C('#cdc4ac'), 1).fillEllipse(30, 12, 8, 6); // skull
		g.fillStyle(C('#8a8070'), 1).fillCircle(31, 11, 1.4);
		g.fillStyle(C('#2f3830'), 1); // beetles and flies still working
		g.fillEllipse(7, 19, 2.6, 1.8).fillEllipse(33, 18, 2.4, 1.6).fillEllipse(24, 20, 2.2, 1.5);
		g.fillStyle(C('#4a5a44'), 1).fillCircle(16, 8, 1.1).fillCircle(28, 7, 1);
	});
	// Truffle Patch: nothing shows above ground, so the sprite is a cutaway — the
	// tubers are on the roots, under the surface.
	o('trufflepatch', 42, 26, (g) => {
		g.fillStyle(C('#6b5a3e'), 1).fillEllipse(21, 8, 42, 12); // leaf litter on top
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(12, 5, 14, 4).fillEllipse(29, 5, 13, 4);
		g.fillStyle(C('#5c4a33'), 1).fillEllipse(21, 17, 42, 18); // the soil below, opened up
		g.fillStyle(C('#463825'), 1).fillEllipse(21, 20, 34, 12);
		g.lineStyle(1.8, C('#7a6a4a'), 1); // oak and hemlock roots
		g.lineBetween(2, 12, 40, 15).lineBetween(10, 24, 30, 11).lineBetween(24, 24, 36, 13);
		g.fillStyle(C('#3f3120'), 1); // the tubers clustered on them
		for (const [x, y, r] of [
			[11, 15, 3.4],
			[18, 18, 4],
			[26, 15, 3.6],
			[32, 19, 3],
			[22, 22, 3],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#584833'), 1).fillCircle(11, 14.4, 1.8).fillCircle(18, 17.2, 2).fillCircle(26, 14.4, 1.8);
		g.lineStyle(0.8, C('#c9c0a8'), 0.8).lineBetween(8, 20, 16, 16).lineBetween(20, 21, 30, 18); // mycelium
	});

	// Berry Bush: prickly, and heavy with fruit — the canes and the thorns are
	// what set it apart from the plain shrub.
	o('berrybush', 38, 32, (g) => {
		g.fillStyle(C('#3f6b34'), 1).fillCircle(12, 20, 12).fillCircle(25, 18, 12).fillCircle(19, 12, 10); // the thicket
		g.fillStyle(C('#4f8440'), 1).fillCircle(11, 15, 8).fillCircle(26, 14, 7);
		g.lineStyle(1.4, C('#7a5a3a'), 1); // arching canes
		g.lineBetween(4, 30, 14, 8).lineBetween(34, 30, 24, 7).lineBetween(10, 30, 28, 12);
		g.lineStyle(0.9, C('#9a7448'), 1); // and they are thorny
		for (const [x, y] of [
			[8, 22],
			[12, 15],
			[27, 12],
			[30, 20],
			[19, 18],
		] as [number, number][])
			g.lineBetween(x, y, x + 1.8, y - 1.8).lineBetween(x, y, x - 1.8, y - 1.6);
		g.fillStyle(C('#5d3a5f'), 1); // heavy fruit
		for (const [x, y] of [
			[8, 19],
			[16, 22],
			[23, 20],
			[30, 17],
			[13, 11],
			[26, 9],
			[20, 15],
		] as [number, number][])
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#7d5680'), 1).fillCircle(7.2, 18.2, 1).fillCircle(22.2, 19.2, 1).fillCircle(25.2, 8.2, 0.9);
		g.fillStyle(0xfff3c4, 0.9).fillCircle(31, 11, 1.4).fillCircle(15, 7, 1.3); // a few late flowers
	});
	// Stonecrop Patch: fat water-storing leaves wedged into rock cracks — the rock
	// is half the object.
	o('stonecrop', 36, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(18, 16, 36, 16); // gravel and rock
		g.fillStyle(C('#a3a39e'), 1).fillCircle(7, 14, 7).fillCircle(28, 13, 7).fillCircle(18, 18, 6);
		g.fillStyle(C('#6f6f6b'), 1); // the cracks it wedges into
		g.fillTriangle(12, 8, 15, 8, 13, 20).fillTriangle(22, 8, 25, 8, 24, 19);
		g.fillStyle(C('#a8b56a'), 1); // fat succulent leaves
		for (const [x, y] of [
			[13, 11],
			[24, 10],
			[9, 17],
			[19, 15],
			[29, 17],
		] as [number, number][]) {
			for (let i = 0; i < 5; i++) {
				const a = -2.6 + (i / 4) * 2.1;
				g.fillEllipse(x + Math.cos(a) * 3, y + Math.sin(a) * 2.4, 4, 2.4);
			}
		}
		g.fillStyle(C('#c2cf85'), 1).fillCircle(13, 10, 1.8).fillCircle(24, 9, 1.7).fillCircle(19, 14, 1.5);
		g.fillStyle(C('#e0d05a'), 1).fillCircle(9, 16, 1.3).fillCircle(29, 16, 1.2); // yellow flowers
	});

	// Saguaro: a single columnar giant, pleated so it can swell and shrink, with
	// its crown of white flowers.
	o('saguarocolumn', 32, 48, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(16, 45, 26, 6); // desert floor
		g.fillStyle(C('#4a7c3f'), 1).fillRoundedRect(11, 6, 12, 39, 6); // the column
		g.fillRoundedRect(2, 20, 9, 6, 3).fillRoundedRect(2, 15, 6, 12, 3); // one arm
		g.fillRoundedRect(23, 25, 7, 5, 2.5).fillRoundedRect(25, 19, 5, 11, 2.5); // and another
		g.fillStyle(C('#5c9150'), 1).fillRoundedRect(11, 6, 5, 39, 2.5); // lit side
		g.lineStyle(1, C('#3a6632'), 1); // the pleats
		for (const x of [14, 17, 20]) g.lineBetween(x, 8, x, 43);
		g.lineBetween(4, 17, 4, 25).lineBetween(27, 21, 27, 28);
		g.fillStyle(C('#f2ede0'), 1); // crown flowers
		g.fillCircle(14, 6, 3).fillCircle(20, 7, 2.6).fillCircle(4, 14, 2.4);
		g.fillStyle(C('#e8d05a'), 1).fillCircle(14, 6, 1.3).fillCircle(20, 7, 1.1).fillCircle(4, 14, 1);
	});
	// Chain-fruit Cholla: a tangle of jointed arms, fuzzy with barbed spines, with
	// the sheltered space inside the tangle showing dark.
	o('cholla', 34, 40, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(17, 37, 26, 6); // ground
		g.fillStyle(C('#6b5b3f'), 1).fillRect(15, 26, 4, 11); // woody trunk
		const joints: [number, number, number, number][] = [
			[17, 24, 10, 13],
			[9, 19, 9, 12],
			[25, 18, 9, 12],
			[12, 10, 8, 11],
			[23, 9, 8, 11],
			[17, 15, 8, 10],
		];
		g.fillStyle(C('#0f1a10'), 0.45).fillEllipse(17, 19, 13, 12); // the sheltered space inside
		joints.forEach(([x, y, w, h], i) => {
			g.lineStyle(0.8, C('#e8e4cc'), 0.95); // barbed spines, close around each joint
			for (let k = 0; k < 9; k++) {
				const a = (k / 9) * Math.PI * 2;
				g.lineBetween(
					x + Math.cos(a) * (w / 2 - 0.5),
					y + Math.sin(a) * (h / 2 - 0.5),
					x + Math.cos(a) * (w / 2 + 2.6),
					y + Math.sin(a) * (h / 2 + 2.6),
				);
			}
			g.fillStyle(C(['#8ba06a', '#7d9260'][i % 2]), 1).fillEllipse(x, y, w, h); // the jointed segment
			g.fillStyle(C('#9db07c'), 1).fillEllipse(x - 1, y - 2, w * 0.55, h * 0.45);
			g.fillStyle(C('#6f8452'), 1).fillEllipse(x, y + h * 0.36, w * 0.6, 1.6); // the joint line
		});
		g.fillStyle(C('#c9a05f'), 1); // the hanging fruit chain it is named for
		g.fillCircle(9, 27, 2.2).fillCircle(11, 31, 2).fillCircle(10, 35, 1.8);
		g.lineStyle(0.9, C('#a8874a'), 1).lineBetween(9, 27, 11, 31).lineBetween(11, 31, 10, 35);
	});
	// Saguaro Fruit Fall: split crimson fruit at the top and fallen on the ground —
	// the richest food out here for a few weeks.
	o('saguarofruit', 34, 44, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(17, 41, 28, 7); // ground
		g.fillStyle(C('#4a7c3f'), 1).fillRoundedRect(12, 8, 11, 34, 5); // the cactus
		g.fillStyle(C('#5c9150'), 1).fillRoundedRect(12, 8, 4.4, 34, 2);
		g.lineStyle(1, C('#3a6632'), 1);
		for (const x of [15, 18, 21]) g.lineBetween(x, 10, x, 40);
		g.fillStyle(C('#b8443c'), 1); // split fruit still on the crown
		for (const [x, y] of [
			[13, 8],
			[18, 6],
			[23, 9],
		] as [number, number][]) {
			g.fillCircle(x, y, 3.4);
			g.fillStyle(C('#e05a4a'), 1).fillEllipse(x, y - 0.6, 4.4, 2.6); // burst open
			g.fillStyle(C('#3a1a14'), 1)
				.fillCircle(x - 1, y - 0.6, 0.7)
				.fillCircle(x + 1.2, y - 1, 0.6); // black seed
			g.fillStyle(C('#b8443c'), 1);
		}
		g.fillStyle(C('#a83a34'), 1); // and fallen at the foot
		g.fillCircle(7, 39, 3).fillCircle(27, 40, 2.6).fillCircle(13, 41, 2.4);
		g.fillStyle(C('#e05a4a'), 1).fillEllipse(7, 38.4, 4, 2.2).fillEllipse(27, 39.4, 3.4, 2);
		g.fillStyle(C('#3a1a14'), 1).fillCircle(6, 38.4, 0.7).fillCircle(26.4, 39.4, 0.6);
	});
	// Cactus Fruit Set: prickly pear pads hanging heavy — a full crop, which only
	// happens where every flower got pollinated.
	o('cactusfruitset', 40, 34, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(20, 31, 32, 7); // ground
		g.fillStyle(C('#5e8a4a'), 1); // prickly pear pads
		g.fillEllipse(13, 20, 15, 19).fillEllipse(26, 17, 14, 18).fillEllipse(19, 9, 12, 14);
		g.fillStyle(C('#6f9c58'), 1).fillEllipse(11, 17, 9, 12).fillEllipse(25, 14, 8, 11);
		g.fillStyle(C('#4a7038'), 1); // areoles
		for (const [x, y] of [
			[10, 16],
			[15, 22],
			[24, 13],
			[29, 20],
			[18, 7],
			[21, 12],
		] as [number, number][])
			g.fillCircle(x, y, 0.9);
		g.fillStyle(C('#9c3f5a'), 1); // ripe fruit, ringing every pad edge
		for (const [x, y] of [
			[7, 12],
			[13, 10],
			[19, 2],
			[24, 6],
			[32, 11],
			[33, 19],
			[6, 24],
			[20, 26],
			[28, 26],
		] as [number, number][]) {
			g.fillEllipse(x, y, 4.4, 5.4);
			g.fillStyle(C('#b8536f'), 1).fillEllipse(x - 0.6, y - 1, 2.4, 2.6);
			g.fillStyle(C('#9c3f5a'), 1);
		}
	});
	// Cactus Crown Nest: a stick platform wedged where a tall cactus splits into
	// arms — wide enough for a whole family.
	o('cactuscrownnest', 36, 46, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(18, 43, 26, 6); // ground
		g.fillStyle(C('#4a7c3f'), 1).fillRoundedRect(14, 16, 10, 28, 5); // trunk
		g.fillRoundedRect(4, 20, 10, 5, 2.5).fillRoundedRect(4, 10, 6, 14, 3); // arms splitting off
		g.fillRoundedRect(24, 22, 8, 5, 2.5).fillRoundedRect(26, 12, 6, 14, 3);
		g.fillStyle(C('#5c9150'), 1).fillRoundedRect(14, 16, 4, 28, 2).fillRoundedRect(4, 10, 2.6, 14, 1.3);
		g.fillStyle(C('#8a7145'), 1).fillEllipse(18, 12, 26, 11); // the platform in the crook
		g.fillStyle(C('#9c8352'), 1).fillEllipse(18, 10, 22, 8);
		g.lineStyle(1.3, C('#6b5535'), 1);
		g.lineBetween(6, 13, 30, 12).lineBetween(7, 15, 29, 14).lineBetween(12, 6, 14, 17).lineBetween(24, 6, 22, 17);
		g.fillStyle(C('#5f4c30'), 1).fillEllipse(18, 9, 13, 4.4); // the cup
		g.fillStyle(C('#e8e2d4'), 1).fillEllipse(16, 9, 4, 3).fillEllipse(20, 9.4, 4, 3);
	});

	// Browse Thicket: dense young regrowth in a light gap — every twig within
	// reach from the ground, and the gap in the canopy above it.
	o('browsethicket', 44, 30, (g) => {
		g.fillStyle(C('#3d5232'), 1).fillEllipse(6, 4, 18, 10).fillEllipse(38, 4, 18, 10); // canopy either side of the gap
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(22, 26, 42, 8); // forest floor
		g.fillStyle(C('#6d8348'), 1); // crowded young regrowth
		for (const [x, y, r] of [
			[8, 18, 8],
			[17, 15, 9],
			[27, 16, 9],
			[36, 19, 8],
			[12, 22, 7],
			[31, 23, 7],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#82985a'), 1).fillCircle(16, 12, 6).fillCircle(28, 13, 5.5).fillCircle(8, 15, 4.5);
		g.lineStyle(1.3, C('#6b5b3f'), 1); // stems, all reachable from below
		for (let i = 0; i < 8; i++) g.lineBetween(5 + i * 5, 26, 6 + i * 5, 12 + (i % 3) * 3);
		g.fillStyle(C('#a8bf78'), 1); // fresh browse tips
		for (let i = 0; i < 7; i++) g.fillEllipse(6 + i * 5.4, 12 + (i % 3) * 3, 4, 2.2);
	});
	// Wild Grape Tangle: a woody vine roped up a leaning trunk — a ladder and a
	// larder at once.
	o('grapetangle', 38, 40, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(19, 37, 32, 7); // ground
		g.fillStyle(C('#6b5b45'), 1).fillTriangle(10, 38, 17, 38, 27, 2).fillTriangle(10, 38, 27, 2, 21, 2); // leaning trunk
		g.fillStyle(C('#7f6d54'), 1).fillTriangle(12, 37, 15, 37, 24, 3).fillTriangle(12, 37, 24, 3, 22, 3);
		g.lineStyle(2.4, C('#7a5a3a'), 1); // the vine roped round it
		g.lineBetween(8, 34, 20, 27).lineBetween(20, 27, 12, 20).lineBetween(12, 20, 24, 14).lineBetween(24, 14, 17, 7);
		g.fillStyle(C('#5b7c3a'), 1); // grape leaves
		for (const [x, y, r] of [
			[7, 30, 6],
			[24, 24, 6],
			[9, 16, 5.5],
			[28, 12, 5.5],
			[15, 9, 5],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#6d9147'), 1).fillCircle(6, 28, 3.4).fillCircle(25, 22, 3.2).fillCircle(29, 10, 3);
		g.fillStyle(C('#4a3a5f'), 1); // hanging bunches
		for (const [x, y] of [
			[13, 32],
			[30, 19],
			[6, 22],
		] as [number, number][]) {
			g.fillTriangle(x - 3, y, x + 3, y, x, y + 8);
			g.fillStyle(C('#5f4c78'), 1)
				.fillCircle(x - 1, y + 2, 1.4)
				.fillCircle(x + 1, y + 4, 1.2);
			g.fillStyle(C('#4a3a5f'), 1);
		}
	});
	// Thicket Bed Hollow: a scooped dusty hollow under dense thornscrub, worn flat
	// by a whole herd lying up in the heat.
	o('thicketbed', 44, 30, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(22, 22, 44, 16); // desert ground
		g.fillStyle(C('#5f7042'), 1).fillEllipse(22, 9, 42, 18); // dense thornscrub over it
		g.fillStyle(C('#6f8250'), 1).fillEllipse(13, 6, 22, 10).fillEllipse(32, 5, 18, 9);
		g.lineStyle(1, C('#4f5f38'), 1);
		for (let i = 0; i < 8; i++) g.lineBetween(5 + i * 5, 16, 4 + i * 5.2, 10 + (i % 3) * 2); // thorny stems
		g.fillStyle(C('#4a4130'), 0.5).fillEllipse(22, 21, 36, 12); // deep shade under it
		g.fillStyle(C('#8b7a52'), 1).fillEllipse(22, 21, 30, 11); // the worn hollow
		g.fillStyle(C('#6f6148'), 1).fillEllipse(15, 22, 14, 6).fillEllipse(29, 21, 13, 6); // separate body-scoops
		g.fillStyle(C('#a3936a'), 0.8).fillEllipse(22, 17, 26, 3); // dust kicked to the rim
	});

	// Meadow Mushroom Ring: an arc, not a closed ring — the growing edge of the
	// fungus, pushing up through damp grass thatch.
	o('meadowring', 42, 26, (g) => {
		g.fillStyle(C('#7f9a52'), 1).fillEllipse(21, 15, 42, 18); // damp grass
		g.lineStyle(1.2, C('#8fa85e'), 1);
		for (let i = 0; i < 12; i++) g.lineBetween(3 + i * 3.2, 20, 2 + i * 3.4, 11 + (i % 3) * 2); // thatch
		g.fillStyle(C('#6b8a44'), 1); // greener band where the fungus is feeding
		for (let i = 0; i < 9; i++) {
			const a = 0.35 + (i / 8) * 2.45;
			g.fillEllipse(21 + Math.cos(a) * 16, 12 + Math.sin(a) * 9, 7, 3.4);
		}
		for (let i = 0; i < 8; i++) {
			const a = 0.45 + (i / 7) * 2.25,
				x = 21 + Math.cos(a) * 16,
				y = 12 + Math.sin(a) * 9;
			g.fillStyle(C('#e8e2d0'), 1).fillRect(x - 0.8, y - 3, 1.6, 4); // stalk
			g.fillStyle(C('#d8cdb4'), 1).fillEllipse(x, y - 3, 6, 4); // pale button cap
			g.fillStyle(C('#eae2cc'), 1).fillEllipse(x - 0.6, y - 4, 3.4, 2);
		}
	});
	// Bracket Fungus Shelf: overlapping banded fans stepping up the side of a dead
	// log — the fans, not the log, are the object.
	o('bracketfungus', 40, 30, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(20, 27, 36, 7); // forest floor
		g.fillStyle(C('#6b5b45'), 1).fillRoundedRect(4, 4, 15, 24, 4); // the dead hardwood
		g.fillStyle(C('#7f6d54'), 1).fillRoundedRect(4, 4, 6, 24, 3);
		const fans: [number, number, number][] = [
			[19, 8, 11],
			[19, 14, 13],
			[19, 20, 12],
			[19, 25, 9],
		];
		fans.forEach(([x, y, w]) => {
			g.fillStyle(C('#8a5f2f'), 1).fillEllipse(x + w * 0.42, y + 1.6, w, 5.4); // the fan's underside
			g.fillStyle(C('#a8763f'), 1).fillEllipse(x + w * 0.42, y, w, 5.4); // and its top
			g.fillStyle(C('#c9954f'), 1).fillEllipse(x + w * 0.42, y - 0.8, w * 0.78, 3.4); // banding
			g.fillStyle(C('#e0c08a'), 1).fillEllipse(x + w * 0.46, y - 1.4, w * 0.5, 1.8);
		});
		g.fillStyle(C('#f2e8d0'), 1); // the pale growing margin
		fans.forEach(([x, y, w]) => g.fillEllipse(x + w * 0.72, y + 0.6, w * 0.36, 1.6));
	});

	// Snowmelt Litter Mat: a sodden, flattened mat of last year's stems, just
	// released by the snowpack — dark, wet, and going straight back to soil.
	o('snowmeltmat', 40, 22, (g) => {
		g.fillStyle(C('#c9d3dc'), 1).fillEllipse(34, 8, 16, 12); // the last of the snowpack
		g.fillStyle(C('#4a4437'), 1).fillEllipse(19, 13, 38, 14); // sodden ground
		g.fillStyle(C('#6b6151'), 1).fillEllipse(19, 11, 34, 11); // the flattened mat
		g.fillStyle(C('#7d7361'), 1); // last year's stems, all pressed one way
		for (const [x, y, w] of [
			[9, 8, 13],
			[19, 7, 14],
			[28, 9, 12],
			[13, 13, 13],
			[24, 14, 12],
			[32, 12, 9],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.4);
		g.fillStyle(C('#8f8471'), 1).fillEllipse(15, 7, 9, 1.4).fillEllipse(26, 10, 8, 1.3);
		g.fillStyle(0xffffff, 0.22).fillEllipse(17, 9, 18, 2.4); // wet shine on it
		g.fillStyle(C('#5f6b4a'), 1).fillCircle(7, 15, 1.6).fillCircle(22, 17, 1.4); // first green pushing through
	});
	// Living Soil Crust: a knitted dark skin over bare desert soil — lumpy,
	// continuous, and obviously alive.
	o('soilcrust', 42, 22, (g) => {
		g.fillStyle(C('#b09874'), 1).fillEllipse(21, 12, 42, 16); // the soil it is knitting
		g.fillStyle(C('#5c5a4a'), 1).fillEllipse(21, 11, 36, 13); // the crust
		g.fillStyle(C('#6b6a55'), 1); // its pinnacled, lumpy surface
		for (const [x, y, r] of [
			[7, 10, 4],
			[14, 8, 4.5],
			[21, 10, 4],
			[28, 8, 4.5],
			[34, 11, 4],
			[11, 14, 3.4],
			[24, 14, 3.6],
			[31, 14, 3.2],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#4a4a3a'), 1);
		for (const [x, y] of [
			[7, 10],
			[14, 8],
			[21, 10],
			[28, 8],
			[34, 11],
		] as [number, number][])
			g.fillCircle(x, y, 1.8);
		g.fillStyle(C('#8a9a6a'), 1).fillCircle(17, 12, 1.4).fillCircle(30, 12, 1.2).fillCircle(9, 13, 1.1); // moss and lichen in it
		g.fillStyle(C('#c9c0a0'), 1).fillCircle(24, 7, 1).fillCircle(12, 6, 0.9);
	});
	// Puffball Ring: pale domes pushing up through old turf, in a ring.
	o('puffballring', 40, 26, (g) => {
		g.fillStyle(C('#7a8a5a'), 1).fillEllipse(20, 15, 40, 18); // old turf
		g.fillStyle(C('#89996a'), 1).fillEllipse(19, 12, 32, 11);
		const ring: [number, number, number][] = [
			[7, 13, 4],
			[13, 8, 3.4],
			[21, 6, 4.2],
			[29, 8, 3.6],
			[34, 13, 4],
			[29, 18, 3.4],
			[20, 20, 4],
			[11, 18, 3.6],
		];
		ring.forEach(([x, y, r]) => {
			g.fillStyle(C('#6b7a4a'), 1).fillEllipse(x, y + r * 0.55, r * 2.2, r * 0.8); // turf pushed up around it
			g.fillStyle(C('#cfc6a8'), 1).fillCircle(x, y, r); // the dome
			g.fillStyle(C('#e2dbc2'), 1).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.55); // its pale crown
		});
		g.fillStyle(C('#b0a888'), 0.7).fillEllipse(21, 6, 5, 3); // one ripe and smoking
		g.fillStyle(C('#c9c0a8'), 0.4).fillCircle(21, 2, 3);
	});

	// Fellfield Gravel: wind-scoured, frost-sorted grit held together by thin
	// lichen crusts — flat, and it looks like nothing until you know.
	o('fellfield', 42, 22, (g) => {
		g.fillStyle(C('#9a9385'), 1).fillEllipse(21, 12, 42, 16); // the gravel sheet
		g.fillStyle(C('#a8a294'), 1).fillEllipse(20, 9, 34, 10);
		g.fillStyle(C('#8a8478'), 1); // frost-sorted stones, all a size
		for (let i = 0; i < 26; i++) g.fillCircle(4 + ((i * 7) % 35), 7 + ((i * 11) % 11), 1.4 + (i % 3) * 0.3);
		g.fillStyle(C('#b8b2a4'), 1);
		for (let i = 0; i < 16; i++) g.fillCircle(6 + ((i * 13) % 31), 8 + ((i * 5) % 9), 1.1);
		g.fillStyle(C('#a3b06a'), 0.75); // thin lichen crusts holding it together
		g.fillEllipse(11, 10, 9, 3.4).fillEllipse(26, 8, 8, 3).fillEllipse(19, 15, 9, 3.2).fillEllipse(33, 13, 7, 2.8);
		g.fillStyle(C('#c9a05f'), 0.6).fillEllipse(15, 7, 5, 2).fillEllipse(30, 15, 4.5, 2);
	});
	// Rock Crack: a dark slot under a loose scree slab, running back further than
	// the daylight reaches.
	o('screecrack', 40, 26, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillEllipse(20, 20, 40, 12); // scree below
		g.fillStyle(C('#7b7166'), 1).fillTriangle(2, 16, 34, 3, 38, 11).fillTriangle(2, 16, 38, 11, 7, 19); // the loose slab
		g.fillStyle(C('#8f8579'), 1).fillTriangle(3, 15, 33, 4, 35, 8).fillTriangle(3, 15, 35, 8, 6, 17); // its lit top
		g.fillStyle(C('#0d0b09'), 1).fillTriangle(5, 19, 36, 11, 38, 17).fillTriangle(5, 19, 38, 17, 9, 21); // the slot
		g.fillStyle(0x000000, 0.5).fillTriangle(9, 20, 34, 13, 35, 16); // and it keeps going back
		g.fillStyle(C('#a8a29a'), 1).fillCircle(36, 20, 5).fillCircle(4, 21, 4.5); // scree at each end
		g.fillStyle(C('#8a847a'), 1).fillCircle(14, 23, 3.4).fillCircle(24, 24, 3);
	});

	// Medium Chest: plainly the bigger of the two — wider, banded, and stouter.
	o('mediumchest', 34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 1).fillEllipse(17, 25, 30, 5); // shadow
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(2, 10, 30, 15, 2); // the body
		g.fillStyle(C('#83684a'), 1).fillRoundedRect(2, 4, 30, 8, 3); // domed lid
		g.fillStyle(C('#95795a'), 1).fillRoundedRect(3, 4, 28, 3.4, 2);
		g.fillStyle(C('#5c4630'), 1).fillRect(2, 11.5, 30, 1.6); // the lid seam
		g.fillStyle(C('#8a8478'), 1); // iron banding — this is the sturdier one
		g.fillRect(7, 4, 2.6, 21).fillRect(24, 4, 2.6, 21);
		g.fillStyle(C('#a39d90'), 1).fillRect(7, 4, 1, 21).fillRect(24, 4, 1, 21);
		g.fillStyle(C('#c9a95f'), 1).fillRoundedRect(14, 12, 6, 5, 1); // hasp
		g.fillStyle(C('#7f6a34'), 1).fillCircle(17, 15, 1.4);
	});

	// The four remaining restoration kits share a crate base but carry different
	// contents on top — which is the only thing that distinguishes them in the
	// fiction too, since they differ solely by the biome they open.
	// Migration Path Marker: cairn stones and a route marker rather than supplies.
	o('kitmarker', 34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4); // shadow
		g.fillStyle(C('#8a8478'), 1).fillRoundedRect(3, 10, 28, 15, 2); // crate
		g.fillStyle(C('#9d86d9'), 1).fillRect(3, 14, 28, 4); // route-marker livery
		g.lineStyle(1, C('#6f6a62'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25);
		g.fillStyle(C('#a8a29a'), 1).fillEllipse(11, 8, 12, 5).fillEllipse(11, 4, 9, 4).fillEllipse(11, 1, 6, 3); // cairn
		g.fillStyle(C('#c2bcb2'), 1).fillEllipse(10, 7, 7, 2).fillEllipse(10, 3.4, 5, 1.6);
		g.fillStyle(C('#7f6ab0'), 1).fillRect(24, 0, 2, 10); // the marker post
		g.fillStyle(C('#b7a5e6'), 1).fillTriangle(26, 1, 32, 3.4, 26, 6);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
	});
	// Forest Restoration Kit: seed mixes and a coil of fibre twine.
	o('kitforest', 34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(3, 10, 28, 15, 2);
		g.fillStyle(C('#8fbf6f'), 1).fillRect(3, 14, 28, 4);
		g.lineStyle(1, C('#5c4630'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25);
		g.fillStyle(C('#6b8a44'), 1).fillRect(10.4, 5, 1.2, 5); // a seedling
		g.fillStyle(C('#8fbf6f'), 1).fillEllipse(11, 6, 13, 7);
		g.fillStyle(C('#a3d086'), 1).fillEllipse(10, 4, 8, 4.4);
		g.fillStyle(C('#c9b48c'), 1).fillEllipse(24, 7, 11, 6); // twine
		g.lineStyle(1, C('#a3906a'), 1).strokeEllipse(24, 7, 8, 4).strokeEllipse(24, 7, 4.4, 2.2);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
	});
	// Scrubland Restoration Kit: bundled hardy cuttings and a sediment sled.
	o('kitscrub', 34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4);
		g.fillStyle(C('#8a7050'), 1).fillRoundedRect(3, 10, 28, 15, 2);
		g.fillStyle(C('#6aa884'), 1).fillRect(3, 14, 28, 4);
		g.lineStyle(1, C('#6b5540'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25);
		g.fillStyle(C('#6aa884'), 1);
		for (const x of [8, 11, 14]) g.fillRect(x, 1, 1.8, 9); // cuttings
		g.fillStyle(C('#8fc7a8'), 1).fillEllipse(8.9, 1.6, 4, 2.4).fillEllipse(14.9, 1.6, 4, 2.4);
		g.fillStyle(C('#9a7448'), 1).fillRect(6, 5, 11, 1.6); // the tie
		g.fillStyle(C('#a8a29a'), 1).fillTriangle(21, 9, 31, 9, 26, 2); // sediment sled
		g.fillStyle(C('#c2bcb2'), 1).fillTriangle(22.4, 8, 29.6, 8, 26, 3.6);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
	});
	// Alpine Restoration Kit: shade cloth, climbing gear and a water cache.
	o('kitalpine', 34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4);
		g.fillStyle(C('#7d6a4e'), 1).fillRoundedRect(3, 10, 28, 15, 2);
		g.fillStyle(C('#d6a96a'), 1).fillRect(3, 14, 28, 4);
		g.lineStyle(1, C('#5f5140'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25);
		g.fillStyle(C('#d6a96a'), 1).fillEllipse(10, 6, 14, 7); // folded shade cloth
		g.fillStyle(C('#e8c894'), 1).fillEllipse(10, 4, 12, 3.4);
		g.lineStyle(1, C('#b58a4e'), 1).lineBetween(4, 6, 16, 6).lineBetween(5, 8, 15, 8);
		g.lineStyle(1.6, C('#8a8478'), 1).strokeCircle(24, 5, 4.2); // a carabiner
		g.fillStyle(C('#6fa8d6'), 1).fillRoundedRect(29, 4, 5, 6, 1.5); // water cache
		g.fillStyle(C('#9fd0e8'), 1).fillRect(30, 5, 3, 1.6);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
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
const a = (key: string, w: number, h: number, draw: (g: G) => void) => {
	ANIMAL_SPRITES[key] = { w, h, draw };
};

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
		// Mule deer. The ears are the whole point — outsized and held wide, which is
		// where the name comes from — so they stand clear of the skull instead of
		// merging into it. Long muzzle, a neck that rises, and the white rump with
		// the narrow black-tipped tail that tells it from a whitetail.
		// Everything stays inside 0..34 x 0..32: the texture and the journal's SVG
		// viewBox are both exactly that, so anything drawn past it loses its tips.
		g.fillStyle(C('#8a6a44'), 1); // legs, a shade darker than the coat
		g.fillRect(8, 23, 3, 8.5).fillRect(13, 24, 2.6, 7.5).fillRect(19, 23, 3, 8.5);
		g.fillStyle(C('#9a7548'), 1).fillEllipse(4.2, 20.5, 3.2, 8); // tail, set behind the rump
		g.fillStyle(C('#2e2018'), 1).fillEllipse(4.2, 23.2, 3.2, 2.8); // and its black tip
		g.fillStyle(C('#b08a5c'), 1).fillEllipse(15, 17.5, 23, 14); // body
		g.fillEllipse(22.5, 13.5, 10, 13); // neck, rising toward the head
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(7.5, 17, 8, 9.5); // white rump patch, inside the flank
		g.fillStyle(C('#b08a5c'), 1);
		g.fillEllipse(21, 4.8, 5, 8.6).fillEllipse(29.6, 4.8, 5, 8.6); // the big mule ears
		g.fillStyle(C('#8a6a44'), 1);
		g.fillEllipse(21.3, 5.2, 2.4, 5.4).fillEllipse(29.3, 5.2, 2.4, 5.4); // inner ear
		g.fillStyle(C('#b08a5c'), 1).fillEllipse(26, 9.2, 11, 9); // head
		g.fillStyle(C('#9a7548'), 1).fillEllipse(29.8, 11.4, 7, 5); // long muzzle
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(30.4, 12.6, 4.6, 2.2); // pale band around the mouth
		g.fillStyle(0x2e2018, 1).fillCircle(27.6, 8.4, 1.3); // eye
		g.fillEllipse(32.4, 10.8, 2.2, 1.8); // nose
	});
	a('fox', 32, 26, (g) => {
		g.fillStyle(C('#46301f'), 1).fillRect(9, 19, 3, 6).fillRect(14, 20, 3, 6).fillRect(20, 19, 3, 6); // dark-socked legs
		g.fillStyle(C('#d3722e'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6);
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillEllipse(6, 16, 12, 8); // tail
		g.fillStyle(0xffffff, 1).fillCircle(3, 15, 3).fillEllipse(24, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	});
	a('grayfox', 32, 26, (g) => {
		g.fillStyle(C('#4a4640'), 1).fillRect(9, 19, 3, 6).fillRect(14, 20, 3, 6).fillRect(20, 19, 3, 6); // legs
		g.fillStyle(C('#8d8b84'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6); // grizzled grey body
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillStyle(C('#6e6b64'), 1).fillEllipse(6, 16, 12, 8); // darker tail
		g.fillStyle(C('#2b2b28'), 1).fillRect(3, 14, 9, 2); // black stripe along the tail
		g.fillStyle(C('#b4682f'), 1).fillEllipse(22, 15, 8, 5).fillCircle(28, 8, 2.4); // rusty neck and ear backs
		g.fillStyle(0xffffff, 1).fillEllipse(25, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	});
	a('snail', 30, 24, (g) => {
		// Dark grey body: the old cream one washed out against both meadow palettes
		// (healthy green AND dry tan), so the snail read as a shell floating alone.
		// Faces right, like every other animal in the set.
		g.fillStyle(C('#5e5b56'), 1).fillEllipse(21, 19, 18, 7); // soft foot
		g.fillCircle(26, 16, 3.2); // head
		g.fillStyle(C('#7a766f'), 1).fillEllipse(21, 17.6, 15, 2.6); // lighter crease along the top of the foot
		g.fillStyle(C('#5e5b56'), 1);
		g.lineStyle(1.4, C('#5e5b56'), 1).lineBetween(26, 14, 29, 6).lineBetween(24, 14, 22, 6); // eye stalks
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 5, 1.5).fillCircle(22, 5, 1.5); // eyes on stalk tips
		g.fillStyle(C('#3f6fa8'), 1).fillCircle(12, 12, 11); // big blue shell
		g.fillStyle(C('#5b8fc9'), 1).fillCircle(12, 12, 8);
		g.fillStyle(C('#2c5183'), 1).fillCircle(12, 12, 5);
		g.fillStyle(C('#7fb0e0'), 1).fillCircle(12, 12, 2.4); // spiral centre
		g.fillStyle(0xffffff, 0.3).fillEllipse(16, 7, 7, 3.5); // shine
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
			[4, 11, 3],
			[7, 8, 3.3],
			[11, 7, 3.5],
			[15, 8, 3.5],
			[19, 10, 3.5],
			[23, 12, 3.4],
			[26, 10, 3.3],
		];
		for (const [x, y, r] of body) g.fillCircle(x, y, r);
		g.fillCircle(29, 8, 4); // head
		g.lineStyle(1, C('#c0392b'), 1).lineBetween(33, 8, 36, 6).lineBetween(33, 8, 36, 10); // forked tongue
		g.fillStyle(0x2e2018, 1).fillCircle(30, 7, 1); // eye
	});
	a('owl', 26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillStyle(C('#6b5238'), 1);
		g.fillTriangle(4, 0, 11, 11, 1, 12).fillTriangle(22, 0, 25, 12, 15, 11); // big ear tufts — the 'horns'
		g.fillStyle(C('#8d7050'), 1).fillTriangle(5, 3, 9, 11, 3, 11).fillTriangle(21, 3, 23, 11, 17, 11);
		g.fillStyle(C('#7c6248'), 1);
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
	a('mantis', 30, 24, (g) => {
		g.lineStyle(1.4, C('#4f7429'), 1);
		g.lineBetween(11, 13, 7, 21).lineBetween(7, 21, 4, 22); // back legs, down to the ground
		g.lineBetween(15, 13, 13, 21).lineBetween(13, 21, 10, 22);
		g.lineBetween(18, 12, 18, 20).lineBetween(18, 20, 15, 22); // middle pair
		g.fillStyle(C('#4f7429'), 1).fillEllipse(8, 11, 13, 6); // long abdomen, angled up
		g.fillStyle(C('#4a6b28'), 1).fillEllipse(13, 11, 16, 6); // wing case over it
		g.lineStyle(0.8, C('#4a6b28'), 1).lineBetween(7, 10, 19, 11); // wing seam
		g.fillStyle(C('#4a6b28'), 1).fillEllipse(21, 10, 8, 4.5); // thorax reaching the head
		g.lineStyle(2.2, C('#4a6b28'), 1);
		g.lineBetween(22, 11, 26, 15).lineBetween(26, 15, 21, 17); // folded raptorial forelegs
		g.lineBetween(21, 11, 25, 16).lineBetween(25, 16, 20, 18);
		g.fillStyle(C('#6f9c3e'), 1).fillTriangle(24, 5, 29, 9, 23, 12); // triangular head
		g.fillStyle(C('#2e2018'), 1).fillCircle(27.4, 7.6, 1.3).fillCircle(24.4, 7.2, 1.1); // the two big eyes
		g.lineStyle(0.9, C('#4f7429'), 1).lineBetween(26, 5, 29, 1).lineBetween(24, 5, 24, 1); // antennae
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
		for (const [x, y] of [
			[8, 8],
			[13, 6],
			[18, 8],
			[11, 10],
			[17, 11],
		] as const)
			g.fillCircle(x, y, 1.3);
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
		g.fillStyle(C('#4a5a2c'), 1)
			.fillCircle(8, 9, 1.3)
			.fillCircle(14, 8, 1.3)
			.fillCircle(11, 13, 1.3)
			.fillCircle(16, 12, 1.3); // spots
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
		const cx = 12,
			cy = 12,
			R = 11;
		for (let i = 0; i < 5; i++) {
			const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
			const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
			const a0 = ((i - 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
			g.fillTriangle(
				cx,
				cy,
				cx + Math.cos(a0) * R * 0.6,
				cy + Math.sin(a0) * R * 0.6,
				cx + Math.cos(ang) * R,
				cy + Math.sin(ang) * R,
			);
			g.fillTriangle(
				cx,
				cy,
				cx + Math.cos(a2) * R * 0.6,
				cy + Math.sin(a2) * R * 0.6,
				cx + Math.cos(ang) * R,
				cy + Math.sin(ang) * R,
			);
		}
		g.fillStyle(C('#e8825a'), 1).fillCircle(cx, cy, 4); // webbed center
		g.fillStyle(C('#b53a1f'), 1).fillCircle(cx, cy, 1.4);
	});

	// --- Custom sprites for species that were falling through to generics ----
	a('barnowl', 26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillTriangle(5, 6, 9, 12, 3, 12).fillTriangle(21, 6, 23, 12, 17, 12); // small tufts
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(13, 20, 12, 14);
		g.fillStyle(0xf4e3b1, 1).fillCircle(9, 12, 3.4).fillCircle(17, 12, 3.4);
		g.fillStyle(0x2e2018, 1).fillCircle(9, 12, 1.6).fillCircle(17, 12, 1.6);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(13, 14, 11, 17, 15, 17);
	});
	a('lynx', 34, 28, (g) => {
		// Read from the extremes: stub tail, oversized paws, ear tufts. The ruff is a
		// soft halo BEHIND the head — drawn as forward triangles it looked like fangs.
		g.fillStyle(C('#a9a396'), 1).fillEllipse(6, 14, 11, 7); // stubby tail
		g.fillStyle(C('#2a2622'), 1).fillEllipse(2.5, 14, 5, 6); // black tail tip
		g.fillStyle(C('#8f8a7e'), 1).fillRect(10, 19, 4.5, 6).fillRect(19, 19, 4.5, 6); // front and hind legs
		g.fillStyle(C('#cfcabd'), 1).fillEllipse(12.2, 25, 10, 5).fillEllipse(21.2, 25, 10, 5); // huge snowshoe paws
		g.fillStyle(C('#b8b2a6'), 1).fillEllipse(16, 15, 22, 14); // body
		g.fillStyle(C('#8f8a7e'), 0.55).fillCircle(12, 12, 1.6).fillCircle(18, 16, 1.5).fillCircle(9, 17, 1.3); // faint spots
		g.fillStyle(C('#e6e2d8'), 1).fillEllipse(25, 13, 17, 13); // cheek ruff, framing the face
		g.fillStyle(C('#b8b2a6'), 1).fillCircle(25, 10, 6.6); // head, sitting over the ruff
		g.fillTriangle(20, 2, 23.5, 8.5, 18.5, 8.5).fillTriangle(30, 2, 31.5, 8.5, 26.5, 8.5); // ears
		g.fillStyle(C('#2a2622'), 1).fillTriangle(20.6, -1, 22.4, 3, 19.4, 3).fillTriangle(29.6, -1, 31, 3, 28.2, 3); // black tufts
		g.fillStyle(C('#e6e2d8'), 1).fillEllipse(26, 13, 8, 5); // pale muzzle
		g.fillStyle(C('#2e2018'), 1).fillCircle(23, 9.5, 1.2).fillCircle(28, 9.5, 1.2); // eyes
		g.fillStyle(C('#3a2a22'), 1).fillTriangle(26, 11.4, 24.8, 13, 27.2, 13); // nose
	});
	a('grizzly', 48, 32, (g) => {
		g.fillStyle(C('#5a4028'), 1)
			.fillRect(12, 20, 6, 11)
			.fillRect(20, 21, 5.5, 10)
			.fillRect(29, 20, 6, 11)
			.fillRect(35, 21, 5.5, 10); // four heavy legs
		g.fillStyle(C('#4a3420'), 1)
			.fillEllipse(15, 30.5, 8, 3)
			.fillEllipse(22.7, 30.5, 7.5, 3)
			.fillEllipse(32, 30.5, 8, 3)
			.fillEllipse(37.7, 30.5, 7.5, 3); // broad paws
		g.fillStyle(C('#7a5636'), 1).fillEllipse(24, 18, 34, 15); // long barrel body
		g.fillEllipse(31, 11, 17, 11); // the shoulder hump, part of the same silhouette
		g.fillStyle(C('#6b4a2e'), 1).fillEllipse(24, 22, 26, 6); // shaded underside
		g.fillStyle(C('#7a5636'), 1).fillCircle(39, 17, 7); // head carried low and forward
		g.fillCircle(34.5, 10.5, 2.8).fillCircle(41.5, 9.8, 2.8); // small round ears
		g.fillStyle(C('#5a4028'), 1).fillCircle(34.5, 10.5, 1.3).fillCircle(41.5, 9.8, 1.3);
		g.fillStyle(C('#a8845a'), 1).fillEllipse(44, 20, 8, 5); // pale dished muzzle
		g.fillStyle(C('#1f1710'), 1).fillCircle(46.6, 18.6, 1.4); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(37.5, 15.4, 1.2).fillCircle(42.4, 15.2, 1.2); // small deep-set eyes
		g.fillStyle(C('#e8dcc4'), 1)
			.fillTriangle(13, 31, 14.4, 31, 13.7, 32.6)
			.fillTriangle(16, 31, 17.4, 31, 16.7, 32.6)
			.fillTriangle(30, 31, 31.4, 31, 30.7, 32.6); // the long front claws
	});
	a('orca', 38, 28, (g) => {
		// the tall dorsal fin is the read; black over a sharply cut white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(15, 14, 20, 0, 24, 14); // tall triangular dorsal fin
		g.fillTriangle(1, 9, 8, 16, 1, 15).fillTriangle(1, 23, 8, 16, 1, 17); // tail flukes
		g.fillEllipse(19, 17, 32, 13); // black body, blunt-headed
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(20, 20.5, 26, 5); // sharp white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(19, 20, 27, 22, 20, 27); // pectoral flipper
		g.fillStyle(C('#6a6f76'), 0.75).fillEllipse(13, 13, 10, 4); // grey saddle behind the fin
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(31, 13.5, 6.5, 3); // white eye patch
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 16, 1.2); // eye
	});
	a('graywhale', 40, 24, (g) => {
		// mottled grey, no dorsal fin at all — only a low knuckled ridge
		g.fillStyle(C('#767b7c'), 1).fillTriangle(1, 6, 10, 13, 1, 12).fillTriangle(1, 20, 10, 13, 1, 14); // broad flukes
		g.fillEllipse(20, 13, 30, 12); // heavy body
		g.fillTriangle(30, 8, 39, 14, 30, 19); // long tapering head
		g.fillStyle(C('#8e9394'), 1)
			.fillCircle(10, 8, 1.8)
			.fillCircle(13.5, 7.4, 1.8)
			.fillCircle(17, 7.2, 1.8)
			.fillCircle(20.5, 7.6, 1.6); // knuckled ridge where a fin would be
		g.fillStyle(C('#9aa0a0'), 0.65).fillEllipse(16, 16, 11, 5).fillEllipse(25, 10, 8, 4); // grey mottling
		g.fillStyle(C('#d8d2bf'), 1).fillCircle(32, 11, 2.2).fillCircle(35, 13, 1.7).fillCircle(33, 16, 1.5); // barnacle crust
		g.fillStyle(C('#5f6465'), 1).fillTriangle(22, 18, 30, 20, 23, 23); // paddle flipper
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 15.5, 1); // small eye
	});
	a('octopus', 32, 30, (g) => {
		// Arms are dense overlapping circles so they read as smooth tapering tentacles
		// rather than a string of beads.
		const arms: [number, number, number, number][] = [
			[13, 19, -9, 10],
			[15, 20, -4, 11],
			[17, 20, 4, 11],
			[19, 19, 9, 10],
		];
		for (const [sx, sy, dx, dy] of arms) {
			for (let t = 0; t <= 1.001; t += 0.09) {
				const x = sx + dx * t + Math.sin(t * 3) * dx * 0.18;
				const y = sy + dy * t;
				g.fillStyle(C(t < 0.5 ? '#a85a70' : '#93495d'), 1).fillCircle(x, y, 3 - t * 1.9);
			}
		}
		g.fillStyle(C('#c07087'), 1).fillEllipse(16, 11, 19, 21); // tall sac-shaped mantle
		g.fillStyle(C('#cf7f95'), 1).fillEllipse(14, 7, 11, 9); // highlight
		g.fillStyle(C('#a85a70'), 1).fillEllipse(16, 18, 16, 7); // head, where the arms meet
		g.fillStyle(C('#e8cdbc'), 1).fillEllipse(11, 16, 4, 2.8).fillEllipse(21, 16, 4, 2.8);
		g.fillStyle(C('#2e2018'), 1).fillCircle(11, 16, 1.2).fillCircle(21, 16, 1.2);
	});
	a('moth', 34, 26, (g) => {
		// broad triangular wings held flat, fat furry body — nothing bee-like
		g.fillStyle(C('#8d8272'), 1).fillTriangle(17, 8, 1, 7, 5, 19).fillTriangle(17, 8, 33, 7, 29, 19); // broad forewings, held flat
		g.fillStyle(C('#6f6557'), 1).fillTriangle(17, 14, 6, 19, 14, 24).fillTriangle(17, 14, 28, 19, 20, 24); // hindwings
		g.fillStyle(C('#5a5044'), 0.55).fillTriangle(3, 10, 15, 9, 4, 14).fillTriangle(31, 10, 19, 9, 30, 14); // muted wing bands
		g.fillStyle(C('#cfc4ae'), 1).fillCircle(8, 12, 2.8); // single eyespot
		g.fillStyle(C('#4a4038'), 1).fillCircle(8, 12, 1.2);
		g.fillStyle(C('#5a5044'), 1).fillEllipse(17, 15, 7, 16); // fat furry body
		g.fillStyle(C('#7a6f5e'), 1).fillCircle(17, 9, 3.6).fillCircle(17, 5.4, 2.4); // furry thorax + small head
		g.lineStyle(1.6, C('#4a4038'), 1).lineBetween(16, 5, 10, 2).lineBetween(18, 5, 24, 2); // antenna shafts
		g.lineStyle(1, C('#4a4038'), 1);
		for (let i = 1; i <= 3; i++)
			g.lineBetween(16 - i * 2, 5 - i * 0.75, 16 - i * 2, 2.4 - i * 0.75).lineBetween(
				18 + i * 2,
				5 - i * 0.75,
				18 + i * 2,
				2.4 - i * 0.75,
			); // feathery comb teeth
	});
	a('javelina', 34, 26, (g) => {
		// pig-shaped: barrel on stubby legs, wedge head low, pale shoulder collar
		g.fillStyle(C('#332f2a'), 1).fillRect(8, 18, 4, 8).fillRect(14, 18, 4, 8).fillRect(20, 18, 4, 8); // short stumpy legs
		g.fillStyle(C('#5b554b'), 1).fillEllipse(15, 13, 24, 14); // barrel body
		g.fillStyle(C('#cdc2ab'), 1).fillEllipse(23, 12, 5, 14); // pale collar band across the shoulders
		g.lineStyle(1.2, C('#2b2823'), 1);
		g.lineBetween(7, 8, 6, 4).lineBetween(11, 7, 10, 3).lineBetween(15, 6.5, 15, 2.5).lineBetween(19, 7, 19, 3); // coarse bristly back
		g.fillStyle(C('#4a443c'), 1).fillTriangle(24, 7, 33, 17, 23, 19); // big wedge head, held low
		g.fillStyle(C('#3a352f'), 1).fillTriangle(23.5, 6, 28, 5, 26, 10); // small ear
		g.fillStyle(C('#241f1b'), 1).fillCircle(31.5, 16, 2); // flat snout disc
		g.fillStyle(C('#2e2018'), 1).fillCircle(27, 11, 1.2); // eye
	});
	a('crayfish', 36, 26, (g) => {
		// two big pincers held forward, segmented abdomen ending in a tail fan
		g.fillStyle(C('#8e3a24'), 1).fillTriangle(1, 6, 9, 13, 1, 20); // tail fan
		g.fillStyle(C('#a8492c'), 1).fillEllipse(9, 13, 6, 8).fillEllipse(13, 13, 6, 9.5).fillEllipse(17, 13, 6, 11); // segmented abdomen
		g.lineStyle(1.4, C('#7a2f1c'), 1)
			.lineBetween(19, 17, 17, 22)
			.lineBetween(23, 18, 22, 23)
			.lineBetween(26, 18, 26, 23); // walking legs
		g.fillStyle(C('#b8563a'), 1).fillEllipse(24, 13, 14, 12); // carapace
		g.fillStyle(C('#a8492c'), 1).fillEllipse(29, 7, 10, 4).fillEllipse(29, 19, 10, 4); // claw arms thrown forward
		g.fillStyle(C('#c46248'), 1).fillEllipse(33, 5, 7, 5.5).fillEllipse(33, 21, 7, 5.5); // big pincers
		g.lineStyle(1, C('#6e2a18'), 1).lineBetween(30.5, 5, 36, 3.5).lineBetween(30.5, 21, 36, 22.5); // pincer gape
		g.lineStyle(1, C('#7a2f1c'), 1).lineBetween(30, 10, 20, 2).lineBetween(30, 16, 18, 24); // long antennae
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 11, 1.1).fillCircle(29, 15, 1.1); // stalked eyes
	});
	a('shrimp', 26, 24, (g) => {
		// small, translucent, curled into a comma; many tiny legs, long antennae
		g.lineStyle(1, C('#b8a892'), 1).lineBetween(20, 5, 3, 1).lineBetween(20, 7, 1, 7); // long trailing antennae
		g.fillStyle(C('#efe2d2'), 0.85)
			.fillCircle(18, 8, 5)
			.fillCircle(13, 11, 4.6)
			.fillCircle(9, 15, 4)
			.fillCircle(10, 20, 3.2); // translucent comma body
		g.fillStyle(C('#efe2d2'), 0.65).fillTriangle(11, 21, 17, 23, 16, 18); // tail fan
		g.fillStyle(C('#d6c1a6'), 0.6).fillEllipse(15, 10, 9, 3); // faint gut line showing through
		g.lineStyle(1, C('#c8b7a0'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(18 - i * 1.8, 12 + i * 2, 21 - i * 1.8, 13.5 + i * 2); // many tiny legs
		g.fillStyle(C('#2e2018'), 1).fillCircle(20, 6, 1.3); // dark eye
	});
	a('pillbug', 26, 22, (g) => {
		// overlapping armour plates in a domed row, partly curled forward
		g.lineStyle(1.2, C('#3a3e44'), 1);
		for (let i = 0; i < 7; i++) g.lineBetween(4 + i * 2.6, 17, 3 + i * 2.6, 21); // seven pairs of legs
		g.fillStyle(C('#4e535a'), 1).fillEllipse(13, 13, 24, 16); // domed slate body
		g.fillStyle(C('#646a72'), 1);
		for (let i = 0; i < 6; i++) g.fillEllipse(5 + i * 3.2, 11 + i * 0.6, 6.4, 13 - i); // overlapping armour plates
		g.lineStyle(1, C('#33373c'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(8 + i * 3.2, 5.5 + i * 1, 8 + i * 3.2, 18); // plate seams
		g.fillStyle(C('#3f444a'), 1).fillEllipse(22, 14, 7, 10); // head end tucking under as it curls
		g.lineStyle(1, C('#3a3e44'), 1).lineBetween(24, 11, 25, 8); // short antenna
		g.fillStyle(C('#2e2018'), 1).fillCircle(23.5, 12, 1); // eye
	});
	a('bananaslug', 34, 22, (g) => {
		// long soft yellow body with dark speckles, eye stalks up, slime behind
		g.fillStyle(C('#d6e0cc'), 0.5).fillEllipse(12, 19, 22, 4); // glistening slime trail
		g.fillStyle(C('#e3c451'), 1).fillEllipse(17, 13, 28, 10).fillEllipse(27, 11, 12, 9); // long body + raised head end
		g.fillStyle(C('#e3c451'), 1).fillTriangle(2, 13, 8, 9, 8, 17); // tapered tail
		g.fillStyle(C('#efd97a'), 1).fillEllipse(15, 10, 15, 5); // pale mantle saddle
		g.fillStyle(C('#6b5a1e'), 1)
			.fillCircle(9, 13, 1.3)
			.fillCircle(15, 12, 1.2)
			.fillCircle(20, 15, 1.3)
			.fillCircle(24, 10, 1.1)
			.fillCircle(12, 16, 1.1); // dark speckles
		g.lineStyle(1.6, C('#e3c451'), 1).lineBetween(30, 9, 32, 3).lineBetween(27, 9, 28, 4); // raised eye stalks
		g.fillStyle(C('#2e2018'), 1).fillCircle(32, 3, 1.2).fillCircle(28, 4, 1.1); // eye dots on the stalks
	});
	a('snowflea', 24, 18, (g) => {
		// Just the animal — no ground under it, the way every other sprite is drawn.
		g.lineStyle(1.2, C('#2b2f36'), 1).lineBetween(11, 11, 7, 14).lineBetween(7, 14, 12, 15); // furcula, the springing tail fork
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(13, 12, 12, 16).lineBetween(17, 12, 17.5, 16); // stubby legs
		g.fillStyle(C('#2b2f36'), 1).fillEllipse(15, 9, 12, 8); // dark rounded body
		g.fillStyle(C('#3d434c'), 1).fillCircle(20, 8, 3.2); // head
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(21.5, 6, 23, 2.5); // antenna
		g.fillStyle(C('#e8eef4'), 1).fillCircle(20.6, 7, 1); // pale eye
	});
	a('beachhopper', 28, 24, (g) => {
		// sand-coloured and laterally flattened, curled like a comma mid-jump
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(19, 5, 27, 1).lineBetween(19, 7, 27, 8); // long antennae
		g.fillStyle(C('#d9c49b'), 1).fillCircle(16, 8, 5.6).fillCircle(11, 12, 5).fillCircle(9, 18, 4.2); // flattened body curled forward
		g.fillStyle(C('#d9c49b'), 0.9).fillTriangle(9, 21, 15, 23, 12, 17); // tail flick
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(13, 4, 10, 10).lineBetween(8, 8, 5, 14).lineBetween(5, 15, 7, 20); // segment seams down the flank
		g.lineStyle(1.6, C('#c2ab84'), 1).lineBetween(17, 12, 22, 18).lineBetween(22, 18, 18, 22); // big kicking hind leg
		g.lineStyle(1, C('#c2ab84'), 1);
		for (let i = 0; i < 4; i++) g.lineBetween(17 - i * 2, 12 + i * 1.6, 20 - i * 2, 15 + i * 1.6); // small legs
		g.fillStyle(C('#2e2018'), 1).fillCircle(19, 6, 1.2); // eye
	});
	a('hermitcrab', 30, 26, (g) => {
		// the borrowed shell is the read — the crab spills out of its mouth
		g.fillStyle(C('#c9a978'), 1).fillCircle(11, 14, 10); // outer whorl of the coiled shell
		g.fillStyle(C('#dcbe8e'), 1).fillCircle(9, 11, 6.8); // second whorl
		g.fillStyle(C('#c9a978'), 1).fillCircle(11, 8.5, 4.4); // third whorl
		g.fillStyle(C('#dcbe8e'), 1).fillCircle(9.5, 6.5, 2.6).fillCircle(11, 5, 1.4); // whorls tightening to the apex
		g.lineStyle(1, C('#a8865a'), 1).lineBetween(3, 17, 19, 19).lineBetween(4, 10, 17, 13); // ridges spiralling round the shell
		g.fillStyle(C('#8e7146'), 1).fillEllipse(18, 19, 10, 11); // dark shell mouth
		g.lineStyle(1.8, C('#a8442e'), 1).lineBetween(19, 22, 23, 25).lineBetween(22, 21, 27, 23); // legs emerging
		g.fillStyle(C('#a8442e'), 1).fillEllipse(23, 19, 9, 6).fillEllipse(27, 17, 6, 5); // claw reaching out
		g.lineStyle(1.4, C('#a8442e'), 1).lineBetween(20, 16, 22, 11).lineBetween(23, 16, 26, 12); // eye stalks
		g.fillStyle(C('#2e2018'), 1).fillCircle(22, 10.5, 1.2).fillCircle(26, 11.5, 1.2); // eyes
	});
	a('termite', 30, 20, (g) => {
		// pale soft segmented body, broad-waisted (no ant pinch), dark jawed head
		g.lineStyle(1.4, C('#c9b48e'), 1);
		g.lineBetween(8, 14, 6, 19).lineBetween(13, 14, 12, 19).lineBetween(19, 14, 18, 19); // three legs below
		g.lineBetween(9, 7, 7, 2).lineBetween(14, 6, 13, 1).lineBetween(19, 7, 18, 2); // three legs above
		g.fillStyle(C('#e6dcc6'), 1).fillEllipse(11, 10, 19, 11); // pale swollen abdomen
		g.lineStyle(1, C('#cbbfa4'), 1).lineBetween(6, 6, 6, 14).lineBetween(10, 5, 10, 15).lineBetween(14, 5.5, 14, 14.5); // soft body segments
		g.fillStyle(C('#e6dcc6'), 1).fillEllipse(20, 10, 9, 10); // thorax, as broad as the waist
		g.fillStyle(C('#8a5a34'), 1).fillCircle(25, 10, 4.6); // hard dark head
		g.fillStyle(C('#5e3a20'), 1).fillTriangle(28, 6.5, 30, 9, 26.5, 9.5).fillTriangle(28, 13.5, 30, 11, 26.5, 10.5); // jaws
		g.lineStyle(1, C('#8a5a34'), 1).lineBetween(27, 7, 29, 3); // short antenna
		g.fillStyle(C('#2e2018'), 1).fillCircle(26, 8.5, 1); // eye
	});
	a('millipede', 32, 28, (g) => {
		// a long tube wound into a loose spiral, fringed with many tiny legs
		const seg: [number, number, number][] = [];
		for (let i = 0; i < 24; i++) {
			const t = i / 23,
				ang = t * Math.PI * 2.4 - Math.PI * 0.55;
			seg.push([16 + Math.cos(ang) * (12.5 - t * 7.5), 14 + Math.sin(ang) * (12.5 - t * 7.5) * 0.8, ang]);
		}
		g.lineStyle(1, C('#3a1a12'), 1);
		for (const [x, y, ang] of seg) g.lineBetween(x, y, x + Math.cos(ang) * 3.8, y + Math.sin(ang) * 3.4); // dense fringe of legs
		g.fillStyle(C('#6b3020'), 1);
		for (const [x, y] of seg) g.fillCircle(x, y, 3.2); // dark red-brown segmented tube
		g.fillStyle(C('#8a4028'), 0.7);
		for (const [x, y] of seg) g.fillCircle(x, y - 0.7, 1.5); // lighter ridge along the back
		g.fillStyle(C('#4a2014'), 1).fillCircle(seg[0][0], seg[0][1], 3.6); // head at the free end of the coil
		g.fillStyle(C('#2e2018'), 1).fillCircle(seg[0][0] + 1, seg[0][1] + 1, 1); // eye
	});
	a('skunk', 34, 24, (g) => {
		g.fillStyle(C('#17161a'), 1).fillRect(11, 17, 3.4, 6).fillRect(17, 17, 3.4, 6).fillRect(23, 17, 3.4, 6); // short legs
		g.fillStyle(C('#1b1a1f'), 1).fillEllipse(8, 10, 13, 20); // big plume tail, held up
		g.fillStyle(0xffffff, 1).fillEllipse(7, 7, 8, 13); // white blaze up the tail
		g.fillStyle(C('#1b1a1f'), 1).fillEllipse(19, 15, 24, 13); // low body
		g.fillStyle(0xffffff, 1).fillRect(13, 9, 13, 3.6); // the two white back stripes
		g.fillStyle(C('#1b1a1f'), 1).fillRect(18.5, 9, 2.4, 3.6); // split down the middle
		g.fillStyle(C('#1b1a1f'), 1).fillTriangle(27, 9, 34, 15, 27, 19); // wedge head
		g.fillStyle(0xffffff, 1).fillRect(28, 9, 1.8, 6); // thin white stripe down the face
		g.fillStyle(C('#2e2018'), 1).fillCircle(30, 13, 1.1); // eye
		g.fillStyle(C('#0d0d10'), 1).fillCircle(33.4, 14.6, 1.2); // nose
	});
	a('lunamoth', 34, 32, (g) => {
		g.fillStyle(C('#9fd88f'), 1);
		g.fillEllipse(10, 11, 15, 12).fillEllipse(24, 11, 15, 12); // broad forewings
		g.fillEllipse(11, 19, 12, 11).fillEllipse(23, 19, 12, 11); // hindwings
		g.fillTriangle(9, 22, 13, 22, 6, 32).fillTriangle(21, 22, 25, 22, 28, 32); // the long trailing tails
		g.fillStyle(C('#7fbf72'), 1).fillRect(4, 8, 26, 1.6); // leading edge
		g.fillStyle(C('#e8f2c9'), 1).fillEllipse(17, 15, 5, 17); // furry pale body
		g.fillStyle(C('#f2e6a8'), 1).fillCircle(10, 12, 2).fillCircle(24, 12, 2); // eyespots
		g.fillStyle(C('#4a3a22'), 1).fillCircle(10, 12, 0.9).fillCircle(24, 12, 0.9);
		g.lineStyle(1.2, C('#c9a24a'), 1).lineBetween(16, 7, 12, 2).lineBetween(18, 7, 22, 2); // feathery antennae
		g.fillStyle(C('#2e2018'), 1).fillCircle(15.6, 7, 0.9).fillCircle(18.4, 7, 0.9);
	});
	a('polyphemus', 34, 28, (g) => {
		g.fillStyle(C('#c08b52'), 1);
		g.fillTriangle(17, 6, 2, 10, 14, 17).fillTriangle(17, 6, 32, 10, 20, 17); // forewings held flat
		g.fillStyle(C('#a97442'), 1);
		g.fillEllipse(9, 19, 15, 11).fillEllipse(25, 19, 15, 11); // hindwings
		g.fillStyle(C('#e0c295'), 1).fillRect(3, 9, 28, 1.4); // pale wing band
		g.fillStyle(C('#6b4a8a'), 1).fillCircle(9, 19, 4).fillCircle(25, 19, 4); // the big purple eyespots
		g.fillStyle(C('#f0e6d2'), 1).fillCircle(9, 19, 2.4).fillCircle(25, 19, 2.4);
		g.fillStyle(C('#241a12'), 1).fillCircle(9, 19, 1.1).fillCircle(25, 19, 1.1);
		g.fillStyle(C('#8a6238'), 1).fillEllipse(17, 15, 5, 15); // furry body
		g.lineStyle(1.6, C('#7a5a34'), 1).lineBetween(16, 7, 11, 3).lineBetween(18, 7, 23, 3); // big comb antennae
	});
	a('parnassian', 30, 26, (g) => {
		// The wings are near-transparent, which vanishes against the journal's pale
		// card — so they get a drawn edge to hold their shape.
		g.fillStyle(0xffffff, 0.88);
		g.fillEllipse(9, 11, 15, 13).fillEllipse(21, 11, 15, 13); // forewings
		g.fillEllipse(10, 18, 12, 10).fillEllipse(20, 18, 12, 10); // hindwings
		g.lineStyle(1.1, C('#6f6d66'), 1);
		g.strokeEllipse(9, 11, 15, 13).strokeEllipse(21, 11, 15, 13); // outline
		g.strokeEllipse(10, 18, 12, 10).strokeEllipse(20, 18, 12, 10);
		g.fillStyle(C('#4a4a48'), 1).fillEllipse(4, 8, 6, 3).fillEllipse(26, 8, 6, 3); // smoky wingtips
		g.fillStyle(C('#c8402f'), 1).fillCircle(9, 18, 2.4).fillCircle(21, 18, 2.4); // red warning spots
		g.fillStyle(0xffffff, 1).fillCircle(9, 18, 1).fillCircle(21, 18, 1);
		g.fillStyle(C('#3a3a38'), 1).fillEllipse(15, 14, 4, 14); // dark furry body
		g.lineStyle(1.1, C('#2e2e2c'), 1).lineBetween(14, 7, 10, 2).lineBetween(16, 7, 20, 2); // antennae
	});
	a('puffin', 26, 30, (g) => {
		g.fillStyle(C('#e0812f'), 1).fillEllipse(9, 28, 7, 3.5).fillEllipse(17, 28, 7, 3.5); // orange webbed feet
		g.fillStyle(C('#22201f'), 1).fillEllipse(13, 16, 18, 24); // black back and crown
		g.fillStyle(0xffffff, 1).fillEllipse(14, 20, 14, 18); // white breast
		g.fillStyle(C('#d8d5cf'), 1).fillCircle(13, 9, 7); // pale grey face patch
		g.fillStyle(C('#22201f'), 1).fillEllipse(13, 3, 15, 6); // black cap over the top
		g.fillStyle(C('#e8e5df'), 1).fillTriangle(19, 6, 26, 11, 19, 15); // the big beak, pale outer half
		g.fillStyle(C('#e0812f'), 1).fillTriangle(19, 7, 24, 11, 19, 14); // orange inner half
		g.fillStyle(C('#c23b2e'), 1).fillTriangle(19, 8, 21.5, 11, 19, 13); // red base
		g.lineStyle(0.9, C('#8a7f70'), 1).lineBetween(21, 8.4, 21, 13.4); // the groove across it
		g.fillStyle(C('#2e2018'), 1).fillEllipse(13, 8, 3.4, 3.8); // the sad-looking eye
		g.fillStyle(0xffffff, 1).fillCircle(12.3, 7.2, 0.9);
	});
	a('ladybeetle', 24, 22, (g) => {
		g.fillStyle(C('#1e1c1a'), 1).fillRect(4, 16, 2, 4).fillRect(11, 17, 2, 4).fillRect(18, 16, 2, 4); // six little legs
		g.fillStyle(C('#c8342b'), 1).fillCircle(12, 11, 9); // domed red shell
		g.fillStyle(C('#a8241d'), 1).fillRect(11.2, 3, 1.6, 17); // the split down the wing cases
		g.fillStyle(C('#1e1c1a'), 1);
		g.fillCircle(7, 8, 2).fillCircle(17, 8, 2).fillCircle(6, 14, 1.8).fillCircle(18, 14, 1.8).fillCircle(12, 16, 1.6); // spots
		g.fillStyle(C('#1e1c1a'), 1).fillEllipse(12, 3, 11, 6); // black head and pronotum
		g.fillStyle(0xffffff, 1).fillCircle(8, 2.6, 1.6).fillCircle(16, 2.6, 1.6); // the two white cheek patches
		g.fillStyle(C('#1e1c1a'), 1).fillCircle(9.6, 4.4, 0.9).fillCircle(14.4, 4.4, 0.9); // eyes
		g.lineStyle(1, C('#1e1c1a'), 1).lineBetween(9, 1, 6, -1).lineBetween(15, 1, 18, -1); // antennae
	});
	a('groundhog', 34, 26, (g) => {
		g.fillStyle(C('#6b5334'), 1).fillEllipse(6, 18, 10, 6); // low bushy tail
		g.fillStyle(C('#4a3a24'), 1).fillRect(12, 19, 4, 5).fillRect(21, 19, 4, 5); // stubby legs
		g.fillStyle(C('#7d6140'), 1).fillEllipse(17, 15, 26, 14); // heavy barrel body
		g.fillStyle(C('#94764e'), 1).fillEllipse(17, 12, 22, 7); // grizzled lighter back
		g.fillStyle(C('#7d6140'), 1).fillCircle(28, 12, 6.4); // blunt head
		g.fillStyle(C('#5e4a2e'), 1).fillCircle(26, 6.5, 2.4).fillCircle(31, 7, 2.4); // small round ears
		g.fillStyle(C('#a68a60'), 1).fillEllipse(31, 14, 7, 5); // pale muzzle
		g.fillStyle(C('#e8e2d2'), 1).fillRect(32, 14.6, 2.6, 2.4); // the big front teeth
		g.fillStyle(C('#241a12'), 1).fillCircle(33.6, 13, 1); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(28, 11, 1.2); // eye
	});
	a('opossum', 36, 26, (g) => {
		g.lineStyle(2.6, C('#d8c8b8'), 1).lineBetween(5, 18, 1, 11); // naked pink tail
		g.fillStyle(C('#3a3a38'), 1).fillRect(13, 18, 3.4, 5).fillRect(21, 18, 3.4, 5); // dark feet
		g.fillStyle(C('#9a9690'), 1).fillEllipse(17, 15, 24, 13); // grizzled grey body
		g.fillStyle(C('#c4c0b8'), 1).fillEllipse(17, 13, 20, 7); // pale guard hairs on top
		g.fillStyle(C('#f2eee6'), 1).fillTriangle(24, 8, 36, 14, 24, 18); // long pale wedge face
		g.fillStyle(C('#3a3a38'), 1).fillEllipse(24, 8, 5, 5).fillEllipse(27, 6, 4.5, 4.5); // big bare black ears
		g.fillStyle(C('#e8b8c0'), 1).fillCircle(35, 13.6, 1.3); // pink nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 11, 1.2); // small dark eye
		g.fillStyle(0xffffff, 1).fillTriangle(33, 15, 35, 15, 34, 17); // a tooth showing
	});
	a('crow', 30, 24, (g) => {
		g.fillStyle(C('#1a1a1e'), 1).fillRect(12, 18, 2, 5).fillRect(17, 18, 2, 5); // legs
		g.fillStyle(C('#22222a'), 1).fillEllipse(15, 13, 24, 13); // body
		g.fillTriangle(2, 9, 9, 13, 3, 16); // squared-off tail
		g.fillStyle(C('#2e2e38'), 1).fillEllipse(14, 11, 16, 7); // folded wing
		g.fillStyle(C('#3a3a46'), 0.7).fillEllipse(13, 9, 11, 3); // faint blue-black sheen
		g.fillStyle(C('#22222a'), 1).fillCircle(23, 9, 5.4); // head
		g.fillStyle(C('#141418'), 1).fillTriangle(27, 6.5, 30, 9.4, 27, 12); // stout straight bill
		g.fillStyle(C('#c9c4bb'), 1).fillCircle(23.6, 8, 1.5); // pale eye
		g.fillStyle(C('#141418'), 1).fillCircle(23.6, 8, 0.8);
	});
	a('sanddollar', 26, 26, (g) => {
		g.fillStyle(C('#6b4f7a'), 1).fillCircle(13, 13, 11); // living ones are purple, not bleached white
		g.fillStyle(C('#7d5f8d'), 1).fillCircle(13, 13, 9.4);
		g.fillStyle(C('#5a4168'), 1).fillCircle(13, 13, 1.6); // centre
		g.fillStyle(C('#9b7fa8'), 1);
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * 6.283 - 1.571;
			const px = 13 + Math.cos(a) * 5,
				py = 13 + Math.sin(a) * 5;
			g.fillEllipse(px, py, 4.4, 7.2); // the five petals
		}
		g.fillStyle(C('#5a4168'), 1);
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * 6.283 - 1.571;
			g.fillEllipse(13 + Math.cos(a) * 5, 13 + Math.sin(a) * 5, 1.2, 4.4); // slit down each petal
		}
		g.lineStyle(0.7, C('#4a3556'), 0.8);
		for (let i = 0; i < 24; i++) {
			const a = (i / 24) * 6.283;
			g.lineBetween(13 + Math.cos(a) * 10, 13 + Math.sin(a) * 10, 13 + Math.cos(a) * 11.6, 13 + Math.sin(a) * 11.6); // spine fringe
		}
	});
	// A coyote, not a cougar: bushy low-slung tail, tall pointed ears, long narrow
	// muzzle. (The cougar is `mountainlion` below — flatter head, wide-set ears,
	// long heavy tail.)
	a('coyote', 38, 30, (g) => {
		g.fillStyle(C('#8a7355'), 1).fillEllipse(6, 19, 13, 7); // low bushy tail
		g.fillStyle(C('#5f4d38'), 1).fillEllipse(3, 21, 5, 5); // dark tail tip
		g.fillStyle(C('#7d6749'), 1).fillRect(12, 18, 4, 9).fillRect(18, 19, 4, 8).fillRect(24, 18, 4, 9); // long legs
		g.fillStyle(C('#6b563d'), 1)
			.fillEllipse(14, 26.5, 5.6, 3)
			.fillEllipse(20, 26.5, 5.6, 3)
			.fillEllipse(26, 26.5, 5.6, 3); // paws
		g.fillStyle(C('#9a8163'), 1).fillEllipse(19, 16, 26, 13); // lean body
		g.fillStyle(C('#b39a78'), 1).fillEllipse(19, 19, 22, 6); // pale underside
		g.fillStyle(C('#9a8163'), 1).fillCircle(30, 11, 6.4); // head
		g.fillTriangle(26, 1, 29.5, 8, 24.5, 8).fillTriangle(33.5, 1, 35.5, 8, 30.5, 8); // tall pointed ears
		g.fillStyle(C('#c4ae8d'), 1).fillTriangle(33, 10, 38, 14, 33, 15); // long narrow muzzle
		g.fillStyle(C('#7d6749'), 1).fillTriangle(26.6, 2.6, 28.8, 7.4, 25.4, 7.4); // ear shading
		g.fillStyle(C('#2b2118'), 1).fillCircle(37.2, 13.2, 1.2); // nose
		g.fillStyle(C('#c9a24a'), 1).fillEllipse(30, 10.4, 3, 2.2).fillEllipse(34, 11, 2.6, 2); // yellow eyes
		g.fillStyle(C('#2b2118'), 1).fillCircle(30, 10.4, 0.9).fillCircle(34, 11, 0.8);
	});
	a('mountainlion', 46, 30, (g) => {
		g.fillStyle(C('#b3945f'), 1).fillEllipse(9, 18, 16, 4.5).fillEllipse(3, 21, 9, 4); // long tail
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(1.5, 22, 5, 3.6);
		g.fillStyle(C('#a8875a'), 1)
			.fillRect(12, 19, 3.6, 9)
			.fillRect(18, 20, 3.6, 8)
			.fillRect(28, 19, 3.6, 9)
			.fillRect(33, 20, 3.6, 8); // longer legs
		g.fillStyle(C('#8f7048'), 1)
			.fillEllipse(13.8, 28, 5.4, 2.6)
			.fillEllipse(19.8, 28, 5.4, 2.6)
			.fillEllipse(29.8, 28, 5.4, 2.6)
			.fillEllipse(34.8, 28, 5.4, 2.6);
		g.fillStyle(C('#c2a068'), 1).fillEllipse(24, 16, 32, 10); // lean body
		g.fillEllipse(14, 16, 11, 10).fillEllipse(31, 15, 10, 10); // slighter haunch and shoulder
		g.fillStyle(C('#d8bc8c'), 1).fillEllipse(24, 19, 21, 3.4); // belly line
		g.fillStyle(C('#c2a068'), 1).fillEllipse(38, 12, 12, 10); // wider, flatter cat head
		g.fillTriangle(33, 5, 37, 10, 32.5, 10).fillTriangle(43, 5, 44, 10, 39.5, 10); // ears set wide
		g.fillStyle(C('#8f7048'), 1)
			.fillTriangle(33.6, 6.6, 36, 9.6, 33.2, 9.6)
			.fillTriangle(42.4, 6.6, 43.2, 9.6, 40.4, 9.6);
		g.fillStyle(C('#f0e2c8'), 1).fillEllipse(39.5, 15, 6, 3.6); // small muzzle
		g.fillStyle(C('#8f7048'), 1).fillEllipse(36.8, 13.4, 1.1, 2).fillEllipse(42.2, 13.4, 1.1, 2); // soft cheek shading
		g.fillStyle(C('#241a12'), 1).fillTriangle(39.5, 13.2, 38.6, 14.4, 40.4, 14.4); // nose
		g.fillStyle(C('#c9a24a'), 1).fillEllipse(35.6, 11.4, 2.8, 2).fillEllipse(40.4, 11.4, 2.8, 2); // eyes
		g.fillStyle(C('#241a12'), 1).fillCircle(35.6, 11.4, 0.9).fillCircle(40.4, 11.4, 0.9);
	});
	a('rocksquirrel', 30, 26, (g) => {
		g.fillStyle(C('#9a8a68'), 1).fillEllipse(6, 14, 11, 16); // full bushy tail held up
		g.fillStyle(C('#b8a882'), 1).fillEllipse(6, 14, 7, 12);
		g.fillStyle(C('#8a7a58'), 1).fillRect(13, 18, 3.6, 6).fillRect(19, 18, 3.6, 6); // legs
		g.fillStyle(C('#a89568'), 1).fillEllipse(17, 15, 20, 12); // body
		g.fillStyle(C('#e0d2b0'), 1).fillEllipse(13, 8, 9, 4).fillEllipse(21, 8, 9, 4); // pale mantle over the shoulders
		g.fillStyle(C('#a89568'), 1).fillCircle(24, 11, 5.4); // head
		g.fillStyle(C('#8a7a58'), 1).fillCircle(22.5, 6.6, 2.2); // small round ear
		g.fillStyle(C('#e0d2b0'), 1).fillEllipse(27, 13, 6, 4); // pale cheek
		g.fillStyle(C('#241a12'), 1).fillCircle(29, 12.4, 1); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(25, 10, 1.2); // eye
	});
	a('swift', 32, 20, (g) => {
		g.fillStyle(C('#22222a'), 1).fillEllipse(16, 11, 15, 7); // slim body, built for speed
		g.fillTriangle(14, 9, 1, 1, 11, 13).fillTriangle(18, 9, 31, 1, 21, 13); // long scythe wings swept back
		g.fillStyle(0xffffff, 1).fillEllipse(15, 12, 7, 5); // white throat and belly stripe
		g.fillStyle(C('#22222a'), 1).fillCircle(22, 9, 3.6); // head
		g.fillTriangle(3, 15, 12, 12, 6, 18); // forked tail
		g.fillStyle(0xffffff, 1).fillEllipse(22, 11, 4, 2.4); // white throat patch
		g.fillStyle(C('#141418'), 1).fillTriangle(25, 8, 27, 9.2, 25, 10); // tiny bill
		g.fillStyle(C('#e8e4dc'), 1).fillCircle(22.4, 8, 1.1); // eye
		g.fillStyle(C('#141418'), 1).fillCircle(22.4, 8, 0.6);
	});
	a('kangaroorat', 32, 24, (g) => {
		g.lineStyle(1.8, C('#c9ab7c'), 1).lineBetween(7, 16, 2, 8); // long tail sweeping up
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(2, 6, 4, 5); // dark tail tuft
		g.fillStyle(C('#c9ab7c'), 1).fillEllipse(12, 15, 15, 11); // heavy hind haunch
		g.fillStyle(C('#b8996a'), 1).fillRect(10, 19, 4, 4); // hind foot, flat on the ground
		g.fillEllipse(11.5, 22.5, 7, 2.6);
		g.fillStyle(C('#c9ab7c'), 1).fillEllipse(20, 14, 16, 10); // body, low and level
		g.fillStyle(C('#e8d8b4'), 1).fillEllipse(20, 17, 13, 4); // pale underside
		g.fillStyle(C('#b8996a'), 1).fillRect(19, 18, 2.6, 4).fillRect(23, 18, 2.6, 4); // two forelegs, both down
		g.fillStyle(C('#c9ab7c'), 1).fillCircle(27, 11, 5.6); // big head
		g.fillEllipse(25, 5.6, 3.4, 4.6).fillEllipse(29.5, 5.8, 3.2, 4.4); // tall rounded ears
		g.fillStyle(C('#e8d8b4'), 1).fillEllipse(30, 13, 5, 3.4); // pale cheek pouch
		g.fillStyle(C('#2e2018'), 1).fillCircle(28.6, 9.6, 1.5); // big dark night eye
		g.fillStyle(C('#3a2c1c'), 1).fillCircle(31.6, 12.4, 0.9); // nose
		g.lineStyle(0.6, C('#e8d8b4'), 1).lineBetween(31, 12, 34, 10).lineBetween(31, 13, 34, 14); // whiskers
	});
	a('urchin', 30, 30, (g) => {
		g.lineStyle(2, C('#4a2d6b'), 1);
		for (let i = 0; i < 20; i++) {
			const a = (i / 20) * 6.283;
			g.lineBetween(15 + Math.cos(a) * 6, 15 + Math.sin(a) * 6, 15 + Math.cos(a) * 14.5, 15 + Math.sin(a) * 14.5); // long spines
		}
		g.lineStyle(1.4, C('#6b3f96'), 1);
		for (let i = 0; i < 20; i++) {
			const a = ((i + 0.5) / 20) * 6.283;
			g.lineBetween(15 + Math.cos(a) * 6, 15 + Math.sin(a) * 6, 15 + Math.cos(a) * 11, 15 + Math.sin(a) * 11); // shorter spines between
		}
		g.fillStyle(C('#5a3480'), 1).fillCircle(15, 15, 7.5); // test
		g.fillStyle(C('#7a4aa8'), 1).fillCircle(15, 15, 6);
		g.fillStyle(C('#9b6bc9'), 1).fillCircle(13, 13, 2.6); // sheen
		g.fillStyle(C('#3d2359'), 1).fillCircle(15, 15, 1.8); // mouth at the centre
	});
	a('bluejay', 30, 26, (g) => {
		g.fillStyle(C('#9ecdea'), 1).fillTriangle(2, 12, 12, 14, 3, 18); // tail
		g.fillStyle(C('#7fb8dd'), 1).fillRect(3, 13.4, 9, 1).fillRect(3, 16, 8, 1); // tail barring
		g.fillStyle(C('#a8d4f0'), 1).fillEllipse(15, 14, 20, 13); // light blue body
		g.fillStyle(C('#f2f6fa'), 1).fillEllipse(15, 17, 15, 7); // pale breast
		g.fillStyle(C('#8fc4e8'), 1).fillEllipse(13, 12, 13, 7); // folded wing
		g.fillStyle(C('#6fa8d4'), 1).fillRect(8, 10.4, 10, 1).fillRect(8, 12.6, 9, 1); // wing bars
		g.fillStyle(C('#a8d4f0'), 1).fillCircle(23, 9, 5.4); // head
		g.fillTriangle(20, 5, 24, 1, 26, 6); // crest
		g.fillStyle(C('#f2f6fa'), 1).fillEllipse(24.5, 10.5, 7, 5); // white face
		g.fillStyle(C('#2b2b30'), 1).fillEllipse(20.5, 13.4, 8, 1.4); // thin black necklace
		g.fillEllipse(20.4, 9.4, 1.3, 4.6); // narrow black line behind the eye
		g.fillTriangle(27, 8.6, 30, 9.8, 27, 11); // bill
		g.fillStyle(C('#2e2018'), 1).fillCircle(23.6, 8.6, 1.2); // eye
		g.fillStyle(C('#6fa8d4'), 1).fillRect(13, 20, 1.6, 4).fillRect(18, 20, 1.6, 4); // legs
	});

	// Generic bodies by kind. Each kind gets three silhouette variants so that,
	// combined with a unique per-animal tint and size, even same-kind animals
	// read as distinct individuals rather than copies of one another.
	for (let v = 0; v < 3; v++) {
		a(`mammal-${v}`, 28, 22, (g) => {
			const bw = 15 + v * 3;
			g.fillStyle(0xffffff, 1).fillRect(7, 16, 3, 5).fillRect(16, 16, 3, 5); // legs
			g.fillEllipse(13, 14, bw, 11).fillCircle(20, 9, 5);
			if (v === 0)
				g.fillCircle(18, 4, 2.4).fillCircle(22, 4, 2.4); // round ears
			else if (v === 1)
				g.fillEllipse(18, 3, 3, 7).fillEllipse(22, 3, 3, 7); // tall ears
			else g.fillTriangle(16, 5, 19, 0, 21, 5).fillTriangle(20, 5, 23, 0, 25, 5); // pointed ears
			if (v === 0)
				g.fillEllipse(4, 13, 5, 4); // stub tail
			else if (v === 1)
				g.fillEllipse(3, 12, 10, 4); // long tail
			else g.fillCircle(4, 12, 4.5); // bushy tail
			g.fillStyle(0x2e2018, 1).fillCircle(21, 8, 1.2);
		});
		a(`bird-${v}`, 24, 20, (g) => {
			g.fillStyle(0xffffff, 1)
				.fillEllipse(10, 11, 13 + v * 2, 11)
				.fillCircle(16, 6, 4);
			g.fillStyle(0xe3c75f, 1).fillTriangle(19, 6, 23, 7, 19, 9);
			g.fillStyle(0xffffff, 1);
			if (v === 1)
				g.fillTriangle(1, 8, 8, 11, 2, 15); // long tail
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
			g.fillStyle(0xffffff, 1)
				.fillEllipse(13, 8, 16 + v * 2, 7)
				.fillCircle(21, 7, 3.4);
			g.fillEllipse(3, 8, 8 + v * 2, 3.4); // tail
			if (v === 2) g.fillRect(9, 11, 2, 3).fillRect(16, 11, 2, 3); // little legs
			g.fillStyle(0x2e2018, 1).fillCircle(22, 6, 1);
		});
		a(`amphibian-${v}`, 24, 16, (g) => {
			g.fillStyle(0xffffff, 1)
				.fillEllipse(11, 10, 15 + v * 2, 9)
				.fillCircle(16, 6, 4);
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
	'red-fox': 'ani-fox',
	'gray-fox': 'ani-grayfox',
	lynx: 'ani-lynx',
	'tree-squirrel': 'ani-squirrel',
	woodpecker: 'ani-woodpecker',
	'forest-salamander': 'ani-salamander',
	'tiger-salamander': 'ani-salamander',
	'great-horned-owl': 'ani-owl',
	'barn-owl': 'ani-barnowl',
	'black-bear': 'ani-bear',
	raccoon: 'ani-raccoon',
	'grizzly-bear': 'ani-grizzly',
	// newer animals — each gets its own bespoke sprite
	'praying-mantis': 'ani-mantis',

	snail: 'ani-snail',
	'purple-sea-urchin': 'ani-urchin',
	'kangaroo-rat': 'ani-kangaroorat',
	'mountain-lion': 'ani-mountainlion',
	'rock-squirrel': 'ani-rocksquirrel',
	'white-throated-swift': 'ani-swift',
	coyote: 'ani-coyote',
	'sand-dollar': 'ani-sanddollar',
	crow: 'ani-crow',
	ladybug: 'ani-ladybeetle',
	groundhog: 'ani-groundhog',
	opossum: 'ani-opossum',
	puffin: 'ani-puffin',
	'luna-moth': 'ani-lunamoth',
	'polyphemus-moth': 'ani-polyphemus',
	'alpine-butterfly': 'ani-parnassian',
	skunk: 'ani-skunk',
	'blue-jay': 'ani-bluejay',
	orca: 'ani-orca',
	'gray-whale': 'ani-graywhale',
	octopus: 'ani-octopus',
	'alpine-moth': 'ani-moth',
	javelina: 'ani-javelina',
	crayfish: 'ani-crayfish',
	'freshwater-shrimp': 'ani-shrimp',
	pillbug: 'ani-pillbug',
	'banana-slug': 'ani-bananaslug',
	'snow-flea': 'ani-snowflea',
	'beach-hopper': 'ani-beachhopper',
	'hermit-crab': 'ani-hermitcrab',
	'desert-termite': 'ani-termite',
	'desert-millipede': 'ani-millipede',
	'brown-bat': 'ani-bat',
	towhee: 'ani-towhee',
	merganser: 'ani-merganser',
	phainopepla: 'ani-phainopepla',
	'black-turnstone': 'ani-turnstone',
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
	const BODY = 0xffffff; // tintable body colour
	const DK = 0x2e2018; // eyes / dark detail
	const draw = (fn: (g: G) => void) => fn;

	// --- Producers and decomposers ---------------------------------------------
	// Plants, fungi, lichens and seaweeds are living things in the journal, so they
	// need to read as themselves. Without this they fall through to the generic
	// quadruped and a mushroom arrives looking like a small brown animal.
	if (kind === 'plant' || kind === 'fungus' || kind === 'lichen' || kind === 'algae') {
		// Mushrooms and bracket fungi: cap, stem, gills.
		if (kind === 'fungus') {
			const bracket = t(/turkey-tail|shelf|bracket/);
			return {
				w: 30,
				h: 28,
				draw: draw((g) => {
					if (bracket) {
						g.fillStyle(C('#6b543a'), 1).fillRect(3, 4, 4, 22); // trunk it grows on
						for (const [y, w] of [
							[8, 18],
							[14, 15],
							[20, 12],
						] as [number, number][]) {
							g.fillStyle(C('#c8a86a'), 1).fillEllipse(7 + w / 2, y, w, 7);
							g.fillStyle(C('#e0cba0'), 1).fillEllipse(7 + w / 2, y - 1, w - 5, 3.5);
						}
						return;
					}
					g.fillStyle(C('#e8dcc2'), 1).fillRect(13, 13, 5, 12); // stem
					g.fillStyle(C('#d8c8a8'), 1).fillRect(13, 13, 2, 12);
					g.fillStyle(C('#efe3c8'), 1).fillEllipse(15.5, 15, 17, 5); // gills under the cap
					g.lineStyle(0.8, C('#c9b691'), 1);
					for (const x of [9, 12, 15, 19, 22]) g.lineBetween(x, 13.5, x, 16.5);
					g.fillStyle(C(t(/mushroom|agaricus|meadow/) ? '#c9805c' : '#a8683f'), 1).fillEllipse(15.5, 11, 24, 15); // cap
					g.fillStyle(0xffffff, 0.22).fillEllipse(11, 8, 10, 5); // highlight
					g.fillStyle(C('#8f5136'), 1).fillEllipse(15.5, 15, 24, 3.5); // cap rim shadow
				}),
			};
		}
		// Lichen: crusty rosette clinging to a pebble.
		if (kind === 'lichen') {
			return {
				w: 28,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 14, 24, 14); // rock
					g.fillStyle(C('#a8a29a'), 1).fillEllipse(10, 11, 10, 6);
					g.fillStyle(C('#9fb38a'), 1).fillCircle(11, 12, 5).fillCircle(19, 14, 4).fillCircle(15, 8, 3.2);
					g.fillStyle(C('#c9d98f'), 1).fillCircle(11, 12, 3).fillCircle(19, 14, 2.2);
					g.fillStyle(C('#5f6b4a'), 1).fillCircle(11, 12, 1).fillCircle(19, 14, 0.9); // dark centres
				}),
			};
		}
		// Kelp and seaweed: long blades rising from a holdfast, with floats.
		if (kind === 'algae' || t(/kelp|seaweed|surfgrass|eelgrass/)) {
			return {
				w: 26,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(C('#3f5c33'), 1).fillEllipse(13, 31, 14, 6); // holdfast
					g.lineStyle(2.2, C('#4f7a3f'), 1);
					g.lineBetween(13, 30, 10, 4);
					g.lineBetween(13, 30, 17, 8);
					for (const [x, y, w2, h2] of [
						[7, 10, 9, 5],
						[19, 14, 9, 5],
						[6, 19, 8, 4],
						[20, 23, 8, 4],
					] as [number, number, number, number][])
						g.fillStyle(C('#6d9a4e'), 1).fillEllipse(x, y, w2, h2); // blades
					g.fillStyle(C('#b7cf7a'), 1).fillCircle(10, 5, 3).fillCircle(17, 9, 2.4); // gas floats
				}),
			};
		}
		// Columnar cactus.
		if (t(/saguaro|cactus|cholla|prickly/)) {
			return {
				w: 28,
				h: 36,
				draw: draw((g) => {
					g.fillStyle(C('#4f7a44'), 1).fillRect(11, 6, 8, 28); // trunk
					g.fillEllipse(15, 7, 8, 7);
					g.fillRect(4, 18, 5, 10).fillEllipse(6.5, 18, 5, 5); // arms
					g.fillRect(21, 14, 5, 12).fillEllipse(23.5, 14, 5, 5);
					g.fillStyle(C('#3f6437'), 1).fillRect(13, 6, 1.6, 28); // ribs
					g.fillStyle(C('#f2ead6'), 1).fillCircle(15, 5, 3).fillCircle(6.5, 16, 2); // blossoms
				}),
			};
		}
		// Trees.
		if (t(/oak|hemlock|pine|willow|cypress|fir|aspen|tree/)) {
			const conifer = t(/hemlock|pine|fir|cypress/);
			return {
				w: 32,
				h: 36,
				draw: draw((g) => {
					g.fillStyle(C('#6b543a'), 1).fillRect(14, 20, 5, 15); // trunk
					if (conifer) {
						g.fillStyle(C('#3f6b46'), 1);
						g.fillTriangle(16, 2, 5, 17, 27, 17);
						g.fillTriangle(16, 10, 3, 26, 29, 26);
						g.fillStyle(C('#4f7f55'), 1).fillTriangle(16, 6, 8, 16, 24, 16);
					} else {
						g.fillStyle(C('#4f8043'), 1).fillCircle(16, 14, 13);
						g.fillStyle(C('#5f9450'), 1).fillCircle(11, 11, 7).fillCircle(21, 13, 6);
						g.fillStyle(C('#3e6a37'), 1).fillCircle(19, 19, 5);
					}
				}),
			};
		}
		// Cattail / reed / rush: blades with a brown spike.
		if (t(/cattail|reed|rush|bulrush/)) {
			return {
				w: 26,
				h: 36,
				draw: draw((g) => {
					g.lineStyle(2, C('#6f9a4e'), 1);
					g.lineBetween(8, 35, 5, 10);
					g.lineBetween(18, 35, 21, 12);
					g.lineBetween(13, 35, 13, 6);
					g.fillStyle(C('#7d5a3a'), 1).fillEllipse(13, 9, 6, 13); // the sausage
					g.fillStyle(C('#946c46'), 1).fillEllipse(12, 7, 3, 7);
					g.lineStyle(1.6, C('#8fae63'), 1).lineBetween(13, 4, 13, 0); // tip
				}),
			};
		}
		// Grasses and low turf: a tuft of blades with seed heads.
		if (t(/grama|grass|sedge|turf|muhly|campion|moss/)) {
			return {
				w: 30,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.8, C('#7fa34e'), 1);
					for (const [x, tipx] of [
						[7, 3],
						[11, 9],
						[15, 15],
						[19, 22],
						[23, 27],
					] as [number, number][])
						g.lineBetween(x, 25, tipx, 5);
					g.fillStyle(C('#c3b06a'), 1);
					for (const [x, y] of [
						[3, 5],
						[9, 4],
						[22, 6],
					] as [number, number][])
						g.fillEllipse(x, y, 7, 3); // seed heads
					g.fillStyle(C('#5f7f3c'), 1).fillEllipse(15, 25, 22, 5); // base
				}),
			};
		}
		// Default flowering plant: stem, leaves, a cluster of blooms.
		const petal = t(/milkweed/) ? '#d98cae' : t(/sunflower|marigold|arnica/) ? '#e8bf3f' : '#c98fd0';
		return {
			w: 28,
			h: 34,
			draw: draw((g) => {
				g.lineStyle(2, C('#5f8a44'), 1).lineBetween(14, 33, 14, 10);
				g.fillStyle(C('#6d9a4e'), 1).fillEllipse(7, 22, 12, 6).fillEllipse(21, 26, 12, 6); // leaves
				g.fillStyle(C(petal), 1);
				g.fillCircle(14, 9, 6).fillCircle(8, 13, 4).fillCircle(20, 13, 4); // bloom cluster
				g.fillStyle(C('#f2e6c0'), 1).fillCircle(14, 9, 2.4);
			}),
		};
	}

	if (kind === 'mammal') {
		if (t(/porcupine|hedgehog/)) {
			return {
				w: 38,
				h: 30,
				draw: draw((g) => {
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
					g.lineBetween(10, 15, 12, 9).lineBetween(16, 14, 18, 8).lineBetween(22, 15, 24, 10);
				}),
			};
		}

		// Fixed natural accent colours layered over the tintable body.
		const NOSE = 0x1a1410;

		// --- Cetaceans: smooth spindle body, flukes, dorsal fin, a flipper ---
		if (t(/whale|dolphin|porpoise/)) {
			const dolphin = t(/dolphin|porpoise/);
			return {
				w: 42,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(21, 12, 32, 13); // spindle body
					g.fillTriangle(2, 5, 10, 12, 2, 12); // upper fluke
					g.fillTriangle(2, 19, 10, 12, 2, 12); // lower fluke
					g.fillTriangle(19, 5, 24, 12, 14, 12); // dorsal fin
					g.fillTriangle(23, 15, 31, 15, 24, 21); // pectoral flipper
					if (dolphin)
						g.fillTriangle(35, 10, 42, 12, 35, 14); // rostrum/beak
					else {
						g.fillStyle(0x000000, 0.12).fillEllipse(24, 9, 22, 5);
					} // mottled back
					g.fillStyle(0xffffff, 0.28).fillEllipse(20, 16, 22, 5); // pale belly
					g.fillStyle(DK, 1).fillCircle(dolphin ? 33 : 32, 10, 1.1);
				}),
			};
		}
		// --- Seals: plump torpedo, fore-flippers, rear-flipper V, dog-like head ---
		if (t(/seal|sea-lion|walrus/)) {
			return {
				w: 38,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillTriangle(2, 8, 11, 14, 2, 15).fillTriangle(2, 20, 11, 14, 2, 15); // rear flippers
					g.fillEllipse(19, 15, 30, 15); // body
					g.fillCircle(31, 11, 5.4); // head
					g.fillEllipse(35, 12, 5, 4); // snout
					g.fillTriangle(16, 22, 24, 17, 25, 24); // fore-flipper
					if (t(/harbor|spotted/)) {
						g.fillStyle(0x000000, 0.22);
						for (const [x, y] of [
							[12, 11],
							[18, 13],
							[24, 11],
							[15, 17],
							[22, 16],
						] as const)
							g.fillCircle(x, y, 1.3);
					}
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1);
					g.fillStyle(DK, 1).fillCircle(31, 10, 1.2);
				}),
			};
		}
		// --- Otters (river & sea): long-bodied, four short legs, thick tapering
		//     tail — walking, since they move around on land and in water ---
		if (t(/otter/)) {
			const sea = t(/sea-otter/);
			return {
				w: 40,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 16, 17, 8); // thick tapering tail
					g.fillRect(13, 18, 3.6, 6).fillRect(19, 18, 3.6, 6).fillRect(25, 18, 3.6, 6).fillRect(30, 18, 3.6, 6); // four legs
					g.fillEllipse(21, 14, 28, sea ? 15 : 13); // long low body (sea otter bulkier)
					g.fillCircle(33, 11, 5.2); // rounded head
					g.fillCircle(30, 6.5, 1.8).fillCircle(35.5, 6.5, 1.8); // small round ears
					g.fillStyle(C('#e8dcc6'), 0.55).fillEllipse(33, 13, 7, 5); // pale muzzle/throat
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
					g.fillStyle(DK, 1).fillCircle(33, 10, 1.2);
				}),
			};
		}
		// --- American badger: low broad body, short digging legs, and the
		//     signature face — white median stripe over a black-masked face ---
		if (t(/badger/)) {
			return {
				w: 40,
				h: 26,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(9, 19, 4, 6).fillRect(15, 19, 4, 6).fillRect(25, 20, 4, 5).fillRect(31, 20, 4, 5); // short sturdy legs
					g.fillEllipse(18, 13, 32, 15); // broad, low, flat-backed body
					g.fillStyle(0xffffff, 0.14).fillEllipse(16, 9, 25, 7); // grizzled sheen along the back
					g.fillStyle(BODY, 1);
					g.fillCircle(31, 13, 5.4); // head (small, held low & forward)
					g.fillTriangle(35, 11, 39, 14, 35, 17); // pointed snout
					g.fillCircle(28, 8, 1.9); // small ear
					// face: a round dark cheek badge with a white eye-spot inside it,
					// plus the white median stripe running from the crown to the nose
					g.fillStyle(C('#2b2620'), 1).fillCircle(32, 14, 4.8); // dark cheek badge
					g.fillStyle(C('#f4efe6'), 1);
					g.fillTriangle(27, 7, 29.5, 7, 38, 13).fillTriangle(29.5, 7, 38, 13, 36.5, 14.5); // white median stripe
					g.fillCircle(32.2, 13.6, 1.9); // white eye-spot inside the badge
					g.fillStyle(DK, 1).fillCircle(32.7, 13.6, 0.95); // pupil
					g.fillStyle(C('#efe7d6'), 1)
						.fillTriangle(25.5, 25, 27, 25, 26.2, 26.6)
						.fillTriangle(27.5, 25, 29, 25, 28.2, 26.6); // front claws
					g.fillStyle(NOSE, 1).fillCircle(38.5, 13.5, 1.1); // nose
				}),
			};
		}
		// --- Minks, weasels, marten, fisher, ermine:
		//     long low sinuous body, short legs, small round ears ---
		if (t(/mink|weasel|ermine|marten|fisher|ferret|stoat/)) {
			const arch = t(/marten|fisher/); // martens sit with an arched back
			return {
				w: 40,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(7, 15, 14, 7); // thick tapering tail
					g.fillRect(12, 16, 3, 6).fillRect(20, 16, 3, 6).fillRect(27, 16, 3, 6); // short legs
					if (arch) {
						g.fillEllipse(13, 12, 16, 10).fillEllipse(24, 13, 14, 11);
					} // arched back
					else g.fillEllipse(19, 14, 28, 11); // long tube body
					g.fillCircle(32, 11, 4.6); // small head
					g.fillCircle(29.5, 6.5, 1.7).fillCircle(34, 6.5, 1.7); // round ears
					if (t(/ermine|stoat|weasel/)) {
						g.fillStyle(0x111111, 1).fillEllipse(4, 15, 6, 5);
					} // black tail tip
					if (arch) {
						g.fillStyle(C('#e0a24a'), 1).fillEllipse(30, 15, 7, 4);
					} // throat bib
					g.fillStyle(NOSE, 1).fillCircle(35, 11, 1);
					g.fillStyle(DK, 1).fillCircle(32, 10, 1.2);
				}),
			};
		}
		// --- Deer / elk / moose: long legs, raised neck, big ears, antlers ---
		if (t(/deer|elk|moose|caribou|pronghorn/)) {
			const big = t(/elk|moose/);
			return {
				w: 40,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(11, 24, 3.4, 9).fillRect(17, 24, 3.4, 9).fillRect(24, 24, 3.4, 9).fillRect(29, 24, 3.4, 9); // 4 long legs
					g.fillEllipse(20, 19, 26, 14); // deep body
					g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 17, 7, 9); // pale rump patch
					g.fillStyle(BODY, 1);
					g.fillTriangle(28, 20, 33, 20, 31, 9); // raised neck
					g.fillCircle(32, 9, 4.4); // head
					g.fillEllipse(34, 11, 6, 3.4); // muzzle
					g.fillEllipse(28, 5, 3.4, 7).fillEllipse(33, 4, 3.4, 7); // big mule ears
					// antlers (bulls) — a branched beam sweeping up and back, in-frame
					if (big) {
						g.lineStyle(2.2, C('#9a7a52'), 1);
						g.lineBetween(31, 6, 29, 0).lineBetween(29, 0, 26, 1).lineBetween(29, 0, 30, 2); // left beam + tines
						g.lineBetween(34, 6, 36, 0).lineBetween(36, 0, 39, 1).lineBetween(36, 0, 35, 2); // right beam + tines
					}
					g.fillStyle(NOSE, 1).fillCircle(36, 11, 1);
					g.fillStyle(DK, 1).fillCircle(33, 8, 1.2);
				}),
			};
		}
		// --- Goat / bighorn: blocky body, horns, (goat) beard ---
		if (t(/goat|bighorn|ram|sheep/)) {
			const bighorn = t(/bighorn|ram|sheep/);
			return {
				w: 36,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(11, 21, 3.6, 9).fillRect(17, 21, 3.6, 9).fillRect(23, 21, 3.6, 9).fillRect(28, 21, 3.6, 9); // legs
					g.fillEllipse(20, 16, 26, 15); // stocky body
					g.fillCircle(30, 12, 5); // head
					g.fillEllipse(33, 13, 5, 4); // muzzle
					g.fillTriangle(26, 9, 28, 13, 30, 9); // ear
					if (bighorn) {
						g.fillStyle(C('#b79466'), 1);
						g.fillEllipse(27, 9, 8, 9);
						g.fillEllipse(26, 13, 6, 8);
						g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 15, 6, 8);
					} // curl horn + white rump
					else {
						g.fillStyle(C('#efe9dc'), 1).fillTriangle(28, 8, 27, 0, 30, 8).fillTriangle(32, 8, 33, 0, 30, 8);
						g.fillTriangle(29, 15, 33, 15, 31, 22);
					} // straight horns + beard
					g.fillStyle(NOSE, 1).fillCircle(34, 13, 1);
					g.fillStyle(DK, 1).fillCircle(31, 11, 1.2);
				}),
			};
		}
		// --- Hares & jackrabbits: big body, very long ears, long hind legs ---
		if (t(/hare|jackrabbit|rabbit|cottontail/)) {
			return {
				w: 30,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(6, 24, 12, 7); // big haunch
					g.fillRect(4, 27, 3, 5).fillRect(18, 27, 3, 5); // feet
					g.fillEllipse(16, 20, 20, 15); // upright body
					g.fillCircle(21, 11, 5); // head
					g.fillEllipse(19, 7, 4, 13).fillEllipse(24, 7, 4, 13); // very long ears
					g.fillStyle(0xffffff, 1).fillCircle(4, 22, 3); // cotton tail
					g.fillStyle(C('#f6efe2'), 0.5).fillEllipse(19, 6, 2, 10).fillEllipse(24, 6, 2, 10); // ear inner
					g.fillStyle(DK, 1).fillCircle(23, 10, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(25, 13, 0.9);
				}),
			};
		}
		// --- Pika: round, earthy, tiny round ears, NO tail ---
		if (t(/pika/)) {
			return {
				w: 26,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(7, 19, 3.6, 4).fillRect(12, 20, 3.6, 4).fillRect(18, 19, 3.6, 4); // short legs
					g.fillEllipse(13, 14, 22, 15); // round egg body
					g.fillCircle(19, 9, 5.4); // head blends in
					g.fillCircle(16, 3.5, 2.8).fillCircle(22, 3.5, 2.8); // big round ears
					g.fillStyle(C('#f0e6d4'), 0.55).fillEllipse(19, 11, 7, 5); // pale muzzle
					g.fillStyle(DK, 1).fillCircle(21, 8, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(23, 10, 0.9);
				}),
			};
		}
		// --- Marmot / woodchuck / prairie dog: chunky, sitting upright ---
		if (t(/yellow-bellied-marmot|woodchuck|groundhog|prairie-dog/)) {
			return {
				w: 30,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(6, 24, 9, 6); // stubby tail/haunch
					g.fillEllipse(15, 19, 22, 20); // pear body, wide at base
					g.fillCircle(17, 8, 6); // head on top
					g.fillCircle(13, 3, 2.2).fillCircle(21, 3, 2.2); // small rounded ears
					g.fillRect(11, 20, 3, 7).fillRect(18, 20, 3, 7); // hind feet
					g.fillEllipse(15, 15, 5, 6); // little forepaws at chest
					g.fillStyle(C('#e0b866'), 0.4).fillEllipse(15, 22, 12, 10); // yellow belly
					g.fillStyle(DK, 1).fillCircle(15, 7, 1.2).fillCircle(20, 7, 1.2);
					g.fillStyle(NOSE, 1).fillCircle(17.5, 10, 0.9);
				}),
			};
		}
		// --- Beaver: bulky body, small head, big scaly paddle tail ---
		if (t(/beaver/)) {
			return {
				w: 40,
				h: 26,
				draw: draw((g) => {
					g.fillStyle(C('#5a4632'), 1).fillEllipse(6, 18, 12, 9); // flat paddle tail
					g.lineStyle(0.8, 0x000000, 0.3);
					g.lineBetween(3, 15, 9, 21).lineBetween(3, 18, 9, 18).lineBetween(3, 21, 9, 15); // cross-hatch
					g.fillStyle(BODY, 1);
					g.fillRect(15, 20, 3.6, 5).fillRect(22, 20, 3.6, 5).fillRect(29, 20, 3.6, 5); // legs
					g.fillEllipse(22, 15, 28, 16); // bulky body
					g.fillCircle(33, 12, 5.4); // small head
					g.fillCircle(31, 6.5, 2).fillCircle(36, 6.5, 2); // small round ears
					g.fillStyle(C('#c8922f'), 1).fillRect(35, 14, 2.2, 3); // orange incisors
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
					g.fillStyle(DK, 1).fillCircle(34, 11, 1.2);
				}),
			};
		}
		// --- Muskrat: rat-like swimmer, long thin tail ---
		if (t(/muskrat/)) {
			return {
				w: 38,
				h: 20,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(18, 12, 28, 12); // low body
					g.lineStyle(2, C('#4a3a2c'), 1).lineBetween(6, 13, 1, 18); // thin tail
					g.fillStyle(BODY, 1).fillCircle(30, 9, 4.6); // head
					g.fillCircle(28, 5, 1.6).fillCircle(33, 5, 1.6); // small ears
					g.fillRect(13, 17, 3, 3).fillRect(20, 17, 3, 3).fillRect(26, 17, 3, 3); // legs
					g.fillStyle(NOSE, 1).fillCircle(34, 10, 1);
					g.fillStyle(DK, 1).fillCircle(31, 8, 1.1);
				}),
			};
		}
		// --- Bipedal desert rodents: huge hind legs, tiny arms, tufted tail ---
		if (t(/kangaroo-rat|kangaroo-mouse|jerboa/)) {
			return {
				w: 30,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.lineStyle(2, BODY, 1).lineBetween(6, 20, 3, 26); // long tail
					g.fillStyle(0x2e2620, 1).fillCircle(3, 26, 2.2); // dark tail tuft
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 20, 12, 14); // big hind haunch
					g.fillRect(10, 25, 3.4, 5).fillRect(15, 26, 3.2, 4); // two hind feet
					g.fillEllipse(19, 13, 13, 12); // upright body
					g.fillCircle(23, 7, 5); // big head
					g.fillEllipse(21, 3.2, 3, 6).fillEllipse(25, 3.2, 3, 6); // tall ears
					g.fillEllipse(20, 14, 3.5, 4); // tiny forepaw
					g.fillStyle(DK, 1).fillCircle(25, 6, 1.6); // big eye
					g.fillStyle(NOSE, 1).fillCircle(27, 8, 0.9);
				}),
			};
		}
		// --- Flying squirrel: stretched gliding membrane, flat tail, big eyes ---
		if (t(/flying-squirrel/)) {
			return {
				w: 34,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 14, 12, 7); // flat paddle tail
					g.fillRect(12, 18, 3.2, 5).fillRect(21, 18, 3.2, 5); // legs
					g.fillTriangle(10, 8, 26, 8, 24, 18).fillTriangle(10, 8, 10, 18, 24, 18); // patagium
					g.fillEllipse(18, 13, 18, 12); // body
					g.fillCircle(26, 9, 5); // head
					g.fillCircle(24, 4.5, 2).fillCircle(29, 4.5, 2); // round ears
					g.fillStyle(C('#f2ece0'), 0.4).fillEllipse(18, 16, 14, 5); // pale belly
					g.fillStyle(DK, 1).fillCircle(28, 8, 1.8); // big eye
					g.fillStyle(NOSE, 1).fillCircle(30, 10, 0.9);
				}),
			};
		}
		// --- Chipmunks & striped ground squirrels: upright, striped, tail up ---
		if (t(/chipmunk|antelope-squirrel|ground-squirrel/)) {
			const striped = t(/chipmunk|antelope/);
			return {
				w: 30,
				h: 28,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(7, 12, 10, 20); // tail arched up alongside
					g.fillRect(12, 23, 3.4, 4).fillRect(18, 23, 3.4, 4); // hind feet
					g.fillEllipse(16, 18, 15, 15); // upright body
					g.fillCircle(20, 9, 5); // head
					g.fillCircle(18, 4, 2.2).fillCircle(23, 4, 2.2); // round ears
					g.fillEllipse(17, 18, 4, 5); // little forepaws
					if (striped) {
						g.fillStyle(C('#3a2c1e'), 1).fillRect(11, 13, 11, 1.3).fillRect(11, 17, 11, 1.3);
						g.fillStyle(C('#f4efe6'), 1).fillRect(11, 15, 11, 1.2);
					}
					g.fillStyle(DK, 1).fillCircle(22, 8, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(24, 10, 0.8);
				}),
			};
		}
		// --- Voles / mice / rats: compact, blunt face, small ears, thin tail ---
		if (t(/vole|mouse|rat|shrew|mole|gopher|lemming/)) {
			return {
				w: 32,
				h: 19,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.lineStyle(1.6, C('#caa98a'), 1).lineBetween(6, 12, 1, 15); // thin tail
					g.fillStyle(BODY, 1);
					g.fillRect(10, 14, 2.6, 4).fillRect(17, 14, 2.6, 4).fillRect(23, 14, 2.6, 4); // little legs
					g.fillEllipse(15, 11, 22, 11); // plump body
					g.fillCircle(25, 9, 4.6); // head, blunt
					g.fillCircle(23, 4.5, 2.4).fillCircle(28, 5, 2.2); // rounded ears
					g.fillStyle(DK, 1).fillCircle(27, 8, 1.2);
					g.fillStyle(NOSE, 1).fillCircle(29, 10, 0.9);
				}),
			};
		}
		// --- Cats (bobcat/lynx): compact cat, tufted ears, spots, bobbed tail ---
		if (t(/bobcat|lynx|cat|cougar|puma|mountain-lion/)) {
			const bob = t(/bobcat|lynx/);
			return {
				w: 38,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					if (bob)
						g.fillEllipse(6, 15, 7, 5); // short bobbed tail
					else g.fillEllipse(6, 17, 13, 6); // long tail
					g.fillRect(12, 22, 3.6, 7).fillRect(18, 22, 3.6, 7).fillRect(25, 22, 3.6, 7).fillRect(30, 22, 3.6, 7); // legs
					g.fillEllipse(20, 17, 26, 13); // lithe body
					g.fillCircle(31, 11, 5.4); // round head
					g.fillTriangle(26, 8, 29, 2, 32, 8).fillTriangle(31, 8, 34, 2, 37, 8); // upright pointed ears
					if (bob) {
						g.fillStyle(0x2a2620, 1).fillTriangle(28.4, 3, 29, 0.4, 29.6, 3).fillTriangle(33.4, 3, 34, 0.4, 34.6, 3);
						g.fillStyle(BODY, 1);
					} // dark ear tufts
					g.fillStyle(0x000000, 0.2);
					for (const [x, y] of [
						[15, 14],
						[21, 13],
						[26, 15],
						[18, 18],
						[24, 18],
					] as const)
						g.fillCircle(x, y, 1.2); // spots
					g.fillStyle(C('#f2ece0'), 1).fillEllipse(31, 13, 7, 4); // muzzle
					g.fillStyle(NOSE, 1).fillEllipse(33, 12, 1.8, 1.3);
					g.fillStyle(DK, 1).fillCircle(29, 10, 1.2).fillCircle(33, 10, 1.2);
				}),
			};
		}
		// --- Wild canids (mountain-lion/kit fox/wolf): long legs, snout, bushy tail ---
		if (t(/mountain-lion|wolf|kit-fox|fox|jackal/)) {
			const kit = t(/kit-fox/);
			return {
				w: 40,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 18, 14, 9); // bushy tail
					g.fillRect(13, 22, 3.4, 7).fillRect(19, 22, 3.4, 7).fillRect(26, 22, 3.4, 7).fillRect(31, 22, 3.4, 7); // long legs
					g.fillEllipse(21, 16, 26, 13); // lean body
					g.fillTriangle(30, 17, 34, 17, 33, 8); // neck
					g.fillCircle(33, 8, 4.6); // head
					g.fillTriangle(35, 8, 40, 11, 35, 12); // pointed snout
					if (kit)
						g.fillTriangle(29, 7, 30, 0.5, 33, 6).fillTriangle(34, 6, 37, 0.5, 38, 7); // kit fox = huge ears
					else g.fillTriangle(30, 6, 31, 2, 33, 6).fillTriangle(34, 6, 36, 2, 37, 6);
					g.fillStyle(0xffffff, 1).fillCircle(4, 17, 3); // tail tip
					g.fillStyle(NOSE, 1).fillCircle(39, 11, 1);
					g.fillStyle(DK, 1).fillCircle(34, 7, 1.2);
				}),
			};
		}

		// --- Generic quadruped fallback (small unhandled mammals) ---
		return {
			w: 36,
			h: 28,
			draw: draw((g) => {
				// Legs start well up inside the body and are drawn first, so the body
				// covers their tops. Drawn short and stout at 23px they read as legs;
				// long thin posts starting at the body's curved edge read as detached.
				g.fillStyle(BODY, 1);
				if (t(/squirrel/))
					g.fillEllipse(6, 13, 11, 15); // bushy squirrel tail
				else g.fillEllipse(7, 17, 9, 5);
				g.fillRect(12, 19, 4.2, 7).fillRect(17.5, 19, 4.2, 7).fillRect(23, 19, 4.2, 7).fillRect(28, 19, 4.2, 7); // four legs
				g.fillEllipse(12.6, 25.4, 5.6, 2.8) // paws, squaring off the ends
					.fillEllipse(18.1, 25.4, 5.6, 2.8)
					.fillEllipse(23.6, 25.4, 5.6, 2.8)
					.fillEllipse(28.6, 25.4, 5.6, 2.8);
				g.fillEllipse(19, 17, 23, 14); // body + head, painted over the leg tops
				g.fillCircle(28, 13, 6.2);
				g.fillCircle(25, 7, 2.6).fillCircle(31, 7, 2.6); // round ears
				g.fillStyle(NOSE, 1).fillCircle(33, 13, 1);
				g.fillStyle(DK, 1).fillCircle(29, 12, 1.2);
			}),
		};
	}

	if (kind === 'bird') {
		if (t(/heron/)) {
			return {
				w: 34,
				h: 28,
				draw: draw((g) => {
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
				}),
			};
		}

		// Waterfowl: a low, boat-shaped body that sits on the water, rounded head,
		// and a broad flat bill — reads clearly as a duck/goose vs a songbird.
		if (t(/duck|mallard|merganser|teal|widgeon|wigeon|goose|brant|gadwall|pintail|shoveler/)) {
			return {
				w: 33,
				h: 22,
				draw: draw((g) => {
					const goose = t(/goose|brant/);
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 15, 22, 11); // boat body
					g.fillTriangle(2, 12, 8, 16, 4, 17); // upswept tail
					if (goose) {
						g.fillRect(20, 4, 3.4, 9);
						g.fillCircle(22, 4, 3.8);
					} // long neck + head
					else g.fillCircle(23, 9, 5); // tucked head
					const hx = goose ? 22 : 25,
						hy = goose ? 4 : 9;
					g.fillStyle(C('#e0a93f'), 1).fillEllipse(hx + 4, hy + 0.5, 6, 3.2); // broad flat bill
					g.fillStyle(0xffffff, 0.5).fillEllipse(11, 13, 12, 4); // wing highlight
					g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
				}),
			};
		}
		// Ground cuckoo (roadrunner): long body, very long tail, shaggy crest,
		// long striding legs, straight bill.
		if (t(/roadrunner/)) {
			return {
				w: 34,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.5, C('#8a6a44'), 1).lineBetween(12, 16, 11, 24).lineBetween(16, 16, 18, 24); // legs
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 12, 16, 9); // body
					g.fillTriangle(1, 4, 8, 12, 6, 16); // long cocked tail
					g.fillRect(18, 6, 3, 6);
					g.fillCircle(21, 6, 4); // neck + head
					g.fillTriangle(19, 3, 23, 0, 24, 4); // shaggy crest
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(24, 5, 31, 6, 24, 7.5); // long straight bill
					g.fillStyle(DK, 1).fillCircle(22, 5, 1.1);
				}),
			};
		}
		// Small shorebird (plover / sandpiper / sanderling / turnstone): compact
		// upright body, two thin legs, and a short-to-medium straight probing bill.
		if (t(/plover|sanderling|sandpiper|turnstone|shorebird|killdeer|dunlin|dowitcher|godwit|yellowlegs/)) {
			return {
				w: 28,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.3, C('#c9a35c'), 1).lineBetween(11, 16, 10, 24).lineBetween(15, 16, 16, 24); // legs
					g.fillStyle(BODY, 1);
					g.fillEllipse(12, 12, 15, 11); // plump body
					g.fillCircle(18, 6, 4); // head high on body
					g.fillTriangle(2, 9, 7, 12, 3, 14); // short tail
					g.fillStyle(DK, 1);
					g.fillTriangle(21, 5.5, 27, 6, 21, 7); // straight bill
					g.fillCircle(19, 5, 1.1);
				}),
			};
		}
		// Seabird (gull / tern / cormorant): sleek elongated body; gulls get a
		// slightly hooked bill, cormorants a long neck + hook.
		if (t(/gull|tern|cormorant|guillemot|kittiwake/)) {
			const corm = t(/cormorant|guillemot/);
			return {
				w: 32,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 14, 20, 10); // sleek body
					g.fillTriangle(2, 11, 8, 15, 3, 16); // tail
					if (corm) {
						g.fillRect(19, 5, 3, 8);
						g.fillCircle(21, 5, 4);
					} else g.fillCircle(21, 9, 4.6);
					const hx = corm ? 21 : 22,
						hy = corm ? 5 : 9;
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 9, hy, hx + 3, hy + 1.5); // hooked-ish bill
					g.lineStyle(1.4, C('#e0a93f'), 1).lineBetween(hx + 9, hy, hx + 8, hy + 1.5);
					g.fillStyle(0x000000, 0.14).fillEllipse(9, 11, 13, 4); // grey wing
					g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
				}),
			};
		}
		// Eagle — the apex raptor. A big, upright, broad-chested hunter: heavy
		// hooked bill, the golden eagle's signature tawny nape, a fierce amber eye
		// under a heavy brow, a folded wing with drooping primaries, and gripping
		// yellow talons. Reads as a predator, not a generic songbird.
		if (t(/eagle/)) {
			// Same clean, flat silhouette as the other birds — but unmistakably a
			// raptor: a hooked bill, the golden eagle's tawny nape, a fierce amber
			// eye, and gripping talons. No muddy overlays.
			return {
				w: 30,
				h: 26,
				draw: draw((g) => {
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
				}),
			};
		}

		const wader = t(/heron|crane|egret|bittern|stilt|flamingo|sandhill/);
		const raptor = t(/hawk|owl|falcon|kite|harrier|osprey|goshawk|kestrel|merlin/);
		const finch = t(/finch|grosbeak|goldfinch|sparrow|bunting|crossbill|junco|towhee/);
		const chunky = t(/white-tailed-ptarmigan|quail|grouse|partridge/);
		// Long-billed birds need a wider canvas so the bill tip isn't clipped;
		// waders need a taller one so the raised neck/head clears the top edge.
		const longBill = t(
			/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|brown-pelican|oystercatcher|hummingbird/,
		);
		const W = longBill ? 32 : 28;
		const H = wader ? 34 : 24;
		return {
			w: W,
			h: H,
			draw: draw((g) => {
				const baseY = wader ? 16 : 13;
				g.fillStyle(BODY, 1);
				// legs
				if (wader) {
					g.lineStyle(1.4, C('#c9a35c'), 1);
					g.lineBetween(12, baseY + 8, 11, H - 1).lineBetween(16, baseY + 8, 17, H - 1);
					g.fillStyle(BODY, 1);
				}
				// body + head — plump, rounded body for chunky ground birds (white-tailed-ptarmigan/quail)
				if (chunky) g.fillEllipse(12, baseY, 20, 15).fillCircle(20, baseY - 7, 4.6);
				else g.fillEllipse(13, baseY, 17, 12).fillCircle(20, baseY - 6, 4.6);
				if (wader) {
					g.fillRect(18, baseY - 9, 3, 8);
					g.fillCircle(20, baseY - 10, 4);
				} // long neck + head
				// tail
				if (t(/wren/)) g.fillTriangle(3, baseY - 5, 7, baseY, 4, baseY - 1);
				else g.fillTriangle(2, baseY - 3, 8, baseY, 3, baseY + 4);
				// crest
				if (t(/quail|cardinal|jay|waxwing|nutcracker|titmouse|chickadee|kingfisher|phainopepla/)) {
					g.fillTriangle(18, baseY - 9, 21, baseY - 13, 24, baseY - 8);
				}
				// beak
				const hx = 20,
					hy = wader ? baseY - 10 : baseY - 6;
				if (t(/hummingbird/)) {
					g.fillStyle(DK, 1);
					g.lineStyle(1.2, DK, 1).lineBetween(hx + 3, hy, hx + 11, hy - 1);
				} else if (t(/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|brown-pelican|oystercatcher/)) {
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1.5, hx + 11, hy, hx + 3, hy + 1.5);
				} else if (raptor) {
					g.fillStyle(C('#e6b84a'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy + 0.5, hx + 3, hy + 2.5);
					g.fillStyle(C('#33302b'), 1).fillTriangle(hx + 6, hy - 0.2, hx + 9, hy + 1, hx + 5.5, hy + 2);
				}
				// finches/sparrows/grosbeaks: short, deep conical seed-cracking bill
				else if (finch) {
					g.fillStyle(C('#d8b25a'), 1).fillTriangle(hx + 3, hy - 2, hx + 7, hy, hx + 3, hy + 2);
				} else {
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy, hx + 3, hy + 1.5);
				}
				// brown-pelican: a big orange gular pouch slung under the long bill
				if (t(/brown-pelican/)) {
					g.fillStyle(C('#e6a63c'), 1).fillEllipse(hx + 6, hy + 4, 11, 8);
					g.fillStyle(C('#f0c060'), 1).fillEllipse(hx + 6, hy + 3, 8, 5);
				}
				// owl big eyes / ear tufts
				if (t(/owl/)) {
					g.fillStyle(C('#f4e3b1'), 1).fillCircle(18, hy, 2).fillCircle(22, hy, 2);
					g.fillStyle(DK, 1).fillCircle(18, hy, 1).fillCircle(22, hy, 1);
					g.fillStyle(BODY, 1)
						.fillTriangle(16, hy - 4, 18, hy - 7, 19, hy - 3)
						.fillTriangle(21, hy - 3, 22, hy - 7, 24, hy - 4);
				}
				// other raptors: a fierce amber eye under a heavy brow
				else if (raptor) {
					g.lineStyle(1.4, C('#5a4a30'), 1).lineBetween(18, hy - 1.5, 23, hy - 0.5);
					g.fillStyle(C('#f2c033'), 1).fillCircle(21, hy, 1.8);
					g.fillStyle(DK, 1).fillCircle(21.3, hy, 1);
				} else g.fillStyle(DK, 1).fillCircle(21, hy, 1.1);
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
			}),
		};
	}

	if (kind === 'insect') {
		return {
			w: 24,
			h: 20,
			draw: draw((g) => {
				if (t(/butterfly|monarch|admiral|swallowtail|fritillary|painted|lady$|painted-lady/)) {
					g.fillStyle(BODY, 1)
						.fillEllipse(7, 8, 12, 12)
						.fillEllipse(17, 8, 12, 12)
						.fillEllipse(8, 16, 8, 7)
						.fillEllipse(16, 16, 8, 7);
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
				if (t(/beetle/)) {
					g.fillStyle(0x000000, 0.18).fillEllipse(10, 11, 12, 7);
					g.lineStyle(1, DK, 1).lineBetween(11, 6, 11, 16);
				}
				g.lineStyle(1, DK, 1);
				for (const lx of [6, 10, 14]) g.lineBetween(lx, 14, lx - 2, 18).lineBetween(lx, 8, lx - 2, 4);
				if (t(/grasshopper|cricket/)) g.lineStyle(2.2, BODY, 1).lineBetween(8, 13, 4, 18);
				g.fillStyle(DK, 1).fillCircle(19, 8, 1);
			}),
		};
	}

	if (kind === 'reptile') {
		if (t(/turtle|tortoise/)) {
			return {
				w: 30,
				h: 20,
				draw: draw((g) => {
					g.fillStyle(BODY, 1).fillEllipse(15, 12, 22, 13);
					g.fillStyle(0x000000, 0.16).fillEllipse(15, 14, 22, 7);
					g.lineStyle(1, 0x000000, 0.25).strokeCircle(15, 11, 5);
					g.fillStyle(BODY, 1).fillCircle(26, 12, 3.4).fillRect(7, 16, 3, 4).fillRect(20, 16, 3, 4); // head + legs
					g.fillStyle(DK, 1).fillCircle(27, 11, 1);
				}),
			};
		}
		// lizard / gecko / iguana
		return {
			w: 34,
			h: 18,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 10, 20, 8).fillCircle(25, 9, 4);
				g.fillEllipse(6, 11, 12, 4); // tail
				g.fillRect(9, 13, 2.4, 4).fillRect(18, 13, 2.4, 4); // legs
				if (t(/horned|collared/)) {
					g.fillStyle(BODY, 1).fillTriangle(27, 6, 30, 3, 30, 9);
				} // head spikes/frill
				if (t(/iguana|chuckwalla/)) {
					g.fillStyle(0x000000, 0.15);
					for (const sx of [10, 14, 18, 22]) g.fillTriangle(sx, 6, sx + 1.5, 3, sx + 3, 6);
				} // dorsal crest
				g.fillStyle(DK, 1).fillCircle(26, 8, 1);
			}),
		};
	}

	if (kind === 'amphibian') {
		if (t(/frog|toad/)) {
			return {
				w: 26,
				h: 18,
				draw: draw((g) => {
					g.fillStyle(BODY, 1).fillEllipse(13, 12, 19, 11).fillCircle(7, 7, 3).fillCircle(19, 7, 3); // body + eye bulges
					g.fillStyle(DK, 1).fillCircle(7, 7, 1.2).fillCircle(19, 7, 1.2);
					g.fillStyle(BODY, 1).fillTriangle(3, 16, 9, 14, 6, 18).fillTriangle(23, 16, 17, 14, 20, 18); // legs
					if (t(/toad/)) {
						g.fillStyle(0x000000, 0.14).fillCircle(9, 11, 1.3).fillCircle(15, 13, 1.3).fillCircle(17, 10, 1.3);
					} // warts
				}),
			};
		}
		// salamander / newt
		return {
			w: 30,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 9, 18, 7).fillCircle(23, 8, 3.4).fillEllipse(6, 10, 10, 3.4);
				g.fillRect(9, 11, 2, 3).fillRect(17, 11, 2, 3);
				g.fillStyle(C('#e8954f'), 1).fillCircle(11, 8, 1.3).fillCircle(16, 9, 1.3).fillCircle(20, 8, 1.1); // spots
				g.fillStyle(DK, 1).fillCircle(24, 7, 1);
			}),
		};
	}

	if (kind === 'fish') {
		return {
			w: 28,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 8, 18, 10).fillTriangle(2, 3, 7, 8, 2, 13);
				g.fillStyle(0xffffff, 0.6).fillTriangle(13, 1, 17, 5, 13, 5); // dorsal fin
				g.fillStyle(DK, 1).fillCircle(20, 7, 1.2);
			}),
		};
	}

	// invertebrate — crabs, stars, anemones, slugs, shellfish, spiders, scorpions
	if (t(/crab/)) {
		return {
			w: 26,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(13, 13, 18, 11);
				g.lineStyle(1.4, BODY, 1);
				for (const s of [-1, 1])
					for (let i = 0; i < 3; i++) g.lineBetween(13 + s * 6, 13 + i * 2, 13 + s * 11, 11 + i * 3);
				g.fillStyle(BODY, 1).fillCircle(4, 9, 3).fillCircle(22, 9, 3); // claws
				g.fillStyle(DK, 1).fillCircle(10, 9, 1).fillCircle(16, 9, 1);
			}),
		};
	}
	if (t(/star/)) {
		return {
			w: 24,
			h: 24,
			draw: draw((g) => {
				g.fillStyle(BODY, 1);
				const cx = 12,
					cy = 12,
					R = 11;
				for (let i = 0; i < 5; i++) {
					const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
					const a0 = ((i - 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
					const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
					g.fillTriangle(
						cx,
						cy,
						cx + Math.cos(a0) * R * 0.55,
						cy + Math.sin(a0) * R * 0.55,
						cx + Math.cos(ang) * R,
						cy + Math.sin(ang) * R,
					);
					g.fillTriangle(
						cx,
						cy,
						cx + Math.cos(a2) * R * 0.55,
						cy + Math.sin(a2) * R * 0.55,
						cx + Math.cos(ang) * R,
						cy + Math.sin(ang) * R,
					);
				}
				g.fillStyle(0x000000, 0.12).fillCircle(cx, cy, 3.5);
			}),
		};
	}
	if (t(/anemone/)) {
		return {
			w: 24,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(12, 17, 14, 9);
				g.lineStyle(1.6, BODY, 1);
				for (let i = 0; i < 9; i++) {
					const x = 5 + i * 1.8;
					g.lineBetween(x, 14, x - 1 + (i % 2) * 2, 3 + (i % 3));
				}
			}),
		};
	}
	if (t(/scorpion/)) {
		return {
			w: 28,
			h: 20,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(12, 13, 14, 8).fillCircle(5, 9, 2.6).fillCircle(19, 9, 2.6); // body + pincers
				g.lineStyle(1.8, BODY, 1).lineBetween(18, 11, 23, 6).lineBetween(23, 6, 24, 12); // curled tail
				g.fillStyle(BODY, 1).fillCircle(24, 12, 1.8);
				g.lineStyle(1, DK, 1);
				for (const lx of [9, 13, 17]) g.lineBetween(lx, 16, lx - 2, 19);
			}),
		};
	}
	if (t(/spider|desert-tarantula/)) {
		return {
			w: 24,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillCircle(12, 12, 6).fillCircle(12, 6, 3);
				g.lineStyle(1.6, BODY, 1);
				for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.lineBetween(12, 11, 12 + s * (8 + i), 6 + i * 4);
				g.fillStyle(DK, 1).fillCircle(11, 5, 0.9).fillCircle(13, 5, 0.9);
			}),
		};
	}
	if (t(/slug|snail/)) {
		return {
			w: 26,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(13, 11, 22, 8);
				if (t(/snail/)) g.fillStyle(0x000000, 0.16).fillCircle(9, 9, 5);
				g.lineStyle(1.4, BODY, 1).lineBetween(21, 8, 23, 3).lineBetween(23, 8, 25, 4); // eye stalks
				g.fillStyle(DK, 1).fillCircle(23, 3, 0.8).fillCircle(25, 4, 0.8);
			}),
		};
	}
	// mussel / clam / oyster — bivalve shell
	return {
		w: 22,
		h: 18,
		draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(11, 11, 18, 12);
			g.lineStyle(1, 0x000000, 0.25);
			for (let i = 1; i < 4; i++) g.strokeEllipse(11, 11, 18 - i * 4, 12 - i * 3);
			g.fillStyle(0x000000, 0.12).fillTriangle(11, 5, 9, 11, 13, 11);
		}),
	};
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
	constructor(
		private tint: string | null,
		private override: string | null = null,
	) {}
	private col(c: number) {
		if (this.override) return this.override;
		if (this.tint && c === 0xffffff) return this.tint;
		return hexOf(c);
	}
	fillStyle(c: number, a = 1) {
		this.fill = this.col(c);
		this.fillA = a;
		return this;
	}
	lineStyle(w: number, c: number, a = 1) {
		this.sw = w;
		this.stroke = this.col(c);
		this.strokeA = a;
		return this;
	}
	fillEllipse(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillCircle(x: number, y: number, r: number) {
		this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`);
		return this;
	}
	fillRect(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillRoundedRect(x: number, y: number, w: number, h: number, r: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
		this.parts.push(
			`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	lineBetween(x1: number, y1: number, x2: number, y2: number) {
		this.parts.push(
			`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}" stroke-linecap="round"/>`,
		);
		return this;
	}
	strokeEllipse(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
	strokeCircle(x: number, y: number, r: number) {
		this.parts.push(
			`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
	strokeRoundedRect(x: number, y: number, w: number, h: number, r: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
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
	appearance:
		| {
				skin?: string;
				hair?: string;
				outfit?: string;
				hat?: string;
				hatColor?: string | null;
				hairstyle?: string;
				beard?: string;
				body?: string;
		  }
		| undefined,
): string {
	const a = {
		skin: appearance?.skin || '#eec39a',
		hair: appearance?.hair || '#6e4a33',
		outfit: appearance?.outfit || '#4a7c59',
		hat: appearance?.hat || 'none',
		hatColor: appearance?.hatColor || null,
		hairstyle: appearance?.hairstyle || 'short',
		beard: appearance?.beard || 'none',
		body: appearance?.body || 'slim',
	};
	const key =
		`player-${a.skin}-${a.hair}-${a.outfit}-${a.hat}-${a.hatColor || 'classic'}-${a.hairstyle}-${a.beard}-${a.body}`.replace(
			/#/g,
			'',
		);
	tex(scene, key, 32, 36, (g) => {
		const skin = C(a.skin),
			hair = C(a.hair),
			outfit = C(a.outfit);
		const hp = hatPalette(a.hat, a.hatColor); // classic or custom-tinted hat tones
		const bw = a.body === 'round' ? 21 : 17; // body width by build
		// visor, halo and headphones sit above/beside the hair instead of covering it
		const bareHead =
			a.hat === 'none' || a.hat === 'halo' || a.hat === 'headphones' || a.hat === 'visor' || a.hat === 'cat-ears';
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
			g.fillStyle(hair, 1)
				.fillEllipse(8, 11, 6, 7)
				.fillEllipse(6, 19, 6, 12)
				.fillEllipse(24, 11, 6, 7)
				.fillEllipse(26, 19, 6, 12);
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
		if (a.hairstyle === 'wavy') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 21, 23);
			g.fillCircle(6, 23, 3.4).fillCircle(26, 23, 3.4);
		}
		if (a.hairstyle === 'double-braid') {
			g.fillStyle(hair, 1).fillEllipse(9.5, 11.5, 6, 7).fillEllipse(22.5, 11.5, 6, 7);
			g.fillCircle(7.5, 16.5, 3.2).fillCircle(6.5, 21, 2.9).fillCircle(6, 25, 2.5);
			g.fillCircle(24.5, 16.5, 3.2).fillCircle(25.5, 21, 2.9).fillCircle(26, 25, 2.5);
			g.fillStyle(C('#c9913f'), 1).fillRect(4.7, 27, 2.6, 1.4).fillRect(24.7, 27, 2.6, 1.4);
		}
		if (a.hairstyle === 'half-up') {
			g.fillStyle(hair, 1).fillEllipse(16, 18.4, 20.6, 23.6);
		}
		if (a.hairstyle === 'shag') {
			g.fillStyle(hair, 1).fillEllipse(16, 15.4, 21.4, 17.6);
			g.fillTriangle(6.2, 12.8, 4, 19.6, 9.4, 17.2);
			g.fillTriangle(25.8, 12.8, 28, 19.6, 22.6, 17.2);
		}
		if (a.hairstyle === 'dreads') {
			g.fillStyle(hair, 1).fillEllipse(9, 11.5, 5.5, 6.5).fillEllipse(23, 11.5, 5.5, 6.5);
			g.fillRoundedRect(5.6, 11.5, 2.2, 12, 1.1)
				.fillRoundedRect(8.2, 13, 2.2, 10, 1.1)
				.fillRoundedRect(21.6, 13, 2.2, 10, 1.1)
				.fillRoundedRect(24.2, 11.5, 2.2, 12, 1.1);
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
			g.fillCircle(10, 7, 4.4)
				.fillCircle(15, 5, 4.8)
				.fillCircle(21, 7, 4.4)
				.fillCircle(7, 12, 3.4)
				.fillCircle(25, 12, 3.4);
		} else if (a.hairstyle === 'mohawk') {
			g.fillTriangle(12.5, 9, 14, 1.5, 15.5, 9);
			g.fillTriangle(15, 9, 16, 0, 17, 9);
			g.fillTriangle(16.5, 9, 18, 1.5, 19.5, 9);
		} else if (a.hairstyle === 'spiky') {
			g.fillEllipse(16, 7, 15, 6.4);
			g.fillTriangle(9.5, 6, 11.2, 1.6, 13, 6);
			g.fillTriangle(12.5, 6, 14.6, 0.2, 16.6, 6);
			g.fillTriangle(16, 6, 18, 0.8, 20, 6);
			g.fillTriangle(19.4, 6, 21.4, 2, 23, 6);
		} else if (a.hairstyle === 'pixie') {
			g.fillEllipse(16, 7.2, 16.4, 7.2);
			g.fillTriangle(9.4, 9.4, 20.4, 6.6, 20.4, 9.8);
		} else if (a.hairstyle === 'cornrows') {
			g.lineStyle(1.4, hair, 1);
			g.lineBetween(9.4, 9.6, 12.8, 4.2)
				.lineBetween(12.2, 9.2, 14.6, 3.8)
				.lineBetween(14.6, 9, 15.8, 3.6)
				.lineBetween(17.4, 9, 16.2, 3.6)
				.lineBetween(19.8, 9.2, 17.4, 3.8)
				.lineBetween(22.6, 9.6, 19.2, 4.2);
		} else if (a.hairstyle === 'shag') {
			g.fillEllipse(16, 7.4, 16.8, 8);
			g.fillTriangle(11, 10.6, 12.6, 6.6, 14.2, 10.6);
			g.fillTriangle(17.8, 10.6, 19.4, 6.6, 21, 10.6);
		} else if (a.hairstyle === 'bowl') {
			g.fillEllipse(16, 7, 16, 8);
			g.fillRect(8, 7, 16, 2);
		} else if (a.hairstyle === 'dreads') {
			g.fillEllipse(16, 7.4, 15, 7);
			g.fillRoundedRect(9.4, 3.4, 2, 5, 1)
				.fillRoundedRect(12.4, 2.2, 2, 6, 1)
				.fillRoundedRect(15.4, 1.8, 2, 6.4, 1)
				.fillRoundedRect(18.4, 2.4, 2, 6, 1)
				.fillRoundedRect(21.2, 3.6, 2, 5, 1);
		} else if (a.hairstyle === 'bald') {
			// no hair at all
		} else {
			g.fillEllipse(16, 7.4, 15, 7);
		}
		if (a.hairstyle === 'bun' && bareHead) {
			g.fillStyle(hair, 1).fillCircle(16, 2.4, 4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13, 4.6, 6, 1.6);
		}
		if (a.hairstyle === 'wavy') {
			g.fillStyle(hair, 1).fillEllipse(8.8, 15.6, 3.2, 15).fillEllipse(23.2, 15.6, 3.2, 15);
		}
		if (a.hairstyle === 'half-up' && bareHead) {
			g.fillStyle(hair, 1).fillEllipse(16, 3.4, 5.4, 4.4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13.6, 5.4, 4.8, 1.4);
		}
		if (a.hairstyle === 'space-buns' && bareHead) {
			g.fillStyle(hair, 1).fillCircle(9.5, 5.8, 3.6).fillCircle(22.5, 5.8, 3.6);
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
		// bare-head hair volume — drawn before the hats so a visor, halo or
		// headphones, which don't cover the crown, still layer on top of it
		if (
			bareHead &&
			![
				'bun',
				'curly',
				'curly-long',
				'afro',
				'mohawk',
				'bald',
				'spiky',
				'bowl',
				'dreads',
				'pixie',
				'cornrows',
				'shag',
			].includes(a.hairstyle)
		) {
			g.fillStyle(hair, 1).fillEllipse(16, 5.6, 14, 7);
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
		} else if (a.hat === 'acorn') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.4, 16.8, 7.6);
			g.lineStyle(0.8, C(hp.line), 0.55);
			g.lineBetween(12.6, 2.8, 11.4, 8.6).lineBetween(16, 2.5, 16, 8.8).lineBetween(19.4, 2.8, 20.6, 8.6);
			g.lineStyle(1.3, C(hp.line), 1).lineBetween(16, 2.4, 16, 0.2);
			g.fillStyle(C(hp.b), 1).fillCircle(16, 0.2, 0.9);
		} else if (a.hat === 'beret') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16.4, 5.6, 18.6, 8);
			g.fillStyle(C(hp.line), 1).fillEllipse(15.6, 8.6, 15, 2.6);
			g.fillStyle(C(hp.b), 1).fillCircle(15, 2.2, 1.1);
		} else if (a.hat === 'mushroom') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 4.6, 18, 8.5);
			g.fillStyle(C(hp.line), 1).fillEllipse(16, 8, 13, 2.4);
			g.fillStyle(C('#f6efe3'), 1)
				.fillCircle(13, 3.2, 1.2)
				.fillCircle(18.5, 2.6, 1.4)
				.fillCircle(20.5, 5.4, 0.9)
				.fillCircle(14.5, 5.8, 0.8);
		} else if (a.hat === 'wizard') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 8, 19, 4.5);
			g.fillStyle(C(hp.b), 1).fillTriangle(16.8, -3, 10.5, 8, 21.8, 8);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(11.5, 7.5, 20.5, 7.5);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(17.8, 2.5, 1);
		} else if (a.hat === 'crown') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 10, y: 8 },
					{ x: 10, y: 3 },
					{ x: 12.5, y: 5.5 },
					{ x: 16, y: 1.2 },
					{ x: 19.5, y: 5.5 },
					{ x: 22, y: 3 },
					{ x: 22, y: 8 },
				],
				true,
			);
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
		} else if (a.hat === 'tophat') {
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 7.6, 23, 4);
			g.fillStyle(C(hp.a), 1).fillRoundedRect(10.8, -1, 10.4, 8.8, 1.2);
			g.fillStyle(C(hp.line), 1).fillRect(11, 4.4, 10, 2);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(19.2, 5.4, 0.6);
		} else if (a.hat === 'chef') {
			g.fillStyle(C(hp.b), 1).fillCircle(11.5, 3.4, 4).fillCircle(16, 1.6, 4.6).fillCircle(20.5, 3.4, 4);
			g.fillStyle(C(hp.a), 1).fillRect(10, 4, 12, 4.6);
			g.lineStyle(1, C(hp.line), 1).lineBetween(10, 7.6, 22, 7.6);
		} else if (a.hat === 'pirate') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 2.4, y: 8.6 },
					{ x: 5, y: 2.4 },
					{ x: 9.2, y: -0.4 },
					{ x: 12.6, y: 2.6 },
					{ x: 16, y: 3 },
					{ x: 19.4, y: 2.6 },
					{ x: 22.8, y: -0.4 },
					{ x: 27, y: 2.4 },
					{ x: 29.6, y: 8.6 },
					{ x: 22.8, y: 7.6 },
					{ x: 16, y: 7.4 },
					{ x: 9.2, y: 7.6 },
				],
				true,
			);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 9, 27.2, 3.4);
			g.fillStyle(C('#f6efe3'), 1).fillCircle(16, 4.4, 1.8);
			g.fillStyle(C(hp.a), 1).fillCircle(15.4, 4.2, 0.5).fillCircle(16.6, 4.2, 0.5);
		} else if (a.hat === 'witch') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7.4, 24.8, 6);
			g.fillStyle(C(hp.b), 1).fillTriangle(21.6, -6.4, 11.6, 7.4, 20.4, 7.4);
			g.fillStyle(C(hp.line), 1).fillRect(12, 5.2, 8.4, 2.2);
			g.fillStyle(C('#e0b23e'), 1).fillRect(14.8, 5.5, 2.2, 1.6);
		} else if (a.hat === 'newspaper') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 6, y: 8.4 },
					{ x: 6, y: 3.2 },
					{ x: 16, y: -0.8 },
					{ x: 26, y: 3.2 },
					{ x: 26, y: 8.4 },
				],
				true,
			);
			g.lineStyle(0.8, C(hp.line), 0.75).lineBetween(9, 4, 23, 4).lineBetween(8.5, 5.8, 23.5, 5.8);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 8.4, 21.6, 3.6);
		} else if (a.hat === 'frog') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.4, 16.8, 7.6).fillCircle(10.8, 1.8, 3).fillCircle(21.2, 1.8, 3);
			g.fillStyle(C('#fdf6e8'), 1).fillCircle(10.8, 1.4, 1.9).fillCircle(21.2, 1.4, 1.9);
			g.fillStyle(C('#2b2b2b'), 1).fillCircle(10.8, 1.7, 0.95).fillCircle(21.2, 1.7, 0.95);
		} else if (a.hat === 'cat-ears') {
			g.fillStyle(C(hp.a), 1);
			g.fillTriangle(9.2, 6.8, 10.6, -0.8, 15.8, 5);
			g.fillTriangle(22.8, 6.8, 21.4, -0.8, 16.2, 5);
			g.fillStyle(C('#e8a0b0'), 1);
			g.fillTriangle(10.7, 5.4, 11.4, 1.6, 14, 4.4);
			g.fillTriangle(21.3, 5.4, 20.6, 1.6, 18, 4.4);
		} else if (a.hat === 'visor') {
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 7.6, 22, 4.4);
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.3, 16, 4.6);
			g.lineStyle(1, C(hp.line), 0.7).lineBetween(10.5, 6.4, 21.5, 6.4);
		} else if (a.hat === 'halo') {
			g.lineStyle(1.6, C(hp.a), 1).strokeEllipse(16, 1.8, 13, 4);
			g.fillStyle(C('#fff3c4'), 1).fillCircle(21.5, 0.6, 0.7);
		} else if (a.hat === 'headphones') {
			g.fillStyle(C(hp.a), 1)
				.fillRoundedRect(6.2, 3, 19.6, 2.2, 1.1)
				.fillRoundedRect(6.2, 4, 2, 5.4, 1)
				.fillRoundedRect(23.8, 4, 2, 5.4, 1);
			g.fillStyle(C(hp.b), 1).fillRoundedRect(5.3, 8.6, 4.4, 7, 2).fillRoundedRect(22.3, 8.6, 4.4, 7, 2);
			g.fillStyle(C(hp.line), 1).fillRoundedRect(6.5, 10.4, 2, 3.4, 1).fillRoundedRect(23.5, 10.4, 2, 3.4, 1);
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
	[/orca/, 2.6], // the biggest thing in the preserve
	[/whale|dolphin/, 1.95],
	[/bear|elk|moose/, 1.7],
	[/deer|bighorn|mountain-goat|mountain-lion|coyote|seal|sandhill|crane|brown-pelican|eagle|turkey/, 1.42],
	[
		/fox|bobcat|otter|beaver|raccoon|porcupine|heron|owl|hawk|cormorant|marten|muskrat|mink|yellow-bellied-marmot|tortoise|sea-turtle|roadrunner|gull|snowshoe-hare/,
		1.18,
	],
	[
		/rabbit|cottontail|jackrabbit|duck|quail|white-tailed-ptarmigan|squirrel|rattlesnake|snake|nutcracker|woodpecker|shorebird|crab|sea-star|anemone/,
		0.95,
	],
	[
		/chipmunk|vole|rat|mouse|pika|sparrow|swallow|nuthatch|blackbird|meadowlark|frog|salamander|newt|lizard|turtle|trout|fish|mussel|clam/,
		0.7,
	],
	[/butterfly|bee|beetle|dragonfly|damselfly|grasshopper|strider|scorpion|desert-tarantula|slug|snail/, 0.5],
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
		if (re.test(animalId)) {
			base = size;
			break;
		}
	}
	if (base == null) base = KIND_SIZE[kind] ?? 1.0;
	// small deterministic jitter (±0.05) keyed off the id — variety without
	// ever flipping the size ordering between species.
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const jitter = (((hash >>> 3) % 11) - 5) / 100; // ±0.05, unsigned so it never overshoots
	return Math.round((base + jitter) * 100) / 100;
}

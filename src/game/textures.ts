// Procedural placeholder art — every sprite in Wild Willows is generated at
// boot from simple shapes, so the game ships with zero asset files.

import Phaser from 'phaser';

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

type G = Phaser.GameObjects.Graphics;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
	if (scene.textures.exists(key)) return;
	const g = scene.make.graphics({ x: 0, y: 0 }, false);
	draw(g);
	g.generateTexture(key, w, h);
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
}

{
	a('rabbit', 26, 26, (g) => {
		g.fillStyle(C('#b0987c'), 1).fillEllipse(13, 18, 18, 13).fillCircle(20, 13, 6);
		g.fillEllipse(18, 4, 4, 10).fillEllipse(23, 5, 4, 10); // ears
		g.fillStyle(0xffffff, 1).fillCircle(4, 19, 4); // tail
		g.fillStyle(0x2e2018, 1).fillCircle(22, 12, 1.4);
	});
	a('butterfly', 24, 20, (g) => {
		g.fillStyle(C('#e8771f'), 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12);
		g.fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
		g.lineStyle(2, 0x2e2018, 1).strokeEllipse(7, 8, 12, 12).strokeEllipse(17, 8, 12, 12);
		g.fillStyle(0x2e2018, 1).fillEllipse(12, 11, 3, 12);
	});
	a('sparrow', 24, 20, (g) => {
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
		g.fillStyle(C('#d3722e'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6);
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillEllipse(4, 16, 12, 8); // tail
		g.fillStyle(0xffffff, 1).fillCircle(1, 15, 3).fillEllipse(24, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	});
	a('squirrel', 26, 26, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillEllipse(14, 18, 14, 11).fillCircle(20, 12, 5);
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
		g.fillEllipse(3, 11, 10, 4); // tail
		g.fillStyle(C('#e8954f'), 1).fillCircle(10, 9, 1.6).fillCircle(15, 11, 1.6).fillCircle(19, 8, 1.4);
		g.fillStyle(0x2e2018, 1).fillCircle(24, 7, 1);
	});
	a('owl', 26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillTriangle(5, 6, 9, 12, 3, 12).fillTriangle(21, 6, 23, 12, 17, 12); // tufts
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(13, 20, 12, 14);
		g.fillStyle(0xf4e3b1, 1).fillCircle(9, 12, 3.4).fillCircle(17, 12, 3.4);
		g.fillStyle(0x2e2018, 1).fillCircle(9, 12, 1.6).fillCircle(17, 12, 1.6);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(13, 14, 11, 17, 15, 17);
	});
	a('bear', 40, 34, (g) => {
		g.fillStyle(0x2a2118, 1); // four stubby legs under the body
		g.fillRoundedRect(8, 23, 8, 10, 3).fillRoundedRect(25, 23, 8, 10, 3);
		g.fillStyle(0x33291f, 1).fillEllipse(20, 19, 32, 19); // body
		g.fillCircle(29, 12, 9); // head
		g.fillCircle(23, 5, 4).fillCircle(35, 5, 4); // ears
		g.fillStyle(0x4a3a2a, 1).fillCircle(23, 5, 2).fillCircle(35, 5, 2); // inner ears
		g.fillStyle(C('#7a5d42'), 1).fillEllipse(32, 15, 10, 7); // muzzle
		g.fillStyle(0x000000, 1).fillCircle(35, 14, 1.8); // nose
		g.fillStyle(0xffffff, 1).fillCircle(25, 10, 2.2).fillCircle(31, 9, 2.2); // eye whites
		g.fillStyle(0x000000, 1).fillCircle(25, 10, 1.2).fillCircle(31, 9, 1.2); // pupils
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
	'mule-deer-forest': 'ani-deer',
	'mule-deer-alpine': 'ani-deer',
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

/** Resolve which sprite + tint an animal uses (mirrors animalTexture). */
function animalSprite(animalId: string, kind: string): { name: string; tint: number | null } {
	if (FEATURED_TEXTURE[animalId]) return { name: FEATURED_TEXTURE[animalId].replace('ani-', ''), tint: null };
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const base = GENERIC_KINDS.includes(kind) ? kind : 'invertebrate';
	return { name: `${base}-${hash % 3}`, tint: animalTint(hash) };
}

/**
 * Render an animal's sprite as an SVG data URI for use in the DOM (field
 * journal). `silhouette` draws it as a single dark shape for animals that have
 * not returned yet.
 */
export function animalSpriteDataUri(animalId: string, kind: string, opts: { silhouette?: boolean } = {}): string {
	const { name, tint } = animalSprite(animalId, kind);
	const shape = ANIMAL_SPRITES[name] || ANIMAL_SPRITES['mammal-0'];
	const override = opts.silhouette ? '#4a4636' : null;
	const tintHex = tint != null ? hexOf(tint) : null;
	const g = new SvgGraphics(tintHex, override);
	shape.draw(g as unknown as G);
	return 'data:image/svg+xml;base64,' + btoa(g.toSvg(shape.w, shape.h));
}

/**
 * Build the player's sprite from their saved appearance — round and cozy,
 * matching the SVG preview in the character creator.
 */
export function makePlayerTexture(
	scene: Phaser.Scene,
	appearance: { skin?: string; hair?: string; outfit?: string; hat?: string; hairstyle?: string; body?: string } | undefined
): string {
	const a = {
		skin: appearance?.skin || '#eec39a',
		hair: appearance?.hair || '#6e4a33',
		outfit: appearance?.outfit || '#4a7c59',
		hat: appearance?.hat || 'straw',
		hairstyle: appearance?.hairstyle || 'short',
		body: appearance?.body || 'slim',
	};
	const key = `player-${a.skin}-${a.hair}-${a.outfit}-${a.hat}-${a.hairstyle}-${a.body}`.replace(/#/g, '');
	tex(scene, key, 32, 36, (g) => {
		const skin = C(a.skin), hair = C(a.hair), outfit = C(a.outfit);
		const bw = a.body === 'round' ? 21 : 17; // body width by build
		// long styles fall behind the body
		if (a.hairstyle === 'long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
		}
		if (a.hairstyle === 'curly-long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
			g.fillCircle(8, 22, 4).fillCircle(24, 22, 4).fillCircle(9, 27, 3.6).fillCircle(23, 27, 3.6).fillCircle(16, 29, 4);
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
		} else {
			g.fillEllipse(16, 7.4, 15, 7);
		}
		if (a.hairstyle === 'bun' && a.hat === 'none') {
			g.fillCircle(16, 2.4, 4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13, 4.6, 6, 1.6);
		}
		// face
		g.fillStyle(0x3b2e25, 1).fillCircle(13, 13, 1.2).fillCircle(19, 13, 1.2);
		g.fillStyle(0xe88888, 0.4).fillCircle(10.6, 15.2, 1.5).fillCircle(21.4, 15.2, 1.5);
		// hats
		if (a.hat === 'straw') {
			g.fillStyle(C('#c9a35c'), 1).fillEllipse(16, 7, 21, 6);
			g.fillStyle(C('#d8b56e'), 1).fillEllipse(16, 4, 11, 6);
			g.lineStyle(1.5, C('#a3814f'), 1).lineBetween(10, 6.5, 22, 6.5);
		} else if (a.hat === 'leaf') {
			g.fillStyle(C('#5d8a4a'), 1).fillEllipse(16, 5, 17, 6);
			g.lineStyle(1.2, C('#436b35'), 1).lineBetween(9, 5.5, 23, 4);
		} else if (a.hat === 'beanie') {
			g.fillStyle(C('#b5707a'), 1).fillEllipse(16, 5.6, 16, 8);
			g.fillStyle(C('#9e5f69'), 1).fillRect(8, 7, 16, 2.4);
			g.fillStyle(C('#e8d8c8'), 1).fillCircle(16, 1.8, 2);
		} else if (a.hairstyle !== 'bun' && a.hairstyle !== 'curly') {
			g.fillStyle(hair, 1).fillEllipse(16, 5.6, 14, 7);
		}
	});
	return key;
}

export function animalTexture(animalId: string, kind: string): { key: string; tint: number | null } {
	if (FEATURED_TEXTURE[animalId]) return { key: FEATURED_TEXTURE[animalId], tint: null };
	const base = GENERIC_KINDS.includes(kind) ? kind : 'invertebrate';
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const variant = hash % 3; // one of three silhouettes per kind
	return { key: `ani-${base}-${variant}`, tint: animalTint(hash) };
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

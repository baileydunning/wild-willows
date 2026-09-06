// Gatherable resource nodes, plus the snapshot pass that hands the DOM UI a
// data URL for every resource and object sprite (the crafting, planting and
// inventory menus are HTML, not canvas, so they can't draw from a texture).

import Phaser from 'phaser';
import { bridge } from '../bridge';
import { C, PICKED, tex } from './canvas';
import type { G } from './canvas';

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

const iconSnapshotCounts: Record<string, number> = {};

function snapshotIcons(
	scene: Phaser.Scene,
	prefix: string,
	keep?: (key: string) => boolean,
): Record<string, string> | null {
	const keys = scene.textures.getTextureKeys().filter((k) => k.startsWith(prefix) && (!keep || keep(k)));
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
	// `-picked` variants are the stripped, just-harvested state of a plant: a
	// world sprite only, never what a planting or crafting menu should offer.
	const icons = snapshotIcons(scene, 'obj-', (k) => !k.endsWith(PICKED));
	if (icons) bridge.shared.objectIcons = icons;
}

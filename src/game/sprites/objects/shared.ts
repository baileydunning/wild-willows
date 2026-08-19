// Objects that belong to more than one biome, or to none in particular.

import { bridge } from '../../bridge';
import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const SHARED: SpriteSet = {
	patch: def(36, 30, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 20, 34, 16);
		g.lineStyle(2, C('#4f8a38'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 5, 22, 8 + i * 5, 10);
	}),
	// the flat continuous mat, and the two must not read as the same plant.
	bunchgrass: def(36, 32, (g) => {
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
	}),
	bush: def(36, 32, (g) => {
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(12, 20, 11).fillCircle(24, 18, 12).fillCircle(18, 12, 10);
		g.fillStyle(C('#5d3a5f'), 1).fillCircle(12, 14, 2.4).fillCircle(22, 11, 2.4).fillCircle(27, 20, 2.4);
	}),
	// man-made rather than as the generic "some water goes here" ellipse.
	pond: def(52, 40, (g) => {
		g.fillStyle(C('#a89372'), 1).fillEllipse(26, 22, 52, 34); // excavated spoil rim
		g.fillStyle(C('#b9a37c'), 1).fillEllipse(26, 20, 48, 28); // packed clay lip
		g.fillStyle(C('#8a7550'), 1).fillEllipse(26, 22, 44, 27); // the liner, cut clean
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(26, 22, 40, 23); // held water
		g.fillStyle(C('#417ba8'), 1).fillEllipse(28, 24, 26, 13); // deeper middle
		g.fillStyle(C('#8fc0e0'), 0.8).fillEllipse(20, 17, 18, 8); // sky on the surface
		g.fillStyle(0xffffff, 0.4).fillEllipse(18, 15, 10, 3);
		g.fillStyle(C('#6f9450'), 1).fillEllipse(7, 30, 10, 5).fillEllipse(45, 14, 9, 4); // planted edge taking hold
	}),
	log: def(42, 26, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(21, 23, 40, 8); // ground
		g.fillStyle(C('#6a4a30'), 1).fillRoundedRect(2, 8, 30, 13, 6); // the log
		g.fillStyle(C('#7f5c3c'), 1).fillRoundedRect(2, 8, 26, 4, 2); // sunlit upper curve
		g.fillStyle(C('#8a6544'), 1).fillEllipse(32, 14, 12, 15); // the open end
		g.fillStyle(C('#5d4128'), 1).fillEllipse(32, 14, 9, 12);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(32, 15, 6, 9); // the dry chamber inside
		g.fillStyle(C('#3d3120'), 1).fillEllipse(32, 18, 6, 2.4); // its worn floor
		g.fillStyle(C('#5d8a4a'), 0.9).fillEllipse(11, 8, 11, 4); // moss on the outside
		g.fillStyle(C('#4f4030'), 1).fillEllipse(16, 15, 9, 3); // the seam it was opened along
	}),
	rocks: def(38, 30, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(12, 20, 9).fillCircle(26, 21, 8);
		g.fillStyle(C('#a8a8a4'), 1).fillCircle(19, 12, 8);
		g.fillStyle(0xffffff, 0.25).fillCircle(17, 9, 3);
	}),
	perch: def(22, 46, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(9, 4, 4, 40);
		g.fillRect(2, 8, 18, 3).fillRect(4, 18, 14, 3);
	}),
	fence: def(36, 26, (g) => {
		g.fillStyle(C('#a3814f'), 1).fillRect(2, 6, 5, 18).fillRect(29, 6, 5, 18);
		g.fillRect(0, 9, 36, 4).fillRect(0, 17, 36, 4);
	}),
	path: def(34, 26, (g) => {
		g.fillStyle(C('#c9b98a'), 1).fillRoundedRect(1, 4, 32, 18, 8);
		g.fillStyle(C('#b5a578'), 1).fillCircle(10, 13, 3).fillCircle(22, 11, 3).fillCircle(17, 17, 2.4);
	}),
	gravel: def(34, 26, (g) => {
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
	}),
	planks: def(34, 26, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(1, 4, 32, 18, 3);
		g.fillStyle(C('#a3814f'), 1);
		for (let i = 0; i < 3; i++) g.fillRoundedRect(3, 6 + i * 5.6, 28, 4.4, 1.5); // boards
		g.lineStyle(1, C('#7c5a3c'), 1).lineBetween(11, 5, 11, 21).lineBetween(23, 5, 23, 21); // seams
	}),
	flagstone: def(34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(1, 4, 32, 18, 5);
		g.fillStyle(C('#a8a8a2'), 1);
		g.fillTriangle(3, 6, 15, 5, 9, 20).fillTriangle(15, 5, 17, 21, 5, 20); // irregular slabs
		g.fillStyle(C('#9a9a94'), 1).fillTriangle(17, 5, 31, 7, 21, 20).fillTriangle(31, 7, 31, 20, 21, 20);
		g.lineStyle(1.2, C('#6e6e68'), 0.8).lineBetween(16, 5, 19, 21); // grout
	}),
	mossy: def(34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(1, 4, 32, 18, 5);
		g.fillStyle(C('#a8a8a2'), 1).fillCircle(10, 12, 5).fillCircle(23, 13, 5.4).fillCircle(17, 9, 4);
		g.fillStyle(C('#5d8a4a'), 0.85)
			.fillCircle(7, 16, 2.6)
			.fillCircle(15, 17, 3)
			.fillCircle(26, 17, 2.6)
			.fillCircle(20, 7, 2.2);
		g.fillStyle(C('#74a85e'), 0.9).fillCircle(13, 14, 1.6).fillCircle(24, 10, 1.6);
	}),
	chest: def(32, 28, (g) => {
		g.fillStyle(C('#8a6a44'), 1).fillRoundedRect(2, 8, 28, 18, 3);
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(2, 4, 28, 9, 3);
		g.fillStyle(C('#e3c75f'), 1).fillRect(14, 11, 4, 6);
		g.lineStyle(1, C('#5d4128'), 1).strokeRoundedRect(2, 4, 28, 22, 3);
	}),
	largechest: def(38, 32, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRoundedRect(2, 9, 34, 21, 3); // deep body
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(2, 4, 34, 11, 3); // domed lid
		g.fillStyle(C('#7c6248'), 1).fillRect(4, 16, 30, 3); // plank seam
		g.fillStyle(C('#8a8c92'), 1).fillRect(8, 4, 3, 26).fillRect(27, 4, 3, 26); // iron bands
		g.lineStyle(1, C('#3a2c1e'), 1).strokeRoundedRect(2, 4, 34, 26, 3);
		g.fillStyle(C('#e3c75f'), 1).fillRect(17, 13, 4, 7); // brass lock plate
		g.fillStyle(C('#a9842f'), 1).fillCircle(19, 16, 1.3);
	}),
	stand: def(26, 38, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(11, 12, 4, 24).fillRect(4, 32, 18, 4);
		g.fillStyle(C('#f4ecd8'), 1).fillRect(3, 2, 20, 13);
		g.lineStyle(1, C('#8a6a44'), 1).strokeRect(3, 2, 20, 13).lineBetween(13, 2, 13, 15);
	}),
	mound: def(38, 26, (g) => {
		g.fillStyle(C('#a8905f'), 1).fillEllipse(19, 17, 38, 17); // the heaped rise
		g.fillStyle(C('#c2a070'), 1).fillEllipse(18, 13, 32, 12); // loose sunlit crown
		g.fillStyle(C('#d4b585'), 1).fillEllipse(15, 10, 20, 7); // freshly turned, still pale
		g.fillStyle(C('#8a7048'), 1).fillEllipse(24, 18, 20, 11); // the one bare worked face
		g.fillStyle(C('#241c14'), 1).fillEllipse(24, 18, 11, 8); // tunnelled straight in
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(24, 21, 11, 2.4); // worn sill
		g.fillStyle(C('#b59a6c'), 1).fillEllipse(9, 21, 12, 4); // spoil spilling off the side
		g.fillStyle(C('#8f7850'), 1).fillCircle(6, 14, 1.6).fillCircle(30, 9, 1.4).fillCircle(12, 8, 1.2); // clods
	}),
	platform: def(30, 50, (g) => {
		g.fillStyle(C('#9a8a64'), 1).fillRect(13, 12, 5, 38);
		g.fillStyle(C('#b5a578'), 1).fillEllipse(15, 10, 28, 10);
		g.fillStyle(C('#8a6a44'), 1).fillEllipse(15, 7, 14, 6);
	}),
	vase: def(22, 30, (g) => {
		g.fillStyle(C('#7a9ac0'), 1).fillEllipse(11, 21, 14, 16);
		g.fillRect(8, 10, 6, 6);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(7, 7, 3).fillCircle(15, 7, 3).fillCircle(11, 4, 3);
	}),
	bridge: def(36, 34, (g) => {
		g.fillStyle(C('#a3814f'), 1);
		for (let i = 0; i < 5; i++) g.fillRoundedRect(2, 4 + i * 6, 32, 4.6, 2); // planks
		g.fillStyle(C('#7c5a3c'), 1).fillRect(4, 0, 4, 34).fillRect(28, 0, 4, 34); // rails
		g.fillStyle(C('#8c6a42'), 1)
			.fillCircle(6, 2, 2.4)
			.fillCircle(30, 2, 2.4)
			.fillCircle(6, 32, 2.4)
			.fillCircle(30, 32, 2.4);
	}),
	poppies: def(34, 30, (g) => {
		['#d9534f', '#e86a5a', '#c9443f'].forEach((c, i) => {
			const x = 7 + i * 10;
			g.lineStyle(2, C('#5f9e44'), 1).lineBetween(x, 12 + (i % 2) * 4, x, 26);
			g.fillStyle(C(c), 1).fillCircle(x, 9 + (i % 2) * 4, 4.4);
			g.fillStyle(0x2e2018, 1).fillCircle(x, 9 + (i % 2) * 4, 1.6);
		});
	}),
	lupines: def(32, 34, (g) => {
		['#7d6b9e', '#9d86d9', '#6a5a8e'].forEach((c, i) => {
			const x = 6 + i * 10;
			g.lineStyle(2, C('#5f9e44'), 1).lineBetween(x, 14, x, 30);
			g.fillStyle(C(c), 1);
			for (let b = 0; b < 5; b++) g.fillCircle(x + (b % 2 === 0 ? -1.6 : 1.6), 6 + b * 2.6 + (i % 2) * 3, 2.2);
		});
	}),
	willow: def(52, 62, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(23, 38, 7, 24);
		g.fillStyle(C('#6b9152'), 1).fillEllipse(26, 22, 42, 30);
		g.fillStyle(C('#7fa860'), 1).fillEllipse(22, 16, 22, 14);
		g.lineStyle(2.4, C('#8aba6a'), 1);
		for (let i = 0; i < 6; i++) {
			const x = 8 + i * 7.4;
			g.lineBetween(x, 28, x - 2, 48 + (i % 3) * 4);
		}
	}),
	oak: def(50, 58, (g) => {
		g.fillStyle(C('#6e553c'), 1).fillRect(22, 34, 8, 24);
		g.fillRect(17, 38, 6, 4).fillRect(29, 40, 7, 4);
		g.fillStyle(C('#4a6b3a'), 1).fillCircle(25, 20, 17).fillCircle(12, 28, 10).fillCircle(38, 28, 10);
		g.fillStyle(C('#5d8a4a'), 1).fillCircle(20, 14, 8);
		g.fillStyle(C('#a07a3e'), 1).fillCircle(33, 26, 2).fillCircle(15, 22, 2);
	}),
	pine: def(40, 60, (g) => {
		g.fillStyle(C('#6e553c'), 1).fillRect(17, 46, 6, 14);
		g.fillStyle(C('#3a5a44'), 1);
		g.fillTriangle(20, 2, 4, 26, 36, 26);
		g.fillTriangle(20, 14, 2, 42, 38, 42);
		g.fillTriangle(20, 28, 0, 52, 40, 52);
		g.fillStyle(C('#4d7257'), 1).fillTriangle(20, 6, 10, 22, 30, 22);
	}),
	kit: def(30, 26, (g) => {
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
	}),
	binoculars: def(30, 24, (g) => {
		// two barrels joined by a bridge, glass catching the light
		g.fillStyle(C('#5d4a36'), 1).fillRoundedRect(2, 4, 11, 16, 4).fillRoundedRect(17, 4, 11, 16, 4);
		g.fillStyle(C('#7a6a4f'), 1).fillRect(12, 8, 6, 5); // bridge
		g.fillStyle(C('#a8c8d8'), 1).fillCircle(7.5, 17, 3.6).fillCircle(22.5, 17, 3.6); // lenses
		g.fillStyle(0xffffff, 0.85).fillCircle(6.4, 15.8, 1.2).fillCircle(21.4, 15.8, 1.2); // glints
		g.fillStyle(C('#e3c75f'), 1).fillRect(4, 2, 22, 2.5); // woven strap across the top
	}),
	// own sprite now, so it no longer looks like a generic restoration kit.
	headlamp: def(30, 24, (g) => {
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
	}),
	// Hiking Boots: a broken-in pair, side-on, with lugged soles and woven laces.
	hikingboots: def(32, 26, (g) => {
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
	}),
	// --- decorative structures ---
	lantern: def(22, 44, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(9, 30, 4, 12); // post
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(4, 8, 14, 22, 4); // housing
		g.fillStyle(C('#ffd680'), 1).fillRoundedRect(7, 12, 8, 14, 2); // warm glass
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(3, 4, 16, 5, 2); // cap
	}),
	bench: def(40, 30, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(5, 20, 5, 10).fillRect(30, 20, 5, 10); // legs
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(3, 16, 34, 6, 2); // seat
		g.fillStyle(C('#9a7448'), 1).fillRoundedRect(4, 6, 32, 4, 2).fillRect(6, 8, 3, 10).fillRect(31, 8, 3, 10); // back
	}),
	arch: def(40, 48, (g) => {
		g.lineStyle(5, C('#8c6a42'), 1).strokeRoundedRect(6, 6, 28, 44, 14); // arch frame
		g.fillStyle(C('#5e9455'), 1).fillCircle(10, 10, 5).fillCircle(30, 10, 5).fillCircle(20, 6, 5); // greenery
		g.fillStyle(C('#d77bb1'), 1).fillCircle(8, 14, 2.4).fillCircle(33, 13, 2.4).fillCircle(20, 7, 2.4); // blooms
	}),
	birdbath: def(30, 38, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillRect(12, 18, 6, 18); // pedestal
		g.fillStyle(C('#a8a8a2'), 1).fillEllipse(15, 16, 26, 10); // basin
		g.fillStyle(C('#7fb4d8'), 1).fillEllipse(15, 15, 18, 6); // water
		g.fillStyle(0xffffff, 0.5).fillEllipse(11, 14, 6, 2);
	}),
	signpost: def(26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 6, 4, 36); // post
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(2, 10, 22, 10, 2); // board
		g.lineStyle(1, C('#7c5a3c'), 1).lineBetween(5, 15, 21, 15);
	}),
	planter: def(34, 28, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(3, 14, 28, 12, 2); // box
		g.fillStyle(C('#7c5a3c'), 1).fillRect(3, 14, 28, 3);
		g.fillStyle(C('#5e9455'), 1).fillCircle(9, 12, 5).fillCircle(18, 10, 5).fillCircle(26, 12, 5); // foliage
		g.fillStyle(C('#e3c75f'), 1).fillCircle(12, 9, 2).fillCircle(23, 9, 2); // flowers
	}),
	// --- decorative camp comforts (purely for fun) ---
	campfire: def(38, 30, (g) => {
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
	}),
	lanternstring: def(50, 30, (g) => {
		g.lineStyle(1.5, C('#6b5238'), 1).lineBetween(2, 4, 48, 4);
		const cols = ['#e8954f', '#e3c75f', '#d77bb1', '#7fb4d8', '#9bd17a'];
		cols.forEach((c, i) => {
			const x = 6 + i * 9.5;
			g.lineStyle(1, C('#6b5238'), 1).lineBetween(x, 4, x, 9);
			g.fillStyle(C(c), 1).fillRoundedRect(x - 3, 9, 6, 9, 3);
			g.fillStyle(0xffffff, 0.4).fillCircle(x - 1, 12, 1.2);
		});
	}),
	pinwheel: def(26, 42, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRect(12, 16, 3, 26);
		const blades: [string, number, number, number, number, number, number][] = [
			['#e86a8a', 13, 10, 22, 6, 22, 14],
			['#7fb4d8', 13, 10, 17, 1, 9, 4],
			['#f4d35e', 13, 10, 4, 6, 4, 14],
			['#9bd17a', 13, 10, 9, 16, 17, 19],
		];
		for (const [c, ax, ay, bx, by, cx, cy] of blades) g.fillStyle(C(c), 1).fillTriangle(ax, ay, bx, by, cx, cy);
		g.fillStyle(C('#6b5238'), 1).fillCircle(13, 10, 2);
	}),
	birdhouse: def(26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 22, 4, 20);
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(5, 10, 16, 16, 2);
		g.fillStyle(C('#8c5a3a'), 1).fillTriangle(3, 11, 13, 2, 23, 11);
		g.fillStyle(C('#3a2a1c'), 1).fillCircle(13, 18, 3.2);
		g.fillStyle(C('#6b5238'), 1).fillRect(12, 22, 2, 5);
	}),
	flowercart: def(42, 32, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(6, 12, 30, 12, 2);
		g.fillStyle(C('#6b5238'), 1).fillCircle(13, 27, 5).fillCircle(30, 27, 5);
		g.fillStyle(C('#caa15a'), 1).fillCircle(13, 27, 2).fillCircle(30, 27, 2);
		const cols = ['#d77bb1', '#e8954f', '#e3c75f', '#c45ad0', '#e86a6a'];
		cols.forEach((c, i) => g.fillStyle(C(c), 1).fillCircle(10 + i * 6, 10 - (i % 2) * 2, 3.4));
	}),
	hammock: def(46, 30, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(3, 6, 3, 22).fillRect(40, 6, 3, 22);
		g.fillStyle(C('#c8a86a'), 1).fillTriangle(5, 9, 41, 9, 23, 24);
		g.lineStyle(1, C('#a3814f'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(9 + i * 7, 10, 23, 23);
	}),
	gnome: def(22, 34, (g) => {
		g.fillStyle(C('#5e9455'), 1).fillRoundedRect(6, 20, 11, 13, 4);
		g.fillStyle(C('#f0d2a8'), 1).fillCircle(11, 17, 5);
		g.fillStyle(C('#e8e0d0'), 1).fillTriangle(7, 18, 15, 18, 11, 26);
		g.fillStyle(C('#c0392b'), 1).fillTriangle(4, 16, 18, 16, 11, 1);
		g.fillStyle(C('#3a2a1c'), 1).fillCircle(9, 16, 0.9).fillCircle(13, 16, 0.9);
	}),
	windchime: def(28, 38, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRoundedRect(7, 6, 14, 4, 2);
		const cols = ['#9bbcc8', '#c8b88a', '#b0a0c0', '#a8c0a0'];
		cols.forEach((c, i) => {
			const x = 9 + i * 3.5;
			g.lineStyle(1, C('#9a948a'), 1).lineBetween(x, 10, x, 14);
			g.fillStyle(C(c), 1).fillRoundedRect(x - 1.4, 14, 2.8, 14 + (i % 2) * 4, 1);
		});
	}),
	sundial: def(32, 28, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillRect(13, 14, 6, 14);
		g.fillStyle(C('#b8b4ac'), 1).fillEllipse(16, 13, 26, 9);
		g.fillStyle(C('#8a847a'), 1).fillTriangle(16, 13, 16, 4, 24, 12);
		g.lineStyle(1, C('#7a746a'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(16, 13, 6 + i * 5, 9);
	}),
	cairnstack: def(26, 36, (g) => {
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
	}),
	picnic: def(42, 30, (g) => {
		g.fillStyle(C('#d8d0c0'), 1).fillRoundedRect(4, 6, 34, 20, 3);
		g.fillStyle(C('#c25a5a'), 0.7);
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) g.fillRect(5 + c * 5.4, 7 + r * 4.6, 5, 4.2);
	}),
	potrow: def(42, 26, (g) => {
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
	}),
	// --- additional habitat objects (distinct silhouettes) ---
	clover: def(34, 26, (g) => {
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
	}),
	brushpile: def(42, 26, (g) => {
		g.fillStyle(C('#8a7048'), 1);
		const sticks = [
			[2, 18, 30, 4],
			[6, 13, 28, 4],
			[3, 8, 24, 4],
		] as const;
		for (const [x, y, w, h] of sticks) g.fillRoundedRect(x, y, w, h, 2);
		g.lineStyle(2, C('#6b5238'), 1).lineBetween(8, 6, 34, 20).lineBetween(30, 5, 6, 21);
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(34, 9, 9, 5);
	}),
	snag: def(24, 44, (g) => {
		g.fillStyle(C('#8a7860'), 1).fillRect(8, 8, 7, 36);
		g.fillStyle(C('#6e5c46'), 1).fillRect(8, 8, 3, 36);
		g.fillStyle(C('#8a7860'), 1).fillRect(2, 18, 7, 4).fillRect(15, 14, 6, 4); // broken limbs
		g.fillStyle(C('#5d4a36'), 1).fillTriangle(8, 8, 15, 8, 11, 2); // jagged top
	}),
	gazebo: def(54, 58, (g) => {
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
	}),
	trailtent: def(48, 40, (g) => {
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
	}),
	crystalcairn: def(28, 36, (g) => {
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
	}),
	// Rain Basin — a carved stone bowl brimming with collected rainwater.
	rainbasin: def(34, 30, (g) => {
		g.fillStyle(C('#7d7a72'), 1).fillEllipse(17, 24, 28, 9); // stone base shadow
		g.fillStyle(C('#9a978d'), 1).fillRoundedRect(4, 12, 26, 12, 5); // bowl body
		g.fillStyle(C('#84817a'), 1).fillEllipse(17, 12, 26, 9); // rim
		g.fillStyle(C('#6fa8d6'), 1).fillEllipse(17, 12, 20, 6); // water
		g.fillStyle(C('#bfe0f4'), 0.8).fillEllipse(13, 11, 7, 2); // sky glint
		g.lineStyle(1, C('#bfe0f4'), 0.5).strokeEllipse(17, 12, 13, 4); // ripple
		g.fillStyle(C('#cdecff'), 0.9).fillCircle(21, 6, 1).fillCircle(15, 4, 1); // falling drops
	}),
	// Dewlit Lantern — a glass globe of glowing morning dew on a slim post.
	dewlantern: def(24, 38, (g) => {
		g.fillStyle(C('#6e5a3a'), 1).fillRect(11, 20, 2, 16); // post
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(12, 36, 12, 4); // foot
		g.fillStyle(C('#a8d2c0'), 0.35).fillCircle(12, 13, 11); // soft glow halo
		g.fillStyle(C('#cdeee0'), 0.95).fillCircle(12, 13, 7); // dew globe
		g.fillStyle(C('#7fc4a8'), 0.9).fillCircle(12, 15, 4); // dew pool inside
		g.fillStyle(0xffffff, 0.9).fillCircle(9, 10, 1.6); // highlight
		g.fillStyle(C('#6e5a3a'), 1).fillRect(7, 4, 10, 2); // top cap
	}),
	// Sunstone Cairn — a stack of warm, sun-baked stones with an inner glow.
	sunstonecairn: def(30, 34, (g) => {
		g.fillStyle(C('#b98a3a'), 1).fillEllipse(15, 30, 24, 7); // base
		g.fillStyle(C('#e6a94e'), 1).fillEllipse(15, 27, 20, 9); // bottom stone
		g.fillStyle(C('#eebb63'), 1).fillEllipse(14, 19, 15, 8); // mid stone
		g.fillStyle(C('#f5cf7e'), 1).fillEllipse(15, 12, 10, 7); // top stone
		g.fillStyle(C('#fff0c4'), 0.7).fillCircle(15, 12, 3); // warm glow
		g.fillStyle(0xffffff, 0.5).fillCircle(12, 10, 1.4); // glint
		g.lineStyle(1, C('#a8742c'), 0.5).strokeEllipse(15, 27, 10, 4); // seam
	}),
	// Frostflower Planter — pale-blue ice blooms in a wooden box.
	frostflowerplanter: def(32, 30, (g) => {
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
	}),
	// Stormglass Lantern — a shard of lightning-fused glass throwing cold light.
	stormglasslantern: def(26, 38, (g) => {
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
	}),
	// untidy, deliberately nothing like the tight woven cup of `nest`.
	oldsticknest: def(36, 28, (g) => {
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
	}),
	// its side to show the root mat. Blocky and countable, not a patch.
	sodplug: def(34, 26, (g) => {
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
	}),
	// leaves and one narrow flight gap punched through at bird height.
	hedgerow: def(36, 30, (g) => {
		g.lineStyle(1.2, C('#584732'), 1);
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 4, 29, 6 + i * 3, 14); // tangled bare twigs
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 14, 36, 20); // dense hedge wall
		g.fillStyle(C('#3f5c39'), 1).fillCircle(7, 12, 8).fillCircle(18, 9, 9).fillCircle(29, 12, 8);
		g.fillStyle(C('#54774a'), 1).fillCircle(10, 8, 4).fillCircle(22, 6, 4.5).fillCircle(31, 10, 3.5); // sunlit leaf tops
		g.fillStyle(C('#1a2a18'), 1).fillEllipse(18, 17, 8, 10); // flight gap punched through
		g.fillStyle(C('#243a20'), 1).fillEllipse(18, 17, 5, 7);
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 26, 34, 8); // shaded base
	}),
	// that match them almost exactly. Flat, stony, no green at all.
	pebblescrape: def(34, 24, (g) => {
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
	}),
	// sown seed on the surface and a green fringe of seedlings round the rim.
	swaleseedbed: def(34, 24, (g) => {
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
	}),
	// standing round the base — darker and sharper-edged than the dryland `sedge`.
	sedgeclump: def(32, 34, (g) => {
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
	}),
	// chiselled in it and pale chips at the foot — a tall pillar, not a box.
	flickerhole: def(26, 36, (g) => {
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
	}),
	buddhastatue: def(28, 30, (g) => {
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
	}),
	luckytoad: def(28, 24, (g) => {
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
	}),
	// shelf down one side — the shape says "you could walk across this".
	shallowpool: def(48, 26, (g) => {
		g.fillStyle(C('#c2b189'), 1).fillEllipse(24, 15, 48, 22); // sandy surround
		g.fillStyle(C('#a9cfe2'), 1).fillEllipse(24, 15, 40, 15); // the shallow shelf
		g.fillStyle(C('#7fb4d8'), 1).fillEllipse(27, 15, 26, 11); // slightly deeper middle
		g.lineStyle(1, 0xffffff, 0.55).strokeEllipse(27, 15, 16, 6).strokeEllipse(27, 15, 9, 3.4); // ripple rings
		g.fillStyle(C('#b5a074'), 1).fillEllipse(8, 16, 12, 6); // wadeable bar breaking the edge
	}),
	// the pile are the habitat.
	logpile: def(44, 28, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(22, 23, 42, 9); // damp ground
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(4, 15, 36, 9, 4.5); // bottom course
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(2, 9, 30, 9, 4.5); // middle log, offset
		g.fillStyle(C('#94703f'), 1).fillRoundedRect(14, 4, 28, 8, 4); // top log
		g.fillStyle(C('#a3814f'), 1).fillEllipse(41, 8, 7, 8).fillEllipse(31, 13, 7, 9); // cut ends
		g.fillStyle(C('#5d4128'), 1).fillEllipse(41, 8, 3.4, 4).fillEllipse(31, 13, 3.4, 4.4);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(9, 19, 8, 5).fillEllipse(24, 19, 7, 5); // gaps right through
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(12, 8, 9, 3.4).fillEllipse(22, 15, 7, 3); // moss going soft
	}),
	// twigs still on, riddled with holes.
	branchpile: def(42, 28, (g) => {
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(21, 23, 40, 9); // ground
		g.lineStyle(3.4, C('#94703f'), 1); // branches thrown down every which way
		g.lineBetween(3, 22, 33, 8).lineBetween(6, 8, 36, 21).lineBetween(20, 4, 24, 24).lineBetween(2, 15, 39, 14);
		g.lineStyle(2.2, C('#7a5a3a'), 1);
		g.lineBetween(9, 24, 29, 5).lineBetween(12, 6, 32, 23);
		g.lineStyle(1.2, C('#a3814f'), 1); // twigs still on them
		g.lineBetween(33, 8, 39, 4).lineBetween(33, 8, 38, 10).lineBetween(6, 8, 2, 4).lineBetween(24, 24, 27, 27);
		g.lineBetween(20, 4, 17, 1).lineBetween(36, 21, 40, 24);
		g.fillStyle(C('#150f0a'), 0.85).fillEllipse(15, 16, 7, 5).fillEllipse(27, 17, 6, 4); // gaps to disappear into
	}),
	// what set it apart from the plain shrub.
	berrybush: def(38, 32, (g) => {
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
	}),
	// Medium Chest: plainly the bigger of the two — wider, banded, and stouter.
	mediumchest: def(34, 28, (g) => {
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
	}),
	// Migration Path Marker: cairn stones and a route marker rather than supplies.
	kitmarker: def(34, 28, (g) => {
		g.fillStyle(C('#4f4030'), 0.4).fillEllipse(17, 25, 28, 4); // shadow
		g.fillStyle(C('#8a8478'), 1).fillRoundedRect(3, 10, 28, 15, 2); // crate
		g.fillStyle(C('#9d86d9'), 1).fillRect(3, 14, 28, 4); // route-marker livery
		g.lineStyle(1, C('#6f6a62'), 1).lineBetween(10, 10, 10, 25).lineBetween(24, 10, 24, 25);
		g.fillStyle(C('#a8a29a'), 1).fillEllipse(11, 8, 12, 5).fillEllipse(11, 4, 9, 4).fillEllipse(11, 1, 6, 3); // cairn
		g.fillStyle(C('#c2bcb2'), 1).fillEllipse(10, 7, 7, 2).fillEllipse(10, 3.4, 5, 1.6);
		g.fillStyle(C('#7f6ab0'), 1).fillRect(24, 0, 2, 10); // the marker post
		g.fillStyle(C('#b7a5e6'), 1).fillTriangle(26, 1, 32, 3.4, 26, 6);
		g.fillStyle(0xffffff, 0.14).fillRect(3, 10, 28, 1.6);
	}),
	// Forest Restoration Kit: seed mixes and a coil of fibre twine.
	kitforest: def(34, 28, (g) => {
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
	}),
	// Scrubland Restoration Kit: bundled hardy cuttings and a sediment sled.
	kitscrub: def(34, 28, (g) => {
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
	}),
	// Alpine Restoration Kit: shade cloth, climbing gear and a water cache.
	kitalpine: def(34, 28, (g) => {
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
	}),
};

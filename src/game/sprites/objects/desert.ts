// Redstone Scrubland.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const DESERT: SpriteSet = {
	cactus: def(32, 44, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillRoundedRect(12, 6, 9, 36, 4);
		g.fillRoundedRect(3, 14, 10, 6, 3).fillRoundedRect(2, 10, 6, 12, 3);
		g.fillStyle(C('#d96a5a'), 1).fillCircle(16, 6, 3);
	}),
	brush: def(38, 28, (g) => {
		g.fillStyle(C('#8a8a4e'), 1).fillCircle(11, 19, 8).fillCircle(25, 18, 9).fillCircle(18, 12, 7);
		g.lineStyle(1, C('#6e6e3a'), 1).lineBetween(11, 26, 14, 12).lineBetween(25, 26, 22, 12);
	}),
	shade: def(40, 30, (g) => {
		g.fillStyle(C('#a08a72'), 1).fillRoundedRect(2, 4, 36, 10, 3);
		g.fillStyle(C('#3a3026'), 1).fillRect(6, 14, 28, 8);
		g.fillStyle(C('#8e8e8a'), 1).fillRect(2, 22, 8, 6).fillRect(30, 22, 8, 6);
	}),
	crevice: def(38, 26, (g) => {
		g.fillStyle(C('#b07a4a'), 1).fillTriangle(2, 24, 16, 4, 22, 24); // left slab
		g.fillStyle(C('#9a6838'), 1).fillTriangle(18, 24, 26, 6, 36, 24); // right slab
		g.fillStyle(C('#3a2a1c'), 1).fillTriangle(15, 24, 20, 11, 23, 24); // shadow crack
	}),
	guzzler: def(36, 24, (g) => {
		g.fillStyle(C('#9a8a6a'), 1).fillEllipse(18, 16, 34, 14); // clay rim
		g.fillStyle(C('#6f93b0'), 1).fillEllipse(18, 16, 24, 8); // water
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 14, 8, 2.5); // glint
	}),
	agave: def(34, 30, (g) => {
		g.fillStyle(C('#6f8a5a'), 1);
		for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, 3.14]) {
			const tx = 17 + Math.sin(ang) * 15;
			const ty = 22 - Math.cos(ang) * 14;
			g.fillTriangle(17, 22, tx - 3, ty + 3, tx + 3, ty + 3);
		}
		g.fillStyle(C('#8aa86a'), 1).fillCircle(17, 22, 4);
	}),
	ocotillo: def(30, 46, (g) => {
		g.lineStyle(2.5, C('#6e5238'), 1);
		for (const x of [9, 15, 21]) g.lineBetween(15, 44, x, 6);
		g.fillStyle(C('#c44a3a'), 1).fillCircle(9, 6, 2.4).fillCircle(15, 5, 2.4).fillCircle(21, 6, 2.4); // red tips
		g.fillStyle(C('#5d8a4a'), 0.7).fillEllipse(15, 42, 12, 5);
	}),
	pricklypear: def(34, 30, (g) => {
		g.fillStyle(C('#5e8a4a'), 1).fillEllipse(13, 20, 14, 18).fillEllipse(22, 13, 12, 14).fillEllipse(24, 24, 10, 11);
		g.lineStyle(1, C('#3f6e38'), 1).strokeEllipse(13, 20, 14, 18).strokeEllipse(22, 13, 12, 14);
		g.fillStyle(C('#e8954f'), 1).fillCircle(22, 6, 2.6).fillCircle(28, 9, 2.2);
	}),
	desertbloom: def(32, 24, (g) => {
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
	}),
	// --- desert exclusive crafts + biome trees ---
	feeder: def(26, 42, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(11, 4, 3, 8); // hook
		g.lineStyle(1.5, C('#6b5238'), 1).strokeCircle(12, 4, 3);
		g.fillStyle(C('#c0392b'), 1).fillRoundedRect(5, 14, 16, 16, 5); // red bottle
		g.fillStyle(C('#e3c75f'), 1).fillRoundedRect(4, 28, 18, 7, 3); // yellow base
		g.fillStyle(C('#f4e08a'), 1).fillCircle(8, 31, 1.6).fillCircle(13, 31, 1.6).fillCircle(18, 31, 1.6); // ports
		g.fillStyle(0xffffff, 0.4).fillEllipse(10, 19, 4, 7);
	}),
	geoderock: def(32, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillCircle(10, 17, 9).fillCircle(22, 18, 8); // grey rock
		g.fillStyle(C('#6a5a7a'), 1).fillCircle(20, 12, 7); // opened geode shell
		g.fillStyle(C('#a98fd0'), 1).fillCircle(20, 12, 4.5); // crystal lining
		g.fillStyle(C('#d8c8f0'), 1).fillTriangle(18, 12, 20, 7, 22, 12).fillTriangle(20, 13, 22, 9, 24, 13);
	}),
	totem: def(26, 46, (g) => {
		g.fillStyle(C('#b07a52'), 1).fillRoundedRect(5, 30, 16, 14, 3); // base block
		g.fillStyle(C('#c98a5a'), 1).fillRoundedRect(6, 18, 14, 13, 3); // middle block
		g.fillStyle(C('#a86a44'), 1).fillRoundedRect(7, 8, 12, 11, 3); // top block
		g.lineStyle(1, C('#6b4a32'), 1).lineBetween(6, 30, 20, 30).lineBetween(6, 18, 20, 18);
		g.fillStyle(C('#a98fd0'), 1).fillTriangle(13, 8, 9, 2, 17, 2); // crystal top
	}),
	paloverde: def(34, 42, (g) => {
		g.fillStyle(C('#7a9a4a'), 1).fillRect(15, 22, 4, 20); // green trunk
		g.lineStyle(2, C('#7a9a4a'), 1).lineBetween(17, 28, 9, 18).lineBetween(17, 26, 25, 16);
		g.fillStyle(C('#9ab86a'), 1).fillCircle(16, 12, 11).fillCircle(8, 18, 6).fillCircle(25, 17, 6); // airy canopy
		g.fillStyle(C('#e3c75f'), 1).fillCircle(12, 9, 1.6).fillCircle(20, 11, 1.6).fillCircle(17, 6, 1.6); // yellow blooms
	}),
	mesquite: def(38, 34, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(17, 22, 4, 12);
		g.lineStyle(2, C('#6b5238'), 1).lineBetween(19, 26, 9, 18).lineBetween(19, 24, 29, 16);
		g.fillStyle(C('#8a9a5a'), 1).fillEllipse(19, 13, 30, 16); // low wide airy canopy
		g.fillStyle(C('#9aab6a'), 1).fillCircle(11, 12, 5).fillCircle(27, 12, 5);
	}),
	ironwood: def(34, 38, (g) => {
		g.fillStyle(C('#5a5040'), 1).fillRect(15, 24, 5, 14);
		g.fillStyle(C('#7a8a6a'), 1).fillCircle(17, 15, 13).fillCircle(9, 20, 7).fillCircle(25, 20, 7); // dense grey-green
		g.fillStyle(C('#c89ad0'), 1).fillCircle(13, 11, 1.6).fillCircle(21, 13, 1.6); // pale blooms
	}),
	// mouth, far bigger and straighter-sided than anything else out here.
	tortoiseburrow: def(42, 28, (g) => {
		g.fillStyle(C('#9c8a68'), 1).fillEllipse(21, 20, 42, 16); // apron of worn spoil
		g.fillStyle(C('#7b6a4f'), 1).fillRoundedRect(4, 4, 34, 17, 4); // the bank it is cut into
		g.fillStyle(C('#8f7c5c'), 1).fillRoundedRect(4, 4, 34, 6, 3);
		g.fillStyle(C('#241c14'), 1).fillRoundedRect(11, 12, 20, 10, 5); // wide flat-floored mouth
		g.fillStyle(C('#241c14'), 1).fillEllipse(21, 12, 20, 8); // its domed roof
		g.fillStyle(C('#4f4030'), 1).fillEllipse(21, 21, 21, 3); // the worn sill it is kept open by
		g.fillStyle(C('#b5a07c'), 1).fillEllipse(21, 24, 26, 5); // the polished ramp out
	}),
	// with no spoil outside because nothing had to be dug.
	calichecave: def(40, 28, (g) => {
		g.fillStyle(C('#8a7f68'), 1).fillEllipse(20, 24, 38, 8); // rocky slope below
		g.fillStyle(C('#b9ac8e'), 1).fillRoundedRect(2, 3, 36, 20, 3); // the caliche bank
		g.fillStyle(C('#cdc2a6'), 1).fillRoundedRect(2, 3, 36, 6, 3); // hard cemented cap
		g.fillStyle(C('#a3957a'), 1).fillRect(2, 14, 36, 1.6); // a bedding seam
		g.fillStyle(C('#1f1810'), 1).fillEllipse(19, 17, 18, 12); // the eroded chamber
		g.fillStyle(C('#4a4030'), 1).fillEllipse(19, 12, 18, 4); // its solid roof
		g.fillStyle(C('#d8cdb2'), 1).fillEllipse(8, 8, 7, 4).fillEllipse(32, 10, 6, 3.5); // hard nodules in the face
	}),
	// humid air inside. Shown sealed, under its shrub.
	seedlarder: def(38, 28, (g) => {
		g.fillStyle(C('#a4885c'), 1).fillEllipse(19, 20, 38, 16); // sandy ground
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(19, 7, 32, 14); // the shrub over it
		g.fillStyle(C('#8f9c68'), 1).fillEllipse(13, 5, 18, 9);
		g.fillStyle(C('#3d3120'), 1).fillEllipse(13, 20, 11, 8); // one mouth, open
		g.fillStyle(C('#c2a878'), 1).fillEllipse(27, 20, 11, 8); // the other, plugged with sand
		g.fillStyle(C('#d8c49a'), 1).fillEllipse(27, 19, 8, 5);
		g.fillStyle(C('#8a7048'), 1).fillEllipse(20, 25, 24, 4); // swept apron
		g.fillStyle(C('#c9a95f'), 1).fillEllipse(9, 24, 4, 2).fillEllipse(31, 25, 3.5, 1.8); // spilled seed
	}),
	// not the mouth, is what reads.
	deepsandburrow: def(34, 30, (g) => {
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
	}),
	// Sandy Den: several mouths in one low rise — the extra doors are the feature.
	kitfoxden: def(42, 26, (g) => {
		g.fillStyle(C('#8d7f66'), 1).fillEllipse(21, 16, 42, 18); // low sandy rise
		g.fillStyle(C('#a3957a'), 1).fillEllipse(20, 11, 34, 11); // sunlit crown
		g.fillStyle(C('#241c14'), 1); // the several entrances
		g.fillEllipse(9, 17, 10, 7).fillEllipse(22, 19, 11, 8).fillEllipse(34, 16, 9, 6);
		g.fillStyle(C('#4a3f2e'), 1);
		g.fillEllipse(9, 19.5, 10, 2.4).fillEllipse(22, 22, 11, 2.6).fillEllipse(34, 18.5, 9, 2.2); // worn sills
		g.fillStyle(C('#c2b494'), 1).fillEllipse(15, 23, 10, 3).fillEllipse(29, 23, 9, 3); // fans of loose sand
	}),
	// with dry gravel running below it.
	washbankden: def(44, 28, (g) => {
		g.fillStyle(C('#c2b494'), 1).fillEllipse(22, 24, 44, 9); // dry gravel wash bed
		g.fillStyle(C('#a89a7c'), 1).fillEllipse(12, 25, 12, 3).fillEllipse(31, 25, 11, 3);
		g.fillStyle(C('#85704f'), 1).fillRoundedRect(2, 3, 40, 18, 3); // the cut bank
		g.fillStyle(C('#9a8560'), 1).fillRoundedRect(2, 3, 40, 5, 2.5); // dry top
		g.fillStyle(C('#6f5c42'), 1).fillRect(2, 12, 40, 1.4).fillRect(2, 17, 40, 1.2); // flood strata
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 12, 14, 9); // the den, above the flood line
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(20, 15, 14, 2.6);
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(8, 3, 12, 4).fillEllipse(34, 3, 11, 4); // scrub on the rim
	}),
	// year — the crack runs back further than the light goes.
	desertwinterden: def(38, 30, (g) => {
		g.fillStyle(C('#6f6660'), 1).fillCircle(12, 17, 12).fillCircle(27, 16, 11).fillCircle(19, 23, 10); // broken rock
		g.fillStyle(C('#857a72'), 1).fillCircle(11, 12, 8).fillCircle(28, 12, 7);
		g.fillStyle(C('#0f0b08'), 1).fillTriangle(15, 4, 22, 4, 19, 27); // the fissure
		g.fillStyle(C('#0f0b08'), 1).fillTriangle(16, 12, 24, 16, 19, 27);
		g.fillStyle(C('#3a322c'), 1).fillTriangle(15, 4, 18, 4, 18, 14); // its lit lip
		g.fillStyle(C('#9a8f86'), 1).fillEllipse(6, 25, 9, 5).fillEllipse(33, 25, 8, 5); // rubble at the foot
	}),
	// across the sand — the lines are the tell.
	silkburrow: def(38, 30, (g) => {
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
	}),
	// front leaving one route in.
	canyonledgeden: def(42, 30, (g) => {
		g.fillStyle(C('#8a5f45'), 1).fillRoundedRect(2, 2, 38, 24, 3); // canyon wall
		g.fillStyle(C('#a3765a'), 1).fillRoundedRect(2, 2, 38, 7, 3); // sunlit rim
		g.fillStyle(C('#75503a'), 1).fillRect(2, 13, 38, 1.6).fillRect(2, 19, 38, 1.4); // strata
		g.fillStyle(C('#120c08'), 1).fillEllipse(21, 19, 26, 12); // the cut-back overhang
		g.fillStyle(C('#3a2418'), 1).fillEllipse(21, 14, 26, 5); // its shaded roof
		g.fillStyle(C('#9c6f52'), 1).fillTriangle(4, 28, 14, 14, 18, 28).fillTriangle(28, 28, 34, 16, 40, 28); // fallen slabs
		g.fillStyle(C('#b08066'), 1).fillTriangle(5, 27, 13, 16, 15, 27);
		g.fillStyle(C('#120c08'), 1).fillEllipse(23, 25, 7, 5); // the one way in
	}),
	// Borrowed Burrow: swept clean, with a fan of loose sand thrown out in front.
	borrowedburrow: def(38, 26, (g) => {
		g.fillStyle(C('#9a7f52'), 1).fillEllipse(19, 15, 38, 18); // desert ground
		g.fillStyle(C('#b09468'), 1).fillEllipse(18, 11, 30, 11);
		g.fillStyle(C('#d8c49a'), 1).fillTriangle(19, 15, 4, 25, 34, 25); // the fan of thrown sand
		g.fillStyle(C('#e2d3ac'), 1).fillTriangle(19, 16, 9, 24, 29, 24);
		g.fillStyle(C('#241c14'), 1).fillEllipse(19, 14, 13, 10); // the widened mouth
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(19, 17.5, 13, 2.6); // swept sill
		g.fillStyle(C('#c2ad86'), 1).fillEllipse(11, 12, 6, 3).fillEllipse(28, 12, 5, 2.6); // spoil either side
	}),
	// its roots take everything around it, and the silhouette should say so.
	creosotebush: def(40, 32, (g) => {
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
	}),
	// dense clumps within another plant's branches, not on the ground.
	mistletoe: def(38, 30, (g) => {
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
	}),
	// shape matters, so they are drawn as little trumpets, not dots.
	chuparosa: def(38, 30, (g) => {
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
	}),
	// claws along the branches and heavy pods hanging under them.
	catclaw: def(42, 30, (g) => {
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
	}),
	// the shrub it shelters in is part of the identity.
	bushmuhly: def(38, 30, (g) => {
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
	}),
	// discarded husks, and a column of ants coming in.
	antmound: def(42, 28, (g) => {
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
	}),
	// riddled with fine tunnels — the mound is the habitat, the shrub is the lid.
	creosotemound: def(40, 30, (g) => {
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
	}),
	// contact with damp earth rather than lying dry on it.
	burieddeadwood: def(42, 26, (g) => {
		g.fillStyle(C('#b09874'), 1).fillEllipse(21, 11, 42, 16); // dry desert surface
		g.fillStyle(C('#8a7050'), 1).fillEllipse(21, 19, 42, 14); // damp worked soil below
		g.fillStyle(C('#6e5a41'), 1); // stems part-buried, at angles
		g.fillRoundedRect(4, 12, 18, 4, 2).fillRoundedRect(14, 17, 20, 4, 2).fillRoundedRect(24, 9, 15, 3.4, 1.7);
		g.fillStyle(C('#846d4e'), 1).fillRoundedRect(4, 12, 16, 1.6, 0.8).fillRoundedRect(24, 9, 13, 1.4, 0.7);
		g.fillStyle(C('#7d6a4e'), 0.75).fillEllipse(12, 15, 16, 5).fillEllipse(28, 20, 15, 5); // soil closing over them
		g.fillStyle(C('#5c4a35'), 1).fillEllipse(21, 22, 30, 5); // dark damp contact zone
		g.fillStyle(C('#c2ab82'), 1).fillCircle(8, 7, 1.4).fillCircle(31, 5, 1.2).fillCircle(19, 6, 1.1); // surface grit
	}),
	// pale callus, and it outlasts the plant.
	saguaroboot: def(30, 40, (g) => {
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
	}),
	// the thorns around it are the defence.
	thornnest: def(40, 34, (g) => {
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
	}),
	// contrast between hot open ground and the dark hollow is the object.
	shadeform: def(40, 28, (g) => {
		g.fillStyle(C('#dcc79a'), 1).fillEllipse(20, 20, 40, 16); // hot open ground
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(20, 9, 36, 16); // the shrub
		g.fillStyle(C('#8d9a68'), 1).fillEllipse(13, 6, 20, 9).fillEllipse(29, 6, 16, 8);
		g.fillStyle(C('#4a4130'), 0.55).fillEllipse(20, 20, 30, 11); // its pool of shade
		g.fillStyle(C('#a3906a'), 1).fillEllipse(20, 20, 18, 8); // the scrape
		g.fillStyle(C('#6f6148'), 1).fillEllipse(20, 21, 13, 5.5); // cool soil at the bottom
		g.fillStyle(C('#544a36'), 1).fillEllipse(20, 22, 9, 3);
		g.fillStyle(C('#b5a078'), 1).fillEllipse(20, 17, 16, 2.4); // spoil pushed to the upslope rim
	}),
	// top, dark and damp underneath.
	shrublitter: def(40, 28, (g) => {
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
	}),
	// fine old galleries showing through where it has broken.
	crumbledsoil: def(42, 24, (g) => {
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
	}),
	// could dig straight into, so nothing grows on it.
	bareground: def(42, 22, (g) => {
		g.fillStyle(C('#b59c72'), 1).fillEllipse(21, 12, 42, 16); // the open patch
		g.fillStyle(C('#cbb287'), 1).fillEllipse(20, 9, 34, 11); // soft uncompacted soil
		g.fillStyle(C('#d8c49a'), 1).fillEllipse(17, 7, 22, 6);
		g.fillStyle(C('#a08a64'), 1); // crumb structure, nothing packed
		for (let i = 0; i < 18; i++) g.fillCircle(4 + ((i * 7) % 34), 7 + ((i * 5) % 10), 1.2 + (i % 3) * 0.3);
		g.fillStyle(C('#7d8b5a'), 1).fillEllipse(2, 6, 9, 6).fillEllipse(40, 8, 8, 6); // shrubs, kept back from it
		g.fillStyle(C('#8f6f4a'), 1).fillEllipse(21, 18, 26, 3); // and the ground stays bare
	}),
	// with the beetles and flies that did it.
	carrionground: def(42, 24, (g) => {
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
	}),
	// its crown of white flowers.
	saguarocolumn: def(32, 48, (g) => {
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
	}),
	// the sheltered space inside the tangle showing dark.
	cholla: def(34, 40, (g) => {
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
	}),
	// the richest food out here for a few weeks.
	saguarofruit: def(34, 44, (g) => {
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
	}),
	// happens where every flower got pollinated.
	cactusfruitset: def(40, 34, (g) => {
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
	}),
	// arms — wide enough for a whole family.
	cactuscrownnest: def(36, 46, (g) => {
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
	}),
	// by a whole herd lying up in the heat.
	thicketbed: def(44, 30, (g) => {
		g.fillStyle(C('#c2ab82'), 1).fillEllipse(22, 22, 44, 16); // desert ground
		g.fillStyle(C('#5f7042'), 1).fillEllipse(22, 9, 42, 18); // dense thornscrub over it
		g.fillStyle(C('#6f8250'), 1).fillEllipse(13, 6, 22, 10).fillEllipse(32, 5, 18, 9);
		g.lineStyle(1, C('#4f5f38'), 1);
		for (let i = 0; i < 8; i++) g.lineBetween(5 + i * 5, 16, 4 + i * 5.2, 10 + (i % 3) * 2); // thorny stems
		g.fillStyle(C('#4a4130'), 0.5).fillEllipse(22, 21, 36, 12); // deep shade under it
		g.fillStyle(C('#8b7a52'), 1).fillEllipse(22, 21, 30, 11); // the worn hollow
		g.fillStyle(C('#6f6148'), 1).fillEllipse(15, 22, 14, 6).fillEllipse(29, 21, 13, 6); // separate body-scoops
		g.fillStyle(C('#a3936a'), 0.8).fillEllipse(22, 17, 26, 3); // dust kicked to the rim
	}),
	// continuous, and obviously alive.
	soilcrust: def(42, 22, (g) => {
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
	}),
};

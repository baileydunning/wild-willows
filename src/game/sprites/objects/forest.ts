// Old Hollow Forest.

import { C, def, pickable } from '../canvas';
import type { SpriteSet } from '../canvas';

export const FOREST: SpriteSet = {
	tree: def(52, 64, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(23, 36, 8, 26);
		g.fillStyle(C('#3f6e38'), 1).fillCircle(26, 22, 18).fillCircle(13, 31, 11).fillCircle(39, 31, 11);
		g.fillStyle(C('#558a4a'), 0.9).fillCircle(20, 16, 8);
	}),
	deadwood: def(30, 56, (g) => {
		g.fillStyle(C('#8d7a5e'), 1).fillRect(12, 8, 7, 48);
		g.fillRect(4, 16, 10, 4).fillRect(17, 26, 11, 4);
		g.fillStyle(C('#5d4128'), 1).fillCircle(15, 20, 1.6).fillCircle(16, 34, 1.6);
	}),
	nest: def(40, 30, (g) => {
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
	}),
	batbox: def(24, 40, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(10, 26, 4, 14); // post
		g.fillStyle(C('#5d4128'), 1).fillRoundedRect(4, 6, 16, 22, 2); // tall box
		g.fillStyle(C('#7c5a3c'), 1).fillTriangle(3, 7, 12, 1, 21, 7); // roof
		g.fillStyle(C('#2e2018'), 1).fillRect(7, 24, 10, 3); // entry slot beneath
	}),
	leaflitter: def(36, 22, (g) => {
		g.fillStyle(C('#6b4f30'), 1).fillEllipse(18, 16, 32, 12); // mound
		const cols = ['#b07a3a', '#caa15a', '#9a6a32', '#8a6a3a'];
		for (let i = 0; i < 11; i++) {
			const x = 5 + i * 2.8,
				y = 9 + ((i * 5) % 8);
			g.fillStyle(C(cols[i % 4]), 1).fillEllipse(x, y, 5, 3.4);
		}
	}),
	fernclump: def(34, 34, (g) => {
		g.lineStyle(2.5, C('#4f7d3a'), 1);
		for (const ang of [-0.9, -0.45, 0, 0.45, 0.9]) {
			const tx = 17 + Math.sin(ang) * 15;
			g.lineBetween(17, 32, tx, 6 + Math.abs(ang) * 6);
		}
		g.fillStyle(C('#6ba04a'), 1).fillEllipse(17, 30, 16, 6);
	}),
	stump: def(30, 26, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(5, 8, 20, 16, 4);
		g.fillStyle(C('#9a7448'), 1).fillEllipse(15, 9, 20, 9);
		g.fillStyle(C('#7c5a3c'), 1).fillEllipse(15, 9, 12, 5);
		g.fillStyle(C('#5d4128'), 1).fillEllipse(15, 9, 5, 2.4);
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(8, 22, 9, 4);
	}),
	...pickable('mushrooms', 32, 24, (g, picked) => {
		g.fillStyle(C('#e6dccd'), 1).fillRect(9, 12, 3, 9).fillRect(18, 14, 3, 8).fillRect(24, 16, 2, 6);
		if (picked) {
			// caps cut off; the ring is a row of pale stems with fresh cut ends
			g.fillStyle(C('#cfc3b0'), 1).fillRect(9, 12, 3, 2).fillRect(18, 14, 3, 2).fillRect(24, 16, 2, 1.6);
			return;
		}
		g.fillStyle(C('#c0392b'), 1).fillEllipse(10, 12, 14, 9).fillEllipse(19, 14, 11, 7).fillEllipse(25, 16, 7, 5);
		g.fillStyle(0xffffff, 0.85).fillCircle(7, 11, 1.4).fillCircle(13, 13, 1.2).fillCircle(20, 14, 1.2);
	}),
	...pickable('birch', 34, 42, (g, picked) => {
		g.fillStyle(C('#e8e6df'), 1).fillRect(15, 18, 5, 24); // white trunk
		g.fillStyle(0x2e2e2e, 1).fillRect(15, 24, 5, 1.6).fillRect(15, 31, 5, 1.6);
		// a panel of bark peeled off the trunk, tan wood showing through — drawn
		// over the lenticels, because the strip took them with it
		if (picked) {
			g.fillStyle(C('#c9a877'), 1).fillRect(15.4, 23, 4.2, 16);
			g.fillStyle(C('#b08f60'), 1).fillRect(15.4, 23, 1.4, 16);
			g.fillStyle(C('#dcc79c'), 1).fillRect(18.4, 23, 1.2, 16);
		}
		g.fillStyle(C('#7bbf5a'), 1).fillCircle(17, 12, 11).fillCircle(9, 18, 6).fillCircle(25, 18, 6);
	}),
	// Fern Spring: a mossy seep, not open water — a dark trickle under arching fronds.
	springseep: def(38, 32, (g) => {
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
	}),
	// Woodland Pool: deep shade, cold blue-grey water, soft muddy walk-down edge.
	woodlandpool: def(44, 32, (g) => {
		g.fillStyle(C('#5a4a34'), 1).fillEllipse(22, 19, 44, 24); // damp forest floor
		g.fillStyle(C('#6b5a3e'), 1).fillEllipse(9, 24, 20, 9); // muddy walk-down edge
		g.fillStyle(C('#4f86a8'), 1).fillEllipse(23, 17, 34, 18); // cold spring-fed water
		g.fillStyle(C('#2f5468'), 1).fillEllipse(26, 18, 20, 10); // deep shaded middle
		g.fillStyle(C('#6fa8c4'), 0.6).fillEllipse(17, 13, 14, 5); // the one shaft of light on it
		g.fillStyle(C('#3a2e20'), 0.5).fillEllipse(30, 8, 22, 7); // canopy shadow across the top
	}),
	// Dead Tree Over Water: the drop below the cavity is the whole point.
	floodedsnag: def(30, 44, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(15, 39, 30, 12); // water at the base
		g.fillStyle(C('#87b0c0'), 0.6).fillEllipse(12, 38, 16, 4);
		g.fillStyle(C('#7e7458'), 1).fillRect(11, 2, 8, 38); // dead trunk standing in it
		g.fillStyle(C('#5f5844'), 1).fillRect(11, 2, 3, 38); // shadow side
		g.fillStyle(C('#948a6a'), 1).fillRect(16, 2, 2, 38); // bleached side
		g.fillStyle(C('#8a8068'), 1).fillRect(3, 9, 8, 2.4).fillRect(19, 15, 8, 2.2); // broken limbs
		g.fillStyle(C('#2a2318'), 1).fillEllipse(15, 11, 7, 8); // the cavity, high up
		g.fillStyle(C('#4a4030'), 1).fillEllipse(15, 8.5, 7, 2.6); // worn lip
		g.fillStyle(0x000000, 0.2).fillEllipse(15, 39, 12, 3); // reflection under it
	}),
	// Crayfish Shallows: ankle-deep, all loose flat rock, dark gaps under every one.
	crayfishshallows: def(42, 26, (g) => {
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
	}),
	// holding a shine of water.
	elkwallow: def(42, 28, (g) => {
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
	}),
	// to a store bigger than the entrance would suggest.
	larderburrow: def(40, 30, (g) => {
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
	}),
	// underneath is the den.
	rootplateden: def(42, 34, (g) => {
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
	}),
	// face, widened by generations.
	earthdenbank: def(46, 28, (g) => {
		g.fillStyle(C('#6f5c42'), 1).fillEllipse(23, 17, 46, 24); // the slope
		g.fillStyle(C('#856f50'), 1).fillEllipse(22, 9, 40, 13); // dry sunlit upper face
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(10, 3, 18, 6).fillEllipse(34, 3, 16, 6); // turf on the crest
		g.fillStyle(C('#241c14'), 1); // several entrances along it
		g.fillEllipse(10, 16, 11, 8).fillEllipse(24, 18, 12, 9).fillEllipse(37, 15, 10, 7);
		g.fillStyle(C('#4a3f2e'), 1);
		g.fillEllipse(10, 19, 11, 2.4).fillEllipse(24, 21.5, 12, 2.6).fillEllipse(37, 17.5, 10, 2.2);
		g.fillStyle(C('#9a8464'), 1).fillEllipse(17, 24, 13, 4).fillEllipse(31, 24, 12, 4); // spoil fans, long since packed
	}),
	// the frost line.
	forestwinterden: def(40, 28, (g) => {
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
	}),
	// the defence, so the sprite is tall.
	denningtree: def(32, 46, (g) => {
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
	}),
	// screened by brush.
	rockydenledge: def(42, 28, (g) => {
		g.fillStyle(C('#8a8a70'), 1).fillEllipse(21, 24, 40, 8); // ground
		g.fillStyle(C('#7f8288'), 1).fillTriangle(3, 20, 38, 4, 41, 12).fillTriangle(3, 20, 41, 12, 8, 22); // the leaning slab
		g.fillStyle(C('#969aa0'), 1).fillTriangle(4, 19, 37, 5, 39, 9).fillTriangle(4, 19, 39, 9, 7, 20); // lit face
		g.fillStyle(C('#150f0a'), 1).fillTriangle(6, 22, 36, 12, 38, 19).fillTriangle(6, 22, 38, 19, 10, 24); // the gap beneath
		g.fillStyle(C('#5f6a70'), 1).fillCircle(38, 21, 6).fillCircle(5, 23, 5); // rock at each end
		g.fillStyle(C('#4f7d3a'), 1).fillCircle(12, 21, 7).fillCircle(20, 23, 6); // brush screening it
		g.fillStyle(C('#5f9448'), 1).fillCircle(11, 18, 4).fillCircle(21, 20, 3.5);
	}),
	// nothing outside it — the contrast is the whole idea.
	browseexclosure: def(44, 30, (g) => {
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
	}),
	// Hemlock Stand: close-grown dark conifers holding snow up off the ground.
	hemlockstand: def(40, 44, (g) => {
		g.fillStyle(C('#4a5f3f'), 1).fillEllipse(20, 40, 38, 8); // shaded floor beneath
		g.fillStyle(C('#6b5b3f'), 1).fillRect(11, 30, 3, 10).fillRect(25, 32, 3, 8).fillRect(18, 28, 3.4, 12);
		g.fillStyle(C('#2f4a37'), 1); // three crowns, close-grown
		g.fillTriangle(2, 34, 12, 6, 22, 34).fillTriangle(17, 36, 27, 10, 37, 36).fillTriangle(10, 32, 20, 2, 30, 32);
		g.fillStyle(C('#3d5c44'), 1).fillTriangle(6, 32, 12, 10, 18, 32).fillTriangle(15, 30, 20, 6, 25, 30);
		g.fillStyle(0xffffff, 0.8); // snow held in the canopy, not on the ground
		g.fillEllipse(12, 12, 9, 3).fillEllipse(20, 8, 8, 3).fillEllipse(27, 16, 8, 3).fillEllipse(15, 20, 7, 2.6);
		g.fillStyle(0xffffff, 0.5).fillEllipse(24, 24, 7, 2.4).fillEllipse(9, 26, 6, 2.2);
	}),
	// warmth is the point, so the sprite shows heat coming off it.
	eggmound: def(42, 30, (g) => {
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
	}),
	// Acorn Cache: soft open ground pocked with single little digs, one acorn each.
	acorncache: def(42, 26, (g) => {
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
	}),
	// holes where something has been turning it over.
	diggingground: def(42, 26, (g) => {
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
	}),
	// brackets stepping up the side and caps along the top.
	mushroomlog: def(44, 26, (g) => {
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
	}),
	// hemlock seedlings in a line along a moss-covered log.
	nurselog: def(46, 30, (g) => {
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
	}),
	// around a dark sealed void.
	hollowheartlog: def(42, 28, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(21, 24, 40, 8); // ground
		g.fillStyle(C('#7a6a4e'), 1).fillRoundedRect(2, 9, 30, 13, 6); // the outer shell
		g.fillStyle(C('#8f7e5e'), 1).fillRoundedRect(2, 9, 26, 4, 2);
		g.fillStyle(C('#95845f'), 1).fillEllipse(32, 15, 12, 15); // the open end, shell still sound
		g.fillStyle(C('#6b5b42'), 1).fillEllipse(32, 15, 9, 12); // inner ring
		g.fillStyle(C('#0f0b08'), 1).fillEllipse(32, 15, 6.5, 9); // and nothing in the middle
		g.fillStyle(C('#3d3120'), 0.9).fillEllipse(32, 19, 6, 2.4); // damp floor of the void
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(12, 9, 14, 4); // moss on the sound outside
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(7, 14, 6, 3); // a knot
	}),
	// bleached colour is the tell.
	softrotsnag: def(28, 34, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(14, 31, 24, 7); // forest floor
		g.fillStyle(C('#8c7f6a'), 1).fillRoundedRect(8, 6, 12, 26, 2); // the stub
		g.fillStyle(C('#a89c88'), 1).fillRoundedRect(8, 6, 5, 26, 2); // pale rotted side
		g.fillStyle(C('#c9c2b0'), 1).fillEllipse(14, 7, 12, 5); // soft white-rot top
		g.fillStyle(C('#ded8c8'), 1).fillEllipse(13, 6, 8, 3);
		g.fillStyle(C('#b5aa94'), 1); // thumbnail-soft pockets
		g.fillEllipse(11, 15, 6, 4).fillEllipse(17, 22, 5, 4).fillEllipse(12, 26, 5, 3.4);
		g.fillStyle(C('#7f7360'), 1).fillEllipse(11, 15, 3, 2).fillEllipse(17, 22, 2.6, 2);
		g.fillStyle(C('#4f7d3a'), 1).fillEllipse(14, 30, 15, 4); // moss at the base
	}),
	// so the slabs stand proud of the trunk with shadow behind them.
	barkslabsnag: def(30, 44, (g) => {
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
	}),
	// shaft looking straight down into it.
	chimneytree: def(34, 46, (g) => {
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
	}),
	// is scaled so it reads small.
	downycavity: def(26, 38, (g) => {
		g.fillStyle(C('#5f7a44'), 1).fillEllipse(13, 35, 22, 6); // ground
		g.fillStyle(C('#9a8b70'), 1).fillRect(7, 2, 12, 34); // slim dead trunk
		g.fillStyle(C('#b0a189'), 1).fillRect(14, 2, 3, 34); // lit side
		g.fillStyle(C('#7f7360'), 1).fillRect(7, 2, 3, 34);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(13, 14, 2.8); // the thumb-wide hole
		g.fillStyle(C('#c2b49c'), 1).fillEllipse(13, 11.6, 5, 1.4); // fresh pale rim
		g.fillStyle(C('#d8cbb2'), 1); // a season's chips still at the foot
		g.fillEllipse(9, 33, 5, 2).fillEllipse(16, 34, 4, 1.8).fillEllipse(13, 32, 3.4, 1.6);
		g.fillStyle(C('#8a7a62'), 1).fillEllipse(13, 3, 12, 3.4); // snapped top
	}),
	// into — that shape is unmistakably pileated.
	pileatedsnag: def(32, 48, (g) => {
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
	}),
	// little, and clearly second-hand.
	adoptednest: def(38, 34, (g) => {
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
	}),
	// one, high where the canopy closes over.
	canopylimb: def(42, 32, (g) => {
		g.fillStyle(C('#4a5f3c'), 1).fillEllipse(21, 6, 42, 14); // canopy closing overhead
		g.fillStyle(C('#3d5232'), 1).fillEllipse(12, 4, 22, 9).fillEllipse(31, 5, 20, 9);
		g.fillStyle(C('#5f5240'), 1).fillRect(3, 8, 9, 24); // the trunk
		g.fillStyle(C('#75664f'), 1).fillRect(9, 8, 3, 24);
		g.fillStyle(C('#6b5b45'), 1).fillRoundedRect(10, 16, 30, 8, 4); // a genuinely heavy limb
		g.fillStyle(C('#83725a'), 1).fillRoundedRect(10, 16, 28, 3, 1.5); // lit upper surface
		g.fillStyle(C('#4f4433'), 1).fillEllipse(13, 20, 7, 8); // where it joins the trunk
		g.fillStyle(C('#5d8a4a'), 0.8).fillEllipse(24, 16, 12, 3.4).fillEllipse(34, 17, 8, 3); // moss along the top
		g.lineStyle(1.6, C('#6b5b45'), 1).lineBetween(38, 20, 42, 14).lineBetween(38, 21, 42, 26); // it forks at the end
	}),
	// through with roots and pale fungal strands.
	deepduff: def(42, 26, (g) => {
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
	}),
	// Leaf Drey: a woven ball of leaves and twigs wedged tight into a high fork.
	leafdrey: def(34, 34, (g) => {
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
	}),
	// visible inside a rolled leaf — that is the whole reason it matters.
	cocoondrift: def(44, 26, (g) => {
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
	}),
	// leaves over soil, with frost showing at the surface.
	frozenleafbed: def(44, 22, (g) => {
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
	}),
	// tubers are on the roots, under the surface.
	trufflepatch: def(42, 26, (g) => {
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
	}),
	// reach from the ground, and the gap in the canopy above it.
	browsethicket: def(44, 30, (g) => {
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
	}),
	// larder at once.
	...pickable('grapetangle', 38, 40, (g, picked) => {
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
		if (picked) return; // the bunches have been cut off the vine
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
	}),
	// log — the fans, not the log, are the object.
	bracketfungus: def(40, 30, (g) => {
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
	}),
};

// Rushwater Wetland.

import { C, def, pickable } from '../canvas';
import type { SpriteSet } from '../canvas';

export const WETLAND: SpriteSet = {
	// cattail stand (playtest: the two read as the same plant).
	...pickable('reed', 36, 42, (g, picked) => {
		g.fillStyle(C('#6aa884'), 0.6).fillEllipse(18, 36, 34, 10);
		const cols = ['#7fa05a', '#8fb46a', '#6f9450'];
		for (let i = 0; i < 8; i++) {
			const x = 4 + i * 4;
			const top = 6 + (i % 3) * 5;
			if (picked) {
				// cut for reeds: a stubble of stems with pale ends, no plumes
				g.lineStyle(2, C(cols[i % 3]), 1).lineBetween(x, 38, x, top + 12);
				g.fillStyle(C('#d8dcc0'), 1).fillEllipse(x, top + 12, 2, 1.4);
				continue;
			}
			g.lineStyle(2, C(cols[i % 3]), 1).lineBetween(x, 38, x, top);
			// soft feathery green plume (not a hard brown head)
			g.fillStyle(C('#b7c98a'), 1).fillEllipse(x, top, 3, 6);
			g.fillStyle(C('#cdd99e'), 1).fillEllipse(x - 0.6, top - 1.5, 1.4, 3);
		}
	}),
	// couple of thin leaf blades behind — unmistakably different from the reed bed.
	...pickable('cattail', 34, 46, (g, picked) => {
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
			if (picked) {
				// the seed heads taken; bare stems standing with a cut tip
				g.lineStyle(2.4, C('#5f8a44'), 1).lineBetween(s.x, 42, s.x, s.top + 5);
				g.fillStyle(C('#c9b98a'), 1).fillEllipse(s.x, s.top + 5, 2.4, 1.6);
				return;
			}
			// upright green stem
			g.lineStyle(2.4, C('#5f8a44'), 1).lineBetween(s.x, 42, s.x, s.top + 11);
			// little tip spike above the head
			g.lineStyle(1.5, C('#5f8a44'), 1).lineBetween(s.x, s.top + 1, s.x, s.top - 5);
			// the brown "corn-dog" seed head
			g.fillStyle(C('#7a4a22'), 1).fillRoundedRect(s.x - 2.6, s.top, 5.2, 13, 2.6);
			g.fillStyle(C('#8f5a2c'), 1).fillRoundedRect(s.x - 1.2, s.top + 1.5, 2, 10, 1);
		});
	}),
	ducknest: def(26, 38, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(11, 22, 4, 16); // post
		g.fillStyle(C('#a3814f'), 1).fillRoundedRect(4, 8, 18, 16, 2); // box
		g.fillStyle(C('#6b5238'), 1).fillRect(3, 6, 20, 4); // roof lip
		g.fillStyle(C('#2e2018'), 1).fillCircle(13, 16, 3.6); // round hole
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(13, 24, 8, 3); // grass tuft
	}),
	baskinglog: def(42, 22, (g) => {
		g.fillStyle(C('#6f93b0'), 0.7).fillEllipse(21, 17, 40, 9); // water around
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 8, 34, 9, 4); // log
		g.fillStyle(C('#9a7448'), 1).fillEllipse(37, 12, 7, 9); // cut end
		g.fillStyle(C('#5d8a4a'), 0.9).fillEllipse(12, 8, 9, 4); // moss
	}),
	sedge: def(32, 34, (g) => {
		g.fillStyle(C('#7a9a4a'), 1).fillEllipse(16, 30, 24, 8);
		g.lineStyle(2, C('#8aa85a'), 1);
		for (const x of [8, 12, 16, 20, 24]) g.lineBetween(x, 30, x + (x - 16) * 0.3, 6 + Math.abs(x - 16));
		g.fillStyle(C('#b58a4a'), 1).fillCircle(16, 7, 2).fillCircle(11, 12, 1.6).fillCircle(21, 11, 1.6);
	}),
	...pickable('marshflower', 32, 26, (g, picked) => {
		g.fillStyle(C('#5a8a4a'), 1).fillEllipse(16, 20, 30, 12);
		const heads = [
			[10, 12],
			[18, 10],
			[24, 14],
			[14, 16],
		] as const;
		if (picked) {
			// picked: tight green buds low in the leaves
			g.fillStyle(C('#6f9a4a'), 1);
			for (const [x, y] of heads) g.fillCircle(x, y, 1.5);
			return;
		}
		g.fillStyle(C('#e3b93f'), 1);
		for (const [x, y] of heads) g.fillCircle(x, y, 3.4);
		g.fillStyle(C('#f4e08a'), 1).fillCircle(18, 10, 1.4).fillCircle(10, 12, 1.4);
	}),
	...pickable('bulrush', 28, 40, (g, picked) => {
		g.lineStyle(2.5, C('#5a8a4a'), 1);
		for (const x of [8, 14, 20]) g.lineBetween(x, 38, x, 6);
		if (picked) {
			// heads cut off for weaving, pale cut ends left on the stems
			g.fillStyle(C('#cfc9a8'), 1).fillRect(7.2, 14, 2.2, 2).fillRect(13.2, 11, 2.2, 2).fillRect(19.2, 15, 2.2, 2);
			return;
		}
		g.fillStyle(C('#7a5a3a'), 1)
			.fillRoundedRect(7, 8, 3, 12, 1.5)
			.fillRoundedRect(13, 5, 3, 12, 1.5)
			.fillRoundedRect(19, 9, 3, 12, 1.5);
	}),
	// --- additional biome trees (distinct silhouettes) ---
	cypress: def(34, 44, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(15, 34, 4, 10);
		g.fillStyle(C('#6a8a5a'), 1); // narrow feathery conical
		g.fillTriangle(6, 36, 28, 36, 17, 20).fillTriangle(8, 26, 26, 26, 17, 12).fillTriangle(10, 17, 24, 17, 17, 4);
	}),
	tupelo: def(34, 42, (g) => {
		g.fillStyle(C('#7a5a3a'), 1).fillRect(14, 28, 6, 14).fillEllipse(17, 40, 16, 6); // swollen base
		g.fillStyle(C('#5e8a6a'), 1).fillCircle(17, 16, 13).fillCircle(8, 22, 7).fillCircle(26, 22, 7);
	}),
	// Boardwalk — raised plank walkway over the marsh.
	boardwalk: def(40, 24, (g) => {
		g.fillStyle(C('#46708a'), 0.5).fillRect(0, 14, 40, 10); // water beneath
		g.fillStyle(C('#5a3f28'), 1).fillRect(4, 18, 2, 5).fillRect(20, 18, 2, 5).fillRect(34, 18, 2, 5); // posts
		g.fillStyle(C('#9a7448'), 1).fillRect(2, 10, 36, 6); // deck
		g.fillStyle(C('#7c5a3c'), 1);
		for (let x = 4; x < 38; x += 5) g.fillRect(x, 10, 1, 6); // plank seams
		g.fillStyle(C('#b8956a'), 1).fillRect(2, 10, 36, 1); // sunlit top edge
	}),
	// Heron Rookery — a tall snag with a stick nest for wading birds.
	heronrookery: def(30, 40, (g) => {
		g.fillStyle(C('#8a8270'), 1).fillRect(13, 10, 4, 28); // dead trunk
		g.fillStyle(C('#6f6857'), 1).fillRect(13, 10, 1.5, 28); // shadow side
		g.fillStyle(C('#7a6a4a'), 1).fillRect(6, 16, 8, 2).fillRect(16, 22, 8, 2); // bare branches
		g.fillStyle(C('#5a4a30'), 1).fillEllipse(15, 8, 20, 8); // stick nest
		g.fillStyle(C('#6e5a3a'), 1);
		for (let i = 0; i < 7; i++) g.fillRect(6 + i * 3, 6, 2, 1); // nest sticks
		g.fillStyle(C('#eae6da'), 1).fillCircle(12, 7, 1.4).fillCircle(17, 7, 1.4); // eggs
	}),
	// Dragonfly Pond — open water ringed with reeds, a dragonfly skimming.
	dragonflypond: def(36, 28, (g) => {
		g.fillStyle(C('#3f7d6a'), 1).fillEllipse(18, 18, 32, 16); // pond
		g.fillStyle(C('#5aa6cf'), 0.8).fillEllipse(18, 16, 24, 10); // open water
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 14, 8, 2); // glint
		g.lineStyle(2, C('#6da84e'), 1).lineBetween(5, 22, 4, 10).lineBetween(31, 22, 33, 9).lineBetween(9, 23, 8, 13); // reeds
		g.fillStyle(C('#3a5f2e'), 1).fillCircle(4, 9, 1.5).fillCircle(33, 8, 1.5); // reed heads
		g.fillStyle(C('#5b9cab'), 1).fillRect(19, 9, 6, 1.4); // dragonfly wings
		g.fillStyle(C('#2f6f6a'), 1).fillRect(21, 8, 2, 4); // dragonfly body
	}),
	// Lily Pool: pads packed edge to edge — the water barely shows.
	lilypool: def(42, 34, (g) => {
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
	}),
	// submerged weed read straight through the water.
	clearshallows: def(42, 28, (g) => {
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
	}),
	// sediment than water, and flat enough to read as a shoal rather than a pool.
	siltshoal: def(46, 24, (g) => {
		g.fillStyle(C('#7fa8b8'), 0.8).fillEllipse(23, 13, 46, 20); // slow water over it
		g.fillStyle(C('#b9ae90'), 1).fillEllipse(23, 14, 36, 14); // the shoal itself
		g.fillStyle(C('#cbc0a2'), 1).fillEllipse(20, 12, 24, 8); // sunlit crown, nearly breaking surface
		g.fillStyle(C('#a09678'), 0.8).fillEllipse(33, 16, 12, 5).fillEllipse(11, 16, 10, 4); // settled edges
		g.fillStyle(0xffffff, 0.3).fillEllipse(18, 10, 12, 2.4);
	}),
	// collar around a shrinking centre.
	vernalpool: def(40, 30, (g) => {
		g.fillStyle(C('#a89a7c'), 1).fillEllipse(20, 17, 40, 26); // dried outer ring
		g.lineStyle(1, C('#7f7258'), 1); // shrinkage cracks in the exposed collar
		g.lineBetween(4, 12, 10, 15).lineBetween(36, 14, 29, 16).lineBetween(20, 3, 20, 8).lineBetween(9, 26, 14, 22);
		g.fillStyle(C('#c2b596'), 1).fillEllipse(20, 17, 30, 18); // damp last-wet band
		g.fillStyle(C('#7fb2a8'), 1).fillEllipse(20, 17, 20, 11); // what water is left
		g.fillStyle(C('#9ccdc2'), 0.8).fillEllipse(18, 15, 12, 5);
		g.fillStyle(C('#5f8f86'), 1).fillCircle(24, 19, 1.6).fillCircle(21, 20, 1.3); // no fish — just egg mass
	}),
	// from one side. The overhang, not the water, is the sprite.
	overwaterthicket: def(44, 34, (g) => {
		g.fillStyle(C('#2f4a52'), 1).fillEllipse(22, 24, 44, 20); // deep still water
		g.fillStyle(C('#3d5f68'), 1).fillEllipse(22, 22, 34, 12);
		g.fillStyle(C('#4f7a45'), 1).fillEllipse(11, 10, 26, 16).fillEllipse(28, 8, 22, 14); // leaning canopy
		g.fillStyle(C('#3f6238'), 1).fillEllipse(15, 15, 24, 9); // shaded underside
		g.lineStyle(2, C('#6a5a3a'), 1).lineBetween(2, 4, 16, 14).lineBetween(4, 10, 20, 17); // branches out over water
		g.fillStyle(C('#5f9d50'), 1).fillEllipse(33, 14, 12, 6); // fringe hanging above the surface
		g.fillStyle(0x000000, 0.25).fillEllipse(20, 26, 26, 6); // shadow thrown on the water
	}),
	// apart from open marsh.
	beaverpond: def(48, 36, (g) => {
		g.fillStyle(C('#6a7a58'), 1).fillEllipse(24, 20, 48, 30); // wet surround
		g.fillStyle(C('#4f7d93'), 1).fillEllipse(24, 18, 40, 22); // deep permanent water
		g.fillStyle(C('#67a0b5'), 0.7).fillEllipse(20, 15, 22, 8);
		g.fillStyle(C('#8a8270'), 1).fillRect(14, 4, 3, 16).fillRect(30, 6, 2.6, 14); // drowned snags still standing
		g.fillStyle(C('#6f6857'), 1).fillRect(14, 4, 1.2, 16).fillRect(30, 6, 1, 14);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(4, 26, 40, 7, 3); // the dam
		g.lineStyle(1.4, C('#5d4128'), 1); // criss-crossed sticks in it
		g.lineBetween(7, 33, 14, 26).lineBetween(15, 33, 22, 26).lineBetween(23, 33, 30, 26).lineBetween(31, 33, 38, 26);
		g.fillStyle(C('#4a3826'), 1).fillEllipse(24, 33, 36, 4); // packed mud face
	}),
	// couple of stems drifting on it.
	stillcove: def(40, 32, (g) => {
		g.fillStyle(C('#5f7d45'), 1).fillEllipse(20, 16, 40, 30); // the reed bank hemming it in
		g.fillStyle(C('#6f9450'), 1).fillEllipse(20, 13, 38, 20);
		g.fillStyle(C('#93c0cf'), 1).fillEllipse(21, 21, 30, 18); // the pocket of open water
		g.fillStyle(C('#b6d8e2'), 1).fillEllipse(21, 19, 24, 11); // sky on it, unbroken
		g.fillStyle(0xffffff, 0.4).fillEllipse(17, 17, 14, 3); // glass-flat glint
		g.lineStyle(2, C('#7fa05a'), 1); // reeds standing round the back of it
		g.lineBetween(4, 20, 3, 6).lineBetween(9, 15, 8, 3).lineBetween(31, 15, 33, 4).lineBetween(36, 20, 37, 7);
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(3, 5, 2.2, 5).fillEllipse(33, 4, 2.2, 5); // a couple of old heads
		g.fillStyle(C('#8a9a5e'), 1).fillEllipse(17, 24, 9, 1.6).fillEllipse(25, 27, 7, 1.4); // stems drifting on it
	}),
	// Browsed Shallows: murky green, chest-deep, and thick with cropped-off stems.
	browsedshallows: def(42, 30, (g) => {
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
	}),
	// branch floating down it — nothing like an open pool.
	beavercanal: def(44, 28, (g) => {
		g.fillStyle(C('#6a7a52'), 1).fillEllipse(22, 14, 44, 26); // marsh ground
		g.fillStyle(C('#7f8f5e'), 1).fillEllipse(11, 8, 20, 11).fillEllipse(33, 20, 20, 11); // drier hummocks
		g.fillStyle(C('#4a5a3a'), 1).fillTriangle(6, 25, 14, 3, 22, 3).fillTriangle(6, 25, 22, 3, 15, 26); // cut banks
		g.fillStyle(C('#5f8fa0'), 1).fillTriangle(8, 24, 15, 4, 19, 4).fillTriangle(8, 24, 19, 4, 13, 25); // the channel
		g.fillStyle(C('#84b2c0'), 0.75).fillTriangle(10, 23, 16, 6, 18, 6).fillTriangle(10, 23, 18, 6, 13, 24);
		g.fillStyle(C('#7a5a3a'), 1).fillRoundedRect(11, 12, 9, 2.6, 1.3); // a branch floating down it
		g.fillStyle(C('#5d4128'), 1).fillCircle(11.5, 13.3, 1.5);
	}),
	// Mud Bank: a shaped, shovel-cut slope of bare damp earth going into water.
	mudbank: def(42, 28, (g) => {
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
	}),
	// a bank. Seedlings just breaking through.
	mudflat: def(44, 24, (g) => {
		g.fillStyle(C('#6f8f9a'), 1).fillEllipse(38, 12, 16, 22); // water pulled back to one side
		g.fillStyle(C('#8a6f4e'), 1).fillEllipse(20, 13, 40, 20); // exposed flat
		g.fillStyle(C('#a3855f'), 1).fillEllipse(19, 11, 32, 13); // sun-warmed crust
		g.lineStyle(0.9, C('#6b5540'), 1); // drying cracks
		g.lineBetween(6, 8, 13, 12).lineBetween(13, 12, 11, 19).lineBetween(13, 12, 22, 10);
		g.lineBetween(22, 10, 28, 15).lineBetween(22, 10, 24, 4).lineBetween(28, 15, 34, 13);
		g.fillStyle(0xffffff, 0.28).fillEllipse(16, 9, 14, 3); // wet shine
		g.lineStyle(1.2, C('#7fae5a'), 1); // cattail seedlings taking the light
		g.lineBetween(10, 17, 10, 11).lineBetween(18, 18, 18, 12).lineBetween(27, 18, 27, 13);
	}),
	// Wet Meadow Edge: half damp grass, half marsh — the sprite is the gradient.
	wetmeadow: def(44, 28, (g) => {
		g.fillStyle(C('#86a35a'), 1).fillEllipse(22, 14, 44, 26); // damp grassy band
		g.fillStyle(C('#9ab469'), 1).fillEllipse(13, 9, 26, 12); // drier upslope side
		g.fillStyle(C('#6f8f52'), 1).fillEllipse(23, 19, 38, 14); // greener, wetter downslope
		g.fillStyle(C('#5f8a7a'), 1).fillEllipse(30, 23, 26, 8); // marsh water creeping in
		g.fillStyle(C('#7fae9c'), 0.7).fillEllipse(32, 22, 18, 4);
		g.lineStyle(1.6, C('#7f9a4a'), 1); // grass thinning out as it gets wetter
		for (let i = 0; i < 8; i++) g.lineBetween(6 + i * 4.4, 20 - (i % 3), 5 + i * 4.4, 8 + (i % 4) * 3);
		g.fillStyle(C('#b9c98a'), 1);
		for (let i = 0; i < 4; i++) g.fillEllipse(7 + i * 8, 8 + (i % 2) * 3, 3, 1.5); // seed heads
	}),
	// clear dark gap beneath it — a ceiling, not a floor.
	spawningslab: def(40, 26, (g) => {
		g.fillStyle(C('#5f8a96'), 1).fillEllipse(20, 14, 40, 22); // water over everything
		g.fillStyle(C('#4a6b72'), 1).fillEllipse(20, 19, 34, 10); // dark silt below
		g.fillStyle(C('#2f4046'), 1).fillEllipse(20, 17, 26, 6); // the gap underneath
		g.fillStyle(C('#6e7d78'), 1).fillRoundedRect(5, 9, 30, 6, 2); // the slab
		g.fillStyle(C('#8b9a94'), 1).fillRoundedRect(5, 9, 30, 2.6, 1.2); // scrubbed-clean upper face
		g.fillStyle(C('#5b6a66'), 1).fillRect(7, 15, 3, 2).fillRect(30, 15, 3, 2); // props holding it clear
		g.fillStyle(0xffffff, 0.35).fillEllipse(14, 7, 12, 2.4); // surface just above it
	}),
	// Wild Celery Bed: long ribbon leaves streaming downcurrent underwater.
	celerybed: def(40, 30, (g) => {
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
	}),
	// the food is under the surface, so that is what shows.
	cattailroots: def(42, 28, (g) => {
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
	}),
	// vertical where the reed bed is broad.
	floodedreeds: def(30, 40, (g) => {
		g.fillStyle(C('#5f8a8a'), 1).fillEllipse(15, 34, 28, 10); // shallow standing water
		g.fillStyle(C('#87b0b0'), 0.7).fillEllipse(13, 33, 18, 4);
		g.lineStyle(2.4, C('#7f8f4e'), 1); // stiff stems, tight together
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 3.6, 35, 5 + i * 3.8, 4 + (i % 3) * 4);
		g.lineStyle(1.6, C('#98a85e'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(8 + i * 3.4, 34, 9 + i * 3.6, 6 + (i % 2) * 5);
		g.fillStyle(C('#8a6a3a'), 1); // a couple of old cattail heads
		g.fillEllipse(8, 7, 2.6, 6).fillEllipse(20, 5, 2.6, 6);
		g.fillStyle(C('#5f7a3a'), 1).fillEllipse(15, 34, 16, 3); // stems meeting the waterline
	}),
	// Marsh Log: one end up in the sun, the other lost under the surface.
	marshlog: def(44, 26, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(30, 16, 30, 18); // water it slides into
		g.fillStyle(C('#4a6b78'), 0.9).fillEllipse(34, 18, 20, 9);
		g.fillStyle(C('#6e553c'), 1).fillRoundedRect(2, 8, 34, 10, 5); // the trunk
		g.fillStyle(C('#8a6d4a'), 1).fillRoundedRect(2, 8, 30, 4, 2); // sunlit upper side
		g.fillStyle(C('#9a7a52'), 1).fillEllipse(4, 13, 7, 10); // raised cut end
		g.fillStyle(C('#5d4128'), 1).fillEllipse(4, 13, 3.5, 5.5);
		g.fillStyle(C('#3f5f4a'), 1).fillEllipse(16, 8, 12, 4); // moss along the top
		g.fillStyle(C('#4a6b78'), 0.55).fillRoundedRect(28, 12, 12, 7, 3); // submerged end going dark
		g.fillStyle(0xffffff, 0.25).fillEllipse(30, 12, 10, 1.6);
	}),
	// Litter Drift: a submerged raft of dead leaves furred over with decay.
	detritusdrift: def(42, 26, (g) => {
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
	}),
	// — anything coming at it has to wade.
	cranenest: def(42, 30, (g) => {
		g.fillStyle(C('#5f8a96'), 1).fillEllipse(21, 20, 42, 20); // open shallow water all round
		g.fillStyle(C('#82adb8'), 0.7).fillEllipse(18, 18, 26, 7);
		g.fillStyle(C('#6b6a42'), 1).fillEllipse(21, 18, 30, 14); // waterlogged base of the heap
		g.fillStyle(C('#8a8557'), 1).fillEllipse(21, 14, 28, 13); // the built mound
		g.fillStyle(C('#a3a06a'), 1).fillEllipse(21, 12, 22, 9); // dry top standing clear
		g.lineStyle(1.2, C('#6f6c44'), 1); // piled stems
		g.lineBetween(8, 15, 21, 10).lineBetween(34, 15, 21, 10).lineBetween(10, 11, 30, 13).lineBetween(12, 17, 32, 12);
		g.fillStyle(C('#c9bf9a'), 1).fillEllipse(21, 11, 12, 5); // the shallow cup
		g.fillStyle(C('#c2b28a'), 1).fillEllipse(19, 11, 4.5, 3.4).fillEllipse(24, 11.5, 4.5, 3.4); // two big eggs
	}),
	// the water, walled in on every side.
	reedplatform: def(36, 34, (g) => {
		g.fillStyle(C('#4a6b62'), 1).fillEllipse(18, 26, 36, 16); // dark water inside the stand
		g.fillStyle(C('#7a7a44'), 1).fillEllipse(18, 22, 24, 9); // woven platform
		g.fillStyle(C('#98974f'), 1).fillEllipse(18, 21, 20, 6);
		g.lineStyle(1.4, C('#8a8a4a'), 1); // the weave
		g.lineBetween(8, 21, 28, 22).lineBetween(8, 23, 28, 20).lineBetween(12, 18, 14, 25).lineBetween(22, 18, 20, 25);
		g.lineStyle(2.4, C('#6f8a3f'), 1); // the stand closing over it
		for (const x of [2, 5, 9, 27, 31, 34]) g.lineBetween(x, 32, x - 1 + (x % 3), 2 + (x % 4) * 3);
		g.lineStyle(1.8, C('#8aa050'), 1);
		for (const x of [7, 13, 24, 29]) g.lineBetween(x, 30, x + 1, 4 + (x % 3) * 4);
	}),
	// capped with the little turret of pellets they push out.
	crayfishbank: def(40, 28, (g) => {
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
	}),
	// row of tunnel mouths along it.
	cutbank: def(40, 30, (g) => {
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
	}),
	// sprite cuts away to show both.
	muskratden: def(42, 30, (g) => {
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
	}),
	// water beside the underwater door.
	otterden: def(44, 30, (g) => {
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
	}),
	// above the waterline.
	sandnestbank: def(42, 26, (g) => {
		g.fillStyle(C('#6f9aa8'), 1).fillEllipse(21, 23, 42, 8); // water below it
		g.fillStyle(C('#c2ad7e'), 1).fillEllipse(21, 14, 40, 18); // the rise
		g.fillStyle(C('#d8c69a'), 1).fillEllipse(20, 10, 32, 11); // dry sunlit crown
		g.fillStyle(C('#a89474'), 1); // fine gravel through it
		for (let i = 0; i < 16; i++) g.fillCircle(5 + ((i * 9) % 32), 10 + ((i * 5) % 10), 1.1);
		g.fillStyle(C('#e8dcc0'), 1);
		for (let i = 0; i < 10; i++) g.fillCircle(7 + ((i * 7) % 28), 8 + ((i * 3) % 7), 0.8);
		g.fillStyle(C('#b0996f'), 1).fillEllipse(21, 20, 34, 4); // where it drops to the water
		g.fillStyle(0xffffff, 0.25).fillEllipse(16, 7, 14, 2.4);
	}),
	// bathtub in it. Scale is the point, so the tree is tall and the nest huge.
	eaglecrown: def(40, 48, (g) => {
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
	}),
	// and banked, beside the marsh rather than in it.
	winterlitter: def(42, 30, (g) => {
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
	}),
};

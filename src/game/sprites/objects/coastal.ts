// Pelican Shore.

import { C, def, lightable, pickable } from '../canvas';
import type { SpriteSet } from '../canvas';

export const COASTAL: SpriteSet = {
	tidepool: def(46, 34, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(23, 18, 46, 30);
		g.fillStyle(C('#5d96c8'), 1).fillEllipse(23, 18, 34, 20);
		g.fillStyle(C('#e8954f'), 1).fillCircle(17, 20, 3); // little sea star
		g.fillStyle(0xffffff, 0.4).fillEllipse(20, 14, 10, 4);
	}),
	dunegrass: def(36, 34, (g) => {
		g.fillStyle(C('#dcc890'), 1).fillEllipse(18, 28, 34, 10);
		g.lineStyle(2, C('#bdb670'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 5, 30, 3 + i * 5.5, 8 + (i % 3) * 3);
	}),
	driftwood: def(42, 26, (g) => {
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(2, 12, 38, 9, 4);
		g.fillStyle(C('#c4b6a0'), 1).fillRoundedRect(8, 4, 26, 7, 3);
	}),
	kelp: def(36, 30, (g) => {
		g.fillStyle(C('#6a7a3a'), 1);
		g.fillEllipse(8, 18, 10, 22).fillEllipse(18, 20, 10, 18).fillEllipse(28, 17, 10, 22);
		g.fillStyle(C('#8a9a4e'), 1).fillCircle(12, 10, 2.4).fillCircle(24, 12, 2.4);
	}),
	...lightable('seaglasslantern', 22, 44, (g, lit) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(9, 30, 4, 12); // driftwood post
		g.fillStyle(C('#b0a088'), 1).fillRoundedRect(4, 8, 14, 22, 3); // weathered frame
		// Four panes of beach glass. Lit from behind they are sea-bright; unlit
		// they are the same four pieces of glass in shadow.
		const pane = (x: number, y: number, on: string, off: string) =>
			g.fillStyle(C(lit ? on : off), 1).fillRoundedRect(x, y, 5, 7, 1);
		pane(6, 11, '#8fc6c2', '#5f7f7d');
		pane(11, 11, '#a9d8d0', '#6f8c88');
		pane(6, 19, '#bcd8e6', '#7a8c96');
		pane(11, 19, '#9fd0cc', '#688884');
		if (lit) g.fillStyle(0xffffff, 0.55).fillCircle(8, 13, 1.2);
		g.fillStyle(C('#9a7448'), 1).fillRoundedRect(3, 4, 16, 5, 2); // cap
	}),
	tidechime: def(28, 40, (g) => {
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
	}),
	pearldisplay: def(30, 28, (g) => {
		g.fillStyle(C('#7c5a3c'), 1).fillRect(7, 22, 5, 6).fillRect(18, 22, 5, 6); // little stand legs
		g.fillStyle(C('#c8b8a8'), 1).fillEllipse(15, 18, 26, 14); // big shell cradle
		g.lineStyle(1.4, C('#a89a88'), 1);
		g.lineBetween(15, 7, 5, 19).lineBetween(15, 7, 15, 20).lineBetween(15, 7, 25, 19);
		g.fillStyle(C('#f2ece0'), 1).fillCircle(11, 17, 3).fillCircle(19, 17, 3).fillCircle(15, 14, 3.4); // pearls
		g.fillStyle(0xffffff, 0.85).fillCircle(10, 15, 1.1).fillCircle(18, 15, 1.1).fillCircle(14, 12, 1.2);
	}),
	driftpile: def(40, 24, (g) => {
		const cols = ['#c8b89a', '#b8a888', '#d8cab0'];
		const logs: [number, number, number, number, number][] = [
			[4, 16, 30, 6, 0],
			[8, 11, 26, 5, 1],
			[6, 7, 22, 4, 2],
		];
		logs.forEach(([x, y, w, h, c]) => g.fillStyle(C(cols[c]), 1).fillRoundedRect(x, y, w, h, 3));
		g.fillStyle(C('#9a8a6a'), 1).fillCircle(34, 16, 3).fillCircle(34, 11, 2.5);
	}),
	bluff: def(40, 28, (g) => {
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
	}),
	seagrass: def(34, 30, (g) => {
		g.fillStyle(C('#cdbf94'), 1).fillEllipse(17, 26, 32, 8); // sand
		g.lineStyle(2.5, C('#5a9a6a'), 1);
		for (const x of [7, 12, 17, 22, 27]) {
			const sway = Math.sin(x) * 4;
			g.lineBetween(x, 26, x + sway, 4);
		}
		g.fillStyle(C('#7fb88a'), 0.6).fillEllipse(17, 12, 22, 14);
	}),
	oyster: def(34, 24, (g) => {
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
	}),
	...pickable('thrift', 32, 26, (g, picked) => {
		g.fillStyle(C('#7a9a6a'), 1).fillEllipse(16, 21, 28, 9);
		g.lineStyle(1.5, C('#5a8a4a'), 1);
		for (const x of [9, 16, 23]) g.lineBetween(x, 21, x, 9);
		if (picked) {
			// the pink heads picked off their wiry stalks
			g.fillStyle(C('#6f8a4a'), 1).fillCircle(9, 8.6, 1.4).fillCircle(16, 7.6, 1.5).fillCircle(23, 9.4, 1.3);
			return;
		}
		g.fillStyle(C('#e57aa8'), 1).fillCircle(9, 8, 3.2).fillCircle(16, 7, 3.4).fillCircle(23, 9, 3);
	}),
	coastalshrub: def(34, 28, (g) => {
		g.fillStyle(C('#7d8f6a'), 1).fillCircle(12, 18, 9).fillCircle(23, 16, 10).fillCircle(18, 12, 8);
		g.fillStyle(C('#9aa882'), 1).fillCircle(14, 14, 2.4).fillCircle(22, 13, 2.4).fillCircle(19, 18, 2.4);
	}),
	shorepine: def(34, 40, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 24, 4, 16); // trunk
		g.fillStyle(C('#3f6e4a'), 1); // wind-bent canopy leaning left
		g.fillTriangle(4, 24, 26, 20, 14, 8).fillTriangle(7, 17, 25, 14, 16, 4);
		g.fillStyle(C('#4f8a5a'), 1).fillTriangle(10, 12, 24, 10, 18, 2);
	}),
	mcypress: def(36, 38, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 24, 4, 14);
		g.fillStyle(C('#4f7050'), 1).fillEllipse(19, 14, 34, 16); // flat wind-swept top
		g.fillStyle(C('#5e8a5e'), 1).fillEllipse(24, 11, 18, 9);
	}),
	liveoak: def(38, 38, (g) => {
		g.fillStyle(C('#6b5238'), 1).fillRect(16, 22, 6, 16);
		g.fillStyle(C('#4a6b40'), 1).fillEllipse(19, 14, 36, 20).fillCircle(8, 20, 7).fillCircle(30, 20, 7); // broad rounded
		g.fillStyle(C('#5e8a4a'), 0.7).fillCircle(13, 10, 5).fillCircle(25, 11, 5);
	}),
	// the rim from the rocks above.
	surgepool: def(42, 34, (g) => {
		g.fillStyle(C('#6b7076'), 1).fillEllipse(21, 18, 42, 30); // rock bowl
		g.fillStyle(C('#2e8f7d'), 1).fillEllipse(21, 19, 32, 21); // deep sunlit pool
		g.fillStyle(C('#1d5f56'), 1).fillEllipse(23, 22, 20, 11); // the deep middle
		g.fillStyle(C('#4fc0a4'), 0.8).fillEllipse(16, 14, 16, 7); // full sun reaching in
		g.fillStyle(0xffffff, 0.85).fillEllipse(30, 8, 16, 6); // surge spilling over the rim
		g.fillStyle(0xffffff, 0.6).fillEllipse(27, 12, 11, 4).fillCircle(34, 12, 1.6).fillCircle(24, 10, 1.3);
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(5, 10, 10, 8).fillEllipse(38, 24, 9, 8); // rim boulders
	}),
	// through dark blue.
	upwelling: def(36, 40, (g) => {
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
	}),
	// Nearshore Spawning Shallows: barely moving, warm on top, thick with drift.
	spawnshallows: def(44, 26, (g) => {
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
	}),
	// thin lace of foam at its edge.
	swashrunnel: def(44, 26, (g) => {
		g.fillStyle(C('#dfd0a8'), 1).fillEllipse(22, 13, 44, 24); // sand
		g.fillStyle(C('#c2ae82'), 1).fillEllipse(11, 5, 20, 6); // dry sand above the reach
		g.fillStyle(C('#a9c4cf'), 1).fillTriangle(1, 11, 43, 5, 43, 19).fillTriangle(1, 11, 43, 19, 1, 23); // wet sliding strip
		g.fillStyle(C('#c2d8e0'), 1).fillTriangle(1, 13, 43, 7, 43, 12).fillTriangle(1, 13, 43, 12, 1, 18); // sheeting water
		g.fillStyle(0xffffff, 0.85); // foam lace along the leading edge
		for (let i = 0; i < 8; i++) g.fillCircle(4 + i * 5, 12 - i * 0.65, 1.6 + (i % 2) * 0.7);
		g.fillStyle(0xffffff, 0.4).fillEllipse(22, 10, 28, 2);
		g.fillStyle(C('#8fa8b2'), 0.8).fillEllipse(29, 20, 17, 4); // draining back
	}),
	// with real vertical motion in it.
	surfline: def(46, 30, (g) => {
		g.fillStyle(C('#2f7f8c'), 1).fillEllipse(23, 19, 46, 22); // open water
		g.fillStyle(C('#1f5f6b'), 1).fillEllipse(23, 24, 40, 10); // trough
		g.fillStyle(C('#3f9aa8'), 1).fillTriangle(4, 24, 26, 4, 33, 24); // the wave standing up
		g.fillStyle(C('#5fbcc4'), 1).fillTriangle(11, 24, 26, 7, 30, 24); // lit face
		g.fillStyle(0xffffff, 0.9).fillEllipse(27, 6, 14, 6); // the lip curling over
		g.fillStyle(0xffffff, 0.75).fillEllipse(33, 12, 12, 7).fillEllipse(37, 18, 10, 6); // white water tumbling down
		g.fillStyle(0xffffff, 0.5).fillEllipse(39, 23, 11, 5);
		g.fillStyle(0xffffff, 0.35).fillCircle(31, 4, 1.6).fillCircle(36, 8, 1.3).fillCircle(24, 3, 1.2); // spray
	}),
	// in the drop-off line.
	deepedge: def(44, 32, (g) => {
		g.fillStyle(C('#12384f'), 1).fillEllipse(22, 16, 44, 32); // the deep
		g.fillStyle(C('#08202f'), 1).fillEllipse(29, 22, 30, 20); // colder, blacker below
		g.fillStyle(C('#4a8fa8'), 1).fillTriangle(2, 7, 21, 7, 4, 25); // sunlit shelf
		g.fillStyle(C('#6fb0c2'), 1).fillTriangle(3, 7, 17, 7, 4, 18);
		g.fillStyle(C('#7f8f80'), 1).fillTriangle(1, 5, 22, 9, 2, 13); // rock lip of the shelf
		g.fillStyle(C('#5f6f62'), 1).fillTriangle(15, 9, 22, 9, 17, 19); // the wall falling away
		g.fillStyle(0x000000, 0.35).fillTriangle(17, 11, 24, 11, 21, 29); // shadow down the face
		g.fillStyle(C('#8fd0e0'), 0.35).fillEllipse(9, 4, 14, 3); // light, only up top
	}),
	// the surface and a point of rock holding the swell off.
	raftingcove: def(44, 30, (g) => {
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
	}),
	// Sandbar Roost: flat, dry, and ringed with water on every side.
	sandbar: def(44, 24, (g) => {
		g.fillStyle(C('#6f9aa8'), 1).fillEllipse(22, 12, 44, 22); // water all round it
		g.fillStyle(C('#8ab4c0'), 0.6).fillEllipse(11, 5, 20, 4).fillEllipse(33, 19, 18, 4);
		g.fillStyle(C('#b5a882'), 1).fillEllipse(22, 12, 36, 12); // wet fringe of the bar
		g.fillStyle(C('#ccbf9d'), 1).fillEllipse(22, 11, 29, 9); // dry flat top
		g.fillStyle(C('#ddd2b2'), 1).fillEllipse(20, 10, 20, 5); // bleached crown
		g.lineStyle(1, C('#b8ab88'), 1).strokeEllipse(22, 12, 33, 10.5); // the tide line around it
		g.fillStyle(C('#a89a76'), 1).fillCircle(14, 12, 1.2).fillCircle(28, 11, 1.1).fillCircle(21, 13, 1); // shell grit
	}),
	// Offshore Nesting Island: a stack standing in deep water, no way up from below.
	offshoreislet: def(34, 40, (g) => {
		g.fillStyle(C('#3b7ea1'), 1).fillEllipse(17, 33, 34, 14); // deep water round it
		g.fillStyle(C('#2f6480'), 1).fillEllipse(17, 36, 32, 10);
		g.fillStyle(C('#9b9384'), 1).fillTriangle(4, 32, 17, 4, 30, 32); // the stack
		g.fillStyle(C('#b0a898'), 1).fillTriangle(10, 32, 17, 5, 20, 32); // lit face
		g.fillStyle(C('#6f6a60'), 1).fillTriangle(20, 32, 17, 6, 30, 32); // shadowed face
		g.fillStyle(C('#8a8478'), 1).fillRect(6, 30, 22, 3); // sheer waterline base
		g.fillStyle(0xffffff, 0.75).fillEllipse(17, 7, 12, 3.4); // guano cap on top
		g.fillStyle(0xffffff, 0.4).fillEllipse(12, 14, 6, 2).fillEllipse(23, 18, 5, 1.8); // streaks down the face
		g.fillStyle(0xffffff, 0.55).fillEllipse(6, 31, 9, 3).fillEllipse(28, 31, 8, 3); // wash at the base
	}),
	// it and weed fringing the edge.
	lowtidebench: def(46, 24, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(23, 19, 46, 10); // water waiting to come back
		g.fillStyle(C('#6d7a80'), 1).fillRoundedRect(1, 4, 44, 14, 2); // bedrock bench
		g.fillStyle(C('#87939a'), 1).fillRoundedRect(1, 4, 44, 5, 2); // exposed dry-ish top
		g.fillStyle(C('#9aa8ae'), 0.6).fillEllipse(16, 8, 24, 4); // film of water still standing
		g.fillStyle(C('#4a5f3a'), 1); // weed fringe along the seaward lip
		for (let i = 0; i < 8; i++) g.fillEllipse(3 + i * 6, 17, 7, 3.4);
		g.fillStyle(C('#6a7a3a'), 1);
		for (let i = 0; i < 7; i++) g.fillEllipse(6 + i * 6, 18, 5, 2.4);
		g.fillStyle(C('#4f6b74'), 1).fillEllipse(30, 11, 9, 4).fillEllipse(11, 12, 7, 3); // little pools left on it
	}),
	// Urchin Pit: smooth ground-out bowls in solid rock, one occupied.
	urchinpit: def(38, 26, (g) => {
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
	}),
	// welded across the upper rock.
	barnaclerock: def(38, 26, (g) => {
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
	}),
	// rock, and only a fleck or two of spray.
	splashcrevice: def(36, 30, (g) => {
		g.fillStyle(C('#7d7367'), 1).fillRoundedRect(1, 1, 34, 28, 2); // dry upper rock
		g.fillStyle(C('#948a7c'), 1).fillRoundedRect(1, 1, 34, 9, 2); // sun-bleached top
		g.fillStyle(C('#a89e8e'), 0.6).fillEllipse(14, 5, 20, 4);
		g.lineStyle(2.6, C('#3a352c'), 1); // the cracks
		g.lineBetween(8, 4, 11, 27).lineBetween(20, 2, 17, 28).lineBetween(28, 6, 31, 26);
		g.lineStyle(1.2, C('#57503f'), 1).lineBetween(11, 14, 17, 16).lineBetween(17, 20, 28, 18);
		g.fillStyle(C('#c9c2b0'), 1).fillEllipse(24, 12, 6, 3).fillEllipse(5, 20, 5, 2.4); // salt crust
		g.fillStyle(0xffffff, 0.55).fillCircle(30, 3, 1.4).fillCircle(13, 2, 1.1).fillCircle(23, 6, 0.9); // the only water it gets
	}),
	// with what has already been broken on it.
	shellrock: def(40, 28, (g) => {
		g.fillStyle(C('#d8c9a4'), 1).fillEllipse(20, 23, 40, 10); // sand around it
		g.fillStyle(C('#9a958c'), 1).fillRoundedRect(5, 8, 30, 15, 3); // the boulder
		g.fillStyle(C('#b0aba0'), 1).fillRoundedRect(5, 8, 30, 6, 3); // hard flat top
		g.fillStyle(C('#7f7a72'), 1).fillEllipse(20, 23, 30, 4); // shadowed base
		g.fillStyle(C('#efe6d2'), 1); // cracked shells on the anvil
		g.fillEllipse(12, 10, 7, 3.4).fillEllipse(24, 9, 6, 3).fillEllipse(30, 12, 5, 2.6);
		g.lineStyle(0.9, C('#b5a88e'), 1).lineBetween(9, 10, 15, 10).lineBetween(22, 9, 27, 9);
		g.fillStyle(C('#e2d6bc'), 1).fillEllipse(6, 24, 5, 2.4).fillEllipse(34, 25, 4.5, 2.2); // fragments fallen off
	}),
	// High-Tide Roost: raised, dry at the top of the tide, water all the way round.
	roostrock: def(36, 30, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(18, 21, 36, 18); // high water on every side
		g.fillStyle(C('#7fa8b8'), 0.6).fillEllipse(8, 18, 16, 4).fillEllipse(28, 26, 16, 4);
		g.fillStyle(C('#8d8a84'), 1).fillEllipse(18, 15, 26, 20); // the rock
		g.fillStyle(C('#a09d96'), 1).fillEllipse(16, 10, 20, 11); // dry crown standing clear
		g.fillStyle(C('#6f6d68'), 1).fillEllipse(24, 18, 14, 9); // shadow side
		g.fillStyle(0xffffff, 0.7).fillEllipse(16, 7, 15, 4); // whitewash where they stand
		g.fillStyle(0xffffff, 0.4).fillEllipse(11, 12, 5, 2).fillEllipse(22, 13, 4, 1.8);
		g.fillStyle(0xffffff, 0.5).fillEllipse(18, 25, 26, 3); // wash line around the base
	}),
	// and a wide quiet buffer marked around them.
	haulout: def(46, 28, (g) => {
		g.fillStyle(C('#5f8494'), 1).fillEllipse(23, 20, 46, 16); // water
		g.lineStyle(1, 0xffffff, 0.3).strokeEllipse(23, 16, 44, 22); // the buffer, kept quiet
		g.fillStyle(C('#c2b48e'), 1).fillEllipse(34, 17, 24, 9); // sand spit
		g.fillStyle(C('#767f86'), 1).fillEllipse(12, 15, 22, 12).fillEllipse(25, 16, 18, 10); // low rocks
		g.fillStyle(C('#8b939a'), 1).fillEllipse(11, 12, 17, 7).fillEllipse(25, 13, 13, 6); // dry sloping backs
		g.fillStyle(C('#5f676d'), 1).fillEllipse(16, 19, 20, 5); // wet lower slope, easy to climb
		g.fillStyle(0xffffff, 0.3).fillEllipse(20, 21, 26, 2.4); // waterline
		g.fillStyle(C('#a3a8ad'), 0.8).fillEllipse(7, 11, 8, 3); // worn smooth on top
	}),
	// streaks are the identifying detail.
	surgeface: def(36, 34, (g) => {
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
	}),
	// animal than mud.
	amphipodbed: def(42, 26, (g) => {
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
	}),
	// Rippled Sand: even combed ridges, and nothing else — the pattern is the object.
	rippledsand: def(44, 24, (g) => {
		g.fillStyle(C('#8fbccf'), 0.5).fillEllipse(22, 12, 44, 24); // clean water over it
		g.fillStyle(C('#d8c9a4'), 1).fillEllipse(22, 13, 42, 20); // sand
		g.fillStyle(C('#c2b28a'), 1); // the troughs
		for (let i = 0; i < 6; i++) g.fillEllipse(22, 6 + i * 3.2, 40 - Math.abs(i - 2.5) * 4, 1.8);
		g.fillStyle(C('#eadfbe'), 1); // the sunlit crests
		for (let i = 0; i < 6; i++) g.fillEllipse(22, 4.9 + i * 3.2, 38 - Math.abs(i - 2.5) * 4, 1.1);
		g.fillStyle(0xffffff, 0.22).fillEllipse(15, 8, 20, 3); // light banding across them
	}),
	// settling into the gaps.
	rubbleflat: def(42, 26, (g) => {
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
	}),
	// undisturbed — a diggable flat rather than a rubble one.
	gravelflat: def(44, 24, (g) => {
		g.fillStyle(C('#6f9aab'), 0.7).fillEllipse(22, 6, 42, 11); // calm water in the lee
		g.fillStyle(C('#b5ac8e'), 1).fillEllipse(22, 14, 44, 19); // the flat
		g.fillStyle(C('#c4bc9e'), 1).fillEllipse(21, 11, 34, 8); // firm sunlit surface
		g.fillStyle(C('#9a927a'), 1); // mixed gravel worked evenly through it
		for (let i = 0; i < 20; i++) g.fillCircle(6 + ((i * 7) % 33), 9 + ((i * 5) % 12), 1.1 + (i % 3) * 0.4);
		g.fillStyle(C('#d2cbb0'), 1);
		for (let i = 0; i < 13; i++) g.fillCircle(8 + ((i * 11) % 30), 12 + ((i * 3) % 9), 0.9);
		g.fillStyle(C('#8f8770'), 0.7).fillEllipse(22, 20, 32, 4); // settled, going nowhere
	}),
	// over to show it.
	cobblefield: def(42, 26, (g) => {
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
	}),
	// Empty Shell Drift: wave-sorted, heaped up by size in a rock hollow.
	shelldrift: def(40, 26, (g) => {
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
	}),
	// Mussel Bed: a dense blue-black band, shells packed upright two and three deep.
	musselbed: def(40, 26, (g) => {
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
	}),
	// it — the anchor, not the forest.
	holdfastreef: def(42, 26, (g) => {
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
	}),
	// canopy lying on the surface.
	kelpforest: def(40, 46, (g) => {
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
	}),
	// to hide the rock.
	surfgrass: def(42, 28, (g) => {
		g.fillStyle(C('#4f7f8f'), 0.8).fillEllipse(21, 14, 42, 26); // moving water
		g.fillStyle(C('#6b7168'), 1).fillEllipse(21, 24, 36, 8); // low-zone rock beneath
		g.lineStyle(2.2, C('#3d7a52'), 1); // blades streaming one way
		for (let i = 0; i < 8; i++) g.lineBetween(4 + i * 4.4, 24, 15 + i * 3, 9 + (i % 3) * 3);
		g.lineStyle(1.6, C('#55a06a'), 1);
		for (let i = 0; i < 7; i++) g.lineBetween(6 + i * 4.6, 25, 18 + i * 2.6, 6 + (i % 4) * 4);
		g.lineStyle(1.2, C('#7fbf8a'), 0.9);
		for (let i = 0; i < 5; i++) g.lineBetween(8 + i * 5.2, 24, 20 + i * 2.8, 11 + (i % 2) * 5);
		g.fillStyle(C('#2f6b45'), 1).fillEllipse(21, 25, 30, 4); // dense root band
	}),
	// surfgrass, and the crop is what makes it habitat.
	eelgrasslawn: def(42, 24, (g) => {
		g.fillStyle(C('#6fa8b8'), 0.75).fillEllipse(21, 12, 42, 22); // clear shallow water
		g.fillStyle(C('#9a9078'), 1).fillEllipse(21, 19, 38, 8); // sandy bottom
		g.fillStyle(C('#7fae6d'), 1).fillRoundedRect(4, 9, 34, 10, 3); // the cropped lawn
		g.lineStyle(1.6, C('#6f9d5d'), 1); // short, even, tender blades
		for (let i = 0; i < 12; i++) g.lineBetween(6 + i * 2.8, 19, 6 + i * 2.8, 9 + (i % 3));
		g.fillStyle(C('#a8cf92'), 1);
		for (let i = 0; i < 12; i++) g.fillEllipse(6 + i * 2.8, 9 + (i % 3), 1.8, 1.2); // blunt cropped tips
		g.fillStyle(C('#5f8a4a'), 1).fillEllipse(21, 19, 32, 3); // even root line
		g.fillStyle(0xffffff, 0.2).fillEllipse(16, 5, 20, 3);
	}),
	// Coralline Turf: pink branching crust — nothing else on the shore is this colour.
	corallineturf: def(38, 24, (g) => {
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
	}),
	// it, and a tidy midden of emptied shells outside.
	octopusmidden: def(42, 28, (g) => {
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
	}),
	// worn to bare earth and the drop just beyond.
	clifftopburrow: def(40, 28, (g) => {
		g.fillStyle(C('#6f7a52'), 1).fillEllipse(20, 14, 40, 22); // deep sea-cliff turf
		g.fillStyle(C('#83904f'), 1).fillEllipse(19, 9, 34, 13);
		g.lineStyle(1.4, C('#5f6b3a'), 0.9);
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 4.2, 12, 2 + i * 4.4, 5 + (i % 3) * 3); // turf blades
		g.fillStyle(C('#9a8a68'), 1).fillEllipse(20, 18, 17, 9); // worn bare patch at the mouth
		g.fillStyle(C('#241c14'), 1).fillCircle(20, 17, 5.5); // the round hole
		g.fillStyle(C('#3f3a28'), 1).fillEllipse(20, 20, 10, 2.4);
		g.fillStyle(C('#8fb0c0'), 1).fillEllipse(20, 27, 40, 5); // the drop, just beyond
	}),
	// nothing on it but faint wind ripples.
	sandbeach: def(46, 22, (g) => {
		g.fillStyle(C('#e2d3ac'), 1).fillEllipse(23, 12, 46, 18); // wide open sand
		g.fillStyle(C('#eee2c0'), 1).fillEllipse(22, 9, 38, 10); // sun-bleached crown
		g.fillStyle(C('#d4c49c'), 0.8); // faint wind ripples, nothing more
		for (let i = 0; i < 4; i++) g.fillEllipse(23, 9 + i * 3.4, 40 - i * 5, 1.2);
		g.fillStyle(C('#c9b892'), 1).fillEllipse(9, 17, 8, 2).fillEllipse(35, 18, 7, 2); // faint shadowed troughs
		g.fillStyle(C('#f4ead0'), 1).fillCircle(14, 7, 1).fillCircle(31, 6, 0.9).fillCircle(24, 5, 0.8); // grains catching light
	}),
	// known for and pale berries held into winter.
	dunemanzanita: def(40, 28, (g) => {
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
	}),
	// there is no visible floor at all.
	dunewillow: def(44, 28, (g) => {
		g.fillStyle(C('#ded0a8'), 1).fillEllipse(22, 24, 42, 8); // dune sand behind it
		g.fillStyle(C('#4f6b3f'), 1).fillEllipse(22, 17, 44, 20); // the mass of it
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(13, 12, 22, 14).fillEllipse(31, 11, 20, 13); // sunlit crowns
		g.fillStyle(C('#809a68'), 1).fillEllipse(12, 8, 15, 8).fillEllipse(31, 7, 13, 7);
		g.lineStyle(1.4, C('#5f5540'), 1); // bramble and willow tangled to ground level
		g.lineBetween(4, 24, 16, 8).lineBetween(14, 25, 8, 9).lineBetween(24, 25, 34, 9);
		g.lineBetween(36, 24, 28, 8).lineBetween(6, 18, 38, 16).lineBetween(8, 22, 36, 21);
		g.fillStyle(C('#3f5533'), 1).fillEllipse(22, 22, 38, 7); // no way in at the bottom
		g.fillStyle(C('#7a3a52'), 1).fillCircle(10, 14, 1.4).fillCircle(29, 13, 1.3).fillCircle(20, 10, 1.2); // bramble fruit
	}),
	// line across a broad stretch of quiet upper beach.
	beachclosure: def(46, 26, (g) => {
		g.fillStyle(C('#d8c8a0'), 1).fillEllipse(23, 16, 46, 18); // quiet upper beach
		g.fillStyle(C('#e6d8b4'), 1).fillEllipse(22, 13, 38, 11);
		g.fillStyle(C('#9a8560'), 1); // posts
		for (const x of [4, 15, 27, 39]) g.fillRect(x, 6, 2, 13);
		g.lineStyle(1, C('#f2ece0'), 1).lineBetween(4, 9, 41, 8).lineBetween(4, 13, 41, 12); // the line between them
		g.fillStyle(C('#e8e2d4'), 1).fillRoundedRect(18, 4, 9, 6, 1); // a sign
		g.fillStyle(C('#7a8f9a'), 1).fillRect(19.5, 5.5, 6, 1).fillRect(19.5, 7.5, 4, 1);
		g.fillStyle(C('#c2ad86'), 1).fillCircle(9, 21, 1.3).fillCircle(31, 22, 1.2).fillCircle(20, 22, 1.1); // undisturbed sand
	}),
	// single shallow scrape inside the fence and nothing built.
	ploverscrape: def(42, 26, (g) => {
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
	}),
	// scruffier than the forest platforms.
	shorenest: def(38, 32, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillRect(16, 16, 5, 16); // fork
		g.lineStyle(2.6, C('#7a6a52'), 1).lineBetween(18, 19, 8, 12).lineBetween(18, 19, 29, 12);
		g.fillStyle(C('#8f8470'), 1).fillEllipse(19, 13, 32, 13); // the bulky platform
		g.fillStyle(C('#a8a08c'), 1).fillEllipse(19, 11, 27, 9); // salt-bleached upper sticks
		g.lineStyle(1.3, C('#c2bca8'), 1); // pale, weathered, added to every year
		g.lineBetween(4, 13, 34, 12).lineBetween(5, 16, 33, 15).lineBetween(10, 7, 13, 19).lineBetween(28, 7, 25, 19);
		g.lineStyle(1.2, C('#7a6a4e'), 1).lineBetween(7, 10, 30, 17); // this season's patch, still brown
		g.fillStyle(C('#6f6857'), 1).fillEllipse(19, 10, 15, 5); // the cup
		g.fillStyle(C('#e8e2d4'), 1).fillEllipse(19, 10, 5, 4);
	}),
};

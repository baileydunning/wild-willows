// Willow Meadow: the opening biome's plants, water and structures.

import { C, def, pickable } from '../canvas';
import type { SpriteSet } from '../canvas';

export const MEADOW: SpriteSet = {
	/**
	 * The overlook bench: a live-edge slab laid across two log rounds, out at the
	 * far edge of the meadow. Deliberately nothing like the Wooden Bench it used
	 * to share a sprite with — no plank legs, no slat back, and a blanket left
	 * folded on it from the last person who sat an hour before dusk.
	 */
	overlookbench: def(44, 36, (g) => {
		g.fillStyle(C('#6f9a4a'), 1).fillEllipse(22, 31, 40, 9); // the grass it stands in
		g.lineStyle(1.2, C('#d9c25f'), 1); // a few stems gone gold
		g.lineBetween(5, 31, 3, 24).lineBetween(39, 31, 41, 25).lineBetween(36, 32, 37, 26);
		const logRound = (x: number) => {
			g.fillStyle(C('#7a5a34'), 1).fillCircle(x, 24.5, 6.4); // bark
			g.fillStyle(C('#c19a63'), 1).fillCircle(x, 24, 4.8); // sawn end grain
			g.lineStyle(1, C('#a3814f'), 0.9).strokeCircle(x, 24, 2.6).strokeCircle(x, 24, 1.1);
		};
		logRound(10);
		logRound(34);
		g.fillStyle(C('#8a6330'), 1).fillRoundedRect(3, 13.5, 38, 7, 2.5); // the slab, live-edged
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(3.5, 13.8, 37, 4.4, 2);
		g.fillStyle(C('#c9a56a'), 1).fillRoundedRect(4, 14, 36, 1.8, 1); // the sun along its top edge
		g.lineStyle(1, C('#8a6330'), 0.5).lineBetween(7, 17.6, 37, 17.6); // grain
		// a blanket left folded on the near end
		g.fillStyle(C('#c96f6a'), 1).fillRoundedRect(6, 9.5, 13, 6, 2);
		g.fillStyle(C('#efe3c8'), 1).fillRect(6, 11.6, 13, 1.3);
		g.fillStyle(C('#a85a55'), 1).fillRoundedRect(6, 14.6, 13, 2.2, 1); // the fold that hangs over
		// and a jar of whatever was blooming at the far end
		g.lineStyle(1, C('#6f9a4a'), 1).lineBetween(31, 12, 30, 7).lineBetween(33, 12, 34, 6.5).lineBetween(32, 12, 32, 6);
		g.fillStyle(C('#e3c75f'), 1).fillCircle(30, 6.4, 1.8);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(34, 6, 1.8);
		g.fillStyle(C('#f2ede0'), 1).fillCircle(32, 5.4, 1.6);
		g.fillStyle(C('#bcd8e0'), 0.85).fillRoundedRect(28.5, 8.5, 7, 5.5, 1.5); // the jar
		g.fillStyle(0xffffff, 0.4).fillRect(29.5, 9.5, 1.4, 3.5);
	}),
	...pickable('flowers', 36, 32, (g, picked) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 24, 32, 12);
		const cols = ['#d77bb1', '#e8954f', '#e3c75f', '#c45ad0', '#e86a6a'];
		cols.forEach((c, i) => {
			const x = 6 + i * 6,
				y = 10 + (i % 2) * 6;
			g.lineStyle(1, C('#4f8a38'), 1).lineBetween(x, y + 4, x, 22);
			if (picked) {
				// picked over: bare stems, with the next bud already coming on
				g.fillStyle(C('#6f9a4a'), 1).fillCircle(x, y + 1, 1.5);
				return;
			}
			g.fillStyle(C(c), 1).fillCircle(x, y, 3.4);
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 1.2);
		});
	}),
	// the blooms just read as a stray bug, so the sprite is now clean flowers.
	butterflyflowers: def(36, 34, (g) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(18, 27, 30, 11);
		g.lineStyle(1.5, C('#4f8a38'), 1)
			.lineBetween(10, 27, 10, 12)
			.lineBetween(18, 27, 18, 8)
			.lineBetween(26, 27, 26, 13);
		g.fillStyle(C('#e8813a'), 1).fillCircle(10, 11, 3.6).fillCircle(18, 7, 4.2).fillCircle(26, 12, 3.6);
		g.fillStyle(C('#c95f1e'), 1).fillCircle(9, 9.6, 1.4).fillCircle(17, 5.6, 1.6).fillCircle(25, 10.6, 1.4);
		g.fillStyle(C('#f4b04a'), 1).fillCircle(11.2, 11.8, 1.3).fillCircle(19.2, 8.2, 1.5).fillCircle(27.2, 12.8, 1.3);
	}),
	// bee — reads as a planted garden, not a wild patch.
	pollinatorgarden: def(40, 32, (g) => {
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
	}),
	...pickable('sunflowers', 34, 38, (g, picked) => {
		[9, 24].forEach((x, i) => {
			const y = 8 + i * 4;
			g.lineStyle(2.6, C('#5f9e44'), 1).lineBetween(x, y + 4, x, 34);
			if (!picked) {
				g.fillStyle(C('#e3c75f'), 1);
				for (let p = 0; p < 8; p++) {
					const a = (p / 8) * Math.PI * 2;
					g.fillEllipse(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 5, 3);
				}
			}
			// the seed head stays on the stalk either way — picked, it is a bare
			// brown disc with the petals dropped and the seed spiral emptied out
			g.fillStyle(C(picked ? '#8a6a4a' : '#7c5a3c'), 1).fillCircle(x, y, picked ? 3.2 : 3.4);
			if (picked) g.fillStyle(C('#6b4f36'), 1).fillCircle(x, y, 1.6);
		});
	}),
	// --- new craftable habitat shelters ---
	insecthotel: def(30, 36, (g) => {
		g.fillStyle(C('#8c6a42'), 1).fillRoundedRect(4, 8, 22, 26, 2); // frame
		g.fillStyle(C('#6b5238'), 1).fillTriangle(2, 9, 15, 1, 28, 9); // roof
		g.fillStyle(C('#caa15a'), 1).fillRect(6, 11, 8, 9).fillRect(16, 22, 8, 9); // straw cells
		g.fillStyle(C('#a3814f'), 1).fillRect(16, 11, 8, 9).fillRect(6, 22, 8, 9);
		g.fillStyle(C('#5d4128'), 1);
		for (const cx of [8, 10, 12, 18, 20, 22]) g.fillCircle(cx, 15.5, 0.9);
		for (const cx of [18, 20, 22]) g.fillCircle(cx, 26.5, 0.9);
	}),
	stonewall: def(40, 24, (g) => {
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
	}),
	// --- additional plantable vegetation (one distinct sprite each) ---
	...pickable('daisies', 34, 26, (g, picked) => {
		g.fillStyle(C('#6da84e'), 1).fillEllipse(17, 20, 32, 12);
		for (const [x, y] of [
			[9, 12],
			[18, 9],
			[26, 13],
			[13, 17],
			[23, 17],
		] as const) {
			if (picked) {
				// picked: the green button the petals were set around, nothing more
				g.fillStyle(C('#7fa34e'), 1).fillCircle(x, y, 1.8);
				continue;
			}
			g.fillStyle(0xffffff, 1);
			for (const a of [0, 1.05, 2.1, 3.14, 4.19, 5.24]) g.fillEllipse(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 3, 3);
			g.fillStyle(C('#e3c75f'), 1).fillCircle(x, y, 2);
		}
	}),
	...pickable('foxglove', 28, 42, (g, picked) => {
		g.lineStyle(3, C('#4f7d3a'), 1).lineBetween(10, 40, 10, 8).lineBetween(18, 40, 18, 12);
		if (picked) {
			// the bells taken off the spike, leaving the green seed capsules
			g.fillStyle(C('#6f8a4a'), 1);
			for (let i = 0; i < 5; i++) g.fillEllipse(10, 10 + i * 5, 3.5, 3);
			for (let i = 0; i < 4; i++) g.fillEllipse(18, 14 + i * 5, 3, 2.6);
			return;
		}
		g.fillStyle(C('#c45ad0'), 1);
		for (let i = 0; i < 5; i++) g.fillEllipse(10, 10 + i * 5, 7, 5);
		for (let i = 0; i < 4; i++) g.fillEllipse(18, 14 + i * 5, 6, 4);
	}),
	// a hole in the vegetation, not a mound.
	soilscrape: def(34, 24, (g) => {
		g.fillStyle(C('#6e8a46'), 1).fillEllipse(17, 14, 33, 18); // cut grass stubble ring
		g.lineStyle(1, C('#88a35a'), 1);
		for (let i = 0; i < 10; i++) g.lineBetween(2 + i * 3.4, 13 + (i % 2) * 3, 2 + i * 3.4, 7 + (i % 2) * 3);
		g.fillStyle(C('#a89065'), 1).fillEllipse(17, 15, 24, 12); // scraped down to tan mineral soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(17, 14, 21, 9);
		g.fillStyle(C('#d8c79a'), 0.7).fillEllipse(13, 11, 11, 3);
		g.lineStyle(1, C('#a08a5e'), 0.9).lineBetween(8, 11, 26, 13).lineBetween(8, 14, 26, 16).lineBetween(9, 17, 25, 18); // rake lines
	}),
	// silhouette is a lollipop on a stick, unlike the flush-mounted cavities.
	bluebirdbox: def(26, 36, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRect(11, 19, 3.5, 17); // slim grey pole
		g.fillStyle(C('#9a8460'), 1).fillTriangle(2, 30, 24, 30, 13, 19); // predator guard flaring below
		g.fillStyle(C('#cdb68c'), 1).fillTriangle(4, 29, 22, 29, 13, 21);
		g.fillStyle(C('#d8c49c'), 1).fillRect(6, 5, 14, 15); // pale cedar box
		g.fillStyle(C('#bda87f'), 1).fillRect(6, 5, 4.5, 15);
		g.fillStyle(C('#a8916a'), 1).fillTriangle(2, 6, 22, 2, 22, 5).fillTriangle(2, 6, 2, 3, 22, 2); // sloped roof
		g.fillStyle(C('#2b2118'), 1).fillCircle(13, 11, 3.2); // round entrance hole
		g.fillStyle(C('#6b8cc4'), 1).fillCircle(13.6, 11.6, 1.4); // blue shoulder in the dark
	}),
	// arch — a dish with two ear shadows in it, read from above.
	formhollow: def(34, 24, (g) => {
		g.fillStyle(C('#c2ab72'), 1).fillEllipse(17, 16, 32, 15); // straw-gold grass
		g.lineStyle(1.4, C('#6b5a3c'), 1).lineBetween(2, 14, 11, 4).lineBetween(11, 4, 24, 5).lineBetween(24, 5, 32, 13); // low twig arch
		g.fillStyle(C('#a8925c'), 1).fillEllipse(17, 17, 23, 11); // pressed bowl
		g.fillStyle(C('#8a7648'), 1).fillEllipse(17, 18, 18, 8); // fur-smoothed floor
		g.fillStyle(C('#5f5133'), 0.85).fillEllipse(13, 17, 4, 9).fillEllipse(20, 17, 4, 9); // two long ear shadows
		g.fillStyle(C('#d8c795'), 0.6).fillEllipse(12, 13, 10, 3); // sun on the lip
	}),
	// the very base — the dome is the giveaway, plus one fat bee going in.
	nesttussock: def(32, 32, (g) => {
		g.lineStyle(1.6, C('#8a9a4e'), 1);
		for (let i = 0; i < 11; i++) g.lineBetween(16, 26, 1 + i * 3, 3 + Math.abs(i - 5) * 3); // blades fountaining out
		g.fillStyle(C('#9aa85f'), 1).fillEllipse(16, 24, 28, 15); // shaggy dome
		g.fillStyle(C('#b0bd72'), 1).fillEllipse(13, 20, 18, 8);
		g.fillStyle(C('#5d5a33'), 1).fillEllipse(16, 27, 9, 6); // worn rim
		g.fillStyle(C('#241d10'), 1).fillEllipse(16, 28, 7, 5); // thumb-hole at the base
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(19, 28, 4.4, 3.2); // bee entering
		g.fillStyle(C('#3b2e25'), 1).fillRect(19.4, 27, 1.2, 2.6);
	}),
	// round it — tall and narrow where the old hawk nest is wide and flat.
	crowneyrie: def(30, 30, (g) => {
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
	}),
	// the foot — reads as a straight-edged cut, not a rounded mound.
	loambank: def(34, 26, (g) => {
		g.fillStyle(C('#33261a'), 1).fillRect(3, 3, 28, 7); // dark topsoil
		g.fillStyle(C('#584530'), 1).fillRect(3, 10, 28, 6); // loam
		g.fillStyle(C('#7d6647'), 1).fillRect(3, 16, 28, 5); // subsoil
		g.fillStyle(C('#1e160d'), 0.8).fillRect(3, 9.2, 28, 1.2).fillRect(3, 15.2, 28, 1.2); // layer seams
		g.fillStyle(0xffffff, 0.16).fillRect(3, 3, 28, 2); // light off the cut face
		g.fillStyle(C('#7a6347'), 1).fillEllipse(17, 23, 30, 8); // freshly thrown soil
		g.fillStyle(C('#8c7454'), 1).fillEllipse(15, 22, 20, 5);
		g.fillStyle(C('#5a462f'), 1).fillCircle(9, 24, 1.6).fillCircle(21, 25, 1.4).fillCircle(26, 23, 1.2); // crumbs
	}),
	// mouth at ground level, eggs just visible in the shadow.
	domednest: def(32, 26, (g) => {
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
	}),
	// Two openings is the tell — mountain-lion dens get one wide one.
	foxden: def(34, 26, (g) => {
		g.fillStyle(C('#7c6242'), 1).fillEllipse(17, 13, 32, 18); // earth mound
		g.fillStyle(C('#8f7450'), 1).fillEllipse(14, 9, 22, 10);
		g.fillStyle(C('#5c452c'), 1).fillEllipse(10, 15, 11, 9).fillEllipse(24, 16, 9, 7); // worn rims
		g.fillStyle(C('#2a1d12'), 1).fillEllipse(10, 16, 9, 7).fillEllipse(24, 17, 7, 5); // two den mouths
		g.fillStyle(C('#b49a70'), 1).fillEllipse(17, 23, 30, 7); // fan of dug soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(14, 22, 18, 4);
		g.fillStyle(C('#efe9dc'), 1).fillRect(19, 23, 6, 1.4).fillCircle(19, 23.7, 1.1).fillCircle(25, 23.7, 1.1); // gnawed bone
		g.fillStyle(C('#b4622e'), 1).fillEllipse(6, 21, 5, 3); // rust-red tuft of fur
	}),
	// horizontal, with pale mushroom caps pushing up through the middle.
	thatchmat: def(34, 22, (g) => {
		g.fillStyle(C('#9a8759'), 1).fillEllipse(17, 16, 32, 10); // packed bottom layer
		g.fillStyle(C('#b6a06a'), 1).fillEllipse(17, 13, 31, 9); // springy middle
		g.fillStyle(C('#cbb87f'), 1).fillEllipse(16, 10, 28, 7); // sun-bleached top
		g.lineStyle(1, C('#8d7a4c'), 0.9);
		for (let i = 0; i < 8; i++) g.lineBetween(3 + i * 4, 9 + (i % 3), 8 + i * 4, 12 - (i % 2) * 2); // flattened stems
		g.fillStyle(C('#5d4c30'), 0.8).fillEllipse(9, 12, 6, 1.6).fillEllipse(26, 15, 7, 1.8); // shadowed gaps
		g.fillStyle(C('#e8dcc0'), 1).fillRect(15, 7, 1.6, 5).fillRect(20, 6, 1.6, 5); // mushroom stalks
		g.fillStyle(C('#efe4cc'), 1).fillEllipse(15.8, 7, 7, 4).fillEllipse(20.8, 6, 6, 3.4); // pale caps
	}),
	// two frothy cream pods show, buried like corks.
	eggpodbank: def(34, 24, (g) => {
		g.fillStyle(C('#bda06d'), 1).fillEllipse(17, 15, 32, 16); // firm sandy ridge
		g.fillStyle(C('#d9c48a'), 1).fillEllipse(16, 11, 28, 9); // sunlit crest
		g.fillStyle(C('#6b5734'), 1).fillTriangle(17, 3, 33, 11, 33, 23); // cut-away face
		g.fillStyle(C('#846d44'), 1).fillTriangle(19, 6, 32, 12, 32, 21);
		g.fillStyle(C('#fbf4dc'), 1).fillEllipse(24, 12, 6, 10).fillEllipse(29, 17, 5.4, 9); // frothy egg pods
		g.fillStyle(C('#ddd0a6'), 1).fillEllipse(24, 14, 5, 5).fillEllipse(29, 19, 4.4, 4.4);
		g.lineStyle(0.7, C('#b9a97e'), 1).lineBetween(21.5, 10, 26.5, 10).lineBetween(21.5, 13, 26.5, 13); // foam banding
		g.fillStyle(C('#cbb277'), 1).fillCircle(8, 20, 1.4).fillCircle(12, 21, 1.1); // loose sand
	}),
	// horizontal bands — a lump on a stick, no foliage at all.
	ootheca: def(28, 32, (g) => {
		g.fillStyle(C('#7f8a5c'), 1).fillEllipse(14, 30, 22, 6); // dead grass base
		g.lineStyle(2, C('#c2b489'), 1).lineBetween(9, 30, 8, 2); // stiff pale stem
		g.lineStyle(1.6, C('#ab9d74'), 1).lineBetween(19, 30, 21, 5); // second stem
		g.fillStyle(C('#8f8258'), 1).fillEllipse(20.8, 15, 11, 16); // case, shaded side
		g.fillStyle(C('#a89a6c'), 1).fillEllipse(20, 15, 10, 15); // hardened foam
		g.fillStyle(C('#c8bb8c'), 1).fillEllipse(18.6, 13, 5, 9); // lit side
		g.lineStyle(0.8, C('#7d7049'), 1);
		for (const y of [10, 13, 16, 19]) g.lineBetween(15.5, y, 24.5, y + 0.6); // ridged banding
	}),
	// dots, with a lady beetle larva climbing up toward them.
	aphidcluster: def(26, 32, (g) => {
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
	}),
	// flower domes, and one pod split open spilling white silk.
	milkweedbed: def(36, 32, (g) => {
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
	}),
	// heads, one already blown to seed-down. Vertical and prickly.
	thistlestand: def(32, 34, (g) => {
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
	}),
	// berry clusters, and lower twigs bitten off blunt by browsing.
	serviceberry: def(34, 34, (g) => {
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
	}),
	// dashed frost line into a dark chamber with three snakes coiled inside.
	hibernaculum: def(30, 34, (g) => {
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
	}),
	// dark mouth, one animal standing bolt upright on the biggest mound.
	burrowtown: def(36, 26, (g) => {
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
	}),
	// with seed husks and dark pellets dropped along them.
	volerunway: def(36, 26, (g) => {
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
	}),
	// grey bark shed either side, pillbugs dotted through the soft wood.
	punkylog: def(36, 24, (g) => {
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
	}),
	// zigzag stitched down the middle and the spider hanging head-down at the hub.
	orbweb: def(34, 34, (g) => {
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
	}),
	// warm glow inside — a wide letterbox, not a round hole.
	batroost: def(34, 26, (g) => {
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
	}),
	// the sill and a pale heart face just inside the shadow.
	plankloft: def(34, 32, (g) => {
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
	}),
	// packed trail leading in and paw tracks fanning across the dirt apron.
	coyoteden: def(36, 26, (g) => {
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
	}),
	leafcorner: def(32, 24, (g) => {
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
	}),
	sedgetussock: def(30, 28, (g) => {
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
	}),
	nativegrass: def(36, 32, (g) => {
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
	}),
	// you would walk past it.
	grasstussocknest: def(36, 30, (g) => {
		g.fillStyle(C('#6f8a44'), 1).fillEllipse(18, 21, 36, 16); // damp hollow
		g.lineStyle(2.4, C('#8a9a52'), 1); // the thick tussock
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 3.8, 24, 2 + i * 4, 4 + (i % 4) * 4);
		g.lineStyle(1.8, C('#a3b06a'), 1);
		for (let i = 0; i < 8; i++) g.lineBetween(5 + i * 3.6, 24, 7 + i * 3.6, 6 + (i % 3) * 5);
		g.fillStyle(C('#5f6f3a'), 1).fillEllipse(18, 17, 17, 9); // the pressed-down cup
		g.fillStyle(C('#43502a'), 1).fillEllipse(18, 18, 12, 6);
		g.fillStyle(C('#c2b478'), 1).fillEllipse(18, 19, 9, 3.5); // dry grass lining it
	}),
	// one hidden in the grass a few paces off.
	groundhogmound: def(44, 28, (g) => {
		g.fillStyle(C('#7f9a4a'), 1).fillEllipse(22, 16, 44, 22); // meadow
		g.fillStyle(C('#8a7550'), 1).fillEllipse(15, 17, 26, 14); // the fan of turned earth
		g.fillStyle(C('#9c8560'), 1).fillEllipse(14, 14, 20, 9); // freshly dug, still pale
		g.fillStyle(C('#241c14'), 1).fillEllipse(15, 17, 12, 9); // the main hole
		g.fillStyle(C('#4a3f2e'), 1).fillEllipse(15, 20, 12, 2.6);
		g.lineStyle(2, C('#6f8a3f'), 1); // grass hiding the back door
		for (const x of [30, 33, 36, 39]) g.lineBetween(x, 22, x - 1, 8 + (x % 4) * 2);
		g.fillStyle(C('#241c14'), 1).fillEllipse(35, 20, 8, 5); // the second hole
		g.fillStyle(C('#5f7a35'), 1).fillEllipse(35, 18, 9, 3); // half-covered by grass
	}),
	// leaves and open at both ends.
	opossumhollow: def(44, 26, (g) => {
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(22, 19, 44, 14); // meadow floor
		g.fillStyle(C('#6b5a44'), 1).fillRoundedRect(3, 5, 36, 11, 5); // the leaning log
		g.fillStyle(C('#85704f'), 1).fillRoundedRect(3, 5, 34, 4, 2); // sunlit upper side
		g.fillStyle(C('#8a7358'), 1).fillEllipse(39, 12, 8, 11); // raised end
		g.fillStyle(C('#4f4030'), 1).fillEllipse(39, 12, 4, 6);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(20, 18, 30, 9); // the dry cavity beneath
		g.fillStyle(C('#8a6a3a'), 1).fillEllipse(20, 20, 24, 5); // dragged-in leaves on the floor
		g.fillStyle(C('#a3814f'), 1).fillEllipse(14, 20, 7, 2.6).fillEllipse(26, 21, 6, 2.4);
		g.fillStyle(C('#150f0a'), 1).fillEllipse(5, 18, 7, 6).fillEllipse(37, 18, 7, 6); // open at both ends
	}),
	// fungus, pushing up through damp grass thatch.
	meadowring: def(42, 26, (g) => {
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
	}),
};

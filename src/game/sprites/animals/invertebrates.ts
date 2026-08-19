// Everything else without a backbone — slugs, snails, crustaceans, and the
// tidepool animals of Pelican Shore.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const INVERTEBRATES: SpriteSet = {
	snail: def(30, 24, (g) => {
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
	}),
	batstar: def(24, 24, (g) => {
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
	}),
	octopus: def(32, 30, (g) => {
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
	}),
	crayfish: def(36, 26, (g) => {
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
	}),
	shrimp: def(26, 24, (g) => {
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
	}),
	pillbug: def(26, 22, (g) => {
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
	}),
	bananaslug: def(34, 22, (g) => {
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
	}),
	snowflea: def(24, 18, (g) => {
		// Just the animal — no ground under it, the way every other sprite is drawn.
		g.lineStyle(1.2, C('#2b2f36'), 1).lineBetween(11, 11, 7, 14).lineBetween(7, 14, 12, 15); // furcula, the springing tail fork
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(13, 12, 12, 16).lineBetween(17, 12, 17.5, 16); // stubby legs
		g.fillStyle(C('#2b2f36'), 1).fillEllipse(15, 9, 12, 8); // dark rounded body
		g.fillStyle(C('#3d434c'), 1).fillCircle(20, 8, 3.2); // head
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(21.5, 6, 23, 2.5); // antenna
		g.fillStyle(C('#e8eef4'), 1).fillCircle(20.6, 7, 1); // pale eye
	}),
	beachhopper: def(28, 24, (g) => {
		// sand-coloured and laterally flattened, curled like a comma mid-jump
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(19, 5, 27, 1).lineBetween(19, 7, 27, 8); // long antennae
		g.fillStyle(C('#d9c49b'), 1).fillCircle(16, 8, 5.6).fillCircle(11, 12, 5).fillCircle(9, 18, 4.2); // flattened body curled forward
		g.fillStyle(C('#d9c49b'), 0.9).fillTriangle(9, 21, 15, 23, 12, 17); // tail flick
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(13, 4, 10, 10).lineBetween(8, 8, 5, 14).lineBetween(5, 15, 7, 20); // segment seams down the flank
		g.lineStyle(1.6, C('#c2ab84'), 1).lineBetween(17, 12, 22, 18).lineBetween(22, 18, 18, 22); // big kicking hind leg
		g.lineStyle(1, C('#c2ab84'), 1);
		for (let i = 0; i < 4; i++) g.lineBetween(17 - i * 2, 12 + i * 1.6, 20 - i * 2, 15 + i * 1.6); // small legs
		g.fillStyle(C('#2e2018'), 1).fillCircle(19, 6, 1.2); // eye
	}),
	hermitcrab: def(30, 26, (g) => {
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
	}),
	millipede: def(32, 28, (g) => {
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
	}),
	sanddollar: def(26, 26, (g) => {
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
	}),
	urchin: def(30, 30, (g) => {
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
	}),
};

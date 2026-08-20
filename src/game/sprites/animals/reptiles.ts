// Reptiles. Snakes are legless, so they get their own sprite rather than
// the generic lizard body (see animalTexture).

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const REPTILES: SpriteSet = {
	snake: def(36, 18, (g) => {
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
	}),
	spottedturtle: def(28, 18, (g) => {
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
	}),
	chuckwalla: def(32, 18, (g) => {
		g.fillStyle(C('#4a3a30'), 1).fillEllipse(14, 10, 22, 9).fillCircle(24, 9, 4); // stout dark body + head
		g.fillStyle(C('#b5683f'), 1).fillEllipse(6, 11, 12, 5); // lighter tail
		g.fillStyle(C('#4a3a30'), 1).fillRect(9, 13, 2.5, 3).fillRect(18, 13, 2.5, 3); // legs
		g.fillStyle(0x2e2018, 1).fillCircle(25, 8, 1);
	}),
};

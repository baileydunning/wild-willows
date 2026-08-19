// Amphibians: salamanders and frogs.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const AMPHIBIANS: SpriteSet = {
	salamander: def(30, 18, (g) => {
		g.fillStyle(C('#3a4a3a'), 1).fillEllipse(13, 10, 18, 8).fillCircle(22, 8, 4);
		g.fillEllipse(5, 11, 10, 4); // tail
		g.fillStyle(C('#e8954f'), 1).fillCircle(10, 9, 1.6).fillCircle(15, 11, 1.6).fillCircle(19, 8, 1.4);
		g.fillStyle(0x2e2018, 1).fillCircle(24, 7, 1);
	}),
	ensatina: def(28, 16, (g) => {
		g.fillStyle(C('#c4682f'), 1).fillEllipse(13, 9, 18, 7).fillCircle(22, 8, 3.6); // orange body + head
		g.fillStyle(C('#7a3e1c'), 1).fillEllipse(13, 7, 16, 3); // darker back
		g.fillStyle(C('#c4682f'), 1).fillEllipse(5, 10, 9, 3.4); // tail
		g.fillStyle(C('#3a2c22'), 1).fillRect(8, 12, 2, 3).fillRect(16, 12, 2, 3); // little legs
		g.fillStyle(0x2e2018, 1).fillCircle(23, 7, 1);
	}),
	cascadesfrog: def(24, 18, (g) => {
		g.fillStyle(C('#6a7a40'), 1).fillEllipse(12, 12, 18, 11); // green-brown body
		g.fillStyle(C('#4a5a2c'), 1)
			.fillCircle(8, 9, 1.3)
			.fillCircle(14, 8, 1.3)
			.fillCircle(11, 13, 1.3)
			.fillCircle(16, 12, 1.3); // spots
		g.fillStyle(C('#8a9a58'), 1).fillCircle(7, 7, 2.6).fillCircle(17, 7, 2.6); // bulging eyes
		g.fillStyle(0x2e2018, 1).fillCircle(7, 7, 1.1).fillCircle(17, 7, 1.1);
		g.fillStyle(C('#6a7a40'), 1).fillTriangle(4, 16, 9, 14, 6, 17).fillTriangle(20, 16, 15, 14, 18, 17); // legs
	}),
};

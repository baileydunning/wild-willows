// The base camp itself: the crafting station and the three house styles.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const CAMP: SpriteSet = {
	workbench: def(48, 38, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(2, 10, 44, 10);
		g.fillStyle(C('#7c5a3c'), 1).fillRect(5, 20, 6, 16).fillRect(37, 20, 6, 16);
		g.fillStyle(C('#8e8e8a'), 1).fillRect(10, 5, 10, 5); // little tool
		g.fillStyle(C('#c9a35c'), 1).fillCircle(32, 8, 4);
	}),
	// Log Cabin: dark log walls, warm golden-pine door, brown gabled roof.
	'house-cabin': def(48, 44, (g) => {
		g.fillStyle(C('#6e4a2c'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#83603a'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#5e3f29'), 1).fillRoundedRect(8, 23, 32, 17, 2); // log wall
		g.lineStyle(1, C('#4a3020'), 1);
		for (let i = 0; i < 3; i++) g.lineBetween(8, 28 + i * 4, 40, 28 + i * 4); // log courses
		g.fillStyle(C('#c8a064'), 1).fillRoundedRect(20, 28, 9, 12, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 27, 6, 6); // lit window
	}),
	// Meadow Cottage: pale wood walls, airy blue-grey roof, green trim + window box.
	'house-cottage': def(48, 44, (g) => {
		g.fillStyle(C('#8b98a6'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#aab9c6'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#e6d3a6'), 1).fillRoundedRect(8, 23, 32, 17, 2); // pale wood wall
		g.fillStyle(C('#7fae6a'), 1).fillRect(8, 23, 32, 2.4); // green trim
		g.fillStyle(C('#c9b483'), 1).fillRoundedRect(20, 28, 9, 12, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 28, 6, 6).fillRect(30, 28, 6, 6); // windows
		g.fillStyle(C('#7fae6a'), 1).fillRect(11, 34, 8, 1.5); // window box
	}),
	// Stone Hearth: slate-grey stone blocks, dark roof, a chimney with hearth glow.
	'house-stone': def(48, 44, (g) => {
		g.fillStyle(C('#5a5650'), 1).fillTriangle(24, 4, 3, 23, 45, 23); // roof
		g.fillStyle(C('#6f6a62'), 1).fillTriangle(24, 8, 9, 23, 39, 23); // roof face
		g.fillStyle(C('#6f6a62'), 1).fillRect(31, 7, 6, 13); // chimney
		g.fillStyle(C('#d98a4f'), 1).fillCircle(34, 10, 2.2); // hearth glow
		g.fillStyle(C('#a9a499'), 1).fillRoundedRect(8, 23, 32, 17, 2); // stone wall
		g.lineStyle(1, C('#8a857b'), 1);
		g.lineBetween(8, 31, 40, 31).lineBetween(18, 23, 18, 31).lineBetween(28, 31, 28, 40); // block seams
		g.fillStyle(C('#7a756b'), 1).fillRoundedRect(20, 30, 9, 10, 1.5); // door
		g.fillStyle(C('#ffe6a3'), 1).fillRect(12, 26, 6, 6); // lit window
	}),
};

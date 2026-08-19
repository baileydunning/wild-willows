// Field guides: the starting pocket notes, and a book per biome in its colours.

import { C, def } from '../canvas';
import type { G, SpriteSet } from '../canvas';

/** Every guide is the same book drawn in a different livery. */
const book = (cover: string, band: string, ribbons: number) =>
	def(28, 30, (g: G) => {
		g.fillStyle(C(cover), 1).fillRoundedRect(5, 4, 18, 24, 2); // cover
		g.fillStyle(C('#f3ead2'), 1).fillRect(8, 6, 14, 20); // pages
		g.fillStyle(C('#5a4326'), 1).fillRect(5, 4, 3, 24); // spine
		g.fillStyle(C(band), 1).fillRect(8, 8, 14, 3); // title band
		g.lineStyle(1, C('#b7a988'), 1);
		for (let i = 0; i < 3; i++) g.lineBetween(10, 14 + i * 4, 20, 14 + i * 4); // ruled lines
		for (let i = 0; i < ribbons; i++)
			g.fillStyle(C(i === ribbons - 1 && ribbons > 1 ? '#e3c75f' : '#c45a5a'), 1).fillRect(8 + i * 2, 2, 1.6, 7);
	});

const GUIDE_COVERS: Record<string, [string, string]> = {
	meadow: ['#6b8f4e', '#8fb46a'], // Willow Meadow (green)
	forest: ['#3f5f3a', '#6b8f4e'], // Old Hollow Forest (deep green)
	wetland: ['#3f7a86', '#7fbccb'], // Rushwater Wetland (teal)
	desert: ['#b5703a', '#e0a45a'], // Redstone Scrubland (terracotta)
	alpine: ['#6a7486', '#aab9c6'], // Graywind Heights (slate)
	coastal: ['#2f6f9e', '#8fc6e2'], // Pelican Shore (ocean blue)
};

export const GUIDES: SpriteSet = {
	// the pocket notes every caretaker starts with (kraft)
	journal1: book('#8a7a52', '#b7a988', 1),
	...Object.fromEntries(
		Object.entries(GUIDE_COVERS).flatMap(([biome, [cover, band]]) => [
			[`guide-${biome}`, book(cover, band, 1)],
			[`guide-${biome}-expanded`, book(cover, band, 2)],
		]),
	),
};

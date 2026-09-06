// The four books on the home bookshelf, one sprite each.
//
// The field guides in objects/guides.ts are one book drawn in six liveries,
// because they ARE one thing per biome. These are four different books, and they
// sit next to each other in a list — so each gets its own cover device as well as
// its own colour: the three needs of a habitat, an energy pyramid, a dam, and a
// stand of plants growing up. Same commands and the same palette as the rest of
// the set: flat filled shapes, no outlines, one warm ribbon.

import { C, def } from './canvas';
import type { G, SpriteSet } from './canvas';
import { spriteDataUri } from './svg';

const PAGES = '#f3ead2';
const RULE = '#b7a988';

/** The book itself: closed, face-on, with room on the cover for its device. */
const storyBook = (cover: string, spine: string, band: string, device: (g: G) => void) =>
	def(30, 32, (g: G) => {
		g.fillStyle(C('#3a2e20'), 0.16).fillEllipse(16, 30, 20, 3.4); // it sits on something
		g.fillStyle(C(PAGES), 1).fillRoundedRect(8.5, 4, 19, 25, 2); // page block, offset behind
		g.lineStyle(0.8, C(RULE), 0.7);
		for (let i = 0; i < 4; i++) g.lineBetween(25.8, 8.5 + i * 4.6, 26.9, 8.5 + i * 4.6); // page edges
		g.fillStyle(C(cover), 1).fillRoundedRect(6, 3, 19, 25, 2.5); // cover
		g.fillStyle(C(spine), 1).fillRoundedRect(6, 3, 3.4, 25, 1.6); // spine
		g.fillStyle(C(band), 1).fillRect(11, 6, 11.5, 2); // title band
		device(g);
		g.fillStyle(C('#e3c75f'), 1).fillRect(21.4, 1.4, 1.7, 7.4); // ribbon
	});

export const STORY_BOOKS: SpriteSet = {
	// Habitat: the three things a place has to provide, in a row on the cover —
	// a grass tuft, a shelter, a drop of water.
	'book-habitat': storyBook('#4f7a46', '#3b5c34', '#8fb46a', (g) => {
		g.fillStyle(C('#a8cc84'), 1); // grass — three blades, drawn as tapers so they stay separate
		g.fillTriangle(12.4, 21.4, 13.1, 21.4, 11.4, 16.9);
		g.fillTriangle(12.9, 21.4, 13.7, 21.4, 13.3, 15.4);
		g.fillTriangle(13.5, 21.4, 14.2, 21.4, 15.1, 17.2);
		g.fillStyle(C('#c9a06a'), 1).fillTriangle(14.9, 21, 17.6, 15.8, 20.3, 21); // shelter
		g.fillStyle(C('#6b4a2f'), 1).fillRect(16.8, 18.4, 1.7, 2.6); // its dark mouth
		g.fillStyle(C('#7fbccb'), 1).fillCircle(22.3, 19.1, 1.9); // water
		g.fillTriangle(20.6, 19.1, 22.3, 15.4, 24, 19.1);
		g.fillStyle(C('#8fb46a'), 0.75).fillRect(11, 22.2, 12.5, 1); // the ground they share
	}),

	// Food chains: an energy pyramid, wide at the grass and one bar wide at the
	// top, with the predator's step picked out.
	'book-foodchain': storyBook('#a4552f', '#7d3d22', '#e8a54f', (g) => {
		g.fillStyle(C('#f0e2c0'), 1);
		g.fillRect(11, 21.4, 12.5, 2.3).fillRect(12.6, 18.3, 9.3, 2.3).fillRect(14.2, 15.2, 6.1, 2.3);
		g.fillStyle(C('#e8a54f'), 1).fillRect(15.8, 12.1, 2.9, 2.3); // the fox's step
	}),

	// Ecosystem engineers: a dam seen from the side — water banked up behind it,
	// a trickle below. The silhouette is the whole point, so it is drawn as a
	// wedge of stacked sticks rather than a picture of a beaver.
	'book-engineer': storyBook('#6b4a2f', '#4e3520', '#7fbccb', (g) => {
		g.fillStyle(C('#7fbccb'), 1).fillRect(10.6, 14.6, 7.8, 7.6); // the water it holds back
		g.fillStyle(C('#a8d2dd'), 1).fillRect(10.6, 14.6, 7.8, 1.1); // its lit surface
		g.fillStyle(C('#5f9fb0'), 1).fillRect(19.4, 20.4, 4.6, 1.8); // and the trickle below
		g.fillStyle(C('#a07b45'), 1).fillTriangle(15.4, 22.2, 20.6, 22.2, 18.2, 13.4); // the dam
		g.lineStyle(1.1, C('#d8b880'), 1); // sticks laid across it
		g.lineBetween(16.2, 20.2, 20.2, 20.8).lineBetween(16.8, 17.9, 19.6, 18.4);
		g.lineStyle(1.1, C('#6b4a2f'), 1);
		g.lineBetween(16.4, 21.4, 19.4, 15.6).lineBetween(19.9, 21.4, 17.5, 15.6);
		g.fillStyle(C('#8a6330'), 1).fillRect(10.6, 22.2, 13.4, 1.4); // the bed it is keyed into
	}),

	// Succession: bare ground, then grass, then a shrub, then a tree.
	'book-succession': storyBook('#b58a4a', '#8a6330', '#8fb46a', (g) => {
		g.fillStyle(C('#a07b45'), 1).fillRect(10.8, 21.8, 13, 1.2); // the ground itself
		g.fillStyle(C('#8a6330'), 1).fillEllipse(12.2, 21.2, 2.6, 1.6); // bare: a stone
		g.fillStyle(C('#8fb46a'), 1); // grass
		g.fillTriangle(14.9, 21.6, 15.5, 21.6, 14.2, 18.4);
		g.fillTriangle(15.3, 21.6, 15.9, 21.6, 15.6, 17.6);
		g.fillTriangle(15.7, 21.6, 16.3, 21.6, 17, 18.6);
		g.fillStyle(C('#5a4326'), 1).fillRect(18.7, 19.6, 0.9, 2.2); // shrub
		g.fillStyle(C('#6b8f4e'), 1).fillCircle(19.1, 19, 2.2);
		g.fillStyle(C('#5a4326'), 1).fillRect(22.3, 16.8, 1.2, 5); // tree
		g.fillStyle(C('#4f7a46'), 1).fillCircle(22.9, 15.6, 2.7);
	}),
};

/** One book's cover as an SVG data URI, the way the journal draws animals. */
export function bookSpriteDataUri(id: string): string | null {
	const s = STORY_BOOKS[id];
	return s ? spriteDataUri(s) : null;
}

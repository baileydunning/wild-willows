// Birds.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const BIRDS: SpriteSet = {
	sparrow: def(28, 20, (g) => {
		g.fillStyle(C('#8a6a44'), 1).fillEllipse(11, 11, 16, 12);
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(10, 14, 10, 7); // breast
		g.fillStyle(C('#8a6a44'), 1).fillCircle(19, 7, 5);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(23, 7, 27, 8, 23, 10); // beak
		g.fillStyle(0x2e2018, 1).fillCircle(20, 6, 1.2);
	}),
	woodpecker: def(22, 26, (g) => {
		g.fillStyle(0x2e2e2e, 1).fillEllipse(10, 14, 12, 16);
		g.fillStyle(0xffffff, 1).fillEllipse(9, 16, 6, 9);
		g.fillStyle(C('#c0392b'), 1).fillCircle(13, 5, 4); // red cap
		g.fillStyle(0x2e2e2e, 1).fillCircle(14, 7, 3.4);
		g.fillStyle(C('#8e8e8a'), 1).fillTriangle(17, 7, 22, 8, 17, 10);
	}),
	owl: def(26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillStyle(C('#6b5238'), 1);
		g.fillTriangle(4, 0, 11, 11, 1, 12).fillTriangle(22, 0, 25, 12, 15, 11); // big ear tufts — the 'horns'
		g.fillStyle(C('#8d7050'), 1).fillTriangle(5, 3, 9, 11, 3, 11).fillTriangle(21, 3, 23, 11, 17, 11);
		g.fillStyle(C('#7c6248'), 1);
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(13, 20, 12, 14);
		g.fillStyle(0xf4e3b1, 1).fillCircle(9, 12, 3.4).fillCircle(17, 12, 3.4);
		g.fillStyle(0x2e2018, 1).fillCircle(9, 12, 1.6).fillCircle(17, 12, 1.6);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(13, 14, 11, 17, 15, 17);
	}),
	killdeer: def(28, 20, (g) => {
		g.fillStyle(C('#8a6a48'), 1).fillEllipse(12, 12, 18, 10).fillCircle(20, 8, 4.5); // brown back + head
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 14, 6); // white belly
		g.fillStyle(0x2e2018, 1).fillRect(7, 11, 13, 1.6).fillRect(7, 14, 13, 1.6); // two breast bands
		g.fillStyle(0x1a1a1a, 1).fillTriangle(24, 7, 28, 8, 24, 9); // bill
		g.fillStyle(C('#d83a3a'), 1).fillCircle(21, 7, 1.4); // red eye-ring
		g.fillStyle(0x2e2018, 1).fillCircle(21, 7, 0.9);
	}),
	towhee: def(27, 20, (g) => {
		g.fillStyle(0x1c1c1c, 1).fillEllipse(11, 11, 16, 12).fillCircle(18, 7, 4.5); // black hood/back
		g.fillStyle(C('#b5532f'), 1).fillEllipse(8, 14, 9, 8); // rufous flank
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 6, 5); // white belly
		g.fillStyle(C('#d83a3a'), 1).fillCircle(19, 6, 1.1); // red eye
		g.fillStyle(0x1a1a1a, 1).fillTriangle(22, 6, 26, 7, 22, 9);
	}),
	merganser: def(30, 22, (g) => {
		g.fillStyle(C('#5a3a22'), 1).fillEllipse(13, 14, 20, 11); // brown body
		g.fillStyle(0x1c1c1c, 1).fillCircle(22, 9, 5); // black head
		g.fillStyle(C('#f4efe6'), 1).fillTriangle(20, 9, 27, 4, 27, 11); // white fan crest
		g.fillStyle(C('#caa15a'), 1).fillTriangle(26, 9, 30, 10, 26, 11); // bill
		g.fillStyle(C('#e8d35e'), 1).fillCircle(22, 8, 1); // yellow eye
	}),
	yellowthroat: def(24, 18, (g) => {
		g.fillStyle(C('#9a8a4a'), 1).fillEllipse(10, 10, 15, 10); // olive back
		g.fillStyle(C('#f2d83a'), 1).fillEllipse(9, 12, 11, 8).fillCircle(16, 8, 4); // yellow throat + head
		g.fillStyle(0x1a1a1a, 1).fillRect(13, 6, 8, 3.4); // black bandit mask
		g.fillStyle(C('#f2d83a'), 1).fillCircle(15, 8, 1.4);
		g.fillStyle(0x1a1a1a, 1).fillTriangle(20, 7, 23, 8, 20, 9);
	}),
	phainopepla: def(24, 22, (g) => {
		g.fillStyle(0x16161a, 1).fillEllipse(12, 14, 15, 12).fillCircle(17, 8, 4.5); // glossy black
		g.fillStyle(0x16161a, 1).fillTriangle(14, 5, 18, 1, 20, 6); // pointed crest
		g.fillStyle(C('#d83a3a'), 1).fillCircle(18, 7, 1.2); // red eye
		g.fillStyle(0x2e2018, 1).fillTriangle(21, 7, 24, 8, 21, 9);
	}),
	whitecrown: def(24, 20, (g) => {
		g.fillStyle(C('#9a8a72'), 1).fillEllipse(11, 12, 16, 10); // grey-brown body
		g.fillStyle(C('#d8cdba'), 1).fillEllipse(10, 14, 11, 6); // pale breast
		g.fillStyle(C('#e8e2d6'), 1).fillCircle(18, 8, 4); // head base
		g.fillStyle(0x1a1a1a, 1).fillRect(15, 5, 7, 1.4).fillRect(15, 8, 7, 1.4); // black crown stripes
		g.fillStyle(C('#e3a14f'), 1).fillTriangle(21, 8, 24, 9, 21, 10); // orange bill
		g.fillStyle(0x2e2018, 1).fillCircle(18, 8, 0.9);
	}),
	turnstone: def(26, 20, (g) => {
		g.fillStyle(C('#3a3a42'), 1).fillEllipse(12, 11, 18, 11).fillCircle(19, 8, 4); // dark slate
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(11, 15, 13, 6); // white belly
		g.fillStyle(0x1a1a1a, 1).fillTriangle(22, 7, 26, 8, 22, 9); // bill
		g.fillStyle(C('#e3a14f'), 1).fillRect(9, 18, 1.6, 2.4).fillRect(14, 18, 1.6, 2.4); // legs
		g.fillStyle(C('#f2ece0'), 1).fillCircle(20, 7, 0.9);
	}),
	guillemot: def(28, 22, (g) => {
		g.fillStyle(0x1a1a1a, 1).fillEllipse(12, 13, 18, 12).fillCircle(19, 8, 4.5); // black body
		g.fillStyle(C('#f4efe6'), 1).fillEllipse(10, 11, 7, 5); // white wing patch
		g.fillStyle(0x16161a, 1).fillTriangle(22, 7, 27, 8, 22, 9); // bill
		g.fillStyle(C('#d8472a'), 1).fillRect(10, 19, 1.8, 3).fillRect(15, 19, 1.8, 3); // red feet
		g.fillStyle(C('#f4efe6'), 1).fillCircle(20, 7, 0.8);
	}),
	// --- Custom sprites for species that were falling through to generics ----
	barnowl: def(26, 30, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(13, 17, 20, 22);
		g.fillTriangle(5, 6, 9, 12, 3, 12).fillTriangle(21, 6, 23, 12, 17, 12); // small tufts
		g.fillStyle(C('#d8c8a8'), 1).fillEllipse(13, 20, 12, 14);
		g.fillStyle(0xf4e3b1, 1).fillCircle(9, 12, 3.4).fillCircle(17, 12, 3.4);
		g.fillStyle(0x2e2018, 1).fillCircle(9, 12, 1.6).fillCircle(17, 12, 1.6);
		g.fillStyle(C('#e3c75f'), 1).fillTriangle(13, 14, 11, 17, 15, 17);
	}),
	puffin: def(26, 30, (g) => {
		g.fillStyle(C('#e0812f'), 1).fillEllipse(9, 28, 7, 3.5).fillEllipse(17, 28, 7, 3.5); // orange webbed feet
		g.fillStyle(C('#22201f'), 1).fillEllipse(13, 16, 18, 24); // black back and crown
		g.fillStyle(0xffffff, 1).fillEllipse(14, 20, 14, 18); // white breast
		g.fillStyle(C('#d8d5cf'), 1).fillCircle(13, 9, 7); // pale grey face patch
		g.fillStyle(C('#22201f'), 1).fillEllipse(13, 3, 15, 6); // black cap over the top
		g.fillStyle(C('#e8e5df'), 1).fillTriangle(19, 6, 26, 11, 19, 15); // the big beak, pale outer half
		g.fillStyle(C('#e0812f'), 1).fillTriangle(19, 7, 24, 11, 19, 14); // orange inner half
		g.fillStyle(C('#c23b2e'), 1).fillTriangle(19, 8, 21.5, 11, 19, 13); // red base
		g.lineStyle(0.9, C('#8a7f70'), 1).lineBetween(21, 8.4, 21, 13.4); // the groove across it
		g.fillStyle(C('#2e2018'), 1).fillEllipse(13, 8, 3.4, 3.8); // the sad-looking eye
		g.fillStyle(0xffffff, 1).fillCircle(12.3, 7.2, 0.9);
	}),
	crow: def(30, 24, (g) => {
		g.fillStyle(C('#1a1a1e'), 1).fillRect(12, 18, 2, 5).fillRect(17, 18, 2, 5); // legs
		g.fillStyle(C('#22222a'), 1).fillEllipse(15, 13, 24, 13); // body
		g.fillTriangle(2, 9, 9, 13, 3, 16); // squared-off tail
		g.fillStyle(C('#2e2e38'), 1).fillEllipse(14, 11, 16, 7); // folded wing
		g.fillStyle(C('#3a3a46'), 0.7).fillEllipse(13, 9, 11, 3); // faint blue-black sheen
		g.fillStyle(C('#22222a'), 1).fillCircle(23, 9, 5.4); // head
		g.fillStyle(C('#141418'), 1).fillTriangle(27, 6.5, 30, 9.4, 27, 12); // stout straight bill
		g.fillStyle(C('#c9c4bb'), 1).fillCircle(23.6, 8, 1.5); // pale eye
		g.fillStyle(C('#141418'), 1).fillCircle(23.6, 8, 0.8);
	}),
	swift: def(32, 20, (g) => {
		g.fillStyle(C('#22222a'), 1).fillEllipse(16, 11, 15, 7); // slim body, built for speed
		g.fillTriangle(14, 9, 1, 1, 11, 13).fillTriangle(18, 9, 31, 1, 21, 13); // long scythe wings swept back
		g.fillStyle(0xffffff, 1).fillEllipse(15, 12, 7, 5); // white throat and belly stripe
		g.fillStyle(C('#22222a'), 1).fillCircle(22, 9, 3.6); // head
		g.fillTriangle(3, 15, 12, 12, 6, 18); // forked tail
		g.fillStyle(0xffffff, 1).fillEllipse(22, 11, 4, 2.4); // white throat patch
		g.fillStyle(C('#141418'), 1).fillTriangle(25, 8, 27, 9.2, 25, 10); // tiny bill
		g.fillStyle(C('#e8e4dc'), 1).fillCircle(22.4, 8, 1.1); // eye
		g.fillStyle(C('#141418'), 1).fillCircle(22.4, 8, 0.6);
	}),
	bluejay: def(30, 26, (g) => {
		g.fillStyle(C('#9ecdea'), 1).fillTriangle(2, 12, 12, 14, 3, 18); // tail
		g.fillStyle(C('#7fb8dd'), 1).fillRect(3, 13.4, 9, 1).fillRect(3, 16, 8, 1); // tail barring
		g.fillStyle(C('#a8d4f0'), 1).fillEllipse(15, 14, 20, 13); // light blue body
		g.fillStyle(C('#f2f6fa'), 1).fillEllipse(15, 17, 15, 7); // pale breast
		g.fillStyle(C('#8fc4e8'), 1).fillEllipse(13, 12, 13, 7); // folded wing
		g.fillStyle(C('#6fa8d4'), 1).fillRect(8, 10.4, 10, 1).fillRect(8, 12.6, 9, 1); // wing bars
		g.fillStyle(C('#a8d4f0'), 1).fillCircle(23, 9, 5.4); // head
		g.fillTriangle(20, 5, 24, 1, 26, 6); // crest
		g.fillStyle(C('#f2f6fa'), 1).fillEllipse(24.5, 10.5, 7, 5); // white face
		g.fillStyle(C('#2b2b30'), 1).fillEllipse(20.5, 13.4, 8, 1.4); // thin black necklace
		g.fillEllipse(20.4, 9.4, 1.3, 4.6); // narrow black line behind the eye
		g.fillTriangle(27, 8.6, 30, 9.8, 27, 11); // bill
		g.fillStyle(C('#2e2018'), 1).fillCircle(23.6, 8.6, 1.2); // eye
		g.fillStyle(C('#6fa8d4'), 1).fillRect(13, 20, 1.6, 4).fillRect(18, 20, 1.6, 4); // legs
	}),
};

// Generic bodies by kind — the fallback silhouettes an animal falls back to
// when nothing bespoke has been drawn for it. Three variants per kind so that,
// combined with a unique per-animal tint and size, even same-kind animals read
// as distinct individuals rather than copies of one another.

import { def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const GENERIC: SpriteSet = (() => {
	const set: SpriteSet = {};
	// Generic bodies by kind. Each kind gets three silhouette variants so that,
	// combined with a unique per-animal tint and size, even same-kind animals
	// read as distinct individuals rather than copies of one another.
	for (let v = 0; v < 3; v++) {
		set[`mammal-${v}`] = def(28, 22, (g) => {
			const bw = 15 + v * 3;
			g.fillStyle(0xffffff, 1).fillRect(7, 16, 3, 5).fillRect(16, 16, 3, 5); // legs
			g.fillEllipse(13, 14, bw, 11).fillCircle(20, 9, 5);
			if (v === 0)
				g.fillCircle(18, 4, 2.4).fillCircle(22, 4, 2.4); // round ears
			else if (v === 1)
				g.fillEllipse(18, 3, 3, 7).fillEllipse(22, 3, 3, 7); // tall ears
			else g.fillTriangle(16, 5, 19, 0, 21, 5).fillTriangle(20, 5, 23, 0, 25, 5); // pointed ears
			if (v === 0)
				g.fillEllipse(4, 13, 5, 4); // stub tail
			else if (v === 1)
				g.fillEllipse(3, 12, 10, 4); // long tail
			else g.fillCircle(4, 12, 4.5); // bushy tail
			g.fillStyle(0x2e2018, 1).fillCircle(21, 8, 1.2);
		});
		set[`bird-${v}`] = def(24, 20, (g) => {
			g.fillStyle(0xffffff, 1)
				.fillEllipse(10, 11, 13 + v * 2, 11)
				.fillCircle(16, 6, 4);
			g.fillStyle(0xe3c75f, 1).fillTriangle(19, 6, 23, 7, 19, 9);
			g.fillStyle(0xffffff, 1);
			if (v === 1)
				g.fillTriangle(1, 8, 8, 11, 2, 15); // long tail
			else if (v === 2) g.fillTriangle(13, 1, 16, 5, 18, 2); // head crest
			g.fillStyle(0x2e2018, 1).fillCircle(17, 5, 1);
		});
		set[`insect-${v}`] = def(18, 16, (g) => {
			const ww = 7 + v;
			g.fillStyle(0xffffff, 0.85).fillEllipse(5, 5, ww, 7).fillEllipse(12, 5, ww, 7);
			if (v === 2) g.fillEllipse(5, 11, ww - 2, 5).fillEllipse(12, 11, ww - 2, 5); // hindwings
			g.fillStyle(0x2e2018, 1).fillEllipse(8, 8, 3, v === 0 ? 6 : 9);
		});
		set[`reptile-${v}`] = def(30, 16, (g) => {
			g.fillStyle(0xffffff, 1)
				.fillEllipse(13, 8, 16 + v * 2, 7)
				.fillCircle(21, 7, 3.4);
			g.fillEllipse(3, 8, 8 + v * 2, 3.4); // tail
			if (v === 2) g.fillRect(9, 11, 2, 3).fillRect(16, 11, 2, 3); // little legs
			g.fillStyle(0x2e2018, 1).fillCircle(22, 6, 1);
		});
		set[`amphibian-${v}`] = def(24, 16, (g) => {
			g.fillStyle(0xffffff, 1)
				.fillEllipse(11, 10, 15 + v * 2, 9)
				.fillCircle(16, 6, 4);
			if (v === 1) g.fillCircle(13, 3.5, 2).fillCircle(19, 3.5, 2); // bulging eyes
			g.fillStyle(0x2e2018, 1).fillCircle(17, 5, 1.2);
			if (v === 1) g.fillCircle(13, 3.2, 0.9).fillCircle(19, 3.2, 0.9);
		});
		set[`fish-${v}`] = def(26, 16, (g) => {
			g.fillStyle(0xffffff, 1).fillEllipse(13, 8, 15 + v * 2, 9);
			g.fillTriangle(2, 3, 6, 8, 2, 13); // tail
			if (v === 2) g.fillTriangle(12, 1, 16, 5, 12, 5); // dorsal fin
			g.fillStyle(0x2e2018, 1).fillCircle(18, 7, 1.2);
		});
		set[`invertebrate-${v}`] = def(20, 18, (g) => {
			g.fillStyle(0xffffff, 1).fillCircle(9, 9, 6 + v);
			if (v === 2) {
				g.lineStyle(1.4, 0xffffff, 1);
				for (let i = 0; i < 3; i++) g.lineBetween(4, 7 + i * 3, 1, 6 + i * 3).lineBetween(14, 7 + i * 3, 17, 6 + i * 3);
			}
			g.lineStyle(1, 0x2e2018, 0.4).strokeCircle(9, 9, 4);
			g.fillStyle(0x2e2018, 1).fillCircle(13, 6, 1);
		});
	}
	return set;
})();

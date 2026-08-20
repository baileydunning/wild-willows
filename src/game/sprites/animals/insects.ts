// Insects: butterflies, moths, beetles and the mantis.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const INSECTS: SpriteSet = {
	butterfly: def(24, 20, (g) => {
		g.fillStyle(C('#e8771f'), 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12);
		g.fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
		g.lineStyle(2, 0x2e2018, 1).strokeEllipse(7, 8, 12, 12).strokeEllipse(17, 8, 12, 12);
		g.fillStyle(0x2e2018, 1).fillEllipse(12, 11, 3, 12);
	}),
	// --- unique sprites for the newer animals ---
	mantis: def(30, 24, (g) => {
		g.lineStyle(1.4, C('#4f7429'), 1);
		g.lineBetween(11, 13, 7, 21).lineBetween(7, 21, 4, 22); // back legs, down to the ground
		g.lineBetween(15, 13, 13, 21).lineBetween(13, 21, 10, 22);
		g.lineBetween(18, 12, 18, 20).lineBetween(18, 20, 15, 22); // middle pair
		g.fillStyle(C('#4f7429'), 1).fillEllipse(8, 11, 13, 6); // long abdomen, angled up
		g.fillStyle(C('#4a6b28'), 1).fillEllipse(13, 11, 16, 6); // wing case over it
		g.lineStyle(0.8, C('#4a6b28'), 1).lineBetween(7, 10, 19, 11); // wing seam
		g.fillStyle(C('#4a6b28'), 1).fillEllipse(21, 10, 8, 4.5); // thorax reaching the head
		g.lineStyle(2.2, C('#4a6b28'), 1);
		g.lineBetween(22, 11, 26, 15).lineBetween(26, 15, 21, 17); // folded raptorial forelegs
		g.lineBetween(21, 11, 25, 16).lineBetween(25, 16, 20, 18);
		g.fillStyle(C('#6f9c3e'), 1).fillTriangle(24, 5, 29, 9, 23, 12); // triangular head
		g.fillStyle(C('#2e2018'), 1).fillCircle(27.4, 7.6, 1.3).fillCircle(24.4, 7.2, 1.1); // the two big eyes
		g.lineStyle(0.9, C('#4f7429'), 1).lineBetween(26, 5, 29, 1).lineBetween(24, 5, 24, 1); // antennae
	}),
	redadmiral: def(24, 20, (g) => {
		g.fillStyle(C('#2a2420'), 1).fillEllipse(7, 8, 12, 12).fillEllipse(17, 8, 12, 12); // dark forewings
		g.fillStyle(C('#2a2420'), 1).fillEllipse(8, 16, 8, 7).fillEllipse(16, 16, 8, 7);
		g.fillStyle(C('#d8472a'), 1).fillTriangle(2, 9, 9, 7, 5, 13).fillTriangle(22, 9, 15, 7, 19, 13); // red bands
		g.fillStyle(C('#d8472a'), 1).fillRect(5, 18, 6, 2).fillRect(13, 18, 6, 2);
		g.fillStyle(0x2e2018, 1).fillEllipse(12, 11, 2.4, 12);
	}),
	moth: def(34, 26, (g) => {
		// broad triangular wings held flat, fat furry body — nothing bee-like
		g.fillStyle(C('#8d8272'), 1).fillTriangle(17, 8, 1, 7, 5, 19).fillTriangle(17, 8, 33, 7, 29, 19); // broad forewings, held flat
		g.fillStyle(C('#6f6557'), 1).fillTriangle(17, 14, 6, 19, 14, 24).fillTriangle(17, 14, 28, 19, 20, 24); // hindwings
		g.fillStyle(C('#5a5044'), 0.55).fillTriangle(3, 10, 15, 9, 4, 14).fillTriangle(31, 10, 19, 9, 30, 14); // muted wing bands
		g.fillStyle(C('#cfc4ae'), 1).fillCircle(8, 12, 2.8); // single eyespot
		g.fillStyle(C('#4a4038'), 1).fillCircle(8, 12, 1.2);
		g.fillStyle(C('#5a5044'), 1).fillEllipse(17, 15, 7, 16); // fat furry body
		g.fillStyle(C('#7a6f5e'), 1).fillCircle(17, 9, 3.6).fillCircle(17, 5.4, 2.4); // furry thorax + small head
		g.lineStyle(1.6, C('#4a4038'), 1).lineBetween(16, 5, 10, 2).lineBetween(18, 5, 24, 2); // antenna shafts
		g.lineStyle(1, C('#4a4038'), 1);
		for (let i = 1; i <= 3; i++)
			g.lineBetween(16 - i * 2, 5 - i * 0.75, 16 - i * 2, 2.4 - i * 0.75).lineBetween(
				18 + i * 2,
				5 - i * 0.75,
				18 + i * 2,
				2.4 - i * 0.75,
			); // feathery comb teeth
	}),
	termite: def(30, 20, (g) => {
		// pale soft segmented body, broad-waisted (no ant pinch), dark jawed head
		g.lineStyle(1.4, C('#c9b48e'), 1);
		g.lineBetween(8, 14, 6, 19).lineBetween(13, 14, 12, 19).lineBetween(19, 14, 18, 19); // three legs below
		g.lineBetween(9, 7, 7, 2).lineBetween(14, 6, 13, 1).lineBetween(19, 7, 18, 2); // three legs above
		g.fillStyle(C('#e6dcc6'), 1).fillEllipse(11, 10, 19, 11); // pale swollen abdomen
		g.lineStyle(1, C('#cbbfa4'), 1).lineBetween(6, 6, 6, 14).lineBetween(10, 5, 10, 15).lineBetween(14, 5.5, 14, 14.5); // soft body segments
		g.fillStyle(C('#e6dcc6'), 1).fillEllipse(20, 10, 9, 10); // thorax, as broad as the waist
		g.fillStyle(C('#8a5a34'), 1).fillCircle(25, 10, 4.6); // hard dark head
		g.fillStyle(C('#5e3a20'), 1).fillTriangle(28, 6.5, 30, 9, 26.5, 9.5).fillTriangle(28, 13.5, 30, 11, 26.5, 10.5); // jaws
		g.lineStyle(1, C('#8a5a34'), 1).lineBetween(27, 7, 29, 3); // short antenna
		g.fillStyle(C('#2e2018'), 1).fillCircle(26, 8.5, 1); // eye
	}),
	lunamoth: def(34, 32, (g) => {
		g.fillStyle(C('#9fd88f'), 1);
		g.fillEllipse(10, 11, 15, 12).fillEllipse(24, 11, 15, 12); // broad forewings
		g.fillEllipse(11, 19, 12, 11).fillEllipse(23, 19, 12, 11); // hindwings
		g.fillTriangle(9, 22, 13, 22, 6, 32).fillTriangle(21, 22, 25, 22, 28, 32); // the long trailing tails
		g.fillStyle(C('#7fbf72'), 1).fillRect(4, 8, 26, 1.6); // leading edge
		g.fillStyle(C('#e8f2c9'), 1).fillEllipse(17, 15, 5, 17); // furry pale body
		g.fillStyle(C('#f2e6a8'), 1).fillCircle(10, 12, 2).fillCircle(24, 12, 2); // eyespots
		g.fillStyle(C('#4a3a22'), 1).fillCircle(10, 12, 0.9).fillCircle(24, 12, 0.9);
		g.lineStyle(1.2, C('#c9a24a'), 1).lineBetween(16, 7, 12, 2).lineBetween(18, 7, 22, 2); // feathery antennae
		g.fillStyle(C('#2e2018'), 1).fillCircle(15.6, 7, 0.9).fillCircle(18.4, 7, 0.9);
	}),
	polyphemus: def(34, 28, (g) => {
		g.fillStyle(C('#c08b52'), 1);
		g.fillTriangle(17, 6, 2, 10, 14, 17).fillTriangle(17, 6, 32, 10, 20, 17); // forewings held flat
		g.fillStyle(C('#a97442'), 1);
		g.fillEllipse(9, 19, 15, 11).fillEllipse(25, 19, 15, 11); // hindwings
		g.fillStyle(C('#e0c295'), 1).fillRect(3, 9, 28, 1.4); // pale wing band
		g.fillStyle(C('#6b4a8a'), 1).fillCircle(9, 19, 4).fillCircle(25, 19, 4); // the big purple eyespots
		g.fillStyle(C('#f0e6d2'), 1).fillCircle(9, 19, 2.4).fillCircle(25, 19, 2.4);
		g.fillStyle(C('#241a12'), 1).fillCircle(9, 19, 1.1).fillCircle(25, 19, 1.1);
		g.fillStyle(C('#8a6238'), 1).fillEllipse(17, 15, 5, 15); // furry body
		g.lineStyle(1.6, C('#7a5a34'), 1).lineBetween(16, 7, 11, 3).lineBetween(18, 7, 23, 3); // big comb antennae
	}),
	parnassian: def(30, 26, (g) => {
		// The wings are near-transparent, which vanishes against the journal's pale
		// card — so they get a drawn edge to hold their shape.
		g.fillStyle(0xffffff, 0.88);
		g.fillEllipse(9, 11, 15, 13).fillEllipse(21, 11, 15, 13); // forewings
		g.fillEllipse(10, 18, 12, 10).fillEllipse(20, 18, 12, 10); // hindwings
		g.lineStyle(1.1, C('#6f6d66'), 1);
		g.strokeEllipse(9, 11, 15, 13).strokeEllipse(21, 11, 15, 13); // outline
		g.strokeEllipse(10, 18, 12, 10).strokeEllipse(20, 18, 12, 10);
		g.fillStyle(C('#4a4a48'), 1).fillEllipse(4, 8, 6, 3).fillEllipse(26, 8, 6, 3); // smoky wingtips
		g.fillStyle(C('#c8402f'), 1).fillCircle(9, 18, 2.4).fillCircle(21, 18, 2.4); // red warning spots
		g.fillStyle(0xffffff, 1).fillCircle(9, 18, 1).fillCircle(21, 18, 1);
		g.fillStyle(C('#3a3a38'), 1).fillEllipse(15, 14, 4, 14); // dark furry body
		g.lineStyle(1.1, C('#2e2e2c'), 1).lineBetween(14, 7, 10, 2).lineBetween(16, 7, 20, 2); // antennae
	}),
	ladybeetle: def(24, 22, (g) => {
		g.fillStyle(C('#1e1c1a'), 1).fillRect(4, 16, 2, 4).fillRect(11, 17, 2, 4).fillRect(18, 16, 2, 4); // six little legs
		g.fillStyle(C('#c8342b'), 1).fillCircle(12, 11, 9); // domed red shell
		g.fillStyle(C('#a8241d'), 1).fillRect(11.2, 3, 1.6, 17); // the split down the wing cases
		g.fillStyle(C('#1e1c1a'), 1);
		g.fillCircle(7, 8, 2).fillCircle(17, 8, 2).fillCircle(6, 14, 1.8).fillCircle(18, 14, 1.8).fillCircle(12, 16, 1.6); // spots
		g.fillStyle(C('#1e1c1a'), 1).fillEllipse(12, 3, 11, 6); // black head and pronotum
		g.fillStyle(0xffffff, 1).fillCircle(8, 2.6, 1.6).fillCircle(16, 2.6, 1.6); // the two white cheek patches
		g.fillStyle(C('#1e1c1a'), 1).fillCircle(9.6, 4.4, 0.9).fillCircle(14.4, 4.4, 0.9); // eyes
		g.lineStyle(1, C('#1e1c1a'), 1).lineBetween(9, 1, 6, -1).lineBetween(15, 1, 18, -1); // antennae
	}),
};

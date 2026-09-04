// The caretaker, built from their saved appearance.

import Phaser from 'phaser';
import { hatPalette } from '../../color';
import { flowerPalette } from '../../color';
import { C, tex } from './canvas';

/**
 * Build the player's sprite from their saved appearance — round and cozy,
 * matching the SVG preview in the character creator.
 */
export function makePlayerTexture(
	scene: Phaser.Scene,
	appearance:
		| {
				skin?: string;
				hair?: string;
				outfit?: string;
				hat?: string;
				hatColor?: string | null;
				hairstyle?: string;
				beard?: string;
				body?: string;
		  }
		| undefined,
	/** 'sit' is the same caretaker with their legs folded onto a seat — head,
	 *  hair, hat and face are drawn identically, so every appearance keeps
	 *  working without a second copy of any of it. */
	pose: 'stand' | 'sit' = 'stand',
): string {
	const a = {
		skin: appearance?.skin || '#eec39a',
		hair: appearance?.hair || '#6e4a33',
		outfit: appearance?.outfit || '#4a7c59',
		hat: appearance?.hat || 'none',
		hatColor: appearance?.hatColor || null,
		hairstyle: appearance?.hairstyle || 'short',
		beard: appearance?.beard || 'none',
		body: appearance?.body || 'slim',
	};
	const key =
		`player-${a.skin}-${a.hair}-${a.outfit}-${a.hat}-${a.hatColor || 'classic'}-${a.hairstyle}-${a.beard}-${a.body}${
			pose === 'sit' ? '-sit' : ''
		}`.replace(/#/g, '');
	tex(scene, key, 32, 36, (g) => {
		const skin = C(a.skin),
			hair = C(a.hair),
			outfit = C(a.outfit);
		const hp = hatPalette(a.hat, a.hatColor); // classic or custom-tinted hat tones
		const bw = a.body === 'round' ? 21 : 17; // body width by build
		// visor, halo and headphones sit above/beside the hair instead of covering it
		const bareHead =
			a.hat === 'none' || a.hat === 'halo' || a.hat === 'headphones' || a.hat === 'visor' || a.hat === 'cat-ears';
		// long styles fall behind the body
		if (a.hairstyle === 'long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
		}
		if (a.hairstyle === 'curly-long') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 20, 22);
			g.fillCircle(8, 22, 4).fillCircle(24, 22, 4).fillCircle(9, 27, 3.6).fillCircle(23, 27, 3.6).fillCircle(16, 29, 4);
		}
		if (a.hairstyle === 'ponytail') {
			g.fillStyle(hair, 1).fillEllipse(22, 11, 7, 8).fillEllipse(25, 20, 7, 14);
		}
		if (a.hairstyle === 'pigtails') {
			g.fillStyle(hair, 1)
				.fillEllipse(8, 11, 6, 7)
				.fillEllipse(6, 19, 6, 12)
				.fillEllipse(24, 11, 6, 7)
				.fillEllipse(26, 19, 6, 12);
		}
		if (a.hairstyle === 'afro') {
			g.fillStyle(hair, 1).fillCircle(16, 11, 11.5);
		}
		if (a.hairstyle === 'bob') {
			g.fillStyle(hair, 1).fillEllipse(9.5, 14, 6.5, 11).fillEllipse(22.5, 14, 6.5, 11);
		}
		if (a.hairstyle === 'braid') {
			g.fillStyle(hair, 1).fillEllipse(22.5, 11.5, 6, 7);
			g.fillCircle(24.5, 16.5, 3.2).fillCircle(25.5, 21, 2.9).fillCircle(26, 25, 2.5);
			g.fillStyle(C('#c9913f'), 1).fillRect(24.7, 27, 2.6, 1.4);
		}
		if (a.hairstyle === 'wavy') {
			g.fillStyle(hair, 1).fillEllipse(16, 18, 21, 23);
			g.fillCircle(6, 23, 3.4).fillCircle(26, 23, 3.4);
		}
		if (a.hairstyle === 'double-braid') {
			g.fillStyle(hair, 1).fillEllipse(9.5, 11.5, 6, 7).fillEllipse(22.5, 11.5, 6, 7);
			g.fillCircle(7.5, 16.5, 3.2).fillCircle(6.5, 21, 2.9).fillCircle(6, 25, 2.5);
			g.fillCircle(24.5, 16.5, 3.2).fillCircle(25.5, 21, 2.9).fillCircle(26, 25, 2.5);
			g.fillStyle(C('#c9913f'), 1).fillRect(4.7, 27, 2.6, 1.4).fillRect(24.7, 27, 2.6, 1.4);
		}
		if (a.hairstyle === 'half-up') {
			g.fillStyle(hair, 1).fillEllipse(16, 18.4, 20.6, 23.6);
		}
		if (a.hairstyle === 'shag') {
			g.fillStyle(hair, 1).fillEllipse(16, 15.4, 21.4, 17.6);
			g.fillTriangle(6.2, 12.8, 4, 19.6, 9.4, 17.2);
			g.fillTriangle(25.8, 12.8, 28, 19.6, 22.6, 17.2);
		}
		if (a.hairstyle === 'dreads') {
			g.fillStyle(hair, 1).fillEllipse(9, 11.5, 5.5, 6.5).fillEllipse(23, 11.5, 5.5, 6.5);
			g.fillRoundedRect(5.6, 11.5, 2.2, 12, 1.1)
				.fillRoundedRect(8.2, 13, 2.2, 10, 1.1)
				.fillRoundedRect(21.6, 13, 2.2, 10, 1.1)
				.fillRoundedRect(24.2, 11.5, 2.2, 12, 1.1);
		}
		if (pose === 'sit') {
			// Seated: the torso settles a little, the legs fold forward into a lap
			// wider than the body, the hands come to rest on it and the boots hang
			// below. Everything above the shoulders is drawn exactly as it is when
			// standing, so hats, hair and faces need no seated versions of their own.
			g.fillStyle(outfit, 1).fillRoundedRect(16 - bw / 2 - 1, 25.5, bw + 2, 7.5, 3.6); // lap
			g.fillStyle(outfit, 1).fillEllipse(16, 23, bw, 13); // torso
			g.fillStyle(0xffffff, 0.14).fillEllipse(16, 20.6, bw - 6, 6);
			g.fillStyle(0xffffff, 0.09).fillEllipse(16, 27, bw - 3, 3.2); // light across the knees
			g.fillStyle(0x000000, 0.12).fillRect(15.4, 26.4, 1.2, 6); // the groove between the knees
			g.fillStyle(skin, 1)
				.fillCircle(16 - bw / 2 + 2.4, 28, 2.2)
				.fillCircle(16 + bw / 2 - 2.4, 28, 2.2); // hands on the lap
			g.fillStyle(C('#5d4a36'), 1).fillEllipse(13, 34.4, 5.6, 3.6).fillEllipse(19, 34.4, 5.6, 3.6); // boots, hanging
		} else {
			// body
			g.fillStyle(outfit, 1).fillEllipse(16, 25, bw, 16);
			g.fillStyle(0xffffff, 0.14).fillEllipse(16, 22, bw - 6, 7);
			// boots
			g.fillStyle(C('#5d4a36'), 1).fillEllipse(12, 33, 6, 4).fillEllipse(20, 33, 6, 4);
		}
		// head
		g.fillStyle(skin, 1).fillCircle(16, 12, 8.4);
		// hairstyle fringe / volume
		g.fillStyle(hair, 1);
		if (a.hairstyle === 'curly' || a.hairstyle === 'curly-long') {
			g.fillCircle(10, 8, 4).fillCircle(15, 6, 4.4).fillCircle(21, 8, 4).fillCircle(8, 12, 3).fillCircle(24, 12, 3);
		} else if (a.hairstyle === 'afro') {
			g.fillCircle(10, 7, 4.4)
				.fillCircle(15, 5, 4.8)
				.fillCircle(21, 7, 4.4)
				.fillCircle(7, 12, 3.4)
				.fillCircle(25, 12, 3.4);
		} else if (a.hairstyle === 'mohawk') {
			g.fillTriangle(12.5, 9, 14, 1.5, 15.5, 9);
			g.fillTriangle(15, 9, 16, 0, 17, 9);
			g.fillTriangle(16.5, 9, 18, 1.5, 19.5, 9);
		} else if (a.hairstyle === 'spiky') {
			g.fillEllipse(16, 7, 15, 6.4);
			g.fillTriangle(9.5, 6, 11.2, 1.6, 13, 6);
			g.fillTriangle(12.5, 6, 14.6, 0.2, 16.6, 6);
			g.fillTriangle(16, 6, 18, 0.8, 20, 6);
			g.fillTriangle(19.4, 6, 21.4, 2, 23, 6);
		} else if (a.hairstyle === 'pixie') {
			g.fillEllipse(16, 7.2, 16.4, 7.2);
			g.fillTriangle(9.4, 9.4, 20.4, 6.6, 20.4, 9.8);
		} else if (a.hairstyle === 'cornrows') {
			g.lineStyle(1.4, hair, 1);
			g.lineBetween(9.4, 9.6, 12.8, 4.2)
				.lineBetween(12.2, 9.2, 14.6, 3.8)
				.lineBetween(14.6, 9, 15.8, 3.6)
				.lineBetween(17.4, 9, 16.2, 3.6)
				.lineBetween(19.8, 9.2, 17.4, 3.8)
				.lineBetween(22.6, 9.6, 19.2, 4.2);
		} else if (a.hairstyle === 'shag') {
			g.fillEllipse(16, 7.4, 16.8, 8);
			g.fillTriangle(11, 10.6, 12.6, 6.6, 14.2, 10.6);
			g.fillTriangle(17.8, 10.6, 19.4, 6.6, 21, 10.6);
		} else if (a.hairstyle === 'bowl') {
			g.fillEllipse(16, 7, 16, 8);
			g.fillRect(8, 7, 16, 2);
		} else if (a.hairstyle === 'dreads') {
			g.fillEllipse(16, 7.4, 15, 7);
			g.fillRoundedRect(9.4, 3.4, 2, 5, 1)
				.fillRoundedRect(12.4, 2.2, 2, 6, 1)
				.fillRoundedRect(15.4, 1.8, 2, 6.4, 1)
				.fillRoundedRect(18.4, 2.4, 2, 6, 1)
				.fillRoundedRect(21.2, 3.6, 2, 5, 1);
		} else if (a.hairstyle === 'bald') {
			// no hair at all
		} else {
			g.fillEllipse(16, 7.4, 15, 7);
		}
		if (a.hairstyle === 'bun' && bareHead) {
			g.fillStyle(hair, 1).fillCircle(16, 2.4, 4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13, 4.6, 6, 1.6);
		}
		if (a.hairstyle === 'wavy') {
			g.fillStyle(hair, 1).fillEllipse(8.8, 15.6, 3.2, 15).fillEllipse(23.2, 15.6, 3.2, 15);
		}
		if (a.hairstyle === 'half-up' && bareHead) {
			g.fillStyle(hair, 1).fillEllipse(16, 3.4, 5.4, 4.4);
			g.fillStyle(C('#c9913f'), 1).fillRect(13.6, 5.4, 4.8, 1.4);
		}
		if (a.hairstyle === 'space-buns' && bareHead) {
			g.fillStyle(hair, 1).fillCircle(9.5, 5.8, 3.6).fillCircle(22.5, 5.8, 3.6);
		}
		// beard (always the hair color): a soft, short jaw wrap
		if (a.beard === 'beard') {
			g.fillStyle(hair, 1).fillEllipse(16, 17.6, 13, 7);
			g.fillStyle(hair, 1).fillEllipse(13.9, 15.8, 3.8, 1.8).fillEllipse(18.1, 15.8, 3.8, 1.8);
		}
		// face
		g.fillStyle(0x3b2e25, 1).fillCircle(13, 13, 1.2).fillCircle(19, 13, 1.2);
		if (a.beard !== 'beard') {
			g.fillStyle(0xe88888, 0.4).fillCircle(10.6, 15.2, 1.5).fillCircle(21.4, 15.2, 1.5);
		}
		// bare-head hair volume — drawn before the hats so a visor, halo or
		// headphones, which don't cover the crown, still layer on top of it
		if (
			bareHead &&
			![
				'bun',
				'curly',
				'curly-long',
				'afro',
				'mohawk',
				'bald',
				'spiky',
				'bowl',
				'dreads',
				'pixie',
				'cornrows',
				'shag',
			].includes(a.hairstyle)
		) {
			g.fillStyle(hair, 1).fillEllipse(16, 5.6, 14, 7);
		}
		// hats — tones come from hatPalette so a custom hatColor recolors every hat
		if (a.hat === 'straw') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7, 21, 6);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 4, 11, 6);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(10, 6.5, 22, 6.5);
		} else if (a.hat === 'leaf') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 5, 17, 6);
			g.lineStyle(1.2, C(hp.line), 1).lineBetween(9, 5.5, 23, 4);
		} else if (a.hat === 'beanie') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 5.6, 16, 8);
			g.fillStyle(C(hp.b), 1).fillRect(8, 7, 16, 2.4);
			g.fillStyle(C('#e8d8c8'), 1).fillCircle(16, 1.8, 2);
		} else if (a.hat === 'cap') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6, 16, 11);
			g.fillStyle(C(hp.b), 1).fillEllipse(23, 8.4, 13, 4);
		} else if (a.hat === 'bucket') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6, 15, 10);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 9.2, 20, 4);
		} else if (a.hat === 'flower') {
			g.lineStyle(2, C('#5d8a4a'), 1).lineBetween(9, 7.6, 23, 7.6);
			const fc = flowerPalette(a.hatColor); // blooms hue-rotate together
			[10, 16, 22].forEach((x, i) => {
				g.fillStyle(C(fc[i]), 1).fillCircle(x, 6.6, 1.9);
				g.fillStyle(C('#fff3c4'), 1).fillCircle(x, 6.6, 0.8);
			});
		} else if (a.hat === 'party') {
			g.fillStyle(C(hp.a), 1).fillTriangle(16, -0.5, 11.5, 8.5, 20.5, 8.5);
			g.fillStyle(C(hp.b), 1).fillTriangle(16, 2.5, 14, 6.5, 18, 6.5);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(16, 0.4, 1.5);
		} else if (a.hat === 'ranger') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7, 23, 5);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 3.8, 10.5, 6.5);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(11, 6.5, 21, 6.5);
		} else if (a.hat === 'acorn') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.4, 16.8, 7.6);
			g.lineStyle(0.8, C(hp.line), 0.55);
			g.lineBetween(12.6, 2.8, 11.4, 8.6).lineBetween(16, 2.5, 16, 8.8).lineBetween(19.4, 2.8, 20.6, 8.6);
			g.lineStyle(1.3, C(hp.line), 1).lineBetween(16, 2.4, 16, 0.2);
			g.fillStyle(C(hp.b), 1).fillCircle(16, 0.2, 0.9);
		} else if (a.hat === 'beret') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16.4, 5.6, 18.6, 8);
			g.fillStyle(C(hp.line), 1).fillEllipse(15.6, 8.6, 15, 2.6);
			g.fillStyle(C(hp.b), 1).fillCircle(15, 2.2, 1.1);
		} else if (a.hat === 'mushroom') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 4.6, 18, 8.5);
			g.fillStyle(C(hp.line), 1).fillEllipse(16, 8, 13, 2.4);
			g.fillStyle(C('#f6efe3'), 1)
				.fillCircle(13, 3.2, 1.2)
				.fillCircle(18.5, 2.6, 1.4)
				.fillCircle(20.5, 5.4, 0.9)
				.fillCircle(14.5, 5.8, 0.8);
		} else if (a.hat === 'wizard') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 8, 19, 4.5);
			g.fillStyle(C(hp.b), 1).fillTriangle(16.8, -3, 10.5, 8, 21.8, 8);
			g.lineStyle(1.5, C(hp.line), 1).lineBetween(11.5, 7.5, 20.5, 7.5);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(17.8, 2.5, 1);
		} else if (a.hat === 'crown') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 10, y: 8 },
					{ x: 10, y: 3 },
					{ x: 12.5, y: 5.5 },
					{ x: 16, y: 1.2 },
					{ x: 19.5, y: 5.5 },
					{ x: 22, y: 3 },
					{ x: 22, y: 8 },
				],
				true,
			);
			g.fillStyle(C(hp.line), 1).fillRect(10, 7, 12, 1.4);
			g.fillStyle(C('#c0503f'), 1).fillCircle(16, 6, 0.9);
			g.fillStyle(C('#3f6fa8'), 1).fillCircle(12.8, 6.4, 0.7).fillCircle(19.2, 6.4, 0.7);
		} else if (a.hat === 'bandana') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.5, 17, 8.5);
			g.lineStyle(1, C(hp.line), 0.6).lineBetween(10.5, 7.5, 21.5, 7.5);
			g.fillStyle(C(hp.a), 1).fillTriangle(23, 7.5, 27, 9.5, 23.5, 11);
			g.fillStyle(C(hp.b), 1).fillTriangle(23.5, 10, 26, 13.5, 22.5, 12.5);
			g.fillStyle(0xffffff, 0.55);
			g.fillCircle(13.5, 4.5, 0.6).fillCircle(18.5, 4.5, 0.6).fillCircle(16, 3, 0.6);
		} else if (a.hat === 'tophat') {
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 7.6, 23, 4);
			g.fillStyle(C(hp.a), 1).fillRoundedRect(10.8, -1, 10.4, 8.8, 1.2);
			g.fillStyle(C(hp.line), 1).fillRect(11, 4.4, 10, 2);
			g.fillStyle(C('#f4e08a'), 1).fillCircle(19.2, 5.4, 0.6);
		} else if (a.hat === 'chef') {
			g.fillStyle(C(hp.b), 1).fillCircle(11.5, 3.4, 4).fillCircle(16, 1.6, 4.6).fillCircle(20.5, 3.4, 4);
			g.fillStyle(C(hp.a), 1).fillRect(10, 4, 12, 4.6);
			g.lineStyle(1, C(hp.line), 1).lineBetween(10, 7.6, 22, 7.6);
		} else if (a.hat === 'pirate') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 2.4, y: 8.6 },
					{ x: 5, y: 2.4 },
					{ x: 9.2, y: -0.4 },
					{ x: 12.6, y: 2.6 },
					{ x: 16, y: 3 },
					{ x: 19.4, y: 2.6 },
					{ x: 22.8, y: -0.4 },
					{ x: 27, y: 2.4 },
					{ x: 29.6, y: 8.6 },
					{ x: 22.8, y: 7.6 },
					{ x: 16, y: 7.4 },
					{ x: 9.2, y: 7.6 },
				],
				true,
			);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 9, 27.2, 3.4);
			g.fillStyle(C('#f6efe3'), 1).fillCircle(16, 4.4, 1.8);
			g.fillStyle(C(hp.a), 1).fillCircle(15.4, 4.2, 0.5).fillCircle(16.6, 4.2, 0.5);
		} else if (a.hat === 'witch') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 7.4, 24.8, 6);
			g.fillStyle(C(hp.b), 1).fillTriangle(21.6, -6.4, 11.6, 7.4, 20.4, 7.4);
			g.fillStyle(C(hp.line), 1).fillRect(12, 5.2, 8.4, 2.2);
			g.fillStyle(C('#e0b23e'), 1).fillRect(14.8, 5.5, 2.2, 1.6);
		} else if (a.hat === 'newspaper') {
			g.fillStyle(C(hp.a), 1).fillPoints(
				[
					{ x: 6, y: 8.4 },
					{ x: 6, y: 3.2 },
					{ x: 16, y: -0.8 },
					{ x: 26, y: 3.2 },
					{ x: 26, y: 8.4 },
				],
				true,
			);
			g.lineStyle(0.8, C(hp.line), 0.75).lineBetween(9, 4, 23, 4).lineBetween(8.5, 5.8, 23.5, 5.8);
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 8.4, 21.6, 3.6);
		} else if (a.hat === 'frog') {
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.4, 16.8, 7.6).fillCircle(10.8, 1.8, 3).fillCircle(21.2, 1.8, 3);
			g.fillStyle(C('#fdf6e8'), 1).fillCircle(10.8, 1.4, 1.9).fillCircle(21.2, 1.4, 1.9);
			g.fillStyle(C('#2b2b2b'), 1).fillCircle(10.8, 1.7, 0.95).fillCircle(21.2, 1.7, 0.95);
		} else if (a.hat === 'cat-ears') {
			g.fillStyle(C(hp.a), 1);
			g.fillTriangle(9.2, 6.8, 10.6, -0.8, 15.8, 5);
			g.fillTriangle(22.8, 6.8, 21.4, -0.8, 16.2, 5);
			g.fillStyle(C('#e8a0b0'), 1);
			g.fillTriangle(10.7, 5.4, 11.4, 1.6, 14, 4.4);
			g.fillTriangle(21.3, 5.4, 20.6, 1.6, 18, 4.4);
		} else if (a.hat === 'visor') {
			g.fillStyle(C(hp.b), 1).fillEllipse(16, 7.6, 22, 4.4);
			g.fillStyle(C(hp.a), 1).fillEllipse(16, 6.3, 16, 4.6);
			g.lineStyle(1, C(hp.line), 0.7).lineBetween(10.5, 6.4, 21.5, 6.4);
		} else if (a.hat === 'halo') {
			g.lineStyle(1.6, C(hp.a), 1).strokeEllipse(16, 1.8, 13, 4);
			g.fillStyle(C('#fff3c4'), 1).fillCircle(21.5, 0.6, 0.7);
		} else if (a.hat === 'headphones') {
			g.fillStyle(C(hp.a), 1)
				.fillRoundedRect(6.2, 3, 19.6, 2.2, 1.1)
				.fillRoundedRect(6.2, 4, 2, 5.4, 1)
				.fillRoundedRect(23.8, 4, 2, 5.4, 1);
			g.fillStyle(C(hp.b), 1).fillRoundedRect(5.3, 8.6, 4.4, 7, 2).fillRoundedRect(22.3, 8.6, 4.4, 7, 2);
			g.fillStyle(C(hp.line), 1).fillRoundedRect(6.5, 10.4, 2, 3.4, 1).fillRoundedRect(23.5, 10.4, 2, 3.4, 1);
		}
	});
	return key;
}

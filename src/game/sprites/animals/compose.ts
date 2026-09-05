// Build a distinctive sprite for ANY animal from its species traits, so every
// creature reads as itself rather than as one of a few shared silhouettes.
//
// This is what covers the long tail: 150 species in the data, 66 of them drawn
// by hand. Everything else is composed here from what the data says it IS.

import Phaser from 'phaser';
import { C, hexOf } from '../canvas';
import type { G } from '../canvas';

export const GENERIC_KINDS = ['mammal', 'bird', 'insect', 'reptile', 'amphibian', 'fish'];

/** A soft, natural-looking colour unique to each animal id. */
export function animalTint(hash: number): number {
	const h = (hash % 360) / 360;
	const s = 0.34 + ((hash >> 4) % 30) / 100; // 0.34 .. 0.63
	const v = 0.62 + ((hash >> 9) % 24) / 100; // 0.62 .. 0.85
	const c = Phaser.Display.Color.HSVToRGB(h, s, v) as any;
	return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/**
 * Compose a distinctive sprite for ANY animal from its species traits, so every
 * creature reads as itself rather than one of a few shared silhouettes. The body
 * is drawn in white (so it picks up the animal's unique tint), with fixed-colour
 * features layered on — quills for a porcupine, antlers for a deer, long legs for
 * a heron, a domed shell for a turtle, and so on. Works for both the Phaser
 * texture and the SVG journal thumbnail (shared drawing API), and collapses to a
 * clean silhouette when drawn in silhouette mode.
 */
export function composeAnimalDraw(id: string, kind: string): { w: number; h: number; draw: (g: G) => void } {
	const t = (re: RegExp) => re.test(id);
	const BODY = 0xffffff; // tintable body colour
	const DK = 0x2e2018; // eyes / dark detail
	const draw = (fn: (g: G) => void) => fn;

	// --- Producers and decomposers ---------------------------------------------
	// Plants, fungi, lichens and seaweeds are living things in the journal, so they
	// need to read as themselves. Without this they fall through to the generic
	// quadruped and a mushroom arrives looking like a small brown animal.
	if (kind === 'plant' || kind === 'fungus' || kind === 'lichen' || kind === 'algae') {
		// Mushrooms and bracket fungi: cap, stem, gills.
		if (kind === 'fungus') {
			const bracket = t(/turkey-tail|shelf|bracket/);
			return {
				w: 30,
				h: 28,
				draw: draw((g) => {
					if (bracket) {
						g.fillStyle(C('#6b543a'), 1).fillRect(3, 4, 4, 22); // trunk it grows on
						for (const [y, w] of [
							[8, 18],
							[14, 15],
							[20, 12],
						] as [number, number][]) {
							g.fillStyle(C('#c8a86a'), 1).fillEllipse(7 + w / 2, y, w, 7);
							g.fillStyle(C('#e0cba0'), 1).fillEllipse(7 + w / 2, y - 1, w - 5, 3.5);
						}
						return;
					}
					g.fillStyle(C('#e8dcc2'), 1).fillRect(13, 13, 5, 12); // stem
					g.fillStyle(C('#d8c8a8'), 1).fillRect(13, 13, 2, 12);
					g.fillStyle(C('#efe3c8'), 1).fillEllipse(15.5, 15, 17, 5); // gills under the cap
					g.lineStyle(0.8, C('#c9b691'), 1);
					for (const x of [9, 12, 15, 19, 22]) g.lineBetween(x, 13.5, x, 16.5);
					g.fillStyle(C(t(/mushroom|agaricus|meadow/) ? '#c9805c' : '#a8683f'), 1).fillEllipse(15.5, 11, 24, 15); // cap
					g.fillStyle(0xffffff, 0.22).fillEllipse(11, 8, 10, 5); // highlight
					g.fillStyle(C('#8f5136'), 1).fillEllipse(15.5, 15, 24, 3.5); // cap rim shadow
				}),
			};
		}
		// Lichen: crusty rosette clinging to a pebble.
		if (kind === 'lichen') {
			return {
				w: 28,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 14, 24, 14); // rock
					g.fillStyle(C('#a8a29a'), 1).fillEllipse(10, 11, 10, 6);
					g.fillStyle(C('#9fb38a'), 1).fillCircle(11, 12, 5).fillCircle(19, 14, 4).fillCircle(15, 8, 3.2);
					g.fillStyle(C('#c9d98f'), 1).fillCircle(11, 12, 3).fillCircle(19, 14, 2.2);
					g.fillStyle(C('#5f6b4a'), 1).fillCircle(11, 12, 1).fillCircle(19, 14, 0.9); // dark centres
				}),
			};
		}
		// Kelp and seaweed: long blades rising from a holdfast, with floats.
		if (kind === 'algae' || t(/kelp|seaweed|surfgrass|eelgrass/)) {
			return {
				w: 26,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(C('#3f5c33'), 1).fillEllipse(13, 31, 14, 6); // holdfast
					g.lineStyle(2.2, C('#4f7a3f'), 1);
					g.lineBetween(13, 30, 10, 4);
					g.lineBetween(13, 30, 17, 8);
					for (const [x, y, w2, h2] of [
						[7, 10, 9, 5],
						[19, 14, 9, 5],
						[6, 19, 8, 4],
						[20, 23, 8, 4],
					] as [number, number, number, number][])
						g.fillStyle(C('#6d9a4e'), 1).fillEllipse(x, y, w2, h2); // blades
					g.fillStyle(C('#b7cf7a'), 1).fillCircle(10, 5, 3).fillCircle(17, 9, 2.4); // gas floats
				}),
			};
		}
		// Columnar cactus.
		if (t(/saguaro|cactus|cholla|prickly/)) {
			return {
				w: 28,
				h: 36,
				draw: draw((g) => {
					g.fillStyle(C('#4f7a44'), 1).fillRect(11, 6, 8, 28); // trunk
					g.fillEllipse(15, 7, 8, 7);
					g.fillRect(4, 18, 5, 10).fillEllipse(6.5, 18, 5, 5); // arms
					g.fillRect(21, 14, 5, 12).fillEllipse(23.5, 14, 5, 5);
					g.fillStyle(C('#3f6437'), 1).fillRect(13, 6, 1.6, 28); // ribs
					g.fillStyle(C('#f2ead6'), 1).fillCircle(15, 5, 3).fillCircle(6.5, 16, 2); // blossoms
				}),
			};
		}
		// Trees.
		if (t(/oak|hemlock|pine|willow|cypress|fir|aspen|tree/)) {
			const conifer = t(/hemlock|pine|fir|cypress/);
			return {
				w: 32,
				h: 36,
				draw: draw((g) => {
					g.fillStyle(C('#6b543a'), 1).fillRect(14, 20, 5, 15); // trunk
					if (conifer) {
						g.fillStyle(C('#3f6b46'), 1);
						g.fillTriangle(16, 2, 5, 17, 27, 17);
						g.fillTriangle(16, 10, 3, 26, 29, 26);
						g.fillStyle(C('#4f7f55'), 1).fillTriangle(16, 6, 8, 16, 24, 16);
					} else {
						g.fillStyle(C('#4f8043'), 1).fillCircle(16, 14, 13);
						g.fillStyle(C('#5f9450'), 1).fillCircle(11, 11, 7).fillCircle(21, 13, 6);
						g.fillStyle(C('#3e6a37'), 1).fillCircle(19, 19, 5);
					}
				}),
			};
		}
		// Cattail / reed / rush: blades with a brown spike.
		if (t(/cattail|reed|rush|bulrush/)) {
			return {
				w: 26,
				h: 36,
				draw: draw((g) => {
					g.lineStyle(2, C('#6f9a4e'), 1);
					g.lineBetween(8, 35, 5, 10);
					g.lineBetween(18, 35, 21, 12);
					g.lineBetween(13, 35, 13, 6);
					g.fillStyle(C('#7d5a3a'), 1).fillEllipse(13, 9, 6, 13); // the sausage
					g.fillStyle(C('#946c46'), 1).fillEllipse(12, 7, 3, 7);
					g.lineStyle(1.6, C('#8fae63'), 1).lineBetween(13, 4, 13, 0); // tip
				}),
			};
		}
		// Grasses and low turf: a tuft of blades with seed heads.
		if (t(/grama|grass|sedge|turf|muhly|campion|moss/)) {
			return {
				w: 30,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.8, C('#7fa34e'), 1);
					for (const [x, tipx] of [
						[7, 3],
						[11, 9],
						[15, 15],
						[19, 22],
						[23, 27],
					] as [number, number][])
						g.lineBetween(x, 25, tipx, 5);
					g.fillStyle(C('#c3b06a'), 1);
					for (const [x, y] of [
						[3, 5],
						[9, 4],
						[22, 6],
					] as [number, number][])
						g.fillEllipse(x, y, 7, 3); // seed heads
					g.fillStyle(C('#5f7f3c'), 1).fillEllipse(15, 25, 22, 5); // base
				}),
			};
		}
		// Default flowering plant: stem, leaves, a cluster of blooms.
		const petal = t(/milkweed/) ? '#d98cae' : t(/sunflower|marigold|arnica/) ? '#e8bf3f' : '#c98fd0';
		return {
			w: 28,
			h: 34,
			draw: draw((g) => {
				g.lineStyle(2, C('#5f8a44'), 1).lineBetween(14, 33, 14, 10);
				g.fillStyle(C('#6d9a4e'), 1).fillEllipse(7, 22, 12, 6).fillEllipse(21, 26, 12, 6); // leaves
				g.fillStyle(C(petal), 1);
				g.fillCircle(14, 9, 6).fillCircle(8, 13, 4).fillCircle(20, 13, 4); // bloom cluster
				g.fillStyle(C('#f2e6c0'), 1).fillCircle(14, 9, 2.4);
			}),
		};
	}

	if (kind === 'mammal') {
		if (t(/porcupine|hedgehog/)) {
			return {
				w: 38,
				h: 30,
				draw: draw((g) => {
					// Compact, low-slung body so it reads as cute and recognizable in thumbnails.
					g.fillStyle(C('#3a2c1e'), 1);

					const quills: [number, number, number, number, number, number][] = [
						[6, 16, 8, 8, 10, 16],
						[9, 15, 11, 6, 13, 15],
						[12, 14, 14, 7, 16, 14],
						[15, 14, 17, 5, 19, 14],
						[18, 14, 20, 7, 22, 14],
						[21, 15, 23, 8, 25, 15],
						[24, 16, 26, 10, 28, 16],
					];

					for (const [x1, y1, x2, y2, x3, y3] of quills) g.fillTriangle(x1, y1, x2, y2, x3, y3);

					// Tail + body.
					g.fillStyle(C('#4a3828'), 1).fillEllipse(6, 20, 8, 5);
					g.fillStyle(BODY, 1).fillEllipse(18, 18, 25, 14);
					g.fillCircle(30, 16, 5.6);

					// Tiny legs.
					g.fillRect(12, 24, 3.2, 4.5).fillRect(23, 24, 3.2, 4.5);

					// Face details.
					g.fillStyle(C('#3a2c1e'), 1).fillCircle(35, 17, 1.6);
					g.fillStyle(DK, 1).fillCircle(31, 14, 1.1);
					g.fillStyle(BODY, 1).fillCircle(28, 11, 2.2);

					// Soft quill highlights for readability at small sizes.
					g.lineStyle(1.1, C('#d8c49a'), 0.75);
					g.lineBetween(10, 15, 12, 9).lineBetween(16, 14, 18, 8).lineBetween(22, 15, 24, 10);
				}),
			};
		}

		// Fixed natural accent colours layered over the tintable body.
		const NOSE = 0x1a1410;

		// --- Cetaceans: smooth spindle body, flukes, dorsal fin, a flipper ---
		if (t(/whale|dolphin|porpoise/)) {
			const dolphin = t(/dolphin|porpoise/);
			return {
				w: 42,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(21, 12, 32, 13); // spindle body
					g.fillTriangle(2, 5, 10, 12, 2, 12); // upper fluke
					g.fillTriangle(2, 19, 10, 12, 2, 12); // lower fluke
					g.fillTriangle(19, 5, 24, 12, 14, 12); // dorsal fin
					g.fillTriangle(23, 15, 31, 15, 24, 21); // pectoral flipper
					if (dolphin)
						g.fillTriangle(35, 10, 42, 12, 35, 14); // rostrum/beak
					else {
						g.fillStyle(0x000000, 0.12).fillEllipse(24, 9, 22, 5);
					} // mottled back
					g.fillStyle(0xffffff, 0.28).fillEllipse(20, 16, 22, 5); // pale belly
					g.fillStyle(DK, 1).fillCircle(dolphin ? 33 : 32, 10, 1.1);
				}),
			};
		}
		// --- Seals: plump torpedo, fore-flippers, rear-flipper V, dog-like head ---
		if (t(/seal|sea-lion|walrus/)) {
			return {
				w: 38,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillTriangle(2, 8, 11, 14, 2, 15).fillTriangle(2, 20, 11, 14, 2, 15); // rear flippers
					g.fillEllipse(19, 15, 30, 15); // body
					g.fillCircle(31, 11, 5.4); // head
					g.fillEllipse(35, 12, 5, 4); // snout
					g.fillTriangle(16, 22, 24, 17, 25, 24); // fore-flipper
					if (t(/harbor|spotted/)) {
						g.fillStyle(0x000000, 0.22);
						for (const [x, y] of [
							[12, 11],
							[18, 13],
							[24, 11],
							[15, 17],
							[22, 16],
						] as const)
							g.fillCircle(x, y, 1.3);
					}
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1);
					g.fillStyle(DK, 1).fillCircle(31, 10, 1.2);
				}),
			};
		}
		// --- Otters (river & sea): long-bodied, four short legs, thick tapering
		//     tail — walking, since they move around on land and in water ---
		if (t(/otter/)) {
			const sea = t(/sea-otter/);
			return {
				w: 40,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 16, 17, 8); // thick tapering tail
					g.fillRect(13, 18, 3.6, 6).fillRect(19, 18, 3.6, 6).fillRect(25, 18, 3.6, 6).fillRect(30, 18, 3.6, 6); // four legs
					g.fillEllipse(21, 14, 28, sea ? 15 : 13); // long low body (sea otter bulkier)
					g.fillCircle(33, 11, 5.2); // rounded head
					g.fillCircle(30, 6.5, 1.8).fillCircle(35.5, 6.5, 1.8); // small round ears
					g.fillStyle(C('#e8dcc6'), 0.55).fillEllipse(33, 13, 7, 5); // pale muzzle/throat
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
					g.fillStyle(DK, 1).fillCircle(33, 10, 1.2);
				}),
			};
		}
		// --- American badger: low broad body, short digging legs, and the
		//     signature face — white median stripe over a black-masked face ---
		if (t(/badger/)) {
			return {
				w: 40,
				h: 26,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(9, 17, 4, 8).fillRect(15, 17, 4, 8).fillRect(23.5, 17, 3.6, 8).fillRect(29, 17, 3.6, 8); // short sturdy legs, tucked under the body
					g.fillEllipse(18, 13, 32, 15); // broad, low, flat-backed body
					g.fillStyle(0xffffff, 0.14).fillEllipse(16, 9, 25, 7); // grizzled sheen along the back
					g.fillStyle(BODY, 1);
					g.fillCircle(31, 13, 5.4); // head (small, held low & forward)
					g.fillTriangle(35, 11, 39, 14, 35, 17); // pointed snout
					g.fillCircle(28, 8, 1.9); // small ear
					// face: a round dark cheek badge with a white eye-spot inside it,
					// plus the white median stripe running from the crown to the nose
					g.fillStyle(C('#2b2620'), 1).fillCircle(32, 14, 4.8); // dark cheek badge
					g.fillStyle(C('#f4efe6'), 1);
					g.fillTriangle(27, 7, 29.5, 7, 38, 13).fillTriangle(29.5, 7, 38, 13, 36.5, 14.5); // white median stripe
					g.fillCircle(32.2, 13.6, 1.9); // white eye-spot inside the badge
					g.fillStyle(DK, 1).fillCircle(32.7, 13.6, 0.95); // pupil
					g.fillStyle(C('#efe7d6'), 1)
						.fillTriangle(23.7, 24.8, 27, 24.8, 25.3, 26)
						.fillTriangle(29, 24.8, 32.4, 24.8, 30.7, 26); // long front digging claws
					g.fillStyle(NOSE, 1).fillCircle(38.5, 13.5, 1.1); // nose
				}),
			};
		}
		// --- Minks, weasels, marten, fisher, ermine:
		//     long low sinuous body, short legs, small round ears ---
		if (t(/mink|weasel|ermine|marten|fisher|ferret|stoat/)) {
			const arch = t(/marten|fisher/); // martens sit with an arched back
			return {
				w: 40,
				h: 22,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(7, 15, 14, 7); // thick tapering tail
					g.fillRect(12, 16, 3, 6).fillRect(20, 16, 3, 6).fillRect(27, 16, 3, 6); // short legs
					if (arch) {
						g.fillEllipse(13, 12, 16, 10).fillEllipse(24, 13, 14, 11);
					} // arched back
					else g.fillEllipse(19, 14, 28, 11); // long tube body
					g.fillCircle(32, 11, 4.6); // small head
					g.fillCircle(29.5, 6.5, 1.7).fillCircle(34, 6.5, 1.7); // round ears
					if (t(/ermine|stoat|weasel/)) {
						g.fillStyle(0x111111, 1).fillEllipse(4, 15, 6, 5);
					} // black tail tip
					if (arch) {
						g.fillStyle(C('#e0a24a'), 1).fillEllipse(30, 15, 7, 4);
					} // throat bib
					g.fillStyle(NOSE, 1).fillCircle(35, 11, 1);
					g.fillStyle(DK, 1).fillCircle(32, 10, 1.2);
				}),
			};
		}
		// --- Deer / elk / moose: long legs, raised neck, big ears, antlers ---
		if (t(/deer|elk|moose|caribou|pronghorn/)) {
			const big = t(/elk|moose/);
			return {
				w: 40,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(11, 24, 3.4, 9).fillRect(17, 24, 3.4, 9).fillRect(24, 24, 3.4, 9).fillRect(29, 24, 3.4, 9); // 4 long legs
					g.fillEllipse(20, 19, 26, 14); // deep body
					g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 17, 7, 9); // pale rump patch
					g.fillStyle(BODY, 1);
					g.fillTriangle(28, 20, 33, 20, 31, 9); // raised neck
					g.fillCircle(32, 9, 4.4); // head
					g.fillEllipse(34, 11, 6, 3.4); // muzzle
					g.fillEllipse(28, 5, 3.4, 7).fillEllipse(33, 4, 3.4, 7); // big mule ears
					// antlers (bulls) — a branched beam sweeping up and back, in-frame
					if (big) {
						g.lineStyle(2.2, C('#9a7a52'), 1);
						g.lineBetween(31, 6, 29, 0).lineBetween(29, 0, 26, 1).lineBetween(29, 0, 30, 2); // left beam + tines
						g.lineBetween(34, 6, 36, 0).lineBetween(36, 0, 39, 1).lineBetween(36, 0, 35, 2); // right beam + tines
					}
					g.fillStyle(NOSE, 1).fillCircle(36, 11, 1);
					g.fillStyle(DK, 1).fillCircle(33, 8, 1.2);
				}),
			};
		}
		// --- Goat / bighorn: blocky body, horns, (goat) beard ---
		if (t(/goat|bighorn|ram|sheep/)) {
			const bighorn = t(/bighorn|ram|sheep/);
			return {
				w: 36,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(11, 21, 3.6, 9).fillRect(17, 21, 3.6, 9).fillRect(23, 21, 3.6, 9).fillRect(28, 21, 3.6, 9); // legs
					g.fillEllipse(20, 16, 26, 15); // stocky body
					g.fillCircle(30, 12, 5); // head
					g.fillEllipse(33, 13, 5, 4); // muzzle
					g.fillTriangle(26, 9, 28, 13, 30, 9); // ear
					if (bighorn) {
						g.fillStyle(C('#b79466'), 1);
						g.fillEllipse(27, 9, 8, 9);
						g.fillEllipse(26, 13, 6, 8);
						g.fillStyle(C('#f4ecd8'), 1).fillEllipse(8, 15, 6, 8);
					} // curl horn + white rump
					else {
						g.fillStyle(C('#efe9dc'), 1).fillTriangle(28, 8, 27, 0, 30, 8).fillTriangle(32, 8, 33, 0, 30, 8);
						g.fillTriangle(29, 15, 33, 15, 31, 22);
					} // straight horns + beard
					g.fillStyle(NOSE, 1).fillCircle(34, 13, 1);
					g.fillStyle(DK, 1).fillCircle(31, 11, 1.2);
				}),
			};
		}
		// --- Hares & jackrabbits: big body, very long ears, long hind legs ---
		if (t(/hare|jackrabbit|rabbit|cottontail/)) {
			return {
				w: 30,
				h: 34,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(6, 24, 12, 7); // big haunch
					g.fillRect(4, 27, 3, 5).fillRect(18, 27, 3, 5); // feet
					g.fillEllipse(16, 20, 20, 15); // upright body
					g.fillCircle(21, 11, 5); // head
					g.fillEllipse(19, 7, 4, 13).fillEllipse(24, 7, 4, 13); // very long ears
					g.fillStyle(0xffffff, 1).fillCircle(4, 22, 3); // cotton tail
					g.fillStyle(C('#f6efe2'), 0.5).fillEllipse(19, 6, 2, 10).fillEllipse(24, 6, 2, 10); // ear inner
					g.fillStyle(DK, 1).fillCircle(23, 10, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(25, 13, 0.9);
				}),
			};
		}
		// --- Pika: round, earthy, tiny round ears, NO tail ---
		if (t(/pika/)) {
			return {
				w: 26,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillRect(7, 19, 3.6, 4).fillRect(12, 20, 3.6, 4).fillRect(18, 19, 3.6, 4); // short legs
					g.fillEllipse(13, 14, 22, 15); // round egg body
					g.fillCircle(19, 9, 5.4); // head blends in
					g.fillCircle(16, 3.5, 2.8).fillCircle(22, 3.5, 2.8); // big round ears
					g.fillStyle(C('#f0e6d4'), 0.55).fillEllipse(19, 11, 7, 5); // pale muzzle
					g.fillStyle(DK, 1).fillCircle(21, 8, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(23, 10, 0.9);
				}),
			};
		}
		// --- Marmot / woodchuck / prairie dog: chunky, sitting upright ---
		if (t(/yellow-bellied-marmot|woodchuck|groundhog|prairie-dog/)) {
			return {
				w: 30,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(6, 24, 9, 6); // stubby tail/haunch
					g.fillEllipse(15, 19, 22, 20); // pear body, wide at base
					g.fillCircle(17, 8, 6); // head on top
					g.fillCircle(13, 3, 2.2).fillCircle(21, 3, 2.2); // small rounded ears
					g.fillRect(11, 20, 3, 7).fillRect(18, 20, 3, 7); // hind feet
					g.fillEllipse(15, 15, 5, 6); // little forepaws at chest
					g.fillStyle(C('#e0b866'), 0.4).fillEllipse(15, 22, 12, 10); // yellow belly
					g.fillStyle(DK, 1).fillCircle(15, 7, 1.2).fillCircle(20, 7, 1.2);
					g.fillStyle(NOSE, 1).fillCircle(17.5, 10, 0.9);
				}),
			};
		}
		// --- Beaver: bulky body, small head, big scaly paddle tail ---
		if (t(/beaver/)) {
			return {
				w: 40,
				h: 26,
				draw: draw((g) => {
					g.fillStyle(C('#5a4632'), 1).fillEllipse(6, 18, 12, 9); // flat paddle tail
					g.lineStyle(0.8, 0x000000, 0.3);
					g.lineBetween(3, 15, 9, 21).lineBetween(3, 18, 9, 18).lineBetween(3, 21, 9, 15); // cross-hatch
					g.fillStyle(BODY, 1);
					g.fillRect(15, 20, 3.6, 5).fillRect(22, 20, 3.6, 5).fillRect(29, 20, 3.6, 5); // legs
					g.fillEllipse(22, 15, 28, 16); // bulky body
					g.fillCircle(33, 12, 5.4); // small head
					g.fillCircle(31, 6.5, 2).fillCircle(36, 6.5, 2); // small round ears
					g.fillStyle(C('#c8922f'), 1).fillRect(35, 14, 2.2, 3); // orange incisors
					g.fillStyle(NOSE, 1).fillCircle(37, 12, 1.1);
					g.fillStyle(DK, 1).fillCircle(34, 11, 1.2);
				}),
			};
		}
		// --- Muskrat: rat-like swimmer, long thin tail ---
		if (t(/muskrat/)) {
			return {
				w: 38,
				h: 20,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(18, 12, 28, 12); // low body
					g.lineStyle(2, C('#4a3a2c'), 1).lineBetween(6, 13, 1, 18); // thin tail
					g.fillStyle(BODY, 1).fillCircle(30, 9, 4.6); // head
					g.fillCircle(28, 5, 1.6).fillCircle(33, 5, 1.6); // small ears
					g.fillRect(13, 17, 3, 3).fillRect(20, 17, 3, 3).fillRect(26, 17, 3, 3); // legs
					g.fillStyle(NOSE, 1).fillCircle(34, 10, 1);
					g.fillStyle(DK, 1).fillCircle(31, 8, 1.1);
				}),
			};
		}
		// --- Bipedal desert rodents: huge hind legs, tiny arms, tufted tail ---
		if (t(/kangaroo-rat|kangaroo-mouse|jerboa/)) {
			return {
				w: 30,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.lineStyle(2, BODY, 1).lineBetween(6, 20, 3, 26); // long tail
					g.fillStyle(0x2e2620, 1).fillCircle(3, 26, 2.2); // dark tail tuft
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 20, 12, 14); // big hind haunch
					g.fillRect(10, 25, 3.4, 5).fillRect(15, 26, 3.2, 4); // two hind feet
					g.fillEllipse(19, 13, 13, 12); // upright body
					g.fillCircle(23, 7, 5); // big head
					g.fillEllipse(21, 3.2, 3, 6).fillEllipse(25, 3.2, 3, 6); // tall ears
					g.fillEllipse(20, 14, 3.5, 4); // tiny forepaw
					g.fillStyle(DK, 1).fillCircle(25, 6, 1.6); // big eye
					g.fillStyle(NOSE, 1).fillCircle(27, 8, 0.9);
				}),
			};
		}
		// --- Flying squirrel: stretched gliding membrane, flat tail, big eyes ---
		if (t(/flying-squirrel/)) {
			return {
				w: 34,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 14, 12, 7); // flat paddle tail
					g.fillRect(12, 18, 3.2, 5).fillRect(21, 18, 3.2, 5); // legs
					g.fillTriangle(10, 8, 26, 8, 24, 18).fillTriangle(10, 8, 10, 18, 24, 18); // patagium
					g.fillEllipse(18, 13, 18, 12); // body
					g.fillCircle(26, 9, 5); // head
					g.fillCircle(24, 4.5, 2).fillCircle(29, 4.5, 2); // round ears
					g.fillStyle(C('#f2ece0'), 0.4).fillEllipse(18, 16, 14, 5); // pale belly
					g.fillStyle(DK, 1).fillCircle(28, 8, 1.8); // big eye
					g.fillStyle(NOSE, 1).fillCircle(30, 10, 0.9);
				}),
			};
		}
		// --- Chipmunks & striped ground squirrels: upright, striped, tail up ---
		if (t(/chipmunk|antelope-squirrel|ground-squirrel/)) {
			const striped = t(/chipmunk|antelope/);
			return {
				w: 30,
				h: 28,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(7, 12, 10, 20); // tail arched up alongside
					g.fillRect(12, 23, 3.4, 4).fillRect(18, 23, 3.4, 4); // hind feet
					g.fillEllipse(16, 18, 15, 15); // upright body
					g.fillCircle(20, 9, 5); // head
					g.fillCircle(18, 4, 2.2).fillCircle(23, 4, 2.2); // round ears
					g.fillEllipse(17, 18, 4, 5); // little forepaws
					if (striped) {
						g.fillStyle(C('#3a2c1e'), 1).fillRect(11, 13, 11, 1.3).fillRect(11, 17, 11, 1.3);
						g.fillStyle(C('#f4efe6'), 1).fillRect(11, 15, 11, 1.2);
					}
					g.fillStyle(DK, 1).fillCircle(22, 8, 1.3);
					g.fillStyle(NOSE, 1).fillCircle(24, 10, 0.8);
				}),
			};
		}
		// --- Voles / mice / rats: compact, blunt face, small ears, thin tail ---
		if (t(/vole|mouse|rat|shrew|mole|gopher|lemming/)) {
			return {
				w: 32,
				h: 19,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.lineStyle(1.6, C('#caa98a'), 1).lineBetween(6, 12, 1, 15); // thin tail
					g.fillStyle(BODY, 1);
					g.fillRect(10, 14, 2.6, 4).fillRect(17, 14, 2.6, 4).fillRect(23, 14, 2.6, 4); // little legs
					g.fillEllipse(15, 11, 22, 11); // plump body
					g.fillCircle(25, 9, 4.6); // head, blunt
					g.fillCircle(23, 4.5, 2.4).fillCircle(28, 5, 2.2); // rounded ears
					g.fillStyle(DK, 1).fillCircle(27, 8, 1.2);
					g.fillStyle(NOSE, 1).fillCircle(29, 10, 0.9);
				}),
			};
		}
		// --- Cats (bobcat/lynx): compact cat, tufted ears, spots, bobbed tail ---
		if (t(/bobcat|lynx|cat|cougar|puma|mountain-lion/)) {
			const bob = t(/bobcat|lynx/);
			return {
				w: 38,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					if (bob)
						g.fillEllipse(6, 15, 7, 5); // short bobbed tail
					else g.fillEllipse(6, 17, 13, 6); // long tail
					g.fillRect(12, 22, 3.6, 7).fillRect(18, 22, 3.6, 7).fillRect(25, 22, 3.6, 7).fillRect(30, 22, 3.6, 7); // legs
					g.fillEllipse(20, 17, 26, 13); // lithe body
					g.fillCircle(31, 11, 5.4); // round head
					g.fillTriangle(26, 8, 29, 2, 32, 8).fillTriangle(31, 8, 34, 2, 37, 8); // upright pointed ears
					if (bob) {
						g.fillStyle(0x2a2620, 1).fillTriangle(28.4, 3, 29, 0.4, 29.6, 3).fillTriangle(33.4, 3, 34, 0.4, 34.6, 3);
						g.fillStyle(BODY, 1);
					} // dark ear tufts
					g.fillStyle(0x000000, 0.2);
					for (const [x, y] of [
						[15, 14],
						[21, 13],
						[26, 15],
						[18, 18],
						[24, 18],
					] as const)
						g.fillCircle(x, y, 1.2); // spots
					g.fillStyle(C('#f2ece0'), 1).fillEllipse(31, 13, 7, 4); // muzzle
					g.fillStyle(NOSE, 1).fillEllipse(33, 12, 1.8, 1.3);
					g.fillStyle(DK, 1).fillCircle(29, 10, 1.2).fillCircle(33, 10, 1.2);
				}),
			};
		}
		// --- Wild canids (mountain-lion/kit fox/wolf): long legs, snout, bushy tail ---
		if (t(/mountain-lion|wolf|kit-fox|fox|jackal/)) {
			const kit = t(/kit-fox/);
			return {
				w: 40,
				h: 30,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(8, 18, 14, 9); // bushy tail
					g.fillRect(13, 22, 3.4, 7).fillRect(19, 22, 3.4, 7).fillRect(26, 22, 3.4, 7).fillRect(31, 22, 3.4, 7); // long legs
					g.fillEllipse(21, 16, 26, 13); // lean body
					g.fillTriangle(30, 17, 34, 17, 33, 8); // neck
					g.fillCircle(33, 8, 4.6); // head
					g.fillTriangle(35, 8, 40, 11, 35, 12); // pointed snout
					if (kit)
						g.fillTriangle(29, 7, 30, 0.5, 33, 6).fillTriangle(34, 6, 37, 0.5, 38, 7); // kit fox = huge ears
					else g.fillTriangle(30, 6, 31, 2, 33, 6).fillTriangle(34, 6, 36, 2, 37, 6);
					g.fillStyle(0xffffff, 1).fillCircle(4, 17, 3); // tail tip
					g.fillStyle(NOSE, 1).fillCircle(39, 11, 1);
					g.fillStyle(DK, 1).fillCircle(34, 7, 1.2);
				}),
			};
		}

		// --- Generic quadruped fallback (small unhandled mammals) ---
		return {
			w: 36,
			h: 28,
			draw: draw((g) => {
				// Legs start well up inside the body and are drawn first, so the body
				// covers their tops. Drawn short and stout at 23px they read as legs;
				// long thin posts starting at the body's curved edge read as detached.
				g.fillStyle(BODY, 1);
				if (t(/squirrel/))
					g.fillEllipse(6, 13, 11, 15); // bushy squirrel tail
				else g.fillEllipse(7, 17, 9, 5);
				g.fillRect(12, 19, 4.2, 7).fillRect(17.5, 19, 4.2, 7).fillRect(23, 19, 4.2, 7).fillRect(28, 19, 4.2, 7); // four legs
				g.fillEllipse(12.6, 25.4, 5.6, 2.8) // paws, squaring off the ends
					.fillEllipse(18.1, 25.4, 5.6, 2.8)
					.fillEllipse(23.6, 25.4, 5.6, 2.8)
					.fillEllipse(28.6, 25.4, 5.6, 2.8);
				g.fillEllipse(19, 17, 23, 14); // body + head, painted over the leg tops
				g.fillCircle(28, 13, 6.2);
				g.fillCircle(25, 7, 2.6).fillCircle(31, 7, 2.6); // round ears
				g.fillStyle(NOSE, 1).fillCircle(33, 13, 1);
				g.fillStyle(DK, 1).fillCircle(29, 12, 1.2);
			}),
		};
	}

	if (kind === 'bird') {
		if (t(/heron/)) {
			return {
				w: 34,
				h: 28,
				draw: draw((g) => {
					// Shorter, contained legs so journal/card thumbnails do not crop the bird.
					g.lineStyle(1.3, C('#c9a35c'), 1);
					g.lineBetween(12, 18, 12, 25)
						.lineBetween(17, 18, 16, 25)
						.lineBetween(12, 25, 9, 26)
						.lineBetween(16, 25, 19, 26);

					// Body, wing, neck, and head.
					g.fillStyle(BODY, 1).fillEllipse(14, 13, 18, 11);
					g.fillStyle(0x000000, 0.12).fillEllipse(13, 14, 10, 6);
					g.fillStyle(BODY, 1);
					g.fillTriangle(5, 12, 10, 9, 10, 16);
					g.fillRect(20, 5, 3, 10);
					g.fillCircle(22, 5, 4.2);

					// Beak + eye.
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(25, 4, 33, 5.5, 25, 7);
					g.fillStyle(DK, 1).fillCircle(23, 4.5, 1);
				}),
			};
		}

		// Waterfowl: a low, boat-shaped body that sits on the water, rounded head,
		// and a broad flat bill — reads clearly as a duck/goose vs a songbird.
		if (t(/duck|mallard|merganser|teal|widgeon|wigeon|goose|brant|gadwall|pintail|shoveler/)) {
			return {
				w: 33,
				h: 22,
				draw: draw((g) => {
					const goose = t(/goose|brant/);
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 15, 22, 11); // boat body
					g.fillTriangle(2, 12, 8, 16, 4, 17); // upswept tail
					if (goose) {
						g.fillRect(20, 4, 3.4, 9);
						g.fillCircle(22, 4, 3.8);
					} // long neck + head
					else g.fillCircle(23, 9, 5); // tucked head
					const hx = goose ? 22 : 25,
						hy = goose ? 4 : 9;
					g.fillStyle(C('#e0a93f'), 1).fillEllipse(hx + 4, hy + 0.5, 6, 3.2); // broad flat bill
					g.fillStyle(0xffffff, 0.5).fillEllipse(11, 13, 12, 4); // wing highlight
					g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
				}),
			};
		}
		// Ground cuckoo (roadrunner): long body, very long tail, shaggy crest,
		// long striding legs, straight bill.
		if (t(/roadrunner/)) {
			return {
				w: 34,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.5, C('#8a6a44'), 1).lineBetween(12, 16, 11, 24).lineBetween(16, 16, 18, 24); // legs
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 12, 16, 9); // body
					g.fillTriangle(1, 4, 8, 12, 6, 16); // long cocked tail
					g.fillRect(18, 6, 3, 6);
					g.fillCircle(21, 6, 4); // neck + head
					g.fillTriangle(19, 3, 23, 0, 24, 4); // shaggy crest
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(24, 5, 31, 6, 24, 7.5); // long straight bill
					g.fillStyle(DK, 1).fillCircle(22, 5, 1.1);
				}),
			};
		}
		// Small shorebird (plover / sandpiper / sanderling / turnstone): compact
		// upright body, two thin legs, and a short-to-medium straight probing bill.
		if (t(/plover|sanderling|sandpiper|turnstone|shorebird|killdeer|dunlin|dowitcher|godwit|yellowlegs/)) {
			return {
				w: 28,
				h: 26,
				draw: draw((g) => {
					g.lineStyle(1.3, C('#c9a35c'), 1).lineBetween(11, 16, 10, 24).lineBetween(15, 16, 16, 24); // legs
					g.fillStyle(BODY, 1);
					g.fillEllipse(12, 12, 15, 11); // plump body
					g.fillCircle(18, 6, 4); // head high on body
					g.fillTriangle(2, 9, 7, 12, 3, 14); // short tail
					g.fillStyle(DK, 1);
					g.fillTriangle(21, 5.5, 27, 6, 21, 7); // straight bill
					g.fillCircle(19, 5, 1.1);
				}),
			};
		}
		// Seabird (gull / tern / cormorant): sleek elongated body; gulls get a
		// slightly hooked bill, cormorants a long neck + hook.
		if (t(/gull|tern|cormorant|guillemot|kittiwake/)) {
			const corm = t(/cormorant|guillemot/);
			return {
				w: 32,
				h: 24,
				draw: draw((g) => {
					g.fillStyle(BODY, 1);
					g.fillEllipse(13, 14, 20, 10); // sleek body
					g.fillTriangle(2, 11, 8, 15, 3, 16); // tail
					if (corm) {
						g.fillRect(19, 5, 3, 8);
						g.fillCircle(21, 5, 4);
					} else g.fillCircle(21, 9, 4.6);
					const hx = corm ? 21 : 22,
						hy = corm ? 5 : 9;
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 9, hy, hx + 3, hy + 1.5); // hooked-ish bill
					g.lineStyle(1.4, C('#e0a93f'), 1).lineBetween(hx + 9, hy, hx + 8, hy + 1.5);
					g.fillStyle(0x000000, 0.14).fillEllipse(9, 11, 13, 4); // grey wing
					g.fillStyle(DK, 1).fillCircle(hx, hy - 0.5, 1.1);
				}),
			};
		}
		// Eagle — the apex raptor. A big, upright, broad-chested hunter: heavy
		// hooked bill, the golden eagle's signature tawny nape, a fierce amber eye
		// under a heavy brow, a folded wing with drooping primaries, and gripping
		// yellow talons. Reads as a predator, not a generic songbird.
		if (t(/eagle/)) {
			// Same clean, flat silhouette as the other birds — but unmistakably a
			// raptor: a hooked bill, the golden eagle's tawny nape, a fierce amber
			// eye, and gripping talons. No muddy overlays.
			return {
				w: 30,
				h: 26,
				draw: draw((g) => {
					// short perched legs + talons
					g.lineStyle(1.6, C('#e0a93f'), 1).lineBetween(12, 17, 11, 23).lineBetween(16, 17, 17, 23);
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(8, 23, 13, 22, 10, 25).fillTriangle(15, 23, 20, 22, 17, 25);
					// simple tail + plump body + rounded head (matches the other birds)
					g.fillStyle(BODY, 1);
					g.fillTriangle(2, 8, 9, 13, 3, 15);
					g.fillEllipse(13, 13, 19, 15);
					g.fillCircle(20, 7, 5.4);
					// one restrained folded-wing accent, same touch as the gull/duck
					g.fillStyle(0x000000, 0.12).fillEllipse(11, 13, 13, 6);
					// the golden eagle's signature tawny nape, a clean patch on the crown
					g.fillStyle(C('#c79a3f'), 1).fillEllipse(17, 5, 6, 5);
					// heavy hooked bill: yellow, tipped with a small dark down-curved hook
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(23, 5.5, 29, 7, 23, 9);
					g.fillStyle(C('#33302b'), 1).fillTriangle(27, 6.4, 29.6, 8, 27, 9.2);
					// fierce amber eye
					g.fillStyle(C('#f2c033'), 1).fillCircle(21, 6, 1.7);
					g.fillStyle(DK, 1).fillCircle(21.3, 6, 1);
				}),
			};
		}

		const wader = t(/heron|crane|egret|bittern|stilt|flamingo|sandhill/);
		const raptor = t(/hawk|owl|falcon|kite|harrier|osprey|goshawk|kestrel|merlin/);
		const finch = t(/finch|grosbeak|goldfinch|sparrow|bunting|crossbill|junco|towhee/);
		const chunky = t(/white-tailed-ptarmigan|quail|grouse|partridge/);
		// Long-billed birds need a wider canvas so the bill tip isn't clipped;
		// waders need a taller one so the raised neck/head clears the top edge.
		const longBill = t(
			/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|brown-pelican|oystercatcher|hummingbird/,
		);
		const W = longBill ? 32 : 28;
		const H = wader ? 34 : 24;
		return {
			w: W,
			h: H,
			draw: draw((g) => {
				const baseY = wader ? 16 : 13;
				g.fillStyle(BODY, 1);
				// legs
				if (wader) {
					g.lineStyle(1.4, C('#c9a35c'), 1);
					g.lineBetween(12, baseY + 8, 11, H - 1).lineBetween(16, baseY + 8, 17, H - 1);
					g.fillStyle(BODY, 1);
				}
				// body + head — plump, rounded body for chunky ground birds (white-tailed-ptarmigan/quail)
				if (chunky) g.fillEllipse(12, baseY, 20, 15).fillCircle(20, baseY - 7, 4.6);
				else g.fillEllipse(13, baseY, 17, 12).fillCircle(20, baseY - 6, 4.6);
				if (wader) {
					g.fillRect(18, baseY - 9, 3, 8);
					g.fillCircle(20, baseY - 10, 4);
				} // long neck + head
				// tail
				if (t(/wren/)) g.fillTriangle(3, baseY - 5, 7, baseY, 4, baseY - 1);
				else g.fillTriangle(2, baseY - 3, 8, baseY, 3, baseY + 4);
				// crest
				if (t(/quail|cardinal|jay|waxwing|nutcracker|titmouse|chickadee|kingfisher|phainopepla/)) {
					g.fillTriangle(18, baseY - 9, 21, baseY - 13, 24, baseY - 8);
				}
				// beak
				const hx = 20,
					hy = wader ? baseY - 10 : baseY - 6;
				if (t(/hummingbird/)) {
					g.fillStyle(DK, 1);
					g.lineStyle(1.2, DK, 1).lineBetween(hx + 3, hy, hx + 11, hy - 1);
				} else if (t(/heron|crane|egret|bittern|kingfisher|woodpecker|sapsucker|stork|brown-pelican|oystercatcher/)) {
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1.5, hx + 11, hy, hx + 3, hy + 1.5);
				} else if (raptor) {
					g.fillStyle(C('#e6b84a'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy + 0.5, hx + 3, hy + 2.5);
					g.fillStyle(C('#33302b'), 1).fillTriangle(hx + 6, hy - 0.2, hx + 9, hy + 1, hx + 5.5, hy + 2);
				}
				// finches/sparrows/grosbeaks: short, deep conical seed-cracking bill
				else if (finch) {
					g.fillStyle(C('#d8b25a'), 1).fillTriangle(hx + 3, hy - 2, hx + 7, hy, hx + 3, hy + 2);
				} else {
					g.fillStyle(C('#e0a93f'), 1).fillTriangle(hx + 3, hy - 1, hx + 7, hy, hx + 3, hy + 1.5);
				}
				// brown-pelican: a big orange gular pouch slung under the long bill
				if (t(/brown-pelican/)) {
					g.fillStyle(C('#e6a63c'), 1).fillEllipse(hx + 6, hy + 4, 11, 8);
					g.fillStyle(C('#f0c060'), 1).fillEllipse(hx + 6, hy + 3, 8, 5);
				}
				// owl big eyes / ear tufts
				if (t(/owl/)) {
					g.fillStyle(C('#f4e3b1'), 1).fillCircle(18, hy, 2).fillCircle(22, hy, 2);
					g.fillStyle(DK, 1).fillCircle(18, hy, 1).fillCircle(22, hy, 1);
					g.fillStyle(BODY, 1)
						.fillTriangle(16, hy - 4, 18, hy - 7, 19, hy - 3)
						.fillTriangle(21, hy - 3, 22, hy - 7, 24, hy - 4);
				}
				// other raptors: a fierce amber eye under a heavy brow
				else if (raptor) {
					g.lineStyle(1.4, C('#5a4a30'), 1).lineBetween(18, hy - 1.5, 23, hy - 0.5);
					g.fillStyle(C('#f2c033'), 1).fillCircle(21, hy, 1.8);
					g.fillStyle(DK, 1).fillCircle(21.3, hy, 1);
				} else g.fillStyle(DK, 1).fillCircle(21, hy, 1.1);
				// woodpecker: a white cheek patch under a red cap (classic trunk-clinger)
				if (t(/woodpecker|sapsucker/)) {
					g.fillStyle(0xffffff, 0.82).fillEllipse(19, hy + 1.5, 6, 4.5);
					g.fillStyle(DK, 1).fillCircle(21, hy, 1.1);
					g.fillStyle(C('#c0392b'), 1).fillCircle(19, hy - 4, 2.6);
				}
				// hummingbird: an iridescent gorget at the throat + a swept blur-wing
				if (t(/hummingbird/)) {
					g.fillStyle(0x000000, 0.14).fillTriangle(7, baseY - 3, 15, baseY - 1, 9, baseY + 3);
					g.fillStyle(C('#c0396b'), 1).fillEllipse(19, baseY - 3.5, 5, 4);
					g.fillStyle(DK, 1).fillCircle(20, baseY - 6, 1.05);
				}
			}),
		};
	}

	if (kind === 'insect') {
		return {
			w: 24,
			h: 20,
			draw: draw((g) => {
				if (t(/butterfly|monarch|admiral|swallowtail|fritillary|painted|lady$|painted-lady/)) {
					g.fillStyle(BODY, 1)
						.fillEllipse(7, 8, 12, 12)
						.fillEllipse(17, 8, 12, 12)
						.fillEllipse(8, 16, 8, 7)
						.fillEllipse(16, 16, 8, 7);
					g.fillStyle(0x000000, 0.18).fillEllipse(7, 8, 5, 6).fillEllipse(17, 8, 5, 6);
					g.fillStyle(DK, 1).fillEllipse(12, 11, 2.4, 12);
					g.lineStyle(1, DK, 1).lineBetween(12, 4, 9, 0).lineBetween(12, 4, 15, 0);
					return;
				}
				if (t(/dragonfly|damselfly/)) {
					g.fillStyle(BODY, 1).fillRect(3, 9, 18, 2.4).fillCircle(20, 10, 3);
					g.fillStyle(0xffffff, 0.6).fillEllipse(11, 6, 12, 4).fillEllipse(11, 14, 12, 4);
					g.fillStyle(DK, 1).fillCircle(21, 9, 1);
					return;
				}
				if (t(/bee|bumblebee/)) {
					g.fillStyle(BODY, 1).fillEllipse(11, 11, 14, 10).fillCircle(18, 9, 3.4);
					g.fillStyle(0x2e2620, 1).fillRect(7, 7, 2.6, 8).fillRect(12, 7, 2.6, 8); // stripes
					g.fillStyle(0xffffff, 0.7).fillEllipse(9, 4, 8, 5);
					g.fillStyle(DK, 1).fillCircle(19, 8, 1);
					return;
				}
				if (t(/mantis/)) {
					g.fillStyle(BODY, 1).fillEllipse(12, 13, 16, 6).fillTriangle(20, 9, 24, 7, 22, 13);
					g.lineStyle(2, BODY, 1).lineBetween(19, 12, 23, 16).lineBetween(23, 16, 18, 17);
					g.fillStyle(DK, 1).fillCircle(23, 8, 1);
					return;
				}
				// grasshopper / beetle / strider — generic 6-legged
				g.fillStyle(BODY, 1).fillEllipse(11, 11, 15, 8).fillCircle(18, 9, 3);
				if (t(/beetle/)) {
					g.fillStyle(0x000000, 0.18).fillEllipse(10, 11, 12, 7);
					g.lineStyle(1, DK, 1).lineBetween(11, 6, 11, 16);
				}
				g.lineStyle(1, DK, 1);
				for (const lx of [6, 10, 14]) g.lineBetween(lx, 14, lx - 2, 18).lineBetween(lx, 8, lx - 2, 4);
				if (t(/grasshopper|cricket/)) g.lineStyle(2.2, BODY, 1).lineBetween(8, 13, 4, 18);
				g.fillStyle(DK, 1).fillCircle(19, 8, 1);
			}),
		};
	}

	if (kind === 'reptile') {
		if (t(/turtle|tortoise/)) {
			return {
				w: 30,
				h: 20,
				draw: draw((g) => {
					g.fillStyle(BODY, 1).fillEllipse(15, 12, 22, 13);
					g.fillStyle(0x000000, 0.16).fillEllipse(15, 14, 22, 7);
					g.lineStyle(1, 0x000000, 0.25).strokeCircle(15, 11, 5);
					g.fillStyle(BODY, 1).fillCircle(26, 12, 3.4).fillRect(7, 16, 3, 4).fillRect(20, 16, 3, 4); // head + legs
					g.fillStyle(DK, 1).fillCircle(27, 11, 1);
				}),
			};
		}
		// lizard / gecko / iguana
		return {
			w: 34,
			h: 18,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 10, 20, 8).fillCircle(25, 9, 4);
				g.fillEllipse(6, 11, 12, 4); // tail
				g.fillRect(9, 13, 2.4, 4).fillRect(18, 13, 2.4, 4); // legs
				if (t(/horned|collared/)) {
					g.fillStyle(BODY, 1).fillTriangle(27, 6, 30, 3, 30, 9);
				} // head spikes/frill
				if (t(/iguana|chuckwalla/)) {
					g.fillStyle(0x000000, 0.15);
					for (const sx of [10, 14, 18, 22]) g.fillTriangle(sx, 6, sx + 1.5, 3, sx + 3, 6);
				} // dorsal crest
				g.fillStyle(DK, 1).fillCircle(26, 8, 1);
			}),
		};
	}

	if (kind === 'amphibian') {
		if (t(/frog|toad/)) {
			return {
				w: 26,
				h: 18,
				draw: draw((g) => {
					g.fillStyle(BODY, 1).fillEllipse(13, 12, 19, 11).fillCircle(7, 7, 3).fillCircle(19, 7, 3); // body + eye bulges
					g.fillStyle(DK, 1).fillCircle(7, 7, 1.2).fillCircle(19, 7, 1.2);
					g.fillStyle(BODY, 1).fillTriangle(3, 16, 9, 14, 6, 18).fillTriangle(23, 16, 17, 14, 20, 18); // legs
					if (t(/toad/)) {
						g.fillStyle(0x000000, 0.14).fillCircle(9, 11, 1.3).fillCircle(15, 13, 1.3).fillCircle(17, 10, 1.3);
					} // warts
				}),
			};
		}
		// salamander / newt
		return {
			w: 30,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 9, 18, 7).fillCircle(23, 8, 3.4).fillEllipse(6, 10, 10, 3.4);
				g.fillRect(9, 11, 2, 3).fillRect(17, 11, 2, 3);
				g.fillStyle(C('#e8954f'), 1).fillCircle(11, 8, 1.3).fillCircle(16, 9, 1.3).fillCircle(20, 8, 1.1); // spots
				g.fillStyle(DK, 1).fillCircle(24, 7, 1);
			}),
		};
	}

	if (kind === 'fish') {
		return {
			w: 28,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(14, 8, 18, 10).fillTriangle(2, 3, 7, 8, 2, 13);
				g.fillStyle(0xffffff, 0.6).fillTriangle(13, 1, 17, 5, 13, 5); // dorsal fin
				g.fillStyle(DK, 1).fillCircle(20, 7, 1.2);
			}),
		};
	}

	// invertebrate — crabs, stars, anemones, slugs, shellfish, spiders, scorpions
	if (t(/crab/)) {
		return {
			w: 26,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(13, 13, 18, 11);
				g.lineStyle(1.4, BODY, 1);
				for (const s of [-1, 1])
					for (let i = 0; i < 3; i++) g.lineBetween(13 + s * 6, 13 + i * 2, 13 + s * 11, 11 + i * 3);
				g.fillStyle(BODY, 1).fillCircle(4, 9, 3).fillCircle(22, 9, 3); // claws
				g.fillStyle(DK, 1).fillCircle(10, 9, 1).fillCircle(16, 9, 1);
			}),
		};
	}
	if (t(/star/)) {
		return {
			w: 24,
			h: 24,
			draw: draw((g) => {
				g.fillStyle(BODY, 1);
				const cx = 12,
					cy = 12,
					R = 11;
				for (let i = 0; i < 5; i++) {
					const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
					const a0 = ((i - 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
					const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
					g.fillTriangle(
						cx,
						cy,
						cx + Math.cos(a0) * R * 0.55,
						cy + Math.sin(a0) * R * 0.55,
						cx + Math.cos(ang) * R,
						cy + Math.sin(ang) * R,
					);
					g.fillTriangle(
						cx,
						cy,
						cx + Math.cos(a2) * R * 0.55,
						cy + Math.sin(a2) * R * 0.55,
						cx + Math.cos(ang) * R,
						cy + Math.sin(ang) * R,
					);
				}
				g.fillStyle(0x000000, 0.12).fillCircle(cx, cy, 3.5);
			}),
		};
	}
	if (t(/anemone/)) {
		return {
			w: 24,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(12, 17, 14, 9);
				g.lineStyle(1.6, BODY, 1);
				for (let i = 0; i < 9; i++) {
					const x = 5 + i * 1.8;
					g.lineBetween(x, 14, x - 1 + (i % 2) * 2, 3 + (i % 3));
				}
			}),
		};
	}
	if (t(/scorpion/)) {
		return {
			w: 28,
			h: 20,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(12, 13, 14, 8).fillCircle(5, 9, 2.6).fillCircle(19, 9, 2.6); // body + pincers
				g.lineStyle(1.8, BODY, 1).lineBetween(18, 11, 23, 6).lineBetween(23, 6, 24, 12); // curled tail
				g.fillStyle(BODY, 1).fillCircle(24, 12, 1.8);
				g.lineStyle(1, DK, 1);
				for (const lx of [9, 13, 17]) g.lineBetween(lx, 16, lx - 2, 19);
			}),
		};
	}
	if (t(/spider|desert-tarantula/)) {
		return {
			w: 24,
			h: 22,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillCircle(12, 12, 6).fillCircle(12, 6, 3);
				g.lineStyle(1.6, BODY, 1);
				for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.lineBetween(12, 11, 12 + s * (8 + i), 6 + i * 4);
				g.fillStyle(DK, 1).fillCircle(11, 5, 0.9).fillCircle(13, 5, 0.9);
			}),
		};
	}
	if (t(/slug|snail/)) {
		return {
			w: 26,
			h: 16,
			draw: draw((g) => {
				g.fillStyle(BODY, 1).fillEllipse(13, 11, 22, 8);
				if (t(/snail/)) g.fillStyle(0x000000, 0.16).fillCircle(9, 9, 5);
				g.lineStyle(1.4, BODY, 1).lineBetween(21, 8, 23, 3).lineBetween(23, 8, 25, 4); // eye stalks
				g.fillStyle(DK, 1).fillCircle(23, 3, 0.8).fillCircle(25, 4, 0.8);
			}),
		};
	}
	// mussel / clam / oyster — bivalve shell
	return {
		w: 22,
		h: 18,
		draw: draw((g) => {
			g.fillStyle(BODY, 1).fillEllipse(11, 11, 18, 12);
			g.lineStyle(1, 0x000000, 0.25);
			for (let i = 1; i < 4; i++) g.strokeEllipse(11, 11, 18 - i * 4, 12 - i * 3);
			g.fillStyle(0x000000, 0.12).fillTriangle(11, 5, 9, 11, 13, 11);
		}),
	};
}

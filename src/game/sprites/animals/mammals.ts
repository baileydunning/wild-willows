// Mammals, from a chipmunk to a grizzly — and the two whales, which are
// mammals however much they look like fish.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const MAMMALS: SpriteSet = {
	rabbit: def(26, 26, (g) => {
		g.fillStyle(C('#b0987c'), 1).fillRect(9, 23, 3.5, 3).fillRect(16, 23, 3.5, 3); // feet
		g.fillEllipse(13, 18, 18, 13).fillCircle(20, 13, 6);
		g.fillEllipse(18, 5, 4, 10).fillEllipse(23, 6, 4, 10); // ears
		g.fillStyle(0xffffff, 1).fillCircle(4, 19, 4); // tail
		g.fillStyle(0x2e2018, 1).fillCircle(22, 12, 1.4);
	}),
	deer: def(34, 32, (g) => {
		// Mule deer. The ears are the whole point — outsized and held wide, which is
		// where the name comes from — so they stand clear of the skull instead of
		// merging into it. Long muzzle, a neck that rises, and the white rump with
		// the narrow black-tipped tail that tells it from a whitetail.
		// Everything stays inside 0..34 x 0..32: the texture and the journal's SVG
		// viewBox are both exactly that, so anything drawn past it loses its tips.
		g.fillStyle(C('#8a6a44'), 1); // legs, a shade darker than the coat
		g.fillRect(8, 23, 3, 8.5).fillRect(13, 24, 2.6, 7.5).fillRect(19, 23, 3, 8.5);
		g.fillStyle(C('#9a7548'), 1).fillEllipse(4.2, 20.5, 3.2, 8); // tail, set behind the rump
		g.fillStyle(C('#2e2018'), 1).fillEllipse(4.2, 23.2, 3.2, 2.8); // and its black tip
		g.fillStyle(C('#b08a5c'), 1).fillEllipse(15, 17.5, 23, 14); // body
		g.fillEllipse(22.5, 13.5, 10, 13); // neck, rising toward the head
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(7.5, 17, 8, 9.5); // white rump patch, inside the flank
		g.fillStyle(C('#b08a5c'), 1);
		g.fillEllipse(21, 4.8, 5, 8.6).fillEllipse(29.6, 4.8, 5, 8.6); // the big mule ears
		g.fillStyle(C('#8a6a44'), 1);
		g.fillEllipse(21.3, 5.2, 2.4, 5.4).fillEllipse(29.3, 5.2, 2.4, 5.4); // inner ear
		g.fillStyle(C('#b08a5c'), 1).fillEllipse(26, 9.2, 11, 9); // head
		g.fillStyle(C('#9a7548'), 1).fillEllipse(29.8, 11.4, 7, 5); // long muzzle
		g.fillStyle(C('#f4ecd8'), 1).fillEllipse(30.4, 12.6, 4.6, 2.2); // pale band around the mouth
		g.fillStyle(0x2e2018, 1).fillCircle(27.6, 8.4, 1.3); // eye
		g.fillEllipse(32.4, 10.8, 2.2, 1.8); // nose
	}),
	fox: def(32, 26, (g) => {
		g.fillStyle(C('#46301f'), 1).fillRect(9, 19, 3, 6).fillRect(14, 20, 3, 6).fillRect(20, 19, 3, 6); // dark-socked legs
		g.fillStyle(C('#d3722e'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6);
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillEllipse(6, 16, 12, 8); // tail
		g.fillStyle(0xffffff, 1).fillCircle(3, 15, 3).fillEllipse(24, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	}),
	grayfox: def(32, 26, (g) => {
		g.fillStyle(C('#4a4640'), 1).fillRect(9, 19, 3, 6).fillRect(14, 20, 3, 6).fillRect(20, 19, 3, 6); // legs
		g.fillStyle(C('#8d8b84'), 1).fillEllipse(15, 16, 20, 12).fillCircle(25, 10, 6); // grizzled grey body
		g.fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(27, 3, 30, 9, 25, 9); // ears
		g.fillStyle(C('#6e6b64'), 1).fillEllipse(6, 16, 12, 8); // darker tail
		g.fillStyle(C('#2b2b28'), 1).fillRect(3, 14, 9, 2); // black stripe along the tail
		g.fillStyle(C('#b4682f'), 1).fillEllipse(22, 15, 8, 5).fillCircle(28, 8, 2.4); // rusty neck and ear backs
		g.fillStyle(0xffffff, 1).fillEllipse(25, 13, 6, 4);
		g.fillStyle(0x2e2018, 1).fillCircle(27, 9, 1.3).fillCircle(30, 11, 1.4);
	}),
	squirrel: def(26, 26, (g) => {
		g.fillStyle(C('#9a7448'), 1).fillRect(11, 22, 3.4, 4).fillRect(17, 22, 3.4, 4); // feet
		g.fillEllipse(14, 18, 14, 11).fillCircle(20, 12, 5);
		g.fillStyle(C('#7c5a3c'), 1).fillEllipse(6, 12, 9, 16); // big tail
		g.fillCircle(19, 7, 2); // ear
		g.fillStyle(0x2e2018, 1).fillCircle(21, 11, 1.2);
	}),
	bear: def(40, 32, (g) => {
		// Matches the house style (deer/fox): body, head, ears, muzzle + nose,
		// and a single small light eye-dot each — like the bat — since the fur
		// is dark. No eye whites/pupils/catchlights; those read too detailed.
		g.fillStyle(0x2a2118, 1).fillRoundedRect(11, 22, 8, 9, 3).fillRoundedRect(25, 22, 8, 9, 3); // legs
		g.fillStyle(C('#6e4d34'), 1).fillEllipse(20, 18, 32, 18); // body (warm brown, light enough for dark eyes)
		g.fillCircle(29, 12, 9); // head
		g.fillCircle(23, 5, 4).fillCircle(35, 5, 4); // ears
		g.fillStyle(C('#9a7a54'), 1).fillEllipse(31, 15, 9, 6); // muzzle
		g.fillStyle(0x1a1410, 1).fillCircle(34, 14, 1.4); // nose
		g.fillStyle(0x2e2018, 1).fillCircle(26, 10, 1.3).fillCircle(31, 10, 1.3); // eyes (dark, like fox/deer)
	}),
	raccoon: def(38, 30, (g) => {
		// Matches the house style: body, head, ears, ringed tail, pale muzzle,
		// bandit mask, and a single small light eye-dot on the mask (like the
		// yellowthroat's masked face). No pupils/catchlights.
		g.fillStyle(C('#6e6857'), 1).fillRoundedRect(13, 21, 5, 9, 2).fillRoundedRect(24, 21, 5, 9, 2); // legs
		g.fillStyle(C('#8a7a5c'), 1).fillEllipse(7, 17, 15, 10); // ringed tail
		g.fillStyle(0x4a3f30, 1).fillEllipse(5, 18, 4, 8).fillEllipse(11, 15, 3.5, 9); // tail rings
		g.fillStyle(C('#9c988a'), 1).fillEllipse(20, 18, 26, 15); // body
		g.fillCircle(28, 12, 9); // head
		g.fillCircle(22, 4, 4).fillCircle(34, 4, 4); // ears
		g.fillStyle(C('#efe9dc'), 1).fillEllipse(28, 15, 12, 9); // pale muzzle
		g.fillStyle(0x3a3128, 1).fillEllipse(24.5, 10.5, 6, 5).fillEllipse(31.5, 10.5, 6, 5); // bandit mask
		g.fillStyle(C('#f2ece0'), 1).fillCircle(25, 10.5, 1.3).fillCircle(31, 10.5, 1.3); // eyes
		g.fillStyle(0x2e2018, 1).fillEllipse(28, 16, 2.2, 1.6); // nose
	}),
	bat: def(30, 20, (g) => {
		g.fillStyle(C('#5a4636'), 1).fillTriangle(15, 11, 2, 4, 4, 16).fillTriangle(15, 11, 28, 4, 26, 16); // wings
		g.fillStyle(C('#3a2c22'), 1).fillEllipse(15, 11, 8, 11); // body
		g.fillStyle(C('#3a2c22'), 1).fillTriangle(12, 4, 14, 8, 11, 8).fillTriangle(18, 4, 16, 8, 19, 8); // ears
		g.fillStyle(C('#e3a14f'), 1).fillCircle(13, 9, 1).fillCircle(17, 9, 1); // eyes
	}),
	antelopesquirrel: def(28, 22, (g) => {
		g.fillStyle(C('#c2a06a'), 1).fillEllipse(13, 16, 16, 10).fillCircle(20, 11, 4.5); // sandy body
		g.fillStyle(C('#e8dcc2'), 1).fillEllipse(8, 8, 12, 5); // tail arched over back
		g.fillStyle(C('#f4efe6'), 1).fillRect(10, 13, 8, 1.4); // white side stripe
		g.fillStyle(0x2e2018, 1).fillCircle(21, 10, 1);
	}),
	alpinechipmunk: def(26, 22, (g) => {
		g.fillStyle(C('#9a8460'), 1).fillEllipse(13, 15, 15, 9).fillCircle(20, 11, 4); // greyish body
		g.fillStyle(C('#7a6446'), 1).fillEllipse(6, 11, 9, 13); // tail
		g.fillStyle(0x2e2620, 1).fillRect(9, 11, 8, 1).fillRect(9, 14, 8, 1); // back stripes
		g.fillStyle(C('#f4efe6'), 1).fillRect(9, 12.5, 8, 1);
		g.fillStyle(0x2e2018, 1).fillCircle(21, 10, 1);
	}),
	lynx: def(34, 28, (g) => {
		// Read from the extremes: stub tail, oversized paws, ear tufts. The ruff is a
		// soft halo BEHIND the head — drawn as forward triangles it looked like fangs.
		g.fillStyle(C('#a9a396'), 1).fillEllipse(6, 14, 11, 7); // stubby tail
		g.fillStyle(C('#2a2622'), 1).fillEllipse(2.5, 14, 5, 6); // black tail tip
		g.fillStyle(C('#8f8a7e'), 1).fillRect(10, 19, 4.5, 6).fillRect(19, 19, 4.5, 6); // front and hind legs
		g.fillStyle(C('#cfcabd'), 1).fillEllipse(12.2, 25, 10, 5).fillEllipse(21.2, 25, 10, 5); // huge snowshoe paws
		g.fillStyle(C('#b8b2a6'), 1).fillEllipse(16, 15, 22, 14); // body
		g.fillStyle(C('#8f8a7e'), 0.55).fillCircle(12, 12, 1.6).fillCircle(18, 16, 1.5).fillCircle(9, 17, 1.3); // faint spots
		g.fillStyle(C('#e6e2d8'), 1).fillEllipse(25, 13, 17, 13); // cheek ruff, framing the face
		g.fillStyle(C('#b8b2a6'), 1).fillCircle(25, 10, 6.6); // head, sitting over the ruff
		g.fillTriangle(20, 2, 23.5, 8.5, 18.5, 8.5).fillTriangle(30, 2, 31.5, 8.5, 26.5, 8.5); // ears
		g.fillStyle(C('#2a2622'), 1).fillTriangle(20.6, -1, 22.4, 3, 19.4, 3).fillTriangle(29.6, -1, 31, 3, 28.2, 3); // black tufts
		g.fillStyle(C('#e6e2d8'), 1).fillEllipse(26, 13, 8, 5); // pale muzzle
		g.fillStyle(C('#2e2018'), 1).fillCircle(23, 9.5, 1.2).fillCircle(28, 9.5, 1.2); // eyes
		g.fillStyle(C('#3a2a22'), 1).fillTriangle(26, 11.4, 24.8, 13, 27.2, 13); // nose
	}),
	grizzly: def(48, 32, (g) => {
		g.fillStyle(C('#5a4028'), 1)
			.fillRect(12, 20, 6, 11)
			.fillRect(20, 21, 5.5, 10)
			.fillRect(29, 20, 6, 11)
			.fillRect(35, 21, 5.5, 10); // four heavy legs
		g.fillStyle(C('#4a3420'), 1)
			.fillEllipse(15, 30.5, 8, 3)
			.fillEllipse(22.7, 30.5, 7.5, 3)
			.fillEllipse(32, 30.5, 8, 3)
			.fillEllipse(37.7, 30.5, 7.5, 3); // broad paws
		g.fillStyle(C('#7a5636'), 1).fillEllipse(24, 18, 34, 15); // long barrel body
		g.fillEllipse(31, 11, 17, 11); // the shoulder hump, part of the same silhouette
		g.fillStyle(C('#6b4a2e'), 1).fillEllipse(24, 22, 26, 6); // shaded underside
		g.fillStyle(C('#7a5636'), 1).fillCircle(39, 17, 7); // head carried low and forward
		g.fillCircle(34.5, 10.5, 2.8).fillCircle(41.5, 9.8, 2.8); // small round ears
		g.fillStyle(C('#5a4028'), 1).fillCircle(34.5, 10.5, 1.3).fillCircle(41.5, 9.8, 1.3);
		g.fillStyle(C('#a8845a'), 1).fillEllipse(44, 20, 8, 5); // pale dished muzzle
		g.fillStyle(C('#1f1710'), 1).fillCircle(46.6, 18.6, 1.4); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(37.5, 15.4, 1.2).fillCircle(42.4, 15.2, 1.2); // small deep-set eyes
		g.fillStyle(C('#e8dcc4'), 1)
			.fillTriangle(13, 31, 14.4, 31, 13.7, 32.6)
			.fillTriangle(16, 31, 17.4, 31, 16.7, 32.6)
			.fillTriangle(30, 31, 31.4, 31, 30.7, 32.6); // the long front claws
	}),
	orca: def(38, 28, (g) => {
		// the tall dorsal fin is the read; black over a sharply cut white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(15, 14, 20, 0, 24, 14); // tall triangular dorsal fin
		g.fillTriangle(1, 9, 8, 16, 1, 15).fillTriangle(1, 23, 8, 16, 1, 17); // tail flukes
		g.fillEllipse(19, 17, 32, 13); // black body, blunt-headed
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(20, 20.5, 26, 5); // sharp white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(19, 20, 27, 22, 20, 27); // pectoral flipper
		g.fillStyle(C('#6a6f76'), 0.75).fillEllipse(13, 13, 10, 4); // grey saddle behind the fin
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(31, 13.5, 6.5, 3); // white eye patch
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 16, 1.2); // eye
	}),
	graywhale: def(40, 24, (g) => {
		// mottled grey, no dorsal fin at all — only a low knuckled ridge
		g.fillStyle(C('#767b7c'), 1).fillTriangle(1, 6, 10, 13, 1, 12).fillTriangle(1, 20, 10, 13, 1, 14); // broad flukes
		g.fillEllipse(20, 13, 30, 12); // heavy body
		g.fillTriangle(30, 8, 39, 14, 30, 19); // long tapering head
		g.fillStyle(C('#8e9394'), 1)
			.fillCircle(10, 8, 1.8)
			.fillCircle(13.5, 7.4, 1.8)
			.fillCircle(17, 7.2, 1.8)
			.fillCircle(20.5, 7.6, 1.6); // knuckled ridge where a fin would be
		g.fillStyle(C('#9aa0a0'), 0.65).fillEllipse(16, 16, 11, 5).fillEllipse(25, 10, 8, 4); // grey mottling
		g.fillStyle(C('#d8d2bf'), 1).fillCircle(32, 11, 2.2).fillCircle(35, 13, 1.7).fillCircle(33, 16, 1.5); // barnacle crust
		g.fillStyle(C('#5f6465'), 1).fillTriangle(22, 18, 30, 20, 23, 23); // paddle flipper
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 15.5, 1); // small eye
	}),
	javelina: def(34, 26, (g) => {
		// pig-shaped: barrel on stubby legs, wedge head low, pale shoulder collar
		g.fillStyle(C('#332f2a'), 1).fillRect(8, 18, 4, 8).fillRect(14, 18, 4, 8).fillRect(20, 18, 4, 8); // short stumpy legs
		g.fillStyle(C('#5b554b'), 1).fillEllipse(15, 13, 24, 14); // barrel body
		g.fillStyle(C('#cdc2ab'), 1).fillEllipse(23, 12, 5, 14); // pale collar band across the shoulders
		g.lineStyle(1.2, C('#2b2823'), 1);
		g.lineBetween(7, 8, 6, 4).lineBetween(11, 7, 10, 3).lineBetween(15, 6.5, 15, 2.5).lineBetween(19, 7, 19, 3); // coarse bristly back
		g.fillStyle(C('#4a443c'), 1).fillTriangle(24, 7, 33, 17, 23, 19); // big wedge head, held low
		g.fillStyle(C('#3a352f'), 1).fillTriangle(23.5, 6, 28, 5, 26, 10); // small ear
		g.fillStyle(C('#241f1b'), 1).fillCircle(31.5, 16, 2); // flat snout disc
		g.fillStyle(C('#2e2018'), 1).fillCircle(27, 11, 1.2); // eye
	}),
	skunk: def(34, 24, (g) => {
		g.fillStyle(C('#17161a'), 1).fillRect(11, 17, 3.4, 6).fillRect(17, 17, 3.4, 6).fillRect(23, 17, 3.4, 6); // short legs
		g.fillStyle(C('#1b1a1f'), 1).fillEllipse(8, 10, 13, 20); // big plume tail, held up
		g.fillStyle(0xffffff, 1).fillEllipse(7, 7, 8, 13); // white blaze up the tail
		g.fillStyle(C('#1b1a1f'), 1).fillEllipse(19, 15, 24, 13); // low body
		g.fillStyle(0xffffff, 1).fillRect(13, 9, 13, 3.6); // the two white back stripes
		g.fillStyle(C('#1b1a1f'), 1).fillRect(18.5, 9, 2.4, 3.6); // split down the middle
		g.fillStyle(C('#1b1a1f'), 1).fillTriangle(27, 9, 34, 15, 27, 19); // wedge head
		g.fillStyle(0xffffff, 1).fillRect(28, 9, 1.8, 6); // thin white stripe down the face
		g.fillStyle(C('#2e2018'), 1).fillCircle(30, 13, 1.1); // eye
		g.fillStyle(C('#0d0d10'), 1).fillCircle(33.4, 14.6, 1.2); // nose
	}),
	groundhog: def(34, 26, (g) => {
		g.fillStyle(C('#6b5334'), 1).fillEllipse(6, 18, 10, 6); // low bushy tail
		g.fillStyle(C('#4a3a24'), 1).fillRect(12, 19, 4, 5).fillRect(21, 19, 4, 5); // stubby legs
		g.fillStyle(C('#7d6140'), 1).fillEllipse(17, 15, 26, 14); // heavy barrel body
		g.fillStyle(C('#94764e'), 1).fillEllipse(17, 12, 22, 7); // grizzled lighter back
		g.fillStyle(C('#7d6140'), 1).fillCircle(28, 12, 6.4); // blunt head
		g.fillStyle(C('#5e4a2e'), 1).fillCircle(26, 6.5, 2.4).fillCircle(31, 7, 2.4); // small round ears
		g.fillStyle(C('#a68a60'), 1).fillEllipse(31, 14, 7, 5); // pale muzzle
		g.fillStyle(C('#e8e2d2'), 1).fillRect(32, 14.6, 2.6, 2.4); // the big front teeth
		g.fillStyle(C('#241a12'), 1).fillCircle(33.6, 13, 1); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(28, 11, 1.2); // eye
	}),
	opossum: def(36, 26, (g) => {
		g.lineStyle(2.6, C('#d8c8b8'), 1).lineBetween(5, 18, 1, 11); // naked pink tail
		g.fillStyle(C('#3a3a38'), 1).fillRect(13, 18, 3.4, 5).fillRect(21, 18, 3.4, 5); // dark feet
		g.fillStyle(C('#9a9690'), 1).fillEllipse(17, 15, 24, 13); // grizzled grey body
		g.fillStyle(C('#c4c0b8'), 1).fillEllipse(17, 13, 20, 7); // pale guard hairs on top
		g.fillStyle(C('#f2eee6'), 1).fillTriangle(24, 8, 36, 14, 24, 18); // long pale wedge face
		g.fillStyle(C('#3a3a38'), 1).fillEllipse(24, 8, 5, 5).fillEllipse(27, 6, 4.5, 4.5); // big bare black ears
		g.fillStyle(C('#e8b8c0'), 1).fillCircle(35, 13.6, 1.3); // pink nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 11, 1.2); // small dark eye
		g.fillStyle(0xffffff, 1).fillTriangle(33, 15, 35, 15, 34, 17); // a tooth showing
	}),
	// A coyote, not a cougar: bushy low-slung tail, tall pointed ears, long narrow
	// muzzle. (The cougar is `mountainlion` below — flatter head, wide-set ears,
	// long heavy tail.)
	coyote: def(38, 30, (g) => {
		g.fillStyle(C('#8a7355'), 1).fillEllipse(6, 19, 13, 7); // low bushy tail
		g.fillStyle(C('#5f4d38'), 1).fillEllipse(3, 21, 5, 5); // dark tail tip
		g.fillStyle(C('#7d6749'), 1).fillRect(12, 18, 4, 9).fillRect(18, 19, 4, 8).fillRect(24, 18, 4, 9); // long legs
		g.fillStyle(C('#6b563d'), 1)
			.fillEllipse(14, 26.5, 5.6, 3)
			.fillEllipse(20, 26.5, 5.6, 3)
			.fillEllipse(26, 26.5, 5.6, 3); // paws
		g.fillStyle(C('#9a8163'), 1).fillEllipse(19, 16, 26, 13); // lean body
		g.fillStyle(C('#b39a78'), 1).fillEllipse(19, 19, 22, 6); // pale underside
		g.fillStyle(C('#9a8163'), 1).fillCircle(30, 11, 6.4); // head
		g.fillTriangle(26, 1, 29.5, 8, 24.5, 8).fillTriangle(33.5, 1, 35.5, 8, 30.5, 8); // tall pointed ears
		g.fillStyle(C('#c4ae8d'), 1).fillTriangle(33, 10, 38, 14, 33, 15); // long narrow muzzle
		g.fillStyle(C('#7d6749'), 1).fillTriangle(26.6, 2.6, 28.8, 7.4, 25.4, 7.4); // ear shading
		g.fillStyle(C('#2b2118'), 1).fillCircle(37.2, 13.2, 1.2); // nose
		g.fillStyle(C('#c9a24a'), 1).fillEllipse(30, 10.4, 3, 2.2).fillEllipse(34, 11, 2.6, 2); // yellow eyes
		g.fillStyle(C('#2b2118'), 1).fillCircle(30, 10.4, 0.9).fillCircle(34, 11, 0.8);
	}),
	mountainlion: def(46, 30, (g) => {
		g.fillStyle(C('#b3945f'), 1).fillEllipse(9, 18, 16, 4.5).fillEllipse(3, 21, 9, 4); // long tail
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(1.5, 22, 5, 3.6);
		g.fillStyle(C('#a8875a'), 1)
			.fillRect(12, 19, 3.6, 9)
			.fillRect(18, 20, 3.6, 8)
			.fillRect(28, 19, 3.6, 9)
			.fillRect(33, 20, 3.6, 8); // longer legs
		g.fillStyle(C('#8f7048'), 1)
			.fillEllipse(13.8, 28, 5.4, 2.6)
			.fillEllipse(19.8, 28, 5.4, 2.6)
			.fillEllipse(29.8, 28, 5.4, 2.6)
			.fillEllipse(34.8, 28, 5.4, 2.6);
		g.fillStyle(C('#c2a068'), 1).fillEllipse(24, 16, 32, 10); // lean body
		g.fillEllipse(14, 16, 11, 10).fillEllipse(31, 15, 10, 10); // slighter haunch and shoulder
		g.fillStyle(C('#d8bc8c'), 1).fillEllipse(24, 19, 21, 3.4); // belly line
		g.fillStyle(C('#c2a068'), 1).fillEllipse(38, 12, 12, 10); // wider, flatter cat head
		g.fillTriangle(33, 5, 37, 10, 32.5, 10).fillTriangle(43, 5, 44, 10, 39.5, 10); // ears set wide
		g.fillStyle(C('#8f7048'), 1)
			.fillTriangle(33.6, 6.6, 36, 9.6, 33.2, 9.6)
			.fillTriangle(42.4, 6.6, 43.2, 9.6, 40.4, 9.6);
		g.fillStyle(C('#f0e2c8'), 1).fillEllipse(39.5, 15, 6, 3.6); // small muzzle
		g.fillStyle(C('#8f7048'), 1).fillEllipse(36.8, 13.4, 1.1, 2).fillEllipse(42.2, 13.4, 1.1, 2); // soft cheek shading
		g.fillStyle(C('#241a12'), 1).fillTriangle(39.5, 13.2, 38.6, 14.4, 40.4, 14.4); // nose
		g.fillStyle(C('#c9a24a'), 1).fillEllipse(35.6, 11.4, 2.8, 2).fillEllipse(40.4, 11.4, 2.8, 2); // eyes
		g.fillStyle(C('#241a12'), 1).fillCircle(35.6, 11.4, 0.9).fillCircle(40.4, 11.4, 0.9);
	}),
	rocksquirrel: def(30, 26, (g) => {
		g.fillStyle(C('#9a8a68'), 1).fillEllipse(6, 14, 11, 16); // full bushy tail held up
		g.fillStyle(C('#b8a882'), 1).fillEllipse(6, 14, 7, 12);
		g.fillStyle(C('#8a7a58'), 1).fillRect(13, 18, 3.6, 6).fillRect(19, 18, 3.6, 6); // legs
		g.fillStyle(C('#a89568'), 1).fillEllipse(17, 15, 20, 12); // body
		g.fillStyle(C('#e0d2b0'), 1).fillEllipse(13, 8, 9, 4).fillEllipse(21, 8, 9, 4); // pale mantle over the shoulders
		g.fillStyle(C('#a89568'), 1).fillCircle(24, 11, 5.4); // head
		g.fillStyle(C('#8a7a58'), 1).fillCircle(22.5, 6.6, 2.2); // small round ear
		g.fillStyle(C('#e0d2b0'), 1).fillEllipse(27, 13, 6, 4); // pale cheek
		g.fillStyle(C('#241a12'), 1).fillCircle(29, 12.4, 1); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(25, 10, 1.2); // eye
	}),
	kangaroorat: def(32, 24, (g) => {
		g.lineStyle(1.8, C('#c9ab7c'), 1).lineBetween(7, 16, 2, 8); // long tail sweeping up
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(2, 6, 4, 5); // dark tail tuft
		g.fillStyle(C('#c9ab7c'), 1).fillEllipse(12, 15, 15, 11); // heavy hind haunch
		g.fillStyle(C('#b8996a'), 1).fillRect(10, 19, 4, 4); // hind foot, flat on the ground
		g.fillEllipse(11.5, 22.5, 7, 2.6);
		g.fillStyle(C('#c9ab7c'), 1).fillEllipse(20, 14, 16, 10); // body, low and level
		g.fillStyle(C('#e8d8b4'), 1).fillEllipse(20, 17, 13, 4); // pale underside
		g.fillStyle(C('#b8996a'), 1).fillRect(19, 18, 2.6, 4).fillRect(23, 18, 2.6, 4); // two forelegs, both down
		g.fillStyle(C('#c9ab7c'), 1).fillCircle(27, 11, 5.6); // big head
		g.fillEllipse(25, 5.6, 3.4, 4.6).fillEllipse(29.5, 5.8, 3.2, 4.4); // tall rounded ears
		g.fillStyle(C('#e8d8b4'), 1).fillEllipse(30, 13, 5, 3.4); // pale cheek pouch
		g.fillStyle(C('#2e2018'), 1).fillCircle(28.6, 9.6, 1.5); // big dark night eye
		g.fillStyle(C('#3a2c1c'), 1).fillCircle(31.6, 12.4, 0.9); // nose
		g.lineStyle(0.6, C('#e8d8b4'), 1).lineBetween(31, 12, 34, 10).lineBetween(31, 13, 34, 14); // whiskers
	}),
};

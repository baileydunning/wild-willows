	a('barnowl', 26, 30, (g) => {
		// no ear tufts anywhere — a pale heart-shaped facial disc is the whole read
		g.fillStyle(C('#c9a15a'), 1).fillRect(9, 27, 2.4, 3).fillRect(15, 27, 2.4, 3); // feet
		g.fillStyle(C('#c49a52'), 1).fillEllipse(13, 18, 20, 22); // golden-buff back
		g.fillStyle(C('#8a6a3c'), 0.8).fillCircle(6, 15, 1.2).fillCircle(20, 14, 1.2).fillCircle(9, 22, 1.1); // dusted back speckles
		g.fillStyle(C('#f4efe6'), 1).fillEllipse(13, 21, 13, 16); // white underside
		g.fillStyle(C('#f8f3e8'), 1).fillCircle(9.5, 9, 5).fillCircle(16.5, 9, 5).fillTriangle(5, 10, 21, 10, 13, 19); // heart-shaped facial disc
		g.fillStyle(C('#c9a15a'), 0.7).fillTriangle(4.5, 8, 6, 12, 8, 8).fillTriangle(21.5, 8, 20, 12, 18, 8); // buff rim of the disc
		g.fillStyle(C('#2b2018'), 1).fillCircle(10, 10, 1.9).fillCircle(16, 10, 1.9); // dark eyes
		g.fillStyle(C('#e0d2b4'), 1).fillTriangle(13, 12, 11.6, 16.5, 14.4, 16.5); // pale beak down the middle of the heart
	});
	a('lynx', 34, 28, (g) => {
		// silver-grey cat read from the extremes: stub tail, giant paws, tufts, ruff
		g.fillStyle(C('#a9a396'), 1).fillEllipse(6, 13, 10, 6); // stubby tail
		g.fillStyle(C('#2a2622'), 1).fillEllipse(2.5, 13, 5, 5.5); // black tail tip
		g.fillStyle(C('#8f8a7e'), 1).fillRect(10, 17, 4, 7).fillRect(20, 17, 4, 7); // short legs
		g.fillStyle(C('#b8b2a6'), 1).fillEllipse(17, 15, 22, 14).fillCircle(26, 10, 7); // body + broad head
		g.fillStyle(C('#cfcabd'), 1).fillEllipse(11, 24, 12, 7).fillEllipse(22, 24, 12, 7); // huge snowshoe paws
		g.fillStyle(C('#8f8a7e'), 0.6).fillCircle(13, 12, 1.5).fillCircle(19, 17, 1.5).fillCircle(9, 16, 1.3); // faint coat spots
		g.fillStyle(C('#e6e2d8'), 1).fillTriangle(19, 10, 23, 20, 26, 12).fillTriangle(33, 10, 29, 20, 26, 12); // thick cheek ruff
		g.fillStyle(C('#b8b2a6'), 1).fillTriangle(21, 3, 24, 9, 19, 9).fillTriangle(31, 3, 33, 9, 28, 9); // ears
		g.fillStyle(C('#2a2622'), 1).fillTriangle(21.5, 0, 23.5, 4, 20, 4).fillTriangle(30.5, 0, 32, 4, 28.5, 4); // black ear tufts
		g.fillStyle(C('#2e2018'), 1).fillCircle(24, 9, 1.3).fillCircle(29, 9, 1.3); // eyes
	});
	a('grizzly', 40, 32, (g) => {
		// the shoulder hump is the silhouette — everything else hangs off it
		g.fillStyle(C('#4a3524'), 1).fillRoundedRect(9, 21, 8, 10, 3); // hind leg
		g.fillStyle(C('#7a5636'), 1).fillEllipse(18, 19, 30, 16); // barrel body
		g.fillCircle(25, 12, 8); // the muscular hump, riding high over the forelegs
		g.fillStyle(C('#a4855c'), 0.85).fillEllipse(23, 7, 16, 5); // grizzled pale tips along the hump
		g.fillStyle(C('#4a3524'), 1).fillRoundedRect(26, 21, 9, 10, 3); // heavy foreleg
		g.fillStyle(C('#7a5636'), 1).fillCircle(32, 19, 6.5); // head, carried low below the hump
		g.fillStyle(C('#654529'), 1).fillCircle(28, 13, 2.6).fillCircle(35, 13.5, 2.6); // small round ears
		g.fillStyle(C('#9c7c52'), 1).fillEllipse(36, 21, 8, 5); // dished muzzle
		g.fillStyle(C('#e8e2d2'), 1).fillTriangle(27, 30, 29, 31.6, 27, 32).fillTriangle(30, 30, 32, 31.6, 30, 32).fillTriangle(33, 30, 35, 31.6, 33, 32); // long front claws
		g.fillStyle(C('#1a1410'), 1).fillEllipse(39, 20.5, 2.4, 2); // nose
		g.fillStyle(C('#2e2018'), 1).fillCircle(31, 17, 1.3).fillCircle(35, 17.5, 1.3); // eyes
	});
	a('orca', 38, 28, (g) => {
		// the tall dorsal fin is the read; black over a sharply cut white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(15, 14, 20, 0, 24, 14); // tall triangular dorsal fin
		g.fillTriangle(1, 9, 8, 16, 1, 15).fillTriangle(1, 23, 8, 16, 1, 17); // tail flukes
		g.fillEllipse(19, 17, 32, 13); // black body, blunt-headed
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(20, 20.5, 26, 5); // sharp white belly
		g.fillStyle(C('#16181c'), 1).fillTriangle(19, 20, 27, 22, 20, 27); // pectoral flipper
		g.fillStyle(C('#6a6f76'), 0.75).fillEllipse(13, 13, 10, 4); // grey saddle behind the fin
		g.fillStyle(C('#f4f4f0'), 1).fillEllipse(31, 13.5, 6.5, 3); // white eye patch
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 16, 1.2); // eye
	});
	a('graywhale', 40, 24, (g) => {
		// mottled grey, no dorsal fin at all — only a low knuckled ridge
		g.fillStyle(C('#767b7c'), 1).fillTriangle(1, 6, 10, 13, 1, 12).fillTriangle(1, 20, 10, 13, 1, 14); // broad flukes
		g.fillEllipse(20, 13, 30, 12); // heavy body
		g.fillTriangle(30, 8, 39, 14, 30, 19); // long tapering head
		g.fillStyle(C('#8e9394'), 1).fillCircle(10, 8, 1.8).fillCircle(13.5, 7.4, 1.8).fillCircle(17, 7.2, 1.8).fillCircle(20.5, 7.6, 1.6); // knuckled ridge where a fin would be
		g.fillStyle(C('#9aa0a0'), 0.65).fillEllipse(16, 16, 11, 5).fillEllipse(25, 10, 8, 4); // grey mottling
		g.fillStyle(C('#d8d2bf'), 1).fillCircle(32, 11, 2.2).fillCircle(35, 13, 1.7).fillCircle(33, 16, 1.5); // barnacle crust
		g.fillStyle(C('#5f6465'), 1).fillTriangle(22, 18, 30, 20, 23, 23); // paddle flipper
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 15.5, 1); // small eye
	});
	a('octopus', 32, 30, (g) => {
		// bulbous mantle over curling arms, one arm reaching out to the right
		g.lineStyle(3, C('#8c3f5a'), 1);
		g.lineBetween(11, 19, 5, 22).lineBetween(5, 22, 2, 28); // arm curling back
		g.lineBetween(14, 21, 11, 26).lineBetween(11, 26, 16, 29); // arms curling under
		g.lineBetween(17, 21, 21, 26).lineBetween(21, 26, 17, 29);
		g.lineBetween(19, 19, 26, 22).lineBetween(26, 22, 31, 17); // one arm reaching out
		g.fillStyle(C('#a24f6c'), 1).fillEllipse(14, 11, 21, 18); // bulbous mantle
		g.fillStyle(C('#8c3f5a'), 1).fillEllipse(15, 19, 17, 9); // head mass where the arms gather
		g.fillStyle(C('#e6c9b4'), 1).fillEllipse(20, 15, 8, 5.5); // big eye
		g.fillStyle(C('#2e2018'), 1).fillRect(17, 14.2, 6, 1.8); // horizontal slit pupil
		g.fillStyle(C('#e0a2b6'), 1).fillCircle(24, 22, 1.2).fillCircle(28, 21, 1.2).fillCircle(30, 18, 1.1).fillCircle(7, 24, 1.2).fillCircle(13, 27, 1.1); // suckers
	});
	a('moth', 34, 26, (g) => {
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
		for (let i = 1; i <= 3; i++) g.lineBetween(16 - i * 2, 5 - i * 0.75, 16 - i * 2, 2.4 - i * 0.75).lineBetween(18 + i * 2, 5 - i * 0.75, 18 + i * 2, 2.4 - i * 0.75); // feathery comb teeth
	});
	a('javelina', 34, 26, (g) => {
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
	});
	a('crayfish', 36, 26, (g) => {
		// two big pincers held forward, segmented abdomen ending in a tail fan
		g.fillStyle(C('#8e3a24'), 1).fillTriangle(1, 6, 9, 13, 1, 20); // tail fan
		g.fillStyle(C('#a8492c'), 1).fillEllipse(9, 13, 6, 8).fillEllipse(13, 13, 6, 9.5).fillEllipse(17, 13, 6, 11); // segmented abdomen
		g.lineStyle(1.4, C('#7a2f1c'), 1).lineBetween(19, 17, 17, 22).lineBetween(23, 18, 22, 23).lineBetween(26, 18, 26, 23); // walking legs
		g.fillStyle(C('#b8563a'), 1).fillEllipse(24, 13, 14, 12); // carapace
		g.fillStyle(C('#a8492c'), 1).fillEllipse(29, 7, 10, 4).fillEllipse(29, 19, 10, 4); // claw arms thrown forward
		g.fillStyle(C('#c46248'), 1).fillEllipse(33, 5, 7, 5.5).fillEllipse(33, 21, 7, 5.5); // big pincers
		g.lineStyle(1, C('#6e2a18'), 1).lineBetween(30.5, 5, 36, 3.5).lineBetween(30.5, 21, 36, 22.5); // pincer gape
		g.lineStyle(1, C('#7a2f1c'), 1).lineBetween(30, 10, 20, 2).lineBetween(30, 16, 18, 24); // long antennae
		g.fillStyle(C('#2e2018'), 1).fillCircle(29, 11, 1.1).fillCircle(29, 15, 1.1); // stalked eyes
	});
	a('shrimp', 26, 24, (g) => {
		// small, translucent, curled into a comma; many tiny legs, long antennae
		g.lineStyle(1, C('#b8a892'), 1).lineBetween(20, 5, 3, 1).lineBetween(20, 7, 1, 7); // long trailing antennae
		g.fillStyle(C('#efe2d2'), 0.85).fillCircle(18, 8, 5).fillCircle(13, 11, 4.6).fillCircle(9, 15, 4).fillCircle(10, 20, 3.2); // translucent comma body
		g.fillStyle(C('#efe2d2'), 0.65).fillTriangle(11, 21, 17, 23, 16, 18); // tail fan
		g.fillStyle(C('#d6c1a6'), 0.6).fillEllipse(15, 10, 9, 3); // faint gut line showing through
		g.lineStyle(1, C('#c8b7a0'), 1);
		for (let i = 0; i < 5; i++) g.lineBetween(18 - i * 1.8, 12 + i * 2, 21 - i * 1.8, 13.5 + i * 2); // many tiny legs
		g.fillStyle(C('#2e2018'), 1).fillCircle(20, 6, 1.3); // dark eye
	});
	a('pillbug', 26, 22, (g) => {
		// overlapping armour plates in a domed row, partly curled forward
		g.lineStyle(1.2, C('#3a3e44'), 1);
		for (let i = 0; i < 7; i++) g.lineBetween(4 + i * 2.6, 17, 3 + i * 2.6, 21); // seven pairs of legs
		g.fillStyle(C('#4e535a'), 1).fillEllipse(13, 13, 24, 16); // domed slate body
		g.fillStyle(C('#646a72'), 1);
		for (let i = 0; i < 6; i++) g.fillEllipse(5 + i * 3.2, 11 + i * 0.6, 6.4, 13 - i); // overlapping armour plates
		g.lineStyle(1, C('#33373c'), 1);
		for (let i = 0; i < 6; i++) g.lineBetween(8 + i * 3.2, 5.5 + i * 1, 8 + i * 3.2, 18); // plate seams
		g.fillStyle(C('#3f444a'), 1).fillEllipse(22, 14, 7, 10); // head end tucking under as it curls
		g.lineStyle(1, C('#3a3e44'), 1).lineBetween(24, 11, 25, 8); // short antenna
		g.fillStyle(C('#2e2018'), 1).fillCircle(23.5, 12, 1); // eye
	});
	a('bananaslug', 34, 22, (g) => {
		// long soft yellow body with dark speckles, eye stalks up, slime behind
		g.fillStyle(C('#d6e0cc'), 0.5).fillEllipse(12, 19, 22, 4); // glistening slime trail
		g.fillStyle(C('#e3c451'), 1).fillEllipse(17, 13, 28, 10).fillEllipse(27, 11, 12, 9); // long body + raised head end
		g.fillStyle(C('#e3c451'), 1).fillTriangle(2, 13, 8, 9, 8, 17); // tapered tail
		g.fillStyle(C('#efd97a'), 1).fillEllipse(15, 10, 15, 5); // pale mantle saddle
		g.fillStyle(C('#6b5a1e'), 1).fillCircle(9, 13, 1.3).fillCircle(15, 12, 1.2).fillCircle(20, 15, 1.3).fillCircle(24, 10, 1.1).fillCircle(12, 16, 1.1); // dark speckles
		g.lineStyle(1.6, C('#e3c451'), 1).lineBetween(30, 9, 32, 3).lineBetween(27, 9, 28, 4); // raised eye stalks
		g.fillStyle(C('#2e2018'), 1).fillCircle(32, 3, 1.2).fillCircle(28, 4, 1.1); // eye dots on the stalks
	});
	a('snowflea', 28, 20, (g) => {
		// barely a grain of an animal, dark on snow, with its spring tail cocked
		g.fillStyle(C('#f2f4f6'), 1).fillEllipse(14, 16, 28, 8); // snow surface
		g.fillStyle(C('#d8dee4'), 1).fillEllipse(5, 15, 5, 2.5).fillEllipse(11, 13.5, 4, 2); // hop marks pocked in the snow
		g.lineStyle(1.2, C('#2b2f36'), 1).lineBetween(18, 11, 15, 14).lineBetween(15, 14, 19, 15); // furcula — the springing tail fork
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(20, 12, 19, 15).lineBetween(23, 12, 23.5, 15); // stubby legs
		g.fillStyle(C('#2b2f36'), 1).fillEllipse(21, 9, 9, 6.5); // tiny dark springtail body
		g.fillStyle(C('#3d434c'), 1).fillCircle(25, 8, 2.6); // head
		g.lineStyle(1, C('#2b2f36'), 1).lineBetween(26, 6, 27.5, 3); // antenna
		g.fillStyle(C('#e8eef4'), 1).fillCircle(25.5, 7, 0.9); // eye, pale against the dark body
	});
	a('beachhopper', 28, 24, (g) => {
		// sand-coloured and laterally flattened, curled like a comma mid-jump
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(19, 5, 27, 1).lineBetween(19, 7, 27, 8); // long antennae
		g.fillStyle(C('#d9c49b'), 1).fillCircle(16, 8, 5.6).fillCircle(11, 12, 5).fillCircle(9, 18, 4.2); // flattened body curled forward
		g.fillStyle(C('#d9c49b'), 0.9).fillTriangle(9, 21, 15, 23, 12, 17); // tail flick
		g.lineStyle(1, C('#b09a74'), 1).lineBetween(13, 4, 10, 10).lineBetween(8, 8, 5, 14).lineBetween(5, 15, 7, 20); // segment seams down the flank
		g.lineStyle(1.6, C('#c2ab84'), 1).lineBetween(17, 12, 22, 18).lineBetween(22, 18, 18, 22); // big kicking hind leg
		g.lineStyle(1, C('#c2ab84'), 1);
		for (let i = 0; i < 4; i++) g.lineBetween(17 - i * 2, 12 + i * 1.6, 20 - i * 2, 15 + i * 1.6); // small legs
		g.fillStyle(C('#2e2018'), 1).fillCircle(19, 6, 1.2); // eye
	});
	a('hermitcrab', 30, 26, (g) => {
		// the borrowed shell is the read — the crab spills out of its mouth
		g.fillStyle(C('#c9a978'), 1).fillCircle(11, 14, 10); // outer whorl of the coiled shell
		g.fillStyle(C('#dcbe8e'), 1).fillCircle(9, 11, 6.8); // second whorl
		g.fillStyle(C('#c9a978'), 1).fillCircle(11, 8.5, 4.4); // third whorl
		g.fillStyle(C('#dcbe8e'), 1).fillCircle(9.5, 6.5, 2.6).fillCircle(11, 5, 1.4); // whorls tightening to the apex
		g.lineStyle(1, C('#a8865a'), 1).lineBetween(3, 17, 19, 19).lineBetween(4, 10, 17, 13); // ridges spiralling round the shell
		g.fillStyle(C('#8e7146'), 1).fillEllipse(18, 19, 10, 11); // dark shell mouth
		g.lineStyle(1.8, C('#a8442e'), 1).lineBetween(19, 22, 23, 25).lineBetween(22, 21, 27, 23); // legs emerging
		g.fillStyle(C('#a8442e'), 1).fillEllipse(23, 19, 9, 6).fillEllipse(27, 17, 6, 5); // claw reaching out
		g.lineStyle(1.4, C('#a8442e'), 1).lineBetween(20, 16, 22, 11).lineBetween(23, 16, 26, 12); // eye stalks
		g.fillStyle(C('#2e2018'), 1).fillCircle(22, 10.5, 1.2).fillCircle(26, 11.5, 1.2); // eyes
	});
	a('termite', 30, 20, (g) => {
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
	});
	a('millipede', 32, 28, (g) => {
		// a long tube wound into a loose spiral, fringed with many tiny legs
		const seg: [number, number, number][] = [];
		for (let i = 0; i < 24; i++) {
			const t = i / 23,
				ang = t * Math.PI * 2.4 - Math.PI * 0.55;
			seg.push([16 + Math.cos(ang) * (12.5 - t * 7.5), 14 + Math.sin(ang) * (12.5 - t * 7.5) * 0.8, ang]);
		}
		g.lineStyle(1, C('#3a1a12'), 1);
		for (const [x, y, ang] of seg) g.lineBetween(x, y, x + Math.cos(ang) * 3.8, y + Math.sin(ang) * 3.4); // dense fringe of legs
		g.fillStyle(C('#6b3020'), 1);
		for (const [x, y] of seg) g.fillCircle(x, y, 3.2); // dark red-brown segmented tube
		g.fillStyle(C('#8a4028'), 0.7);
		for (const [x, y] of seg) g.fillCircle(x, y - 0.7, 1.5); // lighter ridge along the back
		g.fillStyle(C('#4a2014'), 1).fillCircle(seg[0][0], seg[0][1], 3.6); // head at the free end of the coil
		g.fillStyle(C('#2e2018'), 1).fillCircle(seg[0][0] + 1, seg[0][1] + 1, 1); // eye
	});

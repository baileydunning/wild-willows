	// --- Willow Meadow habitat objects ---

	// Abandoned stick nest: a flat grey raft slumped in a bare fork — wide and
	// untidy, deliberately nothing like the tight woven cup of `nest`.
	o('oldsticknest', 36, 28, (g) => {
		g.lineStyle(3, C('#6b5a44'), 1).lineBetween(6, 27, 16, 17).lineBetween(30, 27, 20, 17); // bare fork
		g.fillStyle(C('#6d6046'), 1).fillEllipse(18, 15, 32, 11); // raft of weathered sticks
		g.fillStyle(C('#8a7c60'), 1).fillEllipse(16, 12, 28, 7);
		g.lineStyle(1.2, C('#574c38'), 1);
		for (const [x1, y1, x2, y2] of [
			[3, 14, 15, 10],
			[6, 17, 20, 13],
			[12, 9, 32, 14],
			[9, 12, 28, 9],
			[14, 18, 33, 17],
		] as const)
			g.lineBetween(x1, y1, x2, y2); // loose twig ends
		g.fillStyle(C('#4a412f'), 1).fillEllipse(25, 16, 12, 5); // rim sagging on one side
		g.fillStyle(C('#d8cdb4'), 1).fillTriangle(28, 21, 34, 9, 31, 22); // barred feather caught in it
		g.lineStyle(0.7, C('#8a7a58'), 1).lineBetween(30, 19, 33, 12).lineBetween(30, 16, 33.5, 10);
	});

	// Bare soil scrape: raked mineral soil ringed by cut stubble. Flat and open —
	// a hole in the vegetation, not a mound.
	o('soilscrape', 34, 24, (g) => {
		g.fillStyle(C('#6e8a46'), 1).fillEllipse(17, 14, 33, 18); // cut grass stubble ring
		g.lineStyle(1, C('#88a35a'), 1);
		for (let i = 0; i < 10; i++) g.lineBetween(2 + i * 3.4, 13 + (i % 2) * 3, 2 + i * 3.4, 7 + (i % 2) * 3);
		g.fillStyle(C('#a89065'), 1).fillEllipse(17, 15, 24, 12); // scraped down to tan mineral soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(17, 14, 21, 9);
		g.fillStyle(C('#d8c79a'), 0.7).fillEllipse(13, 11, 11, 3);
		g.lineStyle(1, C('#a08a5e'), 0.9).lineBetween(8, 11, 26, 13).lineBetween(8, 14, 26, 16).lineBetween(9, 17, 25, 18); // rake lines
	});

	// Bluebird box: pale cedar on a slim pole with a flaring cone guard — the
	// silhouette is a lollipop on a stick, unlike the flush-mounted cavities.
	o('bluebirdbox', 26, 36, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRect(11, 19, 3.5, 17); // slim grey pole
		g.fillStyle(C('#9a8460'), 1).fillTriangle(2, 30, 24, 30, 13, 19); // predator guard flaring below
		g.fillStyle(C('#cdb68c'), 1).fillTriangle(4, 29, 22, 29, 13, 21);
		g.fillStyle(C('#d8c49c'), 1).fillRect(6, 5, 14, 15); // pale cedar box
		g.fillStyle(C('#bda87f'), 1).fillRect(6, 5, 4.5, 15);
		g.fillStyle(C('#a8916a'), 1).fillTriangle(2, 6, 22, 2, 22, 5).fillTriangle(2, 6, 2, 3, 22, 2); // sloped roof
		g.fillStyle(C('#2b2118'), 1).fillCircle(13, 11, 3.2); // round entrance hole
		g.fillStyle(C('#6b8cc4'), 1).fillCircle(13.6, 11.6, 1.4); // blue shoulder in the dark
	});

	// Brush form hollow: a fur-smoothed bowl pressed into dry grass under a twig
	// arch — a dish with two ear shadows in it, read from above.
	o('formhollow', 34, 24, (g) => {
		g.fillStyle(C('#c2ab72'), 1).fillEllipse(17, 16, 32, 15); // straw-gold grass
		g.lineStyle(1.4, C('#6b5a3c'), 1).lineBetween(2, 14, 11, 4).lineBetween(11, 4, 24, 5).lineBetween(24, 5, 32, 13); // low twig arch
		g.fillStyle(C('#a8925c'), 1).fillEllipse(17, 17, 23, 11); // pressed bowl
		g.fillStyle(C('#8a7648'), 1).fillEllipse(17, 18, 18, 8); // fur-smoothed floor
		g.fillStyle(C('#5f5133'), 0.85).fillEllipse(13, 17, 4, 9).fillEllipse(20, 17, 4, 9); // two long ear shadows
		g.fillStyle(C('#d8c795'), 0.6).fillEllipse(12, 13, 10, 3); // sun on the lip
	});

	// Bumblebee tussock: a shaggy fountain of blades with a thumb-sized hole at
	// the very base — the dome is the giveaway, plus one fat bee going in.
	o('nesttussock', 32, 32, (g) => {
		g.lineStyle(1.6, C('#8a9a4e'), 1);
		for (let i = 0; i < 11; i++) g.lineBetween(16, 26, 1 + i * 3, 3 + Math.abs(i - 5) * 3); // blades fountaining out
		g.fillStyle(C('#9aa85f'), 1).fillEllipse(16, 24, 28, 15); // shaggy dome
		g.fillStyle(C('#b0bd72'), 1).fillEllipse(13, 20, 18, 8);
		g.fillStyle(C('#5d5a33'), 1).fillEllipse(16, 27, 9, 6); // worn rim
		g.fillStyle(C('#241d10'), 1).fillEllipse(16, 28, 7, 5); // thumb-hole at the base
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(19, 28, 4.4, 3.2); // bee entering
		g.fillStyle(C('#3b2e25'), 1).fillRect(19.4, 27, 1.2, 2.6);
	});

	// Bunchgrass sod plugs: three squat turf cylinders in a row, one tipped on
	// its side to show the root mat. Blocky and countable, not a patch.
	o('sodplug', 34, 26, (g) => {
		for (const x of [7, 17]) {
			g.fillStyle(C('#4a3626'), 1).fillRect(x - 5, 12, 10, 10); // root-bound soil
			g.fillStyle(C('#3a2a1c'), 1).fillEllipse(x, 22, 10, 4);
			g.fillStyle(C('#8fa05a'), 1).fillEllipse(x, 12, 10, 5); // blue-green cap
			g.lineStyle(1.2, C('#6f8a45'), 1);
			for (const d of [-3, 0, 3]) g.lineBetween(x + d, 12, x + d * 1.5, 4);
		}
		g.fillStyle(C('#4a3626'), 1).fillEllipse(28, 18, 13, 10); // third plug tipped over
		g.fillStyle(C('#7a5c3c'), 1).fillEllipse(28, 18, 9, 6);
		g.lineStyle(0.8, C('#c9b183'), 1);
		for (const dy of [-3, -1, 1, 3]) g.lineBetween(24, 18 + dy, 32, 18 + dy * 1.2); // exposed root mat
	});

	// Crown eyrie: a deep pale stick bowl wedged in the topmost fork with sky all
	// round it — tall and narrow where the old hawk nest is wide and flat.
	o('crowneyrie', 30, 30, (g) => {
		g.fillStyle(C('#5a4634'), 1).fillRect(13, 20, 4, 10); // trunk top
		g.lineStyle(2.4, C('#5a4634'), 1).lineBetween(15, 22, 7, 15).lineBetween(15, 22, 23, 15); // crown fork
		g.fillStyle(C('#8a7452'), 1).fillEllipse(15, 16, 26, 14); // deep bowl
		g.fillStyle(C('#a89070'), 1).fillEllipse(15, 13, 26, 10); // sunlit pale sticks
		g.fillStyle(C('#4a3d2a'), 1).fillEllipse(15, 11, 15, 6); // dark cup interior
		g.lineStyle(1, C('#c4b08a'), 1);
		for (const [x1, y1, x2, y2] of [
			[1, 15, 13, 12],
			[5, 19, 27, 15],
			[3, 12, 21, 17],
			[11, 20, 29, 13],
		] as const)
			g.lineBetween(x1, y1, x2, y2); // sticks jutting into the air
		g.lineStyle(1.4, C('#5d8a4a'), 1).lineBetween(19, 11, 26, 6); // fresh green sprig on the rim
		g.fillStyle(C('#6da84e'), 1).fillEllipse(25, 6, 6, 3).fillEllipse(22, 8, 4.4, 2.4);
	});

	// Deep loam bank: a cutaway face in three chocolate layers with a spoil fan at
	// the foot — reads as a straight-edged cut, not a rounded mound.
	o('loambank', 34, 26, (g) => {
		g.fillStyle(C('#33261a'), 1).fillRect(3, 3, 28, 7); // dark topsoil
		g.fillStyle(C('#584530'), 1).fillRect(3, 10, 28, 6); // loam
		g.fillStyle(C('#7d6647'), 1).fillRect(3, 16, 28, 5); // subsoil
		g.fillStyle(C('#1e160d'), 0.8).fillRect(3, 9.2, 28, 1.2).fillRect(3, 15.2, 28, 1.2); // layer seams
		g.fillStyle(0xffffff, 0.16).fillRect(3, 3, 28, 2); // light off the cut face
		g.fillStyle(C('#7a6347'), 1).fillEllipse(17, 23, 30, 8); // freshly thrown soil
		g.fillStyle(C('#8c7454'), 1).fillEllipse(15, 22, 20, 5);
		g.fillStyle(C('#5a462f'), 1).fillCircle(9, 24, 1.6).fillCircle(21, 25, 1.4).fillCircle(26, 23, 1.2); // crumbs
	});

	// Domed grass nest: a hummock with a woven straw roof and a low arched tunnel
	// mouth at ground level, eggs just visible in the shadow.
	o('domednest', 32, 26, (g) => {
		g.fillStyle(C('#a8934f'), 1).fillEllipse(16, 18, 30, 16); // hummock
		g.fillStyle(C('#c8b46a'), 1).fillEllipse(16, 15, 28, 12); // grass roof
		g.lineStyle(0.9, C('#9a8442'), 1);
		for (const y of [10, 13, 16]) g.lineBetween(3, y, 29, y + 1); // woven courses
		for (const x of [8, 16, 24]) g.lineBetween(x, 8, x - 2, 20);
		g.fillStyle(C('#8a7436'), 1).fillEllipse(16, 21, 15, 10); // mouth rim
		g.fillStyle(C('#221b0e'), 1).fillEllipse(16, 22, 11, 7); // arched tunnel mouth
		g.fillStyle(C('#efe7cd'), 1).fillCircle(13, 22, 1.6).fillCircle(16, 21, 1.6).fillCircle(19, 22, 1.6).fillCircle(16, 24, 1.5); // speckled eggs
		g.fillStyle(C('#9a7448'), 1).fillCircle(12.6, 21.6, 0.5).fillCircle(19.4, 22.4, 0.5);
	});

	// Earthen fox den: two dark mouths in one mound with a pale spoil fan below.
	// Two openings is the tell — coyote dens get one wide one.
	o('foxden', 34, 26, (g) => {
		g.fillStyle(C('#7c6242'), 1).fillEllipse(17, 13, 32, 18); // earth mound
		g.fillStyle(C('#8f7450'), 1).fillEllipse(14, 9, 22, 10);
		g.fillStyle(C('#5c452c'), 1).fillEllipse(10, 15, 11, 9).fillEllipse(24, 16, 9, 7); // worn rims
		g.fillStyle(C('#2a1d12'), 1).fillEllipse(10, 16, 9, 7).fillEllipse(24, 17, 7, 5); // two den mouths
		g.fillStyle(C('#b49a70'), 1).fillEllipse(17, 23, 30, 7); // fan of dug soil
		g.fillStyle(C('#c9b183'), 1).fillEllipse(14, 22, 18, 4);
		g.fillStyle(C('#efe9dc'), 1).fillRect(19, 23, 6, 1.4).fillCircle(19, 23.7, 1.1).fillCircle(25, 23.7, 1.1); // gnawed bone
		g.fillStyle(C('#b4622e'), 1).fillEllipse(6, 21, 5, 3); // rust-red tuft of fur
	});

	// Grass thatch litter: springy dead layers pressed flat, straw-blond and
	// horizontal, with pale mushroom caps pushing up through the middle.
	o('thatchmat', 34, 22, (g) => {
		g.fillStyle(C('#9a8759'), 1).fillEllipse(17, 16, 32, 10); // packed bottom layer
		g.fillStyle(C('#b6a06a'), 1).fillEllipse(17, 13, 31, 9); // springy middle
		g.fillStyle(C('#cbb87f'), 1).fillEllipse(16, 10, 28, 7); // sun-bleached top
		g.lineStyle(1, C('#8d7a4c'), 0.9);
		for (let i = 0; i < 8; i++) g.lineBetween(3 + i * 4, 9 + (i % 3), 8 + i * 4, 12 - (i % 2) * 2); // flattened stems
		g.fillStyle(C('#5d4c30'), 0.8).fillEllipse(9, 12, 6, 1.6).fillEllipse(26, 15, 7, 1.8); // shadowed gaps
		g.fillStyle(C('#e8dcc0'), 1).fillRect(15, 7, 1.6, 5).fillRect(20, 6, 1.6, 5); // mushroom stalks
		g.fillStyle(C('#efe4cc'), 1).fillEllipse(15.8, 7, 7, 4).fillEllipse(20.8, 6, 6, 3.4); // pale caps
	});

	// Grasshopper egg-pod bank: a sunlit sandy ridge with one shoulder cut away so
	// two frothy cream pods show, buried like corks.
	o('eggpodbank', 34, 24, (g) => {
		g.fillStyle(C('#bda06d'), 1).fillEllipse(17, 15, 32, 16); // firm sandy ridge
		g.fillStyle(C('#d9c48a'), 1).fillEllipse(16, 11, 28, 9); // sunlit crest
		g.fillStyle(C('#6b5734'), 1).fillTriangle(17, 3, 33, 11, 33, 23); // cut-away face
		g.fillStyle(C('#846d44'), 1).fillTriangle(19, 6, 32, 12, 32, 21);
		g.fillStyle(C('#fbf4dc'), 1).fillEllipse(24, 12, 6, 10).fillEllipse(29, 17, 5.4, 9); // frothy egg pods
		g.fillStyle(C('#ddd0a6'), 1).fillEllipse(24, 14, 5, 5).fillEllipse(29, 19, 4.4, 4.4);
		g.lineStyle(0.7, C('#b9a97e'), 1).lineBetween(21.5, 10, 26.5, 10).lineBetween(21.5, 13, 26.5, 13); // foam banding
		g.fillStyle(C('#cbb277'), 1).fillCircle(8, 20, 1.4).fillCircle(12, 21, 1.1); // loose sand
	});

	// Hedgerow lane: a dark green wall seen end-on, tangled bare twigs under the
	// leaves and one narrow flight gap punched through at bird height.
	o('hedgerow', 36, 30, (g) => {
		g.lineStyle(1.2, C('#584732'), 1);
		for (let i = 0; i < 9; i++) g.lineBetween(3 + i * 4, 29, 6 + i * 3, 14); // tangled bare twigs
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 14, 36, 20); // dense hedge wall
		g.fillStyle(C('#3f5c39'), 1).fillCircle(7, 12, 8).fillCircle(18, 9, 9).fillCircle(29, 12, 8);
		g.fillStyle(C('#54774a'), 1).fillCircle(10, 8, 4).fillCircle(22, 6, 4.5).fillCircle(31, 10, 3.5); // sunlit leaf tops
		g.fillStyle(C('#1a2a18'), 1).fillEllipse(18, 17, 8, 10); // flight gap punched through
		g.fillStyle(C('#243a20'), 1).fillEllipse(18, 17, 5, 7);
		g.fillStyle(C('#2f4a2c'), 1).fillEllipse(18, 26, 34, 8); // shaded base
	});

	// Mantis ootheca: two stiff dead stems, one carrying a tan foam case ridged in
	// horizontal bands — a lump on a stick, no foliage at all.
	o('ootheca', 28, 32, (g) => {
		g.fillStyle(C('#7f8a5c'), 1).fillEllipse(14, 30, 22, 6); // dead grass base
		g.lineStyle(2, C('#c2b489'), 1).lineBetween(9, 30, 8, 2); // stiff pale stem
		g.lineStyle(1.6, C('#ab9d74'), 1).lineBetween(19, 30, 21, 5); // second stem
		g.fillStyle(C('#8f8258'), 1).fillEllipse(20.8, 15, 11, 16); // case, shaded side
		g.fillStyle(C('#a89a6c'), 1).fillEllipse(20, 15, 10, 15); // hardened foam
		g.fillStyle(C('#c8bb8c'), 1).fillEllipse(18.6, 13, 5, 9); // lit side
		g.lineStyle(0.8, C('#7d7049'), 1);
		for (const y of [10, 13, 16, 19]) g.lineBetween(15.5, y, 24.5, y + 0.6); // ridged banding
	});

	// Milkweed aphid colony: one green stem crawling with a dense band of lemon
	// dots, with a lady beetle larva climbing up toward them.
	o('aphidcluster', 26, 32, (g) => {
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(13, 30, 18, 5); // leaf litter base
		g.fillStyle(C('#4f8a38'), 1).fillRect(11, 2, 4, 29); // milkweed stem
		g.fillStyle(C('#6da84e'), 1).fillRect(11, 2, 1.5, 29);
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(6, 9, 12, 5).fillEllipse(20, 20, 12, 5); // paired leaves
		g.fillStyle(C('#e8d24a'), 1); // dense band of aphids
		for (const [x, y] of [
			[9, 7],
			[13, 6],
			[16, 8],
			[9, 10],
			[12, 10],
			[16, 11],
			[10, 13],
			[14, 13],
			[17, 14],
			[9, 16],
			[13, 16],
			[16, 17],
			[11, 19],
			[15, 20],
			[12, 22],
		] as const)
			g.fillCircle(x, y, 1.5);
		g.fillStyle(C('#f7ea8e'), 1).fillCircle(12.6, 5.6, 0.6).fillCircle(9.6, 12.6, 0.6).fillCircle(12.6, 15.6, 0.6).fillCircle(14.6, 19.6, 0.6);
		g.lineStyle(0.5, C('#2b2415'), 1).lineBetween(8, 8, 6.6, 9).lineBetween(17, 12, 18.4, 13).lineBetween(8, 17, 6.6, 18); // tiny black legs
		g.fillStyle(C('#e08030'), 1).fillEllipse(19, 26, 4, 7); // lady beetle larva
		g.fillStyle(C('#3b2e25'), 1).fillEllipse(19, 23.5, 3, 2.4);
	});

	// Milkweed rhizome bed: broad grey-green paddles on thick stems, dusty-pink
	// flower domes, and one pod split open spilling white silk.
	o('milkweedbed', 36, 32, (g) => {
		g.fillStyle(C('#4f6b3a'), 1).fillEllipse(18, 29, 32, 7); // rhizome bed
		g.lineStyle(2.4, C('#5d7a44'), 1).lineBetween(11, 29, 10, 8).lineBetween(24, 29, 26, 10); // thick stems
		g.fillStyle(C('#7f9273'), 1); // grey-green paddle leaves
		for (const [x, y, w, h] of [
			[5, 16, 13, 7],
			[17, 14, 13, 7],
			[4, 23, 12, 6],
			[31, 19, 10, 6],
			[20, 24, 13, 6],
		] as const)
			g.fillEllipse(x, y, w, h);
		g.fillStyle(C('#93a686'), 1).fillEllipse(5, 15, 8, 3).fillEllipse(18, 13, 8, 3); // leaf sheen
		g.fillStyle(C('#c98fa8'), 1).fillCircle(10, 7, 5).fillCircle(26, 9, 4.2); // dusty-pink flower balls
		g.fillStyle(C('#e0acc0'), 1).fillCircle(8.6, 5.6, 2).fillCircle(24.8, 7.8, 1.7);
		g.fillStyle(C('#8fa06a'), 1).fillEllipse(31, 12, 6, 11); // split seed pod
		g.fillStyle(C('#f4f0e6'), 1).fillEllipse(32, 9, 5, 6).fillCircle(34, 5, 2).fillCircle(30, 4, 1.6); // spilling silk
	});

	// Native thistle stand: three tall spiny stems with lavender shaving-brush
	// heads, one already blown to seed-down. Vertical and prickly.
	o('thistlestand', 32, 34, (g) => {
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(16, 31, 26, 7); // basal rosette
		g.lineStyle(2, C('#7d9078'), 1).lineBetween(8, 31, 7, 12).lineBetween(16, 31, 16, 7).lineBetween(24, 31, 25, 14); // grey-green stems
		g.lineStyle(0.8, C('#9aae94'), 1);
		for (const [x, y] of [
			[7, 16],
			[16, 12],
			[25, 18],
			[7, 22],
			[16, 19],
			[25, 24],
		] as const)
			g.lineBetween(x - 4, y + 2, x, y).lineBetween(x + 4, y + 3, x, y + 1); // spiny leaves
		g.fillStyle(C('#5f6b4a'), 1).fillEllipse(7, 12, 6, 5).fillEllipse(16, 7, 7, 6).fillEllipse(25, 14, 6, 5); // spiny bracts
		g.fillStyle(C('#9b6fa8'), 1).fillEllipse(7, 8, 7, 6).fillEllipse(16, 3, 8, 6); // shaving-brush blooms
		g.lineStyle(1, C('#b98ec4'), 1);
		for (const d of [-3, -1, 1, 3]) g.lineBetween(7 + d, 9, 7 + d * 1.5, 4).lineBetween(16 + d, 4, 16 + d * 1.5, 0);
		g.fillStyle(C('#f2efe6'), 1).fillCircle(25, 10, 5); // one head gone to seed-down
		g.fillStyle(0xffffff, 0.8).fillCircle(23.6, 8.6, 2.4);
	});

	// Pebble scrape: a ring of grey and cream stones on open gravel with four eggs
	// that match them almost exactly. Flat, stony, no green at all.
	o('pebblescrape', 34, 24, (g) => {
		g.fillStyle(C('#a29a8c'), 1).fillEllipse(17, 13, 33, 20); // open gravel
		g.fillStyle(C('#8e867a'), 1).fillCircle(5, 6, 2.2).fillCircle(28, 6, 2.2).fillCircle(4, 19, 2).fillCircle(31, 18, 2).fillCircle(17, 3, 2);
		g.fillStyle(C('#7d766a'), 1).fillEllipse(17, 14, 21, 12); // scraped dish
		const peb = ['#b9b0a0', '#cfc8b6', '#9d968a', '#c4bca8'];
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * 6.283;
			g.fillStyle(C(peb[i % 4]), 1).fillCircle(17 + Math.cos(a) * 11, 14 + Math.sin(a) * 7, 2.4); // pebble rim
		}
		g.fillStyle(C('#c9c0a8'), 1).fillEllipse(14, 13, 6, 4.6).fillEllipse(20, 12, 6, 4.6).fillEllipse(15, 17, 6, 4.6).fillEllipse(21, 16, 6, 4.6); // cryptic eggs
		g.fillStyle(C('#6e6558'), 1);
		for (const [x, y] of [
			[13, 12],
			[15, 14],
			[21, 11],
			[19, 13],
			[14, 17],
			[16, 18],
			[22, 16],
			[20, 17],
		] as const)
			g.fillCircle(x, y, 0.6); // speckling
		g.fillStyle(0xffffff, 0.22).fillEllipse(13, 11.4, 3, 1.6);
	});

	// Prairie swale seedbed: a dished scrape holding a shine of standing water,
	// sown seed on the surface and a green fringe of seedlings round the rim.
	o('swaleseedbed', 34, 24, (g) => {
		g.lineStyle(1.4, C('#6f7a4a'), 1);
		for (let i = 0; i < 11; i++) g.lineBetween(2 + i * 3.1, 9 + (i % 2) * 3, 3 + i * 3.1, 1 + (i % 3) * 2); // fringe of seedlings
		g.fillStyle(C('#86994f'), 1);
		for (let i = 0; i < 11; i++) g.fillEllipse(3 + i * 3.1, 1 + (i % 3) * 2, 3.4, 1.8);
		g.fillStyle(C('#4a3a26'), 1).fillEllipse(17, 15, 32, 16); // dish of loosened soil
		g.fillStyle(C('#5e4a30'), 1).fillEllipse(17, 13, 28, 12);
		g.fillStyle(C('#3a2c1c'), 1).fillEllipse(17, 15, 23, 11); // wet hollow
		g.fillStyle(C('#5d8fa8'), 0.75).fillEllipse(17, 15, 18, 8); // standing water
		g.fillStyle(0xffffff, 0.32).fillEllipse(13, 13, 8, 2.4); // sky shine on it
		g.fillStyle(C('#c9b183'), 1);
		for (const [x, y] of [
			[10, 12],
			[14, 17],
			[20, 12],
			[23, 16],
			[17, 19],
			[12, 19],
			[24, 11],
		] as const)
			g.fillCircle(x, y, 0.9); // scattered seed
	});

	// Serviceberry thicket: several grey stems fanning from the ground with purple
	// berry clusters, and lower twigs bitten off blunt by browsing.
	o('serviceberry', 34, 34, (g) => {
		g.lineStyle(2.4, C('#9a968c'), 1).lineBetween(17, 33, 9, 14).lineBetween(17, 33, 17, 11).lineBetween(17, 33, 25, 15); // multi-stemmed
		g.lineStyle(2, C('#8a8680'), 1).lineBetween(14, 26, 6, 24).lineBetween(20, 24, 27, 23); // lower twigs
		g.fillStyle(C('#b8b2a4'), 1).fillCircle(5.6, 24, 1.5).fillCircle(27.6, 23, 1.5); // blunt browse-clipped tips
		g.fillStyle(C('#5d7a4a'), 1); // small oval leaves
		for (const [x, y] of [
			[9, 12],
			[14, 9],
			[20, 10],
			[25, 13],
			[6, 17],
			[28, 17],
			[17, 6],
			[12, 16],
			[22, 17],
		] as const)
			g.fillEllipse(x, y, 7, 4);
		g.fillStyle(C('#749360'), 1).fillEllipse(13, 8, 6, 3.4).fillEllipse(24, 12, 6, 3.4); // sunlit leaves
		g.fillStyle(C('#4a3a6a'), 1).fillCircle(11, 15, 2.2).fillCircle(19, 13, 2.2).fillCircle(24, 19, 2.2); // berry clusters
		g.fillStyle(C('#6b53a0'), 1).fillCircle(10.2, 14.2, 1.1).fillCircle(18.2, 12.2, 1.1).fillCircle(23.2, 18.2, 1.1);
	});

	// Snake hibernaculum: a stone-lined shaft cut away in section, dropping past a
	// dashed frost line into a dark chamber with three snakes coiled inside.
	o('hibernaculum', 30, 34, (g) => {
		g.fillStyle(C('#79633f'), 1).fillRect(1, 4, 28, 30); // soil in section
		g.fillStyle(C('#9a958a'), 1); // stone lining
		for (const [x, y] of [
			[9, 6],
			[20, 6],
			[8, 11],
			[21, 11],
			[9, 16],
			[20, 16],
		] as const)
			g.fillCircle(x, y, 3.4);
		g.fillStyle(C('#241c12'), 1).fillRect(12, 4, 5, 15); // the shaft
		g.lineStyle(1, C('#a8c4d8'), 0.9);
		for (const x of [2, 7, 21, 26]) g.lineBetween(x, 13, x + 3, 13); // dashed frost line
		g.fillStyle(C('#1c150d'), 1).fillCircle(15, 25, 9); // chamber below the frost
		g.fillStyle(C('#3d6b4a'), 1).fillEllipse(15, 27, 15, 4).fillEllipse(13, 23, 12, 4).fillEllipse(17, 20, 10, 3.4); // coiled snakes
		g.lineStyle(0.8, C('#d9c86a'), 1).lineBetween(8, 27, 22, 27).lineBetween(7, 23, 19, 23).lineBetween(12, 20, 22, 20); // yellow stripes
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(15, 3, 22, 5); // capstone
	});

	// Squirrel burrow town: three craters joined by worn dirt paths, each with a
	// dark mouth, one animal standing bolt upright on the biggest mound.
	o('burrowtown', 36, 26, (g) => {
		g.fillStyle(C('#7f9450'), 1).fillEllipse(18, 15, 36, 22); // meadow floor
		g.lineStyle(3.4, C('#a89268'), 1).lineBetween(8, 19, 20, 21).lineBetween(20, 21, 30, 15); // worn paths between them
		const mounds: [number, number, number][] = [
			[8, 18, 8],
			[20, 20, 10],
			[30, 14, 7],
		];
		mounds.forEach(([x, y, r]) => {
			g.fillStyle(C('#8b7a5a'), 1).fillEllipse(x, y, r * 2, r); // crater rim
			g.fillStyle(C('#a3906c'), 1).fillEllipse(x, y - 1, r * 1.6, r * 0.6);
			g.fillStyle(C('#231a10'), 1).fillEllipse(x, y, r * 0.85, r * 0.45); // dark mouth
		});
		g.fillStyle(C('#9a7a4e'), 1).fillEllipse(24, 11, 3.4, 9).fillEllipse(20, 12, 5, 9); // tail and upright body
		g.fillStyle(C('#c4a878'), 1).fillEllipse(20, 13, 3, 5);
		g.fillStyle(C('#9a7a4e'), 1).fillCircle(20, 6, 2.6);
		g.fillStyle(C('#2b2118'), 1).fillCircle(19.2, 5.6, 0.7);
	});

	// Vole runways: seen from above — clipped channels winding through the grass
	// with seed husks and dark pellets dropped along them.
	o('volerunway', 36, 26, (g) => {
		g.fillStyle(C('#4f7a34'), 1).fillRect(1, 1, 34, 24); // dense grass from above
		g.fillStyle(C('#5d8a3c'), 1);
		for (let i = 0; i < 14; i++) g.fillEllipse(3 + ((i * 7) % 33), 3 + ((i * 5) % 21), 6, 4); // tufts
		const runs: [number, number, number, number][] = [
			[0, 8, 12, 9],
			[12, 9, 16, 20],
			[16, 20, 30, 18],
			[12, 9, 26, 5],
			[26, 5, 35, 12],
			[16, 20, 6, 24],
		];
		g.lineStyle(4.5, C('#6f8f3f'), 1);
		runs.forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d)); // clipped channels
		g.lineStyle(2, C('#a3bd72'), 1);
		runs.forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d)); // worn floor of each run
		g.fillStyle(C('#d9c78e'), 1).fillEllipse(6, 8, 2.4, 1.4).fillEllipse(14, 14, 2.4, 1.4).fillEllipse(22, 7, 2.4, 1.4).fillEllipse(28, 17, 2.4, 1.4); // seed husks
		g.fillStyle(C('#2e2418'), 1).fillEllipse(10, 9, 1.6, 1).fillEllipse(16, 17, 1.6, 1).fillEllipse(25, 6, 1.6, 1).fillEllipse(31, 17, 1.6, 1); // pellets
	});

	// Wet meadow sedge: a stiff triangular fountain in dark wet soil with water
	// standing round the base — darker and sharper-edged than the dryland `sedge`.
	o('sedgeclump', 32, 34, (g) => {
		g.fillStyle(C('#3a2e22'), 1).fillEllipse(16, 30, 30, 9); // dark damp soil
		g.fillStyle(C('#4a7a8a'), 0.65).fillEllipse(16, 31, 26, 6); // water pooling
		g.fillStyle(0xffffff, 0.25).fillEllipse(11, 30, 10, 2);
		g.fillStyle(C('#2f6b4e'), 1); // arching triangular blades
		for (let i = 0; i < 9; i++) {
			const s = i - 4;
			g.fillTriangle(16, 30, 16 + s * 3.6 - 1, 3 + Math.abs(s) * 5, 16 + s * 3.6 + 1.8, 4 + Math.abs(s) * 5);
		}
		g.fillStyle(C('#3f7a5c'), 1);
		for (const s of [-3, -1, 2]) g.fillTriangle(16, 29, 16 + s * 4 - 1, 6 + Math.abs(s) * 4, 16 + s * 4 + 1.4, 7 + Math.abs(s) * 4); // lit blades
		g.lineStyle(1.4, C('#6b5a3c'), 1).lineBetween(16, 28, 27, 12).lineBetween(16, 28, 6, 14); // seed spikes leaning out
		g.fillStyle(C('#8a6b42'), 1).fillEllipse(27, 11, 3.4, 6).fillEllipse(6, 13, 3.4, 6);
		g.fillStyle(C('#a3854f'), 1).fillEllipse(26.4, 10, 1.6, 3).fillEllipse(5.4, 12, 1.6, 3);
	});

	// Rotting log crumble: bark split off a core of orange punky crumb, curls of
	// grey bark shed either side, pillbugs dotted through the soft wood.
	o('punkylog', 36, 24, (g) => {
		g.fillStyle(C('#3a2c1e'), 1).fillEllipse(18, 21, 34, 7); // damp soil beneath
		g.fillStyle(C('#8e887c'), 1).fillEllipse(18, 14, 32, 14); // grey bark shell
		g.fillStyle(C('#a89570'), 1).fillEllipse(18, 11, 30, 8);
		g.fillStyle(C('#b5651f'), 1).fillEllipse(19, 15, 24, 11); // split open to punky orange
		g.fillStyle(C('#d1832e'), 1).fillEllipse(18, 14, 20, 8);
		g.fillStyle(C('#e0a04f'), 1).fillEllipse(11, 13, 4, 2.4).fillEllipse(16, 16, 4, 2.4).fillEllipse(22, 12, 4, 2.4).fillEllipse(26, 15, 4, 2.4); // crumbling fibre
		g.fillStyle(C('#7c746a'), 1).fillEllipse(4, 12, 7, 10).fillEllipse(32, 13, 6, 10); // bark peeling in curls
		g.fillStyle(C('#9a9288'), 1).fillEllipse(4, 11, 4, 6).fillEllipse(32, 12, 3.4, 6);
		g.fillStyle(C('#5a6068'), 1).fillEllipse(13, 17, 3, 2).fillEllipse(21, 18, 3, 2).fillEllipse(27, 13, 3, 2).fillEllipse(9, 19, 3, 2); // slate-grey pillbugs
		g.fillStyle(C('#7d848d'), 1).fillEllipse(13, 16.4, 2, 0.9).fillEllipse(21, 17.4, 2, 0.9);
	});

	// Orb web: an actual spiral strung between two dry stems, with the bold white
	// zigzag stitched down the middle and the spider hanging head-down at the hub.
	o('orbweb', 34, 34, (g) => {
		g.fillStyle(C('#7f8a5c'), 1).fillEllipse(17, 32, 22, 5); // dry ground
		g.lineStyle(2, C('#b8a878'), 1).lineBetween(4, 33, 3, 3).lineBetween(30, 33, 31, 4); // two upright stems
		g.lineStyle(0.7, C('#cfd6c2'), 0.95);
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * 6.283;
			g.lineBetween(17, 16, 17 + Math.cos(a) * 14, 16 + Math.sin(a) * 13); // radials
		}
		for (const r of [4.5, 7.5, 10.5, 13]) {
			let px = 17 + r,
				py = 16;
			for (let i = 1; i <= 12; i++) {
				const a = (i / 12) * 6.283,
					nx = 17 + Math.cos(a) * r,
					ny = 16 + Math.sin(a) * r * 0.93;
				g.lineBetween(px, py, nx, ny); // spiral rings
				px = nx;
				py = ny;
			}
		}
		g.lineStyle(1.6, 0xffffff, 0.9);
		for (let i = 0; i < 5; i++) g.lineBetween(17 + (i % 2 ? 3 : -3), 17 + i * 2.6, 17 + (i % 2 ? -3 : 3), 19.6 + i * 2.6); // zigzag stabilimentum
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(17, 14, 5, 8); // spider at the hub
		g.fillStyle(C('#2b2418'), 1).fillEllipse(17, 15, 5, 1.6).fillEllipse(17, 12, 5, 1.6).fillCircle(17, 18.6, 1.6);
		g.lineStyle(0.8, C('#2b2418'), 1).lineBetween(14, 12, 11, 9).lineBetween(20, 12, 23, 9);
	});

	// Bat maternity roost: a long horizontal slot under weathered boards with a
	// warm glow inside — a wide letterbox, not a round hole.
	o('batroost', 34, 26, (g) => {
		g.fillStyle(C('#7e7a72'), 1).fillRect(2, 2, 30, 11); // weathered grey boards
		g.fillStyle(C('#8e8a80'), 1).fillRect(2, 2, 30, 3).fillRect(2, 8, 30, 2.4);
		g.lineStyle(0.8, C('#5e5a52'), 1).lineBetween(2, 5, 32, 5).lineBetween(2, 10.6, 32, 10.6).lineBetween(12, 2, 12, 13); // plank seams
		g.fillStyle(C('#6b6760'), 1).fillRect(2, 13, 30, 3); // lintel over the slot
		g.fillStyle(C('#120d10'), 1).fillRect(4, 16, 26, 7); // narrow dark slot
		g.fillStyle(C('#4a3020'), 0.9).fillRect(5, 17, 24, 4); // warm brown glow inside
		g.fillStyle(C('#5a4a5e'), 1).fillEllipse(13, 19, 5, 7).fillEllipse(21, 19, 5, 7); // two folded bats
		g.fillStyle(C('#6e5c74'), 1).fillTriangle(11, 16, 15, 16, 12, 22).fillTriangle(19, 16, 23, 16, 20, 22); // one wing edge each
		g.fillStyle(C('#3d3242'), 1).fillTriangle(11.8, 17, 14.4, 17, 13.2, 14.2); // one ear showing
		g.fillStyle(C('#7e7a72'), 1).fillRect(2, 23, 30, 3); // sill below
	});

	// Barn loft nest box: red plank gable with a square loft opening, straw over
	// the sill and a pale heart face just inside the shadow.
	o('owlloft', 34, 32, (g) => {
		g.fillStyle(C('#8f3324'), 1).fillTriangle(1, 12, 17, 1, 33, 12); // gable peak
		g.fillStyle(C('#a83c2b'), 1).fillRect(3, 12, 28, 20); // weathered red planks
		g.lineStyle(0.9, C('#7a2a1d'), 1);
		for (const x of [8, 13, 18, 23, 28]) g.lineBetween(x, 12, x, 32); // plank seams
		g.fillStyle(C('#c05a44'), 0.45).fillRect(3, 12, 28, 2.4).fillRect(24, 12, 4, 20); // sun-bleached boards
		g.fillStyle(C('#6b2418'), 1).fillRect(9, 15, 16, 15); // opening frame
		g.fillStyle(C('#120e0a'), 1).fillRect(11, 17, 12, 13); // dark loft slot
		g.fillStyle(C('#8a6a3c'), 1).fillRect(9, 29, 16, 2); // sill
		g.lineStyle(1, C('#cbb87f'), 1).lineBetween(12, 29, 10, 32).lineBetween(17, 29, 19, 32).lineBetween(21, 30, 23, 32); // straw wisps
		g.fillStyle(C('#e6dcc8'), 1).fillEllipse(15, 21, 4.6, 6.4).fillEllipse(19, 21, 4.6, 6.4); // heart-shaped face
		g.fillStyle(C('#2b2118'), 1).fillCircle(15.4, 21, 1.1).fillCircle(18.6, 21, 1.1);
		g.fillStyle(C('#c9a05a'), 1).fillTriangle(17, 21, 16.2, 24, 17.8, 24); // beak
	});

	// Flicker cavity snag: a silver standing stub with one neat round hole
	// chiselled in it and pale chips at the foot — a tall pillar, not a box.
	o('flickerhole', 26, 36, (g) => {
		g.fillStyle(C('#8a8378'), 1).fillRect(6, 2, 14, 31); // silver-grey snag
		g.fillStyle(C('#9c8a6e'), 1).fillRect(6, 2, 5, 31); // lit face
		g.lineStyle(0.8, C('#6e675c'), 1).lineBetween(11, 3, 12, 32).lineBetween(16, 2, 15, 33); // weather checks
		g.fillStyle(C('#6b5a44'), 1).fillTriangle(6, 3, 20, 3, 13, 0); // broken top
		g.fillStyle(C('#5a4a34'), 1).fillCircle(13, 13, 5.4); // chiselled rim
		g.fillStyle(C('#181209'), 1).fillCircle(13, 13, 4.4); // the cavity
		g.fillStyle(C('#9a8258'), 1).fillEllipse(13, 14, 7.4, 5.4); // small owl filling it
		g.fillStyle(C('#b39a6c'), 1).fillTriangle(10, 12, 12, 12, 10.2, 9).fillTriangle(16, 12, 14, 12, 15.8, 9); // ear tufts
		g.fillStyle(C('#f2e08a'), 1).fillCircle(11.4, 13.4, 1.3).fillCircle(14.6, 13.4, 1.3);
		g.fillStyle(C('#2b2118'), 1).fillCircle(11.4, 13.4, 0.7).fillCircle(14.6, 13.4, 0.7);
		g.fillStyle(C('#e0d2b0'), 1).fillEllipse(5, 33, 4, 1.8).fillEllipse(9, 34, 4, 1.8).fillEllipse(14, 34, 4, 1.8).fillEllipse(19, 33, 4, 1.8); // pale chips at the foot
	});

	// Coyote natal den: a single wide dark mouth in a brush-topped bank, with a
	// packed trail leading in and paw tracks fanning across the dirt apron.
	o('coyoteden', 36, 26, (g) => {
		g.fillStyle(C('#7a6444'), 1).fillEllipse(18, 13, 36, 20); // low earth bank
		g.fillStyle(C('#8a6f4a'), 1).fillEllipse(16, 10, 30, 13);
		g.fillStyle(C('#4a5c38'), 1).fillCircle(6, 5, 5).fillCircle(15, 3, 6).fillCircle(25, 5, 5).fillCircle(32, 7, 4); // brush cap
		g.fillStyle(C('#5e7346'), 1).fillCircle(13, 1, 3).fillCircle(27, 3, 2.6);
		g.fillStyle(C('#5c4830'), 1).fillEllipse(16, 17, 17, 13); // worn mouth rim
		g.fillStyle(C('#150f08'), 1).fillEllipse(16, 18, 13, 10); // wide dark den mouth
		g.fillStyle(C('#c0a87e'), 1).fillEllipse(18, 24, 32, 6); // bare dirt apron
		g.fillStyle(C('#ab9068'), 1).fillEllipse(16, 23, 10, 5); // packed trail leading in
		g.fillStyle(C('#6b573a'), 1);
		for (const [x, y] of [
			[7, 24],
			[11, 22],
			[25, 23],
			[29, 25],
			[22, 25],
		] as const) {
			g.fillEllipse(x, y, 2.6, 2);
			g.fillCircle(x - 1, y - 1.7, 0.5).fillCircle(x + 1, y - 1.7, 0.5); // paw tracks
		}
	});

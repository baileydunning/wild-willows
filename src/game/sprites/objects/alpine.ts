// Graywind Heights.

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const ALPINE: SpriteSet = {
	talus: def(34, 26, (g) => {
		const rocks: [number, number, number][] = [
			[8, 20, 7],
			[18, 21, 8],
			[27, 20, 6],
			[13, 13, 6],
			[22, 13, 6],
			[17, 7, 5],
		];
		rocks.forEach(([x, y, r], i) => g.fillStyle(C(['#9a948a', '#8e8e8a', '#a8a29a'][i % 3]), 1).fillCircle(x, y, r));
	}),
	nestshelf: def(32, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillRoundedRect(2, 12, 28, 11, 2); // rock ledge
		g.fillStyle(C('#6b8a4a'), 1).fillEllipse(16, 12, 22, 7); // mossy lining
		g.fillStyle(C('#caa15a'), 1).fillCircle(11, 11, 1.8).fillCircle(16, 12, 1.8).fillCircle(21, 11, 1.8); // eggs
	}),
	heather: def(34, 24, (g) => {
		g.fillStyle(C('#6f8a5a'), 1).fillEllipse(17, 17, 32, 12);
		g.fillStyle(C('#a06aa8'), 1);
		for (const [x, y] of [
			[8, 12],
			[14, 9],
			[20, 11],
			[26, 10],
			[11, 14],
			[23, 14],
		] as const)
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#c89ad0'), 1).fillCircle(14, 8, 1.2).fillCircle(26, 9, 1.2);
	}),
	krummholz: def(34, 36, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRect(15, 26, 4, 10);
		g.fillStyle(C('#3f5e3a'), 1);
		g.fillTriangle(6, 28, 26, 24, 14, 10); // wind-bent canopy leaning right
		g.fillTriangle(10, 20, 28, 17, 17, 6);
		g.fillStyle(C('#4f7048'), 1).fillTriangle(12, 14, 26, 12, 19, 4);
	}),
	gentian: def(32, 24, (g) => {
		g.fillStyle(C('#5e7a4a'), 1).fillEllipse(16, 19, 28, 10);
		g.fillStyle(C('#3a6ad0'), 1);
		for (const [x, y] of [
			[10, 11],
			[18, 9],
			[25, 12],
			[14, 15],
		] as const) {
			for (const a of [0, 1.26, 2.51, 3.77, 5.03])
				g.fillEllipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.4, 3.2);
		}
	}),
	cushion: def(30, 18, (g) => {
		g.fillStyle(C('#6fae5a'), 1).fillEllipse(15, 12, 28, 12);
		g.fillStyle(C('#5a9a48'), 1).fillCircle(9, 10, 3).fillCircle(17, 9, 3).fillCircle(23, 11, 3);
		g.fillStyle(C('#d77bb1'), 1).fillCircle(12, 9, 1.2).fillCircle(20, 10, 1.2).fillCircle(16, 12, 1.2);
	}),
	fir: def(30, 46, (g) => {
		g.fillStyle(C('#5a4632'), 1).fillRect(13, 38, 4, 8);
		g.fillStyle(C('#3f5e48'), 1); // very narrow spire
		g.fillTriangle(7, 40, 23, 40, 15, 26)
			.fillTriangle(8, 30, 22, 30, 15, 16)
			.fillTriangle(10, 20, 20, 20, 15, 6)
			.fillTriangle(12, 12, 18, 12, 15, 2);
	}),
	aspen: def(32, 42, (g) => {
		g.fillStyle(C('#e8e6df'), 1).fillRect(14, 18, 4, 24); // white trunk
		g.fillStyle(0x2e2e2e, 1).fillRect(14, 25, 4, 1.4).fillRect(14, 32, 4, 1.4);
		g.fillStyle(C('#c9b34a'), 1).fillCircle(16, 12, 11).fillCircle(8, 17, 6).fillCircle(24, 17, 6); // gold autumn canopy
	}),
	// --- Graywind Heights (alpine) exclusive crafts ---
	haypile: def(32, 26, (g) => {
		g.fillStyle(C('#cdbc7e'), 1).fillEllipse(16, 19, 30, 13); // cured grass mound
		g.fillStyle(C('#bda968'), 1).fillEllipse(16, 22, 30, 7);
		g.lineStyle(1.4, C('#a8923f'), 1);
		for (const x of [6, 11, 16, 21, 26]) g.lineBetween(x, 18, x + (x % 2 ? 2 : -2), 6); // stray stalks
		g.fillStyle(C('#d77bb1'), 1).fillCircle(10, 12, 1.6).fillCircle(22, 13, 1.6); // dried flowers
	}),
	lichenrock: def(34, 26, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(17, 16, 30, 18); // boulder
		g.fillStyle(C('#a8a29a'), 1).fillEllipse(12, 11, 12, 8);
		g.fillStyle(C('#9fb38a'), 1).fillCircle(22, 12, 4).fillCircle(9, 18, 3.4).fillCircle(26, 19, 3); // lichen
		g.fillStyle(C('#c2cf9e'), 1).fillCircle(22, 12, 2).fillCircle(9, 18, 1.6);
		g.fillStyle(C('#d9a24a'), 1).fillCircle(15, 8, 1.6); // map-lichen fleck
	}),
	scree: def(36, 26, (g) => {
		const cols = ['#9a948a', '#8e8e8a', '#a8a29a', '#7e7c78'];
		const rocks: [number, number, number][] = [
			[6, 21, 5],
			[13, 22, 6],
			[21, 22, 6],
			[29, 21, 5],
			[10, 15, 5],
			[18, 15, 5],
			[26, 15, 5],
			[14, 9, 4],
			[22, 9, 4],
		];
		rocks.forEach(([x, y, r], i) => {
			g.fillStyle(C(cols[i % 4]), 1).fillCircle(x, y, r);
			g.fillStyle(0xffffff, 0.18).fillCircle(x - r / 3, y - r / 3, r / 3);
		});
	}),
	snowbank: def(36, 24, (g) => {
		g.fillStyle(C('#cdd9e8'), 1).fillEllipse(18, 18, 34, 12); // shadowed base
		g.fillStyle(C('#eef4fb'), 1).fillEllipse(18, 15, 32, 12); // drift
		g.fillStyle(0xffffff, 1).fillEllipse(13, 12, 16, 7);
		g.fillStyle(C('#bfe0f0'), 0.7).fillEllipse(26, 18, 10, 3); // meltwater glint
	}),
	seedcache: def(30, 26, (g) => {
		g.fillStyle(C('#7c6248'), 1).fillEllipse(15, 19, 26, 12); // hollow
		g.fillStyle(C('#5d4128'), 1).fillEllipse(15, 19, 18, 7);
		g.fillStyle(C('#c8a86a'), 1); // cached nuts
		for (const [x, y] of [
			[10, 17],
			[15, 15],
			[20, 17],
			[13, 19],
			[18, 19],
		] as const)
			g.fillEllipse(x, y, 5, 6);
		g.fillStyle(C('#e0c690'), 0.8).fillCircle(13, 14, 1.4).fillCircle(18, 16, 1.4);
	}),
	juniper: def(34, 30, (g) => {
		g.fillStyle(C('#5a4634'), 1).fillRect(15, 22, 4, 8); // gnarled stem
		g.fillStyle(C('#4f6b54'), 1).fillEllipse(16, 17, 30, 18); // dense low shrub
		g.fillStyle(C('#5d7a66'), 1).fillCircle(8, 15, 6).fillCircle(24, 15, 6).fillCircle(16, 11, 7);
		g.fillStyle(C('#6a7fa0'), 1); // frosted berries
		for (const [x, y] of [
			[10, 14],
			[22, 13],
			[16, 17],
			[13, 19],
			[25, 18],
			[18, 10],
		] as const)
			g.fillCircle(x, y, 2);
		g.fillStyle(0xffffff, 0.4);
		for (const [x, y] of [
			[10, 13],
			[22, 12],
			[16, 16],
		] as const)
			g.fillCircle(x, y, 0.8);
	}),
	cliffniche: def(34, 28, (g) => {
		g.fillStyle(C('#8a847a'), 1).fillRoundedRect(2, 4, 30, 24, 3); // cliff face
		g.fillStyle(C('#9c968c'), 1).fillRect(2, 4, 30, 3);
		g.lineStyle(1.4, C('#6e685e'), 1).lineBetween(2, 13, 32, 11).lineBetween(2, 20, 32, 22); // strata
		g.fillStyle(C('#3a352e'), 1).fillEllipse(17, 17, 14, 12); // dark niche
		g.fillStyle(C('#6b8a4a'), 1).fillEllipse(17, 22, 16, 5); // mossed lip
		g.fillStyle(C('#caa15a'), 1).fillCircle(14, 17, 1.6).fillCircle(19, 18, 1.6); // eggs tucked in
	}),
	crystalspring: def(34, 28, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(17, 17, 32, 18); // stone rim
		g.fillStyle(C('#6fb6cf'), 1).fillEllipse(17, 17, 24, 13); // cold water
		g.fillStyle(C('#9fdff0'), 1).fillEllipse(17, 15, 16, 8);
		g.fillStyle(0xffffff, 0.7).fillEllipse(12, 13, 7, 2.6);
		g.fillStyle(C('#cfe8f2'), 1).fillTriangle(26, 16, 28, 7, 30, 16).fillTriangle(4, 18, 6, 10, 8, 18); // quartz spurs
		g.fillStyle(0xffffff, 0.9).fillCircle(28, 9, 1).fillCircle(6, 12, 1);
	}),
	prayerflags: def(40, 26, (g) => {
		g.lineStyle(1.4, C('#6e553c'), 1).lineBetween(2, 6, 38, 10); // string sags
		const cols = ['#d77bb1', '#e8954f', '#5f9ed6', '#6fae5a', '#caa84e'];
		cols.forEach((c, i) => {
			const x = 4 + i * 7;
			const yt = 6 + i * 0.8;
			g.fillStyle(C(c), 1).fillTriangle(x, yt, x + 6, yt + 0.6, x + 3, yt + 11);
		});
	}),
	crystallantern: def(24, 34, (g) => {
		g.fillStyle(C('#7c7670'), 1).fillRect(6, 28, 12, 5); // stone base
		g.fillStyle(C('#8e8880'), 1).fillRect(8, 10, 8, 18); // post
		g.fillStyle(C('#6e685e'), 1).fillRect(5, 6, 14, 5).fillRect(7, 2, 10, 4); // cap
		g.fillStyle(C('#9fdff0'), 0.55).fillCircle(12, 18, 8); // glow
		g.fillStyle(C('#d8f0fa'), 1).fillTriangle(8, 22, 16, 22, 12, 12); // quartz shard
		g.fillStyle(0xffffff, 0.9).fillCircle(12, 15, 1.4);
	}),
	obsidiantotem: def(24, 36, (g) => {
		g.fillStyle(C('#7c7670'), 1).fillEllipse(12, 33, 18, 6); // stone foot
		g.fillStyle(C('#2e2b38'), 1).fillRoundedRect(7, 4, 10, 28, 3); // glassy column
		g.fillStyle(C('#46435a'), 1).fillTriangle(7, 4, 17, 4, 12, 32);
		g.fillStyle(0xffffff, 0.5).fillRect(10, 8, 2, 20); // sharp highlight
		g.fillStyle(C('#8fd0e8'), 0.5).fillCircle(12, 12, 2); // cold glint
	}),
	// unstocked — no fish, no plants, just cold clean water.
	snowmeltpool: def(40, 30, (g) => {
		g.fillStyle(C('#8d9298'), 1).fillEllipse(20, 17, 40, 26); // stone rim
		const kerb: [number, number, number][] = [
			[5, 13, 4],
			[13, 6, 4.5],
			[24, 5, 4],
			[34, 12, 4.5],
			[36, 22, 4],
			[6, 23, 4],
		];
		kerb.forEach(([x, y, r], i) => g.fillStyle(C(['#a8adb2', '#93989e', '#b8bcc0'][i % 3]), 1).fillCircle(x, y, r));
		g.fillStyle(C('#8fd0e8'), 1).fillEllipse(20, 17, 26, 15); // meltwater
		g.fillStyle(C('#c8ecf6'), 0.8).fillEllipse(20, 15, 18, 8); // pale cold shine
		g.fillStyle(0xffffff, 0.9).fillEllipse(9, 8, 9, 4); // a last patch of snow on the rim
	}),
	// permanently wet rock.
	splashledge: def(34, 40, (g) => {
		g.fillStyle(C('#4a505a'), 1).fillCircle(11, 12, 13).fillCircle(9, 28, 12).fillCircle(20, 6, 10); // broken cliff behind
		g.fillStyle(C('#5b6169'), 1).fillCircle(9, 15, 10).fillCircle(7, 30, 9); // lit rock faces
		g.fillStyle(C('#39404a'), 1).fillEllipse(13, 22, 22, 9); // the recess it sits in
		g.fillStyle(C('#2a3038'), 1).fillEllipse(14, 27, 22, 7); // dark undercut below the shelf
		g.fillStyle(C('#6f8894'), 1).fillEllipse(14, 23, 24, 7); // the wet shelf jutting out
		g.fillStyle(C('#8aa4ae'), 1).fillEllipse(13, 21, 20, 4); // shine along its top
		g.fillStyle(C('#4f7d54'), 1).fillEllipse(7, 22, 10, 4).fillEllipse(19, 23, 9, 3.4); // moss, permanently damp
		g.fillStyle(C('#6fae6a'), 1).fillCircle(6, 21, 2).fillCircle(10, 22, 1.6).fillCircle(20, 22, 1.8);
		g.fillStyle(C('#c8e6f0'), 0.9).fillTriangle(24, 0, 29, 0, 27, 30); // the thread, tapering as it falls
		g.fillStyle(0xffffff, 0.7).fillTriangle(25.5, 0, 27.5, 0, 26.5, 26);
		g.fillStyle(0xffffff, 0.55).fillEllipse(26, 33, 14, 6); // where it lands
		g.fillStyle(0xffffff, 0.4)
			.fillCircle(21, 31, 1.8)
			.fillCircle(31, 30, 1.5)
			.fillCircle(23, 36, 1.3)
			.fillCircle(30, 36, 1.1);
	}),
	// frost line, shown as the dark room under the rock.
	boulderden: def(40, 32, (g) => {
		g.fillStyle(C('#6f6a56'), 1).fillEllipse(20, 25, 40, 14); // turned earth apron
		g.fillStyle(C('#8b7f68'), 1).fillCircle(20, 15, 13).fillCircle(9, 20, 7).fillCircle(31, 20, 7); // the boulder
		g.fillStyle(C('#a49881'), 1).fillCircle(17, 11, 8); // lit crown
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 26, 12, 7); // the mouth beneath it
		g.fillStyle(C('#3a2f22'), 1).fillEllipse(20, 24, 12, 3); // shaded lintel
		g.fillStyle(C('#4a3f30'), 0.9).fillEllipse(13, 30, 9, 3).fillEllipse(28, 30, 8, 3); // side chambers hinted below
	}),
	// the fresh cut ring around an older mouth is the whole story.
	inheritedden: def(40, 30, (g) => {
		g.fillStyle(C('#8a6f50'), 1).fillEllipse(20, 19, 40, 22); // earth bank
		g.fillStyle(C('#9c8160'), 1).fillEllipse(19, 14, 32, 12);
		g.fillStyle(C('#7f7568'), 1).fillCircle(6, 12, 6).fillCircle(34, 13, 6); // boulders either side
		g.lineStyle(2, C('#6b5540'), 1).lineBetween(10, 8, 17, 15).lineBetween(30, 7, 23, 15); // roots over the top
		g.fillStyle(C('#b09472'), 1).fillEllipse(20, 21, 19, 13); // the newly widened collar
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 22, 13, 9); // the older mouth inside it
		g.fillStyle(C('#4a3a28'), 1).fillEllipse(20, 27, 12, 3); // worn sill
	}),
	// Nest Burrow: an abandoned tunnel in turf, stuffed with old dry bedding.
	bumblebeeburrow: def(34, 26, (g) => {
		g.fillStyle(C('#7f9a52'), 1).fillEllipse(17, 15, 34, 20); // turf
		g.fillStyle(C('#8f7c55'), 1).fillEllipse(17, 18, 24, 12); // bare worn ground at the mouth
		g.fillStyle(C('#241c14'), 1).fillEllipse(17, 17, 13, 10); // the tunnel
		g.fillStyle(C('#c9b878'), 1).fillEllipse(17, 19, 11, 6); // packed dry grass bedding
		g.fillStyle(C('#ded0a0'), 1).fillEllipse(15, 18, 6, 2.4).fillEllipse(20, 20, 5, 2.2);
		g.fillStyle(C('#e3c75f'), 1).fillEllipse(26, 8, 4, 3); // a bee at the entrance
		g.fillStyle(C('#3b2e25'), 1).fillRect(25.4, 7, 1.1, 2.6);
		g.fillStyle(0xffffff, 0.7).fillEllipse(27.4, 6.6, 2.4, 1.4);
	}),
	// seed heads showing through beside it.
	chipmunklarder: def(40, 26, (g) => {
		g.fillStyle(C('#a08a63'), 1).fillEllipse(20, 17, 40, 18); // dry ground
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(14, 11, 26, 11); // the slab it runs under
		g.fillStyle(C('#a3a39e'), 1).fillEllipse(13, 9, 22, 7);
		g.fillStyle(C('#241c14'), 1).fillEllipse(15, 17, 9, 7); // tunnel mouth under the slab
		g.fillStyle(C('#3d3120'), 1).fillEllipse(30, 18, 16, 10); // the side larder
		g.fillStyle(C('#c9a95f'), 1); // seed heads packed into it
		for (const [x, y] of [
			[26, 17],
			[31, 16],
			[35, 18],
			[29, 20],
			[34, 21],
		] as [number, number][])
			g.fillEllipse(x, y, 4.5, 2.4);
		g.fillStyle(C('#e0c98a'), 1).fillEllipse(31, 16, 3, 1.4);
	}),
	// around it — no spoil heap, because it was borrowed.
	toadburrow: def(32, 24, (g) => {
		g.fillStyle(C('#6a6a4a'), 1).fillEllipse(16, 14, 32, 18); // damp upland ground
		g.fillStyle(C('#7a6f57'), 1).fillEllipse(16, 12, 24, 11); // bare patch
		g.fillStyle(C('#4f4a34'), 1).fillEllipse(16, 16, 20, 8); // wet dark soil ring
		g.fillStyle(C('#241c14'), 1).fillEllipse(16, 15, 9, 7); // the small mouth
		g.fillStyle(C('#3f3a28'), 1).fillEllipse(16, 18, 9, 2.4);
		g.fillStyle(C('#5d8a4a'), 1).fillEllipse(4, 8, 8, 4).fillEllipse(28, 9, 7, 3.5); // damp-ground plants
		g.fillStyle(0xffffff, 0.18).fillEllipse(11, 11, 7, 2);
	}),
	// running away from it.
	treelinelogden: def(44, 28, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(22, 21, 44, 14); // packed snow around it
		g.fillStyle(C('#59493a'), 1).fillRoundedRect(4, 8, 32, 12, 6); // the log
		g.fillStyle(C('#6f5c47'), 1).fillRoundedRect(4, 8, 30, 4, 2); // sunlit top
		g.fillStyle(C('#7a6852'), 1).fillEllipse(35, 14, 8, 12); // cut end
		g.fillStyle(C('#1f1810'), 1).fillEllipse(35, 14, 5, 8); // the hollow
		g.fillStyle(C('#c8d8e4'), 1).fillEllipse(10, 22, 14, 5).fillEllipse(30, 24, 13, 5); // tunnel mouths under the snowpack
		g.fillStyle(C('#8fa4b4'), 1).fillEllipse(10, 22, 8, 3).fillEllipse(30, 24, 7, 3);
		g.fillStyle(C('#3f5a44'), 1).fillEllipse(41, 8, 8, 12); // the last conifer
	}),
	// the rim — the relining is the identifying detail.
	furlinedden: def(34, 26, (g) => {
		g.fillStyle(C('#9c8d78'), 1).fillEllipse(17, 16, 34, 18); // dry ground
		g.fillStyle(C('#b0a28c'), 1).fillEllipse(16, 13, 26, 11);
		g.fillStyle(C('#241c14'), 1).fillEllipse(17, 16, 12, 9); // the mouth
		g.fillStyle(C('#e0d6c4'), 1); // fur caught on the rim
		for (const [x, y, w] of [
			[10, 13, 5],
			[17, 11, 6],
			[24, 13, 5],
			[9, 20, 4],
			[25, 20, 4],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.6);
		g.fillStyle(C('#f2ece0'), 1).fillEllipse(17, 19, 9, 3); // fur lining the floor
		g.fillStyle(C('#c4b8a4'), 1).fillEllipse(17, 12, 8, 2);
	}),
	// so only one narrow way in shows.
	ledgeden: def(40, 32, (g) => {
		g.fillStyle(C('#6b5f52'), 1).fillRoundedRect(2, 2, 36, 26, 3); // broken cliff
		g.fillStyle(C('#7f7263'), 1).fillRoundedRect(2, 2, 36, 8, 3); // lit upper band
		g.fillStyle(C('#150f0a'), 1).fillEllipse(20, 18, 22, 13); // the dry overhang
		g.fillStyle(C('#2f2418'), 1).fillEllipse(20, 13, 22, 5); // roof of it
		g.fillStyle(C('#8b8073'), 1).fillCircle(8, 24, 8).fillCircle(31, 25, 8).fillCircle(20, 28, 6); // fallen rock screening it
		g.fillStyle(C('#9c9184'), 1).fillCircle(6, 22, 4).fillCircle(33, 23, 4);
		g.fillStyle(C('#241c14'), 1).fillEllipse(20, 23, 7, 5); // the one narrow way in
	}),
	// boulders threaded through it and food stashed off to the side.
	snowden: def(42, 30, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(21, 17, 42, 26); // the drift
		g.fillStyle(0xffffff, 0.9).fillEllipse(19, 11, 34, 13); // wind-smoothed crown
		g.fillStyle(C('#a8bfd0'), 1).fillEllipse(20, 19, 15, 11); // the shaft going down
		g.fillStyle(C('#6f8ba3'), 1).fillEllipse(20, 21, 10, 7);
		g.fillStyle(C('#3f5468'), 1).fillEllipse(20, 23, 6, 4); // and into the dark
		g.fillStyle(C('#9aa8b0'), 1).fillCircle(7, 20, 6).fillCircle(34, 19, 5.5); // boulders it threads around
		g.fillStyle(C('#c8d8e4'), 1).fillEllipse(33, 25, 12, 6); // a side chamber
		g.fillStyle(C('#8a6a4a'), 1).fillEllipse(33, 25, 7, 3); // with food frozen into it
	}),
	// Nothing stored — that is what separates it from the larder burrows.
	wintersleepburrow: def(40, 30, (g) => {
		g.fillStyle(C('#5c4a38'), 1).fillEllipse(20, 19, 40, 22); // soil, in section
		g.fillStyle(C('#6f8a4a'), 1).fillEllipse(20, 7, 36, 9); // turf above
		g.fillStyle(C('#8e8e8a'), 1).fillTriangle(4, 12, 24, 3, 27, 8).fillTriangle(4, 12, 27, 8, 8, 14); // the tilted slab
		g.fillStyle(C('#a3a39e'), 1).fillTriangle(5, 11, 23, 4, 25, 6).fillTriangle(5, 11, 25, 6, 7, 12);
		g.lineStyle(3, C('#241c14'), 1).lineBetween(9, 14, 20, 20); // the one tunnel
		g.fillStyle(C('#241c14'), 1).fillEllipse(26, 22, 16, 10); // the chamber
		g.fillStyle(C('#a89a5e'), 1).fillEllipse(26, 24, 13, 4); // grass lining, and nothing else
		g.fillStyle(C('#c2b478'), 1).fillEllipse(24, 23, 6, 1.6).fillEllipse(29, 24, 5, 1.4);
	}),
	// The mat leans all one way, because the wind does.
	krummholzbed: def(42, 28, (g) => {
		g.fillStyle(C('#6a7355'), 1).fillEllipse(21, 20, 42, 15); // stony alpine ground
		g.fillStyle(C('#3f5a44'), 1).fillEllipse(22, 11, 40, 15); // the krummholz mat
		g.fillStyle(C('#4f6f4a'), 1).fillEllipse(26, 8, 30, 10); // wind-combed upper surface
		g.lineStyle(1.6, C('#35503a'), 1); // everything laid over downwind
		for (let i = 0; i < 7; i++) g.lineBetween(4 + i * 5, 16, 12 + i * 4.6, 6);
		g.fillStyle(C('#2f4436'), 1).fillEllipse(18, 18, 26, 7); // deep shade under it
		g.fillStyle(C('#55503c'), 1).fillEllipse(16, 20, 17, 6); // the scrape, pressed flat
		g.fillStyle(C('#6b6650'), 1).fillEllipse(16, 19, 12, 3.5);
	}),
	// half snow, half fruiting.
	snowbankmushrooms: def(40, 28, (g) => {
		g.fillStyle(C('#6b5b45'), 1).fillEllipse(20, 20, 40, 15); // wet ground the drift has left
		g.fillStyle(C('#cfd6dc'), 1).fillEllipse(9, 13, 26, 20); // the shrinking drift
		g.fillStyle(0xffffff, 0.9).fillEllipse(7, 10, 20, 12);
		g.fillStyle(C('#8fa4b0'), 1).fillEllipse(15, 21, 14, 5); // its melting lip
		const caps: [number, number, number][] = [
			[21, 17, 5],
			[26, 15, 4.5],
			[31, 18, 5],
			[35, 15, 4],
			[24, 21, 4],
			[30, 22, 3.6],
		];
		caps.forEach(([x, y, r]) => {
			g.fillStyle(C('#e8e2d2'), 1).fillRect(x - 0.9, y, 1.8, 6); // hairy stem
			g.lineStyle(0.7, C('#c4bca8'), 1).lineBetween(x - 1.4, y + 2, x + 1.4, y + 3);
			g.fillStyle(C('#f2ede0'), 1).fillEllipse(x, y, r * 2, r); // pale cap
			g.fillStyle(C('#d8d0bc'), 1).fillEllipse(x, y + 0.8, r * 1.6, r * 0.5);
		});
	}),
	// the drifts pile deepest — so it keeps a collar of old snow.
	coniferlog: def(44, 26, (g) => {
		g.fillStyle(C('#dfe9f2'), 1).fillEllipse(22, 21, 42, 10); // drift that hasn't gone yet
		g.fillStyle(C('#5c4a35'), 1).fillRoundedRect(3, 8, 36, 12, 6); // the log
		g.fillStyle(C('#6f5a42'), 1).fillRoundedRect(3, 8, 32, 4, 2);
		g.fillStyle(C('#4a3a28'), 1); // soft punky patches you could press into
		g.fillEllipse(12, 14, 12, 7).fillEllipse(26, 15, 10, 6);
		g.fillStyle(C('#3a2c1e'), 1).fillEllipse(12, 15, 7, 4).fillEllipse(26, 16, 6, 3.4);
		g.fillStyle(C('#7a6a52'), 1).fillEllipse(38, 13, 7, 11); // shattered end
		g.lineStyle(1, C('#4a3a28'), 1).lineBetween(36, 8, 40, 18).lineBetween(38, 8, 37, 19); // splinters
		g.fillStyle(0xffffff, 0.85).fillEllipse(8, 8, 12, 4).fillEllipse(31, 9, 10, 3.4); // snow along the top
	}),
	// so it is drawn dense and continuous with soil showing only at the edge.
	turfmat: def(42, 24, (g) => {
		g.fillStyle(C('#3f3528'), 1).fillEllipse(21, 15, 42, 16); // dark alpine soil
		g.fillStyle(C('#7c8f5a'), 1).fillEllipse(21, 12, 38, 13); // the knitted mat
		g.fillStyle(C('#8fa168'), 1).fillEllipse(19, 9, 30, 8);
		g.fillStyle(C('#6b8049'), 1); // individual cushions knitted together
		for (const [x, y, r] of [
			[8, 11, 5],
			[16, 8, 5.5],
			[25, 10, 5],
			[33, 9, 4.5],
			[12, 15, 4.5],
			[22, 16, 4.5],
			[30, 15, 4],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		g.fillStyle(C('#a3b57c'), 1);
		for (const [x, y] of [
			[8, 10],
			[16, 7],
			[25, 9],
			[33, 8],
		] as [number, number][])
			g.fillCircle(x, y, 2.4);
		g.fillStyle(C('#d8c86a'), 1).fillCircle(13, 11, 1.3).fillCircle(28, 12, 1.2); // avens flowers
		g.fillStyle(C('#c9a0c0'), 1).fillCircle(20, 13, 1.2).fillCircle(34, 12, 1.1);
	}),
	// winter snow line showing how far it gets buried.
	willowbasin: def(44, 28, (g) => {
		g.fillStyle(C('#7f8a6a'), 1).fillEllipse(22, 21, 44, 14); // the sheltered basin
		g.fillStyle(C('#68705a'), 1).fillEllipse(22, 23, 32, 8); // its dished floor
		g.fillStyle(C('#5f6f42'), 1).fillEllipse(22, 16, 40, 20); // willow packed into it
		g.fillStyle(C('#6f7f52'), 1).fillEllipse(13, 12, 24, 15).fillEllipse(31, 11, 22, 14);
		g.fillStyle(C('#84956a'), 1).fillEllipse(12, 8, 16, 8).fillEllipse(31, 7, 14, 7); // sunlit tops
		g.lineStyle(1.4, C('#8a7a5c'), 1); // bud-bearing twigs above the drift line
		for (let i = 0; i < 9; i++) g.lineBetween(6 + i * 4, 15, 5 + i * 4.2, 4 + (i % 3) * 3);
		g.fillStyle(C('#b0a888'), 1);
		for (let i = 0; i < 7; i++) g.fillEllipse(6 + i * 5, 4 + (i % 3) * 3, 2.2, 3);
		g.fillStyle(0xffffff, 0.28).fillEllipse(22, 20, 34, 2.4); // where the drifts reach each winter
	}),
	// stems from one spot, carrying cones that never open.
	whitebarkpine: def(34, 44, (g) => {
		g.fillStyle(C('#6f7a58'), 1).fillEllipse(17, 41, 28, 6); // stony alpine ground
		g.fillStyle(C('#7f7058'), 1); // several stems from a single cache
		g.fillRect(13, 20, 3, 21).fillRect(17, 22, 2.6, 19).fillRect(10, 26, 2.2, 15);
		g.fillStyle(C('#55684a'), 1); // wind-shaped crowns
		g.fillEllipse(14, 16, 24, 16).fillEllipse(22, 24, 18, 12).fillEllipse(9, 26, 14, 10);
		g.fillStyle(C('#66795a'), 1).fillEllipse(13, 12, 18, 9).fillEllipse(23, 21, 12, 7);
		g.lineStyle(1.2, C('#43563c'), 1); // needle bundles
		for (let i = 0; i < 6; i++) g.lineBetween(6 + i * 4.4, 14 + (i % 3) * 3, 4 + i * 4.6, 9 + (i % 3) * 3);
		g.fillStyle(C('#7a5f3f'), 1); // cones that stay shut
		g.fillEllipse(9, 13, 4, 6).fillEllipse(20, 11, 4, 6).fillEllipse(25, 22, 3.6, 5.4);
		g.fillStyle(C('#5f4830'), 1).fillEllipse(9, 13, 2, 3.4).fillEllipse(20, 11, 2, 3.4);
	}),
	// scoop is the whole object.
	minerallick: def(42, 26, (g) => {
		g.fillStyle(C('#8a9a68'), 1).fillEllipse(21, 20, 42, 12); // turf around it
		g.fillStyle(C('#c9bfa6'), 1).fillEllipse(21, 13, 36, 18); // the pale salty bank
		g.fillStyle(C('#ded6c0'), 1).fillEllipse(20, 9, 28, 9); // dried crust on top
		g.fillStyle(C('#a89f88'), 1).fillEllipse(21, 15, 24, 11); // the licked-out hollow
		g.fillStyle(C('#8d8574'), 1).fillEllipse(21, 16, 18, 8); // damp inside it
		g.fillStyle(C('#9a927e'), 1); // gnaw scoops around the rim
		for (let i = 0; i < 7; i++) g.fillEllipse(9 + i * 4, 11 + (i % 2) * 1.6, 3.4, 2.4);
		g.fillStyle(0xffffff, 0.4).fillEllipse(13, 8, 10, 2.4); // salt showing
		g.fillStyle(C('#6b6a52'), 1).fillEllipse(21, 20, 20, 3); // wet floor of the scoop
	}),
	// with nothing living in it.
	oldcavity: def(28, 42, (g) => {
		g.fillStyle(C('#6f7a58'), 1).fillEllipse(14, 39, 24, 6); // ground
		g.fillStyle(C('#4f4335'), 1).fillRect(8, 2, 13, 38); // the dead trunk
		g.fillStyle(C('#665949'), 1).fillRect(16, 2, 3.4, 38); // lit side
		g.fillStyle(C('#3a3128'), 1).fillRect(8, 2, 3.4, 38);
		g.lineStyle(0.9, C('#3a3128'), 1); // old weathered bark
		for (let i = 0; i < 5; i++) g.lineBetween(10 + i * 2.4, 4, 10 + i * 2.4, 38);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(14, 15, 5.4); // the hole, still clean-edged
		g.fillStyle(C('#7d6f5c'), 1).fillCircle(14, 15, 5.4);
		g.fillStyle(C('#0f0b08'), 1).fillCircle(14, 15, 4.2);
		g.fillStyle(C('#8f8170'), 1).fillEllipse(14, 10.6, 9, 2); // the crisp upper rim
		g.fillStyle(C('#5f5344'), 1).fillEllipse(14, 3, 13, 4); // broken top
	}),
	// back of it — the lining is what you can actually see.
	linedcrack: def(36, 30, (g) => {
		g.fillStyle(C('#8b8378'), 1).fillCircle(11, 15, 13).fillCircle(26, 14, 12).fillCircle(18, 25, 10); // wind-scoured face
		g.fillStyle(C('#9e968a'), 1).fillCircle(9, 10, 8).fillCircle(28, 9, 7);
		g.fillStyle(C('#110e0b'), 1).fillTriangle(14, 2, 22, 2, 18, 27); // the fissure
		g.fillStyle(C('#e8e2d4'), 1); // down and fur packed into the back of it
		g.fillEllipse(18, 17, 8, 11);
		g.fillEllipse(16, 13, 4.5, 5).fillEllipse(20, 15, 4, 5).fillEllipse(17, 21, 5, 4);
		g.fillStyle(C('#f6f2e8'), 1).fillEllipse(18, 16, 5, 7).fillEllipse(19, 20, 3.4, 3);
		g.fillStyle(C('#4a443c'), 1).fillTriangle(14, 2, 16.5, 2, 16.5, 11); // its one lit edge
		g.fillStyle(C('#d8d0c0'), 1).fillCircle(14, 8, 1.3).fillCircle(22, 23, 1.1).fillCircle(21, 6, 1); // wisps escaping
	}),
	// melting edge — mostly snow, with one dirty line across it.
	debrisline: def(44, 26, (g) => {
		g.fillStyle(C('#c9d3dc'), 1).fillEllipse(22, 13, 44, 22); // the shrinking snowfield
		g.fillStyle(0xffffff, 0.9).fillEllipse(20, 8, 36, 12); // clean upper snow
		g.fillStyle(C('#8fa4b4'), 1).fillEllipse(22, 18, 38, 9); // its melting lower edge
		g.fillStyle(C('#5f5238'), 1).fillEllipse(22, 17, 36, 4); // the stranded seam
		g.fillStyle(C('#7a6a4a'), 1); // seed, pollen and grit delivered uphill
		for (let i = 0; i < 13; i++) g.fillEllipse(5 + i * 3, 17 + (i % 3) - 1, 3, 1.6);
		g.fillStyle(C('#a8945f'), 1);
		for (let i = 0; i < 8; i++) g.fillCircle(7 + i * 4.4, 16 + (i % 2), 1);
		g.fillStyle(0xffffff, 0.6).fillEllipse(14, 6, 16, 3);
	}),
	// up — the route is what makes it safe ground.
	escapecliff: def(36, 42, (g) => {
		g.fillStyle(C('#7d7469'), 1).fillRoundedRect(2, 1, 32, 40, 3); // the band of cliff
		g.fillStyle(C('#8e857a'), 1).fillRoundedRect(2, 1, 32, 8, 3); // lit top
		g.fillStyle(C('#655d54'), 1); // ledges stepping the whole way up
		for (const [x, y, w] of [
			[4, 10, 18],
			[14, 17, 20],
			[3, 24, 17],
			[13, 31, 20],
			[6, 37, 16],
		] as [number, number, number][])
			g.fillRect(x, y, w, 3);
		g.fillStyle(C('#9a9186'), 1);
		for (const [x, y, w] of [
			[4, 10, 18],
			[14, 17, 20],
			[3, 24, 17],
			[13, 31, 20],
			[6, 37, 16],
		] as [number, number, number][])
			g.fillRect(x, y, w, 1);
		g.lineStyle(1.2, C('#5a5249'), 1).lineBetween(11, 2, 13, 40).lineBetween(24, 2, 22, 40); // vertical seams
	}),
	// on the ledge, added to for decades.
	eyrie: def(40, 36, (g) => {
		g.fillStyle(C('#6f6a61'), 1).fillRoundedRect(2, 1, 36, 34, 3); // sheer face
		g.fillStyle(C('#7f7a70'), 1).fillRoundedRect(2, 1, 36, 7, 3);
		g.fillStyle(C('#54504a'), 1).fillRect(2, 20, 36, 3); // the ledge
		g.fillStyle(C('#8a857c'), 1).fillRect(2, 20, 36, 1);
		g.fillStyle(C('#6b5b45'), 1).fillEllipse(21, 15, 30, 12); // the eyrie, decades deep
		g.fillStyle(C('#7f6f56'), 1).fillEllipse(21, 12, 26, 9);
		g.lineStyle(1.3, C('#5f5238'), 1);
		g.lineBetween(7, 15, 35, 14).lineBetween(8, 18, 34, 17).lineBetween(12, 8, 15, 20).lineBetween(29, 8, 27, 20);
		g.fillStyle(C('#4f4433'), 1).fillEllipse(21, 11, 15, 5); // the bowl
		g.fillStyle(0xffffff, 0.55).fillEllipse(9, 24, 8, 3).fillEllipse(31, 25, 7, 3); // whitewash down the ledge
	}),
	// far steeper than anything else would attempt.
	goatledge: def(38, 40, (g) => {
		g.fillStyle(C('#8d8579'), 1).fillTriangle(2, 0, 30, 0, 36, 40).fillTriangle(2, 0, 36, 40, 6, 40); // the steep face
		g.fillStyle(C('#9c9488'), 1).fillTriangle(3, 0, 20, 0, 26, 38).fillTriangle(3, 0, 26, 38, 5, 38);
		g.fillStyle(C('#6f685e'), 1).fillTriangle(24, 0, 30, 0, 36, 40).fillTriangle(24, 0, 36, 40, 30, 40); // shadowed side
		g.fillStyle(C('#5f584f'), 1).fillRect(9, 20, 17, 3.4); // the shelf — barely there
		g.fillStyle(C('#b0a89a'), 1).fillRect(9, 20, 17, 1.4); // scraped bare and dusty
		g.fillStyle(C('#c9c0b0'), 0.7).fillEllipse(17, 19, 14, 2); // dust on it
		g.lineStyle(1, C('#6f685e'), 1).lineBetween(8, 8, 30, 12).lineBetween(6, 30, 32, 33); // strata across the face
	}),
	// way in is head-first.
	cliffseam: def(34, 42, (g) => {
		g.fillStyle(C('#6e7480'), 1).fillRoundedRect(2, 1, 30, 40, 3); // sheer rock
		g.fillStyle(C('#7f8590'), 1).fillRoundedRect(2, 1, 30, 8, 3);
		g.fillStyle(C('#5a606b'), 1).fillRoundedRect(2, 24, 30, 17, 3); // shadowed lower half
		g.fillStyle(C('#0f1116'), 1).fillTriangle(15, 4, 19, 4, 17.5, 34); // the seam — very tight
		g.fillStyle(C('#0f1116'), 1).fillRect(15.4, 4, 3, 24);
		g.fillStyle(C('#39404a'), 1).fillRect(15.4, 4, 1.2, 24); // its one lit edge
		g.lineStyle(1, C('#5a606b'), 1).lineBetween(4, 14, 14, 15).lineBetween(20, 13, 30, 14); // strata running into it
		g.lineBetween(4, 28, 14, 27).lineBetween(21, 29, 30, 28);
		g.fillStyle(C('#8b919c'), 1).fillEllipse(17, 2, 14, 4); // the rim above
	}),
	// nest built — the ledge and the drop are the nest.
	scrapeledge: def(40, 34, (g) => {
		g.fillStyle(C('#7b8290'), 1).fillRoundedRect(2, 1, 36, 32, 3); // the cliff
		g.fillStyle(C('#8c93a0'), 1).fillRoundedRect(2, 1, 36, 7, 3);
		g.fillStyle(C('#5f6672'), 1).fillRect(2, 26, 36, 7); // shadow under the shelf
		g.fillStyle(C('#6b7280'), 1).fillRect(2, 16, 36, 10); // the shelf itself
		g.fillStyle(C('#a3aab6'), 1).fillRect(2, 16, 36, 2.4); // its gravel floor
		g.fillStyle(C('#b8bfc9'), 1); // loose grit
		for (let i = 0; i < 14; i++) g.fillCircle(5 + i * 2.4, 19 + (i % 3), 1);
		g.fillStyle(C('#57606d'), 1).fillEllipse(20, 21, 16, 5); // the dip kicked into it
		g.fillStyle(C('#454d59'), 1).fillEllipse(20, 21.6, 11, 3);
		g.fillStyle(C('#e0d6c0'), 1).fillEllipse(18, 21, 4, 3.2).fillEllipse(22, 21.6, 4, 3.2); // eggs straight on the grit
	}),
	// the damage is the habitat.
	digslope: def(44, 30, (g) => {
		g.fillStyle(C('#7f8f5a'), 1).fillEllipse(22, 6, 42, 11); // alpine turf on the crest
		g.fillStyle(C('#8a7a5c'), 1).fillEllipse(22, 17, 44, 22); // the bank
		g.fillStyle(C('#9c8c6a'), 1).fillEllipse(21, 13, 36, 12);
		g.fillStyle(C('#5f5138'), 1); // torn-open patches
		g.fillEllipse(12, 15, 15, 9).fillEllipse(28, 17, 14, 9);
		g.fillStyle(C('#4a3f2b'), 1).fillEllipse(12, 16, 10, 6).fillEllipse(28, 18, 9, 6);
		g.lineStyle(1.4, C('#7a6a4a'), 1); // roots left hanging in the tear
		g.lineBetween(7, 13, 16, 18).lineBetween(24, 14, 33, 19).lineBetween(10, 19, 15, 13);
		g.fillStyle(C('#a3937a'), 1); // heaps of turned soil below
		g.fillEllipse(9, 26, 14, 6).fillEllipse(24, 27, 15, 6).fillEllipse(37, 25, 11, 5);
		g.fillStyle(C('#b5a68c'), 1).fillEllipse(9, 25, 9, 3).fillEllipse(24, 26, 10, 3);
	}),
	// the opposite of the meadow drift's tall loose stems.
	alpineflowers: def(38, 22, (g) => {
		g.fillStyle(C('#5f6b4a'), 1).fillEllipse(19, 14, 38, 15); // thin high-country soil
		g.fillStyle(C('#6f8050'), 1).fillEllipse(18, 11, 32, 10); // tight cushion foliage
		g.fillStyle(C('#7d8f5c'), 1);
		for (const [x, y, r] of [
			[8, 11, 5],
			[17, 9, 5.5],
			[26, 11, 5],
			[33, 12, 4],
		] as [number, number, number][])
			g.fillCircle(x, y, r);
		const blooms: [number, number, string][] = [
			[6, 9, '#9d86d9'],
			[11, 7, '#d9869d'],
			[16, 6, '#9d86d9'],
			[21, 8, '#e0d05a'],
			[26, 7, '#86a8d9'],
			[31, 9, '#9d86d9'],
			[13, 12, '#e0d05a'],
			[23, 13, '#d9869d'],
			[30, 13, '#86a8d9'],
		];
		blooms.forEach(([x, y, c]) => {
			g.fillStyle(C(c), 1).fillCircle(x, y, 2.4); // no stems — they hug the ground
			g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 0.9);
		});
	}),
	// is half the object.
	stonecrop: def(36, 24, (g) => {
		g.fillStyle(C('#8e8e8a'), 1).fillEllipse(18, 16, 36, 16); // gravel and rock
		g.fillStyle(C('#a3a39e'), 1).fillCircle(7, 14, 7).fillCircle(28, 13, 7).fillCircle(18, 18, 6);
		g.fillStyle(C('#6f6f6b'), 1); // the cracks it wedges into
		g.fillTriangle(12, 8, 15, 8, 13, 20).fillTriangle(22, 8, 25, 8, 24, 19);
		g.fillStyle(C('#a8b56a'), 1); // fat succulent leaves
		for (const [x, y] of [
			[13, 11],
			[24, 10],
			[9, 17],
			[19, 15],
			[29, 17],
		] as [number, number][]) {
			for (let i = 0; i < 5; i++) {
				const a = -2.6 + (i / 4) * 2.1;
				g.fillEllipse(x + Math.cos(a) * 3, y + Math.sin(a) * 2.4, 4, 2.4);
			}
		}
		g.fillStyle(C('#c2cf85'), 1).fillCircle(13, 10, 1.8).fillCircle(24, 9, 1.7).fillCircle(19, 14, 1.5);
		g.fillStyle(C('#e0d05a'), 1).fillCircle(9, 16, 1.3).fillCircle(29, 16, 1.2); // yellow flowers
	}),
	// released by the snowpack — dark, wet, and going straight back to soil.
	snowmeltmat: def(40, 22, (g) => {
		g.fillStyle(C('#c9d3dc'), 1).fillEllipse(34, 8, 16, 12); // the last of the snowpack
		g.fillStyle(C('#4a4437'), 1).fillEllipse(19, 13, 38, 14); // sodden ground
		g.fillStyle(C('#6b6151'), 1).fillEllipse(19, 11, 34, 11); // the flattened mat
		g.fillStyle(C('#7d7361'), 1); // last year's stems, all pressed one way
		for (const [x, y, w] of [
			[9, 8, 13],
			[19, 7, 14],
			[28, 9, 12],
			[13, 13, 13],
			[24, 14, 12],
			[32, 12, 9],
		] as [number, number, number][])
			g.fillEllipse(x, y, w, 2.4);
		g.fillStyle(C('#8f8471'), 1).fillEllipse(15, 7, 9, 1.4).fillEllipse(26, 10, 8, 1.3);
		g.fillStyle(0xffffff, 0.22).fillEllipse(17, 9, 18, 2.4); // wet shine on it
		g.fillStyle(C('#5f6b4a'), 1).fillCircle(7, 15, 1.6).fillCircle(22, 17, 1.4); // first green pushing through
	}),
	// Puffball Ring: pale domes pushing up through old turf, in a ring.
	puffballring: def(40, 26, (g) => {
		g.fillStyle(C('#7a8a5a'), 1).fillEllipse(20, 15, 40, 18); // old turf
		g.fillStyle(C('#89996a'), 1).fillEllipse(19, 12, 32, 11);
		const ring: [number, number, number][] = [
			[7, 13, 4],
			[13, 8, 3.4],
			[21, 6, 4.2],
			[29, 8, 3.6],
			[34, 13, 4],
			[29, 18, 3.4],
			[20, 20, 4],
			[11, 18, 3.6],
		];
		ring.forEach(([x, y, r]) => {
			g.fillStyle(C('#6b7a4a'), 1).fillEllipse(x, y + r * 0.55, r * 2.2, r * 0.8); // turf pushed up around it
			g.fillStyle(C('#cfc6a8'), 1).fillCircle(x, y, r); // the dome
			g.fillStyle(C('#e2dbc2'), 1).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.55); // its pale crown
		});
		g.fillStyle(C('#b0a888'), 0.7).fillEllipse(21, 6, 5, 3); // one ripe and smoking
		g.fillStyle(C('#c9c0a8'), 0.4).fillCircle(21, 2, 3);
	}),
	// lichen crusts — flat, and it looks like nothing until you know.
	fellfield: def(42, 22, (g) => {
		g.fillStyle(C('#9a9385'), 1).fillEllipse(21, 12, 42, 16); // the gravel sheet
		g.fillStyle(C('#a8a294'), 1).fillEllipse(20, 9, 34, 10);
		g.fillStyle(C('#8a8478'), 1); // frost-sorted stones, all a size
		for (let i = 0; i < 26; i++) g.fillCircle(4 + ((i * 7) % 35), 7 + ((i * 11) % 11), 1.4 + (i % 3) * 0.3);
		g.fillStyle(C('#b8b2a4'), 1);
		for (let i = 0; i < 16; i++) g.fillCircle(6 + ((i * 13) % 31), 8 + ((i * 5) % 9), 1.1);
		g.fillStyle(C('#a3b06a'), 0.75); // thin lichen crusts holding it together
		g.fillEllipse(11, 10, 9, 3.4).fillEllipse(26, 8, 8, 3).fillEllipse(19, 15, 9, 3.2).fillEllipse(33, 13, 7, 2.8);
		g.fillStyle(C('#c9a05f'), 0.6).fillEllipse(15, 7, 5, 2).fillEllipse(30, 15, 4.5, 2);
	}),
	// the daylight reaches.
	screecrack: def(40, 26, (g) => {
		g.fillStyle(C('#9a948a'), 1).fillEllipse(20, 20, 40, 12); // scree below
		g.fillStyle(C('#7b7166'), 1).fillTriangle(2, 16, 34, 3, 38, 11).fillTriangle(2, 16, 38, 11, 7, 19); // the loose slab
		g.fillStyle(C('#8f8579'), 1).fillTriangle(3, 15, 33, 4, 35, 8).fillTriangle(3, 15, 35, 8, 6, 17); // its lit top
		g.fillStyle(C('#0d0b09'), 1).fillTriangle(5, 19, 36, 11, 38, 17).fillTriangle(5, 19, 38, 17, 9, 21); // the slot
		g.fillStyle(0x000000, 0.5).fillTriangle(9, 20, 34, 13, 35, 16); // and it keeps going back
		g.fillStyle(C('#a8a29a'), 1).fillCircle(36, 20, 5).fillCircle(4, 21, 4.5); // scree at each end
		g.fillStyle(C('#8a847a'), 1).fillCircle(14, 23, 3.4).fillCircle(24, 24, 3);
	}),
};

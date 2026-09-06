// Tool sprites, one per upgrade tier (shown in the Tools & Upgrades menu).

import { C, def } from '../canvas';
import type { SpriteSet } from '../canvas';

export const TOOLS: SpriteSet = {
	// Gathering Basket → Reinforced → Woven Carryall → Naturalist's Pack
	basket1: def(30, 28, (g) => {
		g.lineStyle(2.4, C('#8a6330'), 1).strokeEllipse(15, 11, 22, 11); // carry handle
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(5, 12, 20, 13, 3); // woven body
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 3; i++) g.fillRect(5, 14 + i * 3.4, 20, 1.2); // weave courses
		g.fillStyle(C('#8a6330'), 1).fillRect(7, 13, 1.4, 12).fillRect(14, 13, 1.4, 12).fillRect(21, 13, 1.4, 12);
		g.fillStyle(C('#c99a5e'), 1).fillRect(4, 11, 22, 2.2); // rim
	}),
	basket2: def(30, 28, (g) => {
		g.lineStyle(2.6, C('#6e4e22'), 1).strokeEllipse(15, 10, 24, 12); // sturdier handle
		g.fillStyle(C('#b98a4e'), 1).fillRoundedRect(3, 12, 24, 14, 3); // bigger body
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 3; i++) g.fillRect(3, 14 + i * 3.6, 24, 1.2);
		g.fillStyle(C('#7a5a34'), 1).fillRect(3, 17, 24, 2.6); // reinforcement band
		g.fillStyle(C('#9aa0a6'), 1).fillCircle(8, 18.3, 1.2).fillCircle(15, 18.3, 1.2).fillCircle(22, 18.3, 1.2); // studs
		g.fillStyle(C('#c99a5e'), 1).fillRect(2, 11, 26, 2.4); // rim
	}),
	basket3: def(30, 28, (g) => {
		g.lineStyle(2.4, C('#7a5a34'), 1).strokeEllipse(15, 9, 22, 12);
		g.fillStyle(C('#c9a56a'), 1).fillRoundedRect(5, 9, 20, 18, 3); // tall carryall
		g.fillStyle(C('#a97a3e'), 1);
		for (let i = 0; i < 4; i++) g.fillRect(5, 11 + i * 3.8, 20, 1); // finer weave
		g.fillStyle(C('#8a6330'), 1);
		for (let i = 0; i < 5; i++) g.fillRect(6 + i * 3.7, 10, 1, 16);
		g.fillStyle(C('#c99a5e'), 1).fillRect(4, 8, 22, 2.2); // rim
		g.lineStyle(3, C('#6b4f2c'), 1).lineBetween(4, 6, 26, 22); // shoulder strap
	}),
	basket4: def(30, 30, (g) => {
		g.lineStyle(2, C('#4a3a24'), 1).lineBetween(9, 9, 7, 26).lineBetween(21, 9, 23, 26); // shoulder straps
		g.fillStyle(C('#6b5334'), 1).fillRoundedRect(6, 7, 18, 20, 4); // pack body
		g.fillStyle(C('#5a4630'), 1).fillRoundedRect(9, 19, 12, 7, 2); // front pocket
		g.fillStyle(C('#7a6140'), 1).fillRoundedRect(6, 6, 18, 9, 4); // top flap
		g.fillStyle(C('#4a3a24'), 1).fillRect(14, 13, 2, 4); // strap
		g.fillStyle(C('#c9a45a'), 1).fillRect(13.4, 14.5, 3.2, 2.2); // buckle
	}),
	// … → Relay Pack (desert) → Frame Pack (alpine) → Harvest Pack (coastal)
	basket5: def(30, 30, (g) => {
		g.lineStyle(2, C('#4a3a24'), 1).lineBetween(9, 9, 7, 26).lineBetween(21, 9, 23, 26); // straps
		g.fillStyle(C('#7a5f3a'), 1).fillRoundedRect(6, 7, 18, 20, 4); // pack body
		g.fillStyle(C('#c98a4e'), 1).fillRoundedRect(2, 14, 7, 10, 2); // relay satchel, slung aside
		g.lineStyle(1.6, C('#8a6330'), 1).lineBetween(9, 16, 13, 13); // sling to the main pack
		g.fillStyle(C('#8a6b42'), 1).fillRoundedRect(6, 6, 18, 9, 4); // top flap
		g.fillStyle(C('#e0b070'), 1).fillRect(13.4, 14.5, 3.2, 2.2); // buckle
	}),
	basket6: def(30, 30, (g) => {
		g.fillStyle(C('#8f958a'), 1).fillRect(6, 4, 2.2, 24).fillRect(21.8, 4, 2.2, 24); // rigid outer frame
		g.fillStyle(C('#8f958a'), 1).fillRect(6, 4, 18, 2.2).fillRect(6, 26, 18, 2.2); // frame rails
		g.fillStyle(C('#6b5334'), 1).fillRoundedRect(8, 7, 14, 19, 3); // pack slung in the frame
		g.fillStyle(C('#5a4630'), 1).fillRoundedRect(10, 18, 10, 7, 2); // front pocket
		g.lineStyle(1.8, C('#dfe6ee'), 1).lineBetween(8, 12, 22, 12); // quartz-pinned crossbar
		g.fillStyle(C('#a6ad93'), 1).fillCircle(15, 12, 1.8); // pin
	}),
	basket7: def(30, 30, (g) => {
		g.lineStyle(2, C('#6b5334'), 1).lineBetween(9, 8, 7, 27).lineBetween(21, 8, 23, 27); // straps
		g.fillStyle(C('#7f8f6a'), 1).fillRoundedRect(4, 8, 22, 19, 4); // wide-mouthed body
		g.fillStyle(C('#e8d9a8'), 1).fillRoundedRect(4, 6, 22, 5, 2.5); // broad open mouth
		g.fillStyle(C('#6f8a5a'), 1).fillRoundedRect(2, 15, 5, 9, 2).fillRoundedRect(23, 15, 5, 9, 2); // side pockets
		g.fillStyle(C('#9fc7bd'), 1).fillCircle(15, 18, 2.6); // sea-glass clasp
		g.fillStyle(C('#5f7a4a'), 1).fillRect(4, 21, 22, 1.6); // load band
	}),
	// Basic Shovel → Restoration Shovel → Tempered Spade → Earthshaper's Spade
	shovel1: def(26, 36, (g) => {
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 2, 3, 22); // handle
		g.fillStyle(C('#7a6544'), 1).fillRect(10.5, 2, 1.2, 22);
		g.fillStyle(C('#b8bcc2'), 1).fillTriangle(6, 22, 19, 22, 12.5, 32); // blade
		g.fillStyle(C('#d7dade'), 1).fillTriangle(9, 23, 16, 23, 12.5, 29); // highlight
	}),
	shovel2: def(26, 36, (g) => {
		g.fillStyle(C('#7a6544'), 1).fillRect(10.5, 2, 3, 2.5); // grip nub
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 4, 3, 18); // handle
		g.fillStyle(C('#8a8f96'), 1).fillRect(9.5, 21, 6, 3); // metal collar
		g.fillStyle(C('#aeb4ba'), 1).fillTriangle(5, 23, 20, 23, 12.5, 34); // bigger blade
		g.fillStyle(C('#d7dade'), 1).fillTriangle(8, 24, 17, 24, 12.5, 31);
	}),
	shovel3: def(26, 36, (g) => {
		g.fillStyle(C('#7a6544'), 1).fillRect(9, 2, 7, 3); // T-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 16); // handle
		g.fillStyle(C('#8a8f96'), 1).fillRect(9.5, 20, 6, 2.6); // collar
		g.fillStyle(C('#9fb0be'), 1).fillRoundedRect(6, 22, 13, 12, 2); // square spade
		g.fillStyle(C('#5f7d92'), 1).fillRect(6, 22, 13, 2); // tempered edge
		g.fillStyle(C('#cdd6dc'), 1).fillRect(9, 25, 6, 5); // sheen
	}),
	shovel4: def(26, 36, (g) => {
		g.lineStyle(2.4, C('#7a6544'), 1).strokeEllipse(12.5, 4, 9, 6); // D-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 15); // handle
		g.fillStyle(C('#c9a45a'), 1).fillRect(9.5, 19, 6, 2.6); // gold collar
		g.fillStyle(C('#8f9aa4'), 1).fillRoundedRect(5, 21, 15, 13, 2); // big blade
		g.fillStyle(C('#c9a45a'), 1).fillRect(5, 21, 15, 1.6); // gold trim
		g.fillStyle(C('#6f7d88'), 1).fillRect(12, 22, 1.4, 11); // center rib
		g.fillStyle(C('#cdd6dc'), 1).fillTriangle(7, 23, 11, 23, 9, 30); // sheen
	}),
	// … → Broad Spade (desert) → Survey Spade (alpine) → Salvage Spade (coastal)
	shovel5: def(26, 36, (g) => {
		g.lineStyle(2.4, C('#7a6544'), 1).strokeEllipse(12.5, 4, 10, 6); // D-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 14); // handle
		g.fillStyle(C('#c98a4e'), 1).fillRect(8.5, 18, 8, 2.6); // collar
		g.fillStyle(C('#a8b0b8'), 1).fillRoundedRect(2, 20, 21, 13, 2); // broad blade, wall to wall
		g.fillStyle(C('#e08a3c'), 1).fillRect(2, 20, 21, 1.6); // desert-fired edge
		g.fillStyle(C('#6f7d88'), 1).fillRect(7, 21, 1.2, 11).fillRect(17, 21, 1.2, 11); // ribs
		g.fillStyle(C('#cdd6dc'), 1).fillRect(10, 24, 5, 5); // sheen
	}),
	shovel6: def(26, 36, (g) => {
		g.lineStyle(2.4, C('#7a6544'), 1).strokeEllipse(12.5, 4, 9, 6); // D-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 14); // handle
		g.fillStyle(C('#dfe6ee'), 1).fillRect(9.5, 18, 6, 2.6); // quartz collar
		g.fillStyle(C('#2f3038'), 1).fillRoundedRect(5, 20, 15, 14, 2); // obsidian blade
		g.fillStyle(C('#a6ad93'), 1);
		for (let i = 0; i < 4; i++) g.fillRect(6, 23 + i * 2.6, 4 + i, 1); // depth graduations
		g.lineStyle(1.4, C('#dfe6ee'), 1).lineBetween(17, 21, 17, 33); // sight line
		g.fillStyle(0xffffff, 0.35).fillTriangle(7, 21, 11, 21, 9, 26); // sheen
	}),
	shovel7: def(26, 36, (g) => {
		g.lineStyle(2.4, C('#7a6544'), 1).strokeEllipse(12.5, 4, 9, 6); // D-grip
		g.fillStyle(C('#9a8156'), 1).fillRect(11, 5, 3, 14); // handle
		g.fillStyle(C('#9fc7bd'), 1).fillRect(9.5, 18, 6, 2.6); // sea-glass collar
		g.fillStyle(C('#8f9aa4'), 1).fillRoundedRect(4, 20, 17, 13, 3); // deep scoop
		g.fillStyle(C('#6f7d88'), 1).fillRoundedRect(4, 20, 17, 3, 2); // lip that holds what it lifts
		g.fillStyle(C('#e8d9a8'), 1).fillEllipse(12.5, 28, 9, 6); // salvaged fill
		g.fillStyle(C('#9fc7bd'), 1).fillCircle(10, 27, 1.6).fillCircle(15, 29, 1.4); // sea glass in the load
	}),
	// Tin Watering Can → Rainwater Canteen → Spring-fed Ewer → Cloudcatcher Urn
	wateringcan1: def(32, 28, (g) => {
		g.lineStyle(2.2, C('#8a9096'), 1).strokeEllipse(17, 8, 11, 9); // handle
		g.fillStyle(C('#aab0b4'), 1).fillTriangle(2, 21, 9, 12, 9, 21); // spout
		g.fillStyle(C('#b9bfc2'), 1).fillRoundedRect(8, 10, 15, 14, 3); // tin body
		g.fillStyle(C('#9aa0a4'), 1).fillRect(8, 10, 15, 2.5); // rim
		g.fillStyle(0xffffff, 0.5).fillRect(10, 13, 3, 8); // shine
		g.fillStyle(C('#c7ccce'), 1).fillCircle(4, 21, 2.2); // rose
	}),
	wateringcan2: def(32, 28, (g) => {
		g.fillStyle(C('#6fa8d6'), 1).fillRect(12, 2, 1, 3).fillRect(17, 1, 1, 3); // falling rain
		g.lineStyle(2.2, C('#7a8690'), 1).strokeEllipse(18, 9, 10, 9); // handle
		g.fillStyle(C('#8fa6b8'), 1).fillTriangle(2, 21, 9, 13, 9, 21); // spout
		g.fillStyle(C('#c7d6e2'), 1).fillTriangle(7, 11, 24, 11, 15.5, 6); // rain-catch funnel
		g.fillStyle(C('#9fb4c4'), 1).fillRoundedRect(8, 11, 15, 13, 3); // galvanized body
		g.fillStyle(C('#6fa8d6'), 1).fillRect(9, 16, 13, 7); // rainwater fill
		g.fillStyle(C('#c7ccce'), 1).fillCircle(4, 21, 2.2); // rose
	}),
	wateringcan3: def(32, 28, (g) => {
		g.lineStyle(2.4, C('#6f9a6a'), 1).strokeEllipse(19, 8, 10, 10); // handle
		g.fillStyle(C('#7fae8a'), 1).fillTriangle(1, 19, 8, 9, 8, 19); // long spout
		g.fillStyle(C('#8fbf9a'), 1).fillRoundedRect(9, 8, 14, 16, 4); // tall ewer
		g.fillStyle(C('#bfe0d0'), 1).fillRect(10, 15, 12, 8); // clear spring water
		g.fillStyle(C('#5f8a44'), 1).fillEllipse(15, 6, 5, 2.6); // leaf motif on lid
		g.fillStyle(C('#cfe7d6'), 1).fillCircle(3, 19, 2.4); // rose
	}),
	wateringcan4: def(32, 28, (g) => {
		g.lineStyle(2.6, C('#c9a45a'), 1).strokeEllipse(19, 8, 11, 10); // gold handle
		g.fillStyle(C('#5f8fb8'), 1).fillTriangle(1, 19, 8, 9, 8, 19); // spout
		g.fillStyle(C('#6f9fc8'), 1).fillRoundedRect(8, 9, 16, 16, 5); // urn body
		g.fillStyle(C('#c9a45a'), 1).fillRect(8, 9, 16, 2); // gold rim
		g.fillStyle(C('#8fd0e8'), 1).fillRect(10, 16, 12, 8); // clean water
		g.fillStyle(0xffffff, 0.85).fillCircle(13, 13, 2.4).fillCircle(17, 12.6, 3).fillCircle(20, 14, 2); // cloud
		g.fillStyle(C('#c9a45a'), 1).fillCircle(3.5, 19, 2.6); // gold rose
	}),
	// … → Long-spout Can (desert) → Dipping Pail (alpine) → Channel Urn (coastal)
	wateringcan5: def(32, 28, (g) => {
		g.lineStyle(2.4, C('#a8763c'), 1).strokeEllipse(21, 9, 10, 10); // handle
		g.fillStyle(C('#c98a4e'), 1).fillRoundedRect(11, 9, 14, 16, 4); // fired-clay body
		g.fillStyle(C('#e0b070'), 1).fillRect(11, 9, 14, 2); // rim
		g.fillStyle(C('#8fd0e8'), 1).fillRect(12, 16, 12, 8); // water
		g.fillStyle(C('#b07a52'), 1).fillRect(1, 15, 11, 3.4); // long bar spout
		g.fillStyle(C('#8fd0e8'), 1);
		for (let i = 0; i < 4; i++) g.fillCircle(2.5 + i * 2.6, 20, 0.9); // a row of pour holes
	}),
	wateringcan6: def(32, 28, (g) => {
		g.lineStyle(2.2, C('#8f958a'), 1).strokeEllipse(16, 7, 16, 9); // swing bail
		g.fillStyle(C('#a6ad93'), 1).fillTriangle(6, 24, 26, 24, 24, 11); // tapered pail
		g.fillStyle(C('#8f958a'), 1).fillRect(7, 11, 18, 2.2); // rim
		g.fillStyle(C('#bfe0ea'), 1).fillRect(8, 15, 16, 8); // snowmelt
		g.fillStyle(0xffffff, 0.8).fillCircle(12, 16, 1.6).fillCircle(18, 17, 1.2); // floating ice
		g.fillStyle(C('#dfe6ee'), 1).fillRect(8, 22, 16, 1.6); // waterline
	}),
	wateringcan7: def(32, 28, (g) => {
		g.lineStyle(2.6, C('#9fc7bd'), 1).strokeEllipse(21, 8, 11, 10); // handle
		g.fillStyle(C('#6f9fc8'), 1).fillRoundedRect(9, 8, 16, 17, 5); // urn body
		g.fillStyle(C('#e8d9a8'), 1).fillRect(9, 8, 16, 2); // shore-sand rim
		g.fillStyle(C('#8fd0e8'), 1).fillRect(10, 15, 14, 9); // water
		g.fillStyle(C('#5f8fb8'), 1).fillTriangle(0, 14, 9, 10, 9, 17); // wide channel lip
		g.fillStyle(C('#8fd0e8'), 1).fillRect(0, 16, 9, 2.4); // the pour, running on
		g.fillStyle(C('#9fc7bd'), 1).fillCircle(17, 12, 2); // sea-glass inlay
	}),
};

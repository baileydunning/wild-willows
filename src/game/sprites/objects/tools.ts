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
};

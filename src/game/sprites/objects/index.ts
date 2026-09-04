// Every placeable object, grouped the way the game groups them: one file per
// biome, plus the interior, the camp, the tools and the field guides.

import Phaser from 'phaser';
import { paint } from '../canvas';
import type { SpriteSet } from '../canvas';
import { spriteDataUri } from '../svg';
import { INDOOR } from './indoor';
import { MEADOW } from './meadow';
import { FOREST } from './forest';
import { WETLAND } from './wetland';
import { DESERT } from './desert';
import { ALPINE } from './alpine';
import { COASTAL } from './coastal';
import { SHARED } from './shared';
import { CAMP } from './camp';
import { TOOLS } from './tools';
import { GUIDES } from './guides';
import { LIGHTS } from './lights';
import { makePathTextures } from './paths';

/**
 * Every placeable object's sprite in one registry, keyed by shape — the world's
 * textures and the DOM's pictures both come from here, so a menu icon is always
 * the very sprite the world will draw. Sets merge FIRST-wins, matching paint()'s
 * rule that an earlier set keeps a key a later one repeats.
 */
export const OBJECT_SPRITES: SpriteSet = (() => {
	const out: SpriteSet = {};
	for (const set of [INDOOR, MEADOW, FOREST, WETLAND, DESERT, ALPINE, COASTAL, SHARED, CAMP, TOOLS, GUIDES, LIGHTS])
		for (const [key, s] of Object.entries(set)) if (!(key in out)) out[key] = s;
	return out;
})();

/**
 * One object sprite as an SVG data URI, the way the field journal draws animals.
 * Unlike the boot-time PNG snapshots (`snapshotObjectIcons`) this needs no world
 * and no Phaser texture, so a panel can show the picture before the game boots.
 */
export function objectSpriteDataUri(shape: string, opts: { override?: string | null } = {}): string | null {
	const s = OBJECT_SPRITES[shape];
	return s ? spriteDataUri(s, opts) : null;
}

/** Rasterize every placeable object's sprite, under the `obj-` prefix. */
export function makeObjectTextures(scene: Phaser.Scene) {
	paint(scene, 'obj-', OBJECT_SPRITES);
	// Paths draw themselves: one tile shape per neighbour combination, plus the
	// isolated tile under the plain `obj-` key the menus snapshot for icons.
	makePathTextures(scene);
}

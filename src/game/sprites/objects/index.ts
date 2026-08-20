// Every placeable object, grouped the way the game groups them: one file per
// biome, plus the interior, the camp, the tools and the field guides.

import Phaser from 'phaser';
import { paint } from '../canvas';
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

/** Rasterize every placeable object's sprite, under the `obj-` prefix. */
export function makeObjectTextures(scene: Phaser.Scene) {
	paint(scene, 'obj-', INDOOR, MEADOW, FOREST, WETLAND, DESERT, ALPINE, COASTAL, SHARED, CAMP, TOOLS, GUIDES);
}

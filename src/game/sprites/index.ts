// Procedural placeholder art — every sprite in Wild Willows is generated at
// boot from simple shapes, so the game ships with zero asset files.
//
// This is the barrel the rest of the game imports from. The art itself lives in
// the modules below, grouped the way the game thinks about it: objects by biome,
// animals by taxon.

export { TEX_SCALE, INV_TEX_SCALE, PICKED } from './canvas';
export type { G, SpriteDef, SpriteSet } from './canvas';
export { makeBaseTextures } from './base';
export { CONN_N, CONN_E, CONN_S, CONN_W, connOf, ensureWaterTile } from './tiles';
export type { Conn } from './tiles';
export { PATH_SHAPES, ensurePathTile } from './objects/paths';
export { makeNodeTextures, snapshotResourceIcons, snapshotObjectIcons } from './nodes';
export { makeObjectTextures } from './objects';
export { makePlayerTexture } from './player';
export {
	ANIMAL_SPRITES,
	makeAnimalTextures,
	ensureAnimalTexture,
	animalSpriteDataUri,
	animalTexture,
	animalScale,
} from './animals';

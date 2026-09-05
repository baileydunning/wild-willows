// The drawing surface every sprite module shares.
//
// Wild Willows ships zero art files: every sprite is generated at boot from
// simple shapes, so this is the whole art pipeline — a colour helper, the
// supersampling factor, and the function that rasterizes one draw into a Phaser
// texture. Everything under sprites/ is data for it.

import Phaser from 'phaser';
import { getPrefs } from '../../prefs';

export type G = Phaser.GameObjects.Graphics;

export const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** The inverse of C(): a packed colour back to the `#rrggbb` the SVG writer needs. */
export const hexOf = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);

/**
 * Supersampling factor for all procedural textures. Shapes are authored in
 * "logical" pixels (32px tiles) but rasterized TEX_SCALE× larger so they stay
 * crisp under camera zoom + HiDPI. Every sprite must render at
 * `INV_TEX_SCALE` scale to appear at its logical size — WorldScene's `img()`
 * helper does this. Power of two so logical sizes stay float-exact (no tile seams).
 *
 * RESOLVED ONCE, HERE, AT MODULE LOAD — and it has to stay that way. Both
 * constants are read from dozens of call sites across this file and WorldScene
 * (`0.55 * INV_TEX_SCALE`, `g.generateTexture(k, w * TEX_SCALE, …)`), and the
 * whole scheme only holds together because the factor a texture was rasterized
 * at is the same factor its sprite is scaled back down by. A function that could
 * answer differently at two call sites would render sprites at the wrong size.
 * So this deliberately does NOT follow a mid-session Graphics Quality change —
 * the textures already uploaded to the GPU were built at the old factor, and the
 * next reload picks up the new one. (prefs.ts restores localStorage at import
 * time and is a dependency of this module, so the value below is the player's
 * saved choice, not the default.)
 *
 * Low quality drops to 2×: a QUARTER of the texture memory and of the boot-time
 * rasterizing, since the factor squares into pixel area. That is the trade the
 * setting exists to make, and there is room for it — Low also pins the canvas to
 * 1 device pixel per CSS pixel (renderScale() in prefs.ts), and WorldScene's
 * applyZoom clamps the camera to 2.6× that ratio, so even the most zoomed-in
 * view Low can produce still samples these textures at under 2× density.
 *
 * High stays at 4× on HiDPI as well. That looks like supersampling twice, but it
 * isn't: the device-pixel ratio enters the render path exactly ONCE, through
 * that same camera clamp, which multiplies its bounds by renderScale(). On a 2×
 * display the world is therefore drawn at twice as many device pixels per tile,
 * and 4× textures are barely oversampled — cutting them there would be a visible
 * softening rather than a free win.
 */
export const TEX_SCALE = getPrefs().graphicsQuality === 'low' ? 2 : 4;
export const INV_TEX_SCALE = 1 / TEX_SCALE;

export function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
	if (scene.textures.exists(key)) return;
	const g = scene.make.graphics({ x: 0, y: 0 }, false);
	g.scaleCanvas(TEX_SCALE, TEX_SCALE); // rasterize the logical-pixel draw commands TEX_SCALE× sharper
	draw(g);
	g.generateTexture(key, w * TEX_SCALE, h * TEX_SCALE);
	g.destroy();
}

/** One sprite: its logical size and the commands that draw it. */
export interface SpriteDef {
	w: number;
	h: number;
	draw: (g: G) => void;
}

/** A named group of sprites — one theme, one biome, one taxon per file. */
export type SpriteSet = Record<string, SpriteDef>;

export const def = (w: number, h: number, draw: (g: G) => void): SpriteDef => ({ w, h, draw });

/** Suffix of the picked-variant texture key. */
export const PICKED = '-picked';

/**
 * A plant you can harvest without uprooting it: ONE draw, TWO textures.
 *
 * `<key>` is the plant standing with its yield on it, `<key>-picked` the same
 * plant with the yield taken — cut stems, bare seed heads, an emptied bowl.
 * WorldScene shows the picked texture while the yield regrows and fades the
 * standing one back in on top of it (see attachRegrowth there), which is the
 * one constraint on the picked draw: everything it paints must sit INSIDE the
 * standing sprite's own pixels, or it will still be showing once the plant is
 * back. Buds go where the blooms were, cut ends inside the stems.
 *
 * They share a draw rather than being written twice so the two can't drift:
 * every edit to the plant lands on both states at once.
 */
export const pickable = (key: string, w: number, h: number, draw: (g: G, picked: boolean) => void): SpriteSet => ({
	[key]: def(w, h, (g) => draw(g, false)),
	[`${key}${PICKED}`]: def(w, h, (g) => draw(g, true)),
});

/** Suffix of the put-out variant's texture key. */
export const OUT = '-out';

/**
 * A light you can put out: ONE draw, TWO textures.
 *
 * `<key>` is the thing burning and `<key>-out` the same thing cold. The draw
 * gets a `lit` flag and is expected to BUILD A DIFFERENT PICTURE with it, not
 * merely to skip a highlight: the flame goes and dark logs are left in the
 * grate, the warm pane goes grey, the halo is not drawn at all. That is the
 * whole point of doing it here rather than tinting the sprite in the world —
 * a dimmed flame is still a flame, and a fire that is out has no flame in it.
 *
 * Everything OUTSIDE the flame — the stone surround, the post, the frame — is
 * drawn by the same commands in both states, so the two can never drift into
 * different objects; only the burning part is written twice.
 */
export const lightable = (key: string, w: number, h: number, draw: (g: G, lit: boolean) => void): SpriteSet => ({
	[key]: def(w, h, (g) => draw(g, true)),
	[`${key}${OUT}`]: def(w, h, (g) => draw(g, false)),
});

/**
 * Rasterize every sprite in `sets` under one key prefix.
 *
 * Sets are painted IN ORDER and tex() leaves an existing key alone, so if two
 * sets define the same name the earlier one wins — which is exactly what the
 * single long make*Textures functions did before these were split up.
 */
export function paint(scene: Phaser.Scene, prefix: string, ...sets: SpriteSet[]) {
	for (const set of sets) for (const [key, s] of Object.entries(set)) tex(scene, prefix + key, s.w, s.h, s.draw);
}

// Every animal sprite, grouped by taxon, plus the lookup that decides which one
// a given species gets: a hand-drawn sprite if it has one, the dedicated serpent
// body if it is a snake, and otherwise a sprite composed from its traits.

import Phaser from 'phaser';
import { bridge } from '../../bridge';
import { tex, hexOf } from '../canvas';
import type { G, SpriteSet } from '../canvas';
import { SvgGraphics } from '../svg';
import { composeAnimalDraw, animalTint } from './compose';
import { MAMMALS } from './mammals';
import { BIRDS } from './birds';
import { INSECTS } from './insects';
import { INVERTEBRATES } from './invertebrates';
import { REPTILES } from './reptiles';
import { AMPHIBIANS } from './amphibians';
import { GENERIC } from './generic';

/**
 * Animal sprite registry. Each entry is a width/height + a draw function using
 * the same primitives as the Phaser Graphics API. The in-game textures and the
 * field-journal thumbnails both render from these, so they always match.
 * Featured species have bespoke art with baked colours; generic kind bodies are
 * drawn in white (0xffffff) and tinted per animal.
 */
export const ANIMAL_SPRITES: SpriteSet = {
	...MAMMALS,
	...BIRDS,
	...INSECTS,
	...INVERTEBRATES,
	...REPTILES,
	...AMPHIBIANS,
	...GENERIC,
};

export function makeAnimalTextures(scene: Phaser.Scene) {
	for (const [key, s] of Object.entries(ANIMAL_SPRITES)) tex(scene, `ani-${key}`, s.w, s.h, s.draw);
	// A bespoke trait-built sprite for every animal that isn't a hand-drawn
	// featured one, so no two species share a silhouette.
	for (const an of bridge.shared.data?.animals || []) {
		if (FEATURED_TEXTURE[an.id] || /snake/.test(an.id)) continue;
		const c = composeAnimalDraw(an.id, an.kind);
		tex(scene, `ani-gen-${an.id}`, c.w, c.h, c.draw);
	}
}

/** Make sure one animal's trait sprite exists (covers the fresh-login race where
 * definitions arrive after the scene first booted). */
export function ensureAnimalTexture(scene: Phaser.Scene, id: string, kind: string) {
	if (FEATURED_TEXTURE[id] || /snake/.test(id)) return; // those are always registered
	const key = `ani-gen-${id}`;
	if (scene.textures.exists(key)) return;
	const c = composeAnimalDraw(id, kind);
	tex(scene, key, c.w, c.h, c.draw);
}

export const FEATURED_TEXTURE: Record<string, string> = {
	'cottontail-rabbit': 'ani-rabbit',
	'monarch-butterfly': 'ani-butterfly',
	'song-sparrow': 'ani-sparrow',
	'mule-deer': 'ani-deer',
	'red-fox': 'ani-fox',
	'gray-fox': 'ani-grayfox',
	lynx: 'ani-lynx',
	'tree-squirrel': 'ani-squirrel',
	woodpecker: 'ani-woodpecker',
	'forest-salamander': 'ani-salamander',
	'tiger-salamander': 'ani-salamander',
	'great-horned-owl': 'ani-owl',
	'barn-owl': 'ani-barnowl',
	'black-bear': 'ani-bear',
	raccoon: 'ani-raccoon',
	'grizzly-bear': 'ani-grizzly',
	// newer animals — each gets its own bespoke sprite
	'praying-mantis': 'ani-mantis',

	snail: 'ani-snail',
	'purple-sea-urchin': 'ani-urchin',
	'kangaroo-rat': 'ani-kangaroorat',
	'mountain-lion': 'ani-mountainlion',
	'rock-squirrel': 'ani-rocksquirrel',
	'white-throated-swift': 'ani-swift',
	coyote: 'ani-coyote',
	'sand-dollar': 'ani-sanddollar',
	crow: 'ani-crow',
	ladybug: 'ani-ladybeetle',
	groundhog: 'ani-groundhog',
	opossum: 'ani-opossum',
	puffin: 'ani-puffin',
	'luna-moth': 'ani-lunamoth',
	'polyphemus-moth': 'ani-polyphemus',
	'alpine-butterfly': 'ani-parnassian',
	skunk: 'ani-skunk',
	'blue-jay': 'ani-bluejay',
	orca: 'ani-orca',
	'gray-whale': 'ani-graywhale',
	octopus: 'ani-octopus',
	'alpine-moth': 'ani-moth',
	javelina: 'ani-javelina',
	crayfish: 'ani-crayfish',
	'freshwater-shrimp': 'ani-shrimp',
	pillbug: 'ani-pillbug',
	'banana-slug': 'ani-bananaslug',
	'snow-flea': 'ani-snowflea',
	'beach-hopper': 'ani-beachhopper',
	'hermit-crab': 'ani-hermitcrab',
	'desert-termite': 'ani-termite',
	'desert-millipede': 'ani-millipede',
	'brown-bat': 'ani-bat',
	towhee: 'ani-towhee',
	merganser: 'ani-merganser',
	phainopepla: 'ani-phainopepla',
	'black-turnstone': 'ani-turnstone',
	'bat-star': 'ani-batstar',
};

export function animalTexture(animalId: string, kind: string): { key: string; tint: number | null } {
	if (FEATURED_TEXTURE[animalId]) return { key: FEATURED_TEXTURE[animalId], tint: null };
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	// snakes are legless — use the dedicated serpent sprite, not the generic lizard
	if (/snake/.test(animalId)) return { key: 'ani-snake', tint: animalTint(hash) };
	// every other animal gets its own trait-built sprite (registered at boot)
	return { key: `ani-gen-${animalId}`, tint: animalTint(hash) };
}

// Roughly proportional sprite sizes so a bear reads as far bigger than a
// chipmunk or a salamander. Most specific keyword wins (rules are checked top
// to bottom), then we fall back to a per-kind size, then add a tiny
// deterministic jitter so same-size species still look like individuals.
const SIZE_RULES: [RegExp, number][] = [
	[/orca/, 2.6], // the biggest thing in the preserve
	[/whale|dolphin/, 1.95],
	[/bear|elk|moose/, 1.7],
	[/deer|bighorn|mountain-goat|mountain-lion|coyote|seal|sandhill|crane|brown-pelican|eagle|turkey/, 1.42],
	[
		/fox|bobcat|otter|beaver|raccoon|porcupine|heron|owl|hawk|cormorant|marten|muskrat|mink|yellow-bellied-marmot|tortoise|sea-turtle|roadrunner|gull|snowshoe-hare/,
		1.18,
	],
	[
		/rabbit|cottontail|jackrabbit|duck|quail|white-tailed-ptarmigan|squirrel|rattlesnake|snake|nutcracker|woodpecker|shorebird|crab|sea-star|anemone/,
		0.95,
	],
	[
		/chipmunk|vole|rat|mouse|pika|sparrow|swallow|nuthatch|blackbird|meadowlark|frog|salamander|newt|lizard|turtle|trout|fish|mussel|clam/,
		0.7,
	],
	[/butterfly|bee|beetle|dragonfly|damselfly|grasshopper|strider|scorpion|desert-tarantula|slug|snail/, 0.5],
];

const KIND_SIZE: Record<string, number> = {
	mammal: 1.0,
	bird: 0.9,
	reptile: 0.8,
	amphibian: 0.65,
	fish: 0.8,
	insect: 0.5,
	invertebrate: 0.5,
};

/** Proportional size multiplier for an animal sprite. */
export function animalScale(animalId: string, kind = 'mammal'): number {
	let base: number | null = null;
	for (const [re, size] of SIZE_RULES) {
		if (re.test(animalId)) {
			base = size;
			break;
		}
	}
	if (base == null) base = KIND_SIZE[kind] ?? 1.0;
	// small deterministic jitter (±0.05) keyed off the id — variety without
	// ever flipping the size ordering between species.
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const jitter = (((hash >>> 3) % 11) - 5) / 100; // ±0.05, unsigned so it never overshoots
	return Math.round((base + jitter) * 100) / 100;
}

/**
 * Render an animal's sprite as an SVG data URI for use in the DOM (field
 * journal). `silhouette` draws it as a single dark shape for animals that have
 * not returned yet. Featured animals use their hand-drawn sprite; everyone else
 * gets the same trait-built sprite the world uses.
 */
export function animalSpriteDataUri(animalId: string, kind: string, opts: { silhouette?: boolean } = {}): string {
	const override = opts.silhouette ? '#4a4636' : null;
	const toUri = (g: SvgGraphics, w: number, h: number) => 'data:image/svg+xml;base64,' + btoa(g.toSvg(w, h));

	if (FEATURED_TEXTURE[animalId]) {
		const name = FEATURED_TEXTURE[animalId].replace('ani-', '');
		const shape = ANIMAL_SPRITES[name] || ANIMAL_SPRITES['mammal-0'];
		const g = new SvgGraphics(null, override);
		shape.draw(g as unknown as G);
		return toUri(g, shape.w, shape.h);
	}
	let hash = 0;
	for (const ch of animalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	const tintHex = hexOf(animalTint(hash));
	if (/snake/.test(animalId)) {
		const shape = ANIMAL_SPRITES['snake'];
		const g = new SvgGraphics(tintHex, override);
		shape.draw(g as unknown as G);
		return toUri(g, shape.w, shape.h);
	}
	const c = composeAnimalDraw(animalId, kind);
	const g = new SvgGraphics(tintHex, override);
	c.draw(g as unknown as G);
	return toUri(g, c.w, c.h);
}

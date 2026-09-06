// What each achievement's badge actually shows.
//
// The panel used to draw its own line-art glyph set, which meant a fox
// achievement showed a fox that existed nowhere else in the game. These map
// each achievement icon onto the preserve's own art instead: the animal's
// sprite, the object's sprite, the tool's sprite — the exact picture the world
// draws — with a small set of emblems (sprites too, in the same palette) for
// the few achievements that stand for something no single object can.
//
// Every achievement in the data is mapped, and a unit test keeps it that way; an
// unmapped one falls back to a leaf rather than rendering nothing.

import { animalSpriteDataUri, objectSpriteDataUri, emblemSpriteDataUri } from '../game/sprites';
import { Icon } from './icons';

type Art = { animal: string; kind: string } | { object: string } | { emblem: string };

/** icon name (data/achievements.json) → the art that stands for it. */
export const ACHIEVEMENT_ART: Record<string, Art> = {
	// the animals themselves
	'ach-grasshopper': { animal: 'grasshopper', kind: 'insect' },
	'ach-fox-head': { animal: 'red-fox', kind: 'mammal' },
	'ach-owl-moon': { animal: 'great-horned-owl', kind: 'bird' },
	'ach-beaver-dam': { animal: 'beaver', kind: 'mammal' },
	'ach-rattlesnake': { animal: 'rattlesnake', kind: 'reptile' },
	'ach-pika': { animal: 'pika', kind: 'mammal' },
	'ach-eagle': { animal: 'golden-eagle', kind: 'bird' },
	'ach-seastar': { animal: 'sea-star', kind: 'invertebrate' },
	'ach-otter': { animal: 'sea-otter', kind: 'mammal' },
	'ach-pelican': { animal: 'brown-pelican', kind: 'bird' },

	// habitat you plant, shape and build
	'ach-butterfly': { object: 'pollinatorgarden' }, // the monarch alone reads as two orange dots this small
	'ach-wildflower': { object: 'flowers' },
	'ach-grass-tuft': { object: 'bunchgrass' },
	'ach-fern': { object: 'fernclump' },
	'ach-tree-hollow': { object: 'oldcavity' },
	'ach-conifer': { object: 'fir' },
	'ach-three-trees': { object: 'oak' },
	'ach-cattail': { object: 'cattail' },
	'ach-heron': { object: 'heronrookery' }, // the rookery, so it can't be mistaken for the eagle's badge
	'ach-lake': { object: 'pond' },
	'ach-droplet-ripple': { object: 'shallowpool' },
	'ach-cactus': { object: 'saguarocolumn' },
	'ach-burrow': { object: 'burrowtown' },
	'ach-agave': { object: 'agave' },
	'ach-alpine-flower': { object: 'alpineflowers' },
	'ach-wave': { object: 'surfline' },
	'ach-shell': { object: 'shelldrift' },
	'ach-blueprint': { object: 'birdhouse' },
	'ach-trail-gate': { object: 'fence' },
	'ach-signpost': { object: 'signpost' },
	'ach-binoculars': { object: 'binoculars' },
	'ach-recipe-stack': { object: 'bookshelf' },
	'ach-open-book': { object: 'guide-meadow' },

	// the kit, at the tier the achievement is about
	'ach-gather-hand': { object: 'basket1' },
	'ach-full-basket': { object: 'basket4' },
	'ach-watering-can': { object: 'wateringcan4' },
	'ach-spade-water': { object: 'shovel4' },
	'ach-toolbelt': { emblem: 'kit' },

	// the few that stand for a whole preserve rather than one thing in it
	'ach-meadow-sun': { emblem: 'sun-meadow' },
	'ach-marsh-sun': { emblem: 'sun-marsh' },
	'ach-desert-sun': { emblem: 'sun-desert' },
	'ach-peak': { emblem: 'peak' },
	'ach-range': { emblem: 'range' },
	'ach-paws-fifty': { emblem: 'paws' },
	'ach-balance-leaf': { emblem: 'leaf-balance' },
	'ach-triple-leaf': { emblem: 'leaf-triple' },
	'ach-laurel': { emblem: 'laurel' },
	'ach-mallet': { emblem: 'mallet' },
	'ach-sprout-thumb': { emblem: 'sprout' },
};

// Each picture is the same every time it is asked for, and drawing one means
// running its sprite's draw commands into a string — so build each at most once.
const cache = new Map<string, string | null>();

/** The data URI for one achievement's picture, or null if it has no mapping. */
export function achievementArtUri(icon: string): string | null {
	if (cache.has(icon)) return cache.get(icon)!;
	const art = ACHIEVEMENT_ART[icon];
	let uri: string | null = null;
	try {
		if (art && 'animal' in art) uri = animalSpriteDataUri(art.animal, art.kind);
		else if (art && 'object' in art) uri = objectSpriteDataUri(art.object);
		else if (art && 'emblem' in art) uri = emblemSpriteDataUri(art.emblem);
	} catch {
		uri = null; // a renamed sprite should never take the panel down with it
	}
	cache.set(icon, uri);
	return uri;
}

/**
 * The picture inside an achievement's star badge. Sprites come in every aspect
 * ratio the world uses, so it renders contained in a square box; locked cards
 * mute theirs in CSS rather than here, so earning one is a colour arriving.
 */
export function AchievementGlyph({ icon, size = 38 }: { icon: string; size?: number }) {
	const uri = achievementArtUri(icon);
	if (!uri) return <Icon name="leaf" size={Math.round(size * 0.7)} />;
	return (
		<img
			className="ach-art"
			src={uri}
			width={size}
			height={size}
			alt=""
			aria-hidden="true"
			style={{ objectFit: 'contain' }}
		/>
	);
}

// The cover of each bookshelf book, and the picture on each of its pages.
//
// Same principle as achievementArt.tsx: a picture in a menu is the very sprite
// the world draws, not a second set of art that exists only in the UI. The four
// covers are sprites too (game/sprites/books.ts) — a book each, not one book in
// four colours, because they sit in a list together and a shelf of identical
// spines is no shelf.
//
// A page's picture is a row of figures joined by a plus or an arrow, so the row
// itself carries the idea the page is explaining:
//
//   grass + cover + water -> rabbit          (habitat is three jobs, not a place)
//   grass -> grasshopper -> sparrow -> fox   (each step stands on the one below)
//
// `sizes` shrinks the figures along a row where the point IS the shrinking —
// the energy pyramid page, where each step up supports fewer animals.
//
// The captions live in the catalog (narrative.stories.<id>.pages.<n>.figures, in
// this order), so a translation moves the words without touching the pictures.

import React from 'react';
import { animalSpriteDataUri, bookSpriteDataUri, emblemSpriteDataUri, objectSpriteDataUri } from '../game/sprites';
import { tList } from '../i18n';
import { Icon } from './icons';

/** One picture: a placeable object's sprite, an animal's, or an emblem. */
type Figure = { object: string } | { animal: string; kind: string } | { emblem: string };

/** What joins a figure to the one before it. `plus` reads "and also", `arrow`
 *  reads "and so" — the difference between ingredients and consequences. */
type Joiner = 'plus' | 'arrow';

interface Page {
	figures: Figure[];
	/** One per gap, so always `figures.length - 1` long. */
	joiners: Joiner[];
	/** Optional per-figure size multiplier, same length as `figures`. */
	sizes?: number[];
}

/** The book sprite on each spine — see game/sprites/books.ts. */
export const STORY_COVERS: Record<string, string> = {
	somewhere: 'book-habitat',
	foxlast: 'book-foodchain',
	whobuild: 'book-engineer',
	slowgreen: 'book-succession',
};

/** Page pictures, in reading order. One per page of prose in the catalog. */
export const STORY_PAGES: Record<string, Page[]> = {
	somewhere: [
		// Food, cover and water add up to somewhere an animal can actually live.
		{
			figures: [
				{ object: 'bunchgrass' },
				{ object: 'brushpile' },
				{ object: 'shallowpool' },
				{ animal: 'cottontail-rabbit', kind: 'mammal' },
			],
			joiners: ['plus', 'plus', 'arrow'],
		},
		// Water on the far side of open ground is water that goes unused.
		{
			figures: [{ object: 'shallowpool' }, { object: 'bareground' }, { animal: 'cottontail-rabbit', kind: 'mammal' }],
			joiners: ['plus', 'arrow'],
		},
		// Two species, one meadow, no competition — different hours, different food.
		{
			figures: [
				{ animal: 'song-sparrow', kind: 'bird' },
				{ animal: 'grasshopper-mouse', kind: 'mammal' },
			],
			joiners: ['plus'],
		},
		// Flowers are not the missing piece. Cover is.
		{
			figures: [
				{ object: 'pollinatorgarden' },
				{ object: 'brushpile' },
				{ animal: 'cottontail-rabbit', kind: 'mammal' },
			],
			joiners: ['plus', 'arrow'],
		},
	],
	foxlast: [
		// A food chain, drawn as one: every step is eaten by the next.
		{
			figures: [
				{ object: 'bunchgrass' },
				{ animal: 'grasshopper', kind: 'insect' },
				{ animal: 'song-sparrow', kind: 'bird' },
				{ animal: 'red-fox', kind: 'mammal' },
			],
			joiners: ['arrow', 'arrow', 'arrow'],
		},
		// The same chain as an energy pyramid: each step feeds far fewer than the
		// last, so the figures themselves shrink toward the fox.
		{
			figures: [
				{ object: 'bunchgrass' },
				{ animal: 'grasshopper', kind: 'insect' },
				{ animal: 'song-sparrow', kind: 'bird' },
				{ animal: 'red-fox', kind: 'mammal' },
			],
			joiners: ['arrow', 'arrow', 'arrow'],
			sizes: [1, 0.82, 0.66, 0.52],
		},
		// Thin the prey and the top of the chain is what goes.
		{
			figures: [
				{ animal: 'prairie-vole', kind: 'mammal' },
				{ animal: 'red-fox', kind: 'mammal' },
			],
			joiners: ['arrow'],
		},
		// A fox settling is a statement about the whole meadow under it.
		{
			figures: [{ animal: 'red-fox', kind: 'mammal' }, { emblem: 'sun-meadow' }],
			joiners: ['arrow'],
		},
	],
	whobuild: [
		// The beaver wants deep water. The pond is a by-product.
		{
			figures: [{ animal: 'beaver', kind: 'mammal' }, { object: 'beaverpond' }],
			joiners: ['arrow'],
		},
		// And three more species move into the by-product.
		{
			figures: [
				{ object: 'beaverpond' },
				{ animal: 'chorus-frog', kind: 'amphibian' },
				{ animal: 'dragonfly', kind: 'insect' },
				{ animal: 'great-blue-heron', kind: 'bird' },
			],
			joiners: ['arrow', 'plus', 'plus'],
		},
		// The keystone case, drawn with the example the page names.
		{
			figures: [{ animal: 'sea-otter', kind: 'mammal' }, { object: 'urchinpit' }, { object: 'kelpforest' }],
			joiners: ['arrow', 'arrow'],
		},
		// One animal back, and a crowd behind it.
		{
			figures: [{ animal: 'beaver', kind: 'mammal' }, { emblem: 'paws' }],
			joiners: ['arrow'],
		},
	],
	slowgreen: [
		// Nothing grand goes first. Weeds do.
		{
			figures: [{ object: 'bareground' }, { object: 'nativegrass' }],
			joiners: ['arrow'],
		},
		// Grass makes the litter and shade a shrub needs.
		{
			figures: [{ object: 'nativegrass' }, { object: 'leaflitter' }, { object: 'serviceberry' }],
			joiners: ['arrow', 'arrow'],
		},
		// A seedling counts for nothing until it has grown in.
		{
			figures: [{ object: 'oak' }, { object: 'nest' }],
			joiners: ['arrow'],
		},
		// The whole arc, as the closing picture.
		{
			figures: [{ object: 'bareground' }, { object: 'nativegrass' }, { object: 'serviceberry' }, { object: 'oak' }],
			joiners: ['arrow', 'arrow', 'arrow'],
		},
	],
};

/** How many pages a book has — the panel's page count comes from the pictures. */
export const pageCount = (id: string): number => STORY_PAGES[id]?.length || 0;

// Every figure draws the same picture every time it is asked for, and drawing
// one means running its sprite's commands into a string — so build each once.
const cache = new Map<string, string | null>();

/** The data URI for one figure's picture, or null if its sprite is gone. */
export function figureUri(fig: Figure): string | null {
	const key = 'object' in fig ? `o:${fig.object}` : 'animal' in fig ? `a:${fig.animal}` : `e:${fig.emblem}`;
	if (cache.has(key)) return cache.get(key)!;
	let uri: string | null = null;
	try {
		uri =
			'object' in fig
				? objectSpriteDataUri(fig.object)
				: 'animal' in fig
					? animalSpriteDataUri(fig.animal, fig.kind)
					: emblemSpriteDataUri(fig.emblem);
	} catch {
		uri = null; // a renamed sprite must never take the panel down with it
	}
	cache.set(key, uri);
	return uri;
}

/** A book's own cover sprite, for the shelf. */
export function storyCoverUri(id: string): string | null {
	const key = `b:${id}`;
	if (cache.has(key)) return cache.get(key)!;
	let uri: string | null = null;
	try {
		uri = bookSpriteDataUri(STORY_COVERS[id] || '');
	} catch {
		uri = null;
	}
	cache.set(key, uri);
	return uri;
}

/**
 * The picture on one page. Sprites come in every aspect ratio the world uses, so
 * each is drawn contained in a box of its own; the row scrolls sideways rather
 * than squeezing, which matters most at the largest text scales.
 */
export function StoryPlate({ id, page, size = 60 }: { id: string; page: number; size?: number }) {
	const plate = STORY_PAGES[id]?.[page];
	if (!plate) return null;
	const captions = tList(`narrative.stories.${id}.pages.${page + 1}.figures`);
	// No role="img" with a summary label: the captions under the sprites are real
	// text and are the accessible reading of the picture, so a screen reader gets
	// "food, cover, water, somewhere to live" from the figures themselves. Only
	// the pictures and the joiners between them are hidden.
	return (
		<div className="story-plate">
			{plate.figures.map((fig, i) => {
				const uri = figureUri(fig);
				const box = Math.round(size * (plate.sizes?.[i] ?? 1));
				return (
					<React.Fragment key={i}>
						{i > 0 && (
							<span className="story-join">
								<Icon name={plate.joiners[i - 1] === 'plus' ? 'plus' : 'forward'} size={13} />
							</span>
						)}
						<figure className="story-fig">
							<span className="story-fig-art" style={{ width: box, height: box }}>
								{uri ? (
									<img src={uri} alt="" aria-hidden="true" style={{ objectFit: 'contain' }} />
								) : (
									<Icon name="leaf" size={Math.round(box * 0.6)} />
								)}
							</span>
							<figcaption>{captions[i] || ''}</figcaption>
						</figure>
					</React.Fragment>
				);
			})}
		</div>
	);
}

/** A book's cover, at the size the shelf and the open page want it. */
export function StoryCover({ id, size = 38 }: { id: string; size?: number }) {
	const uri = storyCoverUri(id);
	if (!uri) return <Icon name="journal" size={Math.round(size * 0.7)} />;
	return (
		<img
			className="story-cover"
			src={uri}
			width={size}
			height={size}
			alt=""
			aria-hidden="true"
			style={{ objectFit: 'contain' }}
		/>
	);
}

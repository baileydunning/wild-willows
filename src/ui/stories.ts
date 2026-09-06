// The four books on the bookshelf in your home, and what each is about.
//
// Pure display flavour, like ui/lore.ts: no server state, nothing saved, nothing
// unlocked. Walk up to a Bookshelf indoors, press the interact key, take one off
// the shelf and turn its pages — the shelf is the only way in, the way the
// field-journal stand is the only way to open the journal at the biome you are
// standing in.
//
// Each book is one ecology idea the game already models, in four pages, told
// plainly rather than in character. The prose lives in the catalog
// (narrative.stories.<id>.*) and the pictures in ui/storyArt.tsx — this stays a
// thin lookup that resolves through t()/tList() at read time, so a locale change
// re-renders into the new language with no cache to clear.

import { t, tList } from '../i18n';
import { pageCount } from './storyArt';

/** Shelf order, left to right. Also the order the panel lists them in. */
export const STORY_IDS = ['somewhere', 'foxlast', 'whobuild', 'slowgreen'] as const;

export type StoryId = (typeof STORY_IDS)[number];

/** One page of a book: its heading, its paragraph, and its picture's captions. */
export interface StoryPage {
	title: string;
	text: string;
}

export interface Story {
	id: StoryId;
	/** The book's title on the shelf and at the head of every page. */
	title: string;
	/** The small line under it — what the book is about, in three or four words. */
	byline: string;
	/** Pages, in reading order. Always as many as the book has pictures. */
	pages: StoryPage[];
}

/** One book, with its text resolved in the language that is on right now. */
export function story(id: StoryId): Story {
	// The pictures decide how long a book is: a page of prose with nothing to
	// show would open onto an empty frame, so the pair is kept in step here and
	// checked in tests/unit/stories.test.ts.
	const pages: StoryPage[] = [];
	for (let i = 1; i <= pageCount(id); i++) {
		pages.push({
			title: t(`narrative.stories.${id}.pages.${i}.title`),
			text: t(`narrative.stories.${id}.pages.${i}.text`),
		});
	}
	return {
		id,
		title: t(`narrative.stories.${id}.title`),
		byline: t(`narrative.stories.${id}.byline`),
		pages,
	};
}

/** Every book on the shelf, in shelf order. */
export function stories(): Story[] {
	return STORY_IDS.map(story);
}

/** The captions under one page's picture, in the picture's own order. */
export function pageFigures(id: StoryId, page: number): string[] {
	return tList(`narrative.stories.${id}.pages.${page + 1}.figures`);
}

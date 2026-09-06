// The tarot deck you can set out on a table once the meadow has company.
//
// Same shape as ui/sky.ts and ui/stories.ts — pure display flavor, no server
// state, nothing unlocked, nothing to grind. Walk up to the deck, press the
// interact key, and either read about what tarot IS or sit down for a reading.
// This file is the catalog of what is in the deck and the rules of a spread;
// the words live in the catalog (narrative.tarot.*) and the pictures in
// ui/arcanaArt.tsx.
//
// A WHOLE deck, deliberately: seventy-eight cards, the twenty-two Major Arcana
// of the Fool's Journey and the fifty-six Minor Arcana across four suits. A
// partial deck would teach the wrong thing — half the point of a reading is
// that a Minor Arcana card means something different from a Major one, and you
// cannot feel that if the Minors were never in the pile.
//
// NOTHING HERE IS FORTUNE TELLING. Every card carries both readings it really
// has, the light and the shadow, and the panel says plainly that the deck is a
// prompt to think with. That is also why a reading is not saved anywhere: a
// record of what the cards said would make it a thing to grind or to regret,
// and it is meant to be a quiet minute at a table.

import { t } from '../i18n';

export type Arcana = 'major' | 'minor';
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type Element = 'fire' | 'water' | 'air' | 'earth';

/** Ace through ten, then the four court cards — the shape of every suit. */
export const RANKS = [
	'ace',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'page',
	'knight',
	'queen',
	'king',
] as const;
export type Rank = (typeof RANKS)[number];

/** The four court ranks, which read as people rather than as numbers. */
export const COURT: Rank[] = ['page', 'knight', 'queen', 'king'];

/** The four suits in the order the guide introduces them, with the element each
 *  one carries. Fire acts, water feels, air thinks, earth builds. */
export const SUITS: { id: Suit; element: Element }[] = [
	{ id: 'wands', element: 'fire' },
	{ id: 'cups', element: 'water' },
	{ id: 'swords', element: 'air' },
	{ id: 'pentacles', element: 'earth' },
];

export const SUIT_ELEMENT: Record<Suit, Element> = {
	wands: 'fire',
	cups: 'water',
	swords: 'air',
	pentacles: 'earth',
};

export interface CardDef {
	/** 'fool', 'star' … for the Majors; '<suit>-<rank>' for everything else. */
	id: string;
	arcana: Arcana;
	/** 0–21 down the Fool's Journey; 1–14 up a suit. */
	number: number;
	suit?: Suit;
	rank?: Rank;
	/** Every card has one. The Majors' elements are the traditional
	 *  attributions; a Minor takes its suit's. */
	element: Element;
}

/** The Major Arcana in journey order, with the element each is traditionally
 *  given. Judgment, not Judgement — the catalogs are American English. */
const MAJOR_ELEMENTS: [string, Element][] = [
	['fool', 'air'],
	['magician', 'fire'],
	['high-priestess', 'water'],
	['empress', 'earth'],
	['emperor', 'fire'],
	['hierophant', 'earth'],
	['lovers', 'air'],
	['chariot', 'water'],
	['strength', 'fire'],
	['hermit', 'earth'],
	['wheel', 'fire'],
	['justice', 'air'],
	['hanged-man', 'water'],
	['death', 'water'],
	['temperance', 'fire'],
	['devil', 'earth'],
	['tower', 'fire'],
	['star', 'air'],
	['moon', 'water'],
	['sun', 'fire'],
	['judgment', 'fire'],
	['world', 'earth'],
];

export const MAJORS: CardDef[] = MAJOR_ELEMENTS.map(([id, element], i) => ({
	id,
	arcana: 'major' as const,
	number: i,
	element,
}));

export const MINORS: CardDef[] = SUITS.flatMap(({ id: suit, element }) =>
	RANKS.map((rank, i) => ({
		id: `${suit}-${rank}`,
		arcana: 'minor' as const,
		number: i + 1,
		suit,
		rank,
		element,
	})),
);

/** The whole deck: twenty-two Majors, then fifty-six Minors by suit. */
export const DECK: CardDef[] = [...MAJORS, ...MINORS];

const BY_ID = new Map(DECK.map((c) => [c.id, c]));

export const cardDef = (id: string): CardDef | undefined => BY_ID.get(id);

// ------------------------------------------------------------------- words

export interface CardText {
	name: string;
	/** The one-line epithet under the name — "the first step", "the reckoning". */
	byline: string;
	/** Three or four words, for the hover tip and the card face. */
	keywords: string;
	/** What it says the way up it was dealt. */
	upright: string;
	/** What it says turned over — blocked, inward, or not yet. */
	reversed: string;
	/** The same two, as noun phrases, for the seat line. See `seatReading`. */
	phraseUpright: string;
	phraseReversed: string;
}

/** Catalog group per arcana: narrative.tarot.majors.* / narrative.tarot.minors.* */
const GROUP: Record<Arcana, string> = { major: 'majors', minor: 'minors' };

/** Everything a card says, from the catalog. Same shape as sky.ts's `subject`:
 *  the ids are the keys, so a card with no entry shows up as an unresolved key
 *  in the test rather than as blank space in the panel. */
export function cardText(id: string): CardText {
	const def = BY_ID.get(id);
	const base = `narrative.tarot.${GROUP[def?.arcana || 'major']}.${id}`;
	return {
		name: t(`${base}.name`),
		byline: t(`${base}.byline`),
		keywords: t(`${base}.keywords`),
		upright: t(`${base}.upright`),
		reversed: t(`${base}.reversed`),
		phraseUpright: t(`${base}.phraseUpright`),
		phraseReversed: t(`${base}.phraseReversed`),
	};
}

/**
 * What this card says IN THIS SEAT, as one sentence.
 *
 * The card's own reading is the same wherever it lands, which is why a panel
 * that shows only that reads as two unrelated things stapled together: a
 * position on one line, a description on the next, and no sentence anywhere
 * joining them. So each seat owns a frame with a slot in it ("What is in the
 * way: {card}."), and each card owns a short noun phrase for both of its faces.
 * Nine frames and seventy-eight pairs of phrases make every card in every seat,
 * either way up, its own sentence, and it is a sentence rather than a label.
 *
 * The frame carries the position and the tense; the phrase carries the card.
 * That division is why this works in Spanish too, where a template that tried
 * to conjugate around an inserted clause would not.
 */
export function seatReading(seat: string, cardId: string, reversed: boolean): string {
	const text = cardText(cardId);
	return t(`narrative.tarot.seats.${seat}.frame`, {
		card: reversed ? text.phraseReversed : text.phraseUpright,
	});
}

/**
 * The opening sentence of a reading.
 *
 * The hover tip shows BOTH of a card's faces, light and shadow, so you can see
 * at a glance what it is; the pane below gives the whole of the one it actually
 * landed on, in the seat it landed in. Without this the tip would repeat the
 * pane word for word while sitting on top of it, which is how it read before.
 */
export function gist(text: string): string {
	// Sentences until there is enough of one to be worth reading. A flat "first
	// sentence" rule is not enough: several readings open on a two-word command
	// ("Stop."), and "Light: Stop." tells nobody anything.
	let out = '';
	for (const part of text.match(/[^.!?]+[.!?]+["'\u201d]?\s*/g) || [text]) {
		out += part;
		if (out.trim().length >= 24) break;
	}
	return out.trim() || text;
}

/** What a card says in the position it landed in — the reading itself. */
export const readingOf = (drawn: Drawn): string =>
	drawn.reversed ? cardText(drawn.id).reversed : cardText(drawn.id).upright;

// ----------------------------------------------------------------- spreads

/**
 * Three spreads, three cards each, in one row.
 *
 * A tarot panel can offer the whole apparatus, and this one deliberately does
 * not. Everything past three cards was either a wide row nobody read as a
 * shape or, in the Celtic Cross, a four-row grid with a card laid sideways
 * across the middle of it: at panel size that is a pile, not a spread. Three
 * cards in a row is the layout that stays legible, and it happens to be the
 * layout most real readings use.
 *
 * What varies is the QUESTION each seat asks, which is the part actually worth
 * learning: the same card in "obstacle" and in "advice" is two different
 * sentences. So the three on offer are three different kinds of question rather
 * than three different sizes of grid.
 */
export interface SpreadDef {
	id: string;
	/** The three seats, left to right. */
	seats: [string, string, string];
}

/** Every spread deals this many. Written down once so the panel, the dealer and
 *  the test all agree without any of them counting. */
export const SPREAD_SIZE = 3;

export const SPREADS: SpreadDef[] = [
	// The familiar one: how this got here and where it goes.
	{ id: 'past-present-future', seats: ['past', 'present', 'future'] },
	// The most practical one: what is happening, what is in the way, what helps.
	{ id: 'situation-obstacle-advice', seats: ['situation', 'obstacle', 'advice'] },
	// The one about how you are rather than what to do.
	{ id: 'mind-body-spirit', seats: ['mind', 'body', 'spirit'] },
];

export const spreadDef = (id: string): SpreadDef => SPREADS.find((s) => s.id === id) || SPREADS[0];

export const spreadName = (id: string): string => t(`narrative.tarot.spreads.${id}.name`);
export const spreadBlurb = (id: string): string => t(`narrative.tarot.spreads.${id}.blurb`);
export const seatName = (key: string): string => t(`narrative.tarot.seats.${key}.name`);
export const seatBlurb = (key: string): string => t(`narrative.tarot.seats.${key}.blurb`);

// ------------------------------------------------------------------- dealing

export interface Drawn {
	id: string;
	/** The seat it landed in — one of the spread's three seat keys. */
	seat: string;
	/** Dealt upside-down. Always false when reversals are switched off. */
	reversed: boolean;
}

/** A small deterministic generator, so one reading stays put. Re-rendering the
 *  panel — a hover, a language change, a window resize — must never quietly
 *  reshuffle the cards under the player; only pressing shuffle may. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = Math.imul(a ^ (a >>> 15), 1 | a);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** A fresh seed for a fresh shuffle. */
export const newSeed = (): number => (Math.random() * 0x7fffffff) | 0;

/**
 * Deal one spread.
 *
 * A real shuffle of the whole deck — Fisher–Yates over all seventy-eight cards,
 * so a Minor is exactly as likely as a Major and no card can turn up twice in
 * one reading. Reversals are decided per card as it is dealt, and only if the
 * player asked for them.
 */
export function deal(spread: SpreadDef, opts: { seed: number; reversals: boolean }): Drawn[] {
	const rand = rng(opts.seed);
	const pile = DECK.map((c) => c.id);
	for (let i = pile.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[pile[i], pile[j]] = [pile[j], pile[i]];
	}
	return spread.seats.map((seat, i) => ({
		id: pile[i],
		seat,
		reversed: opts.reversals && rand() < 0.5,
	}));
}

// --------------------------------------------------------------- the guide

/** The pages of "What tarot is", in order: the id, and how many paragraphs it
 *  has in the catalog (narrative.tarot.guide.<id>.p1 …). The count is written
 *  down rather than discovered so a page that loses a paragraph in translation
 *  fails the test instead of quietly going short. */
export const GUIDE_PAGES = [
	{ id: 'what-it-is', paras: 3 },
	{ id: 'anatomy', paras: 3 },
	{ id: 'how-to-read', paras: 4 },
	{ id: 'intention', paras: 3 },
	{ id: 'spreads', paras: 3 },
	{ id: 'reversals', paras: 3 },
	{ id: 'majors', paras: 3 },
	/** Followed by the four suit blocks, off SUITS. */
	{ id: 'suits', paras: 2 },
	/** Followed by the ten numbers, off NUMBERS. */
	{ id: 'numbers', paras: 2 },
	/** Followed by the four court ranks, off COURT. */
	{ id: 'court', paras: 2 },
] as const;
export type GuidePage = (typeof GUIDE_PAGES)[number]['id'];

/** The ten stages a suit climbs, ace to ten — the Minor Arcana's numerology. */
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const guideTitle = (id: GuidePage): string => t(`narrative.tarot.guide.${id}.title`);
export const guideBody = (id: GuidePage, paras: number): string[] =>
	Array.from({ length: paras }, (_, i) => t(`narrative.tarot.guide.${id}.p${i + 1}`));

/**
 * The one-line versions, for the reading pane.
 *
 * A Minor card is a suit and a number, and it means what those two mean
 * together. The pane says so in that order, so the reading teaches the system
 * rather than asking you to take its word: what this suit is about, what this
 * number does in any suit, and only then what the card itself says. The guide's
 * own pages carry the full paragraphs; these are the sentence that fits beside
 * a card on a table.
 */
export const suitGloss = (suit: Suit): string => t(`narrative.tarot.suits.${suit}.gloss`);
export const numberGloss = (n: number): string => t(`narrative.tarot.numbers.n${n}.gloss`);
export const courtGloss = (rank: Rank): string => t(`narrative.tarot.court.${rank}.gloss`);
/** Why a Major landing is a different size of news. Shared by all twenty-two. */
export const majorGloss = (): string => t('narrative.tarot.majorGloss');

export const suitName = (suit: Suit): string => t(`narrative.tarot.suits.${suit}.name`);
export const suitKeywords = (suit: Suit): string => t(`narrative.tarot.suits.${suit}.keywords`);
export const suitText = (suit: Suit): string => t(`narrative.tarot.suits.${suit}.text`);
export const elementName = (element: Element): string => t(`narrative.tarot.elements.${element}`);
export const numberName = (n: number): string => t(`narrative.tarot.numbers.n${n}.name`);
export const numberText = (n: number): string => t(`narrative.tarot.numbers.n${n}.text`);
export const courtName = (rank: Rank): string => t(`narrative.tarot.court.${rank}.name`);
export const courtText = (rank: Rank): string => t(`narrative.tarot.court.${rank}.text`);

// ------------------------------------------------------- keeping a reading

/**
 * The reading you had open, small enough to keep.
 *
 * Only the seed is stored, never the cards: `deal` is deterministic, so five
 * numbers rebuild the exact hand, the exact reversals and exactly how far
 * through it you were. It lives in this browser rather than in the save file,
 * because it is a convenience and not progress. A player who clears their
 * storage loses a spread, which is the right size of loss for a thing you can
 * redeal in one click.
 */
export interface SavedReading {
	spreadId: string;
	reversals: boolean;
	seed: number;
	/** How many cards were face up. */
	turned: number;
	/** Which card the pane was reading, if any. */
	picked: number | null;
}

/** Per save, so two caretakers on one machine do not share a spread. */
const readingKey = (who: string) => `ww:tarot:${who || 'solo'}`;

export function loadReading(who: string): SavedReading | null {
	try {
		const raw = localStorage.getItem(readingKey(who));
		if (!raw) return null;
		// Whatever is in storage is unknown, not a SavedReading: it was written by
		// an older build, or by hand, or by something else entirely. Validated
		// rather than trusted, because a spread that no longer exists or a count
		// from a spread that used to be longer would deal a broken table.
		const r = JSON.parse(raw) as Record<string, unknown>;
		if (!SPREADS.some((s) => s.id === r.spreadId)) return null;
		if (typeof r.seed !== 'number' || !Number.isFinite(r.seed)) return null;
		const turned = Math.max(0, Math.min(SPREAD_SIZE, Math.floor(Number(r.turned)) || 0));
		const picked = typeof r.picked === 'number' && r.picked >= 0 && r.picked < turned ? r.picked : null;
		return { spreadId: r.spreadId as string, reversals: r.reversals === true, seed: r.seed, turned, picked };
	} catch {
		return null; // private browsing, cleared storage, or something else's key
	}
}

export function saveReading(who: string, reading: SavedReading): void {
	try {
		localStorage.setItem(readingKey(who), JSON.stringify(reading));
	} catch {
		/* storage unavailable — the reading just does not outlive the panel */
	}
}

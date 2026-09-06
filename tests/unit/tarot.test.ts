import { describe, it, expect, afterAll } from 'vitest';
import { registerCatalog, setLocale, t } from '../../src/i18n/core';
import enNarrative from '../../src/i18n/en/narrative.json';
import esNarrative from '../../src/i18n/es/narrative.json';
import enPanels from '../../src/i18n/en/panels.json';
import esPanels from '../../src/i18n/es/panels.json';
import enGame from '../../src/i18n/en/game.json';
import esGame from '../../src/i18n/es/game.json';
import habitatObjects from '../../data/habitat-objects.json';
import recipes from '../../data/recipes.json';
import animals1 from '../../data/animals-1.json';
import animals2 from '../../data/animals-2.json';
import resources from '../../data/resources.json';
import {
	COURT,
	DECK,
	GUIDE_PAGES,
	MAJORS,
	MINORS,
	NUMBERS,
	RANKS,
	SPREADS,
	SPREAD_SIZE,
	SUITS,
	cardText,
	courtGloss,
	courtName,
	courtText,
	deal,
	elementName,
	gist,
	guideBody,
	guideTitle,
	majorGloss,
	numberGloss,
	numberName,
	numberText,
	seatBlurb,
	seatName,
	seatReading,
	spreadBlurb,
	spreadDef,
	spreadName,
	suitGloss,
	suitKeywords,
	suitName,
	suitText,
} from '../../src/ui/arcana';
import { SCENES, roman } from '../../src/ui/arcanaArt';

// The tarot deck: seventy-eight cards listed in src/ui/arcana.ts, worded in the
// catalog (narrative.tarot.*), drawn in src/ui/arcanaArt.tsx, and dealt into the
// spreads the panel offers.
//
// Nothing at runtime complains when those drift apart, and all of it lives
// behind a piece of furniture most players will meet once. A card with no
// catalog entry shows its raw key on the table; a card with no picture is a
// blank parchment rectangle; a seat with no name is a spread position nobody
// can read. So it is checked here instead.
//
// The catalog checks run in BOTH languages on purpose. A deck is only half a
// deck if half of it is untranslated, and the es suite's key-for-key mirror
// would happily pass on a Spanish "reversed" that is an empty string.

registerCatalog('en', { narrative: enNarrative, panels: enPanels, game: enGame });
registerCatalog('es', { narrative: esNarrative, panels: esPanels, game: esGame });
setLocale('en');
afterAll(() => setLocale('en'));

const LOCALES = ['en', 'es'];
/** An unresolved key comes back as the key itself — the one failure mode that
 *  looks like content until you read it. */
const unresolved = (s: string) => /^(narrative|panels|game)\./.test(s);

describe('the deck', () => {
	it('is a whole deck: twenty-two majors and fifty-six minors, each id once', () => {
		expect(MAJORS).toHaveLength(22);
		expect(MINORS).toHaveLength(56);
		expect(DECK).toHaveLength(78);
		const ids = DECK.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('deals the minors into four suits of fourteen', () => {
		expect(SUITS).toHaveLength(4);
		expect(RANKS).toHaveLength(14);
		for (const { id, element } of SUITS) {
			const suit = MINORS.filter((c) => c.suit === id);
			expect(suit, id).toHaveLength(14);
			expect(suit.map((c) => c.rank)).toEqual([...RANKS]);
			expect(new Set(suit.map((c) => c.element))).toEqual(new Set([element]));
			// Ace is one and the King is fourteen, which is how a tarot card has
			// always numbered itself and what the corner mark prints.
			expect(suit.map((c) => c.number)).toEqual(RANKS.map((_, i) => i + 1));
		}
		expect(new Set(SUITS.map((s) => s.element)).size).toBe(4);
	});

	it('runs the majors from zero to twenty-one in journey order', () => {
		expect(MAJORS.map((c) => c.number)).toEqual(MAJORS.map((_, i) => i));
		expect(MAJORS[0].id).toBe('fool');
		expect(MAJORS[21].id).toBe('world');
		// American English, everywhere: Judgment, not Judgement.
		expect(MAJORS.map((c) => c.id)).toContain('judgment');
	});

	it('gives every card a picture of its own', () => {
		expect(Object.keys(SCENES).sort()).toEqual(DECK.map((c) => c.id).sort());
	});

	it('numbers the corners the way a tarot card does', () => {
		expect(roman(0)).toBe('0');
		expect(roman(1)).toBe('I');
		expect(roman(4)).toBe('IV');
		expect(roman(9)).toBe('IX');
		expect(roman(13)).toBe('XIII');
		expect(roman(21)).toBe('XXI');
	});

	it('says everything about every card, in both languages', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const c of DECK) {
				const text = cardText(c.id);
				for (const [field, value] of Object.entries(text)) {
					expect(value, `${locale} ${c.id}.${field}`).toBeTruthy();
					expect(unresolved(value), `${locale} ${c.id}.${field} is an unresolved key`).toBe(false);
				}
				// Both readings, and both of them written rather than stubbed. The
				// reversed reading is the one most likely to be left as a placeholder,
				// so it carries a length floor of its own.
				// Floors, not targets: they catch a stub, not a short sentence. The copy
				// is deliberately plain, so a complete reading can be seventy-odd
				// characters and still be a whole thought.
				expect(text.upright.length, `${locale} ${c.id} upright`).toBeGreaterThan(70);
				expect(text.reversed.length, `${locale} ${c.id} reversed`).toBeGreaterThan(40);
				expect(text.name.length, `${locale} ${c.id} name`).toBeGreaterThan(2);
			}
		}
		setLocale('en');
	});

	it('has a one-line gist of both faces for the hover tip', () => {
		// The tip shows the light and the shadow side by side; the pane below shows
		// the whole of whichever one it landed on. If the gist ever returned the
		// entire reading the tip would just be the pane again, on top of the pane.
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const c of DECK) {
				const text = cardText(c.id);
				for (const face of [text.upright, text.reversed]) {
					const short = gist(face);
					expect(face.startsWith(short), `${locale} ${c.id}`).toBe(true);
					expect(short.length, `${locale} ${c.id} gist is too short to read`).toBeGreaterThan(20);
					// A one-sentence reading is its own gist, which is fine; what must never
					// happen is a gist that runs on past the first sentence.
					expect(short.length, `${locale} ${c.id} gist overruns`).toBeLessThanOrEqual(face.length);
					expect(short.length, `${locale} ${c.id} gist is too long for a tip`).toBeLessThan(200);
				}
			}
		}
		setLocale('en');
	});

	it('gives every card a different name and a different byline', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const field of ['name', 'byline'] as const) {
				const seen = DECK.map((c) => cardText(c.id)[field]);
				const dupes = seen.filter((v, i) => seen.indexOf(v) !== i);
				expect(dupes, `${locale}: duplicate ${field}s`).toEqual([]);
			}
		}
		setLocale('en');
	});
});

describe('the spreads', () => {
	it('offers three, and every one of them is three cards in a row', () => {
		expect(SPREADS).toHaveLength(3);
		for (const spread of SPREADS) {
			expect(spread.seats, spread.id).toHaveLength(SPREAD_SIZE);
			// No two seats in one spread ask the same question.
			expect(new Set(spread.seats).size, `${spread.id} repeats a position`).toBe(SPREAD_SIZE);
		}
		expect(spreadDef('not-a-spread').id).toBe(SPREADS[0].id); // unknown falls back
	});

	it('asks three different kinds of question rather than three sizes of grid', () => {
		// The whole reason to offer more than one three-card spread. If two of them
		// shared a seat set they would be the same reading with a different name.
		const sets = SPREADS.map((s) => [...s.seats].sort().join(','));
		expect(new Set(sets).size).toBe(SPREADS.length);
		// …and between them they use every seat the catalog defines, with none left
		// orphaned behind a spread that was removed.
		const used = new Set(SPREADS.flatMap((s) => s.seats));
		for (const locale of LOCALES) {
			const seats = Object.keys(((locale === 'en' ? enNarrative : esNarrative) as any).tarot.seats);
			expect(seats.sort(), `${locale} has seats no spread uses`).toEqual([...used].sort());
		}
	});

	it('names every spread and every position it uses, in both languages', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const s of SPREADS) {
				for (const value of [spreadName(s.id), spreadBlurb(s.id)]) {
					expect(value, `${locale} spread ${s.id}`).toBeTruthy();
					expect(unresolved(value), `${locale} spread ${s.id} is an unresolved key`).toBe(false);
				}
				for (const seat of s.seats) {
					for (const value of [seatName(seat), seatBlurb(seat)]) {
						expect(value, `${locale} seat ${seat}`).toBeTruthy();
						expect(unresolved(value), `${locale} seat ${seat} is an unresolved key`).toBe(false);
					}
				}
			}
		}
		setLocale('en');
	});
});

describe('dealing', () => {
	const spread = spreadDef('past-present-future');

	it('gives the same hand for the same shuffle', () => {
		const a = deal(spread, { seed: 12345, reversals: true });
		const b = deal(spread, { seed: 12345, reversals: true });
		expect(a).toEqual(b);
		expect(deal(spread, { seed: 999, reversals: true })).not.toEqual(a);
	});

	it('never deals the same card twice in one reading', () => {
		for (let seed = 0; seed < 200; seed++) {
			const hand = deal(spread, { seed, reversals: true });
			expect(hand, `seed ${seed}`).toHaveLength(SPREAD_SIZE);
			expect(new Set(hand.map((d) => d.id)).size, `seed ${seed}`).toBe(SPREAD_SIZE);
			expect(hand.map((d) => d.seat)).toEqual([...spread.seats]);
			for (const d of hand) expect(DECK.some((c) => c.id === d.id)).toBe(true);
		}
	});

	it('turns nothing upside-down while reversals are off', () => {
		for (let seed = 0; seed < 200; seed++) {
			expect(
				deal(spread, { seed, reversals: false }).every((d) => !d.reversed),
				`seed ${seed}`,
			).toBe(true);
		}
	});

	it('turns roughly half of them over when reversals are on', () => {
		let rev = 0;
		let total = 0;
		for (let seed = 0; seed < 400; seed++) {
			for (const d of deal(spread, { seed, reversals: true })) {
				total++;
				if (d.reversed) rev++;
			}
		}
		expect(rev / total).toBeGreaterThan(0.35);
		expect(rev / total).toBeLessThan(0.65);
	});

	it('reaches the whole deck rather than favoring the front of it', () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < 2000; seed++) for (const d of deal(spread, { seed, reversals: false })) seen.add(d.id);
		expect(seen.size).toBe(DECK.length);
	});
});

describe('the guide', () => {
	it('has every page, every paragraph, in both languages', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const page of GUIDE_PAGES) {
				const title = guideTitle(page.id);
				expect(title, `${locale} ${page.id}`).toBeTruthy();
				expect(unresolved(title), `${locale} ${page.id}.title is an unresolved key`).toBe(false);
				const body = guideBody(page.id, page.paras);
				expect(body, `${locale} ${page.id}`).toHaveLength(page.paras);
				for (const [i, para] of body.entries()) {
					expect(unresolved(para), `${locale} ${page.id}.p${i + 1} is an unresolved key`).toBe(false);
					expect(para.length, `${locale} ${page.id}.p${i + 1}`).toBeGreaterThan(120);
				}
			}
		}
		setLocale('en');
	});

	it('explains all four suits, all ten numbers and all four court ranks', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const { id, element } of SUITS)
				for (const value of [suitName(id), suitKeywords(id), suitText(id), elementName(element)]) {
					expect(value, `${locale} suit ${id}`).toBeTruthy();
					expect(unresolved(value), `${locale} suit ${id} is an unresolved key`).toBe(false);
				}
			expect(NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			for (const n of NUMBERS)
				for (const value of [numberName(n), numberText(n)]) {
					expect(unresolved(value), `${locale} number ${n} is an unresolved key`).toBe(false);
					expect(value.length, `${locale} number ${n}`).toBeGreaterThan(2);
				}
			expect(COURT).toEqual(['page', 'knight', 'queen', 'king']);
			for (const rank of COURT)
				for (const value of [courtName(rank), courtText(rank)]) {
					expect(unresolved(value), `${locale} court ${rank} is an unresolved key`).toBe(false);
					expect(value.length, `${locale} court ${rank}`).toBeGreaterThan(2);
				}
		}
		setLocale('en');
	});

	it('is written the way the rest of the deck is: no em dashes, nothing shouted', () => {
		// House style for this panel, pinned because prose drifts. An em dash is a
		// punctuation mark the game does not use in player-facing copy, and a word
		// in capitals reads as shouting in a card meaning. Both are easy to
		// reintroduce one card at a time and impossible to notice card by card.
		const offenders: string[] = [];
		const check = (label: string, node: unknown, path = '') => {
			if (typeof node === 'string') {
				if (node.includes('\u2014')) offenders.push(`${label}${path}: em dash`);
				// Roman numerals are drawn, not written, so any run of capitals here is
				// emphasis rather than a numeral.
				if (/\b[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1]{2,}\b/.test(node))
					offenders.push(`${label}${path}: shouted word`);
			} else if (node && typeof node === 'object') {
				for (const [k, v] of Object.entries(node)) if (k !== '_readme') check(label, v, `${path}.${k}`);
			}
		};
		check('en narrative.tarot', (enNarrative as any).tarot);
		check('es narrative.tarot', (esNarrative as any).tarot);
		check('en panels.tarot', (enPanels as any).tarot);
		check('es panels.tarot', (esPanels as any).tarot);
		expect(offenders).toEqual([]);
	});

	it('names a spread for what it does rather than for how many cards it deals', () => {
		// "Five card - 5 cards" in the picker was the bug this pins: the count is
		// shown beside the spread already, so the name has to carry meaning.
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const s of SPREADS) {
				const name = spreadName(s.id);
				expect(/\d/.test(name), `${locale} ${s.id} has a digit in its name`).toBe(false);
				expect(name.toLowerCase(), `${locale} ${s.id} counts its own cards`).not.toContain('card');
			}
		}
		setLocale('en');
	});

	it('can explain how any card is put together, in both languages', () => {
		// The reading pane shows a Minor as its suit and then its number before it
		// shows what the card says, and a Major as the one thing a Major is. Every
		// piece of that has to resolve, or the pane teaches half a system.
		for (const locale of LOCALES) {
			setLocale(locale);
			const lines = [majorGloss(), ...SUITS.map(({ id }) => suitGloss(id))];
			for (const n of NUMBERS) lines.push(numberGloss(n));
			for (const rank of COURT) lines.push(courtGloss(rank));
			for (const line of lines) {
				expect(unresolved(line), `${locale}: unresolved gloss`).toBe(false);
				// One sentence or two, not a paragraph: these sit beside a card.
				expect(line.length, `${locale}: gloss too short`).toBeGreaterThan(40);
			}
			for (const line of lines.slice(1)) {
				expect(line.length, `${locale}: gloss too long for the pane`).toBeLessThan(180);
			}
		}
		setLocale('en');
	});

	it('has a suit and a rank for every minor, and neither for any major', () => {
		// What the pane branches on. A minor with no suit would render an empty row.
		for (const c of MINORS) {
			expect(c.suit, c.id).toBeTruthy();
			expect(c.rank, c.id).toBeTruthy();
			expect(SUITS.some((s) => s.id === c.suit)).toBe(true);
		}
		for (const c of MAJORS) {
			expect(c.suit, c.id).toBeUndefined();
			expect(c.rank, c.id).toBeUndefined();
		}
	});

	it('makes a different sentence for every card in every seat', () => {
		// The whole point of the seat line. If a frame lost its slot, or a card lost
		// a phrase, this collapses into the same sentence everywhere and nobody
		// notices until they have read three spreads.
		for (const locale of LOCALES) {
			setLocale(locale);
			const seats = [...new Set(SPREADS.flatMap((s) => s.seats))];
			const seen = new Set<string>();
			for (const seat of seats) {
				for (const card of DECK) {
					for (const reversed of [false, true]) {
						const line = seatReading(seat, card.id, reversed);
						expect(unresolved(line), `${locale} ${seat} ${card.id}`).toBe(false);
						// The frame has to have actually taken the card, not printed the slot.
						expect(line, `${locale} ${seat} ${card.id} kept its placeholder`).not.toContain('{card}');
						expect(line.length, `${locale} ${seat} ${card.id} too short`).toBeGreaterThan(24);
						seen.add(line);
					}
				}
			}
			expect(seen.size, `${locale}: seat lines repeat`).toBe(seats.length * DECK.length * 2);
		}
		setLocale('en');
	});

	it('gives every card a phrase for each face, short enough to sit in a frame', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			for (const c of DECK) {
				const text = cardText(c.id);
				for (const [face, phrase] of [
					['upright', text.phraseUpright],
					['reversed', text.phraseReversed],
				] as const) {
					expect(unresolved(phrase), `${locale} ${c.id} ${face}`).toBe(false);
					expect(phrase.length, `${locale} ${c.id} ${face} phrase too short`).toBeGreaterThan(14);
					expect(phrase.length, `${locale} ${c.id} ${face} phrase too long to frame`).toBeLessThan(80);
					// A phrase, not a sentence: it gets slotted in after a colon.
					expect(phrase.endsWith('.'), `${locale} ${c.id} ${face} phrase is a sentence`).toBe(false);
					expect(phrase[0], `${locale} ${c.id} ${face} phrase is capitalized`).toBe(phrase[0].toLowerCase());
				}
			}
		}
		setLocale('en');
	});

	it('says out loud that the cards do not know anything', () => {
		// The panel's one non-negotiable line. A deck presented as a predictor is a
		// different and worse thing than a deck presented as a prompt, and this is
		// where that promise is kept.
		for (const locale of LOCALES) {
			setLocale(locale);
			const line = t('panels.tarot.disclaimer');
			expect(line, locale).toBeTruthy();
			expect(unresolved(line), locale).toBe(false);
		}
		setLocale('en');
	});
});

describe('the deck you place', () => {
	const objects = (habitatObjects as any).records as any[];
	const recipeList = (recipes as any).records as any[];
	const deckObject = objects.find((o) => o.id === 'home-tarotdeck');
	const deckRecipe = recipeList.find((r) => r.id === 'home-tarotdeck');
	const meadowAnimals = [...(animals1 as any).records, ...(animals2 as any).records].filter(
		(a: any) => a.biome === 'meadow',
	);

	it('exists as something you can craft and set down', () => {
		expect(deckObject, 'no home-tarotdeck in data/habitat-objects.json').toBeTruthy();
		expect(deckRecipe, 'no home-tarotdeck in data/recipes.json').toBeTruthy();
		expect(deckRecipe.output).toEqual({ itemId: 'home-tarotdeck', qty: 1 });
		expect(SCENES[deckObject.shape]).toBeUndefined(); // the world sprite is not a card face
		// Small, so it can stand on a table rather than needing a tile of its own —
		// which is the whole picture of a deck of cards.
		expect(deckObject.small).toBe(true);
	});

	it('is made of things the meadow actually yields', () => {
		const known = new Set(((resources as any).records as any[]).map((r) => r.id));
		for (const id of Object.keys(deckRecipe.materials)) expect(known.has(id), `unknown material ${id}`).toBe(true);
	});

	it('unlocks when the eighth animal comes back to the meadow', () => {
		expect(deckRecipe.unlockBiome).toBe('meadow');
		expect(deckRecipe.unlock.animalsReturned).toBe(8);
		// The health floor is only there to keep this gate distinct from the hiking
		// boots', which hold the bare eight-animal one. It must stay under what the
		// eighth meadow animal needs by itself, or it would quietly become the real
		// gate and the label — which says only "welcome 8 animals back" — would be
		// a lie.
		const eighth = meadowAnimals
			.map((a: any) => a.requirements?.minHealth || 0)
			.sort((a: number, b: number) => a - b)[7];
		expect(deckRecipe.unlock.minHealth).toBeLessThanOrEqual(eighth);
		expect(deckRecipe.unlock.label).toContain('8');
	});

	it('has a label on it in the world, in both languages', () => {
		for (const locale of LOCALES) {
			setLocale(locale);
			const label = t('game.label.readTarot');
			expect(label, locale).toBeTruthy();
			expect(unresolved(label), locale).toBe(false);
		}
		setLocale('en');
	});
});

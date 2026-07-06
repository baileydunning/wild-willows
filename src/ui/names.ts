// A pool of cozy, nature-leaning caretaker names for the "surprise me" dice in
// the New Game creator. Looks were already randomizable; names weren't — this
// closes that gap (player feedback: "if we randomise looks, why not names too?").
//
// These are proper nouns (plant/creature/landscape words that read as names), so
// they're intentionally NOT run through i18n — a name like "Willow" stays
// "Willow" in every locale, the same way a person's name would.

export const CARETAKER_NAMES: readonly string[] = [
	'Willow', 'Fern', 'Hazel', 'Wren', 'Clover', 'Juniper', 'Aspen', 'Linden',
	'Sorrel', 'Bracken', 'Robin', 'Reed', 'Ivy', 'Sage', 'Poppy', 'Briar',
	'Rowan', 'Heath', 'Fenn', 'Marlow', 'Dell', 'Cricket', 'Pippin', 'Cedar',
	'Birch', 'Alder', 'Elm', 'Maple', 'Bay', 'Wisp', 'Meadow', 'Thistle',
	'Basil', 'Dahlia', 'Fable', 'Hollis', 'Moss', 'Laurel', 'Sparrow', 'Finch',
	'Lark', 'Bramble', 'Yarrow', 'Tansy', 'Bluebell', 'Fox', 'Vale', 'Brook',
	'Sable', 'Pip', 'Sedge',

	'Ash', 'Aster', 'Autumn', 'Blossom', 'Bram', 'Bryony', 'Calla', 'Cassia',
	'Daisy', 'Dawn', 'Dove', 'Eden', 'Ember', 'Fawn', 'Flint', 'Flora',
	'Forest', 'Gale', 'Glen', 'Honey', 'Iris', 'Jasper', 'Kestrel', 'Lilac',
	'Luna', 'Magnolia', 'Mica', 'Mira', 'Myrtle', 'Olive', 'Petal', 'Rain',
	'River', 'Rue', 'Skye', 'Sol', 'Sprig', 'Starling', 'Sylvan', 'Violet',
	'Winter', 'Zephyr',
];

/**
 * A random caretaker name. Pass the current name to avoid rolling the same one
 * twice in a row (so mashing the dice always visibly changes something).
 */
export function randomName(exclude?: string): string {
	const pool = exclude
		? CARETAKER_NAMES.filter((n) => n.toLowerCase() !== exclude.trim().toLowerCase())
		: CARETAKER_NAMES;
	const list = pool.length ? pool : CARETAKER_NAMES;
	return list[Math.floor(Math.random() * list.length)];
}

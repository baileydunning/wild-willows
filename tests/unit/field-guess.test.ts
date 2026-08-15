import { describe, it, expect, beforeEach } from 'vitest';
import { guessFor, guessOptions, guessTally, recordGuess, reloadGuesses, signatureObject } from '../../src/fieldGuess';

// The expanded field guide used to print an animal's habitat checklist the
// instant you opened its entry. It now asks for one prediction first. These
// tests pin the two properties that make the prompt worth answering: the
// question is the same every time you open the card (so it can't be rerolled
// into an easier one), and a wrong option is always something that genuinely
// belongs in the biome rather than something obviously unbuildable.

beforeEach(() => {
	localStorage.clear();
	reloadGuesses();
});

describe('picking the object to ask about', () => {
	it('asks about the signature requirement when the data names one', () => {
		expect(signatureObject({ objects: { 'fern-spring': 1, 'mushroom-ring': 1 }, signature: 'mushroom-ring' })).toBe(
			'mushroom-ring',
		);
	});

	it('falls back to the object needed most, tie-broken by id so it is stable', () => {
		expect(signatureObject({ objects: { 'brush-pile': 1, 'oak-tree': 3 } })).toBe('oak-tree');
		expect(signatureObject({ objects: { 'brush-pile': 2, 'oak-tree': 2 } })).toBe('brush-pile');
	});

	it('ignores a signature that is not actually required', () => {
		expect(signatureObject({ objects: { 'oak-tree': 1 }, signature: 'tide-pool' })).toBe('oak-tree');
	});

	it('has nothing to ask about when an animal needs no objects', () => {
		expect(signatureObject({ objects: {} })).toBeNull();
	});
});

describe('the three options', () => {
	const pool = ['brush-pile', 'fern-grove', 'leaf-drey', 'nesting-tree', 'oak-tree', 'truffle-patch'];

	it('offers the answer plus two others', () => {
		const opts = guessOptions('wood-frog', 'oak-tree', { 'oak-tree': 1 }, pool);
		expect(opts).toHaveLength(3);
		expect(opts).toContain('oak-tree');
		expect(new Set(opts).size).toBe(3);
	});

	it('never offers something the animal actually needs as a wrong answer', () => {
		const own = { 'oak-tree': 1, 'brush-pile': 2, 'leaf-drey': 1 };
		const opts = guessOptions('gray-squirrel', 'oak-tree', own, pool);
		expect(opts.filter((o) => o !== 'oak-tree')).not.toContain('brush-pile');
		expect(opts.filter((o) => o !== 'oak-tree')).not.toContain('leaf-drey');
	});

	it('asks the same question every time the card is opened', () => {
		const a = guessOptions('wood-frog', 'oak-tree', { 'oak-tree': 1 }, pool);
		const b = guessOptions('wood-frog', 'oak-tree', { 'oak-tree': 1 }, [...pool].reverse());
		expect(b).toEqual(a);
	});

	it('does not always put the answer in the same slot', () => {
		const ids = ['wood-frog', 'red-fox', 'barred-owl', 'chipmunk', 'banana-slug', 'bobcat'];
		const slots = new Set(ids.map((id) => guessOptions(id, 'oak-tree', { 'oak-tree': 1 }, pool).indexOf('oak-tree')));
		expect(slots.size).toBeGreaterThan(1);
	});

	it('returns just the answer when the biome has nothing else to offer', () => {
		expect(guessOptions('wood-frog', 'oak-tree', { 'oak-tree': 1 }, ['oak-tree'])).toEqual(['oak-tree']);
	});
});

describe('recording a guess', () => {
	it('remembers the outcome', () => {
		recordGuess('wood-frog', 'correct');
		expect(guessFor('wood-frog')).toBe('correct');
	});

	it('keeps the first answer, so reopening a card cannot farm the tally', () => {
		recordGuess('red-fox', 'wrong');
		recordGuess('red-fox', 'correct');
		expect(guessFor('red-fox')).toBe('wrong');
	});

	it('counts accuracy over attempts, and skipping is not a wrong answer', () => {
		recordGuess('a', 'correct');
		recordGuess('b', 'wrong');
		recordGuess('c', 'skipped');
		const { correct, attempted } = guessTally();
		expect({ correct, attempted }).toEqual({ correct: 1, attempted: 2 });
	});
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerCatalog, setLocale, t } from '../../src/i18n/core';
import enPanels from '../../src/i18n/en/panels.json';
import esPanels from '../../src/i18n/es/panels.json';

// "Settled in after the Tree Squirrel were already here."
//
// The journal's neighbour note hard-coded the plural verb, so a single
// neighbour — much the commonest case — read as a typo. The catalogue entry is
// now a one/other pair that `count` selects, the same mechanism the observed
// counter already used.

beforeAll(() => {
	registerCatalog('en', { panels: enPanels });
	registerCatalog('es', { panels: esPanels });
	setLocale('en');
});

afterAll(() => setLocale('en'));

describe('the neighbour note agrees in number (English)', () => {
	it('says "was" for a single neighbour', () => {
		expect(t('panels.journal.neighborsAfter', { list: 'Tree Squirrel', count: 1 })).toBe(
			'Settled in after the Tree Squirrel was already here.',
		);
	});

	it('says "were" for several', () => {
		expect(t('panels.journal.neighborsAfter', { list: 'Tree Squirrel and Woodpecker', count: 2 })).toBe(
			'Settled in after the Tree Squirrel and Woodpecker were already here.',
		);
	});

	it('never pairs one neighbour with "were" — the reported typo', () => {
		expect(t('panels.journal.neighborsAfter', { list: 'Tree Squirrel', count: 1 })).not.toContain('were');
	});

	it('reads correctly either way on the followed line ("followed" is invariant)', () => {
		for (const count of [1, 3]) {
			expect(t('panels.journal.neighborsFollowed', { list: 'Fox', count })).toBe(
				'The Fox followed once this one was back.',
			);
		}
	});
});

describe('Spanish conjugates BOTH lines, where English only needed the first', () => {
	beforeAll(() => setLocale('es'));
	afterAll(() => setLocale('en'));

	it('estaba for one, estaban for several', () => {
		expect(t('panels.journal.neighborsAfter', { list: 'la ardilla', count: 1 })).toContain('ya estaba aquí');
		expect(t('panels.journal.neighborsAfter', { list: 'las ardillas', count: 2 })).toContain('ya estaban aquí');
	});

	it('siguió for one, siguieron for several', () => {
		expect(t('panels.journal.neighborsFollowed', { list: 'la ardilla', count: 1 })).toContain('le siguió');
		expect(t('panels.journal.neighborsFollowed', { list: 'las ardillas', count: 2 })).toContain('le siguieron');
	});
});

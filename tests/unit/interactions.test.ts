import { describe, it, expect } from 'vitest';
import { canPaintClick } from '../../src/game/interactions';

describe('canPaintClick', () => {
	it('paints when the paint tool is selected indoors and nothing is being placed/moved', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: false, moving: false })).toBe(true);
	});

	it('does NOT paint while placing an object (a click should drop it instead)', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: true, moving: false })).toBe(false);
	});

	it('does NOT paint while moving an existing placement', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: false, moving: true })).toBe(false);
	});

	it('only paints indoors', () => {
		expect(canPaintClick({ tool: 'paint', isHome: false, placing: false, moving: false })).toBe(false);
	});

	it('only paints with the paint tool selected', () => {
		expect(canPaintClick({ tool: 'basket', isHome: true, placing: false, moving: false })).toBe(false);
		expect(canPaintClick({ tool: null, isHome: true, placing: false, moving: false })).toBe(false);
	});
});

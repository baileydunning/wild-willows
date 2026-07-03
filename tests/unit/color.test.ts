import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, shade, hatPalette, flowerPalette } from '../../src/color';

describe('hex ↔ hsl', () => {
	it('round-trips colors', () => {
		for (const hex of ['#e87a9e', '#4a7c59', '#c9a35c', '#123456']) {
			const { h, s, l } = hexToHsl(hex);
			expect(hslToHex(h, s, l)).toBe(hex);
		}
	});

	it('expands 3-digit hex', () => {
		expect(hexToHsl('#fff').l).toBe(100);
		expect(hexToHsl('#000').l).toBe(0);
	});

	it('shade lightens and darkens', () => {
		expect(hexToHsl(shade('#4a7c59', 10)).l).toBeGreaterThan(hexToHsl('#4a7c59').l);
		expect(hexToHsl(shade('#4a7c59', -10)).l).toBeLessThan(hexToHsl('#4a7c59').l);
	});
});

describe('hatPalette', () => {
	it('returns each hat\'s classic tones when no custom color is set', () => {
		expect(hatPalette('straw').a).toBe('#c9a35c');
		expect(hatPalette('straw').b).toBe('#d8b56e');
		expect(hatPalette('wizard', null).a).toBe('#7d6b9e');
	});

	it('derives all three tones from a custom color', () => {
		const p = hatPalette('cap', '#aa3355');
		expect(p.a).toBe('#aa3355');
		expect(hexToHsl(p.b).l).toBeGreaterThan(hexToHsl(p.a).l);
		expect(hexToHsl(p.line).l).toBeLessThan(hexToHsl(p.a).l);
	});
});

describe('flowerPalette', () => {
	it('keeps the classic bouquet with no custom color', () => {
		expect(flowerPalette(null)).toEqual(['#e87a9e', '#f4c95f', '#c45ad0', '#e8954f']);
	});

	it('rotates every bloom by the same hue offset (not one flat color)', () => {
		const base = flowerPalette(null);
		const custom = '#5f86b0'; // a blue pick
		const rotated = flowerPalette(custom);
		expect(rotated).toHaveLength(4);
		// first bloom takes on the pick's hue…
		expect(Math.round(hexToHsl(rotated[0]).h)).toBe(Math.round(hexToHsl(custom).h));
		// …and the whole set keeps the same hue spacing as the classic bouquet
		const dh = (a: string, b: string) => (hexToHsl(b).h - hexToHsl(a).h + 360) % 360;
		for (let i = 1; i < 4; i++) {
			expect(dh(rotated[0], rotated[i])).toBeCloseTo(dh(base[0], base[i]), 0);
		}
		// distinct colors, not one flat tint
		expect(new Set(rotated).size).toBe(4);
	});
});

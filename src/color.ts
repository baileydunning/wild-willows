// Tiny color helpers shared by the SVG character preview (src/ui/icons.tsx)
// and the Phaser player sprite (src/game/textures.ts), so a custom hat color
// produces the identical palette in both renderers.

export interface Hsl {
	h: number; // 0–360
	s: number; // 0–100
	l: number; // 0–100
}

export function hexToHsl(hex: string): Hsl {
	let c = hex.replace('#', '');
	if (c.length === 3)
		c = c
			.split('')
			.map((ch) => ch + ch)
			.join('');
	const r = parseInt(c.slice(0, 2), 16) / 255;
	const g = parseInt(c.slice(2, 4), 16) / 255;
	const b = parseInt(c.slice(4, 6), 16) / 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: l * 100 };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360;
	s = Math.max(0, Math.min(100, s)) / 100;
	l = Math.max(0, Math.min(100, l)) / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const to = (v: number) =>
		Math.round(v * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Lighten (positive) or darken (negative) a hex color by a lightness delta. */
export function shade(hex: string, dl: number): string {
	const { h, s, l } = hexToHsl(hex);
	return hslToHex(h, s, l + dl);
}

// ------------------------------------------------------------- hat palettes
// Every hat is drawn from three tones: `a` (main), `b` (secondary — crown
// top, inner stripe, second tail…) and `line` (band/stitch/underside). Each
// hat has classic defaults; a custom hatColor swaps `a` for the pick and
// derives the other two, so any hat recolors cleanly from one swatch.

const HAT_BASE: Record<string, { a: string; b?: string; line?: string }> = {
	straw: { a: '#c9a35c', b: '#d8b56e', line: '#a3814f' },
	leaf: { a: '#5d8a4a', line: '#436b35' },
	beanie: { a: '#b5707a', b: '#9e5f69' },
	cap: { a: '#5f86b0', b: '#4f739a', line: '#3f5f80' },
	bucket: { a: '#9aa86a', b: '#86945a' },
	party: { a: '#d77bb1', b: '#e89ac0', line: '#b45f95' },
	flower: { a: '#e87a9e' },
	wizard: { a: '#7d6b9e', b: '#8f7bb5', line: '#645380' },
	crown: { a: '#e0b23e', b: '#f0c95e', line: '#b8902e' },
	mushroom: { a: '#c9584c', b: '#d4685c', line: '#a84237' },
	ranger: { a: '#8a734f', b: '#9c845c', line: '#5d4a36' },
	bandana: { a: '#b05555', b: '#c96a5f', line: '#8d3f3f' },
};

export function hatPalette(hat: string, custom?: string | null): { a: string; b: string; line: string } {
	const base = HAT_BASE[hat] || HAT_BASE.straw;
	if (!custom) return { a: base.a, b: base.b ?? shade(base.a, 8), line: base.line ?? shade(base.a, -14) };
	return { a: custom, b: shade(custom, 8), line: shade(custom, -14) };
}

/**
 * The flower crown's blooms. A custom color doesn't flatten them to one tone:
 * the FIRST bloom becomes exactly the picked color, and the other three keep
 * their hue/saturation/lightness offsets relative to it — so every movement in
 * the picker (hue, shade, brightness) visibly re-tints the whole bouquet while
 * the four flowers stay distinct and harmonious.
 */
export function flowerPalette(custom?: string | null): string[] {
	const base = ['#e87a9e', '#f4c95f', '#c45ad0', '#e8954f'];
	if (!custom) return base;
	const c = hexToHsl(custom);
	const b0 = hexToHsl(base[0]);
	return base.map((hex) => {
		const b = hexToHsl(hex);
		return hslToHex(c.h + (b.h - b0.h), c.s + (b.s - b0.s), c.l + (b.l - b0.l));
	});
}

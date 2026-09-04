import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// A PATH IS FOR THE CARETAKER, NOT FOR THE LAND.
//
// Restoration points are meant to be a measure of habitat: something an animal
// can live in, eat from, drink at or shelter under. Paths and bridges are none
// of those. They are what you lay down so your boots stay OFF the new growth —
// the same category as a bench, a lantern or a signpost, all of which have
// always been worth zero.
//
// Left at 1 each they were also the cheapest points in the game (a stepping-stone
// path is two stones, and nothing stops you paving a meadow with them), so the
// fastest way to a healthy biome was to cover it in trail. That reads as a bug in
// the theme, not a strategy: a meadow does not recover because someone walked
// across it tidily.
//
// The wetland boardwalks are the deliberate exception and keep their points. A
// boardwalk over a marsh is doing something for the marsh — holding feet out of
// water that would otherwise be trampled — which is habitat protection rather
// than decoration.
//
// This is pinned as a data rule rather than a list of ids so that a path added
// later has to make the same argument. Anything that presents itself as a path
// or a bridge comes in at zero.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OBJECTS: any[] = JSON.parse(readFileSync(join(root, 'data/habitat-objects.json'), 'utf8')).records;

const byId = (id: string) => OBJECTS.find((o) => o.id === id);
const looksLikeTrail = (o: any) => /-path$|-bridge$/.test(o.id) || /\b(Path|Bridge)\b/.test(o.name || '');

describe('what the land gets credit for', () => {
	it('gives no restoration points to anything you walk on', () => {
		const paying = OBJECTS.filter(looksLikeTrail).filter((o) => (o.healthValue || 0) > 0);
		expect(
			paying.map((o) => `${o.id} (healthValue ${o.healthValue})`),
			'paths and bridges are caretaker comfort, not habitat — they restore nothing',
		).toEqual([]);
	});

	it('still counts the boardwalks that hold feet out of the marsh', () => {
		expect(byId('boardwalk').healthValue).toBeGreaterThan(0);
		expect(byId('rushwater-boardwalk-rail').healthValue).toBeGreaterThan(0);
	});

	it('leaves the paths themselves buildable and placeable', () => {
		// Worth nothing to the biome is not the same as taken out of the game: a
		// preserve you can lay trail through is the point of laying trail.
		for (const id of [
			'simple-path',
			'gravel-path',
			'plank-path',
			'flagstone-path',
			'mossy-path',
			'sea-glass-path',
			'wooden-bridge',
		]) {
			const o = byId(id);
			expect(o, `${id} should still exist`).toBeDefined();
			expect(o.healthValue).toBe(0);
			expect(o.placement).toBe('outdoor');
			expect((o.biomes || []).length).toBeGreaterThan(0);
		}
	});
});

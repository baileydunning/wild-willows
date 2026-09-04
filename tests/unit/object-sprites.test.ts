import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Two things about placeable objects that only show up by looking at them.
//
// A shape with no sprite doesn't crash: buildPlacement falls back to the generic
// kit box, so the object is placeable, sellable, and wrong-looking forever. And
// two objects that share a shape are two different things in the data that are
// the same thing on screen — which is how the meadow's lantern row spent its
// life looking exactly like a string of party lights.
//
// Read as text rather than imported: these modules pull in Phaser, and this is a
// question about the source.

const ROOT = resolve(__dirname, '../../');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const OBJECTS = join(ROOT, 'src/game/sprites/objects');

/** Every sprite key the object modules register under `obj-`. */
function spriteKeys(): Set<string> {
	const keys = new Set<string>();
	for (const f of readdirSync(OBJECTS)) {
		const src = readFileSync(join(OBJECTS, f), 'utf8');
		for (const m of src.matchAll(/^\t([a-zA-Z0-9]+): def\(/gm)) keys.add(m[1]); // plain sprites
		for (const m of src.matchAll(/pickable\('([a-zA-Z0-9]+)'/g)) keys.add(m[1]); // plant + picked pair
	}
	// Paths are tiles, keyed by material; the runs of lights are keyed by shape.
	const paths = read('src/game/sprites/objects/paths.ts');
	const materials = paths.slice(paths.indexOf('const MATERIALS'), paths.indexOf('function drawPath'));
	for (const m of materials.matchAll(/^\t(\w+): \{/gm)) keys.add(m[1]);
	const lights = read('src/game/sprites/objects/lights.ts');
	const runs = lights.slice(lights.indexOf('RUN_SPRITES'), lights.indexOf('export const LIGHTS'));
	for (const m of runs.matchAll(/^\t(\w+): \{ w:/gm)) keys.add(m[1]);
	// One book per biome, generated from GUIDE_COVERS.
	const guides = read('src/game/sprites/objects/guides.ts');
	const covers = guides.slice(guides.indexOf('GUIDE_COVERS'), guides.indexOf('export const GUIDES'));
	for (const m of covers.matchAll(/^\t(\w+): \[/gm)) {
		keys.add(`guide-${m[1]}`);
		keys.add(`guide-${m[1]}-expanded`);
	}
	return keys;
}

const objects = JSON.parse(read('data/habitat-objects.json')).records as { id: string; shape: string }[];

describe('placeable object sprites', () => {
	it('draws every shape the data asks for', () => {
		const keys = spriteKeys();
		const missing = objects.filter((o) => !keys.has(o.shape)).map((o) => `${o.id} → '${o.shape}'`);
		expect(missing, `objects that would render as the generic kit box: ${missing.join(', ')}`).toEqual([]);
	});

	// Objects allowed to share a look, because they ARE the same piece of
	// furniture standing in different places. Anything else sharing a shape is
	// two things in the data that a player cannot tell apart — add the sprite,
	// don't add the shape here.
	it('gives every other object a look of its own', () => {
		const SHARED_ON_PURPOSE = new Set([
			'bench',
			'arch',
			'signpost',
			'cairnstack',
			'planter',
			'gazebo',
			'sundial',
			'boardwalk',
		]);
		const byShape = new Map<string, string[]>();
		for (const o of objects) byShape.set(o.shape, [...(byShape.get(o.shape) || []), o.id]);
		const clashes = [...byShape]
			.filter(([shape, ids]) => ids.length > 1 && !SHARED_ON_PURPOSE.has(shape))
			.map(([shape, ids]) => `${shape}: ${ids.join(' + ')}`);
		expect(clashes, `objects that look identical: ${clashes.join('; ')}`).toEqual([]);
	});

	it('seats you can sit on are real seats', () => {
		const keys = spriteKeys();
		const placed = new Set(objects.map((o) => o.shape));
		const scene = read('src/game/WorldScene.ts');
		const seats = scene.slice(scene.indexOf('SEATS: Record<'), scene.indexOf('};', scene.indexOf('SEATS: Record<')));
		const shapes = [...seats.matchAll(/^\t\t(\w+): \{ dy:/gm)].map((m) => m[1]);
		expect(shapes.length, 'WorldScene.SEATS is empty').toBeGreaterThan(0);
		for (const shape of shapes) {
			expect(keys.has(shape), `SEATS names '${shape}', which has no sprite`).toBe(true);
			expect(placed.has(shape), `SEATS names '${shape}', which nothing in the data uses`).toBe(true);
		}
	});

	it('names real shapes in the light sets', () => {
		const keys = spriteKeys();
		const placed = new Set(objects.map((o) => o.shape));
		const lights = read('src/game/sprites/objects/lights.ts');
		for (const set of ['RUN_SHAPES', 'LIT_SHAPES']) {
			const block = lights.slice(lights.indexOf(`export const ${set}`), lights.indexOf(']', lights.indexOf(set)));
			const named = [...block.matchAll(/'([a-zA-Z0-9-]+)'/g)].map((m) => m[1]);
			expect(named.length, `${set} is empty`).toBeGreaterThan(0);
			for (const shape of named) {
				expect(keys.has(shape), `${set} names '${shape}', which has no sprite`).toBe(true);
				expect(placed.has(shape), `${set} names '${shape}', which nothing in the data uses`).toBe(true);
			}
		}
	});
});

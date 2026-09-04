import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Every achievement's badge shows a real sprite from the game (see
// src/ui/achievementArt.tsx). Nothing at runtime notices when one points at a
// sprite that has been renamed or an animal that isn't in the data — the badge
// just falls back to a line glyph, quietly, in a panel nobody opens on a code
// review. So check the whole mapping statically: every achievement mapped, and
// every mapping pointing at art that exists.
//
// Read as text rather than imported: the sprite modules pull in Phaser, and this
// is a question about the source, not about a running game.

const ROOT = resolve(__dirname, '../../');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const ART_SRC = read('src/ui/achievementArt.tsx');
const MAPPING = ART_SRC.slice(ART_SRC.indexOf('ACHIEVEMENT_ART'), ART_SRC.indexOf('const cache'));

const mapped = (kind: 'animal' | 'object' | 'emblem') =>
	[...MAPPING.matchAll(new RegExp(`'(ach-[\\w-]+)':\\s*\\{\\s*${kind}:\\s*'([\\w-]+)'`, 'g'))].map(
		(m) => [m[1], m[2]] as const,
	);

const icons = (JSON.parse(read('data/achievements.json')).records as { icon: string }[]).map((a) => a.icon);
const animals = ['data/animals-1.json', 'data/animals-2.json'].flatMap(
	(f) => JSON.parse(read(f)).records as { id: string; kind: string }[],
);

/** Sprite keys as the object modules define them: plainly, or via pickable(). */
const objectSpriteKeys = () => {
	const dir = join(ROOT, 'src/game/sprites/objects');
	const keys = new Set<string>();
	for (const f of readdirSync(dir)) {
		const src = readFileSync(join(dir, f), 'utf8');
		for (const m of src.matchAll(/^\t([a-zA-Z0-9]+): def\(/gm)) keys.add(m[1]);
		for (const m of src.matchAll(/pickable\('([a-zA-Z0-9]+)'/g)) keys.add(m[1]);
	}
	// The field guides are generated, one book per biome, from GUIDE_COVERS.
	const guides = read('src/game/sprites/objects/guides.ts');
	const covers = guides.slice(guides.indexOf('GUIDE_COVERS'), guides.indexOf('export const GUIDES'));
	for (const m of covers.matchAll(/^\t(\w+): \[/gm)) {
		keys.add(`guide-${m[1]}`);
		keys.add(`guide-${m[1]}-expanded`);
	}
	return keys;
};

describe('achievement badge art', () => {
	it('maps every achievement icon to a picture', () => {
		const covered = new Set([...mapped('animal'), ...mapped('object'), ...mapped('emblem')].map(([icon]) => icon));
		const missing = [...new Set(icons)].filter((i) => !covered.has(i));
		expect(missing, `achievements with no art in achievementArt.tsx: ${missing.join(', ')}`).toEqual([]);
	});

	it('points every animal badge at an animal in the data, with its own kind', () => {
		for (const [icon, id] of mapped('animal')) {
			const animal = animals.find((a) => a.id === id);
			expect(animal, `${icon} → unknown animal '${id}'`).toBeTruthy();
			const kind = MAPPING.match(new RegExp(`'${icon}':[^}]*kind: '(\\w+)'`))?.[1];
			expect(animal!.kind, `${icon} → '${id}' is a ${animal!.kind}, not a ${kind}`).toBe(kind);
		}
	});

	it('points every object badge at a sprite the world draws', () => {
		const keys = objectSpriteKeys();
		for (const [icon, shape] of mapped('object')) {
			expect(keys.has(shape), `${icon} → no object sprite named '${shape}'`).toBe(true);
		}
	});

	it('points every emblem badge at an emblem', () => {
		const src = read('src/game/sprites/emblems.ts');
		const names = new Set([...src.matchAll(/^\t'?([\w-]+)'?: def\(/gm)].map((m) => m[1]));
		for (const [icon, name] of mapped('emblem')) {
			expect(names.has(name), `${icon} → no emblem named '${name}'`).toBe(true);
		}
	});
});

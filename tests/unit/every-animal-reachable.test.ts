import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Every animal in an area has to be able to come home.
//
// Redstone Scrubland is a dry biome: `canFlood: false` means a watering can can
// ready a soil bed there but can never flood one into open water, and the desert
// ships with no pre-seeded channels the way Rushwater does. Three of its animals
// — quail, raven and mountain lion — still asked for `water: { tiles: 1 }`, a
// requirement nothing in that biome can ever satisfy. All three were unreachable,
// and the desert hawk with them, because it waits on the quail. A player who did
// everything right was told, correctly and uselessly, that the scrubland is too
// dry to flood.
//
// The desert's water is the dew basin — a placed object, not a shaped tile — and
// all three animals already required one, so the impossible line came out. These
// tests pin the general rule rather than those three records: an animal's needs
// must be satisfiable by something a player can actually do in the biome it lives
// in, and an animal that waits on another animal is only as reachable as the one
// it waits on.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

const BIOMES = load('data/biomes.json');
const OBJECTS = load('data/habitat-objects.json');
const RECIPES = load('data/recipes.json');
const ANIMALS = [...load('data/animals-1.json'), ...load('data/animals-2.json')];

const biomeOf = (id: string) => BIOMES.find((b) => b.id === id);
const objectOf = (id: string) => OBJECTS.find((o) => o.id === id);
const craftable = new Set(RECIPES.map((r) => r.output?.itemId).filter(Boolean));

/** Fresh open water an animal wants shaped — ponds, channels, plain tiles. */
const freshWaterNeed = (animal: any) => {
	const w = animal.requirements?.water || {};
	return Math.max(w.tiles || 0, w.lake || 0, w.river || 0);
};

describe('every animal can come back in every biome', () => {
	it('never asks for open water in a biome that cannot be flooded', () => {
		// The reddit report, as a rule. A dry biome has no way to make a water tile:
		// the terraform endpoint refuses to flood one (server.err.tooDryToFlood) and
		// STARTING_TERRAIN seeds none, so any fresh-water need there is a dead end.
		const stranded: string[] = [];
		for (const animal of ANIMALS) {
			const biome = biomeOf(animal.biome);
			if (!biome || biome.canFlood !== false) continue;
			if (freshWaterNeed(animal) > 0) {
				stranded.push(`${animal.id} needs ${JSON.stringify(animal.requirements.water)} in dry ${biome.id}`);
			}
		}
		expect(stranded).toEqual([]);
	});

	it('asks only for habitat that can be built where the animal lives', () => {
		const unbuildable: string[] = [];
		for (const animal of ANIMALS) {
			for (const objectId of Object.keys(animal.requirements?.objects || {})) {
				const object = objectOf(objectId);
				if (!object) {
					unbuildable.push(`${animal.id} needs '${objectId}', which does not exist`);
					continue;
				}
				if (!(object.biomes || []).includes(animal.biome)) {
					unbuildable.push(`${animal.id} needs '${objectId}', not allowed in ${animal.biome}`);
				}
				// Habitat arrives one of two ways: crafted from a recipe, or planted
				// and grown. An object with neither is something no player can obtain.
				if (!craftable.has(objectId) && !object.plantable) {
					unbuildable.push(`${animal.id} needs '${objectId}', which is neither craftable nor plantable`);
				}
			}
		}
		expect(unbuildable).toEqual([]);
	});

	it('only waits on animals that live in the same biome and can themselves return', () => {
		const byId = new Map(ANIMALS.map((a) => [a.id, a]));
		const misplaced: string[] = [];
		for (const animal of ANIMALS) {
			for (const other of animal.requirements?.animals || []) {
				const prereq = byId.get(other);
				if (!prereq) misplaced.push(`${animal.id} waits on '${other}', which does not exist`);
				else if (prereq.biome !== animal.biome) {
					misplaced.push(`${animal.biome}'s ${animal.id} waits on ${other}, which lives in ${prereq.biome}`);
				}
			}
		}
		expect(misplaced).toEqual([]);

		// …and no cycle, which would strand a whole ring of animals on each other.
		const state = new Map<string, number>();
		const cycles: string[] = [];
		const walk = (id: string, trail: string[]) => {
			state.set(id, 1);
			for (const next of byId.get(id)?.requirements?.animals || []) {
				if (state.get(next) === 1) cycles.push([...trail.slice(trail.indexOf(next)), next].join(' → '));
				else if (!state.has(next)) walk(next, [...trail, next]);
			}
			state.set(id, 2);
		};
		for (const animal of ANIMALS) if (!state.has(animal.id)) walk(animal.id, [animal.id]);
		expect(cycles).toEqual([]);
	});

	it('leaves every biome with a full roster that a player can actually finish', () => {
		// Reachability, followed through: an animal blocked by an impossible need
		// blocks everything waiting on it too, so this is what "all 25 can come
		// home" means for each area's completion goal.
		const byId = new Map(ANIMALS.map((a) => [a.id, a]));
		const blocked = new Set<string>();
		for (const animal of ANIMALS) {
			const biome = biomeOf(animal.biome);
			if (biome?.canFlood === false && freshWaterNeed(animal) > 0) blocked.add(animal.id);
		}
		for (let pass = 0; pass < ANIMALS.length; pass++) {
			for (const animal of ANIMALS) {
				if (blocked.has(animal.id)) continue;
				if ((animal.requirements?.animals || []).some((o: string) => blocked.has(o))) blocked.add(animal.id);
			}
		}
		expect([...blocked]).toEqual([]);

		for (const biome of BIOMES) {
			const here = ANIMALS.filter((a) => a.biome === biome.id);
			const reachable = here.filter((a) => !blocked.has(a.id));
			expect([biome.id, reachable.length]).toEqual([biome.id, here.length]);
			expect([biome.id, byId.size > 0 && here.length > 0]).toEqual([biome.id, true]);
		}
	});
});

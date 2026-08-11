import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { effort } from '../../src/ui/journalSort';
import type { AnimalDef } from '../../src/types';

// On a fresh save every entry in the field guide reads "???", so sorting the
// undiscovered half alphabetically sorts it by a name the player cannot see —
// the list looks shuffled and gives no hint where to start. Ordering it by how
// much work each animal still is turns it into a to-do list instead: the top of
// Willow Meadow is the grasshopper, and reading down is the run of play.
//
// Entries the player HAS found keep their A-Z order, because there the name is
// visible and looking a species up is the thing you want to do.

const animals: AnimalDef[] = ['data/animals-1.json', 'data/animals-2.json'].flatMap(
	(f) => JSON.parse(readFileSync(resolve(__dirname, '../..', f), 'utf8')).records as AnimalDef[],
);
const meadow = animals.filter((a) => a.biome === 'meadow');
const byEffort = (list: AnimalDef[]) => [...list].sort((a, b) => effort(a) - effort(b) || a.name.localeCompare(b.name));

describe('ordering the entries nobody has found yet', () => {
	it('puts the grasshopper at the top of Willow Meadow', () => {
		expect(byEffort(meadow)[0].id).toBe('grasshopper');
	});

	it('never ranks a harder animal above an easier one', () => {
		const order = byEffort(meadow);
		for (let i = 1; i < order.length; i++) {
			expect(effort(order[i])).toBeGreaterThanOrEqual(effort(order[i - 1]));
		}
	});

	it('leads with restoration health, so a healthier gate always sorts later', () => {
		// Health dominates the score outright: nothing else in the requirement set
		// can add up to a single point of it, so the ordering can never be
		// overturned by an animal that just happens to want more objects.
		const cheap = { name: 'a', requirements: { minHealth: 20, objects: { x: 99 }, animals: ['a', 'b', 'c'] } };
		const dear = { name: 'b', requirements: { minHealth: 21 } };
		expect(effort(cheap as AnimalDef)).toBeLessThan(effort(dear as AnimalDef));
	});

	it('separates two animals gated at the same health by what else they need', () => {
		const plain = { name: 'a', requirements: { minHealth: 30, objects: { x: 1 } } };
		const fussy = { name: 'b', requirements: { minHealth: 30, objects: { x: 4 }, animals: ['other'] } };
		expect(effort(plain as AnimalDef)).toBeLessThan(effort(fussy as AnimalDef));
	});

	it('scores an animal with no requirements at all rather than throwing', () => {
		expect(effort({ name: 'a', requirements: {} } as AnimalDef)).toBe(0);
	});

	it('orders every area, not just the meadow', () => {
		for (const biome of [...new Set(animals.map((a) => a.biome))]) {
			const list = animals.filter((a) => a.biome === biome);
			expect(byEffort(list)[0].requirements.minHealth ?? 0).toBeLessThanOrEqual(
				byEffort(list)[list.length - 1].requirements.minHealth ?? 0,
			);
		}
	});
});

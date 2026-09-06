import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Nothing may ask a player for something they can never hold.
//
// Coral Garden sat in Pelican Shore's crafting list for six versions wanting
// four Coral — and Coral was a resource with a name, a colour and a gather-node
// sprite that no biome listed, no dig turned up, no plant yielded and no weather
// brought in. There was no way to get any. The recipe unlocked at 48% health and
// then simply could not be crafted, and its own description had said "DEPRECATED
// — do not offer in this biome" since someone noticed that reef-building corals
// don't live in an 11-21 C northeast Pacific. The data said so and the game
// offered it anyway.
//
// The reachability suites next door check that an animal's habitat can be built
// (every-animal-reachable) and that the gate on it can be met from where the
// player is standing (first-habitat-reachable). Neither looks one level further
// down, at whether the MATERIALS the recipe wants exist in the world — which is
// the hole coral fell through. So this closes it, at the level of the whole
// vocabulary rather than the one recipe: a resource is a promise that a player
// can obtain it, and asking for one that nothing yields is a dead end no amount
// of play can open.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const load = (p: string): any[] => readJson(p).records;

const RESOURCES = load('data/resources.json');
const BIOMES = load('data/biomes.json');
const OBJECTS = load('data/habitat-objects.json');
const RECIPES = load('data/recipes.json');
const WEATHER = readJson('data/weather.json');

/**
 * Every way the game hands a player a resource, as a map of resource id to the
 * things that provide it — the names are what a failure message needs to be
 * useful, so they are collected rather than counted.
 *
 * There are exactly four. A gather node standing in a biome (`resources`), a
 * shovelful of ground (`digResources`), a harvest off something planted
 * (`yield`), and a node that only appears in one kind of weather
 * (weather.json's `gather` table — the desert's storm fuses sand into
 * stormglass, an alpine snowfall puts out frostflowers). A fifth would have to
 * be added here, and that is the point: this list is the definition of
 * "obtainable", so anything not in it isn't.
 */
function sources(): Map<string, string[]> {
	const from = new Map<string, string[]>();
	const add = (id: string, where: string) => from.set(id, [...(from.get(id) || []), where]);
	for (const b of BIOMES) {
		for (const id of b.resources || []) add(id, `gathered in ${b.id}`);
		for (const id of b.digResources || []) add(id, `dug in ${b.id}`);
	}
	for (const o of OBJECTS) if (o.yield?.resourceId) add(o.yield.resourceId, `harvested from ${o.id}`);
	for (const [biome, byWeather] of Object.entries<any>(WEATHER.gather || {})) {
		if (biome.startsWith('_')) continue; // the table's own _comment
		for (const [type, id] of Object.entries<any>(byWeather)) {
			if (typeof id === 'string') add(id, `${biome} in ${type}`);
		}
	}
	return from;
}

/** Everything the game charges a player: crafting costs and planting costs. */
function demands(): { id: string; asker: string }[] {
	const out: { id: string; asker: string }[] = [];
	for (const r of RECIPES) for (const id of Object.keys(r.materials || {})) out.push({ id, asker: `recipe ${r.id}` });
	for (const o of OBJECTS) for (const id of Object.keys(o.plantCost || {})) out.push({ id, asker: `planting ${o.id}` });
	return out;
}

describe('every material a player is charged', () => {
	it('is a resource that exists', () => {
		const known = new Set(RESOURCES.map((r) => r.id));
		const phantom = demands()
			.filter((d) => !known.has(d.id))
			.map((d) => `${d.asker} costs '${d.id}', which is not a resource`);
		expect(phantom).toEqual([]);
	});

	it('can actually be obtained somewhere in the preserve', () => {
		const from = sources();
		const unobtainable = demands()
			.filter((d) => !from.has(d.id))
			.map((d) => `${d.asker} costs '${d.id}', which nothing yields`);
		expect(unobtainable).toEqual([]);
	});

	it('leaves no resource in the game that a player can never hold', () => {
		// The stronger form, and the one that catches the next coral before it is
		// ever wired into a recipe: a resource with a name and an icon is a promise
		// that it turns up somewhere. An id nothing provides is either a typo in a
		// biome's resource list or a leftover from something that got cut.
		const from = sources();
		const orphans = RESOURCES.filter((r) => !from.has(r.id)).map((r) => `${r.id} (${r.name})`);
		expect(orphans).toEqual([]);
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPLETION_BUCKETS, completionBucket, completionTracks, meanCompletion } from '../../src/completion';
import { completionGroups, overallCompletion } from '../../src/ui/Completion';
import type { GameData, GameState } from '../../src/types';

// The completion tracker is now measured in two places: the panel a caretaker
// opens, and the metrics tally the dashboard aggregates. That is the whole risk
// this file exists for — a dashboard that says 41% while the player's screen
// says 43% is worse than no dashboard, and nothing about a second reading of
// the same idea announces itself when it drifts.
//
// So the guards here are about AGREEMENT, not about arithmetic (which
// completion-tracker.test.ts already pins against the real data files):
//
//   1. Both callers get their number from the same function, and agree at every
//      state in between empty and finished — not just at the two ends.
//   2. The track ids are a contract. The dashboard keys its labels and its
//      per-track history on them, so renaming one is renaming a metric.
//   3. Every id has a label on the dashboard, and every histogram bucket the
//      server can emit has a column there. Both fail silently otherwise: an
//      unlabelled track draws under its slug, and an unlisted bucket is dropped
//      from the chart entirely (histCols filters by its `order` list).

const root = resolve(__dirname, '../..');
const load = (p: string): any[] => JSON.parse(readFileSync(resolve(root, p), 'utf8')).records;
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const BIOMES = load('data/biomes.json');
const ANIMALS = [...load('data/animals-1.json'), ...load('data/animals-2.json')];
const RECIPES = load('data/recipes.json');
const OBJECTS = load('data/habitat-objects.json');
const TOOLS = load('data/tools.json');
const ACHIEVEMENTS = load('data/achievements.json');

const homeTracks: any = {
	space: { levels: [{}, {}, {}, {}] },
	comfort: { levels: [{}, {}, {}, {}] },
	decor: { levels: [{}, {}, {}, {}] },
	light: { levels: [{}, {}, {}, {}] },
};

const data = {
	biomes: BIOMES,
	animals: ANIMALS,
	recipes: RECIPES,
	habitatObjects: OBJECTS,
	tools: TOOLS,
	achievements: ACHIEVEMENTS,
	homeStyles: {},
	homeTracks,
} as unknown as GameData;

const tr = (key: string) => key;
const explorable = BIOMES.filter((b) => b.explorable);
const placeable = OBJECTS.filter((o) => o.placement !== 'none');

const baseState = {
	player: {
		id: 'p',
		name: 'New',
		area: 'meadow',
		inventory: {},
		craftedItems: {},
		craftedEver: {},
		tools: {},
		unlockedBiomes: ['meadow'],
	},
	biomeStates: [{ id: 'b', biomeId: 'meadow', health: 0, unlocked: true }],
	placements: [],
	discoveries: [],
	achievements: [],
} as unknown as GameState;

/** A save somewhere in the middle: a fraction `f` of the way down every track. */
function partialState(f: number): GameState {
	const take = <T>(arr: T[]) => arr.slice(0, Math.round(arr.length * f));
	return {
		...baseState,
		player: {
			...baseState.player,
			craftedEver: Object.fromEntries(take(RECIPES).map((r: any) => [r.output.itemId, 1])),
			tools: Object.fromEntries(take(TOOLS).map((t: any) => [t.id, t.tiers.length])),
			unlockedBiomes: take(explorable).map((b: any) => b.id),
			home: { style: 'cabin', styleLocked: true, space: 2, comfort: 2, decor: 1, light: 1 },
		},
		biomeStates: take(explorable).map((b: any) => ({ id: b.id, biomeId: b.id, health: 100 })),
		placements: take(placeable).map((o: any, i: number) => ({ id: `pl-${i}`, objectId: o.id })),
		discoveries: take(ANIMALS).map((a: any, i: number) => ({ id: `d-${i}`, animalId: a.id, biomeId: a.biome })),
		achievements: take(ACHIEVEMENTS).map((a: any) => a.id),
	} as unknown as GameState;
}

/* The ten tracks, and the group each is filed under. Pinned as a literal rather
 * than derived, because the point of the assertion is that changing one is a
 * deliberate act: the id is the key the dashboard's labels and its per-track
 * history are both hung on. Adding a track here is fine and expected; RENAMING
 * one silently re-baselines a metric. */
const EXPECTED_TRACKS: Array<[string, string]> = [
	['animals', 'preserve'],
	['areas', 'preserve'],
	['restored', 'preserve'],
	['recipes', 'making'],
	['habitat', 'making'],
	['plants', 'making'],
	['tools', 'kit'],
	['guides', 'kit'],
	['home', 'honors'],
	['achievements', 'honors'],
];

describe('completion metrics', () => {
	it('gives the panel and the tally the same headline at every stage', () => {
		// The two ends are already covered elsewhere; these are the states in
		// between, where a second implementation would be free to disagree.
		for (const f of [0, 0.03, 0.17, 0.4, 0.63, 0.85, 0.99, 1]) {
			const state = partialState(f);
			// What the caretaker reads off the dial in the Achievements menu.
			const onScreen = Math.round(overallCompletion(completionGroups(data, state, tr)) * 100);
			// What server/completion.ts reports into the snapshot (same rounding).
			const reported = Math.round(meanCompletion(completionTracks(data, state as any)) * 100);
			expect(`${f}: ${reported}%`).toBe(`${f}: ${onScreen}%`);
		}
	});

	it('keeps the track ids and their groups stable', () => {
		const tracks = completionTracks(data, baseState as any);
		expect(tracks.map((t) => [t.id, t.group])).toEqual(EXPECTED_TRACKS);
	});

	it('labels every track on the dashboard', () => {
		const src = read('public/dashboard.html');
		const block = src.slice(src.indexOf('const COMPLETION_TRACK_LABELS = {'));
		const labels = block.slice(0, block.indexOf('};'));
		for (const [id] of EXPECTED_TRACKS) {
			expect(labels, `dashboard has no label for the "${id}" track`).toContain(`${id}:`);
		}
	});

	it('buckets every percentage into a column the dashboard draws', () => {
		// histCols() renders only the keys named in its `order` list, so a bucket
		// missing from it is not a mislabeled column — it is a column that silently
		// isn't there, taking its saves out of the chart with it.
		const src = read('public/dashboard.html');
		const order = src.slice(src.indexOf('const decades = ['));
		const listed = order.slice(0, order.indexOf('];'));
		for (let pct = 0; pct <= 100; pct++) {
			const bucket = completionBucket(pct);
			expect(COMPLETION_BUCKETS, `${pct}% bucketed to an unlisted key`).toContain(bucket);
			expect(listed, `dashboard draws no "${bucket}" column`).toContain(`'${bucket}'`);
		}
	});

	it('gives 100% its own bucket, apart from the nineties', () => {
		expect(completionBucket(99)).toBe('90-99');
		expect(completionBucket(100)).toBe('100');
		expect(completionBucket(0)).toBe('0-9');
	});
});

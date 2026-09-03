// Wild Willows — the completion ("what is left?") arithmetic.
//
// This is the whole of the perfection tracker: ten countable tracks, each a
// fraction of a whole, and one headline that is the mean of their fractions.
// It lives here, apart from the panel that draws it, because TWO callers need
// the same number and a second implementation would eventually disagree with
// the first:
//
//   src/ui/Completion.tsx — the Completion tab of the Achievements menu, which
//     labels these tracks and draws them as bars for the player.
//   server/completion.ts — the metrics tally, which reports the same fractions
//     into the snapshot so the dashboard can see where a preserve stalls.
//
// A dashboard that says 41% while the player's screen says 43% is worse than no
// dashboard, so the two share this function rather than describing it twice.
// Everything here is pure and framework-free: no React, no i18n, no database.
//
// The inputs are structural minimums, not the full GameData/GameState — the
// server assembles its own rows and should not have to impersonate a client
// snapshot to be measured.

import { guideToolId } from './types';

/** One measurable track: `cur` of `target`. */
export interface CompletionTrack {
	id: string;
	/** Which group the panel files this track under. */
	group: 'preserve' | 'making' | 'kit' | 'honors';
	cur: number;
	target: number;
}

/** The definition side: how big each whole is. */
export interface CompletionData {
	biomes: Array<{ id: string; order?: number; explorable?: boolean }>;
	animals: Array<unknown>;
	recipes: Array<{ output: { itemId: string } }>;
	habitatObjects: Array<{ id: string; placement?: string; plantable?: boolean }>;
	tools: Array<{ id: string; tiers: unknown[] }>;
	achievements?: Array<{ id: string; points?: number }>;
	homeTracks?: Record<string, { levels?: unknown[] }>;
}

/** The save side: how much of each whole this player has. */
export interface CompletionState {
	player: {
		tools?: Record<string, number>;
		craftedEver?: Record<string, number>;
		unlockedBiomes?: string[];
		home?: Record<string, unknown>;
	};
	biomeStates?: Array<{ biomeId: string; health?: number }>;
	placements?: Array<{ objectId: string }>;
	discoveries?: Array<unknown>;
	/** Earned achievement ids. */
	achievements?: string[];
}

/** The three hand tools; the six field guides are tools too, counted separately. */
export const HAND_TOOLS = ['basket', 'shovel', 'watering-can'];
export const HOME_TRACK_KEYS = ['space', 'comfort', 'decor', 'light'] as const;

/** How far along one track is, clamped into 0..1. */
export const trackRatio = (r: { cur: number; target: number }) =>
	r.target > 0 ? Math.min(1, Math.max(0, r.cur / r.target)) : 0;

/** The explorable areas, in the order the game reveals them. */
export const explorableBiomes = <T extends { order?: number; explorable?: boolean }>(data: { biomes: T[] }): T[] =>
	[...data.biomes].filter((b) => b.explorable).sort((a, b) => (a.order || 0) - (b.order || 0));

/**
 * Every completion track, computed from one snapshot.
 *
 * Order is meaningful — the panel draws them in this order, grouped by `group`
 * — but nothing downstream may assume it: the dashboard keys on `id`, so a
 * track can be reordered without renaming a historical metric.
 */
export function completionTracks(data: CompletionData, state: CompletionState): CompletionTrack[] {
	const player: CompletionState['player'] = state.player || {};
	const tools = player.tools || {};
	const craftedEver = player.craftedEver || {};
	const unlocked = new Set(player.unlockedBiomes || ['meadow']);
	const areas = explorableBiomes(data);
	const bs = state.biomeStates || [];
	const healthOf = (id: string) => Math.round(bs.find((s) => s.biomeId === id)?.health || 0);

	// Recipes are 1:1 with the thing they make, and `craftedEver` is keyed by that
	// output id — so a recipe counts once the player has made it even if they have
	// since spent, placed or dropped every copy.
	const recipesCrafted = data.recipes.filter((r) => (craftedEver[r.output.itemId] || 0) > 0).length;

	// Habitat STANDING, not ever-placed: the snapshot carries placements, not a
	// lifetime tally, so this is honest about being a current count. Seeded
	// scenery the world placed itself counts too — it is habitat, and it is there.
	const placeable = data.habitatObjects.filter((o) => o.placement !== 'none');
	const placeableIds = new Set(placeable.map((o) => o.id));
	const standing = new Set((state.placements || []).map((p) => p.objectId).filter((id) => placeableIds.has(id)));

	// Living habitat gets its own line — planting a species is a different act
	// from crafting a bench, and it is the half of the preserve that grows.
	const plantable = placeable.filter((o) => o.plantable);
	const plantableIds = new Set(plantable.map((o) => o.id));
	const grown = new Set((state.placements || []).map((p) => p.objectId).filter((id) => plantableIds.has(id)));

	const guideDone = areas.filter((b) => (tools[guideToolId(b.id)] || 1) >= 3).length;
	const handToolsMaxed = HAND_TOOLS.filter((id) => {
		const def = data.tools.find((x) => x.id === id);
		return def ? (tools[id] || 1) >= def.tiers.length : false;
	}).length;

	// Home: a canvas tent counts as nothing, because the house has not been
	// started. Once a style is built the four tracks each climb to their own top
	// level (a fresh house is already 5 of them), so the whole house is the sum.
	const home: Record<string, unknown> = player.home || {};
	const homeBuilt = !!home.styleLocked;
	const homeMax = (tk: string) => data.homeTracks?.[tk]?.levels?.length || 5;
	const homeCur = (tk: string) => (home[tk] as number) || 1;
	const homeLevels = homeBuilt ? HOME_TRACK_KEYS.reduce((n, tk) => n + homeCur(tk), 0) : 0;
	const homeTarget = HOME_TRACK_KEYS.reduce((n, tk) => n + homeMax(tk), 0);

	const achievements = data.achievements || [];
	const earned = new Set(state.achievements || []);

	return [
		{ id: 'animals', group: 'preserve', cur: (state.discoveries || []).length, target: data.animals.length },
		{ id: 'areas', group: 'preserve', cur: areas.filter((b) => unlocked.has(b.id)).length, target: areas.length },
		{
			id: 'restored',
			group: 'preserve',
			cur: areas.filter((b) => healthOf(b.id) >= 100).length,
			target: areas.length,
		},
		{ id: 'recipes', group: 'making', cur: recipesCrafted, target: data.recipes.length },
		{ id: 'habitat', group: 'making', cur: standing.size, target: placeable.length },
		{ id: 'plants', group: 'making', cur: grown.size, target: plantable.length },
		{ id: 'tools', group: 'kit', cur: handToolsMaxed, target: HAND_TOOLS.length },
		{ id: 'guides', group: 'kit', cur: guideDone, target: areas.length },
		{ id: 'home', group: 'honors', cur: homeLevels, target: homeTarget },
		{ id: 'achievements', group: 'honors', cur: earned.size, target: achievements.length },
	];
}

/**
 * The headline figure: the mean of every track's own fraction.
 *
 * Deliberately NOT sum(cur)/sum(target) — that would make the preserve 90%
 * "recipes and species" by weight, and welcoming the last three animals would
 * move the number less than crafting a single bench. Every track counts once,
 * so finishing the field guides is worth as much as finishing the cookbook.
 */
export function meanCompletion(rows: Array<{ cur: number; target: number }>): number {
	if (!rows.length) return 0;
	return rows.reduce((sum, r) => sum + trackRatio(r), 0) / rows.length;
}

/** How many tracks are actually finished — the number a completionist counts. */
export function tracksFinished(rows: Array<{ cur: number; target: number }>): number {
	return rows.filter((r) => r.target > 0 && r.cur >= r.target).length;
}

/**
 * Which column of the dashboard's completion histogram a save falls in.
 *
 * Deciles, with 100% as a column of its own: "finished the preserve" is a
 * different fact from "in the nineties", and folding them together hides the
 * one bucket the tracker exists to make reachable. Lives here, beside the
 * arithmetic, because the dashboard renders a FIXED list of column keys and
 * quietly drops any bucket the list doesn't name — so the two have to be
 * checkable against each other (tests/unit/completion-metrics.test.ts).
 */
export function completionBucket(pct: number): string {
	const p = Math.min(100, Math.max(0, Math.round(pct)));
	if (p >= 100) return '100';
	const lo = Math.floor(p / 10) * 10;
	return `${lo}-${lo + 9}`;
}

/** Every bucket completionBucket can return, in reading order. */
export const COMPLETION_BUCKETS: string[] = [...Array.from({ length: 10 }, (_, i) => `${i * 10}-${i * 10 + 9}`), '100'];

/** Achievement points held, for the note under the achievements track. */
export function achievementPoints(data: CompletionData, earnedIds: string[] | undefined): number {
	const earned = new Set(earnedIds || []);
	return (data.achievements || []).reduce((sum, a) => sum + (earned.has(a.id) ? a.points || 0 : 0), 0);
}

// Wild Willows — server: completion ("perfection") tally
//
// The metrics half of the Completion tab. The panel in the game answers "what
// is left?" for one caretaker; this answers "where does everybody stall?" for
// the dashboard, and it answers it with THE SAME FUNCTION — completionTracks in
// src/completion.ts — rather than a second copy of the arithmetic that would
// eventually drift from the one on screen.
//
// What that costs is an adapter: the client holds a GameState snapshot, the
// server holds rows. Everything below assembles those rows into the shape the
// shared core measures, and nothing below decides anything about what a track
// means. If a track's definition should change, it changes in src/completion.ts
// and both the screen and this move together.
//
// Reported per player from GET /Metrics/<id>, which is also what the solo/demo
// uplink posts as its snapshot — so desktop saves land in the roll-up the same
// way hosted ones do (see src/solo/metricsUplink.ts).

import { completionTracks, meanCompletion, tracksFinished } from '../src/completion';

import { db } from './core';
import { byWorld, defs, worldOf } from './worlds';
import { getPlayer } from './player';
import { HOME_TRACKS } from './home';
import { earnedAchievementIds } from './achievements';

/** One track as the dashboard reads it. `pct` is 0..100, already rounded. */
export interface CompletionTrackMetric {
	cur: number;
	target: number;
	pct: number;
}

export interface CompletionMetrics {
	/** The headline the player sees, 0..100. */
	overallPct: number;
	/** Tracks finished, and how many there are — the plainer companion figure. */
	tracksDone: number;
	tracksTotal: number;
	/** Per-track, keyed by the shared track id (NOT by position). */
	tracks: Record<string, CompletionTrackMetric>;
}

const pct100 = (n: number) => Math.round(n * 100);

/**
 * Derived completion view for one player's Metrics.
 *
 * Returns null rather than throwing: this rides along on a metrics read, and a
 * save with one unreadable table must not take the whole endpoint down with it.
 * The dashboard already treats a missing block as "not measured" — which is
 * also what every snapshot uplinked before this shipped carries.
 */
export async function completionMetrics(
	playerId: string,
	opts: {
		/** Rows the caller already holds, so a metrics read need not re-fetch them. */
		player?: any;
		biomeStates?: Array<{ biomeId: string; health?: number }>;
		earned?: Set<string>;
	} = {},
): Promise<CompletionMetrics | null> {
	try {
		const t = db();
		const d = await defs();
		const player = opts.player && opts.player.id === playerId ? opts.player : await getPlayer(playerId);
		if (!player) return null;

		// BiomeState / Placement / Discovery are WORLD-keyed, so resolve the world
		// once and use the bounded read — the same reason biomeMetrics does, and for
		// a solo save the world id IS the player id, so this is the cheap route.
		const wid = worldOf(player);
		const [biomeStates, placements, discoveries] = await Promise.all([
			// The metrics read has already scanned BiomeState for biomeMetrics, so it
			// hands those rows over rather than paying for the same scan twice.
			opts.biomeStates ?? byWorld(t.BiomeState, wid),
			byWorld(t.Placement, wid),
			byWorld(t.Discovery, wid),
		]);
		// Species returned is counted from Discovery rows, NOT from the biome rows'
		// `returnedCount`, because Discovery is what the client counts. The two
		// should agree; when they don't, the dashboard should be wrong in the same
		// direction as the player's screen rather than quietly authoritative.
		const earned = opts.earned || (await earnedAchievementIds(playerId, player));

		const tracks = completionTracks(
			{
				biomes: d.biomes,
				animals: d.animals,
				recipes: d.recipes,
				habitatObjects: d.objects,
				tools: d.tools,
				achievements: d.achievements,
				homeTracks: HOME_TRACKS,
			},
			{
				player,
				biomeStates: biomeStates.map((s: any) => ({ biomeId: s.biomeId, health: s.health })),
				placements: placements.map((p: any) => ({ objectId: p.objectId })),
				discoveries,
				achievements: [...earned],
			},
		);

		const byId: Record<string, CompletionTrackMetric> = {};
		for (const tr of tracks) {
			byId[tr.id] = {
				cur: tr.cur,
				target: tr.target,
				pct: pct100(tr.target > 0 ? Math.min(1, Math.max(0, tr.cur / tr.target)) : 0),
			};
		}

		return {
			overallPct: pct100(meanCompletion(tracks)),
			tracksDone: tracksFinished(tracks),
			tracksTotal: tracks.length,
			tracks: byId,
		};
	} catch {
		return null; // never break a metrics read over a derived extra
	}
}

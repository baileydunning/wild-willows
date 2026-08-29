// Wild Willows — server: achievements
//
// Achievement triggers and awarding, for both player-scoped and world-scoped
// achievements.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { db } from './core';
import { safeGet } from './store';
import { byPlayer } from './keys';
import { byArea, byWorld, defs, worldOf } from './worlds';
import { GUIDE_MAX, guideTool, readPlayerRow } from './player';
import { readMetrics, round1 } from './metrics';
import { analyzeWater } from './biome';

// ----------------------------------------------------------- achievements
// Earned server-side from durable state + the metrics action counters, one
// PlayerAchievement row per achievement. Triggers are pure predicates over a
// context assembled from the player's live records; we only test the
// not-yet-earned set, and writes are idempotent on the composite id, so
// re-evaluating on every action never double-awards. awardAchievements never
// throws — a hiccup here must never break the action that triggered it.

// Reaching the grasshopper step means the caretaker worked through the guide.
const TUTORIAL_GRASSHOPPER_STEP = 14;

interface AchCtx {
	counts: Record<string, number>;
	health: (b: string) => number;
	returned: (b: string) => number;
	disc: (animalId: string) => any;
	totalReturned: number;
	kindReturned: (b: string, kind: string) => number;
	tool: (id: string) => number;
	/** Every area of the preserve, so a "one per biome" trigger can't fall out of
	 *  step with the data by hardcoding the list. */
	biomeIds: string[];
	unlockedCount: number;
	craftedDistinct: number;
	tutorialStep: number;
	water: (b: string) => { tiles: number; lake: number; river: number };
	biomesAtHealth: (h: number) => number;
	unlockedHealthy: (h: number) => boolean;
}

const ACHIEVEMENT_TRIGGERS: Record<string, (c: AchCtx) => boolean> = {
	// Earned the moment the grasshopper comes home — the payoff of the whole
	// starter loop (you can only get here by gathering, crafting, and placing).
	'welcome-grasshopper': (c) => !!c.disc('grasshopper'),
	forager: (c) => (c.counts.resourcesCollected || 0) >= 100,
	'makers-hands': (c) => (c.counts.itemsCrafted || 0) >= 10,
	'green-thumb': (c) => (c.counts.plantsPlanted || 0) >= 10,
	waterworks: (c) => (c.counts.terraformActions || 0) >= 15,

	'meadow-first-bloom': (c) => c.returned('meadow') >= 8,
	'meadow-pollinators': (c) => c.kindReturned('meadow', 'insect') >= 5,
	'meadow-apex': (c) => !!c.disc('red-fox'),
	'meadow-mender': (c) => c.health('meadow') >= 80,
	'meadow-reborn': (c) => c.returned('meadow') >= 25,

	'forest-understory': (c) => c.returned('forest') >= 10,
	'forest-cavities': (c) =>
		!!c.disc('pileated-woodpecker') &&
		(!!c.disc('wood-duck') || !!c.disc('flying-squirrel') || !!c.disc('great-horned-owl') || !!c.disc('goshawk')),
	'forest-night-shift': (c) => !!c.disc('great-horned-owl') && !!c.disc('goshawk') && !!c.disc('skunk'),
	'forest-canopy': (c) => c.health('forest') >= 80,
	'forest-reborn': (c) => c.returned('forest') >= 25,

	'wetland-first-water': (c) => c.returned('wetland') >= 8,
	'wetland-engineer': (c) => !!c.disc('beaver'),
	'wetland-lakemaker': (c) => c.water('wetland').lake >= 6,
	'wetland-restored': (c) => c.health('wetland') >= 80,
	'wetland-reborn': (c) => c.returned('wetland') >= 25,

	'desert-first-life': (c) => c.returned('desert') >= 8,
	'desert-burrows': (c) => !!c.disc('burrowing-owl') && !!c.disc('kangaroo-rat') && !!c.disc('desert-tortoise'),
	'desert-hunter': (c) => !!c.disc('rattlesnake') || !!c.disc('mountain-lion'),
	'desert-restored': (c) => c.health('desert') >= 80,
	'desert-reborn': (c) => c.returned('desert') >= 25,

	'alpine-treeline': (c) => c.returned('alpine') >= 8,
	'alpine-haypile': (c) => !!c.disc('pika'),
	'alpine-crown': (c) => !!c.disc('golden-eagle'),
	'alpine-restored': (c) => c.health('alpine') >= 80,
	'alpine-reborn': (c) => c.returned('alpine') >= 25,

	'coastal-tide': (c) => c.returned('coastal') >= 8,
	'coastal-keystone': (c) => !!c.disc('sea-star'),
	'coastal-otter': (c) => !!c.disc('sea-otter'),
	'coastal-restored': (c) => c.health('coastal') >= 80,
	'coastal-reborn': (c) => c.returned('coastal') >= 25,

	'well-stocked': (c) => (c.counts.resourcesCollected || 0) >= 1000,
	'master-builder': (c) => (c.counts.objectsPlaced || 0) >= 150,
	'master-gardener': (c) => (c.counts.plantsPlanted || 0) >= 75,
	landscaper: (c) => (c.counts.terraformActions || 0) >= 150,
	'fully-equipped': (c) => c.tool('basket') >= 4 && c.tool('shovel') >= 4 && c.tool('watering-can') >= 4,
	// Every area's guide, written all the way up to its expanded edition. "Every
	// guide filled in, every animal's secrets unlocked" is what the badge already
	// promised; before the split it was one ladder for the whole preserve, and now
	// it is one per place.
	naturalist: (c) => c.biomeIds.every((b) => c.tool(guideTool(b)) >= GUIDE_MAX),
	'recipe-collector': (c) => c.craftedDistinct >= 75,

	'open-road': (c) => c.unlockedCount >= 2,
	'welcoming-committee': (c) => c.totalReturned >= 50,
	'full-house': (c) => c.totalReturned >= 100,
	'field-notes': (c) => (c.counts.animalsObserved || 0) >= 100,
	'steady-hand': (c) => c.unlockedCount >= 3 && c.unlockedHealthy(50),
	'three-restored': (c) => c.biomesAtHealth(80) >= 3,
	trailblazer: (c) => c.unlockedCount >= 6,
	'caretaker-of-the-whole': (c) => c.totalReturned >= 150,
};

/** Read the achievement ids a player has already earned. */
export async function earnedAchievementIds(playerId: string, player?: any): Promise<Set<string>> {
	// `player` is passed through purely so byPlayer's legacy-key check can answer
	// from a row the caller already holds instead of re-reading it. Every gameplay
	// action reaches here via awardAchievements.
	const rows = await byPlayer(db().PlayerAchievement, playerId, { player });
	return new Set(rows.map((r: any) => r.achievementId));
}

/** Derived achievements view for one player's Metrics. */
export async function achievementMetrics(playerId: string) {
	const d = await defs();
	const rows = await byPlayer(db().PlayerAchievement, playerId);
	const total = d.achievements.length || 1;
	const earnedById = new Map(rows.map((r: any) => [r.achievementId, r]));
	const points = d.achievements.reduce((sum: number, a: any) => sum + (earnedById.has(a.id) ? a.points || 0 : 0), 0);
	const byCategory: Record<string, number> = {};
	for (const a of d.achievements) if (earnedById.has(a.id)) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
	const recent = [...rows]
		.sort((a: any, b: any) => (b.earnedAt || 0) - (a.earnedAt || 0))
		.slice(0, 5)
		.map((r: any) => ({
			id: r.achievementId,
			name: d.achievement.get(r.achievementId)?.name || r.achievementId,
			earnedAt: r.earnedAt,
		}));
	/* When each achievement was earned, for ALL of them — not just the five in
	 * `recent`. Time-to-earn is only interesting for the achievements everybody
	 * gets, and those are the EARLY ones, which is exactly what a most-recent-five
	 * list leaves out: a player with twenty achievements reports nothing about the
	 * first one they ever earned. A flat id -> timestamp map is a few hundred
	 * bytes and makes both popularity and pacing computable from the rollup.
	 * `recent` stays as it is; something may still be reading it. */
	const earnedAt: Record<string, number> = {};
	for (const r of rows) if (r.achievementId && r.earnedAt) earnedAt[String(r.achievementId)] = Number(r.earnedAt);

	return {
		earned: rows.length,
		total: d.achievements.length,
		points,
		completion: round1(rows.length / total),
		byCategory,
		recent,
		earnedAt,
	};
}

/**
 * Evaluate every not-yet-earned achievement for a player against their live
 * state and persist any newly earned ones. Returns the newly-earned definition
 * records (for logging); the client surfaces them by diffing the snapshot.
 *
 * `opts` lets callers fold in writes made earlier in THIS request that the
 * byPlayer searches can't see yet (Harper doesn't surface a transaction's own
 * writes to later searches) — e.g. the Discovery just created for a returning
 * animal, and the freshly recalculated BiomeState. Without this, achievements
 * like First Friend wouldn't fire until the *next* action.
 */
export async function awardAchievements(
	playerId: string,
	opts: {
		addDiscoveries?: any[];
		freshBiomeStates?: any[];
		/** Rows the caller has already read this request — see the note below. */
		player?: any;
		biomeStates?: any[];
		discoveries?: any[];
		terrain?: any[];
	} = {},
): Promise<any[]> {
	try {
		const t = db();
		const d = await defs();
		// safeGet (not raw .get): achievement fan-out reads every save in the world,
		// so one row left undecodable must not throw a
		// storage-layer decode error on every action. safeGet force-decodes, purges
		// the corrupt row, and returns null → this player is simply skipped.
		const player = opts.player && opts.player.id === playerId ? opts.player : await readPlayerRow(playerId);
		if (!player) return [];
		const earned = await earnedAchievementIds(playerId, player);
		// achievement context comes from the world the player is acting in
		const wid = worldOf(player);

		// Reuse whatever the caller already read. These three scans are bounded per
		// world, but the heartbeat and several actions had ALREADY read the same
		// rows moments earlier in the same request and were paying for them twice —
		// the reads are identical, so the only thing the second pass bought was
		// latency. `opts` was always the place for this; the addDiscoveries /
		// freshBiomeStates folding below exists for exactly the same reason.
		let [biomeStates, discoveries] = await Promise.all([
			opts.biomeStates ?? byWorld(t.BiomeState, wid),
			opts.discoveries ?? byWorld(t.Discovery, wid),
		]);
		// TerrainTile is deliberately NOT read here — see the water() note below.
		// Never mutate an array the caller lent us — the folding below pushes.
		if (opts.biomeStates) biomeStates = biomeStates.slice();
		if (opts.discoveries) discoveries = discoveries.slice();

		// fold in this-request writes the searches above can't see yet
		for (const ad of opts.addDiscoveries || []) {
			if (ad?.animalId && !discoveries.some((x: any) => x.animalId === ad.animalId)) discoveries.push(ad);
		}
		for (const bs of opts.freshBiomeStates || []) {
			if (!bs?.biomeId) continue;
			biomeStates = biomeStates.filter((b: any) => b.biomeId !== bs.biomeId);
			biomeStates.push(bs);
		}

		const stateByBiome = new Map(biomeStates.map((b: any) => [b.biomeId, b]));
		const discById = new Map(discoveries.map((x: any) => [x.animalId, x]));

		/**
		 * water() is resolved in a SECOND pass, and usually never.
		 *
		 * This function used to read every TerrainTile in the world, on every
		 * action, so that `ctx.water(b)` could answer a question exactly one
		 * achievement asks — `wetland-lakemaker`, about exactly one biome, and only
		 * until it is earned. On a well-built save that is thousands of rows read to
		 * evaluate a trigger that has already fired.
		 *
		 * So the first pass runs every unearned trigger with a water() that records
		 * which biomes were asked about and returns nothing. Any trigger that TOUCHED
		 * water is set aside undecided — not awarded and not rejected, because a zero
		 * could flip it either way — and only if something was set aside do we read
		 * terrain, for those biomes alone, and re-run just those triggers.
		 *
		 * Generic on purpose: no achievement id is hard-coded, so a new water-based
		 * achievement costs nothing to add and keeps this optimization.
		 */
		const NO_WATER = { tiles: 0, lake: 0, river: 0 };
		const waterCache = new Map<string, { tiles: number; lake: number; river: number }>();
		const askedAbout = new Set<string>();
		let probing = true;
		let touchedWater = false;

		const unlockedSet = new Set(player.unlockedBiomes || []);

		const ctx: AchCtx = {
			counts: (readMetrics(player)?.counts || {}) as Record<string, number>,
			health: (b) => (stateByBiome.get(b) as any)?.health || 0,
			returned: (b) => (stateByBiome.get(b) as any)?.returnedCount || 0,
			disc: (animalId) => discById.get(animalId),
			totalReturned: discoveries.length,
			kindReturned: (b, kind) =>
				discoveries.filter((x: any) => {
					const a = d.animal.get(x.animalId);
					return a && a.biome === b && a.kind === kind;
				}).length,
			tool: (id) => player.tools?.[id] || 1,
			biomeIds: d.biomes.map((b: any) => b.id),
			unlockedCount: (player.unlockedBiomes || []).length,
			craftedDistinct: Object.keys(player.craftedEver || {}).length,
			tutorialStep: player.tutorialStep || 0,
			water: (b) => {
				if (probing) {
					askedAbout.add(b);
					touchedWater = true;
					return NO_WATER;
				}
				return waterCache.get(b) ?? NO_WATER;
			},
			biomesAtHealth: (h) => biomeStates.filter((b: any) => (b.health || 0) >= h).length,
			unlockedHealthy: (h) =>
				biomeStates.filter((b: any) => unlockedSet.has(b.biomeId)).every((b: any) => (b.health || 0) >= h),
		};

		// Pass 1: everything that can be decided without touching terrain.
		const won = new Set<string>();
		const undecided: any[] = [];
		for (const def of d.achievements) {
			if (earned.has(def.id)) continue;
			const trigger = ACHIEVEMENT_TRIGGERS[def.id];
			if (!trigger) continue;
			touchedWater = false;
			const fired = trigger(ctx);
			// Asked about water: its answer was a placeholder, so decide it in pass 2
			// rather than trusting a result that may be a false negative — or, for a
			// trigger phrased the other way round, a false positive.
			if (touchedWater) undecided.push(def);
			else if (fired) won.add(def.id);
		}

		// Pass 2: only if something asked, and only for the biomes it asked about.
		if (undecided.length) {
			probing = false;
			for (const b of askedAbout) {
				// recalcBiome stores this on the biome row, computed from the same
				// terrain list it was already holding, and the fold-in above means a
				// biome recalculated by THIS request is the version we see. So the
				// common case — a trigger asking about a biome nobody touched — is
				// answered from a row we have, instead of scanning that biome's terrain
				// on every action taken anywhere in the world. Digging in the forest was
				// reading every wetland tile to re-decide Lakemaker.
				//
				// Absent means: a save whose biomes have not been recalculated since
				// this field existed, or a repair that cleared water without a recalc.
				// Fall back to the scan — the value is never guessed, only skipped.
				const stored = (stateByBiome.get(b) as any)?.playerWater;
				if (stored) {
					waterCache.set(b, stored);
					continue;
				}
				// player-shaped water only — seeded starting channels don't earn Lakemaker
				const tiles = opts.terrain
					? opts.terrain.filter((tt: any) => tt.area === b)
					: await byArea(t.TerrainTile, wid, b);
				waterCache.set(b, analyzeWater(tiles, true));
			}
			for (const def of undecided) if (ACHIEVEMENT_TRIGGERS[def.id](ctx)) won.add(def.id);
		}

		// Written in definition order regardless of which pass decided them, so the
		// client's "newly earned" list reads the same way it always has.
		const now = Date.now();
		const newly: any[] = [];
		for (const def of d.achievements) {
			if (!won.has(def.id)) continue;
			await t.PlayerAchievement.put({
				id: `${playerId}:${def.id}`,
				playerId,
				achievementId: def.id,
				biome: def.biome,
				earnedAt: now,
			});
			newly.push(def);
		}
		return newly;
	} catch {
		return []; // never let achievement evaluation break the triggering action
	}
}

/**
 * Award achievements for a world-changing action. One player owns one world, so
 * this is just the actor — the wrapper stays because every world-mutating call
 * site already goes through it, and it is the right seam if that ever changes.
 */
export async function awardWorldAchievements(
	wid: string,
	actorId: string,
	opts: Parameters<typeof awardAchievements>[1] = {},
): Promise<any[]> {
	// One player owns one world, so there is nobody else to evaluate. The wrapper
	// stays because every world-mutating call site already routes through it.
	return awardAchievements(actorId, opts);
}

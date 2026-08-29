// Wild Willows — server: tasks
//
// The task list in both its forms — the generated daily tasks and the
// player-authored custom goals (progress, rewards, the starter chain) — plus
// `snapshot`, the state blob the client renders from.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';
import { isWeatherGatheredResource, weatherSnapshot } from './weather';

import { FEED_CAP, FIRST_ANIMAL_ID, NODE_REGEN_SECONDS, db, hash32, readFeed, seededRng } from './core';
import { byPlayer } from './keys';
import { byArea, byWorld, defs, worldOf } from './worlds';
import { HOME_STYLES, tentBiomeOf } from './home';
import { getPlayer, hasExpandedGuide, hasGuide, sanitizePlayer } from './player';
import {
	DAY_MS,
	META_COUNTER_PREFIX,
	TASK_RESET_HOUR,
	WEATHER_BIOME_IDS,
	playerDayKey,
	readMetrics,
	tzMs,
	weatherTimeFromPlay,
} from './metrics';
import { analyzeWater, inventoryCapacity } from './biome';

// ------------------------------------------------------- snapshot for client

// ------------------------------------------------------------- daily tasks
// A small task board: three light, doable goals per real day, refreshed every
// real-life morning (TASK_RESET_HOUR in the player's local time). The board
// doubles as a gentle how-to-play guide that reads the player's actual
// progress:
//   • day one is always the same on-ramp — welcome the grasshopper home,
//     collect 10 seeds, plant 3 seedlings — the loop that starts the game;
//   • until the grasshopper is home, welcoming it stays pinned as task #1;
//   • after that, task #1 pins a SMALL step toward the next real milestone:
//     whichever unlock requirement of the next biome is still unmet (raise
//     health by a few points, welcome one animal, craft the restoration kit)
//     — claim a step and the next appears, walking the player to the forest,
//     the wetland, and beyond.
// Every task must be doable in about five minutes of play — the board nudges,
// it never looms.
// Rotating filler tasks are derived deterministically from (worldId, day) —
// no stored task rows, no scheduler. Progress reads the per-day counters
// bumped by normal play (player.daily) or live world state (pinned tasks);
// claims live in player.taskClaims and reset when the dayKey rolls over.

interface DailyTask {
	id: string;
	kind: 'gather' | 'craft' | 'place' | 'water' | 'plant' | 'observe' | 'welcome' | 'goal';
	icon: string;
	text: string;
	target: number;
	/** player.daily counter key this task reads ('' for live-progress pinned tasks). */
	counter: string;
	reward: Record<string, number>;
	/** optional "how do I do this?" nudge, shown as a hover tip on the board */
	hint?: string;
	/** live progress for welcome/goal tasks, read from world state instead of daily counters */
	live?: number;
	/** Sub-requirements shown as checkboxes (the always-on "unlock next biome" goal). */
	steps?: { text: string; done: boolean }[];
	/** Guidance goal — always on the board, not claimable for a reward. */
	pinned?: boolean;
}

export interface TaskCtx {
	wid: string;
	player: any;
	d: any;
	/** every Discovery row in this world (which animals have come home) */
	discoveries: any[];
	/** every BiomeState row in this world */
	biomeStates: any[];
	/** every Placement row in this world (for "plant N" goal progress) */
	placements?: any[];
	/** every Chest row in this world (for "collect N" goal progress) */
	chests?: any[];
	/** The CURRENT AREA's TerrainTile rows — not the world's, since the snapshot
	 *  stopped reading every area. Only a fallback now: the stream goal reads
	 *  `playerWater` off the biome rows, and reaches for these only for a biome
	 *  that has not been recalculated since that field existed. */
	terrain?: any[];
	now: number;
	/** The biomes the PLAYER personally unlocked — the reward/gather pool draws
	 *  only from these, never the wider roam set, so tasks stay specific to
	 *  what you've unlocked and the shown reward matches what's granted on claim. */
	unlockedBiomes?: string[];
}

/**
 * The pinned "next milestone" task, or null once every biome is unlocked.
 * Reads real progression state so the board always points at the thing that
 * actually moves the game forward. Claim-aware: a met step stays on the board
 * until its reward is claimed, then the following step surfaces immediately.
 */
function milestonePin(
	ctx: TaskCtx,
	dayKey: number,
	claims: Record<string, boolean>,
	daily: Record<string, number>,
	bundle: () => Record<string, number>,
): DailyTask | null {
	const { player, d, discoveries, biomeStates } = ctx;
	const bs = new Map(biomeStates.map((b: any) => [b.biomeId, b]));

	// 1) The grasshopper — the whole preserve starts here. Pinned until it's
	// home (and kept for the rest of that day so the reward can be claimed).
	const gh = discoveries.find((x: any) => x.animalId === FIRST_ANIMAL_ID);
	const welcomeId = `${dayKey}-welcome`;
	const welcomedToday = gh && playerDayKey(player, gh.firstObservedAt || ctx.now) === dayKey;
	if (!gh || (welcomedToday && !claims[welcomeId])) {
		return {
			id: welcomeId,
			kind: 'welcome',
			icon: 'sparkle',
			text: tr('server.task.welcomeGrasshopper'),
			target: 1,
			counter: '',
			reward: bundle(),
			hint: tr('server.task.welcomeGrasshopperHint'),
			live: gh ? 1 : 0,
		};
	}

	// 2) The next locked biome (the one whose prerequisite biome is already
	// unlocked): pin one SMALL step toward its first unmet requirement — a few
	// health points, a single animal, one craft — never the whole mountain.
	for (const biome of d.biomes) {
		const u = biome.unlock;
		if (!u || bs.get(biome.id)?.unlocked) continue;
		const prereq = bs.get(u.biome);
		if (!prereq?.unlocked) continue; // not the frontier yet
		const prereqName = d.biome.get(u.biome)?.name || u.biome;
		const steps: {
			step: string;
			icon: string;
			text: string;
			target: number;
			counter: string;
			live?: number;
			unmet: boolean;
		}[] = [];
		if (u.minHealth) {
			const remaining = Math.max(0, u.minHealth - (prereq.health || 0));
			const target = Math.max(1, Math.min(3, Math.ceil(remaining)));
			// "from X% to Y%" instead of "by N" — playtest: at 89% health, "raise
			// health by 3" read as ambiguous (3 what? out of what?).
			const current = Math.round(prereq.health || 0);
			steps.push({
				step: 'health',
				icon: 'leaf',
				unmet: remaining > 0,
				text: tr('server.task.raiseHealth', {
					biome: prereqName,
					count: target,
					current,
					goal: Math.min(100, current + target),
				}),
				target,
				counter: `health:${u.biome}`,
			});
		}
		if (u.minAnimals) {
			steps.push({
				step: 'animals',
				icon: 'sparkle',
				unmet: (prereq.returnedCount || 0) < u.minAnimals,
				text: tr('server.task.welcomeNewAnimal', { biome: prereqName }),
				target: 1,
				counter: `animal:${u.biome}`,
			});
		}
		if (u.minTotalAnimals) {
			steps.push({
				step: 'total',
				icon: 'journal',
				unmet: discoveries.length < u.minTotalAnimals,
				text: tr('server.task.welcomeAnyAnimal'),
				target: 1,
				counter: 'animal',
			});
		}
		if (u.requiresItem) {
			const itemName = d.object.get(u.requiresItem)?.name || u.requiresItem;
			const have = (player?.craftedItems?.[u.requiresItem] || 0) + (player?.craftedEver?.[u.requiresItem] || 0);
			steps.push({
				step: 'kit',
				icon: 'hammer',
				unmet: have <= 0,
				text: tr('server.task.craftKit', { item: itemName }),
				target: 1,
				counter: '',
				live: Math.min(1, have),
			});
		}
		for (const step of steps) {
			const id = `${dayKey}-goal-${biome.id}-${step.step}`;
			if (claims[id]) continue; // today's step claimed — surface the next one
			// a met requirement only lingers while today's progress awaits its claim
			const progressedToday = step.counter ? (daily[step.counter] || 0) > 0 : (step.live || 0) > 0;
			if (!step.unmet && !progressedToday) continue;
			return {
				id,
				kind: 'goal',
				icon: step.icon,
				text: step.text,
				target: step.target,
				counter: step.counter,
				reward: bundle(),
				...(step.counter ? {} : { live: step.live }),
			};
		}
		return null; // this unlock is fully handled — it fires on the next biome recalc
	}
	return null;
}

function dailyTasksFor(
	ctx: TaskCtx,
	claims: Record<string, boolean>,
	daily: Record<string, number>,
): { dayKey: number; endsAt: number; tasks: DailyTask[] } {
	const { wid, player, d, discoveries, now } = ctx;
	const discoveredCount = discoveries.length;
	const dayKey = playerDayKey(player, now);
	const endsAt = (dayKey + 1) * DAY_MS + TASK_RESET_HOUR * 3_600_000 - tzMs(player);
	const rng = seededRng(hash32(`tasks:${wid}:${dayKey}`));
	// Personal unlocked biomes only — NOT the roam-expanded set the snapshot
	// may carry — so the pool matches on both the snapshot and claim paths.
	const unlocked: string[] = ctx.unlockedBiomes?.length
		? ctx.unlockedBiomes
		: player?.unlockedBiomes?.length
			? player.unlockedBiomes
			: ['meadow'];
	// gatherable pool: solid materials from unlocked biomes (weather-gated
	// specials are excluded so a task never depends on the right sky)
	const resPool = [...new Set(unlocked.flatMap((id: string) => d.biome.get(id)?.resources || []))].filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && d.resource.get(r),
	);

	const pickFrom = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
	const bundle = (): Record<string, number> => {
		const out: Record<string, number> = {};
		const pool = [...resPool];
		for (let i = 0; i < 2 && pool.length; i++) {
			const r = pool.splice(Math.floor(rng() * pool.length), 1)[0];
			out[r] = 4 + Math.floor(rng() * 4); // 4–7 of each
		}
		return out;
	};

	const candidates: DailyTask[] = [];
	if (resPool.length) {
		const res = pickFrom(resPool);
		const target = [8, 12, 16][Math.floor(rng() * 3)];
		candidates.push({
			id: `${dayKey}-gather`,
			kind: 'gather',
			icon: 'basket',
			text: tr('server.task.gather', { count: target, resource: d.resource.get(res)?.name || res }),
			target,
			counter: `res:${res}`,
			reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-craft`,
			kind: 'craft',
			icon: 'hammer',
			text: tr('server.task.craft', { count: target }),
			target,
			counter: 'craft',
			reward: bundle(),
		});
	}
	{
		const target = 2 + Math.floor(rng() * 2);
		candidates.push({
			id: `${dayKey}-place`,
			kind: 'place',
			icon: 'pin',
			text: tr('server.task.place', { count: target }),
			target,
			counter: 'place',
			reward: bundle(),
		});
	}
	{
		const target = 3 + Math.floor(rng() * 3);
		candidates.push({
			id: `${dayKey}-water`,
			kind: 'water',
			icon: 'drop',
			text: tr('server.task.water', { count: target }),
			target,
			counter: 'water',
			reward: bundle(),
		});
	}
	candidates.push({
		id: `${dayKey}-plant`,
		kind: 'plant',
		icon: 'leaf',
		text: tr('server.task.plantBeds'),
		target: 2,
		counter: 'plant',
		reward: bundle(),
	});
	if (discoveredCount >= 3) {
		candidates.push({
			id: `${dayKey}-observe`,
			kind: 'observe',
			icon: 'journal',
			text: tr('server.task.observe'),
			target: 3,
			counter: 'observe',
			reward: bundle(),
		});
	}

	// seeded shuffle → the day's filler rotation
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}

	// Day one is always the same gentle on-ramp — the exact loop that brings
	// the meadow (and the game) to life. Fixed for the whole first day.
	const firstDay = playerDayKey(player, player?.createdAt || now) === dayKey;
	if (firstDay) {
		const grasshopperHome = discoveries.some((x: any) => x.animalId === FIRST_ANIMAL_ID);
		return {
			dayKey,
			endsAt,
			tasks: [
				{
					id: `${dayKey}-welcome`,
					kind: 'welcome',
					icon: 'sparkle',
					text: tr('server.task.welcomeGrasshopper'),
					target: 1,
					counter: '',
					reward: bundle(),
					hint: tr('server.task.welcomeGrasshopperHint'),
					live: grasshopperHome ? 1 : 0,
				},
				{
					id: `${dayKey}-gather`,
					kind: 'gather',
					icon: 'basket',
					text: tr('server.task.collectSeeds'),
					target: 10,
					counter: 'res:seeds',
					reward: bundle(),
				},
				{
					id: `${dayKey}-plant`,
					kind: 'plant',
					icon: 'leaf',
					text: tr('server.task.plantThree'),
					target: 3,
					counter: 'plant',
					reward: bundle(),
				},
			],
		};
	}

	// From day two: pin the player's real next milestone first, fill with rotation.
	const pin = milestonePin(ctx, dayKey, claims, daily, bundle);
	const tasks = pin ? [pin, ...candidates.slice(0, 2)] : candidates.slice(0, 3);
	return { dayKey, endsAt, tasks };
}

// ---- player-authored goals (the custom task list) -------------------------
// The board is the player's OWN list now: the ten-goal starter chain that teaches the
// core loop, then whatever goals the player builds. Progress is read from
// durable world state (not the day counters, which reset), claims are permanent
// (player.goalClaims), and each finished goal grants one small fixed bundle.

type GoalKind =
	| 'craft'
	| 'build'
	| 'grow'
	| 'plant'
	| 'collect'
	| 'observe'
	| 'welcome'
	| 'attract'
	| 'welcomeTotal'
	| 'home'
	| 'tool'
	| 'unlock'
	| 'health'
	| 'biomeAnimals';
export interface CustomGoal {
	id: string;
	kind: GoalKind;
	target: number;
	itemId?: string;
	resourceId?: string;
	animalId?: string;
	track?: string;
	styleId?: string;
	toolId?: string;
	biomeId?: string;
	/** The metric value at the moment the goal was created. Progress for the
	 *  cumulative kinds (craft/build/plant/collect/observe) is measured as NEW work
	 *  done SINCE this baseline, so a fresh goal starts at 0 instead of instantly
	 *  completing off past progress. */
	base?: number;
	/** Second baseline for 'build' goals — the placed count at creation (base
	 *  tracks crafting, basePlace tracks placing). */
	basePlace?: number;
}

const GOAL_ICON: Record<GoalKind, string> = {
	craft: 'hammer',
	build: 'hammer',
	grow: 'leaf',
	plant: 'leaf',
	collect: 'basket',
	observe: 'journal',
	welcome: 'paw',
	attract: 'paw',
	welcomeTotal: 'paw',
	home: 'home',
	tool: 'hammer',
	unlock: 'map',
	health: 'leaf',
	biomeAnimals: 'paw',
};
const GOAL_HOME_TRACKS = ['space', 'comfort', 'decor', 'light'];
export const MAX_CUSTOM_GOALS = 6; // hard ceiling; the live cap is 3 (or 6 fully unlocked)

/** How many custom goals a player may hold at once: 3 while biomes remain to
 *  unlock, 6 once the whole preserve is open. */
export function goalLimitFor(player: any, d: any): number {
	const unlocked = new Set(player?.unlockedBiomes || ['meadow']);
	const allOpen = d.biomes.filter((b: any) => b.explorable).every((b: any) => unlocked.has(b.id));
	return allOpen ? 6 : 3;
}

/** The always-on "unlock the next biome" guidance goal: the frontier locked
 *  biome (its prerequisite is open) with each unlock requirement as a checkbox.
 *  Pinned + non-claimable; disappears once every biome is unlocked. */
function nextBiomeGoal(ctx: TaskCtx): any | null {
	const { d, biomeStates, discoveries, player } = ctx;
	const bs = new Map(biomeStates.map((b: any) => [b.biomeId, b]));
	for (const biome of d.biomes) {
		const u: any = biome.unlock;
		if (!u || bs.get(biome.id)?.unlocked) continue;
		const prereq = bs.get(u.biome);
		if (!prereq?.unlocked) continue; // not the frontier yet
		// You only get "unlock the next area" guidance once you've actually walked
		// through the gate into its prerequisite biome — arriving there is what
		// surfaces what's next, not merely unlocking it (the meadow counts as
		// visited from the start, so the very first goal still shows immediately).
		if (!(player?.visitedBiomes || ['meadow']).includes(u.biome)) continue;
		const prereqName = d.biome.get(u.biome)?.name || u.biome;
		const name = d.biome.get(biome.id)?.name || biome.id;
		const steps: { text: string; done: boolean }[] = [];
		if (u.minHealth)
			steps.push({
				text: tr('server.nextbiome.health', {
					biome: prereqName,
					goal: u.minHealth,
					cur: Math.round(prereq.health || 0),
				}),
				done: (prereq.health || 0) >= u.minHealth,
			});
		if (u.minAnimals)
			steps.push({
				text: tr('server.nextbiome.animals', { biome: prereqName, goal: u.minAnimals, cur: prereq.returnedCount || 0 }),
				done: (prereq.returnedCount || 0) >= u.minAnimals,
			});
		if (u.minTotalAnimals)
			steps.push({
				text: tr('server.nextbiome.total', { goal: u.minTotalAnimals, cur: discoveries.length }),
				done: discoveries.length >= u.minTotalAnimals,
			});
		if (u.requiresItem) {
			const item = d.object.get(u.requiresItem)?.name || u.requiresItem;
			const have = (player?.craftedItems?.[u.requiresItem] || 0) + (player?.craftedEver?.[u.requiresItem] || 0);
			steps.push({ text: tr('server.nextbiome.craft', { item }), done: have > 0 });
		}
		if (!steps.length) return null;
		const done = steps.filter((s) => s.done).length;
		return {
			id: 'next-biome',
			kind: 'unlock',
			icon: 'map',
			pinned: true,
			text: tr('server.nextbiome.title', { biome: name }),
			hint: tr('server.nextbiome.hint', { biome: name }),
			target: steps.length,
			progress: done,
			counter: '',
			reward: {},
			steps,
			claimed: false,
		};
	}
	return null;
}

/** Habitat checklist for an "attract {animal}" goal: each required object with
 *  how many are placed vs needed, plus a health step if the animal needs it. */
function attractSteps(animalId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	const a = ctx.d.animal.get(animalId);
	if (!a) return [];
	// Gated by the EXPANDED guide for this animal's area: the exact checklist is
	// what that edition is for, in the journal and here alike (same rule both
	// places — see hasExpandedGuide).
	//
	// Without it the goal is not blank. It carries the caretaker's hint — the
	// plain-language "leave a little brush at the edge" line every animal has —
	// and then says where the exact list comes from. A goal you set yourself
	// should always tell you something about how to finish it; "go buy a book"
	// on its own is a locked door with your own goal behind it.
	if (!hasExpandedGuide(ctx.player, a.biome)) {
		const steps: { text: string; done: boolean }[] = [];
		// The hint rides through as written in the definitions, the same way the
		// habitat steps below carry raw object names: the server bundle registers
		// only the `server` catalog, so animal content text isn't translatable here.
		const hint = a.requirements?.hint;
		if (hint) steps.push({ text: hint, done: false });
		steps.push({ text: tr('server.goal.upgradeGuide'), done: false });
		return steps;
	}
	const steps: { text: string; done: boolean }[] = [];
	for (const [oid, need] of Object.entries(a.requirements?.objects || {})) {
		const have = (ctx.placements || []).filter((p: any) => p.objectId === oid && p.area === a.biome).length;
		steps.push({
			text: tr('server.goal.habitatStep', {
				have: Math.min(have, need as number),
				need: need as number,
				name: ctx.d.object.get(oid)?.name || oid,
			}),
			done: have >= (need as number),
		});
	}
	if (a.requirements?.minHealth) {
		const b = ctx.biomeStates.find((x: any) => x.biomeId === a.biome);
		const cur = Math.round(b?.health || 0);
		steps.push({
			text: tr('server.goal.healthStep', { cur, need: a.requirements.minHealth }),
			done: cur >= a.requirements.minHealth,
		});
	}
	return steps;
}

/** Materials-you-have vs materials-needed for a craft/build goal's recipe,
 *  shown in the goal's hover info box. */
function craftMaterialSteps(itemId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	const recipe = (ctx.d.recipes || []).find((r: any) => r.output?.itemId === itemId);
	return matSteps(recipe?.materials || {}, ctx);
}

/** Materials have/need for building a specific house style. */
function homeBuildSteps(styleId: string, ctx: TaskCtx): { text: string; done: boolean }[] {
	return matSteps(HOME_STYLES[styleId]?.materials || {}, ctx);
}

/** Materials have/need for upgrading a tool to its goal tier. */
function toolUpgradeSteps(toolId: string, tier: number, ctx: TaskCtx): { text: string; done: boolean }[] {
	const td = ctx.d.tool.get(toolId);
	const tierDef = (td?.tiers || []).find((tt: any) => tt.tier === tier);
	return matSteps(tierDef?.materials || {}, ctx);
}

/** Shared "have/need material" checklist. */
function matSteps(mats: Record<string, number>, ctx: TaskCtx): { text: string; done: boolean }[] {
	return Object.entries(mats).map(([mid, need]) => {
		const have = heldAmount(ctx, mid);
		return {
			text: tr('server.goal.matStep', { have: Math.min(have, need), need, name: ctx.d.resource.get(mid)?.name || mid }),
			done: have >= need,
		};
	});
}

/** Staple materials from the player's unlocked biomes (no water / weather specials). */
function goalRewardPool(ctx: TaskCtx): string[] {
	const unlocked: string[] = ctx.unlockedBiomes?.length
		? ctx.unlockedBiomes
		: ctx.player?.unlockedBiomes?.length
			? ctx.player.unlockedBiomes
			: ['meadow'];
	const all = unlocked.flatMap((id: string) => (ctx.d.biome.get(id)?.resources || []) as string[]);
	return [...new Set<string>(all)].filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && ctx.d.resource.get(r),
	);
}
/** A small, deterministic-per-key reward bundle for a finished goal. */
function goalReward(ctx: TaskCtx, key: string): Record<string, number> {
	const pool = goalRewardPool(ctx);
	const out: Record<string, number> = {};
	if (!pool.length) return out;
	const rng = seededRng(hash32(`goalreward:${key}`));
	const p = [...pool];
	for (let i = 0; i < 2 && p.length; i++) {
		const r = p.splice(Math.floor(rng() * p.length), 1)[0];
		out[r] = 3 + Math.floor(rng() * 3); // 3–5 each — deliberately small
	}
	return out;
}

/** One-time "welcome bundle" for freshly unlocking a biome: a couple of THAT
 *  biome's own resources (the next area), deterministic per biome so the reward
 *  shown on the board equals the reward granted on claim. */
function unlockBundle(ctx: TaskCtx, biomeId: string): Record<string, number> {
	const pool = ((ctx.d.biome.get(biomeId)?.resources || []) as string[]).filter(
		(r) => r !== 'water' && !isWeatherGatheredResource(r) && ctx.d.resource.get(r),
	);
	const out: Record<string, number> = {};
	if (!pool.length) return out;
	const rng = seededRng(hash32(`unlockreward:${biomeId}`));
	const p = [...pool];
	for (let i = 0; i < 2 && p.length; i++) {
		const r = p.splice(Math.floor(rng() * p.length), 1)[0];
		out[r] = 4 + Math.floor(rng() * 3); // 4–6 each — a small welcome to the new area
	}
	return out;
}

/** How much of a resource the player is holding, basket + all chests. */
function heldAmount(ctx: TaskCtx, resId: string): number {
	const inv = ctx.player?.inventory?.[resId] || 0;
	const inChests = (ctx.chests || []).reduce((s: number, c: any) => s + (c.contents?.[resId] || 0), 0);
	return inv + inChests;
}

/** How many of a given object are placed in the world right now. */
export function placedCountFor(ctx: TaskCtx, objectId: string): number {
	return (ctx.placements || []).filter((p: any) => p.objectId === objectId).length;
}

/** How many of a given plantable object have been planted (placement + plantedAt). */
function plantedCountFor(ctx: TaskCtx, objectId: string): number {
	return (ctx.placements || []).filter((p: any) => p.objectId === objectId && typeof p.plantedAt === 'number').length;
}

/** The raw, absolute metric a goal tracks (before the baseline is subtracted). */
export function goalMetric(goal: CustomGoal, ctx: TaskCtx): number {
	switch (goal.kind) {
		case 'craft':
		case 'build':
			return ctx.player?.craftedEver?.[goal.itemId || ''] || 0;
		case 'grow':
			return plantedCountFor(ctx, goal.itemId || '');
		case 'plant':
			return (ctx.placements || []).filter((p: any) => typeof p.plantedAt === 'number').length;
		case 'collect':
			return heldAmount(ctx, goal.resourceId || '');
		case 'observe':
			return ctx.discoveries.filter((x: any) => (x.timesObserved || 0) > 0).length;
		case 'welcomeTotal':
			return ctx.discoveries.length;
		default:
			return 0;
	}
}

/** Live progress for one player-set goal, read from durable world state.
 *  Cumulative kinds count only NEW work since the goal's baseline, so a freshly
 *  added goal never starts already-complete. */
function goalProgress(goal: CustomGoal, ctx: TaskCtx): number {
	switch (goal.kind) {
		case 'craft':
		case 'grow':
		case 'plant':
		case 'collect':
		case 'observe':
		case 'welcomeTotal':
			return Math.max(0, Math.min(goal.target, goalMetric(goal, ctx) - (goal.base || 0)));
		case 'build': {
			// Two steps per object: crafting it counts halfway, placing it completes.
			// Progress is out of target*2 (see the board's target below).
			const crafted = Math.max(
				0,
				Math.min(goal.target, (ctx.player?.craftedEver?.[goal.itemId || ''] || 0) - (goal.base || 0)),
			);
			const placed = Math.max(0, Math.min(goal.target, placedCountFor(ctx, goal.itemId || '') - (goal.basePlace || 0)));
			return crafted + placed;
		}
		case 'welcome':
		case 'attract':
			return ctx.discoveries.some((x: any) => x.animalId === goal.animalId) ? 1 : 0;
		case 'home':
			if (goal.track === 'build') {
				const h = ctx.player?.home;
				if (!h?.styleLocked) return 0;
				return !goal.styleId || h.style === goal.styleId ? 1 : 0; // that house (or any, if unspecified)
			}
			return (ctx.player?.home?.[goal.track || ''] as number) >= goal.target
				? goal.target
				: Math.min(goal.target, (ctx.player?.home?.[goal.track || ''] as number) || 1);
		case 'tool': {
			// Target is the goal's tier; progress is the tool's current tier, capped.
			const cur = (ctx.player?.tools?.[goal.toolId || ''] as number) || 1;
			return Math.min(goal.target, cur);
		}
		case 'unlock':
			return ctx.biomeStates.some((b: any) => b.biomeId === goal.biomeId && b.unlocked) ? 1 : 0;
		case 'health': {
			const b = ctx.biomeStates.find((x: any) => x.biomeId === goal.biomeId);
			return Math.min(goal.target, Math.round(b?.health || 0));
		}
		case 'biomeAnimals': {
			const ret = ctx.discoveries.filter((d: any) => d.biomeId === goal.biomeId).length;
			return Math.min(goal.target, ret);
		}
		default:
			return 0;
	}
}

/** Localized board label for a goal. */
function goalText(goal: CustomGoal, ctx: TaskCtx): string {
	const d = ctx.d;
	switch (goal.kind) {
		case 'craft':
			return tr('server.goal.craft', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'build':
			return tr('server.goal.build', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'grow':
			return tr('server.goal.grow', { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
		case 'plant':
			return tr('server.goal.plant', { count: goal.target });
		case 'collect':
			return tr('server.goal.collect', {
				count: goal.target,
				resource: d.resource.get(goal.resourceId)?.name || goal.resourceId,
			});
		case 'observe':
			return tr('server.goal.observe', { count: goal.target });
		case 'welcome':
			return tr('server.goal.welcome', { animal: d.animal.get(goal.animalId)?.name || goal.animalId });
		case 'attract':
			return tr('server.goal.attract', { kind: d.animal.get(goal.animalId)?.kind || tr('server.goal.creature') });
		case 'welcomeTotal':
			return tr('server.goal.welcomeTotal', { count: goal.target });
		case 'home':
			return goal.track === 'build'
				? tr('server.goal.buildHome', { style: HOME_STYLES[goal.styleId || '']?.name || tr('server.goal.aHouse') })
				: tr('server.goal.home', { track: tr(`server.goal.track.${goal.track}`), level: goal.target });
		case 'tool': {
			const td = d.tool.get(goal.toolId);
			const tier = (td?.tiers || []).find((tt: any) => tt.tier === goal.target);
			return tr('server.goal.tool', { tool: tier?.name || td?.name || goal.toolId });
		}
		case 'unlock':
			return tr('server.goal.unlock', { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId });
		case 'health':
			return tr('server.goal.restore', { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId, pct: goal.target });
		case 'biomeAnimals':
			return tr('server.goal.biomeAnimals', {
				count: goal.target,
				biome: d.biome.get(goal.biomeId)?.name || goal.biomeId,
			});
		default:
			return '';
	}
}

/**
 * The starter chain: ten fixed goals that open the game, shown ONE AT A TIME.
 *
 * Each link is a different verb — gather, craft-and-place, welcome, plant,
 * harvest, welcome again (a whole group this time), upgrade, build at volume,
 * shape the land, build a home — so
 * a player who follows the chain has touched every core mechanic once by the end
 * of it. No link repeats another's motion: watering, for instance, is not its own
 * goal because you cannot plant without doing it, and a goal for something the
 * player has already had to do reads as filler.
 *
 * The order is a dependency chain, not a difficulty ramp. The grasshopper is
 * third because it is the game's first real reward and the whole premise —
 * animals come home when the habitat is right — and it needs exactly what the
 * two goals before it produce: a crafted grass patch, placed. Harvest follows
 * planting because it needs something grown. The bugs goal sits where a planted,
 * flowering meadow has started drawing small neighbors in on its own.
 *
 * The finale is deliberate: shaping open water is the most advanced thing the
 * land lets you do, and building a house is the biggest thing you can make.
 *
 * Only one is on the board at a time (see dailyTasksBlock) — claiming reveals
 * the next. Ten visible at once reads as a chore list; one reads as the next
 * thing to do. Finishing all ten is what unlocks player-authored goals.
 *
 * Progress comes from durable world state wherever possible (held materials,
 * placements and their harvest stamps, discoveries, tool tiers, terrain, the home
 * row) so it survives a reload and cannot be replayed. The one exception is
 * `objectsPlaced`, a lifetime counter: the seeded camp tent and chest are
 * placements too, so counting live rows would hand the player two free steps
 * they never took.
 */
function starterTasks(ctx: TaskCtx): any[] {
	const counts = (readMetrics(ctx.player)?.counts || {}) as Record<string, number>;
	const placed = counts.objectsPlaced || 0;
	const grasshopper = ctx.discoveries.some((x: any) => x.animalId === FIRST_ANIMAL_ID);
	const planted = (ctx.placements || []).filter((p: any) => typeof p.plantedAt === 'number').length;
	const harvested = (ctx.placements || []).some((p: any) => typeof p.lastHarvestAt === 'number');
	// "Bugs" in the way a caretaker means it: the small crawling, flying, creeping
	// neighbors. The definitions split `kind` into 'insect' (grasshopper, ladybug,
	// bumblebee) and 'invertebrate' (snail, pillbug, garden spider) for display;
	// both are bugs to a player, and splitting them here would make the goal a
	// puzzle about the data model rather than about the meadow.
	//
	// The grasshopper from three goals earlier counts, so this arrives at 1/3 and
	// asks for two more — a visible head start rather than a fresh zero.
	const bugs = ctx.discoveries.filter((x: any) => BUG_KINDS.has(ctx.d?.animal?.get(x.animalId)?.kind)).length;
	// The opening chain is a tour of the meadow, so the guide it asks for is the
	// meadow's — the cheap one, buyable from meadow materials alone.
	const meadowGuide = hasGuide(ctx.player, 'meadow');
	// Largest connected body of water the PLAYER shaped — the seeded channels the
	// wetland ships with are excluded, so a stream has to be dug, not inherited.
	// Largest body of player-shaped water anywhere in the preserve, read off the
	// biome rows rather than recomputed from every tile in the world.
	//
	// recalcBiome stores `playerWater` per biome, from the authoritative terrain
	// list it already holds. Taking the max across biomes is not an approximation
	// of the old whole-world analyzeWater — it is strictly better: water bodies
	// cannot span biomes (each is its own board), but the old call keyed cells by
	// `${x},${y}` with every area's tiles in one set, so two separate ponds at the
	// same coordinates in different biomes merged into one imaginary lake.
	//
	// `ctx.terrain` is the fallback for a biome not yet recalculated since this
	// field existed. It covers the area the player is standing in, which in the
	// starter chain is the meadow this goal is about.
	const water = { tiles: 0, lake: 0, river: 0 };
	for (const bs of ctx.biomeStates || []) {
		const w =
			bs?.playerWater ||
			(ctx.terrain?.some((tt: any) => tt.area === bs?.biomeId)
				? analyzeWater(
						ctx.terrain.filter((tt: any) => tt.area === bs.biomeId),
						true,
					)
				: null);
		if (!w) continue;
		water.tiles += w.tiles || 0;
		water.lake = Math.max(water.lake, w.lake || 0);
		water.river = Math.max(water.river, w.river || 0);
	}
	return [
		{
			id: 'start-seeds',
			kind: 'gather',
			icon: 'basket',
			text: tr('server.starter.seeds', { count: STARTER_SEEDS }),
			hint: tr('server.task.gatherHint'),
			target: STARTER_SEEDS,
			progress: Math.min(STARTER_SEEDS, counts[`${META_COUNTER_PREFIX}seeds`] || 0),
			// `event` + `resourceId` let the client credit a pickup the moment it
			// happens rather than at the next full sync — the very first goal in the
			// game used to sit at 0/10 while seeds visibly piled up, which reads as a
			// broken counter. Monotonic because it counts gathering, not holding: the
			// bar must not fall back when those seeds get planted.
			resourceId: 'seeds',
			base: 0,
			monotonic: true,
			event: 'gather',
		},
		{
			id: 'start-grasshopper',
			kind: 'welcome',
			icon: 'sparkle',
			text: tr('server.task.welcomeGrasshopper'),
			hint: tr('server.task.welcomeGrasshopperHint'),
			target: 1,
			progress: grasshopper ? 1 : 0,
		},
		{
			id: 'start-plant',
			kind: 'plant',
			icon: 'leaf',
			text: tr('server.starter.plant', { count: 3 }),
			hint: tr('server.starter.plantHint'),
			target: 3,
			progress: Math.min(3, planted),
		},
		{
			id: 'start-harvest',
			kind: 'gather',
			icon: 'basket',
			text: tr('server.starter.harvest'),
			hint: tr('server.starter.harvestHint'),
			target: 1,
			progress: harvested ? 1 : 0,
		},
		{
			id: 'start-bugs',
			kind: 'welcome',
			icon: 'paw',
			text: tr('server.starter.bugs', { count: STARTER_BUGS }),
			hint: tr('server.starter.bugsHint'),
			target: STARTER_BUGS,
			progress: Math.min(STARTER_BUGS, bugs),
		},
		{
			id: 'start-journal-upgrade',
			kind: 'goal',
			icon: 'journal',
			text: tr('server.starter.journal'),
			hint: tr('server.starter.journalHint'),
			target: 1,
			progress: meadowGuide ? 1 : 0,
		},
		{
			id: 'start-build-ten',
			kind: 'place',
			icon: 'hammer',
			text: tr('server.starter.buildTen', { count: STARTER_PLACE_TOTAL }),
			hint: tr('server.starter.buildTenHint'),
			target: STARTER_PLACE_TOTAL,
			progress: Math.min(STARTER_PLACE_TOTAL, placed),
			// Credited the moment the thing lands in the world, not at the next sync:
			// the player watched themselves put it down, so the bar moving a second
			// later reads as the game missing it. Counts placements, so crafting
			// something and leaving it in the basket is not enough — it has to be out
			// there, which is what makes a habitat.
			monotonic: true,
			event: 'place',
		},
		{
			// Craft a sleeping bag, put it in the tent, sleep in it: crafting, placing
			// indoors, and resting in one small errand. It sits late on purpose — a
			// night's sleep refreshes every gathering spot, which is worth most to a
			// caretaker who has just spent their materials on ten placed things and is
			// about to need more for a stream.
			//
			// The recipe was gated behind welcoming the ground squirrel, which put this
			// goal behind an animal that arrives on its own schedule. It ships ungated
			// (four fiber, see data/recipes.json) — a caretaker sleeping rough until a
			// squirrel turns up was never the intent.
			id: 'start-rest',
			kind: 'goal',
			icon: 'home',
			text: tr('server.starter.rest'),
			hint: tr('server.starter.restHint'),
			target: 1,
			progress: (counts.restsTaken || 0) > 0 ? 1 : 0,
		},
		{
			id: 'start-stream',
			kind: 'water',
			icon: 'can',
			text: tr('server.starter.stream'),
			hint: tr('server.starter.streamHint'),
			target: STARTER_STREAM_TILES,
			progress: Math.min(STARTER_STREAM_TILES, water.lake || 0),
		},
		{
			id: 'start-home',
			kind: 'goal',
			icon: 'home',
			text: tr('server.starter.home'),
			hint: tr('server.starter.homeHint'),
			target: 1,
			progress: ctx.player?.home?.styleLocked ? 1 : 0,
		},
	];
}

/** The definition `kind`s a player would call a bug. */
const BUG_KINDS = new Set(['invertebrate', 'insect']);

/** How many links of the chain are on the board at once. */
const STARTER_VISIBLE = 3;

/** Sizes for the chain's counted goals. */
const STARTER_SEEDS = 10;
const STARTER_BUGS = 3;
const STARTER_PLACE_TOTAL = 10;
/** Connected open-water tiles that count as "a stream" — small enough to dig in
 *  one sitting (each tile is a dig plus two waterings), big enough that the
 *  player has to chain them and see a channel appear rather than a puddle. */
const STARTER_STREAM_TILES = 3;

/**
 * The three starter ids the SHIPPED build used. Nothing writes them any more —
 * they exist purely as the marker for "this save finished the old chain".
 *
 * A save that claimed all three was already past its onboarding, and dropping
 * seven tutorial goals onto a board that has been running for weeks is noise, so
 * those saves skip the chain entirely (and keep their custom goals unlocked,
 * since `startersDone` on the client is simply "no start-* task on the board").
 * The ids in the new chain are all fresh, so no new player can ever accidentally
 * satisfy this test.
 */
const LEGACY_STARTER_IDS = ['start-gather', 'start-craft', 'start-welcome'];

/** Did this save finish the pre-chain starters? Then it never sees the chain. */
function starterChainRetired(player: any): boolean {
	const claims: Record<string, boolean> = player?.goalClaims || {};
	return LEGACY_STARTER_IDS.every((id) => claims[id]);
}

/**
 * The chain's ids, in order. Derived from the chain itself rather than written
 * out a second time, so a goal renamed or reordered can't quietly desync the
 * funnel from the thing it measures. The dummy context is safe because every
 * field starterTasks() reads is optional-with-a-default; only the ids are used.
 */
export function starterTaskIds(): string[] {
	return starterTasks({ player: {}, discoveries: [], biomeStates: [] } as any).map((s: any) => s.id);
}

/**
 * Where one save is in the opening, for the metrics roll-up.
 *
 * The whole point of the chain is to hand the board over: ten goals that teach
 * the game and then get out of the way. So the number that matters is not how
 * many players finished it — it's how many went on to write a goal of their own
 * afterwards, which is the behavior the chain is trying to produce. `step` is
 * where the rest stalled, and it's the only way to tell "quit the game" from
 * "stuck on Build a home".
 *
 * All of it is read from data the save already stores (goalClaims, and the
 * goalsCreated counter), so it costs nothing and works retroactively.
 */
export function starterChainMetrics(player: any) {
	const claims: Record<string, boolean> = player?.goalClaims || {};
	const ids = starterTaskIds();
	const claimed = ids.filter((id) => claims[id]).length;
	const retired = starterChainRetired(player);
	return {
		// 0-10, or 10 for a save that finished the old three-goal opening — those
		// never see the chain, so counting them as stalled at 0 would be a lie.
		starterStep: retired ? ids.length : claimed,
		starterTotal: ids.length,
		starterDone: retired || claimed >= ids.length,
		/** Pre-chain save: its step is inferred, not observed. */
		starterLegacy: retired,
		/** Goals the player wrote themselves, ever (see SetGoals). */
		goalsCreated: (readMetrics(player)?.counts?.goalsCreated as number) || 0,
	};
}

/** Validate + normalize a player-submitted goal list (rewards + baselines are
 *  never client-supplied — they're derived server-side). Existing ids are kept so
 *  SetGoals can preserve each goal's baseline across edits. */
export function sanitizeGoals(goals: any[], d: any): CustomGoal[] {
	const out: CustomGoal[] = [];
	const kinds: GoalKind[] = [
		'craft',
		'build',
		'grow',
		'plant',
		'collect',
		'observe',
		'welcome',
		'attract',
		'welcomeTotal',
		'home',
		'tool',
		'unlock',
		'health',
		'biomeAnimals',
	];
	let hasHome = false; // only one home goal (build or upgrade) at a time
	for (const g of Array.isArray(goals) ? goals : []) {
		if (out.length >= MAX_CUSTOM_GOALS) break;
		const kind = g?.kind as GoalKind;
		if (!kinds.includes(kind)) continue;
		if (kind === 'home') {
			if (hasHome) continue;
			hasHome = true;
		}
		const id = typeof g?.id === 'string' && g.id ? g.id.slice(0, 40) : `cg_${Math.random().toString(36).slice(2, 10)}`;
		const target = Math.max(1, Math.min(99, Math.floor(Number(g?.target) || 1)));
		const goal: CustomGoal = { id, kind, target };
		if (kind === 'craft' || kind === 'build' || kind === 'grow') {
			if (!d.object.get(g?.itemId)) continue;
			goal.itemId = g.itemId;
		} else if (kind === 'collect') {
			if (!d.resource.get(g?.resourceId)) continue;
			goal.resourceId = g.resourceId;
		} else if (kind === 'welcome' || kind === 'attract') {
			if (!d.animal.get(g?.animalId)) continue;
			goal.animalId = g.animalId;
			goal.target = 1;
		} else if (kind === 'home') {
			if (g?.track === 'build') {
				if (!HOME_STYLES[g?.styleId]) continue; // must name a real house style
				goal.track = 'build';
				goal.styleId = g.styleId;
				goal.target = 1;
			} else {
				if (!GOAL_HOME_TRACKS.includes(g?.track)) continue;
				goal.track = g.track;
			}
		} else if (kind === 'tool') {
			const td = d.tool.get(g?.toolId);
			if (!td) continue; // must name a real tool
			const maxTier = Math.max(1, ...(td.tiers || []).map((tt: any) => tt.tier));
			// Target is the tier to reach: at least tier 2, never past the tool's max.
			goal.toolId = g.toolId;
			goal.target = Math.min(maxTier, Math.max(2, Math.floor(Number(g?.target) || 2)));
		} else if (kind === 'unlock') {
			if (!d.biome.get(g?.biomeId)) continue;
			goal.biomeId = g.biomeId;
			goal.target = 1;
		} else if (kind === 'health') {
			if (!d.biome.get(g?.biomeId)) continue; // real biome only
			goal.biomeId = g.biomeId;
			goal.target = Math.max(1, Math.min(100, Math.floor(Number(g?.target) || 100)));
		} else if (kind === 'biomeAnimals') {
			if (!d.biome.get(g?.biomeId)) continue;
			// Target is authoritative: every animal that can live in that biome.
			const n = d.animals.filter((a: any) => a.biome === g.biomeId).length;
			if (n <= 0) continue;
			goal.biomeId = g.biomeId;
			goal.target = n;
		}
		out.push(goal);
	}
	return out;
}

/** The on-screen board: the current starter (one at a time), then the player's own goal list. */
export function dailyTasksBlock(ctx: TaskCtx) {
	const { player, now, d } = ctx;
	const dayKey = playerDayKey(player, now);
	const goalClaims: Record<string, boolean> = player?.goalClaims || {};
	const tasks: any[] = [];
	const pendingUnlock = (player?.pendingUnlockRewards || []) as string[];
	// The always-on "unlock the next biome" guidance (with its checklist) leads
	// the board — but NOT while a welcome bundle is still waiting to be claimed.
	// Freshly unlocking a biome should feel like an arrival, so we hold back any
	// mention of the *next* biome until the player claims their bundle.
	if (!pendingUnlock.length) {
		const nb = nextBiomeGoal(ctx);
		if (nb) tasks.push(nb);
	}
	// A just-unlocked biome shows a one-time, CLAIMABLE welcome bundle (a couple
	// of that new area's resources) — it flags the unlock in the task bar and the
	// player has to claim it. Cleared from player.pendingUnlockRewards on claim.
	for (const bid of pendingUnlock) {
		const bname = d.biome.get(bid)?.name || bid;
		tasks.push({
			id: `unlock-reward:${bid}`,
			kind: 'unlock',
			icon: 'sparkle',
			text: tr('server.unlockreward.title', { biome: bname }),
			hint: tr('server.unlockreward.hint', { biome: bname }),
			target: 1,
			progress: 1,
			counter: '',
			reward: unlockBundle(ctx, bid),
			claimed: false,
		});
	}
	// Then the starter chain — the next STARTER_VISIBLE unclaimed links, in order,
	// sitting under the pinned biome goal. Claiming one pulls the following link up
	// into the empty slot (the client refreshes state after a claim), so the board
	// always shows the same short horizon instead of a ten-item backlog.
	//
	// Three rather than one because a single goal gives a player nothing to do when
	// the current one is gated on something slow — a plant maturing, an animal
	// deciding to come home. Three is enough to always have a move available and
	// still few enough to read as "what's next" rather than a chore list.
	if (!starterChainRetired(player)) {
		const next = starterTasks(ctx)
			.filter((s) => !goalClaims[s.id])
			.slice(0, STARTER_VISIBLE);
		for (const s of next) tasks.push({ ...s, counter: '', reward: goalReward(ctx, s.id), claimed: false });
	}
	// Finally, the player's own goals.
	for (const g of (player?.customGoals || []) as CustomGoal[]) {
		if (goalClaims[g.id]) continue;
		// build goals have two steps per object (craft + place), so the bar runs to
		// twice the object count.
		const target = g.kind === 'build' ? g.target * 2 : g.target;
		// Hover-box checklists: attract → the animal's habitat pieces; craft/build →
		// the recipe's materials (have vs needed).
		const steps =
			g.kind === 'attract'
				? attractSteps(g.animalId || '', ctx)
				: g.kind === 'craft' || g.kind === 'build'
					? craftMaterialSteps(g.itemId || '', ctx)
					: g.kind === 'home' && g.track === 'build'
						? homeBuildSteps(g.styleId || '', ctx)
						: g.kind === 'tool'
							? toolUpgradeSteps(g.toolId || '', g.target, ctx)
							: undefined;
		tasks.push({
			id: g.id,
			kind: g.kind,
			icon: GOAL_ICON[g.kind] || 'check',
			text: goalText(g, ctx),
			target,
			// A "collect N of X" goal counts held materials, so the client can keep it
			// live between syncs (withHeldTaskProgress). The baseline rides along
			// because progress is what has been gathered SINCE the goal was set.
			...(g.kind === 'collect' ? { resourceId: g.resourceId, base: g.base || 0 } : {}),
			counter: '',
			reward: goalReward(ctx, g.id),
			progress: goalProgress(g, ctx),
			claimed: false,
			hint: tr(`server.goal.hint.${g.kind}`),
			...(steps ? { steps } : {}),
		});
	}
	return { dayKey, endsAt: 0, tasks };
}

export async function snapshot(playerId: string, opts: { worldId?: string } = {}) {
	const t = db();
	const d = await defs();
	let player = await getPlayer(playerId);
	// normalize saves whose last area no longer exists / isn't explorable — but the
	// home interior ('home') and trail-tent interiors ('tent-<biome>') are valid
	// non-biome areas, so leave those be (as long as the tent's biome still is).
	const areaBiome = d.biome.get(player?.area);
	const tentB = tentBiomeOf(player?.area);
	const validTent = tentB ? !!d.biome.get(tentB)?.explorable : false;
	if (player && player.area !== 'home' && !validTent && (!areaBiome || !areaBiome.explorable)) {
		player = { ...player, area: 'meadow', x: 24.5, y: 6.5 };
	}
	// World-owned state is read by the active world id; achievements stay personal.
	// `opts.worldId` lets a caller force the world even if the player's just-patched
	// worldId isn't visible yet within the same transaction (e.g. right after joining).
	const wid = opts.worldId || worldOf(player);
	const [biomeStates, placements, chests, discoveries, nodeStates, terrain, achievementRows, feedRows] =
		await Promise.all([
			byWorld(t.BiomeState, wid),
			byWorld(t.Placement, wid),
			byWorld(t.Chest, wid),
			byWorld(t.Discovery, wid),
			// THE AREA THE PLAYER IS STANDING IN, not all six.
			//
			// A node state is one fact — "this spot is regrowing, and until when" —
			// and the client only ever asks it of the area on screen (WorldScene
			// builds its lookup from this list for the nodes it is drawing). The
			// snapshot was sending every area's, on a table that gains a permanent
			// row for every gathering spot a save has ever touched, which made a
			// state refresh cost more the longer someone had played.
			//
			// This needs no client change, because the client already refetches the
			// whole snapshot on every area change (changeArea in src/state.tsx syncs
			// the player's area, then adopts a fresh GameState) — the round trip the
			// area-scoped read would have required is one the game was already making.
			// An interior ('home', 'tent-<biome>') has no gathering nodes, so it
			// correctly reads as none.
			byArea(t.NodeState, wid, player?.area || 'meadow'),
			// THE AREA THE PLAYER IS STANDING IN, for the same reason as NodeState
			// above, and only once nothing read it whole any more.
			//
			// Two things used to need every area's tiles. The starter chain's stream
			// goal did, and now reads `playerWater` off the biome rows instead (see
			// starterTasks). The client did, for `waterShape` in src/recipes.ts, which
			// gates water-shaped recipes for the recipe's OWN biome rather than the
			// one on screen — that one reads the same stored field now, with the
			// terrain computation kept behind it as a fallback.
			//
			// Everything else was already per-area: WorldScene draws, hashes and
			// collision-tests `tt.area === this.area`, the optimistic patches filter
			// by area, and the tutorial's water steps are meadow-only and latch on a
			// persisted `tutorialStep` that never regresses.
			byArea(t.TerrainTile, wid, player?.area || 'meadow'),
			byPlayer(t.PlayerAchievement, playerId),
			readFeed(wid),
		]);
	// The player's OWN unlocked biomes, before any roam expansion below —
	// daily tasks & their rewards are scoped to these so you never get items from
	// (or tasks about) a biome you haven't personally unlocked.
	const personalUnlocked = [...(player?.unlockedBiomes?.length ? player.unlockedBiomes : ['meadow'])];
	// In a world whose id is not the player's own, the snapshot reflects the union
	// of personally-unlocked and world-unlocked biomes.
	if (player && wid !== player.id) {
		const unlocked = new Set(player.unlockedBiomes || ['meadow']);
		for (const bs of biomeStates) if (bs.unlocked) unlocked.add(bs.biomeId);
		player = { ...player, unlockedBiomes: [...unlocked] };
	}
	const now = Date.now();
	const wxTime = weatherTimeFromPlay(player); // play-time clock, never null
	return {
		player: sanitizePlayer(player),
		worldId: wid,
		biomeStates,
		placements,
		chests,
		discoveries,
		nodeStates,
		terrain,
		// most-recently earned first, so the client can float fresh unlocks to the top
		achievements: [...achievementRows]
			.sort((a: any, b: any) => (b.earnedAt || 0) - (a.earnedAt || 0))
			.map((r: any) => r.achievementId),
		// persisted activity feed, oldest→newest (last 100 kept per world)
		feed: feedRows.slice(-FEED_CAP).map((r: any) => ({ id: r.id, at: r.at, icon: r.icon, text: r.text })),
		serverTime: now,
		weather: weatherSnapshot(wid, wxTime, WEATHER_BIOME_IDS, player?.devWeather || null),
		dailyTasks: dailyTasksBlock({
			wid,
			player,
			d,
			discoveries,
			biomeStates,
			placements,
			chests,
			terrain,
			now,
			unlockedBiomes: personalUnlocked,
		}),
		customGoals: player?.customGoals || [],
		goalLimit: goalLimitFor(player, d),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(player),
	};
}

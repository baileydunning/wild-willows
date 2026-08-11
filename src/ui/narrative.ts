// Narrative beats woven into the activity feed. As animals return, the *combination*
// of who's back triggers contextual lines ("three kinds of insect are back…", "with
// prey and predator both home the food web has closed its first loop"). Each beat
// fires exactly once — at the moment a return flips its condition from false to true —
// so it never repeats, and (because it's a before/after test on the returned set) it
// stays correct across reloads without any stored flags.

import type { GameData } from '../types';
import { t, tList } from '../i18n';

interface Ctx {
	has: (animalId: string) => boolean;
	kindInBiome: (biome: string, kind: string) => number;
	countInBiome: (biome: string) => number;
	distinctKindsInBiome: (biome: string) => number;
	total: number;
}

// A beat's display text lives in narrative.combo.<id> / narrative.total.<id>;
// the code keeps only the id (gates once-only firing), icon, and test.
interface Beat {
	id: string;
	icon: string;
	test: (c: Ctx) => boolean;
}

// A beat resolved for the feed: its text pulled from the catalog.
interface ResolvedBeat {
	id: string;
	icon: string;
	text: string;
	test: (c: Ctx) => boolean;
}

function buildCtx(ids: Set<string>, data: GameData): Ctx {
	const back = data.animals.filter((a) => ids.has(a.id));
	return {
		has: (id) => ids.has(id),
		kindInBiome: (biome, kind) => back.filter((a) => a.biome === biome && a.kind === kind).length,
		countInBiome: (biome) => back.filter((a) => a.biome === biome).length,
		distinctKindsInBiome: (biome) => new Set(back.filter((a) => a.biome === biome).map((a) => a.kind)).size,
		total: back.length,
	};
}

// Per-kind milestone templates. {biome} is filled with the biome name. A beat is
// only created for a (biome, kind) pair the biome can actually reach. Text lives
// in narrative.kind.<kind>, filled with the biome name at the call site.
const KIND_BEATS: { kind: string; threshold: number; icon: string }[] = [
	{ kind: 'insect', threshold: 3, icon: 'leaf' },
	{ kind: 'bird', threshold: 3, icon: 'paw' },
	{ kind: 'mammal', threshold: 3, icon: 'paw' },
	{ kind: 'amphibian', threshold: 2, icon: 'drop' },
	{ kind: 'reptile', threshold: 2, icon: 'leaf' },
	{ kind: 'fish', threshold: 1, icon: 'drop' },
	{ kind: 'invertebrate', threshold: 3, icon: 'paw' },
];

// Hand-authored combination beats — the satisfying *and educational* ecological
// moments, most of them predator + prey pairings that teach a real relationship.
// Text lives in narrative.combo.<id> (id gates once-only firing, must not change).
const COMBO_BEATS: Beat[] = [
	{
		id: 'meadow-fox-prey',
		icon: 'paw',
		test: (c) => c.has('red-fox') && (c.has('cottontail-rabbit') || c.has('prairie-vole')),
	},
	{
		id: 'meadow-hawk-rodent',
		icon: 'paw',
		test: (c) => c.has('red-tailed-hawk') && (c.has('prairie-vole') || c.has('ground-squirrel')),
	},
	{
		id: 'forest-owl-prey',
		icon: 'paw',
		test: (c) => c.has('great-horned-owl') && (c.has('chipmunk') || c.has('tree-squirrel')),
	},
	{
		id: 'forest-bobcat-prey',
		icon: 'paw',
		test: (c) => c.has('bobcat') && (c.has('chipmunk') || c.has('tree-squirrel')),
	},
	{
		id: 'forest-cavity-reuse',
		icon: 'paw',
		test: (c) => c.has('pileated-woodpecker') && (c.has('wood-duck') || c.has('flying-squirrel')),
	},
	{
		id: 'wetland-beaver',
		icon: 'drop',
		test: (c) => c.has('beaver'),
	},
	{
		id: 'wetland-beaver-wake',
		icon: 'paw',
		test: (c) => c.has('beaver') && (c.has('river-otter') || c.has('great-blue-heron')),
	},
	{
		id: 'wetland-heron-hunt',
		icon: 'drop',
		test: (c) => c.has('great-blue-heron') && (c.has('minnow') || c.has('painted-turtle') || c.has('mallard')),
	},
	{
		id: 'desert-snake-rodent',
		icon: 'leaf',
		test: (c) => c.has('rattlesnake') && (c.has('kangaroo-rat') || c.has('desert-cottontail')),
	},
	{
		id: 'desert-coyote-prey',
		icon: 'paw',
		test: (c) => c.has('mountain-lion') && (c.has('desert-cottontail') || c.has('kangaroo-rat')),
	},
	{
		id: 'desert-shared-burrow',
		icon: 'leaf',
		test: (c) => c.has('desert-tortoise') && c.has('burrowing-owl'),
	},
	{
		id: 'alpine-eagle-prey',
		icon: 'paw',
		test: (c) => c.has('golden-eagle') && (c.has('yellow-bellied-marmot') || c.has('pika') || c.has('snowshoe-hare')),
	},
	{
		id: 'coastal-keystone',
		icon: 'paw',
		test: (c) => c.has('sea-star'),
	},
	{
		id: 'coastal-otter-kelp',
		icon: 'drop',
		test: (c) => c.has('sea-otter'),
	},
];

// Preserve-wide totals — quieter, reflective beats as the whole place fills in.
// Text lives in narrative.total.<id>.
const TOTAL_BEATS: Beat[] = [
	{ id: 'total-10', icon: 'sparkle', test: (c) => c.total >= 10 },
	{ id: 'total-25', icon: 'sparkle', test: (c) => c.total >= 25 },
	{ id: 'total-40', icon: 'sparkle', test: (c) => c.total >= 40 },
];

// Biome-specific feed lines, surfaced gradually over time while the player is in
// that area (see the timer in state.tsx). A big randomized pool per biome blends
// ecology, atmosphere, coexistence, and fun facts. `g` gates a line to the biome's
// recovery and what the player has done there:
//   h   = minimum biome health
//   a   = at least ONE of these animals has returned
//   all = ALL of these animals have returned   (animal combinations)
//   c   = ALL of these objects have been crafted (crafting combinations)
// `i` overrides the feed icon (default 'leaf').
// The display text lives in the catalog array narrative.lines.<biome>, matched
// to these entries by index; only the gating metadata + icon stay in code.
export interface FeedLine {
	g?: { h?: number; a?: string[]; all?: string[]; c?: string[] };
	i?: string;
}

export const BIOME_LINES: Record<string, FeedLine[]> = {
	meadow: [
		// atmosphere
		{},
		{},
		{ i: 'sparkle' },
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		// ecology / educational
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		// fun / quirky
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw' },
		{ i: 'paw', g: { a: ['red-fox'] } },
		{ i: 'paw', g: { a: ['red-tailed-hawk'] } },
		{ i: 'paw', g: { a: ['monarch-butterfly'] } },
		{ i: 'paw', g: { a: ['cottontail-rabbit'] } },
		{ i: 'paw', g: { a: ['song-sparrow', 'american-goldfinch'] } },
		// progress-gated atmosphere
		{ g: { h: 25 } },
		{ g: { h: 40 } },
		{ g: { h: 50 } },
		{ g: { h: 60 } },
		{ g: { h: 80 } },
		// more
		{},
		{},
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{},
		// animal combinations
		{ i: 'paw', g: { all: ['red-fox', 'red-tailed-hawk'] } },
		{ i: 'paw', g: { all: ['monarch-butterfly', 'bumblebee', 'ladybug'] } },
		{ i: 'paw', g: { a: ['barn-owl', 'western-screech-owl'] } },
		{ i: 'paw', g: { all: ['mule-deer', 'cottontail-rabbit'] } },
		// crafting combinations
		{ g: { c: ['berry-bush', 'shrub'] } },
		{ g: { c: ['wildflower-patch', 'pollinator-garden'] } },
		{ g: { c: ['brush-pile', 'rock-pile'] } },
		{ g: { c: ['oak-tree', 'willow-tree'] } },
		{ i: 'drop', g: { c: ['small-pond', 'bird-bath'] } },
	],
	forest: [
		// atmosphere
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{ i: 'drop' },
		// ecology
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		// fun
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw', g: { a: ['pileated-woodpecker', 'woodpecker'] } },
		{ i: 'paw', g: { a: ['great-horned-owl', 'goshawk'] } },
		{ i: 'paw', g: { a: ['tree-squirrel', 'chipmunk'] } },
		{ i: 'paw', g: { a: ['bobcat'] } },
		{ i: 'paw', g: { a: ['skunk'] } },
		// progress-gated
		{ g: { h: 25 } },
		{ g: { h: 50 } },
		{ g: { h: 70 } },
		{ g: { h: 80 } },
		// more
		{ i: 'drop' },
		{},
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{},
		{},
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{},
		// animal combinations
		{ i: 'paw', g: { all: ['great-horned-owl', 'goshawk'] } },
		{ i: 'paw', g: { all: ['pileated-woodpecker', 'wood-duck'] } },
		{ i: 'paw', g: { a: ['black-bear', 'bobcat'] } },
		{ i: 'paw', g: { all: ['tree-squirrel', 'flying-squirrel'] } },
		// crafting combinations
		{ g: { c: ['standing-deadwood', 'nesting-tree'] } },
		{ g: { c: ['mushroom-log', 'hollow-log'] } },
		{ i: 'drop', g: { c: ['woodland-pool', 'fern-spring'] } },
		{ g: { c: ['berry-bush', 'fern-grove'] } },
	],
	wetland: [
		// atmosphere
		{ i: 'drop' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		{},
		{ i: 'drop' },
		{},
		{ i: 'paw' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		{},
		// ecology
		{ i: 'drop' },
		{ i: 'drop' },
		{},
		{ i: 'drop' },
		{ i: 'drop' },
		{},
		{ i: 'paw' },
		{},
		{},
		{ i: 'drop' },
		// fun
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw', g: { a: ['beaver'] } },
		{ i: 'paw', g: { a: ['river-otter', 'great-blue-heron'] } },
		{ i: 'paw', g: { a: ['great-blue-heron'] } },
		{ i: 'paw', g: { a: ['painted-turtle', 'snapping-turtle'] } },
		{ i: 'paw', g: { a: ['minnow'] } },
		// progress-gated
		{ i: 'drop', g: { h: 25 } },
		{ g: { h: 50 } },
		{ i: 'drop', g: { h: 70 } },
		{ i: 'drop', g: { h: 80 } },
		// more
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'paw' },
		{},
		// animal combinations
		{ i: 'paw', g: { all: ['beaver', 'river-otter'] } },
		{ i: 'paw', g: { all: ['great-blue-heron', 'minnow'] } },
		{ i: 'paw', g: { a: ['sandhill-crane', 'american-bittern'] } },
		{ i: 'paw', g: { all: ['painted-turtle', 'snapping-turtle'] } },
		// crafting combinations
		{ i: 'drop', g: { c: ['reed-bed', 'cattail-stand'] } },
		{ i: 'drop', g: { c: ['lily-pool', 'mud-bank'] } },
		{ g: { c: ['nesting-platform', 'marsh-log'] } },
		{ g: { c: ['bulrush', 'sedge-tussock'] } },
	],
	desert: [
		// atmosphere
		{},
		{ i: 'paw' },
		{},
		{},
		{ i: 'sparkle' },
		{},
		{},
		{},
		{ i: 'paw' },
		{},
		// ecology
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		{},
		// fun
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw', g: { a: ['desert-tortoise', 'burrowing-owl'] } },
		{ i: 'paw', g: { a: ['rattlesnake'] } },
		{ i: 'paw', g: { a: ['mountain-lion'] } },
		{ i: 'paw', g: { a: ['cactus-woodpecker'] } },
		{ i: 'paw', g: { a: ['quail'] } },
		// progress-gated
		{ g: { h: 25 } },
		{ g: { h: 50 } },
		{ g: { h: 70 } },
		{ g: { h: 80 } },
		// more
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{},
		{},
		{},
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'drop' },
		// animal combinations
		{ i: 'paw', g: { all: ['desert-tortoise', 'burrowing-owl'] } },
		{ i: 'paw', g: { all: ['rattlesnake', 'kangaroo-rat'] } },
		{ i: 'paw', g: { a: ['mountain-lion', 'kit-fox'] } },
		{ i: 'paw', g: { all: ['cactus-woodpecker', 'elf-owl'] } },
		// crafting combinations
		{ g: { c: ['burrow-mound', 'shaded-rock-shelter'] } },
		{ g: { c: ['cactus-patch', 'desert-brush'] } },
		{ g: { c: ['nectar-feeder', 'desert-marigold'] } },
		{ g: { c: ['mesquite-tree', 'palo-verde-tree'] } },
	],
	alpine: [
		// atmosphere
		{},
		{},
		{ i: 'paw' },
		{},
		{ i: 'drop' },
		{},
		{},
		{},
		{},
		{ i: 'paw' },
		// ecology
		{},
		{},
		{},
		{},
		{ i: 'drop' },
		{},
		{ i: 'drop' },
		{},
		{},
		{},
		// fun
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw', g: { a: ['golden-eagle'] } },
		{ i: 'paw', g: { a: ['nutcracker'] } },
		{ i: 'paw', g: { a: ['pika', 'yellow-bellied-marmot'] } },
		{ i: 'paw', g: { a: ['ermine'] } },
		{ i: 'paw', g: { a: ['snowmelt-trout'] } },
		// progress-gated
		{ g: { h: 25 } },
		{ g: { h: 50 } },
		{ g: { h: 70 } },
		{ g: { h: 80 } },
		// more
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{},
		{},
		{ i: 'sparkle' },
		{ i: 'paw' },
		{ i: 'drop' },
		{},
		{},
		{ i: 'sparkle' },
		{},
		{},
		// animal combinations
		{ i: 'paw', g: { all: ['pika', 'yellow-bellied-marmot'] } },
		{ i: 'paw', g: { all: ['golden-eagle', 'yellow-bellied-marmot'] } },
		{ i: 'paw', g: { a: ['mountain-goat', 'bighorn-sheep'] } },
		{ i: 'paw', g: { a: ['ermine', 'pine-marten'] } },
		// crafting combinations
		{ i: 'drop', g: { c: ['snowmelt-pool', 'alpine-wildflower-patch'] } },
		{ g: { c: ['heather-mat', 'moss-cushion'] } },
		{ g: { c: ['krummholz-pine', 'subalpine-fir'] } },
		{ g: { c: ['burrow-mound', 'rock-pile'] } },
	],
	coastal: [
		// atmosphere
		{ i: 'drop' },
		{ i: 'paw' },
		{},
		{ i: 'drop' },
		{ i: 'paw' },
		{},
		{},
		{ i: 'drop' },
		{ i: 'paw' },
		{ i: 'drop' },
		// ecology
		{},
		{ i: 'drop' },
		{},
		{ i: 'paw' },
		{ i: 'drop' },
		{ i: 'drop' },
		{ i: 'drop' },
		{},
		{ i: 'drop' },
		{ i: 'paw' },
		// fun
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		// coexistence (gated)
		{ i: 'paw', g: { a: ['sea-star'] } },
		{ i: 'paw', g: { a: ['sea-otter'] } },
		{ i: 'paw', g: { a: ['brown-pelican', 'pelagic-cormorant'] } },
		{ i: 'paw', g: { a: ['puffin'] } },
		{ i: 'paw', g: { a: ['sea-star', 'giant-green-anemone'] } },
		// progress-gated
		{ i: 'drop', g: { h: 25 } },
		{ g: { h: 50 } },
		{ i: 'drop', g: { h: 70 } },
		{ g: { h: 80 } },
		// more
		{ i: 'sparkle' },
		{},
		{ i: 'sparkle' },
		{ i: 'paw' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		{ i: 'sparkle' },
		{ i: 'drop' },
		{ i: 'sparkle' },
		// animal combinations
		{ i: 'paw', g: { all: ['sea-star', 'anemone'] } },
		{ i: 'paw', g: { all: ['sea-otter', 'harbor-seal'] } },
		{ i: 'paw', g: { all: ['brown-pelican', 'cormorant'] } },
		{ i: 'paw', g: { a: ['snowy-plover', 'sanderling'] } },
		// crafting combinations
		{ i: 'drop', g: { c: ['tidepool', 'kelp-wrack'] } },
		{ g: { c: ['dune-grass', 'beach-shrub'] } },
		{ i: 'drop', g: { c: ['eelgrass-bed', 'oyster-bed'] } },
		{ g: { c: ['coastal-nesting-area', 'nesting-platform'] } },
	],
};

export const HEALTH_THRESHOLDS = [25, 50, 80, 100];

/** Progress beat for a biome crossing a health threshold (25/50/80/100). */
export function healthMilestoneLine(threshold: number, biomeName: string): string | null {
	if (!HEALTH_THRESHOLDS.includes(threshold)) return null;
	return t(`narrative.health.${threshold}`, { biome: biomeName });
}

/** Is a biome line eligible given the area's current recovery + what's been built? */
function lineEligible(line: FeedLine, health: number, returnedIds: Set<string>, crafted: Set<string>): boolean {
	const g = line.g;
	if (!g) return true;
	if (g.h !== undefined && health < g.h) return false;
	if (g.a && !g.a.some((id) => returnedIds.has(id))) return false;
	if (g.all && !g.all.every((id) => returnedIds.has(id))) return false;
	if (g.c && !g.c.every((id) => crafted.has(id))) return false;
	return true;
}

/**
 * Pick the next time-based feed line for the player's *current* biome — strictly
 * biome-specific. Respects recovery / animal-combination / crafting-combination
 * gates and never repeats a line already shown (tracked in `shown`). Returns null
 * if there's nothing new to say right now.
 */
export function nextFeedFact(opts: {
	area: string;
	health: number;
	returnedIds: Set<string>;
	crafted: Set<string>;
	shown: Set<string>;
}): { key: string; icon: string; text: string } | null {
	const { area, health, returnedIds, crafted, shown } = opts;
	const texts = tList(`narrative.lines.${area}`);
	const pool = (BIOME_LINES[area] || [])
		.map((line, i) => ({ key: `b:${area}:${i}`, icon: line.i || 'leaf', text: texts[i], line }))
		.filter((c) => !shown.has(c.key) && lineEligible(c.line, health, returnedIds, crafted));
	if (pool.length === 0) return null;
	const pick = pool[Math.floor(Math.random() * pool.length)];
	return { key: pick.key, icon: pick.icon, text: pick.text };
}

/** Build the full beat list once we know the biome names. */
function allBeats(data: GameData): ResolvedBeat[] {
	const beats: ResolvedBeat[] = [];
	for (const biome of data.biomes) {
		for (const kb of KIND_BEATS) {
			// only create a beat the biome can actually reach
			const available = data.animals.filter((a) => a.biome === biome.id && a.kind === kb.kind).length;
			if (available < kb.threshold) continue;
			beats.push({
				id: `kind-${biome.id}-${kb.kind}`,
				icon: kb.icon,
				text: t(`narrative.kind.${kb.kind}`, { biome: biome.name }),
				test: (c) => c.kindInBiome(biome.id, kb.kind) >= kb.threshold,
			});
		}
		// "every kind of creature" in a biome
		const totalKinds = new Set(data.animals.filter((a) => a.biome === biome.id).map((a) => a.kind)).size;
		if (totalKinds >= 4) {
			beats.push({
				id: `allkinds-${biome.id}`,
				icon: 'leaf',
				text: t('narrative.allkinds', { biome: biome.name }),
				test: (c) => c.distinctKindsInBiome(biome.id) >= totalKinds,
			});
		}
	}
	const combo = COMBO_BEATS.map((b): ResolvedBeat => ({ ...b, text: t(`narrative.combo.${b.id}`) }));
	const total = TOTAL_BEATS.map((b): ResolvedBeat => ({ ...b, text: t(`narrative.total.${b.id}`) }));
	return [...beats, ...combo, ...total];
}

let cache: { data: GameData; beats: ResolvedBeat[] } | null = null;

/**
 * Return the narrative lines to add to the feed given the returned-animal set
 * before and after this batch of returns. A beat fires only when the new
 * returns flip it from false to true — so each fires exactly once, ever.
 */
export function narrativeBeats(
	before: Set<string>,
	after: Set<string>,
	data: GameData,
): { icon: string; text: string }[] {
	if (!cache || cache.data !== data) cache = { data, beats: allBeats(data) };
	const cb = buildCtx(before, data);
	const ca = buildCtx(after, data);
	const out: { icon: string; text: string }[] = [];
	for (const beat of cache.beats) {
		if (beat.test(ca) && !beat.test(cb)) out.push({ icon: beat.icon, text: beat.text });
	}
	return out.slice(0, 3); // never flood the feed in one batch
}

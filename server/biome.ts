// Wild Willows — server: biome
//
// Biome health and the ecology that drives it: the area grid, health points and
// caps, balance, water analysis, animal return conditions, `recalcBiome`, biome
// unlocks, recipe unlocks, and crafting material consumption.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';
import { dayPhaseAt, nextPhaseAt, phasesSeen, seasonAt, weatherSnapshot, weatherTypeAt } from './weather';

import { BASE_HEALTH, FIRST_ANIMAL_ID, GameError, NODE_REGEN_SECONDS, clamp, db } from './core';
import { safeGet } from './store';
import { KEY_REV } from './keys';
import { REPAIR_REV, byArea, byWorld, defs, findBiomeState, findInWorld, worldOf } from './worlds';
import { CAPACITY_BY_BASKET, DEFAULT_HOME, START_INVENTORY, START_TOOLS, homeCarryBonus, homeOf } from './home';
import { STARTER_CHEST, getPlayer, hashPasscode, patchPlayer, sanitizePlayer } from './player';
import { WEATHER_BIOME_IDS, bumpMetrics, encodeMetrics, freshMetrics, weatherTimeFromPlay } from './metrics';
import { dailyTasksBlock, goalLimitFor } from './tasks';
import { earnedAchievementIds } from './achievements';

// --------------------------------------------------- biome health + snapshots
// Per-biome restoration metrics, plus an on-the-fly SVG "postcard" of what each
// area currently looks like (ground tinted by health, terrain beds, and every
// placed object as a colored marker), returned as a base64 data URI so it drops
// straight into an <img src> or a dashboard.

export const GRID_W = 30; // base grid (home interior / fallback) — matches OUT_W in the client
export const GRID_H = 20; // matches OUT_H
export const ALPINE_MTN_ROWS = 8; // impassable band the client adds above the alpine's playable grid (must match client MTN_ROWS)

/**
 * Placement bounds for an area. Biomes carry their own playable grid in
 * data/biomes.json (`grid`) — the meadow is the biggest — and the alpine adds
 * its mountain band on top, growing the world downward. The home interior
 * stays on the base grid (its floor rect is validated separately anyway).
 */
export function areaGrid(d: any, area: string): { cols: number; rows: number } {
	const g = area === 'home' ? null : d.biome.get(area)?.grid;
	const cols = g?.cols || GRID_W;
	const rows = (g?.rows || GRID_H) + (area === 'alpine' ? ALPINE_MTN_ROWS : 0);
	return { cols, rows };
}

/**
 * Where an area's trail gates sit, mirroring `dimsOf()` in the client's
 * WorldScene: the gates are one tile in from each side, on the middle row of
 * the playable band. The first biome has no gate west, the last none east.
 */
export function gateGeomOf(d: any, area: string): { gateY: number; landRight: number; westGate: boolean; eastGate: boolean } {
	const biome = d.biome.get(area);
	const g = biome?.grid;
	const cols = g?.cols || GRID_W;
	const baseRows = g?.rows || GRID_H;
	const playTop = area === 'alpine' ? ALPINE_MTN_ROWS : 0;
	const order = biome?.order || 1;
	const last = Math.max(...d.biomes.map((b: any) => b.order || 1));
	return {
		gateY: playTop + baseRows / 2 - 0.2,
		landRight: biome?.oceanCols ? cols - biome.oceanCols : cols,
		westGate: order > 1,
		eastGate: order < last,
	};
}

/**
 * True if flooding (tx, ty) would wall off a trail gate. Open water blocks
 * walking, so a channel across the mouth of a gate locks the player out of the
 * next biome — you cannot stand next to the gate to use it. The gate tile, one
 * row either side of it and the two columns in from that edge are all refused.
 * Tilled and watered beds are walkable, so only the flood step is blocked.
 * Mirrored by blocksGateTrail() in src/game/interactions.ts, which grays the
 * click out before it ever reaches here.
 */
export function blocksGateTrail(tx: number, ty: number, g: ReturnType<typeof gateGeomOf>): boolean {
	if (Math.abs(ty - Math.round(g.gateY)) > 1) return false;
	if (g.westGate && tx <= 2) return true;
	if (g.eastGate && tx >= g.landRight - 3) return true;
	return false;
}

/**
 * Gather per-biome restoration metrics for a player: health, balance, animals
 * returned, unlock state.
 *
 * This used to take an `images: true` option that rendered each unlocked area to
 * an SVG "postcard". Nothing ever passed it — the only caller is GET
 * /Metrics/<playerId>, which asks for numbers — and the renderer it drove was
 * reachable unauthenticated through BiomeSnapshot, where it rebuilt several
 * hundred KB of markup per request with no cache. Both are gone.
 */
export async function biomeMetrics(playerId: string, opts: { player?: any } = {}) {
	const t = db();
	const d = await defs();
	// BiomeState / Placement / TerrainTile are WORLD-keyed, so `byPlayer` cannot
	// use their prefix and degrades to a full scan of the whole table — three of
	// them, on a path GET /Metrics/<playerId> reaches on every read. Resolve the
	// world once and use the bounded read instead; for a solo save the world id IS
	// the player id, so this returns the same rows by a much cheaper route.
	const player = opts.player && opts.player.id === playerId ? opts.player : await getPlayer(playerId);
	const wid = player ? worldOf(player) : playerId;
	const states = await byWorld(t.BiomeState, wid);
	const byId = new Map(states.map((s) => [s.biomeId, s]));

	const biomes = d.biomes.map((b: any) => {
		const s: any = byId.get(b.id) || {};
		const entry: any = {
			biomeId: b.id,
			name: b.name,
			health: s.health || 0,
			balance: s.balance || 0,
			returnedCount: s.returnedCount || 0,
			unlocked: !!s.unlocked,
			explorable: !!b.explorable,
		};
		return entry;
	});

	return { biomes, summary: summarizeBiomes(biomes) };
}

/** Roll up a set of biome rows into headline restoration numbers. */
function summarizeBiomes(rows: any[]) {
	const unlocked = rows.filter((r) => r.unlocked);
	return {
		biomesUnlocked: unlocked.length,
		biomesFullyRestored: unlocked.filter((r) => (r.health || 0) >= 100).length,
		avgHealth: unlocked.length ? Math.round(unlocked.reduce((a, r) => a + (r.health || 0), 0) / unlocked.length) : 0,
		totalAnimalsReturned: rows.reduce((a, r) => a + (r.returnedCount || 0), 0),
	};
}

/**
 * Create a brand-new player with starter home, chest, and biome states.
 * Returns the records just written, because conditional searches within the
 * same transaction will not see them yet.
 */
export async function createPlayerRecords(
	playerId: string,
	name: string,
	passcode: string,
	appearance: any,
	tzOffsetMinutes = 0,
	creationMs = 0,
	edition: 'demo' | 'full' = 'full',
): Promise<any> {
	const t = db();
	const d = await defs();
	const now = Date.now();
	const { salt, hash } = hashPasscode(passcode);
	const player = {
		id: playerId,
		name,
		passcodeSalt: salt,
		passcodeHash: hash,
		appearance,
		tzOffsetMinutes, // local-morning task resets (see playerDayKey)
		createdAt: now,
		// Day-time is derived from accrued play time, and play-time 0 falls in the
		// night band — so start a fresh save at the top of the DAY phase (morning),
		// not in the dark. Sleeping later advances this offset the same way.
		clockOffsetMs: nextPhaseAt(0, 'day'),
		worldId: playerId, // start in your own private solo world (world of one)
		// Born on the current key contract, on both axes. `keyRev` says this world's
		// rows are already prefixed, so migrateWorldKeys never scans for it;
		// `achKeyRev` says the same for PlayerAchievement, which is what lets
		// byPlayer skip its legacy-rescue scan for a save that has simply not earned
		// anything yet. Without the second marker every action taken by a brand-new
		// save — the first ten minutes of the game, for everyone — full-scanned every
		// achievement row in the database looking for legacy rows that cannot exist.
		keyRev: KEY_REV,
		achKeyRev: KEY_REV,
		area: 'meadow',
		x: 24.5, // spawn right beside the camp crafting station
		y: 6.5,
		inventory: { ...START_INVENTORY },
		craftedItems: {},
		tools: { ...START_TOOLS },
		unlockedBiomes: ['meadow'],
		visitedBiomes: ['meadow'], // areas walked into at least once (enables fast-travel)
		tutorialStep: 0,
		home: { ...DEFAULT_HOME }, // your camp tent — upgrade it along four tracks, in two styles
		// Stamp how long character creation took (reported by the client), so the
		// dashboard can report average time-in-creator alongside the choices made.
		metrics: encodeMetrics({ ...freshMetrics(now), creationMs: creationMs > 0 ? Math.round(creationMs) : 0, edition }),
		// The board always shows a live "Unlock the next biome" guidance goal, so a
		// new player starts with no custom goals of their own yet.
		customGoals: [],
		// Born current: a save created on this build has no retired animal ids, no
		// mis-filed discoveries and no gate it walled off before the rule existed,
		// so the repair pass has nothing to find. Stamped here rather than left for
		// the first heartbeat to discover, because that would spend a Player write
		// per new save to learn there was no work — and the write budget is what
		// caps how many people can play at once. Only pre-0.3 saves lack it.
		repairRev: REPAIR_REV,
	};
	await t.Player.put(player);

	// A new player begins in their own private solo world (id === playerId), so
	// every seeded row is stamped with that worldId from the start.
	const wid = playerId;
	const biomeStates = d.biomes.map((b: any) => ({
		id: `${wid}:${b.id}`,
		worldId: wid,
		playerId,
		biomeId: b.id,
		health: BASE_HEALTH,
		balance: 0,
		returnedCount: 0,
		unlocked: b.id === 'meadow',
	}));
	for (const bs of biomeStates) await t.BiomeState.put(bs);

	const chestPlacementId = `${wid}:pl_${playerId}_starter-chest`;
	const placements = [
		{
			id: chestPlacementId,
			worldId: wid,
			playerId,
			objectId: 'small-chest',
			area: 'meadow',
			x: STARTER_CHEST.x,
			y: STARTER_CHEST.y,
			placedAt: now,
		},
	];
	for (const p of placements) await t.Placement.put(p);

	const chest = {
		id: chestPlacementId,
		worldId: wid,
		playerId,
		area: 'meadow',
		x: STARTER_CHEST.x,
		y: STARTER_CHEST.y,
		size: 'small-chest',
		capacity: STARTER_CHEST.capacity,
		contents: {},
	};
	await t.Chest.put(chest);

	return { player, seeded: { biomeStates, placements, chests: [chest] } };
}

/** Full state snapshot built from freshly created records (first login). */
export async function freshSnapshot(created: any) {
	const now = Date.now();
	const d = await defs();
	const worldId = created.player?.worldId || created.player?.id;
	const wxTime = weatherTimeFromPlay(created.player);
	return {
		player: sanitizePlayer(created.player),
		biomeStates: created.seeded.biomeStates,
		placements: created.seeded.placements,
		chests: created.seeded.chests,
		discoveries: [],
		nodeStates: [],
		terrain: [],
		achievements: [],
		feed: [],
		serverTime: now,
		weather: weatherSnapshot(worldId, wxTime, WEATHER_BIOME_IDS),
		dailyTasks: dailyTasksBlock({
			wid: worldId,
			player: created.player,
			d,
			discoveries: [],
			biomeStates: created.seeded.biomeStates,
			placements: created.seeded.placements,
			chests: created.seeded.chests,
			now,
		}),
		customGoals: created.player.customGoals || [],
		goalLimit: goalLimitFor(created.player, d),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(created.player),
	};
}

export function inventoryCapacity(player: any): number {
	const tier = player.tools?.basket || 1;
	// home upgrades add a flat carry bonus on top of the basket tier (functional perk)
	return (CAPACITY_BY_BASKET[tier] || 200) + homeCarryBonus(player);
}

// ----------------------------------------------- biome health & animal logic

/**
 * Count placed objects for animal-return requirements. A plant that is still
 * growing in (planted less than its growSeconds ago) does NOT count yet — an
 * animal only returns once the habitat it needs has actually matured. Pass `d`
 * to enable this gating; without it, every placement counts.
 */
function placementCounts(placements: any[], d?: any): Record<string, number> {
	const now = Date.now();
	const counts: Record<string, number> = {};
	for (const p of placements) {
		if (d && p.plantedAt) {
			const def = d.object.get(p.objectId);
			const growMs = (def?.growSeconds || 0) * 1000;
			if (growMs > 0 && now - p.plantedAt < growMs) continue; // still a sprout — not mature habitat yet
		}
		counts[p.objectId] = (counts[p.objectId] || 0) + 1;
	}
	return counts;
}

// Diminishing-returns curve for biome health. Restoration points come from
// placed objects, open water, and watered beds, but each additional percentage
// point of health is harder to earn than the last — a damaged preserve heals
// quickly at first and then slowly, so the final stretch to a thriving habitat
// takes real, sustained work. Tune HEALTH_SCALE up to make recovery even slower.
const HEALTH_SCALE = 90;

function healthFromPoints(points: number): number {
	const recovered = (100 - BASE_HEALTH) * (1 - Math.exp(-Math.max(0, points) / HEALTH_SCALE));
	return clamp(Math.round(BASE_HEALTH + recovered), 0, 100);
}

// Health is also capped by how much LIFE has actually returned. Playtest:
// placements alone could push a biome to 40-50% health with only 1-2 of its 25
// animals back, so the health bar raced far ahead of the animal count. The
// land can't truly heal without its animals: health plateaus at each cap until
// enough of the biome's own animals have come home. (Milestones sit safely
// above every animal minHealth requirement and recipe health gate that could
// be needed to reach the next milestone, so progress can never deadlock —
// e.g. the highest recipe gate is 78, unlockable at the 15-animal cap of 88.
// Don't lower the first cap below ~45 without re-checking data/animals-* and
// recipes: under 40 the forest has exactly 5 reachable animals and no slack.)
const HEALTH_CAPS: { animals: number; cap: number }[] = [
	{ animals: 5, cap: 60 },
	{ animals: 10, cap: 75 },
	{ animals: 15, cap: 88 },
];

export function healthCapForReturns(returnedInBiome: number): number {
	for (const step of HEALTH_CAPS) {
		if (returnedInBiome < step.animals) return step.cap;
	}
	return 100;
}

// ---- habitat growth over real time -----------------------------------------
// Living habitat (trees, shrubs, flower patches…) keeps growing after it's
// placed — in real wall-clock hours, whether or not the game is open. A mature
// plant contributes bonus restoration points, so a preserve is literally
// healthier when you come back to it. Defs opt in via `matureHours` (+
// `matureBonus` points once grown). Everything derives from the placement's
// own placedAt timestamp: no background tick, no stored growth state.

/** ms until this placement is fully grown (0 = grows instantly / not a grower). */
export function matureMs(def: any): number {
	return (def?.matureHours || 0) * 3_600_000;
}

/** True once a placement has been in the ground long enough to mature. */
function isMature(def: any, p: any, now: number): boolean {
	const ms = matureMs(def);
	return ms > 0 && now - (p.placedAt || 0) >= ms;
}

/** True if the placement crossed its maturity threshold inside (a, b]. */
export function maturedBetween(def: any, p: any, a: number, b: number): boolean {
	const ms = matureMs(def);
	if (ms <= 0) return false;
	const at = (p.placedAt || 0) + ms;
	return at > a && at <= b;
}

// Growth is a gentle bonus, not a shortcut: the total restoration points a
// biome can earn from matured habitat is capped, so leaving the game closed
// never does the real work of restoring the land — it just rewards patience.
const MATURE_POINTS_CAP = 8;

/** Raw restoration points from everything placed/shaped in a biome. */
function computeHealthPoints(d: any, placements: any[], openWaterTiles = 0, now = Date.now()): number {
	let points = 0;
	let maturePoints = 0;
	for (const p of placements) {
		const def = d.object.get(p.objectId);
		if (!def) continue;
		points += def.healthValue || 0;
		// fully grown living habitat is worth a little more than the day it went in
		if (isMature(def, p, now)) maturePoints += def.matureBonus || 0;
	}
	points += Math.min(maturePoints, MATURE_POINTS_CAP);
	// shovel-shaped ponds/lakes/rivers: each open-water tile is real water habitat
	if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
	return points;
}

/**
 * Ecological balance measures how COMPLETE the food web is — not just how many
 * animals are back, but whether the recovered community is a working, balanced
 * ecosystem. Three signals, all 0..1:
 *   - return    : fraction of the biome's animals that have returned (life is back)
 *   - web       : fraction of the biome's predators / top-of-chain species back
 *                 (these depend on prey, so they only return once the chain below
 *                 them is in place — a biome of herbivores with no predators reads
 *                 as unbalanced, exactly as it should)
 *   - breadth   : fraction of animal *kinds* represented (insects, birds, mammals,
 *                 reptiles, amphibians, fish… — a varied web, not one trophic level)
 * By design balance CANNOT reach 100% until every animal in the biome is back.
 */
const BALANCE_RETURN_WEIGHT = 0.45;
const BALANCE_WEB_WEIGHT = 0.35;
const BALANCE_BREADTH_WEIGHT = 0.2;

function computeBalance(d: any, biomeId: string, returnedIds: Set<string>): number {
	const animals = d.animals.filter((a: any) => a.biome === biomeId);
	const total = animals.length;
	if (total === 0) return 0;
	const back = animals.filter((a: any) => returnedIds.has(a.id));
	if (back.length >= total) return 100; // every animal back = a perfectly balanced ecosystem

	const returnFrac = back.length / total;

	// predators / keystone species depend on other animals (a real food chain)
	const predators = animals.filter((a: any) => (a.requirements?.animals || []).length > 0);
	const predatorsBack = predators.filter((a: any) => returnedIds.has(a.id)).length;
	const webFrac = predators.length ? predatorsBack / predators.length : 1;

	// trophic breadth — how many different kinds of animal are represented
	const kindsAll = new Set(animals.map((a: any) => a.kind));
	const kindsBack = new Set(back.map((a: any) => a.kind));
	const breadthFrac = kindsAll.size ? kindsBack.size / kindsAll.size : 0;

	const raw = BALANCE_RETURN_WEIGHT * returnFrac + BALANCE_WEB_WEIGHT * webFrac + BALANCE_BREADTH_WEIGHT * breadthFrac;
	return clamp(Math.round(raw * 100), 0, 99); // never 100 until the last animal returns
}

/**
 * Analyze the player's open-water tiles (terraformed type 'water') in a biome.
 * Returns total tile count, the largest connected body ("lake"), and the
 * longest connected span ("river") — long, thin channels score high on river,
 * big blobs score high on lake. 4-neighbor connectivity.
 */
export function analyzeWater(terrain: any[], playerOnly = false) {
	// `playerOnly` drops the pre-seeded starting channels (the wetland ships with a
	// river + pond) so achievements like Lakemaker only reward water the PLAYER
	// actually shaped — otherwise unlocking the wetland auto-granted it. Animal
	// water needs still count the natural channels (default: everything).
	const cells = new Set(
		terrain.filter((t) => t.type === 'water' && (!playerOnly || !t.seeded)).map((t) => `${t.x},${t.y}`),
	);
	const seen = new Set<string>();
	let lake = 0;
	let river = 0;
	for (const key of cells) {
		if (seen.has(key)) continue;
		const stack = [key];
		seen.add(key);
		let size = 0;
		let minx = Infinity,
			maxx = -Infinity,
			miny = Infinity,
			maxy = -Infinity;
		while (stack.length) {
			const [x, y] = stack.pop()!.split(',').map(Number);
			size++;
			minx = Math.min(minx, x);
			maxx = Math.max(maxx, x);
			miny = Math.min(miny, y);
			maxy = Math.max(maxy, y);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nk = `${x + dx},${y + dy}`;
				if (cells.has(nk) && !seen.has(nk)) {
					seen.add(nk);
					stack.push(nk);
				}
			}
		}
		lake = Math.max(lake, size);
		river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
	}
	return { tiles: cells.size, lake, river };
}

/** The live weather/season/day-phase context an animal's `conditions` are tested against. */
interface WxContext {
	type: string;
	season: string;
	dayPhase: string;
}

/**
 * Some rare animals only venture out under the right sky: `conditions` on an
 * animal's requirements gates its RETURN on the live weather/season/day-phase
 * (any listed value matches). The habitat can be perfect, but a storm-loving
 * heron still waits for the storm — so there's always a reason to come back
 * in different weather, seasons, and times of day.
 */
function meetsConditions(animal: any, wx: WxContext | null): boolean {
	const cond = animal.requirements?.conditions;
	if (!cond) return true;
	if (!wx) return false; // can't verify the sky → the rare visitor waits
	if (Array.isArray(cond.weather) && cond.weather.length && !cond.weather.includes(wx.type)) return false;
	if (Array.isArray(cond.season) && cond.season.length && !cond.season.includes(wx.season)) return false;
	if (Array.isArray(cond.dayPhase) && cond.dayPhase.length && !cond.dayPhase.includes(wx.dayPhase)) return false;
	return true;
}

function meetsRequirements(
	animal: any,
	health: number,
	balance: number,
	counts: Record<string, number>,
	returnedIds: Set<string>,
	water: { tiles: number; lake: number; river: number },
	wx: WxContext | null = null,
) {
	const req = animal.requirements || {};
	if (health < (req.minHealth || 0)) return false;
	if (balance < (req.minBalance || 0)) return false;
	if (!meetsConditions(animal, wx)) return false;
	for (const [objectId, qty] of Object.entries(req.objects || {})) {
		if ((counts[objectId] || 0) < (qty as number)) return false;
	}
	for (const other of req.animals || []) {
		if (!returnedIds.has(other)) return false;
	}
	// open-water needs are met by terraforming channels and ponds
	const w = req.water;
	if (w) {
		if ((water.tiles || 0) < (w.tiles || 0)) return false;
		if ((water.lake || 0) < (w.lake || 0)) return false;
		if ((water.river || 0) < (w.river || 0)) return false;
	}
	return true;
}

/**
 * Comfort is earned through play: an animal settles in as you place MORE of
 * the habitat it likes. Meeting its bare needs makes it merely Settled (~60);
 * every extra copy of a liked object beyond that adds comfort with gentle
 * diminishing returns, so a lovingly over-built habitat is what gets an animal
 * to Thriving (90+). Losing a required piece hurts badly — the animal becomes
 * rarely seen (but is never gone). Recomputed on every biome recalc, so it
 * always reflects what's actually standing in the world.
 */
function computeComfort(animal: any, counts: Record<string, number>): number {
	const req = animal.requirements?.objects || {};
	const liked = Object.keys(req);
	if (!liked.length) return 70; // nothing in particular it needs — content by default
	let comfort = 30;
	let missing = 0;
	let extras = 0;
	for (const [objectId, qty] of Object.entries(req)) {
		const have = counts[objectId] || 0;
		if (have >= (qty as number)) {
			comfort += Math.round(30 / liked.length); // all needs met → Settled (~60)
			extras += have - (qty as number);
		} else {
			missing++;
		}
	}
	// every extra liked thing helps, with diminishing returns (up to +40)
	comfort += Math.round(40 * (1 - Math.exp(-extras / 6)));
	comfort -= missing * 25;
	return clamp(comfort, 5, 100);
}

export function whyReturnedText(animal: any, d: any): string {
	const req = animal.requirements || {};
	const parts: string[] = [];
	const objs = Object.entries(req.objects || {}).map(([id, q]) =>
		tr('server.whyReturned.objectQty', { qty: q as number, name: d.object.get(id)?.name || id }),
	);
	if (objs.length) parts.push(tr('server.whyReturned.habitat', { objects: objs.join(tr('server.list.comma')) }));
	if (req.water) {
		const w = req.water;
		if (w.lake) parts.push(tr('server.whyReturned.lake', { tiles: w.lake }));
		else if (w.river) parts.push(tr('server.whyReturned.river', { tiles: w.river }));
		else if (w.tiles) parts.push(tr('server.whyReturned.tiles', { tiles: w.tiles }));
	}
	if (req.minHealth) parts.push(tr('server.whyReturned.health', { health: req.minHealth }));
	if (req.minBalance) parts.push(tr('server.whyReturned.balance', { balance: req.minBalance }));
	if (req.animals?.length)
		parts.push(
			tr('server.whyReturned.animals', {
				animals: req.animals.map((a: string) => d.animal.get(a)?.name || a).join(tr('server.list.and')),
			}),
		);
	const cond = req.conditions;
	if (cond) {
		const bits: string[] = [];
		if (cond.weather?.length) bits.push(cond.weather.join(tr('server.list.or')));
		if (cond.season?.length)
			bits.push(tr('server.whyReturned.inSeason', { seasons: cond.season.join(tr('server.list.or')) }));
		if (cond.dayPhase?.length)
			bits.push(tr('server.whyReturned.atPhase', { phases: cond.dayPhase.join(tr('server.list.or')) }));
		if (bits.length) parts.push(tr('server.whyReturned.moment', { conditions: bits.join(tr('server.list.comma')) }));
	}
	return tr('server.whyReturned.sentence', { reasons: parts.join(tr('server.list.comma')) });
}

/**
 * Recalculate biome health, ecological balance, animal returns, comfort
 * levels, and biome unlocks for one player+biome. Returns what changed.
 *
 * `opts.addPlacements` / `opts.removeIds` let callers include writes made
 * earlier in the same request, since conditional searches inside one
 * transaction do not see that transaction's own writes yet.
 */
export async function recalcBiome(
	wid: string,
	playerId: string,
	biomeId: string,
	opts: {
		addPlacements?: any[];
		removeIds?: string[];
		player?: any;
		addTerrain?: any[];
		removeTerrainIds?: string[];
		/** The world's Discovery rows, if the caller has already read them. */
		discoveries?: any[];
	} = {},
) {
	const t = db();
	const d = await defs();
	if (!d.biome.get(biomeId))
		throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }), 400, 'server.err.unknownBiome');

	let placements = (await byWorld(t.Placement, wid)).filter((p) => p.area === biomeId);
	if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds!.includes(p.id));
	for (const ap of opts.addPlacements || []) {
		if (ap.area !== biomeId) continue;
		// replace (not skip) any same-id row: in-transaction searches can return the
		// pre-write version of a record this request just changed
		placements = placements.filter((p) => p.id !== ap.id);
		placements.push(ap);
	}
	const counts = placementCounts(placements, d);

	// terraformed ground: each watered bed adds +1 health (capped) — tending the
	// soil itself matters, not just the objects on it
	let terrain = await byArea(t.TerrainTile, wid, biomeId);
	if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds!.includes(tt.id));
	for (const at of opts.addTerrain || []) {
		if (at.area !== biomeId) continue;
		// replace stale same-id rows so type changes (tilled -> watered -> water)
		// count immediately within the request that made them
		terrain = terrain.filter((tt) => tt.id !== at.id);
		terrain.push(at);
	}
	// Watered beds nudge health only a LITTLE — a few beds, half a point each — so
	// you can't spam dig+water your way to enough health to pull animals back. Real
	// recovery comes from placed/planted habitat; a bare bed is just a step toward
	// planting. (Capped low on purpose.)
	const wateredTiles = Math.min(3, terrain.filter((tt) => tt.type === 'watered').length) * 0.5;
	// Pre-seeded starting water (the wetland's channels) doesn't count toward
	// health — only water the player shapes does — so a biome begins damaged.
	const openWaterTiles = terrain.filter((tt) => tt.type === 'water' && !tt.seeded).length;
	// rivers and lakes shaped with the watering can feed water-dwelling animals
	const water = analyzeWater(terrain);

	// tended soil beds are worth 1 restoration point each, on the same slow curve
	const now = Date.now();
	const healthPoints = computeHealthPoints(d, placements, openWaterTiles, now) + wateredTiles;
	const uncappedHealth = healthFromPoints(healthPoints);

	// Live sky for condition-gated rare animals: derived from the acting player's
	// play-time clock, same as the weather snapshot and weather-gated gathering.
	const actor = opts.player || (await safeGet(t.Player, playerId));
	const wxTime = actor ? weatherTimeFromPlay(actor) : null;
	const wx: WxContext | null =
		wxTime === null
			? null
			: {
					type: weatherTypeAt(wid, biomeId, wxTime),
					season: seasonAt(wxTime),
					dayPhase: dayPhaseAt(wxTime),
				};

	// Read once per REQUEST, not once per call: an action that recalculates a
	// biome almost always awards achievements straight afterwards, and both passes
	// want the same world-wide Discovery set. The caller reads it and lends it to
	// both (see the awardWorldAchievements calls in the action endpoints).
	const discoveries = opts.discoveries ?? (await byWorld(t.Discovery, wid));
	const returnedIds = new Set(discoveries.map((x) => x.animalId));
	// The land only heals as far as its returned life allows: health plateaus at
	// each HEALTH_CAPS milestone until enough of this biome's animals are home.
	const returnedHere = () => [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
	let health = Math.min(uncappedHealth, healthCapForReturns(returnedHere()));

	// Balance tracks food-web completeness, recomputed as each animal comes back so
	// food-web chains can keep unlocking the rest.
	let balance = computeBalance(d, biomeId, returnedIds);

	// Animal returns — animals come back only when the habitat truly supports them.
	// One habitat = one animal: at most a single new animal returns per change, so
	// building out a biome brings visitors back one at a time rather than summoning
	// a whole swarm at once. Food-web chains resolve over subsequent actions.
	const newAnimals: any[] = [];
	const biomeAnimals = d.animals.filter((a: any) => a.biome === biomeId);
	// The grasshopper must be the very first animal to come home — the meadow's
	// first sign of life. Every other animal, in every biome, is gated behind it.
	const firstAnimalBack = returnedIds.has(FIRST_ANIMAL_ID);
	for (const animal of biomeAnimals) {
		if (returnedIds.has(animal.id)) continue;
		// nothing else returns until the grasshopper has
		if (!firstAnimalBack && animal.id !== FIRST_ANIMAL_ID) continue;
		if (meetsRequirements(animal, health, balance, counts, returnedIds, water, wx)) {
			const disc = {
				id: `${wid}:${animal.id}`,
				worldId: wid,
				playerId,
				animalId: animal.id,
				biomeId,
				comfort: computeComfort(animal, counts),
				timesObserved: 0,
				firstObservedAt: Date.now(),
				whyReturned: whyReturnedText(animal, d),
			};
			await t.Discovery.put(disc);
			returnedIds.add(animal.id);
			balance = computeBalance(d, biomeId, returnedIds); // more life back -> more balance
			newAnimals.push({ ...disc, animal });
			break;
		}
	}
	// a fresh return can lift the health cap — re-clamp with the new count so
	// the stored health reflects the milestone the moment it's crossed
	health = Math.min(uncappedHealth, healthCapForReturns(returnedHere()));

	// Comfort drifts with habitat quality. Removing key habitat lowers comfort
	// (animals become "rarely seen") but they are never owned or lost like pets.
	for (const disc of discoveries) {
		if (disc.biomeId !== biomeId) continue;
		const animal = d.animal.get(disc.animalId);
		if (!animal) continue;
		const comfort = computeComfort(animal, counts);
		if (comfort !== disc.comfort) await t.Discovery.patch(disc.id, { comfort });
	}

	const returnedCount = returnedHere();
	const prior = await findBiomeState(t.BiomeState, wid, biomeId);
	const bsId = prior?.id ?? `${wid}:${biomeId}`;
	await t.BiomeState.patch(bsId, { health, balance, returnedCount });
	const biomeState = {
		...(prior || { id: bsId, worldId: wid, playerId, biomeId, unlocked: biomeId === 'meadow' }),
		health,
		balance,
		returnedCount,
	};

	// Feed the daily task board: positive health gains and newly returned
	// animals bump the acting player's per-day counters (see dailyTasksFor).
	const healthGain = health - (prior?.health ?? BASE_HEALTH);
	const dailyDeltas: Record<string, number> = {};
	if (healthGain > 0) dailyDeltas[`health:${biomeId}`] = healthGain;
	if (newAnimals.length) {
		dailyDeltas[`animal:${biomeId}`] = newAnimals.length;
		dailyDeltas.animal = newAnimals.length;
	}
	// The lifetime `animalsReturned` counter is bumped HERE rather than at the call
	// sites, because this is the only place an animal can actually come home. It
	// used to be bumped by the four player actions that trigger a recalc (place,
	// plant, terraform, remove), which silently missed every other route: the
	// heartbeat growth pass (a tree finishing maturity mid-session, and the
	// welcome-back catch-up after time away), POST /RecalcBiome/, and the recalc
	// that follows seeding an area's starting terrain. That left the dashboard
	// showing two different "Animals returned" numbers for the same player —
	// biomeSummary.totalAnimalsReturned (derived from BiomeState, always right)
	// against a counts.animalsReturned that under-reported. Bumping at the source
	// means a new path can't reintroduce the drift.
	const deltas: Record<string, number> = newAnimals.length ? { animalsReturned: newAnimals.length } : {};
	/* The ids, not just the count. Same reasoning as the counter above: this is
	 * the one place an animal can come home, so it is the only place that can
	 * record WHICH one and how far into the playthrough it happened. */
	const arrived = newAnimals
		.map((a: any) => ({ id: a?.animalId || a?.animal?.id, name: a?.animal?.name }))
		.filter((a: any) => a.id);
	if (Object.keys(dailyDeltas).length || Object.keys(deltas).length || arrived.length) {
		const actor = opts.player || (await safeGet(t.Player, playerId));
		if (actor) await bumpMetrics(actor, deltas, dailyDeltas, arrived);
	}

	const unlockedBiomes = await checkUnlocks(wid, playerId, { player: opts.player, freshState: biomeState });
	return { biomeState, newAnimals, unlockedBiomes };
}

// Areas that begin partly shaped when first unlocked. Rushwater Wetland opens
// with channels and a pond already terraformed, so it reads as a wetland the
// moment you arrive — and gives the river/lake animals something to build on.
export const STARTING_TERRAIN: Record<string, { x: number; y: number; type: string }[]> = {
	wetland: [
		// a winding river across the north
		...[6, 7, 8, 9, 10, 11, 12, 13, 14].map((x) => ({ x, y: 4, type: 'water' })),
		{ x: 14, y: 5, type: 'water' },
		{ x: 14, y: 6, type: 'water' },
		{ x: 15, y: 6, type: 'water' },
		// a small open pond
		{ x: 20, y: 6, type: 'water' },
		{ x: 21, y: 6, type: 'water' },
		{ x: 22, y: 6, type: 'water' },
		{ x: 20, y: 7, type: 'water' },
		{ x: 21, y: 7, type: 'water' },
		{ x: 22, y: 7, type: 'water' },
		// a couple of watered beds ready to plant
		{ x: 10, y: 14, type: 'watered' },
		{ x: 11, y: 14, type: 'watered' },
	],
};

/** Pre-shape an area's starting terrain the first time it unlocks. */
export async function seedStartingTerrain(wid: string, playerId: string, biomeId: string) {
	const layout = STARTING_TERRAIN[biomeId];
	if (!layout) return;
	const t = db();
	for (const cell of layout) {
		const id = `${wid}:${biomeId}:${cell.x}:${cell.y}`;
		if (await t.TerrainTile.get(id)) continue; // never overwrite the world's own work
		// `seeded` marks pre-shaped starting terrain so it doesn't count toward
		// biome health — the wetland begins damaged (≈5%), not half-restored just
		// because it ships with channels. It still feeds water-dwelling animals.
		await t.TerrainTile.put({
			id,
			worldId: wid,
			playerId,
			area: biomeId,
			x: cell.x,
			y: cell.y,
			type: cell.type,
			seeded: true,
			updatedAt: Date.now(),
		});
	}
}

/**
 * Evaluate biome unlock requirements; unlock anything newly earned. Biome
 * unlock is a world property (BiomeState.unlocked under the world id), but the
 * acting player's personal `unlockedBiomes` is also updated so their action
 * gates open immediately.
 */
export async function checkUnlocks(
	wid: string,
	playerId: string,
	fresh: { player?: any; freshState?: any } = {},
): Promise<any[]> {
	const t = db();
	const d = await defs();
	const player = fresh.player || (await safeGet(t.Player, playerId));
	const unlockedNow: any[] = [];
	const unlockedSet = new Set(player.unlockedBiomes || []);
	// Newly-unlocked biomes each drop a one-time, claimable "welcome bundle" onto
	// the task board (see dailyTasksBlock). Existing saves start with no pending
	// rewards, so they aren't retroactively gifted for biomes opened long ago.
	const pendingRewards = new Set<string>(player.pendingUnlockRewards || []);
	// the world's own unlock state is authoritative for prerequisites
	const worldUnlocked = new Set((await byWorld(t.BiomeState, wid)).filter((b) => b.unlocked).map((b) => b.biomeId));

	for (const biome of d.biomes) {
		if (!biome.unlock || worldUnlocked.has(biome.id)) continue;
		const u = biome.unlock;
		const prereq =
			fresh.freshState?.biomeId === u.biome ? fresh.freshState : await findBiomeState(t.BiomeState, wid, u.biome);
		if (!prereq || !worldUnlocked.has(u.biome)) continue;
		if ((prereq.health || 0) < (u.minHealth || 0)) continue;
		if ((prereq.returnedCount || 0) < (u.minAnimals || 0)) continue;
		if (u.minTotalAnimals) {
			// total animals returned across the whole preserve (all biomes)
			const totalReturned = (await byWorld(t.Discovery, wid)).length;
			if (totalReturned < u.minTotalAnimals) continue;
		}
		if (u.requiresItem) {
			const crafted = player.craftedItems?.[u.requiresItem] || 0;
			const everCrafted = player.craftedEver?.[u.requiresItem] || 0;
			if (crafted <= 0 && everCrafted <= 0) continue;
		}
		if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) continue;

		worldUnlocked.add(biome.id);
		unlockedSet.add(biome.id);
		pendingRewards.add(biome.id);
		await patchPlayer(playerId, { unlockedBiomes: [...unlockedSet], pendingUnlockRewards: [...pendingRewards] });
		const bsRow = await findBiomeState(t.BiomeState, wid, biome.id);
		await t.BiomeState.patch(bsRow?.id ?? `${wid}:${biome.id}`, { unlocked: true });
		await seedStartingTerrain(wid, playerId, biome.id);
		unlockedNow.push({ id: biome.id, name: biome.name });
	}
	return unlockedNow;
}

/**
 * Recipe unlocks. A recipe with no `unlock` block is craftable from the moment
 * its biome is open (three starters per area). Everything else waits on its own
 * condition, and no two recipes in an area share one — so the crafting menu
 * grows a little at a time, and each new line in it is the reward for a
 * particular piece of caretaking rather than for a health bar ticking over.
 *
 * The conditions reach across the whole game: this area's health and ecological
 * balance, how many animals are back (in total, of one kind, or one specific
 * keystone species), what you have crafted before and how widely, what is
 * standing or planted on the ground here, the open water you've shaped, your
 * tool tiers, your home upgrades, achievements, and progress in other areas.
 * See RecipeUnlock in src/types.ts; the client mirrors this in src/recipes.ts.
 */
interface RecipeUnlockCtx {
	health: number;
	balance: number;
	animalsReturned: number;
	returnedAnimalIds: Set<string>;
	returnedKinds: Record<string, number>;
	totalAnimals: number;
	craftedEver: Record<string, number>;
	craftedDistinct: number;
	placedHere: Record<string, number>;
	water: { tiles: number; lake: number; river: number };
	tools: Record<string, number>;
	home: Record<string, any>;
	homeBuilt: boolean;
	biomeHealth: Record<string, number>;
	achievements: Set<string>;
	biomesOpen: number;
	seenPhases: string[];
}

export function recipeUnlockMet(recipe: any, ctx: RecipeUnlockCtx): boolean {
	const u = recipe.unlock;
	if (!u) return true; // starter recipe
	// how far this area has come back
	if (typeof u.minHealth === 'number' && ctx.health < u.minHealth) return false;
	if (typeof u.minBalance === 'number' && ctx.balance < u.minBalance) return false;
	// the life that's returned
	if (typeof u.animalsReturned === 'number' && ctx.animalsReturned < u.animalsReturned) return false;
	if (u.requiresAnimal && !ctx.returnedAnimalIds.has(u.requiresAnimal)) return false;
	if (u.requiresKind && (ctx.returnedKinds[u.requiresKind.kind] || 0) < u.requiresKind.count) return false;
	if (typeof u.totalAnimals === 'number' && ctx.totalAnimals < u.totalAnimals) return false;
	// what you've made, and what you've put in the ground here
	if (u.requiresCrafted && (ctx.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
	if (typeof u.craftedDistinct === 'number' && ctx.craftedDistinct < u.craftedDistinct) return false;
	if (u.requiresPlaced && (ctx.placedHere[u.requiresPlaced.objectId] || 0) < u.requiresPlaced.count) return false;
	if (u.requiresWater) {
		if (ctx.water.tiles < (u.requiresWater.tiles || 0)) return false;
		if (ctx.water.lake < (u.requiresWater.lake || 0)) return false;
		if (ctx.water.river < (u.requiresWater.river || 0)) return false;
	}
	// your own kit
	if (u.requiresTool && (ctx.tools[u.requiresTool.id] || 1) < u.requiresTool.tier) return false;
	if (u.requiresHome && (ctx.home[u.requiresHome.track] || 1) < u.requiresHome.level) return false;
	if (u.homeBuilt && !ctx.homeBuilt) return false; // a real house, not the starting tent
	// a time of day you've been through once (the headlamp arrives at nightfall
	// and stays — see phasesSeen() in server/weather.ts)
	if (u.phaseSeen?.length && !u.phaseSeen.some((p: string) => ctx.seenPhases.includes(p))) return false;
	// the wider preserve
	if (u.requiresBiome && (ctx.biomeHealth[u.requiresBiome.biome] || 0) < u.requiresBiome.minHealth) return false;
	if (u.requiresAchievement && !ctx.achievements.has(u.requiresAchievement)) return false;
	if (typeof u.biomesOpen === 'number' && ctx.biomesOpen < u.biomesOpen) return false;
	return true;
}

/**
 * Build the unlock context for one biome from live records, then judge a recipe.
 * Used by CraftItem to enforce the gate server-side (Harper is the source of
 * truth — the client only hides locked recipes for nicer UX).
 */
export async function recipeUnlockContext(
	wid: string,
	biomeId: string,
	player: any,
	d: any,
	unlock?: any,
): Promise<RecipeUnlockCtx> {
	const t = db();
	// Read only what THIS gate actually asks about. Every field below that comes
	// off the player row is free, but each of the four world reads is a scan, and
	// CraftItem builds this context on every single craft. Nearly every recipe
	// names one condition, so gathering all four was three scans of pure waste per
	// craft — working directly against the read budget the rest of 0.3 buys back.
	// With no `unlock` argument the context is built in full, which is what a
	// caller judging several recipes at once wants.
	const u = unlock || {};
	const all = !unlock;
	const needStates = all || u.minHealth != null || u.minBalance != null || u.requiresBiome != null;
	const needAnimals =
		all || u.animalsReturned != null || u.requiresAnimal != null || u.requiresKind != null || u.totalAnimals != null;
	const needPlaced = all || u.requiresPlaced != null;
	const needWater = all || u.requiresWater != null;
	const needAchievements = all || u.requiresAchievement != null;

	// Use the reliable per-world scan, not BiomeState.get(): a primary-key .get()
	// can return null for a record that exists on a cold Harper instance, which made
	// health read as 0 and wrongly rejected a craft the client correctly showed as
	// unlocked (e.g. a Bird Perch at 24% health).
	const states = needStates ? await byWorld(t.BiomeState, wid) : [];
	const bs = needStates
		? states.find((s: any) => s.biomeId === biomeId) || (await findBiomeState(t.BiomeState, wid, biomeId))
		: null;
	const discoveries = needAnimals ? await byWorld(t.Discovery, wid) : [];
	const here = discoveries.filter((x: any) => d.animal.get(x.animalId)?.biome === biomeId);
	const returnedAnimalIds = new Set<string>(here.map((x: any) => x.animalId));
	const returnedKinds: Record<string, number> = {};
	for (const x of here) {
		const kind = d.animal.get(x.animalId)?.kind;
		if (kind) returnedKinds[kind] = (returnedKinds[kind] || 0) + 1;
	}
	const placements = needPlaced ? (await byWorld(t.Placement, wid)).filter((p: any) => p.area === biomeId) : [];
	const terrain = needWater ? await byArea(t.TerrainTile, wid, biomeId) : [];
	const achievements = needAchievements ? await earnedAchievementIds(player.id) : new Set<string>();
	const biomeHealth: Record<string, number> = {};
	for (const s of states) biomeHealth[s.biomeId] = s.health || 0;
	const wxTime = weatherTimeFromPlay(player); // play-time clock, never null
	return {
		health: bs?.health || 0,
		balance: bs?.balance || 0,
		animalsReturned: returnedAnimalIds.size,
		returnedAnimalIds,
		returnedKinds,
		totalAnimals: discoveries.length,
		craftedEver: (player.craftedEver || {}) as Record<string, number>,
		craftedDistinct: Object.keys(player.craftedEver || {}).length,
		placedHere: placementCounts(placements),
		// playerOnly. The "shape N water tiles" gates are defined as open water YOU
		// shaped, and Rushwater opens with 18 pre-seeded tiles (a nine-tile channel
		// plus a six-tile pond) — counting those satisfied a 6-tile gate the moment
		// the wetland unlocked. Animal water needs are a separate question and still
		// read the natural channels: see the bare analyzeWater(terrain) in recalcBiome.
		water: analyzeWater(terrain, true),
		tools: (player.tools || {}) as Record<string, number>,
		home: homeOf(player),
		homeBuilt: !!homeOf(player).styleLocked,
		biomeHealth,
		achievements,
		biomesOpen: (player.unlockedBiomes || []).length,
		// same play-time clock the weather snapshot and rare animals read
		seenPhases: phasesSeen(wxTime),
	};
}

/**
 * Fetch a player's chest by id, self-healing saves where the chest placement
 * exists but its storage record is missing (older/interrupted saves). Rebuilds
 * the Chest row from the placement so the player can use it again.
 */
export async function getOwnedChest(t: any, d: any, chestId: string, wid: string): Promise<any | null> {
	const chest = await findInWorld(t.Chest, wid, chestId);
	if (chest) return chest;
	const placement = await findInWorld(t.Placement, wid, chestId);
	if (placement) {
		const def = d.object.get(placement.objectId);
		if (def?.isChest) {
			const healed = {
				id: chestId,
				worldId: wid,
				playerId: placement.playerId,
				area: placement.area,
				x: placement.x,
				y: placement.y,
				size: placement.objectId,
				capacity: def.chestCapacity || 60,
				contents: {},
			};
			await t.Chest.put(healed);
			return healed;
		}
	}
	return null;
}

// ------------------------------------------------------- crafting storage

/**
 * Consume materials from player inventory first, then from any of the
 * player's chests — crafting works anywhere, no station required.
 * Throws (and writes nothing) if materials are insufficient.
 * Returns a breakdown of where every material came from.
 */
export async function consumeMaterials(player: any, materials: Record<string, number>, wid: string = player.id) {
	const t = db();
	// crafting draws from the player's basket first, then the shared world's chests
	const chests = await byWorld(t.Chest, wid);

	// availability check first — never partially consume
	for (const [resId, qty] of Object.entries(materials)) {
		const inInv = player.inventory?.[resId] || 0;
		const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
		if (inInv + inChests < qty) {
			throw new GameError(
				tr('server.err.notEnough', { resource: resId, need: qty, have: inInv + inChests }),
				400,
				'server.err.notEnough',
			);
		}
	}

	const usedFrom: any = { inventory: {}, chests: {} };
	const inventory = { ...(player.inventory || {}) };
	const chestContents = new Map(chests.map((c) => [c.id, { ...(c.contents || {}) }]));

	for (const [resId, qtyNeeded] of Object.entries(materials)) {
		let remaining = qtyNeeded;
		const fromInv = Math.min(inventory[resId] || 0, remaining);
		if (fromInv > 0) {
			inventory[resId] -= fromInv;
			if (inventory[resId] <= 0) delete inventory[resId];
			usedFrom.inventory[resId] = fromInv;
			remaining -= fromInv;
		}
		for (const chest of chests) {
			if (remaining <= 0) break;
			const contents = chestContents.get(chest.id)!;
			const fromChest = Math.min(contents[resId] || 0, remaining);
			if (fromChest > 0) {
				contents[resId] -= fromChest;
				if (contents[resId] <= 0) delete contents[resId];
				usedFrom.chests[chest.id] = usedFrom.chests[chest.id] || {};
				usedFrom.chests[chest.id][resId] = fromChest;
				remaining -= fromChest;
			}
		}
		if (remaining > 0)
			throw new GameError(tr('server.err.notEnoughShort', { resource: resId }), 400, 'server.err.notEnoughShort'); // defensive; checked above
	}

	await patchPlayer(player.id, { inventory });
	for (const chest of chests) {
		if (usedFrom.chests[chest.id]) {
			await t.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
		}
	}
	return { usedFrom, inventory };
}

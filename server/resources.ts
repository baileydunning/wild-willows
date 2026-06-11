/**
 * Wild Willows — Harper backend resources.
 *
 * All game-state mutations flow through these endpoints. The frontend is
 * never trusted: inventory math, crafting costs, placement rules, biome
 * health, ecological balance, animal-return conditions and biome unlocks
 * are all validated and computed here, inside Harper.
 *
 * Built with `npm run build:server` (esbuild) into resources.js, which the
 * `jsResource` plugin loads.
 */

// Harper globals (provided by the Harper JavaScript environment)
declare const databases: any;
declare const Resource: any;

const db = () => databases.wildwillows;

// ---------------------------------------------------------------- helpers

class GameError extends Error {
	statusCode: number;
	constructor(message: string, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function posInt(n: any, label: string): number {
	const v = Number(n);
	if (!Number.isInteger(v) || v <= 0) throw new GameError(`${label} must be a positive whole number`);
	return v;
}

function sumValues(obj: Record<string, number> | undefined): number {
	if (!obj) return 0;
	return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}

async function toArray(iterable: any): Promise<any[]> {
	const out: any[] = [];
	for await (const item of iterable) out.push(item);
	return out;
}

async function allOf(table: any): Promise<any[]> {
	return toArray(table.search({}));
}

/**
 * Every per-player query goes through here. The search condition narrows by
 * playerId, and the explicit filter guarantees strict save isolation even if
 * the underlying index ever returns extra rows — nothing from another save
 * can leak into (or be deleted from) this player's world.
 */
async function byPlayer(table: any, playerId: string): Promise<any[]> {
	// Full scan + filter instead of a secondary-index conditional search. The
	// indexed `playerId` search proved unreliable across Harper versions/cold
	// starts — it could return zero rows for a perfectly good save, which made
	// the world (placements, chests, terrain) load empty until the first action
	// "warmed" things up. A plain scan never depends on the index being ready,
	// and these per-player tables are tiny, so this is both correct and cheap.
	const rows = await toArray(table.search({}));
	return rows.filter((r: any) => r?.playerId === playerId);
}

// Definition cache — definitions only change on deploy, so cache per worker.
let defsCache: any = null;
async function defs() {
	if (!defsCache) {
		const t = db();
		const [biomes, animals, resources, recipes, objects, tools] = await Promise.all([
			allOf(t.Biome),
			allOf(t.Animal),
			allOf(t.ResourceType),
			allOf(t.Recipe),
			allOf(t.HabitatObject),
			allOf(t.ToolDef),
		]);
		const index = (arr: any[]) => new Map(arr.map((r) => [r.id, r]));
		defsCache = {
			biomes, animals, resources, recipes, objects, tools,
			biome: index(biomes), animal: index(animals), resource: index(resources),
			recipe: index(recipes), object: index(objects), tool: index(tools),
		};
	}
	return defsCache;
}

// ------------------------------------------------------------- constants

const NODE_REGEN_SECONDS = 75;
const BASE_HEALTH = 5;
const CAPACITY_BY_BASKET: Record<number, number> = { 1: 80, 2: 160 };

const START_INVENTORY: Record<string, number> = { seeds: 6, fiber: 4, branches: 4, stones: 2, water: 2 };
const START_TOOLS: Record<string, number> = { basket: 1, shovel: 1, 'watering-can': 1, 'field-journal': 1 };

// Character appearance options (validated server-side; the frontend renders these)
const SKIN_TONES = ['#f6d7b8', '#eec39a', '#d9a06b', '#b97f50', '#8d5a3a', '#6b4226'];
const HAIR_COLORS = ['#3b2e25', '#6e4a33', '#a3692f', '#c9913f', '#d9b380', '#8c8c8c', '#b5707a', '#4a5a3a'];
const OUTFIT_COLORS = ['#4a7c59', '#7a9ac0', '#b5707a', '#c9913f', '#7d6b9e', '#5d8a8a', '#a3692f', '#666f7b'];
const HAT_STYLES = ['straw', 'leaf', 'beanie', 'none'];
const HAIRSTYLES = ['short', 'long', 'curly', 'curly-long', 'bun'];
const BODY_TYPES = ['slim', 'round'];

function sanitizeAppearance(a: any) {
	a = a || {};
	return {
		skin: SKIN_TONES.includes(a.skin) ? a.skin : SKIN_TONES[1],
		hair: HAIR_COLORS.includes(a.hair) ? a.hair : HAIR_COLORS[1],
		outfit: OUTFIT_COLORS.includes(a.outfit) ? a.outfit : OUTFIT_COLORS[0],
		hat: HAT_STYLES.includes(a.hat) ? a.hat : 'straw',
		hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : 'short',
		body: BODY_TYPES.includes(a.body) ? a.body : 'slim',
	};
}

/** Never send the passcode back to the client. */
function sanitizePlayer(player: any) {
	if (!player) return player;
	const { passcode, ...rest } = player;
	return rest;
}

function slugId(name: string): string {
	return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Starter base camp: tent + campfire scenery with a storage chest. Crafting
// needs no station — it works anywhere, from the basket plus any chests.
const STARTER_CHEST = { x: 9, y: 5, size: 'small-chest', capacity: 60 };

// ------------------------------------------------------------ player setup

/** Load an existing player or fail — creation only happens via /CreatePlayer/. */
async function requirePlayer(playerId: string): Promise<any> {
	if (!playerId || typeof playerId !== 'string') throw new GameError('playerId required');
	const player = await db().Player.get(playerId);
	if (!player) throw new GameError('No save found — please log in again', 404);
	return { player };
}

/**
 * Create a brand-new player with starter home, chest, and biome states.
 * Returns the records just written, because conditional searches within the
 * same transaction will not see them yet.
 */
async function createPlayerRecords(playerId: string, name: string, passcode: string, appearance: any): Promise<any> {
	const t = db();
	const d = await defs();
	const now = Date.now();
	const player = {
		id: playerId,
		name,
		passcode,
		appearance,
		createdAt: now,
		area: 'meadow',
		x: 10.5, // spawn right beside the camp workbench
		y: 6.5,
		inventory: { ...START_INVENTORY },
		craftedItems: {},
		tools: { ...START_TOOLS },
		unlockedBiomes: ['meadow'],
		tutorialStep: 0,
	};
	await t.Player.put(player);

	const biomeStates = d.biomes.map((b: any) => ({
		id: `${playerId}:${b.id}`,
		playerId,
		biomeId: b.id,
		health: BASE_HEALTH,
		balance: 0,
		returnedCount: 0,
		unlocked: b.id === 'meadow',
	}));
	for (const bs of biomeStates) await t.BiomeState.put(bs);

	const chestPlacementId = `pl_${playerId}_starter-chest`;
	const placements = [
		{
			id: chestPlacementId, playerId, objectId: 'small-chest',
			area: 'meadow', x: STARTER_CHEST.x, y: STARTER_CHEST.y, placedAt: now,
		},
	];
	for (const p of placements) await t.Placement.put(p);

	const chest = {
		id: chestPlacementId, playerId, area: 'meadow',
		x: STARTER_CHEST.x, y: STARTER_CHEST.y,
		size: 'small-chest', capacity: STARTER_CHEST.capacity, contents: {},
	};
	await t.Chest.put(chest);

	return { player, seeded: { biomeStates, placements, chests: [chest] } };
}

/** Full state snapshot built from freshly created records (first login). */
function freshSnapshot(created: any) {
	return {
		player: sanitizePlayer(created.player),
		biomeStates: created.seeded.biomeStates,
		placements: created.seeded.placements,
		chests: created.seeded.chests,
		discoveries: [],
		nodeStates: [],
		terrain: [],
		serverTime: Date.now(),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(created.player),
	};
}

function inventoryCapacity(player: any): number {
	const tier = player.tools?.basket || 1;
	return CAPACITY_BY_BASKET[tier] || 80;
}

// ----------------------------------------------- biome health & animal logic

function placementCounts(placements: any[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const p of placements) counts[p.objectId] = (counts[p.objectId] || 0) + 1;
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

/** Raw restoration points from everything placed/shaped in a biome. */
function computeHealthPoints(d: any, placements: any[], openWaterTiles = 0): number {
	let points = 0;
	for (const p of placements) {
		const def = d.object.get(p.objectId);
		if (!def) continue;
		points += def.healthValue || 0;
	}
	// shovel-shaped ponds/lakes/rivers: each open-water tile is real water habitat
	if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
	return points;
}

/**
 * Ecological balance now reflects the life that has actually come back: it
 * climbs as animals return to the biome and stalls if the habitat can't yet
 * support more of them. Each returned animal is worth BALANCE_PER_ANIMAL points.
 */
const BALANCE_PER_ANIMAL = 7;

function balanceFromReturns(returnedCount: number): number {
	return clamp(returnedCount * BALANCE_PER_ANIMAL, 0, 100);
}

function meetsRequirements(animal: any, health: number, balance: number, counts: Record<string, number>, returnedIds: Set<string>) {
	const req = animal.requirements || {};
	if (health < (req.minHealth || 0)) return false;
	if (balance < (req.minBalance || 0)) return false;
	for (const [objectId, qty] of Object.entries(req.objects || {})) {
		if ((counts[objectId] || 0) < (qty as number)) return false;
	}
	for (const other of req.animals || []) {
		if (!returnedIds.has(other)) return false;
	}
	return true;
}

function computeComfort(animal: any, counts: Record<string, number>): number {
	const req = animal.requirements?.objects || {};
	let comfort = 40;
	let missing = 0;
	for (const [objectId, qty] of Object.entries(req)) {
		const have = counts[objectId] || 0;
		if (have >= (qty as number)) {
			comfort += 12;
			comfort += Math.min(3, have - (qty as number)) * 5; // extra matching habitat = happier
		} else {
			missing++;
		}
	}
	comfort -= missing * 25;
	return clamp(comfort, 5, 100);
}

function whyReturnedText(animal: any, d: any): string {
	const req = animal.requirements || {};
	const parts: string[] = [];
	const objs = Object.entries(req.objects || {}).map(([id, q]) => `${q}× ${d.object.get(id)?.name || id}`);
	if (objs.length) parts.push(`habitat in place (${objs.join(', ')})`);
	if (req.minHealth) parts.push(`biome health reached ${req.minHealth}%`);
	if (req.minBalance) parts.push(`ecological balance reached ${req.minBalance}%`);
	if (req.animals?.length) parts.push(`${req.animals.map((a: string) => d.animal.get(a)?.name || a).join(' and ')} had already returned`);
	return `Felt safe enough to return once ${parts.join(', ')}.`;
}

/**
 * Recalculate biome health, ecological balance, animal returns, comfort
 * levels, and biome unlocks for one player+biome. Returns what changed.
 *
 * `opts.addPlacements` / `opts.removeIds` let callers include writes made
 * earlier in the same request, since conditional searches inside one
 * transaction do not see that transaction's own writes yet.
 */
async function recalcBiome(
	playerId: string,
	biomeId: string,
	opts: { addPlacements?: any[]; removeIds?: string[]; player?: any; addTerrain?: any[]; removeTerrainIds?: string[] } = {}
) {
	const t = db();
	const d = await defs();
	if (!d.biome.get(biomeId)) throw new GameError(`Unknown biome: ${biomeId}`);

	let placements = (await byPlayer(t.Placement, playerId)).filter((p) => p.area === biomeId);
	if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds!.includes(p.id));
	for (const ap of opts.addPlacements || []) {
		if (ap.area !== biomeId) continue;
		// replace (not skip) any same-id row: in-transaction searches can return the
		// pre-write version of a record this request just changed
		placements = placements.filter((p) => p.id !== ap.id);
		placements.push(ap);
	}
	const counts = placementCounts(placements);

	// terraformed ground: each watered bed adds +1 health (capped) — tending the
	// soil itself matters, not just the objects on it
	let terrain = (await byPlayer(t.TerrainTile, playerId)).filter((tt) => tt.area === biomeId);
	if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds!.includes(tt.id));
	for (const at of opts.addTerrain || []) {
		if (at.area !== biomeId) continue;
		// replace stale same-id rows so type changes (tilled -> watered -> water)
		// count immediately within the request that made them
		terrain = terrain.filter((tt) => tt.id !== at.id);
		terrain.push(at);
	}
	const wateredTiles = Math.min(10, terrain.filter((tt) => tt.type === 'watered').length);
	const openWaterTiles = terrain.filter((tt) => tt.type === 'water').length;

	// tended soil beds are worth 1 restoration point each, on the same slow curve
	const healthPoints = computeHealthPoints(d, placements, openWaterTiles) + wateredTiles;
	const health = healthFromPoints(healthPoints);

	const discoveries = await byPlayer(t.Discovery, playerId);
	const returnedIds = new Set(discoveries.map((x) => x.animalId));
	const countInBiome = () => [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;

	// Balance tracks the animals that have actually returned, and is recomputed
	// as each one comes back so food-web chains can keep unlocking the rest.
	let balance = balanceFromReturns(countInBiome());

	// Animal returns — animals come back only when the habitat truly supports them.
	const newAnimals: any[] = [];
	const biomeAnimals = d.animals.filter((a: any) => a.biome === biomeId);
	let changed = true;
	while (changed) {
		changed = false; // loop so chains resolve (e.g. vole returns -> fox can return)
		for (const animal of biomeAnimals) {
			if (returnedIds.has(animal.id)) continue;
			if (meetsRequirements(animal, health, balance, counts, returnedIds)) {
				const disc = {
					id: `${playerId}:${animal.id}`,
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
				balance = balanceFromReturns(countInBiome()); // more life back -> more balance
				newAnimals.push({ ...disc, animal });
				changed = true;
			}
		}
	}

	// Comfort drifts with habitat quality. Removing key habitat lowers comfort
	// (animals become "rarely seen") but they are never owned or lost like pets.
	for (const disc of discoveries) {
		if (disc.biomeId !== biomeId) continue;
		const animal = d.animal.get(disc.animalId);
		if (!animal) continue;
		const comfort = computeComfort(animal, counts);
		if (comfort !== disc.comfort) await t.Discovery.patch(disc.id, { comfort });
	}

	const returnedCount = [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
	const prior = await t.BiomeState.get(`${playerId}:${biomeId}`);
	await t.BiomeState.patch(`${playerId}:${biomeId}`, { health, balance, returnedCount });
	const biomeState = {
		...(prior || { id: `${playerId}:${biomeId}`, playerId, biomeId, unlocked: biomeId === 'meadow' }),
		health, balance, returnedCount,
	};

	const unlockedBiomes = await checkUnlocks(playerId, { player: opts.player, freshState: biomeState });
	return { biomeState, newAnimals, unlockedBiomes };
}

/** Evaluate biome unlock requirements; unlock anything newly earned. */
async function checkUnlocks(
	playerId: string,
	fresh: { player?: any; freshState?: any } = {}
): Promise<any[]> {
	const t = db();
	const d = await defs();
	const player = fresh.player || (await t.Player.get(playerId));
	const unlockedNow: any[] = [];
	const unlockedSet = new Set(player.unlockedBiomes || []);

	for (const biome of d.biomes) {
		if (!biome.unlock || unlockedSet.has(biome.id)) continue;
		const u = biome.unlock;
		const prereq =
			fresh.freshState?.biomeId === u.biome ? fresh.freshState : await t.BiomeState.get(`${playerId}:${u.biome}`);
		if (!prereq || !unlockedSet.has(u.biome)) continue;
		if ((prereq.health || 0) < (u.minHealth || 0)) continue;
		if ((prereq.returnedCount || 0) < (u.minAnimals || 0)) continue;
		if (u.requiresItem) {
			const crafted = player.craftedItems?.[u.requiresItem] || 0;
			const everCrafted = player.craftedEver?.[u.requiresItem] || 0;
			if (crafted <= 0 && everCrafted <= 0) continue;
		}
		if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) continue;

		unlockedSet.add(biome.id);
		await t.Player.patch(playerId, { unlockedBiomes: [...unlockedSet] });
		await t.BiomeState.patch(`${playerId}:${biome.id}`, { unlocked: true });
		unlockedNow.push({ id: biome.id, name: biome.name });
	}
	return unlockedNow;
}

/**
 * Fetch a player's chest by id, self-healing saves where the chest placement
 * exists but its storage record is missing (older/interrupted saves). Rebuilds
 * the Chest row from the placement so the player can use it again.
 */
async function getOwnedChest(t: any, d: any, chestId: string, playerId: string): Promise<any | null> {
	const chest = await t.Chest.get(chestId);
	if (chest && chest.playerId === playerId) return chest;
	const placement = await t.Placement.get(chestId);
	if (placement && placement.playerId === playerId) {
		const def = d.object.get(placement.objectId);
		if (def?.isChest) {
			const healed = {
				id: chestId, playerId, area: placement.area, x: placement.x, y: placement.y,
				size: placement.objectId, capacity: def.chestCapacity || 60, contents: {},
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
 * player's chests — no workbench needed, crafting works anywhere.
 * Throws (and writes nothing) if materials are insufficient.
 * Returns a breakdown of where every material came from.
 */
async function consumeMaterials(player: any, materials: Record<string, number>) {
	const t = db();
	const chests = await byPlayer(t.Chest, player.id);

	// availability check first — never partially consume
	for (const [resId, qty] of Object.entries(materials)) {
		const inInv = player.inventory?.[resId] || 0;
		const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
		if (inInv + inChests < qty) {
			throw new GameError(`Not enough ${resId}: need ${qty}, have ${inInv + inChests} (basket + chests)`);
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
		if (remaining > 0) throw new GameError(`Not enough ${resId}`); // defensive; checked above
	}

	await t.Player.patch(player.id, { inventory });
	for (const chest of chests) {
		if (usedFrom.chests[chest.id]) {
			await t.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
		}
	}
	return { usedFrom, inventory };
}

// ------------------------------------------------------- snapshot for client

async function snapshot(playerId: string) {
	const t = db();
	const d = await defs();
	let player = await t.Player.get(playerId);
	// normalize saves whose last area no longer exists / isn't explorable (e.g. the retired home)
	const areaBiome = d.biome.get(player?.area);
	if (player && (!areaBiome || !areaBiome.explorable)) {
		player = { ...player, area: 'meadow', x: 10.5, y: 6.5 };
	}
	const [biomeStates, placements, chests, discoveries, nodeStates, terrain] = await Promise.all([
		byPlayer(t.BiomeState, playerId),
		byPlayer(t.Placement, playerId),
		byPlayer(t.Chest, playerId),
		byPlayer(t.Discovery, playerId),
		byPlayer(t.NodeState, playerId),
		byPlayer(t.TerrainTile, playerId),
	]);
	return {
		player: sanitizePlayer(player), biomeStates, placements, chests, discoveries, nodeStates, terrain,
		serverTime: Date.now(),
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		inventoryCapacity: inventoryCapacity(player),
	};
}

async function bodyOf(data: any) {
	const body = await data;
	if (!body || typeof body !== 'object') throw new GameError('Request body required');
	return body;
}

// ================================================================ ENDPOINTS

/**
 * MVP demo-player flow: the game endpoints are publicly accessible (no real
 * auth yet, per the MVP scope). All writes still go through full server-side
 * validation, the underlying tables are NOT exported over REST, and Harper
 * admin credentials are never used or exposed by the frontend. Swap these
 * allow* methods for role checks when real accounts are added.
 */
class PublicEndpoint extends Resource {
	allowRead() {
		return true;
	}
	allowCreate() {
		return true;
	}
	allowUpdate() {
		return true;
	}
	allowDelete() {
		return false;
	}
}

/** GET /GameData/ — all static definitions (biomes, animals, recipes, …). */
export class GameData extends PublicEndpoint {
	async get() {
		const d = await defs();
		return {
			biomes: d.biomes, animals: d.animals, resources: d.resources,
			recipes: d.recipes, habitatObjects: d.objects, tools: d.tools,
			nodeRegenSeconds: NODE_REGEN_SECONDS,
			appearanceOptions: {
				skins: SKIN_TONES, hair: HAIR_COLORS, outfits: OUTFIT_COLORS,
				hats: HAT_STYLES, hairstyles: HAIRSTYLES, bodies: BODY_TYPES,
			},
		};
	}
}

/** POST /CreatePlayer/ {name, passcode, appearance} — start a brand-new save. */
export class CreatePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode, appearance } = await bodyOf(data);
		const cleanName = String(name || '').trim();
		if (cleanName.length < 2 || cleanName.length > 24) throw new GameError('Pick a name between 2 and 24 characters');
		const code = String(passcode || '');
		if (code.length < 4 || code.length > 32) throw new GameError('Pick a passcode of at least 4 characters');
		const playerId = slugId(cleanName);
		if (!playerId) throw new GameError('That name needs at least one letter or number');

		const existing = await db().Player.get(playerId);
		if (existing) throw new GameError('A save with that name already exists — try Load Game instead', 409);

		const created = await createPlayerRecords(playerId, cleanName, code, sanitizeAppearance(appearance));
		return { ok: true, playerId, state: freshSnapshot(created) };
	}
}

/**
 * POST /DeletePlayer/ {name, passcode} — permanently delete a save and every
 * record that belongs to it. Passcode required so nobody can wipe your preserve.
 */
export class DeletePlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode } = await bodyOf(data);
		const playerId = slugId(String(name || ''));
		const player = playerId ? await db().Player.get(playerId) : null;
		if (!player) throw new GameError('No save found with that name', 404);
		if (String(passcode || '') !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);

		const t = db();
		let removed = 0;
		for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile]) {
			for (const rec of await byPlayer(table, playerId)) {
				await table.delete(rec.id);
				removed++;
			}
		}
		await t.Player.delete(playerId);
		return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
	}
}

/** POST /LoginPlayer/ {name, passcode} — load an existing save. */
export class LoginPlayer extends PublicEndpoint {
	async post(data: any) {
		const { name, passcode } = await bodyOf(data);
		const playerId = slugId(String(name || ''));
		const player = playerId ? await db().Player.get(playerId) : null;
		if (!player) throw new GameError('No save found with that name — try New Game', 404);
		if (String(passcode || '') !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);
		// persist migration for saves stranded in the retired home interior
		const d = await defs();
		const areaBiome = d.biome.get(player.area);
		if (!areaBiome || !areaBiome.explorable) {
			await db().Player.patch(playerId, { area: 'meadow', x: 10.5, y: 6.5 });
		}
		return { ok: true, playerId, state: await snapshot(playerId) };
	}
}

/** GET /GameState/<playerId> — create-or-load the player and return everything. */
export class GameState extends PublicEndpoint {
	async get() {
		const playerId = String(this.getId() || '');
		await requirePlayer(playerId);
		// note: GET handlers must not write — invalid areas are normalized in snapshot()
		return snapshot(playerId);
	}
}

/** POST /CollectResource/ {playerId, biomeId, nodeId, resourceId} */
export class CollectResource extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId, nodeId, resourceId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const biome = d.biome.get(biomeId);
		if (!biome) throw new GameError(`Unknown biome: ${biomeId}`);
		if (!(player.unlockedBiomes || []).includes(biomeId)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
		if (!(biome.resources || []).includes(resourceId)) throw new GameError(`${resourceId} is not found in ${biome.name}`);
		const resDef = d.resource.get(resourceId);
		if (!resDef) throw new GameError(`Unknown resource: ${resourceId}`);
		if (!nodeId || typeof nodeId !== 'string') throw new GameError('nodeId required');

		// node regeneration cooldown
		const nodeKey = `${playerId}:${biomeId}:${nodeId}`;
		const nodeState = await t.NodeState.get(nodeKey);
		const now = Date.now();
		if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1000) {
			throw new GameError('This spot is still regrowing — come back soon', 409);
		}

		// carrying capacity (gathering basket)
		const capacity = inventoryCapacity(player);
		const carried = sumValues(player.inventory);
		if (carried >= capacity) throw new GameError('Your basket is full — store materials in a chest first', 409);

		// upgraded tool for this material type gathers an extra one
		const toolTier = player.tools?.[resDef.tool] || 1;
		const amount = Math.min(toolTier >= 2 ? 2 : 1, capacity - carried);

		const inventory = { ...(player.inventory || {}) };
		inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		await t.Player.patch(playerId, { inventory });
		await t.NodeState.put({ id: nodeKey, playerId, harvestedAt: now });

		return { ok: true, gained: { [resourceId]: amount }, inventory, nodeId, harvestedAt: now };
	}
}

/** POST /ChestTransfer/ {playerId, chestId, resourceId, qty, direction: 'deposit'|'withdraw'} */
export class ChestTransfer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const amount = posInt(qty, 'qty');
		const chest = await getOwnedChest(t, d, chestId, playerId);
		if (!chest) throw new GameError('Chest not found', 404);

		const inventory = { ...(player.inventory || {}) };
		const contents = { ...(chest.contents || {}) };

		if (direction === 'deposit') {
			if ((inventory[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in your inventory`);
			if (sumValues(contents) + amount > chest.capacity) throw new GameError('That chest is full', 409);
			inventory[resourceId] -= amount;
			if (inventory[resourceId] <= 0) delete inventory[resourceId];
			contents[resourceId] = (contents[resourceId] || 0) + amount;
		} else if (direction === 'withdraw') {
			if ((contents[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in that chest`);
			if (sumValues(inventory) + amount > inventoryCapacity(player)) throw new GameError('Your basket is full', 409);
			contents[resourceId] -= amount;
			if (contents[resourceId] <= 0) delete contents[resourceId];
			inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		} else {
			throw new GameError("direction must be 'deposit' or 'withdraw'");
		}

		await t.Player.patch(playerId, { inventory });
		await t.Chest.patch(chestId, { contents });
		return { ok: true, inventory, chest: { ...chest, contents } };
	}
}

/**
 * POST /DiscardItem/ {playerId, kind: 'material'|'crafted', id, qty}
 * Throw away unwanted basket materials or crafted items. Validated server-side
 * (you can't discard more than you hold); discarded things are simply gone.
 */
export class DiscardItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, kind, id, qty } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const amount = posInt(qty, 'qty');
		if (!id || typeof id !== 'string') throw new GameError('id required');

		if (kind === 'crafted') {
			const craftedItems = { ...(player.craftedItems || {}) };
			if ((craftedItems[id] || 0) < amount) throw new GameError('You do not have that many to throw away');
			craftedItems[id] -= amount;
			if (craftedItems[id] <= 0) delete craftedItems[id];
			await t.Player.patch(playerId, { craftedItems });
			return { ok: true, craftedItems };
		}

		const inventory = { ...(player.inventory || {}) };
		if ((inventory[id] || 0) < amount) throw new GameError('You do not have that many to throw away');
		inventory[id] -= amount;
		if (inventory[id] <= 0) delete inventory[id];
		await t.Player.patch(playerId, { inventory });
		return { ok: true, inventory };
	}
}

/** POST /CraftItem/ {playerId, recipeId} — uses inventory + chests linked to the workbench. */
export class CraftItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, recipeId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const recipe = d.recipe.get(recipeId);
		if (!recipe) throw new GameError(`Unknown recipe: ${recipeId}`);
		if (recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
			throw new GameError('This recipe unlocks with a biome you have not restored yet', 403);
		}
		if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
			const tool = d.tool.get(recipe.requiresTool.id);
			throw new GameError(`Requires the upgraded ${tool?.name || recipe.requiresTool.id}`, 403);
		}

		const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {});

		const itemDef = d.object.get(recipe.output.itemId);
		const craftedItems = { ...(player.craftedItems || {}) };
		const craftedEver = { ...(player.craftedEver || {}) };
		if (itemDef?.bundle) {
			// restoration bundles unpack into several habitat items
			for (const [bid, bqty] of Object.entries(itemDef.bundle)) {
				craftedItems[bid] = (craftedItems[bid] || 0) + (bqty as number);
				craftedEver[bid] = (craftedEver[bid] || 0) + (bqty as number);
			}
			craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + 1;
		} else {
			craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
			craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		}
		await t.Player.patch(playerId, { craftedItems, craftedEver });

		// crafting key items (e.g. the water restoration kit) can unlock biomes
		const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, craftedItems, craftedEver } });

		const chests = await byPlayer(t.Chest, playerId);
		return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, unlockedBiomes };
	}
}

/** POST /PlaceObject/ {playerId, objectId, area, x, y} — area is a biome id or 'home'. */
export class PlaceObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, objectId, area, x, y } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const def = d.object.get(objectId);
		if (!def) throw new GameError(`Unknown object: ${objectId}`);
		if (def.placement === 'none') throw new GameError(`${def.name} is a kit, not a placeable object`);
		if ((player.craftedItems?.[objectId] || 0) <= 0) throw new GameError(`You have no crafted ${def.name} to place`);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
			throw new GameError('That spot is out of reach');
		}

		const biome = d.biome.get(area);
		if (!biome) throw new GameError(`Unknown area: ${area}`);
		if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
		if (def.placement === 'indoor') throw new GameError(`${def.name} cannot be placed out in the preserve`);
		if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} does not suit the ${biome.name} habitat`);
		if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
			throw new GameError(`Placing ${def.name} requires an upgraded ${d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id}`, 403);
		}

		const placements = await byPlayer(t.Placement, playerId);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError('That spot is already taken', 409);
		}
		const tileHere = await t.TerrainTile.get(`${playerId}:${area}:${tx}:${ty}`);
		if (tileHere && tileHere.playerId === playerId) {
			if (tileHere.type === 'water') {
				if (!def.bridge) throw new GameError('That is open water — a wooden bridge can span it', 409);
			} else {
				throw new GameError('That soil bed is for planting — or clear it with the shovel', 409);
			}
		} else if (def.bridge) {
			throw new GameError('Bridges go over open water — flood a channel first', 409);
		}

		const craftedItems = { ...(player.craftedItems || {}) };
		craftedItems[objectId] -= 1;
		if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
		await t.Player.patch(playerId, { craftedItems });

		const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = { id: placementId, playerId, objectId, area, x: tx, y: ty, placedAt: Date.now() };
		await t.Placement.put(placement);

		if (def.isChest) {
			await t.Chest.put({
				id: placementId, playerId, area, x: tx, y: ty,
				size: objectId, capacity: def.chestCapacity || 60, contents: {},
			});
		}

		const recalc = await recalcBiome(playerId, area, {
			addPlacements: [placement],
			player: { ...player, craftedItems },
		});
		return { ok: true, placement, craftedItems, ...recalc };
	}
}

/**
 * POST /Plant/ {playerId, area, x, y, plantId}
 * Sow flowers and trees directly into a watered soil bed. The bed is consumed
 * and becomes a growing plant (a placement with a plantedAt timestamp).
 */
export class Plant extends PublicEndpoint {
	async post(data: any) {
		const { playerId, area, x, y, plantId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError(`Unknown area: ${area}`);
		if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);

		const def = d.object.get(plantId);
		if (!def || !def.plantable) throw new GameError('That cannot be planted');
		if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} would not take root in the ${biome.name}`);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const tileId = `${playerId}:${area}:${tx}:${ty}`;
		const bed = await t.TerrainTile.get(tileId);
		if (!bed || bed.playerId !== playerId || bed.type !== 'watered') {
			throw new GameError('Plant into a watered soil bed — dig with the shovel, then water it');
		}

		const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {});

		await t.TerrainTile.delete(tileId); // the bed becomes the plant
		const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const placement = {
			id: placementId, playerId, objectId: plantId, area, x: tx, y: ty,
			placedAt: Date.now(), plantedAt: Date.now(),
		};
		await t.Placement.put(placement);

		const recalc = await recalcBiome(playerId, area, {
			addPlacements: [placement],
			removeTerrainIds: [tileId],
			player: { ...player, inventory },
		});
		return { ok: true, placement, inventory, usedFrom, ...recalc };
	}
}

/** POST /UpdateAppearance/ {playerId, appearance} — restyle your caretaker anytime. */
export class UpdateAppearance extends PublicEndpoint {
	async post(data: any) {
		const { playerId, appearance } = await bodyOf(data);
		await requirePlayer(playerId);
		const clean = sanitizeAppearance(appearance);
		await db().Player.patch(playerId, { appearance: clean });
		return { ok: true, appearance: clean };
	}
}

/** POST /MoveObject/ {playerId, placementId, x, y} — relocate a placed object within its area. */
export class MoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, x, y } = await bodyOf(data);
		const t = db();
		await requirePlayer(playerId);

		const placement = await t.Placement.get(placementId);
		if (!placement || placement.playerId !== playerId) throw new GameError('Placement not found', 404);
		if (placement.objectId === 'workbench') throw new GameError('The old workbench stays put');

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
			throw new GameError('That spot is out of reach');
		}
		const placements = await byPlayer(t.Placement, playerId);
		if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
			throw new GameError('That spot is already taken', 409);
		}
		const d = await defs();
		const movingDef = d.object.get(placement.objectId);
		const tileHere = await t.TerrainTile.get(`${playerId}:${placement.area}:${tx}:${ty}`);
		if (tileHere && tileHere.playerId === playerId) {
			if (tileHere.type === 'water') {
				if (!movingDef?.bridge) throw new GameError('That is open water — only a bridge can sit there', 409);
			} else {
				throw new GameError('That soil bed is for planting', 409);
			}
		} else if (movingDef?.bridge) {
			throw new GameError('Bridges go over open water', 409);
		}

		await t.Placement.patch(placementId, { x: tx, y: ty });
		const chest = await getOwnedChest(t, d, placementId, playerId);
		if (chest) await t.Chest.patch(placementId, { x: tx, y: ty }); // chests move with their contents

		return { ok: true, placement: { ...placement, x: tx, y: ty } };
	}
}

/** POST /RemoveObject/ {playerId, placementId} — returns the object to your crafted items. */
export class RemoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);

		const placement = await t.Placement.get(placementId);
		if (!placement || placement.playerId !== playerId) throw new GameError('Placement not found', 404);
		if (placement.objectId === 'workbench') {
			throw new GameError('Your crafting station stays put — the preserve needs it');
		}

		const chest = await t.Chest.get(placementId);
		if (chest && sumValues(chest.contents) > 0) {
			throw new GameError('Empty the chest before picking it up', 409);
		}

		// Digging up something you planted returns its materials instead of an item.
		// Refunds respect basket capacity and spill into chests — never silently
		// overflowing the basket (which used to wedge every later withdraw/gather).
		const d = await defs();
		const def = d.object.get(placement.objectId);
		let refunded: Record<string, number> | null = null;
		const craftedItems = { ...(player.craftedItems || {}) };
		const inventory = { ...(player.inventory || {}) };
		const chestUpdates = new Map<string, Record<string, number>>();
		if (def?.plantable && placement.plantedAt && Object.keys(def.plantCost || {}).length) {
			refunded = { ...def.plantCost };
			const capacity = inventoryCapacity(player);
			let carried = sumValues(inventory);
			const chests = (await byPlayer(t.Chest, playerId)).filter((c) => c.id !== placementId);
			for (const [resId, qty] of Object.entries(refunded!)) {
				let remaining = qty as number;
				const toBasket = Math.min(remaining, Math.max(0, capacity - carried));
				if (toBasket > 0) {
					inventory[resId] = (inventory[resId] || 0) + toBasket;
					carried += toBasket;
					remaining -= toBasket;
				}
				for (const c of chests) {
					if (remaining <= 0) break;
					const contents = chestUpdates.get(c.id) || { ...(c.contents || {}) };
					const room = c.capacity - sumValues(contents);
					const toChest = Math.min(room, remaining);
					if (toChest > 0) {
						contents[resId] = (contents[resId] || 0) + toChest;
						chestUpdates.set(c.id, contents);
						remaining -= toChest;
					}
				}
				if (remaining > 0) {
					throw new GameError('No room for the refunded materials — make space in your basket or a chest first', 409);
				}
			}
		} else {
			craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
		}

		// all checks passed — now write
		if (chest) await t.Chest.delete(placementId);
		await t.Placement.delete(placementId);
		if (refunded) {
			await t.Player.patch(playerId, { inventory });
			for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
		} else {
			await t.Player.patch(playerId, { craftedItems });
		}

		// old saves may still hold retired 'home' placements — skip recalc for those
		const recalc = placement.area !== 'home'
			? await recalcBiome(playerId, placement.area, {
				removeIds: [placementId],
				player: { ...player, craftedItems, inventory },
			})
			: null;
		return { ok: true, removed: placementId, craftedItems, refunded, ...(recalc || {}) };
	}
}

/** POST /UpgradeTool/ {playerId, toolId} */
export class UpgradeTool extends PublicEndpoint {
	async post(data: any) {
		const { playerId, toolId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const toolDef = d.tool.get(toolId);
		if (!toolDef) throw new GameError(`Unknown tool: ${toolId}`);
		const currentTier = player.tools?.[toolId] || 1;
		const nextTier = (toolDef.tiers || []).find((tt: any) => tt.tier === currentTier + 1);
		if (!nextTier) throw new GameError(`${toolDef.name} is already fully upgraded`);

		if (nextTier.requires?.biome) {
			const bs = await t.BiomeState.get(`${playerId}:${nextTier.requires.biome}`);
			if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
				const biome = d.biome.get(nextTier.requires.biome);
				throw new GameError(
					`Restore ${biome?.name || nextTier.requires.biome} to ${nextTier.requires.minHealth}% health first`, 403
				);
			}
		}

		const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {});
		const tools = { ...(player.tools || {}), [toolId]: nextTier.tier };
		await t.Player.patch(playerId, { tools });

		// tool upgrades can satisfy biome unlock requirements
		const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, tools } });
		const chests = await byPlayer(t.Chest, playerId);
		return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
	}
}

/** POST /ObserveAnimal/ {playerId, animalId} — record an observation in the field journal. */
export class ObserveAnimal extends PublicEndpoint {
	async post(data: any) {
		const { playerId, animalId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		await requirePlayer(playerId);

		const disc = await t.Discovery.get(`${playerId}:${animalId}`);
		if (!disc) throw new GameError('That animal has not returned yet', 404);
		const timesObserved = (disc.timesObserved || 0) + 1;
		await t.Discovery.patch(disc.id, { timesObserved });
		return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
	}
}

/**
 * POST /Terraform/ {playerId, area, x, y, action: 'dig'|'water'|'clear'}
 * Gentle landscape shaping: the shovel prepares a soil bed, the watering can
 * brings it to life (consuming 1 water), and digging again clears it.
 * Watered beds raise biome health directly.
 */
export class Terraform extends PublicEndpoint {
	async post(data: any) {
		const { playerId, area, x, y, action } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError('You can only shape the ground out in the preserve');
		if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
			throw new GameError('That spot is out of reach');
		}
		const placements = await byPlayer(t.Placement, playerId);
		if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
			throw new GameError('Something is already placed there');
		}

		const tileId = `${playerId}:${area}:${tx}:${ty}`;
		const existing = await t.TerrainTile.get(tileId);
		let inventory = player.inventory || {};
		let tile: any = null;
		let removedId: string | undefined;

		if (action === 'dig') {
			if ((player.tools?.shovel || 0) < 1) throw new GameError('You need your shovel for that');
			if (existing) throw new GameError('This ground is already prepared — water it, or clear it instead');
			tile = { id: tileId, playerId, area, x: tx, y: ty, type: 'tilled', updatedAt: Date.now() };
			await t.TerrainTile.put(tile);
		} else if (action === 'water') {
			if ((player.tools?.['watering-can'] || 0) < 1) throw new GameError('You need your watering can for that');
			if (!existing) throw new GameError('Prepare a soil bed with your shovel first');
			if (existing.type === 'water') throw new GameError('This is already open water');
			// tilled -> watered bed (1 water); watered -> flooded open water (2 water).
			// Chain open-water tiles to shape ponds, lakes, and rivers.
			const cost = existing.type === 'tilled' ? 1 : 2;
			const newType = existing.type === 'tilled' ? 'watered' : 'water';
			const have = (inventory.water || 0) + (inventory['clean-water'] || 0);
			if (have < cost) throw new GameError(`You need ${cost} water for that — gather more first`);
			inventory = { ...inventory };
			let remaining = cost;
			for (const key of ['water', 'clean-water']) {
				const take = Math.min(inventory[key] || 0, remaining);
				if (take > 0) {
					inventory[key] -= take;
					if (inventory[key] <= 0) delete inventory[key];
					remaining -= take;
				}
			}
			await t.Player.patch(playerId, { inventory });
			tile = { ...existing, type: newType, updatedAt: Date.now() };
			await t.TerrainTile.patch(tileId, { type: newType, updatedAt: Date.now() });
		} else if (action === 'clear') {
			if (!existing) throw new GameError('Nothing to clear here');
			await t.TerrainTile.delete(tileId);
			removedId = tileId;
		} else {
			throw new GameError("action must be 'dig', 'water', or 'clear'");
		}

		const recalc = await recalcBiome(playerId, area, {
			addTerrain: tile ? [tile] : [],
			removeTerrainIds: removedId ? [removedId] : [],
			player: { ...player, inventory },
		});
		return { ok: true, tile, removedId, inventory, ...recalc };
	}
}

/** POST /RecalcBiome/ {playerId, biomeId} — explicit recalculation (also runs on every placement). */
export class RecalcBiome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId } = await bodyOf(data);
		await requirePlayer(playerId);
		return { ok: true, ...(await recalcBiome(playerId, biomeId)) };
	}
}

/** POST /SyncPlayer/ {playerId, x, y, area} — persist position (the save point for movement). */
export class SyncPlayer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, x, y, area, tutorialStep } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const patch: any = {};
		if (Number.isFinite(Number(x))) patch.x = Number(x);
		if (Number.isFinite(Number(y))) patch.y = Number(y);
		if (Number.isInteger(tutorialStep) && tutorialStep >= 0 && tutorialStep <= 99) {
			patch.tutorialStep = tutorialStep;
		}
		if (area) {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(`Unknown area: ${area}`);
			if (!(player.unlockedBiomes || []).includes(area)) {
				throw new GameError(`${biome.name} is not unlocked yet`, 403);
			}
			if (!biome.explorable) {
				throw new GameError(`${biome.name} is part of the preserve plan but not explorable yet`, 403);
			}
			patch.area = area;
		}
		await t.Player.patch(playerId, patch);
		return { ok: true, player: await t.Player.get(playerId) };
	}
}

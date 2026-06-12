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
const CAPACITY_BY_BASKET: Record<number, number> = { 1: 80, 2: 160, 3: 260, 4: 380 };

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

// --------------------------------------------------------------- metrics
// Lightweight per-player analytics, stored as a `metrics` blob on the Player
// record. Action counters are bumped from the relevant endpoints; play time
// and session counts are accrued from client heartbeats (see Heartbeat).
// Surfaced for dashboards via the read-only Metrics endpoint.

function freshMetrics(now: number) {
	return {
		firstSeenAt: now,
		lastSeenAt: now,
		lastHeartbeatAt: 0,
		playSeconds: 0,
		sessions: 0,
		counts: {} as Record<string, number>,
	};
}

/**
 * Merge action-count deltas into player.metrics and persist. `player` is the
 * record we already loaded (counters live in their own key, so this never
 * clobbers a concurrent inventory/crafted patch). No-ops if nothing to add.
 */
async function bumpMetrics(player: any, deltas: Record<string, number> = {}): Promise<any> {
	if (!player?.id) return null;
	const entries = Object.entries(deltas).filter(([, v]) => v);
	if (!entries.length) return player.metrics || null;
	const now = Date.now();
	const prev = player.metrics || freshMetrics(player.createdAt || now);
	const counts = { ...(prev.counts || {}) };
	for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
	const metrics = { ...prev, counts, lastSeenAt: now };
	await db().Player.patch(player.id, { metrics });
	return metrics;
}

/** Shape the stored metrics into a tidy, derived view for the Metrics endpoint. */
const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function metricsView(player: any) {
	const now = Date.now();
	const m = player.metrics || freshMetrics(player.createdAt || now);
	const playSeconds = m.playSeconds || 0;
	const sessions = m.sessions || 0;
	const counts: Record<string, number> = m.counts || {};
	const totalActions = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
	const createdAt = player.createdAt || m.firstSeenAt || now;
	const lastSeenAt = m.lastSeenAt || null;

	// Recency drives the engagement picture: how long ago did they last play,
	// and how should we bucket them (active / recent / dormant).
	const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 3_600_000) : null;
	const daysSinceJoined = Math.floor((now - createdAt) / DAY_MS);
	let status: 'active' | 'recent' | 'dormant' = 'dormant';
	if (hoursSinceActive != null) {
		if (hoursSinceActive <= 24) status = 'active';
		else if (hoursSinceActive <= 24 * 7) status = 'recent';
	}

	return {
		playerId: player.id,
		name: player.name,
		createdAt,
		firstSeenAt: m.firstSeenAt || createdAt,
		lastSeenAt,
		daysSinceJoined,
		hoursSinceActive,
		status,
		isNewToday: now - createdAt <= DAY_MS,
		// time + sessions
		sessions,
		playSeconds,
		playMinutes: Math.round(playSeconds / 60),
		avgSessionMinutes: sessions ? Math.round(playSeconds / 60 / sessions) : 0,
		// engagement intensity
		totalActions,
		actionsPerSession: sessions ? round1(totalActions / sessions) : 0,
		actionsPerMinute: playSeconds > 0 ? round1(totalActions / (playSeconds / 60)) : 0,
		// where they are in the game
		tutorialStep: player.tutorialStep || 0,
		currentArea: player.area || null,
		unlockedBiomes: (player.unlockedBiomes || []).length,
		counts,
	};
}

/**
 * Activation funnel flags for one player. Uses durable state where available
 * (craftedEver, unlocked biomes, animals returned) so players who progressed
 * before action-counting existed still register on the funnel.
 */
function activationFlags(view: any, biomeSummary: any, player: any) {
	const c = view.counts || {};
	return {
		collected: (c.resourcesCollected || 0) > 0,
		crafted: (c.itemsCrafted || 0) > 0 || Object.keys(player.craftedEver || {}).length > 0,
		placed: (c.objectsPlaced || 0) > 0,
		attractedAnimal: (biomeSummary?.totalAnimalsReturned || 0) > 0,
		unlockedSecondBiome: (view.unlockedBiomes || 0) >= 2,
	};
}

// --------------------------------------------------- biome health + snapshots
// Per-biome restoration metrics, plus an on-the-fly SVG "postcard" of what each
// area currently looks like (ground tinted by health, terrain beds, and every
// placed object as a colored marker), returned as a base64 data URI so it drops
// straight into an <img src> or a dashboard.

const GRID_W = 30; // matches OUT_W in the client world scene
const GRID_H = 20; // matches OUT_H

const TERRAIN_COLORS: Record<string, string> = {
	tilled: '#8a6a48',
	watered: '#6b4f33',
	water: '#5d96c8',
};

/** Linear blend between two #rrggbb colors (t = 0 → a, 1 → b). */
function lerpHex(a: string, b: string, t: number): string {
	const pa = parseInt(a.slice(1), 16);
	const pb = parseInt(b.slice(1), 16);
	const mix = (sh: number) => {
		const ca = (pa >> sh) & 255;
		const cb = (pb >> sh) & 255;
		return Math.round(ca + (cb - ca) * clamp(t, 0, 1));
	};
	return '#' + [mix(16), mix(8), mix(0)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

const svgEscape = (s: string) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render a top-down schematic of one area as an SVG string. */
function renderBiomeSVG(d: any, biome: any, health: number, placements: any[], terrain: any[]): string {
	const cell = 16;
	const pad = 8;
	const labelH = 22;
	const W = GRID_W * cell + pad * 2;
	const H = GRID_H * cell + pad * 2 + labelH;
	const damaged = biome?.palette?.damaged || '#b9a37c';
	const healthy = biome?.palette?.healthy || '#8fbf6f';
	const ground = lerpHex(damaged, healthy, health / 100);
	const groundDark = lerpHex(damaged, healthy, (health / 100) * 0.8);
	const px = (x: number) => pad + x * cell;
	const py = (y: number) => pad + y * cell;

	const parts: string[] = [];
	parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${ground}"/>`);
	// faint checkerboard for a bit of ground texture
	for (let gy = 0; gy < GRID_H; gy++) {
		for (let gx = 0; gx < GRID_W; gx++) {
			if ((gx + gy) % 2 === 0) {
				parts.push(`<rect x="${px(gx)}" y="${py(gy)}" width="${cell}" height="${cell}" fill="${groundDark}" opacity="0.22"/>`);
			}
		}
	}
	for (const tt of terrain) {
		const c = TERRAIN_COLORS[tt.type];
		if (!c) continue;
		parts.push(`<rect x="${px(tt.x)}" y="${py(tt.y)}" width="${cell}" height="${cell}" rx="3" fill="${c}"/>`);
	}
	for (const p of placements) {
		const def = d.object.get(p.objectId);
		const c = def?.color || '#6b5a3a';
		parts.push(
			`<circle cx="${px(p.x) + cell / 2}" cy="${py(p.y) + cell / 2}" r="${cell * 0.42}" fill="${c}" stroke="#2b3321" stroke-opacity="0.35"/>`,
		);
	}
	parts.push(`<rect x="0" y="${H - labelH}" width="${W}" height="${labelH}" fill="#2b3321" opacity="0.55"/>`);
	parts.push(
		`<text x="${pad}" y="${H - 7}" font-family="sans-serif" font-size="12" fill="#fdfaf0">${svgEscape(biome?.name || 'Area')} — ${health}% health · ${placements.length} placed</text>`,
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function svgDataUri(svg: string): string {
	// Buffer is a Node global in the Harper runtime; reach it via globalThis so
	// we don't need @types/node just for this.
	const B = (globalThis as any).Buffer;
	return 'data:image/svg+xml;base64,' + B.from(svg, 'utf8').toString('base64');
}

/**
 * Gather per-biome restoration metrics for a player. With `images: true` each
 * unlocked biome also gets a `snapshot` data URI rendered from its current
 * placements and terrain.
 */
async function biomeMetrics(playerId: string, opts: { images?: boolean } = {}) {
	const t = db();
	const d = await defs();
	const states = await byPlayer(t.BiomeState, playerId);
	const byId = new Map(states.map((s) => [s.biomeId, s]));
	const placements = opts.images ? await byPlayer(t.Placement, playerId) : [];
	const terrain = opts.images ? await byPlayer(t.TerrainTile, playerId) : [];

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
		if (opts.images && s.unlocked) {
			const pls = placements.filter((p) => p.area === b.id);
			const ter = terrain.filter((tt) => tt.area === b.id);
			entry.placements = pls.length;
			entry.snapshot = svgDataUri(renderBiomeSVG(d, b, entry.health, pls, ter));
		}
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
		metrics: freshMetrics(now),
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

/**
 * Analyze the player's open-water tiles (terraformed type 'water') in a biome.
 * Returns total tile count, the largest connected body ("lake"), and the
 * longest connected span ("river") — long, thin channels score high on river,
 * big blobs score high on lake. 4-neighbour connectivity.
 */
function analyzeWater(terrain: any[]) {
	const cells = new Set(terrain.filter((t) => t.type === 'water').map((t) => `${t.x},${t.y}`));
	const seen = new Set<string>();
	let lake = 0;
	let river = 0;
	for (const key of cells) {
		if (seen.has(key)) continue;
		const stack = [key];
		seen.add(key);
		let size = 0;
		let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
		while (stack.length) {
			const [x, y] = stack.pop()!.split(',').map(Number);
			size++;
			minx = Math.min(minx, x); maxx = Math.max(maxx, x);
			miny = Math.min(miny, y); maxy = Math.max(maxy, y);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nk = `${x + dx},${y + dy}`;
				if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
			}
		}
		lake = Math.max(lake, size);
		river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
	}
	return { tiles: cells.size, lake, river };
}

function meetsRequirements(
	animal: any,
	health: number,
	balance: number,
	counts: Record<string, number>,
	returnedIds: Set<string>,
	water: { tiles: number; lake: number; river: number },
) {
	const req = animal.requirements || {};
	if (health < (req.minHealth || 0)) return false;
	if (balance < (req.minBalance || 0)) return false;
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
	if (req.water) {
		const w = req.water;
		if (w.lake) parts.push(`a lake of ${w.lake}+ open-water tiles`);
		else if (w.river) parts.push(`a river ${w.river}+ tiles long`);
		else if (w.tiles) parts.push(`${w.tiles}+ open-water tiles`);
	}
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
	// rivers and lakes shaped with the watering can feed water-dwelling animals
	const water = analyzeWater(terrain);

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
	// One habitat = one animal: at most a single new animal returns per change, so
	// building out a biome brings visitors back one at a time rather than summoning
	// a whole swarm at once. Food-web chains resolve over subsequent actions.
	const newAnimals: any[] = [];
	const biomeAnimals = d.animals.filter((a: any) => a.biome === biomeId);
	for (const animal of biomeAnimals) {
		if (returnedIds.has(animal.id)) continue;
		if (meetsRequirements(animal, health, balance, counts, returnedIds, water)) {
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
			break;
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

// Areas that begin partly shaped when first unlocked. Rushwater Wetland opens
// with channels and a pond already terraformed, so it reads as a wetland the
// moment you arrive — and gives the river/lake animals something to build on.
const STARTING_TERRAIN: Record<string, { x: number; y: number; type: string }[]> = {
	wetland: [
		// a winding river across the north
		...[6, 7, 8, 9, 10, 11, 12, 13, 14].map((x) => ({ x, y: 4, type: 'water' })),
		{ x: 14, y: 5, type: 'water' }, { x: 14, y: 6, type: 'water' }, { x: 15, y: 6, type: 'water' },
		// a small open pond
		{ x: 20, y: 6, type: 'water' }, { x: 21, y: 6, type: 'water' }, { x: 22, y: 6, type: 'water' },
		{ x: 20, y: 7, type: 'water' }, { x: 21, y: 7, type: 'water' }, { x: 22, y: 7, type: 'water' },
		// a couple of watered beds ready to plant
		{ x: 10, y: 14, type: 'watered' }, { x: 11, y: 14, type: 'watered' },
	],
};

/** Pre-shape an area's starting terrain the first time it unlocks. */
async function seedStartingTerrain(playerId: string, biomeId: string) {
	const layout = STARTING_TERRAIN[biomeId];
	if (!layout) return;
	const t = db();
	for (const cell of layout) {
		const id = `${playerId}:${biomeId}:${cell.x}:${cell.y}`;
		if (await t.TerrainTile.get(id)) continue; // never overwrite the player's own work
		await t.TerrainTile.put({ id, playerId, area: biomeId, x: cell.x, y: cell.y, type: cell.type, updatedAt: Date.now() });
	}
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
		await seedStartingTerrain(playerId, biome.id);
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
		// Reset the heartbeat clock so the first beat after login is counted as a
		// fresh play session (and back-fill metrics for saves made before tracking).
		const now = Date.now();
		const prev = player.metrics || freshMetrics(player.createdAt || now);
		await db().Player.patch(playerId, { metrics: { ...prev, lastHeartbeatAt: 0, lastSeenAt: now } });
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

		// a higher-tier tool gathers more at once (tier 1→1 … tier 4→4)
		const toolTier = player.tools?.[resDef.tool] || 1;
		const amount = Math.min(Math.max(1, toolTier), capacity - carried);

		const inventory = { ...(player.inventory || {}) };
		inventory[resourceId] = (inventory[resourceId] || 0) + amount;
		await t.Player.patch(playerId, { inventory });
		await t.NodeState.put({ id: nodeKey, playerId, harvestedAt: now });

		await bumpMetrics(player, { resourcesCollected: amount });
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
		// One-time recipes (restoration kits) can only ever be crafted once.
		if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
			throw new GameError(`You have already crafted the ${recipe.name} — it only needs to be made once.`, 409);
		}

		const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {});

		const craftedItems = { ...(player.craftedItems || {}) };
		const craftedEver = { ...(player.craftedEver || {}) };
		craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		await t.Player.patch(playerId, { craftedItems, craftedEver });

		// crafting key items (e.g. the water restoration kit) can unlock biomes
		const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, craftedItems, craftedEver } });

		const chests = await byPlayer(t.Chest, playerId);
		await bumpMetrics(player, { itemsCrafted: 1 });
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
		await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 });
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
		await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 });
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
		await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
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
		await bumpMetrics(player, { toolsUpgraded: 1 });
		return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
	}
}

/** POST /ObserveAnimal/ {playerId, animalId} — record an observation in the field journal. */
export class ObserveAnimal extends PublicEndpoint {
	async post(data: any) {
		const { playerId, animalId } = await bodyOf(data);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const disc = await t.Discovery.get(`${playerId}:${animalId}`);
		if (!disc) throw new GameError('That animal has not returned yet', 404);
		const timesObserved = (disc.timesObserved || 0) + 1;
		await t.Discovery.patch(disc.id, { timesObserved });
		await bumpMetrics(player, { animalsObserved: 1 });
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
		await bumpMetrics(player, { terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 });
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

			// First time stepping into an area that begins partly shaped, seed its
			// starting terrain now. This also back-fills saves that unlocked the area
			// before the starting-terrain feature existed (e.g. wetlands already open).
			if (STARTING_TERRAIN[area]) {
				const hasTerrain = (await byPlayer(t.TerrainTile, playerId)).some((tt) => tt.area === area);
				if (!hasTerrain) {
					await seedStartingTerrain(playerId, area);
					await recalcBiome(playerId, area, { player });
				}
			}
		}
		await t.Player.patch(playerId, patch);
		return { ok: true, player: await t.Player.get(playerId) };
	}
}

const SESSION_GAP_MS = 30 * 60 * 1000; // a fresh heartbeat after this gap = a new session
const MAX_BEAT_MS = 90 * 1000; // credit at most this much play time per beat (guards idle/closed tabs)

/**
 * POST /Heartbeat/ {playerId} — the client pings this on a timer while the game
 * is open and focused. We accrue play time from the gap since the last beat
 * (capped, so a backgrounded tab or a closed laptop never inflates the number)
 * and count a new session whenever the gap is large or it's the first beat.
 */
export class Heartbeat extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const now = Date.now();
		const prev = player.metrics || freshMetrics(player.createdAt || now);
		const last = prev.lastHeartbeatAt || 0;
		const gap = now - last;

		let playSeconds = prev.playSeconds || 0;
		let sessions = prev.sessions || 0;
		if (last === 0 || gap > SESSION_GAP_MS) {
			sessions += 1; // first beat of a new play session
		} else {
			playSeconds += Math.min(gap, MAX_BEAT_MS) / 1000;
		}

		const metrics = {
			...prev,
			firstSeenAt: prev.firstSeenAt || player.createdAt || now,
			lastSeenAt: now,
			lastHeartbeatAt: now,
			playSeconds: Math.round(playSeconds),
			sessions,
		};
		await t.Player.patch(playerId, { metrics });
		return { ok: true, metrics: metricsView({ ...player, metrics }) };
	}
}

/**
 * GET /Metrics/        — global summary plus a per-player leaderboard.
 * GET /Metrics/<id>    — one player's metrics.
 * Read-only analytics view, safe to point a dashboard or cron at.
 */
export class Metrics extends PublicEndpoint {
	async get() {
		const t = db();
		const id = String((this as any).getId?.() || '').trim();

		if (id) {
			const player = await t.Player.get(id);
			if (!player) throw new GameError('No save found with that id', 404);
			// Per-player lookup includes full biome health + rendered area snapshots.
			const bm = await biomeMetrics(id, { images: true });
			const view = metricsView(player);
			return {
				player: {
					...view,
					biomeSummary: bm.summary,
					activation: activationFlags(view, bm.summary, player),
					biomes: bm.biomes,
				},
			};
		}

		// Global view stays light: biome health summaries per player, no images.
		const now = Date.now();
		const players = await allOf(t.Player);
		const allStates = await allOf(t.BiomeState);
		const d = await defs();

		const statesByPlayer = new Map<string, any[]>();
		for (const s of allStates) {
			const arr = statesByPlayer.get(s.playerId) || [];
			arr.push(s);
			statesByPlayer.set(s.playerId, arr);
		}

		const views = players
			.map((p) => {
				const view = metricsView(p);
				const biomeSummary = summarizeBiomes(statesByPlayer.get(p.id) || []);
				return { ...view, biomeSummary, activation: activationFlags(view, biomeSummary, p) };
			})
			.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);

		const N = views.length || 1;
		const pct = (n: number) => Math.round((n / N) * 100);

		// Action totals across everyone.
		const actionTotals: Record<string, number> = {};
		for (const v of views) {
			for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + (n as number);
		}

		const totalPlaySeconds = views.reduce((acc, v) => acc + v.playSeconds, 0);
		const totalSessions = views.reduce((acc, v) => acc + v.sessions, 0);
		const totalActions = views.reduce((acc, v) => acc + v.totalActions, 0);

		// Audience buckets by recency / recency of joining.
		const audience = {
			activeLast24h: views.filter((v) => v.status === 'active').length,
			activeLast7d: views.filter((v) => v.status === 'active' || v.status === 'recent').length,
			dormant: views.filter((v) => v.status === 'dormant').length,
			newLast24h: views.filter((v) => now - v.createdAt <= DAY_MS).length,
			newLast7d: views.filter((v) => now - v.createdAt <= 7 * DAY_MS).length,
		};

		// Retention: did they come back for more than one session?
		const returningPlayers = views.filter((v) => v.sessions >= 2).length;

		// Activation funnel — how far players get from first launch.
		const funnel = {
			created: views.length,
			collected: views.filter((v) => v.activation.collected).length,
			crafted: views.filter((v) => v.activation.crafted).length,
			placed: views.filter((v) => v.activation.placed).length,
			attractedAnimal: views.filter((v) => v.activation.attractedAnimal).length,
			unlockedSecondBiome: views.filter((v) => v.activation.unlockedSecondBiome).length,
		};
		const funnelPct = {
			collected: pct(funnel.collected),
			crafted: pct(funnel.crafted),
			placed: pct(funnel.placed),
			attractedAnimal: pct(funnel.attractedAnimal),
			unlockedSecondBiome: pct(funnel.unlockedSecondBiome),
		};

		// Where players spend time, and where they stall.
		const areaTally: Record<string, number> = {};
		for (const v of views) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
		const mostPopularArea =
			Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

		const perBiome = new Map<string, { players: number; healthSum: number; returned: number; fully: number }>();
		for (const s of allStates) {
			if (!s.unlocked) continue;
			const e = perBiome.get(s.biomeId) || { players: 0, healthSum: 0, returned: 0, fully: 0 };
			e.players++;
			e.healthSum += s.health || 0;
			e.returned += s.returnedCount || 0;
			if ((s.health || 0) >= 100) e.fully++;
			perBiome.set(s.biomeId, e);
		}
		const biomeBreakdown = d.biomes.map((b: any) => {
			const e = perBiome.get(b.id);
			return {
				biomeId: b.id,
				name: b.name,
				playersUnlocked: e?.players || 0,
				avgHealth: e?.players ? Math.round(e.healthSum / e.players) : 0,
				totalAnimalsReturned: e?.returned || 0,
				fullyRestored: e?.fully || 0,
			};
		});

		const withBiomes = views.filter((v) => v.biomeSummary.biomesUnlocked > 0);
		const avgBiomeHealth = withBiomes.length
			? Math.round(withBiomes.reduce((acc, v) => acc + v.biomeSummary.avgHealth, 0) / withBiomes.length)
			: 0;

		return {
			generatedAt: now,
			summary: {
				players: views.length,
				audience,
				engagement: {
					totalPlayHours: round1(totalPlaySeconds / 3600),
					totalPlaySeconds,
					avgPlayMinutesPerPlayer: Math.round(totalPlaySeconds / 60 / N),
					totalSessions,
					avgSessionsPerPlayer: round1(totalSessions / N),
					avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
					totalActions,
					avgActionsPerPlayer: round1(totalActions / N),
				},
				retention: {
					returningPlayers,
					returningRatePct: pct(returningPlayers),
				},
				progression: {
					avgBiomeHealth,
					biomesFullyRestored: views.reduce((acc, v) => acc + v.biomeSummary.biomesFullyRestored, 0),
					avgUnlockedBiomes: round1(views.reduce((acc, v) => acc + v.unlockedBiomes, 0) / N),
					mostPopularArea,
				},
				funnel,
				funnelPct,
				actionTotals,
				biomeBreakdown,
			},
			players: views,
		};
	}
}

/**
 * GET /BiomeSnapshot/<playerId> — generated SVG "postcards" of each unlocked
 * area, returned both as a base64 data URI (`image`) and raw markup (`svg`).
 * Rendered live from the player's current placements and terrain.
 */
export class BiomeSnapshot extends PublicEndpoint {
	async get() {
		const id = String((this as any).getId?.() || '').trim();
		if (!id) throw new GameError('Add a player id to the path: /BiomeSnapshot/<playerId>');
		await requirePlayer(id);
		const t = db();
		const d = await defs();
		const states = (await byPlayer(t.BiomeState, id)).filter((s) => s.unlocked);
		const placements = await byPlayer(t.Placement, id);
		const terrain = await byPlayer(t.TerrainTile, id);

		const areas = states.map((s) => {
			const biome = d.biome.get(s.biomeId);
			const pls = placements.filter((p) => p.area === s.biomeId);
			const ter = terrain.filter((tt) => tt.area === s.biomeId);
			const svg = renderBiomeSVG(d, biome, s.health || 0, pls, ter);
			return {
				area: s.biomeId,
				name: biome?.name || s.biomeId,
				health: s.health || 0,
				placements: pls.length,
				image: svgDataUri(svg),
				svg,
			};
		});

		return { ok: true, playerId: id, areas };
	}
}

/**
 * POST /DevTools/ {playerId, action, ...args} — testing helpers for development.
 * Not part of normal play; the client only exposes these behind a hidden dev panel.
 * Actions: 'seed-water' (reseed an area's starting terrain), 'clear-terrain',
 * 'grant-resources', 'max-tools', 'unlock-all', 'set-health'.
 */
const DEV_PLAYER = 'bailey'; // dev tools are restricted to this save

export class DevTools extends PublicEndpoint {
	async post(data: any) {
		const { playerId, action, area, amount, value, resources } = await bodyOf(data);
		if (playerId !== DEV_PLAYER) throw new GameError('Dev tools are restricted to the developer save', 403);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const log: string[] = [];

		switch (action) {
			case 'seed-water': {
				// reset the area's terrain and lay down its starting layout again
				const ar = area || 'wetland';
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}
				await seedStartingTerrain(playerId, ar);
				await recalcBiome(playerId, ar, { player });
				log.push(`Reseeded starting terrain for ${ar}`);
				break;
			}
			case 'clear-terrain': {
				const ar = area || player.area;
				let n = 0;
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
					n++;
				}
				await recalcBiome(playerId, ar, { player });
				log.push(`Cleared ${n} terrain tiles in ${ar}`);
				break;
			}
			case 'grant-resources': {
				const inventory = { ...(player.inventory || {}) };
				const valid = new Set(d.resources.map((r: any) => r.id));
				let granted = 0;
				if (resources && typeof resources === 'object') {
					// per-resource amounts: { seeds: 50, clay: 10, ... }
					for (const [id, qty] of Object.entries(resources)) {
						const n = Math.floor(Number(qty) || 0);
						if (n > 0 && valid.has(id)) { inventory[id] = (inventory[id] || 0) + n; granted++; }
					}
					log.push(`Granted ${granted} resource type${granted === 1 ? '' : 's'}`);
				} else {
					// fallback: a flat amount of every resource
					const give = Math.max(1, Number(amount) || 200);
					for (const r of d.resources) inventory[r.id] = (inventory[r.id] || 0) + give;
					log.push(`Granted ${give} of every resource`);
				}
				await t.Player.patch(playerId, { inventory });
				break;
			}
			case 'max-tools': {
				const tools = { ...(player.tools || {}) };
				for (const tool of d.tools) {
					const top = Math.max(...tool.tiers.map((ti: any) => ti.tier));
					tools[tool.id] = top;
				}
				await t.Player.patch(playerId, { tools });
				log.push('All tools set to max tier');
				break;
			}
			case 'unlock-all': {
				const ids = d.biomes.map((b: any) => b.id);
				await t.Player.patch(playerId, { unlockedBiomes: ids });
				for (const id of ids) await t.BiomeState.patch(`${playerId}:${id}`, { unlocked: true });
				log.push(`Unlocked all biomes (${ids.length})`);
				break;
			}
			case 'set-health': {
				const ar = area || player.area;
				const h = Math.max(0, Math.min(100, Number(value) || 100));
				await t.BiomeState.patch(`${playerId}:${ar}`, { health: h });
				log.push(`Set ${ar} health to ${h}% (recomputes on next change)`);
				break;
			}
			default:
				throw new GameError(`Unknown dev action: ${action}`);
		}

		return { ok: true, log, state: await snapshot(playerId) };
	}
}

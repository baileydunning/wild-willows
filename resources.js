// server/resources.ts
var db = () => databases.wildwillows;
var GameError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
};
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function posInt(n, label) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new GameError(`${label} must be a positive whole number`);
  return v;
}
function sumValues(obj) {
  if (!obj) return 0;
  return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}
async function toArray(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}
async function allOf(table) {
  return toArray(table.search({}));
}
async function byPlayer(table, playerId) {
  const rows = await toArray(table.search({}));
  return rows.filter((r) => r?.playerId === playerId);
}
var defsCache = null;
async function defs() {
  if (!defsCache) {
    const t = db();
    const [biomes, animals, resources, recipes, objects, tools] = await Promise.all([
      allOf(t.Biome),
      allOf(t.Animal),
      allOf(t.ResourceType),
      allOf(t.Recipe),
      allOf(t.HabitatObject),
      allOf(t.ToolDef)
    ]);
    const index = (arr) => new Map(arr.map((r) => [r.id, r]));
    defsCache = {
      biomes,
      animals,
      resources,
      recipes,
      objects,
      tools,
      biome: index(biomes),
      animal: index(animals),
      resource: index(resources),
      recipe: index(recipes),
      object: index(objects),
      tool: index(tools)
    };
  }
  return defsCache;
}
var NODE_REGEN_SECONDS = 75;
var BASE_HEALTH = 5;
var CAPACITY_BY_BASKET = { 1: 80, 2: 160 };
var START_INVENTORY = { seeds: 6, fiber: 4, branches: 4, stones: 2, water: 2 };
var START_TOOLS = { basket: 1, shovel: 1, "watering-can": 1, "field-journal": 1 };
var SKIN_TONES = ["#f6d7b8", "#eec39a", "#d9a06b", "#b97f50", "#8d5a3a", "#6b4226"];
var HAIR_COLORS = ["#3b2e25", "#6e4a33", "#a3692f", "#c9913f", "#d9b380", "#8c8c8c", "#b5707a", "#4a5a3a"];
var OUTFIT_COLORS = ["#4a7c59", "#7a9ac0", "#b5707a", "#c9913f", "#7d6b9e", "#5d8a8a", "#a3692f", "#666f7b"];
var HAT_STYLES = ["straw", "leaf", "beanie", "none"];
var HAIRSTYLES = ["short", "long", "curly", "curly-long", "bun"];
var BODY_TYPES = ["slim", "round"];
function sanitizeAppearance(a) {
  a = a || {};
  return {
    skin: SKIN_TONES.includes(a.skin) ? a.skin : SKIN_TONES[1],
    hair: HAIR_COLORS.includes(a.hair) ? a.hair : HAIR_COLORS[1],
    outfit: OUTFIT_COLORS.includes(a.outfit) ? a.outfit : OUTFIT_COLORS[0],
    hat: HAT_STYLES.includes(a.hat) ? a.hat : "straw",
    hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : "short",
    body: BODY_TYPES.includes(a.body) ? a.body : "slim"
  };
}
function sanitizePlayer(player) {
  if (!player) return player;
  const { passcode, ...rest } = player;
  return rest;
}
function slugId(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var STARTER_CHEST = { x: 9, y: 5, size: "small-chest", capacity: 60 };
async function requirePlayer(playerId) {
  if (!playerId || typeof playerId !== "string") throw new GameError("playerId required");
  const player = await db().Player.get(playerId);
  if (!player) throw new GameError("No save found \u2014 please log in again", 404);
  return { player };
}
function freshMetrics(now) {
  return {
    firstSeenAt: now,
    lastSeenAt: now,
    lastHeartbeatAt: 0,
    playSeconds: 0,
    sessions: 0,
    counts: {}
  };
}
async function bumpMetrics(player, deltas = {}) {
  if (!player?.id) return null;
  const entries = Object.entries(deltas).filter(([, v]) => v);
  if (!entries.length) return player.metrics || null;
  const now = Date.now();
  const prev = player.metrics || freshMetrics(player.createdAt || now);
  const counts = { ...prev.counts || {} };
  for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
  const metrics = { ...prev, counts, lastSeenAt: now };
  await db().Player.patch(player.id, { metrics });
  return metrics;
}
function metricsView(player) {
  const now = Date.now();
  const m = player.metrics || freshMetrics(player.createdAt || now);
  const playSeconds = m.playSeconds || 0;
  return {
    playerId: player.id,
    name: player.name,
    createdAt: player.createdAt || m.firstSeenAt || null,
    firstSeenAt: m.firstSeenAt || player.createdAt || null,
    lastSeenAt: m.lastSeenAt || null,
    sessions: m.sessions || 0,
    playSeconds,
    playMinutes: Math.round(playSeconds / 60),
    avgSessionMinutes: m.sessions ? Math.round(playSeconds / 60 / m.sessions) : 0,
    counts: m.counts || {}
  };
}
async function createPlayerRecords(playerId, name, passcode, appearance) {
  const t = db();
  const d = await defs();
  const now = Date.now();
  const player = {
    id: playerId,
    name,
    passcode,
    appearance,
    createdAt: now,
    area: "meadow",
    x: 10.5,
    // spawn right beside the camp workbench
    y: 6.5,
    inventory: { ...START_INVENTORY },
    craftedItems: {},
    tools: { ...START_TOOLS },
    unlockedBiomes: ["meadow"],
    tutorialStep: 0,
    metrics: freshMetrics(now)
  };
  await t.Player.put(player);
  const biomeStates = d.biomes.map((b) => ({
    id: `${playerId}:${b.id}`,
    playerId,
    biomeId: b.id,
    health: BASE_HEALTH,
    balance: 0,
    returnedCount: 0,
    unlocked: b.id === "meadow"
  }));
  for (const bs of biomeStates) await t.BiomeState.put(bs);
  const chestPlacementId = `pl_${playerId}_starter-chest`;
  const placements = [
    {
      id: chestPlacementId,
      playerId,
      objectId: "small-chest",
      area: "meadow",
      x: STARTER_CHEST.x,
      y: STARTER_CHEST.y,
      placedAt: now
    }
  ];
  for (const p of placements) await t.Placement.put(p);
  const chest = {
    id: chestPlacementId,
    playerId,
    area: "meadow",
    x: STARTER_CHEST.x,
    y: STARTER_CHEST.y,
    size: "small-chest",
    capacity: STARTER_CHEST.capacity,
    contents: {}
  };
  await t.Chest.put(chest);
  return { player, seeded: { biomeStates, placements, chests: [chest] } };
}
function freshSnapshot(created) {
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
    inventoryCapacity: inventoryCapacity(created.player)
  };
}
function inventoryCapacity(player) {
  const tier = player.tools?.basket || 1;
  return CAPACITY_BY_BASKET[tier] || 80;
}
function placementCounts(placements) {
  const counts = {};
  for (const p of placements) counts[p.objectId] = (counts[p.objectId] || 0) + 1;
  return counts;
}
var HEALTH_SCALE = 90;
function healthFromPoints(points) {
  const recovered = (100 - BASE_HEALTH) * (1 - Math.exp(-Math.max(0, points) / HEALTH_SCALE));
  return clamp(Math.round(BASE_HEALTH + recovered), 0, 100);
}
function computeHealthPoints(d, placements, openWaterTiles = 0) {
  let points = 0;
  for (const p of placements) {
    const def = d.object.get(p.objectId);
    if (!def) continue;
    points += def.healthValue || 0;
  }
  if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
  return points;
}
var BALANCE_PER_ANIMAL = 7;
function balanceFromReturns(returnedCount) {
  return clamp(returnedCount * BALANCE_PER_ANIMAL, 0, 100);
}
function meetsRequirements(animal, health, balance, counts, returnedIds) {
  const req = animal.requirements || {};
  if (health < (req.minHealth || 0)) return false;
  if (balance < (req.minBalance || 0)) return false;
  for (const [objectId, qty] of Object.entries(req.objects || {})) {
    if ((counts[objectId] || 0) < qty) return false;
  }
  for (const other of req.animals || []) {
    if (!returnedIds.has(other)) return false;
  }
  return true;
}
function computeComfort(animal, counts) {
  const req = animal.requirements?.objects || {};
  let comfort = 40;
  let missing = 0;
  for (const [objectId, qty] of Object.entries(req)) {
    const have = counts[objectId] || 0;
    if (have >= qty) {
      comfort += 12;
      comfort += Math.min(3, have - qty) * 5;
    } else {
      missing++;
    }
  }
  comfort -= missing * 25;
  return clamp(comfort, 5, 100);
}
function whyReturnedText(animal, d) {
  const req = animal.requirements || {};
  const parts = [];
  const objs = Object.entries(req.objects || {}).map(([id, q]) => `${q}\xD7 ${d.object.get(id)?.name || id}`);
  if (objs.length) parts.push(`habitat in place (${objs.join(", ")})`);
  if (req.minHealth) parts.push(`biome health reached ${req.minHealth}%`);
  if (req.minBalance) parts.push(`ecological balance reached ${req.minBalance}%`);
  if (req.animals?.length) parts.push(`${req.animals.map((a) => d.animal.get(a)?.name || a).join(" and ")} had already returned`);
  return `Felt safe enough to return once ${parts.join(", ")}.`;
}
async function recalcBiome(playerId, biomeId, opts = {}) {
  const t = db();
  const d = await defs();
  if (!d.biome.get(biomeId)) throw new GameError(`Unknown biome: ${biomeId}`);
  let placements = (await byPlayer(t.Placement, playerId)).filter((p) => p.area === biomeId);
  if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds.includes(p.id));
  for (const ap of opts.addPlacements || []) {
    if (ap.area !== biomeId) continue;
    placements = placements.filter((p) => p.id !== ap.id);
    placements.push(ap);
  }
  const counts = placementCounts(placements);
  let terrain = (await byPlayer(t.TerrainTile, playerId)).filter((tt) => tt.area === biomeId);
  if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds.includes(tt.id));
  for (const at of opts.addTerrain || []) {
    if (at.area !== biomeId) continue;
    terrain = terrain.filter((tt) => tt.id !== at.id);
    terrain.push(at);
  }
  const wateredTiles = Math.min(10, terrain.filter((tt) => tt.type === "watered").length);
  const openWaterTiles = terrain.filter((tt) => tt.type === "water").length;
  const healthPoints = computeHealthPoints(d, placements, openWaterTiles) + wateredTiles;
  const health = healthFromPoints(healthPoints);
  const discoveries = await byPlayer(t.Discovery, playerId);
  const returnedIds = new Set(discoveries.map((x) => x.animalId));
  const countInBiome = () => [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
  let balance = balanceFromReturns(countInBiome());
  const newAnimals = [];
  const biomeAnimals = d.animals.filter((a) => a.biome === biomeId);
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
        whyReturned: whyReturnedText(animal, d)
      };
      await t.Discovery.put(disc);
      returnedIds.add(animal.id);
      balance = balanceFromReturns(countInBiome());
      newAnimals.push({ ...disc, animal });
      break;
    }
  }
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
    ...prior || { id: `${playerId}:${biomeId}`, playerId, biomeId, unlocked: biomeId === "meadow" },
    health,
    balance,
    returnedCount
  };
  const unlockedBiomes = await checkUnlocks(playerId, { player: opts.player, freshState: biomeState });
  return { biomeState, newAnimals, unlockedBiomes };
}
async function checkUnlocks(playerId, fresh = {}) {
  const t = db();
  const d = await defs();
  const player = fresh.player || await t.Player.get(playerId);
  const unlockedNow = [];
  const unlockedSet = new Set(player.unlockedBiomes || []);
  for (const biome of d.biomes) {
    if (!biome.unlock || unlockedSet.has(biome.id)) continue;
    const u = biome.unlock;
    const prereq = fresh.freshState?.biomeId === u.biome ? fresh.freshState : await t.BiomeState.get(`${playerId}:${u.biome}`);
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
async function getOwnedChest(t, d, chestId, playerId) {
  const chest = await t.Chest.get(chestId);
  if (chest && chest.playerId === playerId) return chest;
  const placement = await t.Placement.get(chestId);
  if (placement && placement.playerId === playerId) {
    const def = d.object.get(placement.objectId);
    if (def?.isChest) {
      const healed = {
        id: chestId,
        playerId,
        area: placement.area,
        x: placement.x,
        y: placement.y,
        size: placement.objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      };
      await t.Chest.put(healed);
      return healed;
    }
  }
  return null;
}
async function consumeMaterials(player, materials) {
  const t = db();
  const chests = await byPlayer(t.Chest, player.id);
  for (const [resId, qty] of Object.entries(materials)) {
    const inInv = player.inventory?.[resId] || 0;
    const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
    if (inInv + inChests < qty) {
      throw new GameError(`Not enough ${resId}: need ${qty}, have ${inInv + inChests} (basket + chests)`);
    }
  }
  const usedFrom = { inventory: {}, chests: {} };
  const inventory = { ...player.inventory || {} };
  const chestContents = new Map(chests.map((c) => [c.id, { ...c.contents || {} }]));
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
      const contents = chestContents.get(chest.id);
      const fromChest = Math.min(contents[resId] || 0, remaining);
      if (fromChest > 0) {
        contents[resId] -= fromChest;
        if (contents[resId] <= 0) delete contents[resId];
        usedFrom.chests[chest.id] = usedFrom.chests[chest.id] || {};
        usedFrom.chests[chest.id][resId] = fromChest;
        remaining -= fromChest;
      }
    }
    if (remaining > 0) throw new GameError(`Not enough ${resId}`);
  }
  await t.Player.patch(player.id, { inventory });
  for (const chest of chests) {
    if (usedFrom.chests[chest.id]) {
      await t.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
    }
  }
  return { usedFrom, inventory };
}
async function snapshot(playerId) {
  const t = db();
  const d = await defs();
  let player = await t.Player.get(playerId);
  const areaBiome = d.biome.get(player?.area);
  if (player && (!areaBiome || !areaBiome.explorable)) {
    player = { ...player, area: "meadow", x: 10.5, y: 6.5 };
  }
  const [biomeStates, placements, chests, discoveries, nodeStates, terrain] = await Promise.all([
    byPlayer(t.BiomeState, playerId),
    byPlayer(t.Placement, playerId),
    byPlayer(t.Chest, playerId),
    byPlayer(t.Discovery, playerId),
    byPlayer(t.NodeState, playerId),
    byPlayer(t.TerrainTile, playerId)
  ]);
  return {
    player: sanitizePlayer(player),
    biomeStates,
    placements,
    chests,
    discoveries,
    nodeStates,
    terrain,
    serverTime: Date.now(),
    nodeRegenSeconds: NODE_REGEN_SECONDS,
    inventoryCapacity: inventoryCapacity(player)
  };
}
async function bodyOf(data) {
  const body = await data;
  if (!body || typeof body !== "object") throw new GameError("Request body required");
  return body;
}
var PublicEndpoint = class extends Resource {
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
};
var GameData = class extends PublicEndpoint {
  async get() {
    const d = await defs();
    return {
      biomes: d.biomes,
      animals: d.animals,
      resources: d.resources,
      recipes: d.recipes,
      habitatObjects: d.objects,
      tools: d.tools,
      nodeRegenSeconds: NODE_REGEN_SECONDS,
      appearanceOptions: {
        skins: SKIN_TONES,
        hair: HAIR_COLORS,
        outfits: OUTFIT_COLORS,
        hats: HAT_STYLES,
        hairstyles: HAIRSTYLES,
        bodies: BODY_TYPES
      }
    };
  }
};
var CreatePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode, appearance } = await bodyOf(data);
    const cleanName = String(name || "").trim();
    if (cleanName.length < 2 || cleanName.length > 24) throw new GameError("Pick a name between 2 and 24 characters");
    const code = String(passcode || "");
    if (code.length < 4 || code.length > 32) throw new GameError("Pick a passcode of at least 4 characters");
    const playerId = slugId(cleanName);
    if (!playerId) throw new GameError("That name needs at least one letter or number");
    const existing = await db().Player.get(playerId);
    if (existing) throw new GameError("A save with that name already exists \u2014 try Load Game instead", 409);
    const created = await createPlayerRecords(playerId, cleanName, code, sanitizeAppearance(appearance));
    return { ok: true, playerId, state: freshSnapshot(created) };
  }
};
var DeletePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await db().Player.get(playerId) : null;
    if (!player) throw new GameError("No save found with that name", 404);
    if (String(passcode || "") !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);
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
};
var LoginPlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await db().Player.get(playerId) : null;
    if (!player) throw new GameError("No save found with that name \u2014 try New Game", 404);
    if (String(passcode || "") !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);
    const d = await defs();
    const areaBiome = d.biome.get(player.area);
    if (!areaBiome || !areaBiome.explorable) {
      await db().Player.patch(playerId, { area: "meadow", x: 10.5, y: 6.5 });
    }
    const now = Date.now();
    const prev = player.metrics || freshMetrics(player.createdAt || now);
    await db().Player.patch(playerId, { metrics: { ...prev, lastHeartbeatAt: 0, lastSeenAt: now } });
    return { ok: true, playerId, state: await snapshot(playerId) };
  }
};
var GameState = class extends PublicEndpoint {
  async get() {
    const playerId = String(this.getId() || "");
    await requirePlayer(playerId);
    return snapshot(playerId);
  }
};
var CollectResource = class extends PublicEndpoint {
  async post(data) {
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
    if (!nodeId || typeof nodeId !== "string") throw new GameError("nodeId required");
    const nodeKey = `${playerId}:${biomeId}:${nodeId}`;
    const nodeState = await t.NodeState.get(nodeKey);
    const now = Date.now();
    if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1e3) {
      throw new GameError("This spot is still regrowing \u2014 come back soon", 409);
    }
    const capacity = inventoryCapacity(player);
    const carried = sumValues(player.inventory);
    if (carried >= capacity) throw new GameError("Your basket is full \u2014 store materials in a chest first", 409);
    const toolTier = player.tools?.[resDef.tool] || 1;
    const amount = Math.min(toolTier >= 2 ? 2 : 1, capacity - carried);
    const inventory = { ...player.inventory || {} };
    inventory[resourceId] = (inventory[resourceId] || 0) + amount;
    await t.Player.patch(playerId, { inventory });
    await t.NodeState.put({ id: nodeKey, playerId, harvestedAt: now });
    await bumpMetrics(player, { resourcesCollected: amount });
    return { ok: true, gained: { [resourceId]: amount }, inventory, nodeId, harvestedAt: now };
  }
};
var ChestTransfer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const amount = posInt(qty, "qty");
    const chest = await getOwnedChest(t, d, chestId, playerId);
    if (!chest) throw new GameError("Chest not found", 404);
    const inventory = { ...player.inventory || {} };
    const contents = { ...chest.contents || {} };
    if (direction === "deposit") {
      if ((inventory[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in your inventory`);
      if (sumValues(contents) + amount > chest.capacity) throw new GameError("That chest is full", 409);
      inventory[resourceId] -= amount;
      if (inventory[resourceId] <= 0) delete inventory[resourceId];
      contents[resourceId] = (contents[resourceId] || 0) + amount;
    } else if (direction === "withdraw") {
      if ((contents[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in that chest`);
      if (sumValues(inventory) + amount > inventoryCapacity(player)) throw new GameError("Your basket is full", 409);
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
};
var DiscardItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, kind, id, qty } = await bodyOf(data);
    const t = db();
    const { player } = await requirePlayer(playerId);
    const amount = posInt(qty, "qty");
    if (!id || typeof id !== "string") throw new GameError("id required");
    if (kind === "crafted") {
      const craftedItems = { ...player.craftedItems || {} };
      if ((craftedItems[id] || 0) < amount) throw new GameError("You do not have that many to throw away");
      craftedItems[id] -= amount;
      if (craftedItems[id] <= 0) delete craftedItems[id];
      await t.Player.patch(playerId, { craftedItems });
      return { ok: true, craftedItems };
    }
    const inventory = { ...player.inventory || {} };
    if ((inventory[id] || 0) < amount) throw new GameError("You do not have that many to throw away");
    inventory[id] -= amount;
    if (inventory[id] <= 0) delete inventory[id];
    await t.Player.patch(playerId, { inventory });
    return { ok: true, inventory };
  }
};
var CraftItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, recipeId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const recipe = d.recipe.get(recipeId);
    if (!recipe) throw new GameError(`Unknown recipe: ${recipeId}`);
    if (recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
      throw new GameError("This recipe unlocks with a biome you have not restored yet", 403);
    }
    if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
      const tool = d.tool.get(recipe.requiresTool.id);
      throw new GameError(`Requires the upgraded ${tool?.name || recipe.requiresTool.id}`, 403);
    }
    const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {});
    const itemDef = d.object.get(recipe.output.itemId);
    const craftedItems = { ...player.craftedItems || {} };
    const craftedEver = { ...player.craftedEver || {} };
    if (itemDef?.bundle) {
      for (const [bid, bqty] of Object.entries(itemDef.bundle)) {
        craftedItems[bid] = (craftedItems[bid] || 0) + bqty;
        craftedEver[bid] = (craftedEver[bid] || 0) + bqty;
      }
      craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + 1;
    } else {
      craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
      craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
    }
    await t.Player.patch(playerId, { craftedItems, craftedEver });
    const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, craftedItems, craftedEver } });
    const chests = await byPlayer(t.Chest, playerId);
    await bumpMetrics(player, { itemsCrafted: 1 });
    return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, unlockedBiomes };
  }
};
var PlaceObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, objectId, area, x, y } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const def = d.object.get(objectId);
    if (!def) throw new GameError(`Unknown object: ${objectId}`);
    if (def.placement === "none") throw new GameError(`${def.name} is a kit, not a placeable object`);
    if ((player.craftedItems?.[objectId] || 0) <= 0) throw new GameError(`You have no crafted ${def.name} to place`);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(`Unknown area: ${area}`);
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    if (def.placement === "indoor") throw new GameError(`${def.name} cannot be placed out in the preserve`);
    if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} does not suit the ${biome.name} habitat`);
    if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
      throw new GameError(`Placing ${def.name} requires an upgraded ${d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id}`, 403);
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError("That spot is already taken", 409);
    }
    const tileHere = await t.TerrainTile.get(`${playerId}:${area}:${tx}:${ty}`);
    if (tileHere && tileHere.playerId === playerId) {
      if (tileHere.type === "water") {
        if (!def.bridge) throw new GameError("That is open water \u2014 a wooden bridge can span it", 409);
      } else {
        throw new GameError("That soil bed is for planting \u2014 or clear it with the shovel", 409);
      }
    } else if (def.bridge) {
      throw new GameError("Bridges go over open water \u2014 flood a channel first", 409);
    }
    const craftedItems = { ...player.craftedItems || {} };
    craftedItems[objectId] -= 1;
    if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
    await t.Player.patch(playerId, { craftedItems });
    const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = { id: placementId, playerId, objectId, area, x: tx, y: ty, placedAt: Date.now() };
    await t.Placement.put(placement);
    if (def.isChest) {
      await t.Chest.put({
        id: placementId,
        playerId,
        area,
        x: tx,
        y: ty,
        size: objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      });
    }
    const recalc = await recalcBiome(playerId, area, {
      addPlacements: [placement],
      player: { ...player, craftedItems }
    });
    await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, placement, craftedItems, ...recalc };
  }
};
var Plant = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, plantId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(`Unknown area: ${area}`);
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    const def = d.object.get(plantId);
    if (!def || !def.plantable) throw new GameError("That cannot be planted");
    if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} would not take root in the ${biome.name}`);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    const tileId = `${playerId}:${area}:${tx}:${ty}`;
    const bed = await t.TerrainTile.get(tileId);
    if (!bed || bed.playerId !== playerId || bed.type !== "watered") {
      throw new GameError("Plant into a watered soil bed \u2014 dig with the shovel, then water it");
    }
    const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {});
    await t.TerrainTile.delete(tileId);
    const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = {
      id: placementId,
      playerId,
      objectId: plantId,
      area,
      x: tx,
      y: ty,
      placedAt: Date.now(),
      plantedAt: Date.now()
    };
    await t.Placement.put(placement);
    const recalc = await recalcBiome(playerId, area, {
      addPlacements: [placement],
      removeTerrainIds: [tileId],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, placement, inventory, usedFrom, ...recalc };
  }
};
var UpdateAppearance = class extends PublicEndpoint {
  async post(data) {
    const { playerId, appearance } = await bodyOf(data);
    await requirePlayer(playerId);
    const clean = sanitizeAppearance(appearance);
    await db().Player.patch(playerId, { appearance: clean });
    return { ok: true, appearance: clean };
  }
};
var MoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId, x, y } = await bodyOf(data);
    const t = db();
    await requirePlayer(playerId);
    const placement = await t.Placement.get(placementId);
    if (!placement || placement.playerId !== playerId) throw new GameError("Placement not found", 404);
    if (placement.objectId === "workbench") throw new GameError("The old workbench stays put");
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
      throw new GameError("That spot is already taken", 409);
    }
    const d = await defs();
    const movingDef = d.object.get(placement.objectId);
    const tileHere = await t.TerrainTile.get(`${playerId}:${placement.area}:${tx}:${ty}`);
    if (tileHere && tileHere.playerId === playerId) {
      if (tileHere.type === "water") {
        if (!movingDef?.bridge) throw new GameError("That is open water \u2014 only a bridge can sit there", 409);
      } else {
        throw new GameError("That soil bed is for planting", 409);
      }
    } else if (movingDef?.bridge) {
      throw new GameError("Bridges go over open water", 409);
    }
    await t.Placement.patch(placementId, { x: tx, y: ty });
    const chest = await getOwnedChest(t, d, placementId, playerId);
    if (chest) await t.Chest.patch(placementId, { x: tx, y: ty });
    return { ok: true, placement: { ...placement, x: tx, y: ty } };
  }
};
var RemoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId } = await bodyOf(data);
    const t = db();
    const { player } = await requirePlayer(playerId);
    const placement = await t.Placement.get(placementId);
    if (!placement || placement.playerId !== playerId) throw new GameError("Placement not found", 404);
    if (placement.objectId === "workbench") {
      throw new GameError("Your crafting station stays put \u2014 the preserve needs it");
    }
    const chest = await t.Chest.get(placementId);
    if (chest && sumValues(chest.contents) > 0) {
      throw new GameError("Empty the chest before picking it up", 409);
    }
    const d = await defs();
    const def = d.object.get(placement.objectId);
    let refunded = null;
    const craftedItems = { ...player.craftedItems || {} };
    const inventory = { ...player.inventory || {} };
    const chestUpdates = /* @__PURE__ */ new Map();
    if (def?.plantable && placement.plantedAt && Object.keys(def.plantCost || {}).length) {
      refunded = { ...def.plantCost };
      const capacity = inventoryCapacity(player);
      let carried = sumValues(inventory);
      const chests = (await byPlayer(t.Chest, playerId)).filter((c) => c.id !== placementId);
      for (const [resId, qty] of Object.entries(refunded)) {
        let remaining = qty;
        const toBasket = Math.min(remaining, Math.max(0, capacity - carried));
        if (toBasket > 0) {
          inventory[resId] = (inventory[resId] || 0) + toBasket;
          carried += toBasket;
          remaining -= toBasket;
        }
        for (const c of chests) {
          if (remaining <= 0) break;
          const contents = chestUpdates.get(c.id) || { ...c.contents || {} };
          const room = c.capacity - sumValues(contents);
          const toChest = Math.min(room, remaining);
          if (toChest > 0) {
            contents[resId] = (contents[resId] || 0) + toChest;
            chestUpdates.set(c.id, contents);
            remaining -= toChest;
          }
        }
        if (remaining > 0) {
          throw new GameError("No room for the refunded materials \u2014 make space in your basket or a chest first", 409);
        }
      }
    } else {
      craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
    }
    if (chest) await t.Chest.delete(placementId);
    await t.Placement.delete(placementId);
    if (refunded) {
      await t.Player.patch(playerId, { inventory });
      for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
    } else {
      await t.Player.patch(playerId, { craftedItems });
    }
    const recalc = placement.area !== "home" ? await recalcBiome(playerId, placement.area, {
      removeIds: [placementId],
      player: { ...player, craftedItems, inventory }
    }) : null;
    await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
    return { ok: true, removed: placementId, craftedItems, refunded, ...recalc || {} };
  }
};
var UpgradeTool = class extends PublicEndpoint {
  async post(data) {
    const { playerId, toolId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const toolDef = d.tool.get(toolId);
    if (!toolDef) throw new GameError(`Unknown tool: ${toolId}`);
    const currentTier = player.tools?.[toolId] || 1;
    const nextTier = (toolDef.tiers || []).find((tt) => tt.tier === currentTier + 1);
    if (!nextTier) throw new GameError(`${toolDef.name} is already fully upgraded`);
    if (nextTier.requires?.biome) {
      const bs = await t.BiomeState.get(`${playerId}:${nextTier.requires.biome}`);
      if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
        const biome = d.biome.get(nextTier.requires.biome);
        throw new GameError(
          `Restore ${biome?.name || nextTier.requires.biome} to ${nextTier.requires.minHealth}% health first`,
          403
        );
      }
    }
    const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {});
    const tools = { ...player.tools || {}, [toolId]: nextTier.tier };
    await t.Player.patch(playerId, { tools });
    const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, tools } });
    const chests = await byPlayer(t.Chest, playerId);
    await bumpMetrics(player, { toolsUpgraded: 1 });
    return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
  }
};
var ObserveAnimal = class extends PublicEndpoint {
  async post(data) {
    const { playerId, animalId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const disc = await t.Discovery.get(`${playerId}:${animalId}`);
    if (!disc) throw new GameError("That animal has not returned yet", 404);
    const timesObserved = (disc.timesObserved || 0) + 1;
    await t.Discovery.patch(disc.id, { timesObserved });
    await bumpMetrics(player, { animalsObserved: 1 });
    return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
  }
};
var Terraform = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, action } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError("You can only shape the ground out in the preserve");
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError("Something is already placed there");
    }
    const tileId = `${playerId}:${area}:${tx}:${ty}`;
    const existing = await t.TerrainTile.get(tileId);
    let inventory = player.inventory || {};
    let tile = null;
    let removedId;
    if (action === "dig") {
      if ((player.tools?.shovel || 0) < 1) throw new GameError("You need your shovel for that");
      if (existing) throw new GameError("This ground is already prepared \u2014 water it, or clear it instead");
      tile = { id: tileId, playerId, area, x: tx, y: ty, type: "tilled", updatedAt: Date.now() };
      await t.TerrainTile.put(tile);
    } else if (action === "water") {
      if ((player.tools?.["watering-can"] || 0) < 1) throw new GameError("You need your watering can for that");
      if (!existing) throw new GameError("Prepare a soil bed with your shovel first");
      if (existing.type === "water") throw new GameError("This is already open water");
      const cost = existing.type === "tilled" ? 1 : 2;
      const newType = existing.type === "tilled" ? "watered" : "water";
      const have = (inventory.water || 0) + (inventory["clean-water"] || 0);
      if (have < cost) throw new GameError(`You need ${cost} water for that \u2014 gather more first`);
      inventory = { ...inventory };
      let remaining = cost;
      for (const key of ["water", "clean-water"]) {
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
    } else if (action === "clear") {
      if (!existing) throw new GameError("Nothing to clear here");
      await t.TerrainTile.delete(tileId);
      removedId = tileId;
    } else {
      throw new GameError("action must be 'dig', 'water', or 'clear'");
    }
    const recalc = await recalcBiome(playerId, area, {
      addTerrain: tile ? [tile] : [],
      removeTerrainIds: removedId ? [removedId] : [],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, tile, removedId, inventory, ...recalc };
  }
};
var RecalcBiome = class extends PublicEndpoint {
  async post(data) {
    const { playerId, biomeId } = await bodyOf(data);
    await requirePlayer(playerId);
    return { ok: true, ...await recalcBiome(playerId, biomeId) };
  }
};
var SyncPlayer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, x, y, area, tutorialStep } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const patch = {};
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
};
var SESSION_GAP_MS = 30 * 60 * 1e3;
var MAX_BEAT_MS = 90 * 1e3;
var Heartbeat = class extends PublicEndpoint {
  async post(data) {
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
      sessions += 1;
    } else {
      playSeconds += Math.min(gap, MAX_BEAT_MS) / 1e3;
    }
    const metrics = {
      ...prev,
      firstSeenAt: prev.firstSeenAt || player.createdAt || now,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      playSeconds: Math.round(playSeconds),
      sessions
    };
    await t.Player.patch(playerId, { metrics });
    return { ok: true, metrics: metricsView({ ...player, metrics }) };
  }
};
var Metrics = class extends PublicEndpoint {
  async get() {
    const t = db();
    const id = String(this.getId?.() || "").trim();
    if (id) {
      const player = await t.Player.get(id);
      if (!player) throw new GameError("No save found with that id", 404);
      return { player: metricsView(player) };
    }
    const players = await allOf(t.Player);
    const views = players.map(metricsView).sort((a, b) => b.playSeconds - a.playSeconds);
    const totals = {};
    for (const v of views) {
      for (const [k, n] of Object.entries(v.counts)) totals[k] = (totals[k] || 0) + n;
    }
    const totalPlaySeconds = views.reduce((acc, v) => acc + v.playSeconds, 0);
    const totalSessions = views.reduce((acc, v) => acc + v.sessions, 0);
    return {
      generatedAt: Date.now(),
      summary: {
        players: views.length,
        totalPlaySeconds,
        totalPlayHours: Math.round(totalPlaySeconds / 3600 * 10) / 10,
        totalSessions,
        avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
        actionTotals: totals
      },
      players: views
    };
  }
};
export {
  ChestTransfer,
  CollectResource,
  CraftItem,
  CreatePlayer,
  DeletePlayer,
  DiscardItem,
  GameData,
  GameState,
  Heartbeat,
  LoginPlayer,
  Metrics,
  MoveObject,
  ObserveAnimal,
  PlaceObject,
  Plant,
  RecalcBiome,
  RemoveObject,
  SyncPlayer,
  Terraform,
  UpdateAppearance,
  UpgradeTool
};

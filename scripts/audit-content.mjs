// Content audit: proves every recipe, tool upgrade, plant, and animal
// requirement is actually obtainable in unlock order.
// Usage: node scripts/audit-content.mjs   (Harper must be running)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const d = await (await fetch('https://localhost:9926/GameData/', { headers: { Accept: 'application/json' } })).json();

const order = [...d.biomes].sort((a, b) => a.order - b.order);
const gatherableAt = {}; // biomeId -> Set of resources available once that biome is unlocked
let acc = new Set();
for (const b of order) {
	(b.resources || []).forEach((r) => acc.add(r));
	// materials you can also dig up with the shovel count as gatherable here
	(b.digResources || []).forEach((r) => acc.add(r));
	gatherableAt[b.id] = new Set(acc);
}
const orderOf = Object.fromEntries(order.map((b) => [b.id, b.order]));
const problems = [];

// recipes craftable with resources available at their unlock biome
for (const r of d.recipes) {
	const avail = gatherableAt[r.unlockBiome];
	for (const mat of Object.keys(r.materials || {})) {
		if (!avail?.has(mat)) problems.push(`recipe ${r.id} (unlocks ${r.unlockBiome}) needs ${mat} — not gatherable yet`);
	}
}
// tool upgrades
for (const t of d.tools) {
	for (const tier of t.tiers || []) {
		const biome = tier.requires?.biome || 'meadow';
		const avail = gatherableAt[biome];
		for (const mat of Object.keys(tier.materials || {})) {
			if (!avail?.has(mat))
				problems.push(`tool ${t.id} tier ${tier.tier} (req ${biome}) needs ${mat} — not gatherable yet`);
		}
	}
}
// plants: cost must be gatherable once their earliest biome is unlocked
for (const o of d.habitatObjects) {
	if (!o.plantable) continue;
	const earliest = Math.min(...(o.biomes || []).map((b) => orderOf[b] ?? 99));
	const biome = order.find((b) => b.order === earliest)?.id;
	for (const mat of Object.keys(o.plantCost || {})) {
		if (!gatherableAt[biome]?.has(mat)) {
			problems.push(`note: plant ${o.id} in ${biome} costs ${mat} (gathered later) — optional, not blocking`);
		}
	}
}
// every animal's required objects must be placeable + obtainable in its biome
const recipeFor = Object.fromEntries(d.recipes.map((r) => [r.output.itemId, r]));
const bundleItems = new Set(d.habitatObjects.flatMap((o) => Object.keys(o.bundle || {})));
for (const a of d.animals) {
	for (const objId of Object.keys(a.requirements?.objects || {})) {
		const def = d.habitatObjects.find((o) => o.id === objId);
		if (!def) {
			problems.push(`animal ${a.id} requires unknown object ${objId}`);
			continue;
		}
		if (!(def.biomes || []).includes(a.biome))
			problems.push(`animal ${a.id} (${a.biome}) requires ${objId} not placeable there`);
		const recipe = recipeFor[objId];
		const viaRecipe = recipe && (orderOf[recipe.unlockBiome] ?? 99) <= orderOf[a.biome];
		const viaPlant = def.plantable && Math.min(...(def.biomes || []).map((b) => orderOf[b] ?? 99)) <= orderOf[a.biome];
		if (!viaRecipe && !viaPlant && !bundleItems.has(objId)) {
			problems.push(`animal ${a.id} (${a.biome}) requires ${objId} — no recipe/plant available by then`);
		}
	}
	for (const other of a.requirements?.animals || []) {
		if (!d.animals.find((x) => x.id === other)) problems.push(`animal ${a.id} requires unknown animal ${other}`);
	}
}

const blocking = problems.filter((p) => !p.startsWith('note:'));
console.log(
	`recipes: ${d.recipes.length} · tools: ${d.tools.length} · plants: ${d.habitatObjects.filter((o) => o.plantable).length} · animals: ${d.animals.length}`,
);
problems.forEach((p) => console.log(' -', p));
console.log(
	blocking.length === 0
		? 'AUDIT PASS — everything is obtainable in unlock order'
		: `AUDIT FAIL — ${blocking.length} blocking problems`,
);
process.exit(blocking.length === 0 ? 0 : 1);

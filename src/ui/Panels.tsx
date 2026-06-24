import React, { useEffect, useMemo, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { ChestState, RecipeDef } from '../types';
import { recipeUnlocked, recipeMatchesSearch } from '../recipes';
import {
	weatherType, seasonStyle, liveSeason, liveWeatherType, forecastType, gatherResourceFor, weatherEffect, seasonEffect,
} from '../weather';
import { Meter } from './HUD';
import { Icon } from './icons';
import { BIOME_LORE, loreStage } from './lore';

function Panel({ title, icon, children, onClose, wide }: { title: string; icon?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
	return (
		<div className="panel-backdrop" onClick={onClose}>
			<div className={`panel ${wide ? 'panel-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>{icon && <Icon name={icon} size={20} />} {title}</h2>
					<button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">{children}</div>
			</div>
		</div>
	);
}

function resName(data: any, id: string) {
	return data?.resources.find((r: any) => r.id === id)?.name || id;
}
function resColor(data: any, id: string) {
	return data?.resources.find((r: any) => r.id === id)?.color || '#888';
}

/**
 * Little chips showing where a crafted item can be placed. Items that go
 * everywhere collapse to a single "All areas" chip; non-placeable kits say so
 * instead.
 */
function AreaTags({ data, def }: { data: any; def: any }) {
	if (!def) return null;
	if (def.placement === 'none') {
		return <span className="area-tags"><span className="area-tag area-tag-muted">Used in crafting</span></span>;
	}
	const biomes: string[] = def.biomes || [];
	const allAreas = biomes.length >= data.biomes.length;
	const canCamp = def.placement === 'both' || def.placement === 'indoor';
	return (
		<span className="area-tags">
			<span className="area-tags-label">Place in:</span>
			{allAreas ? (
				<span className="area-tag"><span className="area-dot" style={{ background: 'var(--green-2)' }} />All areas</span>
			) : (
				biomes.map((bid) => {
					const b = data.biomes.find((x: any) => x.id === bid);
					return (
						<span className="area-tag" key={bid}>
							<span className="area-dot" style={{ background: b?.palette?.healthy || '#8fbf6f' }} />
							{b?.name || bid}
						</span>
					);
				})
			)}
			{canCamp && <span className="area-tag"><span className="area-dot" style={{ background: 'var(--gold)' }} />Camp</span>}
		</span>
	);
}

// All of your chests feed crafting — no station or proximity required.
export function useLinkedChests(): ChestState[] {
	const { state } = useGame();
	return useMemo(() => state?.chests ?? [], [state]);
}

export function InventoryPanel() {
	const { data, state, setPanel, startPlacement, discard } = useGame();
	if (!data || !state) return null;
	const inv = Object.entries(state.player.inventory || {}).filter(([, q]) => q > 0);
	const carried = inv.reduce((a, [, q]) => a + q, 0);
	// Restoration kits (and any kit-category craftable) are protected from discard.
	const kitItemIds = new Set(data.recipes.filter((r) => r.category === 'kit').map((r) => r.output.itemId));

	const toss = (kind: 'material' | 'crafted', id: string, qty: number, name: string) => {
		if (window.confirm(`Throw away ${qty}× ${name}? This can't be undone.`)) discard(kind, id, qty, name);
	};

	return (
		<Panel title={`Gathering Basket — ${carried}/${state.inventoryCapacity}`} icon="basket" onClose={() => setPanel(null)}>
			{inv.length === 0 && <p className="muted">Your basket is empty. Gather fallen branches, seeds, and stones out in the preserve.</p>}
			<div className="grid">
				{inv.map(([id, qty]) => {
					const name = resName(data, id);
					return (
						<div className="cell row" key={id}>
							<span className="swatch" style={{ background: resColor(data, id) }} />
							<span className="grow">{name}</span>
							<b>×{qty}</b>
							<button className="subtle" title={`Throw away one ${name}`} onClick={() => toss('material', id, 1, name)}>
								<Icon name="trash" size={12} />
							</button>
							<button className="subtle" title={`Throw away all ${name}`} onClick={() => toss('material', id, qty, name)}>
								all
							</button>
						</div>
					);
				})}
			</div>
			{Object.keys(state.player.craftedItems || {}).length > 0 && (
				<>
					<h3>Crafted items</h3>
					<div className="grid">
						{Object.entries(state.player.craftedItems).map(([id, qty]) => {
							const def = data.habitatObjects.find((o) => o.id === id);
							const name = def?.name || id;
							// Restoration kits are milestone items — crafting them is what counts,
							// so they can't be thrown away by mistake.
							const isKit = kitItemIds.has(id);
							return (
								<div className="cell row" key={id}>
									<span className="grow">{name}</span>
									<b>×{qty}</b>
									{def && def.placement !== 'none' && (
										<button onClick={() => startPlacement(id)} title={`Place ${name}`}>
											<Icon name="pin" size={12} /> Place
										</button>
									)}
									{!isKit && (
										<button className="subtle" title={`Throw away one ${name}`} onClick={() => toss('crafted', id, 1, name)}>
											<Icon name="trash" size={12} />
										</button>
									)}
								</div>
							);
						})}
					</div>
					<p className="muted">Kits (like restoration kits) are not placed and can't be discarded — crafting them is what counts.</p>
				</>
			)}
		</Panel>
	);
}

export function ChestPanel() {
	const { data, state, activeChestId, setPanel, transfer, removePlacement } = useGame();
	const [busy, setBusy] = useState(false);
	if (!data || !state) return null;
	const chest = state.chests.find((c) => c.id === activeChestId);
	if (!chest) return null;
	const def = data.habitatObjects.find((o) => o.id === chest.size);
	const stored = Object.entries(chest.contents || {}).filter(([, q]) => q > 0);
	const inv = Object.entries(state.player.inventory || {}).filter(([, q]) => q > 0);
	const used = stored.reduce((a, [, q]) => a + q, 0);
	const carried = inv.reduce((a, [, q]) => a + q, 0);
	const chestRoom = chest.capacity - used;
	const basketRoom = state.inventoryCapacity - carried;

	// one transfer at a time — a double-click no longer fires a doomed second request
	const doTransfer = async (id: string, qty: number, dir: 'deposit' | 'withdraw') => {
		if (busy || qty <= 0) return;
		setBusy(true);
		try {
			await transfer(chest.id, id, qty, dir);
		} finally {
			setBusy(false);
		}
	};

	// buttons move only what actually fits (chest space / basket space) instead of
	// firing a transfer the server is guaranteed to reject
	const row = (id: string, qty: number, dir: 'deposit' | 'withdraw') => {
		const room = dir === 'deposit' ? chestRoom : basketRoom;
		const max = Math.min(qty, Math.max(0, room));
		const btn = (label: string, amount: number) => (
			<button disabled={busy || amount <= 0} onClick={() => doTransfer(id, amount, dir)}>{label}</button>
		);
		return (
			<div className="cell row" key={id}>
				<span className="swatch" style={{ background: resColor(data, id) }} />
				<span className="grow">{resName(data, id)}</span>
				<b>×{qty}</b>
				{btn('1', Math.min(1, max))}
				{btn('5', Math.min(5, max))}
				{btn('all', max)}
			</div>
		);
	};

	return (
		<Panel title={`${def?.name || 'Chest'} — ${used}/${chest.capacity}`} icon="chest" onClose={() => setPanel(null)} wide>
			<div className="columns">
				<div>
					<h3>Your basket → deposit</h3>
					{inv.length === 0 && <p className="muted">Nothing to deposit.</p>}
					{inv.length > 0 && chestRoom <= 0 && <p className="muted">This chest is full — withdraw something first.</p>}
					{inv.map(([id, qty]) => row(id, qty, 'deposit'))}
				</div>
				<div>
					<h3>Chest → withdraw</h3>
					{stored.length === 0 && <p className="muted">This chest is empty.</p>}
					{stored.length > 0 && basketRoom <= 0 && <p className="muted">Your basket is full — deposit or discard something first.</p>}
					{stored.map(([id, qty]) => row(id, qty, 'withdraw'))}
				</div>
			</div>
			<div className="chest-actions">
				<button
					onClick={() => {
						setPanel(null);
						bridge.emit('enter-move', { placementId: chest.id });
					}}
				>
					<Icon name="pin" size={14} /> Move chest
				</button>
				<button
					onClick={() => {
						setPanel(null);
						removePlacement(chest.id);
					}}
				>
					<Icon name="basket" size={14} /> Pick up (must be empty)
				</button>
			</div>
			<p className="muted">Crafting can use materials straight from any of your chests — store freely.</p>
		</Panel>
	);
}

export function CraftingPanel() {
	const { data, state, setPanel, craft, startPlacement, notify } = useGame();
	const linked = useLinkedChests();
	// default the Place filter to where you're standing — indoors, a dedicated "home"
	// filter shows only the camp comforts & furniture you can place inside
	const [placeFilter, setPlaceFilter] = useState(state?.player.area || 'all');
	const [typeFilter, setTypeFilter] = useState('all');
	const [query, setQuery] = useState('');
	if (!data || !state) return null;
	const player = state.player;
	const areaName = data.biomes.find((b) => b.id === player.area)?.name || 'this area';

	const availability = (id: string) => {
		const inInv = player.inventory?.[id] || 0;
		const inChests = linked.reduce((s, c) => s + (c.contents?.[id] || 0), 0);
		return { inInv, inChests, total: inInv + inChests };
	};

	const canCraft = (r: RecipeDef) => {
		if (!player.unlockedBiomes.includes(r.unlockBiome)) return false;
		if (r.requiresTool && (player.tools?.[r.requiresTool.id] || 1) < r.requiresTool.tier) return false;
		return Object.entries(r.materials).every(([id, q]) => availability(id).total >= q);
	};

	const catLabel: Record<string, string> = {
		plant: 'Plants & flowers', habitat: 'Habitat objects', structure: 'Structures & decor',
		decoration: 'Paths', storage: 'Storage', home: 'Camp comforts', kit: 'Restoration kits',
	};
	// display order for the category sections — Paths (decoration) sit at the bottom
	const CAT_ORDER = ['plant', 'habitat', 'structure', 'home', 'storage', 'kit', 'decoration'];
	const catRank = (c: string) => { const i = CAT_ORDER.indexOf(c); return i === -1 ? 50 : i; };
	const objOf = (r: RecipeDef) => data.habitatObjects.find((o) => o.id === r.output.itemId);
	// Only show recipes the player has actually unlocked: their biome is open AND
	// the biome is restored far enough (health / animals returned). Locked recipes
	// stay hidden until earned, then announce themselves with a toast.
	const unlocked = data.recipes.filter((r) => recipeUnlocked(r, data, state));
	const visible = unlocked
		// "home" shows only indoor-placeable decor; a biome shows what fits there plus
		// the area-less kits; "all" shows everything.
		.filter((r) => {
			const o = objOf(r);
			if (placeFilter === 'all') return true;
			if (placeFilter === 'home') return o?.placement === 'indoor' || o?.placement === 'both';
			return o?.placement === 'none' || (o?.biomes || []).includes(placeFilter);
		})
		.filter((r) => typeFilter === 'all' || r.category === typeFilter)
		// free-text search across the recipe name, what it makes, and its type
		.filter((r) => recipeMatchesSearch(r, objOf(r), catLabel[r.category] || r.category, query, Object.keys(r.materials).map((m) => resName(data, m))))
		.sort((a, b) => catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
	const categories = [...new Set(visible.map((r) => r.category))].sort((a, b) => catRank(a) - catRank(b));
	// areas + types available to the player, for the filter dropdowns
	const filterAreas = [...data.biomes]
		.sort((a, b) => a.order - b.order)
		.filter((b) => player.unlockedBiomes.includes(b.id));
	const filterTypes = [...new Set(unlocked.map((r) => r.category))].sort((a, b) => (catLabel[a] || a).localeCompare(catLabel[b] || b));
	const alreadyMade = (r: RecipeDef) => !!r.once && (player.craftedEver?.[r.output.itemId] || 0) > 0;

	const placeable = Object.entries(player.craftedItems || {}).filter(([id]) => {
		const def = data.habitatObjects.find((o) => o.id === id);
		return def && def.placement !== 'none';
	});

	return (
		<Panel title="Crafting" icon="hammer" onClose={() => setPanel(null)} wide>
			<p className="muted">
				Craft anywhere: materials come from your basket first, then from your chests
				({linked.length} chest{linked.length === 1 ? '' : 's'} in storage).
			</p>
			<div className="craft-filter">
				<label htmlFor="craft-place">Place:</label>
				<select id="craft-place" value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
					<option value="all">All areas</option>
					<option value="home">Inside your home</option>
					{filterAreas.map((b) => (
						<option key={b.id} value={b.id}>{b.name}</option>
					))}
				</select>
				<label htmlFor="craft-type">Type:</label>
				<select id="craft-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
					<option value="all">All types</option>
					{filterTypes.map((c) => (
						<option key={c} value={c}>{catLabel[c] || c}</option>
					))}
				</select>
				<label htmlFor="craft-search" className="sr-only">Search recipes</label>
				<input
					id="craft-search"
					className="craft-search"
					type="search"
					placeholder="Search recipes…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					autoComplete="off"
					aria-label="Search recipes"
				/>
			</div>
			{placeable.length > 0 && (
				<div className="placeable-bar">
					<b>Ready to place:</b>
					{placeable.map(([id, qty]) => {
						const def = data.habitatObjects.find((o) => o.id === id);
						const indoorOK = def?.placement === 'indoor' || def?.placement === 'both';
						const homeSpace = player.home?.space || 1;
						const homeBigEnough = !def?.homeMin || homeSpace >= def.homeMin;
						const here = player.area === 'home'
							? (indoorOK && homeBigEnough)
							: ((def?.biomes || []).includes(player.area) && def?.placement !== 'indoor');
						if (!here) {
							const msg = player.area === 'home'
								? (!indoorOK
									? `${def?.name} belongs out in the preserve, not in your home.`
									: `${def?.name} needs a bigger home — upgrade your home's Space first.`)
								: def?.placement === 'indoor'
									? `${def?.name} is for inside your home — step into your camp tent to place it.`
									: `${def?.name} can't be placed in ${areaName} — try: ${(def?.biomes || []).map((b) => data.biomes.find((x) => x.id === b)?.name || b).join(', ') || 'another area'}`;
							return (
								<button key={id} className="cant-place" title={msg} onClick={() => notify(msg, 'info')}>
									{def?.name} ×{qty}
								</button>
							);
						}
						return (
							<button key={id} onClick={() => startPlacement(id)}>
								{def?.name} ×{qty}
							</button>
						);
					})}
				</div>
			)}
			{visible.length === 0 && (
				query.trim()
					? <p className="muted small">No recipes match “{query.trim()}” — try a different search{(placeFilter !== 'all' || typeFilter !== 'all') ? ' or widen the filters' : ''}.</p>
					: <p className="muted small">Nothing to craft for this area yet — restore it further or pick a different place.</p>
			)}
			{categories.map((cat) => (
				<div key={cat}>
					<h3>{catLabel[cat] || cat}</h3>
					{visible.filter((r) => r.category === cat).map((r) => {
						const def = data.habitatObjects.find((o) => o.id === r.output.itemId);
						const made = alreadyMade(r);
						const ok = canCraft(r) && !made;
						return (
							<div className={`recipe ${ok || made ? '' : 'recipe-off'}`} key={r.id}>
								<div className="grow">
									<b>{r.name}</b>
									{r.output.qty > 1 ? ` ×${r.output.qty}` : ''}
									{r.once && <span className="once-tag" title="Can only be crafted once">one-time</span>}
									<div className="muted small">{def?.description}</div>
									<AreaTags data={data} def={def} />
									<div className="mats">
										{Object.entries(r.materials).map(([id, q]) => {
											const av = availability(id);
											const enough = av.total >= q;
											return (
												<span key={id} className={`mat ${enough ? 'mat-ok' : 'mat-no'}`} title={`${av.inInv} in basket, ${av.inChests} in linked chests`}>
													<span className="swatch" style={{ background: resColor(data, id) }} />
													{resName(data, id)} {Math.min(av.total, q)}/{q}
													<em className="mat-src">
														<Icon name="basket" size={11} /> {av.inInv}
														{av.inChests > 0 && <> + <Icon name="chest" size={11} /> {av.inChests}</>}
													</em>
												</span>
											);
										})}
									</div>
									{r.requiresTool && (player.tools?.[r.requiresTool.id] || 1) < r.requiresTool.tier && (
										<div className="muted small">Requires an upgraded tool — see Tools panel.</div>
									)}
								</div>
								<button disabled={!ok} onClick={() => craft(r.id)}>{made ? 'Crafted ✓' : 'Craft'}</button>
							</div>
						);
					})}
				</div>
			))}
		</Panel>
	);
}

export function ToolsPanel() {
	const { data, state, setPanel, upgradeTool } = useGame();
	const linked = useLinkedChests();
	if (!data || !state) return null;
	const player = state.player;

	const availability = (id: string) => (player.inventory?.[id] || 0) + linked.reduce((s, c) => s + (c.contents?.[id] || 0), 0);

	return (
		<Panel title="Tools & Upgrades" icon="tools" onClose={() => setPanel(null)} wide>
			{data.tools.map((tool) => {
				const tier = player.tools?.[tool.id] || 1;
				const current = tool.tiers.find((t) => t.tier === tier);
				const next = tool.tiers.find((t) => t.tier === tier + 1);
				let blocked: string | null = null;
				if (next?.requires) {
					const bs = state.biomeStates.find((b) => b.biomeId === next.requires!.biome);
					if ((bs?.health || 0) < next.requires.minHealth) {
						const biome = data.biomes.find((b) => b.id === next.requires!.biome);
						blocked = `Restore ${biome?.name} to ${next.requires.minHealth}% health first (now ${bs?.health || 0}%)`;
					}
				}
				const haveMats = next ? Object.entries(next.materials || {}).every(([id, q]) => availability(id) >= q) : false;
				return (
					<div className="recipe" key={tool.id}>
						<div className="grow">
							<b>{current?.name || tool.name}</b> <span className="muted small">tier {tier}</span>
							<div className="muted small">{current?.effect}</div>
							{next ? (
								<>
									<div className="small upgrade-next">Upgrade → <b>{next.name}</b>: {next.effect}</div>
									<div className="mats">
										{Object.entries(next.materials || {}).map(([id, q]) => (
											<span key={id} className={`mat ${availability(id) >= q ? 'mat-ok' : 'mat-no'}`}>
												<span className="swatch" style={{ background: resColor(data, id) }} />
												{resName(data, id)} {Math.min(availability(id), q)}/{q}
											</span>
										))}
									</div>
									{blocked && <div className="muted small">{blocked}</div>}
								</>
							) : (
								<div className="muted small">Fully upgraded.</div>
							)}
						</div>
						{next && (
							<button disabled={!haveMats || !!blocked} onClick={() => upgradeTool(tool.id)}>Upgrade</button>
						)}
					</div>
				);
			})}
			<p className="muted">Upgrades use materials from your basket and chests.</p>
		</Panel>
	);
}

export function BiomesPanel() {
	const { data, state, setPanel, changeArea } = useGame();
	if (!data || !state) return null;
	const here = state.player.area;
	return (
		<Panel title="The Preserve" icon="map" onClose={() => setPanel(null)} wide>
			{[...data.biomes].sort((a, b) => a.order - b.order).map((biome) => {
				const bs = state.biomeStates.find((x) => x.biomeId === biome.id);
				const unlocked = state.player.unlockedBiomes.includes(biome.id);
				const total = data.animals.filter((a) => a.biome === biome.id).length;
				const isHere = biome.id === here;
				const canTravel = unlocked && biome.explorable && !isHere;
				const travelTitle = isHere
					? 'You are here'
					: !unlocked
						? `Locked — ${biome.name} isn't open yet`
						: `Travel to ${biome.name}`;
				return (
					<div className={`biome-row ${unlocked && biome.explorable ? '' : 'biome-locked'}`} key={biome.id}>
						<div className="grow">
							<b>{biome.name}</b>{' '}
							{!biome.explorable ? (
								<span className="lock soon"><Icon name="sparkle" size={12} /> Coming soon</span>
							) : !unlocked ? (
								<span className="lock"><Icon name="lock" size={12} /> locked</span>
							) : isHere ? (
								<span className="lock soon"><Icon name="pin" size={12} /> you are here</span>
							) : null}
							<div className="muted small">{biome.description}</div>
							<div className="muted small"><b>Goal:</b> {biome.restorationGoal}</div>
							{biome.explorable && !unlocked && biome.unlock && <div className="small unlock-req"><b>To unlock:</b> {biome.unlock.label}</div>}
							{unlocked && bs && (
								<>
									<Meter label="Health" icon="leaf" value={bs.health} color="#6aa253" />
									<Meter label="Balance" icon="drop" value={bs.balance} color="#5b9cab" />
									<div className="muted small">{bs.returnedCount}/{total} animals returned</div>
									{BIOME_LORE[biome.id] && (
										<div className="biome-lore small">
											<p>{BIOME_LORE[biome.id][loreStage(bs.health)]}</p>
											<p className="biome-coexist"><Icon name="paw" size={12} /> {BIOME_LORE[biome.id].coexistence}</p>
										</div>
									)}
								</>
							)}
						</div>
						<button
							className="travel-icon"
							disabled={!canTravel}
							aria-label={travelTitle}
							title={travelTitle}
							onClick={async () => { setPanel(null); await changeArea(biome.id); }}
						>
							<Icon name={isHere ? 'pin' : 'walk'} size={18} />
						</button>
					</div>
				);
			})}
		</Panel>
	);
}

export function HomePanel() {
	const { data, state, setPanel, upgradeHome, setHomeStyle } = useGame();
	const linked = useLinkedChests();
	if (!data || !state) return null;
	const home = state.player.home || { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };
	const styleLocked = !!home.styleLocked;
	const styles = data.homeStyles || {};
	const tracks = data.homeTracks || {};
	const avail = (id: string) => (state.player.inventory?.[id] || 0) + linked.reduce((s, c) => s + (c.contents?.[id] || 0), 0);
	const biomeName = (id: string) => data.biomes.find((b) => b.id === id)?.name || id;
	const biomeHealth = (id: string) => state.biomeStates.find((b) => b.biomeId === id)?.health || 0;

	const TRACK_ORDER = ['space', 'comfort', 'decor', 'light'];

	// Stage 1 — still a tent: choose a style to build your house (the first upgrade).
	// Each style costs its own materials (wood for the cabin, stone for the hearth…).
	if (!styleLocked) {
		return (
			<Panel title="Build Your Home" icon="home" onClose={() => setPanel(null)} wide>
				<p className="muted">
					Your home is still a canvas tent. Choose a style to build it into a proper house — each is built from
					its own materials, this sets its look for good, and it opens up upgrade tracks afterward.
				</p>
				<div className="home-styles">
					{Object.entries(styles).map(([id, s]) => {
						const mats = s.materials || {};
						const gateMet = !s.requires || biomeHealth(s.requires.biome) >= s.requires.minHealth;
						const afford = Object.entries(mats).every(([rid, q]) => avail(rid) >= (q as number));
						return (
							<div className={`recipe ${gateMet && afford ? '' : 'recipe-off'}`} key={id}>
								<div className="grow">
									<span className="home-style-swatch lg" style={{ background: s.floor, borderColor: s.wall, verticalAlign: 'middle', display: 'inline-block', marginRight: 8 }} />
									<b>{s.name}</b>
									<div className="mats">
										{Object.entries(mats).map(([rid, q]) => (
											<span key={rid} className={`mat ${avail(rid) >= (q as number) ? 'mat-ok' : 'mat-no'}`}>
												<span className="swatch" style={{ background: resColor(data, rid) }} />
												{resName(data, rid)} {Math.min(avail(rid), q as number)}/{q as number}
											</span>
										))}
									</div>
									{s.requires && !gateMet && (
										<div className="small unlock-req">
											<b>Needs:</b> {biomeName(s.requires.biome)} at {s.requires.minHealth}% (now {biomeHealth(s.requires.biome)}%)
										</div>
									)}
								</div>
								<button disabled={!gateMet || !afford} onClick={() => setHomeStyle(id)}>Build</button>
							</div>
						);
					})}
				</div>
			</Panel>
		);
	}

	// Stage 2 — built: show the chosen style and the four upgrade tracks.
	return (
		<Panel title="Your Home" icon="home" onClose={() => setPanel(null)} wide>
			<p className="muted">
				Your <b>{styles[home.style]?.name || 'home'}</b> is built. Decorate it with crafted camp comforts (step
				inside), and upgrade it along its upgrade tracks.
			</p>
			<h3>Upgrades</h3>
			{TRACK_ORDER.filter((k) => tracks[k]).map((key) => {
				const def = tracks[key];
				const level = (home as any)[key] || 1;
				const maxLevel = def.levels.length;
				const next = def.levels[level]; // the (level+1)th entry
				const gateMet = !next?.requires || biomeHealth(next.requires.biome) >= next.requires.minHealth;
				const canAfford = !next || Object.entries(next.materials || {}).every(([id, q]) => avail(id) >= q);
				return (
					<div className={`recipe ${!next || (gateMet && canAfford) ? '' : 'recipe-off'}`} key={key}>
						<div className="grow">
							<b>{def.name}</b> <span className="muted small">· level {level}/{maxLevel}</span>
							<div className="muted small">{def.blurb}</div>
							{next ? (
								<>
									<div className="mats">
										{Object.entries(next.materials || {}).map(([id, q]) => (
											<span key={id} className={`mat ${avail(id) >= q ? 'mat-ok' : 'mat-no'}`}>
												<span className="swatch" style={{ background: resColor(data, id) }} />
												{resName(data, id)} {Math.min(avail(id), q)}/{q}
											</span>
										))}
									</div>
									{next.requires && !gateMet && (
										<div className="small unlock-req">
											<b>Needs:</b> {biomeName(next.requires.biome)} at {next.requires.minHealth}% (now {biomeHealth(next.requires.biome)}%)
										</div>
									)}
								</>
							) : (
								<div className="muted small">Maxed out.</div>
							)}
						</div>
						{next && <button disabled={!gateMet || !canAfford} onClick={() => upgradeHome(key)}>Upgrade</button>}
					</div>
				);
			})}
		</Panel>
	);
}

export function WeatherPanel() {
	const { data, state, setPanel } = useGame();
	// Tick once a second so the live clock, day-progress bar, and countdown
	// advance smoothly while the panel is open.
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = window.setInterval(() => setTick((n) => n + 1), 1000);
		return () => window.clearInterval(id);
	}, []);
	if (!data || !state) return null;

	const snap = state.weather;
	const worldId = (state as any).worldId || state.player.id;
	const here = state.player.area;
	const ss = seasonStyle(liveSeason(snap));

	const unlockedBiomes = [...data.biomes]
		.filter((b) => b.explorable && state.player.unlockedBiomes.includes(b.id))
		.sort((a, b) => a.order - b.order);

	const season = liveSeason(snap);
	const hereType = liveWeatherType(worldId, here, snap);
	const hereWt = weatherType(hereType);
	const hereName = data.biomes.find((b) => b.id === here)?.name || 'this biome';
	const wxText = weatherEffect(here, hereType);
	const seasonText = seasonEffect(here, season);
	// Whether something is gatherable right now — used only as a vague teaser; the
	// resource itself stays a surprise you discover out in the world.
	const teaseGather = !!gatherResourceFor(data.resources, here, hereType);

	const cell = (t: string) => {
		const wt = weatherType(t);
		return <span className="wx-cell" title={wt.name}><Icon name={wt.icon} size={14} /> {wt.name}</span>;
	};

	return (
		<Panel title="Weather & Seasons" icon="cloud" onClose={() => setPanel(null)} wide>
			<div className="wx-now">
				<span className="hud-season" style={{ color: ss.accent, borderColor: ss.accent }}>{ss.label}</span>
				{here !== 'home' && <span className="muted small">{hereName}</span>}
			</div>

			{here !== 'home' && (
				<>
					<div className="wx-effect">
						<div className="wx-effect-head"><Icon name={hereWt.icon} size={16} /> <b>{hereWt.name}</b> over {hereName}</div>
						{wxText && <p>{wxText}</p>}
						{teaseGather && <p className="muted small">Unusual weather like this can leave something worth finding — explore {hereName} while it lasts.</p>}
					</div>
					<div className="wx-effect">
						<div className="wx-effect-head"><Icon name="sparkle" size={16} /> <b>{ss.label}</b> in {hereName}</div>
						{seasonText && <p>{seasonText}</p>}
					</div>
				</>
			)}

			<h3>Across the preserve</h3>
			<table className="wx-table">
				<thead>
					<tr><th>Biome</th><th>Now</th><th>Next</th><th>Later</th></tr>
				</thead>
				<tbody>
					{unlockedBiomes.map((b) => (
						<tr key={b.id} className={b.id === here ? 'wx-here' : ''}>
							<td>{b.name}{b.id === here && <span className="muted small"> · here</span>}</td>
							<td>{cell(liveWeatherType(worldId, b.id, snap))}</td>
							<td>{cell(forecastType(worldId, b.id, snap, 1))}</td>
							<td>{cell(forecastType(worldId, b.id, snap, 2))}</td>
						</tr>
					))}
				</tbody>
			</table>

			<p className="muted small">Seasons drift from spring through summer, autumn, and winter, shifting which weather each biome is likely to see.</p>
		</Panel>
	);
}

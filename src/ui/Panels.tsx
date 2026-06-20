import React, { useMemo, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { ChestState, RecipeDef } from '../types';
import { recipeUnlocked } from '../recipes';
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
							return (
								<div className="cell row" key={id}>
									<span className="grow">{name}</span>
									<b>×{qty}</b>
									{def && def.placement !== 'none' && (
										<button onClick={() => startPlacement(id)} title={`Place ${name}`}>
											<Icon name="pin" size={12} /> Place
										</button>
									)}
									<button className="subtle" title={`Throw away one ${name}`} onClick={() => toss('crafted', id, 1, name)}>
										<Icon name="trash" size={12} />
									</button>
								</div>
							);
						})}
					</div>
					<p className="muted">Kits (like restoration kits) are not placed — crafting them is what counts.</p>
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
	// default the Place filter to the biome you're standing in, so the menu shows
	// what you can actually build right here
	const [placeFilter, setPlaceFilter] = useState(state?.player.area || 'all');
	const [typeFilter, setTypeFilter] = useState('all');
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
		// non-placeable items (restoration kits) aren't tied to any area, so they
		// always show regardless of the Place filter — never hidden behind it.
		.filter((r) => placeFilter === 'all' || objOf(r)?.placement === 'none' || (objOf(r)?.biomes || []).includes(placeFilter))
		.filter((r) => typeFilter === 'all' || r.category === typeFilter)
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
			</div>
			{placeable.length > 0 && (
				<div className="placeable-bar">
					<b>Ready to place:</b>
					{placeable.map(([id, qty]) => {
						const def = data.habitatObjects.find((o) => o.id === id);
						const here = (def?.biomes || []).includes(player.area);
						if (!here) {
							const where = (def?.biomes || []).map((b) => data.biomes.find((x) => x.id === b)?.name || b).join(', ');
							const msg = `${def?.name} can't be placed in ${areaName} — try: ${where || 'another area'}`;
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
				<p className="muted small">Nothing to craft for this area yet — restore it further or pick a different place.</p>
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

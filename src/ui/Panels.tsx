import React, { useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { ChestState, RecipeDef } from '../types';
import { customGoalsUnlocked, guideBiomeFor } from '../types';
import { homePerkStrength } from '../types';
import { recipeUnlocked, recipeSearchScore, upcomingRecipes } from '../recipes';
import { useGear, setGear, GEAR_IDS, type GearId } from '../gear';
import { nextHealthMilestone } from '../health';
import {
	weatherType,
	seasonStyle,
	liveSeason,
	liveWeatherType,
	forecastType,
	gatherResourceFor,
	weatherEffect,
	seasonEffect,
	WEATHER_TYPES,
	gatherResourceIdFor,
} from '../weather';
import { content } from '../i18n';
import { useI18n } from '../i18n/react';
import { Meter } from './HUD';
import { Icon, ObjectIcon, ResourceIcon } from './icons';
import { BIOME_LORE, loreStage } from './lore';

function Panel({
	title,
	icon,
	children,
	onClose,
	wide,
	bodyRef,
}: {
	title: string;
	icon?: string;
	children: React.ReactNode;
	onClose: () => void;
	wide?: boolean;
	bodyRef?: React.Ref<HTMLDivElement>;
}) {
	const { t } = useI18n();
	return (
		<div className="panel-backdrop" onClick={onClose}>
			<div className={`panel ${wide ? 'panel-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						{icon && <Icon name={icon} size={20} />} {title}
					</h2>
					<button className="icon-btn" onClick={onClose} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body" ref={bodyRef}>
					{children}
				</div>
			</div>
		</div>
	);
}

function resName(data: any, id: string) {
	const r = data?.resources.find((r: any) => r.id === id);
	return r ? content('resource', r.id, 'name', r.name) : id;
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
	const { t } = useI18n();
	if (!def) return null;
	if (def.placement === 'none') {
		return (
			<span className="area-tags">
				<span className="area-tag area-tag-muted">{t('panels.areaTags.usedInCrafting')}</span>
			</span>
		);
	}
	const biomes: string[] = def.biomes || [];
	const allAreas = biomes.length >= data.biomes.length;
	const canCamp = def.placement === 'both' || def.placement === 'indoor';
	return (
		<span className="area-tags">
			<span className="area-tags-label">{t('panels.areaTags.placeIn')}</span>
			{allAreas ? (
				<span className="area-tag">
					<span className="area-dot" style={{ background: 'var(--green-2)' }} />
					{t('panels.areaTags.allAreas')}
				</span>
			) : (
				biomes.map((bid) => {
					const b = data.biomes.find((x: any) => x.id === bid);
					return (
						<span className="area-tag" key={bid}>
							<span className="area-dot" style={{ background: b?.palette?.healthy || '#8fbf6f' }} />
							{b ? content('biome', b.id, 'name', b.name) : bid}
						</span>
					);
				})
			)}
			{canCamp && (
				<span className="area-tag">
					<span className="area-dot" style={{ background: 'var(--gold)' }} />
					{t('panels.areaTags.camp')}
				</span>
			)}
		</span>
	);
}

// The crafting menu's filters, search text, and scroll position survive
// close/reopen within a session — you come back to the recipe you were on.
// But only while you stay in the same area: walk somewhere new and the menu
// starts fresh, scoped to where you're standing now.
const craftingMemory: {
	area: string | null;
	placeFilter: string | null;
	typeFilter: string;
	query: string;
	scrollTop: number;
} = {
	area: null,
	placeFilter: null,
	typeFilter: 'all',
	query: '',
	scrollTop: 0,
};

// All of your chests feed crafting — no station or proximity required.
export function useLinkedChests(): ChestState[] {
	const { state } = useGame();
	return useMemo(() => state?.chests ?? [], [state]);
}

export function InventoryPanel() {
	const { data, state, setPanel, startPlacement, discard } = useGame();
	const { t, content } = useI18n();
	if (!data || !state) return null;
	const inv = Object.entries(state.player.inventory || {}).filter(([, q]) => q > 0);
	const carried = inv.reduce((a, [, q]) => a + q, 0);
	// Restoration kits and caretaker gear (headlamp…) are once-only milestone
	// items — protected from discard so they can't be lost for good.
	const kitItemIds = new Set(
		data.recipes.filter((r) => r.category === 'kit' || r.category === 'gear').map((r) => r.output.itemId),
	);

	const toss = (kind: 'material' | 'crafted', id: string, qty: number, name: string) => {
		if (window.confirm(t('panels.inventory.confirmDiscard', { qty, name }))) discard(kind, id, qty, name);
	};

	return (
		<Panel
			title={t('panels.inventory.title', { carried, capacity: state.inventoryCapacity })}
			icon="basket"
			onClose={() => setPanel(null)}
		>
			<button className="link materials-link" onClick={() => setPanel('materials')}>
				<Icon name="help" size={13} /> {t('panels.inventory.materialsGuide')}
			</button>
			{inv.length === 0 && <p className="muted">{t('panels.inventory.empty')}</p>}
			<div className="grid">
				{inv.map(([id, qty]) => {
					const name = resName(data, id);
					return (
						<div className="cell row" key={id}>
							<ResourceIcon id={id} color={resColor(data, id)} />
							<span className="grow">{name}</span>
							<b>×{qty}</b>
							<button
								className="subtle"
								title={t('panels.inventory.tossOne', { name })}
								onClick={() => toss('material', id, 1, name)}
							>
								<Icon name="trash" size={12} />
							</button>
							<button
								className="subtle"
								title={t('panels.inventory.tossAll', { name })}
								onClick={() => toss('material', id, qty, name)}
							>
								{t('panels.common.all')}
							</button>
						</div>
					);
				})}
			</div>
			{Object.keys(state.player.craftedItems || {}).length > 0 && (
				<>
					<h3>{t('panels.inventory.craftedItems')}</h3>
					<div className="grid">
						{Object.entries(state.player.craftedItems).map(([id, qty]) => {
							const def = data.habitatObjects.find((o) => o.id === id);
							const name = def ? content('habitatObject', def.id, 'name', def.name) : id;
							// Restoration kits are milestone items — crafting them is what counts,
							// so they can't be thrown away by mistake.
							const isKit = kitItemIds.has(id);
							return (
								<div className="cell row" key={id}>
									<ObjectIcon shape={def?.shape} color={def?.color} size={18} />
									<span className="grow">{name}</span>
									<b>×{qty}</b>
									{def && def.placement !== 'none' && (
										<button onClick={() => startPlacement(id)} title={t('panels.inventory.placeItem', { name })}>
											<Icon name="pin" size={12} /> {t('panels.inventory.place')}
										</button>
									)}
									{!isKit && (
										<button
											className="subtle"
											title={t('panels.inventory.tossOne', { name })}
											onClick={() => toss('crafted', id, 1, name)}
										>
											<Icon name="trash" size={12} />
										</button>
									)}
								</div>
							);
						})}
					</div>
					<p className="muted">{t('panels.inventory.kitsNote')}</p>
				</>
			)}
		</Panel>
	);
}

export function ChestPanel() {
	const { data, state, activeChestId, setPanel, transfer, removePlacement } = useGame();
	const { t, content } = useI18n();
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
			<button disabled={busy || amount <= 0} onClick={() => doTransfer(id, amount, dir)}>
				{label}
			</button>
		);
		return (
			<div className="cell row" key={id}>
				<ResourceIcon id={id} color={resColor(data, id)} />
				<span className="grow">{resName(data, id)}</span>
				<b>×{qty}</b>
				{btn('1', Math.min(1, max))}
				{btn('5', Math.min(5, max))}
				{btn(t('panels.common.all'), max)}
			</div>
		);
	};

	return (
		<Panel
			title={t('panels.chest.title', {
				name: def ? content('habitatObject', def.id, 'name', def.name) : t('panels.chest.fallbackName'),
				used,
				capacity: chest.capacity,
			})}
			icon="chest"
			onClose={() => setPanel(null)}
			wide
		>
			<div className="columns">
				<div>
					<h3>{t('panels.chest.deposit')}</h3>
					{inv.length === 0 && <p className="muted">{t('panels.chest.nothingToDeposit')}</p>}
					{inv.length > 0 && chestRoom <= 0 && <p className="muted">{t('panels.chest.chestFull')}</p>}
					{inv.map(([id, qty]) => row(id, qty, 'deposit'))}
				</div>
				<div>
					<h3>{t('panels.chest.withdraw')}</h3>
					{stored.length === 0 && <p className="muted">{t('panels.chest.chestEmpty')}</p>}
					{stored.length > 0 && basketRoom <= 0 && <p className="muted">{t('panels.chest.basketFull')}</p>}
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
					<Icon name="pin" size={14} /> {t('panels.chest.move')}
				</button>
				<button
					onClick={() => {
						setPanel(null);
						removePlacement(chest.id);
					}}
				>
					<Icon name="basket" size={14} /> {t('panels.chest.pickUp')}
				</button>
			</div>
			<p className="muted">{t('panels.chest.storageNote')}</p>
		</Panel>
	);
}

export function CraftingPanel() {
	const { data, state, setPanel, craft, startPlacement, notify, addGoal } = useGame();
	// The target buttons only exist once the player can actually set goals.
	const canSetGoals = customGoalsUnlocked(state);
	const { t, content } = useI18n();
	const linked = useLinkedChests();
	// default the Place filter to where you're standing — indoors, a dedicated "home"
	// filter shows only the camp comforts & furniture you can place inside.
	// Reopening the menu restores your last filters, search, and scroll position
	// (playtest: it reset to the top every time, losing the recipe you were on) —
	// but only within the same area. Searching in the meadow and then walking
	// home shouldn't carry the meadow's search into the home menu.
	const currentArea = state?.player.area || 'all';
	// tent interiors follow home rules, and 'tent-*' isn't a Place option anyway
	const defaultPlace = currentArea.startsWith('tent-') ? 'home' : currentArea;
	if (craftingMemory.area !== currentArea) {
		craftingMemory.area = currentArea;
		craftingMemory.placeFilter = null;
		craftingMemory.typeFilter = 'all';
		craftingMemory.query = '';
		craftingMemory.scrollTop = 0;
	}
	const [placeFilter, setPlaceFilter] = useState(craftingMemory.placeFilter ?? defaultPlace);
	const [typeFilter, setTypeFilter] = useState(craftingMemory.typeFilter);
	const [query, setQuery] = useState(craftingMemory.query);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		craftingMemory.placeFilter = placeFilter;
		craftingMemory.typeFilter = typeFilter;
		craftingMemory.query = query;
	}, [placeFilter, typeFilter, query]);
	useEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		el.scrollTop = craftingMemory.scrollTop;
		const save = () => {
			craftingMemory.scrollTop = el.scrollTop;
		};
		el.addEventListener('scroll', save, { passive: true });
		return () => el.removeEventListener('scroll', save);
	}, []);
	if (!data || !state) return null;
	const player = state.player;
	const areaBiome = data.biomes.find((b) => b.id === player.area);
	const areaName = areaBiome ? content('biome', areaBiome.id, 'name', areaBiome.name) : t('panels.crafting.thisArea');

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
		plant: t('panels.crafting.category.plant'),
		habitat: t('panels.crafting.category.habitat'),
		structure: t('panels.crafting.category.structure'),
		decoration: t('panels.crafting.category.decoration'),
		storage: t('panels.crafting.category.storage'),
		home: t('panels.crafting.category.home'),
		kit: t('panels.crafting.category.kit'),
		gear: t('panels.crafting.category.gear'),
	};
	// display order for the category sections — crafted things first, plantables
	// after them, Paths (decoration) at the bottom
	const CAT_ORDER = ['habitat', 'structure', 'home', 'storage', 'gear', 'kit', 'plant', 'decoration'];
	const catRank = (c: string) => {
		const i = CAT_ORDER.indexOf(c);
		return i === -1 ? 50 : i;
	};
	const objOf = (r: RecipeDef) => data.habitatObjects.find((o) => o.id === r.output.itemId);
	// The Place filter asks where a thing GOES, not where its recipe unlocks:
	// "home" shows only indoor-placeable decor; a biome shows what fits there plus
	// the area-less kits; "all" shows everything. One predicate, shared by the
	// craftable list, the locked-recipe search and Coming up next, so all three
	// answer the same question about the same filter.
	const matchesPlace = (r: RecipeDef) => {
		const o = objOf(r);
		if (placeFilter === 'all') return true;
		if (placeFilter === 'home') return o?.placement === 'indoor' || o?.placement === 'both';
		return o?.placement === 'none' || (o?.biomes || []).includes(placeFilter);
	};
	// Only show recipes the player has actually unlocked: their biome is open AND
	// the biome is restored far enough (health / animals returned). Locked recipes
	// stay hidden until earned, then announce themselves with a toast.
	const unlocked = data.recipes.filter((r) => recipeUnlocked(r, data, state));
	const searching = query.trim().length > 0;
	const searchScores = new Map<string, number>();
	const visible = unlocked
		.filter(matchesPlace)
		.filter((r) => typeFilter === 'all' || r.category === typeFilter)
		// free-text search across the recipe name, what it makes, and its type —
		// ranked, so a name hit ("gr" → Grass Patch) sorts above recipes that only
		// mention the query in their description or ingredients
		.filter((r) => {
			const s = recipeSearchScore(
				r,
				objOf(r),
				catLabel[r.category] || r.category,
				query,
				Object.keys(r.materials).map((m) => resName(data, m)),
			);
			if (s < 0) return false;
			searchScores.set(r.id, s);
			return true;
		})
		.sort(
			(a, b) =>
				(searching ? searchScores.get(a.id)! - searchScores.get(b.id)! : 0) ||
				catRank(a.category) - catRank(b.category) ||
				a.name.localeCompare(b.name),
		);
	// while searching, the category holding the best match floats to the top
	const bestInCat = (c: string) =>
		Math.min(...visible.filter((r) => r.category === c).map((r) => searchScores.get(r.id)!));
	const categories = [...new Set(visible.map((r) => r.category))].sort(
		(a, b) => (searching ? bestInCat(a) - bestInCat(b) : 0) || catRank(a) - catRank(b),
	);
	// areas + types available to the player, for the filter dropdowns
	const filterAreas = [...data.biomes]
		.sort((a, b) => a.order - b.order)
		.filter((b) => player.unlockedBiomes.includes(b.id));
	const filterTypes = [...new Set(unlocked.map((r) => r.category))].sort((a, b) =>
		(catLabel[a] || a).localeCompare(catLabel[b] || b),
	);
	const alreadyMade = (r: RecipeDef) => !!r.once && (player.craftedEver?.[r.output.itemId] || 0) > 0;
	// Biome-unlock kits are tracked by the "unlock next biome" goal, so they don't
	// get their own craft-goal button.
	const unlockKitIds = new Set(data.biomes.map((b) => b.unlock?.requiresItem).filter(Boolean) as string[]);
	// The next few recipes this area is holding back, nearest first. Scoped by the
	// same Place predicate as the list above — passing `area: 'all'` for Home used
	// to hand back outdoor recipes from every open biome, because unlockBiome has
	// no way to say "indoor" — and never the biome-unlock kits (the pinned "open
	// the next area" goal already tracks those).
	const upcoming = upcomingRecipes(data, state, {
		match: matchesPlace,
		limit: 4,
		skipItemIds: unlockKitIds,
	});

	// Searching for something you cannot make yet used to come up empty, which
	// reads as "this doesn't exist". Instead the locked recipes that match are
	// listed greyed out with the requirement that would open them — the same shape
	// as Coming up next, so the search bar answers "how do I get this?".
	// Scoped like `upcoming`: only areas already open, never the plantables (they
	// have their own section below).
	const lockedMatches = !searching
		? []
		: data.recipes
				.filter((r) => r.unlock && !recipeUnlocked(r, data, state))
				.filter((r) => (player.unlockedBiomes || []).includes(r.unlockBiome))
				.filter((r) => !objOf(r)?.plantable)
				.filter(matchesPlace)
				.filter((r) => typeFilter === 'all' || r.category === typeFilter)
				.map((r) => ({
					r,
					s: recipeSearchScore(
						r,
						objOf(r),
						catLabel[r.category] || r.category,
						query,
						Object.keys(r.materials).map((m) => resName(data, m)),
					),
				}))
				.filter(({ s }) => s >= 0)
				.sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
				.slice(0, 8)
				.map(({ r }) => r);

	const placeable = Object.entries(player.craftedItems || {}).filter(([id]) => {
		const def = data.habitatObjects.find((o) => o.id === id);
		return def && def.placement !== 'none';
	});

	// Plantables (wildflowers, grasses, trees…) are hidden from crafting by
	// design (recipes.ts) — you PLANT them. Searching for one used to come up
	// silently empty (playtest: "wildflower" stalled the whole session), so
	// cross-reference them instead of leaving the player stranded.
	const q = query.trim().toLowerCase();
	const plantableMatches = q
		? data.habitatObjects
				.filter(
					(o) =>
						o.plantable &&
						(o.biomes || []).some((b) => player.unlockedBiomes.includes(b)) &&
						(o.name.toLowerCase().includes(q) ||
							content('habitatObject', o.id, 'name', o.name).toLowerCase().includes(q) ||
							(o.description || '').toLowerCase().includes(q)),
				)
				.slice(0, 4)
		: [];

	return (
		<Panel title={t('panels.crafting.title')} icon="hammer" onClose={() => setPanel(null)} wide bodyRef={bodyRef}>
			<p className="muted">{t('panels.crafting.intro', { count: linked.length })}</p>
			{/* The filters and what you have in hand stay put while the list scrolls:
			    the recipe list is long, and both of these are things you reach for
			    mid-scroll — narrowing the list, or placing the thing you just made. */}
			<div className="craft-sticky">
				<div className="craft-filter">
					<label htmlFor="craft-place">{t('panels.crafting.placeLabel')}</label>
					<select id="craft-place" value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
						<option value="all">{t('panels.crafting.allAreas')}</option>
						<option value="home">{t('panels.crafting.insideHome')}</option>
						{filterAreas.map((b) => (
							<option key={b.id} value={b.id}>
								{content('biome', b.id, 'name', b.name)}
							</option>
						))}
					</select>
					<label htmlFor="craft-type">{t('panels.crafting.typeLabel')}</label>
					<select id="craft-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
						<option value="all">{t('panels.crafting.allTypes')}</option>
						{filterTypes.map((c) => (
							<option key={c} value={c}>
								{catLabel[c] || c}
							</option>
						))}
					</select>
					<label htmlFor="craft-search" className="sr-only">
						{t('panels.crafting.searchRecipes')}
					</label>
					<input
						id="craft-search"
						className="craft-search"
						type="search"
						placeholder={t('panels.crafting.searchPlaceholder')}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						autoComplete="off"
						aria-label={t('panels.crafting.searchRecipes')}
					/>
				</div>
				{placeable.length > 0 && (
					<div className="placeable-bar">
						<b>{t('panels.crafting.readyToPlace')}</b>
						{placeable.map(([id, qty]) => {
							const def = data.habitatObjects.find((o) => o.id === id);
							const defName = def ? content('habitatObject', def.id, 'name', def.name) : id;
							const indoorOK = def?.placement === 'indoor' || def?.placement === 'both';
							// a trail-tent interior follows home rules at the starter size (space 1)
							const inTent = player.area.startsWith('tent-');
							const indoors = player.area === 'home' || inTent;
							const space = inTent ? 1 : player.home?.space || 1;
							const homeBigEnough = !def?.homeMin || space >= def.homeMin;
							const here = indoors
								? indoorOK && homeBigEnough
								: (def?.biomes || []).includes(player.area) && def?.placement !== 'indoor';
							if (!here) {
								const msg = indoors
									? !indoorOK
										? t('panels.crafting.notIndoor', { name: defName })
										: inTent
											? t('panels.crafting.tentTooSmall', { name: defName })
											: t('panels.crafting.needsBiggerHome', { name: defName })
									: def?.placement === 'indoor'
										? t('panels.crafting.indoorOnly', { name: defName })
										: t('panels.crafting.wrongArea', {
												name: defName,
												area: areaName,
												areas:
													(def?.biomes || [])
														.map((b) => {
															const x = data.biomes.find((xb) => xb.id === b);
															return x ? content('biome', x.id, 'name', x.name) : b;
														})
														.join(', ') || t('panels.crafting.anotherArea'),
											});
								return (
									<button key={id} className="cant-place" title={msg} onClick={() => notify(msg, 'info')}>
										<ObjectIcon shape={def?.shape} color={def?.color} size={18} /> {defName} ×{qty}
									</button>
								);
							}
							return (
								<button key={id} onClick={() => startPlacement(id)}>
									<ObjectIcon shape={def?.shape} color={def?.color} size={18} /> {defName} ×{qty}
								</button>
							);
						})}
					</div>
				)}
			</div>
			{visible.length === 0 &&
				plantableMatches.length === 0 &&
				(query.trim() ? (
					<p className="muted small">
						{t(
							placeFilter !== 'all' || typeFilter !== 'all'
								? 'panels.crafting.noMatchWiden'
								: 'panels.crafting.noMatch',
							{ query: query.trim() },
						)}
					</p>
				) : (
					<p className="muted small">{t('panels.crafting.nothingToCraft')}</p>
				))}
			{categories.map((cat) => (
				<div key={cat}>
					<h3>{catLabel[cat] || cat}</h3>
					{visible
						.filter((r) => r.category === cat)
						.map((r) => {
							const def = data.habitatObjects.find((o) => o.id === r.output.itemId);
							const made = alreadyMade(r);
							const ok = canCraft(r) && !made;
							const goalAdded = (state.customGoals || []).some(
								(g) => g.kind === 'craft' && g.itemId === r.output.itemId,
							);
							return (
								<div className={`recipe ${ok || made ? '' : 'recipe-off'}`} key={r.id}>
									{/* the same sprite the world will draw once it's placed */}
									<ObjectIcon shape={def?.shape} color={def?.color} size={34} />
									<div className="grow">
										<b>{content('recipe', r.id, 'name', r.name)}</b>
										{r.output.qty > 1 ? ` ×${r.output.qty}` : ''}
										{r.once && (
											<span className="once-tag" title={t('panels.crafting.onceTitle')}>
												{t('panels.crafting.onceTag')}
											</span>
										)}
										<div className="muted small">
											{def ? content('habitatObject', def.id, 'description', def.description) : ''}
										</div>
										<AreaTags data={data} def={def} />
										<div className="mats">
											{Object.entries(r.materials).map(([id, q]) => {
												const av = availability(id);
												const enough = av.total >= q;
												return (
													<span
														key={id}
														className={`mat ${enough ? 'mat-ok' : 'mat-no'}`}
														title={t('panels.crafting.matTitle', { inBasket: av.inInv, inChests: av.inChests })}
													>
														<ResourceIcon id={id} color={resColor(data, id)} />
														{resName(data, id)} {Math.min(av.total, q)}/{q}
														<em className="mat-src">
															<Icon name="basket" size={11} /> {av.inInv}
															{av.inChests > 0 && (
																<>
																	{' '}
																	+ <Icon name="chest" size={11} /> {av.inChests}
																</>
															)}
														</em>
													</span>
												);
											})}
										</div>
										{r.requiresTool && (player.tools?.[r.requiresTool.id] || 1) < r.requiresTool.tier && (
											<div className="muted small">{t('panels.crafting.requiresTool')}</div>
										)}
									</div>
									<div className="recipe-actions">
										{/* Hide the "set as goal" button when it'd be busywork: a once-only
									    recipe already made, or one you can already afford to craft now. */}
										{canSetGoals && !(r.once && made) && !canCraft(r) && !unlockKitIds.has(r.output.itemId) && (
											<button
												className="icon-btn subtle add-goal-btn"
												disabled={goalAdded}
												title={goalAdded ? t('panels.goals.alreadyAdded') : t('panels.crafting.addGoal')}
												aria-label={goalAdded ? t('panels.goals.alreadyAdded') : t('panels.crafting.addGoal')}
												onClick={() => addGoal({ kind: 'craft', itemId: r.output.itemId, target: 1 })}
											>
												<Icon name="target" size={13} />
											</button>
										)}
										<button disabled={!ok} onClick={() => craft(r.id)}>
											{made ? t('panels.crafting.crafted') : t('panels.crafting.craft')}
										</button>
									</div>
								</div>
							);
						})}
				</div>
			))}
			{/* What's coming next. Locked recipes stay hidden, but showing the nearest
			    few with their requirement turns "there's nothing else here" into
			    something to work toward — and each requirement is its own, so this
			    doubles as a list of different things worth doing today. Hidden while
			    searching (the search is about what you can make now). */}
			{!searching && upcoming.length > 0 && (
				<div>
					<h3>
						<Icon name="lock" size={14} /> {t('panels.crafting.comingUp')}
					</h3>
					{upcoming.map(({ recipe: r }) => {
						const def = objOf(r);
						return (
							<div className="recipe recipe-off" key={`soon-${r.id}`}>
								<ObjectIcon shape={def?.shape || 'patch'} color={def?.color || '#8a8a8a'} size={34} />
								<div className="grow">
									<b>{content('recipe', r.id, 'name', r.name)}</b>
									<div className="small unlock-req">
										<b>{t('panels.crafting.needs')}</b> {content('recipe', r.id, 'unlock.label', r.unlock!.label)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
			{searching && lockedMatches.length > 0 && (
				<div>
					<h3>
						<Icon name="lock" size={14} /> {t('panels.crafting.lockedSection')}
					</h3>
					{lockedMatches.map((r) => {
						const def = objOf(r);
						return (
							<div className="recipe recipe-off" key={`locked-${r.id}`}>
								<ObjectIcon shape={def?.shape || 'patch'} color={def?.color || '#8a8a8a'} size={34} />
								<div className="grow">
									<b>{content('recipe', r.id, 'name', r.name)}</b>
									<div className="small unlock-req">
										<b>{t('panels.crafting.needs')}</b> {content('recipe', r.id, 'unlock.label', r.unlock!.label)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
			{/* plantable cross-references get their own labelled section below the
			    craftable results — recipes you can actually craft always come first */}
			{plantableMatches.length > 0 && (
				<div>
					<h3>
						<Icon name="leaf" size={14} /> {t('panels.crafting.plantedSection')}
					</h3>
					{plantableMatches.map((o) => (
						<div className="recipe" key={o.id}>
							<ObjectIcon shape={o.shape} color={o.color} size={34} />
							<div className="grow">
								<b>
									<Icon name="leaf" size={14} /> {content('habitatObject', o.id, 'name', o.name)}
								</b>
								<div className="muted small">{t('panels.crafting.plantedNotCrafted')}</div>
								<AreaTags data={data} def={o} />
							</div>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}

// Caretaker gear that can be switched on/off from the Tools & Upgrades menu.
// Maps each toggle id to the item you craft to own it.
const GEAR_ITEM: Record<GearId, string> = { boots: 'hiking-boots', binoculars: 'binoculars', headlamp: 'headlamp' };

export function ToolsPanel() {
	const { data, state, setPanel, upgradeTool } = useGame();
	const { t, content } = useI18n();
	const linked = useLinkedChests();
	const gear = useGear();
	if (!data || !state) return null;
	const player = state.player;

	const availability = (id: string) =>
		(player.inventory?.[id] || 0) + linked.reduce((s, c) => s + (c.contents?.[id] || 0), 0);
	// Gear is a once-only craft kept forever (craftedEver survives inventory shifts).
	const ownsGear = (itemId: string) => (player.craftedEver?.[itemId] || 0) + (player.craftedItems?.[itemId] || 0) > 0;
	const ownedGear = GEAR_IDS.filter((id) => ownsGear(GEAR_ITEM[id]));

	// The bench shows the guide for HERE, in the row of tools like any other.
	//
	// Every area has its own guide now, and listing all six turned a short page of
	// things you carry into a catalogue of books for places the caretaker may not
	// have walked into yet. Only the one for the ground under their feet belongs
	// on the bench — and because it's an ordinary three-rung tool, it offers one
	// upgrade at a time: write up the field guide and the expanded edition is what
	// it offers next. Walk somewhere else and the guide changes with you.
	const here = guideBiomeFor(player.area);
	const shown = data.tools.filter((tool) => !tool.journalBiome || tool.journalBiome === here);

	const toolRow = (tool: (typeof data.tools)[number]) => {
		const tier = player.tools?.[tool.id] || 1;
		const current = tool.tiers.find((tt) => tt.tier === tier);
		const next = tool.tiers.find((tt) => tt.tier === tier + 1);
		let blocked: string | null = null;
		if (next?.requires?.minHealth) {
			const bs = state.biomeStates.find((b) => b.biomeId === next.requires!.biome);
			if ((bs?.health || 0) < next.requires.minHealth) {
				const biome = data.biomes.find((b) => b.id === next.requires!.biome);
				blocked = t('panels.tools.restoreFirst', {
					biome: biome ? content('biome', biome.id, 'name', biome.name) : next.requires.biome,
					health: next.requires.minHealth,
					current: bs?.health || 0,
				});
			}
		}
		const haveMats = next ? Object.entries(next.materials || {}).every(([id, q]) => availability(id) >= q) : false;
		return (
			<div className="recipe" key={tool.id}>
				{/* the sprite for the tool's CURRENT tier — it upgrades as you do */}
				<ObjectIcon shape={current?.shape || tool.shape} color="#9a8156" size={34} />
				<div className="grow">
					<b>
						{current
							? content('tool', tool.id, `tiers.${current.tier}.name`, current.name)
							: content('tool', tool.id, 'name', tool.name)}
					</b>{' '}
					<span className="muted small">{t('panels.tools.tier', { tier })}</span>
					<div className="muted small">
						{current ? content('tool', tool.id, `tiers.${current.tier}.effect`, current.effect) : ''}
					</div>
					{next ? (
						<>
							<div className="small upgrade-next">
								{next.shape && <ObjectIcon shape={next.shape} color="#9a8156" size={20} />}{' '}
								{t('panels.tools.upgradeNext')} <b>{content('tool', tool.id, `tiers.${next.tier}.name`, next.name)}</b>:{' '}
								{content('tool', tool.id, `tiers.${next.tier}.effect`, next.effect)}
							</div>
							<div className="mats">
								{Object.entries(next.materials || {}).map(([id, q]) => (
									<span key={id} className={`mat ${availability(id) >= q ? 'mat-ok' : 'mat-no'}`}>
										<ResourceIcon id={id} color={resColor(data, id)} />
										{resName(data, id)} {Math.min(availability(id), q)}/{q}
									</span>
								))}
							</div>
							{blocked && <div className="muted small">{blocked}</div>}
						</>
					) : (
						<div className="muted small">{t('panels.tools.fullyUpgraded')}</div>
					)}
				</div>
				{next && (
					<button disabled={!haveMats || !!blocked} onClick={() => upgradeTool(tool.id)}>
						{t('panels.tools.upgrade')}
					</button>
				)}
			</div>
		);
	};

	return (
		<Panel title={t('panels.tools.title')} icon="tools" onClose={() => setPanel(null)} wide>
			{shown.map(toolRow)}
			{ownedGear.length > 0 && (
				<div className="gear-section">
					<h3>
						<Icon name="tools" size={14} /> {t('panels.tools.gearTitle')}
					</h3>
					{ownedGear.map((id) => {
						const def = data.habitatObjects.find((o) => o.id === GEAR_ITEM[id]);
						const name = def ? content('habitatObject', def.id, 'name', def.name) : GEAR_ITEM[id];
						const on = gear[id] !== false;
						return (
							<div className="recipe" key={id}>
								<ObjectIcon shape={def?.shape} color={def?.color} size={34} />
								<div className="grow">
									<b>{name}</b>
									<div className="muted small">{t(`panels.tools.gearEffect.${id}`)}</div>
								</div>
								<button
									className={`gear-toggle ${on ? 'gear-on' : 'gear-off'}`}
									role="switch"
									aria-checked={on}
									aria-label={t('panels.tools.gearToggleAria', { name })}
									onClick={() => setGear(id, !on)}
								>
									{on ? t('panels.tools.gearOn') : t('panels.tools.gearOff')}
								</button>
							</div>
						);
					})}
					<p className="muted small">{t('panels.tools.gearNote')}</p>
				</div>
			)}
		</Panel>
	);
}

export function BiomesPanel() {
	const { data, state, setPanel, changeArea, addGoal } = useGame();
	// The target buttons only exist once the player can actually set goals.
	const canSetGoals = customGoalsUnlocked(state);
	const { t, content } = useI18n();
	// Which biome's detail is shown below the map. `null` means "use the default"
	// (the biome you're standing in, else the first open one, else the first).
	const [sel, setSel] = useState<string | null>(null);
	if (!data || !state) return null;
	const here = state.player.area;
	const ordered = [...data.biomes].sort((a, b) => a.order - b.order);
	const openCount = ordered.filter((b) => state.player.unlockedBiomes.includes(b.id)).length;
	const defaultSel =
		ordered.find((b) => b.id === here)?.id ||
		ordered.find((b) => state.player.unlockedBiomes.includes(b.id))?.id ||
		ordered[0]?.id ||
		null;
	const activeSel = sel && ordered.some((b) => b.id === sel) ? sel : defaultSel;
	const selected = ordered.find((b) => b.id === activeSel) || ordered[0];

	// --- detail for the one selected biome (master–detail: the map is the picker,
	//     this card is the only prose on screen at a time) ---
	const renderDetail = () => {
		if (!selected) return null;
		const biome = selected;
		const bs = state.biomeStates.find((x) => x.biomeId === biome.id);
		const unlocked = state.player.unlockedBiomes.includes(biome.id);
		const isHere = biome.id === here;
		const total = data.animals.filter((a) => a.biome === biome.id).length;
		const canTravel = unlocked && biome.explorable && !isHere;
		const biomeName = content('biome', biome.id, 'name', biome.name);
		const travelTitle = isHere
			? t('panels.biomes.youAreHere')
			: !unlocked
				? t('panels.biomes.lockedTitle', { biome: biomeName })
				: t('panels.biomes.travelTo', { biome: biomeName });
		const tag = isHere ? (
			<span className="bd-tag bd-tag-here">
				<Icon name="pin" size={12} /> {t('panels.biomes.hereTag')}
			</span>
		) : !biome.explorable ? (
			<span className="bd-tag bd-tag-soon">
				<Icon name="sparkle" size={12} /> {t('panels.biomes.comingSoon')}
			</span>
		) : !unlocked ? (
			<span className="bd-tag bd-tag-locked">
				<Icon name="lock" size={12} /> {t('panels.biomes.locked')}
			</span>
		) : (
			<span className="bd-tag bd-tag-open">
				<Icon name="leaf" size={12} /> {t('panels.biomes.openTag')}
			</span>
		);
		return (
			<div className="biome-detail" key={biome.id}>
				<div className="bd-head">
					<div className="grow">
						<h3 className="bd-title">
							<span className="bd-badge" style={{ background: biome.palette?.healthy || '#8fbf6f' }}>
								<Icon name={`biome-${biome.id}`} size={17} />
							</span>
							{biomeName} {tag}
						</h3>
						<p className="muted small bd-desc">{content('biome', biome.id, 'description', biome.description)}</p>
					</div>
					<button
						className="bd-travel"
						disabled={!canTravel}
						title={travelTitle}
						aria-label={travelTitle}
						onClick={async () => {
							setPanel(null);
							await changeArea(biome.id);
						}}
					>
						<Icon name={isHere ? 'pin' : unlocked ? 'walk' : 'lock'} size={16} />
						<span>
							{isHere
								? t('panels.biomes.hereBtn')
								: canTravel
									? t('panels.biomes.travelBtn')
									: t('panels.biomes.lockedBtn')}
						</span>
					</button>
				</div>

				{unlocked && bs ? (
					<>
						<div className="bd-animals">
							<Icon name="paw" size={13} /> {t('panels.biomes.animalsReturned', { returned: bs.returnedCount, total })}
						</div>
						<Meter label={t('panels.biomes.health')} icon="leaf" value={bs.health} color="#6aa253" />
						<Meter label={t('panels.biomes.balance')} icon="drop" value={bs.balance} color="#5b9cab" />
						{/* health has hit its animal-return cap: explain the plateau
						    instead of leaving the bar mysteriously stuck */}
						{(() => {
							const m = nextHealthMilestone(bs.returnedCount);
							return m && Math.round(bs.health) >= m.cap ? (
								<div className="muted small health-gate-note">
									<Icon name="paw" size={11} />{' '}
									{t('panels.biomes.healthGated', { cap: m.cap, animals: m.animals - bs.returnedCount })}
								</div>
							) : null;
						})()}
						<div className="bd-goal">
							<div className="bd-goal-label">
								<Icon name="target" size={12} /> {t('panels.biomes.goal')}
							</div>
							<p>{content('biome', biome.id, 'restorationGoal', biome.restorationGoal)}</p>
						</div>
						{BIOME_LORE[biome.id] && (
							<div className="biome-lore small">
								<div className="bd-stage">{t(`panels.biomes.stage.${loreStage(bs.health)}`)}</div>
								<p>{BIOME_LORE[biome.id][loreStage(bs.health)]}</p>
								<p className="biome-coexist">
									<Icon name="paw" size={12} /> {BIOME_LORE[biome.id].coexistence}
								</p>
							</div>
						)}
					</>
				) : (
					<>
						{biome.explorable && !unlocked && biome.unlock && (
							<div className="bd-goal bd-unlock">
								<div className="bd-goal-label">
									<Icon name="lock" size={12} /> {t('panels.biomes.toUnlock')}
								</div>
								<p>{content('biome', biome.id, 'unlock.label', biome.unlock.label)}</p>
								{canSetGoals && (
									<button
										className="bd-addgoal"
										disabled={(state.customGoals || []).some((g) => g.kind === 'unlock' && g.biomeId === biome.id)}
										onClick={() => addGoal({ kind: 'unlock', target: 1, biomeId: biome.id })}
									>
										<Icon name="plus" size={12} /> {t('panels.biomes.addGoal', { biome: biomeName })}
									</button>
								)}
							</div>
						)}
						<div className="bd-goal">
							<div className="bd-goal-label">
								<Icon name="target" size={12} /> {t('panels.biomes.goal')}
							</div>
							<p>{content('biome', biome.id, 'restorationGoal', biome.restorationGoal)}</p>
						</div>
					</>
				)}
			</div>
		);
	};

	return (
		<Panel title={t('panels.biomes.title')} icon="map" onClose={() => setPanel(null)} wide>
			{/* Illustrated trail map: the six biomes as waypoints along a path, each a
			    health-ring badge (filled by restoration), linked by trail segments that
			    light up as you open the next area. Tap any stop to read its detail below. */}
			<div
				className="preserve-map"
				role="tablist"
				aria-label={t('panels.biomes.mapAria', { open: openCount, total: ordered.length })}
			>
				{ordered.map((biome, i) => {
					const bs = state.biomeStates.find((x) => x.biomeId === biome.id);
					const unlocked = state.player.unlockedBiomes.includes(biome.id);
					const isHere = biome.id === here;
					const total = data.animals.filter((a) => a.biome === biome.id).length;
					const color = biome.palette?.healthy || '#8fbf6f';
					const health = unlocked && bs ? Math.round(bs.health) : 0;
					const isSel = biome.id === activeSel;
					const biomeName = content('biome', biome.id, 'name', biome.name);
					const glyph = unlocked ? `biome-${biome.id}` : 'lock';
					const sub = unlocked
						? t('panels.biomes.animalsShort', { returned: bs?.returnedCount || 0, total })
						: biome.explorable
							? t('panels.biomes.locked')
							: t('panels.biomes.comingSoon');
					// The tooltip can say just "You are here" — the pin is right there next to
					// the name. The accessible NAME can't: aria-label replaces the button's
					// text, so in a row of six biome tabs the one you're standing in
					// announced "You are here" and nothing else, with no way to tell which.
					const title = isHere ? t('panels.biomes.youAreHere') : t('panels.biomes.viewDetail', { biome: biomeName });
					const ariaTitle = isHere
						? t('panels.biomes.youAreHereNamed', { biome: biomeName })
						: t('panels.biomes.viewDetail', { biome: biomeName });
					return (
						<React.Fragment key={biome.id}>
							{i > 0 && <span className={`pm-link ${unlocked ? 'pm-link-open' : ''}`} />}
							<button
								className={`pm-stop ${unlocked ? '' : 'pm-locked'} ${isHere ? 'pm-here' : ''} ${isSel ? 'pm-selected' : ''}`}
								role="tab"
								aria-selected={isSel}
								title={title}
								aria-label={ariaTitle}
								onClick={() => setSel(biome.id)}
								style={{ ['--c' as any]: color, ['--h' as any]: health }}
							>
								<span className="pm-ring">
									<span className="pm-disc">
										<Icon name={glyph} size={22} />
										{isHere && (
											<span className="pm-here-badge">
												<Icon name="pin" size={11} />
											</span>
										)}
									</span>
								</span>
								<span className="pm-name">{biomeName}</span>
								<span className="pm-sub">{sub}</span>
							</button>
						</React.Fragment>
					);
				})}
			</div>
			<p className="muted small preserve-map-cap">
				{t('panels.biomes.mapSummary', { open: openCount, total: ordered.length })}
			</p>

			{renderDetail()}
		</Panel>
	);
}

export function HomePanel() {
	const { data, state, setPanel, upgradeHome, setHomeStyle, addGoal } = useGame();
	// The target buttons only exist once the player can actually set goals.
	const canSetGoals = customGoalsUnlocked(state);
	const { t, content } = useI18n();
	const linked = useLinkedChests();
	if (!data || !state) return null;
	const home = state.player.home || { style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };
	const styleLocked = !!home.styleLocked;
	// Only one home goal at a time (matching the goals builder + server rule), so
	// the "add as goal" buttons hide once a home goal is already on the board.
	const hasHomeGoal = (state.customGoals || []).some((g) => g.kind === 'home');
	const styles = data.homeStyles || {};
	const tracks = data.homeTracks || {};
	const avail = (id: string) =>
		(state.player.inventory?.[id] || 0) + linked.reduce((s, c) => s + (c.contents?.[id] || 0), 0);
	const biomeName = (id: string) => {
		const b = data.biomes.find((bb) => bb.id === id);
		return b ? content('biome', b.id, 'name', b.name) : id;
	};
	const biomeHealth = (id: string) => state.biomeStates.find((b) => b.biomeId === id)?.health || 0;

	const TRACK_ORDER = ['space', 'comfort', 'decor', 'light'];
	// A representative object sprite for each upgrade track, so the house menu
	// shows pictures like the crafting and materials menus do.
	const TRACK_SHAPE: Record<string, string> = {
		space: 'trailtent',
		comfort: 'armchair',
		decor: 'painting',
		light: 'lamp',
	};

	// Stage 1 — still a tent: choose a style to build your house (the first upgrade).
	// Each style costs its own materials (wood for the cabin, stone for the hearth…).
	if (!styleLocked) {
		return (
			<Panel title={t('panels.home.buildTitle')} icon="home" onClose={() => setPanel(null)} wide>
				<p className="muted">{t('panels.home.buildIntro')}</p>
				<div className="home-styles">
					{Object.entries(styles).map(([id, s]) => {
						const mats = s.materials || {};
						const gateMet = !s.requires || biomeHealth(s.requires.biome) >= s.requires.minHealth;
						const afford = Object.entries(mats).every(([rid, q]) => avail(rid) >= (q as number));
						return (
							<div className={`recipe ${gateMet && afford ? '' : 'recipe-off'}`} key={id}>
								<ObjectIcon shape={`house-${id}`} color={s.accent || s.floor} size={44} />
								<div className="grow">
									<b>{s.name}</b>
									{s.perk && (
										<div className="small home-perk">
											<Icon name="sparkle" size={12} /> <b>{t(`panels.home.perkName.${s.perk.id}`)}</b> —{' '}
											{t(`panels.home.perkBlurb.${s.perk.id}`, { pct: Math.round(s.perk.base * 100) })}{' '}
											{t('panels.home.perkGrows')}
										</div>
									)}
									<div className="mats">
										{Object.entries(mats).map(([rid, q]) => (
											<span key={rid} className={`mat ${avail(rid) >= (q as number) ? 'mat-ok' : 'mat-no'}`}>
												<ResourceIcon id={rid} color={resColor(data, rid)} />
												{resName(data, rid)} {Math.min(avail(rid), q as number)}/{q as number}
											</span>
										))}
									</div>
									{s.requires && !gateMet && (
										<div className="small unlock-req">
											<b>{t('panels.home.needs')}</b>{' '}
											{t('panels.home.needsGate', {
												biome: biomeName(s.requires.biome),
												health: s.requires.minHealth,
												current: biomeHealth(s.requires.biome),
											})}
										</div>
									)}
								</div>
								<div className="recipe-actions">
									{canSetGoals && !hasHomeGoal && (
										<button
											className="icon-btn subtle add-goal-btn"
											title={t('panels.home.addGoal')}
											aria-label={t('panels.home.addGoal')}
											onClick={() => addGoal({ kind: 'home', track: 'build', styleId: id, target: 1 })}
										>
											<Icon name="target" size={13} />
										</button>
									)}
									<button
										disabled={!gateMet || !afford}
										onClick={async () => {
											await setHomeStyle(id);
											setPanel(null); // building your house closes the upgrade menu
										}}
									>
										{t('panels.home.build')}
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</Panel>
		);
	}

	// Stage 2 — built: show the chosen style, its live perk, and the four upgrade tracks.
	const perk = styles[home.style]?.perk;
	const perkStrength = perk ? homePerkStrength(perk, home) : 0;
	return (
		<Panel title={t('panels.home.title')} icon="home" onClose={() => setPanel(null)} wide>
			<p className="muted">
				{t('panels.home.builtIntro', { style: styles[home.style]?.name || t('panels.home.fallbackName') })}
			</p>
			{perk && (
				<div className="recipe home-perk-card">
					<ObjectIcon shape={`house-${home.style}`} color={styles[home.style]?.accent} size={40} />
					<div className="grow">
						<Icon name="sparkle" size={14} /> <b>{t(`panels.home.perkName.${perk.id}`)}</b>{' '}
						<span className="muted small">{t('panels.home.perkActive')}</span>
						<div className="muted small">
							{t(`panels.home.perkBlurb.${perk.id}`, { pct: Math.round(perkStrength * 100) })}{' '}
							{perkStrength < perk.cap ? t('panels.home.perkGrows') : t('panels.home.perkMax')}
						</div>
					</div>
				</div>
			)}
			<h3>{t('panels.home.upgrades')}</h3>
			{TRACK_ORDER.filter((k) => tracks[k]).map((key) => {
				const def = tracks[key];
				const level = (home as any)[key] || 1;
				const maxLevel = def.levels.length;
				const next = def.levels[level]; // the (level+1)th entry
				const gateMet = !next?.requires || biomeHealth(next.requires.biome) >= next.requires.minHealth;
				const canAfford = !next || Object.entries(next.materials || {}).every(([id, q]) => avail(id) >= q);
				return (
					<div className={`recipe ${!next || (gateMet && canAfford) ? '' : 'recipe-off'}`} key={key}>
						<ObjectIcon shape={TRACK_SHAPE[key]} size={34} />
						<div className="grow">
							<b>{def.name}</b> <span className="muted small">{t('panels.home.level', { level, max: maxLevel })}</span>
							<div className="muted small">{def.blurb}</div>
							{next ? (
								<>
									<div className="mats">
										{Object.entries(next.materials || {}).map(([id, q]) => (
											<span key={id} className={`mat ${avail(id) >= q ? 'mat-ok' : 'mat-no'}`}>
												<ResourceIcon id={id} color={resColor(data, id)} />
												{resName(data, id)} {Math.min(avail(id), q)}/{q}
											</span>
										))}
									</div>
									{next.requires && !gateMet && (
										<div className="small unlock-req">
											<b>{t('panels.home.needs')}</b>{' '}
											{t('panels.home.needsGate', {
												biome: biomeName(next.requires.biome),
												health: next.requires.minHealth,
												current: biomeHealth(next.requires.biome),
											})}
										</div>
									)}
								</>
							) : (
								<div className="muted small">{t('panels.home.maxedOut')}</div>
							)}
						</div>
						{next && (
							<div className="recipe-actions">
								{canSetGoals && !hasHomeGoal && (
									<button
										className="icon-btn subtle add-goal-btn"
										title={t('panels.home.addGoal')}
										aria-label={t('panels.home.addGoal')}
										onClick={() => addGoal({ kind: 'home', track: key, target: level + 1 })}
									>
										<Icon name="target" size={13} />
									</button>
								)}
								<button
									disabled={!gateMet || !canAfford}
									onClick={async () => {
										setPanel(null);
										await upgradeHome(key);
									}}
								>
									{t('panels.home.upgrade')}
								</button>
							</div>
						)}
					</div>
				);
			})}
		</Panel>
	);
}

export function WeatherPanel() {
	const { data, state, setPanel } = useGame();
	const { t, content } = useI18n();
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
	// Season/day-phase overlay keys nest under weather.season.* / weather.dayPhase.*
	// (matching scripts/i18n-extract.mjs's template shape).
	const seasonLabel = content('weather', `season.${season}`, 'label', ss.label);
	const hereType = liveWeatherType(worldId, here, snap);
	const hereWt = weatherType(hereType);
	const hereWtName = content('weather', hereType, 'name', hereWt.name);
	const hereBiome = data.biomes.find((b) => b.id === here);
	const hereName = hereBiome ? content('biome', hereBiome.id, 'name', hereBiome.name) : t('panels.weather.thisBiome');
	const wxTextRaw = weatherEffect(here, hereType);
	// Effects fall back per-biome → _default → English data text, mirroring weatherEffect/seasonEffect.
	const wxText = wxTextRaw
		? content('weather', hereType, `effect.${here}`, content('weather', hereType, 'effect._default', wxTextRaw))
		: '';
	const seasonTextRaw = seasonEffect(here, season);
	const seasonText = seasonTextRaw
		? content(
				'weather',
				`season.${season}`,
				`effect.${here}`,
				content('weather', `season.${season}`, 'effect._default', seasonTextRaw),
			)
		: '';
	// Whether something is gatherable right now — used only as a vague teaser; the
	// resource itself stays a surprise you discover out in the world.
	const teaseGather = !!gatherResourceFor(data.resources, here, hereType);

	const cell = (typeId: string) => {
		const wt = weatherType(typeId);
		const name = content('weather', typeId, 'name', wt.name);
		return (
			<span className="wx-cell" title={name}>
				<Icon name={wt.icon} size={14} /> {name}
			</span>
		);
	};

	return (
		<Panel title={t('panels.weather.title')} icon="cloud" onClose={() => setPanel(null)} wide>
			<div className="wx-now">
				<span className="hud-season" style={{ color: ss.accent, borderColor: ss.accent }}>
					{seasonLabel}
				</span>
				{here !== 'home' && <span className="muted small">{hereName}</span>}
			</div>

			{here !== 'home' && (
				<>
					<div className="wx-effect">
						<div className="wx-effect-head">
							<Icon name={hereWt.icon} size={16} /> <b>{hereWtName}</b> {t('panels.weather.over', { biome: hereName })}
						</div>
						{wxText && <p>{wxText}</p>}
						{teaseGather && <p className="muted small">{t('panels.weather.tease', { biome: hereName })}</p>}
					</div>
					<div className="wx-effect">
						<div className="wx-effect-head">
							<Icon name="sparkle" size={16} /> <b>{seasonLabel}</b> {t('panels.weather.inBiome', { biome: hereName })}
						</div>
						{seasonText && <p>{seasonText}</p>}
					</div>
				</>
			)}

			<h3>{t('panels.weather.acrossPreserve')}</h3>
			<table className="wx-table">
				<thead>
					<tr>
						<th>{t('panels.weather.colBiome')}</th>
						<th>{t('panels.weather.colNow')}</th>
						<th>{t('panels.weather.colNext')}</th>
						<th>{t('panels.weather.colLater')}</th>
					</tr>
				</thead>
				<tbody>
					{unlockedBiomes.map((b) => (
						<tr key={b.id} className={b.id === here ? 'wx-here' : ''}>
							<td>
								{content('biome', b.id, 'name', b.name)}
								{b.id === here && <span className="muted small"> {t('panels.weather.here')}</span>}
							</td>
							<td>{cell(liveWeatherType(worldId, b.id, snap))}</td>
							<td>{cell(forecastType(worldId, b.id, snap, 1))}</td>
							<td>{cell(forecastType(worldId, b.id, snap, 2))}</td>
						</tr>
					))}
				</tbody>
			</table>

			<p className="muted small">{t('panels.weather.seasonsNote')}</p>
		</Panel>
	);
}

/**
 * Materials guide — a picture book of everything you can gather where you're
 * standing: the sprite you'll spot in the world, its name, and how to collect
 * it (which tool, and whether it only shows up in certain weather). Kills the
 * "blindly pressing E hoping it's plant fiber" problem the playtest surfaced.
 */
export function MaterialsPanel() {
	const { data, state, setPanel } = useGame();
	const { t, content } = useI18n();
	if (!data || !state) return null;
	const area = state.player.area;
	const biome = data.biomes.find((b) => b.id === area);
	const resById = (id: string) => data.resources.find((r) => r.id === id);

	// Always-gatherable materials for this biome, then the weather-gated extras
	// that only appear while a particular weather is active.
	const baseIds = biome?.resources || [];
	// Diggable materials (shovel). Some, like stones, are BOTH surface-gatherable and
	// diggable — those get a combined note rather than a duplicate row.
	const surfaceSet = new Set(baseIds);
	const digSet = new Set(biome?.digResources || []);
	// One row per material: surface ones first (data order), then dig-only ones.
	const allIds = [...baseIds, ...[...digSet].filter((id) => !surfaceSet.has(id))];
	const gatherNote = (id: string) => {
		const r = resById(id);
		const canDig = digSet.has(id),
			canSurface = surfaceSet.has(id);
		if (canSurface && canDig) return t('panels.materials.findOrDig');
		if (canDig) return t('panels.materials.gatherWith.shovel');
		return t(`panels.materials.gatherWith.${r?.tool}`);
	};
	const weatherGated: { id: string; weatherId: string }[] = [];
	for (const wx of WEATHER_TYPES) {
		const rid = gatherResourceIdFor(area, wx);
		if (rid && !baseIds.includes(rid) && !weatherGated.some((w) => w.id === rid)) {
			weatherGated.push({ id: rid, weatherId: wx });
		}
	}

	const row = (id: string, note?: string) => {
		const r = resById(id);
		if (!r) return null;
		return (
			<div className="recipe material-row" key={id + (note || '')}>
				<ResourceIcon id={id} size={30} color={r.color} />
				<div className="grow">
					<b>{content('resource', id, 'name', r.name)}</b>
					<div className="muted small">{note || t(`panels.materials.gatherWith.${r.tool}`)}</div>
				</div>
			</div>
		);
	};

	return (
		<Panel title={t('panels.materials.title')} icon="basket" onClose={() => setPanel(null)} wide>
			{area === 'home' ? (
				<p className="muted">{t('panels.materials.homeNote')}</p>
			) : (
				<>
					<p className="muted">
						{t('panels.materials.intro', {
							biome: biome ? content('biome', biome.id, 'name', biome.name) : t('panels.crafting.thisArea'),
						})}
					</p>
					{allIds.length === 0 && weatherGated.length === 0 && (
						<p className="muted small">{t('panels.materials.empty')}</p>
					)}
					{allIds.map((id) => row(id, gatherNote(id)))}
					{weatherGated.length > 0 && (
						<>
							<h3>{t('panels.materials.weatherTitle')}</h3>
							{weatherGated.map(({ id, weatherId }) => {
								const wt = weatherType(weatherId);
								const wname = content('weather', weatherId, 'name', wt.name);
								return row(id, t('panels.materials.weatherNote', { weather: wname }));
							})}
						</>
					)}
					<p className="muted small">{t('panels.materials.note')}</p>
				</>
			)}
		</Panel>
	);
}

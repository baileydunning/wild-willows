import { useMemo, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import type { CustomGoal, CustomGoalKind } from '../types';
import { customGoalsUnlocked } from '../types';
import { recipeUnlocked } from '../recipes';
import { Icon } from './icons';

// Buildable-from-scratch goal kinds. "Bring back an animal" (welcome) is
// intentionally NOT here — those are added from the field journal's unknown
// entries, so the picker never lists animals you've already welcomed home.
// "Unlock a biome" isn't here — the board already shows an always-on next-biome
// goal, so it'd be redundant. Bring-back-animal comes from the field journal.
const KINDS: CustomGoalKind[] = ['craft', 'plant', 'collect', 'observe', 'welcomeTotal', 'health', 'home', 'tool'];
const KIND_ICON: Record<CustomGoalKind, string> = {
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
const HEALTH_TARGETS = [50, 60, 70, 80, 90, 100];
const HOME_TRACKS = ['space', 'comfort', 'decor', 'light'];

/**
 * The goals builder — where the player designs their own task list. The three
 * fixed starters always lead the board; everything the player adds here follows.
 * Edits (add / remove / reorder) rewrite the whole list server-side via setGoals.
 */
export function GoalsPanel() {
	const { data, state, setPanel, setGoals } = useGame();
	const { t, content } = useI18n();

	// Draft for the "add a goal" form.
	const [kind, setKind] = useState<CustomGoalKind>('craft');
	const [itemId, setItemId] = useState('');
	const [resourceId, setResourceId] = useState('');
	const [track, setTrack] = useState('space');
	const [styleId, setStyleId] = useState(''); // which house to build (home 'build' goal)
	const [toolId, setToolId] = useState(''); // which tool to upgrade (tool goal)
	const [biomeId, setBiomeId] = useState('');
	const [count, setCount] = useState(3);
	const [level, setLevel] = useState(2); // target level for a home-upgrade goal
	const [healthPct, setHealthPct] = useState(90); // target % for a restore-health goal

	// Craftable outputs (from recipes), gatherable resources, and animals to bring
	// back — the pools the player picks targets from.
	// Biome-unlock kits (forest-restoration-kit, …) are already tracked by the
	// pinned "unlock the next biome" goal, so they never appear as their own craft goal.
	const unlockKitIds = useMemo(
		() => new Set((data?.biomes || []).map((b) => b.unlock?.requiresItem).filter(Boolean) as string[]),
		[data],
	);
	const craftables = useMemo(() => {
		if (!data || !state) return [] as { id: string; name: string }[];
		// Held amount = basket + every linked chest (matches the server's tally).
		const heldOf = (id: string) =>
			(state.player.inventory?.[id] || 0) + (state.chests || []).reduce((s, c) => s + (c.contents?.[id] || 0), 0);
		const seen = new Set<string>();
		const out: { id: string; name: string }[] = [];
		for (const r of data.recipes) {
			const id = r.output.itemId;
			if (seen.has(id) || unlockKitIds.has(id)) continue;
			// Only recipes you can ACTUALLY craft right now — unlocked for your
			// progress (open biome, health/animal gates met), never locked recipes
			// from biomes you haven't reached or plantables.
			if (!recipeUnlocked(r, data, state)) continue;
			// …and only ones you DON'T already have the materials for. A craft goal
			// you could fulfil this instant is busywork, so leave it off the picker
			// (matches the add-button's affordable guard). Not-affordable-for-one
			// implies not-affordable-for-any-count, so every listed item is a valid
			// goal at whatever count you pick.
			const affordable = Object.entries(r.materials || {}).every(([mid, need]) => heldOf(mid) >= (need as number));
			if (affordable) continue;
			seen.add(id);
			const o = data.habitatObjects.find((h) => h.id === id);
			out.push({ id, name: o ? content('habitatObject', o.id, 'name', o.name) : id });
		}
		return out.sort((a, b) => a.name.localeCompare(b.name));
	}, [data, state, content, unlockKitIds]);
	const animals = useMemo(
		() =>
			(data?.animals || [])
				.map((a) => ({ id: a.id, name: content('animal', a.id, 'name', a.name) }))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[data, content],
	);
	const homeMax = (tk: string) => data?.homeTracks?.[tk]?.levels?.length || 5;
	// The three buildable house styles, with their material costs.
	const styles = useMemo(
		() => Object.entries(data?.homeStyles || {}).map(([id, s]) => ({ id, name: s.name, materials: s.materials || {} })),
		[data],
	);
	// Tools with a next tier you can work toward NOW: the required biome is open and
	// healthy enough, but you don't already have the materials (that'd be busywork,
	// matching the craft picker). Each entry carries the tier to reach.
	const upgradableTools = useMemo(() => {
		if (!data || !state) return [] as { id: string; name: string; tier: number }[];
		const heldOf = (id: string) =>
			(state.player.inventory?.[id] || 0) + (state.chests || []).reduce((s, c) => s + (c.contents?.[id] || 0), 0);
		const unlocked = new Set(state.player.unlockedBiomes || ['meadow']);
		const healthOf = (bid: string) => state.biomeStates.find((b) => b.biomeId === bid)?.health || 0;
		const out: { id: string; name: string; tier: number }[] = [];
		for (const td of data.tools || []) {
			const cur = state.player.tools?.[td.id] || 1;
			const next = (td.tiers || []).find((tt: any) => tt.tier === cur + 1);
			if (!next) continue; // already at the top tier
			const req = (next as any).requires;
			if (req?.biome) {
				if (!unlocked.has(req.biome)) continue; // biome not open yet
				if (typeof req.minHealth === 'number' && healthOf(req.biome) < req.minHealth) continue; // not healthy enough yet
			}
			const affordable = Object.entries((next as any).materials || {}).every(
				([mid, need]) => heldOf(mid) >= (need as number),
			);
			if (affordable) continue; // you could do it right now — not a goal
			out.push({
				id: td.id,
				name: content('tool', td.id, `tiers.${next.tier}.name`, (next as any).name),
				tier: next.tier,
			});
		}
		return out.sort((a, b) => a.name.localeCompare(b.name));
	}, [data, state, content]);

	if (!data || !state) return null;
	const limit = state.goalLimit ?? 3; // 3 until all biomes are open, then 6
	const homeCur = (tk: string) => ((state.player?.home as any)?.[tk] as number) || 1; // current track level
	const homeBuilt = !!state.player?.home?.styleLocked; // still a tent until a house style is built
	const goals = state.customGoals || [];
	const boardTask = (id: string) => state.dailyTasks?.tasks.find((tt) => tt.id === id);
	// Only the goals still in play — claimed/finished ones drop off the list (and
	// get pruned from the stored list on the next edit).
	const active = goals.filter((g) => boardTask(g.id));
	// Which targets are already active goals — flag them as "added" in the picker
	// instead of letting you queue an exact duplicate.
	const pickedItems = new Set(active.filter((g) => g.kind === 'craft').map((g) => g.itemId));
	const pickedResources = new Set(active.filter((g) => g.kind === 'collect').map((g) => g.resourceId));
	const pickedTools = new Set(active.filter((g) => g.kind === 'tool').map((g) => g.toolId));
	const pickedKinds = new Set(active.map((g) => g.kind));
	// You design your own goals only after finishing the three starters, and can
	// hold just one home goal (build or upgrade) at a time.
	const startersDone = customGoalsUnlocked(state);
	// System goals to surface read-only at the top of the menu: the pinned
	// next-biome guidance, and the three starters until they're claimed.
	const fixedTasks = (state.dailyTasks?.tasks || []).filter(
		(tk: any) => tk.pinned || (typeof tk.id === 'string' && tk.id.startsWith('start-')),
	);
	const hasHomeGoal = active.some((g) => g.kind === 'home');
	// A built house with every track at its top level has nothing left to aim for,
	// so "Upgrade your home" drops out of the picker entirely.
	const homeFullyUpgraded = homeBuilt && HOME_TRACKS.every((tk) => homeCur(tk) >= homeMax(tk));
	// How many animals could still be welcomed in the biomes you can currently reach.
	// If none, "Welcome animals" would be impossible right now, so it drops out too.
	const discoveredIds = new Set(state.discoveries.map((d) => d.animalId));
	const unlockedSet = new Set(state.player.unlockedBiomes || ['meadow']);
	const welcomeLeft = data.animals.filter((a) => unlockedSet.has(a.biome) && !discoveredIds.has(a.id)).length;
	// Late-game, biome-scoped goals: only the unlocked biomes that still have room
	// to progress. Restore-health → any open biome under 100%; welcome-all → any
	// open biome missing an animal.
	const bHealth = (id: string) => Math.round(state.biomeStates.find((s) => s.biomeId === id)?.health || 0);
	const openBiomes = data.biomes.filter((b) => b.explorable && unlockedSet.has(b.id));
	const healthBiomes = openBiomes.filter((b) => bHealth(b.id) < 100);
	const animalTotal = (id: string) => data.animals.filter((a) => a.biome === id).length;
	const returnedIn = (id: string) => state.discoveries.filter((d) => d.biomeId === id).length;
	const animalBiomes = openBiomes.filter((b) => animalTotal(b.id) > 0 && returnedIn(b.id) < animalTotal(b.id));
	// Resources you can ACTUALLY gather right now — only those found in biomes
	// you've unlocked. A collect goal for a locked biome's material is impossible,
	// and the server scopes rewards/targets to your personal biomes anyway.
	const gatherableResIds = new Set(data.biomes.filter((b) => unlockedSet.has(b.id)).flatMap((b) => b.resources || []));
	const collectables = data.resources.filter((r) => gatherableResIds.has(r.id));
	// The picker only offers goals you can actually make progress on right now.
	const kindOptions = KINDS.filter((k) => {
		if (k === 'home') return !hasHomeGoal && !homeFullyUpgraded;
		if (k === 'welcomeTotal') return welcomeLeft > 0;
		if (k === 'health') return healthBiomes.length > 0;
		if (k === 'biomeAnimals') return animalBiomes.length > 0;
		if (k === 'tool') return upgradableTools.length > 0;
		return true;
	});
	const resName = (id: string) => {
		const r = data.resources.find((rr) => rr.id === id);
		return r ? content('resource', r.id, 'name', r.name) : id;
	};
	// Held amount = basket + every linked chest (matches the server's tally).
	const held = (id: string) =>
		(state.player.inventory?.[id] || 0) + (state.chests || []).reduce((s, c) => s + (c.contents?.[id] || 0), 0);

	// A readable label for a goal, matching the board wording.
	const label = (g: CustomGoal): string => {
		switch (g.kind) {
			case 'craft':
				return t('panels.goals.label.craft', {
					count: g.target,
					item: craftables.find((c) => c.id === g.itemId)?.name || g.itemId || '',
				});
			case 'build':
				return t('panels.goals.label.build', {
					count: g.target,
					item: craftables.find((c) => c.id === g.itemId)?.name || g.itemId || '',
				});
			case 'grow': {
				const o = data.habitatObjects.find((h) => h.id === g.itemId);
				return t('panels.goals.label.grow', {
					count: g.target,
					item: o ? content('habitatObject', o.id, 'name', o.name) : g.itemId || '',
				});
			}
			case 'plant':
				return t('panels.goals.label.plant', { count: g.target });
			case 'collect':
				return t('panels.goals.label.collect', { count: g.target, resource: resName(g.resourceId || '') });
			case 'observe':
				return t('panels.goals.label.observe', { count: g.target });
			case 'welcomeTotal':
				return t('panels.goals.label.welcomeTotal', { count: g.target });
			case 'welcome':
				return t('panels.goals.label.welcome', {
					animal: animals.find((a) => a.id === g.animalId)?.name || g.animalId || '',
				});
			case 'attract': {
				const a = data.animals.find((x) => x.id === g.animalId);
				return t('panels.goals.label.attract', {
					kind: a ? content('animal', a.id, 'kind', a.kind) : t('panels.goals.creature'),
				});
			}
			case 'home':
				return g.track === 'build'
					? t('panels.goals.label.homeBuild', {
							style: styles.find((s) => s.id === g.styleId)?.name || t('panels.goals.styleLabel'),
						})
					: t('panels.goals.label.home', { track: t(`panels.goals.track.${g.track}`), level: g.target });
			case 'tool': {
				const td = data.tools?.find((x) => x.id === g.toolId);
				const tier = td?.tiers?.find((tt) => tt.tier === g.target);
				return t('panels.goals.label.tool', {
					tool: td && tier ? content('tool', td.id, `tiers.${g.target}.name`, tier.name) : g.toolId || '',
				});
			}
			case 'unlock': {
				const b = data.biomes.find((bb) => bb.id === g.biomeId);
				return t('panels.goals.label.unlock', { biome: b ? content('biome', b.id, 'name', b.name) : g.biomeId || '' });
			}
			case 'health': {
				const b = data.biomes.find((bb) => bb.id === g.biomeId);
				return t('panels.goals.label.health', {
					biome: b ? content('biome', b.id, 'name', b.name) : g.biomeId || '',
					pct: g.target,
				});
			}
			case 'biomeAnimals': {
				const b = data.biomes.find((bb) => bb.id === g.biomeId);
				return t('panels.goals.label.biomeAnimals', {
					biome: b ? content('biome', b.id, 'name', b.name) : g.biomeId || '',
				});
			}
			default:
				return '';
		}
	};

	const save = (next: CustomGoal[]) => void setGoals(next as any[]);

	const addGoal = () => {
		if (!startersDone) return; // finish the three starters first
		if (active.length >= limit) return;
		const g: CustomGoal = { id: '', kind, target: Math.max(1, Math.min(99, Math.floor(count) || 1)) };
		if (kind === 'craft') {
			if (!itemId || craftAffordable) return;
			g.itemId = itemId;
		} else if (kind === 'collect') {
			if (!resourceId) return;
			g.resourceId = resourceId;
		} else if (kind === 'welcomeTotal') {
			if (welcomeLeft <= 0) return;
			g.target = Math.min(g.target, welcomeLeft);
		} // can't aim past what's reachable
		else if (kind === 'unlock') {
			if (!biomeId) return;
			g.biomeId = biomeId;
			g.target = 1;
		} else if (kind === 'health') {
			const b = biomeId || healthBiomes[0]?.id;
			if (!b) return;
			g.biomeId = b;
			g.target = Math.max(bHealth(b) + 1, Math.min(100, healthPct)); // must beat the biome's current health
		} else if (kind === 'biomeAnimals') {
			const b = biomeId || animalBiomes[0]?.id;
			if (!b) return;
			g.biomeId = b;
			g.target = animalTotal(b); // server confirms the authoritative count
		} else if (kind === 'tool') {
			const sel = upgradableTools.find((x) => x.id === toolId);
			if (!sel) return;
			g.toolId = toolId;
			g.target = sel.tier; // aim for the next tier
		} else if (kind === 'home') {
			if (hasHomeGoal) return; // only one home goal at a time
			if (homeGoalAffordable) return; // already have the materials — busywork, not a goal
			if (!homeBuilt) {
				if (!styleId) return;
				g.track = 'build';
				g.styleId = styleId;
				g.target = 1;
			} // build the tent into a chosen house
			else {
				const cur = homeCur(track),
					max = homeMax(track);
				if (cur >= max) return; // already at the top of this track — nothing to aim for
				g.track = track;
				g.target = Math.min(max, Math.max(cur + 1, Math.floor(level) || cur + 1)); // must be above current
			}
		}
		save([...active, g]);
		if (kind === 'home') setKind('craft'); // that's the last home goal — leave it selected on a still-addable type
	};
	const remove = (i: number) => save(active.filter((_, idx) => idx !== i));
	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir;
		if (j < 0 || j >= active.length) return;
		const next = [...active];
		[next[i], next[j]] = [next[j], next[i]];
		save(next);
	};

	// A craft goal you can already fully afford (for the chosen count) is busywork,
	// so it's blocked with a note. Uses basket + linked chests, like the server.
	const chosenRecipe = kind === 'craft' && itemId ? data.recipes.find((r) => r.output.itemId === itemId) : null;
	const craftAffordable =
		!!chosenRecipe &&
		Object.entries(chosenRecipe.materials || {}).every(
			([mid, need]) => held(mid) >= (need as number) * Math.max(1, Math.floor(count) || 1),
		);

	// A home goal (build a house, or level one track by one step) you can already
	// afford right now is busywork — block it like the craft picker does. Multi-step
	// upgrades (target above the next level) are never "instantly doable".
	const homeGoalAffordable = (() => {
		if (kind !== 'home') return false;
		if (!homeBuilt) {
			const mats = styles.find((s) => s.id === styleId)?.materials;
			return (
				!!mats &&
				Object.keys(mats).length > 0 &&
				Object.entries(mats).every(([mid, need]) => held(mid) >= (need as number))
			);
		}
		const cur = homeCur(track);
		const chosenLevel = Math.min(homeMax(track), Math.max(cur + 1, Math.floor(level) || cur + 1));
		if (chosenLevel !== cur + 1) return false; // reaching a higher level takes more than one upgrade
		const mats = data.homeTracks?.[track]?.levels?.[cur]?.materials as Record<string, number> | undefined;
		return !!mats && Object.entries(mats).every(([mid, need]) => held(mid) >= (need as number));
	})();

	// Count field is for the tally-style goals; home uses its own level select.
	const showCount = ['craft', 'plant', 'collect', 'observe', 'welcomeTotal'].includes(kind);
	const homeLvlMin = homeCur(track) + 1;
	const homeLvlMax = homeMax(track);
	const homeMaxed = kind === 'home' && homeBuilt && homeCur(track) >= homeMax(track);
	const homeLevels: number[] = [];
	for (let l = homeLvlMin; l <= homeLvlMax; l++) homeLevels.push(l);
	const homeDescKey = kind === 'home' && !homeBuilt ? 'panels.goals.desc.homeBuild' : `panels.goals.desc.${kind}`;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="target" size={20} /> {t('panels.goals.title')}
					</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body">
					<p className="muted">{startersDone ? t('panels.goals.intro') : t('panels.goals.startersIntro')}</p>
					{startersDone && (
						<div className="goals-slots">{t('panels.goals.slots', { used: active.length, max: limit })}</div>
					)}

					{/* System goals shown read-only: the always-on "unlock the next biome"
					    (subtly highlighted) and the three starters until they're claimed. */}
					{fixedTasks.length > 0 && (
						<div className="goals-list goals-fixed">
							{fixedTasks.map((tk) => (
								<div className={`goals-row goals-row-readonly ${tk.pinned ? 'goals-row-pinned' : ''}`} key={tk.id}>
									<span className="goals-row-icon">
										<Icon name={tk.icon} size={15} />
									</span>
									<div className="grow">
										<span className="goals-row-text">{tk.text}</span>
										<div className="goals-row-meta">
											<span className="muted small">
												{tk.progress}/{tk.target}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					)}

					{startersDone && <h3 className="goals-own-head">{t('panels.goals.ownHead')}</h3>}
					{startersDone && active.length === 0 && <p className="muted small">{t('panels.goals.empty')}</p>}
					<div className="goals-list">
						{active.map((g, i) => {
							const bt = boardTask(g.id);
							// use the board task's target (build goals run to 2× the object count)
							const target = bt ? bt.target : g.target;
							const progress = bt ? bt.progress : target;
							return (
								<div className="goals-row" key={g.id || i}>
									<span className="goals-row-icon">
										<Icon name={KIND_ICON[g.kind]} size={15} />
									</span>
									<div className="grow">
										<span className="goals-row-text">{label(g)}</span>
										<div className="goals-row-meta">
											<span className="muted small">
												{progress}/{target}
											</span>
										</div>
									</div>
									<div className="goals-row-actions">
										<button
											className="icon-btn subtle"
											disabled={i === 0}
											onClick={() => move(i, -1)}
											title={t('panels.goals.moveUp')}
											aria-label={t('panels.goals.moveUp')}
										>
											<Icon name="forward" size={13} className="chev-up" />
										</button>
										<button
											className="icon-btn subtle"
											disabled={i === active.length - 1}
											onClick={() => move(i, 1)}
											title={t('panels.goals.moveDown')}
											aria-label={t('panels.goals.moveDown')}
										>
											<Icon name="forward" size={13} className="chev-down" />
										</button>
										<button
											className="icon-btn subtle"
											onClick={() => remove(i)}
											title={t('panels.goals.remove')}
											aria-label={t('panels.goals.remove')}
										>
											<Icon name="trash" size={13} />
										</button>
									</div>
								</div>
							);
						})}
					</div>

					{startersDone && <h3>{t('panels.goals.addTitle')}</h3>}
					{!startersDone ? (
						<p className="muted small goals-unlock-hint">
							<Icon name="lock" size={13} /> {t('panels.goals.unlockHint')}
						</p>
					) : active.length >= limit ? (
						<p className="muted small">{t('panels.goals.limitReached', { max: limit })}</p>
					) : (
						<div className="goals-builder">
							<div className="craft-filter">
								<label htmlFor="goal-kind">{t('panels.goals.typeLabel')}</label>
								<select id="goal-kind" value={kind} onChange={(e) => setKind(e.target.value as CustomGoalKind)}>
									{kindOptions.map((k) => {
										const taken = (k === 'plant' || k === 'observe' || k === 'welcomeTotal') && pickedKinds.has(k);
										return (
											<option key={k} value={k} disabled={taken}>
												{t(`panels.goals.type.${k}`)}
												{taken ? ` · ${t('panels.goals.added')}` : ''}
											</option>
										);
									})}
								</select>

								{kind === 'craft' && (
									<select
										aria-label={t('panels.goals.itemLabel')}
										value={itemId}
										onChange={(e) => setItemId(e.target.value)}
									>
										<option value="">{t('panels.goals.pickItem')}</option>
										{craftables.map((c) => {
											const taken = pickedItems.has(c.id);
											return (
												<option key={c.id} value={c.id} disabled={taken}>
													{c.name}
													{taken ? ` · ${t('panels.goals.added')}` : ''}
												</option>
											);
										})}
									</select>
								)}
								{kind === 'collect' && (
									<select
										aria-label={t('panels.goals.resourceLabel')}
										value={resourceId}
										onChange={(e) => setResourceId(e.target.value)}
									>
										<option value="">{t('panels.goals.pickResource')}</option>
										{collectables.map((r) => {
											const taken = pickedResources.has(r.id);
											return (
												<option key={r.id} value={r.id} disabled={taken}>
													{content('resource', r.id, 'name', r.name)}
													{taken ? ` · ${t('panels.goals.added')}` : ''}
												</option>
											);
										})}
									</select>
								)}
								{kind === 'tool' && (
									<span className="goals-style-pick">
										<select
											aria-label={t('panels.goals.toolLabel')}
											value={toolId}
											onChange={(e) => setToolId(e.target.value)}
										>
											<option value="">{t('panels.goals.pickTool')}</option>
											{upgradableTools.map((tl) => {
												const taken = pickedTools.has(tl.id);
												return (
													<option key={tl.id} value={tl.id} disabled={taken}>
														{tl.name}
														{taken ? ` · ${t('panels.goals.added')}` : ''}
													</option>
												);
											})}
										</select>
										{(() => {
											const sel = upgradableTools.find((x) => x.id === toolId);
											if (!sel) return null;
											const td = data.tools?.find((x) => x.id === sel.id);
											const tier = td?.tiers?.find((tt) => tt.tier === sel.tier);
											const mats = (tier as any)?.materials || {};
											return (
												<span className="tasks-hint" tabIndex={0} role="note" aria-label={t('panels.goals.matsTitle')}>
													<Icon name="help" size={13} />
													<span className="tasks-hint-tip" role="tooltip">
														<span className="tasks-hint-line">{t('panels.goals.matsTitle')}</span>
														{Object.entries(mats).map(([mid, need]) => {
															const have = held(mid);
															return (
																<span key={mid} className={`tasks-step ${have >= (need as number) ? 'done' : ''}`}>
																	<span className="tasks-step-box">
																		{have >= (need as number) && <Icon name="check" size={10} />}
																	</span>{' '}
																	{t('panels.goals.matLine', {
																		have: Math.min(have, need as number),
																		need: need as number,
																		name: resName(mid),
																	})}
																</span>
															);
														})}
													</span>
												</span>
											);
										})()}
									</span>
								)}
								{kind === 'unlock' && (
									<select
										aria-label={t('panels.goals.biomeLabel')}
										value={biomeId}
										onChange={(e) => setBiomeId(e.target.value)}
									>
										<option value="">{t('panels.goals.pickBiome')}</option>
										{data.biomes
											.filter((b) => b.explorable && !state.player.unlockedBiomes.includes(b.id))
											.map((b) => (
												<option key={b.id} value={b.id}>
													{content('biome', b.id, 'name', b.name)}
												</option>
											))}
									</select>
								)}
								{kind === 'health' && (
									<>
										<select
											aria-label={t('panels.goals.biomeLabel')}
											value={biomeId || healthBiomes[0]?.id || ''}
											onChange={(e) => setBiomeId(e.target.value)}
										>
											{healthBiomes.map((b) => (
												<option key={b.id} value={b.id}>
													{content('biome', b.id, 'name', b.name)} ({bHealth(b.id)}%)
												</option>
											))}
										</select>
										<label className="goals-count">
											{t('panels.goals.healthLabel')}
											<select value={healthPct} onChange={(e) => setHealthPct(Number(e.target.value))}>
												{HEALTH_TARGETS.filter((p) => p > bHealth(biomeId || healthBiomes[0]?.id || '')).map((p) => (
													<option key={p} value={p}>
														{p}%
													</option>
												))}
											</select>
										</label>
									</>
								)}
								{kind === 'biomeAnimals' && (
									<select
										aria-label={t('panels.goals.biomeLabel')}
										value={biomeId || animalBiomes[0]?.id || ''}
										onChange={(e) => setBiomeId(e.target.value)}
									>
										{animalBiomes.map((b) => (
											<option key={b.id} value={b.id}>
												{content('biome', b.id, 'name', b.name)} ({returnedIn(b.id)}/{animalTotal(b.id)})
											</option>
										))}
									</select>
								)}
								{kind === 'home' && !homeBuilt && (
									<span className="goals-style-pick">
										<select
											aria-label={t('panels.goals.styleLabel')}
											value={styleId}
											onChange={(e) => setStyleId(e.target.value)}
										>
											<option value="">{t('panels.goals.pickStyle')}</option>
											{styles.map((s) => (
												<option key={s.id} value={s.id}>
													{s.name}
												</option>
											))}
										</select>
										{(() => {
											const chosen = styles.find((s) => s.id === styleId);
											if (!chosen) return null;
											return (
												<span className="tasks-hint" tabIndex={0} role="note" aria-label={t('panels.goals.matsTitle')}>
													<Icon name="help" size={13} />
													<span className="tasks-hint-tip" role="tooltip">
														<span className="tasks-hint-line">{t('panels.goals.matsTitle')}</span>
														{Object.entries(chosen.materials).map(([mid, need]) => {
															const have = held(mid);
															return (
																<span key={mid} className={`tasks-step ${have >= need ? 'done' : ''}`}>
																	<span className="tasks-step-box">
																		{have >= need && <Icon name="check" size={10} />}
																	</span>{' '}
																	{t('panels.goals.matLine', { have: Math.min(have, need), need, name: resName(mid) })}
																</span>
															);
														})}
													</span>
												</span>
											);
										})()}
									</span>
								)}
								{kind === 'home' && homeBuilt && (
									<select
										aria-label={t('panels.goals.trackLabel')}
										value={track}
										onChange={(e) => setTrack(e.target.value)}
									>
										{HOME_TRACKS.map((tk) => (
											<option key={tk} value={tk}>
												{t(`panels.goals.track.${tk}`)}
											</option>
										))}
									</select>
								)}
								{kind === 'home' && homeBuilt && !homeMaxed && (
									<label className="goals-count">
										{t('panels.goals.levelLabel')}
										<select
											value={Math.min(homeLvlMax, Math.max(homeLvlMin, level))}
											onChange={(e) => setLevel(Number(e.target.value))}
										>
											{homeLevels.map((l) => (
												<option key={l} value={l}>
													{l}
												</option>
											))}
										</select>
									</label>
								)}

								{showCount && (
									<label className="goals-count">
										{t('panels.goals.countLabel')}
										<input
											type="number"
											min={1}
											max={99}
											value={count}
											onChange={(e) => setCount(Number(e.target.value))}
										/>
									</label>
								)}
							</div>
							<p className="goals-desc">
								<Icon name={KIND_ICON[kind]} size={13} /> {t(homeDescKey)}
							</p>
							{homeMaxed && (
								<p className="muted small">
									{t('panels.goals.homeMaxed', { track: t(`panels.goals.track.${track}`) })}
								</p>
							)}
							{(craftAffordable || homeGoalAffordable) && (
								<p className="muted small">{t('panels.goals.affordableNote')}</p>
							)}
							<button
								className="big-btn primary"
								style={{ width: 'auto', marginTop: 0 }}
								onClick={addGoal}
								disabled={homeMaxed || craftAffordable || homeGoalAffordable}
							>
								<Icon name="check" size={15} /> <span>{t('panels.goals.add')}</span>
							</button>
						</div>
					)}
					{startersDone && <p className="muted small">{t('panels.goals.rewardNote')}</p>}
					{startersDone && <p className="muted small">{t('panels.goals.moreNote')}</p>}
				</div>
			</div>
		</div>
	);
}

import { useMemo, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import type { CustomGoal, CustomGoalKind } from '../types';
import { Icon } from './icons';

// Buildable-from-scratch goal kinds. "Bring back an animal" (welcome) is
// intentionally NOT here — those are added from the field journal's unknown
// entries, so the picker never lists animals you've already welcomed home.
const KINDS: CustomGoalKind[] = ['craft', 'plant', 'collect', 'observe', 'unlock', 'home'];
const KIND_ICON: Record<CustomGoalKind, string> = {
	craft: 'hammer', build: 'hammer', grow: 'leaf', plant: 'leaf', collect: 'basket', observe: 'journal', welcome: 'paw', home: 'home', unlock: 'map',
};
const HOME_TRACKS = ['space', 'comfort', 'decor', 'light'];
const MAX_GOALS = 6;

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
	const [biomeId, setBiomeId] = useState('');
	const [count, setCount] = useState(3);

	// Craftable outputs (from recipes), gatherable resources, and animals to bring
	// back — the pools the player picks targets from.
	const craftables = useMemo(() => {
		if (!data) return [] as { id: string; name: string }[];
		const seen = new Set<string>();
		const out: { id: string; name: string }[] = [];
		for (const r of data.recipes) {
			const id = r.output.itemId;
			if (seen.has(id)) continue;
			seen.add(id);
			const o = data.habitatObjects.find((h) => h.id === id);
			out.push({ id, name: o ? content('habitatObject', o.id, 'name', o.name) : id });
		}
		return out.sort((a, b) => a.name.localeCompare(b.name));
	}, [data, content]);
	const animals = useMemo(
		() => (data?.animals || []).map((a) => ({ id: a.id, name: content('animal', a.id, 'name', a.name) })).sort((a, b) => a.name.localeCompare(b.name)),
		[data, content]
	);
	const homeMax = (tk: string) => data?.homeTracks?.[tk]?.levels?.length || 5;

	if (!data || !state) return null;
	const goals = state.customGoals || [];
	const boardTask = (id: string) => state.dailyTasks?.tasks.find((tt) => tt.id === id);
	// Only the goals still in play — claimed/finished ones drop off the list (and
	// get pruned from the stored list on the next edit).
	const active = goals.filter((g) => boardTask(g.id));
	const resName = (id: string) => {
		const r = data.resources.find((rr) => rr.id === id);
		return r ? content('resource', r.id, 'name', r.name) : id;
	};

	// A readable label for a goal, matching the board wording.
	const label = (g: CustomGoal): string => {
		switch (g.kind) {
			case 'craft': return t('panels.goals.label.craft', { count: g.target, item: craftables.find((c) => c.id === g.itemId)?.name || g.itemId || '' });
			case 'build': return t('panels.goals.label.build', { count: g.target, item: craftables.find((c) => c.id === g.itemId)?.name || g.itemId || '' });
			case 'grow': {
				const o = data.habitatObjects.find((h) => h.id === g.itemId);
				return t('panels.goals.label.grow', { count: g.target, item: o ? content('habitatObject', o.id, 'name', o.name) : g.itemId || '' });
			}
			case 'plant': return t('panels.goals.label.plant', { count: g.target });
			case 'collect': return t('panels.goals.label.collect', { count: g.target, resource: resName(g.resourceId || '') });
			case 'observe': return t('panels.goals.label.observe', { count: g.target });
			case 'welcome': return t('panels.goals.label.welcome', { animal: animals.find((a) => a.id === g.animalId)?.name || g.animalId || '' });
			case 'home': return t('panels.goals.label.home', { track: t(`panels.goals.track.${g.track}`), level: g.target });
			case 'unlock': {
				const b = data.biomes.find((bb) => bb.id === g.biomeId);
				return t('panels.goals.label.unlock', { biome: b ? content('biome', b.id, 'name', b.name) : g.biomeId || '' });
			}
			default: return '';
		}
	};

	const save = (next: CustomGoal[]) => void setGoals(next as any[]);

	const addGoal = () => {
		if (active.length >= MAX_GOALS) return;
		const g: CustomGoal = { id: '', kind, target: Math.max(1, Math.min(99, Math.floor(count) || 1)) };
		if (kind === 'craft') { if (!itemId) return; g.itemId = itemId; }
		else if (kind === 'collect') { if (!resourceId) return; g.resourceId = resourceId; }
		else if (kind === 'unlock') { if (!biomeId) return; g.biomeId = biomeId; g.target = 1; }
		else if (kind === 'home') { g.track = track; g.target = Math.max(1, Math.min(homeMax(track), Math.floor(count) || 1)); }
		save([...active, g]);
	};
	const remove = (i: number) => save(active.filter((_, idx) => idx !== i));
	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir;
		if (j < 0 || j >= active.length) return;
		const next = [...active];
		[next[i], next[j]] = [next[j], next[i]];
		save(next);
	};

	// Unlock goals have a single target (the biome), so no count field.
	const showCount = kind !== 'unlock';
	const countMax = kind === 'home' ? homeMax(track) : 99;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="check" size={20} /> {t('panels.goals.title')}</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					<p className="muted">{t('panels.goals.intro')}</p>

					{active.length === 0 && <p className="muted small">{t('panels.goals.empty')}</p>}
					<div className="goals-list">
						{active.map((g, i) => {
							const bt = boardTask(g.id);
							// use the board task's target (build goals run to 2× the object count)
							const target = bt ? bt.target : g.target;
							const progress = bt ? bt.progress : target;
							return (
								<div className="goals-row" key={g.id || i}>
									<span className="goals-row-icon"><Icon name={KIND_ICON[g.kind]} size={15} /></span>
									<div className="grow">
										<span className="goals-row-text">{label(g)}</span>
										<div className="goals-row-meta">
											<span className="muted small">{progress}/{target}</span>
										</div>
									</div>
									<div className="goals-row-actions">
										<button className="icon-btn subtle" disabled={i === 0} onClick={() => move(i, -1)} title={t('panels.goals.moveUp')} aria-label={t('panels.goals.moveUp')}><Icon name="back" size={13} className="chev-up" /></button>
										<button className="icon-btn subtle" disabled={i === active.length - 1} onClick={() => move(i, 1)} title={t('panels.goals.moveDown')} aria-label={t('panels.goals.moveDown')}><Icon name="forward" size={13} className="chev-down" /></button>
										<button className="icon-btn subtle" onClick={() => remove(i)} title={t('panels.goals.remove')} aria-label={t('panels.goals.remove')}><Icon name="trash" size={13} /></button>
									</div>
								</div>
							);
						})}
					</div>

					<h3>{t('panels.goals.addTitle')}</h3>
					{active.length >= MAX_GOALS ? (
						<p className="muted small">{t('panels.goals.limitReached', { max: MAX_GOALS })}</p>
					) : (
						<div className="goals-builder">
							<div className="craft-filter">
								<label htmlFor="goal-kind">{t('panels.goals.typeLabel')}</label>
								<select id="goal-kind" value={kind} onChange={(e) => setKind(e.target.value as CustomGoalKind)}>
									{KINDS.map((k) => <option key={k} value={k}>{t(`panels.goals.type.${k}`)}</option>)}
								</select>

								{kind === 'craft' && (
									<select aria-label={t('panels.goals.itemLabel')} value={itemId} onChange={(e) => setItemId(e.target.value)}>
										<option value="">{t('panels.goals.pickItem')}</option>
										{craftables.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
									</select>
								)}
								{kind === 'collect' && (
									<select aria-label={t('panels.goals.resourceLabel')} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
										<option value="">{t('panels.goals.pickResource')}</option>
										{data.resources.map((r) => <option key={r.id} value={r.id}>{content('resource', r.id, 'name', r.name)}</option>)}
									</select>
								)}
								{kind === 'unlock' && (
									<select aria-label={t('panels.goals.biomeLabel')} value={biomeId} onChange={(e) => setBiomeId(e.target.value)}>
										<option value="">{t('panels.goals.pickBiome')}</option>
										{data.biomes.filter((b) => b.explorable && !state.player.unlockedBiomes.includes(b.id)).map((b) => (
											<option key={b.id} value={b.id}>{content('biome', b.id, 'name', b.name)}</option>
										))}
									</select>
								)}
								{kind === 'home' && (
									<select aria-label={t('panels.goals.trackLabel')} value={track} onChange={(e) => setTrack(e.target.value)}>
										{HOME_TRACKS.map((tk) => <option key={tk} value={tk}>{t(`panels.goals.track.${tk}`)}</option>)}
									</select>
								)}

								{showCount && (
									<label className="goals-count">
										{kind === 'home' ? t('panels.goals.levelLabel') : t('panels.goals.countLabel')}
										<input type="number" min={1} max={countMax} value={count} onChange={(e) => setCount(Number(e.target.value))} />
									</label>
								)}
							</div>
							<button className="big-btn primary" style={{ width: 'auto', marginTop: 0 }} onClick={addGoal}>
								<Icon name="check" size={15} /> <span>{t('panels.goals.add')}</span>
							</button>
						</div>
					)}
					<p className="muted small">{t('panels.goals.rewardNote')}</p>
				</div>
			</div>
		</div>
	);
}

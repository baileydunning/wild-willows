import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '../state';
import { guideToolId, type GameData, type GameState } from '../types';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * The completion rail down the side of the Achievements menu — the "have I seen
 * all of it?" view.
 *
 * Achievements answer "what did I do?"; this answers "what is left?". Every
 * line is a fraction of a countable whole (recipes, species, areas, guides), so
 * a player can open one menu and see the shape of what the preserve still holds
 * without hunting through six other panels.
 *
 * It gets the whole panel rather than a column beside the achievement grid: two
 * dense lists side by side read as clutter, and this one is worth reading on its
 * own. The switch that reaches it carries the percentage (see .ach-views), so it
 * is advertised from the other view without having to be on screen with it.
 *
 * Everything here is derived from the snapshot the client already has — no new
 * endpoint, no new stored counter. The one thing that would need a server tally
 * is "habitat types ever placed", so the habitat line deliberately counts what
 * is STANDING right now and says so in its label, rather than quietly reporting
 * a number that can go down when the player picks something back up.
 */

/** One measurable track: `cur` of `target`, drawn as a labelled bar. */
interface CompletionRow {
	id: string;
	icon: string;
	label: string;
	cur: number;
	target: number;
	/** Appended to both numbers (health is the only one: "68% / 100%"). */
	unit?: string;
	/** Extra note shown after the fraction (e.g. the achievement point total). */
	note?: string;
}

interface CompletionGroup {
	id: string;
	label: string;
	rows: CompletionRow[];
}

const ratio = (r: CompletionRow) => (r.target > 0 ? Math.min(1, Math.max(0, r.cur / r.target)) : 0);
const pct = (n: number) => Math.round(n * 100);

/** The three hand tools; the six field guides are tools too, counted separately. */
const HAND_TOOLS = ['basket', 'shovel', 'watering-can'];
const HOME_TRACKS = ['space', 'comfort', 'decor', 'light'] as const;

/**
 * Every completion track, built from one snapshot.
 *
 * Exported (and pure) so a test can assert the arithmetic against a fixture
 * without mounting React.
 */
export function completionGroups(
	data: GameData,
	state: GameState,
	tr: (key: string, params?: Record<string, string | number>) => string,
): CompletionGroup[] {
	const player = state.player;
	const tools = player.tools || {};
	const craftedEver = player.craftedEver || {};
	const unlocked = new Set(player.unlockedBiomes || ['meadow']);
	const areas = [...data.biomes].filter((b) => b.explorable).sort((a, b) => a.order - b.order);
	const bs = state.biomeStates || [];
	const healthOf = (id: string) => Math.round(bs.find((s) => s.biomeId === id)?.health || 0);

	// Recipes are 1:1 with the thing they make, and `craftedEver` is keyed by that
	// output id — so a recipe counts once the player has made it even if they have
	// since spent, placed or dropped every copy.
	const recipesCrafted = data.recipes.filter((r) => (craftedEver[r.output.itemId] || 0) > 0).length;

	// Habitat STANDING, not ever-placed: the snapshot carries placements, not a
	// lifetime tally, so this is honest about being a current count. Seeded
	// scenery the world placed itself counts too — it is habitat, and it is there.
	const placeable = data.habitatObjects.filter((o) => o.placement !== 'none');
	const placeableIds = new Set(placeable.map((o) => o.id));
	const standing = new Set((state.placements || []).map((p) => p.objectId).filter((id) => placeableIds.has(id)));

	// Living habitat gets its own line — planting a species is a different act
	// from crafting a bench, and it is the half of the preserve that grows.
	const plantable = placeable.filter((o) => o.plantable);
	const plantableIds = new Set(plantable.map((o) => o.id));
	const grown = new Set((state.placements || []).map((p) => p.objectId).filter((id) => plantableIds.has(id)));

	const guideDone = areas.filter((b) => (tools[guideToolId(b.id)] || 1) >= 3).length;
	const handToolsMaxed = HAND_TOOLS.filter((id) => {
		const def = data.tools.find((x) => x.id === id);
		return def ? (tools[id] || 1) >= def.tiers.length : false;
	}).length;

	// Home: a canvas tent counts as nothing, because the house has not been
	// started. Once a style is built the four tracks each climb to their own top
	// level (a fresh house is already 5 of them), so the whole house is the sum.
	const homeBuilt = !!player.home?.styleLocked;
	const homeMax = (tk: string) => data.homeTracks?.[tk]?.levels?.length || 5;
	const homeCur = (tk: string) => ((player.home as unknown as Record<string, number> | undefined)?.[tk] as number) || 1;
	const homeLevels = homeBuilt ? HOME_TRACKS.reduce((n, tk) => n + homeCur(tk), 0) : 0;
	const homeTarget = HOME_TRACKS.reduce((n, tk) => n + homeMax(tk), 0);

	const achievements = data.achievements || [];
	const earned = new Set(state.achievements || []);
	const points = achievements.reduce((sum, a) => sum + (earned.has(a.id) ? a.points : 0), 0);

	return [
		{
			id: 'preserve',
			label: tr('panels.completion.group.preserve'),
			rows: [
				{
					id: 'animals',
					icon: 'paw',
					label: tr('panels.completion.row.animals'),
					cur: state.discoveries.length,
					target: data.animals.length,
				},
				{
					id: 'areas',
					icon: 'map',
					label: tr('panels.completion.row.areas'),
					cur: areas.filter((b) => unlocked.has(b.id)).length,
					target: areas.length,
				},
				{
					id: 'restored',
					icon: 'leaf',
					label: tr('panels.completion.row.restored'),
					cur: areas.filter((b) => healthOf(b.id) >= 100).length,
					target: areas.length,
				},
			],
		},
		{
			id: 'making',
			label: tr('panels.completion.group.making'),
			rows: [
				{
					id: 'recipes',
					icon: 'hammer',
					label: tr('panels.completion.row.recipes'),
					cur: recipesCrafted,
					target: data.recipes.length,
				},
				{
					id: 'habitat',
					icon: 'target',
					label: tr('panels.completion.row.habitat'),
					cur: standing.size,
					target: placeable.length,
				},
				{
					id: 'plants',
					icon: 'sparkle',
					label: tr('panels.completion.row.plants'),
					cur: grown.size,
					target: plantable.length,
				},
			],
		},
		{
			id: 'kit',
			label: tr('panels.completion.group.kit'),
			rows: [
				{
					id: 'tools',
					icon: 'tools',
					label: tr('panels.completion.row.tools'),
					cur: handToolsMaxed,
					target: HAND_TOOLS.length,
				},
				{
					id: 'guides',
					icon: 'journal',
					label: tr('panels.completion.row.guides'),
					cur: guideDone,
					target: areas.length,
				},
			],
		},
		{
			id: 'honors',
			label: tr('panels.completion.group.honors'),
			rows: [
				{
					id: 'home',
					icon: 'home',
					label: tr('panels.completion.row.home'),
					cur: homeLevels,
					target: homeTarget,
				},
				{
					id: 'achievements',
					icon: 'star',
					label: tr('panels.completion.row.achievements'),
					cur: earned.size,
					target: achievements.length,
					note: tr('panels.completion.points', { points }),
				},
			],
		},
	];
}

/**
 * The headline figure: the mean of every track's own fraction.
 *
 * Deliberately NOT sum(cur)/sum(target) — that would make the preserve 90%
 * "recipes and species" by weight, and welcoming the last three animals would
 * move the number less than crafting a single bench. Every track counts once,
 * so finishing the field guides is worth as much as finishing the cookbook.
 */
export function overallCompletion(groups: CompletionGroup[]): number {
	const rows = groups.flatMap((g) => g.rows);
	if (!rows.length) return 0;
	return rows.reduce((sum, r) => sum + ratio(r), 0) / rows.length;
}

export function CompletionView() {
	const { data, state } = useGame();
	const { t, content } = useI18n();

	const groups = useMemo(() => (data && state ? completionGroups(data, state, t) : []), [data, state, t]);
	if (!data || !state) return null;

	const overall = overallCompletion(groups);
	// How many tracks are actually finished — a plainer companion to the ring,
	// and the number a player chasing the last few things is really counting.
	const tracks = groups.flatMap((g) => g.rows);
	const tracksDone = tracks.filter((r) => r.target > 0 && r.cur >= r.target).length;
	const unlocked = new Set(state.player.unlockedBiomes || ['meadow']);
	const areas = [...data.biomes].filter((b) => b.explorable).sort((a, b) => a.order - b.order);
	const healthOf = (id: string) => Math.round(state.biomeStates.find((s) => s.biomeId === id)?.health || 0);
	const animalsIn = (id: string) => data.animals.filter((a) => a.biome === id).length;
	const returnedIn = (id: string) => state.discoveries.filter((d) => d.biomeId === id).length;

	return (
		<div className="comp">
			<div className="comp-headline">
				<div className="comp-dial" style={{ '--comp-pct': `${pct(overall)}%` } as CSSProperties}>
					<span className="comp-dial-num">{pct(overall)}%</span>
				</div>
				<div className="grow">
					<div className="comp-headline-title">{t('panels.completion.headline')}</div>
					<div className="muted small">
						{t('panels.completion.headlineTracks', { done: tracksDone, total: tracks.length })}
					</div>
				</div>
			</div>

			{groups.map((g) => (
				<div key={g.id} className="comp-group">
					<h3 className="comp-group-title">{g.label}</h3>
					{g.rows.map((r) => {
						const done = r.target > 0 && r.cur >= r.target;
						return (
							<div key={r.id} className={`comp-row ${done ? 'done' : ''}`}>
								<span className="comp-row-icon">
									<Icon name={done ? 'check' : r.icon} size={18} />
								</span>
								<div className="grow">
									<div className="comp-row-head">
										<span className="comp-row-label">{r.label}</span>
										<span className="comp-row-count">
											{Math.min(r.cur, r.target)}
											{r.unit || ''} / {r.target}
											{r.unit || ''}
										</span>
									</div>
									<div className="comp-bar">
										<div className="comp-bar-fill" style={{ width: `${pct(ratio(r))}%` }} />
									</div>
									{r.note && <div className="muted small">{r.note}</div>}
								</div>
							</div>
						);
					})}
				</div>
			))}

			<div className="comp-group">
				<h3 className="comp-group-title">{t('panels.completion.group.byArea')}</h3>
				{areas.map((b) => {
					const open = unlocked.has(b.id);
					const total = animalsIn(b.id);
					const back = open ? returnedIn(b.id) : 0;
					const health = open ? healthOf(b.id) : 0;
					return (
						<div key={b.id} className={`comp-area ${open ? '' : 'locked'}`}>
							<span className="comp-row-icon">
								<Icon name={open ? `biome-${b.id}` : 'lock'} size={18} />
							</span>
							<span className="comp-area-name">{content('biome', b.id, 'name', b.name)}</span>
							{open ? (
								<span className="comp-area-stats small">
									{t('panels.completion.areaStats', { back, total, health })}
								</span>
							) : (
								<span className="comp-area-stats small muted">{t('panels.completion.areaLocked')}</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

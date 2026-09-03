import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '../state';
import type { GameData, GameState } from '../types';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import {
	achievementPoints,
	completionTracks,
	explorableBiomes,
	meanCompletion,
	trackRatio,
	tracksFinished,
	type CompletionState,
	type CompletionTrack,
} from '../completion';

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
 *
 * THE ARITHMETIC IS NOT HERE. It lives in src/completion.ts, which the server's
 * metrics tally imports too — so the percentage on this screen and the
 * percentage on the dashboard are the same function, not two readings of the
 * same idea. This file is the labels, the icons and the drawing.
 */

/** One measurable track: `cur` of `target`, drawn as a labelled bar. */
interface CompletionRow extends CompletionTrack {
	icon: string;
	label: string;
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

const pct = (n: number) => Math.round(n * 100);

/** The icon each track wears in the list, keyed by the shared track id. */
const TRACK_ICONS: Record<string, string> = {
	animals: 'paw',
	areas: 'map',
	restored: 'leaf',
	recipes: 'hammer',
	habitat: 'target',
	plants: 'sparkle',
	tools: 'tools',
	guides: 'journal',
	home: 'home',
	achievements: 'star',
};

/** The order the groups are drawn in — the order the game teaches them. */
const GROUP_ORDER: CompletionTrack['group'][] = ['preserve', 'making', 'kit', 'honors'];

/**
 * The shared tracks, dressed for the panel: grouped, labelled and iconed.
 *
 * Exported (and pure) so a test can assert the arithmetic against a fixture
 * without mounting React.
 */
export function completionGroups(
	data: GameData,
	state: GameState,
	tr: (key: string, params?: Record<string, string | number>) => string,
): CompletionGroup[] {
	const tracks = completionTracks(data, state as unknown as CompletionState);
	const points = achievementPoints(data, state.achievements);
	const rows: CompletionRow[] = tracks.map((t) => ({
		id: t.id,
		group: t.group,
		cur: t.cur,
		target: t.target,
		icon: TRACK_ICONS[t.id] || 'star',
		label: tr(`panels.completion.row.${t.id}`),
		note: t.id === 'achievements' ? tr('panels.completion.points', { points }) : undefined,
	}));
	return GROUP_ORDER.map((g) => ({
		id: g,
		label: tr(`panels.completion.group.${g}`),
		rows: rows.filter((r) => r.group === g),
	})).filter((g) => g.rows.length);
}

/**
 * The headline figure: the mean of every track's own fraction.
 *
 * A thin wrapper over meanCompletion so callers holding groups (this panel, the
 * percentage on the view switch, the test) don't each have to flatten them.
 */
export function overallCompletion(groups: CompletionGroup[]): number {
	return meanCompletion(groups.flatMap((g) => g.rows));
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
	const tracksDone = tracksFinished(tracks);
	const unlocked = new Set(state.player.unlockedBiomes || ['meadow']);
	const areas = explorableBiomes(data);
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
										<div className="comp-bar-fill" style={{ width: `${pct(trackRatio(r))}%` }} />
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

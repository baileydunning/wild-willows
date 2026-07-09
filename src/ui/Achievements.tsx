import { useState } from 'react';
import { useGame } from '../state';
import type { AchievementDef } from '../types';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * The Achievements menu (K). Its own panel — a running scoreboard for the whole
 * preserve. A shared star badge frames each achievement's own unique glyph:
 * gold when earned, hollow when still locked. Earned ones float to the top of
 * the list (most-recently unlocked first, since the snapshot is earned-ordered).
 */
export function AchievementsPanel() {
	const { data, state, setPanel } = useGame();
	const { t, content } = useI18n();
	const [tab, setTab] = useState<string>('all');
	if (!data || !state) return null;

	// Turn an achievement's structured criteria into an exact, plain-language
	// requirement line — biome/animal/tool names come from the live translations,
	// the numbers from the data (which mirrors the server's award triggers).
	const bn = (id: string) => content('biome', id, 'name', data.biomes.find((b) => b.id === id)?.name || id);
	const an = (id: string) => content('animal', id, 'name', data.animals.find((a) => a.id === id)?.name || id);
	const toolName = (id: string) => {
		const tl = data.tools.find((x) => x.id === id);
		return tl ? content('tool', id, 'name', tl.name) : id;
	};
	const joinList = (names: string[], word: string) =>
		names.length <= 1 ? (names[0] || '') : names.slice(0, -1).join(', ') + ` ${word} ` + names[names.length - 1];
	const reqText = (req: any): string => {
		if (!req) return '';
		switch (req.t) {
			case 'collect': case 'craft': case 'craftDistinct': case 'plant':
			case 'terraform': case 'place': case 'observe': case 'unlocked': case 'total':
				return t(`panels.achievements.req.${req.t}`, { n: req.n });
			case 'returned': case 'health': case 'lake':
				return t(`panels.achievements.req.${req.t}`, { n: req.n, biome: bn(req.biome) });
			case 'kindReturned':
				return t('panels.achievements.req.kindReturned', { n: req.n, biome: bn(req.biome), kind: t(`panels.achievements.kind.${req.kind}`) });
			case 'tools': return t('panels.achievements.req.tools', { n: req.n });
			case 'tool': return t('panels.achievements.req.tool', { n: req.n, tool: toolName(req.id) });
			case 'biomesAtHealth': return t('panels.achievements.req.biomesAtHealth', { n: req.n, h: req.h });
			case 'healthyOpen': return t('panels.achievements.req.healthyOpen', { h: req.h, min: req.min });
			case 'animal': {
				const names = (req.ids || []).map(an);
				if (names.length === 1) return t('panels.achievements.req.animalOne', { animal: names[0] });
				const any = req.mode === 'any';
				return t(any ? 'panels.achievements.req.animalAny' : 'panels.achievements.req.animalAll', {
					animals: joinList(names, t(any ? 'panels.achievements.or' : 'panels.achievements.and')),
				});
			}
			case 'animalChain':
				return t('panels.achievements.req.animalChain', {
					first: joinList((req.all || []).map(an), t('panels.achievements.and')),
					any: joinList((req.any || []).map(an), t('panels.achievements.or')),
				});
			default: return '';
		}
	};

	// Live progress toward a requirement, from the same data the server counts.
	// Cumulative action counts ride along on the player's metrics; the rest we
	// derive from discoveries, biome health, tools, and unlocks. null → not shown.
	const counts: Record<string, number> = (state.player as any).metrics?.counts || {};
	const craftedEver: Record<string, number> = (state.player as any).craftedEver || {};
	const tools: Record<string, number> = state.player.tools || {};
	const bs = state.biomeStates || [];
	const unlocked = state.player.unlockedBiomes || ['meadow'];
	const discovered = (id: string) => state.discoveries.some((d) => d.animalId === id);
	const returnedIn = (b: string) => state.discoveries.filter((d) => d.biomeId === b).length;
	const kindIn = (b: string, kind: string) =>
		state.discoveries.filter((d) => d.biomeId === b && data.animals.find((a) => a.id === d.animalId)?.kind === kind).length;
	const healthOf = (b: string) => Math.round(bs.find((s) => s.biomeId === b)?.health || 0);
	const reqProgress = (req: any): { cur: number; target: number; unit?: string } | null => {
		if (!req) return null;
		switch (req.t) {
			case 'collect': return { cur: counts.resourcesCollected || 0, target: req.n };
			case 'craft': return { cur: counts.itemsCrafted || 0, target: req.n };
			case 'plant': return { cur: counts.plantsPlanted || 0, target: req.n };
			case 'terraform': return { cur: counts.terraformActions || 0, target: req.n };
			case 'place': return { cur: counts.objectsPlaced || 0, target: req.n };
			case 'observe': return { cur: counts.animalsObserved || 0, target: req.n };
			case 'craftDistinct': return { cur: Object.keys(craftedEver).length, target: req.n };
			case 'unlocked': return { cur: unlocked.length, target: req.n };
			case 'total': return { cur: state.discoveries.length, target: req.n };
			case 'returned': return { cur: returnedIn(req.biome), target: req.n };
			case 'kindReturned': return { cur: kindIn(req.biome, req.kind), target: req.n };
			case 'health': return { cur: healthOf(req.biome), target: req.n, unit: '%' };
			case 'tool': return { cur: tools[req.id] || 1, target: req.n };
			case 'tools': { const ids = ['basket', 'shovel', 'watering-can']; return { cur: ids.filter((i) => (tools[i] || 1) >= req.n).length, target: ids.length }; }
			case 'biomesAtHealth': return { cur: bs.filter((s) => Math.round(s.health) >= req.h).length, target: req.n };
			case 'healthyOpen': { const open = bs.filter((s) => unlocked.includes(s.biomeId)); return { cur: open.filter((s) => Math.round(s.health) >= req.h).length, target: Math.max(open.length, req.min) }; }
			case 'animal': { const ids = req.ids || []; return req.mode === 'any' ? { cur: ids.some(discovered) ? 1 : 0, target: 1 } : { cur: ids.filter(discovered).length, target: ids.length }; }
			case 'animalChain': return { cur: ((req.all || []).every(discovered) ? 1 : 0) + ((req.any || []).some(discovered) ? 1 : 0), target: 2 };
			default: return null; // e.g. 'lake' — not measurable client-side
		}
	};
	const progressText = (req: any): string | null => {
		const p = reqProgress(req);
		if (!p) return null;
		const u = p.unit || '';
		return t('panels.achievements.progress', { value: `${Math.min(p.cur, p.target)}${u} / ${p.target}${u}` });
	};

	const all = [...(data.achievements || [])].sort((a, b) => a.order - b.order);
	const earnedIds = state.achievements || [];
	const earnedSet = new Set(earnedIds);
	const earnedRank = new Map(earnedIds.map((id, i) => [id, i])); // 0 = most recent

	const totalEarned = earnedSet.size;
	const total = all.length;
	const points = all.reduce((sum, a) => sum + (earnedSet.has(a.id) ? a.points : 0), 0);

	// Tabs: All, Preserve (getting-started + cross-biome), then each biome in order.
	const biomes = [...data.biomes].sort((a, b) => a.order - b.order);
	const tabs: { id: string; label: string }[] = [
		{ id: 'all', label: t('panels.achievements.tabAll') },
		{ id: 'preserve', label: t('panels.achievements.tabPreserve') },
		...biomes.map((b) => ({ id: b.id, label: content('biome', b.id, 'name', b.name) })),
	];

	const inTab = (a: AchievementDef) =>
		tab === 'all' ? true : tab === 'preserve' ? a.biome === 'preserve' : a.biome === tab;

	const shown = all.filter(inTab).sort((a, b) => {
		const ea = earnedSet.has(a.id), eb = earnedSet.has(b.id);
		if (ea !== eb) return ea ? -1 : 1; // earned first
		if (ea && eb) return (earnedRank.get(a.id)! - earnedRank.get(b.id)!); // newest first
		return a.order - b.order; // locked: stable by order
	});

	const tabCount = (id: string) => {
		const list = all.filter((a) => (id === 'all' ? true : id === 'preserve' ? a.biome === 'preserve' : a.biome === id));
		return `${list.filter((a) => earnedSet.has(a.id)).length}/${list.length}`;
	};

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="star" size={20} /> {t('panels.achievements.title')} <span className="muted small">{t('panels.achievements.summary', { earned: totalEarned, total, points })}</span></h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
				</div>
				<div className="ach-progress">
					<div className="ach-progress-fill" style={{ width: `${Math.round((totalEarned / (total || 1)) * 100)}%` }} />
				</div>
				<div className="tabs">
					{tabs.map((tt) => (
						<button key={tt.id} className={tab === tt.id ? 'on' : ''} onClick={() => setTab(tt.id)}>
							{tt.label} <span className="muted small">{tabCount(tt.id)}</span>
						</button>
					))}
				</div>
				<div className="panel-body">
					<div className="ach-grid">
						{shown.map((a) => {
							const earned = earnedSet.has(a.id);
							return (
								<div key={a.id} className={`ach-card ${earned ? 'earned' : 'locked'}`}>
									<div className="ach-badge">
										<Icon name="star" size={44} className="ach-star" />
										<span className="ach-glyph"><Icon name={a.icon} size={20} /></span>
									</div>
									<div className="grow">
										<div className="ach-name">
											{content('achievement', a.id, 'name', a.name)}
											{a.req && (
												<span className="tasks-hint ach-req-hint" tabIndex={0} role="note" aria-label={t('panels.achievements.reqTitle') + ': ' + reqText(a.req)}>
													<Icon name="help" size={12} />
													<span className="tasks-hint-tip" role="tooltip">
														<span className="tasks-hint-line">{t('panels.achievements.reqTitle')}</span>
														<span>{reqText(a.req)}</span>
														{!earned && progressText(a.req) && <span className="ach-req-progress">{progressText(a.req)}</span>}
													</span>
												</span>
											)}
											{earned && <span className="ach-pts">+{a.points}</span>}
										</div>
										{earned ? (
											<div className="small ach-flavor">{content('achievement', a.id, 'flavor', a.flavor)}</div>
										) : (
											<div className="muted small">{content('achievement', a.id, 'hint', a.hint)}</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

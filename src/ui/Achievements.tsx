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

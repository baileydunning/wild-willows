import { useState } from 'react';
import { useGame } from '../state';
import type { AnimalDef, Discovery } from '../types';
import { animalSpriteDataUri } from '../game/textures';
import { Icon } from './icons';

function comfortLabel(c: number) {
	if (c >= 75) return 'Thriving';
	if (c >= 50) return 'Settled';
	if (c >= 30) return 'Cautious';
	return 'Rarely seen';
}

function RequirementHints({ animal, full }: { animal: AnimalDef; full: boolean }) {
	const { data } = useGame();
	const req = animal.requirements || {};
	if (!full) {
		return <div className="muted small">Hint: {req.hint || 'Restore more habitat and see who arrives.'} <em>(upgrade your field journal for full details)</em></div>;
	}
	return (
		<div className="small req-details">
			<div className="muted">Hint: {req.hint}</div>
			<ul>
				{req.minHealth ? <li>Biome health ≥ {req.minHealth}%</li> : null}
				{req.minBalance ? <li>Ecological balance ≥ {req.minBalance}%</li> : null}
				{Object.entries(req.objects || {}).map(([id, q]) => (
					<li key={id}>{q}× {data?.habitatObjects.find((o) => o.id === id)?.name || id}</li>
				))}
				{(req.animals || []).map((id) => (
					<li key={id}>{data?.animals.find((a) => a.id === id)?.name || id} already returned</li>
				))}
			</ul>
		</div>
	);
}

function JournalEntry({ animal, disc, full }: { animal: AnimalDef; disc?: Discovery; full: boolean }) {
	const { observe } = useGame();
	if (!disc) {
		return (
			<div className="journal-entry entry-unknown">
				<div className="silhouette">
					<img className="ani-thumb" src={animalSpriteDataUri(animal.id, animal.kind, { silhouette: true })} alt="" />
				</div>
				<div className="grow">
					<b>Unknown {animal.kind}</b> <span className="muted small">({animal.rarity})</span>
					<RequirementHints animal={animal} full={full} />
				</div>
			</div>
		);
	}
	return (
		<div className="journal-entry">
			<div className="silhouette known">
				<img className="ani-thumb" src={animalSpriteDataUri(animal.id, animal.kind)} alt={animal.name} />
			</div>
			<div className="grow">
				<b>{animal.name}</b>{' '}
				<span className={`comfort comfort-${comfortLabel(disc.comfort).toLowerCase().replace(' ', '-')}`}>
					{comfortLabel(disc.comfort)} ({disc.comfort}%)
				</span>
				<div className="muted small">
					Returned to the {disc.biomeId} · first seen {new Date(disc.firstObservedAt).toLocaleDateString()} · observed {disc.timesObserved}×
				</div>
				{full ? (
					<>
						<div className="small">{disc.whyReturned}</div>
						<div className="muted small"><b>Diet:</b> {animal.diet} · <b>Shelter:</b> {animal.shelter}</div>
						<div className="muted small"><b>Prefers:</b> {animal.preferredHabitat}</div>
						<div className="small fact"><Icon name="leaf" size={13} /> {animal.fact}</div>
						<button className="link" onClick={() => observe(animal.id)}>Open info card</button>
					</>
				) : (
					<div className="muted small"><em>Upgrade your field guide for this area to read the full entry.</em></div>
				)}
			</div>
		</div>
	);
}

export function JournalPanel() {
	const { data, state, setPanel } = useGame();
	// default to the biome you're currently standing in
	const [tab, setTab] = useState(state?.player.area || 'meadow');
	if (!data || !state) return null;
	const biomes = [...data.biomes].sort((a, b) => a.order - b.order);
	const discs = new Map(state.discoveries.map((d) => [d.animalId, d]));
	const animals = data.animals
		.filter((a) => a.biome === tab)
		// Returned animals rise to the top (most recent first); the rest follow,
		// easiest-to-attract next so the player can see what to chase.
		.sort((a, b) => {
			const da = discs.get(a.id), db = discs.get(b.id);
			if (!!da !== !!db) return da ? -1 : 1;
			if (da && db) return (db.firstObservedAt || 0) - (da.firstObservedAt || 0);
			return (a.requirements?.minHealth || 0) - (b.requirements?.minHealth || 0);
		});
	const returned = animals.filter((a) => discs.has(a.id)).length;
	// Full entries for an area need the field guide upgraded to that area's tier.
	const tabBiome = biomes.find((b) => b.id === tab);
	const guideTier = state.player.tools?.['field-journal'] || 1;
	// each area's FULL entries need that area's own field-guide upgrade. The baseline
	// journal (tier 1) still shows the generic entry — sprite + comfort — for every
	// area, just with diet/shelter/fact/hints locked behind the upgrade.
	const needTier = (tabBiome?.order || 1) + 1;
	const full = guideTier >= needTier;
	const guideName = data.tools.find((t) => t.id === 'field-journal')?.tiers.find((tt) => tt.tier === guideTier)?.name || 'Field Journal';

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="journal" size={20} /> {guideName} <span className="muted small">· Tier {guideTier}</span></h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="tabs">
					{biomes.map((b) => {
						const locked = !state.player.unlockedBiomes.includes(b.id);
						return (
							<button key={b.id} className={tab === b.id ? 'on' : ''} onClick={() => setTab(b.id)}>
								{b.name}
								{locked && <Icon name="lock" size={11} />}
							</button>
						);
					})}
				</div>
				<div className="panel-body">
					<p className="muted small">{returned}/{animals.length} animals have returned to this biome.</p>
					{!full && (
						<div className="guide-upsell small">
							<Icon name="lock" size={13} /> Upgrade your field guide to <b>Tier {needTier}</b> to read full entries and return hints for {tabBiome?.name}. See the Tools panel.
						</div>
					)}
					{animals.map((a) => (
						<JournalEntry key={a.id} animal={a} disc={discs.get(a.id)} full={full} />
					))}
				</div>
			</div>
		</div>
	);
}

/**
 * Coexistence note: name returned neighbors this animal depends on (its
 * requirement chain) and returned neighbors that depend on it. Only mentions
 * animals actually back, so it reads as a living relationship the player built.
 */
function neighborsNote(animal: AnimalDef, animals: AnimalDef[], returned: Set<string>): string | null {
	const nameOf = (id: string) => animals.find((a) => a.id === id)?.name || id;
	const prereqs = (animal.requirements?.animals || []).filter((id) => returned.has(id));
	const dependents = animals
		.filter((a) => returned.has(a.id) && (a.requirements?.animals || []).includes(animal.id))
		.map((a) => a.id);
	const list = (ids: string[]) => {
		const names = ids.map(nameOf);
		return names.length <= 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
	};
	if (prereqs.length) return `Settled in after the ${list(prereqs)} were already here.`;
	if (dependents.length) return `The ${list(dependents)} followed once this one was back.`;
	return null;
}

export function AnimalCard() {
	const { data, state, animalCardId, setAnimalCardId, setPanel } = useGame();
	if (!data || !state || !animalCardId) return null;
	const animal = data.animals.find((a) => a.id === animalCardId);
	const disc = state.discoveries.find((d) => d.animalId === animalCardId);
	if (!animal) return null;
	const returnedIds = new Set(state.discoveries.map((d) => d.animalId));
	const neighbors = disc ? neighborsNote(animal, data.animals, returnedIds) : null;
	const guideTier = state.player.tools?.['field-journal'] || 1;
	const needTier = (data.biomes.find((b) => b.id === animal.biome)?.order || 1) + 1;
	const full = guideTier >= needTier;
	const close = () => {
		setAnimalCardId(null);
		setPanel(null);
	};
	return (
		<div className="panel-backdrop" onClick={close}>
			<div className="panel animal-card" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="paw" size={20} /> {animal.name}</h2>
					<button className="icon-btn" onClick={close} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					<img className="ani-thumb-lg" src={animalSpriteDataUri(animal.id, animal.kind, { silhouette: !disc })} alt={animal.name} />
					<p className="muted">{animal.kind} · {animal.rarity} · {data.biomes.find((b) => b.id === animal.biome)?.name}</p>
					{disc && (
						<p>
							<b>{comfortLabel(disc.comfort)}</b> — comfort {disc.comfort}%. Observed {disc.timesObserved} time{disc.timesObserved === 1 ? '' : 's'}.
						</p>
					)}
					{neighbors && (
						<p className="neighbors-note small"><Icon name="paw" size={13} /> <span><b>Neighbors:</b> {neighbors}</span></p>
					)}
					{full ? (
						<>
							<p><b>Diet:</b> {animal.diet}</p>
							<p><b>Shelter:</b> {animal.shelter}</p>
							<p><b>Preferred habitat:</b> {animal.preferredHabitat}</p>
							{disc && <p className="small">{disc.whyReturned}</p>}
							<p className="fact"><Icon name="leaf" size={14} /> <b>Field note:</b> {animal.fact}</p>
							<p className="muted small">
								Animals here are wild neighbors — they stay because the habitat supports them, and your journal simply records the good news.
							</p>
						</>
					) : (
						<p className="muted">
							<Icon name="lock" size={14} /> Upgrade your field guide to Tier {needTier} to read this animal's full entry.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

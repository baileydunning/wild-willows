import { useState } from 'react';
import { useGame } from '../state';
import type { AnimalDef, Discovery } from '../types';
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

function JournalEntry({ animal, disc }: { animal: AnimalDef; disc?: Discovery }) {
	const { state, observe } = useGame();
	const fullHints = (state?.player.tools?.['field-journal'] || 1) >= 2;
	if (!disc) {
		return (
			<div className="journal-entry entry-unknown">
				<div className="silhouette">?</div>
				<div className="grow">
					<b>Unknown {animal.kind}</b> <span className="muted small">({animal.rarity})</span>
					<RequirementHints animal={animal} full={fullHints} />
				</div>
			</div>
		);
	}
	return (
		<div className="journal-entry">
			<div className="silhouette known">{animal.name.slice(0, 1)}</div>
			<div className="grow">
				<b>{animal.name}</b>{' '}
				<span className={`comfort comfort-${comfortLabel(disc.comfort).toLowerCase().replace(' ', '-')}`}>
					{comfortLabel(disc.comfort)} ({disc.comfort}%)
				</span>
				<div className="muted small">
					Returned to the {disc.biomeId} · first seen {new Date(disc.firstObservedAt).toLocaleDateString()} · observed {disc.timesObserved}×
				</div>
				<div className="small">{disc.whyReturned}</div>
				<div className="muted small"><b>Diet:</b> {animal.diet} · <b>Shelter:</b> {animal.shelter}</div>
				<div className="muted small"><b>Prefers:</b> {animal.preferredHabitat}</div>
				<div className="small fact"><Icon name="leaf" size={13} /> {animal.fact}</div>
				<button className="link" onClick={() => observe(animal.id)}>Open info card</button>
			</div>
		</div>
	);
}

export function JournalPanel() {
	const { data, state, setPanel } = useGame();
	const [tab, setTab] = useState('meadow');
	if (!data || !state) return null;
	const biomes = [...data.biomes].sort((a, b) => a.order - b.order);
	const animals = data.animals.filter((a) => a.biome === tab);
	const discs = new Map(state.discoveries.map((d) => [d.animalId, d]));
	const returned = animals.filter((a) => discs.has(a.id)).length;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="journal" size={20} /> Field Journal {(state.player.tools?.['field-journal'] || 1) >= 2 ? '(Expanded Field Guide)' : ''}</h2>
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
					{animals.map((a) => (
						<JournalEntry key={a.id} animal={a} disc={discs.get(a.id)} />
					))}
				</div>
			</div>
		</div>
	);
}

export function AnimalCard() {
	const { data, state, animalCardId, setAnimalCardId, setPanel } = useGame();
	if (!data || !state || !animalCardId) return null;
	const animal = data.animals.find((a) => a.id === animalCardId);
	const disc = state.discoveries.find((d) => d.animalId === animalCardId);
	if (!animal) return null;
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
					<p className="muted">{animal.kind} · {animal.rarity} · {data.biomes.find((b) => b.id === animal.biome)?.name}</p>
					{disc && (
						<p>
							<b>{comfortLabel(disc.comfort)}</b> — comfort {disc.comfort}%. Observed {disc.timesObserved} time{disc.timesObserved === 1 ? '' : 's'}.
						</p>
					)}
					<p><b>Diet:</b> {animal.diet}</p>
					<p><b>Shelter:</b> {animal.shelter}</p>
					<p><b>Preferred habitat:</b> {animal.preferredHabitat}</p>
					{disc && <p className="small">{disc.whyReturned}</p>}
					<p className="fact"><Icon name="leaf" size={14} /> <b>Field note:</b> {animal.fact}</p>
					<p className="muted small">
						Animals here are wild neighbors — they stay because the habitat supports them, and your journal simply records the good news.
					</p>
				</div>
			</div>
		</div>
	);
}

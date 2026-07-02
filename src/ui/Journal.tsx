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

// Coarse trophic level → friendly label + colour band. Drives the badge and the
// food-web rows so players can read "who eats whom" at a glance.
const TROPHIC: Record<string, { label: string; tier: number; color: string }> = {
	producer: { label: 'Producer', tier: 0, color: '#6aa253' },
	decomposer: { label: 'Decomposer', tier: 0, color: '#8a7b5c' },
	'filter-feeder': { label: 'Filter feeder', tier: 1, color: '#5b9cab' },
	herbivore: { label: 'Herbivore', tier: 1, color: '#7bae55' },
	insectivore: { label: 'Insectivore', tier: 2, color: '#c99a3f' },
	scavenger: { label: 'Scavenger', tier: 2, color: '#a08048' },
	omnivore: { label: 'Omnivore', tier: 2, color: '#cf8a3a' },
	mesopredator: { label: 'Mid predator', tier: 3, color: '#c86b3a' },
	'apex-predator': { label: 'Apex predator', tier: 4, color: '#a5433a' },
};
function trophicInfo(t?: string) {
	return (t && TROPHIC[t]) || { label: 'Wildlife', tier: 2, color: '#7d8a5c' };
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

/** A small trophic-level pill, e.g. "Apex predator". */
function TrophicBadge({ trophic }: { trophic?: string }) {
	const info = trophicInfo(trophic);
	return (
		<span className="trophic-badge" style={{ background: info.color }}>
			<Icon name="scales" size={11} /> {info.label}
		</span>
	);
}

/**
 * Clickable food-web chips: which known animals this one eats, and which eat it.
 * Only shows animals the player has actually discovered (plus generic forage in
 * `eatsOther`), so the web fills in as the preserve comes back to life. Clicking
 * a chip opens that animal's info card — the player walks the web by tapping.
 */
function FoodWebLinks({ animal }: { animal: AnimalDef }) {
	const { data, state, setAnimalCardId, setPanel } = useGame();
	if (!data || !state) return null;
	const known = new Set(state.discoveries.map((d) => d.animalId));
	const nameOf = (id: string) => data.animals.find((a) => a.id === id)?.name || id;
	// Open the linked animal's info card. The card only renders while
	// panel === 'animal', so set both — otherwise the click does nothing.
	const openCard = (id: string) => { setAnimalCardId(id); setPanel('animal'); };
	const chip = (id: string) => {
		const seen = known.has(id);
		return (
			<button
				key={id}
				className={`web-chip ${seen ? '' : 'web-chip-unknown'}`}
				onClick={() => seen && openCard(id)}
				disabled={!seen}
				title={seen ? `Open ${nameOf(id)}` : 'Not yet discovered'}
			>
				{seen ? nameOf(id) : `??? ${data.animals.find((a) => a.id === id)?.kind || ''}`.trim()}
			</button>
		);
	};
	const eats = animal.eats || [];
	const eatenBy = animal.eatenBy || [];
	const forage = animal.eatsOther || [];
	if (!eats.length && !eatenBy.length && !forage.length) return null;
	return (
		<div className="foodweb-links small">
			{(eats.length > 0 || forage.length > 0) && (
				<div className="foodweb-row">
					<span className="foodweb-label"><Icon name="leaf" size={12} /> Eats</span>
					<span className="foodweb-chips">
						{eats.map(chip)}
						{forage.map((f) => <span key={f} className="web-chip web-chip-forage">{f}</span>)}
					</span>
				</div>
			)}
			{eatenBy.length > 0 && (
				<div className="foodweb-row">
					<span className="foodweb-label"><Icon name="paw" size={12} /> Eaten by</span>
					<span className="foodweb-chips">{eatenBy.map(chip)}</span>
				</div>
			)}
		</div>
	);
}

function JournalEntry({ animal, disc, full }: { animal: AnimalDef; disc?: Discovery; full: boolean }) {
	const { setAnimalCardId, setPanel } = useGame();
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
				{animal.scientificName && <span className="sci-name">{animal.scientificName}</span>}{' '}
				<TrophicBadge trophic={animal.trophic} />{' '}
				<span className={`comfort comfort-${comfortLabel(disc.comfort).toLowerCase().replace(' ', '-')}`}>
					{comfortLabel(disc.comfort)} ({disc.comfort}%)
				</span>
				<div className="muted small">
					Returned to the {disc.biomeId} · first seen {new Date(disc.firstObservedAt).toLocaleDateString()} · observed {disc.timesObserved}×
				</div>
				{full ? (
					<>
						{animal.role && <div className="small role-note"><b>Role in the ecosystem:</b> {animal.role}</div>}
						<FoodWebLinks animal={animal} />
						<div className="muted small"><b>Diet:</b> {animal.diet} · <b>Shelter:</b> {animal.shelter}</div>
						<div className="muted small"><b>Prefers:</b> {animal.preferredHabitat}</div>
						<div className="small fact"><Icon name="leaf" size={13} /> {animal.fact}</div>
						<button className="link" onClick={() => { setAnimalCardId(animal.id); setPanel('animal'); }}>Open full info card</button>
					</>
				) : (
					<div className="muted small"><em>Upgrade your field guide for this area to read the full entry.</em></div>
				)}
			</div>
		</div>
	);
}

/**
 * A simple layered food-web diagram for one biome: producers/forage at the
 * bottom, apex predators at the top. Discovered animals light up; the rest are
 * silhouettes, so completing the web is a visible goal. Tapping a known animal
 * opens its card.
 */
function FoodWebView({ animals, discs }: { animals: AnimalDef[]; discs: Map<string, Discovery> }) {
	const { setAnimalCardId, setPanel } = useGame();
	const openCard = (id: string) => { setAnimalCardId(id); setPanel('animal'); };
	const tiers: { label: string; test: (a: AnimalDef) => boolean }[] = [
		{ label: 'Apex predators', test: (a) => a.trophic === 'apex-predator' },
		{ label: 'Mid predators', test: (a) => a.trophic === 'mesopredator' },
		{ label: 'Omnivores · insectivores · scavengers', test: (a) => a.trophic === 'omnivore' || a.trophic === 'insectivore' || a.trophic === 'scavenger' },
		{ label: 'Herbivores · filter feeders', test: (a) => a.trophic === 'herbivore' || a.trophic === 'filter-feeder' },
		{ label: 'Producers · decomposers', test: (a) => a.trophic === 'producer' || a.trophic === 'decomposer' },
	];
	const placed = new Set<string>();
	const rows = tiers.map((t) => {
		const list = animals.filter((a) => t.test(a) && !placed.has(a.id));
		list.forEach((a) => placed.add(a.id));
		return { ...t, list };
	});
	const leftover = animals.filter((a) => !placed.has(a.id));
	if (leftover.length) rows[2].list.push(...leftover);
	const returnedCount = animals.filter((a) => discs.has(a.id)).length;

	return (
		<div className="foodweb-view">
			<p className="muted small">
				Arrows point from prey up to predator. {returnedCount}/{animals.length} discovered — restore more habitat to reveal the rest of the web.
			</p>
			{rows.map((r) => (
				r.list.length ? (
					<div key={r.label} className="foodweb-tier">
						<div className="foodweb-tier-label">{r.label}</div>
						<div className="foodweb-tier-row">
							{r.list.map((a) => {
								const seen = discs.has(a.id);
								const info = trophicInfo(a.trophic);
								return (
									<button
										key={a.id}
										className={`foodweb-node ${seen ? '' : 'foodweb-node-unknown'}`}
										style={seen ? { borderColor: info.color } : undefined}
										onClick={() => seen && openCard(a.id)}
										disabled={!seen}
										title={seen ? a.name : `Undiscovered ${a.kind}`}
									>
										<img className="ani-thumb" src={animalSpriteDataUri(a.id, a.kind, { silhouette: !seen })} alt="" />
										<span>{seen ? a.name : '???'}</span>
									</button>
								);
							})}
						</div>
					</div>
				) : null
			))}
		</div>
	);
}

export function JournalPanel() {
	const { data, state, setPanel } = useGame();
	// default to the biome you're currently standing in
	const [tab, setTab] = useState(state?.player.area || 'meadow');
	const [view, setView] = useState<'list' | 'web'>('list');
	const [unknownFirst, setUnknownFirst] = useState(false);
	const [query, setQuery] = useState('');
	if (!data || !state) return null;
	const biomes = [...data.biomes].sort((a, b) => a.order - b.order);
	const discs = new Map(state.discoveries.map((d) => [d.animalId, d]));
	const q = query.trim().toLowerCase();
	const allInTab = data.animals.filter((a) => a.biome === tab);
	const animals = allInTab
		// Search by name (once known), kind, rarity, or the word "unknown" for ones
		// still to be discovered.
		.filter((a) => {
			if (!q) return true;
			const known = discs.has(a.id);
			const hay = [a.kind, a.rarity, a.trophic || '', known ? a.name : 'unknown', known ? '' : 'undiscovered'].join(' ').toLowerCase();
			return hay.includes(q);
		})
		// By default returned animals rise to the top (most recent first); the
		// "unknown first" toggle flips it so you can see who's still to find.
		.sort((a, b) => {
			const da = discs.get(a.id), db = discs.get(b.id);
			if (!!da !== !!db) return (da ? -1 : 1) * (unknownFirst ? -1 : 1);
			if (da && db) return (db.firstObservedAt || 0) - (da.firstObservedAt || 0);
			return (a.requirements?.minHealth || 0) - (b.requirements?.minHealth || 0);
		});
	const returned = allInTab.filter((a) => discs.has(a.id)).length;
	// Full entries for an area need the field guide upgraded to that area's tier.
	const tabBiome = biomes.find((b) => b.id === tab);
	const guideTier = state.player.tools?.['field-journal'] || 1;
	// each area's FULL entries need that area's own field-guide upgrade. The baseline
	// journal (tier 1) still shows the generic entry — sprite + comfort — for every
	// area, just with diet/shelter/fact/hints locked behind the upgrade.
	const needTier = (tabBiome?.order || 1) + 1;
	const full = guideTier >= needTier;
	// The title is the field guide for the biome you're VIEWING (the tab), so it's
	// always clear which guide is open — not just the journal tier you own.
	const tierName = (tier: number) => data.tools.find((t) => t.id === 'field-journal')?.tiers.find((tt) => tt.tier === tier)?.name;
	const tabGuideName = tierName(needTier) || `${tabBiome?.name || 'Field'} Field Guide`;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="journal" size={20} /> {tabGuideName}</h2>
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
					<div className="journal-controls">
						<span className="muted small grow">{returned}/{allInTab.length} animals have returned to {tabBiome?.name || 'this biome'}.</span>
						<div className="view-switch" role="tablist">
							<button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="Entry list"><Icon name="journal" size={12} /> Entries</button>
							<button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')} title="Food web for this biome"><Icon name="scales" size={12} /> Food web</button>
						</div>
						{view === 'list' && (
							<>
								<button
									className={`chip-toggle ${unknownFirst ? 'on' : ''}`}
									onClick={() => setUnknownFirst((v) => !v)}
									title="Sort animals you haven't found yet to the top"
								>
									<Icon name="paw" size={12} /> Unknown first
								</button>
								<input
									className="craft-search"
									type="search"
									placeholder="Search by name, kind, or role…"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									autoComplete="off"
									aria-label="Search the field guide"
								/>
							</>
						)}
					</div>
					{!full && (
						<div className="guide-upsell small">
							<Icon name="lock" size={13} /> Upgrade your field guide to <b>Tier {needTier}</b> to read full entries, food-web links, and return hints for {tabBiome?.name}. See the Tools panel.
						</div>
					)}
					{view === 'web' ? (
						<FoodWebView animals={allInTab} discs={discs} />
					) : (
						<>
							{animals.length === 0 && <p className="muted small">No animals match your search.</p>}
							{animals.map((a) => (
								<JournalEntry key={a.id} animal={a} disc={discs.get(a.id)} full={full} />
							))}
						</>
					)}
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
	// Keep the card open when hopping between linked animals.
	const backToJournal = () => {
		setAnimalCardId(null);
		setPanel('journal');
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
					{animal.scientificName && <p className="sci-name-lg">{animal.scientificName}</p>}
					<p className="muted card-meta">
						{animal.kind} · {animal.rarity} · {data.biomes.find((b) => b.id === animal.biome)?.name} <TrophicBadge trophic={animal.trophic} />
					</p>
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
							{animal.role && <p className="role-note"><b>Role in the ecosystem:</b> {animal.role}</p>}
							<FoodWebLinks animal={animal} />
							<p><b>Diet:</b> {animal.diet}</p>
							<p><b>Shelter:</b> {animal.shelter}</p>
							<p><b>Preferred habitat:</b> {animal.preferredHabitat}</p>
							{disc && <p className="small">{disc.whyReturned}</p>}
							<p className="fact"><Icon name="leaf" size={14} /> <b>Field note:</b> {animal.fact}</p>
							<button className="link" onClick={backToJournal}>← Back to field guide</button>
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

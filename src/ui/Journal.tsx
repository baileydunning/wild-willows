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

/** A small trophic-level pill, e.g. "Apex predator". */
function TrophicBadge({ trophic }: { trophic?: string }) {
	const info = trophicInfo(trophic);
	return (
		<span className="trophic-badge" style={{ background: info.color }}>
			<Icon name="scales" size={11} /> {info.label}
		</span>
	);
}

/** "Comes out when…" line for rare animals gated on the live weather/season/time. */
export function conditionsLine(animal: AnimalDef): string | null {
	const cond = animal.requirements?.conditions;
	if (!cond) return null;
	const bits: string[] = [];
	if (cond.weather?.length) bits.push(`during ${cond.weather.join(' or ')}`);
	if (cond.season?.length) bits.push(`in ${cond.season.join(' or ')}`);
	if (cond.dayPhase?.length) bits.push(`at ${cond.dayPhase.join(' or ')}`);
	return bits.length ? `Only ventures out ${bits.join(', ')}` : null;
}

/**
 * Friendly "when to spot them" notes derived from an animal's sighting
 * conditions — time of day (activity pattern), season, and weather. Returns an
 * empty list when the animal can turn up anytime, so the card only shows this
 * section when there's actually a viewing window worth knowing.
 */
export function activityNotes(animal: AnimalDef): { icon: string; text: string }[] {
	const cond = animal.requirements?.conditions;
	if (!cond) return [];
	const join = (xs: string[], word: 'and' | 'or') =>
		xs.length <= 1 ? xs[0] : xs.slice(0, -1).join(', ') + ` ${word} ` + xs[xs.length - 1];
	const notes: { icon: string; text: string }[] = [];

	// Time of day → an activity pattern players can plan around.
	const ph = cond.dayPhase || [];
	if (ph.length) {
		const set = new Set(ph);
		const isOnly = (...vals: string[]) => vals.length === set.size && vals.every((v) => set.has(v));
		let text: string;
		if (isOnly('dawn', 'dusk')) text = 'Most active at dawn and dusk (crepuscular)';
		else if (set.has('night') && !set.has('day') && !set.has('dawn')) text = set.has('dusk') ? 'Out from dusk through the night (nocturnal)' : 'Active at night (nocturnal)';
		else if (isOnly('day')) text = 'Active in daylight (diurnal)';
		else text = `Active at ${join(ph, 'and')}`;
		notes.push({ icon: 'sun', text });
	}
	// Season → when it's around at all.
	if (cond.season?.length) notes.push({ icon: 'leaf', text: `Around mainly in ${join(cond.season, 'and')}` });
	// Weather → what conditions coax it out.
	if (cond.weather?.length) {
		const w = cond.weather;
		notes.push({ icon: 'cloud', text: w.length === 1 && w[0] === 'rain' ? 'Ventures out in the rain' : `Comes out in ${join(w, 'or')} weather` });
	}
	return notes;
}

function RequirementHints({ animal, full }: { animal: AnimalDef; full: boolean }) {
	const { data } = useGame();
	const req = animal.requirements || {};
	const condLine = conditionsLine(animal);
	if (!full) {
		return (
			<div className="muted small">
				Hint: {req.hint || 'Restore more habitat and see who arrives.'}
				{condLine && <> <Icon name="cloud" size={11} /> {condLine}.</>}
			</div>
		);
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
				{condLine ? <li><Icon name="cloud" size={11} /> {condLine} — check the weather panel (M)</li> : null}
			</ul>
		</div>
	);
}

/**
 * Clickable food-web chips: which known animals this one eats, and which eat it.
 * Only shows animals the player has actually discovered (plus generic forage in
 * `eatsOther`). Clicking a chip opens that animal's info card — walk the web.
 */
function FoodWebLinks({ animal }: { animal: AnimalDef }) {
	const { data, state, observe } = useGame();
	if (!data || !state) return null;
	const known = new Set(state.discoveries.map((d) => d.animalId));
	const nameOf = (id: string) => data.animals.find((a) => a.id === id)?.name || id;
	const openCard = (id: string) => { void observe(id); }; // reading the entry = observing
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

/**
 * A light, scannable list row. Known animals are a single tappable line —
 * sprite, name, trophic, comfort — that opens the in-depth info card. The deep
 * ecology (role, diet, food web, field note) lives on the card, not here.
 */
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
	const c = comfortLabel(disc.comfort);
	return (
		<button className="journal-entry entry-link" onClick={() => { void observe(animal.id); }}>
			<div className="silhouette known">
				<img className="ani-thumb" src={animalSpriteDataUri(animal.id, animal.kind)} alt={animal.name} />
			</div>
			<div className="grow">
				<div className="entry-title">
					<b>{animal.name}</b>
					<TrophicBadge trophic={animal.trophic} />
				</div>
				<div className="muted small entry-sub">
					{animal.scientificName && <em>{animal.scientificName}</em>}
					<span className={`comfort comfort-${c.toLowerCase().replace(' ', '-')}`}>{c}</span>
				</div>
				{animal.diet && <div className="muted small entry-meta"><Icon name="leaf" size={11} /> Eats {animal.diet.charAt(0).toLowerCase() + animal.diet.slice(1)}</div>}
				{animal.preferredHabitat && <div className="muted small entry-meta"><Icon name="home" size={11} /> {animal.preferredHabitat}</div>}
			</div>
			<Icon name="forward" size={16} className="entry-chevron" />
		</button>
	);
}

/**
 * A layered food-web diagram for one biome: producers at the bottom, apex
 * predators at the top. Discovered animals light up; the rest are silhouettes.
 */
function FoodWebView({ animals, discs }: { animals: AnimalDef[]; discs: Map<string, Discovery> }) {
	const { observe } = useGame();
	const openCard = (id: string) => { void observe(id); }; // reading the entry = observing
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
				Higher rows hunt the rows below. {returnedCount}/{animals.length} discovered — restore more habitat to reveal the rest of the web.
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

/**
 * "All animals" tab: every animal that's returned across the whole preserve,
 * shown as a card with its biome — a quick who's-here overview. Tapping a card
 * opens the full info card.
 */
function OverviewGrid({ query }: { query: string }) {
	const { data, state, observe } = useGame();
	if (!data || !state) return null;
	const openCard = (id: string) => { void observe(id); }; // reading the entry = observing
	const order = new Map(data.biomes.map((b) => [b.id, b.order]));
	const biomeName = (id: string) => data.biomes.find((b) => b.id === id)?.name || id;
	const q = query.trim().toLowerCase();
	const returned = state.discoveries
		.map((d) => data.animals.find((a) => a.id === d.animalId))
		.filter((a): a is AnimalDef => !!a)
		.filter((a) => !q || [a.name, a.kind, a.biome, a.trophic || ''].join(' ').toLowerCase().includes(q))
		.sort((a, b) => (order.get(a.biome)! - order.get(b.biome)!) || a.name.localeCompare(b.name));

	if (!state.discoveries.length) {
		return <p className="muted small overview-empty"><Icon name="paw" size={14} /> No animals have returned yet. Restore habitat and they'll start arriving — check back here to see everyone who's home.</p>;
	}
	if (!returned.length) return <p className="muted small">No animals match your search.</p>;

	return (
		<div className="overview-grid">
			{returned.map((a) => (
				<button key={a.id} className="overview-card" onClick={() => openCard(a.id)} title={`Open ${a.name}`}>
					<img className="ani-thumb" src={animalSpriteDataUri(a.id, a.kind)} alt="" />
					<span className="overview-name">{a.name}</span>
					<span className="overview-biome"><Icon name="leaf" size={10} /> {biomeName(a.biome)}</span>
					<TrophicBadge trophic={a.trophic} />
				</button>
			))}
		</div>
	);
}

export function JournalPanel() {
	const { data, state, setPanel } = useGame();
	// 'overview' shows every returned animal; otherwise a biome id is selected.
	const [tab, setTab] = useState<string>(state?.player.area || 'meadow');
	const [view, setView] = useState<'list' | 'web'>('list');
	const [unknownFirst, setUnknownFirst] = useState(false);
	const [query, setQuery] = useState('');
	if (!data || !state) return null;
	const biomes = [...data.biomes].sort((a, b) => a.order - b.order);
	const discs = new Map(state.discoveries.map((d) => [d.animalId, d]));
	const isOverview = tab === 'overview';
	const q = query.trim().toLowerCase();

	const allInTab = data.animals.filter((a) => a.biome === tab);
	const animals = allInTab
		.filter((a) => {
			if (!q) return true;
			const known = discs.has(a.id);
			const hay = [a.kind, a.rarity, a.trophic || '', known ? a.name : 'unknown', known ? '' : 'undiscovered'].join(' ').toLowerCase();
			return hay.includes(q);
		})
		.sort((a, b) => {
			const da = discs.get(a.id), db = discs.get(b.id);
			if (!!da !== !!db) return (da ? -1 : 1) * (unknownFirst ? -1 : 1);
			if (da && db) return (db.firstObservedAt || 0) - (da.firstObservedAt || 0);
			return (a.requirements?.minHealth || 0) - (b.requirements?.minHealth || 0);
		});
	const returned = allInTab.filter((a) => discs.has(a.id)).length;

	const tabBiome = biomes.find((b) => b.id === tab);
	const guideTier = state.player.tools?.['field-journal'] || 1;
	const needTier = (tabBiome?.order || 1) + 1;
	const full = guideTier >= needTier;
	const tierName = (tier: number) => data.tools.find((t) => t.id === 'field-journal')?.tiers.find((tt) => tt.tier === tier)?.name;
	const tabGuideName = isOverview
		? 'Field Journal'
		: (tierName(needTier) || `${tabBiome?.name || 'Field'} Field Guide`);
	const totalReturned = state.discoveries.length;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide journal-panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="journal" size={20} /> {tabGuideName}</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button>
				</div>

				{/* Places sit in one horizontal, scrollable row so no tab gets cut off. */}
				<div className="tabs tabs-scroll">
					<button className={isOverview ? 'on' : ''} onClick={() => setTab('overview')}>
						<Icon name="paw" size={12} /> All animals
					</button>
					{biomes.map((b) => {
						const locked = !state.player.unlockedBiomes.includes(b.id);
						return (
							<button
								key={b.id}
								className={`${tab === b.id ? 'on' : ''} ${locked ? 'tab-locked' : ''}`}
								onClick={() => !locked && setTab(b.id)}
								disabled={locked}
								title={locked ? `${b.name} is still locked — unlock it in the world first` : b.name}
							>
								{b.name}
								{locked && <Icon name="lock" size={11} />}
							</button>
						);
					})}
				</div>

				<div className="panel-body">
					{/* Controls: a summary + view toggles on the first line, then the
					    search box on its own full-width line so it never gets clipped. */}
					<div className="journal-controls">
						<div className="journal-controls-top">
							<span className="muted small grow">
								{isOverview
									? `${totalReturned} of ${data.animals.length} animals have returned across the preserve.`
									: `${returned}/${allInTab.length} animals have returned to ${tabBiome?.name || 'this biome'}.`}
							</span>
							{!isOverview && (
								<div className="view-switch" role="tablist">
									<button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="Entry list"><Icon name="journal" size={12} /> Entries</button>
									<button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')} title="Food web for this biome"><Icon name="scales" size={12} /> Food web</button>
								</div>
							)}
							{!isOverview && view === 'list' && (
								<button
									className={`chip-toggle ${unknownFirst ? 'on' : ''}`}
									onClick={() => setUnknownFirst((v) => !v)}
									title="Sort animals you haven't found yet to the top"
								>
									<Icon name="paw" size={12} /> Unknown first
								</button>
							)}
						</div>
						{(isOverview || view === 'list') && (
							<input
								className="craft-search journal-search"
								type="search"
								placeholder="Search by name, kind, or role…"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								autoComplete="off"
								aria-label="Search the field guide"
							/>
						)}
					</div>

					{!isOverview && !full && (
						<div className="guide-upsell small">
							<Icon name="lock" size={13} />
							<span>Upgrade your field guide to <b>Tier {needTier}</b> to read the full info card — ecology, diet, and food-web links — for {tabBiome?.name}. See the Tools panel.</span>
						</div>
					)}

					{isOverview ? (
						<OverviewGrid query={query} />
					) : view === 'web' ? (
						<FoodWebView animals={allInTab} discs={discs} />
					) : (
						<>
							{animals.length === 0 && <p className="muted small">No animals match your search.</p>}
							<div className="entry-list">
								{animals.map((a) => (
									<JournalEntry key={a.id} animal={a} disc={discs.get(a.id)} full={full} />
								))}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * Coexistence note: name returned neighbors this animal depends on (its
 * requirement chain) and returned neighbors that depend on it.
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
	const biomeName = data.biomes.find((b) => b.id === animal.biome)?.name;
	const close = () => {
		setAnimalCardId(null);
		setPanel(null);
	};
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
					{/* Header block: portrait, scientific name, and the key tags. */}
					<div className="card-hero">
						<img className="ani-thumb-lg" src={animalSpriteDataUri(animal.id, animal.kind, { silhouette: !disc })} alt={animal.name} />
						{animal.scientificName && <p className="sci-name-lg">{animal.scientificName}</p>}
						<p className="muted card-meta">
							<span className="card-biome"><Icon name="leaf" size={11} /> {biomeName}</span>
							<span className="dot">·</span>{animal.kind}<span className="dot">·</span>{animal.rarity}
						</p>
						<div className="card-badges">
							<TrophicBadge trophic={animal.trophic} />
							{disc && <span className={`comfort comfort-${comfortLabel(disc.comfort).toLowerCase().replace(' ', '-')}`}>{comfortLabel(disc.comfort)} · {disc.comfort}%</span>}
						</div>
					</div>

					{disc && (
						<p className="muted small card-seen">
							Observed {disc.timesObserved} time{disc.timesObserved === 1 ? '' : 's'} · first seen {new Date(disc.firstObservedAt).toLocaleDateString()}
						</p>
					)}
					{disc && disc.comfort < 90 && Object.keys(animal.requirements?.objects || {}).length > 0 && (
						<p className="muted small card-seen">
							<Icon name="leaf" size={11} /> Comfort grows with habitat: place more of what it likes —{' '}
							{Object.keys(animal.requirements.objects || {})
								.map((id) => data?.habitatObjects.find((o) => o.id === id)?.name || id)
								.join(', ')}{' '}
							— and it will truly settle in.
						</p>
					)}
					{neighbors && (
						<p className="neighbors-note small"><Icon name="paw" size={13} /> <span><b>Neighbors:</b> {neighbors}</span></p>
					)}

					{full ? (
						<>
							{animal.role && (
								<div className="card-section">
									<h3><Icon name="scales" size={14} /> Role in the ecosystem</h3>
									<p>{animal.role}</p>
								</div>
							)}
							{(animal.eats?.length || animal.eatenBy?.length || animal.eatsOther?.length) ? (
								<div className="card-section">
									<h3><Icon name="paw" size={14} /> Food web</h3>
									<FoodWebLinks animal={animal} />
								</div>
							) : null}
							{activityNotes(animal).length > 0 && (
								<div className="card-section">
									<h3><Icon name="sun" size={14} /> When to spot them</h3>
									{activityNotes(animal).map((n, i) => (
										<p key={i} className="card-fact"><Icon name={n.icon} size={12} /> {n.text}</p>
									))}
								</div>
							)}
							<div className="card-section">
								<h3><Icon name="leaf" size={14} /> Habitat</h3>
								<p className="card-fact"><b>Shelter:</b> {animal.shelter}</p>
								<p className="card-fact"><b>Preferred habitat:</b> {animal.preferredHabitat}</p>
								{disc && <p className="muted small">{disc.whyReturned}</p>}
							</div>
							<p className="fact"><Icon name="leaf" size={14} /> <b>Field note:</b> {animal.fact}</p>
							<button className="link" onClick={backToJournal}>← Back to field journal</button>
						</>
					) : (
						<>
							<p className="muted">
								<Icon name="lock" size={14} /> Upgrade your field guide to Tier {needTier} to read this animal's full entry — its ecological role, diet, and food-web links.
							</p>
							<button className="link" onClick={backToJournal}>← Back to field journal</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

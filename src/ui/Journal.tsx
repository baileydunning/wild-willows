import { useEffect, useState } from 'react';
import { useGame } from '../state';
import type { AnimalDef, Discovery, GameData, FoodEdge } from '../types';
import { customGoalsUnlocked, guideToolId, hasGuide, hasExpandedGuide } from '../types';
import { animalSpriteDataUri } from '../game/textures';
import { t, content } from '../i18n';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import { journalNav, type JournalLoc } from './journalNav';
import { effort } from './journalSort';
import { guessFor, guessOptions, guessTally, recordGuess, signatureObject, useFieldGuesses } from '../fieldGuess';

/** A habitat object's display name, localized, falling back to its id. */
function objectName(data: GameData | null | undefined, id: string) {
	const o = data?.habitatObjects.find((oo) => oo.id === id);
	return o ? content('habitatObject', o.id, 'name', o.name) : id;
}

/** Shared back/forward pair for the journal panel and animal cards. */
function HistoryNav({ go }: { go: (loc: JournalLoc | undefined) => void }) {
	const { t } = useI18n();
	return (
		<>
			<button
				className="icon-btn"
				disabled={!journalNav.canBack()}
				onClick={() => go(journalNav.back())}
				title={t('panels.journal.historyBack')}
				aria-label={t('panels.journal.historyBack')}
			>
				<Icon name="back" />
			</button>
			<button
				className="icon-btn"
				disabled={!journalNav.canForward()}
				onClick={() => go(journalNav.forward())}
				title={t('panels.journal.historyForward')}
				aria-label={t('panels.journal.historyForward')}
			>
				<Icon name="forward" />
			</button>
		</>
	);
}

/** Stable comfort band id — used for the CSS class; the label comes from t(). */
function comfortLabel(c: number) {
	if (c >= 75) return 'thriving';
	if (c >= 50) return 'settled';
	if (c >= 30) return 'cautious';
	return 'rarely-seen';
}
const comfortText = (c: number) => t(`panels.journal.comfort.${comfortLabel(c)}`);

// Coarse trophic level → friendly label + colour band. Drives the badge and the
// food-web rows so players can read "who eats whom" at a glance.
const TROPHIC: Record<string, { tier: number; color: string }> = {
	producer: { tier: 0, color: '#6aa253' },
	decomposer: { tier: 0, color: '#8a7b5c' },
	detritivore: { tier: 0, color: '#7d6f52' },
	'filter-feeder': { tier: 1, color: '#5b9cab' },
	herbivore: { tier: 1, color: '#7bae55' },
	insectivore: { tier: 2, color: '#c99a3f' },
	scavenger: { tier: 2, color: '#a08048' },
	omnivore: { tier: 2, color: '#cf8a3a' },
	mesopredator: { tier: 3, color: '#c86b3a' },
	'apex-predator': { tier: 4, color: '#a5433a' },
};
function trophicInfo(tr?: string) {
	const base = tr && TROPHIC[tr] ? { id: tr, ...TROPHIC[tr] } : { id: 'wildlife', tier: 2, color: '#7d8a5c' };
	return { ...base, label: t(`panels.journal.trophic.${base.id}`) };
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
	const or = t('panels.journal.cond.or');
	const bits: string[] = [];
	if (cond.weather?.length)
		bits.push(
			t('panels.journal.cond.during', {
				list: cond.weather.map((w) => content('weather', w, 'name', w).toLowerCase()).join(` ${or} `),
			}),
		);
	if (cond.season?.length)
		bits.push(
			t('panels.journal.cond.inSeason', {
				list: cond.season.map((s) => t(`panels.journal.seasons.${s}`)).join(` ${or} `),
			}),
		);
	if (cond.dayPhase?.length)
		bits.push(
			t('panels.journal.cond.atTime', {
				list: cond.dayPhase.map((p) => t(`panels.journal.dayPhases.${p}`)).join(` ${or} `),
			}),
		);
	return bits.length ? t('panels.journal.cond.line', { bits: bits.join(', ') }) : null;
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
	const join = (xs: string[], word: string) =>
		xs.length <= 1 ? xs[0] : xs.slice(0, -1).join(', ') + ` ${word} ` + xs[xs.length - 1];
	const and = t('panels.journal.cond.and');
	const or = t('panels.journal.cond.or');
	const notes: { icon: string; text: string }[] = [];

	// Time of day → an activity pattern players can plan around.
	const ph = cond.dayPhase || [];
	if (ph.length) {
		const set = new Set(ph);
		const isOnly = (...vals: string[]) => vals.length === set.size && vals.every((v) => set.has(v));
		let text: string;
		if (isOnly('dawn', 'dusk')) text = t('panels.journal.activity.crepuscular');
		else if (set.has('night') && !set.has('day') && !set.has('dawn'))
			text = set.has('dusk') ? t('panels.journal.activity.duskNocturnal') : t('panels.journal.activity.nocturnal');
		else if (isOnly('day')) text = t('panels.journal.activity.diurnal');
		else
			text = t('panels.journal.activity.activeAt', {
				phases: join(
					ph.map((p) => t(`panels.journal.dayPhases.${p}`)),
					and,
				),
			});
		notes.push({ icon: 'sun', text });
	}
	// Season → when it's around at all.
	if (cond.season?.length)
		notes.push({
			icon: 'leaf',
			text: t('panels.journal.activity.seasonal', {
				seasons: join(
					cond.season.map((s) => t(`panels.journal.seasons.${s}`)),
					and,
				),
			}),
		});
	// Weather → what conditions coax it out.
	if (cond.weather?.length) {
		const w = cond.weather;
		notes.push({
			icon: 'cloud',
			text:
				w.length === 1 && w[0] === 'rain'
					? t('panels.journal.activity.rain')
					: t('panels.journal.activity.weather', {
							list: join(
								w.map((x) => content('weather', x, 'name', x).toLowerCase()),
								or,
							),
						}),
		});
	}
	return notes;
}

/**
 * The one question the expanded guide asks before it answers.
 *
 * Shown once per still-missing animal: the habitat hint is already on screen,
 * so the player has what they need to reason from. Getting it wrong costs
 * nothing and reveals the same list — the point is that they committed to an
 * answer first, which is what makes the list stick.
 */
function GuessPrompt({
	animal,
	answer,
	options,
	onDone,
}: {
	animal: AnimalDef;
	answer: string;
	options: string[];
	onDone: () => void;
}) {
	const { data } = useGame();
	return (
		<div className="small req-guess">
			<p className="req-guess-q">
				<Icon name="sparkle" size={12} />{' '}
				{t('panels.journal.guessPrompt', { name: content('animal', animal.id, 'name', animal.name) })}
			</p>
			<div className="req-guess-options">
				{options.map((id) => (
					<button
						key={id}
						className="req-guess-option"
						onClick={() => {
							recordGuess(animal.id, id === answer ? 'correct' : 'wrong');
							onDone();
						}}
					>
						{objectName(data, id)}
					</button>
				))}
			</div>
			<button
				className="link req-guess-skip"
				onClick={() => {
					recordGuess(animal.id, 'skipped');
					onDone();
				}}
			>
				{t('panels.journal.guessSkip')}
			</button>
		</div>
	);
}

function RequirementHints({ animal, full }: { animal: AnimalDef; full: boolean }) {
	const { data, state } = useGame();
	useFieldGuesses(); // repaint this card the moment a guess is recorded
	const [answered, setAnswered] = useState(false);
	const seen = new Set((state?.discoveries || []).map((d) => d.animalId));
	const req = animal.requirements || {};
	const condLine = conditionsLine(animal);
	// "Only ventures out at dusk or night" is a clock, not a forecast — pointing at
	// the weather panel for it just sends the player somewhere that cannot help.
	const weatherGated = !!req.conditions?.weather?.length;
	const hint = req.hint ? content('animal', animal.id, 'hint', req.hint) : t('panels.journal.hintDefault');
	if (!full) {
		return (
			<div className="muted small">
				{t('panels.journal.hint', { hint })}
				{condLine && (
					<>
						{' '}
						<Icon name={weatherGated ? 'cloud' : 'sun'} size={11} /> {condLine}.
					</>
				)}
			</div>
		);
	}
	// Ask before answering — but only for an animal that hasn't arrived yet (there
	// is nothing to predict once it's standing in front of you) and only once.
	const answer = signatureObject(req);
	const outcome = guessFor(animal.id);
	// Wrong answers are drawn from habitat that belongs in the same biome, so a
	// wrong pick is wrong about ecology rather than about what's craftable here.
	const options = answer
		? guessOptions(
				animal.id,
				answer,
				req.objects || {},
				(data?.habitatObjects || [])
					.filter((o) => (o.biomes || []).includes(animal.biome) && o.placement !== 'indoor')
					.map((o) => o.id),
			)
		: [];
	// A biome with nothing else to offer can't pose a real question — in that case
	// fall straight through to the list rather than asking a one-option riddle.
	if (answer && options.length >= 3 && !outcome && !answered && !seen.has(animal.id)) {
		return (
			<div className="small req-details">
				<div className="muted">{t('panels.journal.hint', { hint })}</div>
				<GuessPrompt animal={animal} answer={answer} options={options} onDone={() => setAnswered(true)} />
			</div>
		);
	}
	const tally = guessTally();
	return (
		<div className="small req-details">
			<div className="muted">{t('panels.journal.hint', { hint })}</div>
			{outcome && outcome !== 'skipped' && answer ? (
				<p className={`req-guess-result ${outcome}`}>
					<Icon name={outcome === 'correct' ? 'check' : 'leaf'} size={12} />{' '}
					{outcome === 'correct'
						? t('panels.journal.guessCorrect', { name: objectName(data, answer) })
						: t('panels.journal.guessWrong', { name: objectName(data, answer) })}{' '}
					<span className="muted">
						{t('panels.journal.guessTally', { correct: tally.correct, count: tally.attempted })}
					</span>
				</p>
			) : null}
			<ul>
				{req.minHealth ? <li>{t('panels.journal.minHealth', { value: req.minHealth })}</li> : null}
				{req.minBalance ? <li>{t('panels.journal.minBalance', { value: req.minBalance })}</li> : null}
				{/* Open water you have to dig. Only the shapes the player can actually
				    terraform are listed: coastal `ocean`/`deep` are part of the map from
				    the start, so printing them would read as a chore that isn't one. */}
				{req.water?.lake ? <li>{t('panels.journal.waterLake', { tiles: req.water.lake })}</li> : null}
				{req.water?.river ? <li>{t('panels.journal.waterRiver', { tiles: req.water.river })}</li> : null}
				{req.water?.tiles && !req.water?.lake && !req.water?.river ? (
					<li>{t('panels.journal.waterTiles', { tiles: req.water.tiles })}</li>
				) : null}
				{Object.entries(req.objects || {}).map(([id, q]) => {
					const o = data?.habitatObjects.find((oo) => oo.id === id);
					return (
						<li key={id}>
							{t('panels.journal.objectReq', { qty: q, name: o ? content('habitatObject', o.id, 'name', o.name) : id })}
						</li>
					);
				})}
				{(req.animals || []).map((id) => {
					const a = data?.animals.find((aa) => aa.id === id);
					// Don't leak the name of an animal the player hasn't discovered yet —
					// show its kind instead (e.g. "another bird needs to return first").
					if (a && !seen.has(id)) {
						return (
							<li key={id}>
								{t('panels.journal.animalReqUnknown', { kind: content('animal', a.id, 'kind', a.kind) })}
							</li>
						);
					}
					return (
						<li key={id}>
							{t('panels.journal.animalReq', { name: a ? content('animal', a.id, 'name', a.name) : id })}
						</li>
					);
				})}
				{condLine ? (
					<li>
						<Icon name={weatherGated ? 'cloud' : 'sun'} size={11} />{' '}
						{weatherGated ? t('panels.journal.condCheck', { cond: condLine }) : condLine}
					</li>
				) : null}
			</ul>
		</div>
	);
}

/**
 * Where this entry's facts come from. Every animal record carries a `sources`
 * array (Animal Diversity Web, NPS, US FWS, Cornell Lab and friends) and until
 * now nothing rendered it. Collapsed by default so it never competes with the
 * writing, but present on every full entry: a game that makes factual claims
 * should be able to show its work, and teachers ask.
 *
 * The links carry target="_blank"; Electron's setWindowOpenHandler
 * (electron/main.js) sends http(s) out to the system browser, so following one
 * doesn't navigate the game away.
 */
function SourceList({ animal }: { animal: AnimalDef }) {
	const { t } = useI18n();
	const sources = animal.sources || [];
	if (!sources.length) return null;
	return (
		<details className="card-sources">
			<summary>
				<Icon name="journal" size={12} /> {t('panels.journal.sourcesTitle', { count: sources.length })}
			</summary>
			<ul>
				{sources.map((s) => (
					<li key={s.url}>
						<a href={s.url} target="_blank" rel="noopener noreferrer">
							{s.name}
						</a>
					</li>
				))}
			</ul>
		</details>
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
	const nameOf = (id: string) => {
		const a = data.animals.find((aa) => aa.id === id);
		return a ? content('animal', a.id, 'name', a.name) : id;
	};
	const openCard = (id: string) => {
		void observe(id);
	}; // reading the entry = observing
	const chip = (edge: FoodEdge) => {
		const id = typeof edge === 'string' ? edge : edge.id;
		const stage = typeof edge === 'string' ? undefined : edge.stage;
		const seen = known.has(id);
		const a = data.animals.find((aa) => aa.id === id);
		return (
			<button
				key={id}
				className={`web-chip ${seen ? '' : 'web-chip-unknown'}`}
				onClick={() => seen && openCard(id)}
				disabled={!seen}
				title={seen ? t('panels.journal.openEntry', { name: nameOf(id) }) : t('panels.journal.notDiscovered')}
			>
				{seen
					? nameOf(id)
					: t('panels.journal.unknownChip', { kind: a ? content('animal', a.id, 'kind', a.kind) : '' }).trim()}
				{stage ? <span className="web-chip-stage"> {t(`panels.journal.stage.${stage}`)}</span> : null}
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
					<span className="foodweb-label">
						<Icon name="leaf" size={12} /> {t('panels.journal.eats')}
					</span>
					<span className="foodweb-chips">
						{eats.map(chip)}
						{forage.map((f) => (
							<span key={f} className="web-chip web-chip-forage">
								{content('forage', f, 'name', f)}
							</span>
						))}
					</span>
				</div>
			)}
			{eatenBy.length > 0 && (
				<div className="foodweb-row">
					<span className="foodweb-label">
						<Icon name="paw" size={12} /> {t('panels.journal.eatenBy')}
					</span>
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
	const { observe, addGoal, state } = useGame();
	// Adding an undiscovered animal makes a single "Attract a mystery {kind}" goal
	// whose hover box shows the habitat checklist (0/1 rock pile, …). addGoal
	// handles the concurrent cap + dedupe + toast.
	const addAttractGoal = () => {
		void addGoal({ kind: 'attract', animalId: animal.id, target: 1 });
	};
	const alreadyGoal = (state?.customGoals || []).some((g) => g.kind === 'attract' && g.animalId === animal.id);
	// No "set this as a goal" button until the player has actually unlocked
	// goal-setting — see customGoalsUnlocked().
	const canSetGoals = customGoalsUnlocked(state);
	if (!disc) {
		return (
			<div className="journal-entry entry-unknown">
				<div className="silhouette">
					<img className="ani-thumb" src={animalSpriteDataUri(animal.id, animal.kind, { silhouette: true })} alt="" />
				</div>
				<div className="grow">
					<b>{t('panels.journal.unknownEntry', { kind: content('animal', animal.id, 'kind', animal.kind) })}</b>{' '}
					<span className="muted small">({content('animal', animal.id, 'rarity', animal.rarity)})</span>
					<RequirementHints animal={animal} full={full} />
				</div>
				{canSetGoals && (
					<button
						className="icon-btn subtle add-goal-btn"
						disabled={alreadyGoal}
						title={alreadyGoal ? t('panels.goals.alreadyAdded') : t('panels.journal.addGoal')}
						aria-label={alreadyGoal ? t('panels.goals.alreadyAdded') : t('panels.journal.addGoal')}
						onClick={addAttractGoal}
					>
						<Icon name="target" size={14} />
					</button>
				)}
			</div>
		);
	}
	const c = comfortLabel(disc.comfort);
	const animalName = content('animal', animal.id, 'name', animal.name);
	const diet = animal.diet ? content('animal', animal.id, 'diet', animal.diet) : '';
	return (
		<button
			className="journal-entry entry-link"
			onClick={() => {
				void observe(animal.id);
			}}
		>
			<div className="silhouette known">
				<img className="ani-thumb" src={animalSpriteDataUri(animal.id, animal.kind)} alt={animalName} />
			</div>
			<div className="grow">
				<div className="entry-title">
					<b>{animalName}</b>
					<TrophicBadge trophic={animal.trophic} />
				</div>
				<div className="muted small entry-sub">
					{animal.scientificName && <em>{animal.scientificName}</em>}
					<span className={`comfort comfort-${c}`}>{comfortText(disc.comfort)}</span>
				</div>
				{/* The text gets its own element rather than sitting as a bare node in the
				    flex row: an anonymous flex item can't be given wrapping or shrinking
				    rules, which is how the Great Horned Owl's diet line ended up pushing
				    straight out of the card. */}
				{animal.diet && (
					<div className="muted small entry-meta">
						<Icon name="leaf" size={11} />
						<span className="entry-meta-text">
							{t('panels.journal.eatsDiet', { diet: diet.charAt(0).toLowerCase() + diet.slice(1) })}
						</span>
					</div>
				)}
				{animal.preferredHabitat && (
					<div className="muted small entry-meta">
						<Icon name="home" size={11} />
						<span className="entry-meta-text">
							{content('animal', animal.id, 'preferredHabitat', animal.preferredHabitat)}
						</span>
					</div>
				)}
			</div>
			<Icon name="forward" size={16} className="entry-chevron" />
		</button>
	);
}

/**
 * What every role in the web actually does, and how much of this area's set is
 * home. The food-web view answers "who eats whom"; this one answers the question
 * underneath it — why an area with plenty of animals can still be unbalanced,
 * because balance is about which JOBS are filled, not how many species returned.
 * Roles with nobody in them here are left out rather than shown empty.
 */

function RolesView({ animals, discs }: { animals: AnimalDef[]; discs: Map<string, Discovery> }) {
	const { observe } = useGame();
	const roleOf = (a: AnimalDef) => (a.trophic && TROPHIC[a.trophic] ? a.trophic : 'wildlife');
	const groups = new Map<string, AnimalDef[]>();
	for (const a of animals) {
		const k = roleOf(a);
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push(a);
	}
	// Top of the web first: an apex predator is the role players are usually
	// chasing, and reading down from it mirrors the food-web view above.
	const order = [...groups.keys()].sort((x, y) => {
		const tx = TROPHIC[x]?.tier ?? 2;
		const ty = TROPHIC[y]?.tier ?? 2;
		return ty - tx || trophicInfo(x).label.localeCompare(trophicInfo(y).label);
	});
	if (!animals.length) return <p className="muted small">{t('panels.journal.rolesEmpty')}</p>;

	return (
		<div className="roles-view">
			<p className="muted small">{t('panels.journal.rolesIntro')}</p>
			{order.map((key) => {
				const list = groups.get(key)!;
				const info = trophicInfo(key);
				const back = list.filter((a) => discs.has(a.id)).length;
				return (
					<div key={key} className="role-row" style={{ borderLeftColor: info.color }}>
						<div className="role-head">
							<span className="trophic-badge" style={{ background: info.color }}>
								<Icon name="scales" size={11} /> {info.label}
							</span>
							<span className="muted small">{t('panels.journal.rolesCount', { back, total: list.length })}</span>
						</div>
						<div className="small">{t(`panels.journal.trophicAbout.${key}`)}</div>
						<div className="role-members">
							{list.map((a) => {
								const seen = discs.has(a.id);
								return (
									<button
										key={a.id}
										className={`foodweb-node ${seen ? '' : 'foodweb-node-unknown'}`}
										style={seen ? { borderColor: info.color } : undefined}
										onClick={() => seen && void observe(a.id)}
										disabled={!seen}
									>
										{seen ? content('animal', a.id, 'name', a.name) : '???'}
									</button>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}

/**
 * A layered food-web diagram for one biome: producers at the bottom, apex
 * predators at the top. Discovered animals light up; the rest are silhouettes.
 */
function FoodWebView({ animals, discs }: { animals: AnimalDef[]; discs: Map<string, Discovery> }) {
	const { observe } = useGame();
	const openCard = (id: string) => {
		void observe(id);
	}; // reading the entry = observing
	const tiers: { label: string; test: (a: AnimalDef) => boolean }[] = [
		{ label: t('panels.journal.tiers.apex'), test: (a) => a.trophic === 'apex-predator' },
		{ label: t('panels.journal.tiers.mid'), test: (a) => a.trophic === 'mesopredator' },
		{
			label: t('panels.journal.tiers.omnivores'),
			test: (a) => a.trophic === 'omnivore' || a.trophic === 'insectivore' || a.trophic === 'scavenger',
		},
		{
			label: t('panels.journal.tiers.herbivores'),
			test: (a) => a.trophic === 'herbivore' || a.trophic === 'filter-feeder',
		},
		{
			label: t('panels.journal.tiers.producers'),
			test: (a) => a.trophic === 'producer' || a.trophic === 'decomposer' || a.trophic === 'detritivore',
		},
	];
	const placed = new Set<string>();
	const rows = tiers.map((tr) => {
		const list = animals.filter((a) => tr.test(a) && !placed.has(a.id));
		list.forEach((a) => placed.add(a.id));
		return { ...tr, list };
	});
	const leftover = animals.filter((a) => !placed.has(a.id));
	if (leftover.length) rows[2].list.push(...leftover);
	const returnedCount = animals.filter((a) => discs.has(a.id)).length;

	return (
		<div className="foodweb-view">
			<p className="muted small">
				{t('panels.journal.foodWebIntro', { returned: returnedCount, total: animals.length })}
			</p>
			{rows.map((r) =>
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
										title={
											seen
												? content('animal', a.id, 'name', a.name)
												: t('panels.journal.undiscovered', { kind: content('animal', a.id, 'kind', a.kind) })
										}
									>
										<img className="ani-thumb" src={animalSpriteDataUri(a.id, a.kind, { silhouette: !seen })} alt="" />
										<span>{seen ? content('animal', a.id, 'name', a.name) : '???'}</span>
									</button>
								);
							})}
						</div>
					</div>
				) : null,
			)}
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
	const openCard = (id: string) => {
		void observe(id);
	}; // reading the entry = observing
	const order = new Map(data.biomes.map((b) => [b.id, b.order]));
	const biomeName = (id: string) => {
		const b = data.biomes.find((bb) => bb.id === id);
		return b ? content('biome', b.id, 'name', b.name) : id;
	};
	const q = query.trim().toLowerCase();
	const returned = state.discoveries
		.map((d) => data.animals.find((a) => a.id === d.animalId))
		.filter((a): a is AnimalDef => !!a)
		.filter(
			(a) =>
				!q ||
				[content('animal', a.id, 'name', a.name), a.kind, a.biome, a.trophic || ''].join(' ').toLowerCase().includes(q),
		)
		.sort((a, b) => content('animal', a.id, 'name', a.name).localeCompare(content('animal', b.id, 'name', b.name)));

	if (!state.discoveries.length) {
		return (
			<p className="muted small overview-empty">
				<Icon name="paw" size={14} /> {t('panels.journal.overviewEmpty')}
			</p>
		);
	}
	if (!returned.length) return <p className="muted small">{t('panels.journal.noMatch')}</p>;

	return (
		<div className="overview-grid">
			{returned.map((a) => (
				<button
					key={a.id}
					className="overview-card"
					onClick={() => openCard(a.id)}
					title={t('panels.journal.openEntry', { name: content('animal', a.id, 'name', a.name) })}
				>
					<img className="ani-thumb" src={animalSpriteDataUri(a.id, a.kind)} alt="" />
					<span className="overview-name">{content('animal', a.id, 'name', a.name)}</span>
					<span className="overview-biome">
						<Icon name="leaf" size={10} /> {biomeName(a.biome)}
					</span>
					<TrophicBadge trophic={a.trophic} />
				</button>
			))}
		</div>
	);
}

export function JournalPanel() {
	const { data, state, setPanel, setAnimalCardId } = useGame();
	const { t, content } = useI18n();
	// 'overview' shows every returned animal; otherwise a biome id is selected.
	// Opening the journal lands on the area you are standing in — that is nearly
	// always what you want to read about. The one thing worth remembering is a
	// preference for "All animals": if that is where you were last, stay there.
	const cur = journalNav.current();
	const openTab = () => (cur?.kind === 'view' && cur.tab === 'overview' ? 'overview' : state?.player.area || 'meadow');
	const [tab, setTab] = useState<string>(openTab);
	const [view, setView] = useState<'list' | 'web' | 'roles'>(cur?.kind === 'view' ? cur.view : 'list');
	const [unknownFirst, setUnknownFirst] = useState(() => {
		try {
			return localStorage.getItem('wild-willows:journal-unknown-first') === '1';
		} catch {
			return false;
		}
	});
	const [query, setQuery] = useState('');
	// Every tab/view you land on becomes a stop on the history trail. Visits
	// triggered BY back/forward match the current stop and are no-ops.
	useEffect(() => {
		journalNav.visit({ kind: 'view', tab, view });
	}, [tab, view]);
	// Walking into another area re-points the journal at it, unless you have
	// deliberately parked on "All animals".
	const area = state?.player.area;
	useEffect(() => {
		if (area && tab !== 'overview' && tab !== area) setTab(area);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [area]);
	// When back/forward (here or on an animal card) retargets a list/web stop,
	// steer the open panel there.
	useEffect(
		() =>
			journalNav.subscribe(() => {
				const loc = journalNav.current();
				if (loc?.kind === 'view') {
					setTab(loc.tab);
					setView(loc.view);
				}
			}),
		[],
	);
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
			const hay = [
				a.kind,
				a.rarity,
				a.trophic || '',
				known ? content('animal', a.id, 'name', a.name) : 'unknown',
				known ? '' : 'undiscovered',
			]
				.join(' ')
				.toLowerCase();
			return hay.includes(q);
		})
		.sort((a, b) => {
			const da = discs.get(a.id),
				db = discs.get(b.id);
			// Found and not-yet-found stay grouped.
			if (!!da !== !!db) return (da ? -1 : 1) * (unknownFirst ? -1 : 1);
			// Found entries go A-Z by the name the player actually sees, so a species
			// they remember is easy to look up. Not-yet-found entries have no name to
			// look up — they all read "???" — so alphabetical there would be sorting
			// by a secret. They go easiest-first instead, which turns the unknown half
			// of the guide into a to-do list: on a fresh save the top of Willow Meadow
			// is the grasshopper, and working down the list is the intended run of play.
			if (!da && !db) return effort(a) - effort(b) || a.name.localeCompare(b.name);
			return content('animal', a.id, 'name', a.name).localeCompare(content('animal', b.id, 'name', b.name));
		});
	const returned = allInTab.filter((a) => discs.has(a.id)).length;

	const tabBiome = biomes.find((b) => b.id === tab);
	const tabBiomeName = tabBiome ? content('biome', tabBiome.id, 'name', tabBiome.name) : undefined;
	// Two gates, one per book: the field guide opens the animal pages, the
	// expanded edition spells out what each animal is waiting for.
	const tools = state.player.tools;
	const full = !!tabBiome && hasGuide(tools, tabBiome.id);
	const expanded = !!tabBiome && hasExpandedGuide(tools, tabBiome.id);
	/** The name a guide is PRINTED under, owned or not — this is the heading of a
	 *  section of the journal, not a receipt for what the player has bought. */
	const guideName = (toolId: string) => {
		const n = data.tools.find((tl) => tl.id === toolId)?.tiers.find((tt) => tt.tier === 2)?.name;
		return n ? content('tool', toolId, 'tiers.2.name', n) : undefined;
	};
	const tabGuideName = isOverview
		? t('panels.journal.title')
		: (tabBiome && guideName(guideToolId(tabBiome.id))) ||
			t('panels.journal.fieldGuide', { biome: tabBiomeName || t('panels.journal.fieldFallback') });
	const totalReturned = state.discoveries.length;

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide journal-panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="journal" size={20} /> {tabGuideName}{' '}
						<span className="guide-count">
							({isOverview ? totalReturned : returned}/{isOverview ? data.animals.length : allInTab.length})
						</span>
					</h2>
					<div className="panel-head-actions">
						{/* view stops are applied by the subscription above; an animal stop opens its card over the journal */}
						<HistoryNav
							go={(loc) => {
								if (loc?.kind === 'animal') setAnimalCardId(loc.id);
							}}
						/>
						<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('panels.common.close')}>
							<Icon name="close" />
						</button>
					</div>
				</div>

				{/* Places sit in one horizontal, scrollable row so no tab gets cut off. */}
				<div className="tabs tabs-scroll">
					<button className={isOverview ? 'on' : ''} onClick={() => setTab('overview')}>
						<Icon name="paw" size={12} /> {t('panels.journal.allAnimals')}
					</button>
					{biomes.map((b) => {
						const locked = !state.player.unlockedBiomes.includes(b.id);
						const bName = content('biome', b.id, 'name', b.name);
						return (
							<button
								key={b.id}
								className={`${tab === b.id ? 'on' : ''} ${locked ? 'tab-locked' : ''}`}
								onClick={() => !locked && setTab(b.id)}
								disabled={locked}
								title={locked ? t('panels.journal.lockedTab', { biome: bName }) : bName}
							>
								{bName}
								{locked && <Icon name="lock" size={11} />}
							</button>
						);
					})}
				</div>

				<div className="panel-body">
					{/* Controls: view toggles on the first line, then the search box on its
					    own full-width line so it never gets clipped. The returned/total
					    tally lives in the heading now — as a sentence here it wrapped onto
					    a second row and shoved the view switch down. */}
					<div className="journal-controls">
						<div className="journal-controls-top">
							{!isOverview && view === 'list' && (
								<button
									className={`chip-toggle ${unknownFirst ? 'on' : ''}`}
									onClick={() =>
										setUnknownFirst((v) => {
											const nv = !v;
											try {
												localStorage.setItem('wild-willows:journal-unknown-first', nv ? '1' : '0');
											} catch {
												/* ignore */
											}
											return nv;
										})
									}
									title={t('panels.journal.unknownFirstTitle')}
								>
									<Icon name="paw" size={12} /> {t('panels.journal.unknownFirst')}
								</button>
							)}
							<span className="grow" />
							{!isOverview && (
								<div className="view-switch" role="tablist">
									<button
										className={view === 'list' ? 'on' : ''}
										onClick={() => setView('list')}
										title={t('panels.journal.entriesTitle')}
									>
										<Icon name="journal" size={12} /> {t('panels.journal.entries')}
									</button>
									<button
										className={view === 'web' ? 'on' : ''}
										onClick={() => setView('web')}
										title={t('panels.journal.foodWebTitle')}
									>
										<Icon name="scales" size={12} /> {t('panels.journal.foodWeb')}
									</button>
									<button
										className={view === 'roles' ? 'on' : ''}
										onClick={() => setView('roles')}
										title={t('panels.journal.rolesTitle')}
									>
										<Icon name="leaf" size={12} /> {t('panels.journal.roles')}
									</button>
								</div>
							)}
						</div>
						{(isOverview || view === 'list') && (
							<input
								className="craft-search journal-search"
								type="search"
								placeholder={t('panels.journal.searchPlaceholder')}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								autoComplete="off"
								aria-label={t('panels.journal.searchAria')}
							/>
						)}
					</div>

					{/* One line at a time, and always the NEXT book: offering both at once
					    turns a nudge into a price list. */}
					{!isOverview && !full && (
						<div className="guide-upsell small">
							<Icon name="lock" size={13} />
							<span>{t('panels.journal.upsell', { biome: tabBiomeName || '' })}</span>
						</div>
					)}
					{!isOverview && full && !expanded && (
						<div className="guide-upsell small">
							<Icon name="lock" size={13} />
							<span>{t('panels.journal.upsellExpanded', { biome: tabBiomeName || '' })}</span>
						</div>
					)}

					{isOverview ? (
						<OverviewGrid query={query} />
					) : view === 'web' ? (
						<FoodWebView animals={allInTab} discs={discs} />
					) : view === 'roles' ? (
						<RolesView animals={allInTab} discs={discs} />
					) : (
						<>
							{animals.length === 0 && <p className="muted small">{t('panels.journal.noMatch')}</p>}
							<div className="entry-list">
								{animals.map((a) => (
									<JournalEntry key={a.id} animal={a} disc={discs.get(a.id)} full={expanded} />
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
	const nameOf = (id: string) => {
		const a = animals.find((aa) => aa.id === id);
		return a ? content('animal', a.id, 'name', a.name) : id;
	};
	const prereqs = (animal.requirements?.animals || []).filter((id) => returned.has(id));
	const dependents = animals
		.filter((a) => returned.has(a.id) && (a.requirements?.animals || []).includes(animal.id))
		.map((a) => a.id);
	const list = (ids: string[]) => {
		const names = ids.map(nameOf);
		return names.length <= 1
			? names[0]
			: names.slice(0, -1).join(', ') + ` ${t('panels.journal.cond.and')} ` + names[names.length - 1];
	};
	// `count` picks the singular/plural form: one neighbour reads "the Tree Squirrel
	// WAS already here", several read "were". English only needs it on the first
	// line ("followed" is invariant), but Spanish conjugates both, so both keys are
	// plural pairs.
	if (prereqs.length) return t('panels.journal.neighborsAfter', { list: list(prereqs), count: prereqs.length });
	if (dependents.length)
		return t('panels.journal.neighborsFollowed', { list: list(dependents), count: dependents.length });
	return null;
}

/**
 * "Why it returned" — recomputed at render time in the CURRENT language. The
 * copy persisted on the Discovery row is frozen in whatever language was
 * active when the animal came back (old saves: English), so we don't display
 * it. Mirrors the server's whyReturnedText (server/resources.ts) — it's a pure
 * function of the animal's static requirements — but resolves object/animal
 * names through the content overlay and weather/season/day-phase ids through
 * their localized labels.
 */
function whyReturnedLine(animal: AnimalDef, data: GameData): string {
	const req = (animal.requirements || {}) as any;
	const parts: string[] = [];
	const objName = (id: string) => {
		const def = data.habitatObjects.find((o) => o.id === id);
		return def ? content('habitatObject', def.id, 'name', def.name) : id;
	};
	const animalName = (id: string) => {
		const a = data.animals.find((aa) => aa.id === id);
		return a ? content('animal', a.id, 'name', a.name) : id;
	};
	const objs = Object.entries(req.objects || {}).map(([id, q]) =>
		t('server.whyReturned.objectQty', { qty: q as number, name: objName(id) }),
	);
	if (objs.length) parts.push(t('server.whyReturned.habitat', { objects: objs.join(t('server.list.comma')) }));
	if (req.water) {
		const w = req.water;
		if (w.lake) parts.push(t('server.whyReturned.lake', { tiles: w.lake }));
		else if (w.river) parts.push(t('server.whyReturned.river', { tiles: w.river }));
		else if (w.tiles) parts.push(t('server.whyReturned.tiles', { tiles: w.tiles }));
	}
	if (req.minHealth) parts.push(t('server.whyReturned.health', { health: req.minHealth }));
	if (req.minBalance) parts.push(t('server.whyReturned.balance', { balance: req.minBalance }));
	if (req.animals?.length) {
		parts.push(t('server.whyReturned.animals', { animals: req.animals.map(animalName).join(t('server.list.and')) }));
	}
	const cond = req.conditions;
	if (cond) {
		const bits: string[] = [];
		if (cond.weather?.length)
			bits.push(cond.weather.map((w: string) => content('weather', w, 'name', w)).join(t('server.list.or')));
		if (cond.season?.length)
			bits.push(
				t('server.whyReturned.inSeason', {
					seasons: cond.season
						.map((s: string) => content('weather', `season.${s}`, 'label', s))
						.join(t('server.list.or')),
				}),
			);
		if (cond.dayPhase?.length)
			bits.push(
				t('server.whyReturned.atPhase', {
					phases: cond.dayPhase
						.map((p: string) => content('weather', `dayPhase.${p}`, 'label', p))
						.join(t('server.list.or')),
				}),
			);
		if (bits.length) parts.push(t('server.whyReturned.moment', { conditions: bits.join(t('server.list.comma')) }));
	}
	return t('server.whyReturned.sentence', { reasons: parts.join(t('server.list.comma')) });
}

export function AnimalCard() {
	const { data, state, animalCardId, setAnimalCardId, setPanel } = useGame();
	const { t, content } = useI18n();
	// every card you open becomes a stop on the journal's history trail
	useEffect(() => {
		if (animalCardId) journalNav.visit({ kind: 'animal', id: animalCardId });
	}, [animalCardId]);
	if (!data || !state || !animalCardId) return null;
	const animal = data.animals.find((a) => a.id === animalCardId);
	const disc = state.discoveries.find((d) => d.animalId === animalCardId);
	if (!animal) return null;
	const returnedIds = new Set(state.discoveries.map((d) => d.animalId));
	const neighbors = disc ? neighborsNote(animal, data.animals, returnedIds) : null;
	// The card IS the thing the field guide buys — role, food web, when they're
	// about, the habitat they keep. (The exact requirements are the expanded
	// edition's, and they live on the list entry, not here.)
	const full = hasGuide(state.player.tools, animal.biome);
	const cardBiome = data.biomes.find((b) => b.id === animal.biome);
	const biomeName = cardBiome ? content('biome', cardBiome.id, 'name', cardBiome.name) : undefined;
	const animalName = content('animal', animal.id, 'name', animal.name);
	const close = () => {
		setAnimalCardId(null);
		setPanel(null);
	};
	const backToJournal = () => {
		setAnimalCardId(null);
		setPanel('journal');
	};
	// Back/forward retrace your actual trail through the journal — earlier
	// cards, biome lists, food webs, the overview — like browser history.
	const go = (loc: JournalLoc | undefined) => {
		if (!loc) return;
		if (loc.kind === 'animal') {
			setAnimalCardId(loc.id);
		} else {
			// a list/web stop: close the card and surface the journal; the panel
			// (mounted or fresh) picks the tab/view up from the history trail
			setAnimalCardId(null);
			setPanel('journal');
		}
	};
	return (
		<div className="panel-backdrop" onClick={close}>
			<div className="panel animal-card" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="paw" size={20} /> {animalName}
					</h2>
					<div className="panel-head-actions">
						<HistoryNav go={go} />
						<button className="icon-btn" onClick={close} aria-label={t('panels.common.close')}>
							<Icon name="close" />
						</button>
					</div>
				</div>
				<div className="panel-body">
					{/* Header block: portrait, scientific name, and the key tags. */}
					<div className="card-hero">
						<img
							className="ani-thumb-lg"
							src={animalSpriteDataUri(animal.id, animal.kind, { silhouette: !disc })}
							alt={animalName}
						/>
						{animal.scientificName && <p className="sci-name-lg">{animal.scientificName}</p>}
						<p className="muted card-meta">
							<span className="card-biome">
								<Icon name="leaf" size={11} /> {biomeName}
							</span>
							<span className="dot">·</span>
							{content('animal', animal.id, 'kind', animal.kind)}
							<span className="dot">·</span>
							{content('animal', animal.id, 'rarity', animal.rarity)}
						</p>
						<div className="card-badges">
							<TrophicBadge trophic={animal.trophic} />
							{disc && (
								<span className={`comfort comfort-${comfortLabel(disc.comfort)}`}>
									{t('panels.journal.comfortBadge', { label: comfortText(disc.comfort), comfort: disc.comfort })}
								</span>
							)}
						</div>
					</div>

					{disc && (
						<p className="muted small card-seen">
							{t('panels.journal.observed', {
								count: disc.timesObserved,
								date: new Date(disc.firstObservedAt).toLocaleDateString(),
							})}
						</p>
					)}
					{disc && disc.comfort < 90 && Object.keys(animal.requirements?.objects || {}).length > 0 && (
						<p className="muted small card-seen">
							<Icon name="leaf" size={11} />{' '}
							{t('panels.journal.comfortGrows', {
								items: Object.keys(animal.requirements.objects || {})
									.map((id) => {
										const o = data?.habitatObjects.find((oo) => oo.id === id);
										return o ? content('habitatObject', o.id, 'name', o.name) : id;
									})
									.join(', '),
							})}
						</p>
					)}
					{neighbors && (
						<p className="neighbors-note small">
							<Icon name="paw" size={13} />{' '}
							<span>
								<b>{t('panels.journal.neighborsLabel')}</b> {neighbors}
							</span>
						</p>
					)}

					{full ? (
						<>
							{animal.role && (
								<div className="card-section">
									<h3>
										<Icon name="scales" size={14} /> {t('panels.journal.roleTitle')}
									</h3>
									<p>{content('animal', animal.id, 'role', animal.role)}</p>
								</div>
							)}
							{animal.eats?.length || animal.eatenBy?.length || animal.eatsOther?.length ? (
								<div className="card-section">
									<h3>
										<Icon name="paw" size={14} /> {t('panels.journal.foodWeb')}
									</h3>
									<FoodWebLinks animal={animal} />
								</div>
							) : null}
							{activityNotes(animal).length > 0 && (
								<div className="card-section">
									<h3>
										<Icon name="sun" size={14} /> {t('panels.journal.whenToSpot')}
									</h3>
									{activityNotes(animal).map((n, i) => (
										<p key={i} className="card-fact">
											<Icon name={n.icon} size={12} /> {n.text}
										</p>
									))}
								</div>
							)}
							<div className="card-section">
								<h3>
									<Icon name="leaf" size={14} /> {t('panels.journal.habitatTitle')}
								</h3>
								<p className="card-fact">
									<b>{t('panels.journal.shelterLabel')}</b> {content('animal', animal.id, 'shelter', animal.shelter)}
								</p>
								<p className="card-fact">
									<b>{t('panels.journal.preferredLabel')}</b>{' '}
									{content('animal', animal.id, 'preferredHabitat', animal.preferredHabitat)}
								</p>
								{disc && <p className="muted small">{whyReturnedLine(animal, data)}</p>}
							</div>
							<p className="fact">
								<Icon name="leaf" size={14} /> <b>{t('panels.journal.fieldNote')}</b>{' '}
								{content('animal', animal.id, 'fact', animal.fact)}
							</p>
							<SourceList animal={animal} />
							<button className="link" onClick={backToJournal}>
								{t('panels.journal.backToJournal')}
							</button>
						</>
					) : (
						<>
							<p className="muted">
								<Icon name="lock" size={14} /> {t('panels.journal.lockedCard', { biome: biomeName || '' })}
							</p>
							<button className="link" onClick={backToJournal}>
								{t('panels.journal.backToJournal')}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

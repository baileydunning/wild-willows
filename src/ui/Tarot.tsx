// The tarot deck on the table.
//
// Two ways in, because they are two different things to want. "What tarot is"
// is a short illustrated book — what a deck is made of, how a reading actually
// works, what the suits and the numbers and the court cards mean — and you can
// read the whole of it without ever drawing a card. "Sit for a reading" picks a
// spread, shuffles, and deals face-down; you turn the cards over one at a time
// and each one tells you what it means IN THE SEAT IT LANDED IN, which is the
// part a list of card meanings can never teach you.
//
// No unlocks, nothing to grind, no score. The one thing that IS kept is the
// spread you had open: close the panel, walk off, come back, and the same three
// cards are on the table turned exactly as far as you left them. It is stored in
// this browser rather than in the save (see SavedReading in ui/arcana.ts). That is
// also the honest design for a tarot deck — a reading kept and scored would turn
// a prompt for thinking into a prediction to be right or wrong about, and the
// guide says in as many words that the cards do not know anything.
//
// The one piece of state worth guarding is the shuffle. A reading lives in a
// seed, not in a list, so every re-render — a hover, a language switch, a window
// resize — deals exactly the same cards. Only the shuffle button changes them.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';
import {
	COURT,
	GUIDE_PAGES,
	NUMBERS,
	SPREADS,
	SUITS,
	cardText,
	cardDef,
	courtGloss,
	courtName,
	courtText,
	deal,
	elementName,
	gist,
	guideBody,
	guideTitle,
	loadReading,
	majorGloss,
	newSeed,
	numberGloss,
	numberName,
	numberText,
	saveReading,
	readingOf,
	seatName,
	seatReading,
	spreadBlurb,
	spreadDef,
	spreadName,
	suitGloss,
	suitKeywords,
	suitName,
	suitText,
	type Drawn,
} from './arcana';
import { CardBack, CardFace, CourtBadge, GuidePlate, SuitBadge, roman } from './arcanaArt';

type Mode = 'landing' | 'guide' | 'reading';

export function TarotPanel() {
	const { setPanel, state } = useGame();
	const { t } = useI18n();

	// The spread you had open last time, if there is one. Read once, on the way
	// in: after that this component owns the state and writes it back.
	const who = state?.player?.id || '';
	// A lazy state initializer rather than a ref: this is read during render, and
	// a ref read during render is the thing that stops being correct the moment
	// React renders twice.
	const [kept] = useState(() => loadReading(who));

	const [mode, setMode] = useState<Mode>('landing');
	const [page, setPage] = useState(0);
	const [spreadId, setSpreadId] = useState(kept?.spreadId ?? SPREADS[0].id);
	const [reversals, setReversals] = useState(kept?.reversals ?? false);
	// Dealt from the moment you sit down. An empty table with a shuffle button on
	// it is a step that asks for a click and shows nothing, so the three cards are
	// already face down and waiting; shuffling is for when you want a different
	// hand, not for getting a hand at all.
	const [seed, setSeed] = useState(() => kept?.seed ?? newSeed());
	// How many cards are face up. A COUNT rather than a set of indexes, because
	// the cards turn strictly left to right — see `canTurn` below — so "which are
	// up" and "how far along are you" are the same number, and a set would let
	// the two disagree.
	const [turned, setTurned] = useState(kept?.turned ?? 0);
	const [picked, setPicked] = useState<number | null>(kept?.picked ?? null);
	const seats = useRef<(HTMLButtonElement | null)[]>([]);

	const spread = spreadDef(spreadId);
	// The reading itself. Keyed on the seed, so nothing but a shuffle reshuffles.
	const drawn: Drawn[] = useMemo(
		() => (seed === null ? [] : deal(spread, { seed, reversals })),
		[spread, seed, reversals],
	);

	const shuffle = useCallback(() => {
		setSeed(newSeed());
		setTurned(0);
		setPicked(null);
	}, []);

	/**
	 * Turn the next card.
	 *
	 * IN ORDER, always. A spread is read left to right and each seat sets up the
	 * next one, so turning the outcome before the situation is not a shortcut, it
	 * is reading the last page first. Only the leftmost face-down card responds;
	 * the ones behind it are already turned and the ones ahead of it are inert.
	 */
	const turnNext = useCallback(
		(i: number) => {
			if (i !== turned) return;
			setTurned(i + 1);
			setPicked(i);
			// Move the focus along with the reading, so a keyboard player carries
			// straight on rather than tabbing back to where they were.
			requestAnimationFrame(() => seats.current[i + 1]?.focus());
		},
		[turned],
	);

	// Changing the spread or the reversals rule deals a fresh hand rather than
	// re-labeling the one on the table: a spread that half-changed under you is
	// worse than a new one. Done at the two places that change them rather than in
	// an effect watching them, so it is part of the action and not a render after.
	const redeal = shuffle;

	// Written on every change rather than on the way out. Closing a panel is not
	// the only way to leave one: the Escape chain, a click on the backdrop and
	// walking away from the table all unmount this, and an unmount effect would
	// have to catch every one of them to be worth trusting.
	useEffect(() => {
		saveReading(who, { spreadId, reversals, seed, turned, picked });
	}, [who, spreadId, reversals, seed, turned, picked]);

	/** Left and right walk the cards that are actually reachable: the ones already
	 *  turned, plus the one you may turn next. The world does not move while a
	 *  panel is open (WorldScene.handleMovement checks bridge.shared.uiBlocking),
	 *  but Phaser still has the arrows at the window and the panel body would
	 *  scroll, so the handler stops the event here. Escape is left alone: App's
	 *  close chain owns it. */
	const onSeatKey = (e: React.KeyboardEvent, i: number) => {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		e.preventDefault();
		const last = Math.min(turned, drawn.length - 1);
		seats.current[Math.max(0, Math.min(last, i + step))]?.focus();
	};

	const close = () => setPanel(null);
	const guide = GUIDE_PAGES[page];
	const shown = picked !== null && picked < turned ? drawn[picked] : null;

	return (
		<div className="panel-backdrop" onClick={close}>
			{/* The three screens want three different widths. The landing is a picture
			    and two doors and looks abandoned in a wide frame; the guide is a book
			    sized for a readable measure beside its contents rail; the table holds
			    three cards side by side. */}
			<div className={`panel panel-wide tarot-panel at-${mode}`} onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					{/* Back belongs beside the title, not floating in the middle of the bar.
					    `.panel-head` is space-between, so a third child between the heading
					    and the close button gets centered by the layout; grouping it with the
					    heading is what keeps it on the left. */}
					<div className="tarot-head-left">
						<h2>
							<Icon name="sparkle" size={20} /> {t('panels.tarot.title')}
						</h2>
						{mode !== 'landing' && (
							<button
								className="icon-btn"
								onClick={() => setMode('landing')}
								title={t('panels.tarot.backToTable')}
								aria-label={t('panels.tarot.backToTable')}
							>
								<Icon name="back" />
							</button>
						)}
					</div>
					<button className="icon-btn" onClick={close} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>

				<div className="panel-body tarot-body">
					{mode === 'landing' && (
						<div className="tarot-landing">
							<div className="tarot-landing-deck" aria-hidden="true">
								<span className="tarot-landing-card tarot-landing-card-a">
									<CardBack />
								</span>
								<span className="tarot-landing-card tarot-landing-card-b">
									<CardBack />
								</span>
								<span className="tarot-landing-card tarot-landing-card-c">
									<CardFace id="star" />
								</span>
							</div>
							<p className="tarot-lede">{t('panels.tarot.lede')}</p>
							<div className="tarot-doors">
								<button className="tarot-door" onClick={() => setMode('guide')}>
									<Icon name="journal" size={22} />
									<strong>{t('panels.tarot.learnTitle')}</strong>
									<span className="muted small">{t('panels.tarot.learnBlurb')}</span>
								</button>
								<button className="tarot-door" onClick={() => setMode('reading')}>
									<Icon name="moon" size={22} />
									<strong>{t('panels.tarot.readingTitle')}</strong>
									<span className="muted small">{t('panels.tarot.readingBlurb')}</span>
								</button>
							</div>
							<p className="muted small tarot-disclaimer">{t('panels.tarot.disclaimer')}</p>
						</div>
					)}

					{mode === 'guide' && (
						<div className="tarot-guide">
							{/* A contents list down the side rather than a strip of pills across
							    the top: ten chapters is too many to read as tabs, and a book is
							    what this is. */}
							<nav className="tarot-contents" aria-label={t('panels.tarot.guideNav')}>
								<span className="tarot-contents-head">{t('panels.tarot.contents')}</span>
								<ol>
									{GUIDE_PAGES.map((p, i) => (
										<li key={p.id}>
											<button
												className={`tarot-chapter ${i === page ? 'on' : ''}`}
												onClick={() => setPage(i)}
												aria-current={i === page ? 'page' : undefined}
											>
												<span className="tarot-chapter-n" aria-hidden="true">
													{i + 1}
												</span>
												<span className="tarot-chapter-name">{guideTitle(p.id)}</span>
											</button>
										</li>
									))}
								</ol>
							</nav>

							<article className="tarot-page">
								<GuidePlate page={guide.id} />
								<h3 className="tarot-page-title">{guideTitle(guide.id)}</h3>
								{guideBody(guide.id, guide.paras).map((para, i) => (
									<p key={i} className="tarot-para">
										{para}
									</p>
								))}

								{guide.id === 'suits' && (
									<div className="tarot-blocks">
										{SUITS.map(({ id, element }) => (
											<div key={id} className="tarot-block">
												<SuitBadge suit={id} size={34} />
												<div>
													<h4>
														{suitName(id)} <span className="tarot-block-tag">{elementName(element)}</span>
													</h4>
													<p className="tarot-keywords">{suitKeywords(id)}</p>
													<p className="tarot-para">{suitText(id)}</p>
												</div>
											</div>
										))}
									</div>
								)}

								{guide.id === 'numbers' && (
									<div className="tarot-numbers">
										{NUMBERS.map((n) => (
											<div key={n} className="tarot-number">
												<span className="tarot-number-mark" aria-hidden="true">
													{n}
												</span>
												<div>
													<h4>{numberName(n)}</h4>
													<p className="tarot-para">{numberText(n)}</p>
												</div>
											</div>
										))}
									</div>
								)}

								{guide.id === 'court' && (
									<div className="tarot-blocks">
										{COURT.map((rank) => (
											<div key={rank} className="tarot-block">
												<CourtBadge rank={rank} size={34} />
												<div>
													<h4>{courtName(rank)}</h4>
													<p className="tarot-para">{courtText(rank)}</p>
												</div>
											</div>
										))}
									</div>
								)}

								<div className="tarot-pager">
									<button
										className="icon-btn"
										disabled={page === 0}
										onClick={() => setPage((p) => Math.max(0, p - 1))}
										title={t('panels.tarot.prev')}
										aria-label={t('panels.tarot.prev')}
									>
										<Icon name="back" />
									</button>
									<span className="muted small">
										{t('panels.tarot.pageOf', { n: page + 1, total: GUIDE_PAGES.length })}
									</span>
									<button
										className="icon-btn"
										disabled={page >= GUIDE_PAGES.length - 1}
										onClick={() => setPage((p) => Math.min(GUIDE_PAGES.length - 1, p + 1))}
										title={t('panels.tarot.next')}
										aria-label={t('panels.tarot.next')}
									>
										<Icon name="forward" />
									</button>
								</div>
							</article>
						</div>
					)}

					{mode === 'reading' && (
						<div className="tarot-reading">
							<div className="tarot-setup">
								<label className="tarot-field">
									<span className="muted small">{t('panels.tarot.chooseSpread')}</span>
									<select
										value={spreadId}
										onChange={(e) => {
											setSpreadId(e.target.value);
											redeal();
										}}
									>
										{SPREADS.map((s) => (
											<option key={s.id} value={s.id}>
												{spreadName(s.id)}
											</option>
										))}
									</select>
								</label>
								<button
									className={`chip-toggle ${reversals ? 'on' : ''}`}
									onClick={() => {
										setReversals((r) => !r);
										redeal();
									}}
									aria-pressed={reversals}
									title={t('panels.tarot.reversalsHint')}
								>
									<Icon name="dice" size={14} /> {t('panels.tarot.reversals')}
								</button>
								<button className="primary tarot-shuffle" onClick={shuffle}>
									<Icon name="sparkle" size={15} />{' '}
									{turned === 0 ? t('panels.tarot.shuffle') : t('panels.tarot.reshuffle')}
								</button>
							</div>
							{/* No card count beside it any more: every spread deals three, so a chip
							    saying so on all three of them is furniture. */}
							<p className="muted small tarot-spread-blurb">{spreadBlurb(spreadId)}</p>

							<>
								<div className="tarot-table">
									{drawn.map((d, i) => {
										const seat = spread.seats[i];
										const isUp = i < turned;
										const isNext = i === turned;
										const text = cardText(d.id);
										return (
											<div
												key={`${seat}-${i}`}
												className={`tarot-seat ${picked === i ? 'on' : ''} ${isNext ? 'next' : ''} ${
													!isUp && !isNext ? 'waiting' : ''
												}`}
											>
												<button
													ref={(el) => {
														seats.current[i] = el;
													}}
													className={`tarot-card ${isUp ? 'up' : 'down'} ${d.reversed ? 'rev' : ''}`}
													// A card further along the row is inert rather than hidden: it is
													// plainly there, it just is not your turn yet.
													disabled={!isUp && !isNext}
													onClick={() => (isUp ? setPicked(i) : turnNext(i))}
													onFocus={() => isUp && setPicked(i)}
													onMouseEnter={() => isUp && setPicked(i)}
													onKeyDown={(e) => onSeatKey(e, i)}
													aria-label={
														isUp
															? t('panels.tarot.cardLabel', {
																	seat: seatName(seat),
																	card: text.name,
																	way: t(d.reversed ? 'panels.tarot.reversed' : 'panels.tarot.upright'),
																})
															: isNext
																? t('panels.tarot.faceDownLabel', { seat: seatName(seat) })
																: t('panels.tarot.notYetLabel', { seat: seatName(seat) })
													}
												>
													{isUp ? <CardFace id={d.id} reversed={d.reversed} /> : <CardBack />}
													{isUp && (
														// Deliberately NOT what the pane below says. The pane reads this card
														// in this seat, the way it landed; the tip is the card itself, both
														// of its faces at once, with the one in play marked. Hovering
														// teaches you the card; the pane tells you the reading.
														<span className="tarot-tip" role="tooltip">
															<strong>{text.name}</strong>
															<span className="tarot-tip-keys">{text.keywords}</span>
															<span className={`tarot-tip-side ${d.reversed ? '' : 'on'}`}>
																<em>{t('panels.tarot.light')}</em> {gist(text.upright)}
															</span>
															<span className={`tarot-tip-side ${d.reversed ? 'on' : ''}`}>
																<em>{t('panels.tarot.shadow')}</em> {gist(text.reversed)}
															</span>
														</span>
													)}
												</button>
												<span className="tarot-seat-name">{seatName(seat)}</span>
											</div>
										);
									})}
								</div>

								{/* The intention prompt lives here now that the table is dealt on
									    arrival: it is the first thing you read, and it is still the first
									    thing to do. */}
								<p className="tarot-actions muted small">
									{turned === 0
										? t('panels.tarot.beforeTurn', { seat: seatName(spread.seats[0]) })
										: turned < drawn.length
											? t('panels.tarot.turnNext', { seat: seatName(spread.seats[turned]) })
											: t('panels.tarot.allTurned')}
								</p>

								<div className="tarot-read">
									{shown ? (
										<>
											<div className="tarot-read-head">
												<h3 className="tarot-read-name">{cardText(shown.id).name}</h3>
												<span className={`tarot-way ${shown.reversed ? 'rev' : ''}`}>
													{t(shown.reversed ? 'panels.tarot.reversed' : 'panels.tarot.upright')}
												</span>
											</div>
											<p className="muted small tarot-byline">{cardText(shown.id).byline}</p>
											{/* The card in this seat, as one sentence. Not a label and a description
											    side by side: the frame belongs to the position and the phrase belongs
											    to the card, and together they make a different reading in every seat. */}
											<p className="tarot-seat-line">
												<Icon name="pin" size={14} /> {seatReading(shown.seat, shown.id, shown.reversed)}
											</p>
											{/* How the card is built, in the order it is built: the suit, then the
											    number, then what the two of them make. A Major has neither, and gets
											    the one thing worth saying about a Major instead. */}
											<CardParts id={shown.id} />
											<p className="tarot-whole">
												<span className="tarot-whole-label">{t('panels.tarot.wholeCard')}</span>
												{readingOf(shown)}
											</p>
										</>
									) : (
										<div className="tarot-read-empty">
											<Icon name="target" size={18} />
											<p className="muted small">{t('panels.tarot.turnHint')}</p>
										</div>
									)}
								</div>
							</>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * The anatomy of one card, above its reading.
 *
 * The point of showing this every time is that the deck is a system rather than
 * seventy-eight things to memorize. Six of Cups is the sixth stage of the
 * emotional suit, and once you have read what Cups are and what sixes do, you
 * had most of the meaning before the card said a word. A Major is the exception,
 * and says so: it belongs to no suit and its number is a place in a story.
 */
function CardParts({ id }: { id: string }) {
	const { t } = useI18n();
	const def = cardDef(id);
	if (!def) return null;

	if (def.arcana === 'major') {
		return (
			<div className="tarot-parts solo">
				<div className="tarot-part">
					<span className="tarot-part-mark major" aria-hidden="true">
						{roman(def.number)}
					</span>
					<div>
						<h4>{t('panels.tarot.majorLabel')}</h4>
						<p>{majorGloss()}</p>
					</div>
				</div>
			</div>
		);
	}

	const suit = def.suit!;
	const rank = def.rank!;
	const isCourt = COURT.includes(rank);
	return (
		<div className="tarot-parts">
			<div className="tarot-part">
				<SuitBadge suit={suit} size={30} />
				<div>
					<h4>
						{suitName(suit)} <span className="tarot-block-tag">{elementName(def.element)}</span>
					</h4>
					<p>{suitGloss(suit)}</p>
				</div>
			</div>
			<div className="tarot-part">
				{isCourt ? (
					<CourtBadge rank={rank} size={30} />
				) : (
					<span className="tarot-part-mark" aria-hidden="true">
						{def.number}
					</span>
				)}
				<div>
					<h4>{isCourt ? courtName(rank) : numberName(def.number)}</h4>
					<p>{isCourt ? courtGloss(rank) : numberGloss(def.number)}</p>
				</div>
			</div>
		</div>
	);
}

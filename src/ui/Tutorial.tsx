import { useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { isTypingTarget } from '../typing';
import { useI18n } from '../i18n/react';
import { useDraggable } from './useDraggable';
import { Icon } from './icons';
import { isTouchDevice } from './MobileControls';
import { DEMO } from '../demo';

interface StepDef {
	icon: string;
	/** Catalog key prefix — `.title`, `.text` and (optionally) `.touch` hang off it. */
	key: string;
	/** Whether the step has a touch-specific variant (`<key>.touch`). */
	hasTouch?: boolean;
	/** Which named chapter (1-based) this step belongs to. The card shows
	 *  "Chapter N of 4" + dots for the current chapter only, so a new caretaker
	 *  never faces an intimidating "step 1 of 18". */
	chapter: number;
	done: (args: { state: any; flags: Flags }) => boolean;
}

// The four named phases of the new-caretaker arc. Co-op intro steps fold into
// chapter 1. Labels live in panels.tutorial.chapters.*.
const CHAPTERS = [
	'panels.tutorial.chapters.moveGather',
	'panels.tutorial.chapters.healLand',
	'panels.tutorial.chapters.buildWelcome',
	'panels.tutorial.chapters.settleIn',
];

interface Flags {
	moved: boolean;
	gathered: boolean;
	openedBasket: boolean;
	openedCrafting: boolean;
	crafted: boolean;
	openedJournal: boolean;
	openedChest: boolean;
	openedPreserve: boolean;
	openedTools: boolean;
	openedPeople: boolean;
	openedWeather: boolean;
}

// Did the player craft a Grass Patch specifically? (the tutorial's first goal)
const hasGrassPatch = (state: any) =>
	(state?.player?.craftedEver?.['grass-patch'] || state?.player?.craftedItems?.['grass-patch'] || 0) > 0;
const grassPlaced = (state: any) => state?.placements?.some((p: any) => p.objectId === 'grass-patch');
const hasWateredBed = (state: any) => state?.terrain?.some((t: any) => t.type === 'watered' || t.type === 'water');
const hasPlanted = (state: any) => state?.placements?.some((p: any) => typeof p.plantedAt === 'number');
const openWaterTiles = (state: any) => state?.terrain?.filter((t: any) => t.type === 'water').length || 0;
const upgradedAnyTool = (state: any) =>
	Object.values(state?.player?.tools || {}).some((tier: any) => (tier as number) > 1);

// The tutorial is ordered as a natural new-caretaker arc: learn to move and
// gather, manage storage, work the land (terraform + plant), read the info
// panels, then put it all together — building toward the emotional payoff of
// welcoming your very first animal, the grasshopper, as the finale.
// Step copy lives in the panels.tutorial.* catalog keys.
// Co-op intro steps, prepended ahead of the normal new-caretaker arc. The HOST
// starts by learning how to invite friends; a JOINER (who can't invite) just gets
// a welcome that sets expectations about what's shared vs. personal.
const COOP_HOST_INTRO: StepDef[] = [
	{
		icon: 'user',
		key: 'panels.tutorial.coopHostInvite',
		hasTouch: true,
		chapter: 1,
		done: ({ flags }) => flags.openedPeople,
	},
	{
		icon: 'sparkle',
		key: 'panels.tutorial.coopHostTogether',
		hasTouch: true,
		chapter: 1,
		done: () => false, // info step — advance with Next
	},
];

const COOP_JOIN_INTRO: StepDef[] = [
	{
		icon: 'sparkle',
		key: 'panels.tutorial.coopJoinWelcome',
		hasTouch: true,
		chapter: 1,
		done: () => false, // info step — advance with Next
	},
];

// The linear tutorial is now ONE short guided loop — move, gather, craft, place,
// welcome your first animal — and nothing more. Everything else (home, journal,
// tools, bringing back more animals, terraforming) is taught just-in-time by the
// contextual tips in CoachTips.tsx, which pop up the first time you actually do
// each thing. Keeps the opening from being a wall of text. Copy is reused from
// the panels.tutorial.* catalog; the unused keys there now feed CoachTips + Help.
const BASE_STEPS: StepDef[] = [
	{
		icon: 'walk',
		key: 'panels.tutorial.welcome',
		hasTouch: true,
		chapter: 1,
		done: ({ flags }) => flags.moved,
	},
	{
		icon: 'help',
		key: 'panels.tutorial.navigate',
		hasTouch: true,
		chapter: 1,
		done: () => false,
	},
	{
		icon: 'sparkle',
		key: 'panels.tutorial.coreLoop',
		hasTouch: true,
		chapter: 1,
		done: () => false,
	},
	{
		icon: 'basket',
		key: 'panels.tutorial.gather',
		hasTouch: true,
		chapter: 1,
		done: ({ flags }) => flags.gathered,
	},
	{
		icon: 'hammer',
		key: 'panels.tutorial.crafting',
		hasTouch: true,
		chapter: 1,
		done: ({ flags }) => flags.openedCrafting,
	},
	{
		icon: 'sparkle',
		key: 'panels.tutorial.craftGrass',
		chapter: 1,
		done: ({ state }) => hasGrassPatch(state),
	},
	{
		icon: 'pin',
		key: 'panels.tutorial.placeGrass',
		hasTouch: true,
		chapter: 1,
		done: ({ state }) => grassPlaced(state),
	},
	{
		icon: 'paw',
		key: 'panels.tutorial.grasshopper',
		hasTouch: true,
		chapter: 1,
		done: ({ state }) => state?.discoveries?.some((d: any) => (d.timesObserved || 0) > 0),
	},
	// After the first animal, keep the loop going: terraform, plant, shape water,
	// then bring more of the meadow home.
	{
		icon: 'spade',
		key: 'panels.tutorial.land',
		hasTouch: true,
		chapter: 1,
		done: ({ state }) => hasWateredBed(state),
	},
	{
		icon: 'leaf',
		key: 'panels.tutorial.plant',
		hasTouch: true,
		chapter: 1,
		done: ({ state }) => hasPlanted(state),
	},
	{
		icon: 'drop',
		key: 'panels.tutorial.water',
		hasTouch: true,
		chapter: 1,
		done: ({ state }) => openWaterTiles(state) >= 3,
	},
	{
		icon: 'paw',
		key: 'panels.tutorial.moreAnimals',
		hasTouch: true,
		chapter: 1,
		done: () => false,
	},
];

const DONE_STEP = 99;

// Remember which step the player was on when they last closed the tutorial, so
// reopening it from the Help menu resumes there instead of starting over.
// Finishing the whole tutorial clears this (a replay then starts fresh at 0).
const TUT_POS_KEY = 'wild-willows:tutorial-pos';
function saveTutorialPos(step: number) {
	try {
		localStorage.setItem(TUT_POS_KEY, String(step));
	} catch {
		/* ignore */
	}
}
function clearTutorialPos() {
	try {
		localStorage.removeItem(TUT_POS_KEY);
	} catch {
		/* ignore */
	}
}
/** The step a Help-menu replay should resume from (0 if none saved). */
export function savedTutorialPos(): number {
	try {
		const v = localStorage.getItem(TUT_POS_KEY);
		const n = v == null ? 0 : parseInt(v, 10);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	} catch {
		return 0;
	}
}

// How long the "nice job!" check animation plays before we move on.
const CELEBRATE_MS = 850;

// The opening card stays up a good long while (30s) so new caretakers can read
// the intro before being whisked into the loop — even if they move right away.
// It never auto-advances before this, though the player can always click Next.
const FIRST_STEP_HOLD = 30000;

// Minimum time a step's card stays up before it's allowed to auto-advance, so
// the player always gets a chance to read it (and isn't yanked forward the
// instant the goal condition happens to be met). The welcome card holds long;
// every step after that is snappy — once you're actually doing things, finishing
// an action moves you on quickly rather than making you wait out a long timer.
const readMs = (text: string, step: number) => {
	if (step === 0) return FIRST_STEP_HOLD;
	const words = text.trim().split(/\s+/).length;
	return Math.min(4200, Math.max(1600, words * 150));
};

export function Tutorial() {
	const { state, setTutorialStep, panel, worlds, activeWorldId } = useGame();
	const { t } = useI18n();
	const [flags, setFlags] = useState<Flags>({
		moved: false,
		gathered: false,
		openedBasket: false,
		openedCrafting: false,
		crafted: false,
		openedJournal: false,
		openedChest: false,
		openedPreserve: false,
		openedTools: false,
		openedPeople: false,
		openedWeather: false,
	});
	const advanceTimer = useRef<number | null>(null);
	const stepShownAt = useRef<number>(Date.now());
	const [celebrating, setCelebrating] = useState(false);
	const touch = isTouchDevice();
	// The card can be dragged anywhere by its header; the spot is remembered.
	const { ref: dragRef, handleProps, style: dragStyle } = useDraggable('wild-willows:tutorial-cardpos');
	// Collapse to just the header bar to get it out of the way; state is remembered.
	const [minimized, setMinimized] = useState(() => {
		try {
			return localStorage.getItem('wild-willows:tutorial-min') === '1';
		} catch {
			return false;
		}
	});
	const toggleMinimized = () =>
		setMinimized((m) => {
			const next = !m;
			try {
				localStorage.setItem('wild-willows:tutorial-min', next ? '1' : '0');
			} catch {
				/* ignore */
			}
			return next;
		});

	// Co-op saves get an intro ahead of the normal arc: the host learns to invite
	// people; a joiner just gets a welcome (no invite step — it isn't their world).
	const activeWorld = useMemo(() => worlds.find((x) => x.worldId === activeWorldId), [worlds, activeWorldId]);
	const isCoop = !!activeWorld && !activeWorld.solo;
	const isHost = !!activeWorld?.isOwner;
	const STEPS = useMemo(
		() => (isCoop ? [...(isHost ? COOP_HOST_INTRO : COOP_JOIN_INTRO), ...BASE_STEPS] : BASE_STEPS),
		[isCoop, isHost],
	);

	const step = state?.player.tutorialStep ?? DONE_STEP;

	// Coordinate manual Back/Next with auto-advance:
	//  • `frontier` is the furthest step reached on this playthrough. Auto-advance
	//    only fires when you're sitting at the frontier — so stepping Back to
	//    reread an earlier card doesn't immediately bounce you forward again.
	//  • `replaying` is set when the tutorial is reopened from the Help menu after
	//    it was already finished. On a replay every action is already "done", so
	//    we disable auto-advance entirely and let the player click through.
	const [frontier, setFrontier] = useState(step);
	const finishedRef = useRef(false);
	const prevStepRef = useRef(step);
	const [replaying, setReplaying] = useState(false);

	useEffect(() => {
		const prev = prevStepRef.current;
		prevStepRef.current = step;
		if (step >= STEPS.length) {
			finishedRef.current = true;
			return;
		}
		// reopened from Help after finishing → review mode (manual only)
		if (prev >= STEPS.length && finishedRef.current) {
			setReplaying(true);
			setFrontier(step);
			return;
		}
		if (step > frontier) setFrontier(step);
	}, [step, frontier]);

	// Remember when the current card first appeared, so auto-advance can hold it
	// on screen for a minimum reading time. Also remember the live step so that
	// closing (or just leaving) and reopening from Help resumes right here.
	useEffect(() => {
		stepShownAt.current = Date.now();
		if (step >= 0 && step < STEPS.length) saveTutorialPos(step);
	}, [step, STEPS.length]);

	const goTo = (next: number) => {
		if (advanceTimer.current) {
			window.clearTimeout(advanceTimer.current);
			advanceTimer.current = null;
		}
		setCelebrating(false);
		setTutorialStep(next);
	};

	// flag collectors
	useEffect(() => {
		const subs = [
			bridge.on('player-moved', () => setFlags((f) => (f.moved ? f : { ...f, moved: true }))),
			bridge.on('collected', () => setFlags((f) => ({ ...f, gathered: true }))),
		];
		const onKey = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return; // typing a "w" in a text box isn't walking
			if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
				setFlags((f) => (f.moved ? f : { ...f, moved: true }));
			}
		};
		window.addEventListener('keydown', onKey);
		const joyPoll = window.setInterval(() => {
			if (Math.abs(bridge.shared.joy.x) > 0.3 || Math.abs(bridge.shared.joy.y) > 0.3) {
				setFlags((f) => (f.moved ? f : { ...f, moved: true }));
			}
		}, 400);
		return () => {
			subs.forEach((u) => u());
			window.removeEventListener('keydown', onKey);
			window.clearInterval(joyPoll);
		};
	}, []);

	useEffect(() => {
		if (panel === 'crafting') setFlags((f) => ({ ...f, openedCrafting: true }));
		if (panel === 'journal') setFlags((f) => (f.openedJournal ? f : { ...f, openedJournal: true }));
		if (panel === 'inventory') setFlags((f) => (f.openedBasket ? f : { ...f, openedBasket: true }));
		if (panel === 'chest') setFlags((f) => (f.openedChest ? f : { ...f, openedChest: true }));
		if (panel === 'biomes') setFlags((f) => (f.openedPreserve ? f : { ...f, openedPreserve: true }));
		if (panel === 'tools') setFlags((f) => (f.openedTools ? f : { ...f, openedTools: true }));
		if (panel === 'people') setFlags((f) => (f.openedPeople ? f : { ...f, openedPeople: true }));
		if (panel === 'weather') setFlags((f) => (f.openedWeather ? f : { ...f, openedWeather: true }));
	}, [panel]);

	useEffect(() => {
		if (state && Object.keys(state.player.craftedItems || {}).length > 0) {
			setFlags((f) => (f.crafted ? f : { ...f, crafted: true }));
		}
	}, [state]);

	// auto-advance when the current step's condition is met — but only while the
	// player is at the live frontier and not reviewing a finished tutorial.
	useEffect(() => {
		if (step >= STEPS.length || step < 0) return;
		if (replaying || step !== frontier) return;
		const def = STEPS[step];
		if (def.done({ state, flags })) {
			if (advanceTimer.current) return;

			const celebrateThenAdvance = () => {
				setCelebrating(true);
				advanceTimer.current = window.setTimeout(() => {
					advanceTimer.current = null;
					setCelebrating(false);
					setTutorialStep(step + 1);
				}, CELEBRATE_MS);
			};

			// Hold the card up until the player has had time to read it. If the
			// goal was met before that, wait out the remainder first; otherwise
			// celebrate and move on right away.
			const text = touch && def.hasTouch ? t(`${def.key}.touch`) : t(`${def.key}.text`);
			const remaining = readMs(text, step) - (Date.now() - stepShownAt.current);
			if (remaining <= 0) {
				celebrateThenAdvance();
			} else {
				advanceTimer.current = window.setTimeout(() => {
					advanceTimer.current = null;
					celebrateThenAdvance();
				}, remaining);
			}
		}
	}, [state, flags, step, frontier, replaying, touch, setTutorialStep]);

	if (!state || step >= STEPS.length) return null;
	const def = STEPS[step];
	const isLast = step === STEPS.length - 1;
	// Show only the current chapter's dots, so the first screen reads
	// "Chapter 1 of 4" instead of an intimidating "step 1 of 18".
	const curChapter = def.chapter;
	const chapterStepIdxs = STEPS.map((s, i) => ({ s, i }))
		.filter((x) => x.s.chapter === curChapter)
		.map((x) => x.i);

	return (
		<div
			ref={dragRef}
			className={`tutorial-card ${celebrating ? 'celebrate' : ''} ${minimized ? 'minimized' : ''}`}
			style={dragStyle}
		>
			<div className="tutorial-head tutorial-head-drag" {...handleProps}>
				<span className="tutorial-eyebrow">
					<Icon name="sparkle" size={13} /> {t(CHAPTERS[curChapter - 1])}
				</span>
				<span className="tutorial-count">
					{t('panels.tutorial.stepCount', { step: step + 1, total: STEPS.length })}
				</span>
				<button
					className="tutorial-close"
					title={minimized ? t('panels.tutorial.expand') : t('panels.tutorial.minimize')}
					aria-label={minimized ? t('panels.tutorial.expand') : t('panels.tutorial.minimize')}
					aria-expanded={!minimized}
					onClick={toggleMinimized}
				>
					<Icon name="forward" size={14} className={minimized ? 'chev-up' : 'chev-down'} />
				</button>
				<button
					className="tutorial-close"
					title={replaying ? t('panels.tutorial.closeTutorial') : t('panels.tutorial.skipTutorial')}
					aria-label={replaying ? t('panels.tutorial.closeTutorial') : t('panels.tutorial.skipTutorial')}
					onClick={() => {
						saveTutorialPos(step);
						goTo(DONE_STEP);
					}}
				>
					<Icon name="close" size={14} />
				</button>
			</div>
			{!minimized && (
				<>
					<div className="tutorial-main">
						<div className="tutorial-icon">
							<Icon name={celebrating ? 'check' : def.icon} size={22} />
						</div>
						<div className="grow">
							<div className="tutorial-title">
								{celebrating ? t('panels.tutorial.niceWork') : t(`${def.key}.title`)}
							</div>
							<div className="tutorial-text">
								{touch && def.hasTouch ? t(`${def.key}.touch`) : t(`${def.key}.text`)}
							</div>
							{DEMO && def.key === 'panels.tutorial.welcome' && !celebrating && (
								<div className="tutorial-demo-note">
									<Icon name="sparkle" size={13} /> {t('panels.tutorial.demoNote', { count: 5 })}
								</div>
							)}
						</div>
					</div>
					<div className="tutorial-footer">
						<div className="tutorial-dots">
							{chapterStepIdxs.map((i) => (
								<button
									key={i}
									type="button"
									className={`dot ${i < step ? 'done' : i === step ? 'now' : ''}`}
									onClick={() => goTo(i)}
									aria-label={t('panels.tutorial.goToStep', { step: i + 1 })}
									aria-current={i === step ? 'step' : undefined}
								/>
							))}
						</div>
						<div className="tutorial-nav">
							<button
								className="tutorial-skip"
								onClick={() => goTo(step - 1)}
								disabled={step === 0}
								title={t('panels.tutorial.prevStep')}
								aria-label={t('panels.tutorial.prevStep')}
							>
								<Icon name="back" size={14} /> {t('panels.tutorial.back')}
							</button>
							{isLast ? (
								<button
									className="tutorial-btn"
									onClick={() => {
										clearTutorialPos();
										goTo(DONE_STEP);
									}}
								>
									<Icon name="check" size={15} /> {t('panels.tutorial.finish')}
								</button>
							) : (
								<button
									className="tutorial-btn"
									onClick={() => goTo(step + 1)}
									title={t('panels.tutorial.nextStep')}
									aria-label={t('panels.tutorial.nextStep')}
								>
									{t('panels.tutorial.next')} <Icon name="forward" size={15} />
								</button>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

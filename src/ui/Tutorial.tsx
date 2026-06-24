import { useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import { Icon } from './icons';
import { isTouchDevice } from './MobileControls';

interface StepDef {
	icon: string;
	title: string;
	text: string;
	touchText?: string;
	done: (args: { state: any; flags: Flags }) => boolean;
}

interface Flags {
	moved: boolean;
	gathered: boolean;
	openedBasket: boolean;
	openedWorkbench: boolean;
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
const grassPlaced = (state: any) =>
	state?.placements?.some((p: any) => p.objectId === 'grass-patch');
const hasWateredBed = (state: any) =>
	state?.terrain?.some((t: any) => t.type === 'watered' || t.type === 'water');
const hasPlanted = (state: any) =>
	state?.placements?.some((p: any) => typeof p.plantedAt === 'number');
const openWaterTiles = (state: any) =>
	state?.terrain?.filter((t: any) => t.type === 'water').length || 0;
const upgradedAnyTool = (state: any) =>
	Object.values(state?.player?.tools || {}).some((tier: any) => (tier as number) > 1);

// The tutorial is ordered as a natural new-caretaker arc: learn to move and
// gather, manage storage, work the land (terraform + plant), read the info
// panels, then put it all together — building toward the emotional payoff of
// welcoming your very first animal, the grasshopper, as the finale.
// Co-op intro steps, prepended ahead of the normal new-caretaker arc. The HOST
// starts by learning how to invite friends; a JOINER (who can't invite) just gets
// a welcome that sets expectations about what's shared vs. personal.
const COOP_HOST_INTRO: StepDef[] = [
	{
		icon: 'user',
		title: 'Welcome to co-op!',
		text: 'You’re restoring this preserve together with friends. First things first — invite them. Press U (or the green “Co-op” badge, top-left, or the people button, top-right) to open the People menu, where you can copy your join code. Friends choose New Game → Co-op → “Join a friend’s world” and enter that code to play here with you. Open the People menu now to see it.',
		touchText: 'You’re restoring this preserve together with friends. First things first — invite them. Tap the green “Co-op” badge (top) or the people button to open the People menu, where you can copy your join code. Friends choose New Game → Co-op → “Join a friend’s world” and enter that code to play with you. Open the People menu now to see it.',
		done: ({ flags }) => flags.openedPeople,
	},
	{
		icon: 'sparkle',
		title: 'Restoring together',
		text: 'As friends join, you’ll see them roaming the very same preserve — the land, buildings, plants, and the animals that return are all shared, so your work adds up together. Your own basket, tools, field journal, and achievements always stay yours. Now let’s learn the basics →',
		touchText: 'As friends join, you’ll see them roaming the very same preserve — the land, buildings, plants, and animals are all shared, so your work adds up together. Your own basket, tools, journal, and achievements always stay yours. Now let’s learn the basics →',
		done: () => false, // info step — advance with Next
	},
];

const COOP_JOIN_INTRO: StepDef[] = [
	{
		icon: 'sparkle',
		title: 'Welcome to the preserve!',
		text: 'You’ve joined a shared preserve — you’ll see the host and other caretakers roaming the very same world. The land, buildings, plants, and the animals that return are all shared, so your work adds up together. Your own basket, tools, field journal, and achievements always stay yours. Now let’s learn the basics →',
		touchText: 'You’ve joined a shared preserve — you’ll see the host and other caretakers roaming the very same world. The land, buildings, plants, and animals are all shared, so your work adds up together. Your own basket, tools, journal, and achievements always stay yours. Now let’s learn the basics →',
		done: () => false, // info step — advance with Next
	},
];

const BASE_STEPS: StepDef[] = [
	{
		icon: 'walk',
		title: 'Welcome, caretaker',
		text: 'This worn-out meadow is yours to restore. By the end of this short guide you’ll welcome your very first animal home — a little grasshopper. Let’s start simple: walk around with WASD or the arrow keys.',
		touchText: 'This worn-out meadow is yours to restore. By the end of this short guide you’ll welcome your very first animal home — a little grasshopper. Let’s start simple: walk with the joystick in the corner.',
		done: ({ flags }) => flags.moved,
	},
	{
		icon: 'basket',
		title: 'Check your basket',
		text: 'Press B (or the basket button, top-right) to see what you’re carrying. Your basket holds a limited amount — when it fills up you’ll stash the extra in a chest. The toolbelt along the bottom (or number keys 1, 2, 3) switches between your basket, shovel, and watering can.',
		touchText: 'Tap the basket button (top-right) to see what you’re carrying. Your basket holds a limited amount — when it fills up you’ll stash the extra in a chest. The toolbelt along the bottom switches between your basket, shovel, and watering can.',
		done: ({ flags }) => flags.openedBasket,
	},
	{
		icon: 'sparkle',
		title: 'Gather materials',
		text: 'Now fill that basket. See the little glowing spots on the ground? Walk up to one with the basket selected and press E or the Space bar to gather — E and Space interact with anything you walk up to. Collect some seeds and fiber — you’ll need them for the grasshopper’s home later.',
		touchText: 'Now fill that basket. See the little glowing spots on the ground? Walk up to one with the basket selected and tap it to gather. Collect some seeds and fiber — you’ll need them for the grasshopper’s home later.',
		done: ({ flags }) => flags.gathered,
	},
	{
		icon: 'chest',
		title: 'Use your camp chest',
		text: 'Walk to the chest beside your tent and press E or Space to open it. Deposit spare materials here whenever your basket gets full — anything in a chest still counts toward crafting from anywhere, so you never have to carry it all.',
		touchText: 'Walk to the chest beside your tent and tap it to open it. Deposit spare materials here whenever your basket gets full — anything in a chest still counts toward crafting from anywhere, so you never have to carry it all.',
		done: ({ flags }) => flags.openedChest,
	},
	{
		icon: 'spade',
		title: 'Work the land',
		text: 'The land itself needs healing. Press 2 for the shovel and dig a soil bed on bare ground, then press 3 for the watering can and water it. Watering recovers the land (+health) and readies the bed for planting.',
		touchText: 'The land itself needs healing. Tap the shovel and dig a soil bed on bare ground, then tap the watering can and water it. Watering recovers the land (+health) and readies the bed for planting.',
		done: ({ state }) => hasWateredBed(state),
	},
	{
		icon: 'leaf',
		title: 'Plant something living',
		text: 'Walk up to your watered bed and press E or Space to plant a flower, grass, or tree. Plants sprout small and grow in over time — once mature they count as real habitat, and the biome rechecks for new arrivals on its own.',
		touchText: 'Walk up to your watered bed and tap it to plant a flower, grass, or tree. Plants sprout small and grow in over time — once mature they count as real habitat, and the biome rechecks for new arrivals on its own.',
		done: ({ state }) => hasPlanted(state),
	},
	{
		icon: 'drop',
		title: 'Shape some water',
		text: 'Many animals need water. Water a bed once to plant it — water it again to flood it into open water. Flood a few tiles next to each other to shape a pond (a long line makes a river, a wide patch a lake). Try flooding a few connected tiles now.',
		touchText: 'Many animals need water. Water a bed once to plant it — water it again to flood it into open water. Flood a few tiles next to each other to shape a pond, river, or lake. Try flooding a few connected tiles now.',
		done: ({ state }) => openWaterTiles(state) >= 3,
	},
	{
		icon: 'journal',
		title: 'Open your field journal',
		text: 'Press J to open your field journal — it lists every animal that can return to each area and who’s back so far. Each area has its own field guide: the basic entry always shows, but full diet, shelter, and return hints unlock once you gather that area’s materials and upgrade its guide in the Tools panel.',
		touchText: 'Tap the journal button to open your field journal — it lists every animal that can return to each area and who’s back so far. Each area has its own field guide: the basic entry always shows, but full diet, shelter, and return hints unlock once you gather that area’s materials and upgrade its guide in the Tools panel.',
		done: ({ flags }) => flags.openedJournal,
	},
	{
		icon: 'tools',
		title: 'Tools & upgrades',
		text: 'Press T to open Tools & Upgrades. Spend materials to upgrade your basket, shovel, watering can, or field journal — higher tiers gather more, shape more, and reveal the next area’s field guide. Some upgrades open up as a biome gets healthier, so check back as you go.',
		touchText: 'Tap the tools button to open Tools & Upgrades. Spend materials to upgrade your basket, shovel, watering can, or field journal — higher tiers gather more, shape more, and reveal the next area’s field guide. Some upgrades open up as a biome gets healthier, so check back as you go.',
		done: ({ flags }) => flags.openedTools,
	},
	{
		icon: 'map',
		title: 'Open the Preserve map',
		text: 'Press P (or the map button) to open the Preserve. It tracks every area’s health and animals, shows exactly what’s needed to unlock the next one, and lets you fast-travel back to any area you’ve already visited — tap the walk icon on its row.',
		touchText: 'Tap the map button to open the Preserve. It tracks every area’s health and animals, shows exactly what’s needed to unlock the next one, and lets you fast-travel back to any area you’ve already visited — tap the walk icon on its row.',
		done: ({ flags }) => flags.openedPreserve,
	},
	{
		icon: 'cloud',
		title: 'Weather & seasons',
		text: 'Press M to open the Weather & Seasons guide. Each area has its own weather that shifts on its own and slowly drifts through the seasons — the guide shows what’s happening across the whole preserve and explains, in real ecology, how today’s weather and season shape the area you’re standing in. Watch the skies, too: unusual weather can leave rare materials to gather while it lasts.',
		touchText: 'Tap the weather button (the cloud, top-right) to open the Weather & Seasons guide. Each area has its own weather that shifts on its own and slowly drifts through the seasons — the guide shows what’s happening across the preserve and explains how today’s weather and season shape the area you’re in. Watch the skies: unusual weather can leave rare materials to gather while it lasts.',
		done: ({ flags }) => flags.openedWeather,
	},
	{
		icon: 'pin',
		title: 'Good things to know',
		text: 'Misplaced something? Shift+click any placed object to pick it back up. Esc closes menus or cancels placing. New areas open through trail gates at the edge of the map. The gear button holds Settings (change your character, lock or delete your save), and the ? button reopens this guide anytime.',
		touchText: 'Misplaced something? Press and hold a placed object to pick it back up. New areas open through trail gates at the edge of the map. The gear button holds Settings (change your character, lock or delete your save), and the ? button reopens this guide anytime.',
		done: () => false, // info step — advance with Next
	},
	{
		icon: 'hammer',
		title: 'Open crafting',
		text: 'Time to build the grasshopper’s home. Press C (or the hammer button) to open crafting — it draws from your basket plus every chest, anywhere you are. Only a few things can be made now; more unlock as the meadow recovers.',
		touchText: 'Time to build the grasshopper’s home. Tap the hammer button to open crafting — it draws from your basket plus every chest, anywhere you are. Only a few things can be made now; more unlock as the meadow recovers.',
		done: ({ flags }) => flags.openedWorkbench,
	},
	{
		icon: 'sparkle',
		title: 'Craft a Grass Patch',
		text: 'Find Grass Patch in the list and press Craft. Once you’re carrying enough seeds and fiber it lights up — this is the simple home a grasshopper is waiting for.',
		done: ({ state }) => hasGrassPatch(state),
	},
	{
		icon: 'pin',
		title: 'Place the Grass Patch',
		text: 'Press the green “Ready to place” button at the top of the crafting menu, then click a patch of open ground in the meadow. Watch the biome health meter tick up the moment it’s down.',
		touchText: 'Tap the green “Ready to place” button at the top of the crafting menu, then tap a patch of open ground in the meadow. Watch the biome health meter tick up the moment it’s down.',
		done: ({ state }) => grassPlaced(state),
	},
	{
		icon: 'paw',
		title: 'Welcome the grasshopper',
		text: 'Here’s the moment. A grasshopper returns at 15% meadow health with a Grass Patch down — between watering the land, planting, and your patches you’re already there. If it hasn’t hopped in yet, place another patch or water a bit more. When it arrives, click it to observe it and record it in your journal — then click Next for one last thing.',
		touchText: 'Here’s the moment. A grasshopper returns at 15% meadow health with a Grass Patch down — between watering the land, planting, and your patches you’re already there. If it hasn’t hopped in yet, place another patch or water a bit more. When it arrives, tap it to observe it and record it in your journal — then tap Next for one last thing.',
		done: ({ state }) => state?.discoveries?.some((d: any) => (d.timesObserved || 0) > 0),
	},
	{
		icon: 'star',
		title: 'Your first star',
		text: 'That’s the whole loop — and welcoming the grasshopper just earned your first achievement, ★ First Friend. There are 50 stars to discover across the preserve: for restoring each biome, bringing back top predators, mastering your tools, and welcoming wildlife preserve-wide. They don’t come easy. Find them all in the new Achievements menu (press K) — recent unlocks rise to the top. One last comfort to show you →',
		touchText: 'That’s the whole loop — and welcoming the grasshopper just earned your first achievement, ★ First Friend. There are 50 stars to discover across the preserve: for restoring each biome, bringing back top predators, mastering your tools, and welcoming wildlife preserve-wide. They don’t come easy. Find them all in the new Achievements menu (the star button) — recent unlocks rise to the top. One last comfort to show you →',
		done: () => false, // info step — advance with Next
	},
	{
		icon: 'home',
		title: 'Make yourself at home',
		text: 'Last thing — walk back to your camp tent and press E to step inside your home. It’s yours to decorate with crafted camp comforts, and the sign by the tent upgrades it bigger and cozier (and lets you carry more). Step inside now, and the preserve is all yours — happy restoring!',
		touchText: 'Last thing — walk back to your camp tent and tap it to step inside your home. It’s yours to decorate with crafted camp comforts, and the sign by the tent upgrades it bigger and cozier. Step inside now, and the preserve is all yours — happy restoring!',
		done: ({ state }) => state?.player?.area === 'home',
	},
];

const DONE_STEP = 99;

// How long the "nice job!" check animation plays before we move on.
const CELEBRATE_MS = 850;

// The opening card stays up a good while so new caretakers can read the intro
// before being whisked into the loop — even if they tap a movement key right away.
const FIRST_STEP_HOLD = 7000;

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
	const [flags, setFlags] = useState<Flags>({ moved: false, gathered: false, openedBasket: false, openedWorkbench: false, crafted: false, openedJournal: false, openedChest: false, openedPreserve: false, openedTools: false, openedPeople: false, openedWeather: false });
	const advanceTimer = useRef<number | null>(null);
	const stepShownAt = useRef<number>(Date.now());
	const [celebrating, setCelebrating] = useState(false);
	const touch = isTouchDevice();

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
	// on screen for a minimum reading time.
	useEffect(() => {
		stepShownAt.current = Date.now();
	}, [step]);

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
		if (panel === 'crafting') setFlags((f) => ({ ...f, openedWorkbench: true }));
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
			const text = (touch && def.touchText) || def.text;
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

	return (
		<div className={`tutorial-card ${celebrating ? 'celebrate' : ''}`}>
			<div className="tutorial-head">
				<span className="tutorial-eyebrow"><Icon name="sparkle" size={13} /> Getting started</span>
				<span className="tutorial-count">Step {step + 1} of {STEPS.length}</span>
				<button
					className="tutorial-close"
					title={replaying ? 'Close tutorial' : 'Skip tutorial'}
					aria-label={replaying ? 'Close tutorial' : 'Skip tutorial'}
					onClick={() => goTo(DONE_STEP)}
				>
					<Icon name="close" size={14} />
				</button>
			</div>
			<div className="tutorial-main">
				<div className="tutorial-icon">
					<Icon name={celebrating ? 'check' : def.icon} size={22} />
				</div>
				<div className="grow">
					<div className="tutorial-title">{celebrating ? 'Nice work!' : def.title}</div>
					<div className="tutorial-text">{(touch && def.touchText) || def.text}</div>
				</div>
			</div>
			<div className="tutorial-footer">
				<div className="tutorial-dots">
					{STEPS.map((_, i) => (
						<span key={i} className={`dot ${i < step ? 'done' : i === step ? 'now' : ''}`} />
					))}
				</div>
				<div className="tutorial-nav">
					<button
						className="tutorial-skip"
						onClick={() => goTo(step - 1)}
						disabled={step === 0}
						title="Previous step"
						aria-label="Previous step"
					>
						<Icon name="back" size={14} /> Back
					</button>
					{isLast ? (
						<button className="tutorial-btn" onClick={() => goTo(DONE_STEP)}>
							<Icon name="check" size={15} /> Finish
						</button>
					) : (
						<button className="tutorial-btn" onClick={() => goTo(step + 1)} title="Next step" aria-label="Next step">
							Next <Icon name="forward" size={15} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

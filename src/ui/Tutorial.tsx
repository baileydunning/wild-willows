import { useEffect, useRef, useState } from 'react';
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
	openedWorkbench: boolean;
	crafted: boolean;
	openedJournal: boolean;
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

const STEPS: StepDef[] = [
	{
		icon: 'walk',
		title: 'Welcome, caretaker',
		text: 'This worn-out meadow is yours to restore. Your very first goal: bring the grasshopper home. Let’s do it together. Walk around with WASD or the arrow keys.',
		touchText: 'This worn-out meadow is yours to restore. Your very first goal: bring the grasshopper home. Let’s do it together. Walk with the joystick in the corner.',
		done: ({ flags }) => flags.moved,
	},
	{
		icon: 'basket',
		title: 'Gather seeds and fiber',
		text: 'A grasshopper just needs a patch of grass — and a Grass Patch is made from seeds and fiber. See the little glowing spots? Walk up to the grassy and plant ones and press E to gather seeds and fiber.',
		touchText: 'A grasshopper just needs a patch of grass — and a Grass Patch is made from seeds and fiber. See the little glowing spots? Walk up to the grassy and plant ones and tap to gather seeds and fiber.',
		done: ({ flags }) => flags.gathered,
	},
	{
		icon: 'hammer',
		title: 'Open crafting',
		text: 'Now press C (or the hammer button) to open crafting. You can craft anywhere — it uses your basket plus anything in your chests. Only a few things can be made right now; more unlock as the meadow recovers.',
		touchText: 'Now tap the hammer button to open crafting. You can craft anywhere — it uses your basket plus anything in your chests. Only a few things can be made right now; more unlock as the meadow recovers.',
		done: ({ flags }) => flags.openedWorkbench,
	},
	{
		icon: 'sparkle',
		title: 'Craft a Grass Patch',
		text: 'Find Grass Patch in the list and press Craft. Once you carry enough seeds and fiber it lights up. This is the home the grasshopper is waiting for.',
		done: ({ state }) => hasGrassPatch(state),
	},
	{
		icon: 'pin',
		title: 'Place the Grass Patch',
		text: 'Press the green “Ready to place” button at the top of the crafting menu, then click a patch of open ground in the meadow. Watch the biome health meter tick up.',
		touchText: 'Tap the green “Ready to place” button at the top of the crafting menu, then tap a patch of open ground in the meadow. Watch the biome health meter tick up.',
		done: ({ state }) => grassPlaced(state),
	},
	{
		icon: 'paw',
		title: 'Welcome the grasshopper',
		text: 'A grasshopper returns at just 8% health once a Grass Patch is down — keep gathering and placing a patch or two more if it hasn’t hopped in yet. When it arrives, click it to observe it and record it in your field journal. Welcoming it also unlocks new things to craft — watch for the “new recipe unlocked” note.',
		touchText: 'A grasshopper returns at just 8% health once a Grass Patch is down — keep gathering and placing a patch or two more if it hasn’t hopped in yet. When it arrives, tap it to observe it and record it in your field journal. Welcoming it also unlocks new things to craft — watch for the “new recipe unlocked” note.',
		done: ({ state }) => state?.discoveries?.some((d: any) => (d.timesObserved || 0) > 0),
	},
	{
		icon: 'journal',
		title: 'Open your field journal',
		text: 'Press J to open your field journal — it lists every animal that can return to each area and who’s back so far. Each area has its own field guide: the basic entry (and comfort) always shows, but the full diet, shelter, and return hints unlock once you gather that area’s materials and upgrade the guide in the Tools panel — starting with the Willow Meadow guide.',
		touchText: 'Tap the journal button to open your field journal — it lists every animal that can return to each area and who’s back so far. Each area has its own field guide: the basic entry always shows, but full diet, shelter, and return hints unlock once you gather that area’s materials and upgrade the guide in the Tools panel — starting with Willow Meadow.',
		done: ({ flags }) => flags.openedJournal,
	},
	{
		icon: 'spade',
		title: 'Prepare some soil',
		text: 'Habitat isn’t only crafted — you can plant living things too. Press 2 for the shovel and dig a soil bed on bare ground, then press 3 for the watering can and water the bed. Watering recovers the land (+health) and readies it for planting.',
		touchText: 'Habitat isn’t only crafted — you can plant living things too. Tap the shovel and dig a soil bed on bare ground, then tap the watering can and water the bed. Watering recovers the land (+health) and readies it for planting.',
		done: ({ state }) => hasWateredBed(state),
	},
	{
		icon: 'leaf',
		title: 'Plant something living',
		text: 'Walk up to your watered bed and press E to plant a flower, grass, or tree (open crafting to see what’s plantable). Plants sprout small and grow in over time — once mature they count as real habitat, and the biome rechecks for new arrivals.',
		touchText: 'Walk up to your watered bed and tap it to plant a flower, grass, or tree. Plants sprout small and grow in over time — once mature they count as real habitat, and the biome rechecks for new arrivals.',
		done: ({ state }) => hasPlanted(state),
	},
	{
		icon: 'drop',
		title: 'Shape water',
		text: 'Many animals need water. Water a bed once to plant it — water it again to flood it into open water. Flood several tiles next to each other to shape a pond, a long channel for a river, or a wide body for a lake. Try flooding a few connected tiles now.',
		touchText: 'Many animals need water. Water a bed once to plant it — water it again to flood it into open water. Flood several tiles next to each other to shape a pond, river, or lake. Try flooding a few connected tiles now.',
		done: ({ state }) => openWaterTiles(state) >= 3,
	},
	{
		icon: 'tools',
		title: 'Upgrade your tools',
		text: 'Press T to open Tools & Upgrades. Spend materials to upgrade your basket, shovel, watering can, or field journal — higher tiers gather more, shape more, and reveal the next area’s field guide. Some upgrades unlock as a biome gets healthier.',
		touchText: 'Open Tools & Upgrades. Spend materials to upgrade your basket, shovel, watering can, or field journal — higher tiers gather more, shape more, and reveal the next area’s field guide. Some upgrades unlock as a biome gets healthier.',
		done: ({ state }) => upgradedAnyTool(state),
	},
	{
		icon: 'leaf',
		title: 'That’s the loop',
		text: 'Gather, craft, plant, terraform, and welcome wildlife — and each animal you bring back and every bit of health you restore unlocks more to craft. Reach 80% health with 10 meadow animals back to open the forest trail. The ? button has everything else.',
		done: () => false, // finished by the button
	},
];

const DONE_STEP = 99;

// How long the "nice job!" check animation plays before we move on.
const CELEBRATE_MS = 1100;

// Minimum time a step's card stays up before it's allowed to auto-advance, so
// the player always gets a chance to read it (and isn't yanked forward the
// instant the goal condition happens to be met). Scaled to the length of the
// card text — roughly a relaxed reading pace — with a floor and a cap.
const readMs = (text: string) => {
	const words = text.trim().split(/\s+/).length;
	return Math.min(9000, Math.max(4500, words * 320));
};

export function Tutorial() {
	const { state, setTutorialStep, panel } = useGame();
	const [flags, setFlags] = useState<Flags>({ moved: false, gathered: false, openedWorkbench: false, crafted: false, openedJournal: false });
	const advanceTimer = useRef<number | null>(null);
	const stepShownAt = useRef<number>(Date.now());
	const [celebrating, setCelebrating] = useState(false);
	const touch = isTouchDevice();

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
			const remaining = readMs(text) - (Date.now() - stepShownAt.current);
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
			<button
				className="tutorial-close"
				title={replaying ? 'Close tutorial' : 'Skip tutorial'}
				aria-label={replaying ? 'Close tutorial' : 'Skip tutorial'}
				onClick={() => goTo(DONE_STEP)}
			>
				<Icon name="close" size={14} />
			</button>
			<div className="tutorial-icon">
				<Icon name={celebrating ? 'check' : def.icon} size={22} />
			</div>
			<div className="grow">
				<div className="tutorial-title">{def.title} <span className="tutorial-count">{step + 1}/{STEPS.length}</span></div>
				<div className="tutorial-text">{(touch && def.touchText) || def.text}</div>
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
		</div>
	);
}

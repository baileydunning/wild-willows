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
}

const STEPS: StepDef[] = [
	{
		icon: 'walk',
		title: 'Welcome, caretaker',
		text: 'This worn-out meadow is yours to restore. Walk around with WASD or the arrow keys.',
		touchText: 'This worn-out meadow is yours to restore. Walk with the joystick in the corner.',
		done: ({ flags }) => flags.moved,
	},
	{
		icon: 'basket',
		title: 'Gather materials',
		text: 'See the little glowing plants, stones, and branches? Those are gathering spots. Walk up to one and press E to collect it.',
		touchText: 'See the little glowing plants, stones, and branches? Those are gathering spots. Walk close and tap one to collect it.',
		done: ({ flags }) => flags.gathered,
	},
	{
		icon: 'hammer',
		title: 'Open crafting',
		text: 'Press C or the hammer button in your toolbelt — you can craft anywhere, using your basket and anything stored in chests.',
		touchText: 'Tap the hammer button in your toolbelt — you can craft anywhere, using your basket and anything stored in chests.',
		done: ({ flags }) => flags.openedWorkbench,
	},
	{
		icon: 'sparkle',
		title: 'Craft your first habitat',
		text: 'You already carry enough seeds and fiber for a Grass Patch — press Craft. Crafting can also pull materials from chests near a workbench.',
		done: ({ flags }) => flags.crafted,
	},
	{
		icon: 'pin',
		title: 'Place it in the meadow',
		text: 'In the workbench menu, press the green Ready to place button, then click a spot of open ground. Watch the biome health meter rise.',
		touchText: 'In the workbench menu, press the green Ready to place button, then tap a spot of open ground. Watch the biome health meter rise.',
		done: ({ state }) => state?.placements?.some((p: any) => p.area !== 'home' && p.objectId !== 'workbench'),
	},
	{
		icon: 'paw',
		title: 'Help an animal return',
		text: 'Keep gathering, crafting, and placing. Open the journal (book button) for hints — grasshoppers return at just 10% health with a grass patch. Try your shovel and watering can on bare ground, too.',
		done: ({ state }) => (state?.discoveries?.length || 0) > 0,
	},
	{
		icon: 'journal',
		title: 'Say hello',
		text: 'An animal came back! Click it to observe it and record it in your field journal.',
		touchText: 'An animal came back! Tap it to observe it and record it in your field journal.',
		done: ({ state }) => state?.discoveries?.some((d: any) => (d.timesObserved || 0) > 0),
	},
	{
		icon: 'leaf',
		title: 'The preserve is yours',
		text: 'That is the whole loop: gather, craft, place, and welcome wildlife home. Restore the meadow to 80% health with 5 animals returned, and the forest trail opens. The ? button has everything else.',
		done: () => false, // finished by the button
	},
];

export function Tutorial() {
	const { state, setTutorialStep, panel } = useGame();
	const [flags, setFlags] = useState<Flags>({ moved: false, gathered: false, openedWorkbench: false, crafted: false });
	const advanceTimer = useRef<number | null>(null);
	const [celebrating, setCelebrating] = useState(false);
	const touch = isTouchDevice();

	const step = state?.player.tutorialStep ?? 99;

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
	}, [panel]);

	useEffect(() => {
		if (state && Object.keys(state.player.craftedItems || {}).length > 0) {
			setFlags((f) => (f.crafted ? f : { ...f, crafted: true }));
		}
	}, [state]);

	// auto-advance when the current step's condition is met
	useEffect(() => {
		if (step >= STEPS.length || step < 0) return;
		const def = STEPS[step];
		if (def.done({ state, flags })) {
			if (advanceTimer.current) return;
			setCelebrating(true);
			advanceTimer.current = window.setTimeout(() => {
				advanceTimer.current = null;
				setCelebrating(false);
				setTutorialStep(step + 1);
			}, 900);
		}
	}, [state, flags, step, setTutorialStep]);

	if (!state || step >= STEPS.length) return null;
	const def = STEPS[step];
	const isLast = step === STEPS.length - 1;

	return (
		<div className={`tutorial-card ${celebrating ? 'celebrate' : ''}`}>
			<div className="tutorial-icon">
				<Icon name={celebrating ? 'check' : def.icon} size={22} />
			</div>
			<div className="grow">
				<div className="tutorial-title">{def.title}</div>
				<div className="tutorial-text">{(touch && def.touchText) || def.text}</div>
				<div className="tutorial-dots">
					{STEPS.map((_, i) => (
						<span key={i} className={`dot ${i < step ? 'done' : i === step ? 'now' : ''}`} />
					))}
				</div>
			</div>
			{isLast ? (
				<button className="tutorial-btn" onClick={() => setTutorialStep(99)}>
					<Icon name="check" size={15} /> Finish
				</button>
			) : (
				<button className="tutorial-skip" title="Skip tutorial" aria-label="Skip tutorial" onClick={() => setTutorialStep(99)}>
					<Icon name="close" size={14} /> Skip
				</button>
			)}
		</div>
	);
}

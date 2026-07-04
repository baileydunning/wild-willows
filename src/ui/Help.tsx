import { useGame } from '../state';
import { COOP_ENABLED } from '../features';
import { Icon } from './icons';

const STEPS: Array<{ icon: string; title: string; text: string }> = [
	{ icon: 'basket', title: 'Gather', text: 'Wander the preserve and collect fallen branches, seeds, stones, and flowers from gathering spots. They regrow on their own — you only ever take what nature has already let go.' },
	{ icon: 'chest', title: 'Store', text: 'Drop materials into chests so your basket stays light — crafting can use everything in storage, wherever the chest sits.' },
	{ icon: 'hammer', title: 'Craft & unlock', text: 'Press C or the hammer button anytime, anywhere to turn materials into habitat. You begin with just a few recipes — a Grass Patch and a handful of basics. As a biome’s health rises and animals return, new recipes unlock one at a time (watch for the “New Crafting Recipe Unlocked” message). Fully restoring a biome also opens the next area, with its own set of recipes to discover.' },
	{ icon: 'pin', title: 'Rebuild', text: 'Place habitat out in the biome. Every piece raises biome health, and variety — food, water, shelter, plants, open space — raises ecological balance. Terraform with the shovel and watering can: dig a bed, water it, then interact with it to plant flowers and trees — or flood it again to shape ponds, rivers, and lakes.' },
	{ icon: 'paw', title: 'Welcome them back', text: 'When the habitat truly supports an animal, it returns on its own. Click any animal to observe it and read about its real-world life.' },
	{ icon: 'journal', title: 'Record & grow', text: 'Your field journal fills in with every return. Upgrade tools to gather more, restore harder habitats, and unlock the next biome. In the journal you can flip to “Unknown first” or search to see who you’re still missing in an area.' },
	{ icon: 'cloud', title: 'Read the weather', text: 'Each biome has its own weather that shifts on its own and slowly drifts through the seasons. Open the Weather & Seasons guide (press M) to see what’s happening across the preserve and learn how each condition shapes the biome you’re standing in. Keep an eye out — unusual weather can leave rare materials to gather while it lasts, and a few elusive animals only show themselves in the right weather, season, or time of day (their journal hint says when).' },
	{ icon: 'check', title: 'Check the board', text: 'Every day the preserve posts three small tasks on the board by the top-right menu — finish one and claim a bundle of materials. Claimed tasks tidy themselves away (press O to tuck the board out of sight). Your plantings also keep growing in real time even while the game is closed: trees take hours to reach full size, and mature habitat nudges the land a little healthier, so there’s always something new when you come back.' },
];

const KEYS: Array<{ keys: string[]; does: string }> = [
	{ keys: ['W', 'A', 'S', 'D'], does: 'Move (arrow keys work too)' },
	{ keys: ['E'], does: 'Interact — gather, open chests, craft, doors' },
	{ keys: ['Space'], does: 'Interact (same as E)' },
	{ keys: ['Click'], does: 'Observe an animal · open a placed item’s menu (move / rotate / pick up)' },
	{ keys: ['Shift', 'Click'], does: 'Instantly pick a placed object back up' },
	{ keys: ['\\'], does: 'Rotate the object you’re placing or moving a quarter-turn' },
	{ keys: ['1', '2', '3', '4'], does: 'Select a tool: basket, shovel, watering can, paint (paint works in your home)' },
	{ keys: ['C'], does: 'Open crafting — works anywhere' },
	{ keys: ['B'], does: 'Open your basket' },
	{ keys: ['J'], does: 'Open the field journal' },
	{ keys: ['K'], does: 'Open achievements' },
	{ keys: ['O'], does: 'Tuck away / show the daily task board' },
	{ keys: ['F'], does: 'Open the activity feed (last 100 events)' },
	{ keys: ['T'], does: 'Open tools & upgrades' },
	{ keys: ['P'], does: 'Open the preserve overview' },
	{ keys: ['M'], does: 'Open the weather & seasons guide' },
	{ keys: ['U'], does: 'People — invite friends & see who’s here (co-op worlds only)' },
	{ keys: ['G'], does: 'Open settings' },
	{ keys: ['H'], does: 'Open this How to Play guide' },
	{ keys: ['+', '−'], does: 'Zoom the camera in / out' },
	{ keys: ['Esc'], does: 'Close menus · cancel placing' },
];

export function HelpModal() {
	const { helpOpen, setHelpOpen, setTutorialStep, state, worlds, activeWorldId } = useGame();
	if (!helpOpen) return null;
	// In solo play there's no People/invite system, so drop those keys entirely.
	const activeWorld = worlds?.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const keys = KEYS.filter((k) => isCoop || !k.keys.includes('U'));
	const replay = () => {
		setTutorialStep(0); // restart the interactive tutorial from the first step
		setHelpOpen(false);
	};
	return (
		<div className="panel-backdrop help-backdrop" onClick={() => setHelpOpen(false)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="help" size={20} /> How to Play</h2>
					<div className="help-head-actions">
						{state && (
							<button className="help-replay-btn" onClick={replay} title="Restart the interactive tutorial">
								<Icon name="play" size={14} /> Replay tutorial
							</button>
						)}
						<button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close"><Icon name="close" /></button>
					</div>
				</div>
				<div className="panel-body">
					<p className="help-intro">
						Wild Willows is a gentle loop: gather what nature has let go, craft it into habitat,
						place it in the biome, and welcome wildlife home. New recipes unlock as each biome recovers.
					</p>
					<div className="help-section-label"><Icon name="leaf" size={15} /> The loop</div>
					<div className="help-steps">
						{STEPS.map((s, i) => (
							<div className="help-step" key={s.title}>
								<div className="help-step-icon"><Icon name={s.icon} size={22} /><span className="step-num">{i + 1}</span></div>
								<div>
									<b>{s.title}</b>
									<p>{s.text}</p>
								</div>
							</div>
						))}
					</div>
					<div className="help-section-label"><Icon name="keyboard" size={15} /> Keyboard & mouse</div>
					<div className="key-list">
						{keys.map((k) => (
							<div className="key-row" key={k.does}>
								<span className="kbds">
									{k.keys.map((key) => (
										<kbd key={key}>{key}</kbd>
									))}
								</span>
								<span>{k.does}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

import { padCap, usePadState } from '../gamepad/glyphs';
import type { BtnName } from '../gamepad/pad';

const KIND: Record<BtnName, 'face' | 'shoulder' | 'system' | 'stick' | 'dpad'> = {
	A: 'face',
	B: 'face',
	X: 'face',
	Y: 'face',
	LB: 'shoulder',
	RB: 'shoulder',
	LT: 'shoulder',
	RT: 'shoulder',
	VIEW: 'system',
	MENU: 'system',
	LS: 'stick',
	RS: 'stick',
	UP: 'dpad',
	DOWN: 'dpad',
	LEFT: 'dpad',
	RIGHT: 'dpad',
};

/**
 * A controller button drawn the way it looks on the pad in use: face buttons
 * as round buttons (in Xbox and PlayStation colours on those pads, plain on a
 * Steam Deck or Switch), bumpers and triggers as shoulder tabs, sticks as a
 * ring, the d-pad as a cross key. The label is the pad's own (A / ✕ / L1 …).
 */
export function PadCap({ btn, className = '' }: { btn: BtnName; className?: string }) {
	const { family } = usePadState();
	return (
		<kbd className={`pad-cap pad-cap-${KIND[btn]} ${className}`} data-family={family} data-btn={btn} aria-hidden="true">
			{padCap(btn)}
		</kbd>
	);
}

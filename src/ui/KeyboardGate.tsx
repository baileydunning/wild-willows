import { useEffect, useState, type ReactNode } from 'react';

/**
 * Wild Willows is a keyboard game (WASD / arrows to roam, letter keys for
 * panels, number keys for tools), so it only runs where a keyboard is
 * available. We treat any device with a fine pointer (mouse, trackpad, or
 * stylus) as a computer, and otherwise block until a real key is pressed —
 * which also lets tablets with an attached keyboard through.
 */

function hasFinePointer(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return true;
	return window.matchMedia('(any-pointer: fine)').matches;
}

export function KeyboardGate({ children }: { children: ReactNode }) {
	const [finePointer, setFinePointer] = useState(hasFinePointer);
	const [keyboardSeen, setKeyboardSeen] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia('(any-pointer: fine)');
		const onChange = () => setFinePointer(mql.matches);
		mql.addEventListener?.('change', onChange);

		// A genuine key press (not a lone modifier) proves a keyboard is attached.
		const onKey = (e: KeyboardEvent) => {
			if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
			setKeyboardSeen(true);
		};
		window.addEventListener('keydown', onKey);
		return () => {
			mql.removeEventListener?.('change', onChange);
			window.removeEventListener('keydown', onKey);
		};
	}, []);

	if (finePointer || keyboardSeen) return <>{children}</>;

	return (
		<div className="kb-gate">
			<div className="kb-gate-card">
				<h1>Wild Willows needs a keyboard</h1>
				<div className="kb-gate-keys" aria-hidden="true">
					<kbd>W</kbd>
					<kbd>A</kbd>
					<kbd>S</kbd>
					<kbd>D</kbd>
				</div>
				<p>
					You roam the preserve with <b>WASD</b> or the <b>arrow keys</b>, and reach for
					your basket, tools, and journal with shortcut keys — so it doesn&rsquo;t work on a
					phone or tablet on its own.
				</p>
				<p className="kb-gate-hint">
					Open Wild Willows on a computer, or connect a keyboard and press any key to begin.
				</p>
			</div>
		</div>
	);
}

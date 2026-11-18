import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/react';
import { reportKeyboardGate } from '../solo/appOpen';

/**
 * Wild Willows is played with a keyboard or a controller (WASD / arrows or a
 * stick to roam, letter keys or face buttons for panels), so it only runs where
 * one of those is available. We treat any device with a fine pointer (mouse,
 * trackpad, or stylus) as a computer, and otherwise block until a real key or a
 * controller button is pressed — which lets tablets with an attached keyboard,
 * and a Steam Deck with its touchscreen as the only pointer, through.
 */

function hasFinePointer(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return true;
	return window.matchMedia('(any-pointer: fine)').matches;
}

export function KeyboardGate({ children }: { children: ReactNode }) {
	const { t } = useI18n();
	const [finePointer, setFinePointer] = useState(hasFinePointer);
	// The desktop app is never on a phone; the only "no keyboard" desktop is a
	// Steam Deck, which has its controls built in.
	const [keyboardSeen, setKeyboardSeen] = useState(() => !!(globalThis as any).wildWillowsDesktop?.isDesktop);
	const blocked = !finePointer && !keyboardSeen;
	const reported = useRef({ blocked: false, gotIn: false });

	/* Report being turned away, and report getting in afterwards.
	 *
	 * Nothing is sent for a device that is never blocked, which is almost all of
	 * them — the ping exists to describe the people this screen stops, and a
	 * silent no-op on a computer keeps it that way.
	 *
	 * Both sends are latched, because `blocked` can flip more than once in a
	 * visit: (any-pointer: fine) is live, so unplugging a mouse re-blocks a
	 * desktop, and without the latch that would post again on every flip and
	 * count one person as several. */
	useEffect(() => {
		if (blocked) {
			if (reported.current.blocked) return;
			reported.current.blocked = true;
			reportKeyboardGate(false);
		} else if (reported.current.blocked && !reported.current.gotIn) {
			// Blocked earlier this visit, playing now — a keyboard turned up.
			reported.current.gotIn = true;
			reportKeyboardGate(true);
		}
	}, [blocked]);

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
		// A controller counts the same as a keyboard. Browsers only expose a pad
		// after one of its buttons is pressed, so 'gamepadconnected' firing IS
		// that press.
		const onPad = () => setKeyboardSeen(true);
		window.addEventListener('gamepadconnected', onPad);
		return () => {
			mql.removeEventListener?.('change', onChange);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('gamepadconnected', onPad);
		};
	}, []);

	if (!blocked) return <>{children}</>;

	return (
		<div className="kb-gate">
			<div className="kb-gate-card">
				<h1>{t('app.kbGate.title')}</h1>
				<div className="kb-gate-keys" aria-hidden="true">
					<kbd>W</kbd>
					<kbd>A</kbd>
					<kbd>S</kbd>
					<kbd>D</kbd>
				</div>
				<p>
					{t('app.kbGate.body1')}
					<b>{t('app.kbGate.wasd')}</b>
					{t('app.kbGate.body2')}
					<b>{t('app.kbGate.arrowKeys')}</b>
					{t('app.kbGate.body3')}
				</p>
				<p className="kb-gate-hint">{t('app.kbGate.hint')}</p>
				<p className="kb-gate-hint">{t('app.kbGate.pad')}</p>
			</div>
		</div>
	);
}

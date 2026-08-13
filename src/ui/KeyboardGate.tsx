import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/react';
import { reportKeyboardGate } from '../solo/appOpen';

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
	const { t } = useI18n();
	const [finePointer, setFinePointer] = useState(hasFinePointer);
	const [keyboardSeen, setKeyboardSeen] = useState(false);
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
		return () => {
			mql.removeEventListener?.('change', onChange);
			window.removeEventListener('keydown', onKey);
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
			</div>
		</div>
	);
}

import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/react';

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

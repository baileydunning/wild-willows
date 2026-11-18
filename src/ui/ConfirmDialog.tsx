// In-game replacement for window.confirm() while playing on a controller.
//
// The native dialog is drawn by the OS, outside the page: a controller cannot
// reach it, and on a Steam Deck in Game Mode it can open behind the game or
// with no way to press OK at all. This one is ordinary DOM, so the controller's
// focus ring, the mouse and the keyboard all work on it, and it reads in the
// game's own style.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/react';
import { getInputMode, getPadFamily } from '../gamepad/pad';

interface Pending {
	message: string;
	resolve: (ok: boolean) => void;
}

const queue: Pending[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};
const current = () => queue[0] || null;

/** Ask a yes/no question; resolves true for OK, false for Cancel or Escape.
 *  On keyboard and mouse this is the same native confirm the game always used;
 *  the in-game dialog only stands in while a controller is in hand (or on a
 *  Steam Deck, where the native one can't be reached at all). */
export function confirmAsync(message: string): Promise<boolean> {
	if (getInputMode() !== 'pad' && getPadFamily() !== 'deck') return Promise.resolve(window.confirm(message));
	return new Promise((resolve) => {
		queue.push({ message, resolve });
		notify();
	});
}

function answer(ok: boolean) {
	const p = queue.shift();
	notify();
	p?.resolve(ok);
}

export function ConfirmHost() {
	const { t } = useI18n();
	const pending = useSyncExternalStore(subscribe, current, current);
	const okRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!pending) return;
		okRef.current?.focus({ preventScroll: true });
		// Capture phase, ahead of App's Escape chain: Escape answers THIS question
		// and must not also close the panel underneath it.
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				answer(false);
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [pending]);

	if (!pending) return null;
	return (
		<div className="panel-backdrop confirm-backdrop" onClick={() => answer(false)}>
			<div
				className="panel confirm-card"
				role="alertdialog"
				aria-modal="true"
				aria-describedby="confirm-msg"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="panel-body">
					<p id="confirm-msg" className="confirm-msg">
						{pending.message}
					</p>
					<div className="confirm-actions">
						<button type="button" className="big-btn subtle" onClick={() => answer(false)}>
							{t('app.confirmDialog.cancel')}
						</button>
						<button
							type="button"
							ref={okRef}
							className="big-btn primary"
							data-pad-default=""
							onClick={() => answer(true)}
						>
							{t('app.confirmDialog.ok')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

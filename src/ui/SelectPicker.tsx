// The game's own dropdown list, standing in for the browser's.
//
// On a controller a dropdown opens with A, as a list of its options the focus
// ring moves through; A picks one and B leaves it as it was. Nothing changes
// just by pushing the stick past it. On a Steam Deck a click or tap opens this
// list too, since the native popup is drawn by the OS outside the game.

import { useEffect, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/react';
import { getInputMode, getPadFamily } from '../gamepad/pad';
import { preferRing, setFieldValue } from '../gamepad/nav';
import { Icon } from './icons';

let target: HTMLSelectElement | null = null;
let openId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};
const current = () => target;

export function openSelectPicker(el: HTMLSelectElement) {
	target = el;
	openId++;
	emit();
}

function close(pick?: string) {
	const el = target;
	target = null;
	emit();
	if (!el?.isConnected) return;
	if (pick !== undefined && pick !== el.value) setFieldValue(el, pick);
	preferRing(el);
}

/** The visible label for a dropdown: its aria-label, or the <label> around or
 *  beside it. */
function labelFor(el: HTMLSelectElement): string {
	const aria = el.getAttribute('aria-label');
	if (aria) return aria;
	const wrap = el.closest('label');
	if (wrap) return (wrap.textContent || '').replace(el.textContent || '', '').trim();
	if (el.id) {
		const l = document.querySelector(`label[for="${el.id}"]`);
		if (l?.textContent) return l.textContent.trim();
	}
	return '';
}

export function SelectPicker() {
	const field = useSyncExternalStore(subscribe, current, current);
	return field ? <SelectCard key={openId} field={field} /> : null;
}

function SelectCard({ field }: { field: HTMLSelectElement }) {
	const { t } = useI18n();

	// Escape (and the controller's B, which sends it) closes THIS, not the panel
	// the dropdown sits in.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopImmediatePropagation();
			close();
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, []);

	const options = Array.from(field.options);
	const label = labelFor(field) || t('app.selectPicker.title');
	return (
		<div className="panel-backdrop sp-backdrop" onClick={() => close()}>
			<div
				className="panel sp-card"
				role="dialog"
				aria-modal="true"
				aria-label={label}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="panel-head">
					<h2>{label}</h2>
					<button className="icon-btn" onClick={() => close()} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body sp-body" role="listbox" aria-label={label}>
					{options.map((o) => {
						const on = o.value === field.value;
						return (
							<button
								key={o.value}
								type="button"
								role="option"
								aria-selected={on}
								className={`sp-option ${on ? 'on' : ''}`}
								disabled={o.disabled}
								data-pad-default={on ? '' : undefined}
								onClick={() => close(o.value)}
							>
								<span>{o.textContent}</span>
								{on && <Icon name="check" size={15} />}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/* On a controller, and always on a Steam Deck, a dropdown opens this list
 * instead of the OS popup (which opens on mousedown, so that's what to stop). */
if (typeof window !== 'undefined') {
	window.addEventListener(
		'mousedown',
		(e) => {
			const el = e.target as HTMLSelectElement | null;
			if (!el || el.tagName !== 'SELECT' || el.disabled) return;
			if (getInputMode() !== 'pad' && getPadFamily() !== 'deck') return;
			e.preventDefault();
			openSelectPicker(el);
		},
		true,
	);
}

// The game's own on-screen keyboard, for typing with a controller.
//
// Steam's keyboard only appears for games Steam launched with their own app id,
// and never for a field tapped on a Steam Deck's touchscreen, so a caretaker
// could be stuck at "make a caretaker" with no way to type a name. This one is
// part of the page: the controller's focus ring moves over its keys like any
// other buttons, the touchscreen can tap them, and it is drawn in the game's
// storybook style.
//
// Letters are written into the real field through its native value setter and
// an input event, so React's onChange runs exactly as it does for typing.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/react';
import { padCap, usePadState } from '../gamepad/glyphs';
import { preferRing, setFieldValue } from '../gamepad/nav';
import { getPadFamily } from '../gamepad/pad';
import { Icon } from './icons';

type Field = HTMLInputElement | HTMLTextAreaElement;

let target: Field | null = null;
let openId = 0; // a fresh card per opening, so its state starts from the field
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};
const current = () => target;

/** Open the keyboard for a text field. */
export function openKeyboard(el: Field) {
	target = el;
	openId++;
	emit();
}
export function keyboardOpen() {
	return !!target && target.isConnected;
}

/** Close it, and hand the controller's focus ring back to the field. */
export function closeKeyboard() {
	const el = target;
	target = null;
	emit();
	if (el?.isConnected) preferRing(el);
}

// Controller shortcuts, wired up by GamepadLayer while the keyboard is the
// surface in front: X deletes, Y is a space, L1 is shift, Menu is done.
const actions = { backspace: () => {}, space: () => {}, shift: () => {} };
export const keyboardActions = {
	backspace: () => actions.backspace(),
	space: () => actions.space(),
	shift: () => actions.shift(),
};

const ROWS_EN = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const ROWS_ES = ['1234567890', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
// Kept small and useful: what turns up in names, notes and searches.
const EXTRAS = ["'", '-', '.', ',', '!', '?'];

function isNumeric(el: Field) {
	return el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'number';
}

export function OnScreenKeyboard() {
	const field = useSyncExternalStore(subscribe, current, current);
	return field ? <KeyboardCard key={openId} field={field} /> : null;
}

function KeyboardCard({ field }: { field: Field }) {
	const { t, locale } = useI18n();
	const pad = usePadState();
	const [text, setText] = useState(() => field.value);
	// One-shot shift, like a phone: it capitalizes the next letter and lets go.
	// A name starts capitalized.
	const [shift, setShift] = useState(() => field.value.length === 0 && !isNumeric(field));
	const [pressed, setPressed] = useState<string | null>(null);
	const pressTimer = useRef<number>(0);

	// A real keyboard (or the field vanishing, e.g. its screen closed) ends it.
	// Focus moves to the field during keydown, before the key's character is
	// inserted, so the key that was pressed still lands in the field.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!e.isTrusted) return;
			const el = field;
			target = null;
			emit();
			el.focus();
		};
		const gone = window.setInterval(() => {
			if (!field.isConnected) closeKeyboard();
		}, 500);
		window.addEventListener('keydown', onKey, true);
		return () => {
			window.removeEventListener('keydown', onKey, true);
			window.clearInterval(gone);
		};
	}, [field]);

	const max = field.maxLength > 0 ? field.maxLength : 200;
	const numeric = isNumeric(field);
	const multiline = field.tagName === 'TEXTAREA';
	const label = field.getAttribute('aria-label') || field.getAttribute('placeholder') || t('app.keyboard.title');
	const password = field.tagName === 'INPUT' && (field as HTMLInputElement).type === 'password';

	const write = (next: string) => {
		const v = next.slice(0, max);
		setFieldValue(field, v);
		setText(field.value); // read back: a field may refuse or reformat the edit
	};
	const flash = (k: string) => {
		setPressed(k);
		window.clearTimeout(pressTimer.current);
		pressTimer.current = window.setTimeout(() => setPressed(null), 140);
	};
	const type = (ch: string) => {
		flash(ch);
		write(text + (shift ? ch.toUpperCase() : ch));
		if (shift) setShift(false);
	};
	const backspace = () => {
		flash('⌫');
		write(text.slice(0, -1));
	};
	const space = () => {
		if (numeric) return;
		flash(' ');
		write(text + ' ');
	};
	// Point the controller shortcuts at this render's handlers.
	useEffect(() => {
		actions.backspace = backspace;
		actions.space = space;
		actions.shift = () => setShift((v) => !v);
	});

	const rows = numeric ? ['123', '456', '789', '0'] : locale.startsWith('es') ? ROWS_ES : ROWS_EN;
	const key = (ch: string, i: number, row: number) => (
		<button
			key={ch}
			type="button"
			className={`osk-key ${pressed === ch ? 'osk-pressed' : ''}`}
			// Start on the first letter, where a name begins.
			data-pad-default={(numeric ? row === 0 && i === 0 : row === 1 && i === 0) ? '' : undefined}
			onClick={() => type(ch)}
		>
			{shift && !numeric ? ch.toUpperCase() : ch}
		</button>
	);
	const shown = password ? '•'.repeat(text.length) : text;
	const onPad = pad.mode === 'pad';

	return (
		<div className="osk-backdrop" onClick={closeKeyboard}>
			<div
				className="osk"
				role="dialog"
				aria-modal="true"
				aria-label={t('app.keyboard.title')}
				data-pad-keyboard=""
				onClick={(e) => e.stopPropagation()}
			>
				<div className="osk-head">
					<span className="osk-label">
						<Icon name="leaf" size={15} /> {label}
					</span>
					<span className="osk-count">
						{text.length}/{max}
					</span>
				</div>
				<div className={`osk-preview ${text ? '' : 'osk-empty'}`} aria-live="polite">
					<span className="osk-text">{shown || field.getAttribute('placeholder') || ''}</span>
					<span className="osk-caret" aria-hidden="true" />
				</div>
				<div className="osk-rows">
					{rows.map((r, ri) => (
						<div className="osk-row" key={r}>
							{Array.from(r).map((ch, i) => key(ch, i, ri))}
							{!numeric && ri === 3 && EXTRAS.slice(0, 3).map((ch, i) => key(ch, i + 10, ri))}
						</div>
					))}
					<div className="osk-row osk-row-bottom">
						{!numeric && (
							<button
								type="button"
								className={`osk-key osk-wide osk-mod ${shift ? 'on' : ''}`}
								aria-pressed={shift}
								aria-label={t('app.keyboard.shift')}
								onClick={() => setShift((s) => !s)}
							>
								⇧
							</button>
						)}
						{!numeric && EXTRAS.slice(3).map((ch, i) => key(ch, i, 4))}
						{!numeric && (
							<button
								type="button"
								className={`osk-key osk-space ${pressed === ' ' ? 'osk-pressed' : ''}`}
								onClick={space}
							>
								{t('app.keyboard.space')}
							</button>
						)}
						{multiline && (
							<button
								type="button"
								className="osk-key osk-wide osk-mod"
								aria-label={t('app.keyboard.newline')}
								onClick={() => write(text + '\n')}
							>
								↵
							</button>
						)}
						<button
							type="button"
							className={`osk-key osk-wide osk-mod ${pressed === '⌫' ? 'osk-pressed' : ''}`}
							aria-label={t('app.keyboard.backspace')}
							onClick={backspace}
						>
							⌫
						</button>
						<button type="button" className="osk-key osk-done" onClick={closeKeyboard}>
							<Icon name="check" size={16} /> {t('app.keyboard.done')}
						</button>
					</div>
				</div>
				{onPad && (
					<div className="osk-hints" aria-hidden="true">
						<span>
							<kbd className="pad-cap">{padCap('X')}</kbd> {t('app.keyboard.backspace')}
						</span>
						{!numeric && (
							<span>
								<kbd className="pad-cap">{padCap('Y')}</kbd> {t('app.keyboard.space')}
							</span>
						)}
						{!numeric && (
							<span>
								<kbd className="pad-cap">{padCap('LB')}</kbd> {t('app.keyboard.shift')}
							</span>
						)}
						<span>
							<kbd className="pad-cap">{padCap('MENU')}</kbd> {t('app.keyboard.done')}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

/* On a Steam Deck, tapping a text field on the touchscreen opens the keyboard
 * too — there is no physical one to type with. */
if (typeof window !== 'undefined') {
	window.addEventListener(
		'pointerup',
		(e) => {
			if (!e.isTrusted || e.pointerType !== 'touch' || getPadFamily() !== 'deck') return;
			const el = e.target as HTMLElement | null;
			if (!el || el.closest('.osk')) return;
			const tag = el.tagName;
			const type = tag === 'INPUT' ? (el as HTMLInputElement).type : '';
			if (
				tag === 'TEXTAREA' ||
				(tag === 'INPUT' && ['text', 'search', 'email', 'password', 'number', ''].includes(type))
			)
				openKeyboard(el as Field);
		},
		true,
	);
}

// The game's own color picker, standing in for the browser's.
//
// The native picker is a separate OS window: a controller can't drive it, and
// on a Steam Deck it opened off to one side of the screen. While a controller
// is in hand (and always on a Deck) a click on any color input opens this
// instead: a grid of swatches the focus ring, a tap or the mouse can pick from.
// The choice is written into the real input through its native setter and an
// input event, so each field's onChange runs exactly as it does for the OS one.

import { useEffect, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/react';
import { getInputMode, getPadFamily } from '../gamepad/pad';
import { preferRing, setFieldValue } from '../gamepad/nav';
import { Icon } from './icons';

let target: HTMLInputElement | null = null;
let openId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};
const current = () => target;

function close(pick?: string) {
	const el = target;
	target = null;
	emit();
	if (!el?.isConnected) return;
	if (pick) setFieldValue(el, pick);
	// hand the ring back to the swatch control that opened this
	preferRing((el.closest('label') as HTMLElement) || el);
}

function hsl(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const hex = (x: number) =>
		Math.round(x * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

// Twelve hues, light to deep, then a row of earthy skin and wood tones and a
// row of greys: enough to land near any color the OS picker could reach.
const HUES = [0, 18, 32, 45, 58, 90, 135, 170, 195, 220, 260, 300, 330];
const TONES: Array<[number, number]> = [
	[60, 82],
	[55, 68],
	[50, 54],
	[45, 40],
	[40, 27],
];
const EARTH = ['#f6dcc4', '#e8c0a0', '#d49a72', '#b97a52', '#9a5f3e', '#7a4a30', '#5a3624', '#3e2618'];
const GREYS = ['#ffffff', '#e4e1da', '#c4c0b8', '#9c988f', '#76736c', '#55524c', '#36342f', '#1c1b18'];
const ROWS: string[][] = [...TONES.map(([s, l]) => HUES.map((h) => hsl(h, s, l))), EARTH, GREYS];

function nearest(hex: string): string {
	const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
	const [r, g, b] = rgb(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000');
	let best = ROWS[0][0];
	let bd = Infinity;
	for (const row of ROWS)
		for (const c of row) {
			const [r2, g2, b2] = rgb(c);
			const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
			if (d < bd) {
				bd = d;
				best = c;
			}
		}
	return best;
}

export function ColorPicker() {
	const field = useSyncExternalStore(subscribe, current, current);
	return field ? <PickerCard key={openId} field={field} /> : null;
}

function PickerCard({ field }: { field: HTMLInputElement }) {
	const { t } = useI18n();
	const now = field.value;
	const start = nearest(now);

	// Escape (and the controller's B, which sends it) cancels THIS, not the
	// panel underneath.
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

	const label = field.getAttribute('aria-label') || t('app.colorPicker.title');
	return (
		<div className="panel-backdrop cp-backdrop" onClick={() => close()}>
			<div
				className="panel cp-card"
				role="dialog"
				aria-modal="true"
				aria-label={label}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="panel-head">
					<h2>
						<Icon name="eyedropper" size={18} /> {label}
					</h2>
					<button className="icon-btn" onClick={() => close()} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body cp-body">
					<div className="cp-grid">
						{ROWS.map((row, ri) => (
							<div className="cp-row" key={ri}>
								{row.map((c) => (
									<button
										key={c}
										type="button"
										className={`cp-swatch ${c === start ? 'cp-current' : ''}`}
										style={{ background: c }}
										aria-label={c}
										title={c}
										data-pad-default={c === start ? '' : undefined}
										onClick={() => close(c)}
									/>
								))}
							</div>
						))}
					</div>
					<div className="cp-now">
						<span className="cp-now-chip" style={{ background: now }} aria-hidden="true" />
						{t('app.colorPicker.current')}
					</div>
				</div>
			</div>
		</div>
	);
}

/* Route color inputs here instead of the OS picker while a controller is in
 * use, and always on a Steam Deck. Capture phase, so the browser's own picker
 * never opens. A mouse on a laptop still gets the native one. */
if (typeof window !== 'undefined') {
	window.addEventListener(
		'click',
		(e) => {
			const el = e.target as HTMLInputElement | null;
			if (!el || el.tagName !== 'INPUT' || el.type !== 'color') return;
			if (getInputMode() !== 'pad' && getPadFamily() !== 'deck') return;
			e.preventDefault();
			target = el;
			openId++;
			emit();
		},
		true,
	);
}

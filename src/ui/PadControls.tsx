import { padCap, usePadState } from '../gamepad/glyphs';
import type { BtnName } from '../gamepad/pad';
import { useI18n } from '../i18n/react';
import { PAD_SHORTCUTS, type PadCapToken } from '../shortcuts';
import { PadCap } from './PadCap';

const WORDS: Partial<Record<PadCapToken, string>> = {
	LSTICK: 'panels.help.pad.cap.leftStick',
	RSTICK: 'panels.help.pad.cap.rightStick',
	DPAD: 'panels.help.pad.cap.dpad',
};

/** The controller map: world controls, then the ones that apply in menus. */
export function PadControls() {
	const { t } = useI18n();
	usePadState(); // re-render with the glyphs of whichever pad is in use
	const cap = (c: PadCapToken): string => {
		const word = WORDS[c];
		if (word) return t(word);
		if (c === 'DPAD_UD') return `${t('panels.help.pad.cap.dpad')} ${padCap('UP')}${padCap('DOWN')}`;
		if (c === 'DPAD_LR') return `${t('panels.help.pad.cap.dpad')} ${padCap('LEFT')}${padCap('RIGHT')}`;
		return '';
	};
	const rows = (menus: boolean) =>
		PAD_SHORTCUTS.filter((s) => !!s.menus === menus).map((s) => (
			<div className="key-row" key={`${s.does}-${menus}`}>
				<span className="kbds">
					{s.caps.map((c) =>
						WORDS[c] || c === 'DPAD_UD' || c === 'DPAD_LR' ? (
							<kbd key={c} className="pad-cap pad-cap-word">
								{cap(c)}
							</kbd>
						) : (
							<PadCap key={c} btn={c as BtnName} />
						),
					)}
				</span>
				<span>{t(s.does)}</span>
			</div>
		));
	return (
		<>
			<div className="key-list">{rows(false)}</div>
			<p className="pad-controls-sub">{t('panels.help.pad.inMenus')}</p>
			<div className="key-list">{rows(true)}</div>
		</>
	);
}

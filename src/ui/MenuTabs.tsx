import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { padCap, usePadState } from '../gamepad/glyphs';
import { MENU_CYCLE, currentMenu, menuName, openMenu } from '../gamepad/menus';
import { Icon } from './icons';

/**
 * The strip of menu tabs over an open menu while playing on a controller, the
 * way a console pause menu shows where L1/R1 will take you. Every tab is also a
 * button, so a tap on a Steam Deck's screen works as well.
 */
export function MenuTabs() {
	const game = useGame();
	const { t } = useI18n();
	const pad = usePadState();
	const cur = currentMenu(game);
	if (pad.mode !== 'pad' || !cur) return null;
	return (
		<nav className="menu-tabs" aria-label={t('app.menuTabs.label')}>
			<kbd className="pad-cap menu-tabs-cap" aria-hidden="true">
				{padCap('LB')}
			</kbd>
			{MENU_CYCLE.map((m) => {
				const name = menuName(t(m.label));
				const on = m.id === cur;
				return (
					<button
						key={m.id}
						type="button"
						className={`menu-tab ${on ? 'on' : ''}`}
						aria-current={on ? 'page' : undefined}
						aria-label={name}
						title={name}
						tabIndex={-1}
						onClick={() => openMenu(game, m.id)}
					>
						<Icon name={m.icon} size={18} />
						{on && <span className="menu-tab-name">{name}</span>}
					</button>
				);
			})}
			<kbd className="pad-cap menu-tabs-cap" aria-hidden="true">
				{padCap('RB')}
			</kbd>
		</nav>
	);
}

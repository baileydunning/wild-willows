// The game's menus, in the order the HUD lists them. On a controller, Y, X and
// Menu open the journal, crafting and Tools & Upgrades, and L1/R1 move between all of
// them like the tabs of a pause menu (GamepadLayer + MenuTabs). How to Play is a modal rather than a panel, so it
// is handled by name.

export type MenuId =
	| 'journal'
	| 'achievements'
	| 'feed'
	| 'inventory'
	| 'crafting'
	| 'tools'
	| 'goals'
	| 'biomes'
	| 'weather'
	| 'settings'
	| 'help';

export const MENU_CYCLE: Array<{ id: MenuId; icon: string; label: string }> = [
	{ id: 'journal', icon: 'journal', label: 'app.hud.navJournal' },
	{ id: 'achievements', icon: 'star', label: 'app.hud.navAchievements' },
	{ id: 'feed', icon: 'chat', label: 'app.hud.navFeed' },
	{ id: 'inventory', icon: 'basket', label: 'app.hud.navInventory' },
	{ id: 'crafting', icon: 'hammer', label: 'app.hud.navCrafting' },
	{ id: 'tools', icon: 'tools', label: 'app.hud.navTools' },
	{ id: 'goals', icon: 'target', label: 'app.hud.navGoals' },
	{ id: 'biomes', icon: 'map', label: 'app.hud.navBiomes' },
	{ id: 'weather', icon: 'cloud', label: 'app.hud.navWeather' },
	{ id: 'settings', icon: 'gear', label: 'app.hud.settings' },
	{ id: 'help', icon: 'help', label: 'app.hud.howToPlay' },
];

/** The HUD labels carry their keyboard key, "Field journal (J)"; the tab bar
 *  shows the name alone. */
export function menuName(label: string): string {
	return label.replace(/\s*\([^)]*\)\s*$/, '');
}

interface MenuGame {
	panel: string | null;
	helpOpen: boolean;
	setPanel: (p: any) => void;
	setHelpOpen: (v: boolean) => void;
}

/** Which cycle menu is open right now, if any. */
export function currentMenu(g: MenuGame): MenuId | null {
	if (g.helpOpen) return 'help';
	return MENU_CYCLE.some((m) => m.id === g.panel) ? (g.panel as MenuId) : null;
}

export function openMenu(g: MenuGame, id: MenuId) {
	if (id === 'help') {
		g.setPanel(null);
		g.setHelpOpen(true);
		return;
	}
	if (g.helpOpen) g.setHelpOpen(false);
	g.setPanel(id);
}

/** L1/R1: the previous or next menu, wrapping. Returns false when no cycle
 *  menu is open (a chest, an animal card, the telescope…). */
export function stepMenu(g: MenuGame, sign: number): boolean {
	const cur = currentMenu(g);
	if (!cur) return false;
	const i = MENU_CYCLE.findIndex((m) => m.id === cur);
	openMenu(g, MENU_CYCLE[(i + sign + MENU_CYCLE.length) % MENU_CYCLE.length].id);
	return true;
}

export function closeMenu(g: MenuGame) {
	if (g.helpOpen) g.setHelpOpen(false);
	else g.setPanel(null);
}

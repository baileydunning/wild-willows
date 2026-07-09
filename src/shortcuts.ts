// Single source of truth for the player-facing controls list. Both the How to
// Play modal (Help.tsx) and the Settings "Controls" section render this table,
// so the two can never drift apart. `does` is an i18n key (panels.help.keys.*);
// the literal key caps stay as-is and aren't translated.
export interface Shortcut {
	keys: string[];
	does: string;
}

export const SHORTCUTS: Shortcut[] = [
	{ keys: ['W', 'A', 'S', 'D'], does: 'panels.help.keys.move' },
	{ keys: ['E'], does: 'panels.help.keys.interact' },
	{ keys: ['Space'], does: 'panels.help.keys.space' },
	{ keys: ['Click'], does: 'panels.help.keys.click' },
	{ keys: ['Shift', 'Click'], does: 'panels.help.keys.shiftClick' },
	{ keys: ['\\'], does: 'panels.help.keys.rotate' },
	{ keys: ['1', '2', '3', '4'], does: 'panels.help.keys.toolSelect' },
	{ keys: ['C'], does: 'panels.help.keys.crafting' },
	{ keys: ['B'], does: 'panels.help.keys.basket' },
	{ keys: ['J'], does: 'panels.help.keys.journal' },
	{ keys: ['K'], does: 'panels.help.keys.achievements' },
	{ keys: ['Tab'], does: 'panels.help.keys.tasks' },
	{ keys: ['G'], does: 'panels.help.keys.goals' },
	{ keys: ['F'], does: 'panels.help.keys.feed' },
	{ keys: ['T'], does: 'panels.help.keys.tools' },
	{ keys: ['M', 'P'], does: 'panels.help.keys.preserve' },
	{ keys: ['N'], does: 'panels.help.keys.weather' },
	{ keys: ['U'], does: 'panels.help.keys.people' },
	{ keys: ['O'], does: 'panels.help.keys.settings' },
	{ keys: ['H'], does: 'panels.help.keys.help' },
	{ keys: ['+', '−'], does: 'panels.help.keys.zoom' },
	{ keys: ['Esc'], does: 'panels.help.keys.esc' },
];

/** The controls to show for the current world — the People/invite key (U) only
 *  applies to co-op worlds, so it's dropped in solo play. */
export function visibleShortcuts(isCoop: boolean): Shortcut[] {
	return SHORTCUTS.filter((s) => isCoop || !s.keys.includes('U'));
}

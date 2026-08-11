// Single source of truth for the player-facing controls list. Both the How to
// Play modal (Help.tsx) and the Settings "Controls" section render this table,
// so the two can never drift apart. `does` is an i18n key (panels.help.keys.*);
// the literal key caps stay as-is and aren't translated.
import { getBindings, keyLabel } from './keybindings';

export interface Shortcut {
	keys: string[];
	does: string;
}

export const SHORTCUTS: Shortcut[] = [
	{ keys: ['W', 'A', 'S', 'D'], does: 'panels.help.keys.move' },
	{ keys: ['E'], does: 'panels.help.keys.interact' },
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
	{ keys: ['O'], does: 'panels.help.keys.settings' },
	{ keys: ['H'], does: 'panels.help.keys.help' },
	{ keys: ['+', '−'], does: 'panels.help.keys.zoom' },
	{ keys: ['Esc'], does: 'panels.help.keys.esc' },
];

/** The controls to show. Every shortcut applies now that there is one world. */
export function visibleShortcuts(): Shortcut[] {
	return SHORTCUTS;
}

// Which bindable action(s) each controls-row maps to, so the How to Play table
// shows the player's CURRENT keys, not the built-in defaults. Rows not listed
// here (Space, Click, rotate, zoom, Esc, Tab) are fixed and shown as authored.
const DOES_ACTIONS: Record<string, string[]> = {
	'panels.help.keys.move': ['moveUp', 'moveLeft', 'moveDown', 'moveRight'],
	'panels.help.keys.interact': ['interact'],
	'panels.help.keys.toolSelect': ['tool1', 'tool2', 'tool3', 'tool4'],
	'panels.help.keys.crafting': ['crafting'],
	'panels.help.keys.basket': ['basket'],
	'panels.help.keys.journal': ['journal'],
	'panels.help.keys.achievements': ['achievements'],
	'panels.help.keys.goals': ['goals'],
	'panels.help.keys.feed': ['feed'],
	'panels.help.keys.tools': ['tools'],
	'panels.help.keys.preserve': ['preserve'],
	'panels.help.keys.weather': ['weather'],
	'panels.help.keys.settings': ['settings'],
	'panels.help.keys.help': ['help'],
};

/** The key caps to show for a controls row — live bindings when it maps to
 *  rebindable actions, otherwise the fixed caps it was authored with. */
export function shortcutKeys(s: Shortcut): string[] {
	const ids = DOES_ACTIONS[s.does];
	if (!ids) return s.keys;
	const b = getBindings();
	const out: string[] = [];
	for (const id of ids) for (const tok of b[id] || []) out.push(keyLabel(tok));
	return out;
}

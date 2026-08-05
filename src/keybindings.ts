// Player-customizable keyboard bindings. Each action has one or two key slots —
// a primary and an optional alternate (movement is WASD / arrows, interact is
// E / Space) — both of which work and both of which are rebindable. Defaults are
// built in; overrides live per-player in prefs (localStorage). Settings' Controls
// editor writes here; App.tsx (panels/tools/help) and the Phaser WorldScene
// (movement/interact) read here. Bindable keys are letters, digits, Space and the
// four arrows — enough for every action and simple to reason about; symbol/system
// keys (\\ + - Esc, mouse) stay fixed.

import { getPrefs, setPrefs } from './prefs';

export type KeyToken = string; // 'a'..'z' | '0'..'9' | 'space' | 'arrowup'|'arrowdown'|'arrowleft'|'arrowright'
export type BindCategory = 'movement' | 'action' | 'tools' | 'panels';

export interface BindAction {
	id: string;
	def: KeyToken[]; // 1-2 default tokens: [primary] or [primary, alternate]
	category: BindCategory;
	label: string; // i18n key (app.settings.keybinds.action.<id>)
	panel?: string; // panel this action opens (panel actions)
	tool?: string; // toolbelt tool this action selects (tool actions)
	coopOnly?: boolean; // hidden in solo worlds
}

export const BIND_ACTIONS: BindAction[] = [
	{ id: 'moveUp', def: ['w', 'arrowup'], category: 'movement', label: 'app.settings.keybinds.action.moveUp' },
	{ id: 'moveDown', def: ['s', 'arrowdown'], category: 'movement', label: 'app.settings.keybinds.action.moveDown' },
	{ id: 'moveLeft', def: ['a', 'arrowleft'], category: 'movement', label: 'app.settings.keybinds.action.moveLeft' },
	{ id: 'moveRight', def: ['d', 'arrowright'], category: 'movement', label: 'app.settings.keybinds.action.moveRight' },
	{ id: 'interact', def: ['e', 'space'], category: 'action', label: 'app.settings.keybinds.action.interact' },
	{ id: 'help', def: ['h'], category: 'action', label: 'app.settings.keybinds.action.help' },
	{ id: 'tool1', def: ['1'], category: 'tools', label: 'app.settings.keybinds.action.tool1', tool: 'basket' },
	{ id: 'tool2', def: ['2'], category: 'tools', label: 'app.settings.keybinds.action.tool2', tool: 'shovel' },
	{ id: 'tool3', def: ['3'], category: 'tools', label: 'app.settings.keybinds.action.tool3', tool: 'watering-can' },
	{ id: 'tool4', def: ['4'], category: 'tools', label: 'app.settings.keybinds.action.tool4', tool: 'paint' },
	{ id: 'crafting', def: ['c'], category: 'panels', label: 'app.settings.keybinds.action.crafting', panel: 'crafting' },
	{ id: 'basket', def: ['b'], category: 'panels', label: 'app.settings.keybinds.action.basket', panel: 'inventory' },
	{ id: 'journal', def: ['j'], category: 'panels', label: 'app.settings.keybinds.action.journal', panel: 'journal' },
	{
		id: 'achievements',
		def: ['k'],
		category: 'panels',
		label: 'app.settings.keybinds.action.achievements',
		panel: 'achievements',
	},
	{ id: 'feed', def: ['f'], category: 'panels', label: 'app.settings.keybinds.action.feed', panel: 'feed' },
	{ id: 'tools', def: ['t'], category: 'panels', label: 'app.settings.keybinds.action.tools', panel: 'tools' },
	{ id: 'preserve', def: ['m'], category: 'panels', label: 'app.settings.keybinds.action.preserve', panel: 'biomes' },
	{ id: 'weather', def: ['n'], category: 'panels', label: 'app.settings.keybinds.action.weather', panel: 'weather' },
	{ id: 'goals', def: ['g'], category: 'panels', label: 'app.settings.keybinds.action.goals', panel: 'goals' },
	{
		id: 'people',
		def: ['u'],
		category: 'panels',
		label: 'app.settings.keybinds.action.people',
		panel: 'people',
		coopOnly: true,
	},
	{ id: 'settings', def: ['o'], category: 'panels', label: 'app.settings.keybinds.action.settings', panel: 'settings' },
];

const DEFAULTS: Record<string, KeyToken[]> = Object.fromEntries(BIND_ACTIONS.map((a) => [a.id, a.def]));

/** The live action -> key-slots map: defaults overlaid with saved overrides. A
 *  saved entry is only honoured when its length matches the action's slot count,
 *  so slots are always fully populated (never stranding an action). */
export function getBindings(): Record<string, KeyToken[]> {
	const saved = getPrefs().keybinds || {};
	const out: Record<string, KeyToken[]> = {};
	for (const a of BIND_ACTIONS) {
		const s = saved[a.id];
		out[a.id] = Array.isArray(s) && s.length === a.def.length ? s : a.def;
	}
	return out;
}

/** The key tokens bound to an action (1-2). */
export function keysFor(id: string): KeyToken[] {
	return getBindings()[id] || [];
}

/** Which action a pressed key token triggers, or null if unbound. */
export function actionForToken(token: KeyToken | null): string | null {
	if (!token) return null;
	const b = getBindings();
	for (const a of BIND_ACTIONS) if (b[a.id]?.includes(token)) return a.id;
	return null;
}

/** Rebind one slot of an action, swapping with whatever slot already holds the
 *  key. Slots are always filled, so the swap never leaves an action keyless. */
export function setBinding(id: string, slot: number, token: KeyToken): void {
	const b = getBindings();
	const next: Record<string, KeyToken[]> = {};
	for (const k of Object.keys(b)) next[k] = [...b[k]];
	const prev = next[id][slot];
	let conflict: { id: string; slot: number } | null = null;
	for (const k of Object.keys(next)) {
		const idx = next[k].indexOf(token);
		if (idx >= 0 && !(k === id && idx === slot)) {
			conflict = { id: k, slot: idx };
			break;
		}
	}
	next[id][slot] = token;
	if (conflict) next[conflict.id][conflict.slot] = prev; // swap the displaced key
	setPrefs({ keybinds: next });
}

/** Restore every binding to its built-in default. */
export function resetBindings(): void {
	setPrefs({ keybinds: {} });
}

/** Normalize a KeyboardEvent to a bindable token, or null if it can't be bound. */
export function tokenFromEvent(e: KeyboardEvent): KeyToken | null {
	const k = e.key;
	if (k === ' ' || k === 'Spacebar' || e.code === 'Space') return 'space';
	if (k.length === 1 && /[a-zA-Z]/.test(k)) return k.toLowerCase();
	if (k.length === 1 && /[0-9]/.test(k)) return k;
	if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') return k.toLowerCase();
	return null;
}

const ARROW_LABEL: Record<string, string> = {
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
	space: 'Space',
};
/** A short display cap for a key token (e.g. 'w' -> 'W', 'arrowup' -> '↑'). */
export function keyLabel(token: KeyToken): string {
	return ARROW_LABEL[token] || token.toUpperCase();
}

/** DOM/Phaser numeric keycode for a bindable token, or null. */
export function keyCodeFor(token: KeyToken): number | null {
	if (/^[a-z]$/.test(token)) return token.toUpperCase().charCodeAt(0);
	if (/^[0-9]$/.test(token)) return token.charCodeAt(0);
	const special: Record<string, number> = { space: 32, arrowup: 38, arrowdown: 40, arrowleft: 37, arrowright: 39 };
	return special[token] ?? null;
}

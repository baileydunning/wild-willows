// Controller wording for the how-to hints the game's server writes.
//
// Task-board hints and a few refusal toasts arrive as finished sentences
// ("press E or Space", "Open crafting (C)") from server/tasks.ts and friends,
// which run before anyone knows what the player is holding. While a controller
// is in use the UI swaps each known sentence for its controller version here,
// at render time, so nothing about the server or the save changes.

import { getInputMode } from './pad';
import { padVars } from './glyphs';

const SWAPS: Array<[string, string]> = [
	['server.task.gatherHint', 'app.padHints.gather'],
	['server.task.craftFirstHint', 'app.padHints.craftFirst'],
	['server.starter.plantHint', 'app.padHints.plant'],
	['server.starter.harvestHint', 'app.padHints.harvest'],
	['server.starter.restHint', 'app.padHints.rest'],
	['server.starter.buildTenHint', 'app.padHints.buildTen'],
	['server.starter.streamHint', 'app.padHints.stream'],
	['server.goal.hint.craft', 'app.padHints.goalCraft'],
	['server.goal.hint.build', 'app.padHints.goalBuild'],
	['server.goal.hint.grow', 'app.padHints.goalGrow'],
	['server.err.bedJustWatered', 'app.padHints.bedJustWatered'],
];

type T = (key: string, params?: Record<string, string | number>) => string;

/** The controller version of a server-written hint, or the hint unchanged. */
export function padHint(text: string, t: T): string {
	if (!text || getInputMode() !== 'pad') return text;
	for (const [key, padKey] of SWAPS) if (t(key) === text) return t(padKey, padVars(t));
	return text;
}

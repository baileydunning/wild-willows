/**
 * True when the element (usually an event's target or document.activeElement)
 * is a text-entry control — an input, textarea, select, or contentEditable
 * region. Every keyboard listener in the game (panel hotkeys, tool numbers,
 * the task-board toggle, Phaser movement) must bail when this is true, so
 * typing in a panel's text box never plays the game underneath.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
	const n = el as HTMLElement | null;
	if (!n || !n.tagName) return false;
	const tag = n.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable;
}

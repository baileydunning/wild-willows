import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Toasts are for things you would MISS: an animal came home, an area opened, an
// action was refused. They are not a log of what you just did.
//
// The toolbelt used to break that rule four times over — a card in the corner of
// the screen for every tool switch, every brush size, and for folding the brush
// picker away ("Brush sizes hidden", reporting something the player had just
// watched happen). Because toasts share one stack, the noise landed on top of
// the messages that matter.
//
// Two invariants, and the second is why removing them was safe. The controls
// answer visibly (`.on`, the picker sliding in and out) AND they announce
// themselves through aria-pressed / aria-expanded on the button that changed —
// which reaches a screen-reader user at the control, rather than as a second
// announcement drifting through the live region. Strip that aria off and the
// toasts really would have been carrying something; the test says so.
//
// Source-scanned rather than rendered, in the same style and for the same reason
// as tests/unit/a11y-labels.test.ts: no DOM testing-library in this project.

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const TOOLBELT = read('src/ui/Toolbelt.tsx');

/** Full opening tags of every element whose className starts with `cls`. */
const tagsWithClass = (src: string, cls: string) =>
	[...src.matchAll(/<(\w+)\s([^>]*?)\/?>/gs)].map((m) => m[0]).filter((tag) => tag.includes(cls));

describe('toast discipline', () => {
	it('raises no toast from the toolbelt', () => {
		// Not "raises few" — none. Every control in this file reports itself on
		// screen, so any toast here is a duplicate of something already visible.
		expect(TOOLBELT).not.toMatch(/\bnotify\(/);
	});

	it('leaves no retired toast strings behind to be wired back up', () => {
		const app = JSON.parse(read('src/i18n/en/app.json'));
		const toolbelt = (app.app?.toolbelt ?? app.toolbelt) as Record<string, unknown>;
		for (const key of ['brushSelected', 'brushShown', 'brushHidden', 'paintHow', 'selected']) {
			expect(toolbelt, `app.toolbelt.${key} was a toast-only string`).not.toHaveProperty(key);
		}
	});

	it('announces tool and brush state on the control instead', () => {
		const slots = tagsWithClass(TOOLBELT, 'tool-slot');
		expect(slots.length, 'no tool slots found — the scan is looking at the wrong thing').toBeGreaterThan(0);
		for (const tag of slots) expect(tag, `a tool slot without aria-pressed:\n${tag}`).toMatch(/aria-pressed=/);

		const chips = tagsWithClass(TOOLBELT, 'brush-size ');
		expect(chips.length, 'no brush chips found — the scan is looking at the wrong thing').toBeGreaterThan(0);
		for (const tag of chips) expect(tag, `a brush chip without aria-pressed:\n${tag}`).toMatch(/aria-pressed=/);

		// The fold is a disclosure, so it needs the state a toast used to narrate.
		expect(TOOLBELT, 'the brush picker no longer reports open/closed').toMatch(/aria-expanded=/);
	});
});

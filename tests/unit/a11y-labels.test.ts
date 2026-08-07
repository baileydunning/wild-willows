import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Screen-reader invariants, checked against the source.
//
// These would be better as rendered assertions, but the project has no DOM
// testing-library and the registry is unreachable to add one, and the Playwright
// e2e project can't download browsers here either. A source scan still pins the
// exact regressions that matter, and costs nothing to run.
//
// The bug that prompted this, from an NVDA player: "mouse hovering over the menu
// items (J, K, L, M) only announce the letter, not what they do." The buttons had
// correct aria-labels all along — the problem was the little shortcut badge INSIDE
// them. Left in the accessibility tree it's a text object of its own, so a screen
// reader following the mouse reads what's under the pointer ("J") rather than the
// button's name. aria-hidden removes it from the tree while leaving it on screen.

const UI = resolve(__dirname, '../../src/ui');
const files = readdirSync(UI)
	.filter((f) => f.endsWith('.tsx'))
	.map((f) => ({ name: f, src: readFileSync(join(UI, f), 'utf8') }));

/** Every JSX element carrying `className="<cls>"`, as its full opening tag. */
function elementsWithClass(src: string, cls: string): string[] {
	const out: string[] = [];
	for (const m of src.matchAll(/<(\w+)\s([^>]*?)\/?>/gs)) {
		const attrs = m[2];
		if (new RegExp(`className=(["'\`])${cls}\\1`).test(attrs) || new RegExp(`className=\\{\`${cls}[\\s\`]`).test(attrs))
			out.push(m[0]);
	}
	return out;
}

describe('screen reader labels', () => {
	// The shortcut is announced properly via aria-keyshortcuts; the badge is paint.
	const DECORATIVE = ['nav-key', 'tool-key', 'tool-tier'];

	it('hides the decorative shortcut badges from the accessibility tree', () => {
		let found = 0;
		for (const { name, src } of files)
			for (const cls of DECORATIVE)
				for (const tag of elementsWithClass(src, cls)) {
					found++;
					expect(
						tag.includes('aria-hidden'),
						`${name}: <span class="${cls}"> is missing aria-hidden — a screen reader following the mouse will read the badge instead of the control's name`,
					).toBe(true);
				}
		// If the classes are ever renamed this test would silently pass on zero
		// elements, so assert it actually inspected some.
		expect(found).toBeGreaterThanOrEqual(4);
	});

	it('gives every control that has a shortcut an aria-keyshortcuts', () => {
		// Wherever a badge is rendered, the owning control must advertise the real
		// shortcut — otherwise removing the badge from the tree loses it entirely.
		for (const cls of ['nav-key', 'tool-key']) {
			for (const { name, src } of files) {
				if (!src.includes(`"${cls}"`)) continue;
				expect(src.includes('aria-keyshortcuts'), `${name} renders .${cls} but never sets aria-keyshortcuts`).toBe(
					true,
				);
			}
		}
	});

	it('announces toasts as they arrive', () => {
		const hud = files.find((f) => f.name === 'HUD.tsx')!.src;
		const container = hud.slice(hud.indexOf('className="toasts"'));
		expect(container.slice(0, 200)).toContain('aria-live');
	});

	// A standing sweep, not just for the buttons touched here: an icon-only button
	// with no aria-label is announced as "button" and nothing else.
	it('leaves no icon-only button without an accessible name', () => {
		const unnamed: string[] = [];
		for (const { name, src } of files) {
			for (const m of src.matchAll(/<button\b(.*?)>(.*?)<\/button>/gs)) {
				const [, attrs, body] = m;
				if (/aria-label|aria-labelledby/.test(attrs)) continue;
				const text = body
					.replace(/<Icon[^>]*\/>/g, '')
					.replace(/\{\/\*.*?\*\/\}/gs, '')
					.replace(/<[^>]*>/g, '')
					.replace(/\s+/g, '');
				if (!text) unnamed.push(`${name}:${src.slice(0, m.index).split('\n').length}`);
			}
		}
		expect(unnamed).toEqual([]);
	});
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// The base `button` rule pads 6px 13px, and `* { box-sizing: border-box }` means
// that padding eats into a fixed width rather than adding to it. A 24px icon
// button that doesn't reset it therefore has NO content box at all — and a flex
// child obligingly shrinks to fit, so the icon renders 14px wide in the markup and
// 0px on screen. The button is still there: sized, focusable, clickable, hoverable.
// It just draws nothing, which is the worst version of this bug, because from the
// outside it looks like the close button was never added.
//
// That shipped on .coach-banner-close while every sibling close button in the file
// reset padding. Nothing catches it — the markup is correct, the CSS is valid, and
// only layout reveals it. So check the shape statically.

const ROOT = resolve(__dirname, '../../');
const CSS = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');

function tsxFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) return tsxFiles(p);
		return n.endsWith('.tsx') ? [p] : [];
	});
}

/** Every class that actually lands on a <button> in the app's JSX. */
function buttonClasses(): Set<string> {
	const out = new Set<string>();
	for (const f of tsxFiles(join(ROOT, 'src'))) {
		const src = readFileSync(f, 'utf8');
		for (const m of src.matchAll(/<button\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`\})/gs)) {
			const raw = (m[1] || m[2] || '').replace(/\$\{[^}]*\}/g, ' ');
			for (const c of raw.split(/\s+/)) if (/^[\w-]+$/.test(c)) out.add(c);
		}
	}
	return out;
}

/** The declaration block for `.name`, or null. */
function ruleFor(name: string): string | null {
	const m = CSS.match(new RegExp(`^\\.${name} \\{\\n([\\s\\S]*?)^\\}`, 'm'));
	return m ? m[1] : null;
}

describe('fixed-size icon buttons', () => {
	it('pads by default, which is the whole reason the reset matters', () => {
		const base = CSS.match(/^button \{\n([\s\S]*?)^\}/m);
		expect(base, 'the base button rule is gone — this suite assumes it exists').toBeTruthy();
		expect(base![1]).toMatch(/padding:\s*[^0]/);
		expect(CSS).toMatch(/box-sizing: border-box/);
	});

	it('reset that padding wherever a flex icon button would be crushed by it', () => {
		// Scoped to flex, which is what actually collapses: a grid button with
		// place-items:center lets its icon overflow the zero-width content box
		// instead, so those are fine as they are and are left alone.
		const offenders: string[] = [];
		for (const cls of [...buttonClasses()].sort()) {
			const body = ruleFor(cls);
			if (!body) continue;
			const w = body.match(/^\twidth: (\d+(?:\.\d+)?)px;/m);
			if (!w || Number(w[1]) > 60) continue;
			if (!/^\tdisplay: (inline-)?flex;/m.test(body)) continue;
			if (/^\tpadding[:-]/m.test(body)) continue;
			offenders.push(`.${cls} (${w[1]}px wide, flex, no padding reset)`);
		}
		expect(offenders, `these buttons will render their icon 0px wide:\n  ${offenders.join('\n  ')}`).toEqual([]);
	});

	it('keeps the close button on the coach banner visible', () => {
		// The specific one that shipped broken, pinned by name so a future edit to
		// this rule can't quietly drop the reset again.
		const body = ruleFor('coach-banner-close');
		expect(body, '.coach-banner-close is gone from styles.css').toBeTruthy();
		expect(body!).toMatch(/^\tpadding: 0;/m);
	});
});

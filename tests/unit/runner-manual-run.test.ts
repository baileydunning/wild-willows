import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * NOTHING RUNS UNTIL SOMEONE PRESSES RUN.
 *
 * The editors used to run the code four hundred milliseconds after the last
 * keystroke, and every example rendered itself when the page opened. Twenty-two
 * of the lesson's forty-two examples fetch the whole game catalog, and the
 * preview is an opaque-origin frame that shares no HTTP cache, so:
 *
 *   • opening the lesson sent twenty-two full requests before a word was read
 *   • a class of thirty on one school connection sent six hundred and sixty,
 *     over the six hundred a minute the endpoint allows one address
 *   • editing a single line of a fetch example cost one download per pause
 *
 * The lesson was capable of rate-limiting its own classroom, and the game reads
 * the same endpoint. So: typing marks the button, and the student decides when
 * the request goes out.
 */

const root = process.cwd();
const SRC = readFileSync(resolve(root, 'public/partials/ww-runner.js'), 'utf8');

let R: any;
beforeAll(() => {
	new Function(SRC)();
	R = (window as any).WwRunner;
	expect(R, 'the runner should publish its API').toBeTruthy();
});

beforeEach(() => {
	document.body.innerHTML = '';
});

const mount = (inner: string, attrs = ''): HTMLElement => {
	document.body.innerHTML = `<ww-runner ${attrs}>${inner}</ww-runner>`;
	const host = document.querySelector('ww-runner') as HTMLElement;
	R.mount(host);
	return host;
};

const file = (name: string, code: string) => `<script type="text/ww-file" name="${name}">${code}</script>`;

const rendered = (host: HTMLElement): string[] =>
	([...host.querySelectorAll('iframe.wwr-preview')] as HTMLIFrameElement[]).map((f) => f.srcdoc).filter(Boolean);

const runBtn = (host: HTMLElement) => host.querySelector('.wwr-run') as HTMLButtonElement;
const prompt = (host: HTMLElement) => host.querySelector('.wwr-prompt') as HTMLElement;

describe('typing never runs anything', () => {
	it('has no timer between an edit and a render', () => {
		// The mechanism, not just its effect: a debounce constant left behind is a
		// debounce someone re-wires later.
		expect(SRC).not.toMatch(/DEBOUNCE_MS/);
		expect(SRC).not.toMatch(/setTimeout\([^)]*\brun\(/);
		expect(SRC).not.toMatch(/run\('auto'\)[\s\S]{0,40}setTimeout/);
	});

	it('marks the button instead of rendering', () => {
		const host = mount(file('index.html', '<h1>hi</h1>'));
		const before = rendered(host);
		const area = host.querySelector('.wwr-code') as HTMLTextAreaElement;
		area.value = '<h1>changed</h1>';
		area.dispatchEvent(new Event('input', { bubbles: true }));

		expect(runBtn(host).classList.contains('is-dirty')).toBe(true);
		// Same document as before the edit: the render did not happen.
		expect(rendered(host)).toEqual(before);
		expect(rendered(host).join('')).not.toContain('changed');
	});

	it('and renders it on the press', () => {
		const host = mount(file('index.html', '<h1>hi</h1>'));
		const area = host.querySelector('.wwr-code') as HTMLTextAreaElement;
		area.value = '<h1>changed</h1>';
		area.dispatchEvent(new Event('input', { bubbles: true }));
		runBtn(host).click();

		expect(rendered(host).join('')).toContain('changed');
		expect(runBtn(host).classList.contains('is-dirty')).toBe(false);
	});
});

describe('an example that goes to the network waits to be asked', () => {
	const FETCHER = 'fetch("https://wildwillows.app/GameData/").then(r => r.json());';

	it('does not render itself when the page opens', () => {
		const host = mount(file('main.js', FETCHER), 'console');
		expect(rendered(host)).toHaveLength(0);
		expect(prompt(host).hidden).toBe(false);
		expect(prompt(host).textContent).toBe('Press Run to send the request.');
	});

	it('while an example that only draws still does', () => {
		// The page should look alive on arrival. Rendering HTML and CSS costs a
		// frame and no traffic, so those keep the behavior they had.
		const host = mount(file('index.html', '<h1>hi</h1>'));
		expect(rendered(host).length).toBeGreaterThan(0);
		expect(prompt(host).hidden).toBe(true);
	});

	it('and goes out on the press', () => {
		const host = mount(file('main.js', FETCHER), 'console');
		runBtn(host).click();
		expect(rendered(host).join('')).toContain('wildwillows.app/GameData/');
		expect(prompt(host).hidden).toBe(true);
	});

	it('puts the message somewhere visible on a console-only example', () => {
		// These hide the preview column entirely, so a message parented to it is a
		// message inside display:none — which is what the first attempt shipped,
		// on the twenty-seven examples that need it most.
		const host = mount(file('main.js', FETCHER), 'console');
		const out = host.querySelector('.wwr-out') as HTMLElement;
		expect(host.classList.contains('wwr--console-only')).toBe(true);
		expect(out.contains(prompt(host))).toBe(false);
		expect(host.contains(prompt(host))).toBe(true);
	});
});

describe('seeding the editor is not a press', () => {
	it('wwSet loads the code and leaves the request for the student', () => {
		// The builder calls this when an idea is picked, a save is restored, or on
		// undo. Running there would hand over the code and send the request in one
		// motion, which is the behavior being removed.
		const host = mount(file('main.js', 'console.log(1);'), 'console') as any;
		const before = rendered(host);
		host.wwSet({ 'main.js': 'fetch("https://wildwillows.app/GameData/");' });
		expect(rendered(host)).toEqual(before);
		expect(runBtn(host).classList.contains('is-dirty')).toBe(true);
	});

	it('wwRun is a press, because the page calls it for a button', () => {
		const host = mount(file('index.html', '<h1>hi</h1>')) as any;
		host.wwSet({ 'index.html': '<h1>seeded</h1>' });
		host.wwRun();
		expect(rendered(host).join('')).toContain('seeded');
	});
});

describe('the pages say so', () => {
	const PAGES = readdirSync(resolve(root, 'public')).filter((f) => f.endsWith('.html'));

	it('no page still promises code that runs as you type', () => {
		const offenders: string[] = [];
		for (const f of PAGES) {
			const src = readFileSync(join(root, 'public', f), 'utf8');
			if (/runs? as (you|they|a student) types?|updates as you type|press nothing/i.test(src)) offenders.push(f);
		}
		expect(offenders).toEqual([]);
	});

	it('and the three doors tell a student where the button is', () => {
		for (const f of ['landing.html', 'learn-index.html', 'learn-web-development.html']) {
			const src = readFileSync(join(root, 'public', f), 'utf8');
			expect(src, `${f} should mention pressing Run`).toMatch(/press(es)? <b>Run<\/b>|press Run/);
		}
	});
});

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A FUNNEL STEP CANNOT EXCEED THE STEP ABOVE IT.
 *
 * The classroom funnel drew "Ran their code (400% of previous)" off one real
 * visit, and the cause was a unit mismatch rather than a bad sum. `view_lesson`
 * is sent once per page load; `first_run` was sent once per RUNNER, and the
 * lesson embeds about fifteen of them. One student working through the chapters
 * therefore reported one lesson view and four runs, which is not a drop-off
 * curve, it is two different things plotted on one axis.
 *
 * Two rules come out of that, and both are checked here:
 *
 *   1. `first_run` and `first_fetch_ok` are ONCE PER PAGE. Volume is somebody
 *      else's job: `runs_manual` fires on every press and `fetch_ok` on every
 *      fetch, which is what those are for.
 *   2. The lesson and the builder are separate STRANDS, not consecutive steps.
 *      The nav offers the builder from every page, so a visit can start in
 *      either, and a merged count sits under a denominator that only counts one
 *      of the two pages. The builder files the runner's two steps under its own
 *      names so each strand nests inside its own entry point.
 */

const root = process.cwd();
const RUNNER = readFileSync(resolve(root, 'public/partials/ww-runner.js'), 'utf8');
const BUILDER = readFileSync(resolve(root, 'public/partials/ww-builder.js'), 'utf8');
const SERVER = readFileSync(resolve(root, 'server/resources.ts'), 'utf8');

/** A fresh copy of the component, so its page-scoped flags start clean. */
function freshRunner(): any {
	new Function(RUNNER)();
	const R = (window as any).WwRunner;
	expect(R, 'the runner should publish its API').toBeTruthy();
	return R;
}

let keys: string[];
/* Removed again after each test. Every test instantiates the component afresh so
 * its page-scoped flags start clean, and a listener left attached would then be
 * counting the same event once per test that had already run. */
let listen: (e: any) => void;
beforeEach(() => {
	document.body.innerHTML = '';
	keys = [];
	listen = (e: any) => keys.push(e.detail && e.detail.key);
	document.addEventListener('ww:metric', listen);
});
afterEach(() => {
	document.removeEventListener('ww:metric', listen);
});

const CODE = '<script type="text/ww-file" name="main.js">console.log(1);</script>';

function mountMany(R: any, count: number): HTMLElement[] {
	document.body.innerHTML = Array.from({ length: count }, () => `<ww-runner console>${CODE}</ww-runner>`).join('');
	const hosts = [...document.querySelectorAll('ww-runner')] as HTMLElement[];
	hosts.forEach((h) => R.mount(h));
	return hosts;
}

const press = (host: HTMLElement) => (host.querySelector('.wwr-run') as HTMLButtonElement).click();

describe('first_run is once per page, not once per runner', () => {
	it('sends one first_run however many runners the page has', () => {
		const R = freshRunner();
		const hosts = mountMany(R, 4);
		hosts.forEach(press);
		expect(keys.filter((k) => k === 'first_run').length).toBe(1);
	});

	it('still counts every press, because volume is a different question', () => {
		const R = freshRunner();
		const hosts = mountMany(R, 4);
		hosts.forEach(press);
		expect(keys.filter((k) => k === 'runs_manual').length).toBe(4);
	});

	it('sends one first_run however many times a single runner is used', () => {
		const R = freshRunner();
		const [host] = mountMany(R, 1);
		press(host);
		press(host);
		press(host);
		expect(keys.filter((k) => k === 'first_run').length).toBe(1);
		expect(keys.filter((k) => k === 'runs_manual').length).toBe(3);
	});
});

describe('the builder files the runner steps under its own names', () => {
	it('maps both funnel steps, and nothing else', () => {
		const m = BUILDER.match(/var RUNNER_STEPS = \{([^}]*)\}/);
		expect(m, 'the builder should rename the runner funnel steps').toBeTruthy();
		expect(m![1]).toContain("first_run: 'builder_first_run'");
		expect(m![1]).toContain("first_fetch_ok: 'builder_first_fetch_ok'");
		// runs_manual / fetch_ok are volume, shared across both pages on purpose.
		expect(m![1]).not.toContain('runs_manual');
		expect(m![1]).not.toMatch(/(^|[^_])fetch_ok:/);
	});

	it('passes every other counter through untouched', () => {
		expect(BUILDER).toContain('bump(RUNNER_STEPS[e.detail.key] || e.detail.key)');
	});

	it('has both renamed counters on the server allowlist', () => {
		// A counter that is not on the list is folded into `other` and the number
		// silently says nothing, which is the failure this list exists to prevent.
		expect(SERVER).toContain("'builder_first_run'");
		expect(SERVER).toContain("'builder_first_fetch_ok'");
	});
});

describe('the two strands each nest inside their own entry point', () => {
	/** The step ids the server sends, in order, for one named funnel array. */
	const stepsOf = (name: string): string[] => {
		const at = SERVER.indexOf(`const ${name} = [`);
		expect(at, `${name} not found in server/resources.ts`).toBeGreaterThan(-1);
		const body = SERVER.slice(at, SERVER.indexOf('\n\t];', at));
		return [...body.matchAll(/\{ id: '([^']+)', label: '[^']*', n: step\('([^']+)'\) \}/g)].map(
			(m) => `${m[1]}:${m[2]}`,
		);
	};

	it('starts the lesson strand at the lesson and uses the bare counters', () => {
		expect(stepsOf('funnel')).toEqual(['lesson:view_lesson', 'run:first_run', 'fetch:first_fetch_ok']);
	});

	it('starts the builder strand at the builder and uses the builder counters', () => {
		expect(stepsOf('builderFunnel')).toEqual([
			'builder:builder_open',
			'builder_run:builder_first_run',
			'builder_fetch:builder_first_fetch_ok',
			'download:download',
		]);
	});

	it('never mixes a builder counter into the lesson strand, or the reverse', () => {
		// This is the whole bug in one assertion: a strand that reads a counter the
		// other page also writes has a denominator smaller than its own numerator.
		expect(stepsOf('funnel').join(' ')).not.toContain('builder_');
		for (const s of stepsOf('builderFunnel')) expect(s.split(':')[1]).toMatch(/^(builder_|download$)/);
	});

	it('sends both strands to the dashboard', () => {
		expect(SERVER).toMatch(/\n\t\tfunnel,\n\t\tbuilderFunnel,\n/);
	});
});

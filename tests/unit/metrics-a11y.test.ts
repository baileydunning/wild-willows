import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// "Does the dashboard show it?" is a question about four files that have to agree:
// a preference is declared in prefs.ts, uplinked by metricsUplink.ts, rolled up in
// resources.ts, and rendered by dashboard.html. Nothing enforces that chain — and
// a break in it fails silently, as a number that reads 0 rather than as an error.
// That is the worst possible failure for a metric: it looks like nobody uses the
// feature. So walk the chain here instead.

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf8');
const PREFS = read('src/prefs.ts');
const UPLINK = read('src/solo/metricsUplink.ts');
const SERVER = read('server/resources.ts');
const DASHBOARD = read('public/dashboard.html');

/** The body of a `name: { … }` / `function name() { … }` block, brace-matched. */
function blockAfter(src: string, marker: string): string {
	const at = src.indexOf(marker);
	expect(at, `${marker} not found`).toBeGreaterThan(-1);
	const open = src.indexOf('{', at);
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		if (src[i] === '{') depth++;
		else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
	}
	throw new Error(`unbalanced braces after ${marker}`);
}

/** Top-level `key:` names in an object-literal body, ignoring nested ones. */
function topLevelKeys(body: string): string[] {
	const out: string[] = [];
	let depth = 0;
	for (const line of body.split('\n')) {
		const m = line.match(/^\s*([A-Za-z_]\w*)\s*:/);
		if (m && depth === 0) out.push(m[1]);
		for (const c of line) {
			if ('{(['.includes(c)) depth++;
			else if ('})]'.includes(c)) depth--;
		}
	}
	return out;
}

// Everything a player can change in Settings → Accessibility. The audio toggles
// and the key rebinder are their own sections and are checked separately (or not
// at all, for keybinds — a bindings map isn't something you aggregate).
const A11Y_FIELDS = [
	'reduceMotion',
	'colorblindMode',
	'fontChoice',
	'highContrast',
	'textScale',
	'interactHint',
	'simpleText',
	'theme',
];
const AUDIO_FIELDS = ['musicEnabled', 'sfxEnabled', 'musicVolume', 'sfxVolume'];
const NOT_AGGREGATED = ['keybinds'];

describe('accessibility metrics reach the dashboard', () => {
	const prefsFields = topLevelKeys(blockAfter(PREFS, 'export interface Prefs'));
	const snapshot = topLevelKeys(blockAfter(blockAfter(UPLINK, 'function snapshotPrefs()'), 'return'));
	const settings = blockAfter(SERVER, 'const settings = {');
	const rollup = topLevelKeys(blockAfter(SERVER, 'accessibility: {'));

	it('accounts for every preference the game actually has', () => {
		// Forces a decision when a preference is added: it is an accessibility
		// option, an audio one, or explicitly not worth aggregating. Landing in
		// none of those buckets by accident is how a setting goes unreported.
		const unclassified = prefsFields.filter((f) => ![...A11Y_FIELDS, ...AUDIO_FIELDS, ...NOT_AGGREGATED].includes(f));
		expect(unclassified, `unclassified preferences in prefs.ts: ${unclassified.join(', ')}`).toEqual([]);
		// and nothing in the lists has been deleted from Prefs without being removed here
		for (const f of A11Y_FIELDS) expect(prefsFields, `${f} missing from Prefs`).toContain(f);
	});

	it('uplinks every accessibility option', () => {
		const missing = A11Y_FIELDS.filter((f) => !snapshot.includes(f));
		expect(missing, `never leaves the client: ${missing.join(', ')}`).toEqual([]);
		// 'system' hides whether anyone is actually looking at a dark interface, so
		// the resolved theme rides along with the stored choice.
		expect(snapshot).toContain('themeResolved');
	});

	it('rolls every uplinked accessibility option up on the server', () => {
		const missing = A11Y_FIELDS.filter((f) => !settings.includes(`p.${f}`));
		expect(missing, `uplinked but never counted: ${missing.join(', ')}`).toEqual([]);
		expect(settings).toContain('p.themeResolved');
	});

	it('renders every rolled-up number on the dashboard', () => {
		const missing = rollup.filter((k) => !DASHBOARD.includes(`a11y.${k}`));
		expect(missing, `counted but never drawn: ${missing.join(', ')}`).toEqual([]);
		// the four that answer "did anyone turn dark mode on, and what are they seeing"
		for (const k of ['themes', 'themesResolved', 'simpleText', 'interactHintOff']) {
			expect(rollup, `${k} missing from the accessibility rollup`).toContain(k);
		}
	});

	it('counts only the options that are actually assistive as adoption', () => {
		// anyEnabled drives the headline "using an accessibility option" number.
		// Taste settings must stay out of it or they inflate it — the font picker
		// set that precedent, and dark mode falls on the same side of the line.
		const anyEnabled = SERVER.slice(SERVER.indexOf('anyEnabled: countPref('));
		const expr = anyEnabled.slice(0, anyEnabled.indexOf('),\n'));
		expect(expr).toContain('p.reduceMotion');
		expect(expr).toContain('p.highContrast');
		expect(expr).toContain('p.colorblindMode');
		expect(expr).toContain('p.simpleText');
		expect(expr).not.toContain('p.theme');
		expect(expr).not.toContain('p.fontChoice');
		expect(expr).not.toContain('p.interactHint');
	});
});

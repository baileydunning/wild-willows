// Spanish locale regression test: the es catalogs must mirror en key-for-key
// (same structure, same {placeholder} tokens, same pool lengths) and actually
// switch t() output. Guards against a translation drifting out of sync when
// English strings are added or reworded.

import { describe, expect, it, afterAll } from 'vitest';
import { registerCatalog, setLocale, t, tList, content } from '../../src/i18n/core';

import enApp from '../../src/i18n/en/app.json';
import enPanels from '../../src/i18n/en/panels.json';
import enNarrative from '../../src/i18n/en/narrative.json';
import enServer from '../../src/i18n/en/server.json';
import enGame from '../../src/i18n/en/game.json';
import esApp from '../../src/i18n/es/app.json';
import esPanels from '../../src/i18n/es/panels.json';
import esNarrative from '../../src/i18n/es/narrative.json';
import esServer from '../../src/i18n/es/server.json';
import esGame from '../../src/i18n/es/game.json';
import esContent from '../../src/i18n/es/content.json';

type Val = string | string[] | { one: string; other: string };

/** Flatten with core.ts semantics: pools and plural pairs stay whole. */
function flatten(src: Record<string, unknown>, prefix = '', out: Record<string, Val> = {}): Record<string, Val> {
	for (const [k, v] of Object.entries(src)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (typeof v === 'string' || Array.isArray(v)) out[key] = v as Val;
		else if (v && typeof v === 'object') {
			const o = v as Record<string, unknown>;
			if (typeof o.one === 'string' && typeof o.other === 'string') out[key] = o as Val;
			else flatten(o, key, out);
		}
	}
	return out;
}

const tokens = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const en = flatten({ app: enApp, panels: enPanels, narrative: enNarrative, server: enServer, game: enGame });
const es = flatten({ app: esApp, panels: esPanels, narrative: esNarrative, server: esServer, game: esGame });
const skip = (k: string) => k.endsWith('_readme');

afterAll(() => setLocale('en'));

describe('es locale', () => {
	it('mirrors every en key (and adds none)', () => {
		const missing = Object.keys(en).filter((k) => !skip(k) && !(k in es));
		const extra = Object.keys(es).filter((k) => !skip(k) && !(k in en));
		expect(missing).toEqual([]);
		expect(extra).toEqual([]);
	});

	it('keeps placeholder tokens, plural shape, and pool lengths', () => {
		const problems: string[] = [];
		for (const [k, envRaw] of Object.entries(en)) {
			if (skip(k) || !(k in es)) continue;
			const esv = es[k];
			if (typeof envRaw === 'string') {
				if (typeof esv !== 'string') problems.push(`${k}: type mismatch`);
				else if ([...tokens(envRaw)].sort().join() !== [...tokens(esv)].sort().join()) problems.push(`${k}: tokens differ`);
			} else if (Array.isArray(envRaw)) {
				if (!Array.isArray(esv)) problems.push(`${k}: expected pool`);
				else if (esv.length !== envRaw.length) problems.push(`${k}: pool length ${esv.length} != ${envRaw.length}`);
			} else {
				if (typeof esv !== 'object' || Array.isArray(esv)) problems.push(`${k}: expected plural pair`);
			}
		}
		expect(problems).toEqual([]);
	});

	it('switches t()/tList()/content() output live', () => {
		registerCatalog('en', { app: enApp, narrative: enNarrative });
		registerCatalog('es', { app: esApp, narrative: esNarrative });
		registerCatalog('es', esContent); // self-wrapped { content: … }

		setLocale('en');
		const before = t('app.settings.language');
		setLocale('es');
		expect(t('app.settings.language')).not.toBe(before);
		expect(tList('narrative.lines.meadow').length).toBe((enNarrative as any).lines.meadow.length);
		// content overlay: Spanish name resolves, unknown falls back to the English argument
		expect(content('animal', 'grasshopper', 'name', 'Grasshopper')).not.toBe('Grasshopper');
		expect(content('animal', 'not-a-real-animal', 'name', 'Fallback')).toBe('Fallback');
		setLocale('en');
		expect(t('app.settings.language')).toBe(before);
	});
});

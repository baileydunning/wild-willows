import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	registerCatalog,
	setLocale,
	setSimpleText,
	isSimpleText,
	simpleLocale,
	t,
	tList,
	content,
} from '../../src/i18n/core';
import enSimple from '../../src/i18n/en/simple.json';
import esSimple from '../../src/i18n/es/simple.json';
import enPanels from '../../src/i18n/en/panels.json';
import enApp from '../../src/i18n/en/app.json';
import enServer from '../../src/i18n/en/server.json';
import enGame from '../../src/i18n/en/game.json';
import enNarrative from '../../src/i18n/en/narrative.json';
import animals1 from '../../data/animals-1.json';
import animals2 from '../../data/animals-2.json';
import biomes from '../../data/biomes.json';

// The "Simpler wording" accessibility option: a plain-language overlay laid over
// the normal catalogs, consulted first and falling back PER KEY.
//
// Per-key fallback is the whole design. Coverage grows string by string, so at
// any moment most keys have no plain version — and every one of those must show
// its normal text rather than a missing-key placeholder, and must not fall back
// across languages into English.

beforeEach(() => {
	registerCatalog('en', {
		demo: { plain: 'Short and clear.', fancy: 'A notably intricate articulation.', pool: ['one', 'two'] },
	});
	registerCatalog('es', { demo: { plain: 'Corto y claro.', fancy: 'Una articulación notablemente intrincada.' } });
	registerCatalog(simpleLocale('en'), { demo: { fancy: 'A hard way to say it.', pool: ['ONE', 'TWO'] } });
	registerCatalog(simpleLocale('es'), { demo: { fancy: 'Una forma difícil de decirlo.' } });
	setLocale('en');
	setSimpleText(false);
});

afterEach(() => {
	setSimpleText(false);
	setLocale('en');
});

describe('the overlay only applies when the option is on', () => {
	it('shows normal text by default', () => {
		expect(t('demo.fancy')).toBe('A notably intricate articulation.');
	});

	it('shows the plain version once enabled', () => {
		setSimpleText(true);
		expect(t('demo.fancy')).toBe('A hard way to say it.');
	});

	it('goes back cleanly when disabled again', () => {
		setSimpleText(true);
		setSimpleText(false);
		expect(t('demo.fancy')).toBe('A notably intricate articulation.');
	});

	it('reports its own state', () => {
		expect(isSimpleText()).toBe(false);
		setSimpleText(true);
		expect(isSimpleText()).toBe(true);
	});
});

describe('partial coverage is safe', () => {
	it('falls back to the normal string for an uncovered key', () => {
		setSimpleText(true);
		expect(t('demo.plain')).toBe('Short and clear.');
	});

	it('never turns an uncovered key into a placeholder', () => {
		setSimpleText(true);
		expect(t('demo.plain')).not.toContain('demo.');
	});

	it('an unknown key behaves the same either way', () => {
		expect(t('demo.nope')).toBe('demo.nope');
		setSimpleText(true);
		expect(t('demo.nope')).toBe('demo.nope');
	});
});

describe('it does not leak English into another language', () => {
	it('uses the Spanish plain version in Spanish', () => {
		setLocale('es');
		setSimpleText(true);
		expect(t('demo.fancy')).toBe('Una forma difícil de decirlo.');
	});

	it('falls back to normal SPANISH, not English, when Spanish has no plain version', () => {
		setLocale('es');
		setSimpleText(true);
		// `demo.plain` has no plain version in either language.
		expect(t('demo.plain')).toBe('Corto y claro.');
	});
});

describe('every value shape is handled', () => {
	it('interpolates placeholders in plain text', () => {
		registerCatalog('en', { demo: { greet: 'Salutations, {name}.' } });
		registerCatalog(simpleLocale('en'), { demo: { greet: 'Hi, {name}.' } });
		setSimpleText(true);
		expect(t('demo.greet', { name: 'Kayla' })).toBe('Hi, Kayla.');
	});

	it('overlays line pools too', () => {
		setSimpleText(true);
		expect(tList('demo.pool')).toEqual(['ONE', 'TWO']);
	});

	it('overlays plural pairs', () => {
		registerCatalog('en', { demo: { n: { one: 'A solitary item', other: '{count} items' } } });
		registerCatalog(simpleLocale('en'), { demo: { n: { one: 'One thing', other: '{count} things' } } });
		setSimpleText(true);
		expect(t('demo.n', { count: 1 })).toBe('One thing');
		expect(t('demo.n', { count: 4 })).toBe('4 things');
	});

	it('covers data content — the animal notes go through the same lookup', () => {
		registerCatalog(simpleLocale('en'), { content: { animal: { 'x-1': { diet: 'Eats bugs.' } } } });
		setSimpleText(true);
		expect(content('animal', 'x-1', 'diet', 'A generalist invertivore.')).toBe('Eats bugs.');
		// …and an animal with no plain version keeps its normal text.
		expect(content('animal', 'x-2', 'diet', 'A generalist invertivore.')).toBe('A generalist invertivore.');
	});
});

describe('the shipped catalogs', () => {
	it('cover the same keys in English and Spanish', () => {
		const flat = (o: any, p = '', out: Record<string, unknown> = {}) => {
			for (const [k, v] of Object.entries(o)) {
				const key = p ? `${p}.${k}` : k;
				if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
				else out[key] = v;
			}
			return out;
		};
		const en = flat(enSimple);
		const es = flat(esSimple);
		delete en._readme;
		delete es._readme;
		// A key simplified in one language but not the other would silently give
		// that language the harder wording while the option is on.
		expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
	});

	// EVERY overlay key must resolve to something real. An overlay key that matches
	// nothing is invisible: no error, no missing-key placeholder — the player just
	// silently keeps the harder wording forever. This caught 12 real ones, where
	// animal ids had been written by hand (`monarch` for what is actually
	// `red-admiral`), so the guard covers data content as well as the UI catalogs.
	const flatKeys = (o: any, p = '', out: string[] = []) => {
		for (const [k, v] of Object.entries(o)) {
			const key = p ? `${p}.${k}` : k;
			if (v && typeof v === 'object' && !Array.isArray(v) && !('one' in (v as object))) flatKeys(v, key, out);
			else out.push(key);
		}
		return out;
	};

	it('every UI override matches a real catalog key', () => {
		const normal = new Set([
			...flatKeys(enApp, 'app'),
			...flatKeys(enPanels, 'panels'),
			...flatKeys(enServer, 'server'),
			...flatKeys(enGame, 'game'),
			...flatKeys(enNarrative, 'narrative'),
		]);
		const overlaid = flatKeys(enSimple).filter((k) => !k.startsWith('content.') && k !== '_readme');
		expect(overlaid.filter((k) => !normal.has(k))).toEqual([]);
	});

	it('every animal/biome override names a real record id', () => {
		const ids: Record<string, Set<string>> = {
			animal: new Set([...animals1.records, ...animals2.records].map((r: any) => r.id)),
			biome: new Set(biomes.records.map((r: any) => r.id)),
		};
		const bad: string[] = [];
		for (const key of flatKeys((enSimple as any).content ?? {}, 'content')) {
			const [, kind, id] = key.split('.');
			if (ids[kind] && !ids[kind].has(id)) bad.push(key);
		}
		expect(bad).toEqual([]);
	});
});

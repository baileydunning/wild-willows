import { describe, expect, it, beforeEach } from 'vitest';
import {
	t,
	tList,
	content,
	hasKey,
	registerCatalog,
	setLocale,
	getLocale,
	onLocaleChange,
	availableLocales,
} from '../../src/i18n/core';

// core.ts keeps module-level state; tests share it, so use unique keys per test
// where it matters and always restore the locale.
beforeEach(() => setLocale('en'));

describe('i18n core', () => {
	it('flattens nested catalogs to dot-keys', () => {
		registerCatalog('en', { a: { b: { c: 'deep' } } });
		expect(t('a.b.c')).toBe('deep');
	});

	it('interpolates {params} and leaves unknown placeholders visible', () => {
		registerCatalog('en', { greet: 'Hello {name}, {missing}!' });
		expect(t('greet', { name: 'Bailey' })).toBe('Hello Bailey, {missing}!');
	});

	it('returns the key itself for missing keys (never throws)', () => {
		expect(t('no.such.key')).toBe('no.such.key');
	});

	it('selects plural forms via count and fills {count}', () => {
		registerCatalog('en', { items: { one: '{count} item', other: '{count} items' } });
		expect(t('items', { count: 1 })).toBe('1 item');
		expect(t('items', { count: 3 })).toBe('3 items');
		expect(t('items', { count: 0 })).toBe('0 items');
	});

	it('keeps arrays whole as line pools', () => {
		registerCatalog('en', { pool: ['line {n}', 'other {n}'] });
		expect(tList('pool', { n: 1 })).toEqual(['line 1', 'other 1']);
		expect(t('pool', { n: 2 })).toBe('line 2'); // t() takes the first
		expect(tList('missing.pool')).toEqual([]);
		registerCatalog('en', { single: 'just one' });
		expect(tList('single')).toEqual(['just one']);
	});

	it('falls back locale → en → key', () => {
		registerCatalog('en', { fb: { both: 'en-both', only: 'en-only' } });
		registerCatalog('xx', { fb: { both: 'xx-both' } });
		setLocale('xx');
		expect(getLocale()).toBe('xx');
		expect(t('fb.both')).toBe('xx-both');
		expect(t('fb.only')).toBe('en-only');
		expect(t('fb.nowhere')).toBe('fb.nowhere');
		expect(availableLocales()).toContain('xx');
	});

	it('merges split catalogs for one locale (later wins)', () => {
		registerCatalog('en', { merge: { a: 'A' } });
		registerCatalog('en', { merge: { b: 'B', a: 'A2' } });
		expect(t('merge.a')).toBe('A2');
		expect(t('merge.b')).toBe('B');
	});

	it('notifies + unsubscribes locale listeners', () => {
		let fires = 0;
		const off = onLocaleChange(() => fires++);
		setLocale('yy');
		setLocale('yy'); // no-op, same locale
		off();
		setLocale('en');
		expect(fires).toBe(1);
	});

	it('content(): English falls back to the definition text, overlays win', () => {
		expect(content('animal', 'red-fox-meadow', 'name', 'Red Fox')).toBe('Red Fox');
		registerCatalog('zz', { content: { animal: { 'red-fox-meadow': { name: 'Zorro Rojo' } } } });
		setLocale('zz');
		expect(content('animal', 'red-fox-meadow', 'name', 'Red Fox')).toBe('Zorro Rojo');
		expect(content('animal', 'red-fox-meadow', 'fact', 'Foxes cache food.')).toBe('Foxes cache food.');
	});

	it('hasKey() checks active-or-fallback', () => {
		registerCatalog('en', { exists: 'yes' });
		expect(hasKey('exists')).toBe(true);
		expect(hasKey('exists.not')).toBe(false);
	});
});

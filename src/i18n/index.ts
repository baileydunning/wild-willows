// i18n entry for the app (React UI + Phaser). Registers every English catalog
// and restores the saved language. Import `t` from here in client code; server
// code imports from './server' instead (smaller bundle).
//
// Adding a language later:
//   1. Create src/i18n/<locale>/*.json mirroring the en catalogs (use
//      `node scripts/i18n-extract.mjs` for the data-content overlay template).
//   2. Register them below (or lazy-load, then registerCatalog + setLocale).
//   3. Add the locale to LOCALE_NAMES so Settings can offer it.

import appEn from './en/app.json';
import panelsEn from './en/panels.json';
import narrativeEn from './en/narrative.json';
import serverEn from './en/server.json';
import gameEn from './en/game.json';
import { registerCatalog, setLocale, getLocale } from './core';

registerCatalog('en', {
	app: appEn,
	panels: panelsEn,
	narrative: narrativeEn,
	server: serverEn,
	game: gameEn,
});

/** Languages offered in Settings, in display order. */
export const LOCALE_NAMES: Record<string, string> = {
	en: 'English',
};

const STORAGE_KEY = 'ww:locale';

/** Persist + apply a language choice. */
export function chooseLocale(locale: string): void {
	if (!(locale in LOCALE_NAMES)) return;
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		/* storage unavailable (private mode etc.) — still applies for the session */
	}
	setLocale(locale);
}

// Restore the saved language at import time, before anything renders.
try {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved && saved in LOCALE_NAMES && saved !== getLocale()) setLocale(saved);
} catch {
	/* storage unavailable */
}

export { t, tList, content, hasKey, getLocale, setLocale, onLocaleChange, availableLocales } from './core';
export type { Params } from './core';

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
	es: 'Español',
};

// Non-English catalogs load on demand (dynamic imports → their own Vite chunks),
// so players who stay in English never download them. Each loader registers
// every catalog for its locale, including the data-content overlay.
const LOCALE_LOADERS: Record<string, () => Promise<void>> = {
	es: async () => {
		const [app, panels, narrative, server, game, content] = await Promise.all([
			import('./es/app.json'),
			import('./es/panels.json'),
			import('./es/narrative.json'),
			import('./es/server.json'),
			import('./es/game.json'),
			import('./es/content.json'),
		]);
		registerCatalog('es', {
			app: app.default,
			panels: panels.default,
			narrative: narrative.default,
			server: server.default,
			game: game.default,
		});
		registerCatalog('es', content.default); // already wrapped in { content: … }
	},
};
const loadedLocales = new Set(['en']);

const STORAGE_KEY = 'ww:locale';

/** Persist + apply a language choice (loading its catalogs if needed). */
export async function chooseLocale(locale: string): Promise<void> {
	if (!(locale in LOCALE_NAMES)) return;
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		/* storage unavailable (private mode etc.) — still applies for the session */
	}
	if (!loadedLocales.has(locale)) {
		await LOCALE_LOADERS[locale]?.();
		loadedLocales.add(locale);
	}
	setLocale(locale);
}

// Restore the saved language at import time. Catalog loading is async, so we
// expose `localeReady` — main.tsx awaits it before the first render so that
// server-derived text (daily tasks) and the narrative feed are generated in the
// saved language from the start, instead of baking in English for a beat.
export const localeReady: Promise<void> = (async () => {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && saved in LOCALE_NAMES && saved !== getLocale()) await chooseLocale(saved);
	} catch {
		/* storage unavailable */
	}
})();

export { t, tList, content, hasKey, getLocale, setLocale, onLocaleChange, availableLocales } from './core';
export type { Params } from './core';

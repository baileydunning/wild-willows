// React binding: re-renders a component when the language changes.
//
//   const { t, locale } = useI18n();
//
// Components may also import `t` directly from src/i18n when they're already
// re-rendered by state changes, but anything that must react to a live locale
// switch should call this hook (it's just a subscription — cheap).

import { useSyncExternalStore } from 'react';
import { getLocale, onLocaleChange, t, tList, content } from './index';

export function useI18n() {
	const locale = useSyncExternalStore(onLocaleChange, getLocale, getLocale);
	return { locale, t, tList, content };
}

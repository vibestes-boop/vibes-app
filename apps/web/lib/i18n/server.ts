// Server-seitige i18n-Helpers — NUR in Server Components / Route Handlern /
// Server Actions verwenden. Liest den Locale-Cookie via `next/headers`.
//
// Typische Verwendung:
//   const t = await getT();
//   <span>{t('nav.feed')}</span>
//
// oder Messages direkt fürs `<I18nProvider messages={…}>` in layout.tsx:
//   const { locale, messages } = await getI18n();

import { cookies } from 'next/headers';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';
import { resolve, type TranslationKey } from './translate';

/** Liest den aktuellen Locale aus dem Cookie, fällt zurück auf Default. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Liefert das passende Messages-Object für den aktuellen Locale. */
export async function getMessages(): Promise<Messages> {
  const locale = await getLocale();
  return MESSAGES[locale];
}

/** Bundle aus Locale + Messages — praktisch für `<I18nProvider>`-Props. */
export async function getI18n(): Promise<{ locale: Locale; messages: Messages }> {
  const locale = await getLocale();
  return { locale, messages: MESSAGES[locale] };
}

/**
 * Ready-to-use `t()`-Function für RSC-Inhalte.
 *
 *   const t = await getT();
 *   return <h1>{t('messages.emptyTitle')}</h1>
 */
export async function getT(): Promise<
  (key: TranslationKey, vars?: Record<string, string | number>) => string
> {
  const messages = await getMessages();
  return (key, vars) => resolve(messages, key, vars);
}

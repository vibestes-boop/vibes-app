// Server-seitige i18n-Helpers — NUR in Server Components / Route Handlern /
// Server Actions verwenden. Liest den Locale-Cookie via `next/headers`.
//
// Typische Verwendung:
//   const t = await getT();
//   <span>{t('nav.feed')}</span>
//
// oder Messages direkt fürs `<I18nProvider messages={…}>` in layout.tsx:
//   const { locale, messages } = await getI18n();

import { cookies, headers } from 'next/headers';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { fallbackChainFor, MESSAGES, type Messages } from './messages';
import { resolve, type DeepPartial, type TranslationKey } from './translate';

/**
 * Liest den aktuellen Locale: Cookie (explizite User-Wahl) → sonst
 * Accept-Language des Browsers (Erstbesuch) → sonst Default (de).
 * Sobald der User im Menü wählt, gewinnt der Cookie dauerhaft.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;
  try {
    const accept = (await headers()).get('accept-language') ?? '';
    for (const part of accept.split(',')) {
      const code = part.split(';')[0]!.trim().slice(0, 2).toLowerCase();
      if (isLocale(code)) return code;
    }
  } catch {
    // Außerhalb eines Request-Scopes (z.B. Build) → Default.
  }
  return DEFAULT_LOCALE;
}

/** Liefert das passende Messages-Object für den aktuellen Locale (ggf. partiell). */
export async function getMessages(): Promise<DeepPartial<Messages>> {
  const locale = await getLocale();
  return MESSAGES[locale];
}

/** Bundle aus Locale + Messages — praktisch für `<I18nProvider>`-Props. */
export async function getI18n(): Promise<{ locale: Locale; messages: DeepPartial<Messages> }> {
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
  const locale = await getLocale();
  const messages = MESSAGES[locale];
  const chain = fallbackChainFor(locale);
  return (key, vars) => resolve(messages, key, vars, chain);
}

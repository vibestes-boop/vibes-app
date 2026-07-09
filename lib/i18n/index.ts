/**
 * lib/i18n — öffentliche API des App-Übersetzungssystems.
 *
 *   const { t, locale, setLocale } = useI18n();
 *   t('auth.login')                        → 'Einloggen' | 'Войти'
 *   t('onboarding.selectMore', { count })  → mit {var}-Interpolation
 *
 * Deutsch ist Source-of-Truth; fehlende ru-Keys fallen auf Deutsch zurück.
 * Für Nicht-Komponenten-Kontexte gibt es tStatic() (liest den Store direkt).
 */

import { useCallback } from 'react';
import { useI18nStore } from './i18nStore';
import { de, MESSAGES, type AppLocale } from './messages';
import { resolve, type TranslationKey } from './translate';

export type { AppLocale } from './messages';
export { LOCALE_LABELS } from './messages';
export type { TranslationKey } from './translate';
export { useI18nStore } from './i18nStore';

export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      resolve(MESSAGES[locale], key, vars, de),
    [locale],
  );

  return { t, locale, setLocale };
}

/** Für Code außerhalb von React (Utils, Stores) — liest die aktuelle Locale. */
export function tStatic(key: TranslationKey, vars?: Record<string, string | number>): string {
  const locale: AppLocale = useI18nStore.getState().locale;
  return resolve(MESSAGES[locale], key, vars, de);
}

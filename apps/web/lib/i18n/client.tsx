'use client';

// Client-seitige i18n — `useI18n()` Hook für Client Components.
// Messages werden vom Server über `<I18nProvider>` in layout.tsx hereingereicht
// (siehe app/layout.tsx); der Client fetcht selbst nichts dynamisch nach.

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE } from './config';
import type { Locale } from './config';
import { MESSAGES, type Messages } from './messages';
import { resolve, type DeepPartial, type TranslationKey } from './translate';

// Deutsch als Laufzeit-Fallback für Keys, die in einer partiellen Locale
// (ru/ce/en) noch fehlen — verhindert rohe Key-Strings in der UI.
const FALLBACK_MESSAGES = MESSAGES[DEFAULT_LOCALE];

type I18nContextValue = {
  locale: Locale;
  messages: DeepPartial<Messages>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: DeepPartial<Messages>;
  children: ReactNode;
}) {
  // `useMemo` weil das Provider-Value-Object sonst bei jedem Re-Render
  // referentiell neu wäre → alle Consumer würden unnötig re-rendern.
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Standard-Hook für Client Components. Wirft wenn kein Provider parent ist. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n() must be used inside <I18nProvider>');
  }
  return {
    locale: ctx.locale,
    /** Übersetzt einen Key mit optionaler Variablen-Interpolation. */
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      resolve(ctx.messages, key, vars, FALLBACK_MESSAGES),
  };
}

/**
 * Optional variant for leaf widgets that can safely render outside the app
 * provider, for example in smoke-tested public cards or isolated embeds.
 */
export function useOptionalI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) return null;

  return {
    locale: ctx.locale,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      resolve(ctx.messages, key, vars, FALLBACK_MESSAGES),
  };
}

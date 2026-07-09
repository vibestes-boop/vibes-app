// -----------------------------------------------------------------------------
// Kern-Resolver für Translation-Keys — 1:1-Port des Web-Systems
// (apps/web/lib/i18n/translate.ts), damit App und Web dasselbe mentale Modell
// teilen: Deutsch ist die strikte Source-of-Truth, andere Sprachen dürfen
// partiell sein und fallen zur Laufzeit auf Deutsch zurück.
// -----------------------------------------------------------------------------

import type { Messages } from './messages';

// Alle Keys des Messages-Objects als dot-notation-Strings — macht t() type-safe.
type PathInto<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
    ? PathInto<T[K], `${Prefix}${K}.`>
    : never;
}[keyof T & string];

export type TranslationKey = PathInto<Messages>;

/** Nicht-deutsche Locales dürfen unvollständig sein. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? T[K]
    : T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

function lookup(messages: DeepPartial<Messages>, key: TranslationKey): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = messages;
  for (const p of key.split('.')) {
    if (node == null || typeof node !== 'object') return null;
    node = node[p];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Resolvt einen dot-path und ersetzt `{vars}`.
 * Fallback-Kette: gewählte Locale → Deutsch → Key selbst.
 */
export function resolve(
  messages: DeepPartial<Messages>,
  key: TranslationKey,
  vars?: Record<string, string | number>,
  fallback?: DeepPartial<Messages>,
): string {
  const direct = lookup(messages, key);
  if (direct != null) return vars ? interpolate(direct, vars) : direct;

  if (fallback) {
    const fb = lookup(fallback, key);
    if (fb != null) return vars ? interpolate(fb, vars) : fb;
  }

  __DEV__ && console.warn(`[i18n] missing key (kein Fallback): ${key}`);
  return key;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? `{${name}}` : String(v);
  });
}

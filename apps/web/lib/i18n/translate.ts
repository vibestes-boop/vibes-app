// Kern-Resolver für Translation-Keys. Gemeinsam genutzt von Server (server.ts)
// und Client (client.tsx) — die Logik „Key → String + Interpolation" ist
// identisch, nur die Messages-Quelle unterscheidet sich (RSC liest Cookie,
// Client liest Context).

import type { Messages } from './messages';

// Alle Keys des Messages-Objects als dot-notation-Strings — erzeugt rekursiv
// aus `Messages`. Gibt `'nav.feed' | 'nav.explore' | 'header.coinsAria' | ...`
// zurück und macht `t()` vollständig type-safe.
//
// `Value extends string` filter raus: nur Leaf-Nodes (Strings), keine Objects.

type PathInto<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
    ? PathInto<T[K], `${Prefix}${K}.`>
    : never;
}[keyof T & string];

export type TranslationKey = PathInto<Messages>;

/**
 * DeepPartial — nicht-deutsche Locales dürfen unvollständig sein (nur Deutsch
 * ist die strikte Source-of-Truth). Fehlende Keys fallen zur Laufzeit auf
 * Deutsch zurück (siehe `resolve`), sodass wir Sprachen inkrementell füllen
 * können, ohne den Build zu brechen oder rohe Key-Strings zu zeigen.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? T[K]
    : T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

// Läuft den dot-path ab und gibt den Leaf-String zurück — oder null, wenn der
// Key in diesem (ggf. partiellen) Messages-Object fehlt / kein String ist.
function lookup(
  messages: DeepPartial<Messages>,
  key: TranslationKey,
): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = messages;
  for (const p of key.split('.')) {
    if (node == null || typeof node !== 'object') return null;
    node = node[p];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Resolvt einen dot-path in einem Messages-Object und ersetzt `{vars}`.
 *
 * Fallback-Kette: gewählte Locale → `fallback` (Deutsch) → Key selbst. Fehlt ein
 * Key in einer partiellen Locale (ru/ce/en), zeigt die UI also Deutsch statt
 * eines rohen Key-Strings. In Dev loggen wir, wenn selbst der Fallback fehlt.
 */
export function resolve(
  messages: DeepPartial<Messages>,
  key: TranslationKey,
  vars?: Record<string, string | number>,
  fallback?: DeepPartial<Messages> | DeepPartial<Messages>[],
): string {
  const direct = lookup(messages, key);
  if (direct != null) return vars ? interpolate(direct, vars) : direct;

  // Fallback-KETTE (z.B. ce → ru → de): erste Sprache, die den Key hat, gewinnt.
  for (const fb of Array.isArray(fallback) ? fallback : fallback ? [fallback] : []) {
    const hit = lookup(fb, key);
    if (hit != null) return vars ? interpolate(hit, vars) : hit;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[i18n] missing key (kein Fallback): ${key}`);
  }
  return key;
}

// `Hallo {name}!` + { name: 'Zaur' } → `Hallo Zaur!`
// Einfaches Single-Curly-Pattern, keine ICU-MessageFormat-Pluralisierung.
// Für Plural/Gender-Anforderungen später ggf. intl-messageformat einziehen.
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? `{${name}}` : String(v);
  });
}

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
 * Resolvt einen dot-path in einem Messages-Object und ersetzt `{vars}`.
 *
 * Schutzschild: Wenn der Key fehlt (z.B. weil eine Locale veraltet ist und
 * ein Key nach dem Satisfies-Check noch nicht gepflegt wurde), geben wir
 * den Key selbst als Fallback zurück anstatt zu crashen — macht UI-Regressionen
 * sichtbar ohne Production zu brechen. In Dev loggen wir einen Warning.
 */
export function resolve(
  messages: Messages,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = messages;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') {
      if (process.env.NODE_ENV !== 'production') {

        console.warn(`[i18n] missing key: ${key}`);
      }
      return key;
    }
    node = node[p];
  }
  if (typeof node !== 'string') {
    if (process.env.NODE_ENV !== 'production') {

      console.warn(`[i18n] key is not a leaf string: ${key}`);
    }
    return key;
  }
  return vars ? interpolate(node, vars) : node;
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

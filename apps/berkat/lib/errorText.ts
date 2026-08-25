// Aus einem geworfenen Etwas einen lesbaren Satz machen.
//
// ── ⚠️ WARUM ES DIESE DATEI GIBT (26.08.2026) ───────────────────────────────
//
// Zaur klickte auf „Nicht bezahlt" und bekam:
//
//     Der Server sagt: [object Object]
//
// Das ist keine Fehlermeldung, das ist eine verschluckte. Der eigentliche Grund
// — `already_paid`? `too_early`? etwas ganz anderes? — war damit nicht mehr zu
// erkennen, und zwar weder für ihn noch für mich.
//
// Die Ursache ist ein Muster, das an vielen Stellen in dieser App steht:
//
//     catch (e) { text(e instanceof Error ? e.message : String(e)) }
//
// `PostgrestError` erbt zwar von `Error`, aber nicht jedes geworfene Etwas tut
// das: Ein Fehler aus der Auth-Schicht, aus `functions.invoke`, ein
// durchgereichtes Objekt aus React Query — bei allen ist `instanceof Error`
// falsch, und `String(…)` macht daraus `[object Object]`.
//
// > **Ein Sammel-Zweig, der die Auskunft wegwirft, ist schlimmer als gar
// > keiner.** Er sieht nach Fehlerbehandlung aus und verhindert die Diagnose.
//
// Dieselbe Lehre steht in der Übergabe schon einmal, für Edge Functions: „Eine
// Fehlermeldung für alles ist keine Fehlermeldung" (Abschnitt 3).

/**
 * Holt die aussagekräftigste Zeichenkette aus einem geworfenen Wert.
 *
 * Die Reihenfolge ist Absicht: `message` zuerst, weil dort bei Postgres der
 * `RAISE`-Text steht (`too_early`, `already_paid` …), an dem die
 * Übersetzer-Funktionen hängen. Erst danach das Drumherum.
 *
 * ⚠️ Am Ende steht `JSON.stringify`, NICHT `String(…)`. Genau der Unterschied
 * hat den Fall oben verursacht: `String({})` ist `[object Object]`,
 * `JSON.stringify({})` ist wenigstens `{}` — und bei einem echten Fehlerobjekt
 * steht dort alles drin, was man zum Suchen braucht.
 */
export function errText(e: unknown): string {
  if (e == null) return '';
  if (typeof e === 'string') return e;

  const o = e as Record<string, unknown>;

  // `message` deckt Error, PostgrestError und die meisten Supabase-Fehler ab.
  if (typeof o.message === 'string' && o.message) return o.message;
  // PostgREST legt den Rest hierhin, wenn `message` leer bleibt.
  if (typeof o.details === 'string' && o.details) return o.details;
  if (typeof o.hint === 'string' && o.hint) return o.hint;
  if (typeof o.error_description === 'string' && o.error_description) {
    return o.error_description;
  }
  if (typeof o.code === 'string' && o.code) return o.code;

  try {
    const s = JSON.stringify(e);
    // `{}` sagt nichts — dann lieber ehrlich sagen, dass nichts dastand.
    return s && s !== '{}' ? s : 'Unbekannter Fehler ohne Meldung.';
  } catch {
    return 'Unbekannter Fehler ohne Meldung.';
  }
}

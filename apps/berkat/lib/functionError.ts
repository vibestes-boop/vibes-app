// Was eine Edge Function wirklich geantwortet hat.
//
// `supabase.functions.invoke` wirft bei jedem Nicht-2xx denselben
// nichtssagenden Fehler. Die eigentliche Begründung steckt im Rumpf der
// Antwort, den supabase-js an `error.context` hängt (ein `Response`).
//
// Ohne das Auslesen sieht ein fehlender Datensatz genauso aus wie eine
// abgelehnte Stripe-Anfrage oder ein Absturz der Function — und man sucht im
// Dunkeln. Am 15.08.2026 kostete genau das eine halbe Suche: Der Client zeigte
// bei jedem Fehlschlag „Die Kasse ließ sich nicht öffnen", während der Status
// die Antwort sofort gehabt hätte (500 = die Function warf, also kein
// Stripe-Problem).
//
// Lag bis dahin nur in `useTip.ts` und damit ausgerechnet nicht auf dem
// wichtigeren Weg, dem Sammelkorb. Deshalb steht es jetzt hier.

/**
 * Der Status ist die verlässlichste Auskunft und wird **zuerst** gesichert:
 * Er bleibt auch dann lesbar, wenn der Rumpf schon verbraucht ist. supabase-js
 * liest ihn je nach Fassung selbst aus, danach wirft `.json()` mit
 * „body already consumed".
 */
export async function functionErrorCode(
  fnError: unknown,
): Promise<{ code: string; detail: string; status: number }> {
  const context = (fnError as { context?: Response }).context;
  const status = typeof context?.status === 'number' ? context.status : 0;
  try {
    if (!context || typeof context.json !== 'function') return { code: '', detail: '', status };
    const body = (await context.json()) as { error?: string; detail?: string } | null;
    return {
      code: String(body?.error ?? ''),
      detail: String(body?.detail ?? ''),
      status,
    };
  } catch {
    return { code: '', detail: '', status };
  }
}

/**
 * Aus Code, Begründung und Status den bestmöglichen Satz bauen.
 *
 * Reihenfolge ist Absicht: Stripes eigene Begründung (`detail`) schlägt jede
 * allgemeine Formulierung, weil sie sagt, welches Feld nicht passt. Danach der
 * bekannte Code. Und wenn beides fehlt, wenigstens der Status — sonst sieht
 * jeder Fehlschlag wieder gleich aus, und das ist genau die Sackgasse, aus der
 * dieses Modul stammt.
 */
export function functionErrorMessage(
  { code, detail, status }: { code: string; detail: string; status: number },
  known: (code: string) => string | null,
): string {
  if (detail) return detail;
  if (code) return known(code) ?? `Die Kasse antwortete mit „${code}".`;
  return status
    ? `Die Kasse antwortete mit HTTP ${status}.`
    : 'Die Kasse war nicht erreichbar. Netz prüfen und nochmal.';
}

/** Codes, die beide Kassen-Wege gleich beantworten. */
export function sharedCheckoutErrorText(code: string): string | null {
  switch (code) {
    case 'stripe_session_create_failed':
      return 'Stripe hat die Zahlung abgelehnt. Versuch es noch einmal.';
    case 'server_misconfigured':
      return 'Auf dem Server fehlt ein Schlüssel. Das müssen wir beheben.';
    case 'not_authorized':
      return 'Das gehört nicht dir.';
    default:
      return null;
  }
}

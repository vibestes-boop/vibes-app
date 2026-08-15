// Trinkgeld geben.
//
// Zwei Schritte, wie beim Sammelkorb: Erst legt der Server die Zeile an und
// prüft dabei Betrag und Empfänger (`create_berkat_tip`), dann erzeugt die
// Edge Function die Stripe-Seite. Der Client behauptet nie einen Betrag —
// er fragt einen an.
//
// Bezahlt wird im Browser. Bestätigt wird die Zahlung ausschließlich vom
// Webhook; kehrt jemand ohne zu zahlen zurück, bleibt die Zeile 'pending'
// und kostet niemanden etwas.

import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type TipResult = { ok: true } | { ok: false; message: string };

/** Vorschläge in Cent. Der mittlere ist der, den die meisten nehmen. */
export const TIP_PRESETS = [200, 500, 1000, 2000];

export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 50_000;

/**
 * Was die Edge Function geantwortet hat.
 *
 * `functions.invoke` wirft bei jedem Nicht-2xx denselben nichtssagenden Fehler
 * — die eigentliche Begründung steckt im Rumpf der Antwort, den supabase-js an
 * `error.context` hängt (ein `Response`). Ohne das Auslesen sieht ein fehlender
 * Datensatz genauso aus wie eine abgelehnte Stripe-Anfrage, und man sucht im
 * Dunkeln. Genau das ist am 15.08.2026 beim ersten Trinkgeld passiert.
 */
async function functionErrorCode(
  fnError: unknown,
): Promise<{ code: string; detail: string; status: number }> {
  const context = (fnError as { context?: Response }).context;
  // Der Status allein sagt schon, welcher Zweig gegriffen hat (404/403/409/502)
  // — und er ist auch dann noch da, wenn der Rumpf nicht mehr zu lesen ist.
  // supabase-js liest ihn je nach Fassung selbst aus, dann wirft `.json()`
  // „body already consumed". Deshalb zuerst den Status sichern.
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

function checkoutErrorText(code: string): string {
  switch (code) {
    case 'tip_not_found':
      return 'Das Trinkgeld wurde nicht gefunden. Versuch es noch einmal.';
    case 'not_authorized':
      return 'Das ist nicht dein Trinkgeld.';
    case 'tip_not_payable':
      return 'Dieses Trinkgeld ist schon bezahlt oder abgelaufen.';
    case 'stripe_session_create_failed':
      return 'Stripe hat die Zahlung abgelehnt. Versuch es noch einmal.';
    case 'server_misconfigured':
      return 'Auf dem Server fehlt ein Schlüssel. Das müssen wir beheben.';
    case '':
      return 'Die Kasse ließ sich nicht öffnen. Versuch es noch einmal.';
    default:
      return `Die Kasse antwortete mit „${code}".`;
  }
}

function tipErrorText(message: string): string {
  if (message.includes('cannot_tip_self')) return 'Dir selbst geht leider nicht. 🙂';
  if (message.includes('amount_out_of_range'))
    return 'Zwischen 1 € und 500 € — such dir was aus.';
  if (message.includes('recipient_not_found')) return 'Diesen Verkäufer gibt es nicht mehr.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Trinkgeld-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return 'Das hat nicht geklappt. Versuch es noch einmal.';
}

export function useSendTip() {
  const queryClient = useQueryClient();

  return useCallback(
    async (input: {
      recipientId: string;
      amountCents: number;
      message?: string;
      sessionId?: string;
    }): Promise<TipResult> => {
      const { data: tipId, error } = await supabase.rpc('create_berkat_tip', {
        p_recipient_id: input.recipientId,
        p_amount_cents: input.amountCents,
        p_message: input.message ?? null,
        p_session_id: input.sessionId ?? null,
      });
      if (error || !tipId) {
        return { ok: false, message: tipErrorText(error?.message ?? '') };
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        'create-checkout-session',
        { body: { tip_id: tipId } },
      );
      if (fnError) {
        const { code, detail, status } = await functionErrorCode(fnError);
        if (__DEV__) {
          console.warn(
            '[Berkat] Trinkgeld-Kasse:',
            (fnError as Error).message,
            '· status',
            status,
            '· code',
            code,
            '· detail',
            detail,
          );
        }
        // Stripes eigene Begründung schlägt jede allgemeine Formulierung —
        // sie sagt, welches Feld nicht passt.
        if (detail) return { ok: false, message: detail };
        if (code) return { ok: false, message: checkoutErrorText(code) };
        // Weder Code noch Begründung lesbar: dann wenigstens der Status, sonst
        // sieht jeder Fehlschlag gleich aus.
        return {
          ok: false,
          message: status
            ? `Die Kasse antwortete mit HTTP ${status}.`
            : 'Die Kasse war nicht erreichbar. Netz prüfen und nochmal.',
        };
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) return { ok: false, message: 'Stripe hat keine Bezahlseite geliefert.' };

      await Linking.openURL(url);
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'tips-received'] });
      return { ok: true };
    },
    [queryClient],
  );
}

export type ReceivedTip = {
  id: string;
  sender_id: string;
  amount_cents: number;
  message: string | null;
  paid_at: string | null;
};

/** Was ein Verkäufer bekommen hat. Ohne diese Liste käme das Geld lautlos an. */
export function useReceivedTips(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'tips-received', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ReceivedTip[]> => {
      const { data, error } = await supabase
        .from('berkat_tips')
        .select('id, sender_id, amount_cents, message, paid_at')
        .eq('recipient_id', userId!)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ReceivedTip[];
    },
  });
}

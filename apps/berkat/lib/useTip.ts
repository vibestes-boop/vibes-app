// Trinkgeld geben.
//
// Zwei Schritte, wie beim Sammelkorb: Erst legt der Server die Zeile an und
// prüft dabei Betrag und Empfänger (`create_berkat_tip`), dann erzeugt die
// Edge Function die Stripe-Seite. Der Client behauptet nie einen Betrag —
// er fragt einen an.
//
// Bezahlt wird als Blatt über der App (siehe `payBrowser.ts`). Bestätigt wird
// die Zahlung ausschließlich vom Webhook; kehrt jemand ohne zu zahlen zurück,
// bleibt die Zeile 'pending' und kostet niemanden etwas.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { openPaymentPage } from './payBrowser';
import {
  functionErrorCode,
  functionErrorMessage,
  sharedCheckoutErrorText,
} from './functionError';

export type TipResult = { ok: true } | { ok: false; message: string };

/** Vorschläge in Cent. Der mittlere ist der, den die meisten nehmen. */
export const TIP_PRESETS = [200, 500, 1000, 2000];

export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 50_000;

function tipCheckoutErrorText(code: string): string | null {
  switch (code) {
    case 'tip_not_found':
      return 'Das Trinkgeld wurde nicht gefunden. Versuch es noch einmal.';
    case 'not_authorized':
      return 'Das ist nicht dein Trinkgeld.';
    case 'tip_not_payable':
      return 'Dieses Trinkgeld ist schon bezahlt oder abgelaufen.';
    default:
      return sharedCheckoutErrorText(code);
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
        const parsed = await functionErrorCode(fnError);
        if (__DEV__) {
          console.warn(
            '[Berkat] Trinkgeld-Kasse:',
            (fnError as Error).message,
            '· status',
            parsed.status,
            '· code',
            parsed.code,
            '· detail',
            parsed.detail,
          );
        }
        return { ok: false, message: functionErrorMessage(parsed, tipCheckoutErrorText) };
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) return { ok: false, message: 'Stripe hat keine Bezahlseite geliefert.' };

      await openPaymentPage(url);
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

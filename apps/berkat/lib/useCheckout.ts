// Sammelkorb bezahlen.
//
// Zwei Schritte, absichtlich getrennt:
//   1. `checkout_auction_cart` macht aus dem Korb EINE Bestellung. Idempotent —
//      ein zweiter Tipp erzeugt keine zweite Bestellung.
//   2. `create-checkout-session` (Serlos Edge Function) erzeugt die
//      Stripe-Seite. Sie sammelt auch die Versandadresse ein, deshalb gibt es
//      in Berkat kein eigenes Adressformular.
//
// Bezahlt wird seit dem 15.08.2026 als Blatt ÜBER der App statt in Safari —
// warum, steht in `payBrowser.ts`. Der Ruf kehrt erst zurück, wenn das Blatt
// wieder zu ist; der Knopf bleibt so lange besetzt, und das ist richtig so.
//
// Bestätigt wird die Zahlung ausschließlich vom Stripe-Webhook. Wer die Kasse
// ohne zu zahlen schließt, lässt einen Korb in `checkout_pending` zurück — er
// steht weiter unter „Konto" und lässt sich erneut bezahlen.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { openPaymentPage, refetchAfterPayment } from './payBrowser';
import { reportProblem } from './report';
import {
  functionErrorCode,
  functionErrorMessage,
  sharedCheckoutErrorText,
} from './functionError';

export type CheckoutResult = { ok: true } | { ok: false; message: string };

/** Fehler der RPC, also noch vor der Kasse. */
function cartErrorText(message: string): string {
  if (message.includes('cart_empty')) return 'In diesem Paket ist noch nichts drin.';
  if (message.includes('cart_closed')) return 'Das Paket ist schon bezahlt oder abgelaufen.';
  if (message.includes('forbidden')) return 'Das ist nicht dein Paket.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Kassen-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return 'Das Paket ließ sich nicht abschließen. Versuch es noch einmal.';
}

/** Fehler der Edge Function, also in der Kasse. */
function orderCheckoutErrorText(code: string): string | null {
  switch (code) {
    case 'order_not_found':
      return 'Diese Bestellung gibt es nicht mehr.';
    case 'order_not_payable':
      return 'Diese Bestellung ist schon bezahlt.';
    default:
      return sharedCheckoutErrorText(code);
  }
}

export function useCheckoutCart() {
  const queryClient = useQueryClient();

  return useCallback(
    async (cartId: string): Promise<CheckoutResult> => {
      const { data: orderId, error } = await supabase.rpc('checkout_auction_cart', {
        p_cart_id: cartId,
      });
      if (error || !orderId) {
        reportProblem('kasse.korb-abschluss', { message: error?.message ?? 'leer' });
        return { ok: false, message: cartErrorText(error?.message ?? '') };
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        'create-checkout-session',
        { body: { order_id: orderId } },
      );
      if (fnError) {
        const parsed = await functionErrorCode(fnError);
        if (__DEV__) {
          console.warn(
            '[Berkat] Sammelkorb-Kasse:',
            (fnError as Error).message,
            '· status',
            parsed.status,
            '· code',
            parsed.code,
            '· detail',
            parsed.detail,
          );
        }
        // Eine Kasse, die sich nicht öffnet, stürzt nicht ab — sie zeigt eine
        // freundliche Meldung, und der Käufer geht. Ohne diese Zeile wäre genau
        // das unsichtbar.
        reportProblem('kasse.sammelkorb', {
          status: parsed.status,
          code: parsed.code,
          detail: parsed.detail,
        });
        return { ok: false, message: functionErrorMessage(parsed, orderCheckoutErrorText) };
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) {
        return { ok: false, message: 'Stripe hat keine Bezahlseite geliefert.' };
      }

      await openPaymentPage(url);
      await refetchAfterPayment(queryClient);
      return { ok: true };
    },
    [queryClient],
  );
}

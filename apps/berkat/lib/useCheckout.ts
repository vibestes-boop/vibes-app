// Sammelkorb bezahlen.
//
// Zwei Schritte, absichtlich getrennt:
//   1. `checkout_auction_cart` macht aus dem Korb EINE Bestellung. Idempotent —
//      ein zweiter Tipp erzeugt keine zweite Bestellung.
//   2. `create-checkout-session` (Serlos Edge Function) erzeugt die
//      Stripe-Seite. Sie sammelt auch die Versandadresse ein, deshalb gibt es
//      in Berkat kein eigenes Adressformular.
//
// Bezahlt wird im Browser. Zurück in die App kommt man von Hand — eine
// Rückleitung per Deeplink wäre möglich, aber die Erfolgsseite gehört Serlo
// und wird gerade von der Parfüm-Bestellung mitbenutzt.

import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type CheckoutResult = { ok: true } | { ok: false; message: string };

function checkoutErrorText(message: string): string {
  if (message.includes('cart_empty'))
    return 'In diesem Paket ist noch nichts drin.';
  if (message.includes('cart_closed'))
    return 'Das Paket ist schon bezahlt oder abgelaufen.';
  if (message.includes('forbidden')) return 'Das ist nicht dein Paket.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Kassen-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return 'Die Kasse ließ sich nicht öffnen. Versuch es noch einmal.';
}

export function useCheckoutCart() {
  const queryClient = useQueryClient();

  return useCallback(
    async (cartId: string): Promise<CheckoutResult> => {
      const { data: orderId, error } = await supabase.rpc('checkout_auction_cart', {
        p_cart_id: cartId,
      });
      if (error || !orderId) {
        return { ok: false, message: checkoutErrorText(error?.message ?? '') };
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        'create-checkout-session',
        { body: { order_id: orderId } },
      );
      if (fnError) {
        return { ok: false, message: 'Die Kasse ließ sich nicht öffnen. Versuch es noch einmal.' };
      }

      const url = (data as { url?: string } | null)?.url;
      if (!url) {
        return { ok: false, message: 'Stripe hat keine Bezahlseite geliefert.' };
      }

      await Linking.openURL(url);
      // Der Korb schließt sich erst, wenn Stripe die Zahlung bestätigt hat —
      // das erledigt ein Trigger auf der Bestellung. Hier kann also noch nichts
      // Neues stehen; das Nachladen beim Zurückwechseln erledigt der
      // Fokus-Wächter im Wurzel-Layout. Dieser Ruf setzt nur den Zähler
      // zurück, damit dort auch wirklich frisch geholt wird.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-carts'] });
      return { ok: true };
    },
    [queryClient],
  );
}

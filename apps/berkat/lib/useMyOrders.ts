// Was der Käufer gekauft hat — nach dem Bezahlen.
//
// Bis zum 14.08.2026 endete für ihn hier alles: „Deine Pakete" zeigt nur
// OFFENE Körbe, und mit der Zahlung wird der Korb `checked_out`. Damit
// verschwand jede Spur — kein Kauf, kein Zustand, keine Sendungsnummer. Der
// Verkäufer markierte brav „versendet", und der Käufer erfuhr es nie.
//
// Whatnot hat dafür eine eigene Liste. Diese hier ist ihr Gegenstück: bezahlt,
// unterwegs, angekommen — samt der Artikel, die drin liegen.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type MyOrder = {
  id: string;
  seller_id: string;
  title: string | null;
  amount_eur: string;
  status: string;
  cart_id: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  /** Die einzelnen Artikel — aus dem Sammelkorb der Bestellung. */
  items: string[];
};

export function useMyOrders(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-orders', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    // Der Verkäufer kann jederzeit auf „versendet" stellen; beim Öffnen des
    // Reiters soll das ankommen. Die Verkabelung sitzt im Wurzel-Layout.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MyOrder[]> => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(
          'id, seller_id, title, amount_eur, status, cart_id, tracking_carrier, tracking_number, paid_at, shipped_at',
        )
        .eq('buyer_id', userId!)
        .in('status', ['paid', 'shipped', 'delivered'])
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(30);
      if (error) throw error;

      const orders = (data ?? []) as unknown as Omit<MyOrder, 'items'>[];
      if (orders.length === 0) return [];

      // Die Artikelnamen liegen an den Auktionen, nicht an der Bestellung —
      // die trägt nur eine Zusammenfassung wie „3 Artikel aus der Live-Show".
      const cartIds = orders.map((o) => o.cart_id).filter((id): id is string => Boolean(id));
      const byCart = new Map<string, string[]>();

      if (cartIds.length > 0) {
        const { data: won, error: wonError } = await supabase
          .from('live_auctions')
          .select('cart_id, title')
          .in('cart_id', cartIds)
          .eq('status', 'sold');
        if (wonError) throw wonError;
        for (const row of (won ?? []) as { cart_id: string; title: string }[]) {
          const list = byCart.get(row.cart_id) ?? [];
          list.push(row.title);
          byCart.set(row.cart_id, list);
        }
      }

      return orders.map((o) => ({
        ...o,
        items: o.cart_id ? byCart.get(o.cart_id) ?? [] : [],
      }));
    },
  });
}

/** Zustand einer Bestellung aus Käufer-Sicht — was IHN interessiert. */
export function buyerStatus(status: string): string {
  switch (status) {
    case 'paid':
      return 'Bezahlt · wird gepackt';
    case 'shipped':
      return 'Unterwegs zu dir';
    case 'delivered':
      return 'Angekommen';
    default:
      return status;
  }
}

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
  items: CartItem[];
};

/**
 * Ein Artikel aus einem Sammelkorb.
 *
 * War bis zum 16.08.2026 nur der Titel. Ein Paket ohne Bilder ist eine Liste
 * von Wörtern — wer drei Sachen an einem Abend gewonnen hat, erkennt sie am
 * Foto und nicht an „Silberring, handgemacht". Das Bild liegt ohnehin an der
 * Auktion; es wurde nur nicht mitgenommen.
 */
export type CartItem = {
  /**
   * ⚠️ Seit dem 26.08.2026 dabei, damit die Zeile ANTIPPBAR ist. Zaur beim
   * Prüfen: „wenn man drauf klickt öffnet das Produktdetailsseite nicht" —
   * sie konnte es gar nicht, der Kennung wegen. Ein Bild, das aussieht wie ein
   * Knopf und keiner ist, ist schlimmer als ein Bild ohne Anspruch.
   */
  id: string;
  title: string;
  image_url: string | null;
  /** Der Zuschlagspreis dieses einen Artikels. */
  price_cents: number | null;
};

/**
 * Eine einzelne Bestellung — für die Detailseite.
 *
 * Eigene Abfrage statt „aus `useMyOrders` heraussuchen": Die Seite muss auch
 * kalt aufgehen (Direktlink, App-Neustart, später ein Push), und dann ist die
 * große Liste noch nicht geladen. Sie holt zusätzlich `shipping_cents` — auf
 * der Übersicht wäre das Rauschen, hier gehört es zur Abrechnung.
 *
 * Die Policy auf `product_orders` lässt Käufer und Verkäufer ihre eigenen
 * Zeilen sehen; `buyer_id` steht trotzdem im Filter, damit die Absicht im Code
 * steht und nicht nur in der Datenbank.
 */
export function useMyOrder(orderId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-order', orderId],
    enabled: Boolean(orderId && userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<(MyOrder & { shipping_cents: number }) | null> => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(
          'id, seller_id, title, amount_eur, shipping_cents, status, cart_id, tracking_carrier, tracking_number, paid_at, shipped_at',
        )
        .eq('id', orderId!)
        .eq('buyer_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const order = data as unknown as Omit<MyOrder, 'items'> & { shipping_cents: number };
      if (!order.cart_id) return { ...order, items: [] };

      const { data: won } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, current_bid_cents')
        .eq('cart_id', order.cart_id)
        .eq('status', 'sold');

      return {
        ...order,
        items: (
          (won ?? []) as {
            id: string;
            title: string;
            image_url: string | null;
            current_bid_cents: number | null;
          }[]
        ).map((row) => ({
          id: row.id,
          title: row.title,
          image_url: row.image_url,
          price_cents: row.current_bid_cents,
        })),
      };
    },
  });
}

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
      const byCart = new Map<string, CartItem[]>();

      if (cartIds.length > 0) {
        const { data: won, error: wonError } = await supabase
          .from('live_auctions')
          .select('id, cart_id, title, image_url, current_bid_cents')
          .in('cart_id', cartIds)
          .eq('status', 'sold');
        if (wonError) throw wonError;
        for (const row of (won ?? []) as {
          id: string;
          cart_id: string;
          title: string;
          image_url: string | null;
          current_bid_cents: number | null;
        }[]) {
          const list = byCart.get(row.cart_id) ?? [];
          list.push({
            id: row.id,
            title: row.title,
            image_url: row.image_url,
            price_cents: row.current_bid_cents,
          });
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

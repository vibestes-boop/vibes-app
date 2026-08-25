// Bestellungen aus Verkäufersicht.
//
// Lesen geht direkt über die Tabelle: die vorhandene Policy auf product_orders
// lässt Käufer UND Verkäufer ihre eigenen Zeilen sehen. Schreiben nicht —
// der Geldpfad ist service_role-only, deshalb läuft „versendet" über eine eng
// geschnittene RPC.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CartItem } from './useMyOrders';

export type SellerOrder = {
  id: string;
  buyer_id: string;
  title: string | null;
  amount_eur: string;
  /** Was der Käufer an Versand gezahlt hat. 0 bei Bestellungen von vor dem 15.08.2026. */
  shipping_cents: number;
  status: string;
  /** Berkat-Weiche: gesetzt = Sammelkorb, NULL = Serlo-Produktkauf. */
  cart_id: string | null;
  /** Was tatsächlich ins Paket gehört — mit Bild. */
  items: CartItem[];
  /**
   * Versandstufe des ganzen Pakets — die HÖCHSTE seiner Artikel, weil alles in
   * dieselbe Sendung geht. Ohne Sammelkorb (Serlo-Produktkauf) und bei
   * fehlender Angabe: 4, also der teuerste Satz.
   */
  shippingTier: number;
  ship_name: string | null;
  ship_street: string | null;
  ship_zip: string | null;
  ship_city: string | null;
  ship_country: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  paid_at: string | null;
  created_at: string;
};

/** Bestellungen, für die noch etwas zu tun ist — zuerst die bezahlten. */
export function useSellerOrders(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'seller-orders', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    // Der Takt pausiert im Hintergrund. Ohne das hier sähe der Verkäufer eine
    // eingegangene Zahlung erst bis zu dreißig Sekunden nach dem Zurückwechseln.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SellerOrder[]> => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(
          'id, buyer_id, title, amount_eur, shipping_cents, status, cart_id, ship_name, ship_street, ship_zip, ship_city, ship_country, tracking_carrier, tracking_number, paid_at, created_at',
        )
        .eq('seller_id', userId!)
        .in('status', ['paid', 'shipped', 'delivered'])
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;

      const orders = (data ?? []) as unknown as Omit<SellerOrder, 'items'>[];
      if (orders.length === 0) return [];

      // WAS soll gepackt werden? Die Bestellung trägt nur eine Zusammenfassung
      // („3 Artikel aus der Live-Show"); die einzelnen Artikel samt Foto hängen
      // an den Auktionen des Sammelkorbs. Wer ein Paket packt, braucht genau
      // die Bilder — bis zum 16.08.2026 stand dort nur Text.
      const cartIds = orders.map((o) => o.cart_id).filter((id): id is string => Boolean(id));
      const byCart = new Map<string, CartItem[]>();
      const tierByCart = new Map<string, number>();

      if (cartIds.length > 0) {
        const { data: won } = await supabase
          .from('live_auctions')
          // `shipping_tier` MUSS mit: Ohne sie kann die Unterdeckungs-Prüfung
          // nicht wissen, welcher Satz für dieses Paket gilt — und würde bei
          // jedem Brief einen Fehlalarm auslösen (`20260823140000`).
          .select('id, cart_id, title, image_url, shipping_tier, current_bid_cents')
          .in('cart_id', cartIds)
          .eq('status', 'sold');
        for (const row of (won ?? []) as {
          id: string;
          cart_id: string;
          title: string;
          image_url: string | null;
          shipping_tier: number | null;
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
          // Die Stufe eines PAKETS ist die höchste seiner Artikel — alles geht
          // in dieselbe Sendung. `?? 4` innen: Ein Artikel ohne Angabe muss die
          // teuerste Stufe erzwingen, sonst verbilligt eine Lücke den Satz.
          tierByCart.set(
            row.cart_id,
            Math.max(tierByCart.get(row.cart_id) ?? 1, row.shipping_tier ?? 4),
          );
        }
      }

      return orders.map((o) => ({
        ...o,
        items: o.cart_id ? byCart.get(o.cart_id) ?? [] : [],
        shippingTier: o.cart_id ? tierByCart.get(o.cart_id) ?? 4 : 4,
      }));
    },
  });
}

/**
 * Wie viele Bestellungen warten aufs Packen — die Zahl für das Abzeichen am
 * Verkaufen-Reiter.
 *
 * Warum das eine eigene, winzige Abfrage ist und nicht aus `useSellerOrders`
 * abgeleitet wird: Das Abzeichen hängt im Reiter-Layout, also an einer Stelle,
 * die IMMER gemountet ist. Die große Liste dort mitzuladen hieße, fünfzig
 * Bestellungen samt Lieferadressen im Speicher zu halten, nur um eine Zahl
 * anzuzeigen. `head: true` überträgt keine einzige Zeile.
 *
 * `status = 'paid'` ist genau der Zustand mit Frist: Das Geld ist da, das Paket
 * nicht. Alles danach (`shipped`, `delivered`) ist erledigt und gehört nicht
 * ins Abzeichen — ein Abzeichen, das nie auf null geht, liest bald niemand mehr.
 */
export function useOpenOrderCount(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'open-order-count', userId],
    enabled: Boolean(userId),
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('product_orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId!)
        .eq('status', 'paid');
      // Ein fehlendes Abzeichen ist ärgerlich, ein kaputter Reiter wäre
      // schlimmer — dieselbe Regel wie beim Glocken-Zähler.
      if (error) {
        if (__DEV__) console.warn('[Berkat] Offene Bestellungen zählen:', error.message);
        return 0;
      }
      return count ?? 0;
    },
  });
}

export function orderErrorText(message: string): string {
  if (message.includes('order_not_paid'))
    return 'Diese Bestellung ist noch nicht bezahlt.';
  if (message.includes('forbidden')) return 'Das ist nicht deine Bestellung.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Versand-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return 'Hat nicht geklappt. Versuch es noch einmal.';
}

export function useMarkShipped(userId: string | null) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (input: {
      orderId: string;
      carrier: string;
      tracking: string;
    }): Promise<void> => {
      const { error } = await supabase.rpc('mark_order_shipped', {
        p_order_id: input.orderId,
        p_carrier: input.carrier,
        p_tracking: input.tracking,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'seller-orders', userId] });
      // Und der Zähler für das Abzeichen an der unteren Leiste.
      //
      // Ohne diese Zeile blieb es nach dem Versenden auf der alten Zahl stehen,
      // bis sein eigener Minuten-Takt lief oder der Reiter den Fokus wechselte
      // — genau die Sorte stiller Nicht-Aktualisierung, die am 16.08. schon
      // beim zurückgezogenen Dauerangebot zugeschlagen hat. Wer etwas an zwei
      // Orten anzeigt, muss an beiden zurücksetzen.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'open-order-count', userId] });
    },
  });

  return useCallback(
    (orderId: string, carrier: string, tracking: string) =>
      mutation.mutateAsync({ orderId, carrier, tracking }),
    [mutation],
  );
}

/** Sendungsverfolgung — dieselbe Zuordnung wie in Serlo. */
export function trackingUrl(carrier: string | null, number: string | null): string | null {
  if (!carrier || !number) return null;
  const c = carrier.toLowerCase();
  const n = encodeURIComponent(number.trim());
  if (c.includes('dhl') && c.includes('express')) {
    return `https://www.dhl.com/de-de/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`;
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`;
  }
  if (c.includes('hermes')) return `https://www.myhermes.de/empfangen/sendungsverfolgung/?sendungsnummer=${n}`;
  if (c.includes('dpd')) return `https://tracking.dpd.de/status/de_DE/parcel/${n}`;
  if (c.includes('gls')) return `https://gls-group.com/DE/de/paketverfolgung?match=${n}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  return null;
}

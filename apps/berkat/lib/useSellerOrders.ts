// Bestellungen aus Verkäufersicht.
//
// Lesen geht direkt über die Tabelle: die vorhandene Policy auf product_orders
// lässt Käufer UND Verkäufer ihre eigenen Zeilen sehen. Schreiben nicht —
// der Geldpfad ist service_role-only, deshalb läuft „versendet" über eine eng
// geschnittene RPC.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SellerOrder = {
  id: string;
  buyer_id: string;
  title: string | null;
  amount_eur: string;
  status: string;
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
    queryFn: async (): Promise<SellerOrder[]> => {
      const { data, error } = await supabase
        .from('product_orders')
        .select(
          'id, buyer_id, title, amount_eur, status, ship_name, ship_street, ship_zip, ship_city, ship_country, tracking_carrier, tracking_number, paid_at, created_at',
        )
        .eq('seller_id', userId!)
        .in('status', ['paid', 'shipped', 'delivered'])
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as SellerOrder[];
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

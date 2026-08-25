// „Deine Zuschläge" — wer hat bei mir was gewonnen.
//
// ── ⚠️ WARUM ES DIESE LISTE BIS ZUM 25.08.2026 NICHT GAB ────────────────────
//
// Alles nach der Auktion hängt bei Berkat an `product_orders`: Bestellliste,
// Versand, Bewertung, Streitfall. Eine Bestellung entsteht aber nur, wenn der
// Verkäufer die **Kassen-Freigabe** hat (`checkout_enabled`) — und die bleibt
// für fremde Verkäufer auf `false`, weil das Weiterleiten fremden Geldes ohne
// Stripe Connect nach ZAG erlaubnispflichtig ist.
//
// Für genau diese Verkäufer — also für alle ausser dem Betreiber — heisst das:
// Nach dem Zuschlag steht **nichts**. Kein Korb, keine Bestellung, keine Liste.
// Der Abend ist vorbei, jemand hat gewonnen, und der Verkäufer hat keinen Ort,
// an dem steht, wer.
//
// > Das ist keine fehlende Bequemlichkeit. Bei Direktzahlung ist diese Liste
// > der **einzige** Weg, überhaupt zu wissen, wen man anschreiben muss.
//
// Sie ist zugleich der Ort für „hat nicht bezahlt" (`useUnpaidStrikes.ts`) —
// ein Melde-Knopf ohne eine Liste, in der er sitzt, wäre keiner.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useProfiles } from './useAuction';

export type SellerWin = {
  auctionId: string;
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  buyerId: string;
  settledAt: string | null;
  /** `true`, wenn zu diesem Zuschlag eine BEZAHLTE Bestellung existiert. */
  paid: boolean;
  /** Vom Verkäufer als „nicht bezahlt" gemeldet. */
  reported: boolean;
};

/**
 * Die Zuschläge dieses Verkäufers, neueste zuerst.
 *
 * ⚠️ Drei Abfragen, nicht eine mit Embeds. `live_auctions` hat keinen
 * Fremdschlüssel auf `product_orders` (die Verbindung läuft über `cart_id`),
 * und ein Embed über eine Spalte ohne FK liefert **still eine leere Menge**
 * statt eines Fehlers — die Falle aus der Serlo-Notiz. Drei ehrliche Abfragen
 * sind billiger als ein Embed, das schweigend nichts sagt.
 */
export function useSellerWins(sellerId: string | null, limit = 50) {
  const wins = useQuery({
    queryKey: ['berkat', 'seller-wins', sellerId, limit],
    enabled: Boolean(sellerId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, current_bid_cents, winner_id, cart_id, settled_at')
        .eq('seller_id', sellerId!)
        .eq('status', 'sold')
        .not('winner_id', 'is', null)
        .order('settled_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string;
        image_url: string | null;
        current_bid_cents: number | null;
        winner_id: string;
        cart_id: string | null;
        settled_at: string | null;
      }[];
    },
  });

  const cartIds = useMemo(
    () => [...new Set((wins.data ?? []).map((w) => w.cart_id).filter(Boolean) as string[])],
    [wins.data],
  );

  // Welche Körbe sind bezahlt? Nur für die, die überhaupt einen haben — bei
  // Direktzahlung ist `cart_id` NULL und die Frage stellt sich nicht.
  const paidCarts = useQuery({
    queryKey: ['berkat', 'seller-wins-paid', cartIds.join(',')],
    enabled: cartIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('product_orders')
        .select('cart_id')
        .in('cart_id', cartIds)
        .eq('payment_status', 'paid');
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { cart_id: string }).cart_id));
    },
  });

  // Die eigenen Meldungen. Die RLS gibt nur her, was einen selbst angeht —
  // ein Filter auf `seller_id` wäre eine zweite Wahrheit darüber.
  const reports = useQuery({
    queryKey: ['berkat', 'unpaid-reports', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 15_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('berkat_unpaid_strikes')
        .select('auction_id');
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { auction_id: string }).auction_id));
    },
  });

  const rows = useMemo((): SellerWin[] => {
    return (wins.data ?? []).map((w) => ({
      auctionId: w.id,
      title: w.title,
      imageUrl: w.image_url,
      priceCents: w.current_bid_cents,
      buyerId: w.winner_id,
      settledAt: w.settled_at,
      paid: Boolean(w.cart_id && paidCarts.data?.has(w.cart_id)),
      reported: Boolean(reports.data?.has(w.id)),
    }));
  }, [wins.data, paidCarts.data, reports.data]);

  const buyers = useProfiles(rows.map((r) => r.buyerId));

  return {
    rows,
    buyers,
    isLoading: wins.isLoading,
    refetch: wins.refetch,
  };
}

/**
 * Darf dieser Zuschlag gemeldet werden?
 *
 * ⚠️ Die 48 Stunden stehen HIER **und** in `report_unpaid_buyer`. Das ist keine
 * Dublette aus Versehen: Der Server entscheidet, der Client zeigt nur an
 * (Übergabe 4). Ohne die Fassung hier stünde ein Knopf da, der garantiert mit
 * `too_early` scheitert — dieselbe Sackgasse wie der goldene Kaufknopf ohne
 * Kassen-Freigabe. Wer eine der beiden Zahlen ändert, ändert beide.
 */
export const REPORT_AFTER_HOURS = 48;

export function canReport(win: SellerWin, now = Date.now()): boolean {
  if (win.paid || win.reported) return false;
  if (!win.settledAt) return false;
  return new Date(win.settledAt).getTime() <= now - REPORT_AFTER_HOURS * 3_600_000;
}

/** „noch 31 Std" — bis wann der Melde-Knopf grau bleibt. */
export function reportableIn(win: SellerWin, now = Date.now()): string | null {
  if (!win.settledAt || win.paid || win.reported) return null;
  const ms = new Date(win.settledAt).getTime() + REPORT_AFTER_HOURS * 3_600_000 - now;
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 3_600_000);
  return hours >= 24 ? `noch ${Math.ceil(hours / 24)} Tage` : `noch ${hours} Std`;
}

// Die drei Zahlen, an denen ein Fremder entscheidet, ob er diesem Verkäufer
// Geld schickt: Bewertung, Versandtempo, Menge.
//
// Alle drei werden aus dem gerechnet, was ohnehin entsteht — es gibt keine
// gepflegte Kennzahl-Tabelle und keinen Cron. Das ist Absicht: Eine Zahl, die
// jemand von Hand setzen kann, ist als Vertrauenssignal wertlos.
//
// Jede Kachel hat einen ehrlichen Leerzustand. „5,0" ohne eine einzige
// Bewertung anzuzeigen wäre die schlimmste Variante — sie behauptet Vertrauen,
// das niemand vergeben hat.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SellerStats = {
  /** Durchschnitt 1–5, null wenn noch niemand bewertet hat */
  rating: number | null;
  ratingCount: number;
  /** Mittlere Zeit von „bezahlt" bis „versendet" in Stunden, null ohne Versand */
  shipHours: number | null;
  shipSamples: number;
  /** Erteilte Zuschläge */
  sold: number;
};

const EMPTY: SellerStats = {
  rating: null,
  ratingCount: 0,
  shipHours: null,
  shipSamples: 0,
  sold: 0,
};

/** „<1d" ist die Sprache aus dem Vorbild — Stunden nur, wenn es schneller war. */
export function formatShipTime(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 2) return '<1d';
  return `${Math.round(days)}d`;
}

export function formatRating(rating: number | null): string {
  return rating == null ? '—' : rating.toFixed(1).replace('.', ',');
}

export function useSellerStats(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-stats', sellerId],
    enabled: Boolean(sellerId),
    // Vertrauenszahlen ändern sich in Stunden, nicht in Sekunden.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SellerStats> => {
      const [reviewsRes, ordersRes, soldRes] = await Promise.all([
        // Über die RPC, nicht über die Tabelle: `order_reviews_party_read`
        // erlaubt das Lesen nur dem Bewerter und dem Bewerteten. Ein Zuschauer
        // im Live-Raum ist keins von beidem und bekäme null Zeilen — die Kachel
        // stünde dauerhaft auf „—". `get_seller_rating` gibt ausschließlich
        // Schnitt und Anzahl heraus, die einzelnen Bewertungen bleiben privat
        // (Migration 20260814310000).
        supabase.rpc('get_seller_rating', { p_seller_id: sellerId! }),
        // Versandtempo nur aus Berkat-Bestellungen: `cart_id IS NOT NULL` ist
        // dieselbe Weiche wie in create-checkout-session. Serlos Shop-Versand
        // hat andere Wege und würde die Zahl verfälschen.
        supabase
          .from('product_orders')
          .select('paid_at, shipped_at')
          .eq('seller_id', sellerId!)
          .not('cart_id', 'is', null)
          .not('shipped_at', 'is', null)
          .not('paid_at', 'is', null)
          .order('shipped_at', { ascending: false })
          // Die letzten 20 statt aller: Wer vor einem Jahr langsam war und
          // heute schnell ist, soll heute gemessen werden.
          .limit(20),
        supabase
          .from('live_auctions')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', sellerId!)
          .eq('status', 'sold'),
      ]);

      // Eine kaputte Teilabfrage darf nicht das ganze Sheet leeren — jede Zahl
      // fällt für sich auf ihren Leerzustand zurück.
      //
      // Die RPC liefert genau eine Zeile; ohne Bewertungen steht dort
      // `rating: null` und `review_count: 0` (avg über die leere Menge).
      const ratingRow = (reviewsRes.data ?? [])[0] as
        | { rating: number | string | null; review_count: number }
        | undefined;
      const ratingValue =
        ratingRow?.rating == null ? null : Number(ratingRow.rating);
      const ratingCount = ratingRow?.review_count ?? 0;

      const orders = (ordersRes.data ?? []) as { paid_at: string; shipped_at: string }[];
      const spans = orders
        .map((o) => new Date(o.shipped_at).getTime() - new Date(o.paid_at).getTime())
        // Negative Spannen wären Datenmüll (versendet vor bezahlt) — raus,
        // statt den Schnitt zu verzerren.
        .filter((ms) => ms >= 0);

      return {
        // `numeric` kommt als String über PostgREST — Number() ist Pflicht,
        // sonst rechnet toFixed() auf einem Text.
        rating: Number.isFinite(ratingValue as number) ? (ratingValue as number) : null,
        ratingCount,
        shipHours: spans.length
          ? spans.reduce((a, b) => a + b, 0) / spans.length / 3_600_000
          : null,
        shipSamples: spans.length,
        sold: soldRes.count ?? 0,
      };
    },
  });
}

export const EMPTY_SELLER_STATS = EMPTY;

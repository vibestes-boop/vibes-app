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
        // ⚠️ AUCH ÜBER EINE RPC — und bis zum 23.08.2026 war es das NICHT.
        //
        // Hier stand eine Abfrage auf `product_orders` mit
        // `.eq('seller_id', sellerId)`. `product_orders_party_read` lautet aber
        // `auth.uid() = buyer_id OR auth.uid() = seller_id` — ein Besucher, der
        // ein fremdes Profil ansieht, ist keins von beidem und bekam **null
        // Zeilen bei HTTP 200**. Die Versandzeit stand damit bei JEDEM Fremden
        // auf „—"; nur der Verkäufer selbst sah seine eigene Zahl, also genau
        // die Person, die sie nicht braucht.
        //
        // Das Bittere: Der Kommentar drei Zeilen weiter oben beschreibt exakt
        // dieselbe Falle für die Nachbar-Kachel. Zwei Kacheln, eine Falle, eine
        // erkannt. **Wer eine Falle für eine Abfrage dokumentiert, prüft die
        // Abfragen daneben im selben Zug.**
        //
        // Die Auswahl steckt jetzt in `get_seller_ship_stats`
        // (`20260823170000`) und ist dort zeichengenau dieselbe: nur
        // Berkat-Bestellungen (`cart_id IS NOT NULL`, dieselbe Weiche wie in
        // create-checkout-session), nur bezahlt und versendet, negative Spannen
        // raus, die letzten 20.
        supabase.rpc('get_seller_ship_stats', { p_seller_id: sellerId! }),
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

      // Die RPC liefert genau eine Zeile; ohne Sendungen steht dort
      // `avg_hours: null` und `ship_count: 0` (AVG über die leere Menge).
      const shipRow = (ordersRes.data ?? [])[0] as
        | { avg_hours: number | string | null; ship_count: number }
        | undefined;
      // `numeric` kommt als String über PostgREST — dieselbe Pflicht wie bei
      // der Bewertung darüber.
      const shipHoursRaw =
        shipRow?.avg_hours == null ? null : Number(shipRow.avg_hours);

      return {
        // `numeric` kommt als String über PostgREST — Number() ist Pflicht,
        // sonst rechnet toFixed() auf einem Text.
        rating: Number.isFinite(ratingValue as number) ? (ratingValue as number) : null,
        ratingCount,
        shipHours: Number.isFinite(shipHoursRaw as number) ? (shipHoursRaw as number) : null,
        shipSamples: shipRow?.ship_count ?? 0,
        sold: soldRes.count ?? 0,
      };
    },
  });
}

export const EMPTY_SELLER_STATS = EMPTY;

/**
 * Wie viele Menschen haben mein Angebot angesehen?
 *
 * ⚠️ NUR FÜR DEN VERKÄUFER — und das ist eine Entscheidung, keine Lücke.
 *
 * Kleinanzeigen zeigt „103 Aufrufe" jedem Besucher; bei 32 Millionen Nutzern
 * ist das ein Vertrauenssignal. Bei Berkats heutigem Verkehr wäre dieselbe
 * Zeile eine Warnung an den Käufer („das hat sich noch niemand angesehen").
 * Dieselbe Zahl, umgekehrte Wirkung — der Unterschied ist das Volumen.
 *
 * Für den Verkäufer bleibt sie wertvoll: Sie beantwortet „lohnt sich das
 * Einstellen?", und eine Null sagt „Foto oder Preis stimmt nicht" statt
 * „niemand will es".
 *
 * Gezählt wird, WER angesehen hat, nicht WIE OFT (Primärschlüssel je Paar in
 * `20260921100000`). Eigene Aufrufe zählen nicht. Anonyme auch nicht — die
 * Zahl ist eine Untergrenze.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useMyListingViews(ids: string[], enabled = true) {
  const key = ids.join(',');
  return useQuery({
    queryKey: ['berkat', 'listing-views', key],
    enabled: enabled && ids.length > 0,
    // Wie bei den Merkungen: ein Stimmungsbild, keine Auskunft mit Frist.
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('get_my_listing_views', { p_ids: ids });
      // Fällt sie aus, fehlt eine Zahl — die Liste bleibt vollständig.
      if (error) return new Map();
      const map = new Map<string, number>();
      for (const row of (data ?? []) as { listing_id: string; views: number }[]) {
        map.set(row.listing_id, row.views);
      }
      return map;
    },
  });
}

/**
 * Einen Aufruf festhalten. Ohne Rückgabe und ohne Fehlerbehandlung im Aufrufer:
 * Eine Zählung, die nicht klappt, darf die Artikelseite nicht stören.
 *
 * ⚠️ `void` allein genügt bei Supabase NICHT — der Builder ist faul und die
 * Anfrage ginge nie raus (Merkzettel `supabase-lazy-builder-void`). Deshalb das
 * ausdrückliche `.then()`.
 */
export function markListingSeen(auctionId: string | null | undefined): void {
  if (!auctionId) return;
  void supabase.rpc('mark_listing_seen', { p_auction_id: auctionId }).then(
    () => undefined,
    () => undefined,
  );
}

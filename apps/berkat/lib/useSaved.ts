// Die Merkliste — was jemand sich zurückgelegt hat.
//
// Kleinanzeigen nennt es Merkliste, Whatnot Bookmarks. Der Wert ist derselbe:
// Wer stöbert, entscheidet selten sofort — ohne Merkliste ist jeder „später
// nochmal ansehen"-Gedanke ein verlorener Kauf, weil der Weg zurück über
// Kategorien und Erinnerung führt.
//
// `berkat_saved_listings` (20260817140000) ist nur für den Besitzer lesbar —
// wer was gemerkt hat, ist eine private Auskunft. Die Artikel selbst kommen
// über `live_auctions`, deren RLS die Frauen-Only-Grenze ohnehin zieht: Eine
// gemerkte ID, deren Artikel unsichtbar wurde, fällt still aus der Liste.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchListingsByIds, type Listing } from './useListings';

/**
 * Die gemerkten IDs als Set — für die Herzen auf den Karten.
 *
 * Bewusst eine eigene, winzige Abfrage neben der vollen Liste: Die Karten
 * brauchen nur „ist es drin?", und das an jeder Stöber-Fläche. Ein Set macht
 * daraus einen O(1)-Blick statt eines `includes` über sechzig Zeilen je Karte.
 */
export function useSavedIds(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'saved-ids', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('berkat_saved_listings')
        .select('auction_id');
      if (error) throw error;
      return new Set(((data ?? []) as { auction_id: string }[]).map((r) => r.auction_id));
    },
  });
}

/** Ein Eintrag der Merkliste — der Artikel plus wann er gemerkt wurde. */
export type SavedListing = Listing & { saved_at: string };

/**
 * Die volle Merkliste, neueste zuerst.
 *
 * Zwei Abfragen in einer: erst die eigenen Zeilen (RLS: nur die eigenen),
 * dann die Artikel dazu. Bewusst OHNE Status-Filter — ein gemerkter Artikel,
 * der inzwischen weg ist, ist genau die Auskunft, für die man eine Merkliste
 * hat. Die Liste zeigt ihn mit „Schon weg" statt ihn stumm zu verschlucken.
 */
export function useSavedListings(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'saved-listings', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<SavedListing[]> => {
      const { data, error } = await supabase
        .from('berkat_saved_listings')
        .select('auction_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as { auction_id: string; created_at: string }[];
      const listings = await fetchListingsByIds(rows.map((r) => r.auction_id));
      const byId = new Map(listings.map((l) => [l.id, l]));
      // Reihenfolge der Merkliste, nicht der Artikel — und IDs, deren Artikel
      // die RLS verschweigt (Frauen-Only ohne Zugang), fallen hier still raus.
      return rows
        .map((r) => {
          const listing = byId.get(r.auction_id);
          return listing ? { ...listing, saved_at: r.created_at } : null;
        })
        .filter((x): x is SavedListing => x !== null);
    },
  });
}

/**
 * Merken / Entmerken.
 *
 * `saved` kommt vom Aufrufer mit — der weiß es aus `useSavedIds`, und ein
 * zweiter Lookup hier wäre eine Abfrage für eine Information, die schon auf
 * dem Bildschirm steht. Kein Optimismus-Update: Bei einer Merkliste ist eine
 * Zehntelsekunde Latenz egal, ein falsch gefülltes Herz nicht.
 */
export function useToggleSaved(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { auctionId: string; saved: boolean }) => {
      if (!userId) throw new Error('not_authenticated');
      if (input.saved) {
        const { error } = await supabase
          .from('berkat_saved_listings')
          .delete()
          .eq('user_id', userId)
          .eq('auction_id', input.auctionId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('berkat_saved_listings')
          // Upsert statt Insert: Zwei schnelle Tipps hintereinander sind sonst
          // ein Primärschlüssel-Konflikt statt eines No-Ops.
          .upsert(
            { user_id: userId, auction_id: input.auctionId },
            { onConflict: 'user_id,auction_id', ignoreDuplicates: true },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'saved-ids'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'saved-listings'] });
    },
  });
}

/**
 * Wie oft ein Artikel gemerkt wurde — als Zahl, nie als Namen.
 *
 * ⚠️ Zwingend über die RPC `get_saved_counts` (`20260822120000`). Die Policy
 * auf `berkat_saved_listings` lässt ausschließlich die EIGENEN Zeilen durch;
 * eine gewöhnliche Zählabfrage träfe also immer nur die eigene Merkung — ohne
 * Fehler, einfach falsch. Dieselbe Falle wie bei `order_reviews` (Übergabe,
 * Abschnitt 3): richtige Abfrage, fehlendes Recht, leere Menge statt Meldung.
 *
 * Die Policy bleibt, wie sie ist. Wer was gemerkt hat, ist eine private
 * Auskunft — nur die Summe ist öffentlich.
 */
export function useSavedCounts(ids: string[]) {
  const key = ids.join(',');
  return useQuery({
    queryKey: ['berkat', 'saved-counts', key],
    enabled: ids.length > 0,
    // Kein Realtime und kein kurzer Takt: Die Zahl ist ein Stimmungsbild,
    // keine Auskunft mit Frist. Sie darf eine Minute alt sein.
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('get_saved_counts', { p_ids: ids });
      // Fällt sie aus, fehlt ein Abzeichen — die Karten bleiben vollständig.
      if (error) return new Map();
      const map = new Map<string, number>();
      for (const row of (data ?? []) as { listing_id: string; saves: number }[]) {
        map.set(row.listing_id, row.saves);
      }
      return map;
    },
  });
}

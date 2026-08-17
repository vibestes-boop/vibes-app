// Alles, was gerade kaufbar ist — über alle Verkäufer und alle Kategorien.
//
// WARUM ES DAS BRAUCHT
// Bis hierher war jedes Dauerangebot nur über zwei Wege erreichbar: das Profil
// des Verkäufers (wenn man ihn schon kennt) oder eine Kategorie (wenn er eine
// gesetzt hat — sie ist freiwillig). Ein Angebot ohne Kategorie von einem
// Verkäufer, den niemand kennt, lag damit für die Allgemeinheit unauffindbar
// herum. Das ist der Zustand, in dem eine Marktplatz-App keiner ist.
//
// ⚠️ BEWUSST OHNE FILTER, OHNE SUCHE, OHNE UMKREIS
// In der Datenbank liegen heute genau zwei Angebote. Filter und Suchindizes für
// zwei Artikel zu bauen ist Arbeit am falschen Ende — und beides lässt sich
// später ohne Datenwanderung nachrüsten, weil Zustand, PLZ und Ort schon an der
// Zeile stehen. Was zuerst gebraucht wird, ist die Liste selbst.
//
// Die Abfrage ist absichtlich dieselbe wie in `useCategories`, nur ohne den
// Kategorie-Filter. Wer hier eine Spalte ergänzt, muss sie dort mit ergänzen —
// sonst zeigt eine der beiden Flächen die Anbieterkennzeichnung nicht, und die
// ist nach Art. 246d § 1 EGBGB an JEDEM Angebot Pflicht.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CategoryListing } from './useCategories';

const COLUMNS =
  'id, seller_id, title, image_url, buy_now_cents, women_only, created_at, ' +
  'condition, postal_code, city, seller_kind';

/**
 * Was gerade im Regal liegt — neueste zuerst.
 *
 * Kein Realtime-Abo: Eine Übersichtsseite mit vielen Zeilen darf keine
 * dauerhafte Verbindung je Zeile aufmachen (Kostenhygiene, Übergabe
 * Abschnitt 4). Nachgeladen wird beim Fokus, wie überall sonst — die
 * Reiter-Falle aus Abschnitt 3 gilt hier genauso.
 */
export function useShopListings(limit = 60) {
  return useQuery({
    queryKey: ['berkat', 'shop', limit],
    staleTime: 30_000,
    queryFn: async (): Promise<CategoryListing[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(COLUMNS)
        // Die Regal-Grenze. Ohne den Filter kämen Show-Artikel mit, sobald sie
        // denselben Status hätten.
        .is('session_id', null)
        .eq('status', 'listed')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as CategoryListing[];
    },
  });
}

// Die Bewertungstexte eines Verkäufers — öffentlich lesbar.
//
// Nicht über `order_reviews` direkt: Die einzige Lese-Policy dort lässt nur
// Bewerter und Bewerteten durch, ein Dritter bekommt **null Zeilen ohne
// Fehler** (HANDOFF 3). Wer die Tabelle direkt abfragt, sieht „keine
// Bewertungen" und sucht den Fehler im Client.
//
// `get_seller_reviews` (Migration 20260816160000) gibt gezielt heraus, was ein
// Schaufenster braucht, und hält zwei Schranken:
//   • nur Berkat-Bestellungen — Serlos Bewertungstexte werden durch eine
//     Berkat-Änderung nicht neu öffentlich
//   • Frauen-Only nur für Verifizierte, den Verkäufer und die Verfasserin
//
// Die Zahl in der Sterne-Kachel kommt weiterhin aus `get_seller_rating` und
// zählt ALLE Bewertungen. Die Liste hier ist deshalb immer kürzer als die
// Zahl — auch weil ein Text optional ist. Das ist kein Fehler, sondern der
// Unterschied zwischen „hat bewertet" und „hat etwas geschrieben".

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SellerReview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
};

export function useSellerReviews(sellerId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['berkat', 'seller-reviews', sellerId, limit],
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<SellerReview[]> => {
      const { data, error } = await supabase.rpc('get_seller_reviews', {
        p_seller_id: sellerId!,
        p_limit: limit,
      });
      if (error) {
        if (__DEV__) console.warn('[Berkat] Bewertungen laden:', error.message);
        throw error;
      }
      return (data ?? []) as SellerReview[];
    },
  });
}

/** „vor 3 Tagen", sonst das Datum — dieselbe Sprache wie in den Meldungen. */
export function reviewWhen(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 30) return `vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

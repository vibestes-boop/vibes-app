// Verkäufer suchen — auch wenn niemand sendet.
//
// Das Suchfeld auf der Startseite hieß „Show oder Verkäufer suchen", filterte
// aber nur die bereits geladenen Live-Shows im Speicher. Ist niemand live —
// rund 94 % der Zeit —, fand es grundsätzlich nichts.
//
// Seit den Dauerangeboten ist das mehr als kosmetisch: Der Laden eines
// Verkäufers liegt auf seinem Profil, und dorthin kam man nur über eine
// laufende Show oder eine bestehende Unterhaltung. Wer den Namen kannte, aber
// niemanden kannte, kam nirgendwo hin.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type FoundSeller = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  /** Wie viele Artikel gerade dauerhaft kaufbar sind. */
  listings: number;
  /** Wie viele Zuschläge dieser Verkäufer schon erteilt hat. */
  sold: number;
};

/** Ab hier lohnt sich die Abfrage — darunter ist das Ergebnis ohnehin unbrauchbar. */
export const SEARCH_MIN = 2;

/**
 * Entprellt die Eingabe.
 *
 * Ohne das liefe bei „berkattest" eine Abfrage je Tastendruck — zehn Aufrufe
 * für ein Ergebnis. 300 ms sind kurz genug, dass es sich sofort anfühlt, und
 * lang genug, dass ein Wort als ein Aufruf ankommt.
 */
export function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function useSellerSearch(query: string) {
  const debounced = useDebounced(query.trim());

  return useQuery({
    queryKey: ['berkat', 'seller-search', debounced],
    enabled: debounced.length >= SEARCH_MIN,
    // Namen ändern sich selten; wer zweimal dasselbe tippt, soll nicht warten.
    staleTime: 60_000,
    queryFn: async (): Promise<FoundSeller[]> => {
      const { data, error } = await supabase.rpc('search_berkat_sellers', {
        p_query: debounced,
      });
      if (error) throw error;
      return (data ?? []) as FoundSeller[];
    },
  });
}

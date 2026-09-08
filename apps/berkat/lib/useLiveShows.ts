import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type LiveShow = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  thumbnail_url: string | null;
  category: string | null;
  women_only: boolean;
};

// Home und Suche teilen Cache und Polling; nur die sichtbare Ansicht aktiviert es.
export function useLiveShows(enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'shows'],
    enabled,
    retry: 1,
    refetchInterval: 20_000,
    queryFn: async ({ signal }): Promise<LiveShow[]> => {
      // Frauen-Only-Shows filtert die RLS auf live_sessions selbst heraus —
      // hier ist bewusst kein zusätzlicher Filter, sonst gäbe es zwei
      // Wahrheiten über dieselbe Grenze.
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, host_id, title, viewer_count, thumbnail_url, category, women_only')
        .eq('status', 'active')
        // `live_sessions` teilt sich Berkat mit Serlo. Ohne diesen Filter
        // standen hier auch ganz normale Serlo-Lives — ohne Artikel, ohne
        // Gebote, in einer reinen Auktions-App.
        .eq('app', 'berkat')
        .order('viewer_count', { ascending: false })
        .limit(60)
        .abortSignal(signal).retry(false);
      if (error) throw error;
      return (data ?? []) as LiveShow[];
    },
  });
}

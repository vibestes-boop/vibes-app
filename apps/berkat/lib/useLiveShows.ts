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

export const LIVE_SHOW_COLUMNS = 'id, host_id, title, viewer_count, thumbnail_url, category, women_only';
export function liveShowsQuery(columns = LIVE_SHOW_COLUMNS) {
  return supabase.from('live_sessions').select(columns).eq('status', 'active').eq('app', 'berkat');
}

// Allgemeine Suche; Home nutzt eigene Quellen unter demselben Invalidierungspräfix.
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
      const { data, error } = await liveShowsQuery()
        .order('viewer_count', { ascending: false })
        .limit(60)
        .abortSignal(signal).retry(false);
      if (error) throw error;
      return (data ?? []) as unknown as LiveShow[];
    },
  });
}

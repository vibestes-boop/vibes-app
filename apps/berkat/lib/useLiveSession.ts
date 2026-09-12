import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type LiveSession = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  like_count: number | null;
  thumbnail_url: string | null;
  women_only: boolean;
  status: string;
  room_name: string | null;
};

export function useLiveSession(sessionId: string | undefined, userId: string | null, enabled = true) {
  return useQuery({
    // Keep the session-id prefix used by studio invalidation; scope restricted reads to the account.
    queryKey: ['berkat', 'session', sessionId, userId],
    enabled: enabled && Boolean(sessionId),
    refetchInterval: enabled ? 15_000 : false,
    retry: 1,
    queryFn: async ({ signal }): Promise<LiveSession | null> => {
      const { data, error } = await supabase.from('live_sessions')
        .select('id, host_id, title, viewer_count, like_count, thumbnail_url, women_only, status, room_name')
        .eq('id', sessionId!).abortSignal(signal).retry(false).maybeSingle();
      if (error) throw error;
      return (data as LiveSession | null) ?? null;
    },
  });
}

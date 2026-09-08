import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type FollowedProfile = {
  id: string;
  following_id: string;
  profile: { id: string; username: string | null; avatar_url: string | null } | null;
};

const PAGE_SIZE = 30;

/** Gemeinsame Folgebeziehungen beider Apps, deshalb bewusst „Profile“.
 * Der FK-Join lädt nur öffentliche Profilfelder, ohne Einzelabruf pro Person.
 * Eine zusätzliche Zeile erkennt die nächste Seite ohne separate Zählabfrage.
 */
export function useFollowing(userId: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['berkat', 'following', userId],
    enabled: enabled && Boolean(userId),
    initialPageParam: 0,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (failures, error) => failures < 1 && (error as { code?: string }).code !== '42501',
    queryFn: async ({ signal, pageParam }): Promise<{ rows: FollowedProfile[]; next: number | undefined }> => {
      if (!userId) throw new Error('not_authenticated');
      const { data, error } = await supabase.from('follows')
        .select('id, following_id, profile:profiles!follows_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE)
        .abortSignal(signal).retry(false);
      if (error) throw error;
      const rows = (data ?? []) as unknown as FollowedProfile[];
      return { rows: rows.slice(0, PAGE_SIZE), next: rows.length > PAGE_SIZE ? pageParam + PAGE_SIZE : undefined };
    },
    getNextPageParam: (lastPage) => lastPage.next,
  });
}

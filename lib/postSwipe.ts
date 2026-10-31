import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { PostPeek } from './swipeDecisions';

export { peekFullUri, peekImageUri, postSwipeTarget, type PostPeek } from './swipeDecisions';

/**
 * Vorschau des vorigen und nächsten Beitrags: Sie gleitet beim Wischen mit,
 * und der neue Bildschirm zeigt sie sofort, statt mit einem Ladekreis zu starten.
 */
export function usePostPeeks(ids: (string | null | undefined)[]): Record<string, PostPeek> {
  const wanted = ids.filter((x): x is string => !!x);
  const key = wanted.slice().sort().join(',');
  const { data } = useQuery<Record<string, PostPeek>>({
    queryKey: ['post-peek', key],
    enabled: wanted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, thumbnail_url, caption')
        .in('id', wanted);
      if (error) throw error;
      const out: Record<string, PostPeek> = {};
      for (const row of (rows ?? []) as PostPeek[]) out[row.id] = row;
      return out;
    },
  });
  return data ?? {};
}

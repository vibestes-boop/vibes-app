import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from './supabase';

// Reichert Feed-Posts per Post-ID mit der Bunny-Video-guid an — SEPARAT vom
// Feed-RPC (`get_vibe_feed`), damit der 22-Spalten-Algorithmus unangetastet
// bleibt. Gleiches Muster wie useFeedEngagement (Batch-Lookup per ID).
//
// Liefert { postId: guid } nur für Posts, die bereits eine guid haben; für alle
// anderen spielt der Player wie gehabt R2. Status ('pending'/'ready') wird NICHT
// als Gate genutzt — der Player probiert HLS und fällt sonst auf R2 zurück.
export function useFeedBunny(postIds: string[]): Record<string, string> {
  const key = useMemo(() => postIds.slice().sort().join(','), [postIds]);

  const { data } = useQuery<Record<string, string>>({
    queryKey: ['feed-bunny', key],
    enabled: postIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, string> = {};
      const { data, error } = await supabase
        .from('posts')
        .select('id, bunny_video_id')
        .in('id', postIds)
        .not('bunny_video_id', 'is', null);
      if (error) return out;
      for (const row of (data ?? []) as Array<{ id: string; bunny_video_id: string | null }>) {
        if (row.bunny_video_id) out[row.id] = row.bunny_video_id;
      }
      return out;
    },
  });

  return data ?? {};
}

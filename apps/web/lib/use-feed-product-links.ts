'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

// Shoppable Posts (#2): reichert Feed-Posts per Post-ID mit der verknüpften
// product_id an — separat vom Feed-RPC (der product_id nicht zurückgibt) und
// client-seitig, damit auch infinite-scroll-nachgeladene Seiten abgedeckt sind.
// Die Mini-Produktinfo lädt die ProductLinkCard anschließend selbst per ID.
export function useFeedProductLinks(postIds: string[]): Record<string, string> {
  const key = useMemo(() => postIds.slice().sort().join(','), [postIds]);

  const { data } = useQuery<Record<string, string>>({
    queryKey: ['feed-product-links', key],
    enabled: postIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const out: Record<string, string> = {};
      const { data, error } = await supabase
        .from('posts')
        .select('id, product_id')
        .in('id', postIds)
        .not('product_id', 'is', null);
      if (error) return out;
      for (const row of (data ?? []) as Array<{ id: string; product_id: string | null }>) {
        if (row.product_id) out[row.id] = row.product_id;
      }
      return out;
    },
  });

  return data ?? {};
}

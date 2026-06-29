import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from './supabase';

// Shoppable Posts (#2): reichert Feed-Posts per Post-ID mit dem verknüpften
// Shop-Produkt an — SEPARAT vom Feed-RPC (`get_vibe_feed`), damit der
// Scoring-Algorithmus unangetastet bleibt. Gleiches Muster wie useFeedBunny:
// Batch-Lookup per ID über den FK-Embed `products!posts_product_id_fkey`.
//
// Liefert { postId: product } nur für Posts mit aktivem, verknüpftem Produkt;
// alle anderen Posts rendern wie gehabt ohne Karte.

export type LinkedProduct = {
  id: string;
  title: string;
  cover_url: string | null;
  price_coins: number;
  price_eur: number | null;
  sale_price_coins: number | null;
  sale_mode: string | null;
};

export function useFeedProducts(postIds: string[]): Record<string, LinkedProduct> {
  const key = useMemo(() => postIds.slice().sort().join(','), [postIds]);

  const { data } = useQuery<Record<string, LinkedProduct>>({
    queryKey: ['feed-products', key],
    enabled: postIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, LinkedProduct> = {};
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id, product:products!posts_product_id_fkey (id, title, cover_url, price_coins, price_eur, sale_price_coins, sale_mode, is_active)'
        )
        .in('id', postIds)
        .not('product_id', 'is', null);
      if (error) return out;
      for (const row of (data ?? []) as any[]) {
        const p = row.product;
        // Gelöschte/deaktivierte Produkte zeigen wir nicht (tote Karte vermeiden).
        if (p && p.is_active !== false) {
          out[row.id] = {
            id: p.id,
            title: p.title,
            cover_url: p.cover_url ?? null,
            price_coins: p.price_coins,
            price_eur: p.price_eur ?? null,
            sale_price_coins: p.sale_price_coins ?? null,
            sale_mode: p.sale_mode ?? null,
          };
        }
      }
      return out;
    },
  });

  return data ?? {};
}

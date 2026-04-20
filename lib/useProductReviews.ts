/**
 * lib/useProductReviews.ts
 * Shop Bewertungen — lesen, schreiben, eigene Bewertung prüfen
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export interface ProductReview {
  id:          string;
  product_id:  string;
  reviewer_id: string;
  order_id:    string;
  rating:      1 | 2 | 3 | 4 | 5;
  comment:     string | null;
  created_at:  string;
  reviewer: {
    id:         string;
    username:   string | null;
    avatar_url: string | null;
  } | null;
}

// ─── Alle Bewertungen für ein Produkt ────────────────────────────────────────
export function useProductReviews(productId: string | null) {
  return useQuery<ProductReview[]>({
    queryKey: ['product-reviews', productId],
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          id, product_id, reviewer_id, order_id,
          rating, comment, created_at,
          reviewer:reviewer_id ( id, username, avatar_url )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as ProductReview[];
    },
  });
}

// ─── Eigene Bewertung für ein Produkt (null = noch nicht bewertet) ───────────
export function useMyReview(productId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<ProductReview | null>({
    queryKey: ['my-review', productId, userId],
    enabled: !!productId && !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!productId || !userId) return null;
      const { data } = await supabase
        .from('product_reviews')
        .select('id, rating, comment, order_id')
        .eq('product_id', productId)
        .eq('reviewer_id', userId)
        .maybeSingle();
      return data as ProductReview | null;
    },
  });
}

// ─── Bewertung schreiben / aktualisieren ─────────────────────────────────────
export function useSubmitReview() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      productId,
      orderId,
      rating,
      comment,
      existingReviewId,
    }: {
      productId: string;
      orderId: string;
      rating: 1 | 2 | 3 | 4 | 5;
      comment?: string;
      existingReviewId?: string;
    }) => {
      if (!user?.id) throw new Error('Nicht eingeloggt');

      if (existingReviewId) {
        // Update
        const { error } = await supabase
          .from('product_reviews')
          .update({ rating, comment: comment ?? null })
          .eq('id', existingReviewId);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('product_reviews')
          .insert({
            product_id:  productId,
            reviewer_id: user.id,
            order_id:    orderId,
            rating,
            comment:     comment ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { productId }) => {
      qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      qc.invalidateQueries({ queryKey: ['my-review', productId] });
      qc.invalidateQueries({ queryKey: ['shop-products'] });
    },
  });
}

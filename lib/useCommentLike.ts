/**
 * useCommentLike.ts
 *
 * Like / Unlike für einzelne Kommentare.
 * Nutzt dieselbe Optimistic-Update-Strategie wie useLike.ts.
 *
 * useCommentLikesBatch: Batch-Variante für CommentsSheet.
 * Lädt Like-Status für N Kommentare in 2 Queries statt 2×N.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ── Typen ──────────────────────────────────────────────────────────────────
export type CommentLikeState = {
  liked: boolean;
  count: number;
};

// ── Hook ───────────────────────────────────────────────────────────────────
export function useCommentLike(commentId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  // Laden: Anzahl Likes + ob der aktuelle User geliked hat
  const { data } = useQuery({
    queryKey: ['comment-like', commentId, userId],
    queryFn: async (): Promise<CommentLikeState> => {
      const [{ count }, { data: myLike }] = await Promise.all([
        supabase
          .from('comment_likes')
          .select('id', { count: 'exact', head: true })
          .eq('comment_id', commentId),
        userId
          ? supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', commentId)
            .eq('user_id', userId)
            .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, liked: !!myLike };
    },
    staleTime: 30_000,
    enabled: !!commentId,
  });

  const liked = data?.liked ?? false;
  const count = data?.count ?? 0;

  // Toggle: Optimistic Update
  const { mutate: toggle } = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Nicht eingeloggt');
      if (liked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: userId });
      }
    },
    onMutate: () => {
      const key = ['comment-like', commentId, userId];
      const prev = queryClient.getQueryData<CommentLikeState>(key);
      queryClient.setQueryData<CommentLikeState>(key, {
        liked: !liked,
        count: liked ? Math.max(0, count - 1) : count + 1,
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      const key = ['comment-like', commentId, userId];
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
  });

  return { liked, count, toggle };
}

// ── Batch-Hook für CommentsSheet (N Kommentare → 2 Queries) ──────────────────
export type CommentLikesMap = Map<string, CommentLikeState>;

/**
 * Lädt Like-Status für eine Liste von Kommentar-IDs in 2 parallelen Queries:
 *   Query 1: Alle Likes für diese IDs → COUNT per comment_id
 *   Query 2: Die eigenen Likes des Users für diese IDs
 *
 * Vorher: 2 × N DB-Requests bei N Kommentaren
 * Nachher: 2 DB-Requests gesamt
 */
export function useCommentLikesBatch(commentIds: string[]): CommentLikesMap {
  const userId = useAuthStore((s) => s.profile?.id);

  const { data: batchMap = new Map<string, CommentLikeState>() } = useQuery({
    queryKey: ['comment-likes-batch', commentIds.join(','), userId],
    queryFn: async (): Promise<CommentLikesMap> => {
      if (commentIds.length === 0) return new Map();

      // Temp-IDs (optimistische IDs vor DB-Speicherung) herausfiltern → verhindert 400 Bad Request
      const realIds = commentIds.filter(id => !id.startsWith('temp-'));
      if (realIds.length === 0) return new Map();

      // Query 1 + 2 parallel: alle Likes + eigene Likes
      const [{ data: allLikes }, { data: myLikes }] = await Promise.all([
        supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', realIds),
        userId
          ? supabase
            .from('comment_likes')
            .select('comment_id')
            .in('comment_id', realIds)
            .eq('user_id', userId)
          : Promise.resolve({ data: [] as { comment_id: string }[] }),
      ]);

      // Count likes per comment_id
      const countMap = new Map<string, number>();
      for (const row of allLikes ?? []) {
        countMap.set(row.comment_id, (countMap.get(row.comment_id) ?? 0) + 1);
      }

      // Build set of liked comment_ids
      const likedSet = new Set((myLikes ?? []).map((r) => r.comment_id));

      // Build result map
      const result: CommentLikesMap = new Map();
      for (const id of commentIds) {
        result.set(id, {
          count: countMap.get(id) ?? 0,
          liked: likedSet.has(id),
        });
      }
      return result;
    },
    enabled: commentIds.length > 0,
    staleTime: 30_000,
  });

  return batchMap;
}

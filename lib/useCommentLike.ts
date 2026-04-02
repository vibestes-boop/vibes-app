/**
 * useCommentLike.ts
 *
 * Like / Unlike für einzelne Kommentare.
 * Nutzt dieselbe Optimistic-Update-Strategie wie useLike.ts.
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

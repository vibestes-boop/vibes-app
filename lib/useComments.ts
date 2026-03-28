import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export function useCommentCount(postId: string, batchCount?: number) {
  const skip = batchCount !== undefined;
  const q = useQuery({
    queryKey: ['comment-count', postId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!postId && !skip,
    staleTime: 1000 * 60,
  });
  const count = skip ? batchCount! : (q.data ?? 0);
  return { ...q, data: count };
}

export function useComments(postId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Comment[]) ?? [];
    },
    staleTime: 1000 * 30,
    enabled,
  });
}

type AddCommentVars = { text: string; tempId: string };

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useMutation({
    mutationFn: async ({ text }: AddCommentVars) => {
      if (!profile) throw new Error('Nicht eingeloggt');

      const { data: inserted, error: insertError } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: profile.id, text })
        .select('id, post_id, user_id, text, created_at')
        .single();

      if (insertError) throw insertError;

      const newComment: Comment = {
        ...inserted,
        profiles: {
          username: profile.username,
          avatar_url: profile.avatar_url ?? null,
        },
      };
      return newComment;
    },
    onMutate: async ({ text, tempId }: AddCommentVars) => {
      if (!profile) return {};
      const previous = queryClient.getQueryData<Comment[]>(['comments', postId]);
      const optimistic: Comment = {
        id: tempId,
        post_id: postId,
        user_id: profile.id,
        text,
        created_at: new Date().toISOString(),
        profiles: { username: profile.username ?? 'Du', avatar_url: profile.avatar_url ?? null },
      };
      queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
        old ? [...old, optimistic] : [optimistic]
      );
      queryClient.setQueryData<number>(['comment-count', postId], (old) => (old ?? 0) + 1);
      return { previous };
    },
    onSuccess: (newComment, { tempId }) => {
      queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
        old ? old.map((c) => (c.id === tempId ? newComment : c)) : [newComment]
      );
      if (userId) queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });
    },
    onError: (err: any, _vars, context) => {
      const prev = (context as { previous?: Comment[] })?.previous;
      if (prev != null) {
        queryClient.setQueryData(['comments', postId], prev);
        queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
      }
      console.error('[useAddComment] Fehler:', err);
      Alert.alert('Fehler', err?.message ?? 'Kommentar konnte nicht gesendet werden.');
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
      return commentId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
        old ? old.filter((c) => c.id !== deletedId) : []
      );
      queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
      if (userId) queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });
    },
  });
}

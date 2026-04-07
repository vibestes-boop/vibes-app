import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useEffect } from 'react';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';


export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  reply_count?: number;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export function useCommentCount(postId: string, batchCount?: number) {
  const queryClient = useQueryClient();
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
    initialData: skip ? batchCount : undefined,
  });

  // Realtime: Kommentaranzahl live aktualisieren
  // PERF-FIX: Subscription nur öffnen wenn KEIN batchCount vorhanden (skip=true).
  // Im Feed liefert useFeedEngagement Batch-Werte für alle Posts → kein N+1-Channel-Problem.
  // Subscription nur im Post-Detail oder CommentsSheet wo kein Batch-Wert existiert.
  useEffect(() => {
    if (!postId || skip) return;  // ← skip wenn batch-Daten vorhanden: spart bis zu 15 WebSocket-Channels
    const channel = supabase
      .channel(`comment-count:${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        () => {
          queryClient.setQueryData<number>(['comment-count', postId], (old) => (old ?? 0) + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        () => {
          queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, queryClient, skip]);

  const count = q.data ?? (skip ? batchCount! : 0);
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
        .is('parent_id', null)           // Nur Top-Level Kommentare
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Comment[]) ?? [];
    },
    staleTime: 1000 * 60,
    enabled,
  });
}

export function useCommentReplies(commentId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['comment-replies', commentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('parent_id', commentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Comment[]) ?? [];
    },
    staleTime: 1000 * 30,
    enabled: !!commentId && enabled,
  });
}

type AddCommentVars = { text: string; tempId: string; parentId?: string };

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const userId = profile?.id;

  return useMutation({
    mutationFn: async ({ text, parentId }: AddCommentVars) => {
      if (!profile) throw new Error('Nicht eingeloggt');

      const { data: inserted, error: insertError } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: profile.id, text, parent_id: parentId ?? null })
        .select('id, post_id, user_id, text, created_at, parent_id')
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
    onMutate: async ({ text, tempId, parentId }: AddCommentVars) => {
      if (!profile) return {};
      const cacheKey = parentId ? ['comment-replies', parentId] : ['comments', postId];
      const previous = queryClient.getQueryData<Comment[]>(cacheKey);
      const optimistic: Comment = {
        id: tempId,
        post_id: postId,
        user_id: profile.id,
        text,
        parent_id: parentId ?? null,
        created_at: new Date().toISOString(),
        profiles: { username: profile.username ?? 'Du', avatar_url: profile.avatar_url ?? null },
      };
      queryClient.setQueryData<Comment[]>(cacheKey, (old) =>
        old ? [...old, optimistic] : [optimistic]
      );
      if (!parentId) queryClient.setQueryData<number>(['comment-count', postId], (old) => (old ?? 0) + 1);
      return { previous, cacheKey };
    },
    onSuccess: async (newComment, { tempId, text, parentId }) => {
      // ── Optimistic cache update ────────────────────────────────────────
      const cacheKey = parentId ? ['comment-replies', parentId] : ['comments', postId];
      queryClient.setQueryData<Comment[]>(cacheKey, (old) =>
        old ? old.map((c) => (c.id === tempId ? newComment : c)) : [newComment]
      );
      if (userId) queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });

      if (!userId) return;

      // ── Notification an Post-Owner ──────────────────────────────────────
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      const notificationsToInsert: object[] = [];

      if (post?.user_id && post.user_id !== userId) {
        notificationsToInsert.push({
          user_id:      post.user_id,
          sender_id:    userId,
          type:         'comment',
          post_id:      postId,
          comment_id:   newComment.id,
          comment_text: text.slice(0, 200),
        });
      }

      // ── comment_reply Notification an Parent-Autor ──────────────────────
      if (parentId) {
        const { data: parentComment } = await supabase
          .from('comments')
          .select('user_id')
          .eq('id', parentId)
          .single();
        if (parentComment?.user_id && parentComment.user_id !== userId && parentComment.user_id !== post?.user_id) {
          notificationsToInsert.push({
            user_id:      parentComment.user_id,
            sender_id:    userId,
            type:         'comment_reply',
            post_id:      postId,
            comment_id:   newComment.id,
            comment_text: text.slice(0, 200),
          });
        }
      }

      // ── @Mention Notifications ──────────────────────────────────────────
      const mentions = [...text.matchAll(/@([a-zA-Z0-9_.]+)/g)].map((m) => m[1].toLowerCase());
      if (mentions.length > 0) {
        const { data: mentionedUsers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', mentions.slice(0, 5));

        const mentionNotifs = (mentionedUsers ?? [])
          .filter((u) => u.id !== userId && u.id !== post?.user_id) // nicht doppelt benachrichtigen
          .map((u) => ({
            user_id:    u.id,
            sender_id:  userId,
            type:       'mention' as const,
            post_id:    postId,
            comment_id: newComment.id,
          }));

        notificationsToInsert.push(...mentionNotifs);
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }
    },
    onError: (err: any, _vars, context) => {
      const prev = (context as { previous?: Comment[]; cacheKey?: string[] })?.previous;
      const key  = (context as { previous?: Comment[]; cacheKey?: string[] })?.cacheKey;
      if (prev != null && key) {
        queryClient.setQueryData(key, prev);
        queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
      }
      // Vollständiges Error-Objekt loggen (wichtig für RLS-Diagnose)
      __DEV__ && console.error('[useAddComment] Fehler vollständig:', JSON.stringify(err, null, 2));
      const msg = err?.message || err?.details || err?.hint || err?.code || 'Unbekannter Fehler';
      Alert.alert('Fehler', msg);
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId); // B3: Nur eigene Kommentare löschen
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

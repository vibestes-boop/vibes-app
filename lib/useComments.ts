import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';


export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  reply_count?: number;
  // Like-Daten kommen bei Top-Level-Kommentaren direkt aus der RPC
  // (get_post_comments_web) → kein N+1 mehr. Bei Replies undefined → Fallback
  // auf die Einzelquery in useCommentLike.
  like_count?: number;
  liked_by_me?: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
    display_name?: string | null;
    verified?: boolean;
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
  const userId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      // EINE Query statt 1 + 2 + N: get_post_comments_web liefert Text,
      // like_count, liked_by_me UND reply_count pro Top-Level-Kommentar
      // (gleiche RPC, die das Web nutzt). Killt den N+1-Like-Sturm und
      // befüllt reply_count (→ „Antworten anzeigen" nur wenn es welche gibt).
      const { data, error } = await supabase.rpc('get_post_comments_web', {
        p_post_id: postId,
        p_limit: 100,
        p_viewer_id: userId ?? null,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, any>>;
      return rows
        .map((r): Comment => ({
          id: r.id,
          post_id: r.post_id,
          user_id: r.user_id,
          text: r.body ?? '',
          created_at: r.created_at,
          parent_id: r.parent_id ?? null,
          reply_count: Number(r.reply_count ?? 0),
          like_count: Number(r.like_count ?? 0),
          liked_by_me: !!r.liked_by_me,
          profiles: {
            username: r.author_username,
            avatar_url: r.author_avatar_url,
            display_name: r.author_display_name,
            verified: !!r.author_verified,
          },
        }))
        // Neueste zuerst (TikTok-Stil) — RPC liefert bereits DESC, hier explizit
        // garantiert. Neue Kommentare werden beim Senden vorne eingefügt.
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
        reply_count: 0,
        like_count: 0,
        liked_by_me: false,
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
        reply_count: 0,
        like_count: 0,
        liked_by_me: false,
        profiles: { username: profile.username ?? 'Du', avatar_url: profile.avatar_url ?? null },
      };
      queryClient.setQueryData<Comment[]>(cacheKey, (old) => {
        if (!old) return [optimistic];
        // Top-Level: neueste zuerst → vorne einfügen. Replies: chronologisch → hinten.
        return parentId ? [...old, optimistic] : [optimistic, ...old];
      });
      // Eltern-reply_count optimistisch hochzählen → „Antworten anzeigen" erscheint sofort.
      let previousParents: Comment[] | undefined;
      if (parentId) {
        previousParents = queryClient.getQueryData<Comment[]>(['comments', postId]);
        queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
          old?.map((c) => (c.id === parentId ? { ...c, reply_count: (c.reply_count ?? 0) + 1 } : c)) ?? old
        );
      }
      // Comment-Count zählt ALLE Kommentare (inkl. Replies, wie der DB-Trigger).
      queryClient.setQueryData<number>(['comment-count', postId], (old) => (old ?? 0) + 1);
      return { previous, cacheKey, previousParents };
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
        .select('author_id')   // posts-Tabelle hat author_id, nicht user_id
        .eq('id', postId)
        .single();

      const notificationsToInsert: object[] = [];

      if (post?.author_id && post.author_id !== userId) {
        notificationsToInsert.push({
          recipient_id: post.author_id,
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
        if (parentComment?.user_id && parentComment.user_id !== userId && parentComment.user_id !== post?.author_id) {
          notificationsToInsert.push({
            recipient_id: parentComment.user_id,
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
          .filter((u) => u.id !== userId && u.id !== post?.author_id) // nicht doppelt benachrichtigen
          .map((u) => ({
            recipient_id: u.id,
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
    onError: (err: any, vars, context) => {
      const ctx = context as { previous?: Comment[]; cacheKey?: string[]; previousParents?: Comment[] } | undefined;
      if (ctx?.previous != null && ctx.cacheKey) {
        queryClient.setQueryData(ctx.cacheKey, ctx.previous);
      }
      // Eltern-reply_count zurückrollen (nur bei Reply gesetzt)
      if (vars.parentId && ctx?.previousParents) {
        queryClient.setQueryData(['comments', postId], ctx.previousParents);
      }
      // Comment-Count wurde immer hochgezählt → immer wieder senken
      queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
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
    mutationFn: async ({ commentId }: { commentId: string; parentId?: string | null }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId); // B3: Nur eigene Kommentare löschen
      if (error) throw error;
      return commentId;
    },
    onSuccess: (deletedId, { parentId }) => {
      if (parentId) {
        // Reply: aus dem Replies-Cache entfernen + Eltern-reply_count senken
        queryClient.setQueryData<Comment[]>(['comment-replies', parentId], (old) =>
          old ? old.filter((c) => c.id !== deletedId) : []
        );
        queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
          old?.map((c) => (c.id === parentId ? { ...c, reply_count: Math.max(0, (c.reply_count ?? 1) - 1) } : c)) ?? old
        );
      } else {
        // Top-Level: aus der Hauptliste entfernen
        queryClient.setQueryData<Comment[]>(['comments', postId], (old) =>
          old ? old.filter((c) => c.id !== deletedId) : []
        );
      }
      queryClient.setQueryData<number>(['comment-count', postId], (old) => Math.max(0, (old ?? 1) - 1));
      if (userId) queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });
    },
  });
}

/**
 * useToggleCommentLike
 *
 * Like/Unlike für TOP-LEVEL-Kommentare. Display-State lebt direkt im
 * ['comments', postId]-Cache (aus get_post_comments_web) → der Toggle
 * mutiert dort optimistisch `liked_by_me` + `like_count`. Dadurch kein
 * eigener Per-Row-Like-Query mehr (vorheriger N+1). Replies nutzen weiter
 * useCommentLike (on-demand, kleine N).
 */
export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({ commentId, liked }: { commentId: string; liked: boolean }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      if (liked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: userId });
        if (error) throw error;
      }
    },
    onMutate: ({ commentId, liked }: { commentId: string; liked: boolean }) => {
      const key = ['comments', postId];
      const prev = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old) =>
        old?.map((c) =>
          c.id === commentId
            ? {
                ...c,
                liked_by_me: !liked,
                like_count: Math.max(0, (c.like_count ?? 0) + (liked ? -1 : 1)),
              }
            : c
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      const prev = (context as { prev?: Comment[] } | undefined)?.prev;
      if (prev) queryClient.setQueryData(['comments', postId], prev);
    },
  });
}

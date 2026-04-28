'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  togglePostLike,
  togglePostBookmark,
  toggleFollow,
  toggleRepost,
  createComment,
  type ActionResult,
} from '@/app/actions/engagement';
import type { FeedPost } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// Client-seitige Engagement-Mutations mit TanStack-Optimistic-Update.
// Caller liefert den Post-Slice rein; Hook kümmert sich um Rollback bei Error.
// -----------------------------------------------------------------------------

type LikeArgs = { postId: string; liked: boolean };
type SaveArgs = { postId: string; saved: boolean };
type FollowArgs = { userId: string; following: boolean };
type RepostArgs = { postId: string; reposted: boolean };

/** Helper — wirf lesbar wenn Action-Result nicht ok. */
function unwrap<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

// -----------------------------------------------------------------------------
// useTogglePostLike
// -----------------------------------------------------------------------------

export function useTogglePostLike() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, liked }: LikeArgs) => unwrap(await togglePostLike(postId, liked)),
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      // Partial-Match: schreibt in alle ['feed', …] Caches (For-You + Following),
      // damit derselbe Post in beiden Tabs synchron bleibt.
      const prev = qc.getQueriesData<FeedPost[]>({ queryKey: ['feed'] });
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, (old) =>
        old?.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !liked,
                like_count: p.like_count + (liked ? -1 : 1),
              }
            : p,
        ),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
      }
      toast.error(err instanceof Error ? err.message : 'Like fehlgeschlagen');
    },
  });
}

// -----------------------------------------------------------------------------
// useTogglePostSave
// -----------------------------------------------------------------------------

export function useTogglePostSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, saved }: SaveArgs) =>
      unwrap(await togglePostBookmark(postId, saved)),
    onMutate: async ({ postId, saved }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const prev = qc.getQueriesData<FeedPost[]>({ queryKey: ['feed'] });
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, (old) =>
        old?.map((p) => (p.id === postId ? { ...p, saved_by_me: !saved } : p)),
      );
      return { prev };
    },
    onSuccess: ({ saved }) => {
      toast.success(saved ? 'Gespeichert' : 'Nicht mehr gespeichert');
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
      }
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    },
  });
}

// -----------------------------------------------------------------------------
// useToggleFollow
// -----------------------------------------------------------------------------

export function useToggleFollow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, following }: FollowArgs) =>
      unwrap(await toggleFollow(userId, following)),
    onMutate: async ({ userId, following }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const prev = qc.getQueriesData<FeedPost[]>({ queryKey: ['feed'] });
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, (old) =>
        old?.map((p) =>
          p.author.id === userId ? { ...p, following_author: !following } : p,
        ),
      );
      return { prev };
    },
    onSuccess: ({ following, pending }) => {
      if (pending) toast.success('Follower-Anfrage gesendet');
      else toast.success(following ? 'Du folgst jetzt diesem Account' : 'Nicht mehr gefolgt');
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
      }
      toast.error(err instanceof Error ? err.message : 'Follow fehlgeschlagen');
    },
  });
}

// -----------------------------------------------------------------------------
// useToggleRepost — v1.w.UI.151
// -----------------------------------------------------------------------------

export function useToggleRepost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, reposted }: RepostArgs) =>
      unwrap(await toggleRepost(postId, reposted)),
    onMutate: async ({ postId, reposted }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const prev = qc.getQueriesData<FeedPost[]>({ queryKey: ['feed'] });
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, (old) =>
        old?.map((p) => (p.id === postId ? { ...p, reposted_by_me: !reposted } : p)),
      );
      return { prev };
    },
    onSuccess: ({ reposted: isReposted }) => {
      toast.success(isReposted ? 'Repostet' : 'Repost entfernt');
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
      }
      toast.error(err instanceof Error ? err.message : 'Repost fehlgeschlagen');
    },
  });
}

// -----------------------------------------------------------------------------
// useCreateComment — kein Optimistic-Update hier, weil wir die echte ID
// vom Server brauchen und der Thread-Refresh ein paar hundert ms dauert.
// -----------------------------------------------------------------------------

export function useCreateComment(postId: string, parentId?: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => unwrap(await createComment(postId, body, parentId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      // Replies-Cache für den Parent-Kommentar invalidieren wenn es eine Reply ist.
      if (parentId) {
        qc.invalidateQueries({ queryKey: ['replies', parentId] });
      }
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, (prev) =>
        prev?.map((p) =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p,
        ),
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Kommentar konnte nicht gesendet werden');
    },
  });
}

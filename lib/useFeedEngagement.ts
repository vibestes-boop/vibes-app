import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type FeedEngagementMaps = {
  likedByPost: Record<string, boolean>;
  likeCountByPost: Record<string, number>;
  commentCountByPost: Record<string, number>;
  bookmarkedByPost: Record<string, boolean>;
  repostedByPost: Record<string, boolean>;  // NEU: Repost-Status im Batch
  followingByAuthor: Record<string, boolean>;
};

export function emptyFeedEngagementMaps(): FeedEngagementMaps {
  return {
    likedByPost: {},
    likeCountByPost: {},
    commentCountByPost: {},
    bookmarkedByPost: {},
    repostedByPost: {},
    followingByAuthor: {},
  };
}

async function fetchLikeCounts(postIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (postIds.length === 0) return out;
  const { data, error } = await supabase.rpc('get_post_like_counts', {
    p_post_ids: postIds,
  });
  if (error) {
    await Promise.all(
      postIds.map(async (id) => {
        const { count } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', id);
        out[id] = count ?? 0;
      })
    );
    return out;
  }
  for (const row of (data ?? []) as { post_id: string; cnt: number }[]) {
    out[row.post_id] = Number(row.cnt ?? 0);
  }
  for (const id of postIds) {
    if (out[id] === undefined) out[id] = 0;
  }
  return out;
}

async function fetchCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (postIds.length === 0) return out;
  const { data, error } = await supabase.rpc('get_post_comment_counts', {
    p_post_ids: postIds,
  });
  if (error) {
    await Promise.all(
      postIds.map(async (id) => {
        const { count } = await supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', id);
        out[id] = count ?? 0;
      })
    );
    return out;
  }
  for (const row of (data ?? []) as { post_id: string; cnt: number }[]) {
    out[row.post_id] = Number(row.cnt ?? 0);
  }
  for (const id of postIds) {
    if (out[id] === undefined) out[id] = 0;
  }
  return out;
}

export function useFeedEngagement(postIds: string[], authorIds: string[]) {
  const userId = useAuthStore((s) => s.profile?.id);
  const sortedIds = useMemo(() => [...postIds].sort().join('|'), [postIds]);
  const sortedAuthors = useMemo(() => [...new Set(authorIds.filter(Boolean))].sort().join('|'), [authorIds]);

  return useQuery({
    queryKey: ['feed-engagement', userId, sortedIds, sortedAuthors],
    placeholderData: emptyFeedEngagementMaps(),
    queryFn: async (): Promise<FeedEngagementMaps> => {
      if (!userId || postIds.length === 0) return emptyFeedEngagementMaps();

      const uniqueAuthors = [...new Set(authorIds.filter((a): a is string => !!a && a !== userId))];

      const [likedRows, likeCounts, commentCounts, bookmarkRows, repostRows, followRows] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
        fetchLikeCounts(postIds),
        fetchCommentCounts(postIds),
        supabase.from('bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
        supabase.from('reposts').select('post_id').eq('user_id', userId).in('post_id', postIds),
        uniqueAuthors.length === 0
          ? Promise.resolve({ data: [] as { following_id: string }[] })
          : supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', userId)
              .in('following_id', uniqueAuthors),
      ]);

      const likedByPost: Record<string, boolean> = {};
      for (const id of postIds) likedByPost[id] = false;
      for (const row of likedRows.data ?? []) {
        if (row.post_id) likedByPost[row.post_id] = true;
      }

      const bookmarkedByPost: Record<string, boolean> = {};
      for (const id of postIds) bookmarkedByPost[id] = false;
      for (const row of bookmarkRows.data ?? []) {
        if (row.post_id) bookmarkedByPost[row.post_id] = true;
      }

      const repostedByPost: Record<string, boolean> = {};
      for (const id of postIds) repostedByPost[id] = false;
      for (const row of repostRows.data ?? []) {
        if (row.post_id) repostedByPost[row.post_id] = true;
      }

      const followingByAuthor: Record<string, boolean> = {};
      for (const a of uniqueAuthors) followingByAuthor[a] = false;
      for (const row of followRows.data ?? []) {
        if (row.following_id) followingByAuthor[row.following_id] = true;
      }

      return {
        likedByPost,
        likeCountByPost: likeCounts,
        commentCountByPost: commentCounts,
        bookmarkedByPost,
        repostedByPost,
        followingByAuthor,
      };
    },
    enabled: !!userId && postIds.length > 0,
    staleTime: 1000 * 45,
    gcTime: 1000 * 60 * 3,
  });
}

/** Invalidiert Feed-Engagement (z. B. nach Like/Bookmark) */
export function useInvalidateFeedEngagement() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);
  return () => {
    queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });
  };
}

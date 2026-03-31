import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useVibeStore } from './store';
import { useAuthStore } from './authStore';

export type PostWithAuthor = {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  dwell_time_score: number;
  score_explore: number;
  score_brain: number;
  tags: string[];
  created_at: string;
  author_id: string;
  guild_id: string | null;
  is_guild_post: boolean;
  // Felder aus dem RPC-Join
  username: string | null;
  avatar_url: string | null;
  final_score: number;
};

const FEED_PAGE_SIZE = 15;

export function useVibeFeed(activeTag: string | null = null) {
  const committedExplore = useVibeStore((s) => s.committedExplore);
  const committedBrain   = useVibeStore((s) => s.committedBrain);

  return useInfiniteQuery<PostWithAuthor[]>({
    queryKey: ['vibe-feed', committedExplore, committedBrain, activeTag],
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Wenn die letzte Seite weniger als PAGE_SIZE Posts hat, gibt es keine weitere Seite
      if (lastPage.length < FEED_PAGE_SIZE) return undefined;
      return allPages.length * FEED_PAGE_SIZE;
    },
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;

      // Primär: personalisierter RPC mit Dwell-Algorithmus
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_vibe_feed', {
        explore_weight: committedExplore,
        brain_weight:   committedBrain,
        result_limit:   FEED_PAGE_SIZE,
        result_offset:  offset,
        filter_tag:     activeTag ?? null,
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData as PostWithAuthor[];
      }

      // Fallback: direkter Query wenn RPC fehlt oder leer zurückgibt
      let query = supabase
        .from('posts')
        .select(`
          id, author_id, caption, media_url, media_type,
          dwell_time_score, score_explore, score_brain,
          tags, guild_id, is_guild_post, created_at,
          profiles!author_id (username, avatar_url)
        `)
        .is('is_guild_post', false)   // ← Fix: war vorher im Fallback nicht gesetzt
        .order('created_at', { ascending: false })
        .range(offset, offset + FEED_PAGE_SIZE - 1);

      if (activeTag) {
        // Bug 11 Fix: Builder gibt neue Instanz zurück — reassignment nötig
        query = query.contains('tags', [activeTag]);
      }

      const { data: fallbackData, error: fallbackError } = await query;

      if (fallbackError) throw fallbackError;

      return ((fallbackData ?? []) as any[]).map((p) => ({
        ...p,
        username:   (p.profiles as any)?.username   ?? null,
        avatar_url: (p.profiles as any)?.avatar_url ?? null,
        final_score: p.dwell_time_score ?? 0,
      })) as PostWithAuthor[];
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
}

// ─── Trending Feed (Top Posts nach Dwell-Score) ───────────────────────────────
// Wird gezeigt wenn der personalisierte Feed leer ist (neue User ohne Follows)
export function useTrendingFeed() {
  return useQuery<PostWithAuthor[]>({
    queryKey: ['trending-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, author_id, caption, media_url, media_type,
          dwell_time_score, score_explore, score_brain,
          tags, guild_id, is_guild_post, created_at,
          profiles!author_id (username, avatar_url)
        `)
        .is('is_guild_post', false)
        .order('dwell_time_score', { ascending: false })
        .limit(30);
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        username:   (p.profiles as any)?.username   ?? null,
        avatar_url: (p.profiles as any)?.avatar_url ?? null,
        final_score: p.dwell_time_score ?? 0,
      })) as PostWithAuthor[];
    },
    staleTime: 1000 * 60 * 5, // 5 min Cache — Trending ändert sich langsamer
  });
}

export type GuildPost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  tags: string[];
  created_at: string;
  username: string | null;
  avatar_url: string | null;
  author_guild_id: string | null;
  comment_count: number;  // Batch-geladen, kein N+1
  like_count: number;     // Batch-geladen, kein N+1
  is_liked: boolean;      // Batch-geladen, kein N+1
};

export function useGuildFeed() {
  const userId = useAuthStore((s) => s.profile?.id) ?? null;

  return useQuery({
    queryKey: ['guild-feed', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_guild_feed', {
        result_limit: 20,
      });
      if (error) throw error;
      const posts = (data as Omit<GuildPost, 'comment_count' | 'like_count' | 'is_liked'>[]) ?? [];

      if (posts.length === 0) return [] as GuildPost[];

      const postIds = posts.map((p) => p.id);

      // ── Batch-Fetch aller Counts in ZWEI parallelen Calls, nicht 40 ──
      const [commentCountRes, likeCountRes, likedRes] = await Promise.all([
        supabase.rpc('get_post_comment_counts', { p_post_ids: postIds }),
        supabase.rpc('get_post_like_counts',    { p_post_ids: postIds }),
        userId
          ? supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);

      const commentMap: Record<string, number> = {};
      for (const row of (commentCountRes.data ?? []) as { post_id: string; cnt: number }[]) {
        commentMap[row.post_id] = Number(row.cnt ?? 0);
      }

      const likeMap: Record<string, number> = {};
      for (const row of (likeCountRes.data ?? []) as { post_id: string; cnt: number }[]) {
        likeMap[row.post_id] = Number(row.cnt ?? 0);
      }

      const likedSet = new Set<string>(
        ((likedRes as any).data ?? []).map((r: { post_id: string }) => r.post_id)
      );

      return posts.map((p) => ({
        ...p,
        comment_count: commentMap[p.id] ?? 0,
        like_count:    likeMap[p.id]    ?? 0,
        is_liked:      likedSet.has(p.id),
      })) as GuildPost[];
    },
    staleTime: 1000 * 60 * 3,
    gcTime:    1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

export type UserPost = {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  dwell_time_score: number;
};

export function useUserPosts(userId: string | null) {
  return useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, caption, dwell_time_score')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserPost[];
    },
    enabled: !!userId,
    staleTime: 0,              // Immer fresh beim Tab-Wechsel
    gcTime: 1000 * 60 * 5,
    refetchOnMount: 'always',  // Beim Mount immer neu laden
  });
}

export type GuildInfo = {
  id: string;
  name: string;
  description: string | null;
  vibe_tags: string[];
};

export function useGuildInfo(guildId: string | null) {
  return useQuery({
    queryKey: ['guild-info', guildId],
    queryFn: async () => {
      if (!guildId) return null;
      const { data, error } = await supabase
        .from('guilds')
        .select('id, name, description, vibe_tags')
        .eq('id', guildId)
        .single();
      if (error) throw error;
      return data as GuildInfo;
    },
    enabled: !!guildId,
    staleTime: 1000 * 60 * 10,
  });
}

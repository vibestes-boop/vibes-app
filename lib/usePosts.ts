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

// Mindestanzahl frischer Posts bevor seen-Content recycelt wird
const SEEN_FALLBACK_THRESHOLD = 5;

export function useVibeFeed(activeTag: string | null = null) {
  const committedExplore = useVibeStore((s) => s.committedExplore);
  const committedBrain   = useVibeStore((s) => s.committedBrain);

  return useInfiniteQuery<PostWithAuthor[]>({
    queryKey: ['vibe-feed', committedExplore, committedBrain, activeTag],

    // ── ID-Exclusion cursor (statt OFFSET) ──────────────────────────────────
    // Erste Seite: leeres Array → kein Filter
    // Folgeseiten: alle bereits geladenen Post-IDs → nie Duplikate
    initialPageParam: [] as string[],
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < FEED_PAGE_SIZE) return undefined;
      // Cursor = alle bisher geladenen IDs (flach, dedupliziert)
      return allPages.flat().map((p) => p.id);
    },

    queryFn: async ({ pageParam }) => {
      const excludeIds = pageParam as string[];

      // ─── Schritt 1: Nur ungesehene Posts ──────────────────────────────────
      const { data: freshData, error: rpcError } = await supabase.rpc('get_vibe_feed', {
        explore_weight: committedExplore,
        brain_weight:   committedBrain,
        result_limit:   FEED_PAGE_SIZE,
        filter_tag:     activeTag ?? null,
        include_seen:   false,
        exclude_ids:    excludeIds,   // ← ID-Cursor statt result_offset
      });

      const freshPosts = Array.isArray(freshData) ? freshData as PostWithAuthor[] : [];

      // Genug frischer Content → direkt zurückgeben
      if (!rpcError && freshPosts.length >= SEEN_FALLBACK_THRESHOLD) {
        return freshPosts;
      }

      // ─── Schritt 2: Automatischer Fallback → gesehene Posts recyceln ────
      if (!rpcError || freshPosts.length === 0) {
        const { data: seenData, error: seenError } = await supabase.rpc('get_vibe_feed', {
          explore_weight: committedExplore,
          brain_weight:   committedBrain,
          result_limit:   FEED_PAGE_SIZE,
          filter_tag:     activeTag ?? null,
          include_seen:   true,
          exclude_ids:    excludeIds,  // ← auch bei Fallback keine Duplikate
        });

        if (!seenError && Array.isArray(seenData) && seenData.length > 0) {
          return seenData as PostWithAuthor[];
        }
      }

      // ─── Schritt 3: Direkter DB-Query (Sicherheitsnetz) ──────────────────
      let query = supabase
        .from('posts')
        .select(`
          id, author_id, caption, media_url, media_type,
          dwell_time_score, score_explore, score_brain,
          tags, guild_id, is_guild_post, created_at,
          profiles!author_id (username, avatar_url)
        `)
        .is('is_guild_post', false)
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);

      if (activeTag) query = query.contains('tags', [activeTag]);
      if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

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
        .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url')
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

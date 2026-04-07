import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useVibeStore } from './store';
import { useAuthStore } from './authStore';

export type PostWithAuthor = {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  thumbnail_url: string | null;
  dwell_time_score: number;
  score_explore: number;
  score_brain: number;
  tags: string[];
  created_at: string;
  author_id: string;
  guild_id: string | null;
  is_guild_post: boolean;
  privacy: 'public' | 'friends' | 'private';
  allow_comments: boolean;
  allow_download: boolean;
  allow_duet: boolean;
  // Felder aus dem RPC-Join
  username: string | null;
  avatar_url: string | null;
  final_score: number;
  // Musik-Track (optional)
  audio_url?: string | null;
  audio_volume?: number | null; // Lautstärke 0..1
  // Verifizierter Creator Badge
  is_verified?: boolean | null;
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
          id, author_id, caption, media_url, media_type, thumbnail_url,
          dwell_time_score, score_explore, score_brain, view_count,
          tags, guild_id, is_guild_post, created_at,
          privacy, allow_comments, allow_download, allow_duet, audio_url,
          profiles!author_id (username, avatar_url, is_verified)
        `)
        .is('is_guild_post', false)
        // Nur öffentliche Posts im For-You Feed (Sicherheitsnetz)
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);

      if (activeTag) query = query.contains('tags', [activeTag]);
      if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

      const { data: fallbackData, error: fallbackError } = await query;
      if (fallbackError) throw fallbackError;

      return ((fallbackData ?? []) as any[]).map((p) => ({
        ...p,
        username:      (p.profiles as any)?.username   ?? null,
        avatar_url:    (p.profiles as any)?.avatar_url ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        final_score:   p.dwell_time_score ?? 0,
        privacy:       p.privacy ?? 'public',
        allow_comments: p.allow_comments ?? true,
        allow_download: p.allow_download ?? true,
        allow_duet:     p.allow_duet     ?? true,
        audio_url:     p.audio_url ?? null,
        audio_volume:  p.audio_volume ?? 0.8,
        is_verified:   (p.profiles as any)?.is_verified ?? null,
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
          id, author_id, caption, media_url, media_type, thumbnail_url,
          dwell_time_score, score_explore, score_brain, view_count,
          tags, guild_id, is_guild_post, created_at, audio_url,
          profiles!author_id (username, avatar_url, is_verified)
        `)
        .is('is_guild_post', false)
        .order('dwell_time_score', { ascending: false })
        .limit(30);
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        username:      (p.profiles as any)?.username   ?? null,
        avatar_url:    (p.profiles as any)?.avatar_url ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        audio_url:     p.audio_url ?? null,
        audio_volume:  p.audio_volume ?? 0.8,
        is_verified:   (p.profiles as any)?.is_verified ?? null,
        final_score:   p.dwell_time_score ?? 0,
      })) as PostWithAuthor[];
    },
    staleTime: 1000 * 60 * 5, // 5 min Cache — Trending ändert sich langsamer
  });
}

// ─── Following Feed (Posts von gefolgten Usern) ───────────────────────────────
// Zeigt nur Posts von Usern denen der eingeloggte User folgt — chronologisch.
export function useFollowingFeed() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useInfiniteQuery<PostWithAuthor[]>({
    queryKey: ['following-feed', userId],
    enabled: !!userId,
    initialPageParam: [] as string[],
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < FEED_PAGE_SIZE) return undefined;
      return allPages.flat().map((p) => p.id);
    },

    queryFn: async ({ pageParam }) => {
      if (!userId) return [];
      const excludeIds = pageParam as string[];

      // Schritt 1: Folge-Liste holen
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = (followData ?? []).map((f: any) => f.following_id as string);
      if (followingIds.length === 0) return [];

      // Schritt 2: Posts von gefolgten Usern laden — inkl. friends-Posts
      let query = supabase
        .from('posts')
        .select(`
          id, author_id, caption, media_url, media_type, thumbnail_url,
          dwell_time_score, score_explore, score_brain, view_count,
          tags, guild_id, is_guild_post, created_at,
          privacy, allow_comments, allow_download, allow_duet, audio_url,
          profiles!author_id (username, avatar_url, is_verified)
        `)
        .is('is_guild_post', false)
        .in('author_id', followingIds)
        // Im Following-Feed: public + friends Posts sichtbar, private nicht
        .in('privacy', ['public', 'friends'])
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        username:      (p.profiles as any)?.username   ?? null,
        avatar_url:    (p.profiles as any)?.avatar_url ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        final_score:   p.dwell_time_score ?? 0,
        privacy:       p.privacy ?? 'public',
        allow_comments: p.allow_comments ?? true,
        allow_download: p.allow_download ?? true,
        allow_duet:     p.allow_duet     ?? true,
        audio_url:     p.audio_url ?? null,
        audio_volume:  (p as any).audio_volume ?? 0.8,
        is_verified:   (p.profiles as any)?.is_verified ?? null,
      })) as PostWithAuthor[];
    },
    staleTime: 1000 * 60,
    retry: 1,
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
  thumbnail_url?: string | null;
  view_count?: number;
  is_pinned?: boolean;      // Pin-Status
  like_count?: number;      // Anzahl Likes
  comment_count?: number;   // Anzahl Kommentare
  created_at?: string;      // Erstellungsdatum
};

export function useUserPosts(userId: string | null) {
  return useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, media_url, media_type, caption,
          dwell_time_score, thumbnail_url, view_count,
          is_pinned, created_at,
          like_count:likes(count),
          comment_count:comments(count)
        `)
        .eq('author_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        like_count:    Array.isArray(p.like_count)    ? (p.like_count[0]?.count    ?? 0) : (p.like_count    ?? 0),
        comment_count: Array.isArray(p.comment_count) ? (p.comment_count[0]?.count ?? 0) : (p.comment_count ?? 0),
      })) as UserPost[];
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

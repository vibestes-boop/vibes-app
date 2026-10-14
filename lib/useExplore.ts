import { getBlockedIdSet } from './useBlock';
import { MIN_POST_SEARCH_LENGTH } from './exploreLayout';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import { Clock,Flame,Sparkles } from 'lucide-react-native';
import type { ElementType } from 'react';
import type { TranslationKey } from '@/lib/i18n';

export const EXPLORE_FALLBACK_TAGS = [
  'Tech',
  'Design',
  'Art',
  'Music',
  'Travel',
  'Nature',
  'Fitness',
  'Photography',
  'Gaming',
  'Food',
];

export type ExploreSortMode = 'forYou' | 'trending' | 'newest';

export type ExplorePostThumb = {
  id: string;
  author_id?: string;
  profiles?: { username: string | null; avatar_url: string | null } | null;
  media_url: string | null;
  thumbnail_url?: string | null;
  media_type: string;
  caption: string | null;
  like_count?: number | null;
  view_count?: number | null;
};

export type ExploreUserResult = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

// labelKey/subKey → Übersetzung am Renderpunkt (ExploreSortModal via t()).
export const EXPLORE_SORT_OPTIONS: {
  id: ExploreSortMode;
  labelKey: TranslationKey;
  subKey: TranslationKey;
  Icon: ElementType;
}[] = [
  { id: 'forYou', labelKey: 'explore.sortForYou', subKey: 'explore.sortForYouSub', Icon: Sparkles },
  { id: 'trending', labelKey: 'explore.sortTrending', subKey: 'explore.sortTrendingSub', Icon: Flame },
  { id: 'newest', labelKey: 'explore.sortNewest', subKey: 'explore.sortNewestSub', Icon: Clock },
];

// Stable ordering is shared by discovery and search, including page boundaries.
function sortPosts<Query extends {
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): Query;
  gte(column: string, value: string): Query;
}>(query: Query, mode: ExploreSortMode): Query {
  let sorted = query;
  if (mode === 'trending') {
    sorted = sorted.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).order('view_count', { ascending: false, nullsFirst: false });
  } else if (mode === 'forYou') {
    sorted = sorted.order('dwell_time_score', { ascending: false, nullsFirst: false });
  }
  return sorted.order('created_at', { ascending: false }).order('id', { ascending: false });
}

export function useTrendingTags() {
  const userId = useAuthStore(s => s.profile?.id);
  return useQuery<string[]>({
    queryKey: ['trending-tags', 'visibility-v2', userId],
    queryFn: async () => {
      const blocked = await getBlockedIdSet({ userId, strict: true });
      let request = supabase
        .from('posts')
        .select('tags')
        .not('tags', 'is', null)
        .limit(100);
      if (blocked.size) request = request.not('author_id', 'in', `(${[...blocked].join(',')})`);
      const { data, error } = await request;
      if (error) throw error;

      if (!data?.length) return EXPLORE_FALLBACK_TAGS;

      const freq = new Map<string, number>();
      for (const row of data) {
        for (const tag of (row.tags ?? []) as string[]) {
          const t = tag.toLowerCase().trim();
          if (t) freq.set(t, (freq.get(t) ?? 0) + 1);
        }
      }

      return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([tag]) => tag.charAt(0).toUpperCase() + tag.slice(1));
    },
    staleTime: 1000 * 60 * 15,   // 15 Min — selten ändernd
    placeholderData: EXPLORE_FALLBACK_TAGS,
  });
}

export function useExploreGrid(tag: string | null, sortMode: ExploreSortMode) {
  const userId = useAuthStore(s => s.profile?.id);
  const normalizedTag = tag?.trim().toLowerCase() || null;
  return useInfiniteQuery({
    queryKey: ['explore-grid', 'visibility-v2', userId, normalizedTag, sortMode],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const blocked = await getBlockedIdSet({ userId, strict: true });
      const limit = 30;
      const offset = pageParam * limit;

      let q = supabase
        .from('posts')
        .select('id, author_id, profiles!author_id(username,avatar_url), media_url, thumbnail_url, media_type, caption, like_count, view_count, dwell_time_score, created_at')
        .not('media_url', 'is', null)
        .range(offset, offset + limit - 1);

      if (normalizedTag) q = q.contains('tags', [normalizedTag]);
      // Exclude before pagination, so a blocked row never consumes a page slot.
      if (blocked.size) q = q.not('author_id', 'in', `(${[...blocked].join(',')})`);
      q = sortPosts(q, sortMode);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(post => ({ ...post, profiles: Array.isArray(post.profiles) ? post.profiles[0] ?? null : post.profiles })) as ExplorePostThumb[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 30 ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5,   // 5 Min (war 1 Min) — vermeidet Re-Fetch beim Tab-Wechsel
  });
}

export function useExploreUserSearch(query: string) {
  const currentUserId = useAuthStore((s) => s.profile?.id);

  return useQuery<ExploreUserResult[]>({
    queryKey: ['user-search', 'visibility-v2', query, currentUserId],
    queryFn: async () => {
      if (!query.trim()) return [];

      const blocked = await getBlockedIdSet({ userId: currentUserId, strict: true });

      let q = supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .ilike('username', `%${query.trim()}%`)
        .order('username', { ascending: true })
        .limit(8);
      if (blocked.size) q = q.not('id', 'in', `(${[...blocked].join(',')})`);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []) as ExploreUserResult[];
    },
    enabled: query.trim().length >= 1,
    staleTime: 1000 * 30,
  });
}

export function useExplorePostSearch(query: string, sortMode: ExploreSortMode = 'forYou') {
  const userId = useAuthStore(s => s.profile?.id);
  return useQuery<ExplorePostThumb[]>({
    queryKey: ['post-search', 'visibility-v2', userId, query, sortMode],
    queryFn: async () => {
      if (!query.trim()) return [];
      const blocked = await getBlockedIdSet({ userId, strict: true });
      let request = supabase
        .from('posts')
        .select('id, author_id, profiles!author_id(username,avatar_url), media_url, thumbnail_url, media_type, caption, like_count, view_count')
        .ilike('caption', `%${query.trim()}%`)
        .not('media_url', 'is', null)
        .limit(30);
      if (blocked.size) request = request.not('author_id', 'in', `(${[...blocked].join(',')})`);
      const { data, error } = await sortPosts(request, sortMode);
      if (error) throw error;
      return (data ?? []).map(post => ({ ...post, profiles: Array.isArray(post.profiles) ? post.profiles[0] ?? null : post.profiles })) as ExplorePostThumb[];
    },
    enabled: query.trim().length >= MIN_POST_SEARCH_LENGTH,
    staleTime: 1000 * 30,
  });
}

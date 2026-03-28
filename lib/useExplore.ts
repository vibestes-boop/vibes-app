import { useQuery } from '@tanstack/react-query';
import { Sparkles, Flame, Clock } from 'lucide-react-native';
import type { ElementType } from 'react';
import { supabase } from '@/lib/supabase';

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
  media_url: string | null;
  media_type: string;
  caption: string | null;
};

export type ExploreUserResult = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

export const EXPLORE_SORT_OPTIONS: {
  id: ExploreSortMode;
  label: string;
  sub: string;
  Icon: ElementType;
}[] = [
  { id: 'forYou', label: 'Für dich', sub: 'Personalisiert nach Dwell-Time', Icon: Sparkles },
  { id: 'trending', label: 'Trending', sub: 'Meistgeschaute Posts der Woche', Icon: Flame },
  { id: 'newest', label: 'Neueste', sub: 'Chronologisch – komplett unfiltered', Icon: Clock },
];

export function useTrendingTags() {
  return useQuery<string[]>({
    queryKey: ['trending-tags'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('tags')
        .not('tags', 'is', null)
        .limit(200);

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
    staleTime: 1000 * 60 * 10,
    placeholderData: EXPLORE_FALLBACK_TAGS,
  });
}

export function useExploreGrid(tag: string | null, sortMode: ExploreSortMode) {
  return useQuery<ExplorePostThumb[]>({
    queryKey: ['explore-grid', tag, sortMode],
    queryFn: async () => {
      let q = supabase
        .from('posts')
        .select('id, media_url, media_type, caption, dwell_time_score, created_at')
        .not('media_url', 'is', null)
        .limit(60);

      if (tag) q = q.contains('tags', [tag]);

      if (sortMode === 'forYou' || sortMode === 'trending') {
        q = q.order('dwell_time_score', { ascending: false, nullsFirst: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExplorePostThumb[];
    },
    staleTime: 1000 * 60,
  });
}

export function useExploreUserSearch(query: string) {
  return useQuery<ExploreUserResult[]>({
    queryKey: ['user-search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .ilike('username', `%${query.trim()}%`)
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ExploreUserResult[];
    },
    enabled: query.trim().length >= 1,
    staleTime: 1000 * 30,
  });
}

export function useExplorePostSearch(query: string) {
  return useQuery<ExplorePostThumb[]>({
    queryKey: ['post-search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, caption')
        .ilike('caption', `%${query.trim()}%`)
        .not('media_url', 'is', null)
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ExplorePostThumb[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 30,
  });
}

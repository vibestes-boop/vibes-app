import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withDiscoveryDeadline } from './discoveryRequest';
import { liveShowsQuery, LIVE_SHOW_COLUMNS, type LiveShow } from './useLiveShows';
import { upcomingShowsQuery, PLANNED_SHOW_COLUMNS, toPlannedShow } from './useSchedule';
import { selectLiveShows, selectUpcomingShows, type ShowSources } from './showDiscovery';

export type ShowDiscoveryOptions = {
  userId: string | null;
  interests: string[];
  useFollowing: boolean;
  enabled: boolean;
  /** An explicit category choice restricts every live source, including subcategories. */
  categoryFilter?: string[];
};
type Source = 'general' | 'interest' | 'following';
const LIVE_FOLLOW = `${LIVE_SHOW_COLUMNS},host:profiles!live_sessions_host_id_fkey!inner(followers:follows!follows_following_id_fkey!inner(follower_id))`;
const PLAN_FOLLOW = PLANNED_SHOW_COLUMNS.replace('profiles!host_id(username, avatar_url)',
  'profiles!host_id!inner(username, avatar_url, followers:follows!follows_following_id_fkey!inner(follower_id))');
const PLAN_INTEREST = `${PLANNED_SHOW_COLUMNS},prepared:live_auctions!planned_for!inner(category)`;

function optionsFor<T>(kind: 'live' | 'upcoming', options: ShowDiscoveryOptions, decode: (rows: unknown) => T[]) {
  const { userId, enabled } = options;
  const interests = [...new Set(options.interests)].sort();
  const filter = [...new Set(options.categoryFilter ?? [])].sort();
  const following = Boolean(userId && options.useFollowing);
  return {
    queryKey: ['berkat', kind === 'live' ? 'shows' : 'upcoming-shows', 'discovery', userId, interests, following, filter],
    enabled, staleTime: kind === 'live' ? 20_000 : 60_000,
    refetchInterval: kind === 'live' ? 20_000 : 60_000,
    retry: false,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ShowSources<T>> => {
      const sources: Source[] = ['general'];
      if (interests.length) sources.push('interest');
      if (following) sources.push('following');
      const results = await Promise.allSettled(sources.map((source) => withDiscoveryDeadline(signal, async (requestSignal) => {
        let query;
        if (kind === 'live') {
          query = liveShowsQuery(source === 'following' ? LIVE_FOLLOW : LIVE_SHOW_COLUMNS);
          if (filter.length) query = query.in('category', filter);
          if (source === 'interest') query = query.in('category', interests);
          if (source === 'following') query = query.eq('host.followers.follower_id', userId!);
          query = query.order('viewer_count', { ascending: false, nullsFirst: false });
        } else {
          query = upcomingShowsQuery(source === 'following' ? PLAN_FOLLOW : source === 'interest' ? PLAN_INTEREST : PLANNED_SHOW_COLUMNS);
          if (source === 'interest') query = query.in('prepared.category', interests)
            .eq('prepared.status', 'scheduled').is('prepared.session_id', null);
          if (source === 'following') query = query.eq('profiles.followers.follower_id', userId!);
          query = query.order('scheduled_at', { ascending: true });
        }
        if (source !== 'general' && userId) query = query.neq('host_id', userId);
        const { data, error } = await query.order('id', { ascending: true })
          .limit(kind === 'live' && source === 'general' ? 60 : 24).abortSignal(requestSignal).retry(false);
        if (error) throw error;
        return decode(data ?? []);
      })));
      if (signal.aborted) throw new Error('discovery_aborted');
      if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
      const rows = (source: Source) => {
        const result = results[sources.indexOf(source)];
        return result?.status === 'fulfilled' ? result.value : [];
      };
      return { general: rows('general'), interest: rows('interest'), following: rows('following'), partial: results.some((r) => r.status === 'rejected') };
    },
  };
}

export function useLiveDiscovery(options: ShowDiscoveryOptions) {
  const query = useQuery(optionsFor('live', options, (rows) => rows as LiveShow[]));
  const selected = useMemo(() => query.data ? selectLiveShows(query.data, options.userId) : undefined, [query.data, options.userId]);
  return { ...query, data: selected?.items, reasons: selected?.reasons ?? {}, partial: query.data?.partial ?? false };
}

export function useUpcomingDiscovery(options: ShowDiscoveryOptions) {
  const query = useQuery(optionsFor('upcoming', options, (rows) => (rows as Parameters<typeof toPlannedShow>[0][]).map(toPlannedShow)));
  const selected = useMemo(() => query.data ? selectUpcomingShows(query.data, options.userId, Date.now()) : undefined,
    [query.data, query.dataUpdatedAt, options.userId]);
  return { ...query, data: selected?.items, reasons: selected?.reasons ?? {}, partial: query.data?.partial ?? false };
}

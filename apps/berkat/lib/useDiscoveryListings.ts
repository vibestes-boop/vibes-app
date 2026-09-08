import { useQuery } from '@tanstack/react-query';
import { browseQuery, LISTING_COLUMNS, withVisibleShow, type Listing } from './useListings';
import { selectDiscovery } from './discovery';

const CANDIDATES = 16;
// Verified foreign keys: live_auctions.seller_id → profiles.id ← follows.following_id.
// The server filters all follow relationships; no first-page truncation or per-seller requests.
const FOLLOW_COLUMNS = `${LISTING_COLUMNS},seller:profiles!live_auctions_seller_id_fkey!inner(followers:follows!follows_following_id_fkey!inner(follower_id))`;

/** A stalled personal source must not hold the whole home feed indefinitely. */
export async function withDiscoveryDeadline<T>(signal: AbortSignal, read: (requestSignal: AbortSignal) => Promise<T>, timeoutMs = 8_000): Promise<T> {
  if (signal.aborted) throw new Error('discovery_aborted');
  const request = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => { request.abort(); reject(new Error('discovery_aborted')); };
    signal.addEventListener('abort', abort);
    timer = setTimeout(() => { request.abort(); reject(new Error('discovery_timeout')); }, timeoutMs);
  });
  try { return await Promise.race([read(request.signal), deadline]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export function useDiscoveryListings(
  userId: string | null, interests: string[], useFollowing: boolean, enabled = true,
) {
  const slugs = [...new Set(interests)].sort();
  const follow = Boolean(userId && useFollowing);
  const query = useQuery({
    queryKey: ['berkat', 'discovery', userId, slugs, follow],
    enabled, staleTime: 30_000, retry: false,
    queryFn: async ({ signal }) => {
      const read = (source: 'recent' | 'interest' | 'following') => withDiscoveryDeadline(signal, async (requestSignal) => {
        let request = browseQuery(source === 'following' ? FOLLOW_COLUMNS : LISTING_COLUMNS);
        if (source === 'interest') request = request.in('category', slugs);
        if (source === 'following') request = request.eq('seller.followers.follower_id', userId!);
        if (source !== 'recent' && userId) request = request.neq('seller_id', userId);
        const { data, error } = await request.order('created_at', { ascending: false })
          .order('id', { ascending: false }).limit(CANDIDATES).abortSignal(requestSignal).retry(false);
        if (error) throw error;
        return withVisibleShow((data ?? []) as unknown as Listing[]);
      });
      const sources: ('recent' | 'interest' | 'following')[] = ['recent'];
      if (slugs.length) sources.push('interest');
      if (follow) sources.push('following');
      const results = await Promise.allSettled(sources.map(read));
      if (signal.aborted) throw new Error('discovery_aborted');
      if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
      const rows = (source: typeof sources[number]) => {
        const result = results[sources.indexOf(source)];
        return result?.status === 'fulfilled' ? result.value : [];
      };
      return {
        ...selectDiscovery(rows('recent'), rows('interest'), rows('following'), userId),
        partial: results.some((r) => r.status === 'rejected'),
      };
    },
  });
  return { ...query, data: query.data?.items, reasons: query.data?.reasons ?? {}, partial: query.data?.partial ?? false };
}

import { useQuery } from '@tanstack/react-query';
import { browseQuery, LISTING_COLUMNS, withVisibleShow, type Listing } from './useListings';
import { selectDiscovery } from './discovery';
import { withDiscoveryDeadline } from './discoveryRequest';
export { withDiscoveryDeadline } from './discoveryRequest';

const CANDIDATES = 16;

/**
 * Wie viele Angebote die Entdeckung ZURÜCKGIBT — nicht, wie viele sie prüft.
 *
 * ⚠️ HIER STAND BIS ZUM 21.09.2026 NICHTS, UND DAMIT GALT DIE ACHT AUS
 * `selectDiscovery`. Das war richtig, solange die Startseite EINE Fläche hatte:
 * acht Karten im Raster, acht Angebote geholt, kein Rest.
 *
 * Mit der Wischreihe („Galerie", `lib/shelfSplit.ts`) sind es zwei Flächen, und
 * die Reihe bekommt ausschließlich den Überhang. Bei acht Angeboten ist der
 * Überhang null — die Reihe erschien also nie, auf keinem Gerät, bei keinem
 * Bestand. `tsc` war grün, alle Tests waren grün: Die Aufteilung rechnete
 * richtig, sie bekam nur nie etwas zu verteilen.
 *
 * Sechzehn = acht fürs Raster plus acht für die Reihe. Mehr wäre sinnlos, denn
 * `CANDIDATES` holt je Quelle nur sechzehn Zeilen.
 */
const DISCOVERY_LIMIT = 16;
// Verified foreign keys: live_auctions.seller_id → profiles.id ← follows.following_id.
// The server filters all follow relationships; no first-page truncation or per-seller requests.
const FOLLOW_COLUMNS = `${LISTING_COLUMNS},seller:profiles!live_auctions_seller_id_fkey!inner(followers:follows!follows_following_id_fkey!inner(follower_id))`;

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
        ...selectDiscovery(rows('recent'), rows('interest'), rows('following'), userId, DISCOVERY_LIMIT),
        partial: results.some((r) => r.status === 'rejected'),
      };
    },
  });
  return { ...query, data: query.data?.items, reasons: query.data?.reasons ?? {}, partial: query.data?.partial ?? false };
}

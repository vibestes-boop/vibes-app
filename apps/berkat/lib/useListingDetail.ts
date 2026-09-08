import { useMemo } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useListing, type Listing } from './useListings';

const LIST_SOURCES = new Set(['shop', 'category-listings', 'standing', 'listing-search', 'saved-listings', 'listings-by-ids']);

/** Read an existing list snapshot; never promote it to a verified detail cache.
 * Only these sources carry the complete shared Listing column set.
 */
export function cachedListingPreview(client: QueryClient, id: string | undefined): Listing | undefined {
  if (!id) return undefined;
  const queries = client.getQueryCache().findAll({ predicate: query =>
    query.queryKey[0] === 'berkat' && LIST_SOURCES.has(String(query.queryKey[1])),
  }).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  for (const query of queries) {
    const data = query.state.data as Listing[] | Map<string, Listing> | { pages?: { rows: Listing[] }[] } | undefined;
    const rows = Array.isArray(data) ? data : data instanceof Map ? [data.get(id)] : data?.pages?.flatMap(page => page.rows) ?? [];
    const found = rows.find(row => row?.id === id);
    // Protected content waits for the detail query, including after account changes.
    if (found) return found.women_only === false ? found : undefined;
  }
  return undefined;
}

export function useListingDetail(id: string | undefined, enabled = true) {
  const client = useQueryClient();
  const preview = useMemo(() => cachedListingPreview(client, id), [client, id]);
  const query = useListing(id, enabled);
  // null is an authoritative empty response; it must replace a cached preview.
  const visiblePreview = (query.error as { code?: string } | null)?.code === '42501' ? undefined : preview;
  const isPreview = query.data === undefined && Boolean(visiblePreview);
  return { ...query, data: query.data === undefined ? visiblePreview : query.data,
    isPreview, isLoading: query.isLoading && !visiblePreview };
}

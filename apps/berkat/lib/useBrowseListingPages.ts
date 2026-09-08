import { useMemo } from 'react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { supabase } from './supabase';
import { LISTING_COLUMNS, listingPrice, type Listing } from './useListings';
import { useDebounced } from './useSellerSearch';

export type BrowseSort = 'neu' | 'guenstig' | 'teuer';
export type BrowseFilters = {
  slugs?: string[];
  query?: string;
  condition?: string | null;
  size?: string | null;
  city?: string | null;
  maxPrice?: number | null;
  onlyShow?: boolean;
  sort?: BrowseSort;
};
type Cursor = { createdAt: string; id: string; price: number } | null;
type Page = { rows: Listing[]; next: Cursor | undefined };
const PAGE_SIZE = 30;

export function normalizeBrowseFilters(filters: BrowseFilters) {
  return {
    slugs: filters.slugs ? [...new Set(filters.slugs)].sort() : undefined,
    query: filters.query?.trim().slice(0, 100) || '',
    condition: filters.condition || null,
    size: filters.size?.trim().slice(0, 24) || '',
    city: filters.city?.trim().slice(0, 80) || '',
    maxPrice: filters.maxPrice ?? null,
    onlyShow: Boolean(filters.onlyShow),
    sort: filters.sort ?? 'neu',
  };
}

// Literal, case-insensitive substring matching, including %, * and brackets.
// Unlike ilike, imatch does not reinterpret * as a SQL wildcard alias.
function literalPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function quoted(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function micros(timestamp: string) {
  const fraction = timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? '';
  return Date.parse(timestamp) * 1000 + Number(fraction.padEnd(6, '0').slice(3, 6));
}
export function compareBrowseListings(a: Listing, b: Listing, sort: BrowseSort) {
  if (sort !== 'neu') {
    const price = listingPrice(a).cents! - listingPrice(b).cents!;
    if (price) return sort === 'guenstig' ? price : -price;
  }
  return micros(b.created_at) - micros(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/** Two ordered streams share one cursor. Each contributes at most 31 candidates;
 * merging the first 30 keeps price order correct for both fixed and start prices.
 * The inner join excludes inaccessible/missing plans before the page limit.
 */
export async function fetchBrowsePage(input: BrowseFilters, cursor: Cursor, signal: AbortSignal): Promise<Page> {
  const filters = normalizeBrowseFilters(input);
  if (filters.slugs?.length === 0) return { rows: [], next: undefined };
  const statuses = filters.onlyShow ? ['scheduled'] as const : ['listed', 'scheduled'] as const;
  const batches = await Promise.all(statuses.map(async (status) => {
    const priceColumn = status === 'scheduled' ? 'start_price_cents' : 'buy_now_cents';
    const columns = status === 'scheduled'
      ? LISTING_COLUMNS.replace('!planned_for(', '!planned_for!inner(') : LISTING_COLUMNS;
    let query = supabase.from('live_auctions').select(columns).is('session_id', null).eq('status', status);
    if (status === 'listed') query = query.not('buy_now_cents', 'is', null);
    if (filters.slugs) query = query.in('category', filters.slugs);
    if (filters.condition) query = query.eq('condition', filters.condition);
    if (filters.size) query = query.filter('size', 'imatch', literalPattern(filters.size));
    if (filters.city) query = query.filter('city', 'imatch', literalPattern(filters.city));
    if (filters.maxPrice !== null) query = query.lte(priceColumn, filters.maxPrice);

    const logic: string[] = [];
    if (filters.query) {
      const pattern = quoted(literalPattern(filters.query));
      logic.push(`or(title.imatch.${pattern},size.imatch.${pattern},city.imatch.${pattern})`);
    }
    if (cursor) {
      const date = quoted(cursor.createdAt);
      const afterDate = `created_at.lt.${date},and(created_at.eq.${date},id.lt.${cursor.id})`;
      logic.push(filters.sort === 'neu' ? `or(${afterDate})`
        : `or(${priceColumn}.${filters.sort === 'guenstig' ? 'gt' : 'lt'}.${cursor.price},and(${priceColumn}.eq.${cursor.price},or(${afterDate})))`);
    }
    if (logic.length) query = query.or(`and(${logic.join(',')})`);
    if (filters.sort !== 'neu') query = query.order(priceColumn, { ascending: filters.sort === 'guenstig' });
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(PAGE_SIZE + 1).abortSignal(signal).retry(false);
    if (error) throw error;
    return (data ?? []) as unknown as Listing[];
  }));
  const candidates = batches.flat().sort((a, b) => compareBrowseListings(a, b, filters.sort));
  const rows = candidates.slice(0, PAGE_SIZE);
  const last = rows[rows.length - 1];
  return { rows, next: candidates.length > PAGE_SIZE && last
    ? { createdAt: last.created_at, id: last.id, price: listingPrice(last).cents! } : undefined };
}

function withListings(data: InfiniteData<Page, Cursor>) {
  const seen = new Set<string>();
  const listings = data.pages.flatMap(page => page.rows).filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return { ...data, listings };
}

export function useBrowseListingPages(filters: BrowseFilters, enabled = true, scope: 'shop' | 'category-listings' = 'shop') {
  const filterKey = JSON.stringify(normalizeBrowseFilters(filters));
  const settledKey = useDebounced(filterKey);
  const settled = useMemo(() => JSON.parse(settledKey) as BrowseFilters, [settledKey]);
  const isDebouncing = filterKey !== settledKey;
  const query = useInfiniteQuery({
    queryKey: ['berkat', scope, 'pages', settledKey],
    enabled: enabled && !isDebouncing && settled.slugs?.length !== 0,
    staleTime: 30_000,
    initialPageParam: null as Cursor,
    retry: (failures, error) => failures < 1 && (error as { code?: string }).code !== '42501',
    queryFn: ({ signal, pageParam }) => fetchBrowsePage(settled, pageParam, signal),
    getNextPageParam: last => last.next,
    select: withListings,
  });
  return { ...query, filterKey, isDebouncing,
    data: isDebouncing ? undefined : query.data,
    isLoading: isDebouncing || query.isLoading,
    isError: !isDebouncing && query.isError,
    isFetchNextPageError: !isDebouncing && query.isFetchNextPageError,
    hasNextPage: !isDebouncing && query.hasNextPage,
  };
}

import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExploreGrid, useExplorePostSearch, useExploreUserSearch, useTrendingTags, type ExploreSortMode } from '../useExplore';
import { useDiscoverPeople } from '../useDiscoverPeople';

// Execute filters before order/offset/limit, like PostgREST, against a local fixture.
type Row = Record<string, any>;
let mockTables: Record<string, Row[]>;
let mockViewer: { id: string; guild_id: string | null };
const mockBlocked = jest.fn();
const mockFrom = jest.fn((table: string) => {
  const filters: ((row: Row) => boolean)[] = [];
  const orders: { key: string; ascending: boolean }[] = [];
  let offset = 0, count = Infinity;
  const q = {
    select: () => q,
    eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q; },
    neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return q; },
    not: (key: string, operator: string, value: string | null) => {
      const excluded = operator === 'in' ? value!.slice(1, -1).split(',') : [];
      filters.push(row => operator === 'in' ? !excluded.includes(row[key]) : row[key] != null);
      return q;
    },
    contains: (key: string, values: string[]) => { filters.push(row => values.every(value => row[key]?.includes(value))); return q; },
    ilike: (key: string, value: string) => { filters.push(row => row[key]?.toLowerCase().includes(value.replaceAll('%', '').toLowerCase())); return q; },
    gte: (key: string, value: string) => { filters.push(row => row[key] >= value); return q; },
    order: (key: string, { ascending }: { ascending: boolean }) => { orders.push({ key, ascending }); return q; },
    range: (from: number, to: number) => { offset = from; count = to - from + 1; return q; },
    limit: (limit: number) => { count = limit; return q; },
    then: (resolve: (result: { data: Row[]; error: null }) => unknown) => {
      const rows = (mockTables[table] ?? []).filter(row => filters.every(filter => filter(row)));
      rows.sort((a, b) => {
        for (const { key, ascending } of orders) {
          if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      return Promise.resolve({ data: rows.slice(offset, offset + count), error: null }).then(resolve);
    },
  };
  return q;
});
jest.mock('../supabase', () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
jest.mock('../authStore', () => ({ useAuthStore: (selector?: (s: unknown) => unknown) => selector ? selector({ profile: mockViewer }) : { profile: mockViewer } }));
jest.mock('../useBlock', () => ({ getBlockedIdSet: (options: unknown) => mockBlocked(options) }));
let client: QueryClient;
function wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
const post = (id: string, author = 'friend', daysAgo = 0, score = 0, views = 0): Row => ({
  id, author_id: author, caption: 'Nature', tags: ['nature'], media_url: 'image.jpg', media_type: 'image',
  created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(), dwell_time_score: score, view_count: views,
  profiles: { id: author, username: author, avatar_url: null, bio: null },
});
beforeEach(() => {
  jest.clearAllMocks();
  mockViewer = { id: 'viewer', guild_id: null };
  mockTables = { posts: [], profiles: [], follows: [] };
  mockBlocked.mockResolvedValue(new Set(['blocked-outgoing', 'blocked-incoming']));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it('finds a lower-case stored tag when the user selects its capitalized chip', async () => {
  mockTables.posts = [post('nature-photo')];
  const tags = renderHook(() => useTrendingTags(), { wrapper });
  await waitFor(() => expect(tags.result.current.data).toEqual(['Nature']));
  const grid = renderHook(() => useExploreGrid(` ${tags.result.current.data![0]} `, 'newest'), { wrapper });
  await waitFor(() => expect(grid.result.current.isSuccess).toBe(true));
  expect(grid.result.current.data?.pages[0].map(row => row.id)).toEqual(['nature-photo']);
});

it('excludes both block directions before pagination without hiding later visible posts', async () => {
  mockTables.posts = [
    ...Array.from({ length: 30 }, (_, i) => post(`blocked-${i}`, i % 2 ? 'blocked-outgoing' : 'blocked-incoming', 0, 100)),
    ...Array.from({ length: 31 }, (_, i) => post(`visible-${i}`, 'friend', 1, 1)),
  ];
  const grid = renderHook(() => useExploreGrid(null, 'forYou'), { wrapper });
  await waitFor(() => expect(grid.result.current.isSuccess).toBe(true));
  expect(grid.result.current.data?.pages[0]).toHaveLength(30);
  expect(grid.result.current.hasNextPage).toBe(true);
  await act(async () => { await grid.result.current.fetchNextPage(); });
  await waitFor(() => expect(grid.result.current.data?.pages.flat()).toHaveLength(31));
  const rows = grid.result.current.data!.pages.flat();
  expect(rows).toHaveLength(31);
  expect(rows.every(row => row.author_id === 'friend')).toBe(true);
  expect(new Set(rows.map(row => row.id)).size).toBe(31);
});

it('changes search results for every selected sort mode and excludes blocked authors', async () => {
  mockTables.posts = [post('old', 'friend', 30, 100, 500), post('new', 'friend', 1, 1, 3), post('popular', 'friend', 2, 10, 90), post('blocked', 'blocked-incoming', 0, 1000, 1000)];
  const search = renderHook(({ mode }: { mode: ExploreSortMode }) => useExplorePostSearch('nature', mode), { wrapper, initialProps: { mode: 'forYou' } });
  await waitFor(() => expect(search.result.current.data?.map(row => row.id)).toEqual(['old', 'popular', 'new']));
  search.rerender({ mode: 'newest' });
  await waitFor(() => expect(search.result.current.data?.map(row => row.id)).toEqual(['new', 'popular', 'old']));
  search.rerender({ mode: 'trending' });
  await waitFor(() => expect(search.result.current.data?.map(row => row.id)).toEqual(['popular', 'new']));
});

it('does not let blocked profiles consume the limited people-search results', async () => {
  mockTables.profiles = [
    { id: 'blocked-incoming', username: 'amir-blocked' }, { id: 'blocked-outgoing', username: 'amir-hidden' },
    { id: 'friend', username: 'amir-visible' },
  ];
  const search = renderHook(() => useExploreUserSearch('amir'), { wrapper });
  await waitFor(() => expect(search.result.current.isSuccess).toBe(true));
  expect(search.result.current.data?.map(row => row.id)).toEqual(['friend']);
});

it('filters blocked accounts from guild, interest and new-user recommendations', async () => {
  mockViewer.guild_id = 'clan';
  mockTables.profiles = [
    { id: 'blocked-outgoing', username: 'blocked', guild_id: 'clan' },
    { id: 'blocked-incoming', username: 'hidden', guild_id: 'clan' },
    { id: 'guild-friend', username: 'friend', guild_id: 'clan' },
    { id: 'new-friend', username: 'new', guild_id: null },
  ];
  mockTables.posts = [post('own', 'viewer'), post('blocked', 'blocked-incoming'), post('interest', 'interest-friend')];
  const people = renderHook(() => useDiscoverPeople(), { wrapper });
  await waitFor(() => expect(people.result.current.isSuccess).toBe(true));
  expect(people.result.current.data?.map(row => [row.id, row.reason])).toEqual([
    ['guild-friend', 'guild'], ['interest-friend', 'interests'], ['new-friend', 'new'],
  ]);
});

it('reports an unavailable block list instead of loading unfiltered discovery content', async () => {
  mockBlocked.mockRejectedValue(new Error('Block list unavailable'));
  const grid = renderHook(() => useExploreGrid(null, 'newest'), { wrapper });
  await waitFor(() => expect(grid.result.current.isError).toBe(true));
  expect(grid.result.current.data).toBeUndefined();
  expect(mockFrom).not.toHaveBeenCalled();
});

it('does not reuse another signed-in account’s discovery query', async () => {
  mockTables.posts = [post('first-account')];
  const grid = renderHook(() => useExploreGrid(null, 'newest'), { wrapper });
  await waitFor(() => expect(grid.result.current.data?.pages[0][0]?.id).toBe('first-account'));
  mockViewer = { id: 'another-viewer', guild_id: null };
  mockTables.posts = [post('second-account')];
  grid.rerender({});
  await waitFor(() => expect(grid.result.current.data?.pages[0][0]?.id).toBe('second-account'));
  expect(mockBlocked).toHaveBeenCalledWith({ userId: 'another-viewer', strict: true });
});

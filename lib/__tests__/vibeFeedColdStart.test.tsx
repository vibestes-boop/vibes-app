import React, { type PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { trimInfiniteToFirstPage, useFreshVibeFeedAfterColdStart, vibeFeedKey, type PostWithAuthor } from '../usePosts';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock('../authStore', () => ({ useAuthStore: (selector: (s: unknown) => unknown) => selector({ profile: { id: 'viewer' } }) }));
jest.mock('../store', () => ({ useVibeStore: (selector: (s: unknown) => unknown) => selector({ committedExplore: 0.5, committedBrain: 0.5 }) }));
jest.mock('../useBlock', () => ({ getBlockedIdSet: () => Promise.resolve(new Set<string>()) }));

type Data = InfiniteData<PostWithAuthor[], string[]>;
const post = (id: string) => ({ id, author_id: `a-${id}` }) as PostWithAuthor;
const KEY = vibeFeedKey(0.5, 0.5, null);

let client: QueryClient;
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function seed(ageMs: number): Data {
  const data: Data = { pages: [[post('head'), post('old-2')], [post('old-3')]], pageParams: [[], ['head', 'old-2']] };
  client.setQueryData(KEY, data, { updatedAt: Date.now() - ageMs });
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it('setzt nach einem Kaltstart frische Beiträge hinter das laufende Video', async () => {
  const data = seed(10 * 60_000);
  mockRpc.mockResolvedValue({ data: [post('new-1'), post('head'), post('new-2')], error: null });
  renderHook(() => useFreshVibeFeedAfterColdStart(null, data, () => true), { wrapper });
  await waitFor(() => expect(client.getQueryData<Data>(KEY)?.pages[0].map((p) => p.id)).toEqual(['head', 'new-1', 'new-2']));
  expect(client.getQueryData<Data>(KEY)?.pages).toHaveLength(1);
  expect(mockRpc).toHaveBeenCalledWith('get_vibe_feed', expect.objectContaining({ exclude_ids: ['head'] }));
});

it('lässt einen frischen Feed in Ruhe', async () => {
  const data = seed(5_000);
  renderHook(() => useFreshVibeFeedAfterColdStart(null, data, () => true), { wrapper });
  await new Promise((r) => setTimeout(r, 20));
  expect(mockRpc).not.toHaveBeenCalled();
});

it('tauscht nichts, wenn der Nutzer schon weitergewischt hat', async () => {
  const data = seed(10 * 60_000);
  mockRpc.mockResolvedValue({ data: [post('new-1')], error: null });
  renderHook(() => useFreshVibeFeedAfterColdStart(null, data, () => false), { wrapper });
  await waitFor(() => expect(mockRpc).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  expect(client.getQueryData<Data>(KEY)).toBe(data);
});

it('behält beim Neuladen von oben nur die erste Seite', () => {
  seed(0);
  trimInfiniteToFirstPage(client, ['vibe-feed']);
  const after = client.getQueryData<Data>(KEY);
  expect(after?.pages.map((p) => p.map((x) => x.id))).toEqual([['head', 'old-2']]);
  expect(after?.pageParams).toEqual([[]]);
});

import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFollowingFeed } from '../usePosts';
import { useFollow } from '../useFollow';

const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock('../authStore', () => ({ useAuthStore: (selector: (s: unknown) => unknown) => selector({ profile: { id: 'viewer' } }) }));
jest.mock('../store', () => ({ useVibeStore: jest.fn() }));
jest.mock('../useBlock', () => ({ getBlockedIdSet: jest.fn() }));

let client: QueryClient;
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it('reports a failed follow-list request as an error, not an empty feed', async () => {
  const failure = new Error('Follow list unavailable');
  mockFrom.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: null, error: failure }) }) });
  const hook = renderHook(() => useFollowingFeed(), { wrapper });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toBe(failure);
  expect(hook.result.current.data).toBeUndefined();
  expect(mockFrom.mock.calls.every(([table]) => table === 'follows')).toBe(true);
});

it('returns an empty feed when the successfully loaded follow list is empty', async () => {
  mockFrom.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) });
  const hook = renderHook(() => useFollowingFeed(), { wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data?.pages).toEqual([[]]);
  expect(mockFrom).toHaveBeenCalledTimes(1);
  expect(mockFrom).toHaveBeenCalledWith('follows');
});

it('only requests visible posts from followed authors in chronological order', async () => {
  const post = { id: 'post-1', author_id: 'followed-author', media_type: 'image', profiles: { username: 'friend', avatar_url: null } };
  const query: Record<string, any> = {};
  for (const method of ['select', 'is', 'in', 'eq', 'order']) query[method] = jest.fn(() => query);
  query.limit = jest.fn(() => Promise.resolve({ data: [post], error: null }));
  mockFrom.mockImplementation(table => table === 'follows'
    ? { select: () => ({ eq: () => Promise.resolve({ data: [{ following_id: 'followed-author' }], error: null }) }) }
    : query);
  const hook = renderHook(() => useFollowingFeed(), { wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(query.in).toHaveBeenCalledWith('author_id', ['followed-author']);
  expect(query.eq).toHaveBeenCalledWith('is_visible', true);
  expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  expect(hook.result.current.data?.pages[0][0].username).toBe('friend');
});

it.each([false, true])('refreshes the following feed only after the %s follow-state mutation has settled', async wasFollowing => {
  let finishRequest!: (value: { error: null }) => void;
  const request = new Promise<{ error: null }>(resolve => { finishRequest = resolve; });
  const insert = jest.fn(() => request);
  const deletion = { eq: jest.fn() };
  deletion.eq.mockReturnValueOnce(deletion).mockReturnValueOnce(request);
  mockFrom.mockReturnValue({ insert, delete: () => deletion });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useFollow('author', wasFollowing), { wrapper });
  act(() => hook.result.current.toggle());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
  expect(invalidate).not.toHaveBeenCalled();
  await act(async () => { finishRequest({ error: null }); });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['following-feed', 'viewer'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['discover-people', 'viewer'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['follow-counts', 'viewer'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['following', 'viewer'] });
});

import React, { type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearBlockedIdCache, getBlockedIdSet, useBlockUser } from '../useBlock';
const mockRpc = jest.fn();
let mockViewer: { id: string } | null = { id: 'viewer' };
jest.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock('../authStore', () => ({ useAuthStore: Object.assign((selector: (s: unknown) => unknown) => selector({ profile: mockViewer }), { getState: () => ({ profile: mockViewer }) }) }));
let client: QueryClient;
function wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  jest.clearAllMocks(); clearBlockedIdCache(); mockViewer = { id: 'viewer' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());
it('does not reuse a cached block list after an account switch or logout', async () => {
  mockRpc.mockResolvedValueOnce({ data: [{ user_id: 'first-blocked' }], error: null }).mockResolvedValueOnce({ data: [{ user_id: 'second-blocked' }], error: null });
  expect(await getBlockedIdSet()).toEqual(new Set(['first-blocked']));
  mockViewer = { id: 'second-viewer' };
  expect(await getBlockedIdSet()).toEqual(new Set(['second-blocked']));
  mockViewer = null;
  expect(await getBlockedIdSet()).toEqual(new Set());
  expect(mockRpc).toHaveBeenCalledTimes(2);
});
it('propagates RPC errors for strict reads without caching an empty block list', async () => {
  const failure = new Error('Unavailable');
  mockRpc.mockResolvedValueOnce({ data: null, error: failure }).mockResolvedValueOnce({ data: [{ user_id: 'blocked' }], error: null });
  await expect(getBlockedIdSet({ strict: true })).rejects.toBe(failure);
  expect(await getBlockedIdSet({ strict: true })).toEqual(new Set(['blocked']));
});
it('does not let an old in-flight request repopulate the cache after a block', async () => {
  let finish!: (result: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ data: [{ user_id: 'new-block' }], error: null });
  const pending = getBlockedIdSet();
  clearBlockedIdCache();
  finish({ data: [], error: null });
  await pending;
  expect(await getBlockedIdSet()).toEqual(new Set(['new-block']));
  expect(mockRpc).toHaveBeenCalledTimes(2);
});
it.each(['block', 'unblock'] as const)('does not report a failed %s as successful', async operation => {
  const failure = new Error('Server rejected action');
  mockRpc.mockResolvedValue({ error: failure });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useBlockUser('target'), { wrapper });
  await act(async () => { await expect(hook.result.current[operation].mutateAsync()).rejects.toBe(failure); });
  expect(client.getQueryData(['block-status', 'viewer', 'target'])).toBeUndefined();
  expect(invalidate).not.toHaveBeenCalled();
});
it.each(['block', 'unblock'] as const)('refreshes all affected discovery lists after a successful %s', async operation => {
  mockRpc.mockResolvedValue({ error: null });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useBlockUser('target'), { wrapper });
  await act(async () => { await hook.result.current[operation].mutateAsync(); });
  expect(client.getQueryData(['block-status', 'viewer', 'target'])).toBe(operation === 'block');
  for (const key of ['explore-grid', 'post-search', 'user-search', 'discover-people', 'trending-tags', 'vibe-feed', 'following-feed']) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
  }
});

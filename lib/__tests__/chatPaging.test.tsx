import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MESSAGES_PAGE, useMessages, useOlderMessages, type Message } from '../useMessages';

type Call = { method: string; args: unknown[] };
let calls: Call[] = [];
let nextResult: { data: unknown[]; error: null } = { data: [], error: null };
function mockBuilder() {
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'lt']) {
    b[method] = (...args: unknown[]) => { calls.push({ method, args }); return b; };
  }
  b.then = (resolve: (v: unknown) => void) => resolve(nextResult);
  return b;
}
jest.mock('../supabase', () => ({
  supabase: {
    from: () => mockBuilder(),
    channel: () => ({ on: function on() { return this; }, subscribe: function subscribe() { return this; } }),
    removeChannel: () => {},
  },
}));
jest.mock('../authStore', () => ({ useAuthStore: (selector: (s: unknown) => unknown) => selector({ profile: { id: 'me' } }) }));
jest.mock('../useBlock', () => ({ getBlockedIdSet: () => Promise.resolve(new Set<string>()) }));

// Zeitstempel absteigend, wie die Abfrage sie liefert (neueste zuerst)
const row = (n: number) => ({ id: `m${n}`, conversation_id: 'c1', sender_id: 'me', content: `#${n}`, created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, n)).toISOString(), post: null });
const desc = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => row(from - i));

let client: QueryClient;
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  calls = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it('lädt nur die letzten Nachrichten und hält sie alt → neu', async () => {
  nextResult = { data: desc(120, 71), error: null }; // 50 neueste
  const hook = renderHook(() => useMessages('c1'), { wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(calls).toContainEqual({ method: 'order', args: ['created_at', { ascending: false }] });
  expect(calls).toContainEqual({ method: 'limit', args: [MESSAGES_PAGE] });
  const ids = (hook.result.current.data ?? []).map((m) => m.id);
  expect(ids[0]).toBe('m71');
  expect(ids[ids.length - 1]).toBe('m120');
});

it('lädt beim Hochscrollen ältere nach und stellt sie davor', async () => {
  client.setQueryData<Message[]>(['messages', 'c1'], desc(120, 71).reverse() as unknown as Message[]);
  nextResult = { data: desc(70, 21), error: null };
  const hook = renderHook(() => useOlderMessages('c1'), { wrapper });
  await act(async () => { await hook.result.current.fetchOlder(); });
  expect(calls).toContainEqual({ method: 'lt', args: ['created_at', row(71).created_at] });
  const ids = (client.getQueryData<Message[]>(['messages', 'c1']) ?? []).map((m) => m.id);
  expect(ids).toHaveLength(100);
  expect(ids[0]).toBe('m21');
  expect(ids[50]).toBe('m71');
});

it('fragt nicht nach, wenn weniger als eine Seite da ist', async () => {
  client.setQueryData<Message[]>(['messages', 'c1'], desc(10, 1).reverse() as unknown as Message[]);
  const hook = renderHook(() => useOlderMessages('c1'), { wrapper });
  await act(async () => { await hook.result.current.fetchOlder(); });
  expect(calls).toHaveLength(0);
});

it('behält beim Neuladen alle schon geladenen Nachrichten', async () => {
  client.setQueryData<Message[]>(['messages', 'c1'], desc(120, 21).reverse() as unknown as Message[]);
  nextResult = { data: desc(121, 21), error: null };
  const hook = renderHook(() => useMessages('c1'), { wrapper });
  await act(async () => { await hook.result.current.refetch(); });
  expect(calls).toContainEqual({ method: 'limit', args: [100] });
});

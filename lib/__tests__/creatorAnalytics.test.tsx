/**
 * creatorAnalytics.test.tsx — „Ø pro Post" und Engagement-Rate im Analytics-Tab.
 *
 * Bis 14.10.2026 teilte der Tab die Aufrufe des Zeitraums durch die Zahl der
 * angezeigten Top-Beiträge (höchstens 8) — eine falsche Menge. Der Teiler muss
 * dieselbe Menge sein, über die get_creator_overview total_views summiert: die
 * eigenen Beiträge mit created_at im Zeitraum. Deshalb prüft dieser Test nicht
 * nur die Rechnung, sondern auch, WOHER der Teiler kommt.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// -----------------------------------------------------------------------------
// Mocks — vor den SUT-Imports.
// -----------------------------------------------------------------------------
const mockPostsQuery = {
  result: { count: 0 as number | null, error: null as unknown },
  calls: [] as [string, ...unknown[]][],
};

jest.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte']) {
    chain[m] = jest.fn((...args: unknown[]) => { mockPostsQuery.calls.push([m, ...args]); return chain; });
  }
  (chain as { then: unknown }).then = (cb: (r: unknown) => unknown) =>
    Promise.resolve(mockPostsQuery.result).then(cb);
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(() => chain),
    },
  };
});

import { supabase } from '@/lib/supabase';
import {
  avgViewsPerPost,
  postEngagementRate,
  useCreatorOverview,
} from '@/lib/useAnalytics';

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;

const NOW = Date.parse('2026-10-14T12:00:00.000Z');

function renderOverview(days: 7 | 28 = 28) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCreatorOverview('me-1', days), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockPostsQuery.calls = [];
  mockPostsQuery.result = { count: 0, error: null };
  rpc.mockResolvedValue({
    data: [{ total_views: 1000, total_likes: 30, total_comments: 10, total_followers: 5 }],
    error: null,
  });
});

afterEach(() => jest.restoreAllMocks());

describe('useCreatorOverview — Ø pro Post', () => {
  it('teilt total_views durch die eigenen Beiträge im Zeitraum', async () => {
    mockPostsQuery.result = { count: 40, error: null };
    const { result } = renderOverview(28);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith('get_creator_overview', { p_user_id: 'me-1', p_days: 28 });
    expect(result.current.data?.posts_in_period).toBe(40);
    expect(result.current.data?.avg_views_per_post).toBe(25);   // 1000 / 40
  });

  it('zählt genau die Menge, über die get_creator_overview summiert', async () => {
    mockPostsQuery.result = { count: 3, error: null };
    const { result } = renderOverview(7);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(from).toHaveBeenCalledWith('posts');
    expect(mockPostsQuery.calls).toEqual([
      ['select', 'id', { count: 'exact', head: true }],     // nur zählen, keine Zeilen laden
      ['eq', 'author_id', 'me-1'],
      ['gte', 'created_at', new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString()],
    ]);
  });

  it('ohne Beiträge im Zeitraum: 0 statt Division durch 0', async () => {
    mockPostsQuery.result = { count: 0, error: null };
    const { result } = renderOverview();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.avg_views_per_post).toBe(0);
  });

  it('Zählung fehlgeschlagen: Übersicht bleibt da, Ø ist unbekannt (null)', async () => {
    mockPostsQuery.result = { count: null, error: { code: '42501', message: 'nope' } };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderOverview();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(warn).toHaveBeenCalledWith('[useCreatorOverview] posts count failed', expect.anything());

    expect(result.current.data?.total_views).toBe(1000);
    expect(result.current.data?.posts_in_period).toBeNull();
    expect(result.current.data?.avg_views_per_post).toBeNull();
  });

  it('RPC-Fehler bleibt ein Fehler (wie bisher)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Kein Zugriff' } });
    const { result } = renderOverview();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('avgViewsPerPost', () => {
  it('rundet und kennt „unbekannt"', () => {
    expect(avgViewsPerPost(1000, 3)).toBe(333);
    expect(avgViewsPerPost(1000, 0)).toBe(0);
    expect(avgViewsPerPost(1000, null)).toBeNull();
  });
});

describe('postEngagementRate', () => {
  it('(Likes + Kommentare) ÷ Aufrufe in Prozent', () => {
    expect(postEngagementRate({ view_count: 100, like_count: 2, comment_count: 1 })).toBe(3);
    expect(postEngagementRate({ view_count: 50, like_count: 3, comment_count: 2 })).toBe(10);
  });

  it('ohne Aufrufe 0 statt Division durch 0', () => {
    expect(postEngagementRate({ view_count: 0, like_count: 5, comment_count: 1 })).toBe(0);
  });
});

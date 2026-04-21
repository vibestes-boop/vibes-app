/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { FeedPost } from '@/lib/data/feed';
import { createTestQueryClient } from '@/test-utils/query-client';
import { makeFeedPost, resetFeedPostCounter } from '@/test-utils/feed-post-factory';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock der Server-Action-Module — wir kontrollieren Resolve/Reject.
jest.mock('@/app/actions/engagement', () => ({
  togglePostLike: jest.fn(),
  togglePostBookmark: jest.fn(),
  toggleFollow: jest.fn(),
  createComment: jest.fn(),
}));

// Mock sonner/toast — wir wollen Toast-Calls beobachten, nicht das DOM-
// Overlay testen.
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import {
  togglePostLike,
  togglePostBookmark,
  toggleFollow,
} from '@/app/actions/engagement';
import { toast } from 'sonner';
import {
  useTogglePostLike,
  useTogglePostSave,
  useToggleFollow,
} from '../use-engagement';

const mockTogglePostLike = togglePostLike as jest.MockedFunction<typeof togglePostLike>;
const mockTogglePostBookmark = togglePostBookmark as jest.MockedFunction<typeof togglePostBookmark>;
const mockToggleFollow = toggleFollow as jest.MockedFunction<typeof toggleFollow>;

// -----------------------------------------------------------------------------
// Test-Helper: Wrapper mit pre-populated QueryClient, damit wir den
// Pre-Mutation Cache-State kontrolliert setzen können. `seedCaches` befüllt
// sowohl ['feed', 'foryou'] als auch ['feed', 'following'] — Partial-Match-
// Pattern in `use-engagement` muss beide treffen.
// -----------------------------------------------------------------------------

function setupClient(seed: { foryou?: FeedPost[]; following?: FeedPost[] } = {}) {
  const client = createTestQueryClient();
  if (seed.foryou) client.setQueryData(['feed', 'foryou'], seed.foryou);
  if (seed.following) client.setQueryData(['feed', 'following'], seed.following);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  resetFeedPostCounter();
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------------
// useTogglePostLike
// -----------------------------------------------------------------------------

describe('useTogglePostLike', () => {
  it('commits optimistic like into BOTH feed caches (partial-match)', async () => {
    const postA = makeFeedPost({ id: 'p-A', liked_by_me: false, like_count: 10 });
    // Derselbe Post p-A taucht in Following auf — muss synchron geflippt werden.
    const { client, wrapper } = setupClient({
      foryou: [postA, makeFeedPost({ id: 'p-other' })],
      following: [{ ...postA }],
    });

    mockTogglePostLike.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    const { result } = renderHook(() => useTogglePostLike(), { wrapper });

    result.current.mutate({ postId: 'p-A', liked: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const foryou = client.getQueryData<FeedPost[]>(['feed', 'foryou'])!;
    const following = client.getQueryData<FeedPost[]>(['feed', 'following'])!;

    expect(foryou.find((p) => p.id === 'p-A')).toMatchObject({
      liked_by_me: true,
      like_count: 11,
    });
    expect(following.find((p) => p.id === 'p-A')).toMatchObject({
      liked_by_me: true,
      like_count: 11,
    });
    // Andere Posts bleiben unberührt.
    expect(foryou.find((p) => p.id === 'p-other')).toMatchObject({
      liked_by_me: false,
    });
  });

  it('rolls back cache on server-side reject', async () => {
    const post = makeFeedPost({ id: 'p-1', liked_by_me: false, like_count: 5 });
    const { client, wrapper } = setupClient({ foryou: [post] });

    mockTogglePostLike.mockResolvedValueOnce({ ok: false, error: 'Not authorized' });

    const { result } = renderHook(() => useTogglePostLike(), { wrapper });

    result.current.mutate({ postId: 'p-1', liked: false });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const foryou = client.getQueryData<FeedPost[]>(['feed', 'foryou'])!;
    expect(foryou[0]).toMatchObject({
      liked_by_me: false,
      like_count: 5,
    });
    expect(toast.error).toHaveBeenCalledWith('Not authorized');
  });

  it('decrements like_count and unflips flag when unliking', async () => {
    const post = makeFeedPost({ id: 'p-1', liked_by_me: true, like_count: 42 });
    const { client, wrapper } = setupClient({ foryou: [post] });

    mockTogglePostLike.mockResolvedValueOnce({ ok: true, data: { liked: false } });

    const { result } = renderHook(() => useTogglePostLike(), { wrapper });

    result.current.mutate({ postId: 'p-1', liked: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const foryou = client.getQueryData<FeedPost[]>(['feed', 'foryou'])!;
    expect(foryou[0]).toMatchObject({
      liked_by_me: false,
      like_count: 41,
    });
  });
});

// -----------------------------------------------------------------------------
// useTogglePostSave
// -----------------------------------------------------------------------------

describe('useTogglePostSave', () => {
  it('flips saved_by_me optimistically across both caches', async () => {
    const post = makeFeedPost({ id: 'p-S', saved_by_me: false });
    const { client, wrapper } = setupClient({
      foryou: [post],
      following: [{ ...post }],
    });

    mockTogglePostBookmark.mockResolvedValueOnce({ ok: true, data: { saved: true } });

    const { result } = renderHook(() => useTogglePostSave(), { wrapper });

    result.current.mutate({ postId: 'p-S', saved: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.getQueryData<FeedPost[]>(['feed', 'foryou'])![0].saved_by_me).toBe(true);
    expect(client.getQueryData<FeedPost[]>(['feed', 'following'])![0].saved_by_me).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Gespeichert');
  });

  it('rolls back on reject, keeps saved flag unchanged', async () => {
    const post = makeFeedPost({ id: 'p-S', saved_by_me: true });
    const { client, wrapper } = setupClient({ foryou: [post] });

    mockTogglePostBookmark.mockResolvedValueOnce({ ok: false, error: 'db down' });

    const { result } = renderHook(() => useTogglePostSave(), { wrapper });

    result.current.mutate({ postId: 'p-S', saved: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(client.getQueryData<FeedPost[]>(['feed', 'foryou'])![0].saved_by_me).toBe(true);
    expect(toast.error).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// useToggleFollow
// -----------------------------------------------------------------------------

describe('useToggleFollow', () => {
  it('flips following_author for ALL posts of the same author across caches', async () => {
    // Derselbe Author hat zwei Posts in For-You, einen in Following.
    // Mutation muss alle drei treffen.
    const author = {
      id: 'author-1',
      username: 'a',
      display_name: null,
      avatar_url: null,
      verified: false,
    };
    const a1 = makeFeedPost({ id: 'a1', author, following_author: false });
    const a2 = makeFeedPost({ id: 'a2', author, following_author: false });
    const a3 = makeFeedPost({ id: 'a3', author, following_author: false });
    const unrelated = makeFeedPost({ id: 'u', following_author: false });

    const { client, wrapper } = setupClient({
      foryou: [a1, a2, unrelated],
      following: [a3],
    });

    mockToggleFollow.mockResolvedValueOnce({ ok: true, data: { following: true } });

    const { result } = renderHook(() => useToggleFollow(), { wrapper });

    result.current.mutate({ userId: 'author-1', following: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const foryou = client.getQueryData<FeedPost[]>(['feed', 'foryou'])!;
    const following = client.getQueryData<FeedPost[]>(['feed', 'following'])!;

    expect(foryou.filter((p) => p.author.id === 'author-1').every((p) => p.following_author)).toBe(true);
    expect(following[0].following_author).toBe(true);
    // Unrelated Autor unberührt.
    expect(foryou.find((p) => p.id === 'u')!.following_author).toBe(false);
  });
});

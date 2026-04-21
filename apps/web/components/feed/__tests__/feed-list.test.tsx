/**
 * @jest-environment jsdom
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FeedPost } from '@/lib/data/feed';
import { createTestQueryClient } from '@/test-utils/query-client';
import { makeFeedPost, resetFeedPostCounter } from '@/test-utils/feed-post-factory';

// FeedCard wird zu einem thin Stub — wir testen FeedList-Cache-Verhalten,
// nicht das Rendering des Video-Players. Das spart auch den HLS/Video-Mock.
jest.mock('../feed-card', () => ({
  FeedCard: ({ post }: { post: { id: string; caption?: string | null } }) => (
    <div data-testid="feed-card" data-post-id={post.id}>
      {post.caption ?? ''}
    </div>
  ),
}));

// use-engagement nur als Mock — FeedList importiert useTogglePostLike
// für Keyboard-Shortcut "L", aber der Mutation-Flow ist nicht Gegenstand
// dieses Tests.
jest.mock('@/hooks/use-engagement', () => ({
  useTogglePostLike: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));

import { FeedList } from '../feed-list';

beforeEach(() => {
  resetFeedPostCounter();
});

// -----------------------------------------------------------------------------
// Regression-Test für den v1.27.5-Cache-Collision-Bug (shared queryKey).
// Zwei FeedList-Instanzen mit unterschiedlichen feedKeys dürfen sich nicht
// überschreiben.
// -----------------------------------------------------------------------------

describe('FeedList — cache isolation per feedKey', () => {
  it('writes ForYou and Following posts into SEPARATE query caches', () => {
    const forYouPosts = [
      makeFeedPost({ id: 'fy-1' }),
      makeFeedPost({ id: 'fy-2' }),
    ];
    const followingPosts = [makeFeedPost({ id: 'f-1' })];

    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    render(
      <>
        <FeedList initialPosts={forYouPosts} viewerId="viewer-1" feedKey="foryou" />
        <FeedList initialPosts={followingPosts} viewerId="viewer-1" feedKey="following" />
      </>,
      { wrapper },
    );

    const foryouCache = client.getQueryData<FeedPost[]>(['feed', 'foryou']);
    const followingCache = client.getQueryData<FeedPost[]>(['feed', 'following']);

    expect(foryouCache).toHaveLength(2);
    expect(foryouCache!.map((p) => p.id)).toEqual(['fy-1', 'fy-2']);
    expect(followingCache).toHaveLength(1);
    expect(followingCache![0].id).toBe('f-1');
  });

  it('defaults feedKey to "foryou" when prop is omitted', () => {
    const posts = [makeFeedPost({ id: 'default-1' })];
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    render(<FeedList initialPosts={posts} viewerId={null} />, { wrapper });

    expect(client.getQueryData<FeedPost[]>(['feed', 'foryou'])).toHaveLength(1);
    expect(client.getQueryData<FeedPost[]>(['feed', 'following'])).toBeUndefined();
  });

  it('renders empty state when initialPosts is []', () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    render(<FeedList initialPosts={[]} viewerId={null} feedKey="following" />, { wrapper });

    // Empty-State-Text aus feed-list.tsx (Zeile ~200).
    expect(screen.getByText(/Noch nichts in deinem Feed/i)).toBeInTheDocument();
    // Kein FeedCard gerendert.
    expect(screen.queryAllByTestId('feed-card')).toHaveLength(0);
  });
});

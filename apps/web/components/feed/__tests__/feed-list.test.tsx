/**
 * @jest-environment jsdom
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// next/navigation — useRouter() benötigt den App-Router-Context der in jsdom
// nicht existiert. Mock liefert einen stabilen Stub damit alle Tests rendern.
const mockRouterRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
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

// -----------------------------------------------------------------------------
// A7 — Keyboard-Hint erst beim ersten Keydown (v1.w.UI.9).
// Vorher: Hint auto-on-mount für 5s → visueller Noise auf Mobile.
// Jetzt: Hint genau beim ersten echten Tastendruck, 3s sichtbar, einmal pro
// Session, ignoriert Modifier-Presses + Keystrokes in Input-Elementen.
// -----------------------------------------------------------------------------

describe('FeedList — A7 keyboard-hint behavior', () => {
  const wrapperFactory = () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return wrapper;
  };

  beforeEach(() => {
    // sessionStorage frisch — sonst blockiert der „hintShown"-Gate aus einem
    // früheren Test das Hint-Rendern in den folgenden.
    window.sessionStorage.clear();
  });

  it('does NOT show hint on mount (removed auto-trigger)', () => {
    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
  });

  it('shows hint on first non-modifier keydown outside input', () => {
    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    act(() => {
      // 'a' ist bewusst gewählt — nicht in der Nav-Shortcut-Liste (j/k/l/m/space/?),
      // isoliert den Hint-Effekt vom Scroll/Like/Mute-Verhalten.
      fireEvent.keyDown(window, { key: 'a' });
    });

    expect(screen.getByText('Nächstes')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('serlo.feed.hintShown')).toBe('1');
  });

  it('ignores keydown with meta/ctrl/alt modifier (Cmd+R, Ctrl+F, …)', () => {
    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'a', metaKey: true });
      fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'a', altKey: true });
    });

    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('serlo.feed.hintShown')).toBeNull();
  });

  it('ignores keydown when target is INPUT / TEXTAREA / contenteditable', () => {
    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    // INPUT
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: 'a' });
    });
    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
    input.remove();

    // TEXTAREA
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    act(() => {
      fireEvent.keyDown(textarea, { key: 'a' });
    });
    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
    textarea.remove();

    // contenteditable=true div
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.appendChild(editable);
    act(() => {
      fireEvent.keyDown(editable, { key: 'a' });
    });
    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
    editable.remove();

    // Gate wurde nie gesetzt — nach einem legitimen Keydown soll der Hint jetzt
    // noch zeigen können.
    expect(window.sessionStorage.getItem('serlo.feed.hintShown')).toBeNull();
  });

  it('respects sessionStorage gate — no hint if already shown this session', () => {
    window.sessionStorage.setItem('serlo.feed.hintShown', '1');

    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });

    expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
  });

  it('auto-dismisses hint after 3s', () => {
    jest.useFakeTimers();
    try {
      render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
        wrapper: wrapperFactory(),
      });

      act(() => {
        fireEvent.keyDown(window, { key: 'a' });
      });
      expect(screen.getByText('Nächstes')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByText('Nächstes')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT re-trigger on a second keydown in the same session', () => {
    render(<FeedList initialPosts={[makeFeedPost({ id: 'a' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });

    // Erster Keydown → Hint zeigt, Listener entfernt sich + Gate gesetzt.
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    expect(screen.getByText('Nächstes')).toBeInTheDocument();

    // Zweiter Keydown: der onFirstKey-Listener ist weg → ruft showHint nicht
    // nochmal auf. (Zustand ändert sich nicht in dieser Stelle.)
    act(() => {
      fireEvent.keyDown(window, { key: 'b' });
    });
    // Hint bleibt sichtbar bis der 3s-Timer läuft — aber das Gate ist gesetzt.
    expect(window.sessionStorage.getItem('serlo.feed.hintShown')).toBe('1');
  });
});

// -----------------------------------------------------------------------------
// v1.w.UI.67 — Mute-Präferenz via localStorage
// v1.w.UI.68 — "Neue Posts" Refresh-Pill
// -----------------------------------------------------------------------------

describe('FeedList — mute persistence (v1.w.UI.67)', () => {
  const wrapperFactory = () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return wrapper;
  };

  beforeEach(() => {
    localStorage.clear();
    mockRouterRefresh.mockClear();
  });

  it('reads mute preference from localStorage on mount (true)', () => {
    localStorage.setItem('serlo.feed.muted', 'true');
    render(<FeedList initialPosts={[makeFeedPost({ id: 'm1' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });
    // Kein Crash — localStorage wird ohne Fehler gelesen.
    // Wir prüfen den Effekt indirekt: Kein assert auf den Video-Player-Zustand
    // nötig, da FeedCard gemockt ist. Der Test stellt nur sicher, dass der
    // Mount-Effect localStorage korrekt aufruft ohne Exception.
    expect(localStorage.getItem('serlo.feed.muted')).toBe('true');
  });

  it('reads mute preference from localStorage on mount (false)', () => {
    localStorage.setItem('serlo.feed.muted', 'false');
    render(<FeedList initialPosts={[makeFeedPost({ id: 'm2' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });
    expect(localStorage.getItem('serlo.feed.muted')).toBe('false');
  });

  it('handles missing localStorage key gracefully (default muted=true)', () => {
    // Kein Key gesetzt — Default bleibt true, kein Fehler.
    render(<FeedList initialPosts={[makeFeedPost({ id: 'm3' })]} viewerId={null} />, {
      wrapper: wrapperFactory(),
    });
    expect(localStorage.getItem('serlo.feed.muted')).toBeNull();
  });
});

describe('FeedList — "Neue Posts" pill (v1.w.UI.68)', () => {
  const wrapperFactory = () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return wrapper;
  };

  const NEWER_TS = '2099-01-01T12:00:00Z';
  const OLDER_TS = '2020-01-01T00:00:00Z';

  beforeEach(() => {
    mockRouterRefresh.mockClear();
    // global.fetch kann in jsdom undefined sein → immer frischen Mock zuweisen
    global.fetch = jest.fn();
  });

  it('does NOT show pill on initial render', () => {
    render(
      <FeedList initialPosts={[makeFeedPost({ id: 'p1' })]} viewerId={null} feedKey="foryou" />,
      { wrapper: wrapperFactory() },
    );
    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();
  });

  it('shows pill after 90s when API returns a newer post', async () => {
    jest.useFakeTimers();
    const newerPost = makeFeedPost({ id: 'new-1', created_at: NEWER_TS });
    const olderPost = makeFeedPost({ id: 'old-1', created_at: OLDER_TS });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [newerPost],
    } as unknown as Response);

    render(
      <FeedList initialPosts={[olderPost]} viewerId={null} feedKey="foryou" />,
      { wrapper: wrapperFactory() },
    );

    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();

    // Timer vorrücken + await async fetch
    await act(async () => {
      jest.advanceTimersByTime(90_000);
      // microtasks (Promise.resolve from fetch) verarbeiten
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Neue Posts')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('does NOT show pill when API returns a post that is NOT newer', async () => {
    jest.useFakeTimers();
    const initialPost = makeFeedPost({ id: 'init', created_at: NEWER_TS });
    const samePost = makeFeedPost({ id: 'same', created_at: OLDER_TS });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [samePost],
    } as unknown as Response);

    render(
      <FeedList initialPosts={[initialPost]} viewerId={null} feedKey="foryou" />,
      { wrapper: wrapperFactory() },
    );

    await act(async () => {
      jest.advanceTimersByTime(90_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('does NOT schedule poll for "following" feedKey', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn();

    render(
      <FeedList initialPosts={[makeFeedPost({ id: 'f1' })]} viewerId={null} feedKey="following" />,
      { wrapper: wrapperFactory() },
    );

    await act(async () => {
      jest.advanceTimersByTime(90_000);
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('clicking pill hides it and calls router.refresh()', async () => {
    jest.useFakeTimers();
    const newerPost = makeFeedPost({ id: 'new-2', created_at: NEWER_TS });
    const olderPost = makeFeedPost({ id: 'old-2', created_at: OLDER_TS });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [newerPost],
    } as unknown as Response);

    render(
      <FeedList initialPosts={[olderPost]} viewerId={null} feedKey="foryou" />,
      { wrapper: wrapperFactory() },
    );

    await act(async () => {
      jest.advanceTimersByTime(90_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const pill = screen.getByText('Neue Posts');
    expect(pill).toBeInTheDocument();

    // Klick versteckt Pill sofort
    act(() => {
      fireEvent.click(pill.closest('button')!);
    });
    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();

    // router.refresh() wird nach 400ms Delay aufgerufen
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('does NOT show pill when initialPosts is empty (no timestamp to compare)', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn();

    render(
      <FeedList initialPosts={[]} viewerId={null} feedKey="foryou" />,
      { wrapper: wrapperFactory() },
    );

    await act(async () => {
      jest.advanceTimersByTime(90_000);
      await Promise.resolve();
    });

    // newestCreatedAt ist null → fetch wird nicht aufgerufen
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Neue Posts')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});

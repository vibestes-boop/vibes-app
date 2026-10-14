'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ExploreVideoCard } from './explore-video-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FeedPost } from '@/lib/data/feed';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

// -----------------------------------------------------------------------------
// ExplorePostGrid — Infinite-scroll wrapper around ExploreVideoCard.
//
// Used by /explore "Popular Posts" section (v1.w.UI.124). SSR seeds the first
// 12 posts; IntersectionObserver fires at rootMargin 400px to load the next
// page via GET /api/feed/explore?offset=N&sort=...
//
// v1.w.UI.219 — Sort tabs (For You / Trending / Newest).
//   • 3 pill tabs above the grid.
//   • On tab switch: posts/offset/hasMore fully reset, then first page reloads.
//   • initialPosts are always "forYou" (SSR), so switching away then back
//     refetches from the API rather than restoring stale SSR data.
//
// Response shape: { posts: FeedPost[]; hasMore: boolean }
// -----------------------------------------------------------------------------

const PAGE = 12;

type SortMode = 'forYou' | 'trending' | 'newest';

type ExplorePageResponse = { posts: FeedPost[]; hasMore: boolean };

const SORT_LABEL_KEYS: Record<SortMode, TranslationKey> = {
  forYou:   'feed.forYou',
  trending: 'explore.sortTrending',
  newest:   'explore.sortNewest',
};

const SORT_MODES: SortMode[] = ['forYou', 'trending', 'newest'];

export function ExplorePostGrid({
  initialPosts,
  initialHasMore,
}: {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
}) {
  const { t } = useI18n();
  const [sort, setSort]         = useState<SortMode>('forYou');
  const [posts, setPosts]       = useState<FeedPost[]>(initialPosts);
  const [hasMore, setHasMore]   = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);
  const offsetRef               = useRef(initialPosts.length);
  const sentinelRef             = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<SortMode>('forYou');
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => {
    generationRef.current += 1;
    requestRef.current?.abort();
  }, []);

  const requestPage = useCallback(async (mode: SortMode, offset: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    busyRef.current = true;
    setFetching(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/feed/explore?offset=${offset}&limit=${PAGE}&sort=${mode}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Explore request failed');
      const { posts: next, hasMore: more } = await res.json() as ExplorePageResponse;
      // Some responses may already be decoded when a new tab aborts them.
      if (generation !== generationRef.current) return;
      setPosts(previous => {
        if (offset === 0) return next;
        const seen = new Set(previous.map(post => post.id));
        return [...previous, ...next.filter(post => !seen.has(post.id))];
      });
      offsetRef.current = offset + next.length;
      setHasMore(more && next.length > 0);
    } catch {
      if (generation === generationRef.current && !controller.signal.aborted) setFailed(true);
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setFetching(false);
      }
    }
  }, []);

  const switchSort = useCallback(async (next: SortMode) => {
    if (next === sortRef.current) return;
    sortRef.current = next;
    setSort(next);
    setPosts([]);
    setHasMore(true);
    offsetRef.current = 0;
    await requestPage(next, 0);
  }, [requestPage]);

  const loadMore = useCallback(() => {
    if (busyRef.current || !hasMore || failed) return;
    void requestPage(sortRef.current, offsetRef.current);
  }, [hasMore, failed, requestPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || fetching || failed) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, fetching, failed, loadMore]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Sort tab pills */}
      <div className="discover-sort" aria-label={t('explore.sortLabel')}>
        {SORT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={sort === mode}
            onClick={() => void switchSort(mode)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              sort === mode
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t(SORT_LABEL_KEYS[mode])}
          </button>
        ))}
      </div>

      {/* Grid */}
      <ul className="discover-grid">
        {posts.map((p) => {
          const fallbackInitial =
            (p.author.display_name ?? p.author.username).slice(0, 1).toUpperCase() || '•';
          return (
            <li key={p.id}>
              <ExploreVideoCard
                discovery
                id={p.id}
                videoUrl={p.video_url}
                thumbnailUrl={p.thumbnail_url}
                mediaType={p.media_type}
                caption={p.caption}
                authorUsername={p.author.username}
                authorDisplayName={p.author.display_name}
                authorAvatarUrl={p.author.avatar_url}
                viewCount={p.view_count ?? 0}
                fallbackInitial={fallbackInitial}
                womenOnly={p.women_only}
              />
            </li>
          );
        })}
      </ul>

      {hasMore && <div ref={sentinelRef} className="mt-3" />}
      {fetching && (
        <ul className="discover-grid" aria-label={t('common.loading')} aria-busy="true">
          {Array.from({ length: posts.length ? 3 : 6 }, (_, i) => (
            <li key={i}><Skeleton className="aspect-[4/5] w-full rounded-2xl" /></li>
          ))}
        </ul>
      )}
      {failed && (
        <div className="discover-feed-state" role="status">
          <p>{t('explore.loadError')}</p>
          <button type="button" onClick={() => void requestPage(sortRef.current, offsetRef.current)}>{t('common.retry')}</button>
        </div>
      )}
      {!fetching && !failed && posts.length === 0 && (
        <p className="discover-feed-state" role="status">{t('explore.noPosts')}</p>
      )}

    </>
  );
}

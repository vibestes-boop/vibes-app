'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ExploreVideoCard } from './explore-video-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FeedPost } from '@/lib/data/feed';

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

const SORT_LABELS: Record<SortMode, string> = {
  forYou:   'Für dich',
  trending: 'Trending',
  newest:   'Neueste',
};

const SORT_MODES: SortMode[] = ['forYou', 'trending', 'newest'];

export function ExplorePostGrid({
  initialPosts,
  initialHasMore,
}: {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
}) {
  const [sort, setSort]         = useState<SortMode>('forYou');
  const [posts, setPosts]       = useState<FeedPost[]>(initialPosts);
  const [hasMore, setHasMore]   = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);
  const offsetRef               = useRef(initialPosts.length);
  const sentinelRef             = useRef<HTMLDivElement | null>(null);
  // Track current sort in a ref so loadMore always reads latest value
  const sortRef                 = useRef<SortMode>('forYou');

  // ── Switch sort tab ─────────────────────────────────────────────────────────

  const switchSort = useCallback(async (next: SortMode) => {
    if (next === sortRef.current) return;
    sortRef.current = next;
    setSort(next);
    setPosts([]);
    setHasMore(true);
    setFetching(true);
    offsetRef.current = 0;
    try {
      const res = await fetch(`/api/feed/explore?offset=0&limit=${PAGE}&sort=${next}`);
      if (!res.ok) { setHasMore(false); return; }
      const { posts: first, hasMore: more } = (await res.json()) as ExplorePageResponse;
      setPosts(first);
      offsetRef.current = first.length;
      setHasMore(more);
    } catch {
      setHasMore(false);
    } finally {
      setFetching(false);
    }
  }, []);

  // ── Infinite-scroll loadMore ─────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (fetching || !hasMore) return;
    setFetching(true);
    const currentSort = sortRef.current;
    try {
      const res = await fetch(
        `/api/feed/explore?offset=${offsetRef.current}&limit=${PAGE}&sort=${currentSort}`,
      );
      if (!res.ok) return;
      const { posts: next, hasMore: more } = (await res.json()) as ExplorePageResponse;
      if (next.length === 0) { setHasMore(false); return; }
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = next.filter((p) => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      offsetRef.current += next.length;
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [fetching, hasMore]);

  // ── IntersectionObserver ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Sort tab pills */}
      <div className="mb-4 flex gap-2">
        {SORT_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => void switchSort(mode)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              sort === mode
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {SORT_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {posts.map((p) => {
          const fallbackInitial =
            (p.author.display_name ?? p.author.username).slice(0, 1).toUpperCase() || '•';
          return (
            <li key={p.id}>
              <ExploreVideoCard
                id={p.id}
                videoUrl={p.video_url}
                thumbnailUrl={p.thumbnail_url}
                caption={p.caption}
                authorUsername={p.author.username}
                viewCount={p.view_count ?? 0}
                fallbackInitial={fallbackInitial}
                womenOnly={p.women_only}
              />
            </li>
          );
        })}
      </ul>

      {/* Sentinel + skeleton row while fetching */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-3">
          {fetching && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <li key={i}>
                  <Skeleton className="aspect-[9/16] w-full rounded-lg" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Initial loading skeleton when grid is empty (tab switch) */}
      {posts.length === 0 && fetching && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[9/16] w-full rounded-lg" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

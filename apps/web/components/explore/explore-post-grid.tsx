'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ExploreVideoCard } from './explore-video-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FeedPost } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// ExplorePostGrid — Infinite-scroll wrapper around ExploreVideoCard.
//
// Used by /explore "Popular Posts" section (v1.w.UI.124). SSR seeds the first
// 12 posts; IntersectionObserver fires at rootMargin 400px to load the next
// page via GET /api/feed/explore?offset=N.
//
// Response shape: { posts: FeedPost[]; hasMore: boolean }
// -----------------------------------------------------------------------------

const PAGE = 12;

type ExplorePageResponse = { posts: FeedPost[]; hasMore: boolean };

export function ExplorePostGrid({
  initialPosts,
  initialHasMore,
}: {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
}) {
  const [posts, setPosts]       = useState<FeedPost[]>(initialPosts);
  const [hasMore, setHasMore]   = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);
  const offsetRef               = useRef(initialPosts.length);
  const sentinelRef             = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (fetching || !hasMore) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/feed/explore?offset=${offsetRef.current}&limit=${PAGE}`,
      );
      if (!res.ok) return;
      const { posts: next, hasMore: more } = (await res.json()) as ExplorePageResponse;
      if (next.length === 0) { setHasMore(false); return; }
      const seen = new Set(posts.map((p) => p.id));
      const fresh = next.filter((p) => !seen.has(p.id));
      setPosts((prev) => [...prev, ...fresh]);
      offsetRef.current += next.length;
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [fetching, hasMore, posts]);

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

  return (
    <>
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
    </>
  );
}

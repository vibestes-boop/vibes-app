'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FeedPost } from '@/lib/data/feed';
import { ExploreVideoCard } from './explore-video-card';

// -----------------------------------------------------------------------------
// HashtagGrid — Client-Komponente für /t/[tag].
//
// Nimmt die per SSR vorgeladenen `initialPosts` entgegen und ergänzt sie per
// IntersectionObserver-Sentinel am Listenende. Jeder Nachlader ruft
// GET /api/feed/hashtag/[tag]?offset=<aktuelle Länge>&limit=24.
//
// Offset-Pagination statt Cursor, weil die Hashtag-Liste nach view_count DESC
// sortiert ist — kein eindeutiger Cursor. Für eine 15-min-ISR-Seite mit
// stabiler Sortierung ist Offset-Drift (neue Posts zwischen zwei Laderufen)
// tolerierbar.
// -----------------------------------------------------------------------------

const PAGE_SIZE = 24;

interface HashtagGridProps {
  initialPosts: FeedPost[];
  tag: string;
}

export function HashtagGrid({ initialPosts, tag }: HashtagGridProps) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Track fetched-offset to avoid double-fetches under React StrictMode.
  const fetchedOffsetRef = useRef<number>(initialPosts.length);

  const loadMore = useCallback(async () => {
    if (isFetching || !hasMore) return;
    const offset = fetchedOffsetRef.current;
    setIsFetching(true);
    try {
      const res = await fetch(
        `/api/feed/hashtag/${encodeURIComponent(tag)}?offset=${offset}&limit=${PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const newPosts: FeedPost[] = await res.json();
      if (newPosts.length === 0) {
        setHasMore(false);
        return;
      }
      // Dedupe by id (safety net for offset drift)
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const deduped = newPosts.filter((p) => !seen.has(p.id));
        fetchedOffsetRef.current = prev.length + deduped.length;
        return [...prev, ...deduped];
      });
      if (newPosts.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // silent — next intersection retry
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, tag]);

  // IntersectionObserver auf den Sentinel am Listenende.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {posts.map((p) => {
          const fallbackInitial = (
            (p.author.display_name ?? p.author.username ?? '?').slice(0, 1).toUpperCase()
          );
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

      {/* Sentinel + Lade-Indikator */}
      <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
        {isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Mehr laden…
          </div>
        )}
        {!hasMore && posts.length > PAGE_SIZE && (
          <p className="text-sm text-muted-foreground">Alle Posts geladen.</p>
        )}
      </div>
    </>
  );
}

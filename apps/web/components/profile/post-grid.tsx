'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Grid3x3, Play } from 'lucide-react';
import type { Post } from '@shared/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

// -----------------------------------------------------------------------------
// PostGrid — 3-Spalten-Grid, 9:16, klickbar zu /p/[id].
// Zeigt Thumbnail mit View-Count-Overlay. Hover → mutes Video-Preview.
//
// v1.w.UI.55: PostGridItem ist ein Client-Component, damit Hover-Video
// funktioniert. PostGrid selbst hat keine Serverseitige Logik (nur Props),
// daher ist 'use client' hier unproblematisch.
//
// Bild-Posts haben eine Bild-URL in video_url — <video> schlägt dann fehl
// und onError hält videoReady=false, d.h. das Thumbnail bleibt sichtbar.
// HLS-Posts (m3u8): Browsers ohne nativen HLS-Support (Chrome) zeigen auch
// stillschweigend nichts — Thumbnail-Fallback greift. Kein Error-Tracking
// nötig, das ist gewolltes Graceful-Degrade.
// -----------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

// ─── PostGridItem ─────────────────────────────────────────────────────────────

function PostGridItem({ post }: { post: Post }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  const handleMouseEnter = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {/* autoplay blocked — stay on thumbnail */});
  }, []);

  const handleMouseLeave = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setVideoReady(false);
  }, []);

  return (
    <li className="group relative overflow-hidden rounded-md bg-muted">
      <Link
        href={`/p/${post.id}`}
        className="relative block aspect-[9/16] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={
          post.caption ? `Video ansehen: ${post.caption.slice(0, 80)}` : 'Video ansehen'
        }
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Static thumbnail — fades out once video is ready */}
        {post.thumbnail_url ? (
          <Image
            src={post.thumbnail_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 300px, 33vw"
            className={cn(
              'object-cover transition-opacity duration-300',
              videoReady ? 'opacity-0' : 'opacity-100',
            )}
          />
        ) : (
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black transition-opacity duration-300',
              videoReady ? 'opacity-0' : 'opacity-100',
            )}
          />
        )}

        {/* Hover video preview — preload="none" keeps grid cheap at rest */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={post.video_url}
          muted
          playsInline
          preload="none"
          loop
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            videoReady ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* View-Count unten links, leichter Gradient-Boden für Lesbarkeit */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-white drop-shadow">
            <Play className="h-3 w-3 fill-current" />
            {formatCount(post.view_count)}
          </span>
        </div>
      </Link>
    </li>
  );
}

// ─── PostGrid ─────────────────────────────────────────────────────────────────

export function PostGrid({
  posts,
  className,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyCta,
}: {
  posts: Post[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyCta?: ReactNode;
}) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon ?? <Grid3x3 className="h-7 w-7" strokeWidth={1.75} />}
        title={emptyTitle ?? 'Noch keine Videos'}
        description={emptyDescription}
        cta={emptyCta}
        size="md"
        bordered
      />
    );
  }

  return (
    <ul className={cn('grid grid-cols-3 gap-1 sm:gap-1.5', className)}>
      {posts.map((post) => (
        <PostGridItem key={post.id} post={post} />
      ))}
    </ul>
  );
}

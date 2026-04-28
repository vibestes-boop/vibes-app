'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';

// -----------------------------------------------------------------------------
// ExploreVideoCard — v1.w.UI.55b
//
// Kachel für den „Populäre Posts"-Strip auf /explore.
// Entspricht dem PostGridItem-Pattern in post-grid.tsx: Thumbnail mit
// statischer <img>, Hover → muted Video-Preview via <video preload="none">.
//
// Übergabe-Props sind minimal: id, video_url, thumbnail_url, caption,
// author.username, view_count + optionaler Initial-Fallback.
// -----------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return String(n);
}

export function ExploreVideoCard({
  id,
  videoUrl,
  thumbnailUrl,
  caption,
  authorUsername,
  viewCount,
  fallbackInitial,
  womenOnly = false,
}: {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  authorUsername: string;
  viewCount: number;
  fallbackInitial: string;
  /** v1.w.UI.170 — show 🌸 badge on Women-Only Zone posts */
  womenOnly?: boolean;
}) {
  const { t } = useI18n();
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
    <Link
      href={`/p/${id}` as Route}
      className="group relative block aspect-[9/16] overflow-hidden rounded-lg bg-black"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Static thumbnail */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={caption ?? 'Post'}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            videoReady ? 'opacity-0' : 'opacity-100',
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black transition-opacity duration-300',
            videoReady ? 'opacity-0' : 'opacity-100',
          )}
        >
          <Compass className="h-10 w-10 text-white/20" aria-hidden />
          <span className="absolute text-2xl font-bold tabular-nums text-white/40">
            {fallbackInitial}
          </span>
        </div>
      )}

      {/* Hover video — preload="none" keeps grid cheap at rest */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={videoUrl}
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

      {/* Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 text-xs text-white">
        {/* v1.w.UI.170 — WOZ badge */}
        {womenOnly && (
          <div className="mb-1">
            <span className="text-xs leading-none" aria-label="Women Only" title="Women-Only Zone">🌸</span>
          </div>
        )}
        <div className="truncate font-medium">@{authorUsername}</div>
        <div className="text-white/70">
          {formatCount(viewCount)} {t('explore.views')}
        </div>
      </div>
    </Link>
  );
}

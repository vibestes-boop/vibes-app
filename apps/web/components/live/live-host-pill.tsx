'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { toggleFollowHost } from '@/app/actions/live';
import type { LiveSessionWithHost } from '@/lib/data/live';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LiveHostPill — TikTok-style Overlay-Pill oben-links auf dem Video-Canvas.
// Ersetzt die LiveHostCard im neuen Overlay-Layout (Phase 2 B5). Kompakt:
// [Avatar] [Name + Verified / @username] [Folgen]. Rein visuell: halbtransparent
// schwarz + backdrop-blur, damit der Video-Content im Hintergrund lesbar bleibt
// aber die Pill gegen wechselnde Bild-Luminanz stabil bleibt.
//
// Keine Title-/Caption-Anzeige — der Stream-Titel wandert in das neue
// Overlay-Layout unterhalb der Host-Pill als eigenständige weiche Caption
// (siehe /live/[id]/page.tsx).
// -----------------------------------------------------------------------------

export interface LiveHostPillProps {
  session: LiveSessionWithHost;
  viewerId: string | null;
  initialFollowing: boolean;
  className?: string;
}

export function LiveHostPill({
  session,
  viewerId,
  initialFollowing,
  className,
}: LiveHostPillProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const isOwnSession = viewerId === session.host_id;

  const handleFollow = () => {
    if (!viewerId || isOwnSession) return;
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      // toggleFollowHost erwartet den aktuellen „currentlyFollowing"-Wert und
      // dreht ihn um. Wir geben also den Vor-Optimistic-Zustand rein, damit
      // Server + Client synchron sind.
      const result = await toggleFollowHost(session.host_id, !next);
      if (!result.ok) setFollowing(!next);
    });
  };

  const profileHref: Route = (session.host?.username
    ? `/u/${session.host.username}`
    : '#') as Route;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-1.5 text-white shadow-elevation-2 ring-1 ring-white/10 backdrop-blur-md',
        className,
      )}
    >
      <Link
        href={profileHref}
        className="relative block h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-white/10"
        aria-label={`Profil von ${hostName}`}
      >
        {session.host?.avatar_url ? (
          <Image
            src={session.host.avatar_url}
            alt={hostName}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/15 text-sm font-semibold">
            {hostName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-col leading-tight">
        <Link
          href={profileHref}
          className="flex items-center gap-1 text-[13px] font-semibold text-white hover:underline"
        >
          <span className="max-w-[140px] truncate">{hostName}</span>
          {session.host?.verified && (
            <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
              ✓
            </span>
          )}
        </Link>
        {session.host?.username && (
          <span className="max-w-[140px] truncate text-[11px] text-white/60">
            @{session.host.username}
          </span>
        )}
      </div>

      {viewerId && !isOwnSession && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={isPending}
          className={cn(
            'ml-0.5 flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-fast ease-out-expo',
            following
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'bg-rose-500 text-white hover:bg-rose-600',
            'disabled:opacity-50',
          )}
        >
          {following ? 'Folgst' : 'Folgen'}
        </button>
      )}
    </div>
  );
}

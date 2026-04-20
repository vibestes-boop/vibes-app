'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { UserPlus, UserCheck } from 'lucide-react';
import { toggleFollowHost } from '@/app/actions/live';
import type { LiveSessionWithHost } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LiveHostCard — kompakte Info-Karte über dem Chat. Host-Avatar, Name,
// Follow-Button (optimistic), Titel des Streams.
// -----------------------------------------------------------------------------

export interface LiveHostCardProps {
  session: LiveSessionWithHost;
  viewerId: string | null;
  initialFollowing: boolean;
}

export function LiveHostCard({ session, viewerId, initialFollowing }: LiveHostCardProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const isOwnSession = viewerId === session.host_id;

  const handleFollow = () => {
    if (!viewerId || isOwnSession) return;
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const result = await toggleFollowHost(session.host_id, !next);
      if (!result.ok) {
        setFollowing(!next); // rollback
      }
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <Link
        href={session.host?.username ? (`/u/${session.host.username}` as Route) : ('#' as Route)}
        className="relative block h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted"
      >
        {session.host?.avatar_url ? (
          <Image
            src={session.host.avatar_url}
            alt={hostName}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-semibold text-primary">
            {hostName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={session.host?.username ? (`/u/${session.host.username}` as Route) : ('#' as Route)}
          className="flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          {hostName}
          {session.host?.verified && (
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
              ✓
            </span>
          )}
        </Link>
        {session.host?.username && (
          <p className="text-xs text-muted-foreground">@{session.host.username}</p>
        )}
        {session.title && (
          <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{session.title}</p>
        )}
      </div>

      {viewerId && !isOwnSession && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={isPending}
          className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            following
              ? 'border bg-background text-foreground hover:bg-muted'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-50`}
        >
          {following ? (
            <>
              <UserCheck className="h-3.5 w-3.5" />
              Folgst
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              Folgen
            </>
          )}
        </button>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import type { MouseEvent } from 'react';
import { UserPlus, Check, Users } from 'lucide-react';
import { toggleFollowHost } from '@/app/actions/live';
import type { LiveSessionWithHost } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LiveHostPill — TikTok-style schwebender Pill-Overlay auf dem Video (v1.w.UI.1
// — B5 aus UI_AUDIT_WEB). Ersetzt die bisherigen zwei separaten Overlays
// (Live-Badge + Viewer-Count als Chips oben links) durch EINE zusammenhängende
// Identitäts-Pill: Avatar (28×28) + @Host-Name + Live-Users-Count + Follow-CTA.
//
// Hintergrund-Rezeptur:
//   - `bg-black/70 backdrop-blur-md` — kräftige Transluzenz damit Video-Inhalt
//     weich durchscheint statt komplett überdeckt zu werden.
//   - `ring-1 ring-white/10` — feine weiße Kante, trennt die Pill von weißen
//     Szenen (Tageslicht, Studio-Setups), die sonst mit dem Hintergrund fusionieren.
//   - `shadow-elevation-2` — leichte Elevation damit der Overlay räumlich VOR
//     dem Video sitzt, nicht flach aufliegt.
//
// Live-Badge (rotes „LIVE"-Pill) steht bewusst als separate Mini-Pill rechts
// daneben — dadurch bleibt die Host-Identität visuell die primäre Surface, und
// der Live-Marker wird ein Secondary-Cue, keine Konkurrenz um den Fokus.
// -----------------------------------------------------------------------------

export interface LiveHostPillProps {
  session: LiveSessionWithHost;
  viewerId: string | null;
  initialFollowing: boolean;
  ended?: boolean;
}

export function LiveHostPill({
  session,
  viewerId,
  initialFollowing,
  ended = false,
}: LiveHostPillProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const isOwnSession = viewerId === session.host_id;

  // Follow-Click muss e.preventDefault — die Pill-Inhalte sind in einem Link
  // verschachtelt (Avatar/Name navigieren zum Profil), also unterbricht der
  // Button-Click die Event-Bubble, sonst öffnet der Klick zusätzlich das
  // Profil im Hintergrund während der Follow-Toggle läuft.
  const handleFollow = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!viewerId || isOwnSession) return;
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const result = await toggleFollowHost(session.host_id, !next);
      if (!result.ok) setFollowing(!next); // rollback
    });
  };

  const profileHref: Route = session.host?.username
    ? (`/u/${session.host.username}` as Route)
    : ('#' as Route);

  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      {/* Haupt-Pill: Avatar + Host + Viewer-Count (+ Follow conditional) */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 py-1 pl-1 pr-2.5 text-white shadow-elevation-2 ring-1 ring-white/10 backdrop-blur-md">
        <Link
          href={profileHref}
          className="relative block h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-white/10"
          aria-label={hostName}
        >
          {session.host?.avatar_url ? (
            <Image
              src={session.host.avatar_url}
              alt=""
              fill
              sizes="28px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
              {hostName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex min-w-0 flex-col leading-tight">
          <Link
            href={profileHref}
            className="flex items-center gap-1 truncate text-xs font-semibold hover:underline"
          >
            <span className="truncate">{hostName}</span>
            {session.host?.verified && (
              <span
                className="inline-flex h-3 w-3 flex-none items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white"
                aria-label="Verifiziert"
              >
                ✓
              </span>
            )}
          </Link>
          {!ended && (
            <span className="flex items-center gap-1 text-[10px] text-white/80 tabular-nums">
              <Users className="h-2.5 w-2.5" aria-hidden />
              {(session.viewer_count ?? 0).toLocaleString('de-DE')}
            </span>
          )}
        </div>

        {viewerId && !isOwnSession && !ended && (
          <button
            type="button"
            onClick={handleFollow}
            disabled={isPending}
            className={`ml-1 inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-fast ease-out-expo disabled:opacity-50 ${
              following
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-white text-black hover:bg-white/90'
            }`}
            aria-pressed={following}
          >
            {following ? (
              <>
                <Check className="h-3 w-3 stroke-[2.5]" aria-hidden />
                Folgst
              </>
            ) : (
              <>
                <UserPlus className="h-3 w-3" aria-hidden />
                Folgen
              </>
            )}
          </button>
        )}
      </div>

      {/* Separate Live-Marker-Pill — bleibt stand-alone damit die Farbsignal-
          Wirkung (rot = live) nicht in der Haupt-Pill aufgeht. */}
      {!ended && (
        <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-white/10">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
      )}
    </div>
  );
}

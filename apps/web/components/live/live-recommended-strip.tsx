import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Radio, Users2 } from 'lucide-react';

import type { LiveSessionWithHost } from '@/lib/data/live';
import { cn } from '@/lib/utils';

interface LiveRecommendedStripProps {
  sessions: LiveSessionWithHost[];
}

export function LiveRecommendedStrip({ sessions }: LiveRecommendedStripProps) {
  if (sessions.length === 0) return null;

  return (
    <section className="hidden xl:block" aria-labelledby="recommended-live-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="recommended-live-heading" className="text-xl font-black tracking-tight text-foreground">
            Empfohlene Livestreams
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weitere aktive Streams, ohne den aktuellen Raum zu verlassen.
          </p>
        </div>
        <Link
          href={'/live' as Route}
          className="rounded-full border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Alle ansehen
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
        {sessions.map((session) => (
          <RecommendedLiveCard key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}

function RecommendedLiveCard({ session }: { session: LiveSessionWithHost }) {
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const viewerCount = session.viewer_count ?? 0;

  return (
    <Link
      href={`/live/${session.id}` as Route}
      className={cn(
        'group min-w-0 overflow-hidden rounded-[14px] border bg-background shadow-elevation-1 transition',
        'hover:-translate-y-0.5 hover:bg-muted/45 hover:shadow-elevation-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {session.thumbnail_url ? (
          <Image
            src={session.thumbnail_url}
            alt={session.title ?? `Live mit ${hostName}`}
            fill
            sizes="(min-width: 1536px) 18vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Radio className="h-10 w-10 text-muted-foreground/45" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/10" />

        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-elevation-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">@{session.host?.username ?? hostName}</p>
            <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight text-white">
              {session.title ?? 'Unbenannter Stream'}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur">
            <Users2 className="h-3 w-3" aria-hidden="true" />
            {formatCompact(viewerCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('de-DE');
}

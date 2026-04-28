import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Eye, Users, Clock, Video } from 'lucide-react';

import { getPublicReplays, type ReplaySession } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// /live/replays — VOD-Bibliothek aller öffentlichen Replay-Sessions.
// v1.w.UI.166: Mobile-Parity zu app/live/replays.tsx.
// ISR 5 min — Replay-Liste ändert sich selten, kurze Stale-Zeit für neue Einträge.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Live Replays — Serlo',
  description: 'Schau vergangene Live-Streams nach — Videos on Demand von Serlo Creatorn.',
  openGraph: {
    title: 'Live Replays — Serlo',
    description: 'Vergangene Live-Streams on demand.',
  },
};

export const revalidate = 300;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  const months = Math.floor(days / 30);
  return `vor ${months} ${months === 1 ? 'Monat' : 'Monaten'}`;
}

function compact(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ReplayCard({ session }: { session: ReplaySession }) {
  const host = session.host;
  return (
    <Link
      href={`/live/replay/${session.id}` as Route}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevation-1 transition-all duration-150 hover:shadow-elevation-2 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {session.thumbnail_url ? (
          <Image
            src={session.thumbnail_url}
            alt={session.title ?? 'Replay'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <Play className="h-6 w-6 translate-x-0.5 fill-white text-white" />
          </div>
        </div>

        {/* Replay badge */}
        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          Replay
        </div>

        {/* Stats overlay bottom */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {session.replay_views > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
              <Eye className="h-3 w-3" />
              {compact(session.replay_views)}
            </span>
          )}
          {session.peak_viewer_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
              <Users className="h-3 w-3" />
              {compact(session.peak_viewer_count)} peak
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex min-w-0 gap-3 p-3">
        {/* Host avatar */}
        {host && (
          <Link
            href={`/u/${host.username}` as Route}
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-muted">
              {host.avatar_url ? (
                <Image
                  src={host.avatar_url}
                  alt={host.username}
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">
                  {host.username.slice(0, 2)}
                </span>
              )}
            </div>
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {session.title ?? 'Live-Stream Replay'}
          </p>
          {host && (
            <p className="mt-0.5 text-xs text-muted-foreground">@{host.username}</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            {timeAgo(session.ended_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LiveReplaysPage() {
  const replays = await getPublicReplays(40);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={'/live' as Route}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Live
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Live Replays</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vergangene Live-Streams on demand — schau was du verpasst hast.
        </p>
      </div>

      {/* Grid */}
      {replays.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-elevation-2 ring-1 ring-violet-500/20">
            <Video className="h-8 w-8 text-violet-500" strokeWidth={1.75} />
          </div>
          <div className="max-w-xs">
            <p className="text-base font-semibold">Noch keine Replays</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Wenn Streams abgeschlossen und als Replay markiert werden, erscheinen sie hier.
            </p>
          </div>
          <Link
            href={'/live' as Route}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Live jetzt ansehen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {replays.map((session) => (
            <ReplayCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </main>
  );
}

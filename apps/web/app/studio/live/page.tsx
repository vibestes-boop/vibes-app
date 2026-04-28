import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Radio, Clock, Users, Play, Plus, Settings } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getMyActiveLiveSession, getMyPastSessions } from '@/lib/data/live-host';
import type { PastSession } from '@/lib/data/live-host';

// -----------------------------------------------------------------------------
// /studio/live — Host-Dashboard:
//  • Aktive Session (falls vorhanden) → direkter Resume-Link ins Deck
//  • Go-Live CTA
//  • History: letzten 30 Sessions mit Thumbnail, Dauer, Peak-Viewer, Replay-Link
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Live-Studio',
  description: 'Deine Live-Sessions, Analytics und Replays.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function formatDuration(secs: number | null): string {
  if (secs === null || secs <= 0) return '–';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Heute, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Gestern, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function StudioLivePage() {
  const user = await getUser();
  if (!user) {
    redirect('/login?next=/studio/live');
  }

  const [activeSession, pastSessions] = await Promise.all([
    getMyActiveLiveSession(),
    getMyPastSessions(30),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Live-Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine Sessions, Replays und Analytics.
          </p>
        </div>
        {!activeSession && (
          <Link
            href={'/live/start' as Route}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-red-500 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-red-600 hover:to-red-700"
          >
            <Plus className="h-4 w-4" />
            Live gehen
          </Link>
        )}
      </header>

      {/* Aktive Session */}
      {activeSession && (
        <section className="mb-6 rounded-xl border-2 border-red-500/50 bg-red-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
                <Radio className="h-3 w-3 animate-pulse" />
                LIVE
              </span>
              <div>
                <p className="font-medium">{activeSession.title ?? 'Unbenannter Stream'}</p>
                <p className="text-xs text-muted-foreground">
                  Seit {formatShortDate(activeSession.started_at)} · {activeSession.viewer_count} Viewer
                  · Peak {activeSession.peak_viewer_count}
                </p>
              </div>
            </div>
            <Link
              href={`/live/host/${activeSession.id}` as Route}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              <Settings className="h-4 w-4" />
              Zurück ins Deck
            </Link>
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Vergangene Streams</h2>
        {pastSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-12 text-center">
            <Radio className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Noch keine Streams. Starte deinen ersten über den Button oben.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastSessions.map((s) => (
              <PastSessionCard key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PastSessionCard({ session }: { session: PastSession }) {
  const hasReplay = session.status === 'ended';
  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link href={(hasReplay ? `/live/replay/${session.id}` : '#') as Route} className="flex flex-1 flex-col">
        <div className="relative aspect-video w-full bg-muted">
          {session.thumbnail_url ? (
            <Image
              src={session.thumbnail_url}
              alt={session.title ?? 'Replay'}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Radio className="h-10 w-10 text-primary/40" />
            </div>
          )}

          {hasReplay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-black">
                <Play className="h-3.5 w-3.5" />
                Replay
              </span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(session.duration_secs)}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3 py-2">
          <p className="truncate text-sm font-medium">{session.title ?? 'Unbenannter Stream'}</p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              Peak {session.peak_viewer_count}
            </span>
            <span>{formatShortDate(session.started_at)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Radio, Users, Eye, Flame, Video, CalendarDays, Clock } from 'lucide-react';
import { getActiveLiveSessions, type LiveSessionWithHost } from '@/lib/data/live';
import { getUpcomingScheduledLives, type ScheduledLiveRow } from '@/lib/data/live-host';
import { getUser } from '@/lib/auth/session';
import { LivePageRefresher } from '@/components/live/live-page-refresher';

// -----------------------------------------------------------------------------
// formatShortDuration — lokaler Ersatz für date-fns/formatDistanceToNowStrict.
// Gibt "3 min", "1 Std 12 min" etc. auf Deutsch zurück.
// -----------------------------------------------------------------------------
function formatShortDuration(since: Date): string {
  const deltaMs = Date.now() - since.getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes === 0 ? `${hours} Std` : `${hours} Std ${remMinutes} min`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
}

// -----------------------------------------------------------------------------
// /live — Listing aller aktiven Live-Sessions.
// Sortierung: viewer_count desc, started_at asc (ältere Streams mit gleichem
// Publikum first → Performance-Creator werden belohnt, nicht Just-Started).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Live — Streams jetzt',
  description:
    'Live-Streams gerade aktiv. Chat, Geschenke, Polls, CoHost-Requests direkt im Browser.',
  openGraph: {
    title: 'Serlo Live',
    description: 'Streams jetzt aktiv.',
  },
};

// Bewusst dynamic: Viewer-Counts sollen pro Request frisch sein, kein Caching.
export const dynamic = 'force-dynamic';

export default async function LiveIndexPage() {
  const [sessions, user, upcoming] = await Promise.all([
    getActiveLiveSessions(60),
    getUser(),
    getUpcomingScheduledLives(8),
  ]);

  const isAuthed = !!user;
  const totalViewers = sessions.reduce((acc, s) => acc + (s.viewer_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      {/* Unsichtbare Client-Shell: hält die Liste via Realtime + 30s-Polling frisch */}
      <LivePageRefresher sessionCount={sessions.length} />

      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            Live
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessions.length === 0
              ? 'Gerade läuft kein Stream.'
              : `${sessions.length} ${sessions.length === 1 ? 'Stream' : 'Streams'} live`}
          </p>
        </div>

        {/* Right side: viewer pill + Go-Live CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              {totalViewers.toLocaleString('de-DE')} Zuschauer
            </div>
          )}

          {/* v1.w.UI.100: CTA für eingeloggte User — immer sichtbar, nicht nur bei leerem State */}
          {isAuthed ? (
            <Link
              href={'/live/start' as Route}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Video className="h-4 w-4" />
              Stream starten
            </Link>
          ) : (
            <Link
              href={'/login?next=/live/start' as Route}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Video className="h-4 w-4" />
              Live gehen
            </Link>
          )}
        </div>
      </header>

      {/* Demnächst — Upcoming Scheduled Lives strip — v1.w.UI.155 */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Demnächst
          </h2>
          <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {upcoming.map((u) => (
              <UpcomingLiveCard key={u.id} row={u} />
            ))}
          </ul>
        </section>
      )}

      {sessions.length === 0 ? (
        <EmptyState isAuthed={isAuthed} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sessions.map((s, i) => (
            <LiveSessionCard key={s.id} session={s} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UpcomingLiveCard — compact horizontal card for the "Demnächst" strip.
// -----------------------------------------------------------------------------

function upcomingLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Gleich';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const d = new Date(iso);
    return `Heute ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

function UpcomingLiveCard({ row }: { row: ScheduledLiveRow }) {
  const initial = (row.host_username ?? '?').charAt(0).toUpperCase();
  return (
    <li className="flex w-52 shrink-0 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        {row.host_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.host_avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initial}
          </div>
        )}
        {row.host_username ? (
          <Link
            href={`/u/${row.host_username}` as Route}
            className="truncate text-xs font-medium hover:underline"
          >
            @{row.host_username}
          </Link>
        ) : (
          <span className="truncate text-xs text-muted-foreground">Unbekannt</span>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{row.title}</p>
      <div className="mt-auto flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">{upcomingLabel(row.scheduled_at)}</span>
      </div>
    </li>
  );
}

// -----------------------------------------------------------------------------
// LiveSessionCard — 16:9 Thumbnail + Live-Badge + Host-Info + Viewer-Count.
// -----------------------------------------------------------------------------

function LiveSessionCard({
  session,
  priority,
}: {
  session: LiveSessionWithHost;
  priority: boolean;
}) {
  const viewerCount = session.viewer_count ?? 0;
  const peakCount = session.peak_viewer_count ?? 0;
  const hot = viewerCount >= 100;
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';

  return (
    <Link
      href={`/live/${session.id}` as Route}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/50"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {session.thumbnail_url ? (
          <Image
            src={session.thumbnail_url}
            alt={session.title ?? 'Live Stream'}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Radio className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Live-Badge oben links */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </div>

        {/* Hot-Badge */}
        {hot && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            <Flame className="h-3 w-3" />
            Hot
          </div>
        )}

        {/* Viewer-Count unten rechts */}
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
          <Users className="h-3 w-3" />
          {viewerCount.toLocaleString('de-DE')}
        </div>

        {/* Dauer unten links */}
        {session.started_at && (
          <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
            {formatShortDuration(new Date(session.started_at))}
          </div>
        )}
      </div>

      {/* Info-Block */}
      <div className="flex min-w-0 items-start gap-3 p-3">
        {/* Host-Avatar */}
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          {session.host?.avatar_url ? (
            <Image
              src={session.host.avatar_url}
              alt={hostName}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {hostName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
            {session.title ?? 'Unbenannter Stream'}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{hostName}</span>
            {session.host?.verified && (
              <span className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                ✓
              </span>
            )}
          </div>
          {peakCount > 0 && peakCount > viewerCount && (
            <div className="mt-1 text-[11px] text-muted-foreground/70 tabular-nums">
              Peak: {peakCount.toLocaleString('de-DE')}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// EmptyState — wenn kein Stream aktiv ist.
// v1.w.UI.100: Eingeloggte User sehen einen direkten "Jetzt live gehen"-CTA.
// Anon-User sehen einen Login-Link. Stale "in Arbeit"-Copy entfernt.
// -----------------------------------------------------------------------------

function EmptyState({ isAuthed }: { isAuthed: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <Radio className="h-8 w-8 text-red-500/70" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Gerade läuft kein Stream</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isAuthed
            ? 'Sei der Erste — starte jetzt deinen eigenen Live-Stream direkt im Browser.'
            : 'Komm später wieder vorbei oder melde dich an, um selbst live zu gehen.'}
        </p>
      </div>
      {isAuthed ? (
        <Link
          href={'/live/start' as Route}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
        >
          <Video className="h-4 w-4" />
          Jetzt live gehen
        </Link>
      ) : (
        <Link
          href={'/login?next=/live/start' as Route}
          className="inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Einloggen &amp; live gehen
        </Link>
      )}
    </div>
  );
}

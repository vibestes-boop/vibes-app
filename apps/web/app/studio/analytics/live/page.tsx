import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Radio, Gem, Users, Clock3, ChevronRight } from 'lucide-react';
import { getMyLiveSessions } from '@/lib/data/studio';

export const metadata: Metadata = {
  title: 'LIVE-Analyse',
  description: 'Deine vergangenen Live-Sessions — Dauer, Aufrufe, Follower, Belohnungen.',
};

export const dynamic = 'force-dynamic';

function formatDuration(secs: number | null): string {
  if (!secs || secs <= 0) return '0 Min.';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m} Min. ${s} Sek.` : `${m} Min.`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} Std. ${rm} Min.` : `${h} Std.`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function LiveAnalysePage() {
  const sessions = await getMyLiveSessions(50);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">LIVE-Analyse</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine vergangenen Streams mit Metriken auf einen Blick.
        </p>
      </header>

      {/* Table card */}
      <section className="rounded-xl border bg-card">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr_0.9fr_auto] items-center gap-3 border-b px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>LIVE</span>
          <span>Datum</span>
          <span>LIVE-Dauer</span>
          <span>Aufrufe</span>
          <span>Neue Follower</span>
          <span className="flex items-center gap-1"><Gem className="h-3 w-3" /> Belohnungen</span>
          <span />
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
              <Radio className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <div>
              <p className="font-semibold">Noch keine Streams</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Deine vergangenen Live-Sessions erscheinen hier nach dem Stream.
              </p>
            </div>
            <Link
              href={'/live/start' as Route}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-85"
            >
              <Radio className="h-4 w-4" />
              Jetzt live gehen
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {sessions.map((s) => {
                const title = s.title?.trim() || 'Unbenannter Stream';
                const viewers = s.viewer_count ?? 0;
                const duration = formatDuration(s.duration_secs);
                const date = formatDate(s.started_at);
                const isEnded = s.status === 'ended';

                return (
                  <li key={s.id}>
                    <div className="grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr_0.9fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                      {/* Thumbnail + Title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {s.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.thumbnail_url}
                              alt={title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Radio className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                          {!isEnded && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-500/80">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                            </span>
                          )}
                        </div>
                        <span className="truncate text-sm font-medium">{title}</span>
                      </div>

                      {/* Datum */}
                      <span className="truncate text-sm text-muted-foreground">{date}</span>

                      {/* Dauer */}
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5 shrink-0" />
                        {duration}
                      </span>

                      {/* Aufrufe */}
                      <span className="flex items-center gap-1 text-sm tabular-nums">
                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {viewers.toLocaleString('de-DE')}
                      </span>

                      {/* Neue Follower — noch nicht tracked, Placeholder */}
                      <span className="text-sm tabular-nums text-muted-foreground">0</span>

                      {/* Belohnungen */}
                      <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <Gem className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                        0
                      </span>

                      {/* Detail-Link */}
                      <Link
                        href={isEnded ? `/live/replay/${s.id}` as Route : `/live/${s.id}` as Route}
                        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
              <span>{sessions.length} {sessions.length === 1 ? 'Stream' : 'Streams'} insgesamt</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

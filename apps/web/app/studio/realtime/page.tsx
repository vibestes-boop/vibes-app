import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Radio, Video, Eye, Gem, Heart, MessageCircle, Share2, Users, UserPlus } from 'lucide-react';
import { getActiveLiveSessions } from '@/lib/data/live';
import { getUser } from '@/lib/auth/session';
import { RealtimeStatsClient } from '@/components/studio/realtime-stats-client';

export const metadata: Metadata = {
  title: 'Leistung in Echtzeit',
  description: 'Live-Metriken deines aktiven Streams in Echtzeit.',
};

export const dynamic = 'force-dynamic';

export default async function RealtimePage() {
  const user = await getUser();
  if (!user) return null;

  // Prüfen ob User gerade live ist
  const sessions = await getActiveLiveSessions(50).catch(() => []);
  const mySession = sessions.find((s) => s.host_id === user.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Leistung in Echtzeit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live-Metriken während deines Streams — wird automatisch aktualisiert.
          </p>
        </div>
        {!mySession && (
          <Link
            href={'/live/start' as Route}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-85"
          >
            <Video className="h-4 w-4" />
            Live gehen
          </Link>
        )}
      </header>

      {mySession ? (
        <RealtimeStatsClient sessionId={mySession.id} initialViewerCount={mySession.viewer_count ?? 0} />
      ) : (
        <NotLiveState />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Not-Live placeholder — Short-Video-style "Sieh dir die Metriken an wenn du LIVE bist"
// -----------------------------------------------------------------------------

function NotLiveState() {
  const metrics = [
    { label: 'Gesamtaufrufe',              icon: Eye },
    { label: 'Einnahmen',                  icon: Gem },
    { label: 'Schenkende',                 icon: Users },
    { label: 'Neue Follower*innen',        icon: UserPlus },
    { label: 'Likes',                      icon: Heart },
    { label: 'Zuschauer*innen in Echtzeit', icon: Users },
    { label: 'Kommentare',                 icon: MessageCircle },
    { label: 'Geteilt',                    icon: Share2 },
  ];

  return (
    <>
      {/* Metrics grid — all dashes, like Short-Video when not live */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">Übersicht</p>
            <p className="text-sm text-muted-foreground">Dauer: 0 Minuten</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Nicht aktiv
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          {metrics.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </div>
              <span className="text-xl font-semibold text-muted-foreground">–</span>
            </div>
          ))}
        </div>
      </section>

      {/* Chart placeholder */}
      <section className="rounded-xl border bg-card">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b px-5 py-2.5">
          <span className="rounded-full bg-foreground px-3 py-1 text-sm font-medium text-background">
            Gesamtaufrufe
          </span>
          <span className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground">
            Einnahmen
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Gesamtaufrufe
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              LIVE-Feed-Zuschauer*innen
            </span>
          </div>
        </div>

        {/* Empty chart */}
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
          <Radio className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Sieh dir die Metriken an, wenn du LIVE bist.
          </p>
          <Link
            href={'/live/start' as Route}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Video className="h-3.5 w-3.5" />
            Stream starten
          </Link>
        </div>
      </section>
    </>
  );
}

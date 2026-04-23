import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowLeft, Flag } from 'lucide-react';
import {
  getLiveSession,
  getLiveComments,
  getActiveLivePoll,
  getActiveCoHosts,
  getIsFollowingHost,
  getIsSessionModerator,
} from '@/lib/data/live';
import { getUser } from '@/lib/auth/session';
import { LiveVideoPlayer } from '@/components/live/live-video-player';
import { LiveChat } from '@/components/live/live-chat';
import { LiveActionBar } from '@/components/live/live-action-bar';
import { LivePollPanel } from '@/components/live/live-poll-panel';
import { LiveHostCard } from '@/components/live/live-host-card';
import { LiveHostPill } from '@/components/live/live-host-pill';
import { LiveEnterClient } from '@/components/live/live-enter-client';

// -----------------------------------------------------------------------------
// /live/[id] — der Viewer. Layout:
//   ┌──────────────────────────┬─────────────┐
//   │                          │   HostCard  │
//   │                          ├─────────────┤
//   │      LiveVideoPlayer     │   Poll      │
//   │        (LiveKit)         ├─────────────┤
//   │                          │             │
//   │                          │   Chat      │
//   │                          │   Comments  │
//   ├──────────────────────────┤             │
//   │      LiveActionBar       │             │
//   │  (Reactions/Gifts/CoHost)│             │
//   └──────────────────────────┴─────────────┘
// Auf Mobile (< lg) stackt alles vertikal.
// -----------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return { title: 'Live' };
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Serlo';
  const title = session.title ?? `Live mit ${hostName}`;
  const description = session.title
    ? `${hostName} streamt jetzt live auf Serlo: ${session.title}`
    : `${hostName} streamt jetzt live auf Serlo.`;
  const thumbnail = session.thumbnail_url ?? undefined;

  return {
    title: `${title} — Live`,
    description,
    alternates: { canonical: `/live/${id}` },
    openGraph: {
      type: 'video.other',
      title,
      description,
      url: `/live/${id}`,
      siteName: 'Serlo',
      images: thumbnail ? [{ url: thumbnail, width: 1080, height: 1920 }] : undefined,
    },
    twitter: {
      // Live-Streams bekommen summary_large_image statt `player` — Twitter-Player
      // bräuchte eine spezielle HTTPS-Embed-Page + iFrame-Freigabe, die
      // LiveKit-Viewer so nicht bereitstellt. Large-Image-Thumbnail reicht
      // praktisch für alle Clipboard/Share-Sheet-Use-Cases.
      card: 'summary_large_image',
      title,
      description,
      images: thumbnail ? [thumbnail] : undefined,
    },
  };
}

// Viewer-Counts, Chat-Initial-Snapshot → immer frisch. Client übernimmt ab Mount
// die Realtime-Subscription via `live-comments-{id}` / `live:{id}`.
export const dynamic = 'force-dynamic';

export default async function LiveViewerPage({ params }: PageProps) {
  const { id } = await params;

  const [session, user] = await Promise.all([getLiveSession(id), getUser()]);

  if (!session) notFound();

  // Initial-State für Client-Komponenten
  const [comments, activePoll, cohosts, isFollowing, isModerator] = await Promise.all([
    getLiveComments(id, 50),
    getActiveLivePoll(id),
    getActiveCoHosts(id),
    user ? getIsFollowingHost(session.host_id) : Promise.resolve(false),
    user ? getIsSessionModerator(id) : Promise.resolve(false),
  ]);

  const ended = session.status !== 'active';
  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const viewerId = user?.id ?? null;
  const isHost = viewerId === session.host_id;

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-0 py-0 lg:grid lg:grid-cols-[1fr_380px] lg:gap-4 lg:p-4">
      {/* Join/Leave Tracking — nur Client, kein UI */}
      {viewerId && <LiveEnterClient sessionId={id} />}

      {/* Main-Column: Video + Action-Bar */}
      <main className="flex min-w-0 flex-col gap-3">
        {/* Zurück-Leiste (mobile sticky, desktop normal) */}
        <div className="flex items-center justify-between px-4 pt-3 lg:px-0 lg:pt-0">
          <Link
            href={'/live' as Route}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zu Live
          </Link>
          {viewerId && !isHost && (
            <Link
              href={`/live/${id}/report` as Route}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500"
            >
              <Flag className="h-3.5 w-3.5" />
              Melden
            </Link>
          )}
        </div>

        {/* Video-Container */}
        <div className="relative aspect-video w-full overflow-hidden bg-black lg:rounded-xl">
          {ended ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
              {session.thumbnail_url && (
                <Image
                  src={session.thumbnail_url}
                  alt={session.title ?? 'Beendet'}
                  fill
                  sizes="100vw"
                  className="object-cover opacity-30"
                />
              )}
              <div className="relative z-10 text-center">
                <p className="text-lg font-semibold">Stream beendet</p>
                <p className="mt-1 text-sm text-white/60">
                  {hostName} ist nicht mehr live. Vielleicht gibt&apos;s einen Replay.
                </p>
                <Link
                  href={`/live/replay/${id}` as Route}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
                >
                  Replay ansehen
                </Link>
              </div>
            </div>
          ) : (
            <LiveVideoPlayer
              sessionId={id}
              roomName={session.room_name}
              hostId={session.host_id}
              hostName={hostName}
            />
          )}

          {/* Host-Pill (v1.w.UI.1 — B5 aus UI_AUDIT_WEB).
              Ersetzt die bisherigen getrennten Live-Badge + Users-Count-Chips
              durch eine einzige Identitäts-Pill mit Avatar + Name + Viewer-
              Count + inline Follow-CTA. Live-Marker bleibt als separate rote
              Mini-Pill daneben, damit das rote Farbsignal (= jetzt-live) nicht
              in der dunklen Host-Pill aufgeht. */}
          <LiveHostPill
            session={session}
            viewerId={viewerId}
            initialFollowing={isFollowing}
            ended={ended}
          />
        </div>

        {/* Action-Bar — Reactions + Gifts + CoHost-Request */}
        {!ended && viewerId && (
          <div className="px-4 lg:px-0">
            <LiveActionBar
              sessionId={id}
              hostId={session.host_id}
              hostName={hostName}
              viewerId={viewerId}
              isHost={isHost}
              cohosts={cohosts}
            />
          </div>
        )}

        {/* Session-Title + Host unterhalb des Players (für Mobile) */}
        <div className="px-4 lg:hidden">
          <h1 className="text-lg font-semibold leading-snug">
            {session.title ?? 'Unbenannter Stream'}
          </h1>
        </div>
      </main>

      {/* Side-Column: HostCard + Poll + Chat */}
      <aside className="flex min-h-[500px] min-w-0 flex-col gap-3 px-4 lg:max-h-[calc(100vh-2rem)] lg:px-0">
        <LiveHostCard
          session={session}
          viewerId={viewerId}
          initialFollowing={isFollowing}
        />

        {activePoll && (
          <LivePollPanel
            sessionId={id}
            poll={activePoll}
            viewerId={viewerId}
          />
        )}

        <LiveChat
          sessionId={id}
          initialComments={comments}
          hostId={session.host_id}
          viewerId={viewerId}
          isHost={isHost}
          isModerator={isModerator}
          slowModeSeconds={session.slow_mode_seconds ?? 0}
          ended={ended}
        />
      </aside>
    </div>
  );
}

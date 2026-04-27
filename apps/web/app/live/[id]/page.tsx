import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowLeft, Flag, Users } from 'lucide-react';
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
import { LiveActionBar } from '@/components/live/live-action-bar';
import { LivePollPanel } from '@/components/live/live-poll-panel';
import { LiveHostPill } from '@/components/live/live-host-pill';
import { LiveChatOverlay } from '@/components/live/live-chat-overlay';
import { LiveEnterClient } from '@/components/live/live-enter-client';
import { LiveGiftAnimationLayer } from '@/components/live/live-gift-animation-layer';
import {
  glassPillStrong,
  glassSurface,
  glassSurfaceDense,
} from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /live/[id] — der Viewer. TikTok-style Overlay-Architektur (Phase 2, B1+B2+B5):
//
//   ┌────────────────────────────────────────┐
//   │ ← zurück       [melden]               │   ← top-bar (auf Canvas überlagert)
//   │                                       │
//   │   ┌──────────────────────────┐        │
//   │   │ 🔴 LIVE  👁 1.2k         │        │   ← top-left stack
//   │   │ [avatar] Host [Folgen]   │        │     Host-Pill (B5)
//   │   │ Stream-Titel…            │        │
//   │   │                          │ [Poll] │   ← Poll rechts als Card
//   │   │       (Video 9:16)       │        │
//   │   │                          │        │
//   │   │  [chat-overlay]          │        │   ← Chat links unten (B2)
//   │   │   [nachricht pill]       │        │      mask-image fade top
//   │   │   [nachricht pill]       │        │
//   │   │  [input pill] [send]     │        │
//   │   │                          │        │
//   │   │ [❤️ 🔥 🎁 ...] Action-Bar│        │   ← unten (bestehend)
//   │   └──────────────────────────┘        │
//   │   (seitliche Black-Letterboxes        │
//   │    auf desktop-Weiten)                │
//   └────────────────────────────────────────┘
//
// Auf Portrait-Mobile ist der 9:16 Canvas = Viewport, die Letterboxes fallen weg.
// Auf breiten Desktops ist er ein zentrales Rechteck — der Rest des Canvas
// bleibt dunkel (#0b0b10), erzeugt den „phone viewport in the middle"-Effekt,
// den TikTok/YouTube-Shorts im Web ebenfalls nutzen.
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

  // v1.w.UI.136 — CoHost Duet-Layout: ersten aktiven CoHost an LiveVideoPlayer übergeben.
  const activeCoHost = cohosts[0] ?? null;
  const coHostId = activeCoHost?.user_id ?? null;
  const coHostName = activeCoHost?.profile?.username ?? null;

  // ── JSON-LD: BroadcastEvent + VideoObject schema ──────────────────────────
  // BroadcastEvent: Google uses this to show a "LIVE" badge in search results
  // when the stream is active (eventStatus = EventScheduled/InProgress).
  // Combined with VideoObject so embedded players can be indexed.
  // v1.w.UI.134 — JSON-LD structured data batch.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://serlo.app';
  const liveJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BroadcastEvent',
    name: session.title ?? `Live mit ${hostName}`,
    description: session.title
      ? `${hostName} streamt live auf Serlo: ${session.title}`
      : `${hostName} streamt live auf Serlo.`,
    startDate: session.started_at,
    ...(ended && session.ended_at ? { endDate: session.ended_at } : {}),
    eventStatus: ended
      ? 'https://schema.org/EventEnded'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: `${siteUrl}/live/${session.id}` },
    organizer: {
      '@type': 'Person',
      name: hostName,
      ...(session.host?.username ? { url: `${siteUrl}/u/${session.host.username}` } : {}),
    },
    ...(session.thumbnail_url ? { image: session.thumbnail_url } : {}),
    workFeatured: {
      '@type': 'VideoObject',
      name: session.title ?? `Live mit ${hostName}`,
      thumbnailUrl: session.thumbnail_url ?? undefined,
      uploadDate: session.started_at,
      embedUrl: `${siteUrl}/live/${session.id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(liveJsonLd) }}
      />
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#0b0b10]">
      {/* Join/Leave Tracking — nur Client, kein UI */}
      {viewerId && <LiveEnterClient sessionId={id} />}

      {/* Canvas — flex-centered 9:16 Frame. Padding damit der Frame auf breiten
          Viewports nicht an die Bildschirmränder klebt. */}
      <div className="absolute inset-0 flex items-center justify-center md:p-4">
        <div className="relative h-full w-full max-h-full md:aspect-[9/16] md:h-full md:w-auto md:max-w-full md:overflow-hidden md:rounded-2xl md:shadow-elevation-4">
          {/* Video-Layer — füllt den 9:16-Frame vollständig. Player selbst
              nutzt object-contain, schwarze Letterboxes innerhalb des Frames
              falls der tatsächliche Track-Aspect vom 9:16 abweicht. */}
          <div className="absolute inset-0 bg-black">
            {ended ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
                {session.thumbnail_url && (
                  <Image
                    src={session.thumbnail_url}
                    alt={session.title ?? 'Beendet'}
                    fill
                    sizes="(min-width: 768px) 540px, 100vw"
                    className="object-cover opacity-30"
                  />
                )}
                <div className="relative z-10 px-6 text-center">
                  <p className="text-lg font-semibold">Stream beendet</p>
                  <p className="mt-1 text-sm text-white/60">
                    {hostName} ist nicht mehr live. Vielleicht gibt&apos;s einen Replay.
                  </p>
                  <Link
                    href={`/live/replay/${id}` as Route}
                    className={cn(
                      glassPillStrong,
                      'mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow-elevation-1',
                    )}
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
                coHostId={coHostId}
                coHostName={coHostName}
              />
            )}
          </div>

          {/*
           * Top-Overlay — Gradient-Shade für Lesbarkeit der Host-Pill gegen
           * helle Video-Frames (z. B. Daylight-Streams). Rein dekorativ,
           * `pointer-events-none` damit Video-Controls darunter klickbar
           * bleiben (Reserved für Phase 2 B4 Maximize).
           */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

          {/*
           * Gift-Animation-Layer (v1.w.UI.17, B3) — subscribed auf
           * `live_gifts` INSERT, spawnt float-up-Bursts über dem Video.
           * Eigene z-20, absolute inset-0, pointer-events-none — stört
           * keine Controls. Nur während Stream aktiv sinnvoll.
           */}
          {!ended && <LiveGiftAnimationLayer sessionId={id} />}

          {/* Top-Bar: Back-Link links, Melden rechts */}
          <div className="absolute inset-x-3 top-3 flex items-center justify-between">
            <Link
              href={'/live' as Route}
              className={cn(
                glassPillStrong,
                'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-elevation-1',
              )}
              aria-label="Zurück zu Live"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {viewerId && !isHost && (
              <Link
                href={`/live/${id}/report` as Route}
                className={cn(
                  glassPillStrong,
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-white/85 shadow-elevation-1 hover:text-white',
                )}
              >
                <Flag className="h-3 w-3" />
                Melden
              </Link>
            )}
          </div>

          {/* Top-Left-Stack: Live-Badge + Viewer-Count + Host-Pill + Titel */}
          {!ended && (
            <div className="absolute left-3 top-14 flex max-w-[75%] flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-elevation-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
                <span
                  className={cn(
                    glassSurfaceDense,
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-white shadow-elevation-1',
                  )}
                >
                  <Users className="h-3 w-3" />
                  {(session.viewer_count ?? 0).toLocaleString('de-DE')}
                </span>
              </div>
              <LiveHostPill
                session={session}
                viewerId={viewerId}
                initialFollowing={isFollowing}
              />
              {session.title && (
                <p className="line-clamp-2 max-w-full rounded-xl bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white shadow-elevation-1 backdrop-blur-md">
                  {session.title}
                </p>
              )}
            </div>
          )}

          {/*
           * Top-Right: Poll (wenn aktiv) — unterhalb der Video-Controls
           * (`top-14 right-3` im LiveVideoPlayer) positioniert auf `top-28`,
           * damit Mute/Fullscreen + Poll kollisionsfrei stapeln. Feste Breite
           * + transparent-gefärbte Hülle um das bestehende LivePollPanel
           * (das selbst `bg-card` nutzt — wir stellen den Overlay-Background
           * außen vor das Panel und neutralisieren die innere Card-Bordüre
           * via Arbitrary-Value-Child-Selector).
           */}
          {!ended && activePoll && (
            <div className="absolute right-3 top-28 w-64 max-w-[55%]">
              <div className={cn(glassSurface, 'rounded-2xl p-1 shadow-elevation-2')}>
                <div className="[&_h3]:text-white [&_.rounded-xl]:bg-transparent [&_.rounded-xl]:!border-0 [&_.rounded-xl]:!p-2">
                  <LivePollPanel
                    sessionId={id}
                    poll={activePoll}
                    viewerId={viewerId}
                  />
                </div>
              </div>
            </div>
          )}

          {/*
           * Chat-Overlay — links-unten, ABOVE der Action-Bar. Eigene compose-
           * pill am unteren Rand, mask-fade am oberen Rand damit ältere
           * Nachrichten optisch in den Video-Canvas auslaufen. Breite auf der
           * linken Hälfte geklemmt, damit der Poll-Panel rechts und der
           * Host-Stack oben sichtbar bleiben. Outer-Container ist bereits
           * `pointer-events-none` (vom LiveChatOverlay selbst) — wir platzieren
           * nur, die Komponente verwaltet Hit-Areas selbst (Input + Timeout-
           * Menü werden `pointer-events-auto` gesetzt).
           */}
          {!ended && (
            <div className="absolute bottom-20 left-3 right-3 sm:right-auto sm:w-[62%] sm:max-w-[420px]">
              <LiveChatOverlay
                sessionId={id}
                initialComments={comments}
                hostId={session.host_id}
                viewerId={viewerId}
                isHost={isHost}
                isModerator={isModerator}
                slowModeSeconds={session.slow_mode_seconds ?? 0}
                ended={ended}
              />
            </div>
          )}

          {/* Action-Bar (unten) — Reactions + Gifts + CoHost-Request */}
          {!ended && viewerId && (
            <div className="absolute inset-x-3 bottom-3">
              <div
                className={cn(
                  glassSurface,
                  'rounded-2xl shadow-elevation-2 [&>*]:!border-0 [&>*]:!bg-transparent',
                )}
              >
                <LiveActionBar
                  sessionId={id}
                  hostId={session.host_id}
                  hostName={hostName}
                  viewerId={viewerId}
                  isHost={isHost}
                  cohosts={cohosts}
                  isModerator={isModerator}
                  activePoll={activePoll}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}

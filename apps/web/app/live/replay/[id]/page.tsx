import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowLeft, Radio, Clock } from 'lucide-react';
import {
  getLiveSession,
  getLiveRecording,
  getClipMarkers,
} from '@/lib/data/live';
import { ReplayPlayer } from '@/components/live/replay-player';

function formatShortDuration(since: Date): string {
  const deltaMs = Date.now() - since.getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
}

// -----------------------------------------------------------------------------
// /live/replay/[id] — VOD-Player für abgeschlossene Streams. Zeigt:
//  • Video-Player mit mp4/hls aus `live_recordings.playback_url`
//  • Clip-Marker als Seek-Chips unter dem Player
//  • Session-Meta (Titel, Host, Peak-Viewer, Dauer)
// -----------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return { title: 'Replay' };
  return {
    title: `Replay — ${session.title ?? 'Live-Aufnahme'}`,
    description: `Aufzeichnung des Streams vom ${session.started_at ?? ''}`,
  };
}

export const dynamic = 'force-dynamic';

export default async function ReplayPage({ params }: PageProps) {
  const { id } = await params;

  const [session, recording, clipMarkers] = await Promise.all([
    getLiveSession(id),
    getLiveRecording(id),
    getClipMarkers(id),
  ]);

  if (!session) notFound();

  const hostName = session.host?.display_name ?? session.host?.username ?? 'Unbekannt';
  const isReady = recording?.status === 'ready' && Boolean(recording.playback_url);

  // ── JSON-LD: VideoObject schema ──────────────────────────────────────────
  // Allows Google to index replays as video content — shows in Video Search
  // and video rich results. Only emitted when recording is ready (has URL).
  // Duration ISO 8601 format: PT<M>M<S>S.
  // v1.w.UI.133 — JSON-LD structured data batch.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://serlo.app';
  const videoJsonLd =
    isReady && recording
      ? {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: session.title ?? 'Live-Aufnahme',
          description: `Live-Stream von ${hostName} auf Serlo.`,
          thumbnailUrl: session.thumbnail_url ?? undefined,
          contentUrl: recording.playback_url,
          embedUrl: `${siteUrl}/live/replay/${session.id}`,
          uploadDate: recording.finished_at ?? session.ended_at ?? session.started_at,
          ...(recording.duration_secs
            ? {
                duration: `PT${Math.floor(recording.duration_secs / 60)}M${recording.duration_secs % 60}S`,
              }
            : {}),
          author: {
            '@type': 'Person',
            name: hostName,
            ...(session.host?.username
              ? { url: `${siteUrl}/u/${session.host.username}` }
              : {}),
          },
          publisher: {
            '@type': 'Organization',
            name: 'Serlo',
            url: siteUrl,
          },
          ...(session.peak_viewer_count && session.peak_viewer_count > 0
            ? {
                interactionStatistic: {
                  '@type': 'InteractionCounter',
                  interactionType: 'https://schema.org/WatchAction',
                  userInteractionCount: session.peak_viewer_count,
                },
              }
            : {}),
        }
      : null;

  return (
    <>
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
        />
      )}
      <div className="mx-auto max-w-[1400px] px-4 py-4 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={'/live' as Route}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Live
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
          <Clock className="h-3 w-3" />
          Replay
        </span>
      </div>

      {/* Video-Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {!recording || !isReady ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
            {session.thumbnail_url && (
              <Image
                src={session.thumbnail_url}
                alt={session.title ?? 'Replay'}
                fill
                sizes="100vw"
                className="object-cover opacity-30"
              />
            )}
            <div className="relative z-10 text-center">
              <Radio className="mx-auto h-10 w-10 text-white/50" />
              <p className="mt-2 text-sm font-medium">
                {recording?.status === 'processing'
                  ? 'Replay wird gerade verarbeitet…'
                  : recording?.status === 'failed'
                    ? 'Aufzeichnung fehlgeschlagen.'
                    : 'Keine Aufzeichnung verfügbar.'}
              </p>
              <p className="mt-1 text-xs text-white/50">
                Streams werden optional aufgezeichnet. Diese Session hat entweder kein Recording
                gestartet oder es läuft noch.
              </p>
            </div>
          </div>
        ) : (
          <ReplayPlayer
            src={recording.playback_url!}
            poster={session.thumbnail_url ?? undefined}
            clipMarkers={clipMarkers}
          />
        )}
      </div>

      {/* Session-Meta */}
      <div className="mt-4 flex items-start gap-4">
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted">
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
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight">
            {session.title ?? 'Unbenannter Stream'}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link
              href={session.host?.username ? (`/u/${session.host.username}` as Route) : ('#' as Route)}
              className="font-medium text-foreground hover:underline"
            >
              {hostName}
            </Link>
            {session.peak_viewer_count && session.peak_viewer_count > 0 && (
              <span>Peak: {session.peak_viewer_count.toLocaleString('de-DE')} Zuschauer</span>
            )}
            {session.started_at && (
              <span>vor {formatShortDuration(new Date(session.started_at))}</span>
            )}
          </div>
        </div>
      </div>

      {clipMarkers.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {clipMarkers.length} Clip-Marker von Viewern. Klicke auf einen Chip im Player, um zur
          Stelle zu springen.
        </p>
      )}
    </div>
    </>
  );
}

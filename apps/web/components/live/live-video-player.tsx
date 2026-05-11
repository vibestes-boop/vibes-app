'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  VideoQuality,
} from 'livekit-client';
import { Check, Loader2, Maximize2, Radio, Settings2, Volume2, VolumeX } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { fetchLiveKitToken } from '@/app/actions/live';
import { glassPillSolid } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LiveVideoPlayer — reines Subscribe/Render. Keine Publisher-Logik (Web ist
// v1.w.5 Viewer-only). Holt Token via Server-Action, connected zu LiveKit,
// attacht den ersten Video-Track des Hosts ans <video>-Element.
//
// v1.w.UI.136 — Phase 6 CoHost Duet-Layout:
// Wenn coHostId gesetzt und der CoHost publisht, wechselt der Player in ein
// Split-Layout. Audio von Host + CoHost werden gemischt (LiveKit clientseitig).
//
// v1.w.UI.210 — Layout-aware Rendering:
// Subscribt auf co-host-signals-{sessionId} Broadcast → reagiert auf
// co-host-accepted / co-host-layout-changed / co-host-ended und schaltet
// zwischen 'top-bottom' (vertikal) und 'side-by-side' (horizontal) um.
// 'battle' wird wie 'side-by-side' gerendert (Scores/Bar via LiveBattleOverlay).
// 'pip' wird nicht unterstützt (Web-PiP erfordert Picture-in-Picture API,
// separates Future-Feature v1.w.UI.211).
// Mobile parity: useCoHostViewer layout state in lib/useCoHost.ts.
// -----------------------------------------------------------------------------

type DuetLayout = 'top-bottom' | 'side-by-side';
type PlayerQuality = 'auto' | 'medium' | 'low';
type FitMode = 'contain' | 'cover';

const PLAYER_QUALITY_LABELS: Record<PlayerQuality, string> = {
  auto: 'Automatisch',
  medium: 'Mittel',
  low: 'Sparmodus',
};

function liveKitQualityFor(mode: PlayerQuality) {
  if (mode === 'low') return VideoQuality.LOW;
  if (mode === 'medium') return VideoQuality.MEDIUM;
  return VideoQuality.HIGH;
}

function applyPublicationQuality(
  publication: RemoteTrackPublication | null,
  mode: PlayerQuality,
) {
  if (!publication || publication.kind !== Track.Kind.Video) return;
  publication.setVideoQuality(liveKitQualityFor(mode));
}

function supaClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface LiveVideoPlayerProps {
  sessionId: string;
  roomName: string;
  hostId: string;
  hostName: string;
  /** User-ID des aktiven CoHosts (aus live_cohosts DB). Wenn gesetzt, wird dessen
   *  Video-Track im Split des Duet-Layouts angezeigt. */
  coHostId?: string | null;
  /** Anzeigename des CoHosts für das GUEST-Label im Split. */
  coHostName?: string | null;
}

export function LiveVideoPlayer({
  sessionId,
  roomName,
  hostId,
  hostName,
  coHostId,
  coHostName,
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const coVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const hostVideoPublicationRef = useRef<RemoteTrackPublication | null>(null);
  const coHostVideoPublicationRef = useRef<RemoteTrackPublication | null>(null);
  const playerQualityRef = useRef<PlayerQuality>('auto');
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'error' | 'ended'>(
    'connecting',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(true); // Auto-Play-Policy: Start muted, User tappt Unmute
  const [coHostActive, setCoHostActive] = useState(false); // true = CoHost publisht gerade Video
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerQuality, setPlayerQuality] = useState<PlayerQuality>('auto');
  const [fitMode, setFitMode] = useState<FitMode>('contain');

  // v1.w.UI.210 — Layout state, driven by co-host-signals broadcast.
  // Default 'top-bottom' (vertical split); switches to 'side-by-side' for
  // side-by-side and battle layouts (both use horizontal video split).
  const [duetLayout, setDuetLayout] = useState<DuetLayout>('top-bottom');

  // -----------------------------------------------------------------------------
  // v1.w.UI.210 — Subscribe to co-host-signals for layout changes
  // Channel: co-host-signals-{sessionId} (same channel LiveBattleOverlay uses)
  // Events: co-host-accepted, co-host-layout-changed, co-host-ended
  // -----------------------------------------------------------------------------
  useEffect(() => {
    if (!coHostId) {
      setDuetLayout('top-bottom');
      return;
    }
    const supa = supaClient();
    const ch = supa
      .channel(`co-host-layout-${sessionId}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on('broadcast', { event: 'co-host-accepted' }, ({ payload }) => {
        const { layout } = payload as { layout?: string };
        setDuetLayout(layout === 'side-by-side' || layout === 'battle' ? 'side-by-side' : 'top-bottom');
      })
      .on('broadcast', { event: 'co-host-layout-changed' }, ({ payload }) => {
        const { layout } = payload as { layout?: string };
        setDuetLayout(layout === 'side-by-side' || layout === 'battle' ? 'side-by-side' : 'top-bottom');
      })
      .on('broadcast', { event: 'co-host-ended' }, () => {
        setDuetLayout('top-bottom');
      })
      .subscribe();

    return () => {
      supa.removeChannel(ch);
    };
  }, [sessionId, coHostId]);

  // -----------------------------------------------------------------------------
  // Connect-Flow
  // -----------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: false });
    roomRef.current = room;

    async function connect() {
      setPhase('connecting');
      const tokenResult = await fetchLiveKitToken(roomName, false);
      if (cancelled) return;
      if (!tokenResult.ok) {
        setErrorMsg(tokenResult.error);
        setPhase('error');
        return;
      }

      try {
        await room.connect(tokenResult.data.url, tokenResult.data.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setPhase('live');

        // Existierende Publications direkt mounten (falls Host/CoHost schon publishen)
        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.track && pub.isSubscribed) attachTrack(p, pub);
          });
        });
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.');
        setPhase('error');
      }
    }

    // -----------------------------------------------------------------------------
    // Track-Attach-Handler
    // v1.w.UI.136: CoHost-Video jetzt explizit an coVideoRef gehängt statt ignoriert.
    // coVideoRef ist immer im DOM (hidden wenn coHostActive=false), damit
    // track.attach() sofort greift ohne React-Render-Cycle abwarten zu müssen.
    // -----------------------------------------------------------------------------
    function attachTrack(participant: RemoteParticipant, publication: RemoteTrackPublication) {
      const track = publication.track;
      if (!track) return;

      if (track.kind === Track.Kind.Video) {
        if (participant.identity === hostId) {
          // Host-Video → primärer Player
          hostVideoPublicationRef.current = publication;
          applyPublicationQuality(publication, playerQualityRef.current);
          if (videoRef.current) track.attach(videoRef.current);
        } else if (coHostId && participant.identity === coHostId) {
          // CoHost-Video → duet-slot (v1.w.UI.136, war zuvor ignoriert)
          coHostVideoPublicationRef.current = publication;
          applyPublicationQuality(publication, playerQualityRef.current);
          if (coVideoRef.current) {
            track.attach(coVideoRef.current);
            setCoHostActive(true);
          }
        }
        // Alle weiteren Teilnehmer-Videos werden ignoriert
      } else if (track.kind === Track.Kind.Audio) {
        // Audio von Host + CoHost beide mischen (LiveKit macht Mixing clientseitig)
        if (audioRef.current) track.attach(audioRef.current);
      }
    }

    function onSubscribed(
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) {
      attachTrack(participant, publication);
    }

    function onUnsubscribed(
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) {
      track.detach();

      if (track.kind === Track.Kind.Video) {
        if (participant.identity === hostId) {
          // Host hat Video gestoppt → zurück zu Loading-State (Session evtl. beendet)
          if (hostVideoPublicationRef.current === publication) hostVideoPublicationRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
        } else if (coHostId && participant.identity === coHostId) {
          // CoHost hat Video gestoppt → duet-slot wieder ausblenden
          if (coHostVideoPublicationRef.current === publication) {
            coHostVideoPublicationRef.current = null;
          }
          setCoHostActive(false);
        }
      }
    }

    function onDisconnected() {
      if (cancelled) return;
      setPhase('ended');
    }

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    room.on(RoomEvent.Disconnected, onDisconnected);

    connect();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.disconnect();
      roomRef.current = null;
      hostVideoPublicationRef.current = null;
      coHostVideoPublicationRef.current = null;
    };

  }, [roomName, hostId, coHostId]);

  // Reset coHostActive wenn coHostId wegfällt (CoHost revoked zwischen Renders)
  useEffect(() => {
    if (!coHostId) setCoHostActive(false);
  }, [coHostId]);

  // -----------------------------------------------------------------------------
  // Fullscreen — target ist der äußere 9:16-Frame-Container
  // -----------------------------------------------------------------------------
  const goFullscreen = () => {
    const el = videoRef.current?.closest('.md\\:aspect-\\[9\\/16\\]') as HTMLElement | null
      ?? videoRef.current?.parentElement?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const handleQualityChange = (nextQuality: PlayerQuality) => {
    playerQualityRef.current = nextQuality;
    setPlayerQuality(nextQuality);
    applyPublicationQuality(hostVideoPublicationRef.current, nextQuality);
    applyPublicationQuality(coHostVideoPublicationRef.current, nextQuality);
  };

  const hostVideoClassName = cn(
    'h-full w-full',
    fitMode === 'cover' ? 'object-cover' : 'object-contain',
  );
  const splitVideoClassName = cn(
    'h-full w-full',
    fitMode === 'cover' ? 'object-cover' : 'object-contain',
  );

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="relative h-full w-full overflow-hidden bg-black xl:overflow-visible">

      {/* ── Video-Layer ──────────────────────────────────────────────────── */}
      {coHostActive ? (
        duetLayout === 'side-by-side' ? (
          /* v1.w.UI.210 — Side-by-side layout: Host left, CoHost right.
             Used for 'side-by-side' and 'battle' duet layouts. */
          <>
            {/* Host — linke Hälfte */}
            <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
              <video
                ref={videoRef}
                className={splitVideoClassName}
                autoPlay
                playsInline
                muted={muted}
              />
              <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                {hostName}
              </span>
            </div>
            {/* Hairline divider */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-px bg-white/20" />
            {/* CoHost — rechte Hälfte */}
            <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
              <video
                ref={coVideoRef}
                className={splitVideoClassName}
                autoPlay
                playsInline
                muted={muted}
              />
              <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                {coHostName ?? 'Guest'}
              </span>
            </div>
          </>
        ) : (
          /* Default — top-bottom layout (v1.w.UI.136): Host oben, CoHost unten */
          <>
            {/* Host — obere Hälfte */}
            <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
              <video
                ref={videoRef}
                className={splitVideoClassName}
                autoPlay
                playsInline
                muted={muted}
              />
              <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                {hostName}
              </span>
            </div>
            {/* Hairline divider */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-px bg-white/20" />
            {/* CoHost — untere Hälfte */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">
              <video
                ref={coVideoRef}
                className={splitVideoClassName}
                autoPlay
                playsInline
                muted={muted}
              />
              <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                {coHostName ?? 'Guest'}
              </span>
            </div>
          </>
        )
      ) : (
        /* Solo-Layout: Host im Vollbild. coVideoRef bleibt im DOM damit
           track.attach() sofort greifen kann wenn CoHost joined. */
        <>
          <video
            ref={videoRef}
            className={hostVideoClassName}
            autoPlay
            playsInline
            muted={muted}
          />
          <video
            ref={coVideoRef}
            className="hidden"
            autoPlay
            playsInline
            muted={muted}
            aria-hidden="true"
          />
        </>
      )}

      <audio ref={audioRef} autoPlay />

      {/* Loading/Error/Ended Overlays */}
      {phase !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
          {phase === 'connecting' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-white/70">Verbinde zu {hostName}…</p>
            </>
          )}
          {phase === 'error' && (
            <>
              <Radio className="h-8 w-8 text-red-400" />
              <p className="text-sm text-white/80">Verbindung fehlgeschlagen</p>
              {errorMsg && <p className="max-w-md text-xs text-white/50">{errorMsg}</p>}
            </>
          )}
          {phase === 'ended' && (
            <>
              <Radio className="h-8 w-8 text-white/40" />
              <p className="text-sm text-white/80">Stream beendet</p>
            </>
          )}
        </div>
      )}

      {/* Controls — unten rechts (v1.w.UI.15 glassPillSolid, B4 aus UI_AUDIT_WEB). */}
      {phase === 'live' && (
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute bottom-24 right-3 flex items-center gap-2 sm:bottom-5 xl:bottom-2 xl:left-[calc(100%+0.875rem)] xl:right-auto xl:top-auto xl:flex-col">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className={cn(glassPillSolid, 'rounded-full p-3 shadow-elevation-2')}
                aria-label="Player-Einstellungen"
                aria-expanded={settingsOpen}
              >
                <Settings2 className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setMuted((m) => !m);
              }}
              className={cn(glassPillSolid, 'rounded-full p-3 shadow-elevation-2')}
              aria-label={muted ? 'Ton einschalten' : 'Stumm schalten'}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                goFullscreen();
              }}
              className={cn(glassPillSolid, 'rounded-full p-3 shadow-elevation-2')}
              aria-label="Vollbild"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          </div>

          {settingsOpen && (
            <div className="pointer-events-auto fixed bottom-32 right-4 z-[90] max-h-[min(30rem,calc(100dvh-8rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#07080d] text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-black/70 xl:absolute xl:bottom-2 xl:left-[calc(100%+4.25rem)] xl:right-auto xl:max-h-[min(24rem,calc(100dvh-6rem))] xl:w-72">
              <div className="border-b border-white/12 px-4 py-3">
                <p className="text-sm font-bold">Wiedergabe</p>
                <p className="mt-0.5 text-xs text-white/70">
                  Qualität und Bildausschnitt für diesen Stream.
                </p>
              </div>

              <div className="space-y-1 p-2">
                <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  Qualität
                </p>
                {(['auto', 'medium', 'low'] as const).map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => handleQualityChange(quality)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      playerQuality === quality ? 'bg-white/16 text-white' : 'text-white/85 hover:bg-white/10',
                    )}
                  >
                    <span>{PLAYER_QUALITY_LABELS[quality]}</span>
                    {playerQuality === quality && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                ))}

                <div className="my-2 h-px bg-white/12" />

                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  Bild
                </p>
                <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                  <button
                    type="button"
                    onClick={() => setFitMode('contain')}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                      fitMode === 'contain' ? 'bg-white text-zinc-950' : 'bg-white/10 text-white/85 hover:bg-white/14',
                    )}
                  >
                    Einpassen
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitMode('cover')}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                      fitMode === 'cover' ? 'bg-white text-zinc-950' : 'bg-white/10 text-white/85 hover:bg-white/14',
                    )}
                  >
                    Füllen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unmute-Prompt wenn stumm (Auto-Play-Policy) */}
      {phase === 'live' && muted && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/90"
        >
          Zum Einschalten des Tons tippen
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
} from 'livekit-client';
import { Loader2, Radio, VolumeX, Volume2, Maximize2 } from 'lucide-react';
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
// vertikales Split-Layout: Host oben (h-1/2), CoHost unten (h-1/2).
// Beim Verlassen des CoHosts fällt der Player automatisch zurück ins Solo-Layout.
// Audio von Host + CoHost beide mischen (LiveKit macht Mixing clientseitig).
// -----------------------------------------------------------------------------

export interface LiveVideoPlayerProps {
  sessionId: string;
  roomName: string;
  hostId: string;
  hostName: string;
  /** User-ID des aktiven CoHosts (aus live_cohosts DB). Wenn gesetzt, wird dessen
   *  Video-Track im unteren Split des Duet-Layouts angezeigt. */
  coHostId?: string | null;
  /** Anzeigename des CoHosts für das GUEST-Label im Split. */
  coHostName?: string | null;
}

export function LiveVideoPlayer({
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
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'error' | 'ended'>(
    'connecting',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(true); // Auto-Play-Policy: Start muted, User tappt Unmute
  const [coHostActive, setCoHostActive] = useState(false); // true = CoHost publisht gerade Video

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
          if (videoRef.current) track.attach(videoRef.current);
        } else if (coHostId && participant.identity === coHostId) {
          // CoHost-Video → duet-slot (v1.w.UI.136, war zuvor ignoriert)
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
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) {
      track.detach();

      if (track.kind === Track.Kind.Video) {
        if (participant.identity === hostId) {
          // Host hat Video gestoppt → zurück zu Loading-State (Session evtl. beendet)
          if (videoRef.current) videoRef.current.srcObject = null;
        } else if (coHostId && participant.identity === coHostId) {
          // CoHost hat Video gestoppt → duet-slot wieder ausblenden
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">

      {/* ── Video-Layer ──────────────────────────────────────────────────── */}
      {coHostActive ? (
        /* Duet-Layout (v1.w.UI.136): vertikales Split — Host oben, CoHost unten */
        <>
          {/* Host — obere Hälfte */}
          <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
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
              className="h-full w-full object-cover"
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
        /* Solo-Layout: Host im Vollbild. coVideoRef bleibt im DOM damit
           track.attach() sofort greifen kann wenn CoHost joined. */
        <>
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
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
          <div className="pointer-events-auto absolute right-3 top-14 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className={cn(glassPillSolid, 'rounded-full p-3 shadow-elevation-2')}
              aria-label={muted ? 'Ton einschalten' : 'Stumm schalten'}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={goFullscreen}
              className={cn(glassPillSolid, 'rounded-full p-3 shadow-elevation-2')}
              aria-label="Vollbild"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          </div>
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

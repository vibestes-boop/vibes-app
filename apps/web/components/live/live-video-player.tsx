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

// -----------------------------------------------------------------------------
// LiveVideoPlayer — reines Subscribe/Render. Keine Publisher-Logik (Web ist
// v1.w.5 Viewer-only). Holt Token via Server-Action, connected zu LiveKit,
// attacht den ersten Video-Track des Hosts ans <video>-Element.
//
// Multi-Participant-Fall (CoHost aktiv): Wenn mehrere publisht werden, nimmt
// der Player den ersten `participant.identity === hostId` — Duet-Layouts sind
// Phase 6, vorerst rendern wir nur den Host. CoHost-Tracks werden ignoriert
// (LiveKit-SDK subscribed sie aber mit, damit Audio trotzdem durchkommt).
// -----------------------------------------------------------------------------

export interface LiveVideoPlayerProps {
  sessionId: string;
  roomName: string;
  hostId: string;
  hostName: string;
}

export function LiveVideoPlayer({ roomName, hostId, hostName }: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'error' | 'ended'>(
    'connecting',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(true); // Auto-Play-Policy: Start muted, User tappt Unmute

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

        // Existierende Publications direkt mounten (falls Host schon publisht hat)
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
    // Track-Attach-Handler — pro Subscribe-Event oder beim initialen Mount.
    // -----------------------------------------------------------------------------
    function attachTrack(participant: RemoteParticipant, publication: RemoteTrackPublication) {
      const track = publication.track;
      if (!track) return;
      // Host-Video bevorzugen. CoHost-Video ignorieren (Duet-Layouts = Phase 6).
      if (track.kind === Track.Kind.Video) {
        if (participant.identity !== hostId) return;
        if (videoRef.current) track.attach(videoRef.current);
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
      // Host hat Video gestoppt → zurück zu Loading-State (Session evtl. beendet)
      if (track.kind === Track.Kind.Video && participant.identity === hostId) {
        if (videoRef.current) videoRef.current.srcObject = null;
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
  }, [roomName, hostId]);

  // -----------------------------------------------------------------------------
  // Fullscreen
  // -----------------------------------------------------------------------------
  const goFullscreen = () => {
    const el = videoRef.current?.parentElement;
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
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
        muted={muted}
      />
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

      {/* Controls — unten rechts */}
      {phase === 'live' && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
              aria-label={muted ? 'Ton einschalten' : 'Stumm schalten'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={goFullscreen}
              className="rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
              aria-label="Vollbild"
            >
              <Maximize2 className="h-4 w-4" />
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

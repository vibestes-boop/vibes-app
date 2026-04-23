'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  createLocalScreenTracks,
} from 'livekit-client';
import {
  Loader2,
  Radio,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Square,
  Users,
  BarChart3,
  Gift,
  Settings2,
  ChevronDown,
} from 'lucide-react';
import type { LiveSessionWithHost, LiveCommentWithAuthor, ActiveLivePollSSR } from '@/lib/data/live';
import type { SessionGiftRow, ActiveGiftGoal } from '@/lib/data/live-host';
import { fetchLiveKitToken } from '@/app/actions/live';
import {
  endLiveSession,
  heartbeatLiveSession,
  updateLiveSession,
} from '@/app/actions/live-host';
import { LiveChat } from './live-chat';
import { LiveSourcesPanel } from './live-sources-panel';
import { LiveStreamHealth } from './live-stream-health';
import { LiveCoHostQueue } from './live-cohost-queue';
import { LivePollStartSheet } from './live-poll-start-sheet';
import { LiveGiftsFeed } from './live-gifts-feed';

// -----------------------------------------------------------------------------
// LiveHostDeck — OBS-ähnliches Control-Panel für den Host.
//
// Haupt-Bereiche (Desktop-Layout):
//  ┌──────────────────────────────┬──────────────┐
//  │  Preview + Header            │  Chat        │
//  │  (großes Video, Titel-Edit)  │  (Realtime)  │
//  ├──────────────────────────────┤              │
//  │  Sources + Health            │              │
//  │  (Cam/Mic/Screen, Bitrate)   │              │
//  ├──────────────────────────────┤              │
//  │  CoHost-Queue + Gifts        │              │
//  └──────────────────────────────┴──────────────┘
//
// LiveKit-Integration:
//  • Token via fetchLiveKitToken(roomName, false). Die Edge-Function erkennt
//    den Host anhand host_id === JWT-sub und setzt canPublish:true.
//  • Tracks werden lazy erstellt beim Enable-Toggle. Screenshare ersetzt keine
//    Kamera (beide können parallel publishen, wie in OBS).
//  • Device-Prefs aus sessionStorage (gesetzt von /live/start) werden beim
//    ersten Cam-/Mic-Start angewendet.
//
// Heartbeat: alle 30s `heartbeat_live_session` RPC — verhindert Zombie-Cleanup.
// -----------------------------------------------------------------------------

interface DevicePrefs {
  cam: string;
  mic: string;
  camEnabled: boolean;
  micEnabled: boolean;
}

function readDevicePrefs(sessionId: string): DevicePrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`live-host-prefs-${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevicePrefs;
    return parsed;
  } catch {
    return null;
  }
}

export interface LiveHostDeckProps {
  session: LiveSessionWithHost;
  hostId: string;
  initialComments: LiveCommentWithAuthor[];
  initialPoll: ActiveLivePollSSR | null;
  initialGifts: SessionGiftRow[];
  initialGiftGoal: ActiveGiftGoal | null;
}

export function LiveHostDeck({
  session,
  hostId,
  initialComments,
  initialPoll,
  initialGifts,
  initialGiftGoal,
}: LiveHostDeckProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const camTrackRef = useRef<LocalVideoTrack | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const screenVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const screenAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const peakRef = useRef(session.peak_viewer_count ?? 0);

  // Session-State
  const [phase, setPhase] = useState<'connecting' | 'live' | 'error' | 'ending' | 'ended'>(
    'connecting',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Source-Toggles
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [selectedCam, setSelectedCam] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');

  // Meta-State
  const [viewerCount, setViewerCount] = useState(session.viewer_count ?? 0);
  const [peakCount, setPeakCount] = useState(session.peak_viewer_count ?? 0);
  const [durationSecs, setDurationSecs] = useState(() => {
    const started = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    return Math.floor((Date.now() - started) / 1000);
  });

  // Panels
  const [pollSheetOpen, setPollSheetOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title ?? '');
  const [titleEditing, setTitleEditing] = useState(false);
  const [isSavingTitle, startSaveTitle] = useTransition();
  const [isEnding, startEnding] = useTransition();

  // Active-Poll realtime-state — wird LivePollStartSheet runtergereicht
  const [activePoll, setActivePoll] = useState<ActiveLivePollSSR | null>(initialPoll);

  // -----------------------------------------------------------------------------
  // LiveKit-Connect — initial Mount nur einmal
  // -----------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const room = new Room({
      adaptiveStream: false,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoCodec: 'vp8',
      },
    });
    roomRef.current = room;

    async function connect() {
      // `isCoHost=false, isHost=true` — Host-Deck rendert nur, wenn der
      // viewer === session.host_id ist (SSR-Gate in page.tsx). Der Edge-
      // Function-Host-Check verifiziert die Identity nochmal via JWT gegen
      // `live_sessions.host_id` → Publisher-Token nur für echten Host.
      const tokenResult = await fetchLiveKitToken(session.room_name, false, true);
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

        // Device-Prefs vom Setup-Screen anwenden
        const prefs = readDevicePrefs(session.id);
        if (prefs) {
          setSelectedCam(prefs.cam);
          setSelectedMic(prefs.mic);
          setCamEnabled(prefs.camEnabled);
          setMicEnabled(prefs.micEnabled);
          // Initiales Publish
          if (prefs.camEnabled) await enableCam(prefs.cam);
          if (prefs.micEnabled) await enableMic(prefs.mic);
        } else {
          // Fallback — Default-Devices
          await enableCam('');
          await enableMic('');
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.');
        setPhase('error');
      }
    }

    room.on(RoomEvent.ParticipantConnected, () => {
      // Participant-Count ≈ viewer_count — aktualisieren
      const count = room.numParticipants;
      setViewerCount(count);
      if (count > peakRef.current) {
        peakRef.current = count;
        setPeakCount(count);
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      setViewerCount(room.numParticipants);
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setPhase('ended');
    });

    connect();

    return () => {
      cancelled = true;
      camTrackRef.current?.stop();
      micTrackRef.current?.stop();
      screenVideoTrackRef.current?.stop();
      screenAudioTrackRef.current?.stop();
      room.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.room_name]);

  // -----------------------------------------------------------------------------
  // Cam Enable / Disable / Switch
  // -----------------------------------------------------------------------------
  const enableCam = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const track = await createLocalVideoTrack({
        deviceId: deviceId ? { exact: deviceId } : undefined,
      });
      camTrackRef.current = track;
      if (videoRef.current) track.attach(videoRef.current);
      await room.localParticipant.publishTrack(track, { source: Track.Source.Camera });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kamera fehlgeschlagen.');
    }
  }, []);

  const disableCam = useCallback(async () => {
    const track = camTrackRef.current;
    if (!track) return;
    const room = roomRef.current;
    if (room) await room.localParticipant.unpublishTrack(track, true);
    track.stop();
    camTrackRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const toggleCam = useCallback(async () => {
    if (camEnabled) {
      await disableCam();
      setCamEnabled(false);
    } else {
      await enableCam(selectedCam);
      setCamEnabled(true);
    }
  }, [camEnabled, selectedCam, enableCam, disableCam]);

  const switchCam = useCallback(
    async (deviceId: string) => {
      setSelectedCam(deviceId);
      if (!camEnabled) return;
      await disableCam();
      await enableCam(deviceId);
    },
    [camEnabled, enableCam, disableCam],
  );

  // -----------------------------------------------------------------------------
  // Mic Enable / Disable / Switch
  // -----------------------------------------------------------------------------
  const enableMic = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const track = await createLocalAudioTrack({
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
      });
      micTrackRef.current = track;
      await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Mikro fehlgeschlagen.');
    }
  }, []);

  const disableMic = useCallback(async () => {
    const track = micTrackRef.current;
    if (!track) return;
    const room = roomRef.current;
    if (room) await room.localParticipant.unpublishTrack(track, true);
    track.stop();
    micTrackRef.current = null;
  }, []);

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      await disableMic();
      setMicEnabled(false);
    } else {
      await enableMic(selectedMic);
      setMicEnabled(true);
    }
  }, [micEnabled, selectedMic, enableMic, disableMic]);

  const switchMic = useCallback(
    async (deviceId: string) => {
      setSelectedMic(deviceId);
      if (!micEnabled) return;
      await disableMic();
      await enableMic(deviceId);
    },
    [micEnabled, enableMic, disableMic],
  );

  // -----------------------------------------------------------------------------
  // Screenshare — läuft parallel zur Cam. Audio (System-Audio) nur wenn Browser
  // das zulässt und der User es anklickt.
  // -----------------------------------------------------------------------------
  const startScreenshare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const tracks = await createLocalScreenTracks({ audio: true });
      for (const t of tracks) {
        if (t.kind === Track.Kind.Video) {
          screenVideoTrackRef.current = t as LocalVideoTrack;
          if (screenPreviewRef.current) (t as LocalVideoTrack).attach(screenPreviewRef.current);
          await room.localParticipant.publishTrack(t, {
            source: Track.Source.ScreenShare,
          });
          // User beendet Screenshare über Browser-UI → Track endet
          t.once('ended', () => {
            void stopScreenshare();
          });
        } else if (t.kind === Track.Kind.Audio) {
          screenAudioTrackRef.current = t as LocalAudioTrack;
          await room.localParticipant.publishTrack(t, {
            source: Track.Source.ScreenShareAudio,
          });
        }
      }
      setScreenEnabled(true);
    } catch (err) {
      // User hat Share-Dialog abgebrochen → stillschweigend
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      setErrorMsg(err instanceof Error ? err.message : 'Screenshare fehlgeschlagen.');
    }
  }, []);

  const stopScreenshare = useCallback(async () => {
    const room = roomRef.current;
    const video = screenVideoTrackRef.current;
    const audio = screenAudioTrackRef.current;
    if (video && room) await room.localParticipant.unpublishTrack(video, true);
    if (audio && room) await room.localParticipant.unpublishTrack(audio, true);
    video?.stop();
    audio?.stop();
    screenVideoTrackRef.current = null;
    screenAudioTrackRef.current = null;
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;
    setScreenEnabled(false);
  }, []);

  const toggleScreen = useCallback(async () => {
    if (screenEnabled) await stopScreenshare();
    else await startScreenshare();
  }, [screenEnabled, startScreenshare, stopScreenshare]);

  // -----------------------------------------------------------------------------
  // Heartbeat + Duration-Ticker
  // -----------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'live') return;
    const id = window.setInterval(() => {
      // Duration-Ticker
      setDurationSecs((d) => d + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'live') return;
    const id = window.setInterval(() => {
      void heartbeatLiveSession(session.id, viewerCount, peakRef.current);
    }, 30_000);
    // Initial-Heartbeat direkt bei live-phase-switch
    void heartbeatLiveSession(session.id, viewerCount, peakRef.current);
    return () => window.clearInterval(id);
  }, [phase, session.id, viewerCount]);

  // -----------------------------------------------------------------------------
  // End-Stream
  // -----------------------------------------------------------------------------
  const handleEndStream = useCallback(() => {
    if (phase === 'ending' || phase === 'ended') return;
    const confirmed = window.confirm('Stream wirklich beenden? Viewer sehen dann "Stream beendet".');
    if (!confirmed) return;
    setPhase('ending');
    startEnding(async () => {
      // Tracks sauber freigeben (falls Edge Function langsam antwortet)
      await disableCam();
      await disableMic();
      await stopScreenshare();
      const result = await endLiveSession(session.id);
      roomRef.current?.disconnect();
      if (!result.ok) {
        setErrorMsg(result.error);
        setPhase('error');
        return;
      }
      setPhase('ended');
      // Nach 2s zur Replay-Seite redirecten (VOD processing startet eh serverseitig)
      setTimeout(() => {
        router.push(`/studio/live` as Route);
      }, 2000);
    });
  }, [phase, session.id, router, disableCam, disableMic, stopScreenshare]);

  // -----------------------------------------------------------------------------
  // Title-Save
  // -----------------------------------------------------------------------------
  const handleSaveTitle = useCallback(() => {
    const next = titleDraft.trim();
    if (next.length < 3) return;
    startSaveTitle(async () => {
      const result = await updateLiveSession(session.id, { title: next });
      if (result.ok) setTitleEditing(false);
    });
  }, [titleDraft, session.id]);

  // -----------------------------------------------------------------------------
  // Keyboard-Shortcuts — M (mute), V (cam), S (screen), E (end)
  // -----------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'live') return;
    const onKey = (e: KeyboardEvent) => {
      // Nicht in Inputs fangen
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'm') void toggleMic();
      else if (k === 'v') void toggleCam();
      else if (k === 's') void toggleScreen();
      else if (k === 'e') handleEndStream();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, toggleMic, toggleCam, toggleScreen, handleEndStream]);

  // -----------------------------------------------------------------------------
  // Duration-Format
  // -----------------------------------------------------------------------------
  const durationLabel = useMemo(() => {
    const h = Math.floor(durationSecs / 3600);
    const m = Math.floor((durationSecs % 3600) / 60);
    const s = durationSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }, [durationSecs]);

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      {/* Top-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
              phase === 'live'
                ? 'bg-red-500'
                : phase === 'ending'
                  ? 'bg-orange-500'
                  : phase === 'ended'
                    ? 'bg-zinc-500'
                    : 'bg-zinc-400'
            }`}
          >
            {phase === 'live' && <Radio className="h-3 w-3 animate-pulse" />}
            {phase === 'connecting'
              ? 'Verbinde…'
              : phase === 'live'
                ? 'LIVE'
                : phase === 'ending'
                  ? 'Beende…'
                  : phase === 'error'
                    ? 'Fehler'
                    : 'Beendet'}
          </span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {durationLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {viewerCount.toLocaleString('de-DE')}
            {peakCount > viewerCount && (
              <span className="text-xs">(Peak {peakCount.toLocaleString('de-DE')})</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPollSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
            disabled={phase !== 'live'}
          >
            <BarChart3 className="h-4 w-4" />
            Umfrage
          </button>
          <button
            type="button"
            onClick={handleEndStream}
            disabled={phase === 'ending' || phase === 'ended' || isEnding}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            Stream beenden
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_360px] lg:overflow-hidden">
        {/* Left-Column — Preview + Controls */}
        <div className="flex flex-col overflow-y-auto">
          {/* Preview */}
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              muted // Host hört sich selbst nicht — nur Viewer hören den Host
            />

            {phase === 'connecting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm text-white/70">Verbinde zu LiveKit…</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
                <Radio className="h-8 w-8 text-red-400" />
                <p className="text-sm">Stream-Fehler</p>
                {errorMsg && <p className="max-w-md text-xs text-white/50">{errorMsg}</p>}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                >
                  Neu verbinden
                </button>
              </div>
            )}

            {phase === 'ended' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
                <Radio className="h-8 w-8 text-white/40" />
                <p className="text-sm">Stream beendet. Weiterleitung zum Studio…</p>
              </div>
            )}

            {/* Screenshare Thumbnail */}
            {screenEnabled && (
              <div className="absolute bottom-3 right-3 aspect-video w-40 overflow-hidden rounded-md border-2 border-white/40 bg-black shadow-lg">
                <video
                  ref={screenPreviewRef}
                  className="h-full w-full object-contain"
                  autoPlay
                  playsInline
                  muted
                />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                  Screen
                </span>
              </div>
            )}

            {!camEnabled && phase === 'live' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/60">
                <VideoOff className="h-12 w-12" />
              </div>
            )}
          </div>

          {/* Title-Bar */}
          <div className="border-b px-4 py-3 lg:px-6">
            {titleEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value.slice(0, 120))}
                  maxLength={120}
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || titleDraft.trim().length < 3}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(session.title ?? '');
                    setTitleEditing(false);
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTitleEditing(true)}
                className="group flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-lg font-semibold">
                  {session.title ?? 'Unbenannter Stream'}
                </span>
                <Settings2 className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Sources + Health Grid */}
          <div className="grid grid-cols-1 gap-4 border-b p-4 lg:grid-cols-[1fr_280px] lg:px-6">
            <LiveSourcesPanel
              camEnabled={camEnabled}
              micEnabled={micEnabled}
              screenEnabled={screenEnabled}
              selectedCam={selectedCam}
              selectedMic={selectedMic}
              onToggleCam={toggleCam}
              onToggleMic={toggleMic}
              onToggleScreen={toggleScreen}
              onSwitchCam={switchCam}
              onSwitchMic={switchMic}
            />
            <LiveStreamHealth room={roomRef} phase={phase} />
          </div>

          {/* CoHost-Queue */}
          <div className="border-b p-4 lg:px-6">
            <LiveCoHostQueue sessionId={session.id} hostId={hostId} />
          </div>

          {/* Gifts-Feed */}
          <div className="p-4 lg:px-6">
            <LiveGiftsFeed
              sessionId={session.id}
              initialGifts={initialGifts}
              initialGoal={initialGiftGoal}
            />
          </div>
        </div>

        {/* Right-Column — Chat */}
        <aside className="flex min-h-[480px] flex-col border-l bg-card lg:h-full lg:overflow-hidden">
          <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Chat
          </div>
          <div className="flex-1 overflow-hidden">
            <LiveChat
              sessionId={session.id}
              initialComments={initialComments}
              hostId={hostId}
              viewerId={hostId}
              isHost={true}
              isModerator={true}
              slowModeSeconds={session.slow_mode_seconds ?? 0}
              ended={phase === 'ended'}
            />
          </div>
        </aside>
      </div>

      {/* Poll-Sheet */}
      {pollSheetOpen && (
        <LivePollStartSheet
          sessionId={session.id}
          activePoll={activePoll}
          onClose={() => setPollSheetOpen(false)}
          onPollChange={setActivePoll}
        />
      )}

      {/* Shortcut-Hinweis */}
      <div className="hidden items-center justify-center border-t bg-muted/40 px-4 py-1 text-[11px] text-muted-foreground lg:flex">
        <kbd className="mx-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">M</kbd>
        Mikro
        <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">V</kbd>
        Kamera
        <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">S</kbd>
        Screen
        <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">E</kbd>
        Beenden
        <ChevronDown className="ml-3 h-3 w-3 opacity-0" />
        {/* Dummy-Icon nur für Lucide-Import-Referenz, Mic/Video sind oben */}
        <Mic className="hidden" />
        <MicOff className="hidden" />
        <Video className="hidden" />
        <ScreenShare className="hidden" />
        <ScreenShareOff className="hidden" />
        <Gift className="hidden" />
      </div>
    </div>
  );
}

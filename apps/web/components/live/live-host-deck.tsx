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
  UserCheck,
  Circle,
} from 'lucide-react';
import type { LiveSessionWithHost, LiveCommentWithAuthor, ActiveLivePollSSR, LiveRecordingSSR } from '@/lib/data/live';
import type { SessionGiftRow, ActiveGiftGoal } from '@/lib/data/live-host';
import { fetchLiveKitToken, setLiveSlowMode, setLiveShopMode } from '@/app/actions/live';
import {
  endLiveSession,
  heartbeatLiveSession,
  updateLiveSession,
  toggleFollowersOnlyChat,
  startLiveRecording,
  stopLiveRecording,
} from '@/app/actions/live-host';
import { createBrowserClient } from '@supabase/ssr';
import { deleteWhipIngress } from '@/app/actions/live-ingress';
import { LiveChat } from './live-chat';
import { LiveSourcesPanel } from './live-sources-panel';
import { LiveStreamHealth } from './live-stream-health';
import { LiveCoHostQueue } from './live-cohost-queue';
import { LivePollStartSheet } from './live-poll-start-sheet';
import { LiveGiftsFeed } from './live-gifts-feed';
import { useLiveShoppingHost, LiveShopHostPanel } from './live-shopping';
import { useBattleStore } from './live-battle-store';
import { LiveBattleBar } from './live-battle-bar';
import { LiveWelcomeToasts } from './live-welcome-toasts';
import { LiveAudienceModal } from './live-audience-modal';

// -----------------------------------------------------------------------------
// LiveHostDeck — OBS-ähnliches Control-Panel für den Host.
//
// Zwei Modi:
//
//  Browser-Modus (room_name startet NICHT mit "obs-"):
//    Host publishet Cam/Mic/Screen direkt aus dem Browser via LiveKit.
//    Bekommt einen Publisher-Token (isHost=true → canPublish=true).
//
//  OBS-Modus (room_name startet mit "obs-"):
//    OBS publishet via WHIP → LiveKit. Browser ist NUR Subscriber (Monitor-View).
//    Bekommt einen Subscriber-Token (isHost=false → canPublish=false).
//    • Kein Cam-/Mic-Toggle (OBS steuert die Quellen)
//    • Remote-Video-Track von OBS wird im videoRef angezeigt
//    • Heartbeat läuft sofort beim Mount (unabhängig von LiveKit-Phase!)
//      → verhindert dass Cleanup-Cron die Session nach 10 Min killt
//    • "Stream beenden" ruft deleteWhipIngress → beendet Ingress + Session
//
// Heartbeat: alle 30s `heartbeat_live_session` RPC — verhindert Zombie-Cleanup.
// OBS-Modus: Heartbeat startet auf Mount, nicht erst bei phase='live'.
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
  /** v1.w.UI.206 — pre-loaded recording row (null = not yet started) */
  initialRecording?: LiveRecordingSSR | null;
}

export function LiveHostDeck({
  session,
  hostId,
  initialComments,
  initialPoll,
  initialGifts,
  initialGiftGoal,
  initialRecording = null,
}: LiveHostDeckProps) {
  const router = useRouter();

  // OBS-Modus: Session wurde via WHIP-Ingress erstellt (room_name-Präfix "obs-").
  // Browser ist hier NUR Monitor (Subscriber), nicht Publisher.
  const isObs = session.room_name.startsWith('obs-');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const camTrackRef = useRef<LocalVideoTrack | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const screenVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const screenAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const peakRef = useRef(session.peak_viewer_count ?? 0);
  // OBS-Modus: Audio-Tracks von OBS als separate <audio>-Elemente — das
  // <video>-Element hat muted=true (kein Echo), Audio kommt separat.
  const obsAudioElsRef = useRef<HTMLAudioElement[]>([]);

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
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title ?? '');
  const [titleEditing, setTitleEditing] = useState(false);
  const [isSavingTitle, startSaveTitle] = useTransition();
  const [isEnding, startEnding] = useTransition();

  // Active-Poll realtime-state — wird LivePollStartSheet runtergereicht
  const [activePoll, setActivePoll] = useState<ActiveLivePollSSR | null>(initialPoll);

  // v1.w.UI.188 — Followers-only chat toggle (optimistic UI)
  const [followersOnlyChat, setFollowersOnlyChat] = useState(session.followers_only_chat ?? false);
  const [, startFollowersToggle] = useTransition();

  // v1.w.UI.198 — Slow-mode: host can set 0/5/10/30/60s between messages.
  // Mobile parity: set_live_slow_mode RPC button in host right-controls.
  const [slowModeSecs, setSlowModeSecs] = useState(session.slow_mode_seconds ?? 0);
  const [, startSlowModeTransition] = useTransition();

  const handleSetSlowMode = (secs: number) => {
    const prev = slowModeSecs;
    setSlowModeSecs(secs);
    startSlowModeTransition(async () => {
      const res = await setLiveSlowMode(session.id, secs);
      if (!res.ok) setSlowModeSecs(prev); // rollback on error
    });
  };

  // v1.w.UI.201 — Shop-Mode toggle: shop_enabled on live_sessions.
  // Parity with mobile useLiveShopModeActions.toggleShopMode().
  const [shopEnabled, setShopEnabled] = useState(!!(session.shop_enabled));
  const [, startShopToggle] = useTransition();
  const handleShopToggle = () => {
    const next = !shopEnabled;
    setShopEnabled(next);
    startShopToggle(async () => {
      const res = await setLiveShopMode(session.id, next);
      if (!res.ok) setShopEnabled(!next); // rollback
    });
  };

  // v1.w.UI.206 — Recording toggle: start/stop via livekit-egress edge function.
  // Mobile parity: useToggleRecording() in lib/useLiveRecording.ts.
  // Status comes from live_recordings table; realtime subscription keeps it fresh.
  const [recordingStatus, setRecordingStatus] = useState<LiveRecordingSSR['status'] | null>(
    initialRecording?.status ?? null,
  );
  const [isTogglingRec, startRecToggle] = useTransition();

  const recActive = recordingStatus === 'recording';
  const recBusy   = isTogglingRec || recordingStatus === 'processing';

  const handleToggleRecording = () => {
    if (recBusy) return;
    const wasActive = recActive;
    setRecordingStatus(wasActive ? 'processing' : 'recording'); // optimistic
    startRecToggle(async () => {
      const res = wasActive
        ? await stopLiveRecording(session.id)
        : await startLiveRecording(session.id, session.room_name);
      if (!res.ok) {
        // rollback to previous state
        setRecordingStatus(wasActive ? 'recording' : null);
      }
    });
  };

  // Realtime: subscribe to live_recordings UPDATE for this session
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const ch = sb
      .channel(`host-recording-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_recordings', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as { status?: LiveRecordingSSR['status'] } | null;
          if (row?.status) setRecordingStatus(row.status);
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [session.id]);

  // Live-Shopping — v1.w.UI.180
  const { pinnedProduct: shopPinnedProduct, pinProduct, unpinProduct } = useLiveShoppingHost(session.id);

  // Battle — v1.w.UI.182: reads from module-level store written by LiveCoHostQueue when host accepts
  const battleStore = useBattleStore();

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
      // OBS-Modus: Subscriber-Token (kein isHost-Check in der Edge-Function,
      // kein canPublish). Browser ist Monitor, OBS ist Publisher.
      // Browser-Modus: Publisher-Token (isHost=true → Edge-Function prüft
      // Ownership via live_sessions.host_id).
      const tokenResult = await fetchLiveKitToken(
        session.room_name,
        false,   // isCoHost
        !isObs,  // isHost — nur im Browser-Modus
      );
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

        if (isObs) {
          // OBS-Modus: bereits publizierte OBS-Tracks abholen (falls OBS
          // schon vor uns im Room war — was der Normalfall ist).
          // Tracks die noch nicht subscribed sind werden via TrackSubscribed-Event
          // unten abgeholt. Kurzes Delay damit LiveKit die initiale Subscription
          // abschließen kann bevor wir den pub-State lesen.
          await new Promise((r) => setTimeout(r, 500));
          for (const participant of room.remoteParticipants.values()) {
            for (const pub of participant.videoTrackPublications.values()) {
              if (pub.track && videoRef.current) {
                pub.track.attach(videoRef.current);
                videoRef.current.muted = true;
                void videoRef.current.play().catch(() => {});
              }
            }
            // Audio-Track separat abspielen — <video> ist muted (kein Echo),
            // LiveKit erstellt automatisch ein <audio>-Element via attach().
            for (const pub of participant.audioTrackPublications.values()) {
              if (pub.track) {
                const audioEl = pub.track.attach() as HTMLAudioElement;
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
                obsAudioElsRef.current.push(audioEl);
              }
            }
          }
          // Kein Cam/Mic-Enable im OBS-Modus — OBS übernimmt das.
          return;
        }

        // Browser-Modus: Device-Prefs vom Setup-Screen anwenden
        const prefs = readDevicePrefs(session.id);
        if (prefs) {
          setSelectedCam(prefs.cam);
          setSelectedMic(prefs.mic);
          setCamEnabled(prefs.camEnabled);
          setMicEnabled(prefs.micEnabled);
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

    // OBS-Modus: Remote-Track subscriben wenn OBS-Participant publisht
    // (nötig wenn OBS erst NACH dem Browser-Join zum Room kommt)
    if (isObs) {
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          const el = videoRef.current;
          track.attach(el);
          el.muted = true;
          void el.play().catch(() => {});
        } else if (track.kind === Track.Kind.Audio) {
          // Audio separat: <video> ist muted, daher brauchen wir ein eigenes
          // <audio>-Element damit OBS-Ton beim Host ankommt.
          const audioEl = track.attach() as HTMLAudioElement;
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
          obsAudioElsRef.current.push(audioEl);
        }
      });
    }

    room.on(RoomEvent.ParticipantConnected, () => {
      // Participant-Count ≈ viewer_count — aktualisieren
      // OBS-Modus: OBS-Participant wird mitgezählt, aber Viewer sind alle anderen.
      const count = isObs
        ? Math.max(0, room.numParticipants - 1) // OBS-Participant abziehen
        : room.numParticipants;
      setViewerCount(count);
      if (count > peakRef.current) {
        peakRef.current = count;
        setPeakCount(count);
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      const count = isObs
        ? Math.max(0, room.numParticipants - 1)
        : room.numParticipants;
      setViewerCount(count);
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
      // OBS-Audio-Elemente aus dem DOM entfernen
      for (const el of obsAudioElsRef.current) {
        el.pause();
        el.srcObject = null;
        el.remove();
      }
      obsAudioElsRef.current = [];
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
  //
  // Reihenfolge: `stopScreenshare` ZUERST definiert, weil `startScreenshare` es
  // intern via `t.once('ended', …)` aufruft. Sonst Temporal-Dead-Zone-Crash beim
  // useCallback-Deps-Array von `startScreenshare`.
  // -----------------------------------------------------------------------------
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
  }, [stopScreenshare]);

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
      setDurationSecs((d) => d + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Browser-Modus: Heartbeat nur wenn phase=live
  useEffect(() => {
    if (isObs || phase !== 'live') return;
    const id = window.setInterval(() => {
      void heartbeatLiveSession(session.id, viewerCount, peakRef.current);
    }, 30_000);
    void heartbeatLiveSession(session.id, viewerCount, peakRef.current);
    return () => window.clearInterval(id);
  }, [isObs, phase, session.id, viewerCount]);

  // OBS-Modus: Heartbeat sofort beim Mount, unabhängig von der LiveKit-Phase.
  // Kritisch: verhindert dass der Cleanup-Cron (updated_at > 10 Min) die Session
  // killt, auch wenn die LiveKit-Verbindung kurz ausfällt oder noch aufbaut.
  useEffect(() => {
    if (!isObs) return;
    const sendHb = () => void heartbeatLiveSession(session.id, viewerCount, peakRef.current);
    sendHb(); // sofort
    const id = window.setInterval(sendHb, 30_000);
    return () => window.clearInterval(id);
    // viewerCount bewusst weggelassen — kein Effect-Restart bei jedem Viewer-Join
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isObs, session.id]);

  // -----------------------------------------------------------------------------
  // End-Stream
  // -----------------------------------------------------------------------------
  const handleEndStream = useCallback(() => {
    // OBS-Modus: auch aus 'error'-Phase beenden erlauben (kein LiveKit-Connect nötig)
    const canEnd = isObs
      ? phase !== 'ending' && phase !== 'ended'
      : phase === 'live';
    if (!canEnd) return;
    const confirmed = window.confirm('Stream wirklich beenden? Viewer sehen dann "Stream beendet".');
    if (!confirmed) return;
    setPhase('ending');
    startEnding(async () => {
      if (isObs) {
        // OBS-Modus: LiveKit-Ingress löschen → OBS verliert die WHIP-Verbindung,
        // Session wird auf 'ended' gesetzt. Kein Cam/Mic-Cleanup nötig.
        const result = await deleteWhipIngress(session.id);
        roomRef.current?.disconnect();
        if (!result.ok) {
          setErrorMsg(result.error);
          setPhase('error');
          return;
        }
      } else {
        // Browser-Modus: Tracks sauber freigeben
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
      }
      setPhase('ended');
      setTimeout(() => {
        router.push(`/studio/live` as Route);
      }, 2000);
    });
  }, [isObs, phase, session.id, router, disableCam, disableMic, stopScreenshare]);

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
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      const k = e.key.toLowerCase();
      // OBS-Modus: keine Cam/Mic/Screen-Shortcuts
      if (!isObs) {
        if (k === 'm') void toggleMic();
        else if (k === 'v') void toggleCam();
        else if (k === 's') void toggleScreen();
      }
      if (k === 'e') handleEndStream();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isObs, phase, toggleMic, toggleCam, toggleScreen, handleEndStream]);

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
          {/* v1.w.UI.195 — tappable viewer count → audience modal (host sees who's watching) */}
          <button
            type="button"
            onClick={() => setAudienceOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zuschauer*innen anzeigen"
          >
            <Users className="h-4 w-4" />
            {viewerCount.toLocaleString('de-DE')}
            {peakCount > viewerCount && (
              <span className="text-xs">(Peak {peakCount.toLocaleString('de-DE')})</span>
            )}
          </button>
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
          {/* v1.w.UI.206 — Recording toggle. Mobile parity: "Aufnahme"/"Stop-REC" in CreatorToolsSheet. */}
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={recBusy || phase !== 'live'}
            title={recActive ? 'Aufnahme stoppen' : recordingStatus === 'processing' ? 'Wird verarbeitet…' : 'Aufnahme starten'}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
              recActive
                ? 'border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'hover:bg-muted',
            ].join(' ')}
          >
            {recBusy && !recActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Circle className={['h-4 w-4', recActive ? 'fill-red-500 text-red-500' : ''].join(' ')} />
            )}
            {recActive ? 'Stop-REC' : recordingStatus === 'processing' ? 'Verarbeitet…' : 'Aufnahme'}
          </button>
          <button
            type="button"
            onClick={handleEndStream}
            disabled={
              isEnding ||
              phase === 'ending' ||
              phase === 'ended' ||
              // OBS: auch aus 'error'-Phase beenden erlaubt
              (!isObs && phase !== 'live')
            }
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

            {/* v1.w.UI.182 — Battle bar overlay on preview */}
            {battleStore.isBattle && (
              <div className="absolute inset-0 pointer-events-none">
                <LiveBattleBar
                  state={battleStore}
                  hostName={session.host?.display_name ?? session.host?.username ?? 'Host'}
                  coHostName="Guest"
                />
              </div>
            )}

            {!camEnabled && phase === 'live' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/60">
                <VideoOff className="h-12 w-12" />
              </div>
            )}

            {/* v1.w.UI.194 — Welcome toasts: host sees "✨ @user joined" for followers/top-fans.
                viewerId=null → host does not self-announce (matches mobile announceSelf: false). */}
            {phase === 'live' && (
              <div className="absolute bottom-3 left-3 pointer-events-none">
                <LiveWelcomeToasts sessionId={session.id} viewerId={null} />
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
              <div>
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
                {/* v1.w.UI.186 — session flag badges so host sees their own settings at a glance */}
                {(session.women_only || session.allow_comments === false || session.allow_gifts === false) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {session.women_only && (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        ♀ Nur Frauen
                      </span>
                    )}
                    {session.allow_comments === false && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        💬 Kommentare aus
                      </span>
                    )}
                    {session.allow_gifts === false && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        🎁 Geschenke aus
                      </span>
                    )}
                  </div>
                )}
                {/* v1.w.UI.188 — Followers-only chat toggle (live, während des Streams) */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !followersOnlyChat;
                    setFollowersOnlyChat(next);
                    startFollowersToggle(async () => {
                      const res = await toggleFollowersOnlyChat(session.id, next);
                      if (!res.ok) setFollowersOnlyChat(!next); // rollback
                    });
                  }}
                  className={[
                    'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    followersOnlyChat
                      ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  ].join(' ')}
                  title={followersOnlyChat ? 'Nur Follower chatten (aktiv) — klicken zum Deaktivieren' : 'Nur Follower chatten — klicken zum Aktivieren'}
                >
                  <UserCheck className="h-3 w-3" />
                  {followersOnlyChat ? 'Nur Follower' : 'Alle chatten'}
                </button>
              </div>
            )}
          </div>

          {/* Sources + Health Grid */}
          <div className="grid grid-cols-1 gap-4 border-b p-4 lg:grid-cols-[1fr_280px] lg:px-6">
            {isObs ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Radio className="h-4 w-4 shrink-0 text-red-500" />
                <span>
                  OBS-Modus — Quellen werden in OBS gesteuert.
                  Die Browser-Kamera ist deaktiviert.
                </span>
              </div>
            ) : (
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
            )}
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

          {/* Shop — v1.w.UI.180 + v1.w.UI.201 */}
          <div className="border-t p-4 lg:px-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shop
              </span>
              {/* v1.w.UI.201 — shop_enabled toggle (viewer sees ShoppingBag button when on) */}
              <button
                type="button"
                onClick={handleShopToggle}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  shopEnabled
                    ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/40'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                ].join(' ')}
                title={shopEnabled ? 'Shop-Modus deaktivieren' : 'Shop-Modus aktivieren'}
              >
                {shopEnabled ? '🛍 An' : '🛍 Aus'}
              </button>
            </div>
            <LiveShopHostPanel
              sessionId={session.id}
              pinnedProduct={shopPinnedProduct}
              onPin={pinProduct}
              onUnpin={unpinProduct}
            />
          </div>
        </div>

        {/* Right-Column — Chat */}
        <aside className="flex min-h-[480px] flex-col border-l bg-card lg:h-full lg:overflow-hidden">
          {/* v1.w.UI.198 — Chat header with slow-mode toggle */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chat</span>
            <div className="flex items-center gap-1" title="Slow-Mode: Mindestwartzeit zwischen Nachrichten">
              {([0, 5, 10, 30, 60] as const).map((secs) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => handleSetSlowMode(secs)}
                  disabled={phase !== 'live'}
                  className={[
                    'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40',
                    slowModeSecs === secs
                      ? 'bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/40'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                  aria-pressed={slowModeSecs === secs}
                >
                  {secs === 0 ? 'Off' : `${secs}s`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LiveChat
              sessionId={session.id}
              initialComments={initialComments}
              hostId={hostId}
              viewerId={hostId}
              isHost={true}
              isModerator={true}
              slowModeSeconds={slowModeSecs}
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

      {/* v1.w.UI.195 — Audience modal: host can see who's watching, grant/revoke mods */}
      <LiveAudienceModal
        open={audienceOpen}
        onClose={() => setAudienceOpen(false)}
        sessionId={session.id}
        hostId={hostId}
        viewerId={hostId}
        isHost={true}
      />

      {/* Shortcut-Hinweis */}
      <div className="hidden items-center justify-center border-t bg-muted/40 px-4 py-1 text-[11px] text-muted-foreground lg:flex">
        {!isObs && (
          <>
            <kbd className="mx-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">M</kbd>
            Mikro
            <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">V</kbd>
            Kamera
            <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">S</kbd>
            Screen
          </>
        )}
        <kbd className="mx-1 ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">E</kbd>
        Beenden
        <ChevronDown className="ml-3 h-3 w-3 opacity-0" />
        {/* Dummy-Icons für Lucide-Import-Referenz */}
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

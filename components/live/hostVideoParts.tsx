import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { RoomContext } from "@livekit/components-react";
import { useLocalParticipant, VideoTrack } from "@livekit/react-native";
import type { TrackReference } from "@livekit/components-core";
import { Room, RoomEvent, Track } from "livekit-client";
import type { Participant, TrackPublication } from "livekit-client";
import { Camera, CameraOff, Mic, MicOff, RotateCcw } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { hostStyles as s } from "@/components/live/hostStyles";

// Ausgelagert aus app/live/host.tsx (Refactor #2 Schritt 2) — eigenstaendige
// LiveKit-Host-Bausteine: Viewer-Count-Hook, Mic/Cam-Steuerung, lokale + remote
// Video-Views. Keine Logikaenderung.
// ─── Echtzeit Viewer Count (LiveKit-basiert) ──────────────────────────────────
export function useViewerCount(sessionId: string) {
  const room = useContext(RoomContext);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);

  useEffect(() => {
    if (!room) return;

    const update = () => {
      // WARN 1 Fix: Co-Hosts (Publisher mit Kamera) nicht als Zuschauer zählen
      // Ein echter Viewer publisht keine Kamera → hat kein Camera-TrackPublication
      let count = 0;
      for (const [, participant] of room.remoteParticipants) {
        const hasCameraTrack = participant.getTrackPublication(Track.Source.Camera);
        if (!hasCameraTrack) count++;
      }
      setViewerCount(count);
      setPeakViewers((prev) => Math.max(prev, count));
    };

    // Initial count
    update();

    room.on(RoomEvent.ParticipantConnected, update);
    room.on(RoomEvent.ParticipantDisconnected, update);
    return () => {
      room.off(RoomEvent.ParticipantConnected, update);
      room.off(RoomEvent.ParticipantDisconnected, update);
    };
  }, [room]);

  // Sync count back to DB every 5s + Heartbeat alle 60s damit Cleanup-Function weiß dass Session aktiv ist
  const lastSyncedRef = useRef<{ count: number; peak: number; lastHeartbeat: number }>({ count: -1, peak: -1, lastHeartbeat: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const needsHeartbeat = now - lastSyncedRef.current.lastHeartbeat > 60_000;
      // Kein Write wenn sich nichts geändert hat UND kein Heartbeat fällig → spart DB-Writes
      if (
        lastSyncedRef.current.count === viewerCount &&
        lastSyncedRef.current.peak  === peakViewers &&
        !needsHeartbeat
      ) return;
      lastSyncedRef.current = { count: viewerCount, peak: peakViewers, lastHeartbeat: needsHeartbeat ? now : lastSyncedRef.current.lastHeartbeat };
      supabase
        .from("live_sessions")
        .update({ viewer_count: viewerCount, peak_viewers: peakViewers, updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .then();
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, peakViewers, sessionId]);

  return { viewerCount, peakViewers };
}

// ─── LiveKit Host-Steuerung (Mikrofon / Kamera toggle) ────────────────────────
export function HostControls({ onCameraSwitch }: { onCameraSwitch?: (isFront: boolean) => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch { /* ignore */ }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch { /* ignore */ }
  };

  const switchCamera = async () => {
    try {
      const devices = await Room.getLocalDevices("videoinput");
      if (devices.length < 2) return;
      const currentTrack = localParticipant.getTrackPublication(Track.Source.Camera);
      if (!currentTrack?.track) return;
      const currentDeviceId = currentTrack.track.mediaStreamTrack?.getSettings()?.deviceId;
      const nextDevice = devices.find((d) => d.deviceId !== currentDeviceId) ?? devices[0];
      await currentTrack.track.setDeviceId(nextDevice.deviceId);
      // Nach dem Wechsel: facingMode des neuen Tracks lesen
      // (kein neue LocalTrackPublished-Event bei setDeviceId)
      await new Promise<void>((r) => setTimeout(r, 150)); // kurz warten bis Track bereit
      const facingMode = currentTrack.track.mediaStreamTrack?.getSettings()?.facingMode;
      onCameraSwitch?.(!facingMode || facingMode === 'user');
    } catch { /* Fallback: einfach Camera neu starten */ }
  };

  return (
    <View style={s.controls}>
      <Pressable
        style={[s.controlBtn, !isMicrophoneEnabled && s.controlBtnOff]}
        onPress={toggleMic}
        hitSlop={8}
      >
        {isMicrophoneEnabled ? (
          <Mic size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <MicOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable
        style={[s.controlBtn, !isCameraEnabled && s.controlBtnOff]}
        onPress={toggleCamera}
        hitSlop={8}
      >
        {isCameraEnabled ? (
          <Camera size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <CameraOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable style={s.controlBtn} onPress={switchCamera} hitSlop={8}>
        <RotateCcw size={18} stroke="#fff" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

// ─── LocalCameraView ─────────────────────────────────────────────────
// Hört direkt auf RoomEvent - kein useTracks-Timing-Bug in React Native.
// mirror=true nur bei Frontkamera (facingMode="user"), nicht bei Rückkamera.
// isFrontCamera wird von HostUI kontrolliert (nach switchCamera-Callback).
// ⚠️ BUG 4 FIX: Initialsynchronisation beim Mount — falls Track bereits pubiziert
//    (z.B. wenn CoHostSplitView bei Duet-Start remountet).
export function LocalCameraView({ isFrontCamera }: { isFrontCamera: boolean }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<TrackReference | null>(null);

  useEffect(() => {
    if (!room) return;

    // Initiale Sync: prüfe ob Track schon publiziert ist (verhindert schwarzes Bild beim Remount)
    const syncInitial = () => {
      const pub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        setTrackRef({ participant: room.localParticipant, publication: pub, source: Track.Source.Camera });
      }
    };
    syncInitial();

    const onPublished = (pub: TrackPublication, participant: Participant) => {
      if (pub.source === Track.Source.Camera) {
        setTrackRef({
          participant,
          publication: pub,
          source: Track.Source.Camera,
        });
      }
    };
    const onUnpublished = (pub: TrackPublication) => {
      if (pub.source === Track.Source.Camera) setTrackRef(null);
    };

    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room]);

  if (!trackRef) return null;
  return (
    <VideoTrack
      trackRef={trackRef}
      style={StyleSheet.absoluteFill as ViewStyle}
      objectFit="cover"
      mirror={isFrontCamera}
    />
  );
}


// ─── RemoteCoHostVideoView ────────────────────────────────────────────
// Hört auf Remote-Tracks des aktiven Co-Hosts (Participant Identity = userId)
export function RemoteCoHostVideoView({ coHostUserId }: { coHostUserId: string }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<TrackReference | null>(null);

  useEffect(() => {
    if (!room || !coHostUserId) return;

    const syncTrack = () => {
      // Remote Participant mit Co-Host-UserId suchen
      for (const [, participant] of room.remoteParticipants) {
        if (participant.identity === coHostUserId) {
          const pub = participant.getTrackPublication(Track.Source.Camera);
          if (pub && pub.track) {
            setTrackRef({ participant, publication: pub, source: Track.Source.Camera });
            return;
          }
        }
      }
      setTrackRef(null);
    };

    syncTrack();
    room.on(RoomEvent.TrackSubscribed, syncTrack);
    room.on(RoomEvent.TrackUnsubscribed, syncTrack);
    room.on(RoomEvent.ParticipantConnected, syncTrack);
    room.on(RoomEvent.ParticipantDisconnected, syncTrack);
    return () => {
      room.off(RoomEvent.TrackSubscribed, syncTrack);
      room.off(RoomEvent.TrackUnsubscribed, syncTrack);
      room.off(RoomEvent.ParticipantConnected, syncTrack);
      room.off(RoomEvent.ParticipantDisconnected, syncTrack);
    };
  }, [room, coHostUserId]);

  if (!trackRef) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d1a' }]} />;
  }
  return (
    <VideoTrack
      trackRef={trackRef}
      style={StyleSheet.absoluteFill as ViewStyle}
      objectFit="cover"
    />
  );
}


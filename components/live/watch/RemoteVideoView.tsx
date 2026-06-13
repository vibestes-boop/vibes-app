import { Image } from 'expo-image';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { RoomContext } from '@livekit/components-react';
import {
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import type { Participant, TrackPublication } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';

// ─── Remote Video (Host-Stream) ───────────────────────────────────────────────
// ⚠️ BUG FIX: hostId-Prop ergänzt damit bei Duet der richtige Track angezeigt wird.
// Ohne das würde useTracks() den Co-Host-Track als "Host-Video" zurückgeben.
export function RemoteVideoView({ hostAvatar, hostId }: { hostAvatar?: string | null; hostId?: string | null }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  // Host-Track: nicht lokal UND wenn hostId bekannt, nur dieser Participant
  const remoteTrack = tracks.find((t) => {
    if (t.participant?.isLocal) return false;
    if (hostId && t.participant?.identity && t.participant.identity !== hostId) return false;
    return true;
  });
  // ⚠️ CRASH-FIX: withPlaceholder=true liefert TrackReferencePlaceholder-Objekte
  // OHNE .publication wenn der Host noch keinen Track published hat.
  const hasPublishedTrack =
    !!(remoteTrack as { publication?: { track?: unknown } } | undefined)?.publication?.track;

  // Echtzeit-Erkennung ob Host-Kamera gemuted ist (z.B. App-Wechsel)
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const room = useContext(RoomContext);

  useEffect(() => {
    if (!room) return;
    const onMuted = (pub: TrackPublication, participant: Participant) => {
      if (pub.source !== Track.Source.Camera) return;
      if (participant.isLocal) return;
      if (hostId && participant.identity !== hostId) return;
      setIsCameraMuted(true);
    };
    const onUnmuted = (pub: TrackPublication, participant: Participant) => {
      if (pub.source !== Track.Source.Camera) return;
      if (participant.isLocal) return;
      if (hostId && participant.identity !== hostId) return;
      setIsCameraMuted(false);
    };
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    return () => {
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
    };
  }, [room, hostId]);

  if (!remoteTrack || !hasPublishedTrack) {
    return (
      <View style={s.videoPlaceholder}>
        {hostAvatar ? (
          <Image source={{ uri: hostAvatar }} style={s.hostAvatar} contentFit="cover" />
        ) : (
          <View style={[s.hostAvatar, s.hostAvatarFallback]}>
            <Text style={s.hostInitial}>?</Text>
          </View>
        )}
        <ActivityIndicator color="rgba(255,255,255,0.5)" style={{ marginTop: 16 }} />
        <Text style={s.connectingText}>Verbinde …</Text>
      </View>
    );
  }

  return (
    <>
      <VideoTrack
        trackRef={remoteTrack as any}
        style={StyleSheet.absoluteFill as any}
        objectFit="cover"
      />
      {isCameraMuted && (
        <View style={StyleSheet.absoluteFill}>
          {hostAvatar ? (
            <Image
              source={{ uri: hostAvatar }}
              style={StyleSheet.absoluteFill as any}
              contentFit="cover"
              blurRadius={22}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {hostAvatar ? (
              <Image
                source={{ uri: hostAvatar }}
                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <View style={{ width: 5, height: 28, borderRadius: 3, backgroundColor: '#fff' }} />
              <View style={{ width: 5, height: 28, borderRadius: 3, backgroundColor: '#fff' }} />
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
              Live pausiert
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
              Der Host hat die App kurz gewechselt.{'\n'}Warte kurz, es geht gleich weiter.
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a14',
  },
  hostAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  hostAvatarFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  hostInitial: { color: '#fff', fontSize: 36, fontWeight: '800' },
  connectingText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 10 },
});

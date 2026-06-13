import { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RoomContext } from '@livekit/components-react';
import { VideoTrack } from '@livekit/react-native';
import type { Participant, TrackPublication } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';

// ─── Phase 3: Grid-Remote-Tile ────────────────────────────────────────
// Rendert einen einzelnen Remote-Participant (anderer Co-Host) in einer
// Grid-Kachel. Funktioniert viewer-side.
export function GridRemoteTile({ userId, username }: { userId: string; username: string }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    if (!room || !userId) return;
    const sync = () => {
      for (const [, p] of room.remoteParticipants) {
        if (p.identity === userId) {
          const pub = p.getTrackPublication(Track.Source.Camera);
          if (pub && pub.track) {
            setTrackRef({ participant: p, publication: pub, source: Track.Source.Camera });
          } else {
            setTrackRef(null);
          }
          const micPub = p.getTrackPublication(Track.Source.Microphone);
          setMicMuted(!micPub || micPub.isMuted || !micPub.track);
          return;
        }
      }
      setTrackRef(null);
      setMicMuted(true);
    };
    sync();
    const evs = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ] as const;
    evs.forEach((e) => room.on(e, sync));
    return () => { evs.forEach((e) => room.off(e, sync)); };
  }, [room, userId]);

  return (
    <>
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef as any}
          style={StyleSheet.absoluteFill as any}
          objectFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d1a' }]}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>verbindet…</Text>
        </View>
      )}
      <View style={s.duetLabelBadge} pointerEvents="none">
        <Text style={s.duetLabelText} numberOfLines={1}>
          {micMuted ? '🔇 ' : ''}@{username}
        </Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  duetLabelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  duetLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});

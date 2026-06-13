import { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RoomContext } from '@livekit/components-react';
import { VideoTrack } from '@livekit/react-native';
import type { Participant, TrackPublication } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';

// ─── RemoteCoHostVideoView ────────────────────────────────────────────
// Hört auf Remote-Tracks des aktiven Co-Hosts (Participant Identity = userId)
export function RemoteCoHostVideoView({ coHostUserId }: { coHostUserId: string }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);

  useEffect(() => {
    if (!room || !coHostUserId) return;

    const syncTrack = () => {
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
      trackRef={trackRef as any}
      style={StyleSheet.absoluteFill as any}
      objectFit="cover"
    />
  );
}

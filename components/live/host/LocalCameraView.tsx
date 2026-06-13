import { useContext, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { RoomContext } from '@livekit/components-react';
import { VideoTrack } from '@livekit/react-native';
import type { Participant, TrackPublication } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';

// ─── LocalCameraView ─────────────────────────────────────────────────
// Hört direkt auf RoomEvent - kein useTracks-Timing-Bug in React Native.
// mirror=true nur bei Frontkamera (facingMode="user"), nicht bei Rückkamera.
// isFrontCamera wird von HostUI kontrolliert (nach switchCamera-Callback).
// ⚠️ BUG 4 FIX: Initialsynchronisation beim Mount — falls Track bereits publiziert
//    (z.B. wenn CoHostSplitView bei Duet-Start remountet).
export function LocalCameraView({ isFrontCamera }: { isFrontCamera: boolean }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);

  useEffect(() => {
    if (!room) return;

    // Initiale Sync: prüfe ob Track schon publiziert ist (verhindert schwarzes Bild beim Remount)
    const syncInitial = () => {
      const pub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        setTrackRef({ participant: room.localParticipant as unknown as Participant, publication: pub, source: Track.Source.Camera });
      }
    };
    syncInitial();

    const onPublished = (pub: TrackPublication, participant: Participant) => {
      if (pub.source === Track.Source.Camera) {
        setTrackRef({ participant, publication: pub, source: Track.Source.Camera });
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
      trackRef={trackRef as any}
      style={StyleSheet.absoluteFill as any}
      objectFit="cover"
      mirror={isFrontCamera}
    />
  );
}

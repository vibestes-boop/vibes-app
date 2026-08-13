// Die Video-Verbindung — einmal, über der ganzen Navigation.
//
// Vorher hing LiveKitRoom im Raum-Bildschirm. Ging man zurück, wurde der
// Bildschirm abgebaut, die Verbindung getrennt und die Kamera aus. Deshalb
// konnte das kleine Fenster nie echtes Video zeigen.
//
// Jetzt umschließt der Provider den gesamten Navigations-Baum. Raum und
// kleines Fenster rendern beide `StageVideo` und greifen auf denselben,
// durchlaufenden Strom zu.
//
// Wird NUR geladen, wenn LiveKit verfügbar ist (siehe lib/livekit.ts).

import { useEffect, type ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import { AudioSession, LiveKitRoom, VideoTrack, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useLivePlayer } from '../lib/livePlayer';
import { useLiveAccess } from '../lib/useLiveVideo';

export { HostControls } from './HostControls';
export { GoLiveGate } from './GoLiveGate';

/**
 * Ist gerade ein Video-Strom verfügbar? Raum und kleines Fenster fragen das,
 * bevor sie `StageVideo` rendern — außerhalb des Providers würden die Hooks
 * darin werfen.
 */
export function useStageReady(): boolean {
  const session = useLivePlayer((s) => s.session);
  const connected = useLivePlayer((s) => s.connected);
  const access = useLiveAccess(session?.roomName, session?.isHost ?? false, Boolean(session) && connected);
  return Boolean(session && connected && access.data);
}

export function LiveRoomProvider({ children }: { children: ReactNode }) {
  const session = useLivePlayer((s) => s.session);
  const connected = useLivePlayer((s) => s.connected);
  const access = useLiveAccess(
    session?.roomName,
    session?.isHost ?? false,
    Boolean(session) && connected,
  );

  const active = Boolean(session && connected && access.data);

  useEffect(() => {
    if (!active) return;
    // Ohne aktive Audio-Session bleibt der Ton auf iOS stumm, auch wenn die
    // Spur ankommt.
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [active]);

  if (!session || !connected || !access.data) return <>{children}</>;

  return (
    <LiveKitRoom
      serverUrl={access.data.url}
      token={access.data.token}
      connect
      audio={session.isHost}
      video={session.isHost}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      {children}
    </LiveKitRoom>
  );
}

/**
 * Das Bild des Gastgebers. Gezielt seine Kamera, nicht einfach die erste im
 * Raum — sonst kapert später ein CoHost das Bild.
 */
export function StageVideo({ hostIdentity, style }: { hostIdentity: string; style: ViewStyle }) {
  const tracks = useTracks([Track.Source.Camera]);
  const wanted =
    tracks.find((track) => track.participant?.identity === hostIdentity) ?? tracks[0];

  if (!wanted) return null;
  return <VideoTrack trackRef={wanted} style={style} objectFit="cover" />;
}

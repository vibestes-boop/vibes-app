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
import { VIDEO_QUALITY } from '../lib/videoQuality';

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

  // `LiveKitRoom` steht IMMER, auch ohne Verbindung — und das ist der Kern
  // dieser Datei.
  //
  // Vorher wurde zwischen `<>{children}</>` und `<LiveKitRoom>{children}</…>`
  // umgeschaltet, sobald „Live gehen" `connected` setzte. Damit wechselte der
  // Elterntyp über dem GESAMTEN Navigations-Baum, und React baut bei einem
  // Typwechsel an derselben Stelle den kompletten Teilbaum ab und neu auf: Der
  // Navigations-Stapel wurde zurückgesetzt, und der Gastgeber landete im Moment
  // des Live-Gehens auf der Startseite statt in seiner eigenen Sendung.
  //
  // Möglich ist das Dauer-Rendern, weil `serverUrl` und `token` ausdrücklich
  // `undefined` als Zwischenzustand annehmen und `connect` die Verbindung
  // steuert. Die Komponente rendert selbst keine View, nur Kontext-Anbieter —
  // sie kostet also nichts am Layout.
  //
  // Ton und Bild hängen an `active`, nicht nur am Gastgeber-Kennzeichen: Sonst
  // griffe LiveKit schon nach der Kamera, während die Vorschau vor dem
  // Live-Gehen sie noch hält — und die Sendung startete ohne Bild.
  const publishes = active && session?.isHost === true;

  return (
    <LiveKitRoom
      serverUrl={active ? access.data?.url : undefined}
      token={active ? access.data?.token : undefined}
      connect={active}
      audio={publishes}
      video={publishes}
      options={{
        // `adaptiveStream` drosselt je Zuschauer nach Fenstergröße und pausiert
        // Unsichtbares; `dynacast` stellt Qualitätsstufen ein, die niemand
        // abonniert hat. Beide sparen abwärtsgerichtete Bandbreite — und die
        // ist der Posten, der mit Erfolg wächst statt mit Umsatz.
        adaptiveStream: true,
        dynacast: true,
        // Die Obergrenze. Ohne sie nimmt LiveKit 720p als Voreinstellung, und
        // kein Zuschauer bekommt weniger, als der Gastgeber anbietet.
        // Begründung und Rechnung: `lib/videoQuality.ts`.
        videoCaptureDefaults: {
          resolution: {
            width: VIDEO_QUALITY.width,
            height: VIDEO_QUALITY.height,
            frameRate: VIDEO_QUALITY.frameRate,
          },
        },
        publishDefaults: {
          videoEncoding: {
            maxBitrate: VIDEO_QUALITY.maxBitrate,
            maxFramerate: VIDEO_QUALITY.frameRate,
          },
          // Bleibt an: Simulcast kostet nur AUFWÄRTS (frei) und erlaubt es
          // `dynacast`, schwächeren Zuschauern eine kleinere Stufe zu geben,
          // statt allen die größte zu schicken.
          simulcast: true,
        },
      }}
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

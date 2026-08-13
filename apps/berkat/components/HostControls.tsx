// Kamerasteuerung für den Gastgeber.
//
// Vorher startete die Kamera stillschweigend, sobald der Gastgeber den Raum
// öffnete — man konnte weder sehen, ob man sendet, noch die Kamera wechseln
// oder das Mikro stumm schalten. Für jemanden, der gleich vor Publikum steht,
// ist "ich weiß nicht, ob ich gerade live bin" der schlechteste Zustand.
//
// Läuft nur INNERHALB von LiveKitRoom, weil die Hooks den Raum-Kontext
// brauchen.

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectionState, useLocalParticipant } from '@livekit/react-native';
import { ConnectionState, type LocalVideoTrack } from 'livekit-client';
import { Mic, MicOff, SwitchCamera, Video, VideoOff } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';

export function HostControls() {
  const insets = useSafeAreaInsets();
  const connection = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, cameraTrack } =
    useLocalParticipant();
  const [front, setFront] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleCamera = useCallback(() => {
    void localParticipant?.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  const toggleMic = useCallback(() => {
    void localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const switchCamera = useCallback(async () => {
    const track = cameraTrack?.track as LocalVideoTrack | undefined;
    if (!track || busy) return;
    setBusy(true);
    try {
      const next = front ? 'environment' : 'user';
      await track.restartTrack({ facingMode: next });
      setFront(!front);
    } catch {
      // Kamerawechsel kann fehlschlagen (Gerät belegt, nur eine Kamera).
      // Kein Grund für eine Fehlermeldung — der alte Zustand bleibt einfach.
    } finally {
      setBusy(false);
    }
  }, [cameraTrack, front, busy]);

  const status =
    connection === ConnectionState.Connected
      ? isCameraEnabled
        ? { text: 'Du sendest', dot: stage.lead }
        : { text: 'Kamera aus', dot: stage.live }
      : connection === ConnectionState.Connecting ||
          connection === ConnectionState.Reconnecting
        ? { text: 'Verbinden …', dot: stage.textMuted }
        : { text: 'Nicht verbunden', dot: stage.live };

  return (
    <View style={[styles.wrap, { top: insets.top + 44 }]} pointerEvents="box-none">
      <View style={styles.statusPill}>
        <View style={[styles.dot, { backgroundColor: status.dot }]} />
        <Text style={styles.statusText}>{status.text}</Text>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={toggleCamera}
          style={[styles.button, !isCameraEnabled && styles.buttonOff]}
          accessibilityRole="button"
          accessibilityLabel={isCameraEnabled ? 'Kamera ausschalten' : 'Kamera einschalten'}
        >
          {isCameraEnabled ? (
            <Video size={16} color={stage.text} />
          ) : (
            <VideoOff size={16} color={stage.liveInk} />
          )}
        </Pressable>

        <Pressable
          onPress={toggleMic}
          style={[styles.button, !isMicrophoneEnabled && styles.buttonOff]}
          accessibilityRole="button"
          accessibilityLabel={isMicrophoneEnabled ? 'Mikrofon stumm' : 'Mikrofon an'}
        >
          {isMicrophoneEnabled ? (
            <Mic size={16} color={stage.text} />
          ) : (
            <MicOff size={16} color={stage.liveInk} />
          )}
        </Pressable>

        <Pressable
          onPress={switchCamera}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Kamera wechseln"
        >
          <SwitchCamera size={16} color={stage.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, gap: 6, alignItems: 'flex-start' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', color: stage.text },
  row: { flexDirection: 'row', gap: 6 },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOff: { backgroundColor: stage.live },
});

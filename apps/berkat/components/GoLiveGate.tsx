// Kamera-Vorschau vor dem Live-Gehen.
//
// Der entscheidende Punkt: hier läuft die Kamera NUR lokal. Es gibt keine
// Verbindung zum LiveKit-Server und kein Token — die Spur wird erzeugt,
// angezeigt und beim Loslegen wieder gestoppt. Niemand sieht dich, während du
// das Bild zurechtrückst.
//
// Erst der Knopf startet die echte Übertragung.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView } from '@livekit/react-native';
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client';
import { Radio, SwitchCamera } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

export function GoLiveGate({ onGoLive }: { onGoLive: () => void }) {
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [front, setFront] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const trackRef = useRef<LocalVideoTrack | null>(null);

  useEffect(() => {
    let cancelled = false;

    createLocalVideoTrack({ facingMode: 'environment' })
      .then((created) => {
        if (cancelled) {
          void created.stop();
          return;
        }
        trackRef.current = created;
        setTrack(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      // Die Spur MUSS weg, bevor LiveKit die Kamera übernimmt — sonst ist das
      // Gerät belegt und die Übertragung startet ohne Bild.
      void trackRef.current?.stop();
      trackRef.current = null;
    };
  }, []);

  const switchCamera = async () => {
    if (!trackRef.current || busy) return;
    setBusy(true);
    try {
      await trackRef.current.restartTrack({ facingMode: front ? 'environment' : 'user' });
      setFront(!front);
    } catch {
      // Nur eine Kamera oder gerade belegt — Vorschau bleibt, wie sie war.
    } finally {
      setBusy(false);
    }
  };

  const goLive = () => {
    void trackRef.current?.stop();
    trackRef.current = null;
    setTrack(null);
    onGoLive();
  };

  return (
    <View style={styles.wrap}>
      {track ? (
        <VideoView videoTrack={track} style={FILL} objectFit="cover" mirror={front} />
      ) : (
        <View style={[FILL, styles.placeholder]}>
          {failed ? (
            <Text style={styles.failedText}>
              Die Kamera lässt sich nicht öffnen. Prüf die Freigabe in den iPhone-Einstellungen.
            </Text>
          ) : (
            <ActivityIndicator color={stage.gold} />
          )}
        </View>
      )}

      <View style={[styles.badge, { top: insets.top + space.sm }]}>
        <Text style={styles.badgeText}>Nur du siehst das</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom || space.lg }]}>
        <Pressable
          onPress={switchCamera}
          style={styles.switchButton}
          accessibilityRole="button"
          accessibilityLabel="Kamera wechseln"
        >
          <SwitchCamera size={20} color={stage.text} />
        </Pressable>

        <Pressable
          onPress={goLive}
          style={styles.goLive}
          accessibilityRole="button"
          accessibilityLabel="Live gehen"
        >
          <Radio size={19} color={stage.goldInk} />
          <Text style={styles.goLiveText}>Live gehen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...FILL, backgroundColor: stage.ink },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  failedText: { fontSize: 14, color: stage.textMuted, textAlign: 'center', lineHeight: 20 },

  badge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: stage.text },

  controls: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  switchButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLive: {
    flex: 1,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goLiveText: { fontSize: 17, fontWeight: '700', color: stage.goldInk },
});

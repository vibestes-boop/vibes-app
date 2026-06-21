/**
 * CoverPickerSheet — Cover-Frame fürs Video wählen.
 *
 * Generiert eine Filmstrip-Reihe gleichmäßig verteilter Frames (expo-video-
 * thumbnails) und lässt den Creator einen als Cover antippen. Die gewählte
 * Zeit (ms) wird an generateAndUploadThumbnail durchgereicht.
 *
 * v1: Tap-Auswahl diskreter Frames (zuverlässig). Drag-Scrubbing = v2.
 */
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Frame = { time: number; uri: string };

export function CoverPickerSheet({ visible, uri, durationMs, initialTimeMs, onDone, onClose }: {
  visible: boolean;
  uri: string;
  durationMs?: number | null;
  initialTimeMs?: number;
  onDone: (timeMs: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedTime, setSelectedTime] = useState<number>(initialTimeMs ?? 0);
  const [loading, setLoading] = useState(true);
  const cancelRef = useRef(false);

  // Gewählte Dauer (Fallback 15s, falls Asset keine duration liefert)
  const duration = durationMs && durationMs > 0 ? durationMs : 15000;

  useEffect(() => {
    if (!visible) return;
    cancelRef.current = false;
    setFrames([]);
    setLoading(true);
    setSelectedTime(initialTimeMs ?? 0);

    (async () => {
      try {
        const VideoThumbnails = await import('expo-video-thumbnails');
        // Anzahl Frames an Länge koppeln (6–16), ~ein Frame pro Sekunde
        const count = Math.min(16, Math.max(6, Math.round(duration / 1000)));
        const out: Frame[] = [];
        for (let i = 0; i < count; i++) {
          if (cancelRef.current) return;
          // Frames bei i/(count-1) der Dauer; letztes leicht vor Ende (−200ms)
          const t = Math.round((i / (count - 1)) * Math.max(0, duration - 200));
          try {
            const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: t, quality: 0.5 });
            if (cancelRef.current) return;
            if (thumbUri) {
              out.push({ time: t, uri: thumbUri });
              setFrames([...out]);   // progressiv anzeigen
              if (out.length === 1) setLoading(false);
            }
          } catch { /* einzelnen Frame überspringen */ }
        }
      } finally {
        if (!cancelRef.current) setLoading(false);
      }
    })();

    return () => { cancelRef.current = true; };
  }, [visible, uri, duration, initialTimeMs]);

  if (!visible) return null;

  // Großer Vorschau-Frame = der ausgewählte (nächstgelegene generierte Frame)
  const selectedFrame = frames.reduce<Frame | null>((best, f) => {
    if (!best) return f;
    return Math.abs(f.time - selectedTime) < Math.abs(best.time - selectedTime) ? f : best;
  }, null);

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.headerBtn}>
            <X size={24} color="#fff" strokeWidth={2.2} />
          </Pressable>
          <Text style={s.headerTitle}>Cover wählen</Text>
          <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(selectedTime); }} hitSlop={12} style={s.headerBtn}>
            <Check size={24} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Große Vorschau */}
        <View style={s.preview}>
          {selectedFrame ? (
            <Image source={{ uri: selectedFrame.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : (
            <View style={s.previewLoading}><ActivityIndicator color="#fff" /></View>
          )}
        </View>

        {/* Filmstrip */}
        <View style={[s.stripWrap, { paddingBottom: insets.bottom + 18 }]}>
          <Text style={s.hint}>Tippe einen Frame als Cover</Text>
          {loading && frames.length === 0 ? (
            <View style={s.stripLoading}><ActivityIndicator color="rgba(255,255,255,0.7)" /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
              {frames.map((f) => {
                const active = selectedFrame?.time === f.time;
                return (
                  <Pressable
                    key={f.time}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTime(f.time); }}
                    style={[s.frameBtn, active && s.frameBtnActive]}
                  >
                    <Image source={{ uri: f.uri }} style={s.frameImg} contentFit="cover" />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  preview: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  previewLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stripWrap: { backgroundColor: '#000', paddingTop: 14 },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  stripLoading: { height: 64, alignItems: 'center', justifyContent: 'center' },
  strip: { paddingHorizontal: 14, gap: 6 },
  frameBtn: {
    width: 44, height: 64, borderRadius: 8, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  frameBtnActive: { borderColor: '#fff' },
  frameImg: { width: '100%', height: '100%' },
});

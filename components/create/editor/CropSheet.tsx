/**
 * CropSheet — Bild zuschneiden (Seitenverhältnis-Presets, pixel-genau via Skia).
 *
 * v1: Center-Crop auf das gewählte Verhältnis (Original / 1:1 / 4:5 / 9:16 / 16:9).
 * Der eigentliche Schnitt läuft über eine Skia-Offscreen-Surface → pixel-genaue
 * JPEG-Datei im Cache, die der bestehende Upload-Pfad (fetch(file://…)) frisst.
 * Drag-zum-Verschieben ist als v2 vorgesehen.
 */
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skia, SKIA_READY, useSkiaImage } from '@/lib/skiaLoader';

type AspectKey = 'original' | '1:1' | '4:5' | '9:16' | '16:9';
const ASPECTS: { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: 'original', label: 'Original', ratio: null },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
];

// Zentrierter Crop-Rahmen (Breite/Höhe) auf ein Ziel-Verhältnis (w/h).
function centerCrop(w: number, h: number, ratio: number | null) {
  if (!ratio) return { x: 0, y: 0, width: w, height: h };
  const imgRatio = w / h;
  let cw: number, ch: number;
  if (imgRatio > ratio) { ch = h; cw = h * ratio; }
  else { cw = w; ch = w / ratio; }
  return { x: (w - cw) / 2, y: (h - ch) / 2, width: cw, height: ch };
}

// Skia-Offscreen-Crop → file://-URI (JPEG). Null bei Fehler/Skia nicht bereit.
async function cropSkImageToFile(
  image: any,
  crop: { x: number; y: number; width: number; height: number },
): Promise<string | null> {
  if (!SKIA_READY || !Skia || !image) return null;
  const w = Math.max(1, Math.round(crop.width));
  const h = Math.max(1, Math.round(crop.height));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const src = Skia.XYWHRect(crop.x, crop.y, crop.width, crop.height);
  const dst = Skia.XYWHRect(0, 0, w, h);
  canvas.drawImageRect(image, src, dst, Skia.Paint());
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const base64 = snapshot.encodeToBase64(3 /* ImageFormat.JPEG */, 92);
  const uri = `${FileSystem.cacheDirectory}crop-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export function CropSheet({ visible, uri, onDone, onClose }: {
  visible: boolean;
  uri: string;
  onDone: (croppedUri: string) => void;
  onClose: () => void;
}) {
  const skImage = useSkiaImage(visible ? uri : null);
  const [aspect, setAspect] = useState<AspectKey>('original');
  const [applying, setApplying] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const ratio = ASPECTS.find((a) => a.key === aspect)?.ratio ?? null;
  const imgW = skImage?.width?.() ?? 0;
  const imgH = skImage?.height?.() ?? 0;

  // Display-Rahmen (innerhalb der Preview-Box) berechnen — für den Overlay.
  const frame = useMemo(() => {
    if (!imgW || !imgH || !box.w || !box.h) return null;
    const scale = Math.min(box.w / imgW, box.h / imgH);
    const dispW = imgW * scale, dispH = imgH * scale;
    const dispX = (box.w - dispW) / 2, dispY = (box.h - dispH) / 2;
    const c = centerCrop(dispW, dispH, ratio);
    return { x: dispX + c.x, y: dispY + c.y, w: c.width, h: c.height, dispX, dispY, dispW, dispH };
  }, [imgW, imgH, box.w, box.h, ratio]);

  const apply = async () => {
    if (applying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Original → unverändert übernehmen
    if (!ratio) { onDone(uri); return; }
    if (!skImage || !imgW || !imgH) { Alert.alert('Hmm', 'Bild noch nicht bereit — kurz warten 🙂'); return; }
    setApplying(true);
    try {
      const cropPx = centerCrop(imgW, imgH, ratio);
      const out = await cropSkImageToFile(skImage, cropPx);
      if (out) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onDone(out);
      } else {
        Alert.alert('Schade', 'Zuschneiden hat nicht geklappt — versuch es nochmal.');
      }
    } catch {
      Alert.alert('Schade', 'Zuschneiden hat nicht geklappt — versuch es nochmal.');
    } finally {
      setApplying(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <CropBody
        uri={uri}
        frame={frame}
        box={box}
        setBox={setBox}
        aspect={aspect}
        setAspect={setAspect}
        applying={applying}
        onClose={onClose}
        apply={apply}
      />
    </Modal>
  );
}

function CropBody({ uri, frame, box, setBox, aspect, setAspect, applying, onClose, apply }: {
  uri: string;
  frame: { x: number; y: number; w: number; h: number } | null;
  box: { w: number; h: number };
  setBox: (b: { w: number; h: number }) => void;
  aspect: AspectKey;
  setAspect: (a: AspectKey) => void;
  applying: boolean;
  onClose: () => void;
  apply: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} hitSlop={12} style={s.headerBtn}>
          <X size={24} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.headerTitle}>Zuschneiden</Text>
        <Pressable onPress={apply} hitSlop={12} style={s.headerBtn} disabled={applying}>
          {applying ? <ActivityIndicator color="#fff" /> : <Check size={24} color="#fff" strokeWidth={2.4} />}
        </Pressable>
      </View>

      {/* Preview */}
      <View
        style={s.preview}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />

        {/* Abdunkeln außerhalb des Crop-Rahmens + heller Rahmen */}
        {frame && box.w > 0 && (
          <>
            <View style={[s.mask, { left: 0, top: 0, right: 0, height: frame.y }]} />
            <View style={[s.mask, { left: 0, top: frame.y + frame.h, right: 0, bottom: 0 }]} />
            <View style={[s.mask, { left: 0, top: frame.y, width: frame.x, height: frame.h }]} />
            <View style={[s.mask, { left: frame.x + frame.w, top: frame.y, right: 0, height: frame.h }]} />
            <View style={[s.frame, { left: frame.x, top: frame.y, width: frame.w, height: frame.h }]} />
          </>
        )}
      </View>

      {/* Aspect-Presets */}
      <View style={[s.aspectRow, { paddingBottom: insets.bottom + 18 }]}>
        {ASPECTS.map((a) => {
          const active = a.key === aspect;
          return (
            <Pressable
              key={a.key}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAspect(a.key); }}
              style={[s.aspectBtn, active && s.aspectBtnActive]}
            >
              <Text style={[s.aspectLabel, active && s.aspectLabelActive]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  preview: { flex: 1, overflow: 'hidden' },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: {
    position: 'absolute',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)',
    borderRadius: 2,
  },
  aspectRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: '#000',
  },
  aspectBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  aspectBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  aspectLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  aspectLabelActive: { color: '#000' },
});

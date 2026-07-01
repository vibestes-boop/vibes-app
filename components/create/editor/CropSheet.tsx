/**
 * CropSheet — Bild zuschneiden, FREI wählbar.
 *
 * Ziehbarer + größenveränderbarer Crop-Rahmen (Body verschieben + 4 Eck-Griffe).
 * Seitenverhältnis-Presets (Frei / 1:1 / 4:5 / 9:16 / 16:9) setzen den Rahmen als
 * Startpunkt; danach frei anpassbar. Der eigentliche Schnitt läuft pixel-genau über
 * eine Skia-Offscreen-Surface → JPEG-Datei im Cache (OTA-fähig, kein nativer Dep).
 */
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skia, SKIA_READY, useSkiaImage } from '@/lib/skiaLoader';

type AspectKey = 'frei' | '1:1' | '4:5' | '9:16' | '16:9';
const ASPECTS: { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: 'frei', label: 'Frei', ratio: null },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
];

type Rect = { x: number; y: number; w: number; h: number };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MIN_SIZE = 60;
const HANDLE_HIT = 36;

// Zentrierter Rahmen für ein Verhältnis innerhalb eines Display-Rects (oder voll bei Frei).
function centeredRect(disp: Rect, ratio: number | null): Rect {
  if (!ratio) return { ...disp };
  const dRatio = disp.w / disp.h;
  let w: number, h: number;
  if (dRatio > ratio) { h = disp.h; w = h * ratio; } else { w = disp.w; h = w / ratio; }
  return { x: disp.x + (disp.w - w) / 2, y: disp.y + (disp.h - h) / 2, w, h };
}

// Skia-Offscreen-Crop → file://-URI (JPEG). Null bei Fehler/Skia nicht bereit.
async function cropSkImageToFile(image: any, crop: Rect): Promise<string | null> {
  if (!SKIA_READY || !Skia || !image) return null;
  const w = Math.max(1, Math.round(crop.w));
  const h = Math.max(1, Math.round(crop.h));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const src = Skia.XYWHRect(crop.x, crop.y, crop.w, crop.h);
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
  const insets = useSafeAreaInsets();
  const skImage = useSkiaImage(visible ? uri : null);
  const [aspect, setAspect] = useState<AspectKey>('frei');
  const [applying, setApplying] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect | null>(null);

  const imgW = skImage?.width?.() ?? 0;
  const imgH = skImage?.height?.() ?? 0;

  // Bild-Display-Rect (contain) innerhalb der Preview-Box.
  const disp = useMemo<Rect | null>(() => {
    if (!imgW || !imgH || !box.w || !box.h) return null;
    const scale = Math.min(box.w / imgW, box.h / imgH);
    const w = imgW * scale, h = imgH * scale;
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  }, [imgW, imgH, box.w, box.h]);

  // Reset beim Öffnen.
  useEffect(() => { if (visible) { setCrop(null); setAspect('frei'); } }, [visible]);
  // Crop initialisieren sobald das Display-Rect bekannt ist.
  useEffect(() => { if (disp && !crop) setCrop({ ...disp }); }, [disp, crop]);

  // Refs für den PanResponder (vermeidet stale closures).
  const cropRef = useRef<Rect | null>(crop);
  const dispRef = useRef<Rect | null>(disp);
  const startRef = useRef<Rect | null>(null);
  const modeRef = useRef<'move' | 'tl' | 'tr' | 'bl' | 'br'>('move');
  useEffect(() => { cropRef.current = crop; }, [crop]);
  useEffect(() => { dispRef.current = disp; }, [disp]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const c = cropRef.current; if (!c) return;
        startRef.current = { ...c };
        const { locationX, locationY } = e.nativeEvent;
        const corners: Record<string, [number, number]> = {
          tl: [c.x, c.y], tr: [c.x + c.w, c.y], bl: [c.x, c.y + c.h], br: [c.x + c.w, c.y + c.h],
        };
        let mode: typeof modeRef.current = 'move';
        let best = HANDLE_HIT;
        for (const k of Object.keys(corners)) {
          const [cx, cy] = corners[k];
          const d = Math.hypot(locationX - cx, locationY - cy);
          if (d < best) { best = d; mode = k as typeof modeRef.current; }
        }
        modeRef.current = mode;
      },
      onPanResponderMove: (_e, gs) => {
        const s = startRef.current; const d = dispRef.current; if (!s || !d) return;
        const m = modeRef.current;
        if (m === 'move') {
          const x = clamp(s.x + gs.dx, d.x, d.x + d.w - s.w);
          const y = clamp(s.y + gs.dy, d.y, d.y + d.h - s.h);
          setCrop({ x, y, w: s.w, h: s.h });
        } else {
          let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
          if (m === 'tl') { left = s.x + gs.dx; top = s.y + gs.dy; }
          if (m === 'tr') { right = s.x + s.w + gs.dx; top = s.y + gs.dy; }
          if (m === 'bl') { left = s.x + gs.dx; bottom = s.y + s.h + gs.dy; }
          if (m === 'br') { right = s.x + s.w + gs.dx; bottom = s.y + s.h + gs.dy; }
          left = clamp(left, d.x, right - MIN_SIZE);
          top = clamp(top, d.y, bottom - MIN_SIZE);
          right = clamp(right, left + MIN_SIZE, d.x + d.w);
          bottom = clamp(bottom, top + MIN_SIZE, d.y + d.h);
          setCrop({ x: left, y: top, w: right - left, h: bottom - top });
        }
      },
    })
  ).current;

  const pickAspect = (key: AspectKey, ratio: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAspect(key);
    if (disp) setCrop(centeredRect(disp, ratio));
  };

  const apply = async () => {
    if (applying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!crop || !disp || !skImage || !imgW || !imgH) { onDone(uri); return; }
    const scale = disp.w / imgW;
    const cx = clamp((crop.x - disp.x) / scale, 0, imgW);
    const cy = clamp((crop.y - disp.y) / scale, 0, imgH);
    const cw = Math.min(crop.w / scale, imgW - cx);
    const ch = Math.min(crop.h / scale, imgH - cy);
    setApplying(true);
    try {
      const out = await cropSkImageToFile(skImage, { x: cx, y: cy, w: cw, h: ch });
      if (out) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(out); }
      else Alert.alert('Schade', 'Zuschneiden hat nicht geklappt — versuch es nochmal.');
    } catch {
      Alert.alert('Schade', 'Zuschneiden hat nicht geklappt — versuch es nochmal.');
    } finally {
      setApplying(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.headerBtn}>
            <X size={24} color="#fff" strokeWidth={2.2} />
          </Pressable>
          <Text style={s.headerTitle}>Zuschneiden</Text>
          <Pressable onPress={apply} hitSlop={12} style={s.headerBtn} disabled={applying}>
            {applying ? <ActivityIndicator color="#fff" /> : <Check size={24} color="#fff" strokeWidth={2.4} />}
          </Pressable>
        </View>

        <View style={s.preview} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />

          {/* Interaktions-Layer (fängt Touches) + visueller Rahmen */}
          <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
            {crop && box.w > 0 && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Abdunkeln außerhalb */}
                <View style={[s.mask, { left: 0, top: 0, right: 0, height: crop.y }]} />
                <View style={[s.mask, { left: 0, top: crop.y + crop.h, right: 0, bottom: 0 }]} />
                <View style={[s.mask, { left: 0, top: crop.y, width: crop.x, height: crop.h }]} />
                <View style={[s.mask, { left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }]} />
                {/* Rahmen + Drittel-Linien */}
                <View style={[s.frame, { left: crop.x, top: crop.y, width: crop.w, height: crop.h }]}>
                  <View style={[s.grid, { left: crop.w / 3 }]} />
                  <View style={[s.grid, { left: (crop.w / 3) * 2 }]} />
                  <View style={[s.gridH, { top: crop.h / 3 }]} />
                  <View style={[s.gridH, { top: (crop.h / 3) * 2 }]} />
                </View>
                {/* Eck-Griffe */}
                <View style={[s.handle, { left: crop.x - 2, top: crop.y - 2 }]} />
                <View style={[s.handle, { left: crop.x + crop.w - 20, top: crop.y - 2 }]} />
                <View style={[s.handle, { left: crop.x - 2, top: crop.y + crop.h - 20 }]} />
                <View style={[s.handle, { left: crop.x + crop.w - 20, top: crop.y + crop.h - 20 }]} />
              </View>
            )}
          </View>
        </View>

        <View style={[s.aspectRow, { paddingBottom: insets.bottom + 18 }]}>
          {ASPECTS.map((a) => {
            const active = a.key === aspect;
            return (
              <Pressable key={a.key} onPress={() => pickAspect(a.key, a.ratio)} style={[s.aspectBtn, active && s.aspectBtnActive]}>
                <Text style={[s.aspectLabel, active && s.aspectLabelActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
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
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  preview: { flex: 1, overflow: 'hidden' },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)' },
  grid: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)' },
  handle: {
    position: 'absolute', width: 22, height: 22, borderRadius: 4,
    borderColor: '#fff', borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 3,
    backgroundColor: 'transparent',
  },
  aspectRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#000',
  },
  aspectBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  aspectBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  aspectLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  aspectLabelActive: { color: '#000' },
});

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
  type ImagePickerAsset,
} from 'expo-image-picker';
import { Image } from 'expo-image';
import type { SkPath } from '@shopify/react-native-skia';
// Skia sicher laden — alle Export-Pfade ausprobieren (Metro vs. ESM interop).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _skiaRaw: any = (() => {
  try { return require('@shopify/react-native-skia'); }
  catch { return {}; }
})();
// Named exports können entweder direkt oder unter .default liegen
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _resolveSkia = (key: string): any =>
  _skiaRaw[key] ?? _skiaRaw?.default?.[key] ?? undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Canvas      = _resolveSkia('Canvas')      as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SkImg       = _resolveSkia('Image')        as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ColorMatrix = _resolveSkia('ColorMatrix')  as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SkiaPathEl  = _resolveSkia('Path')         as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Skia        = _resolveSkia('Skia')         as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useImage: (uri: string | null) => any = _resolveSkia('useImage') ?? (() => null);
const SKIA_READY = !!(Canvas && SkImg && Skia);
console.log('[Skia] ready:', SKIA_READY, '| Canvas:', !!Canvas, '| Skia:', !!Skia);

import { supabase } from '@/lib/supabase';
import { uploadPostMedia, generateAndUploadThumbnail } from '@/lib/uploadMedia';
import { useAuthStore } from '@/lib/authStore';
import { useGuildInfo } from '@/lib/usePosts';
import { useQueryClient } from '@tanstack/react-query';
import { useDrafts } from '@/lib/useDrafts';
import {
  Music2, X, ChevronRight,
  Lock, Users, Globe, MessageCircle, Download, Repeat2,
  CheckCircle, ArrowRight, Settings2, Type, Smile, Sliders,
  FlipHorizontal, Scissors, Pencil, RotateCcw,
} from 'lucide-react-native';
import type { MusicTrack } from '@/lib/useMusicPicker';
import { MUSIC_LIBRARY } from '@/lib/useMusicPicker';
import { MusicPickerSheet } from '@/components/camera/MusicPickerSheet';
import { CreateProgressBar } from '@/components/create';
import type { PostSettingsState } from '@/components/create';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLOR_FILTERS, FILTER_CATALOG } from '@/lib/cameraFilters';
import type { ColorFilterId } from '@/lib/cameraFilters';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withDelay, Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Sticker Sheet — echte GIPHY Sticker ─────────────────────────────────────
const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '9Kp17xdnCuF9EsveCTQNmKplwF1PRmHY';
const GIPHY_SEARCH = (q: string) =>
  `https://api.giphy.com/v1/stickers/${q ? 'search' : 'trending'}?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`;

type GiphyItem = { id: string; images: { fixed_width_small: { url: string; width: string; height: string } } };
type StickerOverlay = { id: string; url: string; x: number; y: number };

function StickerSheet({ visible, onAdd, onClose }: { visible: boolean; onAdd: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadStickers('');
  }, [visible]);

  const loadStickers = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(GIPHY_SEARCH(q));
      const json = await res.json();
      setItems(json.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const onSearch = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => loadStickers(text), 400);
  };

  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={bs.overlay} /></TouchableWithoutFeedback>
      <View style={bs.sheet}>
        <View style={bs.handle} />
        <Text style={bs.title}>Sticker</Text>
        {/* Search */}
        <View style={bs.searchRow}>
          <TextInput
            style={bs.searchInput}
            placeholder="Sticker suchen…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={onSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {/* Grid */}
        {loading ? (
          <View style={bs.loadWrap}><Text style={bs.loadText}>Lädt…</Text></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={bs.stickerGrid}>
            <View style={bs.stickerGridInner}>
              {items.map(item => {
                const img = item.images.fixed_width_small;
                return (
                  <Pressable key={item.id} onPress={() => { onAdd(img.url); onClose(); }} style={bs.stickerBtn}>
                    <Image
                      source={{ uri: img.url }}
                      style={bs.stickerImg}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40, maxHeight: SH * 0.65 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadWrap: { height: 120, alignItems: 'center', justifyContent: 'center' },
  loadText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  stickerGrid: { paddingHorizontal: 16, paddingBottom: 16 },
  stickerGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn: { width: (SW - 32 - 24) / 4, height: (SW - 32 - 24) / 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stickerImg: { width: '85%', height: '85%' },
  // legacy fields (keep for AdjustSlider which still uses these style names below)
  catRow: { paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)' },
  catBtnActive: { backgroundColor: '#fff' },
  catText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
  catTextActive: { color: '#000' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 4 },
  emojiBtn: { width: (SW - 32 - 20) / 6, height: 56, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 34 },
});

// Draggable + Pinch-to-Scale Sticker auf dem Canvas
function StickerOverlayItem({ overlay, onRemove, onDragStart, onDragEnd, onMove }: {
  overlay: StickerOverlay;
  onRemove: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number, id: string) => void;
  onMove: (x: number, y: number) => void;
}) {
  const posX = useRef(overlay.x * SW);
  const posY = useRef(overlay.y * SH);
  const currentScale = useRef(1);
  const lastDist = useRef<number | null>(null);
  const lastTap = useRef(0);
  const isPinching = useRef(false);

  const translateX = useRef(new RNAnimated.Value(posX.current)).current;
  const translateY = useRef(new RNAnimated.Value(posY.current)).current;
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  // ⚠️ Callback-Refs: PanResponder wird einmal erstellt (useRef),
  // deshalb würden direkte Prop-Referenzen stale werden.
  const cbs = useRef({ onRemove, onDragStart, onDragEnd, onMove });
  useEffect(() => { cbs.current = { onRemove, onDragStart, onDragEnd, onMove }; });

  const getTouchDist = (evt: any): number | null => {
    const t = evt.nativeEvent?.touches;
    if (!t || t.length < 2) return null;
    const dx = t[0].pageX - t[1].pageX;
    const dy = t[0].pageY - t[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      cbs.current.onDragStart();
      const d = getTouchDist(evt);
      if (d !== null) { lastDist.current = d; isPinching.current = true; }
      else { isPinching.current = false; lastDist.current = null; }
    },
    onPanResponderMove: (evt, gs) => {
      const d = getTouchDist(evt);
      if (d !== null && lastDist.current !== null) {
        const ratio = d / lastDist.current;
        currentScale.current = Math.max(0.3, Math.min(5, currentScale.current * ratio));
        scaleAnim.setValue(currentScale.current);
        lastDist.current = d;
        isPinching.current = true;
      } else if (!isPinching.current) {
        translateX.setValue(posX.current + gs.dx);
        translateY.setValue(posY.current + gs.dy);
        cbs.current.onMove(gs.moveX, gs.moveY);
      }
    },
    onPanResponderRelease: (ev, gs) => {
      if (!isPinching.current) {
        posX.current = posX.current + gs.dx;
        posY.current = posY.current + gs.dy;
        translateX.setValue(posX.current);
        translateY.setValue(posY.current);
        const now = Date.now();
        if (now - lastTap.current < 300 && Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          onRemove(overlay.id);
        }
        lastTap.current = now;
        onDragEnd(gs.moveX, gs.moveY, overlay.id);
      } else {
        onDragEnd(-1, -1, overlay.id);
      }
      lastDist.current = null;
      isPinching.current = false;
    },
    onPanResponderTerminate: () => {
      lastDist.current = null;
      isPinching.current = false;
      onDragEnd(-1, -1, overlay.id);
    },
  })).current;

  return (
    <RNAnimated.View
      style={[{ position: 'absolute', top: 0, left: 0, zIndex: 21 }, {
        transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
      }]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri: overlay.url }} style={{ width: 96, height: 96 }} contentFit="contain" />
    </RNAnimated.View>
  );
}

// ─── Filter-Overlay System (View-basiert, für Expo Go) ──────────────────────
// Leitet aus der ColorMatrix sichtbare Layer ab:
// 1) Sättigungs-Emulation via Graustufen-Blend
// 2) Farb-Bias via rgba-Overlay
// 3) Kontrast/Helligkeit via Opazität
function extractFilterStyle(filterId: ColorFilterId | null): {
  tint: string; tintOpacity: number;
  brightness: 'lighten' | 'darken' | null; biasOpacity: number;
  desaturate: boolean; desatOpacity: number;
} {
  if (!filterId || filterId === 'none') return { tint: 'transparent', tintOpacity: 0, brightness: null, biasOpacity: 0, desaturate: false, desatOpacity: 0 };
  const m = COLOR_FILTERS[filterId];
  const rr = m[0], rg = m[1], rb = m[2]; // Wie stark R → R beiträgt
  const gg = m[6], gb = m[7];             // G → G
  const br = m[10], bg = m[11], bb = m[12]; // B-Zeile
  const rBias = m[4], gBias = m[9], bBias = m[14]; // Konstante Offsets

  // Helligkeit: Diagonale > 1 = aufhellen, < 1 = abdunkeln
  const diagAvg = (rr + gg + bb) / 3;
  const brightness: 'lighten' | 'darken' | null = diagAvg > 1.1 ? 'lighten' : diagAvg < 0.7 ? 'darken' : null;
  const biasOpacity = Math.min(0.35, Math.abs(diagAvg - 1) * 0.5);

  // Farb-Tint: Bias-Werte als Farbe (in 0-255)
  const r = Math.round(Math.max(0, Math.min(255, rBias)));
  const g = Math.round(Math.max(0, Math.min(255, gBias)));
  const b = Math.round(Math.max(0, Math.min(255, bBias)));
  const biasSum = Math.abs(rBias) + Math.abs(gBias) + Math.abs(bBias);
  const tintOpacity = Math.min(0.3, biasSum / 255 * 1.5);
  const tint = tintOpacity > 0.02 ? `rgb(${r},${g},${b})` : 'transparent';

  // Sättigung: Wenn Nicht-Diagonale stark negativ → teilweise Entsättigung
  const crossStrength = Math.abs(rg) + Math.abs(rb) + Math.abs(br) + Math.abs(bg) + Math.abs(gb);
  const lumaish = 0.3 * rr + 0.59 * gg + 0.11 * bb; // ähnlich wie BW-Gewichtung
  const desaturate = lumaish > 0.7 && crossStrength > 0.4; // Graustufen-Filter
  const desatOpacity = desaturate ? Math.min(0.9, lumaish) : 0;

  return { tint, tintOpacity, brightness, biasOpacity, desaturate, desatOpacity };
};

function FilterOverlays({ filterId }: { filterId: ColorFilterId | null }) {
  if (!filterId || filterId === 'none') return null;
  const { tint, tintOpacity, brightness, biasOpacity, desaturate, desatOpacity } = extractFilterStyle(filterId);
  return (
    <>
      {/* Farb-Tint */}
      {tintOpacity > 0.01 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: tintOpacity }]} />
      )}
      {/* Helligkeit */}
      {brightness === 'lighten' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,1)', opacity: biasOpacity }]} />
      )}
      {brightness === 'darken' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,1)', opacity: biasOpacity }]} />
      )}
      {/* Entsättigung für Graustufen-Filter */}
      {desaturate && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(128,128,128,1)', opacity: desatOpacity * 0.4 }]} />
      )}
    </>
  );
}

function SkiaFilteredImage({ uri, filterId }: {
  uri: string; filterId: ColorFilterId | null;
}) {
  // Zuerst echtes Skia verösuchen, Fallback auf View-Overlay
  const image = useImage(uri);
  const matrix = filterId ? COLOR_FILTERS[filterId] : COLOR_FILTERS.none;
  if (SKIA_READY && image && Canvas && SkImg && ColorMatrix) {
    const skia20 = matrix.map((v, i) => ((i + 1) % 5 === 0 ? v / 255 : v));
    return (
      <Canvas style={StyleSheet.absoluteFill}>
        <SkImg image={image} x={0} y={0} width={SW} height={SH} fit="cover">
          <ColorMatrix matrix={skia20} />
        </SkImg>
      </Canvas>
    );
  }
  // Fallback: expo-image + sichtbare View-Overlays
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <FilterOverlays filterId={filterId} />
    </View>
  );
}

// Thumbnail-Version für den FilterSheet
function FilterThumb({ uri, filterId, size, active }: {
  uri: string; filterId: ColorFilterId;
  size: number; active: boolean;
}) {
  const image = useImage(uri);
  const isActive = active;
  const thStyle = { width: size, height: size * 1.35, borderRadius: 10, overflow: 'hidden' as const,
    borderWidth: isActive ? 2.5 : 0, borderColor: '#fff' };

  if (SKIA_READY && image && Canvas && SkImg && ColorMatrix) {
    const matrix = COLOR_FILTERS[filterId];
    const skia20 = matrix.map((v, i) => ((i + 1) % 5 === 0 ? v / 255 : v));
    return (
      <View style={thStyle}>
        <Canvas style={{ width: size, height: size * 1.35 }}>
          <SkImg image={image} x={0} y={0} width={size} height={size * 1.35} fit="cover">
            <ColorMatrix matrix={skia20} />
          </SkImg>
        </Canvas>
      </View>
    );
  }
  // Fallback: expo-image + Farb-Overlay
  return (
    <View style={thStyle}>
      <Image source={{ uri }} style={{ width: size, height: size * 1.35 }} contentFit="cover" />
      <FilterOverlays filterId={filterId} />
    </View>
  );
}

// ─── Filter Sheet — 22 Filter ──────────────────────────────────────────────────
const COLOR_FILTER_LIST = FILTER_CATALOG.filter(f => f.category === 'color');

function FilterSheet({ visible, mediaUri, currentId, onSelect, onClose }: {
  visible: boolean; mediaUri: string;
  currentId: ColorFilterId | null;
  onSelect: (id: ColorFilterId | null) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={bs.overlay} /></TouchableWithoutFeedback>
      <View style={fs.sheet}>
        <View style={bs.handle} />
        <Text style={bs.title}>Filter</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.row}>
          {COLOR_FILTER_LIST.map(preset => {
            const id = preset.id as ColorFilterId;
            const isActive = (currentId ?? 'none') === id;
            return (
              <Pressable key={id} onPress={() => onSelect(id === 'none' ? null : id)} style={fs.item}>
                <FilterThumb uri={mediaUri} filterId={id} size={80} active={isActive} />
                <Text style={[fs.label, isActive && fs.labelActive]}>{preset.emoji} {preset.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={fs.doneBtn} onPress={onClose}><Text style={fs.doneBtnText}>Fertig ✓</Text></Pressable>
      </View>
    </Modal>
  );
}
const fs = StyleSheet.create({
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40 },
  row: { paddingHorizontal: 16, gap: 14, paddingBottom: 16 },
  item: { alignItems: 'center', gap: 6 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  labelActive: { color: '#fff' },
  doneBtn: { marginHorizontal: 20, backgroundColor: '#fff', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});

// ─── Draw Tool (react-native-svg, kein Native Build nötig) ───────────────────────
const DRAW_COLORS = ['#FFFFFF','#000000','#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#007AFF','#AF52DE','#FF2D55'];
const DRAW_SIZES  = [3, 6, 12, 20];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _svg: any = (() => { try { return require('react-native-svg'); } catch { return {}; } })();
const Svg        = (_svg?.default?.default ?? _svg?.default ?? _svg)?.Svg         as any;
const SvgPath    = (_svg?.default?.default ?? _svg?.default ?? _svg)?.Path        as any;

// Pfad als SVG-String aus Punkt-Array
function pointsToSvgPath(points: number[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  return d;
}

type DrawnPath = { points: number[]; color: string; width: number };

function DrawCanvas({ paths, activeColor, activeWidth, onAddPath }: {
  paths: DrawnPath[];
  activeColor: string;
  activeWidth: number;
  onAddPath: (p: DrawnPath) => void;
}) {
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const livePointsRef = useRef<number[]>([]);

  const activeColorRef = useRef(activeColor);
  const activeWidthRef = useRef(activeWidth);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { activeWidthRef.current = activeWidth; }, [activeWidth]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      livePointsRef.current = [locationX, locationY];
      setLivePoints([locationX, locationY]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      livePointsRef.current = [...livePointsRef.current, locationX, locationY];
      setLivePoints([...livePointsRef.current]);
    },
    onPanResponderRelease: () => {
      if (livePointsRef.current.length >= 2) {
        onAddPath({ points: [...livePointsRef.current], color: activeColorRef.current, width: activeWidthRef.current });
      }
      livePointsRef.current = [];
      setLivePoints([]);
    },
    onPanResponderTerminate: () => {
      livePointsRef.current = [];
      setLivePoints([]);
    },
  })).current;

  const livePath = livePoints.length >= 2 ? pointsToSvgPath(livePoints) : null;

  return (
    <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
      {Svg && SvgPath ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((dp, i) => (
            <SvgPath
              key={i}
              d={pointsToSvgPath(dp.points)}
              stroke={dp.color}
              strokeWidth={dp.width}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {livePath && (
            <SvgPath
              d={livePath}
              stroke={activeColor}
              strokeWidth={activeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>
      ) : null}
    </View>
  );
}

function DrawToolbar({ activeColor, onColor, activeWidth, onWidth, onUndo, onClose, bottomOffset }: {
  activeColor: string; onColor: (c: string) => void;
  activeWidth: number; onWidth: (w: number) => void;
  onUndo: () => void; onClose: () => void;
  bottomOffset: number;
}) {
  const { top } = useSafeAreaInsets();
  return (
    <>
      {/* ── TOP BAR ─ Aktionen + Strichstärke ───────────────────── */}
      <View style={[dw.topBar, { top: top + 6 }]}>
        {/* Close */}
        <Pressable onPress={onClose} style={dw.circleBtn} hitSlop={8}>
          <X size={16} color="#fff" strokeWidth={2.5} />
        </Pressable>

        {/* Strichstärke — visuell repräsentierte Punkte */}
        <View style={dw.sizeRow}>
          {DRAW_SIZES.map(sz => {
            const isActive = activeWidth === sz;
            const dotSize = 6 + sz * 1.4; // skaliert proportional
            return (
              <Pressable key={sz} onPress={() => onWidth(sz)} style={dw.sizeHit}>
                <View style={{
                  width: dotSize, height: dotSize, borderRadius: dotSize / 2,
                  backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.3)',
                  borderWidth: isActive ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.5)',
                  shadowColor: isActive ? activeColor : 'transparent',
                  shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
                }} />
              </Pressable>
            );
          })}
        </View>

        {/* Undo */}
        <Pressable onPress={onUndo} style={dw.circleBtn} hitSlop={8}>
          <RotateCcw size={16} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* ── BOTTOM COLOR PALETTE ─────────────────────────────────── */}
      <View style={[dw.colorBar, { bottom: bottomOffset }]}>
        {/* Aktive Farbe — große Vorschau links */}
        <View style={[dw.activeColorPreview, { backgroundColor: activeColor }]}>
          <View style={dw.activeColorInner} />
        </View>

        <View style={dw.colorBarDivider} />

        {/* Farb-Palette */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dw.colorRow}
          style={{ flex: 1 }}
        >
          {DRAW_COLORS.map(c => {
            const isActive = activeColor === c;
            return (
              <Pressable key={c} onPress={() => onColor(c)} style={dw.colorHit}>
                <View style={[
                  dw.colorDot,
                  { backgroundColor: c },
                  isActive && dw.colorDotActive,
                ]}>
                  {isActive && <View style={dw.colorDotCheck} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const dw = StyleSheet.create({
  /* Top Bar */
  topBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 50,
    paddingHorizontal: 8, paddingVertical: 8,
    // glassmorphism shadow
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sizeHit: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  /* Bottom Color Bar */
  colorBar: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
  },
  activeColorPreview: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    marginRight: 4,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  activeColorInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  colorBarDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 12 },
  colorRow: { gap: 10, alignItems: 'center' },
  colorHit: { padding: 4 },
  colorDot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  colorDotActive: {
    borderWidth: 3, borderColor: '#fff',
    transform: [{ scale: 1.18 }],
  },
  colorDotCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)' },
});


// ─── Adjust Sheet ─────────────────────────────────────────────────────────────
type AdjustValues = { brightness: number; contrast: number; saturation: number };

function AdjustSlider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const pct = (value - min) / (max - min);
  const pan = useRef(new RNAnimated.Value(pct)).current;
  const trackW = SW - 80;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      const base = (pan as any)._offset ?? 0;
      const raw = base + gs.dx / trackW;
      const clamped = Math.max(0, Math.min(1, raw));
      onChange(min + clamped * (max - min));
    },
    onPanResponderGrant: () => { (pan as any)._offset = (pan as any)._value; },
    onPanResponderRelease: () => { const v = (value - min) / (max - min); pan.setValue(v); (pan as any)._offset = 0; },
  })).current;

  const thumbX = (value - min) / (max - min) * trackW;
  return (
    <View style={aj.sliderRow}>
      <Text style={aj.sliderLabel}>{label}</Text>
      <View style={aj.track} {...panResponder.panHandlers}>
        <View style={[aj.fill, { width: thumbX }]} />
        <View style={[aj.thumb, { left: thumbX - 12 }]} />
      </View>
      <Text style={aj.sliderVal}>{value > 0 ? `+${value}` : value}</Text>
    </View>
  );
}

function AdjustSheet({ visible, values, onChange, onClose }: {
  visible: boolean; values: AdjustValues; onChange: (v: AdjustValues) => void; onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={bs.overlay} /></TouchableWithoutFeedback>
      <View style={aj.sheet}>
        <View style={bs.handle} />
        <Text style={bs.title}>Anpassen</Text>
        <AdjustSlider label="Helligkeit" value={values.brightness} min={-50} max={50}
          onChange={v => onChange({ ...values, brightness: Math.round(v) })} />
        <AdjustSlider label="Kontrast" value={values.contrast} min={-50} max={50}
          onChange={v => onChange({ ...values, contrast: Math.round(v) })} />
        <AdjustSlider label="Sättigung" value={values.saturation} min={-50} max={50}
          onChange={v => onChange({ ...values, saturation: Math.round(v) })} />
        <Pressable style={fs.doneBtn} onPress={onClose}><Text style={fs.doneBtnText}>Fertig</Text></Pressable>
      </View>
    </Modal>
  );
}
const aj = StyleSheet.create({
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 48, gap: 8 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginBottom: 4 },
  sliderLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', width: 90 },
  sliderVal: { color: 'rgba(255,255,255,0.6)', fontSize: 12, width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 36, justifyContent: 'center', position: 'relative' },
  fill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  thumb: { position: 'absolute', top: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 },
});

// ─── Rotate Sheet ─────────────────────────────────────────────────────────────
type RotateState = { rotation: 0 | 90 | 180 | 270; flipH: boolean };

function RotateSheet({ visible, state, onChange, onClose }: {
  visible: boolean; state: RotateState; onChange: (s: RotateState) => void; onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={bs.overlay} /></TouchableWithoutFeedback>
      <View style={ro.sheet}>
        <View style={bs.handle} />
        <Text style={bs.title}>Drehen & Spiegeln</Text>
        <View style={ro.row}>
          {/* Rotate L */}
          <Pressable style={ro.btn} onPress={() => onChange({ ...state, rotation: (((state.rotation - 90) % 360 + 360) % 360) as RotateState['rotation'] })}>
            <Text style={ro.icon}>↺</Text><Text style={ro.btnLabel}>Links 90°</Text>
          </Pressable>
          {/* Rotate R */}
          <Pressable style={ro.btn} onPress={() => onChange({ ...state, rotation: ((state.rotation + 90) % 360) as RotateState['rotation'] })}>
            <Text style={ro.icon}>↻</Text><Text style={ro.btnLabel}>Rechts 90°</Text>
          </Pressable>
          {/* Flip H */}
          <Pressable style={[ro.btn, state.flipH && ro.btnActive]} onPress={() => onChange({ ...state, flipH: !state.flipH })}>
            <Text style={ro.icon}>⇔</Text><Text style={ro.btnLabel}>Spiegeln</Text>
          </Pressable>
          {/* Reset */}
          <Pressable style={ro.btn} onPress={() => onChange({ rotation: 0, flipH: false })}>
            <Text style={ro.icon}>⊙</Text><Text style={ro.btnLabel}>Reset</Text>
          </Pressable>
        </View>
        {/* Rotation Badge */}
        <Text style={ro.badge}>{state.rotation}° {state.flipH ? '· gespiegelt' : ''}</Text>
        <Pressable style={fs.doneBtn} onPress={onClose}><Text style={fs.doneBtnText}>Fertig</Text></Pressable>
      </View>
    </Modal>
  );
}
const ro = StyleSheet.create({
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 20 },
  btn: { alignItems: 'center', gap: 8, width: 72, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  btnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  icon: { fontSize: 28, color: '#fff' },
  btnLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  badge: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 16 },
});

// ─── Video Trim Sheet ─────────────────────────────────────────────────────────
const STRIP_PADDING = 20;
const STRIP_W = SW - STRIP_PADDING * 2;
const HANDLE_W = 22;
const FRAME_COUNT = 8;
const FRAME_W = (STRIP_W - HANDLE_W * 2) / FRAME_COUNT;

type TrimResult = { startMs: number; endMs: number; speedFactor: number };

function TrimHandle({
  side, position, onDrag, onEnd,
}: { side: 'left' | 'right'; position: ReturnType<typeof useSharedValue<number>>; onDrag: (x: number) => void; onEnd: () => void }) {
  const gesture = Gesture.Pan().minDistance(0)
    .onUpdate((e) => { runOnJS(onDrag)(e.absoluteX - STRIP_PADDING); })
    .onEnd(() => { runOnJS(onEnd)(); });
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[th.wrap, animStyle]}>
        <View style={th.bar}>
          <View style={th.grip} /><View style={th.grip} /><View style={th.grip} />
        </View>
        <Text style={[th.arrow, side === 'left' ? th.arrowL : th.arrowR]}>{side === 'left' ? '‹' : '›'}</Text>
      </Animated.View>
    </GestureDetector>
  );
}
const th = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, width: HANDLE_W, height: 56, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  bar: { width: HANDLE_W, height: '100%', borderRadius: 4, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 3 },
  grip: { width: 2, height: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 1 },
  arrow: { position: 'absolute', color: '#fff', fontSize: 18, fontWeight: '800', top: -22 },
  arrowL: { left: 3 },
  arrowR: { right: 3 },
});

function VideoTrimSheet({
  visible, uri, onDone, onCancel,
}: { visible: boolean; uri: string; onDone: (r: TrimResult) => void; onCancel: () => void; }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [speedFactor, setSpeedFactor] = useState<0.5|1|1.5|2>(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const leftPos = useSharedValue(0);
  const rightPos = useSharedValue(STRIP_W - HANDLE_W);

  const player = useVideoPlayer(uri ?? '', (p) => { p.loop = true; p.play(); });

  useEffect(() => {
    if (!visible) return;
    setStartSec(0); setEndSec(0); setSpeedFactor(1); setIsPlaying(true);
    leftPos.value = 0; rightPos.value = STRIP_W - HANDLE_W;
    setFramesLoading(true);
    (async () => {
      try {
        const d = player.duration > 0 ? player.duration : 15;
        const thumbs = await Promise.all(
          Array.from({ length: FRAME_COUNT }).map((_, i) => {
            const timeMs = Math.floor((i / (FRAME_COUNT - 1)) * d * 1000);
            return getThumbnailAsync(uri, { time: timeMs, quality: 0.3 });
          })
        );
        setFrames(thumbs.map(t => t.uri));
        setDuration(d); setEndSec(d);
      } catch { /* ignore */ } finally { setFramesLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const pxToSec = useCallback((px: number) => (px / STRIP_W) * (duration || 15), [duration]);

  const handleLeftDrag = useCallback((x: number) => {
    const c = Math.max(0, Math.min(x, rightPos.value - HANDLE_W * 2));
    leftPos.value = c; setStartSec(pxToSec(c));
    try { player.currentTime = pxToSec(c); } catch { /* ignore */ }
  }, [leftPos, rightPos, pxToSec, player]);

  const handleRightDrag = useCallback((x: number) => {
    const c = Math.max(leftPos.value + HANDLE_W * 2, Math.min(x, STRIP_W - HANDLE_W));
    rightPos.value = c; setEndSec(pxToSec(c));
  }, [rightPos, leftPos, pxToSec]);

  const highlightStyle = useAnimatedStyle(() => ({
    left: leftPos.value + HANDLE_W, right: STRIP_W - rightPos.value,
  }));
  const maskLeftStyle = useAnimatedStyle(() => ({ width: leftPos.value + HANDLE_W }));
  const maskRightStyle = useAnimatedStyle(() => ({ left: rightPos.value }));

  const fmt = (s: number) => `${Math.floor(s)}:${String(Math.round((s % 1) * 10)).padStart(1, '0')}s`;
  const trimDur = Math.max(0, endSec - startSec);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={tv.overlay} />
        </TouchableWithoutFeedback>
        <View style={tv.sheet}>
          <View style={tv.handle} />
          <Text style={tv.title}>Video kürzen</Text>

          {/* Dauer-Anzeige */}
          <View style={tv.durRow}>
            <View style={tv.badge}><Text style={tv.badgeText}>{fmt(startSec)} – {fmt(endSec)}</Text></View>
            <View style={tv.badgeSel}><Text style={tv.badgeSelText}>{trimDur.toFixed(1)}s</Text></View>
          </View>

          {/* Frame Strip */}
          <View style={tv.stripOuter}>
            <View style={tv.stripContainer}>
              <View style={{ flexDirection: 'row', height: 56 }}>
                {framesLoading
                  ? Array.from({ length: FRAME_COUNT }).map((_, i) => <View key={i} style={[{ width: FRAME_W, height: 56 }, tv.frameSkel]} />)
                  : frames.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: FRAME_W, height: 56 }} contentFit="cover" />)
                }
              </View>
              <Animated.View style={[tv.highlight, highlightStyle]} />
              <Animated.View style={[tv.mask, { left: 0 }, maskLeftStyle]} />
              <Animated.View style={[tv.mask, { right: 0, left: undefined }, maskRightStyle]} />
            </View>
            <TrimHandle side="left" position={leftPos} onDrag={(absX) => handleLeftDrag(absX - STRIP_PADDING)} onEnd={() => {}} />
            <TrimHandle side="right" position={rightPos} onDrag={(absX) => handleRightDrag(absX - STRIP_PADDING)} onEnd={() => {}} />
          </View>

          {/* Geschwindigkeit */}
          <View style={tv.speedRow}>
            {([0.5, 1, 1.5, 2] as const).map(sp => (
              <Pressable key={sp} onPress={() => { setSpeedFactor(sp); try { player.playbackRate = sp; } catch { /* ignore */ } }}
                style={[tv.speedBtn, speedFactor === sp && tv.speedBtnActive]}>
                <Text style={[tv.speedText, speedFactor === sp && tv.speedTextActive]}>{sp}x</Text>
              </Pressable>
            ))}
          </View>

          {/* Hinweis */}
          <Text style={tv.hint}>Ziehe die weißen Griffe um den Ausschnitt zu wählen</Text>

          {/* Bestätigen */}
          <Pressable
            style={tv.doneBtn}
            onPress={() => onDone({ startMs: Math.round(startSec * 1000), endMs: Math.round(endSec * 1000), speedFactor })}
          >
            <Text style={tv.doneBtnText}>Übernehmen</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const tv = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 0, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  durRow: { flexDirection: 'row', gap: 10, paddingHorizontal: STRIP_PADDING, marginBottom: 14 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badgeSel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  badgeSelText: { color: '#fff', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stripOuter: { marginHorizontal: STRIP_PADDING, height: 56, position: 'relative', marginBottom: 16 },
  stripContainer: { height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  frameSkel: { backgroundColor: 'rgba(255,255,255,0.06)' },
  highlight: { position: 'absolute', top: 0, height: '100%', borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#fff', zIndex: 5 },
  mask: { position: 'absolute', top: 0, height: '100%', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 4 },
  speedRow: { flexDirection: 'row', gap: 6, marginHorizontal: STRIP_PADDING, marginBottom: 12 },
  speedBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  speedBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  speedText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700' },
  speedTextActive: { color: '#fff' },
  hint: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  doneBtn: { marginHorizontal: STRIP_PADDING, backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});

// ─── Text Overlay Types ──────────────────────────────────────────────────────
type TextOverlay = {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  x: number; // 0..1 relative
  y: number; // 0..1 relative
};

// ─── Text Overlay Editor Modal ────────────────────────────────────────────────
const FONT_SIZES = [18, 24, 32, 42, 56];
const TEXT_COLORS = ['#ffffff','#000000','#FF3B30','#FF9500','#FFD60A','#30D158','#32ADE6','#BF5AF2','#FF2D55'];

function TextOverlayEditor({
  visible, onDone, onCancel,
}: { visible: boolean; onDone: (overlay: Omit<TextOverlay,'id'|'x'|'y'>) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState('#ffffff');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) { setText(''); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={to.root}>
        <View style={to.root}>

          {/* Tap-to-close background */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          {/* Top bar */}
          <View style={to.topBar}>
            <Pressable onPress={onCancel} style={to.cancelBtn}>
              <Text style={to.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (text.trim()) { onDone({ text: text.trim(), fontSize, color }); setText(''); } else { onCancel(); } }}
              style={to.doneBtn}
            >
              <Text style={to.doneText}>Fertig</Text>
            </Pressable>
          </View>

          {/* Live-Preview + Input */}
          <View style={to.previewArea} pointerEvents="box-none">
            <TextInput
              ref={inputRef}
              style={[to.textInput, { fontSize, color }]}
              value={text}
              onChangeText={setText}
              placeholder="Text eingeben..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              textAlign="center"
              selectionColor={color}
              returnKeyType="done"
              onSubmitEditing={() => { if (text.trim()) onDone({ text: text.trim(), fontSize, color }); }}
              blurOnSubmit={false}
            />
          </View>

          {/* Bottom controls: Font Size + Colors */}
          <View style={to.controls}>
            {/* Font size */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={to.sizeRow}>
              {FONT_SIZES.map((sz) => (
                <Pressable key={sz} onPress={() => setFontSize(sz)} style={[to.sizeBtn, fontSize === sz && to.sizeBtnActive]}>
                  <Text style={[to.sizeBtnText, { fontSize: Math.min(sz * 0.55, 22) }, fontSize === sz && { color: '#000' }]}>Aa</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Colors */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={to.colorRow}>
              {TEXT_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} style={[to.colorDot, { backgroundColor: c }, color === c && to.colorDotActive]} />
              ))}
            </ScrollView>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const to = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  cancelBtn: { padding: 8 },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  doneBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  doneText: { color: '#000', fontSize: 15, fontWeight: '800' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  textInput: { color: '#fff', textAlign: 'center', fontWeight: '700', width: '100%', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  controls: { paddingBottom: 40, gap: 12 },
  sizeRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  sizeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  sizeBtnActive: { backgroundColor: '#fff' },
  sizeBtnText: { color: '#fff', fontWeight: '800' },
  colorRow: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
});

// ─── Trash Zone — präzise Bounds + Spring-Zoom ──────────────────────────────
const TRASH_BTN_W     = 230;
const TRASH_BTN_H     = 56;
const TRASH_BTN_X     = (SW - TRASH_BTN_W) / 2;  // horizontal zentriert
const TRASH_BTN_TOP   = SH * 0.70;               // 70% von oben (OBERHALB des BottomBars)
const TRASH_BTN_BOT   = TRASH_BTN_TOP + TRASH_BTN_H;

const isInTrash = (x: number, y: number) =>
  x >= TRASH_BTN_X && x <= TRASH_BTN_X + TRASH_BTN_W &&
  y >= TRASH_BTN_TOP && y <= TRASH_BTN_BOT;

function TrashZone({ visible, isOver }: { visible: boolean; isOver: boolean }) {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(opacityAnim, {
      toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }, [visible]);

  useEffect(() => {
    // Kein Spring (federt) — einfaches Timing für weiche Skalierung
    RNAnimated.timing(scaleAnim, {
      toValue: isOver ? 1.08 : 1.0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isOver]);

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: TRASH_BTN_TOP,
        left: TRASH_BTN_X,
        width: TRASH_BTN_W,
        height: TRASH_BTN_H,
        zIndex: 99,
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <View style={[tz.zone, isOver && tz.zoneActive]}>
        <Text style={tz.icon}>🗑️</Text>
        <Text style={tz.label}>{isOver ? 'Loslassen zum Löschen' : 'Zum Löschen ziehen'}</Text>
      </View>
    </RNAnimated.View>
  );
}
const tz = StyleSheet.create({
  zone: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28, backgroundColor: 'rgba(15,15,20,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  zoneActive: { backgroundColor: 'rgba(140,20,20,0.60)', borderColor: 'rgba(220,80,80,0.5)' },
  icon: { fontSize: 18 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
});

// ─── Text Overlay Item — Drag + Pinch-to-Scale + Trash ───────────────────────
function TextOverlayItem({
  overlay, onRemove, onDragStart, onDragEnd, onMove,
}: {
  overlay: TextOverlay;
  onRemove: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number, id: string) => void;
  onMove: (x: number, y: number) => void;
}) {
  const posX = useRef(overlay.x * SW);
  const posY = useRef(overlay.y * SH);
  const currentScale = useRef(1);
  const lastDist = useRef<number | null>(null);
  const lastTap = useRef(0);
  const isPinching = useRef(false);

  const translateX = useRef(new RNAnimated.Value(posX.current)).current;
  const translateY = useRef(new RNAnimated.Value(posY.current)).current;
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  // ⚠️ Callback-Refs: PanResponder wird einmal erstellt (useRef),
  // deshalb würden direkte Prop-Referenzen stale werden.
  // Wir speichern alle Callbacks in einem Ref und updaten es auf jedem Render.
  const cbs = useRef({ onRemove, onDragStart, onDragEnd, onMove });
  useEffect(() => { cbs.current = { onRemove, onDragStart, onDragEnd, onMove }; });

  const getTouchDist = (evt: any): number | null => {
    const t = evt.nativeEvent?.touches;
    if (!t || t.length < 2) return null;
    const dx = t[0].pageX - t[1].pageX;
    const dy = t[0].pageY - t[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      cbs.current.onDragStart();
      const d = getTouchDist(evt);
      if (d !== null) { lastDist.current = d; isPinching.current = true; }
      else { isPinching.current = false; lastDist.current = null; }
    },
    onPanResponderMove: (evt, gs) => {
      const d = getTouchDist(evt);
      if (d !== null && lastDist.current !== null) {
        const ratio = d / lastDist.current;
        currentScale.current = Math.max(0.3, Math.min(6, currentScale.current * ratio));
        scaleAnim.setValue(currentScale.current);
        lastDist.current = d;
        isPinching.current = true;
      } else if (!isPinching.current) {
        translateX.setValue(posX.current + gs.dx);
        translateY.setValue(posY.current + gs.dy);
        cbs.current.onMove(gs.moveX, gs.moveY);
      }
    },
    onPanResponderRelease: (ev, gs) => {
      if (!isPinching.current) {
        // Update element position
        posX.current = posX.current + gs.dx;
        posY.current = posY.current + gs.dy;
        translateX.setValue(posX.current);
        translateY.setValue(posY.current);
        const now = Date.now();
        if (now - lastTap.current < 300 && Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          cbs.current.onRemove(overlay.id);
        }
        lastTap.current = now;
        // ⚠️ Finger-Koordinaten (screen space) übergeben, nicht Element-Position!
        cbs.current.onDragEnd(gs.moveX, gs.moveY, overlay.id);
      } else {
        cbs.current.onDragEnd(-1, -1, overlay.id);
      }
      lastDist.current = null;
      isPinching.current = false;
    },
    onPanResponderTerminate: () => {
      lastDist.current = null;
      isPinching.current = false;
      cbs.current.onDragEnd(-1, -1, overlay.id);
    },
  })).current;

  return (
    <RNAnimated.View
      style={[oi.container, {
        transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
      }]}
      {...panResponder.panHandlers}
    >
      <Text style={[oi.text, { fontSize: overlay.fontSize, color: overlay.color }]}>
        {overlay.text}
      </Text>
    </RNAnimated.View>
  );
}

const oi = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, zIndex: 20, alignSelf: 'flex-start', maxWidth: SW * 0.85 },
  text: { fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
});

// ─── Konfetti ───────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#22D3EE','#A855F7','#F472B6','#FB923C','#34D399','#FBBF24','#60A5FA','#F87171'];
function ConfettiDot({ color, angle, delay }: { color: string; angle: number; delay: number }) {
  const tx = useSharedValue(0), ty = useSharedValue(0);
  const opacity = useSharedValue(0), scale = useSharedValue(0);
  useEffect(() => {
    const dist = 90 + Math.random() * 60, rad = (angle * Math.PI) / 180;
    tx.value = withDelay(delay, withTiming(Math.cos(rad) * dist, { duration: 900, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(Math.sin(rad) * dist, { duration: 900, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(delay, withSequence(withTiming(1,{duration:0}), withDelay(500, withTiming(0,{duration:400}))));
    scale.value = withDelay(delay, withSequence(withSpring(1.2,{damping:8,stiffness:300}), withTiming(0.6,{duration:400})));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform:[{translateX:tx.value},{translateY:ty.value},{scale:scale.value}], opacity:opacity.value }));
  return <Animated.View style={[{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:color},style]} />;
}

// ─── Erfolgs-Overlay ────────────────────────────────────────────────────────
function PostSuccessOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const checkScale = useSharedValue(0), textOpacity = useSharedValue(0), bgOpacity = useSharedValue(0);
  useEffect(() => {
    if (!visible) { checkScale.value = 0; textOpacity.value = 0; bgOpacity.value = 0; return; }
    bgOpacity.value = withTiming(1, { duration: 200 });
    checkScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 200 }));
    textOpacity.value = withDelay(350, withTiming(1, { duration: 300 }));
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  if (!visible) return null;
  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[suc.bg, bgStyle]}>
        <View style={suc.confetti} pointerEvents="none">
          {CONFETTI_COLORS.map((c, i) => <ConfettiDot key={i} color={c} angle={(i/CONFETTI_COLORS.length)*360} delay={i*40} />)}
        </View>
        <Animated.View style={checkStyle}>
          <CheckCircle size={88} color="#22D3EE" strokeWidth={1.5} fill="rgba(34,211,238,0.15)" />
        </Animated.View>
        <Animated.View style={textStyle}>
          <Text style={suc.title}>Vibe ist live! 🎉</Text>
          <Text style={suc.sub}>Dein Post ist jetzt im Feed sichtbar</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
const suc = StyleSheet.create({
  bg: { flex:1, backgroundColor:'rgba(0,0,0,0.92)', alignItems:'center', justifyContent:'center', gap:20 },
  confetti: { position:'absolute', alignItems:'center', justifyContent:'center' },
  title: { color:'#fff', fontSize:26, fontWeight:'900', letterSpacing:-0.5, textAlign:'center' },
  sub: { color:'rgba(255,255,255,0.5)', fontSize:15, textAlign:'center', marginTop:-8 },
});

// ─── Details-Sheet (Caption, Tags, Privacy) ──────────────────────────────────
const TAG_OPTIONS = ['#vibes','#music','#chill','#art','#life','#travel','#food','#fitness','#coding','#fashion'];
function DetailsSheet({
  visible, onClose, caption, onCaption, selectedTags, onToggleTag,
  settings, onSettings, onPost, uploading,
}: {
  visible: boolean; onClose: () => void;
  caption: string; onCaption: (s: string) => void;
  selectedTags: string[]; onToggleTag: (t: string) => void;
  settings: PostSettingsState; onSettings: (s: PostSettingsState) => void;
  onPost: () => void; uploading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const privacyOptions = [
    { id: 'public',  label: 'Öffentlich',  icon: Globe },
    { id: 'friends', label: 'Freunde',      icon: Users },
    { id: 'private', label: 'Privat',       icon: Lock  },
  ] as const;

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ds.overlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ds.sheetWrap}>
        <View style={[ds.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={ds.handle} />
          <Text style={ds.heading}>Details</Text>

          {/* Caption */}
          <TextInput
            style={ds.captionInput}
            placeholder="Was ist dein Vibe? #tags @mention"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={caption}
            onChangeText={onCaption}
            multiline
            maxLength={500}
          />

          {/* Tags */}
          <Text style={ds.sectionLabel}>Tags</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.tagScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {TAG_OPTIONS.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => onToggleTag(tag)}
                style={[ds.tag, selectedTags.includes(tag) && ds.tagActive]}
              >
                <Text style={[ds.tagText, selectedTags.includes(tag) && ds.tagTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Privacy */}
          <Text style={ds.sectionLabel}>Sichtbarkeit</Text>
          <View style={ds.privacyRow}>
            {privacyOptions.map(({ id, label, icon: Icon }) => (
              <Pressable
                key={id}
                onPress={() => onSettings({ ...settings, privacy: id })}
                style={[ds.privacyBtn, settings.privacy === id && ds.privacyBtnActive]}
              >
                <Icon size={14} color={settings.privacy === id ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth={2} />
                <Text style={[ds.privacyText, settings.privacy === id && ds.privacyTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Toggles */}
          <View style={ds.toggleRow}>
            {([
              { key: 'allowComments', icon: MessageCircle, label: 'Kommentare' },
              { key: 'allowDownload', icon: Download,       label: 'Download'    },
              { key: 'allowDuet',    icon: Repeat2,        label: 'Duet'        },
            ] as const).map(({ key, icon: Icon, label }) => (
              <Pressable
                key={key}
                onPress={() => onSettings({ ...settings, [key]: !settings[key as keyof PostSettingsState] })}
                style={[ds.toggle, (settings[key as keyof PostSettingsState] as boolean) && ds.toggleActive]}
              >
                <Icon size={13} color={(settings[key as keyof PostSettingsState] as boolean) ? '#fff' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
                <Text style={[ds.toggleText, (settings[key as keyof PostSettingsState] as boolean) && ds.toggleTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Post-Button */}
          <Pressable
            onPress={() => { onClose(); onPost(); }}
            disabled={uploading}
            style={({ pressed }) => [ds.postBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={ds.postBtnText}>{uploading ? 'Wird hochgeladen…' : 'Jetzt posten'}</Text>
            <ArrowRight size={18} color="#000" strokeWidth={2.5} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const ds = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0e0e18', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  heading: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  captionInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, marginHorizontal: 16, padding: 14, color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 20, marginBottom: 10 },
  tagScroll: { marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tagActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  tagText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tagTextActive: { color: '#fff' },
  privacyRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
  privacyBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' },
  privacyText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600' },
  privacyTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  toggleText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 16, paddingVertical: 16, borderRadius: 16 },
  postBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});

// ─── Haupt-Screen ────────────────────────────────────────────────────────────
export default function CreatePostScreen() {
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { saveDraft } = useDrafts();
  const { data: guildInfo } = useGuildInfo(profile?.guild_id ?? null);

  const { mediaUri, mediaType: mediaTypeParam, caption: captionParam,
          audioUrl, audioTitle, audioVolume: audioVolumeParam } =
    useLocalSearchParams<{
      mediaUri?: string; mediaType?: string; caption?: string;
      audioUrl?: string; audioTitle?: string; audioVolume?: string;
    }>();

  // Media
  const initialAsset: ImagePickerAsset | null = mediaUri
    ? { uri: mediaUri, type: (mediaTypeParam as 'image' | 'video') ?? 'image',
        width:0, height:0, assetId:null, base64:null, duration:null, exif:null,
        fileName:null, fileSize:undefined, mimeType: mediaTypeParam==='video' ? 'video/mp4' : 'image/jpeg' }
    : null;
  const [image, setImage] = useState<ImagePickerAsset | null>(initialAsset);

  // Caption & Tags (bearbeitet im DetailsSheet)
  const [caption, setCaption]           = useState(captionParam ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [postSettings, setPostSettings] = useState<PostSettingsState>({
    privacy: 'public', allowComments: true, allowDownload: true, allowDuet: true,
  });

  // Upload
  const [uploading, setUploading]   = useState(false);
  const [uploadPct, setUploadPct]   = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Musik
  const initialAudioUrl    = audioUrl && audioUrl.startsWith('http') ? audioUrl : null;
  const initialAudioVolume = audioVolumeParam ? Math.max(0, Math.min(1, parseFloat(audioVolumeParam))) : 0.8;
  const [currentAudioTrack, setCurrentAudioTrack] = useState<MusicTrack | null>(
    () => MUSIC_LIBRARY.find((t) => t.url === initialAudioUrl) ?? null
  );
  const [currentAudioVolume, setCurrentAudioVolume] = useState(initialAudioVolume);

  // UI-State
  const [showMusicPicker, setShowMusicPicker]   = useState(false);
  const [showDetails, setShowDetails]           = useState(false);
  const [showTextEditor, setShowTextEditor]     = useState(false);
  const [showTrimSheet, setShowTrimSheet]       = useState(false);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet]   = useState(false);
  const [showAdjustSheet, setShowAdjustSheet]   = useState(false);
  const [showRotateSheet, setShowRotateSheet]   = useState(false);
  const [textOverlays, setTextOverlays]         = useState<TextOverlay[]>([]);
  const [stickerOverlays, setStickerOverlays]   = useState<StickerOverlay[]>([]);
  const [activeFilter, setActiveFilter]         = useState<ColorFilterId | null>(null);
  const [adjustValues, setAdjustValues]         = useState<AdjustValues>({ brightness: 0, contrast: 0, saturation: 0 });
  const [rotateState, setRotateState]           = useState<RotateState>({ rotation: 0, flipH: false });
  const [trimResult, setTrimResult]             = useState<TrimResult | null>(null);
  const [isDrawMode, setIsDrawMode]             = useState(false);
  const [drawnPaths, setDrawnPaths]             = useState<DrawnPath[]>([]);
  const [drawColor, setDrawColor]               = useState('#fff');
  const [drawWidth, setDrawWidth]               = useState(6);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isTrashHovered, setIsTrashHovered]       = useState(false);
  const isTrashHoveredRef = useRef(false);

  // Video-Player für Inline-Vorschau
  const videoPlayer = useVideoPlayer(mediaTypeParam === 'video' ? (mediaUri ?? '') : '', (p) => {
    p.loop = true; p.play();
  });

  const addTextOverlay = (overlay: Omit<TextOverlay,'id'|'x'|'y'>) => {
    setTextOverlays(prev => [...prev, {
      ...overlay, id: `text-${Date.now()}`, x: 0.15, y: 0.35,
    }]);
    setShowTextEditor(false);
  };
  const removeTextOverlay = (id: string) => setTextOverlays(prev => prev.filter(o => o.id !== id));

  const addSticker = (url: string) => setStickerOverlays(prev => [...prev, { id: `sticker-${Date.now()}`, url, x: 0.3, y: 0.3 }]);
  const removeSticker = (id: string) => setStickerOverlays(prev => prev.filter(o => o.id !== id));

  // Trash zone callbacks
  const handleDragStart = () => {
    setIsDraggingOverlay(true);
    setIsTrashHovered(false);
    isTrashHoveredRef.current = false;
  };

  const handleOverlayMove = (x: number, y: number) => {
    const over = isInTrash(x, y);
    if (over !== isTrashHoveredRef.current) {
      isTrashHoveredRef.current = over;
      setIsTrashHovered(over);
      if (over) Haptics.selectionAsync(); // haptic beim Eintritt
    }
  };

  const handleDragEnd = (x: number, y: number, id: string) => {
    setIsDraggingOverlay(false);
    setIsTrashHovered(false);
    isTrashHoveredRef.current = false;
    if (x >= 0 && isInTrash(x, y)) {
      removeTextOverlay(id);
      removeSticker(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); // Lösch-Haptic
    }
  };

  // Media picker aus Galerie
  const pickFromLibrary = async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Berechtigung', 'Bitte erlaube den Medienzugriff.'); return; }
    const result = await launchImageLibraryAsync({ mediaTypes:['images','videos'], quality:0.92, videoMaxDuration:60 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  };

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev,tag].slice(0,4));

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setUploading(false); setUploadPct(0);
  }, []);

  const handlePost = async () => {
    if (!profile) return;
    if (!image && !caption.trim()) { Alert.alert('Fehler', 'Füge ein Bild oder eine Caption hinzu.'); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true); setUploadPct(0);
    try {
      let mediaUrl: string | null = null, thumbnailUrl: string | null = null;
      const isVideo = image?.type === 'video';
      if (image) {
        const { url } = await uploadPostMedia(profile.id, image.uri, image.mimeType, (pct)=>setUploadPct(pct), controller.signal);
        mediaUrl = url;
        if (isVideo) thumbnailUrl = await generateAndUploadThumbnail(profile.id, image.uri, controller.signal);
      }
      if (controller.signal.aborted) return;
      const { error } = await supabase.from('posts').insert({
        author_id:      profile.id,
        caption:        caption.trim() || null,
        media_url:      mediaUrl,
        media_type:     isVideo ? 'video' : 'image',
        thumbnail_url:  thumbnailUrl,
        tags:           selectedTags.map(t=>t.toLowerCase()),
        is_guild_post:  false,
        guild_id:       profile.guild_id,
        audio_url:      currentAudioTrack?.url ?? null,
        audio_volume:   currentAudioTrack ? currentAudioVolume : null,
        privacy:        postSettings.privacy,
        allow_comments: postSettings.allowComments,
        allow_download: postSettings.allowDownload,
        allow_duet:     postSettings.allowDuet,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['guild-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['user-posts', profile.id] });
      setShowSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false); setUploadPct(0);
    }
  };

  const isVideo = image?.type === 'video';

  return (
    <View style={s.root}>
      {/* ── Fortschrittsbalken (Upload) ─────────────────────── */}
      <CreateProgressBar visible={uploading} progress={uploadPct} onCancel={handleCancel} />

      {/* ── Vollbild-Vorschau (mit Transform: Rotate + Flip) ── */}
      <View style={[s.preview, {
        transform: [
          { rotate: `${rotateState.rotation}deg` },
          { scaleX: rotateState.flipH ? -1 : 1 },
        ],
      }]}>
        {image ? (
          isVideo ? (
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            /* Foto: echte GPU-Filter via Skia ColorMatrix */
            <SkiaFilteredImage uri={image.uri} filterId={activeFilter} />
          )
        ) : (
          /* Leerer State — Medien auswählen */
          <Pressable style={s.emptyState} onPress={pickFromLibrary}>
            <Text style={s.emptyIcon}>📷</Text>
            <Text style={s.emptyText}>Tippe um ein Foto oder Video auszuwählen</Text>
          </Pressable>
        )}

        {/*
          ⚠️ OVERLAY LAYER — separate View über VideoView
          VideoView auf iOS ist ein nativer UIView und liegt UNTER React Native Views.
        */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Filter wird für Fotos via Skia Canvas direkt gerendert (siehe SkiaFilteredImage oben).
              Für Videos: kein Skia-Filter (VideoView ist nativer Layer) */}

          {/* Brightness Overlay */}
          {adjustValues.brightness !== 0 && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                backgroundColor: adjustValues.brightness > 0
                  ? `rgba(255,255,255,${(adjustValues.brightness / 50) * 0.25})`
                  : `rgba(0,0,0,${(Math.abs(adjustValues.brightness) / 50) * 0.35})`,
              }]}
            />
          )}

          {/* Vignette */}
          <View style={s.vignetteTop} pointerEvents="none" />
          <View style={s.vignetteBottom} pointerEvents="none" />

          {/* Text Overlays */}
          {textOverlays.map((ov) => (
            <TextOverlayItem
              key={ov.id}
              overlay={ov}
              onRemove={removeTextOverlay}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onMove={handleOverlayMove}
            />
          ))}

          {/* Sticker Overlays */}
          {stickerOverlays.map((ov) => (
            <StickerOverlayItem
              key={ov.id}
              overlay={ov}
              onRemove={removeSticker}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onMove={handleOverlayMove}
            />
          ))}

          {/* Draw Canvas — Skia freehand (aktiv wenn Draw-Mode an) */}
          {isDrawMode ? (
            <DrawCanvas
              paths={drawnPaths}
              activeColor={drawColor}
              activeWidth={drawWidth}
              onAddPath={(p: DrawnPath) => setDrawnPaths((prev: DrawnPath[]) => [...prev, p])}
            />
          ) : (
            drawnPaths.length > 0 && Svg && SvgPath && (
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {drawnPaths.map((dp: DrawnPath, i: number) => (
                  <SvgPath key={i} d={pointsToSvgPath(dp.points)} stroke={dp.color}
                    strokeWidth={dp.width} strokeLinejoin="round" strokeLinecap="round" fill="none" />
                ))}
              </Svg>
            )
          )}
        </View>

      </View>

      {/* Trash Zone — außerhalb des Preview-Containers */}
      <TrashZone visible={isDraggingOverlay} isOver={isTrashHovered} />

      {/* Draw Toolbar — erscheint wenn Draw-Mode aktiv */}
      {isDrawMode && (
        <DrawToolbar
          activeColor={drawColor}
          onColor={setDrawColor}
          activeWidth={drawWidth}
          onWidth={setDrawWidth}
          onUndo={() => setDrawnPaths((prev: DrawnPath[]) => prev.slice(0, -1))}
          onClose={() => setIsDrawMode(false)}
          bottomOffset={insets.bottom + 96}
        />
      )}

      {/* Text Overlay Editor */}
      <TextOverlayEditor
        visible={showTextEditor}
        onDone={addTextOverlay}
        onCancel={() => setShowTextEditor(false)}
      />
      {/* ── Top-Bar ──────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Zurück */}
        <Pressable
          onPress={() => {
            if ((caption.trim() || image) && !uploading) {
              Alert.alert('Entwurf speichern?', '', [
                { text: 'Verwerfen', style: 'destructive', onPress: () => router.back() },
                { text: 'Speichern', onPress: async () => {
                  await saveDraft({ caption, tags: selectedTags, mediaUri: image?.uri ?? null, mediaType: image?.type === 'video' ? 'video' : image ? 'image' : null });
                  router.back();
                }},
              ]);
            } else { router.back(); }
          }}
          style={s.topBtn}
          hitSlop={10}
        >
          <X size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>

        {/* Musik-Badge */}
        <Pressable onPress={() => setShowMusicPicker(true)} style={s.musicBadge}>
          <Music2 size={13} color="#fff" strokeWidth={2.5} />
          <Text style={s.musicBadgeText} numberOfLines={1}>
            {currentAudioTrack ? currentAudioTrack.title : 'Sound hinzufügen'}
          </Text>
          {currentAudioTrack && (
            <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); setCurrentAudioTrack(null); }}>
              <X size={11} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </Pressable>
          )}
        </Pressable>

        {/* Einstellungsrad — oben rechts → öffnet Details-Sheet */}
        <Pressable onPress={() => setShowDetails(true)} style={s.topBtn} hitSlop={10}>
          <Settings2 size={20} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Rechte Tool-Sidebar (sauber, kein Hintergrund) ── */}
      <View style={[s.sidebar, { top: insets.top + 70 }]}>

        <Pressable onPress={() => setShowMusicPicker(true)} style={s.sideBtn}>
          <Music2 size={26} color="#fff" strokeWidth={1.8} />
          {currentAudioTrack && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Sound</Text>
        </Pressable>

        <Pressable style={s.sideBtn} onPress={() => setShowTextEditor(true)}>
          <Type size={26} color="#fff" strokeWidth={1.8} />
          {textOverlays.length > 0 && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Text</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, stickerOverlays.length > 0 && s.sideBtnActive]} onPress={() => setShowStickerSheet(true)}>
          <Smile size={26} color="#fff" strokeWidth={1.8} />
          {stickerOverlays.length > 0 && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Sticker</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, !!activeFilter && s.sideBtnActive]} onPress={() => setShowFilterSheet(true)}>
          <Sliders size={26} color="#fff" strokeWidth={1.8} />
          {!!activeFilter && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Filter</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, isDrawMode && s.sideBtnActive]} onPress={() => setIsDrawMode(d => !d)}>
          <Pencil size={26} color="#fff" strokeWidth={1.8} />
          {drawnPaths.length > 0 && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Zeichnen</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, (adjustValues.brightness !== 0 || adjustValues.contrast !== 0 || adjustValues.saturation !== 0) && s.sideBtnActive]} onPress={() => setShowAdjustSheet(true)}>
          <FlipHorizontal size={26} color="#fff" strokeWidth={1.8} />
          {(adjustValues.brightness !== 0 || adjustValues.contrast !== 0) && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Anpassen</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, (rotateState.rotation !== 0 || rotateState.flipH) && s.sideBtnActive]} onPress={() => setShowRotateSheet(true)}>
          <CheckCircle size={26} color="#fff" strokeWidth={1.8} />
          {(rotateState.rotation !== 0 || rotateState.flipH) && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>Drehen</Text>
        </Pressable>

        {/* Schneiden — nur für Videos */}
        {isVideo && (
          <Pressable style={[s.sideBtn, trimResult && s.sideBtnActive]} onPress={() => setShowTrimSheet(true)}>
            <Scissors size={26} color="#fff" strokeWidth={1.8} />
            {trimResult && <View style={s.sideBtnDot} />}
            <Text style={s.sideLabel}>Kürzen</Text>
          </Pressable>
        )}

      </View>

      {/* ── Bottom-Buttons ───────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Vorschau-Thumbnail der ausgewählten Medien */}
        {image && (
          <Pressable onPress={pickFromLibrary} style={s.thumbBtn}>
            <Image source={{ uri: image.uri }} style={s.thumb} contentFit="cover" />
          </Pressable>
        )}

        <View style={s.bottomActions}>
          {/* Story-Button */}
          <Pressable style={s.storyBtn} onPress={handlePost} disabled={uploading}>
            <Text style={s.storyBtnText}>Story</Text>
          </Pressable>

          {/* Weiter → Details-Sheet */}
          <Pressable
            style={s.nextBtn}
            onPress={() => setShowDetails(true)}
            disabled={uploading}
          >
            <Text style={s.nextBtnText}>Weiter</Text>
            <ChevronRight size={18} color="#000" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* ── MusicPickerSheet ────────────────────────────────── */}
      <MusicPickerSheet
        visible={showMusicPicker}
        selectedTrack={currentAudioTrack}
        audioVolume={currentAudioVolume}
        onSelect={(track, vol) => { setCurrentAudioTrack(track); setCurrentAudioVolume(vol); }}
        onClose={() => setShowMusicPicker(false)}
      />

      {/* ── StickerSheet ─────────────────────────────────────── */}
      <StickerSheet visible={showStickerSheet} onAdd={addSticker} onClose={() => setShowStickerSheet(false)} />

      {/* ── FilterSheet ──────────────────────────────────────── */}
      <FilterSheet
        visible={showFilterSheet}
        mediaUri={image?.uri ?? ''}
        currentId={activeFilter}
        onSelect={setActiveFilter}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* ── AdjustSheet ──────────────────────────────────────── */}
      <AdjustSheet
        visible={showAdjustSheet}
        values={adjustValues}
        onChange={setAdjustValues}
        onClose={() => setShowAdjustSheet(false)}
      />

      {/* ── RotateSheet ──────────────────────────────────────── */}
      <RotateSheet
        visible={showRotateSheet}
        state={rotateState}
        onChange={setRotateState}
        onClose={() => setShowRotateSheet(false)}
      />

      {/* ── VideoTrimSheet ───────────────────────────────────── */}
      {isVideo && image && (
        <VideoTrimSheet
          visible={showTrimSheet}
          uri={image.uri}
          onDone={(r) => { setTrimResult(r); setShowTrimSheet(false); }}
          onCancel={() => setShowTrimSheet(false)}
        />
      )}

      {/* ── Details-Sheet (Caption / Tags / Privacy / Post) ── */}
      <DetailsSheet
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        caption={caption}
        onCaption={setCaption}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        settings={postSettings}
        onSettings={setPostSettings}
        onPost={handlePost}
        uploading={uploading}
      />

      {/* ── Erfolgs-Overlay ─────────────────────────────────── */}
      <PostSuccessOverlay
        visible={showSuccess}
        onDone={() => { setShowSuccess(false); router.back(); }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Vollbild-Preview
  preview: { ...StyleSheet.absoluteFillObject },
  vignetteTop: { position:'absolute', top:0, left:0, right:0, height:160, backgroundColor:'transparent' },
  vignetteBottom: { position:'absolute', bottom:0, left:0, right:0, height:220, backgroundColor:'transparent' },

  // Leerer State
  emptyState: { flex:1, alignItems:'center', justifyContent:'center', gap:16, backgroundColor:'#080810' },
  emptyIcon: { fontSize: 52 },
  emptyText: { color:'rgba(255,255,255,0.25)', fontSize:15, textAlign:'center', maxWidth:200, lineHeight:22 },

  // ── Top-Bar ──────────────────────────────────────────────
  topBar: {
    position:'absolute', top:0, left:0, right:0,
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:14, paddingBottom:14,
  },
  topBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(0,0,0,0.35)',
    alignItems:'center', justifyContent:'center',
  },
  musicBadge: {
    flexDirection:'row', alignItems:'center', gap:7,
    backgroundColor:'rgba(0,0,0,0.42)',
    borderRadius:22, paddingHorizontal:13, paddingVertical:9,
    maxWidth: SW * 0.52,
    // Subtle white glow
    shadowColor:'#fff', shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:0},
  },
  musicBadgeText: { color:'#fff', fontSize:13, fontWeight:'700', flex:1 },

  // ── Rechte Sidebar — kein Hintergrund, kein Rahmen ─────
  sidebar: {
    position:'absolute', right:10,
    flexDirection:'column', alignItems:'center', gap:22,
  },
  // Jeder Button: nur Icon + Label, transparent
  sideBtn: {
    alignItems:'center', justifyContent:'center', width:50, paddingVertical:2,
  },
  sideBtnActive: {
    opacity: 1, // dot zeigt Aktivzustand an
  },
  sideBtnIcon: { fontSize: 24 },
  sideLabel: {
    color:'rgba(255,255,255,0.75)',
    fontSize:10, fontWeight:'700',
    marginTop:4, textAlign:'center',
    textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4,
  },
  sideBtnDot: {
    position:'absolute', top:0, right:4,
    width:9, height:9, borderRadius:5,
    backgroundColor:'#fff',
    borderWidth:1.5, borderColor:'rgba(0,0,0,0.5)',
  },

  // ── Bottom-Bar ───────────────────────────────────────────
  bottomBar: {
    position:'absolute', bottom:0, left:0, right:0,
    paddingHorizontal:14, paddingTop:16,
    flexDirection:'row', alignItems:'flex-end', gap:10,
  },
  thumbBtn: {
    width:56, height:56, borderRadius:12,
    overflow:'hidden',
    borderWidth:2, borderColor:'rgba(255,255,255,0.3)',
    shadowColor:'#000', shadowOpacity:0.4, shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  thumb: { width:56, height:56 },
  bottomActions: { flex:1, flexDirection:'row', gap:8 },

  storyBtn: {
    flex:1, paddingVertical:17, borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.1)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.22)',
    alignItems:'center', justifyContent:'center',
  },
  storyBtnText: { color:'#fff', fontSize:15, fontWeight:'700', letterSpacing:0.2 },

  nextBtn: {
    flex:1.7, paddingVertical:17, borderRadius:16,
    backgroundColor:'#fff',
    alignItems:'center', justifyContent:'center',
    flexDirection:'row', gap:6,
    shadowColor:'#fff', shadowOpacity:0.2, shadowRadius:12, shadowOffset:{width:0,height:0},
  },
  nextBtnText: { color:'#000', fontSize:15, fontWeight:'900', letterSpacing:0.2 },
});

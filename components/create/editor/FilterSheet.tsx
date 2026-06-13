import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import type { ColorFilterId } from '@/lib/cameraFilters';
import { COLOR_FILTERS, FILTER_CATALOG } from '@/lib/cameraFilters';
import { SkiaCanvas, SkiaColorMatrix, SkiaImage, SKIA_READY, useSkiaImage } from '@/lib/skiaLoader';
import { shared, SH, SW } from './sharedStyles';

// ─── Filter-Overlay System (View-basiert, für Expo Go) ──────────────────────
export function extractFilterStyle(filterId: ColorFilterId | null): {
  tint: string; tintOpacity: number;
  brightness: 'lighten' | 'darken' | null; biasOpacity: number;
  desaturate: boolean; desatOpacity: number;
} {
  if (!filterId || filterId === 'none') return { tint: 'transparent', tintOpacity: 0, brightness: null, biasOpacity: 0, desaturate: false, desatOpacity: 0 };
  const m = COLOR_FILTERS[filterId];
  const rr = m[0], rg = m[1], rb = m[2];
  const gg = m[6], gb = m[7];
  const br = m[10], bg = m[11], bb = m[12];
  const rBias = m[4], gBias = m[9], bBias = m[14];

  const diagAvg = (rr + gg + bb) / 3;
  const brightness: 'lighten' | 'darken' | null = diagAvg > 1.1 ? 'lighten' : diagAvg < 0.7 ? 'darken' : null;
  const biasOpacity = Math.min(0.35, Math.abs(diagAvg - 1) * 0.5);

  const r = Math.round(Math.max(0, Math.min(255, rBias)));
  const g = Math.round(Math.max(0, Math.min(255, gBias)));
  const b = Math.round(Math.max(0, Math.min(255, bBias)));
  const biasSum = Math.abs(rBias) + Math.abs(gBias) + Math.abs(bBias);
  const tintOpacity = Math.min(0.3, biasSum / 255 * 1.5);
  const tint = tintOpacity > 0.02 ? `rgb(${r},${g},${b})` : 'transparent';

  const crossStrength = Math.abs(rg) + Math.abs(rb) + Math.abs(br) + Math.abs(bg) + Math.abs(gb);
  const lumaish = 0.3 * rr + 0.59 * gg + 0.11 * bb;
  const desaturate = lumaish > 0.7 && crossStrength > 0.4;
  const desatOpacity = desaturate ? Math.min(0.9, lumaish) : 0;

  return { tint, tintOpacity, brightness, biasOpacity, desaturate, desatOpacity };
}

export function FilterOverlays({ filterId }: { filterId: ColorFilterId | null }) {
  if (!filterId || filterId === 'none') return null;
  const { tint, tintOpacity, brightness, biasOpacity, desaturate, desatOpacity } = extractFilterStyle(filterId);
  return (
    <>
      {tintOpacity > 0.01 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: tintOpacity }]} />
      )}
      {brightness === 'lighten' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,1)', opacity: biasOpacity }]} />
      )}
      {brightness === 'darken' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,1)', opacity: biasOpacity }]} />
      )}
      {desaturate && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(128,128,128,1)', opacity: desatOpacity * 0.4 }]} />
      )}
    </>
  );
}

export function SkiaFilteredImage({ uri, filterId }: {
  uri: string; filterId: ColorFilterId | null;
}) {
  const image = useSkiaImage(uri);
  const matrix = filterId ? COLOR_FILTERS[filterId] : COLOR_FILTERS.none;
  if (SKIA_READY && image && SkiaCanvas && SkiaImage && SkiaColorMatrix) {
    const skia20 = matrix.map((v, i) => ((i + 1) % 5 === 0 ? v / 255 : v));
    return (
      <SkiaCanvas style={StyleSheet.absoluteFill}>
        <SkiaImage image={image} x={0} y={0} width={SW} height={SH} fit="cover">
          <SkiaColorMatrix matrix={skia20} />
        </SkiaImage>
      </SkiaCanvas>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <FilterOverlays filterId={filterId} />
    </View>
  );
}

export function FilterThumb({ uri, filterId, size, active }: {
  uri: string; filterId: ColorFilterId;
  size: number; active: boolean;
}) {
  const image = useSkiaImage(uri);
  const isActive = active;
  const thStyle = { width: size, height: size * 1.35, borderRadius: 10, overflow: 'hidden' as const,
    borderWidth: isActive ? 2.5 : 0, borderColor: '#fff' };

  if (SKIA_READY && image && SkiaCanvas && SkiaImage && SkiaColorMatrix) {
    const matrix = COLOR_FILTERS[filterId];
    const skia20 = matrix.map((v, i) => ((i + 1) % 5 === 0 ? v / 255 : v));
    return (
      <View style={thStyle}>
        <SkiaCanvas style={{ width: size, height: size * 1.35 }}>
          <SkiaImage image={image} x={0} y={0} width={size} height={size * 1.35} fit="cover">
            <SkiaColorMatrix matrix={skia20} />
          </SkiaImage>
        </SkiaCanvas>
      </View>
    );
  }
  return (
    <View style={thStyle}>
      <Image source={{ uri }} style={{ width: size, height: size * 1.35 }} contentFit="cover" />
      <FilterOverlays filterId={filterId} />
    </View>
  );
}

const COLOR_FILTER_LIST = FILTER_CATALOG.filter(f => f.category === 'color');

export function FilterSheet({ visible, mediaUri, currentId, onSelect, onClose }: {
  visible: boolean; mediaUri: string;
  currentId: ColorFilterId | null;
  onSelect: (id: ColorFilterId | null) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={shared.overlay} /></TouchableWithoutFeedback>
      <View style={fs.sheet}>
        <View style={shared.handle} />
        <Text style={shared.title}>Filter</Text>
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
        <Pressable style={shared.doneBtn} onPress={onClose}><Text style={shared.doneBtnText}>Fertig ✓</Text></Pressable>
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
});

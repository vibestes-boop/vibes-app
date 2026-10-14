import { useTheme } from '@/lib/useTheme';
import { Image } from 'expo-image';
import { useId } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from 'react-native-svg';
import type { ColorFilterId } from '@/lib/cameraFilters';
import { useI18n } from '@/lib/i18n';
import { FILTER_CATALOG } from '@/lib/cameraFilters';
import { hasImageAdjustments, NEUTRAL_ADJUSTMENTS, normalizedImageMatrix, type ImageAdjustments } from '@/lib/imageAdjustments';
import { SkiaCanvas, SkiaColorMatrix, SkiaImage, SKIA_READY, useSkiaImage } from '@/lib/skiaLoader';
import { GlassSheet, useEditorSheet, SH, SW } from './sharedStyles';

function MatrixImage({ uri, filterId, adjustments = NEUTRAL_ADJUSTMENTS, width = SW, height = SH, cover = false }: {
  uri: string; filterId: ColorFilterId | null; adjustments?: ImageAdjustments; width?: number; height?: number; cover?: boolean;
}) {
  const image = useSkiaImage(uri);
  const id = 'photo-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const matrix = normalizedImageMatrix(filterId, adjustments);
  const edited = (filterId && filterId !== 'none') || hasImageAdjustments(adjustments);
  if (!edited) return <Image source={{ uri }} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit={cover ? 'cover' : 'contain'} />;
  if (SKIA_READY && image && SkiaCanvas && SkiaImage && SkiaColorMatrix) return <SkiaCanvas style={StyleSheet.absoluteFill}>
    <SkiaImage image={image} x={0} y={0} width={width} height={height} fit={cover ? 'cover' : 'contain'}><SkiaColorMatrix matrix={matrix} /></SkiaImage>
  </SkiaCanvas>;
  return <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
    <Defs><Filter id={id} x="0%" y="0%" width="100%" height="100%"><FeColorMatrix type="matrix" values={matrix} /></Filter></Defs>
    <SvgImage href={{ uri }} x={0} y={0} width={width} height={height} preserveAspectRatio={cover ? 'xMidYMid slice' : 'xMidYMid meet'} filter={`url(#${id})`} />
  </Svg>;
}

export function SkiaFilteredImage(props: { uri: string; filterId: ColorFilterId | null; adjustments?: ImageAdjustments }) {
  return <MatrixImage {...props} />;
}
export function FilterThumb({ uri, filterId, size, active }: { uri: string; filterId: ColorFilterId; size: number; active: boolean }) {
  const { colors } = useTheme();
  return <View style={{ width: size, height: size * 1.35, borderRadius: 10, overflow: 'hidden', borderWidth: active ? 2.5 : 0, borderColor: colors.accent.primary }}>
    <MatrixImage uri={uri} filterId={filterId} width={size} height={size * 1.35} cover />
  </View>;
}

const COLOR_FILTER_LIST = FILTER_CATALOG.filter(f => f.category === 'color');

export function FilterSheet({ visible, mediaUri, currentId, onSelect, onClose }: {
  visible: boolean; mediaUri: string;
  currentId: ColorFilterId | null;
  onSelect: (id: ColorFilterId | null) => void;
  onClose: () => void;
}) {
  const t = useEditorSheet();
  const { t: tr } = useI18n();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={t.overlay} /></TouchableWithoutFeedback>
      <GlassSheet style={fs.sheet}>
        <View style={t.handle} />
        <Text style={t.title}>{tr('create.filter')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.row}>
          {COLOR_FILTER_LIST.map(preset => {
            const id = preset.id as ColorFilterId;
            const isActive = (currentId ?? 'none') === id;
            return (
              <Pressable key={id} onPress={() => onSelect(id === 'none' ? null : id)} style={fs.item}>
                <FilterThumb uri={mediaUri} filterId={id} size={80} active={isActive} />
                <Text style={[fs.label, { color: isActive ? t.text : t.textMuted }]}>{preset.emoji} {preset.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={t.doneBtn} onPress={onClose}><Text style={t.doneBtnText}>{tr('create.doneCheck')}</Text></Pressable>
      </GlassSheet>
    </Modal>
  );
}

const fs = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40 },
  row: { paddingHorizontal: 16, gap: 14, paddingBottom: 16 },
  item: { alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});

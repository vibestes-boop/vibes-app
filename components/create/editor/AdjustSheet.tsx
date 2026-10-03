import { useI18n } from '@/lib/i18n';
import { hasImageAdjustments, NEUTRAL_ADJUSTMENTS, type ImageAdjustments } from '@/lib/imageAdjustments';
import { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSheet, useEditorSheet } from './sharedStyles';

export type AdjustValues = ImageAdjustments;

export function AdjustSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useEditorSheet();
  const [width, setWidth] = useState(0);
  const latest = useRef({ value, width, onChange });
  latest.current = { value, width, onChange };
  const start = useRef(0);
  const setFromX = (x: number) => {
    const { width: w, onChange: change } = latest.current;
    if (w > 0) change(Math.round(Math.max(0, Math.min(1, x / w)) * 100 - 50));
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      start.current = event.nativeEvent.locationX;
      setFromX(start.current);
    },
    onPanResponderMove: (_, gesture) => setFromX(start.current + gesture.dx),
  })).current;
  const percent = (value + 50) / 100;
  return <View style={s.row}>
    <View style={s.labelRow}><Text style={[s.label, { color: t.text }]}>{label}</Text><Text style={[s.value, { color: t.textSecondary }]}>{value > 0 ? `+${value}` : value}</Text></View>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: -50, max: 50, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment' || nativeEvent.actionName === 'decrement') onChange(Math.max(-50, Math.min(50, value + (nativeEvent.actionName === 'increment' ? 5 : -5))));
      }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)} style={s.track} {...responder.panHandlers}>
      <View pointerEvents="none" style={[s.line, { backgroundColor: t.fillActive }]} />
      <View pointerEvents="none" style={[s.fill, { left: Math.min(0.5, percent) * width, width: Math.abs(percent - 0.5) * width, backgroundColor: t.accent }]} />
      <View pointerEvents="none" style={[s.center, { backgroundColor: t.textMuted }]} />
      <View pointerEvents="none" style={[s.thumb, { left: Math.max(0, Math.min(width - 24, percent * width - 12)), backgroundColor: t.accent }]} />
    </View>
  </View>;
}

export function AdjustSheet({ visible, values, onChange, onClose }: {
  visible: boolean; values: AdjustValues; onChange: (v: AdjustValues) => void; onClose: () => void;
}) {
  const t = useEditorSheet(); const { t: tr } = useI18n(); const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}><View style={t.overlay} /></TouchableWithoutFeedback>
    <GlassSheet style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <View style={t.handle} /><View style={s.heading}><Text style={[t.title, { marginBottom: 0, paddingHorizontal: 0 }]}>{tr('create.adjust')}</Text><Pressable accessibilityRole="button" disabled={!hasImageAdjustments(values)} accessibilityState={{ disabled: !hasImageAdjustments(values) }} onPress={() => onChange({ ...NEUTRAL_ADJUSTMENTS })} style={s.reset}><Text style={{ color: hasImageAdjustments(values) ? t.accent : t.textMuted, fontSize: 13, fontWeight: '600' }}>{tr('create.reset')}</Text></Pressable></View>
      {(['brightness', 'contrast', 'saturation'] as const).map(key => <AdjustSlider key={key} label={tr(`create.${key}`)} value={values[key]} onChange={value => onChange({ ...values, [key]: value })} />)}
      <Pressable accessibilityRole="button" style={t.doneBtn} onPress={onClose}><Text style={t.doneBtnText}>{tr('create.done')}</Text></Pressable>
    </GlassSheet>
  </Modal>;
}
const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 4 },
  reset: { minHeight: 44, justifyContent: 'center' },
  row: { paddingHorizontal: 28, paddingBottom: 4 }, labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' }, value: { fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 44, justifyContent: 'center' }, line: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 3 },
  fill: { position: 'absolute', height: 4 }, center: { position: 'absolute', left: '50%', width: 1, height: 12 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
});

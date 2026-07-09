import { useI18n } from '@/lib/i18n';
import React, { useRef } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Animated as RNAnimated } from 'react-native';

import { GlassSheet, useEditorSheet, SW } from './sharedStyles';

export type AdjustValues = { brightness: number; contrast: number; saturation: number };

function AdjustSlider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const t = useEditorSheet();
  const { t: tr } = useI18n();
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
      <Text style={[aj.sliderLabel, { color: t.textSecondary }]}>{label}</Text>
      <View style={aj.track} {...panResponder.panHandlers}>
        <View style={[aj.fill, { width: thumbX, backgroundColor: t.accent }]} />
        <View style={[aj.thumb, { left: thumbX - 12, backgroundColor: t.accent }]} />
      </View>
      <Text style={[aj.sliderVal, { color: t.textSecondary }]}>{value > 0 ? `+${value}` : value}</Text>
    </View>
  );
}

export function AdjustSheet({ visible, values, onChange, onClose }: {
  visible: boolean; values: AdjustValues; onChange: (v: AdjustValues) => void; onClose: () => void;
}) {
  const t = useEditorSheet();
  const { t: tr } = useI18n();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={t.overlay} /></TouchableWithoutFeedback>
      <GlassSheet style={aj.sheet}>
        <View style={t.handle} />
        <Text style={t.title}>{tr('create.adjust')}</Text>
        <AdjustSlider label={tr('create.brightness')} value={values.brightness} min={-50} max={50}
          onChange={v => onChange({ ...values, brightness: Math.round(v) })} />
        <AdjustSlider label={tr('create.contrast')} value={values.contrast} min={-50} max={50}
          onChange={v => onChange({ ...values, contrast: Math.round(v) })} />
        <AdjustSlider label={tr('create.saturation')} value={values.saturation} min={-50} max={50}
          onChange={v => onChange({ ...values, saturation: Math.round(v) })} />
        <Pressable style={t.doneBtn} onPress={onClose}><Text style={t.doneBtnText}>{tr('create.done')}</Text></Pressable>
      </GlassSheet>
    </Modal>
  );
}

const aj = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 48, gap: 8 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginBottom: 4 },
  sliderLabel: { fontSize: 13, fontWeight: '600', width: 90 },
  sliderVal: { fontSize: 12, width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 36, justifyContent: 'center', position: 'relative' },
  fill: { height: 3, borderRadius: 2 },
  thumb: { position: 'absolute', top: 8, width: 20, height: 20, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 },
});

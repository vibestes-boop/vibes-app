import { useI18n } from '@/lib/i18n';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import { GlassSheet, useEditorSheet } from './sharedStyles';

export type RotateState = { rotation: 0 | 90 | 180 | 270; flipH: boolean };

export function RotateSheet({ visible, state, onChange, onClose }: {
  visible: boolean; state: RotateState; onChange: (s: RotateState) => void; onClose: () => void;
}) {
  const t = useEditorSheet();
  const { t: tr } = useI18n();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={t.overlay} /></TouchableWithoutFeedback>
      <GlassSheet style={ro.sheet}>
        <View style={t.handle} />
        <Text style={t.title}>{tr('create.rotateFlip')}</Text>
        <View style={ro.row}>
          <Pressable style={[ro.btn, { backgroundColor: t.fill }]} onPress={() => onChange({ ...state, rotation: (((state.rotation - 90) % 360 + 360) % 360) as RotateState['rotation'] })}>
            <Text style={[ro.icon, { color: t.text }]}>↺</Text><Text style={[ro.btnLabel, { color: t.textSecondary }]}>{tr('create.left90')}</Text>
          </Pressable>
          <Pressable style={[ro.btn, { backgroundColor: t.fill }]} onPress={() => onChange({ ...state, rotation: ((state.rotation + 90) % 360) as RotateState['rotation'] })}>
            <Text style={[ro.icon, { color: t.text }]}>↻</Text><Text style={[ro.btnLabel, { color: t.textSecondary }]}>{tr('create.right90')}</Text>
          </Pressable>
          <Pressable style={[ro.btn, { backgroundColor: state.flipH ? t.fillActive : t.fill }]} onPress={() => onChange({ ...state, flipH: !state.flipH })}>
            <Text style={[ro.icon, { color: t.text }]}>⇔</Text><Text style={[ro.btnLabel, { color: t.textSecondary }]}>{tr('create.flip')}</Text>
          </Pressable>
          <Pressable style={[ro.btn, { backgroundColor: t.fill }]} onPress={() => onChange({ rotation: 0, flipH: false })}>
            <Text style={[ro.icon, { color: t.text }]}>⊙</Text><Text style={[ro.btnLabel, { color: t.textSecondary }]}>{tr('create.reset')}</Text>
          </Pressable>
        </View>
        <Text style={[ro.badge, { color: t.textMuted }]}>{state.rotation}° {state.flipH ? '· gespiegelt' : ''}</Text>
        <Pressable style={t.doneBtn} onPress={onClose}><Text style={t.doneBtnText}>{tr('create.done')}</Text></Pressable>
      </GlassSheet>
    </Modal>
  );
}

const ro = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 20 },
  btn: { alignItems: 'center', gap: 8, width: 72, paddingVertical: 14, borderRadius: 14 },
  icon: { fontSize: 28 },
  btnLabel: { fontSize: 11, fontWeight: '600' },
  badge: { textAlign: 'center', fontSize: 13, marginBottom: 16 },
});

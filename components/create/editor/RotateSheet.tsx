import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import { shared } from './sharedStyles';

export type RotateState = { rotation: 0 | 90 | 180 | 270; flipH: boolean };

export function RotateSheet({ visible, state, onChange, onClose }: {
  visible: boolean; state: RotateState; onChange: (s: RotateState) => void; onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={shared.overlay} /></TouchableWithoutFeedback>
      <View style={ro.sheet}>
        <View style={shared.handle} />
        <Text style={shared.title}>Drehen & Spiegeln</Text>
        <View style={ro.row}>
          <Pressable style={ro.btn} onPress={() => onChange({ ...state, rotation: (((state.rotation - 90) % 360 + 360) % 360) as RotateState['rotation'] })}>
            <Text style={ro.icon}>↺</Text><Text style={ro.btnLabel}>Links 90°</Text>
          </Pressable>
          <Pressable style={ro.btn} onPress={() => onChange({ ...state, rotation: ((state.rotation + 90) % 360) as RotateState['rotation'] })}>
            <Text style={ro.icon}>↻</Text><Text style={ro.btnLabel}>Rechts 90°</Text>
          </Pressable>
          <Pressable style={[ro.btn, state.flipH && ro.btnActive]} onPress={() => onChange({ ...state, flipH: !state.flipH })}>
            <Text style={ro.icon}>⇔</Text><Text style={ro.btnLabel}>Spiegeln</Text>
          </Pressable>
          <Pressable style={ro.btn} onPress={() => onChange({ rotation: 0, flipH: false })}>
            <Text style={ro.icon}>⊙</Text><Text style={ro.btnLabel}>Reset</Text>
          </Pressable>
        </View>
        <Text style={ro.badge}>{state.rotation}° {state.flipH ? '· gespiegelt' : ''}</Text>
        <Pressable style={shared.doneBtn} onPress={onClose}><Text style={shared.doneBtnText}>Fertig</Text></Pressable>
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

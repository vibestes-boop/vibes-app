import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { SH, SW } from './sharedStyles';

export type TextOverlay = {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  x: number; // 0..1 relative
  y: number; // 0..1 relative
};

export const FONT_SIZES = [18, 24, 32, 42, 56];
export const TEXT_COLORS = ['#ffffff','#000000','#FF3B30','#FF9500','#FFD60A','#30D158','#32ADE6','#BF5AF2','#FF2D55'];

export function TextOverlayEditor({
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
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
          <View style={to.controls}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={to.sizeRow}>
              {FONT_SIZES.map((sz) => (
                <Pressable key={sz} onPress={() => setFontSize(sz)} style={[to.sizeBtn, fontSize === sz && to.sizeBtnActive]}>
                  <Text style={[to.sizeBtnText, { fontSize: Math.min(sz * 0.55, 22) }, fontSize === sz && { color: '#000' }]}>Aa</Text>
                </Pressable>
              ))}
            </ScrollView>
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
  doneText: { color: '#000', fontSize: 15, fontWeight: '600' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  textInput: { color: '#fff', textAlign: 'center', fontWeight: '700', width: '100%', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  controls: { paddingBottom: 40, gap: 12 },
  sizeRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  sizeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  sizeBtnActive: { backgroundColor: '#fff' },
  sizeBtnText: { color: '#fff', fontWeight: '600' },
  colorRow: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
});

// ─── Trash Zone ──────────────────────────────────────────────────────────────
export const TRASH_BTN_W     = 230;
export const TRASH_BTN_H     = 56;
export const TRASH_BTN_X     = (SW - TRASH_BTN_W) / 2;
export const TRASH_BTN_TOP   = SH * 0.70;
export const TRASH_BTN_BOT   = TRASH_BTN_TOP + TRASH_BTN_H;

export const isInTrash = (x: number, y: number) =>
  x >= TRASH_BTN_X && x <= TRASH_BTN_X + TRASH_BTN_W &&
  y >= TRASH_BTN_TOP && y <= TRASH_BTN_BOT;

export function TrashZone({ visible, isOver }: { visible: boolean; isOver: boolean }) {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(opacityAnim, {
      toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  useEffect(() => {
    RNAnimated.timing(scaleAnim, {
      toValue: isOver ? 1.08 : 1.0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isOver, scaleAnim]);

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

// ─── Text Overlay Item ────────────────────────────────────────────────────────
export function TextOverlayItem({
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
        posX.current = posX.current + gs.dx;
        posY.current = posY.current + gs.dy;
        translateX.setValue(posX.current);
        translateY.setValue(posY.current);
        const now = Date.now();
        if (now - lastTap.current < 300 && Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          cbs.current.onRemove(overlay.id);
        }
        lastTap.current = now;
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
  text: { fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
});

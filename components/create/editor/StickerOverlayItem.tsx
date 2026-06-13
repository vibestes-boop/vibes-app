import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated as RNAnimated, PanResponder, StyleSheet, View } from 'react-native';
import { SW, SH } from './sharedStyles';
import type { StickerOverlay } from './StickerSheet';

export function StickerOverlayItem({ overlay, onRemove, onDragStart, onDragEnd, onMove }: {
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
  // direkte Prop-Referenzen würden stale werden.
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
      style={[{ position: 'absolute', top: 0, left: 0, zIndex: 21 }, {
        transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
      }]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri: overlay.url }} style={s.img} contentFit="contain" />
    </RNAnimated.View>
  );
}

const s = StyleSheet.create({
  img: { width: 96, height: 96 },
});

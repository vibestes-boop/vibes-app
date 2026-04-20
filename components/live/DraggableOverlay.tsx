/**
 * components/live/DraggableOverlay.tsx
 *
 * v1.22.0 — Wiederverwendbare Drag-Overlay-Komponente für Live-Streams.
 *
 * Pattern: "Commit-on-Release"
 *   • Host zieht mit dem Finger → 60fps lokal (Reanimated Worklet, kein Netzwerk)
 *   • Beim Finger-Loslassen → EINE Broadcast-Message an Viewer
 *   • Viewer interpoliert 200ms sanft zur neuen Position
 *
 * Das spart ~99% der Broadcast-Messages gegenüber Live-Throttling und
 * bleibt performant bei Tausenden von Viewern.
 *
 * Persistenz: Optional via AsyncStorage (storageKey).
 *   → Host sieht Overlay beim nächsten Stream an derselben Position.
 *
 * Verwendung:
 *   Host:   draggable={true}, onRelease={broadcastPosition}
 *   Viewer: draggable={false}, remotePosition={positionFromBroadcast}
 *
 * Später auch für Sticker, Produkt-Karten, Pinned-Comments nutzbar.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DraggablePosition {
  x: number;
  y: number;
}

interface DraggableOverlayProps {
  /** Host-Modus (draggable) oder Viewer-Modus (readonly, animiert zu remotePosition). */
  draggable: boolean;
  /** Start-Position, wenn keine gespeicherte und keine remote vorliegt. */
  defaultPosition: DraggablePosition;
  /** Viewer-Modus: Position die Host per Broadcast geschickt hat. */
  remotePosition?: DraggablePosition | null;
  /** Host-Modus: wird beim Loslassen mit finaler Position aufgerufen. */
  onRelease?: (position: DraggablePosition) => void;
  /** Eindeutiger Key für AsyncStorage-Persistenz (nur Host-Seite). */
  storageKey?: string;
  /** Drag-Bounds (Default: Screen). */
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  /** Der eigentliche Overlay-Inhalt (Poll-Card, Sticker, Produkt, …). */
  children: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DraggableOverlay({
  draggable,
  defaultPosition,
  remotePosition,
  onRelease,
  storageKey,
  minX = 0,
  maxX,
  minY = 0,
  maxY,
  children,
}: DraggableOverlayProps) {
  const translateX = useSharedValue(defaultPosition.x);
  const translateY = useSharedValue(defaultPosition.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Gemessene Element-Größe für korrektes Clamping
  const [size, setSize] = useState({ width: 0, height: 0 });

  // ── Persistenz (Host): letzte Position laden ──────────────────────────
  useEffect(() => {
    if (!draggable || !storageKey) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`draggable-pos:${storageKey}`);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as DraggablePosition;
        if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return;
        translateX.value = withTiming(parsed.x, { duration: 180 });
        translateY.value = withTiming(parsed.y, { duration: 180 });
      } catch {
        // silent — falls AsyncStorage nicht verfügbar
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draggable, storageKey, translateX, translateY]);

  // ── Viewer: Remote-Position animiert anfliegen ────────────────────────
  useEffect(() => {
    if (draggable || !remotePosition) return;
    translateX.value = withTiming(remotePosition.x, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(remotePosition.y, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [remotePosition, draggable, translateX, translateY]);

  // ── Persist + Callback bei Release ────────────────────────────────────
  const handleRelease = useCallback(
    (x: number, y: number) => {
      const pos = { x, y };
      if (storageKey) {
        AsyncStorage.setItem(`draggable-pos:${storageKey}`, JSON.stringify(pos)).catch(
          () => {},
        );
      }
      onRelease?.(pos);
    },
    [onRelease, storageKey],
  );

  // ── Pan-Gesture ───────────────────────────────────────────────────────
  // activeOffset: >10px Bewegung nötig, damit Taps auf Vote-Buttons durchgehen
  const pan = Gesture.Pan()
    .enabled(draggable)
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const effMaxX = (maxX ?? SCREEN_W) - size.width;
      const effMaxY = (maxY ?? SCREEN_H) - size.height;
      const nextX = startX.value + e.translationX;
      const nextY = startY.value + e.translationY;
      translateX.value = Math.max(minX, Math.min(effMaxX > minX ? effMaxX : minX, nextX));
      translateY.value = Math.max(minY, Math.min(effMaxY > minY ? effMaxY : minY, nextY));
    })
    .onEnd(() => {
      runOnJS(handleRelease)(translateX.value, translateY.value);
    });

  // ── Animated Style ────────────────────────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const inner = (
    <Animated.View
      style={[styles.wrapper, animatedStyle]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {children}
    </Animated.View>
  );

  // Viewer-Modus: keine GestureDetector nötig
  if (!draggable) return inner;

  return <GestureDetector gesture={pan}>{inner}</GestureDetector>;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

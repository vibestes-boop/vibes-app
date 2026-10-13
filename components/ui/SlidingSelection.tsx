import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Animated.View/createAnimatedComponent über require: der Default-Import crasht in
// Hermes HBC (siehe OfflineBanner). Hooks und with* bleiben statisch importiert.
/* eslint-disable @typescript-eslint/no-require-imports */
const _ra = require('react-native-reanimated') as any;
const _ns = _ra?.default ?? _ra;
const AnimatedView = _ns?.View ?? View;
const AnimatedText = _ns?.Text ?? Text;
const AnimatedPressable = (_ns?.createAnimatedComponent?.(Pressable) ?? Pressable) as typeof Pressable;
/* eslint-enable @typescript-eslint/no-require-imports */

// Dieselben Federn wie die untere Leiste (components/nav/AppTabBar.tsx)
export const SLIDE_SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
export const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

type Frame = { x: number; y: number; width: number; height: number };

// Letzte Lage je `persistKey`: Wird der Umschalter neu eingehängt (z. B. als Kopf
// einer Liste, die pro Reiter neu startet), gleitet die Kapsel von dort weiter.
const lastPlace = new Map<string, { x: number; y: number; w: number; h: number }>();

/**
 * Gleitende Auswahl für Umschalter (Reiter, Segmente, Chips): Jede Option meldet
 * ihre Lage, eine Kapsel (oder Unterstreichung) gleitet mit Feder zur gewählten.
 * Die Kapsel muss im selben Container wie die Optionen liegen.
 * `underline`: Höhe einer Unterstreichung statt einer Kapsel über die ganze Option.
 * `persistKey`: Lage über ein Neu-Einhängen hinweg behalten.
 */
export function useSlidingSelection(selected: string | null, { underline = 0, persistKey }: { underline?: number; persistKey?: string } = {}) {
  const saved = persistKey ? lastPlace.get(persistKey) : undefined;
  const frames = useRef<Record<string, Frame>>({});
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const x = useSharedValue(saved?.x ?? 0);
  const y = useSharedValue(saved?.y ?? 0);
  const w = useSharedValue(saved?.w ?? 0);
  const h = useSharedValue(saved?.h ?? 0);
  // Sichtbarkeit als Wert auf dem UI-Thread: Die Kapsel ist immer eingehängt und wird
  // nur eingeblendet. Erst beim Einhängen gesetzte Werte kamen sonst nie an.
  const shown = useSharedValue(saved ? 1 : 0);
  // Lage aller Optionen auch auf dem UI-Thread, damit Beschriftungen ihre Farbe
  // mit der vorbeigleitenden Kapsel überblenden können (SlidingLabel)
  const framesSV = useSharedValue<Record<string, Frame>>({});
  const placed = useRef(!!saved);
  const [ready, setReady] = useState(!!saved);

  const moveTo = useCallback((key: string | null) => {
    // Leerer Schlüssel ist eine gültige Option (z. B. „Alle“)
    const f = key != null ? frames.current[key] : undefined;
    if (!f) return;
    const top = underline ? f.y + f.height - underline : f.y;
    const height = underline || f.height;
    if (persistKey) lastPlace.set(persistKey, { x: f.x, y: top, w: f.width, h: height });
    shown.value = 1;
    if (placed.current) {
      x.value = withSpring(f.x, SLIDE_SPRING);
      y.value = withSpring(top, SLIDE_SPRING);
      w.value = withSpring(f.width, SLIDE_SPRING);
      h.value = withSpring(height, SLIDE_SPRING);
    } else {
      // Beim ersten Mal ohne Animation an die Stelle springen
      x.value = f.x;
      y.value = top;
      w.value = f.width;
      h.value = height;
      placed.current = true;
      setReady(true);
    }
  }, [underline, persistKey, x, y, w, h, shown]);

  useEffect(() => {
    if (selected == null) shown.value = 0;
    else moveTo(selected);
  }, [selected, moveTo, shown]);

  const onLayoutFor = useCallback((key: string) => (e: LayoutChangeEvent) => {
    const { x: fx, y: fy, width, height } = e.nativeEvent.layout;
    frames.current[key] = { x: fx, y: fy, width, height };
    framesSV.value = { ...frames.current };
    if (key === selectedRef.current) moveTo(key);
  }, [moveTo, framesSV]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: w.value,
    height: h.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return { onLayoutFor, pillStyle, visible: ready && selected != null, x, y, w, h, shown, framesSV };
}

/** Die gleitende Kapsel; als erstes Kind in den Container der Optionen legen.
 * Kinder füllen sie aus (z. B. die feste Glasfläche wie in der unteren Leiste). */
export function SlidingPill({ selection, style, children }: {
  selection: ReturnType<typeof useSlidingSelection>;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return <AnimatedView pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0 }, style, selection.pillStyle]}>{children}</AnimatedView>;
}

/**
 * Beschriftung einer Option, deren Farbe mit der Kapsel überblendet: Liegt die
 * Kapsel darüber, gilt `activeColor`, sonst `color`. So springt die Schrift bei
 * hellen Kapseln mit dunkler Schrift nicht vor der Kapsel um.
 */
export function SlidingLabel({ selection, optionKey, color, activeColor, style, ...props }: TextProps & {
  selection: ReturnType<typeof useSlidingSelection>;
  optionKey: string;
  color: string;
  activeColor: string;
  style?: StyleProp<TextStyle>;
}) {
  const { x, y, w, h, shown, framesSV } = selection;
  const colorStyle = useAnimatedStyle(() => {
    const f = framesSV.value[optionKey];
    if (!f || w.value <= 0 || h.value <= 0) return { color };
    const ox = Math.min(x.value + w.value, f.x + f.width) - Math.max(x.value, f.x);
    const oy = Math.min(y.value + h.value, f.y + f.height) - Math.max(y.value, f.y);
    const tx = Math.max(0, Math.min(1, ox / Math.max(1, Math.min(w.value, f.width))));
    const ty = Math.max(0, Math.min(1, oy / Math.max(1, Math.min(h.value, f.height))));
    return { color: interpolateColor(tx * ty * shown.value, [0, 1], [color, activeColor]) };
  }, [optionKey, color, activeColor]);
  return <AnimatedText {...props} style={[style, colorStyle]} />;
}

/** Knopf, der beim Drücken federnd nachgibt (wie die Symbole der unteren Leiste). */
export function SpringPressable({ scaleTo = 0.94, style, onPressIn, onPressOut, ...props }: PressableProps & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <AnimatedPressable {...props} style={[style, pressStyle]}
    onPressIn={(e) => { scale.value = withSpring(scaleTo, PRESS_SPRING); onPressIn?.(e); }}
    onPressOut={(e) => { scale.value = withSpring(1, PRESS_SPRING); onPressOut?.(e); }} />;
}

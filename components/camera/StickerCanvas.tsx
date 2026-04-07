/**
 * StickerCanvas v2 — Rendert animierten Skia Skottie Sticker
 *
 * API-Fixes:
 * - useClock kommt von @shopify/react-native-skia (nicht reanimated)
 * - useDerivedValue kommt von react-native-reanimated
 * - Skottie Props: kein x/y/width/height — nur animation + frame
 *   Die Größe steuert der Canvas-Container
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Canvas,
  Skottie,
  useClock,           // ← aus Skia (wraps Reanimated intern)
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { getStickerAnimation } from '@/lib/stickerLottie';

const STICKER_EMOJI: Record<string, string> = {
  sunglasses: '🕶️',
  crown:      '👑',
  hearts:     '❤️',
  stars:      '⭐',
  dogears:    '🐶',
  rainbow:    '🌈',
  fire:       '🔥',
  butterfly:  '🦋',
  ghost:      '👻',
  lightning:  '⚡',
  sakura:     '🌸',
  diamond:    '💎',
  moon_s:     '🌙',
  alien:      '👽',
  angel:      '😇',
};

interface StickerCanvasProps {
  filterId: string;
  size: number;
  style?: object;
}

export function StickerCanvas({ filterId, size, style }: StickerCanvasProps) {
  const animation = useMemo(() => getStickerAnimation(filterId), [filterId]);

  // Skia-eigener Clock: SharedValue<number> in ms (aus @shopify/react-native-skia)
  const clock = useClock();

  // Frame-Index berechnen: gesloopt über die Animation-Dauer
  const frame = useDerivedValue(() => {
    if (!animation) return 0;
    const durationMs = animation.duration() * 1000;
    const t = clock.value % durationMs;
    return (t / 1000) * animation.fps();
  });

  if (!animation) {
    // Fallback: Emoji-Text
    return (
      <View style={[styles.fallback, { width: size, height: size }, style]}>
        <Text style={{ fontSize: size * 0.75, textAlign: 'center' }}>
          {STICKER_EMOJI[filterId] ?? '✨'}
        </Text>
      </View>
    );
  }

  return (
    // Canvas füllt die angegebene Größe — Skottie füllt den Canvas
    <Canvas style={[{ width: size, height: size }, style]}>
      <Skottie
        animation={animation}
        frame={frame}
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

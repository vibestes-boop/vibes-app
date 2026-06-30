/**
 * TabSlotSwitcher — „Wechsel-Karussell" für die anpassbaren Bottom-Nav-Slots.
 *
 * Long-Press auf Slot 2 oder Slot 4 öffnet ein HALBKREIS-Menü über der Nav:
 * runde Feature-Chips fächern auf. Tap tauscht den Slot sofort (persistiert via
 * tabBarStore → AsyncStorage + DB).
 *
 * Es werden nur Features angeboten, die NICHT bereits in der Nav stehen
 * (Slot 2 + Slot 4 raus) — die Auswahl-Liste kommt fertig gefiltert als `options`.
 *
 * Cross-platform robust via transparentem <Modal> — überstehende Absolut-Overlays
 * bekommen auf Android keine Touches außerhalb der Eltern-Bounds (Memory
 * vibes-android-overflow-touch-modal). Reanimated-Hooks STATISCH importiert
 * (vibes-reanimated-static-import); Animated-Namespace via Hermes-sicherem require.
 */
import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';

import { TAB_FEATURES, type TabFeature } from '@/lib/tabBarStore';
import { useTheme } from '@/lib/useTheme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = {
  View: _animNS?.View as typeof View,
  Text: _animNS?.Text as typeof Text,
};

const CIRCLE = 62;
const CONTAINER = 80;

// ── Einzelner Chip im Halbkreis (eigene Komponente → kein useAnimatedStyle in
//    einer .map-Schleife, Rules-of-Hooks; Memory zu GiftAnimation). Fächert beim
//    Öffnen vom Ursprung (Nähe Nav) zu seinem Zielpunkt auf. ────────────────────
function ArcButton({
  feature,
  targetX,
  targetY,
  originX,
  originY,
  progress,
  color,
  onPress,
}: {
  feature: TabFeature;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  progress: SharedValue<number>;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tx0 = originX - targetX;      // Start-Versatz X (zum Ursprung)
  const ty0 = targetY - originY;      // Start-Versatz Y (startet tiefer, fährt hoch)

  const aStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [
        { translateX: tx0 * (1 - p) },
        { translateY: ty0 * (1 - p) },
        { scale: 0.6 + 0.4 * p },
      ],
    };
  });

  const meta = TAB_FEATURES[feature];
  const Icon = meta.icon;

  return (
    <Animated.View
      style={[
        styles.arcItem,
        { left: targetX - CONTAINER / 2, bottom: targetY - (CIRCLE + 22) / 2 },
        aStyle,
      ]}
    >
      <Pressable onPress={onPress} style={styles.arcPress} accessibilityRole="button" accessibilityLabel={meta.label}>
        <View style={[styles.circle, { backgroundColor: color }]}>
          <Icon size={26} color="#FFFFFF" strokeWidth={2} />
        </View>
        <Text numberOfLines={1} style={[styles.arcLabel, { color: colors.text.primary }]}>
          {meta.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function TabSlotSwitcher({
  slot,
  options,
  onSelect,
  onClose,
}: {
  /** 2 = links vom Create-Button, 4 = rechts. */
  slot: 2 | 4;
  /** Bereits gefiltert: Features, die NICHT in der Nav stehen. */
  options: TabFeature[];
  onSelect: (f: TabFeature) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 220 });
  }, [progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // Markenfarbe (Lila), theme-adaptiv — bewusst NICHT das rote/pinke Akzent.
  const color = colors.accent.secondary;

  const screenW = Dimensions.get('window').width;
  const cx = screenW / 2;
  const navHeight = 56 + insets.bottom;
  const originY = navHeight + 64;                 // Fächer-Ursprung (von unten)
  const N = options.length;
  const R = N <= 1 ? 0 : Math.min(140, screenW / 2 - 56);

  const points = options.map((f, i) => {
    const angleDeg = N === 1 ? 90 : 180 - (i * 180) / (N - 1);
    const rad = (angleDeg * Math.PI) / 180;
    return { f, x: cx + R * Math.cos(rad), y: originY + R * Math.sin(rad) };
  });
  const apexY = originY + R; // höchster Punkt (für Caption)

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — Tap schließt */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
      </Animated.View>

      <Animated.Text style={[styles.caption, { bottom: apexY + 52, color: colors.text.muted }, captionStyle]}>
        {slot === 2 ? 'Linker Tab' : 'Rechter Tab'} · tippen zum Wechseln
      </Animated.Text>

      {points.map((p) => (
        <ArcButton
          key={p.f}
          feature={p.f}
          targetX={p.x}
          targetY={p.y}
          originX={cx}
          originY={originY}
          progress={progress}
          color={color}
          onPress={() => {
            notificationAsync(NotificationFeedbackType.Success);
            onSelect(p.f);
            onClose();
          }}
        />
      ))}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  arcItem: {
    position: 'absolute',
    width: CONTAINER,
    alignItems: 'center',
  },
  arcPress: {
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  arcLabel: {
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 6,
  },
});

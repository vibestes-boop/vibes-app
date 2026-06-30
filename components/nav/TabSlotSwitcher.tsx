/**
 * TabSlotSwitcher — „Wechsel-Karussell" für die anpassbaren Bottom-Nav-Slots.
 *
 * Long-Press auf Slot 2 oder Slot 4 (links/rechts vom Create-Button) öffnet ein
 * Tray-Karussell direkt über der Nav: scrollbare runde Feature-Chips. Tippen
 * tauscht den Slot sofort (persistiert via tabBarStore → AsyncStorage + DB).
 *
 * Cross-platform robust via transparentem <Modal> — überstehende Absolut-Overlays
 * bekommen auf Android keine Touches außerhalb der Eltern-Bounds; das Modal
 * portalt heraus und deckt den ganzen Screen ab (Backdrop-Tap schließt).
 *
 * Reanimated-Hooks STATISCH importiert (Memory vibes-reanimated-static-import);
 * Animated.View-Namespace via Hermes-sicherem require (wie app/(tabs)/_layout).
 */
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from 'expo-haptics';

import { ALL_TAB_FEATURES, TAB_FEATURES, type TabFeature } from '@/lib/tabBarStore';
import { useTheme } from '@/lib/useTheme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View as typeof View };

// Serlo-Marken-Pink (konsistent mit Create-Button-Versatz + Screenshot-Vorlage).
const PINK = '#FF2D55';

export function TabSlotSwitcher({
  slot,
  currentFeature,
  otherFeature,
  onSelect,
  onClose,
}: {
  /** 2 = links vom Create-Button, 4 = rechts. */
  slot: 2 | 4;
  /** Aktuell in diesem Slot belegtes Feature (wird markiert). */
  currentFeature: TabFeature;
  /** Feature im jeweils anderen Slot (ausgegraut → keine Doppelung). */
  otherFeature: TabFeature;
  onSelect: (f: TabFeature) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 180 });
  }, [progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
  const trayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));

  // Tray schwebt knapp über der echten Nav (Nav ≈ 56px + Safe-Area).
  const navHeight = 56 + insets.bottom;

  const pick = (f: TabFeature) => {
    if (f === otherFeature) return; // schon im anderen Tab → ignorieren
    notificationAsync(NotificationFeedbackType.Success);
    onSelect(f);
    onClose();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — Tap schließt */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
      </Animated.View>

      {/* Tray-Karussell */}
      <Animated.View
        style={[
          styles.tray,
          { bottom: navHeight + 8, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle },
          trayStyle,
        ]}
      >
        <Text style={[styles.caption, { color: colors.text.muted }]}>
          {slot === 2 ? 'Linker Tab' : 'Rechter Tab'} · tippen zum Wechseln
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {ALL_TAB_FEATURES.map((f) => {
            const meta = TAB_FEATURES[f];
            const Icon = meta.icon;
            const isCurrent = f === currentFeature;
            const isTaken = f === otherFeature;
            return (
              <Pressable
                key={f}
                onPress={() => pick(f)}
                disabled={isTaken}
                style={styles.chip}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent, disabled: isTaken }}
              >
                <View
                  style={[
                    styles.circle,
                    { backgroundColor: PINK },
                    isCurrent && styles.circleCurrent,
                    isTaken && styles.circleTaken,
                  ]}
                >
                  <Icon size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipLabel,
                    { color: isTaken ? colors.text.muted : colors.text.primary },
                    isCurrent && styles.chipLabelCurrent,
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
  },
  tray: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 11,
    paddingBottom: 13,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  row: {
    paddingHorizontal: 8,
    gap: 16,
    alignItems: 'flex-start',
  },
  chip: {
    width: 60,
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCurrent: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  circleTaken: {
    opacity: 0.3,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  chipLabelCurrent: {
    color: PINK,
    fontWeight: '700',
  },
});

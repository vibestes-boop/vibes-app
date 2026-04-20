import { useRef, useCallback } from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export type Category = {
  id: string | null;
  label: string;
  emoji: string;
  gradient: [string, string]; // kept for type compat — no longer used for color
};

export const CATEGORIES: Category[] = [
  { id: null,           label: 'For You',      emoji: '✦',  gradient: ['#000', '#000'] },
  { id: 'tech',         label: 'Tech',         emoji: '💻', gradient: ['#000', '#000'] },
  { id: 'design',       label: 'Design',       emoji: '🎨', gradient: ['#000', '#000'] },
  { id: 'art',          label: 'Art',          emoji: '🖼️', gradient: ['#000', '#000'] },
  { id: 'travel',       label: 'Travel',       emoji: '✈️', gradient: ['#000', '#000'] },
  { id: 'architecture', label: 'Architektur',  emoji: '🏛️', gradient: ['#000', '#000'] },
  { id: 'fashion',      label: 'Fashion',      emoji: '👗', gradient: ['#000', '#000'] },
  { id: 'music',        label: 'Musik',        emoji: '🎵', gradient: ['#000', '#000'] },
  { id: 'food',         label: 'Food',         emoji: '🍜', gradient: ['#000', '#000'] },
  { id: 'sport',        label: 'Sport',        emoji: '⚡', gradient: ['#000', '#000'] },
];

// ── Einzelne Tab-Komponente (TikTok-Stil: nur Text + Unterstrich) ─────────────
function Tab({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.92, { duration: 60 }),
      withTiming(1, { duration: 80 })
    );
    onPress();
  }, [onPress, scale]);

  return (
    <Animated.View style={animStyle}>
      <Pressable onPress={handlePress} style={s.tab}>
        <Text
          style={[
            s.tabLabel,
            isActive ? s.tabLabelActive : s.tabLabelInactive,
          ]}
        >
          {label}
        </Text>
        {/* TikTok-Stil: weißer Unterstrich unter aktivem Tab */}
        {isActive && <View style={s.tabUnderline} />}
      </Pressable>
    </Animated.View>
  );
}

// ── Filter-Leiste ──────────────────────────────────────────────────────────────
type Props = {
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  hideForYou?: boolean;
};

export function CategoryFilter({ activeTag, onSelect, hideForYou = false }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={s.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        style={s.scroll}
        decelerationRate="fast"
      >
        {/* For You */}
        {!hideForYou && (
          <Tab
            label="For You"
            isActive={activeTag === null}
            onPress={() => onSelect(null)}
          />
        )}

        {/* Kategorie-Tabs */}
        {CATEGORIES.filter((c) => c.id !== null).map((cat) => (
          <Tab
            key={String(cat.id)}
            label={cat.label}
            isActive={activeTag === cat.id}
            onPress={() => onSelect(cat.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },

  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 4,
  },

  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  tabLabelInactive: {
    color: 'rgba(255,255,255,0.88)',
  },

  // TikTok-Stil: kurzer weißer Balken unter aktivem Tab
  tabUnderline: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
});

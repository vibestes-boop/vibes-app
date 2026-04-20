import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { X, Compass, Brain, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useVibeStore } from '@/lib/store';

// ── Tag-Score Matrix (muss mit vibe_scores.sql übereinstimmen) ─────────────
const TAG_MATRIX: { tag: string; emoji: string; brain: number; explore: number }[] = [
  { tag: 'tech', emoji: '💻', brain: 0.92, explore: 0.22 },
  { tag: 'business', emoji: '📈', brain: 0.80, explore: 0.35 },
  { tag: 'architecture', emoji: '🏛️', brain: 0.72, explore: 0.55 },
  { tag: 'design', emoji: '🎨', brain: 0.68, explore: 0.62 },
  { tag: 'mindfulness', emoji: '🧘', brain: 0.62, explore: 0.70 },
  { tag: 'motivation', emoji: '💪', brain: 0.55, explore: 0.60 },
  { tag: 'gaming', emoji: '🎮', brain: 0.40, explore: 0.55 },
  { tag: 'art', emoji: '🖼️', brain: 0.42, explore: 0.88 },
  { tag: 'film', emoji: '🎬', brain: 0.45, explore: 0.72 },
  { tag: 'music', emoji: '🎵', brain: 0.35, explore: 0.65 },
  { tag: 'travel', emoji: '✈️', brain: 0.32, explore: 0.92 },
  { tag: 'nature', emoji: '🌿', brain: 0.30, explore: 0.82 },
  { tag: 'sport', emoji: '⚡', brain: 0.28, explore: 0.42 },
  { tag: 'food', emoji: '🍜', brain: 0.22, explore: 0.48 },
  { tag: 'fashion', emoji: '👗', brain: 0.20, explore: 0.52 },
];

// Berechnet welche Tags am besten zum aktuellen Slider passen
function getMatchingTags(explore: number, brain: number) {
  const scored = TAG_MATRIX.map((t) => ({
    ...t,
    score: (1 - Math.abs(t.brain - brain)) * 0.5 + (1 - Math.abs(t.explore - explore)) * 0.5,
  })).sort((a, b) => b.score - a.score);
  return { top: scored.slice(0, 4), bottom: scored.slice(-3) };
}

const PANEL_HEIGHT = 520;

type SliderProps = {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
  onRelease: () => void;
  accentColor: string;
  Icon: React.ElementType;
};

const SLIDER_WIDTH = Dimensions.get('window').width - 64;

function VibeSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  onRelease,
  accentColor,
  Icon,
}: SliderProps) {
  const translateX = useSharedValue(value * SLIDER_WIDTH);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const newX = Math.max(0, Math.min(SLIDER_WIDTH, e.x));
      translateX.value = newX;
      runOnJS(onChange)(newX / SLIDER_WIDTH);
    })
    .onEnd(() => {
      const snapped = Math.round((translateX.value / SLIDER_WIDTH) * 10) / 10;
      translateX.value = withTiming(snapped * SLIDER_WIDTH, { duration: 80 });
      runOnJS(onChange)(snapped);
      // Feed-Re-fetch auslösen
      runOnJS(onRelease)();
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translateX.value,
          [0, SLIDER_WIDTH],
          [0, SLIDER_WIDTH - 28]
        ),
      },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }));

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Icon size={16} stroke={accentColor} strokeWidth={2} />
        <Text style={styles.sliderLabel}>{label}</Text>
      </View>
      <View style={styles.sliderLabelsRow}>
        <Text style={styles.sliderEndLabel}>{leftLabel}</Text>
        <Text style={styles.sliderEndLabel}>{rightLabel}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.sliderTrack}>
          <Animated.View
            style={[styles.sliderFill, { backgroundColor: accentColor }, fillStyle]}
          />
          <Animated.View
            style={[styles.sliderThumb, { borderColor: accentColor }, thumbStyle]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function TuneMyVibeOverlay({ visible, onClose }: Props) {
  const { exploreVibe, brainVibe, setExploreVibe, setBrainVibe, commitVibes } =
    useVibeStore();

  const { top: topTags, bottom: bottomTags } = useMemo(
    () => getMatchingTags(exploreVibe, brainVibe),
    [exploreVibe, brainVibe],
  );

  const translateY = useSharedValue(PANEL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 80 });
      translateY.value = withTiming(0, { duration: 80 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 60 });
      translateY.value = withTiming(PANEL_HEIGHT, { duration: 80 });
    }
  }, [visible, backdropOpacity, translateY]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible && translateY.value === PANEL_HEIGHT) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, panelStyle]}>
        <BlurView intensity={90} tint="dark" style={styles.blurPanel}>
          <View style={styles.handle} />

          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Tune my Vibe</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} stroke="#9CA3AF" strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={styles.panelSubtitle}>
            Kein Algorithmus entscheidet für dich — du steuerst.
          </Text>

          <VibeSlider
            label="Explore vs. Safe"
            leftLabel="Safe Zone"
            rightLabel="Explore"
            value={exploreVibe}
            onChange={setExploreVibe}
            onRelease={commitVibes}
            accentColor="#FFFFFF"
            Icon={Compass}
          />

          <VibeSlider
            label="Brain vs. Brain-Off"
            leftLabel="Entertainment"
            rightLabel="Learn"
            value={brainVibe}
            onChange={setBrainVibe}
            onRelease={commitVibes}
            accentColor="#34D399"
            Icon={Brain}
          />

          {/* ── Live Feed-Vorschau ── */}
          <View style={styles.previewSection}>
            <View style={styles.previewRow}>
              <TrendingUp size={13} color="#34D399" strokeWidth={2} />
              <Text style={styles.previewLabel}>Dein Feed bevorzugt</Text>
            </View>
            <View style={styles.pillRow}>
              {topTags.map((t) => (
                <View key={t.tag} style={styles.pillTop}>
                  <Text style={styles.pillText}>{t.emoji} {t.tag}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.previewRow, { marginTop: 10 }]}>
              <TrendingDown size={13} color="#F87171" strokeWidth={2} />
              <Text style={[styles.previewLabel, { color: 'rgba(255,255,255,0.3)' }]}>Weniger davon</Text>
            </View>
            <View style={styles.pillRow}>
              {bottomTags.map((t) => (
                <View key={t.tag} style={styles.pillBottom}>
                  <Text style={[styles.pillText, { color: 'rgba(255,255,255,0.3)' }]}>{t.emoji} {t.tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.applyRow}>
            <View style={styles.vibeIndicators}>
              <View style={[styles.vibeTag, { borderColor: '#FFFFFF' }]}>
                <Text style={[styles.vibeTagText, { color: '#FFFFFF' }]}>
                  {exploreVibe > 0.6 ? '🔍 Explorer' : exploreVibe > 0.3 ? '⚖️ Balanced' : '🛡️ Safe'}
                </Text>
              </View>
              <View style={[styles.vibeTag, { borderColor: '#34D399' }]}>
                <Text style={[styles.vibeTagText, { color: '#34D399' }]}>
                  {brainVibe > 0.6 ? '🧠 Learner' : brainVibe > 0.3 ? '⚡ Mixed' : '😌 Chill'}
                </Text>
              </View>
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  blurPanel: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 28,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderEndLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  sliderTrack: {
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'visible',
  },
  sliderFill: {
    height: 28,
    borderRadius: 14,
    position: 'absolute',
    left: 0,
    opacity: 0.4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  previewSection: {
    marginTop: 4,
    marginBottom: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillTop: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
  },
  pillBottom: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  applyRow: {
    marginTop: 4,
  },
  vibeIndicators: {
    flexDirection: 'row',
    gap: 10,
  },
  vibeTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  vibeTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

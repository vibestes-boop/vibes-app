import { useTheme } from '@/lib/useTheme';
import { useEffect } from 'react';
import { StyleSheet,View } from 'react-native';
import {
interpolate,
useAnimatedStyle,
useSharedValue,
withRepeat,
withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_HEIGHT,SCREEN_WIDTH } from './feedConstants';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

/** Einzelne Skeleton-Karte im Feed-Format (Vollbild) */
function SkeletonCard({ delay }: { delay: number }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const placeholder = { backgroundColor: colors.border.strong };
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shimmer ist stabil
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.6]),
  }));

  // delay-Variante: leicht versetzter Shimmer für mehrere Karten
  void delay;

  return (
    <View style={[styles.card, { backgroundColor: colors.bg.primary }]}>
      {/* Hintergrund-Placeholder */}
      <Animated.View style={[styles.bg, placeholder, shimmerStyle]} />

      {/* Avatar + Name oben links */}
      <View style={styles.authorRow}>
        <Animated.View style={[styles.avatar, placeholder, shimmerStyle]} />
        <View style={styles.authorText}>
          <Animated.View style={[styles.nameLine, placeholder, shimmerStyle]} />
          <Animated.View style={[styles.tagLine, placeholder, shimmerStyle]} />
        </View>
      </View>

      {/* Caption unten */}
      <View style={styles.captionBlock}>
        <Animated.View style={[styles.captionLine, placeholder, { width: '85%' }, shimmerStyle]} />
        <Animated.View style={[styles.captionLine, placeholder, { width: '60%' }, shimmerStyle]} />
      </View>

      {/* Action-Buttons rechts */}
      <View style={[styles.actions, { bottom: insets.bottom + 80 }]}>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.actionBtn, placeholder, shimmerStyle]} />
        ))}
      </View>
    </View>
  );
}

/** Zeigt 2 Skeleton-Karten während der Feed lädt */
export function FeedSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]} pointerEvents="none">
      <SkeletonCard delay={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'flex-end',
    padding: 20,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  authorRow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.08,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  authorText: {
    gap: 6,
  },
  nameLine: {
    width: 100,
    height: 12,
    borderRadius: 6,
  },
  tagLine: {
    width: 60,
    height: 10,
    borderRadius: 5,
  },
  captionBlock: {
    gap: 8,
    marginBottom: 70,
    marginRight: 60,
  },
  captionLine: {
    height: 12,
    borderRadius: 6,
  },
  actions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    gap: 20,
    alignItems: 'center',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

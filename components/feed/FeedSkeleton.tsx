import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './feedConstants';

/** Einzelne Skeleton-Karte im Feed-Format (Vollbild) */
function SkeletonCard({ delay }: { delay: number }) {
  const insets = useSafeAreaInsets();
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
    <View style={styles.card}>
      {/* Hintergrund-Placeholder */}
      <Animated.View style={[styles.bg, shimmerStyle]} />

      {/* Avatar + Name oben links */}
      <View style={styles.authorRow}>
        <Animated.View style={[styles.avatar, shimmerStyle]} />
        <View style={styles.authorText}>
          <Animated.View style={[styles.nameLine, shimmerStyle]} />
          <Animated.View style={[styles.tagLine, shimmerStyle]} />
        </View>
      </View>

      {/* Caption unten */}
      <View style={styles.captionBlock}>
        <Animated.View style={[styles.captionLine, { width: '85%' }, shimmerStyle]} />
        <Animated.View style={[styles.captionLine, { width: '60%' }, shimmerStyle]} />
      </View>

      {/* Action-Buttons rechts */}
      <View style={[styles.actions, { bottom: insets.bottom + 80 }]}>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.actionBtn, shimmerStyle]} />
        ))}
      </View>
    </View>
  );
}

/** Zeigt 2 Skeleton-Karten während der Feed lädt */
export function FeedSkeleton() {
  return (
    <View style={styles.container} pointerEvents="none">
      <SkeletonCard delay={0} />
    </View>
  );
}

const BASE = '#1a1a1a';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: '#000',
  },
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
    padding: 20,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BASE,
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
    backgroundColor: BASE,
  },
  authorText: {
    gap: 6,
  },
  nameLine: {
    width: 100,
    height: 12,
    borderRadius: 6,
    backgroundColor: BASE,
  },
  tagLine: {
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: BASE,
  },
  captionBlock: {
    gap: 8,
    marginBottom: 70,
    marginRight: 60,
  },
  captionLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: BASE,
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
    backgroundColor: BASE,
  },
});

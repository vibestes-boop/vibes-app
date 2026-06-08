/**
 * ProfileGridSkeleton — Shimmer-Platzhalter für den Post-Grid im Profil
 * Zeigt 9 Grau-Zellen (3×3) mit Shimmer-Animation während Posts laden.
 */
import { useEffect } from 'react';
import { StyleSheet,View } from 'react-native';
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { GRID_CELL_WIDTH,GRID_COLUMNS,GRID_GAP } from './profileConstants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS  = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const CELL_HEIGHT = GRID_CELL_WIDTH; // quadratische Zellen wie echte Posts
const SKELETON_COLOR = 'rgba(255,255,255,0.06)';

function SkeletonCell({ index }: { index: number }) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Leicht versetzter Start pro Zelle für Wellen-Effekt
    const timeout = setTimeout(() => {
      shimmer.value = withRepeat(
        withTiming(1, { duration: 1100 }),
        -1,
        true
      );
    }, index * 80);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.8]),
  }));

  return (
    <Animated.View style={[s.cell, shimmerStyle]} />
  );
}

type Props = {
  /** Anzahl anzuzeigender Skeleton-Zellen (default: 9 = 3 Reihen) */
  count?: number;
};

export function ProfileGridSkeleton({ count = 9 }: Props) {
  return (
    <View style={s.grid}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCell key={i} index={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingTop: GRID_GAP,
  },
  cell: {
    width: GRID_CELL_WIDTH,
    height: CELL_HEIGHT,
    backgroundColor: SKELETON_COLOR,
    borderRadius: 2,
  },
});

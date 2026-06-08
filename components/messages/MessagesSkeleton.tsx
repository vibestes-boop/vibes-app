/**
 * MessagesSkeleton — Shimmer-Platzhalter für die Konversations-Liste
 * Zeigt 8 Platzhalter-Zeilen während Nachrichten laden.
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS  = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const BASE = 'rgba(255,255,255,0.07)';

function SkeletonRow({ index }: { index: number }) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    }, index * 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.85]),
  }));

  // Variante: kürzere Preview-Linie für manche Zeilen (realistischer)
  const previewWidth = index % 3 === 0 ? '50%' : index % 3 === 1 ? '70%' : '60%';

  return (
    <View style={s.row}>
      {/* Avatar */}
      <Animated.View style={[s.avatar, animStyle]} />
      {/* Texte */}
      <View style={s.textWrap}>
        <Animated.View style={[s.nameLine, animStyle]} />
        <Animated.View style={[s.previewLine, { width: previewWidth as `${number}%` }, animStyle]} />
      </View>
      {/* Zeit */}
      <Animated.View style={[s.timeLine, animStyle]} />
    </View>
  );
}

type Props = {
  count?: number;
};

export function MessagesSkeleton({ count = 8 }: Props) {
  return (
    <View style={s.container}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BASE,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 8,
  },
  nameLine: {
    height: 13,
    width: '45%',
    borderRadius: 7,
    backgroundColor: BASE,
  },
  previewLine: {
    height: 11,
    borderRadius: 6,
    backgroundColor: BASE,
  },
  timeLine: {
    width: 32,
    height: 10,
    borderRadius: 5,
    backgroundColor: BASE,
    flexShrink: 0,
  },
});

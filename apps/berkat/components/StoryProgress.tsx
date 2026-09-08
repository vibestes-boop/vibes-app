import { useEffect, useRef } from 'react';

import { Animated, Easing, StyleSheet, View } from 'react-native';

import { stage } from '../theme/tokens';

const DURATION_MS = 5000;

/** Native progress; no interval-driven rerender of the image or its controls. */
export function StoryProgress({ count, index, running, onComplete }: {
  count: number; index: number; running: boolean; onComplete: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const elapsed = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const started = performance.now();
    progress.setValue(elapsed.current / DURATION_MS);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: Math.max(0, DURATION_MS - elapsed.current),
      easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled) { cancelled = true; complete.current(); }
    });
    return () => {
      cancelled = true;
      animation.stop();
      elapsed.current = Math.min(DURATION_MS, elapsed.current + performance.now() - started);
    };
  }, [running, progress]);

  return <View style={s.bars} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, i) => <View key={i} style={s.track}>
      {i <= index ? <Animated.View style={[s.fill, i === index && {
        transformOrigin: 'left', transform: [{ scaleX: progress }],
      }]} /> : null}
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 4 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: stage.lineStrong, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: stage.text },
});

import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View, Text: _animNS?.Text ?? _animMod?.Text };
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Score-Farbe anhand von Schwellenwerten — grün/gelb/rot */
function vibeRingColor(pct: number): string {
  if (pct >= 70) return '#22D3EE'; // cyan  — hoch
  if (pct >= 40) return '#FBBF24'; // gelb  — mittel
  return '#34D399';                 // grün  — niedrig
}

/** Animierter Resonanz-Score-Ring: zählt beim Mount von 0 auf den Score hoch */
export function VibeScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = vibeRingColor(pct);

  const animatedOpacity = useSharedValue(0);

  useEffect(() => {
    animatedOpacity.value = withTiming(1, { duration: 100 });
  }, [pct, animatedOpacity]);

  const ringScale = useSharedValue(0.7);
  useEffect(() => {
    ringScale.value = withTiming(1, { duration: 120 });
  }, [ringScale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: animatedOpacity.value,
  }));
  const numberStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
  }));

  const [displayNum, setDisplayNum] = useState(0);
  useEffect(() => {
    const duration = 280;
    const steps = 12;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += pct / steps;
      if (current >= pct) {
        setDisplayNum(Math.round(pct));
        clearInterval(timer);
      } else setDisplayNum(Math.round(current));
    }, interval);
    return () => clearInterval(timer);
  }, [pct]);

  return (
    <Animated.View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, ringStyle]}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      />
      <LinearGradient
        colors={[color + 'CC', color]}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: 'transparent',
          opacity: pct > 0 ? 1 : 0,
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={{
          width: size - 12,
          height: size - 12,
          borderRadius: (size - 12) / 2,
          backgroundColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.Text
          style={[
            { color: '#fff', fontSize: size * 0.22, fontWeight: '800', letterSpacing: -0.5 },
            numberStyle,
          ]}
        >
          {displayNum}
        </Animated.Text>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: size * 0.12, fontWeight: '600' }}>
          res.
        </Text>
      </View>
    </Animated.View>
  );
}

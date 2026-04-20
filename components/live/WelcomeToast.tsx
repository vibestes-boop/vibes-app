/**
 * components/live/WelcomeToast.tsx
 *
 * v1.24.0 — TikTok-Style Welcome-Toast beim Live-Join
 *
 * Rendert eine gestapelte Liste von "@user hat den Stream betreten"
 * Toasts am unteren Rand des Live-Screens (oberhalb der Chat-Input).
 *
 * Daten kommen aus `useLiveWelcome(sessionId, …)` → `welcomes[]`.
 * Jeder Eintrag animiert slide-in von links + fade-in, bleibt bis
 * zum TTL-Evict im State, und fadet beim Verschwinden per State-
 * Update des Hooks aus (Unmount).
 *
 * Zwei Tiers:
 *   • follower → violetter Rand, ✨ Icon, "hat den Stream betreten"
 *   • top_fan  → goldener Rand, 👑 Icon, "…ist zurück" (Top-Fan-Framing)
 */

import { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import type { WelcomeEvent } from '@/lib/useLiveWelcome';

interface Props {
  welcomes: WelcomeEvent[];
  /** Optional: Offset vom unteren Rand (z.B. wenn Input-Bar höher ist). */
  bottomOffset?: number;
}

export const WelcomeToast = memo(function WelcomeToast({
  welcomes,
  bottomOffset = 0,
}: Props) {
  if (welcomes.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[s.wrap, { bottom: bottomOffset }]}
    >
      {welcomes.map((w) => (
        <ToastPill key={w.key} welcome={w} />
      ))}
    </View>
  );
});

// ─── Einzelner Toast (eigene Komponente für eigene Animation) ────────────────

const ToastPill = memo(function ToastPill({ welcome }: { welcome: WelcomeEvent }) {
  const translateX = useSharedValue(-80);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    // Slide-in + fade-in
    translateX.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: 260 });

    // Fade-out kurz vor TTL-Ende (Hook entfernt den Eintrag bei ~4s;
    // wir starten ab 3.4s den Fade damit er nicht abrupt weg-popt).
    const fadeOut = setTimeout(() => {
      opacity.value    = withTiming(0,  { duration: 450 });
      translateX.value = withTiming(40, { duration: 450, easing: Easing.in(Easing.cubic) });
    }, 3400);
    return () => clearTimeout(fadeOut);
  }, [opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const isTopFan  = welcome.tier === 'top_fan';
  const icon      = isTopFan ? '👑' : '✨';
  const tierLabel = isTopFan ? 'Top-Fan' : 'Follower';
  const message   = isTopFan ? 'ist zurück im Stream' : 'hat den Stream betreten';

  return (
    <Animated.View
      style={[
        s.pill,
        isTopFan ? s.pillTopFan : s.pillFollower,
        animStyle,
      ]}
    >
      {welcome.avatarUrl ? (
        <Image
          source={{ uri: welcome.avatarUrl }}
          style={s.avatar}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitial}>
            {welcome.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={s.textCol}>
        <View style={s.topRow}>
          <Text style={s.username} numberOfLines={1}>
            @{welcome.username}
          </Text>
          <View
            style={[
              s.tierChip,
              isTopFan ? s.tierChipTopFan : s.tierChipFollower,
            ]}
          >
            <Text style={s.tierChipText}>{tierLabel}</Text>
          </View>
        </View>
        <Text style={s.message} numberOfLines={1}>
          {icon}  {message}
        </Text>
      </View>
    </Animated.View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 80, // rechts Platz lassen für vertikale Controls (Like, Gift, etc)
    gap: 6,
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(17,17,24,0.78)',
    borderWidth: 1.2,
    maxWidth: '100%',
    // Subtiler Schatten für Tiefe (iOS/Android)
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillFollower: {
    borderColor: 'rgba(139,92,246,0.75)', // violet-500
  },
  pillTopFan: {
    borderColor: 'rgba(250,204,21,0.85)', // amber-400
    backgroundColor: 'rgba(24,18,4,0.82)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222',
  },
  avatarFallback: {
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  textCol: {
    flexShrink: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f1f5f9',
    maxWidth: 140,
  },
  tierChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tierChipFollower: {
    backgroundColor: 'rgba(139,92,246,0.22)',
  },
  tierChipTopFan: {
    backgroundColor: 'rgba(250,204,21,0.25)',
  },
  tierChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  message: {
    marginTop: 1,
    fontSize: 11.5,
    color: '#cbd5e1',
    fontWeight: '500',
  },
});

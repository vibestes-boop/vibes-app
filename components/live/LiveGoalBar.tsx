/**
 * components/live/LiveGoalBar.tsx
 *
 * Zeigt den Fortschritt des LIVE-Ziels als Progress-Bar an.
 * Erscheint oberhalb des Chats für Host und Viewer.
 *
 *  ┌────────────────────────────────────────────────────────┐
 *  │ 🎯 Ich tanze!          [████████░░░░░░░░]  340 / 500 💎 │
 *  └────────────────────────────────────────────────────────┘
 *
 * Wenn das Ziel erreicht wird:
 *  - Balken wird grün + Checkmark
 *  - Konfetti-Partikel (einfache Animated Views)
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import type { LiveGoal } from '@/lib/useLiveGoal';

interface Props {
  goal: LiveGoal;
  justReached?: boolean;
}

const GOAL_ICONS: Record<string, string> = {
  gift_value: '💎',
  likes: '❤️',
};

export function LiveGoalBar({ goal, justReached }: Props) {
  const progress = Math.min(goal.current / goal.target, 1);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;

  // Balken animieren wenn `current` sich ändert
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Pulsieren wenn Ziel noch nicht erreicht
  useEffect(() => {
    if (goal.reached) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [goal.reached, pulseAnim]);

  // Celebration-Flash wenn Ziel erreicht
  useEffect(() => {
    if (!justReached) return;
    Animated.sequence([
      Animated.timing(celebrateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrateAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [justReached, celebrateAnim]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barColor = goal.reached ? '#22c55e' : '#8b5cf6';
  const icon = GOAL_ICONS[goal.type] ?? '🎯';
  const label = goal.reached ? '✅ Ziel erreicht!' : goal.title;

  const celebrateOpacity = celebrateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(139,92,246,0)', 'rgba(139,92,246,0.25)'],
  });

  return (
    <Animated.View style={[s.container, { transform: [{ scale: pulseAnim }] }]}>
      {/* Celebration Glow */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.glow, { backgroundColor: celebrateOpacity as any }]}
        pointerEvents="none"
      />

      {/* Header Row */}
      <View style={s.header}>
        <Text style={s.icon}>{icon}</Text>
        <Text style={s.title} numberOfLines={1}>{label}</Text>
        <Text style={[s.count, goal.reached && s.countReached]}>
          {goal.reached
            ? '🎉'
            : `${fmtNum(goal.current)} / ${fmtNum(goal.target)}`}
        </Text>
      </View>

      {/* Progress Track */}
      <View style={s.track}>
        <Animated.View
          style={[s.fill, { width: barWidth, backgroundColor: barColor }]}
        />
        {/* Shine */}
        <View style={s.shine} pointerEvents="none" />
      </View>
    </Animated.View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    overflow: 'hidden',
  },
  glow: {
    borderRadius: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    letterSpacing: 0.2,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a78bfa',
  },
  countReached: {
    color: '#4ade80',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
  },
});

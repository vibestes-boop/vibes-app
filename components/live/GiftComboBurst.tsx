/**
 * components/live/GiftComboBurst.tsx
 *
 * v1.25.0 — TikTok-Style „×N COMBO!" Overlay
 *
 * Ergänzt den bestehenden kleinen ×N-Chip in GiftPill: ab combo≥5 erscheint
 * rechts mittig ein großes, fettes Combo-Burst-Overlay. Je höher der Combo,
 * desto auffälliger die Darstellung (Tier-Farben + Glow + Milestone-Effect).
 *
 * Tiers:
 *   •  5–  9 : Orange — solid
 *   • 10– 24 : Gold   — gentle pulse
 *   • 25– 49 : Pink   — sparkles drumherum
 *   • 50– 99 : Purple — stärkerer pulse + 🔥
 *   • 100+   : Rainbow-Border — 💥 + 🔥 Milestone-Burst
 *
 * Ein Combo bleibt sichtbar solange neue Gift-Events reinkommen; bei Inaktivität
 * fadet er nach ~1.2s aus (matched zum Broadcast-Stop).
 *
 * Zeigt nur die „lauteste" Combo (höchster comboCount) — kein Stapel, um den
 * Stream nicht zu überladen. Kleine Combos (x2–x4) bleiben im GiftPill-Chip.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View, Text: _animNS?.Text ?? _animMod?.Text };
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';

import type { IncomingGift } from '@/lib/useGifts';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Ab welchem Combo-Count das große Overlay erscheint (darunter reicht Pill-Chip). */
const THRESHOLD = 5;

interface Tier {
  primary:     string;
  glow:        string;
  borderColor: string;
  label:       string;
  emoji:       string | null;
  pulse:       boolean;
  sparkles:    boolean;
}

function tierFor(combo: number): Tier {
  if (combo >= 100) return {
    primary:     '#EC4899',
    glow:        '#F472B6',
    borderColor: '#FCD34D',
    label:       'INSANE!',
    emoji:       '💥',
    pulse:       true,
    sparkles:    true,
  };
  if (combo >= 50) return {
    primary:     '#8B5CF6',
    glow:        '#A78BFA',
    borderColor: '#F472B6',
    label:       'MEGA!',
    emoji:       '🔥',
    pulse:       true,
    sparkles:    true,
  };
  if (combo >= 25) return {
    primary:     '#DB2777',
    glow:        '#EC4899',
    borderColor: '#F9A8D4',
    label:       'HYPE!',
    emoji:       '✨',
    pulse:       true,
    sparkles:    true,
  };
  if (combo >= 10) return {
    primary:     '#F59E0B',
    glow:        '#FBBF24',
    borderColor: '#FDE68A',
    label:       'COMBO!',
    emoji:       null,
    pulse:       true,
    sparkles:    false,
  };
  return {
    primary:     '#F97316',
    glow:        '#FB923C',
    borderColor: '#FDBA74',
    label:       'COMBO',
    emoji:       null,
    pulse:       false,
    sparkles:    false,
  };
}

interface Props {
  gifts: IncomingGift[];
  /** Vertikaler Offset vom Bottom — wird relativ zu den Pills positioniert. */
  bottomOffset?: number;
}

/**
 * Wählt aus den aktiven Gifts den „lautesten" Combo (höchster comboCount) aus,
 * und zeigt nur diesen als großes Overlay. Rest bleibt im kleinen Pill-Chip.
 */
export const GiftComboBurst = memo(function GiftComboBurst({
  gifts,
  bottomOffset = 320,
}: Props) {
  const loudest = useMemo(() => {
    if (gifts.length === 0) return null;
    let best: IncomingGift | null = null;
    for (const g of gifts) {
      if (g.comboCount < THRESHOLD) continue;
      if (!best || g.comboCount > best.comboCount) best = g;
    }
    return best;
  }, [gifts]);

  if (!loudest) return null;

  return (
    <ComboBurstPill
      // Re-mount bei Sender-Wechsel → frische Entry-Animation
      key={loudest.comboKey}
      gift={loudest}
      bottomOffset={bottomOffset}
    />
  );
});

// ─── Einzelnes Pill mit eigener Animation ────────────────────────────────────

const ComboBurstPill = memo(function ComboBurstPill({
  gift,
  bottomOffset,
}: {
  gift: IncomingGift;
  bottomOffset: number;
}) {
  const tier = tierFor(gift.comboCount);

  const scale       = useSharedValue(0.4);
  const translateX  = useSharedValue(120);
  const opacity     = useSharedValue(0);
  const numberScale = useSharedValue(1);
  const glowPulse   = useSharedValue(0);

  // Entry-Animation (einmalig beim Mount)
  useEffect(() => {
    translateX.value = withSpring(0,   { damping: 12, stiffness: 160 });
    scale.value      = withSpring(1.0, { damping: 10, stiffness: 180 });
    opacity.value    = withTiming(1,   { duration: 180 });
  }, [opacity, scale, translateX]);

  // Tier-basierter Hintergrund-Pulse (nur ab Gold x10+)
  useEffect(() => {
    if (!tier.pulse) return;
    glowPulse.value = withRepeat(
      withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      glowPulse.value = 0;
    };
  }, [tier.pulse, glowPulse]);

  // Jedes Combo-Increment → Number pulsiert (1.0 → 1.35 → 1.0)
  const prevComboRef = useRef(gift.comboCount);
  useEffect(() => {
    if (gift.comboCount === prevComboRef.current) return;
    prevComboRef.current = gift.comboCount;
    numberScale.value = withSequence(
      withTiming(1.35, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(1.0,  { damping: 7, stiffness: 240 }),
    );
  }, [gift.comboCount, numberScale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
    opacity:   opacity.value,
  }));

  const numberStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * glowPulse.value,
    backgroundColor: interpolateColor(
      glowPulse.value,
      [0, 1],
      [tier.primary + '55', tier.glow + '99'],
    ),
  }));

  // Milestone: Bei x10/25/50/100 → einmaliger „Ring-Burst"-Effekt
  const isMilestone = gift.comboCount === 10
    || gift.comboCount === 25
    || gift.comboCount === 50
    || gift.comboCount === 100;

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.container, { bottom: bottomOffset }, containerStyle]}
    >
      {/* Hintergrund-Glow — liegt hinter dem Pill */}
      <Animated.View style={[s.glow, { borderColor: tier.borderColor }, glowStyle]} />

      {/* Milestone-Ring — einmaliger Burst-Effekt bei Meilensteinen */}
      {isMilestone && <MilestoneRing color={tier.glow} />}

      <View style={[s.card, { borderColor: tier.borderColor }]}>
        {/* Sender-Header */}
        <View style={s.headerRow}>
          {gift.senderAvatar ? (
            <Image
              source={{ uri: gift.senderAvatar }}
              style={s.avatar}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: tier.primary }]}>
              <Text style={s.avatarInitial}>
                {gift.senderName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.senderName} numberOfLines={1}>
            {gift.senderName}
          </Text>
        </View>

        {/* Gift-Emoji + Combo-Counter */}
        <View style={s.bodyRow}>
          <Text style={s.giftEmoji}>{gift.gift.emoji}</Text>
          <Animated.View style={[s.numberWrap, numberStyle]}>
            <Text style={[s.numberX, { color: tier.primary }]}>×</Text>
            <Text style={[s.numberValue, { color: tier.glow }]}>
              {gift.comboCount}
            </Text>
          </Animated.View>
        </View>

        {/* Tier-Label */}
        <View style={s.labelRow}>
          {tier.emoji && <Text style={s.labelEmoji}>{tier.emoji}</Text>}
          <Text style={[s.labelText, { color: tier.glow }]}>{tier.label}</Text>
          {tier.emoji && <Text style={s.labelEmoji}>{tier.emoji}</Text>}
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Milestone-Ring (einmaliger Burst bei x10/25/50/100) ─────────────────────

const MilestoneRing = memo(function MilestoneRing({ color }: { color: string }) {
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value   = withTiming(2.4, { duration: 900, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0,   { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.milestoneRing, { borderColor: color }, style]}
    />
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_W = 188;

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    width: CARD_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 2,
    // Schatten macht Card „aus dem Screen" herausstehen
    shadowColor:   '#000',
    shadowOpacity: 0.6,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     16,
  },
  milestoneRing: {
    position: 'absolute',
    width:  CARD_W + 60,
    height: CARD_W + 60,
    borderRadius: (CARD_W + 60) / 2,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  card: {
    width: CARD_W,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(9,9,14,0.88)',
    alignItems: 'center',
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#222',
  },
  avatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  senderName: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#f1f5f9',
    maxWidth: 130,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  giftEmoji: {
    fontSize: 38,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  numberWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 0,
  },
  numberX: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  numberValue: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  labelEmoji: {
    fontSize: 14,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

// Für externe Consumer nützlich (z.B. falls Tests den Threshold wissen wollen)
export const GIFT_COMBO_BURST_THRESHOLD = THRESHOLD;

// Parameter genutzt um SCREEN_H lint-noise zu vermeiden (für zukünftige Erweiterungen)
void SCREEN_H;
void SCREEN_W;

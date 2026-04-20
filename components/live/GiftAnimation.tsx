/**
 * components/live/GiftAnimation.tsx
 *
 * TikTok-Style Gift Animations:
 * - Normal (< 750 Coins):   Pill-Banner links unten
 * - Premium (>= 750 Coins): Untere Bildschirmhälfte, Animation steigt von unten auf,
 *                            oben transparent auslaufend — genau wie TikTok
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type IncomingGift } from '@/lib/useGifts';
import { GiftComboBurst } from './GiftComboBurst';

// Lottie optional — braucht Dev Build
let LottieView: React.ComponentType<{
  source: object;
  autoPlay: boolean;
  loop: boolean;
  style: object;
}> | null = null;
try {
  LottieView = require('lottie-react-native').default;
} catch (_) {}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Ab diesem Wert → Premium Fullscreen (TikTok-Style)
const PREMIUM_THRESHOLD = 750;

// Höhe des Premium-Overlays: untere 50% des Bildschirms (fullwidth)
const GIFT_AREA_HEIGHT = SCREEN_H * 0.50;

import MaskedView from '@react-native-masked-view/masked-view';
import { VideoView, useVideoPlayer } from 'expo-video';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _constMod = require('expo-constants') as any;
const Constants = _constMod?.default ?? _constMod;

// ─── Premium Overlay — TikTok-Style mit echtem Transparency-Fade ──────────────
// MaskedView + LinearGradient Maske = echter Per-Pixel Alpha Fade nach oben.
// Lottie-Animationen haben transparenten Hintergrund → perfekt für diesen Effekt.

function PremiumGiftOverlay({ gift }: { gift: IncomingGift }) {
  const slideY         = useRef(new Animated.Value(120)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Lokales Asset hat Vorrang vor URL
  const videoSource = gift.gift.videoAsset ?? gift.gift.videoUrl ?? null;

  // Rules-of-Hooks: useVideoPlayer MUSS immer (unbedingt) aufgerufen werden.
  // Leerer String = idle Player, wird im JSX nur gemountet wenn videoSource gesetzt ist.
  // Pattern konsistent mit app/create/index.tsx:840 und app/live/replay/[id].tsx:149.
  const videoPlayer = useVideoPlayer(videoSource ?? '', (p) => {
    p.loop  = false;
    p.muted = false;
  });

  const fadeOut = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0, duration: 700, useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!videoSource) return;
    videoPlayer.play();
  }, [videoPlayer, videoSource]);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0, tension: 80, friction: 12, useNativeDriver: true,
    }).start();
    const displaySec = videoSource ? 15 : 4;
    const t = setTimeout(fadeOut, displaySec * 1000);
    return () => clearTimeout(t);
  }, []);

  const color = gift.gift.color ?? '#F59E0B';

  return (
    <Animated.View
      style={[
        styles.premiumContainer,
        { opacity: overlayOpacity, transform: [{ translateY: slideY }] },
      ]}
    >
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Svg
            width={SCREEN_W}
            height={GIFT_AREA_HEIGHT}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <SvgGradient id="videoFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0"    stopColor="black" stopOpacity="0" />
                <Stop offset="0.07" stopColor="black" stopOpacity="0" />
                <Stop offset="0.20" stopColor="black" stopOpacity="1" />
                <Stop offset="1"    stopColor="black" stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Rect
              x="0" y="0"
              width={SCREEN_W}
              height={GIFT_AREA_HEIGHT}
              fill="url(#videoFade)"
            />
          </Svg>
        }
      >
        {videoSource ? (
          <VideoView
            player={videoPlayer}
            style={styles.premiumVideo}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={styles.premiumMediaWrapper}>
            {LottieView && gift.gift.lottieAsset && !(LottieView as any).__isStub ? (
              <LottieView
                source={gift.gift.lottieAsset as object}
                autoPlay
                loop={false}
                style={styles.premiumLottie}
              />
            ) : (
              <Text style={styles.premiumEmoji}>{gift.gift.emoji}</Text>
            )}
          </View>
        )}
      </MaskedView>

      {/* ── Sender Pill + Combo Counter ── */}
      <View style={styles.premiumPill}>
        {gift.senderAvatar ? (
          <Image
            source={{ uri: gift.senderAvatar }}
            style={styles.premiumAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.premiumAvatarFallback, { backgroundColor: color + '88' }]}>
            <Text style={styles.avatarLetter}>
              {gift.senderName[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.premiumPillText} numberOfLines={1}>
          <Text style={styles.premiumPillSender}>{gift.senderName} </Text>
          <Text style={styles.premiumPillSent}>hat </Text>
          <Text style={[styles.premiumPillGift, { color }]}>{gift.gift.name}</Text>
          <Text style={styles.premiumPillSent}> gesendet</Text>
        </Text>
        {/* Combo Counter für Premium */}
        {gift.comboCount > 1 && (
          <View style={[styles.comboChip, { backgroundColor: color + 'DD' }]}>
            <Text style={styles.comboChipText}>×{gift.comboCount}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}


// ─── Standard Pill-Banner (günstige Geschenke) ───────────────────────────────

function GiftPill({ gift, index, pillsBottomOffset }: {
  gift: IncomingGift;
  index: number;
  pillsBottomOffset: number;
}) {
  const slideX    = useRef(new Animated.Value(-340)).current;
  const opacity   = useRef(new Animated.Value(0)).current;
  const giftScale = useRef(new Animated.Value(0)).current;
  // Combo-Counter Bounce-Animation
  const comboScale = useRef(new Animated.Value(gift.comboCount > 1 ? 1.5 : 1)).current;
  const prevComboRef = useRef(gift.comboCount);

  // Einblend-Animationen (einmalig beim Mount)
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(150),
      Animated.spring(giftScale, {
        toValue: 1.15,
        useNativeDriver: true,
        tension: 220,
        friction: 6,
      }),
      Animated.spring(giftScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: -340,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }, 4500);

    return () => clearTimeout(t);
  }, []);

  // Combo-Counter ändert sich → Bounce-Animation triggern
  useEffect(() => {
    if (gift.comboCount === prevComboRef.current) return;
    prevComboRef.current = gift.comboCount;

    // Reset auf 1.5 dann smooth zurück auf 1.0
    comboScale.setValue(1.5);
    Animated.spring(comboScale, {
      toValue: 1.0,
      tension: 280,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [gift.comboCount]);

  const color   = gift.gift.color ?? '#FFFFFF';
  // Pills stapeln sich von pillsBottomOffset aufwärts — direkt über den Kommentaren
  const yBottom = pillsBottomOffset + index * 80;
  const showCombo = gift.comboCount > 1;

  return (
    <Animated.View
      style={[
        styles.pill,
        { bottom: yBottom, transform: [{ translateX: slideX }], opacity },
      ]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.0)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pillGrad}
      >
        {gift.senderAvatar ? (
          <Image
            source={{ uri: gift.senderAvatar }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: color + '88' }]}>
            <Text style={styles.avatarLetter}>
              {gift.senderName[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={styles.senderName} numberOfLines={1}>
            {gift.senderName}
          </Text>
          <Text style={styles.sentLabel} numberOfLines={1}>
            hat{' '}
            <Text style={{ color, fontWeight: '700' }}>{gift.gift.name}</Text>
            {' '}gesendet
          </Text>
        </View>
        <Animated.View style={[styles.giftIconBox, { transform: [{ scale: giftScale }] }]}>
          {LottieView && gift.gift.lottieAsset && !(LottieView as any).__isStub ? (
            <LottieView
              source={gift.gift.lottieAsset as object}
              autoPlay
              loop={false}
              style={styles.lottie}
            />
          ) : (
            <Text style={styles.giftEmoji}>{gift.gift.emoji}</Text>
          )}
        </Animated.View>

        {/* ─── Combo Counter ×N — TikTok-Style ─── */}
        {showCombo && (
          <Animated.View
            style={[styles.comboChip, { transform: [{ scale: comboScale }] }]}
          >
            <Text style={styles.comboX}>×</Text>
            <Text style={styles.comboNum}>{gift.comboCount}</Text>
          </Animated.View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Burst Emojis (spiralförmig hoch) ────────────────────────────────────────

function BurstEmoji({
  emoji,
  x,
  delay,
  pillsBottomOffset,
}: {
  emoji: string;
  x: number;
  delay: number;
  pillsBottomOffset: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0)).current;
  const rotate     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 70;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 200,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -(SCREEN_H * 0.5),
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: drift > 0 ? 1 : -1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1300),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-25deg', '25deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.burstEmoji,
        {
          left: x,
          bottom: pillsBottomOffset - 20, // Burst startet etwas unterhalb der Pills
          transform: [
            { translateY },
            { translateX },
            { scale },
            { rotate: spin },
          ],
          opacity,
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Haupt-Overlay ────────────────────────────────────────────────────────────

interface GiftAnimationProps {
  gifts: IncomingGift[];
  /**
   * Abstand vom unteren Bildschirmrand wo das erste Pill erscheint.
   * Sollte der Oberkante des Kommentar-Bereichs entsprechen.
   * Watch:  insets.bottom + 55 + 240
   * Host:   insets.bottom + 12 + 44 + 280
   */
  pillsBottomOffset?: number;
}

export function GiftAnimation({ gifts, pillsBottomOffset = 280 }: GiftAnimationProps) {
  if (gifts.length === 0) return null;

  const premiumGifts = gifts.filter((g) => g.gift.coinCost >= PREMIUM_THRESHOLD);
  const normalGifts  = gifts.filter((g) => g.gift.coinCost < PREMIUM_THRESHOLD);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Premium: letztes Geschenk gewinnt (wie TikTok) */}
      {premiumGifts.slice(-1).map((gift) => (
        <PremiumGiftOverlay key={gift.id} gift={gift} />
      ))}

      {/* Normal: Pill-Banner DIREKT ÜBER DEN KOMMENTAREN, max 3 gleichzeitig */}
      {normalGifts.slice(-3).map((gift, i) => (
        <GiftPill key={gift.id} gift={gift} index={i} pillsBottomOffset={pillsBottomOffset} />
      ))}

      {/* Burst-Emojis starten an der Pill-Position und fliegen nach oben */}
      {gifts.map((gift) =>
        gift.gift.burstEmojis.map((emoji, i) => (
          <BurstEmoji
            key={`${gift.id}-${i}`}
            emoji={emoji}
            x={gift.burstPositions[i] ?? 50}
            delay={i * 150}
            pillsBottomOffset={pillsBottomOffset}
          />
        ))
      )}

      {/* ─── v1.25.0: Großes ×N COMBO! Overlay ab combo ≥ 5 ──────────────────
       * Right-anchored, sitzt rechts neben den left-anchored Pills.
       * Zeigt nur den lautesten Combo — kein Stapel, um Stream nicht zu überladen.
       * Vertikal leicht über dem Pill-Stack (≈ 2. Pill-Höhe) für guten Focus. */}
      <GiftComboBurst gifts={gifts} bottomOffset={pillsBottomOffset + 40} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },

  // ── Premium: Bottom-fixed, edge-to-edge, 50% Höhe ──
  premiumContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: GIFT_AREA_HEIGHT,
    // Z-Index: über dem Stream-Video, aber unter UI-Elementen
    zIndex: 50,
  },
  premiumMediaWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  premiumLottie: {
    width: SCREEN_W,
    height: GIFT_AREA_HEIGHT,
  },
  premiumVideo: {
    // Volle Breite, keine Seitenabstände, von links bis rechts
    width: SCREEN_W,
    height: GIFT_AREA_HEIGHT,
  },
  premiumEmoji: {
    fontSize: 160,
    marginBottom: 20,
  },
  // Sanfter Fade-Effekt: NUR oberes 20% des Gift-Containers (≈100pt auf iPhone)
  premiumTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: GIFT_AREA_HEIGHT * 0.20,
  },

  // Sender-Pill links unten (wie TikTok)
  premiumPill: {
    position: 'absolute',
    bottom: 72,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 12,
    maxWidth: SCREEN_W * 0.75,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  premiumAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  premiumAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumPillText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  premiumPillSender: {
    color: '#fff',
    fontWeight: '700',
  },
  premiumPillSent: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
  },
  premiumPillGift: {
    fontWeight: '800',
  },

  // ── Normal Pill-Banner ──
  pill: {
    position: 'absolute',
    left: 8,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  pillGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 6,
    gap: 8,
    minWidth: 210,
    maxWidth: SCREEN_W * 0.78,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
    gap: 1,
  },
  senderName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sentLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
  giftIconBox: {
    marginRight: 2,
  },
  lottie: {
    width: 56,
    height: 56,
  },
  giftEmoji: {
    fontSize: 40,
    marginRight: 2,
  },

  // ── Burst ──
  burstEmoji: {
    position: 'absolute',
    fontSize: 30,
  },

  // ── Combo Counter ×N ──────────────────────────────────────────────────────
  // Erscheint rechts am Pill-Ende wenn comboCount > 1
  comboChip: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(0,0,0,0.70)',
    borderRadius:    12,
    paddingHorizontal: 7,
    paddingVertical:   3,
    marginLeft:      4,
    borderWidth:     1,
    borderColor:     'rgba(251,191,36,0.6)', // gold
    gap:             1,
  },
  comboX: {
    color:      '#fbbf24',   // amber-400
    fontSize:   11,
    fontWeight: '600',
    lineHeight: 16,
  },
  comboNum: {
    color:      '#fbbf24',
    fontSize:   16,
    fontWeight: '900',
    lineHeight: 20,
    letterSpacing: -0.5,
  },
  /** Für Premium-Pill — kompakter, da weniger Platz */
  comboChipText: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});

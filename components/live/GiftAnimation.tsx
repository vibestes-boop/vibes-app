/**
 * components/live/GiftAnimation.tsx
 *
 * Zeigt eingehende Geschenke als animierte Overlay-Banner.
 * Stacked: mehrere Geschenke gleichzeitig möglich (Queue).
 * Burst-Emojis fliegen auf dem Screen hoch.
 *
 * Architektur:
 * - useGiftStream() liefert IncomingGift[]
 * - <GiftAnimation gifts={gifts} /> rendert alle aktiven Animationen
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Einzelne Geschenk-Animation ─────────────────────────────────────────────

function GiftBanner({ gift }: { gift: IncomingGift }) {
  const slideAnim   = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Animation-Referenz für Cleanup beim Unmount
  const fadeOutRef  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Ausblenden nach 3s — Animation-Referenz speichern für Cleanup
    const timer = setTimeout(() => {
      fadeOutRef.current = Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -120,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]);
      fadeOutRef.current.start();
    }, 3_000);

    return () => {
      clearTimeout(timer);
      fadeOutRef.current?.stop(); // Animation stoppen wenn Banner vor Zeit unmountet
    };
  }, [slideAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
          borderColor: gift.gift.color + '66',
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(17,24,39,0.9)']}
        style={styles.bannerGrad}
      >
        {/* Avatar Sender */}
        {gift.senderAvatar ? (
          <Image
            source={{ uri: gift.senderAvatar }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: gift.gift.color + '44' }]}>
            <Text style={styles.avatarPlaceholderText}>
              {gift.senderName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Text */}
        <View style={styles.bannerText}>
          <Text style={styles.senderName} numberOfLines={1}>{gift.senderName}</Text>
          <Text style={styles.giftLabel}>
            hat {gift.gift.emoji} <Text style={{ color: gift.gift.color }}>{gift.gift.name}</Text> gesendet
          </Text>
        </View>

        {/* Großes Emoji */}
        <Text style={styles.bigEmoji}>{gift.gift.emoji}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Burst Emojis (fliegen nach oben) ────────────────────────────────────────

function BurstEmoji({ emoji, x, delay }: { emoji: string; x: number; delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(1)).current;
  const scale      = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -(SCREEN_H * 0.5),
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.2,
          useNativeDriver: true,
          tension: 50,
        }),
      ]),
    ]).start();
  }, [translateY, opacity, scale, delay]);

  return (
    <Animated.Text
      style={[
        styles.burstEmoji,
        {
          left: x,
          bottom: 150,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Haupt-Overlay Komponente ─────────────────────────────────────────────────

interface GiftAnimationProps {
  gifts: IncomingGift[];
}

export function GiftAnimation({ gifts }: GiftAnimationProps) {
  if (gifts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Banner-Bereich (links unten) */}
      <View style={styles.bannersContainer}>
        {gifts.slice(-3).map((gift) => (
          <GiftBanner key={gift.id} gift={gift} />
        ))}
      </View>

      {/* Burst-Emojis: stabile Positionen aus gift.burstPositions (verhindert Position-Jump bei Re-render) */}
      {gifts.map((gift) =>
        gift.gift.burstEmojis.map((emoji, i) => (
          <BurstEmoji
            key={`${gift.id}-${i}`}
            emoji={emoji}
            x={gift.burstPositions[i] ?? 50}
            delay={i * 180}
          />
        ))
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  bannersContainer: {
    position: 'absolute',
    bottom: 130,
    left: 8,
    gap: 8,
  },
  banner: {
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: SCREEN_W * 0.75,
    borderWidth: 1,
  },
  bannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bannerText: {
    flex: 1,
  },
  senderName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  giftLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },
  bigEmoji: {
    fontSize: 32,
  },
  burstEmoji: {
    position: 'absolute',
    fontSize: 28,
  },
});

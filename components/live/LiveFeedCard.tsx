/**
 * LiveFeedCard.tsx — TikTok-Style Live Card im Feed
 * Erscheint automatisch alle 6 Posts im Haupt-Feed.
 * Design basiert auf TikTok Live-Card Analyse (2024/25).
 */
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated as RNAnimated } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Users, MessageCircle, Clock } from 'lucide-react-native';
// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import type { LiveSession } from '@/lib/useLiveSession';

interface Props {
  session: LiveSession;
  isFollowing?: boolean; // ob der User dem Host folgt
}

// ─── Zahlen formatieren: 1200 → "1.2K" ────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Stream-Dauer berechnen ────────────────────────────────────────────────────
function formatDuration(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
  if (minutes < 1) return 'Gerade live';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function LiveFeedCard({ session, isFollowing = false }: Props) {
  const router = useRouter();

  // ── Blinkender LIVE-Dot ──────────────────────────────────────────────────────
  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  // ── Pulsierender Avatar-Ring (wie TikTok) ────────────────────────────────────
  const ringScale = useRef(new RNAnimated.Value(1)).current;
  const ringOpacity = useRef(new RNAnimated.Value(0.8)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.sequence([
          RNAnimated.timing(ringScale, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          RNAnimated.timing(ringScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          RNAnimated.timing(ringOpacity, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [ringScale, ringOpacity]);

  const host = session.profiles;
  const duration = formatDuration(session.started_at);
  const hasStats = (session.viewer_count ?? 0) > 0;

  const handlePress = () => {
    router.push({
      pathname: '/live/watch/[id]' as any,
      params: { id: session.id },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.93, transform: [{ scale: 0.98 }] }]}
    >
      {/* Hintergrund: Avatar-Bild (groß, nicht geblurt) */}
      {host?.avatar_url ? (
        <Image
          source={{ uri: host.avatar_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.fallbackBg]} />
      )}

      {/* Gradient-Overlay: oben leicht, unten stark */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.82)']}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.4, 1]}
      />

      {/* Oben rechts: LIVE Badge + Dauer */}
      <View style={s.topRight}>
        <View style={s.livePill}>
          <Animated.View style={[s.liveDot, dotStyle]} />
          <Text style={s.liveLabel}>LIVE</Text>
        </View>
        <View style={s.durationBadge}>
          <Clock size={10} color="rgba(255,255,255,0.75)" strokeWidth={2.5} />
          <Text style={s.durationText}>{duration}</Text>
        </View>
      </View>

      {/* Oben links: "Following" Badge wenn User dem Host folgt */}
      {isFollowing && (
        <View style={s.followingBadge}>
          <Text style={s.followingText}>● Gefolgt</Text>
        </View>
      )}

      {/* Unten: Host-Info + Stats */}
      <View style={s.bottomInfo}>
        {/* Linke Seite: Pulsierender Avatar + Name + Titel */}
        <View style={s.hostRow}>
          <View style={s.avatarWrap}>
            {/* Pulsierender Ring */}
            <RNAnimated.View
              style={[
                s.avatarRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            {host?.avatar_url ? (
              <Image source={{ uri: host.avatar_url }} style={s.avatar} contentFit="cover" />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInitial}>
                  {host?.username?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
          </View>

          <View style={s.hostText}>
            <Text style={s.username} numberOfLines={1}>@{host?.username ?? '...'}</Text>
            {session.title ? (
              <Text style={s.title} numberOfLines={2}>{session.title}</Text>
            ) : null}
          </View>
        </View>

        {/* Rechte Seite: Stats */}
        {hasStats && (
          <View style={s.statsCol}>
            <View style={s.statRow}>
              <Users size={12} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              <Text style={s.statText}>{fmtNum(session.viewer_count ?? 0)}</Text>
            </View>
            {(session.comment_count ?? 0) > 0 && (
              <View style={s.statRow}>
                <MessageCircle size={12} color="rgba(255,255,255,0.85)" strokeWidth={2} />
                <Text style={s.statText}>{fmtNum(session.comment_count ?? 0)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const CARD_H = 280;

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    height: CARD_H,
  },
  fallbackBg: {
    backgroundColor: '#0f0f1a',
  },

  // ── Top overlays ──────────────────────────────────────────────────────────────
  topRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 6,
    alignItems: 'flex-end',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveLabel: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },

  followingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  followingText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Bottom info ───────────────────────────────────────────────────────────────
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 20,
    gap: 10,
  },
  hostRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
    borderColor: '#EF4444',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 16 },

  hostText: { flex: 1, gap: 2 },
  username: { color: '#fff', fontWeight: '700', fontSize: 14 },
  title: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 16 },

  statsCol: { alignItems: 'flex-end', gap: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

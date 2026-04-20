/**
 * LiveFeedCard.tsx — Echter Live-Video-Preview im Feed (TikTok-Style)
 *
 * Wie TikTok: zeigt den echten Live-Stream direkt im Feed an (gemuted).
 * Beim Drücken öffnet sich die volle Watch-View mit Kommentaren, Input etc.
 *
 * WICHTIG:
 * - height = SCREEN_HEIGHT damit pagingEnabled korrekt snappt
 * - Verbindet LiveKit nur wenn isActive=true (aktuelle Feed-Seite)
 * - Trennt sofort wenn gescrollt wird (isActive=false)
 * - Audio immer muted in Feed-Preview
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Users, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Room } from 'livekit-client';
import { fetchLiveKitToken } from '@/lib/useLiveSession';
import type { LiveSession } from '@/lib/useLiveSession';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

interface Props {
  session: LiveSession;
  isFollowing?: boolean;
  isActive: boolean; // nur verbinden wenn diese Card aktiv im Viewport ist
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
  if (minutes < 1) return 'Gerade live';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// ─── Video-Track von Host anzeigen (innerhalb LiveKitRoom) ────────────────────
function LiveVideoPreview({ hostAvatar }: { hostAvatar?: string | null }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const remoteTrack = tracks.find((t) => !t.participant?.isLocal);

  if (!remoteTrack?.publication?.track) {
    // Kein Track noch → Avatar als Placeholder
    return (
      <View style={StyleSheet.absoluteFill}>
        {hostAvatar ? (
          <Image
            source={{ uri: hostAvatar }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
        )}
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
        </View>
      </View>
    );
  }

  return (
    <VideoTrack
      trackRef={remoteTrack as any}
      style={StyleSheet.absoluteFill as any}
      objectFit="cover"
    />
  );
}

export function LiveFeedCard({ session, isFollowing = false, isActive }: Props) {
  const router = useRouter();
  const host = session.profiles;
  const duration = formatDuration(session.started_at);
  const viewerCount = session.viewer_count ?? 0;
  const commentCount = session.comment_count ?? 0;

  // LiveKit Token + URL State
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [room] = useState(() => new Room({ adaptiveStream: false }));

  // Token laden wenn Card aktiv wird — frischen Token bei jeder Aktivierung holen
  // (LiveKit-Token können ablaufen; beim inaktiv-Werden wird auch Token gecleart)
  useEffect(() => {
    if (!isActive) {
      // Card wird inaktiv: disconnect und Token löschen damit beim nächsten
      // Aktivieren ein frischer Token geholt wird
      room.disconnect().catch(() => {});
      setLkToken(null);
      setLkUrl(null);
      return;
    }
    // Card aktiv: Token holen
    const roomName = session.room_name;
    if (!roomName) return; // room_name noch nicht gesetzt → warten
    fetchLiveKitToken(roomName, false)
      .then((result) => {
        if (result) {
          setLkToken(result.token);
          setLkUrl(result.url);
        }
      })
      .catch(() => {
        // Fehler: Avatar-Fallback bleibt sichtbar — kein Crash
      });
  }, [isActive, session.room_name, room]);

  // ── Blinkender LIVE-Dot ──────────────────────────────────────────────────────
  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  // ── Pulsierender Avatar-Ring ─────────────────────────────────────────────────
  const ringScale = useRef(new RNAnimated.Value(1)).current;
  const ringOpacity = useRef(new RNAnimated.Value(0.85)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.sequence([
          RNAnimated.timing(ringScale, { toValue: 1.2, duration: 900, useNativeDriver: true }),
          RNAnimated.timing(ringScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          RNAnimated.timing(ringOpacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [ringScale, ringOpacity]);

  const handlePress = () => {
    router.push({
      pathname: '/live/watch/[id]' as any,
      params: { id: session.id },
    });
  };

  return (
    <Pressable onPress={handlePress} style={s.container}>

      {/* ── Echter Live-Video oder Avatar-Fallback ── */}
      {isActive && lkToken && lkUrl ? (
        <View style={StyleSheet.absoluteFill}>
          <LiveKitRoom
            room={room}
            serverUrl={lkUrl}
            token={lkToken}
            connect={true}
            audio={false}
            video={false}
          >
            <LiveVideoPreview hostAvatar={host?.avatar_url} />
          </LiveKitRoom>
        </View>
      ) : (
        // Fallback: Avatar als vollbild Hintergrund (vor Token-Load oder inaktiv)
        host?.avatar_url ? (
          <Image
            source={{ uri: host.avatar_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={['#1a0533', '#0d1f4a', '#0A0A0A']}
            style={StyleSheet.absoluteFill}
          />
        )
      )}

      {/* Gradient-Overlay: oben dunkel, Mitte transparent, unten schwarz */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.1)',
          'transparent',
          'rgba(0,0,0,0.75)',
        ]}
        locations={[0, 0.15, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Oben links: @Name + LIVE-Badge ── */}
      <View style={s.topLeft}>
        <View style={s.nameRow}>
          {host?.avatar_url ? (
            <Image source={{ uri: host.avatar_url }} style={s.avatarSmall} contentFit="cover" />
          ) : (
            <View style={[s.avatarSmall, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{host?.username?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <Text style={s.username} numberOfLines={1}>@{host?.username ?? '...'}</Text>
          {isFollowing && <Text style={s.followingBadge}>● Gefolgt</Text>}
        </View>
        {session.title ? (
          <Text style={s.title} numberOfLines={1}>{session.title}</Text>
        ) : null}
      </View>

      {/* ── Oben rechts: LIVE + Stats ── */}
      <View style={s.topRight}>
        <View style={s.livePill}>
          <Animated.View style={[s.liveDot, dotStyle]} />
          <Text style={s.liveLabel}>LIVE</Text>
        </View>
        {viewerCount > 0 && (
          <View style={s.statBadge}>
            <Users size={10} color="#fff" strokeWidth={2.5} />
            <Text style={s.statBadgeText}>{fmtNum(viewerCount)}</Text>
          </View>
        )}
        {commentCount > 0 && (
          <View style={s.statBadge}>
            <MessageCircle size={10} color="#fff" strokeWidth={2.5} />
            <Text style={s.statBadgeText}>{fmtNum(commentCount)}</Text>
          </View>
        )}
      </View>

      {/* ── Unten: "Tippe, um das LIVE anzusehen" (wie TikTok) ── */}
      <View style={s.bottomHint}>
        {/* Pulsierender Avatar-Ring Indikator */}
        <RNAnimated.View
          style={[s.avatarRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        />
        {host?.avatar_url ? (
          <Image source={{ uri: host.avatar_url }} style={s.avatarBottom} contentFit="cover" />
        ) : (
          <View style={[s.avatarBottom, s.avatarFallback]}>
            <Text style={[s.avatarInitial, { fontSize: 20 }]}>{host?.username?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <View style={s.hintTextWrap}>
          <View style={s.hintLiveDot} />
          <Text style={s.hintText}>Tippe, um das LIVE anzusehen</Text>
        </View>
        <Text style={s.durationText}>{duration}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // FULL SCREEN — identisch mit FeedItem für korrektes pagingEnabled
  container: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // ── Oben links ────────────────────────────────────────────────────────────────
  topLeft: {
    position: 'absolute',
    top: 52,
    left: 14,
    gap: 4,
    zIndex: 10,
    maxWidth: SCREEN_W * 0.65,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatarFallback: {
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 12 },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  followingBadge: {
    color: '#FF4D6D',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    marginLeft: 37,
  },

  // ── Oben rechts ───────────────────────────────────────────────────────────────
  topRight: {
    position: 'absolute',
    top: 52,
    right: 14,
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 10,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveLabel: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Unten: TikTok-"Tippe"-Hint ────────────────────────────────────────────────
  bottomHint: {
    position: 'absolute',
    bottom: 110,   // über TabBar
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 10,
  },
  avatarRing: {
    position: 'absolute',
    left: 6,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    borderColor: '#EF4444',
  },
  avatarBottom: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#fff',
    flexShrink: 0,
  },
  hintTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hintLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    flexShrink: 0,
  },
  hintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  durationText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
});

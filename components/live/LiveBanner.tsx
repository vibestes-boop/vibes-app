/**
 * LiveBanner.tsx
 * Horizontaler Streifen oben im Feed der aktive Lives zeigt.
 * Tippen öffnet den Zuschauer-Screen.
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useActiveLiveSessions, type LiveSession } from '@/lib/useLiveSession';

// ─── Pulsierender LIVE-Dot ────────────────────────────────────────────────────
function PulseDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmalig starten
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[dots.dot, style]} />;
}

const dots = StyleSheet.create({ dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' } });

// ─── Einzelne Live-Kachel ─────────────────────────────────────────────────────
function LiveCard({ session }: { session: LiveSession }) {
  const router = useRouter();
  return (
    <Pressable
      style={s.card}
      onPress={() => router.push({ pathname: '/live/watch/[id]', params: { id: session.id } })}
    >
      {/* Avatar mit rotem Ring */}
      <View style={s.avatarWrap}>
        {session.profiles?.avatar_url ? (
          <Image source={{ uri: session.profiles.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitial}>
              {session.profiles?.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <View style={s.liveRing} />
        <View style={s.liveBadge}>
          <PulseDot />
          <Text style={s.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      {/* Username */}
      <Text style={s.username} numberOfLines={1}>
        @{session.profiles?.username ?? 'User'}
      </Text>

      {/* Zuschauer */}
      <Text style={s.viewers}>{session.viewer_count} 👁</Text>
    </Pressable>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export function LiveBanner() {
  const { data: sessions = [] } = useActiveLiveSessions();
  if (sessions.length === 0) return null;

  return (
    <View style={s.banner}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {sessions.map((session) => (
          <LiveCard key={session.id} session={session} />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#0a0010',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.2)',
    paddingVertical: 10,
  },
  scroll: { paddingHorizontal: 16, gap: 14 },

  card: { alignItems: 'center', gap: 4, width: 70 },

  avatarWrap: { position: 'relative', width: 62, height: 62 },
  avatar: { width: 58, height: 58, borderRadius: 29, position: 'absolute', top: 2, left: 2 },
  avatarFallback: { backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 22, fontWeight: '900' },
  liveRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 31,
    borderWidth: 2.5, borderColor: '#EF4444',
  },
  liveBadge: {
    position: 'absolute', bottom: -4, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  username: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  viewers:  { color: 'rgba(255,255,255,0.45)', fontSize: 10 },
});

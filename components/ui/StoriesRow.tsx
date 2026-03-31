import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { StoryGroup } from '@/lib/useStories';
import type { LiveSession } from '@/lib/useLiveSession';
import { useAuthStore } from '@/lib/authStore';

type Props = {
  groups: StoryGroup[];
  onSelectGroup: (group: StoryGroup) => void;
  onAddStory: () => void;
  liveSessions?: LiveSession[];
  /** Wenn gesetzt: rendert als absolut positioniertes Overlay bei `top=overlayTop` */
  overlayTop?: number;
};

// ─── Live-Bubble (roter pulsierender Ring) ────────────────────────────────────
function LiveBubble({ session, isOwn }: { session: LiveSession; isOwn: boolean }) {
  const router = useRouter();
  const initial = (session.profiles?.username ?? '?')[0].toUpperCase();

  // Pulsierender roter Ring
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.85);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.75, { duration: 600 })),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      // Eigenes Live → Alert statt Watch-Screen öffnen
      // (Host ist bereits im host.tsx Screen wenn er live ist)
      const { Alert } = require('react-native') as typeof import('react-native');
      Alert.alert(
        '🔴 Du bist LIVE',
        'Du streamst gerade. Kehre zur Host-Ansicht zurück?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Host-Ansicht öffnen',
            onPress: () => router.push({
              pathname: '/live/host' as any,
              params: { sessionId: session.id },
            }),
          },
        ]
      );
      return;
    }
    router.push({ pathname: '/live/watch/[id]', params: { id: session.id } });
  };

  return (
    <Pressable style={styles.bubble} onPress={handlePress}>
      {/* Ring-Glow (statisch, roter Schatten-Effekt) */}
      <View style={styles.liveGlow} />

      <Animated.View style={[styles.liveRingWrap, ringStyle]}>
        {/* Äußerer pulsierender roter Ring */}
        <View style={styles.liveRing}>
          <View style={styles.ringInner}>
            {session.profiles?.avatar_url ? (
              <Image source={{ uri: session.profiles.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* LIVE-Badge */}
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>

      <Text style={styles.liveBubbleLabel} numberOfLines={1}>
        {isOwn ? 'Du bist LIVE' : `@${session.profiles?.username ?? '?'}`}
      </Text>
    </Pressable>
  );
}

// ─── Story-Bubble ─────────────────────────────────────────────────────────────
function StoryBubble({
  group,
  isOwn,
  onPress,
}: {
  group: StoryGroup;
  isOwn: boolean;
  onPress: () => void;
}) {
  const initial = (group.username ?? '?')[0].toUpperCase();
  const hasNew = group.hasUnviewed;
  const ringColor = hasNew
    ? ['#22D3EE', '#F472B6'] as [string, string]
    : ['#2D2D2D', '#2D2D2D'] as [string, string];

  const glow = useSharedValue(1);
  useEffect(() => {
    if (!hasNew) { glow.value = 1; return; }
    glow.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 250, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 250, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [hasNew, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glow.value }],
  }));

  return (
    <Pressable
      style={styles.bubble}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={glowStyle}>
        <LinearGradient
          colors={ringColor}
          style={styles.ring}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.ringInner}>
            {group.avatar_url ? (
              <Image source={{ uri: group.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      <Text style={[styles.bubbleLabel, hasNew && styles.bubbleLabelNew]} numberOfLines={1}>
        {isOwn ? 'Deine Story' : `@${group.username ?? '?'}`}
      </Text>
    </Pressable>
  );
}

// ─── Add-Story-Bubble ──────────────────────────────────────────────────────────
function AddStoryBubble({ onPress }: { onPress: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const initial = (profile?.username ?? '?')[0].toUpperCase();

  return (
    <Pressable
      style={styles.bubble}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={[styles.ring, styles.addRing]}>
        <View style={styles.ringInner}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.addBadge}>
        <Plus size={10} color="#fff" strokeWidth={3} />
      </View>
      <Text style={styles.bubbleLabel} numberOfLines={1}>
        Deine Story
      </Text>
    </Pressable>
  );
}

// ─── StoriesRow (Haupt-Export) ────────────────────────────────────────────────
export function StoriesRow({ groups, onSelectGroup, onAddStory, liveSessions = [], overlayTop }: Props) {
  const userId = useAuthStore((s) => s.profile?.id);
  const ownGroup = groups.find((g) => g.userId === userId);
  const otherGroups = groups.filter((g) => g.userId !== userId);

  // Zweite Sicherheitsschicht: Deduplizierung nach host_id, falls die Datenquelle
  // dennoch mehrere Sessions desselben Hosts liefert (Zombie-Sessions)
  const uniqueLiveSessions = useMemo(() => {
    const seen = new Set<string>();
    return liveSessions.filter((s) => {
      if (seen.has(s.host_id)) return false;
      seen.add(s.host_id);
      return true;
    });
  }, [liveSessions]);

  const ownLive = uniqueLiveSessions.find((s) => s.host_id === userId);
  const otherLive = uniqueLiveSessions.filter((s) => s.host_id !== userId);

  const containerStyle = overlayTop !== undefined
    ? [styles.scroll, {
      position: 'absolute' as const,
      top: overlayTop,
      left: 0,
      right: 0,
      zIndex: 25,
      backgroundColor: 'rgba(0,0,0,0.55)',
    }]
    : styles.scroll;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={containerStyle}
      contentContainerStyle={styles.scrollContent}
    >
      {/* 1. Eigener Add-Story-Button (immer da) */}
      <AddStoryBubble onPress={onAddStory} />

      {/* 2. Eigene Live-Bubble (falls User gerade live ist) */}
      {ownLive && <LiveBubble key={`live-own-${ownLive.id}`} session={ownLive} isOwn />}

      {/* 3. Eigene Story (falls vorhanden) */}
      {ownGroup && (
        <StoryBubble
          group={ownGroup}
          isOwn
          onPress={() => onSelectGroup(ownGroup)}
        />
      )}

      {/* 4. Andere Live-User — immer VOR normalen Stories */}
      {otherLive.map((session) => (
        <LiveBubble key={`live-${session.id}`} session={session} isOwn={false} />
      ))}

      {/* 5. Normale Stories */}
      {otherGroups.map((group) => (
        <StoryBubble
          key={group.userId}
          group={group}
          isOwn={false}
          onPress={() => onSelectGroup(group)}
        />
      ))}
    </ScrollView>
  );
}

const BUBBLE_SIZE = 62;

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bubble: {
    alignItems: 'center',
    width: BUBBLE_SIZE + 8,
    position: 'relative',
  },

  // ── Live-Bubble-Styles ────────────────────────────────────────────────
  liveGlow: {
    position: 'absolute',
    top: 4,
    width: BUBBLE_SIZE + 4,
    height: BUBBLE_SIZE + 4,
    borderRadius: (BUBBLE_SIZE + 4) / 2,
    backgroundColor: 'rgba(239,68,68,0.25)',
    // iOS shadow für Glow-Effekt
    shadowColor: '#EF4444',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  liveRingWrap: {
    // Wrapper für die Animation
  },
  liveRing: {
    width: BUBBLE_SIZE + 4,
    height: BUBBLE_SIZE + 4,
    borderRadius: (BUBBLE_SIZE + 4) / 2,
    backgroundColor: '#EF4444',
    padding: 3,
    // Doppelter Border-Effekt
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0A0A0A',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveBubbleLabel: {
    marginTop: 5,
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
    maxWidth: BUBBLE_SIZE + 8,
    textAlign: 'center',
  },

  // ── Story-Bubble-Styles ───────────────────────────────────────────────
  ring: {
    width: BUBBLE_SIZE + 4,
    height: BUBBLE_SIZE + 4,
    borderRadius: (BUBBLE_SIZE + 4) / 2,
    padding: 2.5,
  },
  addRing: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ringInner: {
    flex: 1,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#0A0A0A',
    padding: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: BUBBLE_SIZE / 2,
  },
  avatarFallback: {
    backgroundColor: 'rgba(34,211,238,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22D3EE',
  },
  addBadge: {
    position: 'absolute',
    bottom: 20,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  bubbleLabel: {
    marginTop: 5,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    maxWidth: BUBBLE_SIZE + 8,
    textAlign: 'center',
  },
  bubbleLabelNew: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
});

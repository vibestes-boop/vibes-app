import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
// react-native-reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
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


// ─── Story-Bubble (mit optionalem Live-Override — TikTok-Prinzip) ─────────────
// Wenn liveSession gesetzt → roter LIVE-Ring statt Story-Ring, Klick → Live
function StoryBubble({
  group,
  isOwn,
  onPress,
  liveSession,
}: {
  group: StoryGroup;
  isOwn: boolean;
  onPress: () => void;
  liveSession?: LiveSession; // gesetzt wenn dieser User gerade live ist
}) {
  const router = useRouter();
  const initial = (group.username ?? '?')[0].toUpperCase();
  const isLive = !!liveSession;
  const hasNew = group.hasUnviewed;

  // Animations-Werte für Story-Ring
  const glow = useSharedValue(1);
  // Animations-Werte für Live-Ring
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    if (isLive) {
      // Pulsierender roter Ring (Live)
      scale.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.75, { duration: 600 })),
        -1, false,
      );
    } else if (hasNew) {
      // Pulsierender Story-Ring
      glow.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 250, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 250, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      );
    } else {
      glow.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, hasNew]);

  const liveRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glow.value }],
  }));

  const ringColor = hasNew
    ? ['#22D3EE', '#F472B6'] as [string, string]
    : ['#2D2D2D', '#2D2D2D'] as [string, string];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLive && liveSession) {
      if (isOwn) {
        // Eigenes Live → Alert
        const { Alert } = require('react-native') as typeof import('react-native');
        Alert.alert(
          '🔴 Du bist LIVE',
          'Du streamst gerade. Kehre zur Host-Ansicht zurück?',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Host-Ansicht', onPress: () => router.push({ pathname: '/live/host' as any, params: { sessionId: liveSession.id } }) },
          ]
        );
      } else {
        router.push({ pathname: '/live/watch/[id]', params: { id: liveSession.id } });
      }
    } else {
      onPress();
    }
  };

  return (
    <Pressable style={styles.bubble} onPress={handlePress}>
      {isLive ? (
        // ── Live-Ring ──────────────────────────────────────────────────────────
        <>
          {/* Radial Glow hinter der Bubble */}
          <View style={styles.liveGlow} />
          <Animated.View style={[styles.liveRingWrap, liveRingStyle]}>
            <LinearGradient
              colors={['#FF4444', '#FF8C00', '#FF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.liveRing}
            >
              <View style={styles.ringInner}>
                {group.avatar_url ? (
                  <Image source={{ uri: group.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
          {/* LIVE-Badge — Pill mit Dot */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </>
      ) : (
        // ── Story-Ring ─────────────────────────────────────────────────────────
        <Animated.View style={glowStyle}>
          <LinearGradient
            colors={ringColor}
            style={styles.ring}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.ringInner}>
              {group.avatar_url ? (
                <Image source={{ uri: group.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      <Text
        style={[
          isLive ? styles.liveBubbleLabel : styles.bubbleLabel,
          !isLive && hasNew && styles.bubbleLabelNew,
        ]}
        numberOfLines={1}
      >
        {isOwn
          ? (isLive ? '🔴 Du bist LIVE' : 'Deine Story')
          : `@${group.username ?? '?'}`}
      </Text>
      {isLive && liveSession && (liveSession.viewer_count ?? 0) > 0 && (
        <Text style={styles.liveViewerCount}>
          {liveSession.viewer_count} 👁
        </Text>
      )}
    </Pressable>
  );
}

// ─── Standalone Live-Bubble (nur für User ohne Story) ────────────────────────
function LiveOnlyBubble({ session, isOwn }: { session: LiveSession; isOwn: boolean }) {
  const router = useRouter();
  const initial = (session.profiles?.username ?? '?')[0].toUpperCase();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.75, { duration: 600 })),
      -1, false,
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
      const { Alert } = require('react-native') as typeof import('react-native');
      Alert.alert(
        '🔴 Du bist LIVE',
        'Du streamst gerade. Kehre zur Host-Ansicht zurück?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Host-Ansicht öffnen', onPress: () => router.push({ pathname: '/live/host' as any, params: { sessionId: session.id } }) },
        ]
      );
      return;
    }
    router.push({ pathname: '/live/watch/[id]', params: { id: session.id } });
  };

  return (
    <Pressable style={styles.bubble} onPress={handlePress}>
      <View style={styles.liveGlow} />
      <Animated.View style={[styles.liveRingWrap, ringStyle]}>
        <LinearGradient
          colors={['#FF4444', '#FF8C00', '#FF4444']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.liveRing}
        >
          <View style={styles.ringInner}>
            {session.profiles?.avatar_url ? (
              <Image source={{ uri: session.profiles.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
      {/* LIVE-Badge — Pill mit Dot */}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
      <Text style={styles.liveBubbleLabel} numberOfLines={1}>
        {isOwn ? '🔴 Du bist LIVE' : `@${session.profiles?.username ?? '?'}`}
      </Text>
      {(session.viewer_count ?? 0) > 0 && (
        <Text style={styles.liveViewerCount}>
          {session.viewer_count} 👁
        </Text>
      )}
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

  // Deduplizierung nach host_id (Zombie-Session-Schutz)
  const uniqueLiveSessions = useMemo(() => {
    const seen = new Set<string>();
    return liveSessions.filter((s) => {
      if (seen.has(s.host_id)) return false;
      seen.add(s.host_id);
      return true;
    });
  }, [liveSessions]);

  // Lookup: userId → LiveSession (für schnelles Mergen mit Stories)
  const liveByUserId = useMemo(() => {
    const map = new Map<string, LiveSession>();
    for (const s of uniqueLiveSessions) map.set(s.host_id, s);
    return map;
  }, [uniqueLiveSessions]);

  const ownLive = userId ? liveByUserId.get(userId) : undefined;

  // Live-User die KEINE Story haben → separater LiveOnlyBubble
  const storyUserIds = new Set(groups.map((g) => g.userId));
  const liveOnlyOther = uniqueLiveSessions.filter(
    (s) => s.host_id !== userId && !storyUserIds.has(s.host_id)
  );

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
      {/* 1. Eigener Add-Story-Button */}
      <AddStoryBubble onPress={onAddStory} />

      {/* 2. Eigene Story (mit Live-Override falls live) */}
      {ownGroup && (
        <StoryBubble
          key={`own-story-${ownGroup.userId}`}
          group={ownGroup}
          isOwn
          onPress={() => {
            // Eigene Stories sofort prefetchen beim Antippen
            ownGroup.stories
              .filter((s) => s.media_type !== 'video' && s.media_url)
              .forEach((s) => Image.prefetch?.(s.media_url!).catch(() => { }));
            onSelectGroup(ownGroup);
          }}
          liveSession={ownLive}
        />
      )}

      {/* Eigenes Live OHNE Story → separater LiveOnlyBubble */}
      {ownLive && !ownGroup && (
        <LiveOnlyBubble key={`live-own-${ownLive.id}`} session={ownLive} isOwn />
      )}

      {/* 3. Andere Live-User die KEINE Story haben → vor normalen Stories */}
      {liveOnlyOther.map((session) => (
        <LiveOnlyBubble key={`live-only-${session.id}`} session={session} isOwn={false} />
      ))}

      {/* 4. Andere Stories — mit Live-Override wenn der Story-User auch live ist */}
      {otherGroups.map((group) => (
        <StoryBubble
          key={group.userId}
          group={group}
          isOwn={false}
          onPress={() => {
            // Alle Story-Bilder sofort prefetchen beim Antippen — kein 2s Ladedelay
            group.stories
              .filter((s) => s.media_type !== 'video' && s.media_url)
              .forEach((s) => Image.prefetch?.(s.media_url!).catch(() => { }));
            onSelectGroup(group);
          }}
          liveSession={liveByUserId.get(group.userId)}
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
    width: BUBBLE_SIZE + 28,
    height: BUBBLE_SIZE + 28,
    borderRadius: (BUBBLE_SIZE + 28) / 2,
    backgroundColor: 'transparent',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  liveRingWrap: {
    // Wrapper für die Animation
  },
  liveRing: {
    width: BUBBLE_SIZE + 6,
    height: BUBBLE_SIZE + 6,
    borderRadius: (BUBBLE_SIZE + 6) / 2,
    padding: 3,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#0A0A0A',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
    opacity: 0.95,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  liveBubbleLabel: {
    marginTop: 5,
    fontSize: 11,
    color: '#FF6B6B',
    fontWeight: '700',
    maxWidth: BUBBLE_SIZE + 12,
    textAlign: 'center',
  },
  liveViewerCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
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
    overflow: 'hidden',
    // kein Background/Padding → kein schwarzer Spalt zwischen Ring und Avatar
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import {
  Heart,
  Share2,
  Repeat2,
  MoreVertical,
  UserCheck,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { useLike } from '@/lib/useLike';
import { useFollow } from '@/lib/useFollow';
import { useRepost } from '@/lib/useRepost';
import { useAuthStore } from '@/lib/authStore';
import type { FeedEngagementMaps } from '@/lib/useFeedEngagement';
import type { UseLikeBatch } from '@/lib/useLike';
import type { StoryGroup } from '@/lib/useStories';
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
import { PostShareModal } from './PostShareModal';
import { PostOptionsModal } from './PostOptionsModal';
import PostLongPressSheet from './PostLongPressSheet';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO } from './FeedVideo';
import {
  ActionButton,
  BookmarkButton,
  CommentButton,
  LikeButton,
} from './FeedActionButtons';
import { feedItemStyles as styles } from './feedStyles';
import type { FeedItemData } from './types';

// ─── Floating Heart — eigenständige Komponente pro Tap ────────────────────────
type FloatingHeartItem = { id: number; x: number; y: number };

function FloatingHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const scale = useSharedValue(0);
  const floatY = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.5, { damping: 7, stiffness: 220 }),
      withTiming(1.15, { duration: 150, easing: Easing.out(Easing.cubic) })
    );
    floatY.value = withTiming(-110, { duration: 1700, easing: Easing.out(Easing.quad) });
    rot.value = withRepeat(
      withSequence(withTiming(-8, { duration: 180 }), withTiming(8, { duration: 180 })),
      4, true
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(900, withTiming(0, { duration: 800 }))
    );
    const t = setTimeout(onDone, 1750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x - 60 },
      { translateY: y - 60 + floatY.value },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', width: 120, height: 120, left: 0, top: 0 }, style]}
      pointerEvents="none"
    >
      <Heart size={90} color="#EE1D52" fill="#EE1D52" />
    </Animated.View>
  );
}

export const FeedItem = React.memo(function FeedItem({
  item,
  shouldPlayVideo,
  isMuted,
  onMuteToggle,
  storyGroup,
  onOpenStory,
  onOpenTune,
  engagement,
}: {
  item: FeedItemData;
  shouldPlayVideo: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  storyGroup?: StoryGroup;
  onOpenStory?: (g: StoryGroup) => void;
  onOpenTune?: () => void;
  engagement: FeedEngagementMaps;
}) {
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageError, setImageError] = useState(false);
  const isVideo = item.mediaType === 'video';

  const currentUserId = useAuthStore((s) => s.profile?.id);
  const likeBatch: UseLikeBatch = {
    liked: engagement.likedByPost[item.id] ?? false,
    count: engagement.likeCountByPost[item.id] ?? 0,
  };
  const followBatch =
    item.authorId && item.authorId !== currentUserId
      ? (engagement.followingByAuthor[item.authorId] ?? false)
      : undefined;
  const { isFollowing, toggle: toggleFollow, isOwnProfile } = useFollow(item.authorId ?? null, followBatch);

  const lastTap = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { liked, formattedCount: likeFormatted, toggle: toggleLike } = useLike(item.id, likeBatch);
  const { isReposted, count: repostCount, toggle: toggleRepost } = useRepost(item.id);

  const [hearts, setHearts] = useState<FloatingHeartItem[]>([]);
  const heartIdRef = useRef(0);
  // Pause/Play via Tap
  const [isPaused, setIsPaused] = useState(false);
  const [showPlayFlash, setShowPlayFlash] = useState<'pause' | 'play' | null>(null);

  // Wenn Video aus dem Viewport verschwindet → Pause-State zurücksetzen
  const prevShouldPlay = useRef(shouldPlayVideo);
  if (prevShouldPlay.current !== shouldPlayVideo) {
    prevShouldPlay.current = shouldPlayVideo;
    if (!shouldPlayVideo && isPaused) setIsPaused(false);
  }

  const actualShouldPlay = shouldPlayVideo && !isPaused && !commentsOpen && !shareOpen && !optionsOpen && !longPressOpen;


  const spawnHeart = useCallback((x: number, y: number) => {
    const newId = heartIdRef.current++;
    setHearts((prev) => [...prev, { id: newId, x, y }]);
  }, []);

  const handleTap = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 250;
    const pos = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // — Doppel-Tap: Like + Herz —
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
      if (!liked) {
        toggleLike();
        notificationAsync(NotificationFeedbackType.Success);
      }
      spawnHeart(lastTapPos.current.x, lastTapPos.current.y);
      lastTap.current = 0;
      return;
    }

    lastTap.current = now;
    lastTapPos.current = pos;

    // — Einfacher Tap: bei Video Pause/Play togglen (wie Instagram Reels) —
    if (isVideo) {
      navTimeoutRef.current = setTimeout(() => {
        navTimeoutRef.current = null;
        setIsPaused((p) => {
          const next = !p;
          // Kurzes visuelles Feedback (800ms)
          setShowPlayFlash(next ? 'pause' : 'play');
          setTimeout(() => setShowPlayFlash(null), 700);
          return next;
        });
      }, DOUBLE_TAP_DELAY + 10);
    }
    // Bei Bildern: nichts tun beim einfachen Tap
  };

  const handleProgress = useCallback((p: number) => setProgress(p), []);

  return (
    <View style={styles.feedItem}>
      {/* ── Hintergrund: Bild DIREKT in feedItem */}
      {item.mediaUrl && !isVideo && !imageError && (
        <Image
          source={{ uri: item.mediaUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setImageError(true)}
        />
      )}
      {(!item.mediaUrl || imageError) && (
        <LinearGradient
          colors={item.gradient as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      )}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleTap as any}
        onLongPress={() => {
          impactAsync(ImpactFeedbackStyle.Heavy);
          setLongPressOpen(true);
        }}
        delayLongPress={380}
        accessibilityRole="button"
        accessibilityLabel={isVideo ? 'Doppeltippen zum Liken, gedrückt halten für Optionen' : 'Doppeltippen zum Liken, gedrückt halten für Optionen'}
      >
        {item.mediaUrl && isVideo && (
          USE_EXPO_VIDEO ? (
            <NativeFeedVideo
              uri={item.mediaUrl}
              shouldPlay={actualShouldPlay}
              isMuted={isMuted}
              onProgress={handleProgress}
            />
          ) : (
            <FallbackFeedVideo
              uri={item.mediaUrl}
              shouldPlay={actualShouldPlay}
              isMuted={isMuted}
              onProgress={handleProgress}
            />
          )
        )}

        {!item.mediaUrl && (
          <View style={styles.patternOverlay}>
            <Text style={[styles.bigEmoji, { opacity: 0.06 }]}>
              {'◆ ◈ ◇ ◆ ◈\n◈ ◇ ◆ ◈ ◇\n◆ ◈ ◇ ◆ ◈\n◈ ◇ ◆ ◈ ◇'}
            </Text>
          </View>
        )}

        {/* Floating Hearts */}
        {hearts.map((h) => (
          <FloatingHeart
            key={h.id}
            x={h.x}
            y={h.y}
            onDone={() => setHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
          />
        ))}

        {/* Pause/Play Flash — kurzes visuelles Feedback beim Tap (wie Instagram Reels) */}
        {showPlayFlash !== null && (
          <View style={feedFlashStyles.flashWrap} pointerEvents="none">
            {showPlayFlash === 'pause'
              ? <Pause size={34} color="#fff" fill="#fff" strokeWidth={0} />
              : <Play size={34} color="#fff" fill="#fff" strokeWidth={0} />}
          </View>
        )}

        {/* Sound-Button — unten rechts auf dem Video, wie Instagram */}
        {isVideo && (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onMuteToggle(); }}
            style={styles.muteBtn}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
          >
            <View style={styles.muteBtnInner}>
              {isMuted
                ? <VolumeX size={16} color="#fff" strokeWidth={2.2} />
                : <Volume2 size={16} color="#fff" strokeWidth={2.2} />}
            </View>
          </Pressable>
        )}
      </Pressable>

      <PostShareModal
        visible={shareOpen}
        postId={item.id}
        postCaption={item.caption}
        postAuthor={item.author}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        onToggleFollow={() => {
          toggleFollow();
          notificationAsync(NotificationFeedbackType.Success);
        }}
        onClose={() => setShareOpen(false)}
      />

      <PostOptionsModal
        visible={optionsOpen}
        postId={item.id}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        authorName={item.author}
        onToggleFollow={() => {
          toggleFollow();
          notificationAsync(NotificationFeedbackType.Success);
        }}
        onOpenTune={() => onOpenTune?.()}
        onClose={() => setOptionsOpen(false)}
      />

      <PostLongPressSheet
        visible={longPressOpen}
        onClose={() => setLongPressOpen(false)}
        postId={item.id}
        mediaUrl={item.mediaUrl}
        authorId={item.authorId}
        authorName={item.author}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        onToggleFollow={() => {
          toggleFollow();
          notificationAsync(NotificationFeedbackType.Success);
        }}
        onOpenComments={() => setCommentsOpen(true)}
        onOpenShare={() => setShareOpen(true)}
      />

      <CommentsSheet
        postId={item.id}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        mediaUrl={item.mediaUrl}
        mediaType={item.mediaType}
        onUserPress={(userId) => {
          setCommentsOpen(false);
          router.push({ pathname: '/user/[id]', params: { id: userId } });
        }}
      />

      <View style={styles.bottomInfo} pointerEvents="box-none">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.tagBadge}>
          <View style={[styles.tagDot, { backgroundColor: item.accentColor }]} />
          <Text style={[styles.tagText, { color: item.accentColor }]}>{item.tag}</Text>
        </View>
        {/* ── Avatar + Name (horizontal) ── */}
        <View style={styles.authorRow}>
          <Pressable
            onPress={() => {
              if (storyGroup && onOpenStory) {
                impactAsync(ImpactFeedbackStyle.Light);
                onOpenStory(storyGroup);
              } else if (item.authorId) {
                router.push({ pathname: '/user/[id]', params: { id: item.authorId } });
              }
            }}
            hitSlop={8}
            style={styles.authorAvatarWrap}
          >
            {storyGroup ? (
              storyGroup.hasUnviewed ? (
                <LinearGradient
                  colors={['#22D3EE', '#F472B6', '#FB923C']}
                  style={styles.storyRingGradient}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.storyRingGap}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.authorAvatar} />
                    ) : (
                      <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                        <Text style={styles.authorAvatarInitial}>{(item.author[1] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.storyRingViewed}>
                  <View style={styles.storyRingGap}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.authorAvatar} />
                    ) : (
                      <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                        <Text style={styles.authorAvatarInitial}>{(item.author[1] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            ) : item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Text style={styles.authorAvatarInitial}>{(item.author[1] ?? '?').toUpperCase()}</Text>
              </View>
            )}
            {!isOwnProfile && (
              <Pressable
                onPress={() => {
                  impactAsync(ImpactFeedbackStyle.Light);
                  toggleFollow();
                }}
                style={[styles.followBadge, isFollowing && styles.followBadgeActive]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? `${item.author} entfolgen` : `${item.author} folgen`}
                accessibilityState={{ selected: isFollowing }}
              >
                {isFollowing ? <UserCheck size={10} color="#fff" /> : <Text style={styles.followBadgePlus}>+</Text>}
              </Pressable>
            )}
          </Pressable>
          <Pressable
            onPress={() => item.authorId && router.push({ pathname: '/user/[id]', params: { id: item.authorId } })}
            hitSlop={8}
          >
            <Text style={styles.authorName}>{item.author}</Text>
          </Pressable>
        </View>

        {/* ── Caption + Hashtags — vertikal unterhalb des Nicknamens (TikTok-Style) ── */}
        {(item.caption || (item.tags && item.tags.length > 0)) && (
          <View style={styles.captionBlock}>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text>
            ) : null}
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {item.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tag } } as any)}
                    hitSlop={6}
                  >
                    <Text style={styles.authorTags}>#{tag}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {isVideo && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { transform: [{ scaleX: progress }], transformOrigin: 'left' }]} />
          </View>
        )}
      </View>

      <View style={styles.rightActions}>
        {/* Mute-Button ist jetzt auf dem Video (s.o.) — hier entfernt */}
        <LikeButton
          accentColor={item.accentColor}
          liked={liked}
          formattedCount={likeFormatted}
          onToggle={toggleLike}
        />
        <CommentButton
          postId={item.id}
          onPress={() => setCommentsOpen(true)}
          batchCount={engagement.commentCountByPost[item.id]}
        />
        <BookmarkButton postId={item.id} batchBookmarked={engagement.bookmarkedByPost[item.id]} />
        {/* Repost — nur bei fremden Posts */}
        {!isOwnProfile && (
          <ActionButton
            icon={Repeat2}
            accessibilityLabel={isReposted ? 'Repost rückgängig' : 'Post reposten'}
            count={repostCount > 0 ? String(repostCount) : undefined}
            active={isReposted}
            activeColor="#22D3EE"
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Medium);
              toggleRepost();
            }}
          />
        )}
        <ActionButton
          icon={Share2}
          accessibilityLabel="Post teilen"
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            setShareOpen(true);
          }}
        />
        <ActionButton
          icon={MoreVertical}
          accessibilityLabel="Weitere Optionen"
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            setOptionsOpen(true);
          }}
        />
      </View>
    </View>
  );
});

// Pause/Play Flash-Feedback Styles (wie Instagram Reels)
const feedFlashStyles = StyleSheet.create({
  flashWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
});

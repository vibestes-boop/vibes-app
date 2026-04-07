import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
} from 'react-native-reanimated';
import { Users, MessageCircle, Heart, Bookmark, Share2, Clock, Play, VolumeX, Volume2 } from 'lucide-react-native';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO } from '@/components/feed/FeedVideo';
import { useLike } from '@/lib/useLike';
import { useCommentCount } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { sharePost } from '@/lib/useShare';
import type { GuildPost } from '@/lib/usePosts';
import { guildStyles as styles } from './guildStyles';
import { useVideoMute } from '@/lib/useVideoPreferences';
import { StoryRingAvatar } from '@/components/ui/StoryRingAvatar';

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  return `vor ${Math.floor(hrs / 24)} Tagen`;
}

export const GuildCard = React.memo(function GuildCard({
  post,
  guildColors,
  isVisible = false,
}: {
  post: GuildPost;
  guildColors: [string, string];
  isVisible?: boolean;
}) {
  const router = useRouter();
  const { liked, count, toggle } = useLike(post.id, { liked: post.is_liked, count: post.like_count });
  const { data: commentCount = 0 } = useCommentCount(post.id, post.comment_count);
  const { bookmarked, toggle: toggleBookmark } = useBookmark(post.id);
  const [showComments, setShowComments] = useState(false);
  const { isMuted, toggleMute } = useVideoMute(); // Global: alle GuildCards teilen denselben Zustand
  const isVideo = post.media_type === 'video';
  const scale = useSharedValue(1);
  const [c0, c1] = guildColors;

  // Gecachte Farb-Arrays — verhindert LinearGradient-Rerender durch neue Array-Referenzen
  const bgGradientColors = useMemo(() => [`${c0}30`, '#0D0D12', `${c1}20`] as [string, string, string], [c0, c1]);
  const overlayGradientColors = useMemo(() => [`${c0}40`, '#0D0D12', `${c1}30`] as [string, string, string], [c0, c1]);
  const badgeBgColor = useMemo(() => `${c0}33`, [c0]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLike = useCallback(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 80 }),
      withTiming(1, { duration: 100 })
    );
    toggle();
  }, [toggle, scale]);

  const initials = post.username ? post.username.slice(0, 2).toUpperCase() : '??';

  // Prefetch das Bild wenn die Karte sichtbar wird — schnelleres Laden in der Detailseite
  useEffect(() => {
    if (isVisible && post.media_url && !isVideo) {
      Image.prefetch?.(post.media_url).catch(() => { /* ignorieren */ });
    }
  }, [isVisible, post.media_url, isVideo]);

  return (
    // BlurView entfernt — verursachte intermittierend schwarzen Screen in Listen
    // Ersatz: View mit solider dunkler Farbe + subtiler Rand (optisch gleich)
    <View style={styles.card}>
      <View style={styles.cardBlur}>

        {/* Header */}
        <View style={styles.cardHeader}>
          <StoryRingAvatar
            userId={post.author_id}
            avatarUrl={post.avatar_url}
            size={40}
            initials={initials}
            fallbackColors={guildColors}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author_id } })}
          />
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author_id } })}
              hitSlop={8}
            >
              <Text style={styles.username}>{post.username ?? 'Unbekannt'}</Text>
            </Pressable>
            <View style={styles.metaRow}>
              <Clock size={11} color="#6B7280" />
              <Text style={styles.metaText}>{formatRelativeTime(post.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.guildBadge, { backgroundColor: badgeBgColor }]}>
            <Users size={10} color={c0} />
            <Text style={[styles.guildBadgeText, { color: c0 }]}>Pod</Text>
          </View>
        </View>

        {/* Media — Tap → immer zur Post-Detail (Instagram-Style) */}
        {post.media_url ? (
          <Pressable
            onPress={() => router.push({ pathname: '/guild-post/[id]', params: { id: post.id } })}
            style={styles.mediaWrap}
          >
            {/* Gradient-Hintergrund — verhindert schwarzes Fenster beim Laden */}
            <LinearGradient
              colors={bgGradientColors}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />

            {isVideo ? (
              <>
                {USE_EXPO_VIDEO ? (
                  <NativeFeedVideo
                    uri={post.media_url}
                    shouldPlay={isVisible}
                    isMuted={isMuted}
                    onProgress={() => { }}
                  />
                ) : (
                  <FallbackFeedVideo
                    uri={post.media_url}
                    shouldPlay={isVisible}
                    isMuted={isMuted}
                    onProgress={() => { }}
                  />
                )}
                {/* Mute/Unmute Button — rechts oben */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  style={v.muteBtn}
                  hitSlop={12}
                >
                  {isMuted
                    ? <VolumeX size={16} color="#fff" />
                    : <Volume2 size={16} color="#fff" />
                  }
                </Pressable>
              </>
            ) : (
              <Image source={{ uri: post.media_url }} style={styles.mediaThumb} contentFit="cover" />

            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Pressable>
        ) : (
          /* Post ohne Media: Gradient-Fläche */
          <View style={[styles.mediaWrap, v.noMediaWrap]}>
            <LinearGradient
              colors={overlayGradientColors}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />
            <Text style={[v.noMediaIcon, { color: c0 }]}>✦</Text>
          </View>
        )}

        {/* Action-Buttons */}
        <View style={styles.actions}>
          <Animated.View style={animatedStyle}>
            <Pressable onPress={handleLike} style={styles.actionBtn} hitSlop={10}>
              <Heart
                size={22}
                color={liked ? '#F43F5E' : '#9CA3AF'}
                fill={liked ? '#F43F5E' : 'transparent'}
              />
              <Text style={[styles.actionCount, liked && { color: '#F43F5E' }]}>{count}</Text>
            </Pressable>
          </Animated.View>

          <Pressable onPress={() => setShowComments(true)} style={styles.actionBtn} hitSlop={10}>
            <MessageCircle size={22} color="#9CA3AF" />
            <Text style={styles.actionCount}>
              {commentCount >= 1000 ? `${(commentCount / 1000).toFixed(1)}K` : commentCount}
            </Text>
          </Pressable>

          <Pressable onPress={toggleBookmark} style={styles.actionBtn} hitSlop={10}>
            <Bookmark
              size={22}
              color={bookmarked ? '#FBBF24' : '#9CA3AF'}
              fill={bookmarked ? '#FBBF24' : 'transparent'}
            />
          </Pressable>

          <Pressable onPress={() => sharePost(post.id, post.caption)} style={styles.actionBtn} hitSlop={10}>
            <Share2 size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Caption */}
        {post.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.captionUser}>{post.username ?? 'Unbekannt'} </Text>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {post.tags && post.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {post.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

      </View>

      <CommentsSheet
        postId={post.id}
        visible={showComments}
        onClose={() => setShowComments(false)}
        onUserPress={(userId) => {
          setShowComments(false);
          router.push({ pathname: '/user/[id]', params: { id: userId } });
        }}
      />
    </View>
  );
});

// Lokale Styles (Video / Media Overlays)
const v = StyleSheet.create({
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: 5,
  },
  muteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 7,
    zIndex: 10,
  },
  noMediaWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMediaIcon: {
    fontSize: 64,
    opacity: 0.25,
  },
});

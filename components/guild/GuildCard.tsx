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
import { MessageCircle, Heart, Bookmark, Share2, VolumeX, Volume2 } from 'lucide-react-native';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO } from '@/components/feed/FeedVideo';
import { useLike } from '@/lib/useLike';
import { useCommentCount } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { sharePost } from '@/lib/useShare';
import type { GuildPost } from '@/lib/usePosts';
import { getGuildStyles } from './guildStyles';
import { useVideoMute } from '@/lib/useVideoPreferences';
import { useTheme } from '@/lib/useTheme';

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
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
  const { colors } = useTheme();
  const styles = getGuildStyles(colors);
  const { liked, count, toggle } = useLike(post.id, { liked: post.is_liked, count: post.like_count });
  const { data: commentCount = 0 } = useCommentCount(post.id, post.comment_count);
  const { bookmarked, toggle: toggleBookmark } = useBookmark(post.id);
  const [showComments, setShowComments] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const { isMuted, toggleMute } = useVideoMute();
  const isVideo = post.media_type === 'video';
  const scale = useSharedValue(1);
  const [c0, c1] = guildColors;

  const bgGradientColors = useMemo(() => [`${c0}30`, colors.bg.elevated, `${c1}20`] as [string, string, string], [c0, c1, colors.bg.elevated]);
  const overlayGradientColors = useMemo(() => [`${c0}40`, colors.bg.elevated, `${c1}30`] as [string, string, string], [c0, c1, colors.bg.elevated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLike = useCallback(() => {
    scale.value = withSequence(
      withTiming(1.25, { duration: 80 }),
      withTiming(1, { duration: 100 })
    );
    toggle();
  }, [toggle, scale]);

  const initials = post.username ? post.username.slice(0, 2).toUpperCase() : '??';

  useEffect(() => {
    if (isVisible && post.media_url && !isVideo) {
      Image.prefetch?.(post.media_url).catch(() => { /* ignorieren */ });
    }
  }, [isVisible, post.media_url, isVideo]);

  const goToPost = useCallback(() => {
    router.push({ pathname: '/guild-post/[id]', params: { id: post.id } });
  }, [router, post.id]);

  const goToAuthor = useCallback(() => {
    router.push({ pathname: '/user/[id]', params: { id: post.author_id } });
  }, [router, post.author_id]);

  return (
    <View style={styles.card}>
      <View style={styles.cardBlur}>

        {/* ── Media (volle Fläche) + Author-Overlay oben drauf (Instagram-Style) ── */}
        {post.media_url ? (
          <Pressable onPress={goToPost} style={v.mediaWrap}>
            {/* Placeholder Gradient beim Laden */}
            <LinearGradient
              colors={bgGradientColors}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />

            {/* Media */}
            {isVideo ? (
              <>
                {USE_EXPO_VIDEO ? (
                  <NativeFeedVideo uri={post.media_url} shouldPlay={isVisible} isMuted={isMuted} onProgress={() => { }} />
                ) : (
                  <FallbackFeedVideo uri={post.media_url} shouldPlay={isVisible} isMuted={isMuted} onProgress={() => { }} />
                )}
              </>
            ) : (
              <Image source={{ uri: post.media_url }} style={v.mediaImg} contentFit="cover" />
            )}



            {/* ── Author-Overlay oben links (Instagram-Style) ── */}
            <Pressable style={v.authorRow} onPress={goToAuthor} hitSlop={8}>
              {/* Mini Avatar */}
              <View style={v.miniAvatarWrap}>
                {post.avatar_url ? (
                  <Image source={{ uri: post.avatar_url }} style={v.miniAvatar} contentFit="cover" />
                ) : (
                  <View style={[v.miniAvatar, v.miniAvatarFallback]}>
                    <Text style={v.miniAvatarText}>{initials}</Text>
                  </View>
                )}
              </View>
              {/* Username + Zeit */}
              <View style={v.authorInfo}>
                <Text style={v.authorName} numberOfLines={1}>
                  {post.username ?? 'Unbekannt'}
                </Text>
                <Text style={v.authorTime}>{formatRelativeTime(post.created_at)}</Text>
              </View>
            </Pressable>

            {/* Mute-Button oben rechts (nur bei Video) */}
            {isVideo && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); toggleMute(); }}
                style={v.muteBtn}
                hitSlop={12}
              >
                {isMuted
                  ? <VolumeX size={16} color="#fff" />
                  : <Volume2 size={16} color="#fff" />
                }
              </Pressable>
            )}
          </Pressable>
        ) : (
          /* Post ohne Media */
          <View style={[v.mediaWrap, v.noMediaInner]}>
            <LinearGradient
              colors={overlayGradientColors}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />
            {/* Author auch hier overlaid */}
            <Pressable style={[v.authorRow, { top: 14 }]} onPress={goToAuthor} hitSlop={8}>
              <View style={v.miniAvatarWrap}>
                <View style={[v.miniAvatar, v.miniAvatarFallback]}>
                  <Text style={v.miniAvatarText}>{initials}</Text>
                </View>
              </View>
              <View style={v.authorInfo}>
                <Text style={v.authorName}>{post.username ?? 'Unbekannt'}</Text>
              </View>
            </Pressable>
            {/* Caption als Ersatz für Media */}
            {post.caption && (
              <Text style={v.noMediaCaption} numberOfLines={5}>{post.caption}</Text>
            )}
          </View>
        )}

        {/* ── Action-Leiste (unter dem Media) ── */}
        <View style={[styles.actions, { paddingTop: 8, paddingBottom: 2 }]}>
          <Animated.View style={animatedStyle}>
            <Pressable onPress={handleLike} style={styles.actionBtn} hitSlop={10}>
              <Heart
                size={22}
                color={liked ? '#F43F5E' : colors.icon.default}
                fill={liked ? '#F43F5E' : 'transparent'}
              />
              <Text style={[styles.actionCount, liked && { color: '#F43F5E' }]}>{count}</Text>
            </Pressable>
          </Animated.View>

          <Pressable onPress={() => setShowComments(true)} style={styles.actionBtn} hitSlop={10}>
            <MessageCircle size={22} color={colors.icon.default} />
            <Text style={styles.actionCount}>
              {commentCount >= 1000 ? `${(commentCount / 1000).toFixed(1)}K` : commentCount}
            </Text>
          </Pressable>

          <Pressable onPress={toggleBookmark} style={styles.actionBtn} hitSlop={10}>
            <Bookmark
              size={22}
              color={bookmarked ? '#FBBF24' : colors.icon.default}
              fill={bookmarked ? '#FBBF24' : 'transparent'}
            />
          </Pressable>

          <Pressable onPress={() => sharePost(post.id, post.caption)} style={styles.actionBtn} hitSlop={10}>
            <Share2 size={22} color={colors.icon.default} />
          </Pressable>
        </View>

        {/* ── Caption — immer anzeigen, expandierbar ── */}
        {post.caption ? (
          <Pressable
            style={styles.captionWrap}
            onPress={() => setCaptionExpanded(e => !e)}
            hitSlop={4}
          >
            <Text
              style={[styles.caption, { flexShrink: 1 }]}
              numberOfLines={captionExpanded ? undefined : 1}
            >
              <Text style={styles.captionUser}>{post.username ?? 'Unbekannt'} </Text>
              {post.caption}
            </Text>
            {!captionExpanded && post.caption.length > 60 && (
              <Text style={cap.mehr}>mehr</Text>
            )}
          </Pressable>
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

// ── Lokale Styles — nur Media-Overlay-Elemente ─────────────────────────────
const v = StyleSheet.create({
  // Media container — Instagram Reels Format (3:4)
  mediaWrap: {
    width: '100%',
    aspectRatio: 3 / 4,     // Instagram Reels/Portrait — maximale Wirkung
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImg: {
    width: '100%',
    height: '100%',
  },
  bottomGrad: {
    top: '60%',              // nur unteres Drittel abdunkeln
  },

  // ── Instagram-Style Author Overlay ────────────────────────────────────────
  authorRow: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 80,               // Platz für Mute-Button
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  miniAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  miniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  miniAvatarFallback: {
    backgroundColor: 'rgba(80,80,80,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  authorInfo: {
    gap: 1,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  authorTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Mute Button
  muteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 7,
    zIndex: 10,
  },

  // Post ohne Media
  noMediaInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.05)',
    minHeight: 200,
  },
  noMediaCaption: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

// ── Caption Expand ──────────────────────────────────────────────────────────
const cap = StyleSheet.create({
  mehr: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 1,
  },
});

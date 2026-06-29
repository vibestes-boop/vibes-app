import { FallbackFeedVideo,NativeFeedVideo,USE_EXPO_VIDEO } from '@/components/feed/FeedVideo';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { useBookmark } from '@/lib/useBookmark';
import { useCommentCount } from '@/lib/useComments';
import { useLike } from '@/lib/useLike';
import type { GuildPost } from '@/lib/usePosts';
import { sharePost } from '@/lib/useShare';
import { useTheme } from '@/lib/useTheme';
import { useVideoMute } from '@/lib/useVideoPreferences';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect,useRouter } from 'expo-router';
import { Bookmark,Heart,MessageCircle,Share2,Volume2,VolumeX } from 'lucide-react-native';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import {
useAnimatedStyle,
useSharedValue,
withSequence,
withTiming,
} from 'react-native-reanimated';
import { getGuildStyles } from './guildStyles';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

// Stabile No-op-Referenz: GuildCard nutzt onProgress nicht, aber eine INLINE
// Funktion (() => {}) würde bei jedem Re-Render (z.B. Kommentar-Sheet auf/zu)
// den Restart-Effekt in FeedVideo neu auslösen → kurze Clips springen auf 0.
// Stabile Identität = kein spuriöser Video-Neustart.
const NOOP_PROGRESS = (_p: number) => {};

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
  // Nur fürs Profil-Aufrufen geschlossen → beim Zurückkommen wieder öffnen.
  const reopenCommentsRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (reopenCommentsRef.current) {
        reopenCommentsRef.current = false;
        setShowComments(true);
      }
    }, []),
  );
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const { isMuted, toggleMute } = useVideoMute();
  const isVideo = post.media_type === 'video';
  const scale = useSharedValue(1);
  const [c0, c1] = guildColors;
  const [restartSignal, setRestartSignal] = useState(0);
  const visibilityRef = useRef({ id: post.id, visible: false });

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

  useEffect(() => {
    const previous = visibilityRef.current;
    const wasVisible = previous.id === post.id ? previous.visible : false;
    visibilityRef.current = { id: post.id, visible: isVisible };
    if (!isVideo) return;
    if (isVisible && (!wasVisible || previous.id !== post.id)) {
      setRestartSignal((signal) => signal + 1);
    }
  }, [post.id, isVideo, isVisible]);

  const goToPost = useCallback(() => {
    router.push({ pathname: '/guild-post/[id]', params: { id: post.id } });
  }, [router, post.id]);

  const goToAuthor = useCallback(() => {
    router.push({ pathname: '/user/[id]', params: { id: post.author_id } });
  }, [router, post.author_id]);

  return (
    <View style={styles.card}>
      <View style={styles.cardBlur}>

        {/* ── Media (volle Fläche) + Author-Overlay oben drauf (Foto-Feed-Style) ── */}
        {post.media_url ? (
          <Pressable onPress={goToPost} style={v.mediaWrap}>
            {/* Placeholder Gradient beim Laden */}
            <LinearGradient
              colors={bgGradientColors}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />

            {/* Blur-Fill-Hintergrund: füllt die Ränder im 3:4-Rahmen, statt das
                Medium (besonders Querformat) seitlich zu beschneiden. */}
            {(isVideo ? post.thumbnail_url : post.media_url) && (
              <>
                <Image
                  source={{ uri: isVideo ? post.thumbnail_url! : post.media_url! }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  blurRadius={30}
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.30)' }]} />
              </>
            )}

            {/* Media — contain: ganzes Bild sichtbar, kein seitlicher Beschnitt */}
            {isVideo ? (
              <>
                {USE_EXPO_VIDEO ? (
                  <NativeFeedVideo uri={post.media_url} shouldPlay={isVisible} isMuted={isMuted} onProgress={NOOP_PROGRESS} thumbnailUrl={post.thumbnail_url} restartSignal={restartSignal} bunnyVideoId={post.bunny_video_id ?? null} contentFit="contain" />
                ) : (
                  <FallbackFeedVideo uri={post.media_url} shouldPlay={isVisible} isMuted={isMuted} onProgress={NOOP_PROGRESS} thumbnailUrl={post.thumbnail_url} restartSignal={restartSignal} contentFit="contain" />
                )}
              </>
            ) : (
              <Image source={{ uri: post.media_url }} style={v.mediaImg} contentFit="contain" />
            )}



            {/* ── Author-Overlay oben links (Foto-Feed-Style) ── */}
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

          {/* Kommentar → in-list Bottom-Sheet (Instagram-Stil). seamlessPeek:
              kein schwarzes Overlay, das Video bleibt oben sichtbar + läuft weiter.
              KEIN Scroll/Schrumpf → kein Remount → kein Neustart. */}
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

      {/* Instagram-Stil: Bottom-Sheet, Video bleibt oben sichtbar + läuft weiter.
          seamlessPeek = kein Dim-Overlay; KEIN sheetProgress → kein Schrumpf/
          Remount der Karte → kein Video-Neustart. */}
      <CommentsSheet
        postId={post.id}
        visible={showComments}
        seamlessPeek
        onClose={() => setShowComments(false)}
        onUserPress={(userId) => {
          reopenCommentsRef.current = true;
          setShowComments(false);
          router.push({ pathname: '/user/[id]', params: { id: userId } });
        }}
      />
    </View>
  );
});

// ── Lokale Styles — nur Media-Overlay-Elemente ─────────────────────────────
const v = StyleSheet.create({
  // Media container — Foto-Feed Reels Format (3:4)
  mediaWrap: {
    width: '100%',
    aspectRatio: 3 / 4,     // Foto-Feed Reels/Portrait — maximale Wirkung
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

  // ── Foto-Feed-Style Author Overlay ────────────────────────────────────────
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

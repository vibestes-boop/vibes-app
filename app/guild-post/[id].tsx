/**
 * Guild Post Detail — Instagram-Style vertikale Swipe-Navigation
 *
 * Eine vertikale FlatList mit pagingEnabled={true}.
 * Der Nutzer wischt hoch/runter um durch die Guild-Posts zu navigieren.
 * Das nächste/vorherige Post folgt dem Finger in Echtzeit (native Scrolling).
 *
 * Route: /guild-post/[id]
 * Navigation von: GuildCard (tap auf Media), guild.tsx
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  ActivityIndicator,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Clock,
  Users,
  VolumeX,
  Volume2,
} from 'lucide-react-native';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO } from '@/components/feed/FeedVideo';
import type { FeedVideoSeekHandle } from '@/components/feed/FeedVideo';
import { VideoProgressBar } from '@/components/feed/FeedItem';
import type { VideoProgressHandle } from '@/components/feed/FeedItem';
import { useLike } from '@/lib/useLike';
import { useCommentCount } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { sharePost } from '@/lib/useShare';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { useGuildNavStore } from '@/lib/guildNavStore';
import type { GuildPost } from '@/lib/usePosts';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useAuthStore } from '@/lib/authStore';
import { StoryRingAvatar } from '@/components/ui/StoryRingAvatar';

// ─── Floating Heart — eigenständige Komponente pro Doppel-Tap ──────────────────
type FloatingHeartItem = { id: number; x: number; y: number };

function FloatingHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const scale = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const rotate = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
      RNAnimated.timing(translateY, { toValue: -140, duration: 1600, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.timing(rotate, { toValue: -1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 1,  duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: -1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 1,  duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 0,  duration: 100, useNativeDriver: true }),
      ]),
      RNAnimated.sequence([
        RNAnimated.delay(900),
        RNAnimated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateInterp = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <RNAnimated.View
      style={[
        {
          position: 'absolute',
          width: 140,
          height: 140,
          left: x - 70,
          top: y - 70,
          alignItems: 'center',
          justifyContent: 'center',
        },
        {
          opacity,
          transform: [{ translateY }, { scale }, { rotate: rotateInterp }],
        },
      ]}
      pointerEvents="none"
    >
      <Heart size={120} color="#EE1D52" fill="#EE1D52" />
    </RNAnimated.View>
  );
}

const { width: W, height: H } = Dimensions.get('window');
const ITEM_HEIGHT = H;

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────
function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  return `vor ${Math.floor(hrs / 24)} Tagen`;
}

// ─── Einzelner Post-Item in der FlatList ──────────────────────────────────────
function GuildPostDetailItem({
  post,
  guildColors,
  isActive,
  onBack,
}: {
  post: GuildPost;
  guildColors: [string, string];
  isActive: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [c0, c1] = guildColors;
  const isVideo = post.media_type === 'video';
  const [showComments, setShowComments] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  const { liked, count, toggle } = useLike(post.id, { liked: post.is_liked, count: post.like_count });
  const { data: commentCount = 0 } = useCommentCount(post.id, post.comment_count);
  const { bookmarked, toggle: toggleBookmark } = useBookmark(post.id);

  // Like-Button-Scale (Reanimated, für den Sidebar-Button)
  const scale = useSharedValue(1);
  const animatedHeartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // ─ Doppel-Tap-to-Like + Floating Hearts (RN built-in Animated) ────────────
  const lastTapRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hearts, setHearts] = useState<FloatingHeartItem[]>([]);
  const heartIdRef = useRef(0);

  const spawnHeart = useCallback((x: number, y: number) => {
    const newId = heartIdRef.current++;
    setHearts((prev) => [...prev, { id: newId, x, y }]);
  }, []);

  // ─ Video-Fortschrittsbalken (identisch zu FeedItem) ──────────────────────────
  const progressBarRef = useRef<VideoProgressHandle>(null);
  const videoSeekRef = useRef<FeedVideoSeekHandle>(null);
  const handleProgress = useCallback((p: number) => progressBarRef.current?.setProgress(p), []);
  const handleSeek    = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);
  const handleSeekEnd = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);

  const handleScreenTap = useCallback((evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const now = Date.now();
    const x = evt.nativeEvent.locationX;
    const y = evt.nativeEvent.locationY;
    if (now - lastTapRef.current < 300) {
      // Doppel-Tap → Like + Herz
      if (!liked) toggle();
      spawnHeart(lastTapPosRef.current.x, lastTapPosRef.current.y);
      impactAsync(ImpactFeedbackStyle.Medium);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      lastTapPosRef.current = { x, y };
    }
  }, [liked, toggle, spawnHeart]);

  const handleScreenTapVideo = useCallback((evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const now = Date.now();
    const x = evt.nativeEvent.locationX;
    const y = evt.nativeEvent.locationY;
    if (now - lastTapRef.current < 300) {
      // Doppel-Tap = Like + Herz
      if (!liked) toggle();
      spawnHeart(lastTapPosRef.current.x, lastTapPosRef.current.y);
      impactAsync(ImpactFeedbackStyle.Medium);
      lastTapRef.current = 0;
    } else {
      // Einfach-Tap = Mute toggle
      lastTapRef.current = now;
      lastTapPosRef.current = { x, y };
      setIsMuted((m) => !m);
    }
  }, [liked, toggle, spawnHeart]);

  const handleLike = useCallback(() => {
    scale.value = withSequence(
      withTiming(1.35, { duration: 70 }),
      withTiming(1, { duration: 100 })
    );
    toggle();
    impactAsync(ImpactFeedbackStyle.Light);
  }, [toggle, scale]);

  const initials = post.username ? post.username.slice(0, 2).toUpperCase() : '??';

  return (
    <View style={[itemStyles.container, { height: ITEM_HEIGHT }]}>
      {/* ── Hintergrund ── */}
      {post.media_url ? (
        isVideo ? (
          USE_EXPO_VIDEO ? (
            <NativeFeedVideo
              ref={videoSeekRef}
              uri={post.media_url}
              shouldPlay={isActive}
              isMuted={isMuted}
              onProgress={handleProgress}
            />
          ) : (
            <FallbackFeedVideo
              ref={videoSeekRef}
              uri={post.media_url}
              shouldPlay={isActive}
              isMuted={isMuted}
              onProgress={handleProgress}
            />
          )
        ) : (
          <>
            {/* Blurred background — sofort aus Cache, Priority High wenn aktiv */}
            <Image
              source={{ uri: post.media_url }}
              style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}
              contentFit="cover"
              blurRadius={18}
              priority={isActive ? 'high' : 'normal'}
            />
            {/* Main image */}
            <Image
              source={{ uri: post.media_url }}
              style={itemStyles.mainImage}
              contentFit="contain"
              priority={isActive ? 'high' : 'normal'}
              transition={200}
            />
          </>
        )
      ) : (
        <LinearGradient
          colors={[`${c0}50`, '#050508', `${c1}30`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />
      )}

      {/* Screen-Tap: Einfach-Tap = Mute/Unmute (Video), Doppel-Tap = Like */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={isVideo ? handleScreenTapVideo : handleScreenTap}
      />

      {/* Fliegende Herzen bei Doppel-Tap — je ein unabhängiges FloatingHeart pro Tap */}
      {hearts.map((h) => (
        <FloatingHeart
          key={h.id}
          x={h.x}
          y={h.y}
          onDone={() => setHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
        />
      ))}

      {/* ── Header ── */}
      <View style={[itemStyles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onBack} style={itemStyles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
        </Pressable>

        <View style={[itemStyles.guildBadge, { backgroundColor: `${c0}33` }]}>
          <Users size={11} color={c0} />
          <Text style={[itemStyles.guildBadgeText, { color: c0 }]}>Guild</Text>
        </View>
      </View>

      {/* ── Rechte Aktionen ── */}
      <View style={[itemStyles.rightActions, { bottom: insets.bottom + 90 }]}>
        {/* Avatar mit Story-Ring */}
        <StoryRingAvatar
          userId={post.author_id}
          avatarUrl={post.avatar_url}
          size={46}
          initials={initials}
          fallbackColors={guildColors}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author_id } })}
          style={{ marginBottom: 4 }}
        />

        {/* Like */}
        <Animated.View style={animatedHeartStyle}>
          <Pressable onPress={handleLike} style={itemStyles.actionItem} hitSlop={10}>
            <Heart size={28} color={liked ? '#F43F5E' : '#fff'} fill={liked ? '#F43F5E' : 'transparent'} strokeWidth={1.8} />
            <Text style={[itemStyles.actionCount, liked && { color: '#F43F5E' }]}>{count}</Text>
          </Pressable>
        </Animated.View>

        {/* Kommentar — öffnet CommentsSheet (Instagram-Style) */}
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            setShowComments(true);
          }}
          style={itemStyles.actionItem}
          hitSlop={10}
        >
          <MessageCircle size={28} color="#fff" strokeWidth={1.8} />
          <Text style={itemStyles.actionCount}>
            {commentCount >= 1000 ? `${(commentCount / 1000).toFixed(1)}K` : commentCount}
          </Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable onPress={toggleBookmark} style={itemStyles.actionItem} hitSlop={10}>
          <Bookmark
            size={28}
            color={bookmarked ? '#FBBF24' : '#fff'}
            fill={bookmarked ? '#FBBF24' : 'transparent'}
            strokeWidth={1.8}
          />
        </Pressable>

        {/* Teilen */}
        <Pressable onPress={() => sharePost(post.id, post.caption)} style={itemStyles.actionItem} hitSlop={10}>
          <Share2 size={28} color="#fff" strokeWidth={1.8} />
        </Pressable>

        {/* Mute-Icon (Video) */}
        {isVideo && (
          <Pressable onPress={() => setIsMuted((m) => !m)} style={itemStyles.actionItem} hitSlop={10}>
            {isMuted
              ? <VolumeX size={26} color="#fff" strokeWidth={1.8} />
              : <Volume2 size={26} color="#fff" strokeWidth={1.8} />}
          </Pressable>
        )}
      </View>

      {/* ── Untere Info-Leiste ── */}
      <View style={[itemStyles.bottomInfo, { paddingBottom: insets.bottom + 12 }]}>
        {/* Autor */}
        <Pressable
          style={itemStyles.authorRow}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author_id } })}
        >
          <Text style={itemStyles.username}>@{post.username ?? 'unknown'}</Text>
          <View style={itemStyles.timeRow}>
            <Clock size={11} color="rgba(255,255,255,0.5)" />
            <Text style={itemStyles.timeText}>{formatRelativeTime(post.created_at)}</Text>
          </View>
        </Pressable>

        {/* Caption */}
        {post.caption ? (
          <Text style={itemStyles.caption} numberOfLines={3}>{post.caption}</Text>
        ) : null}

        {/* Tags */}
        {post.tags && post.tags.length > 0 ? (
          <View style={itemStyles.tagsRow}>
            {post.tags.map((t) => (
              <Text key={t} style={itemStyles.tag}>#{t}</Text>
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

      {/* ── Video-Fortschrittsbalken — direkt über dem Kommentarfeld ── */}
      {isVideo && (
        <VideoProgressBar
          ref={progressBarRef}
          postId={post.id}
          onSeek={handleSeek}
          onSeekEnd={handleSeekEnd}
          bottomOffset={insets.bottom + 52}
        />
      )}

      {/* ── Fake-Kommentarfeld ── Öffnet CommentsSheet ── */}
      <Pressable
        style={[itemStyles.commentBarWrap, { paddingBottom: insets.bottom }]}
        onPress={() => {
          impactAsync(ImpactFeedbackStyle.Light);
          setShowComments(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Kommentare anzeigen und Kommentar schreiben"
      >
        <View style={itemStyles.commentBar}>
          {/* Avatar */}
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={itemStyles.commentAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[itemStyles.commentAvatar, itemStyles.commentAvatarFallback]}>
              <Text style={itemStyles.commentAvatarInitial}>
                {(profile?.username ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}

          {/* Fake TextInput (optisch) */}
          <View style={itemStyles.commentInputWrap}>
            <Text style={itemStyles.commentPlaceholder}>
              Kommentiere als @{profile?.username ?? '...'}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ─── Haupt-Screen ─────────────────────────────────────────────────────────────
export default function GuildPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { posts, guildColors } = useGuildNavStore();
  const listRef = useRef<FlatList<GuildPost>>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const idx = posts.findIndex((p) => p.id === id);
    return idx >= 0 ? idx : 0;
  });

  const initialIndex = posts.findIndex((p) => p.id === id);

  // ✅ Hooks VOR bedingtem Return (Rules of Hooks)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: GuildPost; index: number }) => (
      <GuildPostDetailItem
        post={item}
        guildColors={guildColors}
        isActive={index === activeIndex}
        onBack={() => router.back()}
      />
    ),
    [guildColors, activeIndex, router]
  );

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  // ─ Linker Edge-Swipe → router.back() ─────────────────────────────────
  // Schmaler linker Streifen (~22px) mit PanResponder:
  // Swipe nach rechts (dx > 60, |dy| < 80) → router.back()
  // Nicht vom FlatList konsumiert da eigener Responder auf schmalem Streifen
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && Math.abs(gs.dy) < gs.dx,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 60 && Math.abs(gs.dy) < 80) {
          router.back();
        }
      },
    })
  ).current;

  // Kein Store-Inhalt → Spinner bis Guild-Feed geladen
  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050508', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  // initialNumToRender muss >= initialIndex+1 sein damit scrollToIndex funktioniert
  const safeInitialNumToRender = Math.max((initialIndex >= 0 ? initialIndex : 0) + 2, 3);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex >= 0 ? initialIndex : 0}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        windowSize={2}
        maxToRenderPerBatch={3}
        initialNumToRender={safeInitialNumToRender}
        removeClippedSubviews={true}
      />

      {/* Linker Edge-Strip für Swipe-Back (wie iOS/TikTok) */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 22,
          zIndex: 100,
        }}
        {...edgePanResponder.panHandlers}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const itemStyles = StyleSheet.create({
  container: {
    width: W,
    backgroundColor: '#050508',
    overflow: 'hidden',
  },
  mainImage: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  guildBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rightActions: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 18,
    zIndex: 10,
  },
  avatarWrap: {
    marginBottom: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  actionItem: {
    alignItems: 'center',
    gap: 3,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 80,   // Platz für die Kommentar-Eingabeleiste
    left: 0,
    right: 80,
    paddingHorizontal: 16,
    gap: 6,
    zIndex: 10,
  },
  authorRow: {
    gap: 2,
    marginBottom: 2,
  },
  username: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  caption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Kommentar-Eingabe ─────────────────────────────────────────────────
  commentBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  commentInputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
  },
  commentPlaceholder: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    lineHeight: 20,
  },
});

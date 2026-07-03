/**
 * Guild Post Detail — Foto-Feed-Style vertikale Swipe-Navigation
 *
 * Eine vertikale FlatList mit pagingEnabled={true}.
 * Der Nutzer wischt hoch/runter um durch die Guild-Posts zu navigieren.
 * Das nächste/vorherige Post folgt dem Finger in Echtzeit (native Scrolling).
 *
 * Route: /guild-post/[id]
 * Navigation von: GuildCard (tap auf Media), guild.tsx
 */
import { LC } from '@/lib/liveColors';
import type { VideoProgressHandle } from '@/components/feed/FeedItem';
import { VideoProgressBar } from '@/components/feed/FeedItem';
import type { FeedVideoSeekHandle } from '@/components/feed/FeedVideo';
import { FallbackFeedVideo,NativeFeedVideo,USE_EXPO_VIDEO } from '@/components/feed/FeedVideo';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { ProductFeedChip } from '@/components/feed/ProductFeedChip';
import { useFeedProducts, type LinkedProduct } from '@/lib/useFeedProducts';
import { StoryRingAvatar } from '@/components/ui/StoryRingAvatar';
import { useAuthStore } from '@/lib/authStore';
import { useGuildNavStore } from '@/lib/guildNavStore';
import { useBookmark } from '@/lib/useBookmark';
import { useCommentCount } from '@/lib/useComments';
import { useLike } from '@/lib/useLike';
import { useVideoMute } from '@/lib/useVideoPreferences';
import type { GuildPost } from '@/lib/usePosts';
import { sharePost } from '@/lib/useShare';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect,useLocalSearchParams,useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import {
ArrowLeft,
Bookmark,
Clock,
Heart,
MessageCircle,
Share2,
Users,
Volume2,
VolumeX,
} from 'lucide-react-native';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
ActivityIndicator,
Dimensions,
FlatList,
InteractionManager,
PanResponder,
Platform,
Pressable,
Animated as RNAnimated,
StyleSheet,
Text,
View,
} from 'react-native';
import {
Extrapolation,
interpolate,
useAnimatedStyle,
useSharedValue,
withSequence,
withSpring,
withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

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
  autoOpenComments = false,
  product,
}: {
  post: GuildPost;
  guildColors: [string, string];
  isActive: boolean;
  onBack: () => void;
  // Kommentare beim Öffnen automatisch aufklappen (Navigation vom Karten-Chat-Button)
  autoOpenComments?: boolean;
  // Shoppable Post (#2): verknüpftes Produkt → tappbare Karte.
  product?: LinkedProduct | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [c0, c1] = guildColors;
  const isVideo = post.media_type === 'video';
  const [showComments, setShowComments] = useState(false);
  // Geteilter, persistenter Mute-Store (wie Feed + Guild-Karten): einmal laut →
  // bleibt laut across Detail-Items (Swipe), Karten-Liste↔Detail, App-Neustart.
  const { isMuted, toggleMute } = useVideoMute();

  // Vom Karten-Chat-Button: Kommentare nach kurzem Moment aufklappen (Video
  // startet erst, dann schrumpft es nahtlos in den Peek).
  useEffect(() => {
    if (!autoOpenComments) return;
    const t = setTimeout(() => setShowComments(true), 350);
    return () => clearTimeout(t);
  }, [autoOpenComments]);
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
  const [restartSignal, setRestartSignal] = useState(0);
  const visibilityRef = useRef({ id: post.id, visible: false });

  useEffect(() => {
    const previous = visibilityRef.current;
    const wasVisible = previous.id === post.id ? previous.visible : false;
    visibilityRef.current = { id: post.id, visible: isActive };

    if (!isVideo) return;
    if (isActive && (!wasVisible || previous.id !== post.id)) {
      progressBarRef.current?.setProgress(0);
      setRestartSignal((signal) => signal + 1);
    }
    if (!isActive && wasVisible) {
      progressBarRef.current?.setProgress(0);
    }
  }, [post.id, isVideo, isActive]);

  // ── Seamless-Kommentare (wie Feed): Video schrumpft in den oberen ~40%,
  //    läuft ununterbrochen weiter, Kommentare darunter. sheetProgress wird
  //    beim Schließen direkt vom CommentsSheet (Drag) auf 0 zurückgefahren. ──
  // Merkt sich, dass wir die Kommentare nur fürs Profil-Aufrufen geschlossen
  // haben → beim Zurückkommen (Focus) wieder öffnen, Medium bleibt klein.
  const reopenCommentsRef = useRef(false);
  const sheetProgress = useSharedValue(0);
  // Medium-Höhe STRIKT an showComments koppeln: geschlossen → IMMER voll (0),
  // offen → klein (1). Früher blieb es bei einem Profilbesuch absichtlich klein
  // (reopenCommentsRef-Guard), um beim Zurückkommen nicht zu „springen". Genau
  // das war aber die Quelle des „kleines Video + schwarze Lücke"-Zustands, sobald
  // der Reopen verpuffte (iOS: Kommentar-<Modal> über dem fullScreenModal nach
  // dem Pop-Übergang). Jetzt unmöglich: zu = voll, offen = klein. Der Auto-Reopen
  // unten bleibt Best-Effort — schlägt er fehl, sieht man den vollen Post (statt
  // einer schwarzen Lücke) und kann erneut auf Kommentare tippen.
  useEffect(() => {
    sheetProgress.value = withSpring(showComments ? 1 : 0, { damping: 22, stiffness: 180, mass: 0.8 });
  }, [showComments, sheetProgress]);

  // Beim Zurückkommen vom Profil: Kommentare wieder öffnen (Medium bleibt klein).
  // iOS-Falle: guild-post ist selbst als `fullScreenModal` präsentiert UND die
  // Kommentare sind ein <Modal>. Das Sheet DIREKT nach dem Pop-Übergang von
  // /user/[id] erneut zu präsentieren verschluckt iOS (Modal-über-Modal im
  // Transition-Fenster) → Sheet wird nie sichtbar, sheetProgress bleibt auf 1
  // → kleines Video + schwarze Lücke. Deshalb erst NACH Abschluss der
  // Navigations-Animation re-präsentieren (runAfterInteractions + kleiner Puffer).
  // Der Feed ist ein Tab (kein Modal) → dort reicht ein direkter Reopen.
  useFocusEffect(
    useCallback(() => {
      if (!reopenCommentsRef.current) return;
      reopenCommentsRef.current = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const task = InteractionManager.runAfterInteractions(() => {
        timer = setTimeout(() => setShowComments(true), 120);
      });
      return () => {
        task.cancel();
        if (timer) clearTimeout(timer);
      };
    }, []),
  );

  const mediaAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(sheetProgress.value, [0, 1], [ITEM_HEIGHT, ITEM_HEIGHT * 0.40], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));

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
      toggleMute();
    }
  }, [liked, toggle, spawnHeart, toggleMute]);

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
      {/* ── Hintergrund — schrumpft in den oberen Peek, wenn Kommentare offen ── */}
      <Animated.View style={[itemStyles.mediaWrap, mediaAnimStyle]}>
      {post.media_url ? (
        isVideo ? (
          <>
            {/* Letterbox-Ränder bleiben schwarz (mediaWrap-Hintergrund) — kein
                Blur-Fill/Spiegelung mehr hinter dem contain-Video. */}
            {USE_EXPO_VIDEO ? (
              <NativeFeedVideo
                ref={videoSeekRef}
                uri={post.media_url}
                shouldPlay={isActive}
                isMuted={isMuted}
                onProgress={handleProgress}
                restartSignal={restartSignal}
                thumbnailUrl={post.thumbnail_url}
                bunnyVideoId={post.bunny_video_id ?? null}
                contentFit="contain"
              />
            ) : (
              <FallbackFeedVideo
                ref={videoSeekRef}
                uri={post.media_url}
                shouldPlay={isActive}
                isMuted={isMuted}
                onProgress={handleProgress}
                restartSignal={restartSignal}
                contentFit="contain"
              />
            )}
          </>
        ) : (
          <>
            {/* Kein Blur-Hintergrund mehr — Ränder bleiben schwarz (mediaWrap). */}
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
      </Animated.View>

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

      {/* ── Header ── (blendet aus, wenn Kommentare offen) */}
      <Animated.View
        style={[itemStyles.header, { paddingTop: insets.top + 6 }, overlayFadeStyle]}
        pointerEvents={showComments ? 'none' : 'box-none'}
      >
        <Pressable onPress={onBack} style={itemStyles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
        </Pressable>

        <View style={[itemStyles.guildBadge, { backgroundColor: `${c0}33` }]}>
          <Users size={11} color={c0} />
          <Text style={[itemStyles.guildBadgeText, { color: c0 }]}>Guild</Text>
        </View>
      </Animated.View>

      {/* ── Rechte Aktionen ── (blendet aus, wenn Kommentare offen) */}
      <Animated.View
        style={[itemStyles.rightActions, { bottom: insets.bottom + 56 }, overlayFadeStyle]}
        pointerEvents={showComments ? 'none' : 'box-none'}
      >
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
            <View style={itemStyles.iconWrap}>
              <Heart size={26} stroke={liked ? LC.accent.rose : '#FFFFFF'} fill={liked ? LC.accent.rose : '#FFFFFF'} strokeWidth={2} />
            </View>
            <Text style={[itemStyles.actionCount, liked && { color: LC.accent.rose }]}>{count}</Text>
          </Pressable>
        </Animated.View>

        {/* Kommentar — öffnet CommentsSheet (Foto-Feed-Style) */}
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            setShowComments(true);
          }}
          style={itemStyles.actionItem}
          hitSlop={10}
        >
          <View style={itemStyles.iconWrap}>
            <View style={itemStyles.bubbleWrap}>
              <MessageCircle size={26} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
              <View style={itemStyles.bubbleDots}>
                <View style={itemStyles.bubbleDot} />
                <View style={itemStyles.bubbleDot} />
                <View style={itemStyles.bubbleDot} />
              </View>
            </View>
          </View>
          <Text style={itemStyles.actionCount}>
            {commentCount >= 1000 ? `${(commentCount / 1000).toFixed(1)}K` : commentCount}
          </Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable onPress={toggleBookmark} style={itemStyles.actionItem} hitSlop={10}>
          <View style={itemStyles.iconWrap}>
            <Bookmark
              size={26}
              stroke={bookmarked ? '#FBBF24' : '#FFFFFF'}
              fill={bookmarked ? '#FBBF24' : '#FFFFFF'}
              strokeWidth={2}
            />
          </View>
        </Pressable>

        {/* Teilen */}
        <Pressable onPress={() => sharePost(post.id, post.caption)} style={itemStyles.actionItem} hitSlop={10}>
          <View style={itemStyles.iconWrap}>
            <Share2 size={25} color="#FFFFFF" strokeWidth={2.3} />
          </View>
        </Pressable>

        {/* Mute-Icon (Video) */}
        {isVideo && (
          <Pressable onPress={toggleMute} style={itemStyles.actionItem} hitSlop={10}>
            <View style={itemStyles.iconWrap}>
              {isMuted
                ? <VolumeX size={23} color="#FFFFFF" strokeWidth={0} fill="#FFFFFF" />
                : <Volume2 size={23} color="#FFFFFF" strokeWidth={0} fill="#FFFFFF" />}
            </View>
          </Pressable>
        )}
      </Animated.View>

      {/* ── Untere Info-Leiste ── (blendet aus, wenn Kommentare offen) */}
      <Animated.View
        style={[itemStyles.bottomInfo, { bottom: insets.bottom + 54 }, overlayFadeStyle]}
        pointerEvents={showComments ? 'none' : 'box-none'}
      >
        {/* Autor */}
        {/* Shoppable Post (#2): kompakte Produkt-Pille ÜBER dem Autor-Block,
            damit Nickname + Caption an ihrer gewohnten Position bleiben */}
        {product && <ProductFeedChip product={product} style={{ marginBottom: 8 }} />}

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

      </Animated.View>

      <CommentsSheet
        postId={post.id}
        visible={showComments}
        seamlessPeek
        sheetProgress={sheetProgress}
        onClose={() => setShowComments(false)}
        onUserPress={(userId) => {
          reopenCommentsRef.current = true;
          setShowComments(false);
          router.push({ pathname: '/user/[id]', params: { id: userId } });
        }}
      />

      {/* ── Video-Fortschrittsbalken — versteckt, wenn Kommentare offen ── */}
      {isVideo && !showComments && (
        <VideoProgressBar
          ref={progressBarRef}
          postId={post.id}
          onSeek={handleSeek}
          onSeekEnd={handleSeekEnd}
          bottomOffset={insets.bottom + 52}
        />
      )}

      {/* ── Fake-Kommentarfeld ── Öffnet CommentsSheet (versteckt, wenn offen) ── */}
      {!showComments && (
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
      )}
    </View>
  );
}

// ─── Haupt-Screen ─────────────────────────────────────────────────────────────
export default function GuildPostDetailScreen() {
  useThemedStatusBar('light');
  const { id, comments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const router = useRouter();
  const { posts, guildColors } = useGuildNavStore();
  const listRef = useRef<FlatList<GuildPost>>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const idx = posts.findIndex((p) => p.id === id);
    return idx >= 0 ? idx : 0;
  });

  const initialIndex = posts.findIndex((p) => p.id === id);

  // Shoppable Post (#2): verknüpfte Produkte für alle Pager-Posts nachladen.
  const guildPostIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const productByPost = useFeedProducts(guildPostIds);

  // ✅ Hooks VOR bedingtem Return (Rules of Hooks)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
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
        autoOpenComments={item.id === id && comments === '1'}
        product={productByPost[item.id] ?? null}
      />
    ),
    [guildColors, activeIndex, router, id, comments, productByPost]
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
        // iOS: AUS — removeClippedSubviews clippt/re-attached das aktive Item beim
        // Weg-/Zurück-Navigieren (Profilbesuch aus den Kommentaren). Das (a) lässt
        // sheetProgress auf 1 hängen + den useFocusEffect-Reopen verpuffen (Video
        // klein + schwarze Lücke, Kommentare zu) und (b) verhindert, dass die
        // animierte Container-Höhe ans native Video-Frame durchpropagiert (Video
        // bleibt voll groß → unten/seitlich abgeschnitten im Peek). Der Feed
        // (app/(tabs)/index.tsx) nutzt aus genau diesem Grund nur Android.
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Linker Edge-Strip für Swipe-Back (wie iOS/Short-Video) */}
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
  mediaWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#050508',
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
    right: 12,
    alignItems: 'center',
    gap: 10,
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
  },
  // Shadow-Wrapper: hüllt das gefüllte weiße Icon in einen dunklen Halo →
  // sichtbar auf JEDEM Hintergrund (echtes Display, nicht nur Screenshot).
  // Höhe hugt das Icon (34) → Zähler sitzt eng darunter.
  iconWrap: {
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 6,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  // Kommentar-Blase: gefüllte weiße Blase + 3 dunkle Punkte.
  bubbleWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  bubbleDots: { position: 'absolute', top: 9, flexDirection: 'row', gap: 2.5 },
  bubbleDot: { width: 2.6, height: 2.6, borderRadius: 1.3, backgroundColor: '#111' },
  bottomInfo: {
    position: 'absolute',
    // bottom wird inline gesetzt (insets.bottom + 54) → sitzt dicht über der
    // Kommentar-Eingabeleiste (commentBarH 48 + 6px Luft), wie in user-posts.
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

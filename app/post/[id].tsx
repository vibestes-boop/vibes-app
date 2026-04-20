import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Keyboard,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { Easing, useAnimatedStyle, useSharedValue, withTiming, withSequence, withSpring, withRepeat, withDelay } from 'react-native-reanimated';
import { ArrowLeft, Heart, MessageCircle, Bookmark, Share2, Trash2, Pencil, Volume2, VolumeX, Send, Music2 } from 'lucide-react-native';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO, type FeedVideoSeekHandle } from '@/components/feed/FeedVideo';
import { VideoProgressBar, type VideoProgressHandle } from '@/components/feed/FeedItem';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useLike } from '@/lib/useLike';
import { useCommentCount, useAddComment } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { sharePost } from '@/lib/useShare';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { useFeedNavStore } from '@/lib/feedNavStore';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';


const { width: W, height: H } = Dimensions.get('window');

// ─── Floating Heart — eigenständige Komponente pro Tap ────────────────────────
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

// ─── Comment Input Bar (TikTok-Style) ───────────────────────────────────────
const COMMENT_BAR_H = 58;

function CommentInputBar({
  postId,
  avatarUrl,
  username,
  onCommentsOpen,
}: {
  postId: string;
  avatarUrl: string | null;
  username: string | null;
  onCommentsOpen: () => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { mutateAsync: addComment, isPending } = useAddComment(postId);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    setText('');
    Keyboard.dismiss();
    await addComment({ text: trimmed, tempId: `temp-${Date.now()}` });
  };

  return (
    <View style={cb.bar}>
      <Pressable onPress={() => inputRef.current?.focus()} style={cb.avatar}>
        {avatarUrl
          ? <View style={[cb.avatar, { overflow: 'hidden' }]}>
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          </View>
          : <Text style={cb.avatarInitial}>{username?.[0]?.toUpperCase() ?? '?'}</Text>
        }
      </Pressable>
      <Pressable style={cb.inputWrap} onPress={() => inputRef.current?.focus()}>
        <TextInput
          ref={inputRef}
          style={cb.input}
          placeholder="Kommentar schreiben …"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="send"
          blurOnSubmit={false}
          maxLength={500}
          selectionColor="#FFFFFF"
        />
      </Pressable>
      {text.trim().length > 0 ? (
        <Pressable onPress={submit} disabled={isPending} style={cb.sendBtn} hitSlop={8}>
          {isPending
            ? <ActivityIndicator size={16} color="#FFFFFF" />
            : <Send size={20} stroke="#FFFFFF" strokeWidth={2.2} />
          }
        </Pressable>
      ) : (
        <Pressable onPress={onCommentsOpen} style={cb.sendBtn} hitSlop={8}>
          <MessageCircle size={20} stroke="rgba(255,255,255,0.5)" strokeWidth={1.8} />
        </Pressable>
      )}
    </View>
  );
}




type PostDetail = {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  tags: string[];
  created_at: string;
  author_id: string;
  audio_url: string | null;
  audio_volume: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

function LikeButtonDetail({ postId }: { postId: string }) {
  const { liked, formattedCount, toggle } = useLike(postId);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.7, { duration: 60 }),
      withTiming(1.35, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    toggle();
  };

  return (
    <Pressable onPress={handlePress} style={styles.actionBtn}>
      <Animated.View style={[
        styles.actionBtnInner,
        animStyle,
        liked && { backgroundColor: 'rgba(238,29,82,0.18)' },
      ]}>
        <Heart
          size={24}
          stroke={liked ? '#EE1D52' : '#FFFFFF'}
          strokeWidth={1.8}
          fill={liked ? '#EE1D52' : 'transparent'}
        />
      </Animated.View>
      <Text style={[styles.actionCount, liked && { color: '#EE1D52' }]}>
        {formattedCount}
      </Text>
    </Pressable>
  );
}

function BookmarkButtonDetail({ postId }: { postId: string }) {
  const { bookmarked, toggle } = useBookmark(postId);
  return (
    <Pressable style={styles.actionBtn} onPress={toggle}>
      <View style={[
        styles.actionBtnInner,
        bookmarked && { backgroundColor: 'rgba(251,191,36,0.15)' },
      ]}>
        <Bookmark
          size={24}
          stroke={bookmarked ? '#FBBF24' : '#FFFFFF'}
          strokeWidth={1.8}
          fill={bookmarked ? '#FBBF24' : 'transparent'}
        />
      </View>
    </Pressable>
  );
}

function CommentButtonDetail({ postId, onPress }: { postId: string; onPress: () => void }) {
  const { data: count = 0 } = useCommentCount(postId);
  const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionBtnInner}>
        <MessageCircle size={24} stroke="#FFFFFF" strokeWidth={1.8} />
      </View>
      <Text style={styles.actionCount}>{formatted}</Text>
    </Pressable>
  );
}

export default function PostDetailScreen() {
  const { id, previewUrl, previewType, previewCaption, openComments } = useLocalSearchParams<{
    id: string;
    previewUrl?: string;
    previewType?: string;
    previewCaption?: string;
    openComments?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteFlash, setShowMuteFlash] = useState<'muted' | 'unmuted' | null>(null);
  const isOwner = post?.author_id === profile?.id;
  // Musik-Track Audio (expo-av — identisch zu FeedItem)
  const audioSoundRef = useRef<any>(null);

  // Scrubbarer Fortschrittsbalken (wie Haupt-Feed, mit Seek-Lock gegen Sprung)
  const progressBarRef = useRef<VideoProgressHandle>(null);
  const videoSeekRef   = useRef<FeedVideoSeekHandle>(null);
  const handleProgress = useCallback((p: number) => progressBarRef.current?.setProgress(p), []);
  const handleSeek     = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);
  const handleSeekEnd  = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);

  // ── TikTok-Style: Finger-folgendes Profil-Panel (identisch zu Vibes-Feed) ──
  const SCREEN_W = Dimensions.get('window').width;
  const profileSlideX = useRef(new RNAnimated.Value(SCREEN_W)).current;
  const [profilePanel, setProfilePanel] = useState<{ authorId: string } | null>(null);
  const profilePanelRef = useRef<{ authorId: string } | null>(null);

  const snapPanelIn = () =>
    RNAnimated.spring(profileSlideX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  const snapPanelOut = () =>
    RNAnimated.spring(profileSlideX, { toValue: SCREEN_W, useNativeDriver: true, bounciness: 0, speed: 25 }).start(
      () => { setProfilePanel(null); profilePanelRef.current = null; }
    );

  // postAuthorId: beim Rendern noch nicht bekannt (post lädt async) → ref verwenden
  const postAuthorIdRef = useRef<string | null>(null);

  const swipeLeftPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -18 && Math.abs(g.dx) > Math.abs(g.dy) * 2.0,

      onPanResponderGrant: () => {
        const authorId = postAuthorIdRef.current;
        if (!authorId) return;
        const panel = { authorId };
        profilePanelRef.current = panel;
        setProfilePanel(panel);
        profileSlideX.setValue(SCREEN_W);
      },

      onPanResponderMove: (_, g) => {
        if (!profilePanelRef.current) return;
        profileSlideX.setValue(Math.max(0, SCREEN_W + g.dx));
      },

      onPanResponderRelease: (_, g) => {
        if (!profilePanelRef.current) return;
        if (g.dx < -(SCREEN_W * 0.35) || g.vx < -0.5) {
          impactAsync(ImpactFeedbackStyle.Medium);
          snapPanelIn();
        } else {
          snapPanelOut();
        }
      },

      onPanResponderTerminate: () => snapPanelOut(),
    })
  ).current;

  const backPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,

      onPanResponderMove: (_, g) => {
        profileSlideX.setValue(Math.min(SCREEN_W, Math.max(0, g.dx)));
      },

      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_W * 0.35 || g.vx > 0.5) {
          impactAsync(ImpactFeedbackStyle.Light);
          snapPanelOut();
        } else {
          snapPanelIn();
        }
      },

      onPanResponderTerminate: () => snapPanelIn(),
    })
  ).current;

  // Tap-to-like + Multiple Floating Hearts
  const postIdParam = Array.isArray(id) ? id[0] : (id ?? '');
  const { liked, toggle: tapToggleLike } = useLike(postIdParam);
  const [hearts, setHearts] = useState<FloatingHeartItem[]>([]);
  const heartIdRef = useRef(0);
  const lastTap = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const muteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVideo = (post?.media_type ?? previewType) === 'video';

  const spawnHeart = useCallback((x: number, y: number) => {
    const newId = heartIdRef.current++;
    setHearts((prev) => [...prev, { id: newId, x, y }]);
  }, []);

  const handleTap = useCallback((evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 250;
    const pos = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // — Doppel-Tap: Like + Herz —
      if (muteTimeoutRef.current) {
        clearTimeout(muteTimeoutRef.current);
        muteTimeoutRef.current = null;
      }
      if (!liked) tapToggleLike();
      spawnHeart(lastTapPos.current.x, lastTapPos.current.y);
      lastTap.current = 0;
      return;
    }

    lastTap.current = now;
    lastTapPos.current = pos;

    // — Einfacher Tap: nach 260ms Mute/Unmute (wenn kein Doppel-Tap folgt) —
    if (isVideo) {
      muteTimeoutRef.current = setTimeout(() => {
        muteTimeoutRef.current = null;
        setIsMuted((m) => {
          const next = !m;
          // Flash-Feedback: kurz anzeigen dann verstecken
          setShowMuteFlash(next ? 'muted' : 'unmuted');
          setTimeout(() => setShowMuteFlash(null), 700);
          return next;
        });
      }, DOUBLE_TAP_DELAY + 10);
    }
  }, [liked, tapToggleLike, spawnHeart, isVideo]);

  // ─── Swipe-Navigation (hoch = nächster Post, runter = vorheriger Post) ─────
  const feedNavPostIds = useFeedNavStore((s) => s.postIds);
  const currentIndex = feedNavPostIds.indexOf(Array.isArray(id) ? id[0] : (id ?? ''));
  const prevPostId = currentIndex > 0 ? feedNavPostIds[currentIndex - 1] : null;
  const nextPostId = currentIndex < feedNavPostIds.length - 1 ? feedNavPostIds[currentIndex + 1] : null;

  const [swipeDir, setSwipeDir] = useState<'up' | 'down' | null>(null);

  const swipePanResponder = useRef(
    PanResponder.create({
      // Vertikale Swipes: erst ab 12px Bewegung übernehmen (verhindert Konflikt mit Tap)
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dy) > 12 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.8,
      onPanResponderMove: (_evt, gs) => {
        if (gs.dy < -20 && nextPostId) setSwipeDir('up');
        else if (gs.dy > 20 && prevPostId) setSwipeDir('down');
        else setSwipeDir(null);
      },
      onPanResponderRelease: (_evt, gs) => {
        setSwipeDir(null);
        const THRESHOLD = 70;
        if (gs.dy < -THRESHOLD && nextPostId) {
          router.replace({ pathname: '/post/[id]', params: { id: nextPostId } });
        } else if (gs.dy > THRESHOLD && prevPostId) {
          router.replace({ pathname: '/post/[id]', params: { id: prevPostId } });
        }
      },
      onPanResponderTerminate: () => setSwipeDir(null),
    })
  ).current;

  // Sofort-Preview aus Params — zeigt Media ohne auf DB zu warten
  const hasPreview = !!previewUrl;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      if (!id) return;

      (async () => {
        setLoading(true);

        // PERF-FIX: Post + Profil in einem einzigen JOIN statt 2 sequentiellen Queries.
        // Vorher: 150ms (post) + 150ms (profile) = 300ms gesamt.
        // Jetzt: ~150ms (ein Round-Trip mit JOIN).
        const { data: postData, error: postErr } = await supabase
          .from('posts')
          .select('id, caption, media_url, media_type, tags, created_at, author_id, audio_url, audio_volume, profiles!author_id(username, avatar_url)')
          .eq('id', id)
          .single();

        if (postErr || !postData) {
          __DEV__ && console.warn('[PostDetail] Post nicht geladen:', postErr?.message);
          setLoading(false);
          return;
        }

        const profileRaw = (postData as any).profiles;
        const profileData: { username: string; avatar_url: string | null } | null =
          Array.isArray(profileRaw) ? (profileRaw[0] ?? null) : (profileRaw ?? null);

        setPost({
          ...postData,
          tags: postData.tags ?? [],
          audio_url: (postData as any).audio_url ?? null,
          audio_volume: (postData as any).audio_volume ?? null,
          profiles: profileData,
        } as PostDetail);
        // Ref setzen für PanResponder (stale-closure-sicher)
        postAuthorIdRef.current = postData.author_id ?? null;
        setLoading(false);

        // Kommentar-Notification: CommentsSheet direkt öffnen
        if (openComments === '1') {
          setTimeout(() => setCommentsOpen(true), 300);
        }
      })();

      return () => setScreenFocused(false);
    }, [id])
  );

  // ── Musik-Playback (expo-av) ─────────────────────────────────────────────
  useEffect(() => {
    const audioUrl = post?.audio_url;
    if (!audioUrl || !screenFocused) {
      audioSoundRef.current?.stopAsync?.().catch(() => {});
      audioSoundRef.current?.unloadAsync?.().catch(() => {});
      audioSoundRef.current = null;
      return;
    }
    const volume = Math.max(0, Math.min(1, post?.audio_volume ?? 0.8));
    let cancelled = false;
    (async () => {
      try {
        const { Audio } = require('expo-av') as any;
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        if (cancelled) return;
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { isLooping: true, volume: isMuted ? 0 : volume }
        );
        if (cancelled) { sound.unloadAsync?.(); return; }
        audioSoundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        __DEV__ && console.warn('[PostDetail Audio]', e);
      }
    })();
    return () => {
      cancelled = true;
      audioSoundRef.current?.stopAsync?.().catch(() => {});
      audioSoundRef.current?.unloadAsync?.().catch(() => {});
      audioSoundRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.audio_url, screenFocused]);

  // Mute auf Musik anwenden
  useEffect(() => {
    if (!audioSoundRef.current || !post?.audio_url) return;
    const volume = Math.max(0, Math.min(1, post?.audio_volume ?? 0.8));
    audioSoundRef.current.setVolumeAsync?.(isMuted ? 0 : volume).catch(() => {});
  }, [isMuted, post?.audio_url, post?.audio_volume]);

  const handleDelete = () => {
    Alert.alert(
      'Post löschen',
      'Möchtest du diesen Vibe wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('posts').delete().eq('id', id);
            await queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
            router.back();
          },
        },
      ]
    );
  };

  // Wenn noch kein Post und keine Preview vorhanden → Spinner
  if (loading && !hasPreview) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  // Post aus DB konnte nicht geladen werden und keine Preview
  if (!loading && !post && !hasPreview) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Post nicht gefunden.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={styles.backBtnText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  // Daten: entweder aus DB (post) oder aus Preview-Params
  const displayMediaUrl = post?.media_url ?? previewUrl ?? null;
  const displayMediaType = post?.media_type ?? previewType ?? 'image';
  const displayCaption = post?.caption ?? previewCaption ?? null;
  const displayAuthorId = post?.author_id ?? null;
  const displayCreatedAt = post?.created_at ?? null;
  const displayTags = post?.tags ?? [];
  const displayUsername = post?.profiles?.username ?? null;
  const displayAvatarUrl = post?.profiles?.avatar_url ?? null;

  const formattedDate = displayCreatedAt
    ? new Date(displayCreatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      {...swipeLeftPan.panHandlers}
    >
      {/* swipePanResponder auf den inneren View — übernimmt nur vertikale Gesten */}
      <View style={styles.container} {...swipePanResponder.panHandlers}>

        {/* 1. BACKGROUND — Bilder als Geschwister (NICHT in Pressable) */}
        {displayMediaUrl ? (
          displayMediaType === 'video' ? (
            USE_EXPO_VIDEO ? (
              <NativeFeedVideo
                ref={videoSeekRef}
                uri={displayMediaUrl}
                shouldPlay={screenFocused}
                isMuted={isMuted}
                onProgress={handleProgress}
              />
            ) : (
              <FallbackFeedVideo
                ref={videoSeekRef}
                uri={displayMediaUrl}
                shouldPlay={screenFocused}
                isMuted={isMuted}
                onProgress={handleProgress}
              />
            )
          ) : (
            <>
              <Image
                source={{ uri: displayMediaUrl }}
                style={[StyleSheet.absoluteFill, { opacity: 0.12 }]}
                contentFit="cover"
                blurRadius={20}
              />
              <Image
                source={{ uri: displayMediaUrl }}
                style={styles.mainImage}
                contentFit="contain"
              />
            </>
          )
        ) : (
          <LinearGradient
            colors={['#0A0A0A', '#1a0533', '#0d1f4a']}
            style={StyleSheet.absoluteFill}
          />
        )}


        {/* 4. TAP-ZONE — Einfacher Tap = Mute/Unmute, Doppel-Tap = Like + Herz */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleTap as any}
        />

        {/* 5. HEARTS — je ein FloatingHeart pro Tap, unabhängige Animationen */}
        {hearts.map((h) => (
          <FloatingHeart
            key={h.id}
            x={h.x}
            y={h.y}
            onDone={() => setHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
          />
        ))}

        {/* 6. MUTE-FLASH — kurzes visuelles Feedback beim Tap (wie TikTok/Instagram) */}
        {showMuteFlash !== null && (
          <View style={tapFeedbackStyles.muteFlash} pointerEvents="none">
            {showMuteFlash === 'muted'
              ? <VolumeX size={52} color="#fff" strokeWidth={1.6} />
              : <Volume2 size={52} color="#fff" strokeWidth={1.6} />}
          </View>
        )}

        {/* 7. SWIPE-INDIKATOREN — erscheinen beim Swipen, zeigen nächsten/vorherigen Post */}
        {swipeDir === 'up' && nextPostId && (
          <View style={tapFeedbackStyles.swipeIndicatorTop} pointerEvents="none">
            <Text style={tapFeedbackStyles.swipeArrow}>↑</Text>
            <Text style={tapFeedbackStyles.swipeLabel}>Nächster Post</Text>
          </View>
        )}
        {swipeDir === 'down' && prevPostId && (
          <View style={tapFeedbackStyles.swipeIndicatorBottom} pointerEvents="none">
            <Text style={tapFeedbackStyles.swipeLabel}>Vorheriger Post</Text>
            <Text style={tapFeedbackStyles.swipeArrow}>↓</Text>
          </View>
        )}

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} stroke="#FFFFFF" strokeWidth={2} />
          </Pressable>

          {isOwner && post && (
            <View style={styles.ownerActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/edit-post/[id]', params: { id: id! } })}
                style={styles.editBtn}
                hitSlop={8}
              >
                <Pencil size={17} stroke="#FFFFFF" strokeWidth={2} />
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={8}>
                <Trash2 size={17} stroke="#F87171" strokeWidth={2} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Rechte Aktionen — nur wenn Post aus DB geladen (brauchen post.id) */}
        {post && (
          <>
            <View style={[styles.rightActions, { bottom: insets.bottom + 8 }]}>
              {/* Mute-Button: erscheint wenn Video ODER Musik-Track vorhanden */}
              {(isVideo || post.audio_url) && (
                <Pressable
                  onPress={() => setIsMuted(m => !m)}
                  style={styles.actionBtn}
                  hitSlop={12}
                >
                  <View style={styles.actionBtnInner}>
                    {isMuted
                      ? <VolumeX size={22} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
                      : <Volume2 size={22} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />}
                  </View>
                </Pressable>
              )}
              <LikeButtonDetail postId={post.id} />
              <CommentButtonDetail postId={post.id} onPress={() => setCommentsOpen(true)} />
              <BookmarkButtonDetail postId={post.id} />
              <Pressable style={styles.actionBtn} onPress={() => sharePost(post.id, post.caption)}>
                <View style={styles.actionBtnInner}>
                  <Share2 size={24} stroke="#FFFFFF" strokeWidth={1.8} />
                </View>
              </Pressable>
            </View>
            <CommentsSheet
              postId={post.id}
              visible={commentsOpen}
              onClose={() => setCommentsOpen(false)}
              onUserPress={(userId) => {
                setCommentsOpen(false);
                router.push({ pathname: '/user/[id]', params: { id: userId } });
              }}
            />
          </>
        )}

        {/* Unten: Autor, Caption, Tags, Datum */}
        <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            style={styles.authorRow}
            onPress={() => displayAuthorId && router.push({ pathname: '/user/[id]', params: { id: displayAuthorId } })}
          >
            <View style={styles.avatarSmall}>
              {displayAvatarUrl ? (
                <Image
                  source={{ uri: displayAvatarUrl }}
                  style={styles.avatarSmallImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {displayUsername?.[0]?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.authorName}>@{displayUsername ?? 'unknown'}</Text>
              {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
            </View>
          </Pressable>

          {displayCaption ? (
            <Text style={styles.caption}>{displayCaption}</Text>
          ) : null}

          {/* Musik-Badge (TikTok-Style rollender Text) */}
          {post?.audio_url && (
            <Pressable
              onPress={() => setIsMuted(m => !m)}
              style={styles.musicBadge}
            >
              <Music2 size={12} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              <Text style={styles.musicBadgeText} numberOfLines={1}>
                {isMuted ? '🔇 ' : '♪ '}
                {post.audio_url.split('/').pop()?.replace(/\.mp3|%20/g, ' ')?.slice(0, 30) ?? 'Sound'}
                {post.audio_volume != null ? `  ·  ${Math.round(post.audio_volume * 100)}%` : ''}
              </Text>
            </Pressable>
          )}

          {displayTags.length > 0 && (
            <View style={styles.tagsRow}>
              {displayTags.map((tag) => (
                <Pressable
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tag } } as any)}
                  hitSlop={6}
                  accessibilityRole="link"
                  accessibilityLabel={`Hashtag ${tag} in Explore suchen`}
                >
                  <Text style={styles.tagText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Scrubbarer Fortschrittsbalken — wie Haupt-Feed, kein Sprung-Effekt */}
        {isVideo && (
          <VideoProgressBar
            ref={progressBarRef}
            postId={Array.isArray(id) ? id[0] : (id ?? '')}
            onSeek={handleSeek}
            onSeekEnd={handleSeekEnd}
            bottomOffset={insets.bottom + COMMENT_BAR_H + 6}
          />
        )}
      </View>

      {/* TikTok-Style Kommentar-Eingabeleiste */}
      {post && (
        <CommentInputBar
          postId={post.id}
          avatarUrl={profile?.avatar_url ?? null}
          username={profile?.username ?? null}
          onCommentsOpen={() => setCommentsOpen(true)}
        />
      )}

      {/* TikTok-Style Profil-Panel — erscheint beim Linksswipe über den Post */}
      {profilePanel && (
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 400, transform: [{ translateX: profileSlideX }] },
          ]}
          {...backPan.panHandlers}
        >
          {/* Schatten-Linie links */}
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <UserProfileContent
            userId={profilePanel.authorId}
            onBack={snapPanelOut}
          />
        </RNAnimated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFound: { color: '#6B7280', fontSize: 16 },
  backBtnCenter: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '600' },
  mainImage: {
    width: W,
    height: H,
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(248,113,113,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    gap: 4,
    alignItems: 'center',
  },
  actionBtn: { alignItems: 'center', marginBottom: 12 },
  actionBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 72,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  avatarSmallImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  authorName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dateText: { color: '#6B7280', fontSize: 11, marginTop: 1 },
  caption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  musicBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4,
  },
  musicBadgeText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', flex: 1 },
});

// ─── Comment bar styles (separat damit kein Konflikt mit 'styles') ────────────

const cb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { color: '#fff', fontSize: 14, fontWeight: '800' },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

// Flash-Feedback beim Mute/Unmute-Tap + Swipe-Indikatoren
const tapFeedbackStyles = StyleSheet.create({
  muteFlash: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  swipeIndicatorTop: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    zIndex: 50,
  },
  swipeIndicatorBottom: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    zIndex: 50,
  },
  swipeArrow: {
    fontSize: 28,
    color: '#fff',
    opacity: 0.9,
  },
  swipeLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

import { VideoProgressBar,type VideoProgressHandle } from '@/components/feed/FeedItem';
import { FallbackFeedVideo,NativeFeedVideo,USE_EXPO_VIDEO,type FeedVideoSeekHandle } from '@/components/feed/FeedVideo';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { useAuthStore } from '@/lib/authStore';
import { useFeedNavStore } from '@/lib/feedNavStore';
import { useFeedProducts } from '@/lib/useFeedProducts';
import { ProductFeedChip } from '@/components/feed/ProductFeedChip';
import { supabase } from '@/lib/supabase';
import { useBookmark } from '@/lib/useBookmark';
import { useAddComment,useCommentCount } from '@/lib/useComments';
import { useLike } from '@/lib/useLike';
import { sharePost } from '@/lib/useShare';
import { useQueryClient } from '@tanstack/react-query';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect,useLocalSearchParams,useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { ArrowLeft,Bookmark,Heart,MessageCircle,Music2,Pause,Pencil,Play,Send,Share2,Trash2,Volume2,VolumeX } from 'lucide-react-native';
import { useCallback,useEffect,useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
Dimensions,
Keyboard,
KeyboardAvoidingView,
PanResponder,
Platform,
Pressable,
Animated as RNAnimated,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { Extrapolation,interpolate,useAnimatedStyle,useSharedValue,withSequence,withSpring,withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };


const { width: W, height: H } = Dimensions.get('window');
// Muss mit CommentsSheet SHEET_TOP_SEAMLESS (0.40) übereinstimmen: das Video
// schrumpft beim Kommentar-Öffnen auf diesen oberen Peek und läuft dort weiter.
const COMMENTS_PEEK_H = Math.round(H * 0.40);

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

// ─── Comment Input Bar (Short-Video-Style) ───────────────────────────────────────
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
  bunny_video_id: string | null;
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
      <Animated.View style={[styles.actionBtnInner, animStyle]}>
        <Heart
          size={26}
          stroke={liked ? '#EE1D52' : '#FFFFFF'}
          strokeWidth={2}
          fill={liked ? '#EE1D52' : '#FFFFFF'}
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
      <View style={styles.actionBtnInner}>
        <Bookmark
          size={26}
          stroke={bookmarked ? '#FBBF24' : '#FFFFFF'}
          strokeWidth={2}
          fill={bookmarked ? '#FBBF24' : '#FFFFFF'}
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
        <View style={styles.bubbleWrap}>
          <MessageCircle size={26} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
          <View style={styles.bubbleDots}>
            <View style={styles.bubbleDot} />
            <View style={styles.bubbleDot} />
            <View style={styles.bubbleDot} />
          </View>
        </View>
      </View>
      <Text style={styles.actionCount}>{formatted}</Text>
    </Pressable>
  );
}

export default function PostDetailScreen() {
  useThemedStatusBar('light');
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
  // Nur fürs Profil-Aufrufen geschlossen → beim Zurückkommen wieder öffnen.
  const reopenCommentsRef = useRef(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Kurzer Play/Pause-Blitz in der Mitte beim Tap (Mute liegt auf dem eigenen Button).
  const [showMuteFlash, setShowMuteFlash] = useState<'paused' | 'playing' | null>(null);
  const isOwner = post?.author_id === profile?.id;
  // Musik-Track Audio (expo-av — identisch zu FeedItem)
  const audioSoundRef = useRef<any>(null);

  // Scrubbarer Fortschrittsbalken (wie Haupt-Feed, mit Seek-Lock gegen Sprung)
  const progressBarRef = useRef<VideoProgressHandle>(null);
  const videoSeekRef   = useRef<FeedVideoSeekHandle>(null);
  const handleProgress = useCallback((p: number) => progressBarRef.current?.setProgress(p), []);
  const handleSeek     = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);
  const handleSeekEnd  = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);
  const [restartSignal, setRestartSignal] = useState(0);
  const focusPlaybackRef = useRef({ mediaUrl: '', focused: false });

  // ── Short-Video-Style: Finger-folgendes Profil-Panel (identisch zu Vibes-Feed) ──
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
  const currentMediaUrl = post?.media_url ?? previewUrl ?? '';

  useEffect(() => {
    const previous = focusPlaybackRef.current;
    const wasFocused = previous.mediaUrl === currentMediaUrl ? previous.focused : false;
    focusPlaybackRef.current = { mediaUrl: currentMediaUrl, focused: screenFocused };

    if (!isVideo || !currentMediaUrl) return;
    if (screenFocused && (!wasFocused || previous.mediaUrl !== currentMediaUrl)) {
      progressBarRef.current?.setProgress(0);
      setRestartSignal((signal) => signal + 1);
    }
    if (!screenFocused && wasFocused) {
      progressBarRef.current?.setProgress(0);
    }
  }, [currentMediaUrl, isVideo, screenFocused]);

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

    // — Einfacher Tap: nach 260ms Pause/Play togglen (wenn kein Doppel-Tap folgt) —
    // Vorher togglte der Tap Mute — Mute liegt jetzt auf dem eigenen Button.
    // Pause = TikTok-Standard: einmal tippen hält das Video an.
    if (isVideo) {
      muteTimeoutRef.current = setTimeout(() => {
        muteTimeoutRef.current = null;
        setIsPaused((p) => {
          const next = !p;
          setShowMuteFlash(next ? 'paused' : 'playing');
          setTimeout(() => setShowMuteFlash(null), 600);
          return next;
        });
      }, DOUBLE_TAP_DELAY + 10);
    }
  }, [liked, tapToggleLike, spawnHeart, isVideo]);

  // ── Nahtloser Kommentar-Peek (wie im Feed) ──────────────────────────────────
  // sheetProgress: 0 = Kommentare zu (Video voll), 1 = offen (Video schrumpft auf
  // den oberen Peek und läuft WEITER — keine zweite Instanz, kein Neustart).
  const sheetProgress = useSharedValue(0);
  useEffect(() => {
    if (commentsOpen) {
      sheetProgress.value = withSpring(1, { damping: 22, stiffness: 180, mass: 0.8 });
    } else if (!reopenCommentsRef.current) {
      sheetProgress.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.8 });
    }
  }, [commentsOpen, sheetProgress]);
  const mediaAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(sheetProgress.value, [0, 1], [H, COMMENTS_PEEK_H], Extrapolation.CLAMP),
  }));
  // Overlays (Aktionen, Autor/Caption, Fortschritt) faden aus, sobald die
  // Kommentare aufgehen — der Peek zeigt dann nur das laufende Video.
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));

  // Shoppable Post (#2): verknüpftes Produkt für diesen Post (Batch-Hook mit 1 ID).
  const postIdStr = Array.isArray(id) ? id[0] : (id ?? null);
  const productByPost = useFeedProducts(postIdStr ? [postIdStr] : []);
  const linkedProduct = postIdStr ? productByPost[postIdStr] : undefined;

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
          .select('id, caption, media_url, media_type, tags, created_at, author_id, audio_url, audio_volume, bunny_video_id, profiles!author_id(username, avatar_url)')
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
          bunny_video_id: (postData as any).bunny_video_id ?? null,
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
    }, [id, openComments])
  );

  // Beim Zurückkommen vom Profil: Kommentare wieder öffnen.
  useFocusEffect(
    useCallback(() => {
      if (reopenCommentsRef.current) {
        reopenCommentsRef.current = false;
        setCommentsOpen(true);
      }
    }, []),
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
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

        {/* 1. BACKGROUND — als Ganzes in einer Animated-Layer, die beim
            Kommentar-Öffnen auf den oberen Peek schrumpft (Video läuft weiter,
            keine zweite Instanz). pointerEvents none → die Tap-Zone darunter
            bekommt weiterhin alle Taps (Pause/Like). */}
        <Animated.View style={[styles.mediaLayer, mediaAnimStyle]} pointerEvents="none">
        {displayMediaUrl ? (
          displayMediaType === 'video' ? (
            USE_EXPO_VIDEO ? (
              <NativeFeedVideo
                ref={videoSeekRef}
                uri={displayMediaUrl}
                shouldPlay={screenFocused && !isPaused}
                isMuted={isMuted}
                onProgress={handleProgress}
                restartSignal={restartSignal}
                bunnyVideoId={post?.bunny_video_id ?? null}
              />
            ) : (
              <FallbackFeedVideo
                ref={videoSeekRef}
                uri={displayMediaUrl}
                shouldPlay={screenFocused && !isPaused}
                isMuted={isMuted}
                onProgress={handleProgress}
                restartSignal={restartSignal}
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
                style={StyleSheet.absoluteFill}
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
        </Animated.View>


        {/* 4. TAP-ZONE — Einfacher Tap = Pause/Play, Doppel-Tap = Like + Herz */}
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

        {/* 6. PLAY/PAUSE-BLITZ beim Tap (kurz). Dazu ein PERSISTENTES Play-Icon,
            solange pausiert ist (TikTok) — verschwindet erst beim Weiterspielen. */}
        {showMuteFlash !== null && (
          <View style={tapFeedbackStyles.muteFlash} pointerEvents="none">
            {showMuteFlash === 'paused'
              ? <Pause size={52} color="#fff" fill="#fff" strokeWidth={1.6} />
              : <Play size={52} color="#fff" fill="#fff" strokeWidth={1.6} />}
          </View>
        )}
        {isVideo && isPaused && showMuteFlash === null && (
          <View style={tapFeedbackStyles.muteFlash} pointerEvents="none">
            <Play size={60} color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.85)" strokeWidth={1.4} />
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
            <ArrowLeft size={22} stroke="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          {isOwner && post && (
            <View style={styles.ownerActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/edit-post/[id]', params: { id: id! } })}
                style={styles.editBtn}
                hitSlop={8}
              >
                <Pencil size={19} stroke="#FFFFFF" strokeWidth={2.2} />
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={8}>
                <Trash2 size={19} stroke="#F87171" strokeWidth={2.2} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Rechte Aktionen — nur wenn Post aus DB geladen (brauchen post.id) */}
        {post && (
          <>
            <Animated.View
              style={[styles.rightActions, { bottom: insets.bottom + 8 }, overlayFadeStyle]}
              pointerEvents={commentsOpen ? 'none' : 'box-none'}
            >
              {/* Mute-Button: erscheint wenn Video ODER Musik-Track vorhanden */}
              {(isVideo || post.audio_url) && (
                <Pressable
                  onPress={() => setIsMuted(m => !m)}
                  style={styles.actionBtn}
                  hitSlop={12}
                >
                  <View style={styles.actionBtnInner}>
                    {isMuted
                      ? <VolumeX size={23} color="#FFFFFF" strokeWidth={0} fill="#FFFFFF" />
                      : <Volume2 size={23} color="#FFFFFF" strokeWidth={0} fill="#FFFFFF" />}
                  </View>
                </Pressable>
              )}
              <LikeButtonDetail postId={post.id} />
              <CommentButtonDetail postId={post.id} onPress={() => setCommentsOpen(true)} />
              <BookmarkButtonDetail postId={post.id} />
              <Pressable style={styles.actionBtn} onPress={() => sharePost(post.id, post.caption)}>
                <View style={styles.actionBtnInner}>
                  <Share2 size={25} stroke="#FFFFFF" strokeWidth={2.3} />
                </View>
              </Pressable>
            </Animated.View>
            <CommentsSheet
              postId={post.id}
              visible={commentsOpen}
              seamlessPeek
              sheetProgress={sheetProgress}
              onClose={() => setCommentsOpen(false)}
              onUserPress={(userId) => {
                reopenCommentsRef.current = true;
                setCommentsOpen(false);
                router.push({ pathname: '/user/[id]', params: { id: userId } });
              }}
            />
          </>
        )}

        {/* Unten: Autor, Caption, Tags, Datum — fadet mit den Kommentaren aus */}
        <Animated.View
          style={[styles.bottomInfo, { paddingBottom: insets.bottom + 8 }, overlayFadeStyle]}
          pointerEvents={commentsOpen ? 'none' : 'box-none'}
        >
          {/* Shoppable Post (#2): kompakte Produkt-Pille ÜBER dem Autor-Block,
              damit Nickname + Caption an ihrer gewohnten Position bleiben */}
          {linkedProduct && <ProductFeedChip product={linkedProduct} style={{ marginBottom: 10 }} />}

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

          {/* Musik-Badge (Short-Video-Style rollender Text) */}
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
        </Animated.View>

        {/* Scrubbarer Fortschrittsbalken — fadet mit den Kommentaren aus */}
        {isVideo && (
          <Animated.View style={overlayFadeStyle} pointerEvents={commentsOpen ? 'none' : 'box-none'}>
            <VideoProgressBar
              ref={progressBarRef}
              postId={Array.isArray(id) ? id[0] : (id ?? '')}
              onSeek={handleSeek}
              onSeekEnd={handleSeekEnd}
              bottomOffset={insets.bottom + COMMENT_BAR_H + 6}
            />
          </Animated.View>
        )}
      </View>

      {/* Short-Video-Style Kommentar-Eingabeleiste */}
      {post && (
        <CommentInputBar
          postId={post.id}
          avatarUrl={profile?.avatar_url ?? null}
          username={profile?.username ?? null}
          onCommentsOpen={() => setCommentsOpen(true)}
        />
      )}

      {/* Short-Video-Style Profil-Panel — erscheint beim Linksswipe über den Post */}
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
  // Media-Layer: schrumpft beim Kommentar-Öffnen von H auf den oberen Peek.
  // overflow hidden → das absoluteFill-Video/-Bild skaliert sauber in die Höhe.
  mediaLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: H, overflow: 'hidden' },
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
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    gap: 10,
    alignItems: 'center',
  },
  actionBtn: { alignItems: 'center' },
  actionBtnInner: {
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    // Kein Hintergrund-Kreis mehr (bare TikTok-Look). Die weißen Icons bleiben
    // dank kräftigem Schatten auf JEDEM Hintergrund sichtbar (der Schatten hüllt
    // die gefüllte Fläche in einen dunklen Halo, auch auf echtem Display).
    // Höhe hugt das Icon (34 statt 44) → Zähler sitzt eng darunter.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 6,
  },
  actionCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
    // Dunkler Text-Schatten → Zahl bleibt auf hellem Video lesbar (TikTok).
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Kommentar-Blase: gefüllte weiße Blase + 3 dunkle Punkte (leicht nach oben,
  // weil der Blasen-Schwanz unten sitzt → Punkte im Blasenkörper zentriert).
  bubbleWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  bubbleDots: { position: 'absolute', top: 9, flexDirection: 'row', gap: 2.5 },
  bubbleDot: { width: 2.6, height: 2.6, borderRadius: 1.3, backgroundColor: '#111' },
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
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  avatarSmallImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  authorName: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  dateText: {
    color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    lineHeight: 22,
    fontWeight: '400',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    // Dunkler Scrim statt fast-durchsichtigem Weiß → Chip auf hellem Video sichtbar.
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tagText: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
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
  avatarInitial: { color: '#fff', fontSize: 14, fontWeight: '600' },
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

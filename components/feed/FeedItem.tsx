import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated as RNAnimated, PanResponder } from 'react-native';

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
  interpolate,
  Extrapolation,
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
  Users,
  Lock,
  CheckCircle2,
  Music2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommentsSheet from '@/components/ui/CommentsSheet';
import { RichText } from '@/components/ui/RichText';
import { useLike } from '@/lib/useLike';
import { useFollow } from '@/lib/useFollow';
import { useRepost, type UseRepostBatch } from '@/lib/useRepost';

import { useAuthStore } from '@/lib/authStore';
import type { FeedEngagementMaps } from '@/lib/useFeedEngagement';
import type { UseLikeBatch } from '@/lib/useLike';
import type { StoryGroup } from '@/lib/useStories';
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
import { PostShareModal } from './PostShareModal';
import { PostOptionsModal } from './PostOptionsModal';
import { LikersSheet } from '@/components/ui/LikersSheet';
import PostLongPressSheet from './PostLongPressSheet';
import { FallbackFeedVideo, NativeFeedVideo, USE_EXPO_VIDEO, type FeedVideoSeekHandle } from './FeedVideo';
import { WomenOnlyBlur } from '@/components/women-only/WomenOnlyBlur';
import { useWomenOnly } from '@/lib/useWomenOnly';
import {
  ActionButton,
  BookmarkButton,
  CommentButton,
  LikeButton,
  VoiceButton,
} from './FeedActionButtons';
import { feedItemStyles as styles } from './feedStyles';

// ─── VideoProgressBar ───────────────────────────────────────────────────────────────
// Isolierte Komponente — Video-Ticks (bis 60/s) lösen NUR hier einen Re-Render aus.
// Scrubbing: Finger drücken → Balken expandiert → Drag vorwärts/rückwärts → Seek
export interface VideoProgressHandle {
  setProgress: (p: number) => void;
}

export const VideoProgressBar = React.memo(
  React.forwardRef<VideoProgressHandle, {
    postId: string;
    onSeek?: (fraction: number) => void;
    onSeekEnd?: (fraction: number) => void;
    bottomOffset?: number;
  }>(function VideoProgressBar({ onSeek, onSeekEnd, bottomOffset = 49 }, ref) {
    const [isScrubbing, setIsScrubbing] = useState(false);
    const trackWidth = useRef(0);
    // Aktueller Abspiel-Fortschritt (als Ref, damit PanResponder Zugriff hat)
    const currentFractionRef = useRef(0);
    // Fortschritt zum Zeitpunkt des Touch-Starts (für relative Berechnung)
    const scrubStartFractionRef = useRef(0);
    const scrubProgress = useRef(0);
    // Sperrt setProgress nach Release bis Video an Ziel angekommen ist (verhindert Sprung-Effekt)
    const seekLockRef = useRef(false);
    const seekLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekTargetRef = useRef(0); // Ziel-Fraktion des Seeks
    // Alle Animationen nativ
    const fillWidth = useRef(new RNAnimated.Value(0)).current;
    const trackHeight = useRef(new RNAnimated.Value(3)).current;
    const thumbOpacity = useRef(new RNAnimated.Value(0)).current;
    const thumbX = useRef(new RNAnimated.Value(0)).current;

    React.useImperativeHandle(ref, () => ({
      setProgress: (p: number) => {
        // Während Scrubbing ODER während Seek-Sperre: keine externen Updates annehmen.
        // Seek-Sperre bleibt aktiv bis Video nahe am Ziel ist (oder Timeout).
        if (isScrubbing || seekLockRef.current) {
          // Seek-Sperre aufheben sobald Video nahe am Ziel angekommen ist (±3%)
          if (seekLockRef.current && Math.abs(p - seekTargetRef.current) < 0.03) {
            seekLockRef.current = false;
            if (seekLockTimerRef.current) {
              clearTimeout(seekLockTimerRef.current);
              seekLockTimerRef.current = null;
            }
          } else {
            return; // noch nicht am Ziel → Update ignorieren
          }
        }
        currentFractionRef.current = p;
        fillWidth.setValue(p * trackWidth.current);
        thumbX.setValue(p * trackWidth.current);
      },
    }), [isScrubbing, fillWidth, thumbX]);

    const panResponder = useRef(
      PanResponder.create({
        // Capture Phase: beansprucht Geste BEVOR parent-Handler (Profil-Swipe)
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: (_, gs) =>
          Math.abs(gs.dx) > 4 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          // Seek-Sperre aufheben wenn neues Scrubbing startet
          seekLockRef.current = false;
          if (seekLockTimerRef.current) {
            clearTimeout(seekLockTimerRef.current);
            seekLockTimerRef.current = null;
          }
          setIsScrubbing(true);
          // TikTok-Style: Merke aktuellen Fortschritt — Video springt NICHT zur Tipp-Position
          scrubStartFractionRef.current = currentFractionRef.current;
          scrubProgress.current = currentFractionRef.current;
          RNAnimated.parallel([
            RNAnimated.spring(trackHeight, { toValue: 6, useNativeDriver: false, bounciness: 0, speed: 30 }),
            RNAnimated.timing(thumbOpacity, { toValue: 1, duration: 100, useNativeDriver: false }),
          ]).start();
          // Kein onSeek hier — Video springt nicht zur Tipp-Position
        },

        onPanResponderMove: (_, gs) => {
          // Relative Berechnung: delta vom Start-Fortschritt
          // 1 Trackbreite = 100%; dx / trackWidth = Fortschritts-Delta
          const delta = gs.dx / (trackWidth.current || 1);
          const frac = Math.max(0, Math.min(1, scrubStartFractionRef.current + delta));
          scrubProgress.current = frac;
          fillWidth.setValue(frac * trackWidth.current);
          thumbX.setValue(frac * trackWidth.current);
          onSeek?.(frac);
        },

        onPanResponderRelease: () => {
          const target = scrubProgress.current;
          seekTargetRef.current = target;
          // Seek-Sperre setzen: verhindert Sprung durch alte onProgress-Events
          // während das Video noch zur Zielposition seeked.
          seekLockRef.current = true;
          // Fallback-Timeout: Sperre nach 400ms aufheben (falls Video nie nahe genug kommt)
          seekLockTimerRef.current = setTimeout(() => {
            seekLockRef.current = false;
            seekLockTimerRef.current = null;
          }, 400);

          setIsScrubbing(false);
          RNAnimated.parallel([
            RNAnimated.spring(trackHeight, { toValue: 3, useNativeDriver: false, bounciness: 0, speed: 30 }),
            RNAnimated.timing(thumbOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
          onSeekEnd?.(target);
        },

        onPanResponderTerminate: () => {
          setIsScrubbing(false);
          seekLockRef.current = false;
          if (seekLockTimerRef.current) {
            clearTimeout(seekLockTimerRef.current);
            seekLockTimerRef.current = null;
          }
          RNAnimated.parallel([
            RNAnimated.spring(trackHeight, { toValue: 3, useNativeDriver: false, bounciness: 0, speed: 30 }),
            RNAnimated.timing(thumbOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
        },
      })
    ).current;

    return (
      <View
        style={[pbStyles.hitArea, { bottom: bottomOffset }]}
        {...panResponder.panHandlers}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      >
        <RNAnimated.View style={[pbStyles.track, { height: trackHeight }]}>
          <RNAnimated.View style={[pbStyles.fill, { width: fillWidth }]} />
          <RNAnimated.View
            style={[pbStyles.thumb, { left: thumbX, opacity: thumbOpacity }]}
          />
        </RNAnimated.View>
      </View>
    );
  })
);


const pbStyles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 28,
    justifyContent: 'flex-end',
    zIndex: 35,
  },

  track: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 3,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginTop: -7,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
});

import type { FeedItemData } from './types';

const { height: SCREEN_H } = Dimensions.get('window');
// Muss mit CommentsSheet SHEET_TOP (0.22) übereinstimmen:
const COMMENTS_PEEK_H = Math.round(SCREEN_H * 0.22);

// ─── Music Vinyl Badge ─────────────────────────────────────────────────────────
function MusicVinylBadge({ trackTitle }: { trackTitle: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={vinylStyles.row}>
      {/* Rotating vinyl disc */}
      <Animated.View style={[vinylStyles.disc, spinStyle]}>
        <LinearGradient
          colors={['#1a1a2e', '#A78BFA', '#1a1a2e']}
          style={vinylStyles.discGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={vinylStyles.discHole} />
        </LinearGradient>
      </Animated.View>
      {/* Track name */}
      <Music2 size={10} color="rgba(255,255,255,0.6)" strokeWidth={2} />
      <Text style={vinylStyles.trackName} numberOfLines={1}>{trackTitle}</Text>
    </View>
  );
}

const vinylStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    maxWidth: '80%',
  },
  disc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
  },
  discGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discHole: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#050508',
  },
  trackName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});

// ─── Expandable Caption ────────────────────────────────────────────────────────
const COLLAPSED_LINES = 2;

function ExpandableCaption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const btnOpacity = useSharedValue(1);

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
  }));

  const handleToggle = () => {
    btnOpacity.value = withSequence(
      withTiming(0.4, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    setExpanded((e) => !e);
  };

  return (
    <View>
      <RichText
        text={text}
        style={captionStyles.text}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
        onTextLayout={(e) => {
          if (!expanded) setIsTruncated(e.nativeEvent.lines.length >= COLLAPSED_LINES);
        }}
      />
      {isTruncated && (
        <Animated.View style={btnStyle}>
          <Pressable onPress={handleToggle} hitSlop={8}>
            <Text style={captionStyles.toggle}>
              {expanded ? 'weniger' : 'mehr anzeigen'}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const captionStyles = StyleSheet.create({
  text: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  toggle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});


// ─── Floating Heart — eigenständige Komponente pro Tap ────────────────────────
type FloatingHeartItem = { id: number; x: number; y: number };

function FloatingHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const scale = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const rotate = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Einflug: schnelles Spring + gleichzeitiges Hochfloaten + Drehen + Ausblenden
    RNAnimated.parallel([
      // Scale: spring rein
      RNAnimated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
      // Hochfloaten
      RNAnimated.timing(translateY, {
        toValue: -130,
        duration: 1600,
        useNativeDriver: true,
      }),
      // Wackeln: 4x links-rechts
      RNAnimated.sequence([
        RNAnimated.timing(rotate, { toValue: -1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: -1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 1, duration: 120, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
      // Nach 900ms ausblenden
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
          width: 120,
          height: 120,
          left: x - 60,
          top: y - 60,
          alignItems: 'center',
          justifyContent: 'center',
        },
        {
          opacity,
          transform: [
            { translateY },
            { scale },
            { rotate: rotateInterp },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Heart size={90} color="#EE1D52" fill="#EE1D52" />
    </RNAnimated.View>
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
  const insets = useSafeAreaInsets();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  // progress wurde in VideoProgressBar ausgelagert — kein Re-Render des ganzen FeedItem mehr
  const [imageError, setImageError] = useState(false);
  const isVideo = item.mediaType === 'video';

  // ── Musik-Track: Inline Audio-Playback (expo-av) ──────────────────────────
  // Lautstärke kommt aus DB (audio_volume), gesetzt vom Creator im Picker
  const audioSoundRef = useRef<any>(null);
  const audioUrl = typeof item.audioUrl === 'string' && item.audioUrl.startsWith('http')
    ? item.audioUrl
    : null;
  // Volume aus DB lesen (0..1), Fallback 0.8
  const audioVolume = typeof item.audioVolume === 'number'
    ? Math.max(0, Math.min(1, item.audioVolume))
    : 0.8;

  useEffect(() => {
    if (!audioUrl) return;
    if (!shouldPlayVideo) {
      // Post verlassen → Sound stoppen
      audioSoundRef.current?.stopAsync?.().catch(() => {});
      audioSoundRef.current?.unloadAsync?.().catch(() => {});
      audioSoundRef.current = null;
      return;
    }

    let cancelled = false;
    __DEV__ && console.log('[FeedAudio] ▶ Starte:', audioUrl.slice(-40), 'Vol:', audioVolume);

    (async () => {
      try {
        const avMod = require('expo-av') as any;
        const { Audio } = avMod;
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        if (cancelled) return;
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { isLooping: true, volume: audioVolume },  // ← vom Creator gesetzt
        );
        if (cancelled) { sound.unloadAsync?.(); return; }
        audioSoundRef.current = sound;
        await sound.playAsync();
        __DEV__ && console.log('[FeedAudio] ✅ Spielt mit Vol:', audioVolume);
      } catch (err) {
        __DEV__ && console.warn('[FeedAudio] ❌ Fehler:', err);
      }
    })();

    return () => {
      cancelled = true;
      audioSoundRef.current?.stopAsync?.().catch(() => {});
      audioSoundRef.current?.unloadAsync?.().catch(() => {});
      audioSoundRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, shouldPlayVideo]);

  // Mute/Unmute: Lautstärke der Musik live anpassen wenn User den Button drückt
  useEffect(() => {
    if (!audioSoundRef.current) return;
    const targetVol = isMuted ? 0 : audioVolume;
    audioSoundRef.current.setVolumeAsync?.(targetVol).catch(() => {});
  }, [isMuted, audioVolume]);

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

  // ── Women-Only Zone Check ───────────────────────────────────────────────────
  const { canAccessWomenOnly } = useWomenOnly();
  // WOZ-Blur anzeigen wenn: Post ist WOZ + Nutzerin nicht verifiziert
  const showWozBlur = item.womenOnly === true && !canAccessWomenOnly;

  const lastTap = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repostBatch: UseRepostBatch = {
    isReposted: engagement.repostedByPost[item.id] ?? false,
    count: 0, // Repost-Count nicht im Batch — wird beim ersten Toggle nachgeladen
  };
  const { liked, formattedCount: likeFormatted, toggle: toggleLike } = useLike(item.id, likeBatch);
  const { isReposted, count: repostCount, toggle: toggleRepost } = useRepost(item.id, repostBatch);

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


  // ── Media-Resize wenn Comments öffnet (TikTok-Style) ──────────────────────
  // sheetProgress: 0 = geschlossen (Post voll), 1 = offen (Post klein)
  // Wird direkt von CommentsSheet gesteuert → perfekte Synchronisation
  const sheetProgress = useSharedValue(0);

  // Öffnen: progress auf 1 animieren
  useEffect(() => {
    if (commentsOpen) {
      sheetProgress.value = withSpring(1, { damping: 22, stiffness: 180, mass: 0.8 });
    }
    // Schließen passiert via sheetProgress direkt aus CommentsSheet (Drag)
  }, [commentsOpen, sheetProgress]);

  const mediaAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(
      sheetProgress.value,
      [0, 1],
      [SCREEN_H, COMMENTS_PEEK_H],
      Extrapolation.CLAMP,
    ),
    overflow: 'hidden',
  }));

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

  // handleProgress delegiert an isolierte VideoProgressBar — FeedItem re-rendert NICHT bei Video-Ticks
  const progressBarRef = useRef<VideoProgressHandle>(null);
  const handleProgress = useCallback((p: number) => progressBarRef.current?.setProgress(p), []);

  // Seek-Ref: FeedVideo exposed seek(fraction) für den scrubbbaren Fortschrittsbalken
  const videoSeekRef = useRef<FeedVideoSeekHandle>(null);
  const handleSeek = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);
  const handleSeekEnd = useCallback((frac: number) => videoSeekRef.current?.seek(frac), []);

  return (
    <Animated.View style={[styles.feedItem, mediaAnimStyle]}>

      {/* ── Women-Only Blur-Overlay (für nicht-verifizierte Nutzerinnen) ── */}
      {showWozBlur && <WomenOnlyBlur />}

      {/* ── Hintergrund: Bild DIREKT in feedItem */}
      {item.mediaUrl && !isVideo && !imageError && (
        <Image
          source={{ uri: item.mediaUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
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
              ref={videoSeekRef}
              uri={item.mediaUrl}
              shouldPlay={actualShouldPlay}
              isMuted={isMuted}
              onProgress={handleProgress}
              thumbnailUrl={item.thumbnailUrl}
            />
          ) : (
            <FallbackFeedVideo
              ref={videoSeekRef}
              uri={item.mediaUrl}
              shouldPlay={actualShouldPlay}
              isMuted={isMuted}
              onProgress={handleProgress}
              thumbnailUrl={item.thumbnailUrl}
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

        {/* Sound-Button → jetzt in der rightActions-Spalte über dem Like-Button */}

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
        mediaType={item.mediaType ?? undefined}
        mediaUrl={item.mediaUrl ?? undefined}
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
        sheetProgress={sheetProgress}
        mediaUrl={item.mediaUrl}
        mediaType={item.mediaType}
        creatorUserId={item.authorId}
        onUserPress={(userId) => {
          setCommentsOpen(false);
          router.push({ pathname: '/user/[id]', params: { id: userId } });
        }}
      />

      <LikersSheet
        postId={item.id}
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
      />

      <View
        style={[styles.bottomInfo, { paddingBottom: insets.bottom + 52 }]}
        pointerEvents="box-none"
      >

        <View style={styles.tagBadge}>
          <View style={[styles.tagDot, { backgroundColor: item.accentColor }]} />
          <Text style={[styles.tagText, { color: item.accentColor }]}>{item.tag}</Text>
        </View>
        {/* ── Avatar + Name (horizontal) ── */}
        <View style={styles.authorRow}>
          <Pressable
            onPress={() => {
              // TikTok-Style:
              // • hasUnviewed → Story-Viewer öffnen
              // • alle gesehen (kein Ring) → direkt auf Profil
              if (storyGroup?.hasUnviewed && onOpenStory) {
                impactAsync(ImpactFeedbackStyle.Light);
                onOpenStory(storyGroup);
              } else if (item.authorId) {
                router.push({ pathname: '/user/[id]', params: { id: item.authorId } });
              }
            }}
            hitSlop={8}
            style={styles.authorAvatarWrap}
          >
            {storyGroup?.hasUnviewed ? (
              /* Bunter Ring = ungesehene Stories → Klick öffnet Viewer */
              <LinearGradient
                colors={['#FFFFFF', '#F472B6', '#FB923C']}
                style={styles.storyRingGradient}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.storyRingGap}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={[styles.authorAvatar, { width: '100%', height: '100%' }]} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.authorAvatar, styles.authorAvatarFallback, { width: '100%', height: '100%' }]}>
                      <Text style={styles.authorAvatarInitial}>{(item.author[1] ?? '?').toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            ) : item.avatarUrl ? (
              /* Kein Ring (alle gesehen oder keine Stories) → einfacher Avatar, Klick → Profil */
              <Image source={{ uri: item.avatarUrl }} style={styles.authorAvatar} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Text style={styles.authorAvatarInitial}>{(item.author[1] ?? '?').toUpperCase()}</Text>
              </View>
            )}
            {/* TikTok-Style: "+" nur wenn NOCH NICHT gefolgt. Entfolgen → nur auf dem Profil. */}
            {!isOwnProfile && !isFollowing && (
              <Pressable
                onPress={() => {
                  impactAsync(ImpactFeedbackStyle.Light);
                  toggleFollow();
                }}
                style={styles.followBadge}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${item.author} folgen`}
              >
                <Text style={styles.followBadgePlus}>+</Text>
              </Pressable>
            )}
          </Pressable>
          <Pressable
            onPress={() => item.authorId && router.push({ pathname: '/user/[id]', params: { id: item.authorId } })}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={styles.authorName}>{item.author}</Text>
            {/* Goldenes Häkchen für verifizierte Creator */}
            {item.isVerified && (
              <CheckCircle2 size={13} color="#FBBF24" fill="rgba(251,191,36,0.2)" strokeWidth={2.5} />
            )}
            {/* 🌸 Women-Only Badge */}
            {item.womenOnly && (
              <View style={styles.wozBadge}>
                <Text style={styles.wozBadgeText}>🌸</Text>
              </View>
            )}
          </Pressable>
          {/* Privacy Badge: nur bei nicht-öffentlichen Posts sichtbar */}
          {item.privacy && item.privacy !== 'public' && (
            <View style={styles.privacyBadge}>
              {item.privacy === 'friends' ? (
                <Users size={9} color="rgba(255,255,255,0.6)" strokeWidth={2} />
              ) : (
                <Lock size={9} color="rgba(255,255,255,0.6)" strokeWidth={2} />
              )}
              <Text style={styles.privacyBadgeText}>
                {item.privacy === 'friends' ? 'Follower' : 'Privat'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Caption + Hashtags — vertikal unterhalb des Nicknamens (TikTok-Style) ── */}
        {(item.caption || (item.tags && item.tags.length > 0)) && (
          <View style={styles.captionBlock}>
            {item.caption ? (
              <ExpandableCaption text={item.caption} />
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

        {/* ── Musik-Badge (TikTok-Style rotierendes Vinyl) ── */}
        {item.audioTitle && (
          <MusicVinylBadge trackTitle={item.audioTitle} />
        )}

      </View>

      {/* Progress Bar — absolut über Tab-Bar */}
      {isVideo && (
        <VideoProgressBar
          ref={progressBarRef}
          postId={item.id}
          onSeek={handleSeek}
          onSeekEnd={handleSeekEnd}
          bottomOffset={insets.bottom + 49}
        />
      )}

      <View style={[styles.rightActions, { bottom: insets.bottom + 50 }]}>
        {/* Mute-Button — für Videos UND für Bild-Posts mit Musik-Track */}
        {(isVideo || audioUrl) && (
          <>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onMuteToggle(); }}
              style={styles.actionBtn}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
            >
              <View style={styles.muteBtnInner}>
                {isMuted
                  ? <VolumeX size={18} color="rgba(255,255,255,0.85)" strokeWidth={0} fill="rgba(255,255,255,0.85)" />
                  : <Volume2 size={18} color="rgba(255,255,255,0.85)" strokeWidth={0} fill="rgba(255,255,255,0.85)" />}
              </View>
            </Pressable>
            {/* Separator */}
            <View style={styles.muteSeparator} />
          </>
        )}
        <LikeButton
          accentColor={item.accentColor}
          liked={liked}
          formattedCount={likeFormatted}
          onToggle={toggleLike}
          onCountPress={() => setLikersOpen(true)}
        />
        <CommentButton
          postId={item.id}
          onPress={() => setCommentsOpen(true)}
          batchCount={engagement.commentCountByPost[item.id]}
        />
        <BookmarkButton postId={item.id} batchBookmarked={engagement.bookmarkedByPost[item.id]} />
        {/* Voice-Reader: deaktiviert — für spätere AI-Narration Feature */}
        {/* !!item.caption && <VoiceButton postId={item.id} caption={item.caption} creatorUserId={item.authorId} /> */}
        {/* Repost — nur bei fremden Posts */}
        {!isOwnProfile && (
          <ActionButton
            icon={Repeat2}
            accessibilityLabel={isReposted ? 'Repost rückgängig' : 'Post reposten'}
            count={repostCount > 0 ? String(repostCount) : undefined}
            active={isReposted}
            activeColor="#FFFFFF"
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

    </Animated.View>
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

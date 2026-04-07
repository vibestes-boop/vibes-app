/**
 * app/create/trim.tsx
 * Vibes Video-Trimmer — eigener Trimmer ohne externe Libraries.
 *
 * Features:
 *  - Video-Vorschau mit expo-video
 *  - Frame-Strip mit Thumbnails (expo-video-thumbnails)
 *  - Gesture-basierte Trim-Handles (links/rechts)
 *  - Aufnahmedauer-Anzeige
 *  - "Weiter" → /create mit trim params
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');
const STRIP_PADDING = 24;
const STRIP_W = SCREEN_W - STRIP_PADDING * 2;
const HANDLE_W = 22;
const FRAME_COUNT = 8;
const FRAME_W = (STRIP_W - HANDLE_W * 2) / FRAME_COUNT;

// ─── Frame Strip ───────────────────────────────────────────────────────────────
function FrameStrip({
  frames,
  loading,
}: {
  frames: string[];
  loading: boolean;
}) {
  return (
    <View style={strip.container}>
      {loading
        ? Array.from({ length: FRAME_COUNT }).map((_, i) => (
            <View key={i} style={[strip.frame, strip.frameSkel]} />
          ))
        : frames.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={strip.frame}
              contentFit="cover"
            />
          ))}
    </View>
  );
}

const strip = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 56,
  },
  frame: {
    width: FRAME_W,
    height: 56,
  },
  frameSkel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

// ─── Trim Handle ───────────────────────────────────────────────────────────────
function TrimHandle({
  side,
  position,
  onDrag,
  onEnd,
}: {
  side: 'left' | 'right';
  position: ReturnType<typeof useSharedValue<number>>;
  onDrag: (x: number) => void;
  onEnd: () => void;
}) {
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onUpdate((e) => {
      // x ist relativ zur GestureDetector-View — korrekt für Handle-Position
      runOnJS(onDrag)(e.absoluteX - STRIP_PADDING);
    })
    .onEnd(() => {
      runOnJS(onEnd)();
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[handle.wrap, animStyle]}>
        <LinearGradient
          colors={['#22D3EE', '#A855F7']}
          style={handle.bar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Grip Lines */}
          <View style={handle.grip} />
          <View style={handle.grip} />
          <View style={handle.grip} />
        </LinearGradient>
        {/* Pfeil */}
        <Text style={[handle.arrow, side === 'left' ? handle.arrowLeft : handle.arrowRight]}>
          {side === 'left' ? '‹' : '›'}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const handle = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    width: HANDLE_W,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bar: {
    width: HANDLE_W,
    height: '100%',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  grip: {
    width: 2,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1,
  },
  arrow: {
    position: 'absolute',
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    top: -22,
  },
  arrowLeft: { left: 3 },
  arrowRight: { right: 3 },
});

// ─── Haupt TrimScreen ──────────────────────────────────────────────────────────
export default function TrimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mediaUri } = useLocalSearchParams<{ mediaUri: string }>();

  const [frames, setFrames] = useState<string[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [coverSec, setCoverSec] = useState(0);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);

  // Gemessene X-Position des Strips relativ zum Screen (via onLayout + measure)
  const stripOffsetX = useRef(STRIP_PADDING);

  // Handle-Positionen in Pixel (relativ zum Strip)
  const leftPos = useSharedValue(0);
  const rightPos = useSharedValue(STRIP_W - HANDLE_W);
  const coverPos = useSharedValue(0); // Cover-Frame Indikator

  // expo-video player
  const player = useVideoPlayer(mediaUri ?? '', (p) => {
    p.loop = true;
    p.play();
  });

  // Dauer ermitteln
  useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && player.duration > 0) {
        const dur = player.duration;
        setDuration(dur);
        setEndSec(dur);
        rightPos.value = STRIP_W - HANDLE_W;
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // Frame-Thumbnails extrahieren
  useEffect(() => {
    if (!mediaUri) return;
    (async () => {
      setFramesLoading(true);
      try {
        // Duration kommt vom Player-Event; fallback 15s für Frame-Berechnung
        const d = duration > 0 ? duration : 15;

        const thumbs = await Promise.all(
          Array.from({ length: FRAME_COUNT }).map((_, i) => {
            const timeMs = Math.floor((i / (FRAME_COUNT - 1)) * d * 1000);
            return getThumbnailAsync(mediaUri, { time: timeMs, quality: 0.35 });
          })
        );
        setFrames(thumbs.map((t) => t.uri));
      } catch {
        // Thumbnails konnten nicht geladen werden → leer lassen
      } finally {
        setFramesLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUri]);

  // Pixel → Sekunden
  const pxToSec = useCallback(
    (px: number) => (px / STRIP_W) * (duration || 15),
    [duration]
  );

  const handleLeftDrag = useCallback(
    (x: number) => {
      const clamped = Math.max(0, Math.min(x, rightPos.value - HANDLE_W * 2));
      leftPos.value = clamped;
      const sec = pxToSec(clamped);
      setStartSec(sec);
      try { player.currentTime = sec; } catch { /* ignore */ }
    },
    [leftPos, rightPos, pxToSec, player]
  );

  const handleRightDrag = useCallback(
    (x: number) => {
      const maxRight = STRIP_W - HANDLE_W;
      const clamped = Math.max(leftPos.value + HANDLE_W * 2, Math.min(x, maxRight));
      rightPos.value = clamped;
      setEndSec(pxToSec(clamped));
    },
    [rightPos, leftPos, pxToSec]
  );

  const handleDragEnd = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, player]);

  const trimDuration = Math.max(0, endSec - startSec);
  const formatTime = (s: number) =>
    `${Math.floor(s)}:${String(Math.round((s % 1) * 10)).padStart(1, '0')}s`;

  // Geschwindigkeit ändern
  useEffect(() => {
    try { player.playbackRate = playbackSpeed; } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackSpeed]);

  const handleWeiter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/create',
      params: {
        mediaUri: mediaUri ?? '',
        mediaType: 'video',
        startTime: String(Math.round(startSec * 1000)),
        endTime:   String(Math.round(endSec * 1000)),
        coverTime: String(Math.round(coverSec * 1000)),
        speedFactor: String(playbackSpeed),
      },
    });
  };

  // ── Alle Animated Styles VOR dem early return ──────────────────────────────
  // (React Hooks dürfen nicht nach einem early return stehen)
  const highlightStyle = useAnimatedStyle(() => ({
    left: leftPos.value + HANDLE_W,
    right: STRIP_W - rightPos.value,
  }));

  const maskLeftStyle = useAnimatedStyle(() => ({
    width: leftPos.value + HANDLE_W,
  }));

  const maskRightStyle = useAnimatedStyle(() => ({
    left: rightPos.value,
  }));

  const coverIndicatorStyle = useAnimatedStyle(() => ({
    left: coverPos.value - 1,
  }));

  if (!mediaUri) {
    router.back();
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.root}>
        <StatusBar barStyle="light-content" hidden />

        {/* ── Video Vorschau ── */}
        <View style={s.videoWrap}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />


          {/* Play/Pause in der Mitte */}
          <Pressable onPress={togglePlay} style={s.playBtn}>
            {isPlaying
              ? <Pause size={28} color="#fff" fill="#fff" />
              : <Play size={28} color="#fff" fill="#fff" />}
          </Pressable>

          {/* Top Bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={s.topIconBtn}>
              <X size={20} color="#fff" strokeWidth={2.5} />
            </Pressable>
            <Text style={s.topTitle}>Video kürzen</Text>
            <Pressable onPress={handleWeiter} style={s.nextBtn}>
              <LinearGradient
                colors={['#22D3EE', '#A855F7']}
                style={s.nextBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Check size={16} color="#fff" strokeWidth={3} />
                <Text style={s.nextBtnText}>Weiter</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* ── Trim Bereich ── */}
        <View style={[s.trimArea, { paddingBottom: insets.bottom + 20 }]}>

          {/* Dauer Anzeige */}
          <View style={s.durationRow}>
            <View style={s.durationBadge}>
              <Text style={s.durationText}>
                {formatTime(startSec)} – {formatTime(endSec)}
              </Text>
            </View>
            <View style={[s.durationBadge, { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.3)' }]}>
              <Text style={[s.durationText, { color: '#22D3EE' }]}>
                {trimDuration.toFixed(1)}s ausgewählt
              </Text>
            </View>
          </View>

          {/* Frame Strip Container */}
          <View
            style={s.stripOuter}
            onLayout={(e) => {
              e.target.measure((_x, _y, _w, _h, pageX) => {
                stripOffsetX.current = pageX;
              });
            }}
          >
            <View style={s.stripContainer}>
              {/* Frame Strip */}
              <FrameStrip frames={frames} loading={framesLoading} />

              {/* Highlight zwischen den Handles */}
              <Animated.View style={[s.highlight, highlightStyle]} />

              {/* Dunkle Maske links */}
              <Animated.View style={[s.mask, s.maskLeft, maskLeftStyle]} />
              {/* Dunkle Maske rechts */}
              <Animated.View style={[s.mask, s.maskRight, maskRightStyle]} />

              {/* Cover-Frame Indikator */}
              {showCoverPicker && (
                <Animated.View style={[s.coverIndicator, coverIndicatorStyle]} />
              )}
            </View>

            {/* Trim Handles — außerhalb von overflow:hidden damit Touch nicht geblockt wird */}
            <TrimHandle
              side="left"
              position={leftPos}
              onDrag={(absX) => handleLeftDrag(absX - stripOffsetX.current)}
              onEnd={handleDragEnd}
            />
            <TrimHandle
              side="right"
              position={rightPos}
              onDrag={(absX) => handleRightDrag(absX - stripOffsetX.current)}
              onEnd={handleDragEnd}
            />
          </View>

          {/* Cover-Frame Picker */}
          <View style={s.coverRow}>
            <Pressable
              style={[s.coverToggle, showCoverPicker && s.coverToggleActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCoverPicker(v => !v);
              }}
            >
              <Text style={[s.coverToggleText, showCoverPicker && s.coverToggleTextActive]}>
                {showCoverPicker ? `Cover: ${formatTime(coverSec)}` : 'Cover w\u00e4hlen'}
              </Text>
            </Pressable>

            {/* Geschwindigkeit */}
            <View style={s.speedRow}>
              {([0.5, 1, 1.5, 2] as const).map(speed => (
                <Pressable
                  key={speed}
                  style={[s.speedBtn, playbackSpeed === speed && s.speedBtnActive]}
                  onPress={() => {
                    setPlaybackSpeed(speed);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[s.speedText, playbackSpeed === speed && s.speedTextActive]}>
                    {speed}x
                  </Text>
                </Pressable>
              ))}
            </View>

            {showCoverPicker && (
              <GestureDetector
                gesture={Gesture.Pan()
                  .onUpdate((e) => {
                    const px = Math.max(0, Math.min(e.x, STRIP_W));
                    coverPos.value = px;
                    const sec = (px / STRIP_W) * (duration || 15);
                    runOnJS(setCoverSec)(sec);
                  })
                }
              >
                <View style={s.coverSliderTrack}>
                  <Animated.View style={[s.coverSliderThumb, { left: coverPos.value - 10 }]} />
                </View>
              </GestureDetector>
            )}
          </View>

          <Text style={s.hint}>
            Ziehe die Griffe um den gewünschten Ausschnitt zu wählen
          </Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },

  // Video
  videoWrap: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  playBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topIconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  topTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nextBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },

  // Trim Area
  trimArea: {
    backgroundColor: '#090910',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: STRIP_PADDING,
    marginBottom: 16,
  },
  durationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  durationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },

  // Strip
  stripOuter: {
    marginHorizontal: STRIP_PADDING,
    height: 56,
    position: 'relative',
  },
  stripContainer: {
    height: 56,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#22D3EE',
    zIndex: 5,
  },
  mask: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 4,
  },
  maskLeft: { left: 0 },
  maskRight: { right: 0, left: undefined, width: undefined },

    hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 0.2,
  },

  // Cover Frame Picker
  coverIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#22D3EE',
    zIndex: 10,
    shadowColor: '#22D3EE',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  coverRow: {
    marginHorizontal: STRIP_PADDING,
    marginTop: 12,
    gap: 10,
  },
  coverToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  coverToggleActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: 'rgba(34,211,238,0.4)',
  },
  coverToggleText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  coverToggleTextActive: {
    color: '#22D3EE',
  },
  coverSliderTrack: {
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'visible',
  },
  coverSliderThumb: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },

  // Geschwindigkeit
  speedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  speedBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderColor: 'rgba(34,211,238,0.4)',
  },
  speedText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  speedTextActive: {
    color: '#22D3EE',
  },
});

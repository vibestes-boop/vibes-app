import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { USE_EXPO_VIDEO, VideoView, useVideoPlayer } from './expoVideo';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const AnimatedR = { View: _animNS?.View ?? _animMod?.View };
import { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// ─── Seek Handle (gemeinsam für beide Video-Komponenten) ──────────────────────
export interface FeedVideoSeekHandle {
  seek: (fraction: number) => void;
}

// ─── Skeleton Shimmer ─────────────────────────────────────────────────────────
function VideoSkeleton({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 700 }),
        withTiming(0.35, { duration: 700 })
      ),
      -1, false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;
  return (
    <AnimatedR.View
      style={[StyleSheet.absoluteFill, style, { backgroundColor: '#111' }]}
      pointerEvents="none"
    />
  );
}

// ─── Thumbnail Preview ───────────────────────────────────────────────────────
// Zeigt das JPEG-Thumbnail SOFORT an (lädt in ~50ms) bis das Video bereit ist.
// Faded in 300ms aus wenn readyToPlay. Kein schwarzer Shimmer mehr.
function ThumbnailPreview({ uri, videoReady }: { uri: string; videoReady: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (videoReady) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [videoReady, opacity]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity, zIndex: 2 }]}
      pointerEvents="none"
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
}

// ─── NativeFeedVideo (expo-video) ────────────────────────────────────────────
export const NativeFeedVideo = forwardRef<FeedVideoSeekHandle, {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  onProgress: (p: number) => void;
  thumbnailUrl?: string | null;
}>(function NativeFeedVideo({ uri, shouldPlay, isMuted, onProgress, thumbnailUrl }, ref) {
  const [ready, setReady] = useState(false);

  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = true;
    p.muted = isMuted;
  });

  // Expose seek via ref
  useImperativeHandle(ref, () => ({
    seek: (fraction: number) => {
      if (!player) return;
      const dur = player.duration;
      if (dur > 0) {
        try { player.currentTime = fraction * dur; } catch { /* ignore */ }
      }
    },
  }), [player]);

  // Play/Pause basierend auf Sichtbarkeit + Screen-Fokus
  useEffect(() => {
    if (!player) return;
    if (shouldPlay) player.play();
    else player.pause();
  }, [shouldPlay, player]);

  // Explizit stoppen + freigeben beim Unmount (verhindert Audio-Leak beim Tab-Wechsel)
  useEffect(() => {
    return () => {
      try { player?.pause(); } catch { /* ignorieren */ }
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (s: any) => {
      if (s.status === 'readyToPlay') setReady(true);
    });
    // setInterval-Poll statt riskantes timeUpdate-Event:
    // Polls alle 250ms den aktuellen Zeitstempel — zuverlässig auf allen Geräten
    const timer = setInterval(() => {
      const dur = player.duration;
      const cur = player.currentTime;
      if (dur > 0) onProgress(cur / dur);
    }, 250);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [player, onProgress]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Thumbnail sofort anzeigen — faded aus wenn Video bereit */}
      {thumbnailUrl && <ThumbnailPreview uri={thumbnailUrl} videoReady={ready} />}
      {/* Shimmer nur wenn KEIN Thumbnail vorhanden (Fallback) */}
      {!thumbnailUrl && <VideoSkeleton visible={!ready} />}
    </View>
  );
});

// ─── FallbackFeedVideo (expo-av) ─────────────────────────────────────────────
export const FallbackFeedVideo = forwardRef<FeedVideoSeekHandle, {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  onProgress: (p: number) => void;
  thumbnailUrl?: string | null;
}>(function FallbackFeedVideo({ uri, shouldPlay, isMuted, onProgress, thumbnailUrl }, ref) {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<Video>(null);
  const durationMs = useRef(0);

  // Expose seek via ref
  useImperativeHandle(ref, () => ({
    seek: (fraction: number) => {
      if (!videoRef.current || durationMs.current <= 0) return;
      videoRef.current.setPositionAsync(fraction * durationMs.current).catch(() => {});
    },
  }), []);

  const handleStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setLoaded(true);
    if (status.durationMillis && status.durationMillis > 0) {
      durationMs.current = status.durationMillis;
      onProgress((status.positionMillis ?? 0) / status.durationMillis);
    }
  }, [onProgress]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={shouldPlay}
        isMuted={isMuted}
        onPlaybackStatusUpdate={handleStatus}
      />
      {/* Thumbnail sofort anzeigen — faded aus wenn Video bereit */}
      {thumbnailUrl && <ThumbnailPreview uri={thumbnailUrl} videoReady={loaded} />}
      {/* Shimmer nur wenn KEIN Thumbnail vorhanden (Fallback) */}
      {!thumbnailUrl && <VideoSkeleton visible={!loaded} />}
    </View>
  );
});

export { USE_EXPO_VIDEO };

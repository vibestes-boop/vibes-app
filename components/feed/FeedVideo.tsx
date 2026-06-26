import { AVPlaybackStatus,ResizeMode,Video } from 'expo-av';
import { Image } from 'expo-image';
import { forwardRef,useCallback,useEffect,useImperativeHandle,useMemo,useRef,useState } from 'react';
import { Animated,Platform,StyleSheet,View } from 'react-native';
import { useAnimatedStyle,useSharedValue,withRepeat,withSequence,withTiming } from 'react-native-reanimated';
import { USE_EXPO_VIDEO,VideoView,useVideoPlayer } from './expoVideo';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const AnimatedR = { View: _animNS?.View ?? _animMod?.View };

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

// Resume-Speicher: merkt sich die Abspielposition LANGER Videos (>= RESUME_MIN_SEC)
// pro Quelle (uri), damit sie beim Zurückscrollen an der Stelle weiterlaufen.
// Kurze Clips starten weiterhin bei 0 (Short-Video-Parity). Modul-Level → überlebt
// Unmount/Remount beim Aus-dem-Fenster-Scrollen. Eine Zahl pro Video → minimal.
const RESUME_MIN_SEC = 60;
const videoResumePos = new Map<string, number>();

// ─── NativeFeedVideo (expo-video) ────────────────────────────────────────────
export const NativeFeedVideo = forwardRef<FeedVideoSeekHandle, {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  onProgress: (p: number) => void;
  thumbnailUrl?: string | null;
  restartSignal?: number;
  bunnyVideoId?: string | null;
  // 'cover' = Vollbild (Standard); 'contain' = ganzes Frame sichtbar (Kommentar-Peek).
  // Display-only Prop → Wechsel lädt den Player NICHT neu (Wiedergabe läuft nahtlos weiter).
  contentFit?: 'cover' | 'contain';
}>(function NativeFeedVideo({ uri, shouldPlay, isMuted, onProgress, thumbnailUrl, restartSignal = 0, bunnyVideoId, contentFit = 'cover' }, ref) {
  const [ready, setReady] = useState(false);
  // Bunny-HLS bevorzugen, bei Fehler (noch nicht transkodiert / kaputt) auf R2
  // zurückfallen — R2 ist die garantierte Quelle, also kann nichts brechen.
  const hlsUrl = bunnyVideoId ? `https://vz-6857f4f1-6d5.b-cdn.net/${bunnyVideoId}/playlist.m3u8` : null;
  const [useHls, setUseHls] = useState(!!hlsUrl);
  const useHlsRef = useRef(useHls);
  useHlsRef.current = useHls;
  useEffect(() => { setUseHls(!!hlsUrl); }, [hlsUrl, uri]);
  const shouldPlayRef = useRef(shouldPlay);
  const isMutedRef = useRef(isMuted);
  shouldPlayRef.current = shouldPlay;
  isMutedRef.current = isMuted;
  const source = useMemo(
    // WICHTIG: useCaching NUR für progressive R2-Dateien. expo-video unterstützt
    // KEIN Caching für HLS/m3u8 — useCaching:true auf einer HLS-Quelle wirft beim
    // Start einen 'error'-Status → unser Fallback unten schaltet sofort auf R2.
    // Das war die Ursache, warum HLS (trotz erreichbarer 200er-Playlist) nie lief.
    () => (useHls && hlsUrl
      ? { uri: hlsUrl, contentType: 'hls' as const }
      : { uri, contentType: 'progressive' as const, useCaching: true }),
    [useHls, hlsUrl, uri]
  );

  const player = useVideoPlayer(source, (p: any) => {
    p.loop = true;
    p.muted = isMutedRef.current;
    try {
      p.bufferOptions = Platform.select({
        ios: {
          preferredForwardBufferDuration: 0.4,
          waitsToMinimizeStalling: false,
        },
        default: {
          preferredForwardBufferDuration: 0.75,
          minBufferForPlayback: 0.25,
          maxBufferBytes: 8 * 1024 * 1024,
          prioritizeTimeOverSizeThreshold: true,
        },
      });
    } catch { /* older native runtimes may ignore bufferOptions */ }
    if (shouldPlayRef.current) {
      try {
        const maybePromise = p.play?.();
        maybePromise?.catch?.(() => {});
      } catch { /* ignore early native player races */ }
    }
  });

  useEffect(() => {
    setReady(false);
  }, [uri]);

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

  // Erneut sichtbar: KURZE Clips (< RESUME_MIN_SEC) starten bei 0 (Short-Video-Parity),
  // LANGE Videos (>= RESUME_MIN_SEC) laufen an Ort und Stelle weiter — kein Reset.
  // (Bei frischem Mount/Quellen-Wechsel stellt readyToPlay die gemerkte Stelle her.)
  useEffect(() => {
    if (!player || restartSignal <= 0 || !shouldPlay) return;
    try {
      const dur = player.duration ?? 0;
      if (dur > 0 && dur < RESUME_MIN_SEC) {
        player.currentTime = 0;
        onProgress(0);
      }
      const maybePromise = player.play?.();
      maybePromise?.catch?.(() => {});
    } catch { /* ignore native player races */ }
  }, [restartSignal, shouldPlay, player, onProgress]);

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
      if (s.status === 'readyToPlay') {
        setReady(true);
        // Resume: langes Video an gemerkter Stelle fortsetzen (frischer Mount /
        // Quellen-Wechsel R2→HLS). Kurze Clips haben keine gemerkte Position → 0.
        const dur = player.duration ?? 0;
        const saved = videoResumePos.get(uri);
        if (dur >= RESUME_MIN_SEC && saved != null && saved > 0 && saved < dur - 2) {
          try { player.currentTime = saved; } catch { /* ignore */ }
        }
        // Autoplay nachholen: Wenn der Player nach einem Quellen-Wechsel R2→HLS
        // NEU erzeugt wird, war shouldPlay evtl. schon true, bevor die HLS-Quelle
        // geladen war → das frühe play() lief ins Leere (erstes Video startete erst
        // nach Scroll). Sobald die Quelle bereit ist + sichtbar: jetzt abspielen.
        if (shouldPlayRef.current) {
          try { player.play?.(); } catch { /* ignore native race */ }
        }
      } else if (s.status === 'error' && useHlsRef.current) {
        // HLS fehlgeschlagen (z.B. noch nicht fertig transkodiert) → R2-Fallback.
        setUseHls(false);
        setReady(false);
      }
    });
    // setInterval-Poll statt riskantes timeUpdate-Event:
    // Polls alle 250ms den aktuellen Zeitstempel — zuverlässig auf allen Geräten
    const timer = setInterval(() => {
      const dur = player.duration;
      const cur = player.currentTime;
      if (dur > 0) {
        onProgress(cur / dur);
        // Position langer Videos merken (für Resume beim Zurückscrollen).
        // FIFO-Cap (200) gegen unbegrenztes Wachstum bei sehr langen Sessions.
        if (dur >= RESUME_MIN_SEC && cur > 0 && cur < dur - 2) {
          if (videoResumePos.size > 200 && !videoResumePos.has(uri)) {
            const firstKey = videoResumePos.keys().next().value;
            if (firstKey !== undefined) videoResumePos.delete(firstKey);
          }
          videoResumePos.set(uri, cur);
        }
      }
    }, 250);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [player, onProgress, uri]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
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
  restartSignal?: number;
  contentFit?: 'cover' | 'contain';
}>(function FallbackFeedVideo({ uri, shouldPlay, isMuted, onProgress, thumbnailUrl, restartSignal = 0, contentFit = 'cover' }, ref) {
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

  useEffect(() => {
    if (!videoRef.current || restartSignal <= 0 || !shouldPlay) return;
    onProgress(0);
    videoRef.current
      .setPositionAsync(0)
      .then(() => videoRef.current?.playAsync?.())
      .catch(() => {});
  }, [restartSignal, shouldPlay, onProgress]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={contentFit === 'contain' ? ResizeMode.CONTAIN : ResizeMode.COVER}
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

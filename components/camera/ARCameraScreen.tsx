/**
 * ARCameraScreen v4 — Vollständiges Upgrade
 *
 * Neu in v4:
 * 1. Haptics: Shutter, Filter-Wechsel, Fehler-Feedback
 * 2. Reanimated: LiveStickerOverlay komplett migriert (kein legacy Animated mehr)
 * 3. GPU Shader Filter: RuntimeEffect (Film Grain, Chromatic Aberration, Halftone, Glitch)
 *    - Live via useSkiaFrameProcessor (animierte Shader mit Zeit-Uniform)
 *    - Foto-Preview via RuntimeShader ImageFilter-Komponente
 * 4. Skottie-Slot: StickerCanvas-Komponente vorbereitet (Phase 4)
 *
 * Architektur-Notizen:
 * - Shader Filter TEILEN sich den frameProcessor mit Color Filtern
 * - Zeit-Uniform läuft über performance.now() im Worklet (frame.timestamp)
 * - Resolution-Uniform wird beim Mount einmal gesetzt (SCREEN_W/H)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useSkiaFrameProcessor,
  type PhotoFile,
  type VideoFile,
} from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import {
  Skia,
  Canvas,
  Image as SkiaImage,
  useImage,
  RadialGradient,
  Rect,
  vec,
  RuntimeShader,
} from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { FilterBar } from './FilterBar';
import {
  FILTER_CATALOG,
  COLOR_FILTERS,
  FRAME_CONFIGS,
  type CameraFilter,
  type FrameFilterId,
  type ShaderFilterId,
} from '@/lib/cameraFilters';
import { SHADER_REGISTRY } from '@/lib/cameraShaders';
import { useFaceDetection, getStickerPosition } from '@/lib/useFaceDetection';
import { useLiveFaceDetection } from '@/lib/useLiveFaceDetection';
import { StickerCanvas } from './StickerCanvas';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Emoji-Map für alle 15 Sticker ────────────────────────────────────────
const STICKER_EMOJI: Record<string, string> = {
  sunglasses: '🕶️',
  crown:      '👑',
  hearts:     '❤️',
  stars:      '⭐',
  dogears:    '🐶',
  rainbow:    '🌈',
  fire:       '🔥',
  butterfly:  '🦋',
  ghost:      '👻',
  lightning:  '⚡',
  sakura:     '🌸',
  diamond:    '💎',
  moon_s:     '🌙',
  alien:      '👽',
  angel:      '😇',
};

// ─── Compiled Shader Cache (nur einmal kompilieren pro Session) ─────────────
const shaderCache = new Map<ShaderFilterId, ReturnType<typeof Skia.RuntimeEffect.Make>>();

function getOrCompileShader(id: ShaderFilterId) {
  if (shaderCache.has(id)) return shaderCache.get(id)!;
  const def = SHADER_REGISTRY[id];
  const effect = Skia.RuntimeEffect.Make(def.sksl);
  shaderCache.set(id, effect);
  return effect;
}

// ─── Live-Sticker Overlay (Reanimated) ────────────────────────────────────
interface LiveStickerOverlayProps {
  filterId: string;
  cameraRef: React.RefObject<Camera>;
  isEnabled: boolean;
}

function LiveStickerOverlay({ filterId, cameraRef, isEnabled }: LiveStickerOverlayProps) {
  const { stickerPos, isTracking } = useLiveFaceDetection({
    cameraRef,
    filterId,
    enabled: isEnabled,
    canvasWidth: SCREEN_W,
    canvasHeight: SCREEN_H,
  });

  // Bob-Animation (Reanimated withRepeat)
  const bobY    = useSharedValue(0);
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Bob-Loop starten
  useEffect(() => {
    bobY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1100 }),
        withTiming( 7, { duration: 1100 }),
      ),
      -1, // unendlich
      false,
    );
  }, [bobY]);

  // Scale-Spring wenn Sticker erscheint / verschwindet
  const stickerVisible = stickerPos !== null;
  useEffect(() => {
    scale.value   = withSpring(stickerVisible ? 1 : 0, { damping: 14, stiffness: 160 });
    opacity.value = withTiming(stickerVisible ? 1 : 0, { duration: 200 });
  }, [stickerVisible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bobY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const emoji = STICKER_EMOJI[filterId] ?? '✨';

  if (stickerPos) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.preciseSticker,
          {
            left:   stickerPos.x - stickerPos.size / 2,
            top:    stickerPos.y - stickerPos.size / 2,
            width:  stickerPos.size,
            height: stickerPos.size,
          },
          animStyle,
        ]}
      >
        <StickerCanvas filterId={filterId} size={stickerPos.size} />
        <View style={[styles.trackingDot, isTracking && styles.trackingDotActive]} />
      </Animated.View>
    );
  }

  // Fallback: zentriert mit "Suche"-Badge
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.liveStickerFallback, animStyle]}
    >
      <Text style={styles.liveStickerEmoji}>{emoji}</Text>
      <View style={styles.trackingHintBadge}>
        <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.7 }] }} />
        <Text style={styles.trackingHintText}>Gesicht wird gesucht…</Text>
      </View>
    </Animated.View>
  );
}

// ─── Vignette Overlay ──────────────────────────────────────────────────────
function VignetteOverlay() {
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H}>
        <RadialGradient
          c={vec(SCREEN_W / 2, SCREEN_H / 2)}
          r={Math.max(SCREEN_W, SCREEN_H) * 0.72}
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
          positions={[0, 0.6, 1]}
        />
      </Rect>
    </Canvas>
  );
}

// ─── Rainbow Frame ─────────────────────────────────────────────────────────
const RAINBOW_BORDER = SCREEN_W * 0.022;
function RainbowFrameOverlay() {
  return (
    <>
      <LinearGradient
        colors={['#f472b6', '#a78bfa', '#38bdf8', '#34d399']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.rainbowEdge, { top: 0, left: 0, right: 0, height: RAINBOW_BORDER }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['#34d399', '#38bdf8', '#a78bfa', '#f472b6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.rainbowEdge, { bottom: 0, left: 0, right: 0, height: RAINBOW_BORDER }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['#f472b6', '#a78bfa', '#38bdf8', '#34d399']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[styles.rainbowEdge, { top: 0, bottom: 0, left: 0, width: RAINBOW_BORDER }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['#34d399', '#38bdf8', '#a78bfa', '#f472b6']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[styles.rainbowEdge, { top: 0, bottom: 0, right: 0, width: RAINBOW_BORDER }]}
        pointerEvents="none"
      />
    </>
  );
}

// ─── Captured Photo Preview ────────────────────────────────────────────────
interface CapturedPreviewProps {
  photoUri: string;
  filter: CameraFilter;
  onAccept: (uri: string) => void;
  onRetake: () => void;
}

function CapturedPreview({ photoUri, filter, onAccept, onRetake }: CapturedPreviewProps) {
  const { detectFace, isDetecting } = useFaceDetection();
  const skiaImage = useImage(photoUri);
  const [stickerPos, setStickerPos] = useState<{ x: number; y: number; size: number } | null>(null);
  const [detectionStarted, setDetectionStarted] = useState(false);

  // Color-Filter Paint
  const imagePaint = useMemo(() => {
    if (filter.category !== 'color' || filter.id === 'none') return null;
    const matrix = filter.colorMatrix ?? COLOR_FILTERS.none;
    const p = Skia.Paint();
    p.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    return p;
  }, [filter]);

  // Shader-Effect für Foto-Preview (statisch — kein Zeit-Uniform animiert)
  const shaderEffect = useMemo(() => {
    if (filter.category !== 'shader' || !filter.shaderType) return null;
    return getOrCompileShader(filter.shaderType);
  }, [filter]);

  const shaderUniforms = useMemo(() => {
    if (!filter.shaderType) return {};
    const def = SHADER_REGISTRY[filter.shaderType];
    const uniforms: Record<string, number | number[]> = { ...def.defaults as Record<string, number | number[]> };
    if (def.needsResolution) {
      uniforms['resolution'] = [SCREEN_W, SCREEN_H];
    }
    // Zeit-Uniform auf 0 setzen (statisches Foto — kein Loop)
    if (def.animated) uniforms['time'] = 1.2;
    return uniforms;
  }, [filter.shaderType]);

  // Face detection für Sticker
  useEffect(() => {
    if (filter.category === 'sticker') {
      setDetectionStarted(true);
      detectFace(photoUri, SCREEN_W, SCREEN_H).then(result => {
        if (result.found && result.landmarks) {
          setStickerPos(getStickerPosition(filter.id as string, result.landmarks, SCREEN_W, SCREEN_H));
        }
      });
    }
  }, [photoUri, filter, detectFace]);

  return (
    <View style={styles.previewContainer}>
      <Canvas style={StyleSheet.absoluteFill}>
        {skiaImage && (
          <>
            <SkiaImage
              image={skiaImage}
              fit="cover"
              x={0} y={0}
              width={SCREEN_W}
              height={SCREEN_H}
              paint={imagePaint ?? undefined}
            />
            {/* GPU Shader auf Foto — RuntimeShader als ImageFilter */}
            {shaderEffect && (
              <SkiaImage
                image={skiaImage}
                fit="cover"
                x={0} y={0}
                width={SCREEN_W}
                height={SCREEN_H}
              >
                <RuntimeShader source={shaderEffect} uniforms={shaderUniforms} />
              </SkiaImage>
            )}
          </>
        )}
        {/* Vignette im Foto-Preview */}
        {filter.id === 'vignette' && (
          <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H}>
            <RadialGradient
              c={vec(SCREEN_W / 2, SCREEN_H / 2)}
              r={Math.max(SCREEN_W, SCREEN_H) * 0.72}
              colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
              positions={[0, 0.6, 1]}
            />
          </Rect>
        )}
      </Canvas>

      {/* Rainbow Frame */}
      {filter.id === 'rainbow_frame' && <RainbowFrameOverlay />}

      {/* Normaler Frame Border */}
      {filter.category === 'frame'
        && filter.id !== 'vignette'
        && filter.id !== 'rainbow_frame'
        && FRAME_CONFIGS[filter.id as FrameFilterId]
        && (() => {
          const cfg = FRAME_CONFIGS[filter.id as FrameFilterId];
          return (
            <View
              pointerEvents="none"
              style={[styles.frameOverlay, {
                borderColor: cfg.color,
                borderWidth: SCREEN_W * cfg.widthFactor,
                ...(cfg.bottomExtra && { borderBottomWidth: SCREEN_W * cfg.bottomExtra }),
              }]}
            />
          );
        })()
      }

      {/* ML Kit Face Sticker */}
      {filter.category === 'sticker' && (
        !detectionStarted || isDetecting ? (
          <View style={styles.detectingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.detectingText}>Gesicht wird erkannt...</Text>
          </View>
        ) : stickerPos ? (
          <View
            pointerEvents="none"
            style={[styles.preciseSticker, {
              left: stickerPos.x - stickerPos.size / 2,
              top:  stickerPos.y - stickerPos.size / 2,
              width: stickerPos.size,
              height: stickerPos.size,
            }]}
          >
            <StickerCanvas filterId={filter.id as string} size={stickerPos.size} />
          </View>
        ) : (
          <View style={styles.fallbackSticker} pointerEvents="none">
            <Text style={styles.liveStickerEmoji}>{STICKER_EMOJI[filter.id] ?? '✨'}</Text>
            <Text style={styles.noFaceText}>Kein Gesicht gefunden</Text>
          </View>
        )
      )}

      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
          <Text style={styles.retakeBtnText}>↩ Nochmal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(photoUri)}>
          <Text style={styles.acceptBtnText}>Verwenden ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Haupt AR Camera Screen ────────────────────────────────────────────────
interface ARCameraScreenProps {
  onMediaCaptured: (uri: string, type: 'photo' | 'video') => void;
  onClose: () => void;
}

export function ARCameraScreen({ onMediaCaptured, onClose }: ARCameraScreenProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused   = useIsFocused();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device      = useCameraDevice(cameraPosition);

  const [activeFilter, setActiveFilter]   = useState<CameraFilter>(FILTER_CATALOG[0]);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [isBusy, setIsBusy]               = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const cameraRef = useRef<Camera>(null) as React.RefObject<Camera>;

  const isColorFilter = activeFilter?.category === 'color' && activeFilter.id !== 'none';
  const isShader      = activeFilter?.category === 'shader';
  const isSticker     = activeFilter?.category === 'sticker';
  const isFrame       = activeFilter?.category === 'frame';
  const isVignette    = activeFilter?.id === 'vignette';
  const isRainbow     = activeFilter?.id === 'rainbow_frame';
  const frameCfg      = isFrame && !isVignette && !isRainbow
                          ? FRAME_CONFIGS[activeFilter.id as FrameFilterId]
                          : null;

  // ─── Skia Paint für Color-Filter ───────────────────────────────────────
  const skiaColorPaint = useMemo(() => {
    if (!isColorFilter) return null;
    const matrix = activeFilter.colorMatrix ?? COLOR_FILTERS.none;
    const p = Skia.Paint();
    p.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    return p;
  }, [activeFilter, isColorFilter]);

  // ─── Shader-Effect + Paint für GPU Shader Filter ───────────────────────
  const compiledShader = useMemo(() => {
    if (!isShader || !activeFilter.shaderType) return null;
    return getOrCompileShader(activeFilter.shaderType);
  }, [activeFilter, isShader]);

  // Shader Paint für Frame Processor (mit Zeit im Worklet aktualisiert)
  // Wir übergeben nur effect — Zeit wird im Worklet via frame.timestamp gesetzt
  const shaderPaintForFrame = useMemo(() => {
    if (!compiledShader) return null;
    const def = SHADER_REGISTRY[activeFilter.shaderType!];
    const builder = Skia.RuntimeShaderBuilder(compiledShader);
    // Statische Uniforms setzen
    const defaults = def.defaults as Record<string, number | number[]>;
    Object.entries(defaults).forEach(([key, val]) => {
      if (key === 'time') return; // Zeit im Worklet setzen
      if (key === 'resolution') {
        builder.setUniform('resolution', [SCREEN_W, SCREEN_H]);
      } else if (typeof val === 'number') {
        builder.setUniform(key, [val]); // setUniform nimmt readonly number[]
      } else {
        builder.setUniform(key, val as number[]);
      }
    });
    return { builder, def };
  }, [compiledShader, activeFilter.shaderType]);

  // ─── Frame Processor: Color-Filter + Shader-Filter ────────────────────
  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet';
    if (skiaColorPaint != null) {
      // ColorMatrix Filter
      frame.render(skiaColorPaint);
    } else if (shaderPaintForFrame != null) {
      // GPU Shader Filter
      const { builder, def } = shaderPaintForFrame;
      if (def.animated) {
        // Zeit-Uniform in Sekunden (frame.timestamp in Nanosekunden)
        builder.setUniform('time', [frame.timestamp / 1_000_000_000]);
      }
      const imgFilter = Skia.ImageFilter.MakeRuntimeShader(builder, null, null);
      const paint = Skia.Paint();
      paint.setImageFilter(imgFilter);
      frame.render(paint);
    } else {
      frame.render();
    }
  }, [skiaColorPaint, shaderPaintForFrame]);

  // ─── Haptic Feedback Hilfsfunktionen ──────────────────────────────────
  const triggerShutterHaptic  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const triggerFilterHaptic   = () => Haptics.selectionAsync();
  const triggerErrorHaptic    = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

  if (!hasPermission) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permTitle}>Kamera-Zugriff benötigt</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permContainer}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.permTitle}>Kamera wird geladen...</Text>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <CapturedPreview
        photoUri={capturedPhoto}
        filter={activeFilter}
        onAccept={(uri) => onMediaCaptured(uri, 'photo')}
        onRetake={() => setCapturedPhoto(null)}
      />
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || isBusy) return;
    triggerShutterHaptic();
    setIsBusy(true);
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({ flash: 'off' });
      setCapturedPhoto(`file://${photo.path}`);
    } catch {
      triggerErrorHaptic();
      Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleVideo = async () => {
    if (!cameraRef.current) return;
    if (!isRecording) {
      triggerShutterHaptic();
      setIsRecording(true);
      cameraRef.current.startRecording({
        fileType: 'mp4',
        onRecordingFinished: (video: VideoFile) => {
          setIsRecording(false);
          onMediaCaptured(`file://${video.path}`, 'video');
        },
        onRecordingError: (err) => {
          setIsRecording(false);
          triggerErrorHaptic();
          Alert.alert('Aufnahme fehlgeschlagen', err?.message ?? 'Bitte versuche es erneut.');
        },
      });
    } else {
      await cameraRef.current.stopRecording();
    }
  };

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        photo={true}
        video={true}
        audio={true}
        enableZoomGesture
        frameProcessor={frameProcessor}
      />

      {/* ─── Live-Vignette ─────────────────────────────────────────────── */}
      {isVignette && <VignetteOverlay />}

      {/* ─── Rainbow-Frame ─────────────────────────────────────────────── */}
      {isRainbow && <RainbowFrameOverlay />}

      {/* ─── Normaler Frame Border ─────────────────────────────────────── */}
      {frameCfg && (
        <View
          pointerEvents="none"
          style={[styles.frameOverlay, {
            borderColor: frameCfg.color,
            borderWidth: SCREEN_W * frameCfg.widthFactor,
            ...(frameCfg.bottomExtra && { borderBottomWidth: SCREEN_W * frameCfg.bottomExtra }),
          }]}
        />
      )}

      {/* ─── Live-Sticker mit Face-Tracking ────────────────────────────── */}
      {isSticker && (
        <LiveStickerOverlay
          filterId={activeFilter.id as string}
          cameraRef={cameraRef}
          isEnabled={isFocused && isSticker}
        />
      )}

      {/* ─── Recording Indicator ───────────────────────────────────────── */}
      {isRecording && (
        <View style={styles.recIndicator}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC</Text>
        </View>
      )}

      {/* ─── Aktiver Shader-Filter Label ───────────────────────────────── */}
      {isShader && (
        <View style={styles.shaderLabel} pointerEvents="none">
          <Text style={styles.shaderLabelText}>
            {activeFilter.emoji} {activeFilter.label}
          </Text>
        </View>
      )}

      {/* ─── Top Bar ───────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
          <Text style={styles.iconBtnText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            triggerFilterHaptic();
            setCameraPosition(p => p === 'front' ? 'back' : 'front');
          }}
        >
          <Text style={styles.iconBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Bottom Bar ────────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.filterToggle, showFilterBar && styles.filterToggleActive]}
          onPress={() => {
            triggerFilterHaptic();
            setShowFilterBar(v => !v);
          }}
        >
          <Text style={styles.filterToggleEmoji}>
            {activeFilter?.id !== 'none' ? activeFilter?.emoji : '🎨'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutter, isRecording && styles.shutterRec]}
          onPress={takePhoto}
          onLongPress={toggleVideo}
          delayLongPress={300}
          disabled={isBusy}
        >
          {isBusy
            ? <ActivityIndicator color="#000" />
            : <View style={isRecording ? styles.shutterStop : styles.shutterInner} />
          }
        </TouchableOpacity>

        <View style={{ width: 48 }} />
      </View>

      {/* ─── Filter Bar ────────────────────────────────────────────────── */}
      {showFilterBar && (
        <View style={styles.filterBarWrap}>
          <FilterBar
            selectedFilter={activeFilter}
            onFilterSelect={(f) => {
              triggerFilterHaptic();
              setActiveFilter(f);
              if (f.category === 'color') setShowFilterBar(false);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#000' },
  permContainer:          { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  permTitle:              { color: '#fff', fontSize: 16 },
  permBtn:                { backgroundColor: '#a855f7', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  permBtnText:            { color: '#fff', fontWeight: '700', fontSize: 15 },

  previewContainer:       { flex: 1, backgroundColor: '#000' },
  previewActions:         { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  retakeBtn:              { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 28, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  retakeBtnText:          { color: '#fff', fontWeight: '600', fontSize: 15 },
  acceptBtn:              { flex: 1, backgroundColor: '#a855f7', borderRadius: 28, paddingVertical: 14, alignItems: 'center' },
  acceptBtnText:          { color: '#fff', fontWeight: '700', fontSize: 15 },

  topBar:                 { position: 'absolute', top: 56, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  iconBtn:                { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  iconBtnText:            { fontSize: 18, color: '#fff' },
  bottomBar:              { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 },
  filterToggle:           { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  filterToggleActive:     { borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.2)' },
  filterToggleEmoji:      { fontSize: 22 },
  shutter:                { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
  shutterRec:             { backgroundColor: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' },
  shutterInner:           { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  shutterStop:            { width: 28, height: 28, borderRadius: 4, backgroundColor: '#fff' },
  filterBarWrap:          { position: 'absolute', bottom: 140, left: 0, right: 0 },

  // Sticker
  preciseSticker:         { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  preciseStickerEmoji:    { textAlign: 'center' },
  trackingDot:            { position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  trackingDotActive:      { backgroundColor: '#22c55e' },
  liveStickerFallback:    { position: 'absolute', top: SCREEN_H * 0.28, left: 0, right: 0, alignItems: 'center', gap: 10 },
  liveStickerEmoji:       { fontSize: 80, textAlign: 'center' },
  trackingHintBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  trackingHintText:       { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Captured sticker states
  fallbackSticker:        { position: 'absolute', top: '30%', left: 0, right: 0, alignItems: 'center' },
  noFaceText:             { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8 },
  detectingOverlay:       { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center', gap: 8 },
  detectingText:          { color: '#fff', fontSize: 14 },

  // Frame
  frameOverlay:           { ...StyleSheet.absoluteFillObject },
  rainbowEdge:            { position: 'absolute' },

  // Recording
  recIndicator:           { position: 'absolute', top: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  recDot:                 { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recText:                { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Shader Label
  shaderLabel:            { position: 'absolute', top: 112, alignSelf: 'center' },
  shaderLabelText:        { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, overflow: 'hidden' },
});

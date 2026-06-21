/**
 * app/create/camera.tsx
 * Vibes Creator Studio — eigene Identität, kein Short-Video-Klon.
 *
 * 3 MODI unten (Vibes Design Language):
 *   VIBE  |  STUDIO  |  LIVE
 *
 * Design:
 *  - Glassmorphism Tool-Panel rechts
 *  - Vibes Cyan-Purple Gradient Record-Button
 *  - Sliding Pill Mode-Selector (animiert)
 *  - Premium Dark Ästhetik
 */
import { MusicPickerSheet } from '@/components/camera/MusicPickerSheet';
import type { MusicTrack } from '@/lib/useMusicPicker';
import { useIsFocused } from '@react-navigation/native';
import { CameraType,CameraView,FlashMode,useCameraPermissions,useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { launchImageLibraryAsync,requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ImageIcon,Music2,Radio,RotateCcw,Sparkles,Timer,Video,X,Zap,ZapOff } from 'lucide-react-native';
import { useCallback,useEffect,useRef,useState } from 'react';
import {
Alert,
Dimensions,
Keyboard,
Pressable,
StatusBar,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import {
useAnimatedStyle,
useSharedValue,
withRepeat,
withSequence,
withSpring,
withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Typen ─────────────────────────────────────────────────────────────────────
type CaptureMode = '60s' | '15s' | 'foto' | 'text';
type StudioMode = 'vibe' | 'studio' | 'live';
type AspectRatio = '9:16' | '1:1' | '16:9';

const ASPECT_PRESETS: { key: AspectRatio; label: string; ratio: [number, number] }[] = [
  { key: '9:16', label: '9:16\nVertical', ratio: [9, 16] },
  { key: '1:1',  label: '1:1\nQuadrat',  ratio: [1, 1]  },
  { key: '16:9', label: '16:9\nBreit',    ratio: [16, 9] },
];

const CAPTURE_MODES: { key: CaptureMode; label: string }[] = [
  { key: '60s', label: '60s' },
  { key: '15s', label: '15s' },
  { key: 'foto', label: 'Foto' },
  { key: 'text', label: 'Text' },
];

// Hintergrund-Verläufe für Text-Posts (TikTok-Stil)
const TEXT_BG_COLORS: string[] = [
  '#1D1D26', '#A78BFA', '#F472B6', '#FB7185', '#FBBF24', '#34D399', '#38BDF8', '#000000', '#FFFFFF',
];

const STUDIO_MODES: { key: StudioMode; label: string; icon: React.ReactNode }[] = [
  { key: 'vibe', label: 'VIBE', icon: <Video size={16} color="#fff" strokeWidth={2} /> },
  { key: 'studio', label: 'STUDIO', icon: <Sparkles size={16} color="#fff" strokeWidth={2} /> },
  { key: 'live', label: 'LIVE', icon: <Radio size={16} color="#fff" strokeWidth={2} /> },
];

// ─── Animierter Record Button ─────────────────────────────────────────────────
function VibesRecordButton({
  isRecording,
  isPhoto,
  onPress,
  onLongPress,
  onPressOut,
}: {
  isRecording: boolean;
  isPhoto: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onPressOut: () => void;
}) {
  const innerScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.6);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      innerScale.value = withSpring(0.45, { damping: 18, stiffness: 180 });
      glowOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(0.4, { duration: 500 })),
        -1, false
      );
    } else {
      innerScale.value = withSpring(1, { damping: 14, stiffness: 200 });
      glowOpacity.value = withTiming(0.6, { duration: 300 });
    }
  }, [isRecording, innerScale, glowOpacity, rotation]);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Pressable
      onPress={isPhoto ? onPress : undefined}
      onLongPress={!isPhoto ? onLongPress : undefined}
      onPressOut={!isPhoto ? onPressOut : undefined}
      delayLongPress={80}
      style={btn.wrap}
    >
      {/* Äußerer Glow-Ring */}
      <Animated.View style={[btn.glowRing, glowStyle]} />

      {/* Äußerer Ring — weißer Rand */}
      <View style={btn.ringGradient}>
        <View style={btn.ringInset}>
          {/* Innerer Button */}
          <Animated.View style={[btn.inner, innerStyle]}>
            <LinearGradient
              colors={isRecording ? ['#FF3B30', '#FF6B35'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
              style={[btn.innerGrad, isRecording && btn.innerStop]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

const btn = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 90, height: 90 },
  glowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  ringGradient: {
    width: 84,
    height: 84,
    borderRadius: 42,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  ringInset: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  innerGrad: {
    flex: 1,
  },
  innerStop: {
    borderRadius: 10,
  },
});

// ─── Studio Mode Selector ─────────────────────────────────────────────────────
function StudioModePill({
  modes,
  active,
  onChange,
}: {
  modes: typeof STUDIO_MODES;
  active: StudioMode;
  onChange: (m: StudioMode) => void;
}) {
  const activeIdx = modes.findIndex((m) => m.key === active);
  const PILL_W = (SCREEN_W - 48) / modes.length;

  const pillX = useSharedValue(activeIdx * PILL_W);

  useEffect(() => {
    pillX.value = withSpring(activeIdx * PILL_W, { damping: 22, stiffness: 280 });
  }, [activeIdx, pillX, PILL_W]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={pill.container}>
      {/* Sliding Aktiv-Indikator — dezent, kein Lila-Gradient (TikTok-clean) */}
      <Animated.View style={[pill.activePill, { width: PILL_W }, pillStyle]} />

      {/* Mode Buttons */}
      {modes.map((m) => {
        const isActive = m.key === active;
        return (
          <Pressable
            key={m.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(m.key);
            }}
            style={[pill.btn, { width: PILL_W }]}
          >
            {m.key === 'live' && isActive && <LiveDot />}
            {m.icon}
            <Text style={[pill.label, isActive && pill.labelActive]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const pill = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 24,
    position: 'relative',
    height: 50,
  },
  activePill: {
    position: 'absolute',
    top: 7,
    left: 0,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
    zIndex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelActive: {
    color: '#fff',
  },
});

// ─── Live Dot ──────────────────────────────────────────────────────────────────
function LiveDot() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1, false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' }, st]} />
  );
}

// ─── Capture Mode Switcher (oben über Record-Button) ──────────────────────────
function CaptureSwitcher({
  modes,
  active,
  onChange,
}: {
  modes: typeof CAPTURE_MODES;
  active: CaptureMode;
  onChange: (m: CaptureMode) => void;
}) {
  return (
    <View style={cap.pill}>
      {modes.map((m, i) => {
        const isActive = m.key === active;
        return (
          <Pressable
            key={m.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(m.key);
            }}
            style={[cap.item, isActive && cap.itemActive]}
          >
            <Text style={[cap.label, isActive && cap.labelActive]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const cap = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: 20,
    gap: 4,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: 'center',
  },
  itemActive: {
    backgroundColor: '#fff',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelActive: {
    color: '#000',
    fontWeight: '800',
    textShadowColor: 'transparent',
  },
});

// ─── Haupt Screen ──────────────────────────────────────────────────────────────
export default function CreateCameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('15s');
  const [studioMode, setStudioMode] = useState<StudioMode>('vibe');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);          // 3/2/1 vor Aufnahme
  const [recSeconds, setRecSeconds] = useState(0);        // vergangene Aufnahmezeit
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timer: 0 = aus, 3 = 3s, 5 = 5s, 10 = 10s
  const [timerSec, setTimerSec] = useState<0 | 3 | 5 | 10>(0);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.8);  // 0..1
  const TIMER_CYCLE: (0 | 3 | 5 | 10)[] = [0, 3, 5, 10];
  const cycleTimer = () => {
    const idx = TIMER_CYCLE.indexOf(timerSec);
    const next = TIMER_CYCLE[(idx + 1) % TIMER_CYCLE.length];
    setTimerSec(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cameraRef = useRef<CameraView>(null);

  // ── Text-Modus (Text-auf-Farbe-Post) ──────────────────────────────────
  const [textContent, setTextContent] = useState('');
  const [textBgIndex, setTextBgIndex] = useState(0);
  const textShotRef = useRef<ViewShot>(null);
  const textInputRef = useRef<TextInput>(null);
  const textBg = TEXT_BG_COLORS[textBgIndex];
  // Heller Hintergrund → dunkler Text, sonst weiß
  const textColor = (textBg === '#FFFFFF' || textBg === '#FBBF24') ? '#111111' : '#FFFFFF';

  // Tastatur-Höhe tracken → Swatches sitzen ÜBER der Tastatur (nicht verdeckt)
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const showD = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); showD.remove(); hide.remove(); };
  }, []);

  const handleTextDone = useCallback(async () => {
    if (!textContent.trim()) { Alert.alert('Schreib was 🙂', 'Tippe deinen Text ein.'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    await new Promise((r) => setTimeout(r, 380));   // Tastatur einfahren lassen, sonst landet sie im Bild
    try {
      const uri = await textShotRef.current?.capture?.();
      if (uri) {
        router.replace({ pathname: '/create', params: { mediaUri: uri, mediaType: 'image' } });
      } else {
        Alert.alert('Schade', 'Text-Post konnte nicht erstellt werden.');
      }
    } catch {
      Alert.alert('Schade', 'Text-Post konnte nicht erstellt werden.');
    }
  }, [textContent, router]);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);


  const flipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCameraFacing((f) => {
      const next = f === 'front' ? 'back' : 'front';
      // Blitz geht bei Frontkamera nicht → automatisch ausschalten
      if (next === 'front') setFlash('off');
      return next;
    });
  }, []);

  const openGallery = useCallback(async () => {
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();
      // 'limited' = iOS "Ausgewählte Fotos" — Picker trotzdem öffnen
      if (status === 'denied') {
        Alert.alert(
          'Zugriff verweigert',
          'Bitte erlaube in den Einstellungen den Zugriff auf deine Fotos.',
          [{ text: 'OK' }]
        );
        return;
      }
      // Im Studio-Modus: Seitenverhältnis-Vorlage anwenden
      const preset = ASPECT_PRESETS.find(p => p.key === aspectRatio);
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'] as any,
        allowsEditing: studioMode === 'studio' && !!preset,
        aspect: preset?.ratio,
        quality: 0.92,
        videoMaxDuration: captureMode === '60s' ? 60 : 15,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.type === 'video') {
          router.replace({ pathname: '/create', params: { mediaUri: asset.uri, mediaType: 'video', audioUrl: selectedTrack?.url ?? '', audioTitle: selectedTrack?.title ?? '', audioVolume: String(audioVolume) } });
        } else {
          router.replace({ pathname: '/create', params: { mediaUri: asset.uri, mediaType: 'image', audioUrl: selectedTrack?.url ?? '', audioTitle: selectedTrack?.title ?? '', audioVolume: String(audioVolume) } });
        }
      }
    } catch (e) {
      __DEV__ && console.warn('[openGallery]', e);
      Alert.alert('Fehler', 'Galerie konnte nicht geöffnet werden.');
    }
  }, [captureMode, router, studioMode, aspectRatio, selectedTrack, audioVolume]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo?.uri) router.replace({ pathname: '/create', params: { mediaUri: photo.uri, mediaType: 'image', audioUrl: selectedTrack?.url ?? '', audioTitle: selectedTrack?.title ?? '', audioVolume: String(audioVolume) } });
    } catch {
      Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden.');
    }
  }, [router, selectedTrack, audioVolume]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || countdown > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Timer-Countdown ausführen wenn gesetzt
    if (timerSec > 0) {
      let remaining = timerSec;
      setCountdown(remaining);
      await new Promise<void>((resolve) => {
        const tick = setInterval(() => {
          remaining -= 1;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (remaining <= 0) {
            clearInterval(tick);
            setCountdown(0);
            resolve();
          } else {
            setCountdown(remaining);
          }
        }, 1000);
      });
    }

    setIsRecording(true);
    setRecSeconds(0);
    recIntervalRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: captureMode === '60s' ? 60 : 15 });
      if (video?.uri) {
        router.replace({ pathname: '/create', params: { mediaUri: video.uri, mediaType: 'video', audioUrl: selectedTrack?.url ?? '', audioTitle: selectedTrack?.title ?? '', audioVolume: String(audioVolume) } });
      }
    } catch { /* aborted */ }
    if (recIntervalRef.current) clearInterval(recIntervalRef.current);
    setIsRecording(false);
    setRecSeconds(0);
  }, [isRecording, countdown, captureMode, router, timerSec, selectedTrack?.url, selectedTrack?.title, audioVolume]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    cameraRef.current?.stopRecording();
    // Interval aufräumen damit der Timer nicht weiterläuft
    if (recIntervalRef.current) {
      clearInterval(recIntervalRef.current);
      recIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecSeconds(0);
  }, [isRecording]);

  const handleStudioModeChange = (m: StudioMode) => {
    if (m === 'live') {
      router.push('/live/start' as any);
      return;
    }
    setStudioMode(m);
  };

  // Hooks MÜSSEN vor jedem early return stehen (React Rules of Hooks)
  const isFocused = useIsFocused();
  const isPhoto = captureMode === 'foto';
  const isText = captureMode === 'text';

  // Permission Screen
  if (!cameraPermission?.granted) {
    return (
      <View style={s.permScreen}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0D0D1A', '#050508']} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
        />
        <View style={s.permIcon}>
          <Video size={36} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
        </View>
        <Text style={s.permTitle}>Kamera-Zugriff</Text>
        <Text style={s.permSub}>
          Serlo braucht Kamera und Mikrofon um{'\n'}Videos, Stories und Live-Streams zu erstellen.
        </Text>
        <Pressable onPress={requestCameraPermission} style={s.permBtn}>
          <View style={s.permBtnGrad}>
            <Text style={s.permBtnText}>Kamera-Zugriff erlauben</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Abbrechen</Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" hidden />

      {/* ── Kamera: nur wenn Screen fokussiert ── */}
      {/* useIsFocused: CameraView released/remounted bei Tab-Switch → kein schwarzes Bild */}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
          flash={flash}
          mode={isPhoto ? 'picture' : 'video'}
          // 720p statt 1080p: im vertikalen Handy-Feed praktisch nicht
          // unterscheidbar, aber ~2× kleinere Dateien → schnelleres Laden
          // (vor allem im Mobilfunknetz) und weniger R2-Storage. Reine
          // JS-Prop → OTA-fähig, kein Rebuild.
          videoQuality="720p"
          mirror={cameraFacing === 'front'}
        />
      )}



      {/* ── Text-Modus Composer (Text-auf-Farbe → view-shot → Post) ── */}
      {isText && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="box-none">
          <ViewShot ref={textShotRef} style={StyleSheet.absoluteFill} options={{ format: 'jpg', quality: 0.95, result: 'tmpfile' }}>
            {/* Hintergrund tippbar: Tastatur offen → zu; geschlossen → wieder fokussieren (weiter bearbeiten) */}
            <Pressable
              onPress={() => { if (kbHeight > 0) Keyboard.dismiss(); else textInputRef.current?.focus(); }}
              style={[StyleSheet.absoluteFill, { backgroundColor: textBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }]}
            >
              <TextInput
                ref={textInputRef}
                value={textContent}
                onChangeText={setTextContent}
                placeholder="Tippe deinen Text…"
                placeholderTextColor={textColor === '#FFFFFF' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}
                multiline
                autoFocus
                maxLength={400}
                style={{ color: textColor, fontSize: 30, fontWeight: '800', textAlign: 'center', alignSelf: 'stretch' }}
              />
            </Pressable>
          </ViewShot>
        </View>
      )}

      {/* Hintergrundfarben — NUR bei offener Tastatur, direkt darüber (außerhalb ViewShot → nicht im Bild) */}
      {isText && kbHeight > 0 && (
        <View style={[s.textSwatchRow, { bottom: kbHeight + 12, zIndex: 11 }]}>
          {TEXT_BG_COLORS.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTextBgIndex(i); }}
              style={[s.textSwatch, { backgroundColor: c }, i === textBgIndex && s.textSwatchActive]}
            />
          ))}
        </View>
      )}

      {/* ── Countdown-Overlay ── */}
      {countdown > 0 && (
        <View style={s.countdownOverlay} pointerEvents="none">
          <Text style={s.countdownNumber}>{countdown}</Text>
        </View>
      )}

      {/* ── Aufnahme-Timer (oben links) ── */}
      {isRecording && (
        <View style={[s.recBadge, { top: insets.top + 56 }]} pointerEvents="none">
          <View style={s.recDot} />
          <Text style={s.recTime}>
            {String(Math.floor(recSeconds / 60)).padStart(2,'0')}:{String(recSeconds % 60).padStart(2,'0')}
          </Text>
        </View>
      )}



      {/* ── Top Bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        {/* Schließen */}
        <Pressable onPress={() => router.back()} style={s.topBtn} hitSlop={12}>
          <View style={s.topBtnBg}>
            <X size={20} color="#fff" strokeWidth={2.5} />
          </View>
        </Pressable>

        {/* Vibes branded dot */}
        <View style={s.topTitleWrap}>
          <View style={s.cyanDot} />
          <Text style={s.topTitle}>Serlo</Text>
          <Text style={s.topTitleSep}> · </Text>
          <Text style={s.topTitleMode}>
            {studioMode === 'vibe' ? 'Creator' : studioMode === 'studio' ? 'Studio' : 'Live'}
          </Text>
        </View>

        {/* Rechts: im Text-Modus mit offener Tastatur „Fertig" (Tastatur zu), sonst Sound */}
        {isText && kbHeight > 0 ? (
          <Pressable style={s.topBtn} hitSlop={10} onPress={() => Keyboard.dismiss()}>
            <Text style={s.doneText}>Fertig</Text>
          </Pressable>
        ) : (
          <Pressable
            style={s.topBtn}
            hitSlop={8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMusicPicker(true);
            }}
          >
            <View style={[s.soundPill, selectedTrack && s.soundPillActive]}>
              <Music2
                size={13}
                color="#fff"
                strokeWidth={2}
              />
              <Text
                style={s.soundText}
                numberOfLines={1}
              >
                {selectedTrack ? selectedTrack.title : 'Sound'}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Music Picker Sheet */}
      <MusicPickerSheet
        visible={showMusicPicker}
        selectedTrack={selectedTrack}
        audioVolume={audioVolume}
        onSelect={(track, vol) => { setSelectedTrack(track); setAudioVolume(vol); }}
        onClose={() => setShowMusicPicker(false)}
      />

      {/* ── Rechte Tool-Leiste — gleicher Look wie der Editor (Icon + Label) ── */}
      {!isText && (
      <View style={[s.tools, { top: insets.top + 72 }]}>
        <Pressable style={s.toolBtn} onPress={flipCamera}>
          <RotateCcw size={24} color="#fff" strokeWidth={1.8} />
          <Text style={s.toolLabel}>Wenden</Text>
        </Pressable>

        <Pressable
          style={[s.toolBtn, cameraFacing === 'front' && s.toolBtnDisabled]}
          onPress={() => {
            if (cameraFacing === 'front') {
              // Frontkamera hat keinen Blitz
              Alert.alert('Blitz nicht verfügbar', 'Wechsle zur Rückkamera um den Blitz zu nutzen.');
              return;
            }
            setFlash(f => f === 'off' ? 'on' : 'off');
          }}
        >
          {flash === 'on'
            ? <Zap size={24} color="#FFE434" fill="#FFE434" strokeWidth={1.8} />
            : <ZapOff
                size={24}
                color={cameraFacing === 'front' ? 'rgba(255,255,255,0.3)' : '#fff'}
                strokeWidth={1.8}
              />
          }
          <Text style={s.toolLabel}>Blitz</Text>
        </Pressable>

        <Pressable style={s.toolBtn} onPress={cycleTimer}>
          <Timer size={24} color="#fff" strokeWidth={1.8} />
          <Text style={s.toolLabel}>{timerSec > 0 ? `Timer · ${timerSec}s` : 'Timer'}</Text>
        </Pressable>

        {/* ── Effekte (AR) ── */}
        <Pressable
          style={s.toolBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/create/ar-camera' as any);
          }}
        >
          <Sparkles size={24} color="#fff" strokeWidth={1.8} />
          <Text style={s.toolLabel}>Effekte</Text>
        </Pressable>
      </View>
      )}

      {/* ── Unterer Bereich ── */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>

        {studioMode === 'studio' ? (
          /* ── STUDIO MODE: Minimal, professionell ── */
          <View style={s.studioPanel}>

            {/* Vorlagen: Aspect Ratio */}
            <View style={s.studioAspectRow}>
              {ASPECT_PRESETS.map(p => (
                <Pressable
                  key={p.key}
                  style={[s.studioAspectBtn, aspectRatio === p.key && s.studioAspectBtnActive]}
                  onPress={() => {
                    setAspectRatio(p.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[s.studioAspectLabel, aspectRatio === p.key && s.studioAspectLabelActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Galerie CTA */}
            <Pressable onPress={openGallery} style={s.studioPickBtn}>
              <ImageIcon size={22} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
              <View style={s.studioPickText}>
                <Text style={s.studioPickTitle}>Medien auswählen</Text>
                <Text style={s.studioPickSub}>Foto · Video · Clip</Text>
              </View>
            </Pressable>
            <Text style={s.studioHint}>
              Wähle aus deiner Galerie — Videos werden automatisch getrimmt
            </Text>
          </View>
        ) : (
          /* ──────────────── VIBE MODE ──────────────── */
          <>
            {/* Capture Mode Switcher als Pill */}
            <CaptureSwitcher modes={CAPTURE_MODES} active={captureMode} onChange={setCaptureMode} />

            {/* Record Row — 3 Spalten gleichbreit → Aufnahme-Button exakt mittig */}
            <View style={s.recordRow}>
              {/* Links: Galerie */}
              <Pressable onPress={openGallery} style={s.galleryBtn}>
                <View style={s.galleryEmpty}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Galerie</Text>
                </View>
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(168,85,247,0.3)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />
              </Pressable>

              {/* Mitte: Aufnahme-Button (im Text-Modus = „Fertig", erstellt den Text-Post) */}
              <VibesRecordButton
                isRecording={isRecording}
                isPhoto={isPhoto || isText}
                onPress={isText ? handleTextDone : takePhoto}
                onLongPress={startRecording}
                onPressOut={stopRecording}
              />

              {/* Rechts: gleiche Breite wie Galerie → echter Ausgleich */}
              <View style={s.recordRowSpacer} />
            </View>
          </>
        )}

        {/* ── Studio Mode Pill Selector ── */}
        <View style={{ marginTop: studioMode === 'studio' ? 16 : 24, marginBottom: 8 }}>
          <StudioModePill
            modes={STUDIO_MODES}
            active={studioMode}
            onChange={handleStudioModeChange}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

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
  topBtn: { minWidth: 36, alignItems: 'center' },
  topBtnBg: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    // Kein Background/Rahmen mehr (TikTok-clean) — Schatten hält das Icon lesbar
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  topTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cyanDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  topTitleSep: { color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '400' },
  topTitleMode: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },

  // Timer Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '900',
    letterSpacing: -4,
    textShadowColor: 'rgba(29,185,84,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },

  // Recording Badge
  recBadge: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 20,
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  recTime: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  soundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 110,
  },
  soundPillActive: {
    backgroundColor: 'rgba(167,139,250,0.35)',
  },
  soundText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  doneText: {
    color: '#fff', fontSize: 16, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Tools — cleaner Editor-Look (Icon + Label, kein Glas-Pill) → konsistent vor/nach dem Foto
  tools: {
    position: 'absolute',
    right: 10,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 22,
    zIndex: 10,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    paddingVertical: 2,
  },
  toolLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },

  // Bottom Container — Glassmorphism Panel
  bottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    // transparent (TikTok-clean) — Controls schweben über der Kamera
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  recordRowSpacer: {
    width: 58,
    height: 58,
  },
  galleryBtn: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  galleryEmpty: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text-Modus: Hintergrundfarb-Swatches
  textSwatchRow: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
  },
  textSwatch: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  textSwatchActive: {
    borderWidth: 3, borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },

  // Permission Screen
  permScreen: {
    flex: 1,
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permIcon: {
    width: 80, height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permTitle: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 12, letterSpacing: -0.5 },
  permSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 36,
  },
  permBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  permBtnGrad: { paddingVertical: 16, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14 },
  permBtnText: { color: '#000', fontSize: 16, fontWeight: '900' },

  // Timer Badge
  timerBadge: {
    position: 'absolute',
    bottom: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Studio Mode Panel — minimal
  studioPanel: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 12,
  },
  studioPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  studioPickText: { gap: 2 },
  studioPickTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  studioPickSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '400',
  },
  studioHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Aspect Ratio Vorlagen
  studioAspectRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  studioAspectBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  studioAspectBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(29,185,84,0.6)',
  },
  studioAspectLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  studioAspectLabelActive: {
    color: '#fff',
  },
});

/**
 * live/start.tsx
 * Vor dem Live gehen: Titel, Kategorie, Einstellungen.
 * Live-Kamera-Preview läuft immer im Hintergrund (wie TikTok).
 * Karten = Glassmorphism (expo-blur) statt transparenter Boxen.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, Radio, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useLiveHost } from '@/lib/useLiveSession';
import ExpoGoPlaceholder from '@/components/live/ExpoGoPlaceholder';
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require('expo-constants') as any; const Constants = _cMod?.default ?? _cMod;

// ─── Kategorien ────────────────────────────────────────────────────────────
const LIVE_CATEGORIES = [
  { key: 'talk',      emoji: '💬', label: 'Talk'    },
  { key: 'gaming',    emoji: '🎮', label: 'Gaming'  },
  { key: 'music',     emoji: '🎵', label: 'Musik'   },
  { key: 'qna',       emoji: '🙋', label: 'Q&A'     },
  { key: 'fitness',   emoji: '💪', label: 'Fitness' },
  { key: 'cooking',   emoji: '🍳', label: 'Kochen'  },
  { key: 'art',       emoji: '🎨', label: 'Art'     },
  { key: 'sports',    emoji: '⚽', label: 'Sport'   },
  { key: 'education', emoji: '📚', label: 'Lernen'  },
];

export default function LiveStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession, loading } = useLiveHost();

  const [permission, requestPermission] = useCameraPermissions();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('talk');
  const [allowComments, setAllowComments] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(true);

  // Pulsierender Dot-Anim
  const dotOpacity = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  const startCountdown = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }

    dotOpacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      false
    );

    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);

    try {
      const result = await startSession(title);
      if (!result) {
        Alert.alert('Fehler', 'Live konnte nicht gestartet werden. Bitte prüfe deine Verbindung.');
        return;
      }
      setCameraActive(false);
      await new Promise((r) => setTimeout(r, 1000));

      router.replace({
        pathname: '/live/host',
        params: {
          sessionId: result.sessionId,
          title,
          lkToken: result.token,
          lkUrl: result.url,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      Alert.alert('Live-Fehler', msg);
    }
  };

  if (Constants.appOwnership === 'expo') {
    return <ExpoGoPlaceholder onBack={() => router.back()} icon="🎥" />;
  }

  return (
    <View style={s.root}>
      {/* ── Kamera-Preview (läuft immer durch wie TikTok) ── */}
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="front" active={cameraActive} />
      ) : (
        <LinearGradient
          colors={['#0a0010', '#1a0040', '#0a0020']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Leichter Dunkel-Overlay oben + unten */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.70)']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Countdown */}
      {countdown !== null && (
        <View style={s.countdownWrap}>
          <Text style={s.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <BlurView intensity={60} tint="dark" style={s.backBtnBlur}>
            <ArrowLeft size={20} stroke="#fff" strokeWidth={2.2} />
          </BlurView>
        </Pressable>

        <View style={s.liveIndicator}>
          <Animated.View style={[s.liveDot, dotStyle]} />
          <Text style={s.liveText}>LIVE</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* ── Scrollbarer Inhalt ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Titel-Input (Glassmorphism) ── */}
        <BlurView intensity={55} tint="dark" style={s.glassInput}>
          <TextInput
            style={s.titleInput}
            placeholder="Titel für dein Live (optional)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
            selectionColor="#22D3EE"
          />
        </BlurView>

        {/* ── Kategorie ── */}
        <Text style={s.sectionLabel}>Kategorie</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
          {LIVE_CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  setCategory(cat.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <BlurView
                  intensity={active ? 70 : 45}
                  tint="dark"
                  style={[s.categoryChip, active && s.categoryChipActive]}
                >
                  <Text style={s.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[s.categoryLabel, active && s.categoryLabelActive]}>
                    {cat.label}
                  </Text>
                </BlurView>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Einstellungen (Glassmorphism-Karte) ── */}
        <Text style={s.sectionLabel}>Einstellungen</Text>
        <BlurView intensity={55} tint="dark" style={s.settingsCard}>
          <SettingToggle label="Kommentare erlauben" value={allowComments} onValueChange={setAllowComments} />
          <View style={s.settingDivider} />
          <SettingToggle label="Geschenke erlauben" value={allowGifts} onValueChange={setAllowGifts} />
        </BlurView>

        {/* Permission-Hinweis */}
        {!permission?.granted && (
          <Pressable style={s.permissionBtn} onPress={requestPermission}>
            <Text style={s.permissionBtnText}>Kamera-Zugriff erlauben</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Start-Button (floating, Glassmorphism) ── */}
      <View style={[s.startWrap, { bottom: insets.bottom + 24 }]}>
        <Pressable
          style={[s.startBtn, (loading || countdown !== null) && s.startBtnDisabled]}
          onPress={startCountdown}
          disabled={loading || countdown !== null}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Radio size={20} stroke="#fff" strokeWidth={2.2} />
              <Text style={s.startBtnText}>Live gehen</Text>
              <ChevronRight size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
            </>
          )}
        </Pressable>
        <Text style={s.hint}>Deine Follower werden benachrichtigt 🔴</Text>
      </View>
    </View>
  );
}

// ─── Setting Toggle Row ────────────────────────────────────────────────────
function SettingToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(239,68,68,0.5)' }}
        thumbColor={value ? '#EF4444' : 'rgba(255,255,255,0.4)'}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  backBtnBlur: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },

  countdownWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 30,
  },
  countdownText: {
    fontSize: 120, fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: '#EF4444',
    textShadowRadius: 30,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 0,
  },

  // ── Glassmorphism-Karten ──
  // Titel-Input als Glas-Box
  glassInput: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: 22,
  },
  titleInput: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: '#fff',
    fontSize: 16,
  },

  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Kategorien
  categoryRow: { gap: 8, paddingBottom: 22 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  categoryChipActive: {
    borderColor: 'rgba(239,68,68,0.6)',
  },
  categoryEmoji: { fontSize: 15 },
  categoryLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13, fontWeight: '600',
  },
  categoryLabelActive: { color: '#fff' },

  // Settings Glassmorphism Card
  settingsCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14, fontWeight: '500',
  },
  settingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 18,
  },

  // Permission
  permissionBtn: {
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderRadius: 14, paddingVertical: 13,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,211,238,0.3)',
  },
  permissionBtnText: { color: '#22D3EE', fontWeight: '700', fontSize: 15 },

  // Start Button (floating)
  startWrap: {
    position: 'absolute', left: 20, right: 20,
    gap: 10, zIndex: 20,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#EF4444',
    borderRadius: 18, paddingVertical: 17,
    shadowColor: '#EF4444', shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12, textAlign: 'center',
  },
});

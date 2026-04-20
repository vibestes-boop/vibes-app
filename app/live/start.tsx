/**
 * live/start.tsx
 * TikTok-style Live-Vorbereitung:
 * - Kamera-Preview fullscreen
 * - Bottom-Toolbar: Umdrehen + Einstellungen
 * - Einstellungen als weißes Bottom-Sheet
 * - Großer "LIVE gehen"-Button
 *
 * v1.26.0 — Scheduled Lives:
 *   • Sekundärer „Später planen"-Button → öffnet PlanModal → scheduleLive()
 *   • Deep-Link aus /creator/scheduled-lives setzt Titel + Optionen vor und
 *     merkt sich scheduledLiveId; bei erfolgreichem Go-Live wird
 *     linkLiveSessionToScheduled(sid, scheduledLiveId) aufgerufen, damit
 *     Follower beim Tap auf den Reminder-Push direkt in diese Session kommen.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  X, RefreshCw, Settings, ChevronRight,
  CalendarClock, ChevronUp, ChevronDown,
} from 'lucide-react-native';
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
import { useWomenOnly } from '@/lib/useWomenOnly';
import {
  useScheduledLives,
  linkLiveSessionToScheduled,
  scheduledLiveLabel,
} from '@/lib/useScheduledLives';
import ExpoGoPlaceholder from '@/components/live/ExpoGoPlaceholder';
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require('expo-constants') as any; const Constants = _cMod?.default ?? _cMod;

export default function LiveStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession, loading } = useLiveHost();
  const { canAccessWomenOnly } = useWomenOnly();
  const { scheduleLive, isScheduling } = useScheduledLives();

  // Deep-Link aus /creator/scheduled-lives: Felder vorfüllen + scheduledLiveId
  // in einer Ref halten, damit wir sie nach startSession() verknüpfen können.
  const params = useLocalSearchParams<{
    scheduledLiveId?: string;
    title?:           string;
    allowComments?:   string;
    allowGifts?:      string;
    womenOnly?:       string;
  }>();
  const scheduledLiveIdRef = useRef<string | null>(params.scheduledLiveId ?? null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [title, setTitle] = useState(params.title ?? '');
  const [allowComments, setAllowComments] = useState(params.allowComments !== '0');
  const [allowGifts, setAllowGifts] = useState(params.allowGifts !== '0');
  const [womenOnly, setWomenOnly] = useState(params.womenOnly === '1');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);

  const dotOpacity = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  const flipCamera = () => {
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startCountdown = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }

    dotOpacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      false,
    );

    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);

    try {
      const result = await startSession(title, { allowComments, allowGifts, womenOnly });
      if (!result) {
        Alert.alert('Fehler', 'Live konnte nicht gestartet werden. Bitte prüfe deine Verbindung.');
        return;
      }

      // Wenn User aus einem Scheduled-Live Deep-Link kommt, Eintrag auf 'live'
      // flippen + session_id speichern, damit Follower beim Tap auf den Push
      // direkt in diese Session kommen. Fehler hier werden bewusst nicht an
      // den User eskaliert — der Stream läuft ja schon.
      if (scheduledLiveIdRef.current) {
        try {
          await linkLiveSessionToScheduled(scheduledLiveIdRef.current, result.sessionId);
        } catch (e: unknown) {
          if (__DEV__) {
            console.warn('[live/start] linkLiveSessionToScheduled failed:', e);
          }
        }
      }

      setCameraActive(false);
      await new Promise((r) => setTimeout(r, 500));
      router.replace({
        pathname: '/live/host',
        params: { sessionId: result.sessionId, title, lkToken: result.token, lkUrl: result.url },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      Alert.alert('Live-Fehler', msg);
    }
  };

  // ── Planen-Flow ──────────────────────────────────────────────────────────
  const openPlanner = () => {
    if (!title.trim()) {
      Alert.alert(
        'Titel fehlt',
        'Gib oben in den Einstellungen einen Titel für dein geplantes Live ein.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Einstellungen', onPress: () => setSettingsSheet(true) },
        ],
      );
      return;
    }
    setPlanSheet(true);
  };

  const submitSchedule = async (at: Date) => {
    if (at.getTime() < Date.now() + 5 * 60_000) {
      Alert.alert('Ungültig', 'Zeitpunkt muss mindestens 5 Minuten in der Zukunft liegen.');
      return;
    }
    try {
      await scheduleLive({
        scheduledAt:   at,
        title:         title.trim(),
        allowComments,
        allowGifts,
        womenOnly,
      });
      setPlanSheet(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/creator/scheduled-lives' as never);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Konnte nicht geplant werden.';
      Alert.alert('Fehler', msg);
    }
  };

  if (Constants.appOwnership === 'expo') {
    return <ExpoGoPlaceholder onBack={() => router.back()} icon="🎥" />;
  }

  return (
    <View style={s.root}>

      {/* ── Kamera-Preview fullscreen ── */}
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} active={cameraActive} />
      ) : (
        <LinearGradient colors={['#0a0010', '#1a0040', '#0a0020']} style={StyleSheet.absoluteFill} />
      )}

      {/* Gradient oben + unten */}
      <LinearGradient
        colors={['rgba(0,0,0,0.50)', 'transparent', 'transparent', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.18, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Countdown ── */}
      {countdown !== null && (
        <View style={s.countdownWrap}>
          <Text style={s.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* ── Top Bar: X-Button ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
          <BlurView intensity={55} tint="dark" style={s.iconBtnBlur}>
            <X size={19} stroke="#fff" strokeWidth={2.5} />
          </BlurView>
        </Pressable>
      </View>

      {/* ── Kamera-Erlaubnis-Banner ── */}
      {!permission?.granted && (
        <View style={s.permBanner}>
          <Pressable style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Kamera-Zugriff erlauben</Text>
          </Pressable>
        </View>
      )}

      {/* ── Bottom Area ── */}
      <View style={[s.bottomArea, { paddingBottom: insets.bottom + 20 }]}>

        {/* Icon-Toolbar: Umdrehen + Einstellungen */}
        <View style={s.toolbar}>
          <ToolbarBtn icon={<RefreshCw size={22} stroke="#fff" strokeWidth={1.8} />} label="Umdrehen" onPress={flipCamera} />
          <ToolbarBtn
            icon={<Settings size={22} stroke="#fff" strokeWidth={1.8} />}
            label="Einstellungen"
            onPress={() => setSettingsSheet(true)}
          />
        </View>

        {/* LIVE gehen Button */}
        <Pressable
          style={[s.liveBtn, (loading || countdown !== null) && s.liveBtnDisabled]}
          onPress={startCountdown}
          disabled={loading || countdown !== null}
        >
          <LinearGradient
            colors={['#FF2D55', '#FF375F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.liveBtnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Animated.View style={[s.liveDot, dotStyle]} />
                <Text style={s.liveBtnText}>
                  {scheduledLiveIdRef.current ? 'Jetzt live gehen' : 'LIVE gehen'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Später planen — nur wenn NICHT aus einem Scheduled-Deep-Link */}
        {!scheduledLiveIdRef.current && (
          <Pressable
            onPress={openPlanner}
            disabled={loading || countdown !== null}
            style={[s.planBtn, (loading || countdown !== null) && { opacity: 0.5 }]}
            hitSlop={8}
          >
            <CalendarClock size={15} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
            <Text style={s.planBtnText}>Stattdessen planen</Text>
          </Pressable>
        )}

        <Text style={s.hint}>
          {scheduledLiveIdRef.current
            ? 'Du bist mit deinen Followern verknüpft'
            : 'Deine Follower werden benachrichtigt'}
        </Text>
      </View>

      {/* ── Einstellungen Sheet ── */}
      <Modal
        visible={settingsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsSheet(false)}
      >
        <Pressable style={ss.backdrop} onPress={() => setSettingsSheet(false)}>
          <Pressable style={[ss.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={ss.handle} />
            <Text style={ss.title}>Einstellungen</Text>

            {/* Titel */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>TITEL</Text>
              <View style={ss.inputRow}>
                <TextInput
                  style={ss.input}
                  placeholder="Titel für dein Live (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                  selectionColor="#FF2D55"
                />
              </View>
            </View>

            {/* Toggles */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>SICHTBARKEIT</Text>
              <View style={ss.settingsCard}>
                <View style={ss.row}>
                  <View>
                    <Text style={ss.rowTitle}>Kommentare</Text>
                    <Text style={ss.rowSub}>Zuschauer können kommentieren</Text>
                  </View>
                  <Switch
                    value={allowComments}
                    onValueChange={setAllowComments}
                    trackColor={{ false: '#E5E7EB', true: 'rgba(255,45,85,0.35)' }}
                    thumbColor={allowComments ? '#FF2D55' : '#9CA3AF'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
                <View style={ss.divider} />
                <View style={ss.row}>
                  <View>
                    <Text style={ss.rowTitle}>Geschenke</Text>
                    <Text style={ss.rowSub}>Zuschauer können Coins senden</Text>
                  </View>
                  <Switch
                    value={allowGifts}
                    onValueChange={setAllowGifts}
                    trackColor={{ false: '#E5E7EB', true: 'rgba(255,45,85,0.35)' }}
                    thumbColor={allowGifts ? '#FF2D55' : '#9CA3AF'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
                <View style={ss.divider} />
                <Pressable style={[ss.row, { paddingRight: 4 }]}>
                  <View>
                    <Text style={ss.rowTitle}>Wer kann zuschauen</Text>
                    <Text style={ss.rowSub}>Alle · Öffentlich</Text>
                  </View>
                  <ChevronRight size={18} stroke="#C1C9D4" strokeWidth={2} />
                </Pressable>
                {canAccessWomenOnly && (
                  <>
                    <View style={ss.divider} />
                    <View style={ss.row}>
                      <View>
                        <Text style={[ss.rowTitle, womenOnly && { color: '#F43F5E' }]}>
                          🌸 Women-Only Live
                        </Text>
                        <Text style={ss.rowSub}>
                          {womenOnly ? 'Nur verifizierte Frauen können zuschauen' : 'Für alle sichtbar'}
                        </Text>
                      </View>
                      <Switch
                        value={womenOnly}
                        onValueChange={setWomenOnly}
                        trackColor={{ false: '#E5E7EB', true: 'rgba(244,63,94,0.4)' }}
                        thumbColor={womenOnly ? '#F43F5E' : '#9CA3AF'}
                        ios_backgroundColor="#E5E7EB"
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            <Pressable style={ss.doneBtn} onPress={() => setSettingsSheet(false)}>
              <Text style={ss.doneBtnText}>Fertig</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Plan-Sheet: Zeitpunkt wählen ────────────────────────────── */}
      <PlanSheet
        visible={planSheet}
        onClose={() => setPlanSheet(false)}
        onSubmit={submitSchedule}
        isSaving={isScheduling}
        title={title}
      />
    </View>
  );
}

// ─── Toolbar Button ─────────────────────────────────────────────────────────
function ToolbarBtn({
  icon, label, onPress,
}: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={s.toolbarBtn} onPress={onPress} hitSlop={8}>
      <BlurView intensity={50} tint="dark" style={s.toolbarBtnBlur}>
        {icon}
      </BlurView>
      <Text style={s.toolbarBtnLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Plan-Sheet: Zeitpunkt wählen ───────────────────────────────────────────

function presetOptions(): { label: string; at: Date }[] {
  const now = new Date();
  const opts: { label: string; at: Date }[] = [];

  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  opts.push({ label: 'in 1 h', at: in1h });
  opts.push({ label: 'in 3 h', at: in3h });

  const today20 = new Date(now); today20.setHours(20, 0, 0, 0);
  if (today20.getTime() > now.getTime() + 5 * 60_000) {
    opts.push({ label: 'Heute 20:00', at: today20 });
  }

  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  const t9  = new Date(tom); t9.setHours(9, 0, 0, 0);
  const t20 = new Date(tom); t20.setHours(20, 0, 0, 0);
  opts.push({ label: 'Morgen 09:00', at: t9 });
  opts.push({ label: 'Morgen 20:00', at: t20 });

  const next7 = new Date(now); next7.setDate(next7.getDate() + 7); next7.setHours(20, 0, 0, 0);
  opts.push({ label: 'In 1 Woche', at: next7 });

  return opts;
}

function formatDateFull(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} · ${hh}:${mi}`;
}

function PlanStepper({
  label, onInc, onDec,
}: { label: string; onInc: () => void; onDec: () => void }) {
  return (
    <View style={ps.stepper}>
      <Pressable onPress={onDec} hitSlop={10} style={ps.stepperBtn}>
        <ChevronDown size={14} color="#111827" strokeWidth={2.5} />
      </Pressable>
      <Text style={ps.stepperLabel}>{label}</Text>
      <Pressable onPress={onInc} hitSlop={10} style={ps.stepperBtn}>
        <ChevronUp size={14} color="#111827" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function PlanSheet({
  visible, onClose, onSubmit, isSaving, title,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (d: Date) => void;
  isSaving: boolean;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(new Date(Date.now() + 60 * 60_000));

  // Bei jedem Öffnen auf +1h resetten — vermeidet veraltete Werte.
  useEffect(() => {
    if (visible) setDate(new Date(Date.now() + 60 * 60_000));
  }, [visible]);

  const presets   = presetOptions();
  const minDateMs = Date.now() + 5 * 60_000;
  const maxDateMs = Date.now() + 30 * 24 * 3600 * 1000;

  const clamp = (d: Date) => {
    const t = Math.max(minDateMs, Math.min(maxDateMs, d.getTime()));
    return new Date(t);
  };
  const bumpDays    = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 24 * 3600 * 1000)));
  const bumpHours   = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 3600 * 1000)));
  const bumpMinutes = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 60 * 1000)));

  const valid = date.getTime() >= minDateMs && date.getTime() <= maxDateMs;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={onClose}>
        <Pressable
          style={[ps.sheet, { paddingBottom: insets.bottom + 20 }]}
          onPress={() => {}}
        >
          <View style={ps.handle} />
          <Text style={ps.heading}>Live planen</Text>
          <Text style={ps.sub}>
            Follower bekommen 15 Minuten vorher einen Reminder.
          </Text>

          {/* Titel-Preview */}
          <View style={ps.titlePreview}>
            <Text style={ps.titlePreviewLabel}>TITEL</Text>
            <Text style={ps.titlePreviewText} numberOfLines={2}>
              {title.trim() || '—'}
            </Text>
          </View>

          {/* Zeitpunkt-Karte */}
          <View style={ps.dateCard}>
            <Text style={ps.dateBig}>{formatDateFull(date)}</Text>
            <Text style={ps.dateHint}>{scheduledLiveLabel(date.toISOString())}</Text>
          </View>

          <Text style={ps.sectionLabel}>SCHNELLAUSWAHL</Text>
          <View style={ps.presetRow}>
            {presets.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => setDate(clamp(p.at))}
                style={ps.preset}
              >
                <Text style={ps.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={ps.sectionLabel}>FEINSTEUERUNG</Text>
          <View style={ps.stepperRow}>
            <PlanStepper label="Tag −/+"  onDec={() => bumpDays(-1)}     onInc={() => bumpDays(1)} />
            <PlanStepper label="Std −/+"  onDec={() => bumpHours(-1)}    onInc={() => bumpHours(1)} />
            <PlanStepper label="Min −/+"  onDec={() => bumpMinutes(-15)} onInc={() => bumpMinutes(15)} />
          </View>

          <View style={ps.actions}>
            <Pressable onPress={onClose} style={[ps.btn, ps.btnGhost]}>
              <Text style={ps.btnGhostText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(date)}
              disabled={isSaving || !valid}
              style={[ps.btn, ps.btnPrimary, (isSaving || !valid) && { opacity: 0.5 }]}
            >
              <Text style={ps.btnPrimaryText}>
                {isSaving ? 'Plane…' : 'Planen'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  iconBtnBlur: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },

  permBanner: {
    position: 'absolute', top: '40%', left: 32, right: 32, alignItems: 'center',
  },
  permBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 13, paddingHorizontal: 24,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Bottom
  bottomArea: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 14, paddingHorizontal: 20,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarBtn: { alignItems: 'center', gap: 6 },
  toolbarBtnBlur: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  toolbarBtnLabel: {
    color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600',
  },

  liveBtn: { width: '100%', borderRadius: 18, overflow: 'hidden', shadowColor: '#FF2D55', shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 },
  liveBtnDisabled: { opacity: 0.55 },
  liveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  planBtnText: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' },

  countdownWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  countdownText: { fontSize: 120, fontWeight: '900', color: 'rgba(255,255,255,0.9)', textShadowColor: '#FF2D55', textShadowRadius: 30 },
});

// ─── Settings Sheet Styles ────────────────────────────────────────────────────
const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 20, letterSpacing: -0.3 },

  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 8 },

  inputRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: { fontSize: 15, color: '#111827', paddingVertical: 11 },

  settingsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 1 },
  rowSub: { fontSize: 12, color: '#9CA3AF' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 16 },

  doneBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Plan-Sheet Styles ──────────────────────────────────────────────────────
const ps = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 14,
  },
  heading: {
    fontSize: 18, fontWeight: '800', color: '#111827',
    textAlign: 'center', letterSpacing: -0.3,
  },
  sub: {
    fontSize: 12, fontWeight: '500', color: '#6B7280',
    textAlign: 'center', marginTop: 4, marginBottom: 14,
  },

  titlePreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10,
  },
  titlePreviewLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.6, marginBottom: 3,
  },
  titlePreviewText: { fontSize: 14, fontWeight: '700', color: '#111827' },

  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', gap: 4,
  },
  dateBig: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.6 },
  dateHint: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, marginTop: 14, marginBottom: 8, paddingLeft: 2,
  },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    backgroundColor: '#F9FAFB',
    borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  presetText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  stepperRow: { flexDirection: 'row', gap: 8 },
  stepper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', paddingVertical: 8, gap: 4,
  },
  stepperBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  stepperLabel: { fontSize: 11, fontWeight: '700', color: '#111827' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  btnPrimary: { backgroundColor: '#111827' },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

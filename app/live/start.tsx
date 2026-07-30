/**
 * live/start.tsx
 * Short-Video-style Live-Vorbereitung:
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
import { AIImageSheet } from '@/components/ai/AIImageSheet';
import { useAuthStore } from '@/lib/authStore';
import { uploadPostMedia } from '@/lib/uploadMedia';
import { LC } from '@/lib/liveColors';
import { FONT_SIZE,FONT_WEIGHT,RADII,SPACE } from '@/lib/tokens';
import ExpoGoPlaceholder from '@/components/live/ExpoGoPlaceholder';
import { useLiveHost } from '@/lib/useLiveSession';
import {
linkLiveSessionToScheduled,
scheduledLiveLabel,
useScheduledLives,
} from '@/lib/useScheduledLives';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { BlurView } from 'expo-blur';
import { CameraView,useCameraPermissions,useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { launchImageLibraryAsync,requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams,useRouter } from 'expo-router';
import {
CalendarClock,
ChevronDown,
ChevronUp,
Gift,
ImageIcon,
MessageCircle,
Pencil,
RefreshCw,Settings,
Sparkles,
Tag,
X,
} from 'lucide-react-native';
import { useEffect,useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
Modal,
Pressable,
StyleSheet,
Switch,
Text,
TextInput,
View,
} from 'react-native';
import {
useAnimatedStyle,
useSharedValue,
withRepeat,
withSequence,
withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { GlassPanel, useCreateGlass } from '@/components/create/CreateGlass';
// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _cMod = require('expo-constants') as any; const Constants = _cMod?.default ?? _cMod;

// Live-Kategorien (für Discovery/Explore) — Spalte live_sessions.category existiert bereits
const LIVE_CATEGORIES = ['Talk', 'Musik', 'Gaming', 'Sport', 'Kochen', 'Beauty', 'Wissen', 'Reisen', 'Comedy'] as const;

export default function LiveStartScreen() {
  const { t } = useI18n();
  useThemedStatusBar('light');
  const g = useCreateGlass();
  const { colors } = useTheme();
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
  // Das Mikrofon wurde bisher NIE angefragt: LiveKit forderte es erst mitten im
  // Stream an — wer ablehnte, sendete stumm weiter, ohne jeden Hinweis.
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [title, setTitle] = useState(params.title ?? '');
  const [allowComments, setAllowComments] = useState(params.allowComments !== '0');
  const [allowGifts, setAllowGifts] = useState(params.allowGifts !== '0');
  const [womenOnly, setWomenOnly] = useState(params.womenOnly === '1');
  // „Nur Follower"-Publikum (Durchsetzung serverseitig in livekit-token).
  // Mutually exclusive mit Women-Only — siehe setAudience/audience unten.
  const [followersOnly, setFollowersOnly] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);
  // v1.28.0 — AI-Live-Thumbnail: vom Host vorab via KI-Cover erzeugt. Wird als
  // live_sessions.thumbnail_url (Spalte existiert seit v1.18.0 Live-Replay)
  // gespeichert und später u.a. als Vorschau in der Explore/Home-Live-Row genutzt.
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [showAISheet, setShowAISheet] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const { profile } = useAuthStore();

  const dotOpacity = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  // ── Publikum-Auswahl: Öffentlich / Nur Follower / Nur Frauen ────────────────
  // Genau eine Option aktiv. „Nur Frauen" nur für berechtigte Hosts sichtbar.
  const audience: 'public' | 'followers' | 'women' =
    womenOnly ? 'women' : followersOnly ? 'followers' : 'public';
  const setAudience = (a: 'public' | 'followers' | 'women') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowersOnly(a === 'followers');
    setWomenOnly(a === 'women');
  };
  // Setup-Karte: Publikum-Tile zeigt den Wert + tippt durch die Optionen
  // (Öffentlich → Nur Follower → [Nur Frauen, falls berechtigt] → zurück).
  const audienceMeta =
    audience === 'women'
      ? { emoji: '🌸', label: t('live.audWomen') }
      : audience === 'followers'
      ? { emoji: '👥', label: t('live.audFollowers') }
      : { emoji: '🌍', label: t('live.audPublic') };
  const cycleAudience = () => {
    if (audience === 'public') setAudience('followers');
    else if (audience === 'followers') setAudience(canAccessWomenOnly ? 'women' : 'public');
    else setAudience('public');
  };

  // Cover aus der Galerie wählen (Alternative zur KI — funktioniert auch ohne AI-Backend)
  const pickCoverFromGallery = async () => {
    if (!profile || coverUploading) return;
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();
      if (status === 'denied') {
        Alert.alert(t('live.accessDenied'), t('live.accessDeniedPhotos'));
        return;
      }
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setCoverUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { url } = await uploadPostMedia(profile.id, asset.uri, asset.mimeType ?? undefined);
      setThumbnailUrl(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('live.hmm'), t('live.coverUploadFailed'));
    } finally {
      setCoverUploading(false);
    }
  };

  const flipCamera = () => {
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startCountdown = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    // Ton VOR dem Start klären — ein stummer Live-Stream fällt sonst erst vor
    // Publikum auf, und der Host merkt es selbst gar nicht.
    if (!micPermission?.granted) {
      const res = await requestMicPermission();
      if (!res?.granted) {
        Alert.alert(
          t('live.micNeededTitle'),
          t('live.micNeededBody'),
        );
        return;
      }
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
      const result = await startSession(title, { allowComments, allowGifts, womenOnly, followersOnly, thumbnailUrl, category });
      if (!result) {
        Alert.alert(t('live.startFailedTitle'), t('live.startFailedText'));
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
      const msg = err instanceof Error ? err.message : t('live.unknownError');
      Alert.alert(t('live.liveFailed'), msg);
    }
  };

  // ── Planen-Flow ──────────────────────────────────────────────────────────
  const openPlanner = () => {
    if (!title.trim()) {
      Alert.alert(
        t('live.titleMissing'),
        t('live.titleMissingText'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('live.settings'), onPress: () => setSettingsSheet(true) },
        ],
      );
      return;
    }
    setPlanSheet(true);
  };

  const submitSchedule = async (at: Date) => {
    if (at.getTime() < Date.now() + 5 * 60_000) {
      Alert.alert(t('live.laterTitle'), t('live.laterText'));
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
      const msg = e instanceof Error ? e.message : t('live.scheduleFailed');
      Alert.alert(t('live.startFailedTitle'), msg);
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

      {/* ── Top Bar: X links · Umdrehen + Einstellungen rechts ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 10, justifyContent: 'space-between', alignItems: 'center' }]}>
        <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
          <BlurView intensity={55} tint="dark" style={s.iconBtnBlur}>
            <X size={19} stroke="#fff" strokeWidth={2.5} />
          </BlurView>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={s.iconBtn} onPress={flipCamera} hitSlop={12}>
            <BlurView intensity={55} tint="dark" style={s.iconBtnBlur}>
              <RefreshCw size={18} stroke="#fff" strokeWidth={2} />
            </BlurView>
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => setSettingsSheet(true)} hitSlop={12}>
            <BlurView intensity={55} tint="dark" style={s.iconBtnBlur}>
              <Settings size={18} stroke="#fff" strokeWidth={2} />
            </BlurView>
          </Pressable>
        </View>
      </View>

      {/* ── Kamera-Erlaubnis-Banner ── */}
      {!permission?.granted && (
        <View style={s.permBanner}>
          <Pressable style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>{t('live.allowCamera')}</Text>
          </Pressable>
        </View>
      )}

      {/* ── Bottom Area ── */}
      <View style={[s.bottomArea, { paddingBottom: insets.bottom + 20 }]}>

        {/* Setup-Karte: theme-aware Frosted-Glass (dark→dunkel, light→hell) */}
        <GlassPanel style={s.setupCard} padding={14}>
         <View style={{ gap: 10 }}>
          {/* Titel */}
          <Pressable style={[s.titleRow, { backgroundColor: g.fill }]} onPress={() => setSettingsSheet(true)}>
            <Animated.View style={[s.titleDot, dotStyle]} />
            <Text
              style={[s.titleText, { color: title.trim() ? g.textPrimary : g.textMuted }, !title.trim() && { fontWeight: FONT_WEIGHT.medium }]}
              numberOfLines={1}
            >
              {title.trim() || t('live.addTitle')}
            </Text>
            <Pencil size={15} stroke={g.textMuted} strokeWidth={2} />
          </Pressable>

          {/* Publikum + Kategorie */}
          <View style={s.tileRow}>
            <Pressable style={[s.tile, { backgroundColor: g.fill }]} onPress={cycleAudience}>
              <Text style={s.tileEmoji}>{audienceMeta.emoji}</Text>
              <View style={s.tileTextCol}>
                <Text style={[s.tileLabel, { color: g.textMuted }]}>{t('live.audience')}</Text>
                <Text style={[s.tileValue, { color: g.textPrimary }]} numberOfLines={1}>{audienceMeta.label}</Text>
              </View>
            </Pressable>
            <Pressable style={[s.tile, { backgroundColor: g.fill }]} onPress={() => setSettingsSheet(true)}>
              <Tag size={18} stroke={colors.text.secondary} strokeWidth={2} />
              <View style={s.tileTextCol}>
                <Text style={[s.tileLabel, { color: g.textMuted }]}>{t('live.category')}</Text>
                <Text style={[s.tileValue, { color: g.textPrimary }]} numberOfLines={1}>{category ?? t('live.choose')}</Text>
              </View>
            </Pressable>
          </View>

          {/* Cover */}
          <Pressable style={[s.coverRow, { backgroundColor: g.fill }]} onPress={() => setSettingsSheet(true)}>
            <View style={[s.coverThumb, { backgroundColor: g.fillHover }]}>
              {thumbnailUrl ? (
                <ExpoImage source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <ImageIcon size={18} stroke={g.textMuted} strokeWidth={1.8} />
              )}
            </View>
            <View style={s.tileTextCol}>
              <Text style={[s.coverTitle, { color: g.textPrimary }]}>{thumbnailUrl ? t('live.coverSet') : t('live.chooseCover')}</Text>
              <Text style={[s.coverSub, { color: g.textMuted }]} numberOfLines={1}>{t('live.galleryOrAi')}</Text>
            </View>
            <View style={s.aiChip}>
              <Sparkles size={12} stroke={g.accent} strokeWidth={2} />
              <Text style={[s.aiChipText, { color: g.accent }]}>KI</Text>
            </View>
          </Pressable>

          {/* Toggles: Kommentare / Geschenke */}
          <View style={s.tileRow}>
            <Pressable
              style={[s.toggleChip, { backgroundColor: g.fill, borderColor: g.border }, allowComments && s.toggleChipOn]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAllowComments((v) => !v); }}
            >
              <MessageCircle size={15} stroke={allowComments ? LC.accent.success : g.textMuted} strokeWidth={2} />
              <Text style={[s.toggleText, { color: allowComments ? g.textPrimary : g.textMuted }]}>
                Kommentare {allowComments ? 'an' : 'aus'}
              </Text>
            </Pressable>
            <Pressable
              style={[s.toggleChip, { backgroundColor: g.fill, borderColor: g.border }, allowGifts && s.toggleChipOn]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAllowGifts((v) => !v); }}
            >
              <Gift size={15} stroke={allowGifts ? LC.accent.success : g.textMuted} strokeWidth={2} />
              <Text style={[s.toggleText, { color: allowGifts ? g.textPrimary : g.textMuted }]}>
                Geschenke {allowGifts ? 'an' : 'aus'}
              </Text>
            </Pressable>
          </View>
         </View>
        </GlassPanel>

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
                  {scheduledLiveIdRef.current ? t('live.goLiveNow') : 'LIVE gehen'}
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
            <Text style={s.planBtnText}>{t('live.scheduleInstead')}</Text>
          </Pressable>
        )}

        <Text style={s.hint}>
          {scheduledLiveIdRef.current
            ? t('live.linkedFollowers')
            : t('live.followersNotified')}
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
            <Text style={ss.title}>{t('live.settings')}</Text>

            {/* Titel */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>TITEL</Text>
              <View style={ss.inputRow}>
                <TextInput
                  style={ss.input}
                  placeholder={t('live.titlePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                  selectionColor="#FF2D55"
                />
              </View>
            </View>

            {/* Cover (KI-generiert) — Phase 3 AI-Image-Rollout */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>COVER</Text>
              <View style={ss.coverRow}>
                <View style={ss.coverPreview}>
                  {thumbnailUrl ? (
                    <ExpoImage
                      source={{ uri: thumbnailUrl }}
                      style={ss.coverImg}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={ss.coverEmpty}>
                      <Sparkles size={20} stroke="#C1C9D4" strokeWidth={1.8} />
                    </View>
                  )}
                </View>
                <View style={ss.coverActions}>
                  <View style={ss.coverBtnRow}>
                    <Pressable
                      style={[ss.coverAIBtn, coverUploading && ss.coverBtnDisabled]}
                      disabled={coverUploading}
                      onPress={() => {
                        setSettingsSheet(false);
                        // kleiner Delay damit die Settings-Sheet-Animation weg ist,
                        // bevor das AI-Sheet reinslidet (sonst visueller Stack-Jank)
                        setTimeout(() => setShowAISheet(true), 260);
                      }}
                    >
                      <Sparkles size={15} stroke="#fff" strokeWidth={2} />
                      <Text style={ss.coverAIBtnText}>{t('live.withAi')}</Text>
                    </Pressable>
                    <Pressable
                      style={[ss.coverGalleryBtn, coverUploading && ss.coverBtnDisabled]}
                      disabled={coverUploading}
                      onPress={pickCoverFromGallery}
                    >
                      {coverUploading ? (
                        <ActivityIndicator size="small" color="#111827" />
                      ) : (
                        <>
                          <ImageIcon size={15} stroke="#111827" strokeWidth={2} />
                          <Text style={ss.coverGalleryBtnText}>{t('live.gallery')}</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  {thumbnailUrl && (
                    <Pressable style={ss.coverRemoveBtn} onPress={() => setThumbnailUrl(null)}>
                      <Text style={ss.coverRemoveText}>{t('live.removeCover')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* Kategorie */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>KATEGORIE</Text>
              <View style={ss.catWrap}>
                {LIVE_CATEGORIES.map((c) => {
                  const active = category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCategory(active ? null : c); }}
                      style={[ss.catChip, active && ss.catChipActive]}
                    >
                      <Text style={[ss.catChipText, active && ss.catChipTextActive]}>{t(`live.cat_${c}` as TranslationKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Toggles */}
            <View style={ss.section}>
              <Text style={ss.sectionLabel}>SICHTBARKEIT</Text>
              <View style={ss.settingsCard}>
                <View style={ss.row}>
                  <View>
                    <Text style={ss.rowTitle}>{t('live.comments')}</Text>
                    <Text style={ss.rowSub}>{t('live.commentsSub')}</Text>
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
                    <Text style={ss.rowTitle}>{t('live.gifts')}</Text>
                    <Text style={ss.rowSub}>{t('live.giftsSub')}</Text>
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
                <View style={ss.audienceBlock}>
                  <Text style={ss.rowTitle}>{t('live.whoCanWatch')}</Text>
                  <Text style={ss.rowSub}>
                    {audience === 'public'
                      ? t('live.audAllPublic')
                      : audience === 'followers'
                      ? t('live.audFollowersDesc')
                      : t('live.audWomenDesc')}
                  </Text>
                  <View style={[ss.catWrap, { marginTop: 10 }]}>
                    <Pressable
                      onPress={() => setAudience('public')}
                      style={[ss.catChip, audience === 'public' && ss.catChipActive]}
                    >
                      <Text style={[ss.catChipText, audience === 'public' && ss.catChipTextActive]}>🌍 Öffentlich</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setAudience('followers')}
                      style={[ss.catChip, audience === 'followers' && ss.catChipActive]}
                    >
                      <Text style={[ss.catChipText, audience === 'followers' && ss.catChipTextActive]}>👥 Nur Follower</Text>
                    </Pressable>
                    {canAccessWomenOnly && (
                      <Pressable
                        onPress={() => setAudience('women')}
                        style={[ss.catChip, audience === 'women' && ss.catChipActive]}
                      >
                        <Text style={[ss.catChipText, audience === 'women' && ss.catChipTextActive]}>🌸 Nur Frauen</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>

            <Pressable style={ss.doneBtn} onPress={() => setSettingsSheet(false)}>
              <Text style={ss.doneBtnText}>{t('live.done')}</Text>
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

      {/* ── AI-Cover-Sheet (Phase 3 AI-Image-Rollout) ───────────────── */}
      <AIImageSheet
        visible={showAISheet}
        onClose={() => setShowAISheet(false)}
        onUseImage={(url) => {
          setThumbnailUrl(url);
          setShowAISheet(false);
          // Settings-Sheet wieder öffnen, damit der Host den Flow nicht verliert
          setTimeout(() => setSettingsSheet(true), 220);
        }}
        purpose="live_thumbnail"
        defaultSize="1024x1536"
        title="Live-Cover generieren"
        promptPlaceholder="Beschreibe das Cover-Bild für deinen Stream…"
        suggestions={[
          t('live.aiGaming'),
          t('live.aiReading'),
          t('live.aiFitness'),
          t('live.aiCooking'),
        ]}
      />
    </View>
  );
}

// ─── Plan-Sheet: Zeitpunkt wählen ───────────────────────────────────────────

function presetOptions(t: (k: TranslationKey) => string): { label: string; at: Date }[] {
  const now = new Date();
  const opts: { label: string; at: Date }[] = [];

  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  opts.push({ label: t('live.schedIn1h'), at: in1h });
  opts.push({ label: t('live.schedIn3h'), at: in3h });

  const today20 = new Date(now); today20.setHours(20, 0, 0, 0);
  if (today20.getTime() > now.getTime() + 5 * 60_000) {
    opts.push({ label: t('live.schedToday8'), at: today20 });
  }

  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  const t9  = new Date(tom); t9.setHours(9, 0, 0, 0);
  const t20 = new Date(tom); t20.setHours(20, 0, 0, 0);
  opts.push({ label: t('live.schedTomorrow9'), at: t9 });
  opts.push({ label: t('live.schedTomorrow8'), at: t20 });

  const next7 = new Date(now); next7.setDate(next7.getDate() + 7); next7.setHours(20, 0, 0, 0);
  opts.push({ label: t('live.schedWeek'), at: next7 });

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
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(new Date(Date.now() + 60 * 60_000));

  // Bei jedem Öffnen auf +1h resetten — vermeidet veraltete Werte.
  useEffect(() => {
    if (visible) setDate(new Date(Date.now() + 60 * 60_000));
  }, [visible]);

  const presets   = presetOptions(t);
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
          <Text style={ps.heading}>{t('live.schedule')}</Text>
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
              <Text style={ps.btnGhostText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(date)}
              disabled={isSaving || !valid}
              style={[ps.btn, ps.btnPrimary, (isSaving || !valid) && { opacity: 0.5 }]}
            >
              <Text style={ps.btnPrimaryText}>
                {isSaving ? t('live.scheduling') : t('live.scheduleBtn')}
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
  root: { flex: 1, backgroundColor: LC.black },

  topBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.base,
    zIndex: 20,
  },
  iconBtn: { width: 40, height: 40, borderRadius: RADII.full, overflow: 'hidden' },
  iconBtnBlur: {
    width: 40, height: 40, borderRadius: RADII.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LC.border.default,
    overflow: 'hidden',
  },

  permBanner: {
    position: 'absolute', top: '40%', left: 32, right: 32, alignItems: 'center',
  },
  permBtn: {
    backgroundColor: LC.bg.input,
    paddingVertical: 13, paddingHorizontal: SPACE.xl,
    borderRadius: RADII.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: LC.border.strong,
  },
  permBtnText: { color: LC.text.primary, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },

  // Bottom
  bottomArea: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 14, paddingHorizontal: SPACE.lg,
  },
  // ── Setup-Karte: nur äußere Breite — Glas/Border/Padding liefert GlassPanel ──
  setupCard: {
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: LC.whiteSubtle, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 12,
  },
  titleDot: { width: 8, height: 8, borderRadius: RADII.full, backgroundColor: LC.accent.live },
  titleText: { flex: 1, color: LC.text.primary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  tileRow: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: LC.whiteSubtle, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 11,
  },
  tileEmoji: { fontSize: 17 },
  tileTextCol: { flex: 1, minWidth: 0 },
  tileLabel: { color: LC.text.muted, fontSize: FONT_SIZE.xs, marginBottom: 1 },
  tileValue: { color: LC.text.primary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  coverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: LC.whiteSubtle, borderRadius: 12,
    paddingVertical: 9, paddingHorizontal: 11,
  },
  coverThumb: {
    width: 38, height: 38, borderRadius: 9, overflow: 'hidden',
    backgroundColor: LC.bg.input, alignItems: 'center', justifyContent: 'center',
  },
  coverTitle: { color: LC.text.primary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  coverSub: { color: LC.text.muted, fontSize: FONT_SIZE.xs, marginTop: 1 },
  aiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(168,85,247,0.22)', paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: 8,
  },
  aiChipText: { color: LC.accent.purpleLight, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  toggleChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: LC.whiteSubtle, borderRadius: 10, paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth, borderColor: LC.border.subtle,
  },
  toggleChipOn: { backgroundColor: 'rgba(34,197,94,0.14)', borderColor: 'rgba(34,197,94,0.4)' },
  toggleText: { color: LC.text.muted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  liveBtn: { width: '100%', borderRadius: 18, overflow: 'hidden', shadowColor: LC.accent.live, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 },
  liveBtnDisabled: { opacity: 0.55 },
  liveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: 17 },
  liveDot: { width: 8, height: 8, borderRadius: RADII.full, backgroundColor: LC.white },
  liveBtnText: { color: LC.text.primary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.3 },

  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.base,
    borderRadius: RADII.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: LC.border.default,
    backgroundColor: LC.whiteSubtle,
  },
  planBtnText: { color: LC.text.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.2 },

  hint: { color: LC.text.faint, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  countdownWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  countdownText: { fontSize: 120, fontWeight: FONT_WEIGHT.bold, color: LC.text.primary, textShadowColor: LC.accent.live, textShadowRadius: 30 },
});

// ─── Settings Sheet Styles (Light-Mode Sheet — weißer Hintergrund) ────────────
const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: LC.bg.dimOverlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: SPACE.lg,
  },
  handle: { width: 36, height: 4, borderRadius: RADII.full, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: SPACE.lg },
  title: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: '#111827', marginBottom: SPACE.lg, letterSpacing: -0.3 },

  section: { marginBottom: SPACE.lg },
  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#9CA3AF', letterSpacing: 0.6, marginBottom: SPACE.sm },

  inputRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: { fontSize: FONT_SIZE.md, color: '#111827', paddingVertical: 11 },

  settingsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.base,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: '#111827', marginBottom: 1 },
  rowSub: { fontSize: FONT_SIZE.xs, color: '#9CA3AF' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: SPACE.base },

  doneBtn: {
    backgroundColor: '#111827',
    borderRadius: RADII.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACE.xs,
  },
  doneBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  // Cover-Row (KI-Cover)
  coverRow: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center' },
  coverPreview: {
    width: 72, height: 108, borderRadius: RADII.md, overflow: 'hidden',
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverActions: { flex: 1, gap: SPACE.sm },
  coverBtnRow: { flexDirection: 'row', gap: SPACE.sm },
  coverAIBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: LC.accent.purple, borderRadius: RADII.md,
    paddingVertical: 11, paddingHorizontal: 10,
  },
  coverAIBtnText: { color: LC.white, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  coverGalleryBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#F3F4F6', borderRadius: RADII.md,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 11, paddingHorizontal: 10,
  },
  coverGalleryBtnText: { color: '#111827', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  coverBtnDisabled: { opacity: 0.5 },
  coverRemoveBtn: { alignSelf: 'flex-start', paddingVertical: SPACE.xs, paddingHorizontal: 2 },
  coverRemoveText: { color: '#9CA3AF', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  // Kategorie-Chips
  audienceBlock: { paddingVertical: 8 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  catChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  catChipText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: '#374151' },
  catChipTextActive: { color: '#fff' },
});

// ─── Plan-Sheet Styles ──────────────────────────────────────────────────────
const ps = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: LC.bg.dimOverlay, justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: SPACE.lg,
  },
  handle: {
    width: 36, height: 4, borderRadius: RADII.full, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 14,
  },
  heading: {
    fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: '#111827',
    textAlign: 'center', letterSpacing: -0.3,
  },
  sub: {
    fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium, color: '#6B7280',
    textAlign: 'center', marginTop: SPACE.xs, marginBottom: 14,
  },

  titlePreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: SPACE.md, paddingVertical: 9,
    marginBottom: SPACE.sm,
  },
  titlePreviewLabel: {
    fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#9CA3AF',
    letterSpacing: 0.6, marginBottom: 3,
  },
  titlePreviewText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: '#111827' },

  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md, borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 14, paddingHorizontal: SPACE.base,
    alignItems: 'center', gap: SPACE.xs,
  },
  dateBig: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: '#111827', letterSpacing: -0.6 },
  dateHint: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: '#6B7280' },

  sectionLabel: {
    fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#9CA3AF',
    letterSpacing: 0.8, marginTop: 14, marginBottom: SPACE.sm, paddingLeft: 2,
  },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  preset: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.full, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: SPACE.md, paddingVertical: 7,
  },
  presetText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#111827' },

  stepperRow: { flexDirection: 'row', gap: SPACE.sm },
  stepper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md, borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', paddingVertical: SPACE.sm, gap: SPACE.xs,
  },
  stepperBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  stepperLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#111827' },

  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.base },
  btn: {
    flex: 1, borderRadius: RADII.md, paddingVertical: 13, alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  btnGhostText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: '#111827' },
  btnPrimary: { backgroundColor: '#111827' },
  btnPrimaryText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF' },
});

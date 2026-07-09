import { AIImageSheet } from '@/components/ai/AIImageSheet';
import { VoiceSetupSheet } from '@/components/profile/VoiceSetupSheet';
import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';
import { useAuthStore } from '@/lib/authStore';
import { useI18n } from '@/lib/i18n';
import { usePrompt } from '@/lib/promptCrossPlatform';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/uploadMedia';
import { useNotificationPrefs } from '@/lib/useNotificationPrefs';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import {
launchCameraAsync,
launchImageLibraryAsync,
requestCameraPermissionsAsync,
requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
ArrowLeft,
AtSign,
BellOff,
Camera,Check,
ChevronRight,
ExternalLink,
FileText,
Heart,
Link,
Lock,
LogOut,
Mail,
MessageCircle,
Mic,
Radio,
Repeat2,
Globe,
Shield,
ShieldCheck,
Sparkles,
Sun,
Share2,
Trash2,
User,Users,
UserPlus,
Zap
} from 'lucide-react-native';
import { useRef,useState } from 'react';
import {
ActivityIndicator,Alert,KeyboardAvoidingView,
Linking,
Platform,
Pressable,ScrollView,
Share,
StyleSheet,
Switch,
Text,
TextInput,
View,
} from 'react-native';
import { useAnimatedStyle,useSharedValue,withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

// Vollständige Liste tschetschenischer Тейпы (Clans / Teips)
// Geordnet nach Тукхум (Stammesverbände) + freie Teips
// Quellen: официальная чеченская этнография, waynakh.com, энциклопедии
const TEIP_LIST: string[] = [...new Set([
  // ── Нохчмахкахой (Нохчмахкахой Туккхум) ──────────────────────────────
  'Аллерой', 'Белгатой', 'Беной', 'Билтой', 'Гендаргеной', 'Зандакъой',
  'Курчалой', 'Нохчмахкахой', 'Саьлий', 'Симсой', 'Центарой', 'Цонтарой',
  'Чермой', 'Эрсаной', 'Элстанжхой',

  // ── Чаьнтий (Чанти Туккхум) ──────────────────────────────────────────
  'Варандой', 'Гордалой', 'Дай', 'Дишний', 'Зумсой', 'Кулой',
  'Кхяккхой', 'Нашхой', 'Суьлий', 'Хаккой', 'Чаьнтий',

  // ── Аккхий (Аккий Туккхум) ────────────────────────────────────────────
  'Аккхий', 'Га1алай', 'Нашхой', 'Садой', 'Хиндой', 'Хьалхарой',

  // ── Шатой (Шатой Туккхум) ─────────────────────────────────────────────
  'Болхой', 'Ведений', 'Зумсой', 'Ишхой', 'Маьлхий', 'Нашхой',
  'Пешхой', 'Садой', 'Сатой', 'Харачой', 'Химой', 'Шатой',
  'Шикарой', 'Шуьйтой',

  // ── Малхий (Малхи Туккхум) ────────────────────────────────────────────
  'Майстой', 'Маьлхий', 'Мелхий', 'Тумсой', 'Хьачарой',

  // ── Чеберлой (Чеберлой Туккхум) ──────────────────────────────────────
  'Барчхой', 'Билтой', 'Дарбанхой', 'Кийчой', 'Нашхой', 'Регахой',
  'Саьдой', 'Цикарой', 'Чеберлой', 'Энгеной',

  // ── Нохчий (Нохчмахкахой другой) ─────────────────────────────────────
  'Белхарой', 'Бовткой', 'Гуной', 'Хьачарой', 'Хилдехьарой',

  // ── Терлой (Терлой Туккхум) ───────────────────────────────────────────
  'Балой', 'Терлой', 'Хьарахой',

  // ── Нохчий (ohne Туккхум / свободные тейпы) ──────────────────────────
  'Айткхаллой', 'Арсалой', 'Атагой', 'Ахархой', 'Аьккхий',
  'Баьсний', 'Белгой', 'Бийтарой', 'Бовхой', 'Борзой',
  'Булгучой', 'Вашандарой', 'Гала1ай', 'Галай', 'Гантой',
  'Гарангой', 'Гатой', 'Гачалкой', 'Гелдагой', 'Гендашой',
  'Гехой', 'Гiараш', 'Гилой', 'Гичалой', 'Гойтой',
  'Гудермесой', 'Гумкой', 'Гунашой', 'Дурдхой', 'Жевой',
  'Зогой', 'Зоьрхой', 'Зоьпхой', 'Ингушой', 'Ирзой',
  'Кей', 'Кеший', 'Кортой', 'Курой', 'Кхерой',
  'Лаьмрой', 'Лашкарой', 'Лебой', 'Маккхой', 'Мартанхой',
  'Махкой', 'Минкой', 'Мочхой', 'Муцалхой', 'Нашах',
  'Нашхой', 'Никарой', 'Ножой', 'Оьздой', 'Памятой',
  'Пхьарчхой', 'Регахой', 'Сесанхой', 'Сирхой', 'Старой',
  'Суьлий', 'Тарской', 'Тасой', 'Туркой', 'Хамхой',
  'Ханкалой', 'Хилой', 'Химой', 'Хобахой', 'Холой',
  'Хьоькхой', 'Чинхой', 'Чкъарой', 'Шаройхой', 'Ширдий',
  'Эгашбатой', 'Элисханхой', 'Энгеной', 'Эрпалой',
])].sort((a, b) => a.localeCompare(b, 'ru'));

export default function SettingsScreen() {
  useThemedStatusBar('auto');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();
  const { show: showPrompt } = usePrompt();
  const { t } = useI18n();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [teip, setTeip] = useState<string | null>(profile?.teip ?? null);
  const [showTeipPicker, setShowTeipPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState((profile as any)?.is_private ?? false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  // v1.28.0: AI-Image-Sheet für generierte Avatare
  const [showAIAvatar, setShowAIAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [showWomenOnly, setShowWomenOnly] = useState(false);
  const { canAccessWomenOnly, deactivate } = useWomenOnly();
  const queryClient = useQueryClient();
  // #5 Referral — Einladungslink + Zähler.
  const inviteUrl = profile?.username ? `https://www.serlo.ch/i/${profile.username}` : null;
  const { data: referralCount = 0 } = useQuery({
    queryKey: ['referral-count', profile?.id],
    enabled: !!profile?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_my_referral_count');
      return (data as number | null) ?? 0;
    },
  });
  const handleInvite = async () => {
    if (!inviteUrl) return;
    try {
      await Share.share({ message: t('settings.inviteShareMsg', { url: inviteUrl }) });
    } catch { /* abgebrochen */ }
  };
  const { prefs: notifPrefs, setPrefs: setNotifPrefs } = useNotificationPrefs();
  const hasVoice = !!(profile as any)?.voice_sample_url;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useThemeStore: _useTS } = require('@/lib/themeStore') as any;
  const themeMode    = _useTS((s: any) => s.mode);
  const setThemeMode = _useTS((s: any) => s.setMode);
  const colors       = _useTS((s: any) => s.colors);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useI18nStore: _useI18nS } = require('@/lib/i18n') as any;
  const appLocale       = _useI18nS((s: any) => s.locale);
  const setAppLocale    = _useI18nS((s: any) => s.setLocale);
  const appPickedByUser = _useI18nS((s: any) => s.pickedByUser);
  const useDeviceLocale = _useI18nS((s: any) => s.useDeviceLocale);

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const currentAvatar = avatarUri ?? profile?.avatar_url ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const pickAvatar = () => {
    Alert.alert(t('settings.avatarChangeTitle'), t('settings.avatarChangeMsg'), [
      {
        text: t('settings.avatarWithAi'),
        onPress: () => setShowAIAvatar(true),
      },
      {
        text: t('settings.camera'),
        onPress: async () => {
          const { status } = await requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert(t('settings.permTitle'), t('settings.permCamera')); return; }
          const result = await launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      {
        text: t('settings.gallery'),
        onPress: async () => {
          const { status } = await requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert(t('settings.permTitle'), t('settings.permPhotos')); return; }
          const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!profile) return;
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { Alert.alert(t('settings.checkTitle'), t('settings.usernameEmpty')); return; }
    if (trimmedUsername.length < 3) { Alert.alert(t('settings.checkTitle'), t('settings.usernameMin3')); return; }
    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarUri) {
        // v1.28.0: AI-generierte Avatare liegen bereits im Supabase-Storage
        // (public URL aus `ai-generated`-Bucket) — kein Re-Upload nötig.
        if (avatarUri.startsWith('http://') || avatarUri.startsWith('https://')) {
          avatarUrl = avatarUri;
        } else {
          const { url } = await uploadAvatar(profile.id, avatarUri);
          avatarUrl = url;
        }
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername, bio: bio.trim() || null, website: website.trim() || null, avatar_url: avatarUrl, teip: teip || null })
        .eq('id', profile.id).select().single();
      if (error) {
        if (error.code === '23505') Alert.alert(t('settings.takenTitle'), t('settings.takenText'));
        else throw error;
        return;
      }
      if (data) setProfile(data as typeof profile);
      queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['guild-feed'] });
      Alert.alert(t('settings.savedTitle'), t('settings.savedText'), [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert(t('settings.oops'), err?.message ?? t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    showPrompt({
      title: t('settings.changePw'),
      message: t('settings.changePwMsg'),
      secureText: true,
      onConfirm: async (newPassword) => {
        if (!newPassword) return;
        if (newPassword.length < 8) { Alert.alert(t('settings.tooShort'), t('settings.pwMin8')); return; }
        setChangingPw(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setChangingPw(false);
        if (error) Alert.alert(t('settings.oops'), error.message);
        else Alert.alert(t('settings.pwChanged'), t('settings.pwChangedText'));
      },
    });
  };

  const handleChangeEmail = () => {
    showPrompt({
      title: t('settings.changeEmail'),
      message: t('settings.changeEmailMsg'),
      keyboardType: 'email-address',
      onConfirm: async (newEmail) => {
        if (!newEmail || !newEmail.includes('@')) { Alert.alert(t('settings.emailCheck'), t('settings.emailInvalid')); return; }
        setChangingEmail(true);
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        setChangingEmail(false);
        if (error) Alert.alert(t('settings.oops'), error.message);
        else Alert.alert(t('settings.linkSent'), t('settings.linkSentText'));
      },
    });
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: async () => { queryClient.clear(); await useAuthStore.getState().signOut(); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteWarn'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteNow'), style: 'destructive', onPress: async () => {
          Alert.alert(t('settings.deleteSure'), t('settings.deleteIrreversible'), [
            { text: t('settings.deleteKeep'), style: 'cancel' },
            {
              text: t('settings.deleteConfirmYes'), style: 'destructive', onPress: async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  if (!token) throw new Error(t('settings.noSession'));
                  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
                  const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
                    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  });
                  // Nur bei ECHTEM Erfolg ausloggen — vorher wurde jeder Fehler
                  // verschluckt und der User trotzdem ausgeloggt, obwohl der
                  // Auth-Account in Supabase erhalten blieb.
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({} as { error?: string }));
                    throw new Error(body?.error ?? t('settings.deleteFailedStatus', { status: res.status }));
                  }
                  queryClient.clear();
                  await useAuthStore.getState().signOut();
                } catch (e: any) {
                  Alert.alert(
                    t('settings.deleteFailedTitle'),
                    e?.message ?? t('settings.tryLater'),
                  );
                }
              },
            },
          ]);
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: colors.border.subtle }]}>
        <Pressable
          onPress={() => router.back()}
          style={[s.headerBtn, { backgroundColor: colors.bg.elevated }]}
          accessibilityRole="button" accessibilityLabel={t('settings.back')}
        >
          <ArrowLeft size={18} stroke={colors.text.primary} strokeWidth={2.5} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>{t('settings.title')}</Text>
        <Animated.View style={saveStyle}>
          <Pressable
            onPressIn={() => { saveScale.value = withTiming(0.9, { duration: 80 }); }}
            onPressOut={() => { saveScale.value = withTiming(1, { duration: 80 }); }}
            onPress={handleSave}
            disabled={saving}
            style={[s.saveBtn, { backgroundColor: colors.text.primary }]}
            accessibilityRole="button" accessibilityLabel={t('settings.a11ySave')}
          >
            {saving
              ? <ActivityIndicator color={colors.bg.primary} size="small" />
              : <><Check size={13} stroke={colors.bg.primary} strokeWidth={3} /><Text style={[s.saveBtnText, { color: colors.bg.primary }]}>{t('settings.save')}</Text></>
            }
          </Pressable>
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar / Profil-Card ── */}
        <View style={[s.profileCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable onPress={pickAvatar} style={s.avatarWrap} accessibilityRole="button" accessibilityLabel={t('settings.avatarChangeTitle')}>
            {currentAvatar ? (
              <Image source={{ uri: currentAvatar }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <>
                <LinearGradient colors={['#E8E8E8', '#D0D0D0']} style={StyleSheet.absoluteFill} />
                <User size={38} stroke={colors.text.muted} strokeWidth={1.5} />
              </>
            )}
            {/* Edit Overlay */}
            <View style={s.avatarOverlay}>
              <Camera size={16} stroke="#fff" strokeWidth={2} />
            </View>
          </Pressable>
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: colors.text.primary }]}>
              {profile?.username ?? '—'}
            </Text>
            <Text style={[s.profileSub, { color: colors.text.muted }]}>
              {t('settings.tapPhotoToChange')}
            </Text>
          </View>
        </View>

        {/* ── Profil bearbeiten ── */}
        <SectionLabel label={t('settings.secProfile')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>

          <View style={s.fieldRow}>
            <View style={s.fieldIcon}>
              <AtSign size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.username')}</Text>
              <TextInput
                style={[s.fieldInput, { color: colors.text.primary }]}
                value={username} onChangeText={setUsername}
                placeholder={t('settings.usernamePlaceholder')} placeholderTextColor={colors.text.muted}
                autoCapitalize="none" autoCorrect={false} maxLength={30}
              />
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <View style={s.fieldRow}>
            <View style={s.fieldIcon}>
              <FileText size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.bio')} · {bio.length}/150</Text>
              <TextInput
                style={[s.fieldInput, s.bioInput, { color: colors.text.primary }]}
                value={bio} onChangeText={setBio}
                placeholder={t('settings.bioPlaceholder')}
                placeholderTextColor={colors.text.muted}
                multiline maxLength={150}
              />
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <View style={s.fieldRow}>
            <View style={s.fieldIcon}>
              <Users size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.teipLabel')}</Text>
              <Pressable onPress={() => setShowTeipPicker(!showTeipPicker)} style={s.teipTrigger}>
                <Text style={[s.fieldInput, { color: teip ? colors.text.primary : colors.text.muted, flex: 1 }]}>
                  {teip ? `🏔️ ${teip}` : t('settings.teipSelect')}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: 10 }}>{showTeipPicker ? '▲' : '▼'}</Text>
              </Pressable>
              {showTeipPicker && (
                <ScrollView
                  style={[s.teipDropdown, { borderTopColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <Pressable style={s.teipOption} onPress={() => { setTeip(null); setShowTeipPicker(false); }}>
                    <Text style={{ fontSize: 14, color: !teip ? colors.accent.primary : colors.text.secondary }}>{t('settings.teipNone')}</Text>
                    {!teip && <Check size={13} stroke={colors.accent.primary} strokeWidth={2.5} />}
                  </Pressable>
                  {TEIP_LIST.map((name) => (
                    <Pressable key={name} style={[s.teipOption, { borderBottomColor: colors.border.subtle }]} onPress={() => { setTeip(name); setShowTeipPicker(false); }}>
                      <Text style={{ fontSize: 14, color: teip === name ? colors.accent.primary : colors.text.secondary }}>🏔️ {name}</Text>
                      {teip === name && <Check size={13} stroke={colors.accent.primary} strokeWidth={2.5} />}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <View style={s.fieldRow}>
            <View style={s.fieldIcon}>
              <Link size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.website')}</Text>
              <TextInput
                style={[s.fieldInput, { color: colors.text.primary }]}
                value={website} onChangeText={setWebsite}
                placeholder={t('settings.websitePlaceholder')} placeholderTextColor={colors.text.muted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={100}
              />
            </View>
          </View>
        </View>

        {/* ── Freunde einladen (#5 Referral) ── */}
        <SectionLabel label={t('settings.secInvite')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={handleInvite} accessibilityRole="button" disabled={!inviteUrl}>
            <View style={s.rowIcon}>
              <UserPlus size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.inviteTitle')}</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {referralCount > 0
                  ? t(referralCount === 1 ? 'settings.inviteCountOne' : 'settings.inviteCountMany', { count: referralCount })
                  : t('settings.inviteSub')}
              </Text>
            </View>
            <Share2 size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Women-Only Zone ── */}
        <SectionLabel label={t('settings.secWomenOnly')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.rowItem, { paddingVertical: 11 }]}>
            <View style={s.rowIcon}>
              <Text style={{ fontSize: 16 }}>🌸</Text>
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: canAccessWomenOnly ? colors.accent.rose : colors.text.primary }]}>
                {canAccessWomenOnly ? t('settings.wozActive') : t('settings.wozTitle')}
              </Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {canAccessWomenOnly
                  ? t('settings.wozHasAccess')
                  : t('settings.wozVerify')}
              </Text>
            </View>
            {canAccessWomenOnly ? (
              <Pressable
                onPress={async () => {
                  Alert.alert(
                    t('settings.wozLeaveTitle'),
                    t('settings.wozLeaveText'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('settings.wozLeave'), style: 'destructive', onPress: async () => {
                        const { error } = await deactivate();
                        if (error) Alert.alert(t('settings.oops'), error);
                      }},
                    ]
                  );
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 12, color: colors.text.muted }}>{t('settings.wozLeave')}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[s.saveBtn, { backgroundColor: colors.accent.rose, paddingHorizontal: 12, paddingVertical: 8 }]}
                onPress={() => setShowWomenOnly(true)}
                accessibilityRole="button"
              >
                <Text style={[s.saveBtnText, { color: '#fff', fontSize: 12 }]}>{t('settings.wozActivate')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Darstellung ── */}
        <SectionLabel label={t('settings.secAppearance')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.fieldRow, { alignItems: 'flex-start', paddingBottom: 12 }]}>
            <View style={s.fieldIcon}>
              <Sun size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.appearance')}</Text>
              <View style={s.themeRow}>
                {(['system', 'dark', 'light'] as const).map((m) => {
                  const labels = { system: t('settings.themeSystem'), dark: t('settings.themeDark'), light: t('settings.themeLight') };
                  const active = themeMode === m;
                  return (
                    <Pressable key={m} onPress={() => setThemeMode(m)}
                      style={[s.themeBtn, {
                        backgroundColor: active ? colors.text.primary : colors.bg.elevated,
                        borderColor: active ? colors.text.primary : colors.border.default,
                      }]}
                      accessibilityRole="button" accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.themeBtnTxt, { color: active ? colors.bg.primary : colors.text.muted }]}>
                        {labels[m]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
          {/* Sprache — v1 manuell (de/ru), Systemsprache kommt mit nächstem Binary */}
          <View style={[s.fieldRow, { alignItems: 'flex-start', paddingVertical: 12 }]}>
            <View style={s.fieldIcon}>
              <Globe size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>{t('settings.langLabel')}</Text>
              <View style={s.themeRow}>
                {([
                  { key: 'auto', label: t('settings.langAuto'), active: !appPickedByUser, onPress: () => useDeviceLocale() },
                  { key: 'de',   label: 'Deutsch',  active: appPickedByUser && appLocale === 'de', onPress: () => setAppLocale('de') },
                  { key: 'ru',   label: 'Русский',  active: appPickedByUser && appLocale === 'ru', onPress: () => setAppLocale('ru') },
                ] as const).map(({ key, label, active, onPress }) => (
                  <Pressable key={key} onPress={onPress}
                    style={[s.themeBtn, {
                      backgroundColor: active ? colors.text.primary : colors.bg.elevated,
                      borderColor: active ? colors.text.primary : colors.border.default,
                    }]}
                    accessibilityRole="button" accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.themeBtnTxt, { color: active ? colors.bg.primary : colors.text.muted }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
          {/* Tab Bar gehört zur Darstellung (war fälschlich unter Privatsphäre) */}
          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => router.push('/settings/tab-bar' as any)} accessibilityRole="button">
            <View style={s.rowIcon}>
              <Zap size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.tabBar')}</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>{t('settings.tabBarSub')}</Text>
            </View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Creator & Verwaltung ── */}
        <SectionLabel label={t('settings.secCreator')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable
            style={[s.rowItem, { paddingVertical: 11 }]}
            onPress={() => router.push(profile?.is_creator ? '/creator/dashboard' : '/creator/activate' as any)}
            accessibilityRole="button"
            accessibilityLabel={profile?.is_creator ? t('settings.creatorStudioOpen') : t('settings.becomeCreatorA11y')}
          >
            <View style={s.rowIcon}>
              <Sparkles size={18} color={colors.accent.secondary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.accent.secondary }]}>
                {profile?.is_creator ? t('settings.creatorStudio') : t('settings.becomeCreator')}
              </Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {profile?.is_creator ? t('settings.creatorStudioSub') : t('settings.becomeCreatorSub')}
              </Text>
            </View>
            <ChevronRight size={16} stroke={colors.accent.secondary} strokeWidth={2} />
          </Pressable>
          {(profile as any)?.is_admin && (
            <>
              <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
              <Pressable
                style={[s.rowItem, { paddingVertical: 11 }]}
                onPress={() => router.push('/admin' as any)}
                accessibilityRole="button"
                accessibilityLabel={t('settings.adminPanel')}
              >
                <View style={s.rowIcon}>
                  <ShieldCheck size={18} color="#6366F1" strokeWidth={2} />
                </View>
                <View style={s.rowBody}>
                  <Text style={[s.rowTitle, { color: '#6366F1' }]}>{t('settings.adminPanel')}</Text>
                  <Text style={[s.rowSub, { color: colors.text.muted }]}>{t('settings.adminPanelSub')}</Text>
                </View>
                <ChevronRight size={16} stroke="#6366F1" strokeWidth={2} />
              </Pressable>
            </>
          )}
        </View>

        {/* ── KI-Stimme ── */}
        <SectionLabel label={t('settings.secVoice')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={s.rowItem} onPress={() => setShowVoiceSetup(true)} accessibilityRole="button">
            <View style={s.rowIcon}>
              <Mic size={18} stroke={hasVoice ? '#A78BFA' : colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: hasVoice ? '#A78BFA' : colors.text.primary }]}>{t('settings.myVoice')}</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {hasVoice ? t('settings.voiceSaved') : t('settings.voiceRecord')}
              </Text>
            </View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Benachrichtigungen ── */}
        <SectionLabel label={t('settings.secNotif')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          {([
            { key: 'likes',      labelKey: 'settings.notifLikes',    icon: Heart,         subKey: 'settings.notifLikesSub' },
            { key: 'comments',   labelKey: 'settings.notifComments', icon: MessageCircle, subKey: 'settings.notifCommentsSub' },
            { key: 'follows',    labelKey: 'settings.notifFollows',  icon: UserPlus,      subKey: 'settings.notifFollowsSub' },
            { key: 'liveAlerts', labelKey: 'settings.notifLive',     icon: Radio,         subKey: 'settings.notifLiveSub' },
            { key: 'messages',   labelKey: 'settings.notifMessages', icon: Mail,          subKey: 'settings.notifMessagesSub' },
            { key: 'reposts',    labelKey: 'settings.notifReposts',  icon: Repeat2,       subKey: 'settings.notifRepostsSub' },
          ] as const).map(({ key, labelKey, icon: Icon, subKey }, i, arr) => (
            <View key={key}>
              <View style={[s.rowItem, { paddingVertical: 10 }]}>
                <View style={s.rowIcon}>
                  <Icon size={18} stroke={colors.text.primary} strokeWidth={2} />
                </View>
                <View style={s.rowBody}>
                  <Text style={[s.rowTitle, { color: colors.text.primary }]}>{t(labelKey)}</Text>
                  <Text style={[s.rowSub, { color: colors.text.muted }]}>{t(subKey)}</Text>
                </View>
                <Switch
                  value={notifPrefs[key]}
                  onValueChange={(val) => setNotifPrefs({ [key]: val })}
                  trackColor={{ false: colors.border.default, true: colors.text.primary }}
                  thumbColor={colors.bg.primary}
                  accessibilityLabel={`${t(labelKey)} ${t('settings.notifSuffix')}`}
                />
              </View>
              {i < arr.length - 1 && <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />}
              {/* v1.17.0: Sub-Row unter "Live-Streams" für host-spezifische Mutes */}
              {key === 'liveAlerts' && notifPrefs.liveAlerts && (
                <>
                  <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
                  <Pressable
                    style={[s.rowItem, { paddingVertical: 10 }]}
                    onPress={() => router.push('/settings/muted-live-hosts' as any)}
                    accessibilityRole="button"
                  >
                    <View style={s.rowIcon}>
                      <BellOff size={18} stroke={colors.text.primary} strokeWidth={2} />
                    </View>
                    <View style={s.rowBody}>
                      <Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.muteHosts')}</Text>
                      <Text style={[s.rowSub, { color: colors.text.muted }]}>{t('settings.muteHostsSub')}</Text>
                    </View>
                    <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>

        {/* ── Privatsphäre & Sicherheit ── */}
        <SectionLabel label={t('settings.secPrivacy')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.rowItem, { paddingVertical: 11 }]}>
            <View style={s.rowIcon}>
              <Lock size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.privateProfile')}</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {isPrivate ? t('settings.privateOn') : t('settings.privateOff')}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={async (val) => {
                setIsPrivate(val);
                const { error } = await supabase.from('profiles').update({ is_private: val }).eq('id', profile?.id ?? '');
                if (error) { setIsPrivate(!val); Alert.alert(t('common.error'), t('settings.prefNotSaved')); }
                else setProfile({ ...(profile as any), is_private: val });
              }}
              trackColor={{ false: colors.border.default, true: colors.text.primary }}
              thumbColor={colors.bg.primary}
              accessibilityLabel={t('settings.privateProfile')}
            />
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => router.push('/blocked-users' as any)} accessibilityRole="button">
            <View style={s.rowIcon}>
              <Shield size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.blockedUsers')}</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          {/* Phase 5b: Co-Host spezifische Blocks (DB-persistent, überlebt App-Restart).
              Separater Screen weil das eine andere Liste ist als die globalen User-Blocks. */}
          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => router.push('/cohost-blocks' as any)} accessibilityRole="button">
            <View style={s.rowIcon}>
              <ShieldCheck size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.cohostBlocks')}</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Rechtliches & Hilfe ── */}
        <SectionLabel label={t('settings.secLegal')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => Linking.openURL('https://www.serlo.ch/privacy').catch(() => {})} accessibilityRole="link">
            <View style={s.rowIcon}>
              <FileText size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.privacyPolicy')}</Text></View>
            <ExternalLink size={15} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => Linking.openURL('https://www.serlo.ch/terms').catch(() => {})} accessibilityRole="link">
            <View style={s.rowIcon}>
              <FileText size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.terms')}</Text></View>
            <ExternalLink size={15} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => Linking.openURL('https://www.serlo.ch/widerruf').catch(() => {})} accessibilityRole="link">
            <View style={s.rowIcon}>
              <FileText size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.withdrawal')}</Text></View>
            <ExternalLink size={15} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={() => router.push('/support' as any)} accessibilityRole="button">
            <View style={s.rowIcon}>
              <Mail size={18} stroke={colors.text.primary} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.helpSupport')}</Text></View>
            <ChevronRight size={15} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Account ── */}
        <SectionLabel label={t('settings.secAccount')} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={handleChangeEmail} disabled={changingEmail} accessibilityRole="button">
            <View style={s.rowIcon}>
              {changingEmail ? <ActivityIndicator size="small" color={colors.text.primary} /> : <Mail size={18} stroke={colors.text.primary} strokeWidth={2} />}
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.changeEmail')}</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 11 }]} onPress={handleChangePassword} disabled={changingPw} accessibilityRole="button">
            <View style={s.rowIcon}>
              {changingPw ? <ActivityIndicator size="small" color={colors.text.primary} /> : <Lock size={18} stroke={colors.text.primary} strokeWidth={2} />}
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t('settings.changePw')}</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Abmelden ── */}
        <Pressable
          onPress={handleLogout}
          style={[s.dangerBtn, { backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.18)' }]}
          accessibilityRole="button" accessibilityLabel={t('settings.logout')}
        >
          <LogOut size={16} stroke="#EF4444" strokeWidth={2} />
          <Text style={[s.dangerBtnText, { color: '#EF4444' }]}>{t('settings.logout')}</Text>
        </Pressable>

        {/* ── Account löschen ── */}
        <Pressable onPress={handleDeleteAccount} style={s.deleteRow} accessibilityRole="button" accessibilityLabel={t('settings.deleteAccount')}>
          <Trash2 size={13} stroke={colors.text.muted} strokeWidth={2} />
          <Text style={[s.deleteText, { color: colors.text.muted }]}>{t('settings.deleteAccount')}</Text>
        </Pressable>

        {/* ── Version ── */}
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={[s.version, { color: colors.text.muted }]}>
            Serlo v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </ScrollView>

      <VoiceSetupSheet visible={showVoiceSetup} onClose={() => setShowVoiceSetup(false)} />
      <WomenOnlyVerificationSheet
        visible={showWomenOnly}
        onClose={() => setShowWomenOnly(false)}
      />

      {/* v1.28.0: AI-Image-Sheet für generierte Avatare */}
      <AIImageSheet
        visible={showAIAvatar}
        onClose={() => setShowAIAvatar(false)}
        onUseImage={(url) => setAvatarUri(url)}
        purpose="avatar"
        defaultSize="1024x1024"
        title={t('settings.aiAvatarTitle')}
        promptPlaceholder={t('settings.aiAvatarPlaceholder')}
        suggestions={[
          t('settings.aiAvatar1'),
          t('settings.aiAvatar2'),
          t('settings.aiAvatar3'),
        ]}
      />
    </KeyboardAvoidingView>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[sl.label, { color: colors.text.muted }]}>{label.toUpperCase()}</Text>;
}
const sl = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, paddingHorizontal: 20, marginBottom: 6, marginTop: 15 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700' },

  // Scroll
  scroll: { paddingTop: 10 },

  // Avatar Card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, borderRadius: 18, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 4,
  },
  avatarWrap: {
    width: 68, height: 68, borderRadius: 34,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 26,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  profileSub: { fontSize: 12 },

  // Card
  card: {
    marginHorizontal: 16, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    // NO overflow:hidden — teip dropdown would be clipped
  },

  // Field rows (edit)
  fieldRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 9,
  },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  fieldBody: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput: { fontSize: 15, paddingVertical: 2 },
  bioInput: { minHeight: 52, textAlignVertical: 'top' },

  // Nav rows (pressable)
  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },

  // Separator
  sep: { height: StyleSheet.hairlineWidth },

  // Teip
  teipTrigger: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  teipDropdown: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, maxHeight: 240 },
  teipOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Theme row
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  themeBtnTxt: { fontSize: 12, fontWeight: '600' },

  // Danger
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 18, paddingVertical: 15,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  deleteText: { fontSize: 13 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 20 },
});

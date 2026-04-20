import { useState, useRef } from 'react';
import { useTheme } from '@/lib/useTheme';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import {
  requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync,
  launchImageLibraryAsync, launchCameraAsync,
} from 'expo-image-picker';
import {
  ArrowLeft, Camera, Check, User, Users, FileText, AtSign,
  LogOut, Trash2, Lock, Mail, Shield, ExternalLink, ChevronRight,
  Bell, Link, Mic, Sun, ShieldCheck, Zap, Sparkles,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { uploadAvatar } from '@/lib/uploadMedia';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useNotificationPrefs } from '@/lib/useNotificationPrefs';
import { VoiceSetupSheet } from '@/components/profile/VoiceSetupSheet';
import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';
import { useWomenOnly } from '@/lib/useWomenOnly';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [teip, setTeip] = useState<string | null>(profile?.teip ?? null);
  const [showTeipPicker, setShowTeipPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState((profile as any)?.is_private ?? false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [showWomenOnly, setShowWomenOnly] = useState(false);
  const { canAccessWomenOnly, deactivate } = useWomenOnly();
  const queryClient = useQueryClient();
  const { prefs: notifPrefs, setPrefs: setNotifPrefs } = useNotificationPrefs();
  const [debugTaps, setDebugTaps] = useState(0);
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasVoice = !!(profile as any)?.voice_sample_url;

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { useThemeStore: _useTS } = require('@/lib/themeStore') as any;
  const themeMode    = _useTS((s: any) => s.mode);
  const setThemeMode = _useTS((s: any) => s.setMode);
  const colors       = _useTS((s: any) => s.colors);

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const currentAvatar = avatarUri ?? profile?.avatar_url ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const pickAvatar = () => {
    Alert.alert('Profilbild ändern', 'Wie möchtest du dein Foto auswählen?', [
      {
        text: 'Kamera',
        onPress: async () => {
          const { status } = await requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Kamerazugriff.'); return; }
          const result = await launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const { status } = await requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Fotozugriff.'); return; }
          const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!profile) return;
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { Alert.alert('Fehler', 'Benutzername darf nicht leer sein.'); return; }
    if (trimmedUsername.length < 3) { Alert.alert('Fehler', 'Benutzername muss mindestens 3 Zeichen lang sein.'); return; }
    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarUri) {
        const { url } = await uploadAvatar(profile.id, avatarUri);
        avatarUrl = url;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername, bio: bio.trim() || null, website: website.trim() || null, avatar_url: avatarUrl, teip: teip || null })
        .eq('id', profile.id).select().single();
      if (error) {
        if (error.code === '23505') Alert.alert('Fehler', 'Dieser Benutzername ist bereits vergeben.');
        else throw error;
        return;
      }
      if (data) setProfile(data as typeof profile);
      queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['guild-feed'] });
      Alert.alert('Gespeichert ✓', 'Dein Profil wurde aktualisiert.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Fehler', err?.message ?? 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.prompt('Passwort ändern', 'Gib dein neues Passwort ein (mindestens 8 Zeichen):',
      async (newPassword) => {
        if (!newPassword) return;
        if (newPassword.length < 8) { Alert.alert('Zu kurz', 'Das Passwort muss mindestens 8 Zeichen haben.'); return; }
        setChangingPw(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setChangingPw(false);
        if (error) Alert.alert('Fehler', error.message);
        else Alert.alert('Passwort geändert ✓', 'Dein Passwort wurde erfolgreich aktualisiert.');
      }, 'secure-text');
  };

  const handleChangeEmail = () => {
    Alert.prompt('E-Mail ändern', 'Gib deine neue E-Mail-Adresse ein:',
      async (newEmail) => {
        if (!newEmail || !newEmail.includes('@')) { Alert.alert('Ungültig', 'Bitte gib eine gültige E-Mail-Adresse ein.'); return; }
        setChangingEmail(true);
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        setChangingEmail(false);
        if (error) Alert.alert('Fehler', error.message);
        else Alert.alert('Link gesendet ✓', 'Bitte prüfe dein Postfach und bestätige die Änderung.');
      }, 'plain-text', undefined, 'email-address');
  };

  const handleLogout = () => {
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: async () => { queryClient.clear(); await useAuthStore.getState().signOut(); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Account löschen', '⚠️ Dein Account und ALLE Daten werden dauerhaft gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Jetzt löschen', style: 'destructive', onPress: async () => {
          Alert.alert('Wirklich sicher?', 'Diese Aktion kann NICHT rückgängig gemacht werden.', [
            { text: 'Nein, behalten', style: 'cancel' },
            {
              text: 'Ja, Account löschen', style: 'destructive', onPress: async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  if (token) {
                    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
                    await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
                      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    });
                  }
                } catch { /* ignore */ }
                queryClient.clear();
                await useAuthStore.getState().signOut();
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
          accessibilityRole="button" accessibilityLabel="Zurück"
        >
          <ArrowLeft size={18} stroke={colors.icon.default} strokeWidth={2.5} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Einstellungen</Text>
        <Animated.View style={saveStyle}>
          <Pressable
            onPressIn={() => { saveScale.value = withTiming(0.9, { duration: 80 }); }}
            onPressOut={() => { saveScale.value = withTiming(1, { duration: 80 }); }}
            onPress={handleSave}
            disabled={saving}
            style={[s.saveBtn, { backgroundColor: colors.text.primary }]}
            accessibilityRole="button" accessibilityLabel="Profil speichern"
          >
            {saving
              ? <ActivityIndicator color={colors.bg.primary} size="small" />
              : <><Check size={13} stroke={colors.bg.primary} strokeWidth={3} /><Text style={[s.saveBtnText, { color: colors.bg.primary }]}>Speichern</Text></>
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
          <Pressable onPress={pickAvatar} style={s.avatarWrap} accessibilityRole="button" accessibilityLabel="Profilbild ändern">
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
              Tippe auf das Foto zum Ändern
            </Text>
          </View>
        </View>

        {/* ── Profil bearbeiten ── */}
        <SectionLabel label="Profil" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>

          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: colors.bg.elevated }]}>
              <AtSign size={14} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>Benutzername</Text>
              <TextInput
                style={[s.fieldInput, { color: colors.text.primary }]}
                value={username} onChangeText={setUsername}
                placeholder="dein_username" placeholderTextColor={colors.text.muted}
                autoCapitalize="none" autoCorrect={false} maxLength={30}
              />
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: colors.bg.elevated }]}>
              <FileText size={14} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>Bio · {bio.length}/150</Text>
              <TextInput
                style={[s.fieldInput, s.bioInput, { color: colors.text.primary }]}
                value={bio} onChangeText={setBio}
                placeholder="Beschreibe deinen Vibe..."
                placeholderTextColor={colors.text.muted}
                multiline maxLength={150}
              />
            </View>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: colors.bg.elevated }]}>
              <Users size={14} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>Тейп (Clan)</Text>
              <Pressable onPress={() => setShowTeipPicker(!showTeipPicker)} style={s.teipTrigger}>
                <Text style={[s.fieldInput, { color: teip ? colors.text.primary : colors.text.muted, flex: 1 }]}>
                  {teip ? `🏔️ ${teip}` : 'Auswählen...'}
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
                    <Text style={{ fontSize: 14, color: !teip ? colors.accent.primary : colors.text.secondary }}>— Kein Тейп —</Text>
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
            <View style={[s.fieldIcon, { backgroundColor: colors.bg.elevated }]}>
              <Link size={14} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.fieldBody}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>Website</Text>
              <TextInput
                style={[s.fieldInput, { color: colors.text.primary }]}
                value={website} onChangeText={setWebsite}
                placeholder="https://deine-website.com" placeholderTextColor={colors.text.muted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={100}
              />
            </View>
          </View>
        </View>

        {/* ── Women-Only Zone ── */}
        <SectionLabel label="Women-Only Zone 🌸" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.rowItem, { paddingVertical: 14 }]}>
            <View style={[s.rowIcon, { backgroundColor: canAccessWomenOnly ? 'rgba(244,63,94,0.12)' : colors.bg.elevated }]}>
              <Text style={{ fontSize: 16 }}>🌸</Text>
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: canAccessWomenOnly ? '#F43F5E' : colors.text.primary }]}>
                {canAccessWomenOnly ? 'Women-Only Zone aktiv ✓' : 'Women-Only Zone'}
              </Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {canAccessWomenOnly
                  ? 'Du hast Zugang zu Women-Only Inhalten'
                  : 'Verifiziere dich um Women-Only Inhalte zu sehen'}
              </Text>
            </View>
            {canAccessWomenOnly ? (
              <Pressable
                onPress={async () => {
                  Alert.alert(
                    'Women-Only Zone verlassen?',
                    'Du verlierst den Zugang zu Women-Only Inhalten.',
                    [
                      { text: 'Abbrechen', style: 'cancel' },
                      { text: 'Verlassen', style: 'destructive', onPress: async () => {
                        const { error } = await deactivate();
                        if (error) Alert.alert('Fehler', error);
                      }},
                    ]
                  );
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 12, color: colors.text.muted }}>Verlassen</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[s.saveBtn, { backgroundColor: '#F43F5E', paddingHorizontal: 12, paddingVertical: 8 }]}
                onPress={() => setShowWomenOnly(true)}
                accessibilityRole="button"
              >
                <Text style={[s.saveBtnText, { color: '#fff', fontSize: 12 }]}>Aktivieren</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Darstellung ── */}
        <SectionLabel label="Darstellung" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.fieldRow, { alignItems: 'flex-start', paddingBottom: 16 }]}>
            <View style={[s.fieldIcon, { backgroundColor: colors.bg.elevated }]}>
              <Sun size={14} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[s.fieldLabel, { color: colors.text.muted }]}>Erscheinungsbild</Text>
              <View style={s.themeRow}>
                {(['system', 'dark', 'light'] as const).map((m) => {
                  const labels = { system: '⚙️ System', dark: '🌙 Dark', light: '☀️ Hell' };
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
        </View>

        {/* ── KI-Stimme ── */}
        <SectionLabel label="KI-Stimme" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={s.rowItem} onPress={() => setShowVoiceSetup(true)} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: hasVoice ? 'rgba(167,139,250,0.12)' : colors.bg.elevated }]}>
              <Mic size={15} stroke={hasVoice ? '#A78BFA' : colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: hasVoice ? '#A78BFA' : colors.text.primary }]}>Meine KI-Stimme</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {hasVoice ? '✓ Stimme gespeichert — Chatterbox spricht wie du' : 'Stimme aufnehmen (5–15 Sek.)'}
              </Text>
            </View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Benachrichtigungen ── */}
        <SectionLabel label="Benachrichtigungen" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          {([
            { key: 'likes',      label: 'Likes',          icon: '❤️', sub: 'Wenn jemand deinen Post liket' },
            { key: 'comments',   label: 'Kommentare',     icon: '💬', sub: 'Wenn jemand kommentiert' },
            { key: 'follows',    label: 'Neue Follower',  icon: '👤', sub: 'Wenn dir jemand folgt' },
            { key: 'liveAlerts', label: 'Live-Streams',   icon: '🔴', sub: 'Wenn jemand live geht' },
            { key: 'messages',   label: 'Nachrichten',    icon: '✉️', sub: 'Neue Direktnachrichten' },
            { key: 'reposts',    label: 'Reposts',         icon: '🔁', sub: 'Wenn jemand deinen Post teilt' },
          ] as const).map(({ key, label, icon, sub }, i, arr) => (
            <View key={key}>
              <View style={[s.rowItem, { paddingVertical: 12 }]}>
                <Text style={s.notifEmoji}>{icon}</Text>
                <View style={s.rowBody}>
                  <Text style={[s.rowTitle, { color: colors.text.primary }]}>{label}</Text>
                  <Text style={[s.rowSub, { color: colors.text.muted }]}>{sub}</Text>
                </View>
                <Switch
                  value={notifPrefs[key]}
                  onValueChange={(val) => setNotifPrefs({ [key]: val })}
                  trackColor={{ false: colors.border.default, true: colors.text.primary }}
                  thumbColor={colors.bg.primary}
                  accessibilityLabel={`${label} Benachrichtigungen`}
                />
              </View>
              {i < arr.length - 1 && <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 54 }]} />}
              {/* v1.17.0: Sub-Row unter "Live-Streams" für host-spezifische Mutes */}
              {key === 'liveAlerts' && notifPrefs.liveAlerts && (
                <>
                  <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 54 }]} />
                  <Pressable
                    style={[s.rowItem, { paddingVertical: 12 }]}
                    onPress={() => router.push('/settings/muted-live-hosts' as any)}
                    accessibilityRole="button"
                  >
                    <Text style={s.notifEmoji}>🔕</Text>
                    <View style={s.rowBody}>
                      <Text style={[s.rowTitle, { color: colors.text.primary }]}>Einzelne Hosts stummschalten</Text>
                      <Text style={[s.rowSub, { color: colors.text.muted }]}>Pushes pro Creator an/aus</Text>
                    </View>
                    <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>

        {/* ── Privatsphäre & Sicherheit ── */}
        <SectionLabel label="Privatsphäre & Sicherheit" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <View style={[s.rowItem, { paddingVertical: 14 }]}>
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <Lock size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.text.primary }]}>Privates Profil</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>
                {isPrivate ? 'Neue Follower müssen bestätigt werden' : 'Jeder kann dein Profil sehen'}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={async (val) => {
                setIsPrivate(val);
                const { error } = await supabase.from('profiles').update({ is_private: val }).eq('id', profile?.id ?? '');
                if (error) { setIsPrivate(!val); Alert.alert('Fehler', 'Einstellung konnte nicht gespeichert werden.'); }
                else setProfile({ ...(profile as any), is_private: val });
              }}
              trackColor={{ false: colors.border.default, true: colors.text.primary }}
              thumbColor={colors.bg.primary}
              accessibilityLabel="Privates Profil"
            />
          </View>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          {/* Tab Bar anpassen */}
          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={() => router.push('/settings/tab-bar' as any)} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <Zap size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: colors.text.primary }]}>Tab Bar anpassen</Text>
              <Text style={[s.rowSub, { color: colors.text.muted }]}>Wähle deine Schnellzugriffe</Text>
            </View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          {/* Creator Studio (aktiv) ODER Creator werden (noch kein Creator) */}
          <>
            <Pressable
              style={[s.rowItem, { paddingVertical: 14 }]}
              onPress={() => router.push(profile?.is_creator ? '/creator/dashboard' : '/creator/activate' as any)}
              accessibilityRole="button"
              accessibilityLabel={profile?.is_creator ? 'Creator Studio öffnen' : 'Creator werden'}
            >
              <View style={[s.rowIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                <Sparkles size={15} color="#A855F7" strokeWidth={2} />
              </View>
              <View style={s.rowBody}>
                <Text style={[s.rowTitle, { color: '#A855F7' }]}>
                  {profile?.is_creator ? 'Creator Studio' : 'Creator werden ✦'}
                </Text>
                <Text style={[s.rowSub, { color: colors.text.muted }]}>
                  {profile?.is_creator ? 'Einnahmen, Analytics, Top Posts' : 'Kostenlos · Sofortzugang · Monetarisierung'}
                </Text>
              </View>
              <ChevronRight size={16} stroke="#A855F7" strokeWidth={2} />
            </Pressable>
            <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
          </>

          {/* Admin-Panel — nur für Admins sichtbar */}
          {(profile as any)?.is_admin && (
            <>
              <Pressable
                style={[s.rowItem, { paddingVertical: 14 }]}
                onPress={() => router.push('/admin' as any)}
                accessibilityRole="button"
                accessibilityLabel="Admin Panel"
              >
                <View style={[s.rowIcon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                  <ShieldCheck size={15} color="#6366F1" strokeWidth={2} />
                </View>
                <View style={s.rowBody}>
                  <Text style={[s.rowTitle, { color: '#6366F1' }]}>Admin Panel</Text>
                  <Text style={[s.rowSub, { color: colors.text.muted }]}>Nutzerverwaltung, Reports, Shop</Text>
                </View>
                <ChevronRight size={16} stroke="#6366F1" strokeWidth={2} />
              </Pressable>
              <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />
            </>
          )}

          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={() => router.push('/blocked-users' as any)} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <Shield size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>Geblockte Nutzer</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          {/* Phase 5b: Co-Host spezifische Blocks (DB-persistent, überlebt App-Restart).
              Separater Screen weil das eine andere Liste ist als die globalen User-Blocks. */}
          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={() => router.push('/cohost-blocks' as any)} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <ShieldCheck size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>Co-Host Blocks</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={() => Linking.openURL('https://serlo.social/privacy').catch(() => {})} accessibilityRole="link">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <ExternalLink size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>Datenschutzerklärung</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={() => Linking.openURL('https://serlo.social/privacy').catch(() => {})} accessibilityRole="link">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              <ExternalLink size={15} stroke={colors.icon.default} strokeWidth={2} />
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>Nutzungsbedingungen</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Account ── */}
        <SectionLabel label="Account" colors={colors} />
        <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={handleChangeEmail} disabled={changingEmail} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              {changingEmail ? <ActivityIndicator size="small" color={colors.icon.default} /> : <Mail size={15} stroke={colors.icon.default} strokeWidth={2} />}
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>E-Mail ändern</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
          <View style={[s.sep, { backgroundColor: colors.border.subtle, marginLeft: 56 }]} />

          <Pressable style={[s.rowItem, { paddingVertical: 14 }]} onPress={handleChangePassword} disabled={changingPw} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: colors.bg.elevated }]}>
              {changingPw ? <ActivityIndicator size="small" color={colors.icon.default} /> : <Lock size={15} stroke={colors.icon.default} strokeWidth={2} />}
            </View>
            <View style={s.rowBody}><Text style={[s.rowTitle, { color: colors.text.primary }]}>Passwort ändern</Text></View>
            <ChevronRight size={16} stroke={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Abmelden ── */}
        <Pressable
          onPress={handleLogout}
          style={[s.dangerBtn, { backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.18)' }]}
          accessibilityRole="button" accessibilityLabel="Abmelden"
        >
          <LogOut size={16} stroke="#EF4444" strokeWidth={2} />
          <Text style={[s.dangerBtnText, { color: '#EF4444' }]}>Abmelden</Text>
        </Pressable>

        {/* ── Account löschen ── */}
        <Pressable onPress={handleDeleteAccount} style={s.deleteRow} accessibilityRole="button" accessibilityLabel="Account löschen">
          <Trash2 size={13} stroke={colors.text.muted} strokeWidth={2} />
          <Text style={[s.deleteText, { color: colors.text.muted }]}>Account löschen</Text>
        </Pressable>

        {/* ── Version ── */}
        <Pressable
          onPress={() => {
            if (debugTimerRef.current) clearTimeout(debugTimerRef.current);
            const next = debugTaps + 1;
            setDebugTaps(next);
            if (next >= 7) { setDebugTaps(0); router.push('/debug-gifts' as any); }
            else debugTimerRef.current = setTimeout(() => setDebugTaps(0), 2000);
          }}
          hitSlop={12}
        >
          <Text style={[s.version, { color: colors.text.muted }]}>
            Serlo v{Constants.expoConfig?.version ?? '1.0.0'}
            {debugTaps >= 3 && debugTaps < 7 ? `  •  ${7 - debugTaps}x` : ''}
          </Text>
        </Pressable>
      </ScrollView>

      <VoiceSetupSheet visible={showVoiceSetup} onClose={() => setShowVoiceSetup(false)} />
      <WomenOnlyVerificationSheet
        visible={showWomenOnly}
        onClose={() => setShowWomenOnly(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[sl.label, { color: colors.text.muted }]}>{label.toUpperCase()}</Text>;
}
const sl = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, paddingHorizontal: 20, marginBottom: 7, marginTop: 22 },
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
  scroll: { paddingTop: 16 },

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
    gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
  },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  fieldBody: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput: { fontSize: 15, paddingVertical: 2 },
  bioInput: { minHeight: 52, textAlignVertical: 'top' },

  // Nav rows (pressable)
  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
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

  // Notifications
  notifEmoji: { fontSize: 20, width: 32, textAlign: 'center' },

  // Danger
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 26, paddingVertical: 15,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  deleteText: { fontSize: 13 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 20 },
});

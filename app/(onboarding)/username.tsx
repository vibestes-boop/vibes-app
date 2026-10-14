import { useAuthStore } from '@/lib/authStore';
import { PROFILE_SELECT } from '@/lib/profileSelect';
import { uploadAvatar } from '@/lib/uploadMedia';
import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Check, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';
import { OnboardingButton, OnboardingShell, onboardingStyles as shared } from '@/components/onboarding/OnboardingShell';

export default function OnboardingUsername() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, session } = useAuthStore();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valid = username.trim().length >= 3 && /^[a-z0-9_]+$/i.test(username.trim());
  const avatar = avatarUri ?? profile?.avatar_url;

  const pickAvatar = async () => {
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
    } catch { setError(t('mobileDesign.photoError')); }
  };
  const handleContinue = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) { setError(t('onboarding.usernameMin')); return; }
    if (!/^[a-z0-9_]+$/i.test(trimmed)) { setError(t('onboarding.usernameChars')); return; }
    const userId = session?.user.id;
    if (!userId || !session?.access_token) { setError(t('onboarding.sessionExpired')); return; }
    setLoading(true); setError('');
    try {
      const avatarUrl = avatarUri ? (await uploadAvatar(userId, avatarUri)).url : profile?.avatar_url ?? null;
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=${PROFILE_SELECT}`, {
        method: 'POST', headers: {
          'Content-Type': 'application/json', apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${session.access_token}`, Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ id: userId, username: trimmed, avatar_url: avatarUrl, onboarding_complete: false }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body?.code === '23505' ? t('onboarding.usernameTaken') : t('onboarding.networkError')); return; }
      if (!Array.isArray(body) || body[0]?.id !== userId) throw new Error('Invalid profile response');
      if (useAuthStore.getState().session?.user.id !== userId) return;
      useAuthStore.getState().setProfile(body[0]);
      router.push('/(onboarding)/interests');
    } catch { setError(t('onboarding.networkError')); }
    finally { setLoading(false); }
  };
  return <OnboardingShell step={2} eyebrow={t('mobileDesign.profileEyebrow')} title={t('mobileDesign.profileTitle')} description={t('mobileDesign.profileBody')}
    footer={<><Text style={[shared.hint, { color: colors.text.muted }]}>{t('mobileDesign.profileHint')}</Text><OnboardingButton label={t('onboarding.continueBtn')} onPress={handleContinue} loading={loading} /></>}>
    <View style={[s.identity, { backgroundColor: colors.bg.secondary, borderColor: colors.border.default }]}>
      <View style={[s.decoration, { backgroundColor: colors.bg.elevated }]} />
      <Pressable onPress={pickAvatar} disabled={loading} accessibilityRole="button" accessibilityLabel={t('mobileDesign.addPhoto')} style={s.avatarControl}>
        <View style={[s.avatar, { backgroundColor: colors.bg.elevated, borderColor: colors.bg.secondary }]}>
          {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <UserRound size={42} color={colors.accent.primary} strokeWidth={1.2} />}
        </View>
        <View style={[s.camera, { backgroundColor: colors.accent.solid, borderColor: colors.bg.secondary }]}><Camera size={17} color={colors.text.onAccent} /></View>
      </Pressable>
      <Pressable onPress={pickAvatar} disabled={loading} accessibilityRole="button" style={s.photoLabel}><Text style={[s.photoText, { color: colors.text.primary }]}>{t('mobileDesign.addPhoto')}</Text></Pressable>
      <Text style={[s.optional, { color: colors.text.muted }]}>{t('mobileDesign.photoOptional')}</Text>
    </View>
    <Text style={[s.label, { color: colors.text.primary }]}>{t('mobileDesign.usernameLabel')}</Text>
    <View style={[s.inputWrap, { backgroundColor: colors.bg.secondary, borderColor: error ? colors.accent.danger : colors.border.strong }]}>
      <Text style={[s.at, { color: colors.text.muted }]}>@</Text>
      <TextInput accessibilityLabel={t('mobileDesign.usernameLabel')} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" editable={!loading} value={username} onChangeText={value => { setUsername(value); setError(''); }} placeholder={t('mobileDesign.usernamePlaceholder')} placeholderTextColor={colors.text.muted} returnKeyType="done" onSubmitEditing={handleContinue} style={[s.input, { color: colors.text.primary }]} />
      {valid && <Check size={18} color={colors.accent.primary} accessibilityLabel={t('mobileDesign.validFormat')} />}
    </View>
    <Text style={[s.inputHint, { color: colors.text.muted }]}>{t('mobileDesign.usernameHint')}</Text>
    {!!error && <Text accessibilityRole="alert" style={[shared.error, { color: colors.accent.danger }]}>{error}</Text>}
  </OnboardingShell>;
}
const s = StyleSheet.create({
  identity: { alignItems: 'center', overflow: 'hidden', borderRadius: 24, paddingTop: 22, paddingBottom: 22, marginBottom: 27, borderWidth: 1 },
  decoration: { position: 'absolute', left: 0, right: 0, top: 0, height: 78 },
  avatarControl: { width: 110, height: 110 }, avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  camera: { position: 'absolute', right: 1, bottom: 2, width: 35, height: 35, borderRadius: 18, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  photoLabel: { minHeight: 44, justifyContent: 'center' }, photoText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' }, optional: { fontSize: 11 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  inputWrap: { minHeight: 58, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 9 },
  at: { fontSize: 19 }, input: { flex: 1, minWidth: 0, paddingVertical: 16, fontSize: 16 }, inputHint: { fontSize: 12, lineHeight: 19, marginTop: 10, marginBottom: 16 },
});

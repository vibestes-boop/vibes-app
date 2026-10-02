import { useState } from 'react';
import { Image } from 'expo-image';
import { Check, HeartHandshake, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/useTheme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { OnboardingButton, OnboardingShell, onboardingStyles as shared } from '@/components/onboarding/OnboardingShell';

export default function OnboardingComplete() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, fetchProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const handleFinish = async () => {
    if (!profile?.id || loading) return;
    setLoading(true); setError(false);
    try {
      const { error: saveError } = await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', profile.id);
      if (saveError) throw saveError;
      await fetchProfile(profile.id);
      const confirmed = useAuthStore.getState().profile;
      if (confirmed?.id !== profile.id || !confirmed.onboarding_complete) throw new Error('Profile completion was not confirmed');
      router.replace('/(tabs)');
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  return <OnboardingShell step={4} eyebrow={t('mobileDesign.readyEyebrow')} title={t('mobileDesign.readyTitle')} description={t('mobileDesign.readyBody')}
    footer={<>{error && <Text accessibilityRole="alert" style={[shared.error, { color: colors.accent.danger }]}>{t('onboarding.networkError')}</Text>}<OnboardingButton label={t('mobileDesign.enterCommunity')} onPress={handleFinish} loading={loading} /></>}>
    <View style={[s.profileCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.default }]}>
      <View style={[s.avatar, { backgroundColor: colors.bg.elevated }]}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={[s.initial, { color: colors.accent.primary }]}>{profile?.username?.[0]?.toUpperCase() ?? 'S'}</Text>}</View>
      <Text numberOfLines={2} style={[s.name, { color: colors.text.primary }]}>@{profile?.username}</Text>
      <View style={s.success}><Check size={13} color={colors.accent.primary} /><Text style={{ color: colors.accent.primary, fontSize: 12 }}>{t('mobileDesign.profileReady')}</Text></View>
      <View style={s.tags}>{profile?.preferred_tags?.map(tag => <View key={tag} style={[s.tag, { backgroundColor: colors.bg.elevated }]}><Text style={[s.tagText, { color: colors.text.secondary }]}>{t(`onboarding.interests.${tag}` as TranslationKey)}</Text></View>)}</View>
    </View>
    {[{ Icon: HeartHandshake, title: 'mobileDesign.connectionTitle', body: 'mobileDesign.connectionBody' }, { Icon: ShieldCheck, title: 'mobileDesign.yourChoiceTitle', body: 'mobileDesign.yourChoiceBody' }].map(({ Icon, title, body }) => <View key={title} style={s.row}>
      <View style={[s.icon, { backgroundColor: colors.bg.elevated }]}><Icon size={22} color={colors.accent.primary} strokeWidth={1.5} /></View>
      <View style={{ flex: 1 }}><Text style={[s.rowTitle, { color: colors.text.primary }]}>{t(title as TranslationKey)}</Text><Text style={[s.rowBody, { color: colors.text.secondary }]}>{t(body as TranslationKey)}</Text></View>
    </View>)}
  </OnboardingShell>;
}
const s = StyleSheet.create({
  profileCard: { padding: 26, borderRadius: 25, borderWidth: 1, alignItems: 'center', marginBottom: 24 },
  avatar: { width: 82, height: 82, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14 },
  initial: { fontFamily: 'Inter_600SemiBold', fontSize: 34 }, name: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.6, textAlign: 'center' },
  success: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 9 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 22 }, tag: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }, tagText: { fontSize: 11 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 22 }, icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 5 }, rowBody: { fontSize: 13, lineHeight: 20 },
});

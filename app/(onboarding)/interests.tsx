import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/useTheme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { router } from 'expo-router';
import { Check, Music2, Trophy, Palette, Cpu, Gamepad2, Plane, CookingPot, Shirt, Mountain, Clapperboard, BriefcaseBusiness, Dumbbell } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { OnboardingButton, OnboardingShell, onboardingStyles as shared } from '@/components/onboarding/OnboardingShell';

// These stored tag values are shared with the feed algorithm; translate only labels.
const INTERESTS = [
  { tag: 'Natur', Icon: Mountain }, { tag: 'Musik', Icon: Music2 },
  { tag: 'Sport', Icon: Trophy }, { tag: 'Reisen', Icon: Plane },
  { tag: 'Kochen', Icon: CookingPot }, { tag: 'Mode', Icon: Shirt },
  { tag: 'Kunst', Icon: Palette }, { tag: 'Tech', Icon: Cpu },
  { tag: 'Gaming', Icon: Gamepad2 }, { tag: 'Film', Icon: Clapperboard },
  { tag: 'Business', Icon: BriefcaseBusiness }, { tag: 'Fitness', Icon: Dumbbell },
] as const;
const MIN_SELECTED = 3;

export default function OnboardingInterests() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set(profile?.preferred_tags ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const canProceed = selected.size >= MIN_SELECTED;
  const toggle = (tag: string) => setSelected(previous => {
    const next = new Set(previous); if (next.has(tag)) next.delete(tag); else next.add(tag); return next;
  });
  const handleContinue = async () => {
    if (!canProceed || !profile?.id || saving) return;
    setSaving(true); setError(false);
    try {
      const tags = Array.from(selected);
      const { error: saveError } = await supabase.from('profiles').update({ preferred_tags: tags }).eq('id', profile.id);
      if (saveError) throw saveError;
      const current = useAuthStore.getState().profile;
      if (current?.id !== profile.id) return;
      useAuthStore.getState().setProfile({ ...current, preferred_tags: tags });
      router.push('/(onboarding)/guild');
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return <OnboardingShell step={3} eyebrow={t('mobileDesign.interestsEyebrow')} title={t('mobileDesign.interestsTitle')} description={t('mobileDesign.interestsBody')}
    footer={<><Text style={[shared.hint, { color: canProceed ? colors.accent.primary : colors.text.muted }]} accessibilityLiveRegion="polite">{t(canProceed ? 'onboarding.selectedCount' : 'onboarding.selectMore', { count: canProceed ? selected.size : MIN_SELECTED - selected.size })}</Text><OnboardingButton label={t('onboarding.continueBtn')} onPress={handleContinue} disabled={!canProceed} loading={saving} /><Pressable onPress={() => router.push('/(onboarding)/guild')} disabled={saving} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}><Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>{t('ux.chooseLater')}</Text></Pressable></>}>
    {error && <Text accessibilityRole="alert" style={[shared.error, { color: colors.accent.danger }]}>{t('onboarding.networkError')}</Text>}
    <View style={s.grid}>{INTERESTS.map(({ tag, Icon }) => {
      const on = selected.has(tag);
      const foreground = on ? colors.text.onAccent : colors.text.primary;
      return <Pressable key={tag} accessibilityRole="checkbox" accessibilityLabel={t(`onboarding.interests.${tag}` as TranslationKey)} accessibilityState={{ checked: on, disabled: saving }} disabled={saving} onPress={() => toggle(tag)}
        style={({ pressed }) => [s.tile, { width: width >= 700 ? '31.8%' : '48%', backgroundColor: on ? colors.accent.solid : colors.bg.secondary, borderColor: on ? colors.accent.solid : colors.border.default, opacity: pressed ? 0.8 : 1 }]}>
        <Icon size={25} color={on ? foreground : colors.accent.primary} strokeWidth={1.5} />
        <Text style={[s.label, { color: foreground }]}>{t(`onboarding.interests.${tag}` as TranslationKey)}</Text>
        <View style={[s.check, { borderColor: on ? foreground : colors.border.strong }]}>{on && <Check size={10} strokeWidth={3} color={foreground} />}</View>
      </Pressable>;
    })}</View>
  </OnboardingShell>;
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 11 },
  tile: { minHeight: 106, padding: 18, borderRadius: 19, borderWidth: 1, gap: 16 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  check: { position: 'absolute', top: 13, right: 13, width: 16, height: 16, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

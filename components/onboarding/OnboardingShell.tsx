import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { SerloWordmark } from '@/components/brand/SerloWordmark';

export function OnboardingButton({ label, onPress, loading = false, disabled = false }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const foreground = disabled ? colors.text.muted : colors.text.onAccent;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [s.button, { backgroundColor: disabled ? colors.bg.elevated : colors.accent.solid, opacity: pressed ? 0.84 : 1 }]}>
    {loading ? <ActivityIndicator color={foreground} accessibilityLabel={label} /> : <><Text style={[s.buttonLabel, { color: foreground }]}>{label}</Text><ArrowRight color={foreground} size={20} /></>}
  </Pressable>;
}

export function OnboardingShell({ step, eyebrow, title, description, children, footer }: {
  step: number; eyebrow: string; title: string; description: string; children: ReactNode; footer: ReactNode;
}) {
  useThemedStatusBar('auto');
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.bg.primary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[s.top, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('mobileDesign.back')} style={[s.back, { borderColor: colors.border.default }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
      <SerloWordmark size={27} /><Text style={[s.number, { color: colors.text.muted }]}>0{step} / 04</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={t('mobileDesign.setupProgress')} accessibilityValue={{ min: 1, max: 4, now: step }} style={s.progress}>
      {[1, 2, 3, 4].map(n => <View key={n} style={[s.progressPart, { backgroundColor: n <= step ? colors.accent.primary : colors.border.default }]} />)}
    </View>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.scroll}>
      <Text style={[s.eyebrow, { color: colors.accent.primary }]}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[s.title, { color: colors.text.primary }]}>{title}</Text>
      <Text style={[s.description, { color: colors.text.secondary }]}>{description}</Text>
      {children}
    </ScrollView>
    <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.bg.primary, borderTopColor: colors.border.subtle }]}>{footer}</View>
  </KeyboardAvoidingView>;
}
export const onboardingStyles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 12 },
  error: { color: '#E45A51', fontSize: 13, lineHeight: 19, marginBottom: 12 },
});
const s = StyleSheet.create({
  root: { flex: 1 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 20 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  number: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, marginBottom: 8 }, progressPart: { height: 3, borderRadius: 3, flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 24, paddingBottom: 30 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginBottom: 11, textTransform: 'uppercase' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 38, letterSpacing: -1.2, marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 28 },
  footer: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  button: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 22, paddingVertical: 16 },
  buttonLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', flexShrink: 1 },
});
